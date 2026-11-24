# TaskAndChecklistEngine

## Purpose
Drives the operational task lifecycle: activity creation, task assignments, interactive checklist items, submission gates, and review loops.

## Status
`stable`

## Responsibilities
- Breaking down committee operations into distinct Activities.
- Assigning tasks to members with due dates, descriptions, and review requirements.
- Managing atomic checklist items with live progress percentage calculation.
- Transitioning task statuses: `To Do` -> `In Progress` -> `Under Review` -> `Completed` / `Returned`.

## Dependencies
- [[ProjectAndCommitteeManagement]]
- [[EvidenceManagement]]
- [[AuthorizationEngine]]

## Runtime References
- `backend/app/Models/Activity.php`
- `backend/app/Models/Task.php`
- `backend/app/Models/ChecklistItem.php`
- `backend/app/Http/Controllers/TaskController.php`
- `backend/app/Http/Controllers/ChecklistItemController.php`
- `frontend/resources/js/Pages/MyTasks/Index.tsx`
- `frontend/resources/js/Pages/Activities/Show.tsx`

## Invariants
- Tasks marked `requires_review = true` cannot transition directly to `Completed` by the assignee; they must enter `Under Review` and be approved by Committee Staff or Leader.
- Checklist progress recalculates in real-time upon checking/unchecking items.
- A returned task preserves previous feedback comments for iterative revision.

