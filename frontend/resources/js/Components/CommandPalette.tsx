import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    UserCheck,
    Sparkles,
    ShieldCheck,
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
    const isAdmin = Boolean(auth?.user?.is_admin);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(false);
    const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const quickLinks = isAdmin
        ? [
              { label: 'Admin User Management', href: '/admin/dashboard', icon: ShieldCheck },
              { label: 'Pending Registrations', href: '/admin/dashboard?tab=pending', icon: UserCheck },
          ]
        : [
              { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
              { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
              { label: 'Events', href: '/projects', icon: FolderOpen },
              { label: 'Smart S.O. Import', href: '/projects/smart-import', icon: Sparkles },
              { label: 'Eligibility & Strengths', href: '/eligibility-profile', icon: UserCheck },
              { label: 'Calendar', href: '/calendar', icon: CalendarDays },
              { label: 'Timeline', href: '/timeline', icon: GanttChartSquare },
              { label: 'Messages', href: '/messages', icon: MessageSquare },
              { label: 'Notifications', href: '/notifications', icon: Bell },
          ];

    const filteredLinks = quickLinks.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = useCallback(
        (href: string) => {
            onClose();
            router.visit(href);
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            if (!wasOpenRef.current) {
                previousActiveElementRef.current =
                    document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }
            wasOpenRef.current = true;
            setQuery('');
            setSelectedIndex(0);
            const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
            return () => window.clearTimeout(timer);
        } else if (wasOpenRef.current) {
            wasOpenRef.current = false;
            const prev = previousActiveElementRef.current;
            previousActiveElementRef.current = null;
            if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
                window.requestAnimationFrame(() => {
                    if (!document.querySelector('[role="dialog"]') && document.contains(prev)) {
                        prev.focus();
                    }
                });
            }
        }
    }, [isOpen]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        if (!isOpen || filteredLinks.length === 0) return;
        const activeOption = optionRefs.current[selectedIndex];
        if (activeOption && typeof activeOption.scrollIntoView === 'function') {
            activeOption.scrollIntoView({ block: 'nearest' });
        }
    }, [isOpen, selectedIndex, filteredLinks.length]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'Tab') {
                const container = dialogRef.current;
                if (!container) return;
                const focusable = Array.from(
                    container.querySelectorAll<HTMLElement>(
                        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                    )
                ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
                if (focusable.length === 0) {
                    e.preventDefault();
                    return;
                }
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement as HTMLElement | null;
                if (e.shiftKey) {
                    if (!active || active === first || !container.contains(active)) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (!active || active === last || !container.contains(active)) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            } else if (e.key === 'ArrowDown') {
                if (filteredLinks.length === 0) return;
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredLinks.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp') {
                if (filteredLinks.length === 0) return;
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredLinks.length - 1
                );
            } else if (e.key === 'Enter' && document.activeElement === inputRef.current) {
                e.preventDefault();
                if (filteredLinks[selectedIndex]) {
                    handleSelect(filteredLinks[selectedIndex].href);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, filteredLinks, selectedIndex, handleSelect]);

    if (!isOpen) return null;

    const activeOptionId = filteredLinks[selectedIndex]
        ? `command-palette-option-${selectedIndex}`
        : undefined;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Global command navigation"
                className="w-full max-w-xl bg-[color:var(--card)] border border-[color:var(--border)] rounded-[12px] overflow-hidden animate-fade-in text-[color:var(--text)]"
                style={{ boxShadow: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Bar Input */}
                <div className="relative flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)]">
                    <Search className="w-[18px] h-[18px] stroke-[2px] text-[color:var(--muted)] shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-expanded={filteredLinks.length > 0}
                        aria-autocomplete="list"
                        aria-activedescendant={activeOptionId}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search pages or quick actions..."
                        aria-label="Search pages or quick actions"
                        aria-controls="command-palette-navigation"
                        className="w-full pl-1 pr-2 py-1 rounded-[6px] bg-transparent text-[color:var(--text)] placeholder-[color:var(--muted)] text-[15px] outline-none border-none ring-0 focus:outline-none"
                    />
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-[32px] flex items-center justify-center rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 shrink-0"
                        aria-label="Close command palette"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="p-3 border-b border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                    <p className="text-[11px] font-semibold text-[color:var(--text)]/75 uppercase tracking-wider px-1 mb-2">
                        Quick actions
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {isAdmin ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSelect('/admin/dashboard')}
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                >
                                    <ShieldCheck className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                    Admin User Management
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelect('/admin/dashboard?tab=pending')}
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                >
                                    <UserCheck className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                    Pending Registrations
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        if (onOpenNewTask) onOpenNewTask();
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
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
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                >
                                    <FolderOpen className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                    Create new event
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelect('/projects/smart-import')}
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                >
                                    <Sparkles className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                    Smart S.O. Import
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSelect('/eligibility-profile')}
                                    className="flex items-center gap-2 px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-[13px] font-medium bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] hover:border-[color:var(--primary)] transition-colors text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                >
                                    <UserCheck className="w-4 h-4 text-[color:var(--primary)] shrink-0" />
                                    Eligibility & Strengths
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Search Results / Navigation */}
                <div className="max-h-64 overflow-y-auto p-2">
                    <p
                        id="command-palette-navigation-label"
                        className="text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider px-2 py-1"
                    >
                        Navigation
                    </p>
                    <div
                        id="command-palette-navigation"
                        role="listbox"
                        aria-labelledby="command-palette-navigation-label"
                    >
                        {filteredLinks.map((item, idx) => {
                            const Icon = item.icon;
                            const isSelected = idx === selectedIndex;
                            return (
                                <button
                                    key={item.href}
                                    id={`command-palette-option-${idx}`}
                                    ref={(el) => {
                                        optionRefs.current[idx] = el;
                                    }}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(item.href)}
                                    className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-[8px] text-left text-[13px] transition-colors cursor-pointer group border ${
                                        isSelected
                                            ? 'bg-[color:var(--status-primary-bg)] border-[color:var(--status-primary-border)] text-[color:var(--text)] font-semibold'
                                            : 'border-transparent text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] font-medium'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Icon
                                            className={`w-[18px] h-[18px] stroke-[2px] shrink-0 transition-colors ${
                                                isSelected
                                                    ? 'text-[color:var(--primary)]'
                                                    : 'text-[color:var(--muted)] group-hover:text-[color:var(--primary)]'
                                            }`}
                                        />
                                        <span>{item.label}</span>
                                    </div>
                                    <span className="text-[12px] text-[color:var(--text)]/70">Jump</span>
                                </button>
                            );
                        })}
                    </div>
                    {filteredLinks.length === 0 && (
                        <div
                            role="status"
                            className="py-6 text-center text-[13px] text-[color:var(--muted)]"
                        >
                            No matching pages found for &ldquo;{query}&rdquo;
                        </div>
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
