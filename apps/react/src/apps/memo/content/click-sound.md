---
title: Web Audio로 미리 디코딩한 소리를 pointerdown·pointerup에 재생하기
date: 2026-10-01
category: 개발 기록/MacFolio/인터랙션·브라우저 API
summary: 화면 어디를 클릭하든 누르는 시각과 떼는 시각에 딸깍 소리가 재생되게 했다. pointerdown·pointerup을 window 한 곳에서 수신하고, <audio> 대신 Web Audio로 미리 디코딩해 재생하고, 로딩 화면 클릭을 오디오 초기화에 사용했다. 가짜 AudioContext로 재생 횟수를 집계하는 시험까지 정리했다.
---

## 배경: 브라우저에서 클릭 소리를 내는 방법

MacFolio는 macOS 데스크톱을 브라우저에 재현한 사이트다. 실제 마우스는 버튼을 누르는 시각과 떼는 시각에 각각 기계적인 딸깍 소리를 내는데, 브라우저 화면에서는 이 소리가 없다. `public/sounds`에는 오래전부터 이 소리를 녹음한 `mouse-down.mp3`와 `mouse-up.mp3`가 있었다. CRA 시절에 클릭 소리를 구현했다가, Vite로 이전하면서 코드만 삭제되고 파일은 남아 있었다([CRA에서 Vite로 옮기기](/memo/cra-to-vite)). 이 파일로 기능을 다시 구현했다.

| 파일             | 크기        | 길이    | 형식                         |
| ---------------- | ----------- | ------- | ---------------------------- |
| `mouse-down.mp3` | 3,133바이트 | 0.078초 | MP3, 2채널, 44.1kHz, 320kbps |
| `mouse-up.mp3`   | 3,133바이트 | 0.078초 | MP3, 2채널, 44.1kHz, 320kbps |

브라우저에서 소리를 재생하는 방법은 두 가지다.

- **`<audio>` 요소(`HTMLAudioElement`)**: 파일 주소를 지정하고 `play()`를 호출하는 방식이다. 음악이나 영상처럼 긴 파일을 처음부터 끝까지 재생하는 용도에 맞춰져 있다.
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**: 소리를 내는 노드, 음량을 바꾸는 노드, 스피커 노드 등을 연결한 그래프로 소리를 처리하는 방식이다. 모든 노드는 하나의 `AudioContext` 안에 있다. 게임 효과음처럼 짧은 소리를 정확한 시각에 여러 번 겹쳐 재생하는 용도에 적합하다.

![W3C Web Audio API 명세의 오디오 라우팅 예: Source 1~3이 필터·왜곡·패너를 거쳐 Gain, Compressor, Destination으로 연결된다](./images/click-sound-w3c-modular-routing.png '여러 노드를 연결하는 Web Audio의 오디오 그래프 예시. 클릭 소리는 이 가운데 Source → Gain → Destination 세 단계만 사용한다')

