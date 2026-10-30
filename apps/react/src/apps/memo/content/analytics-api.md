---
title: 쿠키 없이 하루 해시로 순방문자를 집계하는 분석 API
date: 2026-10-07
category: 개발 기록/MacFolio/서버·API
series: 트래픽 분석
seriesOrder: 1
summary: 외부 분석 도구 대신 분석 API를 직접 만들었다. 쿠키 없이 하루 해시로 순방문자를 집계하고, 원래 IP는 저장하지 않으며, 이벤트는 90일 뒤 삭제하고 일별 집계값만 보관한다. 고른 방법과 버린 방법, 테이블 두 개의 설계, 시험 12+10개를 정리했다.
---

이력서와 채용 공고에 이 사이트 주소를 기재한다. 그런데 방문자의 유입 경로와, 방문 후 어떤 앱과 글을 조회했는지는 확인할 방법이 없었다. 다음 작업을 고를 근거가 없는 상태였다.

Google Analytics를 붙이면 쉽지만, 방문자 쿠키와 동의 배너가 필요하고 수집 항목을 직접 정할 수 없다. 이 사이트는 페이지 하나 안에서 창을 여는 구조라, 페이지 주소만으로는 "메모 앱에서 어느 글을 조회했는지"도 알 수 없다. 후보를 비교했다.

| 방법                       | 장점                                | 버린 이유 / 고른 이유                                                       |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Google Analytics           | 연동이 쉽고 보고서 화면이 모두 있다 | 쿠키와 동의 배너. 창 안의 "어느 앱의 어느 글"은 별도 이벤트를 설계해야 한다 |
| Cloudflare Web Analytics   | 이미 Cloudflare를 쓴다. 쿠키가 없다 | 페이지 단위라 앱·글 이벤트를 기록할 수 없다                                 |
| Plausible 같은 호스팅 도구 | 쿠키 없는 집계 방식이 검증됐다      | 유료이거나 서버를 하나 더 실행해야 한다 (RAM 1GB 서버 한 대)                |
| 직접 만들기 (고른 방법)    | 수집 항목과 보관 기간을 직접 정한다 | 화면과 정리 작업까지 직접 구현해야 한다                                     |

