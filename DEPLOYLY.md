# Deployly

> A self-hosted React deployment platform — push your code, get a live subdomain.

---

## What is Deployly?

Deployly is a self-hosted platform that takes a GitHub repository URL, builds the React app inside a secure sandbox, stores the output in object storage, and serves it on a unique subdomain (`<project>.deployly.dev`). Think a lightweight, self-hosted Vercel — built with the same backend stack you already know: NestJS, BullMQ, Redis, Docker.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend dashboard | Next.js + TypeScript |
| Backend API | NestJS (TypeScript) |
| Job queue | BullMQ + Redis |
| Build sandbox | nsjail (Linux namespaces) |
| Object storage | MinIO (S3-compatible) |
| Database | PostgreSQL via Prisma |
| Reverse proxy | Nginx (wildcard subdomain) |
| Auth | GitHub OAuth via Passport.js |
| Infra | Single EC2 instance, Docker Compose |

---

## High-Level Architecture

```
User Browser
     │
     │  HTTP / WebSocket
     ▼
Next.js Dashboard
     │
     │  REST / SSE
     ▼
NestJS API Server
  ├── AuthModule          (GitHub OAuth, JWT)
  ├── ProjectsModule      (CRUD, repo linking)
  ├── DeploymentsModule   (trigger, history, log stream)
  └── WebhooksModule      (GitHub push → auto deploy)
     │
     ├──────────────────────────────────┐
     │  Prisma ORM                      │  BullMQ enqueue
     ▼                                  ▼
PostgreSQL                         Redis
(Users, Projects,              (Job queue + log
 Deployments)                   pub/sub channels)
                                       │
                                       │  job pickup
                                       ▼
                              BullMQ Worker (Node.js)
                              Always-running process
                                       │
                                       │  execa spawn
                                       ▼
                          ┌─── nsjail sandbox ───────┐
                          │  git clone --depth 1     │
                          │  npm install             │
                          │    --ignore-scripts      │
                          │  npm run build           │
                          │  stdout → Redis pub/sub  │
                          └──────────────────────────┘
                                       │
                                       │  upload dist/
                                       ▼
                              MinIO (object storage)
                        projects/<id>/<deploy-id>/dist/
                                       │
                                       │  serve files
                                       ▼
                              Nginx reverse proxy
                        *.deployly.dev → EC2 IP
                        <project>.deployly.dev → MinIO prefix
                                       │
                                       └────────────▶ User browser
```

---

## Critical Design Decisions (Locked)

These decisions are part of the implementation baseline and should be treated as non-negotiable unless the architecture is intentionally revised.

1. **Project-level active deployment pointer**
   - `Project` includes `activeDeployId` (nullable).
   - Rollback is a metadata switch to a previous successful deployment, not a rebuild.

2. **Explicit deployment state machine**
   - Allowed transitions: `QUEUED -> BUILDING -> UPLOADING -> SUCCESS`.
   - Failure/terminal states: `FAILED`, `TIMEOUT`, `CANCELED`.
   - State transitions are validated in API service logic (not ad-hoc in multiple modules).

3. **Dual log pipeline (realtime + durable)**
   - Redis channel/stream is used for live log streaming to SSE clients.
   - Logs are also persisted (DB or object storage chunks) for replay after disconnect/reload.

4. **Sandbox execution split**
   - Source fetch/dependency preparation runs in a controlled pre-step.
   - Untrusted build execution runs inside nsjail with strict resource/time/process limits.

5. **Clear ownership boundaries**
   - API owns deployment orchestration, validation, and final state updates.
   - Worker owns execution: fetch, build, artifact packaging/upload, and progress events.

---

## End-to-End Deploy Flow

```
1.  User connects a GitHub repo on the dashboard
2.  User clicks "Deploy" (or a GitHub push webhook fires)
3.  POST /deployments  →  creates Deployment(status: QUEUED)  →  BullMQ job added
4.  Worker picks up the job  →  status: BUILDING
5.  Worker runs controlled pre-step (fetch/prepare), then executes build in nsjail
6.  Build stdout streams line-by-line to Redis pub/sub channel deploy:<deployId>
7.  NestJS SSE endpoint subscribes to that channel → pushes to browser
8.  Dashboard renders a live terminal UI via EventSource
9.  Build succeeds  →  dist/ uploaded to MinIO  →  status: UPLOADING → SUCCESS
10. Nginx serves <project>.deployly.dev from the new MinIO prefix
11. Dashboard shows the live URL + deploy history with rollback buttons
```

---

## Core Components

### NestJS API

Four modules cover everything:

- **AuthModule** — GitHub OAuth flow, issues JWT. Passport strategy handles the callback, stores `githubId` in the users table.
- **ProjectsModule** — CRUD for projects. Each project stores a `repoUrl`, `subdomain`, and `userId`. Subdomain is unique across the table.
- **DeploymentsModule** — `POST /deployments` enqueues a BullMQ job and creates a `Deployment` record. `GET /deployments/:id/logs` opens an SSE stream that relays Redis pub/sub messages to the browser.
- **WebhooksModule** — receives GitHub push webhooks, verifies the signature, and enqueues a deploy job automatically.

