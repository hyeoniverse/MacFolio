---
title: 그리드 칸을 차지하지 않는 절대 위치 리사이즈 핸들로 칸 너비 조절하기
date: 2026-10-12
category: 개발 기록/MacFolio/화면·스타일
summary: 고정 너비였던 메모 앱의 사이드바·글 목록 경계에 리사이즈 핸들을 배치해 드래그·키보드·더블클릭으로 너비를 바꾸게 했다. 핸들은 절대 위치라 그리드 칸을 차지하지 않고, 본문 최소 360px을 확보하며, 너비는 브라우저에 저장한다.
---

macOS 메모 앱은 사이드바·목록·본문 사이의 경계를 드래그해 각 칸의 너비를 바꿀 수 있다. MacFolio의 메모 앱은 사이드바를 `13rem`(208px), 글 목록을 `17rem`(272px)으로 고정하고 있었다.

## 배경

이 블로그의 분류는 `개발기 › MacFolio › 프론트엔드`처럼 3단계까지 내려간다. 사이드바 208px에서 들여쓰기와 글 개수 표시를 제외하면 폴더 이름을 표시할 폭이 부족해, 깊은 폴더 이름이 말줄임표로 잘렸다. 글 목록도 마찬가지다. 이 블로그 글 제목은 "메모 칸 너비 조절 — 그리드 칸을 차지하지 않는 리사이즈 핸들 두 개"처럼 대개 길어서, 272px 목록에서는 앞부분만 표시됐다.

넓은 모니터에서 메모 앱 창을 최대로 키워도 늘어나는 칸은 본문뿐이고, 사이드바와 목록은 고정 폭이었다. 화면이 넓을수록 본문만 넓어지고 왼쪽 두 칸의 내용은 계속 잘렸다. 반대로 노트북 화면에서는 사이드바를 줄이고 본문을 넓게 쓸 방법이 없었다.

10월 12일 오후에 처음 구현한 대상은 사이드바 하나였다. 사이드바 경계만 드래그할 수 있게 구현한 뒤 사용해 보니, 긴 글 제목이 잘리는 글 목록도 같은 문제였다. 그래서 목록과 본문 사이 경계에도 핸들을 추가해 두 개로 늘렸다.

## 변경 내용

- 사이드바와 목록 사이, 목록과 본문 사이 경계에 리사이즈 핸들이 있다. 마우스를 올리면 커서가 `↔`(`col-resize`)로 바뀌고, 드래그하면 왼쪽 칸이 넓어지거나 좁아진다.
- 너비 범위는 사이드바 180~360px, 목록 220~440px이다. 범위 안이라도 본문은 최소 360px을 확보한다.
- 핸들을 더블클릭하면 그 칸의 기본 너비로 돌아간다.
- 키보드로도 조절한다.

  | 키            | 동작             |
  | ------------- | ---------------- |
  | ← · →         | 8px씩 조절       |
  | Shift + ← · → | 32px씩 조절      |
  | Home · End    | 최소 · 최대 너비 |

- 조절한 너비는 브라우저에 저장되어, 메모 앱을 다시 열어도 유지된다.
- 칸이 없으면 핸들도 없다. 사이드바를 숨기면 사이드바 핸들이, 갤러리 보기에서는 목록 핸들이 사라진다. 한 칸씩 전환하는 화면(휴대폰, 700px 이하의 좁은 창)에는 둘 다 없다.

![기본 너비와 조절한 너비](./images/memo-pane-resize-before-after.jpg '창 폭 900px에서 사이드바를 최소 180px로 줄이면 목록은 최대 360px(900 − 180 − 본문 최소 360)까지 넓힐 수 있다. 오른쪽은 목록 핸들에 키보드 포커스가 있어 경계에 회색 선이 표시된 상태')

