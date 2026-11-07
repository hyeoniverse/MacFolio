---
title: GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기
date: 2026-09-29
category: 개발 기록/MacFolio/서버·API
summary: GitHub OAuth로 내 계정만 관리자로 인증한다. 비밀번호 없이 GitHub 숫자 ID로 확인하고, DB에는 세션 토큰 대신 해시만 저장한다. state 쿠키, DB 세션과 JWT 비교, AdminGuard, GitHub 없이 실행하는 시험까지 정리했다.
---

[정적 사이트의 편집 권한을 useCanEditMemo 하나로 관리자에게만 열기](/memo/read-only-memo) 글에서, 정적 사이트는 브라우저 코드만으로 관리자를 식별할 수 없다고 적었다. 브라우저에 내려간 자바스크립트는 누구나 개발자 도구로 열어 수정할 수 있다. 예를 들어 `if (isAdmin) showEditButton()`이라는 조건문이 있어도, 방문자가 콘솔에서 `isAdmin`을 `true`로 바꾸거나 편집 API를 `curl`로 직접 호출하면 조건문은 아무것도 막지 못한다. 메모, 사진, 배경 화면, 프로필을 사이트 안에서 수정하려면 **서버가 요청마다** "이 요청을 보낸 사람이 관리자인가"를 판단해야 했다.

서버가 사람을 식별하는 일은 두 단계로 나뉜다.

| 단계                 | 질문                                | MacFolio의 방법                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| 인증(authentication) | 로그인한 사람이 누구인가            | GitHub OAuth로 GitHub 계정을 확인                |
| 세션(session) 유지   | 다음 요청을 보낸 사람이 그 사람인가 | 무작위 토큰을 쿠키로 주고, DB에는 그 해시를 저장 |

로그인은 한 번이지만 그 뒤의 요청은 수십·수백 번이다. 세션은 로그인 결과를 쿠키에 담아 두고, 다음 요청부터는 GitHub에 다시 묻지 않고 쿠키만으로 같은 사람인지 확인하는 장치다.

