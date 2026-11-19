# ITASK Decoupled Architecture & Developer Guide

## 1. Overview
The ITASK system is decoupled into pure backend and frontend architectures referencing the Decoupled design, while retaining full Git history and preserving essential services like Docker Compose:
- **`ITASK/backend`**: Headless Laravel 12 REST API providing authentication, centralized role-based access control, relational database management (PostgreSQL), and real-time WebSocket event broadcasting.
- **`ITASK/frontend`**: Independent modern SPA built with React 19, TypeScript, Vite, Tailwind CSS v4, and Lucide icons, powered by a strictly typed API client (`lib/api.ts`) and containing all UI components, modals, and styles.
- **Root Orchestration**: `docker-compose.yml` is preserved at the repository root to manage PostgreSQL services.
- **Role Centralization**: User roles (`is_admin`, `Project Leader`, `Project Staff`, `Project Member`) and all policy checks are unified and enforced via a centralized `AuthorizationService`, `RoleRegistry`, and `PermissionRegistry`.

---

## 2. Directory Structure

```
ITASK/
├── docker-compose.yml              # PostgreSQL 17 Alpine database service (preserved)
├── DECOUPLED_GUIDE.md              # Architecture and development guide
├── README.md                       # Project overview documentation
│
├── backend/                        # Headless Laravel 12 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/   # REST API Controllers (Auth, Admin, Projects, Tasks, Workspace)
│   │   ├── Services/Authorization/ # Centralized Role & Permission Engine
│   │   │   ├── RoleRegistry.php
│   │   │   ├── PermissionRegistry.php
│   │   │   └── AuthorizationService.php
│   │   ├── Policies/               # Policies delegating to AuthorizationService
│   │   └── Models/                 # Eloquent Models & relationships
│   ├── routes/
│   │   ├── api.php                 # Comprehensive REST API route definitions
│   │   └── web.php                 # Web & verification routes
│   ├── resources/views/            # Blade templates (app.blade.php, etc.)
│   ├── database/                   # Migrations, seeders, factories
│   ├── tests/                      # 564 automated feature & API tests
│   ├── composer.json               # PHP backend package definitions
│   └── artisan                     # Artisan CLI entry point
│
└── frontend/                       # Independent React 19 + TypeScript + Vite SPA
    ├── index.html                  # Standalone SPA root
    ├── vite.config.js              # Vite bundler with backend proxying
    ├── package.json                # Frontend client scripts & dependencies
    ├── tsconfig.json               # TypeScript configuration
    └── resources/
        ├── css/                    # Tailwind CSS v4 styles & theme tokens
        └── js/
            ├── Components/         # Modular UI Components (CreateProjectTaskModal, ProjectTaskDetailsModal, etc.)
            ├── Pages/              # SPA & Page views (Projects/Show, Chat, Dashboard, etc.)
            ├── lib/api.ts          # Strictly typed Axios API client & schema interfaces
            └── main.tsx            # Standalone SPA root & Authentication App
```

---

## 3. How to Run Locally

### 1. Database (Docker Compose)
Start the PostgreSQL container from the `ITASK` root:
```cmd
docker compose up -d
```

### 2. Running the Backend API
1. Navigate to the backend directory:
   ```cmd
   cd backend
   ```
2. Start the Laravel development server:
   ```cmd
   php artisan serve --port=8000
   ```
   The REST API will be accessible at `http://127.0.0.1:8000/api`.

### 3. Running the Frontend SPA
1. Navigate to the frontend directory:
   ```cmd
   cd frontend
   ```
2. Start the Vite development server:
   ```cmd
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`. Any API calls to `/api` or `/sanctum` are automatically proxied to `http://127.0.0.1:8000`.

### 4. Compiling Production Builds
To compile the frontend client assets for production:
```cmd
cd frontend
npm run build
```
Compiled assets will be placed in `ITASK/frontend/dist`.

---

## 4. Centralized Role & Authorization Engine

All roles and permissions are defined in `backend/app/Services/Authorization`:
- **`RoleRegistry`**: System role definitions:
  - `ROLE_ADMIN` (`is_admin = true`)
  - `ROLE_PROJECT_LEADER` (`Project Leader`)
  - `ROLE_PROJECT_STAFF` (`Project Staff`)
  - `ROLE_PROJECT_MEMBER` (`Project Member`)
