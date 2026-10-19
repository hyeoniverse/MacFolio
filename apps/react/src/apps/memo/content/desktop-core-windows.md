---
title: 창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계
date: 2026-10-09
category: 개발기/MacFolio/프론트엔드
summary: 어떤 앱이 켜져 있고 어떤 창이 맨 앞인지 정하는 로직이 React Context 안에 useState·useCallback으로 있었다. 이것을 React도 브라우저도 모르는 packages/desktop-core로 옮기고, React는 useSyncExternalStore로 구독만 한다. core가 react나 window를 쓰면 세 곳에서 막힌다.
---

MacFolio의 창 상태는 `AppStateContext` 하나가 들고 있었다. 앱마다 켜져 있는지, 최소화됐는지, 몇 번째로 쌓였는지를 `useState`에 두고, 열기·닫기·최소화·맨 앞으로 가져오기를 `useCallback` 열 개로 만들어 Context로 내려 주는 구조였다.

![메뉴 막대에는 맨 앞 창의 앱 이름(시스템 설정)이 뜨고, 뒤로 메모·음악 창이 쌓여 있다](./images/desktop-core-windows-stack.jpg '창 세 개를 차례로 연 모습. 맨 앞 창과 메뉴 막대의 앱 이름이 쌓임 순서에서 나온다')