작업은 PR [#50](https://github.com/hyeoniverse/MacFolio/pull/50)의 커밋 하나다. 코드는 `src/shared/sound/` 아래 재생 처리(`clickSound.ts` 88줄)와 재생 규칙(`clickRules.ts` 30줄) 두 파일로 나눴다.

![시스템 설정의 사운드](./images/settings-sound.jpg '시스템 설정 → 사운드에서 끄고 켠다. 설정은 브라우저에 남는다')

## click이 아니라 pointerdown·pointerup

소리 파일이 두 개인 이유는 실제 마우스가 누르는 시각에 한 번, 떼는 시각에 한 번 소리를 내기 때문이다. 브라우저의 `click` 이벤트는 버튼을 눌렀다가 같은 요소 위에서 뗀 뒤에 한 번만 발생한다. `click`에 소리를 연결하면 누르는 순간의 소리를 낼 수 없다.

[Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)는 마우스·펜·터치를 하나의 형식으로 전달하는 이벤트다. 버튼을 누르면 `pointerdown`, 떼면 `pointerup`이 발생하고, 이벤트 객체의 `pointerType`(`mouse`·`pen`·`touch`)으로 입력 장치를 구분한다. 그래서 누르는 시각(`pointerdown`)과 떼는 시각(`pointerup`)에 각각 소리를 재생한다.

![버튼을 누르는 순간 pointerdown과 mouse-down.mp3, 떼는 순간 pointerup과 mouse-up.mp3, 그 직후 click이 발생한다](./images/click-sound-pointer-timeline.svg '클릭 한 번에 이벤트 세 개가 발생한다. 소리는 앞의 두 이벤트에 연결한다')

```ts
window.addEventListener('pointerdown', handle('down'), { capture: true, passive: true });
window.addEventListener('pointerup', handle('up'), { capture: true, passive: true });
```

두 옵션의 의미를 이해하려면 이벤트 전파 순서를 알아야 한다. DOM 이벤트는 문서 최상위(`window`)에서 클릭한 요소까지 내려가는 **캡처 단계**, 클릭한 요소에 도달하는 **대상 단계**, 다시 `window`까지 올라가는 **버블링 단계**를 차례로 거친다. 일반 처리기는 버블링 단계에서 실행되고, `capture: true`로 등록한 처리기는 캡처 단계에서 실행된다.

![W3C UI Events 명세의 이벤트 전파 그림: window에서 대상까지 내려가는 캡처 단계, 대상 단계, 다시 올라가는 버블링 단계](./images/menu-bar-app-name-w3c-eventflow.svg 'window에 capture: true로 등록한 처리기는 1번 캡처 단계에서 가장 먼저 실행된다')

| 옵션            | 이유                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capture: true` | window 한 곳에서 수신한다. 앱마다 처리기를 추가하지 않아도 되고, 창 끌기나 메뉴처럼 `stopPropagation()`으로 전파를 막는 위치에서도 소리가 난다. 캡처 단계의 window 처리기는 대상 요소의 처리기보다 먼저 실행되기 때문이다                             |
| `passive: true` | 처리기가 `preventDefault()`를 호출하지 않는다고 브라우저에 알린다. 브라우저는 처리기 실행을 기다리지 않고 스크롤·드래그를 시작할 수 있다 ([MDN addEventListener 옵션](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)) |

예를 들어 창 제목 막대(`useWindowFrame.ts`)는 끌기를 시작하면서 `stopPropagation()`을 호출한다. 버블링 단계에서 window에 등록한 처리기라면 이 호출 때문에 이벤트를 받지 못하지만, 캡처 단계의 처리기는 그보다 먼저 실행되므로 소리가 난다.

## 재생 조건

재생 규칙은 DOM 이벤트 대신 필요한 값만 받는 순수 함수로 정의했다. 순수 함수는 같은 입력에 항상 같은 결과를 돌려주고 외부 상태를 바꾸지 않는 함수다. 이벤트 객체를 모의하지 않고 `{ pointerType: 'mouse', button: 0, … }` 같은 객체만 넘겨 단위 시험할 수 있다.

```ts
export function shouldPlayClick({ pointerType, button, onLoadingScreen, enabled }: ClickInput) {
	if (!enabled || onLoadingScreen) return false;
	if (pointerType !== 'mouse' && pointerType !== 'pen') return false;
	return button === 0;
}
```

`button`은 누른 버튼의 번호다. 0이 주 버튼(보통 왼쪽), 1이 가운데(휠), 2가 보조 버튼(보통 오른쪽)이다.

| 입력 예                             | 결과 | 이유                                                                                                             |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| `pointerType: 'mouse'`, `button: 0` | 재생 | 마우스 주 버튼                                                                                                   |
| `pointerType: 'pen'`, `button: 0`   | 재생 | 펜 끝으로 누른 경우                                                                                              |
| `pointerType: 'mouse'`, `button: 2` | 제외 | 오른쪽 클릭은 메뉴를 여는 동작이다                                                                               |
| `pointerType: 'touch'`              | 제외 | iOS 홈 화면 형태인 모바일 화면에서 탭할 때마다 소리가 나면 macOS 재현과 무관한 소음이 된다                       |
| `onLoadingScreen: true`             | 제외 | 로딩 화면을 클릭하면 macOS 시작음이 재생되는데, 딸깍 소리가 겹친다                                               |
| `enabled: false`                    | 제외 | 설정 저장소에 `clickSound`를 추가했다. 저장된 값이 불리언이 아니면(이전 버전 설정, 손상된 값) 켠 것으로 해석한다 |

## `<audio>` 대신 Web Audio

처음에는 가장 단순하게 클릭할 때마다 `new Audio(src).play()`를 호출했다. 두 가지 결함이 있었다.

1. **재생 지연.** `<audio>`는 재생할 때마다 파일을 준비한다. 캐시에 있어도 클릭 후 눈에 띄게 늦게 소리가 나서, 클릭과 소리가 맞지 않는다.
2. **연속 클릭 시 끊김.** `<audio>` 하나를 재사용하면 이전 소리가 잘리고, 매번 새로 생성하면 요소가 누적된다.

| 방법                                     | 지연                     | 연속 클릭 시        | 코드  |
| ---------------------------------------- | ------------------------ | ------------------- | ----- |
| 클릭마다 `new Audio(src).play()`         | 재생마다 준비해 지연된다 | 요소가 누적된다     | 한 줄 |
| `<audio>` 하나를 되감아 재생             | 지연된다                 | 이전 소리가 잘린다  | 몇 줄 |
| Web Audio 버퍼 + 새 재생 노드 (**채택**) | 디코딩 후에는 즉시 재생  | 겹쳐 재생할 수 있다 | 88줄  |

Web Audio에서는 MP3 같은 압축 파일을 `decodeAudioData()`로 미리 풀어 [`AudioBuffer`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)에 보관한다. `AudioBuffer`는 압축을 푼 PCM[^pcm] 샘플을 메모리에 담은 객체다. 0.078초 소리는 채널마다 약 3,450개 샘플이고, 샘플 하나가 32비트 부동소수점이라 두 채널을 합쳐 약 27KB다. 3KB짜리 MP3보다 크지만, 재생하는 시각에는 압축을 풀 필요가 없다.

이렇게 짧은 소리는 ==한 번 디코딩해 두고, 클릭할 때마다 새 재생 노드([`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode))로 재생==한다. 재생 노드는 `start()`를 한 번만 호출할 수 있어 재생마다 새로 만들어야 하지만, MDN 문서가 설명하듯 생성 비용이 작고 버퍼는 여러 노드가 공유한다. 노드마다 독립적으로 재생하므로 빠르게 연속 클릭해도 앞 소리가 잘리지 않는다.

