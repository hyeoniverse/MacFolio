---
title: micromark와 cmark-gfm의 GFM 각주 해석 차이
date: 2026-10-23
category: 개발 기록/MacFolio/품질
summary: 저장소 글 223편을 검사해 링크 문제 세 종류, 11편을 찾았다. 각주 바로 뒤의 괄호는 GFM 파서마다 해석이 달라 GitHub에서는 링크가 됐다. 글을 고치고 content.test.ts에 글마다 링크 검사를 추가했다.
---

`트래픽 분석 5` 글의 관련 글 절이 링크가 아니라 `/memo/analytics-activity-monitor` 같은 주소 글자로만 표시됐다. 누를 수 없고, 어느 글인지 제목도 알 수 없다. 같은 형식으로 쓴 글이 더 있는지 저장소 글 223편 전체를 스크립트로 검사했고, 세 종류의 문제가 글 11편에서 나왔다.

![고치기 전 관련 글 절](./images/memo-broken-links-before.jpg '/memo/activity-live-refresh의 관련 글 절. 링크 문법 없이 주소만 적어 누를 수 없는 글자로 표시된다')

| 종류         | 원문 예                                | 화면                                  | 글  |
| ------------ | -------------------------------------- | ------------------------------------- | --- |
| 주소만       | `- 앞 글: /memo/activity-live-refresh` | 누를 수 없는 글자                     | 2편 |
| 주소가 글자  | `[/memo/day-1003](/memo/day-1003)`     | 링크는 동작하지만 제목 대신 주소 표시 | 1편 |
| 각주 뒤 괄호 | `사전 요청[^preflight](OPTIONS)을`     | 파서에 따라 각주 또는 링크            | 8편 |

## 주소만 적은 관련 글

Markdown에서 링크가 되려면 `[글자](주소)` 형식이어야 한다. `/memo/activity-live-refresh`는 `https://`로 시작하지 않으므로 GFM의 자동 링크(autolink)[^autolink] 대상도 아니다. 그대로 글자로 렌더링된다.

- `activity-live-refresh`: 관련 글 6개가 `- 설명: /memo/주소` 형식
- `live-refresh-more`: 관련 글 5개가 같은 형식
- `sproutfarm-icon`: `[/memo/game-in-iframe](/memo/game-in-iframe)`처럼 주소를 링크 글자로 사용. 링크는 동작하지만 독자는 제목을 알 수 없다

세 글 모두 다른 글의 관련 글 형식(`- [글 제목](/memo/주소): 설명`)으로 바꿨다.

![고친 뒤 관련 글 절](./images/memo-broken-links-after.jpg '같은 절. 글 제목이 링크로 표시되고 설명은 콜론 뒤에 붙는다')

## 각주 바로 뒤의 괄호

8편은 각주 참조 바로 뒤에 괄호로 설명을 붙였다.

```markdown
브라우저가 CORS 사전 요청[^preflight](OPTIONS)을 먼저 보내는데
…

[^preflight]: 브라우저가 다른 출처로 본 요청을 보내기 전에 …
```

