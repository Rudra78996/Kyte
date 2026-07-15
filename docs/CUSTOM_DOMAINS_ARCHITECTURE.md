# Custom Domains Architecture

Kyte serves every project from its generated deployment hostname and can attach verified customer-owned hostnames to the same active deployment. A custom domain is never routable or eligible for a certificate until its owner completes verification.

## Components

| Component | Responsibility |
| --- | --- |
| Project Domains UI | Adds a hostname, shows its DNS records, retries verification, and manages the domain lifecycle. |
| Projects API | Normalizes hostnames, stores verification state, queries TXT records, and authorizes all project-owner actions. |
| PostgreSQL | Durable source of truth for a domain, its project, verification token, status, and verification timestamp. |
| Caddy | Receives public HTTPS traffic and requests certificates on demand only after the API approves the hostname. |
| Serve API | Resolves a verified hostname to the project’s active deployment and streams the requested asset from object storage. |
| MinIO/S3 | Stores deployment artifacts; it does not need to know about a customer hostname. |

## Lifecycle

1. A project owner adds a hostname in the Domains tab. The API lowercases and validates it, then creates a unique `kyte-verify=<random>` token in `CustomDomain` with status `pending`.
2. Kyte displays two records:
   - `CNAME <hostname> -> DOMAIN_CNAME_TARGET` (or `BASE_DOMAIN`) to send browser traffic to Kyte.
   - `TXT _kyte.<hostname> -> kyte-verify=<random>` to prove control of the hostname.
3. The owner adds those records at their DNS provider and chooses **Verify DNS**. The API resolves `_kyte.<hostname>` and marks the row `verified` only when the expected TXT value is present.
4. A request for the hostname reaches Caddy. Before Caddy obtains a certificate, its `on_demand_tls` `ask` endpoint checks the database through `GET /api/caddy/check-domain`. Pending or unknown hostnames receive a non-2xx response and cannot trigger certificate issuance.
5. For a verified hostname, Caddy rewrites the request to `/serve/domain/<hostname>/<path>`. The serve API looks up the verified `CustomDomain`, follows its project’s `activeDeploy`, and returns the matching object from MinIO/S3. SPA paths still fall back to `index.html`.

## Local and Production Routing

`Caddyfile` is the only edge proxy in both environments. Locally it serves the dashboard on `http://localhost` and routes generated `*.localhost` project URLs to the serve API. In production it terminates TLS and routes verified custom domains and generated Kyte subdomains.

Deploy the stack with:

```bash
docker compose up -d
```

Caddy must be reachable on ports 80 and 443 for ACME HTTP validation and certificate renewal.

Apply the database migration before starting the production proxy:

```bash
docker compose exec api npx prisma migrate deploy
```

## Required Configuration

Set these values in production:

```dotenv
BASE_DOMAIN=app.example.com
DOMAIN_CNAME_TARGET=app.example.com
```

`DOMAIN_CNAME_TARGET` is the hostname customers point subdomains at. For an apex domain, some DNS providers do not allow CNAME records; use their ALIAS/ANAME (or equivalent CNAME flattening) feature. The exact target must resolve to the public machine running Caddy.

## Security Properties

- Domain management endpoints are protected by the normal project-owner authorization.
- Tokens are random and only revealed to the authenticated owner of that project.
- Caddy’s certificate `ask` endpoint reads verified state from PostgreSQL, not an ephemeral cache. Restarting Redis or Caddy cannot accidentally approve a hostname.
- The public serving route rejects pending, unknown, and un-deployed domains.
- Deleting a domain removes its database record immediately, so subsequent certificate checks and origin requests are denied.

## Operational Notes

- DNS propagation is external and can take minutes or longer. Verification is intentionally retryable from the UI.
- A verified domain follows the project’s active deployment automatically; no DNS change is needed for each redeploy.
- The `CustomDomain` migration must be applied before enabling the Domains UI in an existing environment.
