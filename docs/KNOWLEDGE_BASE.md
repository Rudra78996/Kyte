# Kyte application knowledge base

## 1. Purpose and scope

Kyte is a self-hosted control plane for building and publishing static frontend
applications from GitHub repositories. It combines account authentication,
workspaces, repository access, build configuration, a deployment queue,
isolated build execution, artifact storage, generated HTTPS URLs, custom
domains, build logs, traffic observability, and administrative controls.

This document describes the application as implemented in this repository. It
does not contain a roadmap, migration proposal, or future design. When the
product copy and this document disagree, the source files named throughout this
document are the implementation source of truth.

Kyte currently publishes static files. It does not run a project’s persistent
Node server, server-side rendering process, database, background worker, or
serverless functions. A framework can be deployed only when its build produces
a static output directory that Kyte can upload and serve.

## 2. Feature inventory

### Website/product surface

- Marketing homepage.
- Product documentation for supported frameworks, GitHub, CI/CD, organizations,
  observability, and custom domains.
- Contact form submitted directly from the browser to a configured FormSubmit
  AJAX endpoint.
- Terms page.
- Clerk-hosted sign-in and sign-up components inside a Kyte-styled centered
  authentication page.

Only the root homepage and Clerk sign-in/sign-up routes are currently
unauthenticated in `web/proxy.ts`. Despite being informational pages,
`/docs`, `/contact`, and `/terms` are protected by the current route matcher.

### Authenticated product surface

- First-use workspace onboarding.
- Workspace selector stored in browser `localStorage`.
- Project dashboard and cross-project deployment list.
- GitHub repository connection and repository listing.
- Project creation with repository, branch, framework preset, root directory,
  build command, output directory, and environment variables.
- Manual deployment and redeployment.
- Automatic deployment from signed GitHub push webhooks.
- Live and historical deployment logs, log search, copy, and download.
- Generated project hostname and embedded live preview.
- Project settings and encrypted environment-variable management.
- Custom-domain registration, DNS instructions, ownership verification, and
  automatic TLS.
- Traffic and deployment observability for 7, 30, or 90 days.
- Account usage and GitHub disconnect/cleanup.

### Administrative surface

- Global counts and active deployment overview.
- User search, role management, per-user project limit overrides, and deletion.
- Hosted-project search, sorting, inspection, and deletion.
- Deployment history and active-deployment cancellation.
- Global deployment intake pause/resume.
- Default project-limit configuration.

## 3. Repository and process boundaries

| Path | Runtime responsibility |
| --- | --- |
| `web/` | Next.js web process: public pages, dashboard, Clerk UI, and browser clients |
| `server/src/` | NestJS API process: authorization, product data, queue intake, serving, metrics |
| `server/src/worker/worker.ts` | Trusted BullMQ worker: job state, secret decryption, artifact publication |
| `server/src/worker/build-runner.ts` | Untrusted-code execution coordinator inside the runner container |
| `server/src/worker/build-exchange.ts` | File protocol between trusted worker and isolated runner |
| `server/prisma/` | PostgreSQL models and migration history |
| `infra/minio/` | Pinned MinIO build and least-privilege application policy |
| `Caddyfile` | Embedded/local edge routing and response-header policy |
| `Caddyfile.vps.example` | Shared host-Caddy topology |
| `docker-compose.yml` | Services, networks, volumes, health checks, limits, and capabilities |

Five long-lived application roles exist:

1. **Web** renders the product UI and obtains Clerk session tokens.
2. **API** verifies those tokens, authorizes resources, persists state, accepts
   deployment requests, serves artifacts, and exposes SSE logs.
3. **Queue worker** consumes BullMQ jobs and controls the trusted part of a
   deployment.
4. **Build runner** executes repository-controlled commands in nsjail.
5. **Caddy** terminates TLS and separates the trusted dashboard origin from
   untrusted generated/customer sites.

PostgreSQL, Redis, and MinIO are supporting stateful services.

## 4. End-to-end architecture

```text
Developer browser
    |
    | HTTPS
    v
Caddy
    |
    +-- dashboard host ----------------------> Next.js web
    |
    +-- dashboard /api/* --------------------> NestJS API
    |
    +-- *.SITES_DOMAIN or custom hostname ---> NestJS static serving
                                                   |
                       +---------------------------+------------------+
                       |                           |                  |
                       v                           v                  v
                   PostgreSQL                  Redis              MinIO
                                                   |
                                               BullMQ job
                                                   |
                                                   v
                                            trusted worker
                                                   |
                                          shared file exchange
                                                   |
                                                   v
                                      build-runner container + nsjail
                                                   |
                                         public build egress only
```

The dashboard and published sites intentionally use different origins. The
dashboard handles account state and bearer tokens. Published sites contain
untrusted project output. Caddy strips browser cookies and `Authorization`
before published-site requests reach the API, and published-site responses are
allowed to render in Kyte’s preview iframe.

## 5. HTTP routing and API bootstrap

The API starts in `server/src/main.ts`.

Startup fails before listening when:

- `ENCRYPTION_KEY` is missing or not a canonical Base64 32-byte key.
- `GITHUB_WEBHOOK_SECRET` is missing or shorter than 32 bytes.
- a production environment violates the exact domain, origin, callback, secret,
  database, Redis, MinIO, or Clerk invariants in
  `server/src/common/production-config.ts`.

Nest is created with `rawBody: true`. The raw body is required because a GitHub
signature must be verified against the exact received bytes, not a
re-serialized JSON object.

Global request behavior:

- Helmet is enabled, except its CSP and cross-origin embedder policy.
- The proxy trust depth is one.
- JSON bodies are limited to 256 KiB.
- URL-encoded bodies are limited to 64 KiB.
- URLs longer than 2,048 characters receive HTTP 414.
- Validation removes no silently accepted extra fields:
  `whitelist: true` plus `forbidNonWhitelisted: true` rejects them.
- DTO transformation is enabled.
- CORS accepts requests without an `Origin` or an origin listed in
  `DASHBOARD_ORIGINS`; credentials are enabled.
- Redis-backed global throttling defaults to 100 requests per 60 seconds.

The global throttler also covers static-site serving because those requests end
in Nest. Controller overrides set 120/minute for GitHub webhooks, 20/minute for
new SSE log connections, and 30/minute for Caddy certificate checks.

Caddy exposes dashboard API routes under `/api`. Its dashboard handler strips
that prefix before proxying to Nest. Direct internal routes therefore use
controller paths such as `/projects`, `/auth`, and `/webhooks`.

The Caddy certificate-approval controller is deliberately registered as
`/api/caddy/check-domain` because Caddy calls the API service directly rather
than through the dashboard’s prefix-stripping route.

## 6. Authentication and user synchronization

### Browser authentication

`web/app/layout.tsx` wraps the application in Clerk’s `ClerkProvider`.
`web/proxy.ts` uses Clerk’s Next.js middleware and protects every matching route
except `/`, `/sign-in(.*)`, and `/sign-up(.*)`. The sign-in and sign-up pages use
Clerk’s maintained `SignIn` and `SignUp` components with path routing and a
dashboard fallback redirect.

The browser calls `getToken()` through `web/hooks/use-api.ts`. The shared API
client sends:

```http
Authorization: Bearer <Clerk session token>
Content-Type: application/json
```

Tokens are never added to URLs. This is especially important for the deployment
log stream, where the browser uses `fetch` instead of native `EventSource` so it
can set an authorization header.

### API verification

Protected API controllers use `JwtAuthGuard`.

For each request the guard:

1. Reconstructs the absolute request URL from the proxy-aware protocol, host,
   and original URL.
2. Copies incoming Express headers into a Web `Headers` instance.
3. Calls Clerk Backend SDK `authenticateRequest`.
4. Accepts only `session_token`.
5. Restricts the token’s authorized party to `CLERK_AUTHORIZED_PARTIES`.
6. Rejects missing, invalid, or expired sessions.
7. Extracts Clerk’s user ID.
8. Checks a process-local Clerk-ID cache with a 55-second TTL.
9. If uncached, resolves the local user by `clerkId`.
10. If this is the user’s first API request, fetches the Clerk profile and
    requires a verified primary email.
11. Links an existing local record by lowercased verified email, or creates a
    new local user.
12. Attaches `{ id, email, clerkId }` to the request.

The short cache saves repeated database reads but is local to one API process.
It is not an authorization cache for organizations or projects; those checks
still query PostgreSQL.

The schema retains nullable `passwordHash` and `githubId` columns from the
earlier data model, but current sign-in is Clerk-based.

### Administrator authentication

Admin routes run both `JwtAuthGuard` and `AdminGuard`. `AdminGuard` accepts a
database `ADMIN` role or an email in `ADMIN_EMAILS`. When a configured admin
email first enters the admin surface, its database role is promoted to
`ADMIN`. The user cannot delete their own admin account through the admin API.

