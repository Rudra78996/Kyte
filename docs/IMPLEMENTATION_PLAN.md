# Deployly Implementation Plan (Phase-wise)

This document converts the architecture into an execution roadmap with clear phases, dependencies, deliverables, and completion criteria.

---

## 1. Product Goal and Scope

Build a self-hosted frontend hosting platform where users can:

1. Sign in with email/password
2. Connect a repository
3. Trigger deploys (manual + webhook)
4. View live build logs
5. Get a hosted URL per project and per deployment
6. Roll back to a previous successful deploy

Initial focus is **frontend static apps** (Vite/React-like output in `dist` or configurable build output).

---

## 2. Final Architecture (Execution Model)

### Control Plane
- **Dashboard (React/Next.js)** for user interactions.
- **API (NestJS)** for auth, projects, deployments, GitHub integration, webhooks, serving metadata.
- **PostgreSQL (Prisma)** as source of truth.

### Build Plane
- **BullMQ + Redis** for async jobs and event streaming.
- **Worker (Node.js)** to run build workflow.
- **Sandbox (nsjail)** to isolate user build execution.

### Data Plane
- **MinIO (S3-compatible)** for immutable deployment artifacts.
- **Nginx + API serve resolver** for wildcard subdomain routing.

---

## 3. Critical Design Decisions (Finalize Before Coding)

1. **Project model must include active deployment pointer**
   - Add `activeDeployId` on `Project` (nullable).
   - Rollback = update pointer only.

2. **State machine is explicit and enforced**
   - `QUEUED -> BUILDING -> UPLOADING -> SUCCESS`
   - Failure paths: `FAILED`, `TIMEOUT`, `CANCELED`

3. **Log strategy is dual**
   - Real-time stream: Redis pub/sub or streams.
   - Durable history: DB/object storage for replay after disconnect.

4. **Sandbox networking policy**
   - If network disabled inside sandbox, do clone/install in a controlled pre-step.
   - Keep untrusted build execution isolated with strict limits.

5. **Ownership boundaries**
   - API owns state transitions and validation.
   - Worker executes jobs and reports progress/results.

---

## 4. Phase Plan

## Phase 0 - Foundation and Repo Setup

### Objective
Create a stable baseline for local development and deployment.

### Scope
- Monorepo/workspace setup confirmation
- Docker Compose stack (api, worker, postgres, redis, minio, Caddy)
- Environment template (`.env.example`)
- Shared TypeScript config and lint rules
- Basic health endpoints (`/health`)

### Deliverables
- One-command local startup (`docker compose up`)
- All core services healthy
- Clear README bootstrapping steps

### Exit Criteria
- New contributor can boot platform locally without manual fixes.

---

## Phase 1 - Data Model and Auth Backbone (Backend-first)

### Objective
Establish secure identity and core relational schema.

### Scope
- Prisma schema for:
  - `User`
  - `Project` (+ `activeDeployId`)
  - `Deployment` (+ status, branch, commit, s3Prefix)
  - `GitHubConnection` (optional linked account/token metadata)
  - optional `DeploymentLogChunk` (if DB log storage chosen)
- Email/password auth + JWT issue/verify
- Optional GitHub account connect flow (for private repos + webhook setup)
- Public repository deploy path without GitHub OAuth
- Auth guards for protected APIs

### Backend Tasks
- Define migrations
- Implement email/password auth module and session/token flow
- Implement GitHub connect/disconnect callback handling
- Store connected GitHub identity and permission scope metadata
- Secure token handling and expiry policy

### Deliverables
- Working login/logout/session flow
- User-scoped project ownership model

### Exit Criteria
- Authenticated user can call protected API successfully.

---

## Phase 2 - Projects and Deployment API Contracts

### Objective
Expose stable APIs for dashboard and worker orchestration.

### Scope
- Projects CRUD
- Deployments create/list/detail endpoints
- Deployment trigger endpoint
- Validation and ownership checks

### Backend Tasks
- `POST /projects`, `GET /projects`, `PATCH/DELETE /projects/:id`
- `POST /deployments`, `GET /deployments`, `GET /deployments/:id`
- Save deployment request metadata (`repoUrl`, branch, commit)
- Idempotency support for repeated trigger events

### Deliverables
- OpenAPI/contract-ready API surface for frontend integration

### Exit Criteria
- Creating a deployment record enqueues a queue job reliably.

---

## Phase 3 - Queue, Worker, and Build Execution Pipeline

### Objective
Run deployments asynchronously and safely.

### Scope
- BullMQ queue setup
- Worker process with retry/backoff policy
- Build workspace lifecycle
- Worker execution pipeline (standard execa isolation for MVP)

### Worker Tasks
- Job consume/ack/fail patterns
- Clone repository and checkout commit
- Install dependencies with hardened flags
- Run build command
- Capture stdout/stderr line-by-line
- Mark status transitions correctly

### Security Controls (MVP Level)
- Non-root execution where possible
- Filesystem cleanup on success/failure (`finally`)
- Baseline Docker container isolation (separated worker network)

