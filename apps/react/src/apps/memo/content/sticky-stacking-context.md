---
title: sticky 도구 막대가 버튼을 가린 이유
date: 2026-09-29
category: 개발 기록/MacFolio/스타일·컴포넌트
summary: 메모 도구 막대에 position sticky를 적용하자 버튼이 표시되는데도 클릭되지 않았다. sticky가 생성한 쌓임 맥락 때문에 z-index 4가 창 끌기 영역(3) 아래에 놓였고, 도구 막대 대신 그 아래 영역만 스크롤하도록 바꿔 해결했다.
---

메모 앱을 macOS 메모처럼 도구 막대 중심으로 바꾸면서, 글을 스크롤해도 도구 막대가 위에 고정되도록 [`position: sticky`](https://developer.mozilla.org/en-US/docs/Web/CSS/position)를 적용했다. 그 결과 버튼은 화면에 정상적으로 표시되지만 클릭해도 반응하지 않았다.

## 배경과 증상

2026년 9월 말([#33](https://github.com/hyeoniverse/MacFolio/pull/33)), 메모 화면을 macOS 메모처럼 다시 구성했다. 그전에는 사이드바 여닫기 버튼과 목록/갤러리 전환 버튼을 창 위에 절대 위치(`position: absolute`)로 배치했는데, 이번에는 이 버튼들을 신호등 버튼과 같은 높이의 도구 막대에 나란히 배치했다. 글을 길게 스크롤해도 도구 막대는 위에 고정되어야 했고, 처음 적용한 방법은 도구 막대에 `position: sticky; top: 0`을 지정하는 것이었다.

증상은 다음과 같다.

- 도구 막대의 버튼(사이드바 여닫기, 목록/갤러리 전환)이 화면에 표시된다.
- 포인터를 올려도 hover 색이 바뀌지 않고, 클릭해도 반응이 없다.
- 대신 그 위치를 끌면 창이 이동한다.

마지막 증상이 단서였다. 버튼 위치에서 창이 끌린다면, 포인터 이벤트가 버튼이 아니라 창 끌기 영역(`.macos-titlebar`)으로 전달된다는 뜻이다.

## 창 위를 덮는 끌기 영역

제목 표시줄이 없는 창(Safari, 메모처럼 도구 막대와 제목 표시줄이 합쳐진 형태)은 투명한 끌기 영역을 내용 위에 배치한다. 이 영역에 신호등 버튼이 들어 있고, 사용자는 이 영역을 끌어 창을 이동한다.

```css
.container.unified .macos-titlebar {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 3;
	height: 52px;
	background: none;
}
```

끌기 영역은 창 너비 전체를 덮으므로, 같은 높이에 있는 도구 막대 버튼은 그보다 위에 쌓여야 클릭을 수신한다. 그래서 버튼마다 `z-index: 4`를 지정했다.

```css
.memo-tool {
	position: relative;
	z-index: 4;
}
```

![메모 앱의 도구 막대](./images/memo-toolbar.jpg '메모의 도구 막대. 신호등 버튼이 있는 윗줄 전체가 창 끌기 영역과 겹친다')

## z-index 4가 3보다 아래에 있었다

sticky를 적용하자 도구 막대가 새 **[쌓임 맥락(stacking context)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)**[^1]을 생성했다. 쌓임 맥락 안의 z-index는 그 맥락 안에서만 순서를 정한다. 버튼의 4는 도구 막대 안에서의 순서일 뿐이고, 창 기준으로는 도구 막대 전체가 z-index가 `auto`인 하나의 단위로 비교되어 끌기 영역(3) 아래에 놓였다.

```text
창
├─ 끌기 영역            z-index 3
└─ 도구 막대 (sticky)   쌓임 맥락 → 창 안에서는 auto
   └─ 버튼             z-index 4, 도구 막대 안에서만 의미 있음
```

버튼의 z-index 값을 키워도 결과는 같다. 순서 비교는 버튼과 끌기 영역이 아니라 도구 막대와 끌기 영역 사이에서 일어난다.

![쌓임 맥락 안에 갇힌 버튼](./images/stacking-context.svg '버튼의 z-index 4는 도구 막대 안에서만 통한다')

## 검토한 방법

| 방법                                            | 결과                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| 버튼의 z-index를 더 키운다 (4 → 100)            | 효과 없음. 비교 대상은 버튼이 아니라 도구 막대 전체다                            |
| sticky 도구 막대 자체에 z-index 4를 지정한다    | 버튼은 동작하지만, 막대가 끌기 영역 전체를 덮어 빈 곳을 끌어 창을 이동할 수 없다 |
| 끌기 영역에 `pointer-events: none`              | 버튼은 동작하지만 창을 끌 수 없다                                                |
| 도구 막대는 고정하고, 그 아래 영역만 스크롤한다 | 쌓임 맥락이 생기지 않는다. 버튼이 동작하고 빈 곳을 끌어 창도 이동한다            |

앞의 세 방법은 모두 "버튼 클릭"과 "창 끌기" 중 하나를 포기한다. 마지막 방법만 둘 다 유지한다. macOS 메모도 도구 막대는 고정되어 있고 아래 목록만 스크롤하므로 동작도 일치한다.

## 스크롤 컨테이너를 도구 막대 아래로 이동

도구 막대에 sticky를 적용하는 대신, 목록·본문·갤러리 화면을 세로 flex 컨테이너로 바꾸고 도구 막대 아래의 `.memo-scroll`만 스크롤하도록 했다.

```css
.memo-list,
.memo-reader,
.memo-gallery {
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.memo-scroll {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
}
```

도구 막대가 쌓임 맥락을 생성하지 않으므로 버튼의 z-index 4가 다시 창 기준으로 비교된다. 도구 막대 안의 검색 칸도 스크롤 위치와 무관하게 같은 좌표에 유지된다.

![sticky 도구 막대 구조와, 도구 막대를 두고 아래만 스크롤하는 구조 비교](./images/sticky-stacking-context-scroll-area.svg '스크롤 상자를 도구 막대 아래로 옮겼다')

여기서 `min-height: 0`은 필수다. flex 자식의 기본 [`min-height`](https://developer.mozilla.org/en-US/docs/Web/CSS/min-height)는 `auto`라서, 내용이 길면 `.memo-scroll`이 내용 높이만큼 늘어나 스크롤 막대가 생기지 않고 창 밖으로 넘친다.

| `.memo-scroll`의 `min-height` | 내용이 창보다 긴 경우                          |
| ----------------------------- | ---------------------------------------------- |
| `auto` (기본값)               | 내용 높이만큼 늘어나 창 밖으로 넘친다          |
| `0`                           | 남은 높이로 제한되고 세로 스크롤 막대가 생긴다 |

이 결정은 `apps/react/src/apps/memo/styles/toolbar.css`에 주석으로 기록했다. 이후 도구 막대에 다시 sticky를 적용하는 변경을 막기 위한 주석이다.

```css
/* 목록·본문·갤러리: 위에 도구 막대, 그 아래만 스크롤한다.
   (도구 막대를 sticky로 붙이면 새 쌓임 맥락이 생겨 버튼이 창 끌기 영역 아래로 깔린다) */
```

## 확인

- Playwright의 `click()`은 클릭 전에 [actionability 검사](https://playwright.dev/docs/actionability)를 수행해, 해당 좌표에서 이벤트를 수신하는 요소가 대상 요소인지 확인한다. 다른 요소가 덮고 있으면 제한 시간까지 재시도한 뒤 실패한다. 따라서 `e2e/memo.spec.ts`에서 도구 막대 버튼을 클릭하는 시험(`사이드바를 여닫을 수 있다`, 목록/갤러리 전환)이 통과하면, 버튼이 다른 요소에 덮이지 않았다는 사실도 함께 확인된다.

## 쌓임 맥락을 생성하는 속성

z-index가 예상과 다르게 동작하면, 조상 요소 중 쌓임 맥락을 생성하는 요소가 있는지부터 확인한다.

<details>
<summary>쌓임 맥락을 생성하는 주요 속성</summary>

- `position: sticky` 또는 `fixed`
- `position: relative`/`absolute`이면서 z-index가 `auto`가 아닌 것
- `opacity`가 1보다 작은 것
- `transform`, `filter`, `backdrop-filter`
- `isolation: isolate`, `will-change`, `contain`

전체 목록은 MDN의 [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context) 문서에 있다.

</details>

브라우저 개발자 도구의 3D 보기나 레이어 보기로 쌓인 순서를 확인할 수 있다.

## 배운 것

- z-index는 "전역 순위"가 아니다. 같은 쌓임 맥락 안에서만 비교된다. 값을 키워도 순서가 바뀌지 않으면 값이 아니라 조상 요소를 확인한다.
- "표시되지만 클릭되지 않는다"는 증상은 대부분 다른 요소가 위를 덮고 있다는 뜻이다. [`document.elementFromPoint(x, y)`](https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint)로 그 좌표에서 이벤트를 수신하는 요소를 먼저 확인하면 원인을 빨리 찾는다.
- 이런 함정은 수정한 위치에 이유를 주석으로 남긴다. 코드만 보면 sticky가 더 간단한 방법으로 보이기 때문이다.

이후 화면 전체의 z-index를 이름으로 정리한 작업([z-index 숫자에 이름 붙이기](/memo/z-index-layers))에도 같은 원칙을 적용했다. 이름을 붙여도 쌓임 맥락 안의 값은 맥락 밖의 값과 비교되지 않는다.

## 관련 글

- 화면 전체의 겹침 순서를 이름으로 정리한 작업: [z-index 숫자에 이름 붙이기 — 화면 전체의 겹침 순서를 한 표로](/memo/z-index-layers)
- 같은 날의 작업 기록: [9월 29일 - Safari 포트폴리오, 그리고 첫 API와 관리자 로그인](/memo/day-0929)
- 메모 CSS를 분할하면서 이 주석을 옮긴 작업: [4,600줄 Memo.css를 열다섯 파일로](/memo/memo-css-split)
- PR: [#33](https://github.com/hyeoniverse/MacFolio/pull/33)

[^1]: 쌓임 맥락: 자식 요소의 z-index를 서로 비교하는 범위. 맥락 안의 요소는 맥락 밖의 요소와 직접 비교되지 않고, 맥락을 생성한 요소 하나의 순서를 따른다.

#MacFolio #메모앱 #CSS #트러블슈팅
