---
title: Flux 패턴의 Action·Dispatcher·Store·View 단방향 흐름과 2026년 상태 관리 동향
date: 2026-10-25
category: 인사이트/프론트엔드
summary: Flux는 상태 변경 요청이 Action → Dispatcher → Store → View 한 방향으로만 전달되게 하는 구조다. 네 구성 요소와 Redux·Zustand·useSyncExternalStore가 바꾼 점을 공식 문서로 정리하고, npm 다운로드와 State of React 2025 설문으로 2026년 상태 관리 동향을 분석했다.
---

Flux는 Facebook이 2014년에 공개한 클라이언트 애플리케이션 구조다. 상태 변경 요청은 **Action → Dispatcher → Store → View** 한 방향으로만 전달된다. 현재 Flux 라이브러리를 직접 사용하는 프로젝트는 드물다. 그러나 Redux·Zustand 같은 상태 관리 라이브러리와 React의 `useReducer`·`useSyncExternalStore`는 모두 이 구조를 바탕으로 설계되었다.

이 글은 공식 문서를 기준으로 다음 내용을 정리한다.

1. Flux가 해결하려던 문제와 네 구성 요소
2. Redux와 외부 store 라이브러리가 Flux에서 바꾼 점
3. npm 다운로드 수치와 개발자 설문으로 본 2026년 상태 관리 동향
4. Flux 이후 10여 년 동안 바뀐 설계와 바뀌지 않은 규칙

## Flux가 나온 배경: 양방향 바인딩의 연쇄 갱신

