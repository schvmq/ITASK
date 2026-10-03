import React, { useEffect, useState } from 'react';
import { RotateCcw, X, Trash2 } from 'lucide-react';

interface UndoToastProps {
    messageId: number;
    onUndo: (messageId: number) => void;
    onDismiss: () => void;
    durationMs?: number;
}

export function UndoToast({
    messageId,
    onUndo,
    onDismiss,
    durationMs = 5000,
}: UndoToastProps) {
    const [isUndoing, setIsUndoing] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, durationMs);

        return () => clearTimeout(timer);
    }, [messageId, onDismiss, durationMs]);

    const handleUndoClick = () => {
        setIsUndoing(true);
        onUndo(messageId);
    };

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 w-80 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-toast-in select-none"
        >
            <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[var(--tint-neutral)] flex items-center justify-center text-[var(--muted)] shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-[var(--ink)] truncate">
                        Message deleted
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleUndoClick}
                        disabled={isUndoing}
                        className="px-2.5 py-1 rounded-lg bg-[#FFBB00] text-[#2A2A2A] text-xs font-extrabold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                    </button>
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                        aria-label="Close notification"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Shrinking 5-second progress line */}
            <div className="h-1 w-full bg-[var(--tint-neutral)] overflow-hidden">
                <div
                    className="h-full bg-[#EC7505] animate-progress-shrink"
                    style={{ animationDuration: `${durationMs}ms` }}
                />
            </div>
        </div>
    );
}
