---
title: API 서버를 무료로 띄우기 - Oracle VM과 Cloudflare Tunnel
date: 2026-09-30
category: 인프라/배포·운영
summary: 로컬에서 되던 관리자 로그인을 배포 환경으로 옮겼다. 포트를 하나도 열지 않는 서버, 1GB 메모리에서의 빌드, 그리고 /docs는 열리는데 로그인은 안 되던 이유.
---

관리자 로그인, 글쓰기, 댓글까지 로컬에서는 다 됐다. 남은 건 API 서버를 실제로 띄워서 `macfolio.hyeoniverse.com`에서 로그인해 보는 일이었다.

![배포 구성](./images/deploy-architecture.svg '프론트엔드는 Cloudflare Workers, API는 Oracle VM. 서버는 Cloudflare로 나가는 연결만 만든다')

## 원래 계획과 바꾼 것

처음 계획은 흔한 구성이었다. VM에 nginx를 두고, Let's Encrypt로 인증서를 받고, 방화벽에 80/443을 연다. 만들다 보니 **Cloudflare Tunnel**이 더 단순했다.

|              | nginx + certbot           | Cloudflare Tunnel                 |
| ------------ | ------------------------- | --------------------------------- |
| 여는 포트    | 22, 80, 443               | 22만                              |
| 인증서       | 서버에서 발급·갱신        | Cloudflare가 맡는다               |
| 서버 IP      | DNS에 그대로 드러난다     | 드러나지 않는다                   |
| 서버에 둘 것 | nginx 설정, certbot, cron | `cloudflared` 컨테이너 하나, 토큰 |

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

터널이 HEALTHY가 되고 `https://macfolio-api.hyeoniverse.com/docs`에 Swagger가 떴다. 서버는 된 것이다.

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

이 사이트는 Worker 스크립트 없이 정적 자산만 서빙하니, 앞의 것은 읽을 코드가 없다. 빌드 변수에 `VITE_API_URL`을 넣고 다시 빌드하자 버튼이 켜졌다. 반영됐는지는 배포된 JS에서 주소 문자열을 찾아 보면 바로 알 수 있다.

```bash
curl -s https://macfolio.hyeoniverse.com/assets/index-….js | grep -o 'https://macfolio-api.hyeoniverse.com'
```

## 로그인

![로그인된 계정 화면](./images/admin-signed-in.jpg '시스템 설정 → 계정. 서버 줄에 API 주소가 보이고, GitHub로 로그인됨')

GitHub에 다녀와서 `?admin=signed-in`으로 돌아오고, 계정 화면에 서버 주소와 로그인 상태가 떴다. 로컬과 다른 점은 쿠키 하나였다.

- `NODE_ENV=production`이면 세션 쿠키에 `Secure`가 붙는다. https가 아니면 브라우저가 저장하지 않는다. 터널이 https를 맡아서 따로 할 일은 없었다
- 프론트엔드(`macfolio.`)와 API(`macfolio-api.`)는 같은 사이트(`hyeoniverse.com`)라 `SameSite=Lax` 쿠키가 `fetch(…, { credentials: 'include' })`에 붙는다. API를 `*.workers.dev`나 IP 주소로 두었다면 다른 사이트가 되어 로그인이 되지 않았을 것이다
- 요청 제한은 IP로 센다. 터널 뒤에서는 모든 요청이 `cloudflared`에서 오는 것처럼 보여서, `TRUST_PROXY=1`로 한 단계만 믿고 `X-Forwarded-For`에서 실제 IP를 읽게 했다

## 남은 것

지금은 코드를 바꾸면 서버에 SSH로 들어가 `git pull`하고 다시 빌드한다. 1GB 서버에서 빌드하는 건 느리기도 하다. 다음은 이렇게 하려고 한다.

- GitHub Actions에서 이미지를 빌드해 올리고, 서버는 받아서 실행만 한다
- `pg_dump`를 매일 돌려 서버 밖에 보관한다
- `/health`를 바깥에서 감시한다

서버를 새로 만들어도 다시 구성할 수 있게, 이번에 한 일은 저장소의 `docs/deployment.md`에 순서대로 적어 두었다.

#MacFolio #배포 #서버 #Cloudflare
