---
title: Flux 패턴의 Action·Dispatcher·Store·View 단방향 흐름과 2026년 상태 관리 동향
date: 2026-10-25
category: 인사이트/프론트엔드
summary: Flux는 상태 변경을 Action → Dispatcher → Store → View 한 방향으로만 흐르게 하는 구조다. 네 구성 요소와 Redux·Zustand·useSyncExternalStore가 바꾼 점을 공식 자료로 정리하고, npm 다운로드와 State of React 2025로 본 2026년 상태 관리 동향과 그 흐름에 대한 고찰을 더했다.
---

Flux는 Facebook이 2014년에 공개한 클라이언트 애플리케이션 구조다. 상태를 바꾸는 요청이 **Action → Dispatcher → Store → View** 한 방향으로만 흐르게 한다. 지금 Flux 라이브러리 자체를 쓰는 프로젝트는 드물지만, Redux·Zustand 같은 상태 관리 라이브러리와 React의 `useReducer`·`useSyncExternalStore`가 이 구조에서 나왔다.

이 글은 Flux가 해결하려던 문제와 구성 요소, Flux 이후 Redux와 외부 store가 바꾼 점을 공식 자료를 기준으로 정리한다. 이어서 2026년의 상태 관리 동향을 다운로드 수치와 설문으로 확인하고, Flux에서 무엇이 빠지고 무엇이 남았는지 고찰한다. 이 구조를 MacFolio의 store에 적용한 내용은 개발기 [MacFolio의 store 설계](/memo/macfolio-store-design)에 따로 정리했다.

## Flux가 나온 이유: 양방향 바인딩의 연쇄 갱신

