---
title: 최소화했다 다시 열면 넓은 창이 휴대폰 모양이 되던 이유 — ref 객체와 ResizeObserver
date: 2026-10-22
category: 개발 기록/MacFolio/프론트엔드
summary: 메모 창을 최소화했다가 Dock에서 다시 열면 898px 창에서도 휴대폰 모양이 됐다. 앱 컴포넌트는 마운트된 채 칸 요소만 새로 만들어지는데, ResizeObserver가 문서에서 빠진 이전 요소를 계속 관찰했다. 날씨·사진도 같은 구조라 useElementWidth 훅 하나로 수정했다.
---

데스크톱에서 메모 앱이 가끔 휴대폰 모양(폴더 → 목록 → 본문을 한 칸씩)으로 렌더링되었다. 창 폭은 898px로, 한 칸씩 보이는 기준(700px)보다 넓었다. 재현 조건은 하나였다. **창을 최소화했다가 Dock에서 다시 열면** 항상 이 모양이 됐다. 수정은 [#324](https://github.com/hyeoniverse/MacFolio/pull/324)다.

![폭 898px 창 안에 폴더 화면으로 돌아가는 버튼과 글 목록만 한 칸으로 표시된 메모](./images/memo-restore-compact-before.jpg '수정 전: 최소화 → 다시 열기. 898px 창인데 data-compact가 붙어 글 목록만 한 칸으로 보인다')

![같은 898px 창에 폴더 사이드바·글 목록·본문이 나란히 표시된 메모](./images/memo-restore-compact-after.jpg '수정 후: 같은 절차를 거쳐도 폴더·목록·본문 3단')

## 폭을 재는 구조

메모는 칸(`.memo-shell`)의 폭을 [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)로 측정해, 700px(`COMPACT_WIDTH`) 이하이면 `data-compact` 속성을 붙이고 한 칸씩 보여 준다. 컨테이너 질의 대신 JS로 판단하는 이유는 [날씨 앱의 세 가지 어긋남](/memo/weather-layout-fixes)에 정리했다. 수정 전 훅은 다음과 같았다.

```ts
export function useShellSize(ref: React.RefObject<HTMLElement | null>) {
	const [width, setWidth] = useState(Infinity);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return { compact: width <= COMPACT_WIDTH, narrow: width <= NARROW_WIDTH };
}
```

이 코드는 "컴포넌트가 마운트되는 시각에 칸 요소가 생기고, 언마운트되는 시각에 사라진다"는 전제 위에 있다. 창 최소화는 이 전제를 깨뜨린다.

## 원인: 컴포넌트는 남고 요소만 바뀐다

`AppWindow`(`desktop/window/Window.tsx`)는 앱이 실행 중이 아니거나 최소화되어 있으면 `null`을 반환한다. 이 판단은 `AppWindow` 안에서만 하므로, `AppWindow`를 렌더링하는 `Memo` 컴포넌트와 그 안의 훅은 최소화 중에도 마운트된 상태로 남는다.

```tsx
// Window.tsx
const visible = isRunning && !isMinimized;
// …
if (!visible && cardIndex < 0) return null;
```

| 단계                 | 칸 요소 | 관찰 대상 | 측정 폭    | data-compact |
| -------------------- | ------- | --------- | ---------- | ------------ |
| 열기                 | A       | A         | 898        | 없음         |
| 전체 화면 ↔ 되돌리기 | A       | A         | 1278 → 898 | 없음         |
| 최소화               | 없음    | A (빠짐)  | **0**      | true         |
| 다시 열기 (수정 전)  | B       | A (빠짐)  | **0** 유지 | **true**     |
| 다시 열기 (수정 후)  | B       | **B**     | 898        | 없음         |

1. 최소화하면 `AppWindow`가 `null`을 반환해 칸 A가 문서에서 빠진다. 관찰 중인 요소가 렌더링되지 않으므로 `ResizeObserver`는 폭 0을 보고하고, `width`가 0이 된다. 창이 보이지 않으므로 이 시각에는 영향이 없다.
2. 다시 열면 `AppWindow`가 칸 B를 새로 만들고, React는 `shellRef.current`를 B로 교체한다.
3. 그런데 effect의 의존성은 `[ref]`, 즉 ref **객체**다. [`useRef`](https://react.dev/reference/react/useRef)가 반환하는 객체는 컴포넌트가 마운트되어 있는 동안 동일하므로 effect가 다시 실행되지 않는다. B는 아무도 관찰하지 않고, `width`는 0으로 남아 898px 창에 `data-compact`가 붙는다.

![수정 전에는 다시 연 뒤에도 ResizeObserver가 문서에서 빠진 칸 A를 관찰하고, 수정 후에는 attach로 받은 칸 B를 관찰하는 흐름](./images/memo-restore-compact-observer.svg '열기 → 최소화 → 다시 열기의 관찰 대상. 수정 전에는 effect가 다시 실행되지 않아 칸 A에 머문다')

ref 객체를 의존성에 넣는 코드는 린트 규칙(`react-hooks/exhaustive-deps`)을 통과하고, 처음 마운트한 경우에는 정상 동작한다. 요소가 컴포넌트보다 먼저 교체되는 경우에만 드러나는 결함이다.

### 같은 구조를 쓰던 앱

창 폭으로 모양을 바꾸는 앱을 검색하니 두 곳이 같은 코드를 사용하고 있었다. 최소화했다가 다시 열면 둘 다 좁은 창 모양으로 남았다.

| 앱   | 훅                        | 기준 폭      |
| ---- | ------------------------- | ------------ |
| 메모 | `useShellSize(shellRef)`  | 700px, 860px |
| 날씨 | `useCompact(shell)`       | 640px        |
| 사진 | `Photos.tsx`의 `useWidth` | 760px, 560px |

## 수정: 요소를 붙이는 함수로 받는다

`shared/hooks/useElementWidth.ts`를 새로 만들었다. 요소를 ref 객체가 아니라 [ref 콜백](https://react.dev/reference/react-dom/components/common#ref-callback)(`attach`)으로 받아 state에 저장한다. 요소가 바뀌면 state가 바뀌고, effect가 새 요소로 다시 실행된다.

```ts
export function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T | null>(null);
	const [element, setElement] = useState<T | null>(null);
	const attach = useCallback((node: T | null) => {
		ref.current = node;
		setElement(node);
	}, []);
	const [width, setWidth] = useState(Infinity);
	useLayoutEffect(() => {
		if (!element) return;
		// 문서에서 빠지는 순간의 0은 반영하지 않는다
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0) setWidth(entry.contentRect.width);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [element]);
	return { ref, attach, width };
}
```

세 가지를 함께 처리한다.

- **요소 교체 감지**: `attach`는 `useCallback`으로 고정한 함수라, React는 요소가 바뀔 때만 `attach(null)` → `attach(B)` 순서로 호출한다. 그때마다 `element` state가 바뀌어 `useLayoutEffect`가 이전 관찰을 `disconnect`하고 B를 관찰한다.
- **폭 0 필터링**: 빠진 요소에 대해 폭 0이 보고되어도 반영하지 않는다. 최소화 중에도 마지막 폭(898)이 `width`에 남아, 다시 연 창은 새 관찰의 첫 보고를 받기 전에도 넓은 모양으로 렌더링된다.
- **그리기 전 측정**: `ResizeObserver`는 관찰을 시작하면 현재 크기를 한 번 보고한다. 관찰을 `useLayoutEffect`에서 시작해 그 첫 보고가 화면을 그리기 전에 반영되게 한다. 수정 전 사진 앱의 `useWidth`가 쓰던 방식을 공통 훅에 가져왔다.

`ref`도 함께 반환한다. 메모는 검색 칸을 찾는 데 칸 요소를 직접 읽으므로(`shellRef.current`), 기존 ref 사용처는 그대로 두고 JSX의 `ref` 속성만 `attach`로 바꿨다.

| 앱   | 수정 전                                    | 수정 후                                                     |
| ---- | ------------------------------------------ | ----------------------------------------------------------- |
| 메모 | `useShellSize(shellRef)`, `ref={shellRef}` | `useShellSize()`가 `ref`·`attach` 반환, `ref={attachShell}` |
| 날씨 | `useCompact(shell)`, `ref={shell}`         | `useCompact()`가 `attach` 반환, `ref={attachShell}`         |
| 사진 | 파일 안의 `useWidth(shell)`, `ref={shell}` | `useElementWidth()`, `useWidth` 삭제                        |

이후 메시지 앱도 나란히 보기 판단에 이 훅을 사용한다([메시지 앱의 세 가지 어긋남](/memo/messages-layout-fixes)).

## 확인

- 재현 절차: 1280px 화면에서 메모 열기 → 전체 화면 → 되돌리기 → 최소화 → Dock에서 다시 열기. 수정 전에는 다시 연 시각에 칸 폭 898px, `data-compact="true"`였고, 수정 후에는 898px, `data-compact` 없음이다.
- `e2e/memo.spec.ts`에 "최소화했다가 다시 열어도 넓은 창 모양이고, 그 뒤에 창을 좁히면 한 칸씩 보인다"를 추가했다. 다시 연 뒤 `data-compact`가 없는지 확인하고, 이어서 오른쪽 아래 모서리를 왼쪽으로 400px 끌어 `data-compact="true"`가 붙는지 확인한다. 두 번째 확인은 "0을 무시해서 통과한 것"이 아니라 "새 칸 B를 실제로 관찰하고 있다"는 것을 검증한다.
- 메모·날씨·사진 단위 테스트 281개 통과.

## 남은 것

- 날씨·사진의 최소화 → 다시 열기는 E2E로 별도 확인하지 않았다. 같은 훅을 사용하므로 메모의 시험으로 대신한다.
- 같은 구조의 결함은 "컴포넌트 수명 ≠ 요소 수명"인 곳 어디에서나 생긴다. 조건부로 렌더링되는 요소를 관찰하는 코드는 ref 객체를 의존성으로 쓰지 않고 `useElementWidth`처럼 ref 콜백으로 요소를 받는다.

## 관련 글

- [날씨 앱의 세 가지 어긋남 — 가려진 신호등, 휴대폰 안의 넓은 창, 밀려난 목록 버튼](/memo/weather-layout-fixes): 날씨 앱이 `useCompact`와 `data-compact`를 쓰게 된 경위
- [창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계](/memo/desktop-core-windows): 최소화 상태(`isMinimized`)를 관리하는 창 store

#MacFolio #React #ResizeObserver #트러블슈팅
