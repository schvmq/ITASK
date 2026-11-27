# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Caraga State University (CarSU) College of Computing and Information Sciences (CCIS) Deans / Overall Chairs, Committee Chairpersons, Event Co-Chairs, Faculty/Student Members, and System Administrators coordinating institutional academic events, task forces, and accreditation deliverables (CHED COE, PACUCOA, ISO).

## Product Purpose

Centralize institutional committee governance, Special Order (S.O.) setup, deliverable timelines, verifiable Means of Verification (MOV) evidence tracking, member competency/eligibility deliberation, and real-time event messaging in one accountable workspace.

## Positioning

Purpose-built around university Special Orders, role-scoped committee hierarchies (Overall Chair, Event Co-Chair, Chairperson, Committee Co-Chair, Member), verifiable MOV audit trails, and local-first offline AI/OCR assistance without external cloud lock-in.

## Operating Context

Formal university accreditation task forces (such as S.O. No. 755, s. 2025), hybrid local/offline live defenses (`run-local.bat`), and faculty usability evaluations (System Usability Scale / ISO evaluation).

## Capabilities and Constraints

- Institutional `@carsu.edu.ph` account scoping and role-based access control (`AuthorizationService`).
- Dual PostgreSQL environment (localhost `5432` and Docker `5433`).
- Offline-safe local AI/OCR (`OllamaResumeScreeningService` and `SpecialOrderParserService`) with deterministic fallback and mandatory human review gates.
- Existing web application built on Laravel 12, React 19, TypeScript, Inertia.js, Tailwind CSS v4.

## Brand Commitments

- Name: **ITASK** (CCIS Institutional Task & Committee Management)
- Tone: Direct, institutional, accountable, clarity-first Operate mode.

## Product Principles

1. **Governance Before Execution:** Every action follows verified project/committee role authority and explicit human confirmation.
2. **One-Click Discoverability:** Key workflows (Tasks, Events, Smart S.O. Import, Eligibility Profile, Timeline, Messages) are reachable within 1-2 clicks via global navigation or `Ctrl+K`.
3. **Verifiable Evidence + Deliberate Fit:** Pair self-assessed competency/strengths questionnaires with optional CV/OCR scanning to inform transparent, fair task delegation.
4. **WCAG 2.2 AA & Light/Dark Parity:** Every control maintains clear focus rings, contrast, and responsive touch targets across desktop and mobile.

## Accessibility & Inclusion

Target conformance: WCAG 2.2 Level AA (4.5:1 normal text contrast, keyboard-only operability, visible 3px focus indicators, screen-reader landmark and modal semantics, `prefers-reduced-motion` support).
