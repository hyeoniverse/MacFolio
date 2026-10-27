---
title: 없는 코드 파일에 index.html을 주던 문제
date: 2026-10-05
category: 개발 기록/MacFolio/배포·품질/배포·운영
summary: 사이트는 없는 주소에 항상 index.html을 200으로, 그것도 1년 캐시 헤더와 함께 응답했다. 배포로 삭제된 옛 코드 파일 요청도 마찬가지였다. 없는 주소만 처리하는 11줄짜리 Worker 함수로 앱 주소는 첫 화면, 파일 주소는 404로 분리했다.
---

로그아웃 상태에서 메모 앱이 열리지 않는 현상을 조사하다가, 사이트가 **존재하지 않는 코드 파일에도 200을 응답한다**는 사실을 확인했다. 수정은 PR [#103](https://github.com/hyeoniverse/MacFolio/pull/103)이다.

```text
GET /assets/Memo-doesnotexist.js  →  200 text/html
```

## 원인: SPA 대체 응답 설정

프론트엔드는 [Cloudflare Workers 정적 자산](https://developers.cloudflare.com/workers/static-assets/)으로 서빙한다. 앱 주소(`/memo/<글>`, `/safari/<프로젝트>`)는 실제 파일이 아니므로, 없는 주소에는 `index.html`을 응답하는 설정(`not_found_handling: single-page-application`)을 사용했다. 앱은 시작 시각에 주소를 읽어 해당 글을 연다.

이 설정은 주소의 종류를 구분하지 않는다. 브라우저가 스크립트를 요청할 때 붙이는 헤더([`Sec-Fetch-Dest: script`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Dest))를 지정해 요청해도 똑같이 `index.html`이 응답되었다.

## 문제가 되는 상황

메모 앱처럼 코드가 큰 앱은 처음 여는 시각에 코드를 내려받는다(지연 로딩). 빌드 결과 파일 이름에는 내용 해시[^hash]가 붙으므로, 배포하면 이름이 바뀌고 옛 파일은 삭제된다. 배포 전에 열어 둔 탭은 옛 이름으로 파일을 요청한다.

1. 배포 전에 연 탭이 `GET /assets/Memo-<옛 해시>.js`를 요청한다
2. 정적 자산에 파일이 없으므로 SPA 설정이 `index.html`을 `200 text/html`로, `_headers`의 1년 캐시 헤더와 함께 응답한다
3. 브라우저는 MIME 형식이 맞지 않아 스크립트 실행을 거부한다

옛 파일 자리에 `index.html`이 오면 브라우저는 MIME 형식이 맞지 않아 스크립트 실행을 거부한다. 운영 사이트에 옛 파일 요청을 재현하자 Chrome과 Safari(WebKit) 모두 앱 창 대신 '새 버전이 있습니다 — 새로고침해 주세요' 경고창이 표시되었다. 이 경우를 감지하는 처리([배포 직후 메모가 안 열리던 까닭](/memo/app-error-alert))가 이미 있어 앱이 완전히 멈추지는 않았지만, 응답 헤더에 더 큰 문제가 있었다.

```text
GET /assets/Memo-doesnotexist.js
content-type: text/html
cache-control: public, max-age=31536000, immutable
```

`public/_headers`는 `/assets/*`에 "1년 동안 재검증 없이 사용"([`immutable`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#immutable))을 지정한다. 해시가 붙은 파일에는 맞는 설정이지만, 없는 파일 자리에 응답된 `index.html`에도 이 헤더가 붙었다. 배포 도중 새 코드 파일이 아직 전파되지 않은 시각에 이 주소를 요청한 브라우저는, 그 파일 이름으로 HTML을 1년 동안 캐시에 보관하게 된다.

Worker가 응답하는 404에는 이 헤더가 붙지 않는다(`_headers`는 [정적 자산 응답에만 적용](https://developers.cloudflare.com/workers/static-assets/headers/)된다). 따라서 다음 요청에서는 새 파일을 내려받는다.

![전과 후의 응답](./images/asset-404-before-after.svg '같은 요청에 HTML과 1년 캐시 대신 404가 간다')

## 수정 방법 비교

| 방법                                              | 장점                                            | 문제                                                                              |
| ------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `_headers`에서 HTML 응답의 캐시 제외              | 설정 한 줄                                      | `_headers`는 경로로만 대상을 지정한다. `/assets/*`로 응답된 HTML을 구분할 수 없다 |
| 해시 라우팅(`/#/memo/…`)으로 바꾸고 SPA 설정 끄기 | Worker가 필요 없다                              | 공유 링크 주소가 바뀐다. 이미 배포된 `/memo/<글>` 링크가 작동하지 않는다          |
| **없는 주소만 처리하는 Worker (선택)**            | 있는 파일은 그대로 빠르다. 주소 형식도 유지된다 | Worker 스크립트를 새로 추가해야 한다                                              |

## 없는 주소만 처리하는 Worker

`wrangler.jsonc` 설정을 다음과 같이 변경했다.

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

| 주소 조건                              | 응답              |
| -------------------------------------- | ----------------- |
| 마지막 경로 조각에 점이 없음 (앱 주소) | `index.html`, 200 |
| `/assets/…`이거나 확장자가 있는 주소   | 404               |

![요청 나누기](./images/asset-404-routing.svg '있는 파일은 Cloudflare가 바로, 없는 주소만 Worker가 받는다')

`wrangler dev`로 같은 Worker를 로컬에서 실행해 확인했다. 변경은 6개 파일, 60줄이다. 판단 함수(`worker/notFound.ts`)는 11줄이고, 단위 시험(`worker/notFound.test.ts`) 두 개(**앱 주소는 첫 화면으로**, **빌드 결과와 파일 주소는 404**)를 함께 추가했다.

| 주소                                                                       | 결과            |
| -------------------------------------------------------------------------- | --------------- |
| `/`, `/memo/db-backup`, `/safari/sproutfarm`                               | 200 `text/html` |
| 있는 코드·이미지 (`/assets/main-….js`, `/imgs/apidocs.svg`, `/robots.txt`) | 200, 원래 형식  |
| `/assets/Memo-doesnotexist.js`, `/assets/Memo-old.css`, `/imgs/nope.png`   | **404**         |

## 이후 Worker에 추가된 처리

이 Worker는 "없는 주소만 처리하는 작은 함수"로 시작했지만, 첫 화면 응답을 가로챌 수 있는 위치가 생기면서 역할이 늘었다.

| 추가 시각  | 처리                                                                                                   | 파일                              | PR                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------- |
| 2026-10-11 | 첫 화면에 관리자가 수정한 프로필·프로젝트를 삽입하고, 새 프로젝트의 데모 주소를 CSP `frame-src`에 추가 | `worker/siteHtml.ts`              | [#187](https://github.com/hyeoniverse/MacFolio/pull/187) |
| 2026-10-18 | `/files/<키>` 요청에 R2 버킷의 문서 파일(PDF·그림) 응답. Finder의 이력서·자격증 폴더가 사용            | `worker/files.ts`                 | [#255](https://github.com/hyeoniverse/MacFolio/pull/255) |
| 2026-10-19 | 글·프로젝트 주소마다 검색엔진용 제목·설명·본문 삽입, `sitemap.xml` 생성                                | `worker/seo.ts`, `serverPosts.ts` | [#269](https://github.com/hyeoniverse/MacFolio/pull/269) |
| 2026-10-21 | `rss.xml` 생성, 없는 글·프로젝트 주소는 404                                                            | `worker/seo.ts`                   | [#303](https://github.com/hyeoniverse/MacFolio/pull/303) |

![worker/index.ts의 분기 순서: /files/ → 파일 주소 404 → API 수신 → sitemap·rss → 첫 화면](./images/asset-404-worker-now.svg '2026-10-23 기준 Worker가 요청을 처리하는 순서. 이 글에서 추가한 404 판단은 2번에 그대로 있다')

이 글에서 추가한 `isAppRoute` 판단은 처음 형태 그대로 2번 단계에 남아 있다.

## 남은 것, 배운 것

- 판단 기준은 "마지막 경로 조각에 점이 있는가" 하나다. 글 주소에 점이 들어가면(`/memo/v1.2-release`) 404가 된다. 현재 글 주소에는 점이 없고, 필요해지면 글 주소 규칙을 먼저 변경한다.
- 로그아웃 상태에서 메모가 열리지 않던 현상의 원인이 이 문제 하나뿐인지는 확인하지 못했다.
- "없으면 첫 화면" 설정은 SPA에 편리한 기본값이지만, 정적 파일 서버가 404를 응답하지 못하게 만든다. 캐시 헤더와 겹치면 잘못된 응답이 오래 캐시에 남는다. 응답을 확인할 때 상태 코드뿐 아니라 `content-type`과 `cache-control`까지 함께 확인한 것이 이 문제를 찾은 계기였다.

## 직접 확인하기

없는 코드 파일을 요청해 상태 코드와 캐시 헤더를 확인한다.

```bash
curl -sI https://macfolio.hyeoniverse.com/assets/does-not-exist.js | grep -iE '^(HTTP|cache-control|content-type)'
# 404여야 한다. 200 + text/html이면 index.html로 떨어지는 것
curl -sI https://macfolio.hyeoniverse.com/memo/asset-404 | head -1   # 화면 주소는 200 (SPA)
```

Worker 시험은 `cd apps/react && npx vitest run worker/notFound.test.ts`로 실행한다. 설정은 루트의 [wrangler.jsonc](https://github.com/hyeoniverse/MacFolio/blob/main/wrangler.jsonc)에 있고, `not_found_handling`과 Worker를 먼저 호출하는 범위(`run_worker_first`)는 [Workers 정적 자산 라우팅 문서](https://developers.cloudflare.com/workers/static-assets/routing/)에 설명되어 있다. 배포는 [프론트엔드 배포를 GitHub Actions로](/memo/deploy-github-actions)의 `wrangler deploy`가 수행한다. 되돌리려면 이 Worker를 제거하고 다시 배포한다. 그러면 예전처럼 모든 없는 주소에 `index.html`이 응답된다.

## 관련 글

- [배포 직후 메모가 안 열리던 까닭 - 옛 코드 파일과 OS 경고창](/memo/app-error-alert): 이 문제가 화면에 드러난 경로
- [앱 안의 화면에 주소 붙이기 - 글과 프로젝트 공유 링크](/memo/app-links): Worker가 `index.html`로 보내는 앱 주소
- [사이트에 CSP와 보안 헤더 붙이기](/memo/security-headers)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [자바스크립트로만 그리는 데스크톱을 검색엔진이 읽게 하기](/memo/seo-crawlable): 이후 Worker에 추가된 SEO 처리

[^hash]: Vite는 빌드 결과 파일 이름에 내용으로 계산한 해시를 붙인다(`Memo-DJMDZtL5.js`). 내용이 같으면 이름도 같고, 내용이 바뀌면 이름이 바뀐다. 그래서 이름이 같은 파일은 오래 캐시해도 안전하다.

#MacFolio #배포 #Cloudflare #트러블슈팅
