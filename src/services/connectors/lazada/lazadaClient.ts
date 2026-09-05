/**
 * Lazada HTTP Client with HMAC-SHA256 Signing, Timeout, Resilience & Retry
 */

import { buildSignedQueryParams } from './lazadaSigner';
import type { LazadaApiResponse } from '@/types';

export class LazadaClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LazadaClientError';
  }
}

export class LazadaApiError extends LazadaClientError {
  readonly code: string;
  readonly type?: string;
  readonly requestId?: string;
  readonly rawPayload?: unknown;

  constructor(code: string, message: string, rawPayload?: unknown, type?: string, requestId?: string) {
    super(`[${code}] ${message}`);
    this.name = 'LazadaApiError';
    this.code = code;
    this.type = type;
    this.requestId = requestId;
    this.rawPayload = rawPayload;
  }
}

export class LazadaNetworkError extends LazadaClientError {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'LazadaNetworkError';
    this.cause = cause;
  }
}

export class LazadaSignatureError extends LazadaApiError {
  constructor(message: string, rawPayload?: unknown) {
    super('IncompleteSignature', message, rawPayload, 'ISV');
    this.name = 'LazadaSignatureError';
  }
}

export type LazadaClientConfig = {
  readonly baseUrl?: string;
  readonly appKey?: string;
  readonly appSecret?: string;
  readonly accessToken?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly apiScope?: 'business' | 'chat';
};

export class LazadaClient {
  private readonly baseUrl: string;
  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly accessToken?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly apiScope: 'business' | 'chat';

  constructor(config: LazadaClientConfig = {}) {
    this.apiScope = config.apiScope ?? 'business';

    const defaultBaseUrl =
      process.env.LAZADA_API_BASE_URL ??
      process.env.LAZADA_API_BASE ??
      'http://localhost:4000/rest';

    const defaultAppKey =
      process.env.LAZADA_APP_KEY ?? 'mock_app_key_123';

    const defaultAppSecret =
      process.env.LAZADA_APP_SECRET ?? 'mock_app_secret_456';

    const defaultAccessToken =
      process.env.LAZADA_ACCESS_TOKEN ?? undefined;

    this.baseUrl = (config.baseUrl ?? defaultBaseUrl).replace(/\/+$/, '');
    this.appKey = config.appKey ?? defaultAppKey;
    this.appSecret = config.appSecret ?? defaultAppSecret;
    this.accessToken = config.accessToken ?? defaultAccessToken;
    this.timeoutMs = config.timeoutMs ?? 10000;
    this.maxRetries = config.maxRetries ?? 2;
  }

  public getConfig(): {
    readonly baseUrl: string;
    readonly appKey: string;
    readonly hasSecret: boolean;
    readonly hasToken: boolean;
    readonly apiScope: 'business' | 'chat';
  } {
    return {
      baseUrl: this.baseUrl,
      appKey: this.appKey,
      hasSecret: Boolean(this.appSecret),
      hasToken: Boolean(this.accessToken),
      apiScope: this.apiScope,
    };
  }

  /**
   * Helper to normalize path and prepend `/rest` if not already present.
   */
  private normalizePath(apiPath: string): { readonly signPath: string; readonly fetchPath: string } {
    const cleaned = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
    const signPath = cleaned.replace(/^\/rest/, '') || '/';
    
    // If baseUrl already ends with /rest, avoid duplicate /rest/rest
    let fetchPath = cleaned;
    if (this.baseUrl.endsWith('/rest') && fetchPath.startsWith('/rest')) {
      fetchPath = fetchPath.replace(/^\/rest/, '');
    }

    return { signPath, fetchPath };
  }

