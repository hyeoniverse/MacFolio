---
title: 사이트에 CSP와 보안 헤더 붙이기
date: 2026-10-09
category: 개발 기록/MacFolio/품질
summary: API에는 helmet이 있었지만 사이트 응답에는 보안 헤더가 하나도 없었다. CSP 출처 목록을 직접 작성하지 않고 빌드 환경 변수와 PROJECTS에서 생성하고, E2E가 같은 CSP로 실행되어 차단된 요청이 있으면 실패하게 했다. 이후 출처가 네 차례 추가된 기록도 정리한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 점검한 결과, API 서버 응답에는 [helmet](https://helmetjs.github.io/)이 보안 헤더를 붙이지만 사이트(`macfolio.hyeoniverse.com`) 응답에는 보안 헤더가 없었다. `public/_headers`에는 캐시 설정만 있었다.

사이트 응답의 헤더는 `Content-Type`과 캐시 설정뿐이었다. 그래서 다음 세 가지를 막지 못했다.

- 다른 사이트가 이 사이트를 iframe에 넣고 위에 투명한 버튼을 겹치는 클릭재킹[^clickjacking]
- 글이나 README의 Markdown 처리에 결함이 생긴 경우, 삽입된 스크립트가 임의의 서버로 요청을 보내는 것
- 외부 링크를 누르는 시각에 `/memo/<글 주소>` 같은 전체 경로가 `Referer` 헤더로 전달되는 것

Markdown이 스크립트로 실행되지 않는다는 점은 별도 시험으로 고정했다([react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests)). CSP는 그 시험이 놓친 경로까지 브라우저가 한 번 더 차단하는 방어 계층이다.

<details>
<summary>용어 정리</summary>

- **CSP(Content Security Policy)**: 페이지가 스크립트·스타일·이미지·연결·iframe을 어느 출처에서 불러와도 되는지 브라우저에 알리는 응답 헤더. 목록에 없는 출처의 요청은 브라우저가 차단하고 콘솔에 위반 메시지를 출력한다. ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP))
- **출처(origin)**: `https://host:port`까지의 주소. 경로는 포함하지 않는다.
- **지시어(directive)**: CSP 안의 항목 하나. `script-src`, `connect-src`, `frame-src`처럼 리소스 종류별로 허용 출처를 적는다.
- **nonce**: 응답마다 새로 생성하는 임의의 값. 인라인 스크립트에 같은 값을 붙여 그 스크립트만 허용한다. 정적 파일 헤더에는 응답마다 다른 값을 넣을 수 없다.

</details>

## 검토한 방법

| 방법                                         | 장점                                          | 단점                                                                               |
| -------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| Cloudflare 대시보드의 Transform Rules로 추가 | 코드 배포 없이 즉시 적용                      | 저장소에 기록이 남지 않고, E2E가 같은 값을 쓸 수 없다                              |
| Worker 코드에서 응답마다 헤더 추가           | 응답마다 다른 값을 줄 수 있다                 | E2E가 실행하는 `vite preview`에서는 Worker가 동작하지 않아 시험과 배포 값이 다르다 |
| 빌드가 `dist/_headers`에 기록 (**채택**)     | 모든 정적 응답에 적용되고, 값이 저장소에 있다 | 응답마다 다른 값(nonce)은 쓸 수 없다. 그래서 인라인 스크립트를 제거했다            |
| 스크립트에 `'unsafe-inline'` 허용            | 코드 수정이 필요 없다                         | 인라인 스크립트 차단이라는 CSP의 핵심 기능을 포기한다                              |

## 추가한 헤더