![mp3를 한 번 내려받아 AudioBuffer로 디코딩하고, 클릭마다 새 AudioBufferSourceNode가 같은 버퍼를 참조해 GainNode(0.4)와 스피커로 보낸다](./images/click-sound-audio-graph.svg '위 줄은 처음 한 번, 아래 줄은 누를 때마다 실행된다. 세 번 빠르게 누르면 재생 노드 세 개가 동시에 소리를 낸다')

```ts
const source = context.createBufferSource();
source.buffer = buffers[phase]; // 미리 디코딩해 둔 소리
source.connect(gain); // 소리 크기 0.4 (음악을 방해하지 않게)
source.start();
```

`GainNode`는 통과하는 소리에 `gain` 값을 곱하는 노드다. 0.4를 곱하면 원래 진폭의 40%로 재생된다. `AudioContext`를 지원하지 않는 브라우저에서만 `<audio>`로 재생한다.

## 첫 클릭의 소리 지연

Web Audio로 바꾼 뒤에도 **첫 클릭만** 소리가 늦었다. ==첫 클릭 시각에 파일을 내려받아 디코딩==하기 때문이다. 페이지 로드 직후 미리 내려받는 방법을 생각할 수 있지만, 브라우저는 자동 재생 정책 때문에 이 방법을 제한한다.

