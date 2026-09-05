/**
 * Pure stateless cURL command parser for Lazada API Dev Playground
 * Extracts method, path, headers, query parameters, and body payloads.
 */

export type ParsedCurlParam = {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly active: boolean;
};

export type ParsedCurlResult = {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly fullUrl: string;
  readonly params: readonly ParsedCurlParam[];
  readonly rawBody?: string;
  readonly headers: Record<string, string>;
};

const SYSTEM_KEYS = new Set(['sign', 'timestamp', 'sign_method', 'partner_id']);

/**
 * Parses a raw cURL command string into structured API execution options.
 */
export function parseCurlCommand(rawCurl: string): ParsedCurlResult {
  const cleaned = rawCurl
    .replace(/\\\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let method: 'GET' | 'POST' = 'GET';
  let url = '';
  const headers: Record<string, string> = {};
  const paramsMap: Map<string, string> = new Map();
  let rawBody: string | undefined;

  // Extract Method
  const methodMatch = cleaned.match(/(?:-X|--request)\s+([A-Z]+)/i);
  if (methodMatch?.[1]) {
    method = methodMatch[1].toUpperCase() === 'POST' ? 'POST' : 'GET';
  }

  // Extract URL (enclosed in quotes or bare)
  const urlMatch = cleaned.match(/(?:curl\s+)?(?:-X\s+[A-Z]+\s+)?['"](https?:\/\/[^'"]+)['"]|(https?:\/\/[^\s'"]+)/i);
  if (urlMatch) {
    url = urlMatch[1] ?? urlMatch[2] ?? '';
  }

  // If -d or --data is present and no explicit method was given, default to POST
  if (/(?:-d|--data|--data-raw|--data-urlencode|-F)\s+/i.test(cleaned)) {
    method = 'POST';
  }

  // Extract Path and query parameters from URL
  let apiPath = '/';
  if (url) {
    try {
      const parsedUrl = new URL(url);
      apiPath = parsedUrl.pathname.replace(/^\/rest/, '') || '/';
      
      // Parse query params from URL
      parsedUrl.searchParams.forEach((val, key) => {
        if (!SYSTEM_KEYS.has(key.toLowerCase())) {
          paramsMap.set(key, val);
        }
      });
    } catch {
      // Fallback regex if URL is relative or malformed
      const pathOnly = url.replace(/^https?:\/\/[^/]+(?:\/rest)?/, '');
      const [p, qs] = pathOnly.split('?');
      apiPath = p || '/';
      if (qs) {
        const usp = new URLSearchParams(qs);
        usp.forEach((val, key) => {
          if (!SYSTEM_KEYS.has(key.toLowerCase())) {
            paramsMap.set(key, val);
          }
        });
      }
    }
  }

  // Extract Body (--data, -d, --data-raw, --data-urlencode)
  const dataMatches = cleaned.matchAll(/(?:--data|--data-raw|--data-urlencode|-d)\s+['"]([^'"]+)['"]|(?:--data|--data-raw|--data-urlencode|-d)\s+([^\s'"]+)/gi);
  for (const dm of dataMatches) {
    const rawData = dm[1] ?? dm[2] ?? '';
    rawBody = rawData;

    // Check if it's key=value or XML/JSON payload
    if (rawData.includes('=') && !rawData.startsWith('<') && !rawData.startsWith('{')) {
      const usp = new URLSearchParams(rawData);
      usp.forEach((val, key) => {
        if (!SYSTEM_KEYS.has(key.toLowerCase())) {
          paramsMap.set(key, val);
        }
      });
    } else if (rawData.startsWith('payload=')) {
      paramsMap.set('payload', rawData.substring('payload='.length));
    }
  }

  // Convert paramsMap to list
  const params: ParsedCurlParam[] = [];
  let index = 0;
  for (const [k, v] of paramsMap.entries()) {
    params.push({
      id: `param-${Date.now()}-${index++}`,
      key: k,
      value: v,
      active: true,
    });
  }

  return {
    method,
    path: apiPath.startsWith('/') ? apiPath : `/${apiPath}`,
    fullUrl: url,
    params,
    rawBody,
    headers,
  };
}
