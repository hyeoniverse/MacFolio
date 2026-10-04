# 배포

프론트엔드는 Cloudflare Workers에, API는 Oracle Cloud Always Free VM에 올린다. 서버는 포트를 열지 않고 Cloudflare Tunnel로만 바깥과 연결한다.

![배포 구성](../apps/react/src/apps/memo/content/images/deploy-architecture.svg)

| 무엇       | 주소                                        | 어디에                       | 배포                             |
| ---------- | ------------------------------------------- | ---------------------------- | -------------------------------- |
| 프론트엔드 | `https://macfolio.hyeoniverse.com`          | Cloudflare Workers 정적 자산 | main에 머지하면 GitHub Actions가 |
| API        | `https://macfolio-api.hyeoniverse.com`      | Oracle VM, docker compose    | 서버에서 `git pull` 후 다시 빌드 |
| API 문서   | `https://macfolio-api.hyeoniverse.com/docs` | Swagger                      |                                  |

프론트엔드와 API는 주소가 다르지만 같은 사이트(`hyeoniverse.com`)다. 그래서 `SameSite=Lax` 세션 쿠키가 함께 간다. **API는 반드시 `hyeoniverse.com`의 하위 도메인에 https로 둔다.** `*.workers.dev`나 IP 주소로 두면 로그인이 되지 않는다.

