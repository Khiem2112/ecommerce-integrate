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

  if (isSystem) {
    return <p className="text-center text-xs text-slate-500">{message.text ?? 'System update'}</p>;
  }

  return (
    <article className={cn('flex flex-col', isBuyer ? 'items-start' : 'items-end')}>
      <p className="mb-1 px-1 text-[11px] font-medium text-slate-500">{message.senderName}</p>
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 sm:max-w-[76%]',
          isBuyer
            ? 'rounded-tl-sm border border-slate-700 bg-slate-900 text-slate-200'
            : 'rounded-tr-sm bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-950/30',
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.text ?? `[${message.messageType}]`}</p>
      </div>
      <div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-slate-600">
        <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>
        {message.confidence !== null && <span>{Math.round(message.confidence * 100)}% confidence</span>}
      </div>
    </article>
  );
}
