---
title: 없는 코드 파일에 index.html을 주던 문제
date: 2026-10-05
category: 개발기/MacFolio/인프라
summary: 사이트는 없는 주소에 늘 index.html을 200으로, 그것도 1년 캐시 헤더와 함께 줬다. 배포로 사라진 옛 코드 파일에도 그랬다. 없는 주소만 받는 11줄짜리 Worker 함수로 앱 주소는 첫 화면, 파일 주소는 404로 나눴다.
---

로그아웃 상태에서 메모 앱이 열리지 않는 일이 있었다. 원인을 찾다가, 사이트가 **없는 코드 파일에도 200을 준다**는 것을 알았다.

```text
GET /assets/Memo-doesnotexist.js  →  200 text/html
```

## 왜 그랬나

프론트엔드는 Cloudflare Workers의 정적 자산으로 서빙한다. 앱 주소(`/memo/<글>`, `/safari/<프로젝트>`)는 실제 파일이 아니라서, 없는 주소에는 `index.html`을 주는 설정(`not_found_handling: single-page-application`)을 켜 두었다. 앱이 시작할 때 주소를 읽어 그 글을 연다.

이 설정은 주소를 가리지 않는다. 브라우저가 코드 파일을 요청할 때 붙이는 헤더(`Sec-Fetch-Dest: script`)를 붙여도 똑같이 `index.html`이 왔다.

## 언제 문제가 되나

메모 앱처럼 무거운 앱은 처음 열 때 코드를 받는다(지연 로딩). 파일 이름에는 내용의 해시가 붙어서, 배포하면 이름이 바뀌고 옛 파일은 사라진다. 배포 전에 열어 둔 탭은 옛 이름을 찾는다.

옛 파일 자리에 `index.html`이 오면 브라우저는 "코드인 줄 알았는데 HTML이 왔다"고 거절한다. 실제 사이트에 옛 파일 요청을 흉내 내 보니 Chrome과 Safari(WebKit) 모두 앱 창 대신 '새 버전이 있습니다 — 새로고침해 주세요' 창이 떴다. 이미 이 경우를 알아보는 처리가 있어서 크게 깨지지는 않았지만, 응답 헤더를 보니 더 나빴다.

```text
GET /assets/Memo-doesnotexist.js
content-type: text/html
cache-control: public, max-age=31536000, immutable
```

`_headers`에서 `/assets/*`에 "1년 동안, 다시 묻지 말고 쓰라"(`immutable`)를 걸어 두었다. 해시가 붙은 파일이라 맞는 설정인데, 없는 파일 자리에 온 `index.html`까지 이 헤더를 받았다. 배포 중에 새 코드 파일이 아직 퍼지지 않은 순간 이 주소를 받은 브라우저는, 그 이름으로 HTML을 1년 동안 들고 있게 된다.

Worker가 주는 404에는 이 헤더가 붙지 않는다(`_headers`는 정적 파일 응답에만 붙는다). 그래서 다음에 다시 요청하면 그때는 새 파일을 받는다.

![전과 후의 응답](./images/asset-404-before-after.svg '같은 요청에 HTML과 1년 캐시 대신 404가 간다')

## 고칠 방법

| 방법                                              | 좋은 점                                       | 문제                                                               |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `_headers`에서 HTML에는 캐시를 빼기               | 설정 한 줄                                    | `_headers`는 경로로만 고른다. `/assets/*`에 온 HTML을 가를 수 없다 |
| 해시 라우팅(`/#/memo/…`)으로 바꾸고 SPA 설정 끄기 | Worker가 필요 없다                            | 공유 링크 주소가 바뀐다. 이미 퍼진 `/memo/<글>` 링크가 깨진다      |
| 없는 주소만 받는 Worker (고른 방법)               | 있는 파일은 그대로 빠르다. 주소 모양은 그대로 | Worker 스크립트를 처음 둔다                                        |

## 없는 주소만 받는 Worker

