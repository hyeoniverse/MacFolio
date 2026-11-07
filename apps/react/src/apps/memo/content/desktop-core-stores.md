---
title: 창 관리·메모·음악 로직을 프레임워크 무관 패키지 desktop-core로 옮기기
date: 2026-10-09
category: 개발 기록/MacFolio/구조·상태 관리
series: desktop-core
seriesOrder: 1
summary: React Context·hook 안에 있던 창 쌓임 순서, 메모 목록 계산, 음악 재생 대기열을 packages/desktop-core로 옮겼다. React는 useSyncExternalStore로 구독하고, localStorage 읽기와 audio 제어만 앱에 남겼다. core가 react나 window를 쓰면 세 곳에서 오류가 난다.
---

MacFolio의 화면에는 화면 모양과 무관한 규칙이 많다. "창을 열면 그 창이 맨 앞에 온다", "고정된 글은 목록 맨 위에 온다", "목록 끝에서 반복이 꺼져 있으면 재생을 멈춘다" 같은 규칙이다. 이 규칙들은 입력(현재 창 순서, 글 목록, 재생 목록)을 받아 결과를 계산할 뿐이므로, React든 Vue든 같은 답을 내야 한다.

그런데 처음에는 이 규칙들이 React 컴포넌트와 hook 안에 `useState`·`useCallback`·`useMemo`와 섞여 있었다. 그러면 두 가지가 어렵다. 같은 데스크톱을 Vue로 만들 계획([#6](https://github.com/hyeoniverse/MacFolio/issues/6))을 진행하면 규칙을 Vue로 다시 작성해야 하고, 규칙 하나를 시험하려 해도 컴포넌트를 렌더링해야 한다.

desktop-core 분리 계획([#16](https://github.com/hyeoniverse/MacFolio/issues/16))은 이 규칙을 UI 프레임워크(React, Vue처럼 화면을 그리는 라이브러리)에 의존하지 않는 패키지 `packages/desktop-core`로 옮기는 작업이다. 같은 날 세 단계로 진행했다.

| 단계 | 대상    | 옮긴 것                                     | 앱에 남긴 것                               | PR                                                       |
| ---- | ------- | ------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| 1    | 창 관리 | 창 store, 쌓임 순서 계산, `createStore`     | 화면 크기·주소 판단, `sessionStorage` 저장 | [#139](https://github.com/hyeoniverse/MacFolio/pull/139) |
| 2    | 메모    | 글 읽기·정렬·태그·정리·찾기·검사, 목록 계산 | `localStorage` 읽기·쓰기, 서버 호출        | [#140](https://github.com/hyeoniverse/MacFolio/pull/140) |
| 3    | 음악    | 플레이어 store, 대기열 계산                 | `<audio>` 제어, 곡 목록(`TRACKS`)          | [#141](https://github.com/hyeoniverse/MacFolio/pull/141) |

옮기는 기준은 세 단계 모두 하나였다. "==React나 브라우저 없이 실행할 수 있는가==". 입력을 받아 값을 반환하는 코드만 core로 옮기고, 브라우저 API를 쓰는 일은 앱에 남겼다. 단계마다 브라우저 API가 섞인 방식이 달라서 나누는 방법도 달랐다.

## 창 관리: 작은 store와 useSyncExternalStore

### AppStateContext의 useCallback 열 개

MacFolio의 창 상태는 `AppStateContext` 하나가 관리했다. [Context](https://react.dev/learn/passing-data-deeply-with-context)는 React가 제공하는 기능으로, 상위 컴포넌트가 넣은 값을 하위 컴포넌트가 props를 거치지 않고 바로 읽게 한다. Dock, 메뉴 막대, 창 테두리가 모두 같은 창 상태를 읽어야 하므로 Context를 사용했다. 앱마다 실행 여부, 최소화 여부, 쌓임 순서를 `useState`에 보관하고, 열기·닫기·최소화·맨 앞으로 가져오기를 `useCallback` 열 개로 만들어 Context로 전달하는 구조였다.

![메뉴 막대에는 맨 앞 창의 앱 이름(시스템 설정)이 표시되고, 뒤로 메모·음악 창이 쌓여 있다](./images/desktop-core-windows-stack.jpg '창 세 개를 차례로 연 모습. 맨 앞 창과 메뉴 막대의 앱 이름은 쌓임 순서에서 계산한다')

동작에는 문제가 없었다. 다만 "창을 열면 맨 앞에 온다"는 규칙이 React 컴포넌트 안에 있어서, 이 규칙을 시험하려면 컴포넌트를 렌더링해야 했다.

| 방법                                            | 좋은 점                                  | 나쁜 점                                                           |
| ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Context는 유지하고 reducer 함수만 분리한다      | 변경 범위가 작다. React 관례(useReducer) | 상태가 여전히 React 안에 있다. Vue에서 쓰려면 store를 다시 만든다 |
| zustand 같은 상태 라이브러리                    | 구독·선택자를 제공한다                   | 라이브러리 하나가 core의 의존성이 된다. Vue 쪽 바인딩도 따로 필요 |
| **직접 만든 작은 store + useSyncExternalStore** | 의존성 없음. React 18 기본 API로 구독    | 선택자·메모이즈가 없다(상태가 작아서 필요 없었다)                 |

여기서 **store**는 상태 값 하나와 그 값을 읽고(`getState`), 바꾸고(`setState`), 바뀔 때 알림을 받는(`subscribe`) 함수 세 개를 묶은 객체다. MacFolio는 이미 `createStore`로 이런 store를 만들어 설정·로그인 상태에 쓰고 있었다. `setState`는 새 상태 객체를 만들고, 이전 객체와 같으면(`Object.is`) 알림을 보내지 않는다.

```ts
const counter = createStore({ count: 0 });
const unsubscribe = counter.subscribe((state) => console.log(state.count));
counter.setState({ count: 1 }); // 1 출력
counter.setState((state) => state); // 같은 객체라 출력 없음
unsubscribe();
```

같은 형태로 창 store를 만들면 React는 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)[^usese] 한 줄로 구독하고, 다른 프레임워크도 `subscribe`만 호출하면 된다.

### core로 옮긴 창 관리 파일

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

### AppStateProvider에 남은 코드

`AppStateProvider`는 store를 한 번 생성하고 `useSyncExternalStore`로 구독한다. 동작은 store의 함수를 그대로 전달한다.

```tsx
const [store] = useState(createAppWindowStore);
const state = useSyncExternalStore(store.subscribe, store.getState);
```

React는 렌더링 중에 `getState()`로 현재 상태를 읽고, 화면에 반영한 뒤 `subscribe`로 변경 알림을 등록한다. Dock에서 메모 아이콘을 누르면 store의 `open('memo')`가 새 상태 객체를 만들고 알림을 보낸다. React는 `getState()`를 다시 호출해 이전 값과 `Object.is`로 비교하고, 다르면 다시 렌더링한다.

![useSyncExternalStore가 getState와 subscribe로 창 store를 구독하고, open('memo') 뒤 새 상태를 읽어 다시 렌더링하는 순서](./images/desktop-core-stores-subscribe.svg '①② 처음 렌더링과 구독, ③④ Dock 클릭으로 store가 바뀌고 알림, ⑤⑥ 새 상태를 읽고 비교해 다시 렌더링')

`useAppState()`의 반환 형태(`apps`, `openApp`, `closeApp` ...)는 유지했다. 이 hook을 쓰는 컴포넌트는 하나도 수정하지 않았다. `AppStateContext.tsx`는 206줄에서 130줄이 됐고, 그 안의 `useCallback` 열한 개가 사라졌다.

React 쪽에 남긴 것은 브라우저 API를 쓰는 일이다.

- 초기 상태를 정하는 입력값: 화면이 휴대폰 크기인지(`window.innerWidth`), 주소가 `/memo/<글>`인지
- 로그인 페이지로 이동하기 전에 실행 중인 앱 목록을 [`sessionStorage`](https://developer.mozilla.org/ko/docs/Web/API/Window/sessionStorage)에 저장 (읽은 값을 검사해 상태에 반영하는 일은 core의 `restoreWindows`)
- 앱을 열 때 방문 통계 전송, 주소 막대 갱신

### core의 React 의존을 막는 세 장치

"React에 의존하지 않는다"는 규칙은 코드 한 줄로 어길 수 있다. core에 `window.innerWidth`를 한 줄만 써도 그 시각부터 Node에서 실행되지 않는다. 그래서 세 곳에서 검사한다.

| 검사 위치          | 방법                                                                                                                           | 오류가 나는 코드                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `tsconfig.json`    | `lib: ["ES2022"]`, `types: []`. DOM 타입을 넣지 않는다                                                                         | `window`, `sessionStorage`        |
| `package.json`     | 의존성에 react가 없다. pnpm은 선언하지 않은 패키지를 해석하지 않는다[^pnpm]                                                    | `import ... from 'react'`         |
| `eslint.config.js` | [`no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports)로 `react*`, `vue*`, `@/*`(React 앱 경로) | 위 두 검사를 통과하는 경로 import |

둘째 장치는 pnpm의 `node_modules` 구조에서 나온다. npm은 모든 패키지를 루트 `node_modules`에 평평하게 펼치므로, 선언하지 않은 패키지도 우연히 import된다. pnpm은 각 패키지의 실제 파일을 `node_modules/.pnpm` 아래에 두고, 패키지 폴더에는 그 패키지가 선언한 의존성의 링크만 만든다.

![pnpm의 node_modules 구조. 루트의 express는 .pnpm/express@4.17.3/node_modules/express로 가는 링크이고, express가 쓰는 cookie는 express 옆에만 링크된다](./images/desktop-core-stores-pnpm-node-modules.jpg#float-right 'pnpm 문서의 node_modules 구조 그림. 파란 글자가 링크다')

그림에서 루트 `node_modules`에는 프로젝트가 선언한 `express`만 링크로 보인다. `express`가 내부에서 쓰는 `cookie`는 `.pnpm/express@4.17.3/node_modules/` 안에만 링크되어 있어, 프로젝트 코드에서 `import 'cookie'`를 쓰면 해석에 실패한다. desktop-core도 같은 방식이라, 같은 저장소의 React 앱이 react를 설치해도 desktop-core 폴더에서는 react를 찾을 수 없다.

세 장치가 실제로 동작하는지 `import { useState } from 'react'`와 `window.innerWidth`를 core에 넣어 확인했다. `tsc`는 `Cannot find module 'react'`, `Cannot find name 'window'` 오류로 실패했고, lint도 react import를 오류로 보고했다. ==규칙을 도구로 검사하면 사람이 놓쳐도 CI가 잡는다.==

![desktop-core와 React의 나눔](./images/desktop-core-windows-layers.svg '창 규칙은 core에, 브라우저 API를 쓰는 일은 React에. core가 React를 쓰면 세 곳에서 오류가 난다')

### 창 store 시험

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

> [!NOTE] 이번에 옮기지 않은 계산
> 창의 위치·크기 계산(`desktop/window/geometry.ts`: 기본 크기, 화면 안으로 제한, 이동, 크기 조절, 최대화)은 이번에 옮기지 않았다. 이미 순수 함수이고 시험도 있지만, 아직 React 앱 폴더에 있다.

## 메모: 값 검사와 localStorage 읽기·쓰기 분리

### 메모 폴더에 섞여 있던 순수 로직

메모 앱은 이 사이트에서 가장 큰 앱이다. 지금 읽는 블로그가 바로 메모 앱이고, 폴더·태그·검색·정렬·고정·잠금·찾기·글쓰기가 모두 들어 있다. 앱 폴더(`apps/react/src/apps/memo`)에는 컴포넌트와 hook 사이에 순수 로직 파일이 섞여 있었다. 어떤 파일이 화면이고 어떤 파일이 규칙인지 파일 이름만으로는 구분할 수 없었다.

![메모 앱. 왼쪽에 폴더와 태그, 가운데 글 목록, 오른쪽에 본문](./images/desktop-core-memo-window.jpg '폴더·태그·정렬·선택한 글을 정하는 계산을 이번에 core로 옮겼다')

| 파일                      | 하는 일                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `posts.ts`                | 머리말 읽기, 폴더 트리, 검색·검색 조건, 서버 글 겹치기, 이전·다음 글 |
| `tags.ts`, `tagFilter.ts` | 본문의 #태그 수집, 태그 포함·제외 필터링                             |
| `organize.ts`             | 관리자가 만든 폴더, 옮긴 글, 고정, 잠금                              |
| `arrange.ts`              | 정렬과 날짜별 묶기                                                   |
| `find.ts`                 | 본문 찾기 (대소문자, 단어 단위), 최근 검색어                         |
| `postRules.ts`            | 글을 저장하기 전 검사 (제목·요약·본문 길이, 있는 날짜인지, 폴더)     |
| `caption.ts`              | 이미지 캡션 속 링크 나누기                                           |
| `repository/`             | 글 저장소 인터페이스와 Markdown 파일로 만든 구현                     |

시험도 함께 옮겼다. 처음부터 Node 환경에서 실행하던 시험이라 수정 없이 통과했다. 서버에 글을 읽고 쓰는 `postsApi.ts`·`organizationApi.ts`는 네트워크를 쓰므로 앱에 남았다. core에는 저장소의 인터페이스와 Markdown 파일로 만든 구현만 간다.

### localStorage를 쓰던 세 파일

`arrange.ts`, `find.ts`, `organize.ts`는 대부분 순수 함수였는데, 파일 끝에 [`localStorage`](https://developer.mozilla.org/ko/docs/Web/API/Window/localStorage)를 읽고 쓰는 함수가 하나씩 있었다. core의 `tsconfig`에는 DOM 타입이 없어서[^dom], 이대로 옮기면 타입 검사에서 오류가 난다.

`loadArrangement`를 보면 하는 일이 둘이다.

```ts
export function loadArrangement(): Arrangement {
	try {
		const saved = JSON.parse(localStorage.getItem(ARRANGEMENT_KEY) ?? 'null') as Partial<Arrangement> | null;
		if (!saved) return DEFAULT_ARRANGEMENT;
		return {
			sort: saved.sort === 'title' ? 'title' : 'date',
			order: saved.order === 'asc' ? 'asc' : 'desc',
			groupByDate: typeof saved.groupByDate === 'boolean' ? saved.groupByDate : DEFAULT_ARRANGEMENT.groupByDate,
		};
	} catch {
		return DEFAULT_ARRANGEMENT;
	}
}
```

브라우저 저장소에서 값을 읽는 일과, 읽은 값이 올바른 형식인지 검사하는 일이다. 뒤쪽은 저장소가 `localStorage`든 Vue 앱의 다른 저장소든 같다. 그래서 다음처럼 나눴다.

- core: `parseArrangement(value: unknown)`. 어떤 값을 받아도 올바른 보기 설정을 반환한다
- 앱: `memoStorage.ts`. `localStorage`에서 읽어 JSON으로 풀고 `parseArrangement`에 넘긴다

`parseArrangement`는 저장소에 무엇이 남아 있든 올바른 설정을 반환한다. 예전 버전이 저장한 값이나 사용자가 개발자 도구에서 바꾼 값도 같은 규칙으로 처리된다.

| 입력 (`unknown`)                         | 반환값                                                |
| ---------------------------------------- | ----------------------------------------------------- |
| `null` (저장한 적 없음)                  | `{ sort: 'date', order: 'desc', groupByDate: true }`  |
| `{ sort: 'title', order: 'asc' }`        | `{ sort: 'title', order: 'asc', groupByDate: true }`  |
| `{ sort: 'size', order: 1 }` (잘못된 값) | `{ sort: 'date', order: 'desc', groupByDate: true }`  |
| `{ groupByDate: false }`                 | `{ sort: 'date', order: 'desc', groupByDate: false }` |

| 방법                                 | 좋은 점                         | 나쁜 점                                                                |
| ------------------------------------ | ------------------------------- | ---------------------------------------------------------------------- |
| core `tsconfig`에 DOM 타입을 넣는다  | 코드를 수정 없이 옮긴다         | core가 브라우저에 의존한다. 창 관리에서 세운 규칙을 어긴다             |
| core가 `Storage` 인터페이스를 받는다 | 저장도 core가 맡는다            | 읽기·쓰기 키 이름까지 core가 알아야 한다. 앱마다 저장소가 다를 수 있다 |
| **검사는 core, 읽기·쓰기는 앱**      | core는 값만 다룬다. 시험이 쉽다 | 앱에 작은 파일(`memoStorage.ts`, 52줄)이 하나 추가된다                 |

![localStorage 읽기와 값 검사의 나눔](./images/desktop-core-memo-split.svg '저장소에서 읽는 일은 앱의 memoStorage, 값 검사는 core의 parseArrangement')

최근 검색어도 같은 방식이다. "같은 검색어는 맨 앞으로, 최대 다섯 개" 규칙은 core의 `addRecentFind`가 처리하고, 앱의 `rememberFind`는 그 결과를 저장만 한다.

`organize.ts`에는 하나가 더 있었다. 예전에는 방문자도 폴더를 만들고 글을 옮길 수 있었고, 그 내용을 방문자 브라우저에 저장했다. 지금은 관리자만 정리하고 서버에 저장하는데, 그 시기에 방문자 브라우저에 남은 값을 삭제하는 `discardVisitorOrganization`이 메모 앱을 열 때마다 실행되고 있었다. 방명록 시절의 `macfolio:memos`를 삭제하는 코드도 남아 있었다. 남은 값은 어떤 코드도 읽지 않고 크기도 몇 바이트라, 옮기는 대신 이 정리 코드와 그 시험을 삭제했다.

시험도 같이 나뉘었다. 전에는 `localStorage`를 [`vi.stubGlobal`](https://vitest.dev/api/vi.html#vi-stubglobal)로 모의(mock) 객체로 바꾸고 잘못된 값을 넣었는데, 이제 core 시험은 `parseArrangement({ sort: 'size', order: 1 })`처럼 값을 직접 넘긴다. 모의 객체가 필요한 시험은 앱의 `memoStorage.test.ts`에 세 개만 남았다.

### useNoteView 안의 목록 계산

`useNoteView`는 현재 보기 조건(폴더, 검색어, 검색 조건, 태그, 정렬, 선택한 글)을 상태로 보관하고, 그 상태로 목록에 표시할 글을 계산하는 hook이다. 상태 보관은 React가 맡을 일이지만 계산은 React와 관계가 없다.

```ts
const visible = useMemo(
	() =>
		inTrash
			? filterPosts(trash, ALL_CATEGORY, query)
			: sortBy(
					filterPosts(
						inCategory,
						ALL_CATEGORY,
						query,
						editing ? filter : filter === 'draft' || filter === 'scheduled' ? null : filter
					),
					arrangement
				),
	[inTrash, trash, inCategory, query, filter, editing, arrangement]
);
```

"임시 저장·예약 글 조건은 관리자에게만"이라는 규칙이 중첩된 삼항 연산자 안에 들어 있었다. ==함수 이름이 없어서 시험도 없었다.== 이 계산을 core의 `noteView.ts`로 분리했다.

| 함수          | 하는 일                                                |
| ------------- | ------------------------------------------------------ |
| `postsInView` | 폴더면 그 폴더의 글, 태그로 보기면 고른 태그에 맞는 글 |
| `filterFor`   | 임시 저장·예약 조건은 관리자에게만                     |
| `listPosts`   | 최근 삭제된 항목은 검색어로만, 나머지는 필터링 후 정렬 |
| `selectPost`  | 선택한 글이 목록에 없으면 맨 위의 글 (고정된 글 먼저)  |
| `folderPaths` | 폴더 트리의 모든 경로                                  |

hook에는 상태와 `useMemo`, 주소 막대를 바꾸는 effect만 남았다. 규칙마다 함수 이름이 생겨서 규칙별로 시험을 하나씩 작성했다.

```ts
it('임시 저장·예약 조건은 관리자에게만', () => {
	expect(filterFor('draft', false)).toBeNull();
	expect(filterFor('draft', true)).toBe('draft');
	expect(filterFor('pinned', false)).toBe('pinned');
});
```

![useNoteView 안의 계산이 core의 다섯 함수로 나뉘고, hook에는 상태와 effect만 남았다](./images/desktop-core-memo-noteview.svg 'postsInView → filterFor → listPosts → selectPost 순서로 목록과 선택한 글이 정해진다')

### import 경로 변환과 subpath exports

옮긴 파일을 import하는 곳이 34개 파일에 있었다. `./posts`, `../posts`, `@/apps/memo/posts`처럼 경로 형식이 서로 달라서, 문자열 치환 대신 import 경로를 각 파일 위치 기준으로 해석해 옮긴 파일을 가리키는지 확인하는 스크립트로 바꿨다. 같은 import 안에서도 저장 함수(`loadArrangement` 등)는 `memoStorage`로, 나머지는 `@macfolio/desktop-core/memo`로 나눴다.

core 패키지는 `@macfolio/desktop-core`(창 관리)와 `@macfolio/desktop-core/memo`(메모)로 진입점을 나눴다([subpath exports](https://nodejs.org/api/packages.html#subpath-exports)). 메모 로직의 `sortBy`, `Post` 같은 이름이 창 관리 쪽 이름과 한 진입점에 섞이지 않게 하기 위해서다.

### 메모 이동 확인

- core 시험 120개 (창 관리 23 + 메모 97), 앱 시험 290개. 새로 쓴 `noteView.test.ts`에 9개가 있다
- 모의 객체가 필요한 시험은 앱의 `memoStorage.test.ts`에 세 개만 남았다
- Playwright 354개 (데스크톱·iPhone·Android). 메모의 폴더·태그·검색·정렬·찾기·글쓰기 시험이 수정 없이 통과했다
- 커밋은 파일 62개, +498/−208이다. 변경 파일 대부분은 경로만 바뀐 이동과 import 수정이다. `useNoteView.ts`는 68줄이 바뀌어 계산이 빠지고 상태만 남았다

## 음악: 결과 값을 돌려주는 플레이어 store

### 대기열 결정과 audio 제어가 섞인 MusicContext

[창 관리](#창-관리-작은-store와-usesyncexternalstore)와 [메모](#메모-값-검사와-localstorage-읽기쓰기-분리)는 대부분 순수 함수였고, 브라우저 API를 쓰는 부분만 분리하면 됐다. 음악은 조건이 달랐다. 이 앱의 핵심 기능은 소리 재생이고, 재생은 [`<audio>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio) 요소 없이는 할 수 없다.

![음악 앱. 왼쪽 재생 목록, 가운데 곡 목록, 아래 재생 막대에 셔플·이전·재생·다음·반복 버튼](./images/desktop-core-music-window.jpg '아래 막대의 다섯 버튼을 이번에 store의 동작으로 옮겼다')

`MusicContext`의 "다음 곡" 버튼 처리 코드는 다음과 같았다.

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
2. 소리를 어떻게 처리할지 (`pause()`, 곡을 처음부터, 재생 중이었으면 이어서 재생)

1은 재생 목록, 셔플, 반복 상태만 있으면 계산할 수 있다. 2는 [`HTMLAudioElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLAudioElement)가 필요하다. "이전 곡", "곡 재생 종료", "재생 목록에서 곡 선택", "셔플 켜기"도 모두 같은 구조였다. 대기열을 계산하는 순수 함수(`nextPosition`, `buildQueue` 등)는 이미 `library.ts`에 따로 있었지만, 대기열과 셔플·반복 상태는 React의 `useState`에 있었다.

| 방법                                                            | 좋은 점                        | 나쁜 점                                                                |
| --------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| audio 요소까지 core에 넣는다 (`HTMLAudioElement` 주입)          | 재생까지 한 곳에서 처리        | core에 DOM 타입이 들어온다. Node에서 시험하려면 audio 모의 객체가 필요 |
| store가 상태만 바꾸고, React가 전후 상태를 비교해 소리를 정한다 | store가 단순                   | "같은 곡을 처음부터" 같은 경우를 상태 비교로는 구분하기 어렵다         |
| **store가 상태를 바꾸고 "무엇이 일어났는지"를 돌려준다**        | 소리 결정은 React, 규칙은 core | 동작마다 결과 종류를 정해야 한다                                       |

셋째를 선택했다. "다음 곡을 눌렀더니 목록 끝이라 정지했다"는 상태만으로는 판별할 수 없다. ==위치가 0이 된 것이 "처음 곡으로 이동"인지 "정지"인지 상태에는 남지 않기 때문==이다. store가 결과 종류를 반환하면 React는 그 값으로 분기만 한다.

### 플레이어 store의 상태와 반환값

core에 플레이어 store를 만들었다. 상태는 네 가지다.

```ts
interface PlayerState {
	playlistId: string;
	queue: Queue;
	shuffle: boolean;
	repeat: RepeatMode;
}
```

재생 여부, 재생 위치(초), 음량은 넣지 않았다. 이 값들은 audio 요소가 제공하는 값이라 React 쪽에 그대로 남겼다.

동작은 상태를 바꾸고 결과를 반환한다. 소리 처리는 이 결과를 받은 쪽이 정한다.

| 동작                 | 반환값                               | React의 처리                               |
| -------------------- | ------------------------------------ | ------------------------------------------ |
| `next()`             | `'moved'` / `'stopped'`              | 옮겼으면 곡을 처음부터, 멈췄으면 `pause()` |
| `previous(초)`       | `'moved'` / `'restart'`              | 3초 넘게 들었으면 지금 곡을 처음부터       |
| `ended()`            | `'repeat'` / `'moved'` / `'stopped'` | 한 곡 반복이면 같은 곡을 다시 `play()`     |
| `playFrom(목록, 곡)` | 없음                                 | 선택한 곡 재생                             |

`previous`가 현재 재생 위치를 인자로 받는 것도 같은 이유다. store는 audio 요소에 접근하지 않으므로, 재생 위치는 React가 [`audio.currentTime`](https://developer.mozilla.org/ko/docs/Web/API/HTMLMediaElement/currentTime)에서 읽어 넘긴다.

![플레이어 store의 결과와 React의 처리](./images/desktop-core-music-flow.svg 'store가 반환한 결과에 따라 React가 audio를 제어한다')

React 쪽 코드는 다음과 같이 바뀌었다.

```ts
const next = useCallback(() => {
	if (player.next() === 'stopped') {
		pause();
		startTrack(false);
	} else startTrack(isPlaying);
}, [player, isPlaying, startTrack, pause]);
```

의존성 배열에서 `queue`와 `repeat`이 빠졌다. 대기열을 읽는 일을 store가 맡기 때문이다.

### 같은 위치로 이동할 때도 새 대기열 객체

옮기는 과정에서 누락하기 쉬운 동작이 하나 있었다. 원래 코드는 곡을 이동할 때 위치가 같아도 대기열 객체를 새로 만들었다.

```ts
setQueue((prev) => ({ ...prev, position }));
```

React 쪽 effect는 `queue` 참조가 바뀌면 곡을 다시 재생한다. 곡이 하나뿐인 목록에서 전체 반복 상태로 "다음 곡"을 누르면 위치는 0에서 0이지만, 객체가 새로 생성되므로 effect가 실행되어 곡이 처음부터 다시 재생된다.

> [!WARNING] 위치가 같으면 상태를 유지하는 최적화
> store로 옮길 때 "위치가 같으면 상태를 바꾸지 않는다"는 최적화를 넣으면, 이 경우에 곡이 다시 시작되지 않는다. 그래서 store에서도 위치와 관계없이 대기열 객체를 새로 만들고, 이 동작을 시험으로 고정했다.

```ts
it('같은 위치로 가도 새 대기열을 만든다 (앱이 곡을 처음부터 다시 틀도록)', () => {
	const player = createPlayerStore({ trackIdsOf: () => ['solo'], playlistId: 'all' });
	const before = player.getState().queue;
	player.next();
	expect(player.getState().queue).not.toBe(before);
});
```

### 앱에 남긴 곡 목록

곡 목록(`TRACKS`)은 core로 옮기지 않았다. 곡마다 파일 주소를 `env.musicUrl`에서 만드는데, 이 값은 Vite가 빌드 시각에 넣는 [환경 변수](https://vite.dev/guide/env-and-mode)다. core는 곡 id 목록만 받는다.

```ts
createPlayerStore({ trackIdsOf: (id) => findPlaylist(id).trackIds, playlistId: ALL_SONGS });
```

곡을 앨범·아티스트로 묶는 `groupTracks`와 대기열 계산, 시간 표시(`3:07`, `12분`)는 곡 데이터와 무관한 함수라 core로 옮겼다.

### 음악 이동 확인

- core: 플레이어 store 시험 7개, 대기열 시험 12개
- Playwright 354개. 음악 앱의 곡 선택, 셔플·반복, 다음 곡 시험이 수정 없이 통과했다
- 커밋은 파일 12개, +513/−257이다. 앱의 `library.ts`(94줄)와 그 시험(99줄)에서 대기열 계산이 빠져 core의 `queue.ts`(92줄)·`queue.test.ts`(96줄)로 갔다. `MusicContext.tsx`는 103줄이 바뀌었다

| 위치                             | 전                             | 후                         |
| -------------------------------- | ------------------------------ | -------------------------- |
| 대기열·셔플·반복 상태            | `MusicContext`의 `useState` 셋 | core `playerStore`         |
| 다음 곡 선택 (`nextPosition` 등) | 앱 `library.ts`                | core `queue.ts`            |
| 재생 중·시간·음량                | React (`audio`에서 읽음)       | 그대로 React               |
| 곡 목록 `TRACKS` (파일 주소)     | 앱                             | 그대로 앱 (`env.musicUrl`) |

메뉴 막대의 작은 플레이어(데스크톱 오른쪽 위의 이전·재생·다음 버튼)도 같은 `MusicContext`를 거치므로 이번 변경이 그대로 적용된다. 휴대폰 잠금 화면 같은 곳에 재생 정보를 표시하는 [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)는 아직 연결하지 않았다.

## 남은 과제와 배운 점

이것으로 [#16](https://github.com/hyeoniverse/MacFolio/issues/16)에서 계획한 창 관리, 메모, 음악 세 가지를 모두 옮겼다. 서버(apps/api)도 폴더 정리 규칙을 별도로 구현해 같은 검사를 하고 있었고, 같은 날 [#142](https://github.com/hyeoniverse/MacFolio/pull/142)에서 [화면과 서버가 같은 규칙을 쓰게](/memo/desktop-core-shared-rules) 했다.

"Vue로 같은 데스크톱 만들기"([#6](https://github.com/hyeoniverse/MacFolio/issues/6))는 아직 진행하지 않았다. ==core가 실제로 프레임워크와 무관한지는 두 번째 프레임워크에서 사용해야 검증된다.== 지금은 세 가지 검사(타입·의존성·lint)로 대신한다.

| 단계    | 브라우저 API가 섞인 형태                                | 나눈 방법                                               |
| ------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 창 관리 | Context의 `useState`·`useCallback`이 규칙을 보관        | store를 core로, React는 `useSyncExternalStore`로 구독   |
| 메모    | 순수 함수 파일 끝의 `localStorage` 함수, hook 안의 계산 | 값 검사는 core, 읽기·쓰기는 앱. 계산은 이름 붙인 함수로 |
| 음악    | 한 콜백 안에서 대기열 결정과 `<audio>` 제어             | store가 "발생한 일의 종류"를 반환, React가 분기         |

- "프레임워크에 의존하지 않는다"는 규칙은 코드 리뷰만으로 유지하기 어렵다. 타입 설정에서 DOM을 빼고, 의존성에서 react를 빼고, lint로 경로를 막으면 규칙을 어긴 코드는 빌드 단계에서 실패한다.
- hook 안의 계산은 React와 관계없는 규칙을 React 코드처럼 보이게 한다. 함수로 분리해 이름을 붙이자 시험 한 줄로 동작을 고정할 수 있었다. `localStorage`처럼 브라우저 API를 쓰는 일을 "읽기"와 "검사"로 나누면, 검사 쪽은 어느 환경에서나 실행되는 순수 함수가 된다.
- 부수 효과(소리 재생)가 있는 로직을 나눌 때는 "상태"만 넘기기보다 "발생한 일의 종류"를 반환하면 받는 쪽 코드가 분기 하나로 줄어든다.
- 코드를 옮길 때는 원래 코드가 암묵적으로 의존하던 동작(같은 위치여도 새 객체)을 먼저 찾아 시험으로 고정해야, 옮기는 과정의 최적화가 동작을 바꾸지 않는다.

## 관련 글

- [package.json exports 조건으로 Vite에는 소스, Node에는 빌드한 JS 제공하기](/memo/desktop-core-shared-rules): 분리 이후 서버와 규칙 공유
- [CSS translate와 pointer-events로 레이아웃을 건드리지 않고 창 밀어내기](/memo/reveal-desktop): 창 store에 `desktopRevealed` 상태를 추가한 기능

PR: [#139](https://github.com/hyeoniverse/MacFolio/pull/139), [#140](https://github.com/hyeoniverse/MacFolio/pull/140), [#141](https://github.com/hyeoniverse/MacFolio/pull/141)

<details>
<summary>참고 문헌</summary>

- React 문서, [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- React 문서, [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context)
- pnpm 문서, [Motivation: Creating a non-flat node_modules directory](https://pnpm.io/motivation#creating-a-non-flat-node_modules-directory)
- ESLint 문서, [no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
- TypeScript 문서, [lib](https://www.typescriptlang.org/tsconfig/#lib)
- MDN, [HTMLMediaElement: currentTime](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime)
- Node.js 문서, [Packages: Subpath exports](https://nodejs.org/api/packages.html#subpath-exports)

</details>

<details>
<summary>사진 출처</summary>

- pnpm의 node_modules 구조: pnpm 문서, [Motivation](https://pnpm.io/motivation) ([isolated-node-modules.svg](https://pnpm.io/docs-assets/12.x/img/isolated-node-modules.svg)), 출처 표기

</details>

[^usese]: React 18에서 추가된 hook으로, React 바깥의 저장소를 구독한다. `subscribe`와 `getSnapshot` 두 함수를 받아, 저장소가 바뀌면 컴포넌트를 다시 렌더링한다.

[^pnpm]: pnpm은 각 패키지의 `node_modules`에 `package.json`에 선언한 의존성만 링크한다. 그래서 다른 패키지가 설치한 react를 우연히 import하는 일(유령 의존성)이 생기지 않는다. 설명은 [pnpm 문서](https://pnpm.io/motivation#creating-a-non-flat-node_modules-directory)에 있다.

[^dom]: `tsconfig.json`의 `lib`에 `DOM`이 없으면 `window`, `localStorage` 같은 브라우저 전역 이름의 타입이 없어 `Cannot find name` 오류가 난다. core의 설정은 앞의 "core의 React 의존을 막는 세 장치" 절에서 설명했다.

#MacFolio #데스크톱 #메모앱 #리팩터링
