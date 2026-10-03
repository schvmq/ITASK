import React, { useMemo, useState, useEffect } from 'react';
import { Head, Link, usePage, router } from '@inertiajs/react';
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
    AlertTriangle,
    Bell,
    FolderOpen,
    Plus,
    CalendarDays,
    Calendar,
    Sparkles,
    Check,
    ExternalLink,
    HelpCircle,
    ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import { CreateProjectModal } from '@/Components/CreateProjectModal';
import { JoinProjectModal } from '@/Components/JoinProjectModal';
import { NumberCounter } from '@/Components/NumberCounter';

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
    stats,
    projects = [],
    assignedTasks = [],
    pendingReviews = [],
    recentNotifications = [],
    unreadNotificationsCount = 0,
}: DashboardPageProps) {
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;
    const firstName = user?.name?.split(' ')[0] ?? 'there';

    // Modals
    const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
    const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);

    // Dynamic greeting based on time of day
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Format today's date & day string
    const todayInfo = useMemo(() => {
        const today = new Date();
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        const monthDay = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return {
            dateStr: `${dayName}, ${monthDay}`,
            dayIndex: today.getDay(), // 0 = Sun, 6 = Sat
            todayDate: today,
        };
    }, []);

    // Count tasks due today or overdue for greeting context line
    const dueTodayCount = useMemo(() => {
        const todayStr = new Date().toISOString().slice(0, 10);
        return assignedTasks.filter(
            (t) => t.status !== 'Completed' && t.due_date === todayStr
        ).length;
    }, [assignedTasks]);

    const contextMessage = useMemo(() => {
        if (dueTodayCount > 0) {
            return `You have ${dueTodayCount} deliverable${dueTodayCount === 1 ? '' : 's'} due today.`;
        }
        const overdue = assignedTasks.filter((t) => t.is_overdue && t.status !== 'Completed').length;
        if (overdue > 0) {
            return `You have ${overdue} item${overdue === 1 ? '' : 's'} requiring revision or overdue.`;
        }
        return 'You have nothing due today. A good time to plan ahead.';
    }, [dueTodayCount, assignedTasks]);

    const isLeader = primaryRole === 'Project Leader';
    const isStaff = primaryRole === 'Project Staff';
    const isMember = primaryRole === 'Project Member';

    // ── Build actionable "Needs Your Attention" items ──
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
                    actionLabel: 'Revise task',
                    urgency: 'critical',
                    badgeLabel: 'Revision required',
                    actionReason: 'Returned by reviewer with feedback notes. Update deliverables and resubmit.',
                    dateFormatted: task.due_date_formatted,
                });
            });

        // 2. Pending reviews (for Staff and Leader)
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
                    actionLabel: review.type === 'task' ? 'Review task' : 'Review activity',
                    urgency: 'urgent',
                    badgeLabel: 'Review needed',
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
                    actionLabel: 'Open task',
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
                    actionLabel: 'Open task',
                    urgency: 'warning',
                    badgeLabel: 'Due soon',
                    actionReason: `Due ${task.due_date_formatted}. Work on task deliverables.`,
                    dateFormatted: task.due_date_formatted,
                });
            });

        return items;
    }, [assignedTasks, pendingReviews, isStaff, isLeader]);

    const displayedAttentionItems = attentionItems.slice(0, 5);

    // Active ongoing projects (max 4)
    const activeProjects = useMemo(() => {
        return projects.filter((p) => p.status !== 'Archived').slice(0, 4);
    }, [projects]);

    // Stat numbers (calculated from real data)
    const activeProjectsCount = stats?.activeProjectsCount ?? projects.filter((p) => p.status !== 'Archived').length;
    
    // Due this week count: tasks with due dates in the next 7 days
    const dueThisWeekCount = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        return assignedTasks.filter((t) => {
            if (t.status === 'Completed' || !t.due_date) return false;
            const due = new Date(t.due_date);
            return due >= today && due <= nextWeek;
        }).length;
    }, [assignedTasks]);

    const needsRevisionCount = stats?.returnedTasksCount ?? assignedTasks.filter((t) => t.status === 'Returned').length;
    const completedTasksCount = stats?.completedTasksCount ?? assignedTasks.filter((t) => t.status === 'Completed').length;

    // ── 7-Day Week Strip Data (Requirement 15: Sat to Fri, with today highlighted) ──
    const weekStrip = useMemo(() => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find Saturday of the current week (or rolling 7 days starting from Saturday)
        const currentDayIndex = today.getDay(); // 0 is Sun, 6 is Sat
        const diffToSaturday = currentDayIndex === 6 ? 0 : -(currentDayIndex + 1);
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + diffToSaturday);

        for (let i = 0; i < 7; i++) {
            const date = new Date(saturday);
            date.setDate(saturday.getDate() + i);
            const dateStr = date.toISOString().slice(0, 10);

            const isToday =
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();

            // Check if any assigned tasks are due on this date
            const hasDeadlines = assignedTasks.some(
                (t) => t.status !== 'Completed' && t.due_date === dateStr
            );

            days.push({
                dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
                dayNumber: date.getDate(),
                dateStr,
                isToday,
                hasDeadlines,
            });
        }
        return days;
    }, [assignedTasks]);

    // Upcoming deadlines list (compact chronological list of incomplete tasks with due dates)
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

    // ── "Get started in 3 steps" checklist state (Requirement 14) ──
    const step1Done = true; // Account created (user is logged in)
    const step2Done = projects.length > 0; // Create or join a project
    const step3Done = assignedTasks.length > 0; // Add your first task with a deadline

    const completedStepsCount = (step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0);
    const isAllOnboardingComplete = completedStepsCount === 3;

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Dashboard" />

            <div className="space-y-6">
                {/* ── 1. Greeting & Page Header ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="page-title text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[var(--ink)]">
                            {greeting}, {firstName} 👋
                        </h1>
                        <p className="text-sm font-medium text-[var(--muted)] mt-1">
                            {todayInfo.dateStr} · {contextMessage}
                        </p>
                    </div>

                    {/* Header action buttons */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <Link href="/calendar">
                            <Button variant="secondary" size="md">
                                <CalendarDays className="w-4 h-4 text-[var(--ink)]" />
                                <span>View calendar</span>
                            </Button>
                        </Link>
                        <Button
                            variant="primary"
                            size="md"
                            onClick={() => setIsCreateProjectOpen(true)}
                        >
                            <Plus className="w-4 h-4 text-[#2A2A2A]" strokeWidth={2.5} />
                            <span>Create project</span>
                        </Button>
                    </div>
                </div>

                {/* ── 2. Four Stat Cards in a Row ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Stat 1: Active Projects */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-card)] flex items-center justify-between card-hover animate-stagger-item stagger-1">
                        <div>
                            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                                Active projects
                            </p>
                            <p className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight">
                                <NumberCounter value={activeProjectsCount} />
                            </p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                Current assignments
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00] shrink-0 shadow-xs">
                            <FolderOpen className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Stat 2: Due This Week */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-card)] flex items-center justify-between card-hover animate-stagger-item stagger-2">
                        <div>
                            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                                Due this week
                            </p>
                            <p className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight">
                                <NumberCounter value={dueThisWeekCount} />
                            </p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                Approaching deadlines
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-[var(--tint-orange)] flex items-center justify-center text-[#EC7505] shrink-0 shadow-xs">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Stat 3: Needs Revision */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-card)] flex items-center justify-between card-hover animate-stagger-item stagger-3">
                        <div>
                            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                                Needs revision
                            </p>
                            <p className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight">
                                <NumberCounter value={needsRevisionCount} />
                            </p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                Feedback to address
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-xs">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                    </div>

                    {/* Stat 4: Completed */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-card)] flex items-center justify-between card-hover animate-stagger-item stagger-4">
                        <div>
                            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider">
                                Completed
                            </p>
                            <p className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight">
                                <NumberCounter value={completedTasksCount} />
                            </p>
                            <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                Deliverables finished
                            </p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                {/* ── 3. Onboarding Checklist: "Get started in 3 steps" (Requirement 14) ── */}
                {!isAllOnboardingComplete && (
                    <section
                        aria-labelledby="get-started-heading"
                        className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-4"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2
                                        id="get-started-heading"
                                        className="section-title text-base sm:text-lg font-bold text-[var(--ink)]"
                                    >
                                        Get started in 3 steps
                                    </h2>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--tint-orange)] text-[#2A2A2A]">
                                        {completedStepsCount} of 3 done
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--muted)] mt-0.5">
                                    Complete these steps to set up your ITASK project management hub
                                </p>
                            </div>
                            {/* Progress bar indicator */}
                            <div className="w-32 h-2 bg-[var(--tint-neutral)] rounded-full overflow-hidden self-start sm:self-center">
                                <div
                                    className="h-full bg-[#EC7505] rounded-full transition-all duration-300"
                                    style={{ width: `${(completedStepsCount / 3) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {/* Step 1: Create your account */}
                            <div className="py-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-[#FFBB00] flex items-center justify-center text-[#2A2A2A] shrink-0">
                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </div>
                                    <div>
                                        <p className="text-xs sm:text-sm font-bold text-[var(--ink)] line-through opacity-70">
                                            Create your account
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)]">
                                            Account created and institutional profile ready.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    Done
                                </span>
                            </div>

                            {/* Step 2: Create or join a project */}
                            <div className="py-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {step2Done ? (
                                        <div className="w-6 h-6 rounded-full bg-[#FFBB00] flex items-center justify-center text-[#2A2A2A] shrink-0">
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] shrink-0" />
                                    )}
                                    <div>
                                        <p className={`text-xs sm:text-sm font-bold text-[var(--ink)] ${step2Done ? 'line-through opacity-70' : ''}`}>
                                            Create or join a project
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)]">
                                            Projects hold your tasks, deadlines and teammates in one place.
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {step2Done ? (
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                            Done
                                        </span>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => setIsCreateProjectOpen(true)}
                                        >
                                            Create project
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Add your first task with a deadline */}
                            <div className="py-3 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {step3Done ? (
                                        <div className="w-6 h-6 rounded-full bg-[#FFBB00] flex items-center justify-center text-[#2A2A2A] shrink-0">
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                    ) : (
                                        <div className="w-6 h-6 rounded-full border-2 border-[var(--border)] shrink-0" />
                                    )}
                                    <div>
                                        <p className={`text-xs sm:text-sm font-bold text-[var(--ink)] ${step3Done ? 'line-through opacity-70' : ''}`}>
                                            Add your first task with a deadline
                                        </p>
                                        <p className="text-[11px] text-[var(--muted)]">
                                            Assign deliverables and due dates to track progress effortlessly.
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {step3Done ? (
                                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                            Done
                                        </span>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                if (projects.length > 0) {
                                                    router.visit(`/projects/${projects[0].id}`);
                                                } else {
                                                    setIsCreateProjectOpen(true);
                                                }
                                            }}
                                        >
                                            Add task
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── 4. Main Two-Column Layout (Main 2/3, Right 1/3, collapses < 1100px) ── */}
                <div className="grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] gap-5">
                    {/* ══ Left Column (2/3) ═════════════════════════════════════ */}
                    <div className="space-y-5">
                        {/* Section A: Needs Your Attention */}
                        <section
                            aria-labelledby="attention-heading"
                            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)]"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-[var(--border)]">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <h2
                                            id="attention-heading"
                                            className="section-title text-base sm:text-lg font-bold text-[var(--ink)]"
                                        >
                                            Needs your attention
                                        </h2>
                                        {attentionItems.length > 0 && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--tint-orange)] text-[#2A2A2A]">
                                                {attentionItems.length} {attentionItems.length === 1 ? 'item' : 'items'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--muted)] mt-0.5">
                                        {isMember && 'Tasks requiring revision, approaching deadlines, or submissions.'}
                                        {isStaff && 'Committee review queue, revision requests, and urgent deliverables.'}
                                        {isLeader && 'Project review queue, deliverables, and items requiring your decision.'}
                                    </p>
                                </div>

                                {attentionItems.length > 0 && (
                                    <Link
                                        href="/my-tasks"
                                        className="text-xs font-bold text-[var(--link-orange)] hover:underline inline-flex items-center gap-1 self-start sm:self-center"
                                    >
                                        <span>View all in My Tasks</span>
                                    </Link>
                                )}
                            </div>

                            {/* Attention Items: List or Rewarding Empty State (Requirement 12) */}
                            {attentionItems.length === 0 ? (
                                <div className="p-6 rounded-2xl bg-[var(--tint-yellow)] border border-[#FFE9A8] dark:border-[#524410] space-y-3">
                                    <div className="flex items-start gap-3.5">
                                        {/* Amber check icon in brand yellow */}
                                        <div className="w-10 h-10 rounded-xl bg-[#FFBB00] flex items-center justify-center text-[#2A2A2A] shrink-0 shadow-xs">
                                            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-[var(--ink)]">
                                                You're all caught up
                                            </h3>
                                            <p className="text-xs text-[var(--muted)] mt-0.5">
                                                Nothing needs your attention right now. All submissions, reviews, and tasks are on schedule.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Rewarding Progress Bar */}
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-[11px] font-bold text-[var(--ink)]">
                                            <span>Task review & status</span>
                                            <span className="text-[#8A5A00] dark:text-[#FFBB00]">100% caught up</span>
                                        </div>
                                        <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-[#FFBB00] to-[#EC7505] rounded-full w-full" />
                                        </div>
                                    </div>

                                    <div className="pt-2 flex items-center justify-between">
                                        <Link
                                            href="/my-tasks"
                                            className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                        >
                                            View all tasks in My Tasks
                                        </Link>
                                        <Link
                                            href="/calendar"
                                            className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                        >
                                            Open calendar
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--border)]">
                                    {displayedAttentionItems.map((item) => {
                                        const isCritical = item.urgency === 'critical';
                                        const isUrgent = item.urgency === 'urgent';

                                        return (
                                            <div
                                                key={item.id}
                                                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-[var(--tint-neutral)]/40 px-3 -mx-3 rounded-xl transition-colors"
                                            >
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <div
                                                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                                                            isCritical
                                                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                                                                : isUrgent
                                                                ? 'bg-[var(--tint-yellow)] border-[#FFE9A8] dark:border-[#524410] text-[#8A5A00] dark:text-[#FFBB00]'
                                                                : 'bg-[var(--tint-orange)] border-[#FDE5CC] dark:border-[#573516] text-[#EC7505]'
                                                        }`}
                                                    >
                                                        {item.type === 'pending_review' ? (
                                                            <ClipboardCheck className="w-4.5 h-4.5" />
                                                        ) : item.type === 'returned_task' ? (
                                                            <AlertCircle className="w-4.5 h-4.5" />
                                                        ) : item.type === 'overdue_task' ? (
                                                            <Clock className="w-4.5 h-4.5" />
                                                        ) : (
                                                            <AlertTriangle className="w-4.5 h-4.5" />
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
                                                            <h3 className="text-sm font-bold text-[var(--ink)] group-hover:text-[#EC7505] transition-colors truncate">
                                                                {item.title}
                                                            </h3>
                                                        </div>

                                                        <p className="text-[11px] text-[var(--muted)] mt-1 truncate">
                                                            <span className="font-semibold text-[var(--ink)]">
                                                                {item.projectTitle}
                                                            </span>
                                                            {item.committeeName && ` · ${item.committeeName}`}
                                                            {item.activityTitle && ` · ${item.activityTitle}`}
                                                        </p>

                                                        <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                                            {item.actionReason}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 sm:self-center shrink-0 pl-12 sm:pl-0">
                                                    <Link href={item.actionUrl}>
                                                        <Button
                                                            variant={isCritical ? 'primary' : 'outline'}
                                                            size="sm"
                                                        >
                                                            <span>{item.actionLabel}</span>
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {attentionItems.length > 5 && (
                                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted)]">
                                    <span>Showing 5 of {attentionItems.length} actionable items</span>
                                    <Link
                                        href="/my-tasks"
                                        className="font-bold text-[var(--link-orange)] hover:underline"
                                    >
                                        View all in My Tasks
                                    </Link>
                                </div>
                            )}
                        </section>

                        {/* Section B: Your Projects (Requirement 13) */}
                        <section
                            aria-labelledby="projects-heading"
                            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)]"
                        >
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
                                <div>
                                    <h2
                                        id="projects-heading"
                                        className="section-title text-base sm:text-lg font-bold text-[var(--ink)]"
                                    >
                                        Your projects
                                    </h2>
                                    <p className="text-xs text-[var(--muted)] mt-0.5">
                                        Summary of your ongoing group projects and committee assignments
                                    </p>
                                </div>
                                <Link
                                    href="/projects"
                                    className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                >
                                    View all projects
                                </Link>
                            </div>

                            {activeProjects.length === 0 ? (
                                /* Dashed-Border Panel Empty State (Requirement 13) */
                                <div className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center space-y-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00] mx-auto">
                                        <FolderOpen className="w-6 h-6" />
                                    </div>
                                    <div className="max-w-md mx-auto">
                                        <h3 className="text-lg font-bold text-[var(--ink)]">
                                            Start your first project
                                        </h3>
                                        <p className="text-xs text-[var(--muted)] mt-1.5 leading-relaxed">
                                            Projects hold your tasks, deadlines and teammates in one place.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                        <Button
                                            variant="primary"
                                            size="md"
                                            onClick={() => setIsCreateProjectOpen(true)}
                                        >
                                            <Plus className="w-4 h-4 text-[#2A2A2A]" strokeWidth={2.5} />
                                            <span>Create project</span>
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            size="md"
                                            onClick={() => setIsJoinCodeOpen(true)}
                                        >
                                            <span>Join with a code</span>
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {activeProjects.map((proj) => (
                                        <div
                                            key={proj.id}
                                            className="p-4 rounded-xl border border-[var(--border)] hover:border-[#EC7505] transition-colors group bg-[var(--card)] shadow-xs"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Link
                                                            href={`/projects/${proj.id}`}
                                                            className="text-sm font-bold text-[var(--ink)] group-hover:text-[#EC7505] transition-colors truncate"
                                                        >
                                                            {proj.title}
                                                        </Link>
                                                        <ProjectRoleBadge role={proj.role} />
                                                    </div>
                                                    {proj.end_date && (
                                                        <p className="text-xs text-[var(--muted)] mt-1 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                                                            <span>Deadline: {proj.end_date}</span>
                                                        </p>
                                                    )}
                                                </div>

                                                <Link
                                                    href={`/projects/${proj.id}`}
                                                    className="text-xs font-bold text-[var(--link-orange)] hover:underline inline-flex items-center gap-0.5 shrink-0"
                                                >
                                                    <span>Open project</span>
                                                </Link>
                                            </div>

                                            {/* Progress Bar & Percentage */}
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-[var(--muted)]">Overall progress</span>
                                                    <span className="font-bold text-[var(--ink)]">
                                                        {proj.progressPercentage}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-[var(--tint-neutral)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-300"
                                                        style={{
                                                            width: `${proj.progressPercentage}%`,
                                                            backgroundColor: '#EC7505',
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

                    {/* ══ Right Column (1/3) ════════════════════════════════════ */}
                    <div className="space-y-5">
                        {/* Section C: Upcoming Deadlines with 7-Day Strip (Requirement 15) */}
                        <section
                            aria-labelledby="deadlines-heading"
                            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                                <div>
                                    <h2
                                        id="deadlines-heading"
                                        className="section-title text-base font-bold text-[var(--ink)]"
                                    >
                                        Upcoming deadlines
                                    </h2>
                                    <p className="text-xs text-[var(--muted)] mt-0.5">
                                        7-day week deliverable schedule
                                    </p>
                                </div>
                                <Link
                                    href="/calendar"
                                    className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                >
                                    Calendar
                                </Link>
                            </div>

                            {/* 7-Day Week Strip (Sat to Fri) with Today Highlighted in Yellow */}
                            <div className="grid grid-cols-7 gap-1 p-2 rounded-xl bg-[var(--tint-neutral)]/50 border border-[var(--border)] text-center">
                                {weekStrip.map((day) => (
                                    <div
                                        key={day.dateStr}
                                        className={`flex flex-col items-center py-2 px-1 rounded-lg transition-all ${
                                            day.isToday
                                                ? 'bg-[#FFBB00] text-[#2A2A2A] font-extrabold shadow-sm ring-1 ring-[#FFBB00]'
                                                : 'text-[var(--ink)] font-medium hover:bg-[var(--card)]'
                                        }`}
                                    >
                                        <span className="text-[10px] uppercase tracking-wider block">
                                            {day.dayName}
                                        </span>
                                        <span className="text-xs font-bold block mt-0.5">
                                            {day.dayNumber}
                                        </span>
                                        {/* Orange dot for deadline */}
                                        <div className="h-1.5 mt-1 flex items-center justify-center">
                                            {day.hasDeadlines && (
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        day.isToday ? 'bg-[#2A2A2A]' : 'bg-[#EC7505]'
                                                    }`}
                                                    title="Deliverable deadline scheduled"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Deadlines List or Clean Empty State */}
                            {upcomingDeadlines.length === 0 ? (
                                <div className="py-6 px-3 text-center space-y-2">
                                    <Calendar className="w-7 h-7 mx-auto text-[var(--muted)]/50" />
                                    <p className="text-xs font-bold text-[var(--ink)]">
                                        Your week is clear.
                                    </p>
                                    <p className="text-[11px] text-[var(--muted)]">
                                        Add a deadline and it appears here.
                                    </p>
                                    <div className="pt-2">
                                        <Link
                                            href="/calendar"
                                            className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                        >
                                            Open calendar view
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--border)]">
                                    {upcomingDeadlines.map((task) => {
                                        const isOverdue = task.is_overdue;
                                        const isApproaching = task.is_approaching;

                                        return (
                                            <div
                                                key={task.id}
                                                className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3 group"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className={`w-2 h-2 rounded-full shrink-0 ${
                                                                isOverdue
                                                                    ? 'bg-rose-500'
                                                                    : isApproaching
                                                                    ? 'bg-[#EC7505]'
                                                                    : 'bg-[#FFBB00]'
                                                            }`}
                                                        />
                                                        <Link
                                                            href={task.action_url}
                                                            className="text-xs font-bold text-[var(--ink)] group-hover:text-[#EC7505] transition-colors truncate"
                                                        >
                                                            {task.title}
                                                        </Link>
                                                    </div>
                                                    <p className="text-[11px] text-[var(--muted)] truncate pl-4 mt-0.5">
                                                        {task.project.title}
                                                    </p>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span
                                                        className={`text-xs block font-bold ${
                                                            isOverdue
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : isApproaching
                                                                ? 'text-[#EC7505]'
                                                                : 'text-[var(--ink)]'
                                                        }`}
                                                    >
                                                        {task.due_date_formatted}
                                                    </span>
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)]">
                                                        {isOverdue ? 'Overdue' : isApproaching ? 'Due soon' : 'Upcoming'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Section D: Notifications (Requirement 16) */}
                        <section
                            aria-labelledby="notifications-heading"
                            className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-6 shadow-[var(--shadow-card)] space-y-4"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                                <div className="flex items-center gap-2">
                                    <h2
                                        id="notifications-heading"
                                        className="section-title text-base font-bold text-[var(--ink)]"
                                    >
                                        Notifications
                                    </h2>
                                    {unreadNotificationsCount > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EC7505] text-[#2A2A2A]">
                                            {unreadNotificationsCount} new
                                        </span>
                                    )}
                                </div>
                                <Link
                                    href="/notifications"
                                    className="text-xs font-bold text-[var(--link-orange)] hover:underline"
                                >
                                    View all
                                </Link>
                            </div>

                            {/* Notifications List or Friendlier Empty Copy (Requirement 16) */}
                            {displayedNotifications.length === 0 ? (
                                <div className="py-6 px-3 text-center space-y-2">
                                    <Bell className="w-7 h-7 mx-auto text-[var(--muted)]/50" />
                                    <p className="text-xs font-bold text-[var(--ink)]">
                                        You're up to date
                                    </p>
                                    <p className="text-xs text-[var(--muted)] leading-relaxed">
                                        Task updates and feedback will show here.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--border)]">
                                    {displayedNotifications.map((notif) => {
                                        const isUnread = !notif.read_at;
                                        return (
                                            <div
                                                key={notif.id}
                                                className={`py-3 first:pt-0 last:pb-0 ${
                                                    isUnread ? 'font-bold' : ''
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-1">
                                                    <span className="text-xs truncate text-[var(--ink)] font-bold">
                                                        {notif.data.title || 'Notification'}
                                                    </span>
                                                    <span className="text-[10px] text-[var(--muted)] shrink-0 ml-2">
                                                        {notif.created_at_human || 'Recent'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5 leading-snug">
                                                    {notif.data.message}
                                                </p>
                                                {notif.data.action_url && (
                                                    <Link
                                                        href={notif.data.action_url}
                                                        className="inline-flex items-center gap-1 text-[11px] text-[var(--link-orange)] font-bold mt-1 hover:underline"
                                                    >
                                                        <span>View details</span>
                                                    </Link>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Section E: Shortcut Tip Card (Requirement 17) */}
                        <div
                            className="bg-[var(--tint-neutral)]/60 border border-[var(--border)] rounded-2xl p-4.5 flex items-start gap-3 text-xs"
                            role="note"
                        >
                            <div className="w-8 h-8 rounded-xl bg-[var(--tint-yellow)] flex items-center justify-center text-[#8A5A00] dark:text-[#FFBB00] shrink-0 mt-0.5">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-[var(--ink)] leading-snug">
                                    Tip: press Ctrl K
                                </p>
                                <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                                    Jump to any task or project without leaving your keyboard.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <CreateProjectModal
                isOpen={isCreateProjectOpen}
                onClose={() => setIsCreateProjectOpen(false)}
            />

            <JoinProjectModal
                isOpen={isJoinCodeOpen}
                onClose={() => setIsJoinCodeOpen(false)}
            />
        </AppLayout>
    );
}
