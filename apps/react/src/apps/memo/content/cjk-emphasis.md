---
title: remark-cjk-friendly로 한국어 조사 앞에서 깨지는 CommonMark 굵게 바로잡기
date: 2026-10-01
category: 개발 기록/MacFolio/화면·스타일
summary: `**취소(cancelled)**가`가 굵게로 렌더링되지 않고 별표가 그대로 표시됐다. CommonMark의 닫는 구분자 규칙이 조사를 붙여 쓰는 한국어와 맞지 않아서였다. 글을 수정하는 대신 읽기 화면과 편집기에 같은 플러그인을 적용했고, 편집기가 저장 시 글을 변형하던 문제도 함께 해결했다.
---

| 증상                                                         | 원인                                                                              | 해결                                          | 영향 범위                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `**취소(cancelled)**가`의 굵게가 렌더링되지 않고 별표가 표시 | CommonMark의 닫는 구분자 규칙이 문장부호 뒤에 조사를 붙여 쓰는 한국어와 맞지 않음 | 읽기 화면과 편집기에 remark-cjk-friendly 적용 | 괄호·따옴표·코드로 끝나는 강조 뒤에 조사가 붙은 문장(저장소 글 1곳), 편집기 저장 시 원문 변형 |

## 배경

### Markdown의 강조 문법

Markdown에서 글자를 별표 두 개로 감싸면 굵게(`**굵게**` → **굵게**), 한 개로 감싸면 기울임(`*기울임*` → _기울임_)이 된다. 이때 별표 묶음을 **구분자**(delimiter)라고 부른다. 여는 구분자와 닫는 구분자가 짝을 이루어야 강조가 되고, 짝이 없는 별표는 글자 그대로 화면에 남는다.

문제는 별표가 강조 기호가 아니라 곱셈 기호나 각주 표시처럼 글자로 쓰이는 경우도 많다는 점이다. 그래서 [CommonMark](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis) 명세는 별표의 **앞뒤 글자**를 보고 그 별표가 강조를 여는지, 닫는지, 그냥 글자인지 판정한다. 예를 들어 `2 * 3 * 4`의 별표는 앞뒤가 공백이라 강조가 되지 않는다.

### 한국어 조사와 띄어쓰기

영어는 단어 사이를 띄어 쓰므로 강조한 단어 뒤에 대부분 공백이나 문장부호가 온다. 한국어는 명사 뒤에 조사(`가`, `를`, `은`)를 띄우지 않고 붙여 쓴다. 강조를 닫는 별표 바로 뒤에 일반 글자가 오는 경우가 영어보다 훨씬 많다.

| 언어   | 예                        | 닫는 `**` 바로 뒤 |
| ------ | ------------------------- | ----------------- |
| 영어   | `the **cancelled** state` | 공백              |
| 한국어 | `**취소**가 떴다`         | 조사 `가`         |

### remark와 mdast

