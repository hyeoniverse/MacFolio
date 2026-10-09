---
title: 음악 플레이어를 둘로 나누기 - 무엇을 틀지와 어떻게 틀지
date: 2026-10-09
category: 개발기/MacFolio/데스크톱
summary: 음악 앱의 MusicContext는 재생 목록·셔플·반복으로 다음 곡을 정하는 일과 audio 요소를 틀고 멈추는 일을 한 컴포넌트에서 했다. 앞쪽을 desktop-core의 플레이어 store로 옮기고, 동작마다 'moved', 'stopped', 'restart' 같은 결과를 돌려주게 했다. React는 그 결과를 보고 audio만 다룬다.
---

desktop-core 분리(#16)의 마지막 로직 이동은 음악이다. [창 관리](/memo/desktop-core-windows)와 [메모](/memo/desktop-core-memo)는 거의 순수 함수였고 브라우저와 닿는 부분만 떼어 내면 됐다. 음악은 사정이 조금 달랐다. 이 앱의 핵심은 소리를 내는 것이고, 그건 `<audio>` 요소 없이는 할 수 없다.

## 섞여 있던 두 가지

`MusicContext`의 "다음 곡" 단추는 이랬다.

```ts
const next = useCallback(() => {
	const position = nextPosition(queue, repeat);
	if (position === null) {
		pause();
		goTo(0, false);
	} else goTo(position, isPlaying);
}, [queue, repeat, isPlaying, goTo, pause]);
```

한 함수 안에서 두 가지를 정한다.

1. 대기열의 어디로 갈지 (`nextPosition`: 끝에서 반복이 꺼져 있으면 `null`)
2. 소리를 어떻게 할지 (`pause()`, 곡을 처음부터, 재생 중이었으면 이어서)

1은 재생 목록, 셔플, 반복만 알면 된다. 2는 `HTMLAudioElement`를 알아야 한다. "이전 곡", "곡이 끝났을 때", "재생 목록에서 곡 고르기", "셔플 켜기"도 모두 이 모양이었다. 대기열을 계산하는 순수 함수(`nextPosition`, `buildQueue` 등)는 이미 `library.ts`에 따로 있었지만, 대기열과 셔플·반복 상태는 React의 `useState`에 있었다.

## 결과를 돌려주는 store

core에 플레이어 store를 만들었다. 상태는 네 가지다.

```ts
interface PlayerState {
	playlistId: string;
	queue: Queue;
	shuffle: boolean;
	repeat: RepeatMode;
}
```

재생 중인지, 몇 초째인지, 음량은 넣지 않았다. 이것들은 audio 요소가 알려 주는 값이라 React 쪽에 그대로 둔다.

동작은 상태를 바꾸고 결과를 돌려준다. 소리를 어떻게 할지는 이 결과를 받은 쪽이 정한다.

| 동작                 | 돌려주는 값                          | React가 하는 일                            |
| -------------------- | ------------------------------------ | ------------------------------------------ |
| `next()`             | `'moved'` / `'stopped'`              | 옮겼으면 곡을 처음부터, 멈췄으면 `pause()` |
| `previous(초)`       | `'moved'` / `'restart'`              | 3초 넘게 들었으면 지금 곡을 처음부터       |
| `ended()`            | `'repeat'` / `'moved'` / `'stopped'` | 한 곡 반복이면 같은 곡을 다시 `play()`     |
| `playFrom(목록, 곡)` | 없음                                 | 이어서 재생                                |

`previous`가 지금 재생 시간을 인자로 받는 것도 같은 이유다. store는 audio를 모르니, 몇 초를 들었는지는 React가 `audio.currentTime`에서 읽어 넘긴다.

React 쪽은 이렇게 바뀌었다.

```ts
const next = useCallback(() => {
	if (player.next() === 'stopped') {
		pause();
		startTrack(false);
	} else startTrack(isPlaying);
}, [player, isPlaying, startTrack, pause]);
```

의존성 목록에서 `queue`와 `repeat`이 빠졌다. 대기열을 읽는 일이 store 안으로 들어갔기 때문이다.

## 같은 곡으로 "옮기기"

옮기면서 놓치기 쉬운 동작이 하나 있었다. 원래 코드는 곡을 옮길 때 위치가 같아도 대기열 객체를 새로 만들었다.

```ts
setQueue((prev) => ({ ...prev, position }));
```

React 쪽 effect는 `queue`가 바뀌면 곡을 다시 튼다. 곡이 하나뿐인 목록에서 모두 반복으로 "다음 곡"을 누르면 위치는 0에서 0이지만, 객체가 새로 생기니 effect가 돌아 처음부터 다시 재생된다.

store로 옮기면서 "위치가 같으면 상태를 그대로 둔다"는 정리를 넣고 싶어지는데, 그러면 이 경우에 곡이 다시 시작되지 않는다. 그래서 store에서도 위치가 같든 다르든 대기열 객체를 새로 만들게 하고, 이 동작을 시험으로 남겼다.

```ts
it('같은 위치로 가도 새 대기열을 만든다 (앱이 곡을 처음부터 다시 틀도록)', () => {
	const player = createPlayerStore({ trackIdsOf: () => ['solo'], playlistId: 'all' });
	const before = player.getState().queue;
	player.next();
	expect(player.getState().queue).not.toBe(before);
});
```

## 곡 목록은 앱에

곡 목록(`TRACKS`)은 core로 옮기지 않았다. 곡마다 파일 주소가 `env.musicUrl`에서 오는데, 이건 Vite가 빌드할 때 넣는 값이다. core는 곡 id 목록만 받는다.

```ts
createPlayerStore({ trackIdsOf: (id) => findPlaylist(id).trackIds, playlistId: ALL_SONGS });
```

곡을 앨범·아티스트로 묶는 `groupTracks`와 대기열 계산, 시간 표시(`3:07`, `12분`)는 데이터와 상관없는 함수라 core로 옮겼다.

## 확인

- core: 플레이어 store 시험 7개, 대기열 시험 12개
- Playwright 354개. 음악 앱의 곡 고르기, 셔플·반복, 다음 곡 시험이 그대로 통과했다

이것으로 #16에서 계획한 창 관리, 메모, 음악 세 가지를 모두 옮겼다. 남은 것은 서버와 함께 쓸 규칙(폴더 정리, 글 검사)을 어디에 둘지 정하는 일이다.

#MacFolio #데스크톱 #리팩터링
