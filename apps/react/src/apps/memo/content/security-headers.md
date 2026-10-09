---
title: 사이트에 CSP와 보안 헤더 붙이기
date: 2026-10-09
category: 인프라/배포·운영
summary: API 서버에는 helmet이 있었지만 사이트 자체에는 보안 헤더가 하나도 없었다. CSP의 출처 목록을 손으로 적지 않고 빌드 환경 변수와 PROJECTS에서 만들고, E2E가 같은 CSP를 켠 채로 돌면서 막힌 요청이 있으면 실패하게 했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목을 정리하다 보니, API 서버 응답에는 helmet이 보안 헤더를 붙이는데 정작 사이트(`macfolio.hyeoniverse.com`) 응답에는 아무 헤더도 없었다. `public/_headers`에는 캐시 설정만 있었다.

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

`worker/securityHeaders.ts`가 헤더 값을 만들고, Vite 플러그인이 빌드할 때 `dist/_headers` 끝에 모든 경로(`/*`) 덩어리로 더한다. 주소는 출처(`https://host`)만 남기고, `http(s)`가 아닌 값은 버린다.

`/memo/<글>` 같은 앱 주소는 파일이 아니라 Worker가 `index.html`을 대신 준다([없는 코드 파일에 index.html을 주던 문제](/memo/asset-404)). 이 응답에도 헤더가 붙는지 `wrangler dev`로 확인했다. Worker가 정적 자산 바인딩에서 받은 응답의 헤더를 그대로 넘기기 때문에 같은 헤더가 붙는다.

## E2E를 CSP를 켠 채로

CSP는 빠뜨린 출처가 하나라도 있으면 그 기능만 조용히 멈춘다. 그래서 E2E가 배포와 같은 CSP를 켠 채로 돌게 했다.

- 같은 플러그인이 `vite preview`(E2E가 띄우는 서버)에도 헤더를 붙인다
- E2E의 가짜 API(`http://api.test`)는 시험에서만 `CSP_TEST_API_URL`로 API 주소 자리에 더한다
- 모든 시험에 자동으로 붙는 fixture가 콘솔의 CSP 위반 메시지를 모아, 하나라도 있으면 시험을 실패시킨다

이렇게 하면 나중에 새 바깥 서비스를 붙이고 CSP에 넣는 것을 잊어도, 그 기능의 E2E가 CSP 위반으로 실패한다.

#MacFolio #보안 #CSP #Cloudflare #Vite
