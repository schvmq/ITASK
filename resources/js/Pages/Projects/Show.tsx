import React, { useState, useRef, useMemo } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import type { ProjectTimelineData } from '@/types';
import { GanttTimeline } from '@/Components/GanttTimeline';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import { Badge } from '@/Components/Badge';
import { Card } from '@/Components/Card';
import { EmptyState } from '@/Components/EmptyState';
import { Pagination } from '@/Components/Pagination';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import {
    FolderOpen,
    Calendar,
    Users,
    Clock,
    ArrowLeft,
    Edit3,
    MoreHorizontal,
    CheckSquare,
    FileText,
    ChevronRight,
    ArrowRight,
    MessageSquare,
    AlertCircle,
    Archive,
    Download,
    Lock,
    Upload,
    CheckCircle2,
} from 'lucide-react';

// ─── Types & Definitions ──────────────────────────────────────────────────────

export interface DocumentItem {
    id: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at?: string;
    uploader_name?: string;
    download_url?: string;
}

export interface CommitteeItem {
    id: string;
    name: string;
    description?: string | null;
    progress: number;
    membersCount: number;
    activitiesCount: number;
    leadName: string;
    head?: {
        id: number;
        name: string;
        email: string;
    } | null;
    members?: Array<{
        id: number;
        name: string;
        email: string;
    }>;
    can?: {
        view?: boolean;
        update?: boolean;
        delete?: boolean;
    };
}

export interface PersonnelItem {
    id: number;
    name: string;
    email: string;
    committee_id?: string | null;
}

export interface ProjectActivityItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    tasksCount: number;
    completedTasksCount: number;
    committee: {
        id: string;
        name: string;
    };
}

export interface ProjectTaskItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date: string | null;
    requires_review: boolean;
    is_overdue: boolean;
    assignee: {
        id: number;
        name: string;
    } | null;
    committee: {
        id: string;
        name: string;
    };
    activity: {
        id: string;
        title: string;
    };
}

export interface ProjectData {
    id: string | number;
    title: string;
    description: string | null;
    status: string;
    role?: ProjectRole | string | null;
    userRole?: ProjectRole | string | null;
    progress?: number;
    end_date?: string | null;
    start_date?: string | null;
    end_date_raw?: string | null;
    start_date_raw?: string | null;
    userCommittee?: {
        id: string;
        name: string;
    } | null;
    can?: {
        update?: boolean;
        archive?: boolean;
        uploadDocument?: boolean;
        createCommittee?: boolean;
    };
    creator?: {
        id: number;
        name: string;
        email: string;
    } | null;
    leader?: {
        id: number;
        name: string;
        email: string;
    } | null;
    committees?: CommitteeItem[];
    projectStaff?: PersonnelItem[];
    projectMembers?: PersonnelItem[];
    availablePersonnel?: PersonnelItem[];
    documents?: DocumentItem[];
    activities?: ProjectActivityItem[];
    tasks?: ProjectTaskItem[];
    timeline?: ProjectTimelineData | null;
}

export interface ProjectShowProps {
    projectId?: string;
    project?: ProjectData | null;
    timeline?: ProjectTimelineData | null;
    initialTab?: TabKey | string | null;
}

type TabKey = 'tasks' | 'chat' | 'files' | 'timeline' | 'overview' | 'committees';

