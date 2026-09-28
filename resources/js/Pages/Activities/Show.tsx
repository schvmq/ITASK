import React, { useState } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { AppLayout } from '@/Layouts/AppLayout';
import { Modal } from '@/Components/Modal';
import { FormField } from '@/Components/FormField';
import { Label } from '@/Components/Label';
import { InputError } from '@/Components/InputError';
import { Button } from '@/Components/Button';
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock,
    Edit3,
    Layers,
    ListTodo,
    Plus,
    Send,
    Shield,
    Trash2,
    User,
    AlertTriangle,
    RotateCcw,
} from 'lucide-react';

interface AssigneeItem {
    id: number;
    name: string;
    email: string;
}

export interface TaskItem {
    id: string;
    title: string;
    description: string | null;
    status: 'To Do' | 'In Progress' | 'Completed';
    due_date: string | null;
    due_date_raw: string | null;
    assignee: AssigneeItem | null;
    is_assigned_to_me?: boolean;
    can: {
        update: boolean;
        delete: boolean;
        updateStatus?: boolean;
    };
}

export interface ActivityData {
    id: string;
    title: string;
    description: string | null;
    status: 'To Do' | 'In Progress' | 'Under Review' | 'Completed' | 'Returned for Revision';
    due_date: string | null;
    due_date_raw: string | null;
    submission_notes?: string | null;
    review_feedback?: string | null;
    reviewed_at?: string | null;
    reviewed_at_raw?: string | null;
    created_at: string | null;
    creator: {
        id: number;
        name: string;
        email: string;
    } | null;
    reviewer?: {
        id: number;
        name: string;
        email: string;
    } | null;
    can: {
        update: boolean;
        delete: boolean;
        createTask: boolean;
        submit?: boolean;
        review?: boolean;
    };
    tasks: TaskItem[];
}

export interface EligibleAssignee {
    id: number;
    name: string;
    email: string;
    role: string;
}

export interface ActivityShowProps {
    project: {
        id: string;
        title: string;
        status: string;
    };
    committee: {
        id: string;
        name: string;
        head: AssigneeItem | null;
    };
    activity: ActivityData;
    eligibleAssignees: EligibleAssignee[];
}

