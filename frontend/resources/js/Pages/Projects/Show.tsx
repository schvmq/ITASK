import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
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
    UserCheck,
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
        createActivity?: boolean;
    };
}

export interface PersonnelItem {
    id: number;
    name: string;
    email: string;
    role?: string;
    committee_id?: string | null;
    is_co_chair?: boolean;
}

export interface ProjectActivityItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress?: number;
    due_date: string | null;
    due_date_raw?: string | null;
    start_date?: string | null;
    start_date_raw?: string | null;
    tasksCount: number;
    completedTasksCount: number;
    url?: string;
    committee: {
        id: string;
        name: string;
        chairperson?: {
            id: number;
            name: string;
            email?: string;
        } | null;
    };
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
        chairperson?: {
            id: number;
            name: string;
            email?: string;
        } | null;
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
        createTask?: boolean;
        createActivity?: boolean;
        designateCoChair?: boolean;
    };
    eventCoChairs?: Array<{
        id: number;
        name: string;
        email: string;
        designated_at?: string;
    }>;
    is_event_co_chair?: boolean;
    eligibleCoChairs?: Array<{
        id: number;
        name: string;
        email: string;
        role?: string;
    }>;
    committeesForDeliverable?: Array<{
        id: string;
        name: string;
    }>;
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

