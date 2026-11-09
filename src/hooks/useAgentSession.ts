'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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

export function useAgentSession(
  options: UseAgentSessionOptions = {},
): UseAgentSessionReturn {
  const { orgId, activeConversationId, enabled = true, onEvent } = options;
  const queryClient = useQueryClient();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [lastEvent, setLastEvent] = useState<ChatStreamEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef<number>(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent): void => {
      setLastEvent(event);
      if (onEventRef.current) {
        onEventRef.current(event);
      }

      switch (event.type) {
        case 'chat:message_received': {
          const formattedTime = formatIsoTimestamp(event.timestamp);
          const isCustomer =
            event.senderCode === 'customer' || event.senderCode === 'buyer';
          const incomingMessage: WorkspaceMessage = {
            id: event.messageId,
            senderCode: event.senderCode,
            senderName: isCustomer ? 'Khách hàng' : 'Hệ thống',
            isHuman: isCustomer,
            isAgent: event.senderCode === 'agent' || event.senderCode === 'bot',
            messageType: 'TEXT',
            text: event.text,
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
                updatedAt: formattedTime,
                messages: [...prev.messages, incomingMessage],
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
                    latestMessage: incomingMessage,
                    updatedAt: formattedTime,
                  };
                }
                return item;
              });
            },
          );
          break;
        }

        case 'chat:bot_replied': {
          const formattedTime = formatIsoTimestamp(event.timestamp);
          const botMessage: WorkspaceMessage = {
            id: event.messageId,
            senderCode: 'bot',
            senderName: 'Trợ lý AI',
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
                updatedAt: formattedTime,
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
                    updatedAt: formattedTime,
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
                  name: 'Cần can thiệp',
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
                      name: 'Cần can thiệp',
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
                humanApprovalRequired: true,
                status: {
                  code: 'in_progress',
                  name: 'Đang xử lý',
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
                    humanApprovalRequired: true,
                    status: {
                      code: 'in_progress',
                      name: 'Đang xử lý',
                    },
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
                  name: 'Đã giải quyết',
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
                      name: 'Đã giải quyết',
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
          void queryClient.invalidateQueries({ queryKey: ['conversations'] });
          break;
        }

        case 'ping':
        default:
          break;
      }
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

      const streamUrl = orgId !== undefined
        ? `/api/chat/stream?orgId=${encodeURIComponent(orgId)}`
        : '/api/chat/stream';

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
            `Connection lost. Reconnecting in ${Math.round(backoffDelay / 1000)}s...`,
          ),
        );

        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, backoffDelay);
      };

      const eventNames = [
        'chat:message_received',
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