그래서 직접 만들기로 했다. 순방문자 집계 방법은 [Plausible의 방식](https://plausible.io/data-policy)을 차용했다. 이 글은 첫 단계인 API 쪽이다. 수집 코드와 관리자 화면('활동 상태 보기' 앱)은 다음 글에서 다룬다.

## 정한 것

이슈 [#102](https://github.com/hyeoniverse/MacFolio/issues/102)에 결정 사항으로 남겨 둔 네 가지를 먼저 정했다.

| 항목                     | 결정                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| IP                       | 원래 IP는 저장하지 않는다. 관리자 화면용으로 마지막 자리를 마스킹한 IP(`203.0.113.x`)만 **7일** 보관 |
| 방문자에게 공개          | "오늘 방문자 N명" 하나만                                                                             |
| 앱 이름                  | macOS의 '활동 상태 보기'                                                                             |
| Cloudflare Web Analytics | 이번에는 활성화하지 않는다                                                                           |

작업은 [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 첫 커밋이다. 12개 파일에 1,362줄을 추가했다. 처음에는 `AnalyticsService` 하나였고, 뒤에 저장·집계·조회 세 서비스로 나눴다([트래픽 분석 서비스 나누기](/memo/analytics-service-split)). 2026-10-23 기준 `apps/api/src/analytics/`의 주요 파일은 다음과 같다.

| 파일                            | 줄  | 역할                                                             |
| ------------------------------- | --- | ---------------------------------------------------------------- |
| `rules.ts`                      | 219 | 검사, User-Agent 축약, 로봇 판별, IP 마스킹, 하루 해시           |
| `analytics-recorder.service.ts` | 68  | 수신한 묶음에 값을 붙여 저장                                     |
| `analytics-rollup.service.ts`   | 80  | 한 시간마다 지난 날짜를 `DailyStat`으로 집계, 90일·7일 기준 정리 |
| `analytics-stats.service.ts`    | 246 | 요약, 오늘 방문자, 실시간                                        |
| `analytics.controller.ts`       | 161 | 경로와 요청 제한                                                 |

## 수신: `POST /analytics/events`

사이트는 이벤트를 모아 [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)으로 전송한다. 페이지를 닫는 시각에도 전송되고 응답을 기다리지 않는다. 본문은 `text/plain`(JSON 문자열)이다. `application/json`이면 브라우저가 CORS 사전 요청(OPTIONS)[^preflight]을 먼저 보내는데, `text/plain`은 사전 요청이 필요 없다. Nest는 기본적으로 JSON 본문만 파싱하므로, 앱 설정에 `text/plain` 본문 파싱을 추가했다.

```ts
(app as NestExpressApplication).useBodyParser('text', { type: 'text/plain', limit: '32kb' });
```

이벤트는 다섯 종류다.

| 종류    | 의미             |
| ------- | ---------------- |
| `visit` | 페이지 열기      |
| `app`   | 앱 열기          |
| `item`  | 글·프로젝트 조회 |
| `link`  | 외부 링크 클릭   |
| `leave` | 체류 시간        |

검사는 댓글과 마찬가지로 순수 함수(`parseBatch`)로 한다. 하나라도 형식이 틀리면 묶음 전체를 거절한다. 사이트의 버그를 서버가 조용히 무시하지 않게 하기 위해서다. 유입 경로(`referrer`)는 **호스트 형식만** 허용하므로, 사이트가 실수로 검색어가 포함된 주소를 보내도 저장되지 않는다.

서버는 수신한 이벤트에 다음 값을 붙인다.

| 붙이는 값   | 방법                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 국가        | Cloudflare가 붙인 [`CF-IPCountry`](https://developers.cloudflare.com/fundamentals/reference/http-headers/) 헤더. 알 수 없음(`XX`)과 Tor(`T1`)는 버린다 |
| 브라우저·OS | User-Agent를 `Chrome`·`macOS` 같은 분류로 축약한다. 원문은 버린다                                                                                      |
| 하루 해시   | `HMAC(날짜 + IP + User-Agent, 비밀 키)`                                                                                                                |
| 마스킹된 IP | 마지막 자리를 `x`로                                                                                                                                    |

검색 로봇·링크 미리보기·자동화 도구(User-Agent로 필터링)와 관리자 세션의 요청은 수신만 하고 저장하지 않는다. IP마다 1분에 30회까지 허용한다. 사이트는 5초마다 전송하므로 여유가 있다.

![이벤트 저장 흐름](./images/analytics-api-pipeline.svg '수신 시 검사하고 값을 붙인다. 원본은 90일, 일별 집계값은 계속 보관한다')

## 쿠키 없이 순방문자를 집계한다: 하루 해시

순방문자를 집계하려면 "같은 사람"을 식별해야 한다. 쿠키를 발급하면 쉽지만 동의 배너가 필요하다. 대신 Plausible이 쓰는 방법을 따랐다.

```ts
export const dayHash = (day: string, ip: string, userAgent: string, secret: string) =>
	createHmac('sha256', secret).update(`analytics:${day}:${ip}:${userAgent}`).digest('hex');
```

같은 날 같은 IP·브라우저면 같은 값이므로 하루 순방문자를 집계할 수 있다. **날짜가 입력에 포함되므로** 날짜가 바뀌면 같은 사람도 다른 값이 된다. 날짜를 넘어 한 사람을 추적할 수 없다는 뜻이다. 대신 "이번 주 순방문자"는 일별 집계값의 합이다. 월요일과 화요일에 방문한 사람은 두 명으로 집계된다. 화면에도 그렇게 표기한다.

비밀 키가 입력에 포함되므로, 가능한 모든 IP를 대입해 해시에서 IP를 역산할 수도 없다.

![하루 해시로 순방문자 세기](./images/analytics-api-dayhash.svg '같은 사람이 월요일에 두 번, 화요일에 한 번 방문하면 월 1명, 화 1명이다')

한계도 있다.

| 상황                                               | 실제 | 집계 |
| -------------------------------------------------- | ---- | ---- |
| 같은 사무실에서 IP와 브라우저가 같은 두 사람       | 2명  | 1명  |
| 하루 중 휴대폰이 와이파이에서 LTE로 전환된 한 사람 | 1명  | 2명  |

포트폴리오 방문 수를 파악하는 용도로는 이 정도 오차를 허용할 수 있다고 판단했다.

## 서버 한 대에 맞춘 저장: 이벤트는 90일, 집계값은 계속

서버는 RAM 1GB다. 이벤트 테이블이 계속 커지면 요약을 계산할 때마다 부하가 커진다. 그래서 테이블을 두 개로 나눴다.

| 테이블           | 내용                 | 보관 기간                                         |
| ---------------- | -------------------- | ------------------------------------------------- |
| `AnalyticsEvent` | 이벤트 원본          | **90일** 뒤 삭제. 마스킹된 IP는 **7일** 뒤 비운다 |
| `DailyStat`      | (날짜, 지표, 키, 값) | 개인을 식별하는 값이 없으므로 계속 보관           |

`DailyStat`의 기본 키는 `(day, metric, key)` 세 열이다. 지표는 방문·순방문자·앱 열기·체류 시간 같은 합계와 유입 경로·앱·글·국가·기기·브라우저·OS·언어 같은 분류별 집계를 합쳐 16가지다.

```
2026-10-06 | visits   |            | 42
2026-10-06 | referrer | github.com | 17
2026-10-06 | item     | memo/hello |  9
```

집계는 별도 작업 스케줄러 없이 서버 프로세스 안에서 한 시간마다 실행한다(`setInterval`, `unref`[^unref]). 관리자가 요약을 열 때도 한 번 실행한다. 이벤트의 날짜는 브라우저 시각이 아니라 **서버의 수신 시각**(한국 시간)으로 정한다. 그래서 어제 날짜의 이벤트가 오늘 늦게 들어오는 경우가 없고, 한 번 집계한 날짜는 다시 바뀌지 않는다. 집계한 날짜에는 방문이 0이어도 `visits` 행을 반드시 기록해서, 다음 실행에서 그 날짜를 다시 집계하지 않는다.

요약(`GET /analytics/summary`)은 지난 날짜를 `DailyStat`에서, 오늘을 이벤트에서 바로 계산해 합친다. 하루치를 집계하는 함수(`aggregate`)를 두 경로가 공유한다. 기간이 1년이어도 365일 × 수십 행만 읽는다. 같은 길이의 직전 기간 값도 함께 응답해서 화면에서 ▲▼로 비교한다.

## 그 밖의 경로

| 경로                   | 응답                                                                                                                | 권한   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| `GET /analytics/today` | 오늘 순방문자 수. 방문자마다 DB를 조회하지 않도록 1분간 같은 값을 응답한다                                          | 누구나 |
| `GET /analytics/live`  | 최근 30분의 방문을 방문 단위로 묶어, 국가·기기·유입 경로·마스킹된 IP와 흐름(페이지 열기 → 앱 열기 → 글 조회 → 링크) | 관리자 |

## 시험

- 단위(`src/analytics/rules.test.ts`, 12개): 묶음 검사(문자열·객체 모두, 잘못된 형식 거절), User-Agent 축약, 로봇 필터링, IP 마스킹, 국가, 하루 해시가 날짜·IP·키에 따라 달라지는지, 한국 시간 날짜, 하루치 집계.
- e2e(`test/analytics.e2e.test.ts`, 실제 PostgreSQL, 현재 10개). 처음부터 있던 시험은 다음과 같다.

<details>
<summary>처음부터 있던 e2e 시험</summary>

- **sendBeacon(text/plain)으로 받아, 나라·브라우저·하루 해시·가린 IP를 붙여 저장한다. 원래 IP와 User-Agent는 없다**: 저장한 행을 직접 조회해 확인한다.
- **로봇과 관리자 세션은 받기만 하고 저장하지 않는다. 형식이 틀리면 400**
- **오늘 방문자: 같은 사람(IP·브라우저)의 두 방문은 한 명**: 같은 IP에서 Edge로 접속한 세 번째 방문은 다른 사람으로 집계한다.
- **지난 날은 DailyStat으로 모으고 오늘은 이벤트에서 바로 센다. 앞 기간과 비교한다**
- **정리: 90일이 지난 이벤트는 지우고(집계는 남는다), 7일이 지난 가린 IP는 지운다**
- 실시간 흐름, **IP마다 1분에 30번까지**

</details>

수집 항목과 보관 기간은 같은 커밋에서 `docs/privacy.md`(52줄)에 기록했다. 사이트에서는 Apple 메뉴의 '개인정보 처리 방침'으로 연다.

## 그 뒤에 바뀐 것

- 같은 날 요약을 누구나 조회하게 바꿨다. 방문자에게는 유입 호스트와 `utm` 값을 빼고 분류 결과만 응답한다. 글별 전체 조회수 경로를 추가하고, 한 방문에서 같은 글은 한 번만 집계한다([같은 경로에서 세션에 따라 응답 범위를 나누는 분석 요약 API](/memo/analytics-public)).
- 이벤트 묶음과 요약·실시간 응답의 형식을 `packages/contracts`로 옮겼다([#206](https://github.com/hyeoniverse/MacFolio/pull/206), [분석 계약](/memo/contracts-analytics)). 전송하는 사이트, 수신하는 서버, 조회하는 화면이 같은 스키마를 사용한다.
- 쓰기 경로 전체에 같은 방식의 요청 제한을 걸 때 이 경로도 `@RateLimit`으로 옮겼다([요청 제한](/memo/rate-limit-all-writes)).

## 남은 것, 배운 것

- 순방문자는 일별 집계값의 합이라 "이번 달 방문자 수"는 실제보다 크게 나온다. 쿠키 없이 날짜를 넘어 사람을 식별하는 방법은 없다. 숫자 옆에 그 사실을 표기하기로 했다.
- 집계는 서버 안의 `setInterval`이라 서버가 여러 대가 되면 같은 날짜를 두 번 집계할 수 있다. 현재는 한 대라 문제가 없고, 집계한 날짜에는 `visits` 행을 반드시 기록해 재집계를 막았다.
- 원본을 오래 보관하지 않고 일별 집계값만 남기는 설계로 개인정보와 서버 용량이라는 두 제약을 함께 해결했다. 삭제 시점을 먼저 정하고 테이블을 나누니 나머지 설계가 단순해졌다.

## 직접 확인하기

수집하는 항목·수집하지 않는 항목·보관 기간은 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 표로 있다. 로컬에서 이벤트를 하나 보내고 요약에 반영되는지 확인한다.

```bash
pnpm --filter @macfolio/api db:up && pnpm dev:api
curl -s -X POST http://localhost:4000/analytics/events -H 'Content-Type: application/json' \
  -d '{"events":[{"type":"visit","path":"/"}]}' -o /dev/null -w '%{http_code}\n'
curl -s http://localhost:4000/analytics/today; echo     # 오늘 순방문자
```

본문 형식은 계약(`packages/contracts/src/analytics.ts`)이 정하므로, 형식이 틀린 본문은 400이 정상이다. 정확한 필드는 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에서 확인한다. 하루 해시·90일 삭제·일별 집계는 시험이 검사한다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

되돌리는 방법: 이벤트는 90일 뒤 삭제되고 집계 테이블만 남는다. 즉시 비우려면 DB에서 이벤트 테이블을 비우면 되지만, 이미 집계한 일별 값은 남는다.

## 관련 글

- [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)
- [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor)
- [같은 경로에서 세션에 따라 응답 범위를 나누는 분석 요약 API](/memo/analytics-public)
- [분석 계약](/memo/contracts-analytics)
- [트래픽 분석 서비스 나누기](/memo/analytics-service-split)
- [요청 제한](/memo/rate-limit-all-writes)

[^preflight]: 브라우저가 다른 출처로 본 요청을 보내기 전에, 서버가 그 요청을 허용하는지 `OPTIONS`로 먼저 확인하는 요청. `text/plain` 같은 단순 요청은 생략된다([MDN](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)).

[^unref]: Node.js 타이머의 `unref()`는 그 타이머만 남았을 때 프로세스가 종료되지 못하게 막지 않도록 한다([Node.js 문서](https://nodejs.org/api/timers.html#timeoutunref)).

#MacFolio #트래픽분석 #백엔드 #개인정보