type TabKey = 'deliverables' | 'tasks' | 'chat' | 'files' | 'timeline' | 'overview' | 'committees';

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
    initialTab = 'deliverables',
}: ProjectShowProps) {
    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        const validTabs: TabKey[] = ['deliverables', 'chat', 'files', 'timeline', 'overview', 'committees'];
        if (initialTab === 'tasks') return 'deliverables';
        return validTabs.includes(initialTab as TabKey) ? (initialTab as TabKey) : 'deliverables';
    });

    // Pagination for Deliverables tab
    const [deliverablePage, setDeliverablePage] = useState(1);
    const [deliverablePageSize, setDeliverablePageSize] = useState(10);

    // Pagination for Tasks tab (kept for backward compatibility)
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
    const [isCreateDeliverableModalOpen, setIsCreateDeliverableModalOpen] = useState(false);
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [viewingTask, setViewingTask] = useState<ProjectTaskDetail | null>(null);
    const [isCoChairModalOpen, setIsCoChairModalOpen] = useState(false);
    const [selectedCoChairUserId, setSelectedCoChairUserId] = useState<string>('');
    const [coChairProcessing, setCoChairProcessing] = useState(false);
    const [coChairError, setCoChairError] = useState<string | null>(null);

    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [newMemberUserId, setNewMemberUserId] = useState<string>('');
    const [newMemberRole, setNewMemberRole] = useState<'Project Member' | 'Project Staff'>('Project Member');
    const [memberProcessing, setMemberProcessing] = useState(false);
    const [memberError, setMemberError] = useState<string | null>(null);

    const docFileInputRef = useRef<HTMLInputElement>(null);

    // Forms
    const {
        data: deliverableData,
        setData: setDeliverableData,
        post: submitDeliverable,
        processing: deliverableProcessing,
        errors: deliverableErrors,
        reset: resetDeliverableForm,
        clearErrors: clearDeliverableErrors,
    } = useForm({
        committee_id: '',
        title: '',
        description: '',
        start_date: '',
        due_date: '',
    });
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
        co_chair_id: '',
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
            <AppLayout title="Event Not Found" subtitle="Event Workspace">
                <Head title="Event Not Found" />
                <div className="py-16 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-text)] flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h2 className="text-[20px] font-bold text-[color:var(--text)]">Event not found</h2>
                    <p className="text-[14px] text-[color:var(--muted)] max-w-sm mx-auto">
                        This event could not be found or you do not have permission to view it.
                    </p>
                    <Link href="/projects">
                        <Button variant="primary" size="md">
                            <ArrowLeft className="w-4 h-4 mr-1.5" />
                            <span>Back to events</span>
                        </Button>
                    </Link>
                </div>
            </AppLayout>
        );
    }

    const isLeader = (initialProject.role || '').toLowerCase().includes('leader');
    const isStaff = (initialProject.role || '').toLowerCase().includes('staff');
    const canCreateCommittee = Boolean(initialProject.can?.createCommittee || isLeader);
    const allDeliverables = initialProject.activities || [];
    const allTasks = initialProject.tasks || [];
    const allDocuments = initialProject.documents || [];
    const allCommittees = initialProject.committees || [];
    const timelineData = propTimeline || initialProject.timeline || null;
    const firstTask = allTasks[0];
    const reminderTargetUrl = firstTask?.committee && firstTask?.activity
        ? `/projects/${initialProject.id}/committees/${firstTask.committee.id}/activities/${firstTask.activity.id}?remind=1`
        : null;

    // Eligible committees for creating deliverables
    const eligibleCommitteesForDeliverable = useMemo(() => {
        if (initialProject.committeesForDeliverable && initialProject.committeesForDeliverable.length > 0) {
            return initialProject.committeesForDeliverable;
        }
        return (initialProject.committees || []).filter((c) => {
            if (isLeader) return true;
            return Boolean(c.can?.createActivity);
        }).map((c) => ({ id: String(c.id), name: c.name }));
    }, [initialProject, isLeader]);

    const canCreateDeliverable = Boolean(
        initialProject.can?.createActivity || eligibleCommitteesForDeliverable.length > 0
    );

    const handleCreateDeliverableSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const targetCommitteeId = deliverableData.committee_id || eligibleCommitteesForDeliverable[0]?.id;
        if (!targetCommitteeId) return;

        submitDeliverable(
            `/projects/${initialProject.id}/committees/${targetCommitteeId}/activities`,
            {
                onSuccess: () => {
                    setIsCreateDeliverableModalOpen(false);
                    resetDeliverableForm();
                },
            }
        );
    };

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

    const pageProps = usePage().props as any;
    const globalAvailableUsers: Array<{ id: number; name: string; email: string }> = pageProps?.available_users || [];

    // Eligible candidates for Committee Chairperson and Co-Chair (Overall Chair is excluded)
    const committeeCandidates = useMemo(() => {
        const leaderId = initialProject?.leader?.id || initialProject?.creator?.id;
        const seen = new Set<number>();
        if (leaderId) seen.add(Number(leaderId));

        const list: Array<{ id: number; name: string; email: string; label: string }> = [];

        // 0. Existing Event Co-Chairs
        (initialProject?.eventCoChairs || []).forEach((u) => {
            const uid = Number(u.id);
            if (!seen.has(uid)) {
                seen.add(uid);
                list.push({
                    id: uid,
                    name: u.name,
                    email: u.email,
                    label: `${u.name} (${u.email}) — Event Co-Chair`,
                });
            }
        });

        // 1. Existing Project Staff
        (initialProject?.projectStaff || []).forEach((u) => {
            const uid = Number(u.id);
            if (!seen.has(uid)) {
                seen.add(uid);
                list.push({
                    id: uid,
                    name: u.name,
                    email: u.email,
                    label: `${u.name} (${u.email}) — Project Staff`,
                });
            }
        });

        // 2. Existing Project Members
        (initialProject?.projectMembers || []).forEach((u) => {
            const uid = Number(u.id);
            if (!seen.has(uid)) {
                seen.add(uid);
                list.push({
                    id: uid,
                    name: u.name,
                    email: u.email,
                    label: `${u.name} (${u.email}) — Member`,
                });
            }
        });

        // 3. Available Personnel / Institutional Users
        (initialProject?.availablePersonnel || []).forEach((u) => {
            const uid = Number(u.id);
            if (!seen.has(uid)) {
                seen.add(uid);
                list.push({
                    id: uid,
                    name: u.name,
                    email: u.email,
                    label: `${u.name} (${u.email})`,
                });
            }
        });

        (globalAvailableUsers || []).forEach((u) => {
            const uid = Number(u.id);
            if (!seen.has(uid)) {
                seen.add(uid);
                list.push({
                    id: uid,
                    name: u.name,
                    email: u.email,
                    label: `${u.name} (${u.email})`,
                });
            }
        });

        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [initialProject, globalAvailableUsers]);

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

    // Paginated deliverables
    const totalDeliverables = allDeliverables.length;
    const totalDeliverablePages = Math.max(1, Math.ceil(totalDeliverables / deliverablePageSize));
    const safeDeliverablePage = Math.min(deliverablePage, Math.max(1, totalDeliverablePages));
    const paginatedDeliverables = useMemo(() => {
        const start = (safeDeliverablePage - 1) * deliverablePageSize;
        return allDeliverables.slice(start, start + deliverablePageSize);
    }, [allDeliverables, safeDeliverablePage, deliverablePageSize]);

    // Paginated tasks (retained for backward compatibility / modals)
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

    const handleDesignateCoChair = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || !selectedCoChairUserId) return;

        setCoChairProcessing(true);
        setCoChairError(null);
        router.post(
            `/projects/${initialProject.id}/co-chairs`,
            { user_id: Number(selectedCoChairUserId) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedCoChairUserId('');
                    setCoChairProcessing(false);
                    setIsCoChairModalOpen(false);
                },
                onError: (errs) => {
                    setCoChairProcessing(false);
                    setCoChairError(errs.user_id || 'Failed to designate Event Co-Chair.');
                },
                onFinish: () => setCoChairProcessing(false),
            }
        );
    };

    const handleRemoveCoChair = (userId: number) => {
        if (!initialProject) return;
        setCoChairProcessing(true);
        router.delete(`/projects/${initialProject.id}/co-chairs/${userId}`, {
            preserveScroll: true,
            onFinish: () => setCoChairProcessing(false),
        });
    };

    // All distinct participants involved in this event
    const allEventParticipants = useMemo(() => {
        const list: Array<{
            id: number;
            name: string;
            email: string;
            roleLabel: string;
            badgeColor: string;
            isLeader?: boolean;
            isCoChair?: boolean;
            canRemove?: boolean;
            committeeName?: string;
        }> = [];
        const seen = new Set<number>();

        // Overall Chair
        if (initialProject.leader) {
            seen.add(initialProject.leader.id);
            list.push({
                id: initialProject.leader.id,
                name: initialProject.leader.name,
                email: initialProject.leader.email,
                roleLabel: 'Overall Chair',
                badgeColor: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
                isLeader: true,
                canRemove: false,
            });
        }

        // Event Co-Chairs
        (initialProject.eventCoChairs || []).forEach((cc) => {
            if (!seen.has(cc.id)) {
                seen.add(cc.id);
                list.push({
                    id: cc.id,
                    name: cc.name,
                    email: cc.email,
                    roleLabel: 'Event Co-Chair',
                    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
                    isCoChair: true,
                    canRemove: isLeader,
                });
            }
        });

        // Project Staff (Chairpersons)
        (initialProject.projectStaff || []).forEach((s) => {
            if (!seen.has(s.id)) {
                seen.add(s.id);
                const comm = s.committee_id ? (initialProject.committees || []).find((c) => String(c.id) === String(s.committee_id)) : null;
                list.push({
                    id: s.id,
                    name: s.name,
                    email: s.email,
                    roleLabel: comm ? `Chairperson (${comm.name})` : 'Project Staff',
                    badgeColor: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
                    canRemove: isLeader && s.id !== initialProject.leader?.id,
                    committeeName: comm?.name,
                });
            }
        });

        // Project Members
        (initialProject.projectMembers || []).forEach((m) => {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                const comm = m.committee_id ? (initialProject.committees || []).find((c) => String(c.id) === String(m.committee_id)) : null;
                list.push({
                    id: m.id,
                    name: m.name,
                    email: m.email,
                    roleLabel: comm ? `Member (${comm.name})` : 'Member',
                    badgeColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
                    canRemove: isLeader && m.id !== initialProject.leader?.id,
                    committeeName: comm?.name,
                });
            }
        });

        return list;
    }, [initialProject, isLeader]);

    // Available personnel from institution not yet in this event
    const assignablePersonnel = useMemo(() => {
        const existingIds = new Set(allEventParticipants.map((p) => p.id));
        return (initialProject.availablePersonnel || []).filter((u) => !existingIds.has(u.id));
    }, [allEventParticipants, initialProject.availablePersonnel]);

    // Handlers for Event Members
    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!initialProject || !newMemberUserId) return;
        setMemberProcessing(true);
        setMemberError(null);
        router.post(
            `/projects/${initialProject.id}/personnel`,
            {
                user_id: Number(newMemberUserId),
                role: newMemberRole,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewMemberUserId('');
                    setNewMemberRole('Project Member');
                },
                onError: (errs) => {
                    setMemberError((Object.values(errs)[0] as string) || 'Failed to add participant to event.');
                },
                onFinish: () => setMemberProcessing(false),
            }
        );
    };

    const handleRemoveMember = (userId: number) => {
        if (!initialProject) return;
        if (!confirm('Are you sure you want to remove this participant from the event?')) return;
        setMemberProcessing(true);
        router.delete(`/projects/${initialProject.id}/personnel/${userId}`, {
            preserveScroll: true,
            onFinish: () => setMemberProcessing(false),
        });
    };

    // Navigation Tabs: Deliverables, Committees, Timeline, Files, Chat, Overview
    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'deliverables', label: 'Deliverables', count: allDeliverables.length },
        { key: 'committees', label: 'Committees', count: allCommittees.length },
        { key: 'timeline', label: 'Timeline' },
        { key: 'files', label: 'Files', count: allDocuments.length },
        { key: 'chat', label: 'Chat' },
        { key: 'overview', label: 'Overview' },
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
                { label: 'Events', href: '/projects' },
                { label: initialProject.title },
            ]}
        >
            <Head title={initialProject.title} />

            <div className="space-y-6">
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
                                    <span>Overall Chair: </span>
                                    <span className="font-semibold text-[color:var(--text)]">
                                        {initialProject.leader?.name || 'Unassigned'}
                                    </span>
                                </div>
                                {initialProject.eventCoChairs && initialProject.eventCoChairs.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>Event Co-Chair(s): </span>
                                        {initialProject.eventCoChairs.map((cc) => (
                                            <span
                                                key={cc.id}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                                title={`Supporting Overall Chair · Designated ${cc.designated_at || ''}`}
                                            >
                                                <UserCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                <span>{cc.name}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
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

                            {/* Highlighted Send Reminders Button (For Leader, Staff & Event Co-Chairs) */}
                            {(isLeader || isStaff || initialProject.is_event_co_chair) && reminderTargetUrl && (
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

                            {/* Three Dots Menu for Event Options */}
                            {(isLeader || canCreateCommittee || initialProject.can?.designateCoChair) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="md" className="px-2.5 cursor-pointer" aria-label="More options">
                                            <MoreHorizontal className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] shadow-lg">
                                        {canCreateCommittee && (
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    resetCommitteeForm();
                                                    clearCommitteeErrors();
                                                    setIsCreateCommitteeModalOpen(true);
                                                }}
                                                className="text-[13px] cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5 mr-2" />
                                                Add committee
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuItem
                                            onClick={() => {
                                                setMemberError(null);
                                                setNewMemberUserId('');
                                                setIsMembersModalOpen(true);
                                            }}
                                            className="text-[13px] cursor-pointer"
                                        >
                                            <Users className="w-3.5 h-3.5 mr-2" />
                                            Members ({allEventParticipants.length})
                                        </DropdownMenuItem>

                                        {initialProject.can?.designateCoChair && (
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setCoChairError(null);
                                                    setSelectedCoChairUserId('');
                                                    setIsCoChairModalOpen(true);
                                                }}
                                                className="text-[13px] cursor-pointer text-amber-700 dark:text-amber-400"
                                            >
                                                <UserCheck className="w-3.5 h-3.5 mr-2 text-amber-600 dark:text-amber-400" />
                                                Event Co-Chairs ({(initialProject.eventCoChairs || []).length})
                                            </DropdownMenuItem>
                                        )}

                                        {isLeader && (
                                            <>
                                                <DropdownMenuSeparator className="bg-[color:var(--border)]" />
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
                                                    Edit event
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => setIsArchiveModalOpen(true)}
                                                    className="text-[13px] text-rose-600 dark:text-rose-400 cursor-pointer"
                                                >
                                                    <Archive className="w-3.5 h-3.5 mr-2" />
                                                    Archive event
                                                </DropdownMenuItem>
                                            </>
                                        )}
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
                                <span className="font-semibold text-[color:var(--muted)]">Overall event progress</span>
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
                        {/* ── TAB: DELIVERABLES ── */}
                        {(activeTab === 'deliverables' || (activeTab as string) === 'tasks') && (
                            <Card className="p-5 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[color:var(--border)]">
                                    <div>
                                        <h2 className="text-[16px] font-bold text-[color:var(--text)]">Event deliverables</h2>
                                        <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                            Official deliverables structured across all committees for this event
                                        </p>
                                    </div>
                                    {canCreateDeliverable && (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => {
                                                clearDeliverableErrors();
                                                if (!deliverableData.committee_id && eligibleCommitteesForDeliverable.length > 0) {
                                                    setDeliverableData('committee_id', eligibleCommitteesForDeliverable[0].id);
                                                }
                                                setIsCreateDeliverableModalOpen(true);
                                            }}
                                            className="flex items-center gap-1.5 font-bold shadow-xs cursor-pointer self-start sm:self-auto"
                                            data-testid="project-deliverables-create-btn"
                                        >
                                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Create deliverable</span>
                                        </Button>
                                    )}
                                </div>

                                {allDeliverables.length === 0 ? (
                                    <EmptyState
                                        title="No deliverables established yet"
                                        description="Deliverables represent key outputs created inside committees to track official milestones."
                                        actionLabel={canCreateDeliverable ? 'Create deliverable' : undefined}
                                        onAction={canCreateDeliverable ? () => {
                                            clearDeliverableErrors();
                                            if (!deliverableData.committee_id && eligibleCommitteesForDeliverable.length > 0) {
                                                setDeliverableData('committee_id', eligibleCommitteesForDeliverable[0].id);
                                            }
                                            setIsCreateDeliverableModalOpen(true);
                                        } : undefined}
                                    />
                                ) : (
                                    <div className="overflow-x-auto -mx-5 px-5">
                                        <table className="w-full text-left border-collapse text-[13px]">
                                            <thead>
                                                <tr className="border-b border-[color:var(--border)] text-[12px] font-semibold text-[color:var(--muted)] uppercase tracking-wider">
                                                    <th className="py-2.5 pr-4">Deliverable</th>
                                                    <th className="py-2.5 px-3">Committee</th>
                                                    <th className="py-2.5 px-3">Official Status</th>
                                                    <th className="py-2.5 px-3 min-w-[150px]">Task Progress</th>
                                                    <th className="py-2.5 pl-3">Due date</th>
                                                    <th className="py-2.5 pl-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[color:var(--border)]">
                                                {paginatedDeliverables.map((deliverable) => {
                                                    const deliverableUrl = deliverable.url || `/projects/${initialProject.id}/committees/${deliverable.committee.id}/activities/${deliverable.id}`;
                                                    const totalTasksInDeliv = deliverable.tasksCount ?? 0;
                                                    const completedTasksInDeliv = deliverable.completedTasksCount ?? 0;
                                                    const taskPct = deliverable.progress !== undefined
                                                        ? deliverable.progress
                                                        : totalTasksInDeliv > 0
                                                            ? Math.round((completedTasksInDeliv / totalTasksInDeliv) * 100)
                                                            : 0;

                                                    const isDeliverableCompleted = deliverable.status === 'Completed';
                                                    const committeeObj = (initialProject.committees || []).find(
                                                        (c) => String(c.id) === String(deliverable.committee.id)
                                                    );
                                                    const chairpersonName = deliverable.committee.chairperson?.name || committeeObj?.head?.name;

                                                    return (
                                                        <tr key={deliverable.id} className="hover:bg-[color:var(--soft-surface)] transition-colors">
                                                            <td className="py-3 pr-4 max-w-xs">
                                                                <Link
                                                                    href={deliverableUrl}
                                                                    className="font-semibold text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors text-left block truncate"
                                                                >
                                                                    {deliverable.title}
                                                                </Link>
                                                                {deliverable.description && (
                                                                    <p className="text-[11px] text-[color:var(--muted)] truncate max-w-sm mt-0.5">
                                                                        {deliverable.description}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <Link
                                                                    href={`/projects/${initialProject.id}/committees/${deliverable.committee.id}`}
                                                                    className="font-medium text-[color:var(--text)] hover:text-[color:var(--primary)] transition-colors block truncate"
                                                                >
                                                                    {deliverable.committee.name}
                                                                </Link>
                                                                <p className="text-[11px] text-[color:var(--muted)] truncate mt-0.5">
                                                                    Chairperson:{' '}
                                                                    <span className={chairpersonName ? "font-medium text-[color:var(--text)]" : "italic text-[color:var(--muted)] font-normal"}>
                                                                        {chairpersonName || 'Unassigned'}
                                                                    </span>
                                                                </p>
                                                            </td>
                                                            <td className="py-3 px-3 whitespace-nowrap">
                                                                <Badge variant={
                                                                    deliverable.status === 'Completed'
                                                                        ? 'accent'
                                                                        : deliverable.status === 'Under Review'
                                                                        ? 'secondary'
                                                                        : deliverable.status === 'Returned'
                                                                        ? 'danger'
                                                                        : 'soft'
                                                                }>
                                                                    {deliverable.status}
                                                                </Badge>
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <div className="space-y-1">
                                                                    <div className="flex items-center justify-between text-[11px] text-[color:var(--muted)]">
                                                                        <span>
                                                                            {totalTasksInDeliv > 0
                                                                                ? `${completedTasksInDeliv}/${totalTasksInDeliv} tasks`
                                                                                : '0 tasks'}
                                                                        </span>
                                                                        <span className="font-semibold tabular-nums text-[color:var(--text)]">
                                                                            {taskPct}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-300 ${
                                                                                isDeliverableCompleted
                                                                                    ? 'bg-emerald-500'
                                                                                    : taskPct > 0
                                                                                    ? 'bg-[color:var(--primary)]'
                                                                                    : 'bg-transparent'
                                                                            }`}
                                                                            style={{ width: `${taskPct}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 pl-3 whitespace-nowrap tabular-nums text-[color:var(--muted)]">
                                                                {deliverable.due_date || '—'}
                                                            </td>
                                                            <td className="py-3 pl-3 whitespace-nowrap text-right">
                                                                <Link href={deliverableUrl}>
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        className="text-[11px] font-semibold h-7 px-2.5 cursor-pointer"
                                                                    >
                                                                        Details
                                                                    </Button>
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Deliverables Client Pagination */}
                                {totalDeliverables > 0 && (
                                    <div className="pt-2 border-t border-[color:var(--border)] flex justify-center w-full">
                                        <Pagination
                                            currentPage={safeDeliverablePage}
                                            totalPages={totalDeliverablePages}
                                            totalItems={totalDeliverables}
                                            pageSize={deliverablePageSize}
                                            onPageChange={setDeliverablePage}
                                            onPageSizeChange={setDeliverablePageSize}
                                            pageSizeOptions={[5, 10, 25]}
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
                            <h2 className="text-[18px] font-bold text-[color:var(--text)]">Event group chat</h2>
                            <p className="text-[14px] text-[color:var(--muted)]">
                                Collaborate with committee members, share progress updates, and coordinate deliverables.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Link href={`/chat/${initialProject.id}`}>
                                <Button variant="primary" size="md">
                                    <span>Open event chat</span>
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
                                <h2 className="text-[16px] font-bold text-[color:var(--text)]">Event files and Special Order documents</h2>
                                <p className="text-[13px] text-[color:var(--muted)] mt-0.5">
                                    Official Special Orders, activity designs, approval letters, and submissions
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
                                description="Special Order documents such as official appointment letters or event charters will appear here."
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
                                Deliverables
                            </span>
                            <p className="text-[28px] font-bold text-[color:var(--text)] tabular-nums">
                                {allDeliverables.length}
                            </p>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                {allDeliverables.filter(d => d.status === 'Completed').length} completed
                            </p>
                        </Card>

                        <Card className="p-5 space-y-3">
                            <span className="text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                                Internal tasks
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
                                Document attachments
                            </span>
                            <p className="text-[28px] font-bold text-[color:var(--text)] tabular-nums">
                                {allDocuments.length}
                            </p>
                            <p className="text-[12px] text-[color:var(--muted)]">
                                Official Special Orders, MOVs, and documentation
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
                                description="Organize your event into functional committees headed by designated Chairpersons."
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
                                                <p>Chairperson: <span className="font-medium text-[color:var(--text)]">{comm.leadName || 'Unassigned'}</span></p>
                                                <p>{comm.membersCount} members · {comm.activitiesCount} deliverables</p>
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
                title="Edit event details"
                maxWidth="md"
            >
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <FormField
                        label="Event title"
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
                title="Archive event"
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
                            placeholder="Brief overview of committee scope and responsibilities"
                            className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px]"
                        />
                        <InputError message={committeeErrors.description} />
                    </div>

                    {isLeader && (
                        <div className="space-y-4 pt-1 border-t border-[color:var(--border)]">
                            <div>
                                <Label htmlFor="create-committee-chair">Chairperson (Optional)</Label>
                                <select
                                    id="create-committee-chair"
                                    value={committeeData.user_id}
                                    onChange={(e) => setCommitteeData('user_id', e.target.value)}
                                    className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)] cursor-pointer"
                                >
                                    <option value="">-- None (Assign later) --</option>
                                    {committeeCandidates.map((c) => (
                                        <option
                                            key={c.id}
                                            value={c.id}
                                            disabled={String(c.id) === String(committeeData.co_chair_id)}
                                        >
                                            {c.label} {String(c.id) === String(committeeData.co_chair_id) ? '(Selected as Co-Chair)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={committeeErrors.user_id} />
                            </div>

                            <div>
                                <Label htmlFor="create-committee-cochair">Co-Chair (Optional)</Label>
                                <select
                                    id="create-committee-cochair"
                                    value={committeeData.co_chair_id}
                                    onChange={(e) => setCommitteeData('co_chair_id', e.target.value)}
                                    className="w-full mt-1 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus:outline-none focus:border-[color:var(--primary)] cursor-pointer"
                                >
                                    <option value="">-- None (Assign later) --</option>
                                    {committeeCandidates.map((c) => (
                                        <option
                                            key={c.id}
                                            value={c.id}
                                            disabled={String(c.id) === String(committeeData.user_id)}
                                        >
                                            {c.label} {String(c.id) === String(committeeData.user_id) ? '(Selected as Chairperson)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <InputError message={committeeErrors.co_chair_id} />
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
                title="Attach Special Order / event document"
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

            {/* ── Create Deliverable Modal ── */}
            <Modal
                isOpen={isCreateDeliverableModalOpen}
                onClose={() => !deliverableProcessing && setIsCreateDeliverableModalOpen(false)}
                title="Create Event Deliverable"
                description={`Establish a key deliverable under a committee for ${initialProject.title}.`}
                maxWidth="md"
            >
                <form onSubmit={handleCreateDeliverableSubmit} className="space-y-4 pt-1">
                    {/* Committee Selection */}
                    <div>
                        <Label htmlFor="create-deliverable-committee" required>Target Committee</Label>
                        {eligibleCommitteesForDeliverable.length === 0 ? (
                            <div className="p-3 text-[13px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                No active committees available where you have permission to create deliverables.
                            </div>
                        ) : (
                            <select
                                id="create-deliverable-committee"
                                value={deliverableData.committee_id || eligibleCommitteesForDeliverable[0]?.id || ''}
                                onChange={(e) => setDeliverableData('committee_id', e.target.value)}
                                className="w-full mt-1.5 py-2 px-3 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] focus-visible:outline-3 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2 transition-colors cursor-pointer"
                                required
                            >
                                {eligibleCommitteesForDeliverable.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        <InputError message={deliverableErrors.committee_id} />
                    </div>

                    {/* Title */}
                    <FormField
                        label="Deliverable Title"
                        id="create-deliverable-title"
                        name="title"
                        value={deliverableData.title}
                        onChange={(e) => setDeliverableData('title', e.target.value)}
                        error={deliverableErrors.title}
                        required
                        placeholder="e.g. Program Schedule & Venue Layout"
                        disabled={deliverableProcessing}
                        autoFocus
                    />

                    {/* Description */}
                    <div>
                        <Label htmlFor="create-deliverable-description">Description (Optional)</Label>
                        <textarea
                            id="create-deliverable-description"
                            name="description"
                            rows={3}
                            value={deliverableData.description}
                            onChange={(e) => setDeliverableData('description', e.target.value)}
                            className="w-full mt-1.5 p-2 text-[14px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)] rounded-[8px] placeholder:text-[color:var(--muted)]"
                            placeholder="Describe the scope, objectives, or key outputs of this deliverable..."
                            disabled={deliverableProcessing}
                        />
                        <InputError message={deliverableErrors.description} />
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                            label="Start Date (Optional)"
                            id="create-deliverable-start-date"
                            type="date"
                            value={deliverableData.start_date}
                            onChange={(e) => setDeliverableData('start_date', e.target.value)}
                            error={deliverableErrors.start_date}
                            disabled={deliverableProcessing}
                        />

                        <FormField
                            label="Target Due Date (Optional)"
                            id="create-deliverable-due-date"
                            type="date"
                            value={deliverableData.due_date}
                            onChange={(e) => setDeliverableData('due_date', e.target.value)}
                            error={deliverableErrors.due_date}
                            disabled={deliverableProcessing}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[color:var(--border)]">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsCreateDeliverableModalOpen(false)}
                            disabled={deliverableProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={deliverableProcessing}
                            disabled={deliverableProcessing || eligibleCommitteesForDeliverable.length === 0}
                        >
                            Create Deliverable
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

            {/* ── Manage Event Co-Chairs Modal ── */}
            <Modal
                isOpen={isCoChairModalOpen}
                onClose={() => !coChairProcessing && setIsCoChairModalOpen(false)}
                title="Event Co-Chair Designations"
                maxWidth="md"
            >
                <div className="space-y-5">
                    <p className="text-[13px] text-[color:var(--muted)] leading-relaxed">
                        Designate existing event participants as Event-level Co-Chairs to support the Overall Chair with event-wide coordination, deliverable tracking, and reminders. Note: Committee-level Co-Chairs are managed independently within each committee.
                    </p>

                    {/* Current Event Co-Chairs */}
                    <div className="space-y-2">
                        <h4 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                            Current Event Co-Chairs ({(initialProject.eventCoChairs || []).length})
                        </h4>
                        {(initialProject.eventCoChairs || []).length === 0 ? (
                            <div className="p-3.5 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--soft-surface)] text-center text-[12px] text-[color:var(--muted)]">
                                No Event Co-Chairs currently designated.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(initialProject.eventCoChairs || []).map((cc) => (
                                    <div
                                        key={cc.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-[color:var(--text)]">{cc.name}</span>
                                                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                                    Event Co-Chair
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-[color:var(--muted)]">{cc.email}</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={coChairProcessing}
                                            onClick={() => handleRemoveCoChair(cc.id)}
                                            className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Form to designate new Event Co-Chair */}
                    <div className="pt-4 border-t border-[color:var(--border)] space-y-3">
                        <h4 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                            Designate New Event Co-Chair
                        </h4>

                        {(initialProject.eligibleCoChairs || []).length === 0 ? (
                            <p className="text-[12px] text-[color:var(--muted)] italic">
                                No eligible participants available to designate. All event participants are already designated or not eligible.
                            </p>
                        ) : (
                            <form onSubmit={handleDesignateCoChair} className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="designate-event-cochair-select">Select Event Participant</Label>
                                    <select
                                        id="designate-event-cochair-select"
                                        value={selectedCoChairUserId}
                                        onChange={(e) => setSelectedCoChairUserId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-md shadow-xs focus:outline-none focus:border-[color:var(--primary)] text-[color:var(--text)] cursor-pointer"
                                    >
                                        <option value="">-- Choose an event participant --</option>
                                        {(initialProject.eligibleCoChairs || []).map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.email}) {m.role ? `— ${m.role}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {coChairError && <InputError message={coChairError} />}
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCoChairModalOpen(false)}
                                        disabled={coChairProcessing}
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={!selectedCoChairUserId || coChairProcessing}
                                        isLoading={coChairProcessing}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        Designate as Event Co-Chair
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </Modal>

            {/* ── Manage Event Members Modal ── */}
            <Modal
                isOpen={isMembersModalOpen}
                onClose={() => !memberProcessing && setIsMembersModalOpen(false)}
                title="Event Members & Personnel"
                maxWidth="lg"
            >
                <div className="space-y-5">
                    <p className="text-[13px] text-[color:var(--muted)] leading-relaxed">
                        View and manage designated leaders, staff, committee members, and participants for this event.
                    </p>

                    {/* Current Event Participants */}
                    <div className="space-y-2">
                        <h4 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                            Current Participants ({allEventParticipants.length})
                        </h4>

                        {allEventParticipants.length === 0 ? (
                            <div className="p-3.5 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--soft-surface)] text-center text-[12px] text-[color:var(--muted)]">
                                No members assigned to this event yet.
                            </div>
                        ) : (
                            <div className="max-h-72 overflow-y-auto divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded-lg">
                                {allEventParticipants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="p-3 flex items-center justify-between gap-3 bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)] transition-colors text-xs"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-[color:var(--text)]">{p.name}</span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${p.badgeColor}`}>
                                                    {p.roleLabel}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-[color:var(--muted)] truncate">{p.email}</p>
                                        </div>

                                        {p.canRemove && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={memberProcessing}
                                                onClick={() => handleRemoveMember(p.id)}
                                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs shrink-0"
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add Member Form (for Overall Chair) */}
                    {isLeader && (
                        <div className="pt-4 border-t border-[color:var(--border)] space-y-3">
                            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
                                Add Participant to Event
                            </h4>

                            {assignablePersonnel.length === 0 ? (
                                <p className="text-[12px] text-[color:var(--muted)] italic">
                                    All available institutional personnel have already been added to this event.
                                </p>
                            ) : (
                                <form onSubmit={handleAddMember} className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2 space-y-1">
                                            <Label htmlFor="add-event-member-select">Select Personnel</Label>
                                            <select
                                                id="add-event-member-select"
                                                value={newMemberUserId}
                                                onChange={(e) => setNewMemberUserId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-md shadow-xs focus:outline-none focus:border-[color:var(--primary)] text-[color:var(--text)] cursor-pointer"
                                            >
                                                <option value="">-- Choose faculty or personnel --</option>
                                                {assignablePersonnel.map((u) => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name} ({u.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor="add-event-member-role">Event Role</Label>
                                            <select
                                                id="add-event-member-role"
                                                value={newMemberRole}
                                                onChange={(e) => setNewMemberRole(e.target.value as 'Project Member' | 'Project Staff')}
                                                className="w-full px-3 py-2 text-xs bg-[color:var(--soft-surface)] border border-[color:var(--border)] rounded-md shadow-xs focus:outline-none focus:border-[color:var(--primary)] text-[color:var(--text)] cursor-pointer"
                                            >
                                                <option value="Project Member">Member</option>
                                                <option value="Project Staff">Staff</option>
                                            </select>
                                        </div>
                                    </div>

                                    {memberError && <InputError message={memberError} />}

                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsMembersModalOpen(false)}
                                            disabled={memberProcessing}
                                        >
                                            Close
                                        </Button>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            disabled={!newMemberUserId || memberProcessing}
                                            isLoading={memberProcessing}
                                        >
                                            Add to Event
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </AppLayout>
    );
}