- [1. 프론트엔드 (Cloudflare Workers)](#1-프론트엔드-cloudflare-workers)
- [2. GitHub OAuth App](#2-github-oauth-app)
- [3. Oracle VM 만들기](#3-oracle-vm-만들기)
- [4. 서버 준비](#4-서버-준비)
- [5. Cloudflare Tunnel](#5-cloudflare-tunnel)
- [6. 설정 파일](#6-설정-파일)
- [7. 실행과 확인](#7-실행과-확인)
- [운영](#운영)
- [문제 해결](#문제-해결)

## 1. 프론트엔드 (Cloudflare Workers)

설정은 루트의 `wrangler.jsonc`에 있다. Worker 스크립트 없이 `apps/react/dist`를 정적 파일로 서빙하고, 없는 경로는 `index.html`로 보낸다(SPA).

빌드와 배포는 GitHub Actions(`.github/workflows/ci.yml`)가 한다. Cloudflare의 빌드 서버(Workers Builds)는 쓰지 않는다.

- **main**: 시험(`check`)이 통과하면 `deploy` 작업이 `wrangler deploy`로 실제 사이트에 올린다. 시험이 실패한 커밋은 배포되지 않는다.
- **PR**: `preview` 작업이 `wrangler versions upload --preview-alias <브랜치>`로 미리보기 버전을 올리고, 주소를 PR 댓글 하나에 적는다(새 커밋을 올리면 같은 댓글을 고친다). 실제 사이트는 바뀌지 않는다.

### 처음 한 번: 토큰과 Git 연결

1. Cloudflare 대시보드 → 오른쪽 위 프로필 → **My Profile → API Tokens → Create Token**
   - **Edit Cloudflare Workers** 템플릿을 고른다
   - Account Resources: 내 계정, Zone Resources: All zones from an account (또는 hyeoniverse.com)
   - 만든 토큰은 한 번만 보이니 바로 복사한다
2. 계정 ID: Workers & Pages 화면 오른쪽의 **Account ID**를 복사한다
3. GitHub 저장소 → Settings → Secrets and variables → **Actions → New repository secret**
   - `CLOUDFLARE_API_TOKEN` = 1의 토큰
   - `CLOUDFLARE_ACCOUNT_ID` = 2의 계정 ID
4. GitHub Actions 배포가 한 번 성공한 것을 확인한 뒤, Cloudflare의 Git 연결을 끊는다. 두 곳에서 같이 배포하지 않게 하기 위해서다.
   - Workers & Pages → `macfolio` → Settings → **Build** → Git repository → **Disconnect**

### API 주소 넣기

`VITE_API_URL`은 **빌드할 때** 코드에 들어간다. 런타임 변수가 아니다. 값은 `ci.yml` 맨 위의 `env`에 있다(`https://macfolio-api.hyeoniverse.com`, 끝에 `/` 없이). 바꾸려면 그 줄을 고쳐 main에 머지한다.

Cloudflare 대시보드의 Variables and Secrets는 Worker가 **실행될 때** 읽는 값이라, 여기에 넣어도 빌드에 들어가지 않는다. 값이 비어 있으면 로그인 버튼이 꺼지고 "관리자 서버가 아직 연결되지 않았습니다"가 뜬다.

`VITE_MESSAGES_STORE`는 배포에 넣지 않는다(비워 둔다). 비어 있으면 메시지 앱이 서버에 저장하고, 서버에 닿지 못하면 "메시지를 열 수 없습니다" 경고창을 띄운 뒤 앱을 끈다. `local`은 서버 없이 화면을 확인하는 개발용 값이라, 배포에 넣으면 방문자마다 자기 브라우저에만 글이 남는다.

반영됐는지는 배포된 JS에서 주소를 찾아 보면 알 수 있다.

```bash
for f in $(curl -s https://macfolio.hyeoniverse.com/ | grep -o '/assets/[^"]*\.js'); do
  curl -s "https://macfolio.hyeoniverse.com$f" | grep -o 'https://macfolio-api.hyeoniverse.com' | head -1
done
```

## 2. GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App

| 항목                       | 배포용                                                      | 개발용                                       |
| -------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| Homepage URL               | `https://macfolio.hyeoniverse.com`                          | `http://localhost:5173`                      |
| Authorization callback URL | `https://macfolio-api.hyeoniverse.com/auth/github/callback` | `http://localhost:4000/auth/github/callback` |

OAuth App 하나에는 콜백 주소를 하나만 넣을 수 있어서, 배포용과 개발용을 따로 만든다. 만든 뒤 Client ID와 Client secret을 받아 둔다. secret은 만들 때 한 번만 보인다.

관리자는 계정 이름이 아니라 숫자 ID로 가린다(`ADMIN_GITHUB_ID`, 기본 `68999618` = hyeoniverse). 이름은 바꿀 수 있고, 바꾸면 옛 이름을 다른 사람이 가져갈 수 있기 때문이다.

## 3. Oracle VM 만들기

[Always Free](https://www.oracle.com/cloud/free/) 한도 안에서는 기간 제한 없이 무료다. 가입할 때 카드 등록이 필요하지만 Free Tier 계정에는 청구되지 않는다. 홈 리전은 가입한 뒤에 바꿀 수 없다.

Compute → Instances → Create instance

| 항목       | 고를 것                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Image      | Canonical Ubuntu 24.04                                                                                      |
| Shape      | `VM.Standard.A1.Flex`(ARM, 합계 4 OCPU·24GB까지 무료) 또는 `VM.Standard.E2.1.Micro`(AMD, 1GB, 2대까지 무료) |
| Security   | 기본값 그대로. Shielded instance, Confidential computing은 켜지 않는다                                      |
| Networking | public subnet + **Automatically assign public IPv4 address**                                                |
| SSH keys   | Generate a key pair → **Download private key** (다시 받을 수 없다)                                          |

- **"Always Free Eligible"** 표시가 있는 shape인지 확인한다. `E4/E5.Flex` 같은 다른 AMD shape는 유료다.
- A1은 인기 리전에서 `Out of host capacity`가 자주 난다. 지금 서버는 A1 자리가 없어서 **E2.1.Micro**(x86_64, 1GB)로 만들었다. `apps/api/Dockerfile`은 amd64와 arm64 모두 빌드된다.
- 공인 IP 체크박스가 "You must select a public subnet"으로 막히면, VCN을 먼저 만든다: Networking → Virtual cloud networks → **Start VCN Wizard** → Create VCN with Internet Connectivity. 그 뒤 인스턴스 화면에서 Select existing → `public subnet-…`을 고른다.
- VNIC name은 비워 둬도 된다.

접속은 Mac에서 한다. 키는 레포 밖(`~/.ssh`)에 둔다.

```bash
mv ~/Downloads/ssh-key-*.key ~/.ssh/oracle-macfolio.key
chmod 600 ~/.ssh/oracle-macfolio.key
ssh -i ~/.ssh/oracle-macfolio.key ubuntu@<공인 IP>
```

프롬프트가 `ubuntu@…:~$`면 서버 안이다. 아래 명령은 모두 서버에서 실행한다.

## 4. 서버 준비

### swap (E2.1.Micro)

RAM이 1GB라 Docker 빌드(pnpm install, tsc)가 메모리 부족으로 죽는다. 먼저 swap을 잡는다.

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
exit   # 다시 접속해야 docker 그룹이 적용된다
```

다시 접속해서 `docker run --rm hello-world`로 확인한다.

### 코드

```bash
git clone https://github.com/hyeoniverse/MacFolio.git ~/macfolio
mkdir -p ~/deploy
```

서버 안은 이렇게 된다. 비밀 값은 레포 밖(`~/deploy`)에 둬서 커밋될 일이 없고, `git pull`해도 남는다.

```
/home/ubuntu/
├── macfolio/        코드 (git clone)
└── deploy/          배포 설정
    ├── .env         DB_PASSWORD, TUNNEL_TOKEN
    ├── api.env      API 환경 변수
    └── compose.yml
```

## 5. Cloudflare Tunnel

서버가 Cloudflare로 **나가는** 연결을 만들고, 요청은 그 연결로 들어온다. 그래서 Oracle 방화벽에 80/443을 열 필요가 없고, https 인증서도 Cloudflare가 맡는다.

Cloudflare Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared → 이름 `macfolio-api`

1. 운영체제는 **Docker**를 고른다. 나오는 `docker run … --token eyJ…` 명령은 실행하지 않고, `--token` 뒤의 값만 복사한다
2. Public Hostname 추가
   - Subdomain `macfolio-api`, Domain `hyeoniverse.com`
   - Service: `HTTP`, URL: `api:4000` (compose 안의 서비스 이름)

DNS에 `macfolio-api` 레코드가 이미 있으면 먼저 지워야 추가된다. 토큰은 터널 비밀번호다. `.env`에만 둔다.

## 6. 설정 파일

모두 `~/deploy`에서 만든다. **YAML을 터미널에 그대로 붙여 넣지 말고** `cat > 파일 <<'EOF' … EOF`로 감싸서 한 번에 붙여 넣는다. 그대로 붙이면 셸이 한 줄씩 명령으로 실행해 `command not found`가 줄줄이 나온다.

### `.env` (compose가 읽는 비밀 값)

```bash
cd ~/deploy
cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 24)
TUNNEL_TOKEN=<5단계에서 복사한 토큰>
EOF
```

### `api.env` (API 환경 변수)

```bash
cat > api.env <<EOF
CORS_ORIGINS=https://macfolio.hyeoniverse.com
API_URL=https://macfolio-api.hyeoniverse.com
GITHUB_CLIENT_ID=<배포용 OAuth App Client ID>
GITHUB_CLIENT_SECRET=<배포용 OAuth App Client secret>
IP_HASH_SECRET=$(openssl rand -hex 32)
TRUST_PROXY=1
EOF
chmod 600 .env api.env
```

| 변수                                                  | 필수   | 설명                                                                                                              |
| ----------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                        | ✓      | compose.yml에서 `db` 서비스 주소로 넣는다                                                                         |
| `CORS_ORIGINS`                                        | ✓      | 요청을 받을 프론트엔드 주소. 한 글자라도 다르면(끝의 `/`, `www`) CORS 에러                                        |
| `API_URL`                                             | ✓      | 이 API의 바깥 주소. OAuth 콜백 주소를 여기서 만든다                                                               |
| `GITHUB_CLIENT_ID`                                    | 로그인 | 비우면 로그인만 503, 나머지 API는 동작한다                                                                        |
| `GITHUB_CLIENT_SECRET`                                | 로그인 |                                                                                                                   |
| `IP_HASH_SECRET`                                      | ✓      | 댓글 작성자 IP를 HMAC하는 키. production에서 없으면 서버가 뜨지 않는다                                            |
| `TRUST_PROXY`                                         |        | 앞에 둔 프록시 수. Tunnel만 거치면 `1`. `X-Forwarded-For`에서 실제 IP를 읽어 요청 제한에 쓴다                     |
| `FRONTEND_URL`                                        |        | 로그인 후 돌아갈 주소 (기본: `CORS_ORIGINS`의 첫 주소)                                                            |
| `ADMIN_GITHUB_ID`                                     |        | 관리자 GitHub 숫자 ID (기본 68999618)                                                                             |
| `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`               |        | 편집기의 사진 찾기. 없으면 그 서비스만 꺼진다                                                                     |
| `GITHUB_TOKEN`                                        |        | GitHub 앱의 프로필·저장소를 받을 토큰. 없으면 시간당 60번 제한이라 30분마다 새로 받는다                           |
| `FISH_AUDIO_API_KEY`, `GOOGLE_TTS_API_KEY`            |        | Safari HYEONIVERSE 페이지의 음성 만들기 (Fish → Google → Edge). 없으면 그 공급자만 건너뛴다 (Edge는 키 없이 된다) |
| `SPEECH_PER_IP_PER_DAY`, `SPEECH_TOTAL_PER_DAY`       |        | 음성 만들기 하루 상한. 기본 IP마다 3번, 사이트 전체 50번 (서버 메모리로 센다)                                     |
| `DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`           |        | 번역 데모 (DeepL → Google). HYEONIVERSE와 같은 키. 없으면 그 공급자만 건너뛴다                                    |
| `GEMINI_API_KEY`                                      |        | AI 요약 데모 (Gemini가 한국어·영어 요약). 없으면 요약이 502                                                       |
| `GEMINI_MODEL`                                        |        | 요약 모델 (기본 `gemini-2.0-flash`, HYEONIVERSE와 같다). 모델이 내려가면 바꾼다                                   |
| `NANOBANANA_API_KEY`, `HUGGINGFACE_API_KEY`           |        | AI 커버 데모 (NanoBanana → Hugging Face FLUX). 없으면 그 공급자만 건너뛴다                                        |
| `TRANSLATE_PER_IP_PER_DAY`, `TRANSLATE_TOTAL_PER_DAY` |        | 번역 하루 상한. 기본 IP마다 3번, 사이트 전체 50번                                                                 |
| `SUMMARY_PER_IP_PER_DAY`, `SUMMARY_TOTAL_PER_DAY`     |        | 요약 하루 상한. 기본 IP마다 3번, 사이트 전체 50번                                                                 |
| `COVER_PER_IP_PER_DAY`, `COVER_TOTAL_PER_DAY`         |        | 커버 하루 상한. 기본 IP마다 3번, 사이트 전체 10번 (그림은 비싸다)                                                 |

데모 상한은 데모마다 따로, 서버 메모리로 센다 (다시 띄우면 처음부터). 공급자가 모두 실패하면 쓴 횟수를 돌려준다. 커버는 두 공급자를 이어 시도해도 Cloudflare Tunnel의 100초 안에 끝나게 NanoBanana는 50초, Hugging Face는 40초에서 끊는다.

`NODE_ENV=production`은 Dockerfile에 들어 있다. 그래서 쿠키에 `Secure`가 붙고, http로는 로그인이 되지 않는다. 전체 목록은 `apps/api/.env.example`에 있다.

### `compose.yml`

`'EOF'`에 따옴표를 붙여야 `${DB_PASSWORD}`가 지금 치환되지 않고 글자 그대로 들어간다. 실행할 때 compose가 `.env`에서 채운다.

```bash
cat > compose.yml <<'EOF'
name: macfolio
services:
  db:
    image: postgres:17-alpine
    restart: unless-stopped
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
    build:
      context: ../macfolio
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    env_file: api.env
    environment:
      DATABASE_URL: postgresql://macfolio:${DB_PASSWORD}@db:5432/macfolio
    depends_on:
      db:
        condition: service_healthy

  tunnel:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on: [api]

volumes:
  db-data:
EOF
docker compose config --quiet && echo OK
```

`ports`가 하나도 없다. 바깥 요청은 터널로만 api에 닿고, DB는 compose 네트워크 밖으로 나가지 않는다.

## 7. 실행과 확인

```bash
tmux new -s deploy              # SSH가 끊겨도 빌드가 계속된다 (다시 붙기: tmux attach -t deploy)
cd ~/deploy
docker compose up -d --build    # E2.1.Micro에서 첫 빌드는 10분 넘게 걸린다
docker compose logs -f api      # 마이그레이션이 끝나고 "Nest application successfully started"
```

시작할 때 `prisma migrate deploy`가 먼저 돈다. Cloudflare Tunnels 화면에서 상태가 **HEALTHY**가 되면 연결된 것이다.

1. `https://macfolio-api.hyeoniverse.com/health`가 응답한다
2. `https://macfolio-api.hyeoniverse.com/docs`에 Swagger가 뜬다
3. `https://macfolio-api.hyeoniverse.com/auth/github`가 GitHub 로그인으로 넘어간다 (503이면 OAuth 값이 없다)
4. 사이트의 Apple 메뉴 → 관리자 로그인 → `?admin=signed-in`으로 돌아오고, 시스템 설정 → 계정에 "GitHub로 로그인됨"이 뜬다

## 운영

### 업데이트

```bash
cd ~/macfolio && git pull
cd ~/deploy && docker compose up -d --build api
```

마이그레이션은 컨테이너가 시작할 때 적용된다.

새 API를 쓰는 프론트엔드 변경(예: 메시지의 `/messages`, 배경화면의 `/wallpapers`)은 **API를 먼저 올리고** main에 머지한다. API가 옛 버전이면 메시지는 "메시지를 열 수 없습니다"를 띄우고, 배경화면은 관리자가 더한 것 없이 기본 배경화면만 보인다.

### 로그와 상태

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 tunnel
```

### 백업

```bash
docker compose exec -T db pg_dump -U macfolio macfolio > ~/backup-$(date +%F).sql
scp -i ~/.ssh/oracle-macfolio.key ubuntu@<공인 IP>:~/backup-*.sql .   # Mac에서, 서버 밖에도 보관
```

되살리기: `docker compose exec -T db psql -U macfolio macfolio < backup.sql`

### 비밀 값 바꾸기

비밀 값이 채팅·스크린샷·로그에 드러났으면 새로 발급한다.

- **GitHub Client secret**: OAuth App → Generate a new client secret → 옛 secret 삭제 → `api.env` 수정
- **Tunnel 토큰**: Tunnels → `macfolio-api` → 토큰 교체 → `.env` 수정
- 적용: `docker compose up -d` (바뀐 컨테이너만 다시 뜬다)

`IP_HASH_SECRET`을 바꾸면 이전 댓글과 새 댓글의 작성자 해시가 이어지지 않는다. 드러난 게 아니면 두는 편이 낫다.

### 유휴 회수

Oracle은 7일 동안 CPU·네트워크·메모리 사용률이 모두 낮은 Always Free 인스턴스를 회수할 수 있다. 계정을 **Pay As You Go로 업그레이드**하면 회수 대상에서 빠지고, Always Free 한도 안에서는 그대로 0원이다. 업그레이드했다면 Budget 알림(예: 월 $1)을 걸어 둔다. 회수돼도 다시 만들 수 있게 이 문서와 서버 밖 백업을 유지한다.

## 문제 해결

| 증상                                                         | 원인과 해결                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| "관리자 서버가 아직 연결되지 않았습니다", 로그인 버튼이 꺼짐 | 프론트 빌드에 `VITE_API_URL`이 없다. Cloudflare **Build** 변수에 넣고 다시 빌드한다 ([1](#1-프론트엔드-cloudflare-workers)) |
| 메시지를 열면 "메시지를 열 수 없습니다"                      | 메시지 API에 닿지 못했다. `docker compose ps`, `logs api` 확인. 서버 없이 화면만 볼 때는 `VITE_MESSAGES_STORE=local`        |
| "관리자 서버에 연결할 수 없습니다"                           | API가 내려갔거나 CORS가 막혔다. `docker compose ps`, `logs api`, `CORS_ORIGINS` 확인                                        |
| `/auth/github`가 503                                         | `GITHUB_CLIENT_ID`/`SECRET`이 비었다                                                                                        |
| GitHub에서 `redirect_uri` 오류                               | OAuth App 콜백 주소와 `API_URL` + `/auth/github/callback`이 다르다                                                          |
| 돌아왔는데 "로그인할 수 없음"                                | 관리자 계정(ID 68999618)이 아닌 GitHub 계정으로 로그인했다                                                                  |
| 돌아왔는데 로그인이 안 된 상태                               | 쿠키가 저장되지 않았다. https인지, API가 `hyeoniverse.com` 하위 도메인인지 확인                                             |
| api가 시작하자마자 꺼짐                                      | `IP_HASH_SECRET` 없음, DB 연결 실패 등. `docker compose logs api`의 첫 에러를 본다                                          |
| 빌드 중 멈추거나 `Killed`                                    | 메모리 부족. swap을 잡았는지 `free -h`로 확인                                                                               |
| `name:: command not found` 등이 줄줄이                       | YAML을 파일이 아니라 터미널에 붙여 넣었다. `cat > compose.yml <<'EOF'`로 감싼다                                             |
| `--env-file: no such file or directory`                      | 파일이 그 경로에 없다. 서버의 `~/deploy`에서 실행했는지 확인                                                                |
| Tunnel이 HEALTHY가 안 됨                                     | `TUNNEL_TOKEN`이 틀렸거나 tunnel 컨테이너가 안 떴다. `docker compose logs tunnel`                                           |
| 접속 메시지가 `x86_64`인데 A1을 만들려 했음                  | AMD shape로 만들어졌다. E2.1.Micro면 무료이니 그대로 쓰고, 다른 shape면 과금되니 지우고 다시 만든다                         |

## 남은 일

[#10](https://github.com/hyeoniverse/MacFolio/issues/10)에서 이어서 한다.

- main에 머지하면 GitHub Actions가 이미지를 빌드하고 서버에 배포 (지금은 서버에서 직접 `git pull`)
- `pg_dump`를 cron으로 매일, 서버 밖에 보관
- 외부 업타임 모니터링으로 `/health` 감시
