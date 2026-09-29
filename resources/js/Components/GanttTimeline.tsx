import React, { useState, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    ChevronDown,
    Calendar,
    CheckCircle2,
    Clock,
    FolderOpen,
    Users,
    ListTodo,
    CheckSquare,
    ExternalLink,
    Maximize2,
    Minimize2,
    Shield,
    AlertCircle,
    User as UserIcon,
    Layers,
    Info,
} from 'lucide-react';
import {
    type ProjectTimelineData,
    type CommitteeTimelineItem,
    type ActivityTimelineItem,
    type TaskTimelineItem,
} from '@/types';
import { Badge } from '@/Components/Badge';
import { Button } from '@/Components/Button';
import { EmptyState } from '@/Components/EmptyState';

export interface GanttTimelineProps {
    timeline?: ProjectTimelineData | null;
    className?: string;
}

// ─── Status Colors & Badges ──────────────────────────────────────────────────

function getStatusBadge(status: string) {
    switch (status) {
        case 'Completed':
            return <Badge variant="success">Completed</Badge>;
        case 'In Progress':
            return <Badge variant="warning">In Progress</Badge>;
        case 'Under Review':
            return <Badge variant="primary">Under Review</Badge>;
        case 'Returned':
            return <Badge variant="danger">Returned</Badge>;
        case 'Active':
            return <Badge variant="success">Active</Badge>;
        case 'Planning':
            return <Badge variant="primary">Planning</Badge>;
        case 'Archived':
            return <Badge variant="neutral">Archived</Badge>;
        case 'To Do':
        default:
            return <Badge variant="neutral">To Do</Badge>;
    }
}

