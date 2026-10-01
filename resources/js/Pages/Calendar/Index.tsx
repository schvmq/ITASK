import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    FolderOpen,
    Users,
    Layers,
    CheckSquare,
    ExternalLink,
    Clock,
    Flag,
    X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventColorGroup = 'project' | 'project_deadline' | 'activity' | 'activity_due' | 'task';
type EventType = 'project_start' | 'project_deadline' | 'activity_start' | 'activity_due' | 'task_due';

interface CalendarEvent {
    id: string;
    type: EventType;
    title: string;
    label: string;
    date: string; // YYYY-MM-DD
    date_formatted: string;
    status: string;
    role?: string;
    project?: { id: string; title: string };
    committee?: { id: string; name: string };
    activity?: { id: string; title: string };
    assignee?: { id: number; name: string } | null;
    is_mine?: boolean;
    url: string;
    color_group: EventColorGroup;
}

interface CalendarIndexProps {
    events: CalendarEvent[];
}

// ─── Visual Constants & Helpers ───────────────────────────────────────────────

const COLOR_GROUPS: Record<
    EventColorGroup,
    { dot: string; bg: string; text: string; border: string; badge: string; label: string }
> = {
    task: {
        dot: 'bg-[color:var(--color-brand-action-orange)]',
        bg: 'bg-orange-50/80',
        text: 'text-orange-900',
        border: 'border-orange-200',
        badge: 'bg-orange-100/80 text-orange-800 border-orange-200',
        label: 'Task Due',
    },
    activity_due: {
        dot: 'bg-amber-500',
        bg: 'bg-amber-50/80',
        text: 'text-amber-900',
        border: 'border-amber-200',
        badge: 'bg-amber-100/80 text-amber-800 border-amber-200',
        label: 'Activity Due',
    },
    project_deadline: {
        dot: 'bg-rose-500',
        bg: 'bg-rose-50/80',
        text: 'text-rose-900',
        border: 'border-rose-200',
        badge: 'bg-rose-100/80 text-rose-800 border-rose-200',
        label: 'Project Deadline',
    },
    activity: {
        dot: 'bg-sky-500',
        bg: 'bg-sky-50/80',
        text: 'text-sky-900',
        border: 'border-sky-200',
        badge: 'bg-sky-100/80 text-sky-800 border-sky-200',
        label: 'Activity Start',
    },
    project: {
        dot: 'bg-[color:var(--color-brand-dark-green)]',
        bg: 'bg-emerald-50/80',
        text: 'text-emerald-900',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-200',
        label: 'Project Start',
    },
};

const WEEKDAYS = [
    { short: 'Sun', letter: 'S' },
    { short: 'Mon', letter: 'M' },
    { short: 'Tue', letter: 'T' },
    { short: 'Wed', letter: 'W' },
    { short: 'Thu', letter: 'T' },
    { short: 'Fri', letter: 'F' },
    { short: 'Sat', letter: 'S' },
];

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getEventIcon(type: EventType) {
    switch (type) {
        case 'project_deadline': return <Flag className="w-3.5 h-3.5 shrink-0" />;
        case 'activity_due':     return <Clock className="w-3.5 h-3.5 shrink-0" />;
        case 'task_due':         return <CheckSquare className="w-3.5 h-3.5 shrink-0" />;
        default:                 return <Clock className="w-3.5 h-3.5 shrink-0" />;
    }
}

