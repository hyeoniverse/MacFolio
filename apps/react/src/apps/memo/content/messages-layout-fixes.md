---
title: 휴대폰 화면 5 - visualViewport 높이와 offsetTop으로 iOS Safari 키보드 위에 앱 화면 맞추기
date: 2026-10-23
category: 개발 기록/MacFolio/프론트엔드
summary: 메시지 앱에서 iPad mini처럼 넓은 휴대폰 화면의 검색 알약이 입력 칸을 덮었고, iOS Safari에서 키보드가 올라오면 대화 머리까지 화면 밖으로 밀렸고, 빈 목록의 말풍선 아이콘 윗부분이 잘렸다. 셋 다 두 기준이 어긋난 곳이라 기준을 맞추고 E2E 시험으로 검증했다.
---

메시지 앱의 휴대폰 화면 문제 세 가지를 수정했다([#363](https://github.com/hyeoniverse/MacFolio/pull/363)). 셋 다 두 기준이 서로 어긋난 곳이었다.

| 증상                                                         | 어긋난 두 기준                                                         | 수정 내용                                                     |
| ------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| 넓은 휴대폰 화면(641~767px)에서 검색 알약이 입력 칸을 덮는다 | 목록·대화 배치 기준(앱 폭 640px)과 검색 알약 배치 기준(대화 화면 여부) | 나란히 보는 화면에서는 검색 알약을 목록 칸(300px) 안에 배치   |
| 키보드가 올라오면 대화 머리가 화면 밖으로 밀린다             | 앱 화면 기준(레이아웃 뷰포트)과 사용자가 보는 영역(비주얼 뷰포트)      | 키보드가 있는 동안 앱 화면을 비주얼 뷰포트의 위치·높이에 맞춤 |
| 빈 목록의 말풍선 아이콘 윗부분이 잘린다                      | 줄 상자 높이(40px)와 글리프 잉크 높이(45px)                            | `line-height: 1.25`로 줄 상자를 50px로 늘림                   |

## 넓은 휴대폰 화면에서 검색 알약이 입력 칸을 덮었다

사이트는 화면 폭이 767px 이하이면 휴대폰 셸(iOS 홈 화면)을 쓴다(`isMobileViewport`). 메시지 앱은 이와 별개로 앱 폭이 640px 이하일 때만 목록과 대화를 한 화면씩 보여 준다(`@container (max-width: 640px)`). 그래서 iPad mini 세로(744px)나 가로로 눕힌 휴대폰(844~932px)에서는 **휴대폰 셸 안에 목록과 대화가 나란히** 렌더링된다. 사용자가 본 "태블릿 UI"가 이 화면이다.

휴대폰 셸의 메시지 목록은 iOS처럼 아래에 검색 알약과 새 피드백 버튼을 띄운다. 이 줄은 `position: absolute; left: 16px; right: 16px`로 앱 폭 전체를 차지하고, 대화 화면(`.chat-open`)일 때만 숨는다. 한 화면씩 보는 휴대폰에서는 목록 화면에서만 보이므로 문제가 없었지만, 나란히 보는 화면에서는 대화가 열려 있어도 `.chat-open`이 아니므로 검색 알약이 오른쪽 대화의 입력 칸 위에 그려졌다. `document.elementFromPoint`로 입력 칸 가운데를 확인하면 `textarea`가 아니라 검색 칸의 `input`이 반환되었다.

![744×1133 화면의 수정 전후. 수정 전에는 화면 폭 가득한 검색 알약이 오른쪽 대화의 입력 칸을 덮고, 수정 후에는 검색 알약과 새 피드백 버튼이 왼쪽 목록 칸 안에 있다](./images/messages-layout-fixes-tablet-744.jpg 'iPad mini 세로 (744×1133)')

수정은 두 부분이다.

- **CSS**: 앱 폭이 641px 이상이면 검색 줄의 폭을 목록 칸 폭(300px − 좌우 여백 32px)으로 제한한다. 대화 화면에서 숨기는 규칙은 640px 이하의 컨테이너 질의 안으로 옮겨, 나란히 보는 화면에서는 대화가 열려 있어도 검색 알약이 보인다. 폭이 좁아지면서 새 피드백 버튼이 찌그러지지 않도록 버튼에 `flex: none`, 검색 칸에 `min-width: 0`을 지정했다.
- **JS**: 휴대폰 셸의 떠 있는 뒤로 가기 버튼은 대화가 열리면 "메시지"(목록으로 돌아가기)로 바뀌었다. 나란히 보는 화면에서는 목록이 이미 옆에 보이므로 돌아갈 화면이 없다. 메모 앱의 `useShellSize`처럼 `useElementWidth`로 앱 폭을 측정해, 640px 이하일 때만 "메시지" 뒤로 가기를 표시한다.

![932×430 가로 화면의 수정 전후](./images/messages-layout-fixes-tablet-932.jpg '가로로 눕힌 휴대폰 (932×430)')

[날씨 앱](/memo/weather-layout-fixes)에서도 641~767px 구간에서 같은 종류의 문제를 수정한 적이 있다. 사이트의 휴대폰 기준(767px)과 앱의 한 화면 기준(640px)이 다르면, 그 사이 구간에서는 "휴대폰 셸 + 넓은 배치" 조합이 생긴다는 점을 앱마다 확인해야 한다.

## 키보드가 올라오면 머리까지 밀려 올라갔다

iOS Safari는 화면 키보드가 올라와도 **레이아웃 뷰포트**를 줄이지 않는다. 대신 사용자가 실제로 보는 영역인 **비주얼 뷰포트**([`visualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport))만 줄이고, 아래쪽 입력 칸에 초점이 가면 비주얼 뷰포트를 아래로 이동해(`offsetTop`) 입력 칸을 키보드 위에 표시한다.

휴대폰 셸의 앱 화면은 `position: fixed; inset: 0`이라 레이아웃 뷰포트에 고정되어 있다. 비주얼 뷰포트가 `offsetTop`만큼 아래로 이동하면, 앱 화면 맨 위의 상태 표시줄과 대화 머리(이름 알약, 뒤로 가기)는 보이는 영역 위로 밀려 나간다. iOS 메시지 앱은 머리를 화면 위에 고정하고 대화 내용만 줄이므로, 사용자 입장에서는 화면 전체가 밀려 올라간 것으로 보였다.

![키보드가 올라온 시각의 앱 화면 배치. 수정 전에는 머리가 보이는 곳 밖으로 밀리고, 수정 후에는 앱 화면이 보이는 곳에 맞춰진다](./images/messages-layout-fixes-viewport.svg '레이아웃 뷰포트와 비주얼 뷰포트')

### 키보드 높이를 다시 측정한다

[메모의 서식 막대](/memo/memo-keyboard-toolbar)는 `keyboardInset()`으로 키보드에 가려진 높이를 측정한다.

```ts
const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
```

이 값은 "레이아웃 뷰포트 맨 아래 중 보이지 않는 높이"라서, iOS가 비주얼 뷰포트를 키보드 높이만큼 다 이동하면 0이 된다. 화면 아래에 붙인 막대를 올리는 데는 맞는 값이지만, 머리를 고정하는 데는 키보드가 있는지조차 판정할 수 없다. 그래서 같은 파일에 `keyboardViewport()`를 추가했다. 키보드 여부는 `innerHeight - visualViewport.height`(이동 거리와 무관한 키보드 높이)로 판정하고, 비주얼 뷰포트의 `offsetTop`과 높이를 그대로 반환한다.

```ts
export function keyboardViewport(): KeyboardViewport | null {
	const viewport = window.visualViewport;
	if (!viewport) return null;
	if (window.innerHeight - viewport.height < MIN_KEYBOARD_PX) return null;
	return { top: Math.round(viewport.offsetTop), height: Math.round(viewport.height) };
}
```

<details>
<summary>두 값의 차이 (iPhone 13, 레이아웃 뷰포트 844px, 키보드 336px)</summary>

| 비주얼 뷰포트 이동(`offsetTop`) | `keyboardInset()` | `keyboardViewport()`        |
| ------------------------------- | ----------------- | --------------------------- |
| 0                               | 336               | `{ top: 0, height: 508 }`   |
| 336 (입력 칸이 맨 아래)         | 0                 | `{ top: 336, height: 508 }` |

`useKeyboardInset.test.ts`가 두 경우를 모두 검사한다.

</details>

### 앱 화면을 비주얼 뷰포트에 맞춘다

휴대폰 셸의 앱 화면을 그리는 `MobileAppFrame`에 앱이 켜는 선택 항목 `fitKeyboard`를 추가했다(`MobileNavigation`의 다른 항목인 `immersive`, `scrollEdge`와 같은 방식이다). 이 앱이 맨 앞이고 키보드가 올라와 있으면 앱 화면에 `top: offsetTop; height: visualViewport.height`를 지정한다. 상태 표시줄은 셸이 따로 그리므로 루트의 `--keyboard-top` 변수만큼 `top`을 내린다. 키보드 뒤로 숨는 홈 바는 감추고, 아래 여백(`--phone-bottom-inset`)을 0으로 바꿔 입력 칸이 키보드에 바로 붙게 했다.

대화 칸은 `flex: 1`이라 앱 화면이 줄어든 만큼 줄어든다. 줄어든 칸에서도 마지막 말풍선이 입력 칸 바로 위에 보이도록, `ChatView`가 대화 칸을 `ResizeObserver`로 관찰해 맨 아래를 보고 있었으면 다시 맨 아래로 스크롤한다.

메모는 이 항목을 켜지 않았다. 메모의 서식 막대는 이미 `keyboardInset()`으로 키보드 위에 표시되고, 본문은 길게 스크롤하는 화면이라 머리를 고정할 필요가 없다.

![iPhone 13에서 키보드가 올라온 시각에 보이는 영역. 수정 전에는 머리 없이 대화 아래쪽과 입력 칸만 보이고, 수정 후에는 상태 표시줄·뒤로 가기·이름 알약이 위에 남는다](./images/messages-layout-fixes-keyboard.jpg '왼쪽: 키보드 없음, 가운데·오른쪽: 비주얼 뷰포트 영역만 잘라 캡처')

> 브라우저 시험에서는 화면 키보드가 뜨지 않는다. E2E 시험(`e2e/mobile-messages.spec.ts`)은 `window.visualViewport`를 가짜 객체로 바꿔 높이와 `offsetTop`을 iOS처럼 바꾸고, 이름 알약과 상태 표시줄이 비주얼 뷰포트 맨 위에서 키보드 전과 같은 위치에 있는지 확인한다. 위 캡처도 같은 방식으로 찍고 비주얼 뷰포트 영역만 잘랐다.

### 머리 뒤로 말풍선이 비치게 한다

머리를 화면 위에 고정하고 나니, 머리 영역이 대화와 같은 불투명한 바탕이라 스크롤한 말풍선이 머리 아래에서 잘린 듯 사라졌다. iOS 메시지는 말풍선이 머리 뒤로 흐리게 지나간다.

- **배치**: 휴대폰 화면에서는 머리를 `position: absolute`로 대화 칸 위에 띄우고, 대화 칸(`.messages-transcript`)의 위 여백을 머리 높이만큼 둔다. 머리 높이는 설명 줄 수에 따라 달라서 `ChatView`가 `ResizeObserver`로 측정해 `--chat-header-height` 변수로 넘긴다. 맨 위로 스크롤하면 첫 말풍선은 머리 아래에서 시작한다.
- **재질**: 단색 반투명 판은 여전히 불투명하게 보였다. 그래서 바탕색을 위쪽만 옅게(알파 0.45) 깔고 아래로 갈수록 0이 되는 세로 그라데이션과 `backdrop-filter: blur(2px)`를 의사 요소(`::before`)에 깔았다. 블러는 `mask-image`로 아래쪽을 지워 그라데이션과 함께 풀리게 했고, 아래 경계에 선이나 그림자는 두지 않았다. 바탕색은 앱의 `--messages-window-bg`라 다크 모드에서는 어두운 그라데이션이 된다.
- **의사 요소에 두는 이유**: 머리 자체에 `mask-image`를 주면 머리 안의 아바타와 이름 알약까지 함께 지워진다. 또 부모에 `filter`, `mask`, `opacity`, `backdrop-filter`가 있으면 그 부모가 [backdrop root](https://drafts.fxtf.org/filter-effects-2/#BackdropRoot)가 되어 뒤의 말풍선이 비치지 않으므로, 머리와 대화 칸의 공통 부모에는 이런 속성을 두지 않는다.
- 머리가 직접 재질을 그리므로 대화 화면에서는 휴대폰 셸의 스크롤 가장자리 흐림(`scrollEdge`)을 끈다.

![말풍선이 머리 뒤로 지나가는 상태의 수정 전후 (라이트·다크). 수정 전에는 머리가 불투명해 말풍선이 머리 아래에서 잘리고, 수정 후에는 옅은 그라데이션과 블러 뒤로 흐리게 비친다](./images/messages-layout-fixes-header.jpg '머리 재질 수정 전후')

## 빈 목록의 말풍선 아이콘이 잘렸다

빈 목록에는 "아직 남겨진 피드백이 없어요." 위에 Font Awesome의 말풍선 아이콘(`fa-comments`, 40px)이 있다. 실제 iPhone Safari에서 이 아이콘의 윗부분이 약간 잘렸다.

Font Awesome은 아이콘에 `line-height: 1`을 지정하므로 줄 상자는 40px이다. 그런데 캔버스의 [`measureText()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText)로 측정하면 이 글리프는 글꼴의 ascent(35px)·descent(5px)보다 위아래로 2.5px씩 더 그려진다.

| 값                                    | 크기           |
| ------------------------------------- | -------------- |
| `fontBoundingBoxAscent` / `Descent`   | 35px / 5px     |
| `actualBoundingBoxAscent` / `Descent` | 37.5px / 7.5px |
| 잉크 높이                             | 45px           |

글리프가 줄 상자 밖으로 나가는 것 자체는 보통 문제가 되지 않는다. 다만 목록 항목은 나타날 때 `rise-in` 애니메이션(`opacity`, `transform`)을 쓰므로 합성 레이어가 되고, iOS Safari는 그 레이어를 레이아웃 상자 크기로 클리핑할 수 있다[^ink]. 아이콘의 위쪽 끝이 목록 항목의 위쪽 끝과 같은 위치(위 여백 0)에 있어서, 상자 밖으로 나간 2.5px가 잘렸다. 데스크톱 Chromium과 WebKit에서는 재현되지 않았다.

![말풍선 아이콘의 줄 상자와 잉크 영역. 수정 전에는 잉크가 위아래로 2.5px씩 상자 밖으로 나가고, 수정 후에는 상자 안에 들어간다](./images/messages-layout-fixes-glyph.svg '줄 상자 40px → 50px')

`line-height: 1.25`로 줄 상자를 50px로 늘려 위아래 반쪽 leading 5px 안에 잉크가 들어가게 했다. 늘어난 5px씩은 바깥 여백(`margin-top` 56px → 51px, `margin-bottom` 6px → 1px)에서 빼서 아이콘 위치는 수정 전과 같다. 시험은 `measureText()`로 잉크의 위아래 끝을 계산해 줄 상자 안에 있는지 확인한다.

[^ink]: 레이아웃이 계산하는 넘침(overflow) 영역에는 글꼴 지표(ascent·descent)까지만 들어가고, 실제 글리프가 그 밖으로 그려지는 부분은 포함되지 않을 수 있다. 합성 레이어의 크기를 이 영역으로 정하면 지표 밖의 잉크가 잘린다.

## 관련 글

- [useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준](/memo/weather-layout-fixes): 641~767px 구간의 같은 종류 문제
- [메모 편집기 7 - 레이아웃 뷰포트 대신 visualViewport로 iOS Safari 키보드 높이 측정하기](/memo/memo-keyboard-toolbar): `keyboardInset()`을 처음 만든 글
- [macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점](/memo/safari-macos-ios-rendering): iOS Safari에서만 보이는 다른 차이
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline): 메시지 앱의 다른 수정

#MacFolio #TIL #프론트엔드 #CSS #Safari #iOS
