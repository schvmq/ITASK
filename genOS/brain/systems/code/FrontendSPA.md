# FrontendSPA

## Purpose
Delivers a responsive, decoupled Single Page Application built with React 19, TypeScript, Vite, Tailwind CSS v4, and Lucide icons.

## Status
`stable`

## Responsibilities
- Rendering role-adaptive UI navigation based on current project permissions.
- Providing reactive modal workflows (Create Task, View Task, Join Project).
- Managing global state, notifications, and dark/light themes.
- Client-side proxying and API client request interceptors.

## Dependencies
- [[Authentication]]
- [[AuthorizationEngine]]

## Runtime References
- `frontend/resources/js/app.tsx`
- `frontend/resources/js/Config/navigation.ts`
- `frontend/resources/js/lib/api.ts`
- `frontend/vite.config.js`

## Invariants
- UI elements (such as approve buttons or admin panels) must conditionally render based on verified roles, backed by backend authorization enforcement.
- Hot module reloading (HMR) seamlessly syncs with Laravel via `public/hot`.

