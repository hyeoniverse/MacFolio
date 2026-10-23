[한국어](../deployment.md) | **English**

# Deployment

The frontend goes on Cloudflare Workers and the API on an Oracle Cloud Always Free VM. The server opens no ports and connects to the outside only through Cloudflare Tunnel.

![Deployment architecture](../../apps/react/src/apps/memo/content/images/deploy-architecture.svg)

| What     | URL                                         | Where                            | Deploy                                                                                                                                    |
| -------- | ------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend | `https://macfolio.hyeoniverse.com`          | Cloudflare Workers static assets | GitHub Actions, on merge to main                                                                                                          |
| API      | `https://macfolio-api.hyeoniverse.com`      | Oracle VM, docker compose        | On merge to main, GitHub Actions builds the image and ships it to the server ([#100](https://github.com/hyeoniverse/MacFolio/issues/100)) |
| API docs | `https://macfolio-api.hyeoniverse.com/docs` | Swagger                          |                                                                                                                                           |

The frontend and the API have different hostnames but are the same site (`hyeoniverse.com`), so the `SameSite=Lax` session cookie is sent along. **The API must live on a subdomain of `hyeoniverse.com` over https.** On `*.workers.dev` or a bare IP address, login does not work.

- [1. Frontend (Cloudflare Workers)](#1-frontend-cloudflare-workers)
- [2. GitHub OAuth App](#2-github-oauth-app)
- [3. Create the Oracle VM](#3-create-the-oracle-vm)
- [4. Prepare the server](#4-prepare-the-server)
- [5. Cloudflare Tunnel](#5-cloudflare-tunnel)
- [6. Configuration files](#6-configuration-files)
- [7. Run and verify](#7-run-and-verify)
- [Operations](#operations)
- [Troubleshooting](#troubleshooting)

## 1. Frontend (Cloudflare Workers)

The configuration is in `wrangler.jsonc` at the root. Files in `apps/react/dist` are served as [static assets](https://developers.cloudflare.com/workers/static-assets/) without going through the Worker; only the first page (`/`, `/index.html`), `sitemap.xml`·`rss.xml`, and addresses with no matching file go to the Worker (`apps/react/worker/index.ts`).

- First page and app addresses (`/memo/<post>`, `/safari/<project>`): inserts site content and the search-engine body into `index.html` and attaches the CSP. Unknown post and project addresses get 404 (`noindex`)
- `sitemap.xml`·`rss.xml`: generated from repository posts merged with posts written on the server
- `/files/<key>`: document files from the R2 bucket (see [Document files (R2)](#document-files-r2) below)
- Missing `/assets/*`: 404 (so requests for old build code files don't get `index.html`, [#103](https://github.com/hyeoniverse/MacFolio/pull/103))

GitHub Actions (`.github/workflows/ci.yml`) does the build and deploy ([#82](https://github.com/hyeoniverse/MacFolio/pull/82)). Cloudflare's build servers (Workers Builds) are not used. The actions the workflow uses are pinned to commit SHAs rather than tags (`@v7`) (a tag can later point at different code), and Dependabot (`.github/dependabot.yml`) opens PRs for new versions.

- **main**: once the tests (`check`) pass, the `deploy` job pushes to the live site with `wrangler deploy`. A commit whose tests fail is not deployed.
- **PR**: the `preview` job uploads a [preview version](https://developers.cloudflare.com/workers/configuration/previews/) with `wrangler versions upload --preview-alias <branch>` and posts the URL in a single PR comment (new commits edit the same comment). The live site does not change. Previews only read from the real API: the URL is `*.workers.dev`, so the `SameSite=Lax` session cookie is not sent, the API does not allow cookies for origins matched by `*`, and admin APIs reject such an Origin with 403. To check admin features of a preview, do it locally (`pnpm dev`). The job is skipped for Dependabot PRs and for PRs that don't touch frontend files (`apps/react`, `packages`, the lockfile, etc.). Uploading is free in itself (billing is by request count only) and only the latest 100 versions are kept, but skipping saves CI time and comments.

### First time: token and Git connection

1. Cloudflare dashboard → profile at the top right → **My Profile → API Tokens → Create Token**
   - Pick the **Edit Cloudflare Workers** template
   - Account Resources: my account, Zone Resources: All zones from an account (or hyeoniverse.com)
   - The token is shown only once, so copy it right away
2. Account ID: copy the **Account ID** on the right side of the Workers & Pages screen
3. GitHub repository → Settings → Secrets and variables → **Actions → New repository secret**
   - `CLOUDFLARE_API_TOKEN` = the token from 1
   - `CLOUDFLARE_ACCOUNT_ID` = the account ID from 2
4. After confirming one successful GitHub Actions deploy, disconnect Cloudflare's Git connection, so the two don't both deploy.
   - Workers & Pages → `macfolio` → Settings → **Build** → Git repository → **Disconnect**

### Document files (R2)

Résumé, portfolio and certificate files, plus per-project files (slides etc.; PDF, PNG, JPG, WebP, up to 20MB), are not kept in the repository but in the Cloudflare R2 bucket `macfolio-files`. The site Worker (`apps/react/worker/files.ts`) serves them at `/files/<key>` on the same hostname, and when opened from Finder, the Preview (미리보기) app (`apps/react/src/apps/preview`) renders pages with pdf.js or shows the image (on phones, inside the Files app). Which folder holds what (the listing) lives in the API's DB (`Document` table, `GET /documents`).

- Response: `Content-Type` matching the extension, `ETag` (304 if `If-None-Match` matches), `Cache-Control: public, max-age=300`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` (`attachment` with `?download=1`), and a CSP that only allows embedding in iframes on this site (`frame-ancestors 'self'`)
- Missing files, paths like `..`, and keys that aren't pdf·png·jpg·jpeg·webp return 404. Methods other than GET·HEAD return 405. Where there is no binding (local `pnpm dev`) it is also 404

**Uploading (admin)**: log in as admin and drag files into Finder's Documents (문서) › Résumé (이력서) · Portfolio (포트폴리오) · Certificates (자격증) folder, or into Documents › Portfolio › <project> folder (or onto that folder's icon). Files in a project folder are uploaded with the folder value `project:<project id>`. Files never pass through the API server.

1. Browser → API `POST /documents/uploads` (folder, name, size): the API checks that the caller is admin and that type and size are valid, then returns a [**signed URL**](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) for uploading straight to R2 (5 minutes; only accepted if `Content-Length` equals that size). The key is `resume|portfolio|certificates|desktop|pictures/<random>.<ext>` (`desktop` for the desktop, `pictures` for Home › Pictures), or `projects/<project id>/<random>.<ext>` for project folders
2. Browser → R2 `PUT <signed URL>` (progress shows at the bottom of Finder)
3. Browser → API `POST /documents`: the API does a HEAD on R2 to confirm the file really arrived and the size matches, then adds it to the listing

To rename or delete, select the file and use **File → Rename… / Move to Trash (⌘⌫)** (파일 → 이름 변경… / 휴지통으로 이동) in the menu bar. Deleting also deletes it from R2.

#### Owner's to-do

1. **Bucket**: Cloudflare dashboard → **R2 → Create bucket** → name `macfolio-files`. Or `npx wrangler r2 bucket create macfolio-files`. The binding is already in `wrangler.jsonc` (`FILES` → `macfolio-files`). **Until the bucket exists, deploys (`wrangler deploy`) fail saying the bucket doesn't exist, so do this before merging this change**
2. **API token (S3 keys)**: R2 → **Manage R2 API Tokens → Create API Token**
   - Permissions: **Object Read & Write**
   - Specify bucket(s): **Apply to specific buckets only** → `macfolio-files`
   - TTL: Forever (or whatever period you want)
   - Once created, the **Access Key ID** and **Secret Access Key** are shown only once. The account ID is on the right of the R2 overview (or in the S3 URL `https://<account ID>.r2.cloudflarestorage.com`)
3. **Put them on the server**: add four lines to `~/deploy/api.env` on the server and restart the API (`docker compose up -d api`)

   ```bash
   R2_ACCOUNT_ID=<account ID>
   R2_ACCESS_KEY_ID=<Access Key ID>
   R2_SECRET_ACCESS_KEY=<Secret Access Key>
   R2_BUCKET=macfolio-files
   ```

   Without the three values the listing still shows, and only uploading and deleting are blocked with "서버에 파일 저장소(R2)가 설정되지 않았습니다" (file storage (R2) is not configured on the server) (503)

4. **Bucket [CORS](https://developers.cloudflare.com/r2/buckets/cors/)**: since the browser PUTs straight to R2, add the following under bucket → **Settings → CORS Policy → Add CORS policy** (PUT only, from the site's origin)

   ```json
   [
   	{
   		"AllowedOrigins": ["https://macfolio.hyeoniverse.com"],
   		"AllowedMethods": ["PUT"],
   		"AllowedHeaders": ["content-type"],
   		"MaxAgeSeconds": 3600
   	}
   ]
   ```

   To try uploading from a PR preview URL, add that URL to `AllowedOrigins`. Without this setting, Finder shows "저장소에 연결하지 못했습니다. 버킷의 CORS 설정을 확인해 주세요." (Couldn't connect to storage. Check the bucket's CORS settings.)

5. Before uploading, **remove phone numbers, home address, date of birth, and identity numbers such as the resident registration number** (also mask the certificate number on certificate copies)

#### Trying uploads locally

You can also upload to the real R2 from the local dev server. The listing stays only in the local DB, so it doesn't appear on the deployed site (test files left in R2 are removed from R2 when you delete them in Finder).

1. Put the four lines from step 3 above (`R2_ACCOUNT_ID` etc.) in `apps/api/.env`. Using the same keys as production is fine
2. Add `http://localhost:5173` to the bucket CORS `AllowedOrigins`
3. Use the development GitHub OAuth App so admin login works (the development one in '2. GitHub OAuth App'). Then

   ```bash
   echo 'VITE_API_URL=http://localhost:4000' > apps/react/.env.local
   pnpm dev:all     # frontend 5173 + API 4000
   ```

4. Log in as admin at http://localhost:5173 and drag a file into Finder's Résumé (이력서) folder

The local dev server has no site Worker, so `/files/*` (file downloads) is forwarded to the deployed site (`server.proxy` in `vite.config.ts`). The deployed site reads the same bucket, so files uploaded locally also open in the Preview app. To forward elsewhere, set `FILES_ORIGIN=https://<PR preview URL>` in `apps/react/.env.local` or prefix the command with it (it's passed through to `pnpm dev:all` via `passThroughEnv` in `turbo.json`). Use this when, as in PR [#255](https://github.com/hyeoniverse/MacFolio/pull/255), the change isn't merged yet and the deployed site doesn't have `/files` yet.

To just see the UI without keys, use the fake listing the E2E tests use: in the devtools console, set `window.__MACFOLIO_DOCUMENTS__ = [{ folder: '이력서', name: '시험.pdf', key: 'resume/test.pdf', kind: 'pdf' }]` and open Finder (the file itself doesn't exist, so Preview shows "열 수 없습니다" (can't open)). The whole upload flow is tested by `e2e/finder-upload.spec.ts` against a fake API and fake R2 (`pnpm --filter @macfolio/react test:e2e finder-upload`).

The site CSP's `connect-src` includes `https://*.r2.cloudflarestorage.com` (for uploads to signed URLs). R2 rejects requests without a signature.

Cost: well within [R2's free tier](https://developers.cloudflare.com/r2/pricing/) (10GB storage, 1 million Class A operations/month, 10 million Class B operations/month, free egress). It only reads a handful of documents.

CI: deploys (`deploy` and `preview` in `ci.yml`) run `wrangler deploy`·`wrangler versions upload` with `CLOUDFLARE_API_TOKEN`. Uploading a Worker with an R2 binding requires the token to have the **Account → Workers R2 Storage → Edit** permission. The **Edit Cloudflare Workers** template from "First time" above includes it, so a token made from that template needs no change. If the token was made with hand-picked permissions, edit it under Cloudflare dashboard → My Profile → API Tokens and add this permission. CI does not upload files (the admin uploads them from Finder).

### Setting the API URL

`VITE_API_URL` is baked into the code **at build time**. It is not a runtime variable. The value is in the `env` at the top of `ci.yml` (`https://macfolio-api.hyeoniverse.com`, no trailing `/`). To change it, edit that line and merge to main.

Variables and Secrets in the Cloudflare dashboard are values the Worker reads **at run time**, so putting it there does not get it into the build. If the value is empty, the login button is disabled and "관리자 서버가 아직 연결되지 않았습니다" (The admin server is not connected yet) appears.

`VITE_MESSAGES_STORE` is not set for deployment (leave it empty). When empty, the Messages (메시지) app stores on the server, and if it can't reach the server it shows a "메시지를 열 수 없습니다" (Can't open Messages) alert and closes the app. `local` is a development value for checking the UI without a server; in production it would leave each visitor's messages only in their own browser.

You can tell whether it took effect by looking for the URL in the deployed JS.

```bash
for f in $(curl -s https://macfolio.hyeoniverse.com/ | grep -o '/assets/[^"]*\.js'); do
  curl -s "https://macfolio.hyeoniverse.com$f" | grep -o 'https://macfolio-api.hyeoniverse.com' | head -1
done
```

## 2. GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App ([GitHub docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app))

| Field                      | Production                                                  | Development                                  |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Homepage URL               | `https://macfolio.hyeoniverse.com`                          | `http://localhost:5173`                      |
| Authorization callback URL | `https://macfolio-api.hyeoniverse.com/auth/github/callback` | `http://localhost:4000/auth/github/callback` |

An OAuth App can hold only one callback URL, so create separate production and development apps. After creating them, note the Client ID and Client secret. The secret is shown only once, at creation.

The admin is identified by numeric ID, not by username (`ADMIN_GITHUB_ID`, default `68999618` = hyeoniverse), because usernames can change, and after a change someone else can take the old name.

## 3. Create the Oracle VM

Within the [Always Free](https://www.oracle.com/cloud/free/) limits it is free with no time limit. Sign-up requires a card, but Free Tier accounts aren't charged. The home region can't be changed after sign-up.

Compute → Instances → Create instance

| Field      | Choose                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Image      | Canonical Ubuntu 24.04                                                                                         |
| Shape      | `VM.Standard.A1.Flex` (ARM, free up to 4 OCPU·24GB total) or `VM.Standard.E2.1.Micro` (AMD, 1GB, up to 2 free) |
| Security   | Leave defaults. Don't enable Shielded instance or Confidential computing                                       |
| Networking | public subnet + **Automatically assign public IPv4 address**                                                   |
| SSH keys   | Generate a key pair → **Download private key** (can't be downloaded again)                                     |

- Check that the shape is marked **"Always Free Eligible"**. Other AMD shapes such as `E4/E5.Flex` are paid.
- A1 often hits `Out of host capacity` in popular regions. The current server was created as **E2.1.Micro** (x86_64, 1GB) because no A1 capacity was available. `apps/api/Dockerfile` builds for both amd64 and arm64.
- If the public IP checkbox is blocked with "You must select a public subnet", create a VCN first: Networking → Virtual cloud networks → **Start VCN Wizard** → Create VCN with Internet Connectivity. Then on the instance screen pick Select existing → `public subnet-…`.
- VNIC name can be left empty.

Connect from the Mac. Keep the key outside the repo (`~/.ssh`).

```bash
mv ~/Downloads/ssh-key-*.key ~/.ssh/oracle-macfolio.key
chmod 600 ~/.ssh/oracle-macfolio.key
ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<public IP>
```

If the prompt is `ubuntu@…:~$`, you're on the server. All commands below run on the server.

**Connection alias (recommended)**: register the server in `~/.ssh/config` on your computer so you don't type the public IP each time. After that, `<server>` in this document can be `macfolio` (`ssh macfolio`, `scp file macfolio:~/deploy/`).

```bash
mkdir -p ~/.ssh && cat >> ~/.ssh/config <<'EOF'

Host macfolio
  HostName <public IP>
  User ubuntu
  IdentityFile ~/.ssh/oracle-macfolio.key
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

**Checking the public IP**: the public IP attached by default is an **ephemeral IP**, so it can change when you stop and start the server or move the boot volume to another VM ([If you lose the SSH key](#if-you-lose-the-ssh-key)). Check it in the console (Compute → Instances → server → Networking → **Public IPv4 address** of the primary VNIC) or Cloud Shell instead of relying on memory or notes.

```bash
# Cloud Shell (>_ at the top right of the console)
ID=$(oci search resource structured-search --query-text "query instance resources" --query 'data.items[0].identifier' --raw-output)
oci compute instance list-vnics --instance-id "$ID" --query 'data[].{public:"public-ip",private:"private-ip",nsg:"nsg-ids"}' --output table
```

To keep the IP from changing, switch it to a **Reserved public IP** in the VNIC's IP screen. One is free even on an Always Free account. If the IP changed, also update `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` in GitHub Secrets ([Setting up automatic deploys (once)](#setting-up-automatic-deploys-once) 3).

## 4. Prepare the server

### swap (E2.1.Micro)

With 1GB of RAM, Docker builds (pnpm install, tsc) die from running out of memory. GitHub Actions normally does the build, but set up swap so you can build on the server in a pinch.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # Swap: 4.0Gi
```

### Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # reconnect for the docker group to take effect
```

Reconnect and check with `docker run --rm hello-world`. The install method is described in the [Docker docs](https://docs.docker.com/engine/install/ubuntu/#install-using-the-convenience-script).

### Code

```bash
git clone https://github.com/hyeoniverse/MacFolio.git ~/macfolio
mkdir -p ~/deploy
```

The server ends up like this. Secrets live outside the repo (`~/deploy`), so they can never be committed, and they survive `git pull`.

```
/home/ubuntu/
├── macfolio/        code (git clone)
└── deploy/          deployment config
    ├── .env         DB_PASSWORD, TUNNEL_TOKEN
    ├── api.env      API environment variables
    └── compose.yml
```

## 5. Cloudflare Tunnel

The server opens an **outbound** connection to Cloudflare, and requests come in over that connection. So there's no need to open 80/443 in the Oracle firewall, and Cloudflare handles the https certificate ([Create a remotely-managed tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)).

Cloudflare Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared → name `macfolio-api`

1. Choose **Docker** as the operating system. Don't run the `docker run … --token eyJ…` command it shows; copy only the value after `--token`
2. Add a Public Hostname
   - Subdomain `macfolio-api`, Domain `hyeoniverse.com`
   - Service: `HTTP`, URL: `api:4000` (the service name inside compose)

If a `macfolio-api` DNS record already exists, delete it first or the hostname won't be added. The token is the tunnel's password. Keep it only in `.env`.

## 6. Configuration files

Create everything in `~/deploy`. **Don't paste YAML straight into the terminal**; wrap it in `cat > file <<'EOF' … EOF` and paste it in one go. Pasted as is, the shell runs each line as a command and you get a stream of `command not found`.

### `.env` (secrets read by compose)

```bash
cd ~/deploy
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 24)
TUNNEL_TOKEN=<token copied in step 5>
EOF
```

### `api.env` (API environment variables)

The API on the server reads only this file. `apps/api/.env` on my machine is for local development and has nothing to do with deployment. When I keep production values on my machine, they go in `apps/api/.env.production`, not `.env` (it isn't committed, and the local API doesn't read it). If you change `CORS_ORIGINS` in the local `.env` to the production value, the local site can't connect to the server.

To pull the server's values to my machine, run this on my machine (`>` creates an empty file first, so a failure leaves a 0-byte file).

```bash
scp -i ~/.ssh/oracle-macfolio.key ubuntu@<public IP>:deploy/api.env apps/api/.env.production
chmod 600 apps/api/.env.production
```

When making a local `.env` from this file, don't copy it as is; change only the keys that don't fit local: add `DATABASE_URL` (in production compose sets it, so it's not in `api.env`), set `CORS_ORIGINS` to `http://localhost:5173`, delete `API_URL`·`TRUST_PROXY`·`RESOURCE_MONITOR`, and replace `GITHUB_CLIENT_*` with the [development OAuth App](#2-github-oauth-app) values. If you leave the remaining keys as they are, real mail goes out and uploads land in the real R2 bucket even locally.

```bash
cat > api.env <<EOF
CORS_ORIGINS=https://macfolio.hyeoniverse.com,https://*-macfolio.hyeoniverse.workers.dev
API_URL=https://macfolio-api.hyeoniverse.com
GITHUB_CLIENT_ID=<production OAuth App Client ID>
GITHUB_CLIENT_SECRET=<production OAuth App Client secret>
IP_HASH_SECRET=$(openssl rand -hex 32)
TRUST_PROXY=1
EOF
chmod 600 .env api.env
```

| Variable                                              | Required | Description                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                        | ✓        | Set in compose.yml to the `db` service address                                                                                                                                                                                                                                                                                             |
| `CORS_ORIGINS`                                        | ✓        | Frontend origins allowed to make requests (comma-separated). Any difference, even one character (a trailing `/`, `www`), causes a CORS error. `*` matches a single dot-free label, so `https://*-macfolio.hyeoniverse.workers.dev` allows PR previews. Origins matched by `*` can only read; cookies (the admin session) are not exchanged |
| `API_URL`                                             | ✓        | This API's public URL. The OAuth callback URL is built from it                                                                                                                                                                                                                                                                             |
| `GITHUB_CLIENT_ID`                                    | Login    | If empty, only login returns 503; the rest of the API works                                                                                                                                                                                                                                                                                |
| `GITHUB_CLIENT_SECRET`                                | Login    |                                                                                                                                                                                                                                                                                                                                            |
| `IP_HASH_SECRET`                                      | ✓        | Key for HMAC-ing comment authors' IPs. In production the server won't start without it                                                                                                                                                                                                                                                     |
| `TRUST_PROXY`                                         |          | Number of proxies in front. `1` if only the Tunnel is in between. The real IP is read from `X-Forwarded-For` and used for rate limiting                                                                                                                                                                                                    |
| `FRONTEND_URL`                                        |          | Where to return after login (default: the first origin in `CORS_ORIGINS`)                                                                                                                                                                                                                                                                  |
| `ADMIN_GITHUB_ID`                                     |          | The admin's numeric GitHub ID (default 68999618)                                                                                                                                                                                                                                                                                           |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`               |          | Photo search in the editor. Without one, only that service is turned off                                                                                                                                                                                                                                                                   |
| `GITHUB_TOKEN`                                        |          | Token for fetching the profile and repositories for the GitHub app. Without it the limit is 60 requests per hour, so data is refetched every 30 minutes                                                                                                                                                                                    |
| `FISH_AUDIO_API_KEY`, `GOOGLE_TTS_API_KEY`            |          | Speech generation for the Safari HYEONIVERSE page (Fish → Google → Edge). Without a key, only that provider is skipped (Edge works without a key)                                                                                                                                                                                          |
| `SPEECH_PER_IP_PER_DAY`, `SPEECH_TOTAL_PER_DAY`       |          | Daily cap on speech generation. Defaults: 3 per IP, 50 site-wide (counted in server memory)                                                                                                                                                                                                                                                |
| `DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`           |          | Translation demo (DeepL → Google). Same keys as HYEONIVERSE. Without a key, only that provider is skipped                                                                                                                                                                                                                                  |
| `GROQ_API_KEY`                                        |          | Default provider for the AI summary demo (Groq, OpenAI-compatible API). If missing or failing, falls back to Gemini                                                                                                                                                                                                                        |
| `GROQ_MODEL`                                          |          | Groq model (default `openai/gpt-oss-120b`). Groq retires models often, so if summaries only come from Gemini, check whether it was retired                                                                                                                                                                                                 |
| `GEMINI_API_KEY`                                      |          | Second provider for the AI summary demo (when Groq fails). Without both, summaries return 502                                                                                                                                                                                                                                              |
| `GEMINI_MODEL`                                        |          | Summary model (default `gemini-flash-latest`, always the latest Flash). If the model was retired, it retries once with the model the response recommends                                                                                                                                                                                   |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`        |          | First provider for the AI cover demo (Cloudflare Workers AI FLUX, free daily allocation). Give the token Workers AI permission only                                                                                                                                                                                                        |
| `HUGGINGFACE_API_KEY`                                 |          | Second provider for the AI cover demo (Hugging Face FLUX). Without both, covers return 502                                                                                                                                                                                                                                                 |
| `TRANSLATE_PER_IP_PER_DAY`, `TRANSLATE_TOTAL_PER_DAY` |          | Daily cap on translation. Defaults: 3 per IP, 50 site-wide                                                                                                                                                                                                                                                                                 |
| `SUMMARY_PER_IP_PER_DAY`, `SUMMARY_TOTAL_PER_DAY`     |          | Daily cap on summaries. Defaults: 3 per IP, 50 site-wide                                                                                                                                                                                                                                                                                   |
| `COVER_PER_IP_PER_DAY`, `COVER_TOTAL_PER_DAY`         |          | Daily cap on covers. Defaults: 1 per IP, 5 site-wide (the free quota is small)                                                                                                                                                                                                                                                             |
| `RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`        | Mail     | Contact mail for the Mail (메일) app ([#25](https://github.com/hyeoniverse/MacFolio/issues/25)). The server sends only when all three are set. Otherwise the site opens the visitor's mail app. Setup: [Contact mail](#contact-mail-resend-turnstile)                                                                                      |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`          |          | Human verification for mail, comments and messages (Cloudflare Turnstile). If empty, no verification. Where it applies is toggled in System Settings (시스템 설정) → Privacy & Security (개인정보 보호 및 보안)                                                                                                                            |
| `CONTACT_PER_IP_PER_DAY`, `CONTACT_TOTAL_PER_DAY`     |          | Daily cap on contact mail. Defaults: 5 per IP, 50 site-wide                                                                                                                                                                                                                                                                                |

Demo caps are counted separately per demo, in server memory (they reset on restart). If every provider fails, the used count is refunded. Covers are cut off at 45 seconds per provider so that trying both in a row still finishes within Cloudflare Tunnel's 100 seconds.

`NODE_ENV=production` is set in the Dockerfile. That's why cookies get `Secure` and login doesn't work over http. The full list is in `apps/api/.env.example`.

### `compose.yml`

`'EOF'` must be quoted so `${DB_PASSWORD}` goes in literally instead of being substituted now. Compose fills it from `.env` at run time.

```bash
cat > compose.yml <<'EOF'
name: macfolio

# Keep logs from filling the disk: at most three 10MB files per container
x-logging: &logging
  driver: json-file
  options:
    max-size: 10m
    max-file: '3'

services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    logging: *logging
    environment:
      POSTGRES_USER: macfolio
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: macfolio
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U macfolio']
      interval: 5s
      retries: 20

  api:
    # Image built by GitHub Actions (not built on the server). The tag is API_TAG in .env, changed by ops/deploy.sh
    image: ghcr.io/hyeoniverse/macfolio-api:${API_TAG:?API_TAG가 없다. ~/macfolio/ops/deploy.sh <태그>로 배포한다}
    restart: unless-stopped
    logging: *logging
    env_file: api.env
    environment:
      DATABASE_URL: postgresql://macfolio:${DB_PASSWORD}@db:5432/macfolio
    depends_on:
      db:
        condition: service_healthy

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    logging: *logging
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on: [api]

volumes:
  db-data:
EOF
docker compose config --quiet && echo OK
```

(The `API_TAG` error message reads "API_TAG is missing. Deploy with ~/macfolio/ops/deploy.sh <tag>".)

There are no `ports` at all. Outside requests reach api only through the tunnel, and the DB never leaves the compose network.

## 7. Run and verify

GitHub Actions builds the API image and pushes it to [GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry) (`ghcr.io/hyeoniverse/macfolio-api`). The server only pulls. The tag is `sha-` + the 7-character commit (e.g. `sha-a38ac7e`); see recent tags under **Packages → macfolio-api** on the right of the GitHub repository. `sha-a38ac7e` in the commands below is an example, so replace it with that tag (if you paste a placeholder like `<…>` as is, bash reads `<`·`>` as operators and does nothing).

```bash
cd ~/deploy
~/macfolio/ops/deploy.sh sha-a38ac7e        # writes API_TAG to .env, starts api(+db) and waits until healthy
docker compose up -d                        # including tunnel
docker compose logs -f api                  # after migrations finish: "Nest application successfully started"
```

`prisma migrate deploy` runs first on startup. When the status turns **HEALTHY** on the Cloudflare Tunnels screen, it's connected.

1. `https://macfolio-api.hyeoniverse.com/health` responds
2. Swagger appears at `https://macfolio-api.hyeoniverse.com/docs`
3. `https://macfolio-api.hyeoniverse.com/auth/github` redirects to GitHub login (503 means the OAuth values are missing)
4. On the site, Apple menu → Admin login (관리자 로그인) → you return with `?admin=signed-in`, and System Settings (시스템 설정) → Account (계정) shows "GitHub로 로그인됨" (Signed in with GitHub)

## Operations

### Updates (automatic deploys)

GitHub Actions handles it on its own when a commit that lands on main differs in `apps/api` (or its dependencies, or `ops/deploy.sh`) from the **API running on the server** (the version from `/health`) ([#100](https://github.com/hyeoniverse/MacFolio/issues/100), [#104](https://github.com/hyeoniverse/MacFolio/pull/104), [#118](https://github.com/hyeoniverse/MacFolio/pull/118)). Because it compares against the server rather than the previous push, if CI fails on a merge that changed the API and the deploy is skipped, it gets deployed together with the next merge. If the server can't be reached, it's treated as different and deployed.

```
check (tests) ─▶ api-image: build image (amd64) → GHCR (sha-<commit>, main)
               └▶ api-deploy: over SSH, the server's ops/deploy.sh sha-<commit>
                    backup right before deploy (server only) → pull image → swap → check healthy and /health version
                    if that fails, roll back to the previous tag and fail
               └▶ is the version at the public https://macfolio-api.hyeoniverse.com/health this commit?
          └▶ deploy (frontend): after the API deploy finishes. Skipped if the API deploy fails
```

- Frontend changes that use the API can be merged in the same PR. The API goes up first
- Migrations are applied when the container starts. Rollback only rolls back **the image**, so migrations are written to run alongside the previous version's code ('Migrations' in CONTRIBUTING)
- Deploy log on the server: `~/deploy/deploy.log`. Pre-deploy backups: `~/backups`

**Rollback drill:** the procedure for deliberately deploying a version that fails the health check to confirm the rollback is in [rollback-drill.md](rollback-drill.md).

**Manual deploy/rollback:** GitHub → Actions → **API 배포** (API deploy) → Run workflow → tag (`sha-…`). Entering an older tag is a rollback. To do it directly on the server: `~/macfolio/ops/deploy.sh sha-…`.

**Building on the server in an emergency:** only when GitHub Actions is unavailable. With 1GB of memory it takes over 10 minutes and needs swap.

```bash
cd ~/macfolio && git pull
tag=sha-$(git rev-parse --short=7 HEAD)
docker build -f apps/api/Dockerfile --build-arg APP_VERSION=$tag -t ghcr.io/hyeoniverse/macfolio-api:$tag .
~/macfolio/ops/deploy.sh $tag   # If the server already has the image for that tag, it uses it as is without pulling
```

**Environment variables don't change automatically.** Automatic deploys only change the image (the code). Secrets live only on the server (so they aren't kept in two places, GitHub and the server, and so the deploy-only key doesn't get file-write permission).

| What                                                             | Where                           | When changed                                            |
| ---------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| API environment variables (OAuth, `CORS_ORIGINS`, AI keys, etc.) | Server `~/deploy/api.env`       | Apply manually with the commands below                  |
| DB password, tunnel token                                        | Server `~/deploy/.env`          | Apply manually. `API_TAG` is changed by `ops/deploy.sh` |
| Backup settings                                                  | Server `~/deploy/backup.env`    | From the next backup                                    |
| Frontend `VITE_API_URL`                                          | Repo `.github/workflows/ci.yml` | On merge (baked in at build time)                       |
| `apps/api/.env`                                                  | My computer                     | For local development. Never goes to the server         |

```bash
cd ~/deploy
nano api.env                 # Edit values
docker compose up -d api     # Sees the changed config and recreates only the container (image unchanged)
docker compose ps api        # Is it healthy?
```

If you edit it without restarting, it gets applied with the next automatic deploy. Since there's no telling when that will be, restart right away.

### Setting up automatic deploys (once)

For each command, check **where** to type it first. If the start of the line is `ubuntu@macfolio-vnic`, it's the server; if it's `…@…MacBook…`, it's my computer. Everything in this setup except steps 3 and 4 (GitHub screens) is done on **the server**.

#### 1. Image and first deploy

When an API change is merged into main, `api-image` pushes the image to GHCR. Packages linked to a public repository like this one are public from the start, so the server pulls them without logging in. Check that it can be pulled without logging in like this (200 means public).

```bash
tok=$(curl -s "https://ghcr.io/token?scope=repository:hyeoniverse/macfolio-api:pull" | sed -E 's/.*"token":"([^"]+)".*/\1/')
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $tok" \
  -H "Accept: application/vnd.oci.image.index.v1+json" https://ghcr.io/v2/hyeoniverse/macfolio-api/manifests/sha-a38ac7e
```

If it's 401 or 403: GitHub profile → **Packages → macfolio-api → Package settings → Change visibility → Public**.

Then switch api in the server's `compose.yml` to `image:` and do the first deploy by hand once (steps 6 and 7). From then on `.env` has an `API_TAG`.

#### 2. Deploy-only key (all at once on the server)

Create a key for GitHub Actions to get into the server, but bind it so that key can run **only the deploy script**. The key is created on the server, put into GitHub, and deleted from the server (nothing has to move between my computer and the server).

Paste the whole thing below on the server. Nothing needs editing. It's safe to run repeatedly: it always deletes the old deploy key and makes a new one.

```bash
sed -i '/github-actions-deploy/d' ~/.ssh/authorized_keys
rm -f ~/macfolio-deploy ~/macfolio-deploy.pub
ssh-keygen -q -t ed25519 -N "" -C github-actions-deploy -f ~/macfolio-deploy
echo "restrict,command=\"/home/ubuntu/macfolio/ops/deploy.sh\" $(cat ~/macfolio-deploy.pub)" >> ~/.ssh/authorized_keys
echo "등록된 배포 열쇠 수: $(grep -c github-actions-deploy ~/.ssh/authorized_keys)"
echo "===== DEPLOY_HOST ====="; curl -s ifconfig.me; echo
echo "===== DEPLOY_KNOWN_HOSTS ====="; ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/$(curl -s ifconfig.me)/"
echo "===== DEPLOY_SSH_KEY ====="; cat ~/macfolio-deploy
```

- The first line deletes only the deploy key line (ending in `github-actions-deploy`). The key you normally log in with is on a different line, so it stays
- `restrict`: blocks port forwarding, terminals (pty), and so on ([sshd: AUTHORIZED_KEYS FILE FORMAT](https://man.openbsd.org/sshd#AUTHORIZED_KEYS_FILE_FORMAT))
- `command=`: when connecting with this key, only `ops/deploy.sh` runs no matter what is sent. The text sent is passed as `SSH_ORIGINAL_COMMAND`, and the script only accepts the shape `sha-[0-9a-f]{7,40}`
- `DEPLOY_KNOWN_HOSTS`: reads the server's own host key on the server and attaches the public IP. It's the value that pins the server so Actions doesn't connect to an impostor

It should print `등록된 배포 열쇠 수: 1` (number of registered deploy keys: 1).

#### 3. GitHub Secrets

Repository → Settings → Secrets and variables → Actions → New repository secret (if it already exists, pencil → Update)

| Name                 | Value                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------- |
| `DEPLOY_HOST`        | The IP under `DEPLOY_HOST` from step 2                                                  |
| `DEPLOY_KNOWN_HOSTS` | The single line under `DEPLOY_KNOWN_HOSTS` from step 2                                  |
| `DEPLOY_SSH_KEY`     | Everything under `DEPLOY_SSH_KEY` from step 2 (from `-----BEGIN` to `-----END … -----`) |
| `DEPLOY_USER`        | (optional) defaults to `ubuntu`                                                         |

Once they're in, delete the key files on the server: `rm ~/macfolio-deploy ~/macfolio-deploy.pub`. If you made a new key, **`DEPLOY_SSH_KEY` must also be updated to the new value** (otherwise `Permission denied (publickey)`).

Without `DEPLOY_HOST`, `api-deploy` is skipped (the image is still built). If port 22 is open only to my IP in the Oracle security list, Actions can't get in. Since only key authentication is used, port 22 is left open to everywhere (close it later when moving to Cloudflare Tunnel SSH, [#100](https://github.com/hyeoniverse/MacFolio/issues/100)).

#### 4. Verify

[Actions → API 배포 (API deploy)](https://github.com/hyeoniverse/MacFolio/actions/workflows/deploy-api.yml) → **Run workflow** at the top right → the current tag in tag (e.g. `sha-a38ac7e`) → Run. The Actions landing page (All workflows) doesn't have this button. It only shows up after clicking **API 배포** in the list on the left.

If the log shows this, the connection is done.

```text
서버에서 배포:      배포 시작: sha-a38ac7e → sha-a38ac7e
                    이미 이 버전이 떠 있다: sha-a38ac7e
바깥에서 버전 확인: 확인: {"status":"ok","database":"up","version":"sha-a38ac7e"}
```

(Deploy on the server: "deploy started", "this version is already running"; version check from outside: "verified".)

Since the key exists only in GitHub (Secrets) and on the server, the connection is verified through Actions. That the key runs only the one deploy command (other commands like `ls` get "태그 모양이 아니다", "not a tag shape") is enforced by the script accepting only tag shapes (tested locally).

#### API changes merged before the Secrets were added

API changes merged while there were no Secrets only build the image and skip the server deploy (Actions shows "DEPLOY_HOST가 없어 API 배포를 건너뜁니다", "no DEPLOY_HOST, skipping API deploy"). The server stays on the old version. Run workflow once with that commit's tag. The tag is `sha-` + the first 7 characters of the merge commit; the latest commit on main is `git log --oneline -1 origin/main`, and pushed tags are under **Packages → macfolio-api** on the right side of the repository.

### Logs and status

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 tunnel
```

#### Log rotation

By default Docker never deletes container logs, so left long enough they fill the disk. The `x-logging` in the `compose.yml` above keeps at most three 10MB files (30MB) per container ([json-file logging driver](https://docs.docker.com/engine/logging/drivers/json-file/)). On a server that didn't have this setting, add the `x-logging` block under `name: macfolio` in `compose.yml`, add `logging: *logging` under `restart:` in each of the three services (db, api, tunnel), and recreate.

```bash
cd ~/deploy
docker compose config --quiet && echo OK     # Check indentation
docker compose up -d                         # Recreates containers whose config changed (a few seconds of downtime; DB data stays in the volume)
docker inspect --format '{{.Name}} {{.HostConfig.LogConfig.Config}}' $(docker compose ps -q)   # All three max-size:10m
```

#### Uptime monitoring

The GitHub Actions `uptime` workflow (`.github/workflows/uptime.yml`) calls `https://macfolio-api.hyeoniverse.com/health` (server and DB) and the site from outside every 10 minutes. To avoid alerting on a brief outage during a deploy, it retries three more times 30 seconds apart; if it still fails, the run fails and GitHub sends an email.

- Notifications go to whoever last changed the scheduled run's cron (currently the repository owner). Check that failure notifications are enabled in GitHub **Settings → Notifications → Actions**
- The history is under the repository's **Actions → uptime**. You can also run it immediately with **Run workflow**
- Scheduled runs can run a few minutes late depending on GitHub. It's a public repository, so the run time is free
- If the repository has no activity for 60 days, GitHub disables the scheduled runs. Re-enable it in Actions then ([GitHub docs](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow))

### Server hardening check

The only thing the server exposes to the outside is SSH (22). The API comes in only through Cloudflare Tunnel (`compose.yml` has no `ports`), and the DB is visible only inside the compose network. So there are four things to keep: **SSH by key only**, **only port 22 open**, **containers as non-root users**, **security updates automatic**. `ops/audit.sh` only reads these four and prints `OK`/`확인` (check) for each item ([#183](https://github.com/hyeoniverse/MacFolio/pull/183)). It changes nothing.

```bash
~/macfolio/ops/audit.sh      # Exits with 1 if there are items to check
```

| Item       | Expected state                                                                                                                                       | If it deviates                                                                                                                                                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSH        | `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password`, 0 accounts with a password                      | Write the three lines in `/etc/ssh/sshd_config.d/99-macfolio.conf` and `sudo systemctl reload ssh`. The Oracle Ubuntu image comes this way from the start                                                                                                                                                                                 |
| Ports      | Only 22 listening externally. No containers publishing host ports. An iptables rule allowing 22 (Oracle default)                                     | Don't put `ports:` in `compose.yml`. 111 (rpcbind) is something the Oracle image turns on for NFS; turn it off with `sudo systemctl disable --now rpcbind.socket rpcbind.service`. In the cloud-side **Security List** (VCN → Subnet → Security List), keep only `22/tcp` in Ingress too (80 and 443 aren't needed because of the tunnel) |
| Containers | `api → node` (`USER node` in the Dockerfile), `tunnel → nonroot` (cloudflared image default), `db → postgres`. No privileged, no `docker.sock` mount | If you touched the image or compose, revert it. `db` showing as `root` counts as OK, because the postgres image is root only at startup and then drops to postgres                                                                                                                                                                        |
| Updates    | `unattended-upgrades` enabled, no pending reboot                                                                                                     | `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`. If `/var/run/reboot-required` exists, `sudo reboot` at a quiet time ([Ubuntu automatic updates](https://ubuntu.com/server/docs/how-to/software/automatic-updates/))                                                                            |

- The deploy SSH key (`macfolio-deploy`) can only run `ops/deploy.sh`, via `restrict,command=` in `authorized_keys` ([Setting up automatic deploys](#setting-up-automatic-deploys-once)). `audit.sh` doesn't look at this key
- The `ubuntu` account is in the `docker` group, so getting in as that account is equivalent to host root. That makes managing the SSH key the same as managing the key to the whole server. Keep the private key (`~/.ssh/oracle-macfolio.key`) and its passphrase outside the computer too, e.g. in a password manager. Before resetting the computer, back up `~/.ssh` first. If it's lost, see [If you lose the SSH key](#if-you-lose-the-ssh-key)
- Run the check once a quarter, and after touching the server configuration

#### The first time (after adding the script)

1. Pull the code on the server and run it: `cd ~/macfolio && git pull && ops/audit.sh`. If `확인` (check) appears, fix things according to the table above and run it again until you see `모두 OK` (all OK)
2. Check the cloud-side firewall, which the script can't see, in the console: Oracle Cloud → Networking → Virtual cloud networks → VCN → Subnets → public subnet → **Security Lists** → Default Security List → **Ingress Rules**. It's fine if the only TCP port open from `0.0.0.0/0` is **22** (leave the two ICMP rules alone; they're Oracle defaults). If 80 or 443 are there, delete them (not needed because of the tunnel)
3. Don't post the results anywhere. The output includes account names and listening addresses

### If you lose the SSH key

The private key can't be downloaded again (Oracle doesn't have a copy either). Recovery means creating a new key and putting it into the server's `authorized_keys`. **The serial console (Console connection) doesn't work**: the login screen asks for an OS password, and this server has no accounts with a password (the hardening table above). The procedure in the Oracle docs for swapping keys via maintenance mode applies only to Oracle Linux images. Oracle's official answer is "delete the instance and create a new one with a new key"; to avoid rebuilding the server, do the following instead. The deploy key (`DEPLOY_SSH_KEY`) can't stand in either, since it only runs `deploy.sh`. Attach the boot volume to another VM and fix it there. The API is down in the meantime (the sequence I actually followed on 2026-10-20, [dev log](https://macfolio.hyeoniverse.com/memo/oracle-ssh-key-recovery)).

1. **New key** (my computer): `ssh-keygen -t ed25519 -f ~/.ssh/oracle-macfolio.key -C macfolio-admin`. If you set a passphrase, store that too
2. **Temporary VM**: create one in the same availability domain as the original server, Ubuntu, `VM.Standard.E2.1.Micro` (one of the two free ones). For SSH keys, put the contents of `~/.ssh/oracle-macfolio.key.pub` into **Paste public keys**. Creating it and confirming you can connect before stopping the original server reduces downtime
3. **Stop the original server and detach the boot volume**: in the console, original server → Stop → Boot volume → Detach. Making a Boot volume backup before detaching lets you roll back
4. **Attach to the temporary VM**: if the Attach block volume button on the temporary VM's page is disabled, attach it with the CLI from the **Cloud Shell/Code Editor icon** on the right of the top bar of the console → **Cloud Shell** (a terminal opens at the bottom of the screen; before opening it, check that the region in the top bar is the server's region) (the first time it opens, a guided tour appears and blocks other commands with `Invalid command`; exit it with Ctrl+C)

   ```bash
   AD=$(oci iam availability-domain list --query 'data[0].name' --raw-output)
   oci compute instance list -c $OCI_TENANCY --query 'data[].{name:"display-name",state:"lifecycle-state",id:id}' --output table
   RESCUE=ocid1.instance…        # Temporary VM (without the < > brackets)
   ORIG=ocid1.instance…          # Original server
   RESCUEVOL=$(oci compute boot-volume-attachment list -c $OCI_TENANCY --availability-domain "$AD" --instance-id "$RESCUE" --query 'data[0]."boot-volume-id"' --raw-output)
   OLDVOL=$(oci bv boot-volume list -c $OCI_TENANCY --availability-domain "$AD" --query "data[?id!='$RESCUEVOL'].id | [0]" --raw-output)
   echo "[$RESCUE] [$OLDVOL]"    # Make sure neither is empty
   oci compute volume-attachment attach --type paravirtualized --instance-id "$RESCUE" --volume-id "$OLDVOL"
   ```

   - After attaching, don't reboot the temporary VM (you'd end up in the `/dev/sdb1` case of step 5)
   - `AVAILABLE` in the boot volume list means "healthy", not "not attached". Check whether it's attached with `boot-volume-attachment list --boot-volume-id "$OLDVOL"`
   - `Conflict … currently attached` means it's already attached: `oci compute volume-attachment list -c $OCI_TENANCY --instance-id "$RESCUE"`

5. **Add the key** (inside the temporary VM): first check **which disk is currently root** with `findmnt -n -o SOURCE /`
   - If it's `/dev/sda1`, all is normal. Find the original server's disk with `lsblk` (usually `sdb1`), mount it, and append the key

     ```bash
     sudo mkdir -p /mnt/old && sudo mount /dev/sdb1 /mnt/old
     echo '<new public key, one line>' | sudo tee -a /mnt/old/home/ubuntu/.ssh/authorized_keys
     sudo ls -ln /mnt/old/home/ubuntu/.ssh/authorized_keys   # 1000 1000, -rw-------
     sudo umount /mnt/old
     ```

   - If it's `/dev/sdb1`, the temporary VM **booted from the original server's disk**. Both disks come from the same image and share the same root label (`cloudimg-rootfs`), so rebooting with it attached ends up like this. In that case cloud-init treated it as the new VM's first boot, **already added the public key given to the temporary VM to `authorized_keys`, and regenerated the host keys**. The DB, API and tunnel are also running on this VM. There's no need to add the key separately (check with `grep macfolio-admin ~/.ssh/authorized_keys`)
   - Either way, don't reboot the temporary VM while the original server's disk is attached

6. **Put it back** (Cloud Shell): shut down the temporary VM gracefully (`SOFTSTOP`. `STOP` cuts power immediately; `SOFTSTOP` also waits only up to 15 minutes for the OS to shut down), detach the volume, attach it to the original server, and start it

   ```bash
   oci compute instance action --instance-id "$RESCUE" --action SOFTSTOP
   oci compute instance get --instance-id "$RESCUE" --query 'data."lifecycle-state"' --raw-output   # Until STOPPED
   ATT=$(oci compute volume-attachment list -c $OCI_TENANCY --instance-id "$RESCUE" --query "data[?\"lifecycle-state\"=='ATTACHED'].id | [0]" --raw-output)
   oci compute volume-attachment detach --volume-attachment-id "$ATT" --force
   oci compute volume-attachment get --volume-attachment-id "$ATT" --query 'data."lifecycle-state"' --raw-output   # Until DETACHED
   oci compute boot-volume-attachment attach --instance-id "$ORIG" --boot-volume-id "$OLDVOL"
   oci compute instance action --instance-id "$ORIG" --action START
   ```

   `/health` goes 530 (tunnel down) → 502 (API starting) → back to 200. On 2026-10-20 it took about 2 minutes after starting

7. **Cleanup**
   - If the host keys changed (`REMOTE HOST IDENTIFICATION HAS CHANGED` on my computer), update **`DEPLOY_KNOWN_HOSTS` to the new value**. Otherwise the next API deploy fails with `Host key verification failed`. Even after going back to the original server, cloud-init has already processed the original instance-id, so it won't change them again

     ```bash
     gh secret set DEPLOY_KNOWN_HOSTS --body "$(ssh-keyscan -t ed25519 <public IP> 2>/dev/null | grep -v '^#')"
     ```

   - Delete the lost old key's line (on the server). Keep the deploy key (`restrict,command=…`) and the new key. After deleting, before closing the window, check in a new tab that you can still get in

     ```bash
     cut -c1-60 ~/.ssh/authorized_keys                 # Look at which line it is first
     cp ~/.ssh/authorized_keys ~/.ssh/authorized_keys.bak
     sed -i '1{/^ssh-rsa /d}' ~/.ssh/authorized_keys   # When the old key is the ssh-rsa on line 1
     ```

   - Terminate the temporary VM with "Permanently delete the attached boot volume" checked (it's the temporary VM's own disk)

<details>
<summary>Reference docs (Oracle, cloud-init)</summary>

- [Connecting to a Linux Instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/connect-to-linux-instance.htm): the official guidance that if the key is lost, terminate the instance and create a new one with a new key
- [Instance Console Connections](https://docs.oracle.com/en-us/iaas/Content/Compute/References/serialconsole.htm): console login requires an account with a password. Swapping keys via maintenance mode is Oracle Linux only
- [Attaching a Boot Volume](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/attachingabootvolume.htm): a detached boot volume can be attached to another instance as a data volume (2–4, 6)
- [Attaching a Block Volume to an Instance](https://docs.oracle.com/en-us/iaas/Content/Block/Tasks/attach-compute-volume-attachment.htm): paravirtualized volumes are visible as soon as they're Attached; iSCSI needs additional connect commands inside the instance (4)
- [First boot determination](https://docs.cloud-init.io/en/latest/explanation/first_boot.html), [Module reference: SSH](https://docs.cloud-init.io/en/latest/reference/modules.html): when the instance ID changes it's treated as a first boot, and the SSH module regenerates host keys (`ssh_deletekeys`) and adds the public keys from the metadata (`allow_public_ssh_keys`). Both default to `true` (5, 7)

</details>

### Backups

Blog posts, drafts, version history and uploaded images live **only in the DB**. `ops/backup.sh` runs daily via cron and keeps copies on the server and off the server (Cloudflare R2) ([#94](https://github.com/hyeoniverse/MacFolio/pull/94), [#98](https://github.com/hyeoniverse/MacFolio/pull/98)).

![cron and ops/deploy.sh run backup.sh, which keeps 7 days on the server in ~/backups and 30 days in R2, with healthchecks.io emailing on failure](../images/deployment-backup.svg)

- Server: 7 days in `~/backups` (`KEEP_LOCAL_DAYS`)
- Also once right before each automatic deploy (`ops/deploy.sh` calls it with `BACKUP_LOCAL_ONLY=1`. It's kept only on the server and sends no notification. The daily cron uploads off the server)
- Off the server: 30 days in an R2 bucket (`KEEP_REMOTE_DAYS`)
- Off-server storage cap: 8GB (`MAX_REMOTE_GB`). If adding today's backup would exceed it, it doesn't upload and reports a failure (the copy stays on the server). R2 is free up to 10GB a month, and there's no setting that stops before you get billed, so the script stops first. When the alert arrives, reduce `KEEP_REMOTE_DAYS` or raise the cap ($0.015 per GB per month over the limit)
- A backup is kept only after checking that the compression is intact and the dump was written to the end. On failure it exits with 1 and notifies the alert URL (`BACKUP_PING_URL`)

Setup only needs to be done once. Secrets like keys go only in the server's `~/deploy/backup.env` (never in the repository or chat). Dashboard menu names may change, so look for something similar.

#### 1. R2 bucket (Cloudflare dashboard)

1. Go to **R2 Object Storage**. If it's your first time, sign up for the free plan (it may ask you to register a payment method; you won't be billed within the limits)
2. **Create bucket**
   - Name: `macfolio-backups`
   - Location: Automatic
   - Storage class: **Standard** (Infrequent Access has no free tier)
3. In the bucket's Settings, check that **Public access is off** (Disallowed, the default). Keeping it private means others can't read files and drive up the operation count

#### 2. R2 API token

1. **Manage R2 API Tokens → Create API token** on the R2 landing page
   - Name: `macfolio-backup`
   - Permissions: **Object Read & Write**
   - Buckets: **Apply to specific buckets only** → `macfolio-backups` (if the key leaks, only this bucket is exposed)
   - TTL: Forever
2. Note down the three values shown once it's created. **The secret key is only shown on this screen**
   - Access Key ID
   - Secret Access Key
   - S3 endpoint: `https://<account ID>.r2.cloudflarestorage.com`
   - The Token value shown alongside is not used

#### 3. Alert URL (optional, recommended)

cron says nothing when it fails. With an alert URL, you get an email when a backup fails, hits the cap, or doesn't run at all.

1. Sign up at [healthchecks.io](https://healthchecks.io/docs/) and **Add Check**
   - Name: `macfolio-backup`
   - Schedule: Period **1 day**, Grace **1 hour**
2. Note down the **Ping URL** (`https://hc-ping.com/<uuid>`). Alerts go to the email you signed up with

#### 4. Server: code and rclone

```bash
cd ~/macfolio && git pull           # ops/backup.sh, ops/restore.sh
ls -l ops/backup.sh                 # Does it have execute permission (x)?

# R2 (provider=Cloudflare) works from rclone 1.59. The apt rclone on Ubuntu 22.04 is 1.53, so install it with the official script
curl -fsSL https://rclone.org/install.sh | sudo bash
rclone version                      # v1.59 or later?
```

#### 5. Server: config file

```bash
cd ~/deploy
ls                                  # Is compose.yml there? (if missing or named differently, add COMPOSE_FILE=<path> below)
cat > backup.env <<'EOF'
BACKUP_REMOTE=r2:macfolio-backups
RCLONE_CONFIG_R2_TYPE=s3
RCLONE_CONFIG_R2_PROVIDER=Cloudflare
RCLONE_CONFIG_R2_ACCESS_KEY_ID=<Access Key ID>
RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=<Secret Access Key>
RCLONE_CONFIG_R2_ENDPOINT=https://<account ID>.r2.cloudflarestorage.com
RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
# The alert URL created in step 3
BACKUP_PING_URL=https://hc-ping.com/<uuid>
# Optional: off-server storage cap (default 8), days to keep (default 7 on the server, 30 on R2)
# MAX_REMOTE_GB=8
# KEEP_LOCAL_DAYS=7
# KEEP_REMOTE_DAYS=30
EOF
chmod 600 backup.env
```

Replace the `<…>` placeholders with the values noted in steps 2 and 3 (`nano backup.env`). The rclone config is supplied via the `RCLONE_CONFIG_R2_*` environment variables, so there's no separate `rclone config` file ([rclone: Cloudflare R2](https://rclone.org/s3/#cloudflare-r2)). `backup.env` is read by `ops/backup.sh`.

#### 6. Verify the R2 connection

```bash
set -a; source ~/deploy/backup.env; set +a
rclone size r2:macfolio-backups     # Total objects: 0 at first
# Check writes work too: upload a test file, see that it shows up, delete it
echo test | rclone rcat r2:macfolio-backups/connection-test.txt
rclone ls r2:macfolio-backups       # connection-test.txt
rclone deletefile r2:macfolio-backups/connection-test.txt
```

- Don't use `rclone lsd r2:` (bucket listing). The token only has permission on one bucket, so listing the account's buckets is always `403 AccessDenied` (which means the narrowly scoped key is working as intended)
- The `Config file … not found` notice appears because the config is supplied via environment variables, so it doesn't matter
- `AccessDenied` when looking at the bucket: check the token's permissions (Object Read & Write) and bucket scope
- `no such host`: check the endpoint URL

#### 7. Run it once

```bash
~/macfolio/ops/backup.sh
# … 백업 완료: /home/ubuntu/backups/macfolio-…sql.gz (…)
# … 올림: r2:macfolio-backups/macfolio-…sql.gz (저장소 …MB / 상한 8GB)
```

(The output reads "backup complete" and "uploaded … (storage …MB / cap 8GB)".)

- `ls -lh ~/backups`: is file size × 30 comfortably below the cap (8GB)?
- Did a file appear in the bucket in the R2 dashboard?
- Is the Check on healthchecks.io up (green)?

#### 8. Run it daily (cron)

```bash
date                                # Server time zone (usually UTC)
crontab -e                          # The one line below (03:30 UTC = 12:30 KST)
30 3 * * * /home/ubuntu/macfolio/ops/backup.sh >> /home/ubuntu/deploy/backup.log 2>&1
crontab -l                          # Did it go in?
```

Check the result the next day with `tail ~/deploy/backup.log`.

#### 9. Restore test

```bash
cd ~/deploy
# The most recent backup (don't type the file name by hand; if you paste <…> literally, bash reads it as symbols and does nothing)
latest=$(ls -t ~/backups/macfolio-*.sql.gz | head -1); echo "$latest"
# Restore into a different DB without touching the real one
DB_NAME=restoretest ~/macfolio/ops/restore.sh "$latest"
# Is the post count the same as the real DB?
docker compose exec -T db psql -U macfolio -d restoretest -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d macfolio -c 'select count(*) from "Post"'
docker compose exec -T db psql -U macfolio -d postgres -c 'drop database restoretest'
```

About once a month, restore like this and compare post counts. A backup you've never restored isn't a backup.

#### 10. Usage alerts (optional)

R2 has no setting that stops before billing (the script's `MAX_REMOTE_GB` stops instead). Setting up a usage-based billing alert (Usage Based Billing) in the Cloudflare dashboard under **Notifications → Add** adds one more safeguard.

#### Restoring (when actually needed)

```bash
# Replace the real DB with the backup contents (asks for confirmation, and stops api in the meantime, then starts it again)
~/macfolio/ops/restore.sh ~/backups/macfolio-2026-10-05T033000Z.sql.gz
# Backups on R2 work too (downloads, then restores)
~/macfolio/ops/restore.sh r2:macfolio-backups/macfolio-2026-10-05T033000Z.sql.gz
```

### Contact mail (Resend, Turnstile)

The server sends the mail a visitor writes in the Mail (메일) app ([#25](https://github.com/hyeoniverse/MacFolio/issues/25), [#125](https://github.com/hyeoniverse/MacFolio/pull/125)). The recipient is always the site owner, and the sender's address goes into Reply-To so I can reply straight from the received mail. Without this configuration the site opens the visitor's mail app as before, so it's fine to deploy before doing the steps below.

**1. Resend (sending)** — free plan: 3,000 emails/month, 100/day

1. Sign up at [resend.com](https://resend.com) and add `hyeoniverse.com` under **Domains → Add Domain** ([Resend: Domains](https://resend.com/docs/dashboard/domains/introduction))
2. Add the DNS records shown on screen (MX, TXT) as-is to the `hyeoniverse.com` DNS in Cloudflare. Turn the proxy off (DNS only, grey cloud)
3. Click **Verify** in Resend; once it's Verified, create a key under **API Keys → Create API Key** (Sending access, domain `hyeoniverse.com`)

**2. Turnstile (human check, optional)** — free

1. Cloudflare dashboard → **Turnstile → Add widget** ([Turnstile get started](https://developers.cloudflare.com/turnstile/get-started/))
2. Put `macfolio.hyeoniverse.com` in Hostnames. To use it in PR previews too, also add `hyeoniverse.workers.dev`; to use it locally, also add `localhost`
3. Widget mode is **Managed**. Creating it gives you a site key and a secret key

**3. Put them in `~/deploy/api.env` on the server and restart**

```bash
nano ~/deploy/api.env
```

```
RESEND_API_KEY=<key starting with re_>
CONTACT_TO=<recipient address>
CONTACT_FROM=MacFolio <contact@hyeoniverse.com>
TURNSTILE_SITE_KEY=<site key>
TURNSTILE_SECRET_KEY=<secret key>
```

```bash
cd ~/deploy && docker compose up -d api
curl -s https://macfolio-api.hyeoniverse.com/contact; echo   # {"enabled":true,"turnstileSiteKey":"…"}
```

Send a message from the site's Mail app, and check that it arrives at `CONTACT_TO` and that replying goes to the sender's address.

**4. Where to require the human check (comments and messages too)**

Once the keys are in, only **mail** is checked at first. To require it for comments and messages as well, log in as admin and turn it on in the site's **System Settings (시스템 설정) → Privacy & Security (개인정보 보호 및 보안)**. It's stored on the server (`SecuritySetting` in the DB) and applies to every visitor immediately, with no redeploy needed. Posts written by the admin are not checked.

```bash
curl -s https://macfolio-api.hyeoniverse.com/security; echo   # {"contact":true,"comment":false,"message":false,"available":true,…}
```

If `available` is `false`, the server doesn't have both keys (site and secret). In that case nothing is checked even if the toggles are on.

### Search terms (Google Search Console)

The **Search terms (검색어)** tab in Activity Monitor (활동 상태 보기) (admin only) pulls Google search queries from Search Console. Google doesn't pass search queries to the site, so this is the only way ([#327](https://github.com/hyeoniverse/MacFolio/pull/327)). The server fetches them with a service account every 6 hours; without configuration, the tab shows how to set it up. So it's fine to deploy before doing the steps below. It costs nothing.

**1. Check that the site is in Search Console**

Check your site property at [search.google.com/search-console](https://search.google.com/search-console). If there isn't one, **Add property**:

| Property                     | Input                               | Verification                                                                            | Scope                                        | `GSC_SITE_URL`                                                   |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| Domain                       | `hyeoniverse.com`                   | TXT record in Cloudflare DNS                                                            | All subdomains (`www`, `blog`, `macfolio` …) | `sc-domain:hyeoniverse.com`                                      |
| **URL prefix (recommended)** | `https://macfolio.hyeoniverse.com/` | HTML tag, file, etc. Automatic if the same account already verified the domain property | Only under this address                      | `https://macfolio.hyeoniverse.com/` (including the trailing `/`) |

- **Connect the URL-prefix property** to the Search terms tab. The server fetches queries for the whole property and doesn't filter by page address, so with a domain property, queries for other subdomains like `www` and `blog` show up too
- Domain property TXT record: Cloudflare dashboard → domain → **DNS → Records → Add record**, Type `TXT`, Name `@`, Content the `google-site-verification=…` value from the screen, then **Verify** in Search Console (usually minutes, up to an hour)
- Once verified, submit `https://macfolio.hyeoniverse.com/sitemap.xml` under **Sitemaps** on the left. The Worker builds it from repository posts, server posts and project addresses (it's also in `robots.txt`)
- To have a page crawled sooner, enter its address in **URL inspection** at the top and click **Request indexing** (there's a daily limit). The number of indexed addresses is in the **Pages** report

A newly added property starts collecting data from that day (it shows up 2–3 days late).

**2. Service account and key** — [console.cloud.google.com](https://console.cloud.google.com)

1. Pick a project. An existing one is fine (a project holds APIs and service accounts, and the Search Console API is free, so costs don't mix). When creating one, **the project ID can't be changed later**: globally unique, 6–30 characters, lowercase letters, digits and hyphens, starting with a letter. Set it with **Edit** next to the ID under the name field (e.g. `hyeoniverse-macfolio`). The ID only appears in the service account email
2. Find **Google Search Console API** under **APIs & Services → Library** and **Enable** it ([Search Console API](https://developers.google.com/webmaster-tools))
3. **IAM & Admin → Service Accounts → Create service account**. Even in an existing project, create an account just for MacFolio (rotating or revoking its key won't affect other services)

   | Field                | Example                                                 | Note                                                                                                   |
   | -------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
   | Service account name | `MacFolio Search Console`                               | Can be changed later                                                                                   |
   | Service account ID   | `macfolio-search-console`                               | **Can't be changed**. The email becomes `macfolio-search-console@<project ID>.iam.gserviceaccount.com` |
   | Description          | `MacFolio API reads Search Console queries (read-only)` |                                                                                                        |

   Leave **project access (roles)** and **user access** on the next screens empty and click **Done**. Search Console permission isn't a Google Cloud role; it's granted in step 3

4. The new account → **Keys → Add key → Create new key → JSON**. The downloaded file can't be downloaded again

**3. Add the service account to Search Console**

In [Search Console](https://search.google.com/search-console), pick the property you'll use as `GSC_SITE_URL` at the top left → **Settings** at the bottom left → **Users and permissions** → **Add user** at the top right: enter the service account's email (`…@….iam.gserviceaccount.com`, copy it from the Service Accounts list in Google Cloud) with **Restricted** permission. It only reads.

- A service account has no inbox, so it's added immediately without accepting an invitation
- If **Add user** isn't shown, you're not signed in as an owner of that property
- If you add it to a different property, fetching fails with `403 PERMISSION_DENIED`

**4. Put it on the server**

To keep the key out of shell history and the repo, move it as a file and extract only the two values needed. On the Mac:

```bash
scp ~/Downloads/<downloaded-key>.json <server>:~/deploy/gsc.json   # <server> is macfolio if you set up the alias
rm ~/Downloads/<downloaded-key>.json
```

Replace each `<…>` including the brackets (file name: `ls ~/Downloads/*.json`). If `scp` says `Operation timed out`, see the SSH timeout row in [Troubleshooting](#troubleshooting).

On the server:

```bash
cd ~/deploy
# Append client_email and private_key (one line, newlines replaced with \n) to api.env
python3 -c 'import json; k = json.load(open("gsc.json")); print("GSC_CLIENT_EMAIL=" + k["client_email"]); print("GSC_PRIVATE_KEY=\"" + k["private_key"].replace("\n", "\\n") + "\"")' >> api.env
rm gsc.json
echo 'GSC_SITE_URL=sc-domain:hyeoniverse.com' >> api.env   # the property chosen in step 1
chmod 600 api.env
docker compose up -d api
```

**5. Verify**

Log in to the site as admin → **Activity Monitor → Search terms** tab and press **Fetch now (지금 가져오기)**. The first fetch pulls 16 months of data (the server also fetches on its own a minute after it starts). Once you see "data through <date>" ("N월 N일까지의 자료"), you're done.

**6. When it doesn't work** (the reason Google returned is shown verbatim under the tab's status line)

| Message                                             | Cause and fix                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `403` `PERMISSION_DENIED` … `sufficient permission` | Step 3 wasn't done, or `GSC_SITE_URL` doesn't match the property (`sc-domain:` for a domain property, trailing `/` included for a URL-prefix property) |
| `403` … `has not been used` / `SERVICE_DISABLED`    | The API from step 2-2 isn't enabled. Enable it and wait a few minutes                                                                                  |
| `400` `invalid_grant`                               | The key is wrong (another account's key, broken newlines) or the server clock is off (check with `date -u`)                                            |

### Rotating secrets

If a secret has been exposed in a chat, screenshot, or log, issue a new one.

- **GitHub Client secret**: OAuth App → Generate a new client secret → delete the old secret → edit `api.env`
- **Tunnel token**: Tunnels → `macfolio-api` → rotate the token → edit `.env`
- Apply: `docker compose up -d` (only the changed containers restart)

If you change `IP_HASH_SECRET`, author hashes of old and new comments no longer line up. Unless it was exposed, it's better to leave it.

### Idle reclamation

Oracle may reclaim an Always Free instance whose CPU, network, and memory utilization have all been low for 7 days ([Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)). **Upgrading the account to Pay As You Go** takes it out of reclamation, and it stays $0 as long as you stay within the Always Free limits. If you upgrade, set a Budget alert (e.g. $1/month). Keep this document and off-server backups so the server can be rebuilt if it does get reclaimed.

Use **server resource monitoring** to see the risk ahead of time ([#151](https://github.com/hyeoniverse/MacFolio/pull/151)). Put the following in `~/deploy/api.env` **on the production server** and run `docker compose up -d api` from that folder (the local Mac doesn't have this `compose.yml`, so you'd get `no configuration file provided`. The local `apps/api/.env` is for development and doesn't apply to production):

```bash
RESOURCE_MONITOR=free          # off (default) / free (Always Free) / payg (pay as you go)
OCI_SHAPE=VM.Standard.E2.1.Micro
RESOURCE_NETWORK_MBPS=50       # baseline for network utilization (the shape's bandwidth)
# RESOURCE_ALERT_TO=           # address for alerts (defaults to CONTACT_TO). Sending needs RESEND_API_KEY and CONTACT_FROM
```

- Every minute it records CPU and memory (whole VM, read via `/proc` inside the container) and network (traffic sent and received by the API container) in the DB, and deletes them after 14 days. No compose changes needed
- `free`: if the 7-day CPU 95th percentile and network average (plus memory average on A1) are all under 20%, it's a 'reclamation risk'. It checks every hour and emails an alert when at risk (at most once every 3 days)
- `payg`: not subject to reclamation, so it records and shows utilization. With an OCI API key it also shows **this month's cost and the budget limit**, and emails when spending passes 80% and 100% of the budget (once each per month). Create the budget in the Console → Billing & Cost Management → Budgets
- View it in the site's **Activity Monitor (활동 상태 보기) → Server (서버)** tab (admin only). Values appear 1–2 minutes after turning it on
- Alert emails reuse the contact mail settings (`RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`). Check that all three are set via `"enabled":true` from `curl https://macfolio-api.hyeoniverse.com/contact` (secret values aren't shown). To use a separate recipient, set `RESOURCE_ALERT_TO`
- It doesn't work locally (macOS), because utilization is read from Linux's `/proc`

Steps:

```bash
ssh <server>
cd ~/deploy
echo 'RESOURCE_MONITOR=free' >> api.env
docker compose up -d api
```

- Network is not the whole-VM figure Oracle measures but the traffic sent and received by the API container (traffic between the tunnel and Cloudflare, image pulls, etc. aren't counted). All visitor traffic goes through the tunnel to the API, so the trend is similar

#### Viewing pay-as-you-go cost and budget (OCI API key)

With `RESOURCE_MONITOR=payg`, the Server tab shows **this month's cost and the budget limit**, and emails when spending passes 80% and 100% of the budget (once each per month). Calling Oracle's cost and budget APIs requires an [OCI API signing key](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm) ([#153](https://github.com/hyeoniverse/MacFolio/pull/153)). Without a key, only utilization is shown, and the Server tab's cost section explains how to add one.

**0. Create a budget** (the basis for the limit and alerts)

1. Top-left menu in the Console → **Billing & Cost Management → Budgets → Create Budget**
2. Name (e.g. `월 1달러`, "$1 a month"), target the **root compartment** (tenancy), amount `1` (USD), period **Monthly**
3. You can leave Alert Rule empty. This server sends the email at 80% and 100%. If you also want Oracle's own emails, add them here

Budgets are always created in the root compartment. Without a budget, this month's cost still shows, but there's no limit bar or alert email.

**1. Decide which user the API key belongs to**

- **Simple:** create the key on the admin account you're using now. No extra permissions needed. But the key has all of the account's permissions
- **Recommended:** create a separate read-only user
  1. **Identity & Security → Domains → (Default domain) → Users → Create user** (e.g. `macfolio-billing`; it can be created without an email)
  2. **Groups → Create group** (e.g. `macfolio-billing`) and add that user
  3. **Identity & Security → Policies →** in the root compartment, **Create Policy** with two lines:

     ```
     Allow group macfolio-billing to read usage-budgets in tenancy
     Allow group macfolio-billing to read usage-report in tenancy
     ```

     (`usage-report` is singular.) For a group in a different domain, use `group <domain>/macfolio-billing`

**2. Create the API key**

1. (Admin account) top-right profile → **My profile**; (separate user) that user's page
2. **Resources → API keys → Add API key → Generate API key pair**
3. **Download private key** (`.pem`). This file can't be downloaded again. You don't need the public key
4. Clicking **Add** shows a **Configuration file preview**. Copy these values:

   ```
   user=ocid1.user.oc1..aaaa...       → OCI_USER_OCID
   fingerprint=12:34:...:ef           → OCI_FINGERPRINT
   tenancy=ocid1.tenancy.oc1..aaaa... → OCI_TENANCY_OCID
   region=ap-chuncheon-1              → OCI_REGION
   ```

   `region` must be the **home region** (the cost and budget APIs exist only there). It's the one marked "Home region" in the region menu at the top of the Console

**3. Put it on the server**

To keep the private key out of shell history and the repo, move it as a file and convert it to a single line. On the Mac:

```bash
scp ~/Downloads/<downloaded-key>.pem <server>:~/deploy/oci.pem
```

On the server:

```bash
cd ~/deploy
# Append the private key to api.env as one line, with newlines replaced by \n
printf 'OCI_PRIVATE_KEY="%s"\n' "$(awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' oci.pem)" >> api.env
rm oci.pem
# The remaining values (copied in step 2)
cat >> api.env <<'ENV'
RESOURCE_MONITOR=payg
OCI_TENANCY_OCID=ocid1.tenancy.oc1..
OCI_USER_OCID=ocid1.user.oc1..
OCI_FINGERPRINT=12:34:...:ef
OCI_REGION=ap-chuncheon-1
ENV
chmod 600 api.env
docker compose up -d api
```

If `RESOURCE_MONITOR=free` is already there, change that line to `payg` (if the same key appears twice, the later one wins).

**4. Verify**

- Log in to the site as admin → if the **Cost (요금)** section of the **Activity Monitor → Server** tab shows this month's cost and the budget bar, you're done
- Cost is re-read every hour. Oracle's cost data is reflected a few hours late
- If you stay within the Always Free limits, a cost of `US$0.00` is normal

**5. When it doesn't work** (the reason Oracle returned is shown verbatim in the cost section)

| Message in the cost section                                                         | Cause and fix                                                                                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `401 NotAuthenticated`                                                              | The private key, fingerprint, and user OCID don't match each other (e.g. a fingerprint from a different key). Or the server clock is off by more than 5 minutes (check with `date -u`) |
| `404 NotAuthorizedOrNotFound`                                                       | Missing permissions (the policy from step 1). Or `OCI_REGION` isn't the home region                                                                                                    |
| `Oracle Cloud API에 연결할 수 없습니다.` ("Can't connect to the Oracle Cloud API.") | A typo in the region name (should look like `ap-chuncheon-1`), or outbound HTTPS from the server is blocked                                                                            |
| "OCI API 키를 넣습니다" ("Add an OCI API key") in the cost section                  | One of the five values is empty. Check that `docker compose exec api printenv` lists five names starting with `OCI_` (don't let others see the values)                                 |
| No budget bar                                                                       | There's no budget (0)                                                                                                                                                                  |

**Key management**

- Keep the key only in `~/deploy/api.env` on the server. Don't paste it into the repo, the local `apps/api/.env`, or a chat
- To rotate: add a new key in the Console → change the four values (key, fingerprint) in `api.env` and run `docker compose up -d api` → after verifying, delete the old key
- If the key leaks, delete it immediately under API keys in the Console (it stops working at that moment)

## Troubleshooting

| Symptom                                                                                                  | Cause and fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "관리자 서버가 아직 연결되지 않았습니다" ("The admin server isn't connected yet"), login button disabled | The frontend build has no `VITE_API_URL`. Check the value in the `env` at the top of `ci.yml` and merge to main to rebuild ([Setting the API URL](#setting-the-api-url))                                                                                                                                                                                                                                                                                                                |
| Opening Messages shows "메시지를 열 수 없습니다" ("Can't open messages")                                 | The Messages API couldn't be reached. Check `docker compose ps` and `logs api`. To just view the UI without a server, use `VITE_MESSAGES_STORE=local`                                                                                                                                                                                                                                                                                                                                   |
| "관리자 서버에 연결할 수 없습니다" ("Can't connect to the admin server")                                 | The API is down or CORS is blocking it. Check `docker compose ps`, `logs api`, and `CORS_ORIGINS`                                                                                                                                                                                                                                                                                                                                                                                       |
| Server status says "이 주소에서는 쓸 수 없음" ("Not available at this address")                          | The server is up, but the current site address isn't in `CORS_ORIGINS`. For PR previews, add `https://*-macfolio.hyeoniverse.workers.dev` and run `docker compose up -d api`                                                                                                                                                                                                                                                                                                            |
| `/auth/github` returns 503                                                                               | `GITHUB_CLIENT_ID`/`SECRET` is empty                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `redirect_uri` error on GitHub                                                                           | The OAuth App callback URL differs from `API_URL` + `/auth/github/callback`                                                                                                                                                                                                                                                                                                                                                                                                             |
| Back on the site but "로그인할 수 없음" ("Can't log in")                                                 | You logged in with a GitHub account other than the admin account (ID 68999618)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Back on the site but not logged in                                                                       | The cookie wasn't saved. Check that it's https and that the API is a subdomain of `hyeoniverse.com`                                                                                                                                                                                                                                                                                                                                                                                     |
| api shuts down right after starting                                                                      | Missing `IP_HASH_SECRET`, DB connection failure, etc. Look at the first error in `docker compose logs api`                                                                                                                                                                                                                                                                                                                                                                              |
| Build hangs or `Killed`                                                                                  | Out of memory. Check that swap is set up with `free -h`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Actions '서버에서 배포' ("Deploy on server") fails with `Permission denied (publickey)` (exit 255)       | `DEPLOY_SSH_KEY` doesn't pair with the deploy key registered on the server. Often the key was generated twice, so GitHub and the server got different keys. Redo step 2 of 'Setting up automatic deploys (once)' and replace `DEPLOY_SSH_KEY` with the new value                                                                                                                                                                                                                        |
| Merged an API change but the version in `/health` is unchanged                                           | It was merged before the Secrets were added, or the deploy failed. It'll be deployed with the next merge after comparing against the server. To ship it now, use Run workflow with a commit tag that has an image (end of 'Setting up automatic deploys (once)')                                                                                                                                                                                                                        |
| Commands fail with `No such file` or `Could not resolve hostname :`                                      | You typed a server command on your own computer. Check that the prompt starts with `ubuntu@…`                                                                                                                                                                                                                                                                                                                                                                                           |
| Actions fails with `Host key verification failed`                                                        | `DEPLOY_KNOWN_HOSTS` doesn't match the server's host key. If you recreated the server or booted the boot volume on another VM (cloud-init generates new host keys), run `ssh-keyscan` again ([If you lose the SSH key](#if-you-lose-the-ssh-key) step 7)                                                                                                                                                                                                                                |
| `ssh`/`scp` from your computer says `Operation timed out` but Actions deploys succeed                    | You're connecting to an IP that isn't the server's current public IP. Either the ephemeral IP changed, or you remember another VM's address (e.g. the temporary VM from key recovery). `~/.ssh/known_hosts` lists addresses you've connected to, in order. Check the current IP in the console or Cloud Shell (Checking the public IP in [3. Create the Oracle VM](#3-create-the-oracle-vm)). Tell a network problem apart with `nc -zv -w 5 github.com 22` (port 22 of another server) |
| Actions fails with `Connection timed out`                                                                | Port 22 is open only to specific IPs in the Oracle security list                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `deploy.sh` gets `denied`/`unauthorized` during `pull`                                                   | The GHCR package is private. Set it to Public in Package settings                                                                                                                                                                                                                                                                                                                                                                                                                       |
| "배포 실패, 되돌림" ("Deploy failed, rolled back")                                                       | The new image didn't become healthy within 120 seconds. Check the end of the api log in the Actions log or `~/deploy/deploy.log`. The server is back on the previous version                                                                                                                                                                                                                                                                                                            |
| `API_TAG가 없다` ("API_TAG is missing")                                                                  | You switched `compose.yml` to the image but haven't deployed yet. Run `~/macfolio/ops/deploy.sh sha-a38ac7e` (tag from Packages)                                                                                                                                                                                                                                                                                                                                                        |
| A stream of `name:: command not found` and the like                                                      | You pasted YAML into the terminal instead of a file. Wrap it in `cat > compose.yml <<'EOF'`                                                                                                                                                                                                                                                                                                                                                                                             |
| `--env-file: no such file or directory`                                                                  | The file isn't at that path. Check that you ran it from `~/deploy` on the server                                                                                                                                                                                                                                                                                                                                                                                                        |
| Tunnel doesn't become HEALTHY                                                                            | `TUNNEL_TOKEN` is wrong or the tunnel container didn't start. `docker compose logs tunnel`                                                                                                                                                                                                                                                                                                                                                                                              |
| Login message says `x86_64` but you meant to create A1                                                   | It was created with an AMD shape. If it's E2.1.Micro it's free, so keep it; any other shape is billed, so delete it and recreate                                                                                                                                                                                                                                                                                                                                                        |

## Remaining work

Continued in [#10](https://github.com/hyeoniverse/MacFolio/issues/10).

- Upgrade the account to Pay As You Go to exclude it from idle reclamation, and set a Budget alert ([Idle reclamation](#idle-reclamation))
- Observe actual utilization for 1–2 weeks
- fail2ban or changing the SSH port: with key-only login, brute-force attempts only leave failure logs, so it isn't applied for now. It will be if log volume becomes a problem

## Related posts (Korean)

- [API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel](https://macfolio.hyeoniverse.com/memo/deploy-api-oracle-tunnel)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](https://macfolio.hyeoniverse.com/memo/deploy-github-actions)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](https://macfolio.hyeoniverse.com/memo/api-auto-deploy)
- [자동 배포를 실제 서버에 걸기 - 막힌 곳 다섯](https://macfolio.hyeoniverse.com/memo/api-auto-deploy-setup)
- [글이 DB에만 있게 되어서 백업을 붙였다](https://macfolio.hyeoniverse.com/memo/db-backup)
- [R2에 DB 백업 걸기 - 대시보드부터 cron까지](https://macfolio.hyeoniverse.com/memo/r2-backup-setup)
- [서버가 죽으면 알려 주기, 로그가 디스크를 채우지 않게](https://macfolio.hyeoniverse.com/memo/server-uptime-and-logs)
- [서버 하드닝은 문서가 아니라 스크립트로 남긴다](https://macfolio.hyeoniverse.com/memo/server-hardening-audit)
- [SSH 키를 잃어버린 Oracle 서버 되살리기 — 임시 VM이 원래 서버 디스크로 부팅됐다](https://macfolio.hyeoniverse.com/memo/oracle-ssh-key-recovery)
- [무료 서버가 회수되기 전에 - 사용률을 재고 위험하면 메일로](https://macfolio.hyeoniverse.com/memo/resource-monitor)
- [종량제 요금과 예산 한도 - Oracle API 요청 서명을 SDK 없이](https://macfolio.hyeoniverse.com/memo/oci-billing)
- [메일 앱에서 진짜로 메일 보내기 - Resend와 Turnstile](https://macfolio.hyeoniverse.com/memo/contact-mail)
- [PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](https://macfolio.hyeoniverse.com/memo/preview-cors-read-only)
- [없는 코드 파일에 index.html을 주던 문제](https://macfolio.hyeoniverse.com/memo/asset-404)
