---
title: visualViewport로 iOS Safari 키보드 높이와 위치에 휴대폰 화면 맞추기
date: 2026-10-23
category: 개발 기록/MacFolio/화면·스타일
series: 휴대폰 화면
seriesOrder: 5
summary: iOS Safari는 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않는다. visualViewport로 가려진 높이를 측정해 메모 서식 막대를 키보드 위에 붙이고, offsetTop과 높이로 메시지 앱 화면을 보이는 영역에 맞췄다. 메시지 앱의 넓은 휴대폰 화면 배치와 아이콘 잘림도 수정했다.
---

휴대폰 화면에서 키보드가 올라오면 화면이 사용자가 보는 영역과 어긋나는 문제를 두 PR로 수정했다. 두 PR 모두 [`window.visualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)로 실제로 보이는 영역을 측정하는 방식이다.

| PR                                                       | 앱     | 증상                                                      | 수정 내용                                                        |
| -------------------------------------------------------- | ------ | --------------------------------------------------------- | ---------------------------------------------------------------- |
| [#230](https://github.com/hyeoniverse/MacFolio/pull/230) | 메모   | 키보드가 올라오면 하단의 서식 알약이 키보드 뒤에 가려진다 | 가려진 높이(`keyboardInset()`)만큼 서식 막대를 올림              |
| [#363](https://github.com/hyeoniverse/MacFolio/pull/363) | 메시지 | 키보드가 올라오면 대화 머리가 화면 밖으로 밀린다          | 앱 화면을 비주얼 뷰포트의 위치·높이(`keyboardViewport()`)에 맞춤 |

#230에서는 iOS 메모의 문단 도구(들여쓰기·이동·인용·목록)도 서식 막대에 추가했다. #363에서는 메시지 앱의 휴대폰 화면 문제 두 가지를 함께 수정했다. 넓은 휴대폰 화면에서 검색 알약이 입력 칸을 덮는 문제와 빈 목록의 말풍선 아이콘 윗부분이 잘리는 문제다.

## 레이아웃 뷰포트와 비주얼 뷰포트

iOS Safari는 키보드가 올라와도 [레이아웃 뷰포트](https://developer.mozilla.org/en-US/docs/Glossary/Layout_viewport)(`window.innerHeight`, `100dvh`)를 줄이지 않는다. 줄어드는 것은 실제로 화면에 보이는 영역인 [비주얼 뷰포트](https://developer.mozilla.org/en-US/docs/Glossary/Visual_Viewport)뿐이다. 아래쪽 입력 칸에 초점이 가면 Safari는 비주얼 뷰포트를 아래로 이동해(`offsetTop`) 입력 칸을 키보드 위에 표시한다. 그래서 `position: fixed; bottom: 0`이나 화면 높이를 가득 채운 상자의 하단에 배치한 요소는 키보드 뒤로 들어가고, 상단에 배치한 요소는 보이는 영역 위로 밀려 나갈 수 있다. Android Chrome도 현재 기본 동작은 같다(비주얼 뷰포트만 줄인다).

| 값                                | 키보드가 내려간 상태 | 키보드가 올라온 상태 |
| --------------------------------- | -------------------- | -------------------- |
| `window.innerHeight`, `100dvh`    | 화면 높이            | 변화 없음            |
| `visualViewport.height`           | 화면 높이            | 키보드 높이만큼 감소 |
| `position: fixed; bottom: 0` 요소 | 화면 하단            | 키보드 뒤            |

키보드가 가린 높이는 레이아웃 뷰포트의 하단 좌표에서 비주얼 뷰포트의 하단 좌표를 뺀 값이다.

```ts
export function keyboardInset(): number {
	const viewport = window.visualViewport;
	if (!viewport) return 0;
	const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
	return hidden >= MIN_KEYBOARD_PX ? Math.round(hidden) : 0;
}
```

![레이아웃 뷰포트와 비주얼 뷰포트, 키보드 높이](./images/memo-keyboard-toolbar-viewport.svg '키보드가 가린 높이를 CSS 변수로 전달해 서식 알약을 그만큼 올린다')

`offsetTop`을 더하는 이유는 키보드가 올라올 때 Safari가 비주얼 뷰포트를 아래로 이동해 커서를 표시하는 경우가 있기 때문이다. 주소창이 접히고 펼쳐질 때도 비주얼 뷰포트의 높이가 바뀌므로, 120px(`MIN_KEYBOARD_PX`)보다 작은 차이는 키보드로 판단하지 않는다.

`visualViewport`의 `resize`·`scroll` 이벤트를 구독해 이 값을 다시 계산한다(`useKeyboardInset`). 편집기가 열려 있을 때만 구독한다.

키보드 높이를 구하는 방법은 세 가지를 비교했다.

| 방법                                                                                                                      | 장점                                      | 단점                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `<meta name="viewport" content="interactive-widget=resizes-content">`                                                     | 레이아웃 뷰포트가 줄어 CSS만으로 처리된다 | Android Chrome만 지원하고 iOS Safari는 지원하지 않는다. 키보드가 열릴 때마다 화면 전체의 레이아웃을 다시 계산한다 |
| [VirtualKeyboard API](https://developer.mozilla.org/en-US/docs/Web/API/VirtualKeyboard_API) (`navigator.virtualKeyboard`) | 키보드 영역 좌표를 정확히 제공한다        | Chromium 계열만 지원한다. iOS에는 없다                                                                            |
| **`visualViewport`로 측정**                                                                                               | iOS Safari·Android Chrome 모두 지원       | 주소창 변화와 키보드를 구분해야 한다(120px 기준)                                                                  |

## 메모 서식 막대를 키보드 위에 붙이기

휴대폰 화면의 메모 본문에는 하단에 플로팅 서식 알약(가가, 체크리스트, 표, 이미지, 첨부)과 새 메모 버튼이 있다. 본문을 눌러 키보드가 올라오면 이 알약이 키보드 뒤에 가려, 입력 중에 서식을 바꾸려면 키보드를 내려야 했다. iOS 메모는 키보드 바로 위에 서식 막대가 화면 폭 전체로 붙으므로 같은 배치로 구현했다.

키보드가 올라와 있으면 하단 막대에 `above-keyboard` 클래스를 추가하고, `keyboardInset()` 값을 CSS 변수 `--keyboard-inset`으로 전달한다. CSS는 막대를 그 높이만큼 올리고 서식 알약을 화면 폭 전체로 늘린다. 새 메모 버튼은 그동안 숨긴다(iOS 메모도 입력 중에는 표시하지 않는다).

```css
.container.mobile .memo-phone-bottom.above-keyboard {
	bottom: calc(var(--keyboard-inset) + 8px);
	left: 12px;
	right: 12px;
}
```

> [!WARNING] 접두사가 두 번 붙은 변수 이름
> 처음 구현에서는 막대가 화면 맨 위에 표시됐다. CSS 변수를 전달하는 `cssVars()`가 이름 앞에 `--`를 붙이는데, 이름을 `'--keyboard-inset'`로 전달해서 `----keyboard-inset`이 됐다. `var(--keyboard-inset)`이 정의되지 않았으므로 `bottom` 선언 전체가 계산 시점에 무효[^invalid-var]가 되어, `bottom`이 `auto`인 상자처럼 위쪽에 렌더링됐다.

편집기는 커서가 있는 줄이 위아래의 플로팅 막대에 가려지지 않도록 스크롤 위치를 조정한다. 키보드가 올라와 있으면 화면에 보이는 하단은 키보드 위쪽이므로, 그 좌표를 하단 기준으로 사용한다.

### 문단 도구

iOS 메모는 서식 막대의 ¶ 버튼을 누르면 막대가 문단 도구로 바뀐다. 같은 흐름을 구현했다(`writer/ParagraphTools.tsx`).

| 버튼              | 동작                                                           |
| ----------------- | -------------------------------------------------------------- |
| 내어쓰기·들여쓰기 | 목록 항목의 단계를 한 칸 바꾼다(`liftListItem`·`sinkListItem`) |
| 위·아래로 이동    | 현재 문단을 앞·뒤 블록과 맞바꾼다                              |
| 블록 인용         | 인용 블록으로 감싸거나 해제한다                                |
| 구분점 목록       | 글머리 기호 목록으로 바꾸거나 해제한다                         |
| ×                 | 원래 서식 도구로 돌아간다                                      |

인용과 목록이 적용된 상태면 버튼의 [`aria-pressed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-pressed)가 `true`다.

