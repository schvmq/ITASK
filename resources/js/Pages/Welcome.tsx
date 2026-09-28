import React from 'react';
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
    FolderOpen,
    CheckSquare,
    Users,
    Clock,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    ExternalLink,
    ChevronRight,
    ClipboardCheck,
    Send,
    AlertTriangle,
    Bell,
    Check,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import { EmptyState } from '@/Components/EmptyState';

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

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: number | string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: boolean;
    urgent?: boolean;
}

function StatCard({ label, value, sub, icon: Icon, accent, urgent }: StatCardProps) {
    return (
        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 flex items-start gap-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-[color:var(--color-border-dark)] transition-colors">
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                    backgroundColor: urgent
                        ? '#FEE2E2'
                        : accent
                        ? 'var(--color-brand-active-warm-orange)'
                        : 'var(--color-surface-muted)',
                }}
            >
                <span
                    className="flex items-center justify-center"
                    style={{
                        color: urgent
                            ? '#DC2626'
                            : accent
                            ? 'var(--color-brand-action-orange)'
                            : 'var(--color-text-muted)',
                    }}
                >
                    <Icon className="w-5 h-5" />
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    {label}
                </p>
                <p className="text-2xl font-bold text-[color:var(--color-text-main)] mt-0.5 leading-none">
                    {value}
                </p>
                <p className="text-xs text-[color:var(--color-text-subtle)] mt-1 truncate">{sub}</p>
            </div>
        </div>
    );
}

// ─── Status Badge Helper ──────────────────────────────────────────────────────

function getTaskStatusBadge(status: string) {
    switch (status) {
        case 'Completed':
            return <Badge variant="success">Completed</Badge>;
        case 'In Progress':
            return <Badge variant="warning">In Progress</Badge>;
        case 'Under Review':
            return <Badge variant="primary">Under Review</Badge>;
        case 'Returned':
            return <Badge variant="danger">Returned</Badge>;
        case 'To Do':
        default:
            return <Badge variant="neutral">To Do</Badge>;
    }
}

function getProjectStatusBadge(status: string) {
    switch (status) {
        case 'Active':
            return <Badge variant="success">Active</Badge>;
        case 'Completed':
            return <Badge variant="secondary">Completed</Badge>;
        case 'Archived':
            return <Badge variant="neutral">Archived</Badge>;
        case 'Planning':
        default:
            return <Badge variant="primary">Planning</Badge>;
    }
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
    title,
    subtitle,
    count,
    action,
}: {
    title: string;
    subtitle?: string;
    count?: number;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[color:var(--color-text-main)]">
                        {title}
                    </h2>
                    {count !== undefined && count > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {count}
                        </span>
                    )}
                </div>
                {subtitle && (
                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">{subtitle}</p>
                )}
            </div>
            {action}
        </div>
    );
}

// ─── Main Welcome / Dashboard Component ───────────────────────────────────────

