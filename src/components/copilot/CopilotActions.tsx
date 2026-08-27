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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onReject}
        disabled={isSaving}
        className="rounded-md px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-700 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={onStartEditing}
        disabled={isSaving}
        className="rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isEditing ? 'Cancel edit' : 'Edit'}
      </button>
      <button
        type="button"
        onClick={onApprove}
        disabled={isSaving || !canApprove}
        className={cn(
          'rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50',
          !canApprove && 'bg-slate-700 text-slate-400 hover:bg-slate-700',
        )}
      >
        {isSaving ? 'Saving…' : isEditing ? 'Send edited reply' : 'Approve & send'}
      </button>
    </div>
  );
}
