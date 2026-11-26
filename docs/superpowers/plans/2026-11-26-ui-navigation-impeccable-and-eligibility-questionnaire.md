# ITASK UI/Navigation Polish, Impeccable Design System & Hybrid OCR Eligibility Questionnaire Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate ITASK's UI craft and navigation using Impeccable (`PRODUCT.md`, `DESIGN.md`, fixed token drift, unified Search/`Ctrl+K` & breadcrumbs), and extend the Ollama CV/OCR feature into a Hybrid Competency Profile combining PDF/image OCR with a structured user Eligibility & Strengths Deliberation Questionnaire that ranks members for both committees and specific tasks.

**Architecture:** Establish `PRODUCT.md` and `DESIGN.md` at the `ITASK/` root preserving ITASK's Warm Ember (`#EA580C`) + Slate (`#14181F` / `#F8F9FA`) identity (`frontend/resources/css/app.css`). Evolve `member_resumes` cleanly via an additive PostgreSQL migration so questionnaire data coexists with optional CV OCR, share a single ranking engine in `OllamaResumeScreeningService`, expose `GET/POST /eligibility-profile` and `POST /projects/{project}/tasks/recommend-assignees`, and wire unified navigation across `AppLayout.tsx`, `CommandPalette.tsx`, `navigation.ts`, `CreateProjectTaskModal.tsx`, `Activities/Show.tsx`, `Committees/Show.tsx`, and `SmartSOImport.tsx`.

**Tech Stack:** Laravel 12 (PHP 8.2+), PostgreSQL 17, React 19, TypeScript, Inertia.js, Tailwind CSS v4, Lucide React, Local Ollama (`llama3.2` / `llama3.2-vision`) with offline heuristic fallback.

## Global Constraints

- **Identity & Theme Fidelity:** Preserve Warm Ember (`#EA580C` / `#F97316`) primary accent, Montserrat + JetBrains Mono typography, flat bordered cards (`1px solid var(--border)`), light/dark theme parity, and 3px `--primary` keyboard focus rings (`app.css`).
- **Dual Database & Offline Parity:** Migrations and queries must work identically on PostgreSQL ports `5432` and `5433`; AI screening and deliberation must never hang or crash when Ollama is offline (fast heuristic fallback + explicit on-demand Ollama deliberation).
- **Authorization & Evidence Integrity:** Every backend endpoint enforces existing `Gate` / ownership authorization (`AuthorizationService`); questionnaire responses augment—never auto-verify—institutional credentials or override human confirmation.
- **Accessibility & Mechanical Detector:** Maintain WCAG 2.2 AA contrast (`4.5:1` normal text, `3:1` large/UI), 44px mobile touch targets, semantic labels/landmarks, and verify finished frontend edits with `.agent/skills/impeccable/scripts/impeccable.cmd detect --json`.
- **Execution Shell on Windows:** User prefers `cmd.exe` for shell commands (`cmd.exe /c "..."`).

---

### Task 1: Establish Impeccable Authorities (`PRODUCT.md`, `DESIGN.md`) & Fix CSS Token Drift

**Files:**
- Create: `ITASK/PRODUCT.md`
- Create: `ITASK/DESIGN.md`
- Create: `ITASK/.impeccable/config.json`
- Modify: `ITASK/frontend/resources/css/app.css:17-144`

**Interfaces:**
- Consumes: `ITASK/genOS/brain/00_PROJECT.md`, `ITASK/frontend/resources/css/app.css`, `ITASK/.agent/skills/impeccable/scripts/impeccable.cmd`
- Produces: Authoritative `PRODUCT.md`, `DESIGN.md`, `.impeccable/config.json`, and CSS `--surface` / semantic surface aliases in `app.css`

- [ ] **Step 1: Verify existing CSS token gap before editing**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && findstr /N \"--surface\" frontend\resources\css\app.css frontend\resources\js\Pages\Projects\SmartSOImport.tsx"
```
Expected: `SmartSOImport.tsx` references `var(--surface)` while `app.css` returns 0 matches for `--surface:`.

- [ ] **Step 2: Write `ITASK/PRODUCT.md`, `ITASK/DESIGN.md`, and `ITASK/.impeccable/config.json`**

Create `ITASK/PRODUCT.md`:
```markdown
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
```

Create `ITASK/.impeccable/config.json`:
```json
{
  "buildPath": "code"
}
```

Create `ITASK/DESIGN.md` capturing extracted `app.css` tokens cleanly:
```markdown
---
name: ITASK Design System
description: High-clarity institutional governance workspace with Warm Ember action accents, slate surfaces, tabular numerals, and flat hairline card boundaries.
colors:
  primary: "#EA580C"
  primary-dark: "#F97316"
  primary-active: "#C2410C"
  surface-light: "#FFFFFF"
  bg-light: "#F8F9FA"
  soft-light: "#F3F4F6"
  border-light: "#E5E7EB"
  text-light: "#111827"
  muted-light: "#6B7280"
  surface-dark: "#0F1216"
  bg-dark: "#14181F"
  soft-dark: "#1E232B"
  border-dark: "#262626"
  text-dark: "#F3F4F6"
  muted-dark: "#9CA3AF"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
typography:
  headline:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Montserrat, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
---

## Overview

