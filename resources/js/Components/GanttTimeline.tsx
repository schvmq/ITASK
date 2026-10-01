import React, { useState, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    ChevronDown,
    ExternalLink,
    Layers,
    Calendar,
} from 'lucide-react';
import {
    type ProjectTimelineData,
    type CommitteeTimelineItem,
    type ActivityTimelineItem,
    type TaskTimelineItem,
} from '@/types';

export interface GanttTimelineProps {
    timeline?: ProjectTimelineData | null;
    timelines?: ProjectTimelineData[] | null;
    className?: string;
    isGlobal?: boolean;
}

// ─── Timeline Scale Types ─────────────────────────────────────────────────────

export type TimelineScale = 'day' | 'week' | 'month';

interface TimelineColumn {
    id: string;
    label: string;
    subLabel?: string;
    date: Date;
    widthPx: number;
}

// Helper: Calculate ISO week number (1-53)
function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// ─── Status Configurations & Color Legend ─────────────────────────────────────

interface StatusTheme {
    label: string;
    dotColor: string;
    barFill: string;
    textColor: string;
}

const STATUS_THEMES: Record<string, StatusTheme> = {
    Completed: {
        label: 'Completed',
        dotColor: 'bg-emerald-500',
        barFill: 'bg-emerald-500',
        textColor: 'text-emerald-700',
    },
    'Under Review': {
        label: 'Under Review',
        dotColor: 'bg-amber-400',
        barFill: 'bg-amber-400',
        textColor: 'text-amber-700',
    },
    'In Progress': {
        label: 'In Progress',
        dotColor: 'bg-blue-500',
        barFill: 'bg-[#7C88F7]',
        textColor: 'text-blue-700',
    },
    Returned: {
        label: 'Returned',
        dotColor: 'bg-rose-500',
        barFill: 'bg-rose-500',
        textColor: 'text-rose-700',
    },
    'To Do': {
        label: 'To Do',
        dotColor: 'bg-slate-400',
        barFill: 'bg-slate-300',
        textColor: 'text-slate-600',
    },
    Submitted: {
        label: 'Submitted',
        dotColor: 'bg-purple-500',
        barFill: 'bg-purple-500',
        textColor: 'text-purple-700',
    },
};

