---
title: 휴대폰 키보드 위에 서식 막대 띄우기 — visualViewport로 키보드 높이 재기
date: 2026-10-16
category: 개발기/MacFolio/프론트엔드
summary: 휴대폰에서 메모를 쓰다 키보드가 올라오면 화면 아래의 서식 알약이 키보드 뒤에 깔렸다. iOS Safari는 키보드가 올라와도 화면을 줄이지 않기 때문이다. visualViewport로 키보드가 가린 높이를 재어 iOS 메모처럼 서식 막대를 키보드 바로 위에 띄웠다.
---

휴대폰 화면의 메모 본문에는 아래에 떠 있는 서식 알약(가가, 체크리스트, 표, 이미지, 첨부)과 새 메모 단추가 있다. 그런데 본문을 눌러 키보드가 올라오면 이 알약이 키보드 뒤에 깔려 보이지 않았다. 쓰는 동안 서식을 바꾸려면 키보드를 내려야 했다.

iOS 메모는 키보드 바로 위에 서식 막대가 폭 가득 붙는다. 같은 모양으로 만들었다.

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

`offsetTop`을 더하는 것은 키보드가 올라올 때 Safari가 보이는 곳을 아래로 밀어 커서를 보여 주는 경우가 있어서다. 주소창이 접히고 펴질 때도 보이는 곳의 높이가 조금 바뀌므로, 120px보다 작은 차이는 키보드로 보지 않는다.

`visualViewport`의 `resize`·`scroll`을 들어 이 값을 다시 읽는다(`useKeyboardInset`). 편집기가 열려 있을 때만 듣는다.

## 키보드 위에 붙이기

키보드가 올라와 있으면 아래 막대에 `above-keyboard`를 붙이고, 높이를 CSS 변수로 넘긴다. CSS는 그만큼 올리고 서식 알약을 폭 가득 늘린다. 새 메모 단추는 그동안 숨긴다(iOS 메모도 쓰는 동안에는 없다).

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

## 시험

시험 브라우저에서는 화면 키보드가 뜨지 않는다. 그래서 페이지를 열기 전에 `window.visualViewport`를 가짜로 바꿔 두고, 그 높이만 줄여 iOS Safari처럼 키보드가 올라온 상태를 만든다.

- 키보드가 올라오면 서식 알약의 아래 끝이 키보드 위 8px, 폭은 화면 폭에서 좌우 12px을 뺀 만큼, 새 메모 단추는 없다
- 서식 단추는 그대로 누를 수 있다
- 키보드가 내려가면 제자리, 새 메모 단추도 돌아온다
- 120px보다 작게 줄어드는 것(주소창)은 키보드로 보지 않는다

#메모앱 #프론트엔드 #트러블슈팅
