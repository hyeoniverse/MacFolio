---
title: grid-auto-rows 1fr와 line-clamp, margin-top auto로 카드 높이 맞추기
date: 2026-10-03
category: 개발 기록/MacFolio/기능 구현
series: GitHub 앱
seriesOrder: 2
summary: GitHub 앱의 Pinned 카드가 설명 길이에 따라 줄마다 높이가 달랐고, 설명 없는 카드는 언어 줄이 위쪽에 배치됐다. grid-auto-rows: 1fr, 세 줄 말줄임, margin-top: auto 세 가지 CSS로 모든 카드를 같은 크기로 맞추고 E2E로 높이를 측정한다.
---

## 배경

GitHub 앱의 Pinned는 2열 그리드다. [서버가 조회한 저장소](/memo/github-live-profile)를 표시하도록 바꾼 다음 날, 카드 높이가 줄마다 다르게 렌더링됐다. 실제 GitHub의 저장소 설명은 없거나, 한 줄이거나, 매우 길었다.

![Pinned 카드 전후](./images/github-pinned-card-size.jpg '위: 줄마다 높이가 다름 / 아래: 모든 카드가 같은 크기')

증상은 두 가지였다.

1. 설명이 긴 저장소가 있는 줄은 높고, 다른 줄은 낮았다. 그리드의 줄 높이가 일정하지 않았다.
2. 설명이 없는 카드는 언어·별·데모 줄이 제목 바로 아래에 배치되어, 카드 아래쪽이 비어 있었다.

앱에 포함된 스냅샷으로 재현할 수 있다. 스냅샷에는 설명이 없는 카드, 한 줄 설명, 매우 긴 설명이 섞여 있다. 서버 없이 GitHub 앱을 열면 바로 확인된다.

이 문제는 10월 3일 아침 GitHub 앱을 열었을 때 발견했다. 전날 저장소를 서버에서 조회하도록 바꾼 뒤 처음 확인한 실제 데이터였다.

## 원인 분석

카드(`.gh-repo`)는 세로 방향 flex였고, 설명 문단에 `flex: 1`을 지정해 남는 높이를 설명이 차지하게 했다.

```css
/* Github.css (수정 전) */
.gh-pinned ul {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
}
.gh-repo {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.gh-repo-description {
	flex: 1;
}
```

- **줄마다 다른 높이**: 그리드의 줄 높이는 기본값([`grid-auto-rows: auto`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows))이라 그 줄의 카드 중 가장 높은 카드에 맞춰진다. 같은 줄의 두 카드는 높이가 같지만, 다른 줄과는 무관하다.
- **위쪽에 배치된 언어 줄**: `flex: 1`은 설명이 있을 때만 동작한다. 설명이 없으면 `<p>` 자체를 렌더링하지 않으므로 늘어날 요소가 없고, 언어 줄이 제목 바로 아래에 온다.

![그리드 줄 높이와 언어 줄 위치](./images/github-pinned-card-size-grid.svg '수정 전에는 줄마다 높이가 달랐고 설명 없는 카드만 언어 줄이 위쪽에 있었다')

## 선택한 방법과 제외한 방법

| 방법                                                                                                          | 장점                                     | 단점                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 카드에 고정 높이(`height: 140px`)                                                                             | 한 줄 수정                               | 글자 크기·창 폭이 바뀌면 넘치거나 비고, 값을 계속 조정해야 한다         |
| JS로 가장 높은 카드를 측정해 모두에 적용                                                                      | 어떤 내용이든 맞는다                     | 창 크기가 바뀔 때마다 다시 측정해야 하고, 첫 렌더링에서 깜빡임이 생긴다 |
| [`subgrid`](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid)로 카드 내부 줄까지 정렬 | 제목·설명·언어 줄 위치가 칸마다 정렬된다 | 이 문제에 비해 구조가 복잡하다                                          |
| **`grid-auto-rows: 1fr` + 세 줄 말줄임 + `margin-top: auto`**                                                 | CSS 세 곳, 내용에 따라 자동으로 맞춰진다 | 가장 높은 카드에 모두 맞추므로, 세 줄 제한이 반드시 필요하다            |