### Deliverables
- End-to-end build from repo to local artifact folder

### Exit Criteria
- Valid repo builds complete; invalid repo fails with actionable logs.

---

## Phase 4 - Artifact Storage and Serve Path Resolution

### Objective
Publish and serve immutable deployment artifacts.

### Scope
- MinIO bucket and prefix convention
- Upload pipeline (`projects/<projectId>/<deployId>/...`)
- `s3Prefix` tracking in deployment row
- Active deployment resolver

### Backend Tasks
- Upload and verify artifact integrity
- Implement `/serve/:slug/*path` resolver
- Return file stream or signed redirect
- Correct content-type, cache headers, and index fallback rules

### Deliverables
- Project URL serves current active deployment
- Rollback by pointer switch only

### Exit Criteria
- User can open live hosted URL after successful deployment.

---

## Phase 5 - Live Logs and Realtime Deployment UX

### Objective
Provide high-quality deployment visibility in dashboard.

### Scope
- SSE endpoint for live logs
- Durable log replay on reconnect
- Deployment timeline/status UI

### Frontend Tasks
- Projects list and deployment history screens
- Deploy trigger actions
- Live terminal component with auto-scroll/stream handling
- Error and empty states

### Backend Tasks
- `GET /deployments/:id/logs` SSE endpoint
- Event formatting and channel lifecycle

### Deliverables
- User sees real-time build progress and final result without polling

### Exit Criteria
- Browser refresh during build can recover and continue log viewing.

---

## Phase 6 - GitHub Webhooks and Auto Deploy

### Objective
Automate deployment from repository events.

### Scope
- GitHub webhook endpoint
- Signature verification (`X-Hub-Signature-256`)
- Push event parsing and branch filtering

### Tasks
- Deduplicate duplicate deliveries
- Attach webhook deployment to project and branch policy
- Record trigger source (manual/webhook)

### Deliverables
- Push to configured branch triggers deployment automatically

### Exit Criteria
- Webhook deploy path is as reliable as manual deploy path.

---

## Phase 7 - Reliability, Security Hardening, and Operations

### Objective
Prepare v1 for real workloads and failure scenarios.

### Scope
- Retry and dead-letter strategy
- Stuck job reconciliation
- Rate limits and abuse controls
- Secret management hardening
- Operational dashboards and alerts

### Tasks
- Worker heartbeats and timeout reconciliation
- Queue depth and build duration metrics
- Structured logs for API/worker
- **Implement strict nsjail sandboxing** (Compile nsjail from source in a custom Dockerfile, grant `privileged: true` or specific capabilities to worker container, and enforce CPU/RAM/PID limits).
- Security audit pass for sandbox and auth/webhooks

### Deliverables
- Stable and observable system under expected load

### Exit Criteria
- Known failure modes have deterministic recovery paths.

---

## Phase 8 - Product Enhancements (Post-MVP)

### Objective
Increase product value after core reliability is achieved.

### Candidate Features
- Preview URLs per deployment
- Branch-based environments (staging/production)
- Custom domains + TLS automation
- Team roles and permissions
- Build cache optimization
- Usage quotas and billing hooks

### Exit Criteria
- Feature additions do not regress deployment reliability baseline.

---

## 5. Cross-Phase Workstreams

These run continuously across phases:

1. **Testing**
   - Unit tests for services/state transitions
   - Integration tests for deployment flow
   - E2E tests for auth + deploy + serve + rollback

2. **Migration discipline**
   - Forward-only migrations
   - Rollback plan for schema changes

3. **Documentation**
   - API contracts
   - Env var matrix
   - Incident runbooks

4. **Security reviews**
   - OAuth scopes minimization
   - Webhook replay protection
   - Sandbox hardening checks

---

## 6. Recommended Timeline (12-Week MVP Track)

1. **Weeks 1-2**: Phase 0 + Phase 1
2. **Weeks 3-4**: Phase 2
3. **Weeks 5-6**: Phase 3
4. **Weeks 7-8**: Phase 4
5. **Weeks 9-10**: Phase 5 + Phase 6
6. **Weeks 11-12**: Phase 7 and MVP hardening

Phase 8 starts after MVP stabilization.

---

## 7. MVP Definition of Done

MVP is complete when all are true:

1. User can authenticate via email/password.
2. User can create a project and connect a repo.
3. User can deploy public GitHub repositories without connecting GitHub.
4. User can optionally connect GitHub and trigger deployment via webhook.
5. Build runs asynchronously with live log streaming.
6. Successful artifacts are hosted on `<project>.<base-domain>`.
7. Rollback to previous successful deployment works instantly.
8. Failures are visible with actionable logs and consistent statuses.

---

## 8. Immediate Next Actions (Execution Kickoff)

1. Finalize Prisma schema (include `activeDeployId`, deployment states, trigger source).
2. Implement Phase 1 auth + migrations.
3. Lock API contracts for Phase 2 before frontend integration.
4. Build worker skeleton with state transitions and logging hooks.
5. Add a minimal vertical slice demo: trigger deploy -> queued job -> mocked success state update.