function getStatusTheme(status: string): StatusTheme {
    if (STATUS_THEMES[status]) return STATUS_THEMES[status];
    if (status === 'Active') return STATUS_THEMES['Completed'];
    if (status === 'Planning') return STATUS_THEMES['To Do'];
    return {
        label: status || 'To Do',
        dotColor: 'bg-slate-400',
        barFill: 'bg-slate-300',
        textColor: 'text-slate-600',
    };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
    timeline,
    timelines,
    className = '',
    isGlobal = false,
}) => {
    // 1. Determine list of projects to render
    const allProjects = useMemo<ProjectTimelineData[]>(() => {
        if (timelines && timelines.length > 0) {
            return timelines;
        }
        if (timeline) {
            return [timeline];
        }
        return [];
    }, [timeline, timelines]);

    // 2. Filters & View State
    const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [scale, setScale] = useState<TimelineScale>('week');

    // 3. Expand / Collapse State
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        allProjects.forEach((proj) => {
            initial.add(`project-${proj.id}`);
            (proj.committees || []).forEach((c) => {
                initial.add(`committee-${c.id}`);
            });
        });
        return initial;
    });

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        const all = new Set<string>();
        allProjects.forEach((proj) => {
            all.add(`project-${proj.id}`);
            (proj.committees || []).forEach((c) => {
                all.add(`committee-${c.id}`);
                (c.activities || []).forEach((a) => {
                    all.add(`activity-${a.id}`);
                });
            });
        });
        setExpandedIds(all);
    };

    const handleCollapseAll = () => {
        setExpandedIds(new Set());
    };

    // 4. Filter projects based on dropdowns
    const filteredProjects = useMemo(() => {
        let result = allProjects;

        if (selectedProjectId !== 'all') {
            result = result.filter((p) => p.id === selectedProjectId);
        }

        if (selectedStatus !== 'all') {
            result = result.map((p) => {
                const filteredCommittees = (p.committees || []).map((c) => {
                    const filteredActivities = (c.activities || []).map((a) => {
                        const filteredTasks = (a.tasks || []).filter((t) => t.status === selectedStatus);
                        return {
                            ...a,
                            tasks: filteredTasks,
                            matchesStatus: a.status === selectedStatus || filteredTasks.length > 0,
                        };
                    }).filter((a) => a.matchesStatus);

                    return {
                        ...c,
                        activities: filteredActivities,
                        matchesStatus:
                            (selectedStatus === 'Completed' && c.progress === 100) ||
                            (selectedStatus === 'In Progress' && c.progress > 0 && c.progress < 100) ||
                            filteredActivities.length > 0,
                    };
                }).filter((c) => c.matchesStatus);

                return {
                    ...p,
                    committees: filteredCommittees,
                    matchesStatus: p.status === selectedStatus || filteredCommittees.length > 0,
                };
            }).filter((p) => p.matchesStatus);
        }

        return result;
    }, [allProjects, selectedProjectId, selectedStatus]);

    // 5. Timeline Date Range & Column Calculations adapting to Day / Week / Month
    const { gridStart, gridEnd, totalMs, timeColumns, timelineTotalWidthPx } = useMemo(() => {
        const dateTimestamps: number[] = [];

        const parseDate = (d?: string | null) => {
            if (!d) return null;
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        allProjects.forEach((proj) => {
            if (proj.start_date_raw) {
                const d = parseDate(proj.start_date_raw);
                if (d) dateTimestamps.push(d.getTime());
            }
            if (proj.end_date_raw) {
                const d = parseDate(proj.end_date_raw);
                if (d) dateTimestamps.push(d.getTime());
            }
            (proj.committees || []).forEach((c) => {
                if (c.start_date_raw) {
                    const d = parseDate(c.start_date_raw);
                    if (d) dateTimestamps.push(d.getTime());
                }
                if (c.end_date_raw) {
                    const d = parseDate(c.end_date_raw);
                    if (d) dateTimestamps.push(d.getTime());
                }
                (c.activities || []).forEach((a) => {
                    if (a.start_date_raw) {
                        const d = parseDate(a.start_date_raw);
                        if (d) dateTimestamps.push(d.getTime());
                    }
                    if (a.due_date_raw) {
                        const d = parseDate(a.due_date_raw);
                        if (d) dateTimestamps.push(d.getTime());
                    }
                    (a.tasks || []).forEach((t) => {
                        if (t.due_date_raw) {
                            const d = parseDate(t.due_date_raw);
                            if (d) dateTimestamps.push(d.getTime());
                        }
                    });
                });
            });
        });

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let minDate: Date;
        let maxDate: Date;

        if (dateTimestamps.length > 0) {
            minDate = new Date(Math.min(...dateTimestamps, now.getTime()));
            maxDate = new Date(Math.max(...dateTimestamps, now.getTime()));
        } else {
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        }

        const cols: TimelineColumn[] = [];
        let start: Date;
        let end: Date;

        if (scale === 'day') {
            // Day Scale: Exactly 14 days (2 weeks)
            let s: Date;
            if (now.getTime() >= minDate.getTime() && now.getTime() <= maxDate.getTime()) {
                // Center around today: start at Monday of current week
                s = new Date(now);
                s.setHours(0, 0, 0, 0);
                const day = s.getDay();
                const diff = day === 0 ? -6 : 1 - day;
                s.setDate(s.getDate() + diff);
            } else {
                s = new Date(minDate);
                s.setHours(0, 0, 0, 0);
                const day = s.getDay();
                const diff = day === 0 ? -6 : 1 - day;
                s.setDate(s.getDate() + diff);
            }

            start = new Date(s);
            // Exactly 14 days: 13 days after start
            end = new Date(start.getTime() + 13 * 86400000);
            end.setHours(23, 59, 59, 999);

            const colWidth = 76;
            let curr = new Date(start);
            while (curr <= end && cols.length < 14) {
                const label = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const subLabel = curr.toLocaleDateString('en-US', { weekday: 'short' });
                cols.push({
                    id: `day-${curr.toISOString().slice(0, 10)}`,
                    label,
                    subLabel,
                    date: new Date(curr),
                    widthPx: colWidth,
                });
                curr.setDate(curr.getDate() + 1);
            }
        } else if (scale === 'week') {
            // Week Scale: Weekly ticks (W39 | W40 ...), minimum 8 weeks
            start = new Date(minDate);
            start.setHours(0, 0, 0, 0);
            const startDay = start.getDay();
            const diffToMon = startDay === 0 ? -6 : 1 - startDay;
            start.setDate(start.getDate() + diffToMon);

            end = new Date(maxDate);
            end.setHours(23, 59, 59, 999);
            const endDay = end.getDay();
            const diffToSun = endDay === 0 ? 0 : 7 - endDay;
            end.setDate(end.getDate() + diffToSun);

            if ((end.getTime() - start.getTime()) / (7 * 86400000) < 8) {
                end = new Date(start.getTime() + 9 * 7 * 86400000);
                end.setHours(23, 59, 59, 999);
            }

            const colWidth = 96;
            let curr = new Date(start);
            while (curr <= end) {
                const weekNum = getWeekNumber(curr);
                const label = `W${weekNum}`;
                const subLabel = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                cols.push({
                    id: `week-${curr.toISOString().slice(0, 10)}`,
                    label,
                    subLabel,
                    date: new Date(curr),
                    widthPx: colWidth,
                });
                curr.setDate(curr.getDate() + 7);
            }
        } else {
            // Month Scale: Exactly 12 months (full year view)
            if (minDate.getFullYear() === maxDate.getFullYear()) {
                start = new Date(minDate.getFullYear(), 0, 1, 0, 0, 0, 0);
            } else {
                start = new Date(minDate.getFullYear(), minDate.getMonth(), 1, 0, 0, 0, 0);
            }

            end = new Date(start.getFullYear(), start.getMonth() + 12, 0, 23, 59, 59, 999);

            const colWidth = 110;
            let curr = new Date(start);
            while (cols.length < 12) {
                const label = curr.toLocaleDateString('en-US', { month: 'short' });
                const subLabel = curr.getFullYear().toString();
                cols.push({
                    id: `month-${curr.getFullYear()}-${curr.getMonth()}`,
                    label,
                    subLabel,
                    date: new Date(curr),
                    widthPx: colWidth,
                });
                curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
            }
        }

        const totalDuration = end.getTime() - start.getTime();
        const totalWidth = cols.reduce((sum, c) => sum + c.widthPx, 0);

        return {
            gridStart: start,
            gridEnd: end,
            totalMs: totalDuration,
            timeColumns: cols,
            timelineTotalWidthPx: totalWidth,
        };
    }, [allProjects, scale]);

    // 6. Today indicator position percentage
    const todayPct = useMemo(() => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        const todayMs = today.getTime();
        if (todayMs < gridStart.getTime() || todayMs > gridEnd.getTime()) return null;
        return ((todayMs - gridStart.getTime()) / totalMs) * 100;
    }, [gridStart, gridEnd, totalMs]);

    // 7. Calculate Gantt Bar Style (accurate across Day / Week / Month)
    const calculateBarStyle = (startRaw?: string | null, endRaw?: string | null, isMilestone = false) => {
        if (!startRaw && !endRaw) return null;

        const parse = (d?: string | null) => (d ? new Date(d).getTime() : null);
        const s = parse(startRaw) || parse(endRaw);
        const e = parse(endRaw) || parse(startRaw);

        if (!s || !e) return null;

        // If completely outside the visible timeline range
        if (e < gridStart.getTime() || s > gridEnd.getTime()) {
            return null;
        }

        const clampedStart = Math.max(gridStart.getTime(), s);
        const clampedEnd = Math.min(gridEnd.getTime(), e);

        const leftPct = ((clampedStart - gridStart.getTime()) / totalMs) * 100;
        const dayMs = 86400000;
        const effectiveSpanMs = isMilestone ? dayMs : Math.max(dayMs, clampedEnd - clampedStart + dayMs);
        const widthPct = (effectiveSpanMs / totalMs) * 100;

        return {
            left: `${Math.max(0, leftPct)}%`,
            width: `${Math.min(100 - leftPct, Math.max(1.0, widthPct))}%`,
        };
    };

    if (allProjects.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800">No Timeline Data Scheduled</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    There are no scheduled projects, committees, or activities configured yet.
                </p>
                {isGlobal && (
                    <Link
                        href="/projects"
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                    >
                        Go to Projects
                    </Link>
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* ── Controls Row (Filters, Scale Selector, & Expand/Collapse) ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                {/* Left Dropdown Filters & Day/Week/Month Scale Selector */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Project Selector (only in global or multi-project mode) */}
                    {(isGlobal || allProjects.length > 1) && (
                        <div className="relative">
                            <select
                                id="gantt-project-filter"
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[color:var(--color-brand-dark-green)] shadow-2xs cursor-pointer"
                            >
                                <option value="all">All Projects</option>
                                {allProjects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title || p.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    )}

                    {/* Status Filter */}
                    <div className="relative">
                        <select
                            id="gantt-status-filter"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-[color:var(--color-brand-dark-green)] shadow-2xs cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Returned">Returned</option>
                            <option value="To Do">To Do</option>
                            <option value="Submitted">Submitted</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Scale Selector: Day | Week | Month */}
                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setScale('day')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                scale === 'day'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Day
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('week')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                scale === 'week'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Week
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale('month')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                                scale === 'month'
                                    ? 'bg-white text-slate-900 shadow-2xs'
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            Month
                        </button>
                    </div>
                </div>

                {/* Right Expand / Collapse Buttons */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={handleExpandAll}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                    >
                        Expand All
                    </button>
                    <button
                        type="button"
                        onClick={handleCollapseAll}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* ── Status Legend Row ── */}
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 px-1 py-0.5">
                {Object.entries(STATUS_THEMES).map(([statusKey, theme]) => (
                    <div key={statusKey} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${theme.dotColor} shrink-0`} />
                        <span className="text-[11px] font-medium text-slate-600">{theme.label}</span>
                    </div>
                ))}
            </div>

            {/* ── Main Gantt Chart Container (Real Gantt Focus) ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto relative [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.300)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 pb-0.5">
                    <div className="flex min-w-full divide-x divide-slate-200">
                        {/* ── LEFT COLUMN: Projects & Hierarchy ── */}
                        <div className="w-[260px] sm:w-[290px] shrink-0 sticky left-0 z-30 bg-white border-r border-slate-200 flex flex-col shadow-[2px_0_4px_-1px_rgba(0,0,0,0.04)]">
                            {/* Column Header */}
                            <div className="h-[50px] px-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <span>Projects</span>
                            </div>

                            {/* Left Rows */}
                            <div className="divide-y divide-slate-100 flex-1">
                                {filteredProjects.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400">
                                        No items match
                                    </div>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const isProjectExpanded = expandedIds.has(`project-${project.id}`);
                                        const hasCommittees = (project.committees || []).length > 0;

                                        return (
                                            <React.Fragment key={`left-proj-${project.id}`}>
                                                {/* Project Left Row */}
                                                <div className="h-[44px] px-3 bg-[#18262c] text-white flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        {hasCommittees ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpand(`project-${project.id}`)}
                                                                className="w-5 h-5 rounded hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                                                                aria-label={isProjectExpanded ? 'Collapse' : 'Expand'}
                                                            >
                                                                {isProjectExpanded ? (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span className="w-5 shrink-0" />
                                                        )}
                                                        <Link
                                                            href={`/projects/${project.id}`}
                                                            className="font-bold text-xs text-white hover:text-orange-300 transition-colors truncate"
                                                            title={project.title || project.name}
                                                        >
                                                            {project.title || project.name}
                                                        </Link>
                                                    </div>
                                                    <Link
                                                        href={`/projects/${project.id}`}
                                                        className="p-1 text-slate-400 hover:text-orange-300 rounded shrink-0 transition-colors"
                                                        title="Go to project"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </Link>
                                                </div>

                                                {/* Committee Left Rows */}
                                                {isProjectExpanded && (
                                                    hasCommittees ? (
                                                        project.committees.map((committee) => {
                                                            const isCommExpanded = expandedIds.has(`committee-${committee.id}`);
                                                            const hasActivities = (committee.activities || []).length > 0;

                                                            return (
                                                                <React.Fragment key={`left-comm-${committee.id}`}>
                                                                    <div className="h-[48px] pl-6 pr-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-1.5">
                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                            {hasActivities ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleExpand(`committee-${committee.id}`)}
                                                                                    className="w-4.5 h-4.5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                                                                    aria-label={isCommExpanded ? 'Collapse' : 'Expand'}
                                                                                >
                                                                                    {isCommExpanded ? (
                                                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                                                    ) : (
                                                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                                                    )}
                                                                                </button>
                                                                            ) : (
                                                                                <span className="w-4.5 shrink-0" />
                                                                            )}
                                                                            <div className="min-w-0 flex-1">
                                                                                <Link
                                                                                    href={`/projects/${project.id}/committees/${committee.id}`}
                                                                                    className="text-xs font-semibold text-slate-900 hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate block"
                                                                                    title={committee.name}
                                                                                >
                                                                                    {committee.name}
                                                                                </Link>
                                                                                <div className="text-[10px] text-slate-400 truncate">
                                                                                    {committee.activities?.length || 0} {committee.activities?.length === 1 ? 'activity' : 'activities'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Link
                                                                            href={`/projects/${project.id}/committees/${committee.id}`}
                                                                            className="p-1 text-slate-400 hover:text-[color:var(--color-brand-action-orange)] rounded shrink-0 transition-colors"
                                                                            title="View committee"
                                                                        >
                                                                            <ExternalLink className="w-3 h-3" />
                                                                        </Link>
                                                                    </div>

                                                                    {/* Activity Left Rows */}
                                                                    {isCommExpanded && (
                                                                        hasActivities ? (
                                                                            committee.activities.map((activity) => {
                                                                                const isActExpanded = expandedIds.has(`activity-${activity.id}`);
                                                                                const hasTasks = (activity.tasks || []).length > 0;

                                                                                return (
                                                                                    <React.Fragment key={`left-act-${activity.id}`}>
                                                                                        <div className="h-[44px] pl-11 pr-3 bg-slate-50/40 hover:bg-slate-50 flex items-center justify-between gap-1.5">
                                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                {hasTasks ? (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => toggleExpand(`activity-${activity.id}`)}
                                                                                                        className="w-4 h-4 rounded hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shrink-0 cursor-pointer"
                                                                                                        aria-label={isActExpanded ? 'Collapse' : 'Expand'}
                                                                                                    >
                                                                                                        {isActExpanded ? (
                                                                                                            <ChevronDown className="w-3 h-3" />
                                                                                                        ) : (
                                                                                                            <ChevronRight className="w-3 h-3" />
                                                                                                        )}
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <span className="w-4 shrink-0" />
                                                                                                )}
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <Link
                                                                                                        href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                        className="text-xs font-medium text-slate-700 hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate block"
                                                                                                        title={activity.title || activity.name}
                                                                                                    >
                                                                                                        {activity.title || activity.name}
                                                                                                    </Link>
                                                                                                    <div className="text-[10px] text-slate-400 truncate">
                                                                                                        {activity.tasks?.length || 0} {activity.tasks?.length === 1 ? 'task' : 'tasks'}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <Link
                                                                                                href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                className="p-1 text-slate-400 hover:text-[color:var(--color-brand-action-orange)] rounded shrink-0 transition-colors"
                                                                                                title="View activity"
                                                                                            >
                                                                                                <ExternalLink className="w-3 h-3" />
                                                                                            </Link>
                                                                                        </div>

                                                                                        {/* Task Left Rows */}
                                                                                        {isActExpanded &&
                                                                                            activity.tasks.map((task) => {
                                                                                                const taskTheme = getStatusTheme(task.status);
                                                                                                return (
                                                                                                    <div
                                                                                                        key={`left-task-${task.id}`}
                                                                                                        className="h-[38px] pl-16 pr-3 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between gap-1.5"
                                                                                                    >
                                                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                            <span
                                                                                                                className={`w-2 h-2 rounded-full ${taskTheme.dotColor} shrink-0`}
                                                                                                                title={`Status: ${task.status}`}
                                                                                                            />
                                                                                                            <span
                                                                                                                className="text-xs text-slate-600 truncate block"
                                                                                                                title={task.title}
                                                                                                            >
                                                                                                                {task.title}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <Link
                                                                                                            href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                            className="p-0.5 text-slate-400 hover:text-[color:var(--color-brand-action-orange)] rounded shrink-0"
                                                                                                            title="View in activity"
                                                                                                        >
                                                                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                                                                        </Link>
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                    </React.Fragment>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="h-[38px] pl-11 pr-3 flex items-center text-[10px] text-slate-400 italic">
                                                                                No activities
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="h-[38px] pl-6 pr-3 flex items-center text-[10px] text-slate-400 italic">
                                                            No committees
                                                        </div>
                                                    )
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ── RIGHT COLUMN: Broad Timeline Area (Main Visual Focus) ── */}
                        <div
                            className="flex-1 relative flex flex-col"
                            style={{
                                width: `${timelineTotalWidthPx}px`,
                                minWidth: `${timelineTotalWidthPx}px`,
                            }}
                        >
                            {/* Calendar Scale Header */}
                            <div className="h-[50px] bg-slate-50 border-b border-slate-200 flex relative select-none">
                                {timeColumns.map((col) => (
                                    <div
                                        key={col.id}
                                        className="border-r border-slate-200/80 px-1 py-1.5 flex flex-col items-center justify-center shrink-0"
                                        style={{ width: `${col.widthPx}px` }}
                                    >
                                        <span className="text-[11px] font-bold text-slate-700 truncate">
                                            {col.label}
                                        </span>
                                        {col.subLabel && (
                                            <span className="text-[9px] font-medium text-slate-400 truncate">
                                                {col.subLabel}
                                            </span>
                                        )}
                                    </div>
                                ))}

                                {/* Today Marker Tag & Vertical Guide Line in Header */}
                                {todayPct !== null && (
                                    <div
                                        className="absolute top-0 bottom-0 pointer-events-none z-20"
                                        style={{ left: `${todayPct}%` }}
                                    >
                                        <div className="absolute top-1 -translate-x-1/2 flex flex-col items-center">
                                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/90 px-1.5 py-0.2 rounded-full shadow-2xs">
                                                Today
                                            </span>
                                        </div>
                                        <div className="h-full border-r-2 border-indigo-400/80 border-dashed" />
                                    </div>
                                )}
                            </div>

                            {/* Timeline Rows with Background Grid Lines & Gantt Bars */}
                            <div className="divide-y divide-slate-100 flex-1 relative">
                                {filteredProjects.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-slate-400">
                                        No timeline items
                                    </div>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const isProjectExpanded = expandedIds.has(`project-${project.id}`);
                                        const projectBarStyle = calculateBarStyle(project.start_date_raw, project.end_date_raw);
                                        const hasCommittees = (project.committees || []).length > 0;

                                        return (
                                            <React.Fragment key={`right-proj-${project.id}`}>
                                                {/* ── PROJECT BAR ROW ── */}
                                                <div className="h-[44px] bg-[#18262c] relative flex items-center">
                                                    {/* Background grid lines */}
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {timeColumns.map((col) => (
                                                            <div
                                                                key={`grid-proj-${col.id}`}
                                                                className="border-r border-slate-700/30 h-full shrink-0"
                                                                style={{ width: `${col.widthPx}px` }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Today vertical line */}
                                                    {todayPct !== null && (
                                                        <div
                                                            className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-indigo-400/50 border-dashed"
                                                            style={{ left: `${todayPct}%` }}
                                                        />
                                                    )}

                                                    {/* Project Parent Bar */}
                                                    {projectBarStyle ? (
                                                        <div
                                                            className="absolute h-5 rounded-md bg-[#2d3f4d] border border-slate-600/70 shadow-xs flex items-center px-2 transition-all pointer-events-auto"
                                                            style={projectBarStyle}
                                                            title={`${project.title || project.name}: ${project.start_date || ''} → ${project.end_date || ''}`}
                                                        />
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400 italic pl-3 select-none">
                                                            No dates scheduled
                                                        </span>
                                                    )}
                                                </div>

                                                {/* ── COMMITTEES BAR ROWS ── */}
                                                {isProjectExpanded && (
                                                    hasCommittees ? (
                                                        project.committees.map((committee) => {
                                                            const isCommExpanded = expandedIds.has(`committee-${committee.id}`);
                                                            const commBarStyle = calculateBarStyle(committee.start_date_raw, committee.end_date_raw);
                                                            const hasActivities = (committee.activities || []).length > 0;

                                                            return (
                                                                <React.Fragment key={`right-comm-${committee.id}`}>
                                                                    <div className="h-[48px] bg-white hover:bg-slate-50/70 relative flex items-center">
                                                                        {/* Background grid lines */}
                                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                                            {timeColumns.map((col) => (
                                                                                <div
                                                                                    key={`grid-comm-${col.id}`}
                                                                                    className="border-r border-slate-100 h-full shrink-0"
                                                                                    style={{ width: `${col.widthPx}px` }}
                                                                                />
                                                                            ))}
                                                                        </div>

                                                                        {/* Today line */}
                                                                        {todayPct !== null && (
                                                                            <div
                                                                                className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-indigo-400/50 border-dashed"
                                                                                style={{ left: `${todayPct}%` }}
                                                                            />
                                                                        )}

                                                                        {/* Committee Bar (Supporting Grouping) */}
                                                                        {commBarStyle ? (
                                                                            <div
                                                                                className="absolute flex items-center pointer-events-auto"
                                                                                style={commBarStyle}
                                                                            >
                                                                                <div
                                                                                    className="h-4.5 w-full bg-slate-100 rounded-full overflow-hidden flex items-center shadow-2xs"
                                                                                    title={`${committee.name}: ${committee.progress}%`}
                                                                                >
                                                                                    <div
                                                                                        className="h-full rounded-full bg-[#7C88F7] transition-all duration-300"
                                                                                        style={{ width: `${committee.progress}%` }}
                                                                                    />
                                                                                </div>
                                                                                <span className="text-xs font-semibold text-slate-700 ml-2 shrink-0 select-none">
                                                                                    {committee.progress}%
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[11px] text-slate-300 italic pl-3 select-none">
                                                                                No dates scheduled
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* ── ACTIVITIES BAR ROWS ── */}
                                                                    {isCommExpanded && (
                                                                        hasActivities ? (
                                                                            committee.activities.map((activity) => {
                                                                                const isActExpanded = expandedIds.has(`activity-${activity.id}`);
                                                                                const actBarStyle = calculateBarStyle(activity.start_date_raw, activity.due_date_raw);
                                                                                const actTheme = getStatusTheme(activity.status);
                                                                                const hasTasks = (activity.tasks || []).length > 0;

                                                                                return (
                                                                                    <React.Fragment key={`right-act-${activity.id}`}>
                                                                                        <div className="h-[44px] bg-slate-50/40 hover:bg-slate-50 relative flex items-center">
                                                                                            {/* Grid lines */}
                                                                                            <div className="absolute inset-0 flex pointer-events-none">
                                                                                                {timeColumns.map((col) => (
                                                                                                    <div
                                                                                                        key={`grid-act-${col.id}`}
                                                                                                        className="border-r border-slate-100 h-full shrink-0"
                                                                                                        style={{ width: `${col.widthPx}px` }}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* Today line */}
                                                                                            {todayPct !== null && (
                                                                                                <div
                                                                                                    className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-indigo-400/50 border-dashed"
                                                                                                    style={{ left: `${todayPct}%` }}
                                                                                                />
                                                                                            )}

                                                                                            {/* Activity Bar (Main Work Period) */}
                                                                                            {actBarStyle ? (
                                                                                                <div
                                                                                                    className="absolute flex items-center pointer-events-auto"
                                                                                                    style={actBarStyle}
                                                                                                >
                                                                                                    <div
                                                                                                        className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex items-center shadow-2xs"
                                                                                                        title={`${activity.title}: ${activity.progress}% (${activity.status})`}
                                                                                                    >
                                                                                                        <div
                                                                                                            className={`h-full rounded-full ${actTheme.barFill} transition-all duration-300`}
                                                                                                            style={{ width: `${activity.progress}%` }}
                                                                                                        />
                                                                                                    </div>
                                                                                                    <span className="text-[11px] font-semibold text-slate-700 ml-2 shrink-0 select-none">
                                                                                                        {activity.progress}%
                                                                                                    </span>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-[10px] text-slate-300 italic pl-3 select-none">
                                                                                                    No dates scheduled
                                                                                                </span>
                                                                                            )}
                                                                                        </div>

                                                                                        {/* ── TASKS BAR ROWS ── */}
                                                                                        {isActExpanded &&
                                                                                            activity.tasks.map((task) => {
                                                                                                const taskBarStyle = calculateBarStyle(
                                                                                                    task.due_date_raw,
                                                                                                    task.due_date_raw,
                                                                                                    true
                                                                                                );
                                                                                                const taskTheme = getStatusTheme(task.status);

                                                                                                return (
                                                                                                    <div
                                                                                                        key={`right-task-${task.id}`}
                                                                                                        className="h-[38px] bg-slate-50/70 hover:bg-slate-100/70 relative flex items-center"
                                                                                                    >
                                                                                                        {/* Grid lines */}
                                                                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                                                                            {timeColumns.map((col) => (
                                                                                                                <div
                                                                                                                    key={`grid-task-${col.id}`}
                                                                                                                    className="border-r border-slate-100/80 h-full shrink-0"
                                                                                                                    style={{ width: `${col.widthPx}px` }}
                                                                                                                />
                                                                                                            ))}
                                                                                                        </div>

                                                                                                        {/* Today line */}
                                                                                                        {todayPct !== null && (
                                                                                                            <div
                                                                                                                className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-indigo-400/50 border-dashed"
                                                                                                                style={{ left: `${todayPct}%` }}
                                                                                                            />
                                                                                                        )}

                                                                                                        {/* Task Bar (Smaller Child Bar) */}
                                                                                                        {taskBarStyle ? (
                                                                                                            <div
                                                                                                                className="absolute flex items-center pointer-events-auto"
                                                                                                                style={taskBarStyle}
                                                                                                            >
                                                                                                                <div
                                                                                                                    className={`h-2.5 w-6 rounded-full ${taskTheme.barFill} shadow-2xs`}
                                                                                                                    title={`${task.title}: ${task.status}`}
                                                                                                                />
                                                                                                                <span className="text-[10px] font-medium text-slate-500 ml-1.5 shrink-0 select-none">
                                                                                                                    {task.status}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <span className="text-[10px] text-slate-300 italic pl-3 select-none">
                                                                                                                No dates scheduled
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                    </React.Fragment>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <div className="h-[38px] bg-slate-50/20 flex items-center pl-3 text-[10px] text-slate-400 italic">
                                                                                No activities scheduled
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="h-[38px] bg-white flex items-center pl-3 text-[10px] text-slate-400 italic">
                                                            No committees scheduled yet in this project
                                                        </div>
                                                    )
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
