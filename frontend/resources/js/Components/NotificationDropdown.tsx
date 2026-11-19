import React, { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import {
    Bell,
    CheckSquare,
    Clock,
    AlertCircle,
    CheckCircle2,
    Send,
    ClipboardCheck,
    Check,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';

function getNotificationIcon(type: string, status?: string) {
    if (type === 'task_assigned') {
        return <CheckSquare className="w-4 h-4 text-[color:var(--accent)] stroke-[2px]" />;
    }
    if (type === 'task_deadline_approaching') {
        return <Clock className="w-4 h-4 text-[color:var(--primary)] stroke-[2px]" />;
    }
    if (type === 'task_submitted_for_review') {
        return <Send className="w-4 h-4 text-[color:var(--secondary)] stroke-[2px]" />;
    }
    if (type === 'task_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-[color:var(--accent)] stroke-[2px]" />
        ) : (
            <AlertCircle className="w-4 h-4 text-[color:var(--primary)] stroke-[2px]" />
        );
    }
    if (type === 'activity_submitted_for_review') {
        return <ClipboardCheck className="w-4 h-4 text-[color:var(--secondary)] stroke-[2px]" />;
    }
    if (type === 'activity_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-4 h-4 text-[color:var(--accent)] stroke-[2px]" />
        ) : (
            <AlertCircle className="w-4 h-4 text-[color:var(--primary)] stroke-[2px]" />
        );
    }
    return <Bell className="w-4 h-4 text-[color:var(--primary)] stroke-[2px]" />;
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
                    className="relative p-2 rounded-[8px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                >
                    <Bell className="w-[18px] h-[18px] stroke-[2px]" />
                    {unreadCount > 0 && (
                        <span
                            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[color:var(--primary)] ring-2 ring-[color:var(--card)]"
                            title={`${unreadCount} unread`}
                        />
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-80 sm:w-96 p-0 border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--text)] rounded-[12px] overflow-hidden"
                style={{ boxShadow: 'none' }}
            >
                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-[13px] text-[color:var(--text)]">
                            Notifications
                        </span>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 text-[11px] font-semibold bg-[color:var(--status-danger-bg)] text-[color:var(--primary)] border border-[color:var(--status-danger-border)] rounded-full tabular-nums">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAll}
                            className="text-[12px] font-medium text-[color:var(--primary)] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-3.5 h-3.5" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* ── Notification List ── */}
                <div className="max-h-80 overflow-y-auto divide-y divide-[color:var(--border)]">
                    {items.length === 0 ? (
                        <div className="py-8 px-4 text-center">
                            <Bell className="w-6 h-6 mx-auto text-[color:var(--muted)] mb-2 stroke-[2px]" />
                            <p className="text-[13px] font-semibold text-[color:var(--text)]">You're up to date</p>
                            <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
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
                                    className={`px-4 py-3 flex items-start gap-3 hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer group ${
                                        isUnread ? 'bg-[color:color-mix(in_srgb,var(--primary)_5%,var(--card))]' : 'bg-transparent'
                                    }`}
                                >
                                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center">
                                        {getNotificationIcon(item.data.notification_type, status)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={`text-[13px] truncate ${isUnread ? 'font-semibold text-[color:var(--text)]' : 'font-normal text-[color:var(--text)]'}`}>
                                                {title}
                                            </p>
                                            {isUnread && (
                                                <span className="w-2 h-2 rounded-full bg-[color:var(--primary)] shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[12px] text-[color:var(--muted)] line-clamp-2 mt-0.5 leading-snug">
                                            {message}
                                        </p>
                                        {item.data.review_feedback && (
                                            <p className="text-[11px] text-[color:var(--status-danger-text)] bg-[color:var(--status-danger-bg)] rounded-[4px] px-2 py-0.5 mt-1 border border-[color:var(--status-danger-border)] italic">
                                                "{item.data.review_feedback}"
                                            </p>
                                        )}
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[11px] text-[color:var(--muted)] tabular-nums">
                                                {item.created_at_human || 'Recently'}
                                            </span>
                                            {actionUrl && (
                                                <span className="text-[11px] text-[color:var(--primary)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View details →
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
                <div className="px-4 py-2.5 border-t border-[color:var(--border)] bg-[color:var(--card)] text-center">
                    <Link
                        href="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="text-[12px] font-semibold text-[color:var(--primary)] hover:underline inline-block"
                    >
                        View all notifications
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
