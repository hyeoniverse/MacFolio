---
title: 쓰기 경로 33개에 같은 방식으로 요청 제한 걸기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 요청 제한이 세 갈래였고 글 쓰기·파일 올리기·분석 이벤트에는 1분 제한이 없었다. 제한 이름 일곱 개를 한 곳에 두고 쓰기 경로 33개에 @RateLimit 한 줄로 걸었다. 가드 순서를 한 번 틀렸고, 빠진 경로와 순서는 경로 표 시험이 잡는다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))에는 보안 항목으로 "요청 제한을 한 방식으로"가 있었다([PR #162](https://github.com/hyeoniverse/MacFolio/pull/162)). 지난 글([API 경로 64개를 표 하나로 고정하기](/memo/api-route-table-test))에서 만든 경로 표에 제한 열을 더하는 일이기도 하다.

## 세 갈래였던 것

| 경로                                                               | 제한                                            |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| 로그인 시작·콜백                                                   | `ThrottlerGuard`, IP마다 1분에 10번             |
| 댓글·메시지 쓰기·지우기                                            | `ThrottlerGuard`, IP마다 1분에 5번              |
| 좋아요 누르기·취소                                                 | `ThrottlerGuard`, IP마다 1분에 30번             |
| AI 데모 (요약·번역·음성·커버)                                      | 서비스 안의 하루 할당량 (IP마다 3번, 전체 50번) |
| 메일 보내기                                                        | 서비스 안의 하루 상한 (IP마다 5번)              |
| 글 쓰기·지우기, 폴더 정리, 설정, 파일·배경화면 올리기, 분석 이벤트 | **없음**                                        |

하루 할당량은 비용을 지키는 것이고 1분 제한은 도배를 막는 것이라 역할이 다르다. 데모는 하루 3번이면 1분 제한이 없어도 되지만, 관리자 쓰기나 분석 이벤트는 아무 제한이 없었다. 관리자 경로는 로그인이 필요하니 괜찮다고 생각했는데, 로그인 확인(`AdminGuard`)은 요청마다 DB에서 세션을 찾는다. 누군가 쿠키 없이 `POST /posts`를 초당 수백 번 보내면 모두 401로 끝나지만, 그만큼 DB 조회가 일어난다.

## 용어

- **요청 제한(rate limit)**: 한 IP가 한 경로를 정해진 시간 안에 몇 번까지 부를 수 있는지. 넘으면 429(Too Many Requests)
- **`ThrottlerGuard`**: NestJS의 요청 제한 가드. 이름(`login`, `comment` …)마다 창(1분)과 횟수를 정해 두고, 경로마다 어느 이름으로 셀지 고른다. 횟수는 **IP마다, 경로마다** 따로 센다 (한 IP가 `/posts`를 60번 쓰고 `/memo/organization`을 또 60번 쓸 수 있다)
- **가드 순서**: 가드가 여럿이면 클래스에 건 것부터, 그다음 메서드에 건 것을 **적힌 순서대로** 돈다. 그런데 데코레이터는 아래부터 적용되므로, 소스에서 아래에 적은 가드가 먼저 돈다

## 고를 수 있는 방법

| 방법                                                   | 좋은 점                          | 문제                                                                   |
| ------------------------------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| `ThrottlerGuard`를 앱 전체 가드(`APP_GUARD`)로 건다    | 빠뜨릴 경로가 없다               | 읽기까지 센다. 경로마다 횟수를 다르게 하려면 결국 경로마다 적어야 한다 |
| 지금처럼 경로마다 `@UseGuards` + `@SkipThrottle` 두 줄 | 이미 쓰고 있다                   | 이름이 늘수록 건너뛸 이름 목록이 길어진다. 빠뜨려도 모른다             |
| 이름 하나를 받는 데코레이터 + 경로 표 시험 (고름)      | 한 줄. 빠진 경로는 시험이 잡는다 | 가드 순서를 지켜야 한다 (아래)                                         |

## 한 줄로

이름 일곱 개를 `common/rate-limit.ts`에 두고, 쓰기 경로마다 `@RateLimit('이름')` 하나를 붙였다.

| 이름      | 1분에 (IP·경로마다) | 어디에                                     |
| --------- | ------------------: | ------------------------------------------ |
| `login`   |                  10 | 로그인 시작·콜백 (전과 같음)               |
| `comment` |                   5 | 댓글·메시지·메일 보내기 (방문자가 쓰는 것) |
| `like`    |                  30 | 좋아요 누르기·취소 (전과 같음)             |
| `write`   |                  60 | 관리자 쓰기: 글, 폴더 정리, 설정, 지우기   |
| `upload`  |                  20 | 파일·배경화면 올리기                       |
| `demo`    |                  10 | AI 데모 (하루 할당량은 그대로)             |
| `events`  |                 120 | 트래픽 분석 이벤트 (5초마다 보낸다)        |

`@RateLimit`는 `ThrottlerGuard`를 걸고, 그 이름 하나만 세고 나머지 다섯 이름은 건너뛰게 하고, 어느 이름인지를 메타데이터로 남긴다. 전에는 경로마다 `@UseGuards(ThrottlerGuard)`와 `@SkipThrottle({ comment: true })` 두 줄을 적었는데, 이름이 일곱이 되면 건너뛸 이름을 여섯 개 적어야 해서 한 줄로 묶었다. 횟수는 환경 변수(`WRITE_RATE_LIMIT` 등)로 바꾼다.

```ts
export function RateLimit(name: RateLimitName) {
	const skip = Object.fromEntries(RATE_LIMIT_NAMES.filter((other) => other !== name).map((other) => [other, true]));
	return applyDecorators(SetMetadata(RATE_LIMIT_KEY, name), SkipThrottle(skip), UseGuards(ThrottlerGuard));
}
```

`SetMetadata`로 남긴 이름은 경로 표 시험이 읽는다. 어느 경로가 어느 이름으로 세는지가 코드와 시험에서 같은 값이다.

## 가드 순서에서 한 번 틀렸다

처음에는 `@RateLimit`를 `@UseGuards(AdminGuard)` 위에 적었다. 그러자 로그인하지 않은 요청이 횟수에 들지 않았다. 데코레이터는 아래부터 적용되니 `AdminGuard`가 가드 목록에 먼저 들어가고, 401로 끝난 요청은 `ThrottlerGuard`까지 오지 않았던 것이다. 관리자 경로 16개에서 `@RateLimit`를 `@UseGuards(AdminGuard)` 아래로 옮겼다. 이제 쿠키 없는 요청도 세고, 제한을 넘으면 세션 조회 전에 막는다.

![RateLimit 데코레이터 위치에 따라 AdminGuard와 ThrottlerGuard가 도는 순서가 바뀌는 비교](./images/rate-limit-all-writes-guard-order.svg '소스에서 아래에 적은 가드가 먼저 돈다')

이 순서는 사람이 지키기 어려운 규칙이라 시험에 넣었다. 경로 표 시험에 세 가지를 더했다.

1. GET이 아닌 경로 33개에 모두 제한이 있다 (새 쓰기 경로에 빠뜨리면 여기서 깨진다)
2. GET 중 제한이 있는 것은 로그인 시작·콜백뿐이다 (읽기를 잘못 막지 않게)
3. 관리자 경로에서 `ThrottlerGuard`가 `AdminGuard`보다 앞에 있다

그리고 제한 자체를 보는 시험을 따로 두었다. 횟수를 2로 낮추고 같은 경로를 세 번 불러 429가 나는지, 로그인 없는 요청도 세는지, 다른 경로와 읽기는 막히지 않는지.

## 확인

- 경로 표 시험 `apps/api/test/routes.e2e.test.ts`: "쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다", "표에서 'admin'인 경로에만 AdminGuard가 있다", "관리자 경로는 로그인 없이 401 (파라미터·몸통을 보기 전에 막는다)".
- 제한 시험 `apps/api/test/write-throttle.e2e.test.ts`: "관리자 쓰기(write): 경로마다 IP당 정한 횟수를 넘으면 429. 로그인하지 않은 요청도 횟수에 든다", "올리기(upload), 데모(demo), 분석 이벤트(events)는 각각의 횟수로 센다".
- 처음 커밋(`90c90d598`)에서는 쓰기 경로가 29개였다. main을 합치는 사이에 좋아요 모듈이 들어와 경로가 늘었는데, 병합에서 좋아요 모듈과 `like` 제한이 빠져서, 되살리고 좋아요 경로도 `@RateLimit`로 바꿨다(`ce13e6fbe`). 그래서 제목의 33개가 되었다.
- 지금 `apps/api/src`에서 `@RateLimit(`를 쓰는 곳은 46곳이다. 경로 표 시험이 쓰기 경로마다 제한을 요구하므로, 그 뒤로 더한 쓰기 경로도 모두 제한을 달고 있다.

## 안 바꾼 것

데모와 메일의 하루 할당량은 그대로다. 그것은 "하루에 쓸 수 있는 돈"이고, 1분 제한은 "짧은 시간의 도배"라 둘 다 필요하다. 경로마다 세는 방식도 그대로다. 한 IP가 모든 쓰기 경로를 합쳐 몇 번까지라는 제한은 없는데, 경로 하나에 걸린 제한이 가장 약한 고리가 되는 구조라 지금은 충분하다고 봤다.

## 남은 것·배운 것

- 횟수는 서버 메모리에서 센다. API 서버가 한 대라 맞지만, 여러 대가 되면 서버마다 따로 센다.
- IP를 기준으로 세므로, 같은 IP를 나눠 쓰는 사람들(회사, 학교)은 함께 센다. 방문자가 쓰는 `comment`가 1분에 5번이라 실제로 부딪칠 일은 적다.
- "데코레이터는 아래부터 적용된다"처럼 사람이 지키기 어려운 규칙은 문서보다 시험에 두는 편이 낫다. 한 번 틀린 자리가 16곳이었다.
- 요청 제한과 사람 확인은 막는 대상이 다르다. 사람 확인은 [시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings)에서 곳마다 켠다.

## 서버에서 해야 하는 일

요청 제한은 IP로 센다. API 앞에 Cloudflare Tunnel이 있어서, 서버가 `X-Forwarded-For`를 믿지 않으면 모든 방문자가 터널 하나의 IP로 보여 한 사람이 걸리면 모두가 걸린다. 이 PR을 머지하기 전에 환경 변수를 고쳐야 하는지 물었고, 배포 서버의 `api.env`에 `TRUST_PROXY=1`이 있는지부터 확인했다. 이 값은 이번 변경만이 아니라 기존 로그인·댓글 제한에도 필요하다.

```bash
grep '^TRUST_PROXY=' ~/deploy/api.env     # TRUST_PROXY=1
```

없으면 한 줄 더하고 `docker compose up -d api`로 다시 띄운다. 변수 설명은 [docs/deployment.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/deployment.md)의 `api.env` 표에 있다.

## 직접 확인하는 방법

```bash
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
# write-throttle.e2e.test.ts: 쓰기 경로 33개가 모두 429를 내는지
```

제한 값과 데코레이터는 [apps/api/src/common/rate-limit.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/common/rate-limit.ts) 한 곳에 있다. 새 쓰기 경로를 만들면 [apps/api/test/routes.e2e.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/test/routes.e2e.test.ts)가 제한이 빠진 경로를 찾아 실패한다.

참고 문서: [NestJS 요청 제한](https://docs.nestjs.com/security/rate-limiting), [Express trust proxy](https://expressjs.com/en/guide/behind-proxies.html).

## 관련 글

- [API 경로 64개를 표 하나로 고정하기](/memo/api-route-table-test)
- [시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings)
- [댓글에 남기지 않은 것들](/memo/post-comments)
- [PR 미리보기 주소에는 CORS로 읽기만 열고 관리자 쿠키는 주지 않기](/memo/preview-cors-read-only)

#MacFolio #보안 #API #NestJS #요청제한
