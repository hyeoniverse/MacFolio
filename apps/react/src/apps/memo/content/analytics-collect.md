---
title: 트래픽 분석 2 - 사이트에서 모아 보내기
date: 2026-10-07
category: 개발 기록/MacFolio/백엔드/분석
summary: 사이트에서 페이지 열기, 앱 열기, 글 조회, 외부 링크 클릭, 체류 시간을 수집해 5초마다 sendBeacon으로 전송한다. 여러 곳의 window.open을 openExternal 하나로 통합하고, 로컬 주소와 Global Privacy Control에서는 수집을 끈다. 전송 방법 비교와 시험을 정리했다.
---

[트래픽 분석 1](/memo/analytics-api)에서 이벤트를 수신하는 API를 만들었다. 이번에는 사이트 쪽이다. 이 사이트는 페이지 하나 안에서 창을 여는 구조라, 서버가 받는 요청은 첫 페이지와 코드 파일뿐이다. 메모 앱을 열고 글 세 개를 읽은 뒤 GitHub 링크를 눌러도 새 페이지 요청은 발생하지 않는다. "어느 앱에서 무엇을 조회했는지"는 사이트가 직접 전송해야 한다.

작업은 [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 커밋 하나다. 14개 파일에 417줄을 추가했다. 핵심은 `src/shared/analytics/analytics.ts`(현재 205줄)와 `usage.ts`(25줄)다.

## 무엇을 언제 기록하나

| 이벤트  | 기록 시각                                | 값의 출처                                                                                 |
| ------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `visit` | 페이지를 열 때 한 번                     | 처음 연 주소, `document.referrer`의 호스트, `utm_*`, 화면 폭(768px 미만이면 mobile), 언어 |
| `app`   | 앱을 새로 열 때                          | 앱 상태(`AppStateContext`)에서 실행 중이 아니던 앱이 실행 중으로 바뀔 때                  |
| `item`  | 메모의 글, Safari의 프로젝트를 조회할 때 | 주소 막대에 쓰는 값(`appAddresses`)이 바뀔 때                                             |
| `link`  | 외부 링크를 누를 때                      | 사이트 밖으로 이동하는 `<a>` 클릭, 그리고 새 탭을 여는 코드                               |
| `leave` | 탭이 숨겨질 때                           | 페이지를 연 뒤 경과한 시간                                                                |

`item`은 새로 만든 코드가 없다. 글 주소를 공유할 수 있게 만들 때, 앱마다 "현재 표시 중인 항목"을 알리는 저장소(`appAddresses`)를 만들었다. 주소 막대가 그 값을 구독해 `/memo/<글>`로 바뀐다([앱 링크와 주소 막대](/memo/app-links)). 분석도 같은 저장소를 구독하기만 하면 된다.

`app`은 처음부터 열려 있는 Safari 창을 집계하지 않는다. 사이트를 열면 Safari가 이미 열려 있는데, 방문자가 선택한 앱이 아니기 때문이다. 직전 상태와 비교해 "실행 중이 아니었다가 실행 중이 된" 앱만 집계한다.

```ts
export function newlyOpened<Name extends string>(
	before: Record<Name, { isRunning: boolean }>,
	now: Record<Name, { isRunning: boolean }>
): Name[] {
	return (Object.keys(now) as Name[]).filter((name) => now[name].isRunning && !before[name]?.isRunning);
}
```

창을 앞으로 가져오거나 최소화했다가 복원하는 동작은 집계하지 않는다. 알고 싶은 지표는 "앱을 연 횟수"이지 "창을 누른 횟수"가 아니다.

외부 링크는 두 경로로 열렸다.

| 경로                      | 예                                                                                    | 기록 방법                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<a target="_blank">`     | 글 안의 링크, 프로젝트 페이지의 버튼                                                  | 문서 전체에 클릭 리스너 하나를 캡처 단계로 등록([`addEventListener`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)의 `capture`) |
| 코드의 `window.open` 호출 | Dock의 링크 앱, Apple 메뉴의 GitHub 저장소, 터미널의 `open`, 웹 창의 '새 탭에서 열기' | 다섯 곳에 흩어져 있던 호출을 `openExternal(url)` 하나로 통합하고, 그 함수 안에서 기록                                                                            |

링크 주소는 호스트와 경로만 기록하고 쿼리 문자열과 `#` 뒤는 버린다.

![openExternal 하나로 모으기](./images/analytics-collect-open-external.svg '여는 곳이 늘어도 기록하는 코드는 한 곳이다')

![수집 흐름](./images/analytics-collect-flow.svg '다섯 이벤트를 큐에 모아 5초마다, 탭이 숨겨지면 즉시 전송한다')

## 전송: 5초마다, 그리고 탭이 숨겨질 때

전송 방법은 세 가지를 비교해 골랐다.

| 방법                                     | 장점                                | 문제                                                                     |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| 이벤트마다 `fetch`                       | 가장 단순하다                       | 글을 넘길 때마다 요청. JSON이면 CORS 사전 요청까지 두 번                 |
| `beforeunload`/`unload`에서 한 번에      | 요청이 한 번                        | 휴대폰에서는 이 이벤트가 발생하지 않는 경우가 많다. 체류 시간이 누락된다 |
| 5초마다 + `visibilitychange` (고른 방법) | 요청이 적고, 숨겨지는 시각에도 전송 | 마지막 5초 안의 이벤트는 숨겨지는 시각의 전송에 의존한다                 |

이벤트는 즉시 전송하지 않고 큐에 모았다가 5초마다 한 번에 전송한다. 탭이 숨겨지면([`visibilitychange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)가 `hidden`) 그 시각까지의 체류 시간을 `leave`로 기록하고 즉시 전송한다. 휴대폰에서 다른 앱으로 전환하거나 탭을 닫는 경우다.

```ts
// 문자열을 그대로 넘기면 text/plain으로 전송된다: CORS 사전 요청이 없다
if (!navigator.sendBeacon?.(url, body))
	void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include' }).catch(() => undefined);
```

![한 방문의 시간선](./images/analytics-collect-timeline.svg '5초마다 묶어 전송하고, 탭이 숨겨지면 leave와 함께 즉시 전송한다')

`sendBeacon`이 `false`를 반환하면(본문이 너무 크거나 브라우저가 거절하면) [`keepalive`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) `fetch`로 한 번 더 전송한다. 한 묶음은 서버의 최대 수신 개수(`MAX_EVENTS`)를 넘지 않도록 나눠 전송한다.

[`sendBeacon`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)은 페이지가 닫히는 중에도 전송하고 응답을 기다리지 않는다. 쿠키도 함께 전송되므로, 관리자로 로그인한 브라우저의 요청은 서버가 식별해 집계에서 제외한다. 사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)가 같은 사이트라 `SameSite=Lax` 쿠키가 첨부된다.

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

검사 순서가 곧 우선순위다. Global Privacy Control[^gpc]을 시험용 스위치보다 먼저 확인하므로, 시험이 스위치를 켜도 방문자의 거부가 우선한다.

## 방문자에게 표시하는 것

Apple 메뉴 맨 위에 "오늘 방문자 N명"을 추가했다. 메뉴를 열 때마다 `GET /analytics/today`를 조회한다. 서버가 1분간 같은 값을 응답하므로 메뉴를 자주 열어도 DB를 매번 집계하지 않는다. 서버에 연결되지 않으면 이 줄을 숨긴다.

그 아래 사이트 바로가기에 '개인정보 처리 방침'을 추가했다. 수집 항목과 보관 기간을 적은 `docs/privacy.md`를 **Finder 안에서** 연다. Finder는 저장소 문서를 빌드 시각에 번들에 포함하고 GitHub처럼 렌더링하지만, 외부에서 특정 문서를 열도록 요청하는 방법이 없었다. Finder는 처음 열 때 불러오는(lazy) 앱이라, 요청을 작은 저장소에 보관하고 Finder가 마운트되면서 읽어 가게 했다. 메모의 글을 Finder에서 열 때 쓰는 방식과 같다.

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

- 서버 요청을 `shared/api/client.ts`의 `api()` 하나로 통합할 때([#196](https://github.com/hyeoniverse/MacFolio/pull/196), [공용 API 클라이언트](/memo/shared-api-client)) 오늘 방문자 수를 조회하는 코드도 옮겼다. `sendBeacon`은 응답을 읽지 않으므로 그대로 두었다.
- UTM을 다섯 가지(`source`, `medium`, `campaign`, `term`, `content`)로 늘리고, 읽은 `utm_*`는 주소창에서 삭제한다([트래픽 분석 5](/memo/utm-analytics)). 삭제하지 않으면 새로 고칠 때마다 같은 캠페인이 다시 집계된다.

## 남은 것, 배운 것

- 광고 차단기가 `/analytics/` 경로를 차단하면 아무것도 전송되지 않는다. 지표는 "차단하지 않은 방문자"만의 값이다.
- 체류 시간은 "페이지를 연 시각부터 탭이 숨겨진 시각까지"라, 탭을 열어 둔 채 다른 창에서 작업한 시간도 포함된다. 하루를 넘는 값은 24시간으로 제한한다.
- 새 기능을 만들기보다 기존 상태(`appAddresses`, 앱 상태)를 구독하는 편이 비용이 적었다. 주소 막대를 위해 만든 저장소가 분석의 `item` 이벤트를 추가 구현 없이 제공했다. 흩어진 `window.open`을 한 함수로 통합한 덕에, 외부 링크 기록을 추가할 위치도 한 곳으로 정해졌다.

다음은 이 지표를 조회하는 화면, [활동 상태 보기](/memo/analytics-activity-monitor) 앱이다.

## 직접 확인하기

개발자 도구 Network 탭에서 `analytics/events`로 필터링하고 사이트에서 앱을 몇 개 연다. 약 5초 뒤, 또는 다른 탭으로 전환하는 시각에 요청이 하나 전송된다. 요청 종류는 `ping`(sendBeacon)으로 표시된다([MDN: sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)).

```bash
cd apps/react
npx vitest run src/shared/analytics           # 묶어 보내기·보내지 않는 때
npx playwright test e2e/analytics.spec.ts --project=desktop-chromium
```

`VITE_API_URL`이 없는 빌드와 로컬 주소에서는 전송하지 않는다. 그래서 로컬 컴퓨터에서 `pnpm dev`만 실행했을 때 요청이 보이지 않는 것이 정상이다. 관리자로 로그인한 브라우저의 요청은 전송되지만 서버가 저장하지 않는다. 수집 항목은 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 있다.

## 관련 글

- [트래픽 분석 1 - API](/memo/analytics-api)
- [트래픽 분석 3 - 활동 상태 보기](/memo/analytics-activity-monitor)
- [트래픽 분석 4 - 공개](/memo/analytics-public)
- [트래픽 분석 5 - UTM](/memo/utm-analytics)
- [앱 링크와 주소 막대](/memo/app-links)
- [공용 API 클라이언트](/memo/shared-api-client)

[^gpc]: 브라우저가 웹사이트에 "내 데이터를 판매·공유하지 말라"는 의사를 전달하는 신호. 헤더 `Sec-GPC: 1`과 `navigator.globalPrivacyControl`로 전달된다([globalprivacycontrol.org](https://globalprivacycontrol.org/)).

#MacFolio #트래픽분석
