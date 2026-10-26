---
title: 글과 README가 스크립트가 되지 않는다는 것을 시험으로 고정하기
date: 2026-10-09
category: 개발 기록/MacFolio/보안
summary: 메모 글과 GitHub README는 Markdown과 HTML을 렌더링한다. 위험한 링크와 스크립트를 차단하는 설정은 이미 있었지만 이를 검증하는 시험이 없었다. 공격 문자열로 단위 시험과 E2E를 추가하고, 차단 설정을 제거하면 시험이 실패하는 것까지 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목에 "HTML을 직접 삽입하는 곳 점검"과 "Markdown 링크의 `javascript:` 주소 차단"이 있었다. 렌더링 경로를 하나씩 확인하자 차단 설정은 모두 적용되어 있었다.

| 렌더링 위치                | 내용의 출처                | 차단 방법                                                                                                            |
| -------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 메모 글                    | 관리자가 작성한 글(서버)   | [react-markdown](https://github.com/remarkjs/react-markdown)은 HTML을 렌더링하지 않고, 위험한 주소의 링크를 제거한다 |
| GitHub README              | GitHub                     | HTML을 렌더링하되 [rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)가 스크립트·이벤트 속성을 제거한다   |
| Finder 문서                | 이 저장소의 문서 파일      | README와 같다                                                                                                        |
| Finder 문서의 Mermaid 도식 | 이 저장소의 문서 파일      | Mermaid `securityLevel: 'strict'`가 라벨의 HTML을 필터링한다                                                         |
| GitHub 홈페이지·웹사이트   | GitHub API                 | `safeUrl`이 `http(s)`가 아닌 주소를 제외한다 (시험 있음)                                                             |
| 사진 캡션의 링크           | 관리자가 작성한 캡션(서버) | `captionParts`가 `http(s)`가 아닌 주소를 제외한다 (시험 있음)                                                        |

문제는 표의 위 네 행에 시험이 없었다는 점이다. 이번에는 외부 내용이 가장 많이 유입되는 메모 글과 README에 시험을 추가했다(Finder 문서와 Mermaid 도식은 이 저장소의 파일이라 후순위로 미뤘다). 예를 들어 메모 글에서 HTML(`<div align="center">`)을 사용하려고 `rehype-raw`를 추가하면, 그 시각부터 글에 넣은 `<img onerror>`가 실행된다. 현재는 안전하지만, 이후 설정을 변경할 때 이 위험을 모르고 변경할 수 있다.

<details>
<summary>용어 정리</summary>

- **XSS(크로스 사이트 스크립팅)**: 공격자가 삽입한 스크립트가 다른 사용자의 브라우저에서 이 사이트의 출처로 실행되는 공격. 관리자 브라우저에서 실행되면 관리자 권한으로 글을 삭제할 수 있다
- **`javascript:` 주소**: 링크를 클릭하면 페이지 이동 대신 뒤의 코드가 실행된다. `<a href="javascript:...">`
- **이벤트 처리기 속성**: `onerror`, `onclick`처럼 이벤트가 발생할 때 코드를 실행하는 HTML 속성. `<img src="없는주소" onerror="...">`는 이미지 로드에 실패하는 시각에 실행된다
- **sanitize**: HTML에서 허용 목록에 없는 태그와 속성을 제거하는 처리

</details>

## 검토한 방법

| 방법                                         | 장점                                      | 단점                                                                                        |
| -------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| 설정에 주석만 단다 ("이 줄을 지우지 마세요") | 작업이 없다                               | 주석은 변경을 막지 못한다                                                                   |
| 정적 분석 도구(Semgrep 등)에 맡긴다          | 저장소 전체를 검사한다                    | `dangerouslySetInnerHTML` 같은 코드 패턴은 검출해도, 라이브러리 설정 변경은 검출하지 못한다 |
| **렌더링 결과를 직접 검사한다**              | 변경 원인과 관계없이 결과가 위험하면 실패 | 공격 목록을 직접 정해야 하고, 목록에 없는 공격은 검출하지 못한다                            |

렌더링 결과를 검사하는 방법을 선택했다. 차단 방법이 아니라 차단 결과를 검사하므로, 차단 방법을 바꿔도 시험은 수정하지 않아도 된다.

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

- **README**: 단위 시험(`apps/github/readmeSafety.test.ts`)에서 `GithubReadme`를 `renderToStaticMarkup`으로 HTML 문자열로 렌더링한다. 안전한 HTML(`<p align="center"><b>…</b></p>`)은 남아 있어야 한다. 모든 HTML을 제거하는 과도한 설정도 실패로 검출하기 위해서다

```ts
function expectNoScript(html: string) {
	expect(html).not.toMatch(/<script/i);
	expect(html).not.toMatch(/<iframe/i);
	expect(html).not.toMatch(/\son[a-z]+=/i);
	expect(html).not.toMatch(/(href|src)="\s*(javascript|vbscript|data):/i);
}
```

- **메모 글**: 메모 글은 사이트 내부 링크를 처리하는 데 앱 상태가 필요하므로 E2E(`e2e/markdown-safety.spec.ts`, "메모 글의 위험한 링크·HTML은 스크립트가 되지 않는다")로 검사한다. 가짜 서버에 이 본문의 글을 등록하고 열어 DOM 요소를 직접 집계한다. 스크립트가 실제로 실행되었는지도 `window.__pwned` 값으로 확인한다. 공격 문자열 사이에 `[안전한 링크](https://example.com/a)`를 하나 넣어, 그 링크가 유지되는지도 확인한다

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

![공격 문자열이 거치는 두 경로와 시험](./images/markdown-xss-tests-paths.svg '메모 글은 E2E로, README는 단위 시험으로 검사한다')

시험이 실제로 위험을 검출하는지 확인하려고 차단 설정을 의도적으로 제거했다.

| 변경                                            | 실패한 시험              |
| ----------------------------------------------- | ------------------------ |
| README에서 `rehypeSanitize` 제거                | 단위 시험 `readmeSafety` |
| 메모에 `rehype-raw` 추가 + 주소 필터링 비활성화 | E2E `markdown-safety`    |

커밋 하나(`9a10d2e84`, [#159](https://github.com/hyeoniverse/MacFolio/pull/159))로 시험 파일 2개(43줄·42줄)와 이 글을 추가했다. 앱 코드는 변경하지 않았다.

## 다층 방어

방어는 렌더링 단계의 필터링만이 아니다. 배포한 사이트는 CSP의 `script-src`를 `'self'`와 Turnstile로만 제한한다([MDN: CSP script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)). 인라인 `<script>`와 `onerror` 같은 속성은 필터링이 실패해도 브라우저가 실행하지 않는다. E2E는 배포와 같은 CSP를 적용한 미리보기 서버에서 실행되고, CSP 위반이 하나라도 발생하면 시험이 실패한다(`e2e/fixtures.ts`의 `cspViolations`). 따라서 메모 E2E는 렌더링 단계와 브라우저 단계를 함께 검증한다.

![다층 방어 구조](./images/markdown-xss-tests-layers.svg '렌더링 단계에서 필터링하고, CSP가 한 번 더 차단하며, 시험이 두 단계를 모두 검증한다')

## 남은 과제와 정리

- Finder 문서와 Mermaid 도식에는 아직 시험이 없다. 이 저장소의 파일이라 위험이 낮지만, 관리자가 업로드한 문서를 렌더링하게 되면 즉시 필요하다.
- 공격 목록은 알려진 패턴만 포함한다. 목록을 늘리는 것보다, 필터링을 GitHub 기본 규칙 같은 검증된 허용 목록에 맡기는 편이 차단 범위가 넓다. 시험은 그 허용 목록이 적용되어 있는지를 검증한다.
- 보안 설정은 현재 상태를 안전하게 만드는 것보다, 이후의 변경도 안전하게 유지하는 것이 어렵다. 차단 설정이 제거되면 실패하는 시험이 그 변경을 검출한다.

## 직접 확인하는 방법

위험한 링크 차단 여부는 두 시험으로 확인한다. 단위 시험은 README 렌더링 규칙을, E2E는 실제 화면에 렌더링된 결과를 검사한다.

```bash
cd apps/react
npx vitest run src/apps/github/readmeSafety.test.ts
npx playwright test e2e/markdown-safety.spec.ts --project=desktop-chromium
```

기대 결과는 모두 통과다. 새 위험 패턴(예: 다른 스킴의 링크)을 차단하려면 먼저 `markdown-safety.spec.ts`에 그 패턴을 추가해 실패를 확인하고, 그다음 규칙을 수정한다. 시험 파일: [apps/react/src/apps/github/readmeSafety.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/src/apps/github/readmeSafety.test.ts), [apps/react/e2e/markdown-safety.spec.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/markdown-safety.spec.ts).

참고 문서: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [Playwright 문서](https://playwright.dev/docs/intro).

## 관련 글

- [리팩터링 7단계 — 보안](/memo/refactor-step7-security)
- [GitHub 앱을 진짜 GitHub로 - 프로필·README·고른 저장소](/memo/github-live-profile)
- [사이트에 CSP와 보안 헤더 붙이기](/memo/security-headers)
- [프로젝트 앱의 iframe에 sandbox 걸기](/memo/iframe-sandbox)

#MacFolio #보안 #XSS #Markdown #테스트
