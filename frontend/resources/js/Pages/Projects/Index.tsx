import React, { useState, useMemo, useCallback } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AppLayout, openCreateProjectModal } from '@/Layouts/AppLayout';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { Tabs } from '@/Components/Tabs';
import { Pagination } from '@/Components/Pagination';
import { EmptyState } from '@/Components/EmptyState';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import { JoinProjectModal } from '@/Components/JoinProjectModal';
import { getProgressBarGradient } from '@/lib/progress';
import {
    FolderOpen,
    Plus,
    Search,
    X,
    Clock,
    LayoutGrid,
    List,
    Archive,
    RotateCw,
    Users,
    CheckCircle2,
    Calendar,
} from 'lucide-react';

export interface ProjectItem {
    id: string;
    title: string;
    description: string;
    status: string;
    role: string;
    progress: number;
    deadline: string;
    startDate?: string | null;
    committeesCount: number;
    tasksCount: number;
    activitiesCount?: number;
}

export interface AvailableUser {
    id: number;
    name: string;
    email: string;
}

interface ProjectsIndexProps {
    projects: ProjectItem[];
    availableUsers?: AvailableUser[];
}

export default function ProjectsIndex({ projects = [], availableUsers = [] }: ProjectsIndexProps) {
    const { auth } = usePage<any>().props;
    const isAdmin = Boolean(auth?.user?.is_admin);
    const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // ── URL Synchronization for Filters & Pagination ──
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const initialStatus = searchParams.get('status') || 'ALL';
    const initialRole = searchParams.get('role') || 'ALL';
    const initialSearch = searchParams.get('q') || '';
    const initialPage = parseInt(searchParams.get('page') || '1', 10);
    const initialSize = parseInt(searchParams.get('size') || '10', 10);

    const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
    const [roleFilter, setRoleFilter] = useState<string>(initialRole);
    const [searchTerm, setSearchTerm] = useState<string>(initialSearch);
    const [currentPage, setCurrentPage] = useState<number>(Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1);
    const [pageSize, setPageSize] = useState<number>([5, 10, 25].includes(initialSize) ? initialSize : 10);

    const updateUrlParams = useCallback((newStatus: string, newRole: string, newQuery: string, newPage: number, newSize: number) => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        if (newStatus !== 'ALL') url.searchParams.set('status', newStatus); else url.searchParams.delete('status');
        if (newRole !== 'ALL') url.searchParams.set('role', newRole); else url.searchParams.delete('role');
        if (newQuery) url.searchParams.set('q', newQuery); else url.searchParams.delete('q');
        url.searchParams.set('page', String(newPage));
        url.searchParams.set('size', String(newSize));
        window.history.replaceState({}, '', url.toString());
    }, []);

    const handleStatusFilterChange = (status: string) => {
        setStatusFilter(status);
        setCurrentPage(1);
        updateUrlParams(status, roleFilter, searchTerm, 1, pageSize);
    };

    const handleRoleFilterChange = (role: string) => {
        setRoleFilter(role);
        setCurrentPage(1);
        updateUrlParams(statusFilter, role, searchTerm, 1, pageSize);
    };

    const handleSearchChange = (query: string) => {
        setSearchTerm(query);
        setCurrentPage(1);
        updateUrlParams(statusFilter, roleFilter, query, 1, pageSize);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        updateUrlParams(statusFilter, roleFilter, searchTerm, page, pageSize);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
        updateUrlParams(statusFilter, roleFilter, searchTerm, 1, size);
    };

    // Filter projects based on search query, status, and role
    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            if (statusFilter !== 'ALL') {
                if (statusFilter === 'Active' && project.status === 'Archived') return false;
                if (statusFilter !== 'Active' && project.status !== statusFilter) return false;
            }

            if (roleFilter !== 'ALL') {
                const lowerRole = (project.role || '').toLowerCase();
                if (roleFilter === 'Leader' && !lowerRole.includes('leader')) return false;
                if (roleFilter === 'Staff' && !lowerRole.includes('staff')) return false;
                if (roleFilter === 'Member' && !lowerRole.includes('member')) return false;
            }

            if (searchTerm.trim() !== '') {
                const query = searchTerm.toLowerCase();
                const matchesTitle = project.title.toLowerCase().includes(query);
                const matchesDesc = (project.description || '').toLowerCase().includes(query);
                if (!matchesTitle && !matchesDesc) return false;
            }

            return true;
        });
    }, [projects, statusFilter, roleFilter, searchTerm]);

    // Client pagination (noted as client pagination because backend index returns unpaginated collection)
    const totalItems = filteredProjects.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(currentPage, Math.max(5, totalPages));

    const paginatedProjects = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filteredProjects.slice(start, start + pageSize);
    }, [filteredProjects, safePage, pageSize]);

    // Archive / Unarchive Handlers
    const handleArchiveToggle = (project: ProjectItem) => {
        if (project.status === 'Archived') {
            router.post(`/projects/${project.id}/unarchive`, {}, { preserveScroll: true });
        } else {
            router.post(`/projects/${project.id}/archive`, {}, { preserveScroll: true });
        }
    };

    return (
        <AppLayout hidePageHeadingBanner={true}>
            <Head title="Projects" />

            <div className="space-y-6">
                {/* ══ 1. Page Header ══ */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[color:var(--border)]">
                    <div>
                        <h1 className="text-[26px] font-bold text-[color:var(--text)] tracking-tight">
                            Projects
                        </h1>
                        <p className="text-[15px] text-[color:var(--muted)] mt-1">
                            Team workspaces, committees, and collective deliverables.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        <Link href="/timeline">
                            <Button
                                variant="secondary"
                                size="md"
                                className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-indigo-700/10 hover:bg-[color:var(--soft-surface)] text-[color:var(--primary)] font-bold border border-[color:var(--primary)]/30 flex items-center gap-1.5"
                                leftIcon={<Calendar className="w-4 h-4 text-[color:var(--primary)]" />}
                            >
                                <span>View in Timeline</span>
                            </Button>
                        </Link>
                        {!isAdmin && (
                            <>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    onClick={() => setIsJoinCodeOpen(true)}
                                >
                                    <span>Join with code</span>
                                </Button>
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={() => openCreateProjectModal()}
                                    leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
                                >
                                    <span>Create project</span>
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* ══ 2. Filters & View Switcher ══ */}
                <Card className="p-4 space-y-3">
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)] pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search projects by title or description..."
                                value={searchTerm}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] placeholder:text-[color:var(--muted)] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => handleSearchChange('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)] hover:text-[color:var(--text)] cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Status Filter */}
                        <div className="shrink-0 w-full md:w-44">
                            <select
                                value={statusFilter}
                                onChange={(e) => handleStatusFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                aria-label="Filter by project status"
                            >
                                <option value="ALL">All statuses</option>
                                <option value="Active">Active only</option>
                                <option value="Completed">Completed</option>
                                <option value="Archived">Archived</option>
                            </select>
                        </div>

                        {/* Role Filter */}
                        <div className="shrink-0 w-full md:w-44">
                            <select
                                value={roleFilter}
                                onChange={(e) => handleRoleFilterChange(e.target.value)}
                                className="w-full py-2 px-3 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                aria-label="Filter by my role"
                            >
                                <option value="ALL">All my roles</option>
                                <option value="Leader">Leader</option>
                                <option value="Staff">Staff</option>
                                <option value="Member">Member</option>
                            </select>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 border border-[color:var(--border)] rounded-[8px] p-1 bg-[color:var(--soft-surface)] shrink-0 self-end md:self-auto">
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                                    viewMode === 'table'
                                        ? 'bg-[color:var(--card)] text-[color:var(--text)] shadow-xs'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                                aria-label="Table view"
                            >
                                <List className="w-4 h-4 stroke-[2]" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                                    viewMode === 'grid'
                                        ? 'bg-[color:var(--card)] text-[color:var(--text)] shadow-xs'
                                        : 'text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                                aria-label="Grid view"
                            >
                                <LayoutGrid className="w-4 h-4 stroke-[2]" />
                            </button>
                        </div>
                    </div>
                </Card>

                {/* ══ 3. Project Content (Table or Grid) ══ */}
                {totalItems === 0 ? (
                    <EmptyState
                        title="No projects found"
                        description={searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL' ? 'No projects match your active search and filter criteria.' : isAdmin ? 'No projects currently in the catalog.' : 'You have not joined or created any projects yet. Create your first project to get started.'}
                        actionLabel={searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL' ? 'Reset filters' : isAdmin ? undefined : 'Create a Project'}
                        onAction={searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL' ? () => {
                            setStatusFilter('ALL');
                            setRoleFilter('ALL');
                            setSearchTerm('');
                            updateUrlParams('ALL', 'ALL', '', 1, pageSize);
                        } : isAdmin ? undefined : () => openCreateProjectModal()}
                    />
                ) : viewMode === 'table' ? (
                    /* Table View */
                    <Card className="p-5 space-y-4">
                        <div className="overflow-x-auto -mx-5 px-5">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-[color:var(--border)] text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                        <th className="py-2.5 pr-4">Project</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Progress</th>
                                        <th className="py-2.5 px-3">Committees</th>
                                        <th className="py-2.5 px-3">Tasks</th>
                                        <th className="py-2.5 px-3">Deadline</th>
                                        <th className="py-2.5 pl-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--border)] text-[14px]">
                                    {paginatedProjects.map((project) => {
                                        const isArchived = project.status === 'Archived';
                                        const isLeader = (project.role || '').toLowerCase().includes('leader');

                                        return (
                                            <tr
                                                key={project.id}
                                                className={`hover:bg-[color:var(--soft-surface)] transition-colors group ${
                                                    isArchived ? 'opacity-60' : ''
                                                }`}
                                            >
                                                {/* Project */}
                                                <td className="py-3.5 pr-4 min-w-[220px]">
                                                    <div className="flex items-center gap-2">
                                                        <Link
                                                            href={`/projects/${project.id}`}
                                                            className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate"
                                                        >
                                                            {project.title}
                                                        </Link>
                                                        <ProjectRoleBadge role={project.role} />
                                                    </div>
                                                    {project.description && (
                                                        <p className="text-[12px] text-[color:var(--muted)] truncate max-w-sm mt-0.5">
                                                            {project.description}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Status */}
                                                <td className="py-3.5 px-3 whitespace-nowrap">
                                                    <Badge variant={isArchived ? 'soft' : project.progress >= 60 || project.status === 'Completed' ? 'accent' : 'secondary'}>
                                                        {project.status}
                                                    </Badge>
                                                </td>

                                                {/* Highlighted Progress */}
                                                <td className="py-3.5 px-3 min-w-[160px]">
                                                    {(() => {
                                                        const isDone = project.status === 'Completed' || project.progress >= 100;
                                                        const pStyles = getProgressBarGradient(project.progress, isDone);
                                                        return (
                                                            <div className="flex flex-col gap-1.5 justify-center">
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="font-semibold text-[color:var(--muted)]">
                                                                        {isDone ? 'Completed' : 'In Progress'}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded-full font-bold tabular-nums text-[10px] border shadow-2xs ${pStyles.badgeBg} ${pStyles.badgeText} ${pStyles.badgeBorder}`}>
                                                                        {project.progress}%
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-2 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner p-[0.5px]">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-300 ${pStyles.barGradient} ${pStyles.shadow}`}
                                                                        style={{ width: `${project.progress > 0 ? Math.max(3, project.progress) : 0}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Committees */}
                                                <td className="py-3.5 px-3 whitespace-nowrap text-[13px] text-[color:var(--muted)] tabular-nums">
                                                    {project.committeesCount}
                                                </td>

                                                {/* Tasks */}
                                                <td className="py-3.5 px-3 whitespace-nowrap text-[13px] text-[color:var(--muted)] tabular-nums">
                                                    {project.tasksCount}
                                                </td>

                                                {/* Deadline */}
                                                <td className="py-3.5 px-3 whitespace-nowrap text-[13px] text-[color:var(--muted)] tabular-nums">
                                                    {project.deadline}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 pl-3 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/projects/${project.id}`}>
                                                            <Button variant="outline" size="sm">
                                                                Open
                                                            </Button>
                                                        </Link>

                                                        {isLeader && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleArchiveToggle(project)}
                                                                title={isArchived ? 'Restore project' : 'Archive project'}
                                                                className="p-1.5 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] transition-colors cursor-pointer focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
                                                                aria-label={isArchived ? `Restore ${project.title}` : `Archive ${project.title}`}
                                                            >
                                                                {isArchived ? (
                                                                    <RotateCw className="w-4 h-4 stroke-[2]" />
                                                                ) : (
                                                                    <Archive className="w-4 h-4 stroke-[2]" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pt-2 border-t border-[color:var(--border)] flex justify-center w-full">
                            <Pagination
                                currentPage={safePage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                pageSizeOptions={[5, 10, 25]}
                            />
                        </div>
                    </Card>
                ) : (
                    /* Grid View */
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {paginatedProjects.map((project) => {
                                const isArchived = project.status === 'Archived';
                                const isLeader = (project.role || '').toLowerCase().includes('leader');

                                return (
                                    <Card
                                        key={project.id}
                                        className={`p-5 flex flex-col justify-between space-y-4 hover:border-[color:var(--primary)] transition-colors ${
                                            isArchived ? 'opacity-60' : ''
                                        }`}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <Link
                                                        href={`/projects/${project.id}`}
                                                        className="font-bold text-[16px] text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors truncate block"
                                                    >
                                                        {project.title}
                                                    </Link>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <ProjectRoleBadge role={project.role} />
                                                        <Badge variant={isArchived ? 'soft' : project.progress >= 60 || project.status === 'Completed' ? 'accent' : 'secondary'}>
                                                            {project.status}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                {isLeader && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleArchiveToggle(project)}
                                                        title={isArchived ? 'Restore' : 'Archive'}
                                                        className="p-1 rounded-[6px] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer"
                                                        aria-label={isArchived ? `Restore ${project.title}` : `Archive ${project.title}`}
                                                    >
                                                        {isArchived ? <RotateCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </div>

                                            {project.description && (
                                                <p className="text-[13px] text-[color:var(--muted)] line-clamp-2">
                                                    {project.description}
                                                </p>
                                            )}

                                            {/* Highlighted Progress */}
                                            {(() => {
                                                const isDone = project.status === 'Completed' || project.progress >= 100;
                                                const pStyles = getProgressBarGradient(project.progress, isDone);
                                                return (
                                                    <div className="space-y-1.5 pt-1">
                                                        <div className="flex items-center justify-between text-[12px]">
                                                            <span className="font-semibold text-[color:var(--muted)]">Progress</span>
                                                            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] tabular-nums border shadow-2xs ${pStyles.badgeBg} ${pStyles.badgeText} ${pStyles.badgeBorder}`}>
                                                                {project.progress}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner p-[1px]">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-300 ${pStyles.barGradient} ${pStyles.shadow}`}
                                                                style={{ width: `${project.progress > 0 ? Math.max(3, project.progress) : 0}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Stats list */}
                                            <div className="flex items-center justify-between text-[12px] text-[color:var(--muted)] pt-2 border-t border-[color:var(--border)]">
                                                <span>{project.committeesCount} committees</span>
                                                <span>{project.tasksCount} tasks</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-[color:var(--border)]">
                                            <span className="text-[12px] text-[color:var(--muted)] tabular-nums">
                                                {project.deadline}
                                            </span>
                                            <Link href={`/projects/${project.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Open
                                                </Button>
                                            </Link>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        <Card className="p-4 flex justify-center w-full">
                            <Pagination
                                currentPage={safePage}
                                totalPages={totalPages}
                                totalItems={totalItems}
                                pageSize={pageSize}
                                onPageChange={handlePageChange}
                                onPageSizeChange={handlePageSizeChange}
                                pageSizeOptions={[5, 10, 25]}
                            />
                        </Card>
                    </div>
                )}
            </div>

            <JoinProjectModal
                isOpen={isJoinCodeOpen}
                onClose={() => setIsJoinCodeOpen(false)}
            />
        </AppLayout>
    );
}
