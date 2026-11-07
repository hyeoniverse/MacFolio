---
title: openRequest를 메시지 앱으로 넓혀 문제 알리기를 피드백 화면으로 연결하기
date: 2026-10-24
category: 개발 기록/MacFolio/구조·상태 관리
summary: 도움말의 '문제 알리기'가 GitHub 새 이슈 페이지 대신 메시지 앱의 새 피드백 화면을 연다. 메시지 앱은 인사, 감상, 의견을 자유롭게 남기는 방명록이고, 버그는 보조 링크로 GitHub 이슈를 안내한다. 앱 사이 요청(openRequest)을 메시지 앱으로 넓힌 방법과 바깥 링크 집계를 적었다.
---

MacFolio는 macOS 데스크톱을 브라우저에 재현한 사이트라, 화면 맨 위에 macOS처럼 메뉴 막대가 있다. 메뉴 막대의 **도움말 › 문제 알리기…** 는 지금까지 저장소의 새 이슈 화면(`/issues/new/choose`)을 새 탭으로 열었다. GitHub 이슈는 저장소에 버그나 기능 제안을 글로 등록하는 기능으로, 등록하려면 GitHub 계정으로 로그인해야 한다. 방문자 입장에서는 사이트를 떠나 다른 탭에서 로그인하고 양식을 채워야 한다.

