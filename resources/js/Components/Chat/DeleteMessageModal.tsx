import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X, CheckSquare } from 'lucide-react';
import { Button } from '@/Components/Button';

interface DeleteMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    hasTaskCard: boolean;
    triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function DeleteMessageModal({
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
    hasTaskCard,
    triggerButtonRef,
}: DeleteMessageModalProps) {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
    const deleteButtonRef = useRef<HTMLButtonElement | null>(null);

    // Focus trap and return focus on close
    useEffect(() => {
        if (!isOpen) return;

        // Focus the cancel button initially for safety
        const timer = setTimeout(() => {
            cancelButtonRef.current?.focus();
        }, 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            // Trap focus
            if (e.key === 'Tab') {
                const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusableElements || focusableElements.length === 0) return;

                const firstEl = focusableElements[0];
                const lastEl = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeyDown);
            // Return focus to trigger button
            if (triggerButtonRef?.current) {
                triggerButtonRef.current.focus();
            }
        };
    }, [isOpen, onClose, triggerButtonRef]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-backdrop-in"
            onClick={onClose}
            role="presentation"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-desc"
                className="messaging-root w-full max-w-md bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl p-5 space-y-4 animate-modal-in select-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                        <h3 id="delete-dialog-title" className="text-base font-bold text-[color:var(--text)]">
                            Delete this message?
                        </h3>
                        <p id="delete-dialog-desc" className="text-xs text-[color:var(--muted)] leading-relaxed">
                            Everyone in this group chat will no longer see it.
                        </p>
                    </div>
                </div>

                {/* Important notice if message contains a shared task card */}
                {hasTaskCard && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] text-xs">
                        <CheckSquare className="w-4 h-4 text-[color:var(--primary)] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-bold">Task preserved:</span>
                            <p className="text-[11px] text-[color:var(--muted)]">
                                The task will stay in My Tasks and will not be deleted.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                        ref={cancelButtonRef}
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] text-[color:var(--text)] transition-colors cursor-pointer disabled:opacity-50 msg-interactive"
                    >
                        Cancel
                    </button>
                    <button
                        ref={deleteButtonRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 msg-interactive"
                    >
                        {isDeleting ? (
                            <span>Deleting...</span>
                        ) : (
                            <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