Flux는 2014년 F8 컨퍼런스 세션에서 처음 발표되었고, 같은 해 5월 6일 React 블로그에 [Flux: An Application Architecture for React](https://legacy.reactjs.org/blog/2014/05/06/flux.html)(Bill Fisher·Jing Chen)가 게시되었다. Flux 문서의 [In-Depth Overview](https://facebookarchive.github.io/flux/docs/in-depth-overview)는 Flux를 "Facebook이 클라이언트 웹 애플리케이션을 만들 때 사용하는 구조"로 소개하고, MVC 대신 단방향 데이터 흐름을 채택한 이유를 다음과 같이 설명한다.

![2014년 React 블로그의 Flux 발표 글](./images/flux-pattern-react-blog-2014.jpg '2014년 5월 6일 Bill Fisher·Jing Chen이 게시한 "Flux: An Application Architecture for React". F8 세션 영상 "Hacker Way: Rethinking Web App Development at Facebook"이 함께 실려 있다. 현재는 보관된 legacy.reactjs.org에서 볼 수 있다(2026년 10월 29일 캡처)')

> We found that two-way data bindings led to cascading updates, where changing one object led to another object changing, which could also trigger more updates.

양방향 바인딩(two-way data binding)은 모델이 바뀌면 뷰가 갱신되고, 뷰에서 입력이 들어오면 모델도 갱신되는 연결 방식이다. Overview가 예로 든 문제는 파생 데이터의 동기화였다. 메시지 스레드 목록에서 읽지 않은 스레드를 강조하고, 다른 뷰에 읽지 않은 메시지 수를 표시하는 화면이 있다. MVC 구조에서는 스레드 하나를 읽음으로 바꿀 때 스레드 모델과 읽지 않은 수 모델을 각각 갱신해야 한다. Overview는 이런 모델 사이의 의존과 연쇄 갱신이 큰 MVC 애플리케이션의 데이터 흐름을 복잡하게 만든다고 지적한다.

모델과 뷰가 양방향으로 연결되어 있으면 모델 하나의 변경이 다른 모델과 뷰로 연쇄적으로 전파된다. 다음 코드는 메시지 화면의 모델과 뷰가 서로를 직접 갱신하는 예다.

```js
// 모델과 뷰가 서로의 변경 이벤트를 구독해 직접 갱신한다
thread.on('change:read', () => unreadCounter.recalculate()); // 스레드 → 읽지 않은 수 모델
unreadCounter.on('change', () => tabBadge.render()); // 읽지 않은 수 → 탭 배지 뷰
tabBadge.on('click', () => threadList.markAllRead()); // 배지 클릭 → 다시 모든 스레드 모델
threadList.on('change', () => unreadCounter.recalculate()); // 스레드 목록 → 다시 읽지 않은 수
```

스레드 하나를 읽음으로 바꾸면 `unreadCounter`와 `tabBadge`가 차례로 갱신된다. 배지를 클릭하면 `threadList`가 바뀌고, 그 변경이 다시 `unreadCounter`를 갱신한다. 모델이 수십 개로 늘어나면 어떤 동작이 어떤 순서로 어느 모델을 바꾸는지 코드만 보고 파악하기 어렵고, 같은 모델이 한 번의 동작에 여러 번 갱신되는 경우도 생긴다. Flux는 상태를 바꾸는 경로를 하나로 제한해 이 문제를 해결한다.

![양방향 바인딩과 Flux의 단방향 흐름](./images/flux-pattern-mvc-vs-flux.svg '왼쪽: 모델과 뷰가 서로를 갱신해 변경이 연쇄된다. 오른쪽: 상태 변경은 Action에서 시작해 Dispatcher와 Store를 거쳐 View로만 전달된다')

## 네 구성 요소

In-Depth Overview는 Flux의 주요 구성 요소로 Dispatcher, Store, View를 들고, Action을 생성하는 action creator를 네 번째 구성 요소로 설명한다.

![Flux 저장소 README의 구조도](./images/flux-pattern-official-diagram.jpg 'facebookarchive/flux README에 실린 공식 구조도. 사용자 입력과 Web API 응답이 모두 Action Creators를 거쳐 Dispatcher로 전달되고, Store의 변경 이벤트를 받은 React Views가 다시 렌더링한다. 2026년 10월 30일 캡처')

| 구성 요소  | 역할                                                                                                | 제약                                   |
| ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Action     | 발생한 일을 기술하는 일반 객체. 식별용 `type`과 새 데이터를 담는다                                  | 상태를 직접 변경하지 않는다            |
| Dispatcher | 모든 데이터 흐름이 거치는 중앙 허브. Store가 등록한 콜백 목록을 갖고, Action을 모든 콜백에 전달한다 | 상태를 보관하지 않는다                 |
| Store      | 애플리케이션 상태와 상태 변경 로직. Action을 받아 자신의 상태를 갱신하고 변경 이벤트를 발생시킨다   | 외부에서 상태를 설정하는 메서드가 없다 |
| View       | Store의 변경 이벤트를 받아 상태를 조회하고 다시 렌더링한다. 사용자 입력은 새 Action으로 변환한다    | Store를 직접 수정하지 않는다           |

한 번의 상태 변경은 항상 같은 순서로 처리된다.

1. 사용자가 버튼을 누르면 View가 action creator를 호출한다. action creator는 `{ type: 'todo/create', text }` 같은 Action을 Dispatcher에 보낸다.
2. Dispatcher는 그 Action을 등록된 **모든** Store의 콜백에 전달한다.
3. 각 Store는 Action의 `type`을 확인하고, 처리 대상이면 자신의 상태를 갱신한 뒤 변경 이벤트를 발생시킨다.
4. View는 변경 이벤트를 받아 Store에서 상태를 다시 조회하고 렌더링한다.

![Flux 한 사이클의 시퀀스](./images/flux-pattern-cycle.svg 'View → action creator → Dispatcher → 두 Store의 콜백 → change 이벤트 → View 순서. 상태 변경 요청과 변경 알림은 서로 다른 경로로 전달되고, View에서 Store로 직접 연결된 경로는 없다')

할 일 목록에 항목 하나를 추가하는 과정을 코드로 쓰면 다음과 같다.

```js
// action creator: 발생한 일을 기술한 Action을 만들어 Dispatcher에 보낸다
function createTodo(text) {
	AppDispatcher.dispatch({ type: 'todo/create', text });
}

// Store: Dispatcher에 콜백을 등록하고, 처리할 Action이면 상태를 갱신한 뒤 변경 이벤트를 발생시킨다
const todos = [];
AppDispatcher.register((action) => {
	if (action.type === 'todo/create') {
		todos.push({ text: action.text, done: false });
		TodoStore.emit('change');
	}
});

// View: 변경 이벤트를 받으면 Store에서 목록을 다시 조회해 렌더링한다
TodoStore.on('change', () => render(TodoStore.getAll()));
```

View는 `todos` 배열에 직접 접근하지 않는다. 항목을 추가하려면 `createTodo()`로 Action을 보내야 하고, 화면은 `change` 이벤트를 받은 뒤에만 다시 그려진다.

상태를 바꾸는 경로가 Dispatcher를 거치는 Action 하나뿐이므로, Dispatcher를 통과한 Action만 기록하면 어떤 상태가 어떤 이유로 바뀌었는지 추적할 수 있다.

### waitFor: Store 사이의 갱신 순서

Store가 여러 개이면 한 Store가 다른 Store의 갱신 결과에 의존하는 경우가 생긴다. Flux의 [Dispatcher 문서](https://facebookarchive.github.io/flux/docs/dispatcher)는 나라·도시·항공권 가격을 예로 든다. 나라를 바꾸면 도시 Store는 그 나라의 기본 도시를 선택하고, 가격 Store는 선택된 도시의 항공권 가격을 계산한다. 가격 Store는 도시 Store보다, 도시 Store는 나라 Store보다 나중에 실행되어야 올바른 값을 계산한다. Dispatcher의 `waitFor()`는 Store 콜백 안에서 지정한 Store들의 콜백이 먼저 끝나기를 기다리게 하는 메서드다.

![waitFor가 없을 때와 있을 때의 실행 순서](./images/flux-pattern-waitfor.svg '위: 가격 Store가 먼저 실행되면 도시는 파리로 바뀌었지만 가격은 서울 기준으로 남는다. 아래: waitFor로 나라 → 도시 → 가격 순서를 지정하면 파리 가격이 계산된다')

<details>
<summary>waitFor 사용 예 (Dispatcher 문서의 예에서 country-update 처리만 발췌)</summary>

```js
// 나라 Store. register는 등록 토큰을 반환한다
CountryStore.dispatchToken = flightDispatcher.register((payload) => {
	if (payload.actionType === 'country-update') CountryStore.country = payload.selectedCountry;
});

// 도시 Store: 나라 Store가 끝난 뒤 그 나라의 기본 도시를 선택한다
CityStore.dispatchToken = flightDispatcher.register((payload) => {
	if (payload.actionType === 'country-update') {
		flightDispatcher.waitFor([CountryStore.dispatchToken]);
		CityStore.city = getDefaultCityForCountry(CountryStore.country);
	}
});

// 가격 Store: 도시 Store가 끝난 뒤 나라·도시로 가격을 계산한다
FlightPriceStore.dispatchToken = flightDispatcher.register((payload) => {
	if (payload.actionType === 'country-update') {
		flightDispatcher.waitFor([CityStore.dispatchToken]);
		FlightPriceStore.price = getFlightPriceStore(CountryStore.country, CityStore.city);
	}
});
```

</details>

In-Depth Overview는 `waitFor()`가 "크고 복잡한 애플리케이션에서 필수"(becomes vital in a larger, more complex application)라고 설명한다. Store가 늘어날수록 Store 사이의 실행 순서를 개발자가 직접 관리해야 한다는 의미다. Redux는 이 문제를 다른 방식으로 해결했다.

## Flux 이후의 Redux

![보관된 Flux 저장소](./images/flux-pattern-archived-repo.jpg 'facebookarchive/flux 저장소는 2023년 3월 23일 보관(read-only) 상태로 전환되었다. Star 17.4k, Fork 3.4k. 2026년 10월 30일 캡처')

Flux 라이브러리 저장소는 2023년 3월 보관(read-only) 상태로 전환되어 더 이상 갱신되지 않는다. 그 전부터 Flux 구조를 사용하는 프로젝트 대부분은 Redux를 채택했다.

[Redux 문서의 Prior Art](https://redux.js.org/understanding/history-and-design/prior-art)는 Redux가 Flux에서 계승한 점과 변경한 점을 비교한다.

- **계승한 점:** 모델 갱신 로직을 한 계층(Flux의 Store, Redux의 reducer)에 모으고, 모든 변경을 Action이라는 일반 객체로 기술한다.
- **변경한 점 ①:** Redux에는 **Dispatcher가 없다.** 이벤트 에미터 대신 순수 함수(reducer)를 사용한다. 순수 함수는 같은 입력에 항상 같은 결과를 반환하고 외부 상태를 바꾸지 않는 함수로, 여러 reducer를 하나로 합성할 수 있으므로 이를 관리하는 별도 객체가 필요 없다. 문서는 Flux를 `(state, action) => state` 형태로 볼 수 있다고 설명하고, Redux를 이 구조를 순수 함수로 단순화한 형태로 정의한다.
- **변경한 점 ②:** Redux는 상태를 **불변(immutable)으로 다룬다.** reducer는 기존 객체를 수정하지 않고 새 객체를 반환한다. 기존 객체를 직접 수정하면 time travel(이전 상태로 되돌려 보기), 기록·재생, 핫 리로드 같은 개발 도구가 정상적으로 동작하지 않는다.

Redux의 [세 가지 원칙](https://redux.js.org/understanding/thinking-in-redux/three-principles)도 같은 내용을 담고 있다.

| 원칙                                 | 내용                                                             | Flux와 비교                                                |
| ------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Single source of truth               | 전역 상태를 **하나의** store 객체 트리에 보관한다                | Flux는 도메인마다 Store가 있다                             |
| State is read-only                   | 상태를 바꾸는 방법은 발생한 일을 기술한 Action을 보내는 것뿐이다 | 같다                                                       |
| Changes are made with pure functions | Action에 따른 상태 트리의 변경은 순수 함수인 reducer로 정의한다  | Flux Store는 내부 상태를 직접 갱신하고 이벤트를 발생시킨다 |

같은 할 일 추가를 Redux reducer로 작성하면 다음과 같다.

```js
// reducer: 이전 상태와 Action을 받아 새 상태를 반환하는 순수 함수
function todosReducer(state = [], action) {
	switch (action.type) {
		case 'todo/add':
			return [...state, { text: action.text, done: false }]; // 기존 배열을 복사한 새 배열
		default:
			return state;
	}
}

store.dispatch({ type: 'todo/add', text: '장보기' });
```

`state.push(...)`로 기존 배열을 직접 수정하고 같은 배열을 반환하면, Redux와 react-redux는 이전 상태와 다음 상태가 같은 객체라고 판단해 화면을 갱신하지 않는다. Redux DevTools의 기록에도 이전 상태와 다음 상태가 같은 배열로 남아, 특정 시점의 상태로 되돌아갈 수 없다.

store가 하나이고 reducer를 합성해 사용하므로, Flux에서 `waitFor()`로 관리하던 Store 사이의 실행 순서는 reducer 호출 순서로 대체된다. 상태가 객체 하나이므로 Action마다 이전 상태와 다음 상태를 기록할 수 있고, Redux DevTools의 time travel 기능은 이 기록을 이용한다.

![Redux 문서의 데이터 흐름 그림](./images/flux-pattern-redux-dataflow.jpg 'Redux Fundamentals Part 2의 데이터 흐름 그림. Deposit 버튼의 이벤트 핸들러가 Action을 dispatch하고, store가 reducer를 실행해 만든 새 State가 UI의 금액에 반영된다. 원본 GIF의 한 장면을 캡처했다(2026년 10월 30일)')

![Redux의 흐름과 상태 스냅숏](./images/flux-pattern-redux-flow.svg '위: UI가 dispatch한 Action으로 store가 reducer를 호출해 새 state를 받고 구독자에게 알린다. 아래: todo/add와 filter/set을 거치며 state₀·state₁·state₂가 각각 별도 객체로 보존된다')

## 외부 store와 useSyncExternalStore

외부 store는 상태를 React 컴포넌트 트리 밖의 객체에 보관하고, 컴포넌트가 그 객체를 구독하는 방식이다. 이 방식도 Flux의 단방향 흐름을 따른다. [Zustand](https://github.com/pmndrs/zustand)는 README에서 자신을 "단순화한 Flux 원칙(simplified flux principles)을 사용하는 작은 상태 관리 라이브러리"로 소개한다. React 없이 사용하는 vanilla `createStore`는 `getState`·`setState`·`subscribe`·`getInitialState`를 반환한다.

![Zustand README 첫머리](./images/flux-pattern-zustand-readme.jpg 'pmndrs/zustand README 첫머리. 배지에 번들 크기 9.35kB, npm 버전 5.0.16, 누적 다운로드 2G가 표시되어 있다. 2026년 10월 30일 캡처')

Zustand 문서의 [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)는 Flux·Redux에서 가져온 권장 방식 세 가지를 제시한다.

- **Single store:** 전역 상태는 Zustand store 하나에 보관하고, 규모가 크면 slice 단위로 나눈다.
- **`set`/`setState`로만 갱신:** 변경 내용을 기존 상태에 병합하고 구독자에게 알리는 처리는 `set`이 담당한다.
- **Colocate store actions:** 다른 Flux 계열 라이브러리처럼 Action을 dispatch하고 reducer로 처리하지 않고, 상태를 바꾸는 함수(store action)를 store 안에 함께 정의한다. reducer 방식이 필요하면 store에 `dispatch` 함수를 직접 정의할 수 있다.

Zustand는 Action 객체와 Dispatcher를 생략하고, store에 정의한 함수가 새 상태를 만들어 구독자에게 알리는 구조다. 같은 할 일 추가를 Zustand로 작성하면 다음과 같다.

```js
const useTodoStore = create((set) => ({
	todos: [],
	// store action: 상태를 바꾸는 함수를 store 안에 함께 정의한다
	addTodo: (text) => set((state) => ({ todos: [...state.todos, { text, done: false }] })),
}));

// 컴포넌트는 selector로 필요한 값만 구독하고, store action을 직접 호출한다
const todos = useTodoStore((state) => state.todos);
const addTodo = useTodoStore((state) => state.addTodo);
addTodo('장보기');
```

Redux에서는 Action 타입(`'todo/add'`), reducer의 `case`, `dispatch` 호출을 각각 작성해야 했다. Zustand에서는 `addTodo` 함수 하나로 같은 변경을 처리한다. 상태를 새 배열로 교체하고 구독자에게 알리는 순서는 Redux와 같다.

React는 18 버전부터 이런 외부 store를 구독하는 표준 hook인 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)를 제공한다.

![react.dev의 useSyncExternalStore 문서](./images/flux-pattern-react-docs.jpg 'react.dev API Reference의 useSyncExternalStore 문서. 외부 store를 구독하는 hook으로, subscribe와 getSnapshot, 서버 렌더링용 getServerSnapshot을 인자로 받는다. 2026년 10월 30일 캡처')

- `subscribe(callback)`: store가 바뀌면 `callback`을 호출하고, 구독을 해제하는 함수를 반환한다.
- `getSnapshot()`: store의 현재 값(스냅숏)을 반환한다. store가 바뀌지 않았으면 같은 값을 반환해야 한다. React는 반환값을 `Object.is`로 비교해 값이 다르면 다시 렌더링한다. 호출할 때마다 새 객체를 반환하면 비교 결과가 항상 '다름'이 되어 무한 렌더링 오류가 발생한다.
- Transition(우선순위가 낮아 중단될 수 있는 업데이트) 도중 store가 바뀌면, React는 DOM에 반영하기 직전 `getSnapshot`을 다시 호출한다. 값이 다르면 그 업데이트를 중단할 수 없는 업데이트로 처음부터 다시 실행한다. 한 화면의 컴포넌트들이 서로 다른 버전의 store 값을 표시하는 tearing 현상을 막기 위한 처리다.

![useSyncExternalStore의 구독 순서](./images/flux-pattern-use-sync-external-store.svg '렌더링 중 getSnapshot으로 v1을 조회하고 subscribe로 콜백을 등록한다. store가 setState로 바뀌면 콜백이 호출되고, React가 getSnapshot을 다시 호출해 v2와 Object.is로 비교한 뒤 다르면 다시 렌더링한다')

React 문서의 예는 브라우저의 온라인 상태를 구독하는 hook이다. `navigator.onLine`은 React가 관리하지 않는 값이므로 외부 store로 취급한다.

```js
function subscribe(callback) {
	window.addEventListener('online', callback);
	window.addEventListener('offline', callback);
	return () => {
		window.removeEventListener('online', callback);
		window.removeEventListener('offline', callback);
	};
}

function useOnlineStatus() {
	return useSyncExternalStore(subscribe, () => navigator.onLine); // getSnapshot은 boolean을 반환한다
}
```

반대로 `getSnapshot`을 `() => ({ todos: store.todos })`처럼 작성하면 호출할 때마다 새 객체가 만들어진다. 내용이 같아도 `Object.is` 비교 결과가 항상 '다름'이므로 React가 렌더링을 반복하다 오류를 발생시킨다. 이 경우 `() => store.todos`처럼 store가 보관한 값을 그대로 반환해야 한다.

React 문서는 가능하면 `useState`·`useReducer` 같은 React 내장 상태를 사용하라고 권장하고, `useSyncExternalStore`는 주로 React 외부 코드와 연동할 때 사용한다고 설명한다. `useReducer`는 reducer와 Action을 컴포넌트 안에서 사용하는 hook으로, Flux·Redux의 갱신 방식을 React 내장 상태에 적용한 형태다.

## 2026년의 상태 관리 동향

### npm 다운로드: zustand가 redux를 추월

![상태 관리 패키지의 분기별 npm 다운로드](./images/flux-pattern-npm-trend.svg '2023년 4분기부터 2026년 3분기까지의 분기별 다운로드. TanStack Query와 zustand가 2026년에 redux를 추월했다. 2026년에는 모든 패키지의 다운로드가 함께 증가해, 절대값보다 순위와 비율을 비교한다')

npm registry API로 최근 3년의 분기별 다운로드를 집계했다[^npm]. 2026년에는 다섯 패키지의 다운로드가 모두 3~5배 증가했다. 개별 라이브러리의 사용 증가보다 CI·자동화 도구에 의한 npm 전체 설치량 증가의 영향이 크므로, 절대값 대신 패키지 사이의 비율을 비교했다.

| 비율                   | 2023년 4분기 | 2026년 3분기 |
| ---------------------- | -----------: | -----------: |
| zustand ÷ redux        |         0.28 |         1.24 |
| TanStack Query ÷ redux |         0.26 |         1.54 |
| Redux Toolkit ÷ redux  |         0.33 |         0.66 |

- **zustand가 redux를 추월했다.** 2026년 2분기에 처음 redux보다 많이 다운로드되었고(4.70억 회 대 4.24억 회), 10월 20~26일 한 주에도 5,636만 회 대 4,118만 회를 기록했다.
- **서버 상태 라이브러리의 다운로드가 가장 많다.** TanStack Query(`@tanstack/react-query`)는 같은 주 5,451만 회로, 전역 상태 라이브러리와 비슷하거나 더 많다.
- **Redux Toolkit의 비중이 늘었다.** `redux` 패키지는 Redux Toolkit과 react-redux의 의존성으로도 설치되므로, redux 다운로드 수에는 Redux Toolkit 사용자가 포함되어 있다.

다운로드 수는 사용자 수와 다르다. 다른 패키지의 의존성으로 설치된 횟수와 CI가 빌드마다 다시 내려받은 횟수가 포함된다. 따라서 이 수치는 증감 방향을 확인하는 지표로만 사용했다.

![한 주 npm 다운로드](./images/flux-pattern-weekly-downloads.svg '2026년 10월 20~26일. zustand 5,636만, TanStack Query 5,451만, redux 4,118만, Redux Toolkit 3,039만 회. jotai 이하는 수백만 회 수준이다')

### State of React 2025: 응답자의 33.8%는 상태 관리 라이브러리를 사용하지 않음

[State of React 2025](https://2025.stateofreact.com/en-US/libraries/state-management/) 설문(2025년 11월~2026년 1월, 응답 3,760명)의 상태 관리 항목 결과는 다음과 같다.

![State of React 2025의 상태 관리 사용률 추이](./images/flux-pattern-state-of-react-2025.jpg '응답자 중 사용 경험이 있는 비율(Usage). 2023→2025년 Redux는 약 80%에서 75%로 감소했고, Redux Toolkit은 55% 안팎을 유지했으며, Zustand는 약 28%에서 50%로 증가했다. 2026년 10월 29일 캡처')

- 응답자 1,271명(33.8%)이 상태 관리 라이브러리를 사용하지 않는다고 답했다. 설문 결과 해설은 `useState`·`useContext` 같은 React 내장 API로 충분한 경우가 많기 때문으로 분석했다.
- Redux와 Redux Toolkit은 오랫동안 가장 널리 사용된 라이브러리다. Zustand는 사용률이 빠르게 증가했고 만족도가 가장 높아, 해설은 Zustand를 이 분야의 선두로 평가했다.
- TanStack Query는 상태 관리 라이브러리 목록에 없었지만 기타 응답에서 가장 많이 언급되었고(42회), 평가도 가장 긍정적이었다.
- 이번 설문은 예년보다 늦게 진행되어 응답 수가 적었다. 비율은 이 표본 안에서만 유효하다.

### Signals: TC39 표준화 논의

signal은 값이 바뀌면 그 값에 의존하는 계산과 화면만 다시 실행하는 반응형 상태 단위다. Angular·Vue·Solid·Preact가 이 방식을 사용한다. TC39(JavaScript 표준 위원회)에는 signal의 핵심 기능인 쓰기 가능한 상태, 의존성을 추적하는 파생 값(computed), 변경 감시(watcher)를 언어 표준으로 정의하려는 [Signals 제안](https://github.com/tc39/proposal-signals)이 제출되어 있다. 2026년 10월 기준으로 Stage 1이고, 애플리케이션 개발자가 직접 사용할 API보다 프레임워크들이 공통으로 사용할 기반을 목표로 한다. React는 signal을 채택하지 않고 컴포넌트 단위로 다시 렌더링하는 방식을 유지하고 있다.

![TC39 Signals 제안 저장소](./images/flux-pattern-tc39-signals.jpg 'tc39/proposal-signals README 첫머리. Stage 1이고, Angular·Vue·Solid·Svelte·MobX 등 여러 프레임워크 작성자가 설계에 참여하고 있다. 2026년 10월 29일 캡처')

## 고찰: Flux 이후 바뀐 설계와 유지된 규칙

![Flux에서 useSyncExternalStore까지](./images/flux-pattern-evolution.svg 'Flux(2014년 5월 React 블로그), Redux 1.0.0(2015년 8월), Zustand 1.0.0(2019년 6월), React 18(2022년 3월)에서 각각 제거·변경·추가된 요소. 네 단계 모두 View가 상태를 직접 변경하지 않는다')

공식 문서의 변경 내역과 2026년 수치를 비교하면 Flux 이후 상태 관리 설계에는 세 가지 변화가 있었다.

### 1. Dispatcher와 Action 객체가 선택 사항이 되었다

Redux는 Dispatcher를 순수 함수인 reducer로 대체했고, Zustand는 Action 객체와 reducer도 필수 요소에서 제외했다. 현재 대부분의 라이브러리는 store가 제공하는 함수를 호출해 상태를 변경한다.

모든 변경을 Action 객체로 기술하면 변경 기록을 남기고 time travel 디버깅을 할 수 있지만, Action 타입과 reducer를 매번 정의해야 하는 코드가 늘어난다. zustand가 redux를 추월한 수치는 많은 애플리케이션이 이 정의 코드를 줄이는 쪽을 선택했다는 근거다. 변경 기록이 필요한 대규모 프로젝트에서는 Redux 대신 Redux Toolkit의 비중이 늘었다.

### 2. 서버 상태를 별도 라이브러리로 관리한다

Flux의 Store는 서버에서 받은 데이터와 화면 상태를 함께 보관했다. 글 목록을 전역 store에 보관하면 로딩 상태, 오류, 마지막으로 받아 온 시각, 다른 화면에서 글을 수정했을 때 목록을 다시 받아 오는 로직을 모두 직접 작성해야 한다.

```js
// 서버 상태 라이브러리(TanStack Query): 캐싱과 재요청을 라이브러리가 처리한다
const { data: posts, isPending, error } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

// 글을 수정한 뒤 'posts' 캐시를 무효화하면 목록을 사용하는 모든 화면이 새 데이터를 받아 온다
queryClient.invalidateQueries({ queryKey: ['posts'] });
```

현재는 이처럼 서버 데이터의 캐싱, 재요청, 무효화(invalidation, 캐시를 오래된 것으로 표시해 다시 요청하게 하는 처리)를 담당하는 서버 상태 라이브러리를 별도로 사용하고, TanStack Query의 다운로드 수는 전역 상태 라이브러리보다 많다. 서버 데이터가 빠지면 전역 store에는 서버와 무관한 화면 상태만 남는다. store 규모가 작아지면서 React 내장 상태만으로 충분한 애플리케이션이 늘었고, 설문 응답자의 33.8%가 상태 관리 라이브러리를 사용하지 않는다는 결과도 같은 변화를 보여 준다.

### 3. 구독 단위가 세분화되었다

구독 단위는 상태가 바뀌었을 때 어느 범위의 컴포넌트가 다시 렌더링되는지를 결정한다. Flux의 Store는 변경 이벤트 하나만 발생시켰고, View는 그 이벤트를 받으면 Store 전체를 다시 조회했다. 이후 라이브러리는 구독 단위를 점점 세분화했다.

| 방식        | 예                | 다시 계산되는 범위                                             |
| ----------- | ----------------- | -------------------------------------------------------------- |
| 변경 이벤트 | Flux Store        | Store를 구독하는 모든 View                                     |
| selector    | Redux, Zustand    | store에서 선택한 값이 바뀐 컴포넌트                            |
| atom        | Jotai             | 상태를 작은 단위(atom)로 나누고, 바뀐 atom을 사용하는 컴포넌트 |
| signal      | Angular·Vue·Solid | 바뀐 값에 의존하는 계산과 DOM                                  |

selector는 store 전체에서 컴포넌트가 사용하는 값만 골라내는 함수이고, atom은 전역 상태를 독립적으로 구독할 수 있도록 나눈 작은 상태 단위다. 장바구니 수량 하나가 바뀌는 경우로 비교하면 다음과 같다.

```js
// selector (Zustand): 장바구니 개수를 선택한 컴포넌트만 다시 렌더링된다. 사용자 이름을 선택한 헤더는 그대로다
const count = useShopStore((state) => state.cart.length);

// atom (Jotai): 장바구니를 별도 atom으로 나누면 cartAtom을 사용하는 컴포넌트만 다시 렌더링된다
const cartAtom = atom([]);
const cart = useAtomValue(cartAtom);

// signal (Preact Signals): 컴포넌트를 다시 렌더링하지 않고 cartCount에 의존하는 텍스트 노드만 갱신한다
const cartCount = signal(0);
effect(() => (badge.textContent = String(cartCount.value)));
```

Flux 방식이라면 장바구니가 바뀔 때 Store 전체의 `change` 이벤트가 발생하고, 헤더처럼 장바구니와 무관한 View도 Store를 다시 조회한다. TC39의 Signals 제안은 이 중 가장 세밀한 signal 방식을 언어 표준으로 정의하려는 시도다.

![구독 단위가 세분화되어 온 과정](./images/flux-pattern-granularity.svg 'Flux Store의 변경 이벤트에서 selector, atom, signal 순으로, 값 하나가 바뀌었을 때 다시 계산되는 범위가 좁아진다')

### 유지된 규칙

변하지 않은 규칙도 있다. **View는 상태를 직접 변경하지 않고, 정해진 함수나 Action으로 변경을 요청한 뒤 변경 알림을 받아 상태를 다시 조회한다.** Dispatcher와 Action 객체는 생략되었지만 단방향 흐름은 모든 라이브러리에 남아 있고, React는 `useSyncExternalStore`로 이 구독 방식을 표준 API에 포함했다.

## 상황별 선택 기준

Redux FAQ의 [When should I use Redux?](https://redux.js.org/faq/general#when-should-i-use-redux)는 "Not all apps need Redux"라는 문장으로 시작한다. 아래 기준은 각 라이브러리의 공식 문서에 근거하고, 예는 블로그 앱을 기준으로 들었다.

- **한 컴포넌트 안에서만 사용하는 상태 → `useState`·`useReducer`.** React 문서는 가능하면 React 내장 상태를 사용하라고 권장한다([useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)의 Note).
  - 예: 댓글 입력 칸의 내용, 드롭다운 메뉴의 열림 여부
- **한 화면의 갱신 로직이 복잡하고, 깊은 하위 컴포넌트까지 상태와 갱신 함수를 전달해야 하는 상태 → `useReducer` + Context.** React 문서는 reducer와 Context를 결합해 복잡한 화면의 상태를 관리하는 방법을 설명한다([Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)).
  - 예: 단계가 여러 개인 글 작성 마법사
- **여러 화면이 공유하는 클라이언트 상태를 store 하나로 관리하고, Action 객체와 reducer 없이 store 함수로 갱신하려는 경우 → Zustand.** [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)가 권장하는 방식(single store, `set`으로만 갱신, store action을 store 안에 정의)이다.
  - 예: 다크 모드 설정, 사이드바 접힘 여부, 장바구니
- **큰 상태를 여러 곳에서 사용하고, 자주 바뀌고, 갱신 로직이 복잡하고, 여러 개발자가 함께 작업하고, 상태 변화 이력을 확인해야 하는 경우 → Redux.** Redux FAQ가 Redux가 가장 효과적인 경우로 제시한 다섯 조건이다. 새로 도입할 때는 [Redux Toolkit](https://redux.js.org/introduction/getting-started)을 공식 권장 방식으로 안내한다.
  - 예: 권한·필터·편집 기록이 얽힌 대규모 관리자 화면
- **React 외부 코드의 값을 컴포넌트에서 구독하는 경우 → `useSyncExternalStore`.** React 문서는 이 hook이 주로 React 외부 코드와 연동할 때 쓰인다고 설명한다.
  - 예: 온라인 상태(`navigator.onLine`), 창 크기, 직접 구현한 store
- **데이터가 서버에 있고, 다른 사용자가 바꿀 수 있으며, 시간이 지나면 최신 상태가 아니게 되는 경우 → 서버 상태 라이브러리(예: TanStack Query).** [TanStack Query 개요](https://tanstack.com/query/latest/docs/framework/react/overview)는 기존 상태 관리 라이브러리가 클라이언트 상태에는 적합하지만 비동기 데이터와 서버 상태에는 적합하지 않다고 설명한다.
  - 예: 글 목록, 댓글, 좋아요 수

한 애플리케이션 안에서도 상태의 종류마다 다른 방식을 함께 사용한다. 예를 들어 블로그 편집 화면에서 글 목록은 TanStack Query로, 편집 중인 글의 선택 영역은 `useReducer`로, 다크 모드 설정은 Zustand로 관리할 수 있다.

## 마치며: 2026년의 상태 관리 설계

Flux가 2014년에 제시한 핵심은 라이브러리보다 규칙이었다. 상태는 정해진 경로로만 변경하고, View는 변경 알림을 받은 뒤 상태를 다시 조회한다. 12년이 지난 지금도 이 규칙은 Redux, Zustand, `useSyncExternalStore`에 모두 적용되어 있다. 바뀐 것은 규칙을 구현하는 데 필요한 코드의 양이다. Dispatcher, Action 타입 상수, reducer를 모두 작성하던 구조는 store 함수 하나를 호출하는 구조로 줄었고, 서버 데이터는 전역 store에서 분리되었다.

2026년의 수치와 공식 문서를 근거로 하면, 새 프로젝트의 상태는 다음 순서로 설계한다.

1. **서버 데이터를 먼저 분리한다.** API에서 받은 데이터는 서버 상태 라이브러리에 맡기고 전역 store에 복사하지 않는다. 2026년 3분기 TanStack Query의 다운로드는 redux의 1.54배로, 집계한 다섯 패키지 가운데 가장 많다.
2. **남은 상태는 React 내장 상태로 시작한다.** State of React 2025 응답자의 33.8%는 상태 관리 라이브러리 없이 개발한다.
3. **여러 화면이 공유하는 클라이언트 상태가 생기면 외부 store를 도입한다.** selector로 필요한 값만 구독하는 Zustand는 2026년 2분기부터 redux보다 많이 다운로드된다.
4. **변경 이력 추적, 미들웨어, 팀 전체의 코드 규칙 통일이 필요하면 Redux Toolkit을 선택한다.**

이 흐름이 계속될지는 다음 세 가지 지표로 확인할 수 있다.

- **TC39 Signals 제안의 단계:** 현재 Stage 1이다. Stage 2 이상으로 진행되어 언어 표준이 되면 Angular·Vue·Solid가 같은 signal 구현을 공유하게 되고, 컴포넌트 단위로 다시 렌더링하는 React의 방식도 다시 논의될 수 있다.
- **redux 대비 zustand·TanStack Query의 다운로드 배수:** 2026년 3분기에 zustand는 redux의 1.24배, TanStack Query는 1.54배 다운로드되었다. 2023년 4분기에는 각각 0.28배, 0.26배였다. 이 배수가 계속 커지면 Action·reducer 기반의 Redux 대신 store 함수 방식의 외부 store와 서버 상태 라이브러리를 함께 쓰는 구성이 더 늘어나고 있다는 근거가 된다.
- **상태 관리 라이브러리를 사용하지 않는 개발자 비율:** State of React 2025에서는 33.8%였다. 다음 설문에서 이 비율이 늘어나면 React 내장 상태와 서버 상태 라이브러리만으로 충분한 애플리케이션이 늘었다는 근거가 된다.

[^npm]: [npm registry downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md). `https://api.npmjs.org/downloads/range/<기간>/<패키지>`로 일별 다운로드를 받아 분기별로 합산했다(2026년 10월 29일 조회).

#React #상태관리 #아키텍처 #동향
