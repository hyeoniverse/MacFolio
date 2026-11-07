---
title: sendBeacon으로 5초마다 묶어 보내는 방문 이벤트
date: 2026-10-07
category: 개발 기록/MacFolio/서버·API
series: 트래픽 분석
seriesOrder: 2
summary: 사이트에서 페이지 열기, 앱 열기, 글 조회, 외부 링크 클릭, 체류 시간을 수집해 5초마다 sendBeacon으로 전송한다. 여러 곳의 window.open을 openExternal 하나로 통합하고, 로컬 주소와 Global Privacy Control에서는 수집을 끈다. 전송 방법 비교와 시험을 정리했다.
---

[쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API](/memo/analytics-api)에서 이벤트를 수신하는 API를 만들었다. 이번에는 사이트가 이벤트를 수집해 그 API로 전송하는 부분을 구현했다.

작업은 [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 커밋 하나다. 14개 파일에 417줄을 추가했다. 핵심 파일은 `src/shared/analytics/analytics.ts`(현재 205줄)와 `usage.ts`(25줄)다.

## 배경: 페이지 하나로 동작하는 사이트의 방문 집계

일반적인 블로그는 글마다 별도의 HTML 페이지가 있다. 방문자가 글 A를 열면 브라우저가 서버에 `GET /posts/a`를 요청하고, 서버의 접근 기록(access log)에 그 줄이 남는다. 그래서 서버 기록만 집계해도 어떤 글이 몇 번 열렸는지 알 수 있다.

MacFolio는 **단일 페이지 애플리케이션**(SPA, Single Page Application)이다. 첫 요청에서 HTML 한 장과 JavaScript 파일을 받은 뒤에는, 창을 열고 글을 넘기는 화면 전환을 모두 브라우저 안의 JavaScript가 처리한다. 예를 들어 방문자가 메모 앱을 열고 글 세 개를 읽은 뒤 GitHub 링크를 눌러도, 서버가 받는 요청은 첫 화면의 `GET /`와 JS 파일뿐이다.

![같은 조작을 했을 때 여러 페이지 사이트와 MacFolio가 서버에 보내는 요청 비교](./images/analytics-collect-spa-requests.svg '왼쪽은 글을 열 때마다 서버 요청이 생기고, 오른쪽은 첫 화면 이후 요청이 없다')

따라서 "어느 앱에서 무엇을 조회했는지"는 사이트가 직접 기록해 서버로 전송해야 한다. 이때 고려할 점은 세 가지다.

| 고려할 점        | 이유                                                                         | 이 글의 해당 절                                                             |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 무엇을 기록할까  | 기록할 동작을 정하지 않으면 클릭마다 이벤트가 생겨 지표가 의미를 잃는다      | [무엇을 언제 기록하나](#무엇을-언제-기록하나)                               |
| 언제 전송할까    | 이벤트마다 요청하면 요청이 많고, 페이지를 닫는 시각에는 요청이 누락되기 쉽다 | [전송: 5초마다, 그리고 탭이 숨겨질 때](#전송-5초마다-그리고-탭이-숨겨질-때) |
| 언제 수집을 끌까 | 개발 중 접속과 추적 거부 의사를 밝힌 방문자는 집계하지 않아야 한다           | [전송하지 않는 경우](#전송하지-않는-경우)                                   |

## 무엇을 언제 기록하나

이벤트(event)는 "방문자가 한 동작 하나"를 나타내는 기록이다. 다섯 종류를 정했다.

| 이벤트  | 기록 시각                                | 값의 출처                                                                                 |
| ------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `visit` | 페이지를 열 때 한 번                     | 처음 연 주소, `document.referrer`의 호스트, `utm_*`, 화면 폭(768px 미만이면 mobile), 언어 |
| `app`   | 앱을 새로 열 때                          | 앱 상태(`AppStateContext`)에서 실행 중이 아니던 앱이 실행 중으로 바뀔 때                  |
| `item`  | 메모의 글, Safari의 프로젝트를 조회할 때 | 주소 막대에 쓰는 값(`appAddresses`)이 바뀔 때                                             |
| `link`  | 외부 링크를 누를 때                      | 사이트 밖으로 이동하는 `<a>` 클릭, 그리고 새 탭을 여는 코드                               |
| `leave` | 탭이 숨겨질 때                           | 페이지를 연 뒤 경과한 시간                                                                |

`document.referrer`는 방문자가 직전에 있던 페이지의 주소다. GitHub 프로필의 링크를 눌러 들어왔다면 `https://github.com/...`이 들어 있고, 이 중 호스트(`github.com`)만 기록한다. `utm_*`는 링크 주소에 붙이는 캠페인 표시(`?utm_source=resume`)로, 이력서에 넣은 링크로 들어온 방문을 구분하는 데 쓴다.

### 앱 열기와 글 조회

`item`은 새로 만든 코드가 없다. 글 주소를 공유할 수 있게 만들 때, 앱마다 "현재 표시 중인 항목"을 알리는 저장소(`appAddresses`)를 만들었다. 주소 막대가 그 값을 구독해 `/memo/<글>`로 바뀐다([앱 링크와 주소 막대](/memo/app-links)). 분석도 같은 저장소를 구독하기만 하면 된다. 메모 앱에서 `cra-to-vite` 글을 열면 저장소 값이 `{ memo: 'cra-to-vite' }`로 바뀌고, 그 변화가 `{ type: 'item', app: 'memo', item: 'cra-to-vite' }` 이벤트 하나가 된다.

`app`은 처음부터 열려 있는 Safari 창을 집계하지 않는다. 사이트를 열면 Safari가 이미 열려 있는데, 방문자가 선택한 앱이 아니기 때문이다. 직전 상태와 비교해 "실행 중이 아니었다가 실행 중이 된" 앱만 집계한다.

```ts
export function newlyOpened<Name extends string>(
	before: Record<Name, { isRunning: boolean }>,
	now: Record<Name, { isRunning: boolean }>
): Name[] {
	return (Object.keys(now) as Name[]).filter((name) => now[name].isRunning && !before[name]?.isRunning);
}
```

| 직전 상태                 | 현재 상태                    | `newlyOpened` 결과 |
| ------------------------- | ---------------------------- | ------------------ |
| Safari 실행 중, 메모 꺼짐 | Safari 실행 중, 메모 실행 중 | `['memo']`         |
| 메모 실행 중(최소화)      | 메모 실행 중(복원)           | `[]`               |
| 메모 실행 중(뒤에 있음)   | 메모 실행 중(앞으로 가져옴)  | `[]`               |

창을 앞으로 가져오거나 최소화했다가 복원하는 동작은 집계하지 않는다. ==알고 싶은 지표는 "앱을 연 횟수"이지 "창을 누른 횟수"가 아니다==.

### 외부 링크

외부 링크는 두 경로로 열렸다.

| 경로                      | 예                                                                                    | 기록 방법                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<a target="_blank">`     | 글 안의 링크, 프로젝트 페이지의 버튼                                                  | 문서 전체에 클릭 리스너 하나를 캡처 단계로 등록([`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)의 `capture`) |
| 코드의 `window.open` 호출 | Dock의 링크 앱, Apple 메뉴의 GitHub 저장소, 터미널의 `open`, 웹 창의 '새 탭에서 열기' | 다섯 곳에 흩어져 있던 호출을 `openExternal(url)` 하나로 통합하고, 그 함수 안에서 기록                                                                            |

브라우저의 클릭 이벤트는 문서 최상위에서 클릭한 요소까지 내려가는 **캡처 단계**를 먼저 거치고, 클릭한 요소에서 다시 위로 올라가는 **버블링 단계**를 거친다. 문서에 캡처 단계 리스너를 등록하면 하위 컴포넌트의 클릭 처리보다 먼저 실행되므로, 하위 컴포넌트가 버블링 단계에서 `stopPropagation()`으로 전파를 중단해도 링크 클릭을 기록할 수 있다.

링크 주소는 호스트와 경로만 기록하고 쿼리 문자열과 `#` 뒤는 버린다(`linkLabel`).

| 누른 링크                                                     | 기록하는 `item`                   |
| ------------------------------------------------------------- | --------------------------------- |
| `https://github.com/hyeoniverse/MacFolio?tab=readme#setup`    | `github.com/hyeoniverse/MacFolio` |
| `https://macfolio.hyeoniverse.com/memo/app-links` (사이트 안) | 기록하지 않음                     |
| `mailto:...`                                                  | 기록하지 않음 (`http(s)`가 아님)  |

![openExternal 하나로 모으기](./images/analytics-collect-open-external.svg '여는 곳이 늘어도 기록하는 코드는 한 곳이다')

![수집 흐름](./images/analytics-collect-flow.svg '다섯 이벤트를 큐에 모아 5초마다, 탭이 숨겨지면 즉시 전송한다')

## 전송: 5초마다, 그리고 탭이 숨겨질 때

### 페이지가 닫히는 시각을 알 수 있는 이벤트

체류 시간(`leave`)은 방문자가 페이지를 떠나는 시각에 기록해야 한다. 브라우저는 페이지 상태가 바뀔 때마다 이벤트를 발생시키는데, 페이지를 떠날 때 사용할 수 있는 이벤트는 `beforeunload`, `pagehide`, `unload`, `visibilitychange` 등이다.

![Chrome의 Page Lifecycle 상태도. ACTIVE, PASSIVE, HIDDEN, FROZEN, TERMINATED 상태와 그 사이 이벤트를 보여 주며, beforeunload와 unload는 주황색(신뢰할 수 없음)으로 표시되어 있다](./images/analytics-collect-page-lifecycle.jpg '페이지 상태와 이벤트. 주황색 상자(beforeunload, unload)는 발생이 보장되지 않는 이벤트다. Chrome for Developers, Page Lifecycle API')

위 상태도에서 `beforeunload`와 `unload`는 "unreliable(신뢰할 수 없음)"로 표시되어 있다. 휴대폰에서 다른 앱으로 전환한 뒤 운영체제가 브라우저를 종료하면 이 이벤트는 발생하지 않는다. 반면 MDN은 `visibilitychange`가 `hidden`으로 바뀌는 시점을 "페이지가 안정적으로 관찰할 수 있는 마지막 이벤트"로 설명하고, 분석 데이터 전송에 이 시점을 쓰라고 권장한다. 탭을 바꾸거나, 탭을 닫거나, 브라우저를 최소화하거나, 휴대폰에서 다른 앱으로 전환하면 모두 `hidden`이 된다.

### 전송 방법 비교

| 방법                                     | 장점                                | 문제                                                                     |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| 이벤트마다 `fetch`                       | 가장 단순하다                       | 글을 넘길 때마다 요청. JSON이면 CORS 사전 요청까지 두 번                 |
| `beforeunload`/`unload`에서 한 번에      | 요청이 한 번                        | 휴대폰에서는 이 이벤트가 발생하지 않는 경우가 많다. 체류 시간이 누락된다 |
| 5초마다 + `visibilitychange` (고른 방법) | 요청이 적고, 숨겨지는 시각에도 전송 | 마지막 5초 안의 이벤트는 숨겨지는 시각의 전송에 의존한다                 |

이벤트는 즉시 전송하지 않고 큐(도착 순서대로 쌓아 두는 배열)에 모았다가 5초마다 한 번에 전송한다. 탭이 숨겨지면 그 시각까지의 체류 시간을 `leave`로 기록하고 기다리지 않고 전송한다.

![한 방문의 시간선](./images/analytics-collect-timeline.svg '5초마다 묶어 전송하고, 탭이 숨겨지면 leave와 함께 즉시 전송한다')

### sendBeacon과 CORS 사전 요청

전송에는 [`navigator.sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)을 사용한다. 분석·진단 데이터를 보내기 위해 만든 API로, 데이터를 브라우저의 전송 대기열에 넣고 바로 반환한다. 페이지가 닫히는 중에도 브라우저가 전송을 마치고, 응답은 기다리지 않는다. 대기열에 넣을 수 있는 데이터는 합계 64KiB이며, 넣지 못하면 `false`를 반환한다.

사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)는 호스트가 달라 출처(origin)가 다르다. 다른 출처로 요청할 때 브라우저는 CORS(Cross-Origin Resource Sharing) 규칙을 적용하는데, 본문 형식이 `application/json`이면 실제 요청 전에 `OPTIONS` 메서드의 **사전 요청**(preflight)을 먼저 보내 서버의 허락을 확인한다. 본문 형식이 `text/plain` 같은 세 가지 형식이면 사전 요청이 없는 **단순 요청**이 된다. `sendBeacon`에 문자열을 넘기면 `text/plain;charset=UTF-8`로 전송되므로 왕복이 한 번으로 줄어든다.

![JSON으로 보내면 사전 요청 OPTIONS와 본 요청 POST가 이어지고, sendBeacon 문자열은 POST 한 번으로 끝나는 비교](./images/analytics-collect-preflight.svg '위는 사전 요청 포함 왕복 2회, 아래는 단순 요청 1회. 탭을 닫는 순간에는 이 차이가 전송 성공 여부를 가른다')

```ts
// 문자열을 그대로 넘기면 text/plain으로 전송된다: CORS 사전 요청이 없다
if (!navigator.sendBeacon?.(url, body))
	void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include' }).catch(() => undefined);
```

`sendBeacon`이 `false`를 반환하면(본문이 너무 크거나 브라우저가 거절하면) [`keepalive`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) 옵션을 준 `fetch`로 한 번 더 전송한다. `keepalive: true`는 요청을 시작한 페이지가 닫혀도 요청을 중단하지 않게 하는 옵션이다. 한 묶음은 서버의 최대 수신 개수(`MAX_EVENTS`, 30개)를 넘지 않도록 나눠 전송하고, 서버는 `text/plain` 본문을 32KB까지 받아 JSON으로 해석한다.

전송되는 본문의 예는 다음과 같다. 같은 페이지 방문에서 나온 이벤트는 페이지를 열 때 만든 `visitId` 하나로 묶인다.

```json
{
	"visitId": "v-3f6c0e2a-…",
	"events": [
		{ "type": "visit", "path": "/", "referrer": "github.com", "device": "desktop", "language": "ko-KR" },
		{ "type": "app", "app": "memo" },
		{ "type": "item", "app": "memo", "item": "cra-to-vite" }
	]
}
```

`sendBeacon`은 쿠키도 함께 전송하므로, 관리자로 로그인한 브라우저의 요청은 서버가 식별해 집계에서 제외한다. 사이트와 API가 같은 등록 도메인(`hyeoniverse.com`)에 있는 같은 사이트(same-site)라서 `SameSite=Lax` 쿠키가 첨부된다.

## 전송하지 않는 경우

| 조건                                 | 이유                                                                                                                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 로컬 주소 (`localhost`, `127.0.0.1`) | 개발 중에 연 페이지가 지표에 섞이지 않는다. 화면 시험도 로컬 주소라 기본적으로 전송하지 않는다. 수집을 검사하는 시험만 `window.__MACFOLIO_ANALYTICS__ = true`로 활성화한다                |
| Global Privacy Control               | 브라우저가 [`navigator.globalPrivacyControl`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl)을 활성화했으면 전송하지 않는다. 시험용 스위치보다 우선한다 |
| 서버 주소가 없는 빌드                | 전송할 대상이 없다                                                                                                                                                                        |

```ts
if (!env.apiUrl || navigatorLike.globalPrivacyControl) return false;
if (globalThis.__MACFOLIO_ANALYTICS__ !== undefined) return globalThis.__MACFOLIO_ANALYTICS__;
return !/^(localhost|127\.0\.0\.1|\[::1\])$|\.local$/.test(location.hostname);
```

| 접속 환경                                       | `analyticsEnabled()` |
| ----------------------------------------------- | -------------------- |
| `macfolio.hyeoniverse.com`, GPC 꺼짐            | `true`               |
| `macfolio.hyeoniverse.com`, GPC 켜짐            | `false`              |
| `localhost:5173`                                | `false`              |
| `localhost:4173`, 시험이 스위치를 `true`로 설정 | `true`               |
| `localhost:4173`, 스위치 `true`, GPC 켜짐       | `false`              |

> [!IMPORTANT]
> 검사 순서가 곧 우선순위다. Global Privacy Control[^gpc]을 시험용 스위치보다 먼저 확인하므로, 시험이 스위치를 켜도 방문자의 거부가 우선한다.

## 방문자에게 표시하는 것

Apple 메뉴 맨 위에 "오늘 방문자 N명"을 추가했다. 메뉴를 열 때마다 `GET /analytics/today`를 조회한다. 서버가 1분간 같은 값을 응답하므로 메뉴를 자주 열어도 DB를 매번 집계하지 않는다. 서버에 연결되지 않으면 이 줄을 숨긴다.

그 아래 사이트 바로가기에 '개인정보 처리 방침'을 추가했다. 수집 항목과 보관 기간을 적은 `docs/privacy.md`를 **Finder 안에서** 연다. Finder는 저장소 문서를 빌드 시각에 번들에 포함하고 GitHub처럼 렌더링하지만, 외부에서 특정 문서를 열도록 요청하는 방법이 없었다. Finder는 처음 열 때 코드를 불러오는(lazy) 앱이라, 요청을 작은 저장소에 보관하고 Finder가 마운트되면서 읽어 가게 했다. 메모의 글을 Finder에서 열 때 쓰는 방식과 같다.

## 시험

- 단위(`src/shared/analytics/analytics.test.ts`, 처음 다섯 묶음에서 현재 8개): **배포 주소에서 켜고, 로컬 주소와 Global Privacy Control에서는 끈다**, **테스트는 로컬에서도 켤 수 있지만, Global Privacy Control은 이긴다**, 유입 경로는 호스트만, utm, **외부 링크는 호스트와 경로만**, **새로 연 앱: 실행 중이 아니었다가 실행 중이 된 앱만**.
- 화면(`e2e/analytics.spec.ts`, 가짜 API): 아래 순서로 조작한 뒤 전송된 이벤트를 검사한다.

| 조작                            | 전송되는 이벤트                            |
| ------------------------------- | ------------------------------------------ |
| `?utm_source=resume`으로 접속   | `visit` (utm, desktop)                     |
| 메모 열기                       | `app` (memo). 처음 열려 있던 Safari는 없음 |
| 글 조회                         | `item` (memo/cra-to-vite)                  |
| Apple 메뉴의 GitHub 저장소 클릭 | `link` (github.com/hyeoniverse/MacFolio)   |
| 탭 숨기기                       | `leave`                                    |

다섯 이벤트는 모두 같은 `visitId`를 갖는다. 로컬 주소와 Global Privacy Control에서는 아무것도 전송되지 않는다. Apple 메뉴에 "오늘 방문자 1,234명"이 표시되고, '개인정보 처리 방침'이 Finder에서 열리는 것도 확인한다.

## 그 뒤에 바뀐 것

- 서버 요청을 `shared/api/client.ts`의 `api()` 하나로 통합할 때([#196](https://github.com/hyeoniverse/MacFolio/pull/196), [공용 API 클라이언트](/memo/shared-modules#서버-호출-apiapifetch)) 오늘 방문자 수를 조회하는 코드도 옮겼다. `sendBeacon`은 응답을 읽지 않으므로 그대로 두었다.
- UTM을 다섯 가지(`source`, `medium`, `campaign`, `term`, `content`)로 늘리고, 읽은 `utm_*`는 주소창에서 삭제한다([출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics)). 예를 들어 `/memo/app-links?utm_source=resume&page=2`로 들어오면 주소창은 `/memo/app-links?page=2`가 된다. `utm_`로 시작하지 않는 쿼리는 그대로 둔다. ==삭제하지 않으면 새로 고칠 때마다 같은 캠페인이 다시 집계된다==.

## 남은 것, 배운 것

- 광고 차단기가 `/analytics/` 경로를 차단하면 아무것도 전송되지 않는다. 지표는 "차단하지 않은 방문자"만의 값이다.
- 체류 시간은 "페이지를 연 시각부터 탭이 숨겨진 시각까지"라, 탭을 열어 둔 채 다른 창에서 작업한 시간도 포함된다. 하루를 넘는 값은 24시간으로 제한한다.
- 새 기능을 만들기보다 기존 상태(`appAddresses`, 앱 상태)를 구독하는 편이 비용이 적었다. 주소 막대를 위해 만든 저장소가 분석의 `item` 이벤트를 추가 구현 없이 제공했다. 흩어진 `window.open`을 한 함수로 통합한 덕에, 외부 링크 기록을 추가할 위치도 한 곳으로 정해졌다.

다음은 이 지표를 조회하는 화면, [활동 상태 보기](/memo/analytics-activity-monitor) 앱이다.

## 직접 확인하기

개발자 도구 Network 탭에서 `analytics/events`로 필터링하고 사이트에서 앱을 몇 개 연다. 약 5초 뒤, 또는 다른 탭으로 전환하는 시각에 요청이 하나 전송된다. 요청 종류(Type) 열에는 `ping`(sendBeacon)으로 표시되고, 요청 헤더의 `Content-Type`은 `text/plain;charset=UTF-8`이다. 같은 시각에 `OPTIONS` 요청이 없는 것도 확인할 수 있다.

```bash
cd apps/react
npx vitest run src/shared/analytics           # 묶어 보내기·보내지 않는 때
npx playwright test e2e/analytics.spec.ts --project=desktop-chromium
```

> [!NOTE] 요청이 보이지 않는 경우
> `VITE_API_URL`이 없는 빌드와 로컬 주소에서는 전송하지 않는다. 그래서 로컬 컴퓨터에서 `pnpm dev`만 실행했을 때 요청이 보이지 않는 것이 정상이다. 관리자로 로그인한 브라우저의 요청은 전송되지만 서버가 저장하지 않는다. 수집 항목은 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 있다.

## 관련 글

- [쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API](/memo/analytics-api)
- [차트 라이브러리 없이 SVG 하나로 그리는 지표 그래프](/memo/analytics-activity-monitor)
- [같은 경로에서 세션에 따라 응답 범위를 나누는 분석 요약 API](/memo/analytics-api#요약을-방문자에게-공개한다-세션에-따라-응답-범위를-나눈다)
- [출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics)
- [앱 링크와 주소 막대](/memo/app-links)
- [공용 API 클라이언트](/memo/shared-modules#서버-호출-apiapifetch)

<details>
<summary>참고 문헌</summary>

- MDN, [Navigator: sendBeacon() method](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- MDN, [Document: visibilitychange event](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)
- MDN, [Cross-Origin Resource Sharing (CORS): Simple requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#simple_requests)
- MDN, [RequestInit: keepalive](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive)
- MDN, [EventTarget: addEventListener() method](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- MDN, [Navigator: globalPrivacyControl property](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/globalPrivacyControl)
- Philip Walton, [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), Chrome for Developers
- [Global Privacy Control](https://globalprivacycontrol.org/)

</details>

<details>
<summary>사진 출처</summary>

- Page Lifecycle 상태도: Philip Walton / Chrome for Developers, [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) ([원본 SVG](https://developer.chrome.com/static/docs/web-platform/page-lifecycle-api/image/page-lifecycle-api-state-a8e7c36ceae18.svg)), CC BY 4.0

</details>

[^gpc]: 브라우저가 웹사이트에 "내 데이터를 판매·공유하지 말라"는 의사를 전달하는 신호. 헤더 `Sec-GPC: 1`과 `navigator.globalPrivacyControl`로 전달된다([globalprivacycontrol.org](https://globalprivacycontrol.org/)).

#MacFolio #트래픽분석
