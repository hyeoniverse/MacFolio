---
title: contracts의 zod 스키마로 분석 이벤트의 전송 형식·서버 검증·조회 응답 통합하기
date: 2026-10-11
category: 개발 기록/MacFolio/백엔드
summary: 분석 이벤트의 전송 형식, 서버 검증(parseBatch 55줄), 조회 응답 타입이 세 파일에 각각 정의되어 있었다. 이벤트 묶음과 응답 타입을 contracts의 zod 스키마로 옮기고, 요청 헤더와 비밀 키가 필요한 코드만 서버에 남겼다. 다른 방법과의 비교, 이후 UTM을 추가할 때의 변경 범위까지 정리했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 일곱째 PR [#206](https://github.com/hyeoniverse/MacFolio/pull/206)이다. [댓글](/memo/contracts-comments)·[글](/memo/contracts-posts)·[메시지](/memo/contracts-messages)·[연락 메일](/memo/contracts-contact)·[배경화면](/memo/contracts-wallpapers)·[파일](/memo/contracts-files)에 이어 트래픽 분석 도메인을 옮겼다. 여덟 도메인 중 요청 본문의 필드가 가장 많았다.

## 분석 도메인의 데이터 형식 세 가지

트래픽 분석(`/analytics`)은 다음 순서로 동작한다.

1. 사이트의 `analytics.ts`가 방문(`visit`)·앱 열기(`app`)·글 조회(`item`)·링크(`link`)·이탈(`leave`) 이벤트를 수집한다.
2. 5초(`FLUSH_MS = 5000`)마다, 또는 30개(`MAX_EVENTS`)가 쌓이면 [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)으로 `/analytics/events`에 전송한다.
3. 서버는 `parseBatch`로 검증하고, 요청 헤더에서 추출한 값(국가, 브라우저, 일별 해시[^hmac])을 붙여 DB에 저장한다.
4. 관리자 화면 '활동 상태 보기'는 `/analytics/summary`와 `/analytics/live`를 조회한다.

그래서 데이터 형식이 세 가지이고, 각각 다른 파일에 정의되어 있었다.

| 형식                    | 정의 위치                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| 전송 형식 (사이트)      | `analytics.ts`의 `AnalyticsEvent`                                                                 |
| 수신 검증 (서버)        | `rules.ts`의 `parseBatch` (55줄, `if`문 열한 개)                                                  |
| 조회 응답 (관리자 화면) | 화면 `activityApi.ts`의 `Totals`·`Summary`·`LiveVisit`, 서버 `analytics.service.ts`에도 별도 정의 |

![분석의 세 가지 형식이 contracts 하나로](./images/contracts-analytics-batch.svg '사이트 analytics.ts → contracts의 EventBatch → 서버 parse·createMany. 서버에 남는 것은 User-Agent·IP·일별 해시·집계. 활동 상태 보기는 contracts의 Summary·LiveVisit')

세 형식이 따로 정의되어 있으면 한쪽만 변경되는 경우가 생긴다. 예를 들어 사이트가 이벤트에 필드를 추가해도 서버 검증은 그 필드를 알지 못하고, 화면 타입은 서버의 실제 응답과 직접 대조해 맞춰야 한다. 묶음 상한 30도 서버와 사이트에 각각 정의되어 있었다.

## 통합 방법 비교

| 방법                                      | 좋은 점                             | 문제                                                                        |
| ----------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| 타입만 공유 (`.d.ts` 패키지)              | 의존성이 없다                       | 런타임 검증은 여전히 서버에 별도로 작성해야 한다                            |
| OpenAPI 문서에서 화면 타입 생성           | 서버 코드가 원본이 된다             | 코드 생성 단계가 추가되고, 사이트의 전송 형식(sendBeacon)은 포함하지 못한다 |
| zod 스키마 패키지 (`@macfolio/contracts`) | 타입과 검증 코드가 한 곳에서 나온다 | 서버·화면 모두 zod를 번들에 포함한다                                        |

댓글 도메인에서 만든 contracts 패키지가 이미 있어서 같은 방법을 적용했다.

## 이벤트 묶음

```ts
// packages/contracts/src/analytics.ts
export const EventInput = z.object({
	type: z.enum(EVENT_TYPES, { error: 'type이 올바르지 않습니다.' }),
	app: text(32, 'app').refine((app) => !app || APP_NAME.test(app), 'app이 올바르지 않습니다.'),
	referrer: text(253, 'referrer')
		.transform((r) => r?.toLowerCase())
		.refine(/* 호스트만 */),
	device: z.enum(['desktop', 'mobile']).optional(),
	duration: z.number().int().min(0).max(MAX_DURATION_MS).optional(),
	// item, path, utm*, language …
});

export const EventBatch = z.preprocess(
	(input) => (typeof input === 'string' ? tryJson(input) : input),
	z.object({ visitId: z.string().regex(VISIT_ID), events: z.array(EventInput).min(1).max(MAX_EVENTS) })
);
```

이 스키마에서 중요한 처리는 두 가지다.

**JSON 문자열도 허용한다.** `sendBeacon`에 문자열을 넘기면 `Content-Type: text/plain;charset=UTF-8`로 전송되고, 이 형식은 [CORS 단순 요청](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#simple_requests) 조건을 만족해 [사전 요청(preflight)](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)이 발생하지 않는다. 그래서 요청 본문이 JSON 객체가 아니라 JSON 문자열로 도착한다. `z.preprocess`에서 문자열이면 `JSON.parse`를 시도하고, 파싱에 실패하면 값을 그대로 넘겨 "본문이 없습니다." 문구가 나오게 했다.

![application/json은 OPTIONS 사전 요청 후 POST, text/plain 문자열은 POST 한 번. 서버는 preprocess에서 JSON.parse](./images/contracts-analytics-preflight.svg '사이트와 API는 출처가 달라 본문 형식에 따라 요청 수가 달라진다')

**빈 문자열은 값이 없는 것으로, 정의되지 않은 필드는 제거한다.** 서버는 검증한 이벤트를 [`createMany`](https://www.prisma.io/docs/orm/reference/prisma-client-reference#createmany)`({ data: events.map((e) => ({ ...e, ...shared })) })`로 그대로 DB에 저장한다. 검증 결과가 곧 DB 행이다.

| 입력에 남은 값     | 처리하지 않았을 때의 결과           | 스키마의 처리                        |
| ------------------ | ----------------------------------- | ------------------------------------ |
| `''` (빈 문자열)   | 빈 문자열이 DB에 저장된다           | `text()` 전처리가 `undefined`로 변환 |
| 정의되지 않은 필드 | Prisma가 알 수 없는 열이라 거부한다 | `z.object`가 정의되지 않은 키를 제거 |

이 두 동작을 시험으로 고정했다.

서버 `parseBatch`는 `parse(EventBatch, input)` 한 줄로 바뀌었다. 400 응답 문구는 그대로다.

## 서버에 남긴 코드

`rules.ts`에는 요청 헤더나 비밀 키가 필요한 코드만 남겼다.

- [User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent) 헤더를 브라우저·OS 이름으로 축약
- IP 마스킹
- 국가 코드(두 글자)
- 일별 해시(HMAC)
- 일별 집계

[파일 도메인](/memo/contracts-files)에서 정한 기준 "화면도 알아야 하는가"를 그대로 적용했다. 화면은 이 값을 알 필요가 없고, 해시용 비밀 키는 화면에 노출되어서도 안 된다.

## 조회 응답

활동 상태 보기의 `activityApi.ts`는 `Totals`·`Summary`·`LiveVisit`·`Breakdown`·`Row` 인터페이스를 삭제하고 contracts의 같은 이름을 re-export한다. 화면 컴포넌트의 import 문은 그대로다. 요약 화면의 표 열두 개 목록(`BREAKDOWNS`)은 서버 서비스에는 배열로, 화면에는 유니언 타입으로 각각 정의되어 있었는데, 이제 contracts의 `as const` 배열 하나에서 두 가지를 모두 만든다. `Summary.breakdown`은 그 배열로 생성한 `z.object`라서 표 하나가 빠지면 스키마가 거부한다.

```ts
// packages/contracts/src/analytics.ts (일부)
export const BREAKDOWNS = ['referrerGroup' /* … */] as const;
export type Breakdown = (typeof BREAKDOWNS)[number]; // 화면의 유니언 타입
// 서버는 BREAKDOWNS 배열을 순회해 표마다 집계한다
```

![코드 줄이 이동한 위치](./images/contracts-analytics-lines.svg '흩어진 검증 코드와 타입이 contracts 한 파일로 통합되었다')

## 결과

| 항목                  | 전                        | 후                         |
| --------------------- | ------------------------- | -------------------------- |
| 서버 `parseBatch`     | 55줄, `if` 11개           | 1줄                        |
| `Summary`·`LiveVisit` | 2 (서버 서비스·화면)      | 1                          |
| 표 목록 `BREAKDOWNS`  | 2 (서버 배열·화면 유니언) | 1                          |
| 묶음 상한 30          | 2 (서버·화면)             | 1                          |
| 동작 변화             |                           | 없음 (e2e 분석 9개 그대로) |

남은 도메인은 [사이트 프로필](/memo/contracts-site) 하나다. 이 도메인까지 옮기면 이슈의 "프론트에서 손으로 적은 응답 타입" 항목이 완료된다.

## 시험

`packages/contracts/src/analytics.test.ts`의 시험이 위의 처리를 고정한다.

- **sendBeacon의 text/plain(JSON 글자)과 JSON 객체를 모두 받는다. 호스트는 소문자로**
- **빈 글자는 없는 것으로, 모르는 필드는 버린다 (DB 열과 같은 모양으로)**
- **하나라도 틀리면 전부 거절한다**

서버 e2e(`apps/api/test/analytics.e2e.test.ts`)는 수정 없이 통과했다. 400 응답 문구가 바뀌지 않았다는 뜻이다.

## 이후: UTM을 추가한 시각의 변경 범위

일주일 뒤 UTM[^utm] 매개변수 다섯 가지와 조합 표를 추가했다([UTM 출처·매체·캠페인 조합 표와 링크 생성기 (트래픽 분석 5)](/memo/utm-analytics)). 그때 수정한 스키마는 contracts의 `EventInput`과 `BREAKDOWNS` 두 곳뿐이었고, 전송하는 사이트·수신하는 서버·조회하는 화면이 모두 이 변경을 따랐다. 표는 열두 개에서 열여섯 개로 늘었고, 시험 **요약은 표 열여섯 개를 모두 가진다**가 누락된 표를 검출한다. 사이트에서 UTM 값을 정리하는 규칙(소문자, 공백은 `-`, 100자)도 contracts의 `cleanUtm` 하나를 화면과 서버가 함께 사용한다.

## 남긴 것과 정리

- `Summary` 스키마로 서버 응답을 런타임에 검증하지는 않는다. 화면은 타입만 import한다. 서버가 잘못된 형식을 반환하면 화면에서 런타임 오류가 발생한다. 서버와 화면이 같은 저장소에서 함께 배포되므로 현재는 이 위험을 허용했다.
- 서버에만 남긴 코드(User-Agent 축약, IP 마스킹, 일별 해시)의 기준은 "화면도 알아야 하는가"였다. 이 기준 하나로 contracts에 넣을 코드를 대부분 판별할 수 있었다.
- 필드가 가장 많은 요청 본문을 옮겼는데도 서버 e2e가 수정 없이 통과한 것은, 400 문구를 스키마의 [`error` 옵션](https://zod.dev/error-customization)으로 그대로 옮겼기 때문이다. 검증 규칙을 옮길 때는 실패 문구까지 함께 옮긴다.

## 직접 확인하는 방법

계약(요청·응답 스키마)을 바꿀 때는 `packages/contracts`를 먼저 수정하고, 서버와 화면이 모두 새 형태를 따르는지 확인한다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

필드 이름 하나를 바꾸면 `pnpm typecheck`가 서버와 화면에서 동시에 실패한다. 이 작업의 목적이 바로 이 검사다. 확인한 뒤에는 변경을 되돌린다. 스키마는 [Zod](https://zod.dev/)로 작성하고, 패키지를 나눈 이유는 [댓글 계약 글](/memo/contracts-comments)에 정리했다.

## 관련 글

- [쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API (트래픽 분석 1)](/memo/analytics-api)
- [sendBeacon 일괄 전송과 Global Privacy Control을 따르는 방문 이벤트 수집 (트래픽 분석 2)](/memo/analytics-collect)
- [라이브러리 없는 SVG 그래프와 컨테이너 쿼리로 만든 '활동 상태 보기' 앱 (트래픽 분석 3)](/memo/analytics-activity-monitor)
- [UTM 출처·매체·캠페인 조합 표와 링크 생성기 (트래픽 분석 5)](/memo/utm-analytics)
- [상태 기준으로 AnalyticsService를 저장·집계·조회 서비스 셋으로 나누기](/memo/analytics-service-split)
- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [올린 파일 규칙을 contracts 공유 규칙과 서버 전용 검사로 나누기](/memo/contracts-files)

[^hmac]: `날짜:IP:User-Agent` 문자열을 서버의 비밀 키로 [HMAC](https://developer.mozilla.org/en-US/docs/Glossary/HMAC)-SHA256 해시한 값(`dayHash`). 같은 날 같은 IP·브라우저면 같은 값이고, 날짜가 바뀌면 다른 값이 되어 날짜를 넘어 방문자를 추적할 수 없다. 자세한 방식은 [쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API (트래픽 분석 1)](/memo/analytics-api)에 정리했다.

[^utm]: 링크 주소에 붙이는 `utm_source`·`utm_medium`·`utm_campaign`·`utm_term`·`utm_content` 매개변수. 방문자가 어떤 캠페인 링크로 유입되었는지 집계하는 데 사용한다.

#MacFolio #리팩터링 #zod #TypeScript
