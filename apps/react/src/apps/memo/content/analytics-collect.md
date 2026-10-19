---
title: 트래픽 분석 2 - 사이트에서 모아 보내기
date: 2026-10-07
category: 개발기/MacFolio/백엔드
summary: 사이트에서 페이지 열기, 앱 열기, 글 보기, 바깥 링크, 머문 시간을 모아 5초마다 sendBeacon으로 보낸다. 흩어진 window.open을 openExternal 하나로 모으고, 로컬 주소와 Global Privacy Control에서는 끈다. 보내는 방법 비교와 시험을 정리했다.
---

[트래픽 분석 1](/memo/analytics-api)에서 이벤트를 받는 API를 만들었다. 이번에는 사이트 쪽이다. 이 사이트는 페이지 하나에서 창을 띄우는 구조라, 서버가 받는 요청은 첫 페이지와 코드 파일뿐이다. 메모 앱을 열고 글 세 개를 읽은 뒤 GitHub 링크를 눌러도 새 페이지 요청은 없다. "어느 앱에서 무엇을 봤는지"는 사이트가 직접 알려 줘야 한다.

작업은 PR [#162](https://github.com/hyeoniverse/MacFolio/pull/162)의 커밋 하나다. 14개 파일에 417줄을 더했다. 핵심은 `src/shared/analytics/analytics.ts`(지금 205줄)와 `usage.ts`(25줄)다.

## 무엇을 언제 남기나

| 이벤트  | 언제                                 | 어디서 알아내나                                                                           |
| ------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `visit` | 페이지를 열 때 한 번                 | 처음 연 주소, `document.referrer`의 호스트, `utm_*`, 화면 폭(768px 미만이면 mobile), 언어 |
| `app`   | 앱을 새로 열 때                      | 앱 상태(`AppStateContext`)에서 실행 중이 아니던 앱이 실행 중이 될 때                      |
| `item`  | 메모의 글, Safari의 프로젝트를 볼 때 | 주소 막대에 쓰는 값(`appAddresses`)이 바뀔 때                                             |
| `link`  | 바깥 링크를 누를 때                  | 사이트 밖으로 가는 `<a>` 클릭, 그리고 새 탭을 여는 곳                                     |
| `leave` | 탭이 숨을 때                         | 페이지를 연 뒤 지난 시간                                                                  |

`item`은 새로 만든 것이 없다. 글 주소를 공유하게 만들 때, 앱마다 "지금 보여 주는 항목"을 알리는 저장소(`appAddresses`)를 두었다. 주소 막대가 그것을 보고 `/memo/<글>`로 바뀐다. 분석도 그 저장소를 구독하기만 하면 된다.

`app`은 처음부터 떠 있는 Safari 창을 세지 않는다. 사이트를 열면 Safari가 이미 떠 있는데, 방문자가 고른 것이 아니기 때문이다. 앞의 상태와 비교해 "실행 중이 아니었다가 실행 중이 된" 앱만 센다.

```ts
export function newlyOpened<Name extends string>(
	before: Record<Name, { isRunning: boolean }>,
	now: Record<Name, { isRunning: boolean }>
): Name[] {
	return (Object.keys(now) as Name[]).filter((name) => now[name].isRunning && !before[name]?.isRunning);
}
```

창을 앞으로 가져오거나 최소화했다 되살리는 것은 세지 않는다. "앱을 몇 번 열었나"가 궁금했지 "창을 몇 번 눌렀나"가 궁금하지는 않았다.

바깥 링크는 두 갈래였다. 글 안의 링크와 프로젝트 페이지의 버튼은 `<a target="_blank">`라, 문서 전체에 클릭 리스너 하나(캡처 단계)를 걸어 잡는다. Dock의 링크 앱, Apple 메뉴의 GitHub 저장소, 터미널의 `open`, 웹 창의 '새 탭에서 열기'는 코드에서 `window.open`을 불렀다. 다섯 군데에 흩어져 있던 이 호출을 `openExternal(url)` 하나로 모으고, 거기서 남긴다. 링크 주소는 호스트와 경로만 남기고 검색어와 `#` 뒤는 버린다.

![openExternal 하나로 모으기](./images/analytics-collect-open-external.svg '여는 곳이 늘어도 남기는 코드는 한 곳이다')

![수집 흐름](./images/analytics-collect-flow.svg '다섯 이벤트를 큐에 모아 5초마다, 탭이 숨으면 바로 보낸다')

## 보내기: 5초마다, 그리고 탭이 숨을 때

보내는 방법은 셋을 놓고 골랐다.

| 방법                                     | 좋은 점                       | 문제                                                             |
| ---------------------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| 이벤트마다 `fetch`                       | 가장 단순하다                 | 글을 넘길 때마다 요청. JSON이면 CORS 사전 요청까지 두 번         |
| `beforeunload`/`unload`에서 한 번에      | 요청이 한 번                  | 휴대폰에서는 이 이벤트가 오지 않는 일이 많다. 머문 시간을 놓친다 |
| 5초마다 + `visibilitychange` (고른 방법) | 요청이 적고, 숨을 때도 보낸다 | 마지막 5초 안의 이벤트는 숨는 순간에 의지한다                    |

이벤트는 바로 보내지 않고 모았다가 5초마다 한 번에 보낸다. 탭이 숨으면(`visibilitychange`가 `hidden`) 그때까지 머문 시간을 `leave`로 남기고 바로 보낸다. 휴대폰에서 다른 앱으로 넘어가거나 탭을 닫을 때다.

```ts
// 글자를 그대로 넘기면 text/plain으로 간다: CORS 사전 요청이 없다
if (!navigator.sendBeacon?.(url, body))
	void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include' }).catch(() => undefined);
```

![한 방문의 시간선](./images/analytics-collect-timeline.svg '5초마다 묶어 보내고, 탭이 숨으면 leave와 함께 바로 보낸다')

`sendBeacon`이 `false`를 돌려주면(본문이 너무 크거나 브라우저가 거절하면) `keepalive` `fetch`로 한 번 더 보낸다. 한 묶음은 서버가 받는 최대 개수(`MAX_EVENTS`)를 넘지 않게 잘라 보낸다.

`sendBeacon`은 페이지가 닫히는 중에도 보내고 응답을 기다리지 않는다. 쿠키도 함께 가서, 관리자로 로그인한 브라우저는 서버가 알아보고 세지 않는다. 사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)가 같은 사이트라 `SameSite=Lax` 쿠키가 실린다.

