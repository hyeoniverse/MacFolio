---
title: 한 줄 한 서식 규칙으로 ProseMirror 줄 서식 변환하기
date: 2026-10-16
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 메모 편집기
seriesOrder: 6
summary: 메모 편집기에서 목록 항목을 머리말로 바꾸면 반응이 없고, 머리말을 토글로 바꾸면 빈 토글이 추가됐다. 노션 대신 macOS 메모처럼 한 줄에 서식 하나로 정해 선택한 서식으로 그 줄을 변환하고, 구분선 스타일과 --- 저장도 수정했다.
---

메모 편집기에서 목록 항목에 커서를 두고 서식 메뉴의 '머리말'을 누르면 아무 변화가 없었다. 머리말에서 '토글 목록'을 누르면 머리말은 그대로 두고 빈 토글이 아래에 하나 더 추가됐다. 토글 제목에서 '제목'을 눌러도 변화가 없었다. [토글 목록을 추가한](/memo/memo-editor-toggle-footnote) 다음 날 수정했다. 함께 발견한 구분선 스타일 문제까지 한 PR([#227](https://github.com/hyeoniverse/MacFolio/pull/227))로 수정했다.

## 배경: 줄 서식과 ProseMirror 스키마

**줄 서식**(블록 서식)은 한 줄 전체의 종류를 정하는 서식이다. 굵게·기울임처럼 글자 일부에 붙는 서식과 달리, 그 줄이 제목인지, 목록 항목인지, 인용인지를 정한다. 메모 편집기는 도구 막대의 '가가' 버튼으로 서식 메뉴를 연다.

![메모 편집기의 서식 메뉴](./images/memo-one-style-per-line-menu.jpg '목록 항목 "우유"에 커서를 두고 연 서식 메뉴. 맨 위 줄은 글자 서식 버튼이고, 그 아래는 줄 서식이다. 현재 줄의 서식인 구분점 목록에 체크 표시가 있다')

메뉴의 맨 위 줄은 글자 서식이고, 그 아래의 제목·머리말·부머리말·본문·모노 스타일, 구분점·번호·체크리스트 목록, 블록 인용, 토글 목록이 줄 서식이다. 현재 줄의 서식에는 체크 표시가 붙는다. 이 메뉴는 macOS 메모의 서식 메뉴를 그대로 따랐다.

편집기는 [ProseMirror](https://prosemirror.net/docs/guide/)로 만들었다. ProseMirror는 글을 문자열이 아닌 **노드의 트리**로 다룬다. 예를 들어 "장보기" 문단과 "우유", "달걀" 두 항목의 목록은 다음 트리다.

```text
doc
├─ paragraph "장보기"
└─ bullet_list
   ├─ list_item
   │  └─ paragraph "우유"
   └─ list_item
      └─ paragraph "달걀"
```

노드마다 담을 수 있는 자식은 **스키마**의 콘텐츠 표현식[^content-expr]으로 정해진다. 목록 항목(`list_item`)의 표현식은 `paragraph block*`, 즉 "첫 자식은 문단, 그 뒤에 블록 0개 이상"이다. ProseMirror는 문서를 바꾸는 모든 명령을 이 규칙으로 검사하고, 규칙을 어기는 변경은 적용하지 않는다.

## 노션 방식과 macOS 메모 방식

노션은 목록 안에 제목을 넣을 수 있고, 제목 자체를 토글로 만들 수도 있다. ==macOS 메모는 줄마다 서식이 하나==다. 제목·머리말·부머리말·본문·모노 스타일·목록 세 종류 가운데 하나를 선택하면, 기존 서식은 해제된다.

| 방법                                         | 장점                                                      | 단점                                                                                             |
| -------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 노션처럼 겹쳐 쓰기 (목록 안 제목, 제목 토글) | 표현 범위가 넓다                                          | Markdown에서 `- ## 제목`, `<summary>` 안의 서식이 되어 읽기 화면에서 어색하거나 렌더링할 수 없다 |
| 현재 동작 유지 (반응 없음)                   | 추가 작업이 없다                                          | 누른 버튼이 반응하지 않는다. 버그로 보인다                                                       |
| **macOS 메모처럼 한 줄에 서식 하나**         | 서식 메뉴가 이미 이 구조, 저장한 Markdown이 표준 형식이다 | 노션에 익숙한 사람에게는 제약으로 보인다                                                         |

macOS 메모 방식을 선택했다. 근거는 세 가지다.

1. 서식 메뉴가 처음부터 macOS 메모의 서식 목록을 그대로 따른다. 항목도 하나만 선택하는 라디오 항목(ARIA [`menuitemradio`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menuitemradio_role) 역할)이다.
2. 글은 Markdown으로 저장된다. 목록 안의 제목은 `- ### 우유`가 되는데, 읽기 화면에서는 목록 기호 옆에 큰 제목이 붙어 어색하다.
3. 토글 제목을 머리말로 만들려면 `<summary>` 안에 서식을 넣어야 한다. 읽기 화면은 본문의 HTML을 렌더링하지 않고, 토글 제목도 XSS[^xss]를 막기 위해 텍스트로만 삽입한다.

![겹쳐 쓰기와 한 줄 한 서식의 저장값](./images/memo-one-style-per-line-markdown.svg '목록 항목 "우유"를 머리말로 바꾼 결과. 겹쳐 쓰면 - ### 우유가 저장되어 목록 기호 옆에 큰 제목이 붙고, 한 줄 한 서식이면 ### 우유와 - 달걀이 각자의 줄로 저장된다')

## 선택한 서식으로 그 줄을 변환

반응이 없던 경우를 모두, 선택한 서식으로 그 줄을 변환하도록 바꿨다.

| 현재 줄   | 선택한 서식           | 결과                                                       |
| --------- | --------------------- | ---------------------------------------------------------- |
| 목록 항목 | 제목·머리말·본문·모노 | 목록에서 꺼내 그 서식으로 (나머지 항목은 목록 유지)        |
| 목록 항목 | 토글 목록             | 목록에서 꺼내 그 텍스트를 제목으로 하는 토글               |
| 머리말    | 토글 목록             | 머리말 텍스트가 토글 제목 (빈 토글을 새로 만들지 않는다)   |
| 머리말    | 목록                  | 본문으로 바꿔 목록에 넣는다 (목록 항목의 첫 줄은 본문이다) |
| 토글 제목 | 제목·목록·인용        | 토글을 해제하고 그 줄을 그 서식으로 (내용은 아래에 유지)   |

![목록 항목과 토글 제목에서 서식을 바꾸는 순서](./images/memo-one-style-per-line-convert.svg '먼저 목록이나 토글에서 꺼낸 다음 선택한 서식으로 변환한다')

목록 항목 안에서 문단을 머리말로 바꾸는 명령은 ==스키마 검사에 걸려 변경 없이 실패==했다. `list_item`의 첫 자식이 머리말(`heading`)이 되면 `paragraph block*`에 맞지 않기 때문이다. 명령은 `false`를 돌려주고 문서는 그대로였다. 화면에서는 버튼을 눌러도 반응이 없는 것으로 보였다.

![목록 항목에서 머리말을 골랐을 때의 문서 트리](./images/memo-one-style-per-line-schema.svg '수정 전에는 list_item 안의 paragraph를 그 자리에서 heading으로 바꾸려다 스키마 검사에 걸린다. 수정 후에는 leaveList로 항목을 목록 밖으로 꺼낸 뒤 heading으로 바꾼다')

이제 목록에서 먼저 꺼낸 다음 변환한다. 목록에서 꺼내는 `leaveList`는 커서가 목록 항목 안에 있는 동안 ProseMirror의 목록 들어 올리기 명령(`liftListItem`)을 반복한다. 두 단계로 중첩된 목록이면 두 번 들어 올려 최상위 문단이 된다.

```ts
case 'block': {
	// macOS 메모처럼 한 줄에 모양은 하나: 목록이나 토글 제목에서 고르면 그 줄을 꺼내 고른 모양으로 바꾼다
	const converted = current.summary || current.list !== null;
	if (current.summary) toggleDetails(view);
	else if (current.list) leaveList(ctx);
	// …
}
```

토글 제목에 커서가 있으면 서식 메뉴에서 '본문'이 아니라 '토글 목록'이 선택된 상태로 표시되게 했다. 커서 위치의 서식 정보에 `summary`(토글 제목 줄인지)를 추가했다.

## 구분선

구분선(`---`)은 스타일이 지정되지 않아 브라우저 기본값으로 렌더링됐다. 브라우저의 기본 스타일시트는 `<hr>`에 회색 테두리를 `inset`(안쪽으로 파인 입체 효과) 방식으로 그린다. 위 여백만 있고 아래 여백은 0이었다. 다크 모드에서는 밝고 굵은 선으로 표시됐다.

테두리색 1px 선에, 위아래 1.8em의 같은 여백으로 바꿨다. 본문 글자 크기가 14px이면 여백은 위아래 각각 25.2px이다. 편집기도 `.memo-markdown` 클래스를 사용하므로 읽기 화면과 같은 규칙이 적용된다. 편집기에서 구분선을 선택하면 강조색 외곽선이 표시된다.

편집기는 구분선을 `***`로 저장하고 있었다([remark-stringify](https://github.com/remarkjs/remark/tree/main/packages/remark-stringify)의 `rule` 옵션 기본값). Markdown에서 `---`, `***`, `___`는 모두 같은 구분선이다. 기존 글은 `---`를 사용하므로, 목록 기호 옵션(`bullet: '-'`)과 같은 방식으로 `rule: '-'`을 지정했다. 지정하지 않으면 저장소 글을 편집기에서 한 번 수정할 때마다 `---`가 `***`로 바뀌어, ==수정한 줄과 무관한 diff가 생긴다==.

```diff
 문단 하나를 고쳤다.

----
+***

 다음 절
```

```css
.memo-markdown hr {
	height: 1px;
	margin: 1.8em 0;
	border: none;
	background-color: var(--memo-border);
}

/* 편집기에서 구분선을 고르면 (눌러서, 또는 화살표로) 강조색 테두리 */
.memo-inline-editor hr.ProseMirror-selectednode {
	outline: 2px solid var(--memo-accent);
	outline-offset: 4px;
}
```

![구분선 전후](./images/memo-one-style-per-line-hr.svg '브라우저 기본 입체 선 대신 1px 테두리색 선, 위아래 같은 여백, ---로 저장')

## 확인

`e2e/memo-editor.spec.ts`에 시험 두 개를 추가했다(78줄).

- "목록 항목·토글 제목에서 머리말을 고르면 그 줄을 꺼내 머리말로, 머리말에서 토글을 고르면 그 글자가 토글 제목…": 위 표의 변환을 차례로 실행하고, 저장된 Markdown을 확인한다.
- "구분선은 가는 테두리색 선에 위아래 같은 여백, 편집기에서 고쳐도 --- 그대로 저장한다": 계산된 높이와 위아래 여백이 같은지, 저장한 본문에 `---`가 유지되는지 확인한다.

PR의 변경 규모는 8개 파일, 177줄 추가, 8줄 삭제다. 편집기 코드의 변경은 `formatCommands.ts`의 `'block'` 처리(19줄)와 커서 위치 서식 정보에 `summary`를 추가한 것이 대부분이다.

## 정리

- 기능을 선택하는 기준은 "무엇이 더 많은 표현을 지원하는가"가 아니라 =="저장한 글이 어떻게 표시되는가"==였다. 이 편집기의 결과물은 Markdown 파일이고, 그 파일은 저장소와 GitHub에서도 렌더링된다.
- 라이브러리와 브라우저의 기본값(`***`, 회색 입체 선)은 이 블로그 글의 규칙과 다를 수 있다. 처음 사용하는 요소는 기본값을 먼저 확인한다.

## 관련 글

- [Milkdown 편집기에 <details> 토글 목록과 GFM 각주 노드 추가하기](/memo/memo-editor-toggle-footnote)
- [ProseMirror 표의 틈 커서·셀 범위 선택·Backspace 삭제를 macOS 메모처럼 만들기](/memo/table-gap-cursor)
- [remark-cjk-friendly로 한국어 조사 앞에서 깨지는 CommonMark 굵게 바로잡기](/memo/cjk-emphasis)

[^content-expr]: ProseMirror 스키마에서 노드가 담을 수 있는 자식의 종류와 순서를 정규식과 비슷한 문법으로 적은 것. `paragraph block*`은 "문단 하나 다음에 블록 0개 이상"이라는 뜻이다. [ProseMirror Guide: Content Expressions](https://prosemirror.net/docs/guide/#schema.content_expressions)

[^xss]: 교차 사이트 스크립팅(Cross-Site Scripting). 페이지에 삽입된 HTML이나 스크립트가 방문자의 브라우저에서 실행되게 만드는 공격이다. 글자를 HTML로 해석하지 않고 텍스트로만 넣으면 `<script>`도 글자 그대로 표시된다. [MDN: Cross-site scripting](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)

<details>
<summary>참고 문헌</summary>

- [ProseMirror Guide: Documents, Schemas](https://prosemirror.net/docs/guide/#doc)
- [prosemirror-schema-list: liftListItem](https://prosemirror.net/docs/ref/#schema-list.liftListItem)
- [MDN: ARIA menuitemradio role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menuitemradio_role)
- [MDN: \<hr\>: The Thematic Break element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/hr)
- [CommonMark Spec 0.31.2: Thematic breaks](https://spec.commonmark.org/0.31.2/#thematic-breaks)
- [remark-stringify: Options (rule, bullet)](https://github.com/remarkjs/remark/tree/main/packages/remark-stringify#options)
- [Apple 지원: Mac에서 메모 포맷 지정하기](https://support.apple.com/ko-kr/guide/notes/apd1955d3b21/mac)

</details>

#MacFolio #메모앱 #프론트엔드 #트러블슈팅
