import type { WorkspaceMessage } from '@/types';
import { cn } from '@/lib/cn';

type MessageBubbleProps = {
  readonly message: WorkspaceMessage;
};

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isBuyer = message.senderCode === 'buyer';
  const isSystem = message.senderCode === 'system';
  const isAiGenerated = !message.isHuman && message.isAgent;

  if (isSystem) {
    return <p className="text-center text-sm leading-5 text-muted">{message.text ?? 'System update'}</p>;
  }

  return (
    <article className={cn('flex gap-2', isBuyer ? 'justify-start' : 'justify-end')}>
      {/* Buyer avatar (left) */}
      {isBuyer && (
        <div className="mt-6 grid size-7 shrink-0 place-items-center rounded-full border border-hairline bg-surface-card text-xs font-bold text-foreground shadow-xs">
          {message.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className={cn('flex max-w-[82%] flex-col', isBuyer ? 'items-start' : 'items-end', 'sm:max-w-[72%]')}>
        <p className="mb-1.5 px-1 text-xs font-medium text-muted">
          {message.senderName}
          {isAiGenerated && ''}
        </p>
        <div
          className={cn(
            'px-4 py-3 text-base leading-6',
            isBuyer
              ? 'rounded-2xl rounded-tl-sm border border-hairline bg-surface-card text-foreground shadow-xs'
              : 'rounded-2xl rounded-tr-sm bg-foreground text-on-primary shadow-xs selection:bg-on-primary/30 selection:text-on-primary',
          )}
        >
          <p className={cn('whitespace-pre-wrap break-words', !isBuyer && 'selection:bg-on-primary/30 selection:text-on-primary')}>
            {message.text ?? `[${message.messageType}]`}
          </p>
        </div>
        <div className={cn(
          'mt-1.5 flex items-center gap-2 px-1 text-xs tabular-nums text-muted',
        )}>
          <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
          {/* Show grounding confidence for AI-generated agent messages */}
          {!isBuyer && message.confidence !== null && message.confidence > 0 && (
            <span className="rounded-full bg-status-success/15 px-2 py-0.5 text-[11px] font-medium text-status-success-text">
              {Math.round(message.confidence * 100)}% grounded
            </span>
          )}
        </div>
      </div>

      {/* Agent avatar (right) */}
      {!isBuyer && (
        <div className={cn(
          'mt-6 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold shadow-xs',
          isAiGenerated
            ? 'bg-status-warning/15 text-status-warning'
            : 'bg-foreground text-background',
        )}>
          {isAiGenerated ? '✦' : message.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}
    </article>
  );
}
