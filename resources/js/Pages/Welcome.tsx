import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { staggerContainer, cardVariant, rowVariant } from '@/animations';
import { AppLayout, openCreateProjectModal, openCommandPalette } from '@/Layouts/AppLayout';
import { can } from '@/lib/permissions';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/Components/ui/tooltip';
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
    AlertTriangle,
    FolderOpen,
    Plus,
    Calendar,
    ArrowRight,
    Sparkles,
    FileText,
    Users,
    Activity,
    Search,
    BookOpen,
    CalendarDays,
    ShieldCheck,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { Checkbox } from '@/Components/Checkbox';
import { Tabs } from '@/Components/Tabs';
import { Pagination } from '@/Components/Pagination';
import { EmptyState } from '@/Components/EmptyState';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import { JoinProjectModal } from '@/Components/JoinProjectModal';
import { Avatar, AvatarFallback } from '@/Components/ui/avatar';

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

function getInitials(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
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
    const page = usePage<PageProps>();
    const { auth } = page.props;
    const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);

    // Track locally completed or submitting task IDs for smooth optimistic feedback
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    // ── URL Synchronization for Projects Table (tab, page, size) ──
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialTab = searchParams.get('tab') || 'all';
    const initialPage = parseInt(searchParams.get('page') || '1', 10);
    const initialSize = parseInt(searchParams.get('size') || '5', 10);

    const [activeTab, setActiveTab] = useState<string>(['all', 'active', 'completed'].includes(initialTab) ? initialTab : 'all');
    const [currentPage, setCurrentPage] = useState<number>(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
    const [pageSize, setPageSize] = useState<number>([5, 10, 25].includes(initialSize) ? initialSize : 5);

    // Sync URL query params with state
    const updateUrlParams = useCallback((newTab: string, newPage: number, newSize: number) => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('tab', newTab);
        url.searchParams.set('page', String(newPage));
        url.searchParams.set('size', String(newSize));
        window.history.replaceState({}, '', url.toString());
    }, []);

    const handleTabChange = (newTab: string) => {
        setActiveTab(newTab);
        setCurrentPage(1); // Reset to page 1 when filter/tab changes
        updateUrlParams(newTab, 1, pageSize);
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        updateUrlParams(activeTab, newPage, pageSize);
    };

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setCurrentPage(1);
        updateUrlParams(activeTab, 1, newSize);
    };

    // ── Today & Overdue Calculations for Summary ──
    const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const overdueTasks = useMemo(() => {
        return assignedTasks.filter((t) => t.is_overdue && t.status !== 'Completed');
    }, [assignedTasks]);

    const dueTodayTasks = useMemo(() => {
        return assignedTasks.filter(
            (t) => !t.is_overdue && t.status !== 'Completed' && t.due_date === todayStr
        );
    }, [assignedTasks, todayStr]);

    const focusCount = overdueTasks.length + dueTodayTasks.length;
    const overdueCount = overdueTasks.length;

    // Summary line formatted per Section 4 requirement
    const summaryText = useMemo(() => {
        if (focusCount === 0 && overdueCount === 0) {
            return 'All deliverables are up to date. You have no urgent items today.';
        }
        const taskWord = focusCount === 1 ? 'task' : 'tasks';
        const overduePhrase = overdueCount === 1 ? '1 is overdue' : `${overdueCount} are overdue`;
        return `You have ${focusCount} ${taskWord} to focus on today, and ${overduePhrase}.`;
    }, [focusCount, overdueCount]);

    // ── Attention Items (Strict Ordering: Overdue first, Due today, High priority/approaching/returned) ──
    const attentionItems = useMemo(() => {
        const items: Array<{
            id: string;
            taskId?: string;
            type: 'overdue' | 'today' | 'returned' | 'review' | 'approaching';
            title: string;
            projectTitle: string;
            committeeName?: string;
            activityTitle?: string;
            actionUrl: string;
            badgeVariant: 'danger' | 'warning' | 'primary' | 'secondary' | 'accent';
            badgeLabel: string;
            dueDateFormatted?: string;
            requiresReview?: boolean;
            isCompletedLocal?: boolean;
            rawTask?: DashboardTask;
        }> = [];

        // 1. Overdue tasks first
        overdueTasks.forEach((task) => {
            items.push({
                id: `task-${task.id}`,
                taskId: task.id,
                type: 'overdue',
                title: task.title,
                projectTitle: task.project.title,
                committeeName: task.committee.name,
                activityTitle: task.activity.title,
                actionUrl: task.action_url,
                badgeVariant: 'danger',
                badgeLabel: 'Overdue',
                dueDateFormatted: task.due_date_formatted,
                requiresReview: task.requires_review,
                rawTask: task,
            });
        });

        // 2. Due today
        dueTodayTasks.forEach((task) => {
            items.push({
                id: `task-${task.id}`,
                taskId: task.id,
                type: 'today',
                title: task.title,
                projectTitle: task.project.title,
                committeeName: task.committee.name,
                activityTitle: task.activity.title,
                actionUrl: task.action_url,
                badgeVariant: 'warning',
                badgeLabel: 'Due today',
                dueDateFormatted: task.due_date_formatted,
                requiresReview: task.requires_review,
                rawTask: task,
            });
        });

        // 3. Returned tasks (requires revision)
        assignedTasks
            .filter((t) => t.status === 'Returned' && !items.some((i) => i.taskId === t.id))
            .forEach((task) => {
                items.push({
                    id: `task-${task.id}`,
                    taskId: task.id,
                    type: 'returned',
                    title: task.title,
                    projectTitle: task.project.title,
                    committeeName: task.committee.name,
                    activityTitle: task.activity.title,
                    actionUrl: task.action_url,
                    badgeVariant: 'danger',
                    badgeLabel: 'Revision required',
                    dueDateFormatted: task.due_date_formatted,
                    requiresReview: task.requires_review,
                    rawTask: task,
                });
            });

        // 4. Pending reviews (for staff or leader)
        pendingReviews.forEach((review) => {
            items.push({
                id: `review-${review.type}-${review.id}`,
                type: 'review',
                title: review.title,
                projectTitle: review.project.title,
                committeeName: review.committee.name,
                activityTitle: review.activity.title,
                actionUrl: review.action_url,
                badgeVariant: 'secondary',
                badgeLabel: 'In review',
                dueDateFormatted: review.updated_at,
            });
        });

        // 5. Approaching tasks (within 2 days, not already added)
        assignedTasks
            .filter(
                (t) =>
                    t.is_approaching &&
                    t.status !== 'Completed' &&
                    t.status !== 'Returned' &&
                    !items.some((i) => i.taskId === t.id)
            )
            .forEach((task) => {
                items.push({
                    id: `task-${task.id}`,
                    taskId: task.id,
                    type: 'approaching',
                    title: task.title,
                    projectTitle: task.project.title,
                    committeeName: task.committee.name,
                    activityTitle: task.activity.title,
                    actionUrl: task.action_url,
                    badgeVariant: 'secondary',
                    badgeLabel: 'Due soon',
                    dueDateFormatted: task.due_date_formatted,
                    requiresReview: task.requires_review,
                    rawTask: task,
                });
            });

        return items;
    }, [overdueTasks, dueTodayTasks, assignedTasks, pendingReviews]);

    // Local optimistic state for checked/unchecked tasks
    const [locallyCompletedTaskIds, setLocallyCompletedTaskIds] = useState<Set<string>>(new Set());
    const [locallyUncompletedTaskIds, setLocallyUncompletedTaskIds] = useState<Set<string>>(new Set());

    const isTaskCompleted = useCallback((taskId: string, initialStatus: string) => {
        const idStr = String(taskId);
        if (locallyCompletedTaskIds.has(idStr)) return true;
        if (locallyUncompletedTaskIds.has(idStr)) return false;
        return initialStatus === 'Completed';
    }, [locallyCompletedTaskIds, locallyUncompletedTaskIds]);

    // Universal task completion toggle that updates the Progress Bar immediately
    const handleToggleAssignedTask = useCallback((task: DashboardTask) => {
        const taskIdStr = String(task.id);
        const isDone = isTaskCompleted(taskIdStr, task.status);

        // Optimistic toggle
        if (isDone) {
            setLocallyCompletedTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(taskIdStr);
                return next;
            });
            setLocallyUncompletedTaskIds((prev) => new Set(prev).add(taskIdStr));
        } else {
            setLocallyUncompletedTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(taskIdStr);
                return next;
            });
            setLocallyCompletedTaskIds((prev) => new Set(prev).add(taskIdStr));
        }

        const newCompleting = new Set(completingTaskIds);
        newCompleting.add(`task-${taskIdStr}`);
        setCompletingTaskIds(newCompleting);

        if (!isDone && task.requires_review) {
            router.post(
                `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/submit`,
                {},
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setCompletingTaskIds((prev) => {
                            const updated = new Set(prev);
                            updated.delete(`task-${taskIdStr}`);
                            return updated;
                        });
                    },
                }
            );
        } else {
            const nextStatus = isDone ? 'In Progress' : 'Completed';
            router.patch(
                `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}`,
                { status: nextStatus },
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setCompletingTaskIds((prev) => {
                            const updated = new Set(prev);
                            updated.delete(`task-${taskIdStr}`);
                            return updated;
                        });
                    },
                }
            );
        }
    }, [isTaskCompleted, completingTaskIds]);

    // Handle Inline Task Completion from Attention Items
    const handleToggleTaskCompletion = (item: (typeof attentionItems)[0]) => {
        if (!item.rawTask) {
            router.visit(item.actionUrl);
            return;
        }
        handleToggleAssignedTask(item.rawTask);
    };

    // ── Reactive Progress Bar Computation (updates immediately when any task is checked) ──
    const computedCompletedTasks = useMemo(() => {
        return assignedTasks.filter((t) => isTaskCompleted(String(t.id), t.status));
    }, [assignedTasks, isTaskCompleted]);

    const completedTasksCount = computedCompletedTasks.length;
    const totalTasksCount = assignedTasks.length;
    const percentDone = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 100;

    // ── Tasks Ordered by Strict Hierarchy of Importance ──
    // Tier 1: Overdue -> Tier 2: Revision Required -> Tier 3: Due Today -> Tier 4: In Review -> Tier 5: Due Soon -> Tier 6: Other Active -> Tier 7: Completed
    const hierarchyOrderedTasks = useMemo(() => {
        return [...assignedTasks].sort((a, b) => {
            const aDone = isTaskCompleted(String(a.id), a.status);
            const bDone = isTaskCompleted(String(b.id), b.status);
            if (aDone !== bDone) return aDone ? 1 : -1;

            const getHierarchyRank = (t: DashboardTask) => {
                if (t.is_overdue) return 1;
                if (t.status === 'Returned') return 2;
                if (t.due_date === todayStr) return 3;
                if (t.status === 'Under Review') return 4;
                if (t.is_approaching) return 5;
                if (t.status === 'In Progress') return 6;
                return 7;
            };

            const rankDiff = getHierarchyRank(a) - getHierarchyRank(b);
            if (rankDiff !== 0) return rankDiff;
            return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
        });
    }, [assignedTasks, isTaskCompleted, todayStr]);

    const dueThisWeekCount = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        return assignedTasks.filter((t) => {
            if (isTaskCompleted(String(t.id), t.status) || !t.due_date) return false;
            const due = new Date(t.due_date);
            return due >= today && due <= nextWeek;
        }).length;
    }, [assignedTasks, isTaskCompleted]);

    // ── Filtered & Paginated Projects ──
    const filteredProjects = useMemo(() => {
        if (activeTab === 'active') {
            return projects.filter((p) => p.status !== 'Completed');
        }
        if (activeTab === 'completed') {
            return projects.filter((p) => p.status === 'Completed' || (p.progressPercentage ?? 0) >= 100);
        }
        return projects;
    }, [projects, activeTab]);

    const totalProjects = filteredProjects.length;
    const totalPages = Math.max(1, Math.ceil(totalProjects / pageSize));

    // Handle shrinking last page after deletions/filter changes, allowing navigation across tabs 1..5
    const safePage = Math.min(currentPage, Math.max(5, totalPages));
    const paginatedProjects = useMemo(() => {
        const startIndex = (safePage - 1) * pageSize;
        return filteredProjects.slice(startIndex, startIndex + pageSize);
    }, [filteredProjects, safePage, pageSize]);

    // Tab items with counts (All, In Progress, Completed)
    const tabItems = useMemo(() => {
        const activeCount = projects.filter((p) => p.status !== 'Completed').length;
        const completedCount = projects.filter((p) => p.status === 'Completed' || (p.progressPercentage ?? 0) >= 100).length;
        return [
            { id: 'all', label: 'All', count: projects.length },
            { id: 'active', label: 'In Progress', count: activeCount },
            { id: 'completed', label: 'Completed', count: completedCount },
        ];
    }, [projects]);

    // ── First Login Onboarding State (Section 5 requirement) ──
    const isFirstLogin = projects.length === 0;

    const [shortcutLabel, setShortcutLabel] = useState('Ctrl K');
    useEffect(() => {
        if (typeof window !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0) {
            setShortcutLabel('⌘K');
        }
    }, []);

    const createProjectPerm = useMemo(() => {
        return can(
            {
                id: auth?.user?.id,
                name: auth?.user?.name,
                is_admin: auth?.user?.is_admin,
                primaryRole,
                userRoles: (page.props as any).userRoles,
            },
            'create_project'
        );
    }, [auth?.user, primaryRole, page.props]);

    // Template presets for first login pre-fill
    const handleTemplateClick = (title: string, description: string) => {
        if (!createProjectPerm.allowed) return;
        openCreateProjectModal({
            title,
            description,
        });
    };

    // ── Next 7 Days Deadlines (Item 5: small and muted) ──
    const next7DaysDeadlines = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);

        return assignedTasks
            .filter((t) => {
                if (t.status === 'Completed' || !t.due_date) return false;
                const d = new Date(t.due_date);
                return d >= today && d <= nextWeek;
            })
            .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
            .slice(0, 5);
    }, [assignedTasks]);

    // ── Recent Activity (Item 5: small and muted) ──
    const recentActivityItems = useMemo(() => {
        return recentNotifications.slice(0, 5);
    }, [recentNotifications]);

    const firstName = auth?.user?.name ? auth.user.name.split(' ')[0] : 'there';

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title={`Hello, ${firstName} — ITASK`} />

            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
                {/* ══ 1. Page Title, Summary, Search, and Primary Actions ══ */}
                <motion.div variants={cardVariant} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            Hello, {firstName}
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            {summaryText}
                        </p>
                    </div>

                    {!auth?.user?.is_admin ? (
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Existing Search bar trigger (Ctrl+K / ⌘K) placed exclusively on Home */}
                            <button
                                type="button"
                                onClick={() => openCommandPalette()}
                                className="flex items-center justify-between h-9 w-44 sm:w-56 md:w-64 px-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[color:var(--muted)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-left group focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                aria-label="Search and command palette"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Search className="w-4 h-4 text-[color:var(--muted)] group-hover:text-[color:var(--primary)] transition-colors shrink-0 stroke-[2px]" />
                                    <span className="text-[13px] truncate">
                                        Search...
                                    </span>
                                </div>
                                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-[color:var(--muted)] bg-[color:var(--card)] border border-[color:var(--border)] rounded-[4px] shrink-0">
                                    {shortcutLabel}
                                </kbd>
                            </button>

                            <Button
                                variant="secondary"
                                size="md"
                                onClick={() => setIsJoinCodeOpen(true)}
                            >
                                <span>Join project</span>
                            </Button>

                            {createProjectPerm.allowed ? (
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={() => openCreateProjectModal()}
                                    leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                >
                                    <span>Create project</span>
                                </Button>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span tabIndex={0} className="inline-block cursor-not-allowed">
                                            <Button
                                                variant="primary"
                                                size="md"
                                                disabled
                                                className="opacity-50 pointer-events-none"
                                                leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                            >
                                                <span>Create project</span>
                                            </Button>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-[12px] font-medium bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)] max-w-xs shadow-md">
                                        {createProjectPerm.reason || 'Only Project Leaders can create projects.'}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 shrink-0">
                            <Link href="/admin/dashboard">
                                <Button
                                    variant="primary"
                                    size="md"
                                    className="bg-purple-600 hover:bg-purple-700 text-white"
                                    leftIcon={<ShieldCheck className="w-4 h-4 shrink-0 stroke-[2.5]" />}
                                >
                                    <span>Admin Console</span>
                                </Button>
                            </Link>
                        </div>
                    )}
                </motion.div>

                {/* Administrator Dedicated Banner */}
                {auth?.user?.is_admin && (
                    <motion.div variants={cardVariant} className="p-4 rounded-[10px] bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[14px] font-bold text-[color:var(--text)]">
                                    Dedicated Administrator Workspace
                                </h3>
                                <p className="text-[12px] text-[color:var(--muted)] mt-0.5 truncate sm:whitespace-normal">
                                    Your role is restricted strictly to System Administration responsibilities. Access your dedicated interface for User Governance, Projects Oversight, Audit Logs & System Settings.
                                </p>
                            </div>
                        </div>
                        <Link href="/admin/dashboard">
                            <Button variant="outline" size="sm" className="border-purple-500/40 text-purple-600 dark:text-purple-400 shrink-0">
                                <span>Open Admin Console →</span>
                            </Button>
                        </Link>
                    </motion.div>
                )}

                {/* ══ FIRST LOGIN ONBOARDING (Section 5: shown when no projects yet) ══ */}
                {isFirstLogin && (
                    <motion.div variants={cardVariant} whileHover={{ y: -2 }}>
                        <Card className="p-6 border-[color:var(--primary)] bg-[color:var(--card)] space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--primary)]" />
                                        <h2 className="text-[18px] font-bold text-[color:var(--text)]">
                                            Welcome to ITASK! Get started in 3 steps
                                        </h2>
                                    </div>
                                    <p className="text-[14px] text-[color:var(--muted)] mt-1">
                                        Set up your project workspace, collaborate with teammates, and track assignments.
                                    </p>
                                </div>
                                <Badge variant="accent">
                                    Step 1 of 3 complete
                                </Badge>
                            </div>

                            {/* 3-Step Checklist */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="p-3.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] flex items-center justify-center shrink-0 mt-0.5">
                                        <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-[color:var(--text)]">
                                            1. Account created
                                        </p>
                                        <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                            Your institutional account is verified.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-[8px] bg-[color:var(--card)] border border-[color:var(--primary)] flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-[color:var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="w-2 h-2 rounded-full bg-[color:var(--primary)]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-[color:var(--text)]">
                                            2. Create or join a project
                                        </p>
                                        <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                            Start a new team or enter an invite code.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] opacity-60 flex items-start gap-3">
                                    <div className="w-5 h-5 rounded-full border border-[color:var(--border)] shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-[color:var(--text)]">
                                            3. Add your first task
                                        </p>
                                        <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                            Assign deliverables with deadlines.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Two Clear Actions */}
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                {createProjectPerm.allowed ? (
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={() => openCreateProjectModal()}
                                        leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                    >
                                        <span>Create a project</span>
                                    </Button>
                                ) : (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span tabIndex={0} className="inline-block cursor-not-allowed">
                                                <Button
                                                    variant="primary"
                                                    size="md"
                                                    disabled
                                                    className="opacity-50 pointer-events-none"
                                                    leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                                >
                                                    <span>Create a project</span>
                                                </Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-[12px] font-medium bg-[color:var(--card)] text-[color:var(--text)] border border-[color:var(--border)] max-w-xs shadow-md">
                                            {createProjectPerm.reason || 'Only Project Leaders can create projects.'}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setIsJoinCodeOpen(true)}
                                >
                                    <span>Join with a code</span>
                                </Button>
                            </div>

                            {/* Template Buttons (pre-fill create modal) */}
                            <div className="pt-2 border-t border-[color:var(--border)]">
                                <p className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)] mb-2.5">
                                    Or start from a template
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleTemplateClick(
                                            'Senior Design Thesis & Capstone',
                                            'Undergraduate engineering capstone project documentation, requirements, and sprint deliverables.'
                                        )}
                                        className="p-3 text-left rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-[13px] font-medium text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    >
                                        <BookOpen className="w-4 h-4 text-[color:var(--primary)] mb-1" />
                                        Thesis or capstone
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTemplateClick(
                                            'Systems Analysis & Design Group Project',
                                            'Collaborative coursework deliverables, system architecture models, and milestone reporting.'
                                        )}
                                        className="p-3 text-left rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-[13px] font-medium text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    >
                                        <Users className="w-4 h-4 text-[color:var(--primary)] mb-1" />
                                        Group class project
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTemplateClick(
                                            'Annual IT Department Hackathon & Symposium',
                                            'Logistics coordination, sponsorship drives, participant registration, and venue planning.'
                                        )}
                                        className="p-3 text-left rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-[13px] font-medium text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    >
                                        <CalendarDays className="w-4 h-4 text-[color:var(--primary)] mb-1" />
                                        Event planning
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTemplateClick(
                                            'Independent Research & Study Tracker',
                                            'Individual academic research tracking, literature reviews, and personal milestones.'
                                        )}
                                        className="p-3 text-left rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] transition-colors cursor-pointer text-[13px] font-medium text-[color:var(--text)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                    >
                                        <FileText className="w-4 h-4 text-[color:var(--primary)] mb-1" />
                                        Personal to-dos
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                )}

                {/* ══ 2. "Needs Your Attention" Card & 3. Compact "This Week" Card ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5">
                    {/* Item 2: Needs Your Attention (The only card with a primary left edge) */}
                    <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="h-full">
                        <Card
                            isAttention={true}
                            className="p-5 h-full flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-center justify-between gap-3 pb-3.5 mb-3 border-b border-[color:var(--border)]">
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-[16px] font-bold text-[color:var(--text)]">
                                            Needs your attention
                                        </h2>
                                        {attentionItems.length > 0 && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] border border-[color:var(--status-danger-border)] tabular-nums">
                                                {attentionItems.length}
                                            </span>
                                        )}
                                    </div>
                                    <Link
                                        href="/my-tasks"
                                        className="text-[13px] font-medium text-[color:var(--primary)] hover:underline"
                                    >
                                        View all tasks
                                    </Link>
                                </div>

                                {attentionItems.length === 0 ? (
                                    <div className="py-8 text-center space-y-2">
                                        <div className="w-10 h-10 rounded-full bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] flex items-center justify-center mx-auto">
                                            <CheckCircle2 className="w-5 h-5 stroke-[2]" />
                                        </div>
                                        <p className="text-[14px] font-semibold text-[color:var(--text)]">
                                            You are all caught up
                                        </p>
                                        <p className="text-[13px] text-[color:var(--muted)] max-w-sm mx-auto">
                                            No overdue tasks, returned items, or pending reviews require your immediate action.
                                        </p>
                                    </div>
                                ) : (
                                    <motion.div variants={staggerContainer} className="divide-y divide-[color:var(--border)]">
                                        <AnimatePresence mode="popLayout">
                                            {attentionItems.slice(0, 5).map((item) => {
                                                const isDone = item.rawTask ? isTaskCompleted(String(item.rawTask.id), item.rawTask.status) : false;
                                                const isCompleting = completingTaskIds.has(item.id);
                                                return (
                                                    <motion.div
                                                        key={item.id}
                                                        variants={rowVariant}
                                                        layout
                                                        whileHover={{ x: 2 }}
                                                        className={`py-3 first:pt-0 last:pb-0 flex items-start gap-3 transition-opacity ${
                                                            isCompleting ? 'opacity-40 pointer-events-none' : ''
                                                        }`}
                                                    >
                                                        <div className="pt-0.5 shrink-0">
                                                            <Checkbox
                                                                checked={isDone || isCompleting}
                                                                onChange={() => handleToggleTaskCompletion(item)}
                                                                aria-label={`Mark ${item.title} as ${isDone ? 'incomplete' : 'completed'}`}
                                                            />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <Link
                                                                    href={item.actionUrl}
                                                                    className={`text-[14px] font-semibold transition-colors truncate hover:text-[color:var(--primary)] ${
                                                                        isDone
                                                                            ? 'line-through text-[color:var(--muted)]'
                                                                            : 'text-[color:var(--text)]'
                                                                    }`}
                                                                >
                                                                    {item.title}
                                                                </Link>
                                                                <Badge variant={isDone ? 'accent' : item.badgeVariant}>
                                                                    {isDone ? 'Completed' : item.badgeLabel}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-[12px] text-[color:var(--muted)] mt-0.5 truncate">
                                                                <span className="font-medium text-[color:var(--text)]">
                                                                    {item.projectTitle}
                                                                </span>
                                                                {item.committeeName && ` · ${item.committeeName}`}
                                                                {item.activityTitle && ` · ${item.activityTitle}`}
                                                                {item.dueDateFormatted && (
                                                                    <span className="tabular-nums ml-1">
                                                                        · Due {item.dueDateFormatted}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </motion.div>
                                )}
                            </div>

                            {attentionItems.length > 5 && (
                                <div className="pt-3 border-t border-[color:var(--border)] text-[12px] text-[color:var(--muted)] flex items-center justify-between">
                                    <span className="tabular-nums">Showing 5 of {attentionItems.length} urgent items</span>
                                    <Link
                                        href="/my-tasks"
                                        className="font-medium text-[color:var(--primary)] hover:underline"
                                    >
                                        Open My Tasks
                                    </Link>
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Item 3: Progress Bar & Interactive Checklist Card */}
                    <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="h-full">
                        <Card className="p-5 h-full flex flex-col justify-between space-y-4">
                            <div className="space-y-4">
                                {/* Card Header & Percentage */}
                                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[color:var(--border)]">
                                    <div>
                                        <h2 className="text-[16px] font-bold text-[color:var(--text)]">
                                            Weekly Deliverables
                                        </h2>
                                        <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                            Check off tasks to advance your progress
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <motion.span
                                            key={percentDone}
                                            initial={{ scale: 1.15 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', damping: 15 }}
                                            className="text-[16px] font-bold text-[color:var(--text)] tabular-nums block inline-block"
                                        >
                                            {percentDone}% done
                                        </motion.span>
                                        <span className="text-[11px] font-medium text-[color:var(--muted)] tabular-nums">
                                            {completedTasksCount} of {totalTasksCount} completed
                                        </span>
                                    </div>
                                </div>

                                {/* ── Dynamic Progress Bar ── */}
                                <div className="space-y-1.5">
                                    <div className="w-full h-3 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner p-[1px]">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-[color:var(--primary)] via-indigo-500 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentDone}%` }}
                                            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                                            role="progressbar"
                                            aria-valuenow={percentDone}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        />
                                    </div>
                                </div>

                                {/* Dense Metric Pills by Hierarchy of Importance */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                                        <span className="text-[11px] text-[color:var(--muted)] block">Overdue</span>
                                        <span className="text-[13px] font-bold text-[color:var(--status-danger-text)] tabular-nums">
                                            {overdueCount}
                                        </span>
                                    </div>

                                    <div className="p-2 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                                        <span className="text-[11px] text-[color:var(--muted)] block">This week</span>
                                        <span className="text-[13px] font-bold text-[color:var(--text)] tabular-nums">
                                            {dueThisWeekCount}
                                        </span>
                                    </div>

                                    <div className="p-2 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                                        <span className="text-[11px] text-[color:var(--muted)] block">Completed</span>
                                        <span className="text-[13px] font-bold text-[color:var(--status-success-text)] tabular-nums">
                                            {completedTasksCount}
                                        </span>
                                    </div>
                                </div>

                                {/* ── Progress Bar Checklist (Ordered by Hierarchy of Importance) ── */}
                                <div className="pt-2 border-t border-[color:var(--border)] space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <ClipboardCheck className="w-3.5 h-3.5 text-[color:var(--primary)]" />
                                            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--text)]">
                                                Task Checklist
                                            </h3>
                                        </div>
                                        <span className="text-[11px] font-medium text-[color:var(--muted)]">
                                            Hierarchy of Importance
                                        </span>
                                    </div>

                                    {hierarchyOrderedTasks.length === 0 ? (
                                        <div className="py-4 text-center text-[12px] text-[color:var(--muted)]">
                                            No assigned tasks in your checklist yet.
                                        </div>
                                    ) : (
                                        <motion.div variants={staggerContainer} className="space-y-1.5 max-h-64 overflow-y-auto pr-1 divide-y divide-[color:var(--border)]">
                                            <AnimatePresence mode="popLayout">
                                                {hierarchyOrderedTasks.slice(0, 6).map((task) => {
                                                    const isDone = isTaskCompleted(String(task.id), task.status);
                                                    const isBusy = completingTaskIds.has(`task-${task.id}`);

                                                    // Hierarchy badge determination
                                                    let importanceBadgeVariant: 'danger' | 'warning' | 'primary' | 'secondary' | 'accent' | 'soft' = 'soft';
                                                    let importanceLabel = task.status;
                                                    if (isDone) {
                                                        importanceBadgeVariant = 'accent';
                                                        importanceLabel = 'Completed';
                                                    } else if (task.is_overdue) {
                                                        importanceBadgeVariant = 'danger';
                                                        importanceLabel = 'Tier 1: Overdue';
                                                    } else if (task.status === 'Returned') {
                                                        importanceBadgeVariant = 'danger';
                                                        importanceLabel = 'Tier 2: Revision';
                                                    } else if (task.due_date === todayStr) {
                                                        importanceBadgeVariant = 'warning';
                                                        importanceLabel = 'Tier 3: Due today';
                                                    } else if (task.status === 'Under Review') {
                                                        importanceBadgeVariant = 'secondary';
                                                        importanceLabel = 'Tier 4: In review';
                                                    } else if (task.is_approaching) {
                                                        importanceBadgeVariant = 'primary';
                                                        importanceLabel = 'Tier 5: Due soon';
                                                    } else {
                                                        importanceBadgeVariant = 'soft';
                                                        importanceLabel = 'Tier 6: Active';
                                                    }

                                                    return (
                                                        <motion.div
                                                            key={task.id}
                                                            variants={rowVariant}
                                                            layout
                                                            whileHover={{ x: 2 }}
                                                            className={`pt-2 pb-1.5 flex items-start gap-2.5 transition-opacity ${
                                                                isBusy ? 'opacity-50 pointer-events-none' : ''
                                                            }`}
                                                        >
                                                            <div className="pt-0.5 shrink-0">
                                                                <Checkbox
                                                                    checked={isDone}
                                                                    onChange={() => handleToggleAssignedTask(task)}
                                                                    aria-label={`Toggle checklist task ${task.title}`}
                                                                />
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                                    <Link
                                                                        href={task.action_url}
                                                                        className={`text-[13px] font-semibold transition-colors truncate hover:text-[color:var(--primary)] ${
                                                                            isDone
                                                                                ? 'line-through text-[color:var(--muted)]'
                                                                                : 'text-[color:var(--text)]'
                                                                        }`}
                                                                    >
                                                                        {task.title}
                                                                    </Link>
                                                                    <Badge variant={importanceBadgeVariant} className="text-[10px] px-1.5 py-0.2 shrink-0">
                                                                        {importanceLabel}
                                                                    </Badge>
                                                                </div>

                                                                <p className="text-[11px] text-[color:var(--muted)] mt-0.5 truncate">
                                                                    <span>{task.project.title}</span>
                                                                    {task.committee && ` · ${task.committee.name}`}
                                                                    {task.due_date_formatted && (
                                                                        <span className="tabular-nums ml-1">
                                                                            · Due {task.due_date_formatted}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </AnimatePresence>
                                        </motion.div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-between text-[12px]">
                                <Link
                                    href="/my-tasks"
                                    className="font-medium text-[color:var(--primary)] hover:underline"
                                >
                                    View full checklist ({assignedTasks.length})
                                </Link>
                                <Link
                                    href="/calendar"
                                    className="font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] inline-flex items-center gap-1"
                                >
                                    <span>Calendar</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </Card>
                    </motion.div>
                </div>

                {/* ══ 4. Projects Table with Tabs & Real Pagination ══ */}
                <motion.div variants={cardVariant} whileHover={{ y: -2 }}>
                    <Card className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                            <div>
                                <h2 className="text-[16px] font-bold text-[color:var(--text)]">
                                    Projects
                                </h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                    Collaborative workspaces and committee progress
                                </p>
                            </div>

                            {/* Tabs: All, In Progress, Completed */}
                            <Tabs
                                tabs={tabItems}
                                activeTab={activeTab}
                                onChange={handleTabChange}
                            />
                        </div>

                        {/* Table View */}
                        {paginatedProjects.length === 0 ? (
                            <EmptyState
                                title={filteredProjects.length === 0 ? "No projects match this filter" : `No projects on page ${safePage}`}
                                description={
                                    filteredProjects.length === 0
                                        ? activeTab === 'all'
                                            ? "You haven't joined or created any projects yet."
                                            : `There are no projects currently ${activeTab === 'active' ? 'in progress' : 'completed'}.`
                                        : `You are viewing page ${safePage}. Click page 1 to view your projects.`
                                }
                                actionLabel={
                                    filteredProjects.length === 0
                                        ? activeTab === 'all'
                                            ? createProjectPerm.allowed
                                                ? "Create a project"
                                                : undefined
                                            : "View all projects"
                                        : "Go to page 1"
                                }
                                onAction={
                                    filteredProjects.length === 0
                                        ? activeTab === 'all'
                                            ? createProjectPerm.allowed
                                                ? openCreateProjectModal
                                                : undefined
                                            : () => handleTabChange('all')
                                        : () => handlePageChange(1)
                                }
                            />
                        ) : (
                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-[color:var(--border)] text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                            <th className="py-2.5 pr-4">Project</th>
                                            <th className="py-2.5 px-3 min-w-[200px]">Progress</th>
                                            <th className="py-2.5 px-3">Due date</th>
                                            <th className="py-2.5 pl-3 text-right">Team</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)] text-[14px]">
                                        {paginatedProjects.map((project) => {
                                            const progress = project.progressPercentage ?? 0;
                                            const isDone = progress >= 100 || project.status === 'Completed';

                                            return (
                                                <tr
                                                    key={project.id}
                                                    className="hover:bg-[color:var(--soft-surface)] transition-colors group"
                                                >
                                                    {/* Project */}
                                                    <td className="py-3.5 pr-4 min-w-[200px]">
                                                        <div className="flex items-center gap-2">
                                                            <Link
                                                                href={`/projects/${project.id}`}
                                                                className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate"
                                                            >
                                                                {project.title}
                                                            </Link>
                                                            <ProjectRoleBadge role={project.role} />
                                                        </div>
                                                        {project.description && (
                                                            <p className="text-[12px] text-[color:var(--muted)] truncate max-w-sm mt-0.5">
                                                                {project.description}
                                                            </p>
                                                        )}
                                                    </td>

                                                    {/* Highlighted Progress Bar */}
                                                    <td className="py-3.5 px-3 min-w-[200px]">
                                                        <div className="flex flex-col gap-1.5 justify-center">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span
                                                                        className={`w-2 h-2 rounded-full ${
                                                                            isDone
                                                                                ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                                                                : 'bg-[color:var(--primary)] animate-pulse ring-2 ring-[color:var(--primary)]/20'
                                                                        }`}
                                                                    />
                                                                    <span className="text-[11px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                                                        {isDone ? 'Completed' : 'In Progress'}
                                                                    </span>
                                                                </div>
                                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-[color:var(--primary)]/10 text-[color:var(--primary)] border border-[color:var(--primary)]/20 shadow-2xs">
                                                                    {progress}%
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-2.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner p-[1px]">
                                                                <motion.div
                                                                    className={`h-full rounded-full transition-all ${
                                                                        isDone
                                                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                                                            : 'bg-gradient-to-r from-[color:var(--primary)] via-indigo-500 to-emerald-400 shadow-[0_0_8px_rgba(99,102,241,0.35)]'
                                                                    }`}
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${Math.max(3, progress)}%` }}
                                                                    transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Due Date */}
                                                    <td className="py-3.5 px-3 whitespace-nowrap text-[13px] text-[color:var(--muted)] tabular-nums">
                                                        {project.end_date || '—'}
                                                    </td>

                                                    {/* Team Avatars */}
                                                    <td className="py-3.5 pl-3 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end -space-x-1.5">
                                                            <Avatar className="w-6 h-6 border-2 border-[color:var(--card)]">
                                                                <AvatarFallback className="text-[10px]">
                                                                    {getInitials(project.role || 'M')}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="w-6 h-6 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[10px] font-semibold text-[color:var(--muted)] flex items-center justify-center tabular-nums">
                                                                +{project.tasksCount || 1}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Real Pagination: page numbers, prev/next, rows per page, URL sync */}
                        {totalProjects > 0 && (
                            <div className="pt-2 border-t border-[color:var(--border)] flex justify-center w-full">
                                <Pagination
                                    currentPage={safePage}
                                    totalPages={totalPages}
                                    totalItems={totalProjects}
                                    pageSize={pageSize}
                                    onPageChange={handlePageChange}
                                    onPageSizeChange={handlePageSizeChange}
                                    pageSizeOptions={[5, 10, 25]}
                                />
                            </div>
                        )}
                    </Card>
                </motion.div>

                {/* ══ 5. Small and Muted: Next 7 Days Deadlines and Recent Activity ══ */}
                <motion.div variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                    {/* Next 7 Days Deadlines */}
                    <motion.div variants={cardVariant} whileHover={{ y: -2 }}>
                        <div className="p-4 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[color:var(--border)]">
                                <h3 className="text-[14px] font-semibold text-[color:var(--muted)] flex items-center gap-2">
                                    <Calendar className="w-4 h-4 stroke-[2]" />
                                    Next 7 days deadlines
                                </h3>
                                <Link
                                    href="/calendar"
                                    className="text-[12px] font-medium text-[color:var(--primary)] hover:underline"
                                >
                                    Calendar
                                </Link>
                            </div>

                            {next7DaysDeadlines.length === 0 ? (
                                <p className="text-[13px] text-[color:var(--muted)] py-3">
                                    No deadlines scheduled in the next 7 days.
                                </p>
                            ) : (
                                <div className="divide-y divide-[color:var(--border)]">
                                    {next7DaysDeadlines.map((task) => (
                                        <div
                                            key={task.id}
                                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-[13px]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={task.action_url}
                                                    className="font-medium text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate block"
                                                >
                                                    {task.title}
                                                </Link>
                                                <span className="text-[11px] text-[color:var(--muted)] truncate block">
                                                    {task.project.title}
                                                </span>
                                            </div>
                                            <span className="text-[12px] text-[color:var(--muted)] tabular-nums shrink-0">
                                                {task.due_date_formatted}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div variants={cardVariant} whileHover={{ y: -2 }}>
                        <div className="p-4 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--card)] space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[color:var(--border)]">
                                <h3 className="text-[14px] font-semibold text-[color:var(--muted)] flex items-center gap-2">
                                    <Activity className="w-4 h-4 stroke-[2]" />
                                    Recent activity
                                </h3>
                                <Link
                                    href="/notifications"
                                    className="text-[12px] font-medium text-[color:var(--primary)] hover:underline"
                                >
                                    All activity
                                </Link>
                            </div>

                            {recentActivityItems.length === 0 ? (
                                <p className="text-[13px] text-[color:var(--muted)] py-3">
                                    No recent activity logged.
                                </p>
                            ) : (
                                <div className="divide-y divide-[color:var(--border)]">
                                    {recentActivityItems.map((item) => (
                                        <div
                                            key={item.id}
                                            className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-[13px]"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium text-[color:var(--text)] truncate">
                                                    {item.data?.title || (item as any).title || 'Notification'}
                                                </p>
                                                <p className="text-[11px] text-[color:var(--muted)] truncate">
                                                    {item.data?.message || (item as any).message || ''}
                                                </p>
                                            </div>
                                            <span className="text-[11px] text-[color:var(--muted)] tabular-nums shrink-0">
                                                {item.created_at}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>

            {/* Modal for joining project by invite code */}
            <JoinProjectModal
                isOpen={isJoinCodeOpen}
                onClose={() => setIsJoinCodeOpen(false)}
            />
        </AppLayout>
    );
}
