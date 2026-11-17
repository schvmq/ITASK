export type PermissionAction =
    | 'view_tabs'
    | 'create_project'
    | 'edit_project'
    | 'delete_project'
    | 'invite_members'
    | 'remove_members'
    | 'create_tasks'
    | 'assign_tasks'
    | 'edit_own_task'
    | 'edit_others_task'
    | 'drag_gantt'
    | 'send_messages';

export interface CanResult {
    allowed: boolean;
    reason?: string;
}

export interface UserLike {
    id?: number | string;
    name?: string;
    email?: string;
    is_admin?: boolean;
    primaryRole?: string;
    role?: string;
    userRoles?: string[];
}

/**
 * Centralized authorization check for UI action gating.
 * Implements the unified permission matrix:
 *
 * | Action                   | Project Leader | Project Member        | Project Staff |
 * |--------------------------|----------------|-----------------------|---------------|
 * | View all 7 tabs          | Yes            | Yes                   | Yes           |
 * | Create project           | Yes            | No                    | No            |
 * | Edit/delete project      | Own projects   | No                    | No            |
 * | Invite/remove members    | Yes            | No                    | No            |
 * | Create tasks             | Yes            | Yes                   | No            |
 * | Assign tasks to others   | Yes            | Yes (within project)  | No            |
 * | Edit own assigned tasks  | Yes            | Yes                   | Yes           |
 * | Edit others' tasks/dates | Yes            | Limited               | No            |
 * | Drag Gantt bars          | Yes            | Own tasks             | No            |
 * | Send messages            | Yes            | Yes                   | Yes           |
 */
export function can(
    user: UserLike | null | undefined,
    action: PermissionAction,
    resource?: any
): CanResult {
    if (!user) {
        return { allowed: false, reason: 'You must be signed in to perform this action.' };
    }

    if (user.is_admin) {
        if (action === 'create_project' || action === 'create_tasks' || action === 'drag_gantt') {
            return {
                allowed: false,
                reason: 'System Administrators manage accounts and system settings; event management actions are reserved for event personnel.',
            };
        }
    }

    const currentRole = user.primaryRole || user.role || 'Project Member';
    const hasLeaderRole =
        currentRole === 'Project Leader' ||
        currentRole === 'Overall Chair' ||
        (Array.isArray(user.userRoles) && (user.userRoles.includes('Project Leader') || user.userRoles.includes('Overall Chair')));
    const isStaff = currentRole === 'Project Staff' || currentRole === 'Chairperson';
    const isMember = currentRole === 'Project Member' || currentRole === 'Member';

    switch (action) {
        case 'view_tabs':
            return { allowed: true };

        case 'create_project': {
            if (user.is_admin) {
                return {
                    allowed: false,
                    reason: 'System Administrators manage accounts and system settings; event management actions are reserved for event personnel.',
                };
            }
            return { allowed: true };
        }

        case 'edit_project':
        case 'delete_project': {
            if (hasLeaderRole) {
                if (resource && resource.created_by && Number(resource.created_by) !== Number(user.id)) {
                    return { allowed: false, reason: 'You can only manage events you created or lead as Overall Chair.' };
                }
                return { allowed: true };
            }
            return {
                allowed: false,
                reason: 'Only Overall Chairs can modify or delete events.',
            };
        }

        case 'invite_members':
        case 'remove_members': {
            if (hasLeaderRole) {
                return { allowed: true };
            }
            return {
                allowed: false,
                reason: 'Only Overall Chairs can invite or remove team members.',
            };
        }

        case 'create_tasks': {
            if (isStaff) {
                return {
                    allowed: false,
                    reason: 'Chairpersons cannot create new tasks. Contact your Overall Chair.',
                };
            }
            return { allowed: true };
        }

        case 'assign_tasks': {
            if (isStaff) {
                return {
                    allowed: false,
                    reason: 'Chairpersons cannot assign tasks to others.',
                };
            }
            return { allowed: true };
        }

        case 'edit_own_task': {
            return { allowed: true };
        }

        case 'edit_others_task': {
            if (hasLeaderRole) {
                return { allowed: true };
            }
            if (isMember) {
                return { allowed: true };
            }
            return {
                allowed: false,
                reason: 'Chairpersons cannot modify other members’ tasks.',
            };
        }

        case 'drag_gantt': {
            if (hasLeaderRole) {
                return { allowed: true };
            }
            if (isMember) {
                const isOwnTask =
                    resource &&
                    (Number(resource.assigned_to) === Number(user.id) ||
                        Boolean(resource.is_mine) ||
                        (Array.isArray(resource.assignee_ids) && resource.assignee_ids.includes(Number(user.id))));
                if (isOwnTask) {
                    return { allowed: true };
                }
                return {
                    allowed: false,
                    reason: 'Members can only drag and schedule their own assigned tasks.',
                };
            }
            return {
                allowed: false,
                reason: 'Chairpersons cannot drag Gantt chart schedule bars.',
            };
        }

        case 'send_messages': {
            return { allowed: true };
        }

        default:
            return { allowed: true };
    }
}
