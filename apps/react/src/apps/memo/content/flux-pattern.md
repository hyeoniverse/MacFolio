---
title: Flux 패턴 — Action·Dispatcher·Store·View의 단방향 흐름과 그 뒤의 Redux, 외부 store
date: 2026-10-25
category: 기술 노트/프론트엔드/React
summary: Flux는 상태 변경을 Action → Dispatcher → Store → View 한 방향으로만 흐르게 하는 구조다. 양방향 바인딩의 연쇄 갱신 문제, 네 구성 요소와 waitFor, Redux가 바꾼 점, useSyncExternalStore로 구독하는 외부 store를 공식 자료 기준으로 정리했다.
---

Flux는 Facebook이 2014년에 공개한 클라이언트 애플리케이션 구조다. 상태를 바꾸는 요청이 **Action → Dispatcher → Store → View** 한 방향으로만 흐르게 한다. 지금 Flux 라이브러리 자체를 쓰는 프로젝트는 드물지만, Redux·Zustand 같은 상태 관리 라이브러리와 React의 `useReducer`·`useSyncExternalStore`가 이 구조에서 나왔다.

이 글은 Flux가 해결하려던 문제와 구성 요소, Flux 이후 Redux와 외부 store가 바꾼 점을 공식 자료를 기준으로 정리한다. 이 구조를 MacFolio의 store에 적용한 내용은 개발기 [MacFolio의 store 설계](/memo/macfolio-store-design)에 따로 정리했다.

## Flux가 나온 이유: 양방향 바인딩의 연쇄 갱신