사이트 안에는 로그인 없이 글을 남기는 메시지 앱이 이미 있다. macOS 메시지 앱 모양의 방명록으로, 왼쪽 목록에 방문자가 남긴 피드백이 있고 오른쪽에서 새 글을 쓴다. 그래서 문제 알리기는 메시지 앱의 새 피드백 화면을 열고, GitHub 이슈는 그 화면의 보조 링크로 옮겼다. 메시지 앱은 문제 보고 전용 창구가 아니라 인사만 남겨도 되는 방명록이므로, 안내 문구도 문제를 묻지 않고 자유롭게 남기도록 바꿨다([#370](https://github.com/hyeoniverse/MacFolio/pull/370)).

![데스크톱 전후](./images/report-issue-to-messages-desktop.jpg '왼쪽은 고치기 전 쓰기 버튼으로 연 새 피드백, 오른쪽은 도움말 › 문제 알리기로 연 새 피드백. 자리표시자는 인사나 감상, 의견을 자유롭게 남기라는 문장이고, 안내 한 줄은 로그인 없이 남길 수 있다는 것과 보내면 목록에 올라간다는 것만 알린다. 안내 아래와 빈 목록 안내 아래에 버그용 GitHub 이슈 링크가 있다')

## 동작

| 항목               | 고치기 전                        | 고친 뒤                                                                     |
| ------------------ | -------------------------------- | --------------------------------------------------------------------------- |
| 문제 알리기…       | GitHub 새 이슈 화면 (새 탭)      | 메시지 앱 › 새 피드백, 입력 칸에 초점                                       |
| 새 피드백 안내     | 감상, 의견, 피드백을 남겨 주세요 | 로그인 없이 남길 수 있어요                                                  |
| 입력 칸 자리표시자 | 감상, 의견, 피드백               | 인사나 감상, 의견을 자유롭게 남겨 주세요.                                   |
| GitHub 이슈        | 메뉴 항목                        | '버그는 GitHub 이슈로' 링크 (새 피드백 안내 아래, 빈 목록 안내 아래, 새 탭) |

문제 알리기로 열든 쓰기 버튼으로 열든 같은 새 피드백 화면이다. 안내 문구는 문제만 묻지 않는다. ==메시지 앱은 인사 한 줄만 남겨도 되는 방명록==이고, 코드와 함께 추적해야 하는 버그만 GitHub 이슈로 안내한다. 보낸 글은 피드백 목록의 항목 하나가 된다.

예를 들어 방문자가 도움말 › 문제 알리기…를 누르고 "메모 앱 글씨가 작아요"라고 입력해 보내면, 그 문장은 메시지 앱 목록에 새 항목으로 올라간다. 같은 방문자가 재현 순서와 브라우저 버전까지 적어 버그를 등록하려면, 입력 칸 위의 '버그는 GitHub 이슈로' 링크를 눌러 GitHub 이슈 양식으로 이동한다.

> [!NOTE] 휴대폰 진입점
> 휴대폰 셸에는 메뉴 막대가 없으므로 진입점은 그대로다(제어 센터의 '피드백 남기기'). 새 피드백 화면과 빈 목록의 GitHub 이슈 링크는 휴대폰에도 적용된다.

![휴대폰 전후](./images/report-issue-to-messages-mobile.jpg 'iPhone 13 크기. 새 피드백 머리의 안내 아래에 링크가 있고, 다크 모드에서는 --color-link의 다크 값이 적용된다. 오른쪽은 빈 목록 안내')

## 구조: 앱 사이 요청을 메시지 앱으로

메뉴 막대와 메시지 앱은 서로 다른 컴포넌트 트리에 있다. 메뉴 막대가 메시지 앱 내부의 상태(현재 화면, 입력 칸 내용)를 직접 바꾸려면 메시지 앱의 내부 구현을 import해야 하고, 그러면 메뉴 막대가 모든 앱의 내부 구현에 의존한다. 다른 앱의 항목을 여는 방법은 이미 있었다. Finder가 글을 열 때와 사진 위젯이 사진을 열 때 쓰는 `shared/lib/openRequest.ts`다.

`openRequest.ts`는 요청 `{ app, id }` 하나를 보관하는 작은 저장소(store)다. 보내는 쪽은 `requestOpen(app, id)`로 요청을 저장하고, 받는 쪽은 `useOpenRequest(app, handler)`로 자기 앱 이름이 붙은 요청을 꺼낸다. 받는 앱이 마운트 전이면 요청이 남아 있다가 마운트 시각에 처리된다([Finder 앱 글](/memo/finder-app)). 마운트는 React가 컴포넌트를 처음 그려 DOM에 붙이는 단계이고, 이 시각에 `useEffect`가 처음 실행된다.

![문제 알리기의 흐름](./images/report-issue-to-messages-flow.svg '도식. 메뉴는 요청을 보관하고 창을 연다. 메시지 앱은 마운트되며 요청을 꺼내 쓰기 버튼과 같은 새 피드백 화면을 연다')

요청이 전달되는 경로는 메시지 앱이 이미 열려 있는지에 따라 두 가지다.

![요청이 도착하는 두 경로](./images/report-issue-to-messages-request-timing.svg '앱이 닫혀 있으면 마운트 시각의 effect가, 열려 있으면 store 구독 콜백이 요청을 꺼낸다. 어느 경로든 꺼낸 요청은 null로 지운다')

`useOpenRequest`의 effect는 처음 실행되면 저장소를 한 번 확인(`take()`)하고, 이후에는 저장소를 구독(`subscribe(take)`)한다. 그래서 요청이 마운트보다 먼저 왔든 나중에 왔든 한 번씩만 처리된다. 꺼낸 요청은 바로 `null`로 지우므로, 메시지 앱을 닫았다가 다시 열어도 같은 요청이 반복 실행되지 않는다.

바꾼 곳은 세 군데다.

1. `RequestApp` 타입에 `'messages'`를 더했다. 메시지 앱은 `/memo/<글>` 같은 딥 링크 주소가 없으므로 `LinkedApp`이 아니라, 사진 앱처럼 요청만 받는 앱이다.
2. 메뉴 항목은 `requestOpen('messages', REPORT_ISSUE_REQUEST)` 뒤에 `openApp('messages')`를 호출한다. 창이 이미 열려 있으면 맨 앞으로 오고, 요청은 `subscribe`로 바로 전달된다.
3. 메시지 앱은 요청을 받으면 쓰기 버튼과 같은 `compose()`를 호출한다. 진입 경로에 따라 문구를 나누지 않는다. 문제 알리기 전용 문구('어떤 문제가 있었나요?')를 두면 ==메시지 앱이 문제 보고 창구처럼 보이기 때문이다==.

```ts
// Messages.tsx
useOpenRequest('messages', (id) => {
	if (id !== REPORT_ISSUE_REQUEST) return;
	setNav('forward');
	conversations.compose();
});
```

<details>
<summary>메뉴가 닫히는 과정에서 입력 칸의 초점이 유지되는 이유</summary>

`Composer`는 `key={focusRequest}`로 렌더링된다. React는 `key`가 바뀐 컴포넌트를 이전 것과 다른 컴포넌트로 보고 새로 마운트한다. `compose`가 `focusRequest`를 1 올리면 입력 칸이 새로 마운트되며 `autoFocus`로 초점을 받는다. 메뉴는 항목을 실행한 뒤 닫히지만 메뉴 막대 제목으로 초점을 되돌리지 않으므로, 새로 마운트된 입력 칸의 초점이 유지된다. E2E 시험은 `toBeFocused()`와 `page.keyboard.type()`으로 클릭 없이 바로 입력되는지 확인한다.

</details>

## GitHub 이슈 링크

링크 컴포넌트 `components/IssueLink.tsx`(문구 '버그는 GitHub 이슈로') 하나를 새 피드백 머리와 빈 목록 안내 두 곳에서 쓴다. 주소는 메뉴가 쓰던 `${REPO_URL}/issues/new/choose`를 `repoDocs.ts`의 `NEW_ISSUE_URL` 상수로 옮긴 것이다. 저장소의 이슈 템플릿(버그, 기능 제안)을 고르는 화면이다. 링크 문구에 '버그는'을 붙여, 메시지는 자유로운 글이고 이슈는 버그 제보용 보조 경로라는 구분을 드러낸다.

| 속성·요소   | 값                              | 역할                                                                                                                                                            |
| ----------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`    | `_blank`                        | 새 탭에서 연다. 사이트의 다른 바깥 링크와 같다                                                                                                                  |
| `rel`       | `noopener noreferrer`           | `noopener`는 새 탭의 페이지가 `window.opener`로 MacFolio 탭에 접근하지 못하게 하고, `noreferrer`는 이동하면서 `Referer` 헤더에 MacFolio 주소를 보내지 않게 한다 |
| 아이콘      | `fa-arrow-up-right-from-square` | 사이트 밖으로 나가는 링크임을 표시한다                                                                                                                          |
| 숨은 텍스트 | `(새 탭)` (`.visually-hidden`)  | 화면에는 보이지 않고 스크린 리더만 읽는다                                                                                                                       |
| 색          | `--color-link` 토큰             | 라이트·다크 값이 따로 적용된다                                                                                                                                  |

숨은 텍스트는 `position: absolute`로 1px 크기에 잘라 둔 요소라, 가장 가까운 위치 지정 조상(컨테이닝 블록)을 기준으로 배치된다. 링크에 `position: relative`를 두어 그 기준이 링크 자신이 되게 했다([최소 창 크기와 컨테이닝 블록으로 중첩 스크롤의 이중 스크롤 없애기](/memo/settings-double-scroll)).

휴대폰의 새 피드백 머리는 대화 위에 떠 있는 반투명 막대다([visualViewport 높이와 offsetTop으로 iOS Safari 키보드 위에 앱 화면 맞추기](/memo/ios-keyboard-viewport#메시지-앱-화면을-비주얼-뷰포트에-맞추기)). 머리 높이는 `ResizeObserver`로 측정하므로 링크 한 줄이 늘어도 첫 말풍선이 머리에 가려지지 않는다. `ResizeObserver`는 요소의 크기가 바뀔 때마다 콜백을 호출하는 브라우저 API로, 링크가 추가되어 머리가 한 줄만큼 높아지면 그 새 높이가 대화 영역의 위쪽 여백에 반영된다.

### 바깥 링크 집계

`analytics.ts`는 문서에 클릭 리스너 하나를 캡처 단계로 등록해 모든 `<a href>` 클릭을 바깥 링크로 집계한다([sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)).

![DOM 이벤트 흐름](./images/report-issue-to-messages-event-flow.jpg '캡처 단계(빨강)는 Window에서 대상 요소까지 내려가고, 대상 단계를 거쳐 버블 단계(초록)로 다시 올라간다 #float-right')

브라우저에서 클릭 이벤트는 세 단계로 전달된다. 먼저 `Window`와 `Document`에서 클릭한 요소까지 내려가는 **캡처 단계**, 클릭한 요소 자신에서 실행되는 **대상 단계**, 다시 위로 올라가는 **버블 단계**다. `addEventListener('click', handler, true)`처럼 세 번째 인자를 `true`로 주면 리스너가 캡처 단계에서 실행된다.

캡처 단계의 `document` 리스너는 링크 아래쪽 요소에 등록된 버블 단계 처리기보다 먼저 실행된다. 어떤 컴포넌트가 버블 단계에서 `stopPropagation()`으로 전파를 멈춰도 집계는 이미 끝난 상태다. 리스너는 `event.target.closest('a[href]')`로 클릭한 위치에서 가장 가까운 링크를 찾아 그 주소를 기록한다.

그래서 링크를 `<a>`로 만들기만 하면 별도 호출이 필요 없다. 이번 링크의 집계 항목은 `github.com/hyeoniverse/MacFolio/issues/new/choose`이고, E2E 시험이 가짜 API에 도착한 이벤트로 확인한다.

## 서버에 닿지 못할 때

메시지 앱은 첫 불러오기가 실패하면 경고창을 표시하고 앱을 종료한다([첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline)). 문제 알리기로 열어도 같은 경고창이 표시된다. 로컬 저장소 모드(`VITE_MESSAGES_STORE=local`)에서는 메시지가 브라우저 저장소에 저장되므로, API 서버가 없어도 문제 알리기가 새 피드백 화면을 그대로 연다.

## 시험

- **E2E 시험(데스크톱):** 문제 알리기를 누르면 메시지 앱이 맨 앞에 열리고 새 피드백 입력 칸에 초점이 있다. 안내와 자리표시자는 쓰기 버튼으로 연 화면과 같다. 링크의 `href`·`target`·`rel`·아이콘을 확인하고, 키보드로 바로 입력해 보낸 메시지가 목록에 올라가는지 확인한다. 뒤에 있던 메시지 앱도 앞으로 오고, 취소하면 보던 안내로 돌아간다. 768px 화면(목록과 대화를 한 화면씩)에서도 새 피드백이 열린다. 링크를 누르면 새 탭이 열리고 바깥 링크 이벤트가 집계된다
- **E2E 시험(휴대폰, iPhone·Android):** 새 피드백 머리의 링크가 머리 안에 있고 다른 요소에 덮이지 않는다(`elementFromPoint`). iPad mini 세로(744px)에서도 같다. 빈 목록 안내의 링크도 확인한다

`elementFromPoint(x, y)`는 화면 좌표 한 점에서 가장 위에 그려진 요소를 반환하는 DOM 함수다. 링크 중심 좌표로 호출해 링크 자신이나 그 안의 아이콘이 반환되면, 반투명 머리나 다른 막대가 링크를 덮지 않았다는 뜻이다.

## 관련 글

- [openRequest store로 Finder에서 고른 항목을 다른 앱에서 열기](/memo/finder-app): `requestOpen`·`useOpenRequest` 구조
- [openRequest로 위젯이 표시 중인 사진을 사진 앱 크게 보기로 넘기기](/memo/photo-widget-open-current): 같은 요청을 사진 앱으로 넓힌 사례
- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus): 도움말 메뉴와 앱별 메뉴
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline): 첫 불러오기 실패 경고창
- [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect): 바깥 링크 집계

<details><summary>참고 문헌</summary>

- GitHub Docs, [About issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/about-issues)
- MDN, [`<a>`: The Anchor element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a)
- MDN, [HTML attribute: rel](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel)
- MDN, [EventTarget: addEventListener() method](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- MDN, [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)
- MDN, [Document: elementFromPoint() method](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)
- React, [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- W3C, [UI Events: Event dispatch and DOM event flow](https://www.w3.org/TR/uievents/#event-flow)

</details>

<details><summary>사진 출처</summary>

- DOM 이벤트 흐름: W3C, [UI Events (W3C Working Draft, 2019-05-30)](https://www.w3.org/TR/2019/WD-uievents-20190530/#event-flow)의 그림 [eventflow.svg](https://www.w3.org/TR/2019/WD-uievents-20190530/images/eventflow.svg), [W3C Software and Document License](https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document), 출처 표기

</details>
