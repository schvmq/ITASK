import React, { useState, useMemo, useRef } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import {
    FolderOpen,
    Plus,
    Search,
    Calendar,
    Users,
    CheckCircle2,
    Clock,
    AlertTriangle,
    RotateCcw,
    Layers,
    ArrowUpRight,
    Info,
    X,
    Filter,
    FileText,
} from 'lucide-react';
import { Skeleton } from '@/Components/ui/skeleton';

// ─── Status Types & Semantic Color Configurations ─────────────────────────────
// Project statuses are kept visually distinct from task/activity status.
// Brand orange and semantic status colors remain strictly separate.
// NO purple/indigo is used anywhere.

export type ProjectStatus = 'Planning' | 'In Progress' | 'Active' | 'Completed' | 'On Hold' | 'Archived';

interface StatusConfig {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
}

const STATUS_CONFIGS: Record<ProjectStatus, StatusConfig> = {
    Planning: {
        label: 'Planning',
        bgClass: 'bg-slate-50',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-200',
        dotClass: 'bg-slate-400',
    },
    'In Progress': {
        label: 'In Progress',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-700',
        borderClass: 'border-sky-200',
        dotClass: 'bg-sky-500',
    },
    Active: {
        label: 'Active',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
    },
    Completed: {
        label: 'Completed',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
    },
    'On Hold': {
        label: 'On Hold',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
    },
    Archived: {
        label: 'Archived',
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-600',
        borderClass: 'border-slate-300',
        dotClass: 'bg-slate-500',
    },
};

// ─── Role Badge Configurations ────────────────────────────────────────────────
// The 3 project-scoped roles: Project Leader, Project Staff, Project Member
interface RoleConfig {
    bgClass: string;
    textClass: string;
    borderClass: string;
}

const ROLE_CONFIGS: Record<ProjectRole, RoleConfig> = {
    'Project Leader': {
        bgClass: 'bg-emerald-50/80',
        textClass: 'text-[color:var(--color-brand-dark-green)]',
        borderClass: 'border-emerald-300/60',
    },
    'Project Staff': {
        bgClass: 'bg-[color:var(--color-brand-active-warm-orange)]',
        textClass: 'text-[color:var(--color-brand-action-orange)]',
        borderClass: 'border-orange-200',
    },
    'Project Member': {
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-700',
        borderClass: 'border-slate-300/70',
    },
};

// ─── Project Item Data Model (Placeholder / Frontend Shell) ───────────────────
export interface ProjectItem {
    id: string;
    title: string;
    description: string;
    status: ProjectStatus;
    role: ProjectRole;
    progress: number;
    deadline: string;
    committeesCount: number;
    tasksCount: number;
}

// Realistic CCIS mock projects for frontend shell presentation
const SAMPLE_PROJECTS: ProjectItem[] = [
    {
        id: 'proj-1',
        title: 'CCIS General Assembly 2026',
        description:
            'Annual college assembly welcoming new and returning CCIS students, faculty introductions, and program orientation.',
        status: 'In Progress',
        role: 'Project Leader',
        progress: 68,
        deadline: 'October 18, 2026',
        committeesCount: 4,
        tasksCount: 24,
    },
    {
        id: 'proj-2',
        title: 'CCIS Technology Week',
        description:
            'Multi-day series of tech talks, programming hackathons, and industry showcase for computing students.',
        status: 'Planning',
        role: 'Project Staff',
        progress: 25,
        deadline: 'November 24, 2026',
        committeesCount: 5,
        tasksCount: 18,
    },
    {
        id: 'proj-3',
        title: 'CCIS Research Colloquium 2026',
        description:
            'Presentation of undergraduate capstone and faculty research papers with peer review and evaluations.',
        status: 'Completed',
        role: 'Project Member',
        progress: 100,
        deadline: 'September 15, 2026',
        committeesCount: 3,
        tasksCount: 16,
    },
    {
        id: 'proj-4',
        title: 'Accreditation Documentation Drive',
        description:
            'Curating and preparing CCIS academic and operational records for Level III accreditation survey.',
        status: 'On Hold',
        role: 'Project Staff',
        progress: 42,
        deadline: 'December 12, 2026',
        committeesCount: 2,
        tasksCount: 9,
    },
];

