import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Flag,
    Clock,
    CheckSquare,
    ExternalLink,
    Filter,
} from 'lucide-react';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';

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

function getEventBadgeVariant(type: EventType): 'danger' | 'secondary' | 'accent' | 'primary' {
    if (type === 'project_deadline' || type === 'task_due') return 'danger';
    if (type === 'activity_due') return 'secondary';
    return 'primary';
}

function parseYMD(dateStr: string): { year: number; month: number; day: number } {
    const parts = dateStr.split('-').map(Number);
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

export default function CalendarIndex({ events = [] }: CalendarIndexProps) {
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

    // Deadlines only
    const deadlineEvents = useMemo(() => {
        return events.filter(
            (e) => e.type === 'task_due' || e.type === 'activity_due' || e.type === 'project_deadline'
        );
    }, [events]);

    const filteredEvents = useMemo(() => {
        if (filterType === 'all') return deadlineEvents;
        return deadlineEvents.filter((e) => e.type === filterType);
    }, [deadlineEvents, filterType]);

    // Map of date -> events
    const eventsByDate = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        filteredEvents.forEach((e) => {
            const list = map.get(e.date) ?? [];
            list.push(e);
            map.set(e.date, list);
        });
        return map;
    }, [filteredEvents]);

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

    const trailingDaysCount = useMemo(() => {
        const total = firstDayWeekday + daysInCurrentMonth;
        const remainder = total % 7;
        return remainder === 0 ? 0 : 7 - remainder;
    }, [firstDayWeekday, daysInCurrentMonth]);

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

    const handleTodayClick = () => {
        setViewYear(today.getFullYear());
        setViewMonth(today.getMonth());
        setSelectedDate(todayStr);
    };

    const selectedEvents = useMemo(() => {
        if (!selectedDate) return [];
        return eventsByDate.get(selectedDate) ?? [];
    }, [selectedDate, eventsByDate]);

    // Upcoming deadlines list
    const upcomingDeadlines = useMemo(() => {
        const active = deadlineEvents.filter((e) => {
            const status = (e.status || '').toLowerCase();
            return status !== 'completed' && status !== 'archived';
        });
        return active.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
    }, [deadlineEvents]);

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Calendar" />

            <div className="space-y-6">
                {/* ══ 1. Page Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            Calendar
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            Project, activity, and task deadlines at a glance.
                        </p>
                    </div>

                    {/* Month Navigator Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleTodayClick}
                        >
                            Today
                        </Button>
                        <div className="flex items-center gap-1 border border-[color:var(--border)] rounded-[8px] p-0.5 bg-[color:var(--card)]">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                aria-label="Previous month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[13px] font-bold text-[color:var(--text)] px-2.5 tabular-nums min-w-[130px] text-center">
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </span>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                aria-label="Next month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ══ 2. Filters & Legend ══ */}
                <Card className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                            Filter:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setFilterType('all')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                                    filterType === 'all'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                All deadlines
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('task_due')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                                    filterType === 'task_due'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                Task due
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('activity_due')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                                    filterType === 'activity_due'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                Activity due
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('project_deadline')}
                                className={`px-2.5 py-1 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                                    filterType === 'project_deadline'
                                        ? 'bg-[color:var(--primary)] text-white'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)]'
                                }`}
                            >
                                Project deadline
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-[12px] text-[color:var(--muted)] shrink-0">
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[color:var(--primary)]" />
                            Task / Project deadline
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[color:var(--secondary)]" />
                            Activity due
                        </span>
                    </div>
                </Card>

                {/* ══ 3. Calendar Grid & Inspector Layout ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-5">
                    {/* Calendar Month Grid */}
                    <Card className="p-4 sm:p-5 overflow-hidden">
                        {/* Day of Week Headers */}
                        <div className="grid grid-cols-7 gap-1 pb-2 border-b border-[color:var(--border)] text-center">
                            {WEEKDAYS.map((w, idx) => (
                                <div
                                    key={idx}
                                    className="text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider py-1"
                                >
                                    <span className="hidden sm:inline">{w.short}</span>
                                    <span className="sm:hidden">{w.letter}</span>
                                </div>
                            ))}
                        </div>

                        {/* Month Cells Grid */}
                        <div className="grid grid-cols-7 gap-1 pt-2">
                            {/* Prev Month Trailing Days */}
                            {Array.from({ length: firstDayWeekday }).map((_, i) => {
                                const dayNumber = daysInPrevMonth - firstDayWeekday + i + 1;
                                return (
                                    <div
                                        key={`prev-${i}`}
                                        className="min-h-[72px] sm:min-h-[88px] p-1.5 rounded-[8px] bg-[color:var(--soft-surface)]/40 border border-transparent text-[color:var(--muted)] opacity-35 text-[12px] font-medium tabular-nums"
                                    >
                                        <span>{dayNumber}</span>
                                    </div>
                                );
                            })}

                            {/* Current Month Days */}
                            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                                const dayNumber = i + 1;
                                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
                                const isCurrentToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDate;
                                const dayEvents = eventsByDate.get(dateStr) ?? [];
                                const hasEvents = dayEvents.length > 0;

                                return (
                                    <button
                                        key={`current-${dayNumber}`}
                                        type="button"
                                        onClick={() => setSelectedDate(dateStr)}
                                        className={`min-h-[72px] sm:min-h-[88px] p-1.5 rounded-[8px] border text-left flex flex-col justify-between transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 ${
                                            isSelected
                                                ? 'border-[color:var(--primary)] bg-[color:var(--soft-surface)] shadow-xs'
                                                : isCurrentToday
                                                ? 'border-[color:var(--border)] bg-[color:var(--card)] font-bold'
                                                : 'border-[color:var(--border)] bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span
                                                className={`text-[12px] font-semibold tabular-nums ${
                                                    isCurrentToday
                                                        ? 'w-5 h-5 rounded-full bg-[color:var(--primary)] text-white flex items-center justify-center font-bold text-[11px]'
                                                        : 'text-[color:var(--text)]'
                                                }`}
                                            >
                                                {dayNumber}
                                            </span>
                                            {hasEvents && (
                                                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--primary)]" />
                                            )}
                                        </div>

                                        {/* Day Events preview */}
                                        <div className="space-y-1 w-full overflow-hidden mt-1">
                                            {dayEvents.slice(0, 2).map((ev) => (
                                                <div
                                                    key={ev.id}
                                                    className="text-[10px] truncate px-1 py-0.5 rounded-[4px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)]"
                                                    title={ev.title}
                                                >
                                                    {ev.title}
                                                </div>
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <span className="text-[10px] text-[color:var(--muted)] font-semibold tabular-nums block">
                                                    +{dayEvents.length - 2} more
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Next Month Trailing Days */}
                            {Array.from({ length: trailingDaysCount }).map((_, i) => (
                                <div
                                    key={`next-${i}`}
                                    className="min-h-[72px] sm:min-h-[88px] p-1.5 rounded-[8px] bg-[color:var(--soft-surface)]/40 border border-transparent text-[color:var(--muted)] opacity-35 text-[12px] font-medium tabular-nums"
                                >
                                    <span>{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Day Deliverables Inspector Panel */}
                    <Card className="p-5 space-y-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border)]">
                                <div>
                                    <h2 className="text-[15px] font-bold text-[color:var(--text)]">
                                        Deliverables for day
                                    </h2>
                                    <p className="text-[12px] text-[color:var(--muted)] mt-0.5 tabular-nums">
                                        {selectedDate || 'Select a date'}
                                    </p>
                                </div>
                                <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] tabular-nums">
                                    {selectedEvents.length}
                                </span>
                            </div>

                            {selectedEvents.length === 0 ? (
                                <div className="py-10 text-center space-y-2">
                                    <Clock className="w-8 h-8 text-[color:var(--muted)] mx-auto opacity-50" />
                                    <p className="text-[13px] text-[color:var(--muted)]">
                                        No deadlines scheduled for this day.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[color:var(--border)]">
                                    {selectedEvents.map((ev) => (
                                        <div key={ev.id} className="py-3 first:pt-1 last:pb-1 space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge variant={getEventBadgeVariant(ev.type)}>
                                                    {ev.label}
                                                </Badge>
                                                <span className="text-[11px] text-[color:var(--muted)]">
                                                    {ev.status}
                                                </span>
                                            </div>

                                            <Link
                                                href={ev.url}
                                                className="font-semibold text-[13px] text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors block truncate"
                                            >
                                                {ev.title}
                                            </Link>

                                            <p className="text-[11px] text-[color:var(--muted)] truncate">
                                                {ev.project?.title}
                                                {ev.committee && ` · ${ev.committee.name}`}
                                                {ev.activity && ` · ${ev.activity.title}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Upcoming deadlines shortcut list */}
                        <div className="pt-4 border-t border-[color:var(--border)]">
                            <h3 className="text-[13px] font-bold text-[color:var(--text)] mb-2.5">
                                Next upcoming deadlines
                            </h3>
                            <div className="space-y-2">
                                {upcomingDeadlines.slice(0, 3).map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-2 rounded-[6px] bg-[color:var(--soft-surface)] text-[12px] flex items-center justify-between gap-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={item.url}
                                                className="font-medium text-[color:var(--text)] hover:text-[color:var(--primary)] truncate block"
                                            >
                                                {item.title}
                                            </Link>
                                            <span className="text-[10px] text-[color:var(--muted)] truncate block">
                                                {item.project?.title}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-[color:var(--muted)] tabular-nums shrink-0">
                                            {item.date_formatted}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
