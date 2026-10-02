import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    Search,
    ChevronDown,
    X,
    CheckSquare,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function renderDaysLeft(task: MyTask) {
    if (task.status === 'Completed') {
        return <span className="text-slate-400 font-medium text-xs sm:text-[13px]">Done</span>;
    }

    if (!task.due_date) {
        return <span className="text-slate-400 font-medium text-xs sm:text-[13px]">—</span>;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = task.due_date.split('-');
    const dueDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const absDays = Math.abs(diffDays);
        return (
            <span className="text-rose-600 font-bold text-xs sm:text-[13px] whitespace-nowrap">
                {absDays}d overdue
            </span>
        );
    }

    if (diffDays === 0) {
        return (
            <span className="text-amber-600 font-bold text-xs sm:text-[13px] whitespace-nowrap">
                Due today
            </span>
        );
    }

    if (diffDays <= 3) {
        return (
            <span className="text-amber-600 font-bold text-xs sm:text-[13px] whitespace-nowrap">
                {diffDays}d
            </span>
        );
    }

    return (
        <span className="text-slate-600 font-medium text-xs sm:text-[13px] whitespace-nowrap">
            {diffDays}d
        </span>
    );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: MyTask }) {
    return (
        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors group">
            {/* Task */}
            <td className="pl-4 sm:pl-5 pr-2 py-3 overflow-hidden">
                <Link
                    href={task.action_url}
                    className="font-semibold text-[13px] text-slate-900 hover:text-[color:var(--color-brand-action-orange)] transition-colors leading-snug block truncate"
                    title={task.title}
                >
                    {task.title}
                </Link>
            </td>

            {/* Activity */}
            <td className="px-2.5 sm:px-3 py-3 overflow-hidden">
                <div className="text-slate-500 text-[13px] truncate" title={task.activity.title}>
                    {task.activity.title}
                </div>
                {task.activity.status === 'Under Review' && (
                    <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            Under Review
                        </span>
                    </div>
                )}
                {task.activity.status === 'Returned' && (
                    <div className="mt-1">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                            Returned
                        </span>
                    </div>
                )}
            </td>

            {/* Committee */}
            <td className="px-2.5 sm:px-3 py-3 overflow-hidden" title={task.committee.name}>
                <div className="text-slate-500 text-[13px] truncate">{task.committee.name}</div>
            </td>

            {/* Project */}
            <td className="px-2.5 sm:px-3 py-3 overflow-hidden" title={task.project.title}>
                <div className="text-slate-500 text-[13px] truncate">{task.project.title}</div>
            </td>

            {/* Due */}
            <td className="px-2 sm:px-2.5 py-3 text-slate-500 text-[13px] whitespace-nowrap overflow-hidden">
                {formatDueDate(task.due_date)}
            </td>

            {/* Days Left */}
            <td className="px-2 sm:px-2.5 py-3 whitespace-nowrap overflow-hidden">
                {renderDaysLeft(task)}
            </td>

            {/* Status */}
            <td className="pl-2 pr-4 sm:pr-5 py-3 whitespace-nowrap overflow-hidden">
                <Link
                    href={task.action_url}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors"
                    title="Open task"
                >
                    <span>{task.status}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </Link>
            </td>
        </tr>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyTasksIndex({ tasks, roleContext }: MyTasksIndexProps) {
    const [projectFilter, setProjectFilter] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // Derive unique projects from tasks for the project filter
    const projectOptions = useMemo(() => {
        const map = new Map<string, string>();
        tasks.forEach((t) => map.set(t.project.id, t.project.title));
        return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
    }, [tasks]);

    // Filtered tasks across search and project dropdown
    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            // Project filter
            if (projectFilter !== 'ALL' && task.project.id !== projectFilter) {
                return false;
            }

            // Search filter
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
    }, [tasks, projectFilter, searchTerm]);

    // Group tasks into the 3 prototype sections in exact order:
    // 1. In Progress (includes In Progress, Under Review, Returned)
    // 2. To Do
    // 3. Completed
    const inProgressTasks = useMemo(() => {
        return filteredTasks.filter(
            (t) => t.status === 'In Progress' || t.status === 'Under Review' || t.status === 'Returned'
        );
    }, [filteredTasks]);

    const toDoTasks = useMemo(() => {
        return filteredTasks.filter((t) => t.status === 'To Do');
    }, [filteredTasks]);

    const completedTasks = useMemo(() => {
        return filteredTasks.filter((t) => t.status === 'Completed');
    }, [filteredTasks]);

    const hasAnyFilteredTasks = filteredTasks.length > 0;
    const isFiltered = projectFilter !== 'ALL' || searchTerm.trim() !== '';

    const handleClearFilters = () => {
        setProjectFilter('ALL');
        setSearchTerm('');
    };

    const activeTasksCount = useMemo(() => {
        return tasks.filter((t) => t.status !== 'Completed').length;
    }, [tasks]);

    return (
        <AppLayout
            title="My Tasks"
            subtitle={`${activeTasksCount} active ${activeTasksCount === 1 ? 'task' : 'tasks'} across all projects`}
        >
            <Head title="My Tasks — ITASK" />

            <div className="space-y-6">

                {/* ── Top Bar: Search Tasks + All Projects Dropdown ── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tasks..."
                            className="w-full pl-9 pr-8 py-2 text-xs text-slate-800 bg-white rounded-lg border border-slate-200 placeholder:text-slate-400 focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] focus:ring-1 focus:ring-[color:var(--color-brand-action-orange)] transition-all shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* All Projects Dropdown */}
                    <div className="relative w-full sm:w-auto">
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            className="appearance-none w-full sm:w-auto h-[35px] pl-3 pr-8 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] cursor-pointer shadow-2xs"
                            aria-label="Filter by project"
                        >
                            <option value="ALL">All Projects</option>
                            {projectOptions.map((p) => (
                                <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* ── Overall Empty State (when zero tasks exist across the board or after search) ── */}
                {!hasAnyFilteredTasks ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3 shadow-2xs">
                            <CheckSquare className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                            {tasks.length === 0
                                ? "You don't have any assigned tasks yet."
                                : 'No tasks match your search or filter.'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                            {tasks.length === 0
                                ? 'Tasks assigned to you across projects will appear here in your work queue.'
                                : 'Try adjusting your search query or selecting "All Projects" to view your tasks.'}
                        </p>
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-dark-green)] bg-[color:var(--color-brand-active-warm-orange)] hover:bg-orange-100 transition-colors cursor-pointer border border-orange-200"
                            >
                                <span>Reset Filters</span>
                            </button>
                        )}
                    </div>
                ) : (
                    /* ── Single unified table card — fits box with no horizontal scroll ── */
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.03)] overflow-hidden">
                        <table className="w-full text-left" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            {/* Single colgroup — every section shares these widths */}
                            <colgroup>
                                <col style={{ width: '23%' }} />
                                <col style={{ width: '20%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '9%' }} />
                                <col style={{ width: '11%' }} />
                            </colgroup>

                            {/* Sticky column header */}
                            <thead>
                                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">
                                    <th className="pl-4 sm:pl-5 pr-2 py-3 text-left">Task</th>
                                    <th className="px-2.5 sm:px-3 py-3 text-left">Activity</th>
                                    <th className="px-2.5 sm:px-3 py-3 text-left">Committee</th>
                                    <th className="px-2.5 sm:px-3 py-3 text-left">Project</th>
                                    <th className="px-2 sm:px-2.5 py-3 text-left">Due</th>
                                    <th className="px-2 sm:px-2.5 py-3 text-left">Days Left</th>
                                    <th className="pl-2 pr-4 sm:pr-5 py-3 text-left">Status</th>
                                </tr>
                            </thead>

                            {/* ── In Progress ── */}
                            <tbody>
                                <tr className="bg-slate-50/70 border-y border-slate-100">
                                    <td colSpan={7} className="px-4 sm:px-5 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block shrink-0" />
                                            <span className="text-[12px] font-semibold text-slate-700">In Progress</span>
                                            <span className="text-[12px] font-normal text-slate-400">{inProgressTasks.length}</span>
                                        </div>
                                    </td>
                                </tr>
                                {inProgressTasks.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 sm:px-5 py-5 text-center text-xs text-slate-400">No tasks currently in progress.</td></tr>
                                ) : (
                                    inProgressTasks.map((task) => <TaskRow key={task.id} task={task} />)
                                )}
                            </tbody>

                            {/* ── To Do ── */}
                            <tbody>
                                <tr className="bg-slate-50/70 border-y border-slate-100">
                                    <td colSpan={7} className="px-4 sm:px-5 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block shrink-0" />
                                            <span className="text-[12px] font-semibold text-slate-700">To Do</span>
                                            <span className="text-[12px] font-normal text-slate-400">{toDoTasks.length}</span>
                                        </div>
                                    </td>
                                </tr>
                                {toDoTasks.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 sm:px-5 py-5 text-center text-xs text-slate-400">No tasks to do.</td></tr>
                                ) : (
                                    toDoTasks.map((task) => <TaskRow key={task.id} task={task} />)
                                )}
                            </tbody>

                            {/* ── Completed ── */}
                            <tbody>
                                <tr className="bg-slate-50/70 border-y border-slate-100">
                                    <td colSpan={7} className="px-4 sm:px-5 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                                            <span className="text-[12px] font-semibold text-slate-700">Completed</span>
                                            <span className="text-[12px] font-normal text-slate-400">{completedTasks.length}</span>
                                        </div>
                                    </td>
                                </tr>
                                {completedTasks.length === 0 ? (
                                    <tr><td colSpan={7} className="px-4 sm:px-5 py-5 text-center text-xs text-slate-400">No completed tasks yet.</td></tr>
                                ) : (
                                    completedTasks.map((task) => <TaskRow key={task.id} task={task} />)
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
