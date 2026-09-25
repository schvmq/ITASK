import React, { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import {
    FolderOpen,
    Calendar,
    Users,
    CheckCircle2,
    Clock,
    ArrowLeft,
    Settings,
    Edit3,
    MoreHorizontal,
    Layers,
    ListTodo,
    CheckSquare,
    GanttChartSquare,
    FileText,
    ChevronRight,
    ArrowRight,
    Shield,
    Info,
    X,
    ExternalLink,
    AlertCircle,
} from 'lucide-react';

// ─── Types & Definitions ──────────────────────────────────────────────────────

export interface ProjectShowProps {
    projectId?: string;
}

type TabKey = 'overview' | 'committees' | 'activities' | 'tasks' | 'timeline';

interface CommitteePreview {
    id: string;
    name: string;
    progress: number;
    membersCount: number;
    activitiesCount: number;
    leadName: string;
}

interface ActivityItem {
    id: string;
    title: string;
    committee: string;
    actor: string;
    timeAgo: string;
    type: 'update' | 'task' | 'review';
}

interface ProjectDocument {
    id: string;
    title: string;
    type: string;
    status: 'Approved' | 'Verified' | 'Pending';
    updatedAt: string;
    size: string;
}

// ─── Mock Project Data (Single Representative Project) ────────────────────────
// Presentation-only mock data adhering to the ITASK CCIS project management domain.
const MOCK_PROJECT = {
    id: 'proj-1',
    title: 'CCIS General Assembly 2026',
    description:
        'Coordination of the 2026 CCIS General Assembly and related committee activities.',
    status: 'In Progress',
    role: 'Project Leader' as ProjectRole,
    progress: 68,
    deadline: 'October 18, 2026',
    startDate: 'September 01, 2026',
    summary: {
        committees: 4,
        activities: 12,
        tasks: 24,
    },
};

const MOCK_COMMITTEES: CommitteePreview[] = [
    {
        id: 'comm-1',
        name: 'Program & Events Committee',
        progress: 68,
        membersCount: 6,
        activitiesCount: 4,
        leadName: 'Prof. Althea Ramos (Project Staff)',
    },
    {
        id: 'comm-2',
        name: 'Technical Committee',
        progress: 42,
        membersCount: 5,
        activitiesCount: 4,
        leadName: 'Engr. David Santos (Project Staff)',
    },
    {
        id: 'comm-3',
        name: 'Documentation Committee',
        progress: 75,
        membersCount: 4,
        activitiesCount: 4,
        leadName: 'Ms. Katrina Gomez (Project Staff)',
    },
];

const MOCK_ACTIVITIES: ActivityItem[] = [
    {
        id: 'act-1',
        title: 'Project Staff updated Program Flow',
        committee: 'Program & Events Committee',
        actor: 'Prof. Althea Ramos',
        timeAgo: '2 hours ago',
        type: 'update',
    },
    {
        id: 'act-2',
        title: 'Project Member completed assigned task',
        committee: 'Technical Committee',
        actor: 'Juan Dela Cruz',
        timeAgo: '5 hours ago',
        type: 'task',
    },
    {
        id: 'act-3',
        title: 'Project Staff reviewed submitted activity',
        committee: 'Documentation Committee',
        actor: 'Ms. Katrina Gomez',
        timeAgo: 'Yesterday',
        type: 'review',
    },
];

const MOCK_DOCUMENTS: ProjectDocument[] = [
    {
        id: 'doc-1',
        title: 'Project Approval Document',
        type: 'PDF Document',
        status: 'Approved',
        updatedAt: 'October 02, 2026',
        size: '1.8 MB',
    },
    {
        id: 'doc-2',
        title: 'Approved Activity Design',
        type: 'PDF Document',
        status: 'Approved',
        updatedAt: 'October 05, 2026',
        size: '2.4 MB',
    },
    {
        id: 'doc-3',
        title: 'Project Memo',
        type: 'PDF Document',
        status: 'Verified',
        updatedAt: 'October 08, 2026',
        size: '540 KB',
    },
];

// ─── Status Badge Component ──────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-sky-50 text-sky-700 border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-sky-500" />
            <span>{status}</span>
        </span>
    );
}

// ─── Role Badge Component ────────────────────────────────────────────────────
function ProjectRoleBadge({ role }: { role: ProjectRole }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border bg-emerald-50/80 text-[color:var(--color-brand-dark-green)] border-emerald-300/60">
            <Shield className="w-3 h-3 text-[color:var(--color-brand-dark-green)]" />
            <span>{role}</span>
        </span>
    );
}

