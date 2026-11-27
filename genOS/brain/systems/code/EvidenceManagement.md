# EvidenceManagement

## Purpose
Manages Means of Verification (MOV) documents, attachments, and file uploads directly tied to task deliverables for accreditation and auditing.

## Status
`stable`

## Responsibilities
- Secure upload, storage, and retrieval of task evidence documents (PDFs, images, archives).
- Associating uploaded evidence files with specific task completion submissions.
- Providing downloadable and viewable evidence files for committee review.

## Dependencies
- [[TaskAndChecklistEngine]]
- [[Authentication]]

## Runtime References
- `backend/app/Models/TaskEvidence.php`
- `backend/app/Http/Controllers/TaskController.php`
- `backend/storage/app/task_evidences/`

## Invariants
- Only assigned members, committee staff, or project leaders can upload evidence to a task.
- Uploaded evidence files must retain their original metadata, uploader attribution, and submission timestamp.
- File downloads must verify workspace authorization before streaming file contents.

