import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    GanttChartSquare,
    FolderOpen,
    Layers,
    Calendar,
    CheckCircle2,
    Clock,
    AlertCircle,
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ListTodo,
    Sparkles,
} from 'lucide-react';
import { Badge } from '@/Components/Badge';
import { Button } from '@/Components/Button';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TimelineActivity {
    id: string;
    title: string;
    status: string;
    start_date?: string | null;
    due_date?: string | null;
    start_date_formatted?: string | null;
    due_date_formatted?: string | null;
    tasks_total: number;
    tasks_completed: number;
    progress_percent: number;
    action_url: string;
}

export interface TimelineCommittee {
    id: string;
    name: string;
    activities_count: number;
    activities: TimelineActivity[];
}

export interface TimelineProject {
    id: string;
    title: string;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    start_date_formatted?: string | null;
    end_date_formatted?: string | null;
    progress_percent: number;
    committees: TimelineCommittee[];
}

export interface TimelineIndexProps {
    projects: TimelineProject[];
    project_options: Array<{ id: string; title: string }>;
    filters: {
        project_id: string;
    };
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function ActivityStatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'Completed':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                </span>
            );
        case 'In Progress':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                    In Progress
                </span>
            );
        case 'Under Review':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Under Review
                </span>
            );
        case 'Returned':
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3 h-3" />
                    Returned
                </span>
            );
        case 'To Do':
        default:
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    To Do
                </span>
            );
    }
}

export default function Index({
    projects = [],
    project_options = [],
    filters = {
        project_id: 'all',
    },
}: TimelineIndexProps) {
    const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

    const toggleProject = (projectId: string) => {
        setCollapsedProjects((prev) => ({
            ...prev,
            [projectId]: !prev[projectId],
        }));
    };

    const handleProjectFilterChange = (projectId: string) => {
        router.get(
            '/timeline',
            { project_id: projectId },
            { preserveState: true, preserveScroll: true, replace: true }
        );
    };

    return (
        <AppLayout
            title="Timeline & Gantt Roadmap"
            subtitle="Milestone roadmaps, committee deliverables, and progress tracking across semesters."
        >
            <Head title="Timeline" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* ─── Controls & Filter Bar ───────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <GanttChartSquare className="w-5 h-5 text-[color:var(--color-brand-dark-green)]" />
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">Project Roadmaps</h2>
                            <p className="text-xs text-slate-500">Visualizing start dates, target completions, and deliverable pacing.</p>
                        </div>
                    </div>

                    {/* Filter Selector */}
                    {project_options.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Filter Project:</span>
                            <select
                                value={filters.project_id}
                                onChange={(e) => handleProjectFilterChange(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[color:var(--color-brand-dark-green)]"
                            >
                                <option value="all">All Projects ({project_options.length})</option>
                                {project_options.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* ─── Project Roadmap Cards ───────────────────────────────────── */}
                {projects.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
                        <GanttChartSquare className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                        <h3 className="text-sm font-bold text-slate-800">No project timelines available</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            Projects with defined start dates and committee activities will appear here in chronological roadmap view.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {projects.map((project) => {
                            const isCollapsed = collapsedProjects[project.id];

                            return (
                                <div
                                    key={project.id}
                                    className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden"
                                >
                                    {/* Project Header Bar */}
                                    <div
                                        onClick={() => toggleProject(project.id)}
                                        className="p-4 bg-slate-50/70 border-b border-slate-200/80 hover:bg-slate-100/60 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <button className="text-slate-400 hover:text-slate-700">
                                                {isCollapsed ? (
                                                    <ChevronRight className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                )}
                                            </button>
                                            <FolderOpen className="w-4 h-4 text-[color:var(--color-brand-dark-green)]" />
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900">
                                                    {project.title}
                                                </h3>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                    <span>Status: <strong className="text-slate-700">{project.status}</strong></span>
                                                    {(project.start_date_formatted || project.end_date_formatted) && (
                                                        <span>
                                                            Duration: {project.start_date_formatted || 'Start'} ➔ {project.end_date_formatted || 'Ongoing'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Project Progress Gauge */}
                                        <div className="flex items-center gap-3 min-w-48">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                                                    <span>Overall Progress</span>
                                                    <span>{project.progress_percent}%</span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[color:var(--color-brand-dark-green)] rounded-full transition-all duration-300"
                                                        style={{ width: `${project.progress_percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Committees & Activities Breakdown */}
                                    {!isCollapsed && (
                                        <div className="p-5 space-y-6">
                                            {project.committees.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No committees formed for this project yet.</p>
                                            ) : (
                                                project.committees.map((committee) => (
                                                    <div key={committee.id} className="space-y-2.5">
                                                        {/* Committee Label */}
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-l-2 border-[color:var(--color-brand-active-warm-orange)] pl-2">
                                                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>{committee.name}</span>
                                                            <span className="text-[10px] font-normal text-slate-400">
                                                                ({committee.activities.length} activities)
                                                            </span>
                                                        </div>

                                                        {/* Activities Timeline Rows */}
                                                        {committee.activities.length === 0 ? (
                                                            <div className="text-xs text-slate-400 pl-4 py-1 italic">
                                                                No scheduled activities logged in this committee.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2 pl-4">
                                                                {committee.activities.map((activity) => (
                                                                    <div
                                                                        key={activity.id}
                                                                        className="p-3 bg-slate-50/60 rounded-lg border border-slate-200/70 hover:border-slate-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                                                                    >
                                                                        {/* Activity Info */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                                                                    {activity.title}
                                                                                </h4>
                                                                                <ActivityStatusBadge status={activity.status} />
                                                                            </div>

                                                                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                                                                                <span className="flex items-center gap-1">
                                                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                                                    {activity.start_date_formatted || 'No start'} ➔ {activity.due_date_formatted || 'No deadline'}
                                                                                </span>
                                                                                <span className="flex items-center gap-1">
                                                                                    <ListTodo className="w-3 h-3 text-slate-400" />
                                                                                    {activity.tasks_completed}/{activity.tasks_total} Tasks
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Gantt Bar representation */}
                                                                        <div className="flex items-center gap-3 shrink-0 md:w-64">
                                                                            <div className="flex-1">
                                                                                <div className="w-full h-3 bg-slate-200/80 rounded-md overflow-hidden relative">
                                                                                    <div
                                                                                        className={`h-full rounded-md transition-all duration-300 ${
                                                                                            activity.status === 'Completed'
                                                                                                ? 'bg-emerald-600'
                                                                                                : 'bg-[color:var(--color-brand-active-warm-orange)]'
                                                                                        }`}
                                                                                        style={{ width: `${activity.progress_percent}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>

                                                                            <span className="text-[11px] font-bold text-slate-600 w-10 text-right">
                                                                                {activity.progress_percent}%
                                                                            </span>

                                                                            <Link
                                                                                href={activity.action_url}
                                                                                className="text-slate-400 hover:text-[color:var(--color-brand-dark-green)] transition-colors p-1"
                                                                                title="View Activity Details"
                                                                            >
                                                                                <ArrowRight className="w-4 h-4" />
                                                                            </Link>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
