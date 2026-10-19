---
title: 글과 README가 스크립트가 되지 않는다는 것을 시험으로 고정하기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: 메모 글과 GitHub README는 Markdown과 HTML을 그린다. 위험한 링크와 스크립트를 막는 설정은 이미 있었지만 확인하는 시험이 없었다. 공격 문자열 아홉 줄로 단위 시험과 E2E를 더하고, 설정을 빼면 깨지는 것까지 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목에 "HTML을 직접 넣는 곳 점검"과 "Markdown 링크의 `javascript:` 주소 막기"가 있었다. 코드를 하나씩 확인해 보니 막는 설정은 이미 다 있었다.

| 그리는 곳                  | 내용의 출처            | 막는 방법                                                        |
| -------------------------- | ---------------------- | ---------------------------------------------------------------- |
| 메모 글                    | 관리자가 쓴 글(서버)   | react-markdown은 HTML을 그리지 않고, 위험한 주소의 링크를 지운다 |
| GitHub README              | GitHub                 | HTML은 그리되 rehype-sanitize가 스크립트·이벤트 속성을 지운다    |
| Finder 문서                | 이 저장소의 문서 파일  | README와 같다                                                    |
| Finder 문서의 Mermaid 도식 | 이 저장소의 문서 파일  | Mermaid `securityLevel: 'strict'`가 라벨의 HTML을 거른다         |
| GitHub 홈페이지·웹사이트   | GitHub API             | `safeUrl`이 `http(s)`가 아닌 주소를 버린다 (시험 있음)           |
| 사진 캡션의 링크           | 관리자가 쓴 캡션(서버) | `captionParts`가 `http(s)`가 아닌 주소를 버린다 (시험 있음)      |

문제는 위 네 줄에 시험이 없었다는 것이다. 이번에는 바깥 내용이 가장 많이 들어오는 메모 글과 README에 시험을 더했다(Finder 문서와 Mermaid 도식은 이 저장소의 파일이라 뒤로 미뤘다). 예를 들어 메모 글에서 HTML(`<div align="center">`)을 쓰고 싶어서 `rehype-raw`를 더하면, 그 순간 글에 넣은 `<img onerror>`가 실행된다. 지금은 안전하지만 나중에 바꾸는 사람(나)이 이것을 모르고 바꿀 수 있다.

## 용어

- **XSS(크로스 사이트 스크립팅)**: 공격자가 넣은 스크립트가 다른 사람의 브라우저에서 이 사이트의 이름으로 실행되는 것. 관리자 브라우저에서 실행되면 관리자 권한으로 글을 지울 수 있다
- **`javascript:` 주소**: 링크를 누르면 주소 대신 뒤의 코드가 실행된다. `<a href="javascript:...">`
- **이벤트 속성**: `onerror`, `onclick`처럼 어떤 일이 일어날 때 코드를 실행하는 HTML 속성. `<img src="없는주소" onerror="...">`는 그림을 못 불러오는 순간 실행된다
- **sanitize**: HTML에서 허용 목록에 없는 태그와 속성을 지우는 것

## 고른 방법

| 방법                                         | 좋은 점                                 | 걸리는 점                                                                             |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| 설정에 주석만 단다 ("이 줄을 지우지 마세요") | 할 일이 없다                            | 주석은 실행되지 않는다                                                                |
| 보안 점검 도구(Semgrep 등)에 맡긴다          | 저장소 전체를 훑는다                    | `dangerouslySetInnerHTML` 같은 모양은 잡아도, 라이브러리 설정 순서가 바뀐 것은 모른다 |
| **그린 결과를 직접 본다**                    | 어떤 이유로 바뀌든 결과가 위험하면 실패 | 공격 목록을 내가 정해야 하고, 목록에 없는 공격은 모른다                               |

결과를 보는 시험을 골랐다. "어떻게 막았는가"가 아니라 "막혔는가"를 묻는 시험이라, 막는 방법을 바꿔도 시험은 그대로 둘 수 있다.

## 시험

같은 공격 목록을 두 곳에 넣고, 그린 결과에 `<script>`, `<iframe>`, `on…` 속성, `javascript:`·`vbscript:`·`data:` 주소가 하나도 없는지 본다.