// ─── Status Badge Component ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: ProjectStatus }) {
    const config = STATUS_CONFIGS[status] ?? STATUS_CONFIGS.Planning;
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
            <span>{config.label}</span>
        </span>
    );
}

// ─── Role Badge Component ────────────────────────────────────────────────────
function RoleBadge({ role }: { role: ProjectRole }) {
    const config = ROLE_CONFIGS[role] ?? ROLE_CONFIGS['Project Member'];
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
        >
            {role}
        </span>
    );
}

// ─── Project Card Component ──────────────────────────────────────────────────
interface ProjectCardProps {
    project: ProjectItem;
    onSelect: (project: ProjectItem) => void;
}

function ProjectCard({ project, onSelect }: ProjectCardProps) {
    const isCompleted = project.status === 'Completed';

    return (
        <div
            onClick={() => onSelect(project)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(project);
                }
            }}
            className="group relative bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:shadow-md hover:border-[color:var(--color-brand-action-orange)]/50 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
            {/* Top row: Role + Status */}
            <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                    <RoleBadge role={project.role} />
                    <StatusBadge status={project.status} />
                </div>

                {/* Project Title */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors leading-snug line-clamp-1">
                        {project.title}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors shrink-0 mt-0.5" />
                </div>

                {/* Description */}
                <p className="text-xs text-[color:var(--color-text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {project.description}
                </p>
            </div>

            {/* Middle: Progress bar */}
            <div className="mt-5 pt-4 border-t border-[color:var(--color-border-light)]">
                <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                        Progress
                    </span>
                    <span className="text-xs font-bold text-[color:var(--color-text-main)]">
                        {project.progress}%
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${project.progress}%`,
                            backgroundColor: isCompleted
                                ? '#10b981'
                                : 'var(--color-brand-action-orange)',
                        }}
                    />
                </div>
            </div>

            {/* Bottom metadata row */}
            <div className="mt-4 flex items-center justify-between text-[11px] text-[color:var(--color-text-subtle)]">
                <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{project.deadline}</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span>{project.committeesCount} Committees</span>
                </div>
            </div>
        </div>
    );
}

// ─── Loading Skeleton Grid ───────────────────────────────────────────────────
function ProjectsLoadingSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3].map((key) => (
                <div
                    key={key}
                    className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-3.5 w-16" />
                            <Skeleton className="h-3.5 w-8" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <div className="flex justify-between pt-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3.5 w-24" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Error State Component ───────────────────────────────────────────────────
function ProjectsErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 rounded-xl border border-rose-200 bg-rose-50/50 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
                <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-rose-900">Unable to load projects</h3>
            <p className="text-xs text-rose-700 max-w-sm mt-1 mb-5 leading-relaxed">
                There was a problem communicating with the ITASK project service. Please check
                your connection and try again.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
            >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
            </button>
        </div>
    );
}

// ─── Empty State Component ───────────────────────────────────────────────────
interface ProjectsEmptyStateProps {
    isFiltered: boolean;
    onResetFilters?: () => void;
    onCreateClick?: () => void;
}

function ProjectsEmptyState({
    isFiltered,
    onResetFilters,
    onCreateClick,
}: ProjectsEmptyStateProps) {
    if (isFiltered) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-[color:var(--color-border-dark)] bg-[color:var(--color-surface-subtle)]">
                <div className="w-12 h-12 rounded-xl bg-white border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-xs">
                    <Search className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[color:var(--color-text-main)]">
                    No matching projects found
                </h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-4 leading-relaxed">
                    No projects match the specified search term or filters. Try adjusting your
                    keywords or resetting the filter options.
                </p>
                {onResetFilters && (
                    <button
                        type="button"
                        onClick={onResetFilters}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-dark-green)] bg-[color:var(--color-brand-active-warm-orange)] hover:bg-orange-100 transition-colors cursor-pointer border border-orange-200"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Clear Filters
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border border-dashed border-[color:var(--color-border-dark)] bg-white">
            <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-xs">
                <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-[color:var(--color-text-main)]">
                No projects yet
            </h4>
            <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-5 leading-relaxed">
                Projects where you are assigned a role will appear here.
            </p>
            {onCreateClick && (
                <button
                    type="button"
                    onClick={onCreateClick}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                    style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                >
                    <Plus className="w-4 h-4" />
                    + Create Project
                </button>
            )}
        </div>
    );
}

interface ProjectsIndexProps {
    projects?: ProjectItem[];
}

// ─── Main Projects Page Component ─────────────────────────────────────────────
export default function ProjectsIndex({ projects = [] }: ProjectsIndexProps) {
    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');

    // Interactive Demo / Testing state toggles (allows reviewing all states on demand)
    const [simulatedState, setSimulatedState] = useState<'normal' | 'loading' | 'error' | 'empty'>(
        'normal'
    );

    // Modal / Notice feedback state
    const [activeNotice, setActiveNotice] = useState<{
        title: string;
        message: string;
    } | null>(null);

    // Modal state for project creation
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Inertia form handling for project creation
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm<{
        title: string;
        description: string;
        start_date: string;
        end_date: string;
        approval_document: File | null;
    }>({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        approval_document: null,
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setData('approval_document', file);
    };

    const handleRemoveFile = () => {
        setData('approval_document', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleOpenCreateModal = () => {
        clearErrors();
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        reset();
        clearErrors();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCreateProjectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/projects', {
            forceFormData: true,
            onSuccess: () => {
                handleCloseCreateModal();
            },
        });
    };

    // Client-side filtering logic against backend projects or sample demo projects
    const baseProjects = projects.length > 0 ? projects : SAMPLE_PROJECTS;

    const filteredProjects = useMemo(() => {
        if (simulatedState === 'empty') return [];

        return baseProjects.filter((project) => {
            const matchesSearch =
                searchTerm.trim() === '' ||
                project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                project.description.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'ALL' || project.status === statusFilter;

            const matchesRole =
                roleFilter === 'ALL' || project.role === roleFilter;

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [baseProjects, searchTerm, statusFilter, roleFilter, simulatedState]);

    const isFiltered =
        searchTerm.trim() !== '' || statusFilter !== 'ALL' || roleFilter !== 'ALL';

    const handleResetFilters = () => {
        setSearchTerm('');
        setStatusFilter('ALL');
        setRoleFilter('ALL');
    };

    const handleProjectCardSelect = (project: ProjectItem) => {
        router.visit(`/projects/${project.id}`);
    };

    // Header Action Button: + Create Project
    const createProjectButton = (
        <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-all duration-150 cursor-pointer hover:opacity-95 active:scale-98"
            style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
            title="Create a new CCIS project"
        >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={2.4} />
            <span>+ Create Project</span>
        </button>
    );

    return (
        <AppLayout
            title="Projects"
            subtitle="CCIS projects where you hold an active role"
            headerAction={createProjectButton}
        >
            <Head title="Projects — ITASK" />

            <div className="space-y-6">

                {/* ── Notice Banner Modal / Alert ── */}
                {activeNotice && (
                    <div className="p-4 rounded-xl border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)]/60 flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
                        <div className="flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-[color:var(--color-brand-action-orange)] shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-[color:var(--color-brand-dark-green)]">
                                    {activeNotice.title}
                                </p>
                                <p className="text-[color:var(--color-text-muted)] mt-0.5 leading-relaxed">
                                    {activeNotice.message}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveNotice(null)}
                            className="text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-main)] p-1 rounded-md hover:bg-white/60 transition-colors cursor-pointer shrink-0"
                            aria-label="Close notification"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* ── Search and Filter Toolbar ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
                    
                    {/* Search Projects input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search projects by title or description…"
                            className="w-full pl-9 pr-8 py-2 text-xs text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] rounded-lg border border-[color:var(--color-border-light)] placeholder:text-slate-400 focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] focus:ring-2 focus:ring-[color:var(--color-brand-action-orange)]/20 transition-all"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Controls Row */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        
                        {/* Status Filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-[color:var(--color-text-muted)] hidden md:inline">
                                Status:
                            </span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="h-8 px-2.5 text-xs text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] rounded-lg focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] cursor-pointer"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="Planning">Planning</option>
                                <option value="Active">Active</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>

                        {/* Role Filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-[color:var(--color-text-muted)] hidden md:inline">
                                Role:
                            </span>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="h-8 px-2.5 text-xs text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] rounded-lg focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] cursor-pointer"
                            >
                                <option value="ALL">All Roles</option>
                                <option value="Project Leader">Project Leader</option>
                                <option value="Project Staff">Project Staff</option>
                                <option value="Project Member">Project Member</option>
                            </select>
                        </div>

                        {/* Reset Filter Button (visible when filters are active) */}
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="h-8 px-2.5 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Reset all search filters"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span className="hidden sm:inline">Reset</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Content Area: Dynamic based on simulated state or filters ── */}
                {simulatedState === 'loading' ? (
                    <ProjectsLoadingSkeleton />
                ) : simulatedState === 'error' ? (
                    <ProjectsErrorState onRetry={() => setSimulatedState('normal')} />
                ) : filteredProjects.length === 0 ? (
                    <ProjectsEmptyState
                        isFiltered={isFiltered}
                        onResetFilters={handleResetFilters}
                        onCreateClick={handleOpenCreateModal}
                    />
                ) : (
                    <div>
                        {/* Projects counter & context summary */}
                        <div className="flex items-center justify-between mb-4 px-1">
                            <p className="text-xs text-[color:var(--color-text-muted)]">
                                Showing{' '}
                                <span className="font-bold text-[color:var(--color-text-main)]">
                                    {filteredProjects.length}
                                </span>{' '}
                                {filteredProjects.length === 1 ? 'project' : 'projects'}
                            </p>
                            <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                                Click any project card to preview context
                            </p>
                        </div>

                        {/* Projects Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            {filteredProjects.map((project) => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onSelect={handleProjectCardSelect}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Create Project Modal ── */}
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseCreateModal}
                    title="Create New Project"
                    description="Initiate a new CCIS project workspace. As the creator, you will automatically be assigned as Project Leader."
                    maxWidth="md"
                >
                    <form onSubmit={handleCreateProjectSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Project Title"
                            id="create-project-title"
                            name="title"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            error={errors.title}
                            required
                            placeholder="e.g., CCIS General Assembly 2026"
                            autoFocus
                        />

                        <div className="space-y-1">
                            <Label htmlFor="create-project-description">Description</Label>
                            <textarea
                                id="create-project-description"
                                name="description"
                                rows={3}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Brief project charter, scope, or background..."
                            />
                            <InputError message={errors.description} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                label="Start Date"
                                id="create-project-start-date"
                                type="date"
                                value={data.start_date}
                                onChange={(e) => setData('start_date', e.target.value)}
                                error={errors.start_date}
                            />

                            <FormField
                                label="End Date"
                                id="create-project-end-date"
                                type="date"
                                value={data.end_date}
                                onChange={(e) => setData('end_date', e.target.value)}
                                error={errors.end_date}
                                helperText="Target conclusion date"
                            />
                        </div>

                        {/* Approval / Supporting Document Upload */}
                        <div className="space-y-1.5">
                            <Label htmlFor="create-project-document" required>
                                Approval / Supporting Document
                            </Label>
                            <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                {data.approval_document ? (
                                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-md border border-slate-200">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="w-4 h-4 text-[color:var(--color-brand-action-orange)] shrink-0" />
                                            <span className="text-xs font-medium text-slate-800 truncate">
                                                {data.approval_document.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                ({(data.approval_document.size / 1024).toFixed(0)} KB)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold shrink-0 cursor-pointer p-1"
                                            title="Remove selected file"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-2 text-center">
                                        <input
                                            ref={fileInputRef}
                                            id="create-project-document"
                                            name="approval_document"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="create-project-document"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Attach Official Document</span>
                                        </label>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Approved memo, activity design, or letter (PDF, Word, Image · max 10MB)
                                        </p>
                                    </div>
                                )}
                            </div>
                            <InputError message={errors.approval_document} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseCreateModal}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={processing}
                                disabled={processing}
                            >
                                Create Project
                            </Button>
                        </div>
                    </form>
                </Modal>

            </div>
        </AppLayout>
    );
}
