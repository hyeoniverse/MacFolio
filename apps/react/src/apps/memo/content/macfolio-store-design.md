---
title: MacFolio의 store 설계 - Flux·Redux에서 따른 것과 뺀 것
date: 2026-10-26
category: 개발기/MacFolio/프론트엔드
summary: MacFolio는 창·로그인·알림 상태를 desktop-core의 createStore로 만들고 React는 useSyncExternalStore로 구독한다. Flux·Redux에서 단방향 흐름과 불변 갱신은 따르고 Action·Dispatcher·단일 store는 뺀 이유, ESLint가 흐름을 강제하는 구조를 정리했다.
---

Flux 패턴 자체(등장 배경, Action·Dispatcher·Store·View, Redux와 외부 store)는 [Flux 패턴](/memo/flux-pattern)에 정리했다. 이 글은 그 구조를 MacFolio의 상태 저장소에 어떻게 적용했는지, 무엇을 따르고 무엇을 뺐는지를 코드 기준으로 정리한다.

## createStore와 창 store

MacFolio는 창 상태·설정·로그인·알림 등 React 밖의 상태를 `packages/desktop-core`의 `createStore`로 만든다. 2026-10-26 main 기준으로 React 앱과 core를 합쳐 `createStore` 호출이 44개 파일에 48곳, `useSyncExternalStore` 구독이 41개 파일에 44곳 있다(시험·글 파일 제외).

```ts
export function createStore<State extends object>(initialState: State): Store<State> {
	let state = initialState;
	const listeners = new Set<(state: State) => void>();
	return {
		getState: () => state,
		setState: (update) => {
			const next = typeof update === 'function' ? update(state) : { ...state, ...update };
			if (Object.is(next, state)) return;
			state = next;
			listeners.forEach((listener) => listener(state));
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
```

창 store(`window/windowStore.ts`)는 이 위에 `open`·`close`·`minimize`·`bringToFront` 같은 메서드를 둔다. Dock에서 메모를 열면 다음 순서로 흐른다.

![MacFolio의 창 상태가 흐르는 길](./images/macfolio-store-design-flow.svg 'View는 store 메서드를 호출하고, store는 새 상태를 만들어 구독자에게 알리고, React는 useSyncExternalStore로 다시 렌더링한다. Action 객체와 Dispatcher는 없다')

```ts
// windowStore.ts: 여는 앱은 맨 앞으로. 상태는 새 객체로 만든다
open: (name: Name) =>
	update((apps) => {
		const fronted = bringToFront(apps, name);
		return { ...fronted, [name]: { ...fronted[name], isRunning: true, hasOpened: true } };
	}, false),

// AppStateContext.tsx: React는 구독만 한다
const state = useSyncExternalStore(store.subscribe, store.getState);
```

## Flux·Redux·Zustand와 비교

| 항목       | Flux                | Redux        | Zustand    | MacFolio     |
| ---------- | ------------------- | ------------ | ---------- | ------------ |
| 변경 입구  | Action → Dispatcher | `dispatch`   | store 함수 | store 메서드 |
| Action     | 있음                | 있음         | 없음       | 없음         |
| Dispatcher | 있음                | 없음         | 없음       | 없음         |
| store 수   | 여럿                | 하나         | 하나 권장  | 여럿         |
| 갱신       | Store 내부 갱신     | 순수 reducer | `set` 병합 | 새 객체      |
| 변경 기록  | 직접 구현           | DevTools     | `devtools` | 없음         |

표의 Zustand는 vanilla store와 문서의 권장 방식 기준이다. Redux와 Zustand의 변경 기록은 Redux DevTools를 쓴다(Zustand는 `devtools` 미들웨어). MacFolio의 '새 객체'는 메서드가 새 상태 객체를 만들고, `setState`가 이전 상태와 같은 객체면 구독자에게 알리지 않는다는 뜻이다.

## 따른 것

