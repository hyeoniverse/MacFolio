---
title: 음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 배경 음악이 나오는데 Dock의 음악은 꺼져 있었고, 셔플을 누르면 표지가 쌓였고, 지금 재생 중 시트가 끝없이 내려갔다. 창과 실행이 섞인 isRunning, 형제끼리 같은 React key, 그릴 때마다 새로 만든 ref 함수가 원인이었다.
---

음악 앱에서 버그 세 가지를 고쳤다([PR #257](https://github.com/hyeoniverse/MacFolio/pull/257)). 셋 다 화면만 보면 이상한데, 원인은 한 줄씩이었다.

| 증상                                         | 재현                                     | 원인                                                | 고친 곳                              |
| -------------------------------------------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------------ |
| 소리가 나는데 Dock의 음악에 켜짐 표시가 없다 | 로딩 화면을 눌러 데스크톱에 들어간다     | `isRunning` 하나에 "창이 있다"와 "실행 중"이 섞였다 | `windowStore.ts`, `MusicContext.tsx` |
| 재생 막대에 표지·제목이 쌓인다               | 셔플 버튼을 여러 번 누른다               | 형제 `img`·`span`이 같은 `key`                      | `Music.tsx`                          |
| 지금 재생 중 시트가 계속 내려간다            | 휴대폰에서 재생 중에 지금 재생 중을 연다 | 그릴 때마다 새 ref 함수                             | `Sheet.tsx`                          |

## 배경 음악이 나오는데 음악 앱은 꺼져 있다

데스크톱은 로딩 화면을 넘기면 `startMusic` 이벤트로 배경 음악을 튼다. 소리는 나는데 Dock의 음악 앱에는 켜짐 표시가 없었다.

처음에는 `runningAtStart`에 `'minimized'`를 더해, 창을 내려 둔 채로 켜서 점을 띄웠다. 점은 나왔지만 증상만 가린 것이었다. 들여다보니 구조가 어긋나 있었다.

- desktop-core 창 store의 `isRunning`은 사실 **창이 있다**는 뜻이다. 창을 닫으면 거짓이 된다
- 그런데 Dock의 점도 같은 값을 읽었다. "창이 있다"와 "앱이 실행 중이다"가 한 값에 섞여 있었다. Finder의 `alwaysRunning`, 공유의 알림 동안 켜짐은 이 섞임을 덧대 막은 예외였다
- 소리는 화면 맨 위의 `MusicProvider`가 창과 상관없이 낸다. 그러니 소리는 나는데 창이 없어 점이 없었다
- 예전에는 음악 앱이 `runningAtStart: true`라 처음부터 창이 있었고, 두 뜻이 우연히 맞았다. 음악 앱을 개편하면서 이 값이 빠져 어긋났다

고칠 방법은 셋이었다.

| 방법                                                                     | 문제                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 처음부터 음악 창을 최소화한 채 켠다 (`runningAtStart: 'minimized'`)      | 점은 나오지만 창이 생긴다. 소리가 안 나도 켜짐 표시가 뜬다. 처음에 이렇게 했다가 되돌렸다 |
| Dock이 음악만 따로 `MusicContext`의 재생 상태를 본다                     | Finder·공유처럼 예외가 하나 더 늘 뿐이다                                                  |
| 창 store에 "창 없이 실행 중"을 두고 Dock은 그 계산 값 하나만 본다 (고름) | store 모양이 바뀐다                                                                       |

그래서 창과 실행을 나눴다.

- 창 store에 **창 없이 실행 중인 앱**(`alive`)을 따로 두고, 앱이 `keepAlive(name, on)`으로 켠다
- 실행 중 = 끌 수 없는 앱(Finder) 또는 창이 있음 또는 창 없이 실행 중. Dock의 점은 이 값(`isAppRunning`) 하나만 본다
- 음악은 **실제로 소리가 나기 시작할 때**(audio의 `playing` 이벤트) 켠다. 처음 들어왔다는 것이 조건이 아니다. 자동 재생이 막히거나 파일을 못 불러와 소리가 안 나면 켜지지 않는다
- 빨간 버튼(닫기)과 종료는 창과 함께 실행도 끈다. 실행이 꺼지면 음악이 멈춘다. 노란 버튼(최소화)은 실행 그대로라 계속 재생한다

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

![실행 중을 정하는 세 조건](./images/music-player-fixes-running.svg 'Dock의 점은 세 조건 중 하나라도 맞으면 켜진다')

처음 화면은 바뀌지 않는다. 음악 창은 열리지 않고 맨 앞은 그대로 Safari다. Dock의 음악을 누르면 그때 창이 열린다.

## 셔플을 누르면 재생 막대에 표지가 쌓인다

재생 막대의 '지금 곡' 버튼 안에 표지 `img`와 제목 `span`이 있고, 곡이 바뀔 때 새로 나타나게 둘 다 `key={track.id}`를 주었다. 형제끼리 key가 같으면 React가 어느 요소를 지울지 맞추지 못해, 곡이 바뀔 때마다 옛 요소가 남는다. 셔플 버튼은 아무 곡이나 고르므로 누를 때마다 표지와 제목이 하나씩 쌓였다.

![형제끼리 같은 key](./images/music-player-fixes-keys.svg '곡 id를 두 형제에 그대로 쓰면 옛 요소가 남는다')

```tsx
// 전
<img key={track.id} className="music-track-swap" src={track.artwork} alt="" />
<span key={track.id} className="music-track-swap">{track.title}</span>
// 후
<img key={`art-${track.id}`} className="music-track-swap" src={track.artwork} alt="" />
<span key={`title-${track.id}`} className="music-track-swap">{track.title}</span>
```

key에 자리 이름을 붙여 `art-<곡>`, `title-<곡>`처럼 형제끼리 다르게 했다. React는 개발 모드에서만 같은 key 경고를 콘솔에 내고, 배포 빌드에서는 경고 없이 요소만 쌓인다. 휴대폰의 지금 재생 중 시트도 표지와 곡 정보가 같은 key를 쓰고 있어 함께 고쳤다.

## 지금 재생 중을 열면 시트가 끝없이 내려간다

`Sheet`는 닫힐 때 복사본이 아래로 내려가며 사라지게, ref 함수에서 `useExitMotion`의 정리 함수를 돌려준다. 그런데 이 ref 함수를 그릴 때마다 새로 만들었다. React 19는 ref 함수가 바뀌면 옛 ref를 정리하고 새 ref를 거는데, 이때 정리 함수가 사라지는 움직임을 돌린다. 재생 중에는 재생 시간이 바뀔 때마다 시트가 다시 그려지므로, 열려 있는 시트 위로 복사본이 끝없이 내려갔다.

ref 함수를 `useCallback`으로 한 번만 만들어, 시트가 정말 빠질 때만 움직임이 돈다.

```tsx
const setBox = useCallback(
	(element: HTMLDivElement | null) => {
		box.current = element;
		return variant === 'cover' ? coverExit(element) : undefined;
	},
	[variant, coverExit]
);
```

ref 함수가 정리 함수를 돌려주는 것은 React 19에 새로 생긴 기능이다. 정리 함수를 쓰지 않던 예전에는 ref 함수가 매번 바뀌어도 `null`로 한 번 불리고 다시 불릴 뿐이라 눈에 띄지 않았다. 정리 함수에 "사라지는 움직임" 같은 부수 효과를 걸면, ref 함수가 바뀌는 것 자체가 버그가 된다.

## 시험

- desktop-core 단위 시험: `keepAlive`로 창 없이 실행 중이고, 최소화해도 그대로, 닫기·종료하면 꺼진다.
- E2E: 배경 음악이 재생되면 창 없이 Dock에 음악 켜짐 표시가 있다. 자동 재생을 막으면 켜지지 않는다. 최소화하면 계속 재생하고, 빨간 버튼으로 닫으면 재생이 멈추고 표시가 꺼진다. 셔플을 다섯 번 눌러도 재생 막대에 표지와 제목이 하나씩이다. 지금 재생 중을 열고 다시 그려도 사라지는 움직임의 복사본이 하나도 생기지 않는다.

마지막 시험은 처음에 고치기 전에도 통과했다. Playwright 설정이 움직임 줄이기를 켜 두어 `playExit`가 아예 돌지 않았기 때문이다. 그 시험만 움직임 줄이기를 끄고, 복사본은 금방 지워지므로 `MutationObserver`로 생기는 순간을 세게 했다.

시험 이름으로 보면 `packages/desktop-core/src/window/windowStore.test.ts`의 "창 없이도 실행 중(keepAlive): 최소화해도 그대로, 창을 닫거나 종료하면 함께 꺼진다", `apps/react/e2e/music.spec.ts`의 "배경 음악이 실제로 재생되면 창 없이도 음악 앱이 실행 중이다", "자동 재생이 막혀 소리가 안 나면 음악 앱은 켜지지 않는다", "노란 버튼(최소화)은 계속 재생하고, 빨간 버튼(닫기)은 앱을 끄고 재생도 멈춘다", "셔플 버튼을 여러 번 눌러도 재생 막대에는 지금 곡 하나만 보인다", "지금 재생 중을 열고 다시 그려도 시트가 아래로 내려가는 움직임이 되풀이되지 않는다"다.

## 남은 것·배운 것

- 첫 커밋(`cc72fa82a`)은 `runningAtStart`로 증상을 가렸고, 두 번째 커밋(`8b64610ba`)에서 그것을 되돌리고 store를 나눴다. `manifest.ts`와 `initialWindows.ts`는 두 커밋에서 더했다가 되돌린 줄이 거의 같다. 증상을 가리는 수정이 들어가면 원인을 고칠 때 그만큼 다시 지워야 한다.
- `isRunning`이라는 이름이 "창이 있다"를 뜻하는 것이 혼란의 뿌리였다. 이름은 그대로 두고 주석으로 뜻을 적었다. 언젠가 `hasWindow`처럼 이름을 바꾸는 편이 낫다.
- 움직임 줄이기가 켜진 시험 환경에서는 애니메이션 버그가 숨는다. 움직임을 다루는 시험은 그 설정을 끄고 돌려야 한다. 이것은 [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)에서 정한 기본값의 빈틈이었다.

## 관련 글

- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)
- [휴대폰 앱들을 메모처럼](/memo/mobile-apps-ios-style)
- [메뉴 막대의 앱 이름이 맨 앞 창을 따른다](/memo/menu-bar-app-name)

#MacFolio #프론트엔드 #음악 #React #상태설계
