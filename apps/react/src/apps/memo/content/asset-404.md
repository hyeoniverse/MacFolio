---
title: not_found_handling 뒤 Worker 함수로 SPA 주소와 없는 자산의 404 나누기
date: 2026-10-05
category: 개발 기록/MacFolio/배포·운영
summary: 사이트는 없는 주소에 항상 index.html을 200으로, 그것도 1년 캐시 헤더와 함께 응답했다. 배포로 삭제된 옛 코드 파일 요청도 마찬가지였다. 없는 주소만 처리하는 11줄짜리 Worker 함수로 앱 주소는 첫 화면, 파일 주소는 404로 분리했다.
---

| 증상                                                           | 원인                                                                        | 해결                                                        | 영향 범위                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| 없는 코드 파일 요청에 `index.html`이 200, 1년 캐시 헤더로 응답 | `not_found_handling: single-page-application`이 주소 종류를 구분하지 않는다 | 없는 주소만 처리하는 Worker로 앱 주소는 첫 화면, 파일은 404 | 배포로 삭제된 `/assets/*` 파일을 요청하는 열린 탭 |

## 배경

이 사이트는 SPA(Single Page Application)다. 서버에는 `index.html` 한 장과 빌드한 자바스크립트·CSS 파일만 있고, `/memo/db-backup` 같은 주소에 해당하는 HTML 파일은 따로 존재하지 않는다. 브라우저가 `index.html`을 받아 자바스크립트를 실행한 뒤 주소를 읽어 그 글을 화면에 렌더링한다. 그래서 정적 파일 서버는 "파일이 없는 주소"에도 `index.html`을 응답해야 하고, 이 동작을 SPA 대체 응답(fallback)이라고 부른다.

응답에는 상태 코드와 헤더가 함께 온다. 이 글에서 확인할 값은 세 가지다.

| 항목                                                                                                 | 뜻                                                                                                                                                                      | 예시                                  |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [상태 코드](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)                      | 요청 결과. 200은 성공, 404는 "그런 자원이 없다"                                                                                                                         | `200`, `404`                          |
| [`content-type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type)   | 본문의 형식([MIME 형식](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types)). 브라우저는 이 값을 보고 본문을 HTML로 그릴지, 스크립트로 실행할지 정한다 | `text/html`, `text/javascript`        |
| [`cache-control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control) | 브라우저가 이 응답을 얼마 동안 저장해 두고 서버에 다시 묻지 않을지                                                                                                      | `public, max-age=31536000, immutable` |

빌드 도구 Vite는 결과 파일 이름에 내용으로 계산한 해시를 붙인다[^hash]. 메모 앱 코드가 바뀌면 `Memo-DJMDZtL5.js`가 다른 이름의 파일로 바뀌고, 이름이 같으면 내용도 같다. 그래서 `/assets/*` 파일에는 1년 동안 재검증 없이 사용하라는 캐시 헤더를 붙여도 안전하다. ==이 전제는 그 주소에 실제 파일이 응답되는 경우에만 성립한다.== 없는 파일 자리에 다른 내용이 응답되면, 그 내용이 1년 동안 캐시에 남는다.

## 증상

로그아웃 상태에서 메모 앱이 열리지 않는 현상을 조사하다가, 사이트가 **존재하지 않는 코드 파일에도 200을 응답한다**는 사실을 확인했다.

```text
GET /assets/Memo-doesnotexist.js  →  200 text/html
```

메모 앱처럼 코드가 큰 앱은 처음 여는 시각에 코드를 내려받는다(지연 로딩). 배포하면 파일 이름이 바뀌고 옛 파일은 삭제되는데, 배포 전에 열어 둔 탭은 옛 이름으로 파일을 요청한다.

1. 배포 전에 연 탭이 `GET /assets/Memo-<옛 해시>.js`를 요청한다.
2. 정적 자산에 파일이 없으므로 SPA 설정이 `index.html`을 `200 text/html`로, `_headers`의 1년 캐시 헤더와 함께 응답한다.
3. 브라우저는 MIME 형식이 맞지 않아 스크립트 실행을 거부한다.

