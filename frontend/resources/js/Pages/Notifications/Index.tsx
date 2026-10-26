import React, { useState, useMemo } from 'react';
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
    FolderOpen,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { EmptyState } from '@/Components/EmptyState';
import { Pagination } from '@/Components/Pagination';

const CATEGORIES = ['All', 'Assignment', 'Deadline', 'Submission', 'Review', 'Completion'] as const;
type NotificationCategory = typeof CATEGORIES[number];

interface NotificationsPageProps {
    notifications: {
        data: NotificationItem[];
        current_page: number;
        last_page: number;
        next_page_url: string | null;
        prev_page_url: string | null;
        total: number;
        per_page?: number;
    };
    unreadCount: number;
}

function getNotificationCategory(item: NotificationItem): 'Assignment' | 'Deadline' | 'Submission' | 'Review' | 'Completion' {
    const type = item.data.notification_type || '';
    const status = (item.data.status || '').toLowerCase();
    const title = (item.data.title || '').toLowerCase();

    if (status === 'completed' || title.includes('approved') || title.includes('completed')) {
        return 'Completion';
    }
    if (type === 'task_deadline_approaching' || title.includes('deadline') || title.includes('due')) {
        return 'Deadline';
    }
    if (type === 'task_assigned' || title.includes('assigned')) {
        return 'Assignment';
    }
    if (type.includes('submitted') || title.includes('submission')) {
        return 'Submission';
    }
    if (type.includes('reviewed') || title.includes('returned') || title.includes('review')) {
        return 'Review';
    }
    return 'Assignment';
}

function matchesCategory(item: NotificationItem, category: NotificationCategory): boolean {
    if (category === 'All') return true;
    const cat = getNotificationCategory(item);
    if (cat === category) return true;
    if (category === 'Review' && (item.data.notification_type?.includes('reviewed') || item.data.title?.toLowerCase().includes('review'))) {
        return true;
    }
    return false;
}

function getDayGroup(createdDateStr: string): 'Today' | 'Yesterday' | 'Earlier this week' | 'Older' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    const itemDate = new Date(createdDateStr);
    const itemDateDay = new Date(itemDate);
    itemDateDay.setHours(0, 0, 0, 0);

    if (itemDateDay.getTime() === today.getTime()) {
        return 'Today';
    }
    if (itemDateDay.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }
    if (itemDateDay > oneWeekAgo) {
        return 'Earlier this week';
    }
    return 'Older';
}

