import React from 'react';
import { Head } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { GanttTimeline } from '@/Components/GanttTimeline';
import { type ProjectTimelineData } from '@/types';

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
        <AppLayout
            title="Timeline / Gantt"
            subtitle="Project schedule and activity progress visualization"
        >
            <Head title="Timeline / Gantt — ITASK" />

            <div className="space-y-4">
                {/* Main Gantt Timeline Component (page title is only in the top header) */}
                <GanttTimeline timelines={effectiveTimelines} isGlobal={true} />
            </div>
        </AppLayout>
    );
}
