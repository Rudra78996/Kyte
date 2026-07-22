# Kyte

Kyte is a self-hosted frontend deployment platform for turning GitHub repositories into production websites. Connect a project, follow the build in real time, and publish it with an HTTPS URL from one workspace.

It is built for developers and small teams that want a focused deployment workflow without maintaining separate CI pipelines, build infrastructure, object storage, and routing by hand.

## What Kyte provides

- **GitHub integration** - import repositories and automatically deploy pushes from a selected production branch.
- **Isolated builds** - install dependencies and compile each application inside a dedicated build environment.
- **Live build logs** - watch builds as they happen and retain logs for failed deployments.
- **Deployment history** - review commits, build duration, status, and previously published versions.
- **Project URLs and HTTPS** - publish successful builds to a Kyte subdomain with automatic TLS.
- **Custom domains** - connect and verify a domain from the project workspace.
- **Environment variables** - manage project configuration without committing secrets to a repository.
- **Organizations** - group projects and deployments inside team workspaces.
- **Observability** - inspect traffic, latency, deployment health, and operational activity.
- **Operational safeguards** - signed GitHub webhooks, encrypted credentials, deployment concurrency controls, and webhook build limits.

## Product workflow

1. Sign in and create or select an organization.
2. Connect GitHub or provide a public repository.
3. Configure the branch, build command, output directory, and environment variables.
4. Start a deployment and follow its live logs.
5. Open the generated Kyte URL or attach a custom domain.
6. Enable GitHub automation for future pushes.

## Application links

When running locally through Docker Compose:

| Destination | URL |
| --- | --- |
| Landing page | [http://localhost](http://localhost) |
| Dashboard | [http://localhost/dashboard](http://localhost/dashboard) |
| Create project | [http://localhost/new](http://localhost/new) |
| Documentation | [http://localhost/docs](http://localhost/docs) |
| Contact | [http://localhost/contact](http://localhost/contact) |
| Sign in | [http://localhost/sign-in](http://localhost/sign-in) |
| Sign up | [http://localhost/sign-up](http://localhost/sign-up) |
| API health | [http://localhost/api/health](http://localhost/api/health) |
| MinIO console | [http://localhost:9001](http://localhost:9001) |

The Next.js development server is also available directly at [http://localhost:3002](http://localhost:3002) when its port is exposed.

## Documentation

- [Documentation overview](http://localhost/docs)
- [GitHub integration](http://localhost/docs/github)
- [Organizations](http://localhost/docs/organizations)
- [Next.js deployments](http://localhost/docs/nextjs)
- [React deployments](http://localhost/docs/react)
- [Vue deployments](http://localhost/docs/vue)
- [Continuous deployment](http://localhost/docs/ci-cd)
- [Observability](http://localhost/docs/observability)
- [Custom domains](http://localhost/docs/custom-domains)

## Architecture

```text
Browser
  |
Caddy gateway
  |-- Next.js web application
  |-- NestJS API
  |-- Published project sites

NestJS API
  |-- PostgreSQL for application data
  |-- Redis and BullMQ for deployment jobs
  |-- MinIO for build artifacts and published assets
  |-- Worker and isolated build runner
```

The repository is organized into:

| Path | Purpose |
| --- | --- |
| [`web/`](web/) | Next.js landing page, dashboard, authentication, and documentation |
| [`server/`](server/) | NestJS API, worker, build runner, Prisma schema, and deployment services |
| [`infra/`](infra/) | Gateway, storage, image, and least-privilege infrastructure assets |
| [`docker-compose.yml`](docker-compose.yml) | Local application and infrastructure stack |
| [`.env.example`](.env.example) | Required environment variables and local defaults |

## Local development

### Requirements

- Docker with Docker Compose
- Node.js and npm for running individual services outside Docker
- A Clerk development application
- A GitHub OAuth application for repository access and automatic deployments

### Start the complete stack

1. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required credentials and generate independent secrets as described in [`.env.example`](.env.example).

3. Start Kyte:

   ```bash
   docker compose up --build
   ```

4. Open [http://localhost](http://localhost).

### Run the web application

```bash
cd web
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run build
npm run test:auth
```

### Run the API

```bash
cd server
npm install
npx prisma generate
npm run start:dev
```

Useful commands:

```bash
npm run build
npm test
npm run test:e2e
npm run security:preflight
```

## Configuration notes

- Never reuse development credentials in production.
- Generate separate values for database, Redis, MinIO, webhook, and encryption secrets.
- `WEBHOOK_CALLBACK_URL` must be a public HTTPS endpoint that GitHub can reach.
- `NEXT_PUBLIC_SITES_DOMAIN`, `SITES_DOMAIN`, and DNS must agree for published project URLs.
- Review the production attestation variables in [`.env.example`](.env.example) before a release.

## Current scope

Kyte currently focuses on frontend applications that produce static output. The platform is private software and the server package is marked `UNLICENSED`; no permission to redistribute or reuse the source is granted unless the repository owner provides it separately.
