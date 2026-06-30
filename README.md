# Deployly

Phase 0 foundation for a frontend hosting platform with:

- `server/` - NestJS API (TypeScript)
- `web/` - Next.js dashboard (TypeScript)
- `docker-compose.yml` - local infrastructure and app services

## Local setup

1. Copy environment template:
   - `cp .env.example .env`
2. Start services:
   - `docker compose up --build`

## Service URLs (default)

- Nginx gateway: `http://localhost:80`
- API health: `http://localhost:80/api/health`
- Web app: `http://localhost:3002`
- MinIO console: `http://localhost:9001`

