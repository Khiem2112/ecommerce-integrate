/**
 * LLM Service - multi-provider client and provider fallback orchestration.
 *
 * Direct low-latency provider priority chain: Gemini -> DeepSeek -> OpenAI -> Grok -> OpenCode
 */

import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type {
  RawMultiDraftResponse,
  LlmGenerationOptions,
  LlmProviderConfig,
  LlmProviderName,
  PromptLogOptions,
} from '@/types';
import { parseAndValidateResponse, parsePositiveIntEnv } from '@/utils/rag';
import { logLlmPrompt, estimateTokens } from '@/lib/logger';

export { logLlmPrompt, estimateTokens };

export const PROVIDER_CONFIGS: readonly {
  readonly name: LlmProviderName;
  readonly envKey: string;
  readonly model: string;
  readonly baseUrl?: string;
}[] = [
  { name: 'gemini', envKey: 'GEMINI_API_KEY', model: 'gemini-2.0-flash' },
  { name: 'deepseek', envKey: 'DEEPSEEK_API_KEY', model: 'deepseek-v4-flash', baseUrl: 'https://api.deepseek.com' },
  { name: 'openai', envKey: 'OPENAI_API_KEY', model: 'gpt-4o-mini' },
  { name: 'grok', envKey: 'GROK_API_KEY', model: 'grok-3-mini-fast', baseUrl: 'https://api.x.ai/v1' },
  { name: 'opencode', envKey: 'OPENCODE_API_KEY', model: 'deepseek-v4-flash', baseUrl: 'https://opencode.ai/zen/go/v1' },
];

const PROVIDER_SPEED_RANK: Record<LlmProviderName, number> = {
  gemini: 1,
  deepseek: 2,
  openai: 3,
  grok: 4,
  opencode: 5,
};

export const DEFAULT_TEMPERATURE = 0.3;
export const MAX_RETRIES_PER_PROVIDER = 2;
export const RETRY_BASE_DELAY_MS = 300;
export const DEFAULT_LLM_TIMEOUT_MS = 8_000;
export const COMPLEX_LLM_TIMEOUT_MS = 12_000;
export const DEFAULT_LLM_TOTAL_BUDGET_MS = 15_000;
export const PROVIDER_COOLDOWN_MS = 45_000;
export const PROVIDER_FAILURE_THRESHOLD = 2;

export type RetryCallContext = {
  readonly hasBackupProviders?: boolean;
  readonly deadlineAt?: number;
};

type ProviderHealthState = {
  consecutiveFailures: number;
  cooldownUntil: number;
};

const providerHealthMap = new Map<LlmProviderName, ProviderHealthState>();

export const CLIENT_TIMEOUT_MS = parsePositiveIntEnv(
  process.env.LLM_TIMEOUT_MS,
  DEFAULT_LLM_TIMEOUT_MS,
);

function resolveAttemptTimeoutMs(
  options?: LlmGenerationOptions,
  remainingBudgetMs?: number,
): number {
  const explicitTimeout =
    options?.timeoutMs !== undefined &&
    Number.isFinite(options.timeoutMs) &&
    options.timeoutMs > 0
      ? Math.trunc(options.timeoutMs)
      : undefined;

  const envTimeout = parsePositiveIntEnv(process.env.LLM_TIMEOUT_MS, 0);
  const tierDefault =
    options?.tier === 'complex' ? COMPLEX_LLM_TIMEOUT_MS : DEFAULT_LLM_TIMEOUT_MS;
  const baseTimeout = explicitTimeout ?? (envTimeout > 0 ? envTimeout : tierDefault);

  if (remainingBudgetMs !== undefined) {
    return Math.max(1, Math.min(baseTimeout, remainingBudgetMs));
  }
  return baseTimeout;
}

function resolveTotalBudgetMs(): number {
  return parsePositiveIntEnv(
    process.env.LLM_TOTAL_BUDGET_MS,
    DEFAULT_LLM_TOTAL_BUDGET_MS,
  );
}

/** Reset in-memory provider circuit-breaker state (for tests and manual recovery). */
export function resetProviderHealthState(): void {
  providerHealthMap.clear();
}

function isProviderInCooldown(providerName: LlmProviderName, now: number = Date.now()): boolean {
  const state = providerHealthMap.get(providerName);
  if (!state) {
    return false;
  }
  if (state.cooldownUntil > now) {
    return true;
  }
  if (state.cooldownUntil > 0 && state.cooldownUntil <= now) {
    providerHealthMap.delete(providerName);
  }
  return false;
}

function recordProviderSuccess(providerName: LlmProviderName): void {
  providerHealthMap.delete(providerName);
}

function extractHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const record = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };
  if (typeof record.status === 'number' && Number.isFinite(record.status)) {
    return record.status;
  }
  if (typeof record.statusCode === 'number' && Number.isFinite(record.statusCode)) {
    return record.statusCode;
  }
  if (typeof record.response?.status === 'number' && Number.isFinite(record.response.status)) {
    return record.response.status;
  }
  return undefined;
}

function isTimeoutOrAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const errorWithCode = error as Error & { code?: unknown };
  if (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    error.name === 'APIConnectionTimeoutError' ||
    errorWithCode.code === 'ETIMEDOUT' ||
    errorWithCode.code === 'ECONNABORTED' ||
    errorWithCode.code === 'ABORT_ERR'
  ) {
    return true;
  }
  return /\b(timeout|timed out|abort|aborted)\b/i.test(error.message);
}

function isNonTransientError(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (status !== undefined && [400, 401, 403, 404, 422].includes(status)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'SyntaxError' || error.name === 'ZodError') {
    return true;
  }
  return /\b(400|401|403|404)\b|unauthorized|forbidden|bad request|invalid api key|api_key_invalid|schema|validation|invalid llm json|invalid json|unexpected token/i.test(
    error.message,
  );
}

function isCircuitBreakerTriggerError(error: unknown): boolean {
  if (isTimeoutOrAbortError(error)) {
    return true;
  }
  const status = extractHttpStatus(error);
  if (status === 401 || status === 403 || (status !== undefined && status >= 500)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return /\b(401|403|500|502|503|504)\b|unauthorized|forbidden|invalid api key|api_key_invalid|service unavailable|internal server error|econnreset|econnrefused|fetch failed|network/i.test(
    error.message,
  );
}

function recordProviderFailure(
  providerName: LlmProviderName,
  error: unknown,
  now: number = Date.now(),
): void {
  if (!isCircuitBreakerTriggerError(error)) {
    return;
  }

  const current = providerHealthMap.get(providerName) ?? {
    consecutiveFailures: 0,
    cooldownUntil: 0,
  };
  const nextFailures = current.consecutiveFailures + 1;
  const cooldownUntil =
    nextFailures >= PROVIDER_FAILURE_THRESHOLD ? now + PROVIDER_COOLDOWN_MS : 0;

  providerHealthMap.set(providerName, {
    consecutiveFailures: nextFailures,
    cooldownUntil,
  });

  if (cooldownUntil > 0) {
    console.warn(
      `[LLM] Circuit breaker opened for ${providerName} for ${PROVIDER_COOLDOWN_MS}ms after ${nextFailures} consecutive failures`,
    );
  }
}

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  providerName: LlmProviderName,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutError = new Error(
            `${providerName} request timed out after ${timeoutMs}ms`,
          );
          timeoutError.name = 'TimeoutError';
          reject(timeoutError);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

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
 * Filter and order LLM providers optimized for query latency across all tiers.
 * Direct providers (gemini, deepseek, openai, grok) always take priority ahead of proxy hops (opencode).
 */
export function getAvailableProvidersForTier(
  tier: 'simple' | 'standard' | 'complex',
): LlmProviderConfig[] {
  void tier;
  const available = getAvailableProviders();
  if (available.length <= 1) {
    return available;
  }

  return [...available].sort(
    (a, b) => (PROVIDER_SPEED_RANK[a.name] ?? 99) - (PROVIDER_SPEED_RANK[b.name] ?? 99),
  );
}

/**
 * Execute HTTP call to Google Gemini API using the official @google/genai SDK.
 */
export async function callGemini(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options?: LlmGenerationOptions,
): Promise<string> {
  const timeoutMs = resolveAttemptTimeoutMs(options);
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: { timeout: timeoutMs },
  });

  const response = await ai.models.generateContent({
    model: config.model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: config.temperature,
      responseMimeType: 'application/json',
      ...(options?.maxOutputTokens !== undefined
        ? { maxOutputTokens: options.maxOutputTokens }
        : {}),
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
  options?: LlmGenerationOptions,
): Promise<string> {
  const timeoutMs = resolveAttemptTimeoutMs(options);
  const client = new OpenAI({
    apiKey: config.apiKey,
    timeout: timeoutMs,
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
      ...(options?.maxOutputTokens !== undefined ? { max_tokens: options.maxOutputTokens } : {}),
    },
    {
      signal: AbortSignal.timeout(timeoutMs),
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
  options?: LlmGenerationOptions,
): Promise<string> {
  if (config.name === 'gemini') {
    return callGemini(config, systemPrompt, userPrompt, options);
  }
  return callOpenAICompatible(config, systemPrompt, userPrompt, options);
}

/**
 * Execute provider API call with fast failover on non-transient/timeout errors
 * and at most one short jittered retry for transient failures within budget.
 */
export async function callWithRetry(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  logOptions?: PromptLogOptions,
  generationOptions?: LlmGenerationOptions,
  retryContext?: RetryCallContext,
): Promise<string> {
  const maxAttempts = Math.min(Math.max(1, config.maxRetries), 2);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remainingBeforeAttempt =
      retryContext?.deadlineAt !== undefined
        ? retryContext.deadlineAt - Date.now()
        : undefined;
    if (remainingBeforeAttempt !== undefined && remainingBeforeAttempt <= 0) {
      throw (
        lastError ??
        new Error(`${config.name} skipped because total LLM budget was exhausted`)
      );
    }

    const attemptTimeoutMs = resolveAttemptTimeoutMs(
      generationOptions,
      remainingBeforeAttempt,
    );
    const attemptOptions: LlmGenerationOptions = {
      ...generationOptions,
      timeoutMs: attemptTimeoutMs,
    };

    try {
      logLlmPrompt(config, systemPrompt, userPrompt, attempt + 1, logOptions);
      return await executeWithTimeout(
        () => callProvider(config, systemPrompt, userPrompt, attemptOptions),
        attemptTimeoutMs,
        config.name,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[LLM] ${config.name} attempt ${attempt + 1}/${maxAttempts} failed: ${lastError.message}`,
      );

      if (attempt >= maxAttempts - 1) {
        break;
      }

      if (isNonTransientError(error)) {
        break;
      }

      if (isTimeoutOrAbortError(error) && retryContext?.hasBackupProviders) {
        break;
      }

      const remainingAfterAttempt =
        retryContext?.deadlineAt !== undefined
          ? retryContext.deadlineAt - Date.now()
          : undefined;
      if (remainingAfterAttempt !== undefined && remainingAfterAttempt <= 50) {
        break;
      }

      const jitteredDelay = Math.round(
        RETRY_BASE_DELAY_MS * (0.75 + Math.random() * 0.5),
      );
      const boundedDelay =
        remainingAfterAttempt !== undefined
          ? Math.min(jitteredDelay, Math.max(0, remainingAfterAttempt - 50))
          : jitteredDelay;

      if (boundedDelay <= 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, boundedDelay));
    }
  }

  throw lastError ?? new Error(`${config.name} failed after ${maxAttempts} attempts`);
}

/**
 * Generate a multi-draft response using the configured LLM provider fallback chain.
 * Enforces cross-provider deadline, fast failover, and per-provider circuit-breaker cooldowns.
 *
 * @throws Error if all providers fail, are in cooldown, exceed budget, or no API keys are configured
 */
export async function generateResponse(
  systemPrompt: string,
  userPrompt: string,
  allowedStrategyCodes?: readonly string[],
  customProviders?: readonly LlmProviderConfig[],
  options?: LlmGenerationOptions,
): Promise<RawMultiDraftResponse> {
  const providers = customProviders ?? getAvailableProviders();

  if (providers.length === 0) {
    throw new Error(
      'No LLM providers configured. Set at least one API key: GEMINI_API_KEY, OPENAI_API_KEY, GROK_API_KEY, DEEPSEEK_API_KEY, or OPENCODE_API_KEY',
    );
  }

  const totalBudgetMs = resolveTotalBudgetMs();
  const deadlineAt = Date.now() + totalBudgetMs;
  const healthyProviders = providers.filter(
    (provider) => !isProviderInCooldown(provider.name),
  );

  if (healthyProviders.length === 0) {
    throw new Error(
      'All LLM providers are temporarily in cooldown after repeated failures',
    );
  }

  let lastError: Error | null = null;

  for (let i = 0; i < healthyProviders.length; i++) {
    const provider = healthyProviders[i];
    const remainingBudgetMs = deadlineAt - Date.now();
    if (remainingBudgetMs <= 0) {
      throw new Error(
        `LLM total budget (${totalBudgetMs}ms) exceeded before trying ${provider.name}. Last error: ${lastError?.message ?? 'none'}`,
      );
    }

    try {
      console.log(`[LLM] Trying provider: ${provider.name} (${provider.model})`);
      const rawText = await callWithRetry(
        provider,
        systemPrompt,
        userPrompt,
        undefined,
        options,
        {
          hasBackupProviders: i < healthyProviders.length - 1,
          deadlineAt,
        },
      );
      const parsed = parseAndValidateResponse(rawText, provider.name, allowedStrategyCodes);
      recordProviderSuccess(provider.name);
      console.log(`[LLM] Success with ${provider.name}`);
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      recordProviderFailure(provider.name, error);
      console.warn(`[LLM] Provider ${provider.name} exhausted: ${lastError.message}`);
    }
  }

  if (Date.now() >= deadlineAt) {
    throw new Error(
      `LLM total budget (${totalBudgetMs}ms) exceeded across providers. Last error: ${lastError?.message ?? 'unknown'}`,
    );
  }

  throw new Error(
    `All LLM providers failed. Last error: ${lastError?.message ?? 'unknown'}`,
  );
}

export const generateMultiDraftResponse = generateResponse;
