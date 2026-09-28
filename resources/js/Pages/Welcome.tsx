import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { PageProps } from '@/types';
import {
    FolderOpen,
    CheckSquare,
    Users,
    Clock,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: boolean;
}

function StatCard({ label, value, sub, icon: Icon, accent }: StatCardProps) {
    return (
        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 flex items-start gap-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-[color:var(--color-border-dark)] transition-colors">
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{
                    backgroundColor: accent
                        ? 'var(--color-brand-active-warm-orange)'
                        : 'var(--color-surface-muted)',
                }}
            >
                <span
                    className="flex items-center justify-center"
                    style={{
                        color: accent
                            ? 'var(--color-brand-action-orange)'
                            : 'var(--color-text-muted)',
                    }}
                >
                    <Icon className="w-5 h-5" />
                </span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    {label}
                </p>
                <p className="text-2xl font-bold text-[color:var(--color-text-main)] mt-0.5 leading-none">
                    {value}
                </p>
                <p className="text-xs text-[color:var(--color-text-subtle)] mt-1">{sub}</p>
            </div>
        </div>
    );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-main)]">{title}</h2>
            {subtitle && (
                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">{subtitle}</p>
            )}
        </div>
    );
}

// ─── Empty Placeholder ───────────────────────────────────────────────────────

function EmptyPlaceholder({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl border border-dashed border-[color:var(--color-border-dark)] bg-[color:var(--color-surface-subtle)]">
            <div className="w-10 h-10 rounded-full bg-[color:var(--color-surface-muted)] flex items-center justify-center mb-3" style={{ color: 'var(--color-text-subtle)' }}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-[color:var(--color-text-muted)]">{title}</p>
            <p className="text-xs text-[color:var(--color-text-subtle)] mt-1 max-w-xs leading-relaxed">
                {description}
            </p>
        </div>
    );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Welcome() {
    const { auth } = usePage<PageProps>().props;
    const user = auth?.user;

    const greeting = (() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    })();

    const firstName = user?.name?.split(' ')[0] ?? 'there';

    return (
        <AppLayout
            title="Dashboard"
            subtitle="Your ITASK workspace overview"
        >
            <Head title="Dashboard" />

            <div className="space-y-6">

                {/* ── Greeting ── */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-[color:var(--color-text-main)]">
                            {greeting}, {firstName} 👋
                        </h2>
                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                            Here's a summary of your assigned work and activity.
                        </p>
                    </div>
                </div>

                {/* ── Stats Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard
                        label="Active Projects"
                        value="—"
                        sub="Assigned to you"
                        icon={FolderOpen}
                        accent
                    />
                    <StatCard
                        label="Open Tasks"
                        value="—"
                        sub="Pending completion"
                        icon={CheckSquare}
                    />
                    <StatCard
                        label="Committee Roles"
                        value="—"
                        sub="Across all projects"
                        icon={Users}
                    />
                    <StatCard
                        label="Overdue Items"
                        value="—"
                        sub="Require attention"
                        icon={AlertCircle}
                    />
                </div>

                {/* ── Two column layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* My Tasks (wide) */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                        <SectionHeader
                            title="My Tasks"
                            subtitle="Tasks assigned to you across all projects"
                        />
                        <EmptyPlaceholder
                            icon={CheckSquare}
                            title="No tasks assigned yet"
                            description="Once a Project Staff assigns tasks to you, they will appear here for tracking."
                        />
                    </div>

                    {/* Recent activity (narrow) */}
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                        <SectionHeader
                            title="Recent Activity"
                            subtitle="Latest changes in your projects"
                        />
                        <EmptyPlaceholder
                            icon={Clock}
                            title="No activity yet"
                            description="Project activity and updates will be shown here."
                        />
                    </div>
                </div>

                {/* ── Projects ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                    <SectionHeader
                        title="My Projects"
                        subtitle="CCIS projects where you hold an active role"
                    />
                    <EmptyPlaceholder
                        icon={TrendingUp}
                        title="No projects yet"
                        description="Projects assigned to you by a Project Leader or Director will appear here."
                    />
                </div>

            </div>
        </AppLayout>
    );
}
