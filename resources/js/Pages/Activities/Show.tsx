import React, { useState, useEffect } from 'react';
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
    Check,
    CheckCircle2,
    CheckSquare,
    ChevronRight,
    Clock,
    Edit3,
    Layers,
    ListTodo,
    Plus,
    RotateCcw,
    Send,
    Shield,
    Trash2,
    User,
    AlertTriangle,
    X,
} from 'lucide-react';

interface AssigneeItem {
    id: number;
    name: string;
    email: string;
}

export interface ChecklistItemData {
    id: string;
    content: string;
    is_completed: boolean;
    order: number;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Under Review' | 'Completed' | 'Returned';

export interface TaskItem {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    requires_review?: boolean;
    due_date: string | null;
    due_date_raw: string | null;
    assignee: AssigneeItem | null;
    is_assigned_to_me?: boolean;
    checklist_items: ChecklistItemData[];
    can: {
        update: boolean;
        delete: boolean;
        updateStatus?: boolean;
        manageChecklist?: boolean;
        submitReview?: boolean;
        review?: boolean;
        resubmit?: boolean;
    };
}

export interface ActivityData {
    id: string;
    title: string;
    description: string | null;
    status: 'To Do' | 'In Progress' | 'Under Review' | 'Completed' | 'Returned' | 'Returned for Revision';
    start_date: string | null;
    start_date_raw: string | null;
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
    const [viewingTask, setViewingTask] = useState<TaskItem | null>(null);
    const [isEditActivityModalOpen, setIsEditActivityModalOpen] = useState(false);
    const [isDeleteActivityModalOpen, setIsDeleteActivityModalOpen] = useState(false);
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [isReviewCompleteModalOpen, setIsReviewCompleteModalOpen] = useState(false);
    const [isReviewReturnModalOpen, setIsReviewReturnModalOpen] = useState(false);
    const [actionProcessing, setActionProcessing] = useState(false);
    const [statusUpdatingTaskId, setStatusUpdatingTaskId] = useState<string | null>(null);

    // Task Review Modals state
    const [submittingTask, setSubmittingTask] = useState<TaskItem | null>(null);
    const [submittingTaskNotes, setSubmittingTaskNotes] = useState('');
    const [approvingTask, setApprovingTask] = useState<TaskItem | null>(null);
    const [returningTask, setReturningTask] = useState<TaskItem | null>(null);
    const [returningTaskFeedback, setReturningTaskFeedback] = useState('');
    const [taskActionProcessing, setTaskActionProcessing] = useState(false);
    const [taskActionError, setTaskActionError] = useState<string | null>(null);

    // Checklist interaction state
    const [newChecklistContent, setNewChecklistContent] = useState('');
    const [checklistProcessing, setChecklistProcessing] = useState(false);
    const [checklistError, setChecklistError] = useState<string | null>(null);
    const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
    const [editingChecklistContent, setEditingChecklistContent] = useState('');
    const [deletingChecklistItem, setDeletingChecklistItem] = useState<ChecklistItemData | null>(null);

    // Sync viewingTask with incoming activity props when tasks change
    useEffect(() => {
        if (viewingTask) {
            const fresh = activity.tasks.find((t) => String(t.id) === String(viewingTask.id));
            if (fresh) {
                setViewingTask(fresh);
            }
        }
    }, [activity.tasks]);

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
        status: 'To Do' as TaskStatus,
        requires_review: false,
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
        status: 'To Do' as TaskStatus,
        requires_review: false,
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
        start_date: activity.start_date_raw ?? '',
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
        setTaskData({
            title: '',
            description: '',
            due_date: '',
            status: 'To Do',
            requires_review: false,
            assigned_to: '',
        });
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
            requires_review: task.requires_review ?? false,
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

    // Task Review Handlers
    const handleOpenSubmitTaskReview = (task: TaskItem) => {
        setSubmittingTask(task);
        setSubmittingTaskNotes('');
        setTaskActionError(null);
    };

