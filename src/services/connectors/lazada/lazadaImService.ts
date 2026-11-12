import { appLogger } from '@/lib/logger';
import {
  refreshShopTokenIfNeededService,
  type LazadaIntegrationData,
  type PlatformIntegrationData,
} from '@/services/shopCredentialService';
import { LazadaApiError, LazadaClient } from './lazadaClient';
import type {
  LazadaImMessageListResponse,
  LazadaImMessageRecallResponse,
  LazadaImSendMessageResponse,
  LazadaImSessionDetailDTO,
  LazadaImSessionListResponse,
  LazadaImSessionOpenResponse,
  LazadaImTemplatePayload,
} from '@/types';

const LAZADA_IM_MAX_PAGE_SIZE = 20;
const LAZADA_FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const LAZADA_SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const LAZADA_TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const LAZADA_ANTI_SPAM_MAX_REPLIES = 5;

export type SendLazadaMessageResult = {
  readonly success: boolean;
  readonly messageId?: string;
  readonly currentTime?: number;
  readonly error?: string;
};

export type MarkLazadaSessionReadResult = {
  readonly success: boolean;
  readonly error?: string;
};

export type LazadaImServiceResult<T> =
  | {
      readonly success: true;
      readonly data: T;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

export type ListLazadaImSessionsOptions = {
  readonly startTime?: number;
  readonly lastSessionId?: string;
  readonly pageSize?: number;
};

export type ListLazadaImMessagesOptions = {
  readonly sessionId: string;
  readonly startTime?: number;
  readonly lastMessageId?: string;
  readonly pageSize?: number;
};

export type EvaluateLazadaSessionValidityInput = {
  readonly lastBuyerMessageTime?: Date | number | string | null;
  readonly latestOrderTime?: Date | number | string | null;
  readonly now?: Date | number;
};

export type LazadaSessionValidityReason =
  | 'active_buyer_window'
  | 'recent_order_7d_window'
  | 'expired';

export type LazadaSessionValidityResult = {
  readonly isValid: boolean;
  readonly reason: LazadaSessionValidityReason;
  readonly requiresSessionOpen: boolean;
  readonly remainingBuyerWindowMs: number;
};

export type EvaluateLazadaAntiSpamQuotaInput = {
  readonly lastBuyerMessageTime?: Date | number | string | null;
  readonly consecutiveSellerRepliesSinceLastBuyer: number;
  readonly now?: Date | number;
};

export type LazadaAntiSpamQuotaResult = {
  readonly allowed: boolean;
  readonly withinBuyer24hWindow: boolean;
  readonly consecutiveCount: number;
  readonly remainingQuota: number | null;
};

export function isLazadaImSimulateMode(): boolean {
  return process.env.LAZADA_IM_SIMULATE_SEND === 'true';
}

function isLazadaCredentials(
  credentials: PlatformIntegrationData,
): credentials is LazadaIntegrationData {
  return (
    typeof credentials === 'object' &&
    credentials !== null &&
    'sellerId' in credentials &&
    typeof credentials.sellerId === 'string' &&
    !('shopDomain' in credentials)
  );
}

function formatLazadaImError(error: unknown, fallbackMessage: string): string {
  if (error instanceof LazadaApiError) {
    return error.requestId ? `${error.message} (request_id: ${error.requestId})` : error.message;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallbackMessage;
}

function validatePageSize(
  pageSize?: number,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  const effectivePageSize = pageSize ?? LAZADA_IM_MAX_PAGE_SIZE;
  if (
    !Number.isInteger(effectivePageSize) ||
    effectivePageSize < 1 ||
    effectivePageSize > LAZADA_IM_MAX_PAGE_SIZE
  ) {
    return {
      ok: false,
      error: `pageSize must be an integer between 1 and ${LAZADA_IM_MAX_PAGE_SIZE}`,
    };
  }
  return { ok: true, value: effectivePageSize };
}

function toEpochMs(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = new Date(trimmed).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function resolveNowMs(now?: Date | number): number {
  if (now === undefined) {
    return Date.now();
  }
  if (typeof now === 'number') {
    return Number.isFinite(now) ? now : Date.now();
  }
  const time = now.getTime();
  return Number.isNaN(time) ? Date.now() : time;
}

function buildSendMessagePayload(
  sessionId: string,
  text: string,
  templateOptions?: LazadaImTemplatePayload,
): { readonly ok: true; readonly payload: Record<string, unknown> } | { readonly ok: false; readonly error: string } {
  if (!templateOptions || templateOptions.templateId === 1) {
    const resolvedText =
      templateOptions?.templateId === 1 && templateOptions.txt !== undefined
        ? templateOptions.txt
        : text;

    if (!resolvedText || resolvedText.trim().length === 0) {
      return { ok: false, error: 'Message text is required for template_id 1' };
    }

    const translateTxt =
      templateOptions?.templateId === 1
        ? (templateOptions.translate_txt ?? templateOptions.translateTxt)?.trim()
        : undefined;

    const payload: Record<string, unknown> = {
      session_id: sessionId,
      template_id: 1,
      txt: resolvedText,
    };

    if (translateTxt) {
      payload.translate_txt = translateTxt;
    }

    return { ok: true, payload };
  }

  if (templateOptions.templateId === 3) {
    const imgUrl = (templateOptions.img_url ?? templateOptions.imgUrl)?.trim();
    if (!imgUrl) {
      return { ok: false, error: 'img_url is required for template_id 3' };
    }

    const payload: Record<string, unknown> = {
      session_id: sessionId,
      template_id: 3,
      img_url: imgUrl,
    };

    if (typeof templateOptions.width === 'number' && Number.isFinite(templateOptions.width)) {
      payload.width = templateOptions.width;
    }
    if (typeof templateOptions.height === 'number' && Number.isFinite(templateOptions.height)) {
      payload.height = templateOptions.height;
    }
    const osskey = templateOptions.osskey?.trim();
    if (osskey) {
      payload.osskey = osskey;
    }

    return { ok: true, payload };
  }

  if (templateOptions.templateId === 10006) {
    const rawItemId = templateOptions.item_id ?? templateOptions.itemId;
    const itemId = rawItemId !== undefined && rawItemId !== null ? String(rawItemId).trim() : '';
    if (!itemId) {
      return { ok: false, error: 'item_id is required for template_id 10006' };
    }

    return {
      ok: true,
      payload: {
        session_id: sessionId,
        template_id: 10006,
        item_id: itemId,
      },
    };
  }

  if (templateOptions.templateId === 10007) {
    const rawOrderId = templateOptions.order_id ?? templateOptions.orderId;
    const orderId = rawOrderId !== undefined && rawOrderId !== null ? String(rawOrderId).trim() : '';
    if (!orderId) {
      return { ok: false, error: 'order_id is required for template_id 10007' };
    }

    return {
      ok: true,
      payload: {
        session_id: sessionId,
        template_id: 10007,
        order_id: orderId,
      },
    };
  }

  if (templateOptions.templateId === 10008) {
    const rawPromotionId = templateOptions.promotion_id ?? templateOptions.promotionId;
    const promotionId =
      rawPromotionId !== undefined && rawPromotionId !== null ? String(rawPromotionId).trim() : '';
    if (!promotionId) {
      return { ok: false, error: 'promotion_id is required for template_id 10008' };
    }

    return {
      ok: true,
      payload: {
        session_id: sessionId,
        template_id: 10008,
        promotion_id: promotionId,
      },
    };
  }

  if (templateOptions.templateId === 10010) {
    return {
      ok: true,
      payload: {
        session_id: sessionId,
        template_id: 10010,
      },
    };
  }

  return { ok: false, error: 'Unsupported Lazada IM template_id' };
}

/**
 * Loads and refreshes per-shop Lazada OAuth credentials under the credential service mutex
 * and builds an IM-scoped LazadaClient.
 */
export async function createLazadaChatClient(connectionId: number): Promise<LazadaClient> {
  const credentials = await refreshShopTokenIfNeededService(connectionId);

  if (!isLazadaCredentials(credentials)) {
    throw new Error(`Connection ${connectionId} does not contain Lazada credentials`);
  }

  const accessToken = credentials.accessToken?.trim();
  if (!accessToken) {
    throw new Error(`Lazada connection ${connectionId} is missing an accessToken`);
  }

  return new LazadaClient({
    apiScope: 'chat',
    appKey: credentials.customAppKey,
    appSecret: credentials.customAppSecret,
    accessToken,
    timeoutMs: 8000,
    maxRetries: 1,
  });
}

export async function sendLazadaImMessage(
  connectionId: number,
  sessionId: string,
  text: string,
  templateOptions?: LazadaImTemplatePayload,
): Promise<SendLazadaMessageResult> {
  const trimmedSessionId = sessionId?.trim();
  if (!trimmedSessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  const builtPayload = buildSendMessagePayload(trimmedSessionId, text, templateOptions);
  if (!builtPayload.ok) {
    return { success: false, error: builtPayload.error };
  }

  if (isLazadaImSimulateMode()) {
    appLogger.info('Simulating Lazada IM message send because LAZADA_IM_SIMULATE_SEND=true', {
      connectionId,
      sessionId: trimmedSessionId,
      templateId: templateOptions?.templateId ?? 1,
    });
    return {
      success: true,
      messageId: `sim-msg-${Date.now()}`,
      currentTime: Date.now(),
    };
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImSendMessageResponse>(
      '/im/message/send',
      builtPayload.payload,
    );

    if (!data?.message_id) {
      return {
        success: false,
        error: 'Lazada IM /im/message/send response did not include message_id',
      };
    }

    return {
      success: true,
      messageId: data.message_id,
      currentTime: data.current_time,
    };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error sending Lazada IM message');
    appLogger.error('Failed to send message via Lazada IM Open API', {
      connectionId,
      sessionId: trimmedSessionId,
      templateId: templateOptions?.templateId ?? 1,
      error: message,
    });

    return {
      success: false,
      error: message,
    };
  }
}

export async function markLazadaSessionRead(
  connectionId: number,
  sessionId: string,
  lastReadMessageId: string,
): Promise<MarkLazadaSessionReadResult> {
  const trimmedSessionId = sessionId?.trim();
  if (!trimmedSessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  const trimmedLastReadMessageId = lastReadMessageId?.trim();
  if (!trimmedLastReadMessageId) {
    return { success: false, error: 'lastReadMessageId is required' };
  }

  if (isLazadaImSimulateMode()) {
    appLogger.info('Simulating Lazada IM mark-read because LAZADA_IM_SIMULATE_SEND=true', {
      connectionId,
      sessionId: trimmedSessionId,
      lastReadMessageId: trimmedLastReadMessageId,
    });
    return { success: true };
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    await client.post<unknown>('/im/session/read', {
      session_id: trimmedSessionId,
      last_read_message_id: trimmedLastReadMessageId,
    });

    return { success: true };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error marking Lazada IM session read');
    appLogger.warn('Unable to mark Lazada session as read on Open API', {
      connectionId,
      sessionId: trimmedSessionId,
      lastReadMessageId: trimmedLastReadMessageId,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function getLazadaImSession(
  connectionId: number,
  sessionId: string,
): Promise<LazadaImServiceResult<LazadaImSessionDetailDTO>> {
  const trimmedSessionId = sessionId?.trim();
  if (!trimmedSessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImSessionDetailDTO>('/im/session/get', {
      session_id: trimmedSessionId,
    });

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: 'Lazada IM /im/session/get returned an empty session payload',
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error fetching Lazada IM session');
    appLogger.warn('Failed to get Lazada IM session', {
      connectionId,
      sessionId: trimmedSessionId,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function listLazadaImSessions(
  connectionId: number,
  options: ListLazadaImSessionsOptions = {},
): Promise<LazadaImServiceResult<LazadaImSessionListResponse>> {
  const pageSizeCheck = validatePageSize(options.pageSize);
  if (!pageSizeCheck.ok) {
    return { success: false, error: pageSizeCheck.error };
  }

  if (options.startTime !== undefined && (!Number.isFinite(options.startTime) || options.startTime < 0)) {
    return { success: false, error: 'startTime must be a non-negative finite number' };
  }

  const params: Record<string, unknown> = {
    page_size: pageSizeCheck.value,
  };
  if (options.startTime !== undefined) {
    params.start_time = options.startTime;
  }
  const trimmedLastSessionId = options.lastSessionId?.trim();
  if (trimmedLastSessionId) {
    params.last_session_id = trimmedLastSessionId;
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImSessionListResponse>('/im/session/list', params);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: 'Lazada IM /im/session/list returned an empty payload',
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error listing Lazada IM sessions');
    appLogger.warn('Failed to list Lazada IM sessions', {
      connectionId,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function listLazadaImMessages(
  connectionId: number,
  options: ListLazadaImMessagesOptions,
): Promise<LazadaImServiceResult<LazadaImMessageListResponse>> {
  const trimmedSessionId = options?.sessionId?.trim();
  if (!trimmedSessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  const pageSizeCheck = validatePageSize(options.pageSize);
  if (!pageSizeCheck.ok) {
    return { success: false, error: pageSizeCheck.error };
  }

  if (options.startTime !== undefined && (!Number.isFinite(options.startTime) || options.startTime < 0)) {
    return { success: false, error: 'startTime must be a non-negative finite number' };
  }

  const params: Record<string, unknown> = {
    session_id: trimmedSessionId,
    page_size: pageSizeCheck.value,
  };
  if (options.startTime !== undefined) {
    params.start_time = options.startTime;
  }
  const trimmedLastMessageId = options.lastMessageId?.trim();
  if (trimmedLastMessageId) {
    params.last_message_id = trimmedLastMessageId;
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImMessageListResponse>('/im/message/list', params);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {
        success: false,
        error: 'Lazada IM /im/message/list returned an empty payload',
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error listing Lazada IM messages');
    appLogger.warn('Failed to list Lazada IM messages', {
      connectionId,
      sessionId: trimmedSessionId,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function openLazadaImSession(
  connectionId: number,
  orderId: string | number,
): Promise<LazadaImServiceResult<LazadaImSessionOpenResponse>> {
  if (typeof orderId === 'number' && (!Number.isFinite(orderId) || orderId <= 0)) {
    return { success: false, error: 'orderId must be a positive finite number' };
  }

  const normalizedOrderId =
    orderId !== undefined && orderId !== null ? String(orderId).trim() : '';
  if (!normalizedOrderId) {
    return { success: false, error: 'orderId is required' };
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImSessionOpenResponse>('/im/session/open', {
      order_id: normalizedOrderId,
    });

    if (!data?.session_id) {
      return {
        success: false,
        error: 'Lazada IM /im/session/open response did not include session_id',
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error opening Lazada IM session');
    appLogger.warn('Failed to open Lazada IM session', {
      connectionId,
      orderId: normalizedOrderId,
      error: message,
    });
    return { success: false, error: message };
  }
}

export async function recallLazadaImMessage(
  connectionId: number,
  sessionId: string,
  messageId: string,
): Promise<LazadaImServiceResult<LazadaImMessageRecallResponse>> {
  const trimmedSessionId = sessionId?.trim();
  if (!trimmedSessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  const trimmedMessageId = messageId?.trim();
  if (!trimmedMessageId) {
    return { success: false, error: 'messageId is required' };
  }

  try {
    const client = await createLazadaChatClient(connectionId);
    const data = await client.post<LazadaImMessageRecallResponse>('/im/message/recall', {
      session_id: trimmedSessionId,
      message_id: trimmedMessageId,
    });

    if (data?.result === false || data?.success === false) {
      return {
        success: false,
        error: 'Lazada IM /im/message/recall returned an unsuccessful result',
      };
    }

    return { success: true, data: data ?? { success: true } };
  } catch (error) {
    const message = formatLazadaImError(error, 'Unknown error recalling Lazada IM message');
    appLogger.warn('Failed to recall Lazada IM message', {
      connectionId,
      sessionId: trimmedSessionId,
      messageId: trimmedMessageId,
      error: message,
    });
    return { success: false, error: message };
  }
}

/**
 * Evaluates Lazada IM session validity per Section 3 rules:
 * valid if buyer replied within 5 days, or fallback eligible if customer placed an order within 7 days.
 */
export function evaluateLazadaSessionValidity(
  input: EvaluateLazadaSessionValidityInput,
): LazadaSessionValidityResult {
  const nowMs = resolveNowMs(input.now);
  const buyerMs = toEpochMs(input.lastBuyerMessageTime);
  const orderMs = toEpochMs(input.latestOrderTime);

  if (buyerMs !== null) {
    const elapsedSinceBuyer = nowMs - buyerMs;
    if (elapsedSinceBuyer <= LAZADA_FIVE_DAYS_MS) {
      const remainingBuyerWindowMs = Math.max(
        0,
        LAZADA_FIVE_DAYS_MS - Math.max(0, elapsedSinceBuyer),
      );
      return {
        isValid: true,
        reason: 'active_buyer_window',
        requiresSessionOpen: false,
        remainingBuyerWindowMs,
      };
    }
  }

  if (orderMs !== null && nowMs - orderMs <= LAZADA_SEVEN_DAYS_MS) {
    return {
      isValid: true,
      reason: 'recent_order_7d_window',
      requiresSessionOpen: true,
      remainingBuyerWindowMs: 0,
    };
  }

  return {
    isValid: false,
    reason: 'expired',
    requiresSessionOpen: false,
    remainingBuyerWindowMs: 0,
  };
}

/**
 * Evaluates Lazada IM anti-spam quota per Section 3.3 rules:
 * blocks outbound sends when buyer has not replied within 24 hours and consecutive seller replies >= 5.
 */
export function evaluateLazadaAntiSpamQuota(
  input: EvaluateLazadaAntiSpamQuotaInput,
): LazadaAntiSpamQuotaResult {
  const nowMs = resolveNowMs(input.now);
  const buyerMs = toEpochMs(input.lastBuyerMessageTime);
  const rawCount = input.consecutiveSellerRepliesSinceLastBuyer;
  const consecutiveCount = Number.isFinite(rawCount)
    ? Math.max(0, Math.floor(rawCount))
    : 0;

  const withinBuyer24hWindow =
    buyerMs !== null && nowMs - buyerMs <= LAZADA_TWENTY_FOUR_HOURS_MS;

  if (withinBuyer24hWindow) {
    return {
      allowed: true,
      withinBuyer24hWindow: true,
      consecutiveCount,
      remainingQuota: null,
    };
  }

  const remainingQuota = Math.max(0, LAZADA_ANTI_SPAM_MAX_REPLIES - consecutiveCount);
  return {
    allowed: consecutiveCount < LAZADA_ANTI_SPAM_MAX_REPLIES,
    withinBuyer24hWindow: false,
    consecutiveCount,
    remainingQuota,
  };
}
