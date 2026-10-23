[한국어](../backend-design.md) | **English**

# Backend design

This document describes the structure and design decisions of the MacFolio API server (`apps/api`). The deployment steps are in [deployment.md](deployment.md), and the reasons for the technology choices are in the [README](../../README.en.md#tech-stack).

| Item            | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Runtime         | Node 22, NestJS, Prisma 7, PostgreSQL 17                                                       |
| Feature modules | 11: auth, posts, comments, memo, messages, visitors, files, images, wallpapers, github, health |
| Data models     | 10, with 12 migrations (`apps/api/prisma`)                                                     |
| Tests           | 120+ unit and e2e (e2e against real PostgreSQL)                                                |
| Operations      | One Oracle Cloud VM, Docker Compose, Cloudflare Tunnel (no ports open to the outside)          |

## Architecture diagram

```mermaid
flowchart LR
    browser["Browser<br/>(React SPA)"]

    subgraph cf["Cloudflare"]
        workers["Worker + static assets<br/>macfolio.hyeoniverse.com"]
        tunnel["Tunnel<br/>macfolio-api.hyeoniverse.com"]
    end

    subgraph vm["Oracle VM · docker compose (no outside ports)"]
        cloudflared["cloudflared"]
        api["NestJS API :4000"]
        db[("PostgreSQL 17")]
    end

    subgraph ext["External services"]
        github["GitHub<br/>OAuth · REST API"]
        photos["Unsplash · Pexels"]
    end

    subgraph ci["CI/CD"]
        repo["GitHub repository"]
        actions["GitHub Actions<br/>lint · type · unit · e2e"]
        ghcr["GHCR<br/>API image"]
    end

    browser -- "Pages" --> workers
    browser -- "API requests · session cookie" --> tunnel
    tunnel -- "Tunnel (cloudflared connects first)" --> cloudflared --> api
    api -- "Prisma" --> db
    api -- "Cache" --> github
    api --> photos
    repo --> actions -- "wrangler deploy only for passing commits" --> workers
    workers -. "GET /site · /posts (first paint · SEO)" .-> tunnel
    actions -- "Only commits that change the API" --> ghcr -- "SSH → ops/deploy.sh<br/>falls back to previous image on failure" --> api
```

- **Same site, different subdomains**: the frontend and API both live under `hyeoniverse.com`, so the `SameSite=Lax` session cookie is sent along. If the API were on `*.workers.dev` or an IP address, login wouldn't work.
- **A server with no inbound door**: `cloudflared` opens an outbound connection to Cloudflare, and requests come in only through that connection. Ports 80 and 443 aren't opened in the firewall, and Cloudflare handles certificates. The compose file has no `ports` at all, so the DB isn't visible outside the container network.
- **Deploy after checks**: for the frontend, only commits on main that pass `check` (including API e2e against real PostgreSQL and browser E2E) are deployed to Workers. For the API, Actions builds an image only for commits that change it, pushes it to GHCR, and calls `ops/deploy.sh` on the server over SSH to swap it in. If the new container fails its health check, the previous image is restored. Migrations are applied at startup with `prisma migrate deploy` (the DB isn't rolled back, so migrations must also be compatible with the previous code).

## The path of a request

Every request passes through the same layers in order (`app.setup.ts`).

| Layer                   | What it does                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `trust proxy`           | Reads the real visitor IP behind the tunnel (used for rate limiting and IP records)                                                                    |
| helmet                  | Security headers                                                                                                                                       |
| CORS                    | Allows only the site's origins. Cookies only for the exact listed origins; PR previews (`*`) are read-only, and admin APIs reject that Origin with 403 |
| `ValidationPipe`        | Validates every input with DTOs and rejects any field not declared (`forbidNonWhitelisted`)                                                            |
| `AdminGuard`            | On admin-only routes, checks the session cookie against the DB on every request                                                                        |
| `ThrottlerGuard`        | Applies separate per-IP, per-minute limits to login and to writing comments and messages                                                               |
| Global exception filter | Normalizes the error shape, answers oversized bodies and malformed JSON with 413 and 400, and unexpected errors with a 500 that hides the details      |
| `SafeLogger`            | Masks DB passwords, API keys, cookies and email addresses in all logs (`common/redact.ts`)                                                             |

## Modules and permissions

The default is: anyone can read, only the admin can write. Every write route has a rate limit (`@RateLimit`, a per-minute count per IP and route), and places where visitors write (comments, messages, mail) identify the owner by the visitor cookie. The table in `test/routes.e2e.test.ts` pins down the list of routes along with their permissions and limits.

| Module     | Routes                                                                                | Who                                                         |
| ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| auth       | `GET /auth/github`, `/auth/github/callback`, `/auth/me`, `POST /auth/logout`          | Login is rate-limited, `me` is admin                        |
| posts      | `GET /posts` / draft, publish, versions, restore, delete, secret                      | Reading is anyone, the rest is admin                        |
| comments   | `GET·POST /posts/:slug/comments`, `DELETE /comments/:id`                              | Visitors (rate-limited, can delete only their own comments) |
| messages   | `GET·POST /messages/threads`, `DELETE /messages/:id`                                  | Visitors (rate-limited, can delete only their own messages) |
| visitors   | `GET /visitor`                                                                        | Issues the visitor cookie and returns the name              |
| memo       | `GET·PUT /memo/organization`                                                          | Reading is anyone, changing is admin                        |
| finder     | `GET·PUT /finder/layout`                                                              | Reading is anyone, changing is admin                        |
| files      | `POST /files`, `GET /files/:id`                                                       | Uploading is admin, downloading is anyone                   |
| wallpapers | `GET·POST·PATCH·DELETE /wallpapers`                                                   | Reading is anyone, the rest is admin                        |
| images     | `GET /images/search` etc.                                                             | Admin (Unsplash and Pexels search)                          |
| github     | `GET /github/profile`, `/github/activity`, candidates, lookup, `PUT /github/showcase` | Profile and activity are anyone, the rest is admin          |
| health     | `GET /health`                                                                         | Anyone                                                      |

The API docs are generated automatically with Swagger: https://macfolio-api.hyeoniverse.com/docs

The site's API Docs (API 문서) app exports the same docs as `openapi.json` and renders them inside the site (Scalar; visible even when the server is down). When you change a controller or DTO, regenerate this file with `pnpm --filter @macfolio/api openapi` and commit it alongside. If you forget, `apps/api/src/openapi.test.ts` fails.

## Admin login

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant G as GitHub
    participant D as DB

    B->>A: GET /auth/github
    A->>B: state cookie (10 min) + redirect to GitHub
    B->>G: Log in · authorize
    G->>B: Redirect to /auth/github/callback?code&state
    B->>A: callback (with state cookie)
    A->>A: Constant-time compare of state (400 if different)
    A->>G: code → access token → user info
    A->>A: Does the numeric ID match the admin ID?
    A->>D: Save session (only the token's SHA-256, 12 hours)
    A->>B: Session cookie (httpOnly · Secure · SameSite=Lax)
```

- The server stores no passwords. There is one admin, verified with the GitHub account they already use.
- The admin is identified by the immutable numeric ID, not by the account name, which can change.
- Sessions live in the DB, so logging out cuts them off immediately. Once the expiry time passes, the UI re-checks on its own and switches to the logged-out state.

## Data model

```mermaid
erDiagram
    AdminSession {
        string tokenHash "SHA-256, unique"
        int githubId
        datetime expiresAt "index"
    }
    Post ||--o{ PostRevision : "on every publish (last 50)"
    Post {
        string slug PK
        string title "published"
        string draftTitle "draft"
        datetime deletedAt "restorable for 30 days"
        boolean secret "admin only"
    }
    PostRevision {
        int id PK
        string postSlug FK
    }
    PostComment {
        string postSlug "index"
        string visitorHash "HMAC"
        string ipHash "HMAC"
    }
    MessageThread ||--o{ GuestMessage : "replies"
    MessageThread {
        string visitorHash "HMAC"
    }
    GuestMessage {
        string threadId FK "empty = reply to the site owner's notice"
    }
    Upload ||--o| Wallpaper : "original"
    Upload ||--o| Wallpaper : "thumbnail"
    Upload {
        string id PK "random"
        bytes data "up to 10MB"
    }
    MemoOrganization {
        int id PK "single row"
        json data
    }
    FinderLayout {
        int id PK "single row"
        json data
    }
    GithubShowcase {
        int id PK "single row"
        json repos
    }
```

- **Blog posts live in two places.** Markdown files in the repository are the baseline, and posts the admin writes or edits go in `Post`. When the address (slug) matches, `Post` replaces the file. Deleting a file-based post leaves only a `deleted` marker so it no longer appears.
- **Secret posts are visible only to the admin.** A post with `Post.secret` set is left out of the visitor list (`GET /posts`) and the share card, and without an admin session the comments, likes, popular posts, view counts, traffic summary and memo organization treat it like a post that doesn't exist (empty list, 0, 404). The Worker builds the first-screen body, sitemap and RSS from `GET /posts` without cookies, so secret posts never get in. Only server-only posts can be secret: repository Markdown posts already have their source in the public repository and can't be hidden.
- **Published content and draft share one row.** While editing, only `draft*` changes, so visitors don't see it; publishing moves it into the published fields and records a `PostRevision`. If the date is later than today, visitors don't see the post until that day (scheduled publishing).
- **Settings-like values are single-row JSON.** Memo folder organization (`MemoOrganization`), Finder folder structure (`FinderLayout`: created folders, the visible location of moved files, and desktop aliases) and the repositories shown in the GitHub app (`GithubShowcase`) are read and written as a whole, so each lives in one row.

## Design decisions

| Topic                           | Chosen approach                                                                                                                                                                                                                                                                 | Alternatives                              | Rationale · risk prevented                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth · sessions**             |                                                                                                                                                                                                                                                                                 |                                           |                                                                                                                                                                                                                               |
| Admin login                     | GitHub OAuth implemented directly. `state` remembered in a cookie and compared in constant time                                                                                                                                                                                 | Username and password, an auth library    | No passwords are stored. Prevents request forgery via a login someone else started, and timing attacks                                                                                                                        |
| Session storage                 | Random token only in the cookie, only its SHA-256 hash in the DB. Index on expiry time                                                                                                                                                                                          | JWT, storing the raw token                | Logout and expiry cut sessions off immediately on the server. Even if the DB leaks, sessions can't be hijacked                                                                                                                |
| Admin check                     | Immutable GitHub numeric ID                                                                                                                                                                                                                                                     | Account name                              | Renaming the account, or someone else taking that name, doesn't transfer the permission                                                                                                                                       |
| Cookie                          | `httpOnly` · `SameSite=Lax` · `Secure`                                                                                                                                                                                                                                          | Token in localStorage                     | Scripts can't read the token, and the cookie isn't attached to requests sent from other sites                                                                                                                                 |
| **Visitors · abuse prevention** |                                                                                                                                                                                                                                                                                 |                                           |                                                                                                                                                                                                                               |
| Visitor identification          | A 1-year cookie token stored as an HMAC with a secret key. The UI receives only whether a post is mine (`mine`) or a short ID made by hashing that value again                                                                                                                  | Sign-up, name and password                | Without signing up, you can delete only what you wrote from the same browser. The raw token never stays on the server, and the values sent to the UI can't be used to delete other people's posts                             |
| Older comments                  | Name-and-password (scrypt) comments are left as they are, and new comments use the visitor cookie                                                                                                                                                                               | Migrating everything at once              | Changes the approach without breaking data that has already accumulated                                                                                                                                                       |
| IP records                      | Only the first two parts for display and an HMAC                                                                                                                                                                                                                                | Storing the raw IP                        | Keeps personal data to a minimum while still grouping posts written by the same person                                                                                                                                        |
| Rate limiting                   | Per IP and route, per minute; six names (login, comment, write, upload, demo, events), one `@RateLimit` per write route (`common/rate-limit.ts`)                                                                                                                                | A single global limit                     | Blocks brute-force logins, spam and flooding of admin routes without limiting read requests. The route table test catches any route that's missing one                                                                        |
| **Data**                        |                                                                                                                                                                                                                                                                                 |                                           |                                                                                                                                                                                                                               |
| Required fields                 | DB `CHECK` constraints (migration SQL) on top of UI and API validation                                                                                                                                                                                                          | Application validation only               | Writes that bypass the API (scripts, bugs) still can't insert an empty title or an invalid date                                                                                                                               |
| Post editing                    | Separate published content and draft, a version on every publish (last 50), scheduled publishing                                                                                                                                                                                | Overwriting a single field                | Content being edited isn't visible to visitors, and a mistaken publish can be reverted                                                                                                                                        |
| Deleting posts                  | Soft delete that records `deletedAt`, restorable for 30 days                                                                                                                                                                                                                    | Deleting immediately                      | Accidentally deleted posts can be recovered                                                                                                                                                                                   |
| Secret posts                    | A single `Post.secret` column. Every public route that takes a post address filters on the server (`posts/secret-posts.service.ts`) and answers visitors as if the post didn't exist                                                                                            | Hiding only in the UI, a separate table   | Calling the API directly doesn't reveal it, and response differences can't tell whether a secret post exists. If a deploy is rolled back, the previous code doesn't read this column, so the posts are public in the meantime |
| File uploads                    | Stored in the DB (`bytea`), 10MB limit, image format checked from the file header, EXIF and XMP (location, device) stripped from photos keeping only orientation, unguessable random ID                                                                                         | Server disk, object storage               | A single backup (`pg_dump`) captures posts and files together. Blocks files with only a renamed extension and guessing of addresses, and keeps photo location data from being published                                       |
| **External integrations**       |                                                                                                                                                                                                                                                                                 |                                           |                                                                                                                                                                                                                               |
| GitHub data                     | Server cache (10 minutes with a token, 30 without). Concurrent requests are coalesced into one, the last value is served on failure, and saving invalidates it immediately. The contribution calendar and activity are cached separately, so if one fails the other still shows | Calling from the browser directly         | GitHub calls stay constant regardless of visitor count (60 per hour without a token). The UI isn't empty even during a GitHub outage                                                                                          |
| Testing external APIs           | External calls gathered into a single client class, replaced with a fake class in e2e                                                                                                                                                                                           | Testing against the real API              | Test results are always the same regardless of the network or rate limits                                                                                                                                                     |
| **Infrastructure · deployment** |                                                                                                                                                                                                                                                                                 |                                           |                                                                                                                                                                                                                               |
| Server exposure                 | Cloudflare Tunnel, no outside ports in compose                                                                                                                                                                                                                                  | Opening 80 and 443, nginx + Let's Encrypt | Fewer entry points to attack, the server IP isn't exposed, and certificate renewal isn't a concern                                                                                                                            |
| Server                          | Oracle Cloud Always Free VM + Docker Compose                                                                                                                                                                                                                                    | Free hosting such as Render               | Doesn't sleep when there are no requests (free hosting sleeps after 15 minutes and takes about a minute to wake). I run a Linux VM and Docker myself                                                                          |
| Frontend deployment             | `wrangler deploy` from GitHub Actions only for commits that pass `check`, a preview URL for each PR                                                                                                                                                                             | Cloudflare Workers Builds                 | No deploy skips the tests. I moved after running into deploys stalling because of outages in the platform's build environment                                                                                                 |

## Tests

- **Unit (Vitest)**: checks pure functions kept apart from the DB, such as input rules, sessions and hashes, visitor names, and shaping GitHub responses. Rules are collected in `rules.ts`, and controllers only use their results.
- **e2e (supertest)**: in CI, a PostgreSQL service container is started and the tests run against a real DB. They check permissions (401 if not admin, 400 for rule violations), that only hashes are stored, and rate limiting (429). GitHub and the photo services are swapped for fake classes.
- **Browser E2E (Playwright)**: frontend tests run against a fake API built with `page.route`, so when the API shape changes, tests on both sides are updated together.

## Operations

| Task            | Command (`~/deploy` on the server)                                                  |
| --------------- | ----------------------------------------------------------------------------------- |
| Deploy new code | `cd ~/macfolio && git pull`, `cd ~/deploy && docker compose up -d --build api`      |
| Logs            | `docker compose logs --tail=40 api`                                                 |
| Backup          | `docker compose exec -T db pg_dump -U macfolio macfolio > ~/backup-$(date +%F).sql` |

Details and troubleshooting are in [deployment.md](deployment.md).
