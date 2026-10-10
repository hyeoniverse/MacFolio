---
title: 표 양옆에 커서 두기 - 보이지 않던 틈 커서
date: 2026-10-01
category: 개발기/MacFolio/프론트엔드
summary: 편집기의 표 옆에는 커서를 둘 수 없었다. 알고 보니 틈 커서는 이미 있었는데 CSS가 없어 보이지 않았고, 거기서 친 글자는 사라졌다. 표 양옆의 세로 커서, 끌어 고른 칸과 손잡이로 고른 칸 구분하기, 빈 행·열 지우기를 만든 기록.
---

메모 편집기의 표를 쓰다 보면 표 바로 앞이나 뒤에 글을 넣고 싶을 때가 있다. macOS 메모에서는 표 왼쪽이나 오른쪽에 커서를 두고 바로 치면 된다. 그런데 우리 편집기에서는 표 옆에 커서가 서지 않았다.

## 틈 커서는 있었다, 보이지 않았을 뿐

ProseMirror는 표·이미지처럼 글자를 쓸 수 없는 블록 사이에 **틈 커서(gap cursor)**를 둔다. 편집기(Milkdown)에도 들어 있다. 실제로 E2E에는 "표 첫 행에서 ↑를 누르면 틈 커서가 생긴다"는 테스트가 있었고 통과하고 있었다.

```ts
await page.keyboard.press('ArrowUp');
await expect(editor.locator('.ProseMirror-gapcursor')).toHaveCount(1);
```

요소는 생긴다. 그런데 화면에는 아무것도 없었다. 계산된 스타일을 읽어 보니 `position`이 `static`이었고, 깜빡이는 줄을 그리는 `::after`에는 `animation`이 `none`이었다.

틈 커서의 모양은 `prosemirror-gapcursor` 패키지의 `style/gapcursor.css`에 따로 있다. JS 플러그인만 쓰고 이 CSS는 한 번도 불러오지 않았던 것이다. 테스트가 개수만 세서 보이는지는 몰랐다.

이 패키지는 편집기가 안에서 쓰는 것이라 앱의 의존성에는 없다. CSS 몇 줄 때문에 의존성을 늘리기보다 같은 모양을 Memo.css에 직접 그렸다. 색은 다크 모드에서도 보이게 글자색으로 했다.

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

## 표 옆에는 세로 커서로

기본 틈 커서는 블록 위에 깜빡이는 **가로줄**이다. 표 앞뒤에서는 이게 "표 위·아래"처럼 보인다. macOS 메모처럼 표 **왼쪽·오른쪽**에 세로 커서로 보이게 바꿨다.

틈 커서는 문서에서 표 바로 앞이나 바로 뒤에 `<div class="ProseMirror-gapcursor">`로 들어간다. 그래서 형제 선택자로 어느 쪽인지 알 수 있다.

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

둘 다 `width: 0; height: 1.3em; border-left`로 글자 높이의 세로선이 된다. 처음에는 표 뒤 커서에 `right: 0`만 줬는데, 커서 상자가 왼쪽 끝부터 오른쪽 끝까지 늘어났다. 절대 위치 요소는 `left`가 없으면 제자리(왼쪽)를 `left`로 쓰기 때문이다. `left: auto`를 함께 줘야 오른쪽에 붙는다.

![표 왼쪽의 커서](./images/table-gap-left.jpg '첫 칸 맨 앞에서 ←: 표 왼쪽에 세로 커서')

![표 오른쪽의 커서](./images/table-gap-right.jpg '마지막 칸 맨 끝에서 →: 표 오른쪽, 마지막 행 높이에 세로 커서')

## 어떻게 표 옆으로 가나

ProseMirror는 옆에 **문단이 있으면** 그 자리를 틈 커서 자리로 보지 않는다. 그냥 옆 문단으로 가면 되기 때문이다. 그런데 이 편집기는 글 끝이 표여도 그 아래에 빈 문단을 늘 하나 둔다. 그래서 표 뒤는 거의 언제나 문단이고, 표 오른쪽에 커서를 둘 길이 없었다.

←·→를 직접 처리해, 옆에 문단이 있어도 한 번은 표 옆에 서게 했다.

![←·→로 표 옆을 지나는 순서](./images/table-gap-keys.svg '표 옆에서 한 번 멈추고, 한 번 더 누르면 그쪽으로 간다')

- 첫 칸 맨 앞에서 ← → 표 왼쪽
- 마지막 칸 맨 끝에서 → → 표 오른쪽
- 표 바로 뒤 문단의 맨 앞에서 ← → 표 오른쪽
- 표 바로 앞 문단의 맨 끝에서 → → 표 왼쪽
- 표 옆에서 한 번 더 누르면 그쪽의 가장 가까운 글자 자리로 (`Selection.findFrom`)

```ts
if (selection instanceof GapCursor) {
	if (!isTable($from.nodeBefore) && !isTable($from.nodeAfter)) return false;
	const next = Selection.findFrom($from, direction, true);
	if (next) view.dispatch(state.tr.setSelection(next));
	return true;
}
```

## 표 옆에서 친 글자가 사라졌다

표 오른쪽에 커서를 두고 글을 쳤더니 아무것도 생기지 않았다. 틈 커서에서 글자를 넣는 일은 `prosemirror-gapcursor`가 맡는다. 그런데 그 코드를 보니 **한글 조합 입력**(`insertCompositionText`)일 때만 그 자리에 문단을 만들고 있었다.