| 헤더                         | 값                                            | 차단하는 것                                            |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `Content-Security-Policy`    | 아래                                          | 허용하지 않은 출처의 스크립트·연결·iframe              |
| `X-Content-Type-Options`     | `nosniff`                                     | 브라우저가 파일 형식을 추측해 스크립트로 실행하는 것   |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`             | 외부 사이트로 전체 주소(글 경로 등)가 전달되는 것      |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=()` 등 | 사용하지 않는 기기 권한 (iframe 안의 사이트 포함)      |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups`                    | 다른 출처의 창이 `window.opener`로 이 창을 조작하는 것 |

각 헤더의 정의는 MDN의 [X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options), [Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy), [Permissions-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy), [Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy) 문서에 있다.

## CSP가 허용하는 출처

사이트가 실제로 요청하는 출처를 코드에서 찾아 지시어별로 정리했다.

| 리소스              | 지시어                   | 허용 출처                                                     | 이유                                                                                           |
| ------------------- | ------------------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 스크립트            | `script-src`             | 자기 사이트, Cloudflare Turnstile                             | Turnstile은 메일 앱의 스팸 차단. 인라인 스크립트와 `eval`은 차단한다                           |
| 연결(fetch)         | `connect-src`            | 자기 사이트, API 서버, Turnstile                              | API 호출                                                                                       |
| iframe              | `frame-src`              | 자기 사이트(API 문서 앱), Turnstile, 프로젝트 데모 사이트 5곳 | 프로젝트 앱이 데모 사이트를 iframe으로 표시한다                                                |
| 이미지              | `img-src`                | `https:` 전체                                                 | GitHub README와 글의 외부 이미지는 주소를 미리 알 수 없다. 이미지는 스크립트를 실행하지 못한다 |
| 스타일              | `style-src`              | 자기 사이트, 인라인 스타일                                    | React의 `style` 속성과 Mermaid·Scalar가 생성하는 `<style>`                                     |
| 플러그인·기준 주소  | `object-src`, `base-uri` | `'none'`, `'self'`                                            |                                                                                                |
| 이 사이트를 넣는 쪽 | `frame-ancestors`        | `'self'`                                                      | 다른 사이트가 이 사이트를 iframe에 넣는 클릭재킹 차단                                          |

인라인 스크립트는 하나 있었다. `index.html`에서 첫 화면을 렌더링하기 전에 다크 모드를 적용하는 스크립트다. 해시를 CSP에 넣는 방법도 있지만, 내용을 수정할 때마다 해시를 다시 계산해야 해서 `public/theme-boot.js` 파일로 분리했다. `<head>`의 일반 `<script src>`라 렌더링 전에 실행되는 점은 같다.

## 출처 목록을 코드에서 생성

CSP를 직접 작성하면 새 프로젝트를 `PROJECTS`에 추가할 때마다 `_headers`도 수정해야 하고, 누락하면 프로젝트 앱이 빈 창으로 표시된다. 그래서 목록을 코드에서 생성한다.

```ts
securityHeaders({
	apiUrl: env.VITE_API_URL,
	frameUrls: PROJECTS.flatMap((project) => (project.demo ? [project.demo] : [])),
});
```

`worker/securityHeaders.ts`가 헤더 값을 생성한다. 지시어마다 그 출처를 허용하는 이유를 주석으로 남겼다.

```ts
// apps/react/worker/securityHeaders.ts
const directives: Record<string, string[]> = {
	'default-src': ["'self'"],
	// 인라인 스크립트는 없다 (테마 적용 스크립트도 public/theme-boot.js 파일이다)
	'script-src': ["'self'", TURNSTILE],
	// GitHub README·글의 바깥 그림은 주소를 미리 알 수 없다. 그림은 스크립트를 실행하지 못하니 https 전체를 연다
	'img-src': ["'self'", 'data:', 'blob:', 'https:', ...api],
	'frame-src': ["'self'", TURNSTILE, ...origins(frameUrls)],
	'object-src': ["'none'"],
	// 다른 사이트가 이 사이트를 iframe에 넣지 못한다 (클릭재킹)
	'frame-ancestors': ["'self'"],
	// …
};
```

그리고 Vite 플러그인이 빌드 시각에 `dist/_headers` 끝에 모든 경로(`/*`) 블록으로 추가한다. 주소는 출처(`https://host`)만 남기고, `http(s)`가 아닌 값은 제외한다. `_headers` 파일 형식은 [Cloudflare Workers 정적 자산 헤더 문서](https://developers.cloudflare.com/workers/static-assets/headers/)를 따른다.

`/memo/<글>` 같은 앱 주소는 파일이 아니라 Worker가 `index.html`을 대신 응답한다([Workers 정적 자산의 not_found_handling과 Worker로 없는 코드 파일에 404 응답하기](/memo/asset-404)). 이 응답에도 헤더가 붙는지 `wrangler dev`로 확인했다. Worker가 정적 자산 바인딩에서 수신한 응답의 헤더를 그대로 전달하므로 같은 헤더가 붙는다.

![PROJECTS와 API 주소에서 CSP를 만들어 빌드와 E2E 서버에 같이 붙이는 흐름](./images/security-headers-build.svg '배포와 E2E가 같은 CSP를 쓰니, 빠뜨린 출처는 시험에서 먼저 드러난다')

## CSP를 적용한 상태로 E2E 실행

CSP에서 출처 하나를 누락하면 그 기능만 오류 화면 없이 동작을 멈춘다. 그래서 E2E가 배포와 같은 CSP를 적용한 상태로 실행되게 했다.

1. 같은 Vite 플러그인이 `vite preview`(E2E가 실행하는 서버)에도 헤더를 추가한다.
2. E2E의 가짜 API(`http://api.test`)는 시험에서만 `CSP_TEST_API_URL`로 API 주소 자리에 추가한다.
3. 모든 시험에 자동으로 적용되는 [fixture](https://playwright.dev/docs/test-fixtures)가 콘솔의 CSP 위반 메시지를 수집해, 하나라도 있으면 시험을 실패시킨다.

```ts
// apps/react/e2e/fixtures.ts
cspViolations: [
	async ({ page }, use) => {
		const violations: string[] = [];
		page.on('console', (message) => {
			if (message.type() === 'error' && message.text().includes('Content Security Policy')) violations.push(message.text());
		});
		await use(violations);
		expect(violations, 'CSP에 막힌 요청이 있습니다').toEqual([]);
	},
	{ auto: true },
],
```

이후 새 외부 서비스를 연결하면서 CSP 추가를 누락하면, 그 기능의 E2E가 CSP 위반으로 실패한다.

`theme-boot.js`로 분리한 뒤 시험 하나가 불안정해졌다. 로딩 전 화면을 확인하는 시험이 모든 스크립트 요청을 지연시켰는데, `<head>`의 일반 `<script src>`는 내려받기가 끝날 때까지 HTML 파싱을 멈춘다. 그래서 시험이 앱 스크립트 요청만 지연시키도록 수정했다.

## 확인

- 단위: `worker/securityHeaders.test.ts` 4개
  1. 출처만 추출하고 `http(s)`가 아닌 값은 제외
  2. API 주소는 연결·미디어 지시어에, 데모 주소는 `frame-src`에만 추가
  3. 인라인·`eval` 스크립트와 플러그인 차단
  4. `_headers`의 모든 경로 블록 생성
- E2E: 전체 E2E가 CSP 위반 0건으로 통과
- 응답: 미리보기 서버에 `curl -I`로 요청한 현재 응답은 아래와 같다. CSP 지시어는 14개다.

<details>
<summary>curl -I 응답 헤더</summary>

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; … frame-src 'self' https://challenges.cloudflare.com https://newpick-tan.vercel.app https://qryou-app.web.app https://sprout-farm-beta.vercel.app https://what-to-do-chi.vercel.app https://www.hyeoniverse.com; … frame-ancestors 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

</details>

## 이후 출처가 네 차례 추가됐다

출처 목록이 코드에 있어서, 외부 서비스를 연결하는 커밋마다 CSP 한 줄이 함께 변경됐다.

![connect-src에 출처가 더해진 날짜](./images/security-headers-growth.svg '날씨, npm 검색, R2 업로드, PDF 읽기')

| 기능                                            | 추가한 출처          | 커밋·PR                                                                   |
| ----------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| 날씨 앱 ([Open-Meteo](https://open-meteo.com/)) | Open-Meteo API       | `1acec758b` ([날씨 앱](/memo/weather-app))                                |
| 프로젝트 편집의 기술 칸 검색                    | `registry.npmjs.org` | [#187](https://github.com/hyeoniverse/MacFolio/pull/187)                  |
| 관리자 문서 업로드                              | R2 업로드 주소       | [#255](https://github.com/hyeoniverse/MacFolio/pull/255)                  |
| 방문자가 끌어다 놓은 PDF를 pdf.js로 읽기        | `blob:`              | [#263](https://github.com/hyeoniverse/MacFolio/pull/263) (별도 수정 커밋) |

이 밖에 HYEONIVERSE 창에서 블로그로 이동하면 차단되던 문제는 `frame-src`에 블로그 출처를 추가해 해결했다([#328](https://github.com/hyeoniverse/MacFolio/pull/328)).

## 직접 확인하는 방법

헤더는 빌드가 `dist/_headers`에 기록하고 Cloudflare가 그대로 적용한다. 배포 전에는 미리보기 서버로, 배포 후에는 실제 주소로 확인한다.

```bash
cd apps/react && pnpm build
grep -A3 '^/\*' dist/_headers | head
curl -sI https://macfolio.hyeoniverse.com/ | grep -iE 'content-security-policy|strict-transport|x-content-type'
```

브라우저에서는 개발자 도구 Console에 `Refused to load …` 메시지가 없는지 확인한다. 새 외부 출처를 쓰게 되면 [apps/react/worker/securityHeaders.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/worker/securityHeaders.ts)의 목록에 추가하고 [apps/react/worker/securityHeaders.test.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/worker/securityHeaders.test.ts)로 확인한다. E2E는 CSP를 적용한 상태로 실행된다(`playwright.config.ts`의 `CSP_TEST_API_URL`).

참고 문서: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP), [Cloudflare Workers 정적 자산 헤더(\_headers)](https://developers.cloudflare.com/workers/static-assets/headers/), [CSP Evaluator](https://csp-evaluator.withgoogle.com/).

## 남은 과제

- **`style-src 'unsafe-inline'`은 유지했다.** React의 `style` 속성과 Mermaid·Scalar가 생성하는 `<style>` 때문이다. 스타일 주입은 스크립트보다 위험이 작지만, 라이브러리가 nonce를 지원하면 제거할 수 있다.
- **`img-src https:`는 범위가 넓다.** 글에 외부 이미지를 넣는 블로그라 범위를 좁히기 어렵다.
- **시험이 배포와 같은 값을 쓰는 구성이 핵심이다.** 헤더는 추가한 뒤 관리 대상에서 빠지기 쉽다. E2E가 배포와 같은 CSP로 실행되므로, 새 기능이 CSP를 위반하면 PR 단계에서 실패한다.

## 관련 글

- [iframe sandbox에서 allow-top-navigation을 빼 내장 사이트의 최상위 창 이동 막기](/memo/iframe-sandbox)
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기 (리팩터링 7단계)](/memo/refactor-step7-security)
- [Workers 정적 자산의 not_found_handling과 Worker로 없는 코드 파일에 404 응답하기](/memo/asset-404)
- [react-markdown 렌더링 경로마다 XSS 차단 설정을 시험으로 고정하기](/memo/markdown-xss-tests)

PR: [#156](https://github.com/hyeoniverse/MacFolio/pull/156)

[^clickjacking]: 사용자가 보이는 버튼을 누른다고 생각하지만 실제로는 위에 겹친 다른 사이트의 요소를 누르게 만드는 공격. `frame-ancestors` 지시어로 이 사이트를 iframe에 넣을 수 있는 출처를 제한해 차단한다.

#MacFolio #보안 #CSP #Cloudflare #Vite
