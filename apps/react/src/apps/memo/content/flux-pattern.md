---
title: Flux의 Action·Dispatcher·Store 단방향 흐름에서 찾은 좋은 상태 관리 코드의 세 가지 조건
date: 2026-10-25
category: 인사이트/프론트엔드
summary: 상태 관리 라이브러리는 Flux에서 Redux, Zustand로 바뀌었지만 좋은 상태 관리 코드의 조건은 같다. 변경 경로가 정해져 있고, 상태를 원본이 있는 곳에 두고, 필요한 값만 구독한다. 조건마다 지키는 코드와 어기는 코드를 비교하고, 2026년 수치로 현재의 선택을 분석했다.
---

상태 관리 라이브러리는 자주 바뀌었다. 2014년의 Flux, 2015년의 Redux, 2019년의 Zustand, 2022년 React 18의 `useSyncExternalStore`가 차례로 등장했고, 2026년에는 zustand의 npm 다운로드가 redux를 추월했다. 라이브러리 목록만 보면 매번 새 방식을 배워야 하는 것처럼 보인다.

그러나 각 라이브러리의 공식 문서를 비교하면 좋은 상태 관리 코드가 지켜야 하는 조건은 Flux 때부터 크게 바뀌지 않았다.

1. **상태를 바꾸는 경로가 정해져 있다.** 어떤 상태가 왜 바뀌었는지 코드에서 찾을 수 있다.
2. **상태를 원본이 있는 곳에 둔다.** 서버 데이터는 서버 데이터를 관리하는 도구에, 한 화면의 상태는 그 화면에 둔다.
3. **컴포넌트는 필요한 값만 구독한다.** 상태 하나가 바뀌었을 때 관련 없는 화면은 다시 렌더링되지 않는다.

라이브러리가 바뀐 이유는 대부분 이 조건을 더 적은 코드로 지키기 위해서였다. 이 글은 각 조건이 어떤 문제에서 나왔는지, 조건을 지키는 코드와 어기는 코드가 어떻게 다른지, 2026년의 수치가 어떤 선택을 보여 주는지 차례로 설명한다.

![Flux에서 useSyncExternalStore까지](./images/flux-pattern-evolution.svg 'Flux(2014년 5월 React 블로그), Redux 1.0.0(2015년 8월), Zustand 1.0.0(2019년 6월), React 18(2022년 3월)에서 각각 제거·변경·추가된 요소. 네 단계 모두 View가 상태를 직접 변경하지 않는다')

## 조건 1. 상태를 바꾸는 경로가 정해져 있다

### 양방향 바인딩의 연쇄 갱신

