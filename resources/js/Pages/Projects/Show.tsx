import React, { useState, useEffect, useRef } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { type ProjectRole } from '@/Config/navigation';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import {
    FolderOpen,
    Calendar,
    Users,
    User,
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
    AlertTriangle,
    Archive,
    Download,
    UserPlus,
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
    due_date?: string | null;
    due_date_raw?: string | null;
    committee: {
        id: string;
        name: string;
    };
    tasksCount: number;
    completedTasksCount: number;
    creator?: {
        id: number;
        name: string;
    } | null;
}

export interface ProjectTaskItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    due_date?: string | null;
    due_date_raw?: string | null;
    activity: {
        id: string;
        title: string;
    };
    committee: {
        id: string;
        name: string;
    };
    assignee?: {
        id: number;
        name: string;
        email: string;
    } | null;
}

export interface ProjectData {
    id: string;
    title: string;
    description: string | null;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
    start_date_raw?: string | null;
    end_date_raw?: string | null;
    created_at?: string | null;
    role?: ProjectRole;
    can?: {
        update?: boolean;
        archive?: boolean;
        uploadDocument?: boolean;
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
}

export interface ProjectShowProps {
    projectId?: string;
    project?: ProjectData | null;
}

type TabKey = 'overview' | 'committees' | 'activities' | 'tasks' | 'timeline';

interface ProjectDocument {
    id: string;
    title: string;
    type: string;
    status: 'Approved' | 'Verified' | 'Pending';
    updatedAt: string;
    size: string;
    downloadUrl?: string;
}

// ─── Status Badge Component ──────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: string }) {
    const isArchived = status === 'Archived';
    const isCompleted = status === 'Completed';
    const isPlanning = status === 'Planning';

    const colorClasses = isArchived
        ? 'bg-slate-100 text-slate-700 border-slate-300'
        : isCompleted
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : isPlanning
        ? 'bg-slate-50 text-slate-700 border-slate-200'
        : 'bg-sky-50 text-sky-700 border-sky-200';

    const dotColor = isArchived
        ? 'bg-slate-500'
        : isCompleted
        ? 'bg-emerald-500'
        : isPlanning
        ? 'bg-slate-400'
        : 'bg-sky-500';

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
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

function ActivityStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; border: string; dot: string }> = {
        'To Do': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
        'In Progress': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
        'Under Review': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
        'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
        'Returned for Revision': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    };

    const style = config[status] || config['To Do'];

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
            <span>{status}</span>
        </span>
    );
}

function TaskStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; border: string; dot: string }> = {
        'To Do': { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' },
        'In Progress': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
        'Completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    };

    const style = config[status] || config['To Do'];

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.bg} ${style.text} ${style.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
            <span>{status}</span>
        </span>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
}

function getInitials(name: string): string {
    if (!name) return 'PL';
    return name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

// ─── Main Project Detail Page Shell ───────────────────────────────────────────
export default function ProjectShow({ projectId: _projectId, project: initialProject }: ProjectShowProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('overview');

    // Role-aware authorization (Project Leader only for edit and archive)
    const isLeader = initialProject
        ? (initialProject.can?.update ?? initialProject.role === 'Project Leader')
        : true;

    // Modals state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [archiveProcessing, setArchiveProcessing] = useState(false);
    const [isCreateCommitteeModalOpen, setIsCreateCommitteeModalOpen] = useState(false);
    const [isEditCommitteeModalOpen, setIsEditCommitteeModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState<CommitteeItem | null>(null);
    const [isAssignPersonnelModalOpen, setIsAssignPersonnelModalOpen] = useState(false);

    // Edit Project form state
    const {
        data: editData,
        setData: setEditData,
        patch: submitEdit,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        title: initialProject?.title ?? '',
        description: initialProject?.description ?? '',
        start_date: initialProject?.start_date_raw ?? '',
        end_date: initialProject?.end_date_raw ?? '',
        status: initialProject?.status ?? 'Planning',
    });

    // Create Committee form state
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

    // Edit Committee form state
    const {
        data: editCommitteeData,
        setData: setEditCommitteeData,
        patch: submitEditCommittee,
        processing: editCommitteeProcessing,
        errors: editCommitteeErrors,
        reset: resetEditCommitteeForm,
        clearErrors: clearEditCommitteeErrors,
    } = useForm({
        name: '',
        description: '',
        user_id: '',
    });

    // Assign Personnel form state
    const {
        data: personnelData,
        setData: setPersonnelData,
        post: submitPersonnel,
        processing: personnelProcessing,
        errors: personnelErrors,
        reset: resetPersonnelForm,
        clearErrors: clearPersonnelErrors,
    } = useForm({
        user_id: '',
        role: 'Project Staff' as 'Project Staff' | 'Project Member',
    });

    useEffect(() => {
        if (initialProject) {
            setEditData({
                title: initialProject.title,
                description: initialProject.description ?? '',
                start_date: initialProject.start_date_raw ?? '',
                end_date: initialProject.end_date_raw ?? '',
                status: initialProject.status,
            });
        }
    }, [initialProject]);

    const handleOpenEditModal = () => {
        if (initialProject) {
            setEditData({
                title: initialProject.title,
                description: initialProject.description ?? '',
                start_date: initialProject.start_date_raw ?? '',
                end_date: initialProject.end_date_raw ?? '',
                status: initialProject.status,
            });
        }
        clearEditErrors();
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || editProcessing) {
            return;
        }

        submitEdit(`/projects/${initialProject.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditModalOpen(false);
            },
        });
    };

    const handleArchiveConfirm = () => {
        if (!initialProject || archiveProcessing) {
            return;
        }

        setArchiveProcessing(true);
        router.post(
            `/projects/${initialProject.id}/archive`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setArchiveProcessing(false),
                onSuccess: () => {
                    setIsArchiveModalOpen(false);
                },
            }
        );
    };

    const handleOpenCreateCommittee = () => {
        resetCommitteeForm();
        clearCommitteeErrors();
        setIsCreateCommitteeModalOpen(true);
    };

    const handleCreateCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject) return;

        submitCommittee(`/projects/${initialProject.id}/committees`, {
            onSuccess: () => {
                setIsCreateCommitteeModalOpen(false);
                resetCommitteeForm();
            },
        });
    };

    const handleOpenEditCommittee = (committee: CommitteeItem) => {
        setEditingCommittee(committee);
        setEditCommitteeData({
            name: committee.name,
            description: committee.description ?? '',
            user_id: committee.head?.id ? String(committee.head.id) : '',
        });
        clearEditCommitteeErrors();
        setIsEditCommitteeModalOpen(true);
    };

    const handleEditCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || !editingCommittee) return;

        submitEditCommittee(
            `/projects/${initialProject.id}/committees/${editingCommittee.id}`,
            {
                onSuccess: () => {
                    setIsEditCommitteeModalOpen(false);
                    setEditingCommittee(null);
                    resetEditCommitteeForm();
                },
            }
        );
    };

    const handleOpenAssignPersonnel = () => {
        resetPersonnelForm();
        clearPersonnelErrors();
        setIsAssignPersonnelModalOpen(true);
    };

    const handleAssignPersonnelSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject) return;

        submitPersonnel(`/projects/${initialProject.id}/personnel`, {
            onSuccess: () => {
                setIsAssignPersonnelModalOpen(false);
                resetPersonnelForm();
            },
        });
    };

    // Informational placeholder notification for actions that will be implemented in later steps
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    const handleActionClick = (actionName: string) => {
        setActionNotice(
            `"${actionName}" will be available when project management is connected.`
        );
    };

    // Document upload state
    const [isUploadDocumentModalOpen, setIsUploadDocumentModalOpen] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);

    const {
        data: docData,
        setData: setDocData,
        post: submitDocument,
        processing: docProcessing,
        errors: docErrors,
        reset: resetDocForm,
        clearErrors: clearDocErrors,
    } = useForm<{ approval_document: File | null }>({
        approval_document: null,
    });

    const handleOpenUploadDocumentModal = () => {
        resetDocForm();
        clearDocErrors();
        if (docFileInputRef.current) docFileInputRef.current.value = '';
        setIsUploadDocumentModalOpen(true);
    };

    const handleCloseUploadDocumentModal = () => {
        if (docProcessing) return;
        setIsUploadDocumentModalOpen(false);
        resetDocForm();
        clearDocErrors();
        if (docFileInputRef.current) docFileInputRef.current.value = '';
    };

    const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setDocData('approval_document', file);
    };

    const handleRemoveDocFile = () => {
        if (docProcessing) return;
        setDocData('approval_document', null);
        if (docFileInputRef.current) docFileInputRef.current.value = '';
    };

    const handleUploadDocumentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || !docData.approval_document || docProcessing) return;

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

    // Not-found / unauthorized state when project could not be loaded
    if (!initialProject) {
        return (
            <AppLayout title="Project Not Found" subtitle="Project Workspace">
                <Head title="Project Not Found — ITASK" />
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-bold text-[color:var(--color-text-main)]">Project Not Found</h2>
                    <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-2 mb-6 leading-relaxed">
                        This project could not be found or you do not have permission to view it.
                    </p>
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors"
                        style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Projects
                    </Link>
                </div>
            </AppLayout>
        );
    }

    // ─── Data derivations (initialProject is guaranteed non-null here) ───────────────

    const displayCommittees: CommitteeItem[] = initialProject.committees ?? [];

    const leaderUser = initialProject.leader ?? null;
    const hasLeader = Boolean(leaderUser && leaderUser.name);
    const leaderName = hasLeader ? leaderUser!.name : 'No Project Leader assigned';
    const leaderEmail = hasLeader ? leaderUser!.email : null;

    const project = {
        id: String(initialProject.id),
        title: initialProject.title,
        description: initialProject.description?.trim() || null,
        status: initialProject.status,
        role: (initialProject.role ?? 'Project Leader') as ProjectRole,
        progress: 0,
        deadline: initialProject.end_date ?? 'No deadline specified',
        startDate: initialProject.start_date ?? 'Not set',
        leader: leaderUser,
        hasLeader,
        leaderName,
        leaderEmail,
        creator: initialProject.creator ?? null,
        summary: {
            committees: initialProject.committees?.length ?? 0,
            activities: initialProject.activities?.length ?? 0,
            tasks: initialProject.tasks?.length ?? 0,
        },
    };

    const displayDocuments: ProjectDocument[] = (initialProject.documents ?? []).map((d) => ({
        id: d.id,
        title: d.original_name,
        type: d.mime_type.includes('pdf')
            ? 'PDF Document'
            : (d.mime_type.includes('image') || d.mime_type.includes('png') || d.mime_type.includes('jpeg')
                ? 'Image File'
                : (d.mime_type.includes('word') || d.mime_type.includes('officedocument')
                    ? 'Word Document'
                    : 'Official Document')),
        status: 'Approved' as const,
        updatedAt: d.uploaded_at ?? 'Uploaded upon creation',
        size: formatFileSize(d.file_size),
        downloadUrl: d.download_url,
    }));

    const recentActivities = (initialProject.activities ?? []).slice(0, 5);

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
            title={project.title}
            subtitle="Project Workspace & Hierarchy Overview"
            currentProject={{
                title: project.title,
                role: project.role,
                status: project.status,
            }}
        >
            <Head title={`${project.title} — ITASK`} />

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
                        {project.title}
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
                                <ProjectStatusBadge status={project.status} />
                                <ProjectRoleBadge role={project.role} />
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--color-text-main)] leading-snug">
                                {project.title}
                            </h1>

                            {project.description ? (
                                <p className="text-xs sm:text-sm text-[color:var(--color-text-muted)] leading-relaxed">
                                    {project.description}
                                </p>
                            ) : (
                                <p className="text-xs sm:text-sm text-slate-400 italic">
                                    No project description provided.
                                </p>
                            )}
                        </div>

                        {/* Right: Project Actions Area */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
                            {isLeader && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleOpenEditModal}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer"
                                        title="Edit project details"
                                    >
                                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                        <span>Edit Project</span>
                                    </button>

                                    {project.status !== 'Archived' ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsArchiveModalOpen(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                            title="Archive project"
                                        >
                                            <Archive className="w-3.5 h-3.5 text-rose-600" />
                                            <span>Archive</span>
                                        </button>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200">
                                            <Archive className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Archived</span>
                                        </span>
                                    )}
                                </>
                            )}

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

                    {/* Key Project Information & Leadership Grid */}
                    <div className="mt-5 pt-4 border-t border-[color:var(--color-border-light)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 1. Project Leader */}
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                project.hasLeader
                                    ? 'bg-orange-100 text-[color:var(--color-brand-action-orange)] border border-orange-200'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}>
                                {project.hasLeader ? getInitials(project.leaderName) : <User className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                    Project Leader
                                </p>
                                <p className={`text-xs font-bold truncate ${
                                    project.hasLeader
                                        ? 'text-[color:var(--color-text-main)]'
                                        : 'text-slate-400 italic'
                                }`} title={project.leaderName}>
                                    {project.leaderName}
                                </p>
                                {project.leaderEmail ? (
                                    <p className="text-[11px] text-[color:var(--color-text-subtle)] truncate" title={project.leaderEmail}>
                                        {project.leaderEmail}
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic">
                                        {project.hasLeader ? 'Institutional Personnel' : 'Role assignment pending'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 2. Project Status */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                                <Shield className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                    Project Status
                                </p>
                                <div className="mt-0.5">
                                    <ProjectStatusBadge status={project.status} />
                                </div>
                            </div>
                        </div>

                        {/* 3. Start Date */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                    Start Date
                                </p>
                                <p className="text-xs font-bold text-[color:var(--color-text-main)] truncate mt-0.5">
                                    {project.startDate !== 'Not set' ? project.startDate : <span className="text-slate-400 italic font-normal">Not set</span>}
                                </p>
                            </div>
                        </div>

                        {/* 4. Target Deadline */}
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-500">
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                    Target Deadline
                                </p>
                                <p className="text-xs font-bold text-[color:var(--color-text-main)] truncate mt-0.5">
                                    {project.deadline !== 'No deadline specified' ? project.deadline : <span className="text-slate-400 italic font-normal">No deadline set</span>}
                                </p>
                            </div>
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
                                {project.progress}% Complete
                            </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${project.progress}%`,
                                    backgroundColor: 'var(--color-brand-action-orange)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Archived Notice Banner ── */}
                {project.status === 'Archived' && (
                    <div className="p-4 rounded-xl border border-slate-300 bg-slate-100/90 flex items-start gap-3 text-xs text-slate-700 animate-in fade-in duration-200">
                        <Archive className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-800">This project is archived</p>
                            <p className="text-slate-600 mt-0.5 leading-relaxed">
                                This project is retained for institutional and audit records. All committees, tasks, activities, and official approval documents remain safely preserved.
                            </p>
                        </div>
                    </div>
                )}

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
                                            {project.summary.committees}
                                        </span>
                                    )}
                                    {tab.key === 'activities' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                            {project.summary.activities}
                                        </span>
                                    )}
                                    {tab.key === 'tasks' && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                                            {project.summary.tasks}
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
                                    {project.progress}%
                                </p>
                                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${project.progress}%`,
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
                                    {project.summary.committees}
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
                                    {project.summary.activities}
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
                                    {project.summary.tasks}
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
                                    {project.deadline !== 'No deadline specified' ? project.deadline : <span className="text-slate-400 italic font-normal">Not set</span>}
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
                                    <p className="text-[10px] text-emerald-800 font-semibold mt-1.5 truncate">
                                        Led by: {project.leaderName}
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
                                    {displayCommittees.length > 0 ? (
                                        displayCommittees.map((committee) => (
                                            <Link
                                                key={committee.id}
                                                href={`/projects/${project.id}/committees/${committee.id}`}
                                                className="block p-4 rounded-lg border border-[color:var(--color-border-light)] hover:border-slate-300 transition-colors bg-white space-y-2.5"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-[color:var(--color-text-main)] hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                                            {committee.name}
                                                        </h4>
                                                        <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                            Led by {committee.leadName}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[11px] font-semibold text-[color:var(--color-text-muted)]">
                                                            {committee.membersCount} members
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
                                            </Link>
                                        ))
                                    ) : (
                                        <div className="p-6 rounded-lg border border-dashed border-slate-200 text-center">
                                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs font-semibold text-slate-600">No committees established yet</p>
                                            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                                                Functional committees and assigned working groups will appear here once created.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right (1 col): Recent Project Activity */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                        Recent Activities
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Latest activities across committee workflows
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {recentActivities.length > 0 ? (
                                        recentActivities.map((activity, index) => (
                                            <div key={activity.id} className="relative flex items-start gap-3">
                                                {/* Step dot and line */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0">
                                                        <Clock className="w-3.5 h-3.5" />
                                                    </div>
                                                    {index < recentActivities.length - 1 && (
                                                        <div className="w-px h-8 bg-slate-200 mt-1" />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 pt-0.5">
                                                    <p className="text-xs font-semibold text-[color:var(--color-text-main)] leading-snug">
                                                        {activity.title}
                                                    </p>
                                                    <p className="text-[11px] text-[color:var(--color-text-muted)] truncate mt-0.5">
                                                        {activity.committee?.name ?? 'Project Activity'}
                                                        {activity.creator ? ` · ${activity.creator.name}` : ''}
                                                    </p>
                                                    {activity.status && (
                                                        <p className="text-[10px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                            Status: {activity.status}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-6 text-center">
                                            <ListTodo className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                            <p className="text-xs font-semibold text-slate-500">No activities yet</p>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                Committee activities will appear here once created.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 4. Project Supporting & Approval Documents Section */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                        Project Approval Documents
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Official project memos, activity designs, and dean approval letters
                                    </p>
                                </div>
                                {(initialProject.can?.uploadDocument) && (
                                    <button
                                        type="button"
                                        onClick={handleOpenUploadDocumentModal}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-90 transition-opacity cursor-pointer shadow-xs self-start sm:self-auto"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                        <span>+ Attach Document</span>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                {displayDocuments.length > 0 ? (
                                    displayDocuments.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="p-3.5 rounded-lg border border-[color:var(--color-border-light)] bg-white flex flex-col gap-3"
                                        >
                                            {/* Document header */}
                                            <div className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[color:var(--color-text-main)] truncate" title={doc.title}>
                                                        {doc.title}
                                                    </p>
                                                    <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                        {doc.type} · {doc.size}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            {doc.status}
                                                        </span>
                                                        <span className="text-[10px] text-[color:var(--color-text-subtle)]">
                                                            {doc.updatedAt}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Document actions */}
                                            {doc.downloadUrl && (
                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                                    {/* View — opens in new tab if browser can display */}
                                                    <a
                                                        href={`${doc.downloadUrl}?inline=1`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-[color:var(--color-text-main)] bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors"
                                                        title="Open document in browser"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        View
                                                    </a>
                                                    {/* Download — forces file download */}
                                                    <a
                                                        href={doc.downloadUrl}
                                                        download={doc.title}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors"
                                                        title="Download document"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Download
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-3 py-8 text-center rounded-lg border border-dashed border-slate-200">
                                        <FileText className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-semibold text-slate-500">No documents attached</p>
                                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                                            Approval documents — such as the official project memo or dean approval letter — will appear here.
                                        </p>
                                        {(initialProject.can?.uploadDocument) && (
                                            <button
                                                type="button"
                                                onClick={handleOpenUploadDocumentModal}
                                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                Attach First Document
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* ── TAB 2: COMMITTEES ── */}
                {activeTab === 'committees' && (
                    <div className="space-y-6">
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
                                {isLeader && (
                                    <div className="flex items-center gap-2 self-start sm:self-auto">
                                        <button
                                            type="button"
                                            onClick={handleOpenAssignPersonnel}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
                                        >
                                            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                                            <span>Assign Personnel</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateCommittee}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                        >
                                            <span>+ Add Committee</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {displayCommittees.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {displayCommittees.map((committee) => (
                                        <div
                                            key={committee.id}
                                            className="p-5 rounded-xl border border-[color:var(--color-border-light)] bg-white space-y-3.5 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between"
                                        >
                                            <div className="space-y-2.5">
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
                                                {committee.description && (
                                                    <p className="text-xs text-slate-500 line-clamp-2">
                                                        {committee.description}
                                                    </p>
                                                )}
                                                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[color:var(--color-text-subtle)] text-[11px]">Head:</span>
                                                        <span className="font-semibold text-slate-800">{committee.leadName}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[color:var(--color-text-subtle)] text-[11px]">Members:</span>
                                                        <span className="font-semibold text-slate-800">{committee.membersCount} members</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                                                <Link
                                                    href={`/projects/${project.id}/committees/${committee.id}`}
                                                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                                                >
                                                    <span>View Committee</span>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                </Link>
                                                {isLeader && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditCommittee(committee)}
                                                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer"
                                                        title="Edit Committee"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                                        <span>Edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                                    <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <h4 className="text-sm font-bold text-slate-800">
                                        No Committees Established
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                        Organize your project into functional committees. Each committee is headed by a designated Project Staff member and supported by Project Members.
                                    </p>
                                    {isLeader && (
                                        <div className="mt-4 flex items-center justify-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleOpenCreateCommittee}
                                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                            >
                                                <span>+ Create Committee</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Project Personnel Roster */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                                <div>
                                    <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                        Project Roster & Roles
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Assigned personnel who can head or participate in committees
                                    </p>
                                </div>
                                {isLeader && (
                                    <button
                                        type="button"
                                        onClick={handleOpenAssignPersonnel}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
                                    >
                                        <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Assign Personnel</span>
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Project Staff column */}
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-emerald-600" />
                                            <h4 className="text-xs font-bold text-slate-800">
                                                Project Staff ({initialProject?.projectStaff?.length ?? 0})
                                            </h4>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            Eligible Committee Heads
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {(initialProject?.projectStaff ?? []).map((staff) => (
                                            <div
                                                key={staff.id}
                                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-800">{staff.name}</p>
                                                    <p className="text-[11px] text-slate-500">{staff.email}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                                    Staff
                                                </span>
                                            </div>
                                        ))}
                                        {(initialProject?.projectStaff ?? []).length === 0 && (
                                            <p className="text-xs text-slate-400 italic py-2 text-center">
                                                No Project Staff assigned yet. Assign staff to designate committee heads.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Project Members column */}
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-sky-600" />
                                            <h4 className="text-xs font-bold text-slate-800">
                                                Project Members ({initialProject?.projectMembers?.length ?? 0})
                                            </h4>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            Working Groups
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {(initialProject?.projectMembers ?? []).map((member) => (
                                            <div
                                                key={member.id}
                                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                                            >
                                                <div>
                                                    <p className="font-semibold text-slate-800">{member.name}</p>
                                                    <p className="text-[11px] text-slate-500">{member.email}</p>
                                                </div>
                                                <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                                                    Member
                                                </span>
                                            </div>
                                        ))}
                                        {(initialProject?.projectMembers ?? []).length === 0 && (
                                            <p className="text-xs text-slate-400 italic py-2 text-center">
                                                No Project Members assigned yet. Assign members to participate in committees.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB 3: ACTIVITIES ── */}
                {activeTab === 'activities' && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                    Project Activities ({initialProject?.activities?.length ?? 0})
                                </h3>
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                    Committee milestones, tasks progress, and operational deliverables
                                </p>
                            </div>
                        </div>

                        {initialProject?.activities && initialProject.activities.length > 0 ? (
                            <div className="border border-[color:var(--color-border-light)] rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-[color:var(--color-border-light)] text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">Activity</th>
                                            <th className="px-4 py-3 hidden sm:table-cell">Committee</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 hidden md:table-cell">Tasks</th>
                                            <th className="px-4 py-3 hidden lg:table-cell">Due Date</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--color-border-light)] text-[color:var(--color-text-main)]">
                                        {initialProject.activities.map((act) => (
                                            <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-slate-800">{act.title}</div>
                                                    {act.description && (
                                                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{act.description}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 hidden sm:table-cell text-slate-600">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                                        {act.committee.name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <ActivityStatusBadge status={act.status} />
                                                </td>
                                                <td className="px-4 py-3.5 hidden md:table-cell text-slate-600">
                                                    <span className="font-medium">{act.completedTasksCount} / {act.tasksCount}</span>
                                                    <span className="text-slate-400 text-[11px]"> completed</span>
                                                </td>
                                                <td className="px-4 py-3.5 hidden lg:table-cell text-slate-500">
                                                    {act.due_date ?? <span className="text-slate-400 italic">No deadline</span>}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <Link
                                                        href={`/projects/${initialProject.id}/committees/${act.committee.id}/activities/${act.id}`}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline"
                                                    >
                                                        <span>View Details</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                                <ListTodo className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800">
                                    No Activities Created Yet
                                </h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                    Project Staff can create activities within their assigned committees to establish deliverables and milestones.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── TAB 4: TASKS ── */}
                {activeTab === 'tasks' && (
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                    Project Tasks ({initialProject?.tasks?.length ?? 0})
                                </h3>
                                <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                    Operational assignments and status tracking across all committees
                                </p>
                            </div>
                        </div>

                        {initialProject?.tasks && initialProject.tasks.length > 0 ? (
                            <div className="border border-[color:var(--color-border-light)] rounded-xl overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-[color:var(--color-border-light)] text-[11px] font-semibold text-[color:var(--color-text-muted)] uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">Task</th>
                                            <th className="px-4 py-3 hidden sm:table-cell">Activity & Committee</th>
                                            <th className="px-4 py-3 hidden md:table-cell">Assignee</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 hidden lg:table-cell">Due Date</th>
                                            <th className="px-4 py-3 text-right">Parent Activity</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--color-border-light)] text-[color:var(--color-text-main)]">
                                        {initialProject.tasks.map((task) => (
                                            <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-slate-800">{task.title}</div>
                                                    {task.description && (
                                                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 hidden sm:table-cell">
                                                    <div className="font-medium text-slate-700">{task.activity.title}</div>
                                                    <div className="text-[11px] text-slate-500">{task.committee.name}</div>
                                                </td>
                                                <td className="px-4 py-3.5 hidden md:table-cell">
                                                    {task.assignee ? (
                                                        <span className="font-medium text-slate-800">{task.assignee.name}</span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <TaskStatusBadge status={task.status} />
                                                </td>
                                                <td className="px-4 py-3.5 hidden lg:table-cell text-slate-500">
                                                    {task.due_date ?? <span className="text-slate-400 italic">No deadline</span>}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <Link
                                                        href={`/projects/${initialProject.id}/committees/${task.committee.id}/activities/${task.activity.id}`}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline"
                                                    >
                                                        <span>View Activity</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 text-center">
                                <CheckSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800">
                                    No Tasks Created Yet
                                </h4>
                                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                    Tasks are created under activities within each committee by Project Staff to delegate operational duties.
                                </p>
                            </div>
                        )}
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

                {/* ── Edit Project Modal ── */}
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={() => !editProcessing && setIsEditModalOpen(false)}
                    title="Edit Project"
                    description="Update project details and settings. Only assigned Project Leaders may edit project details."
                    maxWidth="md"
                >
                    <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Project Title"
                            id="edit-project-title"
                            name="title"
                            value={editData.title}
                            onChange={(e) => setEditData('title', e.target.value)}
                            error={editErrors.title}
                            required
                            placeholder="e.g., CCIS General Assembly 2026"
                            autoFocus
                        />

                        <div className="space-y-1">
                            <Label htmlFor="edit-project-description">Description</Label>
                            <textarea
                                id="edit-project-description"
                                name="description"
                                rows={3}
                                value={editData.description}
                                onChange={(e) => setEditData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Brief project charter, scope, or background..."
                            />
                            <InputError message={editErrors.description} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                label="Start Date"
                                id="edit-project-start-date"
                                type="date"
                                value={editData.start_date}
                                onChange={(e) => setEditData('start_date', e.target.value)}
                                error={editErrors.start_date}
                            />

                            <FormField
                                label="End Date"
                                id="edit-project-end-date"
                                type="date"
                                value={editData.end_date}
                                onChange={(e) => setEditData('end_date', e.target.value)}
                                error={editErrors.end_date}
                                helperText="Target conclusion date"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit-project-status">Status</Label>
                            <select
                                id="edit-project-status"
                                name="status"
                                value={editData.status}
                                onChange={(e) => setEditData('status', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                            >
                                <option value="Planning">Planning</option>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="Archived">Archived</option>
                            </select>
                            <InputError message={editErrors.status} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditModalOpen(false)}
                                disabled={editProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={editProcessing}
                                disabled={editProcessing}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Archive Confirmation Modal ── */}
                <Modal
                    isOpen={isArchiveModalOpen}
                    onClose={() => !archiveProcessing && setIsArchiveModalOpen(false)}
                    title="Archive Project"
                    description="Please review before archiving this project workspace."
                    maxWidth="md"
                >
                    <div className="space-y-4 pt-1">
                        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="font-semibold">
                                    Are you sure you want to archive &ldquo;{project.title}&rdquo;?
                                </p>
                                <p className="text-amber-800 leading-relaxed">
                                    The project will be marked as <strong>Archived</strong> and will no longer be treated as an active project.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600 space-y-1.5">
                            <p className="font-medium text-slate-800">What happens when you archive:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-600">
                                <li>Existing project data and records are safely retained in the database.</li>
                                <li>Committees, activities, and tasks will remain intact.</li>
                                <li>Official approval documents remain securely accessible to assigned members.</li>
                                <li>The project will be visibly marked as Archived in project lists and details.</li>
                            </ul>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsArchiveModalOpen(false)}
                                disabled={archiveProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={handleArchiveConfirm}
                                isLoading={archiveProcessing}
                                disabled={archiveProcessing}
                            >
                                Confirm Archive
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* ── Create Committee Modal ── */}
                <Modal
                    isOpen={isCreateCommitteeModalOpen}
                    onClose={() => !committeeProcessing && setIsCreateCommitteeModalOpen(false)}
                    title="Create Committee"
                    description="Establish a functional committee under this project and designate an assigned Project Staff member as head."
                    maxWidth="md"
                >
                    <form onSubmit={handleCreateCommitteeSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Committee Name"
                            id="create-committee-name"
                            name="name"
                            value={committeeData.name}
                            onChange={(e) => setCommitteeData('name', e.target.value)}
                            error={committeeErrors.name}
                            required
                            placeholder="e.g., Logistics & Procurement Committee"
                            autoFocus
                        />

                        <div className="space-y-1">
                            <Label htmlFor="create-committee-description">Description (Optional)</Label>
                            <textarea
                                id="create-committee-description"
                                name="description"
                                rows={3}
                                value={committeeData.description}
                                onChange={(e) => setCommitteeData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Mandate, responsibilities, or scope of this committee..."
                            />
                            <InputError message={committeeErrors.description} />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="create-committee-staff">Committee Head (Project Staff - Optional)</Label>
                            {(initialProject?.projectStaff ?? []).length > 0 ? (
                                <select
                                    id="create-committee-staff"
                                    name="user_id"
                                    value={committeeData.user_id}
                                    onChange={(e) => setCommitteeData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="">-- Optional / Assign Later --</option>
                                    {(initialProject?.projectStaff ?? []).map((staff) => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} ({staff.email})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                                    <p>
                                        No <strong>Project Staff</strong> have been assigned to this project yet. You can create this committee now and assign a committee head later.
                                    </p>
                                </div>
                            )}
                            <InputError message={committeeErrors.user_id} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateCommitteeModalOpen(false)}
                                disabled={committeeProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={committeeProcessing}
                                disabled={committeeProcessing}
                            >
                                Create Committee
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Edit Committee Modal ── */}
                <Modal
                    isOpen={isEditCommitteeModalOpen}
                    onClose={() => !editCommitteeProcessing && setIsEditCommitteeModalOpen(false)}
                    title="Edit Committee"
                    description="Update committee name, charter description, or designated Project Staff head."
                    maxWidth="md"
                >
                    <form onSubmit={handleEditCommitteeSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Committee Name"
                            id="edit-committee-name"
                            name="name"
                            value={editCommitteeData.name}
                            onChange={(e) => setEditCommitteeData('name', e.target.value)}
                            error={editCommitteeErrors.name}
                            required
                            placeholder="e.g., Logistics & Procurement Committee"
                            autoFocus
                        />

                        <div className="space-y-1">
                            <Label htmlFor="edit-committee-description">Description (Optional)</Label>
                            <textarea
                                id="edit-committee-description"
                                name="description"
                                rows={3}
                                value={editCommitteeData.description}
                                onChange={(e) => setEditCommitteeData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Mandate, responsibilities, or scope of this committee..."
                            />
                            <InputError message={editCommitteeErrors.description} />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="edit-committee-staff">Committee Head (Project Staff - Optional)</Label>
                            {(initialProject?.projectStaff ?? []).length > 0 ? (
                                <select
                                    id="edit-committee-staff"
                                    name="user_id"
                                    value={editCommitteeData.user_id}
                                    onChange={(e) => setEditCommitteeData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="">-- Optional / Unassigned --</option>
                                    {(initialProject?.projectStaff ?? []).map((staff) => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} ({staff.email})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                                    <p>No Project Staff assigned yet to this project.</p>
                                </div>
                            )}
                            <InputError message={editCommitteeErrors.user_id} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditCommitteeModalOpen(false)}
                                disabled={editCommitteeProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={editCommitteeProcessing}
                                disabled={editCommitteeProcessing}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Assign Personnel Modal ── */}
                <Modal
                    isOpen={isAssignPersonnelModalOpen}
                    onClose={() => !personnelProcessing && setIsAssignPersonnelModalOpen(false)}
                    title="Assign Personnel to Project"
                    description="Assign verified institutional users to this project as Project Staff or Project Members."
                    maxWidth="md"
                >
                    <form onSubmit={handleAssignPersonnelSubmit} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label htmlFor="assign-personnel-user">Verified User *</Label>
                            {(initialProject?.availablePersonnel ?? []).length > 0 ? (
                                <select
                                    id="assign-personnel-user"
                                    name="user_id"
                                    value={personnelData.user_id}
                                    onChange={(e) => setPersonnelData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                    required
                                >
                                    <option value="">Select an institutional user...</option>
                                    {(initialProject?.availablePersonnel ?? []).map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.email})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-xs text-slate-500 italic p-2 rounded bg-slate-50 border border-slate-200">
                                    All eligible institutional users are already assigned to this project.
                                </p>
                            )}
                            <InputError message={personnelErrors.user_id} />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="assign-personnel-role">Project Role *</Label>
                            <select
                                id="assign-personnel-role"
                                name="role"
                                value={personnelData.role}
                                onChange={(e) => setPersonnelData('role', e.target.value as 'Project Staff' | 'Project Member')}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                required
                            >
                                <option value="Project Staff">Project Staff (can head committees)</option>
                                <option value="Project Member">Project Member (committee participant)</option>
                            </select>
                            <InputError message={personnelErrors.role} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAssignPersonnelModalOpen(false)}
                                disabled={personnelProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={personnelProcessing}
                                disabled={personnelProcessing || (initialProject?.availablePersonnel ?? []).length === 0}
                            >
                                Assign Personnel
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Upload Approval Document Modal ── */}
                <Modal
                    isOpen={isUploadDocumentModalOpen}
                    onClose={handleCloseUploadDocumentModal}
                    title="Upload Approval Document"
                    description="Upload an official project memo, activity design, or dean approval letter for this project."
                    maxWidth="md"
                >
                    <form onSubmit={handleUploadDocumentSubmit} className="space-y-4 pt-1">
                        <div className="space-y-1.5">
                            <Label htmlFor="upload-approval-document" required>
                                Select Document File
                            </Label>
                            <div className="p-3 border border-dashed border-slate-300 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                {docData.approval_document ? (
                                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-md border border-slate-200">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <FileText className="w-4 h-4 text-[color:var(--color-brand-action-orange)] shrink-0" />
                                            <span className="text-xs font-medium text-slate-800 truncate">
                                                {docData.approval_document.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                ({(docData.approval_document.size / 1024).toFixed(0)} KB)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveDocFile}
                                            disabled={docProcessing}
                                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold shrink-0 cursor-pointer p-1"
                                            title="Remove selected file"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-2 text-center">
                                        <input
                                            ref={docFileInputRef}
                                            id="upload-approval-document"
                                            name="approval_document"
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={handleDocFileChange}
                                            className="hidden"
                                        />
                                        <label
                                            htmlFor="upload-approval-document"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>Select Document</span>
                                        </label>
                                        <p className="text-[11px] text-slate-500 mt-1.5">
                                            Supported: PDF, DOC, DOCX, JPG, JPEG, PNG (max 10MB)
                                        </p>
                                    </div>
                                )}
                            </div>
                            <InputError message={docErrors.approval_document} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseUploadDocumentModal}
                                disabled={docProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={docProcessing}
                                disabled={docProcessing || !docData.approval_document}
                            >
                                Upload Document
                            </Button>
                        </div>
                    </form>
                </Modal>

            </div>
        </AppLayout>
    );
}
