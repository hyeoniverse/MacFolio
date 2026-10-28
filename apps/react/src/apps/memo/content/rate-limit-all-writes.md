---
title: @RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기
date: 2026-10-09
category: 개발 기록/MacFolio/품질
summary: 요청 제한 방식이 세 가지로 나뉘어 있었고 글 작성·파일 업로드·분석 이벤트에는 1분 제한이 없었다. 제한 이름 7개를 한 파일에 정의하고 쓰기 경로 33개에 @RateLimit 한 줄로 적용했다. 가드 순서를 한 번 잘못 지정했고, 누락된 경로와 순서는 경로 표 시험이 검출한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "요청 제한을 한 방식으로"를 처리한 기록이다([PR #162](https://github.com/hyeoniverse/MacFolio/pull/162)). 이전 글([Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test))에서 만든 경로 표에 제한 열을 추가하는 작업이기도 하다.

## 세 가지로 나뉘어 있던 제한

| 경로                                                             | 제한                                            |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| 로그인 시작·콜백                                                 | `ThrottlerGuard`, IP당 1분에 10회               |
| 댓글·메시지 작성·삭제                                            | `ThrottlerGuard`, IP당 1분에 5회                |
| 좋아요 추가·취소                                                 | `ThrottlerGuard`, IP당 1분에 30회               |
| AI 데모 (요약·번역·음성·커버)                                    | 서비스 내부의 일일 할당량 (IP당 3회, 전체 50회) |
| 메일 발송                                                        | 서비스 내부의 일일 상한 (IP당 5회)              |
| 글 작성·삭제, 폴더 정리, 설정, 파일·배경화면 업로드, 분석 이벤트 | **없음**                                        |

일일 할당량은 비용 상한을, 1분 제한은 단시간 대량 요청(도배) 차단을 담당하므로 역할이 다르다. 데모는 하루 3회 제한만으로 충분하지만, 관리자 쓰기와 분석 이벤트에는 제한이 전혀 없었다. 관리자 경로는 로그인이 필요해 문제가 없다고 판단했지만, 로그인 확인(`AdminGuard`)은 요청마다 DB에서 세션을 조회한다. 쿠키 없이 `POST /posts`를 초당 수백 회 보내면 모두 401로 끝나지만, 그 횟수만큼 DB 조회가 발생한다.

<details>
<summary>용어 정리</summary>

- **요청 제한(rate limit)**: 한 IP가 한 경로를 정해진 시간 안에 호출할 수 있는 횟수. 초과하면 429(Too Many Requests)
- **`ThrottlerGuard`**: NestJS의 요청 제한 가드([NestJS 문서: Rate limiting](https://docs.nestjs.com/security/rate-limiting)). 이름(`login`, `comment` …)마다 시간 창(1분)과 횟수를 정의하고, 경로마다 집계할 이름을 선택한다. 횟수는 **IP별, 경로별**로 집계한다 (한 IP가 `/posts`에 60회, `/memo/organization`에 다시 60회 요청할 수 있다)
- **가드 순서**: 가드가 여러 개이면 클래스에 지정한 가드부터, 그다음 메서드에 지정한 가드를 **등록 순서대로** 실행한다. 그런데 데코레이터는 아래부터 적용되므로, 소스에서 아래에 적은 가드가 먼저 실행된다[^decorator]

</details>

## 검토한 방법

| 방법                                                   | 장점                                 | 단점                                                                            |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| `ThrottlerGuard`를 전역 가드(`APP_GUARD`)로 등록       | 누락되는 경로가 없다                 | 읽기 요청까지 집계한다. 경로별 횟수를 다르게 하려면 결국 경로마다 지정해야 한다 |
| 기존처럼 경로마다 `@UseGuards` + `@SkipThrottle` 두 줄 | 이미 사용 중이다                     | 이름이 늘수록 제외할 이름 목록이 길어진다. 누락을 검출하지 못한다               |
| 이름 하나를 받는 데코레이터 + 경로 표 시험 (선택)      | 한 줄. 누락된 경로는 시험이 검출한다 | 가드 순서를 지켜야 한다 (아래)                                                  |

## 데코레이터 한 줄로 통일

이름 7개를 `common/rate-limit.ts`에 정의하고, 쓰기 경로마다 `@RateLimit('이름')` 하나를 적용했다.

| 이름      | 1분당 횟수 (IP·경로별) | 적용 대상                              |
| --------- | ---------------------: | -------------------------------------- |
| `login`   |                     10 | 로그인 시작·콜백 (기존과 같음)         |
| `comment` |                      5 | 댓글·메시지·메일 발송 (방문자 기능)    |
| `like`    |                     30 | 좋아요 추가·취소 (기존과 같음)         |
| `write`   |                     60 | 관리자 쓰기: 글, 폴더 정리, 설정, 삭제 |
| `upload`  |                     20 | 파일·배경화면 업로드                   |
| `demo`    |                     10 | AI 데모 (일일 할당량은 유지)           |
| `events`  |                    120 | 트래픽 분석 이벤트 (5초마다 전송)      |

`@RateLimit`는 세 가지를 처리한다. `ThrottlerGuard`를 적용하고, 지정한 이름 하나만 집계하고 나머지 6개 이름은 제외하며, 이름을 메타데이터로 기록한다. 이전에는 경로마다 `@UseGuards(ThrottlerGuard)`와 `@SkipThrottle({ comment: true })` 두 줄을 적었는데, 이름이 7개가 되면 제외할 이름 6개를 매번 나열해야 하므로 한 줄로 통합했다. 횟수는 환경 변수(`WRITE_RATE_LIMIT` 등)로 조정한다.

```ts
export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

`SetMetadata`로 기록한 이름은 경로 표 시험이 읽는다. 경로별 집계 이름이 코드와 시험에서 같은 값을 사용한다.

## 가드 순서 오류

처음에는 `@RateLimit`를 `@UseGuards(AdminGuard)` 위에 적었다. 그러자 로그인하지 않은 요청이 집계되지 않았다. 데코레이터는 아래부터 적용되므로 `AdminGuard`가 가드 목록에 먼저 등록되고, 401로 끝난 요청은 `ThrottlerGuard`까지 도달하지 않았다. 관리자 경로 16개에서 `@RateLimit`를 `@UseGuards(AdminGuard)` 아래로 옮겼다. 이제 쿠키 없는 요청도 집계하고, 제한을 넘으면 세션 조회 전에 차단한다.

![RateLimit 데코레이터 위치에 따라 AdminGuard와 ThrottlerGuard가 실행되는 순서가 바뀌는 비교](./images/rate-limit-all-writes-guard-order.svg '소스에서 아래에 적은 가드가 먼저 실행된다')

이 순서는 코드 리뷰로 유지하기 어려운 규칙이므로 시험으로 검사한다. 경로 표 시험에 세 항목을 추가했다.

1. GET이 아닌 경로 33개에 모두 제한이 있다 (새 쓰기 경로에서 누락하면 이 시험이 실패한다)
2. GET 중 제한이 있는 경로는 로그인 시작·콜백뿐이다 (읽기 요청을 잘못 차단하지 않도록)
3. 관리자 경로에서 `ThrottlerGuard`가 `AdminGuard`보다 앞에 있다

제한 동작 자체를 검사하는 시험도 별도로 작성했다. 횟수를 2로 낮추고 같은 경로를 3회 호출해 429가 반환되는지, 로그인 없는 요청도 집계되는지, 다른 경로와 읽기 요청은 차단되지 않는지 확인한다.

## 확인

- 경로 표 시험 `apps/api/test/routes.e2e.test.ts`: "쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다", "표에서 'admin'인 경로에만 AdminGuard가 있다", "관리자 경로는 로그인 없이 401 (파라미터·몸통을 보기 전에 막는다)".
- 제한 시험 `apps/api/test/write-throttle.e2e.test.ts`: "관리자 쓰기(write): 경로마다 IP당 정한 횟수를 넘으면 429. 로그인하지 않은 요청도 횟수에 든다", "올리기(upload), 데모(demo), 분석 이벤트(events)는 각각의 횟수로 센다".
- 첫 커밋(`90c90d598`)에서는 쓰기 경로가 29개였다. main을 병합하는 사이에 좋아요 모듈이 추가되어 경로가 늘었는데, 병합 과정에서 좋아요 모듈과 `like` 제한이 누락되어 이를 복원하고 좋아요 경로에도 `@RateLimit`를 적용했다(`ce13e6fbe`). 그 결과가 제목의 33개다.
- 현재 `apps/api/src`에서 `@RateLimit(`를 사용하는 곳은 46곳이다. 경로 표 시험이 모든 쓰기 경로에 제한을 요구하므로, 이후 추가된 쓰기 경로에도 모두 제한이 적용되어 있다.

## 변경하지 않은 것

데모와 메일의 일일 할당량은 유지했다. 일일 할당량은 비용 상한이고 1분 제한은 단시간 대량 요청 차단이므로 둘 다 필요하다. 경로별 집계 방식도 유지했다. 한 IP의 전체 쓰기 경로 합산 제한은 없지만, 경로별 제한만으로도 경로 하나의 최대 요청량이 제한되므로 현재 규모에서는 충분하다고 판단했다.

## 남은 과제와 정리

- 횟수는 서버 메모리에서 집계한다. API 서버가 한 대라 정확하지만, 여러 대가 되면 서버마다 별도로 집계된다.
- IP 기준으로 집계하므로, 같은 공인 IP를 공유하는 사용자(회사, 학교)는 함께 집계된다. 방문자 기능인 `comment`가 1분에 5회라 실제로 제한에 걸릴 가능성은 낮다.
- "데코레이터는 아래부터 적용된다"처럼 코드 리뷰로 유지하기 어려운 규칙은 문서보다 시험으로 검사하는 편이 낫다. 한 번의 오류가 16곳에 적용되어 있었다.
- 요청 제한과 사람 확인(CAPTCHA)은 차단 대상이 다르다. 사람 확인은 [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)에서 기능별로 활성화한다.

## 서버 설정 확인

요청 제한은 IP 단위로 집계한다. API 앞에 Cloudflare Tunnel이 있으므로, 서버가 `X-Forwarded-For`를 신뢰하지 않으면 모든 방문자가 터널의 IP 하나로 인식되어 한 사용자가 제한에 걸리면 전체가 차단된다. 이 PR을 머지하기 전에 환경 변수 수정이 필요한지 판단하려고, 배포 서버의 `api.env`에 `TRUST_PROXY=1`이 있는지 먼저 확인했다. 이 값은 이번 변경뿐 아니라 기존 로그인·댓글 제한에도 필요하다([Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)의 trust proxy 도식 참고).

```bash
grep '^TRUST_PROXY=' ~/deploy/api.env     # TRUST_PROXY=1
```

없으면 한 줄 추가하고 `docker compose up -d api`로 다시 시작한다. 변수 설명은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 `api.env` 표에 있다.

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
# write-throttle.e2e.test.ts: 쓰기 경로 33개가 모두 429를 내는지
```

제한 값과 데코레이터는 [apps/api/src/common/rate-limit.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/rate-limit.ts) 한 파일에 있다. 새 쓰기 경로를 추가하면 [apps/api/test/routes.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/routes.e2e.test.ts)가 제한이 누락된 경로를 검출해 실패한다.

참고 문서: [NestJS 요청 제한](https://docs.nestjs.com/security/rate-limiting), [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html).

## 관련 글

- [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)
- [scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)
- [PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)
- [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)
- [리팩터링 7단계 - CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-step7-security)

[^decorator]: 같은 대상에 데코레이터가 여러 개 있으면, 데코레이터 표현식은 위에서 아래로 평가되고 결과 함수는 아래(대상에 가까운 쪽)에서 위로 호출된다. [TypeScript 문서: Decorator Composition](https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-composition)

#MacFolio #보안 #API #NestJS #요청제한
