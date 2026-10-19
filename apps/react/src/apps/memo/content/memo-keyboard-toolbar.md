---
title: 휴대폰 키보드 위에 서식 막대 띄우기 — visualViewport로 키보드 높이 재기
date: 2026-10-16
category: 개발기/MacFolio/프론트엔드
summary: 휴대폰에서 메모를 쓰다 키보드가 올라오면 서식 알약이 키보드 뒤에 깔렸다. iOS Safari는 키보드가 올라와도 화면을 줄이지 않는다. visualViewport로 가린 높이를 재어 서식 막대를 키보드 바로 위에 띄우고, iOS 메모의 문단 도구도 더했다.
---

휴대폰 화면의 메모 본문에는 아래에 떠 있는 서식 알약(가가, 체크리스트, 표, 이미지, 첨부)과 새 메모 버튼이 있다. 그런데 본문을 눌러 키보드가 올라오면 이 알약이 키보드 뒤에 깔려 보이지 않았다. 쓰는 동안 서식을 바꾸려면 키보드를 내려야 했다.

iOS 메모는 키보드 바로 위에 서식 막대가 폭 가득 붙는다. 같은 모양으로 만들었다([#230](https://github.com/hyeoniverse/MacFolio/pull/230)). 같은 PR에서 iOS 메모의 문단 도구(들여쓰기·옮기기·인용·목록)도 서식 막대에 더했다.

## 키보드가 올라와도 화면은 그대로

iOS Safari는 키보드가 올라와도 레이아웃 뷰포트(`window.innerHeight`, `100dvh`)를 줄이지 않는다. 줄어드는 것은 실제로 보이는 곳인 `visualViewport`뿐이다. 그래서 `position: fixed; bottom: 0`이나 화면 높이를 꽉 채운 상자의 아래에 붙인 것은 키보드 뒤로 들어간다. Android Chrome도 지금은 기본으로 같다(보이는 곳만 줄인다).

키보드가 가린 높이는 레이아웃 뷰포트의 바닥에서 보이는 곳의 바닥을 뺀 값이다.

```ts
export function keyboardInset(): number {
	const viewport = window.visualViewport;
	if (!viewport) return 0;
	const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
	return hidden >= MIN_KEYBOARD_PX ? Math.round(hidden) : 0;
}
```

![레이아웃 뷰포트와 보이는 곳, 키보드 높이](./images/memo-keyboard-toolbar-viewport.svg '키보드가 가린 높이를 CSS 변수로 넘겨 서식 알약을 그만큼 올린다')

`offsetTop`을 더하는 것은 키보드가 올라올 때 Safari가 보이는 곳을 아래로 밀어 커서를 보여 주는 경우가 있어서다. 주소창이 접히고 펴질 때도 보이는 곳의 높이가 조금 바뀌므로, 120px보다 작은 차이는 키보드로 보지 않는다.

`visualViewport`의 `resize`·`scroll`을 들어 이 값을 다시 읽는다(`useKeyboardInset`). 편집기가 열려 있을 때만 듣는다.

키보드 높이를 알아내는 방법은 셋을 견줬다.

| 방법                                                                  | 좋은 점                             | 걸리는 점                                                                                     |
| --------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `<meta name="viewport" content="interactive-widget=resizes-content">` | 화면 자체가 줄어 CSS만으로 된다     | Android Chrome만 따르고 iOS Safari는 따르지 않는다. 화면 전체 배치가 키보드마다 다시 계산된다 |
| VirtualKeyboard API (`navigator.virtualKeyboard`)                     | 키보드 자리를 정확히 준다           | Chromium 계열만 있다. iOS에 없다                                                              |
| **`visualViewport`로 재기**                                           | iOS Safari·Android Chrome 모두 있다 | 주소창 변화와 키보드를 가려야 한다(120px 기준)                                                |

## 키보드 위에 붙이기

키보드가 올라와 있으면 아래 막대에 `above-keyboard`를 붙이고, 높이를 CSS 변수로 넘긴다. CSS는 그만큼 올리고 서식 알약을 폭 가득 늘린다. 새 메모 버튼은 그동안 숨긴다(iOS 메모도 쓰는 동안에는 없다).

```css
.container.mobile .memo-phone-bottom.above-keyboard {
	bottom: calc(var(--keyboard-inset) + 8px);
	left: 12px;
	right: 12px;
}
```

처음에는 막대가 화면 맨 위로 튀어 올라갔다. CSS 변수를 넘기는 `cssVars()`가 이름 앞에 `--`를 붙이는데, 이름을 `'--keyboard-inset'`로 넘겨서 `----keyboard-inset`이 됐다. `var(--keyboard-inset)`이 없으니 `bottom` 값 전체가 무효가 되어, 위치가 정해지지 않은 상자처럼 위에 그려졌다.

## 쓰는 줄이 가리지 않게

편집기는 커서 줄이 위아래의 떠 있는 막대에 가리지 않게 스크롤을 맞춘다. 키보드가 올라와 있으면 보이는 바닥은 키보드 위라서, 그 자리를 바닥으로 보고 맞춘다.

## 문단 도구

iOS 메모는 서식 막대의 ¶ 버튼을 누르면 막대가 문단 도구로 바뀐다. 같은 흐름을 만들었다(`writer/ParagraphTools.tsx`). 내어쓰기·들여쓰기, 문단을 위·아래로 옮기기, 블록 인용, 구분점 목록이 있고, × 를 누르면 원래 서식 도구로 돌아간다. 인용과 목록은 켜져 있으면 `aria-pressed`가 참이다.

![서식 도구와 문단 도구](./images/memo-keyboard-toolbar-paragraph.svg '¶로 문단 도구로 바꾸고, ×로 돌아온다')

옮기기 아이콘은 처음에 위·아래 화살표만 그렸다. 그랬더니 스크롤이나 커서 이동처럼 보여서, 화살표 옆에 문단 세 줄을 그린 SVG로 바꿨다. 크기와 굵기는 옆의 Font Awesome 들여쓰기 아이콘에 맞췄다. 버튼은 모두 `IconButton`이고, 누를 때 편집기의 초점을 빼앗지 않게(`keepFocus`) 해서 키보드가 내려가지 않는다.

## 시험

시험 브라우저에서는 화면 키보드가 뜨지 않는다. 그래서 페이지를 열기 전에 `window.visualViewport`를 가짜로 바꿔 두고, 그 높이만 줄여 iOS Safari처럼 키보드가 올라온 상태를 만든다.

- 키보드가 올라오면 서식 알약의 아래 끝이 키보드 위 8px, 폭은 화면 폭에서 좌우 12px을 뺀 만큼, 새 메모 버튼은 없다
- 서식 버튼은 그대로 누를 수 있다
- 키보드가 내려가면 제자리, 새 메모 버튼도 돌아온다
- 120px보다 작게 줄어드는 것(주소창)은 키보드로 보지 않는다
- 문단 도구: 서식 막대가 문단 막대로 바뀌고, 문단을 위로 옮긴 뒤 닫으면 서식 도구로 돌아온다

모두 `e2e/mobile.spec.ts`에 있다. 가짜 `visualViewport`는 높이를 바꾸는 함수(`__keyboard`)를 창에 두고, 부르면 등록된 `resize` 듣는 함수를 모두 부른다. 시험은 `setKeyboard(page, 높이)`로 키보드를 올리고 내린다. PR 전체는 9개 파일, 378줄 더하기, 9줄 지우기이고 그중 107줄이 시험이다.

## 남은 것·배운 것

- 실제 iPhone에서의 확인은 시험이 대신하지 못한다. 가짜 `visualViewport`는 내가 아는 iOS Safari의 동작을 흉내 낼 뿐이다.
- `cssVars()`에 `--`를 붙여 넘긴 실수처럼, CSS 변수 이름 하나가 틀리면 그 줄 전체가 무효가 된다. 오류도 경고도 없다. 계산된 값을 읽어 보는 것이 가장 빠르다.
- 휴대폰 웹에서 "화면 높이"는 하나가 아니다. 레이아웃 뷰포트, 보이는 곳, `dvh`가 다 다르게 움직인다. 무엇이 바닥인지 먼저 정해야 한다.

## 관련 글

- [휴대폰 메모](/memo/memo-mobile)
- [인라인 스타일 정리와 cssVars](/memo/inline-style-cleanup)
- [상태 표시줄과 홈 인디케이터 대비](/memo/mobile-bars-contrast)
- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion)

#MacFolio #메모앱 #프론트엔드 #트러블슈팅
