# TimelineAndGantt

## Purpose
Renders visual Gantt schedules, activity milestones, and calendar views for cross-committee schedule tracking and bottleneck detection.

## Status
`stable`

## Responsibilities
- Rendering project and activity timeline bars based on start and due dates.
- Calculating progress percentages and visual status indicators (on track, due soon, overdue).
- Displaying personal and project-wide deadlines in a monthly/weekly calendar grid.

## Dependencies
- [[TaskAndChecklistEngine]]
- [[ProjectAndCommitteeManagement]]

## Runtime References
- `backend/app/Http/Controllers/ProjectTimelineController.php`
- `backend/app/Http/Controllers/CalendarController.php`
- `frontend/resources/js/Pages/Timeline/Index.tsx`
- `frontend/resources/js/Pages/Calendar/Index.tsx`

## Invariants
- Timeline bars must accurately reflect activity start dates and due dates.
- Tasks without dates default to the parent activity's target window.

