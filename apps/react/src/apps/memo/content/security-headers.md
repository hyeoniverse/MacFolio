---
title: 사이트에 CSP와 보안 헤더 붙이기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: API에는 helmet이 있었지만 사이트 응답에는 보안 헤더가 하나도 없었다. CSP 출처 목록을 손으로 적지 않고 빌드 환경 변수와 PROJECTS에서 만들고, E2E가 같은 CSP로 돌며 막힌 요청이 있으면 실패하게 했다. 그 뒤 출처가 네 번 늘어난 기록도 적는다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 정리하다 보니, API 서버 응답에는 helmet이 보안 헤더를 붙이는데 정작 사이트(`macfolio.hyeoniverse.com`) 응답에는 아무 헤더도 없었다. `public/_headers`에는 캐시 설정만 있었다.

사이트 응답의 헤더는 `Content-Type`과 캐시 설정뿐이었다. 그래서 막을 수 있었던 일들이 열려 있었다.

- 다른 사이트가 이 사이트를 iframe에 넣고 위에 투명한 버튼을 겹치는 클릭재킹
- 글이나 README의 Markdown 처리에 빈틈이 생겼을 때, 끼어든 스크립트가 아무 서버로나 요청을 보내는 것
- 바깥 링크를 누를 때 `/memo/<글 주소>` 같은 전체 경로가 Referer로 넘어가는 것

Markdown이 스크립트가 되지 않는다는 것은 따로 시험으로 고정했지만([글과 README가 스크립트가 되지 않는다는 것을 시험으로](/memo/markdown-xss-tests)), CSP는 그 시험이 놓친 길까지 브라우저가 한 번 더 막는 겹이다.

## 고른 방법과 버린 방법

| 방법                                           | 좋은 점                                   | 걸린 점                                                                       |
| ---------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| Cloudflare 대시보드의 Transform Rules로 붙이기 | 코드 배포 없이 바로                       | 저장소에 기록이 남지 않고, E2E가 같은 값을 쓸 수 없다                         |
| Worker 코드에서 응답마다 헤더 붙이기           | 응답마다 다르게 줄 수 있다                | E2E가 띄우는 `vite preview`에는 Worker가 돌지 않아, 시험과 배포의 값이 갈린다 |
| 빌드가 `dist/_headers`에 쓰기 (고름)           | 모든 정적 응답에 붙고, 값이 저장소에 있다 | 응답마다 다른 값(nonce)은 쓸 수 없다. 그래서 인라인 스크립트를 없앴다         |
| `'unsafe-inline'` 스크립트를 열어 두기         | 고칠 것이 없다                            | CSP의 핵심을 버리는 일이다                                                    |

## 붙인 헤더

