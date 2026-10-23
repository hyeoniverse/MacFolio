---
title: 표 양옆에 커서 두기 - 보이지 않던 틈 커서
date: 2026-10-01
category: 개발기/MacFolio/프론트엔드
summary: 편집기의 표 옆에 커서를 놓을 수 없었다. 틈 커서는 이미 있었지만 CSS를 불러오지 않아 표시되지 않았고, 그 위치에서 입력한 글자는 사라졌다. 표 양옆 세로 커서, 끌어 선택한 칸 구분, 빈 행·열 삭제를 구현한 기록.
---

메모 편집기에서 표 바로 앞이나 뒤에 글을 추가하려면 표 옆에 커서를 놓아야 한다. macOS 메모에서는 표 왼쪽이나 오른쪽에 커서를 놓고 바로 입력할 수 있다. 이 편집기에서는 표 옆에 커서가 놓이지 않았다.

## 틈 커서는 있었지만 표시되지 않았다

[ProseMirror](https://prosemirror.net/)는 표·이미지처럼 글자를 입력할 수 없는 블록 사이에 **[틈 커서(gap cursor)](https://prosemirror.net/docs/ref/#gapcursor)**[^1]를 놓는다. 메모 편집기가 사용하는 [Milkdown](https://milkdown.dev/)에도 이 플러그인이 포함되어 있다. E2E에도 "표 첫 행에서 ↑를 누르면 틈 커서가 생긴다"는 시험이 있었고, 통과하고 있었다.

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

표 오른쪽에 커서를 놓고 글자를 입력하면 아무것도 생성되지 않았다. 틈 커서 위치의 입력은 `prosemirror-gapcursor`가 처리한다. 그 코드를 확인하니 **한글 조합 입력**[^2](`insertCompositionText`)일 때만 그 위치에 문단을 생성하고 있었다.

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

## 끌어 선택한 칸에는 손잡이를 표시하지 않는다

표에는 macOS 메모처럼 행·열 **손잡이**가 있다. 손잡이를 클릭하면 그 행·열 전체가 선택되고, 테두리·꼭짓점·메뉴가 표시된다.

문제는 마우스로 칸을 끌어 선택하는 경우였다. 끄는 도중 한 열 전체가 선택 범위에 들어가면, 손잡이로 선택한 것처럼 열 막대가 펼쳐지고 테두리와 꼭짓점이 표시됐다. 칸 몇 개만 선택하려는 조작인데 손잡이 UI가 모두 나타났다.

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

손잡이 클릭, 꼭짓점 끌기, 행·열 이동처럼 손잡이가 일으키는 트랜잭션에만 `tr.setMeta(handleSelectionKey, true)`를 붙인다. 손잡이 UI는 선택된 칸이 있어도 이 값이 `false`이면 아무것도 렌더링하지 않는다. 글만 바뀌고 선택은 그대로인 트랜잭션(칸 비우기 등)은 값을 유지한다.

| 선택 방법                         | `CellSelection` | 플러그인 값 | 손잡이 UI |
| --------------------------------- | --------------- | ----------- | --------- |
| 손잡이 클릭·꼭짓점 끌기·행열 이동 | 있음            | `true`      | 표시      |
| 마우스로 칸 끌기                  | 있음            | `false`     | 숨김      |
| 칸 비우기 (선택 유지)             | 있음            | 이전 값     | 이전 상태 |

스크린샷을 확인하니 문제가 하나 더 남아 있었다. 끌기를 멈춘 칸의 글자에 브라우저의 **파란 글자 선택**이 함께 표시되어 있었다(위 사진의 h). 편집기는 칸을 선택하면 `ProseMirror-hideselection` 클래스를 붙여 브라우저 선택을 숨기도록 지시한다. 그런데 그 클래스로 선택을 투명하게 만드는 규칙도 `prosemirror-view`의 기본 CSS에만 있었다. 틈 커서와 같은 원인이다. 이 두 규칙도 Memo.css로 옮겼다.

```css
.memo-inline-editor .ProseMirror-hideselection *::selection {
	background: transparent;
}
.memo-inline-editor .ProseMirror-hideselection {
	caret-color: transparent;
}
```

![수정 후: 선택한 칸 표시만](./images/table-drag-after.jpg '끌어 고르면 고른 칸만 옅게 보인다. 파란 글자 선택도 없다')

## 비운 행·열은 Backspace를 한 번 더 누르면 삭제된다

행·열 전체를 선택하고 Backspace를 누르면 칸이 비워진다. 그러나 빈 행·열을 삭제하려면 손잡이 메뉴를 열어야 했다. 이제는 Backspace를 한 번 더 누르면 삭제된다.

1. 선택한 칸에 글이 하나라도 있으면: 칸을 비운다 (편집기 기본 동작)
2. 모두 빈 칸이면: 열 전체를 선택했으면 그 열을, 행 전체를 선택했으면 그 행을 삭제한다
3. 표 전체를 선택했으면 표를 삭제한다

Markdown 표는 머리글 한 행과 본문 한 행 이상이 있어야 한다. 그래서 머리글 행이나 마지막 본문 행은 삭제하지 않는다. 손잡이 메뉴의 "행 삭제"가 사용하던 규칙(`canRunTableOp`)을 그대로 사용한다.

## 시험에서 발견한 두 가지

### 크기가 없는 커서는 "보이지 않는다"

틈 커서가 표시되는지 [`toBeVisible()`](https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-visible)로 확인하려 했는데 실패했다. 틈 커서 요소는 크기가 0×0이고, 선은 `::after`가 렌더링한다. Playwright는 크기가 0인 요소를 보이지 않는 요소로 판정한다. 대신 `display`가 `block`인지와 요소의 위치(표 왼쪽 끝·오른쪽 끝에서 2px 이내)로 확인했다.

### Home 다음 키 입력이 너무 빨랐다

"문단 맨 앞에서 ←" 시험이 간헐적으로 실패했다. Home 키는 편집기가 아니라 **브라우저**가 커서를 이동하고, 편집기는 그 위치를 [`selectionchange`](https://developer.mozilla.org/en-US/docs/Web/API/Document/selectionchange_event) 이벤트로 약간 늦게 읽는다. 그 전에 ←가 입력되면 편집기는 커서가 아직 글 끝에 있다고 판단하고 처리하지 않는다. 클릭 뒤에 키를 누르던 기존 시험도 같은 이유로 잠시 대기하고 있었다. Home 뒤에도 100ms를 대기하도록 했고, 세 번 연속 실행해 모두 통과했다.

## 변경 규모

- 커밋 `bddb63b76` 기준 변경 파일 7개, 331줄 추가와 11줄 삭제. 가장 큰 파일은 `tableCommands.ts`(161줄)와 `e2e/memo-editor.spec.ts`(109줄)다.
- 틈 커서 CSS는 `Memo.css`에 54줄이다.

## 남은 것·배운 것

- 이 작업에서 "끌어 선택한 칸에는 손잡이를 표시하지 않는다"고 하면서 테두리와 꼭짓점까지 함께 숨겼다. 며칠 뒤 표를 편집하다 선택 범위가 보이지 않아 테두리를 다시 표시했다([표 다듬기](/memo/table-polish)).
- 요소의 **개수**를 확인하는 시험은 그 요소가 **표시되는지** 검사하지 않는다. 틈 커서 시험은 계속 통과하면서도 보이지 않는 커서를 검출하지 못했다. 화면에 렌더링하는 요소라면 위치나 `display`처럼 표시와 관련된 값을 함께 확인한다.
- 라이브러리의 JS만 사용하고 CSS를 누락하는 일은 흔하다. 특히 편집기처럼 여러 패키지를 묶은 도구에서는 "이 플러그인에 별도로 불러올 CSS가 있는가"를 처음에 확인한다.
- 시간에 의존하는 시험(Home 뒤 100ms)은 근본 해결이 아니다. 편집기가 `selectionchange`를 처리했다는 신호가 있으면 그 신호를 기다리는 편이 낫지만, 아직 찾지 못했다.

## 관련 글

- 이어서 표를 다듬은 작업: [표 다듬기 - 끌어 고른 범위, 여백 누르기, 한 번에 지우기](/memo/table-polish)
- 같은 날의 작업 기록: [10월 1일 - 규칙과 공통 컴포넌트, 그리고 자정의 최근 삭제된 항목](/memo/day-1001)
- PR: [#55](https://github.com/hyeoniverse/MacFolio/pull/55)
- ProseMirror 문서: [prosemirror-gapcursor](https://prosemirror.net/docs/ref/#gapcursor)

[^1]: 틈 커서: 글자를 입력할 수 없는 두 블록 사이, 또는 문서 처음·끝의 블록 옆에 놓이는 커서. 이 위치에서 글자를 입력하면 새 문단이 생성된다.

[^2]: 조합 입력(IME composition): 한글처럼 여러 키 입력을 조합해 한 글자를 만드는 입력 방식. 조합 중인 글자는 `insertCompositionText` 형식의 `beforeinput` 이벤트로 전달된다.

#MacFolio #메모앱 #편집기
