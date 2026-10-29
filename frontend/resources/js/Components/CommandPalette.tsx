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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const quickLinks = [
        { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
        { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
        { label: 'Projects', href: '/projects', icon: FolderOpen },
        { label: 'Calendar', href: '/calendar', icon: CalendarDays },
        { label: 'Timeline', href: '/timeline', icon: GanttChartSquare },
        { label: 'Messages', href: '/messages', icon: MessageSquare },
        { label: 'Notifications', href: '/notifications', icon: Bell },
    ];

    const filteredLinks = quickLinks.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) {
                    onClose();
                }
            }
            if (!isOpen) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredLinks.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredLinks.length - 1
                );
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredLinks[selectedIndex]) {
                    handleSelect(filteredLinks[selectedIndex].href);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, filteredLinks, selectedIndex]);

    if (!isOpen) return null;

    const handleSelect = (href: string) => {
        onClose();
        router.visit(href);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] overflow-hidden animate-fade-in text-[color:var(--text)]"
                style={{ boxShadow: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Bar Input */}
                <div className="relative flex items-center px-4 py-3 border-b border-[color:var(--border)]">
                    <Search className="w-[18px] h-[18px] stroke-[2px] text-[color:var(--muted)] shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search pages or quick actions..."
                        className="w-full pl-3 pr-8 py-1 bg-transparent text-[color:var(--text)] placeholder-[color:var(--muted)] text-[15px] outline-none border-none ring-0 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        aria-label="Close command palette"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="p-3 border-b border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                    <p className="text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider px-1 mb-2">
                        Quick actions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onOpenNewTask) onOpenNewTask();
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        >
                            <Plus className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                            Create new task
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                if (onOpenCreateProject) onOpenCreateProject();
                                else router.visit('/projects');
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                        >
                            <FolderOpen className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                            Create new project
                        </button>
                    </div>
                </div>

                {/* Search Results / Navigation */}
                <div className="max-h-64 overflow-y-auto p-2" role="listbox">
                    <p className="text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider px-2 py-1">
                        Navigation
                    </p>
                    {filteredLinks.length === 0 ? (
                        <div className="py-6 text-center text-[13px] text-[color:var(--muted)]">
                            No matching pages found for "{query}"
                        </div>
                    ) : (
                        filteredLinks.map((item, idx) => {
                            const Icon = item.icon;
                            const isSelected = idx === selectedIndex;
                            return (
                                <button
                                    key={item.href}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(item.href)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left text-[13px] transition-colors cursor-pointer group ${
                                        isSelected
                                            ? 'bg-[color:var(--soft-surface)] text-[color:var(--text)] font-semibold border-l-2 border-l-[color:var(--primary)]'
                                            : 'text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] font-medium'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Icon className="w-[18px] h-[18px] stroke-[2px] text-[color:var(--muted)] group-hover:text-[color:var(--primary)] shrink-0" />
                                        <span>{item.label}</span>
                                    </div>
                                    <span className="text-[12px] text-[color:var(--muted)]">Jump</span>
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer hints */}
                <div className="px-4 py-2 border-t border-[color:var(--border)] bg-[color:var(--card)] flex items-center justify-between text-[11px] text-[color:var(--muted)]">
                    <div className="flex items-center gap-2">
                        <span>Navigate <kbd className="px-1.5 py-0.5 rounded bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[10px]">↑↓</kbd></span>
                        <span>Select <kbd className="px-1.5 py-0.5 rounded bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[10px]">↵</kbd></span>
                    </div>
                    <span>Close <kbd className="px-1.5 py-0.5 rounded bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[10px]">ESC</kbd></span>
                </div>
            </div>
        </div>
    );
}
