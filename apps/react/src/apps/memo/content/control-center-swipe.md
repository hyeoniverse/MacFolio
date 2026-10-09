---
title: 화면 어디서나 쓸어서 제어 센터 열기
date: 2026-09-29
category: 프론트엔드/모바일
summary: 상태 표시줄에서만 열리던 제어 센터를 화면 어디서든 쓸어서 여닫게 했다. 스크롤과 싸우지 않으면서 손가락을 따라오게 하기.
---

휴대폰 화면에서는 위쪽을 아래로 쓸면 iOS처럼 제어 센터가 내려온다. 처음에는 맨 위 상태 표시줄(44px)을 끌 때만 열렸고, 닫을 때는 손을 뗀 순간에만 판단해서 패널이 손가락을 따라오지 않았다. 화면 어디서든 쓸어서 여닫게 바꾸면서 생각할 것이 꽤 많았다.

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

![손가락 움직임을 쓸기로 판단하는 과정](./images/swipe-decision.svg '판단은 순수 함수(swipe.ts)로 빼서 단위 테스트한다')

쓸고 난 직후에는 click이 따라온다. 연락하기 타일 위에서 위로 쓸어 제어 센터를 닫았는데 메일 앱이 열리면 안 되므로, 쓸기가 끝난 직후의 click 하나는 캡처 단계에서 버린다.

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

#MacFolio #휴대폰 #제스처
