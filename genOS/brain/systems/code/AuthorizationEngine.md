# AuthorizationEngine

## Purpose
Enforces centralized role-based access control (RBAC), permission registries, and security policies across all projects, committees, activities, and tasks.

## Status
`stable`

## Responsibilities
- Centralized role registry (`ROLE_ADMIN`, `ROLE_PROJECT_LEADER`, `ROLE_PROJECT_STAFF`, `ROLE_PROJECT_MEMBER`).
- Granular permission registry defining operational capabilities.
- Delegating Laravel Policies to the single `AuthorizationService`.
- Multi-committee membership authorization resolution.

## Dependencies
- [[Authentication]]
- [[ProjectAndCommitteeManagement]]

## Runtime References
- `backend/app/Services/Authorization/AuthorizationService.php`
- `backend/app/Services/Authorization/RoleRegistry.php`
- `backend/app/Services/Authorization/PermissionRegistry.php`
- `backend/app/Policies/ProjectPolicy.php`
- `backend/app/Policies/CommitteePolicy.php`

## Invariants
- Project Leaders hold administrative authority within their assigned projects.
- Committee Staff (Leads) only have managerial and review rights over their assigned committees.
- Regular Project Members cannot approve or return deliverables.

## Notes
- Fully decoupled from controller logic; all policy gates delegate directly to `AuthorizationService`.

