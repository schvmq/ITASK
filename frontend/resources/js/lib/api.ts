import axios, { AxiosInstance } from 'axios';

export interface UserProfile {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    email_verified_at: string | null;
    primaryRole: string;
    userRoles: string[];
}

export interface AuthResponse {
    message: string;
    user?: UserProfile;
    redirect?: string;
}

export interface ProjectListItem {
    id: string;
    title: string;
    description: string;
    status: string;
    role: string;
    progress: number;
    deadline: string;
    startDate: string | null;
    committeesCount: number;
    tasksCount: number;
    activitiesCount: number;
}

export interface ProjectDetail {
    id: string;
    title: string;
    description?: string;
    status: string;
    start_date?: string;
    end_date?: string;
    created_by: number;
    creator?: { id: number; name: string; email: string };
    role: string;
    progress: any;
    committees: Array<{
        id: number;
        name: string;
        description?: string;
        members_count: number;
    }>;
    personnel: Array<{
        id: number;
        user_id: number;
        user_name?: string;
        user_email?: string;
        role: string;
    }>;
}

export interface AdminUserItem {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    is_admin: boolean;
    created_at?: string;
    created_at_formatted?: string;
    assigned_tasks_count: number;
    created_projects_count: number;
    computed_roles: string[];
    project_role_assignments: Array<{
        id: number;
        project_id: number;
        project_title: string;
        role: string;
        committee_name?: string;
    }>;
}

export interface AdminProjectItem {
    id: number;
    title: string;
    description?: string;
    status: string;
    is_archived: boolean;
    created_by: number;
    creator_name: string;
    start_date?: string;
    target_date?: string;
    progress_percentage: number;
    total_activities: number;
    completed_activities: number;
    total_tasks: number;
    completed_tasks: number;
    committees_count: number;
    personnel_count: number;
}

export interface AdminMetrics {
    total_users: number;
    pending_verifications: number;
    verified_users: number;
    total_admins: number;
    total_projects: number;
    active_projects: number;
    archived_projects: number;
    total_activities: number;
    total_tasks: number;
}

export interface AdminDashboardData {
    users: AdminUserItem[];
    projects: AdminProjectItem[];
    metrics: AdminMetrics;
    settings: {
        announcement?: string;
    };
}

export interface ChecklistItemData {
    id: number | string;
    content: string;
    is_completed: boolean;
    order?: number;
}

export interface TaskEvidenceData {
    id: number | string;
    original_name: string;
    file_name?: string;
    file_size: number;
    mime_type?: string;
    remarks?: string;
    uploaded_at?: string;
    uploader?: { id: number; name: string };
}

export interface TaskDetail {
    id: number | string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    due_date?: string;
    requires_review: boolean;
    assigned_to?: number;
    assignee?: { id: number; name: string; email: string };
    checklist_items: ChecklistItemData[];
    evidences: TaskEvidenceData[];
    can?: {
        update: boolean;
        delete: boolean;
        updateStatus: boolean;
        manageChecklist: boolean;
        uploadEvidence: boolean;
        submitReview: boolean;
        review: boolean;
        resubmit: boolean;
    };
}

export interface ActivityDetail {
    id: number | string;
    title: string;
    description?: string;
    status: string;
    start_date?: string;
    end_date?: string;
    due_date?: string;
    progress: number;
    tasks_count: number;
    completed_tasks_count: number;
    tasks: TaskDetail[];
    can?: {
        update: boolean;
        delete: boolean;
        submit: boolean;
        review: boolean;
    };
}

export interface CommitteeDetail {
    id: number | string;
    name: string;
    description?: string;
    head?: { id: number; name: string; email: string };
    members: Array<{ id: number; name: string; email: string; progress?: number; tasks_count?: number }>;
    activities: ActivityDetail[];
    progress: number;
    can?: {
        update: boolean;
        delete: boolean;
        manageMembers: boolean;
        createActivity: boolean;
    };
}

export interface WorkspaceDashboardData {
    primary_role: string;
    stats: {
        activeProjectsCount: number;
        assignedTasksCount: number;
        completedTasksCount: number;
        pendingReviewsCount: number;
        returnedTasksCount: number;
        overdueTasksCount: number;
        approachingTasksCount: number;
    };
    projects: any[];
    committees: any[];
    assigned_tasks: any[];
    pending_reviews: any[];
    recent_notifications: any[];
    unread_notifications_count: number;
    announcement: string;
}

export interface MyTasksData {
    tasks: any[];
    role_context: {
        is_leader: boolean;
        is_staff: boolean;
        staff_committee_ids: number[];
        leader_project_ids: number[];
    };
}

