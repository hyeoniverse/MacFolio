---
title: 메모 칸 너비 조절 — 그리드 칸을 차지하지 않는 손잡이 두 개
date: 2026-10-12
category: 개발기/MacFolio/프론트엔드
summary: 고정 너비였던 메모 앱의 사이드바·글 목록 경계에 손잡이를 두어 끌기·키보드·두 번 누르기로 너비를 바꾸게 했다. 손잡이는 절대 위치라 그리드 칸을 차지하지 않고, 본문 360px을 남기며, 너비는 브라우저에 저장한다.
---

macOS 메모 앱은 사이드바·목록·본문 사이의 경계를 끌어 각 칸의 너비를 바꿀 수 있다. MacFolio의 메모 앱은 사이드바를 `13rem`(208px), 글 목록을 `17rem`(272px)으로 고정해 두었다.

## 배경

이 블로그의 분류는 `개발기 › MacFolio › 프론트엔드`처럼 3단계까지 내려간다. 사이드바 208px 안에서는 들여쓰기와 개수 표시를 빼면 폴더 이름이 들어갈 자리가 얼마 남지 않아, 깊은 폴더 이름이 말줄임표로 잘렸다. 글 목록도 마찬가지다. 이 블로그 글 제목은 "메모 칸 너비 조절 — 그리드 칸을 차지하지 않는 손잡이 두 개"처럼 대개 길어서, 272px 목록에서는 앞부분만 보였다.

재현은 간단했다. 넓은 모니터에서 메모 앱 창을 최대로 키워도 늘어나는 것은 본문뿐이고, 사이드바와 목록은 그대로였다. 화면이 넓을수록 본문만 지나치게 넓어지고 왼쪽 두 칸은 여전히 잘렸다. 반대로 노트북 화면에서는 사이드바를 줄이고 본문을 넓게 쓰고 싶은데 그럴 방법이 없었다.

## 무엇이 바뀌었나

- 사이드바와 목록 사이, 목록과 본문 사이 경계에 손잡이가 있다. 가리키면 커서가 `↔`(col-resize)로 바뀌고, 끌면 왼쪽 칸이 넓어지거나 좁아진다.
- 너비 범위는 사이드바 180~360px, 목록 220~440px이다. 범위 안이라도 본문은 최소 360px을 남긴다.
- 손잡이를 두 번 누르면 그 칸의 기본 너비로 돌아간다.
- 키보드로도 조절한다. 손잡이에 포커스를 두고 ←·→로 8px씩, Shift를 함께 누르면 32px씩, Home·End로 가장 좁게·넓게 바꾼다.
- 조절한 너비는 브라우저에 남아, 메모 앱을 다시 열어도 유지된다.
- 칸이 없으면 손잡이도 없다. 사이드바를 가리면 사이드바 손잡이가, 갤러리로 보면 목록 손잡이가 사라진다. 한 칸씩 보는 화면(휴대폰, 700px 이하의 좁은 창)에는 둘 다 없다.