![서식 도구와 문단 도구](./images/memo-keyboard-toolbar-paragraph.svg '¶로 문단 도구로 바꾸고, ×로 돌아온다')

이동 아이콘은 처음에 위·아래 화살표만 표시했다. 그러자 스크롤이나 커서 이동 버튼처럼 보여서, 화살표 옆에 문단 세 줄을 넣은 SVG로 바꿨다. 크기와 선 굵기는 옆의 Font Awesome 들여쓰기 아이콘에 맞췄다. 버튼은 모두 `IconButton`이고, 누를 때 편집기의 포커스를 가져가지 않도록(`keepFocus`) 해서 키보드가 내려가지 않는다.

## 메시지 앱 화면을 비주얼 뷰포트에 맞추기

휴대폰 셸의 앱 화면은 `position: fixed; inset: 0`이라 레이아웃 뷰포트에 고정되어 있다. 메시지 앱의 입력 칸에 초점이 가서 비주얼 뷰포트가 `offsetTop`만큼 아래로 이동하면, 앱 화면 맨 위의 상태 표시줄과 대화 머리(이름 알약, 뒤로 가기)는 보이는 영역 위로 밀려 나간다. iOS 메시지 앱은 머리를 화면 위에 고정하고 대화 내용만 줄이므로, 사용자 입장에서는 화면 전체가 밀려 올라간 것으로 보였다.