| 헤더                         | 값                                            | 막는 것                                           |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `Content-Security-Policy`    | 아래                                          | 허락하지 않은 출처의 스크립트·연결·iframe         |
| `X-Content-Type-Options`     | `nosniff`                                     | 브라우저가 파일 종류를 추측해 스크립트로 실행하기 |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`             | 바깥 사이트로 전체 주소(글 경로 등)가 넘어가기    |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=()` 등 | 쓰지 않는 기기 권한 (안에 띄운 사이트까지)        |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups`                    | 다른 창이 이 창을 조작하기                        |

## CSP는 무엇을 열어 두나

CSP는 "이 페이지가 어디서 무엇을 불러와도 되는가"의 목록이다. 사이트가 실제로 부르는 곳을 코드에서 찾아 정리했다.

- **스크립트**: 자기 사이트와 Cloudflare Turnstile(메일 앱의 스팸 막기)만. 인라인 스크립트와 `eval`은 막는다
- **연결(fetch)**: 자기 사이트, API 서버, Turnstile
- **iframe**: 자기 사이트(API 문서 앱), Turnstile, 프로젝트 데모 사이트 5곳
- **그림**: `https:` 전체. GitHub README와 글에 들어가는 바깥 그림은 주소를 미리 알 수 없다. 그림은 스크립트를 실행하지 못해서 여기는 넓게 둔다
- **스타일**: 인라인 스타일을 연다. React의 `style` 속성과 Mermaid·Scalar가 만드는 `<style>` 때문이다
- **그 밖**: `object-src 'none'`(플러그인), `base-uri 'self'`, `frame-ancestors 'self'`(다른 사이트가 이 사이트를 iframe에 넣는 클릭재킹)

인라인 스크립트가 딱 하나 있었다. `index.html`에서 첫 화면이 그려지기 전에 다크 모드를 적용하는 스크립트다. 해시를 CSP에 넣는 방법도 있지만, 내용을 고칠 때마다 해시를 다시 계산해야 해서 `public/theme-boot.js` 파일로 뺐다. `<head>`의 일반 `<script src>`라 그리기 전에 실행되는 것은 같다.

## 출처 목록을 손으로 적지 않기

CSP를 손으로 적으면 새 프로젝트를 `PROJECTS`에 넣을 때마다 `_headers`도 고쳐야 하고, 잊으면 프로젝트 앱이 빈 창이 된다. 그래서 목록을 코드에서 만든다.

```ts
securityHeaders({
	apiUrl: env.VITE_API_URL,
	frameUrls: PROJECTS.flatMap((project) => (project.demo ? [project.demo] : [])),
});
```

`worker/securityHeaders.ts`가 헤더 값을 만든다. 지시어마다 왜 그 출처를 여는지 주석을 붙였다.

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

그리고 Vite 플러그인이 빌드할 때 `dist/_headers` 끝에 모든 경로(`/*`) 덩어리로 더한다. 주소는 출처(`https://host`)만 남기고, `http(s)`가 아닌 값은 버린다.

`/memo/<글>` 같은 앱 주소는 파일이 아니라 Worker가 `index.html`을 대신 준다([없는 코드 파일에 index.html을 주던 문제](/memo/asset-404)). 이 응답에도 헤더가 붙는지 `wrangler dev`로 확인했다. Worker가 정적 자산 바인딩에서 받은 응답의 헤더를 그대로 넘기기 때문에 같은 헤더가 붙는다.

![PROJECTS와 API 주소에서 CSP를 만들어 빌드와 E2E 서버에 같이 붙이는 흐름](./images/security-headers-build.svg '배포와 E2E가 같은 CSP를 쓰니, 빠뜨린 출처는 시험에서 먼저 드러난다')

## E2E를 CSP를 켠 채로

CSP는 빠뜨린 출처가 하나라도 있으면 그 기능만 조용히 멈춘다. 그래서 E2E가 배포와 같은 CSP를 켠 채로 돌게 했다.

- 같은 플러그인이 `vite preview`(E2E가 띄우는 서버)에도 헤더를 붙인다
- E2E의 가짜 API(`http://api.test`)는 시험에서만 `CSP_TEST_API_URL`로 API 주소 자리에 더한다
- 모든 시험에 자동으로 붙는 fixture가 콘솔의 CSP 위반 메시지를 모아, 하나라도 있으면 시험을 실패시킨다

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

이렇게 하면 나중에 새 바깥 서비스를 붙이고 CSP에 넣는 것을 잊어도, 그 기능의 E2E가 CSP 위반으로 실패한다.

`theme-boot.js`로 뺀 뒤 시험 하나가 흔들렸다. 로딩 전 화면을 보는 시험이 모든 스크립트 요청을 붙잡아 두었는데, `<head>`의 일반 `<script src>`는 내려받을 때까지 HTML 읽기를 멈춘다. 그래서 시험이 앱 스크립트만 붙잡게 고쳤다.

## 확인

- 단위: `worker/securityHeaders.test.ts` 4개(출처만 뽑고 `http(s)`가 아니면 버리기, API 주소는 연결·미디어에 데모 주소는 프레임에만, 인라인·eval 스크립트와 플러그인 막기, `_headers`의 모든 경로 덩어리)
- E2E: 전체 E2E가 CSP 위반 0으로 통과
- 응답: 미리보기 서버에 `curl -I`를 보내면 지금은 이렇게 온다. CSP 지시어는 열네 개다.

```text
Content-Security-Policy: default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; … frame-src 'self' https://challenges.cloudflare.com https://newpick-tan.vercel.app https://qryou-app.web.app https://sprout-farm-beta.vercel.app https://what-to-do-chi.vercel.app https://www.hyeoniverse.com; … frame-ancestors 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

## 그 뒤: 출처가 네 번 늘었다

출처 목록을 코드에 둔 덕을 바로 봤다. 바깥 서비스를 붙이는 커밋마다 CSP 한 줄이 같이 바뀌었다.

![connect-src에 출처가 더해진 날짜](./images/security-headers-growth.svg '날씨, npm 검색, R2 업로드, PDF 읽기')

날씨 앱(Open-Meteo), 프로젝트 편집의 기술 칸 검색(npm 레지스트리), 관리자 문서 올리기(R2)는 기능 커밋에서 함께 더했고, 방문자가 놓은 PDF를 pdf.js가 `blob:` 주소로 읽는 것은 나중에 따로 고쳤다.

## 남은 것과 배운 것

- **`style-src 'unsafe-inline'`은 남았다.** React의 `style` 속성과 Mermaid·Scalar가 만드는 `<style>` 때문이다. 스타일 주입은 스크립트보다 위험이 작지만, 라이브러리가 nonce를 받게 되면 닫을 수 있다.
- **`img-src https:`는 넓다.** 글에 바깥 그림을 넣는 블로그라 좁히기 어렵다.
- **시험이 같은 값을 쓰게 하는 것이 핵심이었다.** 헤더는 붙여 놓고 잊기 쉽다. E2E가 배포와 같은 CSP로 돌기 때문에, 새 기능이 CSP를 어기면 PR에서 바로 드러난다.

관련 글: [프로젝트 앱의 iframe에 sandbox 걸기](/memo/iframe-sandbox) · [리팩터링 7단계 — 보안](/memo/refactor-step7-security) · [없는 코드 파일에 index.html을 주던 문제](/memo/asset-404). PR: [#156](https://github.com/hyeoniverse/MacFolio/pull/156).

#MacFolio #보안 #CSP #Cloudflare #Vite