export default function NotificationsIndex({
    notifications,
    unreadCount,
}: NotificationsPageProps) {
    const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('All');
    const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
    const [markingAll, setMarkingAll] = useState(false);

    const items = notifications.data || [];

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (unreadOnly && item.read_at) return false;
            return matchesCategory(item, selectedCategory);
        });
    }, [items, selectedCategory, unreadOnly]);

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

    // ── Notifications Grouped by Day (Requirement from Section 4) ──
    const groupedNotifications = useMemo(() => {
        const groups: Record<'Today' | 'Yesterday' | 'Earlier this week' | 'Older', NotificationItem[]> = {
            'Today': [],
            'Yesterday': [],
            'Earlier this week': [],
            'Older': [],
        };

        filteredItems.forEach((item) => {
            const groupKey = getDayGroup(item.created_at);
            groups[groupKey].push(item);
        });

        return (['Today', 'Yesterday', 'Earlier this week', 'Older'] as const)
            .map((key) => ({
                title: key,
                items: groups[key],
            }))
            .filter((g) => g.items.length > 0);
    }, [filteredItems]);

    // Server-side pagination handlers
    const handlePageChange = (page: number) => {
        router.get(
            '/notifications',
            { page },
            { preserveState: true, preserveScroll: true }
        );
    };

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Notifications" />

            <div className="space-y-6">
                {/* ══ 1. Page Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            Notifications
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            {unreadCount > 0
                                ? `You have ${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}.`
                                : 'All notifications have been reviewed.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="secondary"
                            size="md"
                            disabled={unreadCount === 0 || markingAll}
                            onClick={handleMarkAllRead}
                        >
                            <Check className="w-4 h-4 mr-1.5" strokeWidth={2} />
                            <span>Mark all as read</span>
                        </Button>
                    </div>
                </div>

                {/* ══ 2. Category & Filter Bar ══ */}
                <Card className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {CATEGORIES.map((cat) => {
                                const isActive = selectedCategory === cat;
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
                                            isActive
                                                ? 'bg-[color:var(--primary)] text-white'
                                                : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setUnreadOnly(!unreadOnly)}
                                className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium border transition-colors cursor-pointer ${
                                    unreadOnly
                                        ? 'bg-[color:var(--primary)] text-white border-[color:var(--primary)]'
                                        : 'border-[color:var(--border)] text-[color:var(--muted)] hover:text-[color:var(--text)] bg-[color:var(--card)]'
                                }`}
                            >
                                Unread only {unreadCount > 0 && `(${unreadCount})`}
                            </button>
                        </div>
                    </div>
                </Card>

                {/* ══ 3. Notifications Grouped by Day (Today, Yesterday, Earlier this week, Older) ══ */}
                {filteredItems.length === 0 ? (
                    <EmptyState
                        title="No notifications"
                        description={unreadOnly ? 'You have read all your notifications.' : 'No alerts have been logged for your account yet.'}
                        actionLabel={unreadOnly ? 'Show all notifications' : undefined}
                        onAction={unreadOnly ? () => setUnreadOnly(false) : undefined}
                    />
                ) : (
                    <div className="space-y-6">
                        {groupedNotifications.map((group) => (
                            <div key={group.title} className="space-y-3">
                                <h2 className="text-[14px] font-bold uppercase tracking-wider text-[color:var(--muted)] px-1">
                                    {group.title}
                                </h2>

                                <Card className="divide-y divide-[color:var(--border)] overflow-hidden">
                                    {group.items.map((item) => {
                                        const isUnread = !item.read_at;
                                        const category = getNotificationCategory(item);

                                        return (
                                            <div
                                                key={item.id}
                                                className={`p-4 flex items-start gap-3.5 transition-colors ${
                                                    isUnread
                                                        ? 'bg-[color:var(--soft-surface)] border-l-4 border-l-[color:var(--primary)]'
                                                        : 'hover:bg-[color:var(--soft-surface)]/50'
                                                }`}
                                            >
                                                {/* Category Icon */}
                                                <div className="w-8 h-8 rounded-[6px] bg-[color:var(--card)] border border-[color:var(--border)] flex items-center justify-center shrink-0 mt-0.5 text-[color:var(--primary)]">
                                                    <Bell className="w-4 h-4 stroke-[2]" />
                                                </div>

                                                {/* Notification Content */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={`text-[14px] ${isUnread ? 'font-bold' : 'font-semibold'} text-[color:var(--text)]`}>
                                                                {item.data.title || 'Notification'}
                                                            </h3>
                                                            <Badge variant={category === 'Completion' ? 'accent' : category === 'Deadline' ? 'danger' : 'secondary'}>
                                                                {category}
                                                            </Badge>
                                                        </div>

                                                        <span className="text-[12px] text-[color:var(--muted)] tabular-nums shrink-0">
                                                            {item.created_at}
                                                        </span>
                                                    </div>

                                                    <p className="text-[13px] text-[color:var(--muted)] mt-1 leading-relaxed">
                                                        {item.data.message}
                                                    </p>

                                                    {/* Context & Actions */}
                                                    <div className="flex items-center gap-3 mt-2 text-[12px]">
                                                        {item.data.project && (
                                                            <span className="font-medium text-[color:var(--text)]">
                                                                {item.data.project.title}
                                                            </span>
                                                        )}

                                                        {item.data.action_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkAsRead(item.id, item.data.action_url)}
                                                                className="font-semibold text-[color:var(--primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
                                                            >
                                                                <span>View details</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        )}

                                                        {isUnread && !item.data.action_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkAsRead(item.id)}
                                                                className="font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer"
                                                            >
                                                                Mark as read
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </Card>
                            </div>
                        ))}

                        {/* Server-side Pagination */}
                        {notifications.total > 0 && (
                            <Card className="p-4 flex justify-center w-full">
                                <Pagination
                                    currentPage={notifications.current_page}
                                    totalPages={notifications.last_page}
                                    totalItems={notifications.total}
                                    pageSize={notifications.per_page || 15}
                                    onPageChange={handlePageChange}
                                />
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
