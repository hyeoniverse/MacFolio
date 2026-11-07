---
title: scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글
date: 2026-09-29
category: 개발 기록/MacFolio/서버·API
summary: 가입 없이 이름·비밀번호로 작성하는 블로그 댓글을 추가하며 비밀번호는 scrypt 해시로, IP는 앞 두 자리와 HMAC으로만 저장했다. 응답 필드를 select로 제한하고 검사 규칙을 화면·서버가 공유하게 했다. 사흘 뒤 방문자 쿠키 방식으로 바뀐 과정도 정리한다.
---

블로그 글 아래에 댓글 기능을 추가했다([PR #43](https://github.com/hyeoniverse/MacFolio/pull/43)). 방문자에게 가입을 요구할 수 없으므로, 오래된 커뮤니티 게시판의 비회원 글쓰기처럼 이름과 비밀번호를 입력해 작성하고 같은 비밀번호로 삭제한다. 관리자로 로그인한 경우에는 비밀번호 없이 작성자 이름으로 작성하고 모든 댓글을 삭제할 수 있다.

![글 아래 댓글](./images/comments.jpg '방문자는 이름 뒤에 IP 앞 두 자리가 붙고, 작성자 댓글에는 GitHub 사진과 표시가 붙는다')

## 배경

### 설계 기준: 서버가 보관하는 개인 정보 최소화

로그인이 없는 대신, 서버가 보관하는 개인 정보를 최소화하기로 했다. 이 사이트의 첫 방명록은 Firebase에 비밀번호를 평문(암호화하지 않은 원래 문자열)으로 저장하고, 데이터베이스를 누구나 읽을 수 있게 공개했다. 방문자가 다른 사이트에서도 같은 비밀번호를 쓴다면, 방명록 데이터 하나로 그 사이트 계정까지 위험해진다. 같은 문제를 반복하지 않는 것이 설계 기준이었다.

댓글 요청 하나에서 서버가 받는 값과, 그 가운데 DB에 원문으로 남기는 값은 다음과 같다.

![받은 것과 남는 것](./images/post-comments-stored.svg '비밀번호와 IP 원문은 저장하지 않는다')

### 댓글 수집 방식 비교

| 방법                                                  | 장점                                        | 단점                                                                   |
| ----------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| 외부 댓글 서비스(GitHub Discussions 기반 등)          | 서버 코드가 없다                            | 방문자에게 GitHub 계정이 필요하다. 외부 스크립트를 CSP에 허용해야 한다 |
| 방문자 회원 가입                                      | 작성자를 확실히 식별한다                    | 댓글 하나를 쓰려고 가입하는 방문자는 드물다                            |
| **이름·비밀번호로 작성, 같은 비밀번호로 삭제** (채택) | 가입 없이 작성하고, 본인 댓글은 본인이 삭제 | 비밀번호와 IP의 저장 방식을 정해야 한다                                |

CSP(Content Security Policy)는 페이지가 어느 주소의 스크립트·이미지·프레임을 불러올 수 있는지 서버가 응답 헤더로 지정하는 보안 규칙이다. 외부 댓글 서비스를 쓰면 그 서비스의 스크립트 주소를 이 목록에 추가해야 한다.

## 비밀번호: 해시만 저장

### 해시와 salt

해시 함수는 임의 길이의 입력을 고정 길이 값으로 바꾸는 함수다. 같은 입력은 항상 같은 값이 되고, 결과에서 입력을 거꾸로 계산할 수 없다. 서버는 비밀번호 원문 대신 해시를 저장하고, 삭제 요청이 오면 입력된 비밀번호를 같은 방법으로 해시해 저장 값과 비교한다. DB가 유출돼도 공격자가 얻는 것은 해시뿐이다.

다만 해시만으로는 두 가지 공격을 막지 못한다.

| 공격                | 방법                                                               | 대응                                       |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| 미리 계산한 표 대조 | 흔한 비밀번호 수백만 개의 해시를 미리 계산해 두고 유출된 값과 대조 | 댓글마다 다른 무작위 값(salt)을 섞는다     |
| 무작위 대입         | 후보 비밀번호를 하나씩 해시해 비교                                 | 해시 한 번의 계산 비용을 의도적으로 높인다 |

SHA-256 같은 범용 해시는 빠르게 계산하도록 설계되어, GPU 한 대로 초당 수십억 번을 계산할 수 있다. 비밀번호 저장에는 반대로 ==한 번 계산하는 데 시간과 메모리가 많이 드는 해시==가 필요하다. [scrypt](https://www.rfc-editor.org/rfc/rfc7914)는 계산 중에 큰 메모리 영역을 반복해서 읽도록 설계되어, 메모리가 작은 GPU나 전용 하드웨어로 병렬 계산하기 어렵다.

### 저장 형식과 검증 순서

비밀번호는 Node.js 내장 [`crypto.scrypt`](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)로 해시해 저장한다. 댓글마다 새 salt[^salt]를 생성하므로, 두 방문자가 모두 `sky1234`를 입력해도 저장 값은 서로 다르다. 저장 값에는 알고리즘 이름과 salt, 해시를 `$`로 연결해 함께 보관한다.

```ts
// rules.ts: scrypt$<salt>$<hash>
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scrypt(password, salt, 32);
	return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
	const [kind, salt, hash] = stored?.split('$') ?? [];
	if (kind !== 'scrypt' || !salt || !hash) return false;
	const expected = Buffer.from(hash, 'base64');
	const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length);
	return timingSafeEqual(actual, expected);
}
```

![scrypt 저장과 검증](./images/post-comments-scrypt.svg '작성 시각에는 새 salt로 해시를 만들어 문자열 하나로 저장하고, 삭제 시각에는 저장 값에서 salt를 꺼내 같은 계산을 반복한 뒤 비교한다')

bcrypt 대신 scrypt를 선택한 이유는 Node.js 내장 `crypto` 모듈에 포함되어 있어 네이티브 패키지를 별도로 빌드할 필요가 없기 때문이다. bcrypt를 쓰려면 C++ 네이티브 애드온인 `bcrypt` 패키지를 설치해야 하고, 실행 환경에 맞는 미리 빌드된 바이너리가 없으면 Docker 이미지 빌드 단계에서 컴파일한다. 두 알고리즘 모두 의도적으로 계산 비용을 높인 해시이므로, DB가 유출되어도 무작위 대입으로 비밀번호를 찾기 어렵다.

### timingSafeEqual을 쓰는 이유

두 바이트 배열을 비교하는 일반적인 코드는 앞에서부터 한 바이트씩 비교하다가 처음 다른 바이트에서 `false`를 반환한다. 이 방식은 앞부분이 많이 맞을수록 비교가 늦게 끝나므로, 공격자가 응답 시간을 반복 측정하면 몇 바이트가 맞았는지 추정할 수 있다. 이런 공격을 타이밍 공격(timing attack)이라고 한다.

![일반 비교와 상수 시간 비교](./images/post-comments-timing.svg '일반 비교는 앞부분이 많이 맞을수록 늦게 끝난다. timingSafeEqual은 길이가 같으면 항상 모든 바이트를 비교한다')

[`crypto.timingSafeEqual`](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)은 두 값이 어디서 달라지든 같은 시간이 걸리도록 모든 바이트를 비교한다. 이 댓글 기능에서는 비교 대상이 scrypt 결과라 공격자가 바이트를 하나씩 맞춰 가기도 어렵지만, 비용이 거의 없으므로 기본값으로 사용했다.

## IP: 앞 두 자리와 HMAC만 저장

### 앞 두 자리 표시

이름만으로는 작성자를 구분하기 어렵다. 누구나 같은 이름을 입력할 수 있기 때문이다. 그래서 이름 뒤에 IP 앞 두 자리를 붙인다. IPv4 주소 `211.234.56.78`이면 `민수(211.234)`로 표시하고, IPv6 주소는 앞 두 묶음(`2001:db8`)을 사용한다(`maskIp`). 같은 사람이 이름을 바꿔 가며 작성하는 경우를 어느 정도 식별할 수 있고, 앞 두 자리는 통신사나 지역 단위로 수많은 사용자가 공유하므로 이 정보만으로는 개인을 특정할 수 없다.

### 전체 IP는 HMAC으로

IP 전체는 저장하지 않는다. 같은 사람이 작성한 댓글을 묶어 조회해야 하는 경우(예: 한 사람이 광고 댓글을 반복 작성)를 위해, 서버만 아는 키로 계산한 HMAC 값만 저장한다.

IP를 키 없이 SHA-256으로 해시하면 안 되는 이유는 입력 범위가 좁기 때문이다. IPv4 주소는 2³²개(약 43억 개)뿐이므로, 공격자는 모든 주소의 해시를 계산해 유출된 값과 대조하면 원래 IP를 찾는다. [HMAC](https://www.rfc-editor.org/rfc/rfc2104)은 해시 계산에 비밀 키를 섞는 방식이다. ==키를 모르면 대조할 값을 만들 수 없으므로 HMAC 값에서 IP를 복원할 수 없다==. 서버 안에서는 같은 IP가 항상 같은 HMAC 값이 되므로 댓글 묶음 조회는 그대로 가능하다.

![키 없는 해시와 HMAC](./images/post-comments-hmac.svg '키 없는 해시는 43억 개 주소를 모두 대입하면 되돌릴 수 있다. HMAC은 서버의 키 없이는 대입할 값을 만들 수 없다')

```ts
export const hashIp = (ip: string, secret: string) => createHmac('sha256', secret).update(ip).digest('hex');
```

> [!IMPORTANT] IP_HASH_SECRET 필수
> 이 키(`IP_HASH_SECRET`)를 배포 환경에 설정하지 않으면 서버가 시작되지 않는다.

### 저장 값과 응답 필드

| 입력               | DB에 저장하는 값                        | API 응답 |
| ------------------ | --------------------------------------- | -------- |
| 이름, 내용         | `name`, `body`                          | 포함     |
| 비밀번호           | `passwordHash` (`scrypt$<salt>$<hash>`) | 제외     |
| IP `211.234.56.78` | `ipPrefix` `211.234`                    | 포함     |
| IP `211.234.56.78` | `ipHash` (HMAC-SHA256)                  | 제외     |

API 응답에는 IP 해시와 비밀번호 해시를 포함하지 않는다. ==Prisma 쿼리에서 필요한 필드만 지정해 조회하므로==([`select`](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)) 실수로 노출될 경로가 없다. Prisma는 기본적으로 행의 모든 열을 반환하므로, 응답을 만들 때 해시 필드를 빼는 방식은 한 곳만 빠뜨려도 해시가 노출된다. `select`는 반대로 조회 단계에서 지정한 열만 읽는다. e2e 시험은 응답의 필드 목록이 정확히 `id, name, ipPrefix, isAdmin, body, createdAt`인지 확인한다.

## 검사 규칙 공유

| 항목     | 규칙                                   |
| -------- | -------------------------------------- |
| 이름     | 1~20자. 방문자는 작성자 이름 사용 불가 |
| 비밀번호 | 4~20자                                 |
| 내용     | 1~500자                                |

메시지 앱의 피드백과 같은 규칙이므로, 화면은 메시지 앱의 검사 함수를 그대로 재사용하고 서버는 같은 규칙을 다시 검사한다. ==화면에서 막아도 요청은 직접 전송할 수 있기 때문이다==. 예를 들어 `curl -X POST …/comments -d '{"name":"","body":"…"}'`처럼 화면을 거치지 않은 요청도 서버가 400으로 거절한다.

## 도배와 무작위 대입 방지

작성과 삭제에는 IP마다 1분에 5회(`COMMENT_RATE_LIMIT`, 기본값 5)까지 허용하는 요청 제한을 적용했다([NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)의 `comment` 제한). 6번째 요청부터는 1분이 지날 때까지 `429 Too Many Requests`로 응답한다.

| 효과             | 예                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| 도배 속도 제한   | 스크립트로 광고 댓글을 연속 작성해도 1분에 5건까지만 저장된다                                  |
| 무작위 대입 지연 | 다른 사람 댓글의 비밀번호를 4자리 숫자(1만 가지)로 추측하면, 전부 시도하는 데 2,000분이 걸린다 |

로그인 경로의 제한(`login`)과는 별도로 집계한다. 로그인 시도가 많다는 이유로 댓글 작성이 막히거나, 그 반대가 되면 안 되기 때문이다.

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
- API 통합 시험 `apps/api/test/comments.e2e.test.ts`: "방문자는 이름·비밀번호로 쓰고, 누구나 읽는다. 응답에 비밀번호·IP 해시가 없다", "비밀번호가 맞아야 지운다 (틀리면 403, 없으면 404)", "관리자는 비밀번호 없이 김정현으로 쓰고, 방문자 댓글도 지운다". 요청 제한은 `comments-throttle.e2e.test.ts`의 "IP마다 1분에 정한 횟수를 넘으면 429, 읽기는 막지 않는다"가 확인한다.
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

==원문을 저장하지 않는 원칙은 그대로 유지됐다==. 쿠키 값도 원문이 아니라 HMAC으로만 DB에 저장한다.

## 남은 과제와 정리

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

## 관련 글

- [httpOnly 방문자 쿠키의 HMAC 해시로 가입 없이 방문자 식별하기](/memo/visitor-identity)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes)
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)

<details>
<summary>참고 문헌</summary>

- Node.js, [crypto.scrypt()](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback)
- Node.js, [crypto.timingSafeEqual()](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- Node.js, [crypto.createHmac()](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
- RFC 7914, [The scrypt Password-Based Key Derivation Function](https://www.rfc-editor.org/rfc/rfc7914)
- RFC 2104, [HMAC: Keyed-Hashing for Message Authentication](https://www.rfc-editor.org/rfc/rfc2104)
- OWASP, [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- MDN, [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- MDN, [429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- NestJS, [Rate Limiting](https://docs.nestjs.com/security/rate-limiting)
- Prisma, [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields)

</details>

[^salt]: 해시 계산 전에 비밀번호에 덧붙이는 무작위 값(여기서는 16바이트). 같은 비밀번호도 salt가 다르면 해시 값이 달라지므로, 미리 계산한 해시 표(레인보우 테이블)로 여러 계정을 한꺼번에 대조할 수 없다.

#MacFolio #백엔드 #댓글 #보안
