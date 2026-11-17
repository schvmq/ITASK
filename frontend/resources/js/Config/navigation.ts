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
    MessageSquare,
    Shield,
    Crown,
    Zap,
    PlusCircle,
    FileCheck,
    ShieldCheck,
} from 'lucide-react';

// ─── Project-Scoped Roles ────────────────────────────────────────────────────
export type ProjectRole = 'Project Leader' | 'Project Committee' | 'Committee Staff' | 'Project Staff' | 'Project Member';

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
    'Project Leader': 'Overall Chair',
    'Project Committee': 'Chairperson',
    'Committee Staff': 'Member',
    'Project Staff': 'Chairperson',
    'Project Member': 'Member',
};

export function formatRole(role?: string | null): string {
    if (!role) return '';
    return ROLE_DISPLAY_NAMES[role] || role;
}

// ─── Navigation Item Interface ───────────────────────────────────────────────
export interface NavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    /** Optional: mark as coming soon */
    comingSoon?: boolean;
    /** Optional exact match for active route detection */
    exact?: boolean;
    /** Optional badge count key */
    countKey?: 'projects' | 'tasks' | 'messages' | 'notifications' | 'reviews';
    /** Optional badge text or count override */
    badge?: string;
    /** Roles that prioritize or see this item */
    allowedRoles?: ProjectRole[];
    /** Supporting description */
    description?: string;
    /** Role-specific badge indicator */
    roleTag?: string;
    /** If this item is specially highlighted for a role */
    highlightForRole?: ProjectRole;
}

export interface RoleQuickAction {
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    href?: string;
    actionEvent?: string;
}

export interface RoleConfig {
    role: ProjectRole;
    shortTitle: string;
    tagline: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    quickActions: RoleQuickAction[];
}

export const ROLE_CONFIGS: Record<ProjectRole, RoleConfig> = {
    'Project Leader': {
        role: 'Project Leader',
        shortTitle: 'Overall Chair',
        tagline: 'Event Governance, Scope & Timeline',
        icon: Crown,
        accentColor: '#4F46E5', // Indigo
        badgeBg: 'rgba(79, 70, 229, 0.12)',
        badgeBorder: 'rgba(79, 70, 229, 0.35)',
        badgeText: '#4338CA',
        quickActions: [
            {
                name: 'New Event',
                description: 'Initiate a new CCIS event workspace',
                icon: PlusCircle,
                actionEvent: 'itask:open-create-project',
            },
            {
                name: 'Manage Committees',
                description: 'Organize event committees & assign members',
                icon: Users,
                href: '/projects',
            },
            {
                name: 'Timeline & Gantt',
                description: 'Track overall event schedule & milestones',
                icon: GanttChartSquare,
                href: '/timeline',
            },
        ],
    },
    'Project Committee': {
        role: 'Project Committee',
        shortTitle: 'Chairperson',
        tagline: 'Committee Operations, Deliverables & Review',
        icon: Shield,
        accentColor: '#059669', // Emerald
        badgeBg: 'rgba(5, 150, 105, 0.12)',
        badgeBorder: 'rgba(5, 150, 105, 0.35)',
        badgeText: '#047857',
        quickActions: [
            {
                name: 'Review Submissions',
                description: 'Inspect tasks & deliverables awaiting approval',
                icon: FileCheck,
                href: '/my-tasks?status=Under+Review',
            },
            {
                name: 'Assign Committee Members',
                description: 'Assign members to committee deliverables',
                icon: Users,
                href: '/projects',
            },
            {
                name: 'Committee Hub',
                description: 'Monitor committee deliverables and tasks',
                icon: FolderOpen,
                href: '/projects',
            },
        ],
    },
    'Committee Staff': {
        role: 'Committee Staff',
        shortTitle: 'Member',
        tagline: 'Tasks, Checklists & Deliverables',
        icon: Zap,
        accentColor: '#EA580C', // Orange
        badgeBg: 'rgba(234, 88, 12, 0.12)',
        badgeBorder: 'rgba(234, 88, 12, 0.35)',
        badgeText: '#C2410C',
        quickActions: [
            {
                name: 'My Assigned Tasks',
                description: 'Focus on your pending deliverables & checklists',
                icon: CheckSquare,
                href: '/my-tasks',
            },
            {
                name: 'Deadlines Calendar',
                description: 'Check dates, approaching milestones & urgency',
                icon: CalendarDays,
                href: '/calendar',
            },
            {
                name: 'Event Messages',
                description: 'Collaborate with committee & team members',
                icon: MessageSquare,
                href: '/messages',
            },
        ],
    },
    'Project Staff': {
        role: 'Project Staff',
        shortTitle: 'Chairperson',
        tagline: 'Committee Operations, Deliverables & Review',
        icon: Shield,
        accentColor: '#059669', // Emerald
        badgeBg: 'rgba(5, 150, 105, 0.12)',
        badgeBorder: 'rgba(5, 150, 105, 0.35)',
        badgeText: '#047857',
        quickActions: [
            {
                name: 'Review Submissions',
                description: 'Inspect tasks & deliverables awaiting approval',
                icon: FileCheck,
                href: '/my-tasks?status=Under+Review',
            },
            {
                name: 'New Committee Task',
                description: 'Assign a task with checklist to members',
                icon: ListTodo,
                actionEvent: 'itask:open-create-task',
            },
            {
                name: 'Committee Hub',
                description: 'Monitor committee deliverables and tasks',
                icon: FolderOpen,
                href: '/projects',
            },
        ],
    },
    'Project Member': {
        role: 'Project Member',
        shortTitle: 'Member',
        tagline: 'Tasks, Interactive Checklists & Deliverables',
        icon: Zap,
        accentColor: '#EA580C', // Orange
        badgeBg: 'rgba(234, 88, 12, 0.12)',
        badgeBorder: 'rgba(234, 88, 12, 0.35)',
        badgeText: '#C2410C',
        quickActions: [
            {
                name: 'My Assigned Tasks',
                description: 'Focus on your pending deliverables & checklists',
                icon: CheckSquare,
                href: '/my-tasks',
            },
            {
                name: 'Deadlines Calendar',
                description: 'Check dates, approaching milestones & urgency',
                icon: CalendarDays,
                href: '/calendar',
            },
            {
                name: 'Event Messages',
                description: 'Collaborate with committee & team members',
                icon: MessageSquare,
                href: '/messages',
            },
        ],
    },
};

