import React, { useMemo } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    PageProps,
    DashboardProject,
    DashboardCommittee,
    DashboardTask,
    PendingReviewItem,
    DashboardStats,
    NotificationItem,
} from '@/types';
import {
    CheckCircle2,
    AlertCircle,
    Clock,
    ClipboardCheck,
    ChevronRight,
    ArrowRight,
    AlertTriangle,
    Bell,
    ExternalLink,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';

interface DashboardPageProps {
    primaryRole?: string;
    stats?: DashboardStats;
    projects?: DashboardProject[];
    committees?: DashboardCommittee[];
    assignedTasks?: DashboardTask[];
    pendingReviews?: PendingReviewItem[];
    recentNotifications?: NotificationItem[];
    unreadNotificationsCount?: number;
}

export default function Welcome({
    primaryRole = 'Project Member',
    projects = [],
    assignedTasks = [],
    pendingReviews = [],
    recentNotifications = [],
    unreadNotificationsCount = 0,
}: DashboardPageProps) {
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;
    const firstName = user?.name?.split(' ')[0] ?? 'there';

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const isLeader = primaryRole === 'Project Leader';
    const isStaff = primaryRole === 'Project Staff';
    const isMember = primaryRole === 'Project Member';

    // ── Build actionable "Needs Your Attention" items based on role & workflow ──
    const attentionItems = useMemo(() => {
        const items: Array<{
            id: string;
            type: 'pending_review' | 'returned_task' | 'overdue_task' | 'approaching_task';
            title: string;
            projectTitle: string;
            committeeName?: string;
            activityTitle?: string;
            actionUrl: string;
            actionLabel: string;
            urgency: 'critical' | 'urgent' | 'warning';
            badgeLabel: string;
            actionReason: string;
            dateFormatted?: string;
        }> = [];

        // 1. Returned tasks (highest priority: member needs to revise and resubmit)
        assignedTasks
            .filter((task) => task.status === 'Returned')
            .forEach((task) => {
                items.push({
                    id: `returned-${task.id}`,
                    type: 'returned_task',
                    title: task.title,
                    projectTitle: task.project.title,
                    committeeName: task.committee.name,
                    activityTitle: task.activity.title,
                    actionUrl: task.action_url,
                    actionLabel: 'Revise Task',
                    urgency: 'critical',
                    badgeLabel: 'Revision Required',
                    actionReason: 'Returned by reviewer with notes. Please update deliverables and resubmit.',
                    dateFormatted: task.due_date_formatted,
                });
            });

        // 2. Pending reviews (for Staff and Leader: review queue)
        if (isStaff || isLeader) {
            pendingReviews.forEach((review) => {
                items.push({
                    id: `review-${review.type}-${review.id}`,
                    type: 'pending_review',
                    title: review.title,
                    projectTitle: review.project.title,
                    committeeName: review.committee.name,
                    activityTitle: review.activity.title,
                    actionUrl: review.action_url,
                    actionLabel: review.type === 'task' ? 'Review Task' : 'Review Activity',
                    urgency: 'urgent',
                    badgeLabel: 'Review Needed',
                    actionReason: `Submitted by ${review.submitted_by} · Awaiting your approval`,
                    dateFormatted: review.updated_at,
                });
            });
        }

        // 3. Overdue assigned tasks
        assignedTasks
            .filter(
                (task) =>
                    task.is_overdue &&
                    task.status !== 'Completed' &&
                    task.status !== 'Returned'
            )
            .forEach((task) => {
                items.push({
                    id: `overdue-${task.id}`,
                    type: 'overdue_task',
                    title: task.title,
                    projectTitle: task.project.title,
                    committeeName: task.committee.name,
                    activityTitle: task.activity.title,
                    actionUrl: task.action_url,
                    actionLabel: 'Open Task',
                    urgency: 'critical',
                    badgeLabel: 'Overdue',
                    actionReason: `Past deadline (${task.due_date_formatted}). Complete and submit deliverables.`,
                    dateFormatted: task.due_date_formatted,
                });
            });

        // 4. Tasks approaching due date (within 2 days)
        assignedTasks
            .filter(
                (task) =>
                    task.is_approaching &&
                    task.status !== 'Completed' &&
                    task.status !== 'Returned' &&
                    !task.is_overdue
            )
            .forEach((task) => {
                items.push({
                    id: `approaching-${task.id}`,
                    type: 'approaching_task',
                    title: task.title,
                    projectTitle: task.project.title,
                    committeeName: task.committee.name,
                    activityTitle: task.activity.title,
                    actionUrl: task.action_url,
                    actionLabel: 'Open Task',
                    urgency: 'warning',
                    badgeLabel: 'Due Soon',
                    actionReason: `Due ${task.due_date_formatted}. Work on task deliverables.`,
                    dateFormatted: task.due_date_formatted,
                });
            });

        return items;
    }, [assignedTasks, pendingReviews, isStaff, isLeader]);

    // Limit displayed attention items to keep dashboard scannable
    const displayedAttentionItems = attentionItems.slice(0, 5);

    // Active ongoing projects (compact summary, max 4)
    const activeProjects = useMemo(() => {
        return projects.filter((p) => p.status !== 'Archived').slice(0, 4);
    }, [projects]);

    // Upcoming deadlines (compact chronological list of incomplete tasks with due dates)
    const upcomingDeadlines = useMemo(() => {
        return assignedTasks
            .filter((task) => task.status !== 'Completed' && task.due_date)
            .sort((a, b) => {
                const dateA = a.due_date || '9999-99-99';
                const dateB = b.due_date || '9999-99-99';
                return dateA.localeCompare(dateB);
            })
            .slice(0, 4);
    }, [assignedTasks]);

    // Recent notifications preview (max 4)
    const displayedNotifications = useMemo(() => {
        return recentNotifications.slice(0, 4);
    }, [recentNotifications]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Dashboard" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* ── Prototype-Style Clean Hero ── */}
                <div className="pt-1">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--color-text-main)]">
                        {greeting}, {firstName} 👋
                    </h1>
                    <p className="text-xs sm:text-sm text-[color:var(--color-text-muted)] mt-1">
                        Here's what needs your attention today.
                    </p>
                </div>

                {/* ── Main Two-Column Dashboard Layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column (2 cols on lg): Action-Oriented Core */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* 1. Needs Your Attention (PRIMARY SECTION) */}
                        <section
                            aria-labelledby="attention-heading"
                            className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-xs"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[color:var(--color-border-light)]">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2
                                            id="attention-heading"
                                            className="text-base font-bold text-[color:var(--color-text-main)]"
                                        >
                                            Needs Your Attention
                                        </h2>
                                        {attentionItems.length > 0 && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                {attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        {isMember && 'Tasks requiring revision, approaching deadlines, or action.'}
                                        {isStaff && 'Committee review queue, revision requests, and urgent deliverables.'}
                                        {isLeader && 'Project review queue, deliverables, and items requiring your decision.'}
                                    </p>
                                </div>

                                {attentionItems.length > 0 && (
                                    <Link
                                        href="/my-tasks"
                                        className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-1 self-start sm:self-center"
                                    >
                                        <span>View all in My Tasks</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                )}
                            </div>

                            {/* Attention Items List or Compact Caught-Up State */}
                            {attentionItems.length === 0 ? (
                                <div className="py-3 px-4 rounded-lg bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <span className="text-xs font-semibold text-[color:var(--color-text-main)]">
                                                You're all caught up.
                                            </span>
                                            <span className="text-xs text-[color:var(--color-text-muted)] ml-1.5 hidden sm:inline">
                                                Nothing currently requires your attention.
                                            </span>
                                            <p className="text-[11px] text-[color:var(--color-text-muted)] sm:hidden mt-0.5">
                                                Nothing currently requires your attention.
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/my-tasks"
                                        className="text-xs font-medium text-[color:var(--color-brand-action-orange)] hover:underline shrink-0"
                                    >
                                        View My Tasks →
                                    </Link>
                                </div>
                            ) : (
                                <div className="divide-y divide-[color:var(--color-border-light)]">
                                    {displayedAttentionItems.map((item) => {
                                        const isCritical = item.urgency === 'critical';
                                        const isUrgent = item.urgency === 'urgent';

                                        return (
                                            <div
                                                key={item.id}
                                                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-[color:var(--color-surface-subtle)] px-2 sm:px-3 -mx-2 sm:-mx-3 rounded-lg transition-colors"
                                            >
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <div
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                                                            isCritical
                                                                ? 'bg-rose-50 border-rose-200 text-rose-600'
                                                                : isUrgent
                                                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                                                : 'bg-orange-50 border-orange-200 text-[color:var(--color-brand-action-orange)]'
                                                        }`}
                                                    >
                                                        {item.type === 'pending_review' ? (
                                                            <ClipboardCheck className="w-4 h-4" />
                                                        ) : item.type === 'returned_task' ? (
                                                            <AlertCircle className="w-4 h-4" />
                                                        ) : item.type === 'overdue_task' ? (
                                                            <Clock className="w-4 h-4" />
                                                        ) : (
                                                            <AlertTriangle className="w-4 h-4" />
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge
                                                                variant={
                                                                    isCritical
                                                                        ? 'danger'
                                                                        : isUrgent
                                                                        ? 'warning'
                                                                        : 'primary'
                                                                }
                                                            >
                                                                {item.badgeLabel}
                                                            </Badge>
                                                            <h3 className="text-xs sm:text-sm font-semibold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate">
                                                                {item.title}
                                                            </h3>
                                                        </div>

                                                        {/* Context: Project, Committee, Activity */}
                                                        <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1 truncate">
                                                            <span className="font-medium text-[color:var(--color-text-main)]">
                                                                {item.projectTitle}
                                                            </span>
                                                            {item.committeeName && ` · ${item.committeeName}`}
                                                            {item.activityTitle && ` · ${item.activityTitle}`}
                                                        </p>

                                                        {/* Action Reason */}
                                                        <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                            {item.actionReason}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 sm:self-center shrink-0 pl-11 sm:pl-0">
                                                    <Link href={item.actionUrl}>
                                                        <Button
                                                            variant={isCritical ? 'primary' : 'outline'}
                                                            size="sm"
                                                            className="text-xs"
                                                        >
                                                            <span>{item.actionLabel}</span>
                                                            <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {attentionItems.length > 5 && (
                                <div className="mt-4 pt-3 border-t border-[color:var(--color-border-light)] flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                                    <span>Showing 5 of {attentionItems.length} actionable items</span>
                                    <Link
                                        href="/my-tasks"
                                        className="font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>View all in My Tasks</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            )}
                        </section>

                        {/* 2. Your Projects (REDUCED VISUAL WEIGHT & COMPACT) */}
                        <section
                            aria-labelledby="projects-heading"
                            className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-xs"
                        >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[color:var(--color-border-light)]">
                                <div>
                                    <h2
                                        id="projects-heading"
                                        className="text-sm font-bold text-[color:var(--color-text-main)]"
                                    >
                                        Your Projects
                                    </h2>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Summary of your current and ongoing projects
                                    </p>
                                </div>
                                <Link
                                    href="/projects"
                                    className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-1"
                                >
                                    <span>View all projects</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {activeProjects.length === 0 ? (
                                <div className="py-3 px-4 rounded-lg bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-subtle)] flex items-center justify-between gap-3 text-xs">
                                    <span className="text-[color:var(--color-text-muted)]">
                                        No active projects yet.
                                    </span>
                                    <Link
                                        href="/projects"
                                        className="font-medium text-[color:var(--color-brand-action-orange)] hover:underline shrink-0"
                                    >
                                        Browse Projects →
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {activeProjects.map((proj) => (
                                        <div
                                            key={proj.id}
                                            className="p-3 rounded-lg border border-[color:var(--color-border-light)] hover:border-[color:var(--color-border-dark)] transition-colors group bg-white"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link
                                                            href={`/projects/${proj.id}`}
                                                            className="text-xs font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate"
                                                        >
                                                            {proj.title}
                                                        </Link>
                                                        <ProjectRoleBadge role={proj.role} />
                                                    </div>
                                                    {proj.end_date && (
                                                        <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1 flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-[color:var(--color-text-subtle)]" />
                                                            <span>Deadline: {proj.end_date}</span>
                                                        </p>
                                                    )}
                                                </div>

                                                <Link
                                                    href={`/projects/${proj.id}`}
                                                    className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-0.5 shrink-0 pt-0.5"
                                                >
                                                    <span>Open</span>
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>

                                            {/* Progress Bar & Percentage */}
                                            <div className="mt-2.5">
                                                <div className="flex items-center justify-between text-[11px] mb-1">
                                                    <span className="text-[color:var(--color-text-muted)]">Progress</span>
                                                    <span className="font-semibold text-[color:var(--color-text-main)]">
                                                        {proj.progressPercentage}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${proj.progressPercentage}%`,
                                                            backgroundColor: 'var(--color-brand-dark-green)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Column (1 col on lg): Deadlines & Notifications */}
                    <div className="space-y-6">
                        {/* 3. Upcoming Deadlines */}
                        <section
                            aria-labelledby="deadlines-heading"
                            className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs"
                        >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[color:var(--color-border-light)]">
                                <div>
                                    <h2
                                        id="deadlines-heading"
                                        className="text-sm font-bold text-[color:var(--color-text-main)]"
                                    >
                                        Upcoming Deadlines
                                    </h2>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Approaching task deliverables
                                    </p>
                                </div>
                                <Link
                                    href="/calendar"
                                    className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-1"
                                >
                                    <span>Calendar</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {upcomingDeadlines.length === 0 ? (
                                <div className="py-6 px-3 text-center">
                                    <Clock className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                                    <p className="text-xs text-[color:var(--color-text-muted)]">No upcoming deadlines</p>
                                    <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">
                                        All deliverables are completed or have no scheduled deadline.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[color:var(--color-border-light)]">
                                    {upcomingDeadlines.map((task) => {
                                        const isOverdue = task.is_overdue;
                                        const isApproaching = task.is_approaching;

                                        return (
                                            <div
                                                key={task.id}
                                                className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 group"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                isOverdue
                                                                    ? 'bg-rose-500'
                                                                    : isApproaching
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-emerald-500'
                                                            }`}
                                                            title={isOverdue ? 'Overdue' : isApproaching ? 'Due Soon' : 'Upcoming'}
                                                        />
                                                        <Link
                                                            href={task.action_url}
                                                            className="text-xs font-semibold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate"
                                                        >
                                                            {task.title}
                                                        </Link>
                                                    </div>
                                                    <p className="text-[11px] text-[color:var(--color-text-muted)] truncate pl-3 mt-0.5">
                                                        {task.project.title}
                                                    </p>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span
                                                        className={`text-xs font-medium block ${
                                                            isOverdue
                                                                ? 'text-rose-600 font-semibold'
                                                                : isApproaching
                                                                ? 'text-amber-600 font-semibold'
                                                                : 'text-[color:var(--color-text-main)]'
                                                        }`}
                                                    >
                                                        {task.due_date_formatted}
                                                    </span>
                                                    <span
                                                        className={`text-[10px] uppercase font-bold tracking-wider ${
                                                            isOverdue
                                                                ? 'text-rose-600'
                                                                : isApproaching
                                                                ? 'text-amber-600'
                                                                : 'text-slate-400'
                                                        }`}
                                                    >
                                                        {isOverdue ? 'Overdue' : isApproaching ? 'Due Soon' : 'Upcoming'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* 4. Notifications */}
                        <section
                            aria-labelledby="notifications-heading"
                            className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs"
                        >
                            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[color:var(--color-border-light)]">
                                <div className="flex items-center gap-2">
                                    <h2
                                        id="notifications-heading"
                                        className="text-sm font-bold text-[color:var(--color-text-main)]"
                                    >
                                        Notifications
                                    </h2>
                                    {unreadNotificationsCount > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-[color:var(--color-brand-action-orange)]">
                                            {unreadNotificationsCount} new
                                        </span>
                                    )}
                                </div>
                                <Link
                                    href="/notifications"
                                    className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline inline-flex items-center gap-1"
                                >
                                    <span>View all</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            {displayedNotifications.length === 0 ? (
                                <div className="py-6 px-3 text-center">
                                    <Bell className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                                    <p className="text-xs text-[color:var(--color-text-muted)]">No notifications</p>
                                    <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">
                                        You're up to date on all updates.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[color:var(--color-border-light)]">
                                    {displayedNotifications.map((notif) => {
                                        const isUnread = !notif.read_at;
                                        return (
                                            <div
                                                key={notif.id}
                                                className={`py-2.5 first:pt-0 last:pb-0 ${
                                                    isUnread ? 'font-medium' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-1">
                                                    <span
                                                        className={`text-xs truncate ${
                                                            isUnread
                                                                ? 'font-bold text-[color:var(--color-text-main)]'
                                                                : 'text-[color:var(--color-text-main)]'
                                                        }`}
                                                    >
                                                        {notif.data.title || 'Notification'}
                                                    </span>
                                                    <span className="text-[10px] text-[color:var(--color-text-subtle)] shrink-0 ml-2">
                                                        {notif.created_at_human || 'Recent'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-[color:var(--color-text-muted)] line-clamp-2 mt-0.5 leading-snug">
                                                    {notif.data.message}
                                                </p>
                                                {notif.data.action_url && (
                                                    <Link
                                                        href={notif.data.action_url}
                                                        className="inline-flex items-center gap-0.5 text-[10px] text-[color:var(--color-brand-action-orange)] font-semibold mt-1 hover:underline"
                                                    >
                                                        <span>View details</span>
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
