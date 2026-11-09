import { prisma } from '@/lib/prisma';
import { appLogger } from '@/lib/logger';
import { LazadaClient } from './lazadaClient';

type SendLazadaMessageResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

type MarkLazadaSessionReadResult = {
  success: boolean;
  error?: string;
};

type LazadaImApiResponse = {
  code?: string;
  message?: string;
  success?: boolean;
  data?: {
    message_id?: string;
  };
};

export async function sendLazadaImMessage(
  connectionId: number,
  sessionId: string,
  text: string,
): Promise<SendLazadaMessageResult> {
  try {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { integrations: true, externalShopId: true },
    });

    const integrations = connection?.integrations as { access_token?: string } | null;
    const accessToken = integrations?.access_token || process.env.LAZADA_ACCESS_TOKEN;

    if (!accessToken && process.env.NODE_ENV !== 'production') {
      appLogger.info('Simulating Lazada IM message send in offline or dev mode', {
        connectionId,
        sessionId,
      });
      return {
        success: true,
        messageId: `sim-msg-${Date.now()}`,
      };
    }

    const client = new LazadaClient({
      accessToken,
      timeoutMs: 8000,
      maxRetries: 1,
    });

    const response = await client.post<LazadaImApiResponse>('/im/message/send', {
      session_id: sessionId,
      template_id: 1,
      txt: text,
    });

    if (response.code === '0' || response.success) {
      return {
        success: true,
        messageId: response.data?.message_id || `lz-msg-${Date.now()}`,
      };
    }

    return {
      success: false,
      error: response.message || 'Lazada API rejected message send',
    };
  } catch (error) {
    appLogger.warn('Error sending message via Lazada IM Open API, falling back to simulated send', {
      connectionId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        messageId: `sim-fallback-${Date.now()}`,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error sending IM message',
    };
  }
}

export async function markLazadaSessionRead(
  connectionId: number,
  sessionId: string,
): Promise<MarkLazadaSessionReadResult> {
  try {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: { integrations: true },
    });

    const integrations = connection?.integrations as { access_token?: string } | null;
    const accessToken = integrations?.access_token || process.env.LAZADA_ACCESS_TOKEN;

    if (!accessToken && process.env.NODE_ENV !== 'production') {
      return { success: true };
    }

    const client = new LazadaClient({
      accessToken,
      timeoutMs: 5000,
      maxRetries: 1,
    });

    await client.post('/im/session/read', {
      session_id: sessionId,
    });

    return { success: true };
  } catch (error) {
    appLogger.warn('Unable to mark Lazada session as read on Open API', {
      connectionId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