React 블로그의 글 [Flux: An Application Architecture for React](https://legacy.reactjs.org/blog/2014/05/06/flux.html)(2014년 5월 6일, Bill Fisher·Jing Chen)는 F8의 분과 세션에서 Flux를 발표한 뒤 쓴 글이다. Flux 문서의 [In-Depth Overview](https://facebookarchive.github.io/flux/docs/in-depth-overview)는 Flux를 "Facebook이 클라이언트 웹 애플리케이션을 만들 때 쓰는 구조"로 소개하고, MVC 대신 단방향 데이터 흐름을 고른 이유를 다음과 같이 적는다.

![2014년 React 블로그의 Flux 발표 글](./images/flux-pattern-react-blog-2014.jpg '2014년 5월 6일 Bill Fisher·Jing Chen이 쓴 "Flux: An Application Architecture for React". F8 세션 영상 "Hacker Way: Rethinking Web App Development at Facebook"을 함께 실었다. 지금은 보관된 legacy.reactjs.org에 남아 있다(2026년 10월 29일 캡처)')

> We found that two-way data bindings led to cascading updates, where changing one object led to another object changing, which could also trigger more updates.

Overview가 든 출발점은 파생 데이터였다. 메시지 스레드 목록에서 읽지 않은 스레드를 강조하고, 다른 뷰에는 읽지 않은 수를 보여 주려 했다. MVC에서는 스레드 하나를 읽음으로 바꾸면 스레드 모델을 갱신한 뒤 읽지 않은 수 모델도 따로 갱신해야 했고, 이런 의존과 연쇄 갱신이 큰 MVC 애플리케이션에서 얽힌 데이터 흐름을 만든다고 적는다.

모델과 뷰가 양방향으로 연결되어 있으면, 모델 하나를 바꾼 결과가 다른 모델과 뷰로 연쇄해서 퍼진다. 애플리케이션이 커질수록 사용자 동작 하나가 어떤 상태를 바꾸는지 예측하기 어려워진다. Flux는 상태를 바꾸는 입구를 하나로 줄여 이 문제를 다룬다.

![양방향 바인딩과 Flux의 단방향 흐름](./images/flux-pattern-mvc-vs-flux.svg '왼쪽: 모델과 뷰가 서로를 갱신해 변경이 연쇄된다. 오른쪽: 상태 변경은 Action으로 시작해 Dispatcher와 Store를 거쳐 View로만 흐른다')

## 네 구성 요소

In-Depth Overview는 Flux의 주요 부분을 Dispatcher, Store, View 셋으로 꼽고, Action을 만드는 action creator를 "네 번째 부분"으로 설명한다.

![Flux 저장소 README의 구조도](./images/flux-pattern-official-diagram.jpg 'facebookarchive/flux README에 실린 원래 구조도. 사용자 입력과 Web API 응답이 모두 Action Creators를 거쳐 Dispatcher로 가고, Store의 변경 이벤트를 받은 React Views가 다시 그린다. 2026년 10월 30일 캡처')

| 구성 요소  | 역할                                                                                      | 하지 않는 일                         |
| ---------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| Action     | 무엇이 일어났는지 적은 평범한 객체. 식별용 `type`과 새 데이터를 담는다                    | 상태를 직접 바꾸지 않는다            |
| Dispatcher | 모든 데이터 흐름의 중앙 허브. Store가 등록한 콜백 목록이고, Action을 모든 콜백에 전달한다 | 상태를 보관하지 않는다               |
| Store      | 애플리케이션 상태와 그 상태를 바꾸는 로직. Action을 받아 스스로 상태를 갱신하고 알린다    | 바깥에서 상태를 설정하는 메서드 없음 |
| View       | Store의 변경 알림을 받아 상태를 읽고 다시 그린다. 사용자 입력은 새 Action으로 바꾼다      | Store를 직접 수정하지 않는다         |

흐름은 항상 같다.

1. 사용자가 버튼을 누르면 View가 action creator를 호출하고, action creator가 `{ type: 'todo/create', text }` 같은 Action을 Dispatcher에 보낸다.
2. Dispatcher는 그 Action을 등록된 **모든** Store 콜백에 전달한다.
3. 각 Store는 Action의 `type`을 보고 관련 있으면 자기 상태를 갱신한 뒤 변경 이벤트를 낸다.
4. View는 이벤트를 받아 Store에서 상태를 다시 읽고 렌더링한다.

![Flux 한 사이클의 시퀀스](./images/flux-pattern-cycle.svg 'View → action creator → Dispatcher → 두 Store의 콜백 → change 이벤트 → View 순서. 상태를 바꾸는 요청과 바뀌었다는 알림이 서로 다른 선으로 오가고, View에서 Store로 직접 가는 선은 없다')

상태를 바꾸는 길이 Dispatcher를 거치는 Action 하나뿐이라, 어떤 상태가 왜 바뀌었는지 추적하려면 Dispatcher를 지나간 Action만 기록하면 된다.

### waitFor: Store 사이의 갱신 순서

Store가 여러 개면 한 Store가 다른 Store의 갱신 결과에 의존할 수 있다. Flux의 [Dispatcher 문서](https://facebookarchive.github.io/flux/docs/dispatcher)가 드는 예는 나라·도시·항공권 가격이다. 나라를 바꾸면 도시 Store는 그 나라의 기본 도시를 고르고, 가격 Store는 그 도시의 항공권 가격을 계산한다. 가격 Store는 도시 Store가, 도시 Store는 나라 Store가 먼저 갱신돼야 맞는 값을 얻는다. Dispatcher의 `waitFor()`는 콜백 안에서 "이 Store들의 콜백이 끝난 뒤에 계속하라"고 선언하는 메서드다.

![waitFor가 없을 때와 있을 때의 실행 순서](./images/flux-pattern-waitfor.svg '위: 가격 Store가 먼저 실행되면 도시는 파리로 바뀌었는데 가격은 서울 기준으로 남는다. 아래: waitFor로 나라 → 도시 → 가격 순서를 정하면 파리 가격이 계산된다')

<details>
<summary>waitFor 사용 형태 (Dispatcher 문서의 예에서 country-update 처리만 남긴 것)</summary>

```js
// 나라 Store. register는 등록 토큰을 돌려준다
CountryStore.dispatchToken = flightDispatcher.register((payload) => {
	if (payload.actionType === 'country-update') CountryStore.country = payload.selectedCountry;
});

// 도시 Store: 나라 Store가 끝난 뒤 그 나라의 기본 도시를 고른다
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

In-Depth Overview는 `waitFor()`가 "크고 복잡한 애플리케이션에서 필수"(becomes vital in a larger, more complex application)라고 적는다. 반대로 말하면 Store가 많아질수록 Store 사이의 순서를 사람이 관리해야 한다는 뜻이다. 이 지점을 Redux가 다르게 풀었다.

## Flux 이후: Redux

![보관된 Flux 저장소](./images/flux-pattern-archived-repo.jpg 'facebookarchive/flux 저장소는 2023년 3월 23일 보관(read-only)으로 바뀌었다. 별 17.4k, 포크 3.4k. 2026년 10월 30일 캡처')

Flux 라이브러리 저장소는 2023년 3월에 보관 상태로 바뀌어 더 이상 갱신되지 않는다. 그 사이 구조의 중심은 Redux로 옮겨 갔다.

[Redux 문서의 Prior Art](https://redux.js.org/understanding/history-and-design/prior-art)는 Redux가 Flux에서 가져온 것과 바꾼 것을 직접 비교한다.

- **가져온 것:** 모델 갱신 로직을 한 계층(Flux의 Store, Redux의 reducer)에 모으고, 모든 변경을 Action이라는 평범한 객체로 기술한다.
- **바꾼 것 ①:** Redux에는 **Dispatcher가 없다.** 이벤트 에미터 대신 순수 함수(reducer)를 쓰고, 순수 함수는 합성할 수 있어 관리하는 별도 객체가 필요 없다는 설명이다. 문서는 Flux를 `(state, action) => state`로 볼 수 있으며, 그 관점에서 Redux는 Flux 구조를 순수 함수로 단순화한 것이라고 적는다.
- **바꾼 것 ②:** Redux는 상태를 **변경하지 않는다고 가정한다.** reducer는 기존 객체를 수정하지 않고 새 객체를 돌려준다. 변경하면 time travel, 기록·재생, 핫 리로드 같은 개발 도구가 깨진다.

[세 가지 원칙](https://redux.js.org/understanding/thinking-in-redux/three-principles)도 같은 내용이다.

| 원칙                                 | 내용                                                           | Flux와 비교                                          |
| ------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------- |
| Single source of truth               | 전역 상태를 store **하나**의 객체 트리에 보관한다              | Flux는 도메인마다 Store가 여럿이다                   |
| State is read-only                   | 상태를 바꾸는 유일한 방법은 무슨 일이 있었는지 적은 Action     | 같다                                                 |
| Changes are made with pure functions | Action으로 상태 트리가 어떻게 바뀌는지는 순수 reducer로 적는다 | Flux Store는 내부 상태를 직접 갱신하고 이벤트를 낸다 |

store가 하나이고 reducer를 합성해 쓰므로, Flux의 `waitFor()`가 다루던 Store 사이의 순서 문제는 reducer 호출 순서로 바뀐다. 상태를 객체 하나로 두면 Action마다 이전·다음 상태를 기록할 수 있어 Redux DevTools의 time travel이 가능해진다.

![Redux 문서의 데이터 흐름 그림](./images/flux-pattern-redux-dataflow.jpg 'Redux Fundamentals Part 2의 데이터 흐름 그림. Deposit 버튼의 이벤트 핸들러가 Action을 dispatch하고, store가 reducer를 실행해 만든 새 State가 UI의 금액으로 반영된다. 원본은 움직이는 GIF이고 그 한 장면을 캡처했다(2026년 10월 30일)')

![Redux의 흐름과 상태 스냅숏](./images/flux-pattern-redux-flow.svg '위: UI가 dispatch한 Action으로 store가 reducer를 호출해 새 state를 받고 구독자에게 알린다. 아래: todo/add와 filter/set을 거치며 state₀·state₁·state₂가 각각 다른 객체로 남는다')

## 외부 store와 useSyncExternalStore

React 바깥에 상태를 두고 컴포넌트가 구독하는 방식도 Flux의 단방향 흐름을 따른다. [Zustand](https://github.com/pmndrs/zustand)는 README에서 스스로를 "simplified flux principles를 쓰는 작은 상태 관리 도구"라고 소개한다. React 없이 쓰는 vanilla `createStore`는 `getState`·`setState`·`subscribe`(와 `getInitialState`)를 돌려준다.

![Zustand README 첫머리](./images/flux-pattern-zustand-readme.jpg 'pmndrs/zustand README 첫머리. 배지에 번들 크기 9.35kB, npm 버전 5.0.16, 누적 다운로드 2G가 보인다. 2026년 10월 30일 캡처')

Zustand 문서의 [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)는 Flux·Redux에서 가져온 권장 방식을 세 가지로 적는다.

- **Single store:** 전역 상태는 Zustand store 하나에 둔다. 크면 slice로 나눈다.
- **`set`/`setState`로만 갱신:** 갱신을 병합하고 구독자에게 알리는 일을 `set`이 맡는다.
- **Colocate store actions:** 다른 Flux 라이브러리의 dispatch되는 Action과 reducer 없이, 상태를 바꾸는 함수(store action)를 store 안에 함께 둔다. reducer가 필요하면 store에 `dispatch` 함수를 직접 정의할 수 있다.

즉 Action 객체와 Dispatcher를 빼고, store 함수가 새 상태를 만들어 구독자에게 알리는 형태다.

React는 18부터 이런 store를 구독하는 표준 hook으로 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)를 제공한다.

![react.dev의 useSyncExternalStore 문서](./images/flux-pattern-react-docs.jpg 'react.dev API Reference의 useSyncExternalStore. 외부 store를 구독하는 hook으로 subscribe, getSnapshot과 서버 렌더링용 getServerSnapshot을 받는다. 2026년 10월 30일 캡처')

- `subscribe(callback)`: store가 바뀌면 `callback`을 호출하고, 구독 해제 함수를 돌려준다.
- `getSnapshot()`: store가 바뀌지 않았으면 같은 값을 돌려줘야 한다. React는 반환값을 `Object.is`로 비교해 다르면 다시 렌더링한다. 매번 새 객체를 돌려주면 비교가 항상 '다름'이 되어 무한 루프 오류가 난다.
- Transition(non-blocking 업데이트) 도중 store가 바뀌면, React는 DOM에 반영하기 직전 `getSnapshot`을 한 번 더 부르고, 값이 다르면 그 업데이트를 blocking으로 처음부터 다시 한다. 화면의 모든 컴포넌트가 같은 버전의 store를 보이게 하기 위해서다.

![useSyncExternalStore의 구독 순서](./images/flux-pattern-use-sync-external-store.svg '렌더링 중 getSnapshot으로 v1을 읽고 subscribe로 콜백을 등록한다. store가 setState로 바뀌면 콜백이 불리고, React가 getSnapshot을 다시 불러 v2와 Object.is로 비교해 다르면 다시 렌더링한다')

React 문서는 가능하면 `useState`·`useReducer` 같은 React 내장 상태를 쓰라고 권하고, `useSyncExternalStore`는 주로 React가 아닌 코드와 연결할 때 쓴다고 설명한다. `useReducer`는 reducer와 Action을 컴포넌트 안에서 쓰는 형태라, Flux·Redux의 흐름을 React 상태로 옮긴 것에 가깝다.

## 2026년의 상태 관리: 수치로 본 동향

### npm 다운로드: zustand가 redux를 앞질렀다

![상태 관리 패키지의 분기별 npm 다운로드](./images/flux-pattern-npm-trend.svg '2023년 4분기부터 2026년 3분기까지. TanStack Query와 zustand가 2026년에 redux를 앞질렀다. 2026년에는 모든 패키지가 함께 늘어, 절대값보다 순위와 비율을 본다')

npm registry API로 지난 3년의 분기별 다운로드를 집계했다[^npm]. 2026년에는 다섯 패키지가 모두 3~5배 늘었다. 개별 라이브러리의 인기보다 npm 전체의 설치량(CI, 자동화된 설치)이 늘어난 영향이 크므로, 절대값보다 서로의 비율을 본다.

| 비율                   | 2023년 4분기 | 2026년 3분기 |
| ---------------------- | -----------: | -----------: |
| zustand ÷ redux        |         0.28 |         1.24 |
| TanStack Query ÷ redux |         0.26 |         1.54 |
| Redux Toolkit ÷ redux  |         0.33 |         0.66 |

- **zustand가 redux를 앞질렀다.** 2026년 2분기에 처음 앞섰고(4.70억 대 4.24억 회), 최근 한 주(10월 20~26일)도 5,636만 대 4,118만 회다.
- **서버 상태 라이브러리가 가장 많다.** TanStack Query(`@tanstack/react-query`)는 같은 주 5,451만 회로, 전역 상태 라이브러리와 비슷하거나 더 많이 설치된다.
- **redux 단독 설치는 줄고 Redux Toolkit 비중이 늘었다.** `redux`는 Redux Toolkit과 react-redux의 의존성으로도 설치되므로, redux 수치에는 Redux Toolkit 사용자가 겹쳐 있다.

다운로드 수는 사용자 수가 아니다. 다른 패키지의 의존성으로 설치된 횟수와 CI가 매번 다시 받은 횟수가 섞여 있다. 방향을 보는 지표로만 쓴다.

![한 주 npm 다운로드](./images/flux-pattern-weekly-downloads.svg '2026년 10월 20~26일. zustand 5,636만, TanStack Query 5,451만, redux 4,118만, Redux Toolkit 3,039만 회. jotai 이하는 한 자릿수 백만 회대다')

### State of React 2025: 셋 중 하나는 라이브러리를 쓰지 않는다

[State of React 2025](https://2025.stateofreact.com/en-US/libraries/state-management/) 설문(2025년 11월~2026년 1월, 응답 3,760명)의 상태 관리 항목은 다음과 같다.

![State of React 2025의 상태 관리 사용률 추이](./images/flux-pattern-state-of-react-2025.jpg '설문 응답자 중 써 본 비율(Usage). 2023→2025년 Redux는 약 80%에서 75%로, Redux Toolkit은 55% 안팎에서 그대로, Zustand는 약 28%에서 50%로 올랐다. 2026년 10월 29일 캡처')

- 응답자 1,271명(33.8%)이 상태 관리 라이브러리를 쓰지 않는다. 설문은 `useState`·`useContext` 같은 React 내장 API로 충분한 경우가 많다고 해석했다.
- Redux와 Redux Toolkit은 오랫동안 가장 널리 쓰인 선택지이고, Zustand는 빠르게 늘고 있으며 만족도는 가장 높다. 설문은 Zustand를 이 분야의 선두로 봐도 된다고 적었다.
- TanStack Query는 상태 관리 라이브러리 목록 밖에서도 가장 긍정적인 평가를 받았고, 기타 응답에서 가장 많이 언급된 이름(42회)이다.
- 이번 설문은 예년보다 늦게 열려 참여가 적었다. 비율은 이 표본 안에서만 의미가 있다.

### Signals: 언어 표준으로 가는 중

Angular·Vue·Solid·Preact는 값이 바뀐 곳만 다시 계산하는 signal 방식의 반응성을 쓴다. TC39에는 이 반응성의 핵심(쓰기 가능한 상태, 의존을 추적하는 파생 값, 감시자)을 언어에 넣자는 [Signals 제안](https://github.com/tc39/proposal-signals)이 있다. 2026년 10월 기준으로 아직 Stage 1이고, 목표는 애플리케이션 개발자용 API가 아니라 프레임워크들이 공유할 공통 기반이다. React는 signal 대신 컴포넌트 단위로 다시 렌더링하는 방식을 유지하고 있다.

![TC39 Signals 제안 저장소](./images/flux-pattern-tc39-signals.jpg 'tc39/proposal-signals README 첫머리. Stage 1이고, Angular·Vue·Solid·Svelte·MobX 등 여러 프레임워크 작성자가 설계에 참여한다. 2026년 10월 29일 캡처')

## 고찰: Flux에서 무엇이 빠지고 무엇이 남았나

![Flux에서 useSyncExternalStore까지](./images/flux-pattern-evolution.svg 'Flux(2014년 5월 React 블로그), Redux 1.0.0(2015년 8월), Zustand 1.0.0(2019년 6월), React 18(2022년 3월)이 각각 빼고 바꾸고 더한 것. 네 단계 모두 View가 상태를 직접 바꾸지 않는다')

공식 자료의 변화와 2026년의 수치를 함께 놓으면, Flux 이후 10여 년의 흐름은 세 가지로 정리된다.

1. **중앙 장치가 사라졌다.** Redux는 Dispatcher를 순수 reducer로 바꿨고, Zustand는 Action 객체와 reducer마저 필수에서 뺐다. 상태를 바꾸는 입구는 이제 store가 노출하는 함수 호출이다. zustand가 redux를 앞지른 수치는 "모든 변경을 Action 객체로 기술한다"는 비용을 대부분의 앱이 더는 치르지 않으려 한다는 뜻으로 읽힌다. 반대로 변경 기록과 time travel이 꼭 필요한 큰 팀에서는 Redux Toolkit 비중이 늘었다.
2. **서버 상태가 분리되었다.** Flux의 Store는 서버에서 받은 데이터와 화면 상태를 함께 담았다. 지금은 캐시·재시도·무효화를 맡는 서버 상태 라이브러리가 따로 있고, TanStack Query의 다운로드가 전역 상태 라이브러리보다 많다. 전역 store에 남는 것은 서버와 무관한 화면 상태뿐이라, store가 작아지고 셋 중 하나는 라이브러리 없이도 충분해졌다.
3. **구독 단위가 작아졌다.** Flux의 Store는 "바뀌었다"는 이벤트 하나를 냈고, View는 Store 전체를 다시 읽었다. 이후 selector(Redux, Zustand), atom(Jotai), signal(Angular·Vue·Solid)로 구독 단위가 점점 작아졌다. 표준화가 진행 중인 Signals 제안은 이 흐름의 끝에 있다.

![구독 단위가 작아져 온 흐름](./images/flux-pattern-granularity.svg 'Flux Store의 변경 이벤트 하나에서 selector, atom, signal로 갈수록 값 하나가 바뀌었을 때 다시 계산되는 범위가 좁아진다')

반면 처음부터 지금까지 바뀌지 않은 규칙이 있다. **View는 상태를 직접 바꾸지 않고, 정해진 입구로 변경을 요청한 뒤 알림을 받아 다시 읽는다.** Dispatcher도 Action 객체도 빠졌지만 단방향 흐름은 모든 라이브러리에 남았고, React는 이를 `useSyncExternalStore`라는 표준 구독 방법으로 받아들였다.

그래서 2026년에 상태 관리를 고를 때 질문의 순서는 "어떤 라이브러리인가"보다 "이 상태는 어디에 속하는가"가 앞선다. 서버에 속한 데이터는 서버 상태 라이브러리에, 한 화면의 상태는 React 내장 상태에 두고, 그래도 여러 화면이 함께 쓰는 상태가 남을 때 작은 외부 store를 둔다. MacFolio도 창 관리 상태만 React 밖의 작은 store(`createStore` + `useSyncExternalStore`)에 두었다. 그 과정은 [MacFolio의 store 설계](/memo/macfolio-store-design)에 적었다.

## 언제 무엇을 고르나

Redux FAQ의 [When should I use Redux?](https://redux.js.org/faq/general#when-should-i-use-redux)는 "Not all apps need Redux"로 시작한다. 아래 조건은 각 공식 문서가 직접 든 것이다.

- **한 컴포넌트 안에서만 쓰는 상태 → `useState`·`useReducer`.** React 문서는 가능하면 React 내장 상태를 쓰라고 권한다([useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)의 Note).
- **한 화면의 갱신 로직이 복잡하고, 깊은 하위 컴포넌트까지 상태와 갱신 함수를 전달해야 한다 → `useReducer` + Context.** React 문서는 reducer와 context를 합쳐 복잡한 화면의 상태를 관리할 수 있다고 설명한다([Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context)).
- **큰 상태를 앱 여러 곳에서 쓰고, 자주 바뀌고, 갱신 로직이 복잡하고, 여러 사람이 작업하고, 상태가 시간에 따라 어떻게 바뀌는지 봐야 한다 → Redux.** Redux FAQ가 Redux가 가장 쓸모 있는 경우로 든 다섯 조건이다. 새로 쓸 때는 [Redux Toolkit](https://redux.js.org/introduction/getting-started)을 공식 권장 방식으로 든다.
- **store 하나로 전역 상태를 두되, Action 객체·reducer 없이 store 함수로 갱신한다 → Zustand.** [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)가 권하는 방식(single store, `set`으로만 갱신, store action 함께 두기)이다.
- **React가 아닌 코드(브라우저 API, 다른 라이브러리, 직접 만든 store)의 상태를 컴포넌트가 구독한다 → `useSyncExternalStore`.** React 문서는 이 hook이 주로 기존의 React가 아닌 코드와 연결할 때 쓸모 있다고 적는다.
- **데이터가 서버에 있고, 다른 사람이 바꿀 수 있고, 시간이 지나면 낡는다 → 서버 상태 라이브러리(예: TanStack Query).** [TanStack Query 개요](https://tanstack.com/query/latest/docs/framework/react/overview)는 기존 상태 관리 라이브러리가 클라이언트 상태에는 좋지만 비동기·서버 상태에는 맞지 않는다고 설명한다.

여러 조건이 겹치면 하나만 고르지 않는다. 예를 들어 서버에서 받은 글 목록은 서버 상태 라이브러리에, 편집 중인 화면의 선택 상태는 `useReducer`에 두는 식으로 상태의 종류마다 나눈다. Redux FAQ도 Redux가 다루는 문제(상태 관리, 서버 데이터 캐싱, UI로 데이터 전달) 일부를 푸는 다른 도구가 많다고 적는다.

## 관련 글

- [MacFolio의 store 설계 - Flux·Redux에서 따른 것과 뺀 것](/memo/macfolio-store-design): 이 구조를 창 관리 store에 적용한 개발기
- [창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계](/memo/desktop-core-windows): `createStore`와 `useSyncExternalStore`를 고른 과정

[^npm]: [npm registry downloads API](https://github.com/npm/registry/blob/main/docs/download-counts.md). `https://api.npmjs.org/downloads/range/<기간>/<패키지>`로 일별 다운로드를 받아 분기별로 합산했다(2026년 10월 29일 조회).

#React #상태관리 #아키텍처 #동향
