---
title: 화면 어디서나 쓸어서 제어 센터 열기
date: 2026-09-29
category: 개발기/MacFolio/프론트엔드
summary: 상태 표시줄 44px에서만 열리던 휴대폰 제어 센터를 화면 어디서든 쓸어서 여닫게 했다. 문서 전체를 캡처 단계에서 듣고, 스크롤할 내용이 남은 곳에서는 양보하고, 손가락은 Touch Events로 받아 패널이 손가락을 따라오게 했다.
---

휴대폰 화면에서는 위쪽을 아래로 쓸면 iOS처럼 제어 센터가 내려온다. 처음에는 맨 위 상태 표시줄(44px)을 끌 때만 열렸고, 닫을 때는 손을 뗀 순간에만 판단해서 패널이 손가락을 따라오지 않았다. 화면 어디서든 쓸어서 여닫게 바꾸면서 생각할 것이 꽤 많았다. PR은 [#39](https://github.com/hyeoniverse/MacFolio/pull/39)다.

## 배경: 어디가 불편했나

실제 휴대폰에서 써 보니 세 가지가 걸렸다.

1. **여는 자리가 좁다.** 상태 표시줄은 44px이다. 엄지로 화면 위 끝을 정확히 잡아야 했고, 조금만 아래에서 시작하면 아무 일도 없었다. iOS는 오른쪽 위 모서리에서 쓸어야 하지만, 이 사이트는 데스크톱 흉내가 목적이라 "어디서든 아래로 쓸면 열린다"가 더 맞았다.
2. **닫을 때 패널이 가만히 있다.** 위로 쓸어 닫으면 손을 떼는 순간에야 판단했다. 손가락이 움직이는 동안 패널은 그대로라, 닫히는지 아닌지 손을 떼기 전에는 알 수 없었다.
3. **음량 막대가 제어 센터를 닫는다.** 음량을 올리려고 막대를 위로 끌면, 패널의 `onPointerUp`이 "위로 60px 넘게 움직였다"로 읽고 제어 센터를 닫았다.

## 원인: 판단이 요소마다 흩어져 있었다

여닫기 코드는 두 곳에 있었다. 여는 쪽은 `MobileStatusBar.tsx`가 자기 `div`에서 `onPointerDown`·`onPointerMove`·`onPointerUp`을 받아 거리를 쟀다. 닫는 쪽은 `ControlCenter.tsx`가 패널에서 `onPointerDown`으로 시작점을 적고 `onPointerUp`에서 거리만 봤다.

```ts
// 전: ControlCenter.tsx
onPointerUp={(event) => {
	const start = startY.current;
	startY.current = null;
	if (start !== null && start - event.clientY >= PULL_OPEN_PX) close();
}}
```

여는 쪽은 상태 표시줄 요소에 붙어 있어서 그 밖에서 시작한 손가락은 듣지 못했다. 닫는 쪽은 움직이는 중을 듣지 않아서 패널이 따라오지 않았고, 시작한 요소가 무엇인지 보지 않아서 음량 막대의 끌기도 닫기로 셌다. 세 증상이 모두 "판단을 요소에 붙여 둔 것"에서 나왔다.

## 고른 방법

| 방법                                                | 좋은 점                  | 나쁜 점                                                             |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| 상태 표시줄을 키운다 (44px → 120px)                 | 코드가 거의 안 바뀐다    | 투명한 판이 화면 위를 덮어 그 아래 앱 버튼이 안 눌린다              |
| 문서 전체에서 Pointer Events만 듣는다               | 마우스로 확인하기 쉽다   | 휴대폰에서 브라우저가 스크롤로 가져가면 `pointercancel` 뒤로 끊긴다 |
| 문서 전체, 마우스는 Pointer · 손가락은 Touch Events | 손가락을 끝까지 따라간다 | 두 경로를 같이 관리해야 한다. 시험도 실제 터치가 필요하다           |

셋째를 골랐다. 판단 규칙은 React와 상관없는 순수 함수(`swipe.ts`)로, 이벤트 듣기는 훅(`useVerticalSwipe.ts`)으로 나눴다. 여는 쪽(`MobileShell.tsx`, 방향 `down`)과 닫는 쪽(`ControlCenter.tsx`, 방향 `up`)이 같은 훅을 쓴다.

![문서 캡처 단계에서 손가락을 받아 canStartSwipe → classifyMove → onMove/onEnd로 흐르고, 끝난 뒤 click 하나를 버린다](./images/control-center-swipe-flow.svg '여는 쪽과 닫는 쪽이 같은 훅을 방향만 바꿔 쓴다')

![제어 센터를 끌어내리는 중과 열린 모습](./images/control-center-swipe.jpg '쓰는 동안 패널이 손가락을 따라 내려오고, 60px 넘게 쓸고 손을 떼면 열린다')

## 어디서 시작해도 듣기

상태 표시줄 한 요소가 아니라 문서 전체에서 듣는다. 캡처 단계에서 들어야 한다. 음량 막대처럼 `setPointerCapture`로 이벤트를 붙잡거나 전파를 멈추는 요소가 있어도 놓치지 않는다.

```ts
document.addEventListener('pointerdown', pointerDown, { capture: true });
document.addEventListener('touchmove', touchMove, { capture: true, passive: false });
```

대신 시작하면 안 되는 곳을 먼저 거른다. 스스로 끄는 동작이 있는 요소(음량·재생 위치 막대, 입력 칸, 끌어 옮기기, 앱 전환기를 여는 홈 인디케이터)다. 전에는 음량 막대를 위로 끌면 제어 센터까지 같이 닫혔다.

## 스크롤과 싸우지 않기

앱 안에서는 같은 손가락이 스크롤일 수도 있다. 글을 내려 읽다가 위로 돌아가려고 아래로 쓸었는데 제어 센터가 열리면 안 된다. 그래서 누른 곳에서 바깥으로 올라가며 스크롤되는 상자를 찾고, 그 방향으로 스크롤할 내용이 남았으면 스크롤에 양보한다.

```ts
direction === 'down'
	? box.scrollTop > 0 // 위로 올라갈 내용이 있다
	: box.scrollTop + box.clientHeight < box.scrollHeight - 1; // 아래로 내려갈 내용이 있다
```

맨 위에 있을 때만 아래로 쓸어 제어 센터를 연다. iOS에서 목록 맨 위에서 당기면 새로 고침이 되는 것과 비슷한 감각이다.

## 누르기와 쓸기 구분하기

누르자마자 쓸기로 판단하면 버튼을 누를 때마다 패널이 움찔한다. 8px 움직일 때까지는 판단을 미루고, 그다음에 세로로 정한 방향으로 움직였을 때만 쓸기로 잡는다. 가로로 움직였거나 반대 방향이면 그 손가락은 놓아준다.

```ts
// apps/react/src/desktop/mobile/swipe.ts
export const DECIDE_PX = 8;
export function classifyMove(dx: number, dy: number, direction: SwipeDirection) {
	if (Math.hypot(dx, dy) < DECIDE_PX) return 'undecided';
	if (Math.abs(dy) <= Math.abs(dx)) return 'other';
	return (direction === 'down' ? dy > 0 : dy < 0) ? 'swipe' : 'other';
}
```

`dy`와 `dx`가 같을 때(정확히 45도)는 `other`다. 대각선은 가로 넘기기(사진 넘기기, 홈 화면 쪽 넘기기)일 수도 있어서 세로 쪽이 분명할 때만 잡는다.

![손가락 움직임을 쓸기로 판단하는 과정](./images/swipe-decision.svg '판단은 순수 함수(swipe.ts)로 빼서 단위 테스트한다')

## 패널이 손가락을 따라오게

쓰는 중에는 `onMove`가 거리를 계속 넘긴다. 패널의 보이는 정도(`progress`, 0~1)는 그 거리로 정한다.

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

여는 판단은 60px(`PULL_OPEN_PX`)이지만 패널이 다 내려오는 것은 240px이다. 60px만 쓸어도 열리지만, 그때 패널은 4분의 1만 보인다. 손을 떼면 남은 거리는 CSS 전환으로 마저 내려온다. 4배는 상태 표시줄 끌기 때부터 쓰던 값을 그대로 이었다. 판단 거리와 같게 두면 60px 안에 패널이 다 내려와 손가락보다 훨씬 빨리 움직인다. 이번에 바뀐 것은 닫을 때도 같은 식(`1 - travel(lift)`)으로 패널이 따라 올라간다는 점이다. 쓰는 동안은 `dragging` 클래스로 CSS 전환을 끄고, 손을 떼면 다시 켠다.

쓸고 난 직후에는 click이 따라온다. 연락하기 타일 위에서 위로 쓸어 제어 센터를 닫았는데 메일 앱이 열리면 안 되므로, 쓸기가 끝난 직후 500ms(`CLICK_AFTER_SWIPE_MS`) 안의 click 하나는 캡처 단계에서 버린다.

## 손가락은 Touch Events로

마우스로 확인할 때는 Pointer Events만으로 잘 됐다. 휴대폰에서는 달랐다. 브라우저가 손가락 움직임을 스크롤로 가져가는 순간 `pointercancel`이 오고, 그 뒤로는 움직임이 들어오지 않는다.

그래서 손가락은 Touch Events로 듣는다. `touchmove`는 `passive: false`로 등록해야 `preventDefault()`로 스크롤을 막을 수 있다. 막는 것은 쓸기로 판단한 뒤부터다. 판단하기 전에는 스크롤도 가로 넘기기도 그대로 둔다.

```ts
const touchMove = (event: TouchEvent) => {
	const touch = event.touches[0];
	if (touch && move(touch.clientX, touch.clientY) && event.cancelable) event.preventDefault();
};
```

## 실제 터치로 테스트하기

Playwright의 `page.touchscreen`은 누르기(`tap`)만 있고 끌기가 없다. `page.mouse`로 끌면 Pointer Events 쪽만 확인된다. Chromium DevTools 프로토콜로 실제 터치 이벤트를 보내 손가락 경로도 테스트했다.

```ts
const cdp = await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: fromY }] });
// touchMove를 여러 번
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
```

홈 화면 가운데에서 열기, 타일 위에서 위로 쓸어 닫기(타일은 눌리지 않음), 앱 안 맨 위에서만 열리기, 음량 막대를 올려도 닫히지 않기를 iPhone과 Android 크기에서 모두 확인한다.

## 확인

- 단위 시험 `apps/react/src/desktop/mobile/swipe.test.ts` 7개. "조금 움직였으면 아직 모른다 (누르기일 수 있다)", "정한 방향으로 세로로 쓸면 swipe", "가로로 움직이거나 반대 방향이면 other", "맨 위에서 아래로 쓸면 제어 센터 (스크롤할 게 없다)", "내용을 내려 둔 상태에서 아래로 쓸면 스크롤이 먼저", "위로 쓸 때는 아래로 더 내려갈 내용이 있으면 스크롤이 먼저", "스크롤되지 않는 상자는 상관없다". 판단을 DOM에서 떼어 둔 덕에 `ScrollBox` 모양의 객체만 넘겨 시험한다.
- E2E `apps/react/e2e/mobile.spec.ts`에 4개를 더했다. "화면 어디서든 아래로 쓸면 제어 센터가 열리고, 타일 위에서 위로 쓸어도 닫힌다", "앱 안에서도 아래로 쓸면 열리고, 내용을 내려 둔 곳에서는 스크롤이 먼저다", "음량 막대를 위로 끌면 음량만 바뀌고 제어 센터는 닫히지 않는다", "손가락으로 쓸어도 열고 닫힌다 (터치 이벤트)".
- 바뀐 크기: 파일 7개, +362/−63. `MobileStatusBar.tsx`는 49줄 가운데 대부분이 빠졌다. 끌기 코드가 훅으로 옮겨 가고 상태 표시줄은 누르면 여는 일만 남았다.

## 남은 것과 배운 것

- 거리 기준은 px로 고정이다. 화면이 큰 태블릿에서는 60px이 상대적으로 짧다. 지금은 휴대폰 크기만 휴대폰 화면을 쓰므로 그대로 두었다.
- 손가락 두 개가 닿으면(`touches.length !== 1`) 바로 취소한다. 확대 동작과 섞이지 않게 하려는 것이다.
- 사진 앱에도 `apps/photos/swipe.ts`라는 이름이 같은 파일이 있다. 그쪽은 가로 넘기기라 규칙이 다르다. 나중에 둘을 묶을지는 쓰임이 하나 더 생기면 정한다.

배운 것: 휴대폰 제스처는 마우스로 확인한 것을 믿으면 안 된다. Pointer Events가 데스크톱에서 완벽하게 돌아도, 휴대폰 브라우저는 스크롤을 가져가는 순간 손가락을 끊는다. 실제 터치를 보내는 시험이 있어야 이 차이를 잡는다. 또 판단을 순수 함수로 빼 두면 "45도는 어느 쪽인가" 같은 경계를 단위 시험으로 싸게 고정할 수 있다.

관련 글: [휴대폰 앱을 iOS처럼](/memo/mobile-apps-ios-style), [Playwright로 휴대폰과 움직임 시험하기](/memo/playwright-mobile-and-motion), [사진 앱](/memo/photos-app).

#MacFolio #휴대폰 #제스처
