---
title: '!important 66개 지우기와 공통 아이콘 단추'
date: 2026-10-01
category: 개발기/MacFolio/공통 UI
summary: 앱 기본값을 CSS 층으로 내린 덕분에 남은 !important를 모두 지울 수 있었다. 지우면서 생긴 차이는 화면 비교와 계산된 스타일 비교로 찾았다. 그리고 앱마다 따로 있던 아이콘 단추를 공통 IconButton 하나로 합쳤다.
---

공통 컴포넌트로 옮기는 세 번째 단계다. '!important 72개의 뿌리' 글에서 앱 루트의 기본값(`.memo button`)을 `reset` 층으로 내렸다. 그때 `!important`는 일부러 남겨 두었다. 단추마다 다른 상태와 겨루고 있을 수 있어서 하나씩 확인해야 했기 때문이다. 이번에 그 확인을 했다.

## 지우고, 다르게 보이는 것을 찾는다

1단계 때 72개였고, 2단계까지 쓰지 않는 CSS를 지우면서 6개가 함께 사라졌다. 남은 것은 66개였다. 메모 25, 음악 11, 메시지 11, GitHub 7, 메일 6, Safari 4, 터미널 단축어 2개다. 이것 말고 움직임 줄이기 설정(`prefers-reduced-motion`)의 2개는 모든 움직임을 확실히 끄려는 것이라 남겼다.

먼저 66개를 한꺼번에 지웠다. 그리고 바뀐 것을 두 가지 방법으로 찾았다.

1. **화면 비교**: 1단계에서 만든 58장 비교를 다시 돌린다
2. **계산된 스타일 비교**: 앱을 하나씩 열고, 보이는 모든 단추와 링크의 `getComputedStyle`을 적는다. 마우스를 올린 상태도 적는다

두 번째가 필요했던 이유는 화면 비교가 **찍은 순간의 상태**만 보기 때문이다. `!important`의 상당수는 켜진 단추, 고른 항목, 마우스를 올린 항목처럼 상태가 바뀔 때만 드러나는 값을 지키고 있었다.

```ts
for (let i = 0; i < count; i++) {
	const el = buttons.nth(i);
	out[`${app}|${i}|${label}`] = await read(el); // color, background-color, padding, font-size …
	await el.hover();
	out[`${app}|${i}|${label}|hover`] = await read(el);
}
```

`main`과 이 브랜치에서 각각 JSON으로 남기고 서로 비교했다. 마우스를 올린 상태까지 합쳐 약 1,200건이다.

## 찾은 것 셋

### 켜진 단추에 마우스를 올리면 회색이 되었다

화면 비교에서 0.06%가 나왔다. 서식 창을 연 '가가' 단추였다.

![켜진 단추](./images/shared-button-hover.png '전: 켜진 노란 바탕. 후(!important만 지웠을 때): 마우스를 올린 회색이 이겼다')

```css
.memo-tool:hover:not(:disabled) { … } /* (0,3,0) — :not() 안의 :disabled도 센다 */
.memo-tool.on { … }                   /* (0,2,0) */
```

`:not(:disabled)`은 안에 든 선택자의 점수를 그대로 더한다. 그래서 올렸을 때 규칙이 켜진 규칙보다 점수가 높았다. 그동안은 켜진 규칙의 `!important`가 이 차이를 덮고 있었다. `:where(:not(:disabled))`로 바꿔 점수를 같게 하고, 뒤에 있는 켜진 규칙이 이기게 했다.

### GitHub의 링크가 검정이 되었다

계산된 스타일 비교에서 나왔다. 저장소 이름과 블로그 주소가 파란색(`rgb(9, 105, 218)`)에서 글자색으로 바뀌었다. GitHub 장면에서는 이 링크들이 창 아래로 넘어가 거의 보이지 않아서, 화면 비교로는 잡히지 않았다.

```css
.gh a {
	color: var(--gh-link);
} /* (0,1,1) */
.gh-tab {
	color: var(--gh-text) !important;
} /* (0,1,0) — 탭도 a라서 !important로 이겼다 */
```

처음에는 `.gh a`를 메모처럼 `reset` 층으로 내렸다. 그런데 층 밖의 전역 규칙 `a { color: inherit }`(index.css)에 졌다. **층 밖의 규칙은 점수가 아무리 낮아도 층 안의 규칙을 이긴다.** 그래서 전역 `a`와 `*` 규칙도 `reset` 층으로 옮겼다. 그러자 `.gh a`는 층 안에서 전역 `a`를 이기고, 층 밖의 `.gh-tab`에는 졌다. 원래 의도대로다.

