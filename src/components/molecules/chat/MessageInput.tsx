'use client';

import { useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sendMessageAction } from '@/actions/conversationActions';
import { Button } from '@/components/atoms';
import { ErrorBanner } from '@/components/molecules/ErrorBanner';

type MessageInputProps = {
  readonly conversationId: number;
  readonly isGenerating: boolean;
  readonly onGenerate: () => void;
  readonly onSent: () => void;
};

export function MessageInput({
  conversationId,
  isGenerating,
  onGenerate,
  onSent,
}: MessageInputProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const message = text.trim();
    if (!message || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      await sendMessageAction(conversationId, message);
      setText('');
      onSent();
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-2">
          <ErrorBanner
            message={error}
            variant="inline"
            onRetry={() => void handleSend()}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      <div className="relative rounded-2xl border border-hairline bg-surface-card p-3 shadow-xs transition duration-150 focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/10">
        {/* Persistent label + AI draft button row */}
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor={`composer-${conversationId}`}
            className="text-[11px] font-semibold text-foreground"
          >
            Reply to customer
          </label>
          <Button
            size="xs"
            variant="ai"
            onClick={onGenerate}
            disabled={isGenerating}
            isLoading={isGenerating}
            icon={
              !isGenerating ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5 text-status-warning"
                >
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                  <path d="M19 3v4" />
                  <path d="M21 5h-4" />
                </svg>
              ) : undefined
            }
          >
            <span className="hidden sm:inline">AI Draft</span>
          </Button>
        </div>

        <textarea
          id={`composer-${conversationId}`}
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a customer reply…"
          className="block w-full resize-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted"
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-hairline pt-2">
          <p className="text-[10px] text-muted">
            Enter to send · Shift+Enter for new line
          </p>

          <Button
            size="xs"
            variant="primary"
            onClick={() => void handleSend()}
            disabled={!text.trim() || isSending}
            isLoading={isSending}
            rightIcon={
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-3"
              >
                <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 004.835 9.25h4.915a.75.75 0 010 1.5H4.835a1.5 1.5 0 00-1.142 1.086L2.279 16.76a.75.75 0 00.95.826l14.25-6.25a.75.75 0 000-1.372L3.105 2.289z" />
              </svg>
            }
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
