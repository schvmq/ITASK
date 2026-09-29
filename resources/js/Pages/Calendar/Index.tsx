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
    ListTodo,
    AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventColorGroup = 'project' | 'project_deadline' | 'activity' | 'activity_due' | 'task';
type EventType = 'project_start' | 'project_deadline' | 'activity_start' | 'activity_due' | 'task_due';

interface CalendarEvent {
    id: string;
    type: EventType;
    title: string;
    label: string;
    date: string; // Y-m-d
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

// ─── Color helpers ────────────────────────────────────────────────────────────

const COLOR_GROUPS: Record<EventColorGroup, { dot: string; bg: string; text: string; border: string }> = {
    project:          { dot: 'bg-[color:var(--color-brand-dark-green)]', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
    project_deadline: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
    activity:         { dot: 'bg-sky-500', bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200' },
    activity_due:     { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
    task:             { dot: 'bg-[color:var(--color-brand-action-orange)]', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
};

function getEventIcon(type: EventType) {
    switch (type) {
        case 'project_start':    return <FolderOpen className="w-3.5 h-3.5 shrink-0" />;
        case 'project_deadline': return <Flag className="w-3.5 h-3.5 shrink-0" />;
        case 'activity_start':   return <Layers className="w-3.5 h-3.5 shrink-0" />;
        case 'activity_due':     return <Clock className="w-3.5 h-3.5 shrink-0" />;
        case 'task_due':         return <CheckSquare className="w-3.5 h-3.5 shrink-0" />;
    }
}

// ─── Calendar Grid ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

// ─── Event Pill (in calendar cell) ───────────────────────────────────────────

function EventPill({ event }: { event: CalendarEvent }) {
    const colors = COLOR_GROUPS[event.color_group];
    return (
        <Link
            href={event.url}
            className={`block truncate text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.border} border hover:opacity-80 transition-opacity`}
            title={`${event.label}: ${event.title}`}
        >
            {event.title}
        </Link>
    );
}

// ─── Detail Event Card ────────────────────────────────────────────────────────

function EventCard({ event }: { event: CalendarEvent }) {
    const colors = COLOR_GROUPS[event.color_group];
    return (
        <Link
            href={event.url}
            className={`flex items-start gap-3 p-3 rounded-xl border ${colors.bg} ${colors.border} hover:opacity-80 transition-opacity group`}
        >
            <div className={`mt-0.5 ${colors.text}`}>
                {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
                        {event.label}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold bg-white/60 ${colors.text}`}>
                        {event.status}
                    </span>
                </div>
                <p className="text-xs font-bold text-slate-900 truncate">{event.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                    {event.project && (
                        <span className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{event.project.title}</span>
                        </span>
                    )}
                    {event.committee && (
                        <span className="text-[11px] text-slate-600 inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{event.committee.name}</span>
                        </span>
                    )}
                    {event.assignee && (
                        <span className="text-[11px] text-slate-500">
                            {event.is_mine ? '(mine)' : `→ ${event.assignee.name}`}
                        </span>
                    )}
                </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 mt-0.5" />
        </Link>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CalendarIndex({ events }: CalendarIndexProps) {
    const today = new Date();
    const [viewYear, setViewYear]   = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // Build a map of date → events
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach((e) => {
            const list = map.get(e.date) ?? [];
            list.push(e);
            map.set(e.date, list);
        });
        return map;
    }, [events]);

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); }
        else setViewMonth(m => m - 1);
        setSelectedDate(null);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); }
        else setViewMonth(m => m + 1);
        setSelectedDate(null);
    };
    const goToToday = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDate(null);
    };

    const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

    // Upcoming events (next 30 days from today)
    const upcomingEvents = useMemo(() => {
        const todayStr = today.toISOString().slice(0, 10);
        const limit    = new Date(today);
        limit.setDate(limit.getDate() + 30);
        const limitStr = limit.toISOString().slice(0, 10);
        return events.filter((e) => e.date >= todayStr && e.date <= limitStr);
    }, [events, today]);

    // Legend
    const legendItems: { group: EventColorGroup; label: string }[] = [
        { group: 'project',          label: 'Project Start' },
        { group: 'project_deadline', label: 'Project Deadline' },
        { group: 'activity',         label: 'Activity Start' },
        { group: 'activity_due',     label: 'Activity Due' },
        { group: 'task',             label: 'Task Due' },
    ];

    return (
        <AppLayout title="Calendar" subtitle="Project, activity, and task deadlines at a glance">
            <Head title="Calendar — ITASK" />

            <div className="space-y-6">

                {/* ── Legend ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-3 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Legend:</span>
                    {legendItems.map(({ group, label }) => {
                        const c = COLOR_GROUPS[group];
                        return (
                            <span key={group} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                <span className={`w-2.5 h-2.5 rounded-sm ${c.dot}`} />
                                {label}
                            </span>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* ── Calendar Grid ── */}
                    <div className="xl:col-span-2 bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">
                        {/* Month header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h2 className="text-base font-bold text-[color:var(--color-text-main)]">
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={goToToday}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Today
                                </button>
                                <button
                                    type="button"
                                    onClick={prevMonth}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-600"
                                    aria-label="Previous month"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={nextMonth}
                                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-slate-600"
                                    aria-label="Next month"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Weekday header row */}
                        <div className="grid grid-cols-7 border-b border-slate-100">
                            {WEEKDAYS.map((d) => (
                                <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div className="grid grid-cols-7">
                            {/* Blank leading cells */}
                            {Array.from({ length: firstDay }).map((_, i) => (
                                <div key={`blank-${i}`} className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50" />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day       = i + 1;
                                const dateStr   = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dayEvents = eventsByDate.get(dateStr) ?? [];
                                const isToday   = dateStr === today.toISOString().slice(0, 10);
                                const isSelected = dateStr === selectedDate;
                                const col = (firstDay + i) % 7;
                                const isLastCol = col === 6;

                                return (
                                    <div
                                        key={day}
                                        onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                        className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 flex flex-col gap-1 cursor-pointer transition-colors ${
                                            isLastCol ? 'border-r-0' : ''
                                        } ${
                                            isSelected
                                                ? 'bg-orange-50/70'
                                                : isToday
                                                ? 'bg-emerald-50/40'
                                                : 'hover:bg-slate-50'
                                        }`}
                                    >
                                        <span
                                            className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full self-end ${
                                                isToday
                                                    ? 'bg-[color:var(--color-brand-dark-green)] text-white'
                                                    : isSelected
                                                    ? 'bg-[color:var(--color-brand-action-orange)] text-white'
                                                    : 'text-slate-600'
                                            }`}
                                        >
                                            {day}
                                        </span>
                                        <div className="space-y-0.5 overflow-hidden">
                                            {dayEvents.slice(0, 2).map((e) => (
                                                <EventPill key={e.id} event={e} />
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <span className="block text-[10px] text-slate-400 font-semibold pl-1">
                                                    +{dayEvents.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Right Panel: selected day / upcoming ── */}
                    <div className="space-y-5">
                        {/* Selected day events */}
                        {selectedDate ? (
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                                                weekday: 'long', month: 'long', day: 'numeric',
                                            })}
                                        </h3>
                                        <p className="text-xs text-[color:var(--color-text-muted)]">
                                            {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDate(null)}
                                        className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                        aria-label="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                                    {selectedEvents.length === 0 ? (
                                        <p className="text-xs text-slate-400 text-center py-4">No events this day.</p>
                                    ) : (
                                        selectedEvents.map((e) => <EventCard key={e.id} event={e} />)
                                    )}
                                </div>
                            </div>
                        ) : null}

                        {/* Upcoming 30 days */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">Upcoming (next 30 days)</h3>
                                <p className="text-xs text-[color:var(--color-text-muted)]">{upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                                {upcomingEvents.length === 0 ? (
                                    <div className="py-8 text-center">
                                        <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500 font-medium">No events in the next 30 days</p>
                                        <p className="text-xs text-slate-400 mt-1">Events will appear here as projects and tasks are scheduled.</p>
                                    </div>
                                ) : (
                                    upcomingEvents.map((e) => <EventCard key={e.id} event={e} />)
                                )}
                            </div>
                        </div>

                        {/* No events at all */}
                        {events.length === 0 && (
                            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
                                <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-slate-700">No Scheduled Dates</h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                                    Dates will appear here once projects, activities, and tasks have start or due dates set.
                                </p>
                                <Link
                                    href="/projects"
                                    className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    Go to Projects
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
