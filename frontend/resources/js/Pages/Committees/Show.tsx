import React, { useState } from 'react';
import { Head, Link, useForm, router, usePage } from '@inertiajs/react';
import { PageProps } from '@/types';
import { AppLayout } from '@/Layouts/AppLayout';
import { ProjectRoleBadge } from '@/Components/ProjectRoleBadge';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import { getProgressBarGradient } from '@/lib/progress';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import {
    Users,
    UserCheck,
    UserMinus,
    UserPlus,
    ArrowLeft,
    ChevronRight,
    Edit3,
    Trash2,
    Shield,
    FolderOpen,
    AlertTriangle,
    Info,
    Plus,
    X,
    ListTodo,
    Calendar,
    Clock,
    MoreHorizontal,
    Sparkles,
    UploadCloud,
    FileText,
    CheckCircle2,
    Award,
} from 'lucide-react';

interface MemberResumeData {
    original_name: string;
    skills: string[];
    certifications: string[];
    eligibility_status: string;
}

interface MemberRecommendation {
    user_id: number;
    name: string;
    email: string;
    has_resume: boolean;
    has_questionnaire?: boolean;
    resume_name?: string;
    suitability_score: number;
    eligibility_status: string;
    recommendation_reason: string;
    extracted_skills: string[];
    top_strengths?: string[];
    availability?: string | null;
    certifications?: string[];
}

interface MemberItem {
    id: number;
    name: string;
    email: string;
    assigned_at?: string;
    context?: string | null;
    other_committees_count?: number;
    tasks_count?: number;
    completed_tasks_count?: number;
    progress?: number;
    is_co_chair?: boolean;
    has_resume?: boolean;
    resume?: MemberResumeData | null;
}

interface StaffItem {
    id: number;
    name: string;
    email: string;
    committee_id?: string | null;
    committee_name?: string | null;
    is_event_co_chair?: boolean;
    tasks_count?: number;
    completed_tasks_count?: number;
    progress?: number;
}

export interface CommitteeActivityItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress?: number;
    start_date?: string | null;
    start_date_raw?: string | null;
    due_date: string | null;
    due_date_raw: string | null;
    tasks_count: number;
    completed_tasks_count: number;
    creator?: {
        id: number;
        name: string;
    } | null;
    assignee_names?: string[];
}

export interface CommitteeData {
    id: string;
    name: string;
    description: string | null;
    progress?: number;
    project: {
        id: string;
        title: string;
        status: string;
    };
    head: StaffItem | null;
    members: MemberItem[];
    coChairs?: Array<{
        id: number;
        name: string;
        email: string;
        designated_at?: string;
    }>;
    is_committee_co_chair?: boolean;
    eligibleCoChairs?: Array<{
        id: number;
        name: string;
        email: string;
    }>;
    activities?: CommitteeActivityItem[];
    can: {
        update: boolean;
        delete: boolean;
        manageMembers: boolean;
        createActivity?: boolean;
        designateCoChair?: boolean;
    };
}

export interface CommitteeShowProps {
    project: {
        id: string;
        title: string;
        status: string;
        role?: string | null;
    };
    committee: CommitteeData;
    availableMembers: MemberItem[];
    availableStaff: StaffItem[];
}

