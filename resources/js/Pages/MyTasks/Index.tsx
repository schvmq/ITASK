import React, { useState, useMemo, useCallback } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { staggerContainer, cardVariant, rowVariant } from '@/animations';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    Search,
    X,
    CheckSquare,
    AlertCircle,
    Clock,
    Filter,
    Calendar,
    FolderOpen,
    CheckCircle2,
    ClipboardCheck,
    List,
    LayoutGrid,
    ExternalLink,
    Flag,
    AlertTriangle,
    Layers,
    Tag,
    ChevronRight,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { Checkbox } from '@/Components/Checkbox';
import { Pagination } from '@/Components/Pagination';
import { EmptyState } from '@/Components/EmptyState';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/Components/ui/sheet';

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

interface ChecklistItem {
    id: string;
    content: string;
    is_completed: boolean;
    order: number;
}

interface MyTask {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority?: string;
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
    checklist_items?: ChecklistItem[];
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
        return <span className="text-[12px] text-[color:var(--muted)]">—</span>;
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
        <span className="text-[12px] text-[color:var(--muted)] tabular-nums">
            {diffDays}d
        </span>
    );
}

function renderPriorityBadge(priority?: string) {
    const p = (priority || 'Medium').toLowerCase();
    if (p === 'urgent') {
        return <Badge variant="danger">Urgent</Badge>;
    }
    if (p === 'high') {
        return <Badge variant="secondary">High</Badge>;
    }
    if (p === 'medium') {
        return <Badge variant="soft">Medium</Badge>;
    }
    return <Badge variant="soft">Low</Badge>;
}

function getHierarchyRank(task: MyTask, isDone: boolean): number {
    if (isDone) return 7;
    const diff = getDaysDiff(task.due_date);
    if (task.is_overdue || (diff !== null && diff < 0)) return 1;
    if (task.status === 'Returned') return 2;
    if (diff === 0) return 3;
    if (task.status === 'Under Review') return 4;
    if (task.is_approaching || (diff !== null && diff <= 7)) return 5;
    return 6;
}

const KANBAN_COLUMNS = [
    { id: 'To Do', title: 'To Do', color: 'border-slate-500/30' },
    { id: 'In Progress', title: 'In Progress', color: 'border-blue-500/30' },
    { id: 'Under Review', title: 'Under Review', color: 'border-amber-500/30' },
    { id: 'Returned', title: 'Returned', color: 'border-rose-500/30' },
    { id: 'Completed', title: 'Completed', color: 'border-emerald-500/30' },
];

