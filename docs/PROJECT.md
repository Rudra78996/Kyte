# Project: Kyte Frontend Redesign

## Architecture
Kyte consists of:
- **Control Plane API (NestJS)**: Port 3000 (proxied via Nginx `/api/*`)
- **Frontend Dashboard (Next.js)**: Port 3002 (proxied via Nginx `/`)
- **Docker Compose Stack**: Postgres, Redis, MinIO, NestJS Server, Next.js Web Dashboard, Nginx Reverse Proxy.
- All routing and UI code resides in the `web/` directory.

## Code Layout
- `web/app/`: Next.js App Router routes and pages.
- `web/components/`: Reusable components (e.g. `AppSidebar`, UI primitives).
- `web/components/ui/`: shadcn/ui primitive components.
- `web/app/globals.css`: Global styles, themes, and tailwind layers.
- `web/tailwind.config.ts`: Tailwind configuration.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | E2E Testing Track | Design and implement the Playwright E2E test suite covering design system, components, routing, and APIs. | None | DONE |
| 2 | Design System & Spacing | Implement zinc-based dark theme, remove purple styles, configure 8px spacing system, establish font variables. | None | DONE |
| 3 | Sidebar & Layouts | Redesign sidebar navigation and global layout using shadcn/ui components. | M2 | DONE |
| 4 | Dashboard Pages | Redesign Overview and Deployments pages. | M3 | DONE |
| 5 | Project Detail & Logs | Redesign Project detail pages and live log terminal. | M3 | DONE |
| 6 | Settings & Create Flow | Redesign Settings page, Create Project flow, Onboarding. | M3 | PLANNED |
| 7 | Final E2E Pass & Hardening | Pass 100% of E2E test suite, perform Phase 2 adversarial coverage hardening. | M1, M4, M5, M6 | PLANNED |

## Interface Contracts
- Next.js Frontend ↔ NestJS API:
  - Base URL: `${NEXT_PUBLIC_API_BASE_URL}` (usually `/api` relative or `http://localhost/api`)
  - Authenticated requests pass the Clerk JWT token in the `Authorization` header.
  - Endpoints:
    - `GET /projects` - list projects
    - `GET /projects/:id/deployments` - list deployments for project
    - `POST /projects/:id/deployments` - trigger redeploy
    - `DELETE /projects/:id` - delete project
    - `POST /projects/:id/webhook/enable` - enable webhooks
    - `PATCH /projects/:id` - update project settings
    - `GET /organizations` - list organizations
