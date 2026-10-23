---
title: 문제 알리기를 GitHub 이슈 대신 메시지 앱으로
date: 2026-10-24
category: 개발기/MacFolio/프론트엔드
summary: 메뉴 막대 도움말의 '문제 알리기'가 GitHub 새 이슈 페이지를 새 탭으로 열었다. 이제 메시지 앱의 새 피드백 화면을 열고 입력 칸에 초점을 둔다. GitHub 이슈는 그 화면의 보조 링크로 안내한다. 앱 사이 요청(openRequest)을 메시지 앱으로 넓힌 방법, 바깥 링크 집계, 서버에 닿지 못할 때의 대체 경로를 적었다.
---

메뉴 막대의 **도움말 › 문제 알리기…** 는 지금까지 저장소의 새 이슈 화면(`/issues/new/choose`)을 새 탭으로 열었다. 이슈를 남기려면 GitHub 계정과 로그인이 필요하고, 사이트를 떠나 다른 탭에서 양식을 채워야 한다. 사이트 안에는 로그인 없이 글을 남기는 메시지 앱이 이미 있다. 그래서 문제 알리기는 메시지 앱의 새 피드백 화면을 열고, GitHub 이슈는 그 화면의 보조 링크로 옮겼다.

![데스크톱 전후](./images/report-issue-to-messages-desktop.jpg '왼쪽은 고치기 전 쓰기 버튼으로 연 새 피드백, 오른쪽은 도움말 › 문제 알리기로 연 새 피드백. 안내 문구와 자리표시자가 문제를 묻고, 안내 아래와 빈 목록 안내 아래에 GitHub 이슈 링크가 있다')

## 동작

| 항목               | 고치기 전                        | 고친 뒤                                               |
| ------------------ | -------------------------------- | ----------------------------------------------------- |
| 문제 알리기…       | GitHub 새 이슈 화면 (새 탭)      | 메시지 앱 › 새 피드백, 입력 칸에 초점                 |
| 새 피드백 안내     | 감상, 의견, 피드백을 남겨 주세요 | 문제 알리기로 열면 '어떤 문제가 있었는지 적어 주세요' |
| 입력 칸 자리표시자 | 감상, 의견, 피드백               | 문제 알리기로 열면 '어떤 문제가 있었나요?'            |
| GitHub 이슈        | 메뉴 항목                        | 새 피드백 안내 아래, 빈 목록 안내 아래의 링크 (새 탭) |
| 서버에 닿지 못함   | 해당 없음 (메뉴는 서버와 무관)   | 경고창의 '이슈 남기기' 단추로 GitHub 이슈 안내        |

쓰기 버튼으로 연 새 피드백은 원래 문구 그대로다. 바뀌는 것은 문구뿐이고 저장 위치는 같다. 보낸 글은 피드백 목록의 항목 하나가 된다.

휴대폰 셸에는 메뉴 막대가 없으므로 진입점은 그대로다(제어 센터의 '피드백 남기기'). 새 피드백 화면과 빈 목록의 GitHub 이슈 링크는 휴대폰에도 적용된다.

![휴대폰 전후](./images/report-issue-to-messages-mobile.jpg 'iPhone 13 크기. 새 피드백 머리의 안내 아래에 링크가 있고, 다크 모드에서는 --color-link의 다크 값이 적용된다. 오른쪽은 빈 목록 안내')

## 구조: 앱 사이 요청을 메시지 앱으로

메뉴 막대는 메시지 앱의 상태를 직접 바꾸지 않는다. 다른 앱의 항목을 여는 방법이 이미 있다. Finder가 글을 열 때와 사진 위젯이 사진을 열 때 쓰는 `shared/lib/openRequest.ts`다. 요청 `{ app, id }` 하나를 저장소에 보관하고, 받는 앱이 `useOpenRequest`로 꺼낸다. 받는 앱이 마운트 전이면 요청이 남아 있다가 마운트 시각에 처리된다([Finder 앱 글](/memo/finder-app)).

![문제 알리기의 흐름](./images/report-issue-to-messages-flow.svg '도식. 메뉴는 요청을 보관하고 창을 연다. 메시지 앱은 마운트되며 요청을 꺼내 새 피드백 화면을 issue 종류로 연다')

바꾼 곳은 세 군데다.

1. `RequestApp` 타입에 `'messages'`를 더했다. 메시지 앱은 `/memo/<글>` 같은 딥 링크 주소가 없으므로 `LinkedApp`이 아니라, 사진 앱처럼 요청만 받는 앱이다.
2. 메뉴 항목은 `requestOpen('messages', REPORT_ISSUE_REQUEST)` 뒤에 `openApp('messages')`를 호출한다. 창이 이미 열려 있으면 맨 앞으로 오고, 요청은 `subscribe`로 바로 전달된다.
3. 메시지 앱의 `compose`에 종류 인자(`'feedback' | 'issue'`)를 더했다. 종류는 안내 문구와 자리표시자만 고른다. 문구는 `conversations.ts`의 `COMPOSE_TEXT`에 두고 단위 시험으로 확인한다.

```ts
// Messages.tsx
useOpenRequest('messages', (id) => {
	if (id !== REPORT_ISSUE_REQUEST) return;
	setNav('forward');
	conversations.compose('issue');
});
```

<details>
<summary>메뉴가 닫히는 과정에서 입력 칸의 초점이 유지되는 이유</summary>

