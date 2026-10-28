---
title: 창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계
date: 2026-10-09
category: 개발 기록/MacFolio/설계
summary: 실행 중인 앱과 맨 앞 창을 정하는 로직이 React Context 안에 있었다. 이것을 React와 브라우저에 의존하지 않는 packages/desktop-core로 옮기고, React는 useSyncExternalStore로 구독만 한다. core가 react나 window를 쓰면 세 곳에서 오류가 난다.
---

MacFolio의 창 상태는 `AppStateContext` 하나가 관리했다. 앱마다 실행 여부, 최소화 여부, 쌓임 순서를 `useState`에 보관하고, 열기·닫기·최소화·맨 앞으로 가져오기를 `useCallback` 열 개로 만들어 Context로 전달하는 구조였다. 이 글은 [#139](https://github.com/hyeoniverse/MacFolio/pull/139)의 기록이다.

![메뉴 막대에는 맨 앞 창의 앱 이름(시스템 설정)이 표시되고, 뒤로 메모·음악 창이 쌓여 있다](./images/desktop-core-windows-stack.jpg '창 세 개를 차례로 연 모습. 맨 앞 창과 메뉴 막대의 앱 이름은 쌓임 순서에서 계산한다')

동작에는 문제가 없었다. 다만 "창을 열면 맨 앞에 온다"는 규칙이 React 컴포넌트 안에 있어서, 이 규칙을 시험하려면 컴포넌트를 렌더링해야 했다. 같은 데스크톱을 Vue로 만들 계획([#6](https://github.com/hyeoniverse/MacFolio/issues/6))을 진행하면 이 규칙을 Vue로 다시 작성해야 한다. 리팩터링 계획([#16](https://github.com/hyeoniverse/MacFolio/issues/16))은 이런 로직을 프레임워크와 무관한 패키지로 분리하는 것이고, 이번에 첫 단계로 창 관리를 옮겼다.

## 고를 수 있던 방법

| 방법                                            | 좋은 점                                  | 나쁜 점                                                           |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Context는 유지하고 reducer 함수만 분리한다      | 변경 범위가 작다. React 관례(useReducer) | 상태가 여전히 React 안에 있다. Vue에서 쓰려면 store를 다시 만든다 |
| zustand 같은 상태 라이브러리                    | 구독·선택자를 제공한다                   | 라이브러리 하나가 core의 의존성이 된다. Vue 쪽 바인딩도 따로 필요 |
| **직접 만든 작은 store + useSyncExternalStore** | 의존성 없음. React 18 기본 API로 구독    | 선택자·메모이즈가 없다(상태가 작아서 필요 없었다)                 |

store는 이미 `createStore`(getState·setState·subscribe 세 함수)로 설정·로그인 상태에 쓰고 있었다. 같은 형태로 창 store를 만들면 React는 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)[^usese] 한 줄로 구독하고, 다른 프레임워크도 `subscribe`만 호출하면 된다.

## 무엇을 옮겼나

```
packages/desktop-core/src/
  store.ts                 getState / setState / subscribe 만 있는 저장소
  window/stack.ts          쌓임 순서 계산 (맨 앞으로, 맨 앞 앱 찾기, 모두 최소화)
  window/windowStore.ts    창 상태와 동작: open, close, quit, minimize, restore, bringToFront ...
  window/initialWindows.ts 처음 창 상태, 저장해 둔 상태 되살리기
```

`store.ts`와 `stack.ts`는 React 앱 안에 있던 파일을 수정 없이 옮겼다. 처음부터 React를 import하지 않는 코드였기 때문에 경로만 바뀌었다. 설정·로그인·알림 같은 다른 저장소도 이제 이 패키지의 `createStore`를 쓴다.

새로 만든 것은 창 store다. 상태는 `{ apps, desktopFocused }` 두 필드이고, 동작은 상태를 바꾸는 함수다.

```ts
const store = createWindowStore(initialWindows(names, { linked, runningAtStart }));
store.open('memo');
activeApp(store.getState()); // 'memo'
store.focusDesktop();
activeApp(store.getState()); // null (바탕화면을 눌렀다)
```

## React 쪽에 남은 것

`AppStateProvider`는 store를 한 번 생성하고 `useSyncExternalStore`로 구독한다. 동작은 store의 함수를 그대로 전달한다.

```tsx
const [store] = useState(createAppWindowStore);
const state = useSyncExternalStore(store.subscribe, store.getState);
```

`useAppState()`의 반환 형태(`apps`, `openApp`, `closeApp` ...)는 유지했다. 이 hook을 쓰는 컴포넌트는 하나도 수정하지 않았다. `AppStateContext.tsx`는 206줄에서 130줄이 됐고, 그 안의 `useCallback` 열한 개가 사라졌다.

React 쪽에 남긴 것은 브라우저 API를 쓰는 일이다.

- 초기 상태를 정하는 입력값: 화면이 휴대폰 크기인지(`window.innerWidth`), 주소가 `/memo/<글>`인지
- 로그인 페이지로 이동하기 전에 실행 중인 앱 목록을 [`sessionStorage`](https://developer.mozilla.org/ko/docs/Web/API/Window/sessionStorage)에 저장 (읽은 값을 검사해 상태에 반영하는 일은 core의 `restoreWindows`)
- 앱을 열 때 방문 통계 전송, 주소 막대 갱신

## core의 React 의존을 막는 세 장치

"React에 의존하지 않는다"는 규칙은 코드 한 줄로 어길 수 있다. core에 `window.innerWidth`를 한 줄만 써도 그 시각부터 Node에서 실행되지 않는다. 그래서 세 곳에서 검사한다.

| 검사 위치          | 방법                                                                                                                           | 오류가 나는 코드                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `tsconfig.json`    | `lib: ["ES2022"]`, `types: []`. DOM 타입을 넣지 않는다                                                                         | `window`, `sessionStorage`        |
| `package.json`     | 의존성에 react가 없다. pnpm은 선언하지 않은 패키지를 해석하지 않는다[^pnpm]                                                    | `import ... from 'react'`         |
| `eslint.config.js` | [`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports)로 `react*`, `vue*`, `@/*`(React 앱 경로) | 위 두 검사를 통과하는 경로 import |

실제로 `import { useState } from 'react'`와 `window.innerWidth`를 넣어 확인했다. `tsc`는 `Cannot find module 'react'`, `Cannot find name 'window'` 오류로 실패했고, lint도 react import를 오류로 보고했다.

![desktop-core와 React의 나눔](./images/desktop-core-windows-layers.svg '창 규칙은 core에, 브라우저 API를 쓰는 일은 React에. core가 React를 쓰면 세 곳에서 오류가 난다')

## 시험

core에는 Vitest 시험 23개가 있다. 렌더링 없이 store를 생성하고 함수를 호출한 뒤 상태를 확인한다.

```ts
it('창 밖을 누르면 지금 쓰는 앱이 없어지고, 창을 누르면 돌아온다', () => {
	const store = setup();
	store.focusDesktop();
	expect(activeApp(store.getState())).toBeNull();
	store.bringToFront('finder');
	expect(activeApp(store.getState())).toBe('finder');
});
```

옮기기 전과 동작이 같은지는 기존 Playwright 시험 354개(데스크톱·iPhone·Android)로 확인했다. 창 열기·닫기·끌기, 휴대폰 앱 전환기에서 앱 닫기 시험이 모두 수정 없이 통과했다.

커밋은 파일 39개, +525/−172다. 변경 파일이 많은 이유는 `createStore`를 쓰던 다른 저장소(설정·로그인·알림)의 import 경로가 core로 바뀌었기 때문이다.

## 남은 것과 배운 것

- 창의 위치·크기 계산(`desktop/window/geometry.ts`: 기본 크기, 화면 안으로 제한, 이동, 크기 조절, 최대화)은 이번에 옮기지 않았다. 이미 순수 함수이고 시험도 있지만, 아직 React 앱 폴더에 있다.
- "Vue로 같은 데스크톱 만들기"([#6](https://github.com/hyeoniverse/MacFolio/issues/6))는 아직 진행하지 않았다. core가 실제로 프레임워크와 무관한지는 두 번째 프레임워크에서 사용해야 검증된다. 지금은 세 가지 검사(타입·의존성·lint)로 대신한다.

배운 것: "프레임워크에 의존하지 않는다"는 규칙은 코드 리뷰만으로 유지하기 어렵다. 타입 설정에서 DOM을 빼고, 의존성에서 react를 빼고, lint로 경로를 막으면 규칙을 어긴 코드는 빌드 단계에서 실패한다. 규칙을 도구로 검사하면 사람이 놓쳐도 CI가 잡는다.

다음 단계는 [메모](/memo/desktop-core-memo)(글 목록 정렬·필터, 저장소 인터페이스)와 [음악](/memo/desktop-core-music)(셔플·이전 곡 선택)이고, 마지막으로 [화면과 서버가 같은 규칙을 쓰게](/memo/desktop-core-shared-rules) 했다.

## 관련 글

- [메모 로직을 desktop-core로](/memo/desktop-core-memo): 두 번째 단계
- [음악 플레이어를 둘로 나누기](/memo/desktop-core-music): 세 번째 단계
- [화면과 서버가 같은 규칙을 쓰기](/memo/desktop-core-shared-rules): 분리 이후 서버와 규칙 공유
- [바탕화면 보기 — 배경화면을 누르면 창을 가장자리로 치운다](/memo/reveal-desktop): 창 store에 `desktopRevealed` 상태를 추가한 기능

[^usese]: React 18에서 추가된 hook으로, React 바깥의 저장소를 구독한다. `subscribe`와 `getSnapshot` 두 함수를 받아, 저장소가 바뀌면 컴포넌트를 다시 렌더링한다.

[^pnpm]: pnpm은 각 패키지의 `node_modules`에 `package.json`에 선언한 의존성만 링크한다. 그래서 다른 패키지가 설치한 react를 우연히 import하는 일(유령 의존성)이 생기지 않는다. 설명은 [pnpm 문서](https://pnpm.io/motivation#creating-a-non-flat-node_modules-directory)에 있다.

#MacFolio #데스크톱 #리팩터링
