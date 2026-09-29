import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    CheckSquare,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    Layers,
    FolderOpen,
    Users,
    RotateCcw,
    Filter,
    X,
    ListTodo,
    ArrowUpRight,
    Shield,
} from 'lucide-react';

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

// ─── Status Helpers ───────────────────────────────────────────────────────────

function getStatusBadgeClass(status: string): string {
    switch (status) {
        case 'Completed':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'In Progress': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'Under Review':return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Returned':    return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'To Do':
        default:            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'Completed':   return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
        case 'In Progress': return <Clock className="w-3.5 h-3.5 text-blue-600" />;
        case 'Under Review':return <Shield className="w-3.5 h-3.5 text-amber-600" />;
        case 'Returned':    return <RotateCcw className="w-3.5 h-3.5 text-rose-600" />;
        default:            return <ListTodo className="w-3.5 h-3.5 text-slate-500" />;
    }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
    label,
    count,
    colorClass,
    icon,
    active,
    onClick,
}: {
    label: string;
    count: number;
    colorClass: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`bg-white rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:shadow-md w-full ${
                active
                    ? 'border-[color:var(--color-brand-action-orange)] ring-1 ring-[color:var(--color-brand-action-orange)]/30'
                    : 'border-[color:var(--color-border-light)] hover:border-slate-300'
            }`}
        >
            <div className="flex items-center justify-between mb-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${colorClass}`}>
                    {label}
                </span>
                {icon}
            </div>
            <p className="text-2xl font-bold text-[color:var(--color-text-main)]">{count}</p>
        </button>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: MyTask }) {
    const isReturned    = task.status === 'Returned';
    const isUnderReview = task.status === 'Under Review';
    const isCompleted   = task.status === 'Completed';

    return (
        <div
            className={`bg-white rounded-xl border shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] p-4 flex flex-col gap-3 transition-all duration-150 hover:shadow-md ${
                task.is_overdue && !isCompleted
                    ? 'border-rose-300'
                    : isReturned
                    ? 'border-rose-200'
                    : isUnderReview
                    ? 'border-amber-200'
                    : 'border-[color:var(--color-border-light)]'
            }`}
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                    {getStatusIcon(task.status)}
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--color-text-main)] leading-snug">
                            {task.title}
                        </p>
                        {task.description && (
                            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5 line-clamp-1">
                                {task.description}
                            </p>
                        )}
                    </div>
                </div>
                <span
                    className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(task.status)}`}
                >
                    {task.status}
                </span>
            </div>

            {/* Urgency banners */}
            {task.is_overdue && !isCompleted && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Overdue</span>
                    {task.due_date_formatted && (
                        <span className="font-normal ml-1">· was due {task.due_date_formatted}</span>
                    )}
                </div>
            )}
            {task.is_approaching && !isCompleted && !task.is_overdue && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Due soon</span>
                    {task.due_date_formatted && (
                        <span className="font-normal ml-1">· {task.due_date_formatted}</span>
                    )}
                </div>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[color:var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[140px]">{task.project.title}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[120px]">{task.committee.name}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate max-w-[120px]">{task.activity.title}</span>
                </span>
                {task.due_date_formatted && !task.is_overdue && !task.is_approaching && (
                    <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Due {task.due_date_formatted}</span>
                    </span>
                )}
                {task.requires_review && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                        <Shield className="w-3 h-3" />
                        Review Required
                    </span>
                )}
                {task.assignee && !task.is_mine && (
                    <span className="inline-flex items-center gap-1">
                        <span className="text-slate-400">Assigned to:</span>
                        <span className="font-medium text-slate-600">{task.assignee.name}</span>
                    </span>
                )}
                {task.is_mine && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                        Mine
                    </span>
                )}
            </div>

            {/* Checklist progress */}
            {task.checklist_total > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Checklist</span>
                        <span className="font-semibold text-slate-700">
                            {task.checklist_completed}/{task.checklist_total}
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-[color:var(--color-brand-dark-green)] transition-all duration-300"
                            style={{
                                width: `${Math.round((task.checklist_completed / task.checklist_total) * 100)}%`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* View link */}
            <div className="pt-1 border-t border-slate-100">
                <Link
                    href={task.action_url}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                    <span>View Activity & Task</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </Link>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'To Do' | 'In Progress' | 'Under Review' | 'Returned' | 'Completed' | 'overdue' | 'mine';

export default function MyTasksIndex({ tasks, stats, roleContext }: MyTasksIndexProps) {
    const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
    const [projectFilter, setProjectFilter] = useState<string>('ALL');

    // Derive unique projects from tasks for the project filter
    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => map.set(t.project.id, t.project.title));
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const matchesStatus =
                activeFilter === 'all' ||
                (activeFilter === 'overdue' ? task.is_overdue && task.status !== 'Completed' :
                activeFilter === 'mine' ? task.is_mine :
                task.status === activeFilter);
            const matchesProject = projectFilter === 'ALL' || task.project.id === projectFilter;
            return matchesStatus && matchesProject;
        });
    }, [tasks, activeFilter, projectFilter]);

    const roleScopeLabel = {
        leader: 'Showing all tasks across your projects (Project Leader view)',
        staff:  'Showing tasks in your assigned committees (Project Staff view)',
        member: 'Showing tasks assigned to you (Project Member view)',
    }[roleContext];

    const handleClearFilters = () => {
        setActiveFilter('all');
        setProjectFilter('ALL');
    };

    const isFiltered = activeFilter !== 'all' || projectFilter !== 'ALL';

    return (
        <AppLayout
            title="My Tasks"
            subtitle={roleScopeLabel}
        >
            <Head title="My Tasks — ITASK" />

            <div className="space-y-6">
                {/* ── Stats Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard
                        label="Total"
                        count={stats.total}
                        colorClass="text-slate-500"
                        icon={<CheckSquare className="w-4 h-4 text-slate-400" />}
                        active={activeFilter === 'all'}
                        onClick={() => setActiveFilter('all')}
                    />
                    <StatCard
                        label="To Do"
                        count={stats.todo}
                        colorClass="text-slate-600"
                        icon={<ListTodo className="w-4 h-4 text-slate-400" />}
                        active={activeFilter === 'To Do'}
                        onClick={() => setActiveFilter('To Do')}
                    />
                    <StatCard
                        label="In Progress"
                        count={stats.in_progress}
                        colorClass="text-blue-600"
                        icon={<Clock className="w-4 h-4 text-blue-400" />}
                        active={activeFilter === 'In Progress'}
                        onClick={() => setActiveFilter('In Progress')}
                    />
                    <StatCard
                        label="Under Review"
                        count={stats.under_review}
                        colorClass="text-amber-600"
                        icon={<Shield className="w-4 h-4 text-amber-400" />}
                        active={activeFilter === 'Under Review'}
                        onClick={() => setActiveFilter('Under Review')}
                    />
                    <StatCard
                        label="Completed"
                        count={stats.completed}
                        colorClass="text-emerald-600"
                        icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        active={activeFilter === 'Completed'}
                        onClick={() => setActiveFilter('Completed')}
                    />
                    <StatCard
                        label="Overdue"
                        count={stats.overdue}
                        colorClass="text-rose-600"
                        icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
                        active={activeFilter === 'overdue'}
                        onClick={() => setActiveFilter('overdue')}
                    />
                </div>

                {/* ── Filters Row ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-3 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filter</span>
                    </div>

                    {/* Status chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {(['all', 'mine', 'To Do', 'In Progress', 'Under Review', 'Returned', 'Completed', 'overdue'] as FilterStatus[]).map((f) => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setActiveFilter(f)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                    activeFilter === f
                                        ? 'bg-[color:var(--color-brand-action-orange)] text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {f === 'all' ? 'All' : f === 'mine' ? 'Mine' : f === 'overdue' ? 'Overdue' : f}
                            </button>
                        ))}
                    </div>

                    {/* Project filter */}
                    {projectOptions.length > 1 && (
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="h-8 px-2.5 text-xs text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] rounded-lg focus:outline-none focus:border-[color:var(--color-brand-action-orange)] cursor-pointer ml-auto"
                        >
                            <option value="ALL">All Projects</option>
                            {projectOptions.map((p) => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                    )}

                    {isFiltered && (
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors cursor-pointer ml-auto"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>

                {/* ── Task Results ── */}
                {filteredTasks.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                        <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-slate-700">
                            {tasks.length === 0 ? 'No Tasks Found' : 'No Matching Tasks'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                            {tasks.length === 0
                                ? 'You have no tasks visible within your current project scope.'
                                : 'Try adjusting the filters to see more tasks.'}
                        </p>
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                Clear Filters
                            </button>
                        )}
                        {tasks.length === 0 && (
                            <Link
                                href="/projects"
                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                            >
                                <FolderOpen className="w-3.5 h-3.5" />
                                Go to Projects
                            </Link>
                        )}
                    </div>
                ) : (
                    <div>
                        <p className="text-xs text-[color:var(--color-text-muted)] mb-3">
                            Showing <span className="font-semibold text-[color:var(--color-text-main)]">{filteredTasks.length}</span> task{filteredTasks.length !== 1 ? 's' : ''}
                            {isFiltered && ` (filtered from ${tasks.length})`}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredTasks.map((task) => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
