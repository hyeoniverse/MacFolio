---
title: 캡처 단계 이벤트와 pointer capture로 맞춘 화면과 입력 처리 영역
date: 2026-10-22
category: 개발 기록/MacFolio/인터랙션·브라우저 API
summary: 최대화한 창은 크기 조절 커서만 표시되고 끌리지 않았고, Dock을 누르는 동안 메뉴 막대 앱 이름이 Finder로 깜빡였고, 음량 창은 맨 위를 눌러도 91%였다. 셋 다 화면에 보이는 것과 입력을 처리하는 조건·영역이 달랐던 곳이다.
---

| 증상                                           | 원인                                                          | 해결                                                        | 영향 범위           |
| ---------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- |
| 최대화한 창의 가장자리를 끌어도 크기 변화 없음 | 공통 `begin`이 최대화 중 옮기기와 크기 조절을 함께 무시       | 최대화 중에는 옮기기만 막고, 크기 조절은 최대화를 풀고 시작 | 최대화한 모든 창    |
| Dock을 누르는 동안 앱 이름이 Finder로 깜빡임   | `pointerdown` 캡처 단계의 바탕화면 처리 예외 목록에 Dock 없음 | 예외 선택자에 `.dock`·`.launchpad-content` 추가             | 메뉴 막대 앱 이름   |
| 음량 창 맨 위를 눌러도 91%                     | 보이는 칸 96px과 투명 range 144px의 길이·손잡이 크기 불일치   | 칸 전체가 pointer capture로 누른 높이를 음량으로 계산       | 메뉴 막대의 음량 창 |

데스크톱 셸의 포인터 입력에서 나온 결함 세 가지다. 각각 따로 수정했지만 구조는 같다. ==화면에는 "누를 수 있다"고 표시되는데, 입력을 처리하는 코드는 다른 조건이나 다른 영역을 기준으로 판단하고 있었다.==

