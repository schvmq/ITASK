<?php

namespace App\Services\Authorization;

class RoleRegistry
{
    public const ROLE_PROJECT_LEADER = 'Project Leader';
    public const ROLE_PROJECT_COMMITTEE = 'Project Committee';
    public const ROLE_COMMITTEE_STAFF = 'Committee Staff';

    // Legacy aliases for backward compatibility
    public const ROLE_PROJECT_STAFF = 'Project Staff';
    public const ROLE_PROJECT_MEMBER = 'Project Member';

    public const PROJECT_ROLES = [
        self::ROLE_PROJECT_LEADER,
        self::ROLE_PROJECT_COMMITTEE,
        self::ROLE_COMMITTEE_STAFF,
        self::ROLE_PROJECT_STAFF,
        self::ROLE_PROJECT_MEMBER,
    ];

    /**
     * Check if a role string is a valid project role.
     */
    public static function isValidProjectRole(?string $role): bool
    {
        return in_array($role, self::PROJECT_ROLES, true);
    }
}
