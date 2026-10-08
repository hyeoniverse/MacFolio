---
title: 누를 때마다 딸깍 - Web Audio로 클릭 소리 내기
date: 2026-10-01
category: 개발기/MacFolio/데스크톱
summary: 어디를 누르든 누를 때와 뗄 때 딸깍 소리가 나게 했다. <audio> 대신 Web Audio를 쓴 이유, 로딩 화면의 시작음과 겹치지 않게 한 방법, 소리를 테스트하는 법.
---

`public/sounds`에는 오래전부터 `mouse-down.mp3`와 `mouse-up.mp3`가 있었다. CRA 시절에 클릭 소리를 넣었다가, Vite로 옮기면서 코드만 사라지고 파일은 남아 있었다. 다시 붙였다.

![시스템 설정의 사운드](./images/settings-sound.jpg '시스템 설정 → 사운드에서 끄고 켠다. 설정은 브라우저에 남는다')

## click이 아니라 pointerdown·pointerup

소리가 두 개인 데는 이유가 있다. 실제 마우스는 누를 때 한 번, 뗄 때 한 번 소리가 난다. 그래서 `click` 한 번에 소리 하나가 아니라, 누를 때(`pointerdown`)와 뗄 때(`pointerup`)에 각각 소리를 낸다.

```ts
window.addEventListener('pointerdown', handle('down'), { capture: true, passive: true });
window.addEventListener('pointerup', handle('up'), { capture: true, passive: true });
```

- **window 한 곳에서 capture로 받는다.** 앱마다 소리를 붙이지 않아도 되고, 창 끌기나 메뉴처럼 이벤트 전파를 막는 곳에서도 소리가 난다. capture 단계는 전파를 막기 전에 먼저 지나가기 때문이다
- **`passive: true`**: 소리는 기본 동작을 막을 일이 없으니, 스크롤·드래그를 기다리게 하지 않는다

## 언제 소리를 내나

규칙은 DOM 이벤트 대신 필요한 값만 받는 순수 함수로 두었다. 이벤트를 흉내 내지 않고 단위 테스트할 수 있다.

```ts
export function shouldPlayClick({ pointerType, button, onLoadingScreen, enabled }: ClickInput) {
	if (!enabled || onLoadingScreen) return false;
	if (pointerType !== 'mouse' && pointerType !== 'pen') return false;
	return button === 0;
}
```

- **마우스·펜의 주 단추만.** 오른쪽 클릭은 메뉴를 여는 동작이라 소리를 빼고, 휴대폰 터치도 뺐다. iOS 홈 화면 모양인 모바일에서 누를 때마다 소리가 나면 macOS 흉내가 아니라 그냥 시끄럽다
- **로딩 화면은 빼기.** 로딩 화면을 누르면 macOS 시작음이 나는데, 거기에 딸깍 소리가 겹쳤다
- **설정에서 끌 수 있다.** 설정 저장소에 `clickSound`를 더하고, 저장된 값이 불리언이 아니면(예전 설정, 깨진 값) 켠 것으로 읽는다

## `<audio>` 대신 Web Audio

처음에는 가장 간단하게 누를 때마다 `new Audio(src).play()`를 했다. 두 가지가 거슬렸다.

1. **늦게 난다.** `<audio>`는 재생할 때마다 파일을 준비한다. 캐시에 있어도 누른 뒤 한참 있다가 소리가 나서, 클릭과 소리가 따로 논다
2. **빨리 연달아 누르면 끊긴다.** `<audio>` 하나를 다시 쓰면 앞 소리가 잘리고, 매번 새로 만들면 요소가 쌓인다

소리 파일은 0.08초짜리다. 이렇게 짧은 소리는 **한 번 디코딩해 두고, 누를 때마다 새 재생기(BufferSource)로 튼다.** 버퍼는 공유하고 재생기만 새로 만드는 거라 가볍고, 여러 번 겹쳐 틀어도 된다.

```ts
const source = context.createBufferSource();
source.buffer = buffers[phase]; // 미리 디코딩해 둔 소리
source.connect(gain); // 소리 크기 0.4 (음악을 방해하지 않게)
source.start();
```

`AudioContext`가 없는 브라우저에서는 그때만 `<audio>`로 튼다.

## 첫 클릭에 소리가 늦게 난다

Web Audio로 바꾸고도 **첫 클릭만** 소리가 늦었다. 처음 누를 때 파일을 받아 디코딩하느라 그렇다. 페이지를 열자마자 미리 받으면 되지 않나 싶지만, 브라우저는 사용자가 한 번이라도 누르기 전에는 `AudioContext`를 멈춰 둔다(자동 재생 정책).

마침 이 사이트는 **로딩 화면을 눌러야** 시작한다. 그 클릭은 소리를 내지 않는 대신, 그 틈에 `AudioContext`를 만들고 두 파일을 받아 디코딩해 둔다. 로딩 막대가 차는 3초 동안 준비가 끝나서, 데스크톱에서 처음 누를 때부터 바로 소리가 난다.

```ts
if (shouldPlayClick(input)) play(phase);
else if (input.onLoadingScreen && input.enabled && phase === 'down') warmUp(); // 미리 불러오기만
```

탭을 오래 두었다가 돌아오면 브라우저가 `AudioContext`를 다시 멈추기도 해서, 틀기 전에 `suspended`면 `resume()`한다. 사용자가 누른 순간이라 다시 켤 수 있다.

## 소리가 안 나도 클릭은 돼야 한다

E2E는 페이지에서 처리되지 않은 에러가 나면 테스트를 실패시킨다(`pageErrors` 픽스처). 소리 파일을 못 받거나 디코딩에 실패하면 Promise가 거절되고, 아무도 받지 않으면 그대로 페이지 에러가 된다. 소리 때문에 클릭이 실패한 것처럼 보이면 안 되니, 소리 쪽 Promise는 끝에서 모두 삼킨다. 불러오기에 실패하면 다음 클릭에 다시 시도한다.

## 소리를 어떻게 테스트하나

소리가 났는지는 귀로 들을 수 없다. 테스트에서는 `AudioContext`를 가짜로 바꿔 끼우고, **버퍼를 튼 횟수**를 센다.

```ts
await page.addInitScript(() => {
	class FakeAudioContext {
		createBufferSource() {
			return {
				connect() {},
				start() {
					window.__clickSounds += 1;
				},
			};
		}
		// createGain, decodeAudioData, resume …
	}
	window.AudioContext = FakeAudioContext;
});
```

- 로딩 화면을 누르면 0번이고, 그 사이 `mouse-down.mp3`·`mouse-up.mp3`를 받아 둔다
- Dock 아이콘을 한 번 누르면 2번 (누를 때, 뗄 때)
- 오른쪽 클릭은 그대로
- 설정에서 끄면 늘지 않고, 새로고침해도 꺼져 있다

실제 브라우저에서도 가짜 없이 파일을 받아 디코딩해 보고(0.078초짜리), 콘솔 에러가 없는 것까지 확인했다.

#MacFolio #데스크톱 #WebAudio
