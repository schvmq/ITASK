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
    Users,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { EmptyState } from '@/Components/EmptyState';

// ─── Types & Constants ────────────────────────────────────────────────────────

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
    };
    unreadCount: number;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    Assignment: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Deadline:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    Submission: { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200' },
    Review:     { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
    Completion: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
};

function getNotificationCategory(item: NotificationItem): 'Assignment' | 'Deadline' | 'Submission' | 'Review' | 'Completion' {
    const type = item.data.notification_type || '';
    const status = (item.data.status || '').toLowerCase();
    const title = (item.data.title || '').toLowerCase();

    // Completion: approved/completed tasks or activities
    if (status === 'completed' || title.includes('approved') || title.includes('completed')) {
        return 'Completion';
    }
    // Deadline
    if (type === 'task_deadline_approaching' || title.includes('deadline') || title.includes('due')) {
        return 'Deadline';
    }
    // Assignment
    if (type === 'task_assigned' || title.includes('assigned')) {
        return 'Assignment';
    }
    // Submission
    if (type.includes('submitted') || title.includes('submission')) {
        return 'Submission';
    }
    // Review: reviewed, returned for revision, review requested
    if (type.includes('reviewed') || title.includes('returned') || title.includes('review')) {
        return 'Review';
    }
    return 'Assignment';
}

function matchesCategory(item: NotificationItem, category: NotificationCategory): boolean {
    if (category === 'All') return true;
    const cat = getNotificationCategory(item);
    if (cat === category) return true;

    // Completed reviews also belong under Review
    if (category === 'Review' && (item.data.notification_type?.includes('reviewed') || item.data.title?.toLowerCase().includes('review'))) {
        return true;
    }
    return false;
}

function getCategoryIcon(category: string, status?: string) {
    switch (category) {
        case 'Assignment':
            return <CheckSquare className="w-4 h-4 text-emerald-600" />;
        case 'Deadline':
            return <Clock className="w-4 h-4 text-amber-600" />;
        case 'Submission':
            return <Send className="w-4 h-4 text-sky-600" />;
        case 'Review':
            return status === 'Returned' ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : (
                <ClipboardCheck className="w-4 h-4 text-purple-600" />
            );
        case 'Completion':
            return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
        default:
            return <Bell className="w-4 h-4 text-[color:var(--color-brand-action-orange)]" />;
    }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationsIndex({
    notifications,
    unreadCount,
}: NotificationsPageProps) {
    const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('All');
    const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
    const [markingAll, setMarkingAll] = useState(false);

    const items = notifications.data || [];

    // Filter items based on active category and unread toggle
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (unreadOnly && item.read_at) return false;
            return matchesCategory(item, selectedCategory);
        });
    }, [items, selectedCategory, unreadOnly]);

    // Compute counts per category from current items
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: items.length };
        CATEGORIES.forEach((cat) => {
            if (cat !== 'All') {
                counts[cat] = items.filter((item) => matchesCategory(item, cat)).length;
            }
        });
        return counts;
    }, [items]);

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

    // Header Action: "Mark all as read" button aligned to the right of page header
    const markAllReadAction = (
        <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs ${
                unreadCount > 0 && !markingAll
                    ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                    : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
            }`}
        >
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mark all as read</span>
        </button>
    );

    return (
        <AppLayout
            title="Notifications"
            subtitle={
                unreadCount > 0
                    ? `${unreadCount} unread ${unreadCount === 1 ? 'notification' : 'notifications'}`
                    : 'All caught up · No unread notifications'
            }
            headerAction={markAllReadAction}
        >
            <Head title="Notifications — ITASK" />

            <div className="w-full max-w-5xl mx-auto space-y-4">

                {/* ── Category Filters Toolbar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.03)]">
                    {/* Compact Filter Buttons: All, Assignment, Deadline, Submission, Review, Completion */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {CATEGORIES.map((category) => {
                            const isSelected = selectedCategory === category;
                            const count = categoryCounts[category] ?? 0;

                            return (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                        isSelected
                                            ? 'bg-[color:var(--color-brand-dark-green)] text-white shadow-xs'
                                            : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
                                    }`}
                                >
                                    <span>{category}</span>
                                    {count > 0 && (
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                                isSelected
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Unread Only Toggle */}
                    <div className="flex items-center self-end sm:self-auto shrink-0">
                        <button
                            type="button"
                            onClick={() => setUnreadOnly(!unreadOnly)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                unreadOnly
                                    ? 'bg-[color:var(--color-brand-action-orange)] text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-transparent'
                            }`}
                        >
                            <span>Unread Only</span>
                            {unreadCount > 0 && (
                                <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                        unreadOnly
                                            ? 'bg-white/20 text-white'
                                            : 'bg-orange-100 text-orange-800'
                                    }`}
                                >
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Notifications List ── */}
                {filteredItems.length === 0 ? (
                    <EmptyState
                        icon={<Bell className="w-7 h-7 text-slate-400" />}
                        title={
                            unreadOnly
                                ? 'No unread notifications'
                                : selectedCategory === 'All'
                                ? 'No notifications yet'
                                : `No ${selectedCategory.toLowerCase()} notifications`
                        }
                        description={
                            unreadOnly
                                ? 'You have read all notifications in this category. Toggle "Unread Only" to review all.'
                                : selectedCategory === 'All'
                                ? 'When tasks are assigned, reviewed, or deadlines approach, you will receive updates here.'
                                : `There are currently no ${selectedCategory.toLowerCase()} updates on your account.`
                        }
                    />
                ) : (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] divide-y divide-slate-100 shadow-[0_1px_3px_0_rgb(0,0,0,0.03)] overflow-hidden">
                        {filteredItems.map((item) => {
                            const isUnread = !item.read_at;
                            const title = item.data.title || 'Notification';
                            const message = item.data.message || '';
                            const actionUrl = item.data.action_url;
                            const status = item.data.status;
                            const projectTitle = item.data.project?.title;
                            const committeeName = item.data.committee?.name;
                            const category = getNotificationCategory(item);
                            const badgeStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.Assignment;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 sm:p-4.5 flex items-start gap-3.5 transition-colors ${
                                        isUnread
                                            ? 'bg-orange-50/25 border-l-4 border-l-[color:var(--color-brand-action-orange)]'
                                            : 'bg-white hover:bg-slate-50/70 border-l-4 border-l-transparent'
                                    }`}
                                >
                                    {/* Notification Category Icon */}
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                                            isUnread
                                                ? 'bg-white shadow-2xs'
                                                : 'bg-slate-50 border-slate-200/70'
                                        }`}
                                    >
                                        {getCategoryIcon(category, status)}
                                    </div>

                                    {/* Main Notification Body */}
                                    <div className="flex-1 min-w-0">
                                        {/* Header Row: Title, Category Badge, Unread Dot, Timestamp */}
                                        <div className="flex items-start justify-between gap-2.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3
                                                        className={`text-xs sm:text-sm leading-snug ${
                                                            isUnread
                                                                ? 'font-bold text-slate-900'
                                                                : 'font-semibold text-slate-700'
                                                        }`}
                                                    >
                                                        {title}
                                                    </h3>

                                                    {/* Category / Type Badge */}
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                                                    >
                                                        {category}
                                                    </span>

                                                    {/* Unread Indicator */}
                                                    {isUnread && (
                                                        <span
                                                            className="w-2 h-2 rounded-full bg-[color:var(--color-brand-action-orange)] shrink-0"
                                                            title="Unread notification"
                                                        />
                                                    )}
                                                </div>

                                                <p
                                                    className={`text-xs leading-relaxed ${
                                                        isUnread ? 'text-slate-800' : 'text-slate-500'
                                                    }`}
                                                >
                                                    {message}
                                                </p>
                                            </div>

                                            {/* Timestamp */}
                                            <span className="text-[11px] text-slate-400 font-medium shrink-0 whitespace-nowrap pt-0.5">
                                                {item.created_at_human || 'Recently'}
                                            </span>
                                        </div>

                                        {/* Reviewer Feedback Callout */}
                                        {item.data.review_feedback && (
                                            <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50/80 border border-rose-100 text-xs text-rose-800">
                                                <p className="font-bold text-[10px] uppercase tracking-wider text-rose-700 mb-0.5">
                                                    Reviewer Feedback
                                                </p>
                                                <p className="italic">"{item.data.review_feedback}"</p>
                                            </div>
                                        )}

                                        {/* Metadata Breadcrumbs & Action Buttons */}
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                                {projectTitle && (
                                                    <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded font-medium text-slate-700">
                                                        <FolderOpen className="w-3 h-3 text-slate-400" />
                                                        <span className="truncate max-w-[160px]">{projectTitle}</span>
                                                    </span>
                                                )}
                                                {committeeName && (
                                                    <span className="inline-flex items-center gap-1 bg-slate-100/80 px-2 py-0.5 rounded font-medium text-slate-600">
                                                        <Users className="w-3 h-3 text-slate-400" />
                                                        <span className="truncate max-w-[140px]">{committeeName}</span>
                                                    </span>
                                                )}
                                                {item.data.task?.due_date && (
                                                    <span className="inline-flex items-center gap-1 text-slate-500">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <span>Due: {item.data.task.due_date}</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Actions */}
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
                    <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-[color:var(--color-border-light)] text-xs text-slate-600 shadow-2xs">
                        <span>
                            Page {notifications.current_page} of {notifications.last_page} ({notifications.total} total)
                        </span>
                        <div className="flex items-center gap-2">
                            {notifications.prev_page_url && (
                                <Link
                                    href={notifications.prev_page_url}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
                                >
                                    Previous
                                </Link>
                            )}
                            {notifications.next_page_url && (
                                <Link
                                    href={notifications.next_page_url}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 transition-colors"
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
