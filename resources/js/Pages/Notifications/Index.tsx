import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { NotificationItem } from '@/types';
import {
    Bell,
    Check,
    CheckSquare,
    Clock,
    AlertCircle,
    CheckCircle2,
    Send,
    ClipboardCheck,
    ExternalLink,
    Filter,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { EmptyState } from '@/Components/EmptyState';

interface NotificationsPageProps {
    notifications: {
        data: NotificationItem[];
        current_page: number;
        last_page: number;
        next_page_url: string | null;
        prev_page_url: string | null;
        total: number;
    };
    unreadCount: number;
}

function getNotificationIcon(type: string, status?: string) {
    if (type === 'task_assigned') {
        return <CheckSquare className="w-5 h-5 text-emerald-600" />;
    }
    if (type === 'task_deadline_approaching') {
        return <Clock className="w-5 h-5 text-amber-600" />;
    }
    if (type === 'task_submitted_for_review') {
        return <Send className="w-5 h-5 text-blue-600" />;
    }
    if (type === 'task_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
        );
    }
    if (type === 'activity_submitted_for_review') {
        return <ClipboardCheck className="w-5 h-5 text-indigo-600" />;
    }
    if (type === 'activity_reviewed') {
        return status === 'Completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
        );
    }
    return <Bell className="w-5 h-5 text-[color:var(--color-brand-action-orange)]" />;
}

export default function NotificationsIndex({
    notifications,
    unreadCount,
}: NotificationsPageProps) {
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [markingAll, setMarkingAll] = useState(false);

    const items = notifications.data || [];
    const displayedItems = filter === 'unread'
        ? items.filter((n) => !n.read_at)
        : items;

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

    const handleMarkAllRead = () => {
        if (unreadCount === 0 || markingAll) return;
        setMarkingAll(true);
        router.post(
            '/notifications/mark-all-read',
            {},
            {
                preserveScroll: true,
                onFinish: () => setMarkingAll(false),
            }
        );
    };

    return (
        <AppLayout
            title="Notifications"
            subtitle="Updates, task assignments, reviews, and reminders"
        >
            <Head title="Notifications" />

            <div className="space-y-6 max-w-4xl mx-auto">
                {/* ── Top Bar Controls ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[color:var(--color-border-light)] shadow-xs">
                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                                filter === 'all'
                                    ? 'bg-white text-slate-800 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            All ({notifications.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('unread')}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                filter === 'unread'
                                    ? 'bg-white text-slate-800 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Unread
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Actions */}
                    {unreadCount > 0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleMarkAllRead}
                            disabled={markingAll}
                            className="text-xs"
                        >
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                            Mark all as read
                        </Button>
                    )}
                </div>

                {/* ── Notifications List ── */}
                {displayedItems.length === 0 ? (
                    <EmptyState
                        icon={<Bell className="w-6 h-6 text-slate-400" />}
                        title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                        description={
                            filter === 'unread'
                                ? 'You have read all your notifications. Switch to "All" to review past updates.'
                                : 'When tasks are assigned, reviewed, or deadlines approach, you will receive updates here.'
                        }
                    />
                ) : (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] divide-y divide-[color:var(--color-border-light)] shadow-xs overflow-hidden">
                        {displayedItems.map((item) => {
                            const isUnread = !item.read_at;
                            const title = item.data.title || 'Notification';
                            const message = item.data.message || '';
                            const actionUrl = item.data.action_url;
                            const status = item.data.status;
                            const projectTitle = item.data.project?.title;
                            const committeeName = item.data.committee?.name;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                                        isUnread ? 'bg-orange-50/30' : 'bg-white'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                        {getNotificationIcon(item.data.notification_type, status)}
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                                                        {title}
                                                    </h3>
                                                    {isUnread && (
                                                        <span className="w-2 h-2 rounded-full bg-[color:var(--color-brand-action-orange)] shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                                    {message}
                                                </p>
                                            </div>

                                            <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">
                                                {item.created_at_human || 'Recently'}
                                            </span>
                                        </div>

                                        {/* Review feedback callout */}
                                        {item.data.review_feedback && (
                                            <div className="mt-2.5 p-3 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-800">
                                                <p className="font-semibold text-[11px] uppercase tracking-wider text-rose-700 mb-0.5">
                                                    Reviewer Feedback
                                                </p>
                                                <p className="italic">"{item.data.review_feedback}"</p>
                                            </div>
                                        )}

                                        {/* Metadata Tags & Actions */}
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                                {projectTitle && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-700">
                                                        {projectTitle}
                                                    </span>
                                                )}
                                                {committeeName && (
                                                    <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-600">
                                                        {committeeName}
                                                    </span>
                                                )}
                                                {item.data.task?.due_date && (
                                                    <span className="text-slate-500">
                                                        Due: {item.data.task.due_date}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {isUnread && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMarkAsRead(item.id)}
                                                        className="text-xs text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                                                    >
                                                        Mark as read
                                                    </button>
                                                )}
                                                {actionUrl && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (isUnread) {
                                                                handleMarkAsRead(item.id, actionUrl);
                                                            } else {
                                                                router.visit(actionUrl);
                                                            }
                                                        }}
                                                        className="text-xs flex items-center gap-1"
                                                    >
                                                        <span>View Details</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Pagination ── */}
                {notifications.last_page > 1 && (
                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-[color:var(--color-border-light)] text-xs text-slate-600">
                        <span>
                            Page {notifications.current_page} of {notifications.last_page} ({notifications.total} total)
                        </span>
                        <div className="flex items-center gap-2">
                            {notifications.prev_page_url && (
                                <Link
                                    href={notifications.prev_page_url}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium"
                                >
                                    Previous
                                </Link>
                            )}
                            {notifications.next_page_url && (
                                <Link
                                    href={notifications.next_page_url}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium"
                                >
                                    Next
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
