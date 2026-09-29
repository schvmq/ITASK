import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    GanttChartSquare,
    FolderOpen,
    ChevronRight,
    Calendar,
    CheckCircle2,
    Clock,
    ArrowUpRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineProject {
    id: string;
    title: string;
    description: string;
    status: string;
    role: string;
    start_date: string | null;
    end_date: string | null;
    progress: number;
    total_tasks: number;
    completed_tasks: number;
    committees_count: number;
    timeline_url: string;
    project_url: string;
}

interface TimelineIndexProps {
    projects: TimelineProject[];
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatusBadgeClass(status: string): string {
    switch (status) {
        case 'Active':      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'In Progress': return 'bg-sky-50 text-sky-700 border-sky-200';
        case 'Completed':   return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'On Hold':     return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Archived':    return 'bg-slate-100 text-slate-600 border-slate-300';
        case 'Planning':
        default:            return 'bg-slate-50 text-slate-700 border-slate-200';
    }
}

function getRoleBadgeClass(role: string): string {
    switch (role) {
        case 'Project Leader': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
        case 'Project Staff':  return 'bg-orange-50 text-orange-800 border-orange-200';
        default:               return 'bg-slate-100 text-slate-700 border-slate-300';
    }
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectTimelineCard({ project }: { project: TimelineProject }) {
    const progress = Math.round(project.progress);

    return (
        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:shadow-md hover:border-[color:var(--color-brand-action-orange)]/40 transition-all duration-200 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${getRoleBadgeClass(project.role)}`}>
                            {project.role}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadgeClass(project.status)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'Active' || project.status === 'Completed' ? 'bg-emerald-500' : project.status === 'In Progress' ? 'bg-sky-500' : 'bg-slate-400'}`} />
                            {project.status}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)] leading-snug">
                        {project.title}
                    </h3>
                    {project.description && (
                        <p className="text-xs text-[color:var(--color-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                            {project.description}
                        </p>
                    )}
                </div>
                <FolderOpen className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--color-text-muted)]">
                {(project.start_date || project.end_date) && (
                    <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{project.start_date ?? '—'} → {project.end_date ?? '—'}</span>
                    </span>
                )}
                <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{project.committees_count} committee{project.committees_count !== 1 ? 's' : ''}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{project.completed_tasks}/{project.total_tasks} tasks</span>
                </span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-medium">Overall Progress</span>
                    <span className="font-bold text-[color:var(--color-brand-dark-green)]">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full bg-[color:var(--color-brand-dark-green)] transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                <Link
                    href={project.timeline_url}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-dark-green)] hover:opacity-90 transition-opacity"
                >
                    <GanttChartSquare className="w-3.5 h-3.5" />
                    <span>View Gantt / Timeline</span>
                </Link>
                <Link
                    href={project.project_url}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                    title="Go to project"
                >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimelineIndex({ projects }: TimelineIndexProps) {
    return (
        <AppLayout
            title="Timeline"
            subtitle="Gantt and schedule views for your CCIS projects"
        >
            <Head title="Timeline — ITASK" />

            <div className="space-y-6">
                {/* Intro */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[color:var(--color-brand-dark-green)] flex items-center justify-center shrink-0">
                            <GanttChartSquare className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[color:var(--color-text-main)]">Project Gantt Timelines</h2>
                            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5 leading-relaxed">
                                Select a project to view its full Gantt chart with committee, activity, and task hierarchy.
                                Progress is calculated from real task completion data.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Project cards */}
                {projects.length === 0 ? (
                    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                        <GanttChartSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-slate-700">No Projects Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                            You are not currently assigned to any projects. Timeline views are available once you have project access.
                        </p>
                        <Link
                            href="/projects"
                            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                        >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Go to Projects
                        </Link>
                    </div>
                ) : (
                    <div>
                        <p className="text-xs text-[color:var(--color-text-muted)] mb-3">
                            <span className="font-semibold text-[color:var(--color-text-main)]">{projects.length}</span> project{projects.length !== 1 ? 's' : ''} accessible
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {projects.map((project) => (
                                <ProjectTimelineCard key={project.id} project={project} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
