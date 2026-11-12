'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { computeMonotonicLastMessageTime } from '@/utils';
import type {
  ConversationDetail,
  ConversationSummary,
  WorkspaceMessage,
  ChatStreamEvent,
} from '@/types';

type UseAgentSessionOptions = {
  readonly orgId?: number;
  readonly activeConversationId?: number | null;
  readonly enabled?: boolean;
  readonly onEvent?: (event: ChatStreamEvent) => void;
};

type UseAgentSessionReturn = {
  readonly isConnected: boolean;
  readonly isReconnecting: boolean;
  readonly error: Error | null;
  readonly reconnectCount: number;
  readonly lastEvent: ChatStreamEvent | null;
};

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

function formatIsoTimestamp(inputDate: Date | string): string {
  if (typeof inputDate === 'string') {
    return inputDate;
  }
  return inputDate.toISOString();
}

function resolveMonotonicIsoTimestamp(
  incomingIso: string,
  existingIso: string | null | undefined,
): string {
  const incomingDate = new Date(incomingIso);
  if (Number.isNaN(incomingDate.getTime())) {
    return existingIso ?? incomingIso;
  }
  const existingDate = existingIso ? new Date(existingIso) : null;
  const monotonic = computeMonotonicLastMessageTime(
    incomingDate,
    existingDate && !Number.isNaN(existingDate.getTime()) ? existingDate : null,
  );
  return monotonic ? monotonic.toISOString() : incomingIso;
}

type StreamCacheClient = Pick<
  QueryClient,
  'setQueryData' | 'setQueriesData' | 'getQueriesData' | 'invalidateQueries'
>;

export type ApplyChatStreamEventParams = {
  readonly event: ChatStreamEvent;
  readonly queryClient: StreamCacheClient;
  readonly activeConversationId?: number | null;
  readonly translate: (key: string) => string;
};