// ─── Main Project Detail Page Shell ───────────────────────────────────────────
export default function ProjectShow({ projectId: _projectId }: ProjectShowProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Informational placeholder notification for actions that will be implemented in later steps
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    const handleActionClick = (actionName: string) => {
        setActionNotice(
            `"${actionName}" will be available when project management is connected.`
        );
    };

    // Navigation Tabs Definition
    const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { key: 'overview', label: 'Overview', icon: FolderOpen },
        { key: 'committees', label: 'Committees', icon: Users },
        { key: 'activities', label: 'Activities', icon: ListTodo },
        { key: 'tasks', label: 'Tasks', icon: CheckSquare },
        { key: 'timeline', label: 'Timeline', icon: GanttChartSquare },
    ];

    return (
        <AppLayout
            title={MOCK_PROJECT.title}
            subtitle="Project Workspace & Hierarchy Overview"
            currentProject={{
                title: MOCK_PROJECT.title,
                role: MOCK_PROJECT.role,
                status: MOCK_PROJECT.status,
            }}
        >
            <Head title={`${MOCK_PROJECT.title} — ITASK`} />

            <div className="space-y-6">

                {/* ── Breadcrumb & Back Navigation ── */}
                <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 font-medium hover:text-[color:var(--color-brand-action-orange)] transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Projects</span>
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="font-semibold text-[color:var(--color-text-main)] truncate max-w-xs sm:max-w-md">
                        {MOCK_PROJECT.title}
                    </span>
                </div>

                {/* ── Action Notice Banner (Modal / Toast Alternative) ── */}
                {actionNotice && (
                    <div className="p-3.5 rounded-xl border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)] flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
                        <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-[color:var(--color-brand-action-orange)] shrink-0 mt-0.5" />
                            <p className="text-[color:var(--color-text-main)] font-medium leading-relaxed">
                                {actionNotice}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActionNotice(null)}
                            className="text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-main)] p-1 rounded-md hover:bg-white/60 transition-colors cursor-pointer shrink-0"
                            aria-label="Dismiss notice"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* ── Project Header Card ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        
                        {/* Left: Title, Description, and Badges */}
                        <div className="space-y-2.5 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                                <ProjectStatusBadge status={MOCK_PROJECT.status} />
                                <ProjectRoleBadge role={MOCK_PROJECT.role} />
                                <span className="text-xs text-[color:var(--color-text-muted)] flex items-center gap-1 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-[color:var(--color-text-subtle)]" />
                                    <span>Deadline: {MOCK_PROJECT.deadline}</span>
                                </span>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--color-text-main)] leading-snug">
                                {MOCK_PROJECT.title}
                            </h1>

                            <p className="text-xs sm:text-sm text-[color:var(--color-text-muted)] leading-relaxed">
                                {MOCK_PROJECT.description}
                            </p>
                        </div>

                        {/* Right: Project Actions Area (Visual Placeholders) */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
                            <button
                                type="button"
                                onClick={() => handleActionClick('Edit Project')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit project details (Placeholder)"
                            >
                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Edit Project</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleActionClick('Project Settings')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Project configuration & settings (Placeholder)"
                            >
                                <Settings className="w-3.5 h-3.5 text-slate-500" />
                                <span>Project Settings</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleActionClick('More Project Actions')}
                                className="p-2 rounded-lg text-[color:var(--color-text-muted)] hover:bg-slate-100 border border-[color:var(--color-border-light)] transition-colors cursor-pointer"
                                title="More options"
                                aria-label="More options"
                            >
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar inside Header Card */}
                    <div className="mt-6 pt-5 border-t border-[color:var(--color-border-light)]">
                        <div className="flex items-center justify-between text-xs mb-2">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-[color:var(--color-text-main)]">
                                    Project Progress
                                </span>
                                <span className="text-[11px] text-[color:var(--color-text-muted)]">
                                    (Aggregated across all committees)
                                </span>
                            </div>
                            <span className="font-extrabold text-[color:var(--color-brand-action-orange)]">
                                {MOCK_PROJECT.progress}% Complete
                            </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${MOCK_PROJECT.progress}%`,
                                    backgroundColor: 'var(--color-brand-action-orange)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Project Level Navigation (Tabs) ── */}
                <div className="border-b border-[color:var(--color-border-light)] overflow-x-auto scrollbar-none">
                    <nav className="flex space-x-1 sm:space-x-2" aria-label="Project tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all cursor-pointer ${
                                        isActive
                                            ? 'border-[color:var(--color-brand-action-orange)] text-[color:var(--color-brand-action-orange)] bg-white/50'
                                            : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)] hover:border-slate-300'
                                    }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-[color:var(--color-brand-action-orange)]' : 'text-slate-400'}`} />
                                    <span>{tab.label}</span>
                                    {tab.key === 'committees' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                            {MOCK_PROJECT.summary.committees}
                                        </span>
                                    )}
                                    {tab.key === 'activities' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                            {MOCK_PROJECT.summary.activities}
                                        </span>
                                    )}
                                    {tab.key === 'tasks' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                            {MOCK_PROJECT.summary.tasks}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* ── TAB 1: OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">

                        {/* 1. High-Level Project Information Metrics Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                            
                            {/* Metric 1: Project Progress */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                    Project Progress
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-[color:var(--color-text-main)] mt-1">
                                    {MOCK_PROJECT.progress}%
                                </p>
                                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${MOCK_PROJECT.progress}%`,
                                            backgroundColor: 'var(--color-brand-action-orange)',
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Metric 2: Committees */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                    Committees
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-[color:var(--color-text-main)] mt-1">
                                    {MOCK_PROJECT.summary.committees}
                                </p>
                                <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-1">
                                    Active groups
                                </p>
                            </div>

                            {/* Metric 3: Activities */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                    Activities
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-[color:var(--color-text-main)] mt-1">
                                    {MOCK_PROJECT.summary.activities}
                                </p>
                                <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-1">
                                    Planned & active
                                </p>
                            </div>

                            {/* Metric 4: Tasks */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                    Tasks
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-[color:var(--color-text-main)] mt-1">
                                    {MOCK_PROJECT.summary.tasks}
                                </p>
                                <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-1">
                                    Assigned items
                                </p>
                            </div>

                            {/* Metric 5: Deadline */}
                            <div className="col-span-2 sm:col-span-1 bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                    Deadline
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-[color:var(--color-text-main)] mt-1 leading-snug">
                                    Oct 18, 2026
                                </p>
                                <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-1">
                                    Target conclusion
                                </p>
                            </div>
                        </div>

                        {/* 2. Project Workflow Visualization (Hierarchy) */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="mb-3">
                                <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                    Project Workflow Hierarchy
                                </h3>
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                    Structure governing coordination, committee deliverables, and task execution
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                                
                                {/* Step 1: Project */}
                                <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/40 relative">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--color-brand-dark-green)]">
                                            Tier 1 · Scope
                                        </span>
                                        <FolderOpen className="w-4 h-4 text-[color:var(--color-brand-dark-green)]" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900">Project</h4>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                        Governing project charter, objectives, and leadership oversight.
                                    </p>
                                </div>

                                {/* Step 2: Committees */}
                                <div className="p-3.5 rounded-lg border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)]/60 relative">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--color-brand-action-orange)]">
                                            Tier 2 · Organization
                                        </span>
                                        <Users className="w-4 h-4 text-[color:var(--color-brand-action-orange)]" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900">Committees</h4>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                        Functional working teams headed by assigned Project Staff.
                                    </p>
                                </div>

                                {/* Step 3: Activities */}
                                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 relative">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                                            Tier 3 · Deliverables
                                        </span>
                                        <ListTodo className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900">Activities</h4>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                        Events and milestones requiring submission and staff review.
                                    </p>
                                </div>

                                {/* Step 4: Tasks */}
                                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 relative">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                                            Tier 4 · Execution
                                        </span>
                                        <CheckSquare className="w-4 h-4 text-slate-600" />
                                    </div>
                                    <h4 className="text-xs font-bold text-slate-900">Tasks</h4>
                                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                        Actionable member work items, deadlines, and progress logs.
                                    </p>
                                </div>

                            </div>
                        </div>

                        {/* 3. Two-Column Layout: Committee Preview + Recent Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Left (2 cols): Committee Preview */}
                            <div className="lg:col-span-2 bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                            Committee Progress Preview
                                        </h3>
                                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                            Active functional committees assigned under this project
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('committees')}
                                        className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>View All</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {MOCK_COMMITTEES.map((committee) => (
                                        <div
                                            key={committee.id}
                                            className="p-4 rounded-lg border border-[color:var(--color-border-light)] hover:border-slate-300 transition-colors bg-white space-y-2.5"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                                <div>
                                                    <h4 className="text-xs font-bold text-[color:var(--color-text-main)]">
                                                        {committee.name}
                                                    </h4>
                                                    <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                        Led by {committee.leadName}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[11px] font-semibold text-[color:var(--color-text-muted)]">
                                                        {committee.membersCount} members · {committee.activitiesCount} activities
                                                    </span>
                                                    <span className="text-xs font-bold text-[color:var(--color-brand-dark-green)] min-w-[36px] text-right">
                                                        {committee.progress}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{
                                                        width: `${committee.progress}%`,
                                                        backgroundColor: 'var(--color-brand-dark-green)',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right (1 col): Recent Project Activity */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                        Recent Activity
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Latest activity across committee workflows
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {MOCK_ACTIVITIES.map((activity, index) => (
                                        <div key={activity.id} className="relative flex items-start gap-3">
                                            {/* Step dot and line */}
                                            <div className="flex flex-col items-center">
                                                <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0">
                                                    <Clock className="w-3.5 h-3.5" />
                                                </div>
                                                {index < MOCK_ACTIVITIES.length - 1 && (
                                                    <div className="w-px h-8 bg-slate-200 mt-1" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <p className="text-xs font-semibold text-[color:var(--color-text-main)] leading-snug">
                                                    {activity.title}
                                                </p>
                                                <p className="text-[11px] text-[color:var(--color-text-muted)] truncate mt-0.5">
                                                    {activity.actor} · {activity.committee}
                                                </p>
                                                <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                    {activity.timeAgo}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 4. Project Supporting & Approval Documents Section */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                        Project Supporting & Approval Documents
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Official project memo, activity designs, and dean approvals
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleActionClick('Upload Supporting Document')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer self-start sm:self-auto"
                                >
                                    <span>+ Attach Document</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                {MOCK_DOCUMENTS.map((doc) => (
                                    <div
                                        key={doc.id}
                                        onClick={() => handleActionClick(`View Document: ${doc.title}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleActionClick(`View Document: ${doc.title}`);
                                        }}
                                        className="p-3.5 rounded-lg border border-[color:var(--color-border-light)] hover:border-[color:var(--color-brand-action-orange)] transition-colors bg-white cursor-pointer group flex items-start gap-3"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0 group-hover:bg-orange-100 transition-colors">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-[color:var(--color-text-main)] truncate group-hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                                {doc.title}
                                            </p>
                                            <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                {doc.type} · {doc.size}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-2">
                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    {doc.status}
                                                </span>
                                                <span className="text-[10px] text-[color:var(--color-text-subtle)]">
                                                    {doc.updatedAt}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}

                {/* ── TAB 2: COMMITTEES PLACEHOLDER ── */}
                {activeTab === 'committees' && (
                    <div className="space-y-5">
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                                <div>
                                    <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                        Project Committees
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Form functional committees, designate staff leads, and assign working groups
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleActionClick('Create Committee')}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer self-start sm:self-auto shadow-xs"
                                >
                                    <span>+ Add Committee</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {MOCK_COMMITTEES.map((committee) => (
                                    <div
                                        key={committee.id}
                                        className="p-5 rounded-xl border border-[color:var(--color-border-light)] bg-white space-y-3 shadow-xs hover:border-slate-300 transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                Committee
                                            </span>
                                            <span className="text-xs font-bold text-[color:var(--color-brand-dark-green)]">
                                                {committee.progress}%
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                            {committee.name}
                                        </h4>
                                        <p className="text-xs text-[color:var(--color-text-muted)]">
                                            {committee.leadName}
                                        </p>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${committee.progress}%`,
                                                    backgroundColor: 'var(--color-brand-dark-green)',
                                                }}
                                            />
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-[color:var(--color-text-subtle)]">
                                            <span>{committee.membersCount} members</span>
                                            <span>{committee.activitiesCount} activities</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Informative Shell Note */}
                            <div className="mt-6 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                                <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800">
                                    Committee Management Placeholder
                                </h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                    Detailed committee member management, staff assignments, and committee deliverable tracking will appear here in subsequent development steps.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: ACTIVITIES PLACEHOLDER ── */}
                {activeTab === 'activities' && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                    Project Activities
                                </h3>
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                    Planned events, submissions, and Project Staff approval workflow
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleActionClick('Create Activity')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer self-start sm:self-auto shadow-xs"
                            >
                                <span>+ New Activity</span>
                            </button>
                        </div>

                        {/* Activities Table Preview Placeholder */}
                        <div className="border border-[color:var(--color-border-light)] rounded-xl overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-[color:var(--color-border-light)] text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">Activity</th>
                                        <th className="px-4 py-3 hidden sm:table-cell">Committee</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 hidden md:table-cell">Timeline</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--color-border-light)] text-[color:var(--color-text-main)]">
                                    <tr>
                                        <td className="px-4 py-3 font-semibold">Keynote Speaker Invitation & Confirmation</td>
                                        <td className="px-4 py-3 hidden sm:table-cell text-slate-500">Program & Events Committee</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Approved
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-slate-500">Oct 01 - Oct 10</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-semibold">Stage & Audio-Visual System Rehearsal</td>
                                        <td className="px-4 py-3 hidden sm:table-cell text-slate-500">Technical Committee</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                                Under Review
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-slate-500">Oct 11 - Oct 15</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-semibold">Student Attendance & Registration Verification</td>
                                        <td className="px-4 py-3 hidden sm:table-cell text-slate-500">Documentation Committee</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                Pending Submission
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell text-slate-500">Oct 16 - Oct 18</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                            <ListTodo className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                            <h4 className="text-xs font-bold text-slate-800">
                                Activity Workflow Placeholder
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                Activities assigned to this project and their respective committee approval pipelines will be managed here.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── TAB 4: TASKS PLACEHOLDER ── */}
                {activeTab === 'tasks' && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                    Project Tasks
                                </h3>
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                    Operational member assignments and status tracking
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleActionClick('Create Task')}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer self-start sm:self-auto shadow-xs"
                            >
                                <span>+ New Task</span>
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {[
                                { title: 'Draft opening program script and welcoming remarks', committee: 'Program & Events', assignee: 'Member: Sarah Chen', status: 'Completed' },
                                { title: 'Test gym PA audio amplifiers and wireless lapel mics', committee: 'Technical', assignee: 'Member: Juan Dela Cruz', status: 'In Progress' },
                                { title: 'Prepare print certificate templates for attending students', committee: 'Documentation', assignee: 'Member: Mark Bryan', status: 'Pending' },
                            ].map((task, i) => (
                                <div
                                    key={i}
                                    className="p-3.5 rounded-lg border border-[color:var(--color-border-light)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                                >
                                    <div>
                                        <p className="text-xs font-semibold text-[color:var(--color-text-main)]">
                                            {task.title}
                                        </p>
                                        <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                            {task.committee} · Assigned to {task.assignee}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
                                        {task.status}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                            <CheckSquare className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                            <h4 className="text-xs font-bold text-slate-800">
                                Task Management Placeholder
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                Tasks associated with this project and individual member deliverables will appear here.
                            </p>
                        </div>
                    </div>
                )}

                {/* ── TAB 5: TIMELINE PLACEHOLDER ── */}
                {activeTab === 'timeline' && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                        <div>
                            <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                Project Timeline & Schedule
                            </h3>
                            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                Cascading schedule monitoring through Committee → Activity → Task
                            </p>
                        </div>

                        {/* Visual Timeline Roadmap Preview */}
                        <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span>September 2026</span>
                                <span>October 2026 (Target Conclusion)</span>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-[11px] mb-1">
                                        <span className="font-semibold text-slate-800">Program & Events Committee Milestone</span>
                                        <span className="text-slate-500">Sep 01 - Oct 18</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-[color:var(--color-brand-dark-green)] rounded-full" style={{ width: '68%' }} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-[11px] mb-1">
                                        <span className="font-semibold text-slate-800">Technical Committee Audio-Visual Readiness</span>
                                        <span className="text-slate-500">Sep 15 - Oct 15</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-[color:var(--color-brand-action-orange)] rounded-full" style={{ width: '42%' }} />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-[11px] mb-1">
                                        <span className="font-semibold text-slate-800">Documentation & Attendance Collation</span>
                                        <span className="text-slate-500">Oct 01 - Oct 18</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: '75%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                            <GanttChartSquare className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                            <h4 className="text-xs font-bold text-slate-800">
                                Interactive Gantt & Timeline Engine Placeholder
                            </h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                Project progress will be monitored through Committee → Activity → Task deadlines and milestones. The interactive Gantt chart calculation will be implemented in a dedicated upcoming step.
                            </p>
                        </div>
                    </div>
                )}

            </div>
        </AppLayout>
    );
}
