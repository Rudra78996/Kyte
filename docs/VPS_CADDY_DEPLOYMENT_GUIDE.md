# VPS Deployment Guide: Shared Caddy for Kyte and Other Projects

## The Recommended Layout

For a VPS that hosts several applications, install **one Caddy instance on the VPS host**. Do not run a separate public Caddy container for each Compose project. The host Caddy process owns ports 80 and 443, obtains all certificates, and proxies each hostname to an application bound to `127.0.0.1`.

Kyte already includes an embedded Docker Caddy service for local use or a dedicated server. On a shared VPS, use `docker-compose.host-caddy.yml`; it disables that embedded service so the host Caddy instance is the only process on public ports.

```text
Internet
  |
  v
Host Caddy (:80, :443)
  |-- app.example.com ------------> Kyte web/API on 127.0.0.1:3002 / :3000
  |-- customer.example.net --------> Kyte serving API on 127.0.0.1:3000
  |-- blog.example.com ------------> another application on 127.0.0.1:4000
  `-- status.example.com ----------> another application on 127.0.0.1:4100
```

The Compose file binds Kyte's API, web, Postgres, and MinIO ports to loopback. They remain reachable by Caddy and SSH port forwarding, but are not exposed directly to the internet.

## Why the Screenshot Showed an Error

The error was caused by an existing local database that had a `CustomDomain` table but not the new `verifiedAt` column. It was not a Caddy or local-domain limitation. The migration has now been applied locally.

For any other environment with the same error, deploy the current API image and run:

```bash
docker compose exec api npx prisma migrate deploy
```

Then refresh the Domains tab. Never use `prisma db push` as the production migration step.

## Prerequisites

These commands assume Ubuntu or Debian, a sudo-enabled user, Docker Engine with Compose v2, and a domain you control.

Before touching the VPS:

1. Create an `A` record for `app.example.com` pointing to the VPS public IPv4 address.
2. Create `*.app.example.com` pointing to the same address if Kyte generated project subdomains will be public.
3. Open inbound TCP ports `80` and `443` in both the VPS firewall and the cloud-provider firewall/security group.
4. Keep SSH (`22`) open in the firewall before making any web-server changes.

For customer-owned domains, Kyte later gives the customer a CNAME/ALIAS record to the Kyte application hostname and a TXT record for ownership verification.

## 1. Back Up and Retire Nginx

Do this during a small maintenance window. Keep the backup until every hostname works through Caddy.

```bash
sudo mkdir -p /root/nginx-backup
sudo cp -a /etc/nginx /root/nginx-backup/$(date +%F)
sudo nginx -T | sudo tee /root/nginx-backup/nginx-expanded.conf >/dev/null
sudo systemctl disable --now nginx
sudo ss -ltnp '( sport = :80 or sport = :443 )'
```

The last command should show that nothing is listening on ports 80 and 443. Do **not** purge Nginx yet; first make Caddy serve every existing hostname. After validation:

```bash
sudo apt purge nginx nginx-common
sudo apt autoremove
```

## 2. Install Caddy on the VPS Host

Install the official package, which creates and manages the `caddy` systemd service:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Set firewall rules if UFW is enabled:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 3. Deploy Kyte Without Its Embedded Caddy

Copy the project to the server, for example under `/opt/kyte`, and create a production `.env`. Set real values, especially these:

```dotenv
NODE_ENV=production
BASE_DOMAIN=app.example.com
DOMAIN_CNAME_TARGET=app.example.com
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
NEXT_PUBLIC_API_BASE_URL=https://app.example.com/api
```

The first deployment and every application update use the host-Caddy Compose override:

```bash
cd /opt/kyte
docker compose -f docker-compose.yml -f docker-compose.host-caddy.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.host-caddy.yml exec api npx prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.host-caddy.yml ps
```

The override gives the embedded `caddy` service a profile, so normal `up` does not start it. Docker Compose profiles exclude services unless their profile is activated; leave `embedded-caddy` inactive on this VPS.

## 4. Configure the Shared Caddyfile

Start from the repository template:

```bash
sudo cp /opt/kyte/Caddyfile.vps.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Make these edits before validating:

1. Replace `admin@example.com` with the address that should receive ACME certificate notices.
2. Replace every `app.example.com` with the exact `BASE_DOMAIN` in Kyte's `.env`.
3. Keep `127.0.0.1:3000` and `127.0.0.1:3002` unless you intentionally changed Kyte's loopback ports.
4. Replace or remove the example `blog.example.com` and `status.example.com` blocks.

Validate before reloading. Caddy keeps the active configuration if validation fails:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

## 5. Add Other Projects to the Same Caddyfile

Yes, one host Caddyfile is meant to serve all projects on the VPS. Each ordinary application gets one fixed hostname block and a loopback upstream:

```caddyfile
docs.example.com {
	reverse_proxy 127.0.0.1:4200
}

api.other-example.com {
	reverse_proxy 127.0.0.1:4300
}
```

Bind each other application's Docker port to loopback, for example `127.0.0.1:4200:3000`, rather than publishing it globally. Add fixed hostname blocks **before** Kyte's `https://` catch-all block. The catch-all is specific to Kyte custom domains and must occur only once in the shared Caddyfile.

The repository [`Caddyfile`](./Caddyfile) is for the embedded Docker Caddy service, so it uses Docker service names such as `api:3000` and `web:3000`. It will not work unchanged for a host-installed Caddy process. Use [`Caddyfile.vps.example`](./Caddyfile.vps.example) on the VPS because it proxies to `127.0.0.1` instead.

## 6. Verify the Deployment

Run these checks after DNS has propagated:

```bash
curl -I http://app.example.com
curl -I https://app.example.com
curl -sS http://127.0.0.1:3000/health
sudo journalctl -u caddy -n 100 --no-pager
docker compose -f docker-compose.yml -f docker-compose.host-caddy.yml logs --tail=100 api
```

The first HTTP request should redirect to HTTPS. The HTTPS response should be successful and have a publicly trusted certificate. A custom domain remains pending until its TXT record is visible; only then will Kyte's `/api/caddy/check-domain` endpoint allow Caddy to issue a certificate.

## Certificate Scaling Note

Kyte's current configuration obtains certificates on demand for verified customer domains and generated project subdomains. That is appropriate for an initial deployment, because the database gate prevents unknown hosts from requesting certificates. Public certificate authorities still enforce issuance-rate limits, however.

When you expect a large number of generated `*.app.example.com` project URLs, use a wildcard certificate for that Kyte-owned subdomain through your DNS provider's ACME DNS challenge. That requires a Caddy build with the DNS provider plugin and provider-scoped credentials. Keep customer-owned domains on the existing verified on-demand path; Kyte cannot obtain a wildcard certificate for domains it does not control.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `Internal server error` in Domains | Apply migrations with `docker compose ... exec api npx prisma migrate deploy`; inspect API logs for `P2022`. |
| Caddy cannot start | Another process still owns port 80 or 443. Check `sudo ss -ltnp '( sport = :80 or sport = :443 )'`. |
| Certificate is not issued | Confirm DNS points to the VPS, ports 80/443 are open, and the domain is verified in Kyte. Check `sudo journalctl -u caddy -f`. |
| Caddy returns 502 | Confirm the app container is healthy and its loopback port is listening: `curl -I http://127.0.0.1:3002`. |
| Other project opens Kyte instead | Move that project's fixed hostname block above Kyte's `https://` catch-all block, validate, and reload Caddy. |

## Do I Need Docker Caddy on the VPS?

Not for a shared VPS. Use the host-installed Caddy service and the `docker-compose.host-caddy.yml` override. Use the embedded Docker Caddy only when Kyte is the sole public application on a machine, or for local development. Never run both host Caddy and the embedded Caddy on ports 80/443 at the same time.