### BullMQ Worker

A long-running Node.js process (not recreated per deploy). Picks up jobs from the `builds` queue and orchestrates each build:

```typescript
const worker = new Worker('builds', async (job: Job) => {
  const { deployId, repoUrl } = job.data;
  const buildDir = `/tmp/builds/${deployId}`;

  fs.mkdirSync(buildDir, { recursive: true });

  await execa('nsjail', [
    '--mode', 'o',
    '--chroot', buildDir,
    '--user', '99', '--group', '99',
    '--time_limit', '300',
    '--rlimit_cpu', '30',
    '--rlimit_as', '536870912',   // 512 MB RAM
    '--disable_clone_newnet',     // no network inside sandbox
    '--',
    '/bin/sh', '-c',
    `git clone --depth 1 ${repoUrl} /app &&
     cd /app &&
     npm install --ignore-scripts &&
     npm run build`
  ], {
    stdout: chunk => publishLog(deployId, chunk.toString()),
    stderr: chunk => publishLog(deployId, chunk.toString()),
  });

  await uploadToMinio(deployId, `${buildDir}/app/dist`);
  await updateDeployStatus(deployId, 'SUCCESS');
  fs.rmSync(buildDir, { recursive: true, force: true });
});
```

BullMQ job timeout is set to 5 minutes — any build exceeding that is killed and marked `FAILED`.

### nsjail Sandbox

Every build runs inside an nsjail sandbox — a lightweight Linux namespace jail with no Docker overhead. The sandbox is isolated at the kernel level using PID namespaces, filesystem chroot, network namespaces, and cgroup resource limits.

| Constraint | Value | Purpose |
|---|---|---|
| `--network none` | disabled | Blocks exfiltration, reverse shells |
| `--rlimit_as` | 512 MB | Prevents memory bombs |
| `--rlimit_cpu` | 30s CPU | Prevents CPU exhaustion |
| `--pids-limit` | 50 | Prevents fork bombs |
| `--read-only` filesystem | enabled | Prevents writes outside /tmp |
| `--user 99` | nobody | No root inside sandbox |
| `--time_limit` | 300s wall clock | Hard timeout |
| `npm install --ignore-scripts` | flag | Blocks postinstall attack vector |
| `rmdir` after build | always | No leftover artifacts |

This is defense-in-depth: each layer independently limits blast radius even if another layer is bypassed.

### MinIO (Object Storage)

MinIO runs as a Docker container and exposes an S3-compatible API. The AWS SDK connects to it with `forcePathStyle: true` and the local endpoint — no code changes needed if you later migrate to real AWS S3.

```typescript
const s3 = new S3Client({
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  credentials: { accessKeyId: 'admin', secretAccessKey: 'password' },
  forcePathStyle: true,
});
```

Storage layout:

```
bucket: deployly-projects
  └── projects/
       └── <project-id>/
            └── <deploy-id>/        ← one prefix per deploy
                 ├── index.html
                 └── assets/
                      ├── main.js
                      └── main.css
```

Each deploy gets its own prefix. Rollback is just pointing Nginx at an older `deploy-id` — no rebuild needed.

### Live Log Streaming

```
nsjail stdout/stderr
      │
      │  publishLog() 
      ▼
Redis pub/sub  (channel: deploy:<deployId>)
      │
      │  subscribe
      ▼
NestJS SSE endpoint  GET /deployments/:id/logs
      │
      │  text/event-stream
      ▼
Browser  EventSource('/deployments/:id/logs')
      │
      ▼
Terminal UI in dashboard
```

No polling. No WebSocket setup overhead. SSE gives a persistent unidirectional stream that works over plain HTTP.

### Nginx Subdomain Routing

Wildcard DNS record: `*.deployly.dev → EC2 IP`

Nginx regex-captures the project slug from the hostname and forwards to a lookup endpoint:

```nginx
server {
  listen 80;
  server_name ~^(?<project>.+)\.deployly\.dev$;

  location / {
    proxy_pass http://localhost:3000/serve/$project$request_uri;
  }
}
```

The NestJS `/serve/:slug` endpoint looks up the project's active `deployId` from the database, resolves the MinIO prefix, and either proxies the file or returns a presigned URL redirect.

---

## Database Schema (Prisma)

