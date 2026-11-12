import { redis, redisSubscriber } from '@/lib/redis';
import { appLogger } from '@/lib/logger';
import type { ChatStreamEvent } from '@/types';

type ClientListener = (event: ChatStreamEvent) => void;

type ListenerRegistration = {
  id: string;
  orgId: number;
  callback: ClientListener;
};

const ORG_CHAT_CHANNEL_PATTERN = 'org:*:chat';

class ChatBroadcasterManager {
  private listeners: Map<string, ListenerRegistration>;
  private isSubscribed: boolean;
  private subscriptionPromise: Promise<void> | null = null;

  constructor() {
    this.listeners = new Map();
    this.isSubscribed = false;
  }

  private async ensureRedisSubscriptions(): Promise<void> {
    if (this.isSubscribed) {
      return;
    }
    if (this.subscriptionPromise) {
      return this.subscriptionPromise;
    }

    this.subscriptionPromise = (async () => {
      try {
        await redisSubscriber.psubscribe(ORG_CHAT_CHANNEL_PATTERN);

        redisSubscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
          const orgIdMatch = channel.match(/^org:(\d+):chat$/);
          const orgId = orgIdMatch ? parseInt(orgIdMatch[1], 10) : undefined;
          this.handleIncomingRawMessage(message, orgId);
        });

        this.isSubscribed = true;
        appLogger.info('ChatBroadcaster subscribed to Redis chat channels');
      } catch (error) {
        appLogger.warn('Unable to subscribe to Redis chat channels, falling back to local bus', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.subscriptionPromise = null;
      }
    })();

    return this.subscriptionPromise;
  }

  private handleIncomingRawMessage(rawMessage: string, targetOrgId?: number): void {
    try {
      const parsedEvent = JSON.parse(rawMessage) as ChatStreamEvent;
      this.dispatchToListeners(parsedEvent, targetOrgId);
    } catch (parseError) {
      appLogger.warn('Failed to parse incoming Redis chat event message', {
        rawMessage,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }
  }

  private dispatchToListeners(event: ChatStreamEvent, eventOrgId?: number): void {
    if (eventOrgId === undefined || !Number.isInteger(eventOrgId) || eventOrgId <= 0) {
      return;
    }

    for (const registration of this.listeners.values()) {
      if (registration.orgId === undefined || registration.orgId !== eventOrgId) {
        continue;
      }

      try {
        registration.callback(event);
      } catch (listenerError) {
        appLogger.error('Error invoking chat event stream listener callback', {
          listenerId: registration.id,
          error: listenerError instanceof Error ? listenerError.message : String(listenerError),
        });
      }
    }
  }

  public async publishChatEvent(
    event: ChatStreamEvent,
    orgId?: number,
  ): Promise<void> {
    if (orgId === undefined || !Number.isInteger(orgId) || orgId <= 0) {
      appLogger.warn('Rejected unscoped chat event publish without valid organizationId', {
        eventType: event.type,
        orgId,
      });
      return;
    }

    const serializedPayload = JSON.stringify(event);
    let publishedToRedis = false;

    try {
      const targetChannel = `org:${orgId}:chat`;
      const count = await redis.publish(targetChannel, serializedPayload);
      publishedToRedis = typeof count === 'number';
    } catch (redisError) {
      appLogger.warn('Failed to publish chat event to Redis, fallback to local dispatch', {
        eventType: event.type,
        error: redisError instanceof Error ? redisError.message : String(redisError),
      });
    }

    if (!publishedToRedis || process.env.NODE_ENV === 'test') {
      this.dispatchToListeners(event, orgId);
    }
  }

  public subscribeClient(
    callback: ClientListener,
    orgId?: number,
  ): () => void {
    if (orgId === undefined || !Number.isInteger(orgId) || orgId <= 0) {
      appLogger.warn('Rejected chat stream client subscription without valid organizationId', {
        orgId,
      });
      return (): void => {};
    }

    const listenerId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.listeners.set(listenerId, {
      id: listenerId,
      orgId,
      callback,
    });

    void this.ensureRedisSubscriptions();

    return () => {
      this.listeners.delete(listenerId);
    };
  }

  public getActiveListenerCount(): number {
    return this.listeners.size;
  }
}

const globalForBroadcaster = globalThis as unknown as {
  chatBroadcasterInstance?: ChatBroadcasterManager;
};

export const chatBroadcaster =
  globalForBroadcaster.chatBroadcasterInstance ?? new ChatBroadcasterManager();

if (process.env.NODE_ENV !== 'production') {
  globalForBroadcaster.chatBroadcasterInstance = chatBroadcaster;
}

export function formatSsePayload(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function formatSsePing(): string {
  const pingEvent: ChatStreamEvent = {
    type: 'ping',
    timestamp: new Date().toISOString(),
  };
  return formatSsePayload('ping', pingEvent);
}
