---
title: 메모 편집기 버그 셋 — 첫 태그의 \#, 펼치기만 해도 임시 저장, 되돌릴 수 없던 저장소 글
date: 2026-10-23
category: 개발 기록/MacFolio/기능 구현
summary: 편집기로 저장하면 첫 태그가 \#로 이스케이프되고, 토글을 펼치기만 해도 임시 저장되고, 서버 글이 같은 slug의 저장소 글을 가려 되돌릴 수 없었다. 저장 직전 unescapeTags, 화면 상태로 옮긴 펼침 여부, DELETE /posts/:slug/server-copy로 수정했다.
---

로컬에서 저장소 글(`safari-macos-ios-rendering.md`)을 수정했는데 화면에 반영되지 않았다. 같은 slug의 글을 예전에 메모 편집기로 게시해서 DB에 행이 남아 있었고, 서버 글은 같은 slug의 저장소 글을 가린다. 원인을 확인하는 과정에서 메모 편집기의 문제 두 가지를 더 발견해, 세 문제를 한 PR([#332](https://github.com/hyeoniverse/MacFolio/pull/332))에서 커밋 하나씩으로 수정했다.

| 문제      | 증상                                                | 수정 후                     |
| --------- | --------------------------------------------------- | --------------------------- |
| 태그      | 저장하면 글 끝 첫 태그가 `\#MacFolio`가 된다        | `#MacFolio` 그대로 저장     |
| 토글      | 내용을 고치지 않고 펼치기만 해도 '임시 저장됨' 표시 | 저장 요청 0회               |
| 저장소 글 | 서버에서 고친 저장소 글을 원래 판으로 돌릴 수 없다  | '저장소 글로 되돌리기' 메뉴 |

세 문제 모두 같은 글을 두 경로(저장소 Markdown, 메모 편집기)로 다루는 구조에서 생겼다. 편집기가 저장하는 Markdown이 원문과 달라지거나(태그, 토글), 서버 사본이 원문을 영구히 덮는다(저장소 글).

## 1. 저장하면 첫 태그가 `\#`로 이스케이프됐다

### 증상

글 끝에 `#MacFolio #테스트 #Playwright` 같은 태그 줄이 있는 글을 편집기로 한 글자만 수정해도, 저장된 Markdown의 태그 줄이 `\#MacFolio #테스트 #Playwright`로 바뀌었다. 읽기 화면은 `\#MacFolio`를 태그로 인식하지 않아, 태그 목록과 태그별 보기에서 그 글이 빠졌다.

![첫 태그 이스케이프 전후와 unescapeTags 규칙](./images/memo-editor-tags-toggle-revert-tags.jpg '"테스트를 붙이자 보인 버그들" 글의 첫 줄에 글자를 더해 저장한 뒤 서버에 저장된 마지막 줄. 수정 전에는 첫 태그 앞에 역슬래시가 붙어 태그가 둘만 인식되고, 수정 후에는 셋 모두 인식된다. 아래 표는 unescapeTags가 되돌리는 경우와 그대로 두는 경우')

### 원인

편집기(Milkdown)는 ProseMirror 문서를 Markdown으로 직렬화할 때 [remark-stringify](https://github.com/remarkjs/remark/tree/main/packages/remark-stringify)를 사용한다. 내부의 [mdast-util-to-markdown](https://github.com/syntax-tree/mdast-util-to-markdown)은 줄 맨 앞(`atBreak`)의 `#`를 제목 표기로 오인되지 않도록 뒤에 오는 글자와 관계없이 `\#`로 이스케이프한다.

그런데 [CommonMark의 ATX 제목](https://spec.commonmark.org/0.31.2/#atx-headings)은 `#` 뒤에 공백·탭이나 줄 끝이 와야 한다. `#MacFolio`처럼 `#` 바로 뒤에 글자가 오면 처음부터 제목이 될 수 없으므로 이스케이프가 필요 없다. 같은 줄의 둘째 태그부터는 줄 맨 앞이 아니어서 이스케이프되지 않았고, 그래서 첫 태그만 깨졌다.

태그를 추출하는 `TAG_PATTERN`(`packages/desktop-core/src/memo/tags.ts`)은 줄 맨 앞이나 공백·여는 괄호 뒤의 `#`만 태그로 인식한다. `\#MacFolio`는 `#` 앞이 `\`라서 조건에 맞지 않는다.

### 수정

저장 직전의 정리 단계에 `unescapeTags`를 추가했다(`writer/markdownImages.ts`, `InlineEditor.tsx`).

```ts
onChangeRef.current(unescapeTags(plainTableAlign(fromEditorMarkdown(next, CONTENT_IMAGES))));
```

````ts
export function unescapeTags(markdown: string): string {
	let fence: string | null = null;
	return markdown
		.split('\n')
		.map((line) => {
			const marker = /^\s*(```|~~~)/.exec(line)?.[1];
			if (marker) {
				if (fence === null) fence = marker;
				else if (fence === marker) fence = null;
				return line;
			}
			if (fence !== null) return line;
			return line.replace(/^((?:\s*(?:[-*+]|\d+[.)])\s+|\s*>\s*)*)\\#(?=[\p{L}\p{N}_-])/u, '$1#');
		})
		.join('\n');
}
````

