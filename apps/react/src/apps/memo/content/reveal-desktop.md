---
title: CSS translate와 pointer-events로 레이아웃을 건드리지 않고 창 밀어내기
date: 2026-10-22
category: 개발 기록/MacFolio/인터랙션·브라우저 API
summary: macOS Sonoma의 '배경화면을 클릭하여 데스크탑 보기'를 옮겼다. 창 store에 desktopRevealed 상태를 추가하고, 창은 left·top 대신 CSS translate로 밀어 열기·닫기 애니메이션과 끌기 계산에서 분리했다. 바탕화면 아이콘을 끌어 고르는 동작과는 이동 거리로 구분한다.
---

macOS Sonoma에는 "배경화면을 클릭하여 데스크탑 보기" 설정이 있다. 바탕화면의 빈 곳을 누르면 떠 있는 창이 화면 가장자리로 밀려나 위젯과 바탕화면 아이콘이 드러나고, 다시 누르면 창이 돌아온다. MacFolio에서는 첫 화면에 Safari 창이 열려 있어 바탕화면의 위젯 일부가 가려진다. 창을 하나씩 최소화하지 않고 바탕화면을 확인할 수 있게 이 동작을 옮겼다([#326](https://github.com/hyeoniverse/MacFolio/pull/326)).

![Safari 창이 위젯 위에, 터미널 창이 화면 오른쪽에 떠 있는 1440×900 바탕화면](./images/reveal-desktop-before.jpg '누르기 전. Safari 창이 날씨·달력·음악 위젯을 가린다')

![Safari 창은 왼쪽 가장자리에, 터미널 창은 오른쪽 가장자리에 40px씩만 남고 위젯과 바탕화면 아이콘이 드러난 화면](./images/reveal-desktop-after.jpg '바탕화면 빈 곳을 누른 뒤. 가까운 가장자리로 밀려나 40px만 남는다. 메뉴 막대는 Finder')

## 배경

2023년 9월에 출시된 macOS Sonoma(macOS 14)는 위젯을 알림 센터에서 꺼내 바탕화면에 직접 놓을 수 있게 했다. 바탕화면 위젯은 창 뒤에 있으므로, 창이 열려 있으면 위젯이 가려진다. 그래서 Sonoma는 바탕화면(배경화면)의 빈 곳을 누르면 모든 창을 화면 밖으로 밀어 내는 동작을 함께 추가했다. 시스템 설정 › 데스크탑 및 Dock › 데스크탑 보기에서 '배경화면 클릭 시 항상'과 '클릭 시 스테이지 매니저에서만' 가운데 하나를 고른다.

![macOS Sonoma를 실행한 MacBook Pro. 바탕화면에 사진, 날씨, 세계 시계, 캘린더, 메모, 미리 알림, 단축어 위젯이 놓여 있다](./images/reveal-desktop-apple-sonoma-widgets.jpg 'macOS Sonoma의 바탕화면 위젯(Apple Newsroom). 창을 밀어 내면 이 위젯들이 드러난다')

MacFolio의 바탕화면에도 날씨, 달력, 음악 위젯이 있고([180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets)), 첫 화면의 Safari 창이 이 위젯을 가린다. 이 동작을 웹 페이지로 옮기는 데 세 가지 CSS·DOM 기능을 썼다.

| 기능                                                                                     | 뜻                                                                                                         | 이 글에서의 쓰임                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [`translate`](https://developer.mozilla.org/en-US/docs/Web/CSS/translate) 속성           | 요소를 레이아웃 자리는 그대로 둔 채 화면에서만 옮겨 그린다                                                 | 창을 화면 가장자리로 민다               |
| [`pointer-events`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events) 속성 | 요소가 클릭·터치 같은 포인터 이벤트의 대상이 될지 정한다. `none`이면 그 요소를 건너뛰고 뒤의 요소가 받는다 | 밀려난 창의 버튼이 눌리지 않게 한다     |
| 이동 거리 판정                                                                           | `pointerdown`과 `pointerup` 사이에 움직인 거리로 누르기와 끌기를 구분한다                                  | 바탕화면 누르기와 아이콘 밴드 선택 구분 |

## 동작 규칙

| 입력                           | 결과                                  |
| ------------------------------ | ------------------------------------- |
| 바탕화면 빈 곳 누르기          | 떠 있는 창을 모두 가장자리로          |
| 다시 바탕화면 빈 곳 누르기     | 모든 창이 원래 자리로                 |
| 밀려난 창의 남은 40px 누르기   | 모든 창이 돌아오고 그 창이 맨 앞      |
| Dock·Launchpad·바탕화면 아이콘 | 모든 창이 돌아오고 연 앱이 맨 앞      |
| 바탕화면을 끌어 아이콘 고르기  | 변화 없음 (⌘·⇧를 누른 채 누르기 포함) |
| 떠 있는 창이 없음              | 변화 없음                             |

> [!NOTE] 휴대폰 화면
> 휴대폰 화면은 바뀌지 않는다. 휴대폰의 앱은 화면 전체를 채우는 하나의 창이라 밀어 낼 대상이 없다.

## 상태: desktop-core 창 store의 desktopRevealed

창 상태는 프레임워크와 무관한 `packages/desktop-core`의 창 store가 관리한다([창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore)). store는 상태 객체 하나와 그 상태를 바꾸는 함수를 묶은 모듈이고, 상태가 바뀌면 구독한 화면(React 컴포넌트)에 알린다. 여기에 `desktopRevealed` 하나를 추가했다.

```ts
export interface WindowState<Name extends string> {
	apps: AppWindows<Name>;
	/** 창 밖(바탕화면·메뉴 막대·Dock)을 눌렀는지. 창을 누르거나 앱을 열면 다시 false */
	desktopFocused: boolean;
	/** 바탕화면을 눌러 창을 모두 화면 가장자리로 치웠는지 */
	desktopRevealed: boolean;
	// …
}
```

"돌아오는 조건"은 별도 코드를 작성하지 않고 기존 상태에 연결했다. 창 store의 `update`는 창을 맨 앞으로 가져오는 `bringToFront`와 앱을 여는 `open`에서 `desktopFocused`를 `false`로 바꾼다. 같은 시각에 `desktopRevealed`도 `false`로 바꾸면, ==창 누르기·Dock·Launchpad·바탕화면 아이콘으로 앱 열기가 모두 같은 경로를 탄다==.

```ts
const update = (change, desktopFocused?: boolean) =>
	store.setState((state) => ({
		...state,
		apps: change(state.apps),
		desktopFocused: desktopFocused ?? state.desktopFocused,
		desktopRevealed: desktopFocused === false ? false : state.desktopRevealed,
	}));
```

예를 들어 창을 치운 상태에서 Dock의 터미널 아이콘을 누르면 `open('terminal')`이 `update(…, false)`를 호출하고, 같은 `setState` 한 번에 `desktopFocused`와 `desktopRevealed`가 모두 `false`가 된다. Dock 코드에는 바탕화면 보기에 관한 줄이 하나도 없다.

토글은 떠 있는 창(실행 중이고 최소화하지 않은 창)이 없으면 같은 state 객체를 반환한다. 구독자에게 알림이 가지 않으므로 React도 다시 렌더링하지 않는다.

```ts
toggleDesktopRevealed: () =>
	store.setState((state) =>
		state.desktopRevealed
			? { ...state, desktopRevealed: false }
			: hasVisibleWindow(state.apps)
				? { ...state, desktopRevealed: true, desktopFocused: true }
				: state
	),
```

치우는 시각에 `desktopFocused`도 `true`로 설정해 메뉴 막대의 앱 이름이 Finder가 된다. 바탕화면을 누른 것이므로 [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name) 규칙과도 일치한다.

## 밀어 낼 거리: revealShift

창 가운데가 화면 왼쪽 반에 있으면 왼쪽으로, 아니면 오른쪽으로 민다. 화면에는 `REVEAL_PEEK`(40px)만 남긴다. 계산은 `desktop/window/geometry.ts`의 순수 함수라 단위 테스트 2개로 검증한다.

```ts
export const REVEAL_PEEK = 40;

export function revealShift(rect: Rect, viewport: Viewport): number {
	const toLeft = rect.x + rect.width / 2 < viewport.width / 2;
	return toLeft ? REVEAL_PEEK - (rect.x + rect.width) : viewport.width - REVEAL_PEEK - rect.x;
}
```

![1440×900 화면에서 Safari 창은 가운데 x 388이라 왼쪽으로 636px, 터미널 창은 가운데 x 1098이라 오른쪽으로 600px 이동해 각각 40px만 남는 계산](./images/reveal-desktop-shift.svg '캡처의 배치로 계산한 revealShift. 이동은 x축만, y는 그대로')

캡처의 두 창으로 계산하면 다음과 같다. 화면 폭은 1440px이고 가운데는 720px이다.

| 창     | `x` | `width` | 가운데 x | 방향   | 이동 거리                   | 밀린 뒤 보이는 부분 |
| ------ | --- | ------- | -------- | ------ | --------------------------- | ------------------- |
| Safari | 100 | 576     | 388      | 왼쪽   | 40 − (100 + 576) = **−636** | x 0~40              |
| 터미널 | 800 | 596     | 1098     | 오른쪽 | 1440 − 40 − 800 = **600**   | x 1400~1440         |

## left·top 대신 CSS translate

창의 자리는 인라인 스타일 `left`·`top`·`width`·`height`로 지정한다. 밀어 내는 거리는 이 값을 바꾸지 않고 CSS `translate` 속성에 넣었다.

```tsx
style={{
	left: rect.x,
	top: rect.y,
	width: rect.width,
	height: rect.height,
	zIndex,
	translate: desktopRevealed ? `${revealShift(rect, viewport)}px 0` : undefined,
}}
```

`left`·`top`은 레이아웃 속성이라 값을 바꾸면 요소의 자리 자체가 바뀌고, 그 값을 읽는 다른 코드도 바뀐 값을 본다. `translate`는 레이아웃이 끝난 뒤 그리는 단계에서만 적용되므로, 다른 코드가 읽는 `rect`는 원래 자리 그대로다. `left`·`top`을 바꾸면 세 곳과 충돌한다.

- **화면 안 제한**: `useWindowFrame`은 렌더링할 때마다 `clampRect`로 창을 화면 안으로 제한한다(`x`는 0 ~ `viewport.width − width`). 화면 밖 좌표를 넣으면 이 함수가 다시 화면 안으로 되돌린다.
- **저장된 자리**: 끌기와 크기 조절이 끝나면 `rect`를 `localStorage`에 저장한다. 밀어 낸 좌표가 섞이면 원래 자리를 따로 보관해야 한다.
- **열기·닫기 애니메이션**: `windowMotion.ts`는 [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)로 `transform`을 움직여 창이 Dock 아이콘에서 커지거나 줄어들게 한다.

![채택한 방식은 left 100px를 그대로 두고 translate −636px과 열기 애니메이션의 transform을 따로 적용한다. left를 −536px로 바꾸는 방식은 clampRect가 x를 0으로 되돌린다](./images/reveal-desktop-layers.svg '위: 값마다 다른 속성에 기록해 서로 덮어쓰지 않는다. 아래: left 하나에 두 의미를 넣으면 clampRect가 밀어 낸 좌표를 되돌린다')

개별 변환 속성인 `translate`는 `transform`과 별개의 속성이고, 두 값은 `translate` → `rotate` → `scale` → `transform` 순서로 합성된다[^individual-transform]. 그래서 애니메이션의 `transform`을 덮어쓰지 않고, `rect` 계산에도 관여하지 않는다. 밀려난 상태에서 Dock으로 다른 앱을 열어도 ==열기 애니메이션은 그대로 재생된다==. 예를 들어 열기 애니메이션이 `transform`으로 창의 크기를 키우는 동안에도 `translate: -636px 0`은 그대로 남아, 창은 밀려난 자리에서 커진다.

전환은 `Window.css`에서 `translate`에만 지정했다. 끌기 중에는 `left`·`top`이 포인터를 즉시 따라가야 하므로 전환을 걸지 않는다. `left`에도 전환을 걸면 창을 끌 때 창이 포인터보다 0.4초 늦게 따라온다.

```css
.container {
	transition: translate var(--duration-slow) var(--ease-out); /* 400ms */
}
```

동작 줄이기 설정(`prefers-reduced-motion: reduce`)이면 `motion.css`의 전역 규칙이 모든 `transition`을 끄므로 창이 즉시 이동한다.

## 밀려난 창의 누르기

밀려난 창은 40px만 보인다. 이 영역에 신호등 버튼이나 앱 내용이 걸리면, ==누른 결과가 "창을 되돌리기"가 아니라 "그 버튼 실행"이 된다==. 예를 들어 오른쪽으로 밀린 터미널 창은 왼쪽 40px만 보이는데, 그 자리에 신호등의 닫기 버튼이 있다. 창을 되돌리려고 그곳을 누르면 터미널이 닫힌다. 창 안의 요소가 포인터를 받지 않게 했다.

```css
.container.revealed > * {
	pointer-events: none;
}
```

브라우저는 누른 좌표에서 가장 위에 그려진 요소를 찾아 이벤트 대상으로 정하는데(hit testing), `pointer-events: none`인 요소는 이 탐색에서 제외된다. 자식 요소가 모두 `none`이면 이벤트 대상은 창 컨테이너 자신이 된다. 컨테이너에는 원래 `onPointerDownCapture={() => bringAppToFront(appName)}`가 있으므로, 맨 앞으로 가져오기 → `desktopFocused: false` → `desktopRevealed: false` 순서로 모든 창이 돌아오고 누른 창이 맨 앞이 된다. 새 핸들러는 추가하지 않았다.

![밀려난 창의 보이는 40px을 누르면 pointer-events: none인 자식 요소를 건너뛰어 창 컨테이너가 대상이 되고, bringAppToFront, desktopFocused false, desktopRevealed false 순서로 모든 창이 돌아온다](./images/reveal-desktop-hit-test.svg '창을 누르면 맨 앞으로 오는 기존 경로를 그대로 사용한다')

## 바탕화면 누르기와 끌어 고르기의 구분

바탕화면 빈 곳을 누르고 끌면 아이콘을 사각형으로 고르는 동작(밴드 선택)이 이미 있다. Finder에서 빈 곳을 누른 채 대각선으로 끌면 반투명한 사각형이 그려지고, 그 안에 들어온 아이콘이 모두 선택되는 동작이다. 같은 `pointerdown`에서 시작하므로, 판단은 `pointerup`에서 한다. 바탕화면 아이콘 층(`desktop/icons/DesktopIcons.tsx`)이 밴드 선택 시작점을 보관하고 있어 거기에 조건을 추가했다.

```ts
if (current?.kind === 'band') {
	// 빈 곳을 끌지 않고 눌렀다 뗐다: 바탕화면 보기
	const point = pointOf(event);
	const still = Math.hypot(point.x - current.start.x, point.y - current.start.y) < DRAG_THRESHOLD;
	if (still && !event.metaKey && !event.shiftKey) toggleDesktopRevealed();
	return;
}
```

![2px만 움직이고 떼면 반지름 4px 안이라 바탕화면 보기를 토글하고, 30px 끌고 떼면 밴드 선택으로 처리해 창은 그대로 둔다](./images/reveal-desktop-click-band.svg '같은 pointerdown에서 시작한 두 동작을 pointerup의 이동 거리로 나눈다')

- 이동 거리가 `DRAG_THRESHOLD`(4px) 미만일 때만 누르기로 판단한다. 아이콘 끌기와 같은 기준값이다. `Math.hypot(dx, dy)`는 두 점 사이의 직선 거리 √(dx² + dy²)이므로, 가로 3px·세로 2px 움직였다면 거리는 약 3.6px로 누르기다.
- ⌘·⇧를 누른 채 누르면 선택에 추가하는 동작이므로 창을 치우지 않는다.

## 확인

- 창 store 단위 테스트 3개 추가: 토글 왕복, 창을 누르거나 앱을 열면 복귀, 떠 있는 창이 없으면 구독자 호출 없음.
- `revealShift` 단위 테스트 2개 추가.
- `e2e/window.spec.ts`의 "바탕화면 보기" 4개:
  - 빈 곳을 누르면 가장자리에 40px만 남고(`toBeCloseTo(40, 0)`) y는 그대로, 메뉴 막대는 Finder. 다시 누르면 원래 x로 복귀
  - 밀려난 창의 남은 곳을 누르면 원래 자리로 돌아오고 메뉴 막대가 그 앱 이름
  - 치운 채 Dock에서 터미널을 열면 모든 창에서 `revealed` 클래스 제거
  - 빈 곳을 30px 끌면 창을 치우지 않음

<details>
<summary>E2E에서 "바탕화면 빈 곳"을 찾는 방법</summary>

바탕화면에는 위젯과 아이콘이 있어 고정 좌표는 화면 크기·위젯 배치가 바뀌면 깨진다. 시험은 화면을 40px 간격으로 훑어 [`document.elementFromPoint`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)의 결과가 아이콘 층(`.desktop-icons`) 자신인 첫 좌표를 사용한다.

```ts
for (let x = 40; x < window.innerWidth - 40; x += 40)
	for (let y = 60; y < window.innerHeight - 160; y += 40)
		if (document.elementFromPoint(x, y)?.classList.contains('desktop-icons')) return { x, y };
```

</details>

## 남은 것

- 창이 여러 개여도 각 창은 자기 가운데 좌표만으로 방향을 정하고 x축으로만 이동한다. 같은 쪽으로 밀린 창의 y 범위가 겹치면 40px 영역도 겹치고, 그 부분에서는 맨 앞 창만 누를 수 있다.
- 전체 화면(최대화)한 창도 같은 규칙으로 밀려난다. 가운데가 정확히 화면 가운데라 오른쪽으로 이동한다. `rect.x + rect.width / 2 < viewport.width / 2`에서 두 값이 같으면 조건이 거짓이기 때문이다.

## 관련 글

- [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore): `desktopRevealed`를 추가한 창 store
- [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name): `desktopFocused`와 바탕화면을 누르면 Finder가 되는 규칙
- [callback ref로 바뀐 요소에 ResizeObserver 다시 연결하기](/memo/memo-restore-compact): 같은 날 수정한 창 최소화 관련 결함

[^individual-transform]: CSS Transforms Module Level 2의 개별 변환 속성. 요소의 최종 변환 행렬은 `translate`, `rotate`, `scale`, `transform` 순서로 곱해 계산한다. [CSS Transforms Level 2: Individual Transforms](https://www.w3.org/TR/css-transforms-2/#individual-transforms)

<details>
<summary>참고 문헌</summary>

- Apple 지원, [Mac에서 데스크탑 및 Dock 설정 변경하기](https://support.apple.com/ko-kr/guide/mac-help/mchlp1119/mac)
- W3C, [CSS Transforms Module Level 2: Individual Transform Properties](https://www.w3.org/TR/css-transforms-2/#individual-transforms)
- MDN, [translate](https://developer.mozilla.org/en-US/docs/Web/CSS/translate), [transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)
- MDN, [pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)
- MDN, [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- MDN, [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- MDN, [Math.hypot()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/hypot)
- MDN, [Document.elementFromPoint()](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)

</details>

<details>
<summary>사진 출처</summary>

- macOS Sonoma 바탕화면 위젯: Apple Newsroom, [macOS Sonoma is available today](https://www.apple.com/newsroom/2023/09/macos-sonoma-is-available-today/) (2023-09-26), 원본 [Apple-macOS-Sonoma-Widgets_big.jpg](https://www.apple.com/newsroom/images/2023/09/macos-sonoma-is-available-today/article/Apple-macOS-Sonoma-Widgets_big.jpg.large.jpg), 출처 표기

</details>

#MacFolio #데스크톱 #CSS #macOS
