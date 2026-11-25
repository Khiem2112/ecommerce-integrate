import type { ChatWebhookEventJobData } from '@/lib/queue';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

export type ParsedLazadaWebhookEvent = {
  readonly sessionId: string;
  readonly messageId?: string;
  readonly externalShopId?: string;
  readonly eventType: 'push_message' | 'push_session_update';
  readonly payload: LazadaPushMessagePayload | LazadaPushSessionUpdatePayload;
};

/**
 * Extracts seller shop ID strictly from seller-side fields or the canonical Lazada session_id
 * format ({seller_id}_2_{buyer_id}_1_{app_id}), avoiding bare buyer-account fallbacks.
 */
export function extractLazadaSellerShopId(
  body: Record<string, unknown>,
  sessionId: string,
): string | undefined {
  if (
    body.seller_id !== undefined &&
    body.seller_id !== null &&
    String(body.seller_id) !== ''
  ) {
    return String(body.seller_id);
  }

  const eventData = (
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body
  ) as Record<string, unknown>;

  if (
    eventData.seller_id !== undefined &&
    eventData.seller_id !== null &&
    String(eventData.seller_id) !== ''
  ) {
    return String(eventData.seller_id);
  }
  if (Number(eventData.from_account_type) === 2 && eventData.from_account_id) {
    return String(eventData.from_account_id);
  }
  if (Number(eventData.to_account_type) === 2 && eventData.to_account_id) {
    return String(eventData.to_account_id);
  }
  if (Number(eventData.user_account_type) === 2 && eventData.user_account_id) {
    return String(eventData.user_account_id);
  }
  if (sessionId && sessionId.includes('_')) {
    return sessionId.split('_')[0] || undefined;
  }

  return undefined;
}

/**
 * Normalizes a raw Lazada webhook JSON body into a structured event classification
 * for downstream BullMQ enqueueing. Returns null when session_id is missing (probe ping).
 */
export function parseLazadaWebhookBody(
  body: Record<string, unknown>,
): ParsedLazadaWebhookEvent | null {
  const eventData = (
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body
  ) as Record<string, unknown>;

  const rawSessionId = eventData.session_id ?? body.session_id;
  const sessionId = rawSessionId ? String(rawSessionId).trim() : '';
  if (!sessionId) {
    return null;
  }

  const rawMessageId = eventData.message_id ?? body.message_id;
  const messageId = rawMessageId ? String(rawMessageId).trim() || undefined : undefined;
  const externalShopId = extractLazadaSellerShopId(body, sessionId);
  const isMessageEvent = Boolean(
    messageId && (eventData.content !== undefined || body.content !== undefined),
  );
  const eventType: ChatWebhookEventJobData['eventType'] = isMessageEvent
    ? 'push_message'
    : 'push_session_update';
  const eventPayload = eventData.session_id ? eventData : body;

  return {
    sessionId,
    messageId,
    externalShopId,
    eventType,
    payload: isMessageEvent
      ? (eventPayload as unknown as LazadaPushMessagePayload)
      : (eventPayload as unknown as LazadaPushSessionUpdatePayload),
  };
}
