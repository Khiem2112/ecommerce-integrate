import crypto from 'node:crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-southeast-1',
});

const SQS_MAX_IDENTIFIER_LENGTH = 128;

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

function shouldSkipWebhookSignatureVerify() {
  return process.env.LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY === 'true';
}

function timingSafeHexEqual(expectedHex, providedHex) {
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

function timingSafeSignatureEqual(expected, provided) {
  const normalizedExpected = expected.trim().replace(/[a-f]/g, (char) => char.toUpperCase());
  const normalizedProvided = provided.trim().replace(/[a-f]/g, (char) => char.toUpperCase());

  const expectedBuffer = Buffer.from(normalizedExpected, 'utf8');
  const providedBuffer = Buffer.from(normalizedProvided, 'utf8');

  if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function calculateLazadaSignature(apiPath, params, appSecret) {
  const sortedKeys = Object.keys(params)
    .filter((key) => key !== 'sign')
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

function getHeaderCaseInsensitive(headers, headerName) {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const target = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function parseQueryParams(event) {
  const params = {};
  if (event.queryStringParameters && typeof event.queryStringParameters === 'object') {
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (typeof value === 'string') {
        params[key] = value;
      }
    }
    return params;
  }

  if (typeof event.rawQueryString === 'string' && event.rawQueryString.length > 0) {
    const searchParams = new URLSearchParams(event.rawQueryString);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return params;
}

function verifyLazadaWebhookSignature(event, rawText) {
  const appKey = process.env.LAZADA_CHAT_APP_KEY || process.env.LAZADA_APP_KEY;
  const appSecret = process.env.LAZADA_CHAT_APP_SECRET || process.env.LAZADA_APP_SECRET;

  const authHeader =
    getHeaderCaseInsensitive(event.headers, 'authorization') ||
    getHeaderCaseInsensitive(event.headers, 'x-lazada-signature');

  const queryParams = parseQueryParams(event);
  const sign = queryParams.sign;

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
      const requestPath =
        process.env.LAZADA_WEBHOOK_SIGN_PATH?.trim() ||
        event.rawPath ||
        event.requestContext?.http?.path ||
        '/api/webhooks/marketplace/messages';

      const calculated = calculateLazadaSignature(requestPath, queryParams, appSecret);
      if (timingSafeSignatureEqual(calculated, sign)) {
        return true;
      }
    }
  }

  if (shouldSkipWebhookSignatureVerify()) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'Skipping Lazada webhook signature verification via LAZADA_WEBHOOK_SKIP_SIGNATURE_VERIFY',
        path: event.rawPath,
        hasAppSecret: Boolean(appSecret),
        hasAppKey: Boolean(appKey),
        hasAuthHeader: Boolean(authHeader),
        hasQuerySign: Boolean(sign),
      }),
    );
    return true;
  }

  return false;
}

function extractSellerShopId(body, sessionId) {
  if (
    body.seller_id !== undefined &&
    body.seller_id !== null &&
    String(body.seller_id) !== ''
  ) {
    return String(body.seller_id);
  }

  const eventData =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body;

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

function decodeRawBody(event) {
  if (!event.body) {
    return '';
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
}

function toSqsFifoIdentifier(rawIdentifier) {
  const trimmed = String(rawIdentifier).trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= SQS_MAX_IDENTIFIER_LENGTH &&
    /^[\x21-\x7e]+$/.test(trimmed)
  ) {
    return trimmed;
  }

  return crypto.createHash('sha256').update(trimmed, 'utf8').digest('hex');
}

function buildSqsDeduplicationId(messageId, eventPayload, rawText) {
  if (messageId) {
    // Distinguish recall updates (status === 1) from initial delivery inside SQS 5-minute deduplication window
    const isRecall = Number(eventPayload.status) === 1;
    const candidate = isRecall ? `${messageId}_recall` : messageId;
    return toSqsFifoIdentifier(candidate);
  }

  return crypto.createHash('sha256').update(rawText, 'utf8').digest('hex');
}

export async function handler(event) {
  const startTime = Date.now();
  const method = (event.requestContext?.http?.method || event.httpMethod || 'POST').toUpperCase();

  if (method === 'GET') {
    return jsonResponse(200, {
      success: true,
      message: 'Lazada marketplace webhook endpoint active',
    });
  }

  const rawText = decodeRawBody(event);

  // Verify webhook signature before parsing or handling probe payloads
  if (!verifyLazadaWebhookSignature(event, rawText)) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        message: 'Marketplace webhook rejected due to invalid signature',
        path: event.rawPath,
      }),
    );
    return jsonResponse(401, {
      success: false,
      message: 'Invalid webhook signature',
    });
  }

  let body = {};
  try {
    if (rawText && rawText.trim().length > 0) {
      const parsed = JSON.parse(rawText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return jsonResponse(400, {
          success: false,
          message: 'Invalid JSON payload',
        });
      }
      body = parsed;
    }
  } catch (error) {
    console.error('Failed to parse webhook JSON payload:', error);
    return jsonResponse(400, {
      success: false,
      message: 'Invalid JSON payload',
    });
  }

  const eventData =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data
      : body;

  const rawSessionId = eventData.session_id ?? body.session_id;
  const sessionId = rawSessionId ? String(rawSessionId).trim() : '';
  const rawMessageId = eventData.message_id ?? body.message_id;
  const messageId = rawMessageId ? String(rawMessageId).trim() : undefined;

  // Handle authenticated Lazada console probe or verification ping without session_id
  if (!sessionId) {
    console.info(
      JSON.stringify({
        level: 'info',
        message: 'Lazada webhook probe or verification ping received',
      }),
    );
    return jsonResponse(200, {
      success: true,
      message: 'Webhook endpoint verified',
    });
  }

  const queueUrl = process.env.SQS_QUEUE_URL;
  if (!queueUrl) {
    console.error('SQS_QUEUE_URL environment variable is not configured');
    return jsonResponse(500, {
      success: false,
      message: 'Webhook buffer queue is not configured',
    });
  }

  const externalShopId = extractSellerShopId(body, sessionId);
  const isMessageEvent = Boolean(
    messageId && (eventData.content !== undefined || body.content !== undefined),
  );
  const eventType = isMessageEvent ? 'push_message' : 'push_session_update';
  const eventPayload = eventData.session_id ? eventData : body;

  const envelope = {
    source: 'aws-lazada-webhook',
    platform: 'lazada',
    eventType,
    externalShopId,
    sessionId,
    messageId,
    payload: eventPayload,
    receivedAt: startTime,
  };

  const messageGroupId = toSqsFifoIdentifier(sessionId);
  const messageDeduplicationId = buildSqsDeduplicationId(
    messageId,
    eventPayload,
    rawText,
  );

  try {
    const result = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(envelope),
        MessageGroupId: messageGroupId,
        MessageDeduplicationId: messageDeduplicationId,
      }),
    );

    console.info(
      JSON.stringify({
        level: 'info',
        message: 'Buffered Lazada webhook event to SQS FIFO',
        sqsMessageId: result.MessageId,
        sessionId,
        messageId,
        eventType,
        latencyMs: Date.now() - startTime,
      }),
    );

    return jsonResponse(200, {
      success: true,
      sqsMessageId: result.MessageId,
    });
  } catch (error) {
    console.error('Failed to push Lazada webhook payload to SQS FIFO:', error);
    return jsonResponse(500, {
      success: false,
      message: 'Internal buffer queue failure',
    });
  }
}