ITASK operates in **Operate mode**: flat 1px bordered surfaces, crisp typographic hierarchy (`Montserrat` for UI and `JetBrains Mono` `.tabular-nums` for dates/counts/percentages), and Warm Ember reserved strictly for active focus, current nav selection, and primary actions.

## Colors

- **Primary:** Warm Ember (`#EA580C` light / `#F97316` dark). Never use saturated orange as decorative background fills.
- **Surfaces:** `--background` canvas behind `--card` / `--surface` panels with `--soft-surface` nested controls and `--border` hairlines.
- **Semantic:** Emerald (`--status-success`) for verified/completed/eligible, Amber (`--status-neutral`) for review/attention/needs-verification, Crimson (`--status-danger`) for overdue/errors.

## Typography

Fixed `rem`/`px` scale (`26px` H1, `18px` H2, `16px` H3, `15px` body, `12px–13px` labels) with tabular numerals on deadlines, scores, and counts.

## Layout

Persistent 256px desktop sidebar (collapsible to 72px) + 56px sticky top utility header (`max-w-7xl` content container), breadcrumbs bar on subpages, and mobile sheet drawer (`< 768px`).

## Elevation & Depth

Flat tonal layering with `1px solid var(--border)` (`box-shadow: none` on cards and dialogs; `--shadow-xs` only on floating popovers/dropdowns).

## Shapes

Consistent radii: `6px` small chips/buttons, `8px` inputs/buttons/nav pills, `12px` cards/modals, `full` pills for status badges and avatars.

## Components

Shared primitives live in `frontend/resources/js/Components/` (`Button`, `Card`, `Badge`, `Modal`, `Alert`, `Tabs`, `Pagination`, `EmptyState`, `CommandPalette`).

## Do's and Don'ts

- **Do:** Reference semantic CSS custom properties (`--card`, `--surface`, `--soft-surface`, `--text`, `--muted`, `--border`, `--primary`) so light and dark modes stay balanced.
- **Don't:** Reference undefined CSS variables like raw `--surface` without token definitions, mix raw `slate-*` utility colors into tokenized panels, or hide key workflows behind keyboard-only shortcuts.
```

- [ ] **Step 3: Add missing `--surface` alias tokens in `ITASK/frontend/resources/css/app.css`**

Inside `:root, :root[data-theme="light"]` in `app.css` after line 36:
```css
    --surface: var(--card);
    --surface-elevated: var(--card-surface);
```
Inside `:root[data-theme="dark"], html.dark` in `app.css` after line 100:
```css
    --surface: var(--card);
    --surface-elevated: var(--card-surface);
```

- [ ] **Step 4: Build frontend to confirm valid CSS compilation and commit Task 1**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\frontend && npm run build"
```
Expected: Vite build passes with 0 CSS/build errors.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add PRODUCT.md DESIGN.md .impeccable/config.json frontend/resources/css/app.css && git commit -m docs_and_css_add_product_design_authorities_and_surface_tokens"
```

---

### Task 2: Unify Navigation, Top-Bar Quick Search (`Ctrl+K`), Skip Link & Consistent Breadcrumbs

**Files:**
- Modify: `ITASK/frontend/resources/js/Config/navigation.ts:238-326`
- Modify: `ITASK/frontend/resources/js/Components/CommandPalette.tsx:36-96`
- Modify: `ITASK/frontend/resources/js/Layouts/AppLayout.tsx:240-375,555-770,800-810`

**Interfaces:**
- Consumes: `AppLayout` custom events (`itask:open-command-palette`, `itask:open-create-project`, `itask:open-create-task`)
- Produces: Accessible navigation items (`GLOBAL_NAV_ITEMS` including `Eligibility & Strengths` at `/eligibility-profile`), top-bar Search trigger (`Ctrl+K`), global `Ctrl+K` opener in `AppLayout`, skip-to-main link (`#main-content`), `Smart S.O. Import` & `Eligibility & Strengths` in `CommandPalette` and User Menu

- [ ] **Step 1: Update `navigation.ts` to add `Eligibility & Strengths` link cleanly**

In `ITASK/frontend/resources/js/Config/navigation.ts`, add `Award` or `UserCheck` to imports and add to `GLOBAL_NAV_ITEMS` (placed cleanly right after `My Tasks` or before `Notifications` — 8 cohesive links):
```ts
    {
        name: 'Eligibility & Strengths',
        href: '/eligibility-profile',
        icon: UserCheck,
        description: 'Strengths questionnaire, CV screening, and task suitability',
    },
```
Also ensure Leader `quickActions` in `ROLE_CONFIGS['Project Leader']` includes `Smart S.O. Import`:
```ts
            {
                name: 'Import from S.O.',
                description: 'Auto-parse Special Order PDF into committees',
                icon: Sparkles,
                href: '/projects/smart-import',
            },
```

- [ ] **Step 2: Fix global `Ctrl+K` toggle + expand routes/actions in `CommandPalette.tsx`**

