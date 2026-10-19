---
title: 들쭉날쭉하던 고정 저장소 카드
date: 2026-10-03
category: 개발기/MacFolio/프론트엔드
summary: GitHub 앱의 Pinned 카드가 설명 길이에 따라 줄마다 높이가 달랐고, 설명 없는 카드는 언어 줄이 위에 떠 있었다. grid-auto-rows: 1fr, 세 줄 자르기, margin-top: auto 세 줄로 모든 카드를 같은 크기로 맞추고 E2E로 높이를 잰다.
---

## 배경

GitHub 앱의 Pinned는 두 칸 그리드다. [서버가 받은 저장소](/memo/github-live-profile)를 보여 주게 바꾼 날, 화면을 보니 카드 높이가 줄마다 달랐다. 실제 GitHub의 설명은 없거나 한 줄이거나 아주 길었다.

![Pinned 카드 전후](./images/github-pinned-card-size.jpg '위: 줄마다 높이가 다름 / 아래: 모든 카드가 같은 크기')

보인 증상은 둘이었다.

1. 설명이 긴 저장소가 있는 줄은 높고, 다른 줄은 낮았다. 그리드가 엇갈린 벽돌처럼 보였다.
2. 설명이 없는 카드는 언어·별·데모 줄이 제목 바로 밑에 붙어서, 카드 아래쪽이 비어 보였다.

재현은 앱에 넣어 둔 스냅샷으로 된다. 스냅샷에는 설명이 없는 카드, 한 줄짜리, 아주 긴 설명이 섞여 있다. 서버 없이 GitHub 앱을 열면 바로 보인다.

## 원인 분석

카드(`.gh-repo`)는 세로 flex였고, 설명 문단에 `flex: 1`을 줘서 남는 높이를 설명이 차지하게 해 두었다.

```css
/* Github.css (고치기 전) */
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

- **줄마다 다른 높이**: 그리드의 줄 높이는 기본값(`grid-auto-rows: auto`)이라 그 줄에 든 카드 중 가장 높은 것에 맞는다. 같은 줄의 두 카드는 높이가 같지만, 다른 줄과는 상관이 없다.
- **떠 있는 언어 줄**: `flex: 1`은 설명이 있을 때만 동작한다. 설명이 없으면 `<p>` 자체를 그리지 않으니 늘어날 요소가 없고, 언어 줄이 제목 바로 밑에 온다.

![그리드 줄 높이와 언어 줄 자리](./images/github-pinned-card-size-grid.svg '전에는 줄마다 높이가 따로였고 설명 없는 카드만 언어 줄이 떠 있었다')

## 고른 방법과 버린 방법

| 방법                                                          | 좋은 점                                | 걸리는 점                                                    |
| ------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| 카드에 고정 높이(`height: 140px`)                             | 한 줄                                  | 글자 크기·창 폭이 바뀌면 넘치거나 비고, 숫자를 맞춰야 한다   |
| JS로 가장 높은 카드를 재서 모두에 높이                        | 어떤 내용이든 맞는다                   | 창 크기가 바뀔 때마다 다시 재야 하고, 첫 그리기에서 깜빡인다 |
| `subgrid`로 카드 안의 줄까지 맞추기                           | 제목·설명·언어 줄 자리가 칸마다 맞는다 | 이 정도 문제에 구조가 무겁다                                 |
| **`grid-auto-rows: 1fr` + 세 줄 자르기 + `margin-top: auto`** | CSS 세 군데, 내용에 따라 알아서 맞는다 | 가장 높은 카드에 모두 맞추니, 세 줄 제한이 꼭 필요하다       |

마지막을 골랐다. `1fr` 줄은 모든 줄을 같은 몫으로 나누므로 결국 가장 높은 카드에 맞춰진다. 그래서 설명 하나가 아주 길면 모든 카드가 함께 커진다. 이것을 세 줄 자르기로 막는다.

## 구현

`Github.css` 14줄, `Github.tsx` 6줄을 고쳤다([#81](https://github.com/hyeoniverse/MacFolio/pull/81)).

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

- `flex: 1`을 지우고 `margin-top: auto`를 언어 줄로 옮겼다. 늘어나는 쪽을 "있을 수도 없을 수도 있는 설명"에서 "늘 있는 언어 줄 위의 빈칸"으로 바꾼 것이다. 이제 설명이 없어도 언어 줄이 아래에 붙는다.
- 세 줄 자르기는 아직 표준 `line-clamp`만으로는 되지 않는 브라우저가 있어서 `-webkit-box` 방식을 함께 쓴다. GitHub의 Pinned도 긴 설명을 자른다.
- 잘린 설명을 다 볼 수 있게 `<p>`에 `title={repo.description}`을 달았다. 마우스를 올리면 전체 설명이 뜬다.

## 확인

E2E `e2e/github.spec.ts`에 "고정 저장소 카드는 설명 길이와 상관없이 크기가 같고, 언어 줄은 카드 아래에 붙는다"를 더했다. 스냅샷으로 다섯 카드를 그린 뒤 모든 카드의 높이와, 카드 아래 끝에서 언어 줄 아래 끝까지의 거리를 잰다.

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

값을 `Set`에 넣어 크기가 1인지 본다. 높이가 몇 px인지는 글꼴과 창에 따라 달라지니 묻지 않고, "모두 같은가"만 묻는다. 고치기 전 CSS로 돌리면 높이가 두 가지 이상 나와 실패한다.

## 남은 것·배운 것

- `title` 말풍선은 마우스가 없는 휴대폰에서는 볼 수 없다. 거기서 잘린 설명을 끝까지 보려면 저장소로 들어가야 한다.
- 세 줄을 넘는 설명이 하나도 없으면 카드가 그만큼 낮아진다. 카드 크기는 늘 "지금 있는 카드 중 가장 높은 것"이다.
- 그리드의 줄 높이는 줄마다 따로라는 것을 잊기 쉽다. 같은 칸의 카드를 맞추려면 `grid-auto-rows`를 정하고, 하나의 긴 내용이 전체를 키우지 않게 잘라 둔다.
- 화면 모양을 지키는 시험은 숫자 대신 "같다"를 묻는 편이 오래 간다.

## 관련 글

- [GitHub 앱을 진짜 GitHub로](/memo/github-live-profile)
- [GitHub 앱에 잔디와 활동 기록 더하기](/memo/github-activity)
- [메뉴 막대 시계 칸 너비 고정](/memo/menubar-clock-width)

#MacFolio #GitHub #CSS