## 7. GitHub integrations

Kyte has two conceptually separate GitHub integrations:

1. Clerk can use GitHub as a social identity provider for sign-in.
2. Kyte’s API uses a GitHub OAuth token to list and build repositories and to
   create/delete repository webhooks.

They should use separate GitHub OAuth applications. The repository integration
requests `repo`, `admin:repo_hook`, and `read:user`, which are not appropriate
permissions for a simple social-login application.

### Repository OAuth authorization

`GET /auth/github/connect` requires a Clerk-authenticated local user.

The API generates 32 random bytes and Base64URL-encodes them as the OAuth state.
It does not store the state itself as a Redis key. It hashes the state with
SHA-256 and stores:

```text
github:oauth-state:<sha256(state)> -> {"userId":"..."}
```

The entry uses Redis `SET ... EX 900 NX`, giving it a 15-minute lifetime and
preventing accidental key replacement. Up to three random states are attempted
if a key collision occurs.

The returned GitHub authorization URL contains:

- configured repository OAuth client ID;
- `GITHUB_CALLBACK_URL`;
- `repo,admin:repo_hook,read:user`;
- one-time state;
- `prompt=select_account`.

GitHub redirects the browser to `/github/callback`. The client page requires an
active Clerk session, reads `code` and `state`, obtains a Clerk token, and posts
both values to `POST /auth/github/callback`.

### Repository OAuth callback

The API:

1. Validates the state’s Base64URL shape and length.
2. hashes it to locate the Redis entry;
3. atomically consumes the entry with `GETDEL`;
4. checks that it belongs to the current local user;
5. exchanges the code with GitHub using the client ID and secret;
6. fetches `/user` with the returned token;
7. requires a GitHub numeric ID and login;
8. prevents one GitHub identity from being attached to two Kyte users;
9. encrypts the access token;
10. upserts the username, encrypted token components, and granted scopes.

The raw GitHub access token is never returned to the browser or stored as
plaintext in PostgreSQL.

### Repository listing and disconnect

`GET /auth/github/repos` decrypts the token only inside the API process and
requests up to 100 repositories from GitHub, including private repositories,
sorted by update time.

Disconnect attempts to delete every known remote webhook first. A failure or
unreadable token does not prevent local cleanup. Kyte clears local webhook IDs
and deletes the GitHub connection in a transaction, then returns a cleanup
warning count so the UI can tell the user that manual GitHub cleanup may still
be required.

## 8. Organizations, project ownership, and authorization

The UI calls organizations “workspaces.” The first authenticated visit without
an organization redirects to onboarding. Creating an organization:

- trims its display name;
- converts its requested slug to lowercase hyphenated form;
- rejects an empty normalized value;
- detects a conflicting slug;
- searches sequential `-2`, `-3`, and later suffixes for a suggestion;
- creates the organization and an `OWNER` membership together.

The selected organization ID is stored as `kyte-active-org` in browser
`localStorage`. This is a UI preference, not an authorization claim. Every
organization-scoped API query verifies membership again.

Organization roles are `OWNER`, `ADMIN`, and `MEMBER`.

Project authorization is centralized in `ProjectsService.requireProjectAccess`:

| Action | Organization project | Legacy project without organization |
| --- | --- | --- |
| `read` | Any member | Creating user |
| `deploy` | Any member | Creating user |
| `manage` | Owner or admin | Creating user |

Database admins receive read-only access to other projects through this helper.
Unauthorized access returns “Project not found,” which avoids exposing resource
existence.

Project creation requires an organization and requires its current user to be
an owner or admin. The project-count limit is user-wide, not per organization.
The effective limit is:

```text
User.projectLimitOverride
    ?? PlatformSettings.defaultProjectLimit
    ?? 4
```

Creation runs at PostgreSQL serializable isolation and retries transaction
serialization failures up to three attempts so concurrent requests cannot
reliably exceed the limit.

## 9. Project configuration and lifecycle

A project stores:

- name and optional description;
- GitHub repository URL;
- unique generated subdomain;
- creating user and organization;
- active deployment pointer;
- framework preset;
- root directory;
- build command;
- static output directory;
- production branch;
- GitHub repository identity and webhook ID;
- environment variables and custom domains.

Input restrictions include:

- GitHub HTTPS or SSH repository syntax only;
- branch validation that rejects traversal-like/ref-log-invalid patterns;
- relative root/output directories only;
- a maximum of 100 unique environment keys;
- environment keys matching shell-style identifier syntax;
- environment values up to 16 KiB each.

Changing the repository is blocked while automatic deployments are enabled.
When a repository is changed after disabling the webhook, the stored GitHub
repository ID is cleared.

Project deletion first clears `activeDeployId` to break the project/deployment
cycle, then deletes request logs, deployment logs, deployments, GitHub
connection associations, and the project in a transaction. The admin deletion
path additionally explicitly deletes environment variables and custom domains.
Database cascade rules cover several of these relations as a second layer.

Generated subdomains currently use the current millisecond timestamp plus a
seven-character base-36 `Math.random()` suffix, with uniqueness enforced by
PostgreSQL.

## 10. Cryptography and secret handling

Kyte uses different cryptographic operations for different purposes. They are
not interchangeable.

| Data/purpose | Operation |
| --- | --- |
| Stored environment values | AES-256-GCM authenticated encryption |
| Stored GitHub access token | AES-256-GCM authenticated encryption |
| GitHub webhook authenticity | HMAC-SHA-256 over exact raw request body |
| OAuth-state Redis lookup | SHA-256 digest of random one-time state |
| OAuth-state entropy | 32 cryptographically random bytes |
| Domain ownership token | 16 cryptographically random bytes encoded as hex |

### AES-256-GCM implementation

`server/src/utils/crypto.util.ts` requires `ENCRYPTION_KEY` to decode to exactly
32 bytes. It also checks canonical Base64 representation so malformed or
ambiguous values are rejected.

Every call to `encrypt`:

1. generates a fresh 12-byte random nonce/IV;
2. initializes `aes-256-gcm`;
3. encrypts UTF-8 plaintext;
4. returns Base64 ciphertext, Base64 IV, and a 16-byte Base64 authentication
   tag.

Every call to `decrypt`:

1. decodes the stored IV and tag;
2. verifies their exact sizes;
3. initializes AES-256-GCM with the configured key;
4. supplies the authentication tag;
5. decrypts and authenticates in one operation.

If ciphertext, IV, tag, or key is wrong, `decipher.final()` fails instead of
returning corrupted plaintext.

Environment values cannot be hashed because builds need to recover their
original values. They are reversibly encrypted with integrity protection.

### Key lifecycle

The encryption key is required by both API and worker. It must:

- be generated once from a cryptographically secure source;
- remain outside Git and images;
- remain identical in API and worker;
- be backed up in a secret manager;
- never be casually regenerated.

Changing the key without first decrypting and re-encrypting all stored secrets
makes existing environment values and GitHub tokens unreadable. The repository
does not implement online key versioning or automatic rotation.

The authenticated-encryption migration deliberately deleted earlier
unauthenticated environment values and GitHub connections rather than attempting
to preserve legacy AES-CBC/Base64 data.

### Secret exposure boundaries

- Clerk and GitHub client secrets exist only in server runtime configuration.
- The web Dockerfile accepts only the Clerk publishable key and public routing
  values.
- `.env.*` files are excluded from the frontend image build context.
- API responses for environment variables contain the key, an empty value, and
  `hasValue: true`; plaintext is never returned.
- Build logs can still leak a secret if a user’s build command prints it. Kyte
  does not currently perform value-based log redaction.

## 11. Environment-variable lifecycle

### Browser input

The editor supports manual rows, pasted `.env` content, and uploaded `.env`
files. Its parser:

- ignores blank lines and `#` comments;
- accepts optional `export `;
- splits on the first `=`;
- removes one matching layer of single or double quotes;
- ignores invalid key names;
- merges imports by key.

This parser is intentionally simple: it does not reproduce shell expansion,
multiline values, escaped quotes, or dotenv interpolation.

### Creation and update

On project creation each value is independently encrypted with a fresh IV and
tag inside the serializable creation transaction.

When project settings load, the API returns:

```json
{ "key": "API_TOKEN", "value": "", "hasValue": true }
```

The empty placeholder prevents secrets from travelling back to the browser. On
save, an existing key with an empty submitted value is not overwritten. A
non-empty value replaces it with newly encrypted material. A new key with an
empty value is allowed and encrypted as an empty string. Upserts execute in one
database transaction.

Deletion uses the `(projectId, key)` unique identifier and requires project
management permission.

### Build injection

At deployment time the trusted worker:

1. loads every `EnvironmentVariable` for the project;
2. decrypts each value in memory;
3. constructs `KEY=value\n` text;
4. passes that text to `createIsolatedBuild`;
5. writes it to the request workspace as `.env` with mode 0644 inside the
   isolated exchange volume;
6. the runner copies it to `<repository>/<rootDirectory>/.env` before running
   the build command.

The file exists only in the transient build-exchange workspace and is removed
during worker cleanup. It is not uploaded unless the project’s own build
process copies it into the configured output directory. Build authors remain
responsible for not embedding server-only secrets into browser bundles.

The current serializer does not escape newline characters or dotenv metacharacters
inside values. DTO values may contain them, so operationally environment values
should be single-line dotenv-safe strings.

## 12. Deployment intake and state machine

Deployment states are:

```text
QUEUED -> BUILDING -> UPLOADING -> SUCCESS
                    \-----------> FAILED
QUEUED/BUILDING/UPLOADING ------> CANCELED
```

`TIMEOUT` exists in the schema/UI vocabulary, but current worker timeout errors
are caught and stored as `FAILED`.

### Manual deployment

`POST /projects/:projectId/deployments` requires `deploy` access. The project
page sends `commitSha: HEAD`; the deployment record snapshots the project’s
repository URL and branch.

### Intake controls

Before creating a record, `DeploymentsService`:

1. ensures the singleton `PlatformSettings` row exists;
2. rejects new intake when `deploymentsPaused` is true;
3. runs a serializable transaction with up to three serialization retries;
4. for deduplicated manual/webhook requests, reuses an active deployment with
   the same project, commit, and trigger source;
5. enforces at most two `QUEUED`, `BUILDING`, or `UPLOADING` deployments per
   project;
6. enforces the webhook rolling quota when the trigger is `WEBHOOK`;
7. creates an immutable S3 prefix containing project ID, timestamp, and 8 random
   bytes in hex.

If a new record was created, BullMQ receives a `deploy` job whose only
repository-related input is `deploymentId`. The trusted worker reloads
repository URL, branch, commands, and paths from PostgreSQL instead of trusting
queue payload fields.

BullMQ options:

- job ID equals deployment ID;
- two attempts;
- exponential backoff beginning at five seconds;
- completed jobs removed;
- failed jobs kept for up to 24 hours, capped at 100.

The worker’s global concurrency is two.

### Reconciler

Every five minutes each API process tries to acquire a 10-second Redis
`SET NX PX` leader lock. The winner finds deployments still active whose
`updatedAt` is more than 15 minutes old, marks them `FAILED`, and attempts to
remove their BullMQ jobs. This repairs jobs abandoned by a crashed worker, but
it does not delete partial MinIO artifacts.

### Rollback behavior

Rollback does not repoint the active deployment directly. Given a successful
deployment, Kyte finds the successful deployment immediately before it and
queues a new manual build using that older commit SHA. This means rollback
requires the repository/commit to remain buildable and can fail like any other
new deployment.

## 13. Trusted worker and build execution

### Worker startup

The worker refuses to start without a valid encryption key and authenticated
Redis URL. It exposes a small health server on `WORKER_PORT`.

When it receives a job, it:

1. validates `deploymentId`;
2. reloads the deployment and project;
3. skips a deployment already marked `CANCELED`;
4. changes the status to `BUILDING`;
5. validates root and output directories;
6. decrypts build environment variables;
7. creates an isolated-build request;
8. waits for runner logs/result;
9. changes status to `UPLOADING`;
10. validates the real output path, including symlink resolution;
11. uploads static files to the deployment’s immutable prefix;
12. atomically changes the deployment to `SUCCESS` and the project’s
    `activeDeployId` to this deployment;
13. only then publishes `Deploy complete`.

The last transaction guarantees the preview/public router cannot observe
“complete” before the new release is active. Failed builds do not change
`activeDeployId`, so the previous successful release remains online.

Cancellation is checked after the isolated build and again before activation.
If an error occurs and the deployment was not canceled, the worker emits
`Build failed: ...` and stores `FAILED`.

### Path validation

Paths pass through three layers:

1. DTO regular expressions reject absolute/traversal-like input.
2. `validateRelativeDirectory` normalizes POSIX separators and rejects absolute
   and parent-escaping paths.
3. `resolveExistingDirectoryWithin` compares real paths after symlink
   resolution and requires a directory.

The upload walker also skips all symbolic links. This prevents a repository
from selecting or linking an output path outside its workspace.

## 14. Worker/runner file protocol and polling

The trusted worker and build runner do not share Redis, PostgreSQL, or the
application network for job contents. They communicate through the
`build_exchange` volume.

For request UUID `R`, the protocol uses:

```text
queue/R.pending
queue/R.json
running/R.json
work/R/.env
work/R/app/
logs/R.jsonl
results/R.json
```

### Request publication

The worker creates a UUID, makes `work/R`, writes `.env`, writes the request to
`R.pending`, then atomically renames it to `R.json`. The rename prevents the
runner from reading a partially written JSON request.

### Runner queue polling

The runner:

1. ensures exchange directories exist;
2. polls the `queue` directory every 250 ms;
3. filters `.json` files and sorts names;
4. claims the first request by renaming it into `running`;
5. processes exactly one request;
6. writes a result file;
7. exits.

Compose restarts the runner after each request, giving the next repository a
fresh process and namespace lifecycle. The `activeBuild` health field reports
whether that single runner is currently executing a request.

### Worker result/log polling

The worker’s `waitForIsolatedBuild` polls every 200 ms for up to 320 seconds. On
each iteration it:

- checks whether the JSONL log exists;
- reads its current full contents;
- slices only bytes beyond `consumedLogLength`;
- retains an incomplete trailing line;
- parses complete lines as `{stream,text}`;
- rejects invalid stream names or non-string text;
- checks for the result JSON;
- consumes logs once more after finding the result.

If the log file becomes shorter, parsing fails closed because unexpected
truncation could reorder or corrupt log history. If no result arrives before
the timeout, the worker fails the deployment.

Cleanup deletes pending, queued, running, log, result, and workspace paths with
force semantics.

## 15. Build-runner isolation

The runner validates its file request again before execution. It accepts:

- UUID-shaped request ID;
- GitHub HTTPS repository only;
- a bounded, valid branch;
- safe root directory;
- non-empty build command up to 1,000 characters.

The runner invokes nsjail around a fixed shell script:

```text
git clone -q -b <branch> --depth 1 <repo> /build/app
copy /build/.env into /build/app/<root>/.env
cd /build/app/<root>
npm install --ignore-scripts --no-fund --no-audit --loglevel=error
run configured build command through /bin/sh -c
```

Dependency lifecycle scripts are disabled during installation. The configured
build command itself is intentionally user-controlled.

nsjail configuration includes:

- empty chroot mode with explicit read-only `/proc`, `/bin`, `/lib`, `/usr`,
  `/etc`, and `/lib64` mounts;
- shared workspace mounted at `/build`;
- payload UID/GID 99999;
- disabled nested user and network namespace cloning;
- 300-second wall/CPU limit;
- 4,096 open-file limit;
- 256 MiB file-size rlimit;
- 512 process limit;
- a minimal PATH and `HOME=/build`.

The outer container has the capabilities nsjail and the egress firewall need.
The payload UID is subject to iptables rules that allow Docker’s embedded DNS
but reject loopback, RFC1918, link-local, carrier-grade NAT, multicast,
reserved IPv4, IPv6 loopback, IPv6 ULA, and IPv6 link-local destinations. It
can access public package/Git hosts but not Kyte’s private service networks.

The runner checks workspace size once per second. More than 1.5 GB kills the
child. Ten consecutive filesystem-scan failures also fail closed. Captured logs
are capped at 5 MB; the final accepted chunk is truncated to the remaining
bytes and a truncation notice is appended.

Container limits add 1.5 GB memory, one CPU, and 600 PIDs. The container is
read-only apart from `/tmp` and the exchange volume.

## 16. Deployment log architecture

Logs cross four storage/transport layers:

```text
build stdout/stderr
    |
    v
runner JSONL file
    |  worker polls every 200 ms
    v
worker publishLog
    |----------------------|
    v                      v
Redis pub/sub         PostgreSQL DeploymentLogChunk
    |                      |
    +----------+-----------+
               v
        NestJS SSE observable
               |
               v
      browser fetch stream parser
```

### Runner capture

The runner listens to child `stdout` and `stderr`. Each received chunk becomes
one JSONL event. File appends are tracked so all pending writes settle before
the runner writes its result.

### Worker processing

The worker filters three known nsjail/npm-noise patterns from stderr. For every
remaining chunk it:

- writes a prefixed copy to worker stdout;
- publishes JSON on Redis channel `deploy:<deploymentId>`;
- assigns an in-memory sequence number;
- asynchronously inserts a `DeploymentLogChunk`.