In `ITASK/frontend/resources/js/Components/CommandPalette.tsx`:
- Add `UserCheck`, `Sparkles`, `ShieldCheck` to `lucide-react` imports.
- Update `quickLinks` to include role-aware destinations:
```ts
    const quickLinks = [
        { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
        { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare },
        { label: 'Events', href: '/projects', icon: FolderOpen },
        { label: 'Smart S.O. Import', href: '/projects/smart-import', icon: Sparkles },
        { label: 'Eligibility & Strengths', href: '/eligibility-profile', icon: UserCheck },
        { label: 'Calendar', href: '/calendar', icon: CalendarDays },
        { label: 'Timeline', href: '/timeline', icon: GanttChartSquare },
        { label: 'Messages', href: '/messages', icon: MessageSquare },
        { label: 'Notifications', href: '/notifications', icon: Bell },
        ...(auth?.user?.is_admin
            ? [{ label: 'Admin User Management', href: '/admin/dashboard', icon: ShieldCheck }]
            : []),
    ];
```
- Update `Quick actions` grid in `CommandPalette.tsx` to include a 3rd quick link to **Smart S.O. Import** (`/projects/smart-import`) and **Eligibility Questionnaire** (`/eligibility-profile`) alongside Create Task / Create Event (hidden for admins if needed, or clean 2x2 grid).
- Add accessible ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-label="Global command navigation"`).

- [ ] **Step 3: Add Global `Ctrl+K` listener, Top-Bar Search button, User Menu link & Skip Link in `AppLayout.tsx`**

In `ITASK/frontend/resources/js/Layouts/AppLayout.tsx`:
- In `useEffect` (around lines 486-515), add a global `keydown` listener so `(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'` toggles `setIsCommandPaletteOpen((prev) => !prev)` even when the palette is closed!
- Add an accessible **Skip to main content** link right inside the root container:
```tsx
<a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[8px] focus:bg-[color:var(--primary)] focus:text-white focus:font-semibold focus:text-sm"
>
    Skip to main content
</a>
```
- Add `id="main-content"` and `tabIndex={-1}` on `<main>` at line 805.
- In `<header>` left region (`lines 593-626`), beside the mobile menu trigger, add a sleek **Search / Quick Jump** trigger button visible on both desktop and mobile (`44px` height target on mobile):
```tsx
<button
    type="button"
    onClick={() => setIsCommandPaletteOpen(true)}
    className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[38px] sm:min-w-[220px] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--soft-surface)] hover:border-[color:var(--primary)] text-[13px] text-[color:var(--muted)] hover:text-[color:var(--text)] transition-colors cursor-pointer"
    aria-label="Open quick navigation and search (Ctrl+K)"
>
    <Search className="w-4 h-4 shrink-0" />
    <span className="hidden sm:inline flex-1 text-left">Jump to page or action...</span>
    <span className="sm:hidden">Search</span>
    <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[color:var(--card)] border border-[color:var(--border)] rounded text-[color:var(--muted)]">
        Ctrl+K
    </kbd>
</button>
```
- Also add **"Eligibility & Strengths"** & **"Smart S.O. Import"** inside the non-admin `DropdownMenuContent` in `AppLayout.tsx` (lines 728-744), and highlight active route matching cleanly for `/eligibility-profile` and `/projects/smart-import`.
- Ensure sidebar `<button>` / toggle on `<div onClick={() => setShowFavorites(!showFavorites)}>` (line 379) is a semantic `<button type="button" aria-expanded={showFavorites}>` for WCAG keyboard accessibility!

- [ ] **Step 4: Build frontend to verify TypeScript & Tailwind compile cleanly and commit Task 2**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\frontend && npm run build"
```
Expected: Zero TypeScript/Vite errors.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add frontend/resources/js/Config/navigation.ts frontend/resources/js/Components/CommandPalette.tsx frontend/resources/js/Layouts/AppLayout.tsx && git commit -m ui_unify_navigation_topbar_search_ctrl_k_and_accessibility_landmarks"
```

---

### Task 3: Evolve `member_resumes` Schema & Unify Competency/Task Deliberation Engine

**Files:**
- Create: `ITASK/backend/database/migrations/2026_11_26_000001_add_eligibility_questionnaire_to_member_resumes_table.php`
- Modify: `ITASK/backend/app/Models/MemberResume.php:15-38`
- Modify: `ITASK/backend/app/Services/AI/OllamaResumeScreeningService.php:74-130,323-354`
- Test: `ITASK/backend/tests/Feature/EligibilityQuestionnaireTest.php`

**Interfaces:**
- Consumes: `User`, `Committee`, `MemberResume`
- Produces:
  - Nullable `original_name`, `file_path`, `mime_type` on `member_resumes` + `strengths_assessment` (array), `preferred_task_categories` (array), `leadership_readiness` (string), `availability_hours` (string|null), `deliberation_notes` (string|null), `assessment_completed_at` (datetime)
  - `OllamaResumeScreeningService::rankCandidatesForCommittee(Committee $committee, Collection $candidates): Collection`
  - `OllamaResumeScreeningService::rankCandidatesForTask(string $taskTitle, ?string $taskDescription, ?string $committeeName, Collection $candidates, bool $useOllama = false): Collection`
  - `OllamaResumeScreeningService::saveQuestionnaireProfile(User $user, array $payload): MemberResume`
  - `OllamaResumeScreeningService::getCompetencyFramework(): array`

- [ ] **Step 1: Write failing test for questionnaire persistence & task-level suitability deliberation**

Create `ITASK/backend/tests/Feature/EligibilityQuestionnaireTest.php`:
```php
<?php

namespace Tests\Feature;

use App\Models\Committee;
use App\Models\MemberResume;
use App\Models\Project;
use App\Models\ProjectRoleAssignment;
use App\Models\User;
use App\Services\AI\OllamaResumeScreeningService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EligibilityQuestionnaireTest extends TestCase
{
    use RefreshDatabase;

    protected User $leader;
    protected User $techMember;
    protected User $docsMember;
    protected Project $project;
    protected Committee $committee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->leader = User::factory()->create(['email_verified_at' => now()]);
        $this->techMember = User::factory()->create(['name' => 'Tech Specialist', 'email_verified_at' => now()]);
        $this->docsMember = User::factory()->create(['name' => 'Docs Coordinator', 'email_verified_at' => now()]);

        $this->project = Project::create([
            'created_by' => $this->leader->id,
            'title' => 'COE Accreditation Event',
            'status' => Project::STATUS_ACTIVE,
        ]);

        ProjectRoleAssignment::create([
            'project_id' => $this->project->id,
            'user_id' => $this->leader->id,
            'role' => ProjectRoleAssignment::ROLE_PROJECT_LEADER,
        ]);

        $this->committee = Committee::create([
            'project_id' => $this->project->id,
            'name' => 'Technical & Video Systems Committee',
            'description' => 'Handles web portal setup, React dashboards, and technical video editing.',
        ]);

        foreach ([$this->techMember, $this->docsMember] as $u) {
            ProjectRoleAssignment::create([
                'project_id' => $this->project->id,
                'committee_id' => $this->committee->id,
                'user_id' => $u->id,
                'role' => ProjectRoleAssignment::ROLE_PROJECT_MEMBER,
            ]);
        }
    }

    public function test_user_can_save_questionnaire_without_uploading_cv_and_deliberate_task_fit(): void
    {
        $service = new OllamaResumeScreeningService();

        $resume = $service->saveQuestionnaireProfile($this->techMember, [
            'strength_ratings' => [
                'technical_engineering' => 5,
                'documentation_secretariat' => 2,
                'quality_assurance' => 4,
                'logistics_operations' => 3,
                'leadership_facilitation' => 4,
                'media_creative' => 3,
            ],
            'preferred_task_categories' => ['Web & System Setup', 'Quality & Evidence Audit'],
            'certifications_list' => ['Laravel & React Specialist'],
            'leadership_readiness' => 'Lead or Independent',
            'availability_hours' => '6-10 hrs/week',
            'deliberation_notes' => 'Built React dashboards and database tools for CCIS events.',
        ]);

        $this->assertNotNull($resume->assessment_completed_at);
        $this->assertContains('Technical & Web Engineering', $resume->extracted_skills);

        $service->saveQuestionnaireProfile($this->docsMember, [
            'strength_ratings' => [
                'technical_engineering' => 1,
                'documentation_secretariat' => 5,
                'quality_assurance' => 3,
                'logistics_operations' => 4,
                'leadership_facilitation' => 3,
                'media_creative' => 2,
            ],
            'preferred_task_categories' => ['Documentation & Minutes', 'Event Logistics'],
            'certifications_list' => ['Committee Secretariat Workshop'],
            'leadership_readiness' => 'Support Role',
            'availability_hours' => '3-5 hrs/week',
            'deliberation_notes' => 'Experienced in taking minutes and formatting MOV binders.',
        ]);

        $ranked = $service->rankCandidatesForTask(
            'Build React Data Table and API Integration',
            'Develop dashboard component and test endpoint permissions',
            $this->committee->name,
            collect([$this->docsMember->fresh('resume'), $this->techMember->fresh('resume')])
        );

        $this->assertCount(2, $ranked);
        $this->assertEquals($this->techMember->id, $ranked->first()['user_id']);
        $this->assertGreaterThan($ranked->last()['suitability_score'], $ranked->first()['suitability_score']);
        $this->assertTrue($ranked->first()['has_questionnaire']);
    }
}
```

- [ ] **Step 2: Run the failing test to confirm failure before implementation**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test --filter EligibilityQuestionnaireTest"
```
Expected: FAIL (`Call to undefined method OllamaResumeScreeningService::saveQuestionnaireProfile()`).

- [ ] **Step 3: Create migration `2026_11_26_000001_add_eligibility_questionnaire_to_member_resumes_table.php`**

Write migration handling PostgreSQL cleanly (`nullable()->change()` on `original_name`, `file_path`, `mime_type`, plus adding questionnaire columns):
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_resumes', function (Blueprint $table) {
            $table->string('original_name')->nullable()->change();
            $table->string('file_path')->nullable()->change();
            $table->string('mime_type')->nullable()->change();

            $table->json('strengths_assessment')->nullable()->after('eligibility_status');
            $table->json('preferred_task_categories')->nullable()->after('strengths_assessment');
            $table->string('leadership_readiness')->nullable()->after('preferred_task_categories');
            $table->string('availability_hours')->nullable()->after('leadership_readiness');
            $table->text('deliberation_notes')->nullable()->after('availability_hours');
            $table->timestamp('assessment_completed_at')->nullable()->after('deliberation_notes');
        });
    }

    public function down(): void
    {
        Schema::table('member_resumes', function (Blueprint $table) {
            $table->dropColumn([
                'strengths_assessment',
                'preferred_task_categories',
                'leadership_readiness',
                'availability_hours',
                'deliberation_notes',
                'assessment_completed_at',
            ]);
        });
    }
};
```

Run migration against both local DB and ensure test runner picks it up:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan migrate"
```

- [ ] **Step 4: Update `MemberResume.php` & `OllamaResumeScreeningService.php`**

Update `ITASK/backend/app/Models/MemberResume.php` `$fillable` and `casts()`:
```php
    protected $fillable = [
        'user_id',
        'original_name',
        'file_path',
        'file_size',
        'mime_type',
        'extracted_text',
        'extracted_skills',
        'certifications',
        'experience_summary',
        'eligibility_status',
        'raw_ai_analysis',
        'strengths_assessment',
        'preferred_task_categories',
        'leadership_readiness',
        'availability_hours',
        'deliberation_notes',
        'assessment_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'extracted_skills' => 'array',
            'certifications' => 'array',
            'raw_ai_analysis' => 'array',
            'strengths_assessment' => 'array',
            'preferred_task_categories' => 'array',
            'assessment_completed_at' => 'datetime',
        ];
    }
