import React, { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    FolderOpen,
    Filter,
    CheckSquare,
    Layers,
    CalendarDays,
} from 'lucide-react';
import { Badge } from '@/Components/Badge';
import { Button } from '@/Components/Button';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CalendarEvent {
    id: string;
    raw_id: string;
    type: 'task' | 'activity';
    title: string;
    description?: string | null;
    status: string;
    date: string; // YYYY-MM-DD
    start_date?: string | null;
    end_date?: string | null;
    due_date_formatted: string;
    is_overdue: boolean;
    assigned_to_user: boolean;
    assignee_name?: string | null;
    project: {
        id: string;
        title: string;
    };
    committee: {
        id: string;
        name: string;
    };
    activity: {
        id: string;
        title: string;
    };
    action_url: string;
}

export interface CalendarIndexProps {
    events: CalendarEvent[];
    projects: Array<{ id: string; title: string }>;
    filters: {
        project_id: string;
        type: string;
    };
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Index({
    events = [],
    projects = [],
    filters = {
        project_id: 'all',
        type: 'all',
    },
}: CalendarIndexProps) {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
    const [selectedDateStr, setSelectedDateStr] = useState<string>(
        `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );

    // Filter change handler
    const handleFilterChange = (key: string, value: string) => {
        router.get(
            '/calendar',
            {
                ...filters,
                [key]: value,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    // Month Navigation
    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleToday = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth());
        setSelectedDateStr(
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        );
    };

    // Index events by YYYY-MM-DD for fast lookup
    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const ev of events) {
            if (!ev.date) continue;
            if (!map[ev.date]) {
                map[ev.date] = [];
            }
            map[ev.date].push(ev);
        }
        return map;
    }, [events]);

    // Calendar grid calculations
    const calendarDays = useMemo(() => {
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

        const cells: Array<{
            dateStr: string;
            dayNumber: number;
            isCurrentMonth: boolean;
            isToday: boolean;
        }> = [];

        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Previous month padding
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const prevM = currentMonth === 0 ? 12 : currentMonth;
            const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
            const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            cells.push({
                dateStr,
                dayNumber: dayNum,
                isCurrentMonth: false,
                isToday: dateStr === todayStr,
            });
        }

        // Current month days
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push({
                dateStr,
                dayNumber: d,
                isCurrentMonth: true,
                isToday: dateStr === todayStr,
            });
        }

        // Next month padding to fill a complete 35 or 42 grid
        const remaining = 42 - cells.length;
        if (remaining > 0 && remaining < 7) {
            for (let d = 1; d <= remaining; d++) {
                const nextM = currentMonth === 11 ? 1 : currentMonth + 2;
                const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
                const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                cells.push({
                    dateStr,
                    dayNumber: d,
                    isCurrentMonth: false,
                    isToday: dateStr === todayStr,
                });
            }
        }

        return cells;
    }, [currentYear, currentMonth]);

    const selectedEvents = eventsByDate[selectedDateStr] || [];

    return (
        <AppLayout
            title="Schedule & Calendar"
            subtitle="Monthly view of CCIS project deadlines, committee activities, and milestones."
        >
            <Head title="Calendar" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* ─── Calendar Controls & Filters Bar ──────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    {/* Month Navigator */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-700"
                                title="Previous Month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-1.5 hover:bg-white rounded-md transition-colors text-slate-700"
                                title="Next Month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <h2 className="text-base font-bold text-slate-900 min-w-44">
                            {MONTH_NAMES[currentMonth]} {currentYear}
                        </h2>

                        <Button variant="outline" size="sm" onClick={handleToday} className="text-xs h-8">
                            Today
                        </Button>
                    </div>

                    {/* Filters & Legend */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Type Toggle */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                            <button
                                onClick={() => handleFilterChange('type', 'all')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${filters.type === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => handleFilterChange('type', 'tasks')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${filters.type === 'tasks' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Tasks
                            </button>
                            <button
                                onClick={() => handleFilterChange('type', 'activities')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${filters.type === 'activities' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                            >
                                Activities
                            </button>
                        </div>

                        {/* Project Filter */}
                        {projects.length > 0 && (
                            <select
                                value={filters.project_id}
                                onChange={(e) => handleFilterChange('project_id', e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[color:var(--color-brand-dark-green)]"
                            >
                                <option value="all">All Projects</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.title}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* ─── Main Grid + Selected Day Split ──────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Monthly Grid (3 columns on large) */}
                    <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                        {/* Day of Week Headers */}
                        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center py-2 text-xs font-semibold text-slate-600">
                            {DAYS_OF_WEEK.map((day) => (
                                <div key={day}>{day}</div>
                            ))}
                        </div>

                        {/* Day Cells */}
                        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
                            {calendarDays.map((cell) => {
                                const dayEvents = eventsByDate[cell.dateStr] || [];
                                const isSelected = cell.dateStr === selectedDateStr;

                                return (
                                    <div
                                        key={cell.dateStr}
                                        onClick={() => setSelectedDateStr(cell.dateStr)}
                                        className={`min-h-[92px] p-1.5 transition-colors cursor-pointer flex flex-col justify-between ${
                                            !cell.isCurrentMonth
                                                ? 'bg-slate-50/50 text-slate-400'
                                                : isSelected
                                                ? 'bg-emerald-50/40 ring-2 ring-inset ring-[color:var(--color-brand-dark-green)]'
                                                : 'bg-white hover:bg-slate-50/80'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                                                    cell.isToday
                                                        ? 'bg-[color:var(--color-brand-dark-green)] text-white font-bold'
                                                        : isSelected
                                                        ? 'text-[color:var(--color-brand-dark-green)] font-bold'
                                                        : cell.isCurrentMonth
                                                        ? 'text-slate-800'
                                                        : 'text-slate-400'
                                                }`}
                                            >
                                                {cell.dayNumber}
                                            </span>

                                            {dayEvents.length > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {dayEvents.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Event Pills */}
                                        <div className="space-y-1 mt-1 overflow-hidden">
                                            {dayEvents.slice(0, 2).map((ev) => {
                                                const isTask = ev.type === 'task';
                                                return (
                                                    <div
                                                        key={ev.id}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium truncate border ${
                                                            isTask
                                                                ? 'bg-orange-50 text-orange-950 border-orange-200'
                                                                : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                                                        }`}
                                                        title={`${ev.type.toUpperCase()}: ${ev.title} (${ev.project.title})`}
                                                    >
                                                        <span className="font-bold mr-1">
                                                            {isTask ? '• Task:' : '◆ Act:'}
                                                        </span>
                                                        {ev.title}
                                                    </div>
                                                );
                                            })}

                                            {dayEvents.length > 2 && (
                                                <div className="text-[9px] font-semibold text-slate-500 pl-1">
                                                    +{dayEvents.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Day Agenda Side Panel (1 column) */}
                    <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <CalendarDays className="w-4 h-4 text-[color:var(--color-brand-dark-green)]" />
                                    <h3 className="text-sm font-bold text-slate-900">
                                        Agenda
                                    </h3>
                                </div>
                                <span className="text-xs font-semibold text-slate-500">
                                    {selectedDateStr}
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {selectedEvents.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400">
                                        <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-xs font-medium">No deadlines or events scheduled on this date.</p>
                                    </div>
                                ) : (
                                    selectedEvents.map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span
                                                    className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                                        ev.type === 'task'
                                                            ? 'bg-orange-100 text-orange-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}
                                                >
                                                    {ev.type}
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-500">
                                                    {ev.status}
                                                </span>
                                            </div>

                                            <h4 className="text-xs font-bold text-slate-900 leading-snug">
                                                {ev.title}
                                            </h4>

                                            <div className="text-[11px] text-slate-500 space-y-0.5">
                                                <div className="truncate">
                                                    <span className="font-semibold text-slate-700">Project:</span> {ev.project.title}
                                                </div>
                                                <div className="truncate">
                                                    <span className="font-semibold text-slate-700">Committee:</span> {ev.committee.name}
                                                </div>
                                                {ev.assignee_name && (
                                                    <div>
                                                        <span className="font-semibold text-slate-700">Assignee:</span> {ev.assignee_name}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                                                <Link
                                                    href={ev.action_url}
                                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-brand-dark-green)] hover:text-[color:var(--color-brand-active-warm-orange)]"
                                                >
                                                    <span>Open Details</span>
                                                    <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1.5">
                            <div className="font-semibold text-slate-700 mb-1">Legend:</div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                <span>Orange = Individual Task Deadline</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                                <span>Green = Committee Activity Deadline</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