## 보내지 않는 때

- **로컬 주소:** `localhost`, `127.0.0.1`. 개발하며 연 페이지가 숫자에 섞이지 않는다. 화면 테스트도 로컬 주소라 기본으로 보내지 않는다. 수집을 시험하는 테스트만 `window.__MACFOLIO_ANALYTICS__ = true`로 켠다
- **Global Privacy Control:** 브라우저가 `navigator.globalPrivacyControl`을 켰으면 보내지 않는다. 테스트가 켜 두어도 이쪽이 이긴다
- **서버 주소가 없는 빌드**

```ts
if (!env.apiUrl || navigatorLike.globalPrivacyControl) return false;
if (globalThis.__MACFOLIO_ANALYTICS__ !== undefined) return globalThis.__MACFOLIO_ANALYTICS__;
return !/^(localhost|127\.0\.0\.1|\[::1\])$|\.local$/.test(location.hostname);
```

순서가 곧 우선순위다. Global Privacy Control을 테스트 스위치보다 먼저 보기 때문에, 테스트가 켜 두어도 방문자의 거부가 이긴다.

## 방문자에게 보이는 것

Apple 메뉴 맨 위에 "오늘 방문자 N명"을 붙였다. 메뉴를 열 때마다 `GET /analytics/today`에 묻는다. 서버가 1분 동안 같은 값을 주니 메뉴를 자주 열어도 DB를 매번 세지 않는다. 서버에 닿지 않으면 줄을 감춘다.

그 아래 사이트 바로가기에 '개인정보 처리 방침'을 더했다. 무엇을 모으고 얼마나 두는지 적은 `docs/privacy.md`를 **Finder 안에서** 연다. Finder는 저장소 문서를 빌드할 때 묶어 두고 GitHub처럼 그려 주지만, 바깥에서 특정 문서를 열어 달라고 할 길이 없었다. Finder는 처음 열 때 불러오는 앱이라, 요청을 작은 저장소에 남겨 두고 Finder가 마운트되며 가져가게 했다. 메모의 글을 Finder에서 열 때 쓰는 방식과 같다.