**자동 재생 정책**([Autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay))은 사용자가 페이지와 상호작용(클릭, 키 입력 등)하기 전에는 소리를 내지 못하게 하는 브라우저 규칙이다. 페이지를 열자마자 광고 소리가 나는 상황을 막기 위한 규칙이다. 상호작용 전에 만든 `AudioContext`는 `state`가 `suspended`(정지)로 시작하고, 상호작용이 일어난 뒤 `resume()`을 호출해야 `running`이 된다.

| 시각                           | `AudioContext.state`  | 소리  |
| ------------------------------ | --------------------- | ----- |
| 페이지 로드 직후 생성          | `suspended`           | 안 남 |
| 사용자 클릭 처리기 안에서 생성 | `running`             | 남    |
| 탭을 오래 비활성 상태로 둔 뒤  | `suspended`일 수 있음 | 안 남 |

![로딩 화면의 클릭으로 준비하기](./images/click-sound-warmup.svg '시작음을 내는 그 클릭이 AudioContext를 깨우고, 3초 동안 두 파일을 디코딩해 둔다')

이 사이트는 **로딩 화면을 클릭해야** 시작한다. 그 클릭에서는 딸깍 소리를 재생하지 않고, 대신 `AudioContext`를 생성하고 두 파일을 내려받아 디코딩한다. 로딩 막대가 채워지는 3초 동안 준비가 끝나므로, 데스크톱에서 첫 클릭부터 즉시 소리가 난다.

```ts
if (shouldPlayClick(input)) play(phase);
else if (input.onLoadingScreen && input.enabled && phase === 'down') warmUp(); // 미리 불러오기만
```

탭을 오래 비활성 상태로 두면 브라우저가 `AudioContext`를 다시 정지하기도 해서, 재생 전에 상태가 `suspended`이면 `resume()`을 호출한다. 사용자가 클릭한 시각이라 다시 활성화할 수 있다.

## 소리 재생 실패와 클릭 동작의 분리

E2E 시험은 페이지에서 처리되지 않은 오류가 발생하면 시험을 실패시킨다(`pageErrors` 픽스처). 소리 파일을 내려받지 못하거나 디코딩에 실패하면 Promise가 거부(reject)되고, 거부를 처리하는 `.catch()`가 없으면 그대로 페이지 오류가 된다.

예를 들어 네트워크가 끊긴 상태에서 Dock 아이콘을 누르면 `fetch('/sounds/mouse-down.mp3')`가 실패한다. 이 실패가 페이지 오류로 기록되면, 앱은 정상으로 열렸는데도 시험은 실패한다. 소리 때문에 클릭이 실패한 것처럼 보이면 안 되므로, ==소리 관련 Promise의 거부는 마지막 단계에서 모두 처리해 무시==한다. 불러오기에 실패하면 저장해 둔 Promise를 비워 다음 클릭에서 다시 시도한다.

## 가짜 AudioContext로 재생 횟수 집계

소리 재생 여부는 시험 환경에서 들을 수 없다. 시험에서는 페이지 스크립트가 실행되기 전에 `window.AudioContext`를 가짜 클래스로 교체하고, **버퍼 재생 횟수**를 집계한다. Playwright의 `page.addInitScript()`는 페이지의 다른 스크립트보다 먼저 실행할 코드를 등록하는 함수다.

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

| 동작                 | 재생 횟수 | 비고                                                 |
| -------------------- | --------- | ---------------------------------------------------- |
| 로딩 화면 클릭       | 0회       | 그 사이 `mouse-down.mp3`·`mouse-up.mp3`를 내려받는다 |
| Dock 아이콘 1회 클릭 | 2회       | 누르는 시각, 떼는 시각                               |
| 오른쪽 클릭          | 변화 없음 |                                                      |
| 설정에서 끈 뒤 클릭  | 변화 없음 | 새로 고침해도 꺼진 상태 유지                         |

실제 브라우저에서도 가짜 구현 없이 파일을 내려받아 디코딩하고(길이 0.078초), 콘솔 오류가 없는 것까지 확인했다.

