---
title: CSS translate와 pointer-events로 레이아웃을 건드리지 않고 창 밀어내기
date: 2026-10-22
category: 개발 기록/MacFolio/프론트엔드
summary: macOS Sonoma의 '배경화면을 클릭하여 데스크탑 보기'를 옮겼다. 창 store에 desktopRevealed 상태를 추가하고, 창은 left·top 대신 CSS translate로 밀어 열기·닫기 애니메이션과 끌기 계산에서 분리했다. 바탕화면 아이콘을 끌어 고르는 동작과는 이동 거리로 구분한다.
---

macOS Sonoma에는 "배경화면을 클릭하여 데스크탑 보기" 설정이 있다. 바탕화면의 빈 곳을 누르면 떠 있는 창이 화면 가장자리로 밀려나 위젯과 바탕화면 아이콘이 드러나고, 다시 누르면 창이 돌아온다. MacFolio에서는 첫 화면에 Safari 창이 열려 있어 바탕화면의 위젯 일부가 가려진다. 창을 하나씩 최소화하지 않고 바탕화면을 확인할 수 있게 이 동작을 옮겼다([#326](https://github.com/hyeoniverse/MacFolio/pull/326)).

![Safari 창이 위젯 위에, 터미널 창이 화면 오른쪽에 떠 있는 1440×900 바탕화면](./images/reveal-desktop-before.jpg '누르기 전. Safari 창이 날씨·달력·음악 위젯을 가린다')

![Safari 창은 왼쪽 가장자리에, 터미널 창은 오른쪽 가장자리에 40px씩만 남고 위젯과 바탕화면 아이콘이 드러난 화면](./images/reveal-desktop-after.jpg '바탕화면 빈 곳을 누른 뒤. 가까운 가장자리로 밀려나 40px만 남는다. 메뉴 막대는 Finder')

## 동작 규칙

| 입력                           | 결과                                  |
| ------------------------------ | ------------------------------------- |
| 바탕화면 빈 곳 누르기          | 떠 있는 창을 모두 가장자리로          |
| 다시 바탕화면 빈 곳 누르기     | 모든 창이 원래 자리로                 |
| 밀려난 창의 남은 40px 누르기   | 모든 창이 돌아오고 그 창이 맨 앞      |
| Dock·Launchpad·바탕화면 아이콘 | 모든 창이 돌아오고 연 앱이 맨 앞      |
| 바탕화면을 끌어 아이콘 고르기  | 변화 없음 (⌘·⇧를 누른 채 누르기 포함) |
| 떠 있는 창이 없음              | 변화 없음                             |

휴대폰 화면은 바뀌지 않는다. 휴대폰의 앱은 화면 전체를 채우는 하나의 창이라 밀어 낼 대상이 없다.

## 상태: desktop-core 창 store의 desktopRevealed

창 상태는 프레임워크와 무관한 `packages/desktop-core`의 창 store가 관리한다([useState·Context에 있던 창 관리 규칙을 프레임워크와 무관한 desktop-core 패키지로 옮기기](/memo/desktop-core-windows)). 여기에 `desktopRevealed` 하나를 추가했다.

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

"돌아오는 조건"은 별도 코드를 작성하지 않고 기존 상태에 연결했다. 창 store의 `update`는 창을 맨 앞으로 가져오는 `bringToFront`와 앱을 여는 `open`에서 `desktopFocused`를 `false`로 바꾼다. 같은 시각에 `desktopRevealed`도 `false`로 바꾸면, 창 누르기·Dock·Launchpad·바탕화면 아이콘으로 앱 열기가 모두 같은 경로를 탄다.

```ts
const update = (change, desktopFocused?: boolean) =>
	store.setState((state) => ({
		...state,
		apps: change(state.apps),
		desktopFocused: desktopFocused ?? state.desktopFocused,
		desktopRevealed: desktopFocused === false ? false : state.desktopRevealed,
	}));
```

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

치우는 시각에 `desktopFocused`도 `true`로 설정해 메뉴 막대의 앱 이름이 Finder가 된다. 바탕화면을 누른 것이므로 [foregroundApp으로 메뉴 막대의 앱 이름을 맨 앞 창에 맞추기](/memo/menu-bar-app-name) 규칙과도 일치한다.

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

## left·top 대신 CSS translate

창의 자리는 인라인 스타일 `left`·`top`·`width`·`height`로 지정한다. 밀어 내는 거리는 이 값을 바꾸지 않고 CSS [`translate`](https://developer.mozilla.org/en-US/docs/Web/CSS/translate) 속성에 넣었다.

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

`left`·`top`을 바꾸면 세 곳과 충돌한다.

- **화면 안 제한**: `useWindowFrame`은 렌더링할 때마다 `clampRect`로 창을 화면 안으로 제한한다(`x`는 0 ~ `viewport.width − width`). 화면 밖 좌표를 넣으면 이 함수가 다시 화면 안으로 되돌린다.
- **저장된 자리**: 끌기와 크기 조절이 끝나면 `rect`를 `localStorage`에 저장한다. 밀어 낸 좌표가 섞이면 원래 자리를 따로 보관해야 한다.
- **열기·닫기 애니메이션**: `windowMotion.ts`는 [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)로 `transform`을 움직여 창이 Dock 아이콘에서 커지거나 줄어들게 한다.

개별 변환 속성인 `translate`는 `transform`과 별개의 속성이고, 두 값은 `translate` → `rotate` → `scale` → `transform` 순서로 합성된다[^individual-transform]. 그래서 애니메이션의 `transform`을 덮어쓰지 않고, `rect` 계산에도 관여하지 않는다. 밀려난 상태에서 Dock으로 다른 앱을 열어도 열기 애니메이션은 그대로 재생된다.

전환은 `Window.css`에서 `translate`에만 지정했다. 끌기 중에는 `left`·`top`이 포인터를 즉시 따라가야 하므로 전환을 걸지 않는다.

```css
.container {
	transition: translate var(--duration-slow) var(--ease-out); /* 400ms */
}
```

동작 줄이기 설정(`prefers-reduced-motion: reduce`)이면 `motion.css`의 전역 규칙이 모든 `transition`을 끄므로 창이 즉시 이동한다.

## 밀려난 창의 누르기

밀려난 창은 40px만 보인다. 이 영역에 신호등 버튼이나 앱 내용이 걸리면, 누른 결과가 "창을 되돌리기"가 아니라 "그 버튼 실행"이 된다. 창 안의 요소가 포인터를 받지 않게 했다.

```css
.container.revealed > * {
	pointer-events: none;
}
```

자식 요소가 [`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)이면 이벤트 대상은 창 컨테이너 자신이 된다. 컨테이너에는 원래 `onPointerDownCapture={() => bringAppToFront(appName)}`가 있으므로, 맨 앞으로 가져오기 → `desktopFocused: false` → `desktopRevealed: false` 순서로 모든 창이 돌아오고 누른 창이 맨 앞이 된다. 새 핸들러는 추가하지 않았다.

## 바탕화면 누르기와 끌어 고르기의 구분

바탕화면 빈 곳을 누르고 끌면 아이콘을 사각형으로 고르는 동작(밴드 선택)이 이미 있다. 같은 `pointerdown`에서 시작하므로, 판단은 `pointerup`에서 한다. 바탕화면 아이콘 층(`desktop/icons/DesktopIcons.tsx`)이 밴드 선택 시작점을 보관하고 있어 거기에 조건을 추가했다.

```ts
if (current?.kind === 'band') {
	// 빈 곳을 끌지 않고 눌렀다 뗐다: 바탕화면 보기
	const point = pointOf(event);
	const still = Math.hypot(point.x - current.start.x, point.y - current.start.y) < DRAG_THRESHOLD;
	if (still && !event.metaKey && !event.shiftKey) toggleDesktopRevealed();
	return;
}
```

- 이동 거리가 `DRAG_THRESHOLD`(4px) 미만일 때만 누르기로 판단한다. 아이콘 끌기와 같은 기준값이다.
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
- 전체 화면(최대화)한 창도 같은 규칙으로 밀려난다. 가운데가 정확히 화면 가운데라 오른쪽으로 이동한다.

## 관련 글

- [useState·Context에 있던 창 관리 규칙을 프레임워크와 무관한 desktop-core 패키지로 옮기기](/memo/desktop-core-windows): `desktopRevealed`를 추가한 창 store
- [foregroundApp으로 메뉴 막대의 앱 이름을 맨 앞 창에 맞추기](/memo/menu-bar-app-name): `desktopFocused`와 바탕화면을 누르면 Finder가 되는 규칙
- [callback ref로 바뀐 요소에 ResizeObserver 다시 연결하기](/memo/memo-restore-compact): 같은 날 수정한 창 최소화 관련 결함

[^individual-transform]: CSS Transforms Module Level 2의 개별 변환 속성. 요소의 최종 변환 행렬은 `translate`, `rotate`, `scale`, `transform` 순서로 곱해 계산한다. [CSS Transforms Level 2: Individual Transforms](https://www.w3.org/TR/css-transforms-2/#individual-transforms)

#MacFolio #데스크톱 #CSS #macOS
