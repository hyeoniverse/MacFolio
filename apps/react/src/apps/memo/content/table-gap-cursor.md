---
title: 메모 편집기 3 - ProseMirror 표의 틈 커서·셀 범위 선택·Backspace 삭제를 macOS 메모처럼 만들기
date: 2026-10-01
category: 개발 기록/MacFolio/프론트엔드
summary: 편집기의 표 옆에 커서를 놓을 수 없었다. 틈 커서는 이미 있었지만 CSS를 불러오지 않아 표시되지 않았고, 그 위치에서 입력한 글자는 사라졌으며, 표 옆 여백은 편집기 밖이라 클릭이 전달되지 않았다. 표 양옆 세로 커서, 끌어 선택한 칸의 테두리·꼭짓점 표시, 빈 행·열과 표의 Backspace 삭제를 macOS 메모 기준으로 구현한 기록.
---

메모 편집기에서 표 바로 앞이나 뒤에 글을 추가하려면 표 옆에 커서를 놓아야 한다. macOS 메모에서는 표 왼쪽이나 오른쪽에 커서를 놓고 바로 입력할 수 있다. 이 편집기에서는 표 옆에 커서가 놓이지 않았다.

편집기는 [ProseMirror](https://prosemirror.net/) 위에 구현했고, 표는 [`prosemirror-tables`](https://github.com/ProseMirror/prosemirror-tables)로 처리한다. macOS 메모의 표를 기준으로 행·열 손잡이, 칸 끌어 선택하기, 표 양옆 커서를 맞췄다.

![표 다듬기](./images/table-polish.jpg '끌어 고른 칸에는 테두리와 꼭짓점, 표 양옆 여백을 누르면 그쪽에 세로 커서')

| 문제                                   | 원인                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| 표 옆에 커서가 표시되지 않는다         | 틈 커서 CSS를 불러오지 않았다                                     |
| 표 뒤에는 키보드로 커서를 놓을 수 없다 | 옆에 문단이 있으면 ProseMirror가 틈 커서 위치로 취급하지 않는다   |
| 표 옆에서 입력한 글자가 사라진다       | 틈 커서 플러그인이 조합 입력만 처리한다                           |
| 표 옆을 클릭해도 커서가 놓이지 않는다  | 표 옆은 편집기 바깥이라 클릭 처리기가 이벤트를 수신하지 못한다    |
| 끌어 선택한 칸에 손잡이 UI가 펼쳐진다  | 손잡이 선택과 끌어 선택이 같은 `CellSelection`이라 구분할 수 없다 |
| 빈 행·열과 표를 지우기가 번거롭다      | 메뉴를 열거나 Backspace를 두 번 눌러야 했다                       |

## 틈 커서는 있었지만 표시되지 않았다

ProseMirror는 표·이미지처럼 글자를 입력할 수 없는 블록 사이에 **[틈 커서(gap cursor)](https://prosemirror.net/docs/ref/#gapcursor)**[^1]를 놓는다. 메모 편집기가 사용하는 [Milkdown](https://milkdown.dev/)에도 이 플러그인이 포함되어 있다. E2E에도 "표 첫 행에서 ↑를 누르면 틈 커서가 생긴다"는 시험이 있었고, 통과하고 있었다.

```ts
await page.keyboard.press('ArrowUp');
await expect(editor.locator('.ProseMirror-gapcursor')).toHaveCount(1);
```

요소는 DOM에 생성되지만 화면에는 아무것도 표시되지 않았다. 계산된 스타일을 확인하니 `position`이 `static`이었고, 깜빡이는 선을 렌더링하는 `::after`의 `animation`은 `none`이었다.

틈 커서의 모양은 `prosemirror-gapcursor` 패키지의 `style/gapcursor.css`에 별도로 정의되어 있다. 편집기는 JS 플러그인만 사용하고 이 CSS는 불러오지 않았다. 시험은 요소 개수만 확인했기 때문에 표시 여부는 검사하지 못했다.

이 패키지는 편집기 내부 의존성이라 앱의 `package.json`에는 없다. CSS 몇 줄 때문에 의존성을 추가하지 않고, 같은 모양을 `Memo.css`에 직접 작성했다. 색은 다크 모드에서도 보이도록 글자색 변수(`--memo-text`)를 사용했다. 이 규칙은 이후 Memo.css를 분할하면서 `styles/editor-blocks.css`로 옮겼다.

```css
.memo-inline-editor .ProseMirror-gapcursor {
	display: none;
	position: absolute;
	pointer-events: none;
}

.memo-inline-editor .ProseMirror-focused .ProseMirror-gapcursor {
	display: block;
}

.memo-inline-editor .ProseMirror-gapcursor::after {
	content: '';
	position: absolute;
	top: -2px;
	width: 20px;
	border-top: 1.5px solid var(--memo-text);
	animation: memo-gapcursor-blink 1.1s steps(2, start) infinite;
}
```

검토한 방법은 세 가지다.

| 방법                                                        | 장점                                     | 단점                                                     |
| ----------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `prosemirror-gapcursor`를 앱 의존성에 추가해 CSS를 불러온다 | 원본 모양을 그대로 사용한다              | 편집기가 사용하는 버전과 앱이 선택한 버전이 다를 수 있다 |
| 위젯 장식(decoration)으로 커서를 직접 렌더링한다            | 모양을 자유롭게 지정한다                 | 틈 커서 플러그인과 같은 기능을 중복 구현한다             |
| 같은 모양을 `Memo.css`에 직접 작성한다                      | CSS 몇 줄로 끝나고 다크 모드 색도 맞춘다 | 패키지가 모양을 바꾸면 반영되지 않는다                   |

마지막 방법을 선택했다. 다음 절에서 표 옆 커서를 세로선으로 바꾸므로 원본 모양을 그대로 사용할 필요도 없었다.

## 표 옆에는 세로 커서

기본 틈 커서는 블록 위에서 깜빡이는 **가로선**이다. 표 앞뒤에서는 이 가로선이 "표 위·아래"를 가리키는 것처럼 보인다. macOS 메모처럼 표 **왼쪽·오른쪽**에 세로 커서가 표시되도록 바꿨다.

틈 커서는 문서에서 표 바로 앞이나 바로 뒤에 `<div class="ProseMirror-gapcursor">`로 삽입된다. 따라서 형제 선택자와 [`:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)로 어느 쪽인지 구분할 수 있다.

```css
/* 표 앞: 다음 형제가 표 → 표 왼쪽 */
.ProseMirror-gapcursor:has(+ table)::after {
	top: 0.55em;
	left: -6px;
}

/* 표 뒤: 앞 형제가 표 → 표 오른쪽, 마지막 행 높이 */
table + .ProseMirror-gapcursor {
	left: auto;
	right: 0;
}
table + .ProseMirror-gapcursor::after {
	top: -2.9em;
	left: 5px;
}
```

두 경우 모두 `width: 0; height: 1.3em; border-left`로 글자 높이의 세로선을 렌더링한다. 처음에는 표 뒤 커서에 `right: 0`만 지정했는데, 커서 상자가 왼쪽 끝부터 오른쪽 끝까지 늘어났다. 절대 위치 요소는 `left`가 지정되지 않으면 원래 위치(왼쪽)를 `left`로 사용하기 때문이다. `left: auto`를 함께 지정해야 오른쪽에 붙는다.

![표 왼쪽의 커서](./images/table-gap-left.jpg '첫 칸 맨 앞에서 ←: 표 왼쪽에 세로 커서')

![표 오른쪽의 커서](./images/table-gap-right.jpg '마지막 칸 맨 끝에서 →: 표 오른쪽, 마지막 행 높이에 세로 커서')

## 키보드로 표 옆에 커서를 놓는 순서

ProseMirror는 옆에 **문단이 있으면** 그 위치를 틈 커서 위치로 취급하지 않는다. 옆 문단으로 이동하면 되기 때문이다. 그런데 이 편집기는 글 끝이 표여도 그 아래에 빈 문단을 항상 하나 유지한다. 그래서 표 뒤에는 거의 항상 문단이 있고, 표 오른쪽에 커서를 놓을 방법이 없었다.

←·→ 키를 직접 처리해, 옆에 문단이 있어도 한 번은 표 옆에 커서가 멈추도록 했다.

![←·→로 표 옆을 지나는 순서](./images/table-gap-keys.svg '표 옆에서 한 번 멈추고, 한 번 더 누르면 그쪽으로 간다')

| 커서 위치               | 키  | 이동 위치                                              |
| ----------------------- | --- | ------------------------------------------------------ |
| 첫 칸 맨 앞             | ←   | 표 왼쪽                                                |
| 마지막 칸 맨 끝         | →   | 표 오른쪽                                              |
| 표 바로 뒤 문단의 맨 앞 | ←   | 표 오른쪽                                              |
| 표 바로 앞 문단의 맨 끝 | →   | 표 왼쪽                                                |
| 표 옆(틈 커서)          | ←/→ | 그 방향의 가장 가까운 글자 위치 (`Selection.findFrom`) |

```ts
if (selection instanceof GapCursor) {
	if (!isTable($from.nodeBefore) && !isTable($from.nodeAfter)) return false;
	const next = Selection.findFrom($from, direction, true);
	if (next) view.dispatch(state.tr.setSelection(next));
	return true;
}
```

## 표 옆에서 입력한 글자가 사라졌다

표 오른쪽에 커서를 놓고 글자를 입력하면 아무것도 생성되지 않았다. 틈 커서 위치의 입력은 `prosemirror-gapcursor`가 처리한다. 그 코드를 확인하니 **한글 조합 입력**(`insertCompositionText`)[^2]일 때만 그 위치에 문단을 생성하고 있었다.

```js
function beforeinput(view, event) {
	if (event.inputType != 'insertCompositionText' || !(view.state.selection instanceof GapCursor)) return false;
	// … 그 자리에 빈 문단을 넣고 커서를 옮긴다
}
```

표가 글 맨 앞에 있는 경우에는 입력한 글자가 새 문단에 들어갔다. 하지만 표 뒤처럼 옆에 문단이 있는 위치에서는 글자가 어디에도 삽입되지 않았다. 그래서 플러그인을 하나 추가해, 틈 커서에서 어떤 글자를 입력해도 먼저 그 위치에 새 문단을 생성하도록 했다.

| 입력 경로                                                                                                      | 처리                                              |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `handleTextInput` (키보드로 입력한 글자)                                                                       | 새 문단을 생성하고 그 안에 글자를 삽입한다        |
| [`beforeinput`](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event) (조합·입력기 글자) | 새 문단만 생성하고, 글자 삽입은 브라우저에 맡긴다 |

## 표 옆 여백을 클릭하면 그쪽에 커서

←·→ 키로는 표 양옆에 세로 커서를 놓을 수 있었지만, 마우스로는 불가능했다. 표 옆을 클릭하면 커서가 의도하지 않은 칸으로 이동했다.

처음에는 편집기의 `handleClick`에서 클릭 위치가 표의 왼쪽·오른쪽인지 판단해 틈 커서를 놓았다. 그런데 시험해 보니 아무 동작도 일어나지 않았다. 이 편집기의 표는 **편집기 너비 전체를 차지**한다. 표 옆은 편집기 바깥인 본문 칸의 여백(좌우 32px)이라, 클릭 이벤트가 편집기의 처리기까지 전달되지 않았다.

![표 옆 여백이 편집기 바깥이라 본문 칸에서 누름을 받는 구조](./images/table-polish-click-areas.svg '표 옆은 편집기 밖이다')

검토한 방법은 세 가지다.

| 방법                                           | 장점                                  | 단점                                                        |
| ---------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| 편집기에 좌우 안쪽 여백을 지정해 표를 좁힌다   | `handleClick`만으로 처리된다          | 본문 글과 표의 너비가 달라지고, 다른 글의 레이아웃이 바뀐다 |
| 표 양옆에 보이지 않는 클릭 영역을 추가한다     | 클릭 위치가 명확하다                  | 표마다 요소가 늘고, 표가 이동하면 위치를 갱신해야 한다      |
| 본문 칸에 `mousedown`을 등록하고 좌표로 찾는다 | 화면은 그대로, 처리기 하나로 해결한다 | 편집기 밖 이벤트라 플러그인이 직접 등록·해제해야 한다       |

화면을 바꾸지 않는 마지막 방법을 선택했다. 플러그인의 [`view`](https://prosemirror.net/docs/ref/#state.PluginSpec.view)에서 본문 칸(`.memo-scroll`)에 `mousedown` 처리기를 별도로 등록했다.

```ts
view: (view) => {
	const area = view.dom.closest('.memo-scroll');
	const onDown = (event: MouseEvent) => {
		if (view.dom.contains(event.target as Node)) return; // 편집기 안은 handleClick이 맡는다
		const gap = gapBesideTableAt(view, event.clientX, event.clientY);
		if (gap === null) return;
		event.preventDefault(); // 여백을 눌러 편집기의 초점이 빠지지 않게
		placeGap(view, gap);
	};
	area?.addEventListener('mousedown', onDown);
	return { destroy: () => area?.removeEventListener('mousedown', onDown) };
},
```

`gapBesideTableAt`은 글 안의 각 표의 화면 좌표를 측정해, 클릭한 높이가 표 범위 안이고 위치가 표의 오른쪽(또는 왼쪽)이면 표 뒤(또는 앞) 위치를 반환한다. 표의 위·아래 경계를 벗어난 높이이면 아무 동작도 하지 않는다. `preventDefault`를 생략하면 여백을 클릭하는 순간 편집기가 포커스를 잃고, 틈 커서는 포커스가 있을 때만 표시되므로 커서가 사라진다.

## 끌어 선택한 칸: 손잡이만 숨기고 테두리·꼭짓점은 표시

표에는 macOS 메모처럼 행·열 **손잡이**가 있다. 손잡이를 클릭하면 그 행·열 전체가 선택되고, 테두리·꼭짓점·메뉴가 표시된다.

문제는 마우스로 칸을 끌어 선택하는 경우였다. 끄는 도중 한 열 전체가 선택 범위에 들어가면, 손잡이로 선택한 것처럼 열 막대가 펼쳐졌다. 칸 몇 개만 선택하려는 조작인데 손잡이 UI가 모두 나타났다.

![수정 전: 끌어 선택했는데 손잡이가 펼쳐진다](./images/table-drag-before.jpg '열을 끌어 골랐을 뿐인데 열 막대·테두리·꼭짓점이 붙는다')

두 경우 모두 편집기에는 같은 `CellSelection`이 남는다. 따라서 선택된 칸만으로는 손잡이로 선택한 것인지 구분할 수 없다. **선택 방법**을 별도로 저장하는 작은 플러그인을 추가했다.

```ts
const handleSelectionKey = new PluginKey<boolean>('memoTableHandleSelection');

export const tableHandleSelection = new Plugin<boolean>({
	key: handleSelectionKey,
	state: {
		init: () => false,
		apply: (tr, current) => {
			const meta = tr.getMeta(handleSelectionKey);
			if (meta !== undefined) return meta; // 손잡이가 표시한 변경
			return tr.selectionSet ? false : current; // 다른 방법으로 고르면 손잡이 아님
		},
	},
});
```

손잡이 클릭, 꼭짓점 끌기, 행·열 이동처럼 손잡이가 일으키는 트랜잭션에만 `tr.setMeta(handleSelectionKey, true)`를 붙인다. 글만 바뀌고 선택은 그대로인 트랜잭션(칸 비우기 등)은 값을 유지한다.

처음에는 이 값이 `false`이면 손잡이 UI 전체를 렌더링하지 않았다. 손잡이뿐 아니라 **선택 범위의 테두리와 꼭짓점까지** 함께 숨긴 것이다. 실제로 글을 작성하며 표를 사용해 보니 칸을 끌어 선택해도 선택 범위가 표시되지 않았다. macOS 메모에서 같은 조작을 해 보니 끌어 선택한 범위에도 노란 테두리와 대각선 꼭짓점 두 개를 렌더링한다. 선택 범위를 바로 확인할 수 있고, 꼭짓점을 끌어 범위를 조정할 수 있다. 숨겨야 했던 것은 행·열 손잡이뿐이었다.

![macOS 메모에서 표의 첫 줄 두 칸을 끌어 고른 화면](./images/table-polish-macos-selection.jpg '참고한 macOS 메모 화면. 끌어 고른 범위에 노란 테두리와 대각선 꼭짓점 둘이 그려진다')

조건 하나(`table.dragged`)가 두 기능을 함께 막고 있었으므로, 손잡이 표시 여부를 별도 값으로 분리했다.

```tsx
// 수정 전: 칸을 끌어 골랐으면 손잡이·테두리 없이 고른 칸 표시만
if (!table || !tableBox || !run || table.dragged) return null;

// 수정 후: 칸을 끌어 골랐으면 고른 범위의 테두리와 꼭짓점만 (행·열 손잡이는 손잡이로 고를 때만)
if (!table || !tableBox || !run) return null;
const handles = !table.dragged;
```

꼭짓점으로 범위를 조정하는 명령은 원래 "손잡이로 선택한 변경"이라는 메타를 붙였다. 그대로 두면 끌어 선택한 범위의 꼭짓점을 조작하는 순간 손잡이가 나타난다. 그래서 명령에 `byHandle`을 전달해 처음 선택한 방법을 유지하도록 했다.

| 선택 방법                         | `CellSelection` | 플러그인 값  | 손잡이    | 테두리·꼭짓점 |
| --------------------------------- | --------------- | ------------ | --------- | ------------- |
| 손잡이 클릭·꼭짓점 끌기·행열 이동 | 있음            | `true`       | 표시      | 표시          |
| 마우스로 칸 끌기                  | 있음            | `false`      | 숨김      | 표시          |
| 끌어 선택한 범위의 꼭짓점 끌기    | 있음            | `false` 유지 | 숨김      | 표시          |
| 칸 비우기 (선택 유지)             | 있음            | 이전 값      | 이전 상태 | 이전 상태     |

스크린샷을 확인하니 문제가 하나 더 남아 있었다. 끌기를 멈춘 칸의 글자에 브라우저의 **파란 글자 선택**이 함께 표시되어 있었다(위 수정 전 사진의 h). 편집기는 칸을 선택하면 `ProseMirror-hideselection` 클래스를 붙여 브라우저 선택을 숨기도록 지시한다. 그런데 그 클래스로 선택을 투명하게 만드는 규칙도 `prosemirror-view`의 기본 CSS에만 있었다. 틈 커서와 같은 원인이다. 이 두 규칙도 Memo.css로 옮겼다.

```css
.memo-inline-editor .ProseMirror-hideselection *::selection {
	background: transparent;
}
.memo-inline-editor .ProseMirror-hideselection {
	caret-color: transparent;
}
```

![파란 글자 선택을 없앤 화면](./images/table-drag-after.jpg '끌어 고른 칸에 파란 글자 선택이 없다. 이 화면은 테두리를 숨기던 시각의 것으로, 지금은 고른 범위에 테두리와 꼭짓점이 함께 그려진다')

## 삭제 규칙

### 비운 행·열은 Backspace를 한 번 더 누르면 삭제된다

행·열 전체를 선택하고 Backspace를 누르면 칸이 비워진다. 그러나 빈 행·열을 삭제하려면 손잡이 메뉴를 열어야 했다. 이제는 Backspace를 한 번 더 누르면 삭제된다.

1. 선택한 칸에 글이 하나라도 있으면: 칸을 비운다 (편집기 기본 동작)
2. 모두 빈 칸이면: 열 전체를 선택했으면 그 열을, 행 전체를 선택했으면 그 행을 삭제한다
3. 표 전체를 선택했으면 표를 삭제한다

Markdown 표는 머리글 한 행과 본문 한 행 이상이 있어야 한다. 그래서 머리글 행이나 마지막 본문 행은 삭제하지 않는다. 손잡이 메뉴의 "행 삭제"가 사용하던 규칙(`canRunTableOp`)을 그대로 사용한다.

### 표는 Backspace 한 번에 삭제한다

표 바로 뒤에서 Backspace를 누르면 먼저 표를 선택하고(노란 테두리), 한 번 더 눌러야 삭제됐다. 삭제 대상을 보여 주려는 동작이었지만, 편집할 때마다 두 번 누르는 조작이 번거로웠다. 이제 한 번에 삭제한다.

| 커서 위치                                    | 키        | 수정 전                  | 수정 후   |
| -------------------------------------------- | --------- | ------------------------ | --------- |
| 표 바로 뒤 문단의 맨 앞, 또는 표 오른쪽 커서 | Backspace | 표 선택 → 다시 눌러 삭제 | 바로 삭제 |
| 표 왼쪽 커서                                 | Delete    | 표 선택 → 다시 눌러 삭제 | 바로 삭제 |

코드로는 Backspace 처리기의 한 분기다. 커서 바로 앞이 표이면 바로 삭제하고, 이미지이면 선택만 한다(`apps/react/src/apps/memo/writer/tableCommands.ts`).

```ts
const start = $block.pos - before.nodeSize;
if (before.type.name === 'table') {
	view.dispatch(state.tr.delete(start, $block.pos).scrollIntoView());
	return true;
}
if (before.type.name !== 'image_block') return false;
view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, start)));
return true;
```

편집기에는 실행 취소([history 플러그인](https://prosemirror.net/docs/ref/#history))가 있어서, 잘못 삭제한 표는 ⌘Z로 복원된다. 따라서 한 번에 삭제해도 데이터가 손실되지 않는다.

이미지는 기존대로 두 번 눌러야 삭제된다. 이미지는 선택했을 때 테두리가 표시되어 삭제 대상을 바로 확인할 수 있고, 실수로 삭제하면 다시 업로드해야 하기 때문이다.

## 시험에서 발견한 것

### 크기가 없는 커서는 "보이지 않는다"

틈 커서가 표시되는지 [`toBeVisible()`](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-visible)로 확인하려 했는데 실패했다. 틈 커서 요소는 크기가 0×0이고, 선은 `::after`가 렌더링한다. Playwright는 크기가 0인 요소를 보이지 않는 요소로 판정한다. 대신 `display`가 `block`인지와 요소의 위치(표 왼쪽 끝·오른쪽 끝에서 2px 이내)로 확인했다.

### Home 다음 키 입력이 너무 빨랐다

"문단 맨 앞에서 ←" 시험이 간헐적으로 실패했다. Home 키는 편집기가 아니라 **브라우저**가 커서를 이동하고, 편집기는 그 위치를 [`selectionchange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event) 이벤트로 약간 늦게 읽는다. 그 전에 ←가 입력되면 편집기는 커서가 아직 글 끝에 있다고 판단하고 처리하지 않는다. 클릭 뒤에 키를 누르던 기존 시험도 같은 이유로 잠시 대기하고 있었다. Home 뒤에도 100ms를 대기하도록 했고, 세 번 연속 실행해 모두 통과했다.

