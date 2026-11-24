# ProjectAndCommitteeManagement

## Purpose
Governs project workspaces, committee structures, personnel assignments, and approval document management.

## Status
`stable`

## Responsibilities
- Creating, updating, archiving, and restoring project workspaces.
- Managing committee creation and staff assignments.
- Managing project approval documents and institutional metadata.
- Enforcing soft deletes for safe recovery.

## Dependencies
- [[AuthorizationEngine]]
- [[Authentication]]

## Runtime References
- `backend/app/Models/Project.php`
- `backend/app/Models/Committee.php`
- `backend/app/Models/ProjectRoleAssignment.php`
- `backend/app/Http/Controllers/ProjectController.php`
- `backend/app/Http/Controllers/CommitteeController.php`
- `frontend/resources/js/Pages/Projects/Index.tsx`
- `frontend/resources/js/Pages/Projects/Show.tsx`

## Invariants
- A committee must always belong to an active project.
- A project must have at least one designated Project Leader.
- Archived projects are read-only until unarchived by authorized personnel.

