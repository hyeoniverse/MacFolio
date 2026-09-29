---
title: 정적 사이트에 관리자 로그인 붙이기
date: 2026-09-29
category: 개발기/MacFolio
summary: GitHub OAuth로 내 계정만 관리자로 들여보낸다. 비밀번호는 없고, DB에는 세션 토큰 대신 해시만 둔다.
---

'메모 편집을 관리자만 하게 한 이유' 글에서, 정적 사이트는 브라우저 코드만으로 관리자를 가릴 수 없다고 적었다. 그래서 API 서버(NestJS + Prisma + PostgreSQL)를 만들고 관리자 로그인부터 붙였다.

## 비밀번호 대신 GitHub

관리자는 나 한 명이다. 비밀번호를 만들면 해시해서 보관하고, 잊었을 때 바꾸는 방법도 만들어야 한다. 이미 쓰고 있는 GitHub 계정으로 로그인하면 그럴 필요가 없다.

서버는 GitHub에 "이 사람이 누구냐"만 묻고, 돌아온 계정 이름이 설정해 둔 이름과 같을 때만 관리자로 인정한다.

```ts
if (!sameGithubLogin(user.login, adminGithubLogin)) return null; // 관리자가 아니면 세션을 만들지 않는다
```

공개 프로필만 읽으면 되므로 GitHub에 어떤 권한(scope)도 달라고 하지 않는다. 로그인 화면에서 가입 버튼도 숨긴다(`allow_signup=false`).

## 로그인 흐름

1. 프론트엔드에서 `/auth/github`로 간다. 서버는 무작위 `state`를 만들어 쿠키에 기억하고 GitHub 로그인 화면으로 보낸다.
2. GitHub에서 로그인하면 `/auth/github/callback?code=…&state=…`로 돌아온다.
3. 서버는 쿠키의 `state`와 주소의 `state`가 같은지 본다. 다르면 400으로 끝낸다.
4. `code`를 액세스 토큰으로 바꾸고, 그 토큰으로 계정 이름을 읽는다.
5. 관리자면 세션 쿠키를 주고 프론트엔드로 돌려보낸다.

3번의 `state`가 없으면, 다른 사이트가 자기 `code`를 붙인 콜백 주소로 내 브라우저를 보내 **자기 계정으로 로그인시키는** 공격(login CSRF)을 막을 수 없다. `state`는 로그인을 시작한 브라우저에만 쿠키로 있으므로, 시작하지 않은 로그인은 끝낼 수 없다. 비교는 걸린 시간으로 내용을 짐작할 수 없게 `timingSafeEqual`로 한다.

## DB에는 토큰 대신 해시

세션 쿠키에는 추측할 수 없는 무작위 토큰(32바이트)을 넣는다. DB에는 그 토큰이 아니라 SHA-256 해시를 둔다.

```ts
const token = randomToken();
await this.prisma.adminSession.create({
	data: { tokenHash: hashToken(token), githubLogin: user.login, expiresAt },
});
```

요청이 오면 쿠키의 토큰을 해시해서 찾는다. DB 내용이 새어 나가도 거기 있는 것은 해시뿐이라, 그걸로 쿠키를 만들어 관리자인 척할 수 없다. 비밀번호를 해시로 저장하는 것과 같은 이유다. 다만 토큰은 이미 충분히 긴 무작위 값이라 bcrypt처럼 느린 해시가 필요 없다.

세션을 DB에 두는 이유도 있다. 서명한 쿠키(JWT 같은)만 쓰면 서버가 따로 기억하는 것이 없어서, 로그아웃해도 만료 전까지는 그 쿠키가 계속 통한다. DB 세션은 로그아웃하면 행을 지우므로 같은 쿠키로 다시 들어올 수 없다.

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

화면에서 편집 단추를 숨기는 것은 안내일 뿐이다. 단추를 숨겨도 누군가 직접 요청을 보낼 수 있으니, 실제로 막는 일은 이 Guard가 한다.

## 테스트는 GitHub 없이

e2e 테스트에서 GitHub에 실제로 로그인할 수는 없다. GitHub에 요청하는 부분을 `GithubClient` 클래스 하나로 모아 두고, 테스트에서는 인가 코드마다 정해 둔 계정을 돌려주는 가짜로 바꿨다.

```ts
Test.createTestingModule({ imports: [AppModule] })
	.overrideProvider(GithubClient)
	.useValue(fakeGithub);
```

나머지(state 쿠키, 세션 저장, Guard, 로그아웃)는 실제 PostgreSQL에 붙여 그대로 돌린다. 관리자가 아닌 계정은 세션이 생기지 않는지, `state`를 위조하면 400인지, 로그아웃한 쿠키로는 401인지, DB에 토큰 원문이 없는지까지 확인한다.
