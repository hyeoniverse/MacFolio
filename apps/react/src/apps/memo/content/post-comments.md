---
title: scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글
date: 2026-09-29
category: 개발 기록/MacFolio/백엔드
summary: 가입 없이 이름·비밀번호로 작성하는 블로그 댓글을 추가하며 비밀번호는 scrypt 해시로, IP는 앞 두 자리와 HMAC으로만 저장했다. 응답 필드를 select로 제한하고 검사 규칙을 화면·서버가 공유하게 했다. 사흘 뒤 방문자 쿠키 방식으로 바뀐 과정도 정리한다.
---

블로그 글 아래에 댓글 기능을 추가했다([PR #43](https://github.com/hyeoniverse/MacFolio/pull/43)). 방문자에게 가입을 요구할 수 없으므로, 기존 게시판처럼 이름과 비밀번호로 작성하고 같은 비밀번호로 삭제한다. 관리자로 로그인한 경우에는 비밀번호 없이 작성자 이름으로 작성하고 모든 댓글을 삭제할 수 있다.

![글 아래 댓글](./images/comments.jpg '방문자는 이름 뒤에 IP 앞 두 자리가 붙고, 작성자 댓글에는 GitHub 사진과 표시가 붙는다')

로그인이 없는 대신, 서버가 보관하는 개인 정보를 최소화하기로 했다. 이 사이트의 첫 방명록은 Firebase에 비밀번호를 평문으로 저장하고 누구나 읽을 수 있게 공개했다. 같은 문제를 반복하지 않는 것이 설계 기준이었다.

## 댓글 수집 방식

| 방법                                                  | 장점                                        | 단점                                                                   |
| ----------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| 외부 댓글 서비스(GitHub Discussions 기반 등)          | 서버 코드가 없다                            | 방문자에게 GitHub 계정이 필요하다. 외부 스크립트를 CSP에 허용해야 한다 |
| 방문자 회원 가입                                      | 작성자를 확실히 식별한다                    | 댓글 하나를 쓰려고 가입하는 방문자는 드물다                            |
| **이름·비밀번호로 작성, 같은 비밀번호로 삭제** (채택) | 가입 없이 작성하고, 본인 댓글은 본인이 삭제 | 비밀번호와 IP의 저장 방식을 정해야 한다                                |

![받은 것과 남는 것](./images/post-comments-stored.svg '비밀번호와 IP 원문은 저장하지 않는다')

## 비밀번호: 해시만 저장

비밀번호는 [scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)로 해시해 저장한다. 댓글마다 새 salt[^salt]를 생성하므로 같은 비밀번호라도 저장 값이 다르다. 삭제 요청 시각에는 입력된 비밀번호를 같은 salt로 해시해 비교하고, 비교에는 [`timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)을 사용해 응답 시간으로 값을 추측할 수 없게 한다.

```ts
// scrypt$<salt>$<hash>
const salt = randomBytes(16);
const hash = await scrypt(password, salt, 32);
return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
```

bcrypt 대신 scrypt를 선택한 이유는 Node.js 내장 `crypto` 모듈에 포함되어 있어 네이티브 패키지를 별도로 빌드할 필요가 없기 때문이다. 두 알고리즘 모두 의도적으로 계산 비용을 높인 해시이므로, DB가 유출되어도 무작위 대입으로 비밀번호를 찾기 어렵다.

## IP: 앞 두 자리와 HMAC만 저장

이름만으로는 작성자를 구분하기 어렵다. 그래서 이름 뒤에 IP 앞 두 자리를 붙인다(`민수(211.234)`). 같은 사람이 이름을 바꿔 가며 작성하는 경우를 어느 정도 식별할 수 있고, 이 정보만으로는 개인을 특정할 수 없다.

IP 전체는 저장하지 않는다. 같은 사람이 작성한 댓글을 묶어 조회해야 하는 경우를 위해, 서버만 아는 키로 계산한 HMAC 값만 저장한다. 키를 모르면 HMAC 값에서 IP를 복원할 수 없다. 이 키(`IP_HASH_SECRET`)를 배포 환경에 설정하지 않으면 서버가 시작되지 않는다.

```ts
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');
```

| 입력               | DB에 저장하는 값                        | API 응답 |
| ------------------ | --------------------------------------- | -------- |
| 이름, 내용         | `name`, `body`                          | 포함     |
| 비밀번호           | `passwordHash` (`scrypt$<salt>$<hash>`) | 제외     |
| IP `211.234.56.78` | `ipPrefix` `211.234`                    | 포함     |
| IP `211.234.56.78` | `ipHash` (HMAC-SHA256)                  | 제외     |

API 응답에는 IP 해시와 비밀번호 해시를 포함하지 않는다. Prisma 쿼리에서 필요한 필드만 지정해 조회하므로([`select`](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)) 실수로 노출될 경로가 없다. e2e 시험은 응답의 필드 목록이 정확히 `id, name, ipPrefix, isAdmin, body, createdAt`인지 확인한다.

## 검사 규칙 공유

| 항목     | 규칙                                   |
| -------- | -------------------------------------- |
| 이름     | 1~20자. 방문자는 작성자 이름 사용 불가 |
| 비밀번호 | 4~20자                                 |
| 내용     | 1~500자                                |

메시지 앱의 피드백과 같은 규칙이므로, 화면은 메시지 앱의 검사 함수를 그대로 재사용하고 서버는 같은 규칙을 다시 검사한다. 화면에서 막아도 요청은 직접 전송할 수 있기 때문이다.

## 도배와 무작위 대입 방지

작성과 삭제에는 IP마다 1분에 5회(`COMMENT_RATE_LIMIT`, 기본값 5)까지 허용하는 요청 제한을 적용했다([NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)의 `comment` 제한). 도배 속도를 늦추고, 다른 사람의 댓글 비밀번호를 반복 입력하는 무작위 대입도 늦춘다. 로그인 경로의 제한(`login`)과는 별도로 집계한다. 로그인 시도가 많다는 이유로 댓글 작성이 막히거나, 그 반대가 되면 안 되기 때문이다.

```ts
// 요청 제한 (IP마다 1분에): 로그인, 댓글. 경로마다 ThrottlerGuard를 걸고 해당하지 않는 제한은 건너뛴다
ThrottlerModule.forRootAsync({
	inject: [APP_CONFIG],
	useFactory: (config: AppConfig) => [
		{ name: 'login', ttl: 60_000, limit: config.auth.loginRateLimit },
		{ name: 'comment', ttl: 60_000, limit: config.commentRateLimit },
	],
}),
```

## 관리자는 세션으로 식별

관리자는 비밀번호를 입력하지 않는다. 서버가 요청의 세션 쿠키로 관리자 여부를 확인하고, 관리자이면 이름을 작성자 이름으로 바꿔 저장한다. 방문자가 이름 칸에 작성자 이름을 입력하면 거절되고, 관리자 댓글은 방문자가 비밀번호로 삭제할 수 없다.

## 시험

첫 커밋(`784db3f1c`)은 24개 파일을 수정했다(1,233줄 추가, 13줄 삭제). 서버(`apps/api/src/comments/`), 화면(`apps/react/src/apps/memo/comments/`), 그리고 시험 다섯 파일이다.

<details>
<summary>시험 이름 전체</summary>

- 규칙 단위 시험 `apps/api/src/comments/rules.test.ts`: "메시지 앱과 같은 규칙. 이유를 모두 모은다", "방문자는 관리자 이름을 쓸 수 없다", "앞 두 자리만 보인다", "해시는 키마다 다르고 IP를 드러내지 않는다", "맞는 비밀번호만 통과하고, 같은 비밀번호도 해시는 매번 다르다".
- API 통합 시험 `apps/api/test/comments.e2e.test.ts`: "방문자는 이름·비밀번호로 쓰고, 누구나 읽는다. 응답에 비밀번호·IP 해시가 없다", "비밀번호가 맞아야 지운다 (틀리면 403, 없으면 404)", "관리자는 비밀번호 없이 김정현으로 쓰고, 방문자 댓글도 지운다". 요청 제한은 `comments-throttle.e2e.test.ts`의 "IP마다 1분에 정한 횟수를 넘으면 429, 읽기는 막지 않는다"가 본다.
- 화면 E2E `apps/react/e2e/memo-comments.spec.ts`: "방문자는 이름·비밀번호로 쓰고, 같은 비밀번호로 지운다", "서버가 없으면 댓글 대신 안내만 보인다".

</details>

## 사흘 뒤: 이름과 비밀번호 제거

10월 2일, 메시지 앱을 서버 저장 방식으로 바꾸면서 댓글도 같은 방식으로 변경했다([PR #69](https://github.com/hyeoniverse/MacFolio/pull/69)). 이름과 비밀번호를 입력받지 않고, 처음 작성한 브라우저에 방문자 쿠키를 발급해 그 쿠키로 이름을 정하고 본인 댓글을 삭제한다([httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기](/memo/visitor-identity)).

|                | 이 글 (9월 29일)  | 현재                                                 |
| -------------- | ----------------- | ---------------------------------------------------- |
| 작성자 식별    | 이름 + 비밀번호   | 방문자 쿠키의 HMAC(`visitorHash`)                    |
| 삭제 권한      | 같은 비밀번호     | 같은 브라우저(쿠키)                                  |
| `passwordHash` | 새 댓글마다 저장  | 이전 댓글에만 남아 있다. 그 댓글은 관리자만 삭제한다 |
| IP             | 앞 두 자리 + HMAC | 변경 없음                                            |

원문을 저장하지 않는 원칙은 그대로 유지됐다. 쿠키 값도 원문이 아니라 HMAC으로만 DB에 저장한다.

## 남은 것·배운 것

- 비밀번호 방식은 사흘 만에 바뀌었지만, "서버가 보관하는 정보를 최소화한다"는 결정 덕분에 전환 시각에 삭제할 개인 정보가 거의 없었다. 원문 IP나 평문 비밀번호를 저장했다면 마이그레이션으로 삭제해야 했다.
- 응답 필드를 `select`로 제한하고 시험이 필드 목록을 정확히 비교하게 한 것이 비용이 가장 낮은 안전장치였다. 필드가 추가되면 시험이 먼저 실패한다.
- 요청 제한은 이후 모든 쓰기 경로로 확대했다([@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)).

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test -- src/comments/rules.test.ts
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
cd apps/react && npx playwright test e2e/memo-comments.spec.ts
```

서버 E2E [apps/api/test/comments.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/comments.e2e.test.ts)는 해시만 저장되는지, 요청 제한이 적용되는지 확인한다. 배포 서버에서는 `api.env`의 `IP_HASH_SECRET`이 없으면 서버가 시작되지 않는다(`openssl rand -hex 32`로 생성, [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 `api.env` 표).

참고 문서: [Node.js crypto.scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [Node.js crypto.createHmac](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options), [NestJS 요청 제한](https://docs.nestjs.com/security/rate-limiting), [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## 관련 글

- [httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기](/memo/visitor-identity)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)

[^salt]: 해시 계산 전에 비밀번호에 덧붙이는 무작위 값(여기서는 16바이트). 같은 비밀번호도 salt가 다르면 해시 값이 달라지므로, 미리 계산한 해시 표(레인보우 테이블)로 여러 계정을 한꺼번에 대조할 수 없다.

#MacFolio #백엔드 #댓글 #보안