동작에는 문제가 없었다. 다만 "창을 열면 맨 앞에 온다"는 규칙이 React 컴포넌트 안에 있으니, 이것을 시험하려면 컴포넌트를 렌더링해야 했다. 나중에 같은 데스크톱을 Vue로 만들어 보려면(#6) 이 규칙을 그대로 다시 써야 한다. 리팩터링 계획(#16)은 이런 로직을 프레임워크와 무관한 패키지로 떼어 내는 것이고, 이번에 첫 단계로 창 관리를 옮겼다.

## 고를 수 있던 방법

| 방법                                            | 좋은 점                                | 나쁜 점                                                           |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Context는 두고 reducer 함수만 뺀다              | 바꿀 곳이 적다. React 관례(useReducer) | 상태가 여전히 React 안에 있다. Vue에서 쓰려면 store를 다시 만든다 |
| zustand 같은 상태 라이브러리                    | 구독·선택자가 이미 있다                | 라이브러리 하나가 core의 의존성이 된다. Vue 쪽 바인딩도 따로 필요 |
| **직접 만든 작은 store + useSyncExternalStore** | 의존성 없음. React 18 기본 API로 구독  | 선택자·메모이즈가 없다(상태가 작아서 필요 없었다)                 |

store는 이미 `createStore`(getState·setState·subscribe 세 개)로 설정·로그인 상태에 쓰고 있었다. 같은 모양으로 창 store를 만들면 React는 `useSyncExternalStore` 한 줄로 구독하고, 다른 프레임워크도 `subscribe`만 부르면 된다.

## 무엇을 옮겼나

```
packages/desktop-core/src/
  store.ts                 getState / setState / subscribe 만 있는 저장소
  window/stack.ts          쌓임 순서 계산 (맨 앞으로, 맨 앞 앱 찾기, 모두 최소화)
  window/windowStore.ts    창 상태와 동작: open, close, quit, minimize, restore, bringToFront ...
  window/initialWindows.ts 처음 창 상태, 저장해 둔 상태 되살리기
```

`store.ts`와 `stack.ts`는 원래 React 앱 안에 있던 파일을 그대로 옮긴 것이다. 처음 만들 때부터 React를 쓰지 않게 짜 두었기 때문에 경로만 바뀌었다. 설정·로그인·알림 같은 다른 저장소들도 이제 이 패키지의 `createStore`를 쓴다.

새로 만든 것은 창 store다. 상태는 `{ apps, desktopFocused }` 두 가지이고, 동작은 상태를 바꾸는 함수들이다.

```ts
const store = createWindowStore(initialWindows(names, { linked, runningAtStart }));
store.open('memo');
activeApp(store.getState()); // 'memo'
store.focusDesktop();
activeApp(store.getState()); // null (바탕화면을 눌렀다)
```

## React 쪽에 남은 것

`AppStateProvider`는 store를 한 번 만들고 `useSyncExternalStore`로 구독한다. 동작은 store의 함수를 그대로 넘긴다.

```tsx
const [store] = useState(createAppWindowStore);
const state = useSyncExternalStore(store.subscribe, store.getState);
```

`useAppState()`가 돌려주는 모양(`apps`, `openApp`, `closeApp` ...)은 그대로 두었다. 이것을 쓰는 컴포넌트는 하나도 고치지 않았다. `AppStateContext.tsx`는 206줄에서 130줄이 됐고, 그 안의 `useCallback` 열한 개가 사라졌다.

React 쪽에 남긴 것은 브라우저와 닿는 일이다.

- 처음 상태를 정할 재료: 화면이 휴대폰 크기인지(`window.innerWidth`), 주소가 `/memo/<글>`인지
- 로그인하러 떠날 때 `sessionStorage`에 켜 둔 앱을 적어 두기 (읽어 온 값을 검사해서 덮는 일은 core의 `restoreWindows`)
- 앱을 열 때 방문 통계 보내기, 주소 막대 바꾸기

## core가 React를 모르게 막기

"React에 의존하지 않는다"는 말은 지키기보다 깨기가 쉽다. 누군가 편해서 `window.innerWidth`를 한 줄 쓰면 그때부터 Node에서 돌지 않는다. 그래서 세 군데서 막았다.

| 막는 곳            | 방법                                                                  | 걸리는 것                      |
| ------------------ | --------------------------------------------------------------------- | ------------------------------ |
| `tsconfig.json`    | `lib: ["ES2022"]`, `types: []`. DOM 타입을 넣지 않는다                | `window`, `sessionStorage`     |
| `package.json`     | 의존성에 react가 없다. pnpm은 선언하지 않은 패키지를 찾지 못하게 한다 | `import ... from 'react'`      |
| `eslint.config.js` | `no-restricted-imports`로 `react*`, `vue*`, `@/*`(React 앱 경로)      | 위 둘을 빠져나가는 경로 import |

실제로 `import { useState } from 'react'`와 `window.innerWidth`를 넣어 보니 `tsc`가 `Cannot find module 'react'`, `Cannot find name 'window'`로 멈췄고, lint도 react import를 오류로 잡았다.

![desktop-core와 React의 나눔](./images/desktop-core-windows-layers.svg '창 규칙은 core에, 브라우저와 닿는 일은 React에. core가 React를 쓰면 세 곳에서 막힌다')

## 시험

core에는 Vitest 시험 23개가 있다. 렌더링 없이 store를 만들고 함수를 부른 뒤 상태를 확인한다.

```ts
it('창 밖을 누르면 지금 쓰는 앱이 없어지고, 창을 누르면 돌아온다', () => {
	const store = setup();
	store.focusDesktop();
	expect(activeApp(store.getState())).toBeNull();
	store.bringToFront('finder');
	expect(activeApp(store.getState())).toBe('finder');
});
```

옮기기 전과 동작이 같은지는 기존 Playwright 시험 354개(데스크톱·iPhone·Android)로 확인했다. 창을 열고 닫고 끌고, 휴대폰에서 앱 전환기로 앱을 닫는 시험들이 모두 그대로 통과했다.

커밋은 파일 39개, +525/−172다. 파일 수가 많은 것은 `createStore`를 쓰던 다른 저장소(설정·로그인·알림)의 import 경로가 core로 바뀌었기 때문이다.

## 남은 것과 배운 것

- 창의 위치·크기 계산(`desktop/window/geometry.ts`: 기본 크기, 화면 안으로 제한, 이동, 크기 조절, 최대화)은 이번에 옮기지 않았다. 이미 순수 함수로 떼어 시험이 붙어 있지만, 아직 React 앱 폴더에 있다.
- "Vue로 같은 데스크톱 만들기"(#6)는 아직 하지 않았다. core가 정말 프레임워크와 무관한지는 두 번째 프레임워크가 붙어 봐야 확실해진다. 지금은 세 겹의 막기(타입·의존성·lint)로 대신 지킨다.

배운 것: "프레임워크에 의존하지 않는다"는 약속은 코드 리뷰로 지키기 어렵다. 타입 설정에서 DOM을 빼고, 의존성에서 react를 빼고, lint로 경로를 막으니 지키지 않으면 빌드가 멈춘다. 약속을 도구가 지키게 하는 편이 오래간다.

다음 단계는 [메모](/memo/desktop-core-memo)(글 목록 정렬·필터, 저장소 인터페이스)와 [음악](/memo/desktop-core-music)(셔플·이전 곡 고르기)이고, 마지막으로 [화면과 서버가 같은 규칙을 쓰게](/memo/desktop-core-shared-rules) 했다.

#MacFolio #데스크톱 #리팩터링
