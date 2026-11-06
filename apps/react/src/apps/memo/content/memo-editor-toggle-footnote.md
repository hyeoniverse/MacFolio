---
title: Milkdown 편집기에 <details> 토글 목록과 GFM 각주 노드 추가하기
date: 2026-10-15
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 메모 편집기
seriesOrder: 5
summary: 편집기 서식 메뉴에 토글 목록과 각주를 추가하고, <details> 표기를 토글로 읽어 같은 표기로 저장한다. 220~440px가 취소선이 되던 문제, 마지막 글이 이동하면 폴더가 사라지던 문제, 긴 요약 때문에 게시가 실패하던 문제도 수정했다.
---

메모 앱을 사용하면서 발견한 문제 네 가지를 한 번에 수정했다. 셋은 버그였고, 하나는 편집기에 없던 기능이다. PR([#225](https://github.com/hyeoniverse/MacFolio/pull/225))의 변경 규모는 커밋 여덟 개, 42개 파일, 1,435줄 추가, 56줄 삭제다.

| 문제                               | 분류 | 수정                                              |
| ---------------------------------- | ---- | ------------------------------------------------- |
| 요약이 200자를 넘는 글은 게시 불가 | 버그 | 저장소 글 요약 단축, 모든 글을 검사하는 시험 추가 |
| `220~440px`가 취소선으로 렌더링    | 버그 | `~` 하나짜리 취소선 비활성화                      |
| 마지막 글이 이동하면 폴더가 사라짐 | 버그 | 떠난 폴더를 만든 폴더로 보관                      |
| 편집기에 토글·각주 입력 수단 없음  | 기능 | 서식 메뉴에 토글 목록·각주 추가                   |

## 배경: 토글과 각주, 두 렌더러

**토글**은 제목 한 줄만 보이다가 누르면 내용이 펼쳐지는 블록이다. HTML에는 이 동작을 위한 [`<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details) 요소가 있다. `<summary>`에 적은 글자가 항상 보이는 제목이 되고, 나머지 내용은 사용자가 제목을 누르기 전까지 숨겨진다. 스크립트 없이 브라우저가 접기·펼치기를 처리하므로, GitHub도 Markdown 안의 `<details>`를 같은 접기 블록으로 렌더링한다.

```markdown
<details>
<summary>먼저 알아 둘 용어</summary>

| 용어         | 뜻                                       |
| ------------ | ---------------------------------------- |
| first-parent | 병합 커밋의 첫 번째 부모만 따라가는 이력 |

</details>
```

**각주**는 본문 문장에 작은 번호를 달고, 부연 설명은 글 끝에 따로 적는 표기다. 본문의 흐름을 끊지 않고 용어 정의나 출처를 덧붙일 수 있다. 위키백과는 각주 번호에 마우스를 올리면 각주 내용을 미리 보여 준다.

![위키백과의 각주 미리 보기](./images/memo-editor-toggle-footnote-wikipedia.jpg '영어 위키백과 문서에서 본문 끝의 각주 표시 [e]에 마우스를 올리면 글 끝에 있는 각주 내용이 말풍선으로 표시된다')

CommonMark에는 각주 문법이 없다. 이 블로그는 GitHub가 확장 Markdown(GFM, GitHub Flavored Markdown)에서 지원하는 `[^이름]` 표기를 사용한다. 본문에 `[^no-ff]`처럼 참조를 적고, 글 어딘가에 `[^no-ff]: 설명`으로 내용을 적는다. GFM의 표·취소선·각주 문법은 [remark-gfm](https://github.com/remarkjs/remark-gfm) 플러그인이 읽는다.

같은 Markdown을 이 사이트는 두 렌더러로 표시한다.

| 화면      | 라이브러리                         | 보는 사람       |
| --------- | ---------------------------------- | --------------- |
| 읽기 화면 | react-markdown + remark-gfm        | 방문자          |
| 편집 화면 | Milkdown(ProseMirror) + remark-gfm | 로그인한 관리자 |

편집기는 Markdown을 [ProseMirror](https://prosemirror.net/docs/guide/) 문서로 바꿔 편집한다. ProseMirror 문서는 노드의 트리이고, 노드의 종류(문단, 제목, 목록 항목 등)와 각 노드가 담을 수 있는 자식은 **스키마**로 정의한다. 스키마에 없는 표기는 편집기가 이해하지 못하므로, 토글과 각주를 편집하려면 노드 종류를 새로 정의하고 Markdown과 노드 사이의 변환 규칙을 함께 작성해야 한다. 이 글의 네 문제 가운데 둘(취소선, 토글·각주)은 이 두 렌더러가 같은 글을 같게 읽도록 맞추는 작업이다.

## 요약이 200자를 넘는 글은 게시할 수 없었다

글을 수정하면 "요약은 200자까지 입력할 수 있습니다."가 표시되고 저장도 게시도 실패했다. 글쓰기 규칙(`validateDraft`)은 요약을 200자까지 허용하는데, ==저장소 글 18개의 머리말 요약이 203~352자==였다. 편집 화면에는 요약 입력란이 없어서 수정할 방법도 없었다.

요약을 200자 이내로 줄이고, 저장소 글이 모두 글쓰기 규칙을 지키는지 시험으로 확인한다. 이제 개발기 글의 요약이 길면 커밋 전 시험에서 실패한다.

```ts
it.each(Object.entries(files))('%s는 글쓰기 규칙에 맞다', (path, source) => {
	const post = toPost(path as PostSlug, source);
	const { title, date, category, summary, body } = post!;
	expect(validateDraft({ title, date, category, summary, body })).toEqual({});
});
```

경고 문구가 날짜·폴더 줄과 겹치던 문제도 함께 수정했다. 저장 상태는 날짜 줄 오른쪽 끝에 `position: absolute`로 배치하는데, 편집 칸이 640px보다 넓으면 별도 줄로 내리지 않았다. 경고 문구는 길어서 가운데의 날짜까지 가렸다. 경고가 있으면 너비와 관계없이 별도 줄로 배치하고, 그래도 길면 줄바꿈한다. 조건은 [`:has()`](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)로 판별한다.

```css
.memo-writer-meta:has(.memo-writer-status.problem) .memo-writer-actions {
	position: static;
	order: -1;
	width: 100%;
}
```

## 220~440px가 취소선이 됐다

[메모 칸 너비 글](/memo/memo-pane-resize)에 적은 "사이드바 180~360px, 목록 220~440px"가 읽기 화면에서 `360px, 목록 220` 부분에 취소선이 그어진 채 렌더링됐다. [remark-gfm](https://github.com/remarkjs/remark-gfm)은 기본값으로 `~` 하나짜리 취소선도 인식한다. 한 줄에 `~`가 두 번 나오면 그 사이가 취소선이 된다.

![remark-gfm 옵션별 해석 결과](./images/memo-editor-toggle-footnote-single-tilde.svg '같은 원문이 기본값에서는 두 ~ 사이가 <del>(취소선)이 되고, singleTilde: false에서는 글자 그대로 남는다')

[GFM 명세](https://github.github.com/gfm/#strikethrough-extension-)는 `~` 한 개나 두 개로 감싼 글자를 모두 취소선으로 정의하고(예제 491의 `~there~`), remark-gfm도 기본값으로 이 규칙을 따른다. 그러나 한국어 글은 범위를 `~`로 표기하는 경우가 많고, 취소선은 `~~`로 충분하다. 읽기 화면은 `singleTilde: false`로 바꾸고, 편집기(Milkdown)도 같은 옵션으로 파싱한다. 편집기의 입력 규칙(input rule)은 `~` 하나도 인식하는 정규식이라, 그 규칙을 제거하고 `~~`만 인식하는 규칙을 추가했다.

```ts
export const GFM_OPTIONS = { singleTilde: false } as const;

const strikethroughDoubleTilde = $inputRule((ctx) =>
	markRule(/(?<![\w:/])~~(.+?)~~(?!\w|\/)$/, strikethroughSchema.type(ctx))
);
const gfmWithoutSingleTilde = gfm.filter((plugin) => plugin !== strikethroughInputRule);
```

편집기는 저장하면서 `~`를 `\~`로 이스케이프한다. 읽기 화면에는 `~`로 표시되지만 목록 미리 보기에는 `\`가 남아서, 미리 보기를 생성하는 `excerpt`에서 제거한다.

## 마지막 글이 이동하면 폴더가 사라졌다

폴더 목록은 관리자가 만든 폴더(`organization.folders`)와 글의 폴더(`category`)를 병합해 렌더링한다. 저장소 글에서 생긴 폴더는 만든 폴더 목록에 없으므로, ==마지막 글을 이동하거나 삭제하면 폴더도 목록에서 사라졌다==.

글이 폴더를 떠나는 경로는 네 가지다. 드래그 앤 드롭, 여러 개 선택해 이동, 삭제, 편집 화면의 폴더 변경. 네 경로 모두에서 떠난 폴더를 만든 폴더 목록에 보관한다.

```ts
export function keepFolder(organization: Organization, path: string): Organization {
	if (!path || organization.folders.includes(path as FolderPath)) return organization;
	return { ...organization, folders: [...organization.folders, asPath(path)] };
}
```

보관한 폴더는 만든 폴더와 같으므로, 비어 있으면 삭제할 수 있다.

![폴더 목록의 두 출처](./images/memo-editor-toggle-footnote-folders.svg '글의 폴더에서만 생긴 폴더는 마지막 글이 이동하면 사라졌다. 이동 시 만든 폴더로 보관한다')

## 편집기에 토글 목록과 각주

토글과 각주가 필요해진 시점은 10월 12일 [병합 방식 글](/memo/merge-strategies)을 수정하던 시각이었다. first-parent, bisect 같은 용어에 부연 설명을 붙이니 본문이 길어져서 설명을 각주로 분리하려 했고, 글 앞의 "먼저 알아 둘 용어"는 ▸ 토글로 접으려 했다. 저장소 Markdown에서는 사용할 수 있었지만 메모 편집기에는 두 기능 모두 없었다. 접기 토글을 추가한 뒤에는 그 모서리 반경이 다른 요소와 같은지도 확인했다([자주 쓰는 border-radius 여섯 값을 --radius-* 디자인 토큰으로 바꾸기](/memo/design-tokens#모서리-반경---radius--여섯-값-232)).

읽기 화면은 이미 [`<details>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)·`<summary>` 표기를 접기 블록으로, `[^1]`을 각주로 렌더링했다. 편집기에는 두 요소를 입력할 방법이 없었고, `<details>` 줄은 HTML 원문 그대로 표시됐다.

![<details> 표기를 토글 노드로 읽고 되돌리는 과정](./images/memo-details-roundtrip.svg '읽는 단계에서는 HTML 줄 사이를 토글 노드로 감싸고, 저장 단계에서는 HTML 줄 두 개와 내용 블록으로 되돌린다')

토글을 Markdown에 어떤 문법으로 저장할지부터 정했다.

| 표기                             | 장점                                              | 단점                                                                           |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `:::details 제목` 같은 디렉티브  | 한 줄로 표기된다                                  | GitHub·다른 Markdown 도구에서는 텍스트 그대로 보인다. 플러그인을 추가해야 한다 |
| 목록에 표시 추가 (`- [>] 제목`)  | 목록 문법과 비슷하다                              | 표준이 아니라 이 사이트에서만 동작한다                                         |
| **`<details>`·`<summary>` HTML** | GitHub도 접기로 렌더링한다, 읽기 화면이 이미 지원 | 편집기가 HTML 줄을 블록으로 처리해야 한다                                      |

읽기 화면이 이미 `<details>`를 렌더링하고 있었고, 저장소 글도 이 표기를 사용하고 있었다. 따라서 편집기가 기존 표기를 지원하는 방향을 선택했다.

토글은 [ProseMirror](https://prosemirror.net/docs/guide/) 노드 두 개로 구현했다. `details_block`(속성 `open`, `id`)은 요약 한 줄과 블록 여러 개를 담고, `details_summary`는 서식 없는 텍스트만 담는다. 저장하면 여는 태그 줄과 닫는 태그 줄을 HTML 노드로, 내용 블록과 같은 계층에 나란히 출력한다. 그래서 읽기 화면이 파싱하던 표기와 같다.

```ts
runner: (state, node) => {
	state.addNode('html', undefined, detailsOpenHtml({ summary, open: node.attrs.open, id: node.attrs.id }));
	state.next(Fragment.from(blocks));
	state.addNode('html', undefined, '</details>');
},
```

> [!WARNING] 문단 안에 생성된 토글 노드
> 첫 구현에서는 저장소 글을 열면 `<details>` 줄이 전부 사라졌다. Milkdown은 최상위 HTML을 문단으로 감싸는데, 토글을 찾는 함수가 그 문단 내부까지 탐색해 문단 안에 토글 노드를 생성했다. 문단은 인라인 콘텐츠만 담을 수 있으므로 "Cannot create node for paragraph" 오류가 발생하고 그 줄이 폐기됐다. 문단 내부는 탐색하지 않고, 문단 하나가 HTML 한 줄인 경우에만 여는·닫는 태그 줄로 판별하도록 수정했다.

사용 방법은 다음과 같다.

| 동작                                  | 결과                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| 서식 메뉴(가가)의 **토글 목록**       | 현재 줄이 토글 제목이 되고 커서는 접히는 내용으로 이동                                  |
| 제목 앞의 › 클릭                      | 접기·펼치기. 접은 상태도 저장된다(`<details open>`의 `open`이 제거됨)                   |
| 제목에서 Enter                        | 내용 첫 줄로 이동 (한글 조합 중의 Enter는 처리하지 않음)                                |
| 제목 맨 앞에서 Backspace, 메뉴 재선택 | 토글 해제                                                                               |
| **각주 넣기**                         | 커서 위치에 사용하지 않은 가장 작은 번호로 `[^n]` 삽입, 글 끝에 각주 내용을 만들고 이동 |

![편집기에서 펼친 토글](./images/memo-editor-toggle-footnote-editor.jpg '관리자 편집기에서 병합 방식 글을 연 화면. "먼저 알아 둘 용어" 토글을 펼치면 안의 표가 편집 가능한 상태로 표시된다')

읽기 화면은 [GFM 각주 규칙](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes)대로 본문에 나온 순서로 번호를 다시 매긴다. 저장한 식별자가 `[^no-ff]`든 `[^1]`이든, 각주 내용을 글 끝 어느 위치에 적었든, 본문에서 처음 참조한 순서가 화면의 번호가 된다.

![각주 식별자와 화면 번호](./images/memo-editor-toggle-footnote-numbering.svg '각주 내용은 bisect가 먼저 적혀 있지만, 본문에서 no-ff를 먼저 참조하므로 no-ff가 1번, bisect가 2번이다')

각주 내용을 글 끝에 추가하는 과정에서 문제가 하나 있었다. 편집기는 글 끝에 항상 빈 문단을 하나 유지하는데, 그 뒤에 각주를 추가하면 빈 문단이 글 중간에 남아 `<br />`로 저장됐다. 각주 내용을 그 빈 문단 앞에 삽입하도록 수정했다.

## 편집 화면을 읽기 화면과 맞추기

관리자는 글을 열면 바로 편집기 화면이 표시된다. 그런데 편집기에서는 각주 번호나 `[용어 보기](#terms)` 같은 글 내부 링크를 눌러도 반응이 없었다. 각주 번호도 저장한 식별자(`no-ff`)가 그대로 표시되어, 읽기 화면의 1, 2, 3과 달랐다.

- **번호**: 읽기 화면(remark-gfm)처럼 본문에 처음 나온 순서로 매긴다. 순서는 문서가 바뀔 때마다 데코레이션으로 계산하고, 각주 참조와 각주 내용의 노드 뷰가 그 번호를 렌더링한다.
- **이동**: 번호를 누르면 각주 내용으로, 각주 끝의 ↩를 누르면 본문의 참조 위치로, 글 내부 링크를 누르면 해당 접기 블록으로 스크롤하고 읽기 화면처럼 잠시 강조 표시한다. 링크 텍스트를 편집하려면 Option을 누른 채 클릭한다.
- **접힌 블록**: 링크를 따라가며 접힌 블록을 펼치면서 `open` 속성을 바꾸면, 그 시점에 저장한 글에 `<details open>`이 남는다. 읽기 화면은 화면에서만 펼치므로, 편집기도 펼친 위치를 플러그인 상태에만 저장하고 데코레이션으로 펼친다.

![편집기 하단의 각주 목록](./images/memo-editor-toggle-footnote-defs.jpg '편집기에서도 각주가 본문 순서대로 1, 2, 3으로 번호가 매겨지고, 끝의 ↩로 본문의 참조 위치로 돌아간다. 각주 안의 "먼저 알아 둘 용어" 링크는 토글로 이동한다')

> [!WARNING] 데코레이션을 제거하면 속성도 삭제된다
> 처음에는 그 데코레이션으로 `data-open="true"`를 덮어썼다. 그러자 ›로 다시 접으면 속성이 `false`로 돌아가지 않고 삭제되어, 블록이 접히지 않았다. ProseMirror는 데코레이션을 제거하면서 그 속성을 원래 값으로 복원하지 않고 삭제한다. 그래서 별도 클래스(`memo-details-revealed`)를 추가하고, CSS는 둘 중 하나라도 있으면 펼친 상태로 처리한다.

줄 높이와 여백은 같은 글을 두 화면에서 열고, 본문 블록마다 위치와 높이를 측정해 맞췄다. 관리자 표시를 누르면 읽기 화면으로 전환되므로 같은 창 크기에서 측정할 수 있다. 차이가 있는 곳은 두 군데였다.

|                        | 편집기 | 읽기 화면 | 원인                                                       |
| ---------------------- | ------ | --------- | ---------------------------------------------------------- |
| 본문 글자              | 15px   | 14px      | 편집 칸이 700px보다 좁으면 본문을 키우던 옛 규칙           |
| 긴 코드가 든 목록 항목 | 147px  | 123px     | 편집기는 긴 코드를 줄 바꾸고, 읽기 화면은 칸 밖으로 넘겼다 |

이전 규칙을 삭제하고, 읽기 화면에도 [`overflow-wrap: break-word`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)를 지정했다. 이제 문단, 제목, 목록, 표, 이미지, 코드, 접기 블록, 각주가 두 화면에서 같은 위치에 배치된다. ==남은 차이는 편집기 맨 위의 저장 상태·게시 줄뿐==이다.

## 시험

<details>
<summary>시험 항목 (단위, 화면 E2E)</summary>

- 단위: 모든 저장소 글이 글쓰기 규칙에 맞는지, `~` 하나는 글자 그대로이고 `~~`만 취소선인지, 떠난 폴더가 남고 비면 지울 수 있는지, 미리 보기에 토글·각주 표기가 남지 않는지
- 화면 E2E: 두 화면에서 본문 블록의 위치·높이·글자 크기가 같은지, 각주 번호·↩·글 안 링크로 오가는지, 관리자 표시로 읽기 화면을 오가는지, 메뉴로 토글을 넣고 접고 펼치고 푸는 것과 그때마다 저장되는 Markdown, 각주 번호와 각주 내용, `<details id>`와 각주가 있는 저장소 글을 고쳐도 표기가 그대로인지, 마지막 글을 지워도 폴더가 남는지

</details>

> [!IMPORTANT] 모든 글이 통과해야 하는 시험
> 저장소 글 시험은 `apps/memo/content.test.ts`의 "글쓰기 규칙에 맞다"다. 이 블로그의 모든 글은 이 시험을 통과해야 커밋된다. 이 글의 요약도 같은 이유로 200자 이내다.

## 남은 것·정리

- 토글 제목(`details_summary`)은 서식 없는 텍스트만 담는다. 제목에 굵게나 링크를 넣는 기능은 아직 편집기에 없다.
- 각주 번호는 화면에서만 다시 매긴다. 저장한 식별자(`[^no-ff]` 등)는 그대로라, 저장소에서 Markdown 원문을 보면 화면 번호와 다르다.
- 편집기와 읽기 화면은 같은 글을 서로 다른 라이브러리(Milkdown, react-markdown)로 렌더링한다. 옵션 하나(`singleTilde`)도 두 곳에 함께 지정해야 결과가 같다. 그래서 옵션을 `GFM_OPTIONS` 한 곳에 정의하고 두 곳에서 가져다 쓴다.
- "두 화면이 같다"는 육안으로는 1px 차이를 판별할 수 없다. 블록마다 위치·높이를 측정해 비교하는 시험이 15px와 14px의 차이를 검출했다.

## 관련 글

- [메모 앱이 읽는 접기 블록과 각주 (GitHub 병합 방식 글)](/memo/merge-strategies)
- [Markdown 글은 두고 서버 JSON 한 행으로 겹치는 메모 폴더 정리](/memo/memo-organization-api)
- [한 줄 한 서식 규칙으로 ProseMirror 줄 서식 변환하기](/memo/memo-one-style-per-line)
- [토글 펼침 여부를 문서 대신 ProseMirror 플러그인 상태에 두기](/memo/memo-editor-tags-toggle-revert): › 로 접은 상태를 저장하던 방식을 화면 상태로 바꾼 후속 수정
- [그리드 칸을 차지하지 않는 절대 위치 리사이즈 핸들로 칸 너비 조절하기](/memo/memo-pane-resize)
- [자주 쓰는 border-radius 여섯 값을 --radius-* 디자인 토큰으로 바꾸기](/memo/design-tokens#모서리-반경---radius--여섯-값-232)

<details>
<summary>참고 문헌</summary>

- [MDN: \<details\>: The Details disclosure element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details)
- [GitHub Flavored Markdown Spec: Strikethrough (extension)](https://github.github.com/gfm/#strikethrough-extension-)
- [GitHub Docs: Basic writing and formatting syntax, Footnotes](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes)
- [remark-gfm: singleTilde 옵션](https://github.com/remarkjs/remark-gfm#options)
- [ProseMirror Guide: Schemas, Decorations](https://prosemirror.net/docs/guide/)
- [MDN: :has()](https://developer.mozilla.org/en-US/docs/Web/CSS/:has), [overflow-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap)

</details>

<details>
<summary>사진 출처</summary>

- 위키백과 각주 미리 보기: Andy Mabbett, [Wikipedia footnote - William Booth (forger) - 2020-07-28.png](<https://commons.wikimedia.org/wiki/File:Wikipedia_footnote_-_William_Booth_(forger)_-_2020-07-28.png>), Wikimedia Commons, CC BY-SA 4.0

</details>

#MacFolio #메모앱 #트러블슈팅 #프론트엔드