![브라우저 탭이 옛 Memo 파일을 요청하고, 정적 자산이 index.html을 200 text/html과 1년 캐시 헤더로 응답하고, 브라우저가 MIME 검사에서 실행을 거부하는 순서](./images/asset-404-mime-check.svg '수정 전 실패 순서. 서버는 성공(200)으로 응답했지만 본문이 HTML이라 브라우저가 실행하지 않는다')

3단계의 거부는 HTML 표준이 정한 동작이다. `import()`나 `<script type="module">`로 불러오는 모듈 스크립트는 응답의 MIME 형식이 JavaScript 형식이 아니면 실행하지 않는다[^module-mime]. 서버가 200을 응답해도 본문이 `text/html`이면 실패로 처리된다.

운영 사이트에서 옛 파일 요청을 재현하자 Chrome과 Safari(WebKit) 모두 앱 창 대신 '새 버전이 있습니다 — 새로고침해 주세요' 경고창이 표시되었다. 이 경우를 감지하는 처리([삭제된 옛 코드 파일을 요청하는 React.lazy 로드 실패 구분하기](/memo/app-error-alert))가 이미 있어 앱이 완전히 멈추지는 않았다. 그러나 응답 헤더에 더 큰 문제가 있었다.

```text
GET /assets/Memo-doesnotexist.js
content-type: text/html
cache-control: public, max-age=31536000, immutable
```

## 원인 추적

응답을 확인하면서 상태 코드뿐 아니라 `content-type`과 `cache-control`까지 함께 확인한 것이 이 문제를 찾은 계기였다. 상태 코드만 확인하면 200이라 정상으로 보인다.

| 확인                                                                                                                                                                 | 결과                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 없는 코드 파일 요청                                                                                                                                                  | `200 text/html`, 1년 캐시    |
| 브라우저가 스크립트 요청에 붙이는 헤더([`Sec-Fetch-Dest: script`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest))를 지정해 요청 | 똑같이 `index.html`이 응답됨 |

두 번째 확인은 "서버가 요청 종류를 보고 응답을 바꾸는가"를 확인한 것이다. 브라우저는 `<script>`나 `import()`로 파일을 요청하면 `Sec-Fetch-Dest: script`를 붙이고, 페이지 이동이면 `document`를 붙인다. 이 헤더를 지정해도 같은 HTML이 응답되었으므로, 정적 자산 설정이 요청 종류와 상관없이 대체 응답을 적용한다는 사실을 확인했다.

## 원인