function getStatusBarColor(status: string, type: 'project' | 'committee' | 'activity' | 'task'): {
    barBg: string;
    fillBg: string;
    border: string;
} {
    if (status === 'Completed') {
        return {
            barBg: 'bg-emerald-100',
            fillBg: 'bg-emerald-600',
            border: 'border-emerald-300',
        };
    }
    if (status === 'Returned') {
        return {
            barBg: 'bg-rose-100',
            fillBg: 'bg-rose-600',
            border: 'border-rose-300',
        };
    }
    if (status === 'Under Review') {
        return {
            barBg: 'bg-amber-100',
            fillBg: 'bg-amber-500',
            border: 'border-amber-300',
        };
    }

    if (type === 'project') {
        return {
            barBg: 'bg-emerald-100',
            fillBg: 'bg-[color:var(--color-brand-dark-green)]',
            border: 'border-emerald-800',
        };
    }
    if (type === 'committee') {
        return {
            barBg: 'bg-orange-100',
            fillBg: 'bg-[color:var(--color-brand-action-orange)]',
            border: 'border-orange-300',
        };
    }
    if (type === 'activity') {
        return {
            barBg: 'bg-sky-100',
            fillBg: 'bg-sky-600',
            border: 'border-sky-300',
        };
    }

    // task
    return {
        barBg: 'bg-slate-200',
        fillBg: 'bg-slate-500',
        border: 'border-slate-300',
    };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const GanttTimeline: React.FC<GanttTimelineProps> = ({ timeline, className = '' }) => {
    if (!timeline) {
        return (
            <EmptyState
                icon={<Calendar className="w-8 h-8 text-slate-400" />}
                title="No Timeline Data Available"
                description="The schedule and timeline information could not be loaded for this project."
            />
        );
    }

    // 1. Expand / Collapse State
    // Initial state: Project and Committees expanded, activities collapsed to avoid visual overload
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
        const initial = new Set<string>();
        initial.add(`project-${timeline.id}`);
        (timeline.committees || []).forEach((c) => {
            initial.add(`committee-${c.id}`);
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
        all.add(`project-${timeline.id}`);
        (timeline.committees || []).forEach((c) => {
            all.add(`committee-${c.id}`);
            (c.activities || []).forEach((a) => {
                all.add(`activity-${a.id}`);
            });
        });
        setExpandedIds(all);
    };

    const handleCollapseAll = () => {
        // Keep only the project expanded
        setExpandedIds(new Set([`project-${timeline.id}`]));
    };

    // 2. Global Date Range Calculation
    const { startDate, endDate, totalDays, months } = useMemo(() => {
        const dateTimestamps: number[] = [];

        const parseDate = (d?: string | null) => {
            if (!d) return null;
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? null : parsed;
        };

        if (timeline.start_date_raw) {
            const d = parseDate(timeline.start_date_raw);
            if (d) dateTimestamps.push(d.getTime());
        }
        if (timeline.end_date_raw) {
            const d = parseDate(timeline.end_date_raw);
            if (d) dateTimestamps.push(d.getTime());
        }

        (timeline.committees || []).forEach((c) => {
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

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        let minDate: Date;
        let maxDate: Date;

        if (dateTimestamps.length > 0) {
            minDate = new Date(Math.min(...dateTimestamps));
            maxDate = new Date(Math.max(...dateTimestamps));
        } else {
            minDate = new Date(now.getFullYear(), now.getMonth(), 1);
            maxDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);
        }

        // Align minDate to the start of its month and maxDate to the end of its month for neat monthly divisions
        const gridStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const gridEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

        // Ensure at least 30 days span
        const diffMs = gridEnd.getTime() - gridStart.getTime();
        const days = Math.max(30, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

        // Build month columns
        const monthCols: { label: string; days: number; widthPct: number }[] = [];
        let curr = new Date(gridStart);

        while (curr <= gridEnd) {
            const monthDays = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
            const label = curr.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            const widthPct = (monthDays / days) * 100;
            monthCols.push({ label, days: monthDays, widthPct });
            curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
        }

        return {
            startDate: gridStart,
            endDate: gridEnd,
            totalDays: days,
            months: monthCols,
        };
    }, [timeline]);

    // Today indicator position
    const todayPct = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today < startDate || today > endDate) return null;
        const diffMs = today.getTime() - startDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return (diffDays / totalDays) * 100;
    }, [startDate, endDate, totalDays]);

    // Position calculator helper
    const calculateBarStyle = (startRaw?: string | null, endRaw?: string | null, isMilestone = false) => {
        if (!startRaw && !endRaw) return null;

        const parse = (str?: string | null) => (str ? new Date(str) : null);
        const s = parse(startRaw) || parse(endRaw);
        const e = parse(endRaw) || parse(startRaw);

        if (!s || !e) return null;

        const startMs = Math.max(startDate.getTime(), s.getTime());
        const endMs = Math.min(endDate.getTime(), e.getTime());

        const offsetDays = Math.max(0, (startMs - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const spanDays = isMilestone ? 1 : Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24) + 1);

        const leftPct = (offsetDays / totalDays) * 100;
        const widthPct = Math.max(1.2, (spanDays / totalDays) * 100);

        return {
            left: `${leftPct}%`,
            width: `${Math.min(100 - leftPct, widthPct)}%`,
        };
    };

    const hasCommittees = (timeline.committees || []).length > 0;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* ── Header Summary & Controls ── */}
            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--color-brand-dark-green)]" />
                            <h3 className="text-base font-bold text-slate-900">
                                {timeline.name}
                            </h3>
                            {getStatusBadge(timeline.status)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                Schedule: {timeline.start_date || 'Unscheduled'} – {timeline.end_date || 'No deadline'}
                                {timeline.duration_days ? ` (${timeline.duration_days} days)` : ''}
                            </span>
                            <span>•</span>
                            <span>{timeline.total_committees} Committees</span>
                            <span>•</span>
                            <span>{timeline.total_activities} Activities</span>
                            <span>•</span>
                            <span>{timeline.completed_tasks} / {timeline.total_tasks} Tasks Completed</span>
                        </p>
                    </div>

                    {/* Progress summary & Controls */}
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 min-w-[140px]">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-700">Project Progress</span>
                                <span className="font-bold text-[color:var(--color-brand-action-orange)]">
                                    {timeline.progress}%
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${timeline.progress}%`,
                                        backgroundColor: 'var(--color-brand-dark-green)',
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExpandAll}
                                title="Expand All Hierarchy Levels"
                                className="text-xs px-2.5 py-1.5"
                            >
                                <Maximize2 className="w-3.5 h-3.5 mr-1" />
                                Expand
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCollapseAll}
                                title="Collapse All"
                                className="text-xs px-2.5 py-1.5"
                            >
                                <Minimize2 className="w-3.5 h-3.5 mr-1" />
                                Collapse
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile scroll hint */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 lg:hidden">
                    <span className="flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        Swipe horizontally to view the full calendar timeline grid
                    </span>
                </div>
            </div>

            {/* ── Main Gantt Split Container ── */}
            {!hasCommittees ? (
                <EmptyState
                    icon={<Layers className="w-8 h-8 text-slate-400" />}
                    title="No Committees or Activities Scheduled"
                    description="This project does not have any committees or activities configured yet. Create a committee to begin populating the schedule."
                />
            ) : (
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-xs overflow-hidden">
                    {/* Horizontal scroll container with protected min-width for calendar grid */}
                    <div className="overflow-x-auto">
                        <div className="min-w-[960px] divide-y divide-slate-100">
                            {/* ── Timeline Header Grid ── */}
                            <div className="flex bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 sticky top-0 z-10">
                                {/* Left Item Column Header */}
                                <div className="w-[360px] sm:w-[420px] shrink-0 p-3.5 border-r border-slate-200 bg-slate-50 flex items-center justify-between">
                                    <span className="uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                                        Hierarchy & Items
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-normal">
                                        Progress · Status
                                    </span>
                                </div>

                                {/* Right Calendar Months Header */}
                                <div className="flex-1 relative flex">
                                    {months.map((m, idx) => (
                                        <div
                                            key={`${m.label}-${idx}`}
                                            className="border-r border-slate-200/80 p-3.5 text-center truncate text-[11px] font-bold text-slate-600 bg-slate-50/90"
                                            style={{ width: `${m.widthPct}%` }}
                                        >
                                            {m.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ── Rows ── */}
                            {/* 1. PROJECT ROW */}
                            <TimelineRow
                                key={`project-${timeline.id}`}
                                id={`project-${timeline.id}`}
                                title={timeline.name}
                                type="project"
                                status={timeline.status}
                                progress={timeline.progress}
                                startDateStr={timeline.start_date}
                                endDateStr={timeline.end_date}
                                durationDays={timeline.duration_days}
                                isExpanded={expandedIds.has(`project-${timeline.id}`)}
                                onToggle={() => toggleExpand(`project-${timeline.id}`)}
                                hasChildren={hasCommittees}
                                barStyle={calculateBarStyle(timeline.start_date_raw, timeline.end_date_raw)}
                                barColor={getStatusBarColor(timeline.status, 'project')}
                                level={0}
                                todayPct={todayPct}
                            />

                            {/* 2. COMMITTEES */}
                            {expandedIds.has(`project-${timeline.id}`) &&
                                (timeline.committees || []).map((committee) => {
                                    const commExpanded = expandedIds.has(`committee-${committee.id}`);
                                    const hasActivities = (committee.activities || []).length > 0;

                                    return (
                                        <React.Fragment key={`comm-group-${committee.id}`}>
                                            <TimelineRow
                                                id={`committee-${committee.id}`}
                                                title={committee.name}
                                                type="committee"
                                                status={committee.progress === 100 ? 'Completed' : 'In Progress'}
                                                progress={committee.progress}
                                                startDateStr={committee.start_date}
                                                endDateStr={committee.end_date}
                                                durationDays={committee.duration_days}
                                                isExpanded={commExpanded}
                                                onToggle={() => toggleExpand(`committee-${committee.id}`)}
                                                hasChildren={hasActivities}
                                                barStyle={calculateBarStyle(committee.start_date_raw, committee.end_date_raw)}
                                                barColor={getStatusBarColor(
                                                    committee.progress === 100 ? 'Completed' : 'In Progress',
                                                    'committee'
                                                )}
                                                level={1}
                                                todayPct={todayPct}
                                                actionUrl={`/projects/${timeline.id}/committees/${committee.id}`}
                                                actionLabel="View Committee"
                                            />

                                            {/* 3. ACTIVITIES */}
                                            {commExpanded &&
                                                (committee.activities || []).map((activity) => {
                                                    const actExpanded = expandedIds.has(`activity-${activity.id}`);
                                                    const hasTasks = (activity.tasks || []).length > 0;

                                                    return (
                                                        <React.Fragment key={`act-group-${activity.id}`}>
                                                            <TimelineRow
                                                                id={`activity-${activity.id}`}
                                                                title={activity.title}
                                                                type="activity"
                                                                status={activity.status}
                                                                progress={activity.progress}
                                                                startDateStr={activity.start_date}
                                                                endDateStr={activity.due_date}
                                                                durationDays={activity.duration_days}
                                                                isExpanded={actExpanded}
                                                                onToggle={() => toggleExpand(`activity-${activity.id}`)}
                                                                hasChildren={hasTasks}
                                                                barStyle={calculateBarStyle(activity.start_date_raw, activity.due_date_raw)}
                                                                barColor={getStatusBarColor(activity.status, 'activity')}
                                                                level={2}
                                                                todayPct={todayPct}
                                                                actionUrl={`/projects/${timeline.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                actionLabel="View Activity"
                                                            />

                                                            {/* 4. TASKS */}
                                                            {actExpanded &&
                                                                (activity.tasks || []).map((task) => (
                                                                    <TimelineRow
                                                                        key={`task-${task.id}`}
                                                                        id={`task-${task.id}`}
                                                                        title={task.title}
                                                                        type="task"
                                                                        status={task.status}
                                                                        progress={task.progress}
                                                                        startDateStr={null}
                                                                        endDateStr={task.due_date}
                                                                        durationDays={task.duration_days}
                                                                        isExpanded={false}
                                                                        onToggle={() => {}}
                                                                        hasChildren={false}
                                                                        barStyle={calculateBarStyle(task.due_date_raw, task.due_date_raw, true)}
                                                                        barColor={getStatusBarColor(task.status, 'task')}
                                                                        level={3}
                                                                        todayPct={todayPct}
                                                                        assignee={task.assigned_user}
                                                                        requiresReview={task.requires_review}
                                                                        actionUrl={`/projects/${timeline.id}/committees/${committee.id}/activities/${activity.id}`}
                                                                        actionLabel="View Task in Activity"
                                                                    />
                                                                ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                        </React.Fragment>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Individual Timeline Row Component ───────────────────────────────────────

interface TimelineRowProps {
    id: string;
    title: string;
    type: 'project' | 'committee' | 'activity' | 'task';
    status: string;
    progress: number;
    startDateStr?: string | null;
    endDateStr?: string | null;
    durationDays?: number | null;
    isExpanded: boolean;
    onToggle: () => void;
    hasChildren: boolean;
    barStyle: { left: string; width: string } | null;
    barColor: { barBg: string; fillBg: string; border: string };
    level: 0 | 1 | 2 | 3;
    todayPct: number | null;
    assignee?: { id: number; name: string; email: string } | null;
    requiresReview?: boolean;
    actionUrl?: string;
    actionLabel?: string;
}

const TimelineRow: React.FC<TimelineRowProps> = ({
    title,
    type,
    status,
    progress,
    startDateStr,
    endDateStr,
    durationDays,
    isExpanded,
    onToggle,
    hasChildren,
    barStyle,
    barColor,
    level,
    todayPct,
    assignee,
    requiresReview,
    actionUrl,
    actionLabel,
}) => {
    // Indentation based on hierarchy
    const indentPadding = level === 0 ? 'pl-3' : level === 1 ? 'pl-7' : level === 2 ? 'pl-11' : 'pl-15';

    // Type icons
    const TypeIcon =
        type === 'project'
            ? FolderOpen
            : type === 'committee'
            ? Users
            : type === 'activity'
            ? ListTodo
            : CheckSquare;

    const iconColor =
        type === 'project'
            ? 'text-[color:var(--color-brand-dark-green)]'
            : type === 'committee'
            ? 'text-[color:var(--color-brand-action-orange)]'
            : type === 'activity'
            ? 'text-sky-600'
            : 'text-slate-500';

    const rowBg =
        level === 0
            ? 'bg-slate-50/70 font-semibold'
            : level === 1
            ? 'bg-white hover:bg-orange-50/30 font-medium'
            : level === 2
            ? 'bg-white hover:bg-slate-50/60'
            : 'bg-slate-50/30 hover:bg-slate-100/50 text-slate-600';

    return (
        <div className={`flex items-center min-h-[44px] transition-colors ${rowBg} group`}>
            {/* ── Left Column: Hierarchy & Details ── */}
            <div className={`w-[360px] sm:w-[420px] shrink-0 pr-3 py-2 border-r border-slate-200 flex items-center justify-between gap-2 ${indentPadding}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Expand/Collapse Toggle Button */}
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={onToggle}
                            className="w-5 h-5 rounded hover:bg-slate-200/70 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                            )}
                        </button>
                    ) : (
                        <span className="w-5 shrink-0" />
                    )}

                    {/* Icon */}
                    <TypeIcon className={`w-4 h-4 shrink-0 ${iconColor}`} />

                    {/* Title & Metadata */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                            <span
                                className={`truncate text-xs ${
                                    level === 0
                                        ? 'font-bold text-slate-900 text-sm'
                                        : level === 1
                                        ? 'font-bold text-slate-800'
                                        : level === 2
                                        ? 'font-semibold text-slate-700'
                                        : 'text-slate-600'
                                }`}
                                title={title}
                            >
                                {title}
                            </span>
                            {requiresReview && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-50 text-blue-700 border border-blue-200 rounded shrink-0 uppercase tracking-wider">
                                    Review
                                </span>
                            )}
                        </div>

                        {/* Sub details: Assignee or Date range info */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 truncate">
                            {assignee ? (
                                <span className="flex items-center gap-1 text-slate-600 font-medium truncate">
                                    <UserIcon className="w-2.5 h-2.5" />
                                    {assignee.name}
                                </span>
                            ) : startDateStr || endDateStr ? (
                                <span>
                                    {startDateStr ? `${startDateStr} – ` : ''}
                                    {endDateStr || 'No due date'}
                                    {durationDays ? ` (${durationDays}d)` : ''}
                                </span>
                            ) : (
                                <span>No dates scheduled</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Badge & Action Link */}
                <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(status)}
                    {actionUrl && (
                        <Link
                            href={actionUrl}
                            className="p-1 text-slate-400 hover:text-[color:var(--color-brand-action-orange)] rounded transition-colors"
                            title={actionLabel || 'View Details'}
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>

            {/* ── Right Column: Timeline Grid Bar ── */}
            <div className="flex-1 relative h-full min-h-[44px] flex items-center px-2">
                {/* Vertical Today Line Indicator */}
                {todayPct !== null && (
                    <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500/70 z-10 pointer-events-none"
                        style={{ left: `${todayPct}%` }}
                        title="Today"
                    >
                        <span className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                    </div>
                )}

                {/* The Bar */}
                {barStyle ? (
                    <div
                        className={`absolute h-6 rounded-md border ${barColor.border} ${barColor.barBg} shadow-2xs overflow-hidden flex items-center transition-all group-hover:shadow-xs`}
                        style={barStyle}
                        title={`${title}: ${startDateStr ? `${startDateStr} to ` : ''}${endDateStr || 'TBD'} (${progress}% completed)`}
                    >
                        {/* Progress Fill Bar */}
                        <div
                            className={`h-full ${barColor.fillBg} transition-all duration-300 opacity-90`}
                            style={{ width: `${progress}%` }}
                        />

                        {/* Bar Label (shown if wide enough) */}
                        <div className="absolute inset-0 px-2 flex items-center justify-between text-[10px] font-semibold text-slate-800 drop-shadow-xs pointer-events-none truncate">
                            <span className="truncate pr-1">{progress > 0 ? `${progress}%` : ''}</span>
                            {type === 'task' && (
                                <span className="text-[9px] text-slate-600 truncate font-normal">
                                    {endDateStr}
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-[10px] text-slate-300 italic pl-3">
                        No scheduled date range
                    </div>
                )}
            </div>
        </div>
    );
};