### 여백 클릭이 창 크기 조절 손잡이에 닿았다

표 오른쪽 30px 위치를 클릭하도록 했더니 창 가장자리의 크기 조절 손잡이가 클릭됐다. 시험 창이 좁아 본문 여백이 32px뿐이었기 때문이다. 표에서 12px 떨어진 위치를 클릭하도록 수정했다.

### 시험 목록

`apps/react/e2e/memo-editor.spec.ts`의 표 시험 중 이 동작을 검사하는 것은 다음과 같다.

| 시험 이름                                                                                                    | 검사하는 동작                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| "표: 칸을 끌어 고르면 고른 범위의 테두리만 보이고, 행·열 전체를 비운 뒤 한 번 더 지우면 그 행·열이 지워진다" | 끌어 선택한 칸 표시, 빈 행·열 삭제 |
| "표 양옆을 누르면 그쪽에 커서가 서고, 거기서 Backspace·Delete로 표를 지운다"                                 | 여백 클릭, 틈 커서에서 표 삭제     |
| "표 앞뒤에 커서를 두고, 뒤에서 Backspace를 한 번 누르면 표가 지워진다"                                       | ←·→ 순서, 표 한 번에 삭제          |

## 변경 규모

| 커밋        | 파일 | 추가 | 삭제 | 주요 파일                                                                     |
| ----------- | ---- | ---- | ---- | ----------------------------------------------------------------------------- |
| `bddb63b76` | 7    | 331  | 11   | `tableCommands.ts`(161줄), `e2e/memo-editor.spec.ts`(109줄), 틈 커서 CSS 54줄 |
| `418886b6d` | 7    | 234  | 112  | `TableHandles.tsx`(손잡이와 테두리 렌더링), `tableCommands.ts`, 시험 50줄     |

