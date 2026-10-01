import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    CheckSquare,
    Clock,
    AlertCircle,
    CheckCircle2,
    ArrowRight,
    Search,
    Filter,
    FolderOpen,
    ListTodo,
    Calendar,
    ChevronRight,
    Sparkles,
    LayoutGrid,
    List,
    Users,
    User,
    PlusCircle,
    Target,
} from 'lucide-react';
import { Button } from '@/Components/Button';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface UserTaskItem {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    due_date?: string | null;
    due_date_formatted: string;
    requires_review: boolean;
    is_overdue: boolean;
    is_approaching: boolean;
    is_assigned_to_me: boolean;
    assignee_name: string;
    checklist_total: number;
    checklist_completed: number;
    project: {
        id: string;
        title: string;
    };
    committee: {
        id: string;
        name: string;
    };
    activity: {
        id: string;
        title: string;
    };
    action_url: string;
}

export interface TaskStats {
    total: number;
    todo: number;
    in_progress: number;
    under_review: number;
    completed: number;
    completion_rate: number;
    overdue: number;
}

export interface TasksIndexProps {
    tasks: UserTaskItem[];
    stats: TaskStats;
    projects: Array<{ id: string; title: string }>;
    filters: {
        status: string;
        project_id: string;
        search: string;
        scope: 'mine' | 'team';
        view: 'list' | 'board';
    };
    my_tasks_count: number;
    team_tasks_count: number;
    user_name: string;
}

// ─── Task Status Badge ───────────────────────────────────────────────────────

function TaskStatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'Completed':
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                </span>
            );
        case 'Under Review':
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    Under Review
                </span>
            );
        case 'In Progress':
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                    In Progress
                </span>
            );
        case 'Returned':
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Returned
                </span>
            );
        case 'To Do':
        default:
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    To Do
                </span>
            );
    }
}

// ─── Main Task Dashboard Component ───────────────────────────────────────────