export default function MyTasksIndex({ tasks = [], stats, roleContext }: MyTasksIndexProps) {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialStatus = searchParams.get('status') || 'ALL';
    const initialProject = searchParams.get('project') || 'ALL';
    const initialPriority = searchParams.get('priority') || 'ALL';
    const initialDueDate = searchParams.get('due') || 'ALL';
    const initialView = (searchParams.get('view') as 'list' | 'board') || 'list';
    const initialGroup = searchParams.get('group') || 'hierarchy';
    const initialSearch = searchParams.get('q') || '';
    const initialPage = parseInt(searchParams.get('page') || '1', 10);
    const initialSize = parseInt(searchParams.get('size') || '10', 10);

    const [viewMode, setViewMode] = useState<'list' | 'board'>(initialView);
    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
    const [projectFilter, setProjectFilter] = useState<string>(initialProject);
    const [priorityFilter, setPriorityFilter] = useState<string>(initialPriority);
    const [dueDateFilter, setDueDateFilter] = useState<string>(initialDueDate);
    const [groupBy, setGroupBy] = useState<string>(initialGroup);
    const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
    const [currentPage, setCurrentPage] = useState<number>(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
    const [pageSize, setPageSize] = useState<number>([10, 25, 50].includes(initialSize) ? initialSize : 10);

    // Selected task for slide-over detail Sheet
    const [selectedTask, setSelectedTask] = useState<MyTask | null>(null);

    // Track locally completing tasks for optimistic UI
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
    const [locallyCompletedTaskIds, setLocallyCompletedTaskIds] = useState<Set<string>>(new Set());
    const [locallyUncompletedTaskIds, setLocallyUncompletedTaskIds] = useState<Set<string>>(new Set());

    // Local checklist status map: checklistId -> boolean
    const [checklistLocalState, setChecklistLocalState] = useState<Record<string, boolean>>({});

    const isTaskCompleted = useCallback((taskId: string, initialStatus: string) => {
        const idStr = String(taskId);
        if (locallyCompletedTaskIds.has(idStr)) return true;
        if (locallyUncompletedTaskIds.has(idStr)) return false;
        return initialStatus === 'Completed';
    }, [locallyCompletedTaskIds, locallyUncompletedTaskIds]);

    const updateUrlParams = useCallback(
        (newView: 'list' | 'board', newStatus: string, newProject: string, newPriority: string, newDue: string, newGroup: string, newQuery: string, newPage: number, newSize: number) => {
            if (typeof window === 'undefined') return;
            const url = new URL(window.location.href);
            if (newView !== 'list') url.searchParams.set('view', newView); else url.searchParams.delete('view');
            if (newStatus !== 'ALL') url.searchParams.set('status', newStatus); else url.searchParams.delete('status');
            if (newProject !== 'ALL') url.searchParams.set('project', newProject); else url.searchParams.delete('project');
            if (newPriority !== 'ALL') url.searchParams.set('priority', newPriority); else url.searchParams.delete('priority');
            if (newDue !== 'ALL') url.searchParams.set('due', newDue); else url.searchParams.delete('due');
            if (newGroup !== 'hierarchy') url.searchParams.set('group', newGroup); else url.searchParams.delete('group');
            if (newQuery) url.searchParams.set('q', newQuery); else url.searchParams.delete('q');
            url.searchParams.set('page', String(newPage));
            url.searchParams.set('size', String(newSize));
            window.history.replaceState({}, '', url.toString());
        },
        []
    );

    const handleViewToggle = (mode: 'list' | 'board') => {
        setViewMode(mode);
        updateUrlParams(mode, statusFilter, projectFilter, priorityFilter, dueDateFilter, groupBy, searchTerm, currentPage, pageSize);
    };

    const handleStatusFilterChange = (status: string) => {
        setStatusFilter(status);
        setCurrentPage(1);
        updateUrlParams(viewMode, status, projectFilter, priorityFilter, dueDateFilter, groupBy, searchTerm, 1, pageSize);
    };

    const handleProjectFilterChange = (proj: string) => {
        setProjectFilter(proj);
        setCurrentPage(1);
        updateUrlParams(viewMode, statusFilter, proj, priorityFilter, dueDateFilter, groupBy, searchTerm, 1, pageSize);
    };

    const handlePriorityFilterChange = (pri: string) => {
        setPriorityFilter(pri);
        setCurrentPage(1);
        updateUrlParams(viewMode, statusFilter, projectFilter, pri, dueDateFilter, groupBy, searchTerm, 1, pageSize);
    };

    const handleDueDateFilterChange = (due: string) => {
        setDueDateFilter(due);
        setCurrentPage(1);
        updateUrlParams(viewMode, statusFilter, projectFilter, priorityFilter, due, groupBy, searchTerm, 1, pageSize);
    };

    const handleGroupByChange = (grp: string) => {
        setGroupBy(grp);
        updateUrlParams(viewMode, statusFilter, projectFilter, priorityFilter, dueDateFilter, grp, searchTerm, currentPage, pageSize);
    };

    const handleSearchChange = (query: string) => {
        setSearchTerm(query);
        setCurrentPage(1);
        updateUrlParams(viewMode, statusFilter, projectFilter, priorityFilter, dueDateFilter, groupBy, query, 1, pageSize);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        updateUrlParams(viewMode, statusFilter, projectFilter, priorityFilter, dueDateFilter, groupBy, searchTerm, page, pageSize);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
        updateUrlParams(viewMode, statusFilter, projectFilter, priorityFilter, dueDateFilter, groupBy, searchTerm, 1, size);
    };

    // Derive project options
    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => map.set(t.project.id, t.project.title));
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [tasks]);

    // Universal Task Completion Toggle
    const handleToggleTaskCompletion = (task: MyTask) => {
        if (!task.is_mine) {
            router.visit(task.action_url);
            return;
        }

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
                    onError: () => {
                        setLocallyCompletedTaskIds((prev) => {
                            const next = new Set(prev);
                            next.delete(task.id);
                            return next;
                        });
                        setLocallyUncompletedTaskIds((prev) => new Set(prev).add(task.id));
                    },
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
                    onError: () => {
                        if (isDone) {
                            setLocallyCompletedTaskIds((prev) => new Set(prev).add(task.id));
                            setLocallyUncompletedTaskIds((prev) => {
                                const next = new Set(prev);
                                next.delete(task.id);
                                return next;
                            });
                        } else {
                            setLocallyCompletedTaskIds((prev) => {
                                const next = new Set(prev);
                                next.delete(task.id);
                                return next;
                            });
                            setLocallyUncompletedTaskIds((prev) => new Set(prev).add(task.id));
                        }
                    },
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

    // Change task status directly (used in slide-over Sheet)
    const handleChangeTaskStatus = (task: MyTask, newStatus: string) => {
        if (!task.is_mine) return;

        if (newStatus === 'Under Review' || (newStatus === 'Completed' && task.requires_review)) {
            router.post(
                `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/submit`,
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        if (selectedTask?.id === task.id) {
                            setSelectedTask({ ...selectedTask, status: 'Under Review' });
                        }
                    },
                }
            );
        } else {
            router.patch(
                `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}`,
                { status: newStatus },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        if (selectedTask?.id === task.id) {
                            setSelectedTask({ ...selectedTask, status: newStatus });
                        }
                    },
                }
            );
        }
    };

    // Toggle Checklist item inside Sheet
    const handleToggleChecklistItem = (task: MyTask, item: ChecklistItem) => {
        const currentVal = checklistLocalState[item.id] !== undefined ? checklistLocalState[item.id] : item.is_completed;
        const nextVal = !currentVal;

        setChecklistLocalState((prev) => ({ ...prev, [item.id]: nextVal }));

        router.patch(
            `/projects/${task.project.id}/committees/${task.committee.id}/activities/${task.activity.id}/tasks/${task.id}/checklist/${item.id}`,
            {
                is_completed: nextVal,
                content: item.content,
                order: item.order,
            },
            {
                preserveScroll: true,
                onError: () => {
                    setChecklistLocalState((prev) => ({ ...prev, [item.id]: currentVal }));
                },
            }
        );
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

    // Hierarchy ordered tasks for quick checklist
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

    // Filter tasks based on search, project, status, priority, and due date
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

            if (priorityFilter !== 'ALL') {
                const p = (task.priority || 'Medium').toLowerCase();
                if (p !== priorityFilter.toLowerCase()) return false;
            }

            if (dueDateFilter !== 'ALL') {
                const diff = getDaysDiff(task.due_date);
                if (dueDateFilter === 'overdue' && !(task.is_overdue || (diff !== null && diff < 0))) return false;
                if (dueDateFilter === 'today' && diff !== 0) return false;
                if (dueDateFilter === 'this_week' && !(diff !== null && diff > 0 && diff <= 7)) return false;
                if (dueDateFilter === 'later' && !(diff === null || diff > 7)) return false;
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
    }, [tasks, projectFilter, statusFilter, priorityFilter, dueDateFilter, searchTerm, isTaskCompleted]);

    // Pagination calculations
    const totalItems = filteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, Math.max(1, totalPages));

    const paginatedTasks = useMemo(() => {
        if (viewMode === 'board') return filteredTasks;
        const start = (safePage - 1) * pageSize;
        return filteredTasks.slice(start, start + pageSize);
    }, [filteredTasks, safePage, pageSize, viewMode]);

    // Grouping tasks for List View based on groupBy
    const groupedListTasks = useMemo(() => {
        if (groupBy === 'priority') {
            const groups: { [key: string]: MyTask[] } = {
                Urgent: [],
                High: [],
                Medium: [],
                Low: [],
            };
            paginatedTasks.forEach((t) => {
                const p = t.priority || 'Medium';
                if (!groups[p]) groups[p] = [];
                groups[p].push(t);
            });
            return Object.entries(groups)
                .map(([name, tList]) => ({ id: name, title: `${name} Priority`, tasks: tList }))
                .filter((g) => g.tasks.length > 0);
        }

        if (groupBy === 'project') {
            const map = new Map<string, { title: string; tasks: MyTask[] }>();
            paginatedTasks.forEach((t) => {
                if (!map.has(t.project.id)) {
                    map.set(t.project.id, { title: t.project.title, tasks: [] });
                }
                map.get(t.project.id)!.tasks.push(t);
            });
            return Array.from(map.entries()).map(([id, val]) => ({ id, title: val.title, tasks: val.tasks }));
        }

        if (groupBy === 'status') {
            const groups: { [key: string]: MyTask[] } = {
                'To Do': [],
                'In Progress': [],
                'Under Review': [],
                Returned: [],
                Completed: [],
            };
            paginatedTasks.forEach((t) => {
                const st = isTaskCompleted(t.id, t.status) ? 'Completed' : t.status;
                if (!groups[st]) groups[st] = [];
                groups[st].push(t);
            });
            return Object.entries(groups)
                .map(([name, tList]) => ({ id: name, title: name, tasks: tList }))
                .filter((g) => g.tasks.length > 0);
        }

        if (groupBy === 'due_date') {
            const overdue: MyTask[] = [];
            const today: MyTask[] = [];
            const thisWeek: MyTask[] = [];
            const later: MyTask[] = [];
            const completed: MyTask[] = [];

            paginatedTasks.forEach((t) => {
                if (isTaskCompleted(t.id, t.status)) {
                    completed.push(t);
                    return;
                }
                const diff = getDaysDiff(t.due_date);
                if (t.is_overdue || (diff !== null && diff < 0)) overdue.push(t);
                else if (diff === 0) today.push(t);
                else if (diff !== null && diff <= 7) thisWeek.push(t);
                else later.push(t);
            });

            return [
                { id: 'overdue', title: 'Overdue', tasks: overdue },
                { id: 'today', title: 'Due Today', tasks: today },
                { id: 'this_week', title: 'Due This Week', tasks: thisWeek },
                { id: 'later', title: 'Later', tasks: later },
                { id: 'completed', title: 'Completed', tasks: completed },
            ].filter((g) => g.tasks.length > 0);
        }

        // Default Hierarchy grouping
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
            { id: 'overdue', title: 'Overdue (Critical)', tasks: overdue },
            { id: 'returned', title: 'Revision Required', tasks: returned },
            { id: 'today', title: 'Due Today', tasks: today },
            { id: 'under_review', title: 'Under Review', tasks: inReview },
            { id: 'this_week', title: 'Due This Week', tasks: thisWeek },
            { id: 'later', title: 'Later & Active', tasks: later },
            ...(completed.length > 0 ? [{ id: 'completed', title: 'Completed', tasks: completed }] : []),
        ].filter((group) => group.tasks.length > 0);
    }, [paginatedTasks, isTaskCompleted, groupBy]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="My Tasks" />

            <div className="space-y-6">
                {/* ══ 1. Page Header with List vs Board View Toggle ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            My Tasks
                        </h1>
                        <p className="text-[14px] text-[color:var(--muted)] mt-1">
                            Your personal task hub across all projects. Track deadlines, checklists, and submit deliverables.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        {/* List vs Board Toggle Buttons */}
                        <div className="inline-flex items-center p-1 rounded-lg bg-[color:var(--soft-surface)] border border-[color:var(--border)]" role="tablist">
                            <button
                                type="button"
                                onClick={() => handleViewToggle('list')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors cursor-pointer ${
                                    viewMode === 'list'
                                        ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow-xs border border-[color:var(--border)]'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                                aria-label="List View"
                                data-testid="tasks-list-view-btn"
                            >
                                <List className="w-4 h-4 stroke-[2]" />
                                <span>List</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewToggle('board')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors cursor-pointer ${
                                    viewMode === 'board'
                                        ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow-xs border border-[color:var(--border)]'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                                aria-label="Board Kanban View"
                                data-testid="tasks-board-view-btn"
                            >
                                <LayoutGrid className="w-4 h-4 stroke-[2]" />
                                <span>Board</span>
                            </button>
                        </div>

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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[color:var(--border)]">
                        <div>
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-[color:var(--primary)]" />
                                <h2 className="text-[17px] font-bold text-[color:var(--text)]">
                                    Deliverables Progress
                                </h2>
                            </div>
                            <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                Check off deliverables below or change status to advance progress in real time.
                            </p>
                        </div>
                        <div className="sm:text-right shrink-0">
                            <motion.span
                                key={percentDone}
                                initial={{ scale: 1.15 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', damping: 15 }}
                                className="text-[18px] font-bold text-[color:var(--text)] tabular-nums block"
                            >
                                {percentDone}% done
                            </motion.span>
                            <span className="text-[12px] font-medium text-[color:var(--muted)] tabular-nums">
                                {completedTasksCount} of {totalTasksCount} tasks completed
                            </span>
                        </div>
                    </div>

                    {/* Progress Bar */}
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

                    {/* Hierarchy of Importance Metric Badges */}
                    <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
                    >
                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">1. Overdue</span>
                            <span className="text-[14px] font-bold text-[color:var(--status-danger-text)] tabular-nums">
                                {overdueCount}
                            </span>
                        </motion.div>

                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">2. Revision</span>
                            <span className="text-[14px] font-bold text-rose-600 tabular-nums">
                                {returnedCount}
                            </span>
                        </motion.div>

                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">3. Due Today</span>
                            <span className="text-[14px] font-bold text-amber-600 tabular-nums">
                                {dueTodayCount}
                            </span>
                        </motion.div>

                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">4. In Review</span>
                            <span className="text-[14px] font-bold text-purple-600 tabular-nums">
                                {inReviewCount}
                            </span>
                        </motion.div>

                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">5. Due This Week</span>
                            <span className="text-[14px] font-bold text-[color:var(--text)] tabular-nums">
                                {dueThisWeekCount}
                            </span>
                        </motion.div>

                        <motion.div variants={cardVariant} whileHover={{ y: -2 }} className="p-2.5 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-center">
                            <span className="text-[11px] font-medium text-[color:var(--muted)] block">Completed</span>
                            <span className="text-[14px] font-bold text-[color:var(--status-success-text)] tabular-nums">
                                {completedTasksCount}
                            </span>
                        </motion.div>
                    </motion.div>
                </Card>

                {/* ══ 3. Multi-Criteria Filters & Sorting Toolbar ══ */}
                <Card className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                        {/* Search Input */}
                        <div className="relative lg:col-span-2">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)] pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search tasks, activities, projects..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] placeholder:text-[color:var(--muted)] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] transition-colors"
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
                        <div>
                            <select
                                value={projectFilter}
                                onChange={(e) => handleProjectFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] transition-colors cursor-pointer"
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
                        <div>
                            <select
                                value={statusFilter}
                                onChange={(e) => handleStatusFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] transition-colors cursor-pointer"
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

                        {/* Priority Filter */}
                        <div>
                            <select
                                value={priorityFilter}
                                onChange={(e) => handlePriorityFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] transition-colors cursor-pointer"
                                aria-label="Filter by priority"
                            >
                                <option value="ALL">All priorities</option>
                                <option value="Urgent">Urgent</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>

                        {/* Due Date Filter */}
                        <div>
                            <select
                                value={dueDateFilter}
                                onChange={(e) => handleDueDateFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] transition-colors cursor-pointer"
                                aria-label="Filter by due date"
                            >
                                <option value="ALL">All due dates</option>
                                <option value="overdue">Overdue</option>
                                <option value="today">Due today</option>
                                <option value="this_week">Due this week</option>
                                <option value="later">Later</option>
                            </select>
                        </div>
                    </div>

                    {/* Secondary Row: Group/Sort selector when in List view */}
                    {viewMode === 'list' && (
                        <div className="pt-2 border-t border-[color:var(--border)] flex items-center justify-between gap-3 text-[12px] text-[color:var(--muted)] flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-[color:var(--text)]">Group by:</span>
                                <div className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--soft-surface)] p-0.5">
                                    {(['hierarchy', 'due_date', 'priority', 'project', 'status'] as const).map((grp) => (
                                        <button
                                            key={grp}
                                            type="button"
                                            onClick={() => handleGroupByChange(grp)}
                                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                                                groupBy === grp
                                                    ? 'bg-[color:var(--surface)] text-[color:var(--text)] shadow-xs'
                                                    : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                            }`}
                                        >
                                            {grp === 'hierarchy' ? 'Hierarchy' : grp === 'due_date' ? 'Due Date' : grp === 'priority' ? 'Priority' : grp === 'project' ? 'Project' : 'Status'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <span className="tabular-nums">
                                Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    )}
                </Card>

                {/* ══ 4. View Rendering (List vs Kanban Board) ══ */}
                {totalItems === 0 ? (
                    <EmptyState
                        title="No tasks found"
                        description={
                            searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || dueDateFilter !== 'ALL'
                                ? 'No tasks matched your active filter settings.'
                                : 'You do not have any assigned tasks currently.'
                        }
                        actionLabel={
                            searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || dueDateFilter !== 'ALL'
                                ? 'Reset filters'
                                : undefined
                        }
                        onAction={
                            searchTerm || projectFilter !== 'ALL' || statusFilter !== 'ALL' || priorityFilter !== 'ALL' || dueDateFilter !== 'ALL'
                                ? () => {
                                      setStatusFilter('ALL');
                                      setProjectFilter('ALL');
                                      setPriorityFilter('ALL');
                                      setDueDateFilter('ALL');
                                      setSearchTerm('');
                                      updateUrlParams(viewMode, 'ALL', 'ALL', 'ALL', 'ALL', groupBy, '', 1, pageSize);
                                  }
                                : undefined
                        }
                    />
                ) : viewMode === 'board' ? (
                    /* ══════ KANBAN BOARD VIEW ══════ */
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
                        {KANBAN_COLUMNS.map((col) => {
                            const colTasks = filteredTasks.filter((t) => {
                                const isDone = isTaskCompleted(t.id, t.status);
                                if (col.id === 'Completed') return isDone;
                                if (isDone) return false;
                                return t.status === col.id;
                            });

                            return (
                                <div
                                    key={col.id}
                                    className={`rounded-xl border ${col.color} bg-[color:var(--surface)] p-3 flex flex-col min-h-[420px] shadow-xs`}
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-[color:var(--border)]">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-[14px] font-bold text-[color:var(--text)]">
                                                {col.title}
                                            </h3>
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)] tabular-nums">
                                                {colTasks.length}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Column Cards */}
                                    <div className="space-y-3 flex-1 overflow-y-auto">
                                        {colTasks.length === 0 ? (
                                            <div className="py-8 text-center text-[12px] text-[color:var(--muted)]">
                                                No tasks
                                            </div>
                                        ) : (
                                            colTasks.map((task) => {
                                                const isDone = isTaskCompleted(task.id, task.status);
                                                return (
                                                    <motion.div
                                                        key={`kanban-${task.id}`}
                                                        layout
                                                        whileHover={{ y: -2 }}
                                                        onClick={() => setSelectedTask(task)}
                                                        className="p-3.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] hover:shadow-sm cursor-pointer transition-all space-y-2.5"
                                                    >
                                                        {/* Top tag & priority */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[11px] font-semibold text-[color:var(--muted)] truncate">
                                                                {task.project.title}
                                                            </span>
                                                            <div className="shrink-0 flex items-center gap-1.5">
                                                                {renderPriorityBadge(task.priority)}
                                                            </div>
                                                        </div>

                                                        {/* Task Title */}
                                                        <h4 className={`text-[13px] font-bold text-[color:var(--text)] line-clamp-2 ${isDone ? 'line-through opacity-70' : ''}`}>
                                                            {task.title}
                                                        </h4>

                                                        {/* Activity / committee breadcrumb */}
                                                        <p className="text-[11px] text-[color:var(--muted)] truncate">
                                                            {task.committee.name} · {task.activity.title}
                                                        </p>

                                                        {/* Footer: Due date, checklist ratio */}
                                                        <div className="pt-2 border-t border-[color:var(--border)] flex items-center justify-between text-[11px] text-[color:var(--muted)]">
                                                            <div className="flex items-center gap-1">
                                                                {renderDaysBadge(task, isDone)}
                                                            </div>

                                                            {task.checklist_total > 0 && (
                                                                <div className="flex items-center gap-1 tabular-nums font-medium text-[color:var(--muted)]">
                                                                    <CheckSquare className="w-3 h-3 text-[color:var(--primary)]" />
                                                                    <span>
                                                                        {task.checklist_completed}/{task.checklist_total}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ══════ LIST VIEW ══════ */
                    <div className="space-y-6">
                        {groupedListTasks.map((group) => (
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
                                <motion.div
                                    variants={staggerContainer}
                                    initial="hidden"
                                    animate="visible"
                                    className="divide-y divide-[color:var(--border)]"
                                >
                                    <AnimatePresence mode="popLayout">
                                        {group.tasks.map((task) => {
                                            const isCompleting = completingTaskIds.has(task.id);
                                            const isCompleted = isTaskCompleted(task.id, task.status);

                                            return (
                                                <motion.div
                                                    key={task.id}
                                                    variants={rowVariant}
                                                    layout
                                                    whileHover={{ x: 2 }}
                                                    className={`py-3 first:pt-1 last:pb-1 flex items-start gap-3 transition-opacity ${
                                                        isCompleting ? 'opacity-40 pointer-events-none' : ''
                                                    }`}
                                                >
                                                    {/* Inline Completion Checkbox */}
                                                    <div className="pt-0.5 shrink-0" title={!task.is_mine ? `Assigned to ${task.assignee?.name || 'team member'} — view details to manage` : undefined}>
                                                        <Checkbox
                                                            checked={isCompleted}
                                                            disabled={!task.is_mine}
                                                            onChange={() => {
                                                                if (task.is_mine) {
                                                                    handleToggleTaskCompletion(task);
                                                                }
                                                            }}
                                                            aria-label={`Mark task ${task.title} as ${isCompleted ? 'incomplete' : 'completed'}`}
                                                        />
                                                    </div>

                                                    {/* Task Details */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedTask(task)}
                                                                className={`text-[14px] font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] text-left transition-colors truncate cursor-pointer ${
                                                                    isCompleted ? 'line-through text-[color:var(--muted)]' : ''
                                                                }`}
                                                            >
                                                                {task.title}
                                                            </button>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {renderPriorityBadge(task.priority)}
                                                                {renderDaysBadge(task, isCompleted)}
                                                                <Badge variant={isCompleted ? 'accent' : task.status === 'Under Review' ? 'secondary' : task.status === 'Returned' ? 'danger' : 'soft'}>
                                                                    {isCompleted ? 'Completed' : task.status}
                                                                </Badge>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedTask(task)}
                                                                    className="px-2 py-1 text-[11px] font-medium text-[color:var(--muted)] hover:text-[color:var(--text)] rounded border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:bg-[color:var(--surface)] transition-colors cursor-pointer"
                                                                >
                                                                    Details
                                                                </button>
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
                                                            {task.checklist_total > 0 && (
                                                                <>
                                                                    <span>·</span>
                                                                    <span className="font-medium tabular-nums">
                                                                        {task.checklist_completed}/{task.checklist_total} subtasks
                                                                    </span>
                                                                </>
                                                            )}
                                                            {task.due_date_formatted && (
                                                                <>
                                                                    <span>·</span>
                                                                    <span className="tabular-nums">Due {task.due_date_formatted}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </motion.div>
                            </Card>
                        ))}

                        {/* Pagination for List View */}
                        <div className="pt-2 flex justify-center w-full">
                            <Pagination
                                currentPage={safePage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                pageSizeOptions={[10, 25, 50]}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ══ 5. Slide-Over Task Detail Panel (Sheet) ══ */}
            <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <SheetContent
                    side="right"
                    className="sm:max-w-lg w-full bg-[color:var(--surface)] text-[color:var(--text)] border-l border-[color:var(--border)] p-6 overflow-y-auto space-y-6 shadow-2xl"
                >
                    {selectedTask && (
                        <>
                            <SheetHeader className="p-0 border-b border-[color:var(--border)] pb-4 space-y-2">
                                <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted)]">
                                    <span className="font-semibold text-[color:var(--primary)]">{selectedTask.project.title}</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                    <span>{selectedTask.committee.name}</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                    <span>{selectedTask.activity.title}</span>
                                </div>
                                <SheetTitle className="text-[20px] font-bold text-[color:var(--text)] leading-snug">
                                    {selectedTask.title}
                                </SheetTitle>
                                <SheetDescription className="text-[12px] text-[color:var(--muted)] flex items-center gap-2 pt-1">
                                    <span>Status: <strong className="text-[color:var(--text)]">{selectedTask.status}</strong></span>
                                    <span>·</span>
                                    <span>Priority: <strong className="text-[color:var(--text)]">{selectedTask.priority || 'Medium'}</strong></span>
                                </SheetDescription>
                            </SheetHeader>

                            {/* Status and Action Buttons */}
                            <div className="p-4 rounded-xl bg-[color:var(--soft-surface)] border border-[color:var(--border)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[13px] font-semibold text-[color:var(--text)]">
                                        Update Task Status
                                    </label>
                                    {selectedTask.requires_review && (
                                        <Badge variant="secondary">Requires Review</Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {['To Do', 'In Progress', 'Completed'].map((st) => (
                                        <button
                                            key={st}
                                            type="button"
                                            disabled={!selectedTask.is_mine}
                                            onClick={() => handleChangeTaskStatus(selectedTask, st)}
                                            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                                                selectedTask.status === st
                                                    ? 'bg-[color:var(--primary)] text-white shadow-xs'
                                                    : 'bg-[color:var(--surface)] text-[color:var(--text)] border border-[color:var(--border)] hover:bg-[color:var(--soft-surface)]'
                                            } ${!selectedTask.is_mine ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {st}
                                        </button>
                                    ))}

                                    {selectedTask.requires_review && selectedTask.status !== 'Under Review' && (
                                        <button
                                            type="button"
                                            disabled={!selectedTask.is_mine}
                                            onClick={() => handleChangeTaskStatus(selectedTask, 'Under Review')}
                                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors cursor-pointer"
                                        >
                                            Submit for Review
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Task Metadata */}
                            <div className="grid grid-cols-2 gap-3 text-[13px]">
                                <div className="p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                    <span className="text-[11px] font-medium text-[color:var(--muted)] block">Due Date</span>
                                    <span className="font-semibold text-[color:var(--text)] mt-0.5 block">
                                        {selectedTask.due_date_formatted || 'No deadline'}
                                    </span>
                                </div>

                                <div className="p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                    <span className="text-[11px] font-medium text-[color:var(--muted)] block">Assignee</span>
                                    <span className="font-semibold text-[color:var(--text)] mt-0.5 block">
                                        {selectedTask.assignee?.name || 'Assigned to you'}
                                    </span>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <h4 className="text-[13px] font-bold text-[color:var(--text)]">Description</h4>
                                <div className="p-3.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft-surface)] text-[13px] text-[color:var(--text)] leading-relaxed">
                                    {selectedTask.description ? (
                                        selectedTask.description
                                    ) : (
                                        <span className="text-[color:var(--muted)] italic">No description provided for this task.</span>
                                    )}
                                </div>
                            </div>

                            {/* Subtasks / Checklist Items */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[13px] font-bold text-[color:var(--text)] flex items-center gap-1.5">
                                        <CheckSquare className="w-4 h-4 text-[color:var(--primary)]" />
                                        <span>Checklist & Subtasks</span>
                                    </h4>
                                    <span className="text-[11px] font-medium text-[color:var(--muted)]">
                                        {(selectedTask.checklist_items || []).filter((it) => checklistLocalState[it.id] !== undefined ? checklistLocalState[it.id] : it.is_completed).length} of {(selectedTask.checklist_items || []).length} completed
                                    </span>
                                </div>

                                {(selectedTask.checklist_items || []).length === 0 ? (
                                    <div className="py-4 text-center text-[12px] text-[color:var(--muted)] border border-dashed border-[color:var(--border)] rounded-lg">
                                        No checklist items on this task.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(selectedTask.checklist_items || []).map((item) => {
                                            const isChecked = checklistLocalState[item.id] !== undefined ? checklistLocalState[item.id] : item.is_completed;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="p-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--soft-surface)] flex items-center gap-3 text-[13px]"
                                                >
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onChange={() => handleToggleChecklistItem(selectedTask, item)}
                                                        aria-label={item.content}
                                                    />
                                                    <span className={`flex-1 text-[color:var(--text)] ${isChecked ? 'line-through text-[color:var(--muted)]' : ''}`}>
                                                        {item.content}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Full Activity Link */}
                            <div className="pt-4 border-t border-[color:var(--border)] flex items-center justify-between">
                                <Link
                                    href={selectedTask.action_url}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--primary)] hover:underline"
                                >
                                    <span>Open Activity Workspace</span>
                                    <ExternalLink className="w-4 h-4" />
                                </Link>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setSelectedTask(null)}
                                >
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