export default function ActivityShow({
    project,
    committee,
    activity,
    eligibleAssignees = [],
}: ActivityShowProps) {
    // Modals state
    const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
    const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null);
    const [isEditActivityModalOpen, setIsEditActivityModalOpen] = useState(false);
    const [isDeleteActivityModalOpen, setIsDeleteActivityModalOpen] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isReviewCompleteModalOpen, setIsReviewCompleteModalOpen] = useState(false);
    const [isReviewReturnModalOpen, setIsReviewReturnModalOpen] = useState(false);
    const [actionProcessing, setActionProcessing] = useState(false);
    const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null);

    // Create Task Form
    const {
        data: taskData,
        setData: setTaskData,
        post: submitCreateTask,
        processing: taskProcessing,
        errors: taskErrors,
        reset: resetTaskForm,
        clearErrors: clearTaskErrors,
    } = useForm({
        title: '',
        description: '',
        due_date: '',
        status: 'To Do' as 'To Do' | 'In Progress' | 'Completed',
        assigned_to: '',
    });

    // Edit Task Form
    const {
        data: editTaskData,
        setData: setEditTaskData,
        patch: submitEditTask,
        processing: editTaskProcessing,
        errors: editTaskErrors,
        clearErrors: clearEditTaskErrors,
    } = useForm({
        title: '',
        description: '',
        due_date: '',
        status: 'To Do' as 'To Do' | 'In Progress' | 'Completed',
        assigned_to: '',
    });

    // Edit Activity Form
    const {
        data: editActivityData,
        setData: setEditActivityData,
        patch: submitEditActivity,
        processing: editActivityProcessing,
        errors: editActivityErrors,
        clearErrors: clearEditActivityErrors,
    } = useForm({
        title: activity.title,
        description: activity.description ?? '',
        due_date: activity.due_date_raw ?? '',
        status: activity.status,
    });

    // Submit Activity Form
    const {
        data: submitData,
        setData: setSubmitData,
        post: postSubmitActivity,
        processing: submitProcessing,
        errors: submitErrors,
        clearErrors: clearSubmitErrors,
    } = useForm({
        submission_notes: activity.submission_notes ?? '',
    });

    // Review Activity Form
    const {
        data: reviewData,
        setData: setReviewData,
        post: postReviewActivity,
        processing: reviewProcessing,
        errors: reviewErrors,
        reset: resetReviewForm,
        clearErrors: clearReviewErrors,
    } = useForm({
        action: 'complete' as 'complete' | 'return_for_revision',
        review_feedback: '',
    });

    const handleOpenCreateTask = () => {
        resetTaskForm();
        clearTaskErrors();
        setIsCreateTaskModalOpen(true);
    };

    const handleCreateTaskSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitCreateTask(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks`,
            {
                onSuccess: () => {
                    setIsCreateTaskModalOpen(false);
                    resetTaskForm();
                },
            }
        );
    };

    const handleOpenEditTask = (task: TaskItem) => {
        clearEditTaskErrors();
        setEditingTask(task);
        setEditTaskData({
            title: task.title,
            description: task.description ?? '',
            due_date: task.due_date_raw ?? '',
            status: task.status,
            assigned_to: task.assignee ? String(task.assignee.id) : '',
        });
    };

    const handleEditTaskSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;

        submitEditTask(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${editingTask.id}`,
            {
                onSuccess: () => {
                    setEditingTask(null);
                },
            }
        );
    };

    const handleDeleteTaskConfirm = () => {
        if (!deletingTask) return;

        setActionProcessing(true);
        router.delete(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${deletingTask.id}`,
            {
                onFinish: () => setActionProcessing(false),
                onSuccess: () => {
                    setDeletingTask(null);
                },
            }
        );
    };

    const handleTaskStatusChange = (task: TaskItem, newStatus: TaskItem['status']) => {
        if (task.status === newStatus) return;

        setStatusUpdatingTaskId(task.id);
        router.patch(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}`,
            { status: newStatus },
            {
                preserveScroll: true,
                onFinish: () => setStatusUpdatingTaskId(null),
            }
        );
    };

    const handleOpenEditActivity = () => {
        clearEditActivityErrors();
        setEditActivityData({
            title: activity.title,
            description: activity.description ?? '',
            due_date: activity.due_date_raw ?? '',
            status: activity.status,
        });
        setIsEditActivityModalOpen(true);
    };

    const handleEditActivitySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitEditActivity(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`,
            {
                onSuccess: () => {
                    setIsEditActivityModalOpen(false);
                },
            }
        );
    };

    const handleDeleteActivityConfirm = () => {
        setActionProcessing(true);
        router.delete(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}`,
            {
                onFinish: () => setActionProcessing(false),
                onSuccess: () => {
                    setIsDeleteActivityModalOpen(false);
                },
            }
        );
    };

    const handleOpenSubmitModal = () => {
        setSubmitData('submission_notes', activity.submission_notes ?? '');
        clearSubmitErrors();
        setIsSubmitModalOpen(true);
    };

    const handleSubmitActivity = (e: React.FormEvent) => {
        e.preventDefault();
        postSubmitActivity(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/submit`,
            {
                onSuccess: () => {
                    setIsSubmitModalOpen(false);
                },
            }
        );
    };

    const handleOpenReviewCompleteModal = () => {
        clearReviewErrors();
        setReviewData({
            action: 'complete',
            review_feedback: '',
        });
        setIsReviewCompleteModalOpen(true);
    };

    const handleOpenReviewReturnModal = () => {
        clearReviewErrors();
        setReviewData({
            action: 'return_for_revision',
            review_feedback: '',
        });
        setIsReviewReturnModalOpen(true);
    };

    const handleReviewSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        postReviewActivity(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/review`,
            {
                onSuccess: () => {
                    setIsReviewCompleteModalOpen(false);
                    setIsReviewReturnModalOpen(false);
                    resetReviewForm();
                },
            }
        );
    };

    const getActivityStatusBadge = (status: ActivityData['status']) => {
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

    const getTaskStatusBadge = (status: TaskItem['status']) => {
        switch (status) {
            case 'Completed':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'In Progress':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'To Do':
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const completedTasksCount = activity.tasks.filter((t) => t.status === 'Completed').length;
    const taskProgressPercent =
        activity.tasks.length > 0 ? Math.round((completedTasksCount / activity.tasks.length) * 100) : 0;

    return (
        <AppLayout>
            <Head title={`${activity.title} — ${committee.name}`} />

            <div className="max-w-6xl mx-auto space-y-6">
                {/* ── Breadcrumb Navigation ── */}
                <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-subtle)] flex-wrap">
                    <Link
                        href="/projects"
                        className="hover:text-[color:var(--color-brand-action-orange)] transition-colors"
                    >
                        Projects
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <Link
                        href={`/projects/${project.id}`}
                        className="hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate max-w-[180px]"
                    >
                        {project.title}
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <Link
                        href={`/projects/${project.id}/committees/${committee.id}`}
                        className="hover:text-[color:var(--color-brand-action-orange)] transition-colors truncate max-w-[180px]"
                    >
                        {committee.name}
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate max-w-[200px]">
                        {activity.title}
                    </span>
                </div>

                {/* ── Workflow Status Banners ── */}

                {/* 1. Returned for Revision Banner */}
                {activity.status === 'Returned for Revision' && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-sm font-bold text-rose-900">Activity Returned for Revision</h3>
                                    {activity.reviewed_at && (
                                        <span className="text-xs text-rose-700">
                                            Reviewed on {activity.reviewed_at} {activity.reviewer ? `by ${activity.reviewer.name}` : ''}
                                        </span>
                                    )}
                                </div>
                                {activity.review_feedback && (
                                    <div className="mt-1 p-3 rounded-lg bg-white/90 border border-rose-200 text-xs text-rose-800 leading-relaxed">
                                        <span className="font-semibold block mb-0.5 text-rose-900">Staff Review Feedback:</span>
                                        {activity.review_feedback}
                                    </div>
                                )}
                                <p className="text-xs text-rose-700 pt-0.5">
                                    Please revise your assigned tasks to address the reviewer feedback. You may resubmit the activity when finished.
                                </p>
                            </div>
                        </div>
                        {activity.can.submit && (
                            <Button
                                type="button"
                                variant="primary"
                                onClick={handleOpenSubmitModal}
                                className="shrink-0 self-start md:self-center"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                <span>Resubmit for Review</span>
                            </Button>
                        )}
                    </div>
                )}

                {/* 2. Under Review Banner */}
                {activity.status === 'Under Review' && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-amber-900">Activity is Under Review</h3>
                                <p className="text-xs text-amber-700">
                                    This activity has been submitted and is currently awaiting verification by the committee head (Project Staff).
                                </p>
                                {activity.submission_notes && (
                                    <div className="mt-2 p-2.5 rounded-lg bg-white/90 border border-amber-200 text-xs text-amber-800">
                                        <span className="font-semibold text-amber-900">Member Submission Note: </span>
                                        {activity.submission_notes}
                                    </div>
                                )}
                            </div>
                        </div>
                        {activity.can.review && (
                            <div className="flex items-center gap-2 shrink-0 self-start md:self-center flex-wrap">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-rose-700 border-rose-200 hover:bg-rose-50"
                                    onClick={handleOpenReviewReturnModal}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                                    <span>Return for Revision</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={handleOpenReviewCompleteModal}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    <span>Mark Completed</span>
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Completed Banner */}
                {activity.status === 'Completed' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-xs flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-emerald-900">Activity Completed</h3>
                                {activity.reviewed_at && (
                                    <span className="text-xs text-emerald-700">
                                        Approved on {activity.reviewed_at} {activity.reviewer ? `by ${activity.reviewer.name}` : ''}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-emerald-700">
                                All deliverables for this activity have been verified and marked complete.
                            </p>
                            {activity.submission_notes && (
                                <p className="text-[11px] text-emerald-800 pt-1">
                                    <span className="font-semibold">Submission note: </span>
                                    {activity.submission_notes}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Activity Header Banner ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)]">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                    href={`/projects/${project.id}/committees/${committee.id}`}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors mr-1"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    <span>Back to Committee</span>
                                </Link>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    Activity
                                </span>
                                <span
                                    className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getActivityStatusBadge(
                                        activity.status
                                    )}`}
                                >
                                    {activity.status}
                                </span>
                            </div>

                            <h1 className="text-xl md:text-2xl font-bold text-[color:var(--color-text-main)]">
                                {activity.title}
                            </h1>

                            <div className="flex items-center gap-4 text-xs text-[color:var(--color-text-subtle)] flex-wrap pt-1">
                                {activity.due_date && (
                                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Target Due: {activity.due_date}</span>
                                    </span>
                                )}
                                {activity.creator && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Created by {activity.creator.name}</span>
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{committee.name}</span>
                                </span>
                            </div>
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
                            {/* Member Submit for Review button */}
                            {activity.can.submit && activity.status !== 'Returned for Revision' && (
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={handleOpenSubmitModal}
                                >
                                    <Send className="w-3.5 h-3.5 mr-1" />
                                    <span>Submit for Review</span>
                                </Button>
                            )}

                            {/* Staff Edit Activity */}
                            {activity.can.update && (
                                <button
                                    type="button"
                                    onClick={handleOpenEditActivity}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-xs"
                                >
                                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Edit</span>
                                </button>
                            )}

                            {/* Staff Delete Activity */}
                            {activity.can.delete && (
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteActivityModalOpen(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 transition-colors shadow-xs"
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {activity.description && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                                {activity.description}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Progress & Quick Metrics ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-xs space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Tasks Completed</span>
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-slate-900">
                                {completedTasksCount} / {activity.tasks.length}
                            </span>
                            <span className="text-xs font-bold text-[color:var(--color-brand-dark-green)]">
                                {taskProgressPercent}%
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                    width: `${taskProgressPercent}%`,
                                    backgroundColor: 'var(--color-brand-dark-green)',
                                }}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-xs space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Committee Supervision</span>
                        <div className="flex items-center gap-1.5">
                            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-sm font-bold text-slate-800 truncate">
                                {committee.head?.name ?? 'Unassigned Staff'}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">Project Staff Head</p>
                    </div>

                    <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-4 shadow-xs space-y-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">Parent Project</span>
                        <p className="text-sm font-bold text-slate-800 truncate">{project.title}</p>
                        <p className="text-[11px] text-slate-400">Status: {project.status}</p>
                    </div>
                </div>

                {/* ── Tasks Section ── */}
                <div className="bg-white rounded-xl border border-[color:var(--color-border-light)] p-6 shadow-[0_1px_3px_0_rgb(0,0,0,0.04)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <h3 className="text-base font-bold text-[color:var(--color-text-main)]">
                                Activity Tasks ({activity.tasks.length})
                            </h3>
                            <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
                                Actionable work items executed by committee members
                            </p>
                        </div>
                        {activity.can.createTask && (
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={handleOpenCreateTask}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Task</span>
                            </Button>
                        )}
                    </div>

                    {activity.tasks.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                            {activity.tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                                >
                                    <div className="space-y-1.5 max-w-xl">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Status Badge or Member Status Dropdown */}
                                            {task.can.updateStatus ? (
                                                <select
                                                    value={task.status}
                                                    onChange={(e) =>
                                                        handleTaskStatusChange(task, e.target.value as TaskItem['status'])
                                                    }
                                                    disabled={statusUpdatingTaskId === task.id}
                                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors ${getTaskStatusBadge(
                                                        task.status
                                                    )}`}
                                                    title="Click to update task status"
                                                >
                                                    <option value="To Do">To Do</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                            ) : (
                                                <span
                                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTaskStatusBadge(
                                                        task.status
                                                    )}`}
                                                >
                                                    {task.status}
                                                </span>
                                            )}
                                            <h4 className="text-sm font-bold text-[color:var(--color-text-main)]">
                                                {task.title}
                                            </h4>
                                        </div>
                                        {task.description && (
                                            <p className="text-xs text-slate-500 line-clamp-2">
                                                {task.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                                            {task.due_date && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    <span>Due: {task.due_date}</span>
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-400" />
                                                <span>
                                                    {task.assignee ? task.assignee.name : 'Unassigned'}
                                                    {task.is_assigned_to_me ? ' (You)' : ''}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Task Management Actions for Project Staff */}
                                    <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                                        {task.can.update && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditTask(task)}
                                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                                title="Edit Task"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {task.can.delete && (
                                            <button
                                                type="button"
                                                onClick={() => setDeletingTask(task)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                title="Delete Task"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                            <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <h4 className="text-sm font-bold text-slate-800">No Tasks Created Yet</h4>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                                Break down this activity into actionable tasks and assign them to committee members.
                            </p>
                            {activity.can.createTask && (
                                <div className="mt-4">
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={handleOpenCreateTask}
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>+ Add First Task</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Submit for Review Modal ── */}
                <Modal
                    isOpen={isSubmitModalOpen}
                    onClose={() => !submitProcessing && setIsSubmitModalOpen(false)}
                    title={activity.status === 'Returned for Revision' ? 'Resubmit Activity for Review' : 'Submit Activity for Review'}
                    description={`Submit "${activity.title}" to Project Staff for verification and approval.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleSubmitActivity} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label htmlFor="submit-notes">Submission Notes (Optional)</Label>
                            <textarea
                                id="submit-notes"
                                name="submission_notes"
                                rows={4}
                                value={submitData.submission_notes}
                                onChange={(e) => setSubmitData('submission_notes', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Explain completed work, relevant links, or notes for the reviewer..."
                            />
                            <InputError message={submitErrors.submission_notes} />
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
                            <p>
                                Submitting will change the activity status to <span className="font-semibold text-amber-700">Under Review</span>. Your committee head will be notified to review the completed tasks.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsSubmitModalOpen(false)}
                                disabled={submitProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={submitProcessing}
                                disabled={submitProcessing}
                            >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                <span>Submit for Review</span>
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Staff Mark Completed Modal ── */}
                <Modal
                    isOpen={isReviewCompleteModalOpen}
                    onClose={() => !reviewProcessing && setIsReviewCompleteModalOpen(false)}
                    title="Mark Activity Completed"
                    description={`Approve and complete "${activity.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleReviewSubmit} className="space-y-4 pt-1">
                        <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 space-y-1">
                            <p className="font-semibold">Confirm Activity Completion</p>
                            <p>
                                Marking this activity as Completed verifies that all required tasks and deliverables have been reviewed. Task completion states will remain preserved.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsReviewCompleteModalOpen(false)}
                                disabled={reviewProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                isLoading={reviewProcessing}
                                disabled={reviewProcessing}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                <span>Confirm Complete</span>
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Staff Return for Revision Modal ── */}
                <Modal
                    isOpen={isReviewReturnModalOpen}
                    onClose={() => !reviewProcessing && setIsReviewReturnModalOpen(false)}
                    title="Return Activity for Revision"
                    description={`Provide feedback to committee members for revising "${activity.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleReviewSubmit} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label htmlFor="review-feedback" required>
                                Review Feedback
                            </Label>
                            <textarea
                                id="review-feedback"
                                name="review_feedback"
                                rows={4}
                                value={reviewData.review_feedback}
                                onChange={(e) => setReviewData('review_feedback', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Specify what adjustments or missing items need to be resolved..."
                                required
                            />
                            <InputError message={reviewErrors.review_feedback} />
                        </div>

                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800">
                            <p>
                                This activity will be returned to committee members with status <span className="font-semibold text-rose-700">Returned for Revision</span> so they can update their work and resubmit.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsReviewReturnModalOpen(false)}
                                disabled={reviewProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                isLoading={reviewProcessing}
                                disabled={reviewProcessing}
                            >
                                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                <span>Return for Revision</span>
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Create Task Modal ── */}
                <Modal
                    isOpen={isCreateTaskModalOpen}
                    onClose={() => !taskProcessing && setIsCreateTaskModalOpen(false)}
                    title="Add Task"
                    description={`Create a new task under "${activity.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleCreateTaskSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Task Title"
                            id="create-task-title"
                            name="title"
                            value={taskData.title}
                            onChange={(e) => setTaskData('title', e.target.value)}
                            error={taskErrors.title}
                            required
                            placeholder="e.g., Draft event schedule"
                            autoFocus
                        />

                        <div className="space-y-1">
                            <Label htmlFor="create-task-description">Description (Optional)</Label>
                            <textarea
                                id="create-task-description"
                                name="description"
                                rows={3}
                                value={taskData.description}
                                onChange={(e) => setTaskData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Details or instructions for the assignee..."
                            />
                            <InputError message={taskErrors.description} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                label="Target Due Date"
                                id="create-task-due-date"
                                type="date"
                                value={taskData.due_date}
                                onChange={(e) => setTaskData('due_date', e.target.value)}
                                error={taskErrors.due_date}
                            />

                            <div className="space-y-1">
                                <Label htmlFor="create-task-status">Status</Label>
                                <select
                                    id="create-task-status"
                                    name="status"
                                    value={taskData.status}
                                    onChange={(e) =>
                                        setTaskData(
                                            'status',
                                            e.target.value as TaskItem['status']
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <InputError message={taskErrors.status} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="create-task-assignee">Assignee (Optional)</Label>
                            <select
                                id="create-task-assignee"
                                name="assigned_to"
                                value={taskData.assigned_to}
                                onChange={(e) => setTaskData('assigned_to', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                            >
                                <option value="">-- Unassigned --</option>
                                {eligibleAssignees.map((assignee) => (
                                    <option key={assignee.id} value={assignee.id}>
                                        {assignee.name} ({assignee.role})
                                    </option>
                                ))}
                            </select>
                            <InputError message={taskErrors.assigned_to} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateTaskModalOpen(false)}
                                disabled={taskProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={taskProcessing}
                                disabled={taskProcessing}
                            >
                                Add Task
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Edit Task Modal ── */}
                <Modal
                    isOpen={editingTask !== null}
                    onClose={() => !editTaskProcessing && setEditingTask(null)}
                    title="Edit Task"
                    description={`Update task details.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleEditTaskSubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Task Title"
                            id="edit-task-title"
                            name="title"
                            value={editTaskData.title}
                            onChange={(e) => setEditTaskData('title', e.target.value)}
                            error={editTaskErrors.title}
                            required
                        />

                        <div className="space-y-1">
                            <Label htmlFor="edit-task-description">Description (Optional)</Label>
                            <textarea
                                id="edit-task-description"
                                name="description"
                                rows={3}
                                value={editTaskData.description}
                                onChange={(e) => setEditTaskData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                            />
                            <InputError message={editTaskErrors.description} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                label="Target Due Date"
                                id="edit-task-due-date"
                                type="date"
                                value={editTaskData.due_date}
                                onChange={(e) => setEditTaskData('due_date', e.target.value)}
                                error={editTaskErrors.due_date}
                            />

                            <div className="space-y-1">
                                <Label htmlFor="edit-task-status">Status</Label>
                                <select
                                    id="edit-task-status"
                                    name="status"
                                    value={editTaskData.status}
                                    onChange={(e) =>
                                        setEditTaskData(
                                            'status',
                                            e.target.value as TaskItem['status']
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <InputError message={editTaskErrors.status} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="edit-task-assignee">Assignee (Optional)</Label>
                            <select
                                id="edit-task-assignee"
                                name="assigned_to"
                                value={editTaskData.assigned_to}
                                onChange={(e) => setEditTaskData('assigned_to', e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                            >
                                <option value="">-- Unassigned --</option>
                                {eligibleAssignees.map((assignee) => (
                                    <option key={assignee.id} value={assignee.id}>
                                        {assignee.name} ({assignee.role})
                                    </option>
                                ))}
                            </select>
                            <InputError message={editTaskErrors.assigned_to} />
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingTask(null)}
                                disabled={editTaskProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={editTaskProcessing}
                                disabled={editTaskProcessing}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Delete Task Confirmation Modal ── */}
                <Modal
                    isOpen={deletingTask !== null}
                    onClose={() => !actionProcessing && setDeletingTask(null)}
                    title="Remove Task"
                    description={`Are you sure you want to remove "${deletingTask?.title}"?`}
                    maxWidth="md"
                >
                    <div className="space-y-4 pt-1">
                        <p className="text-xs text-slate-600">
                            This task will be permanently removed from this activity. This action cannot be undone.
                        </p>
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeletingTask(null)}
                                disabled={actionProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={handleDeleteTaskConfirm}
                                isLoading={actionProcessing}
                                disabled={actionProcessing}
                            >
                                Delete Task
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* ── Edit Activity Modal ── */}
                <Modal
                    isOpen={isEditActivityModalOpen}
                    onClose={() => !editActivityProcessing && setIsEditActivityModalOpen(false)}
                    title="Edit Activity"
                    description={`Update details for "${activity.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleEditActivitySubmit} className="space-y-4 pt-1">
                        <FormField
                            label="Activity Title"
                            id="edit-activity-title"
                            name="title"
                            value={editActivityData.title}
                            onChange={(e) => setEditActivityData('title', e.target.value)}
                            error={editActivityErrors.title}
                            required
                        />

                        <div className="space-y-1">
                            <Label htmlFor="edit-activity-description">Description (Optional)</Label>
                            <textarea
                                id="edit-activity-description"
                                name="description"
                                rows={3}
                                value={editActivityData.description}
                                onChange={(e) => setEditActivityData('description', e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                            />
                            <InputError message={editActivityErrors.description} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                label="Target Due Date"
                                id="edit-activity-due-date"
                                type="date"
                                value={editActivityData.due_date}
                                onChange={(e) => setEditActivityData('due_date', e.target.value)}
                                error={editActivityErrors.due_date}
                            />

                            <div className="space-y-1">
                                <Label htmlFor="edit-activity-status">Status</Label>
                                <select
                                    id="edit-activity-status"
                                    name="status"
                                    value={editActivityData.status}
                                    onChange={(e) =>
                                        setEditActivityData(
                                            'status',
                                            e.target.value as ActivityData['status']
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="Returned for Revision">Returned for Revision</option>
                                    <option value="Completed">Completed</option>
                                </select>
                                <InputError message={editActivityErrors.status} />
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditActivityModalOpen(false)}
                                disabled={editActivityProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={editActivityProcessing}
                                disabled={editActivityProcessing}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Delete Activity Confirmation Modal ── */}
                <Modal
                    isOpen={isDeleteActivityModalOpen}
                    onClose={() => !actionProcessing && setIsDeleteActivityModalOpen(false)}
                    title="Delete Activity"
                    description={`Are you sure you want to remove "${activity.title}"?`}
                    maxWidth="md"
                >
                    <div className="space-y-4 pt-1">
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <p>
                                Deleting this activity will permanently remove all associated tasks ({activity.tasks.length}). This action cannot be undone.
                            </p>
                        </div>
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDeleteActivityModalOpen(false)}
                                disabled={actionProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="danger"
                                onClick={handleDeleteActivityConfirm}
                                isLoading={actionProcessing}
                                disabled={actionProcessing}
                            >
                                Confirm Delete
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </AppLayout>
    );
}
