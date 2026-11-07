---
title: grid-auto-rows 1fr와 line-clamp, margin-top auto로 카드 높이 맞추기
date: 2026-10-03
category: 개발 기록/MacFolio/화면·스타일
series: GitHub 앱
seriesOrder: 2
summary: GitHub 앱의 Pinned 카드가 설명 길이에 따라 줄마다 높이가 달랐고, 설명 없는 카드는 언어 줄이 위쪽에 배치됐다. grid-auto-rows: 1fr, 세 줄 말줄임, margin-top: auto 세 가지 CSS로 모든 카드를 같은 크기로 맞추고 E2E로 높이를 측정한다.
---

## 배경

### Pinned 카드

GitHub 프로필 첫 화면에는 사용자가 고정(pin)한 저장소가 최대 여섯 개 카드로 표시된다. 카드마다 저장소 이름, 설명, 주 언어(색 점), 별 수가 들어간다. MacFolio의 GitHub 앱도 같은 구성의 Pinned 영역을 2열 그리드로 보여 준다. [서버가 조회한 저장소](/memo/github-live-profile)를 표시하도록 바꾼 다음 날, 카드 높이가 줄마다 다르게 렌더링됐다. 실제 GitHub의 저장소 설명은 없거나, 한 줄이거나, 매우 길었기 때문이다.

![Pinned 카드 전후](./images/github-pinned-card-size.jpg '위: 줄마다 높이가 다름 / 아래: 모든 카드가 같은 크기')

증상은 두 가지였다.

1. 설명이 긴 저장소가 있는 줄은 높고, 다른 줄은 낮았다. 그리드의 줄 높이가 일정하지 않았다.
2. 설명이 없는 카드는 언어·별·데모 줄이 제목 바로 아래에 배치되어, 카드 아래쪽이 비어 있었다.

앱에 포함된 스냅샷으로 재현할 수 있다. 스냅샷에는 설명이 없는 카드, 한 줄 설명, 매우 긴 설명이 섞여 있어서, 서버 없이 GitHub 앱을 열면 바로 확인된다. 10월 3일 아침, 전날 저장소를 서버에서 조회하도록 바꾼 뒤 처음 실제 데이터를 확인하다가 발견했다.

### 두 가지 CSS 레이아웃

이 문제에는 CSS 레이아웃 방식 두 가지가 관련된다.

