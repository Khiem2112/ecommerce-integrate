export function EmptyChat() {
  return (
    <div className="grid h-full min-h-96 place-items-center bg-background px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-full border border-hairline-strong bg-surface-card/65 text-foreground">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 15a4 4 0 0 1-4 4H8l-4 3v-7a4 4 0 0 1-2-3.5V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" strokeWidth="2.5" strokeLinecap="round" /></svg>
        </div>
        <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">Select a conversation</h2>
        <p className="mt-1.5 text-sm leading-6 text-muted">Choose a customer from the inbox to see the message thread, customer context, and AI co-pilot tools.</p>
      </div>
    </div>
  );
}