설정을 이렇게 바꿨다.

```jsonc
"main": "./apps/react/worker/index.ts",
"assets": {
	"directory": "./apps/react/dist",
	"binding": "ASSETS",
	"not_found_handling": "none",
},
```

있는 파일은 지금처럼 Cloudflare가 바로 준다. Worker는 **없는 주소에만** 불리므로 요청이 늘지 않는다. Worker는 주소만 보고 나눈다.

```ts
export const isAppRoute = (pathname: string) => {
	if (pathname.startsWith('/assets/')) return false;
	const last = pathname.split('/').pop() ?? '';
	return !last.includes('.');
};
```

- 앱 주소(마지막 조각에 점이 없음): `index.html`을 200으로
- `/assets/…`이거나 확장자가 있는 주소: 404

![요청 나누기](./images/asset-404-routing.svg '있는 파일은 Cloudflare가 바로, 없는 주소만 Worker가 받는다')

`wrangler dev`로 로컬에서 같은 Worker를 띄워 확인했다(PR [#103](https://github.com/hyeoniverse/MacFolio/pull/103)). 고친 것은 6개 파일에 60줄이다. 판단 함수(`worker/notFound.ts`)는 11줄이고, 단위 시험(`worker/notFound.test.ts`) 두 개(**앱 주소는 첫 화면으로**, **빌드 결과와 파일 주소는 404**)가 함께 들어갔다.

| 주소                                                                       | 결과            |
| -------------------------------------------------------------------------- | --------------- |
| `/`, `/memo/db-backup`, `/safari/sproutfarm`                               | 200 `text/html` |
| 있는 코드·이미지 (`/assets/main-….js`, `/imgs/apidocs.svg`, `/robots.txt`) | 200, 원래 형식  |
| `/assets/Memo-doesnotexist.js`, `/assets/Memo-old.css`, `/imgs/nope.png`   | **404**         |

## 그 뒤의 Worker

이 Worker는 "없는 주소만 받는 작은 함수"로 시작했지만 자리가 생기자 일이 늘었다.

- 10월 11일: 첫 화면을 줄 때 관리자가 고친 프로필·프로젝트를 API에서 받아 HTML에 넣고, 새 프로젝트의 데모 주소를 CSP `frame-src`에 더한다(`worker/siteHtml.ts`). 다시 빌드하지 않아도 새 프로젝트 앱의 iframe이 막히지 않는다.
- 10월 18일: `/files/<키>`는 R2 버킷의 문서 파일(PDF·그림)을 준다(`worker/files.ts`). Finder의 이력서·자격증 폴더가 쓴다.

지금 `worker/index.ts`의 순서는 `/files/` → 앱 주소가 아니면 404 → 첫 화면이다. 404 판단은 처음 그대로다.

## 남은 것, 배운 것

- 판단은 "마지막 조각에 점이 있나"뿐이다. 글 주소에 점이 들어가면(`/memo/v1.2-release`) 404가 된다. 지금 글 주소에는 점이 없고, 생기면 글 주소 규칙을 먼저 바꾼다.
- 로그아웃 상태에서 메모가 안 열리던 일의 원인이 이것 하나뿐인지는 확인하지 못했다.
- "없으면 첫 화면"은 SPA에 편한 기본값이지만, 정적 파일 서버가 404를 줄 줄 모르게 만든다. 캐시 헤더와 겹치면 틀린 답을 오래 들고 있게 된다. 응답을 볼 때 상태 코드만이 아니라 `content-type`과 `cache-control`까지 함께 보는 습관이 이 문제를 찾게 했다.

관련 글: [배포 직후 메모가 안 열리던 까닭](/memo/app-error-alert), [앱 안의 화면에 주소 붙이기](/memo/app-links), [보안 헤더](/memo/security-headers), [프로젝트 앱](/memo/project-apps)

#MacFolio #배포 #Cloudflare #트러블슈팅
