---
title: 휴대폰 화면 1 - 캡처 단계 리스너와 Touch Events로 구현한 전체 화면 스와이프 판정
date: 2026-09-29
category: 개발 기록/MacFolio/프론트엔드
summary: 상태 표시줄 44px 영역에서만 열리던 휴대폰 제어 센터를 화면 어디서든 스와이프로 열고 닫게 했다. 문서 전체에서 캡처 단계로 이벤트를 수신하고, 스크롤할 내용이 남은 영역에서는 스크롤을 우선하고, 손가락 입력은 Touch Events로 받아 패널이 손가락을 따라 움직이게 했다.
---

휴대폰 화면에서는 위쪽에서 아래로 스와이프하면 iOS처럼 제어 센터가 내려온다. 처음에는 맨 위 상태 표시줄(44px)을 끌 때만 열렸고, 닫을 때는 손을 뗀 시각에만 판정해서 패널이 손가락을 따라 움직이지 않았다. 화면 어디서든 스와이프로 열고 닫도록 바꾸면서 고려할 조건이 여러 가지 있었다. PR은 [#39](https://github.com/hyeoniverse/MacFolio/pull/39)다.

## 문제: 실제 휴대폰에서 발견한 세 가지

1. **열기 영역이 좁다.** 상태 표시줄은 44px이다. 엄지로 화면 상단 끝을 정확히 터치해야 했고, 조금만 아래에서 시작하면 동작하지 않았다. iOS는 오른쪽 위 모서리에서 스와이프해야 하지만, 이 사이트는 데스크톱 재현이 목적이라 "어디서든 아래로 스와이프하면 열린다"가 더 적합했다.
2. **닫을 때 패널이 움직이지 않는다.** 위로 스와이프해 닫으면 손을 떼는 시각에야 판정했다. 손가락이 움직이는 동안 패널은 고정되어 있어, 닫힐지 여부를 손을 떼기 전에는 알 수 없었다.
3. **음량 막대 조작이 제어 센터를 닫는다.** 음량을 올리려고 막대를 위로 끌면, 패널의 `onPointerUp`이 "위로 60px 이상 이동"으로 판정해 제어 센터를 닫았다.

## 원인: 판정 로직이 요소마다 분산되어 있었다

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

세 증상 모두 "판정 로직을 개별 요소에 연결해 둔 구조"가 원인이었다.

## 검토한 방법

| 방법                                                           | 장점                     | 단점                                                                          |
| -------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| 상태 표시줄 확대 (44px → 120px)                                | 코드 변경이 거의 없다    | 투명한 영역이 화면 상단을 덮어 그 아래 앱 버튼이 클릭되지 않는다              |
| 문서 전체에서 Pointer Events만 수신                            | 마우스로 확인하기 쉽다   | 휴대폰 브라우저가 스크롤로 처리하는 순간 `pointercancel` 이후 이벤트가 끊긴다 |
| 문서 전체, 마우스는 Pointer · 손가락은 Touch Events (**채택**) | 손가락을 끝까지 추적한다 | 두 경로를 함께 관리해야 한다. 시험에도 실제 터치 이벤트가 필요하다            |

세 번째 방법을 채택했다. 판정 규칙은 React와 무관한 순수 함수(`swipe.ts`)로, 이벤트 수신은 훅(`useVerticalSwipe.ts`)으로 분리했다. 열기 쪽(`MobileShell.tsx`, 방향 `down`)과 닫기 쪽(`ControlCenter.tsx`, 방향 `up`)이 같은 훅을 사용한다.

![문서 캡처 단계에서 손가락을 받아 canStartSwipe → classifyMove → onMove/onEnd로 흐르고, 끝난 뒤 click 하나를 버린다](./images/control-center-swipe-flow.svg '여는 쪽과 닫는 쪽이 같은 훅을 방향만 바꿔 쓴다')

![제어 센터를 끌어내리는 중과 열린 모습](./images/control-center-swipe.jpg '쓰는 동안 패널이 손가락을 따라 내려오고, 60px 넘게 쓸고 손을 떼면 열린다')

## 문서 전체에서 수신

상태 표시줄 요소 하나가 아니라 문서 전체에서 이벤트를 수신한다. 캡처 단계에서 수신해야 음량 막대처럼 `setPointerCapture`로 이벤트를 고정하거나 전파를 중단하는 요소가 있어도 누락하지 않는다.

```ts
document.addEventListener('pointerdown', pointerDown, { capture: true });
document.addEventListener('touchmove', touchMove, { capture: true, passive: false });
```

대신 스와이프를 시작하면 안 되는 요소를 먼저 필터링한다. 자체 끌기 동작이 있는 요소(음량·재생 위치 막대, 입력 칸, 끌어 옮기기 대상, 앱 전환기를 여는 홈 인디케이터)다. 이전에는 음량 막대를 위로 끌면 제어 센터까지 함께 닫혔다.

## 스크롤 우선

앱 안에서는 같은 손가락 동작이 스크롤일 수 있다. 글을 읽다가 위로 돌아가려고 아래로 스와이프했는데 제어 센터가 열리면 안 된다. 그래서 터치한 요소에서 상위 요소로 올라가며 스크롤 가능한 컨테이너를 찾고, 해당 방향으로 스크롤할 내용이 남아 있으면 스크롤을 우선한다.

```ts
direction === 'down'
	? box.scrollTop > 0 // 위로 올라갈 내용이 있다
	: box.scrollTop + box.clientHeight < box.scrollHeight - 1; // 아래로 내려갈 내용이 있다
```

스크롤 위치가 맨 위일 때만 아래로 스와이프해 제어 센터를 연다. iOS에서 목록 맨 위에서 당기면 새로 고침이 실행되는 동작과 유사하다.

## 탭과 스와이프 구분

터치 시작과 동시에 스와이프로 판정하면 버튼을 누를 때마다 패널이 조금씩 움직인다. 8px 이동할 때까지는 판정을 보류하고, 이후 지정한 세로 방향으로 이동했을 때만 스와이프로 판정한다. 가로로 이동했거나 반대 방향이면 해당 터치는 처리하지 않는다.

| 이동 조건                  | 판정                    |
| -------------------------- | ----------------------- |
| 이동 거리 8px 미만         | `undecided` (판정 보류) |
| 가로 이동이 세로 이동 이상 | `other`                 |
| 세로 이동이 크고 지정 방향 | `swipe`                 |
| 세로 이동이 크고 반대 방향 | `other`                 |

```ts
// apps/react/src/desktop/mobile/swipe.ts
export const DECIDE_PX = 8;
export function classifyMove(dx: number, dy: number, direction: SwipeDirection) {
	if (Math.hypot(dx, dy) < DECIDE_PX) return 'undecided';
	if (Math.abs(dy) <= Math.abs(dx)) return 'other';
	return (direction === 'down' ? dy > 0 : dy < 0) ? 'swipe' : 'other';
}
```

`dy`와 `dx`가 같을 때(정확히 45도)는 `other`다. 대각선 이동은 가로 스와이프(사진 넘기기, 홈 화면 페이지 넘기기)일 수 있어서, 세로 방향이 명확할 때만 스와이프로 판정한다.

![손가락 움직임을 쓸기로 판단하는 과정](./images/swipe-decision.svg '판단은 순수 함수(swipe.ts)로 빼서 단위 테스트한다')

## 패널이 손가락을 따라 움직이게

스와이프 중에는 `onMove`가 이동 거리를 계속 전달한다. 패널의 표시 비율(`progress`, 0~1)은 그 거리로 계산한다.

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

60px만 스와이프해도 열리지만, 그 시각에 패널은 4분의 1만 표시된다. 손을 떼면 남은 거리는 CSS 트랜지션으로 이어서 내려온다. 4배는 상태 표시줄 끌기 구현부터 사용하던 값을 유지했다. 판정 거리와 같게 두면 60px 안에 패널이 끝까지 내려와 손가락보다 훨씬 빠르게 움직인다. 이번 변경점은 닫을 때도 같은 계산식(`1 - travel(lift)`)으로 패널이 손가락을 따라 올라간다는 점이다. 스와이프 중에는 `dragging` 클래스로 CSS 트랜지션을 끄고, 손을 떼면 다시 켠다.

스와이프 직후에는 click 이벤트가 이어서 발생한다. 연락하기 타일 위에서 위로 스와이프해 제어 센터를 닫았는데 메일 앱이 열리면 안 되므로, 스와이프 종료 후 500ms(`CLICK_AFTER_SWIPE_MS`) 안의 click 하나는 캡처 단계에서 무시한다.

## 손가락 입력은 Touch Events로

마우스로 확인할 때는 Pointer Events만으로 정상 동작했다. 휴대폰에서는 달랐다. 브라우저가 손가락 이동을 스크롤로 처리하는 순간 [`pointercancel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)이 발생하고, 그 이후로는 이동 이벤트가 전달되지 않는다.

그래서 손가락 입력은 [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)로 수신한다. `touchmove`는 `passive: false`로 등록해야 `preventDefault()`로 스크롤을 막을 수 있다. 스크롤을 막는 것은 스와이프로 판정한 이후부터다. 판정 전에는 스크롤과 가로 스와이프를 그대로 허용한다.

```ts
const touchMove = (event: TouchEvent) => {
	const touch = event.touches[0];
	if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
};
```

## 실제 터치 이벤트로 시험

Playwright의 `page.touchscreen`은 탭(`tap`)만 지원하고 끌기가 없다. `page.mouse`로 끌면 Pointer Events 경로만 확인된다. Chromium DevTools 프로토콜의 [`Input.dispatchTouchEvent`](https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchTouchEvent)로 실제 터치 이벤트를 보내 손가락 경로도 시험했다.

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

판정을 DOM에서 분리해 두어, 시험에서는 `ScrollBox` 형태의 객체만 전달한다.

E2E `apps/react/e2e/mobile.spec.ts`에 4개를 추가했다.

| E2E 시험                                                                     | 입력 방식       |
| ---------------------------------------------------------------------------- | --------------- |
| 화면 어디서든 아래로 쓸면 제어 센터가 열리고, 타일 위에서 위로 쓸어도 닫힌다 | 포인터          |
| 앱 안에서도 아래로 쓸면 열리고, 내용을 내려 둔 곳에서는 스크롤이 먼저다      | 포인터          |
| 음량 막대를 위로 끌면 음량만 바뀌고 제어 센터는 닫히지 않는다                | 포인터          |
| 손가락으로 쓸어도 열고 닫힌다 (터치 이벤트)                                  | CDP 터치 이벤트 |

변경 규모는 파일 7개, +362/−63줄이다. `MobileStatusBar.tsx`는 49줄 중 대부분이 삭제됐다. 끌기 코드가 훅으로 이동하고 상태 표시줄에는 탭하면 여는 기능만 남았다.

## 남은 과제와 정리

- 거리 기준은 px 고정값이다. 화면이 큰 태블릿에서는 60px이 상대적으로 짧다. 현재는 휴대폰 크기에서만 휴대폰 화면을 사용하므로 그대로 두었다.
- 손가락 두 개가 닿으면(`touches.length !== 1`) 즉시 취소한다. 확대(핀치) 동작과 충돌하지 않게 하기 위해서다.
- 사진 앱에도 같은 이름의 `apps/photos/swipe.ts` 파일이 있다. 그쪽은 가로 스와이프라 규칙이 다르다. 두 모듈의 통합 여부는 사용처가 하나 더 생기면 결정한다.

휴대폰 제스처는 마우스로 확인한 결과만으로 판단할 수 없다. Pointer Events가 데스크톱에서 정상 동작해도, 휴대폰 브라우저는 스크롤로 처리하는 순간 터치 추적을 중단한다. 실제 터치 이벤트를 보내는 시험이 있어야 이 차이를 검출할 수 있다. 또 판정을 순수 함수로 분리해 두면 "45도는 어느 쪽인가" 같은 경계 조건을 단위 시험으로 적은 비용에 고정할 수 있다.

## 관련 글

- [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)
- [E2E 시험 2 - Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [별도 목록 없이 프로젝트 데이터를 순회해 생성하는 사진 앨범](/memo/photos-app)

#MacFolio #휴대폰 #제스처
