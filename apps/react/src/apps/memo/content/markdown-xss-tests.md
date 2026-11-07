---
title: react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기
date: 2026-10-09
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 4
summary: 메모 글과 GitHub README는 Markdown과 HTML을 렌더링한다. 위험한 링크와 스크립트를 차단하는 설정은 이미 있었지만 이를 검증하는 시험이 없었다. 공격 문자열로 단위 시험과 E2E를 추가하고, 차단 설정을 제거하면 시험이 실패하는 것까지 확인했다.
---

MacFolio는 두 종류의 글을 Markdown으로 받아 화면에 렌더링한다. 하나는 관리자가 작성해 서버에 저장한 메모 글이고, 다른 하나는 GitHub에서 받아 오는 프로필 README다. 두 글 모두 사이트 바깥에서 들어온 문자열이므로, 그 안에 스크립트가 섞여 있어도 실행되지 않아야 한다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "HTML을 직접 삽입하는 곳 점검"과 "Markdown 링크의 `javascript:` 주소 차단"을 처리하면서, 차단 설정은 이미 있지만 ==그 설정이 유지되는지 확인하는 시험이 없다==는 점을 발견했다. 이 글은 XSS가 무엇이고 Markdown 렌더링의 어느 단계에서 차단되는지 설명한 뒤, 그 차단 결과를 시험으로 고정한 과정을 기록한다.

## 배경

### XSS: 다른 사람의 브라우저에서 실행되는 스크립트

XSS(Cross-Site Scripting, 크로스 사이트 스크립팅)는 공격자가 넣은 스크립트가 다른 사용자의 브라우저에서 **이 사이트의 출처(origin)로** 실행되는 공격이다. 출처는 `https://macfolio.hyeoniverse.com`처럼 프로토콜·도메인·포트의 조합이며, 브라우저는 같은 출처의 스크립트에 그 사이트의 쿠키·저장소·API 호출 권한을 모두 허용한다. 따라서 사이트 화면에 공격자의 스크립트가 한 줄이라도 실행되면, 그 스크립트는 사이트의 정상 코드와 같은 권한을 얻는다.

OWASP는 XSS를 입력이 어디에 머무르는지에 따라 나눈다. 주소창의 값이 곧바로 화면에 반영되는 반사형(reflected), 서버에 저장된 값이 나중에 다른 사람의 화면에 표시되는 저장형(stored), 서버를 거치지 않고 페이지의 JavaScript가 DOM에 값을 넣는 DOM 기반이다. 메모 글과 README는 저장된 문자열을 여러 방문자에게 렌더링하므로 **저장형**에 해당한다.

![저장형 XSS의 요청 순서](./images/markdown-xss-tests-stored-xss.svg '공격 문자열이 서버에 저장되고, 관리자가 그 글을 연 시각에 브라우저에서 실행되어 관리자 권한으로 API를 호출하는 순서')

예를 들어 서버나 관리자 계정이 뚫려 메모 본문에 위 그림 아래쪽의 `<img>` 태그가 저장되었다고 가정한다. 렌더링 단계가 이 문자열을 실제 HTML 요소로 DOM에 넣으면, 브라우저는 `x`라는 이미지를 불러오다 실패하고 `onerror` 속성의 코드를 실행한다. 이 코드는 사이트의 출처에서 실행되므로 관리자의 세션 쿠키가 붙은 `DELETE` 요청을 보낼 수 있고, 서버는 이 요청을 관리자의 정상 요청과 구분하지 못한다.

<details>
<summary>용어 정리</summary>

