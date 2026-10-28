---
title: '!important 66개 지우기와 공통 아이콘 버튼'
date: 2026-10-01
category: 개발 기록/MacFolio/스타일·컴포넌트
summary: 앱 기본값을 CSS 레이어로 내린 덕분에 남은 !important 66개를 모두 삭제했다. 화면 58장과 계산된 스타일 약 1,200건을 비교해 차이 세 건을 찾아 수정했고, 앱마다 별도로 있던 아이콘 버튼 4종을 IconButton 하나로 통합했다.
---

공통 컴포넌트로 전환하는 세 번째 단계다([#60](https://github.com/hyeoniverse/MacFolio/pull/60)). [!important 72개의 뿌리 - 앱 기본값을 CSS 층으로 내리기](/memo/css-layer-reset)에서 앱 루트의 기본값(`.memo button`)을 `reset` [레이어](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)로 내렸다. 그때 [`!important`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/important)는 의도적으로 유지했다. 버튼마다 다른 상태 규칙과 우선순위를 다투고 있을 수 있어 하나씩 확인해야 했기 때문이다. 이번에 그 확인을 진행했다.

## 일괄 삭제 후 차이 탐지

1단계 시점에 72개였고, 2단계까지 사용하지 않는 CSS를 삭제하면서 6개가 함께 사라졌다. 남은 것은 66개였다.

| 앱            | `!important` 수 |
| ------------- | --------------- |
| 메모          | 25              |
| 음악          | 11              |
| 메시지        | 11              |
| GitHub        | 7               |
| 메일          | 6               |
| Safari        | 4               |
| 터미널 단축어 | 2               |

이와 별도로 동작 줄이기 설정(`prefers-reduced-motion`)의 2개는 모든 애니메이션을 확실히 끄기 위한 것이라 유지했다.

먼저 66개를 한꺼번에 삭제했다. 그리고 변경된 부분을 두 가지 방법으로 탐지했다.

1. **스크린샷 비교**: 1단계에서 만든 58장 비교를 다시 실행한다
2. **계산된 스타일 비교**: 앱을 하나씩 열고, 보이는 모든 버튼과 링크의 [`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) 결과를 기록한다. 호버 상태도 기록한다

두 번째가 필요했던 이유는 스크린샷 비교가 **캡처 시점의 상태**만 확인하기 때문이다. `!important`의 상당수는 활성 버튼, 선택한 항목, 호버한 항목처럼 상태가 바뀔 때만 드러나는 값을 보호하고 있었다.

```ts
for (let i = 0; i < count; i++) {
	const el = buttons.nth(i);
	out[`${app}|${i}|${label}`] = await read(el); // color, background-color, padding, font-size …
	await el.hover();
	out[`${app}|${i}|${label}|hover`] = await read(el);
}
```

`main`과 이 브랜치에서 각각 JSON으로 저장하고 비교했다. 호버 상태까지 합쳐 약 1,200건이다.

## 발견한 차이 세 건

| 증상                                    | 탐지 방법        | 원인                                                    | 수정                                 |
| --------------------------------------- | ---------------- | ------------------------------------------------------- | ------------------------------------ |
| 활성 버튼에 호버하면 회색               | 스크린샷 (0.06%) | `:not(:disabled)`가 명시도를 높임                       | `:where(:not(:disabled))`로 감쌈     |
| GitHub 링크가 검정으로 바뀜             | 계산된 스타일    | `!important`가 탭 규칙을 보호, 레이어 밖 전역 규칙 우선 | 전역 `a`·`*`를 `reset` 레이어로 이동 |
| 고정 버튼 강조 색 규칙이 적용된 적 없음 | 계산된 스타일    | `!important`끼리 명시도 같아 뒤 규칙 적용               | 미사용 규칙 삭제                     |

### 활성 버튼에 호버하면 회색으로 바뀌었다

스크린샷 비교에서 0.06% 차이가 나왔다. 서식 창을 연 '가가' 버튼이었다.

![켜진 버튼](./images/shared-button-hover.png '전: 켜진 노란 바탕. 후(!important만 지웠을 때): 마우스를 올린 회색이 이겼다')

```css
.memo-tool:hover:not(:disabled) { … } /* (0,3,0) — :not() 안의 :disabled도 센다 */
.memo-tool.on { … }                   /* (0,2,0) */
```

![:not과 :where가 점수를 바꾸는 방식](./images/shared-button-specificity.svg '점수 비교')

[`:not(:disabled)`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:not)는 괄호 안 선택자의 명시도를 그대로 더한다. 그래서 호버 규칙이 활성 규칙보다 명시도가 높았다. 그동안은 활성 규칙의 `!important`가 이 차이를 가리고 있었다. [`:where(:not(:disabled))`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)로 바꿔 명시도를 같게 하고, 뒤에 선언된 활성 규칙이 적용되게 했다.

### GitHub의 링크가 검정으로 바뀌었다

계산된 스타일 비교에서 발견했다. 저장소 이름과 블로그 주소가 파란색(`rgb(9, 105, 218)`)에서 기본 글자색으로 바뀌었다. GitHub 캡처 장면에서는 이 링크들이 창 아래로 넘어가 거의 보이지 않아서, 스크린샷 비교로는 검출되지 않았다.

```css
.gh a {
	color: var(--gh-link);
} /* (0,1,1) */
.gh-tab {
	color: var(--gh-text) !important;
} /* (0,1,0) — 탭도 a라서 !important로 이겼다 */
```

처음에는 `.gh a`를 메모처럼 `reset` 레이어로 내렸다. 그런데 레이어 밖의 전역 규칙 `a { color: inherit }`(index.css)보다 우선순위가 낮아졌다. **레이어 밖의 규칙은 명시도가 아무리 낮아도 레이어 안의 규칙보다 우선한다.** 그래서 전역 `a`와 `*` 규칙도 `reset` 레이어로 옮겼다. 그러자 `.gh a`는 레이어 안에서 전역 `a`보다 우선하고, 레이어 밖의 `.gh-tab`보다는 낮아졌다. 원래 의도대로다.

음악의 곡 목록도 비슷했다. 홀수 행 배경(`li:nth-child(odd) .music-track`, (0,3,1))이 호버 배경(`.music-track:hover`, (0,2,0))보다 우선하고 있었다. 홀수 행 쪽을 `:where(:nth-child(odd))`로 감쌌다.

### 한 번도 적용되지 않은 규칙

메모 고정 버튼에는 다음 규칙이 있었다.

```css
/* 고정 버튼: 고정되어 있으면 강조 색 */
.memo-pin.on {
	color: var(--memo-accent) !important;
}
```

그런데 계산된 값은 강조 색이 아니라 기본 글자색이었다. 파일 뒤쪽의 `.memo-tool.on { color: var(--memo-text) !important; }`과 명시도가 같아서, 뒤에 선언된 규칙이 적용됐다. `!important`끼리 경쟁하면 다시 명시도와 선언 순서로 결정된다. 이 규칙은 처음부터 한 번도 적용되지 않았다. 현재 표시되는 모습을 유지하기 위해 삭제했다.

## 공통 아이콘 버튼

`!important`가 사라지자 공통 컴포넌트를 만들 수 있게 되었다. 도구 막대의 아이콘 버튼은 메모(`.memo-tool`), Safari(`.safari-tool`), 메일·메시지(`.mail-round-button`, `.messages-round-button`)에 각각 있었다. 크기와 모서리는 같고 색만 달랐다.

```tsx
<IconButton label="메모 삭제" icon="fa-regular fa-trash-can" onClick={remove} />
<IconButton label="서식" on={formatOpen} aria-expanded={formatOpen}>가가</IconButton>
<IconButton variant="float" label="새로운 메시지" icon="fa-regular fa-pen-to-square" />
```

- `label`은 `aria-label`이 되고, `title`을 별도로 지정하지 않으면 호버 시 표시되는 툴팁도 된다. 그래서 Safari의 이전·다음 탭 버튼에도 툴팁이 생겼다
- `on`은 활성 스타일만 적용한다. `aria-pressed`(토글)인지 `aria-expanded`(패널 열림)인지는 사용하는 곳에서 지정한다
- 색은 앱이 결정한다. 버튼 CSS는 `--ui-tool-color` 같은 변수만 참조한다

색 지정 방식은 세 가지를 비교해 선택했다.

| 방법                                       | 장점                       | 단점                                                       |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------- |
| `color`·`hoverColor` 같은 props            | 타입이 값을 검사한다       | 다크 모드·활성 상태마다 props가 늘고, 색이 JS로 전달된다   |
| 앱마다 클래스로 덮어쓰기(`.memo .ui-tool`) | 익숙한 방식이다            | 명시도 경쟁이 다시 시작되고, `!important`가 재발할 수 있다 |
| 앱 루트에 CSS 변수(`--ui-tool-*`) (채택)   | 다크 모드는 앱 변수가 처리 | 변수 이름을 문서로 안내해야 한다                           |

앱의 색은 이미 `--memo-muted`처럼 앱 변수로 정의되어 있고 다크 모드도 그 변수가 전환한다. 버튼은 그 변수를 한 번 더 참조하기만 하면 되므로 CSS 변수 방식을 선택했다. 활성 배경은 [`color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)로 강조색에 투명도를 섞는다.

```css
[data-app='memo'] {
	--ui-tool-color: var(--memo-muted);
	--ui-tool-hover: var(--memo-hover);
	--ui-tool-on-bg: color-mix(in srgb, var(--memo-accent) 28%, transparent);
	--ui-tool-on-color: var(--memo-text);
}
```

![여러 앱의 같은 버튼](./images/shared-button-toolbars.jpg '메모, Safari, 메일의 버튼이 모두 IconButton이다')

### components 레이어

버튼의 CSS는 새로 만든 `components` 레이어에 넣었다.

![CSS 층 셋](./images/shared-button-layers.svg '위에 있을수록 이긴다. reset < components < 앱의 CSS')

- `reset`보다 위라서 앱 루트의 `button { color: inherit }`보다 우선한다
- 앱의 CSS(레이어 밖)보다는 아래라서, 메모가 '가가' 버튼의 여백을 바꾸는 `.memo-format-button { padding: 0 8px }` 같은 규칙이 명시도와 관계없이 우선한다

이렇게 구성하면 앱에서 공통 버튼을 조정할 때 명시도를 맞출 필요가 없다. `!important`가 다시 생길 이유가 없다.

여기서 문제가 한 번 더 발생했다. 처음 실행했을 때 공통 버튼의 여백(`padding: 0 7px`)이 0이 되었다. index.css 맨 위의 `* { margin: 0; padding: 0 }`이 레이어 밖에 있었기 때문이다. 명시도가 (0,0,0)인 `*`도 레이어 밖이면 레이어 안의 모든 규칙보다 우선한다. 그래서 앞서 언급한 `a`와 함께 이 `*`도 `reset` 레이어로 옮겼다. 이동 후 계산된 스타일과 스크린샷을 다시 비교했고, 이 이동만으로 바뀐 것은 없었다.

## 결과

| 항목          | 전        | 후                                                                                                                                                                                |
| ------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `!important`  | 66개      | 0개 (동작 줄이기의 2개만 유지)                                                                                                                                                    |
| 아이콘 버튼   | 4가지 CSS | `IconButton` 하나 (메모 16개, Safari 4개, 메일 1개, 메시지 3개)                                                                                                                   |
| 스크린샷 58장 | —         | 모두 0.001% 이하 (시계 고정 후 남는 노이즈 수준)                                                                                                                                  |
| 계산된 스타일 | —         | 메시지 새 피드백 버튼의 `z-index`(공통 버튼은 창 드래그 영역 위에 오도록 `z-index: 4`)와, 같은 상자 크기의 다른 표기(Safari 버튼 `width: 30px` → `min-width: 30px` + 여백)만 변경 |

변경된 파일은 24개, 483줄 추가와 335줄 삭제였다.

글을 쓴 시각의 다음 계획은 텍스트 버튼(`Button`), 목록 행(`ListRow`), 분할 버튼(`SegmentedControl`)을 같은 방법으로 전환하는 것이었다.

## 남은 것·배운 것

- 이 글 이후 `ListRow`와 `SegmentedControl`은 만들지 않기로 했다. 외형은 같아도 앱마다 의미가 달랐다([글자 버튼 하나로 합치기, 그리고 만들지 않은 컴포넌트](/memo/shared-text-button)).
- 이 글을 쓴 시각에 CSS의 `!important`는 23개였다. 동작 줄이기(`motion.css`)와 레이어 설정, 그리고 이후 추가한 Safari 프로젝트 페이지(다른 사이트 디자인을 재현하는 곳)에 있다. 앱 화면에는 다시 생기지 않았다.
- `!important`는 다른 규칙의 명시도 문제를 가린다. 삭제하면 가려져 있던 버그(활성 버튼 호버, 한 번도 적용되지 않던 고정 버튼 규칙)가 드러난다.
- 스크린샷 비교는 캡처 시점만 확인한다. 상태(호버, 활성)가 많은 곳은 계산된 스타일을 상태별로 기록해 비교해야 한다. 이 방법은 이후 [텍스트 버튼 전환](/memo/text-button-migrate)에서도 그대로 사용했다.
- 레이어 밖의 규칙은 명시도와 관계없이 레이어 안의 규칙보다 우선한다. `*`나 `a` 같은 전역 규칙도 레이어 안에 넣어야 레이어 순서가 의도대로 동작한다([공통 버튼의 여백이 사라진 이유](/memo/css-layer-order-fix)).

## 관련 글

- [!important 72개의 뿌리 - 앱 기본값을 CSS 층으로 내리기](/memo/css-layer-reset)
- [공통 버튼의 여백이 사라진 이유 — CSS 층 순서는 처음 나온 파일이 정한다](/memo/css-layer-order-fix)
- [글자 버튼 하나로 합치기, 그리고 만들지 않은 컴포넌트](/memo/shared-text-button)
- [손으로 쓴 아이콘 버튼 45곳을 IconButton으로 — 모양은 그대로 두고](/memo/icon-button-migrate)
- [메뉴 다섯 벌을 하나로 - useDismiss, placement, Menu](/memo/shared-menu)

#MacFolio #CSS #공통컴포넌트