Flux는 2014년 F8 컨퍼런스 세션에서 처음 발표되었고, 같은 해 5월 6일 React 블로그에 [Flux: An Application Architecture for React](https://legacy.reactjs.org/blog/2014/05/06/flux.html)(Bill Fisher·Jing Chen)가 게시되었다. 이 발표는 React의 "데이터가 바뀌면 화면을 다시 렌더링한다"는 설계와 함께, 그 데이터를 한 방향으로만 갱신하는 Flux를 소개했다.

![F8 2014 세션 영상](./images/flux-pattern-f8-2014-video.jpg 'Meta Developers 채널의 "Hacker Way: Rethinking Web App Development at Facebook"(44분 35초). 화면의 슬라이드 "IDEAL: ALWAYS RE-RENDER"는 메시지 데이터 배열이 그대로 HTML 목록으로 다시 렌더링되는 React의 모델을 보여 준다. 2026년 10월 30일 캡처')

Flux 문서의 [In-Depth Overview](https://facebookarchive.github.io/flux/docs/in-depth-overview)는 MVC 대신 단방향 데이터 흐름을 채택한 이유를 다음과 같이 설명한다.

> We found that two-way data bindings led to cascading updates, where changing one object led to another object changing, which could also trigger more updates.

![2014년 React 블로그의 Flux 발표 글](./images/flux-pattern-react-blog-2014.jpg '2014년 5월 6일 Bill Fisher·Jing Chen이 게시한 "Flux: An Application Architecture for React". F8 세션 영상이 함께 실려 있다. 현재는 보관된 legacy.reactjs.org에서 볼 수 있다(2026년 10월 29일 캡처)')

양방향 바인딩(two-way data binding)은 모델이 바뀌면 뷰가 갱신되고, 뷰에서 입력이 들어오면 모델도 갱신되는 연결 방식이다. Overview가 예로 든 화면은 메시지 스레드 목록에서 읽지 않은 스레드를 강조하고, 다른 뷰에 읽지 않은 메시지 수를 표시한다. 다음은 이 화면의 모델과 뷰가 서로를 직접 갱신하는 코드다.

```js
// 조건을 어기는 코드: 모델과 뷰가 서로의 변경 이벤트를 구독해 직접 갱신한다
thread.on('change:read', () => unreadCounter.recalculate()); // 스레드 → 읽지 않은 수 모델
unreadCounter.on('change', () => tabBadge.render()); // 읽지 않은 수 → 탭 배지 뷰
tabBadge.on('click', () => threadList.markAllRead()); // 배지 클릭 → 다시 모든 스레드 모델
threadList.on('change', () => unreadCounter.recalculate()); // 스레드 목록 → 다시 읽지 않은 수
```

스레드 하나를 읽음으로 바꾸면 `unreadCounter`와 `tabBadge`가 차례로 갱신된다. 배지를 클릭하면 `threadList`가 바뀌고, 그 변경이 다시 `unreadCounter`를 갱신한다. 읽지 않은 수가 잘못 표시되는 버그가 생기면, 이 값을 바꾸는 코드가 네 곳 중 어디인지부터 찾아야 한다. 모델이 수십 개로 늘어나면 한 번의 클릭이 어떤 순서로 어느 모델을 바꾸는지 코드만 보고 파악할 수 없다.

![양방향 바인딩과 Flux의 단방향 흐름](./images/flux-pattern-mvc-vs-flux.svg '왼쪽: 모델과 뷰가 서로를 갱신해 변경이 연쇄된다. 오른쪽: 상태 변경은 Action에서 시작해 Dispatcher와 Store를 거쳐 View로만 전달된다')

### Flux의 해결: 모든 변경은 Action으로 Dispatcher를 거친다

Flux는 상태를 바꾸는 경로를 하나로 제한했다. In-Depth Overview는 구성 요소로 Dispatcher, Store, View를 들고, Action을 만드는 action creator를 네 번째 구성 요소로 설명한다.

![Flux 저장소 README의 구조도](./images/flux-pattern-official-diagram.jpg 'facebookarchive/flux README에 실린 공식 구조도. 사용자 입력과 Web API 응답이 모두 Action Creators를 거쳐 Dispatcher로 전달되고, Store의 변경 이벤트를 받은 React Views가 다시 렌더링한다. 2026년 10월 30일 캡처')

| 구성 요소  | 역할                                                                                                | 제약                                   |
| ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Action     | 발생한 일을 기술하는 일반 객체. 식별용 `type`과 새 데이터를 담는다                                  | 상태를 직접 변경하지 않는다            |
| Dispatcher | 모든 데이터 흐름이 거치는 중앙 허브. Store가 등록한 콜백 목록을 갖고, Action을 모든 콜백에 전달한다 | 상태를 보관하지 않는다                 |
| Store      | 애플리케이션 상태와 상태 변경 로직. Action을 받아 자신의 상태를 갱신하고 변경 이벤트를 발생시킨다   | 외부에서 상태를 설정하는 메서드가 없다 |
| View       | Store의 변경 이벤트를 받아 상태를 조회하고 다시 렌더링한다. 사용자 입력은 새 Action으로 변환한다    | Store를 직접 수정하지 않는다           |

할 일 목록에 항목 하나를 추가하는 코드는 다음과 같다.

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

View는 `todos` 배열에 직접 접근하지 않는다. 할 일 목록이 잘못 표시되면 `'todo/create'`를 처리하는 Store 콜백만 확인하면 되고, Dispatcher를 통과한 Action을 기록하면 어떤 상태가 어떤 순서로 바뀌었는지 재현할 수 있다. 상태를 바꾸는 경로가 정해져 있다는 조건이 주는 이점은 이 추적 가능성이다.

Flux에도 비용이 있었다. Store가 여러 개이면 한 Store가 다른 Store의 갱신 결과에 의존한다. [Dispatcher 문서](https://facebookarchive.github.io/flux/docs/dispatcher)의 예에서는 나라를 바꾸면 도시 Store가 기본 도시를 선택하고, 가격 Store가 그 도시의 항공권 가격을 계산한다. 가격 Store가 도시 Store보다 먼저 실행되면 이전 도시의 가격이 남는다. Flux는 `waitFor()`로 Store 콜백의 실행 순서를 개발자가 직접 지정하게 했고, In-Depth Overview는 이 메서드가 "크고 복잡한 애플리케이션에서 필수"(becomes vital in a larger, more complex application)라고 설명한다.

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

### Redux: 경로를 순수 함수로 고정하고 기록을 도구로 만들었다

![보관된 Flux 저장소](./images/flux-pattern-archived-repo.jpg 'facebookarchive/flux 저장소는 2023년 3월 23일 보관(read-only) 상태로 전환되었다. Star 17.4k, Fork 3.4k. 2026년 10월 30일 캡처')

Flux 라이브러리 저장소는 2023년 3월 보관(read-only) 상태로 전환되었고, 그 전부터 Flux 구조를 사용하는 프로젝트 대부분은 Redux를 채택했다. [Redux 문서의 Prior Art](https://redux.js.org/understanding/history-and-design/prior-art)에 따르면 Redux는 Flux의 조건 1을 그대로 계승하고, 구현을 두 가지 바꿨다.

- **Dispatcher 제거:** 이벤트 에미터 대신 순수 함수인 reducer를 사용한다. 순수 함수는 같은 입력에 항상 같은 결과를 반환하고 외부 상태를 바꾸지 않는 함수다. 여러 reducer를 하나로 합성할 수 있으므로 Store 사이의 실행 순서는 reducer 호출 순서로 정해지고, `waitFor()`가 필요 없다.
- **불변 상태:** reducer는 기존 객체를 수정하지 않고 새 객체를 반환한다.

```js
// 조건을 지키는 코드: reducer는 이전 상태와 Action을 받아 새 상태를 반환한다
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

`state.push(...)`로 기존 배열을 직접 수정하고 같은 배열을 반환하면, Redux와 react-redux는 이전 상태와 다음 상태가 같은 객체라고 판단해 화면을 갱신하지 않는다. 불변 상태는 문법 규칙이 아니라 "무엇이 바뀌었는가"를 참조 비교 한 번으로 판단하기 위한 조건이다. 이 덕분에 Action마다 이전 상태와 다음 상태를 보존할 수 있고, Redux DevTools는 이 기록으로 time travel 디버깅을 제공한다.

![Redux DevTools 확장](./images/flux-pattern-redux-devtools.jpg 'Redux DevTools 확장의 공식 데모 화면(TodoMVC 예제). 가운데 Inspector는 @@INIT, ADD_TODO, COMPLETE_TODO 순으로 dispatch된 Action 목록과 선택한 Action의 내용을 보여 주고, 오른쪽 Diff 탭은 그 Action으로 completed가 false에서 true로 바뀐 것을 보여 준다. 아래 슬라이더를 움직이면 기록된 Action의 순서대로 앞뒤 상태로 이동한다. reduxjs/redux-devtools 저장소의 extension README에서 2026년 10월 30일 캡처')

위 화면에서 `COMPLETE_TODO`를 선택하면 Diff 탭에 그 Action이 바꾼 값만 표시되고, 슬라이더를 왼쪽으로 옮기면 할 일을 완료하기 전 화면이 다시 렌더링된다. 조건 1을 엄격하게 지킨 결과, 상태 변경의 원인과 순서를 도구로 확인할 수 있게 되었다.

![Redux 문서의 데이터 흐름 그림](./images/flux-pattern-redux-dataflow.jpg 'Redux Fundamentals Part 2의 데이터 흐름 그림. Deposit 버튼의 이벤트 핸들러가 Action을 dispatch하고, store가 reducer를 실행해 만든 새 State가 UI의 금액에 반영된다. 원본 GIF의 한 장면을 캡처했다(2026년 10월 30일)')

### Zustand: 같은 조건을 더 적은 코드로 지킨다

Redux의 엄격함에는 코드 비용이 따른다. 할 일 하나를 추가하려면 Action 타입, reducer의 `case`, `dispatch` 호출을 각각 작성해야 한다. [Zustand](https://github.com/pmndrs/zustand)는 README에서 자신을 "단순화한 Flux 원칙(simplified flux principles)을 사용하는 작은 상태 관리 라이브러리"로 소개한다.

![Zustand README 첫머리](./images/flux-pattern-zustand-readme.jpg 'pmndrs/zustand README 첫머리. 배지에 번들 크기 9.35kB, npm 버전 5.0.16, 누적 다운로드 2G가 표시되어 있다. 2026년 10월 30일 캡처')

Zustand 문서의 [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)는 전역 상태를 store 하나에 두고, `set`으로만 갱신하고, 상태를 바꾸는 함수(store action)를 store 안에 함께 정의하라고 권장한다. Action 객체와 Dispatcher는 없지만, 상태를 바꾸는 경로가 store action으로 정해져 있다는 점은 같다.

```js
const useTodoStore = create((set) => ({
	todos: [],
	// store action: 상태를 바꾸는 함수를 store 안에 함께 정의한다
	addTodo: (text) => set((state) => ({ todos: [...state.todos, { text, done: false }] })),
}));

// 컴포넌트는 store action을 호출한다
const addTodo = useTodoStore((state) => state.addTodo);
addTodo('장보기');
```

같은 Zustand를 쓰더라도 조건 1을 어길 수 있다. store action 없이 컴포넌트마다 `useTodoStore.setState({ todos: [...] })`를 직접 호출하면, 할 일 목록을 바꾸는 코드가 컴포넌트 곳곳으로 흩어진다. 라이브러리는 조건을 지키기 쉽게 만들 뿐이고, 조건을 지키는 것은 코드를 작성하는 방식이다.

2026년 npm 다운로드는 업계가 이 비용과 이점 사이에서 어떤 선택을 했는지 보여 준다. npm registry API로 최근 3년의 분기별 다운로드를 집계했다[^npm].

![상태 관리 패키지의 분기별 npm 다운로드](./images/flux-pattern-npm-trend.svg '2023년 4분기부터 2026년 3분기까지의 분기별 다운로드. TanStack Query와 zustand가 2026년에 redux를 추월했다. 2026년에는 모든 패키지의 다운로드가 함께 증가해, 절대값보다 순위와 비율을 비교한다')

| 비율                   | 2023년 4분기 | 2026년 3분기 |
| ---------------------- | -----------: | -----------: |
| zustand ÷ redux        |         0.28 |         1.24 |
| TanStack Query ÷ redux |         0.26 |         1.54 |
| Redux Toolkit ÷ redux  |         0.33 |         0.66 |

2026년에는 다섯 패키지의 다운로드가 모두 3~5배 증가했다. 개별 라이브러리의 사용 증가보다 CI·자동화 도구로 인한 npm 전체 설치량 증가의 영향이 크므로, 절대값 대신 redux 대비 배수를 비교했다. zustand는 2023년 4분기에 redux의 0.28배였고, 2026년 2분기에 처음 redux보다 많이 다운로드되었다(4.70억 회 대 4.24억 회). 같은 기간 Redux 안에서도 Redux Toolkit의 비중이 0.33배에서 0.66배로 늘었다. Redux Toolkit은 Action 타입과 reducer를 한 번에 정의하는 `createSlice`로 Redux의 작성량을 줄인 공식 도구다. 두 수치 모두 조건 1은 유지하면서 그에 드는 코드를 줄이는 쪽으로 이동했다는 근거다. 다운로드 수에는 의존성 설치와 CI 재설치가 포함되므로, 사용자 수가 아니라 증감 방향을 보는 지표로만 사용했다.

## 조건 2. 상태를 원본이 있는 곳에 둔다

### 서버 데이터를 전역 store에 복사하는 문제

Flux의 Store는 서버에서 받은 데이터와 화면 상태를 함께 보관했다. 위 공식 구조도에서도 Web API 응답이 Action Creators를 거쳐 Store에 들어간다. 이 방식은 서버 데이터의 복사본을 클라이언트에 만들고, 그 복사본을 원본과 맞추는 코드를 개발자에게 맡긴다.

```js
// 조건을 어기는 코드: 서버의 글 목록을 전역 store에 복사하고, 동기화를 직접 관리한다
const usePostStore = create((set) => ({
	posts: [],
	loading: false,
	error: null,
	fetchedAt: 0,
	fetchPosts: async () => {
		set({ loading: true });
		try {
			set({ posts: await api.getPosts(), fetchedAt: Date.now(), loading: false });
		} catch (error) {
			set({ error, loading: false });
		}
	},
}));
// 다른 화면에서 글을 수정하면? 다른 사용자가 글을 지우면? 5분이 지나면 다시 받아야 하나?
```

글 목록의 원본은 서버에 있다. 다른 사용자가 언제든 바꿀 수 있고, 시간이 지나면 클라이언트의 복사본은 최신이 아니게 된다. 이 코드는 로딩·오류 상태를 직접 관리하고, 캐시를 언제 다시 받아야 하는지도 직접 결정해야 한다. 같은 목록을 쓰는 화면이 두 개이면 한 화면에서 수정한 결과를 다른 화면에 반영하는 코드도 추가된다.

```js
// 조건을 지키는 코드: 서버 상태 라이브러리(TanStack Query)가 캐싱과 재요청을 담당한다
const { data: posts, isPending, error } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

// 글을 수정한 뒤 'posts' 캐시를 무효화하면 목록을 사용하는 모든 화면이 새 데이터를 받아 온다
queryClient.invalidateQueries({ queryKey: ['posts'] });
```

[TanStack Query 개요](https://tanstack.com/query/latest/docs/framework/react/overview)는 기존 상태 관리 라이브러리가 클라이언트 상태에는 적합하지만 비동기 데이터와 서버 상태에는 적합하지 않다고 설명한다. 서버 상태 라이브러리는 서버 데이터를 "복사해 보관하는 상태"가 아니라 "원본의 캐시"로 다룬다. 캐시의 유효 기간, 화면 포커스 시 재요청, 무효화(invalidation, 캐시를 오래된 것으로 표시해 다시 요청하게 하는 처리)를 라이브러리가 맡는다.

### 서버 데이터가 빠지면 전역 store는 작아진다

서버 데이터를 분리하면 전역 store에는 다크 모드 설정, 사이드바 접힘 여부, 장바구니처럼 클라이언트에만 있는 상태가 남는다. 이 상태의 상당 부분은 한 화면에서만 쓰이므로 그 화면의 `useState`로 충분하다. 2026년 3분기 TanStack Query의 다운로드는 redux의 1.54배로, 집계한 다섯 패키지 가운데 가장 많다.

[State of React 2025](https://2025.stateofreact.com/en-US/libraries/state-management/) 설문(2025년 11월~2026년 1월, 응답 3,760명)도 같은 방향을 보여 준다.

![State of React 2025의 상태 관리 사용률 추이](./images/flux-pattern-state-of-react-2025.jpg '응답자 중 사용 경험이 있는 비율(Usage). 2023→2025년 Redux는 약 80%에서 75%로 감소했고, Redux Toolkit은 55% 안팎을 유지했으며, Zustand는 약 28%에서 50%로 증가했다. 2026년 10월 29일 캡처')

- 응답자 1,271명(33.8%)이 상태 관리 라이브러리를 사용하지 않는다고 답했다. 설문 결과 해설은 `useState`·`useContext` 같은 React 내장 API로 충분한 경우가 많기 때문으로 분석했다.
- TanStack Query는 상태 관리 라이브러리 목록에 없었지만 기타 응답에서 가장 많이 언급되었고(42회), 평가도 가장 긍정적이었다.
- Zustand는 사용률이 빠르게 증가했고 만족도가 가장 높았다.
- 이번 설문은 예년보다 늦게 진행되어 응답 수가 적었다. 비율은 이 표본 안에서만 유효하다.

조건 2를 지키면 "어떤 상태 관리 라이브러리를 쓸까"라는 질문의 상당 부분이 사라진다. 상태마다 원본이 어디인지 먼저 정하면 둘 곳이 정해진다. 블로그 앱을 예로 들면 다음과 같다.

| 상태의 원본             | 두는 곳                 | 예                                      |
| ----------------------- | ----------------------- | --------------------------------------- |
| 서버                    | 서버 상태 라이브러리    | 글 목록, 댓글, 좋아요 수                |
| 한 컴포넌트             | `useState`·`useReducer` | 댓글 입력 칸의 내용, 드롭다운 열림 여부 |
| 한 화면의 컴포넌트 트리 | `useReducer` + Context  | 단계가 여러 개인 글 작성 마법사         |
| 여러 화면이 공유        | 외부 store              | 다크 모드 설정, 장바구니                |
| React 외부 코드         | `useSyncExternalStore`  | 온라인 상태, 창 크기                    |

React 문서는 가능하면 React 내장 상태를 사용하라고 권장하고, 한 화면의 깊은 하위 컴포넌트까지 상태와 갱신 함수를 전달해야 할 때는 reducer와 Context를 결합하는 방법을 안내한다([Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)).

외부 store 안에서는 Redux FAQ의 [When should I use Redux?](https://redux.js.org/faq/general#when-should-i-use-redux)가 기준이 된다. FAQ는 "Not all apps need Redux"로 시작하고, 큰 상태를 여러 곳에서 사용하고, 자주 바뀌고, 갱신 로직이 복잡하고, 여러 개발자가 함께 작업하고, 상태 변화 이력을 확인해야 할 때 Redux가 가장 효과적이라고 설명한다. 이 다섯 조건 중 상태 변화 이력이 필요 없다면 store action으로 갱신하는 Zustand가 더 적은 코드로 조건 1을 지킨다.

## 조건 3. 컴포넌트는 필요한 값만 구독한다

### 구독 단위가 넓으면 관련 없는 화면도 다시 렌더링된다

구독 단위는 상태가 바뀌었을 때 어느 범위의 컴포넌트가 다시 렌더링되는지를 결정한다. Flux의 Store는 변경 이벤트 하나만 발생시켰고, View는 그 이벤트를 받으면 Store 전체를 다시 조회했다. 장바구니 수량이 바뀌면 장바구니와 무관한 헤더의 사용자 이름 View도 Store를 다시 조회한다.

같은 문제는 지금의 코드에서도 생긴다.

```js
// 조건을 어기는 코드: store 전체를 구독하면 어떤 값이 바뀌어도 헤더가 다시 렌더링된다
const { user } = useShopStore();

// 조건을 지키는 코드: selector로 사용하는 값만 구독한다. 장바구니가 바뀌어도 헤더는 그대로다
const userName = useShopStore((state) => state.user.name);
```

React Context도 같은 문제를 갖는다. Context 값이 바뀌면 그 Context를 사용하는 모든 컴포넌트가 다시 렌더링되므로, 자주 바뀌는 값과 거의 바뀌지 않는 값을 하나의 Context에 넣으면 거의 바뀌지 않는 값만 쓰는 컴포넌트도 매번 다시 렌더링된다.

### selector, atom, signal: 구독 단위를 줄여 온 방식

Flux 이후의 라이브러리는 구독 단위를 점점 세분화했다.

| 방식        | 예                | 다시 계산되는 범위                                             |
| ----------- | ----------------- | -------------------------------------------------------------- |
| 변경 이벤트 | Flux Store        | Store를 구독하는 모든 View                                     |
| selector    | Redux, Zustand    | store에서 선택한 값이 바뀐 컴포넌트                            |
| atom        | Jotai             | 상태를 작은 단위(atom)로 나누고, 바뀐 atom을 사용하는 컴포넌트 |
| signal      | Angular·Vue·Solid | 바뀐 값에 의존하는 계산과 DOM                                  |

selector는 store 전체에서 컴포넌트가 사용하는 값만 골라내는 함수이고, atom은 전역 상태를 독립적으로 구독할 수 있도록 나눈 작은 상태 단위다. Jotai는 홈페이지에서 atom 방식의 목적을 React Context의 불필요한 리렌더링 문제를 해결하는 것으로 설명한다.

![Jotai 홈페이지](./images/flux-pattern-jotai.jpg 'jotai.org 첫 화면. "atom을 조합해 상태를 만들고, atom 의존성에 따라 렌더링이 자동으로 최적화된다", "React context의 불필요한 리렌더링 문제를 해결한다"고 소개한다. 2026년 10월 30일 캡처')

장바구니 수량 하나가 바뀌는 경우로 세 방식을 비교하면 다음과 같다.

```js
// selector (Zustand): 장바구니 개수를 선택한 컴포넌트만 다시 렌더링된다
const count = useShopStore((state) => state.cart.length);

// atom (Jotai): 장바구니를 별도 atom으로 나누면 cartAtom을 사용하는 컴포넌트만 다시 렌더링된다
const cartAtom = atom([]);
const cart = useAtomValue(cartAtom);

// signal (Preact Signals): 컴포넌트를 다시 렌더링하지 않고 cartCount에 의존하는 텍스트 노드만 갱신한다
const cartCount = signal(0);
effect(() => (badge.textContent = String(cartCount.value)));
```

signal은 값이 바뀌면 그 값에 의존하는 계산과 화면만 다시 실행하는 반응형 상태 단위다. TC39(JavaScript 표준 위원회)에는 signal의 핵심 기능인 쓰기 가능한 상태, 의존성을 추적하는 파생 값(computed), 변경 감시(watcher)를 언어 표준으로 정의하려는 [Signals 제안](https://github.com/tc39/proposal-signals)이 제출되어 있다. 2026년 10월 기준으로 Stage 1이고, 프레임워크들이 공통으로 사용할 기반을 목표로 한다. React는 signal을 채택하지 않고 컴포넌트 단위로 다시 렌더링하는 방식을 유지하고 있다.

![TC39 Signals 제안 저장소](./images/flux-pattern-tc39-signals.jpg 'tc39/proposal-signals README 첫머리. Stage 1이고, Angular·Vue·Solid·Svelte·MobX 등 여러 프레임워크 작성자가 설계에 참여하고 있다. 2026년 10월 29일 캡처')

### useSyncExternalStore: 구독을 React의 표준 API로

React는 18 버전부터 외부 store를 구독하는 표준 hook인 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)를 제공한다. Zustand와 react-redux도 내부에서 이 hook을 사용한다.

![react.dev의 useSyncExternalStore 문서](./images/flux-pattern-react-docs.jpg 'react.dev API Reference의 useSyncExternalStore 문서. 외부 store를 구독하는 hook으로, subscribe와 getSnapshot, 서버 렌더링용 getServerSnapshot을 인자로 받는다. 2026년 10월 30일 캡처')

- `subscribe(callback)`: store가 바뀌면 `callback`을 호출하고, 구독을 해제하는 함수를 반환한다.
- `getSnapshot()`: store의 현재 값(스냅숏)을 반환한다. React는 반환값을 `Object.is`로 비교해 값이 다르면 다시 렌더링한다.
- Transition(우선순위가 낮아 중단될 수 있는 업데이트) 도중 store가 바뀌면, React는 DOM에 반영하기 직전 `getSnapshot`을 다시 호출한다. 값이 다르면 업데이트를 처음부터 다시 실행해, 한 화면의 컴포넌트들이 서로 다른 버전의 store 값을 표시하는 tearing 현상을 막는다.

![useSyncExternalStore의 구독 순서](./images/flux-pattern-use-sync-external-store.svg '렌더링 중 getSnapshot으로 v1을 조회하고 subscribe로 콜백을 등록한다. store가 setState로 바뀌면 콜백이 호출되고, React가 getSnapshot을 다시 호출해 v2와 Object.is로 비교한 뒤 다르면 다시 렌더링한다')

`getSnapshot`은 조건 3을 코드로 표현하는 지점이다. React 문서의 예는 브라우저의 온라인 상태를 구독하며, 필요한 값 하나만 반환한다.

```js
function subscribe(callback) {
	window.addEventListener('online', callback);
	window.addEventListener('offline', callback);
	return () => {
		window.removeEventListener('online', callback);
		window.removeEventListener('offline', callback);
	};
}

// 조건을 지키는 코드: 필요한 값(boolean) 하나를 그대로 반환한다
const isOnline = useSyncExternalStore(subscribe, () => navigator.onLine);

// 조건을 어기는 코드: 호출할 때마다 새 객체를 만들어, 내용이 같아도 Object.is 비교가 항상 '다름'이 된다
const snapshot = useSyncExternalStore(store.subscribe, () => ({ todos: store.todos }));
```

두 번째 코드는 React가 렌더링을 반복하다 오류를 발생시킨다. `() => store.todos`처럼 store가 보관한 값을 그대로 반환해야 한다. "필요한 값만, 바뀌었을 때만 새 값으로" 반환하는 것이 구독 코드의 기본 규칙이다.

## 마치며: 상태 관리 코드를 검토할 때 확인할 질문

Flux가 2014년에 제시한 핵심은 라이브러리보다 규칙이었다. 12년 동안 Dispatcher는 reducer로, reducer는 store action으로 바뀌었고, 서버 데이터는 전역 store에서 분리되었으며, 구독 단위는 Store 전체에서 값 하나로 줄었다. 바뀐 것은 규칙을 지키는 데 필요한 코드의 양과 정밀도였다. 새 라이브러리를 평가할 때도 "이 라이브러리가 세 가지 조건을 더 적은 코드로 지키게 해 주는가"를 기준으로 판단할 수 있다.

같은 기준은 라이브러리와 관계없이 코드 리뷰에도 적용된다. 상태 관리 코드를 검토할 때는 다음 네 가지를 확인한다.

1. **이 상태를 바꾸는 코드를 모두 찾을 수 있는가?** 상태를 바꾸는 함수(Action, store action, setter)가 한곳에 모여 있어야 한다. 컴포넌트마다 `setState`나 직접 대입으로 같은 상태를 바꾸고 있다면 조건 1을 어긴 것이다.
2. **이 상태의 원본은 어디인가?** 서버 응답을 전역 store에 복사하고 있다면, 그 복사본을 언제 다시 받을지 결정하는 코드가 있는지 확인한다. 없다면 서버 상태 라이브러리로 옮길 대상이다. URL에서 계산할 수 있는 값(검색어, 페이지 번호)을 별도 상태로 보관하는 것도 같은 문제다.
3. **이 컴포넌트는 실제로 사용하는 값만 구독하는가?** store 전체를 구독하거나, 자주 바뀌는 값과 거의 바뀌지 않는 값을 한 Context에 넣었다면 조건 3을 어긴 것이다.
4. **규칙을 지키는 코드가 얻는 이점보다 많은가?** 상태 변화 이력이 필요 없는 상태에 Action 타입과 reducer를 정의하고 있다면, 더 가벼운 방식으로 같은 조건을 지킬 수 있다.

2026년의 수치는 이 기준의 방향과 일치한다. 서버 상태 라이브러리(TanStack Query, redux 대비 1.54배)와 store action 방식(zustand, 1.24배)의 다운로드가 늘었고, 설문 응답자의 33.8%는 상태 관리 라이브러리 없이 개발한다. 앞으로 TC39 Signals 제안이 Stage 2 이상으로 진행되면 조건 3을 언어 수준에서 지원하게 되고, 컴포넌트 단위로 다시 렌더링하는 React의 방식도 다시 논의될 수 있다. 어느 경우에도 좋은 상태 관리 코드를 판단하는 기준은 세 가지 조건으로 유지될 것이다.

[^npm]: [npm registry downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md). `https://api.npmjs.org/downloads/range/<기간>/<패키지>`로 일별 다운로드를 받아 분기별로 합산했다(2026년 10월 29일 조회).

#React #상태관리 #아키텍처 #트렌드 #인사이트
