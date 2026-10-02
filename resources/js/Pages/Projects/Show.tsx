import React, { useState, useEffect, useRef } from 'react';
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
import { EmptyState } from '@/Components/EmptyState';
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
    Lock,
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
    progress?: number;
    start_date?: string | null;
    end_date?: string | null;
    start_date_raw?: string | null;
    end_date_raw?: string | null;
    created_at?: string | null;
    role?: ProjectRole | string | null;
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

type TabKey = 'overview' | 'committees' | 'activities' | 'tasks' | 'timeline' | 'documents';

interface ProjectDocument {
    id: string;
    title: string;
    type: string;
    status: 'Approved' | 'Verified' | 'Pending';
    updatedAt: string;
    size: string;
    downloadUrl?: string;
}

// ─── Helper: get initials ─────────────────────────────────────────────────────
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

// ─── Status Badge Component ───────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: string }) {
    const isArchived = status === 'Archived';
    const isCompleted = status === 'Completed';
    const isActive = status === 'Active' || status === 'In Progress';
    const isPlanning = status === 'Planning';

    const variant = isCompleted || isActive ? 'success' : isArchived || isPlanning ? 'neutral' : 'primary';

    return (
        <Badge variant={variant} dot>
            {status}
        </Badge>
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

// ─── Donut Chart Component ─────────────────────────────────────────────────────
function ProjectProgressDonut({
    progress,
    tasks,
}: {
    progress: number;
    tasks: ProjectTaskItem[];
}) {
    const size = 120;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Status order as requested:
    // 1. To Do
    // 2. In Progress
    // 3. Under Review
    // 4. Returned
    // 5. Completed
    const toDo = tasks.filter((t) => t.status === 'To Do').length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const underReview = tasks.filter((t) => t.status === 'Under Review').length;
    const returned = tasks.filter((t) => t.status === 'Returned' || t.status === 'Returned for Revision').length;
    const completed = tasks.filter((t) => t.status === 'Completed').length;

    const clampedProgress = Math.min(Math.max(progress, 0), 100);
    const offset = circumference - (clampedProgress / 100) * circumference;

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
            {/* Donut */}
            <div className="relative shrink-0" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                    {/* Background track */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="#f1f5f9"
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress arc */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="var(--color-brand-action-orange)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-[color:var(--color-text-main)] leading-none">
                        {Math.round(progress)}%
                    </span>
                </div>
            </div>

            {/* Task Status Breakdown in requested order: To Do, In Progress, Under Review, Returned, Completed */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 w-full max-w-xs sm:max-w-sm">
                <LegendItem color="bg-slate-400" label="To Do" count={toDo} />
                <LegendItem color="bg-amber-400" label="Under Review" count={underReview} />
                <LegendItem color="bg-sky-500" label="In Progress" count={inProgress} />
                <LegendItem color="bg-rose-500" label="Returned" count={returned} />
                <LegendItem color="bg-emerald-500" label="Completed" count={completed} />
            </div>
        </div>
    );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
    const isZero = count === 0;
    return (
        <div className={`flex items-center gap-2 ${isZero ? 'opacity-40' : 'opacity-100'}`}>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
            <span className="text-xs font-medium text-[color:var(--color-text-muted)]">{label}</span>
            <span className={`text-xs ml-1 ${isZero ? 'text-slate-400 font-normal' : 'text-[color:var(--color-text-main)] font-bold'}`}>
                {count}
            </span>
        </div>
    );
}

// ─── Main Project Detail Page Shell ───────────────────────────────────────────
export default function ProjectShow({
    projectId: _projectId,
    project: initialProject,
    timeline: initialTimeline,
    initialTab,
}: ProjectShowProps) {
    const timelineData = initialTimeline ?? initialProject?.timeline;
    const [activeTab, setActiveTab] = useState<TabKey>(
        (initialTab as TabKey) || 'overview'
    );

    // Role-aware authorization (Project Leader only for edit and archive)
    const isLeader = Boolean(
        initialProject?.can?.update ?? (initialProject?.role === 'Project Leader')
    );

    // Backend-driven create committee authorization
    const canCreateCommittee = initialProject
        ? (initialProject.can?.createCommittee ?? isLeader)
        : false;

    // Modals state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [archiveProcessing, setArchiveProcessing] = useState(false);
    const [isCreateCommitteeModalOpen, setIsCreateCommitteeModalOpen] = useState(false);
    const [isEditCommitteeModalOpen, setIsEditCommitteeModalOpen] = useState(false);
    const [editingCommittee, setEditingCommittee] = useState<CommitteeItem | null>(null);

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

    const handleCloseCreateCommitteeModal = () => {
        if (committeeProcessing) return;
        setIsCreateCommitteeModalOpen(false);
        resetCommitteeForm();
        clearCommitteeErrors();
    };

    const handleCreateCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || committeeProcessing) return;

        submitCommittee(`/projects/${initialProject.id}/committees`, {
            onSuccess: () => {
                setIsCreateCommitteeModalOpen(false);
                resetCommitteeForm();
                clearCommitteeErrors();
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

    const handleCloseEditCommitteeModal = () => {
        if (editCommitteeProcessing) return;
        setIsEditCommitteeModalOpen(false);
        setEditingCommittee(null);
        resetEditCommitteeForm();
        clearEditCommitteeErrors();
    };

    const handleEditCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || !editingCommittee || editCommitteeProcessing) return;

        submitEditCommittee(
            `/projects/${initialProject.id}/committees/${editingCommittee.id}`,
            {
                onSuccess: () => {
                    setIsEditCommitteeModalOpen(false);
                    setEditingCommittee(null);
                    resetEditCommitteeForm();
                    clearEditCommitteeErrors();
                },
            }
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

    // ─── Data derivations ─────────────────────────────────────────────────────

    const displayCommittees: CommitteeItem[] = initialProject.committees ?? [];

    const leaderUser = initialProject.leader ?? null;
    const hasLeader = Boolean(leaderUser && leaderUser.name);
    const leaderName = hasLeader ? leaderUser!.name : 'No Project Leader assigned';

    const project = {
        id: String(initialProject.id),
        title: initialProject.title,
        description: initialProject.description?.trim() || null,
        status: initialProject.status,
        role: initialProject.role ?? null,
        userCommittee: initialProject.userCommittee ?? null,
        progress: initialProject.progress ?? 0,
        deadline: initialProject.end_date ?? null,
        startDate: initialProject.start_date ?? null,
        leader: leaderUser,
        hasLeader,
        leaderName,
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

    const allActivities = initialProject.activities ?? [];
    const allTasks = initialProject.tasks ?? [];

    // Navigation Tabs Definition
    const tabs: { key: TabKey; label: string }[] = [
        { key: 'overview', label: 'Overview' },
        { key: 'committees', label: 'Committees' },
        { key: 'activities', label: 'Activities' },
        { key: 'tasks', label: 'Tasks' },
        { key: 'timeline', label: 'Timeline' },
        { key: 'documents', label: 'Documents' },
    ];

    return (
        <AppLayout
            hidePageHeadingBanner={true}
            currentProject={{
                title: project.title,
                role: project.role ?? undefined,
                status: project.status,
            }}
        >
            <Head title={`${project.title} — ITASK`} />

            <div className="-mx-4 sm:-mx-6 -mt-6">

                {/* ── Project Workspace Navigation & Breadcrumb ── */}
                <div className="bg-white border-b border-[color:var(--color-border-light)]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 pb-0">

                        {/* Minimal project context line with Leader options */}
                        <div className="flex items-center justify-between gap-3 text-xs mb-2.5">
                            <div className="flex items-center gap-1.5 min-w-0 text-[color:var(--color-text-muted)]">
                                <Link
                                    href="/projects"
                                    className="hover:text-[color:var(--color-brand-action-orange)] transition-colors font-medium shrink-0"
                                >
                                    Projects
                                </Link>
                                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
                                <span className="text-[color:var(--color-text-main)] font-semibold truncate max-w-xs sm:max-w-md" title={project.title}>
                                    {project.title}
                                </span>
                                {project.role && project.role !== 'Project Leader' && (
                                    <span className="hidden sm:inline-flex ml-1 shrink-0">
                                        <ProjectRoleBadge role={project.role} />
                                    </span>
                                )}
                                {project.userCommittee && (
                                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-slate-50 text-slate-600 border-slate-200 shrink-0">
                                        {project.userCommittee.name}
                                    </span>
                                )}
                            </div>

                            {/* Minimal Leader Options (Edit / Archive) */}
                            {isLeader && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                            title="More options"
                                            aria-label="More project options"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                        <DropdownMenuItem
                                            onClick={handleOpenEditModal}
                                            className="gap-2 text-xs cursor-pointer"
                                        >
                                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                            Edit Project
                                        </DropdownMenuItem>

                                        {project.status !== 'Archived' && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setIsArchiveModalOpen(true)}
                                                    className="gap-2 text-xs text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
                                                >
                                                    <Archive className="w-3.5 h-3.5" />
                                                    Archive Project
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>

                        {/* Underline Tabs */}
                        <nav className="flex space-x-1 sm:space-x-2 -mb-px overflow-x-auto scrollbar-none" aria-label="Project tabs">
                            {tabs.map((tab) => {
                                const isActive = activeTab === tab.key;
                                const count =
                                    tab.key === 'committees' ? project.summary.committees
                                    : tab.key === 'activities' ? project.summary.activities
                                    : tab.key === 'tasks' ? project.summary.tasks
                                    : tab.key === 'documents' ? displayDocuments.length
                                    : null;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                                            isActive
                                                ? 'border-[color:var(--color-brand-action-orange)] text-[color:var(--color-brand-action-orange)] font-semibold'
                                                : 'border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-main)] hover:border-slate-300'
                                        }`}
                                        aria-current={isActive ? 'page' : undefined}
                                    >
                                        <span>{tab.label}</span>
                                        {count !== null && (
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                                                isActive
                                                    ? 'bg-orange-100 text-[color:var(--color-brand-action-orange)]'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* ── Main Tab Content Area ── */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

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

                    {/* ── TAB 1: OVERVIEW ── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">

                            {/* Project Overview & Progress card */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="space-y-2 max-w-3xl flex-1">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                                Project Overview
                                            </h3>
                                            <ProjectStatusBadge status={project.status} />
                                        </div>
                                        {project.description && (
                                            <p className="text-xs text-[color:var(--color-text-muted)] leading-relaxed">
                                                {project.description}
                                            </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[color:var(--color-text-muted)] pt-1">
                                            <div>
                                                <span>Project Leader: </span>
                                                {project.hasLeader ? (
                                                    <span className="font-semibold text-[color:var(--color-text-main)]">{project.leaderName}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">Unassigned</span>
                                                )}
                                            </div>
                                            {project.startDate && (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>
                                                        Started <span className="font-semibold text-[color:var(--color-text-main)]">{project.startDate}</span>
                                                    </span>
                                                </div>
                                            )}
                                            {project.deadline && (
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>
                                                        Deadline <span className="font-semibold text-[color:var(--color-text-main)]">{project.deadline}</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-semibold text-[color:var(--color-text-subtle)] uppercase tracking-wider">
                                            Task Breakdown
                                        </span>
                                        <span className="text-xs text-[color:var(--color-text-muted)]">
                                            {allTasks.length} {allTasks.length === 1 ? 'task' : 'tasks'} total
                                        </span>
                                    </div>
                                    <ProjectProgressDonut
                                        progress={project.progress}
                                        tasks={allTasks}
                                    />
                                </div>
                            </div>

                            {/* Committees preview */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">Committees</h3>
                                    {displayCommittees.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('committees')}
                                            className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            View All
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {displayCommittees.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayCommittees.map((committee) => {
                                            const canView = committee.can ? committee.can.view : true;
                                            const headInitials = committee.head ? getInitials(committee.head.name) : '??';
                                            return canView ? (
                                                <Link
                                                    key={committee.id}
                                                    href={`/projects/${project.id}/committees/${committee.id}`}
                                                    className="block p-4 rounded-xl border border-[color:var(--color-border-light)] hover:border-slate-300 hover:shadow-sm transition-all bg-white"
                                                >
                                                    <h4 className="text-xs font-bold text-[color:var(--color-text-main)] mb-2">
                                                        {committee.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                            style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                                                        >
                                                            {headInitials}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-[color:var(--color-text-main)] truncate">
                                                                {committee.head?.name ?? 'Unassigned'}
                                                            </p>
                                                            <p className="text-[10px] text-[color:var(--color-text-muted)]">Project Staff</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${committee.progress}%`,
                                                                    backgroundColor: 'var(--color-brand-dark-green)',
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-[color:var(--color-brand-dark-green)] tabular-nums">
                                                            {committee.progress}%
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                                                        {committee.membersCount} {committee.membersCount === 1 ? 'member' : 'members'} · {committee.activitiesCount} {committee.activitiesCount === 1 ? 'activity' : 'activities'}
                                                    </p>
                                                </Link>
                                            ) : (
                                                <div
                                                    key={committee.id}
                                                    className="block p-4 rounded-xl border border-slate-200 bg-slate-50/70 opacity-75"
                                                >
                                                    <h4 className="text-xs font-bold text-slate-600 mb-2">
                                                        {committee.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-slate-400">
                                                            {headInitials}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-slate-600 truncate">
                                                                {committee.head?.name ?? 'Unassigned'}
                                                            </p>
                                                            <p className="text-[10px] text-[color:var(--color-text-muted)]">Project Staff</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${committee.progress}%`,
                                                                    backgroundColor: 'var(--color-brand-dark-green)',
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                                                            {committee.progress}%
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                                                        {committee.membersCount} {committee.membersCount === 1 ? 'member' : 'members'} · {committee.activitiesCount} {committee.activitiesCount === 1 ? 'activity' : 'activities'}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={<Users className="w-6 h-6 text-slate-400" />}
                                        title="No committees yet"
                                        description={
                                            canCreateCommittee
                                                ? 'Functional committees and working groups will appear here once created.'
                                                : 'This project currently has no committees established.'
                                        }
                                        actionLabel={canCreateCommittee ? '+ Add Committee' : undefined}
                                        onAction={canCreateCommittee ? handleOpenCreateCommittee : undefined}
                                    />
                                )}
                            </div>

                            {/* Project Approval Documents */}
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                            Project Approval / Supporting Document
                                        </h3>
                                    </div>
                                    {(initialProject.can?.uploadDocument) && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leftIcon={<FileText className="w-3.5 h-3.5" />}
                                            onClick={handleOpenUploadDocumentModal}
                                        >
                                            Attach Document
                                        </Button>
                                    )}
                                </div>

                                {displayDocuments.length > 0 ? (
                                    <div className="space-y-3">
                                        {displayDocuments.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-[color:var(--color-border-light)] bg-white hover:border-slate-300 transition-colors"
                                            >
                                                <div className="flex items-center gap-3.5 min-w-0">
                                                    <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-[color:var(--color-text-main)] truncate" title={doc.title}>
                                                            {doc.title}
                                                        </p>
                                                        <p className="text-[11px] text-[color:var(--color-text-subtle)] mt-0.5">
                                                            {doc.type} · {doc.size} · Uploaded {doc.updatedAt}
                                                        </p>
                                                    </div>
                                                </div>
                                                {doc.downloadUrl && (
                                                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                                                        <a
                                                            href={`${doc.downloadUrl}?inline=1`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline px-2 py-1"
                                                        >
                                                            View
                                                        </a>
                                                        <a
                                                            href={doc.downloadUrl}
                                                            download={doc.title}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
                                                        >
                                                            <Download className="w-3.5 h-3.5 text-slate-500" />
                                                            <span>Download</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-6 px-4 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                                        <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                                        <p className="text-xs font-semibold text-slate-600">No documents attached</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                                            Approval documents such as official project memos or dean approval letters will appear here.
                                        </p>
                                        {(initialProject.can?.uploadDocument) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                leftIcon={<FileText className="w-3.5 h-3.5" />}
                                                onClick={handleOpenUploadDocumentModal}
                                                className="mt-3"
                                            >
                                                Attach Document
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── TAB 2: COMMITTEES ── */}
                    {activeTab === 'committees' && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div>
                                        <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                            Committees
                                        </h3>
                                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                            {displayCommittees.length} {displayCommittees.length === 1 ? 'committee' : 'committees'} established
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canCreateCommittee && (
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                onClick={handleOpenCreateCommittee}
                                            >
                                                + Add Committee
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {displayCommittees.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {displayCommittees.map((committee) => {
                                            const canViewCommittee = committee.can ? committee.can.view : true;
                                            const headInitials = committee.head ? getInitials(committee.head.name) : '??';

                                            const cardBody = (
                                                <div className="space-y-3.5 flex flex-col h-full justify-between">
                                                    <div className="space-y-2.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                                Committee
                                                            </span>
                                                            {canViewCommittee ? (
                                                                <span className="text-xs font-bold text-[color:var(--color-brand-dark-green)]">
                                                                    {committee.progress}%
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                                                    <span>Restricted</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <h4 className="text-sm font-bold text-[color:var(--color-text-main)] group-hover:text-[color:var(--color-brand-action-orange)] transition-colors">
                                                                {committee.name}
                                                            </h4>
                                                            {committee.description && (
                                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                                                    {committee.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {canViewCommittee ? (
                                                            <div className="pt-2 border-t border-slate-100 space-y-2.5">
                                                                {/* Project Staff row */}
                                                                <div className="flex items-center gap-2">
                                                                    <div
                                                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                                                        style={{ backgroundColor: 'var(--color-brand-action-orange)' }}
                                                                    >
                                                                        {headInitials}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-semibold text-[color:var(--color-text-main)] truncate">
                                                                            {committee.head?.name ?? 'Unassigned Staff'}
                                                                        </p>
                                                                        <p className="text-[10px] text-[color:var(--color-text-muted)]">Project Staff</p>
                                                                    </div>
                                                                </div>

                                                                {/* Progress bar */}
                                                                <div className="space-y-1">
                                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full transition-all duration-300"
                                                                            style={{
                                                                                width: `${committee.progress}%`,
                                                                                backgroundColor: 'var(--color-brand-dark-green)',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between text-[11px] text-[color:var(--color-text-subtle)] pt-0.5">
                                                                    <span>{committee.membersCount} {committee.membersCount === 1 ? 'member' : 'members'}</span>
                                                                    <span>·</span>
                                                                    <span>{committee.activitiesCount} {committee.activitiesCount === 1 ? 'activity' : 'activities'}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                                                                This committee workspace is restricted to assigned personnel and project leadership.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );

                                            if (canViewCommittee) {
                                                return (
                                                    <Link
                                                        key={committee.id}
                                                        href={`/projects/${project.id}/committees/${committee.id}`}
                                                        className="group block p-5 rounded-xl border border-[color:var(--color-border-light)] bg-white hover:border-[color:var(--color-brand-action-orange)] hover:shadow-md transition-all duration-200 cursor-pointer text-left"
                                                    >
                                                        {cardBody}
                                                    </Link>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={committee.id}
                                                    className="p-5 rounded-xl border border-slate-200 bg-slate-50/70 opacity-80"
                                                >
                                                    {cardBody}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                        <h4 className="text-sm font-bold text-slate-800">No Committees Established</h4>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                            {isLeader
                                                ? 'Organize your project into functional committees. Each committee is headed by a designated Project Staff member and supported by Project Members.'
                                                : 'This project currently has no committees established. Functional committees will be created and organized by the Project Leader.'}
                                        </p>
                                        {canCreateCommittee && (
                                            <div className="mt-4 flex items-center justify-center">
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={handleOpenCreateCommittee}
                                                >
                                                    + Add Committee
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                        Committee milestones, task progress, and operational deliverables
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
                                                        {act.tasksCount > 0 ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                                                    <div
                                                                        className="h-full rounded-full bg-[color:var(--color-brand-action-orange)]"
                                                                        style={{
                                                                            width: `${Math.round((act.completedTasksCount / act.tasksCount) * 100)}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="font-bold text-slate-700 text-xs tabular-nums">
                                                                    {Math.round((act.completedTasksCount / act.tasksCount) * 100)}%
                                                                </span>
                                                                <span className="text-slate-400 text-[11px]">
                                                                    ({act.completedTasksCount}/{act.tasksCount})
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 italic text-[11px]">0 tasks</span>
                                                        )}
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
                                    <h4 className="text-xs font-bold text-slate-800">No Activities Created Yet</h4>
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
                                    <h4 className="text-xs font-bold text-slate-800">No Tasks Created Yet</h4>
                                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                                        Tasks are created under activities within each committee by Project Staff to delegate operational duties.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── TAB 5: TIMELINE VISUALIZATION ── */}
                    {activeTab === 'timeline' && (
                        <GanttTimeline timeline={timelineData} />
                    )}

                    {/* ── TAB 6: DOCUMENTS ── */}
                    {activeTab === 'documents' && (
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                        Project Documents
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Official memos, activity designs, and approval letters
                                    </p>
                                </div>
                                {(initialProject.can?.uploadDocument) && (
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        leftIcon={<FileText className="w-3.5 h-3.5" />}
                                        onClick={handleOpenUploadDocumentModal}
                                    >
                                        Attach Document
                                    </Button>
                                )}
                            </div>

                            {displayDocuments.length > 0 ? (
                                <div className="border border-[color:var(--color-border-light)] rounded-xl overflow-hidden divide-y divide-[color:var(--color-border-light)]">
                                    {displayDocuments.map((doc) => (
                                        <div key={doc.id} className="flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[color:var(--color-brand-action-orange)] shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-[color:var(--color-text-main)] truncate" title={doc.title}>
                                                    {doc.title}
                                                </p>
                                                <p className="text-xs text-[color:var(--color-text-subtle)] mt-0.5">
                                                    {doc.type} · {doc.size} · Uploaded {doc.updatedAt}
                                                </p>
                                            </div>
                                            {doc.downloadUrl && (
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <a
                                                        href={`${doc.downloadUrl}?inline=1`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-semibold text-[color:var(--color-brand-action-orange)] hover:underline"
                                                    >
                                                        View
                                                    </a>
                                                    <a
                                                        href={doc.downloadUrl}
                                                        download={doc.title}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        Download
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <h4 className="text-sm font-bold text-slate-500">No Documents Attached</h4>
                                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                                        Approval documents such as official project memos or dean approval letters will appear here.
                                    </p>
                                    {(initialProject.can?.uploadDocument) && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            leftIcon={<FileText className="w-3.5 h-3.5" />}
                                            onClick={handleOpenUploadDocumentModal}
                                            className="mt-4"
                                        >
                                            Attach First Document
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

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
                        <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={editProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={editProcessing} disabled={editProcessing}>
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
                            <p className="font-semibold">Are you sure you want to archive &ldquo;{project.title}&rdquo;?</p>
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
                        <Button type="button" variant="outline" onClick={() => setIsArchiveModalOpen(false)} disabled={archiveProcessing}>
                            Cancel
                        </Button>
                        <Button type="button" variant="danger" onClick={handleArchiveConfirm} isLoading={archiveProcessing} disabled={archiveProcessing}>
                            Confirm Archive
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Create Committee Modal ── */}
            <Modal
                isOpen={isCreateCommitteeModalOpen}
                onClose={handleCloseCreateCommitteeModal}
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
                        maxLength={255}
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
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>No Eligible Project Staff Available</span>
                                </div>
                                <p className="leading-relaxed">
                                    No eligible Project Staff are currently available for assignment. You can create this committee now and designate a Project Staff head later once staff members are added to the project.
                                </p>
                            </div>
                        )}
                        <InputError message={committeeErrors.user_id} />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <Button type="button" variant="outline" onClick={handleCloseCreateCommitteeModal} disabled={committeeProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={committeeProcessing} disabled={committeeProcessing}>
                            Create Committee
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Edit Committee Modal ── */}
            <Modal
                isOpen={isEditCommitteeModalOpen}
                onClose={handleCloseEditCommitteeModal}
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
                        maxLength={255}
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
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>No Eligible Project Staff Available</span>
                                </div>
                                <p className="leading-relaxed">
                                    No eligible Project Staff are currently available for assignment in this project. Assign Project Staff in the project roster to designate a committee head.
                                </p>
                            </div>
                        )}
                        <InputError message={editCommitteeErrors.user_id} />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <Button type="button" variant="outline" onClick={handleCloseEditCommitteeModal} disabled={editCommitteeProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={editCommitteeProcessing} disabled={editCommitteeProcessing}>
                            Save Changes
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
                        <Button type="button" variant="outline" onClick={handleCloseUploadDocumentModal} disabled={docProcessing}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={docProcessing} disabled={docProcessing || !docData.approval_document}>
                            Upload Document
                        </Button>
                    </div>
                </form>
            </Modal>

        </AppLayout>
    );
}