```js
function beforeinput(view, event) {
	if (event.inputType != 'insertCompositionText' || !(view.state.selection instanceof GapCursor)) return false;
	// … 그 자리에 빈 문단을 넣고 커서를 옮긴다
}
```

표가 글 맨 앞에 있을 때는 친 글자가 새 문단에 들어갔다. 하지만 표 뒤처럼 옆에 문단이 있는 자리에서는 글자가 어디에도 들어가지 않았다. 그래서 플러그인을 하나 더 붙였다. 틈 커서에서 어떤 글자를 쳐도 먼저 그 자리에 새 문단을 만든다.

- `handleTextInput`(키보드로 친 글자): 새 문단을 만들고 그 안에 글자를 넣는다
- `beforeinput`(조합·입력기 글자): 새 문단만 만들고, 글자는 브라우저가 그 안에 넣게 둔다

## 끌어 고른 칸에는 손잡이를 띄우지 않는다

표에는 macOS 메모처럼 행·열 **손잡이**가 있다. 손잡이를 누르면 그 행·열 전체가 골라지고, 테두리·꼭짓점·메뉴가 생긴다.

문제는 마우스로 칸을 끌어 고를 때였다. 끌다 보니 우연히 한 열을 다 덮으면, 손잡이로 고른 것처럼 열 막대가 펼쳐지고 테두리와 꼭짓점이 붙었다. 칸 몇 개를 고르려던 것뿐인데 화면이 요란해졌다.

![고치기 전: 끌어 골랐는데 손잡이가 펼쳐진다](./images/table-drag-before.jpg '열을 끌어 골랐을 뿐인데 열 막대·테두리·꼭짓점이 붙는다')

두 경우 모두 편집기에는 같은 `CellSelection`이 남는다. 그래서 고른 칸만 봐서는 손잡이로 고른 것인지 알 수 없다. **어떻게 골랐는지**를 따로 기억하는 작은 플러그인을 붙였다.

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

손잡이 누르기, 꼭짓점 끌기, 행·열 옮기기처럼 손잡이가 일으키는 변경에만 `tr.setMeta(handleSelectionKey, true)`를 붙인다. 손잡이 쪽은 고른 칸이 있는데 이 값이 `false`이면 아무것도 그리지 않는다. 글만 바뀌고 고른 칸은 그대로인 변경(칸 비우기 등)은 값을 그대로 둔다.

스크린샷을 찍어 보니 하나가 더 남아 있었다. 끌기를 멈춘 칸의 글자에 브라우저의 **파란 글자 선택**이 함께 칠해져 있었다(위 사진의 h). 편집기는 칸을 고르면 `ProseMirror-hideselection` 클래스를 붙여 브라우저 선택을 숨기라고 알린다. 그런데 그 클래스로 선택을 투명하게 하는 규칙도 `prosemirror-view`의 기본 CSS에만 있었다. 틈 커서와 같은 이유다. 그 두 줄도 Memo.css에 옮겨 적었다.

```css
.memo-inline-editor .ProseMirror-hideselection *::selection {
	background: transparent;
}
.memo-inline-editor .ProseMirror-hideselection {
	caret-color: transparent;
}
```

![고친 뒤: 고른 칸 표시만](./images/table-drag-after.jpg '끌어 고르면 고른 칸만 옅게 보인다. 파란 글자 선택도 없다')

## 비운 행·열은 한 번 더 지우면 사라진다

행·열 전체를 고르고 Backspace를 누르면 칸이 빈다. 그런데 빈 행·열을 지우려면 손잡이 메뉴를 열어야 했다. 이제는 한 번 더 누르면 지워진다.

1. 고른 칸에 글이 하나라도 있으면: 칸을 비운다 (편집기 기본 동작)
2. 다 빈 칸이면: 열 전체를 골랐으면 그 열을, 행 전체를 골랐으면 그 행을 지운다
3. 표 전체를 골랐으면 표를 지운다

Markdown 표는 머리글 한 행과 본문 한 행 이상이 있어야 한다. 그래서 머리글 행이나 마지막 본문 행은 지우지 않는다. 손잡이 메뉴의 "행 삭제"가 쓰던 규칙(`canRunTableOp`)을 그대로 쓴다.

## 테스트에서 걸린 두 가지

### 크기가 없는 커서는 "보이지 않는다"

틈 커서가 보이는지 `toBeVisible()`로 확인하려 했는데 실패했다. 틈 커서 요소는 크기가 0×0이다. 선은 `::after`가 그린다. Playwright는 크기가 0인 요소를 보이지 않는 것으로 친다. 대신 `display`가 `block`인지와 요소의 위치(표 왼쪽 끝·오른쪽 끝과 2px 안)로 확인했다.

### Home 다음 키가 너무 빨랐다

"문단 맨 앞에서 ←" 시험이 가끔 실패했다. Home은 편집기가 아니라 **브라우저**가 커서를 옮기고, 편집기는 그 자리를 `selectionchange`로 조금 늦게 읽는다. 그 전에 ←가 들어오면 편집기는 아직 커서가 글 끝에 있다고 보고 그냥 넘긴다. 클릭 뒤에 키를 누르던 기존 테스트도 같은 이유로 잠깐 기다리고 있었다. Home 뒤에도 100ms를 기다리게 했고, 세 번 연달아 돌려 모두 통과했다.

#MacFolio #메모앱 #편집기