`Composer`는 `key={focusRequest}`로 렌더링된다. `compose`가 `focusRequest`를 1 올리면 입력 칸이 새로 마운트되며 `autoFocus`로 초점을 받는다. 메뉴는 항목을 실행한 뒤 닫히지만 메뉴 막대 제목으로 초점을 되돌리지 않으므로, 새로 마운트된 입력 칸의 초점이 유지된다. E2E 시험은 `toBeFocused()`와 `page.keyboard.type()`으로 클릭 없이 바로 입력되는지 확인한다.

</details>

## GitHub 이슈 링크

링크 컴포넌트 `components/IssueLink.tsx` 하나를 새 피드백 머리와 빈 목록 안내 두 곳에서 쓴다. 주소는 메뉴가 쓰던 `${REPO_URL}/issues/new/choose`를 `repoDocs.ts`의 `NEW_ISSUE_URL` 상수로 옮긴 것이다. 저장소의 이슈 템플릿(버그, 기능 제안)을 고르는 화면이다.

- `target="_blank"`, `rel="noopener noreferrer"`: 사이트의 다른 바깥 링크와 같다
- 바깥 링크 아이콘 `fa-arrow-up-right-from-square`와 스크린 리더용 `(새 탭)`(`.visually-hidden`). 숨은 텍스트가 엉뚱한 컨테이닝 블록을 기준으로 배치되지 않도록 링크에 `position: relative`를 둔다([시스템 설정의 스크롤이 두 번 되던 것](/memo/settings-double-scroll))
- 색은 `--color-link` 토큰이라 라이트·다크 값이 따로 적용된다
- 휴대폰의 새 피드백 머리는 대화 위에 떠 있는 반투명 막대다([메시지 앱의 세 가지 어긋남](/memo/messages-layout-fixes)). 머리 높이는 `ResizeObserver`로 측정하므로 링크 한 줄이 늘어도 첫 말풍선이 머리에 가려지지 않는다

### 바깥 링크 집계

`analytics.ts`는 문서에 클릭 리스너 하나를 캡처 단계로 등록해 모든 `<a href>` 클릭을 바깥 링크로 집계한다([트래픽 분석 2](/memo/analytics-collect)). 링크를 `<a>`로 만들었으므로 별도 호출이 필요 없다. 집계 항목은 `github.com/hyeoniverse/MacFolio/issues/new/choose`이고, E2E 시험이 가짜 API에 도착한 이벤트로 확인한다. 경고창의 '이슈 남기기' 단추는 `<a>`가 아니므로 `openExternal()`로 열고, 이 함수도 같은 이벤트를 남긴다.

## 서버에 닿지 못할 때

메시지 앱은 첫 불러오기가 실패하면 경고창을 표시하고 앱을 종료한다([서버가 없으면 메시지 앱을 열지 않기](/memo/messages-offline)). 문제 알리기로 열었는데 서버가 응답하지 않으면 문제를 남길 곳이 없어진다. 이 경우에만 경고창에 '이슈 남기기' 단추를 두고, 누르면 GitHub 새 이슈 화면을 새 탭으로 연 뒤 앱을 종료한다. 쓰기 버튼이나 Dock으로 연 경우의 경고창은 그대로 '확인' 하나다.

![서버에 닿지 못할 때](./images/report-issue-to-messages-offline.jpg '문제 알리기로 열었고 서버에 닿지 못한 경우의 경고창. 닫기와 이슈 남기기')

로컬 저장소 모드(`VITE_MESSAGES_STORE=local`)에서는 메시지가 브라우저 저장소에 저장되므로, API 서버가 없어도 문제 알리기가 새 피드백 화면을 그대로 연다.

## 시험

- **단위 시험:** `COMPOSE_TEXT`의 두 종류(문제 알리기는 '어떤 문제가 있었나요?', 쓰기 버튼은 원래 문구)
- **E2E 시험(데스크톱):** 문제 알리기를 누르면 메시지 앱이 맨 앞에 열리고 새 피드백 입력 칸에 초점이 있다. 링크의 `href`·`target`·`rel`·아이콘을 확인하고, 키보드로 바로 입력해 보낸 메시지가 목록에 올라가는지 본다. 뒤에 있던 메시지 앱도 앞으로 오고, 취소하면 보던 안내로 돌아간다. 768px 화면(목록과 대화를 한 화면씩)에서도 새 피드백이 열린다. 링크를 누르면 새 탭이 열리고 바깥 링크 이벤트가 집계된다. 서버에 닿지 못하면 '이슈 남기기'가 새 탭을 연다
- **E2E 시험(휴대폰, iPhone·Android):** 새 피드백 머리의 링크가 머리 안에 있고 다른 요소에 덮이지 않는다(`elementFromPoint`). iPad mini 세로(744px)에서도 같다. 빈 목록 안내의 링크도 확인한다

## 관련 글

- [Finder 앱 - 사이트를 파일처럼 둘러보기](/memo/finder-app): `requestOpen`·`useOpenRequest` 구조
- [사진 위젯을 누르면 그 사진을 크게 보기로](/memo/photo-widget-open-current): 같은 요청을 사진 앱으로 넓힌 사례
- [메뉴 막대의 파일·보기·윈도우가 실제로 열린다](/memo/menubar-menus): 도움말 메뉴와 앱별 메뉴
- [서버가 없으면 메시지 앱을 열지 않기](/memo/messages-offline): 첫 불러오기 실패 경고창
- [트래픽 분석 2 - 사이트에서 모아 보내기](/memo/analytics-collect): 바깥 링크 집계
