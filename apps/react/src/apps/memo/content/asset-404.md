---
title: 없는 코드 파일에 index.html을 주던 문제
date: 2026-10-05
category: 개발기/MacFolio
summary: 사이트는 없는 주소에 늘 첫 화면(index.html)을 200으로 줬다. 앱 주소에는 맞지만, 배포로 사라진 옛 코드 파일에도 그랬다. 없는 주소만 받는 작은 Worker를 두어 앱 주소는 첫 화면, 파일 주소는 404로 나눴다.
---

로그아웃 상태에서 메모 앱이 열리지 않는다는 이야기를 듣고 원인을 찾다가, 사이트가 **없는 코드 파일에도 200을 준다**는 것을 알았다.

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

`wrangler dev`로 로컬에서 같은 Worker를 띄워 확인했다.

| 주소                                                                       | 결과            |
| -------------------------------------------------------------------------- | --------------- |
| `/`, `/memo/db-backup`, `/safari/sproutfarm`                               | 200 `text/html` |
| 있는 코드·이미지 (`/assets/main-….js`, `/imgs/apidocs.svg`, `/robots.txt`) | 200, 원래 형식  |
| `/assets/Memo-doesnotexist.js`, `/assets/Memo-old.css`, `/imgs/nope.png`   | **404**         |

메모 앱이 열리지 않던 일은 이것 말고 다른 원인도 있는지 더 보고 있다.
