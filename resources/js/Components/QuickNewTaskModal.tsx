import React from 'react';
import { router, usePage } from '@inertiajs/react';
import { X, CheckSquare, FolderOpen, ArrowRight, PlusCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/Components/Button';
import { PageProps } from '@/types';

interface QuickNewTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenCreateProject?: () => void;
}

export function QuickNewTaskModal({
    isOpen,
    onClose,
    onOpenCreateProject,
}: QuickNewTaskModalProps) {
    const pageProps = usePage<PageProps & { projects?: Array<{ id: string; title: string }> }>().props;
    const projects = pageProps.projects ?? [];

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] overflow-hidden animate-fade-in text-[color:var(--text)]"
                style={{ boxShadow: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)]">
                            <CheckSquare className="w-4 h-4 stroke-[2px]" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-semibold text-[color:var(--text)]">
                                Create new task
                            </h3>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Tasks are organized within project activities
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        aria-label="Close modal"
                    >
                        <X className="w-4 h-4 stroke-[2px]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4">
                    {projects.length > 0 ? (
                        <>
                            <p className="text-[13px] font-medium text-[color:var(--text)]">
                                Select a project to add your task:
                            </p>
                            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                                {projects.map((proj) => (
                                    <button
                                        key={proj.id}
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            router.visit(`/projects/${proj.id}`);
                                        }}
                                        className="w-full flex items-center justify-between p-3 rounded-[8px] border border-[color:var(--border)] hover:border-[color:var(--primary)] hover:bg-[color:var(--soft-surface)] transition-colors text-left cursor-pointer group focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <FolderOpen className="w-4 h-4 text-[color:var(--muted)] group-hover:text-[color:var(--primary)] shrink-0 stroke-[2px]" />
                                            <span className="text-[13px] font-medium text-[color:var(--text)] truncate">
                                                {proj.title}
                                            </span>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-[color:var(--muted)] group-hover:text-[color:var(--primary)] group-hover:translate-x-0.5 transition-transform shrink-0 stroke-[2px]" />
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6 space-y-3">
                            <AlertCircle className="w-8 h-8 text-[color:var(--primary)] mx-auto stroke-[2px]" />
                            <div>
                                <h4 className="text-[15px] font-semibold text-[color:var(--text)]">
                                    No active projects yet
                                </h4>
                                <p className="text-[12px] text-[color:var(--muted)] max-w-xs mx-auto mt-1">
                                    Tasks belong to project activities. Create a project first to start adding tasks.
                                </p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    onClose();
                                    if (onOpenCreateProject) onOpenCreateProject();
                                }}
                            >
                                Create first project
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-[color:var(--border)] bg-[color:var(--soft-surface)] flex justify-end">
                    <Button variant="secondary" size="md" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
