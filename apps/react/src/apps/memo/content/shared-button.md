---
title: 계산된 스타일 비교로 !important를 일괄 삭제하고 IconButton·Button 공통 버튼 추출하기
date: 2026-10-01
category: 개발 기록/MacFolio/화면·스타일
series: 공통 UI 컴포넌트
seriesOrder: 2
summary: 앱 기본값을 CSS 레이어로 내린 뒤 남은 !important 66개를 삭제하고, 스크린샷 58장과 계산된 스타일 약 1,200건 비교로 차이 세 건을 찾아 수정했다. 아이콘 버튼 4종은 IconButton, 텍스트 버튼 6종은 Button 하나로 통합했다.
---

## 배경: CSS가 규칙 하나를 고르는 방법

### 캐스케이드와 명시도

한 요소의 같은 속성(예: 버튼의 `color`)에 여러 CSS 규칙이 값을 지정하면, 브라우저는 **캐스케이드**(cascade)라는 정해진 순서로 하나를 고른다. 작성자 CSS 기준으로 줄이면 다음 네 단계이고, 위 단계에서 결정되면 아래 단계는 확인하지 않는다.

![중요도, 캐스케이드 레이어, 명시도, 선언 순서의 네 단계와 이 글의 사례](./images/shared-button-cascade.svg '오른쪽 예시는 이 글에서 실제로 만난 경우다. 레이어 밖의 a 규칙이 레이어 안의 더 구체적인 .gh a 규칙을 이기는 것이 2단계의 결과다')

**명시도**(specificity)는 선택자가 얼마나 구체적인지를 `(a, b, c)` 세 숫자로 나타낸 점수다. `a`는 ID 선택자 수, `b`는 클래스·속성 선택자·가상 클래스(`:hover` 등) 수, `c`는 태그 선택자 수이고, 왼쪽 숫자부터 비교한다.

| 선택자                            | a   | b   | c   | 명시도    |
| --------------------------------- | --- | --- | --- | --------- |
| `a`                               | 0   | 0   | 1   | (0, 0, 1) |
| `.gh a`                           | 0   | 1   | 1   | (0, 1, 1) |
| `.memo-tool.on`                   | 0   | 2   | 0   | (0, 2, 0) |
| `.memo-tool:hover:not(:disabled)` | 0   | 3   | 0   | (0, 3, 0) |

[`!important`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/important)를 붙인 선언은 1단계에서 일반 선언을 모두 이긴다. 명시도 경쟁에서 지는 규칙에 `!important`를 붙이면 당장은 원하는 값이 적용되지만, 왜 졌는지는 그대로 남는다. 나중에 `!important`를 삭제하면 가려져 있던 경쟁이 다시 드러난다.