```text
[링크](javascript:alert(1))
[링크](JaVaScRiPt:alert(1))      ← 대소문자를 섞어 거르는 규칙을 피하려는 것
[링크](data:text/html,<script>…)
<script>…</script>
<img src="x" onerror="…">
<a href="javascript:alert(1)">링크</a>
<iframe src="https://evil.example">
```

- **README**: 단위 시험(`apps/github/readmeSafety.test.ts`)으로 `GithubReadme`를 `renderToStaticMarkup`으로 HTML 문자열로 그려 본다. 안전한 HTML(`<p align="center"><b>…</b></p>`)은 남아야 한다. 막기만 하고 다 지워 버리는 설정도 실패로 잡으려는 것이다

```ts
function expectNoScript(html: string) {
	expect(html).not.toMatch(/<script/i);
	expect(html).not.toMatch(/<iframe/i);
	expect(html).not.toMatch(/\son[a-z]+=/i);
	expect(html).not.toMatch(/(href|src)="\s*(javascript|vbscript|data):/i);
}
```

- **메모 글**: 메모 글은 사이트 안 링크를 여는 데 앱 상태가 필요해서 E2E(`e2e/markdown-safety.spec.ts`, "메모 글의 위험한 링크·HTML은 스크립트가 되지 않는다")로 본다. 가짜 서버에 이 본문의 글을 넣고 열어서 DOM을 직접 센다. 실제로 실행되었는지도 `window.__pwned`로 확인한다. 공격 사이에 `[안전한 링크](https://example.com/a)`를 하나 넣어, 그 링크는 그대로 살아 있는지도 본다

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

![공격 문자열이 지나는 두 길과 시험](./images/markdown-xss-tests-paths.svg '메모 글은 E2E로, README는 단위 시험으로 본다')

시험이 제 역할을 하는지 보려고 일부러 막는 설정을 빼 봤다. README에서 `rehypeSanitize`를 빼면 단위 시험이, 메모에 `rehype-raw`를 더하고 주소 거르기를 끄면 E2E가 실패했다.

커밋 하나(`9a10d2e84`)로 시험 파일 둘(43줄·42줄)과 이 글을 더했다. 앱 코드는 한 줄도 바꾸지 않았다.

## 겹으로 막는다

그리는 단계의 거르기만 있는 것은 아니다. 배포한 사이트는 CSP의 `script-src`를 `'self'`와 Turnstile로만 둔다. 인라인 `<script>`와 `onerror` 같은 속성은 거르기가 깨져도 브라우저가 실행하지 않는다. E2E는 배포와 같은 CSP를 붙인 미리보기에서 돌고, CSP에 막힌 것이 하나라도 있으면 시험이 실패한다(`e2e/fixtures.ts`의 `cspViolations`). 그래서 메모 E2E는 그리는 단계와 브라우저 단계를 함께 지킨다.

![겹으로 막는 구조](./images/markdown-xss-tests-layers.svg '그리는 단계에서 거르고, CSP가 한 번 더 막고, 시험이 둘 다 지킨다')

## 남은 것·배운 것

- Finder 문서와 Mermaid 도식에는 아직 시험이 없다. 이 저장소의 파일이라 위험이 낮지만, 관리자가 올린 문서를 그리게 되면 바로 필요해진다.
- 공격 목록은 내가 아는 것만 담는다. 목록을 늘리는 것보다, 거르기를 GitHub 기본 규칙 같은 검증된 허용 목록에 맡기는 쪽이 더 넓게 막는다. 시험은 그 허용 목록이 자리에 있는지를 지킨다.
- 보안 설정은 "지금 안전하다"보다 "다음에 바꾸는 사람도 안전하게 바꾼다"가 어렵다. 그 사람이 나라도 그렇다. 깨지는 시험이 그 사람에게 말을 건다.

## 관련 글

- [리팩터링 7단계: 보안](/memo/refactor-step7-security)
- [GitHub 앱을 진짜 GitHub로 (README 그리기)](/memo/github-live-profile)
- [보안 헤더와 CSP](/memo/security-headers)
- [프로젝트 앱의 iframe에 sandbox 걸기](/memo/iframe-sandbox)

#MacFolio #보안 #XSS #Markdown #테스트