- **`PermissionRegistry`**: Defines all granular actions across projects, committees, activities, tasks, checklists, and evidence.
- **`AuthorizationService`**: Single point of truth for permission checks:
  - `hasRole(User $user, string $role, ?Project $project = null)`
  - `can(User $user, string $permission, $subject = null)`
  - `resolveEffectiveRole(User $user, Project $project)`
  - Project policies (`ProjectPolicy`, `CommitteePolicy`, `ActivityPolicy`, `TaskPolicy`, `ChecklistItemPolicy`) and middleware (`EnsureUserIsAdmin`) delegate all authorization checks to this service.

---

## 5. REST API Endpoint Catalog

All routes are mounted under `/api` in `backend/routes/api.php`:

### Authentication & Profile
- `POST /api/auth/login` - User login with CarSU credentials
- `POST /api/auth/register` - New user registration (`@carsu.edu.ph`)
- `POST /api/auth/logout` - Invalidate session
- `GET  /api/auth/me` - Authenticated user profile and effective roles
- `POST /api/email/verification-notification` - Resend verification email

### Workspace
- `GET  /api/dashboard` - Aggregated stats, active projects, tasks, reviews
- `GET  /api/my-tasks` - Task lists grouped by status (To Do, In Progress, Review, Completed)
- `GET  /api/calendar` - Scoped activity and task deadlines for calendar view
- `GET  /api/timeline` - Project milestones, activity timelines, and overall progress

### Projects & Personnel
- `GET    /api/projects` - List authorized projects
- `POST   /api/projects` - Create project
- `GET    /api/projects/{project}` - Retrieve project details & assigned committees
- `PUT    /api/projects/{project}` - Update project metadata
- `POST   /api/projects/{project}/archive` - Archive project
- `POST   /api/projects/{project}/unarchive` - Unarchive project
- `DELETE /api/projects/{project}` - Delete project
- `POST   /api/projects/{project}/personnel` - Assign project role to user
- `DELETE /api/projects/{project}/personnel/{user}` - Remove user project assignment

### Committees, Activities & Task Workflows
- `POST   /api/projects/{project}/committees` - Create committee
- `GET    /api/projects/{project}/committees/{committee}` - Committee details with activities
- `POST   /api/projects/{project}/committees/{committee}/staff` - Assign committee staff
- `POST   /api/projects/{project}/committees/{committee}/members` - Assign committee member
- `DELETE /api/projects/{project}/committees/{committee}/members/{user}` - Remove committee member
- `POST   /api/projects/{project}/committees/{committee}/activities` - Create activity
- `GET    /api/projects/{project}/committees/{committee}/activities/{activity}` - Activity details with tasks
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/submit` - Submit activity for review
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/review` - Staff approve / return activity
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks` - Create task
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/submit` - Submit task
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/approve` - Approve task
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/return` - Return task
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/resubmit` - Resubmit task
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/checklist` - Add checklist item
- `POST   /api/projects/{project}/committees/{committee}/activities/{activity}/tasks/{task}/evidence` - Upload evidence file

### Notifications & Real-Time Group Chat
- `GET  /api/notifications` - User notifications
- `POST /api/notifications/{notification}/read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all notifications as read
- `GET  /api/chat/{projectId?}` - Project group chat channel and message history
- `POST /api/chat/{chat}/messages` - Send message (with optional attachments)
- `POST /api/chat/{chat}/pin` - Toggle chat pinned status
- `POST /api/chat/{chat}/mute` - Toggle chat notification mute

### Administration (Admin Role Only)
- `GET    /api/admin/dashboard` - Admin metrics & registered user list
- `POST   /api/admin/users/{user}/verify` - Verify user account
- `POST   /api/admin/users/{user}/deny` - Reject registration
- `POST   /api/admin/users/{user}/role` - Update global or project role
- `POST   /api/admin/users/{user}/toggle-admin` - Toggle admin status
- `DELETE /api/admin/users/{user}` - Remove user
- `POST   /api/admin/projects/{project}/toggle-archive` - Archive/unarchive project
- `POST   /api/admin/settings` - Update system configuration

---

## 6. Testing & Quality Assurance
Run the complete backend test suite from `ITASK/backend`:
```cmd
cd backend
php artisan test
```

**Test Results**:
- **564 tests passed** (100% pass rate, 2,797 assertions)
- **Zero regressions** against original baseline
- **40 dedicated feature tests** validating every REST API endpoint, role check, and task workflow in isolation