**캐스케이드 레이어**([`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer))는 규칙을 이름 붙은 묶음으로 나누고 묶음 사이의 우선순위를 미리 정하는 기능이다. 레이어 순서는 명시도보다 먼저 비교되므로, 낮은 레이어의 규칙은 명시도가 아무리 높아도 높은 레이어의 규칙에 진다. 레이어에 속하지 않은 규칙은 모든 레이어보다 우선한다.

### 이 작업의 위치

공통 컴포넌트로 전환하는 작업은 네 단계로 진행했고, 이 글은 그중 3단계([#60](https://github.com/hyeoniverse/MacFolio/pull/60))와 4단계([#61](https://github.com/hyeoniverse/MacFolio/pull/61))를 다룬다. 1단계([CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset))에서 앱 루트의 기본값(`.memo button`)을 `reset` 레이어로 내렸다. 그때 `!important`는 의도적으로 유지했다. 버튼마다 다른 상태 규칙과 우선순위를 다투고 있을 수 있어 하나씩 확인해야 했기 때문이다. 3단계에서 그 확인을 진행하고 아이콘 버튼을 통합했고, 4단계에서 텍스트 버튼을 통합했다.

## !important 일괄 삭제와 차이 탐지

### 남아 있던 66개

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

이와 별도로 동작 줄이기 설정의 2개는 유지했다. 동작 줄이기는 운영체제의 "동작 줄이기" 옵션을 켠 사용자에게 CSS 미디어 쿼리 `prefers-reduced-motion: reduce`가 일치하는 기능이고, 이 2개는 각 컴포넌트가 지정한 애니메이션을 명시도와 관계없이 모두 끄기 위한 선언이다.

### 스크린샷 비교와 계산된 스타일 비교

먼저 66개를 한꺼번에 삭제했다. 그리고 변경된 부분을 두 가지 방법으로 탐지했다. **계산된 스타일**(computed style)은 캐스케이드와 상속을 모두 거쳐 요소에 최종 적용된 값이다. 예를 들어 CSS에 `color: var(--gh-link)`라고 적혀 있어도, 계산된 값은 `rgb(9, 105, 218)`처럼 실제 색으로 나온다.

1. **스크린샷 비교**: 1단계에서 만든 58장 비교를 다시 실행한다
2. **계산된 스타일 비교**: 앱을 하나씩 열고, 보이는 모든 버튼과 링크의 [`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle) 결과를 기록한다. 호버 상태도 기록한다

두 번째가 필요했던 이유는 스크린샷 비교가 **캡처 시점의 상태**만 확인하기 때문이다. `!important`의 상당수는 활성 버튼, 선택한 항목, 호버한 항목처럼 ==상태가 바뀔 때만 드러나는 값==을 보호하고 있었다.

```ts
for (let i = 0; i < count; i++) {
	const el = buttons.nth(i);
	out[`${app}|${i}|${label}`] = await read(el); // color, background-color, padding, font-size …
	await el.hover();
	out[`${app}|${i}|${label}|hover`] = await read(el);
}
```

`main`과 이 브랜치에서 각각 JSON으로 저장하고 비교했다. 호버 상태까지 합쳐 약 1,200건이다.

![main과 작업 브랜치에 같은 Playwright 스크립트를 실행해 JSON 두 개를 만들고 키별로 비교하는 절차](./images/shared-button-diff-flow.svg '키는 앱|순서|버튼 이름(|hover)이다. 같은 키의 값이 다르면 그 버튼의 그 상태에서 스타일이 바뀐 것이다')

### 발견한 차이 세 건

| 증상                                    | 탐지 방법        | 원인                                                    | 수정                                 |
| --------------------------------------- | ---------------- | ------------------------------------------------------- | ------------------------------------ |
| 활성 버튼에 호버하면 회색               | 스크린샷 (0.06%) | `:not(:disabled)`가 명시도를 높임                       | `:where(:not(:disabled))`로 감쌈     |
| GitHub 링크가 검정으로 바뀜             | 계산된 스타일    | `!important`가 탭 규칙을 보호, 레이어 밖 전역 규칙 우선 | 전역 `a`·`*`를 `reset` 레이어로 이동 |
| 고정 버튼 강조 색 규칙이 적용된 적 없음 | 계산된 스타일    | `!important`끼리 명시도 같아 뒤 규칙 적용               | 미사용 규칙 삭제                     |

#### 활성 버튼 호버 시 회색 배경

스크린샷 비교에서 0.06% 차이가 나왔다. 서식 창을 연 '가가' 버튼이었다.

![켜진 버튼](./images/shared-button-hover.png '전: 켜진 노란 바탕. 후(!important만 지웠을 때): 마우스를 올린 회색이 이겼다')

```css
.memo-tool:hover:not(:disabled) { … } /* (0,3,0): :not() 안의 :disabled도 집계한다 */
.memo-tool.on { … }                   /* (0,2,0) */
```

![:not과 :where가 점수를 바꾸는 방식](./images/shared-button-specificity.svg '점수 비교')

[`:not(:disabled)`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:not)는 괄호 안 선택자의 명시도를 그대로 더한다. 그래서 호버 규칙이 활성 규칙보다 명시도가 높았다. 그동안은 활성 규칙의 `!important`가 이 차이를 가리고 있었다. [`:where()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)는 괄호 안 선택자와 같은 요소를 고르지만 명시도를 0으로 계산하는 가상 클래스다. `:where(:not(:disabled))`로 바꿔 호버 규칙의 명시도를 (0,2,0)으로 낮추고, 같은 명시도에서 뒤에 선언된 활성 규칙이 적용되게 했다.

#### GitHub 링크 색 변경

계산된 스타일 비교에서 발견했다. 저장소 이름과 블로그 주소가 파란색(`rgb(9, 105, 218)`)에서 기본 글자색으로 바뀌었다. GitHub 캡처 장면에서는 이 링크들이 창 아래로 넘어가 거의 보이지 않아서, 스크린샷 비교로는 검출되지 않았다.

```css
.gh a {
	color: var(--gh-link);
} /* (0,1,1) */
.gh-tab {
	color: var(--gh-text) !important;
} /* (0,1,0): 탭도 a라서 !important로 이겼다 */
```

`!important`를 삭제하면 `.gh-tab`(0,1,0)이 `.gh a`(0,1,1)에 지므로, 이 규칙의 우선순위를 낮춰야 했다. 처음에는 `.gh a`를 메모처럼 `reset` 레이어로 내렸다. 그런데 레이어 밖의 전역 규칙 `a { color: inherit }`(index.css)보다 우선순위가 낮아졌다. ==레이어 밖의 규칙은 명시도가 아무리 낮아도 레이어 안의 규칙보다 우선한다.== 그래서 전역 `a`와 `*` 규칙도 `reset` 레이어로 옮겼다. 그러자 `.gh a`는 레이어 안에서 전역 `a`보다 우선하고, 레이어 밖의 `.gh-tab`보다는 낮아졌다. 원래 의도대로다.

음악의 곡 목록도 비슷했다. 홀수 행 배경(`li:nth-child(odd) .music-track`, (0,3,1))이 호버 배경(`.music-track:hover`, (0,2,0))보다 우선하고 있었다. 홀수 행 쪽을 `:where(:nth-child(odd))`로 감쌌다.

#### 한 번도 적용되지 않은 고정 버튼 규칙

메모 고정 버튼에는 다음 규칙이 있었다.

```css
/* 고정 버튼: 고정되어 있으면 강조 색 */
.memo-pin.on {
	color: var(--memo-accent) !important;
}
```

그런데 계산된 값은 강조 색이 아니라 기본 글자색이었다. 파일 뒤쪽의 `.memo-tool.on { color: var(--memo-text) !important; }`과 명시도가 같아서, 뒤에 선언된 규칙이 적용됐다. `!important`끼리 경쟁하면 다시 명시도와 선언 순서로 결정된다. ==이 규칙은 처음부터 한 번도 적용되지 않았다.== 현재 표시되는 모습을 유지하기 위해 삭제했다.

## IconButton: 아이콘 버튼 4종 통합

### 앱마다 있던 아이콘 버튼

`!important`가 사라지자 공통 컴포넌트를 만들 수 있게 되었다. 도구 막대의 아이콘 버튼은 메모(`.memo-tool`), Safari(`.safari-tool`), 메일·메시지(`.mail-round-button`, `.messages-round-button`)에 각각 있었다. 크기와 모서리는 같고 색만 달랐다.

```tsx
<IconButton label="메모 삭제" icon="fa-regular fa-trash-can" onClick={remove} />
<IconButton label="서식" on={formatOpen} aria-expanded={formatOpen}>가가</IconButton>
<IconButton variant="float" label="새로운 메시지" icon="fa-regular fa-pen-to-square" />
```

- `label`은 `aria-label`이 되고, `title`을 별도로 지정하지 않으면 호버 시 표시되는 툴팁도 된다. 그래서 Safari의 이전·다음 탭 버튼에도 툴팁이 생겼다
- `on`은 활성 스타일만 적용한다. `aria-pressed`(토글)인지 `aria-expanded`(패널 열림)인지는 사용하는 곳에서 지정한다
- 색은 앱이 결정한다. 버튼 CSS는 `--ui-tool-color` 같은 변수만 참조한다

### 색 지정 방식: CSS 변수

| 방법                                       | 장점                       | 단점                                                       |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------- |
| `color`·`hoverColor` 같은 props            | 타입이 값을 검사한다       | 다크 모드·활성 상태마다 props가 늘고, 색이 JS로 전달된다   |
| 앱마다 클래스로 덮어쓰기(`.memo .ui-tool`) | 익숙한 방식이다            | 명시도 경쟁이 다시 시작되고, `!important`가 재발할 수 있다 |
| 앱 루트에 CSS 변수(`--ui-tool-*`) (채택)   | 다크 모드는 앱 변수가 처리 | 변수 이름을 문서로 안내해야 한다                           |

**CSS 변수**(사용자 지정 속성, `--이름: 값`)는 다른 CSS 속성처럼 부모 요소에서 자식 요소로 상속된다. 앱 창의 최상위 요소에 `--ui-tool-color`를 정의하면 창 안의 모든 버튼이 `var(--ui-tool-color)`로 그 값을 읽는다. 앱의 색은 이미 `--memo-muted`처럼 앱 변수로 정의되어 있고 다크 모드도 그 변수가 전환한다. 버튼은 그 변수를 한 번 더 참조하기만 하면 되므로 CSS 변수 방식을 선택했다. 활성 배경은 [`color-mix()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix)로 강조색에 투명도를 섞는다.

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

> [!WARNING] 레이어 밖에 남은 `*` 규칙
> 여기서 문제가 한 번 더 발생했다. 처음 실행했을 때 공통 버튼의 여백(`padding: 0 7px`)이 0이 되었다. index.css 맨 위의 `* { margin: 0; padding: 0 }`이 레이어 밖에 있었기 때문이다. 명시도가 (0,0,0)인 `*`도 레이어 밖이면 레이어 안의 모든 규칙보다 우선한다. 그래서 앞서 언급한 `a`와 함께 이 `*`도 `reset` 레이어로 옮겼다. 이동 후 계산된 스타일과 스크린샷을 다시 비교했고, 이 이동만으로 바뀐 것은 없었다.

### 3단계 결과

| 항목          | 전        | 후                                                                                                                                                                                |
| ------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `!important`  | 66개      | 0개 (동작 줄이기의 2개만 유지)                                                                                                                                                    |
| 아이콘 버튼   | 4가지 CSS | `IconButton` 하나 (메모 16개, Safari 4개, 메일 1개, 메시지 3개)                                                                                                                   |
| 스크린샷 58장 |           | 모두 0.001% 이하 (시계 고정 후 남는 노이즈 수준)                                                                                                                                  |
| 계산된 스타일 |           | 메시지 새 피드백 버튼의 `z-index`(공통 버튼은 창 드래그 영역 위에 오도록 `z-index: 4`)와, 같은 상자 크기의 다른 표기(Safari 버튼 `width: 30px` → `min-width: 30px` + 여백)만 변경 |

변경된 파일은 24개, 483줄 추가와 335줄 삭제였다.

## Button: 텍스트 버튼 6종 통합

### 여섯 곳의 같은 모양

처음 계획에는 4단계에서 텍스트 버튼(`Button`) 외에도 목록 행(`ListRow`), 분할 버튼(`SegmentedControl`), 검색 칸(`SearchField`), 토글 스위치(`Switch`), 빈 상태 안내(`EmptyState`)를 만드는 것이 있었다. 결론적으로 `Button`만 만들었다.

'취소'와 '보내기'처럼 텍스트가 있는 버튼이 여섯 곳에서 각각 정의되어 있었다.

| 위치               | 클래스                            | 모양        | 강조 버튼   | 삭제 버튼     |
| ------------------ | --------------------------------- | ----------- | ----------- | ------------- |
| 메일 쓰기          | `.mail-button`                    | 둥근 사각형 | `primary`   |               |
| 메시지 삭제 확인   | `.messages-delete-actions button` | 둥근 사각형 |             | `destructive` |
| 메모 댓글          | `.memo-comment-button`            | 알약        | `primary`   | `danger`      |
| 설정의 관리자 계정 | `.admin-account-button`           | 둥근 사각형 | `primary`   |               |
| 로그인 결과        | `.login-flow-button`              | 둥근 사각형 | (항상 강조) |               |
| 메모 이미지 창     | `.memo-image-submit`              | 알약        | (항상 강조) |               |

모양은 거의 같았다.

| 속성      | 공통 값          |
| --------- | ---------------- |
| 여백      | `5px 14px` 안팎  |
| 모서리    | 8px 또는 알약    |
| 강조 버튼 | 앱의 강조색 배경 |
| 삭제 버튼 | 빨간 배경        |
| 비활성    | 흐리게 표시      |

다른 것은 색과 이름뿐이었다. 같은 의미를 `danger`와 `destructive` 두 이름으로 쓰고 있기도 했다. 통합 작업은 이름을 하나로 맞추는 작업이기도 하다.

![여러 앱의 글자 버튼](./images/shared-text-button.jpg '모두 Button 하나다. 색과 모양은 앱이 정한 변수를 따른다')

```tsx
<Button onClick={onCancel}>취소</Button>
<Button tone="primary" type="submit" disabled={sending}>보내기</Button>
<Button tone="danger" type="submit">삭제</Button>
```

`IconButton`과 같은 방식이다. 버튼 CSS는 `components` 레이어에 두고, 색과 모양은 CSS 변수로 받는다.

```css
/* 메모: 알약 모양, 노란 강조 */
[data-app='memo'] {
	--ui-button-radius: 999px;
	--ui-button-bg: var(--memo-search-bg);
	--ui-accent: var(--memo-accent);
	--ui-on-accent: #2b2100;
}

/* 메시지 삭제 확인: 여백만 조금 좁게 */
.messages-delete-actions {
	--ui-button-padding: 4px 14px;
}
```

메일 버튼의 그림자나 관리자 계정 버튼의 테두리처럼 그 앱에만 있는 스타일은 앱의 CSS에 추가했다. 앱의 CSS는 레이어 밖이라 명시도와 관계없이 우선한다.

### 포털 팝오버의 CSS 변수 상속

메모의 서식·이미지 창은 2단계에서 만든 팝오버라 `body`에 렌더링한다([포털](https://react.dev/reference/react-dom/createPortal)). React 컴포넌트 트리에서는 메모 창의 자식이지만, 실제 DOM에서는 메모 창 밖에 있다. CSS 변수는 DOM 트리를 따라 상속되므로 메모 창(`[data-app='memo']`)에 정의한 변수가 상속되지 않는다. 변수 없이 렌더링하면 '넣기' 버튼이 기본 강조색인 파란색이 된다.

![메모 창 안의 버튼은 변수를 상속해 노란색이고, body에 렌더링한 이미지 창의 버튼은 변수가 없어 파란색이 되는 구조와 수정](./images/shared-button-portal-vars.svg '이미지 창은 DOM에서 body의 직접 자식이라 메모 창의 --ui-accent를 받지 못한다. 패널 최상위 요소에 변수를 다시 정의해 해결했다')

기존 CSS는 노란색(`#edbb4d`)을 직접 지정해 이 문제를 해결하고 있었다. 같은 방식으로, 이미지 창의 최상위 요소에 변수를 다시 정의했다.

```css
.memo-format-panel {
	--ui-button-radius: 999px;
	--ui-accent: #edbb4d;
	--ui-on-accent: #2b2100;
}
```

이미지 창 안에는 다음 규칙도 있었다.

```css
.memo-format-panel button {
	border: none;
	background: none;
	color: inherit;
}
```

팝오버 안의 버튼들이 공통으로 쓰는 기본값이다. 1단계에서 `reset` 레이어로 옮긴 `.memo button`과 같은 종류인데, 그 시각에는 누락했다. 레이어 밖에 그대로 두면 `background: none`이 `components` 레이어의 강조색보다 우선한다. 이 규칙도 `reset` 레이어로 옮겼다.

### 4단계 확인

3단계와 같은 두 가지 방법으로 확인했다.

- **계산된 스타일**: 메일 쓰기, 메시지 삭제 확인, 댓글 작성·삭제, 관리자 계정, 이미지 창을 열고 버튼마다 `getComputedStyle` 결과를 기록해 `main`과 비교했다. 호버 상태도 기록했다. 차이는 `display`가 `block`에서 `flex`로 바뀐 것(버튼이 `inline-flex`가 되었다)과 0.016px의 소수점 차이 하나뿐이었다. 폭, 높이, 색, 여백은 모두 같았다
- **스크린샷**: 58장 모두 0.001% 이하

이 PR은 16개 파일(258줄 추가, 133줄 삭제)을 변경했다.

## 만들지 않은 공통 컴포넌트 다섯 개

계획에 있던 나머지 다섯 가지도 현재 코드를 조사했다.

> [!IMPORTANT] 공통 컴포넌트를 만드는 기준
> 공통 컴포넌트는 사용처가 여러 곳이고 모양과 동작이 같을 때 효과가 있다. 사용처가 한두 곳뿐이거나 서로 다르면, 오히려 그 차이를 모두 수용하는 옵션이 생긴다.

| 후보               | 사용처                                    | 결정                                                                                                          |
| ------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Switch`           | 설정의 클릭 소리 하나                     | 만들지 않음. 사용처가 하나다                                                                                  |
| `EmptyState`       | 메모·메일·메시지의 "메모 없음" 같은 한 줄 | 만들지 않음. 텍스트 한 줄(`<p>`, `<li>`)이라 컴포넌트로 감쌀 구조가 없다                                      |
| `SearchField`      | 메모, 메시지                              | 만들지 않음. 메모는 검색 조건 칩, 조건 메뉴, 확장 애니메이션이 있고, 메시지는 입력 칸 하나다                  |
| `SegmentedControl` | 메모 보기 방식, 이미지 창의 가져올 위치   | 만들지 않음. 하나는 토글 상태(`aria-pressed`) 버튼 두 개, 하나는 탭(`role="tab"`)과 탭 패널이라 의미가 다르다 |
| `ListRow`          | 메모 글, 메일, 메시지 대화, 음악 곡       | 만들지 않음. 행마다 들어가는 내용(날짜·폴더, 보낸 사람, 곡 번호·앨범)과 배치가 모두 다르다                    |

`SegmentedControl`은 외형(회색 배경 위의 흰 알약)이 같아서 검토가 필요했다. 하지만 스크린 리더 기준으로 하나는 "토글 버튼 두 개"([`aria-pressed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed))이고, 하나는 "탭 목록"([`role="tab"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tab_role))이다. ==모양을 통합하려고 의미까지 하나로 맞추면 접근성이 나빠진다.== 세 번째 사용처가 생기면 다시 검토한다.

## 네 단계 요약

| 단계 | 작업                                                 | 감소한 것                                      |
| ---- | ---------------------------------------------------- | ---------------------------------------------- |
| 1    | 앱 루트의 기본값을 `reset` 레이어로                  | `!important`가 필요한 원인                     |
| 2    | 메뉴·팝오버: `Menu`, `useDismiss`, `placement`       | 닫기·위치 보정 구현 5곳 → 공통 모듈            |
| 3    | `!important` 정리, `IconButton`, `components` 레이어 | `!important` 66개 → 0개, 아이콘 버튼 4종 → 1종 |
| 4    | `Button`                                             | 텍스트 버튼 6종 → 1종                          |

단계마다 스크린샷 58장을 전후로 비교했고, 3단계부터는 계산된 스타일도 비교했다. 화면이 바뀐 것은 1·2단계뿐이다. 1단계는 앱 기본값에 가려져 있던 값이 적용된 곳들이고, 2단계는 Apple 메뉴와 메모 메뉴의 모양이 통일된 것이다. 3·4단계는 화면이 그대로였다.

## 이후 변경

열흘 뒤 리팩터링 4단계를 시작하며 같은 후보를 다시 집계했다([공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-modal#공통-부품-집계)). 그사이 Finder, 사진·음악의 휴대폰 화면, 메일 휴대폰 시트가 생겨 사용처 수가 바뀌었다. 기준은 같았지만 결과 하나가 달라졌다.

![10월 1일과 10월 11일의 판단 비교](./images/shared-text-button-revisit.svg '같은 기준, 다른 수')

- `SearchField`는 `type="search"`가 여섯 곳으로 늘었고, 메모를 제외한 다섯 곳이 같은 모양이라 컴포넌트로 추출했다([#223](https://github.com/hyeoniverse/MacFolio/pull/223)). `ListRow`와 `SegmentedControl` 등 나머지는 여전히 보류다.
- `Button`은 글을 쓴 시각에 앱 쪽 25개 파일이 사용했다. 직접 작성한 텍스트 버튼 30곳도 이후 이 컴포넌트로 교체했다([계산된 스타일 비교와 명시도 0인 :where() 규칙으로 버튼 75곳을 IconButton·Button으로 옮기기](/memo/icon-button-migrate)). 이 작업에서도 상태별 계산된 스타일 비교를 그대로 사용했다.
- 이 글을 쓴 시각에 CSS의 `!important`는 23개였다. 동작 줄이기(`motion.css`)와 레이어 설정, 그리고 이후 추가한 Safari 프로젝트 페이지(다른 사이트 디자인을 재현하는 곳)에 있다. 앱 화면에는 다시 생기지 않았다.

## 정리

- `!important`는 다른 규칙의 명시도 문제를 가린다. 삭제하면 가려져 있던 버그(활성 버튼 호버, 한 번도 적용되지 않던 고정 버튼 규칙)가 드러난다.
- 스크린샷 비교는 캡처 시점만 확인한다. 상태(호버, 활성)가 많은 곳은 계산된 스타일을 상태별로 기록해 비교해야 한다.
- 레이어 밖의 규칙은 명시도와 관계없이 레이어 안의 규칙보다 우선한다. `*`나 `a` 같은 전역 규칙도 레이어 안에 넣어야 레이어 순서가 의도대로 동작한다([CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기](/memo/css-layer-order-fix)).
- `body`에 렌더링하는 포털은 앱 루트의 CSS 변수를 상속하지 못한다. 변수로 테마를 지정하는 구조에서는 포털의 최상위 요소에 변수를 다시 정의해야 한다.
- 공통 컴포넌트는 "같은 모양, 같은 의미, 여러 사용처" 세 조건이 맞을 때 만든다. 하나라도 빠지면 옵션만 늘어난다. "만들지 않음"은 그 시각의 사용처 수로 결정한 것이라, 화면이 늘면 다시 집계한다. 결정과 함께 이유를 기록해 두면 재검토가 빠르다.

## 관련 글

- [CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset): 1단계
- [placement·useDismiss·Menu 세 모듈로 중복된 메뉴 구현 합치기](/memo/shared-menu): 2단계
- [CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기](/memo/css-layer-order-fix)
- [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](/memo/ui-modal#공통-부품-집계): 열흘 뒤 다시 집계한 후보
- [계산된 스타일 비교와 명시도 0인 :where() 규칙으로 버튼 75곳을 IconButton·Button으로 옮기기](/memo/icon-button-migrate)

PR: [#60](https://github.com/hyeoniverse/MacFolio/pull/60), [#61](https://github.com/hyeoniverse/MacFolio/pull/61)

<details>
<summary>참고 문헌</summary>

- [MDN: Introducing the CSS Cascade](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Introduction)
- [MDN: Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascade/Specificity)
- [MDN: @layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [MDN: !important](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/important)
- [MDN: :where()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:where)
- [MDN: Window.getComputedStyle()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)
- [MDN: Using CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- [W3C: CSS Cascading and Inheritance Level 5](https://www.w3.org/TR/css-cascade-5/)

</details>

#MacFolio #CSS #공통컴포넌트
