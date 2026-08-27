'use client';

import { useState, type KeyboardEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sendMessageAction } from '@/actions/conversationActions';
import { IconButton } from '@/components/atoms';

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
        <p role="alert" className="mb-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="relative rounded-xl border border-slate-700 bg-slate-900 p-2.5 shadow-2xl shadow-black/20 transition focus-within:border-violet-400/80 focus-within:ring-2 focus-within:ring-violet-500/20">
        {/* Top-Right AI Sparkle Button */}
        <div className="absolute right-2 top-2 z-10">
          <IconButton
            size="xs"
            variant="ai"
            ariaLabel="Generate AI Co-pilot reply"
            tooltip="Generate AI Co-pilot reply"
            isLoading={isGenerating}
            onClick={onGenerate}
            disabled={isGenerating}
            icon={
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5 text-violet-300 transition hover:text-violet-100"
              >
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
                <path d="M19 3v4" />
                <path d="M21 5h-4" />
              </svg>
            }
          />
        </div>

        <textarea
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a customer reply…"
          className="block w-full resize-none bg-transparent pr-8 text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
          <p className="text-[10px] text-slate-500">
            Enter to send · Shift+Enter for new line
          </p>

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!text.trim() || isSending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSending ? (
              <span>Sending…</span>
            ) : (
              <>
                <span>Send</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-3"
                >
                  <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 004.835 9.25h4.915a.75.75 0 010 1.5H4.835a1.5 1.5 0 00-1.142 1.086L2.279 16.76a.75.75 0 00.95.826l14.25-6.25a.75.75 0 000-1.372L3.105 2.289z" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
