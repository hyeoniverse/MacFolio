---
title: 컨테이너 쿼리 좁은 창에서 flex: none으로 신호등 버튼 영역 확보하기
date: 2026-10-02
category: 개발 기록/MacFolio/화면·스타일
summary: 음악 창을 좁히면 휴대폰 화면으로 바뀌며 보관함 제목이 신호등 버튼에 가려지고 곡 목록에서 돌아갈 방법이 없었다. Safari는 여백 요소가 축소되어 뒤로·앞으로 버튼이 신호등 아래로 들어갔다. 상단에 44px 여백과 flex: none을 지정하고, 앱 9개를 창 폭 5가지로 검사하는 시험을 추가했다.
---

| 증상                                                               | 원인                                                                                              | 해결                                                                       | 영향 범위                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| 좁은 창에서 제목·뒤로 가기 버튼이 신호등 버튼에 가려지고 클릭 불가 | 좁은 창이 휴대폰 화면을 그대로 사용하는데, 신호등 자리를 비우지 않았다. Safari는 여백 요소가 축소 | 음악은 상단 여백 44px와 `‹ 보관함` 버튼, Safari는 여백 요소에 `flex: none` | 데스크톱의 음악(560px 이하), Safari(380px 이하) |

## 배경

### 신호등 버튼

macOS 창의 왼쪽 위에는 빨강·노랑·초록 원 세 개가 나란히 있다. 순서대로 창 닫기, 최소화, 확대 버튼이고, 신호등과 색 배열이 같아 흔히 신호등 버튼(traffic lights)이라 부른다. MacFolio의 데스크톱 창도 같은 버튼을 창 왼쪽 위에 그린다. 이 버튼은 별도의 제목 막대 안에 있지 않고 ==앱 화면 위에 겹쳐서 그려진다==. 그래서 앱은 왼쪽 위 일정 구간에 클릭할 요소를 두지 않아야 한다.

### 컨테이너 쿼리

[미디어 쿼리](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries)는 브라우저 화면(뷰포트) 전체의 크기에 따라 스타일을 바꾼다. 데스크톱 화면 안에서 창 크기만 바뀌는 MacFolio에서는 뷰포트 크기가 그대로이므로 미디어 쿼리로는 창이 좁아진 것을 알 수 없다. [컨테이너 쿼리](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)는 뷰포트 대신 특정 요소(컨테이너)의 크기를 조건으로 삼는다. 창 요소에 `container-type: inline-size`를 지정하면, 그 안의 CSS가 `@container (max-width: 640px)`처럼 창 폭을 기준으로 분기할 수 있다.

MacFolio의 앱들은 창 폭이 640px 아래로 내려가면 이 컨테이너 쿼리로 휴대폰과 같은 화면을 사용한다. 예를 들어 음악 앱은 넓은 창에서는 왼쪽 보관함과 오른쪽 곡 목록을 나란히 보이고, 좁은 창에서는 휴대폰처럼 보관함 화면과 곡 목록 화면을 한 번에 하나씩 보인다.

### 휴대폰 화면과 좁은 데스크톱 창의 차이

휴대폰 화면을 그대로 가져오면 화면 위쪽에서 차이가 생긴다. 휴대폰에서는 셸(앱 바깥의 공통 화면 틀)이 상태 표시줄과 뒤로 가기 버튼을 그리고, 앱 화면은 그 아래에서 시작한다. 좁은 데스크톱 창에는 셸의 제목 막대가 없고, 신호등 버튼이 앱 화면 왼쪽 위에 직접 겹친다.

![휴대폰과 좁은 데스크톱 창의 상단 구조 비교](./images/narrow-window-title-phone-vs-window.svg '휴대폰은 셸이 위쪽 공간과 뒤로 가기를 맡는다. 좁은 데스크톱 창은 신호등 버튼이 앱 위에 겹치므로 앱이 위쪽을 직접 비워야 한다')

음악 앱은 이 차이를 고려하지 않아서, 창을 좁히면 보관함 제목이 신호등 버튼에 가려졌다.

## 증상

데스크톱에서 창 오른쪽 아래 모서리를 드래그해 음악 창을 좁히면 재현된다.

| 앱     | 재현 폭    | 증상                                                                                    |
| ------ | ---------- | --------------------------------------------------------------------------------------- |
| 음악   | 560px 이하 | 보관함의 큰 제목이 신호등 버튼 아래에 가려짐. 곡 목록에서 보관함으로 돌아가는 버튼 없음 |
| Safari | 380px 이하 | 뒤로·앞으로 버튼이 신호등 아래로 들어가 클릭 불가                                       |

음악은 곡 목록으로 진입하면 창을 다시 넓히는 것 외에는 보관함으로 돌아올 방법이 없었다. Safari는 뒤로·앞으로 버튼이 그 위에 겹친 신호등 버튼에 가려져 누를 수 없었다.