![키보드가 올라온 시각의 앱 화면 배치. 수정 전에는 머리가 보이는 곳 밖으로 밀리고, 수정 후에는 앱 화면이 보이는 곳에 맞춰진다](./images/messages-layout-fixes-viewport.svg '레이아웃 뷰포트와 비주얼 뷰포트')

### 키보드 높이 대신 비주얼 뷰포트의 위치를 반환한다

`keyboardInset()`의 값은 "레이아웃 뷰포트 맨 아래 중 보이지 않는 높이"라서, iOS가 비주얼 뷰포트를 키보드 높이만큼 다 이동하면 0이 된다. 화면 아래에 붙인 막대를 올리는 데는 맞는 값이지만, ==머리를 고정하는 데는 키보드가 있는지조차 판정할 수 없다==. 그래서 같은 파일에 `keyboardViewport()`를 추가했다. 키보드 여부는 `innerHeight - visualViewport.height`(이동 거리와 무관한 키보드 높이)로 판정하고, 비주얼 뷰포트의 `offsetTop`과 높이를 그대로 반환한다.

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

### fitKeyboard로 앱 화면의 위치와 높이를 지정한다

휴대폰 셸의 앱 화면을 그리는 `MobileAppFrame`에 앱이 켜는 선택 항목 `fitKeyboard`를 추가했다(`MobileNavigation`의 다른 항목인 `immersive`, `scrollEdge`와 같은 방식이다). 이 앱이 맨 앞이고 키보드가 올라와 있으면 앱 화면에 `top: offsetTop; height: visualViewport.height`를 지정한다. 상태 표시줄은 셸이 따로 그리므로 루트의 `--keyboard-top` 변수만큼 `top`을 내린다. 키보드 뒤로 숨는 홈 바는 감추고, 아래 여백(`--phone-bottom-inset`)을 0으로 바꿔 입력 칸이 키보드에 바로 붙게 했다.

대화 칸은 `flex: 1`이라 앱 화면이 줄어든 만큼 줄어든다. 줄어든 칸에서도 마지막 말풍선이 입력 칸 바로 위에 보이도록, `ChatView`가 대화 칸을 `ResizeObserver`로 관찰해 맨 아래를 보고 있었으면 다시 맨 아래로 스크롤한다.

메모는 이 항목을 켜지 않았다. 메모의 서식 막대는 이미 `keyboardInset()`으로 키보드 위에 표시되고, 본문은 길게 스크롤하는 화면이라 머리를 고정할 필요가 없다.

![iPhone 13에서 키보드가 올라온 시각에 보이는 영역. 수정 전에는 머리 없이 대화 아래쪽과 입력 칸만 보이고, 수정 후에는 상태 표시줄·뒤로 가기·이름 알약이 위에 남는다](./images/messages-layout-fixes-keyboard.jpg '왼쪽: 키보드 없음, 가운데·오른쪽: 비주얼 뷰포트 영역만 잘라 캡처')

### 머리 뒤로 말풍선이 비치게 한다

머리를 화면 위에 고정하고 나니, 머리 영역이 대화와 같은 불투명한 바탕이라 스크롤한 말풍선이 머리 아래에서 잘린 듯 사라졌다. iOS 메시지는 말풍선이 머리 뒤로 흐리게 지나간다.

