---
title: 트래픽 분석 2 - 사이트에서 모아 보내기
date: 2026-10-07
category: 개발기/MacFolio/백엔드
summary: 분석 API에 보낼 이벤트를 사이트에서 모은다. 페이지 열기, 앱 열기, 글·프로젝트 보기, 바깥 링크, 머문 시간을 5초마다 sendBeacon으로 보낸다. 로컬 주소와 Global Privacy Control에서는 보내지 않고, Apple 메뉴에 오늘 방문자 수와 개인정보 처리 방침을 붙였다.
---

[트래픽 분석 1](/memo/analytics-api)에서 이벤트를 받는 API를 만들었다. 이번에는 사이트 쪽이다. 이 사이트는 페이지 하나에서 창을 띄우는 구조라, "어느 앱에서 무엇을 봤는지"는 사이트가 직접 알려 줘야 한다.

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

바깥 링크는 두 갈래였다. 글 안의 링크와 프로젝트 페이지의 단추는 `<a target="_blank">`라, 문서 전체에 클릭 리스너 하나(캡처 단계)를 걸어 잡는다. Dock의 링크 앱, Apple 메뉴의 GitHub 저장소, 터미널의 `open`, 웹 창의 '새 탭에서 열기'는 코드에서 `window.open`을 불렀다. 다섯 군데에 흩어져 있던 이 호출을 `openExternal(url)` 하나로 모으고, 거기서 남긴다. 링크 주소는 호스트와 경로만 남기고 검색어와 `#` 뒤는 버린다.

## 보내기: 5초마다, 그리고 탭이 숨을 때

이벤트는 바로 보내지 않고 모았다가 5초마다 한 번에 보낸다. 탭이 숨으면(`visibilitychange`가 `hidden`) 그때까지 머문 시간을 `leave`로 남기고 바로 보낸다. 휴대폰에서 다른 앱으로 넘어가거나 탭을 닫을 때다.

```ts
// 글자를 그대로 넘기면 text/plain으로 간다: CORS 사전 요청이 없다
if (!navigator.sendBeacon?.(url, body))
	void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include' }).catch(() => undefined);
```

`sendBeacon`은 페이지가 닫히는 중에도 보내고 응답을 기다리지 않는다. 쿠키도 함께 가서, 관리자로 로그인한 브라우저는 서버가 알아보고 세지 않는다. 사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)가 같은 사이트라 `SameSite=Lax` 쿠키가 실린다.

## 보내지 않는 때

- **로컬 주소:** `localhost`, `127.0.0.1`. 개발하며 연 페이지가 숫자에 섞이지 않는다. 화면 테스트도 로컬 주소라 기본으로 보내지 않는다. 수집을 시험하는 테스트만 `window.__MACFOLIO_ANALYTICS__ = true`로 켠다
- **Global Privacy Control:** 브라우저가 `navigator.globalPrivacyControl`을 켰으면 보내지 않는다. 테스트가 켜 두어도 이쪽이 이긴다
- **서버 주소가 없는 빌드**

## 방문자에게 보이는 것

Apple 메뉴 맨 위에 "오늘 방문자 N명"을 붙였다. 메뉴를 열 때마다 `GET /analytics/today`에 묻는다. 서버가 1분 동안 같은 값을 주니 메뉴를 자주 열어도 DB를 매번 세지 않는다. 서버에 닿지 않으면 줄을 감춘다.

그 아래 사이트 바로가기에 '개인정보 처리 방침'을 더했다. 무엇을 모으고 얼마나 두는지 적은 `docs/privacy.md`를 **Finder 안에서** 연다. Finder는 저장소 문서를 빌드할 때 묶어 두고 GitHub처럼 그려 주지만, 바깥에서 특정 문서를 열어 달라고 할 길이 없었다. Finder는 처음 열 때 불러오는 앱이라, 요청을 작은 저장소에 남겨 두고 Finder가 마운트되며 가져가게 했다. 메모의 글을 Finder에서 열 때 쓰는 방식과 같다.

## 시험

- 단위: 로컬 주소·Global Privacy Control에서 끄기, 들어온 곳은 호스트만, utm 세 가지, 링크는 호스트와 경로만, 새로 연 앱 고르기
- 화면(가짜 API): `?utm_source=resume`으로 들어와 메모를 열고 글을 보고 GitHub 저장소를 누른 뒤 탭을 숨기면, 한 `visitId`로 `visit`(utm·desktop) → `app`(memo, 처음 떠 있던 Safari는 없음) → `item`(memo/cra-to-vite) → `link`(github.com/hyeoniverse/MacFolio) → `leave`가 간다. 로컬 주소와 Global Privacy Control에서는 아무것도 가지 않는다. Apple 메뉴에 "오늘 방문자 1,234명"이 보이고, '개인정보 처리 방침'이 Finder에서 열린다

다음은 이 숫자를 보는 관리자 화면, '활동 상태 보기' 앱이다.

#MacFolio #트래픽분석