  /**
   * Execute GET request with HMAC-SHA256 signing, timeout and retry logic.
   */
  public async get<T>(
    apiPath: string,
    params: Record<string, unknown> = {},
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    const { signPath, fetchPath } = this.normalizePath(apiPath);

    const stringParams: Record<string, string | number | boolean | undefined | null> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        stringParams[k] = typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean);
      }
    }

    const signedParams = buildSignedQueryParams({
      apiPath: signPath,
      params: stringParams,
      appKey: this.appKey,
      appSecret: this.appSecret,
      accessToken: this.accessToken,
    });

    const url = new URL(`${this.baseUrl}${fetchPath}`);
    for (const [k, v] of Object.entries(signedParams)) {
      url.searchParams.append(k, v);
    }

    return this.executeWithRetry<T>(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    });
  }

  /**
   * Execute POST request with HMAC-SHA256 signing.
   */
  public async post<T>(
    apiPath: string,
    params: Record<string, unknown> = {},
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    const { signPath, fetchPath } = this.normalizePath(apiPath);

    const stringParams: Record<string, string | number | boolean | undefined | null> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        stringParams[k] = typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean);
      }
    }

    const signedParams = buildSignedQueryParams({
      apiPath: signPath,
      params: stringParams,
      appKey: this.appKey,
      appSecret: this.appSecret,
      accessToken: this.accessToken,
    });

    const url = `${this.baseUrl}${fetchPath}`;
    const formBody = new URLSearchParams();
    for (const [k, v] of Object.entries(signedParams)) {
      formBody.append(k, v);
    }

    return this.executeWithRetry<T>(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
      body: formBody.toString(),
    });
  }

  /**
   * Universal dynamic request executor for any method.
   */
  public async request<T = unknown>(
    method: 'GET' | 'POST',
    apiPath: string,
    params: Record<string, unknown> = {},
    options?: { headers?: Record<string, string> },
  ): Promise<T> {
    if (method === 'POST') {
      return this.post<T>(apiPath, params, options);
    }
    return this.get<T>(apiPath, params, options);
  }

  /**
   * Internal request executor with Exponential Backoff and Error taxonomy.
   */
  private async executeWithRetry<T>(url: string, requestInit: RequestInit): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting (429)
        if (response.status === 429 && attempt < this.maxRetries) {
          const backoffMs = Math.min(3000, 300 * Math.pow(2, attempt) + Math.random() * 100);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        let json: LazadaApiResponse<T>;
        try {
          json = (await response.json()) as LazadaApiResponse<T>;
        } catch {
          throw new LazadaNetworkError(`Phản hồi từ máy chủ không phải JSON hợp lệ (HTTP ${response.status})`);
        }

        // Check Lazada API error codes
        if (!response.ok || (json.code && json.code !== '0')) {
          const code = json.code ?? String(response.status);
          const message = json.message ?? 'Lỗi từ Lazada API';
          const type = json.type;
          const requestId = json.request_id;

          if (code === 'IncompleteSignature' || code === 'InvalidSignature') {
            throw new LazadaSignatureError(message, json);
          }

          throw new LazadaApiError(code, message, json, type, requestId);
        }

        return json.data as T;
      } catch (err: unknown) {
        clearTimeout(timeoutId);

        if (err instanceof LazadaClientError) {
          // Do not retry domain signature or business errors
          if (err instanceof LazadaApiError && err.code !== '429') {
            throw err;
          }
          lastError = err;
        } else if (err instanceof Error) {
          if (err.name === 'AbortError') {
            lastError = new LazadaNetworkError(`Quá thời gian kết nối sau ${this.timeoutMs}ms (Timeout)`);
          } else {
            lastError = new LazadaNetworkError(`Lỗi kết nối mạng: ${err.message}`, err);
          }
        } else {
          lastError = new LazadaNetworkError('Lỗi mạng không xác định');
        }

        // Retry on transient network errors
        if (attempt < this.maxRetries) {
          const backoffMs = Math.min(3000, 200 * Math.pow(2, attempt) + Math.random() * 50);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError ?? new LazadaNetworkError('Yêu cầu kết nối thất bại sau số lần thử lại tối đa.');
  }
}
