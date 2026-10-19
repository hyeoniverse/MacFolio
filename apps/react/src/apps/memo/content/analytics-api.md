---
title: 트래픽 분석 1 - 쿠키 없이 순방문자 세기
date: 2026-10-07
category: 개발기/MacFolio/백엔드
summary: 외부 분석 도구 대신 분석 API를 직접 만들었다. 쿠키 없이 하루 해시로 순방문자를 세고, 원래 IP는 두지 않으며, 이벤트는 90일 뒤 지우고 날마다 모은 숫자만 남긴다. 고른 방법과 버린 방법, 표 두 개의 설계, 시험 12+10개를 정리했다.
---

이력서와 채용 공고에 이 사이트 주소를 붙여 낸다. 그런데 어디서 들어왔는지, 들어와서 어떤 앱과 글을 봤는지는 알 길이 없었다. 다음에 무엇을 만들지 고를 근거가 없는 셈이다.

Google Analytics를 붙이면 쉽지만, 방문자 쿠키와 동의 배너가 따라오고 무엇을 모으는지 내가 정할 수 없다. 사이트가 페이지 하나에서 창을 띄우는 구조라 페이지 주소만으로는 "메모 앱에서 어느 글을 봤는지"도 모른다. 후보를 놓고 비교했다.

| 방법                       | 좋은 점                               | 버린 이유 / 고른 이유                                                   |
| -------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Google Analytics           | 붙이기 쉽고 화면이 다 있다            | 쿠키와 동의 배너. 창 안의 "어느 앱의 어느 글"은 따로 이벤트를 짜야 한다 |
| Cloudflare Web Analytics   | 이미 Cloudflare를 쓴다. 쿠키가 없다   | 페이지 단위라 앱·글 이벤트를 못 담는다                                  |
| Plausible 같은 호스팅 도구 | 쿠키 없는 방식이 검증됐다             | 유료이거나 서버를 하나 더 돌려야 한다 (RAM 1GB 서버 한 대)              |
| 직접 만들기 (고른 방법)    | 무엇을 모으고 얼마나 둘지 내가 정한다 | 화면과 정리 작업까지 직접 짜야 한다                                     |

그래서 직접 만들기로 했다. 순방문자를 세는 방법은 Plausible의 것을 빌렸다. 이 글은 첫 단계, API 쪽이다. 수집 코드와 관리자 화면('활동 상태 보기' 앱)은 다음 글에서 다룬다.

## 정한 것

