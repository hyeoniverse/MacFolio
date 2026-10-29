---
title: isRunning 정의와 React key·ref 함수 동일성이 일으킨 음악 앱 버그
date: 2026-10-18
category: 개발 기록/MacFolio/프론트엔드
summary: 배경 음악이 재생되는데 Dock의 음악은 꺼진 상태였고, 셔플을 누르면 표지가 누적됐고, 지금 재생 중 시트의 닫힘 애니메이션이 반복됐다. 창과 실행이 섞인 isRunning, 형제 요소의 같은 React key, 렌더링마다 새로 만든 ref 함수가 원인이었다.
---

음악 앱의 버그 세 가지를 수정했다([#257](https://github.com/hyeoniverse/MacFolio/pull/257)). 세 증상 모두 원인은 코드 한 곳씩이었다.

| 증상                                           | 재현                                     | 원인                                                | 수정 위치                            |
| ---------------------------------------------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| 재생 중인데 Dock의 음악에 실행 표시가 없다     | 로딩 화면을 눌러 데스크톱에 진입한다     | `isRunning` 하나에 "창이 있다"와 "실행 중"이 섞였다 | `windowStore.ts`, `MusicContext.tsx` |
| 재생 막대에 표지·제목이 누적된다               | 셔플 버튼을 여러 번 누른다               | 형제 `img`·`span`이 같은 `key`                      | `Music.tsx`                          |
| 지금 재생 중 시트의 닫힘 애니메이션이 반복된다 | 휴대폰에서 재생 중에 지금 재생 중을 연다 | 렌더링마다 새 ref 함수                              | `Sheet.tsx`                          |

첫 번째 버그는 10월 19일 새벽에 발견했다. 배경 음악은 자동 재생이라 데스크톱에 진입하자마자 재생되는데, Dock의 음악 앱은 꺼진 상태로 표시됐다. 음악 앱을 처음부터 실행 상태로 두는 방법도 있었지만, 이미 재생 중인데 상태 값이 불일치하는 문제이므로 상태 구조부터 재검토하기로 하고 이 PR에서 함께 수정했다.

## 배경 음악이 재생되는데 음악 앱은 꺼진 상태

데스크톱은 로딩 화면을 지나면 `startMusic` 이벤트로 배경 음악을 재생한다. 소리는 나는데 Dock의 음악 앱에는 실행 표시(점)가 없었다.

처음에는 `runningAtStart`에 `'minimized'` 값을 추가해, 창을 최소화한 상태로 실행해서 점을 표시했다. 점은 표시됐지만 증상만 가린 수정이었다. 코드를 확인하니 상태 구조가 맞지 않았다.

- desktop-core 창 store의 `isRunning`은 실제로는 **창이 있다**는 뜻이다. 창을 닫으면 `false`가 된다
- 그런데 Dock의 점도 같은 값을 조회했다. "창이 있다"와 "앱이 실행 중이다"가 한 값에 섞여 있었다. Finder의 `alwaysRunning`, 공유의 알림 표시 중 실행 상태는 이 혼용을 보완하려고 추가한 예외였다
- 소리는 컴포넌트 트리 최상단의 `MusicProvider`가 창과 무관하게 재생한다. 따라서 소리는 나는데 창이 없어 점이 표시되지 않았다
- 이전에는 음악 앱이 `runningAtStart: true`라 처음부터 창이 있었고, 두 의미가 우연히 일치했다. 음악 앱을 개편하면서 이 값이 삭제되어 불일치가 드러났다

수정 방법은 세 가지를 비교했다.

| 방법                                                                          | 단점                                                                                           |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 처음부터 음악 창을 최소화한 채 켠다 (`runningAtStart: 'minimized'`)           | 점은 표시되지만 창이 생성된다. 소리가 나지 않아도 실행 표시가 뜬다. 처음에 적용했다가 되돌렸다 |
| Dock이 음악만 별도로 `MusicContext`의 재생 상태를 조회                        | Finder·공유처럼 예외가 하나 더 늘어날 뿐이다                                                   |
| **창 store에 "창 없이 실행 중"을 추가하고 Dock은 파생 값 하나만 조회 (선택)** | store 구조가 바뀐다                                                                            |

그래서 창 상태와 실행 상태를 분리했다.

- 창 store에 **창 없이 실행 중인 앱**(`alive`)을 별도로 저장하고, 앱이 `keepAlive(name, on)`으로 설정한다
- 실행 중 = 종료할 수 없는 앱(Finder) 또는 창이 있음 또는 창 없이 실행 중. Dock의 점은 이 파생 값(`isAppRunning`) 하나만 조회한다
- 음악은 **실제로 재생이 시작되는 시각**(audio의 [`playing`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playing_event) 이벤트)에 실행 상태로 설정한다. 데스크톱 진입 자체는 조건이 아니다. [자동 재생 정책](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)으로 차단되거나 파일을 불러오지 못해 소리가 나지 않으면 실행 상태가 되지 않는다
- 빨간 버튼(닫기)과 종료는 창과 함께 실행 상태도 해제한다. 실행 상태가 해제되면 음악이 정지한다. 노란 버튼(최소화)은 실행 상태를 유지하므로 계속 재생한다

```ts
export interface WindowState<Name extends string> {
	apps: AppWindows<Name>;
	desktopFocused: boolean;
	/** 창 없이도 실행 중인 앱 (음악 재생 등). 앱이 keepAlive로 켜고, 창을 닫거나(close) 종료(quit)하면 꺼진다 */
	alive: Partial<Record<Name, true>>;
}

export const isAppRunning = <Name extends string>(state: WindowState<Name>, name: Name): boolean =>
	state.apps[name].isRunning || state.alive[name] === true;
```

![실행 중을 정하는 세 조건](./images/music-player-fixes-running.svg 'Dock의 점은 세 조건 중 하나라도 참이면 표시된다')

첫 화면은 변하지 않는다. 음악 창은 열리지 않고 맨 앞 창은 그대로 Safari다. Dock의 음악을 누르면 그 시점에 창이 열린다.

## 셔플을 누르면 재생 막대에 표지가 누적된다

재생 막대의 '지금 곡' 버튼 안에 표지 `img`와 제목 `span`이 있고, 곡이 바뀔 때 새로 마운트되어 등장 애니메이션이 실행되도록 둘 다 `key={track.id}`를 지정했다. 형제 요소의 [key](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)가 같으면 React가 재조정(reconciliation) 과정에서 어느 요소를 제거할지 판별하지 못해, 곡이 바뀔 때마다 이전 요소가 남는다. 셔플 버튼은 임의의 곡을 선택하므로 누를 때마다 표지와 제목이 하나씩 누적됐다.

![형제 요소의 같은 key](./images/music-player-fixes-keys.svg '곡 id를 두 형제 요소의 key로 그대로 쓰면 이전 요소가 남는다')

```tsx
// 전
<img key={track.id} className="music-track-swap" src={track.artwork} alt="" />
<span key={track.id} className="music-track-swap">{track.title}</span>
// 후
<img key={`art-${track.id}`} className="music-track-swap" src={track.artwork} alt="" />
<span key={`title-${track.id}`} className="music-track-swap">{track.title}</span>
```

key에 역할 접두사를 붙여 `art-<곡>`, `title-<곡>`처럼 형제 요소마다 다르게 했다. React는 개발 모드에서만 중복 key 경고를 콘솔에 출력하고, 프로덕션 빌드에서는 경고 없이 요소만 누적된다. 휴대폰의 지금 재생 중 시트도 표지와 곡 정보가 같은 key를 사용하고 있어 함께 수정했다.

## 지금 재생 중을 열면 시트 닫힘 애니메이션이 반복된다

`Sheet`는 닫힐 때 복제본이 아래로 이동하며 사라지도록, ref 콜백에서 `useExitMotion`의 정리(cleanup) 함수를 반환한다. 그런데 이 ref 콜백을 렌더링마다 새로 생성했다. React 19는 ref 콜백이 바뀌면 이전 ref의 정리 함수를 호출하고 새 ref를 연결하는데, 이때 정리 함수가 닫힘 애니메이션을 실행한다. 재생 중에는 재생 시간이 바뀔 때마다 시트가 다시 렌더링되므로, 열려 있는 시트 위로 복제본이 계속 내려갔다.

ref 콜백을 `useCallback`으로 메모이제이션해, 시트가 실제로 언마운트될 때만 애니메이션이 실행된다.

```tsx
const setBox = useCallback(
	(element: HTMLDivElement | null) => {
		box.current = element;
		return variant === 'cover' ? coverExit(element) : undefined;
	},
	[variant, coverExit]
);
```

ref 콜백이 정리 함수를 반환하는 기능은 [React 19에서 추가됐다](https://react.dev/reference/react-dom/components/common#ref-callback). 정리 함수를 사용하지 않던 이전 방식에서는 ref 콜백이 매번 바뀌어도 `null`로 한 번 호출된 뒤 다시 호출될 뿐이라 드러나지 않았다. 정리 함수에 "닫힘 애니메이션" 같은 부수 효과를 연결하면, ref 콜백이 바뀌는 것 자체가 버그가 된다.

| 렌더링 시 ref 콜백     | React 18 이전                  | React 19 + 정리 함수 반환             |
| ---------------------- | ------------------------------ | ------------------------------------- |
| 매번 새로 생성         | `null`로 호출 후 재호출 (무해) | 정리 함수 실행 → 닫힘 애니메이션 반복 |
| `useCallback`으로 고정 | 마운트·언마운트 시만 호출      | 언마운트 시만 정리 함수 실행          |

## 시험

- desktop-core 단위 시험: `keepAlive`로 창 없이 실행 중 상태가 되고, 최소화해도 유지되며, 닫기·종료하면 해제된다.
- E2E: 배경 음악이 재생되면 창 없이 Dock에 음악 실행 표시가 있다. 자동 재생을 차단하면 표시되지 않는다. 최소화하면 계속 재생하고, 빨간 버튼으로 닫으면 재생이 정지하고 표시가 사라진다. 셔플을 다섯 번 눌러도 재생 막대에 표지와 제목이 하나씩이다. 지금 재생 중을 열고 다시 렌더링해도 닫힘 애니메이션의 복제본이 생성되지 않는다.

마지막 시험은 처음에 수정 전 코드에서도 통과했다. Playwright 설정이 동작 줄이기([`reducedMotion: 'reduce'`](https://playwright.dev/docs/api/class-testoptions#test-options-reduced-motion))를 켜 두어 `playExit`가 실행되지 않았기 때문이다. 그 시험만 동작 줄이기를 끄고, 복제본은 생성 직후 삭제되므로 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)로 생성 횟수를 집계하게 했다.

<details>
<summary>시험 이름 목록</summary>

`packages/desktop-core/src/window/windowStore.test.ts`의 "창 없이도 실행 중(keepAlive): 최소화해도 그대로, 창을 닫거나 종료하면 함께 꺼진다", `apps/react/e2e/music.spec.ts`의 "배경 음악이 실제로 재생되면 창 없이도 음악 앱이 실행 중이다", "자동 재생이 막혀 소리가 안 나면 음악 앱은 켜지지 않는다", "노란 버튼(최소화)은 계속 재생하고, 빨간 버튼(닫기)은 앱을 끄고 재생도 멈춘다", "셔플 버튼을 여러 번 눌러도 재생 막대에는 지금 곡 하나만 보인다", "지금 재생 중을 열고 다시 그려도 시트가 아래로 내려가는 움직임이 되풀이되지 않는다"다.

</details>

## 남은 것·정리

- 첫 커밋(`cc72fa82a`)은 `runningAtStart`로 증상을 가렸고, 두 번째 커밋(`8b64610ba`)에서 그 변경을 되돌리고 store를 분리했다. `manifest.ts`와 `initialWindows.ts`는 두 커밋에서 추가했다가 되돌린 줄이 거의 같다. 증상을 가리는 수정이 먼저 들어가면 원인을 수정할 때 그만큼 다시 삭제해야 한다.
- `isRunning`이라는 이름이 "창이 있다"를 뜻하는 것이 혼란의 근본 원인이었다. 이름은 유지하고 주석으로 의미를 기록했다. 이후 `hasWindow`처럼 이름을 바꾸는 것이 남은 작업이다.
- 동작 줄이기가 켜진 시험 환경에서는 애니메이션 버그가 드러나지 않는다. 애니메이션을 검증하는 시험은 그 설정을 끄고 실행해야 한다. 이것은 [E2E 시험 2 - Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)에서 정한 기본값이 놓친 경우였다.

## 관련 글

- [E2E 시험 2 - Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [휴대폰 화면 3 - 셸 공통 CSS 사용자 정의 속성으로 휴대폰 앱의 바탕·카드 색 통일하기](/memo/mobile-apps-ios-style)
- [메뉴 막대 3 - 창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기](/memo/menu-bar-app-name)
- [위젯 2 - iOS Safari의 filter 합성 레이어에서 빠지는 border-radius 클리핑과 clip-path](/memo/music-widget-ios-corners)

#MacFolio #프론트엔드 #음악 #React #상태설계