React 블로그의 글 [Flux: An Application Architecture for React](https://legacy.reactjs.org/blog/2014/05/06/flux.html)(2014년 5월 6일, Bill Fisher·Jing Chen)는 F8의 분과 세션에서 Flux를 발표한 뒤 쓴 글이다. Flux 문서의 [In-Depth Overview](https://facebookarchive.github.io/flux/docs/in-depth-overview)는 Flux를 "Facebook이 클라이언트 웹 애플리케이션을 만들 때 쓰는 구조"로 소개하고, MVC 대신 단방향 데이터 흐름을 고른 이유를 다음과 같이 적는다.

> We found that two-way data bindings led to cascading updates, where changing one object led to another object changing, which could also trigger more updates.

Overview가 든 출발점은 파생 데이터였다. 메시지 스레드 목록에서 읽지 않은 스레드를 강조하고, 다른 뷰에는 읽지 않은 수를 보여 주려 했다. MVC에서는 스레드 하나를 읽음으로 바꾸면 스레드 모델을 갱신한 뒤 읽지 않은 수 모델도 따로 갱신해야 했고, 이런 의존과 연쇄 갱신이 큰 MVC 애플리케이션에서 얽힌 데이터 흐름을 만든다고 적는다.

모델과 뷰가 양방향으로 연결되어 있으면, 모델 하나를 바꾼 결과가 다른 모델과 뷰로 연쇄해서 퍼진다. 애플리케이션이 커질수록 사용자 동작 하나가 어떤 상태를 바꾸는지 예측하기 어려워진다. Flux는 상태를 바꾸는 입구를 하나로 줄여 이 문제를 다룬다.

![양방향 바인딩과 Flux의 단방향 흐름](./images/flux-pattern-mvc-vs-flux.svg '왼쪽: 모델과 뷰가 서로를 갱신해 변경이 연쇄된다. 오른쪽: 상태 변경은 Action으로 시작해 Dispatcher와 Store를 거쳐 View로만 흐른다')

## 네 구성 요소

In-Depth Overview는 Flux의 주요 부분을 Dispatcher, Store, View 셋으로 꼽고, Action을 만드는 action creator를 "네 번째 부분"으로 설명한다.

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

상태를 바꾸는 길이 Dispatcher를 거치는 Action 하나뿐이라, 어떤 상태가 왜 바뀌었는지 추적하려면 Dispatcher를 지나간 Action만 기록하면 된다.

### waitFor: Store 사이의 갱신 순서

Store가 여러 개면 한 Store가 다른 Store의 갱신 결과에 의존할 수 있다. 예를 들어 항공권 가격 Store가 도시 Store에서 고른 도시를 읽어야 한다면, 도시 Store가 먼저 갱신돼야 한다. Dispatcher의 `waitFor()`는 콜백 안에서 "이 Store들의 콜백이 끝난 뒤에 계속하라"고 선언하는 메서드다.

<details>
<summary>waitFor 사용 형태 (In-Depth Overview의 예와 같은 구조)</summary>

```js
// 도시 Store: Action을 받아 도시를 갱신한다. register는 등록 토큰을 돌려준다
CityStore.dispatchToken = dispatcher.register((action) => {
	if (action.type === 'city/select') city = action.city;
});

// 가격 Store: 도시 Store가 먼저 끝나야 새 도시로 가격을 계산할 수 있다
dispatcher.register((action) => {
	if (action.type === 'city/select') {
		dispatcher.waitFor([CityStore.dispatchToken]);
		price = priceFor(CityStore.getCity());
	}
});
```

</details>

Overview는 `waitFor()`가 "크고 복잡한 애플리케이션에서 필수"라고 적는다. 반대로 말하면 Store가 많아질수록 Store 사이의 순서를 사람이 관리해야 한다는 뜻이다. 이 지점을 Redux가 다르게 풀었다.

## Flux 이후: Redux

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

## 외부 store와 useSyncExternalStore

React 바깥에 상태를 두고 컴포넌트가 구독하는 방식도 Flux의 단방향 흐름을 따른다. [Zustand](https://github.com/pmndrs/zustand)는 README에서 스스로를 "simplified flux principles를 쓰는 작은 상태 관리 도구"라고 소개한다. React 없이 쓰는 vanilla `createStore`는 `getState`·`setState`·`subscribe`(와 `getInitialState`)를 돌려준다.

Zustand 문서의 [Flux inspired practice](https://zustand.docs.pmnd.rs/guides/flux-inspired-practice)는 Flux·Redux에서 가져온 권장 방식을 세 가지로 적는다.

- **Single store:** 전역 상태는 Zustand store 하나에 둔다. 크면 slice로 나눈다.
- **`set`/`setState`로만 갱신:** 갱신을 병합하고 구독자에게 알리는 일을 `set`이 맡는다.
- **Colocate store actions:** 다른 Flux 라이브러리의 dispatch되는 Action과 reducer 없이, 상태를 바꾸는 함수(store action)를 store 안에 함께 둔다. reducer가 필요하면 store에 `dispatch` 함수를 직접 정의할 수 있다.

즉 Action 객체와 Dispatcher를 빼고, store 함수가 새 상태를 만들어 구독자에게 알리는 형태다.

React는 18부터 이런 store를 구독하는 표준 hook으로 [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)를 제공한다.

- `subscribe(callback)`: store가 바뀌면 `callback`을 호출하고, 구독 해제 함수를 돌려준다.
- `getSnapshot()`: store가 바뀌지 않았으면 같은 값을 돌려줘야 한다. React는 반환값을 `Object.is`로 비교해 다르면 다시 렌더링한다.

React 문서는 가능하면 `useState`·`useReducer` 같은 React 내장 상태를 쓰라고 권하고, `useSyncExternalStore`는 주로 React가 아닌 코드와 연결할 때 쓴다고 설명한다. `useReducer`는 reducer와 Action을 컴포넌트 안에서 쓰는 형태라, Flux·Redux의 흐름을 React 상태로 옮긴 것에 가깝다.

## 정리

| 항목       | Flux             | Redux         | Zustand    |
| ---------- | ---------------- | ------------- | ---------- |
| 변경 입구  | Action           | `dispatch`    | store 함수 |
| Dispatcher | 있음             | 없음          | 없음       |
| store 수   | 여럿             | 하나          | 하나 권장  |
| 갱신       | Store 내부       | 순수 reducer  | `set` 병합 |
| React 연결 | 변경 이벤트 구독 | `react-redux` | hook 구독  |

| 질문              | 답                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------- |
| 해결하려던 문제   | 양방향 바인딩에서 모델·뷰가 연쇄 갱신되어 변경 결과를 예측하기 어려운 문제             |
| 핵심 규칙         | 상태를 바꾸는 입구를 Dispatcher를 거치는 Action 하나로 줄이고, 흐름을 한 방향으로 둔다 |
| Redux가 바꾼 것   | Dispatcher 대신 순수 reducer, store 하나, 불변 상태                                    |
| 외부 store의 형태 | Action·Dispatcher 없이 store 함수가 새 상태를 만들고 구독자에게 알린다                 |
| 공통으로 남은 것  | View는 상태를 직접 바꾸지 않고, 변경 알림을 받아 다시 읽는다                           |

## 관련 글

- [MacFolio의 store 설계 - Flux·Redux에서 따른 것과 뺀 것](/memo/macfolio-store-design): 이 구조를 창 관리 store에 적용한 개발기
- [창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계](/memo/desktop-core-windows): `createStore`와 `useSyncExternalStore`를 고른 과정

#TIL #React #상태관리 #아키텍처
