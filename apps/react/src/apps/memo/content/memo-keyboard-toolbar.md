---
title: 휴대폰 키보드 위에 서식 막대 표시하기 — visualViewport로 키보드 높이 측정
date: 2026-10-16
category: 개발기/MacFolio/프론트엔드
summary: 휴대폰에서 메모를 쓰다 키보드가 올라오면 서식 알약이 키보드 뒤에 가려졌다. iOS Safari는 키보드가 올라와도 레이아웃 뷰포트를 줄이지 않는다. visualViewport로 가려진 높이를 측정해 서식 막대를 키보드 바로 위에 표시하고, iOS 메모의 문단 도구도 추가했다.
---

휴대폰 화면의 메모 본문에는 하단에 플로팅 서식 알약(가가, 체크리스트, 표, 이미지, 첨부)과 새 메모 버튼이 있다. 그런데 본문을 눌러 키보드가 올라오면 이 알약이 키보드 뒤에 가려 보이지 않았다. 입력 중에 서식을 바꾸려면 키보드를 내려야 했다.

iOS 메모는 키보드 바로 위에 서식 막대가 화면 폭 전체로 붙는다. 같은 배치로 구현했다([#230](https://github.com/hyeoniverse/MacFolio/pull/230)). 같은 PR에서 iOS 메모의 문단 도구(들여쓰기·이동·인용·목록)도 서식 막대에 추가했다.

## 키보드가 올라와도 레이아웃 뷰포트는 그대로

iOS Safari는 키보드가 올라와도 [레이아웃 뷰포트](https://developer.mozilla.org/en-US/docs/Glossary/Layout_viewport)(`window.innerHeight`, `100dvh`)를 줄이지 않는다. 줄어드는 것은 실제로 화면에 보이는 영역인 [비주얼 뷰포트](https://developer.mozilla.org/en-US/docs/Glossary/Visual_Viewport)([`window.visualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport))뿐이다. 그래서 `position: fixed; bottom: 0`이나 화면 높이를 가득 채운 상자의 하단에 배치한 요소는 키보드 뒤로 들어간다. Android Chrome도 현재 기본 동작은 같다(비주얼 뷰포트만 줄인다).

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

## 키보드 위에 붙이기

키보드가 올라와 있으면 하단 막대에 `above-keyboard` 클래스를 추가하고, 높이를 CSS 변수 `--keyboard-inset`으로 전달한다. CSS는 막대를 그 높이만큼 올리고 서식 알약을 화면 폭 전체로 늘린다. 새 메모 버튼은 그동안 숨긴다(iOS 메모도 입력 중에는 표시하지 않는다).

```css
.container.mobile .memo-phone-bottom.above-keyboard {
	bottom: calc(var(--keyboard-inset) + 8px);
	left: 12px;
	right: 12px;
}
```

처음 구현에서는 막대가 화면 맨 위에 표시됐다. CSS 변수를 전달하는 `cssVars()`가 이름 앞에 `--`를 붙이는데, 이름을 `'--keyboard-inset'`로 전달해서 `----keyboard-inset`이 됐다. `var(--keyboard-inset)`이 정의되지 않았으므로 `bottom` 선언 전체가 계산 시점에 무효[^invalid-var]가 되어, `bottom`이 `auto`인 상자처럼 위쪽에 렌더링됐다.

## 입력 중인 줄이 가려지지 않게

편집기는 커서가 있는 줄이 위아래의 플로팅 막대에 가려지지 않도록 스크롤 위치를 조정한다. 키보드가 올라와 있으면 화면에 보이는 하단은 키보드 위쪽이므로, 그 좌표를 하단 기준으로 사용한다.

## 문단 도구

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

## 시험

시험 브라우저에서는 화면 키보드가 표시되지 않는다. 그래서 페이지를 열기 전에 `window.visualViewport`를 가짜 객체로 교체하고, 그 높이만 줄여 iOS Safari에서 키보드가 올라온 상태를 재현한다.

| 상황                          | 기대 결과                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------- |
| 키보드가 올라온 상태          | 서식 알약의 하단이 키보드 위 8px, 폭은 화면 폭 − 좌우 12px, 새 메모 버튼 없음 |
| 키보드가 올라온 상태에서 누름 | 서식 버튼이 그대로 동작                                                       |
| 키보드가 내려간 상태          | 원래 위치, 새 메모 버튼 복원                                                  |
| 120px 미만 감소(주소창)       | 키보드로 판단하지 않음                                                        |
| 문단 도구                     | 서식 막대가 문단 막대로 바뀌고, 문단을 위로 이동한 뒤 닫으면 서식 도구로 복귀 |

모두 `e2e/mobile.spec.ts`에 있다. PR 전체의 변경 규모는 9개 파일, 378줄 추가, 9줄 삭제이고 그중 107줄이 시험이다.

<details>
<summary>가짜 visualViewport의 동작</summary>

가짜 `visualViewport`는 높이를 바꾸는 함수(`__keyboard`)를 `window`에 등록하고, 이 함수를 호출하면 등록된 `resize` 이벤트 리스너를 모두 호출한다. 시험은 `setKeyboard(page, 높이)`로 키보드를 올리고 내린다. 가짜 객체는 Playwright의 [`page.addInitScript`](https://playwright.dev/docs/api/class-page#page-add-init-script)로 설치한다. 이 스크립트는 페이지의 스크립트보다 먼저 실행되므로 앱이 처음부터 가짜 객체를 사용한다.

</details>

## 남은 것·정리

- 실제 iPhone에서의 확인은 시험으로 대체할 수 없다. 가짜 `visualViewport`는 알려진 iOS Safari의 동작을 재현할 뿐이다.
- `cssVars()`에 `--`를 붙여 전달한 실수처럼, CSS 변수 이름 하나가 틀리면 그 선언 전체가 무효가 된다. 콘솔에 오류도 경고도 출력되지 않는다. 계산된 값을 조회하는 것이 가장 빠른 확인 방법이다.
- 휴대폰 웹에서 "화면 높이"는 하나가 아니다. 레이아웃 뷰포트, 비주얼 뷰포트, `dvh`가 서로 다르게 변한다. 어느 값을 하단 기준으로 쓸지 먼저 정해야 한다.

## 관련 글

- [휴대폰 메모](/memo/memo-mobile)
- [인라인 스타일 정리와 cssVars](/memo/inline-style-cleanup)
- [상태 표시줄과 홈 인디케이터 대비](/memo/mobile-bars-contrast)
- [Playwright로 휴대폰 화면과 움직임 시험](/memo/playwright-mobile-and-motion)

[^invalid-var]: 정의되지 않은 사용자 정의 속성을 `var()`로 참조하면 그 선언은 파싱 단계가 아니라 계산 단계에서 무효(invalid at computed-value time)가 된다. 이때 브라우저는 앞선 다른 `bottom` 선언으로 돌아가지 않고 속성의 초기값(`bottom`은 `auto`)을 사용한다. [MDN: Using CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

#MacFolio #메모앱 #프론트엔드 #트러블슈팅
