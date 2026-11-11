import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { addChatMessageJob, type ChatWebhookJobData } from '@/lib/queue';
import { appLogger } from '@/lib/logger';
import { calculateLazadaSignature } from '@/services/connectors/lazada/lazadaSigner';
import type {
  LazadaPushMessagePayload,
  LazadaPushSessionUpdatePayload,
} from '@/types';

type WebhookResponse = {
  success: boolean;
  message?: string;
  jobId?: string;
};

function verifyLazadaWebhookSignature(
  request: NextRequest,
  rawText: string,
): boolean {
  const appSecret = process.env.LAZADA_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  // Check Authorization header for Lazada Push Mechanism HMAC-SHA256
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    request.headers.get('x-lazada-signature');

  const appKey = process.env.LAZADA_APP_KEY;

  if (authHeader && appKey) {
    const baseString = appKey + rawText;
    const computed = crypto
      .createHmac('sha256', appSecret)
      .update(baseString, 'utf8')
      .digest('hex');

    if (computed.toLowerCase() === authHeader.toLowerCase()) {
      return true;
    }
  }

  // Fallback to query string signature for standard open platform calls
  const searchParams = request.nextUrl.searchParams;
  const sign = searchParams.get('sign');
  if (sign) {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const calculated = calculateLazadaSignature(
      request.nextUrl.pathname,
      params,
      appSecret,
    );
    if (calculated.toUpperCase() === sign.toUpperCase()) {
      return true;
    }
  }

  // Permit webhook through in non-production environments to avoid blocking sandbox integration
  if (process.env.NODE_ENV !== 'production') {
    appLogger.info('Permitting webhook in development/sandbox mode despite signature mismatch', {
      hasAuthHeader: Boolean(authHeader),
      hasQuerySign: Boolean(sign),
    });
    return true;
  }

  return false;
}

function extractSellerShopId(
  body: Record<string, unknown>,
  sessionId: string,
): string | undefined {
  if (body.seller_id) {
    return String(body.seller_id);
  }
  const eventData = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
  if (eventData.seller_id) {
    return String(eventData.seller_id);
  }
  if (eventData.from_account_type === 2 && eventData.from_account_id) {
    return String(eventData.from_account_id);
  }
  if (eventData.to_account_id && eventData.to_account_type === 2) {
    return String(eventData.to_account_id);
  }
  if (eventData.to_account_id) {
    return String(eventData.to_account_id);
  }
  if (eventData.user_account_id && eventData.user_account_type === 2) {
    return String(eventData.user_account_id);
  }
  if (sessionId && sessionId.includes('_')) {
    const parts = sessionId.split('_');
    if (parts[0]) {
      return parts[0];
    }
  }
  return undefined;
}

export async function GET(): Promise<NextResponse<WebhookResponse>> {
  return NextResponse.json(
    {
      success: true,
      message: 'Lazada marketplace webhook endpoint active',
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  const startTime = Date.now();
  const url = new URL(request.url);

  let body: Record<string, unknown> = {};
  let rawText = '';
  try {
    rawText = await request.text();
    if (rawText && rawText.trim().length > 0) {
      body = JSON.parse(rawText) as Record<string, unknown>;
    }
  } catch (error) {
    appLogger.error('Failed to parse webhook JSON payload:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  const requestedConnectionId = url.searchParams.get('connectionId') || url.searchParams.get('connection_id');
  const parsedConnectionId = requestedConnectionId ? Number(requestedConnectionId) : undefined;
  const connectionId = parsedConnectionId && !Number.isNaN(parsedConnectionId) ? parsedConnectionId : undefined;

  const eventData = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
  const rawSessionId = eventData.session_id ?? body.session_id;
  const sessionId = rawSessionId ? String(rawSessionId) : '';
  const messageId = eventData.message_id ? String(eventData.message_id) : (body.message_id ? String(body.message_id) : undefined);

  // Handle Lazada console probe / verify ping without session_id
  if (!sessionId) {
    appLogger.info('Lazada webhook probe or verification ping received', {
      searchParams: Object.fromEntries(url.searchParams.entries()),
      body,
    });
    return NextResponse.json(
      { success: true, message: 'Webhook endpoint verified' },
      { status: 200 },
    );
  }

  const isSignatureValid = verifyLazadaWebhookSignature(request, rawText);
  if (!isSignatureValid) {
    appLogger.warn('Marketplace webhook rejected due to invalid signature', {
      path: url.pathname,
    });
    return NextResponse.json(
      { success: false, message: 'Invalid webhook signature' },
      { status: 401 },
    );
  }

  const externalShopId = extractSellerShopId(body, sessionId);
  const isMessageEvent = Boolean(messageId && (eventData.content !== undefined || body.content !== undefined));
  const eventType = isMessageEvent ? 'push_message' : 'push_session_update';
  const eventPayload = eventData.session_id ? eventData : body;

  const jobData: ChatWebhookJobData = {
    eventType,
    connectionId,
    externalShopId,
    platform: 'lazada',
    payload: isMessageEvent
      ? (eventPayload as unknown as LazadaPushMessagePayload)
      : (eventPayload as unknown as LazadaPushSessionUpdatePayload),
    receivedAt: startTime,
  };

  try {
    const jobId = await addChatMessageJob(jobData, sessionId, messageId);

    const latencyMs = Date.now() - startTime;
    appLogger.info('Fast ACK webhook message queued successfully', {
      jobId,
      sessionId,
      messageId,
      latencyMs,
    });

    return NextResponse.json(
      {
        success: true,
        jobId,
      },
      { status: 200 },
    );
  } catch (error) {
    appLogger.error('Failed to enqueue marketplace chat webhook job:', error);
    return NextResponse.json(
      { success: false, message: 'Internal queue failure' },
      { status: 500 },
    );
  }
}
