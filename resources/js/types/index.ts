export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    created_at?: string;
    updated_at?: string;
}

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    auth?: {
        user: User | null;
    };
    errors?: Record<string, string>;
    flash?: {
        status?: string;
        success?: string;
        error?: string;
        info?: string;
    };
    notifications?: {
        unread_count: number;
        recent: NotificationItem[];
    };
};

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

export interface NotificationData {
    notification_type: string;
    title: string;
    message: string;
    action_url?: string;
    task_id?: number;
    activity_id?: number;
    project?: { id: number | string; title: string };
    committee?: { id: number | string; name: string };
    activity?: { id: number | string; title: string };
    task?: {
        id: number | string;
        title: string;
        due_date?: string | null;
        status?: string;
        requires_review?: boolean;
    };
    review_feedback?: string;
    status?: string;
}

export interface NotificationItem {
    id: string;
    type: string;
    data: NotificationData;
    read_at: string | null;
    created_at: string;
    created_at_human?: string;
}

export interface DashboardProject {
    id: string;
    title: string;
    description: string;
    status: string;
    role: string;
    start_date: string | null;
    end_date: string | null;
    committeesCount: number;
    tasksCount: number;
    completedTasksCount: number;
    progressPercentage: number;
}

export interface DashboardCommittee {
    id: string;
    name: string;
    description?: string;
    role: string;
    project_id: string;
    project_title: string;
    activities_count: number;
    tasks_count: number;
    completed_tasks_count: number;
    progress?: number;
    progressPercentage?: number;
}

export interface DashboardTask {
    id: string;
    title: string;
    description?: string;
    status: string;
    due_date: string | null;
    due_date_formatted: string;
    requires_review: boolean;
    is_overdue: boolean;
    is_approaching: boolean;
    project: { id: string; title: string };
    committee: { id: string; name: string };
    activity: { id: string; title: string };
    action_url: string;
}

export interface PendingReviewItem {
    type: 'task' | 'activity';
    id: string;
    title: string;
    status: string;
    submitted_by: string;
    project: { id: string; title: string };
    committee: { id: string; name: string };
    activity: { id: string; title: string };
    action_url: string;
    updated_at?: string;
}

export interface DashboardStats {
    activeProjectsCount: number;
    assignedTasksCount: number;
    completedTasksCount: number;
    pendingReviewsCount: number;
    returnedTasksCount: number;
    overdueTasksCount: number;
    approachingTasksCount: number;
}

export interface TaskTimelineItem {
    id: string;
    activity_id: string;
    committee_id?: string;
    project_id?: string;
    title: string;
    name: string;
    description: string;
    status: string;
    due_date: string | null;
    due_date_raw: string | null;
    end_date: string | null;
    end_date_raw: string | null;
    start_date: string | null;
    start_date_raw: string | null;
    duration_days: number | null;
    requires_review: boolean;
    progress: number;
    is_completed: boolean;
    assigned_user: {
        id: number;
        name: string;
        email: string;
    } | null;
    parent_id: string;
    type: 'task';
}

export interface ActivityTimelineItem {
    id: string;
    project_id: string;
    committee_id: string;
    title: string;
    name: string;
    description: string;
    status: string;
    start_date: string | null;
    start_date_raw: string | null;
    due_date: string | null;
    due_date_raw: string | null;
    end_date: string | null;
    end_date_raw: string | null;
    duration_days: number | null;
    progress: number;
    total_tasks: number;
    completed_tasks: number;
    tasks: TaskTimelineItem[];
    parent_id: string;
    type: 'activity';
}

export interface CommitteeTimelineItem {
    id: string;
    project_id: string;
    name: string;
    description: string;
    start_date: string | null;
    start_date_raw: string | null;
    end_date: string | null;
    end_date_raw: string | null;
    duration_days: number | null;
    progress: number;
    total_activities: number;
    completed_activities: number;
    total_tasks: number;
    completed_tasks: number;
    activities: ActivityTimelineItem[];
    parent_id: string;
    type: 'committee';
}

export interface ProjectTimelineData {
    id: string;
    name: string;
    title: string;
    description: string;
    status: string;
    start_date: string | null;
    start_date_raw: string | null;
    end_date: string | null;
    end_date_raw: string | null;
    duration_days: number | null;
    progress: number;
    total_committees: number;
    total_activities: number;
    completed_activities: number;
    total_tasks: number;
    completed_tasks: number;
    committees: CommitteeTimelineItem[];
    parent_id: null;
    type: 'project';
}

