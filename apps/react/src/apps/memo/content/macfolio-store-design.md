---
title: createStore와 useSyncExternalStore 기반 store에서 Flux·Redux를 따른 것과 뺀 것
date: 2026-10-26
category: 개발 기록/MacFolio/구조·상태 관리
series: desktop-core
seriesOrder: 3
summary: MacFolio는 창·로그인·알림 상태를 desktop-core의 createStore로 만들고 React는 useSyncExternalStore로 구독한다. Flux·Redux에서 단방향 흐름과 불변 갱신은 따르고 Action·Dispatcher·단일 store는 뺀 이유, ESLint가 흐름을 강제하는 구조를 정리했다.
---

## 배경: 상태와 store

MacFolio 화면에는 창이 여러 개 떠 있다. 어느 앱이 실행 중인지, 어느 창이 맨 앞인지, 어느 창이 최소화됐는지 같은 정보를 **상태(state)**라고 한다. 상태가 바뀌면 화면도 바뀌어야 한다. Dock에서 메모 아이콘을 누르면 메모 창이 맨 앞에 나타나고, Dock 아이콘 아래에 실행 중 표시가 생기고, 메뉴 막대의 앱 이름이 '메모'로 바뀐다. 상태 하나의 변경이 화면 세 곳에 반영된다.

**store(상태 저장소)**는 이런 상태를 한곳에 보관하고, 상태를 바꾸는 함수와 변경을 알리는 구독 기능을 함께 제공하는 객체다. 화면 컴포넌트는 store에 "바뀌면 알려 달라"고 구독을 등록해 두고, 알림을 받으면 새 상태를 읽어 다시 그린다. 여러 컴포넌트가 같은 상태를 각자 복사해 들고 있으면 한쪽만 갱신되는 불일치가 생기므로, 상태의 원본을 store 하나에 보관한다.

![Facebook이 공개한 Flux 구조도](./images/macfolio-store-design-flux-diagram.png 'Flux의 네 요소. Action이 Dispatcher를 거쳐 Store로 가고, Store가 View를 갱신한다. View에서 생긴 Action도 다시 Dispatcher로 들어간다')

이 구조를 처음 체계화한 것은 Facebook이 2014년에 공개한 **Flux**패턴이다. 위 그림처럼 화면(View)에서 일어난 일을 Action 객체로 만들고, Dispatcher가 그 Action을 모든 Store에 전달하고, Store가 상태를 갱신해 View에 알린다. 데이터가 한 방향으로만 움직이므로 "이 상태를 누가 바꿨나"를 추적하기 쉽다. 이후 Redux는 Store를 하나로 합치고 Dispatcher 대신 순수 함수 reducer로 상태를 계산했다. Zustand 같은 최근 라이브러리는 Action 객체 없이 store 함수를 직접 호출한다.

Flux 자체의 등장 배경과 요소별 역할은 [Flux 패턴](/memo/flux-pattern)에 정리했다.

## createStore: 상태 저장소의 최소 구현

MacFolio는 창 상태·설정·로그인·알림처럼 React 컴포넌트 바깥에 보관하는 상태를 `packages/desktop-core`의 `createStore`로 만든다. 2026-10-26 main 기준으로 React 앱과 core를 합쳐 `createStore` 호출이 44개 파일에 48곳, `useSyncExternalStore` 구독이 41개 파일에 44곳 있다(시험·글 파일 제외).

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

store가 제공하는 함수는 세 개다.

| 함수        | 역할                                                                      | 호출하는 쪽            |
| ----------- | ------------------------------------------------------------------------- | ---------------------- |
| `getState`  | 지금 상태 객체를 반환한다                                                 | 화면 컴포넌트          |
| `setState`  | 새 상태를 저장하고, 이전 상태와 다른 객체이면 구독자 함수를 모두 호출한다 | store 메서드           |
| `subscribe` | 구독자 함수를 등록하고, 등록을 해제하는 함수를 반환한다                   | `useSyncExternalStore` |

React 쪽은 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)로 이 store를 구독한다. React 18에 추가된 기본 Hook으로, 이름 그대로 React 바깥(external)의 store를 동기(sync) 방식으로 읽는다. 인자는 두 개다. `subscribe`는 store가 바뀌면 React에 알리는 함수를 등록하고, `getSnapshot`은 지금 상태를 반환한다. React는 알림을 받으면 `getSnapshot`을 다시 호출하고, 반환값이 이전과 다르면 컴포넌트를 다시 렌더링한다.

