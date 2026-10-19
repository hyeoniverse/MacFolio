---
title: 댓글에 남기지 않은 것들
date: 2026-09-29
category: 개발기/MacFolio/백엔드
summary: 가입 없이 이름·비밀번호로 쓰는 블로그 댓글을 붙이며 비밀번호는 scrypt 해시로, IP는 앞 두 자리와 HMAC으로만 남겼다. 응답 칸을 고르고 규칙을 화면·서버가 함께 쓰게 했다. 사흘 뒤 방문자 쿠키 방식으로 바뀐 이야기도 적는다.
---

블로그 글 아래에 댓글을 붙였다. 방문자에게 가입을 시킬 수는 없으니, 예전 게시판처럼 이름과 비밀번호로 쓰고 같은 비밀번호로 지운다. 관리자로 로그인했으면 비밀번호 없이 작성자로 쓰고 무엇이든 지운다.

![글 아래 댓글](./images/comments.jpg '방문자는 이름 뒤에 IP 앞 두 자리가 붙고, 작성자 댓글에는 GitHub 사진과 표시가 붙는다')

로그인이 없는 대신, 서버가 들고 있는 것을 최대한 줄이기로 했다. 이 사이트의 첫 방명록이 Firebase에 비밀번호를 평문으로 두고 누구나 읽을 수 있게 열어 두었던 것을 기억하기 때문이다.

## 무엇으로 댓글을 받을까

| 방법                                               | 좋은 점                            | 문제                                                               |
| -------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| 바깥 댓글 서비스(GitHub 토론 기반 등)를 붙인다     | 서버 코드가 없다                   | 방문자가 GitHub 계정이 있어야 한다. 바깥 스크립트가 CSP에 들어온다 |
| 방문자에게 가입을 받는다                           | 누가 썼는지 확실하다               | 블로그 댓글 하나 쓰려고 가입하지 않는다                            |
| 이름·비밀번호로 쓰고 같은 비밀번호로 지운다 (고름) | 가입 없이, 자기 글은 자기가 지운다 | 비밀번호와 IP를 어떻게 남길지 정해야 한다                          |

