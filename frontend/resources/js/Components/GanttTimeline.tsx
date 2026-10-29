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
import { Button } from '@/Components/Button';
import { Card } from '@/Components/Card';

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
        dotColor: 'bg-[color:var(--status-success)]',
        barFill: 'bg-[color:var(--status-success)]',
        textColor: 'text-[color:var(--status-success-text)]',
    },
    'Under Review': {
        label: 'Under Review',
        dotColor: 'bg-[color:var(--secondary)]',
        barFill: 'bg-[color:var(--secondary)]',
        textColor: 'text-[color:var(--secondary)]',
    },
    'In Progress': {
        label: 'In Progress',
        dotColor: 'bg-[color:var(--primary)]',
        barFill: 'bg-[color:var(--primary)]',
        textColor: 'text-[color:var(--primary)]',
    },
    Returned: {
        label: 'Returned',
        dotColor: 'bg-[color:var(--status-danger)]',
        barFill: 'bg-[color:var(--status-danger)]',
        textColor: 'text-[color:var(--status-danger-text)]',
    },
    'To Do': {
        label: 'To Do',
        dotColor: 'bg-[color:var(--muted)]',
        barFill: 'bg-[color:var(--muted)]',
        textColor: 'text-[color:var(--muted)]',
    },
    Submitted: {
        label: 'Submitted',
        dotColor: 'bg-purple-500',
        barFill: 'bg-purple-500',
        textColor: 'text-purple-600 dark:text-purple-400',
    },
};

