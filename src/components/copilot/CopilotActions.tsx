import { cn } from '@/lib/cn';

type CopilotActionsProps = {
  readonly isSaving: boolean;
  readonly isEditing: boolean;
  readonly canApprove: boolean;
  readonly onApprove: () => void;
  readonly onStartEditing: () => void;
  readonly onReject: () => void;
};

export function CopilotActions({
  isSaving,
  isEditing,
  canApprove,
  onApprove,
  onStartEditing,
  onReject,
}: CopilotActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-2">
      <button
        type="button"
        onClick={onReject}
        disabled={isSaving}
        className="rounded-full px-3 py-1 text-xs font-semibold text-muted transition duration-150 hover:bg-foreground/6 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        Dismiss
      </button>
      <button
        type="button"
        onClick={onStartEditing}
        disabled={isSaving}
        className="rounded-full border border-hairline bg-white px-3.5 py-1 text-xs font-semibold text-foreground shadow-xs transition duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        {isEditing ? 'Cancel edit' : 'Edit text'}
      </button>
      <button
        type="button"
        onClick={onApprove}
        disabled={isSaving || !canApprove}
        className={cn(
          'rounded-full bg-foreground px-4 py-1 text-xs font-semibold text-background shadow-xs transition duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:cursor-not-allowed cursor-pointer',
          (!canApprove || isSaving) && 'bg-hairline text-muted hover:bg-hairline',
        )}
      >
        {isSaving ? 'Sending…' : isEditing ? 'Send edited reply' : 'Approve & send'}
      </button>
    </div>
  );
}
