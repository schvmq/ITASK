import React, { useState, useMemo, useRef } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/ui/button';
import {
    FolderOpen,
    Plus,
    Search,
    RotateCcw,
    ArrowUpRight,
    Info,
    X,
    FileText,
    LayoutGrid,
    List,
    Archive,
} from 'lucide-react';

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
    activitiesCount?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getSimplifiedRole(role: string): string {
    if (!role) return 'Member';
    const lower = role.toLowerCase();
    if (lower.includes('leader')) return 'Leader';
    if (lower.includes('staff')) return 'Staff';
    if (lower.includes('member')) return 'Member';
    return role;
}

function formatDeadline(deadline: string | null | undefined): string {
    if (!deadline || deadline === 'No deadline') return 'No deadline';
    try {
        const date = new Date(deadline);
        if (isNaN(date.getTime())) return deadline;
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const year = date.getFullYear();
        return `Ends ${month} ${day}, ${year}`;
    } catch {
        return `Ends ${deadline}`;
    }
}

// ─── Project Card Component ──────────────────────────────────────────────────
// Matches the card layout from Image 1 using ITASK Global CSS design tokens:
// - Title and status badge (• Active)
// - Short description of the project
// - Progress bar with percentage
// - 3-box statistics (Role, Committees, Activities)
// - Ends date & Archive action
interface ProjectCardProps {
    project: ProjectItem;
    onSelect: (project: ProjectItem) => void;
    onArchive?: (project: ProjectItem) => void;
}