이 글은 세 번째를 고른 날의 기록이다([PR #43](https://github.com/hyeoniverse/MacFolio/pull/43)).

![받은 것과 남는 것](./images/post-comments-stored.svg '비밀번호와 IP 원문은 저장하지 않는다')

## 비밀번호: 해시만

비밀번호는 Scrypt로 해시해서 둔다. 댓글마다 새 salt를 쓰므로 같은 비밀번호라도 저장된 값이 다르다. 지울 때는 받은 비밀번호를 같은 salt로 해시해 비교하고, 비교는 걸린 시간으로 내용을 짐작할 수 없게 `timingSafeEqual`로 한다.

```ts
// scrypt$<salt>$<hash>
const salt = randomBytes(16);
const hash = await scrypt(password, salt, 32);
return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
```

Bcrypt 대신 Scrypt를 고른 것은 Node에 들어 있어서 네이티브 패키지를 따로 빌드할 필요가 없기 때문이다. 둘 다 일부러 느리게 만든 해시라, DB가 새어 나가도 비밀번호를 하나씩 맞혀 보기가 어렵다.

## IP: 앞 두 자리와 해시만

이름만으로는 누가 누군지 가리기 어렵다. 그래서 이름 뒤에 IP 앞 두 자리를 붙인다(`민수(211.234)`). 같은 사람이 이름을 바꿔 가며 쓰는 것을 어느 정도 알아볼 수 있고, 그 정도로는 사람을 특정할 수 없다.

IP 전체는 저장하지 않는다. 같은 사람이 쓴 댓글을 묶어 봐야 할 때를 위해, 서버만 아는 키로 HMAC한 값만 둔다. 키를 모르면 IP로 되돌릴 수 없다. 이 키는 배포에서 설정하지 않으면 서버가 아예 시작하지 않게 했다.

```ts
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');
```

API 응답에는 이 해시도, 비밀번호 해시도 담지 않는다. 필요한 칸만 골라 읽어서(`select`) 실수로 흘릴 일이 없게 했다. e2e 테스트는 응답의 필드 목록이 정확히 `id, name, ipPrefix, isAdmin, body, createdAt`인지 확인한다.

## 규칙은 한 곳에서

이름 1~20자, 비밀번호 4~20자, 내용 1~500자, 방문자는 작성자 이름을 쓸 수 없다. 메시지 앱의 피드백과 같은 규칙이라, 화면은 메시지 앱의 검사 함수를 그대로 가져다 쓰고 서버는 같은 규칙을 다시 검사한다. 화면에서 막아도 요청은 직접 보낼 수 있기 때문이다.

## 도배와 무작위 대입

쓰기와 지우기에는 IP마다 1분에 5번까지 받는 요청 제한을 걸었다. 도배를 늦추고, 남의 댓글 비밀번호를 여러 번 넣어 보는 것도 늦춘다. 로그인 경로의 제한과는 따로 센다. 로그인 시도가 많다고 댓글을 못 쓰거나, 그 반대가 되면 안 되기 때문이다.

## 관리자는 세션으로

관리자는 비밀번호를 넣지 않는다. 서버가 요청의 세션 쿠키로 관리자인지 보고, 관리자면 이름을 작성자로 바꿔 쓴다. 방문자가 이름 칸에 작성자 이름을 넣어도 거절되고, 관리자 댓글은 방문자가 비밀번호로 지울 수 없다.

## 확인

첫 커밋(`784db3f1c`)은 24개 파일을 고쳤다. 서버(`apps/api/src/comments/`)와 화면(`apps/react/src/apps/memo/comments/`), 그리고 시험 다섯 파일이다.

- 규칙 단위 시험 `apps/api/src/comments/rules.test.ts`: "메시지 앱과 같은 규칙. 이유를 모두 모은다", "방문자는 관리자 이름을 쓸 수 없다", "앞 두 자리만 보인다", "해시는 키마다 다르고 IP를 드러내지 않는다", "맞는 비밀번호만 통과하고, 같은 비밀번호도 해시는 매번 다르다".
- API 통합 시험 `apps/api/test/comments.e2e.test.ts`: "방문자는 이름·비밀번호로 쓰고, 누구나 읽는다. 응답에 비밀번호·IP 해시가 없다", "비밀번호가 맞아야 지운다 (틀리면 403, 없으면 404)", "관리자는 비밀번호 없이 김정현으로 쓰고, 방문자 댓글도 지운다". 요청 제한은 `comments-throttle.e2e.test.ts`의 "IP마다 1분에 정한 횟수를 넘으면 429, 읽기는 막지 않는다"가 본다.
- 화면 E2E `apps/react/e2e/memo-comments.spec.ts`: "방문자는 이름·비밀번호로 쓰고, 같은 비밀번호로 지운다", "서버가 없으면 댓글 대신 안내만 보인다".

## 사흘 뒤: 이름과 비밀번호를 없앴다

10월 2일, 메시지 앱을 서버에 저장하게 바꾸면서 댓글도 같은 방식으로 바꿨다. 이름과 비밀번호를 받지 않고, 처음 쓴 브라우저에 방문자 쿠키를 주어 그 쿠키로 이름을 정하고 자기 댓글을 지운다([이름·비밀번호 없이 쓰는 메시지와 댓글](/memo/visitor-identity)).

|                | 이 글 (9월 29일)  | 지금                                            |
| -------------- | ----------------- | ----------------------------------------------- |
| 누가 썼는지    | 이름 + 비밀번호   | 방문자 쿠키의 HMAC(`visitorHash`)               |
| 지우기         | 같은 비밀번호     | 같은 브라우저(쿠키)                             |
| `passwordHash` | 새 댓글마다       | 예전 댓글에만 남는다. 그 댓글은 관리자만 지운다 |
| IP             | 앞 두 자리 + HMAC | 그대로                                          |

원문을 남기지 않는 원칙은 그대로 이어졌다. 쿠키 값도 원문이 아니라 HMAC으로만 DB에 둔다.

## 남은 것·배운 것

- 비밀번호 방식은 사흘 만에 바뀌었지만, "서버가 들고 있는 것을 줄인다"는 결정 덕분에 바꿀 때 지울 개인 정보가 거의 없었다. 원문 IP나 평문 비밀번호를 남겼다면 마이그레이션으로 지워야 했다.
- 응답 칸을 `select`로 고르고 시험이 칸 목록을 정확히 비교하게 한 것이 가장 값싼 안전장치였다. 칸이 늘어나면 시험이 먼저 깨진다.
- 요청 제한은 뒤에 쓰기 경로 전체로 넓혔다([쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)).

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test -- src/comments/rules.test.ts
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
cd apps/react && npx playwright test e2e/memo-comments.spec.ts
```

서버 E2E는 [apps/api/test/comments.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/comments.e2e.test.ts)에서 해시만 남는지, 요청 제한이 걸리는지를 본다. 배포 서버에서는 `api.env`의 `IP_HASH_SECRET`이 없으면 서버가 뜨지 않는다(`openssl rand -hex 32`로 만든다, [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 `api.env` 표).

참고 문서: [Node.js crypto.scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [NestJS 요청 제한](https://docs.nestjs.com/security/rate-limiting).

## 관련 글

- [이름·비밀번호 없이 쓰는 메시지와 댓글](/memo/visitor-identity)
- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)
- [서버가 없으면 메시지 앱을 열지 않기](/memo/messages-offline)

#MacFolio #백엔드 #댓글 #보안
