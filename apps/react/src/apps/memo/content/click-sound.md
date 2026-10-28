---
title: Web Audio로 미리 디코딩한 소리를 pointerdown·pointerup에 재생하기
date: 2026-10-01
category: 개발 기록/MacFolio/프론트엔드
summary: 화면 어디를 클릭하든 누르는 시각과 떼는 시각에 딸깍 소리가 재생되게 했다. pointerdown·pointerup을 window 한 곳에서 수신하고, <audio> 대신 Web Audio로 미리 디코딩해 재생하고, 로딩 화면 클릭을 오디오 초기화에 사용했다. 가짜 AudioContext로 재생 횟수를 집계하는 시험까지 정리했다.
---

`public/sounds`에는 오래전부터 `mouse-down.mp3`와 `mouse-up.mp3`가 있었다. CRA 시절에 클릭 소리를 구현했다가, Vite로 이전하면서 코드만 삭제되고 파일은 남아 있었다([CRA에서 Vite로 옮기기](/memo/cra-to-vite)). 이 파일로 기능을 다시 구현했다. 두 파일 모두 3,133바이트다.

작업은 PR [#50](https://github.com/hyeoniverse/MacFolio/pull/50)의 커밋 하나다. 코드는 `src/shared/sound/` 아래 재생 처리(`clickSound.ts` 88줄)와 재생 규칙(`clickRules.ts` 30줄) 두 파일로 나눴다.

![시스템 설정의 사운드](./images/settings-sound.jpg '시스템 설정 → 사운드에서 끄고 켠다. 설정은 브라우저에 남는다')

## click이 아니라 pointerdown·pointerup

소리 파일이 두 개인 이유는 실제 마우스가 누를 때 한 번, 뗄 때 한 번 소리를 내기 때문이다. 그래서 `click` 한 번에 소리 하나가 아니라, 누르는 시각(`pointerdown`)과 떼는 시각(`pointerup`)에 각각 재생한다([MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)).

```ts
window.addEventListener('pointerdown', handle('down'), { capture: true, passive: true });
window.addEventListener('pointerup', handle('up'), { capture: true, passive: true });
```

| 옵션            | 이유                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capture: true` | window 한 곳에서 수신한다. 앱마다 처리기를 추가하지 않아도 되고, 창 끌기나 메뉴처럼 `stopPropagation()`으로 전파를 막는 위치에서도 소리가 난다. 캡처 단계는 대상 요소의 처리기보다 먼저 실행되기 때문이다 |
| `passive: true` | 소리 재생은 기본 동작을 막지 않으므로, 브라우저가 스크롤·드래그 처리를 지연하지 않게 한다 ([MDN addEventListener 옵션](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener))    |

## 재생 조건

재생 규칙은 DOM 이벤트 대신 필요한 값만 받는 순수 함수로 정의했다. 이벤트 객체를 모의하지 않고 단위 시험할 수 있다.

```ts
export function shouldPlayClick({ pointerType, button, onLoadingScreen, enabled }: ClickInput) {
	if (!enabled || onLoadingScreen) return false;
	if (pointerType !== 'mouse' && pointerType !== 'pen') return false;
	return button === 0;
}
```

| 조건                | 재생 여부 | 이유                                                                                                             |
| ------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| 마우스·펜의 주 버튼 | 재생      |                                                                                                                  |
| 오른쪽·가운데 버튼  | 제외      | 오른쪽 클릭은 메뉴를 여는 동작이다                                                                               |
| 터치                | 제외      | iOS 홈 화면 형태인 모바일 화면에서 탭할 때마다 소리가 나면 macOS 재현과 무관한 소음이 된다                       |
| 로딩 화면           | 제외      | 로딩 화면을 클릭하면 macOS 시작음이 재생되는데, 딸깍 소리가 겹친다                                               |
| 설정에서 끔         | 제외      | 설정 저장소에 `clickSound`를 추가했다. 저장된 값이 불리언이 아니면(이전 버전 설정, 손상된 값) 켠 것으로 해석한다 |

## `<audio>` 대신 Web Audio

처음에는 가장 단순하게 클릭할 때마다 `new Audio(src).play()`를 호출했다. 문제가 두 가지 있었다.

1. **재생 지연.** `<audio>`는 재생할 때마다 파일을 준비한다. 캐시에 있어도 클릭 후 눈에 띄게 늦게 소리가 나서, 클릭과 소리가 맞지 않는다.
2. **연속 클릭 시 끊김.** `<audio>` 하나를 재사용하면 이전 소리가 잘리고, 매번 새로 생성하면 요소가 누적된다.

| 방법                                     | 지연                     | 연속 클릭 시        | 코드  |
| ---------------------------------------- | ------------------------ | ------------------- | ----- |
| 클릭마다 `new Audio(src).play()`         | 재생마다 준비해 지연된다 | 요소가 누적된다     | 한 줄 |
| `<audio>` 하나를 되감아 재생             | 지연된다                 | 이전 소리가 잘린다  | 몇 줄 |
| Web Audio 버퍼 + 새 재생 노드 (**채택**) | 디코딩 후에는 즉시 재생  | 겹쳐 재생할 수 있다 | 88줄  |

소리 파일 길이는 0.08초다. 이렇게 짧은 소리는 **한 번 디코딩해 두고, 클릭할 때마다 새 재생 노드([`AudioBufferSourceNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode))로 재생한다.** 버퍼는 공유하고 재생 노드만 새로 생성하므로 부담이 작고, 여러 번 겹쳐 재생할 수 있다([MDN Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)).