The database insert is deliberately non-blocking; an insert failure is written
to worker logs but does not fail the build. Consequently Redis is the
low-latency path and PostgreSQL is durable best-effort history.

Sequence numbering starts at zero for a worker attempt. The database unique key
is `(deploymentId, sequence, stream)`.

### API historical/live merge

`GET /projects/:projectId/deployments/:deploymentId/logs` is an authenticated
SSE endpoint throttled to 20 connections per minute. It verifies project read
access and deployment ownership before creating the stream.

The Observable:

1. asynchronously loads PostgreSQL chunks ordered by sequence and emits them;
2. creates a dedicated authenticated Redis client;
3. subscribes to `deploy:<deploymentId>`;
4. emits parsed pub/sub messages;
5. falls back to a stdout object if a Redis message is not JSON;
6. unsubscribes and quits that Redis client when the browser disconnects.

Historical loading and Redis subscription begin close together. The stream does
not currently attach event IDs or deduplicate the overlap, so a boundary chunk
can theoretically be duplicated or observed out of order during connection.
There is no explicit SSE heartbeat or server-side close on terminal status.

### Browser parsing

`web/lib/deployment-log-stream.ts`:

- sends `Accept: text/event-stream` and bearer authorization;
- obtains a `ReadableStream` reader;
- incrementally decodes UTF-8;
- normalizes CRLF to LF;
- buffers until blank-line SSE boundaries;
- joins all `data:` lines in an event;
- parses JSON;
- ignores malformed/non-JSON heartbeat-like data;
- stops when its `AbortSignal` fires or the stream ends.

The new-project flow aborts after receiving `Deploy complete.` or
`Build failed:`. The project detail page keeps the selected deployment stream
open and refreshes project/deployment data when it sees either marker.

The UI stores received chunks in React state. Search filters chunks, while copy
and download concatenate raw `text` values without UI color metadata.

### Other polling

The application sidebar separately polls
`/organizations/:id/deployments` every five seconds. It compares the latest ten
deployment statuses with a ref-held previous map and shows success/failure
toasts on transitions. Errors are intentionally silent. This poll is for
cross-project notifications; it is not the source of the log stream.

Observability, admin tables, dashboard data, domain state, and project lists do
not continuously poll. They load on mount, selection/range change, an explicit
action, or manual refresh.

## 17. Artifact storage and publication

MinIO exposes an S3-compatible API on the private application network. Kyte uses
path-style S3 requests in region `us-east-1`.

The application credential is separate from the MinIO root identity. Its policy
can inspect/list the configured bucket and get/put/delete objects only in
`deployly-projects`. `minio-init` creates the bucket, application user, and
policy.

Before upload, the worker recursively enumerates regular files and skips
symlinks. It rejects output exceeding:

- 10,000 files; or
- 100 MiB total.

Each file is uploaded sequentially with:

- immutable deployment prefix;
- normalized forward-slash relative key;
- detected MIME type or `application/octet-stream`;
- explicit content length.

On success the worker logs file count, byte count, bucket, and prefix.

Artifacts are not copied when activating a deployment. `Project.activeDeployId`
changes which immutable prefix the serving layer resolves. That indirection
provides zero-copy activation and keeps an older successful artifact available
for history.

Project deletion currently removes database records but does not delete its
MinIO prefixes, so artifact garbage collection is an operational gap.

## 18. Static-site serving and live preview

### Hostname resolution

For a generated hostname, `ServeService.serveHostname`:

- recognizes `<slug>.sites.localhost` in local development;
- otherwise reads `SITES_DOMAIN`;
- accepts exactly one slug label below that domain;
- routes any other hostname to verified custom-domain resolution.

Generated project resolution loads the project by unique subdomain and includes
its active deployment. A direct deployment-ID slug is also supported by
`serveFile`, although Caddy normally routes public generated hosts by hostname.

Custom-domain resolution requires:

- exact normalized domain match;
- `status === verified`;
- an active project deployment.

### Object selection and SPA fallback

The root maps to `index.html`. For a requested path, the API first asks MinIO
for that exact key. On `NoSuchKey`, it asks for `index.html`, enabling
client-side SPA routes. Other S3 errors become “File not found.”

The response:

- sets stored/detected content type;
- strips `Set-Cookie`;
- removes `X-Frame-Options`;
- preserves stored cache control when present;
- streams the MinIO body without buffering the full object.

Helmet protects API responses, but customer sites must be frameable. Caddy’s
generated-site handler additionally removes:

- `Set-Cookie`;
- `X-Frame-Options`;
- `Content-Security-Policy`;
- `Cross-Origin-Opener-Policy`;
- `Origin-Agent-Cluster`.

Caddy strips incoming `Cookie` and `Authorization` before proxying a generated
or custom site to the API.

### Preview behavior

After the worker commits successful activation and publishes its terminal log,
the new-project UI waits three seconds, then mounts a scaled iframe using:

```text
https://<subdomain>.<sites-domain>/?__kyte_preview=1&attempt=<n>
```

The iframe’s `load` event marks the preview ready. A 15-second client timer
shows the unavailable state if no load occurs. Retry increments the React key
and URL attempt value, forcing a fresh iframe navigation. The query marker also
excludes preview navigation from analytics.

The iframe is visual-only: pointer events are disabled and it renders at 200%
size with a 50% transform to create a thumbnail.

## 19. Custom domains and automatic TLS

### Registration

Domain input is lowercased and trailing-dot-normalized. If it begins with
HTTP(S), the implementation parses the URL and keeps only `URL.hostname`, so an
included port or path is discarded. Without a scheme, ports, paths, wildcards,
and invalid labels are rejected. The Kyte dashboard hostname and anything in
the generated-sites zone are always rejected.

A globally unique domain can belong to only one project. Registration generates:

```text
kyte-verify=<32 hex characters>
```

The API returns two required DNS records:

1. routing CNAME to `DOMAIN_CNAME_TARGET` (falling back to `BASE_DOMAIN`);
2. TXT at `_kyte.<domain>` containing the verification token.

The UI notes that apex domains may need provider-specific ALIAS/ANAME behavior.

### Verification

Verification resolves TXT records for `_kyte.<domain>` and flattens segmented
TXT answers. An exact token match changes status to `verified` and records
`verifiedAt`. DNS failure or non-propagation leaves the record pending. Local
`.local` and `.localhost` domains auto-verify outside production.

### Caddy certificate authorization

Caddy’s global `on_demand_tls` uses an `ask` endpoint before issuing a
certificate. `CaddyController` approves only:

- a database custom domain whose status is `verified`; or
- a single-label generated hostname whose project exists.

The ask endpoint is throttled to 30 requests per minute. Unknown hostnames
receive 404, preventing the catch-all TLS listener from becoming an arbitrary
certificate oracle.

Fixed host blocks for the dashboard and other VPS applications must appear
before the generic `https://` custom-domain block.

## 20. GitHub push webhooks

### Enabling

Project management permission is required. Kyte:

1. returns current state if already enabled;
2. enforces one webhook-enabled project per creating user;
3. decrypts that user’s GitHub token;
4. parses the repository owner/name;
5. queries GitHub for repository identity and permissions;
6. requires GitHub administrator permission;
7. requires a configured webhook secret;
8. creates an active `push` webhook with JSON content and TLS verification;
9. stores GitHub’s hook ID and numeric repository ID.

The one-webhook rule is protected by both application checks and a partial
unique PostgreSQL index on `Project.userId WHERE webhookId IS NOT NULL`. If a
race reaches the database, Kyte attempts to delete the just-created remote hook
before returning the limit error.

GitHub HTTP 422 “hook already exists” is not treated as success because the
existing hook might belong to a different Kyte account.

### Request authentication

`POST /webhooks/github` is throttled to 120 requests per minute and protected by
`GithubWebhookGuard`.

The guard requires:

- `X-Hub-Signature-256` shaped as `sha256=` plus 64 hex characters;
- a bounded lowercase GitHub event name;
- a UUID-shaped delivery ID;
- a webhook secret of at least 32 bytes;
- the exact raw body captured by Nest.

It computes `HMAC-SHA-256(secret, rawBody)` and compares the complete expected
signature with `crypto.timingSafeEqual` after a length check.

This is message authentication, not encryption. Anyone can know the webhook
payload contents, but only a holder of the shared secret should be able to
produce a valid signature.

### Replay protection and push validation

For a push, Redis records:

```text
github:webhook-delivery:<delivery UUID>
```

using `SET NX EX 86400`. Duplicate deliveries within 24 hours are acknowledged
but ignored.

The service validates:

- object-shaped payload;
- safe positive numeric repository ID;
- `owner/repository` full name syntax;
- bounded ref;
- branch refs only;
- non-deletion push;
- exact 40-character nonzero commit SHA;
- optional commit message truncated to 500 characters.

