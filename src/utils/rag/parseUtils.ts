import type { RawMultiDraftResponse } from '@/types';
import {
  rawMultiDraftResponseSchema,
  createRawMultiDraftResponseSchema,
} from '@/forms/ragForm';

/**
 * Parse raw LLM output string as JSON and validate against the Multi-Draft schema.
 * Pure, stateless validator without any external I/O or network requests.
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

  // Enforce schema matching active retention strategy catalog if allowed codes are provided
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
