import React, { useState, useEffect, useRef } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    Search,
    LayoutDashboard,
    FolderOpen,
    CheckSquare,
    CalendarDays,
    GanttChartSquare,
    MessageSquare,
    Bell,
    Plus,
    X,
    ArrowRight,
    User,
} from 'lucide-react';
import { PageProps } from '@/types';

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenNewTask?: () => void;
    onOpenCreateProject?: () => void;
}

export function CommandPalette({
    isOpen,
    onClose,
    onOpenNewTask,
    onOpenCreateProject,
}: CommandPaletteProps) {
    const { auth } = usePage<PageProps>().props;
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) {
                    onClose();
                } else {
                    // Open triggered from parent or window listener
                }
            }
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const quickLinks = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Projects', href: '/projects', icon: FolderOpen },
        { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
        { label: 'Calendar', href: '/calendar', icon: CalendarDays },
        { label: 'Timeline', href: '/timeline', icon: GanttChartSquare },
        { label: 'Messages', href: '/chat', icon: MessageSquare },
        { label: 'Notifications', href: '/notifications', icon: Bell },
    ];

    const filteredLinks = quickLinks.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (href: string) => {
        onClose();
        router.visit(href);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs">
            <div
                className="w-full max-w-xl bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Bar Input */}
                <div className="relative flex items-center px-4 py-3.5 border-b border-[var(--border)]">
                    <Search className="w-5 h-5 text-[var(--muted)] shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tasks, projects, people..."
                        className="w-full pl-3 pr-8 py-1 bg-transparent text-[var(--ink)] placeholder-[var(--muted)] text-[15px] outline-none border-none ring-0 focus:ring-0"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)]"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="p-3 border-b border-[var(--border)] bg-[var(--tint-neutral)]/30">
                    <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider px-2 mb-1.5">
                        Quick Actions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onOpenNewTask) onOpenNewTask();
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--tint-orange)] text-[#2A2A2A] hover:opacity-90 transition-opacity text-left"
                        >
                            <Plus className="w-4 h-4 text-[#EC7505]" />
                            Create new task
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onOpenCreateProject) onOpenCreateProject();
                                else router.visit('/projects');
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--tint-yellow)] text-[#2A2A2A] hover:opacity-90 transition-opacity text-left"
                        >
                            <FolderOpen className="w-4 h-4 text-[#8A5A00] dark:text-[#FFBB00]" />
                            Create new project
                        </button>
                    </div>
                </div>

                {/* Search Results / Navigation */}
                <div className="max-h-72 overflow-y-auto p-2">
                    <p className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider px-2 py-1.5">
                        Navigation & Pages
                    </p>
                    {filteredLinks.length === 0 ? (
                        <div className="py-6 text-center text-xs text-[var(--muted)]">
                            No matching pages found for "{query}"
                        </div>
                    ) : (
                        filteredLinks.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    onClick={() => handleSelect(item.href)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-[var(--tint-neutral)] flex items-center justify-center text-[var(--ink)] group-hover:text-[#EC7505]">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <span>{item.label}</span>
                                    </div>
                                    <span className="text-[11px] text-[var(--muted)] group-hover:text-[var(--link-orange)]">
                                        Jump
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer hints */}
                <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--card)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                    <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--tint-neutral)] font-mono text-[10px] text-[var(--ink)]">ESC</kbd> to close</span>
                    <span>Use keyboard shortcuts</span>
                </div>
            </div>
        </div>
    );
}