function ProjectCard({ project, onSelect, onArchive }: ProjectCardProps) {
    const simplifiedRole = getSimplifiedRole(project.role);
    const formattedDeadline = formatDeadline(project.deadline);
    const activitiesCount = project.activitiesCount ?? project.tasksCount ?? 0;
    const isCompleted = project.status === 'Completed' || project.progress === 100;

    const statusLabel =
        project.status === 'Archived'
            ? 'Archived'
            : project.status === 'Planning'
            ? 'Draft'
            : 'Active';

    const statusColorClass =
        project.status === 'Archived'
            ? 'text-[color:var(--color-text-muted)]'
            : project.status === 'Planning'
            ? 'text-[color:var(--color-brand-action-orange)]'
            : 'text-emerald-700';

    const dotColorClass =
        project.status === 'Archived'
            ? 'bg-slate-400'
            : project.status === 'Planning'
            ? 'bg-[color:var(--color-brand-action-orange)]'
            : 'bg-emerald-500';

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
            className="group relative bg-white rounded-2xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:shadow-md hover:border-[color:var(--color-brand-action-orange)]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
            <div>
                {/* Header: Title and Status badge */}
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors leading-snug line-clamp-1">
                        {project.title}
                    </h3>
                    <div
                        className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold ${statusColorClass} pt-0.5`}
                    >
                        <span className={`w-2 h-2 rounded-full ${dotColorClass}`} />
                        <span>{statusLabel}</span>
                    </div>
                </div>

                {/* Short Description */}
                <p className="text-xs text-[color:var(--color-text-muted)] leading-relaxed mt-2 line-clamp-2 min-h-[2.5rem]">
                    {project.description ? project.description : 'No description provided.'}
                </p>

                {/* Progress Bar */}
                <div className="mt-5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">Progress</span>
                        <span className="text-xs font-bold text-[color:var(--color-text-main)]">
                            {project.progress}%
                        </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
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

                {/* 3 Stats Boxes */}
                <div className="grid grid-cols-3 gap-2 mt-5">
                    <div className="bg-[color:var(--color-surface-subtle)] rounded-xl py-2.5 px-2 text-center border border-[color:var(--color-border-light)]">
                        <div className="text-xs sm:text-sm font-bold text-[color:var(--color-text-main)] leading-tight">
                            {simplifiedRole}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)] font-medium mt-0.5">
                            Role
                        </div>
                    </div>
                    <div className="bg-[color:var(--color-surface-subtle)] rounded-xl py-2.5 px-2 text-center border border-[color:var(--color-border-light)]">
                        <div className="text-xs sm:text-sm font-bold text-[color:var(--color-text-main)] leading-tight">
                            {project.committeesCount ?? 0}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)] font-medium mt-0.5">
                            Committees
                        </div>
                    </div>
                    <div className="bg-[color:var(--color-surface-subtle)] rounded-xl py-2.5 px-2 text-center border border-[color:var(--color-border-light)]">
                        <div className="text-xs sm:text-sm font-bold text-[color:var(--color-text-main)] leading-tight">
                            {activitiesCount}
                        </div>
                        <div className="text-[11px] text-[color:var(--color-text-muted)] font-medium mt-0.5">
                            Activities
                        </div>
                    </div>
                </div>
            </div>

            {/* Card Footer: Ends Date & Archive */}
            <div className="mt-5 pt-3 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between text-xs">
                <span className="text-[color:var(--color-text-muted)] font-normal">{formattedDeadline}</span>
                {project.status !== 'Archived' && onArchive && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onArchive(project);
                        }}
                        className="text-[color:var(--color-brand-action-orange)] hover:text-[color:var(--color-primary-hover)] transition-colors cursor-pointer text-xs font-semibold"
                    >
                        Archive
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Project List Component ──────────────────────────────────────────────────
interface ProjectListProps {
    projects: ProjectItem[];
    onSelect: (project: ProjectItem) => void;
    onArchive?: (project: ProjectItem) => void;
}

function ProjectList({ projects, onSelect, onArchive }: ProjectListProps) {
    return (
        <div className="w-full bg-white rounded-xl border border-[color:var(--color-border-light)] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead>
                        <tr className="border-b border-[color:var(--color-border-light)] bg-[color:var(--color-surface-subtle)] text-[11px] font-bold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                            <th className="px-5 py-3.5">Project</th>
                            <th className="px-4 py-3.5">Role</th>
                            <th className="px-4 py-3.5">Progress</th>
                            <th className="px-4 py-3.5 text-center">Committees</th>
                            <th className="px-4 py-3.5 text-center">Activities</th>
                            <th className="px-4 py-3.5">Deadline</th>
                            <th className="px-5 py-3.5 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                        {projects.map((project) => {
                            const simplifiedRole = getSimplifiedRole(project.role);
                            const formattedDeadline = formatDeadline(project.deadline);
                            const activitiesCount = project.activitiesCount ?? project.tasksCount ?? 0;
                            const isCompleted = project.status === 'Completed' || project.progress === 100;
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
                                    {/* Project Name & Short Description */}
                                    <td className="px-5 py-4 max-w-xs">
                                        <div className="font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors leading-tight">
                                            {project.title}
                                        </div>
                                        <div className="text-[11px] text-[color:var(--color-text-muted)] truncate mt-0.5">
                                            {project.description || 'No description provided.'}
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-main)]">
                                            {simplifiedRole}
                                        </span>
                                    </td>

                                    {/* Progress */}
                                    <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{
                                                        width: `${project.progress}%`,
                                                        backgroundColor: isCompleted
                                                            ? '#10b981'
                                                            : 'var(--color-brand-action-orange)',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-medium text-[color:var(--color-text-main)] w-8">
                                                {project.progress}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Committees */}
                                    <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-[color:var(--color-text-main)]">
                                        {project.committeesCount ?? 0}
                                    </td>

                                    {/* Activities */}
                                    <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-[color:var(--color-text-main)]">
                                        {activitiesCount}
                                    </td>

                                    {/* Deadline */}
                                    <td className="px-4 py-4 whitespace-nowrap text-[color:var(--color-text-muted)] text-[11px]">
                                        {formattedDeadline}
                                    </td>

                                    {/* Action */}
                                    <td className="px-5 py-4 whitespace-nowrap text-right">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[color:var(--color-brand-action-orange)] group-hover:bg-orange-50 transition-colors">
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

// ─── Empty State Component ───────────────────────────────────────────────────
interface ProjectsEmptyStateProps {
    activeTab: 'active' | 'drafts' | 'archived';
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
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center rounded-2xl border border-dashed border-[color:var(--color-border-dark)] bg-white shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-2xs">
                    <Search className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-[color:var(--color-text-main)]">
                    No matching projects found
                </h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-4 leading-relaxed">
                    No projects match the search query{' '}
                    <span className="font-semibold text-[color:var(--color-text-main)]">"{searchTerm}"</span>.
                </p>
                {onResetFilters && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onResetFilters}
                        className="text-[color:var(--color-brand-action-orange)] border-[color:var(--color-brand-action-orange)]/40 hover:bg-[color:var(--color-brand-active-warm-orange)]"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear Search</span>
                    </Button>
                )}
            </div>
        );
    }

    if (activeTab === 'archived') {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[color:var(--color-border-light)] bg-white shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-2xs">
                    <Archive className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[color:var(--color-text-main)]">No archived projects</h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 leading-relaxed">
                    Completed and archived projects will appear here for historical records.
                </p>
            </div>
        );
    }

    if (activeTab === 'drafts') {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[color:var(--color-border-light)] bg-white shadow-2xs">
                <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-2xs">
                    <FileText className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-[color:var(--color-text-main)]">No draft projects</h4>
                <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 leading-relaxed">
                    Projects in the planning or draft stage will appear here before activation.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[color:var(--color-border-light)] bg-white shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] flex items-center justify-center text-[color:var(--color-text-subtle)] mb-3 shadow-2xs">
                <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-[color:var(--color-text-main)]">No active projects</h4>
            <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-1 mb-5 leading-relaxed">
                You do not have any active projects yet. Start a new project to get underway.
            </p>
            {onCreateClick && (
                <Button
                    type="button"
                    onClick={onCreateClick}
                    className="bg-[color:var(--color-brand-action-orange)] hover:bg-[color:var(--color-primary-hover)] text-white shadow-xs font-semibold gap-1.5"
                >
                    <Plus className="w-4 h-4" />
                    <span>+ Create Project</span>
                </Button>
            )}
        </div>
    );
}

interface ProjectsIndexProps {
    projects: ProjectItem[];
}

// ─── Main Projects Page Component ─────────────────────────────────────────────
export default function ProjectsIndex({ projects }: ProjectsIndexProps) {
    // Top-level tabs matching Image 1: Active | Drafts | Archived
    const [activeTab, setActiveTab] = useState<'active' | 'drafts' | 'archived'>('active');

    // View mode state (Card vs List)
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

    // Search query state
    const [searchTerm, setSearchTerm] = useState('');

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

    const handleProjectCardSelect = (project: ProjectItem) => {
        router.visit(`/projects/${project.id}`);
    };

    const handleArchiveProject = (project: ProjectItem) => {
        if (confirm(`Are you sure you want to archive "${project.title}"?`)) {
            router.post(
                `/projects/${project.id}/archive`,
                {},
                {
                    preserveScroll: true,
                }
            );
        }
    };

    // Client-side filtering of projects
    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            const isArchived = project.status === 'Archived' || project.status === 'Completed';
            const isDraft = project.status === 'Planning' || project.status === 'Draft';
            const isActive = !isArchived && !isDraft;

            if (activeTab === 'active' && !isActive) return false;
            if (activeTab === 'drafts' && !isDraft) return false;
            if (activeTab === 'archived' && !isArchived) return false;

            // Search Term
            if (searchTerm.trim() !== '') {
                const query = searchTerm.toLowerCase();
                const matchesTitle = project.title.toLowerCase().includes(query);
                const matchesDesc = (project.description || '').toLowerCase().includes(query);
                if (!matchesTitle && !matchesDesc) return false;
            }

            return true;
        });
    }, [projects, activeTab, searchTerm]);

    const isFiltered = searchTerm.trim() !== '';

    const handleResetFilters = () => {
        setSearchTerm('');
    };

    return (
        <AppLayout
            title="My Projects"
            subtitle={`${projects.length} total ${projects.length === 1 ? 'project' : 'projects'}`}
            hidePageHeadingBanner={true}
        >
            <Head title="My Projects — ITASK" />

            <div className="space-y-6 max-w-7xl mx-auto pb-10">

                {/* ── Notice Banner Modal / Alert ── */}
                {activeNotice && (
                    <div className="p-4 rounded-xl border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)] flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
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

                {/* ── Page Header: My Projects + Create Project button ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-main)] leading-tight">
                            My Projects
                        </h1>
                        <p className="text-xs text-[color:var(--color-text-muted)] mt-1 font-normal">
                            {projects.length} total {projects.length === 1 ? 'project' : 'projects'}
                        </p>
                    </div>

                    <Button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="bg-[color:var(--color-brand-action-orange)] hover:bg-[color:var(--color-primary-hover)] text-white shadow-xs font-semibold gap-1.5 cursor-pointer"
                        title="Create a new project"
                    >
                        <Plus className="w-4 h-4 shrink-0" strokeWidth={2.4} />
                        <span>+ Create Project</span>
                    </Button>
                </div>

                {/* ── Filter Tabs: Active, Drafts, Archived ── */}
                <div className="flex items-center gap-8 border-b border-[color:var(--color-border-light)]">
                    {(['active', 'drafts', 'archived'] as const).map((tab) => {
                        const isActive = activeTab === tab;
                        const labels: Record<string, string> = {
                            active: 'Active',
                            drafts: 'Drafts',
                            archived: 'Archived',
                        };
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                                    isActive
                                        ? 'text-[color:var(--color-brand-dark-green)] font-bold'
                                        : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)]'
                                }`}
                            >
                                <span>{labels[tab]}</span>
                                {isActive && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[color:var(--color-brand-action-orange)] rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Separated Search Bar and View Switcher Row ── */}
                <div className="flex items-center justify-between gap-4">
                    {/* Standalone Search Projects input */}
                    <div className="relative w-full max-w-xs sm:max-w-sm">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-subtle)] pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search projects..."
                            className="w-full pl-8.5 pr-8 py-2 text-xs bg-white rounded-lg border border-[color:var(--color-border-light)] placeholder:text-[color:var(--color-text-subtle)] focus:outline-hidden focus:border-[color:var(--color-brand-action-orange)] focus:ring-2 focus:ring-[color:var(--color-brand-action-orange)]/20 shadow-2xs transition-all text-[color:var(--color-text-main)]"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-main)] cursor-pointer p-0.5"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* View Switcher: Grid vs List */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('card')}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                viewMode === 'card'
                                    ? 'bg-[color:var(--color-brand-dark-green)] text-white shadow-2xs'
                                    : 'text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-main)] hover:bg-[color:var(--color-surface-muted)]'
                            }`}
                            title="Grid view"
                            aria-label="Switch to Card view"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                viewMode === 'list'
                                    ? 'bg-[color:var(--color-brand-dark-green)] text-white shadow-2xs'
                                    : 'text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-main)] hover:bg-[color:var(--color-surface-muted)]'
                            }`}
                            title="List view"
                            aria-label="Switch to List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>

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
                        {/* Projects Display: Card Grid vs List View */}
                        {viewMode === 'card' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredProjects.map((project) => (
                                    <ProjectCard
                                        key={project.id}
                                        project={project}
                                        onSelect={handleProjectCardSelect}
                                        onArchive={handleArchiveProject}
                                    />
                                ))}
                            </div>
                        ) : (
                            <ProjectList
                                projects={filteredProjects}
                                onSelect={handleProjectCardSelect}
                                onArchive={handleArchiveProject}
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
                                className="w-full px-3 py-2 text-sm bg-white border border-[color:var(--color-border-dark)] rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-action-orange)]/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-[color:var(--color-text-subtle)]"
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
                            <div className="p-3 border border-dashed border-[color:var(--color-border-dark)] rounded-lg bg-[color:var(--color-surface-subtle)] hover:bg-[color:var(--color-surface-muted)] transition-colors">
                                {data.approval_document ? (
                                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-md border border-[color:var(--color-border-light)]">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="w-4 h-4 text-[color:var(--color-brand-action-orange)] shrink-0" />
                                            <span className="text-xs font-medium text-[color:var(--color-text-main)] truncate">
                                                {data.approval_document.name}
                                            </span>
                                            <span className="text-[10px] text-[color:var(--color-text-subtle)] shrink-0">
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
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-[color:var(--color-brand-active-warm-orange)] border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Attach Official Document</span>
                                        </label>
                                        <p className="text-[11px] text-[color:var(--color-text-muted)] mt-1.5">
                                            Approved memo, activity design, or letter (PDF, Word, Image · max 10MB)
                                        </p>
                                    </div>
                                )}
                            </div>
                            <InputError message={errors.approval_document} />
                        </div>

                        <div className="pt-3 border-t border-[color:var(--color-border-light)] flex items-center justify-end gap-2.5">
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
                                disabled={processing}
                                className="bg-[color:var(--color-brand-action-orange)] hover:bg-[color:var(--color-primary-hover)] text-white shadow-xs font-semibold"
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
