import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { GanttTimeline } from '@/Components/GanttTimeline';
import { Button } from '@/Components/Button';
import { type ProjectTimelineData } from '@/types';
import { Calendar, FolderOpen } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineProjectSummary {
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
    projects: TimelineProjectSummary[];
    timelines?: ProjectTimelineData[];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimelineIndex({ projects, timelines = [] }: TimelineIndexProps) {
    // Fallback if timelines is empty but projects are provided
    const effectiveTimelines: ProjectTimelineData[] = React.useMemo(() => {
        if (timelines && timelines.length > 0) {
            return timelines;
        }

        if (projects && projects.length > 0) {
            return projects.map((p) => ({
                id: p.id,
                name: p.title,
                title: p.title,
                description: p.description,
                status: p.status,
                start_date: p.start_date,
                start_date_raw: p.start_date,
                end_date: p.end_date,
                end_date_raw: p.end_date,
                duration_days: null,
                progress: p.progress,
                total_committees: p.committees_count,
                total_activities: 0,
                completed_activities: 0,
                total_tasks: p.total_tasks,
                completed_tasks: p.completed_tasks,
                committees: [],
                parent_id: null,
                type: 'project',
            }));
        }

        return [];
    }, [timelines, projects]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Timeline — ITASK" />

            <div className="space-y-6">
                {/* ══ 1. Page Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            Timeline
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            Gantt schedule and activity progress across your CCIS projects.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        <Link href="/calendar">
                            <Button variant="secondary" size="md">
                                <Calendar className="w-4 h-4 mr-1.5" />
                                <span>Calendar</span>
                            </Button>
                        </Link>
                        <Link href="/projects">
                            <Button variant="secondary" size="md">
                                <FolderOpen className="w-4 h-4 mr-1.5" />
                                <span>Projects</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ══ 2. Main Gantt Timeline Component ══ */}
                <GanttTimeline timelines={effectiveTimelines} isGlobal={true} />
            </div>
        </AppLayout>
    );
}