function parseYMD(dateStr: string): { year: number; month: number; day: number } {
    const parts = dateStr.split('-').map(Number);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

function formatFullDate(dateStr: string): string {
    const { year, month, day } = parseYMD(dateStr);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

interface UrgencyInfo {
    level: 'overdue' | 'today' | 'approaching' | 'upcoming' | 'completed';
    label: string;
    dotClass: string;
    textClass: string;
    badgeClass: string;
}

function getUrgencyInfo(dateStr: string, status?: string): UrgencyInfo {
    const normalizedStatus = (status || '').toLowerCase();
    if (normalizedStatus === 'completed' || normalizedStatus === 'archived') {
        return {
            level: 'completed',
            label: 'Completed',
            dotClass: 'bg-emerald-500',
            textClass: 'text-emerald-700',
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { year, month, day } = parseYMD(dateStr);
    const targetDate = new Date(year, month, day, 0, 0, 0);

    const diffMs = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const daysAgo = Math.abs(diffDays);
        return {
            level: 'overdue',
            label: `Overdue (${daysAgo}d)`,
            dotClass: 'bg-rose-500',
            textClass: 'text-rose-600',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        };
    }

    if (diffDays === 0) {
        return {
            level: 'today',
            label: 'Due Today',
            dotClass: 'bg-amber-500 ring-2 ring-amber-200 ring-offset-1',
            textClass: 'text-amber-600',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }

    if (diffDays <= 3) {
        return {
            level: 'approaching',
            label: `In ${diffDays} day${diffDays === 1 ? '' : 's'}`,
            dotClass: 'bg-amber-500',
            textClass: 'text-amber-600',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }

    return {
        level: 'upcoming',
        label: `In ${diffDays} days`,
        dotClass: 'bg-emerald-500',
        textClass: 'text-slate-600',
        badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
    };
}

// ─── Cell Event Item (Desktop & Tablet) ───────────────────────────────────────

interface CellEventItemProps {
    event: CalendarEvent;
}

function CellEventItem({ event }: CellEventItemProps) {
    const group = COLOR_GROUPS[event.color_group];
    return (
        <Link
            href={event.url}
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${group.bg} ${group.text} ${group.border} border hover:opacity-85 transition-opacity truncate max-w-full shadow-2xs`}
            title={`${event.label}: ${event.title}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${group.dot}`} />
            <span className="truncate">{event.title}</span>
        </Link>
    );
}

// ─── Detailed Deliverable Card (Selected Day Inspector) ───────────────────────

function DeliverableDetailCard({ event }: { event: CalendarEvent }) {
    const group = COLOR_GROUPS[event.color_group];
    const urgency = getUrgencyInfo(event.date, event.status);

    return (
        <div className={`p-3 rounded-xl border ${group.border} bg-white hover:border-slate-300 transition-colors shadow-2xs group relative`}>
            <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${group.badge}`}>
                            {getEventIcon(event.type)}
                            <span>{event.label}</span>
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${urgency.badgeClass}`}>
                            {urgency.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {event.status}
                        </span>
                    </div>

                    <Link
                        href={event.url}
                        className="text-xs font-bold text-slate-900 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors line-clamp-2 leading-snug"
                    >
                        {event.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2 text-[11px] text-slate-500">
                        {event.project && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                                <FolderOpen className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[140px] font-medium">{event.project.title}</span>
                            </span>
                        )}
                        {event.committee && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[120px]">{event.committee.name}</span>
                            </span>
                        )}
                        {event.activity && (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                                <Layers className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[120px]">{event.activity.title}</span>
                            </span>
                        )}
                        {event.assignee && (
                            <span className="text-slate-500">
                                {event.is_mine ? (
                                    <span className="font-semibold text-emerald-700">Assigned to you</span>
                                ) : (
                                    `→ ${event.assignee.name}`
                                )}
                            </span>
                        )}
                    </div>
                </div>

                <Link
                    href={event.url}
                    className="p-1 rounded-md text-slate-400 hover:text-[color:var(--color-brand-action-orange)] hover:bg-orange-50 transition-colors shrink-0"
                    title="Open workspace"
                >
                    <ExternalLink className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}

// ─── Upcoming Deadline Row (Prototype-Aligned) ───────────────────────────────

function UpcomingDeadlineRow({ event }: { event: CalendarEvent }) {
    const urgency = getUrgencyInfo(event.date, event.status);

    const projectContext = event.project?.title || '';
    const parentContext = event.activity?.title
        ? `${projectContext} · ${event.activity.title}`
        : projectContext;

    return (
        <div className="py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 group border-b border-slate-100 last:border-b-0">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2 h-2 rounded-full shrink-0 ${urgency.dotClass}`}
                        title={urgency.label}
                    />
                    <Link
                        href={event.url}
                        className="text-xs font-semibold text-slate-900 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate"
                        title={event.title}
                    >
                        {event.title}
                    </Link>
                </div>
                {parentContext && (
                    <p className="text-[11px] text-slate-500 truncate pl-4 mt-0.5">
                        {parentContext}
                    </p>
                )}
            </div>

            <div className="text-right shrink-0">
                <span className={`text-xs font-semibold block ${urgency.textClass}`}>
                    {event.date_formatted}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    {urgency.label}
                </span>
            </div>
        </div>
    );
}

// ─── Main Calendar Index Page ─────────────────────────────────────────────────

export default function CalendarIndex({ events }: CalendarIndexProps) {
    const today = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => {
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }, [today]);

    const [viewYear, setViewYear] = useState(() => today.getFullYear());
    const [viewMonth, setViewMonth] = useState(() => today.getMonth());
    const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
    const [filterType, setFilterType] = useState<'all' | 'task_due' | 'activity_due' | 'project_deadline'>('all');

    // Filter to ONLY Deadlines (Task Due, Activity Due, Project Deadline)
    const deadlineEvents = useMemo(() => {
        return events.filter(
            (e) => e.type === 'task_due' || e.type === 'activity_due' || e.type === 'project_deadline'
        );
    }, [events]);

    // Apply optional type filter
    const filteredEvents = useMemo(() => {
        if (filterType === 'all') {
            return deadlineEvents;
        }
        return deadlineEvents.filter((e) => e.type === filterType);
    }, [deadlineEvents, filterType]);

    // Map of date (YYYY-MM-DD) → events
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        filteredEvents.forEach((e) => {
            const list = map.get(e.date) ?? [];
            list.push(e);
            map.set(e.date, list);
        });
        return map;
    }, [filteredEvents]);

    // Upcoming deadlines: non-completed deadlines sorted by date
    const upcomingDeadlines = useMemo(() => {
        const activeDeadlines = deadlineEvents.filter((e) => {
            const status = (e.status || '').toLowerCase();
            return status !== 'completed' && status !== 'archived';
        });

        return activeDeadlines.sort((a, b) => a.date.localeCompare(b.date));
    }, [deadlineEvents]);

    // Calendar grid calculations
    const daysInCurrentMonth = useMemo(() => {
        return new Date(viewYear, viewMonth + 1, 0).getDate();
    }, [viewYear, viewMonth]);

    const firstDayWeekday = useMemo(() => {
        return new Date(viewYear, viewMonth, 1).getDay();
    }, [viewYear, viewMonth]);

    const daysInPrevMonth = useMemo(() => {
        return new Date(viewYear, viewMonth, 0).getDate();
    }, [viewYear, viewMonth]);

    // Trailing days needed to fill the last row to 7 columns
    const trailingDaysCount = useMemo(() => {
        const totalVisible = firstDayWeekday + daysInCurrentMonth;
        const remainder = totalVisible % 7;
        return remainder === 0 ? 0 : 7 - remainder;
    }, [firstDayWeekday, daysInCurrentMonth]);

    // Navigation callbacks (Previous / Next month)
    const handlePrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear((y) => y - 1);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear((y) => y + 1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    const selectedEvents = useMemo(() => {
        if (!selectedDate) return [];
        return eventsByDate.get(selectedDate) ?? [];
    }, [selectedDate, eventsByDate]);

    // Simplified Legend items: only Task Due, Activity Due, Project Deadline
    const legendItems: { group: EventColorGroup; label: string }[] = [
        { group: 'task', label: 'Task Due' },
        { group: 'activity_due', label: 'Activity Due' },
        { group: 'project_deadline', label: 'Project Deadline' },
    ];

    return (
        <AppLayout
            title="Calendar"
            subtitle="Project, activity, and task deadlines at a glance"
        >
            <Head title="Calendar — ITASK" />

            <div className="w-full max-w-7xl mx-auto space-y-4">

                {/* ── Main Layout: Calendar Grid + Deadlines Panel ── */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">

                    {/* ══ Column 1 & 2: Integrated Month Calendar Container ══ */}
                    <div className="xl:col-span-2 bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">

                        {/* ── Integrated Header: Month/Year + Inline Legend + Compact Nav ── */}
                        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
                            <div className="flex items-center gap-4">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                                    {MONTH_NAMES[viewMonth]} {viewYear}
                                </h2>

                                {/* Desktop Inline Legend */}
                                <div className="hidden md:flex items-center gap-3 border-l border-slate-200 pl-4">
                                    {legendItems.map(({ group, label }) => {
                                        const style = COLOR_GROUPS[group];
                                        return (
                                            <span key={group} className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                                <span>{label}</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Controls: Filter + Compact Prev/Next Navigation */}
                            <div className="flex items-center gap-2">
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="h-8 pl-2.5 pr-7 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] cursor-pointer shadow-2xs"
                                    aria-label="Filter deadline types"
                                >
                                    <option value="all">All Deadlines</option>
                                    <option value="task_due">Tasks Only</option>
                                    <option value="activity_due">Activities Only</option>
                                    <option value="project_deadline">Projects Only</option>
                                </select>

                                {/* Compact Prev / Next Arrows */}
                                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={handlePrevMonth}
                                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-l-lg transition-colors cursor-pointer border-r border-slate-200"
                                        aria-label="Previous month"
                                        title="Previous month"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleNextMonth}
                                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-r-lg transition-colors cursor-pointer"
                                        aria-label="Next month"
                                        title="Next month"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Legend Sub-strip */}
                        <div className="md:hidden px-4 py-2 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-600">
                            {legendItems.map(({ group, label }) => {
                                const style = COLOR_GROUPS[group];
                                return (
                                    <span key={group} className="inline-flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                        <span className="text-[11px] font-medium">{label}</span>
                                    </span>
                                );
                            })}
                        </div>

                        {/* Weekday Header */}
                        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75">
                            {WEEKDAYS.map((day, idx) => (
                                <div
                                    key={day.short}
                                    className={`py-2 text-center text-xs font-bold text-slate-600 tracking-wider ${
                                        idx === 0 || idx === 6 ? 'text-slate-400' : ''
                                    }`}
                                >
                                    <span className="hidden sm:inline">{day.short}</span>
                                    <span className="sm:hidden">{day.letter}</span>
                                </div>
                            ))}
                        </div>

                        {/* Calendar Day Cells */}
                        <div className="grid grid-cols-7 border-collapse bg-slate-100 gap-px">
                            {/* 1. Leading days from previous month */}
                            {Array.from({ length: firstDayWeekday }).map((_, i) => {
                                const prevDayNum = daysInPrevMonth - firstDayWeekday + i + 1;
                                return (
                                    <div
                                        key={`prev-${i}`}
                                        className="min-h-[70px] sm:min-h-[88px] md:min-h-[96px] bg-slate-50/50 p-1.5 sm:p-2 text-slate-300 flex flex-col justify-between select-none"
                                    >
                                        <span className="text-xs font-semibold text-slate-300">
                                            {prevDayNum}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* 2. Days of current month */}
                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                                const dayNum = i + 1;
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const dayEvents = eventsByDate.get(dateStr) ?? [];
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDate;
                                const hasEvents = dayEvents.length > 0;

                                return (
                                    <div
                                        key={dateStr}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                setSelectedDate(isSelected ? null : dateStr);
                                            }
                                        }}
                                        className={`min-h-[70px] sm:min-h-[88px] md:min-h-[96px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between text-left group ${
                                            isSelected
                                                ? 'bg-orange-50/80 ring-2 ring-inset ring-[color:var(--color-brand-action-orange)]'
                                                : isToday
                                                ? 'bg-emerald-50/40 hover:bg-emerald-50/60'
                                                : 'bg-white hover:bg-slate-50/90'
                                        }`}
                                    >
                                        {/* Day header row */}
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={`text-xs font-bold w-5.5 h-5.5 flex items-center justify-center rounded-full transition-transform ${
                                                    isToday
                                                        ? 'bg-[color:var(--color-brand-dark-green)] text-white shadow-2xs'
                                                        : isSelected
                                                        ? 'bg-[color:var(--color-brand-action-orange)] text-white shadow-2xs'
                                                        : 'text-slate-700 group-hover:text-slate-900'
                                                }`}
                                            >
                                                {dayNum}
                                            </span>

                                            {/* Mobile dot cluster */}
                                            {hasEvents && (
                                                <div className="sm:hidden flex items-center gap-0.5">
                                                    {dayEvents.slice(0, 3).map((e) => (
                                                        <span
                                                            key={e.id}
                                                            className={`w-1.5 h-1.5 rounded-full ${COLOR_GROUPS[e.color_group].dot}`}
                                                        />
                                                    ))}
                                                    {dayEvents.length > 3 && (
                                                        <span className="text-[9px] text-slate-400 font-bold leading-none">
                                                            +
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Desktop & Tablet Event Pills */}
                                        <div className="hidden sm:flex flex-col gap-1 mt-1 overflow-hidden">
                                            {dayEvents.slice(0, 2).map((e) => (
                                                <CellEventItem key={e.id} event={e} />
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <span className="text-[10px] font-bold text-slate-500 pl-1">
                                                    +{dayEvents.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 3. Trailing days to fill the final row to 7 columns */}
                            {Array.from({ length: trailingDaysCount }).map((_, i) => (
                                <div
                                    key={`next-${i}`}
                                    className="min-h-[70px] sm:min-h-[88px] md:min-h-[96px] bg-slate-50/50 p-1.5 sm:p-2 text-slate-300 flex flex-col justify-between select-none"
                                >
                                    <span className="text-xs font-semibold text-slate-300">
                                        {i + 1}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══ Column 3: Side Panel (Selected Date + Upcoming Deadlines) ══ */}
                    <div className="space-y-4">

                        {/* ── 1. Selected Date Deliverables (Inspector) ── */}
                        {selectedDate && (
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden animate-in fade-in duration-200">
                                <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-900">
                                            {formatFullDate(selectedDate)}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {selectedEvents.length} {selectedEvents.length === 1 ? 'deliverable' : 'deliverables'} on this date
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDate(null)}
                                        className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
                                        aria-label="Close date details"
                                        title="Deselect date"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="p-3 space-y-2.5 max-h-[340px] overflow-y-auto">
                                    {selectedEvents.length === 0 ? (
                                        <div className="py-5 px-3 text-center">
                                            <CalendarDays className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                                            <p className="text-xs font-medium text-slate-600">No deadlines on this day</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                Select another date or view upcoming deadlines below.
                                            </p>
                                        </div>
                                    ) : (
                                        selectedEvents.map((e) => (
                                            <DeliverableDetailCard key={e.id} event={e} />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── 2. Upcoming Deadlines (Prototype-Aligned Section) ── */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">
                            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Upcoming Deadlines
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Approaching activity and task deliverables
                                    </p>
                                </div>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                                    {upcomingDeadlines.length}
                                </span>
                            </div>

                            <div className="p-1.5 divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                                {upcomingDeadlines.length === 0 ? (
                                    <div className="py-8 px-4 text-center">
                                        <Clock className="w-6 h-6 mx-auto text-slate-300 mb-2" />
                                        <p className="text-xs font-semibold text-slate-700">No Upcoming Deadlines</p>
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                                            All deliverables are completed or have no scheduled deadline.
                                        </p>
                                    </div>
                                ) : (
                                    upcomingDeadlines.map((e) => (
                                        <UpcomingDeadlineRow key={e.id} event={e} />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* ── 3. Zero-State Global Fallback ── */}
                        {deadlineEvents.length === 0 && (
                            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-5 text-center">
                                <CalendarDays className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800">No Scheduled Deadlines</h4>
                                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                                    Deadlines will appear here automatically when activities and tasks have due dates set.
                                </p>
                                <Link
                                    href="/projects"
                                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Go to Projects</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
