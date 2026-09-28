import React from 'react';
import {
    LayoutDashboard,
    FolderOpen,
    CheckSquare,
    CalendarDays,
    GanttChartSquare,
    Bell,
    Settings,
    Users,
    UserCheck,
    ClipboardCheck,
    ListTodo,
    Send,
    Sparkles,
} from 'lucide-react';

// ─── Project-Scoped Roles ────────────────────────────────────────────────────
// Exactly three project-scoped roles defined for ITASK:
export type ProjectRole = 'Project Leader' | 'Project Staff' | 'Project Member';

// ─── Navigation Item Interface ───────────────────────────────────────────────
export interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Optional: mark as coming soon (renders as disabled with tooltip) */
    comingSoon?: boolean;
    /** Optional exact match for active route detection */
    exact?: boolean;
    /** Optional badge count or indicator */
    badge?: string;
    /**
     * Architectural metadata for future role-scoped navigation.
     * When a project context is active in future development steps, items can declare
     * which project-scoped roles have access to them.
     * Backend remains the source of truth for all authorization.
     */
    allowedRoles?: ProjectRole[];
    /** Supporting description for tooltips or expanded menus */
    description?: string;
}

// ─── Centralized Main Navigation ─────────────────────────────────────────────
// Usable by all authenticated users. Projects is now an active page.
export const MAIN_NAV_ITEMS: NavItem[] = [
    {
        name: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        exact: true,
        description: 'Your ITASK workspace overview',
    },
    {
        name: 'Projects',
        href: '/projects',
        icon: FolderOpen,
        description: 'CCIS projects where you hold an active role',
    },
    {
        name: 'My Tasks',
        href: '#tasks',
        icon: CheckSquare,
        comingSoon: true,
        description: 'Tasks assigned to you across all projects',
    },
    {
        name: 'Calendar',
        href: '#calendar',
        icon: CalendarDays,
        comingSoon: true,
        description: 'Upcoming project deadlines and milestones',
    },
    {
        name: 'Timeline',
        href: '#timeline',
        icon: GanttChartSquare,
        comingSoon: true,
        description: 'CCIS project schedules and Gantt timelines',
    },
];

// ─── Centralized Utility Navigation ──────────────────────────────────────────
export const UTILITY_NAV_ITEMS: NavItem[] = [
    {
        name: 'Notifications',
        href: '#notifications',
        icon: Bell,
        comingSoon: true,
        description: 'Activity alerts and role updates',
    },
];

// ─── Architectural Placeholders for Future Project-Scoped Actions ─────────────
// DO NOT enforce or display these yet — these exist as extension points for future steps
// when a specific project context is active.
export const FUTURE_PROJECT_SCOPED_NAV: Record<ProjectRole, NavItem[]> = {
    'Project Leader': [
        {
            name: 'Manage Project',
            href: '#manage-project',
            icon: Settings,
            description: 'Project settings, charter, and scope management',
        },
        {
            name: 'Manage Committees',
            href: '#manage-committees',
            icon: Users,
            description: 'Committee formation and staff assignments',
        },
        {
            name: 'Project Assignments',
            href: '#project-assignments',
            icon: UserCheck,
            description: 'Overall project member assignment overview',
        },
    ],
    'Project Staff': [
        {
            name: 'Manage Assigned Committee',
            href: '#manage-assigned-committee',
            icon: Users,
            description: 'Committee members and operational deliverables',
        },
        {
            name: 'Review Activities',
            href: '#review-activities',
            icon: ClipboardCheck,
            description: 'Review and approve submitted member activity reports',
        },
        {
            name: 'Manage Committee Tasks',
            href: '#manage-committee-tasks',
            icon: ListTodo,
            description: 'Task assignment and progress monitoring',
        },
    ],
    'Project Member': [
        {
            name: 'My Assigned Work',
            href: '#assigned-work',
            icon: CheckSquare,
            description: 'Deliverables and tasks assigned to you',
        },
        {
            name: 'Submit Activities',
            href: '#submit-activities',
            icon: Send,
            description: 'Submit proof of completion and activity reports',
        },
        {
            name: 'Update Task Progress',
            href: '#update-task-progress',
            icon: Sparkles,
            description: 'Log progress percentage and task milestones',
        },
    ],
};

// ─── Navigation Resolver Helper ──────────────────────────────────────────────
export interface GetNavigationOptions {
    /** Future role from backend when inside a project context; currently optional / unused */
    currentRole?: ProjectRole | null;
}

/**
 * Returns navigation items for the current session.
 * NOTE: The backend remains the source of truth for authorization.
 * Currently returns universal main navigation for all authenticated users.
 */
export function getNavigationItems(_options?: GetNavigationOptions): NavItem[] {
    return MAIN_NAV_ITEMS;
}