export default function Welcome({
    primaryRole = 'Project Member',
    stats = {
        activeProjectsCount: 0,
        assignedTasksCount: 0,
        completedTasksCount: 0,
        pendingReviewsCount: 0,
        returnedTasksCount: 0,
        overdueTasksCount: 0,
        approachingTasksCount: 0,
    },
    projects = [],
    committees = [],
    assignedTasks = [],
    pendingReviews = [],
    recentNotifications = [],
    unreadNotificationsCount = 0,
}: DashboardPageProps) {
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;

    const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    })();

    const firstName = user?.name?.split(' ')[0] ?? 'there';

    const isLeader = primaryRole === 'Project Leader';
    const isStaff = primaryRole === 'Project Staff';
    const isMember = primaryRole === 'Project Member';

    return (
        <AppLayout
            title="Dashboard"
            subtitle={`Role: ${primaryRole}`}
        >
            <Head title="Dashboard" />

            <div className="space-y-6 max-w-7xl mx-auto">
                {/* ── Header & Greeting ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-lg font-bold text-[color:var(--color-text-main)]">
                                {greeting}, {firstName} 👋
                            </h1>
                            <ProjectRoleBadge role={primaryRole} />
                        </div>
                        <p className="text-xs text-[color:var(--color-text-muted)] mt-1">
                            {isLeader && 'Overview of your led projects, committee deliverables, and project progress.'}
                            {isStaff && 'Overview of your assigned committees, member task review queues, and progress.'}
                            {isMember && 'Your assigned tasks, workflow deliverables, and approaching deadlines.'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/projects">
                            <Button variant="outline" size="sm" className="text-xs">
                                <FolderOpen className="w-3.5 h-3.5 mr-1" />
                                Browse Projects
                            </Button>
                        </Link>
                        {unreadNotificationsCount > 0 && (
                            <Link href="/notifications">
                                <Button variant="secondary" size="sm" className="text-xs">
                                    <Bell className="w-3.5 h-3.5 mr-1 text-[color:var(--color-brand-action-orange)]" />
                                    {unreadNotificationsCount} Unread
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── Urgent Role Callouts ── */}
                {isMember && stats.returnedTasksCount > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-rose-900">
                                Action Required: {stats.returnedTasksCount} task(s) returned for revision
                            </h3>
                            <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                                Staff reviewers have returned task(s) requesting revisions. Please check the feedback and update your work.
                            </p>
                        </div>
                    </div>
                )}

                {(isStaff || isLeader) && stats.pendingReviewsCount > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-amber-900">
                                Review Queue: {stats.pendingReviewsCount} item(s) awaiting review
                            </h3>
                            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                                You have tasks or activities submitted by members waiting for approval or revision notes.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Stats Grid (Role-Adaptive) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {isLeader && (
                        <>
                            <StatCard
                                label="Active Projects"
                                value={stats.activeProjectsCount}
                                sub={`${projects.length} total projects`}
                                icon={FolderOpen}
                                accent
                            />
                            <StatCard
                                label="Committees"
                                value={committees.length}
                                sub="Across your projects"
                                icon={Users}
                            />
                            <StatCard
                                label="Pending Reviews"
                                value={stats.pendingReviewsCount}
                                sub="Require staff attention"
                                icon={ClipboardCheck}
                                urgent={stats.pendingReviewsCount > 0}
                            />
                            <StatCard
                                label="Assigned Tasks"
                                value={stats.assignedTasksCount}
                                sub={`${stats.completedTasksCount} completed`}
                                icon={CheckSquare}
                            />
                        </>
                    )}

                    {isStaff && (
                        <>
                            <StatCard
                                label="My Committees"
                                value={committees.length}
                                sub="Assigned as Staff"
                                icon={Users}
                                accent
                            />
                            <StatCard
                                label="Review Queue"
                                value={stats.pendingReviewsCount}
                                sub="Awaiting your review"
                                icon={ClipboardCheck}
                                urgent={stats.pendingReviewsCount > 0}
                            />
                            <StatCard
                                label="My Tasks"
                                value={stats.assignedTasksCount}
                                sub={`${stats.completedTasksCount} completed`}
                                icon={CheckSquare}
                            />
                            <StatCard
                                label="Active Projects"
                                value={stats.activeProjectsCount}
                                sub="Projects involved"
                                icon={FolderOpen}
                            />
                        </>
                    )}

                    {isMember && (
                        <>
                            <StatCard
                                label="Assigned Tasks"
                                value={stats.assignedTasksCount}
                                sub={`${stats.completedTasksCount} completed`}
                                icon={CheckSquare}
                                accent
                            />
                            <StatCard
                                label="Returned / Needs Fix"
                                value={stats.returnedTasksCount}
                                sub="Require revision"
                                icon={AlertCircle}
                                urgent={stats.returnedTasksCount > 0}
                            />
                            <StatCard
                                label="Due Soon / Overdue"
                                value={stats.approachingTasksCount + stats.overdueTasksCount}
                                sub={`${stats.overdueTasksCount} overdue`}
                                icon={Clock}
                            />
                            <StatCard
                                label="My Committees"
                                value={committees.length}
                                sub="Active memberships"
                                icon={Users}
                            />
                        </>
                    )}
                </div>

                {/* ── Pending Reviews Section (For Staff & Leader) ── */}
                {(isStaff || isLeader) && pendingReviews.length > 0 && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs">
                        <SectionHeader
                            title="Items Awaiting Review"
                            subtitle="Tasks and activities submitted by members in your committee scope"
                            count={pendingReviews.length}
                        />
                        <div className="divide-y divide-[color:var(--color-border-light)]">
                            {pendingReviews.map((item) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[color:var(--color-surface-subtle)] px-2 rounded-lg transition-colors"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                                            {item.type === 'task' ? (
                                                <CheckSquare className="w-4 h-4 text-amber-700" />
                                            ) : (
                                                <ClipboardCheck className="w-4 h-4 text-amber-700" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                                    {item.type}
                                                </span>
                                                <h4 className="text-xs font-semibold text-slate-900">
                                                    {item.title}
                                                </h4>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Submitted by <span className="font-medium text-slate-700">{item.submitted_by}</span> in{' '}
                                                <span className="font-medium text-slate-700">{item.committee.name}</span> ({item.project.title})
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-end sm:self-center">
                                        <Badge variant="primary">Under Review</Badge>
                                        <Link href={item.action_url}>
                                            <Button variant="primary" size="sm" className="text-xs">
                                                Review Now
                                                <ChevronRight className="w-3 h-3 ml-0.5" />
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Two-Column Main Content ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: My Assigned Tasks (wide) */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs">
                        <SectionHeader
                            title="My Assigned Tasks"
                            subtitle="Tasks assigned to you across projects and committees"
                            count={assignedTasks.length}
                        />

                        {assignedTasks.length === 0 ? (
                            <EmptyState
                                icon={<CheckSquare className="w-6 h-6 text-slate-400" />}
                                title="No tasks assigned yet"
                                description="When a Project Staff or Leader assigns a task to you, it will appear here with its due date and status."
                            />
                        ) : (
                            <div className="divide-y divide-[color:var(--color-border-light)]">
                                {assignedTasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[color:var(--color-surface-subtle)] px-2 rounded-lg transition-colors group"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckSquare className="w-4 h-4 text-slate-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-xs font-semibold text-slate-900 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                                        {task.title}
                                                    </h4>
                                                    {task.requires_review && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded uppercase tracking-wider">
                                                            Review Req.
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                    {task.activity.title} · {task.committee.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1 text-[10px]">
                                                    <span
                                                        className={`flex items-center gap-1 font-medium ${
                                                            task.is_overdue
                                                                ? 'text-rose-600 font-bold'
                                                                : task.is_approaching
                                                                ? 'text-amber-600 font-bold'
                                                                : 'text-slate-500'
                                                        }`}
                                                    >
                                                        <Clock className="w-3 h-3" />
                                                        Due: {task.due_date_formatted}
                                                        {task.is_overdue && ' (Overdue)'}
                                                        {task.is_approaching && ' (Approaching)'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                            {getTaskStatusBadge(task.status)}
                                            <Link href={task.action_url}>
                                                <Button variant="outline" size="sm" className="text-xs">
                                                    View
                                                    <ChevronRight className="w-3 h-3 ml-0.5" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Recent Notifications / Updates (narrow) */}
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs flex flex-col">
                        <SectionHeader
                            title="Recent Alerts"
                            subtitle="Latest workflow notifications"
                            action={
                                <Link
                                    href="/notifications"
                                    className="text-[11px] font-semibold text-[color:var(--color-brand-action-orange)] hover:underline"
                                >
                                    View all
                                </Link>
                            }
                        />

                        {recentNotifications.length === 0 ? (
                            <div className="py-8 px-4 text-center my-auto">
                                <Bell className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                                <p className="text-xs font-medium text-slate-500">No notifications</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    You are all caught up.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[color:var(--color-border-light)] flex-1">
                                {recentNotifications.slice(0, 5).map((notif) => {
                                    const isUnread = !notif.read_at;
                                    return (
                                        <div
                                            key={notif.id}
                                            className={`py-3 px-2 rounded-lg transition-colors ${
                                                isUnread ? 'bg-orange-50/40' : ''
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-1">
                                                <p className={`text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                                    {notif.data.title || 'Notification'}
                                                </p>
                                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                    {notif.created_at_human || 'Recent'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                                                {notif.data.message}
                                            </p>
                                            {notif.data.action_url && (
                                                <Link
                                                    href={notif.data.action_url}
                                                    className="inline-flex items-center gap-1 text-[11px] text-[color:var(--color-brand-action-orange)] font-medium mt-1 hover:underline"
                                                >
                                                    View details <ExternalLink className="w-2.5 h-2.5" />
                                                </Link>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Projects & Committees Section ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* My Projects */}
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs">
                        <SectionHeader
                            title="My Projects"
                            subtitle="Projects where you hold an active role"
                            count={projects.length}
                            action={
                                <Link
                                    href="/projects"
                                    className="text-[11px] font-semibold text-[color:var(--color-brand-action-orange)] hover:underline"
                                >
                                    All Projects
                                </Link>
                            }
                        />

                        {projects.length === 0 ? (
                            <EmptyState
                                icon={<FolderOpen className="w-6 h-6 text-slate-400" />}
                                title="No projects yet"
                                description="You are not currently assigned to any active CCIS projects."
                            />
                        ) : (
                            <div className="space-y-3">
                                {projects.map((proj) => (
                                    <div
                                        key={proj.id}
                                        className="p-4 rounded-xl border border-[color:var(--color-border-light)] hover:border-[color:var(--color-border-dark)] transition-colors bg-white group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate">
                                                        {proj.title}
                                                    </h4>
                                                    {getProjectStatusBadge(proj.status)}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                                    {proj.description || 'No description provided.'}
                                                </p>
                                            </div>

                                            <ProjectRoleBadge role={proj.role} />
                                        </div>

                                        {/* Progress indicator */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>
                                                Tasks: {proj.completedTasksCount} / {proj.tasksCount} completed ({proj.progressPercentage}%)
                                            </span>
                                            <Link
                                                href={`/projects/${proj.id}`}
                                                className="text-[color:var(--color-brand-action-orange)] font-semibold flex items-center gap-0.5 hover:underline"
                                            >
                                                Open <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${proj.progressPercentage}%`,
                                                    backgroundColor: 'var(--color-brand-dark-green)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* My Committees */}
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs">
                        <SectionHeader
                            title="My Committees"
                            subtitle="Committees within your project scope"
                            count={committees.length}
                        />

                        {committees.length === 0 ? (
                            <EmptyState
                                icon={<Users className="w-6 h-6 text-slate-400" />}
                                title="No committees yet"
                                description="You are not assigned to any project committees yet."
                            />
                        ) : (
                            <div className="space-y-3">
                                {committees.map((comm) => (
                                    <div
                                        key={comm.id}
                                        className="p-4 rounded-xl border border-[color:var(--color-border-light)] hover:border-[color:var(--color-border-dark)] transition-colors bg-white group"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                                    {comm.name}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 mt-0.5">
                                                    Project: <span className="font-medium text-slate-700">{comm.project_title}</span>
                                                </p>
                                            </div>
                                            <ProjectRoleBadge role={comm.role} />
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>
                                                {comm.activities_count} activities · {comm.tasks_count} tasks
                                            </span>
                                            <Link
                                                href={`/projects/${comm.project_id}/committees/${comm.id}`}
                                                className="text-[color:var(--color-brand-action-orange)] font-semibold flex items-center gap-0.5 hover:underline"
                                            >
                                                Manage <ChevronRight className="w-3 h-3" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
