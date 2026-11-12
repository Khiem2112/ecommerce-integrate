'use client';

import { useState, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { getSafeDisplayUrl } from '@/utils';
import type { WorkspaceMessage } from '@/types';
import { cn } from '@/lib/cn';

type MessageBubbleProps = {
  readonly message: WorkspaceMessage;
};

const STRUCTURED_TEMPLATE_KEYS: Record<string, string> = {
  ITEM: 'itemLabel',
  ORDER: 'orderLabel',
  VOUCHER: 'voucherLabel',
  VIDEO: 'videoLabel',
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function MessageBubble({ message }: MessageBubbleProps): ReactElement {
  const t = useTranslations('chat.message');
  const [failedMediaUrl, setFailedMediaUrl] = useState<string | null>(null);

  const isBuyer = message.senderCode === 'buyer' || message.senderCode === 'customer';
  const isSystem = message.senderCode === 'system' || message.messageType === 'SYSTEM';
  const isAiGenerated = !message.isHuman && message.isAgent;
  const isRecalled = message.status === 'RECALLED';
  const isFiltered = message.status === 'FILTERED' || Boolean(message.processMsg?.trim());
  const normalizedMediaUrl = getSafeDisplayUrl(message.mediaUrl);
  const safeMediaUrl =
    normalizedMediaUrl !== null && failedMediaUrl !== normalizedMediaUrl
      ? normalizedMediaUrl
      : null;

  if (isSystem) {
    return (
      <p className="py-1 text-center text-xs leading-5 text-muted">
        {message.text ?? t('systemFallback')}
      </p>
    );
  }

  const renderMessageContent = (): ReactElement => {
    if (isRecalled) {
      return (
        <p className={cn('italic line-through opacity-75', isBuyer ? 'text-muted' : 'text-on-primary/80')}>
          {t('recalled')}
        </p>
      );
    }

    if (message.messageType === 'IMAGE') {
      return (
        <div className="space-y-2">
          {safeMediaUrl ? (
            <div className="space-y-1">
              <a
                href={safeMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-hairline bg-background/10"
              >
                {/* Marketplace CDN image domains vary dynamically per upload */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={safeMediaUrl}
                  alt={message.text ?? t('imageAlt')}
                  onError={() => setFailedMediaUrl(safeMediaUrl)}
                  className="max-h-60 w-auto max-w-full rounded-lg object-contain"
                />
              </a>
              <a
                href={safeMediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-medium underline underline-offset-2 opacity-85 hover:opacity-100"
              >
                {t('openImage')}
              </a>
            </div>
          ) : (
            <span className="inline-block text-sm italic opacity-80">
              {t('emptyAttachment')}
            </span>
          )}
          {message.text && (
            <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
          )}
        </div>
      );
    }

    if (message.messageType === 'EMOJI') {
      return (
        <div className="flex items-center gap-2">
          {safeMediaUrl ? (
            // Marketplace emoji CDN domains vary dynamically
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={safeMediaUrl}
              alt={message.text ?? t('emojiLabel')}
              onError={() => setFailedMediaUrl(safeMediaUrl)}
              className="size-12 object-contain"
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {message.text ?? `[${t('emojiLabel')}]`}
            </p>
          )}
        </div>
      );
    }

    const templateKey = STRUCTURED_TEMPLATE_KEYS[message.messageType];
    if (templateKey) {
      return (
        <div
          className={cn(
            'space-y-1.5 rounded-xl border p-2.5 text-sm',
            isBuyer
              ? 'border-hairline bg-surface-lifted text-foreground'
              : 'border-on-primary/20 bg-on-primary/10 text-on-primary',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-85">
              {t(templateKey)}
            </span>
            {message.referenceId && (
              <span className="font-mono text-xs opacity-80">
                {t('referenceCode', { id: message.referenceId })}
              </span>
            )}
          </div>
          {message.text && (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
          {message.messageType === 'VIDEO' && safeMediaUrl && (
            <a
              href={safeMediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium underline underline-offset-2"
            >
              {t('openVideo')}
            </a>
          )}
        </div>
      );
    }

    return (
      <p
        className={cn(
          'whitespace-pre-wrap break-words',
          !isBuyer && 'selection:bg-on-primary/30 selection:text-on-primary',
        )}
      >
        {message.text ?? `[${message.messageType}]`}
      </p>
    );
  };

  return (
    <article className={cn('flex gap-2', isBuyer ? 'justify-start' : 'justify-end')}>
      {/* Buyer avatar (left) */}
      {isBuyer && (
        <div className="mt-6 grid size-7 shrink-0 place-items-center rounded-full border border-hairline bg-surface-card text-xs font-bold text-foreground shadow-xs">
          {message.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div
        className={cn(
          'flex max-w-[82%] flex-col',
          isBuyer ? 'items-start' : 'items-end',
          'sm:max-w-[72%]',
        )}
      >
        <p className="mb-1.5 px-1 text-xs font-medium text-muted">
          {message.senderName}
        </p>
        <div
          className={cn(
            'px-4 py-3 text-base leading-6',
            isRecalled && 'opacity-80',
            isBuyer
              ? 'rounded-2xl rounded-tl-sm border border-hairline bg-surface-card text-foreground shadow-xs'
              : 'rounded-2xl rounded-tr-sm bg-foreground text-on-primary shadow-xs selection:bg-on-primary/30 selection:text-on-primary',
          )}
        >
          {renderMessageContent()}
        </div>

        {isFiltered && !isRecalled && (
          <div className="mt-1.5 rounded-lg border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-xs text-foreground">
            {message.processMsg?.trim()
              ? t('filteredNotice', { reason: message.processMsg.trim() })
              : t('filteredDefault')}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2 px-1 text-xs tabular-nums text-muted">
          <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
          {/* Show grounding confidence for AI-generated agent messages */}
          {!isBuyer && message.confidence !== null && message.confidence > 0 && (
            <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-[11px] font-medium text-status-success-text">
              {Math.round(message.confidence * 100)}% {t('groundedBadge')}
            </span>
          )}
        </div>
      </div>

      {/* Agent avatar (right) */}
      {!isBuyer && (
        <div
          className={cn(
            'mt-6 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold shadow-xs',
            isAiGenerated
              ? 'bg-status-warning/15 text-status-warning'
              : 'bg-foreground text-background',
          )}
        >
          {isAiGenerated ? t('aiTag') : message.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}
    </article>
  );
}
