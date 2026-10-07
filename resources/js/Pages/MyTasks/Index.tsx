import React, { useState, useMemo, useCallback } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    Search,
    ChevronDown,
    X,
    CheckSquare,
    AlertCircle,
    Clock,
    Filter,
    Calendar,
    FolderOpen,
    CheckCircle2,
    ClipboardCheck,
    Shield,
    AlertTriangle,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { Checkbox } from '@/Components/Checkbox';
import { Pagination } from '@/Components/Pagination';
import { EmptyState } from '@/Components/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskProject {
    id: string;
    title: string;
    status: string;
}

interface TaskCommittee {
    id: string;
    name: string;
}

interface TaskActivity {
    id: string;
    title: string;
    status: string;
    due_date_formatted: string | null;
}

interface MyTask {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    due_date_formatted: string | null;
    requires_review: boolean;
    is_overdue: boolean;
    is_approaching: boolean;
    is_mine: boolean;
    assignee: { id: number; name: string } | null;
    project: TaskProject;
    committee: TaskCommittee;
    activity: TaskActivity;
    checklist_total: number;
    checklist_completed: number;
    action_url: string;
}

interface TaskStats {
    total: number;
    todo: number;
    in_progress: number;
    under_review: number;
    completed: number;
    returned: number;
    overdue: number;
}

interface MyTasksIndexProps {
    tasks: MyTask[];
    stats: TaskStats;
    roleContext: 'leader' | 'staff' | 'member';
}

function formatDueDate(dueDateStr: string | null): string {
    if (!dueDateStr) return '—';
    const parts = dueDateStr.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }
    return dueDateStr;
}

