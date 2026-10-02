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
} from 'lucide-react';

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
}

interface StaffItem {
    id: number;
    name: string;
    email: string;
    committee_id?: string | null;
    committee_name?: string | null;
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
    activities?: CommitteeActivityItem[];
    can: {
        update: boolean;
        delete: boolean;
        manageMembers: boolean;
        createActivity?: boolean;
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
                    <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-4">
                        <AlertTriangle className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-bold text-[color:var(--color-text-main)]">Committee Not Found</h2>
                    <p className="text-xs text-[color:var(--color-text-muted)] max-w-sm mt-2 mb-6 leading-relaxed">
                        This committee could not be found or you do not have permission to view it.
                    </p>
                    <Link
                        href={`/projects/${project?.id ?? ''}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors bg-[color:var(--color-brand-action-orange)]"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Project
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

    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [unassignProcessing, setUnassignProcessing] = useState(false);
    const [removeMemberProcessing, setRemoveMemberProcessing] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<MemberItem | null>(null);

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
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'In Progress':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'Under Review':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Returned':
            case 'Returned for Revision':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'To Do':
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
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
            title={committee.name}
            subtitle={`Committee within ${project.title}`}
            currentProject={{
                title: project.title,
                role: project.role ?? undefined,
                status: project.status,
            }}
        >
            <Head title={`${committee.name} — ${project.title} — ITASK`} />

            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                {/* ── Breadcrumb Navigation ── */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Link
                        href="/projects"
                        className="hover:text-[color:var(--color-brand-action-orange)] transition-colors"
                    >
                        Projects
                    </Link>
                    <span className="text-slate-300">/</span>
                    <Link
                        href={`/projects/${project.id}`}
                        className="hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate max-w-xs"
                    >
                        {project.title}
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="font-semibold text-slate-800 truncate max-w-xs">
                        {committee.name}
                    </span>
                </div>

                {/* ── Committee Header Area ── */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1.5">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                                {committee.name}
                            </h1>
                            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                {committee.head ? (
                                    <div className="flex items-center gap-1.5 font-medium text-slate-700">
                                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                            {getInitials(committee.head.name)}
                                        </span>
                                        <span>{committee.head.name}</span>
                                        <span className="text-slate-400 font-normal">(Staff)</span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 italic">No Staff Assigned</span>
                                )}
                                <span className="text-slate-300">•</span>
                                <span>{committee.members.length} member{committee.members.length === 1 ? '' : 's'}</span>
                                <span className="text-slate-300">•</span>
                                <span>{(committee.activities || []).length} activit{(committee.activities || []).length === 1 ? 'y' : 'ies'}</span>
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
                                    className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold shadow-2xs"
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
                                    + Add Activity
                                </Button>
                            )}

                            {/* 3-dots dropdown menu for Committee Options */}
                            {(committee.can.update || committee.can.delete) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                                            title="Committee Options"
                                        >
                                            <MoreHorizontal className="w-4 h-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 shadow-lg rounded-xl p-1 z-50">
                                        {committee.can.update && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={handleOpenEditModal}
                                                    className="cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg px-2.5 py-2 flex items-center gap-2"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>Edit Committee</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={handleOpenStaffModal}
                                                    className="cursor-pointer text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg px-2.5 py-2 flex items-center gap-2"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>{committee.head ? 'Change Project Staff' : 'Assign Project Staff'}</span>
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {committee.can.delete && (
                                            <>
                                                <DropdownMenuSeparator className="my-1 border-t border-slate-100" />
                                                <DropdownMenuItem
                                                    onClick={() => setIsDeleteModalOpen(true)}
                                                    className="cursor-pointer text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 py-2 flex items-center gap-2"
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
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-500">Committee Progress</span>
                            <span className="font-bold text-slate-700 tabular-nums">
                                {Math.round(committee.progress ?? 0)}%
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[color:var(--color-brand-action-orange)] transition-all duration-300"
                                style={{ width: `${Math.round(committee.progress ?? 0)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Two-Column Layout: Activities & Committee Members ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
                    {/* Left Column: Activities (~65-68%) */}
                    <div className="lg:col-span-8 space-y-4">
                        <h2 className="text-base font-bold text-slate-900">Activities</h2>

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
                                            className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-300 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <Link
                                                    href={`/projects/${project.id}/committees/${committee.id}/activities/${act.id}`}
                                                    className="font-bold text-slate-900 text-sm hover:text-[color:var(--color-brand-action-orange)] hover:underline transition-colors leading-snug"
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
                                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                                    {act.description}
                                                </p>
                                            )}

                                            {/* Progress bar and percentage */}
                                            <div className="mt-4 flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[color:var(--color-brand-action-orange)] transition-all duration-300"
                                                        style={{ width: `${Math.round(act.progress ?? 0)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                                                    {Math.round(act.progress ?? 0)}%
                                                </span>
                                            </div>

                                            {/* Footer info: Assigned, Tasks count, Due date */}
                                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                                <div className="flex items-center gap-2.5 flex-wrap">
                                                    <span>
                                                        <strong className="font-semibold text-slate-700">Assigned:</strong>{' '}
                                                        <span className="font-medium text-slate-800">{assignedName}</span>
                                                    </span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>
                                                        {act.completed_tasks_count}/{act.tasks_count} tasks done
                                                    </span>
                                                </div>
                                                <div className="text-slate-600 font-medium shrink-0">
                                                    {act.due_date ? `Due ${act.due_date}` : <span className="text-slate-400 italic font-normal">No deadline</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                                <ListTodo className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <h4 className="text-xs font-bold text-slate-800">No Activities Established Yet</h4>
                                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
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
                                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Add Activity</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Committee Members (~32-35%) */}
                    <div className="lg:col-span-4 space-y-4">
                        <h2 className="text-base font-bold text-slate-900">Committee Members</h2>

                        <div className="space-y-3">
                            {/* Project Staff (Head) Card */}
                            {committee.head && (
                                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-3.5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-300 transition-colors">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                                                {getInitials(committee.head.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-slate-900 truncate">
                                                        {committee.head.name}
                                                    </p>
                                                    {currentUserId && committee.head.id === currentUserId && (
                                                        <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-orange-100 text-[color:var(--color-brand-action-orange)] border border-orange-200">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-500">
                                                    Project Staff
                                                </p>
                                            </div>
                                        </div>

                                        {(committee.head.tasks_count !== undefined && committee.head.tasks_count > 0) && (
                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-bold text-slate-700 tabular-nums">
                                                    {committee.head.progress ?? 0}%
                                                </span>
                                                <p className="text-[10px] text-slate-400">
                                                    {committee.head.tasks_count} tasks
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {(committee.head.tasks_count !== undefined && committee.head.tasks_count > 0) && (
                                        <div className="mt-2.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-[color:var(--color-brand-action-orange)]"
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
                                    className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-3.5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] hover:border-slate-300 transition-colors group"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${getAvatarColor(member.name)}`}>
                                                {getInitials(member.name)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-slate-900 truncate">
                                                        {member.name}
                                                    </p>
                                                    {currentUserId && member.id === currentUserId && (
                                                        <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-500">
                                                    Project Member
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0 flex items-center gap-2">
                                            <div>
                                                <span className="text-xs font-bold text-slate-700 tabular-nums">
                                                    {member.progress ?? 0}%
                                                </span>
                                                <p className="text-[10px] text-slate-400">
                                                    {member.tasks_count ?? 0} task{(member.tasks_count ?? 0) === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                            {committee.can.manageMembers && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenRemoveMemberModal(member)}
                                                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 transition-opacity p-0.5 rounded cursor-pointer"
                                                    title={`Remove ${member.name} from committee`}
                                                    aria-label={`Remove ${member.name} from committee`}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-2.5 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-[color:var(--color-brand-action-orange)] transition-all duration-300"
                                            style={{ width: `${member.progress ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {committee.members.length === 0 && !committee.head && (
                                <div className="py-8 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                                    <Users className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                                    <h4 className="text-xs font-bold text-slate-800">No Members Assigned</h4>
                                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 leading-relaxed">
                                        No personnel have been assigned to this committee yet.
                                    </p>
                                    {committee.can.manageMembers && (
                                        <button
                                            type="button"
                                            onClick={handleOpenAssignModal}
                                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
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

                {/* ── Assign Member Modal ── */}
                <Modal
                    isOpen={isAssignModalOpen}
                    onClose={() => !assignProcessing && setIsAssignModalOpen(false)}
                    title="Assign Project Members"
                    description={`Select eligible Project Members from ${project.title} to assign to ${committee.name}.`}
                    maxWidth="lg"
                >
                    <form onSubmit={handleAssignMemberSubmit} className="space-y-4 pt-1">
                        {eligibleMembers.length > 0 ? (
                            <div className="space-y-3">
                                {/* Search input and Quick actions */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search members by name or email..."
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            className="w-full pl-3 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors"
                                        />
                                        {memberSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setMemberSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={handleDeselectAll}
                                                    className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                                                >
                                                    Deselect All
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Member List */}
                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                                    {filteredEligibleMembers.map((member) => {
                                        const isSelected = assignData.user_ids.includes(member.id);
                                        return (
                                            <div
                                                key={member.id}
                                                onClick={() => toggleMemberSelection(member.id)}
                                                className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer select-none ${
                                                    isSelected ? 'bg-orange-50/50' : 'bg-white hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}} // parent onClick handles toggle
                                                        className="w-4 h-4 rounded text-[color:var(--color-brand-action-orange)] border-slate-300 focus:ring-orange-500/20 cursor-pointer shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-[color:var(--color-text-main)] truncate">
                                                            {member.name}
                                                        </p>
                                                        <p className="text-[11px] text-[color:var(--color-text-muted)] truncate">
                                                            {member.email}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Contextual indicator for multi-committee */}
                                                {member.context && (
                                                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                        <Info className="w-3 h-3 text-amber-600 shrink-0" />
                                                        <span>{member.context}</span>
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {filteredEligibleMembers.length === 0 && (
                                        <div className="p-6 text-center text-xs text-slate-500">
                                            No members match "{memberSearchQuery}".
                                        </div>
                                    )}
                                </div>

                                <InputError message={assignErrors.user_id || assignErrors.user_ids} />
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>No Eligible Members Available</span>
                                </div>
                                <p className="leading-relaxed">
                                    All Project Members in this project are already assigned to this committee, or no Project Members have been added to {project.title} yet.
                                </p>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
                            <span className="text-xs text-slate-500">
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

                {/* ── Remove Member Confirmation Modal ── */}
                <Modal
                    isOpen={isRemoveMemberModalOpen}
                    onClose={handleCloseRemoveMemberModal}
                    title="Remove Committee Member"
                    description={`Remove ${memberToRemove?.name ?? 'member'} from ${committee.name}?`}
                    maxWidth="md"
                >
                    <div className="space-y-4 pt-1">
                        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-2">
                            <div className="font-bold text-rose-900">
                                {memberToRemove?.name} ({memberToRemove?.email})
                            </div>
                            <p className="leading-relaxed">
                                This member will be removed from {committee.name}. If they belong to other committees in {project.title}, those assignments will remain intact.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                    title={committee.head ? 'Change Project Staff' : 'Assign Project Staff'}
                    description={`Designate an eligible Project Staff member to oversee ${committee.name}.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleAssignStaffSubmit} className="space-y-4 pt-1">
                        {committee.head && (
                            <div className="p-3 rounded-lg bg-orange-50/70 border border-orange-200 text-xs text-orange-950 space-y-1">
                                <span className="font-bold text-[11px] uppercase tracking-wider text-[color:var(--color-brand-action-orange)]">
                                    Current Project Staff
                                </span>
                                <div className="font-semibold text-slate-900">
                                    {committee.head.name} ({committee.head.email})
                                </div>
                                <div className="text-[11px] text-slate-600">
                                    Role: Project Staff
                                </div>
                            </div>
                        )}

                        {availableStaff.length > 0 ? (
                            <div className="space-y-2">
                                <Label htmlFor="assign-staff-select" required>
                                    Select Project Staff
                                </Label>
                                <select
                                    id="assign-staff-select"
                                    value={staffData.user_id}
                                    onChange={(e) => setStaffData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                    required
                                >
                                    <option value="">-- Choose an eligible Project Staff member --</option>
                                    {availableStaff.map((staff) => {
                                        const isCurrent = staff.id === committee.head?.id;
                                        const otherCommittee = staff.committee_id && staff.committee_id !== committee.id ? staff.committee_name : null;
                                        let label = `${staff.name} (${staff.email})`;
                                        if (isCurrent) {
                                            label += ' — [Currently Assigned]';
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
                                            <div className="p-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-start gap-2">
                                                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
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
                            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                    <span>No Eligible Project Staff Available</span>
                                </div>
                                <p className="leading-relaxed">
                                    There are currently no eligible Project Staff members available for assignment.
                                </p>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2.5">
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
                                    Unassign Project Staff
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
                                        {committee.head ? 'Update Staff' : 'Assign Staff'}
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
                    title="Unassign Project Staff"
                    description={`Remove Project Staff assignment from ${committee.name}?`}
                    maxWidth="md"
                >
                    <div className="space-y-4 pt-1">
                        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                            {committee.head && (
                                <div className="font-bold text-amber-900">
                                    {committee.head.name} ({committee.head.email})
                                </div>
                            )}
                            <p className="leading-relaxed">
                                This will unassign {committee.head?.name} as the committee staff member. They will remain a Project Staff member on {project.title}. The committee will be left without a designated Project Staff supervisor until another staff member is assigned.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                                Unassign Staff
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* ── Edit Committee Modal ── */}
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    title="Edit Committee"
                    description="Update committee name, charter description, or designated Project Staff head."
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
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Functional scope of this committee..."
                            />
                            <InputError message={editErrors.description} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-committee-staff">
                                Committee Head (Project Staff - Optional)
                            </Label>
                            {staffOptions.length > 0 ? (
                                <select
                                    id="edit-committee-staff"
                                    value={editData.user_id}
                                    onChange={(e) => setEditData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="">-- Unassigned (No Staff Head) --</option>
                                    {staffOptions.map((staff) => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} ({staff.email})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                                    <p>No Project Staff assigned to this project yet.</p>
                                </div>
                            )}
                            <InputError message={editErrors.user_id} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                            <p className="font-bold text-rose-900">
                                This will remove the committee from {project.title}.
                            </p>
                            <p className="leading-relaxed">
                                Assigned Project Staff and Project Members will remain part of the project personnel, but will be unlinked from this committee.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                    title="Create Committee Activity"
                    description={`Create a new activity deliverable under ${committee.name}.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleCreateActivitySubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Activity Title"
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
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
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

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
                                Create Activity
                            </Button>
                        </div>
                    </form>
                </Modal>
            </div>
        </AppLayout>
    );
}