- 대상: 줄 맨 앞이나 목록·인용 기호(`- `, `* `, `1. `, `> `) 뒤의 `\#` 가운데 바로 뒤에 글자·숫자·`_`·`-`가 오는 것
- 제외: `\# 제목`(되돌리면 제목이 된다), `\##`(`##`는 제목 기호), 펜스 코드 블록 안

이미 `\#태그`로 저장된 서버 글은 다음에 편집기로 저장하는 시각에 수정된다.

## 2. 토글을 펼치기만 해도 임시 저장됐다

### 증상

관리자로 글을 열고 토글(`<details>`)의 › 를 눌러 펼치기만 해도, 잠시 뒤 '임시 저장됨'과 '변경 사항 버리기'가 표시되고 게시 버튼이 활성화됐다. 서버에 실제로 임시 저장 요청이 갔다. 접힌 토글이 있는 글은 읽어 보기만 해도 '게시하지 않은 변경'이 생겼다.

![토글을 펼치기만 한 뒤의 편집기 상단](./images/memo-editor-tags-toggle-revert-toggle.jpg '"Mac에서 Homebrew와 npm 설정하기" 글에서 "먼저 알아 둘 용어" 토글을 펼치기만 하고 1.8초 대기한 화면. 수정 전(왼쪽)은 임시 저장됨과 노란 게시 버튼이 표시되고 저장 요청이 1회 발생한다. 저장된 본문은 <details id="terms">가 <details id="terms" open>으로 바뀐 것뿐이다. 수정 후(오른쪽)는 회색 게시 버튼만 표시된다')

### 원인

펼침 여부가 문서의 일부였다. [토글 목록을 추가한 시각](/memo/memo-editor-toggle-footnote)의 설계는 "접은 상태도 저장된다"였다. › 를 누르면 `setNodeMarkup`으로 `details_block` 노드의 `open` 속성을 반전했고, 이 속성은 Markdown에 `<details open>`으로 직렬화된다. 문서가 바뀌었으므로 편집기의 onChange가 호출되고 임시 저장이 실행됐다. 요약 줄에서 Enter로 펼치는 경로도 같았다.

같은 글에서 목차 링크로 접힌 블록 안의 제목에 이동하는 경로는 이미 화면에서만 펼치고 있었다. 링크로 펼친 위치를 `anchors` 플러그인 상태(`revealed`)에 보관하고 Decoration으로 그리는 방식이다. 직접 › 를 누르는 경로만 문서를 바꾸고 있었다.

### 수정

› 와 Enter도 링크 이동과 같은 방식으로 화면 상태만 바꾼다. 문서는 바꾸지 않는다.

![› 클릭이 바꾸는 대상의 수정 전후](./images/memo-editor-tags-toggle-revert-toggle.svg '수정 전에는 setNodeMarkup이 open 속성을 바꿔 Markdown이 달라지고 임시 저장된다. 수정 후에는 anchors 플러그인 상태의 collapsed·revealed 배열만 바뀌고 Decoration 클래스로 그려서 문서가 그대로다')

- `anchors.ts`의 플러그인 상태에 `revealed`(저장값은 접힘, 화면에서 펼침) 옆에 `collapsed`(저장값은 펼침, 화면에서 접음)를 추가했다
- `isShownOpen(state, pos, node)`가 화면에 펼쳐 보일지 판정하고, `showOnScreen(tr, state, pos, node, show)`가 두 배열만 갱신한다. 문서 위치는 트랜잭션의 `mapping`으로 추적한다
- 그리는 것은 Decoration 클래스 `memo-details-collapsed`·`memo-details-revealed`이고, `styles/markdown.css`의 선택자를 이 클래스에 맞췄다
- 저장되는 펼침 여부는 읽어 온 값 그대로다. 편집기에서 새로 만든 토글만 펼친 상태(`open`)로 저장한다