```ts
const source = context.createBufferSource();
source.buffer = buffers[phase]; // 미리 디코딩해 둔 소리
source.connect(gain); // 소리 크기 0.4 (음악을 방해하지 않게)
source.start();
```

`AudioContext`를 지원하지 않는 브라우저에서만 `<audio>`로 재생한다.

## 첫 클릭의 소리 지연

Web Audio로 바꾼 뒤에도 **첫 클릭만** 소리가 늦었다. 첫 클릭 시각에 파일을 내려받아 디코딩하기 때문이다. 페이지 로드 직후 미리 내려받는 방법을 생각할 수 있지만, 브라우저는 사용자가 한 번이라도 상호작용하기 전에는 `AudioContext`를 정지 상태로 둔다([자동 재생 정책](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)).

![로딩 화면의 클릭으로 준비하기](./images/click-sound-warmup.svg '시작음을 내는 그 클릭이 AudioContext를 깨우고, 3초 동안 두 파일을 디코딩해 둔다')

이 사이트는 **로딩 화면을 클릭해야** 시작한다. 그 클릭에서는 딸깍 소리를 재생하지 않고, 대신 `AudioContext`를 생성하고 두 파일을 내려받아 디코딩한다. 로딩 막대가 채워지는 3초 동안 준비가 끝나므로, 데스크톱에서 첫 클릭부터 즉시 소리가 난다.

```ts
if (shouldPlayClick(input)) play(phase);
else if (input.onLoadingScreen && input.enabled && phase === 'down') warmUp(); // 미리 불러오기만
```

탭을 오래 비활성 상태로 두면 브라우저가 `AudioContext`를 다시 정지하기도 해서, 재생 전에 상태가 `suspended`이면 `resume()`을 호출한다. 사용자가 클릭한 시각이라 다시 활성화할 수 있다.

## 소리 재생이 실패해도 클릭은 동작해야 한다

E2E는 페이지에서 처리되지 않은 오류가 발생하면 시험을 실패시킨다(`pageErrors` 픽스처). 소리 파일을 내려받지 못하거나 디코딩에 실패하면 Promise가 거부되고, 처리하는 코드가 없으면 그대로 페이지 오류가 된다. 소리 때문에 클릭이 실패한 것처럼 보이면 안 되므로, 소리 관련 Promise의 거부는 마지막 단계에서 모두 처리해 무시한다. 불러오기에 실패하면 다음 클릭에서 다시 시도한다.

## 소리의 시험 방법

소리 재생 여부는 시험 환경에서 들을 수 없다. 시험에서는 `AudioContext`를 가짜 구현으로 교체하고, **버퍼 재생 횟수**를 집계한다.

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

9월 30일 밤에 클릭 소리를 구현했고, 이후 정상 동작했다. 그런데 10월 19일 새벽, 배포한 사이트에서만 소리가 재생되지 않았다. 같은 코드를 로컬에서 실행하면 소리가 났다. 강력 새로 고침(⌘⇧R)을 실행하자 다시 재생됐다. 브라우저 캐시에 남아 있던 이전 파일이 원인으로 판단했고, 코드 수정은 필요하지 않았다. 소리가 나지 않으면 다음 순서로 확인한다.

1. 강력 새로 고침(⌘⇧R)으로 캐시를 우회한다.
2. 시스템 설정 → 사운드에서 클릭 소리가 켜져 있는지 확인한다.
3. 브라우저 탭이 음소거 상태인지 확인한다.

## 남은 과제와 정리

- 키보드로 버튼을 눌러도(Enter·Space) 소리는 재생되지 않는다. 포인터 이벤트만 수신하기 때문이다.
- 음량(0.4)은 코드에 고정되어 있다. 시스템 설정에는 켜기·끄기만 있다.
- 브라우저의 자동 재생 정책은 회피 대상이 아니라 활용할 수 있는 신호였다. "사용자의 첫 상호작용"이 이미 로딩 화면에 있었고, 그 시각에 오디오 초기화를 실행해 첫 클릭의 지연을 없앴다.
- 소리처럼 화면에 드러나지 않는 동작도, 외부 API를 가짜 구현으로 교체해 재생 횟수를 집계하면 시험할 수 있다. 규칙을 순수 함수로 분리해 단위 시험에서 이벤트 객체를 모의할 필요도 없었다.

## 관련 글

- [CRA에서 Vite로 옮기기](/memo/cra-to-vite)
- [음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트](/memo/music-player-fixes)
- [사이트가 쓰는 localStorage·sessionStorage 키를 목록으로 표시하고 삭제하기](/memo/bin-app)

#MacFolio #데스크톱 #WebAudio