처음([PR #219](https://github.com/hyeoniverse/MacFolio/pull/219)의 첫 커밋)에는 사이드바 경계만 `SidebarResizer`로 만들었다. 써 보니 목록 쪽도 같은 이유로 잘려서, 두 번째 커밋에서 컴포넌트를 `PaneResizer`로 이름을 바꾸고 `pane` 값(`'sidebar' | 'list'`)으로 두 칸을 함께 다루게 했다.

## 손잡이를 어디에 둘까

메모 화면은 CSS 그리드 세 칸(사이드바 · 목록 · 본문)이다. 손잡이를 넣는 방법은 몇 가지가 있었다.

| 방법                                       | 좋은 점                       | 문제                                                                                                       |
| ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 그리드에 손잡이용 좁은 칸을 더한다         | 위치를 따로 계산하지 않는다   | 칸이 3개에서 5개로 늘어, 사이드바 여닫기·갤러리·한 칸 보기의 `grid-template-columns`를 모두 다시 써야 한다 |
| 칸 요소에 CSS `resize: horizontal`         | 코드가 거의 없다              | 오른쪽 아래 모서리에서만 잡히고, 키보드로 조절할 수 없고, 범위·저장을 다루기 어렵다                        |
| 절대 위치 손잡이를 경계 위에 띄운다 (고름) | 기존 세 칸 배치를 그대로 둔다 | 위치를 칸 너비 변수로 계산해야 한다                                                                        |

세 번째를 골랐다. 절대 위치인 자식은 그리드 칸을 차지하지 않으므로, 기존 배치 규칙을 하나도 건드리지 않고 경계 위에 띄울 수 있다.

## 구조

![손잡이는 그리드 칸이 아니라 경계 위에 떠 있다](./images/memo-pane-resize-layout.svg '두 칸의 너비는 CSS 변수, 손잡이는 그 경계 위치에 절대 위치로 놓는다')

앞의 두 칸 너비를 고정값 대신 CSS 변수 `--memo-sidebar-width`·`--memo-list-width`로 바꾸고, React 상태의 너비를 `style`로 넣는다. 본문 칸은 `minmax(0, 1fr)`로 남은 너비를 받는다. 손잡이 위치도 같은 변수로 정한다(`styles/theme.css`).

```css
.memo-pane-resizer {
	position: absolute;
	top: 0;
	bottom: 0;
	z-index: 5;
	width: 12px;
	cursor: col-resize;
}
.memo-pane-resizer-sidebar {
	left: calc(var(--memo-sidebar-width) - 4px);
}
.memo-pane-resizer-list {
	left: calc(var(--memo-sidebar-column) + var(--memo-list-width) - 6px);
}
```

`--memo-sidebar-column`은 사이드바 칸이 실제로 차지하는 너비다. 평소에는 사이드바 너비와 같고, 사이드바를 가리면 `0px`이 된다. 그래서 사이드바를 가려도 목록 손잡이가 목록 오른쪽 경계를 따라간다. 사이드바 여닫기 애니메이션도 이 변수 하나를 바꾸는 것으로 처리한다.

손잡이는 너비 12px의 띠라서, 경계선을 정확히 겨누지 않아도 잡힌다. 손잡이를 그릴지는 `Memo.tsx`가 정한다. 사이드바 손잡이는 `sidebarOpen && !compact`, 목록 손잡이는 `view === 'list' && !compact`일 때만 그린다.

## 보이는 모양

처음에는 가리키면 강조색 세로선이 나타나게 했지만, 메모 화면의 다른 요소와 어울리지 않았다. macOS 메모도 경계를 가리킬 때 선을 그리지 않고 커서만 바꾼다. 그래서 두 번째 커밋에서 강조선을 없앴다. 지금은 가리켜도 아무것도 그리지 않고 커서만 바뀐다. 키보드로 포커스했을 때만 `::after`의 2px 회색 선을 `opacity: 0.6`으로 보여, 키보드 사용자가 손잡이 위치를 알 수 있게 했다.

## 끄는 동안의 처리

![pointerdown에서 pointerup·pointercancel까지](./images/memo-pane-resize-drag-flow.svg '끄는 동안은 상태만 바꾸고, 손을 뗄 때 한 번 저장한다')

`PaneResizer.tsx`는 포인터 이벤트 네 개로 끌기를 다룬다.

```tsx
onPointerDown={(event) => {
	if (event.button !== 0) return;
	event.preventDefault();
	event.currentTarget.setPointerCapture(event.pointerId);
	drag.current = { startX: event.clientX, startWidth: width, width, max: roomFor() };
	onDraggingChange(true);
}}
onPointerMove={(event) => {
	const state = drag.current;
	if (!state) return;
	state.width = fit(state.startWidth + event.clientX - state.startX, state.max);
	onResize(state.width);
}}
```

- **포인터 캡처**: 누를 때 `setPointerCapture`를 걸어, 빠르게 끌어 포인터가 손잡이 밖으로 나가도 계속 이벤트를 받는다. 마우스·터치펜·터치를 같은 코드로 다룬다. 왼쪽 버튼이 아니면(`event.button !== 0`) 무시한다.
- **본문 최소 너비**: 누르는 순간 창 너비에서 다른 칸 너비와 본문 최소 너비를 빼서 이번 끌기의 최대 너비를 정한다. 넓은 창에서는 칸마다 정한 최대값이 먼저 걸린다.

  ```ts
  const READER_MIN = 360;
  const roomFor = (others: number) => () => (memoRef.current?.clientWidth ?? Infinity) - others - READER_MIN;
  ```

  최대값을 누를 때 한 번만 계산하는 것은, 끄는 동안 다른 칸 너비가 바뀌지 않기 때문이다. 매번 레이아웃을 읽지 않아도 된다.

- **애니메이션 끄기**: 사이드바를 여닫을 때 칸 너비가 부드럽게 바뀌도록 `transition: grid-template-columns`가 걸려 있다. 끄는 동안에도 이것이 걸리면 칸이 손보다 늦게 따라온다. 끄는 동안은 그리드에 `data-resizing`을 달아 transition을 끄고, 커서를 `col-resize`로 고정하고 글자 선택을 막는다. 커서를 그리드 전체에 거는 것은, 빠르게 끌 때 포인터가 손잡이를 벗어나 본문 위로 가도 커서가 텍스트 커서로 바뀌지 않게 하려는 것이다.
- **저장 시점**: 끄는 동안에는 `onResize`로 화면만 바꾸고, 손을 뗄 때 `onCommit`으로 한 번 저장한다. 끌기가 취소되면(`pointercancel`) 처음 너비로 돌린다. 키보드와 두 번 누르기는 한 번에 끝나는 동작이라 `onResize`와 `onCommit`을 같이 부른다.

## 저장

너비는 `localStorage`의 `macfolio:memo:sidebar-width`·`macfolio:memo:list-width`에 숫자로 남긴다(`memoStorage.ts`).

```ts
export const PANE_WIDTHS = {
	sidebar: { min: 180, max: 360, initial: 208, key: STORAGE_KEYS.memoSidebarWidth },
	list: { min: 220, max: 440, initial: 272, key: STORAGE_KEYS.memoListWidth },
};

export function savePaneWidth(pane: ResizablePane, width: number) {
	if (width === PANE_WIDTHS[pane].initial) removeKey(PANE_WIDTHS[pane].key);
	else writeString(PANE_WIDTHS[pane].key, String(width));
}
```

읽을 때 숫자가 아니면 기본값으로, 범위 밖이면 범위 안으로 맞춘다. 저장된 값은 사람이 개발자 도구에서 고칠 수도 있고, 나중에 범위를 바꿀 수도 있어서 읽는 쪽에서 한 번 더 거른다. 기본 너비로 돌아오면 값을 지워, 휴지통의 '내 브라우저 데이터'에 쓸데없이 남지 않게 했다. 두 키는 `bin/siteStorage.ts`의 '메모 보기 설정' 항목에 함께 묶어, 거기서 지우면 정렬 기준과 함께 처음 상태로 돌아간다.

## 접근성

손잡이는 `role="separator"`와 `aria-orientation="vertical"`, 현재·최소·최대 너비(`aria-valuenow`·`aria-valuemin`·`aria-valuemax`)를 가진다. 이름은 각각 "사이드바 너비", "목록 너비"다. 포커스할 수 있는 separator는 화면 읽기 프로그램에서 "조절 가능한 분할선"으로 읽히고, 값이 바뀌면 새 너비를 알린다. `title`에는 "끌어서 너비 조절 (두 번 누르면 기본 너비)"를 적어 마우스 사용자에게도 두 번 누르기를 알렸다.

## 확인

- 단위 시험 `memoStorage.test.ts`: "칸 너비: 저장한 값을 읽고, 없거나 잘못되면 기본값, 범위 밖이면 범위 안으로"는 `'wide'`를 넣으면 기본값, `'10'`을 넣으면 최소값이 나오는지 본다. "칸 너비를 기본값으로 되돌리면 저장한 값을 지운다"는 기본 너비 저장이 키를 지우는지 본다.
- E2E `e2e/memo.spec.ts`의 "칸 너비: 사이드바와 목록의 경계를 끌어 바꾸고, 키보드로도 바꾸고, 다시 열어도 남는다"는 두 손잡이를 역할과 이름(`separator`, "사이드바 너비"·"목록 너비")으로 찾아 끌고, 키보드로 줄이고, 메모 앱을 닫았다 다시 열어 `aria-valuenow`가 사이드바 180, 목록 244로 남는지 본다. 목록 손잡이를 두 번 누르면 272로 돌아오는지, 사이드바를 가리면 사이드바 손잡이만 사라지는지도 확인한다.
- PR #219의 두 커밋을 합쳐 바뀐 코드는 `Memo.css`·`Memo.tsx`·`PaneResizer.tsx`(101줄)·`memoStorage.ts`와 시험 두 파일이다.

## 남은 것·배운 것

- 손잡이는 한 칸 보기(700px 이하)에서는 없다. 좁은 창에서는 칸을 줄일 여유가 없어서다.
- 창을 줄여 본문이 360px보다 좁아질 때 저장된 너비를 자동으로 줄이지는 않는다. 끌기를 시작할 때만 본문 최소 너비를 따진다.
- 그리드에 겹쳐 띄울 요소는 `position: absolute`로 두면 칸 계산에서 빠진다. 이번처럼 기존 배치 규칙이 여러 화면 상태로 나뉘어 있을 때 특히 쓸모가 있었다.
- 끌기 같은 연속 동작은 "화면 반영"과 "저장"을 나누면 저장 횟수가 끌기 한 번에 한 번으로 준다.

## 관련 글

- [메모 앱 태그](/memo/memo-tags)
- [최근 삭제된 항목](/memo/memo-recently-deleted)
- [메모 다듬기](/memo/notes-polish)

#MacFolio #메모앱 #CSS #React
