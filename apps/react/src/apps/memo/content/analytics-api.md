---
title: 쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API
date: 2026-10-07
category: 개발 기록/MacFolio/서버·API
series: 트래픽 분석
seriesOrder: 1
summary: 외부 분석 도구 대신 분석 API를 직접 만들었다. 쿠키 없이 하루 해시로 순방문자를 집계하고, 이벤트는 90일 뒤 삭제하고 일별 집계값만 보관한다. 같은 요약 경로에서 서버가 세션을 확인해 방문자에게는 분류 결과만 응답하고, 1분 캐시와 글 조회수를 추가했다.
---

**웹 분석**(web analytics)은 사이트에 누가, 어디서, 얼마나 들어와 무엇을 했는지를 집계하는 일이다. 대표 지표는 다음과 같다.

| 지표      | 뜻                                | 예                               |
| --------- | --------------------------------- | -------------------------------- |
| 방문      | 사이트를 연 횟수                  | 한 사람이 아침·저녁에 열면 2     |
| 순방문자  | 중복을 뺀 사람 수                 | 같은 사람의 두 방문은 1          |
| 유입 경로 | 방문 직전에 있던 사이트(referrer) | `github.com`, `www.linkedin.com` |
| 이벤트    | 방문 안에서 일어난 동작           | 메모 앱 열기, 글 조회, 링크 클릭 |

이력서와 채용 공고에 이 사이트 주소를 기재한다. 그런데 방문자의 유입 경로와, 방문 후 어떤 앱과 글을 조회했는지는 확인할 방법이 없었다. 다음 작업을 고를 근거가 없는 상태였다.

Google Analytics를 붙이면 쉽지만, 방문자를 식별하는 쿠키를 발급하므로 유럽 GDPR 같은 규정을 따르려면 동의 배너가 필요하고, 수집 항목을 직접 정할 수 없다. 또 이 사이트는 페이지 하나 안에서 창을 여는 구조라, 페이지 주소만으로는 "메모 앱에서 어느 글을 조회했는지"도 알 수 없다. 주소는 `/`에 머문 채 창만 바뀌기 때문이다. 후보를 비교했다.

| 방법                       | 장점                                | 버린 이유 / 고른 이유                                                       |
| -------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Google Analytics           | 연동이 쉽고 보고서 화면이 모두 있다 | 쿠키와 동의 배너. 창 안의 "어느 앱의 어느 글"은 별도 이벤트를 설계해야 한다 |
| Cloudflare Web Analytics   | 이미 Cloudflare를 쓴다. 쿠키가 없다 | 페이지 단위라 앱·글 이벤트를 기록할 수 없다                                 |
| Plausible 같은 호스팅 도구 | 쿠키 없는 집계 방식이 검증됐다      | 유료이거나 서버를 하나 더 실행해야 한다 (RAM 1GB 서버 한 대)                |
| 직접 만들기 (고른 방법)    | 수집 항목과 보관 기간을 직접 정한다 | 화면과 정리 작업까지 직접 구현해야 한다                                     |