export interface CalendarEvent {
    id: string;
    type: string;
    title: string;
    label: string;
    date: string;
    date_formatted: string;
    status?: string;
    role?: string;
    color_group: string;
    project?: { id: string; title: string };
    committee?: { id: string; name: string };
    activity?: { id: string; title: string };
    assignee?: { id: number; name: string } | null;
    is_mine?: boolean;
}

export interface NotificationItem {
    id: string;
    type: string;
    data: any;
    read_at: string | null;
    created_at: string;
    created_at_human?: string;
}

export interface ChatItem {
    id: number;
    chat_id: number;
    conversation_id: number;
    project_id: number;
    title: string;
    name: string;
    type: string;
    is_archived: boolean;
    is_pinned: boolean;
    is_muted: boolean;
    member_count: number;
    unread_count: number;
    preview: string;
    preview_time: string | null;
    updated_at: string;
}

export interface ChatMessage {
    id: number;
    chat_id: number;
    conversation_id?: number;
    sender_id: number | null;
    type: string;
    body: string;
    is_deleted: boolean;
    task_id?: number | null;
    task?: any;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: string | null;
    attachment_size?: number | null;
    created_at: string;
    sender?: { id: number; name: string; email?: string } | null;
}

export interface ChatIndexData {
    chats: ChatItem[];
    archived_chats: ChatItem[];
    active_chat: any;
    messages: ChatMessage[];
    project_members: Array<{ id: number; name: string; email: string }>;
    auth_user_id: number;
    total_unread_count: number;
}

const apiClient: AxiosInstance = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true,
});