function getDaysDiff(dueDateStr: string | null): number | null {
    if (!dueDateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dueDateStr.split('-');
    if (parts.length !== 3) return null;
    const dueDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function renderDaysBadge(task: MyTask, isDone: boolean) {
    if (isDone) {
        return <Badge variant="accent">Completed</Badge>;
    }

    const diffDays = getDaysDiff(task.due_date);
    if (diffDays === null) {
        return <span className="text-[13px] text-[color:var(--muted)]">—</span>;
    }

    if (diffDays < 0 || task.is_overdue) {
        return (
            <Badge variant="danger">
                {Math.abs(diffDays)}d overdue
            </Badge>
        );
    }

    if (diffDays === 0) {
        return <Badge variant="secondary">Due today</Badge>;
    }

    if (diffDays <= 7) {
        return <Badge variant="secondary">{diffDays}d left</Badge>;
    }

    return (
        <span className="text-[13px] text-[color:var(--muted)] tabular-nums">
            {diffDays}d
        </span>
    );
}

function getHierarchyRank(task: MyTask, isDone: boolean): number {
    if (isDone) return 7;
    const diff = getDaysDiff(task.due_date);
    if (task.is_overdue || (diff !== null && diff < 0)) return 1;
    if (task.status === 'Returned') return 2;
    if (diff === 0) return 3;
    if (task.status === 'Under Review') return 4;
    if (task.is_approaching || (diff !== null && diff <= 7)) return 5;
    return 6; // In Progress / To Do
}

function getImportanceBadge(task: MyTask, isDone: boolean) {
    if (isDone) {
        return <Badge variant="accent">Done</Badge>;
    }
    const diff = getDaysDiff(task.due_date);
    if (task.is_overdue || (diff !== null && diff < 0)) {
        return <Badge variant="danger">Overdue</Badge>;
    }
    if (task.status === 'Returned') {
        return <Badge variant="danger">Revision</Badge>;
    }
    if (diff === 0) {
        return <Badge variant="secondary">Due Today</Badge>;
    }
    if (task.status === 'Under Review') {
        return <Badge variant="secondary">In Review</Badge>;
    }
    if (task.is_approaching || (diff !== null && diff <= 7)) {
        return <Badge variant="primary">Due Soon</Badge>;
    }
    return <Badge variant="soft">{task.status}</Badge>;
}

export default function MyTasksIndex({ tasks = [], stats, roleContext }: MyTasksIndexProps) {
    // ── URL Synchronization for Filters & Pagination ──
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialStatus = searchParams.get('status') || 'ALL';
    const initialProject = searchParams.get('project') || 'ALL';
    const initialSearch = searchParams.get('q') || '';
    const initialPage = parseInt(searchParams.get('page') || '1', 10);
    const initialSize = parseInt(searchParams.get('size') || '10', 10);

    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
    const [projectFilter, setProjectFilter] = useState<string>(initialProject);
    const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
    const [currentPage, setCurrentPage] = useState<number>(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
    const [pageSize, setPageSize] = useState<number>([10, 25, 50].includes(initialSize) ? initialSize : 10);

    // Track locally completing tasks for optimistic UI
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
    const [locallyCompletedTaskIds, setLocallyCompletedTaskIds] = useState<Set<string>>(new Set());
    const [locallyUncompletedTaskIds, setLocallyUncompletedTaskIds] = useState<Set<string>>(new Set());

    const isTaskCompleted = useCallback((taskId: string, initialStatus: string) => {
        const idStr = String(taskId);
        if (locallyCompletedTaskIds.has(idStr)) return true;
        if (locallyUncompletedTaskIds.has(idStr)) return false;
        return initialStatus === 'Completed';
    }, [locallyCompletedTaskIds, locallyUncompletedTaskIds]);

    const updateUrlParams = useCallback((newStatus: string, newProject: string, newQuery: string, newPage: number, newSize: number) => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (newStatus !== 'ALL') url.searchParams.set('status', newStatus); else url.searchParams.delete('status');
        if (newProject !== 'ALL') url.searchParams.set('project', newProject); else url.searchParams.delete('project');
        if (newQuery) url.searchParams.set('q', newQuery); else url.searchParams.delete('q');
        url.searchParams.set('page', String(newPage));
        url.searchParams.set('size', String(newSize));
        window.history.replaceState({}, '', url.toString());
    }, []);

    const handleStatusFilterChange = (status: string) => {
        setStatusFilter(status);
        setCurrentPage(1);
        updateUrlParams(status, projectFilter, searchTerm, 1, pageSize);
    };

    const handleProjectFilterChange = (proj: string) => {
        setProjectFilter(proj);
        setCurrentPage(1);
        updateUrlParams(statusFilter, proj, searchTerm, 1, pageSize);
    };

    const handleSearchChange = (query: string) => {
        setSearchTerm(query);
        setCurrentPage(1);
        updateUrlParams(statusFilter, projectFilter, query, 1, pageSize);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        updateUrlParams(statusFilter, projectFilter, searchTerm, page, pageSize);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
        updateUrlParams(statusFilter, projectFilter, searchTerm, 1, size);
    };

    // Derive project options
    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => map.set(t.project.id, t.project.title));
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [tasks]);

    // ── Universal Task Completion Toggle (updates Progress Bar immediately) ──
    const handleToggleTaskCompletion = (task: MyTask) => {
        const isDone = isTaskCompleted(task.id, task.status);

        if (isDone) {
            setLocallyCompletedTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
            setLocallyUncompletedTaskIds((prev) => new Set(prev).add(task.id));
        } else {
            setLocallyUncompletedTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
            setLocallyCompletedTaskIds((prev) => new Set(prev).add(task.id));
        }

        const newCompleting = new Set(completingTaskIds);
        newCompleting.add(task.id);
        setCompletingTaskIds(newCompleting);

        if (!isDone && task.requires_review) {
            router.post(
                `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/submit`,
                {},
                {
                    preserveScroll: true,
                    onFinish: () => {
                        setCompletingTaskIds((prev) => {
                            const next = new Set(prev);
                            next.delete(task.id);
                            return next;
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
                            const next = new Set(prev);
                            next.delete(task.id);
                            return next;
                        });
                    },
                }
            );
        }
    };

    // ── Reactive Progress Bar & Metrics Calculations ──
    const completedTasksCount = useMemo(() => {
        return tasks.filter((t) => isTaskCompleted(t.id, t.status)).length;
    }, [tasks, isTaskCompleted]);

    const totalTasksCount = tasks.length;
    const percentDone = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 100;

    const overdueCount = useMemo(() => {
        return tasks.filter((t) => {
            if (isTaskCompleted(t.id, t.status)) return false;
            const diff = getDaysDiff(t.due_date);
            return t.is_overdue || (diff !== null && diff < 0);
        }).length;
    }, [tasks, isTaskCompleted]);

    const returnedCount = useMemo(() => {
        return tasks.filter((t) => !isTaskCompleted(t.id, t.status) && t.status === 'Returned').length;
    }, [tasks, isTaskCompleted]);

    const dueTodayCount = useMemo(() => {
        return tasks.filter((t) => {
            if (isTaskCompleted(t.id, t.status)) return false;
            const diff = getDaysDiff(t.due_date);
            return diff === 0;
        }).length;
    }, [tasks, isTaskCompleted]);

    const inReviewCount = useMemo(() => {
        return tasks.filter((t) => !isTaskCompleted(t.id, t.status) && t.status === 'Under Review').length;
    }, [tasks, isTaskCompleted]);

    const dueThisWeekCount = useMemo(() => {
        return tasks.filter((t) => {
            if (isTaskCompleted(t.id, t.status)) return false;
            const diff = getDaysDiff(t.due_date);
            return diff !== null && diff > 0 && diff <= 7;
        }).length;
    }, [tasks, isTaskCompleted]);

    // ── Hierarchy of Importance Ordered Tasks for the Quick Checklist ──
    const hierarchyOrderedTasks = useMemo(() => {
        return [...tasks].sort((a, b) => {
            const aDone = isTaskCompleted(a.id, a.status);
            const bDone = isTaskCompleted(b.id, b.status);
            if (aDone !== bDone) return aDone ? 1 : -1;

            const rankDiff = getHierarchyRank(a, aDone) - getHierarchyRank(b, bDone);
            if (rankDiff !== 0) return rankDiff;

            return (a.due_date || '9999-99-99').localeCompare(b.due_date || '9999-99-99');
        });
    }, [tasks, isTaskCompleted]);

    // Filter tasks based on search, project, and status
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            if (projectFilter !== 'ALL' && task.project.id !== projectFilter) {
                return false;
            }

            const isDone = isTaskCompleted(task.id, task.status);
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'ACTIVE' && isDone) return false;
                if (statusFilter === 'Completed' && !isDone) return false;
                if (statusFilter !== 'ACTIVE' && statusFilter !== 'Completed' && task.status !== statusFilter) return false;
            }

            if (searchTerm.trim() !== '') {
                const query = searchTerm.toLowerCase();
                const matchesTask = task.title.toLowerCase().includes(query);
                const matchesDesc = (task.description || '').toLowerCase().includes(query);
                const matchesActivity = task.activity.title.toLowerCase().includes(query);
                const matchesCommittee = task.committee.name.toLowerCase().includes(query);
                const matchesProject = task.project.title.toLowerCase().includes(query);
                if (!matchesTask && !matchesDesc && !matchesActivity && !matchesCommittee && !matchesProject) {
                    return false;
                }
            }

            return true;
        });
    }, [tasks, projectFilter, statusFilter, searchTerm, isTaskCompleted]);

    // Client-side pagination calculations
    const totalItems = filteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, totalPages);

    const paginatedTasks = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredTasks.slice(start, start + pageSize);
    }, [filteredTasks, safePage, pageSize]);

    // ── Grouping into Strict Hierarchy of Importance Categories ──
    // Tier 1: Overdue -> Tier 2: Revision -> Tier 3: Due Today -> Tier 4: In Review -> Tier 5: Due This Week -> Tier 6: Later -> Tier 7: Completed
    const groupedTasks = useMemo(() => {
        const overdue: MyTask[] = [];
        const returned: MyTask[] = [];
        const today: MyTask[] = [];
        const inReview: MyTask[] = [];
        const thisWeek: MyTask[] = [];
        const later: MyTask[] = [];
        const completed: MyTask[] = [];

        paginatedTasks.forEach((task) => {
            const isDone = isTaskCompleted(task.id, task.status);
            if (isDone) {
                completed.push(task);
                return;
            }

            if (task.status === 'Returned') {
                returned.push(task);
                return;
            }

            if (task.status === 'Under Review') {
                inReview.push(task);
                return;
            }

            const diff = getDaysDiff(task.due_date);
            if (diff === null) {
                later.push(task);
            } else if (diff < 0 || task.is_overdue) {
                overdue.push(task);
            } else if (diff === 0) {
                today.push(task);
            } else if (diff <= 7) {
                thisWeek.push(task);
            } else {
                later.push(task);
            }
        });

        return [
            { id: 'overdue', title: 'Overdue (Critical)', tasks: overdue, badgeVariant: 'danger' as const },
            { id: 'returned', title: 'Revision Required', tasks: returned, badgeVariant: 'danger' as const },
            { id: 'today', title: 'Due Today', tasks: today, badgeVariant: 'secondary' as const },
            { id: 'under_review', title: 'Under Review', tasks: inReview, badgeVariant: 'secondary' as const },
            { id: 'this_week', title: 'Due This Week', tasks: thisWeek, badgeVariant: 'primary' as const },
            { id: 'later', title: 'Later & Active', tasks: later, badgeVariant: 'secondary' as const },
            ...(completed.length > 0 ? [{ id: 'completed', title: 'Completed', tasks: completed, badgeVariant: 'accent' as const }] : []),
        ].filter((group) => group.tasks.length > 0);
    }, [paginatedTasks, isTaskCompleted]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="My Tasks" />

            <div className="space-y-6">
                {/* ══ 1. Page Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            My Tasks
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            Cross-project deliverables assigned to you, organized by Hierarchy of Importance.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Link href="/calendar">
                            <Button variant="secondary" size="md">
                                <Calendar className="w-4 h-4 mr-1.5" strokeWidth={2} />
                                <span>Calendar view</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ══ 2. Deliverables Progress Bar & Interactive Checklist Card ══ */}
                <Card className="p-5 space-y-4">
                    {/* Header and Live Completion Stats */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[color:var(--border)]">
                        <div>
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-[color:var(--primary)]" />
                                <h2 className="text-[17px] font-bold text-[color:var(--text)]">
                                    Deliverables Progress
                                </h2>
                            </div>
                            <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                Check off deliverables below to advance your progress in real time.
                            </p>
                        </div>
                        <div className="sm:text-right shrink-0">
                            <span className="text-[18px] font-bold text-[color:var(--text)] tabular-nums block">
                                {percentDone}% done
                            </span>
                            <span className="text-[12px] font-medium text-[color:var(--muted)] tabular-nums">
                                {completedTasksCount} of {totalTasksCount} tasks completed
                            </span>
                        </div>
                    </div>

                    {/* ── Dynamic Progress Bar ── */}
                    <div className="space-y-1.5">
                        <div className="w-full h-3.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-2xs">
                            <div
                                className="h-full bg-gradient-to-r from-[color:var(--primary)] via-indigo-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${percentDone}%` }}
                                role="progressbar"
                                aria-valuenow={percentDone}
                                aria-valuemin={0}
                                aria-valuemax={100}
                            />
                        </div>
                    </div>

                    {/* Hierarchy of Importance Metric Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">1. Overdue</span>
                            <span className="text-[14px] font-bold text-[color:var(--status-danger-text)] tabular-nums">
                                {overdueCount}
                            </span>
                        </div>

                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">2. Revision</span>
                            <span className="text-[14px] font-bold text-rose-600 tabular-nums">
                                {returnedCount}
                            </span>
                        </div>

                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">3. Due Today</span>
                            <span className="text-[14px] font-bold text-amber-600 tabular-nums">
                                {dueTodayCount}
                            </span>
                        </div>

                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">4. In Review</span>
                            <span className="text-[14px] font-bold text-purple-600 tabular-nums">
                                {inReviewCount}
                            </span>
                        </div>

                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">5. Due This Week</span>
                            <span className="text-[14px] font-bold text-[color:var(--text)] tabular-nums">
                                {dueThisWeekCount}
                            </span>
                        </div>

                        <div className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">Completed</span>
                            <span className="text-[14px] font-bold text-[color:var(--status-success-text)] tabular-nums">
                                {completedTasksCount}
                            </span>
                        </div>
                    </div>

                    {/* ── Progress Bar Checklist ── */}
                    <div className="pt-3 border-t border-[color:var(--border)] space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <CheckSquare className="w-4 h-4 text-[color:var(--primary)]" />
                                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--text)]">
                                    Quick Task Checklist
                                </h3>
                            </div>
                            <span className="text-[11px] font-medium text-[color:var(--muted)]">
                                Sorted by Hierarchy of Importance
                            </span>
                        </div>

                        {hierarchyOrderedTasks.length === 0 ? (
                            <div className="py-4 text-center text-[13px] text-[color:var(--muted)]">
                                No assigned tasks found.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-60 overflow-y-auto pr-1 divide-y divide-[color:var(--border)]">
                                {hierarchyOrderedTasks.slice(0, 8).map((task) => {
                                    const isDone = isTaskCompleted(task.id, task.status);
                                    const isCompleting = completingTaskIds.has(task.id);

                                    return (
                                        <div
                                            key={`checklist-${task.id}`}
                                            className={`py-2 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-[13px] transition-opacity ${
                                                isCompleting ? 'opacity-40 pointer-events-none' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <Checkbox
                                                    checked={isDone}
                                                    onChange={() => handleToggleTaskCompletion(task)}
                                                    aria-label={`Toggle task ${task.title}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={task.action_url}
                                                        className={`font-medium text-[color:var(--text)] hover:text-[color:var(--primary)] truncate block transition-colors ${
                                                            isDone ? 'line-through text-[color:var(--muted)]' : ''
                                                        }`}
                                                    >
                                                        {task.title}
                                                    </Link>
                                                    <span className="text-[11px] text-[color:var(--muted)] truncate block">
                                                        {task.project.title} · {task.activity.title}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-2">
                                                {getImportanceBadge(task, isDone)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </Card>

                {/* ══ 3. Filters & Search Bar ══ */}
                <Card className="p-4 space-y-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)] pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by task, activity, or project..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] placeholder:text-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Project Filter */}
                        <div className="shrink-0 w-full md:w-56">
                            <select
                                value={projectFilter}
                                onChange={(e) => handleProjectFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                aria-label="Filter by project"
                            >
                                <option value="ALL">All projects ({projectOptions.length})</option>
                                {projectOptions.map((proj) => (
                                    <option key={proj.id} value={proj.id}>
                                        {proj.title}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div className="shrink-0 w-full md:w-48">
                            <select
                                value={statusFilter}
                                onChange={(e) => handleStatusFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                aria-label="Filter by status"
                            >
                                <option value="ALL">All statuses</option>
                                <option value="ACTIVE">All active</option>
                                <option value="To Do">To Do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Returned">Returned</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* ══ 4. Grouped Task Sections (Hierarchy of Importance) ══ */}
                {totalItems === 0 ? (
                    <EmptyState
                        title="No tasks found"
                        description={searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No tasks matched your active filter settings.' : 'You do not have any assigned tasks currently.'}
                        actionLabel={searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Reset filters' : undefined}
                        onAction={searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' ? () => {
                            setStatusFilter('ALL');
                            setProjectFilter('ALL');
                            setSearchTerm('');
                            updateUrlParams('ALL', 'ALL', '', 1, pageSize);
                        } : undefined}
                    />
                ) : (
                    <div className="space-y-6">
                        {groupedTasks.map((group) => (
                            <Card key={group.id} className="p-5 space-y-3">
                                {/* Group Header */}
                                <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border)]">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-[16px] font-bold text-[color:var(--text)]">
                                            {group.title}
                                        </h2>
                                        <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)] tabular-nums">
                                            {group.tasks.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Task Rows */}
                                <div className="divide-y divide-[color:var(--border)]">
                                    {group.tasks.map((task) => {
                                        const isCompleting = completingTaskIds.has(task.id);
                                        const isCompleted = isTaskCompleted(task.id, task.status);

                                        return (
                                            <div
                                                key={task.id}
                                                className={`py-3.5 first:pt-1 last:pb-1 flex items-start gap-3 transition-opacity ${
                                                    isCompleting ? 'opacity-40 pointer-events-none' : ''
                                                }`}
                                            >
                                                {/* Inline Completion Checkbox */}
                                                <div className="pt-0.5 shrink-0">
                                                    <Checkbox
                                                        checked={isCompleted}
                                                        onChange={() => handleToggleTaskCompletion(task)}
                                                        aria-label={`Mark task ${task.title} as ${isCompleted ? 'incomplete' : 'completed'}`}
                                                    />
                                                </div>

                                                {/* Task Details */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                                        <Link
                                                            href={task.action_url}
                                                            className={`text-[14px] font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate ${
                                                                isCompleted ? 'line-through text-[color:var(--muted)]' : ''
                                                            }`}
                                                        >
                                                            {task.title}
                                                        </Link>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {renderDaysBadge(task, isCompleted)}
                                                            <Badge variant={isCompleted ? 'accent' : task.status === 'Under Review' ? 'secondary' : task.status === 'Returned' ? 'danger' : 'soft'}>
                                                                {isCompleted ? 'Completed' : task.status}
                                                            </Badge>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)] mt-1 flex-wrap">
                                                        <span className="font-medium text-[color:var(--text)]">
                                                            {task.project.title}
                                                        </span>
                                                        <span>·</span>
                                                        <span>{task.committee.name}</span>
                                                        <span>·</span>
                                                        <span>{task.activity.title}</span>
                                                        {task.due_date_formatted && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="tabular-nums">Due {task.due_date_formatted}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        ))}

                        {/* Real Pagination */}
                        <Card className="p-4">
                            <Pagination
                                currentPage={safePage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                pageSizeOptions={[10, 25, 50]}
                            />
                        </Card>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
