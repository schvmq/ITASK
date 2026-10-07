import React, { useState } from 'react';
import { X, KeyRound, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/Components/Button';

interface JoinProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function JoinProjectModal({ isOpen, onClose }: JoinProjectModalProps) {
    const [code, setCode] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) return;
        setIsSubmitted(true);
    };

    const handleClose = () => {
        setCode('');
        setIsSubmitted(false);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] overflow-hidden animate-fade-in text-[color:var(--text)]"
                style={{ boxShadow: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                            <KeyRound className="w-4 h-4 stroke-[2px]" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-semibold text-[color:var(--text)]">
                                Join with a code
                            </h3>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Enter your project or committee invite code
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4 stroke-[2px]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5">
                    {isSubmitted ? (
                        <div className="text-center py-4 space-y-3">
                            <CheckCircle2 className="w-10 h-10 text-[color:var(--accent)] stroke-[2px] mx-auto" />
                            <h4 className="text-[15px] font-semibold text-[color:var(--text)]">
                                Invitation code submitted
                            </h4>
                            <p className="text-[13px] text-[color:var(--muted)] leading-relaxed">
                                Your membership request for code <strong className="text-[color:var(--text)] font-mono">{code}</strong> has been received and queued for project staff confirmation.
                            </p>
                            <div className="pt-2">
                                <Button variant="primary" size="sm" onClick={handleClose}>
                                    Got it
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[13px] font-medium text-[color:var(--text)] mb-1">
                                    Invitation code
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. CCIS-PROJ-891"
                                    className="w-full px-3.5 py-2 text-[14px] font-mono tracking-wider uppercase rounded-[8px] border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] placeholder-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                />
                            </div>

                            <div className="flex items-start gap-2.5 p-3 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[12px] text-[color:var(--muted)]">
                                <Info className="w-4 h-4 text-[color:var(--secondary)] shrink-0 mt-0.5 stroke-[2px]" />
                                <p className="leading-snug">
                                    Project codes are generated by faculty project leaders and committee staff for student class or capstone groups.
                                </p>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[color:var(--border)]">
                                <Button type="button" variant="secondary" size="md" onClick={handleClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" size="md">
                                    Join project
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