- **단방향 흐름:** View는 store 메서드를 호출할 뿐 상태 객체를 직접 수정하지 않는다. 바뀐 상태는 store → 구독자 한 방향으로만 나간다.
- **불변 갱신:** 메서드는 기존 상태를 고치지 않고 새 객체를 만든다(`{ ...state, apps: … }`). `setState`가 `Object.is`로 같은 객체인지 비교해 바뀌지 않았으면 알리지 않는데, 이것은 `useSyncExternalStore`가 `getSnapshot`에 요구하는 조건("store가 바뀌지 않았으면 같은 값")과 같다.
- **로직의 위치:** "창을 열면 맨 앞으로 온다" 같은 규칙은 Flux의 Store처럼 store 안에 있다. 그래서 React를 렌더링하지 않고 store를 만들어 메서드를 호출하는 것만으로 규칙을 시험할 수 있다(`windowStore.test.ts`, `stack.test.ts`).

## 뺀 것과 이유

- **Action 객체와 Dispatcher가 없다.** 창 store의 동작은 메서드 이름(`open`, `quit`, `keepAlive` …)이 곧 동작의 종류다. 동작 종류마다 `type` 문자열과 분기를 따로 두지 않아도 TypeScript가 메서드와 인자를 검사한다.
- **store가 하나가 아니다.** Redux·Zustand가 권하는 단일 store 대신 관심사마다 store를 따로 둔다(창, 로그인, 알림, 음악 재생 등). 컴포넌트는 필요한 store만 `useSyncExternalStore`로 구독하므로, 알림 store가 바뀌어도 창 상태만 구독하는 Dock은 다시 렌더링되지 않는다. 단일 store였다면 선택자(selector)로 같은 효과를 내야 한다.
- **store 사이의 순서를 관리하지 않는다.** 창·설정·로그인 store는 서로의 갱신 결과에 의존하지 않아 `waitFor`가 필요한 경우가 없었다.
- **변경 기록이 없다.** Action이 없으니 Redux DevTools 같은 기록·재생은 할 수 없다. 상태가 작고, 동작은 메서드 단위 시험으로 확인한다.

이 선택은 창 관리를 React 밖으로 옮긴 [#139](https://github.com/hyeoniverse/MacFolio/pull/139)에서 정했다. 당시 Context에 reducer만 분리하는 방법, zustand를 쓰는 방법, 직접 만든 작은 store를 비교했고, 의존성 없이 React 18 기본 API로 구독할 수 있는 마지막 방법을 골랐다([창 관리를 React 밖으로](/memo/desktop-core-windows)). 형태가 Zustand의 vanilla store와 거의 같은 것은 같은 문제(React 밖에 상태를 두고 구독)를 같은 방식으로 풀었기 때문이다.

## 프레임워크 분리가 단방향 흐름을 강제한다

`packages/desktop-core`는 ESLint의 `no-restricted-imports`로 `react`·`vue`·`@/*`(React 앱 경로) import를 막고, `tsconfig`에서 DOM 타입을 빼 두었다[^core-guard]. core가 View 쪽 코드를 import할 수 없으니, core 안의 store는 View에 직접 값을 넣을 방법이 없다. View는 `subscribe`로 알림을 받아 `getState`로 읽는 것밖에 할 수 없다. 단방향 흐름을 코드 리뷰가 아니라 빌드 단계의 검사가 강제하는 구조다.

## 관련 글

- [Flux 패턴 — Action·Dispatcher·Store·View의 단방향 흐름과 그 뒤의 Redux, 외부 store](/memo/flux-pattern): 이 글이 비교하는 Flux·Redux·외부 store의 일반론
- [창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계](/memo/desktop-core-windows): `createStore`와 `useSyncExternalStore`를 고른 과정 ([#139](https://github.com/hyeoniverse/MacFolio/pull/139))
- [메모 로직을 desktop-core로 - localStorage는 어디에 둘까](/memo/desktop-core-memo): 같은 store 구조를 메모 로직에 적용
- [음악 플레이어를 둘로 나누기 - 무엇을 재생할지와 어떻게 재생할지](/memo/desktop-core-music): 재생 상태 store와 오디오 재생의 분리
- [화면과 서버가 같은 규칙을 쓰기 - 소스는 Vite가, 빌드 결과는 Node가](/memo/desktop-core-shared-rules): core의 규칙을 API 서버도 쓰는 구조

[^core-guard]: core에 `import { useState } from 'react'`나 `window.innerWidth`를 넣으면 `tsc`와 ESLint가 오류를 낸다. 세 가지 검사(타입 설정, 의존성 선언, lint)는 [창 관리를 React 밖으로](/memo/desktop-core-windows)의 "core의 React 의존을 막는 세 장치"에 정리했다.

#MacFolio #React #상태관리 #아키텍처