- **배치**: 휴대폰 화면에서는 머리를 `position: absolute`로 대화 칸 위에 띄우고, 대화 칸(`.messages-transcript`)의 위 여백을 머리 높이만큼 둔다. 머리 높이는 설명 줄 수에 따라 달라서 `ChatView`가 `ResizeObserver`로 측정해 `--chat-header-height` 변수로 넘긴다. 맨 위로 스크롤하면 첫 말풍선은 머리 아래에서 시작한다.
- **재질**: 단색 반투명 판은 여전히 불투명하게 보였다. 그래서 바탕색을 위쪽만 옅게(알파 0.45) 깔고 아래로 갈수록 0이 되는 세로 그라데이션과 `backdrop-filter: blur(2px)`를 의사 요소(`::before`)에 깔았다. 블러는 `mask-image`로 아래쪽을 지워 그라데이션과 함께 풀리게 했고, 아래 경계에 선이나 그림자는 두지 않았다. 바탕색은 앱의 `--messages-window-bg`라 다크 모드에서는 어두운 그라데이션이 된다.
- **의사 요소에 두는 이유**: 머리 자체에 `mask-image`를 주면 머리 안의 아바타와 이름 알약까지 함께 지워진다. 또 부모에 `filter`, `mask`, `opacity`, `backdrop-filter`가 있으면 그 부모가 [backdrop root](https://drafts.fxtf.org/filter-effects-2/#BackdropRoot)가 되어 뒤의 말풍선이 비치지 않으므로, 머리와 대화 칸의 공통 부모에는 이런 속성을 두지 않는다.
- 머리가 직접 재질을 그리므로 대화 화면에서는 휴대폰 셸의 스크롤 가장자리 흐림(`scrollEdge`)을 끈다.

![말풍선이 머리 뒤로 지나가는 상태의 수정 전후 (라이트·다크). 수정 전에는 머리가 불투명해 말풍선이 머리 아래에서 잘리고, 수정 후에는 옅은 그라데이션과 블러 뒤로 흐리게 비친다](./images/messages-layout-fixes-header.jpg '머리 재질 수정 전후')

## 넓은 휴대폰 화면에서 검색 알약이 입력 칸을 덮었다

사이트는 화면 폭이 767px 이하이면 휴대폰 셸(iOS 홈 화면)을 쓴다(`isMobileViewport`). 메시지 앱은 이와 별개로 앱 폭이 640px 이하일 때만 목록과 대화를 한 화면씩 보여 준다(`@container (max-width: 640px)`). 그래서 iPad mini 세로(744px)나 가로로 눕힌 휴대폰(844~932px)에서는 **휴대폰 셸 안에 목록과 대화가 나란히** 렌더링된다. 사용자가 본 "태블릿 UI"가 이 화면이다.

휴대폰 셸의 메시지 목록은 iOS처럼 아래에 검색 알약과 새 피드백 버튼을 띄운다. 이 줄은 `position: absolute; left: 16px; right: 16px`로 앱 폭 전체를 차지하고, 대화 화면(`.chat-open`)일 때만 숨는다. 한 화면씩 보는 휴대폰에서는 목록 화면에서만 보이므로 문제가 없었지만, 나란히 보는 화면에서는 대화가 열려 있어도 `.chat-open`이 아니므로 검색 알약이 오른쪽 대화의 입력 칸 위에 그려졌다. `document.elementFromPoint`로 입력 칸 가운데를 확인하면 `textarea`가 아니라 검색 칸의 `input`이 반환되었다. ==목록·대화 배치 기준(앱 폭 640px)과 검색 알약 배치 기준(대화 화면 여부)이 어긋난 것==이다.

![744×1133 화면의 수정 전후. 수정 전에는 화면 폭 가득한 검색 알약이 오른쪽 대화의 입력 칸을 덮고, 수정 후에는 검색 알약과 새 피드백 버튼이 왼쪽 목록 칸 안에 있다](./images/messages-layout-fixes-tablet-744.jpg 'iPad mini 세로 (744×1133)')

수정은 두 부분이다.

- **CSS**: 앱 폭이 641px 이상이면 검색 줄의 폭을 목록 칸 폭(300px − 좌우 여백 32px)으로 제한한다. 대화 화면에서 숨기는 규칙은 640px 이하의 컨테이너 질의 안으로 옮겨, 나란히 보는 화면에서는 대화가 열려 있어도 검색 알약이 보인다. 폭이 좁아지면서 새 피드백 버튼이 찌그러지지 않도록 버튼에 `flex: none`, 검색 칸에 `min-width: 0`을 지정했다.
- **JS**: 휴대폰 셸의 떠 있는 뒤로 가기 버튼은 대화가 열리면 "메시지"(목록으로 돌아가기)로 바뀌었다. 나란히 보는 화면에서는 목록이 이미 옆에 보이므로 돌아갈 화면이 없다. 메모 앱의 `useShellSize`처럼 `useElementWidth`로 앱 폭을 측정해, 640px 이하일 때만 "메시지" 뒤로 가기를 표시한다.

![932×430 가로 화면의 수정 전후](./images/messages-layout-fixes-tablet-932.jpg '가로로 눕힌 휴대폰 (932×430)')

> [!WARNING] 사이트 기준과 앱 기준 사이 구간
> [날씨 앱](/memo/weather-layout-fixes)에서도 641~767px 구간에서 같은 종류의 문제를 수정한 적이 있다. 사이트의 휴대폰 기준(767px)과 앱의 한 화면 기준(640px)이 다르면, 그 사이 구간에서는 "휴대폰 셸 + 넓은 배치" 조합이 생긴다는 점을 앱마다 확인해야 한다.

## 빈 목록의 말풍선 아이콘이 잘렸다

빈 목록에는 "아직 남겨진 피드백이 없어요." 위에 Font Awesome의 말풍선 아이콘(`fa-comments`, 40px)이 있다. 실제 iPhone Safari에서 이 아이콘의 윗부분이 약간 잘렸다.

Font Awesome은 아이콘에 `line-height: 1`을 지정하므로 줄 상자는 40px이다. 그런데 캔버스의 [`measureText()`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText)로 측정하면 이 글리프는 글꼴의 ascent(35px)·descent(5px)보다 위아래로 2.5px씩 더 그려진다.

| 값                                    | 크기           |
| ------------------------------------- | -------------- |
| `fontBoundingBoxAscent` / `Descent`   | 35px / 5px     |
| `actualBoundingBoxAscent` / `Descent` | 37.5px / 7.5px |
| 잉크 높이                             | 45px           |

글리프가 줄 상자 밖으로 나가는 것 자체는 보통 문제가 되지 않는다. 다만 목록 항목은 나타날 때 `rise-in` 애니메이션(`opacity`, `transform`)을 쓰므로 합성 레이어가 되고, iOS Safari는 그 레이어를 레이아웃 상자 크기로 클리핑할 수 있다[^ink]. 아이콘의 위쪽 끝이 목록 항목의 위쪽 끝과 같은 위치(위 여백 0)에 있어서, ==상자 밖으로 나간 2.5px가 잘렸다==. 데스크톱 Chromium과 WebKit에서는 재현되지 않았다.

![말풍선 아이콘의 줄 상자와 잉크 영역. 수정 전에는 잉크가 위아래로 2.5px씩 상자 밖으로 나가고, 수정 후에는 상자 안에 들어간다](./images/messages-layout-fixes-glyph.svg '줄 상자 40px → 50px')

`line-height: 1.25`로 줄 상자를 50px로 늘려 위아래 반쪽 leading 5px 안에 잉크가 들어가게 했다. 늘어난 5px씩은 바깥 여백(`margin-top` 56px → 51px, `margin-bottom` 6px → 1px)에서 빼서 아이콘 위치는 수정 전과 같다. 시험은 `measureText()`로 잉크의 위아래 끝을 계산해 줄 상자 안에 있는지 확인한다.

## 가짜 visualViewport로 키보드 재현하기

시험 브라우저에서는 화면 키보드가 표시되지 않는다. 그래서 페이지를 열기 전에 `window.visualViewport`를 가짜 객체로 교체하고, 높이와 `offsetTop`을 바꿔 iOS Safari에서 키보드가 올라온 상태를 재현한다.

| 시험 파일                     | 상황                                 | 기대 결과                                                                     |
| ----------------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `e2e/mobile.spec.ts`          | 키보드가 올라온 상태                 | 서식 알약의 하단이 키보드 위 8px, 폭은 화면 폭 − 좌우 12px, 새 메모 버튼 없음 |
| `e2e/mobile.spec.ts`          | 키보드가 올라온 상태에서 누름        | 서식 버튼이 그대로 동작                                                       |
| `e2e/mobile.spec.ts`          | 키보드가 내려간 상태                 | 원래 위치, 새 메모 버튼 복원                                                  |
| `e2e/mobile.spec.ts`          | 120px 미만 감소(주소창)              | 키보드로 판단하지 않음                                                        |
| `e2e/mobile.spec.ts`          | 문단 도구                            | 서식 막대가 문단 막대로 바뀌고, 문단을 위로 이동한 뒤 닫으면 서식 도구로 복귀 |
| `e2e/mobile-messages.spec.ts` | 키보드가 올라오고 비주얼 뷰포트 이동 | 이름 알약과 상태 표시줄이 비주얼 뷰포트 맨 위에서 키보드 전과 같은 위치       |

메시지 앱 캡처도 같은 방식으로 찍고 비주얼 뷰포트 영역만 잘랐다. #230 전체의 변경 규모는 9개 파일, 378줄 추가, 9줄 삭제이고 그중 107줄이 시험이다.

<details>
<summary>가짜 visualViewport의 동작</summary>

가짜 `visualViewport`는 높이를 바꾸는 함수(`__keyboard`)를 `window`에 등록하고, 이 함수를 호출하면 등록된 `resize` 이벤트 리스너를 모두 호출한다. 시험은 `setKeyboard(page, 높이)`로 키보드를 올리고 내린다. 가짜 객체는 Playwright의 [`page.addInitScript`](https://playwright.dev/docs/api/class-page#page-add-init-script)로 설치한다. 이 스크립트는 페이지의 스크립트보다 먼저 실행되므로 앱이 처음부터 가짜 객체를 사용한다.

</details>

## 남은 것·정리

- 실제 iPhone에서의 확인은 시험으로 대체할 수 없다. 가짜 `visualViewport`는 알려진 iOS Safari의 동작을 재현할 뿐이다.
- 휴대폰 웹에서 "화면 높이"는 하나가 아니다. 레이아웃 뷰포트, 비주얼 뷰포트, `dvh`가 서로 다르게 변한다. 하단에 붙이는 요소는 가려진 높이(`keyboardInset()`), 상단을 고정하는 화면은 비주얼 뷰포트의 위치와 높이(`keyboardViewport()`)처럼 ==어느 값을 기준으로 쓸지 먼저 정해야 한다==.
- `cssVars()`에 `--`를 붙여 전달한 실수처럼, CSS 변수 이름 하나가 틀리면 그 선언 전체가 무효가 된다. 콘솔에 오류도 경고도 출력되지 않는다. 계산된 값을 조회하는 것이 가장 빠른 확인 방법이다.
- 사이트의 휴대폰 기준(767px)과 앱의 배치 기준(640px)이 다르면 그 사이 구간을 앱마다 확인해야 한다.

## 관련 글

- [휴대폰 메모](/memo/memo-mobile): 휴대폰 화면의 메모 앱
- [인라인 스타일 정리와 cssVars](/memo/inline-style-cleanup): `cssVars()`를 만든 글
- [상태 표시줄과 홈 인디케이터 대비](/memo/mobile-bars-contrast): 휴대폰 셸의 상태 표시줄과 홈 바
- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion): 휴대폰 화면 E2E 시험 구성
- [useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준](/memo/weather-layout-fixes): 641~767px 구간의 같은 종류 문제
- [macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점](/memo/safari-macos-ios-rendering): iOS Safari에서만 보이는 다른 차이
- [첫 요청 실패와 사용 중 연결 끊김을 구분하는 메시지 앱 오류 처리](/memo/messages-offline): 메시지 앱의 다른 수정

[^invalid-var]: 정의되지 않은 사용자 정의 속성을 `var()`로 참조하면 그 선언은 파싱 단계가 아니라 계산 단계에서 무효(invalid at computed-value time)가 된다. 이때 브라우저는 앞선 다른 `bottom` 선언으로 돌아가지 않고 속성의 초기값(`bottom`은 `auto`)을 사용한다. [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

[^ink]: 레이아웃이 계산하는 넘침(overflow) 영역에는 글꼴 지표(ascent·descent)까지만 들어가고, 실제 글리프가 그 밖으로 그려지는 부분은 포함되지 않을 수 있다. 합성 레이어의 크기를 이 영역으로 정하면 지표 밖의 잉크가 잘린다.

#MacFolio #TIL #메모앱 #프론트엔드 #CSS #Safari #iOS #트러블슈팅