```prisma
model User {
  id        String    @id @default(cuid())
  githubId  String    @unique
  username  String
  projects  Project[]
  createdAt DateTime  @default(now())
}

model Project {
  id          String       @id @default(cuid())
  name        String
  repoUrl     String
  subdomain   String       @unique
  activeDeployId String?   // points to currently live successful deployment
  userId      String
  user        User         @relation(fields: [userId], references: [id])
  deployments Deployment[]
  createdAt   DateTime     @default(now())
}

model Deployment {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
  status      Status    // QUEUED | BUILDING | SUCCESS | FAILED
  s3Prefix    String    // MinIO path prefix for this deploy
  commitSha   String
  branch      String
  deployedAt  DateTime  @default(now())
}

enum Status {
  QUEUED
  BUILDING
  UPLOADING
  SUCCESS
  FAILED
  TIMEOUT
  CANCELED
}
```

---

## Docker Compose

```yaml
version: '3.9'

services:
  api:
    build: ./server
    ports: ['3000:3000']
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/deployly
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      JWT_SECRET: ${JWT_SECRET}
    networks: [app-net]
    depends_on: [postgres, redis, minio]

  worker:
    build: ./server
    environment:
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: http://minio:9000
    volumes:
      - /tmp/builds:/tmp/builds   # build scratch space
    networks: [app-net, worker-net]
    depends_on: [redis]

  redis:
    image: redis:7-alpine
    networks: [app-net, worker-net]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: deployly
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes: [postgres_data:/var/lib/postgresql/data]
    networks: [app-net]

  minio:
    image: minio/minio
    command: server /data --console-address ':9001'
    ports: ['9000:9000', '9001:9001']
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password
    volumes: [minio_data:/data]
    networks: [app-net]

  nginx:
    image: nginx:alpine
    ports: ['80:80']
    volumes: ['./nginx.conf:/etc/nginx/nginx.conf:ro']
    networks: [app-net]
    depends_on: [api]

networks:
  app-net:
  worker-net:   # isolated — worker only reaches redis, not postgres/minio directly

volumes:
  postgres_data:
  minio_data:
```

> The `worker-net` is intentionally isolated. The worker only needs Redis (for the queue and log pub/sub). It never directly touches Postgres or MinIO — those writes go through the API after the build completes.

---

## Project Folder Structure

```
deployly/
├── server/                      # NestJS API + worker (TypeScript)
│   ├── src/
│   │   ├── auth/                # GitHub OAuth, JWT guard
│   │   ├── projects/            # Projects CRUD
│   │   ├── deployments/         # Deploy trigger, SSE logs
│   │   ├── webhooks/            # GitHub push webhook
│   │   ├── serve/               # Static file proxy (subdomain routing)
│   │   └── worker/              # BullMQ build worker runtime
│   └── prisma/
│       └── schema.prisma
│
├── web/                         # Next.js frontend dashboard (TypeScript)
│   └── app/
│       ├── page.tsx
│       └── layout.tsx
│
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## Key Features

### Rollback

Every deploy writes to its own MinIO prefix. Rolling back is a single DB update — set `activeDeployId` on the project to any previous `Deployment.id`. Nginx picks up the new prefix on the next request. No rebuild, no downtime beyond the lookup.

### Preview Deployments

Every deploy automatically gets its own URL:

```
<deploy-id>.<project>.deployly.dev
```

The main subdomain (`<project>.deployly.dev`) always points to the latest successful deploy. Preview URLs persist until manually deleted.

### Auto Deploy via Webhook

GitHub sends a `push` event to `POST /webhooks/github`. The `WebhooksModule` verifies the `X-Hub-Signature-256` header, extracts the repo URL and commit SHA, and enqueues a deploy job — same as a manual deploy, zero extra wiring.

---

## Security Summary

| Threat | Mitigation |
|---|---|
| Host filesystem access | nsjail chroot + read-only root fs |
| Secret exfiltration | `--disable_clone_newnet` (no network in sandbox) |
| Malicious postinstall scripts | `npm install --ignore-scripts` |
| Memory/CPU resource bombs | `--rlimit_as 512m`, `--rlimit_cpu 30`, `--pids-limit 50` |
| Privilege escalation | `--user 99` (nobody), `--no-new-privileges` |
| Stale build artifacts | `rmdir` in `finally` block — always runs |
| Long-running attacks | BullMQ job timeout: 5 minutes |
| Lateral movement to DB | Worker lives on isolated `worker-net` |

---

## Environment Variables

```env
# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Auth
JWT_SECRET=

# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/deployly

# Redis
REDIS_URL=redis://redis:6379

# MinIO
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password
MINIO_BUCKET=deployly-projects

# App
BASE_DOMAIN=deployly.dev
PORT=3000
```

---

## What to Build Next (Stretch Goals)

- **Custom domains** — let users bring their own domain, issue a Let's Encrypt cert via `certbot`, update Nginx config dynamically
- **Build cache** — hash `package.json` and reuse `node_modules` across deploys for the same project to cut build time
- **Environment variables per project** — UI to set `VITE_API_URL` etc., injected into the build as `--build-arg`
- **Team access** — invite collaborators to a project, role-based deploy permissions
- **Observability** — plug in the Grafana + Loki + Promtail stack to track build durations, failure rates, and queue depth
