export type OutboundWindowMessage = {
  readonly timestamp: Date;
  readonly status?: string | null;
  readonly senderType?: {
    readonly code?: string | null;
  } | null;
};

export type OutboundTurnWindowSummary = {
  readonly latestBuyerMessageTime: Date | null;
  readonly consecutiveOutboundReplies: number;
};

export function computeMonotonicLastMessageTime(
  incomingTime: Date,
  existingTime?: Date | string | null,
): Date {
  const incomingMs = incomingTime.getTime();
  const safeIncomingMs = Number.isFinite(incomingMs) ? incomingMs : Date.now();
  if (!existingTime) {
    return new Date(safeIncomingMs);
  }
  const existingMs =
    existingTime instanceof Date
      ? existingTime.getTime()
      : new Date(existingTime).getTime();
  if (!Number.isFinite(existingMs)) {
    return new Date(safeIncomingMs);
  }
  return new Date(Math.max(safeIncomingMs, existingMs));
}

export function isLazadaPlatformConnection(
  connection:
    | { readonly platform?: { readonly code?: string | null } | null }
    | null
    | undefined,
): boolean {
  const platformCode = connection?.platform?.code;
  return !platformCode || platformCode === 'lazada';
}

export function parseNumericOrderId(
  platformOrderId: string | null | undefined,
): string | number | null {
  const trimmed = platformOrderId?.trim() ?? '';
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : trimmed;
}

export function summarizeOutboundTurnWindow(
  messages: readonly OutboundWindowMessage[],
): OutboundTurnWindowSummary {
  let latestBuyerMessageTime: Date | null = null;
  let consecutiveOutboundReplies = 0;

  for (const msg of messages) {
    const senderCode = msg.senderType?.code;
    if (senderCode === 'buyer') {
      latestBuyerMessageTime = msg.timestamp;
      break;
    }
    if (
      senderCode !== 'system' &&
      msg.status !== 'FAILED' &&
      msg.status !== 'RECALLED' &&
      msg.status !== 'FILTERED'
    ) {
      consecutiveOutboundReplies += 1;
    }
  }

  return {
    latestBuyerMessageTime,
    consecutiveOutboundReplies,
  };
}

export type SessionTabKey = 'escalated' | 'human' | 'bot';

export function classifyConversationTab(conversation: {
  readonly status: { readonly code: string };
  readonly priority: string;
  readonly humanApprovalRequired: boolean;
}): SessionTabKey | null {
  const statusCode = conversation.status.code;

  if (statusCode === 'in_progress') {
    return 'human';
  }

  if (statusCode === 'resolved' || statusCode === 'closed') {
    return null;
  }

  if (
    statusCode === 'escalated' ||
    conversation.priority === 'urgent' ||
    conversation.humanApprovalRequired
  ) {
    return 'escalated';
  }

  if (statusCode === 'open' || statusCode === 'awaiting_reply') {
    return 'bot';
  }

  return null;
}