| 시험 파일                                    | 개수 | 시험 이름                                                                                                                                                                             |
| -------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/sound/clickRules.test.ts` (단위) | 5    | **마우스·펜의 주 버튼에 소리를 낸다**, **오른쪽·가운데 버튼에는 내지 않는다**, **터치에는 내지 않는다**, **설정에서 끄면 내지 않는다**, **로딩 화면에서는 시작음만 나게 내지 않는다** |
| `e2e/click-sound.spec.ts` (E2E)              | 2    | **로딩 화면에서는 시작음만 나고, 데스크톱에서는 누를 때·뗄 때 딸깍 소리가 난다**, **시스템 설정 → 사운드에서 끄면 소리가 나지 않고, 새로고침해도 꺼져 있다**                          |

## 배포 후 소리가 재생되지 않은 문제

9월 30일 밤에 클릭 소리를 구현했고, 이후 정상 동작했다. 그런데 10월 19일 새벽, 배포한 사이트에서만 소리가 재생되지 않았다. 같은 코드를 로컬에서 실행하면 소리가 났다. 강력 새로 고침(⌘⇧R)을 실행하자 다시 재생됐다. 브라우저 캐시에 남아 있던 이전 파일이 원인으로 판단했고, 코드 수정은 필요하지 않았다.

> [!TIP] 소리가 나지 않을 때
> 소리가 나지 않으면 다음 순서로 확인한다.
>
> 1. 강력 새로 고침(⌘⇧R)으로 캐시를 우회한다.
> 2. 시스템 설정 → 사운드에서 클릭 소리가 켜져 있는지 확인한다.
> 3. 브라우저 탭이 음소거 상태인지 확인한다.

## 남은 과제

- 키보드로 버튼을 눌러도(Enter·Space) 소리는 재생되지 않는다. 포인터 이벤트만 수신하기 때문이다.
- 음량(0.4)은 코드에 고정되어 있다. 시스템 설정에는 켜기·끄기만 있다.

> [!IMPORTANT]
> 브라우저의 자동 재생 정책은 회피 대상이 아니라 활용할 수 있는 신호였다. "사용자의 첫 상호작용"이 이미 로딩 화면에 있었고, 그 시각에 오디오 초기화를 실행해 첫 클릭의 지연을 없앴다. 또 소리처럼 화면에 드러나지 않는 동작도, 외부 API를 가짜 구현으로 교체해 재생 횟수를 집계하면 시험할 수 있다.

## 관련 글

- [CRA에서 Vite로 옮기기](/memo/cra-to-vite)
- [음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트](/memo/music-player-fixes)
- [localStorage 키 목록과 2초 주기 확인으로 구현한 휴지통 앱](/memo/bin-app)

[^pcm]: PCM(Pulse-Code Modulation)은 소리의 파형을 일정한 간격으로 측정한 숫자 목록이다. 44.1kHz는 1초에 44,100번 측정한다는 뜻이라, 0.078초는 약 3,450개 숫자가 된다. MP3는 이 숫자 목록을 압축한 형식이다.

<details>
<summary>참고 문헌</summary>

- MDN, [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- MDN, [EventTarget.addEventListener(): capture, passive](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
- MDN, [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- MDN, [AudioBuffer](https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer)
- MDN, [AudioBufferSourceNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode)
- MDN, [Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)
- W3C, [Web Audio API 1.1: Modular Routing](https://www.w3.org/TR/webaudio/#ModularRouting)
- W3C, [UI Events: Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow)
- Playwright, [page.addInitScript](https://playwright.dev/docs/api/class-page#page-add-init-script)

</details>

<details>
<summary>사진 출처</summary>

- 오디오 라우팅 그림: W3C, [Web Audio API 1.1, Figure "A more complex example of modular routing"](https://www.w3.org/TR/webaudio/#ModularRouting), 원본 [modular-routing2.png](https://www.w3.org/TR/webaudio/images/modular-routing2.png), W3C Software and Document License, 출처 표기
- DOM 이벤트 전파 그림: W3C, [UI Events Working Draft 2016-08-04, 3.1 Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow), 원본 [eventflow.svg](https://github.com/w3c/uievents/blob/main/images/eventflow.svg), W3C Software and Document License, 출처 표기 (흰 바탕만 추가)

</details>

#MacFolio #데스크톱 #WebAudio
