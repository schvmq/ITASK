# Roadmap

Authoritative long-term development roadmap and **sole source of truth for milestone definitions**.
AI-owned. See `AGENTS.md` → Ownership.

**This file owns:** milestone IDs, objectives, deliverables, completion criteria, dependencies, and lifecycle status.  
**This file does not own:** live session execution state (that is `20_PROGRESS.yaml` only).

Do not copy milestone criteria into Progress or Backlog. Progress stores only `current_milestone` (ID) plus execution RAM.

**Status values:** `planned` | `active` | `done` | `cancelled`

**ID conventions:**
- Program milestones: `M1`, `M2`, …
- Child milestones: `M1.1`, `M1.2`, … under a parent

---

## Index

| ID | Parent | Status | Title |
|----|--------|--------|-------|
| M1 | — | done | Decoupled Architecture & Core Authentication |
| M2 | — | done | Centralized Role Authorization & Committee Workflows |
| M3 | — | done | Task Engine, Interactive Checklists & MOV Evidence Uploads |
| M4 | — | done | Timeline Gantt Scheduling & Real-Time Messaging Hub |
| M5 | — | active | Faculty Evaluation Survey & Research Data Collection |
| M6 | — | planned | Production VPS Deployment & Final Defense Preparation |

---

## Suggested sequence

M1 (done) → M2 (done) → M3 (done) → M4 (done) → M5 (active) → M6 (planned)

---

## M1 — Decoupled Architecture & Core Authentication

- **Status:** done
- **Objective:** Establish a headless Laravel 12 backend and independent React 19 + Vite SPA with secure authentication.
- **Success criteria:**
  - Headless REST API routing and Sanctum/Inertia authentication.
  - Institutional email verification (`@carsu.edu.ph`).
  - Production asset compilation and local development server hot reloading.
- **Done when:** Users can register, verify email, and log in securely across both local and Docker environments.

---

## M2 — Centralized Role Authorization & Committee Workflows

- **Status:** done
- **Objective:** Implement unified RBAC with clear governance across Project Leader, Committee Staff/Lead, and Member roles.
- **Success criteria:**
  - `AuthorizationService`, `RoleRegistry`, and `PermissionRegistry` operational.
  - Project creation, committee scaffolding, and personnel assignment.
  - Role-adaptive sidebar navigation in the frontend SPA.
- **Done when:** Access policies prevent unauthorized committee modifications and protect project data.

---

## M3 — Task Engine, Interactive Checklists & MOV Evidence Uploads

- **Status:** done
- **Objective:** Deliver the operational task execution engine with atomic checklists and accreditation proof of completion.
- **Success criteria:**
  - Activity breakdown and task delegation with due dates.
  - Interactive checklists that recalculate progress percentages in real time.
  - Task evidence (MOV / PDF) uploads, secure file streaming, and review approval gates (`Requires Review`).
- **Done when:** Members can submit deliverables and committee heads can approve or return tasks with feedback.

---

## M4 — Timeline Gantt Scheduling & Real-Time Messaging Hub

- **Status:** done
- **Objective:** Provide cross-committee visual scheduling and instant collaboration.
- **Success criteria:**
  - Interactive Gantt chart tracking activity durations and milestones.
  - Monthly/weekly deadline calendar view.
  - Project group chats powered by Laravel Reverb WebSockets with typing indicators and read receipts.
- **Done when:** Teams can communicate and track timeline progress without relying on external group chats.

---

## M5 — Faculty Evaluation Survey & Research Data Collection

- **Status:** active
- **Objective:** Conduct live presentation to university faculty and collect empirical survey data for research evaluation.
- **Success criteria:**
  - Seamless localhost presentation setup (`run-local.bat`) with pre-seeded demo accounts (`DevTestDataSeeder`).
  - End-to-end demonstration of Leader → Committee Lead → Member approval loop.
  - Distribution and collection of participant usability surveys (SUS / ISO metrics).
  - Statistical analysis of survey responses for the research thesis.
- **Done when:** Evaluation survey responses are compiled, statistically analyzed, and documented for the capstone manuscript.

---

## Future program milestones (stubs)

### M6 — Production VPS Deployment & Final Defense Preparation

- **Status:** planned
- **Objective:** Deploy iTasks to production cloud infrastructure (Nginx + PHP-FPM + PostgreSQL + SSL) and finalize capstone defense documentation.
- **Notes:** Execute after survey evaluation data is incorporated into the research manuscript.