// ─── Centralized Global Navigation (identical for all three roles) ─────────
export const GLOBAL_NAV_ITEMS: NavItem[] = [
    {
        name: 'Home',
        href: '/dashboard',
        icon: LayoutDashboard,
        exact: true,
        description: 'Workspace overview and recent activity',
    },
    {
        name: 'My Tasks',
        href: '/my-tasks',
        icon: CheckSquare,
        countKey: 'tasks',
        description: 'Personal task assignments and checklists',
    },
    {
        name: 'Events',
        href: '/projects',
        icon: FolderOpen,
        countKey: 'projects',
        description: 'Events and committees directory',
    },
    {
        name: 'Timeline',
        href: '/timeline',
        icon: GanttChartSquare,
        description: 'Gantt schedule and milestone roadmap',
    },
    {
        name: 'Calendar',
        href: '/calendar',
        icon: CalendarDays,
        description: 'Event deadlines and schedule',
    },
    {
        name: 'Messages',
        href: '/messages',
        icon: MessageSquare,
        countKey: 'messages',
        description: 'Event messaging and group chats',
    },
    {
        name: 'Notifications',
        href: '/notifications',
        icon: Bell,
        countKey: 'notifications',
        description: 'Alerts, reviews, and activity updates',
    },
];

// Deprecated aliases pointing to GLOBAL_NAV_ITEMS to prevent broken imports
export const LEADER_NAV_ITEMS: NavItem[] = GLOBAL_NAV_ITEMS;
export const STAFF_NAV_ITEMS: NavItem[] = GLOBAL_NAV_ITEMS;
export const MEMBER_NAV_ITEMS: NavItem[] = GLOBAL_NAV_ITEMS;
export const DEFAULT_NAV_ITEMS: NavItem[] = GLOBAL_NAV_ITEMS;

export const ADMIN_NAV_ITEMS: NavItem[] = [
    {
        name: 'User Management',
        href: '/admin/dashboard',
        icon: Users,
        exact: true,
        description: 'Account directory, approval decisions, and privileges',
    },
    {
        name: 'Pending Registrations',
        href: '/admin/dashboard?tab=pending',
        icon: UserCheck,
        description: 'Review, verify, or deny new student & staff accounts',
    },
];

export const ADMIN_NAV_ITEM: NavItem = {
    name: 'User Management',
    href: '/admin/dashboard',
    icon: ShieldCheck,
    exact: true,
    description: 'User accounts, verification & role directory',
};

/**
 * Returns role-tailored navigation items (admin has dedicated dashboard, all three roles share identical 7 tabs)
 */
export function getNavigationForRole(role?: string | null, isAdmin?: boolean): NavItem[] {
    if (isAdmin) {
        return [...ADMIN_NAV_ITEMS];
    }
    return [...GLOBAL_NAV_ITEMS];
}

