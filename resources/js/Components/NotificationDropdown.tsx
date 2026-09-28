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
        return <CheckSquare className="w-4 h-4 text-emerald-600" />;
    }
    if (type === 'task_deadline_approaching') {
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
    if (type === 'task_submitted_for_review') {
        return <Send className="w-4 h-4 text-blue-600" />;
    }
    if (type === 'task_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
        );
    }
    if (type === 'activity_submitted_for_review') {
        return <ClipboardCheck className="w-4 h-4 text-indigo-600" />;
    }
    if (type === 'activity_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
        );
    }
    return <Bell className="w-4 h-4 text-[color:var(--color-brand-action-orange)]" />;
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
                    className="relative p-2 rounded-lg text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors cursor-pointer"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadCount > 0 && (
                        <span
                            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full ring-2 ring-white"
                            style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 shadow-lg border border-[color:var(--color-border-light)] bg-white rounded-xl">
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border-light)] bg-[color:var(--color-surface-subtle)] rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[color:var(--color-text-main)]">
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-800 rounded-full">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAll}
                            className="text-[11px] font-medium text-[color:var(--color-brand-action-orange)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-3 h-3" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* ── Notification List ── */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[color:var(--color-border-light)]">
                    {items.length === 0 ? (
                        <div className="py-8 px-4 text-center">
                            <Bell className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                            <p className="text-xs font-medium text-slate-500">No notifications yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                You'll be notified of task assignments and reviews here.
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
                                    className={`px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--color-surface-subtle)] transition-colors cursor-pointer group ${
                                        isUnread ? 'bg-orange-50/40' : 'bg-white'
                                    }`}
                                >
                                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                                        {getNotificationIcon(item.data.notification_type, status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={`text-xs truncate ${isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                {title}
                                            </p>
                                            {isUnread && (
                                                <span className="w-2 h-2 rounded-full bg-[color:var(--color-brand-action-orange)] shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                            {message}
                                        </p>
                                        {item.data.review_feedback && (
                                            <p className="text-[10px] text-rose-600 bg-rose-50 rounded px-1.5 py-0.5 mt-1 border border-rose-100 italic">
                                                "{item.data.review_feedback}"
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[10px] text-slate-400">
                                                {item.created_at_human || 'Recently'}
                                            </span>
                                            {actionUrl && (
                                                <span className="text-[10px] text-[color:var(--color-brand-action-orange)] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View <ExternalLink className="w-2.5 h-2.5" />
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
                <div className="px-4 py-2.5 border-t border-[color:var(--color-border-light)] bg-white text-center rounded-b-xl">
                    <Link
                        href="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-block"
                    >
                        View all notifications
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