그래서 API 서버(NestJS + Prisma + PostgreSQL)를 만들고 관리자 로그인부터 붙였다([백엔드 설계](/memo/backend-design)). 첫 구현은 [#38](https://github.com/hyeoniverse/MacFolio/pull/38)이다. 같은 PR 안에서 관리자 확인 기준을 계정 이름에서 숫자 ID로 바꾸고, 로그인 경로에 요청 제한을 걸었다. 코드는 `apps/api/src/auth/` 아래 여섯 파일(시험 제외 360줄)이다. 주요 다섯 파일은 다음과 같다.

| 파일                 | 역할                                                  |
| -------------------- | ----------------------------------------------------- |
| `auth.controller.ts` | `/auth/github`, 콜백, `/auth/me`, 로그아웃            |
| `auth.service.ts`    | 관리자 확인, 세션 생성·조회·삭제                      |
| `github.client.ts`   | GitHub에 코드 교환과 계정 조회 (시험에서 가짜로 교체) |
| `session.ts`         | 무작위 토큰, 해시, 시간에 안전한 비교 (순수 함수)     |
| `admin.guard.ts`     | 관리자 API 앞에서 요청마다 세션 확인                  |

![메뉴 막대의 Apple 메뉴](./images/apple-menu.jpg '데스크톱에서는 메뉴 막대의 Apple 메뉴에서 로그인한다')

## 비밀번호 대신 GitHub

관리자는 나 한 명이다. 비밀번호 방식을 쓰면 비밀번호를 해시해서 보관하는 기능과, 분실했을 때 이메일로 재설정하는 기능을 만들어야 한다. 이미 사용하는 GitHub 계정으로 로그인하면 두 기능이 모두 필요 없다.

**OAuth 2.0**은 사용자가 비밀번호를 제3의 서비스에 건네지 않고도, 그 서비스가 다른 서비스(여기서는 GitHub)의 정보에 접근하도록 허락하는 표준 절차다[^oauth]. 사용자는 GitHub 화면에서만 비밀번호를 입력하고, MacFolio 서버는 GitHub가 발급한 일회용 **인가 코드**(authorization code)를 받아 **액세스 토큰**으로 교환한다. 서버는 그 토큰으로 "이 토큰의 주인이 누구인가"를 GitHub API에 묻는다. MacFolio 서버는 비밀번호를 한 번도 받지 않는다.

서버는 GitHub에 사용자가 누구인지만 조회하고, 응답의 계정이 설정한 관리자일 때만 인증한다. 이때 계정 **이름이 아니라 숫자 ID**로 비교한다.

```ts
if (user.id !== adminGithubId) return null; // 관리자가 아니면 세션을 만들지 않는다
```

처음에는 이름(`hyeoniverse`)으로 비교했다. 그런데 GitHub 계정 이름은 변경할 수 있고, 변경한 뒤에는 ==옛 이름을 다른 사람이 새 계정으로 등록할 수 있다==[^rename]. 그 사람이 `hyeoniverse`로 로그인하면 관리자로 인증된다. 숫자 ID는 계정 생성 시각에 정해지고 바뀌지 않으므로, 이름을 바꿔도 나는 계속 관리자이고 옛 이름을 등록한 사람은 관리자가 아니다.

![처음, 이름 변경, 옛 이름 등록의 세 단계에서 이름으로 비교하면 관리자 본인을 거부하고 다른 사람을 인증하며, 숫자 ID로 비교하면 관리자만 인증한다](./images/admin-login-github-oauth-id-vs-name.svg '이름 비교와 숫자 ID 비교의 결과 (도식, ID는 예시 값)')

| 비교 기준               | 관리자가 이름을 바꾼 뒤 | 다른 사람이 옛 이름을 등록한 뒤 |
| ----------------------- | ----------------------- | ------------------------------- |
| 계정 이름 `hyeoniverse` | 로그인 거부             | **관리자로 인증됨**             |
| 숫자 ID                 | 그대로 관리자           | 거부                            |

자기 계정의 숫자 ID는 `https://api.github.com/users/<계정 이름>` 응답의 `id` 필드로 확인한다. 이 값을 서버 설정 `ADMIN_GITHUB_ID`에 넣는다.

공개 프로필만 읽으면 되므로 GitHub에 어떤 권한(scope[^scope])도 요청하지 않는다. 로그인 화면의 가입 버튼도 숨긴다(`allow_signup=false`).

## 로그인 흐름

GitHub OAuth의 웹 애플리케이션 흐름([GitHub 문서](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps))을 따른다.

1. 프론트엔드가 `/auth/github`로 이동한다. 서버는 무작위 `state`를 만들어 쿠키에 저장하고 GitHub 로그인 화면으로 리디렉션한다.
2. GitHub에서 로그인하면 `/auth/github/callback?code=…&state=…`로 돌아온다.
3. 서버는 쿠키의 `state`와 주소의 `state`가 같은지 비교한다. 다르면 400으로 응답한다.
4. `code`를 액세스 토큰으로 교환하고, 그 토큰으로 계정 정보를 조회한다.
5. 관리자면 세션 쿠키를 발급하고 프론트엔드로 리디렉션한다.

![관리자 로그인 흐름](./images/oauth-flow.svg '브라우저, API, GitHub 사이를 오가는 순서')

4번의 교환에는 `code`와 함께 서버만 아는 Client secret을 보낸다. 그래서 주소 막대에 노출된 `code`를 다른 사람이 가져가도, secret 없이는 토큰으로 바꿀 수 없다.

### state 쿠키와 login CSRF

**CSRF**(Cross-Site Request Forgery)[^csrf]는 다른 사이트가 피해자의 브라우저를 이용해 요청을 보내게 하는 공격이다. 그중 **login CSRF**는 피해자를 **공격자 계정으로 로그인시키는** 공격이다. 공격자는 자기 계정으로 로그인을 진행하다가 콜백 주소에 붙을 `code`를 얻고, 그 주소로 피해자의 브라우저를 이동시킨다. 서버가 `state`를 확인하지 않으면 피해자 브라우저에 공격자 계정의 세션이 생기고, 피해자가 그 뒤 입력하는 내용은 공격자 계정에 저장된다.

`state`는 로그인을 시작한 브라우저에만 쿠키(`macfolio_oauth_state`, 10분 유지)로 있으므로, 그 브라우저에서 시작하지 않은 로그인은 3번에서 실패한다. OAuth 2.0 명세(RFC 6749 §10.12)도 이 용도로 `state`를 쓰도록 권고한다[^oauth].

![공격자가 자기 code를 붙인 콜백 주소로 피해자 브라우저를 보내면, state 검사가 없을 때는 공격자 계정의 세션이 발급되고, 있을 때는 쿠키가 없거나 값이 달라 400으로 끝난다](./images/admin-login-github-oauth-login-csrf.svg 'login CSRF가 state 검사에서 막히는 순서 (도식)')

MacFolio는 관리자 계정이 아니면 세션을 만들지 않으므로 공격자 계정의 세션이 생길 수는 없다. 그래도 관리자 판정과 별개로 로그인 절차 자체를 안전하게 두기 위해 `state`를 검사한다.

비교는 [`crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)로 한다. 일반 문자열 비교(`===`)는 첫 글자부터 비교하다 다른 글자를 만나면 바로 끝나므로, 앞부분이 많이 맞을수록 처리 시간이 조금 길어진다. 공격자가 응답 시간을 반복 측정하면 값을 한 글자씩 추측할 수 있다. `timingSafeEqual`은 값이 어디서 다르든 같은 시간을 쓴다.

### 다녀온 뒤의 화면

GitHub에 다녀오면 사이트 전체를 다시 불러온다. 처음 구현에서는 평소처럼 "클릭하여 시작" 로딩 화면이 표시되어 로그인 결과를 알 수 없었다. 지금은 GitHub에서 돌아온 경우 로딩 화면을 건너뛰고, 서버에 로그인 상태를 조회한 뒤 결과 창을 표시한다. 떠나는 시각에도 바로 페이지를 이동하지 않고 "GitHub로 이동하는 중" 안내를 잠시 표시한다.

다시 불러오면 실행 중이던 앱도 모두 종료된다. 창 위치와 크기는 이미 `localStorage`에 저장하고 있으므로, 실행 중인 앱 목록과 맨 앞 창만 떠나기 직전에 `sessionStorage`에 저장한다. `sessionStorage`는 같은 탭 안에서만 유지되는 저장소라, 다른 탭이나 다음 방문에는 영향이 없다. 돌아오면 한 번 읽어 복원한 뒤 삭제한다. 그사이 화면이 데스크톱에서 모바일로 바뀌었으면 복원하지 않는다.

![로그인 결과 창](./images/login-result.jpg '돌아오면 로딩 화면 없이 결과 창이 표시된다. 확인을 누를 때까지 유지된다')

## DB에는 토큰 대신 해시

세션 쿠키에는 추측할 수 없는 무작위 토큰(32바이트를 base64url로 바꾼 43자)을 넣는다. DB에는 그 토큰이 아니라 SHA-256 해시를 저장한다. **해시 함수**는 임의 길이의 입력을 고정 길이 값으로 바꾸는 함수로, 같은 입력은 언제나 같은 값이 되지만 결과에서 입력을 되찾는 계산은 사실상 불가능하다. SHA-256의 결과는 64자 16진수다.

```ts
const token = randomToken();
await this.prisma.adminSession.create({
	data: { tokenHash: hashToken(token), githubLogin: user.login, expiresAt },
});
```

요청이 오면 쿠키의 토큰을 해시해서 조회한다. ==DB 내용이 유출되어도 그 안에는 해시뿐이므로==, 그 값으로 쿠키를 만들어 관리자로 위장할 수 없다. 해시 값을 쿠키에 넣어 보내면 서버가 그 값을 한 번 더 해시하므로 DB의 어느 행과도 일치하지 않는다.

![정상 요청은 쿠키의 토큰을 해시해 DB 행을 찾고, 유출된 해시를 쿠키에 넣은 요청은 한 번 더 해시되어 일치하는 행이 없어 401이 된다](./images/admin-login-github-oauth-token-hash.svg '토큰과 해시의 역할 (도식, 값은 예시)')

비밀번호를 해시로 저장하는 것과 같은 이유다. 다만 비밀번호는 사람이 고른 짧은 값이라 사전에 있는 단어를 차례로 대입하는 공격에 대비해 bcrypt처럼 일부러 느린 해시를 쓴다. 세션 토큰은 이미 2^256가지 중 하나인 무작위 값이라 대입할 후보가 너무 많으므로, 빠른 SHA-256 한 번으로 충분하다.

### JWT 대신 DB 세션

세션을 DB에 저장하는 이유도 있다. **JWT**(JSON Web Token)처럼 서버가 서명한 쿠키만 쓰면, 서버는 서명만 검증하고 별도로 기억하는 상태가 없다. 그래서 ==로그아웃해도 만료 전까지는 그 쿠키가 계속 유효하다==. 로그아웃 직전에 쿠키 사본이 유출됐다면 그 사본은 만료 시각까지 관리자 권한을 가진다. DB 세션은 로그아웃할 때 행을 삭제하므로 같은 쿠키로 다시 인증할 수 없다.

![JWT와 DB 세션의 로그아웃](./images/admin-login-github-oauth-session.svg '로그아웃한 뒤 남은 쿠키 사본이 유효한지가 갈린다')

## 고른 방법과 버린 방법

| 고민        | 버린 방법               | 고른 방법                     | 이유                                                      |
| ----------- | ----------------------- | ----------------------------- | --------------------------------------------------------- |
| 사용자 인증 | 비밀번호                | GitHub OAuth                  | 보관·재설정 기능이 필요 없다. 관리자는 한 명이다          |
| 관리자 비교 | 계정 이름 `hyeoniverse` | 숫자 ID                       | 이름은 변경되고, 버린 이름은 다른 사람이 등록할 수 있다   |
| 세션 보관   | 서명한 쿠키(JWT)        | DB 세션 + 해시                | 로그아웃이 즉시 적용된다. 요청마다 DB 조회 1회는 감당된다 |
| 토큰 해시   | bcrypt 같은 느린 해시   | SHA-256                       | 32바이트 무작위 값이라 사전 공격이 통하지 않는다          |
| 위조 로그인 | 대책 없음               | `state` 쿠키 + 시간 안전 비교 | login CSRF를 막는다                                       |

관리자 ID를 변경하는 경우도 고려했다. 세션 행에 로그인 시각의 GitHub ID를 함께 저장하고, 조회할 때 현재 설정의 관리자 ID와 다시 비교한다. 설정을 바꾸면 이전 관리자의 세션은 행이 남아 있어도 인증되지 않는다.

```ts
if (!session || session.expiresAt <= now || session.githubId !== this.config.auth.adminGithubId) return null;
```

새로 로그인할 때마다 만료된 세션 행을 삭제한다(`deleteMany({ where: { expiresAt: { lte: now } } })`). 관리자가 한 명이라 행이 쌓일 가능성은 낮지만, 별도의 정리 작업을 예약하지 않아도 되게 했다.

## 쿠키 설정

```ts
{ httpOnly: true, sameSite: 'lax', secure: config.auth.secureCookies, maxAge: 12 * 60 * 60 * 1000 }
```

| 속성              | 효과                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `httpOnly`        | 자바스크립트에서 읽을 수 없다. 페이지에 스크립트가 주입되어도 세션 토큰을 탈취하지 못한다          |
| `sameSite: 'lax'` | 다른 사이트에서 보낸 POST 같은 요청에는 첨부되지 않는다. GitHub에서 돌아오는 GET 이동에는 첨부된다 |
| `secure`          | 배포 환경에서는 HTTPS로만 전송한다                                                                 |
| `maxAge` (12시간) | 관리 작업을 하는 동안만 로그인하면 되므로 짧게 설정한다                                            |

예를 들어 `httpOnly`가 없으면 댓글 입력란의 취약점으로 `<script>`가 주입됐을 때 `document.cookie`로 세션 토큰을 읽어 외부로 보낼 수 있다. `httpOnly` 쿠키는 `document.cookie`에 나타나지 않는다. 각 속성의 정의는 [MDN의 Set-Cookie 문서](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)에 있다.

프론트엔드(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)는 호스트는 다르지만 같은 사이트(`hyeoniverse.com`)[^site]이므로 Lax 쿠키가 함께 전송된다. CORS는 프론트엔드 주소만 허용한다.

## 관리자 전용 API는 Guard로

NestJS의 [Guard](https://docs.nestjs.com/guards)는 요청이 컨트롤러 메서드에 도달하기 전에 실행되어, `true`를 돌려주면 통과시키고 `false`나 예외면 요청을 거절하는 클래스다. 관리자만 호출할 수 있는 API에는 `AdminGuard`를 붙인다. 요청마다 쿠키의 세션을 DB에서 확인하고, 없으면 401로 응답한다.

```ts
@Get('me')
@UseGuards(AdminGuard)
me(@CurrentAdmin() admin: AdminIdentity) {
	return admin;
}
```

> [!IMPORTANT]
> 화면에서 편집 버튼을 숨기는 것은 안내일 뿐이다. 버튼이 없어도 누구나 요청을 직접 보낼 수 있으므로, 실제 차단은 이 Guard가 담당한다.

![AdminGuard의 확인 순서](./images/admin-login-github-oauth-guard.svg '앞 단계에서 걸리면 DB까지 가지 않는다')

나중에 PR 미리보기 주소를 열면서 확인 단계를 하나 추가했다([#183](https://github.com/hyeoniverse/MacFolio/pull/183), [미리보기 주소의 CORS](/memo/preview-cors-read-only)). 미리보기는 CORS를 넓게 허용하는데, 거기서 관리자 기능이 열리면 안 된다. 쿠키는 SameSite=Lax라 원래 전송되지 않지만, 브라우저 설정이나 버그로 전송되는 경우에 대비해 Guard가 먼저 `Origin` 헤더를 확인하고 허용한 주소가 아니면 403으로 응답한다.

## 테스트는 GitHub 없이

e2e 시험에서 GitHub에 실제로 로그인할 수는 없다. GitHub에 요청하는 부분을 `GithubClient` 클래스 하나로 모으고, 시험에서는 인가 코드마다 미리 정한 계정을 반환하는 가짜로 교체했다([NestJS 테스트 문서](https://docs.nestjs.com/fundamentals/testing)의 `overrideProvider`). e2e 시험의 가짜는 `admin-code`면 관리자 ID의 계정을, `visitor-code`면 다른 계정(`someone`)을, `impostor-code`면 이름은 `hyeoniverse`이지만 ID가 다른 계정을 돌려준다. 세 번째 코드가 이름을 빼앗긴 상황을 재현한다.

```ts
Test.createTestingModule({ imports: [AppModule] })
	.overrideProvider(GithubClient)
	.useValue(fakeGithub);
```

나머지(state 쿠키, 세션 저장, Guard, 로그아웃)는 실제 PostgreSQL에 연결해 그대로 실행한다. 시험은 세 파일에 20개다.

<details>
<summary>시험 20개 목록</summary>

- `session.test.ts` (3개): 토큰이 매번 다르고 URL에 쓸 수 있는지, 해시가 토큰을 드러내지 않는지, `safeEqual`이 같을 때만 참인지.
- `auth.service.test.ts` (9개): 관리자면 세션을 만들고 DB에는 해시만 저장하는지, 관리자가 아니면 세션이 없는지, **이름이 hyeoniverse여도 ID가 다르면 관리자가 아닌지**, 관리자가 이름을 바꿔도 ID가 같으면 로그인되는지, 만료·로그아웃한 세션을 조회하지 못하는지, 관리자 ID를 바꾸면 이전 세션이 인증되지 않는지, 로그인 주소에 `allow_signup=false`가 붙는지.
- `test/auth.e2e.test.ts` (8개): 로그인을 시작하면 state를 httpOnly 쿠키로 저장하는지, 관리자는 세션 쿠키를 받고 `/auth/me`가 관리자 정보를 반환하는지, `state`가 없거나 다르면 400인지, GitHub 화면에서 취소하면 `cancelled`로 돌아오는지, 허용하지 않은 Origin이면 세션이 유효해도 403인지, 로그아웃한 쿠키로는 401인지.

</details>

## 다른 사람이 시도하면

로그인 버튼은 누구에게나 보인다. 누구든 GitHub 로그인 화면까지는 이동할 수 있지만, 관리자가 아니면 세션 없이 "로그인할 수 없음" 결과로 돌아온다. 탈취할 비밀번호가 없으므로 반복 시도로 얻을 것도 없다.

그래도 로그인 경로(시작, 콜백)에는 IP마다 1분에 10회까지만 허용하는 요청 제한을 걸었다. 자동화된 시도가 서버와 GitHub API에 부하를 주지 않게 하기 위해서다. 같은 IP에서 1분 안에 11번째 요청이 오면 429(Too Many Requests)로 응답한다.

> [!WARNING] X-Forwarded-For 신뢰 범위
> 요청 제한은 IP 단위로 집계하므로, 프록시 뒤에 배치할 때만 `X-Forwarded-For`를 신뢰하도록 설정(`TRUST_PROXY`)으로 별도 활성화한다. 항상 신뢰하면 헤더를 위조해 제한을 우회할 수 있다.

`X-Forwarded-For`는 프록시가 원래 클라이언트의 IP를 적어 넘기는 헤더다. 프록시 없이 서버가 인터넷에 직접 노출된 상태에서 이 헤더를 믿으면, 공격자가 요청마다 `X-Forwarded-For: 1.2.3.4`, `1.2.3.5`처럼 다른 값을 넣어 매번 새로운 IP로 집계되게 할 수 있다.

관리자가 아닌 계정의 시도는 서버 로그에 기록한다.

![시스템 설정의 계정 화면](./images/settings-account.jpg '시스템 설정 → 계정. 로그인한 GitHub 계정과 세션 정보를 표시한다')

## 남은 것, 배운 것

- 세션은 12시간 고정이다. 사용 중에 연장하지 않아서, 오래 편집하면 중간에 다시 로그인해야 한다. 관리 작업이 짧아 아직 불편하지 않다. 계정 화면에 로그인 시각과 만료 시각을 표시하는 것으로 대신했다([계정 화면의 로그인 시각](/memo/settings-signed-in-at)).
- 관리자가 한 명이라 역할(role)을 두지 않았다. 사용자가 늘면 세션 행에 역할을 추가하고 Guard를 나눠야 한다.
- 처음에 계정 이름으로 비교한 것은 "변하지 않는 값으로 사용자를 식별한다"는 원칙을 놓친 결과다. 외부 서비스의 사용자를 식별할 때는 이름·이메일이 아니라 그 서비스가 발급하는 불변 ID를 쓴다.
- 외부 서비스(GitHub)에 요청하는 코드를 클래스 하나로 모은 덕에, 시험에서 그 클래스만 교체하고 나머지는 실제 DB로 실행할 수 있었다.

## 직접 붙여 보기

준비물은 GitHub 계정과 로컬 PostgreSQL(Docker)이다. 순서는 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 '2. GitHub OAuth App'과 [README.md](https://github.com/hyeoniverse/MacFolio/blob/main/README.md)의 로컬 실행 절에 있다.

1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. 콜백 주소는 개발용이 `http://localhost:4000/auth/github/callback`, 배포용이 `https://macfolio-api.hyeoniverse.com/auth/github/callback`이다. OAuth App 하나에 콜백이 하나이므로 두 개를 따로 만든다([GitHub 문서](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)).
2. Client ID와 secret을 `apps/api/.env`의 `GITHUB_CLIENT_ID`·`GITHUB_CLIENT_SECRET`에 넣는다. 관리자는 숫자 ID(`ADMIN_GITHUB_ID`)로 식별한다.
3. 서버를 실행하고 확인한다.

```bash
pnpm --filter @macfolio/api db:up
pnpm dev:all
curl -si http://localhost:4000/auth/github | head -3   # 302면 GitHub로 넘어간다, 503이면 OAuth 값이 없다
```

브라우저에서 Apple 메뉴 → 관리자 로그인을 누르고, `?admin=signed-in`으로 돌아와 시스템 설정 → 계정에 "GitHub로 로그인됨"이 표시되면 성공이다. 로그인 경로 시험은 GitHub 없이 실행된다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/auth.e2e.test.ts
```

> [!TIP] 되돌리는 방법
> OAuth App을 삭제하면(또는 secret을 재발급하면) 즉시 로그인 경로가 막힌다. DB의 세션 행을 삭제하면 이미 로그인한 브라우저도 다음 요청부터 방문자로 처리된다.

<details>
<summary>배포 환경에 처음 연결한 시각에 겪은 두 가지 증상</summary>

서버용 명령(`docker run --env-file /etc/macfolio/api.env …`)을 로컬 컴퓨터에서 실행해 `no such file or directory`가 발생했다. 서버를 모두 실행한 뒤에도 사이트가 "관리자 서버가 아직 연결되지 않았습니다"를 표시하며 로그인 버튼이 비활성화되어 있었다. 원인은 빌드 시각에 번들에 들어가는 `VITE_API_URL`이었고, 그 과정은 [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)에 적었다. 두 증상 모두 `docs/deployment.md`의 '문제 해결' 표에 기록했다.

</details>

## 관련 글

- [정적 사이트의 편집 권한을 useCanEditMemo 하나로 관리자에게만 열기](/memo/read-only-memo)
- [백엔드 설계](/memo/backend-design)
- [모든 쓰기 경로에 요청 제한](/memo/rate-limit-all-writes)
- [미리보기 주소는 읽기만](/memo/preview-cors-read-only)
- [계정 화면의 로그인 시각](/memo/settings-signed-in-at)
- [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)

[^oauth]: [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749). 인가 코드 흐름은 §4.1, `state`로 CSRF를 막는 권고는 §10.12에 있다.

[^rename]: [GitHub 문서: Changing your GitHub username](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username)는 이름을 바꾼 뒤 옛 이름을 다른 사람이 쓸 수 있다고 안내한다.

[^scope]: OAuth에서 앱이 사용자에게 요청하는 권한 범위. scope 없이 요청하면 공개 정보만 읽을 수 있다([GitHub 문서](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)).

[^csrf]: Cross-Site Request Forgery. 다른 사이트가 사용자의 브라우저로 요청을 보내게 하는 공격이다. login CSRF는 그 요청으로 피해자를 공격자 계정에 로그인시킨다([OWASP: Cross Site Request Forgery](https://owasp.org/www-community/attacks/csrf)).

[^site]: 쿠키의 SameSite 판단에서 "사이트"는 등록 가능한 도메인(eTLD+1) 단위다. 하위 도메인이 달라도 `hyeoniverse.com`이 같으면 같은 사이트로 본다([MDN](https://developer.mozilla.org/en-US/docs/Glossary/Site)).

<details>
<summary>참고 문헌</summary>

- [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749)
- [GitHub 문서: Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub 문서: Scopes for OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub 문서: Changing your GitHub username](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-personal-account-settings/changing-your-github-username)
- [OWASP: Cross Site Request Forgery](https://owasp.org/www-community/attacks/csrf)
- [Node.js: crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie)
- [MDN: Site](https://developer.mozilla.org/en-US/docs/Glossary/Site)
- [MDN: X-Forwarded-For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [NestJS: Guards](https://docs.nestjs.com/guards)
- [NestJS: Testing](https://docs.nestjs.com/fundamentals/testing)

</details>

#MacFolio #백엔드 #로그인 #보안
