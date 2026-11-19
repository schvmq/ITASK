import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onDismiss, 200);
        }, durationMs);

        return () => clearTimeout(timer);
    }, [messageId, onDismiss, durationMs]);

    const handleUndoClick = () => {
        setIsUndoing(true);
        onUndo(messageId);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 200);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="fixed bottom-6 right-6 z-50 w-80 bg-[color:var(--card)] border border-[color:var(--border)] rounded-2xl shadow-2xl overflow-hidden select-none"
                >
                    <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-[color:var(--soft-surface)] flex items-center justify-center text-[color:var(--muted)] shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-[color:var(--text)] truncate">
                                Message deleted
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <motion.button
                                type="button"
                                onClick={handleUndoClick}
                                disabled={isUndoing}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="px-2.5 py-1 rounded-lg bg-[color:var(--primary)] text-white text-xs font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Undo</span>
                            </motion.button>
                            <motion.button
                                type="button"
                                onClick={handleDismiss}
                                whileHover={{ scale: 1.12 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-1 rounded text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer"
                                aria-label="Close notification"
                            >
                                <X className="w-3.5 h-3.5" />
                            </motion.button>
                        </div>
                    </div>

                    {/* Shrinking progress line */}
                    <div className="h-1 w-full bg-[color:var(--soft-surface)] overflow-hidden">
                        <motion.div
                            className="h-full bg-[color:var(--primary)]"
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: durationMs / 1000, ease: 'linear' }}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