## 남은 것·배운 것

- 요소의 **개수**를 확인하는 시험은 그 요소가 **표시되는지** 검사하지 않는다. 틈 커서 시험은 계속 통과하면서도 보이지 않는 커서를 검출하지 못했다. 화면에 렌더링하는 요소라면 위치나 `display`처럼 표시와 관련된 값을 함께 확인한다.
- 라이브러리의 JS만 사용하고 CSS를 누락하는 일은 흔하다. 특히 편집기처럼 여러 패키지를 묶은 도구에서는 "이 플러그인에 별도로 불러올 CSS가 있는가"를 처음에 확인한다.
- 숨기는 대상을 정확히 구분해야 한다. 숨겨야 했던 것은 손잡이였는데 테두리까지 함께 숨겼다.
- 편집기 내부의 처리기는 편집기 DOM 밖의 이벤트를 수신하지 않는다. 화면에서 "편집기 옆"으로 보이는 영역이 DOM에서는 편집기 밖일 수 있다.
- 시간에 의존하는 시험(Home 뒤 100ms)은 근본 해결이 아니다. 편집기가 `selectionchange`를 처리했다는 신호가 있으면 그 신호를 기다리는 편이 낫지만, 아직 찾지 못했다.

## 관련 글

- 같은 날의 작업 기록: [10월 1일 - 규칙과 공통 컴포넌트, 그리고 자정의 최근 삭제된 항목](/memo/day-1001)
- PR: [#55](https://github.com/hyeoniverse/MacFolio/pull/55), [#62](https://github.com/hyeoniverse/MacFolio/pull/62)
- ProseMirror 문서: [prosemirror-gapcursor](https://prosemirror.net/docs/ref/#gapcursor)

[^1]: 틈 커서: 글자를 입력할 수 없는 두 블록 사이, 또는 문서 처음·끝의 블록 옆에 놓이는 커서. 이 위치에서 글자를 입력하면 새 문단이 생성된다.

[^2]: 조합 입력(IME composition): 한글처럼 여러 키 입력을 조합해 한 글자를 만드는 입력 방식. 조합 중인 글자는 `insertCompositionText` 형식의 `beforeinput` 이벤트로 전달된다.

#MacFolio #메모앱 #편집기