- **`javascript:` 주소**: 링크를 클릭하면 페이지 이동 대신 뒤의 코드가 실행되는 URL 스킴. `<a href="javascript:alert(1)">`
- **`data:` 주소**: 내용을 URL 안에 직접 담는 스킴. `data:text/html,<script>…</script>`는 HTML 문서 자체를 담는다
- **이벤트 처리기 속성**: `onerror`, `onclick`처럼 이벤트가 발생할 때 코드를 실행하는 HTML 속성. `<img src="없는주소" onerror="...">`는 이미지 로드에 실패하는 시각에 실행된다
- **sanitize**: HTML에서 허용 목록에 없는 태그와 속성을 삭제하는 처리. 금지 목록이 아니라 허용 목록으로 동작하므로, 처음 보는 태그도 기본적으로 삭제된다
- **CSP(Content Security Policy)**: 서버가 응답 헤더로 "이 페이지에서 실행해도 되는 스크립트의 출처"를 브라우저에 알리는 규칙

</details>

### Markdown이 화면이 되는 단계

[react-markdown](https://github.com/remarkjs/react-markdown)은 unified 생태계의 플러그인을 조합해 Markdown 문자열을 React 요소로 바꾼다. 문자열은 remark-parse가 Markdown 구문 트리(mdast)로, remark-rehype가 HTML 구문 트리(hast)로 바꾸고, 마지막에 React 요소가 된다. 차단은 이 단계 중 두 곳에서 일어난다.

![react-markdown의 처리 단계와 두 렌더링 경로](./images/markdown-xss-tests-pipeline.svg '메모 글은 HTML을 요소로 바꾸지 않고 주소만 필터링한다. README는 HTML을 요소로 바꾼 뒤 rehype-sanitize가 허용 목록 밖의 태그와 속성을 삭제한다')

| 단계                     | 하는 일                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| raw HTML 처리            | Markdown 안의 `<img …>` 같은 HTML은 hast에서 `raw` 노드(문자열)로 남는다. `rehype-raw`를 추가해야 실제 요소로 파싱된다. 추가하지 않으면 글자로 출력된다 |
| `urlTransform`           | 링크·그림의 주소를 검사한다. 기본값은 `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp`와 상대 주소만 허용하고, 나머지 스킴의 주소는 빈 문자열로 바꾼다  |
| `rehype-sanitize` (선택) | hast를 허용 목록과 비교해 목록 밖의 태그·속성을 삭제한다. 기본 허용 목록은 GitHub가 README를 렌더링할 때 쓰는 규칙이다                                  |

직접 렌더링해 보면 차이가 분명하다. 같은 입력을 react-markdown 10.1.0에 설정만 바꿔 넣은 결과다.

```text
입력:  [링크](javascript:alert(1))   <img src="x" onerror="alert(1)">

기본 설정            <a href="">링크</a>   &lt;img src="x" onerror="alert(1)"&gt;   ← 주소는 비우고, HTML은 글자로
rehype-raw           <a href="">링크</a>   <img src="x"/>                          ← HTML이 실제 요소가 된다
rehype-raw+sanitize  <a>링크</a>           <img src="x"/>                          ← 허용 목록 밖 속성 삭제
```

## 렌더링 경로와 차단 방법

렌더링 경로를 하나씩 확인하자 차단 설정은 모두 적용되어 있었다.

| 렌더링 위치                | 내용의 출처                | 차단 방법                                                                                                            |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 메모 글                    | 관리자가 작성한 글(서버)   | [react-markdown](https://github.com/remarkjs/react-markdown)은 HTML을 렌더링하지 않고, 위험한 주소의 링크를 제거한다 |
| GitHub README              | GitHub                     | HTML을 렌더링하되 [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)가 스크립트·이벤트 속성을 제거한다   |
| Finder 문서                | 이 저장소의 문서 파일      | README와 같다                                                                                                        |
| Finder 문서의 Mermaid 도식 | 이 저장소의 문서 파일      | Mermaid `securityLevel: 'strict'`가 라벨의 HTML을 필터링한다                                                         |
| GitHub 홈페이지·웹사이트   | GitHub API                 | `safeUrl`이 `http(s)`가 아닌 주소를 제외한다 (시험 있음)                                                             |
| 사진 캡션의 링크           | 관리자가 작성한 캡션(서버) | `captionParts`가 `http(s)`가 아닌 주소를 제외한다 (시험 있음)                                                        |

==문제는 표의 위 네 행에 시험이 없었다는 점==이다. 이번에는 외부 내용이 가장 많이 유입되는 메모 글과 README에 시험을 추가했다. Finder 문서와 Mermaid 도식은 이 저장소의 파일이라 후순위로 미뤘다.

시험이 없으면 이후의 설정 변경이 위험을 다시 만들 수 있다. 예를 들어 메모 글에서 가운데 정렬(`<div align="center">`)을 쓰려고 `MemoMarkdown`에 `rehype-raw`를 추가하면, 그 시각부터 글에 넣은 `<iframe>` 같은 태그가 실제 요소로 렌더링된다. 변경한 사람은 가운데 정렬이 동작하는 것만 확인하고 넘어갈 수 있고, 그 변경이 차단 단계 하나를 제거했다는 사실은 코드 리뷰에서 드러나지 않는다.

## 검토한 방법

| 방법                                         | 장점                                      | 단점                                                                                        |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 설정에 주석만 단다 ("이 줄을 지우지 마세요") | 작업이 없다                               | 주석은 변경을 막지 못한다                                                                   |
| 정적 분석 도구(Semgrep 등)에 맡긴다          | 저장소 전체를 검사한다                    | `dangerouslySetInnerHTML` 같은 코드 패턴은 검출해도, 라이브러리 설정 변경은 검출하지 못한다 |
| **렌더링 결과를 직접 검사한다**              | 변경 원인과 관계없이 결과가 위험하면 실패 | 공격 목록을 직접 정해야 하고, 목록에 없는 공격은 검출하지 못한다                            |

렌더링 결과를 검사하는 방법을 선택했다. ==차단 방법이 아니라 차단 결과를 검사==하므로, 차단 방법을 바꿔도 시험은 수정하지 않아도 된다. 예를 들어 README의 `rehype-sanitize`를 다른 sanitize 라이브러리로 교체해도, 결과 HTML에 `onerror`가 없으면 시험은 그대로 통과한다.

## 시험

같은 공격 목록을 두 곳에 입력하고, 렌더링 결과에 `<script>`, `<iframe>`, `on…` 속성, `javascript:`·`vbscript:`·`data:` 주소가 하나도 없는지 검사한다.

```text
[링크](javascript:alert(1))
[링크](JaVaScRiPt:alert(1))      ← 대소문자를 섞어 필터링 규칙을 우회하는 시도
[링크](data:text/html,<script>…)
<script>…</script>
<img src="x" onerror="…">
<a href="javascript:alert(1)">링크</a>
<iframe src="https://evil.example">
```

| 공격 문자열                           | 노리는 동작                                                        |
| ------------------------------------- | ------------------------------------------------------------------ |
| `[링크](javascript:alert(1))`         | 클릭하면 코드 실행                                                 |
| `[링크](JaVaScRiPt:alert(1))`         | 소문자만 비교하는 필터 우회. URL 스킴은 대소문자를 구분하지 않는다 |
| `[링크](data:text/html,<script>…)`    | 클릭하면 스크립트가 든 HTML 문서를 연다                            |
| `<script>…</script>`                  | 태그 자체로 실행                                                   |
| `<img src="x" onerror="…">`           | 이미지 로드 실패 시각에 실행                                       |
| `<a href="javascript:…">`             | Markdown 문법이 아닌 HTML 링크로 주소 필터 우회                    |
| `<iframe src="https://evil.example">` | 다른 사이트를 페이지 안에 표시                                     |

### README: 단위 시험

단위 시험(`apps/github/readmeSafety.test.ts`)은 `GithubReadme` 컴포넌트를 `renderToStaticMarkup`으로 HTML 문자열로 렌더링하고 정규식으로 검사한다. 브라우저 없이 Node에서 실행된다. 공격 문자열 뒤에 안전한 HTML(`<p align="center"><b>…</b></p>`)도 넣어, 그 HTML은 남아 있어야 통과하게 했다. 모든 HTML을 제거하는 과도한 설정도 README 화면을 망가뜨리므로 실패로 검출하기 위해서다.

```ts
function expectNoScript(html: string) {
	expect(html).not.toMatch(/<script/i);
	expect(html).not.toMatch(/<iframe/i);
	expect(html).not.toMatch(/\son[a-z]+=/i);
	expect(html).not.toMatch(/(href|src)="\s*(javascript|vbscript|data):/i);
}
```

### 메모 글: E2E

메모 글은 사이트 내부 링크를 처리하는 데 앱 상태가 필요해, 실제 브라우저로 검사하는 E2E(`e2e/markdown-safety.spec.ts`, "메모 글의 위험한 링크·HTML은 스크립트가 되지 않는다")로 작성했다. 가짜 서버(`e2e/fakeApi.ts`)에 공격 문자열이 본문인 글을 등록하고, 메모 앱에서 그 글을 연 뒤 DOM 요소를 직접 집계한다. 스크립트가 실제로 실행되었는지도 `window.__pwned` 값으로 확인한다. 공격 문자열 사이에 `[안전한 링크](https://example.com/a)`를 하나 넣어, 정상 링크는 유지되는지도 확인한다.

```ts
const found = await body.evaluate((root) => ({
	scripts: root.querySelectorAll('script, iframe').length,
	handlers: [...root.querySelectorAll('*')].filter((el) => [...el.attributes].some((a) => a.name.startsWith('on')))
		.length,
	badLinks: [...root.querySelectorAll('[href], [src]')]
		.map((el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '')
		.filter((url) => /^\s*(javascript|vbscript|data):/i.test(url)),
}));
expect(found).toEqual({ scripts: 0, handlers: 0, badLinks: [] });
```

![공격 문자열을 본문으로 넣은 메모 글의 화면](./images/markdown-xss-tests-rendered.jpg '시험과 같은 본문을 가짜 API로 띄운 화면. Markdown 링크 세 개는 주소가 빈 링크가 되고, HTML 태그는 글자 그대로 표시된다. 마지막의 안전한 링크만 https://example.com/a로 연결된다')

화면에서 위험한 링크 세 개는 링크 모양으로 남지만 `href`가 빈 문자열이라 클릭해도 현재 페이지에 머문다. `<script>`, `<img>`, `<iframe>`은 태그가 아니라 글자로 표시된다. 같은 화면에서 집계한 링크 주소는 `["", "", "", "https://example.com/a"]`였다.

![공격 문자열이 거치는 두 경로와 시험](./images/markdown-xss-tests-paths.svg '메모 글은 E2E로, README는 단위 시험으로 검사한다')

### 시험이 실제로 실패하는지 확인

시험이 위험을 검출하는지 확인하려고 ==차단 설정을 의도적으로 제거했다==.

| 변경                                            | 실패한 시험              |
| ----------------------------------------------- | ------------------------ |
| README에서 `rehypeSanitize` 제거                | 단위 시험 `readmeSafety` |
| 메모에 `rehype-raw` 추가 + 주소 필터링 비활성화 | E2E `markdown-safety`    |

> [!NOTE] React 19가 남기는 `javascript:` 주소
> 주소 필터링을 끄면 React 19는 `javascript:` 주소를 그대로 두지 않고 `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`로 바꿔 렌더링한다(react-dom 19.3.1에서 확인). 클릭해도 원래 코드는 실행되지 않지만, 주소가 여전히 `javascript:`로 시작하므로 E2E의 `badLinks` 검사가 실패한다. 시험은 React의 보호에 기대지 않고 렌더링 단계의 필터링이 동작하는지를 검사한다.

커밋 하나(`9a10d2e84`, [#159](https://github.com/hyeoniverse/MacFolio/pull/159))로 시험 파일 2개(43줄·42줄)와 이 글을 추가했다. 앱 코드는 변경하지 않았다.

## 다층 방어

방어는 렌더링 단계의 필터링만이 아니다. 배포한 사이트는 CSP의 `script-src`에 `'self'`와 Turnstile처럼 지정한 출처만 허용한다([MDN: CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)). 이 목록에 `'unsafe-inline'`이 없으므로, 인라인 `<script>`와 `onerror` 같은 이벤트 처리기 속성은 ==필터링이 실패해도 브라우저가 실행하지 않는다==. 예를 들어 렌더링 단계가 `<img src="x" onerror="…">`를 요소로 그대로 넣어도, 브라우저는 `onerror`를 실행하기 전에 CSP를 확인하고 콘솔에 위반 메시지를 남긴 채 실행을 거부한다.

E2E는 배포와 같은 CSP를 적용한 미리보기 서버에서 실행되고, CSP 위반이 하나라도 발생하면 시험이 실패한다(`e2e/fixtures.ts`의 `cspViolations`). 따라서 메모 E2E는 렌더링 단계와 브라우저 단계를 함께 검증한다.

![다층 방어 구조](./images/markdown-xss-tests-layers.svg '렌더링 단계에서 필터링하고, CSP가 한 번 더 차단하며, 시험이 두 단계를 모두 검증한다')

## 남은 과제와 정리

- Finder 문서와 Mermaid 도식에는 아직 시험이 없다. 이 저장소의 파일이라 위험이 낮지만, 관리자가 업로드한 문서를 렌더링하게 되면 즉시 필요하다.
- 공격 목록은 알려진 패턴만 포함한다. 목록을 늘리는 것보다, 필터링을 GitHub 기본 규칙 같은 검증된 허용 목록에 맡기는 편이 차단 범위가 넓다. 시험은 그 허용 목록이 적용되어 있는지를 검증한다.
- 보안 설정은 현재 상태를 안전하게 만드는 것보다, ==이후의 변경도 안전하게 유지하는 것이 어렵다==. 차단 설정이 제거되면 실패하는 시험이 그 변경을 검출한다.

## 직접 확인하는 방법

위험한 링크 차단 여부는 두 시험으로 확인한다. 단위 시험은 README 렌더링 규칙을, E2E는 실제 화면에 렌더링된 결과를 검사한다.

```bash
cd apps/react
npx vitest run src/apps/github/readmeSafety.test.ts
npx playwright test e2e/markdown-safety.spec.ts --project=desktop-chromium
```

> [!TIP] 새 패턴은 실패하는 시험부터
> 기대 결과는 모두 통과다. 새 위험 패턴(예: 다른 스킴의 링크)을 차단하려면 먼저 `markdown-safety.spec.ts`에 그 패턴을 추가해 실패를 확인하고, 그다음 규칙을 수정한다. 시험 파일: [apps/react/src/apps/github/readmeSafety.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/apps/github/readmeSafety.test.ts), [apps/react/e2e/markdown-safety.spec.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/markdown-safety.spec.ts).

## 관련 글

- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안)
- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile)
- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)
- [iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기](/memo/iframe-sandbox)

<details>
<summary>참고 문헌</summary>

- OWASP, [Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- OWASP, [Types of XSS](https://owasp.org/www-community/Types_of_Cross-Site_Scripting)
- MDN, [Cross-site scripting (XSS)](https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/XSS)
- MDN, [Content-Security-Policy: script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
- remarkjs, [react-markdown: Security](https://github.com/remarkjs/react-markdown#security), [`defaultUrlTransform`](https://github.com/remarkjs/react-markdown#defaulturltransformurl)
- rehypejs, [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize), [rehype-raw](https://github.com/rehypejs/rehype-raw)
- syntax-tree, [hast-util-sanitize: `defaultSchema`](https://github.com/syntax-tree/hast-util-sanitize#defaultschema)
- unified, [Introduction to unified](https://unifiedjs.com/learn/guide/introduction-to-unified/)
- Playwright, [Getting started](https://playwright.dev/docs/intro)

</details>

#MacFolio #보안 #XSS #Markdown #테스트