![좁은 창 전후](./images/narrow-window-title.jpg '위: 전 / 아래: 후')

## 원인 추적

10월 3일 새벽, 음악 앱 창을 줄였다가 제목이 신호등 버튼에 가려진 것을 처음 발견했다. 같은 컨테이너 쿼리를 사용하는 다른 앱에도 같은 문제가 있을 수 있어 앱마다 창 폭을 줄여 확인했고, Safari에서도 같은 문제를 찾아 함께 수정했다.

| 앱                                       | 수정 전 결과                          |
| ---------------------------------------- | ------------------------------------- |
| 음악                                     | 560px 이하에서 실패                   |
| Safari                                   | 380px 이하에서 실패                   |
| 메일·메모·메시지·설정·GitHub·터미널·게임 | 이미 버튼 아래에 공간을 확보하고 있음 |

메일·메모·메시지는 이미 앱이 신호등 줄 높이만큼 상단 여백을 두고 있었다. 음악과 Safari만 적용되지 않은 상태였다.

## 원인

==좁은 창의 앱이 휴대폰 화면을 그대로 사용하는데, 휴대폰과 데스크톱 창은 상단 구조가 다르다.==

|           | 휴대폰                              | 좁은 데스크톱 창                                |
| --------- | ----------------------------------- | ----------------------------------------------- |
| 최상단    | 상태 표시줄, 그 아래 셸의 뒤로 가기 | 앱 내부 왼쪽 위에 신호등 버튼이 겹쳐 있다       |
| 상단 여백 | `--phone-top`                       | 앱이 지정한 값 (음악은 16px)                    |
| 뒤로 가기 | `MobileNavigation`이 렌더링         | `MobileNavigation`은 아무것도 렌더링하지 않는다 |

### 음악: 위쪽 여백이 휴대폰 셸을 전제로 했다

음악은 좁은 화면에서 사이드바(보관함)의 상단 여백을 0으로, 본문의 상단 여백을 16px로 지정했다. 휴대폰에서는 그 위에 셸이 상태 표시줄과 뒤로 가기 줄만큼 공간을 확보하므로 문제가 없었다. 데스크톱 창에서는 같은 위치에 신호등 버튼이 있었다.

### Safari: 여백 요소가 flex-shrink로 축소됐다

Safari는 원인이 달랐다. 이 원인을 이해하려면 flexbox의 크기 배분 방식을 알아야 한다.

![flex 컨테이너와 flex 항목, 주축과 교차축을 표시한 MDN 그림](./images/narrow-window-title-mdn-flex-terms.png '바깥 상자가 flex 컨테이너, 안의 상자가 flex 항목이다. 항목이 나란히 놓이는 가로 방향이 주축(main axis)이다. 출처: MDN')

flexbox는 부모 요소(flex 컨테이너)에 `display: flex`를 지정하면 자식 요소(flex 항목)들을 한 줄로 나란히 배치하는 CSS 레이아웃 방식이다. 컨테이너의 폭이 항목들의 폭 합계보다 작으면, 모자란 폭을 항목들이 나눠서 줄인다. 이때 각 항목이 얼마나 줄어들지는 [`flex-shrink`](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink) 값이 정한다. 기본값은 `1`이라, 따로 지정하지 않은 모든 항목이 줄어들 대상이 된다.

Safari 도구 막대는 flex 컨테이너이고, 맨 왼쪽에 신호등 공간으로 64px 여백 요소(`.safari-lights-space`)를, 그 오른쪽에 뒤로·앞으로 버튼과 주소 막대를 배치했다. 여백 요소에는 `flex-shrink`를 지정하지 않았으므로 기본값 `1`이 적용됐다. 그래서 ==공간이 부족하면 이 요소도 축소됐다.== 여백 요소가 64px보다 좁아지면 그 오른쪽의 뒤로 버튼이 왼쪽으로 밀려 신호등 버튼 구간에 들어간다.

![Safari 도구 막대의 flex-shrink 전후](./images/narrow-window-title-flex-shrink.svg '전: 여백 요소가 줄어 뒤로 버튼(‹)이 신호등 아래로 들어간다. 후: 여백 요소는 64px로 고정되고 주소 막대가 대신 줄어든다')

> [!IMPORTANT] 재사용한 화면의 외부 환경
> "휴대폰 화면을 그대로 사용한다"는 전제에는 "휴대폰 셸이 처리하던 역할"이 빠져 있었다. 화면을 재사용할 때는 그 화면이 의존하던 외부 환경(상단 여백, 뒤로 가기)까지 함께 검토해야 한다.

## 해결

세 가지 방법을 비교했다.