export const api = {
    auth: {
        async login(credentials: { email: string; password: string; remember?: boolean }): Promise<AuthResponse> {
            const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
            return response.data;
        },

        async register(data: { name: string; email: string; password: string; password_confirmation: string }): Promise<AuthResponse> {
            const response = await apiClient.post<AuthResponse>('/auth/register', data);
            return response.data;
        },

        async logout(): Promise<{ message: string }> {
            const response = await apiClient.post<{ message: string }>('/auth/logout');
            return response.data;
        },

        async me(): Promise<{ user: UserProfile }> {
            const response = await apiClient.get<{ user: UserProfile }>('/auth/me');
            return response.data;
        },

        async resendVerification(): Promise<{ message: string }> {
            const response = await apiClient.post<{ message: string }>('/email/verification-notification');
            return response.data;
        },
    },

    projects: {
        async list(): Promise<{ projects: ProjectListItem[]; availableUsers: Array<{ id: number; name: string; email: string }> }> {
            const response = await apiClient.get('/projects');
            return response.data;
        },

        async create(formData: FormData): Promise<{ message: string; project: { id: string; title: string; status: string } }> {
            const response = await apiClient.post('/projects', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        },

        async get(id: string | number): Promise<{ project: ProjectDetail; can: { update: boolean; archive: boolean; manage_personnel: boolean } }> {
            const response = await apiClient.get(`/projects/${id}`);
            return response.data;
        },

        async update(id: string | number, data: { title?: string; description?: string; status?: string; start_date?: string; end_date?: string }): Promise<{ message: string }> {
            const response = await apiClient.put(`/projects/${id}`, data);
            return response.data;
        },

        async archive(id: string | number): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${id}/archive`);
            return response.data;
        },

        async unarchive(id: string | number): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${id}/unarchive`);
            return response.data;
        },

        async delete(id: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${id}`);
            return response.data;
        },

        async assignPersonnel(id: string | number, data: { user_id: number; role: string }): Promise<{ message: string; assignment: any }> {
            const response = await apiClient.post(`/projects/${id}/personnel`, data);
            return response.data;
        },

        async removePersonnel(id: string | number, userId: number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${id}/personnel/${userId}`);
            return response.data;
        },
    },

    admin: {
        async getDashboard(params?: { search?: string; role?: string; tab?: string }): Promise<AdminDashboardData> {
            const response = await apiClient.get<AdminDashboardData>('/admin/dashboard', { params });
            return response.data;
        },

        async verifyUser(userId: number): Promise<{ message: string }> {
            const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/verify`);
            return response.data;
        },

        async denyUser(userId: number): Promise<{ message: string }> {
            const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/deny`);
            return response.data;
        },

        async toggleAdmin(userId: number): Promise<{ message: string; is_admin: boolean }> {
            const response = await apiClient.post<{ message: string; is_admin: boolean }>(`/admin/users/${userId}/toggle-admin`);
            return response.data;
        },

        async updateRole(userId: number, data: { is_admin?: boolean; project_id?: number; role?: string; remove_assignment_id?: number }): Promise<{ message: string }> {
            const response = await apiClient.post<{ message: string }>(`/admin/users/${userId}/role`, data);
            return response.data;
        },

        async deleteUser(userId: number): Promise<{ message: string }> {
            const response = await apiClient.delete<{ message: string }>(`/admin/users/${userId}`);
            return response.data;
        },

        async toggleProjectArchive(projectId: number): Promise<{ message: string; status: string; is_archived: boolean }> {
            const response = await apiClient.post<{ message: string; status: string; is_archived: boolean }>(`/admin/projects/${projectId}/toggle-archive`);
            return response.data;
        },

        async updateSettings(data: { announcement: string }): Promise<{ message: string; announcement: string }> {
            const response = await apiClient.post<{ message: string; announcement: string }>('/admin/settings', data);
            return response.data;
        },
    },

    committees: {
        async create(projectId: string | number, data: { name: string; description?: string; user_id?: number }): Promise<{ message: string; committee: any }> {
            const response = await apiClient.post(`/projects/${projectId}/committees`, data);
            return response.data;
        },
        async get(projectId: string | number, committeeId: string | number): Promise<{ committee: CommitteeDetail }> {
            const response = await apiClient.get(`/projects/${projectId}/committees/${committeeId}`);
            return response.data;
        },
        async update(projectId: string | number, committeeId: string | number, data: { name: string; description?: string; user_id?: string | number }): Promise<{ message: string; committee: any }> {
            const response = await apiClient.put(`/projects/${projectId}/committees/${committeeId}`, data);
            return response.data;
        },
        async delete(projectId: string | number, committeeId: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}`);
            return response.data;
        },
        async assignStaff(projectId: string | number, committeeId: string | number, data: { user_id: number | string }): Promise<{ message: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/staff`, data);
            return response.data;
        },
        async assignMember(projectId: string | number, committeeId: string | number, data: { user_id?: number; user_ids?: number[] }): Promise<{ message: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/members`, data);
            return response.data;
        },
        async removeMember(projectId: string | number, committeeId: string | number, userId: number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}/members/${userId}`);
            return response.data;
        },
    },

    activities: {
        async create(projectId: string | number, committeeId: string | number, data: { title: string; description?: string; start_date?: string; end_date?: string }): Promise<{ message: string; activity: any }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities`, data);
            return response.data;
        },
        async get(projectId: string | number, committeeId: string | number, activityId: string | number): Promise<{ activity: ActivityDetail }> {
            const response = await apiClient.get(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}`);
            return response.data;
        },
        async update(projectId: string | number, committeeId: string | number, activityId: string | number, data: { title?: string; description?: string; start_date?: string; end_date?: string; status?: string }): Promise<{ message: string; activity: any }> {
            const response = await apiClient.put(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}`, data);
            return response.data;
        },
        async delete(projectId: string | number, committeeId: string | number, activityId: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}`);
            return response.data;
        },
        async submit(projectId: string | number, committeeId: string | number, activityId: string | number, data?: { submission_notes?: string }): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/submit`, data ?? {});
            return response.data;
        },
        async review(projectId: string | number, committeeId: string | number, activityId: string | number, data: { action: string; review_feedback?: string }): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/review`, data);
            return response.data;
        },
    },

    tasks: {
        async create(projectId: string | number, committeeId: string | number, activityId: string | number, data: { title: string; description?: string; due_date?: string; assigned_to?: number; requires_review?: boolean; priority?: string }): Promise<{ message: string; task: any }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks`, data);
            return response.data;
        },
        async update(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, data: { title?: string; description?: string; due_date?: string; assigned_to?: number; requires_review?: boolean; status?: string; priority?: string }): Promise<{ message: string; task: any }> {
            const response = await apiClient.put(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}`, data);
            return response.data;
        },
        async delete(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}`);
            return response.data;
        },
        async submit(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/submit`);
            return response.data;
        },
        async approve(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/approve`);
            return response.data;
        },
        async return(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, data: { reviewer_notes?: string; review_feedback?: string }): Promise<{ message: string; status: string; review_feedback?: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/return`, data);
            return response.data;
        },
        async resubmit(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number): Promise<{ message: string; status: string }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/resubmit`);
            return response.data;
        },
    },

    checklist: {
        async create(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, data: { content: string }): Promise<{ message: string; item: ChecklistItemData }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/checklist`, data);
            return response.data;
        },
        async update(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, checklistItemId: string | number, data: { content?: string; is_completed?: boolean }): Promise<{ message: string; item: ChecklistItemData }> {
            const response = await apiClient.put(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/checklist/${checklistItemId}`, data);
            return response.data;
        },
        async delete(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, checklistItemId: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/checklist/${checklistItemId}`);
            return response.data;
        },
    },

    evidence: {
        async upload(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, formData: FormData): Promise<{ message: string; evidence: TaskEvidenceData }> {
            const response = await apiClient.post(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/evidence`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        },
        downloadUrl(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, evidenceId: string | number): string {
            return `/api/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/evidence/${evidenceId}/download`;
        },
        async delete(projectId: string | number, committeeId: string | number, activityId: string | number, taskId: string | number, evidenceId: string | number): Promise<{ message: string }> {
            const response = await apiClient.delete(`/projects/${projectId}/committees/${committeeId}/activities/${activityId}/tasks/${taskId}/evidence/${evidenceId}`);
            return response.data;
        },
    },

    workspace: {
        async getDashboard(): Promise<WorkspaceDashboardData> {
            const response = await apiClient.get<WorkspaceDashboardData>('/workspace/dashboard');
            return response.data;
        },
        async getMyTasks(): Promise<MyTasksData> {
            const response = await apiClient.get<MyTasksData>('/workspace/my-tasks');
            return response.data;
        },
        async getCalendar(): Promise<{ events: CalendarEvent[] }> {
            const response = await apiClient.get<{ events: CalendarEvent[] }>('/workspace/calendar');
            return response.data;
        },
        async getTimeline(): Promise<{ projects: any[] }> {
            const response = await apiClient.get<{ projects: any[] }>('/workspace/timeline');
            return response.data;
        },
        async getProjectTimeline(projectId: string | number): Promise<{ success: boolean; data: any }> {
            const response = await apiClient.get<{ success: boolean; data: any }>(`/projects/${projectId}/timeline`);
            return response.data;
        },
    },

    notifications: {
        async list(page = 1): Promise<{ notifications: { data: NotificationItem[]; current_page: number; last_page: number; total: number }; unread_count: number }> {
            const response = await apiClient.get('/notifications', { params: { page } });
            return response.data;
        },
        async markAsRead(notificationId: string): Promise<{ success: boolean; unread_count: number }> {
            const response = await apiClient.post(`/notifications/${notificationId}/read`);
            return response.data;
        },
        async markAllAsRead(): Promise<{ success: boolean; unread_count: number }> {
            const response = await apiClient.post('/notifications/mark-all-read');
            return response.data;
        },
    },

    chat: {
        async getChats(projectId?: string | number): Promise<ChatIndexData> {
            const url = projectId ? `/chat/${projectId}` : '/chat';
            const response = await apiClient.get<ChatIndexData>(url);
            return response.data;
        },
        async sendMessage(chatId: string | number, data: FormData | { body: string }): Promise<ChatMessage> {
            const isFormData = data instanceof FormData;
            const response = await apiClient.post<ChatMessage>(`/chat/${chatId}/messages`, data, {
                headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
            });
            return response.data;
        },
        async deleteMessage(chatId: string | number, messageId: string | number): Promise<{ success: boolean; message_id: number }> {
            const response = await apiClient.post<{ success: boolean; message_id: number }>(`/chat/${chatId}/messages/${messageId}/delete`);
            return response.data;
        },
        async restoreMessage(chatId: string | number, messageId: string | number): Promise<{ success: boolean; message_id: number }> {
            const response = await apiClient.post<{ success: boolean; message_id: number }>(`/chat/${chatId}/messages/${messageId}/restore`);
            return response.data;
        },
        async createTask(chatId: string | number, data: { title: string; description?: string; assignee_ids: number[]; due_date: string; priority: string; idempotency_key?: string }): Promise<{ success: boolean; task: any; message: any }> {
            const response = await apiClient.post<{ success: boolean; task: any; message: any }>(`/chat/${chatId}/tasks`, data);
            return response.data;
        },
        async markAsRead(chatId: string | number, lastReadMessageId?: number): Promise<{ success: boolean; last_read_message_id: number | null; read_at: string | null }> {
            const response = await apiClient.post<{ success: boolean; last_read_message_id: number | null; read_at: string | null }>(`/chat/${chatId}/read`, {
                last_read_message_id: lastReadMessageId,
            });
            return response.data;
        },
        async togglePin(chatId: string | number): Promise<{ success: boolean; is_pinned: boolean }> {
            const response = await apiClient.post<{ success: boolean; is_pinned: boolean }>(`/chat/${chatId}/pin`);
            return response.data;
        },
        async toggleMute(chatId: string | number): Promise<{ success: boolean; is_muted: boolean }> {
            const response = await apiClient.post<{ success: boolean; is_muted: boolean }>(`/chat/${chatId}/mute`);
            return response.data;
        },
        downloadAttachmentUrl(messageId: string | number): string {
            return `/api/chat/attachments/${messageId}`;
        },
    },

    client: apiClient,
};

export default api;