```

In `ITASK/backend/app/Services/AI/OllamaResumeScreeningService.php`:
- Define canonical `COMPETENCY_DOMAINS` constant mapping domain slugs (`technical_engineering`, `documentation_secretariat`, `quality_assurance`, `logistics_operations`, `leadership_facilitation`, `media_creative`) to labels, keywords (for task/committee matching), and CarSU deliverable examples.
- Implement `getCompetencyFramework(): array` returning domains, task category options, leadership readiness options, and availability options (single source of truth shared with React).
- Implement `saveQuestionnaireProfile(User $user, array $payload): MemberResume`:
  - Preserves existing uploaded CV fields if present (`original_name`, `file_path`, `mime_type`, `extracted_text`).
  - Merges top-rated domains (rating >= 4) and `preferred_task_categories` with any CV-extracted skills into `extracted_skills`.
  - Appends `certifications_list` into `certifications`.
  - Updates `strengths_assessment`, `preferred_task_categories`, `leadership_readiness`, `availability_hours`, `deliberation_notes`, `experience_summary` (synthesized cleanly if no CV summary exists), `eligibility_status` (`Highly Recommended` when profile has CV or >=2 high-confidence domains + notes; otherwise `Eligible`), and `assessment_completed_at`.
- Implement shared helper `rankCandidatesForScope(string $scopeTitle, ?string $scopeDescription, string $scopeType, Collection $candidates, bool $allowOllama = true): Collection`:
  - Scores candidates out of 100 combining:
    1) Questionnaire domain rating alignment (up to +25 pts based on keyword overlap with rated competencies 1..5).
    2) Preferred task category + extracted CV skill overlap (up to +20 pts).
    3) Objective evidence bonus (+8 pts if CV uploaded or certifications listed; +5 pts if deliberation notes or high leadership readiness match).
  - Returns normalized payload preserving ALL keys expected by existing `OllamaResumeScreeningTest` (`user_id`, `name`, `email`, `has_resume`, `resume_name`, `suitability_score`, `eligibility_status`, `recommendation_reason`, `extracted_skills`, `certifications`) PLUS `has_questionnaire`, `top_strengths`, `availability_hours`, `leadership_readiness`, `deliberation_summary`.
  - Keep `rankCandidatesForCommittee()` calling `rankCandidatesForScope(...)` and add `rankCandidatesForTask(...)` calling the same unified helper (`useOllama` optional so task dropdown queries stay instantaneous unless explicitly requested!).

- [ ] **Step 5: Run BOTH `EligibilityQuestionnaireTest` and `OllamaResumeScreeningTest`**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test --filter \"EligibilityQuestionnaireTest|OllamaResumeScreeningTest\""
```
Wait — remember Windows `cmd.exe` quoting: run two sequential commands or `--filter EligibilityQuestionnaireTest && php artisan test --filter OllamaResumeScreeningTest`:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test --filter EligibilityQuestionnaireTest && php artisan test --filter OllamaResumeScreeningTest"
```
Expected: ALL tests PASS (zero regressions on `OllamaResumeScreeningTest`, new test passes).
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add backend/database/migrations/2026_11_26_000001_add_eligibility_questionnaire_to_member_resumes_table.php backend/app/Models/MemberResume.php backend/app/Services/AI/OllamaResumeScreeningService.php backend/tests/Feature/EligibilityQuestionnaireTest.php && git commit -m feat_add_eligibility_questionnaire_schema_and_task_deliberation_service"
```

