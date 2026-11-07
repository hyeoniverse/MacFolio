---
title: 캡처 단계 리스너와 Touch Events로 구현한 전체 화면 스와이프 판정
date: 2026-09-29
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 휴대폰 화면
seriesOrder: 1
summary: 상태 표시줄 44px 영역에서만 열리던 휴대폰 제어 센터를 화면 어디서든 스와이프로 열고 닫게 했다. 문서 전체에서 캡처 단계로 이벤트를 수신하고, 스크롤할 내용이 남은 영역에서는 스크롤을 우선하고, 손가락 입력은 Touch Events로 받아 패널이 손가락을 따라 움직이게 했다.
---

## 배경: 제어 센터와 브라우저의 터치 입력

**제어 센터**(Control Center)는 iPhone에서 Wi-Fi, 블루투스, 음량, 화면 밝기 같은 자주 쓰는 설정을 한 화면에 모은 패널이다. Face ID가 있는 iPhone에서는 화면 오른쪽 위 모서리에서 아래로 쓸어 내리면 열리고, 화면 아래에서 위로 쓸어 올리면 닫힌다.

![iPhone 제어 센터: 비행기 모드·Wi-Fi 묶음, 음악 재생, 밝기·음량 막대, 손전등·타이머 버튼](./images/control-center-swipe-apple-ios.jpg#float-right 'Apple iPhone 사용 설명서의 제어 센터 화면. 음량·밝기는 세로 막대를 끌어 조절한다')

MacFolio는 휴대폰으로 접속하면 데스크톱 대신 iOS 홈 화면 형태의 화면을 보여 준다. 이 화면에도 제어 센터가 있고, 위에서 아래로 쓸어 내리면 패널이 내려온다. 패널에는 음악 음량을 조절하는 세로 막대와 연락하기 타일 등이 있다.

처음 구현에서는 맨 위 상태 표시줄(44px)을 끌어야만 열렸고, 닫기는 손을 뗀 시각에만 판정해서 패널이 손가락을 따라 움직이지 않았다. [#39](https://github.com/hyeoniverse/MacFolio/pull/39)에서 화면 어디서든 스와이프로 열고 닫도록 바꿨다.

이 작업에는 브라우저 입력 처리의 세 가지 개념이 쓰인다.

| 개념               | 뜻                                                                                                                                           | 이 글에서의 쓰임                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **캡처 단계**      | DOM 이벤트는 문서 최상위에서 대상 요소까지 내려간 뒤(캡처) 다시 올라온다(버블링). `capture: true`로 등록한 처리기는 내려가는 도중에 실행된다 | 어떤 요소가 이벤트 전파를 막아도 문서 전체에서 먼저 수신 |
| **Pointer Events** | 마우스·펜·터치를 `pointerdown`·`pointermove`·`pointerup` 하나의 형식으로 전달하는 이벤트                                                     | 마우스·펜 입력 수신                                      |
| **Touch Events**   | 손가락 입력 전용 이벤트(`touchstart`·`touchmove`·`touchend`). 여러 손가락의 위치를 `touches` 목록으로 전달한다                               | 손가락 입력 수신, 스크롤 차단                            |

## 문제: 실제 휴대폰에서 발견한 세 가지

1. **열기 영역이 좁다.** 상태 표시줄은 44px이다. 엄지로 화면 상단 끝을 정확히 터치해야 했고, 조금만 아래에서 시작하면 동작하지 않았다. iOS는 오른쪽 위 모서리에서 스와이프해야 하지만, 이 사이트는 데스크톱 재현이 목적이라 "어디서든 아래로 스와이프하면 열린다"가 더 적합했다.
2. **닫을 때 패널이 움직이지 않는다.** 위로 스와이프해 닫으면 손을 떼는 시각에야 판정했다. 손가락이 움직이는 동안 패널은 고정되어 있어, 닫힐지 여부를 손을 떼기 전에는 알 수 없었다.
3. **음량 막대 조작이 제어 센터를 닫는다.** 음량을 올리려고 막대를 위로 끌면, 패널의 `onPointerUp`이 "위로 60px 이상 이동"으로 판정해 제어 센터를 닫았다.

## 원인: 요소마다 분산된 판정 로직

열기·닫기 코드는 두 곳에 있었다. 열기 쪽은 `MobileStatusBar.tsx`가 자신의 `div`에서 `onPointerDown`·`onPointerMove`·`onPointerUp`을 받아 거리를 측정했다. 닫기 쪽은 `ControlCenter.tsx`가 패널에서 `onPointerDown`으로 시작점을 기록하고 `onPointerUp`에서 거리만 확인했다.

```ts
// 전: ControlCenter.tsx
onPointerUp={(event) => {
	const start = startY.current;
	startY.current = null;
	if (start !== null && start - event.clientY >= PULL_OPEN_PX) close();
}}
```

| 증상                           | 원인                                                                       |
| ------------------------------ | -------------------------------------------------------------------------- |
| 열기 영역이 좁다               | 처리기가 상태 표시줄 요소에 있어서 그 밖에서 시작한 터치를 수신하지 못한다 |
| 닫을 때 패널이 움직이지 않는다 | 이동 중 이벤트를 수신하지 않는다                                           |
| 음량 막대가 제어 센터를 닫는다 | 시작 요소를 확인하지 않아 음량 막대 끌기도 닫기로 판정한다                 |

세 증상 모두 =="판정 로직을 개별 요소에 연결해 둔 구조"==가 원인이었다. 예를 들어 화면 가운데(y = 400px)에서 아래로 쓸면, 터치 이벤트의 대상은 그 위치의 앱 아이콘이고 상태 표시줄 `div`는 이벤트 경로에 없다. 상태 표시줄의 처리기는 호출되지 않는다.

## 검토한 방법

| 방법                                                           | 장점                     | 단점                                                                          |
| -------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| 상태 표시줄 확대 (44px → 120px)                                | 코드 변경이 거의 없다    | 투명한 영역이 화면 상단을 덮어 그 아래 앱 버튼이 클릭되지 않는다              |
| 문서 전체에서 Pointer Events만 수신                            | 마우스로 확인하기 쉽다   | 휴대폰 브라우저가 스크롤로 처리하는 순간 `pointercancel` 이후 이벤트가 끊긴다 |
| 문서 전체, 마우스는 Pointer · 손가락은 Touch Events (**채택**) | 손가락을 끝까지 추적한다 | 두 경로를 함께 관리해야 한다. 시험에도 실제 터치 이벤트가 필요하다            |

세 번째 방법을 채택했다. 판정 규칙은 React와 무관한 순수 함수(`swipe.ts`)로, 이벤트 수신은 훅(`useVerticalSwipe.ts`)으로 분리했다. 열기 쪽(`MobileShell.tsx`, 방향 `down`)과 닫기 쪽(`ControlCenter.tsx`, 방향 `up`)이 같은 훅을 사용한다.

![문서 캡처 단계에서 손가락을 받아 canStartSwipe → classifyMove → onMove/onEnd로 흐르고, 끝난 뒤 click 하나를 버린다](./images/control-center-swipe-flow.svg '여는 쪽과 닫는 쪽이 같은 훅을 방향만 바꿔 쓴다')

![제어 센터를 끌어내리는 중과 열린 모습](./images/control-center-swipe.jpg '쓰는 동안 패널이 손가락을 따라 내려오고, 60px 넘게 쓸고 손을 떼면 열린다')

## 문서 전체에서 캡처 단계로 수신

상태 표시줄 요소 하나가 아니라 `document`에서 이벤트를 수신한다. 캡처 단계에서 수신해야 음량 막대처럼 `setPointerCapture`로 이벤트를 고정하거나 전파를 중단하는 요소가 있어도 누락하지 않는다. `setPointerCapture`는 이후의 포인터 이벤트를 포인터 위치와 관계없이 지정한 요소로 보내는 기능으로, 막대를 끌다가 손가락이 막대 밖으로 나가도 막대가 계속 이벤트를 받게 한다.

```ts
document.addEventListener('pointerdown', pointerDown, { capture: true });
document.addEventListener('touchmove', touchMove, { capture: true, passive: false });
```

대신 스와이프를 시작하면 안 되는 요소를 먼저 필터링한다. 자체 끌기 동작이 있는 요소들이다.

| 선택자                                                    | 해당 요소                           |
| --------------------------------------------------------- | ----------------------------------- |
| `input`, `textarea`, `select`, `[contenteditable="true"]` | 입력 칸                             |
| `[role="slider"]`                                         | 음량·밝기·재생 위치 막대            |
| `[draggable="true"]`                                      | 끌어 옮기기 대상                    |
| `.home-indicator`                                         | 앱 전환기를 여는 하단 홈 인디케이터 |
| `[data-swipe-ignore]`                                     | 개별적으로 제외한 요소              |

터치를 시작한 요소에서 `closest()`로 위 선택자 가운데 하나라도 찾으면 그 터치는 스와이프로 판정하지 않는다. 이전에는 음량 막대를 위로 끌면 제어 센터까지 함께 닫혔다.

## 스크롤 우선

앱 안에서는 같은 손가락 동작이 스크롤일 수 있다. 글 목록을 읽다가 위로 돌아가려고 아래로 스와이프했는데 제어 센터가 열리면 안 된다. 그래서 터치한 요소에서 상위 요소로 올라가며 스크롤 가능한 컨테이너를 찾고, 해당 방향으로 스크롤할 내용이 남아 있으면 스크롤을 우선한다.

스크롤 컨테이너의 상태는 세 값으로 확인한다. `scrollTop`은 위로 가려진 내용의 높이, `clientHeight`는 보이는 영역의 높이, `scrollHeight`는 내용 전체의 높이다. 예를 들어 내용 1,000px을 높이 600px 상자로 보여 주는 목록이 맨 위에 있으면 `scrollTop`은 0, 맨 아래까지 내렸으면 400이다.

```ts
direction === 'down'
	? box.scrollTop > 0 // 위로 올라갈 내용이 있다
	: box.scrollTop + box.clientHeight < box.scrollHeight - 1; // 아래로 내려갈 내용이 있다
```

![목록이 맨 위(scrollTop 0)이면 아래로 쓸 때 제어 센터가 열리고, 내용을 내려 둔 상태(scrollTop 320)이면 같은 동작이 스크롤이 된다](./images/control-center-swipe-scroll-first.svg '왼쪽은 위로 올라갈 내용이 없어 제어 센터가 열린다. 오른쪽은 위로 320px을 더 올릴 수 있어 스크롤이 먼저다')

`- 1`은 소수점 픽셀 오차를 허용하는 값이다. 고해상도 화면에서는 `scrollTop`이 399.5처럼 소수가 되어, 맨 아래에 도달해도 `scrollTop + clientHeight`가 `scrollHeight`보다 1px 미만 작을 수 있다. 스크롤 위치가 맨 위일 때만 아래로 스와이프해 제어 센터를 연다. iOS에서 목록 맨 위에서 당기면 새로 고침이 실행되는 동작과 같은 조건이다.

## 탭과 스와이프 구분

터치 시작과 동시에 스와이프로 판정하면 버튼을 누를 때마다 패널이 조금씩 움직인다. 손가락은 버튼을 누르는 동안에도 몇 픽셀씩 흔들리기 때문이다. 8px 이동할 때까지는 판정을 보류하고, 이후 지정한 세로 방향으로 이동했을 때만 스와이프로 판정한다. 가로로 이동했거나 반대 방향이면 해당 터치는 처리하지 않는다.

| 이동 조건                  | 판정                    | 예 (`direction: 'down'`)   |
| -------------------------- | ----------------------- | -------------------------- |
| 이동 거리 8px 미만         | `undecided` (판정 보류) | `dx = 3`, `dy = 5` (5.8px) |
| 가로 이동이 세로 이동 이상 | `other`                 | `dx = 30`, `dy = 10`       |
| 세로 이동이 크고 지정 방향 | `swipe`                 | `dx = 2`, `dy = 12`        |
| 세로 이동이 크고 반대 방향 | `other`                 | `dx = 2`, `dy = -12`       |

```ts
// apps/react/src/desktop/mobile/swipe.ts
export const DECIDE_PX = 8;
export function classifyMove(dx: number, dy: number, direction: SwipeDirection) {
	if (Math.hypot(dx, dy) < DECIDE_PX) return 'undecided';
	if (Math.abs(dy) <= Math.abs(dx)) return 'other';
	return (direction === 'down' ? dy > 0 : dy < 0) ? 'swipe' : 'other';
}
```

`Math.hypot(dx, dy)`는 `√(dx² + dy²)`, 즉 시작점에서 현재 위치까지의 직선 거리다. `dy`와 `dx`가 같을 때(정확히 45도)는 `other`다. 대각선 이동은 가로 스와이프(사진 넘기기, 홈 화면 페이지 넘기기)일 수 있어서, 세로 방향이 명확할 때만 스와이프로 판정한다.

![손가락 움직임을 쓸기로 판단하는 과정](./images/swipe-decision.svg '판단은 순수 함수(swipe.ts)로 빼서 단위 테스트한다')

## 손가락을 따라 움직이는 패널

스와이프 중에는 `onMove`가 이동 거리를 계속 전달한다. 패널의 표시 비율(`progress`, 0~1)은 그 거리로 계산한다. 0이면 패널이 화면 위로 완전히 숨어 있고, 1이면 완전히 내려온 상태다.

```ts
// ControlCenter.tsx
const travel = (distance: number) => Math.min(1, distance / (PULL_OPEN_PX * 4));
const progress = leaving
	? 0
	: pull !== null
		? travel(pull)
		: lift !== null
			? 1 - travel(lift)
			: open && entered
				? 1
				: 0;
```

| 값                              | 크기  | 의미                                                  |
| ------------------------------- | ----- | ----------------------------------------------------- |
| 판정 시작 거리 (`DECIDE_PX`)    | 8px   | 이 거리 전에는 탭인지 스와이프인지 판정하지 않는다    |
| 열기 판정 거리 (`PULL_OPEN_PX`) | 60px  | 손을 뗀 시각에 이 거리 이상이면 열린다                |
| 패널 전체 이동 거리             | 240px | `PULL_OPEN_PX × 4`. 이 거리에서 `progress`가 1이 된다 |

![쓴 거리 0~240px이 progress 0~1로 비례하고, 60px에서 0.25, 240px 이후는 1로 고정된다](./images/control-center-swipe-progress.svg '60px 이상 쓸고 손을 떼면 열리고, 그보다 짧으면 다시 닫힌다')

예를 들어 120px을 쓸면 `progress`는 `120 / 240 = 0.5`로 패널이 절반 내려온다. 60px만 스와이프해도 열리지만, 그 시각에 패널은 4분의 1만 표시된다. 손을 떼면 남은 거리는 CSS 트랜지션(속성 값이 바뀌면 지정한 시간 동안 중간 값을 거쳐 변하게 하는 CSS 기능)으로 이어서 내려온다. 4배는 상태 표시줄 끌기 구현부터 사용하던 값을 유지했다. 판정 거리와 같게 두면 60px 안에 패널이 끝까지 내려와 손가락보다 훨씬 빠르게 움직인다.

이번 변경점은 닫는 동작도 같은 계산식(`1 - travel(lift)`)으로 패널이 손가락을 따라 올라간다는 점이다. 위로 60px을 쓸면 `1 - 0.25 = 0.75`가 된다. 스와이프 중에는 `dragging` 클래스로 CSS 트랜지션을 끄고, 손을 떼면 다시 켠다. 트랜지션이 켜진 채로 매 `touchmove`마다 값이 바뀌면 패널이 손가락보다 늦게 따라온다.

> [!NOTE] 스와이프 뒤의 click
> 스와이프 직후에는 click 이벤트가 이어서 발생한다. 연락하기 타일 위에서 위로 스와이프해 제어 센터를 닫았는데 메일 앱이 열리면 안 되므로, 스와이프 종료 후 500ms(`CLICK_AFTER_SWIPE_MS`) 안의 click 하나는 캡처 단계에서 무시한다.

## 손가락 입력은 Touch Events로

마우스로는 Pointer Events만으로 정상 동작했다. 휴대폰에서는 달랐다. 브라우저가 손가락 이동을 스크롤로 처리하는 순간 [`pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)이 발생하고, ==그 이후로는 이동 이벤트가 전달되지 않는다==. 브라우저 입장에서는 그 손가락이 더 이상 페이지의 포인터가 아니라 스크롤 조작이기 때문이다.

그래서 손가락 입력은 [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)로 수신한다. Touch Events는 브라우저가 스크롤을 시작해도 `touchmove`를 계속 전달하고, 처리기에서 `preventDefault()`를 호출하면 스크롤 자체를 막을 수 있다.

![Pointer Events는 브라우저 스크롤 시작 시 pointercancel 뒤로 끊기고, Touch Events는 swipe 판정 후 preventDefault로 스크롤을 막아 touchend까지 이어진다](./images/control-center-swipe-pointercancel.svg '같은 손가락 동작에서 두 이벤트 종류가 전달되는 범위')

> [!WARNING]
> `touchmove`는 `passive: false`로 등록해야 `preventDefault()`로 스크롤을 막을 수 있다. Safari를 제외한 브라우저(Chrome, Firefox 등)는 `window`·`document`·`body`에 등록한 `touchmove` 처리기를 기본으로 `passive: true`로 취급해, 명시하지 않으면 `preventDefault()`가 무시된다.

스크롤을 막는 것은 스와이프로 판정한 이후부터다. 판정 전에는 스크롤과 가로 스와이프를 그대로 허용한다.

```ts
const touchMove = (event: TouchEvent) => {
	const touch = event.touches[0];
	if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
};
```

`event.cancelable`은 이 이벤트를 아직 막을 수 있는지를 나타낸다. 브라우저가 이미 스크롤을 시작한 뒤의 `touchmove`는 `cancelable`이 `false`라 `preventDefault()`를 호출해도 스크롤이 멈추지 않고, Chrome은 콘솔에 경고를 남긴다.

## 실제 터치 이벤트로 시험

Playwright의 `page.touchscreen`은 탭(`tap`)만 지원하고 끌기가 없다. `page.mouse`로 끌면 Pointer Events 경로만 확인된다. Chromium DevTools 프로토콜(CDP, 개발자 도구가 브라우저를 제어하는 데 쓰는 명령 체계)의 [`Input.dispatchTouchEvent`](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchTouchEvent)로 실제 터치 이벤트를 보내 손가락 경로도 시험했다.

```ts
const cdp = await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: fromY }] });
// touchMove를 여러 번
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
```

홈 화면 가운데에서 열기, 타일 위에서 위로 스와이프해 닫기(타일은 클릭되지 않음), 앱 안에서는 맨 위에서만 열리기, 음량 막대를 올려도 닫히지 않기를 iPhone과 Android 크기에서 모두 확인한다.

## 확인

<details>
<summary>단위 시험 7개 (`apps/react/src/desktop/mobile/swipe.test.ts`)</summary>

- "조금 움직였으면 아직 모른다 (누르기일 수 있다)"
- "정한 방향으로 세로로 쓸면 swipe"
- "가로로 움직이거나 반대 방향이면 other"
- "맨 위에서 아래로 쓸면 제어 센터 (스크롤할 게 없다)"
- "내용을 내려 둔 상태에서 아래로 쓸면 스크롤이 먼저"
- "위로 쓸 때는 아래로 더 내려갈 내용이 있으면 스크롤이 먼저"
- "스크롤되지 않는 상자는 상관없다"

</details>

판정을 DOM에서 분리해 두어, 시험에서는 `{ scrollTop: 0, scrollHeight: 1000, clientHeight: 600, overflowY: 'auto' }` 같은 `ScrollBox` 형태의 객체만 전달한다.

E2E `apps/react/e2e/mobile.spec.ts`에 4개를 추가했다.

| E2E 시험                                                                     | 입력 방식       |
| ---------------------------------------------------------------------------- | --------------- |
| 화면 어디서든 아래로 쓸면 제어 센터가 열리고, 타일 위에서 위로 쓸어도 닫힌다 | 포인터          |
| 앱 안에서도 아래로 쓸면 열리고, 내용을 내려 둔 곳에서는 스크롤이 먼저다      | 포인터          |
| 음량 막대를 위로 끌면 음량만 바뀌고 제어 센터는 닫히지 않는다                | 포인터          |
| 손가락으로 쓸어도 열고 닫힌다 (터치 이벤트)                                  | CDP 터치 이벤트 |

변경 규모는 파일 7개, +362/−63줄이다. `MobileStatusBar.tsx`는 49줄 중 대부분이 삭제됐다. 끌기 코드가 훅으로 이동하고 상태 표시줄에는 탭하면 여는 기능만 남았다.

## 남은 과제

- 거리 기준은 px 고정값이다. 화면이 큰 태블릿에서는 60px이 상대적으로 짧다. 현재는 휴대폰 크기에서만 휴대폰 화면을 사용하므로 그대로 두었다.
- 손가락 두 개가 닿으면(`touches.length !== 1`) 즉시 취소한다. 확대(핀치) 동작과 충돌하지 않게 하기 위해서다.
- 사진 앱에도 같은 이름의 `apps/photos/swipe.ts` 파일이 있다. 그쪽은 가로 스와이프라 규칙이 다르다. 두 모듈의 통합 여부는 사용처가 하나 더 생기면 결정한다.

> [!IMPORTANT]
> 휴대폰 제스처는 마우스로 확인한 결과만으로 판단할 수 없다. Pointer Events가 데스크톱에서 정상 동작해도, 휴대폰 브라우저는 스크롤로 처리하는 순간 터치 추적을 중단한다. 실제 터치 이벤트를 보내는 시험이 있어야 이 차이를 검출할 수 있다. 또 판정을 순수 함수로 분리해 두면 "45도는 어느 쪽인가" 같은 경계 조건을 단위 시험으로 적은 비용에 고정할 수 있다.

## 관련 글

- [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)
- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [별도 목록 없이 프로젝트 데이터를 순회해 생성하는 사진 앨범](/memo/photos-app)

<details>
<summary>참고 문헌</summary>

- Apple, [Use and customize Control Center on iPhone](https://support.apple.com/guide/iphone/use-and-customize-control-center-iph59095ec58/ios)
- MDN, [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- MDN, [Element: pointercancel event](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)
- MDN, [Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- MDN, [EventTarget.addEventListener(): passive, Improving scroll performance using passive listeners](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#using_passive_listeners)
- MDN, [Element.setPointerCapture()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- MDN, [Element.scrollTop](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop)
- Chrome DevTools Protocol, [Input.dispatchTouchEvent](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchTouchEvent)

</details>

<details>
<summary>사진 출처</summary>

- iPhone 제어 센터 화면: Apple, [iPhone User Guide: Use and customize Control Center on iPhone](https://support.apple.com/guide/iphone/use-and-customize-control-center-iph59095ec58/ios), 출처 표기 (JPEG로 변환하고 폭을 줄임)

</details>

#MacFolio #휴대폰 #제스처