Projects are matched by GitHub’s numeric repository ID, non-null webhook ID,
and exact configured branch. Matching is not based only on a user-controlled
repository URL.

Each match enters the normal deployment service with trigger `WEBHOOK`.
Webhook-triggered deployments are limited to 30 per creating user in the
rolling preceding 24 hours. Active-project concurrency and the global pause
also apply. Quota/concurrency skips are logged and still acknowledged to GitHub
so GitHub does not create a retry storm.

Ping returns `pong`; other authenticated event types are acknowledged without
deployment work.

### Disabling

Kyte asks GitHub to delete the stored hook. HTTP 404 is accepted as already
removed; other errors block local disable so state does not silently diverge.
Successful disable clears both hook ID and repository ID.

## 21. Observability

Kyte observability is derived from published-site requests and deployment
timestamps. It is not full distributed tracing, browser analytics JavaScript,
or raw API telemetry.

### Pageview eligibility

A request becomes a pageview only when all of these are true:

- method is `GET`;
- final status is 2xx or 3xx;
- content type begins with `text/html`;
- query does not contain `__kyte_preview`;
- user agent exists and does not match Kyte’s bot/tool pattern;
- `Purpose`/`Sec-Purpose` is not prefetch or prerender;
- `Sec-Fetch-Dest` is exactly `document` or `iframe`;
- when present, `Sec-Fetch-Mode` is `navigate`.

The bot pattern covers common crawlers, social previews, headless/performance
tools, uptime monitors, scanners, CLI clients, and common programmatic HTTP
libraries. Filtering is best-effort, not an anti-fraud guarantee.

The database migration added `isPageView` with default `false`, intentionally
excluding historical rows collected before these filters were trustworthy.

### Request recording

Serving starts a high-resolution timer before artifact lookup. When the response
finishes, it computes rounded milliseconds and resolves the visitor IP from:

1. `CF-Connecting-IP`;
2. `X-Forwarded-For` first value;
3. socket remote address;
4. loopback fallback.

Country code prefers `CF-IPCountry` except `XX` and `T1`, then falls back to the
local `geoip-lite` database. `Intl.DisplayNames` converts the code to an English
country name. The `RequestLog` insert is asynchronous; failure is written to API
logs and does not break the site response.

Stored fields are project, timestamp, method, path, status, response time, IP,
country code/name, and `isPageView`.

### Metric calculations

`GET /projects/:id/metrics?days=7|30|90` uses UTC day boundaries and only rows
where `isPageView=true`.

- **Pageviews:** count of eligible request rows.
- **Visitors:** number of distinct non-null IP addresses in the whole range.
- **Average response:** rounded database average of recorded response time.
- **Daily pageviews:** count per UTC day.
- **Daily visitors:** distinct IP set per UTC day.
- **Locations:** distinct IP set per country, percentage of the sum of those
  country visitor counts, sorted descending and limited to five.
- **Successful/failed deployments:** counts in the latest 20 deployments.
- **Average build:** average seconds between `deployedAt` and `updatedAt` for
  terminal success/failed records where update is later than creation.
- **Health:** successful deployments divided by all of the latest 20 deployment
  records, rounded as a percentage; with no deployments it is 100.

Because health divides by all returned deployment records, queued, building,
uploading, canceled, or timeout records in that set lower the percentage even
though only success and failure get separate counters.

The UI loads metrics on page mount and whenever the selected 7/30/90-day range
changes. It records a browser-side “updated at” timestamp. There is no
background metrics poll; Reload fetches a new snapshot.

### Data and privacy characteristics

Visitor identity is IP-based. There is no cookie-based unique visitor ID,
sessionization, path breakdown UI, retention job, IP anonymization, or consent
system in this repository. Operators must establish appropriate retention and
privacy policy for their jurisdiction.

## 22. Web application behavior and refresh policies

### Workspace dashboard

On mount the dashboard reads the organization list, chooses the saved active
organization when it is still valid (otherwise the first organization), and
loads that organization’s projects. It then makes one deployment-list request
per project and combines the results in the browser.

The workspace dashboard derives:

- latest deployment per project from the first returned deployment;
- ready, in-progress, and attention project counts from latest statuses;
- the six most recent deployments by flattening and sorting project histories;
- 7- or 30-day deployment trend buckets in the browser’s local day/time zone;
- release success rate from completed success versus failed/timeout/canceled
  records in those client-side buckets;
- project search by name.

These are dashboard presentation calculations, separate from the UTC,
server-calculated project observability metrics.

### Cross-project deployment page

The deployment page loads the accessible project list, then one deployment list
per project, flattens and sorts it in the browser. Search covers project name,
commit SHA/message, and branch. Status filtering and six-row pagination are
client-side. Redeploy submits the selected row’s commit SHA and optional commit
message, then reloads the snapshot.

### New-project wizard

On mount the wizard concurrently checks GitHub connection/repositories,
organizations, and project allowance. It:

1. accepts a repository URL or connected repository;
2. collects preset and build settings;
3. attaches the selected organization and serialized environment variables;
4. creates the project;
5. immediately creates its first deployment with `HEAD`;
6. switches to the authenticated log stream;
7. detects terminal marker text;
8. shows the embedded preview after successful activation.

### Project workspace

The project page loads the project, webhook state, deployment history, and
masked environment keys. Its tabs expose overview, observability, deployments,
selected-deployment logs, domains, and settings. Admin read-only entry uses
`?admin=1` and omits domain/settings mutations in the tab set.

Changing the selected deployment changes the SSE stream. Copy/download uses the
currently received log state. Settings, environment, webhook, domain, deploy,
and delete actions explicitly reload affected data after completion.

### Account and contact

Settings reads the current local account, effective project limit, and GitHub
connection state. GitHub disconnect warns when remote cleanup was incomplete.
Sign-out is delegated to Clerk.

The contact form posts browser `FormData` directly to
`NEXT_PUBLIC_CONTACT_FORM_ENDPOINT`; if it is absent, the source contains a
hardcoded FormSubmit fallback address. It includes a honeypot field, disables
FormSubmit CAPTCHA, requests JSON, and enforces browser-side name/email/message
length constraints. The message does not pass through Kyte’s API.

### Refresh matrix

Understanding which views are snapshots and which are live avoids false
diagnosis:

| Surface | Refresh behavior |
| --- | --- |
| Active deployment logs | Authenticated SSE fetch stream |
| Sidebar deployment notifications | Poll every 5 seconds |
| New-project preview | iframe load event plus 15-second timeout |
| Project metrics | Mount, range change, or Reload |
| Project/deployment data | Mount and after actions/terminal log marker |
| Dashboard | Mount |
| Cross-project deployment page | Mount and after redeploy |
| Domains | Mount and after add/verify/delete |
| Admin pages | Mount, actions, or explicit Refresh |
| GitHub repository list | New-project mount after connection detection |

The sidebar’s five-second poll retrieves only the latest ten deployments for
the active organization. It is intended for transition toasts, not complete
deployment history.

## 23. Administrative control plane

Admin overview returns user, project, and deployment totals, active deployment
count/items, and platform settings.

User administration supports search over email/username, pagination, project
and GitHub-connection counts, role changes, and nullable project-limit
overrides. Deleting a user deletes their projects and dependent data inside one
transaction, removes organization memberships and GitHub connections, and
finally deletes the user.

Hosted-site administration supports search over name, subdomain, repository,
and owner email. It can sort by updated time, deployment count, or filtered
pageview count. Project results include owner, active deployment, deployment
count, pageview count, and custom-domain count.

Deployment administration lists global history and can cancel only
`QUEUED`, `BUILDING`, or `UPLOADING` records. It removes a queued BullMQ job
when present and stores `CANCELED`. A build already executing is not directly
signaled at process level; the worker detects cancellation at its post-build
and pre-activation checks.

Pausing deployment intake blocks new manual and webhook records. It does not
stop an existing build. The default project limit applies unless a user
override exists.

## 24. Database model

### Identity and tenancy

- `User`: Clerk link, verified email-derived identity, admin role, project limit.
- `Organization`: unique workspace slug.
- `OrganizationMember`: unique user/organization membership with role.

### Deployment domain

- `Project`: configuration and active deployment pointer.
- `Deployment`: immutable source/build snapshot plus mutable lifecycle state.
- `DeploymentLogChunk`: ordered stdout/stderr history.
- `EnvironmentVariable`: per-project encrypted key/value components.
- `CustomDomain`: global hostname claim and verification state.
- `GitHubConnection`: GitHub identity and encrypted repository token.

### Operational data

- `RequestLog`: filtered site-navigation measurements.
- `PlatformSettings`: singleton intake pause and default project limit.

Important indexes and constraints:

