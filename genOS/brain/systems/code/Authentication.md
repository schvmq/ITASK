# Authentication

## Purpose
Manages user identity, secure credential hashing, institutional email verification (`@carsu.edu.ph`), and session handling across the application.

## Status
`stable`

## Responsibilities
- User registration, login, and logout.
- Enforcing institutional email domain verification.
- Password hashing with Bcrypt rounds.
- Session persistence and CSRF token verification.

## Dependencies
- [[AuthorizationEngine]]
- [[FrontendSPA]]

## Runtime References
- `backend/app/Http/Controllers/AuthController.php`
- `backend/app/Models/User.php`
- `frontend/resources/js/Pages/Auth/Login.tsx`
- `frontend/resources/js/Pages/Auth/Register.tsx`

## Invariants
- Passwords must never be stored or logged in plain text.
- Only verified email accounts can access protected project workspaces.
- Users are assigned `is_admin = false` by default unless explicitly seeded or designated.

## Notes
- Supports instant seeded accounts for development and faculty evaluation.

