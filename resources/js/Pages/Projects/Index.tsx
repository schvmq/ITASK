import React, { useState, useMemo, useRef } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import {
    FolderOpen,
    Plus,
    Search,
    Calendar,
    AlertTriangle,
    RotateCcw,
    ArrowUpRight,
    ChevronRight,
    Info,
    X,
    FileText,
    LayoutGrid,
    List,
    Archive,
} from 'lucide-react';
import { Skeleton } from '@/Components/ui/skeleton';

// ─── Project Item Data Model ────────────────────────────────────────────────
export interface ProjectItem {
    id: string;
    title: string;
    description: string;
    status: string;
    role: ProjectRole;
    progress: number;
    deadline: string;
    startDate?: string | null;
    committeesCount: number;
    tasksCount: number;
}

// ─── Project Card Component ──────────────────────────────────────────────────
// Only displays: Project Name, Your Role, Progress, Deadline, and Open action.
interface ProjectCardProps {
    project: ProjectItem;
    onSelect: (project: ProjectItem) => void;
}

function ProjectCard({ project, onSelect }: ProjectCardProps) {
    const isCompletedOrArchived =
        project.status === 'Completed' ||
        project.status === 'Archived' ||
        project.progress === 100;

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
            className="group relative bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:shadow-md hover:border-[color:var(--color-brand-action-orange)]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
            {/* Top row: Role */}
            <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                    <ProjectRoleBadge role={project.role} />
                </div>

                {/* Project Title */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors leading-snug line-clamp-2">
                        {project.title}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[color:var(--color-brand-action-orange)] transition-colors shrink-0 mt-0.5" />
                </div>
            </div>

            <div>
                {/* Progress bar */}
                <div className="mt-5 pt-3.5 border-t border-[color:var(--color-border-light)]">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
                            Progress
                        </span>
                        <span className="text-xs font-bold text-[color:var(--color-text-main)]">
                            {project.progress}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${project.progress}%`,
                                backgroundColor: isCompletedOrArchived
                                    ? '#10b981'
                                    : 'var(--color-brand-action-orange)',
                            }}
                        />
                    </div>
                </div>

                {/* Bottom row: Deadline & Open action */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[color:var(--color-text-subtle)]">
                    <div className="flex items-center gap-1.5" title={`Deadline: ${project.deadline}`}>
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate text-slate-600 font-medium">
                            {project.deadline}
                        </span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--color-brand-action-orange)] group-hover:translate-x-0.5 transition-transform shrink-0">
                        <span>Open</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Project List Component ──────────────────────────────────────────────────
// Only displays columns: Project Name, Your Role, Progress, Deadline, Action.
interface ProjectListProps {
    projects: ProjectItem[];
    onSelect: (project: ProjectItem) => void;
}

function ProjectList({ projects, onSelect }: ProjectListProps) {
    return (
        <div className="w-full bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                        <tr className="border-b border-[color:var(--color-border-light)] bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-5 py-3">Project Name</th>
                            <th className="px-4 py-3">Your Role</th>
                            <th className="px-4 py-3">Progress</th>
                            <th className="px-4 py-3">Deadline</th>
                            <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                        {projects.map((project) => {
                            const isCompletedOrArchived =
                                project.status === 'Completed' ||
                                project.status === 'Archived' ||
                                project.progress === 100;
                            return (
                                <tr
                                    key={project.id}
                                    onClick={() => onSelect(project)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onSelect(project);
                                        }
                                    }}
                                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                                >
                                    {/* Project Name */}
                                    <td className="px-5 py-3.5 max-w-sm">
                                        <div className="font-semibold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                            {project.title}
                                        </div>
                                    </td>

                                    {/* Your Role */}
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <ProjectRoleBadge role={project.role} />
                                    </td>

                                    {/* Progress */}
                                    <td className="px-4 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{
                                                        width: `${project.progress}%`,
                                                        backgroundColor: isCompletedOrArchived
                                                            ? '#10b981'
                                                            : 'var(--color-brand-action-orange)',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-700 w-8">
                                                {project.progress}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Deadline */}
                                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                                        <div className="flex items-center gap-1.5 text-[11px]">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="font-medium">{project.deadline}</span>
                                        </div>
                                    </td>

                                    {/* Action */}
                                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-[color:var(--color-brand-action-orange)] group-hover:bg-orange-50/80 transition-colors">
                                            <span>Open</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
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
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-3.5 w-16" />
                            <Skeleton className="h-3.5 w-8" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <div className="flex justify-between pt-2">
                        <Skeleton className="h-3.5 w-28" />
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
    activeTab: 'ongoing' | 'archived';
    isFiltered: boolean;
    searchTerm: string;
    onResetFilters?: () => void;
    onCreateClick?: () => void;
}

function ProjectsEmptyState({
    activeTab,
    isFiltered,
    searchTerm,
    onResetFilters,
    onCreateClick,
}: ProjectsEmptyStateProps) {
    if (isFiltered) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl border border-dashed border-[color:var(--color-border-dark)] bg-[color:var(--color-surface-subtle)]">
                <div className="w-12 h-12 rounded-xl bg-white border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-xs">
                    <Search className="w-5 h-5 text-slate-400" />
                </div>
                <h4 className="text-base font-semibold text-[color:var(--color-text-main)]">
                    No matching projects found
                </h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-4 leading-relaxed">
                    {searchTerm ? (
                        <>
                            No {activeTab === 'archived' ? 'archived' : 'ongoing'} projects match the search query{' '}
                            <span className="font-semibold text-slate-700">"{searchTerm}"</span> or selected role filter.
                        </>
                    ) : (
                        `No ${activeTab === 'archived' ? 'archived' : 'ongoing'} projects match the selected filter criteria.`
                    )}
                </p>
                {onResetFilters && (
                    <button
                        type="button"
                        onClick={onResetFilters}
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-dark-green)] bg-[color:var(--color-brand-active-warm-orange)] hover:bg-orange-100 transition-colors cursor-pointer border border-orange-200"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Filters</span>
                    </button>
                )}
            </div>
        );
    }

    if (activeTab === 'archived') {
        return (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-white">
                <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-3 shadow-xs">
                    <Archive className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[color:var(--color-text-main)]">
                    No archived projects
                </h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 leading-relaxed">
                    Completed and archived projects will appear here for historical records.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-white">
            <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-xs">
                <FolderOpen className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="text-base font-bold text-[color:var(--color-text-main)]">
                No ongoing projects
            </h4>
            <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-5 leading-relaxed">
                You do not have any ongoing projects. Start a new project to get underway.
            </p>
            {onCreateClick && (
                <button
                    type="button"
                    onClick={onCreateClick}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer hover:opacity-95"
                    style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                >
                    <Plus className="w-4 h-4" />
                    <span>+ Create Project</span>
                </button>
            )}
        </div>
    );
}

interface ProjectsIndexProps {
    projects: ProjectItem[];
}

// ─── Main Projects Page Component ─────────────────────────────────────────────
export default function ProjectsIndex({ projects }: ProjectsIndexProps) {
    // Top-level organization:
    // 1. "My Projects" (ongoing) - all non-archived, non-completed projects
    // 2. "Archived" - completed and archived projects
    const [activeTab, setActiveTab] = useState<'ongoing' | 'archived'>('ongoing');

    // View mode state (Card vs List)
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');

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
        if (processing) return;
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
        if (processing) return;
        setIsCreateModalOpen(false);
        reset();
        clearErrors();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCreateProjectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;
        post('/projects', {
            forceFormData: true,
            onSuccess: () => {
                handleCloseCreateModal();
            },
        });
    };

    // Calculate counts for the two primary categories: My Projects (ongoing) and Archived (completed/archived)
    const ongoingCount = useMemo(() => {
        return projects.filter(
            (p) => p.status !== 'Archived' && p.status !== 'Completed'
        ).length;
    }, [projects]);

    const archivedCount = useMemo(() => {
        return projects.filter(
            (p) => p.status === 'Archived' || p.status === 'Completed'
        ).length;
    }, [projects]);

    const tabs: { key: 'ongoing' | 'archived'; label: string; count: number }[] = [
        { key: 'ongoing', label: 'My Projects', count: ongoingCount },
        { key: 'archived', label: 'Archived', count: archivedCount },
    ];

    // Client-side filtering of projects
    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            const isArchivedOrCompleted =
                project.status === 'Archived' || project.status === 'Completed';

            // Tab filter:
            // "ongoing" = all ongoing / non-archived projects
            // "archived" = completed & archived projects
            if (activeTab === 'ongoing' && isArchivedOrCompleted) {
                return false;
            }
            if (activeTab === 'archived' && !isArchivedOrCompleted) {
                return false;
            }

            // Search Term
            if (searchTerm.trim() !== '') {
                const query = searchTerm.toLowerCase();
                const matchesTitle = project.title.toLowerCase().includes(query);
                const matchesDesc = (project.description || '').toLowerCase().includes(query);
                if (!matchesTitle && !matchesDesc) return false;
            }

            // Role Filter
            if (roleFilter !== 'ALL' && project.role !== roleFilter) {
                return false;
            }

            return true;
        });
    }, [projects, activeTab, searchTerm, roleFilter]);

    const isFiltered = searchTerm.trim() !== '' || roleFilter !== 'ALL';

    const handleResetFilters = () => {
        setSearchTerm('');
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
            title="My Projects"
            subtitle={`${projects.length} total ${projects.length === 1 ? 'project' : 'projects'}`}
            headerAction={createProjectButton}
        >
            <Head title="My Projects — ITASK" />

            <div className="space-y-5">

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

                {/* ── Search and Filter Controls Toolbar ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-3.5 sm:p-4 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-3.5">
                    
                    {/* Primary Organization Tabs: My Projects vs Archived */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none border-b border-[color:var(--color-border-light)]">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors border-b-2 -mb-[1px] ${
                                        isActive
                                            ? 'border-[color:var(--color-brand-action-orange)] text-[color:var(--color-brand-dark-green)]'
                                            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-[color:var(--color-brand-active-warm-orange)] text-[color:var(--color-brand-action-orange)]'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search & Role Filter & View Switcher Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-0.5">
                        
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

                        {/* Filter Controls + View Switcher */}
                        <div className="flex flex-wrap items-center gap-2.5 justify-between sm:justify-end">
                            
                            <div className="flex items-center gap-2">
                                {/* Role Filter */}
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="h-8 px-2.5 text-xs text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] rounded-lg focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] cursor-pointer"
                                        aria-label="Filter by your role"
                                    >
                                        <option value="ALL">All Roles</option>
                                        <option value="Project Leader">Project Leader</option>
                                        <option value="Project Staff">Project Staff</option>
                                        <option value="Project Member">Project Member</option>
                                    </select>
                                </div>
                            </div>

                            {/* View Switcher: Cards vs List */}
                            <div className="flex items-center p-0.5 rounded-lg border border-[color:var(--color-border-light)] bg-slate-100/80">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('card')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                        viewMode === 'card'
                                            ? 'bg-white text-[color:var(--color-text-main)] shadow-2xs font-semibold'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                    title="Card view"
                                    aria-label="Switch to Card view"
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Cards</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                        viewMode === 'list'
                                            ? 'bg-white text-[color:var(--color-text-main)] shadow-2xs font-semibold'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                    title="List view"
                                    aria-label="Switch to List view"
                                >
                                    <List className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">List</span>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* ── Archived Notice Banner (when viewing archived tab) ── */}
                {activeTab === 'archived' && filteredProjects.length > 0 && (
                    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 text-xs text-slate-600">
                        <Archive className="w-4 h-4 text-slate-500 shrink-0" />
                        <div>
                            <span className="font-semibold text-slate-800">Project Archive Records</span>
                            <span className="text-slate-500 ml-1.5">— Completed and archived projects remain preserved and accessible for historical records and documentation.</span>
                        </div>
                    </div>
                )}

                {/* ── Content Area: Dynamic based on filters ── */}
                {filteredProjects.length === 0 ? (
                    <ProjectsEmptyState
                        activeTab={activeTab}
                        isFiltered={isFiltered}
                        searchTerm={searchTerm}
                        onResetFilters={handleResetFilters}
                        onCreateClick={handleOpenCreateModal}
                    />
                ) : (
                    <div>
                        {/* Projects counter row */}
                        <div className="flex items-center justify-between mb-3 px-1">
                            <p className="text-xs text-[color:var(--color-text-muted)]">
                                Showing{' '}
                                <span className="font-bold text-[color:var(--color-text-main)]">
                                    {filteredProjects.length}
                                </span>{' '}
                                {filteredProjects.length === 1 ? 'project' : 'projects'}
                            </p>
                            <p className="text-[11px] text-[color:var(--color-text-subtle)] hidden sm:block">
                                Click any project to open its workspace
                            </p>
                        </div>

                        {/* Projects Display: Card Grid vs List View */}
                        {viewMode === 'card' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {filteredProjects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onSelect={handleProjectCardSelect}
                                    />
                                ))}
                            </div>
                        ) : (
                            <ProjectList
                                projects={filteredProjects}
                                onSelect={handleProjectCardSelect}
                            />
                        )}
                    </div>
                )}

                {/* ── Create Project Modal ── */}
                <Modal
                    isOpen={isCreateModalOpen}
                    onClose={() => !processing && handleCloseCreateModal()}
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
