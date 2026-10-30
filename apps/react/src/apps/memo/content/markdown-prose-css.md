---
title: Markdown 본문 CSS를 prose.css와 --prose-* 변수로 합치기
date: 2026-10-23
category: 개발 기록/MacFolio/화면·스타일
series: CSS 정리
seriesOrder: 7
summary: 텍스트 편집기 창에서 연 저장소 문서의 코드 블록이 문법 강조 없이 본문 색으로 표시되었다. 강조 색 변수를 메모·Finder 창에만 정의한 것이 원인이었다. 블로그와 문서 보기가 따로 정의하던 코드·목록·구분선·접기 블록 규칙을 styles/prose.css 하나로 옮기고, 화면마다 다른 값은 --prose-* 변수로 분리했다.
---

Finder › 문서에서 `deployment.md`를 열면 텍스트 편집기 창이 문서를 렌더링한다. 이 창에서 코드 블록의 문법 강조가 적용되지 않고 모든 토큰이 본문 색(`rgba(0, 0, 0, 0.85)`)으로 표시되었다. 같은 문서를 휴대폰 파일 앱에서 열면 강조 색이 정상으로 표시되었다. 이번 작업([#364](https://github.com/hyeoniverse/MacFolio/pull/364))은 원인을 고치면서, 블로그와 문서 보기가 각각 정의하던 Markdown 본문 규칙을 `styles/prose.css` 한 파일로 옮겼다.

## 증상

빌드한 사이트에서 텍스트 편집기로 `docs/deployment.md`를 열고 코드 블록을 캡처했다. 위가 변경 전, 아래가 변경 후다.

![변경 전: 텍스트 편집기의 JSON 코드 블록, 모든 토큰이 본문 색](./images/markdown-prose-css-code-before.jpg '변경 전: 키·문자열·숫자가 모두 본문 색')

![변경 후: 키는 파랑, 문자열은 남색, 숫자는 파랑으로 강조](./images/markdown-prose-css-code-after.jpg '변경 후: 블로그와 같은 GitHub 계열 강조 색')

다크 모드도 같다. `--color-code-*` 토큰이 화면 모드에 따라 값을 바꾸므로 별도 규칙 없이 다크 색이 적용된다.

![변경 전: 다크 모드에서도 모든 토큰이 흰 본문 색](./images/markdown-prose-css-code-dark-before.jpg '다크 모드, 변경 전')

![변경 후: 다크 모드의 강조 색](./images/markdown-prose-css-code-dark-after.jpg '다크 모드, 변경 후')

## 원인: 색 변수를 창 단위로 정의했다

문서 보기(`DocView.css`)의 강조 규칙은 `--hl-*` 변수를 참조한다.

```css
.finder-doc :is(.hljs-string, .hljs-regexp) {
	color: var(--hl-string);
}
```

`--hl-*`는 메모 창(`[data-app='memo']`, `memo/styles/highlight.css`)과 Finder 창(`[data-app='finder']`, `Finder.css`)에만 정의되어 있었다. 휴대폰 파일 앱은 Finder 창 안에서 문서를 렌더링하므로 변수를 상속받는다. 텍스트 편집기 창은 `data-app='textedit'`이라 변수가 없다.

[CSS 사용자 지정 속성](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)은 정의되지 않은 변수를 `var()`로 참조하면 오류를 내지 않는다. 그 선언은 계산값 시점에 무효[^invalid]가 되고, `color`는 상속 속성이므로 부모의 본문 색이 그대로 적용된다. 그래서 개발 중에 경고 없이 지나갔다.

![변경 전에는 창(data-app)마다 --hl-*를 정의해 텍스트 편집기 창에서만 빠졌고, 변경 후에는 본문 컨테이너 규칙이 --color-code-*를 바로 참조한다](./images/markdown-prose-css-scope.svg '코드 강조 색 변수를 정의한 위치')

`--hl-*`는 라이트·다크 모두 `--color-code-*`를 그대로 가리키는 별칭이었다. `--color-code-*`는 `:root`에 정의되어 화면 모드마다 값이 바뀌므로, 별칭을 거치지 않고 직접 참조하면 창 종류와 무관하게 같은 색이 된다.

## 같은 규칙이 세 파일에 나뉘어 있었다

Markdown 본문을 렌더링하는 컨테이너는 두 가지다.

| 컨테이너         | 사용처                                                       | 스타일 파일                                 |
| ---------------- | ------------------------------------------------------------ | ------------------------------------------- |
| `.memo-markdown` | 블로그 읽기 화면, 메모 편집기(Milkdown), 게시 버전 미리 보기 | `memo/styles/markdown.css`, `highlight.css` |
| `.finder-doc`    | 텍스트 편집기의 문서 보기·이력서 편집기, 휴대폰 파일 앱      | `finder/DocView.css`, `Finder.css`(색 변수) |

두 컨테이너가 같은 요소를 따로 정의하면서 한쪽에만 있는 규칙이 생겼다.

| 요소                     | 블로그                                                                      | 문서 보기 (변경 전)                       |
| ------------------------ | --------------------------------------------------------------------------- | ----------------------------------------- |
| 코드 강조 색             | 메모 창에서 정의                                                            | Finder 창에서만 정의, 텍스트 편집기 없음  |
| 구분선 `---`             | 1px 테두리색 선, 위아래 1.8em                                               | 규칙 없음: 브라우저 기본 회색 2px 입체 선 |
| 접기 `<details>`         | 테두리 상자, › 회전 표시                                                    | 규칙 없음: 브라우저 기본 ▶ 표시           |
| 목록·글줄 코드·코드 블록 | 같은 구조, 값만 다름                                                        | 같은 구조, 값만 다름                      |
| 인용                     | `prose.css` 공통 ([#361](https://github.com/hyeoniverse/MacFolio/pull/361)) | `prose.css` 공통                          |

인용은 직전 작업([#361](https://github.com/hyeoniverse/MacFolio/pull/361))에서 이미 `styles/prose.css`로 옮겼다. 이번에는 나머지 공통 요소를 같은 파일로 옮겼다. 제목·링크·표·이미지는 옮기지 않았다. 블로그는 macOS 메모, 문서 보기는 GitHub 화면을 따르므로 디자인 자체가 다르다.

## prose.css: 구조는 한 곳, 값은 변수로

### 화면 목록 대신 .prose 클래스

처음에는 공통 규칙의 선택자를 `:where(.memo-markdown, .finder-doc) pre`처럼 적용할 화면을 나열해 작성했다. 이 방식은 Markdown을 렌더링하는 화면이 하나 늘 때마다 `prose.css`의 모든 선택자를 수정해야 하고, 공통 파일이 각 화면의 클래스 이름을 알아야 한다.

그래서 [Tailwind Typography](https://github.com/tailwindlabs/tailwindcss-typography)의 `.prose` 관례를 따랐다. Markdown 본문 요소에 공통 클래스 `prose`와 화면 클래스를 함께 붙이고, `prose.css`는 `.prose`만 참조한다.

| 요소                                                    | 클래스                                   |
| ------------------------------------------------------- | ---------------------------------------- |
| 블로그 읽기 화면, 게시 버전 미리 보기, 편집기 대기 화면 | `prose memo-markdown`                    |
| 메모 편집기 (Milkdown)                                  | `memo-inline-editor prose memo-markdown` |
| 문서 보기 (텍스트 편집기·휴대폰 파일 앱)                | `prose finder-doc`                       |
| 이력서 편집기 (Milkdown)                                | `prose finder-doc textedit-rich`         |

```css
:where(.prose) {
	--prose-flow-gap: 1em;
	--prose-pre-padding: var(--space-12) var(--space-14);
	/* … */
}

:where(.prose) pre {
	padding: var(--prose-pre-padding);
	overflow: auto;
	border-radius: var(--prose-pre-radius);
	background-color: var(--prose-pre-bg);
	line-height: var(--prose-pre-line-height);
}

:where(.prose) :is(.hljs-string, .hljs-regexp, .hljs-meta .hljs-string) {
	color: var(--color-code-string);
}
```

모든 선택자는 [`:where(.prose)`](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)로 시작한다. `:where()` 안의 선택자는 명시도[^specificity]에 더해지지 않으므로 `:where(.prose) pre`의 명시도는 `pre` 하나와 같은 (0,0,1)이고, 화면 클래스로 작성한 규칙(`.memo-markdown h2`, (0,1,1))이 항상 우선한다. 변수 기본값도 `:where(.prose)`(명시도 0)에 정의해, `.memo-markdown`·`.finder-doc`에서 정의한 값이 CSS 파일 로드 순서와 상관없이 적용된다. `.prose` 밖에는 적용되지 않으므로 `<blockquote>`·`<details>`를 UI 부품으로 쓰는 위젯·메일·Safari 템플릿은 영향이 없다.

변수의 기본값은 문서 보기의 값이고, 블로그는 `.memo-markdown`에서 차이만 바꾼다.

| 변수                      | 기본값 (문서 보기)                                 | 블로그             |
| ------------------------- | -------------------------------------------------- | ------------------ |
| `--prose-flow-gap`        | `1em`                                              | `0.9em`            |
| `--prose-heading-gap`     | `--prose-flow-gap` (문서 보기는 `0.6em`)           | `--prose-flow-gap` |
| `--prose-list-indent`     | `2em`                                              | `1.4em`            |
| `--prose-list-gap`        | `0.25em`                                           | `0.3em`            |
| `--prose-code-padding`    | `0.15em 0.4em`                                     | `0.1em 0.35em`     |
| `--prose-code-bg`         | `--color-unemphasized-selected-content-background` | `--memo-code-bg`   |
| `--prose-pre-padding`     | `--space-12` `--space-14`                          | `0.9em 1em`        |
| `--prose-pre-bg`          | `--sidebar-background`                             | `--memo-code-bg`   |
| `--prose-pre-line-height` | `1.55`                                             | `1.5`              |
| `--prose-rule`            | `--color-separator`                                | `--memo-border`    |
| `--prose-accent`          | `--color-control-accent`                           | `--memo-accent`    |

한쪽에만 있는 값은 변수로 만들지 않고 그 화면의 파일에 남겼다. 블로그의 코드 글꼴(`ui-monospace`)과 탭 너비(`tab-size: 2`), 문서 보기의 하위 목록 빈 동그라미와 코드 블록 글자 크기가 그 예다. 문서 보기의 코드는 브라우저 기본 고정폭 글꼴이고 `docs/deployment.md`의 JSON 블록은 탭으로 들여 쓰여 있어, 두 값을 공통으로 옮기면 문서 화면이 바뀐다.

### 문단 사이 간격: --prose-flow-gap

두 화면은 문단 사이 간격을 다른 방식으로 정의하고 있었다.

| 화면      | 변경 전 규칙                                                             | 방식                          |
| --------- | ------------------------------------------------------------------------ | ----------------------------- |
| 블로그    | `.memo-markdown > * + * { margin-top: 0.9em }` (0,1,0)                   | 본문 바로 아래 블록의 위 여백 |
| 문서 보기 | `.finder-doc :is(p, ul, ol, table, pre, blockquote) { margin: 0 0 1em }` | 모든 깊이의 블록 아래 여백    |

블로그 규칙은 명시도가 (0,1,0)이라 공통 규칙인 구분선(1.8em)·접기 블록(1.2em)의 위 여백을 덮었다. 그래서 두 요소의 `margin`만 `markdown.css`에 한 번 더 작성한 예외가 있었다.

흐름 간격을 `prose.css`로 옮기고 값은 변수로 분리했다.

```css
:where(.prose) > * + *,
:where(.prose .ProseMirror) > * + * {
	margin-top: var(--prose-flow-gap);
}

:where(.prose) > :where(h1, h2, h3, h4, h5, h6) + *,
:where(.prose .ProseMirror) > :where(h1, h2, h3, h4, h5, h6) + * {
	margin-top: var(--prose-heading-gap);
}
```

명시도가 0이므로 `:where(.prose) hr`(0,0,1)의 `margin: 1.8em 0`이 위 여백까지 적용되고, `markdown.css`의 예외는 삭제했다. 편집기(Milkdown)는 블록이 `.ProseMirror` 한 겹 안에 있어 같은 규칙에 함께 넣었다.

문서 보기는 방식이 달라 결과가 같도록 세 가지를 맞췄다.

- **본문 바로 아래 블록**: 아래 여백 1em 대신 흐름 간격(위 여백 1em). 두 블록 사이 간격은 같다.
- **제목 다음 블록**: 제목의 아래 여백이 0.6em이고 다음 블록의 위 여백이 0이라 간격이 0.6em이었다. `--prose-heading-gap: 0.6em`으로 맞췄다.
- **인용·목록·접기 블록 안의 블록**: GitHub처럼 아래 여백 1em을 유지했다(`.finder-doc :where(:not(.ProseMirror)) > :is(p, …)`).

그 밖에 문서 끝 마지막 블록의 아래 여백 1em은 본문 아래 패딩(`calc(48px + 1em)`)으로 옮겼고, 언어 링크 줄 다음의 `h1`은 위 여백을 본문 글자 기준 1em으로 지정했다.

### 명시도 0이라 바꾼 규칙

`theme.css`의 `.memo ul { list-style: none }`(0,1,1)은 폴더·글 목록의 글머리표를 없애는 규칙이다. 예전에는 `.memo-markdown ul`(0,1,1)이 뒤에 선언되어 이겼지만, `:where(.prose) ul`(0,0,1)은 진다. 이 규칙은 앱 기본값이므로 `@layer reset`으로 옮겼다. 레이어에 넣은 규칙은 명시도와 상관없이 레이어 밖의 규칙에 진다([앱 기본값을 CSS 층으로 내리기](/memo/css-layer-reset)).

## 함께 고친 구분선과 접기 블록

문서 보기에는 구분선 규칙이 없어 브라우저 기본 스타일(회색 2px 입체 선, 아래 여백 없음)이 적용되었다. 저장소 문서에는 아직 `---`가 없어서, 아래 캡처는 README 문단 뒤에 `<hr>`을 넣어 렌더링한 결과다.

![변경 전: 회색 2px 입체 구분선, 다음 문단이 선에 붙음](./images/markdown-prose-css-hr-before.jpg '구분선, 변경 전 (브라우저 기본)')

![변경 후: 1px 테두리색 선, 위아래 같은 여백](./images/markdown-prose-css-hr-after.jpg '구분선, 변경 후 (블로그와 같은 모양)')

README는 기술 스택 설명을 `<details>`로 접어 둔다. 문서 보기에는 접기 블록 규칙이 없어 브라우저 기본 ▶ 표시만 있었다. 블로그의 접기 블록(`remarkDetails`가 만드는 `<details>`)과 같은 테두리 상자·› 회전 표시를 공통 규칙으로 옮겨, 문서에 직접 적은 `<details>`에도 적용했다.

![변경 전: ▶ 표시와 요약 줄만 이어진 README 접기 블록](./images/markdown-prose-css-details-before.jpg '접기 블록, 변경 전')

![변경 후: 테두리 상자 안의 › 표시와 굵은 요약 줄](./images/markdown-prose-css-details-after.jpg '접기 블록, 변경 후')

메모 편집기는 같은 블록을 `div`로 렌더링한다(`writer/details.ts`). 이 요소에 `prose-details` 클래스를 붙이고 상자 규칙을 `:where(.prose) :is(details, .prose-details)`로 함께 적용했다. 요약 줄과 접고 펼치는 규칙은 편집기 전용이라 `markdown.css`에 남겼다. 편집 화면과 읽기 화면의 블록 위치가 같은지는 기존 e2e 시험(`memo-editor.spec.ts`)이 블록마다 비교한다.

## 계산된 스타일로 비교

규칙을 옮기는 작업이라, 의도한 변경 외에는 화면이 같아야 한다. 변경 전후 빌드를 각각 띄우고 Playwright로 요소 28종의 계산된 스타일 31개 속성을 수집해 비교했다.

| 화면                                        | 다른 값                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| 블로그 글 (라이트·다크)                     | `pre code`의 `border-radius` 3.96px → 0 (바탕이 없어 보이지 않음) |
| 텍스트 편집기 `README.md` (라이트·다크)     | 코드 강조 색, 접기 블록                                           |
| 텍스트 편집기 `deployment.md` (라이트·다크) | 코드 강조 색, 접기 블록                                           |
| 휴대폰 파일 앱 `README.md`                  | 접기 블록                                                         |

<details>
<summary>비교한 요소와 속성</summary>

- 요소: `p`, `ul`, `ol`, `ul ul`, `li + li`, 글줄 코드, `pre`, `pre code`, `.hljs-*` 6종, `hr`, `details`, `summary`와 `::before`, `blockquote`, `h2`, `a`, `table`, `th`, `td`, `img`, 체크리스트 항목
- 속성: 글자색, 바탕색, 글꼴, 글자 크기·기울임·굵기, 줄 높이, 네 방향 여백·안쪽 여백, 테두리 두께·모양·색, 모서리, 글머리표, 높이, 탭 너비, 넘침, 표시 방식, 커서
- 목록(`ul ul`)의 높이 차이는 그 목록이 접기 블록 안에 있어 상자 안쪽 여백만큼 폭이 줄어든 결과다

</details>

`.prose` 클래스와 흐름 간격 변수를 도입한 뒤에는 위치를 기준으로 한 번 더 비교했다. 흐름 간격은 문서 보기에서 아래 여백을 위 여백으로 옮기므로 `margin-*` 값 자체는 바뀐다. 그래서 본문 안 모든 요소의 위치(본문 맨 위에서의 거리)와 높이, 본문 전체 높이를 수집했다.

| 화면                                                                   | 요소 수                                  | 위치·높이가 다른 요소 | 본문 전체 높이 |
| ---------------------------------------------------------------------- | ---------------------------------------- | --------------------- | -------------- |
| 블로그 글 3개 (`break-import-cycles`, `brew-npm-setup`, `cra-to-vite`) | 277~422                                  | 0                     | 같음           |
| 메모 편집기와 같은 글의 읽기 화면                                      | 389 · 281                                | 0                     | 같음           |
| 텍스트 편집기 `README.md`, `deployment.md`, `backend-design.md`        | 502~1,500 (`deployment.md`는 앞 1,500개) | 0                     | 같음           |
| 이력서 읽기 화면·이력서 편집기                                         | 140 · 170                                | 0                     | 같음           |
| 휴대폰 파일 앱 `README.md`                                             | 826                                      | 0                     | 같음           |

## 정리

- 공통 규칙이 참조하는 변수는 규칙과 같은 범위(여기서는 `.prose`나 `:root`)에 정의한다. 창 단위로 정의하면 새 창에서 그 규칙을 쓸 때 조용히 빠진다.
- 공통 스타일 파일은 적용할 화면을 나열하지 않고 공통 클래스(`.prose`) 하나만 참조한다. 화면이 늘면 그 요소에 클래스만 붙인다.
- `:where()`로 공통 규칙의 명시도를 0으로 두면, 화면별 규칙이 별도 조정 없이 우선한다. 대신 명시도로 이기던 다른 규칙(`.memo ul`)은 레이어로 내려야 한다.
- 문단 사이 간격처럼 화면마다 방식이 다른 규칙은 하나의 방식과 변수로 맞추고, 위치를 전후 비교해 결과가 같은지 확인한다.
- 규칙을 옮긴 뒤에는 계산된 스타일을 전후 비교해, 의도한 변경만 남았는지 확인한다.

## 관련 글

- [CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset): `@layer reset`을 도입한 작업
- [getComputedStyle 비교로 동일성을 확인하며 중복 CSS 규칙 지우기](/memo/creative-css-dedupe): 같은 방식으로 계산된 스타일을 비교한 작업
- [직접 쓴 hex 색을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/color-tokens): `--color-code-*` 토큰을 만든 작업
- [Milkdown 편집기에 <details> 토글 목록과 GFM 각주 노드 추가하기](/memo/memo-editor-toggle-footnote): 편집기의 접기 블록(`div.memo-details`)
- [클릭 가로채기로 GitHub 문서 링크를 사이트에 번들된 문서로 열기](/memo/doc-links-in-finder): 텍스트 편집기에서 저장소 문서를 여는 흐름
- PR: [#364](https://github.com/hyeoniverse/MacFolio/pull/364), 인용을 먼저 옮긴 [#361](https://github.com/hyeoniverse/MacFolio/pull/361)

[^invalid]: 사용자 지정 속성 값을 대입한 결과가 그 속성에 맞지 않거나 변수가 없으면, 선언 전체가 `unset`처럼 처리된다. `color`처럼 상속되는 속성은 부모 값을, 상속되지 않는 속성은 초기값을 쓴다. MDN의 [Invalid custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties#invalid_custom_properties) 절에 정리되어 있다.

[^specificity]: 같은 요소에 여러 규칙이 겹칠 때 어느 규칙을 적용할지 정하는 점수. (ID, 클래스·속성·의사 클래스, 요소) 순으로 비교한다. MDN의 [Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity) 문서 참고.

#MacFolio #CSS #리팩터링