마지막을 선택했다. `1fr` 줄은 남는 공간을 모든 줄에 같은 비율로 나누므로 결국 가장 높은 카드에 맞춰진다. 그래서 설명 하나가 매우 길면 모든 카드가 함께 커진다. 이것을 세 줄 말줄임으로 막는다.

## 구현

`Github.css` 14줄, `Github.tsx` 6줄을 수정했다([#81](https://github.com/hyeoniverse/MacFolio/pull/81)).

```css
.gh-pinned ul {
	/* 모든 카드를 가장 높은 카드에 맞춘다 (줄마다 높이가 달라지지 않게) */
	grid-auto-rows: 1fr;
}

.gh-repo-description {
	/* 긴 설명은 세 줄까지 (카드 높이가 설명 하나 때문에 모두 커지지 않게) */
	display: -webkit-box;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 3;
	line-clamp: 3;
}

/* 언어·별·데모 줄은 설명이 짧거나 없어도 카드 아래에 */
.gh-repo-meta {
	margin-top: auto;
}
```

- `flex: 1`을 삭제하고 `margin-top: auto`를 언어 줄에 지정했다. 늘어나는 요소를 "없을 수도 있는 설명"에서 "항상 있는 언어 줄 위의 여백"으로 바꾼 것이다. 이제 설명이 없어도 언어 줄이 카드 아래쪽에 배치된다.
- 세 줄 말줄임은 표준 [`line-clamp`](https://developer.mozilla.org/ko/docs/Web/CSS/line-clamp)만으로는 동작하지 않는 브라우저가 있어서 `-webkit-box` 방식을 함께 쓴다. GitHub의 Pinned도 긴 설명을 잘라 표시한다.
- 잘린 설명 전체를 확인할 수 있도록 `<p>`에 `title={repo.description}`을 추가했다. 마우스를 올리면 전체 설명이 툴팁으로 표시된다.

## 확인

E2E `e2e/github.spec.ts`에 "고정 저장소 카드는 설명 길이와 상관없이 크기가 같고, 언어 줄은 카드 아래에 붙는다"를 추가했다. 스냅샷으로 다섯 카드를 렌더링한 뒤 모든 카드의 높이와, 카드 아래 끝에서 언어 줄 아래 끝까지의 거리를 측정한다.

```ts
const boxes = await cards.evaluateAll((elements) =>
	elements.map((element) => {
		const card = element.getBoundingClientRect();
		const meta = element.querySelector('.gh-repo-meta')!.getBoundingClientRect();
		return { height: Math.round(card.height), metaGap: Math.round(card.bottom - meta.bottom) };
	})
);
expect(new Set(boxes.map((box) => box.height)).size).toBe(1);
expect(new Set(boxes.map((box) => box.metaGap)).size).toBe(1);
```

값을 `Set`에 넣어 크기가 1인지 확인한다. 높이의 절대값은 글꼴과 창 크기에 따라 달라지므로 검사하지 않고, "모두 같은가"만 검사한다. 수정 전 CSS로 실행하면 높이 값이 두 가지 이상 나와 실패한다.

## 남은 것·배운 것

- `title` 툴팁은 마우스가 없는 휴대폰에서는 표시되지 않는다. 휴대폰에서 잘린 설명 전체를 보려면 저장소 페이지로 이동해야 한다.
- 세 줄을 넘는 설명이 없으면 카드가 그만큼 낮아진다. 카드 크기는 항상 "현재 카드 중 가장 높은 카드"다.
- 그리드의 줄 높이는 줄마다 독립적으로 계산된다는 점을 놓치기 쉽다. 모든 칸의 카드 높이를 맞추려면 `grid-auto-rows`를 지정하고, 긴 내용 하나가 전체 높이를 키우지 않도록 말줄임을 적용한다.
- 레이아웃을 검사하는 시험은 절대값 대신 "같다"를 검사해야 글꼴·창 크기 변화에도 안정적이다.

## 관련 글

- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)
- [토큰 없이 github.com HTML 조각을 서버에서 파싱하는 기여 달력](/memo/github-activity)
- [시간이 바뀔 때 움찔하던 메뉴 막대](/memo/menubar-clock-width): 같은 시기의 레이아웃 고정 수정

#MacFolio #GitHub #CSS
