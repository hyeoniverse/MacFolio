---
title: @RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 6
summary: 요청 제한 방식이 세 가지로 나뉘어 있었고 글 작성·파일 업로드·분석 이벤트에는 1분 제한이 없었다. 제한 이름 7개를 한 파일에 정의하고 쓰기 경로 33개에 @RateLimit 한 줄로 적용했다. 가드 순서를 한 번 잘못 지정했고, 누락된 경로와 순서는 경로 표 시험이 검출한다.
---

요청 제한(rate limit)은 한 요청자가 정해진 시간 안에 같은 경로를 호출할 수 있는 횟수의 상한이다. 예를 들어 "IP 하나당 1분에 60회"로 정하면, 61번째 요청은 서버가 처리하지 않고 HTTP 상태 코드 429(Too Many Requests)로 응답한다. 429는 [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585#section-4)가 "사용자가 주어진 시간 안에 너무 많은 요청을 보냈다"는 뜻으로 정의한 코드이고, 언제 다시 시도하면 되는지 `Retry-After` 헤더로 알려 줄 수 있다.

요청 제한이 없으면 스크립트 한 줄로 같은 요청을 초당 수백 회 보낼 수 있다. 그 요청이 실패로 끝나더라도 서버는 요청마다 일을 한다. MacFolio의 관리자 경로가 그런 경우였다. 관리자 확인을 담당하는 `AdminGuard`는 요청마다 세션 쿠키를 DB에서 조회한다. 쿠키 없이 `POST /posts`를 초당 수백 회 보내면 응답은 모두 401(로그인 필요)이지만, ==그 횟수만큼 DB 조회가 발생한다==.

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "요청 제한을 한 방식으로"를 [PR #162](https://github.com/hyeoniverse/MacFolio/pull/162)에서 처리했다. [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)에서 만든 경로 표에 제한 열을 추가하는 작업이기도 하다.

## NestJS의 요청 제한: ThrottlerGuard

NestJS에서 가드(guard)는 컨트롤러의 핸들러가 실행되기 전에 요청을 통과시킬지 결정하는 클래스다. `canActivate()`가 `false`를 반환하거나 예외를 던지면 핸들러는 실행되지 않는다. 요청 제한은 공식 패키지 `@nestjs/throttler`의 `ThrottlerGuard`가 담당한다([NestJS 문서: Rate limiting](https://docs.nestjs.com/security/rate-limiting)).

`ThrottlerGuard`의 설정은 이름 붙은 제한(throttler)의 목록이다. 이름마다 시간 창(`ttl`)과 횟수(`limit`)를 정하고, 경로마다 어느 이름으로 집계할지 선택한다. MacFolio는 이름 7개를 모두 1분 창으로 등록한다.

```ts
// apps/api/src/app.module.ts
ThrottlerModule.forRootAsync({
	inject: [APP_CONFIG],
	useFactory: (config: AppConfig) =>
		RATE_LIMIT_NAMES.map((name) => ({ name, ttl: RATE_LIMIT_TTL_MS, limit: config.rateLimits[name] })),
}),
```

### 집계 단위

`ThrottlerGuard`는 요청마다 집계 키를 만든다. 기본 구현(v6.7.1)은 컨트롤러 클래스 이름, 핸들러 이름, 제한 이름, 요청자 IP를 이어 붙여 SHA-256으로 변환한다. `POST /posts`는 `PostsController`의 `create` 핸들러이므로, IP `203.0.113.7`의 요청은 `PostsController-create-write-203.0.113.7`의 해시를 키로 사용한다.

그래서 횟수는 **IP별, 경로별**로 따로 집계된다. 한 IP가 `POST /posts`에 60회 요청한 뒤에도 `PUT /memo/organization`에는 다시 60회 요청할 수 있다.

### 집계 방식

기본 저장소(`ThrottlerStorageService`)는 서버 메모리의 `Map`이다. 허용한 요청마다 "지금부터 60초 뒤 만료"라는 기록을 하나 남기고, 다음 요청이 오면 만료된 기록을 먼저 삭제한 뒤 남은 기록의 수를 한도와 비교한다. 1분 단위로 횟수를 0으로 되돌리는 방식이 아니라, ==요청 시각 기준으로 최근 60초 안의 기록 수==로 판정한다.

![한도 3인 경로에서 0·20·40초 요청은 허용되고 50초 요청은 기록 3개라 429, 65초 요청은 0초 기록이 만료되어 허용되는 시간 축](./images/rate-limit-all-writes-sliding-window.svg '기록마다 만료 시각이 따로 있어서, 가장 오래된 기록이 만료되는 시각에 한 칸이 비는 구조')

위 그림은 한도를 3으로 낮춘 경우다.

| 요청 시각 | 살아 있는 기록 | 결과                                    |
| --------: | -------------: | --------------------------------------- |
|       0초 |            0개 | 허용 (0초 기록 추가, 60초에 만료)       |
|      20초 |            1개 | 허용                                    |
|      40초 |            2개 | 허용                                    |
|      50초 |            3개 | 429. 차단한 요청은 기록을 남기지 않는다 |
|      65초 |            2개 | 허용 (0초 기록이 60초에 만료)           |

허용한 응답에는 남은 횟수가, 차단한 응답에는 다시 시도할 수 있는 시각까지의 초가 헤더로 붙는다. 이름이 `default`가 아니면 헤더 이름 끝에 `-<이름>`이 붙는다. 한도 60인 `write` 경로의 첫 요청과 차단된 요청은 다음과 같다.

```text
HTTP/1.1 201 Created
X-RateLimit-Limit-write: 60
X-RateLimit-Remaining-write: 59
X-RateLimit-Reset-write: 60

HTTP/1.1 429 Too Many Requests
Retry-After-write: 37
{"statusCode":429,"error":"Too Many Requests","message":"ThrottlerException: Too Many Requests","path":"/posts", …}
```

429 응답의 몸통은 전역 예외 필터가 다른 오류와 같은 `ErrorBody` 형식으로 변환한 결과다.

## 세 가지로 나뉘어 있던 제한

작업 전에는 경로마다 제한 방식이 달랐다.

| 경로                                                             | 제한                                            |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| 로그인 시작·콜백                                                 | `ThrottlerGuard`, IP당 1분에 10회               |
| 댓글·메시지 작성·삭제                                            | `ThrottlerGuard`, IP당 1분에 5회                |
| 좋아요 추가·취소                                                 | `ThrottlerGuard`, IP당 1분에 30회               |
| AI 데모 (요약·번역·음성·커버)                                    | 서비스 내부의 일일 할당량 (IP당 3회, 전체 50회) |
| 메일 발송                                                        | 서비스 내부의 일일 상한 (IP당 5회)              |
| 글 작성·삭제, 폴더 정리, 설정, 파일·배경화면 업로드, 분석 이벤트 | **없음**                                        |

일일 할당량과 1분 제한은 막는 대상이 다르다. 일일 할당량은 외부 AI API 호출 비용의 상한이고, 1분 제한은 짧은 시간에 몰리는 대량 요청(도배)을 차단한다. 데모 경로는 하루 3회 할당량이 사실상 1분 제한 역할도 했지만, 관리자 쓰기와 분석 이벤트에는 어느 쪽도 없었다. 관리자 경로는 로그인이 필요하므로 안전하다고 판단했었는데, 앞에서 설명한 대로 로그인 확인 자체가 DB 조회다.

## 검토한 방법

| 방법                                                   | 장점                                 | 단점                                                                            |
| ------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| `ThrottlerGuard`를 전역 가드(`APP_GUARD`)로 등록       | 누락되는 경로가 없다                 | 읽기 요청까지 집계한다. 경로별 횟수를 다르게 하려면 결국 경로마다 지정해야 한다 |
| 기존처럼 경로마다 `@UseGuards` + `@SkipThrottle` 두 줄 | 이미 사용 중이다                     | 이름이 늘수록 제외할 이름 목록이 길어진다. 누락을 검출하지 못한다               |
| 이름 하나를 받는 데코레이터 + 경로 표 시험 (채택)      | 한 줄. 누락된 경로는 시험이 검출한다 | 가드 순서를 지켜야 한다 (아래)                                                  |

전역 가드는 사이트를 여는 방문자의 `GET` 요청까지 모두 집계한다. 글 목록·폴더·설정을 한 화면에서 여러 번 읽는 SPA라서, 읽기 한도를 따로 정하지 않으면 정상 방문자가 429를 받을 수 있다.

## 데코레이터 한 줄로 통일

이름 7개와 기본 횟수를 `apps/api/src/common/rate-limit.ts` 한 파일에 정의하고, 쓰기 경로마다 `@RateLimit('이름')` 하나를 적용했다.

| 이름      | 1분당 횟수 (IP·경로별) | 적용 대상                              |
| --------- | ---------------------: | -------------------------------------- |
| `login`   |                     10 | 로그인 시작·콜백 (기존과 같음)         |
| `comment` |                      5 | 댓글·메시지·메일 발송 (방문자 기능)    |
| `like`    |                     30 | 좋아요 추가·취소 (기존과 같음)         |
| `write`   |                     60 | 관리자 쓰기: 글, 폴더 정리, 설정, 삭제 |
| `upload`  |                     20 | 파일·배경화면 업로드                   |
| `demo`    |                     10 | AI 데모 (일일 할당량은 유지)           |
| `events`  |                    120 | 트래픽 분석 이벤트 (5초마다 전송)      |

`events`의 120회는 분석 이벤트 전송 주기에서 정했다. 방문자 한 명의 탭이 5초마다 이벤트를 보내면 1분에 12회이므로, 같은 IP에서 탭 여러 개를 열어도 한도에 닿지 않는다.

`@RateLimit`는 세 가지를 처리한다.

1. `ThrottlerGuard`를 경로에 적용한다.
2. 지정한 이름 하나만 집계하고, 나머지 6개 이름은 `@SkipThrottle`로 제외한다.
3. 이름을 메타데이터로 기록한다.

```ts
// apps/api/src/common/rate-limit.ts
export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

2번이 필요한 이유는 `ThrottlerGuard`의 기본 동작 때문이다. 이름을 지정하지 않으면 등록한 모든 이름으로 한 번씩 집계하므로, 댓글 경로가 `login`의 10회와 `comment`의 5회를 동시에 적용받는다. 이전에는 경로마다 두 줄을 적었다.

```ts
// 변경 전: 댓글 작성 경로 (이름이 login·comment 2개일 때)
@Post('posts/:slug/comments')
@UseGuards(ThrottlerGuard)
@SkipThrottle({ login: true })

// 변경 후: 이름이 7개여도 한 줄
@Post('posts/:slug/comments')
@RateLimit('comment')
```

이름이 7개가 되면 변경 전 방식은 제외할 이름 6개를 경로마다 나열해야 한다. 이름을 하나 추가하면 기존 경로 수십 곳의 제외 목록도 수정해야 한다. `@RateLimit`는 제외 목록을 `RATE_LIMIT_NAMES`에서 계산하므로 이름을 추가해도 경로 쪽 코드는 그대로다. 횟수는 환경 변수(`WRITE_RATE_LIMIT` 등)로 조정한다.

`SetMetadata`로 기록한 이름은 경로 표 시험이 읽는다. 코드와 시험이 같은 값으로 "이 경로는 어느 제한으로 집계하는가"를 판단한다.

## 가드 순서 오류

처음에는 `@RateLimit`를 `@UseGuards(AdminGuard)` 위에 적었다. 그러자 ==로그인하지 않은 요청이 집계되지 않았다==.

원인은 데코레이터 적용 순서다. 같은 대상에 데코레이터가 여러 개 있으면 아래(메서드에 가까운 쪽)부터 적용된다[^decorator]. `@UseGuards`는 적용될 때마다 가드 목록에 가드를 추가하므로, 소스에서 아래에 적은 `AdminGuard`가 목록의 앞에 들어간다. 가드는 목록 순서대로 실행되고, 앞의 가드가 예외를 던지면 뒤의 가드는 실행되지 않는다. 쿠키 없는 요청은 `AdminGuard`에서 401로 끝나 `ThrottlerGuard`까지 도달하지 않았다.

![RateLimit 데코레이터 위치에 따라 AdminGuard와 ThrottlerGuard가 실행되는 순서가 바뀌는 비교](./images/rate-limit-all-writes-guard-order.svg '소스에서 아래에 적은 가드가 먼저 실행된다')

관리자 경로 16개에서 `@RateLimit`를 `@UseGuards(AdminGuard)` 아래로 옮겼다. 이제 쿠키 없는 요청도 집계하고, 한도를 넘으면 세션 조회 전에 429로 차단한다.

```ts
// apps/api/src/posts/posts.controller.ts
@Post()
@UseGuards(AdminGuard)
@RateLimit('write') // 아래에 적어야 ThrottlerGuard가 먼저 실행된다
create(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
```

> [!IMPORTANT] 순서 규칙은 시험으로 검사한다
> "데코레이터는 아래부터 적용된다"는 규칙은 코드 리뷰에서 매번 확인하기 어렵다. 실제로 한 번의 오류가 관리자 경로 16곳에 퍼져 있었다. 그래서 경로 표 시험이 순서를 검사한다.

## 시험으로 고정

경로 표 시험(`apps/api/test/routes.e2e.test.ts`)은 앱의 모든 경로를 메타데이터에서 읽어 표로 만든다. 여기에 세 항목을 추가했다.

1. `GET`이 아닌 경로 33개에 모두 제한이 있다. 새 쓰기 경로에서 `@RateLimit`를 누락하면 실패한다.
2. `GET` 중 제한이 있는 경로는 로그인 시작·콜백뿐이다. 읽기 요청을 잘못 차단하지 않도록 확인한다.
3. 관리자 경로에서 `ThrottlerGuard`가 `AdminGuard`보다 앞에 있다.

제한 동작은 별도 시험(`apps/api/test/write-throttle.e2e.test.ts`)이 확인한다. 환경 변수로 `write` 한도를 2로 낮추고 같은 경로를 세 번 호출한다.

| 순서 | 요청                                     | 응답 | 확인하는 것                        |
| ---: | ---------------------------------------- | ---: | ---------------------------------- |
|    1 | `PUT /github/showcase` (관리자, 빈 몸통) |  400 | 제한은 입력 검증보다 먼저 집계한다 |
|    2 | 같은 경로 (쿠키 없음)                    |  401 | 로그인하지 않은 요청도 집계한다    |
|    3 | 같은 경로 (관리자)                       |  429 | 한도 2를 넘었다                    |
|    4 | `PUT /photos/captions` (관리자)          |  400 | 다른 경로는 따로 집계한다          |
|    5 | `GET /posts`, `GET /posts/admin`         |  200 | 읽기는 차단하지 않는다             |

`upload`, `demo`, `events`도 같은 방식으로 각자의 한도에서 429가 나오는지 확인한다.

시험 이름은 다음과 같다.

- `routes.e2e.test.ts`: "쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다", "표에서 'admin'인 경로에만 AdminGuard가 있다", "관리자 경로는 로그인 없이 401 (파라미터·몸통을 보기 전에 막는다)"
- `write-throttle.e2e.test.ts`: "관리자 쓰기(write): 경로마다 IP당 정한 횟수를 넘으면 429. 로그인하지 않은 요청도 횟수에 든다", "올리기(upload), 데모(demo), 분석 이벤트(events)는 각각의 횟수로 센다"

첫 커밋(`90c90d598`)에서는 쓰기 경로가 29개였다. main을 병합하는 사이에 좋아요 모듈이 추가되어 경로가 늘었는데, 병합 과정에서 좋아요 모듈과 `like` 제한이 누락되어 이를 복원하고 좋아요 경로에도 `@RateLimit`를 적용했다(`ce13e6fbe`). 그 결과가 33개다. 현재 `apps/api/src`에서 `@RateLimit(`를 사용하는 곳은 46곳이다. 경로 표 시험이 모든 쓰기 경로에 제한을 요구하므로, 이후 추가된 쓰기 경로에도 모두 제한이 적용되어 있다.

## 변경하지 않은 것

- **데모와 메일의 일일 할당량.** ==일일 할당량은 비용 상한이고 1분 제한은 단시간 대량 요청 차단이므로 둘 다 필요하다==. 예를 들어 `demo`의 1분 10회만 있으면 하루에 14,400회까지 호출할 수 있고, 일일 3회만 있으면 그 3회를 1초 안에 몰아 보낼 수 있다.
- **경로별 집계.** 한 IP의 전체 쓰기 경로를 합산하는 제한은 두지 않았다. 경로마다 상한이 있으므로 경로 하나에 몰리는 요청량은 제한되고, 현재 규모에서는 이 정도로 충분하다고 판단했다.

## 프록시 뒤의 IP: TRUST_PROXY

요청 제한은 요청자 IP 단위로 집계하므로, 서버가 요청자 IP를 정확히 알아야 한다. MacFolio의 API 앞에는 Cloudflare Tunnel이 있다. 방문자의 요청은 Cloudflare를 거쳐 서버 안의 `cloudflared` 컨테이너가 API로 전달하므로, API가 받는 TCP 연결의 상대 주소는 모든 방문자에 대해 `cloudflared` 하나다. 원래 요청자의 IP는 프록시가 `X-Forwarded-For` 헤더에 덧붙여 전달한다.

Express의 `trust proxy` 설정은 이 헤더를 몇 단계까지 신뢰할지 정한다([Express 문서: Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)). MacFolio는 환경 변수 `TRUST_PROXY`로 이 값을 지정한다.

```ts
// apps/api/src/app.setup.ts
(app as NestExpressApplication).set('trust proxy', config.trustProxy); // TRUST_PROXY, 기본 0
```

![TRUST_PROXY가 0이면 방문자 A·B·C가 집계 칸 하나를 함께 쓰고, 1이면 방문자마다 칸이 나뉘는 비교](./images/rate-limit-all-writes-counter-key.svg '집계 키의 마지막 부분이 req.ip라서, req.ip가 모두 같으면 칸도 하나가 된다')

> [!WARNING] 프록시 뒤에서는 TRUST_PROXY가 필요하다
> `TRUST_PROXY`가 0이면 `req.ip`가 모두 `cloudflared`의 주소가 되어, 모든 방문자가 집계 칸 하나를 함께 쓴다. 댓글 경로라면 방문자 전체가 합쳐서 1분에 5회만 쓸 수 있고, 한 사람이 5회를 쓰면 나머지 방문자도 1분 동안 429를 받는다.

이 PR을 병합하기 전에 배포 서버의 `api.env`에 `TRUST_PROXY=1`이 있는지 먼저 확인했다. 이 값은 이번 변경뿐 아니라 기존 로그인·댓글 제한에도 필요하다. `1`(한 단계만 신뢰)을 쓰는 이유와 `true`를 쓰지 않는 이유는 [Oracle 무료 VM과 Cloudflare Tunnel로 인바운드 포트 없이 API 서버 배포하기](/memo/deploy-api-oracle-tunnel)의 trust proxy 도식에 있다.

```bash
grep '^TRUST_PROXY=' ~/deploy/api.env     # TRUST_PROXY=1
```

없으면 한 줄 추가하고 `docker compose up -d api`로 다시 시작한다. 변수 설명은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 `api.env` 표에 있다.

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
# write-throttle.e2e.test.ts: 한도를 낮춘 경로가 429를 내는지
# routes.e2e.test.ts: 쓰기 경로 33개에 모두 제한이 있고 가드 순서가 맞는지
```

로컬 API(`pnpm dev:api`)에서는 응답 헤더로 남은 횟수를 확인할 수 있다.

```bash
curl -si -X POST http://localhost:4000/posts | grep -i ratelimit
# X-RateLimit-Limit-write: 60
# X-RateLimit-Remaining-write: 59
```

제한 값과 데코레이터는 [apps/api/src/common/rate-limit.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/rate-limit.ts) 한 파일에 있다. 새 쓰기 경로를 추가하면 [apps/api/test/routes.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/routes.e2e.test.ts)가 제한이 누락된 경로를 검출해 실패한다.

## 남은 과제

- **집계는 서버 메모리에 있다.** API 서버가 한 대라 정확하지만, 여러 대가 되면 서버마다 따로 집계되어 실제 한도가 서버 수만큼 늘어난다. 그 시각에는 Redis 같은 공유 저장소를 `ThrottlerModule`의 `storage`로 지정해야 한다. 서버를 재시작하면 집계도 초기화된다.
- **같은 공인 IP를 공유하는 사용자는 함께 집계된다.** 회사나 학교처럼 한 공인 IP 뒤에 여러 사람이 있는 경우다. 방문자 기능인 `comment`가 1분에 5회라 실제로 한도에 닿을 가능성은 낮다.
- **요청 제한과 사람 확인(CAPTCHA)은 막는 대상이 다르다.** 요청 제한은 횟수를, 사람 확인은 자동화 여부를 판정한다. 사람 확인은 [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)에서 기능별로 활성화한다.

## 관련 글

- [Reflect.getMetadata로 읽은 경로·가드를 표 하나로 고정하는 API 시험](/memo/api-route-table-test)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)
- [scrypt 비밀번호 해시와 IP HMAC만 저장하는 가입 없는 댓글](/memo/post-comments)
- [PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)
- [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)

[^decorator]: 데코레이터 표현식은 위에서 아래로 평가되고, 평가 결과인 함수는 아래(대상에 가까운 쪽)에서 위로 호출된다. [TypeScript 문서: Decorator Composition](https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-composition)

<details>
<summary>참고 문헌</summary>

- [RFC 6585: Additional HTTP Status Codes, 4. 429 Too Many Requests](https://www.rfc-editor.org/rfc/rfc6585#section-4)
- [MDN: 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [MDN: Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After)
- [NestJS 문서: Guards](https://docs.nestjs.com/guards)
- [NestJS 문서: Rate limiting](https://docs.nestjs.com/security/rate-limiting)
- [TypeScript 문서: Decorator Composition](https://www.typescriptlang.org/docs/handbook/decorators.html#decorator-composition)
- [Express 문서: Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)
- [MDN: X-Forwarded-For](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For)

</details>

#MacFolio #보안 #API #NestJS #요청제한