| 방법                                                                            | 단점                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 좁은 창에서는 신호등 버튼을 숨긴다                                              | 창을 닫거나 최소화할 방법이 없어진다. macOS도 신호등은 항상 표시된다 |
| 좁은 창도 휴대폰처럼 셸이 제목 막대를 렌더링                                    | 데스크톱 창 전체 구조를 바꿔야 한다                                  |
| **앱이 신호등 줄 높이만큼 상단 여백을 두고, 뒤로 가기 버튼을 직접 배치 (선택)** | 앱마다 적용해야 한다. 그래서 모든 앱을 시험으로 검사한다             |

메일·메모·메시지가 이미 사용하던 세 번째 방식을 음악과 Safari에 적용했다([#77](https://github.com/hyeoniverse/MacFolio/pull/77)).

### 음악

좁은 창의 보관함과 곡 목록 상단에 신호등 버튼 줄 높이(44px)만큼 여백을 두었다. 휴대폰은 기존 `--phone-top`이 이 값을 덮어쓰므로 변하지 않는다.

```css
@container (max-width: 640px) {
	/* 위쪽은 신호등 버튼 줄 높이만큼 비운다. 휴대폰은 --phone-top으로 덮어쓴다 */
	.music-sidebar {
		padding: 44px 16px 16px; /* 전: 0 16px 16px */
	}
	.music-main {
		padding: 44px 16px 24px; /* 전: 16px 16px 24px */
	}
	.music-back {
		display: flex;
	}
}
```

`padding`에 값 세 개를 쓰면 순서대로 위, 좌우, 아래 여백이다. 따라서 위 코드는 보관함의 위 여백을 0에서 44px로, 곡 목록의 위 여백을 16px에서 44px로 바꾸고 좌우·아래 여백은 그대로 둔다.

곡 목록에는 뒤로 가기 버튼이 없었다. 휴대폰에서는 제목 막대의 뒤로 가기(`MobileNavigation`)가 이 역할을 하는데, 이 컴포넌트는 데스크톱에서 아무것도 렌더링하지 않는다. 그래서 좁은 데스크톱 창에서는 곡 목록으로 진입하면 보관함으로 돌아올 수 없었다. 메일의 받은 편지함 버튼처럼 곡 목록 위에 `‹ 보관함` 버튼(`.music-back`)을 배치하고, 넓은 창과 휴대폰에서는 숨긴다.

| 화면             | `‹ 보관함` 버튼 | 보관함으로 돌아가는 방법                      |
| ---------------- | --------------- | --------------------------------------------- |
| 넓은 데스크톱 창 | 숨김            | 보관함이 왼쪽에 항상 보인다                   |
| 좁은 데스크톱 창 | 표시            | `‹ 보관함` 버튼                               |
| 휴대폰           | 숨김            | 셸 제목 막대의 뒤로 가기 (`MobileNavigation`) |

### Safari

여백 요소에 `flex: none`을 지정하고, 대신 주소 막대가 축소되도록 `min-width: 0`을 지정했다. `flex: none`은 `flex-grow: 0`, `flex-shrink: 0`, `flex-basis: auto`를 한 번에 지정하는 단축 표기다. 늘어나지도 줄어들지도 않고 `width`에 지정한 64px을 유지한다.

```css
.safari-lights-space {
	flex: none; /* 줄어들면 뒤로·앞으로 버튼이 신호등 아래로 들어간다 */
	width: 64px;
}
.safari-address {
	min-width: 0; /* 대신 주소 막대가 줄어든다 */
	max-width: 520px;
}
```

> [!WARNING] 고정 요소 옆 flex 항목의 min-width
> `min-width: 0`이 필요한 이유는 flex 항목의 기본 최소 너비가 `auto`(콘텐츠의 최소 너비)이기 때문이다[^min-width-auto]. 여백 요소만 고정하면 주소 막대도 축소되지 않아 도구 막대가 창 밖으로 넘친다.

| 요소                   | 수정 전                   | 수정 후                    |
| ---------------------- | ------------------------- | -------------------------- |
| `.safari-lights-space` | `flex-shrink: 1` (축소됨) | `flex: none` (64px 고정)   |
| `.safari-address`      | `min-width: auto`         | `min-width: 0` (대신 축소) |

## 확인

음악은 `e2e/music.spec.ts`의 "좁은 창에서는 제목이 신호등 버튼 아래에 있고, 곡 목록에서 보관함으로 돌아온다"로 뒤로 가기 버튼까지 확인한다. 아래의 앱 전체 검사에서 수정 전에는 음악(560px 이하)과 Safari(380px 이하)만 실패했다.

## 재발 방지

![신호등과 겹치는지 보는 시험](./images/narrow-window-title-check.svg '표시된 버튼·링크·입력·제목·탭의 상자가 신호등 상자와 겹치면 실패')

같은 문제가 다른 앱에도 있는지 E2E 시험(`e2e/narrow-window.spec.ts`)으로 검사했다. E2E(end-to-end) 시험은 실제 브라우저를 띄워 사용자처럼 화면을 조작하고 결과를 확인하는 시험이다. 이 시험은 앱마다 창 폭을 700, 560, 460, 380, 320px로 바꾸고, 표시된 버튼·링크·입력·제목·탭 중 신호등 버튼과 겹치는 요소가 있는지 확인한다. 앱 9개(음악·메시지·메일·메모·설정·GitHub·Safari·터미널·게임) × 폭 5가지로 45회 검사한다.

겹침 판정은 두 요소의 화면상 사각형을 [`getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)로 얻어 비교한다. 두 사각형은 가로 구간과 세로 구간이 ==둘 다 겹칠 때만== 겹친다.

| 예시 (신호등 상자 left 8, right 72, top 8, bottom 28) | 가로 구간 겹침 | 세로 구간 겹침 | 판정 |
| ----------------------------------------------------- | -------------- | -------------- | ---- |
| 제목 left 16, right 120, top 12, bottom 36            | 겹침           | 겹침           | 실패 |
| 제목 left 16, right 120, top 44, bottom 68            | 겹침           | 겹치지 않음    | 통과 |
| 버튼 left 80, right 104, top 8, bottom 28             | 겹치지 않음    | 겹침           | 통과 |

```ts
const covered = await win.evaluate((frame) => {
	const lights = frame.querySelector('.traffic-lights')!.getBoundingClientRect();
	return [...frame.querySelectorAll<HTMLElement>('button, a, input, h1, h2, h3, [role="tab"]')]
		.filter((el) => !el.closest('.traffic-lights'))
		.filter((el) => {
			const box = el.getBoundingClientRect();
			// 보이지 않는 것은 빼고, 두 상자가 가로·세로 모두 겹치면
			return box.right > lights.left && box.left < lights.right && box.bottom > lights.top && box.top < lights.bottom;
		})
		.map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 20));
});
expect(covered, `${width}px`).toEqual([]);
```

폭을 바꾼 뒤에는 [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)을 한 번 대기한다. 컨테이너 쿼리는 스타일 재계산 후에 적용되기 때문이다. 실패하면 겹친 요소의 텍스트와 창 폭이 실패 메시지에 출력된다. 예를 들어 수정 전 음악 앱이라면 `560px` 메시지와 함께 `['보관함']` 같은 목록이 나오므로 수정할 위치를 바로 알 수 있다.

> [!TIP] 한 앱의 버그를 모든 앱의 시험으로
> 특정 앱에서 발견한 버그를 모든 앱을 검사하는 시험으로 일반화하면, 새 앱을 추가할 때도 같은 실수를 검출한다. 이 시험은 앱 이름 목록에 항목 하나만 추가하면 된다.

이후 앱마다 최소 창 크기(`minSize`)를 지정했다. 예를 들어 시스템 설정은 사이드바가 항상 표시되는 680×420보다 작게 줄어들지 않는다. 지나치게 좁은 창을 막는 것도 같은 문제를 줄이는 방법이다.

## 남은 것

- 이 시험은 상자가 겹치는지만 확인한다. 겹치지 않지만 버튼과 간격 없이 붙은 경우는 검출하지 못한다.

## 관련 글

- [셸 공통 CSS 사용자 정의 속성으로 휴대폰 앱의 바탕·카드 색 통일하기](/memo/mobile-apps-ios-style)
- [isRunning 정의와 React key·ref 함수 동일성이 일으킨 음악 앱 버그](/memo/music-player-fixes)
- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)

[^min-width-auto]: flex 항목은 `min-width`의 기본값 `auto`가 콘텐츠의 최소 크기(줄바꿈할 수 없는 가장 긴 단어나 입력창의 기본 폭)로 계산된다. 그래서 `flex-shrink`가 있어도 그 크기보다 작아지지 않는다. [MDN: min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)

<details>
<summary>참고 문헌</summary>

- [MDN: CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- [MDN: Using media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries)
- [MDN: Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- [MDN: flex-shrink](https://developer.mozilla.org/en-US/docs/Web/CSS/flex-shrink)
- [MDN: flex](https://developer.mozilla.org/en-US/docs/Web/CSS/flex)
- [MDN: min-width](https://developer.mozilla.org/en-US/docs/Web/CSS/min-width)
- [MDN: Element.getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect)
- [MDN: Window.requestAnimationFrame()](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

</details>

<details>
<summary>사진 출처</summary>

- flex 컨테이너·항목과 주축·교차축 그림: MDN Web Docs, [Flexbox](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox) (그림 원본 [flex_terms.png](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Flexbox/flex_terms.png)), CC BY-SA 2.5

</details>

#MacFolio #데스크톱 #CSS #트러블슈팅
