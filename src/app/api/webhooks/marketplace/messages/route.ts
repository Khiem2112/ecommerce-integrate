import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { addChatMessageJob, type ChatWebhookJobData } from '@/lib/queue';
import { appLogger } from '@/lib/logger';
import { calculateLazadaSignature } from '@/services/connectors/lazada/lazadaSigner';
import { parseLazadaWebhookBody } from '@/utils';

type WebhookResponse = {
  success: boolean;
  message?: string;
  jobId?: string;
};

function shouldSkipWebhookSignatureVerify(): boolean {
  return process.env.LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true';
}

function isDirectLazadaWebhookRouteEnabled(): boolean {
  return (
    process.env.ENABLE_DIRECT_LAZADA_WEBHOOK_ROUTE?.trim().toLowerCase() !==
    'false'
  );
}

function createDirectIngressDisabledResponse(): NextResponse<WebhookResponse> {
  return NextResponse.json(
    {
      success: false,
      message:
        'Direct Lazada webhook route is disabled; webhooks must arrive via the AWS SQS ingress gateway',
    },
    { status: 410 },
  );
}

function timingSafeHexEqual(expectedHex: string, providedHex: string): boolean {
  const normalizedExpected = expectedHex.trim().toLowerCase();
  const normalizedProvided = providedHex.trim().toLowerCase();

  if (
    normalizedExpected.length === 0 ||
    normalizedExpected.length !== normalizedProvided.length ||
    normalizedExpected.length % 2 !== 0 ||
    !/^[0-9a-f]+$/.test(normalizedExpected) ||
    !/^[0-9a-f]+$/.test(normalizedProvided)
  ) {
    return false;
  }

  const expectedBuffer = Buffer.from(normalizedExpected, 'hex');
  const providedBuffer = Buffer.from(normalizedProvided, 'hex');

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function timingSafeSignatureEqual(expected: string, provided: string): boolean {
  const normalizedExpected = expected.trim().replace(/[a-f]/g, (char) => char.toUpperCase());
  const normalizedProvided = provided.trim().replace(/[a-f]/g, (char) => char.toUpperCase());

  const expectedBuffer = Buffer.from(normalizedExpected, 'utf8');
  const providedBuffer = Buffer.from(normalizedProvided, 'utf8');

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function verifyLazadaWebhookSignature(
  request: NextRequest,
  rawText: string,
): boolean {
  const appKey = process.env.LAZADA_CHAT_APP_KEY || process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_CHAT_APP_SECRET || process.env.LAZADA_APP_SECRET;

  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization') ||
    request.headers.get('x-lazada-signature');

  const searchParams = request.nextUrl.searchParams;
  const sign = searchParams.get('sign');

  if (appSecret) {
    // Check Authorization header for Lazada Push Mechanism HMAC-SHA256
    if (authHeader && appKey) {
      const baseString = appKey + rawText;
      const computed = crypto
        .createHmac('sha256', appSecret)
        .update(baseString, 'utf8')
        .digest('hex');

      if (timingSafeHexEqual(computed, authHeader)) {
        return true;
      }
    }

    // Fallback to query string signature for standard open platform calls
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
      if (timingSafeSignatureEqual(calculated, sign)) {
        return true;
      }
    }
  }

  if (shouldSkipWebhookSignatureVerify()) {
    appLogger.warn('Skipping Lazada webhook signature verification via LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY', {
      path: request.nextUrl.pathname,
      hasAppSecret: Boolean(appSecret),
      hasAppKey: Boolean(appKey),
      hasAuthHeader: Boolean(authHeader),
      hasQuerySign: Boolean(sign),
    });
    return true;
  }

  return false;
}

export async function GET(): Promise<NextResponse<WebhookResponse>> {
  if (!isDirectLazadaWebhookRouteEnabled()) {
    appLogger.warn('Rejected GET health probe on disabled direct Lazada webhook route');
    return createDirectIngressDisabledResponse();
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Lazada marketplace webhook endpoint active',
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse<WebhookResponse>> {
  if (!isDirectLazadaWebhookRouteEnabled()) {
    appLogger.warn('Rejected direct Lazada webhook POST because AWS SQS single-ingress guard is active', {
      path: request.nextUrl.pathname,
    });
    return createDirectIngressDisabledResponse();
  }

  const startTime = Date.now();
  const url = new URL(request.url);

  let rawText = '';
  try {
    rawText = await request.text();
  } catch (error) {
    appLogger.error('Failed to read webhook request body:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  // Verify webhook signature before parsing or handling probe payloads
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

  let body: Record<string, unknown> = {};
  try {
    if (rawText && rawText.trim().length > 0) {
      const parsed: unknown = JSON.parse(rawText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return NextResponse.json(
          { success: false, message: 'Invalid JSON payload' },
          { status: 400 },
        );
      }
      body = parsed as Record<string, unknown>;
    }
  } catch (error) {
    appLogger.error('Failed to parse webhook JSON payload:', error);
    return NextResponse.json(
      { success: false, message: 'Invalid JSON payload' },
      { status: 400 },
    );
  }

  // Only allow query-string connectionId override when signature verification skip is explicitly enabled
  const skipSignatureVerify = shouldSkipWebhookSignatureVerify();
  const requestedConnectionId = skipSignatureVerify
    ? url.searchParams.get('connectionId') || url.searchParams.get('connection_id')
    : null;
  const parsedConnectionId = requestedConnectionId ? Number(requestedConnectionId) : undefined;
  const connectionId =
    parsedConnectionId !== undefined &&
    Number.isInteger(parsedConnectionId) &&
    parsedConnectionId > 0
      ? parsedConnectionId
      : undefined;

  const parsedEvent = parseLazadaWebhookBody(body);

  // Handle authenticated Lazada console probe / verify ping without session_id
  if (!parsedEvent) {
    appLogger.info('Lazada webhook probe or verification ping received', {
      searchParams: Object.fromEntries(url.searchParams.entries()),
      body,
    });
    return NextResponse.json(
      { success: true, message: 'Webhook endpoint verified' },
      { status: 200 },
    );
  }

  const { sessionId, messageId, externalShopId, eventType, payload } = parsedEvent;

  const jobData: ChatWebhookJobData = {
    eventType,
    connectionId,
    externalShopId,
    platform: 'lazada',
    payload,
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
