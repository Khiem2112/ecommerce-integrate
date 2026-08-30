'use client';

import { Button } from '@/components/atoms';

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
      <Button
        variant="ghost"
        size="xs"
        onClick={onReject}
        disabled={isSaving}
      >
        Dismiss
      </Button>
      <Button
        variant="outline"
        size="xs"
        onClick={onStartEditing}
        disabled={isSaving}
      >
        {isEditing ? 'Cancel edit' : 'Edit text'}
      </Button>
      <Button
        variant="primary"
        size="xs"
        onClick={onApprove}
        disabled={isSaving || !canApprove}
        isLoading={isSaving}
      >
        {isEditing ? 'Send edited reply' : 'Approve & send'}
      </Button>
    </div>
  );
}