- unique user email and Clerk ID;
- unique organization slug and membership pair;
- unique project subdomain and active deployment pointer;
- repository-ID/branch lookup for webhook routing;
- partial unique one-enabled-webhook-per-user index;
- unique deployment log sequence/stream tuple;
- unique GitHub user ID;
- unique environment key per project;
- unique custom hostname;
- request log indexes by project/time and project/pageview/time.

PostgreSQL is authoritative for product state. Redis is authoritative only for
ephemeral queue, pub/sub, OAuth-state, replay-window, throttling, and leader-lock
state. MinIO is authoritative for published artifact bytes.

## 25. API route reference

Routes below are Nest routes after Caddy removes the public dashboard `/api`
prefix. “Authenticated” means `JwtAuthGuard`; project-level permissions still
apply inside the service.

### Health and authentication

| Method and route | Access | Purpose |
| --- | --- | --- |
| `GET /` | Internal/public API | Service identity |
| `GET /health` | Internal/public API | API health |
| `GET /auth/me` | Authenticated | Local account, admin, and GitHub state |
| `GET /auth/github/connect` | Authenticated | Start repository OAuth |
| `POST /auth/github/callback` | Authenticated | Consume OAuth code/state |
| `GET /auth/github/repos` | Authenticated | List accessible repositories |
| `DELETE /auth/github/disconnect` | Authenticated | Remote/local cleanup |

### Organizations and projects

| Method and route | Purpose |
| --- | --- |
| `POST /organizations` | Create workspace and owner membership |
| `GET /organizations` | List current memberships |
| `GET /organizations/:id/deployments` | Latest ten workspace deployments |
| `POST /projects` | Create project and encrypted initial env values |
| `GET /projects` | Paginated accessible project list |
| `GET /projects/limits` | Effective user-wide allowance |
| `GET /projects/:id` | Project plus latest ten deployments |
| `PATCH /projects/:id` | Update managed project settings |
| `DELETE /projects/:id` | Delete project data |
| `GET /projects/:id/metrics` | 7/30/90-day observability snapshot |

### Project environment, webhook, and domain routes

| Method and route | Purpose |
| --- | --- |
| `GET /projects/:id/env` | Return masked configured keys |
| `POST /projects/:id/env` | Transactional encrypted upsert |
| `DELETE /projects/:id/env/:key` | Delete one key |
| `GET /projects/:id/webhook` | Read automatic-deploy status/limit |
| `POST /projects/:id/webhook/enable` | Create GitHub push hook |
| `DELETE /projects/:id/webhook` | Delete GitHub push hook |
| `GET /projects/:id/domains` | List domains and DNS records |
| `POST /projects/:id/domains` | Register pending domain |
| `POST /projects/:id/domains/:name/verify` | Resolve ownership TXT |
| `DELETE /projects/:id/domains/:name` | Remove local domain claim |

### Deployment routes

| Method and route | Purpose |
| --- | --- |
| `POST /projects/:projectId/deployments` | Queue manual deployment |
| `GET /projects/:projectId/deployments` | Paginated deployment history |
| `GET /projects/:projectId/deployments/:id` | Deployment with persisted logs |
| `POST /projects/:projectId/deployments/:id/rollback` | Rebuild prior success |
| `GET /projects/:projectId/deployments/:id/logs` | Historical/live SSE |

### Provider, serving, and Caddy routes

| Method and route | Access | Purpose |
| --- | --- | --- |
| `POST /webhooks/github` | HMAC guard | GitHub events |
| `GET /serve/host/:host/*` | Published-site edge | Resolve generated/custom host |
| `GET /serve/domain/:domain/*` | Published-site edge | Explicit custom-domain serve |
| `GET /serve/:slug/*` | Published-site edge | Project/deployment slug serve |
| `GET /api/caddy/check-domain` | Caddy | On-demand TLS approval |

The dashboard Caddy block deliberately returns 404 for public
`/api/serve...`, so serving routes cannot be used under the trusted application
origin.

### Admin routes

All use both authentication and admin guards.

| Method and route | Purpose |
| --- | --- |
| `GET /admin/overview` | Counts, active jobs, settings |
| `GET/PATCH /admin/settings` | Read/update pause and default limit |
| `GET /admin/users` | Search/paginate users |
| `PATCH /admin/users/:id` | Change role or limit override |
| `DELETE /admin/users/:id` | Delete user and owned data |
| `GET /admin/projects` | Search/sort/paginate hosted projects |
| `DELETE /admin/projects/:id` | Delete any project |
| `GET /admin/deployments` | Global deployment history |
| `POST /admin/deployments/:id/cancel` | Mark active deployment canceled |

## 26. Docker services, networks, and volumes

### Services

| Service | Main access |
| --- | --- |
| `web` | Next.js on container 3000, loopback published as configured web port |
| `api` | NestJS on container 3000, loopback published as configured API port |
| `worker` | BullMQ consumer and health endpoint |
| `build-runner` | One nsjail build per process/container lifecycle |
| `postgres` | Product database |
| `redis` | Password-protected queue/pub-sub/ephemeral state |
| `minio` | S3 artifacts and console |
| `minio-init` | Bucket, user, and policy bootstrap |
| `storage-init` | Volume directory/ownership bootstrap |
| `caddy` | Optional embedded TLS edge |

### Networks

- `app-net`: API, web, PostgreSQL, Redis, MinIO, and embedded Caddy as needed.
- `worker-net`: internal network between trusted worker and Redis.
- `build-egress-net`: build-runner public egress; no direct application service
  attachment.

The worker joins `app-net` and `worker-net` because it needs PostgreSQL, Redis,
and MinIO. The runner joins only `build-egress-net` and sees the worker through
the shared exchange volume, not a socket.

### Volumes

- `postgres_data`: product state.
- `redis_data`: queue/ephemeral Redis persistence.
- `minio_data`: deployment artifacts.
- `build_exchange`: transient request/work/log/result protocol.
- `caddy_data` and `caddy_config`: certificates and edge state.

PostgreSQL and MinIO require regular backups. Caddy state should be backed up to
avoid unnecessary certificate reissuance. The exchange is transient and should
not be restored as authoritative work.

### Container hardening

API, worker, web, and build runner use read-only roots with a restricted `/tmp`.
Most services drop all capabilities and use `no-new-privileges`. The API/web
images run as the Node user. MinIO runs as UID/GID 10001.

The build runner is the exception: it needs namespace/firewall capabilities,
AppArmor unconfined, and seccomp unconfined for nsjail. Its risk is reduced with
separate network/volume boundaries, cgroup limits, payload UID firewalling, and
one-build process lifecycle.

Redis and MinIO root/application identities use separate configured secrets.
PostgreSQL and Redis ports are loopback-only when published.

## 27. Caddy topology and security headers

Kyte supports:

1. an embedded Caddy Compose service using internal service names; or
2. host-installed Caddy using loopback ports and
   `docker-compose.host-caddy.yml` to disable the embedded instance.

Dashboard policy:

- HSTS in production;
- removes server technology headers;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- strict-origin referrer policy;
- disabled camera, microphone, geolocation, payment, and USB.

Published-site policy:

- no upstream cookies or bearer authorization;
- no response cookies;
- framing restrictions removed for preview;
- `nosniff`;
- strict-origin referrer policy;
- camera, microphone, and geolocation disabled.

The dashboard explicitly blocks `/api/serve` so published artifacts cannot be
read through the trusted dashboard origin. Site content is served only through
the isolated generated/custom hostname routing.

## 28. Configuration contract

### Routing

| Variable | Meaning |
| --- | --- |
| `BASE_DOMAIN` | Trusted dashboard/API hostname |
| `SITES_DOMAIN` | Untrusted generated-site parent domain |
| `DOMAIN_CNAME_TARGET` | Dedicated CNAME target given to custom-domain users |
| `DASHBOARD_ORIGINS` | Exact origins accepted by API CORS |
| `NEXT_PUBLIC_API_BASE_URL` | Browser API prefix compiled into web image |
| `NEXT_PUBLIC_SITES_DOMAIN` | Browser-generated site domain |
| `NEXT_PUBLIC_SITES_SCHEME` | `http` locally, `https` in production |

### Authentication and GitHub

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public Clerk key compiled into web |
| `CLERK_SECRET_KEY` | Server-only Clerk key |
| `CLERK_AUTHORIZED_PARTIES` | Allowed Clerk token origins |
| `ADMIN_EMAILS` | Production bootstrap admin allowlist |
| `GITHUB_CLIENT_ID/SECRET` | Kyte repository OAuth application |
| `GITHUB_CALLBACK_URL` | Repository OAuth callback |
| `GITHUB_WEBHOOK_SECRET` | HMAC shared secret, at least 32 bytes |
| `WEBHOOK_CALLBACK_URL` | Public GitHub push endpoint |

