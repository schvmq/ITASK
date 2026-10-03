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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div
                className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--tint-orange)] flex items-center justify-center text-[#EC7505]">
                            <CheckSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[var(--ink)]">
                                Create New Task
                            </h3>
                            <p className="text-xs text-[var(--muted)]">
                                Tasks are organized within project activities
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {projects.length > 0 ? (
                        <>
                            <p className="text-xs font-semibold text-[var(--ink)]">
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
                                        className="w-full flex items-center justify-between p-3 rounded-xl border border-[var(--border)] hover:border-[#EC7505] hover:bg-[var(--tint-neutral)]/50 transition-colors text-left group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--tint-yellow)] flex items-center justify-center shrink-0 text-[#8A5A00] dark:text-[#FFBB00]">
                                                <FolderOpen className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-[var(--ink)] group-hover:text-[#EC7505] truncate">
                                                    {proj.title}
                                                </p>
                                                <p className="text-[11px] text-[var(--muted)]">
                                                    Open project committee activities
                                                </p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold text-[var(--link-orange)] flex items-center gap-1 shrink-0">
                                            Open
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="p-5 rounded-xl bg-[var(--tint-yellow)] border border-[#FFE9A8] dark:border-[#524410] text-center space-y-3">
                            <AlertCircle className="w-6 h-6 text-[#8A5A00] dark:text-[#FFBB00] mx-auto" />
                            <div>
                                <p className="text-xs font-bold text-[var(--ink)]">
                                    No active project found
                                </p>
                                <p className="text-[11px] text-[var(--muted)] mt-1">
                                    In ITASK, every task belongs to an activity within a project committee. Create or join a project first.
                                </p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    onClose();
                                    if (onOpenCreateProject) {
                                        onOpenCreateProject();
                                    } else {
                                        router.visit('/projects');
                                    }
                                }}
                            >
                                Create project
                            </Button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--tint-neutral)]/20 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => {
                            onClose();
                            router.visit('/my-tasks');
                        }}
                        className="text-xs font-semibold text-[var(--link-orange)] hover:underline"
                    >
                        View all tasks in My Tasks
                    </button>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