export function applyChatStreamEventToQueryCache({
  event,
  queryClient,
  activeConversationId,
  translate,
}: ApplyChatStreamEventParams): void {
  const activeConversationIdRef = { current: activeConversationId };
  const tRef = { current: translate };

  switch (event.type) {
        case 'chat:message_received': {
          const formattedTime = formatIsoTimestamp(event.timestamp);
          const isCustomer =
            event.senderCode === 'customer' || event.senderCode === 'buyer';
          const isSellerOperator = event.senderCode === 'seller';
          const isBot =
            event.senderCode === 'agent' ||
            event.senderCode === 'bot' ||
            event.senderCode.startsWith('agent_');
          const senderName = isCustomer
            ? tRef.current('sender.customer')
            : isSellerOperator
              ? tRef.current('sender.sellerOperator')
              : isBot
                ? tRef.current('sender.aiAssistant')
                : tRef.current('sender.system');

          const incomingMessage: WorkspaceMessage = {
            id: event.messageId,
            senderCode: event.senderCode,
            senderName,
            isHuman: isCustomer || isSellerOperator,
            isAgent: isBot,
            messageType: event.messageType ?? 'TEXT',
            text: event.text,
            mediaUrl: event.mediaUrl ?? null,
            referenceId: event.referenceId ?? null,
            status: event.status ?? null,
            processMsg: event.processMsg ?? null,
            timestamp: formattedTime,
            confidence: null,
            groundedFacts: [],
            ungroundedClaims: [],
            suggestedAction: null,
          };

          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              const exists = prev.messages.some(
                (m) => m.id === incomingMessage.id,
              );
              if (exists) {
                return prev;
              }
              return {
                ...prev,
                latestMessage: incomingMessage,
                ...(isCustomer
                  ? {
                      lastBuyerMessageTime: resolveMonotonicIsoTimestamp(
                        formattedTime,
                        prev.lastBuyerMessageTime,
                      ),
                    }
                  : {}),
                ...(activeConversationIdRef.current !== event.conversationId && isCustomer
                  ? { unreadCount: (prev.unreadCount ?? 0) + 1 }
                  : {}),
                updatedAt: resolveMonotonicIsoTimestamp(formattedTime, prev.updatedAt),
                messages: [...prev.messages, incomingMessage],
              };
            },
          );

          const existingLists = queryClient.getQueriesData<ConversationSummary[]>({
            queryKey: ['conversations'],
          });
          let hasColdConversationMiss =
            existingLists.length === 0 ||
            existingLists.every(([, list]) => !list || !Array.isArray(list));

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                hasColdConversationMiss = true;
                return prevList;
              }
              if (!prevList.some((item) => item.id === event.conversationId)) {
                hasColdConversationMiss = true;
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    latestMessage: incomingMessage,
                    ...(isCustomer
                      ? {
                          lastBuyerMessageTime: resolveMonotonicIsoTimestamp(
                            formattedTime,
                            item.lastBuyerMessageTime,
                          ),
                        }
                      : {}),
                    ...(activeConversationIdRef.current !== event.conversationId && isCustomer
                      ? { unreadCount: (item.unreadCount ?? 0) + 1 }
                      : {}),
                    updatedAt: resolveMonotonicIsoTimestamp(formattedTime, item.updatedAt),
                  };
                }
                return item;
              });
            },
          );

          if (hasColdConversationMiss) {
            void queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }
          break;
        }

        case 'chat:bot_replied': {
          const formattedTime = formatIsoTimestamp(event.timestamp);
          const botMessage: WorkspaceMessage = {
            id: event.messageId,
            senderCode: 'bot',
            senderName: tRef.current('sender.aiAssistant'),
            isHuman: false,
            isAgent: true,
            messageType: 'TEXT',
            text: event.text,
            timestamp: formattedTime,
            confidence: event.confidence,
            groundedFacts: event.groundedFacts,
            ungroundedClaims: [],
            suggestedAction: null,
          };

          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              const exists = prev.messages.some((m) => m.id === botMessage.id);
              if (exists) {
                return prev;
              }
              return {
                ...prev,
                latestMessage: botMessage,
                updatedAt: resolveMonotonicIsoTimestamp(formattedTime, prev.updatedAt),
                messages: [...prev.messages, botMessage],
              };
            },
          );

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    latestMessage: botMessage,
                    updatedAt: resolveMonotonicIsoTimestamp(formattedTime, item.updatedAt),
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:session_escalated': {
          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                priority: event.priority,
                humanApprovalRequired: true,
                status: {
                  code: 'escalated',
                  name: tRef.current('status.escalated'),
                },
              };
            },
          );

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    priority: event.priority,
                    humanApprovalRequired: true,
                    status: {
                      code: 'escalated',
                      name: tRef.current('status.escalated'),
                    },
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:operator_takeover': {
          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                humanApprovalRequired: false,
                status: {
                  code: 'in_progress',
                  name: tRef.current('status.inProgress'),
                },
              };
            },
          );

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    humanApprovalRequired: false,
                    status: {
                      code: 'in_progress',
                      name: tRef.current('status.inProgress'),
                    },
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:message_updated': {
          const isRecalled = event.status === 'RECALLED';
          const applyMessagePatch = (message: WorkspaceMessage): WorkspaceMessage => {
            if (message.id !== event.messageId) {
              return message;
            }
            return {
              ...message,
              status: event.status,
              text: event.text,
              ...(isRecalled ? { mediaUrl: null, referenceId: null } : {}),
              ...(event.processMsg !== undefined ? { processMsg: event.processMsg } : {}),
            };
          };

          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                latestMessage: prev.latestMessage
                  ? applyMessagePatch(prev.latestMessage)
                  : null,
                messages: prev.messages.map(applyMessagePatch),
              };
            },
          );

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId && item.latestMessage) {
                  return {
                    ...item,
                    latestMessage: applyMessagePatch(item.latestMessage),
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:session_resolved': {
          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                humanApprovalRequired: false,
                status: {
                  code: 'resolved',
                  name: tRef.current('status.resolved'),
                },
              };
            },
          );

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    humanApprovalRequired: false,
                    status: {
                      code: 'resolved',
                      name: tRef.current('status.resolved'),
                    },
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:session_updated': {
          const incomingLastTime = event.lastMessageTime
            ? formatIsoTimestamp(event.lastMessageTime)
            : null;

          if (!event.conversationId) {
            void queryClient.invalidateQueries({ queryKey: ['conversations'] });
            break;
          }

          queryClient.setQueryData<ConversationDetail | null>(
            ['conversation', event.conversationId],
            (prev) => {
              if (!prev) {
                return prev;
              }
              return {
                ...prev,
                ...(event.unreadCount !== undefined
                  ? { unreadCount: event.unreadCount }
                  : {}),
                ...(incomingLastTime
                  ? {
                      updatedAt: resolveMonotonicIsoTimestamp(
                        incomingLastTime,
                        prev.updatedAt,
                      ),
                    }
                  : {}),
              };
            },
          );

          const existingLists = queryClient.getQueriesData<ConversationSummary[]>({
            queryKey: ['conversations'],
          });
          let hasColdMiss =
            existingLists.length === 0 ||
            existingLists.every(([, list]) => !list || !Array.isArray(list));

          queryClient.setQueriesData<ConversationSummary[]>(
            { queryKey: ['conversations'] },
            (prevList) => {
              if (!prevList || !Array.isArray(prevList)) {
                hasColdMiss = true;
                return prevList;
              }
              if (!prevList.some((item) => item.id === event.conversationId)) {
                hasColdMiss = true;
                return prevList;
              }
              return prevList.map((item) => {
                if (item.id === event.conversationId) {
                  return {
                    ...item,
                    ...(event.unreadCount !== undefined
                      ? { unreadCount: event.unreadCount }
                      : {}),
                    ...(incomingLastTime
                      ? {
                          updatedAt: resolveMonotonicIsoTimestamp(
                            incomingLastTime,
                            item.updatedAt,
                          ),
                        }
                      : {}),
                  };
                }
                return item;
              });
            },
          );

          if (hasColdMiss) {
            void queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }
          break;
        }

        case 'ping':
        default:
          break;
  }
}

