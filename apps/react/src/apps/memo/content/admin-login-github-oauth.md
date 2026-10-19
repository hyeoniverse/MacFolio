---
title: 정적 사이트에 관리자 로그인 붙이기
date: 2026-09-29
category: 개발기/MacFolio/백엔드
summary: GitHub OAuth로 내 계정만 관리자로 들여보낸다. 비밀번호 없이 GitHub 숫자 ID로 확인하고, DB에는 세션 토큰 대신 해시만 둔다. state 쿠키, DB 세션과 JWT 비교, AdminGuard, GitHub 없이 도는 시험까지 정리했다.
---

[메모 편집을 관리자만 하게 한 이유](/memo/read-only-memo) 글에서, 정적 사이트는 브라우저 코드만으로 관리자를 가릴 수 없다고 적었다. 브라우저에 내려간 코드는 누구나 열어 고칠 수 있으니, "관리자만 편집 버튼을 보여 준다"는 조건문은 아무것도 막지 못한다. 메모, 사진, 배경 화면, 프로필을 사이트 안에서 고치려면 서버가 요청마다 "이 사람이 관리자인가"를 판단해야 했다.

그래서 API 서버(NestJS + Prisma + PostgreSQL)를 만들고 관리자 로그인부터 붙였다([백엔드 설계](/memo/backend-design)). 첫 구현은 PR [#38](https://github.com/hyeoniverse/MacFolio/pull/38)이다. 같은 PR 안에서 관리자 확인을 계정 이름에서 숫자 ID로 바꾸고, 로그인 경로에 요청 제한을 걸었다. 코드는 `apps/api/src/auth/` 아래 여섯 파일(시험 제외 360줄)이다.

| 파일                 | 하는 일                                           |
| -------------------- | ------------------------------------------------- |
| `auth.controller.ts` | `/auth/github`, 콜백, `/auth/me`, 로그아웃        |
| `auth.service.ts`    | 관리자 확인, 세션 만들기·찾기·지우기              |
| `github.client.ts`   | GitHub에 코드 교환과 계정 조회 (시험에서 바꿔 낌) |
| `session.ts`         | 무작위 토큰, 해시, 시간에 안전한 비교 (순수 함수) |
| `admin.guard.ts`     | 관리자 API 앞에서 요청마다 세션 확인              |

![메뉴 막대의 Apple 메뉴](./images/apple-menu.jpg '데스크톱에서는 메뉴 막대의 Apple 메뉴에서 로그인한다')

## 비밀번호 대신 GitHub

관리자는 나 한 명이다. 비밀번호를 만들면 해시해서 보관하고, 잊었을 때 바꾸는 방법도 만들어야 한다. 이미 쓰고 있는 GitHub 계정으로 로그인하면 그럴 필요가 없다.

서버는 GitHub에 "이 사람이 누구냐"만 묻고, 돌아온 계정이 설정해 둔 관리자일 때만 인정한다. 이때 계정 **이름이 아니라 숫자 ID**로 비교한다.

```ts
if (user.id !== adminGithubId) return null; // 관리자가 아니면 세션을 만들지 않는다
```

처음에는 이름(`hyeoniverse`)으로 비교했다. 그런데 GitHub 계정 이름은 바꿀 수 있고, 바꾸고 나면 옛 이름을 다른 사람이 가입해 가져갈 수 있다. 그 사람이 `hyeoniverse`로 로그인하면 관리자가 되어 버린다. 숫자 ID는 계정을 만들 때 정해지고 바뀌지 않으므로, 이름을 바꿔도 나는 그대로 관리자이고 옛 이름을 가져간 사람은 관리자가 아니다.

공개 프로필만 읽으면 되므로 GitHub에 어떤 권한(scope)도 달라고 하지 않는다. 로그인 화면에서 가입 버튼도 숨긴다(`allow_signup=false`).

## 로그인 흐름

1. 프론트엔드에서 `/auth/github`로 간다. 서버는 무작위 `state`를 만들어 쿠키에 기억하고 GitHub 로그인 화면으로 보낸다.
2. GitHub에서 로그인하면 `/auth/github/callback?code=…&state=…`로 돌아온다.
3. 서버는 쿠키의 `state`와 주소의 `state`가 같은지 본다. 다르면 400으로 끝낸다.
4. `code`를 액세스 토큰으로 바꾸고, 그 토큰으로 계정 이름을 읽는다.
5. 관리자면 세션 쿠키를 주고 프론트엔드로 돌려보낸다.

3번의 `state`가 없으면, 다른 사이트가 자기 `code`를 붙인 콜백 주소로 내 브라우저를 보내 **자기 계정으로 로그인시키는** 공격(login CSRF)을 막을 수 없다. `state`는 로그인을 시작한 브라우저에만 쿠키로 있으므로, 시작하지 않은 로그인은 끝낼 수 없다. 비교는 걸린 시간으로 내용을 짐작할 수 없게 `timingSafeEqual`로 한다.

![관리자 로그인 흐름](./images/oauth-flow.svg '브라우저, API, GitHub 사이를 오가는 순서')

GitHub에 다녀오면 사이트를 처음부터 다시 불러오게 된다. 처음에는 평소처럼 "클릭하여 시작" 로딩 화면이 떠서, 로그인이 됐는지 알 수 없었다. 지금은 GitHub에서 돌아온 경우 로딩 화면을 건너뛰고, 서버에 로그인 상태를 물어본 뒤 결과 창을 띄운다. 떠날 때도 바로 다른 페이지로 바뀌지 않게 "GitHub로 이동하는 중" 안내를 잠깐 보여 준다.

처음부터 다시 불러오니 켜 두었던 앱도 모두 꺼졌다. 창 위치와 크기는 이미 `localStorage`에 남기고 있어서, 어떤 앱이 켜져 있었고 어느 창이 앞에 있었는지만 떠나기 직전에 `sessionStorage`에 적어 둔다. 돌아오면 한 번 꺼내 그대로 되살리고 지운다. 그사이 화면이 데스크톱에서 모바일로 바뀌었으면 되살리지 않는다.

![로그인 결과 창](./images/login-result.jpg '돌아오면 로딩 화면 없이 결과 창이 뜬다. 확인을 누를 때까지 떠 있다')

## DB에는 토큰 대신 해시

세션 쿠키에는 추측할 수 없는 무작위 토큰(32바이트)을 넣는다. DB에는 그 토큰이 아니라 SHA-256 해시를 둔다.

```ts
const token = randomToken();
await this.prisma.adminSession.create({
	data: { tokenHash: hashToken(token), githubLogin: user.login, expiresAt },
});
```

요청이 오면 쿠키의 토큰을 해시해서 찾는다. DB 내용이 새어 나가도 거기 있는 것은 해시뿐이라, 그걸로 쿠키를 만들어 관리자인 척할 수 없다. 비밀번호를 해시로 저장하는 것과 같은 이유다. 다만 토큰은 이미 충분히 긴 무작위 값이라 Bcrypt처럼 느린 해시가 필요 없다.

세션을 DB에 두는 이유도 있다. 서명한 쿠키(JWT 같은)만 쓰면 서버가 따로 기억하는 것이 없어서, 로그아웃해도 만료 전까지는 그 쿠키가 계속 통한다. DB 세션은 로그아웃하면 행을 지우므로 같은 쿠키로 다시 들어올 수 없다.

![JWT와 DB 세션의 로그아웃](./images/admin-login-github-oauth-session.svg '로그아웃한 뒤 남은 쿠키 사본이 통하는지가 갈린다')

## 고른 방법과 버린 방법

| 고민          | 버린 방법               | 고른 방법                     | 이유                                                    |
| ------------- | ----------------------- | ----------------------------- | ------------------------------------------------------- |
| 누구인지 확인 | 비밀번호                | GitHub OAuth                  | 보관·재설정 기능이 필요 없다. 관리자는 한 명이다        |
| 관리자 비교   | 계정 이름 `hyeoniverse` | 숫자 ID                       | 이름은 바뀌고, 버린 이름은 남이 가져갈 수 있다          |
| 세션 보관     | 서명한 쿠키(JWT)        | DB 세션 + 해시                | 로그아웃이 바로 통한다. 요청마다 DB 조회 1번은 감당된다 |
| 토큰 해시     | Bcrypt 같은 느린 해시   | SHA-256                       | 32바이트 무작위 값이라 사전 공격이 통하지 않는다        |
| 위조 로그인   | 아무것도 안 함          | `state` 쿠키 + 시간 안전 비교 | login CSRF를 막는다                                     |

관리자 ID를 바꾸는 경우도 생각했다. 세션 행에 로그인할 때의 GitHub ID를 함께 적고, 찾을 때 지금 설정의 관리자 ID와 다시 비교한다. 설정을 바꾸면 이전 관리자의 세션은 남아 있어도 통하지 않는다.

```ts
if (!session || session.expiresAt <= now || session.githubId !== this.config.auth.adminGithubId) return null;
```

새로 로그인할 때마다 만료된 세션 행을 지운다(`deleteMany({ where: { expiresAt: { lte: now } } })`). 관리자가 한 명이라 행이 쌓일 일은 적지만, 따로 청소 작업을 두지 않아도 되게 했다.

## 쿠키 설정

```ts
{ httpOnly: true, sameSite: 'lax', secure: config.auth.secureCookies, maxAge: 12 * 60 * 60 * 1000 }
```

- `httpOnly`: 자바스크립트에서 읽을 수 없다. 페이지에 스크립트가 끼어들어도 세션 토큰은 가져가지 못한다
- `sameSite: 'lax'`: 다른 사이트에서 보낸 POST 같은 요청에는 붙지 않는다. GitHub에서 돌아오는 주소 이동(GET)에는 붙는다
- `secure`: 배포에서는 https로만 보낸다
- 12시간: 관리 작업을 할 때만 로그인하면 되니 짧게 둔다

프론트엔드(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)는 주소는 다르지만 같은 사이트(`hyeoniverse.com`)라, Lax 쿠키가 함께 간다. CORS는 프론트엔드 주소만 허용한다.

## 관리자 전용 API는 Guard로

관리자만 쓸 수 있는 API에는 Guard를 붙인다. 요청마다 쿠키의 세션을 DB에서 확인하고, 없으면 401이다.

```ts
@Get('me')
@UseGuards(AdminGuard)
me(@CurrentAdmin() admin: AdminIdentity) {
	return admin;
}
```

화면에서 편집 버튼을 숨기는 것은 안내일 뿐이다. 버튼을 숨겨도 누군가 직접 요청을 보낼 수 있으니, 실제로 막는 일은 이 Guard가 한다.

![AdminGuard의 확인 순서](./images/admin-login-github-oauth-guard.svg '앞 단계에서 걸리면 DB까지 가지 않는다')

나중에 PR 미리보기 주소를 열면서 한 단계를 더했다(PR [#183](https://github.com/hyeoniverse/MacFolio/pull/183), [미리보기 주소의 CORS](/memo/preview-cors-read-only)). 미리보기는 CORS를 넓게 열어 두는데, 거기서 관리자 기능이 열리면 안 된다. 쿠키는 SameSite=Lax라 애초에 오지 않지만, 브라우저 설정이나 버그로 왔을 때를 생각해 Guard가 먼저 `Origin`을 보고 허용한 주소가 아니면 403으로 끝낸다.

## 테스트는 GitHub 없이

e2e 테스트에서 GitHub에 실제로 로그인할 수는 없다. GitHub에 요청하는 부분을 `GithubClient` 클래스 하나로 모아 두고, 테스트에서는 인가 코드마다 정해 둔 계정을 돌려주는 가짜로 바꿨다.

```ts
Test.createTestingModule({ imports: [AppModule] })
	.overrideProvider(GithubClient)
	.useValue(fakeGithub);
```

나머지(state 쿠키, 세션 저장, Guard, 로그아웃)는 실제 PostgreSQL에 붙여 그대로 돌린다. 시험은 세 파일에 20개다.

- `session.test.ts` (3개): 토큰이 매번 다르고 URL에 쓸 수 있는지, 해시가 토큰을 드러내지 않는지, `safeEqual`이 같을 때만 참인지.
- `auth.service.test.ts` (9개): 관리자면 세션을 만들고 DB에는 해시만 두는지, 관리자가 아니면 세션이 없는지, **이름이 hyeoniverse여도 ID가 다르면 관리자가 아닌지**, 관리자가 이름을 바꿔도 ID가 같으면 로그인되는지, 만료·로그아웃한 세션을 못 찾는지, 관리자 ID를 바꾸면 이전 세션이 통하지 않는지, 로그인 주소에 `allow_signup=false`가 붙는지.
- `test/auth.e2e.test.ts` (8개): 로그인을 시작하면 state를 httpOnly 쿠키로 기억하는지, 관리자는 세션 쿠키를 받고 `/auth/me`가 관리자를 알려 주는지, `state`가 없거나 다르면 400인지, GitHub 화면에서 취소하면 `cancelled`로 돌아오는지, 허용하지 않은 Origin이면 세션이 맞아도 403인지, 로그아웃한 쿠키로는 401인지.

## 다른 사람이 시도하면

로그인 버튼은 누구에게나 보인다. 누구든 GitHub 로그인 화면까지는 갈 수 있지만, 관리자가 아니면 세션 없이 "로그인할 수 없음"으로 돌아온다. 훔쳐 낼 비밀번호가 없으니 여러 번 시도해서 얻을 것도 없다.

그래도 로그인 경로(시작, 콜백)에는 IP마다 1분에 10번까지만 받는 요청 제한을 걸었다. 자동화된 시도가 서버와 GitHub API를 두드리지 못하게 하려는 것이다. 요청 제한은 IP로 세므로, 프록시 뒤에 둘 때만 `X-Forwarded-For`를 믿도록 설정(`TRUST_PROXY`)으로 따로 켠다. 아무 때나 믿으면 헤더를 꾸며 제한을 피할 수 있다. 관리자가 아닌 계정의 시도는 서버 로그에 남긴다.

![시스템 설정의 계정 화면](./images/settings-account.jpg '시스템 설정 → 계정. 로그인한 GitHub 계정과 세션 정보를 보여 준다')

## 남은 것, 배운 것

- 세션은 12시간 고정이다. 쓰는 동안 늘려 주지 않아서, 오래 편집하면 중간에 다시 로그인해야 한다. 관리 작업이 짧아 아직은 불편하지 않다. 계정 화면에 로그인 시각과 만료 시각을 보여 주는 것으로 대신했다([계정 화면의 로그인 시각](/memo/settings-signed-in-at)).
- 관리자는 한 명이라 역할(role)을 두지 않았다. 사람이 늘면 세션 행에 역할을 더하고 Guard를 나눠야 한다.
- 처음에 계정 이름으로 비교한 것은 "바뀌지 않는 값으로 사람을 가린다"는 기본을 놓친 것이다. 외부 서비스의 사용자를 가릴 때는 이름·이메일이 아니라 그 서비스가 주는 바뀌지 않는 ID를 쓴다.
- 바깥 서비스(GitHub)에 닿는 코드를 클래스 하나로 모아 둔 덕에, 시험에서 그 클래스만 바꿔 끼우고 나머지는 실제 DB로 돌릴 수 있었다.

## 직접 붙여 보기

준비물은 GitHub 계정과 로컬 PostgreSQL(Docker)이다. 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '2. GitHub OAuth App'과 [README.md](https://github.com/hyeoniverse/MacFolio/blob/main/README.md)의 로컬 실행에 있다.

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. 콜백 주소는 개발용이 `http://localhost:4000/auth/github/callback`, 배포용이 `https://macfolio-api.hyeoniverse.com/auth/github/callback`이다. OAuth App 하나에 콜백이 하나라 둘을 따로 만든다([GitHub 문서](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app))
2. Client ID와 secret을 `apps/api/.env`의 `GITHUB_CLIENT_ID`·`GITHUB_CLIENT_SECRET`에 넣는다. 관리자는 숫자 ID(`ADMIN_GITHUB_ID`)로 가린다
3. 띄우고 확인한다

```bash
pnpm --filter @macfolio/api db:up
pnpm dev:all
curl -si http://localhost:4000/auth/github | head -3   # 302면 GitHub로 넘어간다, 503이면 OAuth 값이 없다
```

브라우저에서 Apple 메뉴 → 관리자 로그인을 누르고, `?admin=signed-in`으로 돌아와 시스템 설정 → 계정에 "GitHub로 로그인됨"이 뜨면 된다. 로그인 경로 시험은 GitHub 없이 돈다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/auth.e2e.test.ts
```

되돌리는 법: OAuth App을 지우면(또는 secret을 새로 발급하면) 그 즉시 로그인 길이 닫힌다. DB의 세션 줄을 지우면 이미 로그인한 브라우저도 다음 요청부터 방문자가 된다.

배포 환경에 처음 붙일 때 실제로 막힌 곳은 따로 있었다. 서버용 명령(`docker run --env-file /etc/macfolio/api.env …`)을 내 컴퓨터에서 쳐서 `no such file or directory`가 났고, 서버를 다 띄운 뒤에도 사이트가 "관리자 서버가 아직 연결되지 않았습니다"를 보여 로그인 버튼이 꺼져 있었다. 원인은 빌드할 때 들어가는 `VITE_API_URL`이었고, 그 과정은 [API 서버를 무료로 띄우기](/memo/deploy-api-oracle-tunnel)에 적었다. 두 증상 모두 `docs/deployment.md`의 '문제 해결' 표에 남겼다.

관련 글: [메모 편집을 관리자만 하게 한 이유](/memo/read-only-memo), [백엔드 설계](/memo/backend-design), [모든 쓰기 경로에 요청 제한](/memo/rate-limit-all-writes), [미리보기 주소는 읽기만](/memo/preview-cors-read-only)

#MacFolio #백엔드 #로그인 #보안