이슈(#102)에 정할 것으로 남겨 둔 넷을 먼저 정했다.

- **IP:** 원래 IP는 저장하지 않는다. 관리자 화면에서 볼 수 있게 마지막 자리를 가린 IP(`203.0.113.x`)만 **7일** 둔다
- **방문자에게 공개:** "오늘 방문자 N명" 하나만
- **앱 이름:** macOS의 '활동 상태 보기'
- **Cloudflare Web Analytics:** 이번에는 켜지 않는다

작업은 PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 첫 커밋이다. 12개 파일에 1,362줄을 더했다. 지금 `apps/api/src/analytics/` 아래는 일곱 파일 887줄이다.

| 파일                            | 줄  | 하는 일                                              |
| ------------------------------- | --- | ---------------------------------------------------- |
| `rules.ts`                      | 201 | 검사, User-Agent 줄이기, 로봇, IP 가리기, 하루 해시  |
| `analytics-recorder.service.ts` | 68  | 받은 묶음에 값을 붙여 저장                           |
| `analytics-rollup.service.ts`   | 80  | 한 시간마다 지난 날을 `DailyStat`으로, 90일·7일 정리 |
| `analytics-stats.service.ts`    | 234 | 요약, 오늘 방문자, 실시간                            |
| `analytics.controller.ts`       | 115 | 경로와 요청 제한                                     |

## 받는 쪽: `POST /analytics/events`

사이트는 이벤트를 모아 `navigator.sendBeacon`으로 보낸다. 페이지를 닫을 때도 보내지고 응답을 기다리지 않는다. 본문은 `text/plain`(JSON 글자)이다. `application/json`이면 브라우저가 CORS 사전 요청(OPTIONS)을 먼저 보내는데, `text/plain`은 그럴 필요가 없다. Nest는 기본으로 JSON만 읽어서, 앱 설정에 `text/plain` 본문 읽기를 더했다.

```ts
(app as NestExpressApplication).useBodyParser('text', { type: 'text/plain', limit: '32kb' });
```

이벤트는 다섯 종류다: `visit`(페이지를 열었다), `app`(앱 열기), `item`(글·프로젝트 보기), `link`(바깥 링크), `leave`(머문 시간). 검사는 댓글처럼 순수 함수(`parseBatch`)로 한다. 하나라도 틀리면 묶음 전체를 거절한다. 사이트의 버그를 조용히 삼키지 않으려는 것이다. 들어온 곳(`referrer`)은 **호스트 모양만** 받아서, 사이트가 실수로 검색어가 든 주소를 보내도 저장되지 않는다.

서버는 받은 이벤트에 몇 가지를 붙인다.

| 붙이는 값   | 어떻게                                                            |
| ----------- | ----------------------------------------------------------------- |
| 나라        | Cloudflare가 붙인 `CF-IPCountry`. 모름(`XX`)과 Tor(`T1`)는 버린다 |
| 브라우저·OS | User-Agent를 `Chrome`·`macOS` 같은 종류로 줄인다. 원문은 버린다   |
| 하루 해시   | `HMAC(날짜 + IP + User-Agent, 비밀 키)`                           |
| 가린 IP     | 마지막 자리를 `x`로                                               |

검색 로봇·링크 미리보기·자동 도구(User-Agent로 거른다)와 관리자 세션은 받기만 하고 저장하지 않는다. IP마다 1분에 30번까지 받는다. 사이트는 5초마다 보내니 넉넉하다.

![이벤트 저장 흐름](./images/analytics-api-pipeline.svg '받을 때 검사하고 값을 붙인다. 원본은 90일, 날마다 모은 숫자는 계속 둔다')

## 쿠키 없이 순방문자를 센다: 하루 해시

순방문자를 세려면 "같은 사람"을 알아봐야 한다. 쿠키를 주면 쉽지만 그러면 동의 배너가 필요하다. 대신 Plausible이 쓰는 방법을 따랐다.

```ts
export const dayHash = (day: string, ip: string, userAgent: string, secret: string) =>
	createHmac('sha256', secret).update(`analytics:${day}:${ip}:${userAgent}`).digest('hex');
```

같은 날 같은 IP·브라우저면 같은 값이라 하루 순방문자를 셀 수 있다. **날짜가 들어가서** 날이 바뀌면 같은 사람도 다른 값이 된다. 날을 넘겨 한 사람을 따라갈 수 없다는 뜻이다. 대신 "이번 주 순방문자"는 날마다 센 수의 합이다. 월요일과 화요일에 온 사람은 두 명으로 센다. 화면에도 그렇게 적을 생각이다.

비밀 키가 있어서 해시에서 IP를 되돌리려고 모든 IP를 넣어 볼 수도 없다.

![하루 해시로 순방문자 세기](./images/analytics-api-dayhash.svg '같은 사람이 월요일에 두 번, 화요일에 한 번 오면 월 1명, 화 1명이다')

한계도 있다. 같은 회사 사무실처럼 IP와 브라우저가 같은 두 사람은 한 명으로 센다. 휴대폰이 와이파이에서 LTE로 바뀌면 한 사람이 두 명이 된다. 포트폴리오 방문 수를 보기에는 이 정도 오차를 받아들일 만했다.

## 서버 한 대에 맞춘 저장: 이벤트는 90일, 숫자는 계속

서버는 RAM 1GB다. 이벤트 표를 계속 키우면 요약을 낼 때마다 무거워진다. 그래서 두 표로 나눴다.

- `AnalyticsEvent`: 이벤트 원본. **90일** 뒤 지운다. 가린 IP는 **7일** 뒤 비운다
- `DailyStat`: (날짜, 지표, 키, 값). 날마다 이벤트를 모은 숫자다. 사람을 가리는 값이 없어서 계속 둔다

`DailyStat`의 기본 키는 `(day, metric, key)` 셋이다. 지표는 방문·순방문자·앱 열기·머문 시간 같은 합계와 들어온 곳·앱·글·나라·기기·브라우저·OS·언어 같은 나눠 보기를 합쳐 16가지다.

```
2026-10-06 | visits   |            | 42
2026-10-06 | referrer | github.com | 17
2026-10-06 | item     | memo/hello |  9
```

모으는 일은 별도 작업 도구 없이 서버 안에서 한 시간마다 한다(`setInterval`, `unref`). 관리자가 요약을 열 때도 한 번 한다. 이벤트의 날짜는 브라우저가 아니라 **서버가 받은 시각**(한국 시간)으로 정한다. 그래서 어제의 이벤트가 오늘 늦게 들어오는 일이 없고, 한 번 모은 날은 다시 바뀌지 않는다. 모은 날에는 방문이 0이어도 `visits` 행을 꼭 남겨서, 다음에 그날을 다시 모으지 않는다.

요약(`GET /analytics/summary`)은 지난 날을 `DailyStat`에서, 오늘을 이벤트에서 바로 계산해 합친다. 하루치를 모으는 함수(`aggregate`)를 둘 다 같이 쓴다. 기간이 1년이어도 365일 × 몇십 행만 읽는다. 같은 길이의 앞 기간도 함께 내서 화면에서 ▲▼로 비교한다.

## 그 밖의 경로

- `GET /analytics/today`: 오늘 순방문자 수. 누구나 본다. 방문자마다 DB를 세지 않게 1분 동안 같은 값을 준다
- `GET /analytics/live`: 최근 30분의 방문을 방문마다 묶어, 나라·기기·들어온 곳·가린 IP와 흐름(페이지 열기 → 앱 열기 → 글 보기 → 링크)을 준다. 관리자만

## 시험

- 단위(`src/analytics/rules.test.ts`, 12개): 묶음 검사(텍스트·객체 모두, 틀린 것 거절), User-Agent 줄이기, 로봇 거르기, IP 가리기, 나라, 하루 해시가 날·IP·키에 따라 달라지는지, 한국 시간 날짜, 하루치 집계
- e2e(`test/analytics.e2e.test.ts`, 실제 PostgreSQL, 지금 10개): 처음부터 있던 것은 아래다.
  - **sendBeacon(text/plain)으로 받아, 나라·브라우저·하루 해시·가린 IP를 붙여 저장한다. 원래 IP와 User-Agent는 없다**: 저장한 행을 직접 열어 본다.
  - **로봇과 관리자 세션은 받기만 하고 저장하지 않는다. 형식이 틀리면 400**
  - **오늘 방문자: 같은 사람(IP·브라우저)의 두 방문은 한 명**: 같은 IP에서 Edge로 온 세 번째 방문은 다른 사람으로 센다.
  - **지난 날은 DailyStat으로 모으고 오늘은 이벤트에서 바로 센다. 앞 기간과 비교한다**
  - **정리: 90일이 지난 이벤트는 지우고(집계는 남는다), 7일이 지난 가린 IP는 지운다**
  - 실시간 흐름, **IP마다 1분에 30번까지**

무엇을 모으고 얼마나 두는지는 `docs/privacy.md`(52줄)에 같은 커밋으로 적었다. 사이트에서는 Apple 메뉴의 '개인정보 처리 방침'으로 연다.

## 그 뒤에 바뀐 것

- 같은 날 요약을 누구나 보게 바꿨다. 방문자에게는 들어온 곳의 주소와 `utm` 값을 빼고 묶음만 준다. 글별 전체 조회수 경로를 더하고, 한 방문에서 같은 글은 한 번만 센다([트래픽 분석 4](/memo/analytics-public)).
- 이벤트 묶음과 요약·실시간 응답의 모양을 `packages/contracts`로 옮겼다(PR [#206](https://github.com/hyeoniverse/MacFolio/pull/206), [분석 계약](/memo/contracts-analytics)). 보내는 사이트, 받는 서버, 읽는 화면이 같은 스키마를 쓴다.
- 쓰기 경로 전체에 같은 방식의 요청 제한을 걸 때 이 경로도 `@RateLimit`으로 옮겼다([요청 제한](/memo/rate-limit-all-writes)).

## 남은 것, 배운 것

- 순방문자는 날마다 센 수의 합이라, "이번 달 몇 명"은 실제보다 크게 나온다. 쿠키 없이 날을 넘겨 사람을 세는 방법은 없다. 숫자 옆에 그렇게 적는 것으로 정했다.
- 집계는 서버 안의 `setInterval`이라 서버가 여러 대가 되면 같은 날을 두 번 모을 수 있다. 지금은 한 대라 문제가 없고, 모은 날에는 `visits` 행을 꼭 남겨 다시 모으지 않게 했다.
- 원본을 오래 두지 않고 "날마다 모은 숫자"만 남기는 설계는, 개인정보와 서버 크기라는 두 제약을 한 번에 풀었다. 지울 날짜를 먼저 정하고 표를 나누니 설계가 쉬웠다.

## 직접 확인하기

모으는 것·모으지 않는 것·두는 기간은 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 표로 있다. 로컬에서 이벤트를 하나 보내고 요약에 잡히는지 본다.

```bash
pnpm --filter @macfolio/api db:up && pnpm dev:api
curl -s -X POST http://localhost:4000/analytics/events -H 'Content-Type: application/json' \
  -d '{"events":[{"type":"visit","path":"/"}]}' -o /dev/null -w '%{http_code}\n'
curl -s http://localhost:4000/analytics/today; echo     # 오늘 순방문자
```

몸통 모양은 계약(`packages/contracts/src/analytics.ts`)이 정하므로, 틀린 몸통은 400이 나는 것이 맞다. 정확한 필드는 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에서 본다. 하루 해시·90일 삭제·날마다 모으기는 시험이 확인한다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

되돌리는 법: 이벤트는 90일 뒤 지워지고 숫자 표만 남는다. 지금 바로 비우려면 DB에서 이벤트 표를 비우면 되지만, 이미 모은 일별 숫자는 남는다.

관련 글: [트래픽 분석 2 - 수집](/memo/analytics-collect), [트래픽 분석 3 - 활동 상태 보기](/memo/analytics-activity-monitor), [분석 계약](/memo/contracts-analytics), [트래픽 분석 4 - 공개](/memo/analytics-public)

#MacFolio #트래픽분석 #백엔드 #개인정보
