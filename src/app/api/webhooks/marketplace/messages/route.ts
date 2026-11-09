import { NextRequest, NextResponse } from 'next/server';
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

function verifySignatureIfConfigured(
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const appSecret = process.env.LAZADA_APP_SECRET;
  if (!appSecret) {
    return true;
  }

  const sign = searchParams.get('sign');
  if (!sign) {
    return false;
  }

  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const calculated = calculateLazadaSignature(pathname, params, appSecret);
  return calculated.toUpperCase() === sign.toUpperCase();
}

function extractSellerShopId(
  body: Record<string, unknown>,
  sessionId: string,
): string | undefined {
  if (body.from_account_type === 2 && body.from_account_id) {
    return String(body.from_account_id);
  }
  if (body.to_account_id) {
    return String(body.to_account_id);
  }
  if (body.user_account_id && body.user_account_type === 2) {
    return String(body.user_account_id);
  }
  if (sessionId && sessionId.includes('_')) {
    const parts = sessionId.split('_');
    if (parts[0]) {
      return parts[0];
    }
  }
  return undefined;
}

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  const startTime = Date.now();
  const url = new URL(request.url);

  const isSignatureValid = verifySignatureIfConfigured(url.pathname, url.searchParams);
  if (!isSignatureValid) {
    appLogger.warn('Marketplace webhook rejected due to invalid signature', {
      path: url.pathname,
    });
    return NextResponse.json(
      { success: false, message: 'Invalid webhook signature' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
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

  const sessionId = String(body.session_id ?? '');
  const messageId = body.message_id ? String(body.message_id) : undefined;

  if (!sessionId) {
    appLogger.warn('Marketplace webhook received without session_id', { body });
    return NextResponse.json(
      { success: false, message: 'Missing session_id in payload' },
      { status: 400 },
    );
  }

  const externalShopId = extractSellerShopId(body, sessionId);
  const isMessageEvent = Boolean(messageId && body.content !== undefined);
  const eventType = isMessageEvent ? 'push_message' : 'push_session_update';

  const jobData: ChatWebhookJobData = {
    eventType,
    connectionId,
    externalShopId,
    platform: 'lazada',
    payload: isMessageEvent
      ? (body as unknown as LazadaPushMessagePayload)
      : (body as unknown as LazadaPushSessionUpdatePayload),
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