## 시험

- 단위(`src/shared/analytics/analytics.test.ts`): **배포 주소에서 켜고, 로컬 주소와 Global Privacy Control에서는 끈다**, **테스트는 로컬에서도 켤 수 있지만, Global Privacy Control은 이긴다**, 들어온 곳은 호스트만, utm, **바깥 링크는 호스트와 경로만**, **새로 연 앱: 실행 중이 아니었다가 실행 중이 된 앱만**. 처음 다섯 묶음에서 지금은 8개다.
- 화면(`e2e/analytics.spec.ts`, 가짜 API): `?utm_source=resume`으로 들어와 메모를 열고 글을 보고 GitHub 저장소를 누른 뒤 탭을 숨기면, 한 `visitId`로 `visit`(utm·desktop) → `app`(memo, 처음 떠 있던 Safari는 없음) → `item`(memo/cra-to-vite) → `link`(github.com/hyeoniverse/MacFolio) → `leave`가 간다. 로컬 주소와 Global Privacy Control에서는 아무것도 가지 않는다. Apple 메뉴에 "오늘 방문자 1,234명"이 보이고, '개인정보 처리 방침'이 Finder에서 열린다

## 그 뒤에 바뀐 것

- 서버 요청을 `shared/api/client.ts`의 `api()` 하나로 모을 때(PR [#196](https://github.com/hyeoniverse/MacFolio/pull/196), [공용 API 클라이언트](/memo/shared-api-client)) 오늘 방문자 수를 묻는 코드도 옮겼다. `sendBeacon`은 응답을 읽지 않으니 그대로 두었다.
- UTM을 다섯 가지(`source`, `medium`, `campaign`, `term`, `content`)로 늘리고, 읽은 `utm_*`는 주소창에서 지운다([트래픽 분석 5](/memo/utm-analytics)). 지우지 않으면 새로 고칠 때마다 같은 캠페인이 다시 들어온다.

## 남은 것, 배운 것

- 광고 차단기가 `/analytics/` 경로를 막으면 아무것도 가지 않는다. 숫자는 "막지 않은 방문자"의 숫자다.
- 머문 시간은 "페이지를 연 뒤 탭이 숨을 때까지"라, 탭을 띄워 두고 다른 창에서 일한 시간도 들어간다. 하루를 넘는 값은 24시간으로 자른다.
- 새 기능을 만들기보다 이미 있는 상태(`appAddresses`, 앱 상태)를 구독하는 쪽이 쌌다. 주소 막대를 위해 만든 저장소가 분석의 `item` 이벤트를 공짜로 주었다. 흩어진 `window.open`을 한 함수로 모은 것도, 나중에 "나간 링크로 센다"를 어디에 더할지 고민할 필요를 없앴다.

다음은 이 숫자를 보는 화면, [활동 상태 보기](/memo/analytics-activity-monitor) 앱이다.

## 직접 확인하기

개발자 도구 Network 탭에서 `analytics/events`로 거르고 사이트에서 앱을 몇 개 연다. 5초쯤 뒤, 또는 탭을 다른 탭으로 바꾸는 순간 요청이 하나 나간다. 종류가 `ping`(sendBeacon)으로 보인다([MDN: sendBeacon](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)).

```bash
cd apps/react
npx vitest run src/shared/analytics           # 묶어 보내기·보내지 않는 때
npx playwright test e2e/analytics.spec.ts --project=desktop-chromium
```

관리자로 로그인한 브라우저와 `VITE_API_URL`이 없는 빌드에서는 보내지 않는다. 그래서 내 컴퓨터에서 `pnpm dev`만 띄웠을 때 요청이 안 보이는 것이 정상이다. 무엇을 모으는지는 [docs/privacy.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/privacy.md)에 있다.

관련 글: [트래픽 분석 1 - API](/memo/analytics-api), [트래픽 분석 3 - 활동 상태 보기](/memo/analytics-activity-monitor), [트래픽 분석 5 - UTM](/memo/utm-analytics), [앱 링크와 주소 막대](/memo/app-links)

#MacFolio #트래픽분석
