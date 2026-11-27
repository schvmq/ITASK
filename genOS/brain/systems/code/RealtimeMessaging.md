# RealtimeMessaging

## Purpose
Provides project-scoped group messaging and real-time collaboration using Laravel Reverb WebSockets.

## Status
`stable`

## Responsibilities
- Project-level channel broadcasting via WebSockets.
- Message persistence, attachments, read receipts, and soft deletes.
- Live typing indicators and pin/mute toggles.

## Dependencies
- [[Authentication]]
- [[ProjectAndCommitteeManagement]]

## Runtime References
- `backend/app/Http/Controllers/ChatController.php`
- `backend/app/Models/Conversation.php`
- `backend/app/Models/Message.php`
- `frontend/resources/js/Pages/Chat/Index.tsx`
- `frontend/resources/js/Pages/Messages/Index.tsx`

## Invariants
- Chat messages are scoped strictly to verified members of the parent project.
- Client events must be authorized via Sanctum broadcast authentication before broadcasting.