| 방식                                                                                                 | 하는 일                                                          | 이 화면에서 쓰인 곳          |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| [CSS 그리드](https://developer.mozilla.org/ko/docs/Web/CSS/CSS_grid_layout)(`display: grid`)         | 요소를 가로 열과 세로 줄로 이루어진 격자의 칸에 배치한다         | 카드 목록(`.gh-pinned ul`)   |
| [플렉스박스](https://developer.mozilla.org/ko/docs/Web/CSS/CSS_flexible_box_layout)(`display: flex`) | 요소를 한 방향으로 늘어놓고, 남는 공간을 어느 요소에 줄지 정한다 | 카드 내부(제목·설명·언어 줄) |

그리드에서 열 개수와 폭은 `grid-template-columns`로 지정하고, 따로 지정하지 않은 줄의 높이는 `grid-auto-rows`가 결정한다. 플렉스박스에서는 `flex: 1`을 받은 요소가 남는 공간을 차지하고, `margin-top: auto`를 받은 요소는 위쪽 여백이 남는 공간을 모두 차지해 아래쪽으로 밀려난다.

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

- **줄마다 다른 높이**: 그리드의 줄 높이는 기본값([`grid-auto-rows: auto`](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows))이라 ==그 줄의 카드 중 가장 높은 카드에 맞춰진다==. 같은 줄의 두 카드는 높이가 같지만, 다른 줄과는 무관하다.
- **위쪽에 배치된 언어 줄**: `flex: 1`은 설명이 있을 때만 동작한다. 설명이 없으면 `<p>` 자체를 렌더링하지 않으므로 늘어날 요소가 없고, 언어 줄이 제목 바로 아래에 온다.

예를 들어 카드 A·B가 1줄, C·D가 2줄에 있고 내용 높이가 A 96px, B 132px, C 70px, D 96px이면 1줄은 132px, 2줄은 96px이 된다. 아래 그림의 왼쪽이 이 경우다.

![그리드 줄 높이와 언어 줄 위치](./images/github-pinned-card-size-grid.svg '수정 전에는 줄마다 높이가 달랐고 설명 없는 카드만 언어 줄이 위쪽에 있었다')

## 선택한 방법과 제외한 방법

| 방법                                                                                                          | 장점                                     | 단점                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| 카드에 고정 높이(`height: 140px`)                                                                             | 한 줄 수정                               | 글자 크기·창 폭이 바뀌면 넘치거나 비고, 값을 계속 조정해야 한다         |
| JS로 가장 높은 카드를 측정해 모두에 적용                                                                      | 어떤 내용이든 맞는다                     | 창 크기가 바뀔 때마다 다시 측정해야 하고, 첫 렌더링에서 깜빡임이 생긴다 |
| [`subgrid`](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid)로 카드 내부 줄까지 정렬 | 제목·설명·언어 줄 위치가 칸마다 정렬된다 | 이 문제에 비해 구조가 복잡하다                                          |
| **`grid-auto-rows: 1fr` + 세 줄 말줄임 + `margin-top: auto`**                                                 | CSS 세 곳, 내용에 따라 자동으로 맞춰진다 | 가장 높은 카드에 모두 맞추므로, 세 줄 제한이 반드시 필요하다            |

마지막을 선택했다. `fr`은 그리드의 남는 공간을 나누는 비율 단위다. 그리드 컨테이너의 높이를 따로 지정하지 않으면, 모든 줄을 `1fr`로 같게 만들 수 있는 가장 작은 높이, 즉 ==가장 높은 줄의 높이==가 모든 줄에 적용된다. 그래서 ==설명 하나가 매우 길면 모든 카드가 함께 커진다==. 이것을 세 줄 말줄임으로 막는다.

![auto, 1fr, 1fr과 세 줄 말줄임의 줄 높이 계산](./images/github-pinned-card-size-row-calc.svg '같은 카드 네 장도 auto에서는 줄마다 132·96px, 1fr에서는 모두 132px이 된다. 설명이 10줄인 카드가 있어도 세 줄에서 자르면 132px이 유지된다')

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

- `flex: 1`을 삭제하고 `margin-top: auto`를 언어 줄에 지정했다. 늘어나는 대상을 =="없을 수도 있는 설명"에서 "항상 있는 언어 줄 위의 여백"으로 바꿨다==. 이제 설명이 없어도 언어 줄이 카드 아래쪽에 배치된다.
  ![flex: 1과 margin-top: auto의 차이](./images/github-pinned-card-size-flex-space.svg '왼쪽: 설명이 없으면 늘어날 요소가 없어 언어 줄이 위에 남는다. 오른쪽: 언어 줄 위의 auto 여백이 남는 높이를 차지해 언어 줄이 항상 카드 아래에 붙는다')

- 세 줄 말줄임은 표준 [`line-clamp`](https://developer.mozilla.org/ko/docs/Web/CSS/line-clamp)만으로는 동작하지 않는 브라우저가 있어서 `-webkit-box` 방식을 함께 쓴다. `line-clamp: 3`은 블록을 세 줄까지만 표시하고, 넘치는 부분을 잘라 마지막 줄 끝에 말줄임표(…)를 붙인다. 예를 들어 설명이 다섯 줄이면 세 번째 줄 끝이 "…"로 끝나고 네·다섯째 줄은 표시되지 않는다. GitHub의 Pinned도 긴 설명을 잘라 표시한다.
- 잘린 설명 전체를 확인할 수 있도록 `<p>`에 `title={repo.description}`을 추가했다. 마우스를 올리면 전체 설명이 툴팁으로 표시된다.

## 확인

E2E(실제 브라우저로 화면을 열어 확인하는 종단 간 시험) `e2e/github.spec.ts`에 "고정 저장소 카드는 설명 길이와 상관없이 크기가 같고, 언어 줄은 카드 아래에 붙는다"를 추가했다. 스냅샷으로 다섯 카드를 렌더링한 뒤 [`getBoundingClientRect()`](https://developer.mozilla.org/ko/docs/Web/API/Element/getBoundingClientRect)로 모든 카드의 높이와, 카드 아래 끝에서 언어 줄 아래 끝까지의 거리를 측정한다. 이 함수는 요소가 화면에 그려진 위치와 크기(`top`·`bottom`·`height` 등)를 픽셀 단위로 반환한다.

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

> [!TIP] 절대값 대신 "같다"를 검사
> 값을 `Set`에 넣어 크기가 1인지 확인한다. 높이의 절대값은 글꼴과 창 크기에 따라 달라지므로 검사하지 않고, "모두 같은가"만 검사한다. 수정 전 CSS로 실행하면 높이 값이 두 가지 이상 나와 실패한다.

## 남은 것·배운 것

- `title` 툴팁은 마우스가 없는 휴대폰에서는 표시되지 않는다. 휴대폰에서 잘린 설명 전체를 보려면 저장소 페이지로 이동해야 한다.
- 세 줄을 넘는 설명이 없으면 카드가 그만큼 낮아진다. 카드 크기는 항상 "현재 카드 중 가장 높은 카드"다.
- 그리드의 줄 높이는 줄마다 독립적으로 계산된다는 점을 놓치기 쉽다. 모든 칸의 카드 높이를 맞추려면 `grid-auto-rows`를 지정하고, 긴 내용 하나가 전체 높이를 키우지 않도록 말줄임을 적용한다.
- 레이아웃을 검사하는 시험은 절대값 대신 "같다"를 검사해야 글꼴·창 크기 변화에도 안정적이다.

## 관련 글

- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)
- [토큰 없이 github.com HTML 조각을 서버에서 파싱하는 기여 달력](/memo/github-activity)
- [시간이 바뀔 때 움찔하던 메뉴 막대](/memo/menubar-clock-width): 같은 시기의 레이아웃 고정 수정

<details><summary>참고 문헌</summary>

- MDN, [grid-auto-rows](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-rows)
- MDN, [Basic concepts of grid layout: The fr unit](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Basic_concepts_of_grid_layout#the_fr_unit)
- MDN, [line-clamp](https://developer.mozilla.org/ko/docs/Web/CSS/line-clamp)
- MDN, [Aligning items in a flex container: Using auto margins](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Aligning_items_in_a_flex_container#using_auto_margins_for_main_axis_alignment)
- GitHub Docs, [Pinning items to your profile](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/pinning-items-to-your-profile)

</details>

#MacFolio #GitHub #CSS