### Persistence and encryption

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Authenticated PostgreSQL URL |
| `REDIS_URL` | Authenticated Redis/Rediss URL |
| `ENCRYPTION_KEY` | Base64 32-byte AES key shared by API/worker |
| `MINIO_ENDPOINT` | Private S3 endpoint |
| `MINIO_ACCESS_KEY/SECRET_KEY` | Restricted application identity |
| `MINIO_BUCKET` | Artifact bucket expected by policy |

### Build/runtime

| Variable | Meaning |
| --- | --- |
| `BUILD_EXCHANGE_ROOT` | Shared protocol root |
| `BUILD_MAX_WORKSPACE_BYTES` | Runner cap, additionally clamped to 2 GB |
| `BUILD_MAX_LOG_BYTES` | Runner log cap, additionally clamped to 10 MB |
| `RELEASE_VERSION` | Immutable image revision label |

`NEXT_PUBLIC_*` variables are public and build-time. Changing them requires a
web rebuild. Server-only variables should never use that prefix.

## 29. Production validation

`server/scripts/production-preflight.ts` validates:

- production environment file exists and has mode 600;
- `NODE_ENV=production`;
- immutable non-`latest`/non-`local` release identifier;
- explicit credential-rotation and test attestations;
- encryption, webhook, and full production configuration;
- independent infrastructure secret values;
- database URL fields match PostgreSQL variables;
- Redis URL password matches Redis configuration;
- MinIO root and application identities differ;
- bucket matches the restricted policy;
- no sensitive environment file is tracked by Git;
- source contains no known authentication-bypass markers;
- effective production Compose configuration is valid.

`server/scripts/verify-production-images.ts` verifies expected immutable images.
Server Jest tests cover authorization, configuration, webhooks, paths, MinIO,
worker behavior, serving filters, and security invariants. Web tests cover Clerk
routing/secret boundaries, authorized SSE transport, stored-secret masking,
workspace selection, and origin isolation.

Recommended release gate:

```bash
cd server
npm run build
npm test
npm run security:preflight
npm run security:images

cd ../web
npm run lint
npm run test:auth
npm run build
```

Apply Prisma migrations before starting code that depends on them. Use one
reviewed release identifier across API, worker, runner, web, and MinIO images.

## 30. Failure behavior and recovery

### API or web unavailable

Caddy health/upstream errors are visible without affecting stored PostgreSQL or
MinIO data. Restart the affected stateless process after checking environment
validation.

### Worker crashes

BullMQ can retry the job. The API reconciler marks deployment records stale
after 15 minutes. Transient exchange files may remain until a retry/cleanup or
manual operational cleanup.

### Runner crashes or times out

No valid result arrives, so the worker fails the deployment after its timeout.
The previous active deployment remains live.

### Redis unavailable

Deployment intake/queueing, SSE live pub/sub, OAuth state, webhook replay
protection, throttling, and reconciler locking are affected. PostgreSQL log
history and already published MinIO artifacts remain.

### PostgreSQL unavailable

Authentication linkage, authorization, projects, deployment state, custom
domains, metrics, and static hostname resolution fail. MinIO bytes alone are
not enough to route projects because the active deployment pointer is in
PostgreSQL.

### MinIO unavailable

Build upload and site serving fail. Project/control-plane records remain.

### Encryption key mismatch

API/worker startup validates key shape, not whether it matches existing
ciphertext. Decryption fails when GitHub tokens or environment values are used.
Restore the correct key from secret backup.

### GitHub token revoked

Repository listing and webhook management fail. Existing public artifacts remain
online. Reconnect GitHub to store a fresh encrypted token.

### Webhook secret mismatch

All GitHub deliveries receive 401. Update the GitHub repository webhook and
server configuration to the same secret; do not disable signature checking.

### DNS/custom-domain failure

Unverified domains are not certificate-approved or served. Generated project
hostnames continue to work independently.

## 31. Current implementation limits and important invariants

- Static output only.
- One webhook-enabled project per creating user.
- Thirty webhook deployments per rolling 24 hours per creating user.
- Two active deployments per project and worker concurrency of two.
- One runner request per runner process lifecycle.
- 300-second isolated execution and 320-second worker wait.
- 1.5 GB default workspace, 5 MB default log, 100 MB/10,000-file artifact caps.
- GitHub repository listing fetches one page of at most 100 repositories.
- SPA fallback always serves root `index.html` for missing paths.
- No artifact garbage collector.
- No observability retention/anonymization job.
- No log secret redaction.
- No SSE event IDs, heartbeat, overlap deduplication, or explicit terminal
  server close.
- No automatic encryption-key rotation/versioning.
- No organization member-management UI/API beyond creation and reading current
  memberships.
- Admin cancellation marks state and removes a queued job when possible; it does
  not immediately kill an already running nsjail child.
- The repository browser can list private repositories, but the runner clones
  only the stored HTTPS URL and does not inject the GitHub OAuth token into
  `git clone`; private-repository builds therefore require additional clone
  authentication that is not implemented.

Security-critical invariants:

- dashboard and generated sites remain separate origins;
- generated-site requests never receive dashboard cookies/bearer tokens;
- production callback/origin variables exactly match `BASE_DOMAIN`;
- `SITES_DOMAIN` is distinct from and does not contain the dashboard;
- `DOMAIN_CNAME_TARGET` is dedicated and outside the generated-site zone;
- queue jobs carry deployment identity, while trusted settings are reloaded
  from PostgreSQL;
- build output real paths remain inside the repository workspace;
- successful deployment activation and success state commit atomically;
- only verified/known domains receive on-demand certificate approval;
- stored recoverable secrets use authenticated encryption, not plaintext or
  irreversible hashing.

## 32. Rate limits, quotas, capacity decisions, and rationale

This section is the consolidated register for every implemented traffic,
product, queue, payload, build, and time-window limit. Earlier sections explain
the corresponding subsystem; this section exists so an operator can audit
capacity policy without reconstructing it from source.

### HTTP request throttles

Nest’s throttler uses Redis storage. This makes counters shared across API
instances instead of resetting independently per container. When a request
exceeds its applicable throttle, the framework rejects it with HTTP 429 before
the controller performs its normal work.

| Scope | Implemented limit | Enforcement | Decision and consequence |
| --- | ---: | --- | --- |
| Default Nest request traffic | 100 requests per 60 seconds | Global `ThrottlerGuard` in `AppModule` | Baseline abuse protection for all API routes |
| GitHub webhook endpoint | 120 requests per 60 seconds | `@Throttle` on `POST /webhooks/github` | Allows provider delivery bursts while signature and replay checks still reject unauthenticated/duplicate work |
| Deployment SSE connection endpoint | 20 requests per 60 seconds | `@Throttle` on deployment log route | Each stream creates a dedicated Redis subscriber, so connection churn is more expensive than an ordinary read |
| Caddy certificate approval endpoint | 30 requests per 60 seconds | Controller-level `@Throttle` | Limits on-demand certificate probing and database lookup abuse |

The default throttle also applies to generated-site and custom-domain traffic,
because Caddy routes published files through Nest’s `/serve` controllers. A
single HTML page can generate many asset requests, all of which count as API
requests. Therefore the current 100-per-minute policy can throttle legitimate
visitors or asset-heavy sites. There is no separate published-site rate policy,
CDN cache, bandwidth quota, or Caddy-native limiter in this repository. Before
supporting meaningful public traffic, serving routes should receive a deliberate
separate policy rather than inheriting the control-plane default.

The request tracker is supplied by Nest’s throttler and operates with the API’s
one-hop proxy trust configuration. Correct forwarding of the real client IP by
Caddy is essential; otherwise many visitors can collapse onto the proxy address
and share one throttle bucket.

Clerk and GitHub may impose additional provider-side API/login limits. Kyte does
not configure or mirror those external limits locally.

### Account and product quotas

| Resource | Implemented limit | Scope | Enforcement/failure |
| --- | ---: | --- | --- |
| Projects | Default 4 | Creating user across all organizations | Serializable transaction returns structured HTTP 403 `PROJECT_LIMIT_REACHED` |
| Project limit configuration | 0–100 | Platform default or individual override | Admin DTO validation |
| Webhook-enabled projects | 1 | Creating user | Service check plus partial unique PostgreSQL index; returns structured HTTP 403 |
| Webhook deployments | 30 in rolling 24 hours | Creating user (`deployedBy`) | Count inside serializable deployment transaction; webhook delivery is acknowledged but build is skipped |
| Active deployments | 2 | Project | Counts `QUEUED`, `BUILDING`, and `UPLOADING`; new request receives a bad-request error |
| Worker concurrency | 2 | Entire worker process | BullMQ worker option; at most two job processors run in one worker |
| Runner concurrency | 1 request per runner lifecycle | Runner container | Queue directory claims one file, produces one result, then exits for Compose restart |

