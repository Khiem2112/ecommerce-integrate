/**
 * LLM Service — multi-provider client and provider fallback orchestration.
 *
 * Provider priority chain: Gemini → OpenAI → Grok → DeepSeek → OpenCode
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type {
  RawMultiDraftResponse,
  LlmProviderConfig,
  LlmProviderName,
  PromptLogOptions,
} from '@/types';
import { parseAndValidateResponse } from '@/utils/rag/parseUtils';
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
 * Filter and order LLM providers optimized for query latency tier.
 * For Simple & Standard tiers, prioritize ultra-low latency providers.
 * For Complex tiers, preserve full provider sequence with deep reasoning capabilities.
 */
export function getAvailableProvidersForTier(
  tier: 'simple' | 'standard' | 'complex',
): LlmProviderConfig[] {
  const available = getAvailableProviders();
  if (tier === 'complex' || available.length <= 1) {
    return available;
  }

  // Priority order for low-latency tiers
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
 * Execute HTTP call to Google Gemini API using the official @google/genai SDK.
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
 * Execute HTTP call to OpenAI-compatible REST endpoints (ChatGPT, Grok, DeepSeek, OpenCode).
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
 * Generate a multi-draft response using the configured LLM provider fallback chain.
 * Tries each available provider in priority sequence until one succeeds.
 *
 * @throws Error if all providers fail or no API keys are configured
 */
export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  allowedStrategyCodes?: readonly string[],
  customProviders?: readonly LlmProviderConfig[],
): Promise<RawMultiDraftResponse> {
  const providers = customProviders ?? getAvailableProviders();

  if (providers.length === 0) {
    throw new Error(
      'No LLM providers configured. Set at least one API key: GEMINI_API_KEY, OPENAI_API_KEY, GROK_API_KEY, DEEPSEEK_API_KEY, or OPENCODE_API_KEY',
    );
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[LLM] Trying provider: ${provider.name} (${provider.model})`);
      const rawText = await callWithRetry(provider, systemPrompt, userPrompt);
      const parsed = parseAndValidateResponse(rawText, provider.name, allowedStrategyCodes);
      console.log(`[LLM] ✅ Success with ${provider.name}`);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[LLM] ❌ Provider ${provider.name} exhausted: ${lastError.message}`);
    }
  }

  throw new Error(
    `All LLM providers failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}

export const generateMultiDraftResponse = generateResponse;