---

### Task 4: Backend Endpoints for User Eligibility Profile & Task Assignee Deliberation

**Files:**
- Modify: `ITASK/backend/app/Http/Controllers/MemberResumeController.php:1-101`
- Modify: `ITASK/backend/app/Http/Controllers/TaskController.php:1-30,430-448`
- Modify: `ITASK/backend/routes/web.php:130-160`
- Modify: `ITASK/backend/tests/Feature/EligibilityQuestionnaireTest.php`

**Interfaces:**
- Consumes: `OllamaResumeScreeningService`, `MemberResume`, `Project`, `Committee`, `AuthorizationService`
- Produces:
  - `GET /eligibility-profile` -> `MemberResumeController@profile` (Inertia page `Profile/EligibilityProfile`)
  - `POST /eligibility-profile` -> `MemberResumeController@storeQuestionnaire` (JSON or Inertia redirect)
  - `POST /projects/{project}/tasks/recommend-assignees` -> `TaskController@recommendAssignees` (JSON `{ success, ollama_active, recommendations }`)

- [ ] **Step 1: Add HTTP feature tests in `EligibilityQuestionnaireTest.php`**

Add two test methods testing:
1. Authenticated verified user can access `GET /eligibility-profile` and submit `POST /eligibility-profile`, persisting `strengths_assessment`, `preferred_task_categories`, `leadership_readiness`, `availability_hours`, and `deliberation_notes`.
2. Project leader/committee staff can call `POST /projects/{project}/tasks/recommend-assignees` with `task_title`, `task_description`, `committee_id` and receive ranked `recommendations`, while unauthorized outsiders receive `403`.