```ts
export function isShownOpen(state: EditorState, pos: number, node: Node): boolean {
	const { revealed, collapsed } = key.getState(state) ?? EMPTY;
	return node.attrs.open ? !collapsed.includes(pos) : revealed.includes(pos);
}
```

[ProseMirror 트랜잭션](https://prosemirror.net/docs/ref/#state.Transaction)에 메타데이터(`setMeta`)만 실으면 문서는 이전과 같은 값이다. Milkdown의 listener 플러그인은 이전 문서와 새 문서가 같으면(`prevDoc.eq(doc)`) `markdownUpdated`를 호출하지 않으므로, 임시 저장 경로가 실행되지 않는다.

### 빠르게 다시 누르면 접히지 않던 문제

시험 중에 › 를 펼친 직후 다시 누르면 접히지 않는 현상을 함께 발견했다. 두 번째 클릭이 브라우저의 더블클릭 간격 안에 들어오면 ProseMirror는 [`handleDoubleClickOn`](https://prosemirror.net/docs/ref/#view.EditorProps.handleDoubleClickOn)을 호출하고 `handleClickOn`은 호출하지 않는다. 클릭 처리를 `toggleOnClick` 함수로 분리하고 `handleClickOn`·`handleDoubleClickOn`·`handleTripleClickOn` 세 곳에 같은 함수를 연결했다.

이미 `<details open>`으로 저장된 토글은 그대로 남는다. 저장값을 바꾸려면 Markdown에서 `open`을 직접 추가하거나 삭제한다.

## 3. 저장소 글로 되돌릴 수 없었다

### 증상

저장소 글을 메모 편집기로 수정해 게시하면 DB에 같은 slug의 `Post` 행이 생기고, 목록을 병합하는 `mergeServerPosts`가 같은 slug의 저장소 글 대신 서버 글을 사용한다. 이후 저장소 파일을 수정해도 화면에 반영되지 않았다. 처음에 발견한 증상이 이것이다.

원래 저장소 판으로 돌아갈 방법이 없었다. '메모 삭제'와 '영구 삭제'는 저장소 글을 가리는 `deleted` 표시를 남기므로(`mergeServerPosts`가 같은 slug를 목록에서 제거), 글이 저장소 판으로 돌아오지 않고 목록에서 사라진다.

![서버 글이 저장소 글을 가리는 구조와 되돌리기 경로](./images/memo-editor-tags-toggle-revert-revert.svg '되돌리기 전에는 DB의 Post 행이 같은 slug의 저장소 글을 가린다. DELETE /posts/:slug/server-copy가 트랜잭션 하나로 PostRevision과 Post 행을 삭제하면 저장소 글이 다시 표시된다. 메모 삭제는 deleted 표시를 남겨 저장소 글까지 숨긴다')

### 수정

- **API**: `DELETE /posts/:slug/server-copy`를 추가했다(`AdminGuard`, `@RateLimit('write')`). 잠긴 메모면 409, 서버에 행이 없으면 404를 반환한다. 행이 있으면 트랜잭션 하나로 그 글의 `PostRevision`과 `Post` 행을 삭제한다. `openapi.json`과 경로 권한 표(`routes.e2e.test.ts`)도 갱신했다
- **desktop-core**: 관리자 목록을 병합하는 `mergeAdminPosts`가 같은 slug의 저장소 글이 있으면 글 상태에 `overridesRepo: true`를 기록한다
- **메모 앱**: `overridesRepo`인 글에만 '저장소 글로 되돌리기'를 표시한다. 위치는 우클릭 메뉴, 도구 막대의 •••, 휴대폰의 ••• 세 곳이다. 취소할 수 없는 동작이라 경고창으로 먼저 확인한다. 되돌린 뒤에는 임시 저장을 버렸을 때와 같은 경로(`draft.onDiscarded(slug, null)`)로 편집기를 저장소 글로 다시 그린다

```ts
async revertToRepository(slug: string) {
	this.checkSlug(slug);
	await this.checkUnlocked(slug);
	const row = await this.prisma.post.findUnique({ where: { slug } });
	if (!row) throw new NotFoundException('서버에 없는 글입니다.');
	await this.prisma.$transaction([
		this.prisma.postRevision.deleteMany({ where: { postSlug: slug } }),
		this.prisma.post.delete({ where: { slug } }),
	]);
}
```

서버는 빌드에 묶인 저장소 Markdown 목록을 알지 못한다. 저장소에 없는 글에 이 경로를 호출하면 글이 사라진다. 그래서 판정은 저장소 목록을 가진 프론트엔드(`overridesRepo`)가 하고, 메뉴도 그 글에만 표시한다.

![되돌리기 메뉴와 확인창](./images/memo-editor-tags-toggle-revert-revert-ui.jpg '서버에서 제목을 고친 저장소 글을 우클릭한 메뉴의 "저장소 글로 되돌리기" 항목(왼쪽)과, 서버의 수정 내용·임시 저장·버전 기록이 모두 삭제된다고 알리는 확인창(오른쪽)')

DB 마이그레이션은 없다. API는 경로 하나만 추가하므로 API와 사이트의 배포 순서는 무관하다. 사이트가 먼저 배포되면 되돌리기만 404로 실패한다.

## 확인

<details>
<summary>단위·API e2e·화면 E2E 시험 항목</summary>

- 단위: 줄 맨 앞과 목록·인용 기호 뒤의 `\#태그`는 되돌리고 뒤에 이어지는 태그는 그대로인지, `\# 제목`·`\##`·코드 블록 안은 그대로인지, `mergeAdminPosts`가 `overridesRepo`를 기록하는지, 되돌리기 메뉴가 `overridesRepo`인 글에만 있는지
- API e2e(`posts`·`routes`, 23개): 되돌리면 방문자·관리자 목록에서 빠지고 버전도 삭제되는지, 401·404·409, 경로 권한 표
- 화면 E2E 태그: 태그 줄이 있는 글을 수정해 저장해도 `\#`가 없는지. 수정 코드를 제거하면 이 시험이 실패하는 것도 확인했다
- 화면 E2E 토글: 글을 열어 본문을 누르고, 커서를 옮기고, 토글을 펼쳤다 접기만 하면 저장 요청이 0회인지. 가짜 API(`e2e/fakeApi.ts`)에 저장 요청 집계 `postSaves`를 추가했다
- 화면 E2E 되돌리기: 수정하지 않은 글에는 메뉴가 없는지, 취소하면 그대로인지, 되돌리면 저장소 글이 표시되는지

</details>

토글 캡처는 같은 조작을 main 빌드와 수정 빌드에서 실행해 비교했다. main은 저장 요청 1회(본문이 `<details id="terms" open>`으로 변경), 수정 빌드는 0회였다.

## 남은 것

- `unescapeTags`는 remark-stringify의 출력을 문자열로 후처리한다. 직렬화 규칙(`unsafe` 패턴)을 바꾸는 방식이 더 근본적이지만, Milkdown이 감싼 remark 설정을 건드려야 해서 이번에는 저장 직전 정리 단계에 두었다. 같은 단계에 표 정렬 표기를 정리하는 `plainTableAlign`이 이미 있다
- 화면에서만 펼친 상태는 편집기를 다시 열면 초기화된다. 읽기 화면도 같은 동작이다
- 서버가 저장소 글 목록을 모르는 구조는 그대로다. 저장소 글인지의 판정은 프론트엔드의 `overridesRepo`에만 의존한다

## 관련 글

- [메모 편집기 손보기 — 토글 목록·각주](/memo/memo-editor-toggle-footnote): 토글 노드와 `revealed` 플러그인 상태를 처음 만든 글. 그 시점에는 › 로 접은 상태도 저장했다
- [메모 태그](/memo/memo-tags): 본문의 `#태그`를 인식하는 규칙. 이 글의 첫 태그 문제는 그 규칙이 `\#`를 태그로 보지 않아서 드러났다
- [한 줄에 서식 하나](/memo/memo-one-style-per-line): 같은 편집기의 줄 서식 변환 수정
- [바로 고치는 블로그에 임시 저장과 버전 기록 붙이기](/memo/drafts-and-versions): 되돌리기가 삭제하는 `Post`·`PostRevision`의 구조

#MacFolio #메모앱 #프론트엔드 #트러블슈팅 #ProseMirror