`[^preflight](OPTIONS)`는 두 가지로 읽힌다. 각주 참조 `[^preflight]` 뒤에 글자 `(OPTIONS)`가 오는 경우와, 링크 글자가 `^preflight`이고 주소가 `OPTIONS`인 인라인 링크다. 각주는 [CommonMark](https://spec.commonmark.org/0.31.2/)나 [GFM 명세](https://github.github.com/gfm/)에 없는 확장 문법이라 둘 중 무엇을 고를지는 파서 구현이 정한다.

### 파서마다 결과가 다르다

수정 전 원문 8편을 두 파서로 렌더링해 비교했다.

- **사이트(micromark):** 메모 앱과 검색엔진용 HTML(`seo/posts.ts`)은 react-markdown + remark-gfm을 사용하고, 내부 파서는 micromark다. [micromark-extension-gfm-footnote](https://github.com/micromark/micromark-extension-gfm-footnote)는 `[`에서 각주 참조를 먼저 시도하고, 라벨이 문서 안에 **정의된 각주일 때만** 각주로 인정한다(`defined.includes(id)`). 8편 모두 정의가 있어 각주로 렌더링됐다. 각주 정의를 삭제한 원문은 `<a href="OPTIONS">^preflight</a>`가 됐다.
- **GitHub(cmark-gfm):** GitHub의 Markdown 렌더링(`POST /markdown`, `mode: gfm`)은 `]` 뒤에 `(`가 오면 [인라인 링크](https://spec.commonmark.org/0.31.2/#inline-link)를 먼저 시도한다. 괄호 안이 링크 주소[^destination] 형식이면 정의가 있어도 링크가 된다.

![두 파서의 해석 차이](./images/memo-broken-links-parsers.svg '사이트는 정의된 각주를 우선하고, GitHub은 괄호 안이 주소 형식이면 인라인 링크를 우선한다. 괄호를 각주 앞으로 옮기면 두 파서 모두 각주다')

GitHub 결과는 괄호 안에 공백이 있는지로 갈렸다.

- 링크로 바뀐 4편: `analytics-api`의 `(OPTIONS)`, `api-auto-deploy`의 ``(`ghcr.io/hyeoniverse/macfolio-api`)``, `project-apps`의 ``(`ProjectAppName`)``, `table-gap-cursor`의 ``(`insertCompositionText`)``. 백틱도 주소의 일부가 되어 `href="%60ProjectAppName%60"`이다.
- 각주로 남은 4편: `desktop-icons`의 `(아이콘 왼쪽 아래의 작은 화살표)`, `secret-scanning`의 `(문자열의 무작위성)`, `server-uptime-and-logs`, `ui-modal`의 `(앱 창)`. 공백이 있어 주소가 될 수 없다.

<details>
<summary>GitHub Markdown API로 확인한 결과</summary>

```bash
$ jq -Rs '{mode:"gfm",text:.}' analytics-api.md | gh api -X POST /markdown --input - | grep -o '<a href="OPTIONS">[^<]*</a>'
<a href="OPTIONS">^preflight</a>
```

같은 문단을 react-markdown으로 렌더링한 결과는 `<sup><a href="#user-content-fn-preflight" … data-footnote-ref="true">`다.

</details>

사이트 화면에서는 각주로 동작했지만 두 가지 문제가 남는다. 저장소의 `.md` 파일과 PR 변경 화면을 GitHub에서 열면 각주가 사라지고 `OPTIONS`라는 상대 주소 링크가 된다. 사이트에서도 각주 번호가 설명 앞에 붙어 `사전 요청¹(OPTIONS)을`처럼 읽힌다.

### 수정: 괄호를 각주 앞으로

```diff
- 브라우저가 CORS 사전 요청[^preflight](OPTIONS)을 먼저 보내는데
+ 브라우저가 CORS 사전 요청(OPTIONS)[^preflight]을 먼저 보내는데
```

각주 참조 뒤에 `(`가 오지 않으므로 어느 파서든 해석이 하나다. 각주 번호도 설명이 끝난 위치에 붙는다. 8편 모두 같은 방법으로 고쳤다.

## 다시 생기지 않게: 글마다 링크 검사

`content.test.ts`는 이미 저장소 글마다 머리말 규칙을 검사한다. 같은 위치에 글마다 시험 하나를 추가했다. 코드 블록과 인라인 코드 안의 예시는 링크가 아니므로 먼저 제외한다.

````ts
/** 코드 블록과 인라인 코드를 뺀 본문 줄 (코드 안의 예시는 링크가 아니다) */
function proseLines(source: string): string[] {
	let fence = false;
	return source.split('\n').flatMap((line) => {
		if (/^\s*(```|~~~)/.test(line)) {
			fence = !fence;
			return [];
		}
		return fence ? [] : [line.replace(/`[^`]*`/g, '')];
	});
}
````

검사는 세 가지다.

1. **링크 대상:** `](/memo/주소)`의 주소가 저장소 글 slug 집합에 있다. 서버 글은 시험 시각에 알 수 없으므로 저장소 글 링크에서는 서버 글을 가리키지 않는다.
2. **주소만 적은 곳:** `](…)`를 제거한 줄에 `/memo/주소`가 남지 않는다. 앞 글자가 영숫자·`/`·`.`·`(`·`[`이면 URL이나 링크의 일부이므로 제외한다(`(?<![\w/.([])\/memo\/[\w-]+`).
3. **각주 뒤 괄호:** `[^라벨](` 형태가 없다.

```ts
it.each(Object.entries(files))('%s의 글 링크는 누를 수 있고 있는 글을 가리킨다', (_path, source) => {
	const lines = proseLines(source);
	const targets = lines.flatMap((line) => [...line.matchAll(/\]\(\/memo\/([\w-]+)/g)].map((match) => match[1]));
	expect(targets.filter((slug) => !slugs.has(slug))).toEqual([]);
	const bare = lines.flatMap((line) => line.replace(/\]\([^)]*\)/g, '').match(/(?<![\w/.([])\/memo\/[\w-]+/g) ?? []);
	expect(bare).toEqual([]);
	expect(lines.flatMap((line) => line.match(/\[\^[^\]]+\]\(/g) ?? [])).toEqual([]);
});
```

`it.each`로 글마다 시험이 하나씩 생성되므로 실패 메시지에 파일 이름이 표시된다.

## 확인

변경은 PR [#359](https://github.com/hyeoniverse/MacFolio/pull/359)다.

- `content.test.ts` 446개 통과(글 223편 × 머리말·링크 시험 2개)
- 글만 수정 전으로 되돌리면 새 시험 10개가 실패한다. `sproutfarm-icon`은 동작하는 링크라 시험 대상이 아니다
- 문제가 없던 항목: `/memo/<slug>` 링크 중 없는 글을 가리키는 것 0개, 글 안의 GitHub `blob/main/…` 링크 134개는 모두 `main`을 가리킨다

## 남은 것

- **글자 패턴 검사의 한계:** 시험은 Markdown을 파싱하지 않고 정규식으로 검사한다. 들여쓰기 코드 블록이나 HTML 블록 안의 `/memo/주소`는 오탐이 될 수 있다. 현재 글에서는 오탐이 없다.
- **주소를 글자로 쓴 링크:** `[/memo/x](/memo/x)` 형식은 링크가 동작하므로 시험이 잡지 않는다. 링크 글자가 주소와 같은지 검사하는 항목은 추가하지 않았다.
- **서버 글:** 편집기로 쓴 서버 글은 DB에 있어 이 시험의 대상이 아니다. 서버 글에 같은 형식이 들어가도 저장·게시 시각에 검사하지 않는다.

## 관련 글

- [remark-cjk-friendly로 한국어 조사 앞에서 깨지는 CommonMark 굵게 바로잡기](/memo/cjk-emphasis): 같은 원문이 Markdown 규칙 때문에 의도와 다르게 해석된 다른 사례
- [Milkdown 편집기에 <details> 토글 목록과 GFM 각주 노드 추가하기](/memo/memo-editor-toggle-footnote): 편집기의 각주 넣기
- [react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests): 글 내용을 시험으로 검사하는 다른 사례
- [트래픽 분석 6 - visibilityState와 지수 백오프로 보이는 동안만 폴링하는 usePolling 훅과 같은 요청 묶기](/memo/activity-live-refresh): 관련 글 절을 고친 글

[^autolink]: GFM의 확장 자동 링크는 `www.`·`http://`·`https://`로 시작하는 글자와 이메일 주소만 링크로 바꾼다. [GFM 명세: Autolinks (extension)](https://github.github.com/gfm/#autolinks-extension-)

[^destination]: CommonMark의 링크 주소(link destination)는 `<…>`로 감싸지 않으면 공백·제어 문자를 포함할 수 없고 괄호의 짝이 맞아야 한다. `OPTIONS`나 `` `ProjectAppName` ``은 조건을 만족하고 `앱 창`은 공백 때문에 만족하지 않는다. [CommonMark 명세: link destination](https://spec.commonmark.org/0.31.2/#link-destination)

#MacFolio #메모앱 #Markdown #GFM #각주 #시험
