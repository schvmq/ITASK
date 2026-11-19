import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    children,
    footer,
    maxWidth = 'md',
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    {/* Modal Dialog */}
                    <div className="min-h-full flex items-center justify-center p-4 text-center sm:p-0">
                        <motion.div
                            ref={dialogRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={title ? 'modal-title' : undefined}
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className={`relative w-full ${maxWidthStyles[maxWidth]} transform overflow-hidden rounded-[12px] bg-[color:var(--card)] text-[color:var(--text)] text-left border border-[color:var(--border)] my-8`}
                            style={{ boxShadow: 'none' }}
                        >
                            {/* Header */}
                            {(title || description) && (
                                <div className="px-5 py-4 border-b border-[color:var(--border)] flex items-start justify-between gap-3">
                                    <div>
                                        {title && (
                                            <h3 id="modal-title" className="text-[16px] font-semibold text-[color:var(--text)] leading-snug">
                                                {title}
                                            </h3>
                                        )}
                                        {description && (
                                            <p className="text-[13px] text-[color:var(--muted)] mt-0.5 leading-normal">
                                                {description}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="text-[color:var(--muted)] hover:text-[color:var(--text)] p-1.5 rounded-[6px] hover:bg-[color:var(--soft-surface)] transition cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 shrink-0"
                                        aria-label="Close modal"
                                    >
                                        <X className="w-[18px] h-[18px] stroke-[2px]" />
                                    </button>
                                </div>
                            )}

                            {/* Body */}
                            <div className="px-5 py-4 text-[14px] text-[color:var(--text)]">{children}</div>

                            {/* Footer */}
                            {footer && (
                                <div className="px-5 py-3.5 bg-[color:var(--soft-surface)] border-t border-[color:var(--border)] flex items-center justify-end gap-2.5 rounded-b-[12px]">
                                    {footer}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};
