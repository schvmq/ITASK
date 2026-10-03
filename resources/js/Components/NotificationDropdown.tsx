import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { PageProps, NotificationItem } from '@/types';
import {
    Bell,
    CheckSquare,
    Clock,
    AlertCircle,
    CheckCircle2,
    Send,
    ClipboardCheck,
    Check,
    ExternalLink,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';

function getNotificationIcon(type: string, status?: string) {
    if (type === 'task_assigned') {
        return <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    }
    if (type === 'task_deadline_approaching') {
        return <Clock className="w-4 h-4 text-[#FFBB00]" />;
    }
    if (type === 'task_submitted_for_review') {
        return <Send className="w-4 h-4 text-blue-500" />;
    }
    if (type === 'task_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
            <AlertCircle className="w-4 h-4 text-rose-500" />
        );
    }
    if (type === 'activity_submitted_for_review') {
        return <ClipboardCheck className="w-4 h-4 text-indigo-500" />;
    }
    if (type === 'activity_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
            <AlertCircle className="w-4 h-4 text-rose-500" />
        );
    }
    return <Bell className="w-4 h-4 text-[#EC7505]" />;
}

export function NotificationDropdown() {
    const { notifications } = usePage<PageProps>().props;
    const [isOpen, setIsOpen] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const unreadCount = notifications?.unread_count ?? 0;
    const items = notifications?.recent ?? [];

    const handleMarkAsRead = (id: string, actionUrl?: string) => {
        router.post(
            `/notifications/${id}/read`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (actionUrl) {
                        router.visit(actionUrl);
                    }
                },
            }
        );
    };

    const handleMarkAllAsRead = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (unreadCount === 0 || isMarkingAll) return;

        setIsMarkingAll(true);
        router.post(
            '/notifications/mark-all-read',
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsMarkingAll(false),
            }
        );
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="relative p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                    <Bell className="w-4.5 h-4.5" />
                    {/* Orange unread indicator dot per design spec */}
                    {unreadCount > 0 && (
                        <span
                            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#EC7505] ring-2 ring-[var(--card)]"
                            title={`${unreadCount} unread`}
                        />
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-xl border border-[var(--border)] bg-[var(--card)] rounded-2xl overflow-hidden">
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--tint-neutral)]/40">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[var(--ink)]">
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EC7505] text-[#2A2A2A] rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAll}
                            className="text-[11px] font-semibold text-[var(--link-orange)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-3 h-3" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* ── Notification List ── */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
                    {items.length === 0 ? (
                        <div className="py-8 px-4 text-center">
                            <Bell className="w-6 h-6 mx-auto text-[var(--muted)]/50 mb-2" />
                            <p className="text-xs font-semibold text-[var(--ink)]">You're up to date</p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                Task updates and feedback will show here.
                            </p>
                        </div>
                    ) : (
                        items.map((item) => {
                            const isUnread = !item.read_at;
                            const title = item.data.title || 'Notification';
                            const message = item.data.message || '';
                            const actionUrl = item.data.action_url;
                            const status = item.data.status;

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (isUnread) {
                                            handleMarkAsRead(item.id, actionUrl);
                                        } else if (actionUrl) {
                                            router.visit(actionUrl);
                                        }
                                        setIsOpen(false);
                                    }}
                                    className={`px-4 py-3 flex items-start gap-3 hover:bg-[var(--tint-neutral)] transition-colors cursor-pointer group ${
                                        isUnread ? 'bg-[var(--tint-orange)]/30' : 'bg-transparent'
                                    }`}
                                >
                                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-[var(--tint-neutral)] flex items-center justify-center">
                                        {getNotificationIcon(item.data.notification_type, status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={`text-xs truncate ${isUnread ? 'font-bold text-[var(--ink)]' : 'font-medium text-[var(--ink)]'}`}>
                                                {title}
                                            </p>
                                            {isUnread && (
                                                <span className="w-2 h-2 rounded-full bg-[#EC7505] shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5 leading-snug">
                                            {message}
                                        </p>
                                        {item.data.review_feedback && (
                                            <p className="text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded px-1.5 py-0.5 mt-1 border border-rose-200 dark:border-rose-900 italic">
                                                "{item.data.review_feedback}"
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[10px] text-[var(--muted)]">
                                                {item.created_at_human || 'Recently'}
                                            </span>
                                            {actionUrl && (
                                                <span className="text-[10px] text-[var(--link-orange)] font-semibold flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View details
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--card)] text-center">
                    <Link
                        href="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-semibold text-[var(--link-orange)] hover:underline inline-block"
                    >
                        View all notifications
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
