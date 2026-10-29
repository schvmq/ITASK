import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'motion/react';
import { staggerContainer, cardVariant, rowVariant } from '@/animations';
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
    Bell,
    Plus,
    Paperclip,
    ListTodo,
} from 'lucide-react';
import { CreateProjectTaskModal } from '@/Components/CreateProjectTaskModal';
import { ProjectTaskDetailsModal, ProjectTaskDetail } from '@/Components/ProjectTaskDetailsModal';
import { getProgressBarGradient } from '@/lib/progress';

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
    activities?: Array<{ id: string; title: string }>;
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
    role?: string;
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
    priority?: string;
    due_date: string | null;
    due_date_raw?: string | null;
    requires_review: boolean;
    is_overdue?: boolean;
    is_assigned_to_me?: boolean;
    assignee: {
        id: number;
        name: string;
        email?: string;
    } | null;
    committee: {
        id: string;
        name: string;
    };
    activity: {
        id: string;
        title: string;
    };
    checklist_items?: Array<{
        id: string;
        content: string;
        is_completed: boolean;
        order: number;
    }>;
    checklist_total?: number;
    checklist_completed?: number;
    evidences?: Array<{
        id: string;
        original_name: string;
        file_size: number;
        file_size_formatted: string;
        mime_type: string;
        remarks: string | null;
        uploaded_at: string | null;
        uploader: { id: number; name: string } | null;
        download_url: string;
        can?: { delete: boolean };
    }>;
    can?: {
        update?: boolean;
        delete?: boolean;
        updateStatus?: boolean;
        manageChecklist?: boolean;
        uploadEvidence?: boolean;
        submitReview?: boolean;
        review?: boolean;
        resubmit?: boolean;
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
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [viewingTask, setViewingTask] = useState<ProjectTaskDetail | null>(null);

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

    const [showRespondentGuide, setShowRespondentGuide] = useState(true);

    const {
        data: committeeData,
        setData: setCommitteeData,
        post: submitCommittee,
        processing: committeeProcessing,
        errors: committeeErrors,
        reset: resetCommitteeForm,
        clearErrors: clearCommitteeErrors,
    } = useForm<{
        name: string;
        description: string;
        user_id: string;
        member_ids: number[];
    }>({
        name: '',
        description: '',
        user_id: '',
        member_ids: [],
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
    const isStaff = (initialProject.role || '').toLowerCase().includes('staff');
    const canCreateCommittee = Boolean(initialProject.can?.createCommittee || isLeader);
    const allTasks = initialProject.tasks || [];
    const allDocuments = initialProject.documents || [];
    const allCommittees = initialProject.committees || [];
    const timelineData = propTimeline || initialProject.timeline || null;
    const firstTask = allTasks[0];
    const reminderTargetUrl = firstTask?.committee && firstTask?.activity
        ? `/projects/${initialProject.id}/committees/${firstTask.committee.id}/activities/${firstTask.activity.id}?remind=1`
        : null;

    // Eligible project assignees for creating tasks
    const projectAssignees = useMemo(() => {
        const list: Array<{ id: number; name: string; email: string; role?: string }> = [];
        const seen = new Set<number>();

        if (initialProject.leader && !seen.has(initialProject.leader.id)) {
            seen.add(initialProject.leader.id);
            list.push({ ...initialProject.leader, role: 'Leader' });
        }
        (initialProject.projectStaff || []).forEach((u) => {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                list.push({ ...u, role: 'Project Staff' });
            }
        });
        (initialProject.projectMembers || []).forEach((u) => {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                list.push({ ...u, role: 'Project Member' });
            }
        });
        (initialProject.committees || []).forEach((c) => {
            if (c.head && !seen.has(c.head.id)) {
                seen.add(c.head.id);
                list.push({ ...c.head, role: `${c.name} Head` });
            }
            (c.members || []).forEach((m) => {
                if (!seen.has(m.id)) {
                    seen.add(m.id);
                    list.push({ ...m, role: `${c.name} Member` });
                }
            });
        });
        (initialProject.availablePersonnel || []).forEach((u) => {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                list.push({ ...u, role: 'Personnel' });
            }
        });

        return list;
    }, [initialProject]);

    // Available project personnel that the Project Leader can assign as committee staff or members
    const assignablePersonnelList = useMemo(() => {
        const list: Array<{
            id: number;
            name: string;
            email: string;
            role: string;
            committee_id?: string | null;
            committee_name?: string | null;
        }> = [];
        const seen = new Set<number>();

        (initialProject?.projectStaff || []).forEach((u) => {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                const comm = (initialProject?.committees || []).find((c) => String(c.id) === String(u.committee_id));
                list.push({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: 'Project Staff',
                    committee_id: u.committee_id,
                    committee_name: comm?.name,
                });
            }
        });

        (initialProject?.projectMembers || []).forEach((u) => {
            if (!seen.has(u.id)) {
                seen.add(u.id);
                const comm = (initialProject?.committees || []).find((c) => String(c.id) === String(u.committee_id));
                list.push({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: 'Project Member',
                    committee_id: u.committee_id,
                    committee_name: comm?.name,
                });
            }
        });

        return list;
    }, [initialProject?.projectStaff, initialProject?.projectMembers, initialProject?.committees]);

    // Keep viewingTask up to date when tasks are refreshed
    useEffect(() => {
        if (viewingTask) {
            const fresh = (allTasks || []).find((t) => String(t.id) === String(viewingTask.id));
            if (fresh) {
                setViewingTask(fresh as unknown as ProjectTaskDetail);
            }
        }
    }, [allTasks]);

    // Intercept global itask:open-create-task event while on project page
    useEffect(() => {
        const handleOpenTask = (e: Event) => {
            e.stopImmediatePropagation();
            setIsCreateTaskModalOpen(true);
        };
        window.addEventListener('itask:open-create-task', handleOpenTask);
        return () => window.removeEventListener('itask:open-create-task', handleOpenTask);
    }, []);

    // Paginated tasks
    const totalTasks = allTasks.length;
    const totalTaskPages = Math.max(1, Math.ceil(totalTasks / taskPageSize));
    const safeTaskPage = Math.min(taskPage, Math.max(5, totalTaskPages));
    const paginatedTasks = useMemo(() => {
        const start = (safeTaskPage - 1) * taskPageSize;
        return allTasks.slice(start, start + taskPageSize);
    }, [allTasks, safeTaskPage, taskPageSize]);

    // Paginated documents
    const totalFiles = allDocuments.length;
    const totalFilesPages = Math.max(1, Math.ceil(totalFiles / filesPageSize));
    const safeFilesPage = Math.min(filesPage, Math.max(5, totalFilesPages));
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
                {/* ══ Workflow & Survey Navigation Guide Banner ══ */}
                {showRespondentGuide && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 via-blue-50/60 to-slate-50 border border-indigo-100 shadow-2xs text-slate-800 transition-all">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 font-bold text-xs text-indigo-950 uppercase tracking-wider">
                                <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                                <span>Project Usability & Workflow Guide (Survey Testing)</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRespondentGuide(false)}
                                className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                title="Dismiss guide"
                            >
                                Dismiss
                            </button>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                            Follow these simple 4 steps to complete project management tasks or respondent survey instructions:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
                            <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 text-xs space-y-1">
                                <span className="font-bold text-indigo-700 block">1. Committees & Staff</span>
                                <span className="text-[11px] text-slate-600 block leading-normal">
                                    Leader creates committees and assigns staff/members. Committee members can also delegate staff!
                                </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 text-xs space-y-1">
                                <span className="font-bold text-indigo-700 block">2. Create Tasks</span>
                                <span className="text-[11px] text-slate-600 block leading-normal">
                                    Add tasks with interactive checklists and deliverable MOV requirements under committees.
                                </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 text-xs space-y-1">
                                <span className="font-bold text-indigo-700 block">3. Submit Deliverables</span>
                                <span className="text-[11px] text-slate-600 block leading-normal">
                                    Assigned members complete checklist items, upload files, and click &quot;Submit for Review&quot;.
                                </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/90 border border-indigo-100 text-xs space-y-1">
                                <span className="font-bold text-indigo-700 block">4. Leader & Staff Review</span>
                                <span className="text-[11px] text-slate-600 block leading-normal">
                                    Project Leader & Staff inspect deliverables, then &quot;Approve&quot; or &quot;Return for Revision&quot;.
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ Project Header (with progress and members) ══ */}
                <motion.div variants={cardVariant} whileHover={{ y: -2 }}>
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
                        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center flex-wrap">
                            {/* Highlighted View in Timeline Button */}
                            <Link href={`/projects/${initialProject.id}/timeline`}>
                                <Button
                                    variant="primary"
                                    size="md"
                                    className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold shadow-xs flex items-center gap-1.5"
                                >
                                    <Calendar className="w-4 h-4 text-white" />
                                    <span>View in Timeline</span>
                                </Button>
                            </Link>

                            {/* Highlighted Send Reminders Button (For Leader & Staff) */}
                            {(isLeader || isStaff) && reminderTargetUrl && (
                                <Link href={reminderTargetUrl}>
                                    <Button
                                        variant="secondary"
                                        size="md"
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold border-none shadow-xs flex items-center gap-1.5"
                                    >
                                        <Bell className="w-4 h-4 text-white animate-pulse" />
                                        <span>Send Reminders</span>
                                    </Button>
                                </Link>
                            )}

                            <Link href={`/chat/${initialProject.id}`}>
                                <Button variant="secondary" size="md">
                                    <MessageSquare className="w-4 h-4 mr-1.5" strokeWidth={2} />
                                    <span>Project chat</span>
                                </Button>
                            </Link>

                            {canCreateCommittee && (
                                <Button
                                    variant="outline"
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

                    {/* Highlighted Overall Progress Bar */}
                    <div className="pt-2 border-t border-[color:var(--border)] space-y-2">
                        <div className="flex items-center justify-between text-[13px]">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-2 h-2 rounded-full ${
                                        (initialProject.progress ?? 0) >= 100
                                            ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                                            : 'bg-[color:var(--primary)] animate-pulse ring-2 ring-[color:var(--primary)]/20'
                                    }`}
                                />
                                <span className="font-semibold text-[color:var(--muted)]">Overall progress</span>
                            </div>
                            {(() => {
                                const progVal = Math.round(initialProject.progress ?? 0);
                                const isComplete = initialProject.status === 'Completed' || progVal >= 100;
                                const pStyles = getProgressBarGradient(progVal, isComplete);
                                return (
                                    <motion.span
                                        key={progVal}
                                        initial={{ scale: 1.15 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', damping: 15 }}
                                        className={`px-2.5 py-0.5 rounded-full font-bold text-[12px] border tabular-nums shadow-2xs inline-block ${pStyles.badgeBg} ${pStyles.badgeText} ${pStyles.badgeBorder}`}
                                    >
                                        {isComplete ? 'Complete' : `${progVal}%`}
                                    </motion.span>
                                );
                            })()}
                        </div>
                        {(() => {
                            const progVal = Math.round(initialProject.progress ?? 0);
                            const isComplete = initialProject.status === 'Completed' || progVal >= 100;
                            const pStyles = getProgressBarGradient(progVal, isComplete);
                            return (
                                <div className="w-full h-3 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden shadow-inner p-[1px]">
                                    <motion.div
                                        className={`h-full rounded-full transition-all ${pStyles.barGradient} ${pStyles.shadow}`}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progVal > 0 ? Math.max(2, progVal) : 0}%` }}
                                        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                                        role="progressbar"
                                        aria-valuenow={progVal}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                    />
                                </div>
                            );
                        })()}
                    </div>
                </Card>
            </motion.div>

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
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 360 }}
                    >
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
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIsCreateTaskModalOpen(true)}
                                className="flex items-center gap-1.5 font-bold shadow-xs cursor-pointer"
                                data-testid="project-tasks-create-btn"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Create task</span>
                            </Button>
                        </div>

                        {allTasks.length === 0 ? (
                            <EmptyState
                                title="No tasks created yet"
                                description="Tasks are created inside committee activities by Project Staff to delegate work."
                                actionLabel="Create task"
                                onAction={() => setIsCreateTaskModalOpen(true)}
                            />
                        ) : (
                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-left border-collapse text-[13px]">
                                    <thead>
                                        <tr className="border-b border-[color:var(--border)] text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                            <th className="py-2.5 pr-4">Task</th>
                                            <th className="py-2.5 px-3">Committee & Activity</th>
                                            <th className="py-2.5 px-3">Assignee</th>
                                            <th className="py-2.5 px-3">Checklist</th>
                                            <th className="py-2.5 px-3">Deliverables</th>
                                            <th className="py-2.5 px-3">Status</th>
                                            <th className="py-2.5 pl-3">Due date</th>
                                            <th className="py-2.5 pl-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[color:var(--border)]">
                                        {paginatedTasks.map((task) => (
                                            <tr key={task.id} className="hover:bg-[color:var(--soft-surface)] transition-colors">
                                                <td className="py-3 pr-4 max-w-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingTask(task as unknown as ProjectTaskDetail)}
                                                        className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors text-left block truncate cursor-pointer"
                                                    >
                                                        {task.title}
                                                    </button>
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
                                                    {task.checklist_total !== undefined && task.checklist_total > 0 ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--text)] tabular-nums">
                                                            <ListTodo className="w-3 h-3 text-[color:var(--primary)]" />
                                                            <span>
                                                                {task.checklist_completed ?? 0}/{task.checklist_total}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-[color:var(--muted)]">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    {task.requires_review ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                                            <FileText className="w-3 h-3" />
                                                            <span>
                                                                {task.evidences && task.evidences.length > 0
                                                                    ? `${task.evidences.length} MOV`
                                                                    : 'Required'}
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-[color:var(--muted)]">None</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-3 whitespace-nowrap">
                                                    <Badge variant={task.status === 'Completed' ? 'accent' : task.status === 'Under Review' ? 'secondary' : task.status === 'Returned' ? 'danger' : 'soft'}>
                                                        {task.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 pl-3 whitespace-nowrap tabular-nums text-[color:var(--muted)]">
                                                    {task.due_date || '—'}
                                                </td>
                                                <td className="py-3 pl-3 whitespace-nowrap text-right">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => setViewingTask(task as unknown as ProjectTaskDetail)}
                                                        className="text-[11px] font-semibold h-7 px-2.5 cursor-pointer"
                                                    >
                                                        Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Tasks Client Pagination */}
                        {totalTasks > 0 && (
                            <div className="pt-2 border-t border-[color:var(--border)] flex justify-center w-full">
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
                            <div className="pt-2 border-t border-[color:var(--border)] flex justify-center w-full">
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

                                            {(() => {
                                                const cStyles = getProgressBarGradient(comm.progress, comm.progress >= 100);
                                                return (
                                                    <div className="w-full h-1.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden p-0">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-300 ${cStyles.barGradient}`}
                                                            style={{ width: `${comm.progress > 0 ? Math.max(3, comm.progress) : 0}%` }}
                                                        />
                                                    </div>
                                                );
                                            })()}

                                            {comm.description && (
                                                <p className="text-[13px] text-[color:var(--muted)] line-clamp-2">
                                                    {comm.description}
                                                </p>
                                            )}

                                            <div className="text-[12px] text-[color:var(--muted)] space-y-1 pt-1">
                                                <p>Staff: <span className="font-medium text-[color:var(--text)]">{comm.leadName || comm.head?.name || 'Unassigned'}</span></p>
                                                <p>{comm.membersCount} members · {comm.activitiesCount ?? comm.activities?.length ?? 0} activities</p>
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
                    </motion.div>
                </AnimatePresence>
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
                title="Create Committee & Assign Members"
                maxWidth="lg"
            >
                <form onSubmit={handleCreateCommitteeSubmit} className="space-y-4">
                    <FormField
                        label="Committee name"
                        name="name"
                        value={committeeData.name}
                        onChange={(e) => setCommitteeData('name', e.target.value)}
                        placeholder="e.g. Documentation Committee, Logistics Committee"
                        error={committeeErrors.name}
                        required
                    />

                    <div>
                        <Label>Description</Label>
                        <textarea
                            rows={2}
                            value={committeeData.description}
                            onChange={(e) => setCommitteeData('description', e.target.value)}
                            placeholder="Briefly state this committee's mandate and scope of work..."
                            className="w-full mt-1 p-2.5 text-[13px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)] leading-relaxed"
                        />
                        <InputError message={committeeErrors.description} />
                    </div>

                    {/* Committee Head / Staff Assignment */}
                    <div className="space-y-1.5 p-3.5 rounded-[10px] bg-[color:var(--soft-surface)]/60 border border-[color:var(--border)]">
                        <Label htmlFor="committee-head-select" className="flex items-center justify-between">
                            <span className="font-semibold text-[13px] text-[color:var(--text)]">Designate Committee Head (Project Staff)</span>
                            <span className="text-[11px] text-[color:var(--muted)]">Optional</span>
                        </Label>
                        <p className="text-[11px] text-[color:var(--muted)] leading-relaxed">
                            Select who will lead this committee. Assigned staff can review deliverables, add activities, and assign tasks.
                        </p>
                        <select
                            id="committee-head-select"
                            value={committeeData.user_id}
                            onChange={(e) => setCommitteeData('user_id', e.target.value)}
                            className="w-full mt-1 px-3 py-2 text-[13px] bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]"
                        >
                            <option value="">-- Choose who you want to assign as Head (or Leave Unassigned) --</option>
                            {assignablePersonnelList.map((person) => {
                                const currentComm = person.committee_name ? ` (Currently in ${person.committee_name})` : ' (Available)';
                                return (
                                    <option key={person.id} value={person.id}>
                                        {person.name} — {person.role} - {person.email}{currentComm}
                                    </option>
                                );
                            })}
                        </select>
                        <InputError message={committeeErrors.user_id} />
                    </div>

                    {/* Initial Committee Members Multi-Select */}
                    {assignablePersonnelList.length > 0 && (
                        <div className="space-y-2 p-3.5 rounded-[10px] bg-[color:var(--soft-surface)]/40 border border-[color:var(--border)]">
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-[13px] text-[color:var(--text)]">
                                    Assign Initial Committee Members
                                </Label>
                                <span className="text-[11px] text-[color:var(--muted)]">
                                    {committeeData.member_ids.length} selected
                                </span>
                            </div>
                            <p className="text-[11px] text-[color:var(--muted)]">
                                Select members involved in this project to join this committee. Committee members can also choose and assign staff later.
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 pt-1">
                                {assignablePersonnelList
                                    .filter((p) => String(p.id) !== String(committeeData.user_id))
                                    .map((person) => {
                                        const isChecked = committeeData.member_ids.includes(person.id);
                                        return (
                                            <label
                                                key={person.id}
                                                className={`flex items-center justify-between p-2 rounded-[8px] border text-[12px] cursor-pointer transition-colors ${
                                                    isChecked
                                                        ? 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]/40 text-[color:var(--text)]'
                                                        : 'bg-[color:var(--card)] border-[color:var(--border)] hover:bg-[color:var(--soft-surface)] text-[color:var(--text)]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setCommitteeData('member_ids', [...committeeData.member_ids, person.id]);
                                                            } else {
                                                                setCommitteeData(
                                                                    'member_ids',
                                                                    committeeData.member_ids.filter((id) => id !== person.id)
                                                                );
                                                            }
                                                        }}
                                                        className="rounded text-[color:var(--primary)] focus:ring-[color:var(--primary)]"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="font-semibold truncate">{person.name}</div>
                                                        <div className="text-[10px] text-[color:var(--muted)] truncate">{person.email}</div>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-[color:var(--muted)] shrink-0">
                                                    {person.role}
                                                    {person.committee_name && ` (${person.committee_name})`}
                                                </span>
                                            </label>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

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

            {/* In-Project Create Task Pop-up Modal with Checklist & Deliverables */}
            <CreateProjectTaskModal
                isOpen={isCreateTaskModalOpen}
                onClose={() => setIsCreateTaskModalOpen(false)}
                projectId={initialProject.id}
                projectTitle={initialProject.title}
                committees={initialProject.committees}
                activities={initialProject.activities}
                assignees={projectAssignees}
            />

            {/* In-Project Task Details, Interactive Checklist & Deliverables Submission Modal */}
            <ProjectTaskDetailsModal
                isOpen={Boolean(viewingTask)}
                onClose={() => setViewingTask(null)}
                projectId={initialProject.id}
                task={viewingTask}
            />
        </AppLayout>
    );
}
