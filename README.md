# Kyte

A self-hosted frontend deployment platform with:

- `server/` - NestJS API (TypeScript)
- `web/` - Next.js dashboard (TypeScript)
- `infra/` - pinned infrastructure image and least-privilege policy assets
- `docker-compose.yml` - local infrastructure and application services

## Local setup

1. Copy environment template:
   - `cp .env.example .env`
2. Start services:
   - `docker compose up --build`

## Service URLs (default)

- Caddy gateway: `http://localhost:80`
- API health: `http://localhost:80/api/health`
- Web app: `http://localhost:3002`
- MinIO console: `http://localhost:9001`
