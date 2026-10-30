---
title: navigator.clipboard로 이름 없이 이메일 주소만 복사하기
date: 2026-10-10
category: 개발 기록/MacFolio/기능 구현
series: 메일 앱
seriesOrder: 3
summary: 메일 앱에서 사이트 주인의 주소를 누르면 이름 없이 이메일 주소만 복사되게 했다. 처음 만든 툴팁은 사이트의 다른 복사 기능과 같은 알림으로 바꿨고, 제목 막대 없는 창의 드래그 영역에 가려 클릭되지 않던 버튼은 z-index를 올렸다.
---

메일 앱의 새로운 메시지에는 받는 사람이 `김정현 <hyeoniverse.dev@gmail.com>`으로 정해져 있다. 이 사이트가 아니라 본인의 메일 앱으로 보내려는 방문자도 있는데, 지금까지는 주소를 직접 드래그해 선택한 뒤 복사해야 했다. macOS 메일에서는 주소 칩을 눌러 '이메일 주소 복사'를 선택한다. 여기서는 한 번 클릭하면 바로 복사되게 했다([#165](https://github.com/hyeoniverse/MacFolio/pull/165)).

## 적용 위치

세 위치에 같은 버튼 컴포넌트 `apps/mail/components/CopyAddress.tsx`를 배치한다. `withName`이 `false`면 이름 없이 주소만 표시한다(읽기 화면처럼 이름이 이미 위에 표시된 경우).

| 위치                       | 표시 내용                            |
| -------------------------- | ------------------------------------ |
| 새로운 메시지의 받는 사람  | `김정현 <hyeoniverse.dev@gmail.com>` |
| 환영 메일의 보낸 사람 주소 | `hyeoniverse.dev@gmail.com`          |
| 보낸 메일의 받는 사람      | `김정현 <hyeoniverse.dev@gmail.com>` |

어느 위치에서 클릭해도 복사되는 값은 **주소만**(`hyeoniverse.dev@gmail.com`)이다. 이름이 포함된 문자열은 메일 앱의 받는 사람 칸에 붙여 넣었을 때 형식에 따라 인식되지 않을 수 있다.

휴대폰의 메일 작성 시트도 같은 컴포넌트(`ComposeView`)를 사용해 같게 동작한다. 클립보드 쓰기는 [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)를 쓴다.

```tsx
async function copyEmail() {
	const { email } = getProfile();
	try {
		await navigator.clipboard.writeText(email);
		notify({ app: 'mail', title: '이메일 주소 복사됨', body: email });
	} catch {
		notify({ app: 'mail', title: '이메일 주소를 복사하지 못했습니다', body: email });
	}
}
```

버튼의 접근성 이름은 `김정현 <hyeoniverse.dev@gmail.com> (눌러서 이메일 주소 복사)`이다. 스크린 리더가 주소와 버튼의 기능을 함께 읽는다. 마우스를 올리면 `title` 툴팁으로 같은 안내가 표시된다.

## 외형

- 커서는 복사 모양([`cursor: copy`](https://developer.mozilla.org/ko/docs/Web/CSS/cursor))이고, hover 시 옅은 밑줄이 표시된다. 받는 사람 칩은 배경이 약간 진해진다.
- 클릭하면 macOS 알림처럼 오른쪽 위(휴대폰은 위쪽 가운데)에 `이메일 주소 복사됨 · hyeoniverse.dev@gmail.com` 배너가 표시된다. 클립보드 쓰기에 실패하면 `이메일 주소를 복사하지 못했습니다`가 표시된다.

처음에는 클릭 위치 위에 잠시 표시되는 검은 툴팁을 별도로 만들었다. 메모의 코드 블록 복사 버튼을 참고한 것이다. 그런데 이 사이트는 공유 앱의 '링크 복사됨', 앱 항목 주소의 '링크를 복사했습니다'처럼 **복사 완료를 알림(`notify`)으로** 표시하고 있었다. 같은 "복사 완료" 피드백이 두 가지 형태가 되는 것보다 하나로 통일하는 편이 낫다. 툴팁은 휴대폰 시트의 `overflow` 클리핑 영역 밖으로 렌더링하는 추가 작업도 필요했는데, 알림은 그런 처리가 필요 없다. 그래서 툴팁을 제거하고 알림으로 바꿨다.

| 방법                                         | 장점                                                    | 단점                                                                                     |
| -------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| macOS처럼 주소 칩에 메뉴('이메일 주소 복사') | 실제 메일 앱과 같다                                     | 한 번 더 클릭해야 하고, 메뉴에 다른 항목이 없다                                          |
| 클릭 위치 위 툴팁 '복사했어요'               | 클릭한 곳 바로 위라 눈에 띈다                           | 사이트의 다른 복사 피드백과 형태가 다르고, 휴대폰 시트 밖으로 렌더링하는 처리가 필요하다 |
| **사이트 알림(`notify`)**                    | 공유·링크 복사와 같은 형태, 실패도 같은 경로로 표시한다 | 클릭 위치와 알림 위치가 떨어져 있다                                                      |

툴팁 코드는 상태(`copied`)와 1.6초 타이머, CSS 약 35줄이었다. 알림으로 바꾸면서 모두 삭제되어, 두 번째 커밋은 +40/−85다. 첫 커밋(+197)과 합치면 구현한 코드의 일부를 다시 삭제한 것이다. 사이트의 기존 복사 피드백 방식을 먼저 확인했다면 한 번에 끝났을 작업이다.

![환영 메일의 주소를 클릭해 표시된 이메일 주소 복사됨 알림](./images/mail-copy-address-notice.jpg '보낸 사람 주소를 클릭하면 오른쪽 위에 알림이 표시된다')

## 클릭되지 않던 위치

첫 구현 후 환영 메일의 주소를 클릭하는 시험이 시간 초과로 실패했다. Playwright 로그에는 `macos-titlebar intercepts pointer events`가 기록되어 있었다. 메일 앱은 제목 막대 없는 창(`chrome="unified"`)이라, 창 위쪽 52px에 투명한 드래그 영역(z-index 3)이 내용 위를 덮고 있다. 읽기 영역의 헤더(보낸 사람 줄)가 그 높이에 있었다. 이 영역에 배치하는 버튼은 z-index를 올려야 클릭할 수 있다는 규칙(`Window.css`의 주석)에 따라 주소 버튼을 `z-index: 4`로 지정했다.

![창 위쪽의 드래그 영역과 주소 버튼](./images/mail-copy-address-layers.svg '투명한 드래그 영역이 위쪽 52px를 덮고 있어, 그 높이의 버튼은 z-index를 올려야 클릭된다')

화면에는 표시되지만 클릭되지 않는 버그라, 수동 확인만 했다면 "간헐적으로 클릭되지 않는다" 정도로 넘어갔을 수 있다. Playwright는 클릭 전에 해당 좌표의 최상위 요소를 확인하는 [actionability 검사](https://playwright.dev/docs/actionability)를 하고, 다른 요소가 가리면 대기하다 실패하며 가린 요소를 출력한다. 이번에는 그 메시지가 원인을 바로 알려 주었다.

## 시험

- 환영 메일의 보낸 사람 주소를 클릭하면 클립보드에 주소가 저장되고 `이메일 주소 복사됨` 알림이 표시된다 (닫기 버튼으로 닫힌다)
- 새로운 메시지의 받는 사람을 클릭하면 이름 없이 주소만 복사된다
- 보낸 메일의 받는 사람 줄은 기존대로 `받는 사람: 김정현 <hyeoniverse.dev@gmail.com>`으로 읽힌다

위 세 항목은 `e2e/mail.spec.ts`의 "사이트 주인의 주소를 누르면 이메일 주소를 복사한다 (새로운 메시지의 받는 사람, 환영 메일의 보낸 사람)" 시험 하나에 포함되어 있다. 클립보드는 Playwright에 `clipboard-read`·`clipboard-write` [권한](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions)을 부여하고 `navigator.clipboard.readText()`로 읽어 확인한다.

## 남은 것·배운 것

- 복사 가능 여부가 잘 드러나지 않는다. 커서 모양과 옅은 밑줄뿐이라, 휴대폰에서는 클릭하기 전에는 알 수 없다.
- 클립보드 쓰기는 [보안 컨텍스트](https://developer.mozilla.org/ko/docs/Web/Security/Secure_Contexts)(HTTPS)와 사용자 동작 안에서만 허용된다. 실패하면 주소를 알림 본문에 함께 표시해, 직접 보고 입력할 수 있게 했다.
- 새 피드백 UI를 만들기 전에 사이트가 같은 상황을 어떻게 표시하는지 먼저 확인한다. 같은 동작은 같은 형태여야 사용자가 새로 학습할 것이 줄어든다.

## 관련 글

- [방문자 쿠키의 HMAC으로 서버가 메일 조회 범위를 필터링하기](/memo/mail-mailboxes)
- [Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)
- [History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links): 같은 알림 방식의 링크 복사
- [컨테이너 쿼리 좁은 창에서 flex: none으로 신호등 버튼 영역 확보하기](/memo/narrow-window-title): 같은 제목 막대 영역 문제

#MacFolio #프론트엔드 #메일 #macOS
