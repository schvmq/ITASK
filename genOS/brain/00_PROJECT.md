# Project

Authoritative file for project intent. See `AGENTS.md` → Ownership.

**Ownership:** Humans own vision and intent. AI may reorganize, summarize, clarify, and maintain this document. AI must never change intent without explicit human approval.

---

## Vision

iTasks is a specialized institutional project, committee, and task management system engineered for Caraga State University (CarSU) academic departments, faculty, and student organizations. It eliminates fragmented communication and missing accreditation documentation by centralizing committee operations, milestone timelines, interactive task checklists, and verifiable Means of Verification (MOV).

## Research Goal

To design, develop, and empirically evaluate a role-governed task management platform that enhances institutional accountability, streamlines committee deliverables, and provides verifiable proof of accomplishment for academic audits (CHED, PACUCOA, ISO).

## Scope

- **In Scope:**
  - Multi-tier role-based governance: Administrator, Project Leader, Project Staff / Committee Lead, and Project Member.
  - Project and Committee hierarchy with activity decomposition and interactive task checklists.
  - Means of Verification (MOV) evidence management with document and PDF attachments.
  - Interactive Gantt timeline and deadline calendar for cross-committee schedule tracking.
  - Real-time project group messaging powered by Laravel Reverb WebSockets.
  - Faculty and student evaluation instrument and usability survey.
- **Out of Scope:**
  - University-wide student grading or SIS enrollment integration.
  - External commercial payment gateways.
  - Native mobile app store releases (responsive web SPA serves mobile devices).

## Target Environment & Stack

- **Backend:** PHP 8.2+ / Laravel 12 Headless REST API
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **Database:** PostgreSQL 17 (supporting native Windows service port 5432 and Docker Compose port 5433)
- **Broadcasting:** Laravel Reverb WebSockets
- **Target Platforms:** Modern Web Browsers (Desktop & Mobile-responsive)
- **Deployment:** Localhost presentation servers and Linux VPS (Nginx + PHP-FPM)

## Core User Workflow / Domain Loop

1. **Governance (Project Leader):** Creates project workspace, establishes timeline milestones, and delegates committees to designated faculty/staff leaders.
2. **Operational Coordination (Committee Lead):** Breaks down project objectives into operational activities, assigns tasks with structured criteria, and enforces quality review gates (`Requires Review`).
3. **Execution & Evidence (Committee Member):** Receives focused task assignments in "My Tasks", checks off actionable checklist items, attaches verifiable evidence (PDFs, receipts, minutes), and submits deliverables.
4. **Audit & Closure (Committee Lead / Leader):** Inspects submitted MOV deliverables, approves or returns tasks with actionable feedback, automatically updating overall activity progress and accreditation records.

## Constraints

- Institutional domain scoping (`@carsu.edu.ph` institutional emails).
- Zero credential leakage in version control (`.env` shielding).
- Strict backward compatibility for dual local PostgreSQL setups (ports 5432 and 5433).
- Responsive mobile compatibility via modern SPA architecture without external app store dependencies.

## Success Criteria

- 100% test pass rate across all 560+ automated backend and API tests.
- High usability and system satisfaction scores on faculty and student evaluation surveys (SUS score > 80).
- Zero deliverable lost without verifiable audit trail during live event management simulations.
