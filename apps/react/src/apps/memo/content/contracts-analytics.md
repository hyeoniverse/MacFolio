---
title: 보내는 쪽과 받는 쪽 — 분석 이벤트의 모양을 하나로
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 분석의 보내는 모양, 받는 검사(parseBatch 55줄), 읽는 응답이 세 파일에 따로 있었다. 이벤트 묶음과 응답 모양을 contracts의 zod 스키마 하나로 옮기고, 요청 머리말과 비밀 키가 필요한 것만 서버에 남겼다. 다른 방법과 비교, 그 뒤 UTM을 더할 때 얻은 것까지.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 일곱째 PR [#206](https://github.com/hyeoniverse/MacFolio/pull/206). 댓글·글·메시지·연락 메일·배경화면·[파일](/memo/contracts-files)에 이어 트래픽 분석이다. 지금까지 가장 큰 요청 몸통이었다.

## 분석은 주고받는 모양이 셋이다

트래픽 분석(`/analytics`)은 이렇게 돈다. 사이트의 `analytics.ts`가 방문·앱 열기·글 보기·링크·떠남 이벤트를 모아 5초마다, 또는 30개가 차면 `sendBeacon`으로 보낸다. 서버는 `parseBatch`로 검사하고 요청 머리말에서 뽑은 것(나라, 브라우저, 하루 해시)을 붙여 DB에 넣는다. 관리자의 '활동 상태 보기'는 `/analytics/summary`와 `/analytics/live`를 읽는다.

그래서 모양이 셋이다. 보내는 모양, 받는 모양, 읽는 모양. 각각 `analytics.ts`의 `AnalyticsEvent`, 서버 `rules.ts`의 `parseBatch`(55줄, `if`문 열한 개), 화면 `activityApi.ts`의 `Totals`·`Summary`·`LiveVisit`에 있었다. 서버 쪽 응답 타입은 `analytics.service.ts`에 또 있었다.

![분석의 세 모양이 contracts 하나로](./images/contracts-analytics-batch.svg '사이트 analytics.ts → contracts의 EventBatch → 서버 parse·createMany. 서버에 남는 것은 User-Agent·IP·하루 해시·집계. 활동 상태 보기는 contracts의 Summary·LiveVisit')

세 모양이 따로 있으면 한쪽만 바뀌는 일이 생긴다. 예를 들어 사이트가 이벤트에 필드를 더해도 서버 검사는 모르는 필드로 보고, 화면 타입은 서버가 실제로 주는 모양과 손으로 맞춰야 한다. 묶음 상한 30도 서버와 사이트에 따로 적혀 있었다.

## 어떻게 하나로 묶나

| 방법                                      | 좋은 점                        | 문제                                                           |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| 타입만 공유 (`.d.ts` 패키지)              | 가볍다                         | 실행 시 검사는 여전히 서버에 따로 적는다                       |
| OpenAPI 문서에서 화면 타입 생성           | 서버 코드가 원본이 된다        | 생성 단계가 늘고, 사이트가 보내는 쪽(sendBeacon)은 덮지 못한다 |
| zod 스키마 패키지 (`@macfolio/contracts`) | 타입과 검사가 한 곳에서 나온다 | 서버·화면 둘 다 zod를 번들에 넣는다                            |

댓글부터 시작한 contracts 패키지가 이미 있었으니 같은 방법을 이어 썼다.

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

두 가지가 중요했다.

**JSON 글자도 받는다.** `sendBeacon`은 글자를 넘기면 `text/plain`으로 보내고, 그러면 CORS 사전 요청이 없다. 그래서 몸통이 JSON 객체가 아니라 JSON 글자로 온다. `z.preprocess`에서 글자면 `JSON.parse`를 시도하고, 실패하면 그대로 넘겨 "본문이 없습니다."가 나오게 했다.

**빈 글자는 없는 것으로, 모르는 필드는 버린다.** 서버는 검사한 이벤트를 `createMany({ data: events.map((e) => ({ ...e, ...shared })) })`로 그대로 DB에 넣는다. 검사 결과가 곧 DB 행이다. `''`가 남으면 빈 문자열이 저장되고, 모르는 필드가 남으면 Prisma가 거부한다. zod의 `object`는 모르는 키를 버리고, `text()` 전처리가 `''`를 `undefined`로 바꾼다. 이 둘을 시험으로 고정했다.

서버 `parseBatch`는 `parse(EventBatch, input)` 한 줄이 됐다. 400 문구는 그대로다.

## 서버에 남는 것

`rules.ts`에는 요청 머리말이나 비밀 키가 필요한 것만 남았다. User-Agent를 브라우저·OS로 줄이기, IP 가리기, 나라 두 글자, 하루 해시(HMAC), 하루치 집계. [파일](/memo/contracts-files)에서 세운 기준 "화면도 알아야 하는가"가 여기서도 그대로 통했다. 화면은 이런 것을 알 필요가 없고 알아서도 안 된다.

## 읽는 쪽

활동 상태 보기의 `activityApi.ts`는 `Totals`·`Summary`·`LiveVisit`·`Breakdown`·`Row` 인터페이스를 지우고 contracts의 같은 이름을 다시 내보낸다. 화면 컴포넌트의 import는 그대로다. 요약의 표 열두 개(`BREAKDOWNS`)는 서버 서비스에 배열로, 화면에 유니언 타입으로 따로 있었는데 contracts의 `as const` 배열 하나에서 둘 다 나온다. `Summary.breakdown`은 그 배열로 만든 `z.object`라 표 하나가 빠지면 스키마가 거부한다.

![줄이 옮겨 간 자리](./images/contracts-analytics-lines.svg '흩어진 검사와 타입이 contracts 한 파일로 모였다')

## 결과

| 항목                  | 전                        | 후                         |
| --------------------- | ------------------------- | -------------------------- |
| 서버 `parseBatch`     | 55줄, `if` 11개           | 1줄                        |
| `Summary`·`LiveVisit` | 2 (서버 서비스·화면)      | 1                          |
| 표 목록 `BREAKDOWNS`  | 2 (서버 배열·화면 유니언) | 1                          |
| 묶음 상한 30          | 2 (서버·화면)             | 1                          |
| 동작 변화             |                           | 없음 (e2e 분석 9개 그대로) |

남은 것은 사이트 프로필 하나. 그러면 이슈의 "프론트에서 손으로 적은 응답 타입" 항목이 끝난다.

## 시험

`packages/contracts/src/analytics.test.ts`가 위의 두 가지를 고정한다. **sendBeacon의 text/plain(JSON 글자)과 JSON 객체를 모두 받는다. 호스트는 소문자로**, **빈 글자는 없는 것으로, 모르는 필드는 버린다 (DB 열과 같은 모양으로)**, **하나라도 틀리면 전부 거절한다**. 서버 e2e(`apps/api/test/analytics.e2e.test.ts`)는 하나도 고치지 않고 통과했다. 400 문구가 그대로라는 뜻이다.

## 그 뒤: UTM을 더할 때

일주일 뒤 UTM 다섯 가지와 조합 표를 더했다([트래픽 분석 5](/memo/utm-analytics)). 그때 고친 모양은 contracts의 `EventInput`과 `BREAKDOWNS` 두 곳이었다. 보내는 사이트, 받는 서버, 읽는 화면이 모두 따라왔다. 표는 열두 개에서 열여섯 개가 됐고, 시험 **요약은 표 열여섯 개를 모두 가진다**가 빠진 표를 잡는다. 사이트에서 다듬는 규칙(소문자, 공백은 `-`, 100자)도 contracts의 `cleanUtm` 하나를 화면과 서버가 같이 쓴다.

## 남은 것, 배운 것

- `Summary` 스키마는 서버 응답을 실행 시에 검사하지 않는다. 화면은 타입만 가져다 쓴다. 서버가 틀린 모양을 주면 화면에서 터진다. 서버와 화면이 같은 저장소에서 같이 배포되니 지금은 받아들였다.
- 서버에만 남긴 것(User-Agent 줄이기, IP 가리기, 하루 해시)의 기준은 "화면도 알아야 하는가"였다. 이 질문 하나로 contracts에 넣을지 말지가 거의 다 갈렸다.
- 가장 큰 몸통을 옮겼는데도 서버 e2e가 그대로 통과한 것은, 400 문구를 스키마의 `error` 메시지로 옮겨 둔 덕이다. 검사 규칙을 옮길 때는 실패 문구까지 같이 옮긴다.

## 따라 해 보기

계약을 바꿀 때는 `packages/contracts`를 먼저 고치고, 서버와 화면이 둘 다 따라오는지 본다.

```bash
pnpm --filter @macfolio/contracts test          # 스키마 시험
pnpm --filter @macfolio/contracts build         # 서버는 빌드된 JS를 읽는다
pnpm typecheck                                  # 화면·서버가 새 모양을 따르는지
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

필드 이름을 하나 바꿔 보면 `pnpm typecheck`가 서버와 화면에서 같이 깨진다. 이게 이 작업으로 얻은 것이다. 확인한 뒤 되돌린다. 스키마는 [Zod](https://zod.dev/)로 쓰고, 패키지를 나눈 까닭은 [댓글 계약](/memo/contracts-comments)에 있다.

관련 글: [트래픽 분석 1 - API](/memo/analytics-api), [트래픽 분석 2 - 수집](/memo/analytics-collect), [댓글 계약](/memo/contracts-comments), [파일 계약](/memo/contracts-files)

#MacFolio #리팩터링 #zod #TypeScript