| PR                                                       | 증상                                           | 어긋난 두 기준                                  |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| [#274](https://github.com/hyeoniverse/MacFolio/pull/274) | 최대화한 창의 가장자리를 끌어도 크기 변화 없음 | 크기 조절 커서(CSS)와 끌기 시작 조건(`begin`)   |
| [#133](https://github.com/hyeoniverse/MacFolio/pull/133) | Dock을 누르는 동안 앱 이름이 Finder로 깜빡임   | 누르는 시각(`pointerdown`)과 여는 시각(`click`) |
| [#315](https://github.com/hyeoniverse/MacFolio/pull/315) | 음량 창 맨 위를 눌러도 91%                     | 보이는 칸 96px과 투명 range 144px               |

## 배경: 포인터 이벤트의 순서와 전달 경로

### 한 번 누르면 발생하는 이벤트

[포인터 이벤트(Pointer Events)](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)는 마우스·펜·손가락 입력을 하나의 형식으로 다루는 브라우저 이벤트다. Dock 아이콘을 마우스로 한 번 눌렀다 떼면 다음 순서로 이벤트가 발생한다.

| 순서 | 이벤트        | 발생 시각                                            |
| ---- | ------------- | ---------------------------------------------------- |
| 1    | `pointerdown` | 버튼을 누른 순간                                     |
| 2    | `pointermove` | 누른 채 움직이는 동안 반복(움직이지 않으면 없음)     |
| 3    | `pointerup`   | 버튼을 뗀 순간                                       |
| 4    | `click`       | `pointerup` 직후, 누른 곳과 뗀 곳이 같은 버튼 안이면 |

`pointerdown`과 `click` 사이에는 사용자가 누르고 있는 시간만큼 간격이 있다. 이 간격 동안 화면에 표시되는 상태가 두 번째 결함의 원인이었다.

### 캡처 단계와 버블링 단계

이벤트는 누른 요소 하나에만 전달되지 않는다. DOM 표준은 이벤트를 트리의 맨 위(`Window`)에서 누른 요소까지 내려보냈다가(캡처 단계), 누른 요소에서 처리하고(타깃 단계), 다시 맨 위까지 올려보낸다(버블링 단계).

![W3C UI Events 명세의 이벤트 흐름 그림. Window에서 td까지 빨간 화살표로 내려가는 캡처 단계, 파란 td의 타깃 단계, 초록 화살표로 올라가는 버블링 단계](./images/window-menubar-input-fixes-w3c-event-flow.jpg 'DOM 이벤트 흐름. 캡처(1)는 위에서 아래로, 버블링(3)은 아래에서 위로 전달된다')

React에서 `onPointerDown`은 버블링 단계, `onPointerDownCapture`는 캡처 단계에 처리기를 등록한다. 예를 들어 화면 전체를 덮는 바탕화면 레이어에 `onPointerDownCapture`를 등록하면, 그 안의 Dock 버튼을 누른 경우에도 **Dock 버튼의 처리기보다 바탕화면 레이어의 처리기가 먼저** 실행된다. 이 구조 덕분에 바탕화면 레이어는 "화면 어디를 눌렀든" 한곳에서 판단할 수 있지만, 예외로 둘 영역을 직접 지정해야 한다.

### pointer capture

보통 `pointermove`는 포인터 아래에 있는 요소로 전달된다. 음량 막대를 누른 채 막대 밖으로 끌면, 그 뒤의 이벤트는 막대가 아니라 막대 밖 요소로 간다. [`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)를 호출하면 버튼을 뗄 때까지 그 포인터의 이벤트를 모두 지정한 요소로 보낸다. 슬라이더나 창 끌기처럼 "누른 요소가 끝까지 입력을 받아야 하는" 조작에 쓰는 기능이다.

## 최대화한 창의 크기 조절 (#274)

### 증상

창을 최대화(초록 버튼)한 뒤 가장자리에 포인터를 올리면 크기 조절 커서가 표시된다. 그런데 끌어도 창이 움직이지 않았다. 핸들은 렌더링되어 있고 커서도 바뀌므로, 사용자 입장에서는 고장으로 보인다.

### 원인

창의 위치·크기는 `desktop/window/useWindowFrame.ts`가 관리한다. 제목 표시줄 끌기(옮기기)와 가장자리 8방향 핸들(크기 조절)이 같은 `begin` 함수로 시작한다. 이 함수의 첫 줄이 최대화 상태에서는 모든 끌기를 무시했다.

```ts
const begin = (event: React.PointerEvent, next: GestureKind) => {
	// 최대화 중에는 옮기지 않고, 제목 표시줄 안의 버튼(닫기 등)을 누른 경우도 무시한다
	if (isMaximized || (event.target as Element).closest('button, [role="button"]')) return;
	// …
};
```

주석의 의도는 "옮기기 막기"였다. 하지만 `next.kind`를 확인하지 않아서 크기 조절(`kind: 'resize'`)도 함께 막혔다. ==공통 함수의 첫 줄에 있는 예외 조건이, 호출하는 쪽 하나만을 기준으로 작성되어 있었다.== 크기 조절 커서는 CSS(`cursor: nwse-resize` 등)가 핸들 요소에 항상 적용하므로, 커서 모양과 실제 동작이 따로 결정되고 있었다.

![옮기기와 크기 조절, 일반 창과 최대화한 창의 조합별로 begin이 끌기를 시작하는지 비교한 표](./images/window-menubar-input-fixes-begin.svg '수정 전에는 최대화한 창의 크기 조절까지 무시했고, 수정 후에는 최대화를 풀고 시작한다')

### 해결

macOS처럼 최대화한 창의 가장자리를 끌면 **최대화가 풀리고, 화면을 채운 크기에서부터 조절**된다.

```ts
if ((isMaximized && next.kind === 'move') || (event.target as Element).closest('button, [role="button"]')) return;
// 최대화 중에 크기를 조절하면 최대화를 풀고 지금(꽉 찬) 크기에서부터 조절한다 (macOS처럼)
if (isMaximized) setIsMaximized(false);
// …
gesture.current = { ...next, pointerX: event.clientX, pointerY: event.clientY, start: rect };
```

- 제목 표시줄로 옮기기는 최대화 중에 계속 막는다.
- 끌기의 시작 크기 `start`는 이번 렌더링의 `rect`, 즉 `maximizedRect(viewport)`다. 포인터 이동량은 화면을 채운 크기를 기준으로 계산된다. 예를 들어 화면 폭이 1600px이면 시작 폭은 1600px이고, 오른쪽 아래 모서리를 왼쪽으로 400px 끌면 폭은 약 1200px이 된다.
- 포인터를 놓으면 결과 크기를 `localStorage`에 저장한다. 다음에 열어도 그 크기이고, 초록 버튼은 다시 "최대화"로 동작한다.

![화면 폭 1600px에서 최대화했던 GitHub 창이 오른쪽 아래 모서리를 끌어 폭 약 1195px로 줄어든 모습](./images/window-menubar-input-fixes-resize.jpg '최대화한 GitHub 창의 오른쪽 아래 모서리를 왼쪽 위로 (400, 250) 끈 결과. 왼쪽 위 모서리는 그대로')

### 확인

`e2e/window.spec.ts`에 "최대화한 창도 모서리를 끌면 최대화가 풀리며 크기가 바뀐다"를 추가했다. 최대화 → 오른쪽 아래 핸들을 (−300, −200) 끌기 → 폭이 약 300px, 높이가 약 200px 줄고 `x`가 최대화 상태와 같은지 확인한다.

## Dock을 누르는 동안 Finder로 깜빡인 앱 이름 (#133)

### 증상

Safari를 사용하는 중에 Dock의 메모를 누르면 메뉴 막대 앱 이름이 Safari → **Finder** → 메모 순서로 바뀌었다. Finder는 포인터를 누르고 있는 동안만 표시된다.

![Apple 로고 옆 앱 이름이 Finder로 표시된 메뉴 막대](./images/window-menubar-input-fixes-dock-before.jpg '수정 전: Safari를 사용하던 중 Dock의 메모를 누르고 있는 동안. 앱 이름이 Finder')

![Apple 로고 옆 앱 이름이 Safari로 표시된 메뉴 막대](./images/window-menubar-input-fixes-dock-after.jpg '수정 후: 같은 조작 중에도 앱 이름이 Safari로 유지된다')

### 원인

메뉴 막대의 앱 이름은 "창 밖을 눌렀으면 Finder, 아니면 맨 앞 창의 앱"이다. macOS에서 바탕화면을 클릭하면 메뉴 막대가 Finder로 바뀌는 동작을 따른 규칙이다. 창 밖을 눌렀는지는 화면 전체를 덮는 바탕화면 레이어(`DesktopSurface`)가 `pointerdown` **캡처 단계**에서 `focusDesktop()`을 호출해 기록한다. 이 구조는 [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name)에 자세히 정리했다.

메뉴 막대와 메뉴는 예외 목록으로 이 처리를 건너뛰는데, ==Dock은 목록에 없었다.== 반면 Dock은 앱을 `click`에서 연다.

| 순서 | 이벤트                | 처리                                | 앱 이름 |
| ---- | --------------------- | ----------------------------------- | ------- |
| 1    | `pointerdown` (캡처)  | `DesktopSurface`가 `focusDesktop()` | Finder  |
| 2    | 누르고 있는 동안      | 없음                                | Finder  |
| 3    | `pointerup` → `click` | Dock이 `openApp('memo')`            | 메모    |

![수정 전후 앱 이름의 변화를 pointerdown·누르는 중·pointerup·click 시각별로 나란히 그린 타임라인](./images/window-menubar-input-fixes-name-timeline.svg '수정 전에는 pointerdown부터 click까지 Finder가 표시되고, 수정 후에는 Safari가 유지된다')

### 해결

예외 선택자에 `.dock`과 `.launchpad-content`를 추가했다. Dock과 Launchpad 안을 누르는 동안에는 현재 앱이 유지되고, 클릭이 끝나 앱이 열리는 시각에 그 앱으로 바뀐다. macOS Dock도 마우스를 떼는 시각에 앱이 바뀐다. Launchpad 바깥의 어두운 영역은 계속 바탕화면으로 처리한다.

```tsx
onPointerDownCapture={(event) => {
	if (
		(event.target as Element).closest?.(
			'.macos-statusbar, .ui-menu, .volume-container, .keyboard-shortcuts-overlay, .dock, .launchpad-content'
		)
	)
		return;
	focusDesktop();
}}
```

[`closest`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)는 요소 자신부터 위쪽 조상까지 올라가며 선택자에 맞는 첫 요소를 찾는다. Dock의 메모 아이콘을 누르면 그 조상 중에 `.dock`이 있으므로 결과가 `null`이 아니고, 처리기는 `focusDesktop()`을 호출하지 않고 반환한다.

### 확인: 거쳐 간 값까지 기록하는 시험

> [!WARNING] 최종 상태만 확인하는 시험의 한계
> 이 결함은 최종 상태만 확인하는 시험으로는 검출되지 않는다. 누르기 전 Safari, 뗀 뒤 메모로 시작과 끝은 정상이고, 중간의 Finder만 잘못되었다.

시험은 앱 이름 요소에 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)를 등록해 거쳐 간 문자열을 모두 기록한 뒤, 그 목록에 'Finder'가 없는지 확인한다. `MutationObserver`는 지정한 DOM 요소의 자식·글자가 바뀔 때마다 콜백을 호출하는 브라우저 API다.

```ts
await appName(page).evaluate((element) => {
	const seen: string[] = [];
	(window as unknown as { __names: string[] }).__names = seen;
	new MutationObserver(() => seen.push(element.textContent ?? '')).observe(element, {
		childList: true,
		characterData: true,
		subtree: true,
	});
});
// Dock의 메모 위에서 mouse.down → 200ms 대기 → 'Safari' 확인 → mouse.up → '메모' 확인
expect(names).not.toContain('Finder');
```

수정 전 빌드에서는 이 시험이 실패했다(누르는 동안 Safari 대신 Finder).

## 맨 위를 눌러도 91%에서 멈춘 음량 (#315)

### 증상

메뉴 막대의 음량 아이콘을 누르면 세로 막대 모양의 음량 창이 열린다. 이 칸을 눌러 음량을 바꾸면 누른 높이와 음량이 맞지 않았다. 맨 위를 눌러도 91% 정도였고, 손잡이가 있는 근처를 누르면 값이 바뀌지 않았다.

### 원인

음량 창(`.volume-container`)은 폭 2rem, 높이 6rem(96px)이다. 그 위에 투명한 [`<input type="range">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range)를 겹치고 `transform: rotate(-90deg)`로 세웠다. `<input type="range">`는 브라우저 기본 슬라이더로, 막대의 한쪽 끝이 최솟값, 반대쪽 끝이 최댓값이다.

```css
.volume-slider {
	width: 9rem; /* 돌린 뒤의 세로 길이: 144px */
	height: 3rem;
	transform: rotate(-90deg);
	opacity: 0;
}
.volume-slider::-webkit-slider-thumb {
	width: 60px;
	height: 60px;
}
```

[`transform`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)은 요소를 그리는 위치만 바꾸고 레이아웃 크기는 바꾸지 않는다. 가로 144px짜리 range를 90도 돌리면 세로 144px로 그려지지만, 값 계산은 여전히 range 자신의 144px 길이를 기준으로 한다.

![보이는 칸은 96px인데 투명 range는 144px이라 위아래 24px씩 칸 밖에 있고, 지름 60px 손잡이가 칸 높이의 62%를 차지한다. 수정 후에는 칸의 아래 끝에서 누른 높이까지의 비율이 음량이다](./images/window-menubar-input-fixes-volume.svg '왼쪽은 수정 전 range와 칸의 크기 차이, 오른쪽은 수정 후 계산')

- **길이 불일치**: range는 144px, 보이는 칸은 96px이다. 칸은 `overflow: hidden`이라 range의 위아래 24px씩은 보이지 않고 누를 수도 없다. range의 값은 144px 길이를 기준으로 정해지므로, ==보이는 칸의 맨 위가 range의 맨 위가 아니다.== 측정한 결과 맨 위를 누르면 91%였다.
- **손잡이 크기**: 손잡이 지름 60px은 칸 높이 96px의 62%다. range는 손잡이 위를 누르면 값을 바꾸지 않고 손잡이 끌기를 시작하므로, 칸의 절반 이상이 "눌러도 그대로"인 영역이었다.

### 해결

range로 포인터를 처리하지 않고, 칸 전체가 포인터 이벤트를 받아 누른 높이로 음량을 계산한다.

```tsx
/** 누른(끈) 높이 그대로 음량: 칸 맨 아래 0, 맨 위 1 */
const setFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
	const rect = event.currentTarget.getBoundingClientRect();
	setVolume(Math.min(1, Math.max(0, (rect.bottom - event.clientY) / rect.height)));
};

<div
	className="volume-container"
	onPointerDown={(event) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		setFromPointer(event);
	}}
	onPointerMove={(event) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) setFromPointer(event);
	}}
>
```

계산 예를 들면, 칸이 화면 y 100~196px에 있고 y 124px을 누르면 `(196 − 124) / 96 = 0.75`, 즉 75%다. 칸 위로 끌어 y 80px이 되면 계산값 1.17을 1로 제한해 100%가 된다.

- `pointerdown`에서 `setPointerCapture`를 호출해, 끄는 도중 포인터가 칸 밖으로 나가도 `pointermove`를 계속 받는다. 칸 밖의 값은 0~1로 제한한다.
- `pointermove`는 포인터를 캡처한 상태에서만 처리한다. 누르지 않고 칸 위를 지나가는 것으로는 음량이 바뀌지 않는다.
- 칸에 `touch-action: none`과 `user-select: none`을 지정해 터치로 끄는 동안 화면이 스크롤되거나 글자가 선택되지 않게 했다.

> [!NOTE] 접근성용 range 유지
> range는 삭제하지 않았다. 방향키 조작과 화면 읽기 프로그램의 "음량 슬라이더"로 필요하다. 회전과 손잡이 스타일을 삭제하고 칸 전체를 덮게(`position: absolute; inset: 0`) 한 뒤 [`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)으로 포인터만 받지 않게 했다.

### 확인

`e2e/desktop.spec.ts`의 음량 시험에 칸 좌표 기준 확인을 추가했다. 수정 전 코드에서는 첫 항목이 91%로 실패했다.

| 입력                           | 기대 값  |
| ------------------------------ | -------- |
| 칸 위 끝에서 2px 아래 누르기   | 95% 이상 |
| 칸 아래 끝에서 2px 위 누르기   | 5% 이하  |
| 칸 가운데 누르기               | 50 ± 3%  |
| 아래 끝 → 위에서 1/4 지점 끌기 | 75 ± 4%  |

## 정리

| 결함         | 어긋난 두 기준                       | 적용한 원칙                                                      |
| ------------ | ------------------------------------ | ---------------------------------------------------------------- |
| 최대화한 창  | 핸들 커서(CSS)와 `begin`의 예외 조건 | 공통 함수의 예외 조건은 모든 호출 경로(`next.kind`)를 기준으로   |
| Dock 앱 이름 | `pointerdown`과 `click`              | 상태가 바뀌는 시각을 입력 동작(뗀 시각)과 맞춘다                 |
| 음량 창      | 보이는 칸 96px과 range 144px         | 입력은 보이는 요소가 받고, 접근성용 컨트롤은 포인터에서 분리한다 |

- 중간 상태 결함은 시작과 끝만 확인하는 시험으로 검출되지 않는다. 거쳐 간 값을 모두 기록하는 시험(`MutationObserver`)으로 검출한다.
- 투명한 컨트롤을 겹치면 크기·회전·손잡이 스타일이 화면과 따로 움직인다. 화면에 그리는 요소와 입력을 받는 요소를 같은 요소로 만들면 이 차이가 생기지 않는다.

## 남은 것

- 최대화한 창의 크기 조절: `begin`은 `isMaximized`만 `false`로 바꾸고 `savedRect`는 갱신하지 않는다. 그래서 가장자리를 누른 뒤 첫 `pointermove`가 오기 전까지는 최대화 이전의 저장된 크기로 렌더링된다. 누른 채 움직이지 않으면 창이 이전 크기로 돌아간 것처럼 보인다. 시작 시각에 `savedRect`도 `rect`로 설정하면 해소된다.

## 관련 글

- [창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name): 바탕화면 레이어의 캡처 핸들러와 예외 목록 전체
- [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore): 창 순서와 최소화 상태를 관리하는 창 store
- [/health 응답 시간을 막대 수로 환산하고 no-cors 요청으로 CORS 차단을 구분하는 서버 상태 표시](/memo/server-status-wifi): 음량 창을 메뉴 막대 항목(`VolumeMenu`)으로 바꾼 일

<details>
<summary>참고 문헌</summary>

- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN: Element.setPointerCapture()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- [MDN: Event bubbling and capture](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)
- [W3C: UI Events (Working Draft 2016-08-04), Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow)
- [DOM Standard: Dispatching events](https://dom.spec.whatwg.org/#dispatching-events)
- [React: Capture phase events](https://react.dev/learn/responding-to-events#capture-phase-events)
- [MDN: Element.closest()](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [MDN: `<input type="range">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/range)
- [MDN: transform](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)
- [MDN: pointer-events](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)

</details>

<details>
<summary>사진 출처</summary>

- DOM 이벤트 흐름 그림: W3C, [UI Events (W3C Working Draft, 2016-08-04), Figure: Graphical representation of an event dispatched in a DOM tree using the DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow), W3C Document License, 출처 표기 (SVG 원본 [eventflow.svg](https://w3c.github.io/uievents/images/eventflow.svg)를 JPG로 변환)

</details>

#MacFolio #데스크톱 #PointerEvents #트러블슈팅