The project limit is designed as a user-wide capacity allowance even when the
user owns projects in multiple organizations. It is not an organization billing
limit.

The one-webhook limit has two enforcement layers because creating a remote
GitHub hook and updating local state is not one cross-system transaction. The
database constraint closes concurrent races; if it wins after GitHub creation,
Kyte attempts compensating deletion of the remote hook.

The 30-build webhook window counts records whose `deployedAt` is within the
preceding 24 hours. It is a rolling timestamp window, not a calendar-day reset.
Manual deployments are outside this quota but still use the per-project active
limit, global pause, BullMQ queue, worker capacity, and build resource limits.

Worker concurrency two permits separate projects to progress concurrently at
the trusted orchestration layer. The current topology has a single build-runner
service that processes one exchange request per process lifecycle, so actual
untrusted command execution can serialize behind that runner even while two
worker jobs are active.

### Queue policy and backpressure

| Decision | Value | Reason/behavior |
| --- | ---: | --- |
| BullMQ attempts | 2 | One retry for transient worker/infrastructure failure |
| Retry backoff | Exponential, starting at 5 seconds | Avoids immediate repeated pressure |
| Completed job retention | Removed immediately | PostgreSQL is the product deployment history |
| Failed BullMQ retention | Up to 24 hours and 100 jobs | Short operational debugging window with bounded Redis growth |
| Deployment deduplication | Same project + commit + trigger while active | Reuses an existing active record instead of queueing duplicate work |
| Reconciler cadence | Every 5 minutes | Periodic repair without a per-job watchdog timer |
| Stale-active threshold | 15 minutes | Active records older than normal build limits are marked failed |
| Reconciler leader lease | 10 seconds | Prevents multiple API instances performing the same repair pass |

There is no configured global queue-length cap, per-user queued-job cap, or
admission control based on remaining disk/CPU capacity. Per-project active
counts and webhook quotas are the current backpressure mechanisms.

### Request and model-size limits

| Input | Limit | Failure layer |
| --- | ---: | --- |
| JSON request body | 256 KiB | Nest body parser |
| URL-encoded body | 64 KiB | Nest body parser |
| Request URL | 2,048 characters | Custom middleware returns HTTP 414 |
| Pagination `take` | Default 20, maximum 100 | DTO validation |
| Project name | 1–80 characters with visible content | DTO validation |
| Project description | 500 characters | DTO validation |
| Repository URL | 300 characters and GitHub URL syntax | DTO validation |
| Branch | 200-character validated Git ref shape | DTO validation |
| Root/output directory | 200-character safe relative path | DTO plus runtime real-path validation |
| Build command | 500 characters at project API; runner accepts at most 1,000 | DTO and runner validation |
| Environment variables | 100 unique keys per request | DTO validation |
| Environment key | 128 characters, shell-identifier syntax | DTO/parameter pipe |
| Environment value | 16,384 characters | DTO validation |
| Deployment commit message | 500 characters | DTO/webhook truncation |
| Manual commit selector | `HEAD` or 7–40 hex characters | Deployment DTO |
| OAuth callback code | 1–256 Base64URL-like characters | DTO validation |
| OAuth state | 40–128 Base64URL-like characters | DTO and service validation |
| Organization name | 1–80 characters | DTO validation |
| Organization slug | 1–60 characters with single-hyphen structure | DTO validation |
| Custom hostname | 1–253 characters before normalization | DTO/service validation |

These validation limits protect parser/database boundaries; they do not replace
authorization or build isolation.

### Build and artifact resource limits

| Resource | Default/effective limit | Enforcement | Result when exceeded |
| --- | ---: | --- | --- |
| Isolated wall time | 300 seconds | nsjail `time_limit` | Child fails; deployment becomes `FAILED` |
| Isolated CPU rlimit | 300 | nsjail | Child fails |
| Worker wait for runner result | 320 seconds | 200 ms exchange poll loop | Worker throws timeout and stores `FAILED` |
| Workspace size | 1.5 GB default; configurable value clamped to at most 2 GB | Runner scans once per second | Child receives `SIGKILL`; deployment fails |
| Captured build log | 5 MB default; configurable value clamped to at most 10 MB | Runner byte counter | Remaining chunk is truncated and a notice is appended |
| Artifact bytes | 100 MiB | Worker upload pre-scan | Upload is rejected; deployment fails |
| Artifact files | 10,000 | Worker upload pre-scan | Upload is rejected; deployment fails |
| Runner container memory | 1,536 MiB | Docker cgroup | Container/process can be killed |
| Runner CPU | 1 CPU | Docker cgroup | CPU is throttled |
| Runner PIDs | 600 | Docker cgroup | New processes fail |
| nsjail open files | 4,096 | `rlimit_nofile` | Additional descriptors fail |
| nsjail process limit | 512 | `rlimit_nproc` | Additional processes fail |
| nsjail file-size rlimit | 256 | `rlimit_fsize` | Oversized individual file writes fail |

The worker wait is intentionally longer than the nsjail execution limit so the
runner has time to flush logs, normalize workspace permissions, and write its
result after the child exits.

The workspace limit covers the clone, installed dependencies, caches written
inside the workspace, and build output. The artifact limit is smaller because
it controls durable MinIO consumption, while workspace data is transient.

The runner reserves one host CPU for the API, database, storage, and proxy on
the documented small two-vCPU deployment. These values are capacity assumptions
for the current VPS topology, not framework requirements.

### Security and replay windows

| State | Lifetime | Why |
| --- | ---: | --- |
| GitHub OAuth state | 15 minutes | Bounds authorization CSRF state and requires prompt callback completion |
| GitHub webhook delivery ID | 24 hours | Suppresses normal provider retry/replay duplication |
| Clerk-to-local-user process cache | 55 seconds | Avoids repeated DB lookup while staying near Clerk’s short token lifetime |
| Caddy HSTS policy | 31,536,000 seconds | Instructs browsers to retain HTTPS-only behavior for one year |

OAuth state is consumed with Redis `GETDEL`, so its practical use count is one
even before the 15-minute TTL. Webhook replay entries use `SET NX`; the first
validly signed delivery wins.

### Browser timing and polling decisions

| Behavior | Interval/timeout | Purpose |
| --- | ---: | --- |
| Sidebar deployment status poll | 5 seconds | Cross-project success/failure notifications |
| Runner queue-directory poll | 250 ms | Claim file requests without connecting runner to Redis |
| Worker exchange log/result poll | 200 ms | Low-latency logs over the file boundary |
| Preview readiness timeout | 15 seconds | Replace indefinite iframe loading with retry UI |
| Success-to-preview UI delay | 3 seconds | Allows browser/DNS/TLS surface to settle after committed activation |
| Domain copy feedback | 1.6 seconds | UI-only copied state |

Observability and admin pages deliberately do not poll in the background. This
reduces control-plane load and makes their “updated at” values meaningful, at
the cost of showing snapshots until the user refreshes.

### Health-check policy

Compose health checks generally run every 10 seconds with five or ten retries.
Redis uses a three-second timeout; most HTTP/database/storage checks use five
seconds. Dependency conditions prevent API/web/Caddy/worker startup from racing
required service readiness. Health checks detect process/service readiness; they
do not prove that an end-to-end deployment, external GitHub request, DNS lookup,
or certificate issuance works.

### Which limits are configurable

Runtime/admin configurable:

- default and per-user project allowance, within 0–100;
- deployment intake pause;
- workspace and log byte caps through runner environment, subject to hard
  maximum clamps;
- Docker CPU/memory/PID values by editing deployment configuration.

Hard-coded application policy:

- HTTP throttle values;
- one webhook-enabled project;
- 30 webhook builds per rolling day;
- two active deployments per project;
- BullMQ attempts/backoff/retention;
- worker concurrency;
- OAuth/replay/cache TTLs;
- polling/reconciler intervals;
- artifact file/byte caps;
- body, pagination, and DTO limits.

Changing a hard-coded value requires code modification, tests, and a new
API/worker/runner image as applicable.

### Capacity controls not currently implemented

The current application has no:

- separate dashboard, webhook, and published-site rate-limit identities/policies
  beyond the listed route overrides;
- plan-specific HTTP limits;
- per-organization project or build quota;
- per-user manual-deployment rolling quota;
- global queue depth or total concurrent-platform admission limit;
- aggregate storage quota per user/project;
- artifact retention or garbage-collection policy;
- request-log/deployment-log retention limit;
- bandwidth/egress quota;
- SSE client count cap beyond connection-attempt throttling;
- log-stream byte backpressure or browser-side maximum retained chunks;
- automatic capacity-based scaling.

These are not undocumented hidden protections; they are absent from the current
implementation and must be designed explicitly before Kyte is treated as a
multi-tenant high-traffic platform.
