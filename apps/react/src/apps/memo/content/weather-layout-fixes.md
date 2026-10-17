---
title: 날씨 앱의 세 가지 어긋남 — 가려진 신호등, 휴대폰 안의 넓은 창, 밀려난 목록 버튼
date: 2026-10-16
category: 개발기/MacFolio/프론트엔드
summary: 날씨 앱에서 신호등이 사이드바에 가려졌고, 641~767px 휴대폰 화면에서는 넓은 창 모양이 그려졌고, 장소가 하나면 목록 버튼이 왼쪽으로 밀려났다. 셋 다 두 규칙이 서로 다른 기준을 쓰던 곳이었다.
---

날씨 앱에서 걸린 것 세 가지를 고쳤다. 셋 다 두 규칙이 서로 다른 기준을 쓰던 곳이었다.

## 사이드바가 신호등을 덮었다

날씨 창은 제목 표시줄 없이 신호등 버튼이 내용 위에 떠 있다(`chrome="unified"`). 신호등 줄은 창을 끄는 자리이기도 해서 `z-index: 3`으로 내용 위에 있다.

떠 있는 사이드바의 오른쪽 위에는 사이드바 버튼이 있는데, 이 버튼도 신호등 줄 안에 있다. 그대로 두면 끌기 자리가 위에 있어서 버튼이 눌리지 않는다. 사이드바는 흐림(`backdrop-filter`) 때문에 새 층을 만들어서, 안의 버튼만 `z-index`를 올려도 소용이 없다. 그래서 사이드바째 `z-index: 4`로 올려 두었고, 그 바람에 어두운 사이드바가 신호등을 덮었다.

사이드바는 내리고, 사이드바 버튼만 사이드바 밖에 따로 두어 올렸다. 자리는 사이드바의 크기로 계산한다.

```css
/* 자리 = 사이드바 바깥 여백 8 + 너비 250 - 안쪽 여백 10 - 버튼 30, 위로는 8 + (36 - 26) / 2 */
.weather-sidebar-toggle {
	position: absolute;
	top: 13px;
	left: 218px;
	z-index: 4;
}
```

## 휴대폰 화면 안에 넓은 창 모양이 그려졌다

사이트는 폭 767px까지 휴대폰 화면으로 본다. 눕힌 휴대폰(높이 499px 이하)은 1023px까지도 휴대폰이다. 그런데 날씨 앱은 날씨 칸이 640px 이하일 때만 iOS 모양으로 바꿨다(`@container weather (max-width: 640px)`).

그래서 641~767px의 세운 화면과 눕힌 휴대폰에서는 넓은 창 모양(떠 있는 사이드바)이 휴대폰 화면 안에 그려졌다. 사이드바의 흐림이 화면 위쪽을 덮었고, 사이드바 버튼은 상태 표시줄 밑에 깔려 눌리지 않았다.

메모 앱도 같은 문제를 겪어서 JS가 정한 `data-compact`로 바꾼 적이 있다. 날씨도 그렇게 했다. 휴대폰 화면이면 폭과 상관없이 iOS 모양이다.

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

CSS는 컨테이너 질의 안에 있던 규칙마다 앞에 `.weather[data-compact]`를 붙였다.

## 장소가 하나면 목록 버튼이 왼쪽으로 밀려났다

iOS 모양의 아래 막대는 세 칸 그리드다(`48px 1fr 48px`). 왼쪽은 빈 칸, 가운데는 장소 점, 오른쪽은 목록 버튼이다. 장소가 하나면 넘길 곳이 없어서 장소 점을 그리지 않는다. 그러면 목록 버튼이 비어 있는 가운데 칸으로 들어가, 가운데 칸 왼쪽 끝에 붙었다.

목록 버튼에 `grid-column: 3`을 줘서 늘 오른쪽 칸에 둔다. 아래 막대의 좌우 여백도 날씨 칸과 다르게 16px였는데, 날씨 칸과 같은 28px(`--weather-gutter`)로 맞췄다. 이제 목록 버튼의 바깥 끝이 카드의 끝과 같은 선에 있다.

## 시험

- 신호등 자리에서 맨 위에 그려진 것이 신호등 버튼인지(`document.elementFromPoint`)
- 744px 세운 화면과 844×390 눕힌 화면에서 iOS 모양인지, 사이드바 버튼이 없는지, 목록을 덮어 여는지
- 장소가 하나여도 목록 버튼의 오른쪽 끝이 날씨 칸의 오른쪽 끝과 같은지

#트러블슈팅 #프론트엔드 #CSS
