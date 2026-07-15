# Caddy Architecture

## Purpose

Caddy is Kyte's single public edge. It replaces Nginx and is responsible for four jobs:

1. Route dashboard traffic to the Next.js web service.
2. Route API traffic to the NestJS API service.
3. Route generated project URLs and verified customer domains to the deployment-serving API.
4. Obtain, renew, and store TLS certificates.

The application containers remain private on the Compose `app-net` network. Only Caddy publishes ports to the host, so all browser traffic enters through one place.

## Topology

```text
Browser
  |
  | HTTP :80 / HTTPS :443
  v
Caddy
  |-- dashboard request ----------> web:3000 (Next.js)
  |-- /api/* request -------------> api:3000 (NestJS)
  |-- project/custom host request -> api:3000/serve/host/... -> MinIO/S3
  |
  +-- certificate authorization --> api:3000/api/caddy/check-domain -> PostgreSQL
```

## Caddyfile Layout

The [`Caddyfile`](./Caddyfile) has four request paths.

| Site block | What it accepts | Upstream behavior |
| --- | --- | --- |
| `http://localhost` | Local dashboard and API traffic | `/api/*` has its prefix stripped and goes to NestJS; all other paths go to Next.js. |
| `http://*.localhost` | Local generated project URLs | Rewrites to `/serve/host/<host>/<path>` on NestJS. |
| `{$BASE_DOMAIN}` | Public Kyte dashboard and API | Uses Caddy-managed HTTPS for the configured application hostname. |
| `https://` | Any HTTPS hostname not handled above | Uses on-demand TLS, rewrites to the serving API, and only completes a handshake after Kyte approves the hostname. |

`reverse_proxy` preserves the original request host and adds trusted `X-Forwarded-*` headers. The API uses the rewritten path to select the destination deployment; Caddy does not need to know object-storage paths or project IDs.

## Request Routing

### Dashboard and API

Requests to the Kyte application hostname have two handlers. `/api/*` is proxied to `api:3000` after removing `/api`; everything else is proxied to `web:3000`. This keeps browser URLs stable while NestJS controllers keep their existing route names.

### Generated project URLs

A generated hostname such as `my-project.localhost` is rewritten to `GET /serve/host/my-project.localhost/...`. `ServeService` extracts the slug and resolves the project's active deployment. For a public base domain, the same logic handles `my-project.<BASE_DOMAIN>`.

### Custom domains

A verified hostname such as `www.example.com` is rewritten to the same `/serve/host/www.example.com/...` endpoint. The API looks up `CustomDomain`, rejects anything except `verified`, follows the linked project's active deployment, and streams the requested object from MinIO/S3. Unknown, pending, deleted, or undeployed domains return 404.

## TLS and Certificate Authorization

Caddy automatically manages the certificate for `BASE_DOMAIN`. It also enables on-demand TLS for other HTTPS hosts. On-demand TLS is protected by the global `on_demand_tls` configuration:

```text
Caddy handshake for hostname
  -> GET /api/caddy/check-domain?domain=<hostname>
  -> PostgreSQL indexed lookup
  -> 2xx: Caddy may obtain or renew a certificate
  -> non-2xx: handshake stops; no certificate is requested
```

The check endpoint approves either a `CustomDomain` with status `verified` or a real generated project subdomain under `BASE_DOMAIN`. It does not perform DNS lookups, loops, or cache-dependent checks, which keeps the certificate decision fast and durable. Caddy stores account data and issued certificates in the `caddy_data` Docker volume, so restarts do not reissue certificates unnecessarily.

## Docker Deployment

The `caddy` Compose service is the only service that publishes public ports:

```yaml
ports:
  - "${CADDY_HTTP_PORT:-80}:80"
  - "${CADDY_HTTPS_PORT:-443}:443"
```

It mounts three things: the `Caddyfile`, `caddy_data` for certificates and ACME account state, and `caddy_config` for runtime configuration. Keep both named volumes when redeploying. The service reaches `api:3000` and `web:3000` through Docker DNS on `app-net`; `localhost` inside Caddy would refer to the Caddy container itself and must not be used for those upstreams.

## Required Production Settings

```dotenv
BASE_DOMAIN=app.example.com
DOMAIN_CNAME_TARGET=app.example.com
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
```

Point `BASE_DOMAIN` at the public host running Caddy. Customer subdomains use a CNAME to `DOMAIN_CNAME_TARGET`; apex domains need ALIAS/ANAME or provider-side CNAME flattening. Ports 80 and 443 must be publicly reachable by Caddy for HTTP ACME validation and renewal.

## Operations

- Start or update: `docker compose up -d --build`
- Inspect the effective Compose configuration: `docker compose config`
- Follow edge logs: `docker compose logs -f caddy`
- Validate a Caddyfile in the container: `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
- Reload after a Caddyfile-only change: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile`

When changing `BASE_DOMAIN`, update DNS first and keep the existing `caddy_data` volume mounted. Deleting that volume discards Caddy's stored certificates and ACME account state.
