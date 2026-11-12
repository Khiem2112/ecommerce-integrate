import { NextRequest, NextResponse } from 'next/server';
import {
  chatBroadcaster,
  formatSsePayload,
  formatSsePing,
} from '@/services/chatBroadcaster';
import { getAuthenticatedSessionContextService } from '@/services/authentication/authSessionService';
import { appLogger } from '@/lib/logger';
import type { ChatStreamEvent } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_INTERVAL_MS = 15000;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await getAuthenticatedSessionContextService();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orgId = session.activeOrganization?.organizationId;
  if (orgId == null) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encoder = new TextEncoder();

  let heartbeatTimer: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;
  let isClosed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (payloadText: string): void => {
        if (isClosed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(payloadText));
        } catch (enqueueError) {
          appLogger.warn('Failed to enqueue data to SSE stream, connection may be terminated', {
            error: enqueueError instanceof Error ? enqueueError.message : String(enqueueError),
          });
          cleanup();
        }
      };

      const cleanup = (): void => {
        if (isClosed) {
          return;
        }
        isClosed = true;

        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        try {
          controller.close();
        } catch {
          // Stream already closed or errored
        }

        appLogger.info('SSE client stream connection closed', { orgId });
      };

      safeEnqueue(
        formatSsePayload('connected', {
          status: 'connected',
          timestamp: new Date().toISOString(),
          orgId,
        }),
      );

      heartbeatTimer = setInterval(() => {
        safeEnqueue(formatSsePing());
      }, HEARTBEAT_INTERVAL_MS);

      unsubscribe = chatBroadcaster.subscribeClient((event: ChatStreamEvent) => {
        safeEnqueue(formatSsePayload(event.type, event));
      }, orgId);

      request.signal.addEventListener('abort', () => {
        cleanup();
      });
    },

    cancel() {
      if (!isClosed) {
        isClosed = true;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

