---
title: useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준
date: 2026-10-16
category: 개발 기록/MacFolio/프론트엔드
summary: 날씨 앱에서 신호등이 사이드바에 가려졌고, 641~767px 휴대폰 화면에 넓은 창 모양이 렌더링되었고, 장소가 하나면 목록 버튼이 밀려났다. 셋 다 두 규칙이 서로 다른 기준을 쓰던 곳이라 기준을 하나로 통일하고 E2E 시험 3개로 검증했다.
---

날씨 앱의 레이아웃 문제 세 가지를 수정했다([#226](https://github.com/hyeoniverse/MacFolio/pull/226)). 셋 다 두 규칙이 서로 다른 기준을 쓰던 곳이었다.

| 증상                                | 어긋난 두 기준                                   | 수정 내용                              |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------- |
| 신호등이 어두운 사이드바에 가려진다 | 신호등 줄(z 3)과 사이드바(z 4)                   | 사이드바는 내리고 버튼만 분리해 올린다 |
| 휴대폰 화면 안에 넓은 창 모양       | 사이트의 휴대폰 기준(767px)과 날씨의 기준(640px) | JS가 정한 `data-compact` 하나로 판단   |
| 장소가 하나면 목록 버튼이 밀린다    | 그리드 칸 순서와 실제로 렌더링한 자식 수         | `grid-column: 3`, 여백 28px            |

세 가지 모두 날씨 앱에 한정된 문제라 커밋 하나(`ea63bc805`)에 담았다. 변경 파일은 `Weather.tsx`, `Weather.css`, `e2e/weather.spec.ts` 세 개다(294줄 추가, 202줄 삭제). `Weather.css`의 변경(352줄)이 큰 이유는 컨테이너 질의 안의 규칙을 모두 밖으로 옮기고 선택자를 바꿨기 때문이다.

## 사이드바가 신호등을 덮었다

날씨 창은 제목 표시줄 없이 신호등 버튼이 내용 위에 떠 있다(`chrome="unified"`). 신호등 줄은 창 끌기 영역이기도 해서 `z-index: 3`으로 내용 위에 배치된다.

떠 있는 사이드바의 오른쪽 위에는 사이드바 버튼이 있고, 이 버튼도 신호등 줄과 같은 높이에 있다. 그대로 두면 끌기 영역이 위에 있어서 버튼이 클릭되지 않는다. 사이드바는 블러([`backdrop-filter`](https://developer.mozilla.org/en-US/docs/Web/CSS/backdrop-filter)) 때문에 새 [쌓임 맥락](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)을 만들므로, 내부 버튼의 `z-index`만 올려서는 효과가 없다. 그래서 수정 전 코드는 사이드바 전체를 `z-index: 4`로 올렸고, 그 결과 어두운 사이드바가 신호등을 덮었다.

이것은 메모 도구 막대에서 겪은 쌓임 맥락 문제([position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context))와 같은 구조다. 그때는 `position: sticky`가, 이번에는 `backdrop-filter`가 쌓임 맥락을 만들었다.

사이드바는 신호등 줄 아래로 내리고, 사이드바 버튼만 사이드바 밖으로 분리해 `z-index: 4`로 올렸다. 버튼 위치는 사이드바 크기로 계산한다.

![날씨 창의 겹침 순서. 수정 전에는 사이드바 전체가 z-index 4로 신호등 줄을 덮었고, 수정 후에는 사이드바 버튼만 z-index 4이고 사이드바는 신호등 줄 아래에 있다](./images/weather-layout-fixes-layers.svg '사이드바 대신 버튼만 신호등 줄 위로')

```css
/* 자리 = 사이드바 바깥 여백 8 + 너비 250 - 안쪽 여백 10 - 버튼 30, 위로는 8 + (36 - 26) / 2 */
.weather-sidebar-toggle {
	position: absolute;
	top: 13px;
	left: 218px;
	z-index: 4;
}
```

## 휴대폰 화면 안에 넓은 창 모양이 렌더링되었다

사이트는 폭 767px(`MOBILE_MAX_WIDTH`)까지 휴대폰 화면으로 판단한다. 가로로 눕힌 휴대폰(높이 499px 이하)은 폭 1023px까지도 휴대폰이다(`desktop/layout.ts`의 `LANDSCAPE_PHONE`). 그런데 날씨 앱은 날씨 칸이 640px 이하인 경우에만 iOS 모양으로 바꿨다([`@container`](https://developer.mozilla.org/en-US/docs/Web/CSS/@container) `weather (max-width: 640px)`).

그래서 폭 641~767px의 세로 화면과 가로로 눕힌 휴대폰에서는 넓은 창 모양(떠 있는 사이드바)이 휴대폰 화면 안에 렌더링되었다. 사이드바의 블러가 화면 위쪽을 덮었고, 사이드바 버튼은 상태 표시줄 아래에 가려져 클릭되지 않았다.

검토한 수정 방법은 세 가지다.

| 방법                                    | 장점                        | 단점                                                                            |
| --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| 컨테이너 질의 값을 767px로 올린다       | 한 줄 수정                  | 눕힌 휴대폰(1023px까지)은 여전히 어긋난다. 데스크톱의 좁은 창도 iOS 모양이 된다 |
| 미디어 질의를 컨테이너 질의와 함께 쓴다 | CSS만으로 구현              | 사이트의 휴대폰 판단(JS, 높이 조건 포함)을 CSS에 중복 작성해야 한다             |
| JS가 `data-compact`를 정한다            | 사이트와 같은 `useIsMobile` | `ResizeObserver` 하나가 추가로 동작한다                                         |

메모 앱도 같은 문제로 컨테이너·스타일 질의 대신 JS가 정한 `data-compact`로 전환한 적이 있다(`44b27c41b`). 날씨 앱에도 같은 방식을 적용했다. 휴대폰 화면이면 폭과 상관없이 iOS 모양이고, 데스크톱에서는 날씨 칸이 640px(`COMPACT_WIDTH`) 이하인 경우에만 iOS 모양이다. 칸 폭은 [`ResizeObserver`](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver)로 측정한다.

```ts
function useCompact(ref: React.RefObject<HTMLElement | null>) {
	const phone = useIsMobile();
	const [width, setWidth] = useState(Infinity);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return phone || width <= COMPACT_WIDTH;
}
```

CSS는 컨테이너 질의 안에 있던 규칙을 밖으로 옮기고, 각 선택자 앞에 `.weather[data-compact]`를 추가했다.

```css
/* 수정 전 */
@container weather (max-width: 640px) {
	.weather-bottom-bar { … }
}

/* 수정 후 */
.weather[data-compact] .weather-bottom-bar { … }
```

![사이트의 휴대폰 구간과 날씨의 iOS 모양 구간이 641~767px에서 어긋난 모습](./images/weather-layout-fixes-ranges.svg '두 기준이 어긋난 641~767px')

## 장소가 하나면 목록 버튼이 왼쪽으로 밀려난 문제

iOS 모양의 하단 막대는 3열 그리드다(`grid-template-columns: 48px 1fr 48px`). 왼쪽은 빈 칸, 가운데는 장소 점, 오른쪽은 목록 버튼이다. 장소가 하나면 이동할 대상이 없어서 장소 점을 렌더링하지 않는다. 그러면 그리드 자동 배치에 따라 목록 버튼이 비어 있는 가운데 칸으로 들어가, 가운데 칸 왼쪽 끝에 붙었다.

![아래 막대 그리드에서 목록 버튼이 두 번째 칸으로 밀렸다가 세 번째 칸에 고정된 모습](./images/weather-layout-fixes-bottom-bar.svg '빈 칸이 있어도 같은 열에 고정')

목록 버튼에 [`grid-column: 3`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-column)을 지정해 항상 세 번째 열에 배치한다. 하단 막대의 좌우 여백도 날씨 칸과 달리 16px였는데, 날씨 칸과 같은 28px(`--weather-gutter`)로 맞췄다. 이제 목록 버튼의 바깥 끝이 날씨 칸의 끝과 같은 선에 있다.

## 확인

`apps/react/e2e/weather.spec.ts`에 시험 3개를 추가했다(79줄).

- "신호등은 떠 있는 사이드바 위에 보인다 (사이드바가 덮지 않는다)": 신호등 좌표에서 가장 위에 렌더링된 요소가 신호등 버튼인지 [`document.elementFromPoint`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)로 확인한다
- "폭과 상관없이 iOS 모양 (목록은 덮어 열고, 사이드바 버튼이 상태 표시줄 밑에 깔리지 않는다)": 744px 세로 화면과 844×390 가로 화면 두 경우를 같은 시험으로 실행한다
- "아래 막대의 목록 버튼은 장소가 하나여도 오른쪽, 날씨 칸들과 같은 좌우 여백에 맞춘다": 목록 버튼의 오른쪽 끝이 날씨 칸의 오른쪽 끝과 같은지 좌표로 비교한다

첫 시험은 화면에 실제로 보이는 결과를 검사한다. 신호등이 DOM에 존재하지만 다른 요소에 가려진 문제는, 요소의 존재나 `visible` 상태만 확인하는 시험으로는 검출되지 않는다. 그 좌표에서 가장 위에 있는 요소를 확인해야 한다.

## 정리

- 반응형 기준값이 둘 이상이면 그 사이에 어느 규칙도 맞지 않는 구간이 생긴다. 이번에는 641~767px이었다. 앱의 좁은 모양 판단은 사이트의 휴대폰 판단을 먼저 따르고, 그다음에 앱 칸의 폭을 확인한다.
- 컨테이너 질의는 앱 칸의 폭만 알고, 그 칸이 휴대폰 화면 안에 있는지는 알지 못한다. 두 조건을 함께 판단해야 하는 경우는 JS가 계산한 속성(`data-compact`)으로 CSS에 전달한다.
- 그리드에서 조건부 자식이 렌더링되지 않으면 나머지 자식이 앞 칸으로 이동한다. 위치가 정해진 자식은 `grid-column`으로 열을 고정한다.
- 같은 사이트의 메모 앱에서 이미 해결한 문제였다. 새 앱은 처음부터 `data-compact` 방식으로 만든다.

## 관련 글

- 날씨 앱을 처음 만든 일: [Open-Meteo 지오코딩 지연을 내장 도시 목록 우선 검색으로 줄이기](/memo/weather-app)
- 쌓임 맥락 때문에 버튼이 클릭되지 않던 일: [position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context)
- 화면 전체의 z-index 정리: [디자인 토큰 1 - 흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers)
- 좁은 창에서 제목이 잘리던 일: [컨테이너 쿼리 좁은 창에서 flex: none으로 신호등 버튼 영역 확보하기](/memo/narrow-window-title)
- 최소화했다 다시 열면 `useCompact`가 폭을 측정하지 못하던 일: [callback ref로 바뀐 요소에 ResizeObserver 다시 연결하기](/memo/memo-restore-compact)
- PR: [#226](https://github.com/hyeoniverse/MacFolio/pull/226)

#트러블슈팅 #프론트엔드 #CSS
