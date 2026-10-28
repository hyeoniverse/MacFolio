---
title: 캡처 단계 이벤트와 pointer capture로 고친 창·메뉴 막대 입력 버그
date: 2026-10-22
category: 개발 기록/MacFolio/프론트엔드
summary: 최대화한 창은 크기 조절 커서만 표시되고 끌리지 않았고, Dock을 누르는 동안 메뉴 막대 앱 이름이 Finder로 깜빡였고, 음량 창은 맨 위를 눌러도 91%였다. 셋 다 화면에 보이는 것과 입력을 처리하는 조건·영역이 달랐던 곳이다.
---

데스크톱 셸의 포인터 입력에서 나온 결함 세 가지를 정리한다. 각각 따로 수정했지만 구조는 같다. 화면에는 "누를 수 있다"고 표시되는데, 입력을 처리하는 코드는 다른 조건이나 다른 영역을 기준으로 판단하고 있었다.

| PR                                                       | 증상                                           | 어긋난 두 기준                                  |
| -------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| [#274](https://github.com/hyeoniverse/MacFolio/pull/274) | 최대화한 창의 가장자리를 끌어도 크기 변화 없음 | 크기 조절 커서(CSS)와 끌기 시작 조건(`begin`)   |
| [#133](https://github.com/hyeoniverse/MacFolio/pull/133) | Dock을 누르는 동안 앱 이름이 Finder로 깜빡임   | 누르는 시각(`pointerdown`)과 여는 시각(`click`) |
| [#315](https://github.com/hyeoniverse/MacFolio/pull/315) | 음량 창 맨 위를 눌러도 91%                     | 보이는 칸 96px과 투명 range 144px               |

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

주석의 의도는 "옮기기 막기"였다. 하지만 `next.kind`를 확인하지 않아서 크기 조절(`kind: 'resize'`)도 함께 막혔다. 공통 함수의 첫 줄에 있는 예외 조건이, 호출하는 쪽 하나만을 기준으로 작성되어 있었다.

### 수정

macOS처럼 최대화한 창의 가장자리를 끌면 **최대화가 풀리고, 화면을 채운 크기에서부터 조절**된다.

```ts
if ((isMaximized && next.kind === 'move') || (event.target as Element).closest('button, [role="button"]')) return;
// 최대화 중에 크기를 조절하면 최대화를 풀고 지금(꽉 찬) 크기에서부터 조절한다 (macOS처럼)
if (isMaximized) setIsMaximized(false);
// …
gesture.current = { ...next, pointerX: event.clientX, pointerY: event.clientY, start: rect };
```

- 제목 표시줄로 옮기기는 최대화 중에 계속 막는다.
- 끌기의 시작 크기 `start`는 이번 렌더링의 `rect`, 즉 `maximizedRect(viewport)`다. 포인터 이동량은 화면을 채운 크기를 기준으로 계산된다.
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

메뉴 막대의 앱 이름은 "창 밖을 눌렀으면 Finder, 아니면 맨 앞 창의 앱"이다. 창 밖을 눌렀는지는 화면 전체를 덮는 바탕화면 레이어(`DesktopSurface`)가 `pointerdown` **캡처 단계**에서 `focusDesktop()`을 호출해 기록한다. 이 구조는 [foregroundApp으로 메뉴 막대의 앱 이름을 맨 앞 창에 맞추기](/memo/menu-bar-app-name)에 자세히 정리했다.

메뉴 막대와 메뉴는 예외 목록으로 이 처리를 건너뛰는데, Dock은 목록에 없었다. 반면 Dock은 앱을 `click`에서 연다.

| 순서 | 이벤트                | 처리                                | 앱 이름 |
| ---- | --------------------- | ----------------------------------- | ------- |
| 1    | `pointerdown` (캡처)  | `DesktopSurface`가 `focusDesktop()` | Finder  |
| 2    | 누르고 있는 동안      | 없음                                | Finder  |
| 3    | `pointerup` → `click` | Dock이 `openApp('memo')`            | 메모    |

### 수정

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

### 확인: 거쳐 간 값까지 기록하는 시험

이 결함은 최종 상태만 확인하는 시험으로는 검출되지 않는다. 누르기 전 Safari, 뗀 뒤 메모로 시작과 끝은 정상이고, 중간의 Finder만 잘못되었다. 시험은 앱 이름 요소에 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)를 등록해 거쳐 간 문자열을 모두 기록한 뒤, 그 목록에 'Finder'가 없는지 확인한다.

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

음량 창(`.volume-container`)은 폭 2rem, 높이 6rem(96px)이다. 그 위에 투명한 `<input type="range">`를 겹치고 `transform: rotate(-90deg)`로 세웠다.

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

![보이는 칸은 96px인데 투명 range는 144px이라 위아래 24px씩 칸 밖에 있고, 지름 60px 손잡이가 칸 높이의 62%를 차지한다. 수정 후에는 칸의 아래 끝에서 누른 높이까지의 비율이 음량이다](./images/window-menubar-input-fixes-volume.svg '왼쪽은 수정 전 range와 칸의 크기 차이, 오른쪽은 수정 후 계산')

- **길이 불일치**: range는 144px, 보이는 칸은 96px이다. 칸은 `overflow: hidden`이라 range의 위아래 24px씩은 보이지 않고 누를 수도 없다. range의 값은 144px 길이를 기준으로 정해지므로, 보이는 칸의 맨 위가 range의 맨 위가 아니다. 측정한 결과 맨 위를 누르면 91%였다.
- **손잡이 크기**: 손잡이 지름 60px은 칸 높이 96px의 62%다. range는 손잡이 위를 누르면 값을 바꾸지 않고 손잡이 끌기를 시작하므로, 칸의 절반 이상이 "눌러도 그대로"인 영역이었다.

### 수정

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

- `pointerdown`에서 [`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)를 호출해, 끄는 도중 포인터가 칸 밖으로 나가도 `pointermove`를 계속 받는다. 칸 밖의 값은 0~1로 제한한다.
- `pointermove`는 포인터를 캡처한 상태에서만 처리한다. 누르지 않고 칸 위를 지나가는 것으로는 음량이 바뀌지 않는다.
- 칸에 `touch-action: none`과 `user-select: none`을 지정해 터치로 끄는 동안 화면이 스크롤되거나 글자가 선택되지 않게 했다.

range는 삭제하지 않았다. 방향키 조작과 화면 읽기 프로그램의 "음량 슬라이더"로 필요하다. 회전과 손잡이 스타일을 삭제하고 칸 전체를 덮게(`position: absolute; inset: 0`) 한 뒤 [`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/pointer-events)으로 포인터만 받지 않게 했다.

### 확인

`e2e/desktop.spec.ts`의 음량 시험에 칸 좌표 기준 확인을 추가했다. 수정 전 코드에서는 첫 항목이 91%로 실패했다.

| 입력                           | 기대 값  |
| ------------------------------ | -------- |
| 칸 위 끝에서 2px 아래 누르기   | 95% 이상 |
| 칸 아래 끝에서 2px 위 누르기   | 5% 이하  |
| 칸 가운데 누르기               | 50 ± 3%  |
| 아래 끝 → 위에서 1/4 지점 끌기 | 75 ± 4%  |

## 정리

- **공통 함수의 예외 조건은 모든 호출 경로를 기준으로 작성한다.** `begin`은 옮기기와 크기 조절이 공유하는데, 예외 조건은 옮기기만 고려했다. 조건에 `next.kind`를 포함하는 것으로 해결됐다.
- **상태가 바뀌는 시각을 입력 동작과 맞춘다.** 앱 이름은 `pointerdown`에서, 앱 열기는 `click`에서 바뀌어 그 사이에 중간 상태가 노출됐다. 중간 상태 결함은 거쳐 간 값을 모두 기록하는 시험으로 검출한다.
- **보이는 영역과 입력 영역을 하나로 만든다.** 투명한 컨트롤을 겹치면 크기·회전·손잡이 스타일이 화면과 따로 움직인다. 입력은 보이는 요소가 받고, 접근성용 컨트롤은 포인터를 받지 않게 분리했다.

## 남은 것

- 최대화한 창의 크기 조절: `begin`은 `isMaximized`만 `false`로 바꾸고 `savedRect`는 갱신하지 않는다. 그래서 가장자리를 누른 뒤 첫 `pointermove`가 오기 전까지는 최대화 이전의 저장된 크기로 렌더링된다. 누른 채 움직이지 않으면 창이 이전 크기로 돌아간 것처럼 보인다. 시작 시각에 `savedRect`도 `rect`로 설정하면 해소된다.

## 관련 글

- [foregroundApp으로 메뉴 막대의 앱 이름을 맨 앞 창에 맞추기](/memo/menu-bar-app-name): 바탕화면 레이어의 캡처 핸들러와 예외 목록 전체
- [useState·Context에 있던 창 관리 규칙을 프레임워크와 무관한 desktop-core 패키지로 옮기기](/memo/desktop-core-windows): 창 순서와 최소화 상태를 관리하는 창 store
- [/health 응답 시간으로 메뉴 막대의 Wi-Fi 자리에 서버 상태 표시하기](/memo/server-status-wifi): 음량 창을 메뉴 막대 항목(`VolumeMenu`)으로 바꾼 일

#MacFolio #데스크톱 #PointerEvents #트러블슈팅