```ts
// AppStateContext.tsx: React는 구독만 한다
const state = useSyncExternalStore(store.subscribe, store.getState);
```

## 창 store에서 상태가 이동하는 순서

창 store(`window/windowStore.ts`)는 `createStore` 위에 `open`·`close`·`minimize`·`bringToFront` 같은 메서드를 정의한다. 화면은 이 메서드만 호출한다.

```ts
// windowStore.ts: 여는 앱은 맨 앞으로. 상태는 새 객체로 만든다
open: (name: Name) =>
	update((apps) => {
		const fronted = bringToFront(apps, name);
		return { ...fronted, [name]: { ...fronted[name], isRunning: true, hasOpened: true } };
	}, false),
```

`bringToFront`는 대상 앱을 뺀 나머지 앱을 기존 `zIndex` 순서대로 0부터 다시 번호 매기고, 대상 앱에 가장 큰 번호를 준다. `zIndex`는 CSS에서 겹친 요소의 앞뒤 순서를 정하는 값이고, 값이 클수록 앞에 그려진다. 예를 들어 Safari와 음악이 실행 중인 상태에서 Dock의 메모를 누르면 상태 객체는 다음처럼 바뀐다.

| 앱     | 누르기 전                       | `open('memo')` 뒤                                 |
| ------ | ------------------------------- | ------------------------------------------------- |
| Safari | `zIndex: 1`, `isRunning: true`  | `zIndex: 0`, `isRunning: true`                    |
| 음악   | `zIndex: 2`, `isRunning: true`  | `zIndex: 1`, `isRunning: true`                    |
| 메모   | `zIndex: 0`, `isRunning: false` | `zIndex: 2`, `isRunning: true`, `hasOpened: true` |

![MacFolio의 창 상태가 흐르는 길](./images/macfolio-store-design-flow.svg 'View는 store 메서드를 호출하고, store는 새 상태를 만들어 구독자에게 알리고, React는 useSyncExternalStore로 다시 렌더링한다. Action 객체와 Dispatcher는 없다')

위 그림의 번호 순서대로 ① Dock 클릭 처리기가 `open('memo')`를 호출하고, ② `setState`가 새 객체를 저장하고, ③ 구독자 함수가 호출되고, ④ `useSyncExternalStore`를 쓴 컴포넌트가 새 상태로 다시 렌더링한다.

## Flux·Redux·Zustand와 비교

같은 "메모 창 열기"를 세 구조로 처리하면 단계 수가 다르다.

![같은 동작을 Flux·Redux·MacFolio 구조로 처리하는 순서](./images/macfolio-store-design-three-shapes.svg 'Flux와 Redux는 View와 Store 사이에 Action 객체를 만들고 전달하는 단계가 있다. MacFolio는 View가 store 메서드를 직접 호출한다. 세 구조 모두 상태가 한 방향으로만 이동한다')

| 항목       | Flux                | Redux        | Zustand    | MacFolio     |
| ---------- | ------------------- | ------------ | ---------- | ------------ |
| 변경 입구  | Action → Dispatcher | `dispatch`   | store 함수 | store 메서드 |
| Action     | 있음                | 있음         | 없음       | 없음         |
| Dispatcher | 있음                | 없음         | 없음       | 없음         |
| store 수   | 여럿                | 하나         | 하나 권장  | 여럿         |
| 갱신       | Store 내부 갱신     | 순수 reducer | `set` 병합 | 새 객체      |
| 변경 기록  | 직접 구현           | DevTools     | `devtools` | 없음         |

표의 Zustand는 vanilla store와 문서의 권장 방식 기준이다. Redux와 Zustand의 변경 기록은 Redux DevTools 브라우저 확장을 쓴다(Zustand는 `devtools` 미들웨어로 연결). MacFolio의 '새 객체'는 메서드가 기존 객체를 수정하지 않고 새 상태 객체를 만들며, `setState`가 이전 상태와 같은 객체를 받으면 구독자에게 알리지 않는다는 뜻이다.

## 따른 것

### 단방향 흐름

View는 store 메서드를 호출할 뿐 상태 객체를 직접 수정하지 않는다. 바뀐 상태는 store → 구독자 한 방향으로만 전달된다. 예를 들어 Dock 컴포넌트 안에서 `state.apps.memo.isRunning = true`처럼 값을 직접 바꾸는 코드는 쓰지 않는다. 이렇게 바꾸면 store가 변경을 알 수 없어 메뉴 막대와 창은 갱신되지 않는다.

### 불변 갱신