export default function Index({
    tasks = [],
    stats = {
        total: 0,
        todo: 0,
        in_progress: 0,
        under_review: 0,
        completed: 0,
        completion_rate: 0,
        overdue: 0,
    },
    projects = [],
    filters = {
        status: 'all',
        project_id: 'all',
        search: '',
        scope: 'mine',
        view: 'list',
    },
    my_tasks_count = 0,
    team_tasks_count = 0,
    user_name = 'Member',
}: TasksIndexProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [viewMode, setViewMode] = useState<'list' | 'board'>(filters.view || 'list');
    const [isSeeding, setIsSeeding] = useState(false);

    const handleFilterChange = (updates: Partial<typeof filters>) => {
        router.get(
            '/tasks',
            {
                ...filters,
                view: viewMode,
                search: searchTerm,
                ...updates,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange({ search: searchTerm });
    };

    const handleAssignSampleTasks = () => {
        setIsSeeding(true);
        router.post('/tasks/assign-sample', {}, {
            onFinish: () => setIsSeeding(false),
        });
    };

    const statusTabs = [
        { id: 'all', label: 'All', count: stats.total },
        { id: 'To Do', label: 'To Do', count: stats.todo },
        { id: 'In Progress', label: 'In Progress', count: stats.in_progress },
        { id: 'Under Review', label: 'Under Review', count: stats.under_review },
        { id: 'Completed', label: 'Completed', count: stats.completed },
        ...(stats.overdue > 0
            ? [{ id: 'overdue', label: 'Overdue', count: stats.overdue, isOverdue: true }]
            : []),
    ];

    // Kanban columns for board view
    const boardColumns = [
        { id: 'To Do', title: 'To Do', color: 'border-slate-300', dot: 'bg-slate-400' },
        { id: 'In Progress', title: 'In Progress', color: 'border-sky-400', dot: 'bg-sky-500' },
        { id: 'Under Review', title: 'Under Review', color: 'border-amber-400', dot: 'bg-amber-500' },
        { id: 'Completed', title: 'Completed', color: 'border-emerald-400', dot: 'bg-emerald-500' },
    ];

    return (
        <AppLayout
            title="Task Command Center"
            subtitle="Manage your personal deliverables, checklist pacing, and team project contributions."
        >
            <Head title="Task Dashboard" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* ─── Hero / Command Center Banner ────────────────────────────── */}
                <div className="bg-gradient-to-r from-[color:var(--color-brand-dark-green)] to-[#1b4d36] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                                <Sparkles className="w-4 h-4 text-[color:var(--color-brand-active-warm-orange)]" />
                                <span>Personal Productivity Hub</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-bold mt-1">
                                Welcome, {user_name}!
                            </h2>
                            <p className="text-xs md:text-sm text-emerald-100/90 mt-1 max-w-xl">
                                {filters.scope === 'mine'
                                    ? `You have ${stats.total} total deliverables assigned directly to your account across active CCIS committees.`
                                    : `Viewing all ${stats.total} team deliverables across your active CCIS committees and projects.`}
                            </p>
                        </div>

                        {/* Progress Meter Gauge */}
                        <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-4 min-w-56 shrink-0">
                            <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                                <span className="flex items-center gap-1.5 text-emerald-100">
                                    <Target className="w-4 h-4 text-[color:var(--color-brand-active-warm-orange)]" />
                                    Completion Velocity
                                </span>
                                <span className="text-sm font-bold text-white">
                                    {stats.completion_rate}%
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-black/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[color:var(--color-brand-active-warm-orange)] rounded-full transition-all duration-500"
                                    style={{ width: `${stats.completion_rate}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-emerald-200/80 mt-1.5 font-medium">
                                <span>{stats.completed} Completed</span>
                                <span>{stats.total - stats.completed} Remaining</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Metric Summary Cards ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>Total Tasks</span>
                            <CheckSquare className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                            <span>To Do</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        </div>
                        <div className="text-2xl font-bold text-slate-700 mt-1">{stats.todo}</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center justify-between text-xs text-sky-700 font-medium">
                            <span>In Progress</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        </div>
                        <div className="text-2xl font-bold text-sky-700 mt-1">{stats.in_progress}</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs bg-amber-50/20">
                        <div className="flex items-center justify-between text-xs text-amber-700 font-medium">
                            <span>Under Review</span>
                            <Clock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="text-2xl font-bold text-amber-700 mt-1">{stats.under_review}</div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
                        <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                            <span>Completed</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-700 mt-1">{stats.completed}</div>
                    </div>

                    <div className={`p-3.5 rounded-xl border shadow-xs ${stats.overdue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200/80'}`}>
                        <div className={`flex items-center justify-between text-xs font-medium ${stats.overdue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                            <span>Overdue</span>
                            <AlertCircle className={`w-4 h-4 ${stats.overdue > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                        </div>
                        <div className={`text-2xl font-bold mt-1 ${stats.overdue > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                            {stats.overdue}
                        </div>
                    </div>
                </div>

                {/* ─── Scope Switcher & View Mode Toolbar ────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3.5">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        {/* Scope Toggle: My Deliverables vs Team Tasks */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                            <button
                                onClick={() => handleFilterChange({ scope: 'mine', status: 'all' })}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                    filters.scope === 'mine'
                                        ? 'bg-white text-[color:var(--color-brand-dark-green)] shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <User className="w-3.5 h-3.5" />
                                <span>My Deliverables</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    filters.scope === 'mine' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {my_tasks_count}
                                </span>
                            </button>

                            <button
                                onClick={() => handleFilterChange({ scope: 'team', status: 'all' })}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                    filters.scope === 'team'
                                        ? 'bg-white text-[color:var(--color-brand-dark-green)] shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>All Team Tasks</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    filters.scope === 'team' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {team_tasks_count}
                                </span>
                            </button>
                        </div>

                        {/* View Switcher: List vs Board */}
                        <div className="flex items-center gap-2 self-end md:self-auto">
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors ${
                                        viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="List View"
                                >
                                    <List className="w-3.5 h-3.5" />
                                    <span>List</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('board')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors ${
                                        viewMode === 'board' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="Kanban Board View"
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>Board</span>
                                </button>
                            </div>

                            {/* Demo Helper Button */}
                            {my_tasks_count === 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAssignSampleTasks}
                                    disabled={isSeeding}
                                    className="text-xs h-8 border-dashed border-[color:var(--color-brand-active-warm-orange)] text-[color:var(--color-brand-active-warm-orange)] hover:bg-orange-50"
                                >
                                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                                    {isSeeding ? 'Seeding...' : 'Seed Sample Tasks'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filter Pills, Project Select, and Search */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        {/* Status Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                            {statusTabs.map((tab) => {
                                const isActive = filters.status === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleFilterChange({ status: tab.id })}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                            isActive
                                                ? tab.isOverdue
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-[color:var(--color-brand-dark-green)] text-white shadow-xs'
                                                : tab.isOverdue
                                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span
                                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                                isActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-slate-200/70 text-slate-700'
                                            }`}
                                        >
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Project Filter & Search */}
                        <div className="flex items-center gap-2 shrink-0">
                            {projects.length > 0 && (
                                <select
                                    value={filters.project_id}
                                    onChange={(e) => handleFilterChange({ project_id: e.target.value })}
                                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[color:var(--color-brand-dark-green)]"
                                >
                                    <option value="all">All Projects ({projects.length})</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <form onSubmit={handleSearchSubmit} className="relative">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search tasks..."
                                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-44 md:w-52 focus:outline-hidden focus:ring-2 focus:ring-[color:var(--color-brand-dark-green)] text-slate-900"
                                />
                            </form>
                        </div>
                    </div>
                </div>

                {/* ─── Task Content ─────────────────────────────────────────────── */}
                {tasks.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs space-y-4">
                        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-[color:var(--color-brand-dark-green)]">
                            <CheckSquare className="w-7 h-7" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                {filters.scope === 'mine' ? 'No personal tasks assigned yet' : 'No team tasks found'}
                            </h3>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                                {filters.scope === 'mine'
                                    ? team_tasks_count > 0
                                        ? `You don't have direct tasks yet, but your team has ${team_tasks_count} tasks in active projects.`
                                        : 'You currently have zero assigned deliverables. Project Leaders and Committee Staff assign tasks during committee planning.'
                                    : 'No tasks match your current filter settings.'}
                            </p>
                        </div>

                        {/* Action buttons inside empty state */}
                        <div className="flex items-center justify-center gap-3 pt-2">
                            {filters.scope === 'mine' && team_tasks_count > 0 && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleFilterChange({ scope: 'team', status: 'all' })}
                                    className="text-xs"
                                >
                                    <Users className="w-3.5 h-3.5 mr-1.5" />
                                    View Team Tasks ({team_tasks_count})
                                </Button>
                            )}

                            {filters.scope === 'mine' && my_tasks_count === 0 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAssignSampleTasks}
                                    disabled={isSeeding}
                                    className="text-xs border-[color:var(--color-brand-active-warm-orange)] text-[color:var(--color-brand-active-warm-orange)]"
                                >
                                    <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                                    {isSeeding ? 'Seeding Tasks...' : 'Assign 3 Sample Tasks to Me'}
                                </Button>
                            )}

                            {(filters.status !== 'all' || filters.search || filters.project_id !== 'all') && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearchTerm('');
                                        handleFilterChange({ status: 'all', project_id: 'all', search: '' });
                                    }}
                                    className="text-xs"
                                >
                                    Reset Filters
                                </Button>
                            )}
                        </div>
                    </div>
                ) : viewMode === 'list' ? (
                    /* ─── List View ────────────────────────────────────────────── */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {tasks.map((task) => {
                            const hasChecklist = task.checklist_total > 0;
                            const checklistPercent = hasChecklist
                                ? Math.round((task.checklist_completed / task.checklist_total) * 100)
                                : 0;

                            return (
                                <div
                                    key={task.id}
                                    className="group bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-[color:var(--color-brand-active-warm-orange)]/60 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Project & Committee Breadcrumb */}
                                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-2">
                                            <div className="flex items-center gap-1.5 font-medium truncate">
                                                <span className="text-[color:var(--color-brand-dark-green)] font-semibold truncate">
                                                    {task.project.title}
                                                </span>
                                                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                                                <span className="truncate">{task.committee.name}</span>
                                            </div>

                                            <TaskStatusBadge status={task.status} />
                                        </div>

                                        {/* Task Title */}
                                        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-[color:var(--color-brand-dark-green)] transition-colors line-clamp-2">
                                            {task.title}
                                        </h3>

                                        {/* Description */}
                                        {task.description && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                {task.description}
                                            </p>
                                        )}

                                        {/* Assignee pill (if viewing team tasks) */}
                                        {filters.scope === 'team' && (
                                            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span>Assignee: {task.assignee_name}</span>
                                                {task.is_assigned_to_me && (
                                                    <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Activity Context */}
                                        <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                            <FolderOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-600">Activity:</span>
                                            <span className="truncate text-slate-800">{task.activity.title}</span>
                                        </div>

                                        {/* Checklist Progress Bar */}
                                        {hasChecklist && (
                                            <div className="mt-3 space-y-1">
                                                <div className="flex justify-between text-[11px] text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <ListTodo className="w-3 h-3 text-slate-400" />
                                                        Checklist
                                                    </span>
                                                    <span className="font-semibold text-slate-700">
                                                        {task.checklist_completed}/{task.checklist_total} ({checklistPercent}%)
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[color:var(--color-brand-active-warm-orange)] rounded-full transition-all duration-300"
                                                        style={{ width: `${checklistPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Card Footer: Due Date & Action */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <Calendar className={`w-3.5 h-3.5 ${task.is_overdue ? 'text-rose-600' : 'text-slate-400'}`} />
                                            <span
                                                className={`font-medium ${
                                                    task.is_overdue
                                                        ? 'text-rose-600 font-semibold'
                                                        : task.is_approaching
                                                        ? 'text-amber-600 font-semibold'
                                                        : 'text-slate-500'
                                                }`}
                                            >
                                                {task.due_date_formatted}
                                                {task.is_overdue && ' (Overdue)'}
                                                {task.is_approaching && ' (Due Soon)'}
                                            </span>
                                        </div>

                                        <Link
                                            href={task.action_url}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-brand-dark-green)] hover:text-[color:var(--color-brand-active-warm-orange)] transition-colors"
                                        >
                                            <span>Open Details</span>
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ─── Kanban Board View ────────────────────────────────────── */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                        {boardColumns.map((col) => {
                            const columnTasks = tasks.filter((t) => t.status === col.id);

                            return (
                                <div
                                    key={col.id}
                                    className="bg-slate-100/70 rounded-xl p-3 border border-slate-200/80 flex flex-col gap-3 min-h-[380px]"
                                >
                                    {/* Column Header */}
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                {col.title}
                                            </h3>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 shadow-2xs border border-slate-200">
                                            {columnTasks.length}
                                        </span>
                                    </div>

                                    {/* Column Task Cards */}
                                    <div className="space-y-2.5 overflow-y-auto max-h-[600px] scrollbar-none pr-0.5">
                                        {columnTasks.length === 0 ? (
                                            <div className="text-center py-8 text-xs text-slate-400 italic">
                                                No tasks {col.title.toLowerCase()}
                                            </div>
                                        ) : (
                                            columnTasks.map((task) => (
                                                <div
                                                    key={task.id}
                                                    className="bg-white rounded-lg p-3 border border-slate-200 shadow-xs hover:border-[color:var(--color-brand-active-warm-orange)] transition-all space-y-2"
                                                >
                                                    <div className="text-[10px] font-medium text-[color:var(--color-brand-dark-green)] truncate">
                                                        {task.project.title}
                                                    </div>

                                                    <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                                                        {task.title}
                                                    </h4>

                                                    {task.checklist_total > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                                            <ListTodo className="w-3 h-3 text-slate-400" />
                                                            <span>
                                                                {task.checklist_completed}/{task.checklist_total} items
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                        <span className={`font-medium ${task.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                                                            {task.due_date_formatted}
                                                        </span>

                                                        <Link
                                                            href={task.action_url}
                                                            className="font-semibold text-[color:var(--color-brand-dark-green)] hover:text-[color:var(--color-brand-active-warm-orange)]"
                                                        >
                                                            Open ➔
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
