# Kyte

Kyte is a frontend deployment platform that turns GitHub repositories into production websites. It brings project configuration, builds, deployments, domains, and operational visibility into one focused workspace.

The product is designed for developers and small teams that want a clear path from `git push` to a live HTTPS deployment without maintaining a separate CI pipeline or assembling several infrastructure services themselves.

## Hosted product

- [Kyte](https://app.kyte.rudrx.cloud)
- [Documentation](https://app.kyte.rudrx.cloud/docs)
- [Dashboard](https://app.kyte.rudrx.cloud/dashboard)
- [Contact](https://app.kyte.rudrx.cloud/contact)


## Architecture

Kyte separates the product interface, control plane, deployment pipeline, build execution, and published sites.

![Kyte architecture showing the flow from a developer and GitHub through the web application, API, deployment worker, isolated build runner, storage, and published sites.](/assets/arc.png)

The web application is the entry point for developers. The API coordinates product data and deployment jobs, workers move builds through an isolated runner, and successful artifacts are stored and published to HTTPS project URLs.

## Repository structure

| Path | Responsibility |
| --- | --- |
| [`web/`](web/) | Product website, dashboard, authentication, and documentation |
| [`server/`](server/) | API, deployment worker, build runner, and persistence layer |
| [`infra/`](infra/) | Gateway, storage, security, and infrastructure assets |
| [`docker-compose.yml`](docker-compose.yml) | Complete service topology |

## Technology

<p align="left"> <img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"> <img alt="React" src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"> <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"> <img alt="NestJS" src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white"> <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"> <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white"> <img alt="Redis" src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white"> <img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-DC382D?style=for-the-badge&logo=redis&logoColor=white"> <img alt="MinIO" src="https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white"> <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"> <img alt="Caddy" src="https://img.shields.io/badge/Caddy-1F88C0?style=for-the-badge&logo=caddy&logoColor=white"> <img alt="Clerk" src="https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white"> <img alt="GitHub OAuth" src="https://img.shields.io/badge/GitHub_OAuth-181717?style=for-the-badge&logo=github&logoColor=white"> </p>

## Features

| Deploy from GitHub | Follow every build |
| --- | --- |
| Connect a repository, select the production branch, and deploy automatically when new code is pushed. | Stream build output in real time and keep the commit, status, duration, and logs together. |
| **Publish without downtime** | **Configure in one place** |
| Keep the last successful release live when a new build fails. Every successful release receives an HTTPS project URL. | Manage build settings, environment variables, automation, production branches, and domains from one project workspace. |
| **Bring your own domain** | **Work as a team** |
| Verify a custom domain and let Kyte handle secure delivery through the same deployment workflow. | Organize projects and deployments in shared workspaces with a clear view of recent activity. |
| **See what is happening** | **Ship with guardrails** |
| Understand deployment health, traffic, latency, and operational events without leaving the product. | Rely on signed webhooks, encrypted credentials, isolated builds, concurrency controls, and sensible build limits. |

## How Kyte works

1. Create a workspace and connect a repository.
2. Confirm the detected framework and build configuration.
3. Deploy and follow the live build output.
4. Publish the successful result to an HTTPS project URL.
5. Attach a custom domain or enable automatic deployments for future pushes.