그래서 직접 만들기로 했다. 순방문자 집계 방법은 [Plausible의 방식](https://plausible.io/data-policy)을 차용했다. 처음에는 관리자 전용으로 만들었고, 같은 날 요약을 방문자에게도 공개하도록 바꿨다([요약을 방문자에게 공개한다](#요약을-방문자에게-공개한다-세션에-따라-응답-범위를-나눈다)). 사이트 쪽 수집 코드는 [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)에, 지표를 표시하는 '활동 상태 보기' 앱은 [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor)에 있다.

## 정한 것

이슈 [#102](https://github.com/hyeoniverse/MacFolio/issues/102)에 결정 사항으로 남겨 둔 네 가지를 먼저 정했다.

| 항목                     | 결정                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| IP                       | 원래 IP는 저장하지 않는다. 관리자 화면용으로 마지막 자리를 마스킹한 IP(`203.0.113.x`)만 **7일** 보관 |
| 방문자에게 공개          | "오늘 방문자 N명" 하나만                                                                             |
| 앱 이름                  | macOS의 '활동 상태 보기'                                                                             |
| Cloudflare Web Analytics | 이번에는 활성화하지 않는다                                                                           |

방문자에게 공개하는 범위는 뒤에 요약 전체로 넓혔다. 작업은 [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 첫 커밋이다. 12개 파일에 1,362줄을 추가했다. 처음에는 `AnalyticsService` 하나였고, 뒤에 저장·집계·조회 세 서비스로 나눴다([트래픽 분석 서비스 나누기](/memo/analytics-service-split)). 2026-10-23 기준 `apps/api/src/analytics/`의 주요 파일은 다음과 같다.

| 파일                            | 줄  | 역할                                                             |
| ------------------------------- | --- | ---------------------------------------------------------------- |
| `rules.ts`                      | 219 | 검사, User-Agent 축약, 로봇 판별, IP 마스킹, 하루 해시           |
| `analytics-recorder.service.ts` | 68  | 수신한 묶음에 값을 붙여 저장                                     |
| `analytics-rollup.service.ts`   | 80  | 한 시간마다 지난 날짜를 `DailyStat`으로 집계, 90일·7일 기준 정리 |
| `analytics-stats.service.ts`    | 246 | 요약, 오늘 방문자, 실시간                                        |
| `analytics.controller.ts`       | 161 | 경로와 요청 제한                                                 |

## 수신: `POST /analytics/events`

사이트는 이벤트를 모아 [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)으로 전송한다. `sendBeacon`은 분석 데이터를 보내기 위해 만든 브라우저 API로, 페이지를 닫는 순간에도 전송을 마치고 응답을 기다리지 않는다. 일반 `fetch`는 탭을 닫으면 진행 중인 요청이 취소될 수 있어, 마지막 체류 시간 이벤트(`leave`)를 잃는다.

본문은 `text/plain`(JSON 문자열)이다. 사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)는 출처(origin)가 달라서, 브라우저는 CORS 규칙을 적용한다. `Content-Type`이 `application/json`이면 브라우저가 본 요청 전에 CORS 사전 요청(OPTIONS)[^preflight]을 먼저 보내는데, `text/plain`은 **단순 요청**이라 사전 요청이 필요 없다.

![application/json은 OPTIONS 사전 요청과 응답 뒤에 POST를 보내 왕복이 2번이고, text/plain은 POST 한 번에 204를 받는다](./images/analytics-api-preflight.svg '본문 형식에 따른 요청 순서 (도식)')

Nest는 기본적으로 JSON 본문만 파싱하므로, 앱 설정에 `text/plain` 본문 파싱을 추가했다. 문자열로 받은 본문은 검사 함수가 JSON으로 해석한다.

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

검사는 댓글과 마찬가지로 순수 함수(`parseBatch`)로 한다. 하나라도 형식이 틀리면 묶음 전체를 거절한다. ==사이트의 버그를 서버가 조용히 무시하지 않게== 하기 위해서다. 예를 들어 이벤트 10개 중 1개의 `type`이 오타로 `vist`이면 10개 모두 400으로 거절되고, 사이트의 E2E 시험이 그 400을 바로 검출한다. 유입 경로(`referrer`)는 **호스트 형식만** 허용하므로, 사이트가 실수로 `www.google.com/search?q=포트폴리오` 같은 검색어가 포함된 주소를 보내도 저장되지 않는다.

서버는 수신한 이벤트에 다음 값을 붙인다.

| 붙이는 값   | 방법                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 국가        | Cloudflare가 붙인 [`CF-IPCountry`](https://developers.cloudflare.com/fundamentals/reference/http-headers/) 헤더. 알 수 없음(`XX`)과 Tor(`T1`)는 버린다 |
| 브라우저·OS | User-Agent를 `Chrome`·`macOS` 같은 분류로 축약한다. 원문은 버린다                                                                                      |
| 하루 해시   | `HMAC(날짜 + IP + User-Agent, 비밀 키)`                                                                                                                |
| 마스킹된 IP | 마지막 자리를 `x`로                                                                                                                                    |

**User-Agent**는 브라우저가 요청마다 보내는 자기 소개 문자열이다. `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36`처럼 길고 버전까지 자세해서, 다른 값과 합치면 개인을 구분하는 단서가 된다. 그래서 `Chrome`·`macOS`로 줄인 값만 저장한다. IP도 `203.0.113.7`을 `203.0.113.x`로 바꿔 같은 대역의 256개 주소 중 어느 것인지 알 수 없게 한다.

검색 로봇·링크 미리보기·자동화 도구(User-Agent로 필터링)와 관리자 세션의 요청은 수신만 하고 저장하지 않는다. IP마다 1분에 30회까지 허용한다. 사이트는 5초마다 전송하므로(1분에 최대 12회) 여유가 있다.

![이벤트 저장 흐름](./images/analytics-api-pipeline.svg '수신 시 검사하고 값을 붙인다. 원본은 90일, 일별 집계값은 계속 보관한다')

## 쿠키 없이 순방문자를 집계한다: 하루 해시

순방문자를 집계하려면 "같은 사람"을 식별해야 한다. 쿠키를 발급하면 쉽지만 동의 배너가 필요하다. 대신 Plausible이 쓰는 방법을 따랐다. 요청에 이미 들어 있는 값(IP, User-Agent)에 날짜를 더해 **HMAC**으로 바꾼다. HMAC은 비밀 키와 입력을 함께 해시해 고정 길이 값을 만드는 방법으로[^hmac], 같은 키·같은 입력이면 같은 값이 되고 키 없이는 계산하거나 되돌릴 수 없다.

```ts
export const dayHash = (day: string, ip: string, userAgent: string, secret: string) =>
	createHmac('sha256', secret).update(`analytics:${day}:${ip}:${userAgent}`).digest('hex');
```

같은 날 같은 IP·브라우저면 같은 값이므로 하루 순방문자를 집계할 수 있다. **날짜가 입력에 포함되므로** 날짜가 바뀌면 같은 사람도 다른 값이 된다. ==날짜를 넘어 한 사람을 추적할 수 없다==는 뜻이다. 대신 "이번 주 순방문자"는 일별 집계값의 합이다. 월요일과 화요일에 방문한 사람은 두 명으로 집계된다. 화면에도 그렇게 표기한다.

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

이런 방식을 **롤업**(rollup)이라고 한다. 원본 이벤트 수천 개를 "그날 방문 42, github.com 유입 17" 같은 합계 몇십 행으로 접어 두고, 원본은 기간이 지나면 삭제한다.

`DailyStat`의 기본 키는 `(day, metric, key)` 세 열이다. 지표는 방문·순방문자·앱 열기·체류 시간 같은 합계와 유입 경로·앱·글·국가·기기·브라우저·OS·언어 같은 분류별 집계를 합쳐 16가지다.

```
2026-10-06 | visits   |            | 42
2026-10-06 | referrer | github.com | 17
2026-10-06 | item     | memo/hello |  9
```

집계는 별도 작업 스케줄러 없이 서버 프로세스 안에서 한 시간마다 실행한다(`setInterval`, `unref`[^unref]). 관리자가 요약을 열 때도 한 번 실행한다. 이벤트의 날짜는 브라우저 시각이 아니라 **서버의 수신 시각**(한국 시간)으로 정한다. 브라우저 시계는 사용자가 바꿀 수 있고 시간대도 제각각이라, 브라우저 시각을 쓰면 오늘 수신한 이벤트가 어제 날짜로 들어올 수 있다. 서버 시각을 쓰면 어제 날짜의 이벤트가 오늘 늦게 들어오는 경우가 없고, ==한 번 집계한 날짜는 다시 바뀌지 않는다==. 집계한 날짜에는 방문이 0이어도 `visits` 행을 반드시 기록해서, 다음 실행에서 그 날짜를 다시 집계하지 않는다.

요약(`GET /analytics/summary`)은 지난 날짜를 `DailyStat`에서, 오늘을 이벤트에서 바로 계산해 합친다. 하루치를 집계하는 함수(`aggregate`)를 두 경로가 공유한다. 기간이 1년이어도 365일 × 수십 행만 읽는다. 같은 길이의 직전 기간 값도 함께 응답해서 화면에서 ▲▼로 비교한다.

![10월 7일에 7일 요약을 요청하면 10월 1~6일은 DailyStat에서, 10월 7일은 이벤트를 aggregate로 집계해 합치고, 직전 7일인 9월 24~30일도 DailyStat에서 읽어 previous로 비교한다](./images/analytics-api-summary-merge.svg '요약 하나를 만드는 순서 (도식, 숫자는 예시)')

## 그 밖의 경로

| 경로                            | 응답                                                                                                                | 권한   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| `GET /analytics/today`          | 오늘 순방문자 수. 방문자마다 DB를 조회하지 않도록 1분간 같은 값을 응답한다                                          | 누구나 |
| `GET /analytics/live`           | 최근 30분의 방문을 방문 단위로 묶어, 국가·기기·유입 경로·마스킹된 IP와 흐름(페이지 열기 → 앱 열기 → 글 조회 → 링크) | 관리자 |
| `GET /analytics/views?app=memo` | 글마다 전체 기간 조회수([블로그 글 조회수](#블로그-글-조회수))                                                      | 누구나 |

## 요약을 방문자에게 공개한다: 세션에 따라 응답 범위를 나눈다

처음 만든 '활동 상태 보기'([차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor))는 관리자 전용이었다. 방문자가 열면 잠긴 화면만 표시됐다. 포트폴리오를 조회하러 온 사람에게 "직접 만든 분석이 이렇게 동작한다"를 보여 줄 수 있는 앱인데, 정작 그 사람은 조회할 수 없었다. Launchpad에도 표시되지 않아 앱의 존재조차 알 수 없었다.

관리자 전용 버전을 커밋하고 세 시간이 안 되어 같은 PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)에서 방향을 바꿨다. 서버 쪽 커밋은 7개 파일 220줄, 화면 쪽 커밋은 13개 파일 211줄을 추가했다.

### 공개할 지표와 관리자 전용 지표

모든 지표를 공개할 수는 없었다. 문제가 되는 값은 두 가지였다.

| 값                     | 공개하면 드러나는 것                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 캠페인(`utm_campaign`) | 이력서나 지원서에 붙이는 링크에는 보통 회사 이름을 넣는다. 그대로 공개하면 지원한 회사가 드러난다. 유입 호스트도 비슷하다 |
| 실시간                 | 방문 하나하나의 이벤트 흐름과 마스킹된 IP가 있다. 합계가 아니라 개인 단위다                                               |

`utm_campaign`은 링크 주소 끝에 붙이는 추적용 매개변수다. 예를 들어 어느 회사 지원서에 `…/?utm_source=resume&utm_campaign=kakao-2026`을 붙이면, 그 링크로 들어온 방문은 캠페인 `kakao-2026`으로 집계된다. 이 표를 공개하면 방문자 누구나 "kakao-2026"이라는 지원 기록을 볼 수 있다.

그래서 다음과 같이 나눴다.

| 누구나                                                                                                                                                  | 관리자만                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 개요(방문·순방문자·앱 열기·체류 시간, 그래프), 앱·글·외부 링크, 국가·기기·브라우저·OS·언어, 유입 경로의 **분류**(검색·소셜·직접·링크), 블로그 글 조회수 | 유입 호스트, `utm_source`·`utm_campaign`, 실시간 |

같은 가짜 응답으로 방문자 화면을 캡처하면, 관리자 화면에서 `github.com`·`www.linkedin.com` 같은 호스트가 표시되던 표가 "들어온 곳"이라는 제목 아래 링크·직접·소셜·검색 분류로만 표시된다. 숫자(412, 301, 188, 90)는 같다.

![방문자로 연 개요 탭](./images/analytics-public-visitor.jpg '유입 경로 표가 호스트 대신 분류로 표시된다')

### 응답 범위를 나누는 위치

| 방법                                             | 장점                                 | 문제                                                       |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| 화면에서만 숨기기                                | 서버를 수정하지 않는다               | 값은 이미 브라우저에 전송됐다. 개발자 도구로 모두 조회된다 |
| 방문자용 경로를 별도로 (`/summary/public`)       | 경로마다 권한이 명확하다             | 계산 코드가 둘로 나뉘거나, 같은 함수를 두 번 감싸야 한다   |
| 같은 경로, 서버가 세션을 확인해 분기 (고른 방법) | 계산은 하나, 응답에 `scope`가 붙는다 | 경로에 Guard를 붙일 수 없어 서비스 안에서 분기해야 한다    |

### 서버가 세션을 확인해 표를 정한다

요약 경로(`GET /analytics/summary`)는 누구나 호출할 수 있게 열되, **서버가** 관리자 세션을 확인해 응답할 표를 정한다. 관리자가 아니면 유입 호스트와 utm 표를 빈 목록으로 응답하고, 응답에 `scope: 'public'`을 기록한다. 실시간(`/analytics/live`)은 계속 관리자만 호출할 수 있다.

![요약 응답을 서버가 나눈다](./images/analytics-public-scope.svg '같은 경로에서 관리자 세션 여부로 응답할 표를 정한다')

```ts
const hidden = new Set<string>(scope === 'admin' ? [] : ADMIN_ONLY_BREAKDOWNS);
```

어느 표가 관리자 전용인지는 목록(`ADMIN_ONLY_BREAKDOWNS`) 하나로 정한다. 현재 이 목록은 `packages/contracts/src/analytics.ts`에 있어서, 화면도 같은 목록으로 안내 문구를 표시한다. 표를 하나 추가할 때 이 목록에 넣을지만 결정하면 된다.

유입 경로의 분류(검색·소셜·직접·링크)는 화면에서 하던 것을 서버로 옮겼다. 방문자에게 호스트를 보내지 않으므로 분류도 서버가 해야 한다. 그 결과 규칙이 한 곳에만 존재하게 됐다. 지난 날짜의 집계는 호스트별로 저장돼 있어서, 요약을 계산할 때 호스트를 분류로 변환해 합산한다. 예를 들어 `www.google.com 5`, `search.naver.com 3`은 '검색 8'로, `www.linkedin.com 4`는 '소셜 4'로 합친다. 저장된 집계를 다시 만들 필요가 없다.

![방문자와 관리자의 길](./images/analytics-public-paths.svg '방문자 요청은 1분 캐시와 5분에 한 번 집계를 거친다')

### 공개 경로의 부하: 1분 캐시

누구나 호출하는 경로가 되면서 부하도 고려했다.

| 대책           | 방문자 요청                                                                      | 관리자 요청    |
| -------------- | -------------------------------------------------------------------------------- | -------------- |
| 응답 캐시      | 같은 기간이면 1분간 같은 값을 응답 (1년치를 반복 요청해도 DB를 매번 읽지 않는다) | 캐시 없음      |
| 지난 날짜 집계 | 5분에 한 번만 실행 (날짜가 바뀌었으면 즉시)                                      | 열 때마다 실행 |

```ts
private async cached<T>(key: string, now: Date, compute: () => Promise<T>): Promise<T> {
	const hit = this.publicCache.get(key);
	if (hit && now.getTime() - hit.at < PUBLIC_CACHE_MS) return hit.value as T;
	const value = await compute();
	if (this.publicCache.size > 500) this.publicCache.clear();
	this.publicCache.set(key, { at: now.getTime(), value });
	return value;
}
```

캐시는 서버 메모리의 `Map` 하나다. 키는 `summary:<from>:<to>`라 기간 조합마다 하나씩 생긴다. 예를 들어 방문자 100명이 1분 안에 같은 7일 요약을 열면, DB를 읽는 요청은 첫 1명뿐이고 나머지 99명은 메모리의 값을 받는다. 누군가 기간을 바꿔 가며 계속 호출하면 키가 무한히 늘어날 수 있으므로, ==500개를 넘으면 전체를 비운다==. Redis를 도입하기에는 서버가 작고, 1분짜리 캐시가 사라져도 다시 계산하면 된다.

### 화면은 `scope`에 따라 렌더링한다

| 위치             | 방문자에게 표시하는 것                         |
| ---------------- | ---------------------------------------------- |
| 개요의 유입 경로 | '유입이 가장 많은 경로' 대신 분류 표           |
| 유입 경로 탭     | 분류 표와 "관리자만 볼 수 있습니다" 안내       |
| 실시간 탭        | 안내와 로그인 버튼만. 서버에 요청하지도 않는다 |

앱 정보의 `adminOnly`와, Launchpad·홈 화면·Finder에서 앱을 숨기던 코드는 제거했다.

## 블로그 글 조회수

글을 조회할 때마다 `item` 이벤트(`memo/<글 주소>`)가 이미 전송되고 있었다. 집계 규칙 하나와 경로 하나를 추가했다.

- **한 방문에서 같은 글은 한 번.** 메모에서 글 사이를 오가면 같은 글을 여러 번 선택하게 된다. 하루치를 집계할 때 (방문, 글) 쌍마다 한 번만 집계한다. 예를 들어 한 방문에서 A → B → A 순서로 글을 열면 A 1, B 1이다.
- **`GET /analytics/views?app=memo`:** 글마다 전체 기간 조회수. 지난 날짜는 일별 집계값의 합, 오늘은 이벤트에서 바로 집계한다. 누구나 호출할 수 있고 1분간 같은 값을 응답한다.

메모는 앱을 열 때 이 값을 한 번 조회해, 글 머리의 날짜 옆에 "조회 42"를 표시한다. 서버가 없으면 표시하지 않는다. '활동 상태 보기'의 앱·글 탭에는 "블로그 글 조회수 (전체 기간)" 표를 추가하고, 글 주소 대신 제목을 표시한다. 기간별 "글·프로젝트" 표도 메모 글은 제목으로 바꿨다.

## 탭을 바꾸면 정렬이 유지되던 버그

화면 시험을 수정하다가 버그를 하나 발견했다.

1. 유입 경로 탭에서 표를 이름순으로 정렬한다.
2. 앱·글 탭으로 이동한다.
3. 블로그 글 조회수 표가 조회수 내림차순이 아니라 이름 역순으로 표시된다.

탭마다 표의 내용은 다르지만, React 입장에서는 **같은 위치의 같은 컴포넌트**였다. ==React는 트리에서 위치가 같은 컴포넌트의 상태를 유지==하므로([React 문서: 상태 보존과 초기화](https://react.dev/learn/preserving-and-resetting-state)), 표 내부의 정렬 상태는 그대로 두고 데이터만 교체했다. 탭 본문에 `key={tab}`을 지정해 탭이 바뀌면 컴포넌트를 새로 마운트하도록 수정했다. `key`가 바뀌면 React는 이전 컴포넌트와 그 상태를 버리고 새로 만든다. 기존 시험이 이 버그를 그대로 검출한다: 이름순으로 바꾼 뒤 앱·글 탭에서 조회수 내림차순인지 확인한다.

![key={tab}으로 고친 버그](./images/analytics-public-tab-key.svg '정렬 상태가 표 안에 있어서, 위치가 같으면 탭을 넘어 유지됐다')

정렬 상태를 탭마다 상위 컴포넌트로 끌어올리는 방법도 있었다. 그러나 탭을 오갈 때 정렬을 기억할 이유가 없었고, `key` 한 줄이 변경 범위가 더 작았다.

## 시험

| 종류     | 파일                                   | 확인 내용                                                                                                                                                                                                                                        |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API 단위 | `apps/api/src/analytics/rules.test.ts` | 처음 12개: 묶음 검사(문자열·객체 모두, 잘못된 형식 거절), User-Agent 축약, 로봇 필터링, IP 마스킹, 국가, 하루 해시가 날짜·IP·키에 따라 달라지는지, 한국 시간 날짜, 하루치 집계. 공개 작업에서 한 방문에서 같은 글은 한 번, 유입 경로 분류를 추가 |
| API e2e  | `apps/api/test/analytics.e2e.test.ts`  | 실제 PostgreSQL, 현재 10개                                                                                                                                                                                                                       |
| 화면     | `apps/react/e2e/activity.spec.ts`      | **방문자도 Launchpad에서 열어 공개 숫자를 본다. 들어온 곳의 주소·캠페인과 실시간은 관리자만**, **블로그 글 머리에 조회수 (전체 기간). 서버가 없으면 감춘다**, **서버가 없으면 블로그 글에 조회수가 없다**                                        |

<details>
<summary>e2e 시험 목록</summary>

처음부터 있던 시험:

- **sendBeacon(text/plain)으로 받아, 나라·브라우저·하루 해시·가린 IP를 붙여 저장한다. 원래 IP와 User-Agent는 없다**: 저장한 행을 직접 조회해 확인한다.
- **로봇과 관리자 세션은 받기만 하고 저장하지 않는다. 형식이 틀리면 400**
- **오늘 방문자: 같은 사람(IP·브라우저)의 두 방문은 한 명**: 같은 IP에서 Edge로 접속한 세 번째 방문은 다른 사람으로 집계한다.
- **지난 날은 DailyStat으로 모으고 오늘은 이벤트에서 바로 센다. 앞 기간과 비교한다**
- **정리: 90일이 지난 이벤트는 지우고(집계는 남는다), 7일이 지난 가린 IP는 지운다**
- 실시간 흐름, **IP마다 1분에 30번까지**

공개 작업에서 추가한 시험:

- **요약은 누구나 보지만 방문자에게는 들어온 곳의 호스트·utm이 없다. 실시간은 관리자만**: 응답 JSON 전체를 문자열로 변환해 `kakao-2026` 같은 캠페인 값이 어디에도 없는지 확인한다. 표 하나만 검사하면 다른 필드로 유출되는 경우를 놓친다.
- **글 조회수: 전체 기간, 한 방문에서 같은 글은 한 번. 누구나 본다**: 지난 날짜의 합과 오늘 값을 더하는지까지 확인한다.

</details>

수집 항목과 보관 기간은 첫 커밋에서 `docs/privacy.md`(52줄)에 기록했다. 사이트에서는 Apple 메뉴의 '개인정보 처리 방침'으로 연다.

## 그 뒤에 바뀐 것

- 이벤트 묶음과 요약·실시간 응답의 형식을 `packages/contracts`로 옮겼다([#206](https://github.com/hyeoniverse/MacFolio/pull/206), [분석 계약](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206)). 전송하는 사이트, 수신하는 서버, 조회하는 화면이 같은 스키마를 사용한다.
- 쓰기 경로 전체에 같은 방식의 요청 제한을 걸 때 이 경로도 `@RateLimit`으로 옮겼다([요청 제한](/memo/rate-limit-all-writes)).

## 남은 것, 배운 것

- 순방문자는 일별 집계값의 합이라 "이번 달 방문자 수"는 실제보다 크게 나온다. 쿠키 없이 날짜를 넘어 사람을 식별하는 방법은 없다. 숫자 옆에 그 사실을 표기하기로 했다.
- 집계는 서버 안의 `setInterval`이고 공개 요약 캐시는 서버 메모리에 있다. 서버가 여러 대가 되면 같은 날짜를 두 번 집계하거나 서버마다 다른 값을 응답할 수 있고, 재시작하면 캐시가 비워진다. 현재는 한 대라 문제가 없고, 집계한 날짜에는 `visits` 행을 반드시 기록해 재집계를 막았다.
- 국가·언어 표는 방문자에게도 표시된다. 방문이 매우 적은 날에는 "어제 일본에서 1명"처럼 개인을 추정할 수도 있다. 현재 방문 규모에서는 허용했지만, 작은 값을 "기타"로 묶어 표시하는 방법을 검토할 만하다.
- 원본을 오래 보관하지 않고 일별 집계값만 남기는 설계로 개인정보와 서버 용량이라는 두 제약을 함께 해결했다. 삭제 시점을 먼저 정하고 테이블을 나누니, 집계·요약·정리 작업의 범위가 그 기준에 맞춰 정해졌다.
- 공개 여부는 "합계인가, 개인 단위인가"와 "작은 값이 무엇을 드러내는가"라는 두 기준으로 판단했다. 캠페인 이름은 합계여도 지원한 회사를 드러낸다.

## 직접 확인하기

수집하는 항목·수집하지 않는 항목·보관 기간·공개하는 지표의 범위는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 표로 있다. 로컬에서 이벤트를 하나 보내고 요약에 반영되는지 확인한다.

```bash
pnpm --filter @macfolio/api db:up && pnpm dev:api
curl -s -X POST http://localhost:4000/analytics/events -H 'Content-Type: application/json' \
  -d '{"events":[{"type":"visit","path":"/"}]}' -o /dev/null -w '%{http_code}\n'
curl -s http://localhost:4000/analytics/today; echo     # 오늘 순방문자
```

> [!NOTE]
> 본문 형식은 계약(`packages/contracts/src/analytics.ts`)이 정하므로, 형식이 틀린 본문은 400이 정상이다. 정확한 필드는 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에서 확인한다.

배포한 서버에서 같은 요약 경로를 방문자로 호출하면 응답의 `scope`는 `public`이고, 유입 경로는 분류 이름만 있다.

```bash
curl -s "https://macfolio-api.hyeoniverse.com/analytics/summary" | head -c 400; echo
curl -s "https://macfolio-api.hyeoniverse.com/analytics/views?app=memo" | head -c 200; echo   # 글 조회수
```

관리자 쪽은 브라우저에서 로그인한 상태로 활동 상태 보기를 열어 호스트·UTM 표가 표시되는지 확인한다. 하루 해시·90일 삭제·일별 집계·응답 범위 분기는 시험이 검사한다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test -- src/analytics/rules.test.ts
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

> [!TIP] 되돌리는 방법
> 이벤트는 90일 뒤 삭제되고 집계 테이블만 남는다. 즉시 비우려면 DB에서 이벤트 테이블을 비우면 되지만, 이미 집계한 일별 값은 남는다.

## 관련 글

- [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect): 사이트 쪽 수집 코드
- [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor): 요약을 그리는 '활동 상태 보기' 화면
- [출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics): 관리자 전용으로 남긴 캠페인 집계
- [분석 계약](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206): 이벤트와 응답 형식을 `packages/contracts`로 옮긴 작업
- [트래픽 분석 서비스 나누기](/memo/analytics-service-split): 서비스 하나를 저장·집계·조회로 분리
- [요청 제한](/memo/rate-limit-all-writes): 수신 경로의 요청 제한을 `@RateLimit`으로 통일

[^preflight]: 브라우저가 다른 출처로 본 요청을 보내기 전에, 서버가 그 요청을 허용하는지 `OPTIONS`로 먼저 확인하는 요청. `text/plain` 같은 단순 요청은 생략된다([MDN](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)).

[^hmac]: [RFC 2104: HMAC](https://www.rfc-editor.org/rfc/rfc2104).

[^unref]: Node.js 타이머의 `unref()`는 그 타이머만 남았을 때 프로세스가 종료되지 못하게 막지 않도록 한다([Node.js 문서](https://nodejs.org/api/timers.html#timeoutunref)).

<details>
<summary>참고 문헌</summary>

- [Plausible: Data policy](https://plausible.io/data-policy)
- [MDN: Navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [MDN: Cross-Origin Resource Sharing (CORS), 단순 요청](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#simple_requests)
- [MDN: Preflight request](https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request)
- [MDN: User-Agent](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent)
- [Cloudflare: HTTP request headers (CF-IPCountry)](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [RFC 2104: HMAC: Keyed-Hashing for Message Authentication](https://www.rfc-editor.org/rfc/rfc2104)
- [Node.js: timeout.unref()](https://nodejs.org/api/timers.html#timeoutunref)
- [React 문서: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [Google Analytics 도움말: URL builders: Collect campaign data with custom URLs](https://support.google.com/analytics/answer/10917952)

</details>

#MacFolio #트래픽분석 #백엔드 #개인정보
