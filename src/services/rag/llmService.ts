/**
 * LLM Service — multi-provider client with automatic fallback.
 *
 * Provider chain: Gemini → ChatGPT → Grok → DeepSeek → OpenCode
 */

import type { RawMultiDraftResponse } from '@/types';
import {
  getAvailableProviders,
  callWithRetry,
  parseAndValidateResponse,
} from '@/utils/rag';

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
  customProviders?: readonly import('@/types').LlmProviderConfig[],
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