이 사이트의 메모 앱은 [remark](https://github.com/remarkjs/remark)로 Markdown을 처리한다. remark는 원문을 [micromark](https://github.com/micromark/micromark)로 토큰화해 **mdast**(Markdown 구문 트리)를 만들고, 이 트리를 HTML로 바꾸거나 다시 Markdown 원문으로 출력(직렬화)한다. 구문 트리는 문단·굵게·글자 같은 요소를 부모·자식 관계로 표현한 데이터다. 플러그인은 이 과정의 특정 단계에 규칙을 더한다.

![읽기 경로는 Markdown 원문, micromark, mdast, HTML 순서이고 쓰기 경로는 편집기 문서, mdast, to-markdown, Markdown 원문 순서이며, remark-cjk-friendly가 micromark와 to-markdown 단계에 확장을 더하는 도식](./images/cjk-emphasis-pipeline.svg '주황 테두리가 구분자를 판정하는 단계다. 읽기와 쓰기 모두에 같은 규칙이 필요하다')

## 증상

9월 30일 밤, 메모 앱에서 이전 글을 검토하다가 한 문장만 다르게 렌더링되는 것을 발견했다.

```text
이번엔 실패가 아니라 **취소(cancelled)**가 떴다.
```

![고치기 전 읽기 화면](./images/cjk-emphasis-before.jpg#float-right '괄호로 끝난 굵게 뒤에 조사 "가"가 붙은 곳만 별표가 그대로 보인다')

다른 위치의 `**굵게**`는 굵게 표시되는데, 이 문장만 별표가 문자 그대로 표시됐다. 오타가 아니었고 별표 개수도 맞았다. 그래서 글을 수정하기 전에, 읽기 화면이 이 문장만 다르게 해석하는 원인부터 확인했다.

## 원인

### CommonMark 규칙상 굵게가 아니다

CommonMark는 `**`가 강조를 **여는지·닫는지**를 앞뒤 문자로 판정한다. 닫는 `**`가 되려면 "오른쪽 측면(right-flanking)" 구분자여야 하며, 조건은 다음과 같다([CommonMark 명세: right-flanking delimiter run](https://spec.commonmark.org/0.31.2/#right-flanking-delimiter-run)).

1. 바로 앞 문자가 공백이 아니다.
2. 바로 앞 문자가 문장부호라면, 바로 뒤 문자는 **공백이나 문장부호**여야 한다.

`**취소(cancelled)**가`에서 닫는 `**`의 앞은 `)`(문장부호), 뒤는 `가`(일반 문자)다. ==두 번째 조건을 만족하지 못해 닫는 구분자가 되지 못하고==, 짝이 없는 `**`는 문자로 남는다.

| 입력                    | 닫는 `**`의 앞 | 뒤   | 조건 2    | 결과      |
| ----------------------- | -------------- | ---- | --------- | --------- |
| `**done (really)** now` | `)`            | 공백 | 충족      | 굵게      |
| `**취소(cancelled)**가` | `)`            | `가` | 불충족    | 별표 표시 |
| `**취소**가`            | `소`           | `가` | 해당 없음 | 굵게      |

![닫는 구분자의 앞뒤 글자](./images/cjk-emphasis-rule.svg '영어는 닫는 ** 뒤에 공백이 와서 닫히지만, 한국어는 조사가 바로 붙어 닫히지 않는다')

CommonMark의 참조 구현인 commonmark.js의 온라인 실행기(dingus)에 같은 문장을 입력해도 결과가 같다. 이 사이트의 파서만의 문제가 아니라 명세대로의 동작이다.

![commonmark.js dingus에 세 문장을 입력한 화면. 괄호로 끝난 굵게 뒤에 조사가 붙은 첫 문장은 별표가 그대로 남고, 괄호 없는 두 번째 문장과 영어 세 번째 문장은 굵게로 표시된다](./images/cjk-emphasis-commonmark-dingus.jpg '왼쪽이 입력, 오른쪽이 렌더링 결과. 첫 줄만 ** 가 글자로 남는다')

구문 트리로 확인하면 차이가 분명하다. 규칙을 충족하지 못한 첫 문장은 강조 노드(`strong`) 없이 문단 전체가 글자 노드 하나다.

![같은 문장을 CommonMark 규칙으로 파싱하면 paragraph 아래 text 노드 하나에 별표가 남고, remark-cjk-friendly로 파싱하면 text, strong, text 세 자식으로 나뉘는 mdast 비교](./images/cjk-emphasis-mdast.svg 'remark-parse로 실제 파싱한 결과를 그렸다. 오른쪽만 strong 노드가 생긴다')

영어는 `**done (really)** now`처럼 닫는 별표 뒤에 공백이 오므로 문제가 없다. 한국어는 조사를 바로 붙여 쓰므로 **괄호·따옴표·코드로 끝나는 굵게** 뒤에서 자주 발생한다.

```markdown
**`dragover`**를 ← 코드로 끝남
*“기울임”*은 ← 따옴표로 끝남
```

### 영향 범위

저장소의 모든 글을 mdast로 파싱해, 강조로 해석되지 않고 글자 노드에 남은 `*`를 검색했다. 저장소 글에서는 이 한 곳뿐이었다. 하지만 편집기로 작성한 글은 서버 DB에 있어 같은 방법으로 검사할 수 없고, 앞으로 작성할 글에서도 같은 문제가 발생할 수 있다.

## 해결

글을 수정해 회피하는 대신 **파싱 규칙을 수정하기로 했다.**

| 방법                                     | 장점                         | 단점                                                                 |
| ---------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| 글을 수정 (`**취소**(cancelled)가`)      | 코드 변경 없음               | 작성할 때마다 규칙을 기억해야 한다. 서버 글은 검색할 수도 없다       |
| 닫는 `**` 뒤에 폭 없는 공백(U+200B) 삽입 | 규칙 안에서 해결             | 보이지 않는 문자가 글에 남는다. 검색·복사 결과가 달라진다            |
| remark 플러그인 직접 작성                | 필요한 부분만 변경           | 구분자 판정은 micromark 내부 깊은 곳이라 직렬화 쪽까지 맞추기 어렵다 |
| remark-cjk-friendly (**채택**)           | 파싱·직렬화 규칙을 함께 수정 | 의존성 하나 추가. 한중일 문자 옆에서만 규칙이 달라진다               |

### 읽기 화면: remark 플러그인 하나

[remark-cjk-friendly](https://github.com/tats-u/markdown-cjk-friendly)는 한중일 문자 옆에서 위 조건을 완화하는 플러그인이다. 예를 들어 `)` 뒤에 조사 `가`가 붙어도 닫는 구분자로 인정한다. 영어 글에서는 CommonMark와 동일하게 동작한다. 패키지는 파싱용 `micromark-extension-cjk-friendly`와 직렬화용 `mdast-util-to-markdown-cjk-friendly` 두 부분으로 구성된다. 글을 렌더링하는 위치가 세 곳(읽기 화면, 편집 중 미리보기, 버전 기록)이라 플러그인 목록을 한 파일에 모았다.

```ts
// markdownPlugins.ts
export const REMARK_PLUGINS: Options['remarkPlugins'] = [remarkGfm, remarkCjkFriendly];
```

![고친 뒤 읽기 화면](./images/cjk-emphasis-after.jpg '글은 그대로 두고 읽는 규칙만 바꿨다')

### 편집기: 파싱과 직렬화 모두

편집기([Milkdown](https://milkdown.dev/))도 내부에서 remark로 Markdown을 파싱하고 직렬화한다. 읽기 화면만 수정하면 편집기에서는 계속 별표가 표시된다.

![고치기 전 편집기](./images/cjk-emphasis-editor-before.jpg '관리자로 열면 바로 편집기가 뜨는데, 여기서도 별표가 그대로다')

그리고 화면에 드러나지 않는 문제가 하나 더 있었다.

> [!CAUTION] 저장할 때 원문이 변형된다
> 플러그인 없이 편집기에서 이 글을 열어 한 글자만 수정해 저장하면, 편집기가 문서를 다시 Markdown으로 직렬화할 때 **"이대로 출력하면 굵게로 해석되지 않는다"고 판단해** 뒤 문자를 문자 참조[^charref]로 변환한다.

```markdown
**취소(cancelled)**&#xAC00; 떴다.
```

화면에는 똑같이 표시되지만 ==저장된 원문이 변형된다.== remark-cjk-friendly는 직렬화 규칙(`mdast-util-to-markdown`)도 함께 수정하므로, 편집기에 `$remark`로 적용하면 파싱과 직렬화가 모두 일치한다.

<details>
<summary>remark로 직접 확인한 직렬화 결과</summary>

같은 mdast(`strong` 노드가 있는 트리)를 remark-stringify로 출력하면, 플러그인 유무에 따라 결과가 다르다.

```text
플러그인 없음: 이번엔 실패가 아니라 **취소(cancelled)**&#xAC00; 떴다.
플러그인 있음: 이번엔 실패가 아니라 **취소(cancelled)**가 떴다.
```

</details>

```ts
const cjkFriendly = $remark('cjkFriendly', () => remarkCjkFriendly);

Editor.make().use(commonmark).use(gfm).use(cjkFriendly);
```

![규칙을 거는 곳](./images/cjk-emphasis-where.svg '읽는 세 곳은 같은 목록을 쓰고, 편집기는 같은 플러그인을 따로 건다')

## 확인

수정은 PR [#52](https://github.com/hyeoniverse/MacFolio/pull/52)의 커밋 하나다. 8개 파일에 221줄을 추가했고, 그중 81줄은 `pnpm-lock.yaml`, 66줄은 이 글이다. 코드는 `markdownPlugins.ts`(10줄), 편집기 7줄, 메모 화면 8줄이 바뀌었다.

| 시험                                                                                                                                    | 확인 내용                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위: `src/apps/memo/markdownPlugins.test.ts`의 **문장부호로 끝난 굵게 뒤에 조사가 붙어도 굵게로 그린다**, **영어 글과 GFM은 그대로다** | `**취소(cancelled)**가`, ``**`dragover`**를``, `*“기울임”*은`이 `<strong>`/`<em>`으로 렌더링되는지, 영어 글과 취소선은 그대로인지. 플러그인을 제거하고 실행하면 실패하는 것도 확인했다                     |
| E2E: `e2e/memo-editor.spec.ts`의 '한국어 사이의 굵게' 묶음                                                                              | 읽기 화면에서 굵게로 표시되는지, 관리자로 편집기에서 열어 그 문단에 이어 작성해도 저장된 Markdown에 `**취소(cancelled)**가`가 그대로 있고 `&#x`가 없는지. 편집기 쪽 플러그인만 제거하면 이 시험이 실패한다 |

시험 작성 중 확인한 사항이 하나 더 있다. 처음에는 글 맨 끝 빈 줄에 `' 끝.'`을 입력했더니 저장된 글에 `&#x20;끝.`이 들어가 시험이 실패했다. 줄 맨 앞의 공백은 Markdown에서 제거되므로 편집기가 문자 참조로 보존한 것이다. 이번 문제와 무관한 올바른 동작이었다. 굵게가 있는 문단 끝에 이어 작성하도록 시험을 수정했다.

## 재발 방지

> [!TIP] 편집기 시험은 저장된 원문으로
> 이번 작업에서 가장 중요한 발견은 "편집기가 저장 시 원문을 변형한다"는 점이었다. 화면에서는 차이가 없어서, 저장된 Markdown을 직접 검사하는 E2E가 없었다면 발견하지 못했을 것이다. 편집기를 시험할 때는 화면이 아니라 저장된 원문을 검사한다.

## 이후 변경과 남은 과제

- 파싱 규칙을 한 파일에 모아 두어, 이후 추가한 규칙도 같은 위치에 들어갔다. 현재 `REMARK_PLUGINS`에는 `~` 하나짜리 취소선 비활성화(`220~440px`이 취소선이 되던 문제), `<details>` 접기 블록, `#태그`가 함께 있다. 단위 시험도 7개로 늘었다.
- 편집기는 같은 목록을 그대로 사용하지 못하고 플러그인을 하나씩 따로 적용한다. Milkdown이 remark 플러그인을 `$remark`로 감싸야 하기 때문이다. 읽기 화면에 규칙을 추가할 때마다 편집기에도 추가해야 하는지 검토해야 한다.

## 관련 글

- [한 줄에 모양은 하나 — 노션 대신 macOS 메모를 따른 이유, 그리고 구분선](/memo/memo-one-style-per-line)
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)
- [react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests)

[^charref]: `&#xAC00;`처럼 문자를 유니코드 코드 포인트로 표기하는 HTML 문법. `AC00`은 '가'의 코드 포인트다. 이렇게 바꾸면 닫는 `**` 바로 뒤 문자가 문장부호 `&`가 되어 위 조건 2를 충족하므로, 직렬화기가 강조를 유지하려고 이 형태를 선택한다.

<details>
<summary>참고 문헌</summary>

- CommonMark, [CommonMark Spec 0.31.2: Emphasis and strong emphasis](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis), [Right-flanking delimiter run](https://spec.commonmark.org/0.31.2/#right-flanking-delimiter-run)
- CommonMark, [commonmark.js dingus](https://spec.commonmark.org/dingus/)
- tats-u, [markdown-cjk-friendly](https://github.com/tats-u/markdown-cjk-friendly)
- remarkjs, [remark](https://github.com/remarkjs/remark), [mdast](https://github.com/syntax-tree/mdast), [mdast-util-to-markdown](https://github.com/syntax-tree/mdast-util-to-markdown)
- micromark, [micromark](https://github.com/micromark/micromark)
- Milkdown, [Milkdown](https://milkdown.dev/)

</details>

<details>
<summary>사진 출처</summary>

- commonmark.js dingus 화면: CommonMark, [commonmark.js dingus](https://spec.commonmark.org/dingus/)에 예문 세 줄을 입력해 Chromium으로 캡처, 출처 표기

</details>

#MacFolio #메모앱 #Markdown #트러블슈팅