    const handleSubmitTaskReview = (e: React.FormEvent) => {
        e.preventDefault();
        if (!submittingTask) return;

        setTaskActionProcessing(true);
        setTaskActionError(null);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${submittingTask.id}/submit`,
            { submission_notes: submittingTaskNotes },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSubmittingTask(null);
                    setSubmittingTaskNotes('');
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0];
                    if (first) setTaskActionError(String(first));
                },
                onFinish: () => setTaskActionProcessing(false),
            }
        );
    };

    const handleOpenApproveTask = (task: TaskItem) => {
        setApprovingTask(task);
        setTaskActionError(null);
    };

    const handleApproveTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!approvingTask) return;

        setTaskActionProcessing(true);
        setTaskActionError(null);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${approvingTask.id}/approve`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setApprovingTask(null);
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0];
                    if (first) setTaskActionError(String(first));
                },
                onFinish: () => setTaskActionProcessing(false),
            }
        );
    };

    const handleOpenReturnTask = (task: TaskItem) => {
        setReturningTask(task);
        setReturningTaskFeedback('');
        setTaskActionError(null);
    };

    const handleReturnTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!returningTask) return;

        setTaskActionProcessing(true);
        setTaskActionError(null);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${returningTask.id}/return`,
            { review_feedback: returningTaskFeedback },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setReturningTask(null);
                    setReturningTaskFeedback('');
                },
                onError: (errors) => {
                    const first = Object.values(errors)[0];
                    if (first) setTaskActionError(String(first));
                },
                onFinish: () => setTaskActionProcessing(false),
            }
        );
    };

    const handleResubmitTask = (task: TaskItem) => {
        setTaskActionProcessing(true);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}/resubmit`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setTaskActionProcessing(false),
            }
        );
    };

    const getAvailableStatusOptions = (task: TaskItem) => {
        // Staff or Leader with full update permissions:
        if (task.can.delete) {
            return ['To Do', 'In Progress', 'Under Review', 'Completed', 'Returned'] as TaskStatus[];
        }

        // Assigned Member:
        if (task.requires_review) {
            // Cannot directly mark completed or returned
            if (task.status === 'To Do' || task.status === 'In Progress') {
                return ['To Do', 'In Progress'] as TaskStatus[];
            }
            if (task.status === 'Returned') {
                return ['Returned', 'In Progress'] as TaskStatus[];
            }
            return [task.status];
        } else {
            // Normal task: can do To Do -> In Progress -> Completed
            if (task.status === 'Completed') {
                return ['Completed'] as TaskStatus[];
            }
            return ['To Do', 'In Progress', 'Completed'] as TaskStatus[];
        }
    };

    const handleOpenEditActivity = () => {
        clearEditActivityErrors();
        setEditActivityData({
            title: activity.title,
            description: activity.description ?? '',
            start_date: activity.start_date_raw ?? '',
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

    // Checklist handlers
    const handleToggleChecklist = (task: TaskItem, item: ChecklistItemData) => {
        if (!task.can.manageChecklist) return;

        setChecklistProcessing(true);
        router.patch(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}/checklist/${item.id}`,
            { is_completed: !item.is_completed },
            {
                preserveScroll: true,
                onFinish: () => setChecklistProcessing(false),
            }
        );
    };

    const handleAddChecklistItem = (e: React.FormEvent, task: TaskItem) => {
        e.preventDefault();
        const content = newChecklistContent.trim();
        if (!content) {
            setChecklistError('The checklist item content is required.');
            return;
        }
        if (content.length > 500) {
            setChecklistError('Checklist item content cannot exceed 500 characters.');
            return;
        }

        setChecklistError(null);
        setChecklistProcessing(true);
        router.post(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}/checklist`,
            {
                content,
                is_completed: false,
                order: task.checklist_items ? task.checklist_items.length : 0,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewChecklistContent('');
                },
                onError: (err) => {
                    if (err.content) setChecklistError(err.content);
                },
                onFinish: () => setChecklistProcessing(false),
            }
        );
    };

    const handleSaveEditChecklist = (task: TaskItem, item: ChecklistItemData) => {
        const content = editingChecklistContent.trim();
        if (!content) {
            setChecklistError('The checklist item content is required.');
            return;
        }
        if (content === item.content) {
            setEditingChecklistId(null);
            return;
        }

        setChecklistError(null);
        setChecklistProcessing(true);
        router.patch(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}/checklist/${item.id}`,
            { content },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingChecklistId(null);
                },
                onError: (err) => {
                    if (err.content) setChecklistError(err.content);
                },
                onFinish: () => setChecklistProcessing(false),
            }
        );
    };

    const handleDeleteChecklist = (task: TaskItem, item: ChecklistItemData) => {
        setChecklistProcessing(true);
        router.delete(
            `/projects/${project.id}/committees/${committee.id}/activities/${activity.id}/tasks/${task.id}/checklist/${item.id}`,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDeletingChecklistItem(null);
                },
                onFinish: () => setChecklistProcessing(false),
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
            case 'Returned':
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
            case 'Under Review':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Returned':
                return 'bg-rose-50 text-rose-700 border-rose-200';
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
                {(activity.status === 'Returned' || activity.status === 'Returned for Revision') && (
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
                                {activity.start_date && (
                                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Start: {activity.start_date}</span>
                                    </span>
                                )}
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
                            {activity.tasks.map((task) => {
                                const checklistCount = task.checklist_items ? task.checklist_items.length : 0;
                                const checklistCompleted = task.checklist_items
                                    ? task.checklist_items.filter((i) => i.is_completed).length
                                    : 0;

                                return (
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
                                                            handleTaskStatusChange(task, e.target.value as TaskStatus)
                                                        }
                                                        disabled={statusUpdatingTaskId === task.id || task.status === 'Under Review' || task.status === 'Completed'}
                                                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors ${getTaskStatusBadge(
                                                            task.status
                                                        )}`}
                                                        title="Click to update task status"
                                                    >
                                                        {getAvailableStatusOptions(task).map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {opt}
                                                            </option>
                                                        ))}
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

                                                {/* Review Required Badge */}
                                                {task.requires_review && (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700"
                                                        title="Requires Staff Review before completion"
                                                    >
                                                        <Shield className="w-3 h-3 text-purple-600" />
                                                        <span>Review Required</span>
                                                    </span>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setViewingTask(task)}
                                                    className="text-sm font-bold text-[color:var(--color-text-main)] hover:text-[color:var(--color-brand-action-orange)] transition-colors text-left cursor-pointer"
                                                >
                                                    {task.title}
                                                </button>
                                            </div>
                                            {task.description && (
                                                <p className="text-xs text-slate-500 line-clamp-2">
                                                    {task.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5 flex-wrap">
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
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingTask(task)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                                >
                                                    <CheckSquare className="w-3 h-3 text-slate-400" />
                                                    <span>
                                                        Checklist ({checklistCompleted}/{checklistCount})
                                                    </span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Task Management Actions */}
                                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                                            {/* Member Submit for Review button */}
                                            {task.requires_review &&
                                                (task.can.submitReview || (task.is_assigned_to_me && task.status === 'In Progress')) && (
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => handleOpenSubmitTaskReview(task)}
                                                        className="text-[11px] h-7 px-2.5"
                                                    >
                                                        <Send className="w-3 h-3 mr-1" />
                                                        <span>Submit for Review</span>
                                                    </Button>
                                                )}

                                            {/* Member Resubmit button */}
                                            {task.requires_review &&
                                                task.status === 'Returned' &&
                                                (task.can.resubmit || task.is_assigned_to_me) && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleResubmitTask(task)}
                                                        disabled={taskActionProcessing}
                                                        className="text-[11px] h-7 px-2.5 text-rose-700 border-rose-300 hover:bg-rose-50"
                                                    >
                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                        <span>Continue Work</span>
                                                    </Button>
                                                )}

                                            {/* Staff Review buttons (Under Review) */}
                                            {task.status === 'Under Review' && task.can.review && (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenReturnTask(task)}
                                                        className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors cursor-pointer"
                                                    >
                                                        Return
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenApproveTask(task)}
                                                        className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer"
                                                    >
                                                        Approve
                                                    </button>
                                                </div>
                                            )}

                                            {/* Awaiting Review notice for non-reviewers */}
                                            {task.status === 'Under Review' && !task.can.review && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                                                    <Clock className="w-3 h-3 text-amber-500" />
                                                    <span>Awaiting Staff Review</span>
                                                </span>
                                            )}

                                            {/* Member normal task quick complete button */}
                                            {!task.requires_review &&
                                                task.status === 'In Progress' &&
                                                (task.can.updateStatus && task.is_assigned_to_me) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTaskStatusChange(task, 'Completed')}
                                                        disabled={statusUpdatingTaskId === task.id}
                                                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-600" />
                                                        <span>Mark Completed</span>
                                                    </button>
                                                )}

                                            <button
                                                type="button"
                                                onClick={() => setViewingTask(task)}
                                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                            >
                                                Details & Checklist
                                            </button>
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
                                );
                            })}
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

                {/* ── Task Details & Checklist Modal ── */}
                <Modal
                    isOpen={viewingTask !== null}
                    onClose={() => {
                        setViewingTask(null);
                        setEditingChecklistId(null);
                        setChecklistError(null);
                    }}
                    title={viewingTask?.title ?? 'Task Details'}
                    description={`Activity: ${activity.title} • Committee: ${committee.name}`}
                    maxWidth="lg"
                >
                    {viewingTask && (
                        <div className="space-y-5 pt-1">
                            {/* Meta Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Status
                                    </span>
                                    {viewingTask.can.updateStatus ? (
                                        <select
                                            value={viewingTask.status}
                                            onChange={(e) =>
                                                handleTaskStatusChange(viewingTask, e.target.value as TaskStatus)
                                            }
                                            disabled={statusUpdatingTaskId === viewingTask.id || viewingTask.status === 'Under Review' || viewingTask.status === 'Completed'}
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors ${getTaskStatusBadge(
                                                viewingTask.status
                                            )}`}
                                        >
                                            {getAvailableStatusOptions(viewingTask).map((opt) => (
                                                <option key={opt} value={opt}>
                                                    {opt}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span
                                            className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${getTaskStatusBadge(
                                                viewingTask.status
                                            )}`}
                                        >
                                            {viewingTask.status}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Review Requirement
                                    </span>
                                    {viewingTask.requires_review ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-md">
                                            <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                            <span>Staff Review Required</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                                            <span>Standard (No Review)</span>
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Assignee
                                    </span>
                                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5 py-1">
                                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">
                                            {viewingTask.assignee ? viewingTask.assignee.name : 'Unassigned'}
                                            {viewingTask.is_assigned_to_me ? ' (You)' : ''}
                                        </span>
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Target Due Date
                                    </span>
                                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5 py-1">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span>{viewingTask.due_date ?? 'No deadline set'}</span>
                                    </span>
                                </div>
                            </div>

                            {/* Contextual Workflow Action Banners */}
                            {viewingTask.status === 'Under Review' && (
                                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-amber-900">Task is Under Staff Review</p>
                                            <p className="text-[11px] text-amber-700">
                                                {viewingTask.can.review
                                                    ? 'The assignee has submitted this task for verification.'
                                                    : 'Awaiting review and approval by Project Staff.'}
                                            </p>
                                        </div>
                                    </div>
                                    {viewingTask.can.review && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-rose-700 border-rose-300 hover:bg-rose-50 text-xs"
                                                onClick={() => handleOpenReturnTask(viewingTask)}
                                            >
                                                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                                                <span>Return for Revision</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="primary"
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                                onClick={() => handleOpenApproveTask(viewingTask)}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                <span>Approve Task</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {viewingTask.status === 'Returned' && viewingTask.requires_review && (
                                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-rose-900">Task Returned for Revision</p>
                                            <p className="text-[11px] text-rose-700">
                                                Please review staff feedback, address the requested revisions, and continue work.
                                            </p>
                                        </div>
                                    </div>
                                    {(viewingTask.can.resubmit || viewingTask.is_assigned_to_me) && (
                                        <Button
                                            type="button"
                                            variant="primary"
                                            size="sm"
                                            onClick={() => handleResubmitTask(viewingTask)}
                                            disabled={taskActionProcessing}
                                            className="shrink-0 text-xs"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                            <span>Continue Work (Resubmit)</span>
                                        </Button>
                                    )}
                                </div>
                            )}

                            {viewingTask.status === 'In Progress' && viewingTask.requires_review && (viewingTask.can.submitReview || viewingTask.is_assigned_to_me) && (
                                <div className="p-3.5 bg-purple-50/70 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-bold text-purple-900">Staff Review Required</p>
                                            <p className="text-[11px] text-purple-700">
                                                When you finish this task, submit it for staff review instead of marking it complete directly.
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => handleOpenSubmitTaskReview(viewingTask)}
                                        className="shrink-0 text-xs"
                                    >
                                        <Send className="w-3.5 h-3.5 mr-1" />
                                        <span>Submit for Review</span>
                                    </Button>
                                </div>
                            )}

                            {viewingTask.status === 'In Progress' && !viewingTask.requires_review && (viewingTask.can.updateStatus && viewingTask.is_assigned_to_me) && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                                    <p className="text-xs text-slate-600">Standard task with normal completion workflow.</p>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                                        onClick={() => handleTaskStatusChange(viewingTask, 'Completed')}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                        <span>Mark as Completed</span>
                                    </Button>
                                </div>
                            )}

                            {/* Task Description */}
                            {viewingTask.description && (
                                <div className="space-y-1">
                                    <span className="text-xs font-semibold text-slate-700">Description</span>
                                    <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-line">
                                        {viewingTask.description}
                                    </p>
                                </div>
                            )}

                            {/* Checklist Section */}
                            <div className="space-y-3 pt-3 border-t border-slate-200">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <CheckSquare className="w-4 h-4 text-[color:var(--color-brand-action-orange)]" />
                                            <span>Task Checklist</span>
                                        </h4>
                                        <p className="text-[11px] text-slate-500">
                                            Actionable items and deliverables to complete for this task
                                        </p>
                                    </div>
                                    {/* Progress indicator */}
                                    <div className="text-left sm:text-right">
                                        <span className="text-xs font-bold text-slate-800">
                                            {viewingTask.checklist_items?.filter((i) => i.is_completed).length ?? 0} /{' '}
                                            {viewingTask.checklist_items?.length ?? 0} completed
                                        </span>
                                        <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                            <div
                                                className="h-full bg-[color:var(--color-brand-dark-green)] transition-all duration-300 rounded-full"
                                                style={{
                                                    width: `${
                                                        viewingTask.checklist_items &&
                                                        viewingTask.checklist_items.length > 0
                                                            ? Math.round(
                                                                  (viewingTask.checklist_items.filter(
                                                                      (i) => i.is_completed
                                                                  ).length /
                                                                      viewingTask.checklist_items.length) *
                                                                      100
                                                              )
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="space-y-2">
                                    {viewingTask.checklist_items && viewingTask.checklist_items.length > 0 ? (
                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                                            {viewingTask.checklist_items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className={`p-3 flex items-start justify-between gap-3 transition-colors ${
                                                        item.is_completed ? 'bg-slate-50/70' : 'hover:bg-slate-50/40'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                                        <button
                                                            type="button"
                                                            disabled={
                                                                !viewingTask.can.manageChecklist || checklistProcessing
                                                            }
                                                            onClick={() => handleToggleChecklist(viewingTask, item)}
                                                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                                item.is_completed
                                                                    ? 'bg-[color:var(--color-brand-action-orange)] border-[color:var(--color-brand-action-orange)] text-white'
                                                                    : 'border-slate-300 hover:border-slate-400 bg-white'
                                                            } ${
                                                                viewingTask.can.manageChecklist
                                                                    ? 'cursor-pointer'
                                                                    : 'cursor-not-allowed opacity-75'
                                                            }`}
                                                            title={
                                                                viewingTask.can.manageChecklist
                                                                    ? item.is_completed
                                                                        ? 'Mark incomplete'
                                                                        : 'Mark complete'
                                                                    : 'Only Project Staff or Leader can toggle checklist items'
                                                            }
                                                        >
                                                            {item.is_completed && (
                                                                <Check className="w-3 h-3 stroke-[3]" />
                                                            )}
                                                        </button>

                                                        {editingChecklistId === item.id ? (
                                                            <div className="flex-1 space-y-2">
                                                                <input
                                                                    type="text"
                                                                    value={editingChecklistContent}
                                                                    onChange={(e) =>
                                                                        setEditingChecklistContent(e.target.value)
                                                                    }
                                                                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                                                                    autoFocus
                                                                    maxLength={500}
                                                                />
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleSaveEditChecklist(viewingTask, item)
                                                                        }
                                                                        disabled={checklistProcessing}
                                                                        className="px-2 py-0.5 rounded text-[11px] font-semibold text-white bg-[color:var(--color-brand-action-orange)] hover:opacity-90 transition-opacity"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingChecklistId(null)}
                                                                        className="px-2 py-0.5 rounded text-[11px] text-slate-600 hover:bg-slate-100 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span
                                                                className={`text-xs leading-relaxed break-words flex-1 ${
                                                                    item.is_completed
                                                                        ? 'line-through text-slate-400'
                                                                        : 'text-slate-700'
                                                                }`}
                                                            >
                                                                {item.content}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {viewingTask.can.manageChecklist &&
                                                        editingChecklistId !== item.id && (
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setEditingChecklistId(item.id);
                                                                        setEditingChecklistContent(item.content);
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                                                    title="Edit item"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleDeleteChecklist(viewingTask, item)
                                                                    }
                                                                    disabled={checklistProcessing}
                                                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                                                    title="Delete item"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-lg border border-dashed border-slate-200 text-center bg-slate-50/50 text-xs text-slate-500">
                                            No checklist items created for this task yet.
                                        </div>
                                    )}

                                    {/* Add Checklist Item Form */}
                                    {viewingTask.can.manageChecklist && (
                                        <form
                                            onSubmit={(e) => handleAddChecklistItem(e, viewingTask)}
                                            className="pt-2"
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newChecklistContent}
                                                    onChange={(e) => setNewChecklistContent(e.target.value)}
                                                    placeholder="Add a new checklist item..."
                                                    maxLength={500}
                                                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-2xs focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-400"
                                                />
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    size="sm"
                                                    disabled={checklistProcessing || !newChecklistContent.trim()}
                                                    isLoading={checklistProcessing}
                                                >
                                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                                    <span>Add Item</span>
                                                </Button>
                                            </div>
                                            {checklistError && (
                                                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                                                    {checklistError}
                                                </p>
                                            )}
                                        </form>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                    {viewingTask.can.delete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDeletingTask(viewingTask);
                                                setViewingTask(null);
                                            }}
                                            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete Task</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {viewingTask.can.update && viewingTask.can.delete && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                handleOpenEditTask(viewingTask);
                                                setViewingTask(null);
                                            }}
                                        >
                                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                                            <span>Edit Task</span>
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setViewingTask(null)}
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* ── Submit for Review Modal ── */}
                <Modal
                    isOpen={isSubmitModalOpen}
                    onClose={() => !submitProcessing && setIsSubmitModalOpen(false)}
                    title={activity.status === 'Returned for Revision' || activity.status === 'Returned' ? 'Resubmit Activity for Review' : 'Submit Activity for Review'}
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
                                            e.target.value as TaskStatus
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Returned">Returned</option>
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

                        {/* Requires Staff Review */}
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                            <input
                                id="create-task-requires-review"
                                name="requires_review"
                                type="checkbox"
                                checked={taskData.requires_review}
                                onChange={(e) => setTaskData('requires_review', e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[color:var(--color-brand-action-orange)] focus:ring-[color:var(--color-brand-action-orange)] cursor-pointer"
                            />
                            <div className="space-y-0.5">
                                <Label htmlFor="create-task-requires-review" className="cursor-pointer font-medium text-slate-800">
                                    Requires Staff Review
                                </Label>
                                <p className="text-[11px] text-slate-500 leading-normal">
                                    When enabled, this task must be submitted to Project Staff for review before it can be completed.
                                </p>
                            </div>
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
                                            e.target.value as TaskStatus
                                        )
                                    }
                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors cursor-pointer"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Under Review">Under Review</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Returned">Returned</option>
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

                        {/* Requires Staff Review (Staff / Leader only) */}
                        {editingTask?.can.delete && (
                            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                                <input
                                    id="edit-task-requires-review"
                                    name="requires_review"
                                    type="checkbox"
                                    checked={editTaskData.requires_review}
                                    onChange={(e) => setEditTaskData('requires_review', e.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[color:var(--color-brand-action-orange)] focus:ring-[color:var(--color-brand-action-orange)] cursor-pointer"
                                />
                                <div className="space-y-0.5">
                                    <Label htmlFor="edit-task-requires-review" className="cursor-pointer font-medium text-slate-800">
                                        Requires Staff Review
                                    </Label>
                                    <p className="text-[11px] text-slate-500 leading-normal">
                                        When enabled, this task must be submitted to Project Staff for review before it can be completed.
                                    </p>
                                </div>
                            </div>
                        )}

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
                                label="Start Date (Optional)"
                                id="edit-activity-start-date"
                                type="date"
                                value={editActivityData.start_date}
                                onChange={(e) => setEditActivityData('start_date', e.target.value)}
                                error={editActivityErrors.start_date}
                            />

                            <FormField
                                label="Target Due Date (Optional)"
                                id="edit-activity-due-date"
                                type="date"
                                value={editActivityData.due_date}
                                onChange={(e) => setEditActivityData('due_date', e.target.value)}
                                error={editActivityErrors.due_date}
                            />
                        </div>

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
                                <option value="Completed">Completed</option>
                                <option value="Returned">Returned</option>
                            </select>
                            <InputError message={editActivityErrors.status} />
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

                {/* ── Submit Task for Review Modal ── */}
                <Modal
                    isOpen={submittingTask !== null}
                    onClose={() => !taskActionProcessing && setSubmittingTask(null)}
                    title="Submit Task for Review"
                    description={`Submit "${submittingTask?.title}" to Project Staff for verification and approval.`}
                    maxWidth="md"
                >
                    <form onSubmit={handleSubmitTaskReview} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label htmlFor="task-submit-notes">Submission Notes (Optional)</Label>
                            <textarea
                                id="task-submit-notes"
                                name="submission_notes"
                                rows={4}
                                value={submittingTaskNotes}
                                onChange={(e) => setSubmittingTaskNotes(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Explain completed work, deliverables, or notes for the staff reviewer..."
                            />
                            {taskActionError && (
                                <p className="text-xs text-rose-600 mt-1 font-medium">{taskActionError}</p>
                            )}
                        </div>

                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-800">
                            <p>
                                Submitting will transition this task to <span className="font-semibold text-purple-900">Under Review</span>. Project Staff will review your submission and either approve it or return it for revision.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSubmittingTask(null)}
                                disabled={taskActionProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={taskActionProcessing}
                                disabled={taskActionProcessing}
                            >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                <span>Submit Task for Review</span>
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Approve Task Modal ── */}
                <Modal
                    isOpen={approvingTask !== null}
                    onClose={() => !taskActionProcessing && setApprovingTask(null)}
                    title="Approve Task"
                    description={`Approve and complete "${approvingTask?.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleApproveTask} className="space-y-4 pt-1">
                        <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 space-y-1">
                            <p className="font-semibold">Confirm Task Approval</p>
                            <p>
                                Approving this task confirms that all deliverables and checklist items have been verified. The task status will transition to <span className="font-semibold text-emerald-900">Completed</span>.
                            </p>
                        </div>

                        {taskActionError && (
                            <p className="text-xs text-rose-600 font-medium">{taskActionError}</p>
                        )}

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setApprovingTask(null)}
                                disabled={taskActionProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                isLoading={taskActionProcessing}
                                disabled={taskActionProcessing}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                <span>Approve Task</span>
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* ── Return Task for Revision Modal ── */}
                <Modal
                    isOpen={returningTask !== null}
                    onClose={() => !taskActionProcessing && setReturningTask(null)}
                    title="Return Task for Revision"
                    description={`Provide feedback to the assignee for revising "${returningTask?.title}".`}
                    maxWidth="md"
                >
                    <form onSubmit={handleReturnTask} className="space-y-4 pt-1">
                        <div className="space-y-1">
                            <Label htmlFor="task-review-feedback" required>
                                Revision Feedback
                            </Label>
                            <textarea
                                id="task-review-feedback"
                                name="review_feedback"
                                rows={4}
                                value={returningTaskFeedback}
                                onChange={(e) => setReturningTaskFeedback(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[color:var(--color-brand-action-orange)] transition-colors placeholder:text-slate-400"
                                placeholder="Specify what adjustments, corrections, or missing items need to be resolved..."
                                required
                            />
                            {taskActionError && (
                                <p className="text-xs text-rose-600 mt-1 font-medium">{taskActionError}</p>
                            )}
                        </div>

                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-800">
                            <p>
                                This task will be returned to the assignee with status <span className="font-semibold text-rose-700">Returned</span>. They can continue work, make changes, and resubmit for review.
                            </p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReturningTask(null)}
                                disabled={taskActionProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                isLoading={taskActionProcessing}
                                disabled={taskActionProcessing || !returningTaskFeedback.trim()}
                            >
                                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                <span>Return Task</span>
                            </Button>
                        </div>
                    </form>
                </Modal>
            </div>
        </AppLayout>
    );
}