처음([#219](https://github.com/hyeoniverse/MacFolio/pull/219)의 첫 커밋)에는 사이드바 경계만 `SidebarResizer`로 구현했다. 사용해 보니 목록도 같은 이유로 내용이 잘려서, 두 번째 커밋에서 컴포넌트 이름을 `PaneResizer`로 바꾸고 `pane` 속성(`'sidebar' | 'list'`)으로 두 칸을 함께 처리하게 했다.

## 핸들의 배치 방법

메모 화면은 [CSS 그리드](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout) 세 칸(사이드바 · 목록 · 본문)이다. 핸들을 배치하는 방법은 세 가지를 비교했다.

| 방법                                                                                          | 장점                          | 단점                                                                                                              |
| --------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 그리드에 핸들용 좁은 칸을 추가한다                                                            | 위치를 별도로 계산하지 않는다 | 칸이 3개에서 5개로 늘어, 사이드바 열기·닫기·갤러리·한 칸 보기의 `grid-template-columns`를 모두 다시 작성해야 한다 |
| 칸 요소에 CSS [`resize: horizontal`](https://developer.mozilla.org/en-US/docs/Web/CSS/resize) | 코드가 거의 없다              | 오른쪽 아래 모서리에서만 드래그할 수 있고, 키보드로 조절할 수 없고, 범위 제한·저장을 처리하기 어렵다              |
| **절대 위치 핸들을 경계 위에 배치 (선택)**                                                    | 기존 세 칸 배치를 유지한다    | 위치를 칸 너비 변수로 계산해야 한다                                                                               |

세 번째 방법을 선택했다. 절대 위치로 배치한 자식은 그리드 칸을 차지하지 않으므로, 기존 배치 규칙을 하나도 바꾸지 않고 경계 위에 겹쳐 배치할 수 있다.

## 구조

![핸들은 그리드 칸이 아니라 경계 위에 겹쳐 있다](./images/memo-pane-resize-layout.svg '두 칸의 너비는 CSS 변수, 핸들은 그 경계 위치에 절대 위치로 배치한다')

앞의 두 칸 너비를 고정값 대신 CSS 변수 `--memo-sidebar-width`·`--memo-list-width`로 바꾸고, React 상태의 너비를 `style` 속성으로 전달한다. 본문 칸은 `minmax(0, 1fr)`로 남은 너비를 차지한다. 핸들 위치도 같은 변수로 계산한다(`styles/theme.css`).

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

`--memo-sidebar-column`은 사이드바 칸이 실제로 차지하는 너비다. 사이드바가 열려 있으면 사이드바 너비와 같고, 숨기면 `0px`이 된다. 그래서 사이드바를 숨겨도 목록 핸들이 목록 오른쪽 경계에 위치한다. 사이드바 열기·닫기 애니메이션도 이 변수 하나를 바꿔 처리한다.

핸들은 너비 12px의 영역이라서, 1px 경계선을 정확히 가리키지 않아도 드래그를 시작할 수 있다. 핸들의 렌더링 여부는 `Memo.tsx`가 결정한다. 사이드바 핸들은 `sidebarOpen && !compact`, 목록 핸들은 `view === 'list' && !compact`일 때만 렌더링한다.

## 시각 표시

처음에는 마우스를 올리면 강조색 세로선이 표시되게 했지만, 메모 화면의 다른 요소와 스타일이 맞지 않았다. macOS 메모도 경계에 마우스를 올릴 때 선을 표시하지 않고 커서만 바꾼다. 그래서 두 번째 커밋에서 강조선을 제거했다.

| 상태          | 표시                                              |
| ------------- | ------------------------------------------------- |
| 마우스 올림   | 커서만 `col-resize`로 변경                        |
| 키보드 포커스 | `::after`의 2px 회색 선을 `opacity: 0.6`으로 표시 |

키보드 포커스 표시는 키보드 사용자가 핸들 위치를 알 수 있게 하기 위해서다.

## 드래그 중의 처리

![pointerdown에서 pointerup·pointercancel까지](./images/memo-pane-resize-drag-flow.svg '드래그 중에는 상태만 바꾸고, 포인터를 놓을 때 한 번 저장한다')

`PaneResizer.tsx`는 [포인터 이벤트](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) 네 개(`pointerdown`·`pointermove`·`pointerup`·`pointercancel`)로 드래그를 처리한다.

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

- **포인터 캡처**: 누를 때 [`setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)를 호출해, 빠르게 드래그해 포인터가 핸들 밖으로 나가도 계속 이벤트를 수신한다. 마우스·펜·터치를 같은 코드로 처리한다. 왼쪽 버튼이 아니면(`event.button !== 0`) 무시한다.
- **본문 최소 너비**: 누르는 시점에 창 너비에서 다른 칸 너비와 본문 최소 너비를 빼서 이번 드래그의 최대 너비를 정한다. 넓은 창에서는 칸마다 정한 최대값이 먼저 적용된다.

  ```ts
  const READER_MIN = 360;
  const roomFor = (others: number) => () => (memoRef.current?.clientWidth ?? Infinity) - others - READER_MIN;
  ```

  최대값을 누를 때 한 번만 계산하는 이유는, 드래그 중에는 다른 칸 너비가 바뀌지 않기 때문이다. `pointermove`마다 레이아웃 값을 조회하지 않아도 된다.

- **애니메이션 비활성화**: 사이드바를 열고 닫을 때 칸 너비가 부드럽게 바뀌도록 `transition: grid-template-columns`가 지정되어 있다. 드래그 중에도 이 전환이 적용되면 칸이 포인터보다 늦게 따라온다. 드래그 중에는 그리드에 `data-resizing` 속성을 추가해 transition을 끄고, 커서를 `col-resize`로 고정하고 텍스트 선택을 막는다. 커서를 그리드 전체에 지정하는 이유는, 빠르게 드래그해 포인터가 핸들을 벗어나 본문 위로 가도 커서가 텍스트 커서로 바뀌지 않게 하기 위해서다.
- **저장 시점**: 드래그 중에는 `onResize`로 화면만 갱신하고, 포인터를 놓을 때 `onCommit`으로 한 번 저장한다. 드래그가 취소되면(`pointercancel`) 시작 너비로 되돌린다. 키보드와 더블클릭은 한 번에 끝나는 동작이라 `onResize`와 `onCommit`을 함께 호출한다.

## 저장

너비는 [`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)의 `macfolio:memo:sidebar-width`·`macfolio:memo:list-width`에 숫자로 저장한다(`memoStorage.ts`).

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

읽을 때 숫자가 아니면 기본값으로, 범위 밖이면 범위 안으로 보정한다. 저장된 값은 사용자가 개발자 도구에서 수정할 수도 있고, 이후 범위가 바뀔 수도 있어서 읽는 쪽에서 한 번 더 검증한다. 기본 너비로 돌아오면 키를 삭제해, 휴지통의 '내 브라우저 데이터'에 불필요한 항목이 남지 않게 했다. 두 키는 `bin/siteStorage.ts`의 '메모 보기 설정' 항목에 함께 등록해, 그 항목을 삭제하면 정렬 기준과 함께 초기 상태로 돌아간다.

## 접근성

핸들은 [`role="separator"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/separator_role)와 `aria-orientation="vertical"`, 현재·최소·최대 너비(`aria-valuenow`·`aria-valuemin`·`aria-valuemax`)를 가진다. 접근 가능한 이름은 각각 "사이드바 너비", "목록 너비"다. 포커스할 수 있는 separator는 스크린 리더에서 조절 가능한 분할선으로 인식되고, 값이 바뀌면 새 너비를 읽어 준다. `title`에는 "끌어서 너비 조절 (두 번 누르면 기본 너비)"를 지정해 마우스 사용자에게도 더블클릭 동작을 안내했다.

## 확인

- 단위 시험 `memoStorage.test.ts`: "칸 너비: 저장한 값을 읽고, 없거나 잘못되면 기본값, 범위 밖이면 범위 안으로"는 `'wide'`를 저장하면 기본값, `'10'`을 저장하면 최소값이 반환되는지 확인한다. "칸 너비를 기본값으로 되돌리면 저장한 값을 지운다"는 기본 너비를 저장하면 키가 삭제되는지 확인한다.
- E2E `e2e/memo.spec.ts`의 "칸 너비: 사이드바와 목록의 경계를 끌어 바꾸고, 키보드로도 바꾸고, 다시 열어도 남는다"는 두 핸들을 역할과 이름(`separator`, "사이드바 너비"·"목록 너비")으로 찾아 드래그하고, 키보드로 줄이고, 메모 앱을 닫았다 다시 열어 `aria-valuenow`가 사이드바 180, 목록 244로 유지되는지 확인한다. 목록 핸들을 더블클릭하면 272로 돌아오는지, 사이드바를 숨기면 사이드바 핸들만 사라지는지도 확인한다.
- [#219](https://github.com/hyeoniverse/MacFolio/pull/219)의 두 커밋에서 변경한 코드는 `Memo.css`·`Memo.tsx`·`PaneResizer.tsx`(101줄)·`memoStorage.ts`와 시험 두 파일이다.

## 남은 것·정리

- 한 칸 보기(700px 이하)에는 핸들이 없다. 좁은 창에서는 칸 너비를 조절할 여유 폭이 없기 때문이다.
- 창을 줄여 본문이 360px보다 좁아져도 저장된 너비를 자동으로 줄이지는 않는다. 드래그를 시작할 때만 본문 최소 너비를 계산한다.
- 그리드 위에 겹쳐 배치할 요소는 `position: absolute`로 지정하면 칸 계산에서 제외된다. 이번처럼 기존 배치 규칙이 여러 화면 상태로 나뉘어 있을 때 특히 유용했다.
- 드래그 같은 연속 동작은 "화면 반영"과 "저장"을 분리하면 저장 횟수가 드래그 1회당 1회로 줄어든다.

## 관련 글

- [메모 앱 태그](/memo/memo-tags)
- [deletedAt 열과 CHECK 제약으로 삭제한 글을 복구하는 소프트 삭제](/memo/memo-recently-deleted)
- [메모 다듬기](/memo/notes-polish)
- [pointer 이벤트와 translateY로 라이브러리 없이 구현한 순서 바꾸기 드래그](/memo/memo-folder-order)
- [메모 편집기 손보기 — 토글 목록·각주 (220~440px 취소선 문제)](/memo/memo-editor-toggle-footnote)

#MacFolio #메모앱 #CSS #React
