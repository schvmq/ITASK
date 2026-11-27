# Decisions

Authoritative decision log. AI records entries; humans approve intent-affecting decisions.
See `AGENTS.md` → Ownership.

Record a decision when intent, architecture, or constraints change in a way future agents cannot infer from runtime environment or source code.

**ID format:** `DEC-001`, `DEC-002`, …  
**Status:** `proposed` | `accepted` | `superseded` | `rejected`

---

## Index

| ID | Status | Date | Title |
|----|--------|------|-------|
| DEC-001 | accepted | 2026-10-15 | Decoupled Headless Architecture with Laravel 12 API and React 19 SPA |
| DEC-002 | accepted | 2026-10-20 | Centralized Authorization Engine with Role and Permission Registries |
| DEC-003 | accepted | 2026-11-12 | Dual PostgreSQL Environment Supporting Native Port 5432 and Docker Port 5433 |
| DEC-004 | accepted | 2026-11-17 | Hybrid Codebase and Academic Research genOS Brain Organization |
| DEC-005 | accepted | 2026-11-24 | Local Ollama AI Integration for Resume/CV Screening and Member Role Recommendation |
| DEC-006 | accepted | 2026-11-24 | Smart S.O. Import with Mandatory Human Verification Review Screen |

---

## Decisions

### DEC-006: Smart S.O. Import with Mandatory Human Verification Review Screen
- **Status:** accepted
- **Date:** 2026-11-24
- **Reason:** University Special Orders (e.g. S.O. No. 755, s. 2025) define intricate task forces with multi-group structures and dual personnel appointments that require automated extraction while strictly preventing unauthorized account creation or inaccurate role assignments.
- **Impact:** Implements Option 2 (OCR/text extraction + structured rule-based parser with fallback) coupled with an Inertia + React Review Screen. Matches personnel against existing accounts, preserves dual roles (e.g. Co-Chair + Committee Chair), stores original S.O. PDF as ProjectApprovalDocument, and permits the Overall Chair to verify and select suggested deliverables before committing.
- **Supersedes:** none

### DEC-005: Local Ollama AI Integration for Resume/CV Screening and Member Role Recommendation
- **Status:** accepted
- **Date:** 2026-11-24
- **Reason:** Requirement to evaluate member candidate qualifications and recommend optimal committee role placement without external cloud costs or internet dependencies during academic defenses.
- **Impact:** Integrates local Ollama (`llama3.2` and `llama3.2-vision`) via `OllamaResumeScreeningService` with graceful fallback to heuristic skill matching if the local model server is offline. Stores structured skills and suitability metrics in `member_resumes`.
- **Supersedes:** none

### DEC-004: Hybrid Codebase and Academic Research genOS Brain Organization
- **Status:** accepted
- **Date:** 2026-11-17
- **Reason:** The iTasks repository encompasses both production web application source code and academic capstone research evaluation requirements.
- **Impact:** Uses a single unified `brain/` with 1-level category subfolders: `brain/systems/code/` for technical architecture and `brain/systems/research/` for study methodology and evaluation survey protocols.
- **Supersedes:** none

### DEC-003: Dual PostgreSQL Environment Supporting Native Port 5432 and Docker Port 5433
- **Status:** accepted
- **Date:** 2026-11-12
- **Reason:** Windows host machine runs native PostgreSQL on port 5432, while Docker Compose maps host port 5433:5432.
- **Impact:** System configuration supports instant zero-Docker localhost runs on port 5432 for live presentations, while preserving containerized port 5433 for isolated deployments.
- **Supersedes:** none

### DEC-002: Centralized Authorization Engine with Role and Permission Registries
- **Status:** accepted
- **Date:** 2026-10-20
- **Reason:** Decentralized policy checks across multiple controllers caused authorization drift and inconsistency across committee hierarchies.
- **Impact:** All operational policies delegate to a unified `AuthorizationService` consuming `RoleRegistry` and `PermissionRegistry`.
- **Supersedes:** none

### DEC-001: Decoupled Headless Architecture with Laravel 12 API and React 19 SPA
- **Status:** accepted
- **Date:** 2026-10-15
- **Reason:** Requirement for an independent, reactive client application using modern React 19, TypeScript, and Tailwind CSS v4 alongside a headless REST backend.
- **Impact:** `ITASK/backend` acts as headless API; `ITASK/frontend` compiles via Vite with development hot module reloading via `public/hot`.
- **Supersedes:** none