**불변 갱신(immutable update)**은 기존 객체를 고치지 않고, 바뀐 부분만 새로 만든 객체로 교체하는 방식이다. 메서드는 `{ ...state, apps: … }`처럼 펼침 문법으로 새 객체를 만든다. `setState`는 [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)로 새 값이 이전 값과 같은 객체인지 비교하고, 같으면 알리지 않는다.

```ts
const a = { memo: { isRunning: true } };
a.memo.isRunning = false; // 직접 수정: 같은 객체 → Object.is(a, a)는 true, 변경을 감지하지 못한다
const b = { ...a, memo: { ...a.memo, isRunning: false } }; // 새 객체 → Object.is(a, b)는 false
```

이 규칙은 `useSyncExternalStore`가 `getSnapshot`에 요구하는 조건과 같다. React 문서는 "store가 바뀌지 않았으면 `getSnapshot`이 같은 값을 반환해야 한다"고 명시한다. 상태를 직접 수정하면 객체 참조가 그대로라 React가 변경을 감지하지 못하고, 매번 새 객체를 반환하면 변경이 없어도 무한히 다시 렌더링한다.

### 로직의 위치

"창을 열면 맨 앞으로 온다" 같은 규칙은 Flux의 Store처럼 store 안에 있다. 컴포넌트에는 버튼을 누르면 메서드를 호출하는 코드만 남는다. 그래서 ==React를 렌더링하지 않고 store를 만들어 메서드를 호출하는 것만으로 규칙을 시험할 수 있다==(`windowStore.test.ts`, `stack.test.ts`). 예를 들어 `open('memo')`를 호출한 뒤 `getState().memo.zIndex`가 가장 큰 값인지 검사하는 시험은 브라우저 없이 Node에서 실행된다.

## 뺀 것과 이유

### Action 객체와 Dispatcher

Flux와 Redux에서는 "메모를 연다"를 `{ type: 'app/open', payload: 'memo' }` 같은 Action 객체로 만들고, store가 `type` 문자열을 `switch`로 분기해 처리한다. 창 store는 메서드 이름(`open`, `quit`, `keepAlive` …)이 곧 동작의 종류다. 동작마다 `type` 문자열과 분기를 따로 만들지 않아도 TypeScript가 메서드 이름과 인자 타입을 검사한다. Action 방식에서는 `type: 'app/opne'`처럼 문자열을 잘못 써도 `switch`의 어느 분기에도 걸리지 않고 조용히 무시될 수 있지만, 메서드 방식에서 `store.opne('memo')`라고 쓰면 `tsc`가 존재하지 않는 속성이라는 오류를 낸다.

### 단일 store

Redux와 Zustand는 앱 전체 상태를 store 하나에 모으기를 권한다. MacFolio는 관심사마다 store를 따로 만든다(창, 로그인, 알림, 음악 재생 등). 컴포넌트는 필요한 store만 `useSyncExternalStore`로 구독하므로, ==알림 store가 바뀌어도 창 상태만 구독하는 Dock은 다시 렌더링되지 않는다==.

![관심사별 store와 단일 store에서 알림 하나가 왔을 때 호출되는 구독자](./images/macfolio-store-design-split-stores.svg '왼쪽은 알림 store의 구독자인 알림 배너만 호출된다. 오른쪽 단일 store에서는 구독자 셋이 모두 호출되고, Dock과 Apple 메뉴는 selector 비교 후 렌더링을 생략한다')

단일 store에서도 같은 결과를 낼 수 있다. **selector**는 전체 상태에서 컴포넌트가 쓰는 부분만 골라내는 함수(예: `(state) => state.windows`)이고, 라이브러리는 selector의 반환값이 이전과 같으면 렌더링을 생략한다. 차이는 위 그림처럼 변경마다 모든 구독자의 selector가 실행되느냐, 바뀐 store의 구독자만 호출되느냐다.

### store 사이의 실행 순서 관리

Flux의 Dispatcher에는 `waitFor`라는 기능이 있다. Store B가 Store A의 갱신 결과를 읽어야 할 때, A가 먼저 처리되도록 순서를 지정하는 함수다. 창·설정·로그인 store는 서로의 갱신 결과에 의존하지 않아 `waitFor`가 필요한 경우가 없었다.

### 변경 기록

Redux DevTools는 Action 객체를 시간 순서로 기록해 두고, 특정 시점의 상태로 되돌려 재생하는 기능(time-travel debugging)을 제공한다. Action이 없으니 이런 기록·재생은 할 수 없다. MacFolio의 상태는 크기가 작고, 동작은 메서드 단위 시험으로 확인한다.

