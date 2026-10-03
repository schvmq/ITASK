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
                className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-5 space-y-4 animate-modal-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                        <h3 id="delete-dialog-title" className="text-base font-bold text-[var(--ink)]">
                            Delete this message?
                        </h3>
                        <p id="delete-dialog-desc" className="text-xs text-[var(--muted)] leading-relaxed">
                            Everyone in this chat will no longer see it.
                        </p>
                    </div>
                </div>

                {/* Important notice if message contains a shared task card */}
                {hasTaskCard && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--tint-yellow)] border border-[#FFE9A8] dark:border-[#524410] text-[var(--ink)] text-xs">
                        <CheckSquare className="w-4 h-4 text-[#8A5A00] dark:text-[#FFBB00] shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <span className="font-bold">Task preserved:</span>
                            <p className="text-[11px] text-[var(--muted)]">
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
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--tint-neutral)] text-[var(--ink)] transition-colors cursor-pointer disabled:opacity-50 btn-press"
                    >
                        Cancel
                    </button>
                    <button
                        ref={deleteButtonRef}
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 btn-press"
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
