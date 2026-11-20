'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface DeleteAgentDialogProps {
  isOpen: boolean;
  agentName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAgentDialog({
  isOpen,
  agentName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteAgentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      className="p-0 rounded-xl bg-card text-foreground border border-border shadow-2xl max-w-md w-full backdrop:bg-black/60 backdrop:backdrop-blur-sm m-auto"
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center space-x-3 text-destructive">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="text-lg font-semibold text-foreground">
              Delete Agent
            </h2>
            <p id="delete-dialog-desc" className="text-xs text-muted-foreground mt-0.5">
              This action can be soft-deleted and will remove the agent from your dashboard.
            </p>
          </div>
        </div>

        <p className="text-sm text-foreground">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-primary">{agentName}</span>? Historical call logs will
          remain preserved.
        </p>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm disabled:opacity-50 flex items-center space-x-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Agent</span>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
