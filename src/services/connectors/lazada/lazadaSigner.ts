/**
 * Lazada Open Platform HMAC-SHA256 Request Signing Algorithm
 *
 * Specification:
 * - Collect all query and form parameters (excluding 'sign').
 * - Sort parameter keys alphabetically in ascending order (A-Z).
 * - Concatenate into a canonical string: `<apiPath><key1><val1><key2><val2>...`
 * - Compute HMAC-SHA256 digest using `appSecret` and convert to uppercase hexadecimal string.
 */

import crypto from 'node:crypto';

export type SignParamsOptions = {
  readonly apiPath: string;
  readonly params: Record<string, string | number | boolean | undefined | null>;
  readonly appKey: string;
  readonly appSecret: string;
  readonly accessToken?: string;
  readonly timestamp?: string;
};

/**
 * Pure helper to calculate the raw HMAC-SHA256 signature string for an API path and sorted params.
 */
export function calculateLazadaSignature(
  apiPath: string,
  params: Record<string, string>,
  appSecret: string,
): string {
  const sortedKeys = Object.keys(params)
    .filter((k) => k !== 'sign')
    .sort();

  let canonicalString = apiPath;
  for (const key of sortedKeys) {
    canonicalString += `${key}${params[key]}`;
  }

  return crypto
    .createHmac('sha256', appSecret)
    .update(canonicalString)
    .digest('hex')
    .toUpperCase();
}

/**
 * Builds the complete set of query parameters with timestamp, app_key, sign_method and valid signature.
 */
export function buildSignedQueryParams(options: SignParamsOptions): Record<string, string> {
  const { apiPath, params, appKey, appSecret, accessToken, timestamp } = options;

  const queryParams: Record<string, string> = {
    app_key: appKey,
    timestamp: timestamp ?? String(Date.now()),
    sign_method: 'sha256',
  };

  if (accessToken && accessToken.trim() !== '') {
    queryParams.access_token = accessToken.trim();
  }

  // Merge extra parameters filtering out undefined, null, and empty strings
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      queryParams[k] = String(v);
    }
  }

  // Calculate signature from merged parameters
  const sign = calculateLazadaSignature(apiPath, queryParams, appSecret);
  queryParams.sign = sign;

  return queryParams;
}