음악의 곡 목록도 비슷했다. 홀수 줄 배경(`li:nth-child(odd) .music-track`, (0,3,1))이 마우스를 올린 배경(`.music-track:hover`, (0,2,0))을 이기고 있었다. 홀수 줄 쪽을 `:where(:nth-child(odd))`로 감쌌다.

### 쓰이지 않던 규칙

메모 고정 단추에는 이런 규칙이 있었다.

```css
/* 고정 단추: 고정되어 있으면 강조 색 */
.memo-pin.on {
	color: var(--memo-accent) !important;
}
```

그런데 계산된 값은 강조 색이 아니라 글자색이었다. 파일 뒤쪽의 `.memo-tool.on { color: var(--memo-text) !important; }`과 점수가 같아서, 뒤에 있는 쪽이 이겼다. `!important`끼리 겨루면 다시 점수와 순서로 정해진다. 이 규칙은 처음부터 한 번도 쓰이지 않았다. 지금 보이는 모습을 지키려고 지웠다.

## 공통 아이콘 단추

`!important`가 사라지자 공통 컴포넌트를 만들 수 있게 되었다. 도구 막대의 아이콘 단추는 메모(`.memo-tool`), Safari(`.safari-tool`), 메일·메시지(`.mail-round-button`, `.messages-round-button`)에 따로 있었다. 크기와 모서리는 같고 색만 달랐다.

```tsx
<IconButton label="메모 삭제" icon="fa-regular fa-trash-can" onClick={remove} />
<IconButton label="서식" on={formatOpen} aria-expanded={formatOpen}>가가</IconButton>
<IconButton variant="float" label="새로운 메시지" icon="fa-regular fa-pen-to-square" />
```

- `label`은 `aria-label`이 되고, `title`을 따로 주지 않으면 마우스를 올렸을 때 보이는 설명도 된다. 그래서 Safari의 이전·다음 탭 단추에도 설명이 생겼다
- `on`은 켜진 모양만 준다. `aria-pressed`(고정)인지 `aria-expanded`(창 열림)인지는 쓰는 곳에서 정한다
- 색은 앱이 정한다. 단추 CSS는 `--ui-tool-color` 같은 변수만 쓴다

```css
[data-app='memo'] {
	--ui-tool-color: var(--memo-muted);
	--ui-tool-hover: var(--memo-hover);
	--ui-tool-on-bg: color-mix(in srgb, var(--memo-accent) 28%, transparent);
	--ui-tool-on-color: var(--memo-text);
}
```

![여러 앱의 같은 단추](./images/shared-button-toolbars.jpg '메모, Safari, 메일의 단추가 모두 IconButton이다')

### components 층

단추의 CSS는 새로 만든 `components` 층에 넣었다.

![CSS 층 셋](./images/shared-button-layers.svg '위에 있을수록 이긴다. reset < components < 앱의 CSS')

- `reset`보다 위라서 앱 루트의 `button { color: inherit }`을 이긴다
- 앱의 CSS(층 밖)보다는 아래라서, 메모가 '가가' 단추의 여백을 바꾸는 `.memo-format-button { padding: 0 8px }` 같은 규칙이 점수와 상관없이 이긴다

이렇게 해 두면 공통 단추를 앱에서 조금 바꿀 때 점수를 맞출 필요가 없다. `!important`가 다시 생길 이유가 없다.

여기서 한 번 더 걸렸다. 처음 돌렸을 때 공통 단추의 여백(`padding: 0 7px`)이 0이 되었다. index.css 맨 위의 `* { margin: 0; padding: 0 }`이 층 밖에 있었기 때문이다. 점수가 (0,0,0)인 `*`도 층 밖이면 층 안의 모든 규칙을 이긴다. 그래서 위에서 말한 `a`와 함께 이 `*`도 `reset` 층으로 옮겼다. 옮긴 뒤 계산된 스타일과 화면을 다시 비교했고, 이것만으로 바뀐 것은 없었다.

## 결과

- `!important`: 66개 → 0개 (움직임 줄이기의 2개만 남음)
- 아이콘 단추: 4가지 CSS → `IconButton` 하나 (메모 16개, Safari 4개, 메일 1개, 메시지 3개)
- 화면 58장: 모두 0.001% 이하 (시계 고정 후 남는 잡음 수준)
- 계산된 스타일: 바뀐 것은 메시지 새 피드백 단추의 `z-index`(공통 단추는 창의 끌기 영역 위에 있게 `z-index: 4`를 준다)와, 같은 상자 크기를 다르게 적은 값들(Safari 단추의 `width: 30px` → `min-width: 30px` + 여백)뿐이다

다음 단계에서는 글자가 있는 단추(`Button`), 목록의 줄(`ListRow`), 나눔 단추(`SegmentedControl`)를 같은 방법으로 옮긴다.

#MacFolio #CSS #공통컴포넌트