function getStatusTheme(status: string): StatusTheme {
    if (STATUS_THEMES[status]) return STATUS_THEMES[status];
    if (status === 'Active') return STATUS_THEMES['Completed'];
    if (status === 'Planning') return STATUS_THEMES['To Do'];
    return {
        label: status || 'To Do',
        dotColor: 'bg-[color:var(--muted)]',
        barFill: 'bg-[color:var(--muted)]',
        textColor: 'text-[color:var(--muted)]',
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

    // 4. Filtered dataset based on dropdowns
    const filteredProjects = useMemo(() => {
        return allProjects
            .filter((p) => {
                if (selectedProjectId !== 'all' && String(p.id) !== selectedProjectId) {
                    return false;
                }
                return true;
            })
            .map((p) => {
                // Filter committees & activities by status if requested
                if (selectedStatus === 'all') return p;

                const filteredCommittees = (p.committees || []).map((c) => {
                    const filteredActivities = (c.activities || []).filter(
                        (a) => a.status === selectedStatus
                    );
                    return { ...c, activities: filteredActivities };
                });

                return { ...p, committees: filteredCommittees };
            });
    }, [allProjects, selectedProjectId, selectedStatus]);

    // 5. Timeline Date Range & Column Calculations adapting to Day / Week / Month
    const { gridStart, gridEnd, totalMs, timeColumns, timelineTotalWidthPx } = useMemo(() => {
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        const considerDate = (dateStr?: string | null) => {
            if (!dateStr) return;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return;
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        };

        allProjects.forEach((proj) => {
            considerDate(proj.start_date_raw);
            considerDate(proj.end_date_raw);
            (proj.committees || []).forEach((c) => {
                considerDate(c.start_date_raw);
                considerDate(c.end_date_raw);
                (c.activities || []).forEach((a) => {
                    considerDate(a.start_date_raw);
                    considerDate(a.due_date_raw);
                    (a.tasks || []).forEach((t) => {
                        considerDate(t.due_date_raw);
                    });
                });
            });
        });

        const today = new Date();
        if (!minDate) {
            minDate = new Date(today);
            minDate.setDate(today.getDate() - 14);
        }
        if (!maxDate) {
            maxDate = new Date(today);
            maxDate.setDate(today.getDate() + 45);
        }

        // Add padding buffers before and after
        const start = new Date(minDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(maxDate);
        end.setHours(23, 59, 59, 999);

        // Adjust boundaries according to scale
        if (scale === 'day') {
            start.setDate(start.getDate() - 3);
            end.setDate(end.getDate() + 7);
        } else if (scale === 'week') {
            // align start to Sunday or Monday
            const day = start.getDay();
            start.setDate(start.getDate() - day - 7);
            const endDay = end.getDay();
            end.setDate(end.getDate() + (6 - endDay) + 14);
        } else {
            // month scale: full month coverage
            start.setDate(1);
            start.setMonth(start.getMonth() - 1);
            end.setMonth(end.getMonth() + 2);
            end.setDate(0);
        }

        const cols: TimelineColumn[] = [];
        const current = new Date(start);

        if (scale === 'day') {
            const colWidth = 48;
            while (current <= end) {
                const dayLetter = current.toLocaleDateString('en-US', { weekday: 'narrow' });
                const dayNum = current.getDate();
                const monthStr = current.toLocaleDateString('en-US', { month: 'short' });

                cols.push({
                    id: `day-${current.toISOString().slice(0, 10)}`,
                    label: `${dayNum}`,
                    subLabel: `${dayLetter} ${monthStr}`,
                    date: new Date(current),
                    widthPx: colWidth,
                });
                current.setDate(current.getDate() + 1);
            }
        } else if (scale === 'week') {
            const colWidth = 90;
            while (current <= end) {
                const weekNum = getWeekNumber(current);
                const monthStr = current.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = current.getDate();

                cols.push({
                    id: `week-${current.toISOString().slice(0, 10)}`,
                    label: `W${weekNum}`,
                    subLabel: `${monthStr} ${dayNum}`,
                    date: new Date(current),
                    widthPx: colWidth,
                });
                current.setDate(current.getDate() + 7);
            }
        } else {
            // month scale
            const colWidth = 130;
            while (current <= end) {
                const monthLabel = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

                cols.push({
                    id: `month-${current.getFullYear()}-${current.getMonth()}`,
                    label: monthLabel,
                    subLabel: `${current.getFullYear()}`,
                    date: new Date(current),
                    widthPx: colWidth,
                });
                current.setMonth(current.getMonth() + 1);
            }
        }

        const totalWidth = cols.reduce((acc, col) => acc + col.widthPx, 0);
        const totalDuration = Math.max(1, end.getTime() - start.getTime());

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
            <Card className="p-12 text-center border-dashed">
                <Layers className="w-10 h-10 text-[color:var(--muted)] mx-auto mb-3" />
                <h3 className="text-[16px] font-bold text-[color:var(--text)]">No Timeline Data Scheduled</h3>
                <p className="text-[14px] text-[color:var(--muted)] mt-1 max-w-sm mx-auto leading-relaxed">
                    There are no scheduled projects, committees, or activities configured yet.
                </p>
                {isGlobal && (
                    <div className="mt-4">
                        <Link href="/projects">
                            <Button variant="secondary" size="sm">
                                Go to Projects
                            </Button>
                        </Link>
                    </div>
                )}
            </Card>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* ── Controls Row (Filters, Scale Selector, & Expand/Collapse) ── */}
            <Card className="p-3.5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left Dropdown Filters & Day/Week/Month Scale Selector */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Project Selector (only in global or multi-project mode) */}
                        {(isGlobal || allProjects.length > 1) && (
                            <div className="relative">
                                <select
                                    id="gantt-project-filter"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="appearance-none bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-medium hover:border-[color:var(--primary)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                >
                                    <option value="all">All Projects</option>
                                    {allProjects.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.title || p.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-[color:var(--muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        )}

                        {/* Status Filter */}
                        <div className="relative">
                            <select
                                id="gantt-status-filter"
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="appearance-none bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] pl-3 pr-8 py-1.5 text-[13px] font-medium hover:border-[color:var(--primary)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                            >
                                <option value="all">All Status</option>
                                <option value="Completed">Completed</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Under Review">Under Review</option>
                                <option value="Returned">Returned</option>
                                <option value="To Do">To Do</option>
                                <option value="Submitted">Submitted</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-[color:var(--muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Scale Selector: Day | Week | Month */}
                        <div className="inline-flex items-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] p-0.5">
                            <button
                                type="button"
                                onClick={() => setScale('day')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer ${
                                    scale === 'day'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                            >
                                Day
                            </button>
                            <button
                                type="button"
                                onClick={() => setScale('week')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer ${
                                    scale === 'week'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                onClick={() => setScale('month')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer ${
                                    scale === 'month'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                            >
                                Month
                            </button>
                        </div>
                    </div>

                    {/* Right Expand / Collapse Buttons */}
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleExpandAll}
                        >
                            Expand all
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCollapseAll}
                        >
                            Collapse all
                        </Button>
                    </div>
                </div>

                {/* ── Status Legend Row ── */}
                <div className="flex items-center gap-4 flex-wrap text-[12px] text-[color:var(--muted)] pt-2 border-t border-[color:var(--border)]">
                    {Object.entries(STATUS_THEMES).map(([statusKey, theme]) => (
                        <div key={statusKey} className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${theme.dotColor} shrink-0`} />
                            <span className="text-[12px] font-medium text-[color:var(--muted)]">{theme.label}</span>
                        </div>
                    ))}
                </div>
            </Card>

            {/* ── Main Gantt Chart Container (Flat, Theme-Harmonious Card) ── */}
            <div className="itask-card overflow-hidden">
                <div className="overflow-x-auto relative [scrollbar-width:thin] pb-0.5">
                    <div className="flex min-w-full divide-x divide-[color:var(--border)]">
                        {/* ── LEFT COLUMN: Projects & Hierarchy ── */}
                        <div className="w-[270px] sm:w-[310px] shrink-0 sticky left-0 z-30 bg-[color:var(--card)] border-r border-[color:var(--border)] flex flex-col">
                            {/* Column Header */}
                            <div className="h-[48px] px-3.5 bg-[color:var(--soft-surface)] border-b border-[color:var(--border)] flex items-center justify-between text-[11px] font-bold text-[color:var(--muted)] uppercase tracking-wider">
                                <span>Projects & Workflows</span>
                            </div>

                            {/* Left Rows */}
                            <div className="divide-y divide-[color:var(--border)] flex-1">
                                {filteredProjects.length === 0 ? (
                                    <div className="p-6 text-center text-[13px] text-[color:var(--muted)]">
                                        No items match
                                    </div>
                                ) : (
                                    filteredProjects.map((project) => {
                                        const isProjectExpanded = expandedIds.has(`project-${project.id}`);
                                        const hasCommittees = (project.committees || []).length > 0;

                                        return (
                                            <React.Fragment key={`left-proj-${project.id}`}>
                                                {/* Project Left Row */}
                                                <div className="h-[46px] px-3 bg-[color:var(--soft-surface)] text-[color:var(--text)] flex items-center justify-between gap-1.5 border-l-4 border-l-[color:var(--primary)]">
                                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                        {hasCommittees ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleExpand(`project-${project.id}`)}
                                                                className="w-5 h-5 rounded-[4px] hover:bg-[color:var(--border)] flex items-center justify-center text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors shrink-0 cursor-pointer"
                                                                aria-label={isProjectExpanded ? 'Collapse' : 'Expand'}
                                                            >
                                                                {isProjectExpanded ? (
                                                                    <ChevronDown className="w-3.5 h-3.5 stroke-[2]" />
                                                                ) : (
                                                                    <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span className="w-5 shrink-0" />
                                                        )}
                                                        <Link
                                                            href={`/projects/${project.id}`}
                                                            className="font-bold text-[13px] text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate"
                                                            title={project.title || project.name}
                                                        >
                                                            {project.title || project.name}
                                                        </Link>
                                                    </div>
                                                    <Link
                                                        href={`/projects/${project.id}`}
                                                        className="p-1 text-[color:var(--muted)] hover:text-[color:var(--primary)] rounded-[4px] shrink-0 transition-colors"
                                                        title="Go to project"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
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
                                                                    <div className="h-[44px] pl-6 pr-3 bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] flex items-center justify-between gap-1.5 transition-colors">
                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                            {hasActivities ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleExpand(`committee-${committee.id}`)}
                                                                                    className="w-4.5 h-4.5 rounded-[4px] hover:bg-[color:var(--border)] flex items-center justify-center text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors shrink-0 cursor-pointer"
                                                                                    aria-label={isCommExpanded ? 'Collapse' : 'Expand'}
                                                                                >
                                                                                    {isCommExpanded ? (
                                                                                        <ChevronDown className="w-3.5 h-3.5 stroke-[2]" />
                                                                                    ) : (
                                                                                        <ChevronRight className="w-3.5 h-3.5 stroke-[2]" />
                                                                                    )}
                                                                                </button>
                                                                            ) : (
                                                                                <span className="w-4.5 shrink-0" />
                                                                            )}
                                                                            <div className="min-w-0 flex-1">
                                                                                <Link
                                                                                    href={`/projects/${project.id}/committees/${committee.id}`}
                                                                                    className="text-[13px] font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate block"
                                                                                    title={committee.name}
                                                                                >
                                                                                    {committee.name}
                                                                                </Link>
                                                                                <div className="text-[11px] text-[color:var(--muted)] truncate">
                                                                                    {committee.activities?.length || 0} {committee.activities?.length === 1 ? 'activity' : 'activities'}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <Link
                                                                            href={`/projects/${project.id}/committees/${committee.id}`}
                                                                            className="p-1 text-[color:var(--muted)] hover:text-[color:var(--primary)] rounded-[4px] shrink-0 transition-colors"
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
                                                                                        <div className="h-[42px] pl-11 pr-3 bg-[color:var(--card-surface)] hover:bg-[color:var(--soft-surface)] flex items-center justify-between gap-1.5 transition-colors">
                                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                {hasTasks ? (
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        onClick={() => toggleExpand(`activity-${activity.id}`)}
                                                                                                        className="w-4 h-4 rounded-[4px] hover:bg-[color:var(--border)] flex items-center justify-center text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors shrink-0 cursor-pointer"
                                                                                                        aria-label={isActExpanded ? 'Collapse' : 'Expand'}
                                                                                                    >
                                                                                                        {isActExpanded ? (
                                                                                                            <ChevronDown className="w-3 h-3 stroke-[2]" />
                                                                                                        ) : (
                                                                                                            <ChevronRight className="w-3 h-3 stroke-[2]" />
                                                                                                        )}
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <span className="w-4 shrink-0" />
                                                                                                )}
                                                                                                <div className="min-w-0 flex-1">
                                                                                                    <Link
                                                                                                        href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                        className="text-[12px] font-medium text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate block"
                                                                                                        title={activity.title || activity.name}
                                                                                                    >
                                                                                                        {activity.title || activity.name}
                                                                                                    </Link>
                                                                                                    <div className="text-[10px] text-[color:var(--muted)] truncate">
                                                                                                        {activity.tasks?.length || 0} {activity.tasks?.length === 1 ? 'task' : 'tasks'}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                            <Link
                                                                                                href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                className="p-1 text-[color:var(--muted)] hover:text-[color:var(--primary)] rounded-[4px] shrink-0 transition-colors"
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
                                                                                                        className="h-[38px] pl-16 pr-3 bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] flex items-center justify-between gap-1.5 transition-colors"
                                                                                                    >
                                                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                            <span
                                                                                                                className={`w-2 h-2 rounded-full ${taskTheme.dotColor} shrink-0`}
                                                                                                                title={`Status: ${task.status}`}
                                                                                                            />
                                                                                                            <span
                                                                                                                className="text-[12px] text-[color:var(--text)] truncate block"
                                                                                                                title={task.title}
                                                                                                            >
                                                                                                                {task.title}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                        <Link
                                                                                                            href={`/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                                                            className="p-0.5 text-[color:var(--muted)] hover:text-[color:var(--primary)] rounded-[4px] shrink-0"
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
                                                                            <div className="h-[38px] pl-11 pr-3 flex items-center text-[11px] text-[color:var(--muted)] italic">
                                                                                No activities
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="h-[38px] pl-6 pr-3 flex items-center text-[11px] text-[color:var(--muted)] italic">
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
                            <div className="h-[48px] bg-[color:var(--soft-surface)] border-b border-[color:var(--border)] flex relative select-none">
                                {timeColumns.map((col) => (
                                    <div
                                        key={col.id}
                                        className="border-r border-[color:var(--border)] px-1 py-1 flex flex-col items-center justify-center shrink-0"
                                        style={{ width: `${col.widthPx}px` }}
                                    >
                                        <span className="text-[11px] font-bold text-[color:var(--text)] truncate tabular-nums">
                                            {col.label}
                                        </span>
                                        {col.subLabel && (
                                            <span className="text-[9px] font-medium text-[color:var(--muted)] truncate tabular-nums">
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
                                            <span className="text-[10px] font-bold text-white bg-[color:var(--primary)] border border-[color:var(--primary)] px-1.5 py-0.2 rounded-full">
                                                Today
                                            </span>
                                        </div>
                                        <div className="h-full border-r-2 border-[color:var(--primary)] border-dashed" />
                                    </div>
                                )}
                            </div>

                            {/* Timeline Rows with Background Grid Lines & Gantt Bars */}
                            <div className="divide-y divide-[color:var(--border)] flex-1 relative">
                                {filteredProjects.length === 0 ? (
                                    <div className="p-6 text-center text-[13px] text-[color:var(--muted)]">
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
                                                <div className="h-[46px] bg-[color:var(--soft-surface)] relative flex items-center">
                                                    {/* Background grid lines */}
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {timeColumns.map((col) => (
                                                            <div
                                                                key={`grid-proj-${col.id}`}
                                                                className="border-r border-[color:var(--border)]/50 h-full shrink-0"
                                                                style={{ width: `${col.widthPx}px` }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Today vertical line */}
                                                    {todayPct !== null && (
                                                        <div
                                                            className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-[color:var(--primary)]/60 border-dashed"
                                                            style={{ left: `${todayPct}%` }}
                                                        />
                                                    )}

                                                    {/* Project Parent Bar */}
                                                    {projectBarStyle ? (
                                                        <div
                                                            className="absolute h-5.5 rounded-[6px] bg-[color:var(--primary)] text-white border border-[color:var(--primary)] flex items-center px-2 transition-all pointer-events-auto shadow-none"
                                                            style={projectBarStyle}
                                                            title={`${project.title || project.name}: ${project.start_date || ''} → ${project.end_date || ''}`}
                                                        >
                                                            <span className="text-[11px] font-bold truncate text-white">
                                                                {project.title || project.name}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-[color:var(--muted)] italic pl-3 select-none">
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
                                                                    <div className="h-[44px] bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] relative flex items-center transition-colors">
                                                                        {/* Background grid lines */}
                                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                                            {timeColumns.map((col) => (
                                                                                <div
                                                                                    key={`grid-comm-${col.id}`}
                                                                                    className="border-r border-[color:var(--border)]/40 h-full shrink-0"
                                                                                    style={{ width: `${col.widthPx}px` }}
                                                                                />
                                                                            ))}
                                                                        </div>

                                                                        {/* Today line */}
                                                                        {todayPct !== null && (
                                                                            <div
                                                                                className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-[color:var(--primary)]/50 border-dashed"
                                                                                style={{ left: `${todayPct}%` }}
                                                                            />
                                                                        )}

                                                                        {/* Committee Bar */}
                                                                        {commBarStyle ? (
                                                                            <div
                                                                                className="absolute flex items-center pointer-events-auto"
                                                                                style={commBarStyle}
                                                                            >
                                                                                <div
                                                                                    className="h-4 w-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-full overflow-hidden flex items-center"
                                                                                    title={`${committee.name}: ${committee.progress}%`}
                                                                                >
                                                                                    <div
                                                                                        className="h-full rounded-full bg-[color:var(--primary)] transition-all duration-300"
                                                                                        style={{ width: `${committee.progress}%` }}
                                                                                    />
                                                                                </div>
                                                                                <span className="text-[11px] font-semibold text-[color:var(--text)] ml-2 shrink-0 select-none tabular-nums">
                                                                                    {committee.progress}%
                                                                                </span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[11px] text-[color:var(--muted)] italic pl-3 select-none">
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
                                                                                        <div className="h-[42px] bg-[color:var(--card-surface)] hover:bg-[color:var(--soft-surface)] relative flex items-center transition-colors">
                                                                                            {/* Grid lines */}
                                                                                            <div className="absolute inset-0 flex pointer-events-none">
                                                                                                {timeColumns.map((col) => (
                                                                                                    <div
                                                                                                        key={`grid-act-${col.id}`}
                                                                                                        className="border-r border-[color:var(--border)]/40 h-full shrink-0"
                                                                                                        style={{ width: `${col.widthPx}px` }}
                                                                                                    />
                                                                                                ))}
                                                                                            </div>

                                                                                            {/* Today line */}
                                                                                            {todayPct !== null && (
                                                                                                <div
                                                                                                    className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-[color:var(--primary)]/50 border-dashed"
                                                                                                    style={{ left: `${todayPct}%` }}
                                                                                                />
                                                                                            )}

                                                                                            {/* Activity Bar */}
                                                                                            {actBarStyle ? (
                                                                                                <div
                                                                                                    className="absolute flex items-center pointer-events-auto"
                                                                                                    style={actBarStyle}
                                                                                                >
                                                                                                    <div
                                                                                                        className="h-3.5 w-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-full overflow-hidden flex items-center"
                                                                                                        title={`${activity.title}: ${activity.progress}% (${activity.status})`}
                                                                                                    >
                                                                                                        <div
                                                                                                            className={`h-full rounded-full ${actTheme.barFill} transition-all duration-300`}
                                                                                                            style={{ width: `${activity.progress}%` }}
                                                                                                        />
                                                                                                    </div>
                                                                                                    <span className="text-[11px] font-semibold text-[color:var(--muted)] ml-2 shrink-0 select-none tabular-nums">
                                                                                                        {activity.progress}%
                                                                                                    </span>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="text-[10px] text-[color:var(--muted)] italic pl-3 select-none">
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
                                                                                                        className="h-[38px] bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] relative flex items-center transition-colors"
                                                                                                    >
                                                                                                        {/* Grid lines */}
                                                                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                                                                            {timeColumns.map((col) => (
                                                                                                                <div
                                                                                                                    key={`grid-task-${col.id}`}
                                                                                                                    className="border-r border-[color:var(--border)]/40 h-full shrink-0"
                                                                                                                    style={{ width: `${col.widthPx}px` }}
                                                                                                                />
                                                                                                            ))}
                                                                                                        </div>

                                                                                                        {/* Today line */}
                                                                                                        {todayPct !== null && (
                                                                                                            <div
                                                                                                                className="absolute top-0 bottom-0 pointer-events-none z-10 border-r-2 border-[color:var(--primary)]/50 border-dashed"
                                                                                                                style={{ left: `${todayPct}%` }}
                                                                                                            />
                                                                                                        )}

                                                                                                        {/* Task Bar */}
                                                                                                        {taskBarStyle ? (
                                                                                                            <div
                                                                                                                className="absolute flex items-center pointer-events-auto"
                                                                                                                style={taskBarStyle}
                                                                                                            >
                                                                                                                <div
                                                                                                                    className={`h-2.5 w-5 rounded-full ${taskTheme.barFill}`}
                                                                                                                    title={`${task.title}: ${task.status}`}
                                                                                                                />
                                                                                                                <span className="text-[10px] font-medium text-[color:var(--muted)] ml-1.5 shrink-0 select-none">
                                                                                                                    {task.status}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <span className="text-[10px] text-[color:var(--muted)] italic pl-3 select-none">
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
                                                                            <div className="h-[38px] flex items-center pl-3 text-[11px] text-[color:var(--muted)] italic">
                                                                                No activities scheduled
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="h-[38px] flex items-center pl-3 text-[11px] text-[color:var(--muted)] italic">
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
