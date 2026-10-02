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
} from 'lucide-react';

interface MemberItem {
    id: number;
    name: string;
    email: string;
    assigned_at?: string;
    context?: string | null;
    other_committees_count?: number;
}

interface StaffItem {
    id: number;
    name: string;
    email: string;
    committee_id?: string | null;
    committee_name?: string | null;
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

    const activitiesAwaitingReview = (committee.activities || []).filter(
        (act) => act.status === 'Under Review'
    );
    const returnedActivities = (committee.activities || []).filter(
        (act) => act.status === 'Returned' || act.status === 'Returned for Revision'
    );

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

            <div className="space-y-6">
                {/* ── Breadcrumb & Back Navigation ── */}
                <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                    <Link
                        href="/projects"
                        className="inline-flex items-center gap-1 font-medium hover:text-[color:var(--color-brand-action-orange)] transition-colors"
                    >
                        <span>Projects</span>
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    <Link
                        href={`/projects/${project.id}`}
                        className="inline-flex items-center gap-1 font-medium hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate max-w-xs"
                    >
                        <span>{project.title}</span>
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="font-semibold text-[color:var(--color-text-main)] truncate max-w-xs">
                        {committee.name}
                    </span>
                </div>

                {/* ── Committee Header Card ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 sm:p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="space-y-2 max-w-2xl">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-[color:var(--color-brand-dark-green)] border-emerald-200">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Committee Workspace</span>
                                </span>
                                <ProjectRoleBadge role={project.role} />
                                <Link
                                    href={`/projects/${project.id}`}
                                    className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand-action-orange)] flex items-center gap-1 font-medium"
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Parent: {project.title}</span>
                                </Link>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--color-text-main)]">
                                {committee.name}
                            </h1>

                            <p className="text-xs sm:text-sm text-[color:var(--color-text-muted)] leading-relaxed">
                                {committee.description || 'No committee description provided.'}
                            </p>

                            {committee.progress !== undefined && (
                                <div className="pt-2 flex items-center gap-3">
                                    <div className="w-36 sm:w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-300 bg-[color:var(--color-brand-dark-green)]"
                                            style={{ width: `${Math.round(committee.progress)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-[color:var(--color-brand-dark-green)]">
                                        {Math.round(committee.progress)}% Complete
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Link
                                href={`/projects/${project.id}/timeline`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
                            >
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span>View in Timeline</span>
                            </Link>

                            {committee.can.update && (
                                <button
                                    type="button"
                                    onClick={handleOpenEditModal}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Edit Committee</span>
                                </button>
                            )}

                            {committee.can.delete && (
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Remove Committee</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Two Columns: Committee Head & Member Roster ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Committee Head (Project Staff) */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                    Project Staff
                                </h3>
                                {committee.head ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Assigned
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                        Unassigned
                                    </span>
                                )}
                            </div>