- [ ] **Step 2: Run tests to verify new HTTP tests fail first**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test --filter EligibilityQuestionnaireTest"
```
Expected: FAIL (`Route [eligibility-profile.index] not defined`).

- [ ] **Step 3: Implement endpoints in `MemberResumeController.php`, `TaskController.php`, and `routes/web.php`**

In `MemberResumeController.php`:
- `profile(Request $request): Response`: loads `$user->resume`, passes `profile` (extracted skills, certifications, eligibility_status, strengths_assessment, preferred_task_categories, leadership_readiness, availability_hours, deliberation_notes, has_resume, original_name, assessment_completed_at), `framework` (`$this->screeningService->getCompetencyFramework()`), and `sampleDeliberationTasks` (4 representative institutional task scopes so users can preview how their answers match real tasks), plus `ollamaActive` (`$this->screeningService->isAvailable()`).
- `storeQuestionnaire(Request $request)`: validates `strength_ratings` (required array of integers 1..5), `preferred_task_categories` (array), `certifications_list` (nullable array of strings), `leadership_readiness` (required string), `availability_hours` (required string), `deliberation_notes` (nullable string max:1500), calls `$this->screeningService->saveQuestionnaireProfile($user, $validated)`, returns JSON if `wantsJson()` or `back()->with('status', ...)`.
- Also update `MemberResumeController@show(User $user)` to include `has_questionnaire`, `strengths_assessment`, `preferred_task_categories`, `leadership_readiness`, `availability_hours`, `deliberation_notes` while keeping `has_resume: (bool) $resume->original_name`.

In `TaskController.php`:
- Add `recommendAssignees(Request $request, Project $project, OllamaResumeScreeningService $screeningService): JsonResponse`:
  - Check authorization using existing `Gate::authorize('createForProject', [Task::class, $project])` (matching `StoreProjectTaskRequest@authorize`), and if `committee_id` is passed, verify `$project->committees()->where('id', $committeeId)->exists()` (abort 404 if mismatched).
  - Validate `task_title` (required string), `task_description` (nullable string), `committee_id` (nullable exists:committees,id), `use_ollama` (nullable boolean).
  - Gather eligible assignees for that committee (or project members if no committee specified) eager-loading `user.resume`.
  - Call `$screeningService->rankCandidatesForTask(...)` and return JSON `{ success: true, ollama_active, recommendations }`.

In `routes/web.php` inside `Route::middleware(['auth', 'verified'])->group(...)`:
```php
    // Member Eligibility & Strengths Profile (Questionnaire + CV OCR)
    Route::get('/eligibility-profile', [\App\Http\Controllers\MemberResumeController::class, 'profile'])->name('eligibility-profile.index');
    Route::post('/eligibility-profile', [\App\Http\Controllers\MemberResumeController::class, 'storeQuestionnaire'])->name('eligibility-profile.store');
```
And under Tasks:
```php
    Route::post('/projects/{project}/tasks/recommend-assignees', [\App\Http\Controllers\TaskController::class, 'recommendAssignees'])->name('projects.tasks.recommend-assignees');