export default function CommitteeShow({
    project,
    committee,
    availableMembers = [],
    availableStaff = [],
}: CommitteeShowProps) {
    const { auth } = usePage<PageProps>().props;
    const currentUserId = auth?.user?.id;

    if (!committee) {
        return (
            <AppLayout title="Committee Not Found" subtitle="Committee Workspace">
                <Head title="Committee Not Found — ITASK" />
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-bold text-[color:var(--text)]">Committee Not Found</h2>
                    <p className="text-xs text-[color:var(--muted)] max-w-sm mt-2 mb-6 leading-relaxed">
                        This committee could not be found or you do not have permission to view it.
                    </p>
                    <Link
                        href={`/projects/${project?.id ?? ''}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors bg-[color:var(--primary)] hover:opacity-90"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Event
                    </Link>
                </div>
            </AppLayout>
        );
    }

    // Modal states
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
    const [isUnassignStaffModalOpen, setIsUnassignStaffModalOpen] = useState(false);
    const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
    const [isCreateActivityModalOpen, setIsCreateActivityModalOpen] = useState(false);
    const [isCoChairModalOpen, setIsCoChairModalOpen] = useState(false);
    const [selectedCoChairUserId, setSelectedCoChairUserId] = useState<string>('');
    const [coChairProcessing, setCoChairProcessing] = useState(false);
    const [coChairError, setCoChairError] = useState<string | null>(null);

    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [unassignProcessing, setUnassignProcessing] = useState(false);
    const [removeMemberProcessing, setRemoveMemberProcessing] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);

    const handleDesignateCoChair = (userId?: number) => {
        const idToDesignate = userId || (selectedCoChairUserId ? Number(selectedCoChairUserId) : null);
        if (!idToDesignate) return;
        setCoChairProcessing(true);
        setCoChairError(null);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/co-chairs`,
            { user_id: idToDesignate },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedCoChairUserId('');
                    setCoChairProcessing(false);
                },
                onError: (errs) => {
                    setCoChairProcessing(false);
                    setCoChairError(errs.user_id || 'Failed to designate Co-Chair.');
                },
                onFinish: () => setCoChairProcessing(false),
            }
        );
    };

    const handleRemoveCoChair = (userId: number) => {
        setCoChairProcessing(true);
        router.delete(
            `/projects/${project.id}/committees/${committee.id}/co-chairs/${userId}`,
            {
                preserveScroll: true,
                onFinish: () => setCoChairProcessing(false),
            }
        );
    };

    // AI Screening & Recommendation state
    const [recommendations, setRecommendations] = useState<MemberRecommendation[] | null>(null);
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendationError, setRecommendationError] = useState<string | null>(null);
    const [ollamaActive, setOllamaActive] = useState<boolean | null>(null);

    // Resume Upload Modal state
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [userForResume, setUserForResume] = useState<MemberItem | null>(null);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeUploadProcessing, setResumeUploadProcessing] = useState(false);
    const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
    const [resumeUploadSuccess, setResumeUploadSuccess] = useState<string | null>(null);

    const handleFetchRecommendations = async () => {
        setIsRecommending(true);
        setRecommendationError(null);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch(`/projects/${project.id}/committees/${committee.id}/recommend-members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
            });
            const data = await res.json();
            if (data.success) {
                setRecommendations(data.recommendations);
                setOllamaActive(data.ollama_active);
            } else {
                setRecommendationError('Unable to generate AI recommendations.');
            }
        } catch (err: any) {
            setRecommendationError(err.message || 'Error communicating with screening service.');
        } finally {
            setIsRecommending(false);
        }
    };

    const handleSelectTopMatch = () => {
        if (!recommendations || recommendations.length === 0) return;
        const top = recommendations[0];
        if (!assignData.user_ids.includes(top.user_id)) {
            setAssignData('user_ids', [...assignData.user_ids, top.user_id]);
        }
    };

    const handleOpenUploadResume = (member: MemberItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setUserForResume(member);
        setResumeFile(null);
        setResumeUploadError(null);
        setResumeUploadSuccess(null);
        setIsResumeModalOpen(true);
    };

    const handleUploadResumeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userForResume || !resumeFile) return;
        setResumeUploadProcessing(true);
        setResumeUploadError(null);
        setResumeUploadSuccess(null);

        const formData = new FormData();
        formData.append('resume', resumeFile);

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content;
            const res = await fetch(`/users/${userForResume.id}/resume`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken || '',
                    'Accept': 'application/json',
                },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setResumeUploadSuccess(`CV for ${userForResume.name} uploaded and analyzed!`);
                setTimeout(() => {
                    setIsResumeModalOpen(false);
                    handleFetchRecommendations();
                }, 1200);
            } else {
                setResumeUploadError(data.message || 'Failed to upload and analyze CV.');
            }
        } catch (err: any) {
            setResumeUploadError(err.message || 'Error uploading file.');
        } finally {
            setResumeUploadProcessing(false);
        }
    };

    // Assign / Change Staff form
    const {
        data: staffData,
        setData: setStaffData,
        post: submitAssignStaff,
        processing: staffProcessing,
        errors: staffErrors,
        reset: resetStaff,
        clearErrors: clearStaffErrors,
    } = useForm({
        user_id: committee.head?.id ? String(committee.head.id) : '',
    });

    // Assign Member form
    const {
        data: assignData,
        setData: setAssignData,
        processing: assignProcessing,
        errors: assignErrors,
        reset: resetAssign,
        clearErrors: clearAssignErrors,
    } = useForm<{ user_id: string; user_ids: number[] }>({
        user_id: '',
        user_ids: [],
    });

    const [memberSearchQuery, setMemberSearchQuery] = useState('');

    // Create Activity form
    const {
        data: activityData,
        setData: setActivityData,
        post: submitCreateActivity,
        processing: activityProcessing,
        errors: activityErrors,
        reset: resetActivityForm,
        clearErrors: clearActivityErrors,
    } = useForm({
        title: '',
        description: '',
        start_date: '',
        due_date: '',
    });

    // Edit Committee form
    const {
        data: editData,
        setData: setEditData,
        patch: submitEditCommittee,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
    } = useForm({
        name: committee.name,
        description: committee.description ?? '',
        user_id: committee.head?.id ? String(committee.head.id) : '',
    });

    const eligibleMembers = React.useMemo(() => {
        return availableMembers.filter(
            (m) => !committee.members.some((cm) => cm.id === m.id)
        );
    }, [availableMembers, committee.members]);

    const filteredEligibleMembers = React.useMemo(() => {
        if (!memberSearchQuery.trim()) return eligibleMembers;
        const q = memberSearchQuery.toLowerCase();
        return eligibleMembers.filter(
            (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        );
    }, [eligibleMembers, memberSearchQuery]);

    const handleOpenStaffModal = () => {
        setStaffData('user_id', committee.head?.id ? String(committee.head.id) : '');
        clearStaffErrors();
        setIsStaffModalOpen(true);
    };

    const handleCloseStaffModal = () => {
        if (staffProcessing) return;
        setIsStaffModalOpen(false);
        clearStaffErrors();
        resetStaff();
    };

    const handleAssignStaffSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (staffProcessing) return;
        submitAssignStaff(
            `/projects/${project.id}/committees/${committee.id}/staff`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsStaffModalOpen(false);
                },
            }
        );
    };

    const handleUnassignStaff = () => {
        if (unassignProcessing) return;
        setUnassignProcessing(true);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/staff`,
            { user_id: '' },
            {
                preserveScroll: true,
                onFinish: () => setUnassignProcessing(false),
                onSuccess: () => {
                    setIsUnassignStaffModalOpen(false);
                    setIsStaffModalOpen(false);
                },
            }
        );
    };

    const handleOpenAssignModal = () => {
        resetAssign();
        clearAssignErrors();
        setMemberSearchQuery('');
        setIsAssignModalOpen(true);
        handleFetchRecommendations();
    };

    const toggleMemberSelection = (id: number) => {
        const current = assignData.user_ids;
        let next: number[];
        if (current.includes(id)) {
            next = current.filter((x) => x !== id);
        } else {
            next = [...current, id];
        }
        setAssignData((prev) => ({
            ...prev,
            user_ids: next,
            user_id: next.length > 0 ? String(next[0]) : '',
        }));
    };

    const handleSelectAll = (filtered: MemberItem[]) => {
        const ids = filtered.map((m) => m.id);
        setAssignData((prev) => ({
            ...prev,
            user_ids: ids,
            user_id: ids.length > 0 ? String(ids[0]) : '',
        }));
    };

    const handleDeselectAll = () => {
        setAssignData((prev) => ({
            ...prev,
            user_ids: [],
            user_id: '',
        }));
    };

    const handleAssignMemberSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (assignProcessing) return;

        const payload: { user_ids?: number[]; user_id?: string } = {};
        if (assignData.user_ids.length > 0) {
            payload.user_ids = assignData.user_ids;
        } else if (assignData.user_id) {
            payload.user_id = assignData.user_id;
        } else {
            return;
        }

        router.post(
            `/projects/${project.id}/committees/${committee.id}/members`,
            payload,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAssignModalOpen(false);
                    resetAssign();
                    setMemberSearchQuery('');
                },
            }
        );
    };

    const handleOpenRemoveMemberModal = (member: MemberItem) => {
        setMemberToRemove(member);
        setIsRemoveMemberModalOpen(true);
    };

    const handleCloseRemoveMemberModal = () => {
        if (removeMemberProcessing) return;
        setIsRemoveMemberModalOpen(false);
        setMemberToRemove(null);
    };

    const handleConfirmRemoveMember = () => {
        if (!memberToRemove || removeMemberProcessing) return;
        setRemoveMemberProcessing(true);
        router.delete(
            `/projects/${project.id}/committees/${committee.id}/members/${memberToRemove.id}`,
            {
                preserveScroll: true,
                onFinish: () => {
                    setRemoveMemberProcessing(false);
                    setIsRemoveMemberModalOpen(false);
                    setMemberToRemove(null);
                },
            }
        );
    };

    const staffOptions = React.useMemo(() => {
        const list = [...availableStaff];
        if (committee?.head && !list.some((s) => s.id === committee.head?.id)) {
            list.unshift(committee.head);
        }
        return list;
    }, [availableStaff, committee?.head]);

    const handleOpenEditModal = () => {
        setEditData({
            name: committee.name,
            description: committee.description ?? '',
            user_id: committee.head?.id ? String(committee.head.id) : '',
        });
        clearEditErrors();
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        if (editProcessing) return;
        setIsEditModalOpen(false);
        clearEditErrors();
        setEditData({
            name: committee.name,
            description: committee.description ?? '',
            user_id: committee.head?.id ? String(committee.head.id) : '',
        });
    };

    const handleEditCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editProcessing) return;
        submitEditCommittee(
            `/projects/${project.id}/committees/${committee.id}`,
            {
                onSuccess: () => {
                    setIsEditModalOpen(false);
                    clearEditErrors();
                },
            }
        );
    };

    const handleDeleteCommittee = () => {
        if (deleteProcessing) return;
        setDeleteProcessing(true);
        router.delete(`/projects/${project.id}/committees/${committee.id}`, {
            onFinish: () => setDeleteProcessing(false),
            onSuccess: () => {
                setIsDeleteModalOpen(false);
            },
        });
    };

    const handleCreateActivitySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitCreateActivity(
            `/projects/${project.id}/committees/${committee.id}/activities`,
            {
                onSuccess: () => {
                    setIsCreateActivityModalOpen(false);
                    resetActivityForm();
                },
            }
        );
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .filter(Boolean)
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const avatarColors = [
        'bg-rose-100 text-rose-800',
        'bg-emerald-100 text-emerald-800',
        'bg-sky-100 text-sky-800',
        'bg-amber-100 text-amber-800',
        'bg-purple-100 text-purple-800',
        'bg-teal-100 text-teal-800',
        'bg-indigo-100 text-indigo-800',
    ];

    const getAvatarColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % avatarColors.length;
        return avatarColors[index];
    };

    const getActivityStatusBadge = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
            case 'In Progress':
                return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
            case 'Under Review':
                return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
            case 'Returned':
            case 'Returned for Revision':
                return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40';
            case 'To Do':
            default:
                return 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        }
    };

    const getActivityStatusDot = (status: string) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-500';
            case 'In Progress':
                return 'bg-blue-500';
            case 'Under Review':
                return 'bg-amber-500';
            case 'Returned':
            case 'Returned for Revision':
                return 'bg-rose-500';
            case 'To Do':
            default:
                return 'bg-slate-400';
        }
    };

    return (
        <AppLayout
            hidePageHeadingBanner={true}
            currentProject={{
                title: project.title,
                role: project.role ?? undefined,
                status: project.status,
            }}
        >
            <Head title={`${committee.name} — ${project.title} — ITASK`} />

            <div className="-mx-4 sm:-mx-6 -mt-6">
                {/* ── Committee Header ── */}
                <div className="bg-[color:var(--card)] border-b border-[color:var(--border)] shadow-[0_1px_3px_0_rgb(0,0,0,0.02)]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-6 space-y-4">
                        {/* ── Breadcrumb Navigation ── */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <Link
                                href="/projects"
                                className="hover:text-[color:var(--primary)] transition-colors"
                            >
                                Events
                            </Link>
                            <span className="text-slate-400 dark:text-slate-500">/</span>
                            <Link
                                href={`/projects/${project.id}`}
                                className="hover:text-[color:var(--primary)] transition-colors truncate max-w-xs"
                            >
                                {project.title}
                            </Link>
                            <span className="text-slate-400 dark:text-slate-500">/</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-xs">
                                {committee.name}
                            </span>
                        </div>

                        {/* ── Committee Header Area ── */}
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="space-y-1.5">
                                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                        {committee.name}
                                    </h1>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                        {committee.head ? (
                                            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
                                                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                                    {getInitials(committee.head.name)}
                                                </span>
                                                <span>{committee.head.name}</span>
                                                <span className="text-slate-500 dark:text-slate-400 font-normal">(Chairperson)</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 dark:text-slate-500 italic">No Chairperson Assigned</span>
                                        )}
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span>{committee.members.length} member{committee.members.length === 1 ? '' : 's'}</span>
                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                        <span>{(committee.activities || []).length} deliverable{(committee.activities || []).length === 1 ? '' : 's'}</span>
                                    </div>
                                </div>

                                {/* Top-Right Action Buttons */}
                                <div className="flex items-center gap-2.5 shrink-0">
                                    {committee.can.manageMembers && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleOpenAssignModal}
                                            className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold shadow-2xs"
                                        >
                                            Manage Members
                                        </Button>
                                    )}

                                    {committee.can.createActivity && (
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => {
                                                resetActivityForm();
                                                clearActivityErrors();
                                                setIsCreateActivityModalOpen(true);
                                            }}
                                            className="shadow-2xs font-semibold"
                                        >
                                            + Add Deliverable
                                        </Button>
                                    )}

                                    {/* 3-dots dropdown menu for Committee Options */}
                                    {(committee.can.update || committee.can.delete) && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                                                    title="Committee Options"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] shadow-lg rounded-xl p-1 z-50">
                                                {committee.can.update && (
                                                    <>
                                                        <DropdownMenuItem
                                                            onClick={handleOpenEditModal}
                                                            className="cursor-pointer text-xs font-medium text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] rounded-lg px-2.5 py-2 flex items-center gap-2"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5 text-[color:var(--muted)]" />
                                                            <span>Edit Committee</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={handleOpenStaffModal}
                                                            className="cursor-pointer text-xs font-medium text-[color:var(--text)] hover:bg-[color:var(--soft-surface)] rounded-lg px-2.5 py-2 flex items-center gap-2"
                                                        >
                                                            <UserPlus className="w-3.5 h-3.5 text-[color:var(--muted)]" />
                                                            <span>{committee.head ? 'Change Chairperson' : 'Assign Chairperson'}</span>
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {committee.can.delete && (
                                                    <>
                                                        <DropdownMenuSeparator className="my-1 border-t border-[color:var(--border)]" />
                                                        <DropdownMenuItem
                                                            onClick={() => setIsDeleteModalOpen(true)}
                                                            className="cursor-pointer text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg px-2.5 py-2 flex items-center gap-2"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                                            <span>Remove Committee</span>
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            {/* Committee Progress Bar */}
                            {(() => {
                                const cVal = Math.round(committee.progress ?? 0);
                                const isDone = cVal >= 100;
                                const cStyles = getProgressBarGradient(cVal, isDone);
                                return (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-500 dark:text-slate-400">Committee Progress</span>
                                            <span className={`px-2 py-0.5 rounded-full font-bold tabular-nums text-[10px] border shadow-2xs ${cStyles.badgeBg} ${cStyles.badgeText} ${cStyles.badgeBorder}`}>
                                                {isDone ? 'Complete (100%)' : `${cVal}%`}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden p-[0.5px]">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${cStyles.barGradient} ${cStyles.shadow}`}
                                                style={{ width: `${cVal > 0 ? Math.max(3, cVal) : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── Main Content Area: Activities & Committee Members ── */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Left Column: Activities (~65-68%) */}
                        <div className="lg:col-span-8 space-y-4">
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Deliverables</h2>

                            {committee.activities && committee.activities.length > 0 ? (
                                <div className="space-y-3.5">
                                    {committee.activities.map((act) => {
                                        const assignedName =
                                            act.assignee_names && act.assignee_names.length > 0
                                                ? act.assignee_names.join(', ')
                                                : act.creator?.name ?? committee.head?.name ?? 'Unassigned';

                                        return (
                                            <div
                                                key={act.id}
                                                className="bg-[color:var(--card)] rounded-xl border border-[color:var(--border)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <Link
                                                        href={`/projects/${project.id}/committees/${committee.id}/activities/${act.id}`}
                                                        className="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-[color:var(--primary)] hover:underline transition-colors leading-snug"
                                                    >
                                                        {act.title}
                                                    </Link>
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 border ${getActivityStatusBadge(
                                                            act.status
                                                        )}`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${getActivityStatusDot(act.status)}`} />
                                                        <span>{act.status}</span>
                                                    </span>
                                                </div>

                                                {act.description && (
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                                        {act.description}
                                                    </p>
                                                )}

                                                {/* Progress bar and percentage */}
                                                {(() => {
                                                    const actVal = Math.round(act.progress ?? 0);
                                                    const isDone = act.status === 'Completed' || actVal >= 100;
                                                    const actStyles = getProgressBarGradient(actVal, isDone);
                                                    return (
                                                        <div className="mt-4 flex items-center gap-3">
                                                            <div className="flex-1 h-2 rounded-full bg-[color:var(--soft-surface)] border border-[color:var(--border)] overflow-hidden p-[0.5px]">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-300 ${actStyles.barGradient}`}
                                                                    style={{ width: `${actVal > 0 ? Math.max(3, actVal) : 0}%` }}
                                                                />
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border tabular-nums shrink-0 ${actStyles.badgeBg} ${actStyles.badgeText} ${actStyles.badgeBorder}`}>
                                                                {actVal}%
                                                            </span>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Footer info: Assigned, Tasks count, Due date */}
                                                <div className="mt-3 pt-2.5 border-t border-[color:var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span>
                                                            <strong className="font-semibold text-slate-700 dark:text-slate-200">Assigned:</strong>{' '}
                                                            <span className="font-medium text-slate-900 dark:text-slate-100">{assignedName}</span>
                                                        </span>
                                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                                        <span>
                                                            {act.completed_tasks_count}/{act.tasks_count} tasks done
                                                        </span>
                                                    </div>
                                                    <div className="text-slate-700 dark:text-slate-200 font-medium shrink-0">
                                                        {act.due_date ? `Due ${act.due_date}` : <span className="text-slate-400 dark:text-slate-500 italic font-normal">No deadline</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                    <ListTodo className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">No Deliverables Established Yet</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 leading-relaxed">
                                        Form functional deliverables under this committee to begin structuring tasks and work assignments.
                                    </p>
                                    {committee.can?.createActivity && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                resetActivityForm();
                                                clearActivityErrors();
                                                setIsCreateActivityModalOpen(true);
                                            }}
                                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--primary)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>+ Add Deliverable</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Committee Members (~32-35%) */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Committee Members</h2>
                                {committee.can?.designateCoChair && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCoChairError(null);
                                            setSelectedCoChairUserId('');
                                            setIsCoChairModalOpen(true);
                                        }}
                                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer"
                                    >
                                        <UserCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                        <span>Co-Chairs ({committee.coChairs?.length || 0})</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {/* Project Staff (Head) Card */}
                                {committee.head && (
                                    <div className="bg-[color:var(--card)] rounded-xl border border-[color:var(--border)] p-3.5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                                                    {getInitials(committee.head.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                            {committee.head.name}
                                                        </p>
                                                        {currentUserId && committee.head.id === currentUserId && (
                                                            <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-orange-100 dark:bg-orange-950/40 text-[color:var(--primary)] border border-orange-200 dark:border-orange-800/50">
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                        Chairperson (Head)
                                                    </p>
                                                </div>
                                            </div>

                                            {(committee.head.tasks_count !== undefined && committee.head.tasks_count > 0) && (
                                                <div className="text-right shrink-0">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                                        {committee.head.progress ?? 0}%
                                                    </span>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                        {committee.head.tasks_count} tasks
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {(committee.head.tasks_count !== undefined && committee.head.tasks_count > 0) && (
                                            <div className="mt-2.5 w-full h-1.5 rounded-full bg-[color:var(--soft-surface)] overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${getProgressBarGradient(committee.head.progress ?? 0).barGradient}`}
                                                    style={{ width: `${committee.head.progress ?? 0}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Committee Members list */}
                                {committee.members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="bg-[color:var(--card)] rounded-xl border border-[color:var(--border)] p-3.5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-400 dark:hover:border-slate-600 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${getAvatarColor(member.name)}`}>
                                                    {getInitials(member.name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                                            {member.name}
                                                        </p>
                                                        {member.is_co_chair && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40 inline-flex items-center gap-0.5">
                                                                <UserCheck className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                                                                Co-Chair
                                                            </span>
                                                        )}
                                                        {currentUserId && member.id === currentUserId && (
                                                            <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                        {member.is_co_chair ? 'Member · Committee Co-Chair' : 'Member'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0 flex items-center gap-2">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                                        {member.progress ?? 0}%
                                                    </span>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                                        {member.tasks_count ?? 0} task{(member.tasks_count ?? 0) === 1 ? '' : 's'}
                                                    </p>
                                                </div>
                                                {committee.can?.designateCoChair && (
                                                    <button
                                                        type="button"
                                                        onClick={() => member.is_co_chair ? handleRemoveCoChair(member.id) : handleDesignateCoChair(member.id)}
                                                        disabled={coChairProcessing}
                                                        className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer ${member.is_co_chair
                                                            ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                                            : 'text-slate-400 dark:text-slate-500 hover:text-amber-600 hover:bg-[color:var(--soft-surface)]'
                                                            }`}
                                                        title={member.is_co_chair ? 'Remove Co-Chair designation' : 'Designate as Committee Co-Chair'}
                                                        aria-label={member.is_co_chair ? 'Remove Co-Chair designation' : 'Designate as Committee Co-Chair'}
                                                    >
                                                        <UserCheck className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {committee.can.manageMembers && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenRemoveMemberModal(member)}
                                                        className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-slate-600 hover:text-rose-600 transition-opacity p-0.5 rounded cursor-pointer"
                                                        title={`Remove ${member.name} from committee`}
                                                        aria-label={`Remove ${member.name} from committee`}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-2.5 w-full h-1.5 rounded-full bg-[color:var(--soft-surface)] overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${getProgressBarGradient(member.progress ?? 0).barGradient}`}
                                                style={{ width: `${member.progress ?? 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}

                                {committee.members.length === 0 && !committee.head && (
                                    <div className="py-8 px-4 text-center rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--soft-surface)]">
                                        <Users className="w-7 h-7 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">No Members Assigned</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
                                            No personnel have been assigned to this committee yet.
                                        </p>
                                        {committee.can.manageMembers && (
                                            <button
                                                type="button"
                                                onClick={handleOpenAssignModal}
                                                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--primary)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                <span>Assign Members</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Assign Member Modal ── */}
            <Modal
                isOpen={isAssignModalOpen}
                onClose={() => !assignProcessing && setIsAssignModalOpen(false)}
                title="Assign Committee Members"
                description={`Select eligible Members from ${project.title} to assign to ${committee.name}.`}
                maxWidth="lg"
            >
                <form onSubmit={handleAssignMemberSubmit} className="space-y-4 pt-1">
                    {eligibleMembers.length > 0 ? (
                        <div className="space-y-3">
                            {/* AI Screening & Recommendation Banner */}
                            <div className="p-3.5 rounded-xl bg-[color:var(--soft-surface)]/60 border border-[color:var(--border)] space-y-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-[color:var(--primary)]/15 text-[color:var(--primary)] shrink-0">
                                            <Sparkles className="w-4 h-4 stroke-[2]" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-[color:var(--text)] flex items-center gap-1.5 flex-wrap">
                                                <span>Ollama AI Resume & Eligibility Screening</span>
                                                {ollamaActive !== null && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--muted)]">
                                                        {ollamaActive ? '● Ollama Active' : '● Heuristic Mode'}
                                                    </span>
                                                )}
                                            </h4>
                                            <p className="text-[11px] text-[color:var(--muted)]">
                                                Ranks candidates against <strong>{committee.name}</strong> deliverables by combining questionnaire strengths and CV credentials.{' '}
                                                <Link
                                                    href="/eligibility-profile"
                                                    className="text-[color:var(--primary)] underline hover:no-underline font-medium"
                                                >
                                                    Update questionnaire &rarr;
                                                </Link>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleFetchRecommendations}
                                        disabled={isRecommending}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-semibold rounded-lg bg-[color:var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
                                    >
                                        <Sparkles className={`w-3.5 h-3.5 ${isRecommending ? 'animate-spin' : ''}`} />
                                        <span>{isRecommending ? 'Screening CVs...' : 'Rank by Suitability'}</span>
                                    </button>
                                </div>

                                {recommendationError && (
                                    <p className="text-[11px] text-[color:var(--status-danger-text)]">
                                        {recommendationError}
                                    </p>
                                )}

                                {recommendations && recommendations.length > 0 && (
                                    <div className="pt-2 border-t border-[color:var(--border)] flex items-center justify-between text-[11px]">
                                        <span className="text-[color:var(--text)] truncate">
                                            Top match: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{recommendations[0].name}</strong> ({recommendations[0].suitability_score}% Match)
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleSelectTopMatch}
                                            className="text-xs font-bold text-[color:var(--primary)] hover:underline cursor-pointer shrink-0 ml-2"
                                        >
                                            + Select Top Match
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Search input and Quick actions */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        placeholder="Search members by name or email..."
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        className="w-full pl-3 pr-8 py-1.5 text-xs bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/20 focus:border-[color:var(--primary)] transition-colors placeholder:text-[color:var(--muted)]"
                                    />
                                    {memberSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setMemberSearchQuery('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectAll(filteredEligibleMembers)}
                                        className="text-[color:var(--color-brand-action-orange)] hover:underline font-semibold cursor-pointer"
                                    >
                                        Select All ({filteredEligibleMembers.length})
                                    </button>
                                    {assignData.user_ids.length > 0 && (
                                        <>
                                            <span className="text-slate-300 dark:text-slate-600">|</span>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAll}
                                                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline cursor-pointer"
                                            >
                                                Deselect All
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Member List */}
                            <div className="max-h-80 overflow-y-auto divide-y divide-[color:var(--border)] border border-[color:var(--border)] rounded-xl">
                                {filteredEligibleMembers.map((member) => {
                                    const isSelected = assignData.user_ids.includes(member.id);
                                    const rec = recommendations?.find((r) => r.user_id === member.id);
                                    const hasResume = rec ? rec.has_resume : member.has_resume;
                                    const skills = rec?.extracted_skills || member.resume?.skills || [];
                                    const score = rec?.suitability_score;
                                    const status = rec?.eligibility_status || member.resume?.eligibility_status;

                                    return (
                                        <div
                                            key={member.id}
                                            onClick={() => toggleMemberSelection(member.id)}
                                            className={`p-3 flex flex-col gap-2 transition-colors cursor-pointer select-none ${isSelected ? 'bg-orange-50/50 dark:bg-orange-950/20' : 'bg-[color:var(--card)] hover:bg-[color:var(--soft-surface)]'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }} // parent onClick handles toggle
                                                        className="w-4 h-4 rounded text-[color:var(--primary)] border-[color:var(--border)] bg-[color:var(--card)] focus:ring-[color:var(--primary)]/20 cursor-pointer shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-xs font-semibold text-[color:var(--text)] truncate">
                                                                {member.name}
                                                            </p>
                                                            {score !== undefined && (
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${score >= 85
                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                                                    : score >= 75
                                                                        ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-300 dark:border-teal-800'
                                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                                                    }`}>
                                                                    {score}% Match • {status || 'Eligible'}
                                                                </span>
                                                            )}
                                                            {rec?.has_questionnaire && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                                                                    Questionnaire
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-[color:var(--muted)] truncate">
                                                            {member.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    {member.context && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                                                            <Info className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span>{member.context}</span>
                                                        </span>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleOpenUploadResume(member, e)}
                                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${hasResume
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                                            : 'bg-[color:var(--soft-surface)] text-[color:var(--muted)] border-[color:var(--border)] hover:border-[color:var(--primary)]/50'
                                                            }`}
                                                        title={hasResume ? 'Update candidate resume / CV' : 'Attach resume / CV for AI screening'}
                                                    >
                                                        <FileText className="w-3 h-3 shrink-0" />
                                                        <span>{hasResume ? 'CV Attached' : 'Attach CV'}</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Candidate Extracted Skills, Questionnaire Strengths & Justification */}
                                            {(skills.length > 0 || (rec?.top_strengths && rec.top_strengths.length > 0) || rec?.recommendation_reason) && (
                                                <div className="pl-7 pt-1 flex flex-col gap-1">
                                                    {skills.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <span className="text-[10px] text-[color:var(--muted)] font-medium">CV Skills:</span>
                                                            {skills.map((s, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-1.5 py-0.2 rounded text-[10px] bg-[color:var(--soft-surface)] text-[color:var(--text)] border border-[color:var(--border)]"
                                                                >
                                                                    {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {rec?.top_strengths && rec.top_strengths.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <span className="text-[10px] text-[color:var(--muted)] font-medium">Strengths:</span>
                                                            {rec.top_strengths.map((st, sIdx) => (
                                                                <span
                                                                    key={sIdx}
                                                                    className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                                                                >
                                                                    {st}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {rec?.recommendation_reason && (
                                                        <p className="text-[10px] text-[color:var(--muted)] italic">
                                                            "{rec.recommendation_reason}"
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {filteredEligibleMembers.length === 0 && (
                                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                                        No members match "{memberSearchQuery}".
                                    </div>
                                )}
                            </div>

                            <InputError message={assignErrors.user_id || assignErrors.user_ids} />
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>No Eligible Members Available</span>
                            </div>
                            <p className="leading-relaxed">
                                All Members in this event are already assigned to this committee, or no Members have been added to {project.title} yet.
                            </p>
                        </div>
                    )}

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-between gap-2.5">
                        <span className="text-xs text-[color:var(--muted)]">
                            {assignData.user_ids.length > 0
                                ? `${assignData.user_ids.length} member${assignData.user_ids.length === 1 ? '' : 's'} selected`
                                : 'No members selected'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAssignModalOpen(false)}
                                disabled={assignProcessing}
                            >
                                Cancel
                            </Button>
                            {eligibleMembers.length > 0 && (
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={assignProcessing}
                                    disabled={assignProcessing || assignData.user_ids.length === 0}
                                >
                                    {assignData.user_ids.length > 1
                                        ? `Assign (${assignData.user_ids.length}) Members`
                                        : 'Assign Member'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </Modal>

            {/* ── Upload & Scan Candidate Resume Modal ── */}
            <Modal
                isOpen={isResumeModalOpen}
                onClose={() => !resumeUploadProcessing && setIsResumeModalOpen(false)}
                title="Attach Candidate Resume / CV"
                description={`Upload resume or CV document for ${userForResume?.name ?? 'candidate'} for Ollama AI eligibility analysis.`}
                maxWidth="md"
            >
                <form onSubmit={handleUploadResumeSubmit} className="space-y-4 pt-1">
                    <div className="space-y-2">
                        <Label htmlFor="resume-file" required>
                            Select Resume / CV Document (PDF, Image, or Word)
                        </Label>
                        <input
                            id="resume-file"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                            className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[color:var(--color-brand-action-orange)] file:text-white hover:file:opacity-95 cursor-pointer border border-slate-300 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-[#14181F]"
                            required
                        />
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Supports PDF resumes or scanned image CVs (PNG/JPG). Ollama will extract skills, certifications, and evaluate role eligibility.
                        </p>
                    </div>

                    {resumeUploadError && (
                        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
                            {resumeUploadError}
                        </div>
                    )}

                    {resumeUploadSuccess && (
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{resumeUploadSuccess}</span>
                        </div>
                    )}

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsResumeModalOpen(false)}
                            disabled={resumeUploadProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={resumeUploadProcessing}
                            disabled={resumeUploadProcessing || !resumeFile}
                        >
                            <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                            <span>Upload & Scan with Ollama</span>
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Remove Member Confirmation Modal ── */}
            <Modal
                isOpen={isRemoveMemberModalOpen}
                onClose={handleCloseRemoveMemberModal}
                title="Remove Committee Member"
                description={`Remove ${memberToRemove?.name ?? 'member'} from ${committee.name}?`}
                maxWidth="md"
            >
                <div className="space-y-4 pt-1">
                    <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                        <div className="font-bold text-rose-900 dark:text-rose-200">
                            {memberToRemove?.name} ({memberToRemove?.email})
                        </div>
                        <p className="leading-relaxed">
                            This member will be removed from {committee.name}. If they belong to other committees in {project.title}, those assignments will remain intact.
                        </p>
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCloseRemoveMemberModal}
                            disabled={removeMemberProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleConfirmRemoveMember}
                            isLoading={removeMemberProcessing}
                            disabled={removeMemberProcessing}
                        >
                            Remove Member
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Staff Assignment Modal ── */}
            <Modal
                isOpen={isStaffModalOpen}
                onClose={handleCloseStaffModal}
                title={committee.head ? 'Change Chairperson' : 'Assign Chairperson'}
                description={`Designate an eligible Chairperson to oversee ${committee.name}.`}
                maxWidth="md"
            >
                <form onSubmit={handleAssignStaffSubmit} className="space-y-4 pt-1">
                    {committee.head && (
                        <div className="p-3 rounded-lg bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 text-xs text-orange-950 dark:text-orange-200 space-y-1">
                            <span className="font-bold text-[11px] uppercase tracking-wider text-[color:var(--color-brand-action-orange)]">
                                Current Chairperson
                            </span>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {committee.head.name} ({committee.head.email})
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Role: Chairperson
                            </div>
                        </div>
                    )}

                    {availableStaff.length > 0 ? (
                        <div className="space-y-2">
                            <Label htmlFor="assign-staff-select" required>
                                Select Chairperson
                            </Label>
                            <select
                                id="assign-staff-select"
                                value={staffData.user_id}
                                onChange={(e) => setStaffData('user_id', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                required
                            >
                                <option value="">-- Choose an eligible Chairperson --</option>
                                {availableStaff.map((staff) => {
                                    const isCurrent = staff.id === committee.head?.id;
                                    const otherCommittee = staff.committee_id && staff.committee_id !== committee.id ? staff.committee_name : null;
                                    let label = `${staff.name} (${staff.email})`;
                                    if (isCurrent) {
                                        label += ' — [Currently Assigned]';
                                    } else if (staff.is_event_co_chair) {
                                        label += otherCommittee ? ` — [Event Co-Chair • Assigned to ${otherCommittee}]` : ' — [Event Co-Chair]';
                                    } else if (otherCommittee) {
                                        label += ` — [Assigned to ${otherCommittee}]`;
                                    }
                                    return (
                                        <option key={staff.id} value={staff.id}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            <InputError message={staffErrors.user_id} />

                            {staffData.user_id && (() => {
                                const selectedStaff = availableStaff.find(s => String(s.id) === staffData.user_id);
                                if (selectedStaff?.committee_id && selectedStaff.committee_id !== committee.id) {
                                    return (
                                        <div className="p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                            <span>
                                                <strong>Notice:</strong> {selectedStaff.name} is currently assigned to <strong>{selectedStaff.committee_name}</strong>. Assigning them here will reassign them to this committee.
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>No Eligible Chairperson Available</span>
                            </div>
                            <p className="leading-relaxed">
                                There are currently no eligible Chairpersons available for assignment.
                            </p>
                        </div>
                    )}

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-between gap-2.5">
                        {committee.head ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setIsStaffModalOpen(false);
                                    setIsUnassignStaffModalOpen(true);
                                }}
                                disabled={staffProcessing}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                            >
                                Unassign Chairperson
                            </button>
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCloseStaffModal}
                                disabled={staffProcessing}
                            >
                                Cancel
                            </Button>
                            {availableStaff.length > 0 && (
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isLoading={staffProcessing}
                                    disabled={staffProcessing || !staffData.user_id || staffData.user_id === String(committee.head?.id)}
                                >
                                    {committee.head ? 'Update Chairperson' : 'Assign Chairperson'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </Modal>

            {/* ── Unassign Staff Confirmation Modal ── */}
            <Modal
                isOpen={isUnassignStaffModalOpen}
                onClose={() => !unassignProcessing && setIsUnassignStaffModalOpen(false)}
                title="Unassign Chairperson"
                description={`Remove Chairperson assignment from ${committee.name}?`}
                maxWidth="md"
            >
                <div className="space-y-4 pt-1">
                    <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                        {committee.head && (
                            <div className="font-bold text-amber-900 dark:text-amber-200">
                                {committee.head.name} ({committee.head.email})
                            </div>
                        )}
                        <p className="leading-relaxed">
                            This will unassign {committee.head?.name} as the committee chairperson. The committee will be left without a designated Chairperson supervisor until another chairperson is assigned.
                        </p>
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsUnassignStaffModalOpen(false)}
                            disabled={unassignProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleUnassignStaff}
                            isLoading={unassignProcessing}
                            disabled={unassignProcessing}
                        >
                            Unassign Chairperson
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Edit Committee Modal ── */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={handleCloseEditModal}
                title="Edit Committee"
                description="Update committee name, charter description, or designated Chairperson head."
                maxWidth="md"
            >
                <form onSubmit={handleEditCommitteeSubmit} className="space-y-4 pt-1">
                    <FormField
                        label="Committee Name"
                        id="edit-committee-name"
                        value={editData.name}
                        onChange={(e) => setEditData('name', e.target.value)}
                        error={editErrors.name}
                        required
                        maxLength={255}
                    />

                    <div className="space-y-1">
                        <Label htmlFor="edit-committee-description">Description</Label>
                        <textarea
                            id="edit-committee-description"
                            rows={3}
                            value={editData.description}
                            onChange={(e) => setEditData('description', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#14181F] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            placeholder="Functional scope of this committee..."
                        />
                        <InputError message={editErrors.description} />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="edit-committee-staff">
                            Committee Head (Chairperson - Optional)
                        </Label>
                        {staffOptions.length > 0 ? (
                            <select
                                id="edit-committee-staff"
                                value={editData.user_id}
                                onChange={(e) => setEditData('user_id', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#14181F] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                            >
                                <option value="">-- Unassigned (No Chairperson) --</option>
                                {staffOptions.map((staff) => (
                                    <option key={staff.id} value={staff.id}>
                                        {staff.name} ({staff.email})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="p-3 rounded-lg bg-[color:var(--soft-surface)] border border-[color:var(--border)] text-xs text-slate-500 dark:text-slate-400">
                                <p>No eligible Chairperson assigned to this event yet.</p>
                            </div>
                        )}
                        <InputError message={editErrors.user_id} />
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleCloseEditModal}
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

            {/* ── Delete Committee Confirmation Modal ── */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => !deleteProcessing && setIsDeleteModalOpen(false)}
                title="Remove Committee"
                description={`Are you sure you want to remove ${committee.name}?`}
                maxWidth="md"
            >
                <div className="space-y-4 pt-1">
                    <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                        <p className="font-bold text-rose-900 dark:text-rose-200">
                            This will remove the committee from {project.title}.
                        </p>
                        <p className="leading-relaxed">
                            Assigned Chairperson and Members will remain part of the event personnel, but will be unlinked from this committee.
                        </p>
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDeleteModalOpen(false)}
                            disabled={deleteProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleDeleteCommittee}
                            isLoading={deleteProcessing}
                            disabled={deleteProcessing}
                        >
                            Remove Committee
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Create Activity Modal ── */}
            <Modal
                isOpen={isCreateActivityModalOpen}
                onClose={() => !activityProcessing && setIsCreateActivityModalOpen(false)}
                title="Create Committee Deliverable"
                description={`Create a new deliverable under ${committee.name}.`}
                maxWidth="md"
            >
                <form onSubmit={handleCreateActivitySubmit} className="space-y-4 pt-1">
                    <FormField
                        label="Deliverable Title"
                        id="create-activity-title"
                        name="title"
                        value={activityData.title}
                        onChange={(e) => setActivityData('title', e.target.value)}
                        error={activityErrors.title}
                        required
                        placeholder="e.g., Program Flow and Speaker Management"
                        autoFocus
                    />

                    <div className="space-y-1">
                        <Label htmlFor="create-activity-description">Description (Optional)</Label>
                        <textarea
                            id="create-activity-description"
                            name="description"
                            rows={3}
                            value={activityData.description}
                            onChange={(e) => setActivityData('description', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#14181F] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            placeholder="Scope, deliverables, or objectives..."
                        />
                        <InputError message={activityErrors.description} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField
                            label="Start Date (Optional)"
                            id="create-activity-start-date"
                            type="date"
                            value={activityData.start_date}
                            onChange={(e) => setActivityData('start_date', e.target.value)}
                            error={activityErrors.start_date}
                        />
                        <FormField
                            label="Target Due Date (Optional)"
                            id="create-activity-due-date"
                            type="date"
                            value={activityData.due_date}
                            onChange={(e) => setActivityData('due_date', e.target.value)}
                            error={activityErrors.due_date}
                        />
                    </div>

                    <div className="pt-3 border-t border-[color:var(--border)] flex items-center justify-end gap-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateActivityModalOpen(false)}
                            disabled={activityProcessing}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={activityProcessing}
                            disabled={activityProcessing}
                        >
                            Create Deliverable
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── Manage Committee Co-Chairs Modal ── */}
            <Modal
                isOpen={isCoChairModalOpen}
                onClose={() => !coChairProcessing && setIsCoChairModalOpen(false)}
                title="Committee Co-Chair Designations"
                maxWidth="md"
            >
                <div className="space-y-5">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Designate committee members as Committee-level Co-Chairs to assist with coordinating tasks, managing deadlines, and preliminary evidence review.
                    </p>

                    {/* Current Co-Chairs */}
                    <div className="space-y-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Current Committee Co-Chairs ({(committee.coChairs || []).length})
                        </h4>
                        {(committee.coChairs || []).length === 0 ? (
                            <div className="p-3.5 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--soft-surface)] text-center text-xs text-slate-500 dark:text-slate-400">
                                No Committee Co-Chairs currently designated.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(committee.coChairs || []).map((cc) => (
                                    <div
                                        key={cc.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-xs"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-900 dark:text-slate-100">{cc.name}</span>
                                                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                                                    Committee Co-Chair
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{cc.email}</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={coChairProcessing}
                                            onClick={() => handleRemoveCoChair(cc.id)}
                                            className="text-rose-600 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Form to designate new Co-Chair */}
                    <div className="pt-4 border-t border-[color:var(--border)] space-y-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Designate New Committee Co-Chair
                        </h4>

                        {(committee.eligibleCoChairs || []).length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                No eligible members available to designate. All committee members are already designated as Co-Chairs.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label htmlFor="designate-comm-cochair-select">Select Committee Member</Label>
                                    <select
                                        id="designate-comm-cochair-select"
                                        value={selectedCoChairUserId}
                                        onChange={(e) => setSelectedCoChairUserId(e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--text)] rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer"
                                    >
                                        <option value="">-- Choose an existing committee member --</option>
                                        {(committee.eligibleCoChairs || []).map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name} ({m.email})
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
                                        type="button"
                                        variant="primary"
                                        disabled={!selectedCoChairUserId || coChairProcessing}
                                        isLoading={coChairProcessing}
                                        onClick={() => handleDesignateCoChair()}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        Designate as Co-Chair
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}
