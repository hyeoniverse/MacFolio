---
title: 서버 운영 1 - Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기
date: 2026-09-30
category: 개발 기록/MacFolio/배포·운영
summary: 로컬에서 동작하던 관리자 로그인을 배포 환경으로 옮겼다. 인바운드 포트를 열지 않는 Cloudflare Tunnel, 메모리 1GB 무료 VM에서의 빌드, 그리고 /docs는 열리는데 로그인 버튼이 비활성이던 원인(빌드 시각에 코드에 삽입되는 VITE_API_URL)을 정리했다.
---

관리자 로그인, 글쓰기, 댓글은 로컬에서 모두 동작했다. 남은 작업은 API 서버를 실제로 배포해 `macfolio.hyeoniverse.com`에서 로그인하는 것이었다. 서버를 처음부터 다시 구축하는 순서는 `docs/deployment.md`(320줄)로 정리해 [#46](https://github.com/hyeoniverse/MacFolio/pull/46)에 포함했다.

![배포 구성](./images/deploy-architecture.svg '프론트엔드는 Cloudflare Workers, API는 Oracle VM. 서버는 Cloudflare로 향하는 아웃바운드 연결만 생성한다')

## 처음 계획과 변경한 구성

처음 계획은 일반적인 구성이었다. VM에 nginx를 설치하고, Let's Encrypt로 인증서를 발급받고, 방화벽에서 80/443 포트를 연다. 구성 중에 비교해 보니 **Cloudflare Tunnel**이 관리 항목이 더 적었다.

|                | nginx + certbot           | Cloudflare Tunnel                 |
| -------------- | ------------------------- | --------------------------------- |
| 여는 포트      | 22, 80, 443               | 22만                              |
| 인증서         | 서버에서 발급·갱신        | Cloudflare가 관리한다             |
| 서버 IP        | DNS 레코드에 노출된다     | 노출되지 않는다                   |
| 서버 구성 요소 | nginx 설정, certbot, cron | `cloudflared` 컨테이너 하나, 토큰 |

프론트엔드처럼 API도 Cloudflare Workers에서 실행하는 방법이 있다. 하지만 이 API는 NestJS와 Prisma(PostgreSQL)로 구성되어 있고, 업로드한 파일을 DB에 `bytea`로 저장한다. Workers의 실행 모델(요청마다 생성되는 짧은 수명의 격리 환경)에 맞추려면 DB 연결 방식과 프레임워크를 바꿔야 하므로, 상시 실행되는 VM 한 대를 사용하기로 했다.

터널은 서버 안의 `cloudflared`가 Cloudflare로 **아웃바운드** 연결을 먼저 생성하고, 외부 요청이 그 연결을 거쳐 서버로 전달되는 방식이다([Cloudflare 문서: Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)). 인바운드 포트가 없으므로 Oracle 보안 목록(Security List)에 추가할 규칙도 없다. 도메인이 이미 Cloudflare DNS에 있어 추가 비용도 없다.

## 메모리 1GB 무료 서버

Oracle Always Free에는 ARM(Ampere A1) 4 OCPU·메모리 24GB까지 무료인 shape가 있다. Dockerfile도 이를 기준으로 arm64에서 빌드되게 작성했다. 그런데 서버를 생성하고 접속하자 다음 메시지가 출력되었다.

```text
Welcome to Ubuntu 24.04.5 LTS (GNU/Linux 6.17.0-1020-oracle x86_64)
```

A1은 사용자가 많은 리전에서 용량 부족으로 생성되지 않는 경우가 많고, 선택할 수 있는 shape는 AMD `E2.1.Micro`뿐이었다. 이 shape도 Always Free지만 메모리가 1GB다. 이름이 비슷한 `E4/E5.Flex`는 유료이므로, `nproc`와 `free -h`로 무료 shape인지 먼저 확인했다.

Node 공식 이미지는 amd64·arm64를 모두 제공하므로 Dockerfile은 수정하지 않았다. 문제는 메모리였다. `pnpm install`과 `tsc`가 1GB 안에서 실행되다 메모리 부족(OOM)으로 종료될 수 있어, 빌드 전에 swap을 4GB 할당했다. 빌드 이후 실행 중에는 PostgreSQL, API, cloudflared를 합쳐도 수백 MB라 1GB로 충분하다.

## 비밀 값은 저장소 밖에 보관

서버에는 저장소를 clone한 폴더와 별도로 `~/deploy` 폴더를 만들었다.

```text
~/macfolio/   코드 (git pull로 업데이트)
~/deploy/
  .env        DB 비밀번호, 터널 토큰
  api.env     GitHub OAuth, IP 해시 키, CORS
  compose.yml db + api + tunnel
```

코드와 설정을 분리하면 비밀 값이 실수로 커밋되지 않고, `git pull` 후에도 설정이 유지된다. `compose.yml`에는 `ports` 항목이 없다. api는 compose 내부 네트워크에서 `api:4000`으로만 접근할 수 있고, 터널의 Public Hostname이 이 주소를 가리킨다.

## 터미널에 YAML을 붙여 넣은 결과

`compose.yml` 내용을 터미널에 그대로 붙여 넣자 다음 오류가 줄마다 출력되었다.

```text
Command 'name:' not found, did you mean: ...
services:: command not found
Command 'image:' not found ...
```

셸은 붙여 넣은 줄을 하나씩 **명령으로** 실행한다. 파일로 저장하려면 heredoc[^heredoc]으로 감싸야 한다. 이때 구분자 `EOF`에 따옴표를 붙여야 한다.

```bash
cat > compose.yml <<'EOF'
    POSTGRES_PASSWORD: ${DB_PASSWORD}   # 글자 그대로 들어간다
EOF
```

| 구분자    | `${DB_PASSWORD}` 처리                                   | 파일에 기록되는 값      | 사용한 곳                                                      |
| --------- | ------------------------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `<<'EOF'` | 셸이 치환하지 않는다                                    | `${DB_PASSWORD}` 그대로 | `compose.yml` (실행 시각에 compose가 `.env`에서 채움)          |
| `<<EOF`   | 셸이 입력 시각에 치환한다. 셸에 변수가 없으면 빈 문자열 | 빈 값                   | `.env` (`$(openssl rand -hex 24)`를 무작위 값으로 바꾸기 위해) |

## /docs는 열리는데 로그인 버튼이 비활성

터널 상태가 HEALTHY가 되고 `https://macfolio-api.hyeoniverse.com/docs`에 Swagger 문서가 표시되었다. 서버와 터널이 정상 동작한다는 뜻이다.

![Swagger 문서](./images/swagger.jpg '터널을 거쳐 API 문서가 표시된다. 서버와 터널은 정상')

그런데 사이트에서 로그인하려고 하자 버튼이 비활성 상태였다.

![관리자 서버가 아직 연결되지 않았습니다](./images/admin-disabled.jpg '버튼이 비활성이고 서버 행도 없다. 프론트엔드에 API 주소가 없다')

이 문구는 API 요청이 실패해서 표시되는 것이 아니다. **요청할 주소 자체가 없을 때** 표시된다.

```ts
export const adminStore = createStore<AdminState>({
	status: env.apiUrl ? 'checking' : 'disabled',
	login: null,
});
```

`env.apiUrl`은 `import.meta.env.VITE_API_URL` 값이다. Vite는 이 값을 **빌드 시각에** 코드에 문자열 리터럴로 치환한다([Vite 문서: Env Variables and Modes](https://vite.dev/guide/env-and-mode)). 배포된 JS는 정적 파일이므로 실행 중에 환경 변수를 읽을 수단이 없다.

Cloudflare 대시보드에는 변수 입력란이 두 곳 있다.

| 위치                                         | 적용 시각                   | 이 사이트에서의 효과                 |
| -------------------------------------------- | --------------------------- | ------------------------------------ |
| Settings → **Variables and Secrets**         | Worker **실행** 시각에 읽음 | 없음 (당시 Worker 스크립트가 없었다) |
| Settings → Build → **Variables and secrets** | **빌드** 시각에 사용        | `VITE_API_URL`이 JS 번들에 삽입된다  |

이 시각의 사이트는 Worker 스크립트 없이 정적 자산만 제공했으므로, 실행 변수를 읽는 코드가 없었다.

![VITE_API_URL은 빌드 단계에서 JS 문자열이 된다. 실행 변수는 Worker 코드만 읽는다](./images/deploy-api-oracle-tunnel-env.svg '정적 사이트의 환경 변수는 빌드 시각에만 의미가 있다')

빌드 변수에 `VITE_API_URL`을 추가하고 다시 빌드하자 버튼이 활성화되었다. 반영 여부는 배포된 JS에서 주소 문자열을 검색해 확인한다.

```bash
curl -s https://macfolio.hyeoniverse.com/assets/index-….js | grep -o 'https://macfolio-api.hyeoniverse.com'
```

## 로그인

![로그인된 계정 화면](./images/admin-signed-in.jpg '시스템 설정 → 계정. 서버 줄에 API 주소가 보이고, GitHub로 로그인됨')

GitHub 인증을 거쳐 `?admin=signed-in`으로 돌아오고, 계정 화면에 서버 주소와 로그인 상태가 표시되었다. 로컬과 달라진 부분은 쿠키와 IP 처리 세 가지였다.

- `NODE_ENV=production`이면 세션 쿠키에 `Secure` 속성이 붙는다. https가 아니면 브라우저가 이 쿠키를 저장하지 않는다. 터널이 https를 처리하므로 추가 설정은 없었다
- 프론트엔드(`macfolio.`)와 API(`macfolio-api.`)는 같은 사이트(`hyeoniverse.com`)이므로 `SameSite=Lax` 쿠키가 `fetch(…, { credentials: 'include' })` 요청에 포함된다([MDN: SameSite](https://developer.mozilla.org/ko/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)). API를 `*.workers.dev`나 IP 주소에 배포했다면 교차 사이트 요청이 되어 쿠키가 전송되지 않는다
- 요청 제한은 IP 단위로 집계한다. 터널 뒤에서는 모든 요청의 출발지가 `cloudflared`로 보이므로, `TRUST_PROXY=1`로 프록시 한 단계만 신뢰하고 `X-Forwarded-For`에서 실제 IP를 읽게 했다

```ts
// apps/api/src/app.setup.ts
(app as NestExpressApplication).set('trust proxy', config.trustProxy); // TRUST_PROXY, 기본 0

// apps/api/src/auth/auth.controller.ts — 세션 쿠키
return { httpOnly: true, sameSite: 'lax', secure: this.config.auth.secureCookies, maxAge, path };
```

`trust proxy`를 `true`(전체 신뢰)로 설정하지 않은 이유는 다음과 같다. `true`이면 요청자가 `X-Forwarded-For`에 임의의 IP를 적어 보내도 그 값을 클라이언트 IP로 사용한다. 요청마다 다른 IP를 적으면 요청 제한을 우회할 수 있다. 한 단계(바로 앞의 `cloudflared`)만 신뢰하면, Cloudflare가 덧붙인 실제 IP만 읽는다([Express 문서: Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)).

![요청자가 XFF에 위조 값을 넣어도 trust proxy 1은 Cloudflare가 덧붙인 실제 IP를 읽는다](./images/deploy-api-oracle-tunnel-trust-proxy.svg 'TRUST_PROXY=1은 오른쪽 끝 값, true는 왼쪽 끝 값을 req.ip로 쓴다')

## 확인한 것

| 확인                               | 방법                                   | 결과                       |
| ---------------------------------- | -------------------------------------- | -------------------------- |
| 무료 shape인지                     | `nproc`, `free -h`                     | E2.1.Micro, 메모리 1GB     |
| 서버와 터널                        | Cloudflare 대시보드 터널 상태, `/docs` | HEALTHY, Swagger 표시      |
| 프론트엔드에 API 주소가 들어갔는지 | 배포된 JS에서 `grep -o`                | 주소 문자열 검색됨         |
| 로그인                             | GitHub로 로그인 → `?admin=signed-in`   | 계정 화면에 서버 주소·상태 |
| 여는 포트                          | Oracle 보안 목록                       | 22번만                     |

## 남은 과제와 후속 작업

이 시각에는 코드를 변경하면 서버에 SSH로 접속해 `git pull` 후 다시 빌드했다. 1GB 서버에서의 빌드는 시간도 오래 걸린다. 그래서 다음 세 가지를 계획했고, 모두 이후에 적용했다.

- GitHub Actions에서 이미지를 빌드해 레지스트리에 업로드하고, 서버는 내려받아 실행만 한다 → [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- `pg_dump`를 매일 실행해 서버 밖에 보관한다 → [서버 운영 2 - pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)
- `/health`를 외부에서 감시한다 → [서버 운영 3 - GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)

swap 4GB는 현재도 유지한다. 평소에는 GitHub Actions가 빌드하지만, 긴급 상황에서 서버가 직접 빌드할 수 있게 하기 위해서다.

서버를 새로 생성해도 같은 구성을 재현할 수 있도록, 이번 작업은 저장소의 `docs/deployment.md`에 순서대로 기록했다.

## 정리

- 인바운드 포트를 열지 않는 서버는 관리 항목이 적다. 인증서와 방화벽 규칙을 관리하지 않는다. 대신 터널 토큰 하나가 접근 권한 전체이므로, 이 토큰을 저장소 밖에 안전하게 보관한다.
- 정적 사이트의 "환경 변수"는 실행 중에 읽는 값이 아니라 빌드 시각에 코드에 삽입되는 문자열이다. 대시보드에 변수 입력란이 두 곳이면, 어느 쪽이 빌드 단계에 적용되는지 먼저 확인한다.
- 쿠키로 인증하는 API는 프론트엔드와 같은 사이트(등록 가능한 도메인)에 배포하는 것이 설정이 가장 적다. `SameSite` 제약과 서드파티 쿠키 차단의 영향을 받지 않는다.

## 실제 작업 순서

9월 30일 하루 동안 진행했다. 21시 56분(한국 시간)에 "배포 환경에서 OAuth를 확인하려면 무엇이 필요한가"에서 시작해, 23시 49분에 로그인에 성공했다.

<details>
<summary>단계별 기록 (6단계)</summary>

1. 처음에는 서버 없이 로컬 Mac에서 `docker run … --env-file /etc/macfolio/api.env macfolio-api`를 실행했다. 출력은 `--env-file: no such file or directory`. 서버에 배치할 파일을 로컬에서 찾은 것이다
2. Oracle Always Free의 과금 조건을 먼저 확인하고 VM을 생성했다. 접속하자 `x86_64`, `free -h`의 Mem total이 954Mi였다. A1이 아니라 E2.1.Micro였다
3. 내려받은 키 파일을 `mv ~/Downloads/ssh-key-*.key ~/.ssh/server.key`로 옮겼다. 저장소 폴더가 아닌 위치에서 실행했지만 경로를 모두 `~` 기준으로 적었으므로 결과는 같다. 키가 저장소 밖에 있으므로 커밋될 위험도 없다
4. Cloudflare에서 터널을 생성할 때 운영체제 선택 단계가 있다. Docker를 선택했다. 표시되는 `docker run` 명령은 실행하지 않고 토큰만 사용한다
5. `~/deploy/.env`의 위치가 프로젝트 폴더 안인지 확인했다. 프로젝트 폴더 밖이다. 코드(`~/macfolio`)와 설정(`~/deploy`)의 분리가 이 구성의 핵심이다. clone 크기는 객체 56,048개, 182MB였다
6. 서버와 터널이 실행되고 `/docs`가 열렸지만, 사이트에는 "관리자 서버가 아직 연결되지 않았습니다"가 표시되었다. 빌드 변수 `VITE_API_URL`을 추가하고 다시 빌드해 해결했다

</details>

작업 후 이 순서를 `docs/deployment.md`와 README에 정리했다. 그 문서가 아래 '적용 방법'의 원본이다. 문서를 작성하면서 이날 막힌 단계(1·6)는 '문제 해결' 표에 한 행씩 기록했다.

## 적용 방법

준비물: Oracle Cloud 계정, Cloudflare에 있는 도메인, GitHub OAuth App(배포용). 전체 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 2~7단계다.

```bash
# 로컬 Mac: 키를 저장소 밖에 보관하고 접속
mv ~/Downloads/ssh-key-*.key ~/.ssh/server.key && chmod 600 ~/.ssh/server.key
ssh -i ~/.ssh/server.key ubuntu@<공인 IP>

# 서버: swap(1GB 서버), Docker, 코드
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu   # 다시 접속
git clone https://github.com/hyeoniverse/MacFolio.git ~/macfolio && mkdir -p ~/deploy
# ~/deploy에 .env, api.env, compose.yml을 cat > 파일 <<'EOF' … EOF 로 만든다 (문서 6단계)
cd ~/deploy && docker compose up -d && docker compose logs -f api
```

확인 항목은 네 가지다.

1. `/health`가 응답한다
2. `/docs`에 Swagger 문서가 표시된다
3. `/auth/github`가 GitHub로 리다이렉트한다 (503이면 OAuth 설정값이 없다)
4. 사이트에서 로그인하면 `?admin=signed-in`으로 돌아온다

되돌리는 방법: `docker compose down`을 실행하면 서비스가 중지되고 DB 볼륨은 유지된다. 터널을 삭제하면 외부 주소가 즉시 차단된다.

공식 문서: [Oracle Always Free 자원](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), [Docker 설치](https://docs.docker.com/engine/install/ubuntu/), [Vite 환경 변수](https://vite.dev/guide/env-and-mode).

## 관련 글

- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)
- [서버 운영 2 - pg_dump와 R2로 하는 DB 백업과 복원 시험](/memo/db-backup)
- [서버 운영 3 - GitHub Actions 예약 실행으로 외부에서 API 서버 업타임 감시하기](/memo/server-uptime-and-logs)
- [부트 볼륨을 임시 VM에 연결해 authorized_keys를 고치는 SSH 키 복구](/memo/oracle-ssh-key-recovery)
- [보안 점검 11 - PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)

[^heredoc]: `명령 <<구분자`부터 구분자만 있는 줄까지를 그 명령의 표준 입력으로 전달하는 셸 문법. 구분자에 따옴표를 붙이면 본문의 변수·명령 치환이 일어나지 않는다. [Bash 매뉴얼: Here Documents](https://www.gnu.org/software/bash/manual/html_node/Redirections.html#Here-Documents)

#MacFolio #배포 #서버 #Cloudflare
