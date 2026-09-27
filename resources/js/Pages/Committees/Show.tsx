import React, { useState } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
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
    ListTodo,
    Calendar,
} from 'lucide-react';

interface MemberItem {
    id: number;
    name: string;
    email: string;
    assigned_at?: string;
}

interface StaffItem {
    id: number;
    name: string;
    email: string;
}

export interface CommitteeActivityItem {
    id: string;
    title: string;
    description: string | null;
    status: string;
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
    // Modal states
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isCreateActivityModalOpen, setIsCreateActivityModalOpen] = useState(false);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

    // Assign Member form
    const {
        data: assignData,
        setData: setAssignData,
        post: submitAssignMember,
        processing: assignProcessing,
        errors: assignErrors,
        reset: resetAssign,
        clearErrors: clearAssignErrors,
    } = useForm({
        user_id: '',
    });

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

    const handleOpenAssignModal = () => {
        resetAssign();
        clearAssignErrors();
        setIsAssignModalOpen(true);
    };

    const handleAssignMemberSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitAssignMember(
            `/projects/${project.id}/committees/${committee.id}/members`,
            {
                onSuccess: () => {
                    setIsAssignModalOpen(false);
                    resetAssign();
                },
            }
        );
    };

    const handleRemoveMember = (member: MemberItem) => {
        if (confirm(`Remove ${member.name} from ${committee.name}?`)) {
            setRemovingMemberId(member.id);
            router.delete(
                `/projects/${project.id}/committees/${committee.id}/members/${member.id}`,
                {
                    onFinish: () => setRemovingMemberId(null),
                }
            );
        }
    };

    const handleOpenEditModal = () => {
        setEditData({
            name: committee.name,
            description: committee.description ?? '',
            user_id: committee.head?.id ? String(committee.head.id) : '',
        });
        clearEditErrors();
        setIsEditModalOpen(true);
    };

    const handleEditCommitteeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitEditCommittee(
            `/projects/${project.id}/committees/${committee.id}`,
            {
                onSuccess: () => {
                    setIsEditModalOpen(false);
                },
            }
        );
    };

    const handleDeleteCommittee = () => {
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
            case 'Returned for Revision':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'To Do':
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <AppLayout
            title={committee.name}
            subtitle={`Committee within ${project.title}`}
            currentProject={{
                title: project.title,
                role: 'Project Leader',
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
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-[color:var(--color-brand-dark-green)] border-emerald-200">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Committee Workspace</span>
                                </span>
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
                        </div>

                        {/* Action buttons (Project Leader only) */}
                        {committee.can.update && (
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleOpenEditModal}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[color:var(--color-text-main)] bg-[color:var(--color-surface-subtle)] border border-[color:var(--color-border-light)] hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Edit Committee</span>
                                </button>

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
                        )}
                    </div>
                </div>

                {/* ── Two Columns: Committee Head & Member Roster ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Committee Head (Project Staff) */}
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-5 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                            <h3 className="text-sm font-bold text-[color:var(--color-text-main)] mb-3">
                                Committee Leadership
                            </h3>

                            {committee.head ? (
                                <div className="p-4 rounded-xl border border-orange-200 bg-[color:var(--color-brand-active-warm-orange)]/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-[color:var(--color-brand-action-orange)] border border-orange-200">
                                            <Shield className="w-3 h-3" />
                                            <span>Project Staff · Head</span>
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[color:var(--color-text-main)]">
                                            {committee.head.name}
                                        </p>
                                        <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                            {committee.head.email}
                                        </p>
                                    </div>
                                    <p className="text-[11px] text-slate-500 pt-1 border-t border-orange-200/60 leading-relaxed">
                                        Designated staff head responsible for supervising deliverables and activity reviews for this committee.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                                    <p className="text-xs font-semibold text-slate-800">
                                        No Committee Head Designated
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        A Project Staff member must be assigned to head this committee.
                                    </p>
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
                                        Assigned Project Members ({committee.members.length})
                                    </h3>
                                    <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                        Working members assigned to perform future committee activities and tasks
                                    </p>
                                </div>

                                {committee.can.manageMembers && (
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={handleOpenAssignModal}
                                    >
                                        <UserPlus className="w-3.5 h-3.5" />
                                        <span>+ Assign Member</span>
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
                                                    <p className="text-xs font-bold text-[color:var(--color-text-main)]">
                                                        {member.name}
                                                    </p>
                                                    <p className="text-[11px] text-[color:var(--color-text-muted)]">
                                                        {member.email}
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
                                                        onClick={() => handleRemoveMember(member)}
                                                        disabled={removingMemberId === member.id}
                                                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Remove from committee"
                                                        aria-label="Remove from committee"
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
                                        No Project Members Assigned Yet
                                    </h4>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                                        Assign Project Members from the project personnel pool to begin staffing this committee.
                                    </p>
                                    {committee.can.manageMembers && (
                                        <button
                                            type="button"
                                            onClick={handleOpenAssignModal}
                                            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>Assign First Member</span>
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
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>
                                                {act.tasks_count} tasks ({act.completed_tasks_count} done)
                                            </span>
                                            {act.due_date && <span>Due: {act.due_date}</span>}
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
                    title="Assign Project Member"
                    description={`Select a Project Member from ${project.title} to assign to ${committee.name}.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleAssignMemberSubmit} className="space-y-4 pt-1">
                        {availableMembers.length > 0 ? (
                            <div className="space-y-1.5">
                                <Label htmlFor="assign-member-select" required>
                                    Select Member
                                </Label>
                                <select
                                    id="assign-member-select"
                                    value={assignData.user_id}
                                    onChange={(e) => setAssignData('user_id', e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                    required
                                >
                                    <option value="">-- Choose an eligible Project Member --</option>
                                    {availableMembers.map((member) => (
                                        <option key={member.id} value={member.id}>
                                            {member.name} ({member.email})
                                        </option>
                                    ))}
                                </select>
                                <InputError message={assignErrors.user_id} />
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                    <Info className="w-4 h-4 text-amber-600" />
                                    <span>No Available Members</span>
                                </div>
                                <p className="leading-relaxed">
                                    All existing Project Members in this project are already assigned to this committee, or no Project Members have been added to the project yet.
                                </p>
                            </div>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsAssignModalOpen(false)}
                                disabled={assignProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={assignProcessing}
                                disabled={assignProcessing || availableMembers.length === 0}
                            >
                                Assign Member
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Edit Committee Modal ── */}
                <Modal
                    isOpen={isEditModalOpen}
                    onClose={() => !editProcessing && setIsEditModalOpen(false)}
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
                            <Label htmlFor="edit-committee-staff" required>
                                Committee Head (Project Staff)
                            </Label>
                            <select
                                id="edit-committee-staff"
                                value={editData.user_id}
                                onChange={(e) => setEditData('user_id', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                required
                            >
                                <option value="">-- Select Project Staff --</option>
                                {availableStaff.map((staff) => (
                                    <option key={staff.id} value={staff.id}>
                                        {staff.name} ({staff.email})
                                    </option>
                                ))}
                            </select>
                            <InputError message={editErrors.user_id} />
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

                        <FormField
                            label="Target Due Date (Optional)"
                            id="create-activity-due-date"
                            type="date"
                            value={activityData.due_date}
                            onChange={(e) => setActivityData('due_date', e.target.value)}
                            error={activityErrors.due_date}
                        />

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