```

- [ ] **Step 4: Run `EligibilityQuestionnaireTest` and `SmartSpecialOrderImportTest` to verify**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test --filter EligibilityQuestionnaireTest && php artisan test --filter SmartSpecialOrderImportTest"
```
Expected: ALL tests PASS.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add backend/app/Http/Controllers/MemberResumeController.php backend/app/Http/Controllers/TaskController.php backend/routes/web.php backend/tests/Feature/EligibilityQuestionnaireTest.php && git commit -m feat_add_eligibility_profile_and_task_recommendation_endpoints"
```

---

### Task 5: Build `EligibilityProfile.tsx` (Interactive Questionnaire + CV OCR + Live Suitability Preview)

**Files:**
- Create: `ITASK/frontend/resources/js/Pages/Profile/EligibilityProfile.tsx`

**Interfaces:**
- Consumes: Inertia props `{ profile, framework, sampleDeliberationTasks, ollamaActive }` from `MemberResumeController@profile`, global `auth` prop, `/eligibility-profile` (`POST`), `/users/{id}/resume` (`POST`)
- Produces: Complete Operate-mode user workspace page allowing any verified user to rate strengths (1–5 interactive accessible segmented buttons), pick preferred task types, add certifications/deliberation reflections, optionally upload/scan a PDF/Image CV via OCR/Ollama, and preview deliberated scores against sample task types cleanly in light & dark mode.

- [ ] **Step 1: Verify `AppLayout` breadcrumbs & shared props usage**

Ensure `<AppLayout title="Eligibility & Strengths" breadcrumbs={[{ label: 'Eligibility & Strengths' }]}>` is used cleanly with semantic HTML, accessible `<label>`s, keyboard-navigable rating controls (`aria-pressed` / radio group semantics), explicit loading/saving/error feedback (`Alert`), and zero hardcoded color slop (`var(--card)`, `var(--soft-surface)`, `var(--primary)`, `var(--border)`, `var(--text)`, `var(--muted)`).

- [ ] **Step 2: Create `ITASK/frontend/resources/js/Pages/Profile/EligibilityProfile.tsx`**

Implement:
- **Summary Strip:** Current Eligibility Status badge, Assessment Completion date, CV Status (`Attached` / `Questionnaire Only`), Ollama Engine status indicator (`Local Ollama Ready` / `Heuristic Active`), and quick count of top strengths.
- **Left Column (2/3 width on lg+): Structured Eligibility & Strengths Deliberation Form:**
  - Section 1: **Core Competency Self-Assessment** (6 CarSU domains rendered as accessible 1–5 rating scales with descriptive anchors: `1 = Beginner` to `5 = Lead-Ready`).
  - Section 2: **Preferred Task Categories & Readiness** (selectable chips for preferred tasks like *Accreditation & MOV Verification*, *Software/Web & Technical Support*, *Minutes & Documentation*, *Event Logistics & Coordination*, *Graphic/Video Production*; plus dropdowns/selects for *Leadership Readiness* and *Weekly Availability*).
  - Section 3: **Certifications & Experience Deliberation** (interactive tag input for verified trainings/certificates + free-text *Deliberation Statement* answering: *"What specific tasks do you deliver best, and what previous roles prove your readiness?"*).
  - Save action with inline loading & saved confirmation alert (`role="status"`).
- **Right Column (1/3 width on lg+): Optional CV/Resume OCR Scanner & Live Task Fit Preview:**
  - Card 1: **Optional CV / Credential OCR Upload**: Upload PDF/PNG/JPG resume (`POST /users/{user.id}/resume`), immediately displays extracted OCR skills, certifications, and merged eligibility status.
  - Card 2: **Live Task Deliberation Preview**: Live client-side preview matching the user's current ratings + CV skills against realistic institutional tasks (*Draft Criteria Alignment Report*, *Develop Automated Attendance Tool*, *Direct Committee Logistics*, *Produce Audio-Visual Brief*) so the user can see exactly how task leaders evaluate their fit before saving!

- [ ] **Step 3: Compile frontend with `npm run build` and commit Task 5**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\frontend && npm run build"
```
Expected: `EligibilityProfile-*.js` compiled cleanly with zero TS/Vite errors.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add frontend/resources/js/Pages/Profile/EligibilityProfile.tsx && git commit -m feat_build_eligibility_and_strengths_questionnaire_page"
```

---

### Task 6: Wire Specific-Task Deliberation into Task Assignment & Impeccable Polish Across Core Views

**Files:**
- Modify: `ITASK/frontend/resources/js/Components/CreateProjectTaskModal.tsx:1-250,340-440`
- Modify: `ITASK/frontend/resources/js/Pages/Activities/Show.tsx:155-260` (Task creation modal assignee picker)
- Modify: `ITASK/frontend/resources/js/Pages/Committees/Show.tsx:1130-1450` (Replace raw `slate-*` classes with ITASK design tokens, show questionnaire strengths + availability alongside CV skills, add link to user's `/eligibility-profile`)
- Modify: `ITASK/frontend/resources/js/Pages/Projects/SmartSOImport.tsx` (Use `<AppLayout breadcrumbs={...}>`, fix all `bg-[color:var(--surface)]` -> tokenized `--card` / `--card-surface`, refine colors to match ITASK Warm Ember / Emerald semantic status grammar)
- Modify: `ITASK/frontend/resources/js/Pages/Projects/Index.tsx:174-205` (Polish `Smart S.O. Import` button alignment & mobile touch targets)

**Interfaces:**
- Consumes: `POST /projects/{project}/tasks/recommend-assignees` (`{ task_title, task_description, committee_id }`)
- Produces: Unified task-level AI/questionnaire deliberation inside `CreateProjectTaskModal.tsx` and `Activities/Show.tsx`, polished tokenized styles across `Committees/Show.tsx`, `SmartSOImport.tsx`, and `Projects/Index.tsx`.

- [ ] **Step 1: Add Task Deliberation helper component or hook in `CreateProjectTaskModal.tsx` and `Activities/Show.tsx`**

Note `ponytail` rule: extract one shared typed helper / subcomponent `frontend/resources/js/Components/TaskAssigneeDeliberationPanel.tsx` so `CreateProjectTaskModal.tsx` and `Activities/Show.tsx` do NOT duplicate fetch/ranking UI logic!
`TaskAssigneeDeliberationPanel.tsx`:
- Accepts `{ projectId, committeeId?, taskTitle, taskDescription?, selectedUserId, onSelectAssignee(userId) }`.
- Renders a compact panel right above/beside the assignee `<select>`: **"Deliberate Best Assignee (Strengths & CV)"** button (disabled until `taskTitle.trim().length > 0`).
- Fetches `POST /projects/${projectId}/tasks/recommend-assignees`, displays top ranked assignees with `% Match`, `Questionnaire` / `CV` badges, top competency strengths, availability, and 1-line deliberation rationale, with 1-click **"Assign"** pill button that sets `assigned_to`.

- [ ] **Step 2: Integrate `TaskAssigneeDeliberationPanel` into `CreateProjectTaskModal.tsx` & `Activities/Show.tsx`**

Wire `<TaskAssigneeDeliberationPanel>` inside both task-creation forms cleanly while preserving all existing form validation and submission behavior.

- [ ] **Step 3: Polish `Committees/Show.tsx`, `SmartSOImport.tsx`, and `Projects/Index.tsx` using Impeccable Operate-mode discipline**

- In `Committees/Show.tsx`:
  - Update Assign Members modal AI screening block & member rows (`lines 1140-1340`) to replace raw `bg-white dark:bg-[#14181F]` / `border-slate-*` with semantic tokens (`var(--card)`, `var(--background)`, `var(--border)`, `var(--text)`, `var(--muted)`, `var(--primary)`), show `CV` + `Questionnaire` source badges, top rated strengths, availability hours, and deliberation notes.
  - Add a subtle link inside the Assign / Attach CV modal pointing members to `/eligibility-profile` to fill out their Strengths Questionnaire.
- In `SmartSOImport.tsx`:
  - Switch `<AppLayout hidePageHeadingBanner={true}>` to use `AppLayout` `breadcrumbs={[{ label: 'Events', href: '/projects' }, { label: 'Smart S.O. Import' }]}` for navigation consistency across the app.
  - Fix every `bg-[color:var(--surface)]` (or ensure consistent `bg-[color:var(--card)]` / `bg-[color:var(--soft-surface)]` border hairlines) and replace off-brand accents with ITASK's documented Warm Ember (`--primary`) primary CTA + Emerald/Amber semantic status colors (`var(--status-success-*)`, `var(--status-neutral-*)`), and convert clickable accordion `<div onClick>` into semantic `<button type="button" aria-expanded={isExpanded}>` for keyboard/screen-reader accessibility!
- In `Projects/Index.tsx`:
  - Align "Smart S.O. Import" button with ITASK's flat hairline secondary button system (`Button variant="secondary"`).

- [ ] **Step 4: Compile frontend with `npm run build` and commit Task 6**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\frontend && npm run build"
```
Expected: Zero TypeScript/Vite errors.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add frontend/resources/js/ && git commit -m ui_polish_task_deliberation_committees_smart_so_and_tokens"
```

---

### Task 7: Impeccable Mechanical Detector, Accessibility Audit, Full Regression Suite & `genOS` Sync

**Files:**
- Modify: `ITASK/genOS/brain/20_PROGRESS.yaml`
- Modify: `ITASK/genOS/brain/30_DECISIONS.md`
- Modify: `ITASK/genOS/brain/systems/code/FrontendSPA.md`

**Interfaces:**
- Consumes: `ITASK/.agent/skills/impeccable/scripts/impeccable.cmd`, PHPUnit suite, Vite build
- Produces: Zero high-severity Impeccable detector defects, passing full backend test suite + production Vite build, and synced `genOS/brain/` records

- [ ] **Step 1: Run Impeccable mechanical detector on all modified UI files**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && .agent\skills\impeccable\scripts\impeccable.cmd detect --json frontend/resources/js/Layouts/AppLayout.tsx frontend/resources/js/Components/CommandPalette.tsx frontend/resources/js/Components/TaskAssigneeDeliberationPanel.tsx frontend/resources/js/Pages/Profile/EligibilityProfile.tsx frontend/resources/js/Pages/Projects/SmartSOImport.tsx frontend/resources/js/Pages/Committees/Show.tsx frontend/resources/js/Components/CreateProjectTaskModal.tsx"
```
Fix any real contrast, accessibility, motion, or semantic defect surfaced, then re-run `impeccable.cmd detect --json` cleanly.

- [ ] **Step 2: Perform `testing-accessibility-auditor` & `engineering-code-reviewer` check + run full PHPUnit suite & Vite build**

Run:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK\backend && php artisan test && cd /d c:\Users\USER\Desktop\iTasks\ITASK\frontend && npm run build"
```
Expected: 100% PHPUnit pass rate (all existing tests + `EligibilityQuestionnaireTest` + `OllamaResumeScreeningTest` + `SmartSpecialOrderImportTest`) and clean `vite build`.

- [ ] **Step 3: Sync `genOS/brain/` (`30_DECISIONS.md`, `FrontendSPA.md`, `20_PROGRESS.yaml`) cleanly and commit**

Record `DEC-007` (Hybrid CV OCR + Eligibility & Strengths Questionnaire + Impeccable Design System Authorities) and update `FrontendSPA.md` & `20_PROGRESS.yaml`.
Commit:
```cmd
cmd.exe /c "cd /d c:\Users\USER\Desktop\iTasks\ITASK && git add frontend/resources/ backend/public/build genOS/brain/ && git commit -m chore_sync_genos_brain_and_final_verified_build"
```