## 선택의 배경

이 구조는 창 관리를 React 밖으로 옮긴 [#139](https://github.com/hyeoniverse/MacFolio/pull/139)에서 정했다. 당시 세 방법을 비교했다.

| 방법                                            | 좋은 점                                  | 나쁜 점                                                           |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Context는 유지하고 reducer 함수만 분리한다      | 변경 범위가 작다. React 관례(useReducer) | 상태가 여전히 React 안에 있다. Vue에서 쓰려면 store를 다시 만든다 |
| zustand 같은 상태 라이브러리                    | 구독·선택자를 제공한다                   | 라이브러리 하나가 core의 의존성이 된다. Vue 쪽 바인딩도 따로 필요 |
| **직접 만든 작은 store + useSyncExternalStore** | 의존성 없음. React 18 기본 API로 구독    | 선택자·메모이즈가 없다(상태가 작아서 필요 없었다)                 |

자세한 비교는 [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore)에 있다. 결과물의 형태가 Zustand의 vanilla store와 거의 같은 이유는 같은 문제(React 밖에 상태를 보관하고 구독)를 같은 방식으로 풀었기 때문이다.

## 패키지 경계가 단방향 흐름을 강제한다

`packages/desktop-core`는 ESLint의 [`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports) 규칙으로 `react`·`vue`·`@/*`(React 앱 경로) import를 금지하고, `tsconfig`에서 DOM 타입을 제외했다[^core-guard]. core가 View 쪽 코드를 import할 수 없으므로, core 안의 store는 View에 값을 직접 넣을 방법이 없다. View는 `subscribe`로 알림을 받아 `getState`로 읽는 것밖에 할 수 없다.

예를 들어 `windowStore.ts`에 `import { useState } from 'react'`를 추가해 store 안에서 React 상태를 쓰려고 하면, `pnpm lint`가 오류를 내고 CI가 실패한다. ==단방향 흐름을 코드 리뷰가 아니라 빌드 단계의 검사가 강제하는 구조==다.

## 관련 글

- [Flux의 Action·Dispatcher·Store 단방향 흐름에서 찾은 좋은 상태 관리 코드의 세 가지 조건](/memo/flux-pattern): 이 글이 비교하는 Flux·Redux·외부 store의 일반론
- [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore): `createStore`와 `useSyncExternalStore`를 고른 과정 ([#139](https://github.com/hyeoniverse/MacFolio/pull/139))
- [desktop-core로 메모 로직을 옮기며 값 검사와 localStorage 읽기·쓰기 나누기](/memo/desktop-core-stores#메모-값-검사와-localstorage-읽기쓰기-분리): 같은 store 구조를 메모 로직에 적용
- [결과 값을 돌려주는 store로 재생 대기열과 audio 요소 제어 분리하기](/memo/desktop-core-stores#음악-결과-값을-돌려주는-플레이어-store): 재생 상태 store와 오디오 재생의 분리
- [package.json exports 조건으로 Vite에는 소스, Node에는 빌드한 JS 제공하기](/memo/desktop-core-shared-rules): core의 규칙을 API 서버도 쓰는 구조

[^core-guard]: core에 `import { useState } from 'react'`나 `window.innerWidth`를 넣으면 `tsc`와 ESLint가 오류를 낸다. 세 가지 검사(타입 설정, 의존성 선언, lint)는 [창 관리 규칙을 useSyncExternalStore로 구독하는 프레임워크 무관 패키지로 옮기기](/memo/desktop-core-stores#창-관리-작은-store와-usesyncexternalstore)의 "core의 React 의존을 막는 세 장치"에 정리했다.

<details>
<summary>참고 문헌</summary>

- Meta, [Flux: In-Depth Overview](https://facebookarchive.github.io/flux/docs/in-depth-overview)
- Redux, [Three Principles](https://redux.js.org/understanding/thinking-in-redux/three-principles)
- React, [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- pmndrs, [Zustand](https://github.com/pmndrs/zustand)
- MDN, [Object.is()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)
- ESLint, [no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)

</details>

<details>
<summary>사진 출처</summary>

- Flux 구조도: Meta(Facebook), [flux-diagram-white-background.png](https://github.com/facebookarchive/flux/blob/main/img/flux-diagram-white-background.png), facebookarchive/flux 저장소, BSD 라이선스, 출처 표기

</details>

#MacFolio #React #상태관리 #아키텍처
