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