                            {committee.head ? (
                                <div className="p-4 rounded-xl border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)]/40 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-[color:var(--color-brand-action-orange)] border border-orange-200">
                                            <Shield className="w-3 h-3" />
                                            <span>Project Staff</span>
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-bold text-[color:var(--color-text-main)]">
                                                {committee.head.name}
                                            </p>
                                            {currentUserId && committee.head.id === currentUserId && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-[color:var(--color-brand-action-orange)] border border-orange-200">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                            {committee.head.email}
                                        </p>
                                    </div>
                                    <div className="text-[11px] text-slate-500 pt-2 border-t border-orange-200/60 space-y-1">
                                        <p className="font-medium text-slate-700">
                                            Supervises deliverables and review workflow for this committee.
                                        </p>
                                    </div>

                                    {committee.can.update && (
                                        <div className="pt-2 border-t border-orange-200/60 flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleOpenStaffModal}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-brand-action-orange)] bg-white border border-orange-200 hover:bg-orange-50 transition-colors cursor-pointer shadow-xs"
                                                title="Change Assigned Project Staff"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                                <span>Change Project Staff</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsUnassignStaffModalOpen(true)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer shadow-xs"
                                                title="Unassign Project Staff"
                                            >
                                                <UserMinus className="w-3 h-3" />
                                                <span>Unassign</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-2.5">
                                    <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">
                                            No Project Staff Assigned
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            This committee currently has no designated Project Staff member.
                                        </p>
                                    </div>
                                    {committee.can.update && (
                                        <div className="pt-1">
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                onClick={handleOpenStaffModal}
                                                leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                                            >
                                                + Assign Project Staff
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Stats Box */}
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                                Committee Overview
                            </h4>
                            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                                <span className="text-[color:var(--color-text-muted)]">Total Members</span>
                                <span className="font-bold text-[color:var(--color-text-main)]">
                                    {committee.members.length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                                <span className="text-[color:var(--color-text-muted)]">Activities</span>
                                <span className="font-bold text-[color:var(--color-text-main)]">
                                    {committee.activities?.length ?? 0}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                                <span className="text-[color:var(--color-text-muted)]">Parent Project</span>
                                <span className="font-semibold text-[color:var(--color-text-main)] truncate max-w-[140px]">
                                    {project.title}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Committee Members Roster (2 cols) */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                        Committee Members ({committee.members.length})
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Working members assigned to perform committee activities and tasks
                                    </p>
                                </div>

                                {committee.can.manageMembers && (
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={handleOpenAssignModal}
                                        leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                                    >
                                        + Assign Project Members
                                    </Button>
                                )}
                            </div>

                            {committee.members.length > 0 ? (
                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                                    {committee.members.map((member) => (
                                        <div
                                            key={member.id}
                                            className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                                    {member.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="text-xs font-bold text-[color:var(--color-text-main)]">
                                                            {member.name}
                                                        </p>
                                                        {currentUserId && member.id === currentUserId && (
                                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                You
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] text-[color:var(--color-text-muted)]">
                                                        {member.email}
                                                        {member.assigned_at && (
                                                            <span className="text-[color:var(--color-text-subtle)]"> · Assigned {member.assigned_at}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                                    <UserCheck className="w-3 h-3 text-slate-500" />
                                                    <span>Project Member</span>
                                                </span>

                                                {committee.can.manageMembers && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenRemoveMemberModal(member)}
                                                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Remove from committee"
                                                        aria-label={`Remove ${member.name} from committee`}
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                                    <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <h4 className="text-xs font-bold text-slate-800">
                                        No Committee Members Assigned
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                                        {committee.can.manageMembers
                                            ? 'Assign Project Members from the project personnel pool to begin staffing this committee.'
                                            : 'No Project Members have been assigned to this committee yet.'}
                                    </p>
                                    {committee.can.manageMembers && (
                                        <button
                                            type="button"
                                            onClick={handleOpenAssignModal}
                                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>Assign Member</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Committee Activities Section ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                Committee Activities ({committee.activities?.length ?? 0})
                            </h3>
                            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                Functional milestones and deliverables supervised by the committee head
                            </p>
                        </div>
                        {committee.can?.createActivity && (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    resetActivityForm();
                                    clearActivityErrors();
                                    setIsCreateActivityModalOpen(true);
                                }}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Create Activity</span>
                            </Button>
                        )}
                    </div>

                    {/* ── Staff Review Queue (Activities Awaiting Staff Review) ── */}
                    {activitiesAwaitingReview.length > 0 && (
                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                    <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                                        Review Queue · Activities Awaiting Staff Review ({activitiesAwaitingReview.length})
                                    </h4>
                                </div>
                                <span className="text-[11px] font-medium text-amber-800">
                                    Action required: Committee head verification
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {activitiesAwaitingReview.map((act) => (
                                    <div
                                        key={act.id}
                                        className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs flex flex-col justify-between space-y-2.5"
                                    >
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-900 truncate">
                                                    {act.title}
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 shrink-0">
                                                    Under Review
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                                <span>{act.completed_tasks_count} / {act.tasks_count} tasks done</span>
                                                {act.due_date && <span>Due: {act.due_date}</span>}
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                                            <Link
                                                href={`/projects/${project.id}/committees/${committee.id}/activities/${act.id}`}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-90 rounded-md transition-opacity"
                                            >
                                                <span>Review Activity</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Returned Activities Notice */}
                    {returnedActivities.length > 0 && (
                        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/70 flex items-center justify-between text-xs text-rose-800">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>
                                    <strong>Revision in Progress:</strong> {returnedActivities.length} {returnedActivities.length === 1 ? 'activity has' : 'activities have'} been returned for revision and {returnedActivities.length === 1 ? 'is' : 'are'} being updated by committee members.
                                </span>
                            </div>
                        </div>
                    )}

                    {(committee.activities && committee.activities.length > 0) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {committee.activities.map((act) => (
                                <div
                                    key={act.id}
                                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs flex flex-col justify-between space-y-3"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                Activity
                                            </span>
                                            <span
                                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getActivityStatusBadge(
                                                    act.status
                                                )}`}
                                            >
                                                {act.status}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                                            {act.title}
                                        </h4>
                                        {act.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2">
                                                {act.description}
                                            </p>
                                        )}
                                        {act.progress !== undefined && (
                                            <div className="w-full space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-500 font-medium">Progress</span>
                                                    <span className="font-bold text-[color:var(--color-brand-dark-green)]">{Math.round(act.progress)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[color:var(--color-brand-dark-green)] transition-all duration-300"
                                                        style={{ width: `${Math.round(act.progress)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                                            <span>
                                                {act.tasks_count} tasks ({act.completed_tasks_count} done)
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {act.start_date && <span>Start: {act.start_date}</span>}
                                                {act.due_date && <span>Due: {act.due_date}</span>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100">
                                        <Link
                                            href={`/projects/${project.id}/committees/${committee.id}/activities/${act.id}`}
                                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                                        >
                                            <span>View Tasks & Details</span>
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
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
                                    <span>Create First Activity</span>
                                </button>
                            )}
                        </div>
                    )}
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