export function useAgentSession(
  options: UseAgentSessionOptions = {},
): UseAgentSessionReturn {
  const { orgId, activeConversationId, enabled = true, onEvent } = options;
  const t = useTranslations('chat');
  const queryClient = useQueryClient();
  const activeConversationIdRef = useRef<number | null | undefined>(activeConversationId);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [lastEvent, setLastEvent] = useState<ChatStreamEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef<number>(0);
  const onEventRef = useRef(onEvent);
  const tRef = useRef(t);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    onEventRef.current = onEvent;
    tRef.current = t;
  }, [activeConversationId, onEvent, t]);

  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent): void => {
      setLastEvent(event);
      if (onEventRef.current) {
        onEventRef.current(event);
      }

      applyChatStreamEventToQueryCache({
        event,
        queryClient,
        activeConversationId: activeConversationIdRef.current,
        translate: (key: string) => tRef.current(key as never),
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    let isDisposed = false;

    const connect = (): void => {
      if (isDisposed) {
        return;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const streamUrl = '/api/chat/stream';

      const source = new EventSource(streamUrl);
      eventSourceRef.current = source;

      source.onopen = (): void => {
        if (isDisposed) {
          return;
        }
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        attemptRef.current = 0;
        setReconnectCount(0);
      };

      source.onerror = (): void => {
        if (isDisposed) {
          return;
        }
        source.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        setIsReconnecting(true);

        const currentAttempt = attemptRef.current;
        attemptRef.current = currentAttempt + 1;
        setReconnectCount(currentAttempt + 1);

        const backoffDelay = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, currentAttempt),
          MAX_BACKOFF_MS,
        );

        setError(
          new Error(
            tRef.current('stream.reconnecting', {
              seconds: Math.round(backoffDelay / 1000),
            }),
          ),
        );

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, backoffDelay);
      };

      const eventNames = [
        'chat:message_received',
        'chat:message_updated',
        'chat:session_escalated',
        'chat:bot_replied',
        'chat:operator_takeover',
        'chat:session_updated',
        'chat:session_resolved',
      ];

      for (const eventName of eventNames) {
        source.addEventListener(eventName, (rawEvent: MessageEvent) => {
          if (isDisposed) {
            return;
          }
          try {
            const parsed = JSON.parse(rawEvent.data) as ChatStreamEvent;
            handleStreamEvent(parsed);
          } catch {
            // Ignore malformed event payload
          }
        });
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      setIsReconnecting(false);
    };
  }, [enabled, orgId, handleStreamEvent]);

  return {
    isConnected,
    isReconnecting,
    error,
    reconnectCount,
    lastEvent,
  };
}

