---
title: API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel
date: 2026-09-30
category: 개발기/MacFolio/인프라
summary: 로컬에서 되던 관리자 로그인을 배포 환경으로 옮겼다. 포트를 하나도 열지 않는 Cloudflare Tunnel, 1GB 무료 VM에서의 빌드, 그리고 /docs는 열리는데 로그인 버튼은 꺼져 있던 이유(빌드 때 박히는 VITE_API_URL)를 적었다.
---

관리자 로그인, 글쓰기, 댓글까지 로컬에서는 다 됐다. 남은 건 API 서버를 실제로 띄워서 `macfolio.hyeoniverse.com`에서 로그인해 보는 일이었다. 이 글과 함께 서버를 처음부터 다시 세우는 순서를 `docs/deployment.md`(320줄)로 적어 [#46](https://github.com/hyeoniverse/MacFolio/pull/46)에 넣었다.

![배포 구성](./images/deploy-architecture.svg '프론트엔드는 Cloudflare Workers, API는 Oracle VM. 서버는 Cloudflare로 나가는 연결만 만든다')

## 원래 계획과 바꾼 것

처음 계획은 흔한 구성이었다. VM에 nginx를 두고, Let's Encrypt로 인증서를 받고, 방화벽에 80/443을 연다. 만들다 보니 **Cloudflare Tunnel**이 더 단순했다.

|              | nginx + certbot           | Cloudflare Tunnel                 |
| ------------ | ------------------------- | --------------------------------- |
| 여는 포트    | 22, 80, 443               | 22만                              |
| 인증서       | 서버에서 발급·갱신        | Cloudflare가 맡는다               |
| 서버 IP      | DNS에 그대로 드러난다     | 드러나지 않는다                   |
| 서버에 둘 것 | nginx 설정, certbot, cron | `cloudflared` 컨테이너 하나, 토큰 |

프론트엔드처럼 API도 Cloudflare Workers에서 돌리는 길이 있다. 하지만 이 API는 NestJS와 Prisma(PostgreSQL)로 되어 있고, 올린 파일을 DB에 바이트로 담는다. Workers의 실행 모델(요청마다 짧게 사는 격리 환경)에 맞추려면 DB 연결과 프레임워크를 바꿔야 해서, 늘 켜져 있는 VM 하나를 두기로 했다.

터널은 서버 안의 `cloudflared`가 Cloudflare로 **나가는** 연결을 먼저 만들고, 바깥 요청이 그 연결을 타고 들어오는 방식이다. 들어오는 포트가 없으니 Oracle 보안 목록에서 열 것도 없다. 도메인이 이미 Cloudflare DNS에 있어서 추가로 드는 비용도 없다.

## 1GB짜리 무료 서버

Oracle Always Free에는 ARM(Ampere A1) 4 OCPU·24GB까지 무료인 서버가 있다. Dockerfile도 그걸 보고 arm64에서 빌드되게 만들어 두었다. 그런데 서버를 만들고 접속해 보니 이렇게 떴다.

```text
Welcome to Ubuntu 24.04.5 LTS (GNU/Linux 6.17.0-1020-oracle x86_64)
```

A1은 인기 리전에서 자리가 없는 일이 잦고, 고를 수 있는 건 AMD `E2.1.Micro`뿐이었다. 이것도 Always Free지만 메모리가 1GB다. `nproc`와 `free -h`로 무료 shape가 맞는지 먼저 확인했다. 비슷한 이름의 `E4/E5.Flex`는 유료라서다.

Node 이미지는 amd64·arm64를 모두 내주니 Dockerfile은 고칠 게 없었다. 문제는 메모리였다. `pnpm install`과 `tsc`가 1GB 안에서 돌다 죽기 쉬워서, 빌드 전에 swap을 4GB 잡았다. 빌드가 끝나고 돌아가는 동안은 Postgres, API, cloudflared를 합쳐도 몇백 MB라 1GB로 충분하다.

## 비밀 값은 레포 밖에

서버에는 레포를 clone한 폴더와 별개로 `~/deploy`를 두었다.

```text
~/macfolio/   코드 (git pull로 업데이트)
~/deploy/
  .env        DB 비밀번호, 터널 토큰
  api.env     GitHub OAuth, IP 해시 키, CORS
  compose.yml db + api + tunnel
```

코드와 설정을 떼어 두면 비밀 값이 실수로 커밋될 일이 없고, `git pull`을 해도 설정이 그대로 남는다. `compose.yml`에는 `ports`가 하나도 없다. api는 compose 네트워크 안에서 `api:4000`으로만 보이고, 터널의 Public Hostname이 거기를 가리킨다.

## 터미널에 YAML을 붙여 넣으면

`compose.yml` 내용을 터미널에 그대로 붙여 넣었더니 이런 게 줄줄이 나왔다.

```text
Command 'name:' not found, did you mean: ...
services:: command not found
Command 'image:' not found ...
```

셸은 붙여 넣은 줄을 하나씩 **명령으로** 실행한다. 파일로 쓰려면 heredoc으로 감싸야 한다. 이때 `EOF`에 따옴표를 붙이는 게 중요하다.

```bash
cat > compose.yml <<'EOF'
    POSTGRES_PASSWORD: ${DB_PASSWORD}   # 글자 그대로 들어간다
EOF
```

따옴표가 없으면 셸이 `${DB_PASSWORD}`를 지금 치환해 버린다. 셸에는 그런 변수가 없으니 빈 값이 들어간다. 따옴표를 붙이면 글자 그대로 파일에 들어가고, 실행할 때 compose가 `.env`에서 채운다. 반대로 `.env`를 만들 때는 따옴표를 빼서 `$(openssl rand -hex 24)`가 바로 무작위 값으로 바뀌게 했다.

## /docs는 열리는데 로그인이 안 된다

터널이 HEALTHY가 되고 `https://macfolio-api.hyeoniverse.com/docs`에 Swagger가 떴다. 서버와 터널은 제대로 돌고 있다는 뜻이다.

![Swagger 문서](./images/swagger.jpg '터널 너머로 API 문서가 뜬다. 서버와 터널은 정상')

그런데 사이트에서 로그인하려고 하니 버튼이 꺼져 있었다.

![관리자 서버가 아직 연결되지 않았습니다](./images/admin-disabled.jpg '버튼이 꺼져 있고 서버 줄도 없다. 프론트엔드가 API 주소를 모른다')

이 문구는 API에 요청했다가 실패해서 나오는 게 아니다. **요청할 주소 자체가 없을 때** 나온다.

```ts
export const adminStore = createStore<AdminState>({
	status: env.apiUrl ? 'checking' : 'disabled',
	login: null,
});
```

`env.apiUrl`은 `import.meta.env.VITE_API_URL`에서 온다. Vite는 이 값을 **빌드할 때** 코드에 문자열로 박아 넣는다. 배포된 JS는 그냥 정적 파일이라, 실행 중에 환경 변수를 읽을 방법이 없다.

Cloudflare 대시보드에는 변수를 넣는 곳이 두 군데 있다.

- Settings → **Variables and Secrets**: Worker가 **실행될 때** 읽는 값
- Settings → Build → **Variables and secrets**: **빌드할 때** 쓰는 값

이 사이트는 Worker 스크립트 없이 정적 자산만 서빙하니, 앞의 것은 읽을 코드가 없다.

![VITE_API_URL은 빌드 단계에서 JS 문자열이 된다. 실행 변수는 Worker 코드만 읽는다](./images/deploy-api-oracle-tunnel-env.svg '정적 사이트의 환경 변수는 빌드할 때만 의미가 있다') 빌드 변수에 `VITE_API_URL`을 넣고 다시 빌드하자 버튼이 켜졌다. 반영됐는지는 배포된 JS에서 주소 문자열을 찾아 보면 바로 알 수 있다.

```bash
curl -s https://macfolio.hyeoniverse.com/assets/index-….js | grep -o 'https://macfolio-api.hyeoniverse.com'
```

## 로그인

![로그인된 계정 화면](./images/admin-signed-in.jpg '시스템 설정 → 계정. 서버 줄에 API 주소가 보이고, GitHub로 로그인됨')

GitHub에 다녀와서 `?admin=signed-in`으로 돌아오고, 계정 화면에 서버 주소와 로그인 상태가 떴다. 로컬과 다른 점은 쿠키 하나였다.

- `NODE_ENV=production`이면 세션 쿠키에 `Secure`가 붙는다. https가 아니면 브라우저가 저장하지 않는다. 터널이 https를 맡아서 따로 할 일은 없었다
- 프론트엔드(`macfolio.`)와 API(`macfolio-api.`)는 같은 사이트(`hyeoniverse.com`)라 `SameSite=Lax` 쿠키가 `fetch(…, { credentials: 'include' })`에 붙는다. API를 `*.workers.dev`나 IP 주소로 두었다면 다른 사이트가 되어 로그인이 되지 않았을 것이다
- 요청 제한은 IP로 센다. 터널 뒤에서는 모든 요청이 `cloudflared`에서 오는 것처럼 보여서, `TRUST_PROXY=1`로 한 단계만 믿고 `X-Forwarded-For`에서 실제 IP를 읽게 했다

```ts
// apps/api/src/app.setup.ts
(app as NestExpressApplication).set('trust proxy', config.trustProxy); // TRUST_PROXY, 기본 0

// apps/api/src/auth/auth.controller.ts — 세션 쿠키
return { httpOnly: true, sameSite: 'lax', secure: this.config.auth.secureCookies, maxAge, path };
```

`trust proxy`를 `true`(모두 믿기)로 두지 않은 이유가 있다. 그러면 요청하는 쪽이 `X-Forwarded-For`에 아무 IP나 적어 보내도 그 값을 믿는다. 요청 제한을 피하려고 매번 다른 IP를 적으면 그만이다. 한 단계(바로 앞의 `cloudflared`)만 믿으면, 그 `cloudflared`가 붙인 값(Cloudflare가 본 실제 IP)만 읽는다.

## 확인한 것

| 확인                               | 방법                                   | 결과                       |
| ---------------------------------- | -------------------------------------- | -------------------------- |
| 무료 shape인지                     | `nproc`, `free -h`                     | E2.1.Micro, 메모리 1GB     |
| 서버와 터널                        | Cloudflare 대시보드 터널 상태, `/docs` | HEALTHY, Swagger가 뜬다    |
| 프론트엔드에 API 주소가 들어갔는지 | 배포된 JS에서 `grep -o`                | 주소 문자열이 나온다       |
| 로그인                             | GitHub로 로그인 → `?admin=signed-in`   | 계정 화면에 서버 주소·상태 |
| 여는 포트                          | Oracle 보안 목록                       | 22번만                     |

## 남은 것과 그 뒤

지금은 코드를 바꾸면 서버에 SSH로 들어가 `git pull`하고 다시 빌드한다. 1GB 서버에서 빌드하는 건 느리기도 하다. 그래서 이렇게 하기로 했고, 셋 모두 그 뒤에 했다.

- GitHub Actions에서 이미지를 빌드해 올리고, 서버는 받아서 실행만 한다 → [API 자동 배포](/memo/api-auto-deploy)
- `pg_dump`를 매일 돌려 서버 밖에 보관한다 → [글이 DB에만 있게 되어서 백업을 붙였다](/memo/db-backup)
- `/health`를 바깥에서 감시한다 → [서버 가동 시간과 로그](/memo/server-uptime-and-logs)

swap 4GB는 지금도 남겨 두었다. 평소에는 GitHub Actions가 빌드하지만, 급할 때 서버에서 직접 빌드할 수 있게 하려는 것이다.

서버를 새로 만들어도 다시 구성할 수 있게, 이번에 한 일은 저장소의 `docs/deployment.md`에 순서대로 적어 두었다.

## 배운 것

- 포트를 열지 않는 서버는 생각보다 관리할 것이 적다. 인증서도 방화벽 규칙도 없다. 대신 터널 토큰 하나가 열쇠가 되므로 그것만 레포 밖에 잘 둔다.
- 정적 사이트의 "환경 변수"는 실행 중에 읽는 값이 아니라 빌드 때 코드에 박히는 문자열이다. 대시보드에 변수 넣는 곳이 두 군데면, 어느 쪽이 빌드 단계인지부터 본다.
- 쿠키로 로그인하는 API는 프론트엔드와 같은 사이트(등록 가능한 도메인)에 두는 것이 가장 덜 아프다. `SameSite`와 서드파티 쿠키 차단을 피할 수 있다.

#MacFolio #배포 #서버 #Cloudflare
