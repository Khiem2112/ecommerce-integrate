import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { RawMultiDraftResponse, LlmProviderConfig, LlmProviderName, PromptLogOptions } from '@/types';
import { rawMultiDraftResponseSchema, createRawMultiDraftResponseSchema } from '@/forms/ragForm';
import { logLlmPrompt, estimateTokens } from '@/lib/logger';

export { logLlmPrompt, estimateTokens };

export const PROVIDER_CONFIGS: readonly {
  readonly name: LlmProviderName;
  readonly envKey: string;
  readonly model: string;
  readonly baseUrl?: string;
}[] = [
    { name: 'opencode', envKey: 'OPENCODE_API_KEY', model: 'deepseek-v4-flash', baseUrl: 'https://opencode.ai/zen/go/v1' },
    { name: 'gemini', envKey: 'GEMINI_API_KEY', model: 'gemini-2.0-flash' },
    { name: 'deepseek', envKey: 'DEEPSEEK_API_KEY', model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' },
    { name: 'openai', envKey: 'OPENAI_API_KEY', model: 'gpt-4o-mini' },
    { name: 'grok', envKey: 'GROK_API_KEY', model: 'grok-3-mini-fast', baseUrl: 'https://api.x.ai/v1' },
  ];

export const DEFAULT_TEMPERATURE = 0.3;
export const MAX_RETRIES_PER_PROVIDER = 2;
export const RETRY_BASE_DELAY_MS = 1000;
export const CLIENT_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 60_000;

/**
 * Filter and assemble configured LLM providers based on existing environment API keys.
 */
export function getAvailableProviders(): LlmProviderConfig[] {
  return PROVIDER_CONFIGS
    .filter((cfg) => {
      const key = process.env[cfg.envKey];
      return key != null && key.trim().length > 0;
    })
    .map((cfg) => ({
      name: cfg.name,
      model: cfg.model,
      apiKey: process.env[cfg.envKey]!,
      baseUrl: cfg.baseUrl,
      temperature: DEFAULT_TEMPERATURE,
      maxRetries: MAX_RETRIES_PER_PROVIDER,
    }));
}

/**
 * Filter and order LLM providers optimized for the query tier.
 * For Simple & Standard tiers, prioritize ultra-low latency providers (Gemini Flash, DeepSeek Flash, GPT-4o-mini).
 * For Complex tiers, preserve full provider sequence with deep reasoning capabilities.
 */
export function getAvailableProvidersForTier(tier: 'simple' | 'standard' | 'complex'): LlmProviderConfig[] {
  const available = getAvailableProviders();
  if (tier === 'complex' || available.length <= 1) {
    return available;
  }

  // Priority order for low-latency tiers: gemini -> deepseek -> openai -> grok -> opencode
  const speedRank: Record<LlmProviderName, number> = {
    gemini: 1,
    deepseek: 2,
    openai: 3,
    grok: 4,
    opencode: 5,
  };

  return [...available].sort((a, b) => (speedRank[a.name] ?? 99) - (speedRank[b.name] ?? 99));
}

/**
 * Call Google Gemini API using the official @google/genai SDK.
 */
export async function callGemini(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: { timeout: CLIENT_TIMEOUT_MS },
  });

  const response = await ai.models.generateContent({
    model: config.model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: config.temperature,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

/**
 * Call OpenAI-compatible REST endpoints (ChatGPT, Grok, DeepSeek, OpenCode).
 */
export async function callOpenAICompatible(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    timeout: CLIENT_TIMEOUT_MS,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const response = await client.chat.completions.create(
    {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: config.temperature,
      response_format: { type: 'json_object' },
    },
    {
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      maxRetries: 0,
    },
  );

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error(`${config.name} returned empty response`);
  return text;
}

/**
 * Dispatch API request to the appropriate SDK caller based on provider name.
 */
export async function callProvider(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  if (config.name === 'gemini') {
    return callGemini(config, systemPrompt, userPrompt);
  }
  return callOpenAICompatible(config, systemPrompt, userPrompt);
}

/**
 * Execute provider API call with exponential backoff retry.
 */
export async function callWithRetry(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  logOptions?: PromptLogOptions,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      logLlmPrompt(config, systemPrompt, userPrompt, attempt + 1, logOptions);
      return await callProvider(config, systemPrompt, userPrompt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[LLM] ${config.name} attempt ${attempt + 1}/${config.maxRetries} failed: ${lastError.message}`,
      );

      if (attempt < config.maxRetries - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`${config.name} failed after ${config.maxRetries} retries`);
}

/**
 * Parse raw response JSON string and validate against Multi-Draft schema.
 */
export function parseAndValidateResponse(
  rawText: string,
  providerName: string,
  allowedStrategyCodes?: readonly string[],
): RawMultiDraftResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`${providerName} returned invalid JSON: ${rawText.slice(0, 200)}`);
  }

  const schema =
    allowedStrategyCodes && allowedStrategyCodes.length > 0
      ? createRawMultiDraftResponseSchema(allowedStrategyCodes)
      : rawMultiDraftResponseSchema;

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${providerName} response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return { ...result.data, providerUsed: providerName };
}