프론트엔드는 [Cloudflare Workers 정적 자산](https://developers.cloudflare.com/workers/static-assets/)으로 서빙한다. 앱 주소(`/memo/<글>`, `/safari/<프로젝트>`)는 실제 파일이 아니므로, 없는 주소에는 `index.html`을 응답하는 설정(`not_found_handling: single-page-application`)을 사용했다. 앱은 시작 시각에 주소를 읽어 해당 글을 연다.

==이 설정은 주소의 종류를 구분하지 않는다.== 앱 주소든 삭제된 코드 파일이든 정적 자산에 없으면 같은 `index.html`이 응답된다.

| 요청한 주소                     | 기대한 응답       | 실제 응답         |
| ------------------------------- | ----------------- | ----------------- |
| `/memo/db-backup` (앱 주소)     | `index.html`, 200 | `index.html`, 200 |
| `/assets/Memo-옛해시.js` (파일) | 404               | `index.html`, 200 |
| `/imgs/nope.png` (없는 그림)    | 404               | `index.html`, 200 |

`public/_headers`는 `/assets/*`에 "1년 동안 재검증 없이 사용"([`immutable`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control#immutable))을 지정한다. 해시가 붙은 파일에는 맞는 설정이지만, `_headers`는 응답 내용이 아니라 요청 경로로 대상을 정하므로 없는 파일 자리에 응답된 `index.html`에도 이 헤더가 붙었다.

> [!WARNING] 잘못된 응답이 1년 동안 캐시에 남는다
> 배포 도중 새 코드 파일이 아직 전파되지 않은 시각에 이 주소를 요청한 브라우저는, 그 파일 이름으로 HTML을 1년 동안 캐시에 보관한다. 파일이 전파된 뒤에도 브라우저는 서버에 다시 요청하지 않고 캐시의 HTML을 사용한다.

![수정 전에는 첫 요청의 HTML이 1년 캐시로 저장되어 파일 전파 뒤에도 캐시의 HTML을 쓰고, 수정 후에는 404에 캐시 헤더가 없어 다음 요청이 올바른 파일을 받는 비교](./images/asset-404-cache-timeline.svg '같은 파일 이름을 세 시점에 요청한 결과의 차이. 수정 전에는 첫 요청의 잘못된 응답이 캐시에 고정된다')

## 해결

수정은 PR [#103](https://github.com/hyeoniverse/MacFolio/pull/103)이다.

### 수정 방법 비교

| 방법                                              | 장점                                            | 문제                                                                              |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `_headers`에서 HTML 응답의 캐시 제외              | 설정 한 줄                                      | `_headers`는 경로로만 대상을 지정한다. `/assets/*`로 응답된 HTML을 구분할 수 없다 |
| 해시 라우팅(`/#/memo/…`)으로 바꾸고 SPA 설정 끄기 | Worker가 필요 없다                              | 공유 링크 주소가 바뀐다. 이미 배포된 `/memo/<글>` 링크가 작동하지 않는다          |
| **없는 주소만 처리하는 Worker (선택)**            | 있는 파일은 그대로 빠르다. 주소 형식도 유지된다 | Worker 스크립트를 새로 추가해야 한다                                              |

해시 라우팅은 주소의 `#` 뒤를 서버에 보내지 않는 브라우저 동작을 이용한다. `/#/memo/db-backup`을 요청하면 서버는 `/`만 받으므로 대체 응답이 필요 없다. 그러나 이미 공유된 `/memo/<글>` 링크가 모두 바뀌어 채택하지 않았다.

### 없는 주소만 처리하는 Worker

Worker는 Cloudflare의 서버에서 요청마다 실행되는 자바스크립트 함수다. `wrangler.jsonc` 설정을 다음과 같이 변경해, SPA 대체 응답을 끄고 그 역할을 Worker에 넘겼다.

```jsonc
"main": "./apps/react/worker/index.ts",
"assets": {
	"directory": "./apps/react/dist",
	"binding": "ASSETS",
	"not_found_handling": "none",
},
```

있는 파일은 기존처럼 Cloudflare가 직접 응답한다. Worker는 **정적 자산에 없는 주소에만** 호출되므로([Workers 정적 자산 라우팅](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)) Worker 호출 횟수가 늘지 않는다. Worker는 주소 형식만으로 판단한다.

```ts
// apps/react/worker/notFound.ts
export const isAppRoute = (pathname: string) => {
	if (pathname.startsWith('/assets/')) return false;
	const last = pathname.split('/').pop() ?? '';
	return !last.includes('.');
};
```

판단 기준은 두 가지다. `/assets/`로 시작하면 빌드 결과 파일이므로 앱 주소가 아니다. 그 밖에는 마지막 경로 조각에 점(`.`)이 있으면 확장자가 있는 파일 주소로 본다.

| 주소 조건                              | 응답              | 예시                                     |
| -------------------------------------- | ----------------- | ---------------------------------------- |
| 마지막 경로 조각에 점이 없음 (앱 주소) | `index.html`, 200 | `/memo/db-backup`, `/safari/sproutfarm`  |
| `/assets/…`이거나 확장자가 있는 주소   | 404               | `/assets/Memo-old.css`, `/imgs/nope.png` |

![요청 나누기](./images/asset-404-routing.svg '있는 파일은 Cloudflare가 바로, 없는 주소만 Worker가 받는다')

==Worker가 응답하는 404에는 1년 캐시 헤더가 붙지 않는다==(`_headers`는 [정적 자산 응답에만 적용](https://developers.cloudflare.com/workers/static-assets/headers/)된다). 브라우저는 404를 저장하지 않으므로 다음 요청에서 새 파일을 내려받는다.

![전과 후의 응답](./images/asset-404-before-after.svg '같은 요청에 HTML과 1년 캐시 대신 404가 간다')

## 확인

`wrangler dev`로 같은 Worker를 로컬에서 실행해 확인했다. 변경은 6개 파일, 60줄이다. 판단 함수(`worker/notFound.ts`)는 11줄이고, 단위 시험(`worker/notFound.test.ts`) 두 개(**앱 주소는 첫 화면으로**, **빌드 결과와 파일 주소는 404**)를 함께 추가했다.

| 주소                                                                       | 결과            |
| -------------------------------------------------------------------------- | --------------- |
| `/`, `/memo/db-backup`, `/safari/sproutfarm`                               | 200 `text/html` |
| 있는 코드·이미지 (`/assets/main-….js`, `/imgs/apidocs.svg`, `/robots.txt`) | 200, 원래 형식  |
| `/assets/Memo-doesnotexist.js`, `/assets/Memo-old.css`, `/imgs/nope.png`   | **404**         |

### 직접 확인하기

없는 코드 파일을 요청해 상태 코드와 캐시 헤더를 확인한다. `curl -I`는 본문 없이 응답 헤더만 요청하는 옵션이다.

```bash
curl -sI https://macfolio.hyeoniverse.com/assets/does-not-exist.js | grep -iE '^(HTTP|cache-control|content-type)'
# 404가 정상이다. 200과 text/html이면 index.html이 응답된 것이다
curl -sI https://macfolio.hyeoniverse.com/memo/asset-404 | head -1   # 앱 주소는 200 (SPA)
```

Worker 시험은 `cd apps/react && npx vitest run worker/notFound.test.ts`로 실행한다. 설정은 루트의 [wrangler.jsonc](https://github.com/hyeoniverse/MacFolio/blob/main/wrangler.jsonc)에 있고, `not_found_handling`과 Worker를 먼저 호출하는 범위(`run_worker_first`)는 [Workers 정적 자산 라우팅 문서](https://developers.cloudflare.com/workers/static-assets/routing/)에 설명되어 있다. 배포는 [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)의 `wrangler deploy`가 수행한다. 되돌리려면 이 Worker를 제거하고 다시 배포한다. 그러면 예전처럼 모든 없는 주소에 `index.html`이 응답된다.

## 재발 방지

- `worker/notFound.test.ts`가 앱 주소와 파일 주소의 응답 구분을 고정한다. 판단 함수를 바꾸면 이 시험이 먼저 실패한다.
- 응답을 확인하는 단계에서는 상태 코드와 함께 `content-type`, `cache-control`을 확인한다. 이번 문제는 상태 코드가 200이라 상태 코드만으로는 드러나지 않았다.

> [!WARNING] 점이 들어간 글 주소는 404가 된다
> 판단 기준은 "마지막 경로 조각에 점이 있는가" 하나다. 글 주소에 점이 들어가면(`/memo/v1.2-release`) 404가 된다. 현재 글 주소에는 점이 없고, 필요해지면 글 주소 규칙을 먼저 변경한다.

남은 사항은 두 가지다.

- 로그아웃 상태에서 메모가 열리지 않던 현상의 원인이 이 문제 하나뿐인지는 확인하지 못했다.
- "없으면 첫 화면" 설정은 SPA에 편리한 기본값이지만, 정적 파일 서버가 404를 응답하지 못하게 만든다. 긴 캐시 헤더와 함께 쓰이면 잘못된 응답이 오래 캐시에 남는다.

## 이후 Worker에 추가된 처리

이 Worker는 "없는 주소만 처리하는 작은 함수"로 시작했지만, 첫 화면 응답을 가로챌 수 있는 위치가 생기면서 처리가 늘었다.

| 추가 시각  | 처리                                                                                                   | 파일                              | PR                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------- |
| 2026-10-11 | 첫 화면에 관리자가 수정한 프로필·프로젝트를 삽입하고, 새 프로젝트의 데모 주소를 CSP `frame-src`에 추가 | `worker/siteHtml.ts`              | [#187](https://github.com/hyeoniverse/MacFolio/pull/187) |
| 2026-10-18 | `/files/<키>` 요청에 R2 버킷의 문서 파일(PDF·그림) 응답. Finder의 이력서·자격증 폴더가 사용            | `worker/files.ts`                 | [#255](https://github.com/hyeoniverse/MacFolio/pull/255) |
| 2026-10-19 | 글·프로젝트 주소마다 검색엔진용 제목·설명·본문 삽입, `sitemap.xml` 생성                                | `worker/seo.ts`, `serverPosts.ts` | [#269](https://github.com/hyeoniverse/MacFolio/pull/269) |
| 2026-10-21 | `rss.xml` 생성, 없는 글·프로젝트 주소는 404                                                            | `worker/seo.ts`                   | [#303](https://github.com/hyeoniverse/MacFolio/pull/303) |

![worker/index.ts의 분기 순서: /files/ → 파일 주소 404 → API 수신 → sitemap·rss → 첫 화면](./images/asset-404-worker-now.svg '2026-10-23 기준 Worker가 요청을 처리하는 순서. 이 글에서 추가한 404 판단은 2번에 그대로 있다')

이 글에서 추가한 `isAppRoute` 판단은 처음 형태 그대로 2번 단계에 남아 있다.

## 관련 글

- [삭제된 옛 코드 파일을 요청하는 React.lazy 로드 실패 구분하기](/memo/app-error-alert): 이 문제가 화면에 드러난 경로
- [History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links): Worker가 `index.html`로 보내는 앱 주소
- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)
- [PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps)
- [Cloudflare Worker로 SPA의 HTML에 주소별 메타데이터와 본문 넣기](/memo/seo-crawlable): 이후 Worker에 추가된 SEO 처리

[^hash]: Vite는 빌드 결과 파일 이름에 내용으로 계산한 해시를 붙인다(`Memo-DJMDZtL5.js`). 내용이 같으면 이름도 같고, 내용이 바뀌면 이름이 바뀐다. 그래서 이름이 같은 파일은 오래 캐시해도 안전하다.

[^module-mime]: HTML 표준의 모듈 스크립트 가져오기 절차는 응답의 MIME 형식이 JavaScript MIME 형식이 아니면 결과를 실패로 처리한다. Chrome 콘솔에는 `Expected a JavaScript module script but the server responded with a MIME type of "text/html"`이 기록된다.

<details>
<summary>참고 문헌</summary>

- WHATWG, [HTML Standard: Fetching scripts (fetch a single module script)](https://html.spec.whatwg.org/multipage/webappapis.html#fetch-a-single-module-script)
- MDN, [MIME types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types)
- MDN, [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
- MDN, [Sec-Fetch-Dest](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Dest)
- P. McManus, "HTTP Immutable Responses," RFC 8246, 2017. <https://www.rfc-editor.org/rfc/rfc8246>
- R. Fielding et al., "HTTP Caching," RFC 9111, 2022. <https://www.rfc-editor.org/rfc/rfc9111>
- Cloudflare, [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Routing: Worker script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [Headers](https://developers.cloudflare.com/workers/static-assets/headers/)
- Vite, [Building for Production](https://vite.dev/guide/build)

</details>

#MacFolio #배포 #Cloudflare #트러블슈팅