function getInitials(name: string): string {
    if (!name) return '??';
    return name
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

function formatFileSize(bytes: number): string {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

export default function ProjectShow({
    project: initialProject,
    timeline: propTimeline,
    initialTab = 'tasks',
}: ProjectShowProps) {
    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        const validTabs: TabKey[] = ['tasks', 'chat', 'files', 'timeline', 'overview', 'committees'];
        return validTabs.includes(initialTab as TabKey) ? (initialTab as TabKey) : 'tasks';
    });

    // Pagination for Tasks tab
    const [taskPage, setTaskPage] = useState(1);
    const [taskPageSize, setTaskPageSize] = useState(10);

    // Pagination for Files tab
    const [filesPage, setFilesPage] = useState(1);
    const [filesPageSize, setFilesPageSize] = useState(10);

    // Modals
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [isCreateCommitteeModalOpen, setIsCreateCommitteeModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState<CommitteeItem | null>(null);
    const [isEditCommitteeModalOpen, setIsEditCommitteeModalOpen] = useState(false);
    const [isUploadDocumentModalOpen, setIsUploadDocumentModalOpen] = useState(false);
    const [archiveProcessing, setArchiveProcessing] = useState(false);

    const docFileInputRef = useRef<HTMLInputElement>(null);

    // Forms
    const {
        data: editData,
        setData: setEditData,
        put: submitEdit,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        title: initialProject?.title ?? '',
        description: initialProject?.description ?? '',
        start_date: initialProject?.start_date_raw ?? '',
        end_date: initialProject?.end_date_raw ?? '',
        status: initialProject?.status ?? 'Active',
    });

    const {
        data: committeeData,
        setData: setCommitteeData,
        post: submitCommittee,
        processing: committeeProcessing,
        errors: committeeErrors,
        reset: resetCommitteeForm,
        clearErrors: clearCommitteeErrors,
    } = useForm({
        name: '',
        description: '',
        user_id: '',
    });

    const {
        data: editCommitteeData,
        setData: setEditCommitteeData,
        put: submitEditCommittee,
        processing: editCommitteeProcessing,
        errors: editCommitteeErrors,
        reset: resetEditCommitteeForm,
        clearErrors: clearEditCommitteeErrors,
    } = useForm({
        name: '',
        description: '',
        user_id: '',
    });

    const {
        data: docData,
        setData: setDocData,
        post: submitDocument,
        processing: docProcessing,
        errors: docErrors,
        reset: resetDocForm,
        clearErrors: clearDocErrors,
    } = useForm<{
        document: File | null;
        original_name: string;
    }>({
        document: null,
        original_name: '',
    });

    if (!initialProject) {
        return (
            <AppLayout title="Project Not Found" subtitle="Project Workspace">
                <Head title="Project Not Found" />
                <div className="py-16 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-[20px] font-bold text-[color:var(--text)]">Project not found</h2>
                    <p className="text-[14px] text-[color:var(--muted)] max-w-sm mx-auto">
                        This project could not be found or you do not have permission to view it.
                    </p>
                    <Link href="/projects">
                        <Button variant="primary" size="md">
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            <span>Back to projects</span>
                        </Button>
                    </Link>
                </div>
            </AppLayout>
        );
    }

    const isLeader = (initialProject.role || '').toLowerCase().includes('leader');
    const canCreateCommittee = Boolean(initialProject.can?.createCommittee || isLeader);
    const allTasks = initialProject.tasks || [];
    const allDocuments = initialProject.documents || [];
    const allCommittees = initialProject.committees || [];
    const timelineData = propTimeline || initialProject.timeline || null;

    // Paginated tasks
    const totalTasks = allTasks.length;
    const totalTaskPages = Math.max(1, Math.ceil(totalTasks / taskPageSize));
    const safeTaskPage = Math.min(taskPage, totalTaskPages);
    const paginatedTasks = useMemo(() => {
        const start = (safeTaskPage - 1) * taskPageSize;
        return allTasks.slice(start, start + taskPageSize);
    }, [allTasks, safeTaskPage, taskPageSize]);

    // Paginated documents
    const totalFiles = allDocuments.length;
    const totalFilesPages = Math.max(1, Math.ceil(totalFiles / filesPageSize));
    const safeFilesPage = Math.min(filesPage, totalFilesPages);
    const paginatedDocuments = useMemo(() => {
        const start = (safeFilesPage - 1) * filesPageSize;
        return allDocuments.slice(start, start + filesPageSize);
    }, [allDocuments, safeFilesPage, filesPageSize]);

    // Handlers
    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitEdit(`/projects/${initialProject.id}`, {
            preserveScroll: true,
            onSuccess: () => setIsEditModalOpen(false),
        });
    };

    const handleArchiveConfirm = () => {
        setArchiveProcessing(true);
        router.post(
            `/projects/${initialProject.id}/archive`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setArchiveProcessing(false),
                onSuccess: () => setIsArchiveModalOpen(false),
            }
        );
    };

    const handleCreateCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitCommittee(`/projects/${initialProject.id}/committees`, {
            onSuccess: () => {
                setIsCreateCommitteeModalOpen(false);
                resetCommitteeForm();
            },
        });
    };

    const handleEditCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCommittee) return;
        submitEditCommittee(`/projects/${initialProject.id}/committees/${editingCommittee.id}`, {
            onSuccess: () => {
                setIsEditCommitteeModalOpen(false);
                setEditingCommittee(null);
                resetEditCommitteeForm();
            },
        });
    };

    const handleUploadDocumentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitDocument(`/projects/${initialProject.id}/documents`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsUploadDocumentModalOpen(false);
                resetDocForm();
                if (docFileInputRef.current) docFileInputRef.current.value = '';
            },
        });
    };

    // Navigation Tabs per Section 4 requirement: Tasks, Chat, Files, Timeline, Overview, Committees
    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'tasks', label: 'Tasks', count: allTasks.length },
        { key: 'chat', label: 'Chat' },
        { key: 'files', label: 'Files', count: allDocuments.length },
        { key: 'timeline', label: 'Timeline' },
        { key: 'overview', label: 'Overview' },
        { key: 'committees', label: 'Committees', count: allCommittees.length },
    ];

    return (
        <AppLayout
            hidePageHeadingBanner={true}
            currentProject={{
                id: String(initialProject.id),
                title: initialProject.title,
                role: initialProject.role || undefined,
                status: initialProject.status,
            }}
            breadcrumbs={[
                { label: 'Projects', href: '/projects' },
                { label: initialProject.title },
            ]}
        >
            <Head title={initialProject.title} />

            <div className="space-y-6">
                {/* ══ Project Header (with progress and members) ══ */}
                <Card className="p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[color:var(--text)]">
                                    {initialProject.title}
                                </h1>
                                <Badge variant={initialProject.progress && initialProject.progress >= 60 || initialProject.status === 'Completed' ? 'accent' : 'secondary'}>
                                    {initialProject.status}
                                </Badge>
                                {initialProject.role && (
                                    <ProjectRoleBadge role={initialProject.role} />
                                )}
                            </div>

                            {initialProject.description && (
                                <p className="text-[14px] text-[color:var(--muted)] leading-relaxed max-w-3xl">
                                    {initialProject.description}
                                </p>
                            )}

                            {/* Metadata row */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[color:var(--muted)] pt-1">
                                <div>
                                    <span>Leader: </span>
                                    <span className="font-semibold text-[color:var(--text)]">
                                        {initialProject.leader?.name || 'Unassigned'}
                                    </span>
                                </div>
                                {initialProject.end_date && (
                                    <div className="flex items-center gap-1.5 tabular-nums">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Deadline: {initialProject.end_date}</span>
                                    </div>
                                )}
                                <div>
                                    <span>Committees: </span>
                                    <span className="font-semibold text-[color:var(--text)] tabular-nums">
                                        {allCommittees.length}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                            <Link href={`/chat/${initialProject.id}`}>
                                <Button variant="secondary" size="md">
                                    <MessageSquare className="w-4 h-4 mr-1.5" strokeWidth={2} />
                                    <span>Project chat</span>
                                </Button>
                            </Link>

                            {canCreateCommittee && (
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={() => {
                                        resetCommitteeForm();
                                        clearCommitteeErrors();
                                        setIsCreateCommitteeModalOpen(true);
                                    }}
                                >
                                    + Add committee
                                </Button>
                            )}

                            {isLeader && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="md" className="px-2.5" aria-label="More options">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44 bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)]">
                                        <DropdownMenuItem
                                            onClick={() => {
                                                setEditData({
                                                    title: initialProject.title,
                                                    description: initialProject.description ?? '',
                                                    start_date: initialProject.start_date_raw ?? '',
                                                    end_date: initialProject.end_date_raw ?? '',
                                                    status: initialProject.status,
                                                });
                                                setIsEditModalOpen(true);
                                            }}
                                            className="text-[13px] cursor-pointer"
                                        >
                                            <Edit3 className="w-3.5 h-3.5 mr-2" />
                                            Edit project
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-[color:var(--border)]" />
                                        <DropdownMenuItem
                                            onClick={() => setIsArchiveModalOpen(true)}
                                            className="text-[13px] text-[color:var(--primary)] cursor-pointer"
                                        >
                                            <Archive className="w-3.5 h-3.5 mr-2" />
                                            Archive project
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="pt-2 border-t border-[color:var(--border)] space-y-1.5">
                        <div className="flex items-center justify-between text-[13px]">
                            <span className="text-[color:var(--muted)]">Overall progress</span>
                            <span className="font-bold text-[color:var(--text)] tabular-nums">
                                {Math.round(initialProject.progress ?? 0)}%
                            </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden">
                            <div
                                className="h-full bg-[color:var(--primary)] rounded-full transition-all duration-300"
                                style={{ width: `${initialProject.progress ?? 0}%` }}
                            />
                        </div>
                    </div>
                </Card>

                {/* ══ Navigation Tabs (Tasks, Chat, Files, Timeline, Overview, Committees) ══ */}
                <div className="border-b border-[color:var(--border)] flex space-x-2 overflow-x-auto">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-3 px-3 text-[14px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                                    isActive
                                        ? 'border-[color:var(--primary)] text-[color:var(--primary)] font-semibold'
                                        : 'border-transparent text-[color:var(--muted)] hover:text-[color:var(--text)]'
                                }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count !== undefined && (
                                    <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-[color:var(--soft-surface)] text-[color:var(--muted)] border border-[color:var(--border)] tabular-nums">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ══ TAB CONTENTS ══ */}

                {/* ── TAB: TASKS ── */}
                {activeTab === 'tasks' && (
                    <Card className="p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[color:var(--border)]">
                            <div>
                                <h2 className="text-[16px] font-bold text-[color:var(--text)]">Project tasks</h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                    Operational deliverables across all committees
                                </p>
                            </div>
                        </div>

                        {allTasks.length === 0 ? (
                            <EmptyState
                                title="No tasks created yet"
                                description="Tasks are created inside committee activities by Project Staff to delegate work."
                            />
                        ) : (
                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="border-b border-[color:var(--border)] text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                            <th className="py-2.5 pr-4">Task</th>
                                            <th className="py-2.5 px-3">Committee & Activity</th>
                                            <th className="py-2.5 px-3">Assignee</th>
                                            <th className="py-2.5 px-3">Status</th>
                                            <th className="py-2.5 pl-3">Due date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)]">
                                        {paginatedTasks.map((task) => (
                                            <tr key={task.id} className="hover:bg-[color:var(--soft-surface)] transition-colors">
                                                <td className="py-3 pr-4">
                                                    <Link
                                                        href={`/projects/${initialProject.id}/committees/${task.committee.id}/activities/${task.activity.id}`}
                                                        className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors block truncate"
                                                    >
                                                        {task.title}
                                                    </Link>
                                                    {task.description && (
                                                        <p className="text-[11px] text-[color:var(--muted)] truncate max-w-sm mt-0.5">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3">
                                                    <span className="font-medium text-[color:var(--text)] block truncate">
                                                        {task.activity.title}
                                                    </span>
                                                    <span className="text-[11px] text-[color:var(--muted)]">
                                                        {task.committee.name}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap text-[color:var(--muted)]">
                                                    {task.assignee?.name || <span className="italic">Unassigned</span>}
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <Badge variant={task.status === 'Completed' ? 'accent' : task.status === 'Under Review' ? 'secondary' : task.status === 'Returned' ? 'danger' : 'soft'}>
                                                        {task.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pl-3 whitespace-nowrap tabular-nums text-[color:var(--muted)]">
                                                    {task.due_date || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Tasks Client Pagination */}
                        {totalTasks > 0 && (
                            <div className="pt-2 border-t border-[color:var(--border)]">
                                <Pagination
                                    currentPage={safeTaskPage}
                                    totalPages={totalTaskPages}
                                    totalItems={totalTasks}
                                    pageSize={taskPageSize}
                                    onPageChange={setTaskPage}
                                    onPageSizeChange={setTaskPageSize}
                                    pageSizeOptions={[10, 25, 50]}
                                />
                            </div>
                        )}
                    </Card>
                )}

                {/* ── TAB: CHAT ── */}
                {activeTab === 'chat' && (
                    <Card className="p-6 text-center space-y-4">
                        <div className="w-12 h-12 rounded-[8px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)] mx-auto">
                            <MessageSquare className="w-6 h-6 stroke-[2]" />
                        </div>
                        <div className="max-w-md mx-auto space-y-1">
                            <h2 className="text-[18px] font-bold text-[color:var(--text)]">Project group chat</h2>
                            <p className="text-[14px] text-[color:var(--muted)]">
                                Collaborate with team members, share progress updates, and create tasks directly from conversation threads.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Link href={`/chat/${initialProject.id}`}>
                                <Button variant="primary" size="md">
                                    <span>Open project chat</span>
                                    <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Button>
                            </Link>
                        </div>
                    </Card>
                )}

                {/* ── TAB: FILES (Documents) ── */}
                {activeTab === 'files' && (
                    <Card className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                            <div>
                                <h2 className="text-[16px] font-bold text-[color:var(--text)]">Project files and documents</h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                    Official memos, activity designs, approval letters, and course submissions
                                </p>
                            </div>
                            {initialProject.can?.uploadDocument && (
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        resetDocForm();
                                        clearDocErrors();
                                        setIsUploadDocumentModalOpen(true);
                                    }}
                                >
                                    <Upload className="w-4 h-4 mr-1.5" strokeWidth={2} />
                                    <span>Attach file</span>
                                </Button>
                            )}
                        </div>

                        {allDocuments.length === 0 ? (
                            <EmptyState
                                title="No documents attached"
                                description="Approval documents such as official project charters or adviser letters will appear here."
                                actionLabel={initialProject.can?.uploadDocument ? "Attach first document" : undefined}
                                onAction={initialProject.can?.uploadDocument ? () => setIsUploadDocumentModalOpen(true) : undefined}
                            />
                        ) : (
                            <div className="divide-y divide-[color:var(--border)]">
                                {paginatedDocuments.map((doc) => (
                                    <div key={doc.id} className="py-3.5 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-[6px] bg-[color:var(--soft-surface)] border border-[color:var(--border)] flex items-center justify-center text-[color:var(--primary)] shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-semibold text-[color:var(--text)] truncate">
                                                    {doc.original_name}
                                                </p>
                                                <p className="text-[12px] text-[color:var(--muted)] mt-0.5">
                                                    {formatFileSize(doc.file_size)} · Uploaded {doc.uploaded_at || 'upon creation'}
                                                </p>
                                            </div>
                                        </div>

                                        {doc.download_url && (
                                            <a
                                                href={doc.download_url}
                                                download={doc.original_name}
                                                className="shrink-0"
                                            >
                                                <Button variant="outline" size="sm">
                                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                                    <span>Download</span>
                                                </Button>
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Files Client Pagination */}
                        {totalFiles > 0 && (
                            <div className="pt-2 border-t border-[color:var(--border)]">
                                <Pagination
                                    currentPage={safeFilesPage}
                                    totalPages={totalFilesPages}
                                    totalItems={totalFiles}
                                    pageSize={filesPageSize}
                                    onPageChange={setFilesPage}
                                    onPageSizeChange={setFilesPageSize}
                                    pageSizeOptions={[5, 10, 25]}
                                />
                            </div>
                        )}
                    </Card>
                )}

                {/* ── TAB: TIMELINE ── */}
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        <GanttTimeline timeline={timelineData} />
                    </div>
                )}

                {/* ── TAB: OVERVIEW ── */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <Card className="p-5 space-y-3">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                                Total deliverables
                            </span>
                            <p className="text-[28px] font-bold text-[color:var(--text)] tabular-nums">
                                {allTasks.length}
                            </p>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                {allTasks.filter(t => t.status === 'Completed').length} completed
                            </p>
                        </Card>

                        <Card className="p-5 space-y-3">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                                Active committees
                            </span>
                            <p className="text-[28px] font-bold text-[color:var(--text)] tabular-nums">
                                {allCommittees.length}
                            </p>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Functional team divisions
                            </p>
                        </Card>

                        <Card className="p-5 space-y-3">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                                Document attachments
                            </span>
                            <p className="text-[28px] font-bold text-[color:var(--text)] tabular-nums">
                                {allDocuments.length}
                            </p>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Official MOVs and approval files
                            </p>
                        </Card>
                    </div>
                )}

                {/* ── TAB: COMMITTEES ── */}
                {activeTab === 'committees' && (
                    <div className="space-y-5">
                        {allCommittees.length === 0 ? (
                            <EmptyState
                                title="No committees established"
                                description="Organize your project into functional committees headed by designated Project Staff members."
                                actionLabel={canCreateCommittee ? "+ Add committee" : undefined}
                                onAction={canCreateCommittee ? () => setIsCreateCommitteeModalOpen(true) : undefined}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {allCommittees.map((comm) => (
                                    <Card key={comm.id} className="p-5 space-y-3 flex flex-col justify-between hover:border-[color:var(--primary)] transition-colors">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-[16px] font-bold text-[color:var(--text)] truncate">
                                                    {comm.name}
                                                </h3>
                                                <span className="text-[12px] font-bold text-[color:var(--text)] tabular-nums">
                                                    {comm.progress}%
                                                </span>
                                            </div>

                                            {comm.description && (
                                                <p className="text-[13px] text-[color:var(--muted)] line-clamp-2">
                                                    {comm.description}
                                                </p>
                                            )}

                                            <div className="text-[12px] text-[color:var(--muted)] space-y-1 pt-1">
                                                <p>Staff: <span className="font-medium text-[color:var(--text)]">{comm.leadName || 'Unassigned'}</span></p>
                                                <p>{comm.membersCount} members · {comm.activitiesCount} activities</p>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-between">
                                            <Link href={`/projects/${initialProject.id}/committees/${comm.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Open workspace
                                                </Button>
                                            </Link>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ══ MODALS (Edit Project, Archive, Create Committee, Upload Document) ══ */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => !editProcessing && setIsEditModalOpen(false)}
                title="Edit project details"
                maxWidth="md"
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <FormField
                        label="Project title"
                        name="title"
                        value={editData.title}
                        onChange={(e) => setEditData('title', e.target.value)}
                        error={editErrors.title}
                        required
                    />

                    <div>
                        <Label>Description</Label>
                        <textarea
                            rows={3}
                            value={editData.description}
                            onChange={(e) => setEditData('description', e.target.value)}
                            className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px]"
                        />
                        <InputError message={editErrors.description} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={editProcessing}
                        >
                            Save changes
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Archive Confirmation Modal */}
            <Modal
                isOpen={isArchiveModalOpen}
                onClose={() => !archiveProcessing && setIsArchiveModalOpen(false)}
                title="Archive project"
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <p className="text-[14px] text-[color:var(--muted)]">
                        Are you sure you want to archive <strong>{initialProject.title}</strong>? All deliverables and records will remain preserved for audit.
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsArchiveModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            isLoading={archiveProcessing}
                            onClick={handleArchiveConfirm}
                        >
                            Archive
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Create Committee Modal */}
            <Modal
                isOpen={isCreateCommitteeModalOpen}
                onClose={() => !committeeProcessing && setIsCreateCommitteeModalOpen(false)}
                title="Create committee"
                maxWidth="md"
            >
                <form onSubmit={handleCreateCommitteeSubmit} className="space-y-4">
                    <FormField
                        label="Committee name"
                        name="name"
                        value={committeeData.name}
                        onChange={(e) => setCommitteeData('name', e.target.value)}
                        error={committeeErrors.name}
                        required
                    />

                    <div>
                        <Label>Description</Label>
                        <textarea
                            rows={3}
                            value={committeeData.description}
                            onChange={(e) => setCommitteeData('description', e.target.value)}
                            className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px]"
                        />
                        <InputError message={committeeErrors.description} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsCreateCommitteeModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={committeeProcessing}
                        >
                            Create committee
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Upload Document Modal */}
            <Modal
                isOpen={isUploadDocumentModalOpen}
                onClose={() => !docProcessing && setIsUploadDocumentModalOpen(false)}
                title="Attach project document"
                maxWidth="md"
            >
                <form onSubmit={handleUploadDocumentSubmit} className="space-y-4">
                    <FormField
                        label="Document title"
                        name="original_name"
                        value={docData.original_name}
                        onChange={(e) => setDocData('original_name', e.target.value)}
                        error={docErrors.original_name}
                        placeholder="e.g. Dean Approval Letter"
                        required
                    />

                    <div>
                        <Label>File (PDF, Docx, or Image, max 10MB)</Label>
                        <input
                            type="file"
                            ref={docFileInputRef}
                            onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setDocData('document', f);
                                if (f && !docData.original_name) {
                                    setDocData('original_name', f.name.replace(/\.[^/.]+$/, ''));
                                }
                            }}
                            className="w-full mt-1 p-2 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px]"
                            required
                        />
                        <InputError message={docErrors.document} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsUploadDocumentModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={docProcessing}
                        >
                            Upload file
                        </Button>
                    </div>
                </form>
            </Modal>
        </AppLayout>
    );
}
