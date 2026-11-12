import type { ActionErrorCode } from '@/types';

export type ChatErrorKey =
  | 'sessionExpired'
  | 'antiSpamQuota'
  | 'platformSendFailed'
  | 'draftValidationFailed'
  | 'draftOutdated'
  | 'draftAlreadyReviewed'
  | 'draftSafetyFailed'
  | 'unauthorized'
  | 'conversationNotFound'
  | 'invalidInput'
  | 'syncCooldown'
  | 'syncPermissionDenied'
  | 'syncConnectionNotFound'
  | 'syncFailed'
  | 'genericSendError';

export type ChatErrorTranslator = (key: ChatErrorKey) => string;

function resolveDraftValidationErrorKey(rawError: string | undefined): ChatErrorKey {
  const normalized = rawError?.toLowerCase() ?? '';
  if (normalized.includes('outdated')) {
    return 'draftOutdated';
  }
  if (normalized.includes('already been') || normalized.includes('concurrently reviewed')) {
    return 'draftAlreadyReviewed';
  }
  if (normalized.includes('safety validation failed')) {
    return 'draftSafetyFailed';
  }
  return 'draftValidationFailed';
}

/** Maps ActionErrorCode payloads to localized operator-facing chat error strings. */
export function resolveChatActionErrorMessage(
  code: ActionErrorCode | undefined,
  rawError: string | undefined,
  tErrors: ChatErrorTranslator,
  fallbackMessage?: string,
): string {
  switch (code) {
    case 'SESSION_EXPIRED':
      return tErrors('sessionExpired');
    case 'ANTI_SPAM_QUOTA_EXCEEDED':
      return tErrors('antiSpamQuota');
    case 'PLATFORM_SEND_FAILED':
      return tErrors('platformSendFailed');
    case 'DRAFT_VALIDATION_FAILED':
      return tErrors(resolveDraftValidationErrorKey(rawError));
    case 'UNAUTHORIZED':
      return tErrors('unauthorized');
    case 'FORBIDDEN':
      return tErrors('syncPermissionDenied');
    case 'CONNECTION_NOT_FOUND':
      return tErrors('syncConnectionNotFound');
    case 'SYNC_COOLDOWN_ACTIVE':
      return tErrors('syncCooldown');
    case 'CONVERSATION_NOT_FOUND':
      return tErrors('conversationNotFound');
    case 'INVALID_INPUT':
      return tErrors('invalidInput');
    case 'SYSTEM_ERROR':
    default:
      return fallbackMessage ?? tErrors('genericSendError');
  }
}
