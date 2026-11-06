---
title: no-cors 요청인 sendBeacon에도 적용되는 Cross-Origin-Resource-Policy
date: 2026-10-22
category: 개발 기록/MacFolio/트러블슈팅
series: 트래픽 분석
seriesOrder: 7
summary: API가 helmet 기본값으로 모든 응답에 CORP same-origin을 붙이고 있었다. 사이트와 API는 출처가 달라 Safari가 no-cors 요청인 sendBeacon의 응답을 취소했다. CORS와 CORP의 차이를 정리하고, 분석 이벤트 경로 하나만 cross-origin으로 지정했다.
---

| 증상                                                | 원인                                                                        | 해결                                                    | 영향 범위                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Safari 콘솔에 CORP 위반 에러가 5초마다 세 줄씩 추가 | helmet 기본값 `CORP: same-origin`이 no-cors 요청인 sendBeacon 응답에도 적용 | `POST /analytics/events` 한 경로만 `CORP: cross-origin` | Safari의 분석 이벤트 전송 (Chrome은 에러 없음) |

## 배경

### 출처와 사이트

브라우저는 웹 페이지가 다른 주소와 주고받는 데이터를 **출처(origin)** 단위로 제한한다. 출처는 주소의 스킴(`https`), 호스트(`macfolio.hyeoniverse.com`), 포트(`443`) 세 가지를 합친 값이고, 세 값이 모두 같아야 같은 출처다. 이 제한을 동일 출처 정책(same-origin policy)이라고 한다. 예를 들어 `https://a.example.com`의 스크립트는 `https://b.example.com`이 돌려준 응답 본문을 기본적으로 읽지 못한다.

**사이트(site)**는 이보다 넓은 단위다. 스킴과 **등록 가능한 도메인**(공개 접미사 목록에 있는 `.com`, `.co.kr` 같은 접미사 바로 앞 한 단계까지의 도메인)만 비교한다. MacFolio의 사이트 주소와 API 주소는 등록 가능한 도메인이 `hyeoniverse.com`으로 같아 ==같은 사이트이지만, 하위 도메인이 달라 다른 출처==다.

![사이트 주소와 API 주소를 스킴, 하위 도메인, 등록 가능한 도메인, 포트로 나눠 비교하고, CORP 값별로 각 문서에서 응답이 차단되는지 정리한 표](./images/analytics-beacon-corp-origin-site.svg '출처와 사이트의 기준. 두 주소는 같은 사이트, 다른 출처다')

### CORS와 요청 모드

**CORS(Cross-Origin Resource Sharing)**는 서버가 응답 헤더로 "이 출처의 스크립트에는 응답을 읽게 해도 된다"고 허락하는 규칙이다. 브라우저는 `fetch()`로 다른 출처에 요청을 보내면 응답의 `Access-Control-Allow-Origin` 값을 확인하고, 요청한 페이지의 출처와 일치할 때만 응답 본문을 스크립트에 넘긴다.

![웹 문서 foo.example이 같은 출처 서버에서 HTML·CSS·이미지를 받고, 다른 출처 bar.other에서 이미지와 글꼴을 받는 구조. 다른 출처 요청은 CORS로 제어된다](./images/analytics-beacon-corp-mdn-cors.png '같은 출처 요청은 항상 허용되고, 다른 출처 요청은 CORS로 제어된다 (MDN)')

Fetch 표준은 요청마다 **모드(mode)**를 지정한다. sendBeacon 문제와 관련된 모드는 두 가지다.

| 모드      | 대표 요청                                               | 응답을 스크립트가 읽을 수 있나 | 브라우저가 검사하는 헤더              |
| --------- | ------------------------------------------------------- | ------------------------------ | ------------------------------------- |
| `cors`    | `fetch()`, `XMLHttpRequest`                             | CORS 허락이 있으면 읽는다      | `Access-Control-Allow-Origin`         |
| `no-cors` | `<img>`, `<script>`, 본문이 `text/plain`인 `sendBeacon` | 읽지 못한다 (불투명 응답)      | `Cross-Origin-Resource-Policy` (CORP) |

`no-cors` 모드의 응답은 스크립트가 내용을 읽지 못하는 **불투명 응답(opaque response)**이다. 그래도 `<img>`라면 이미지가 화면에 그려지듯, 응답 바이트 자체는 페이지를 실행하는 프로세스로 전달된다. **CORP(Cross-Origin-Resource-Policy)**는 서버가 "내 응답을 다른 출처나 다른 사이트의 문서에 이렇게라도 전달하지 말라"고 지정하는 헤더다. 값은 `same-origin`, `same-site`, `cross-origin` 세 가지다. Spectre처럼 같은 프로세스 메모리에 올라온 데이터를 읽어 내는 공격에 대비해 도입되었다.

### sendBeacon과 helmet

[`navigator.sendBeacon(url, data)`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)은 작은 데이터를 POST로 보내고 응답을 기다리지 않는 API다. 페이지를 닫는 중에도 전송이 보장되어 방문 통계 수집에 쓴다. MacFolio는 방문 이벤트를 모아 5초마다(`FLUSH_MS = 5000`) 다음처럼 전송한다(`apps/react/src/shared/analytics/analytics.ts`).

```ts
const body = JSON.stringify({ visitId, events: queue.splice(0, MAX_BATCH) });
// 글자를 그대로 넘기면 text/plain으로 간다: CORS 사전 요청이 없다
navigator.sendBeacon(`${env.apiUrl}/analytics/events`, body);
```

[helmet](https://helmetjs.github.io/)은 Express 응답에 보안 헤더 여러 개를 한 번에 붙이는 미들웨어다. 옵션 없이 `helmet()`으로 등록하면 기본값으로 `Cross-Origin-Resource-Policy: same-origin`을 포함한 헤더 십여 개가 모든 응답에 붙는다.

## 증상

맥 Safari에서 사이트를 열어 두면 개발자 도구 콘솔에 같은 에러가 5초마다 세 줄씩 추가됐다. 5초는 ==분석 이벤트 전송 주기==(`FLUSH_MS = 5000`)와 같다([sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect)).

```text
[Error] Cancelled load to https://macfolio-api.hyeoniverse.com/analytics/events because it violates the resource's Cross-Origin-Resource-Policy response header.
[Error] Beacon API cannot load https://macfolio-api.hyeoniverse.com/analytics/events. Cancelled load to … Cross-Origin-Resource-Policy response header.
[Error] Failed to load resource: Cancelled load to … Cross-Origin-Resource-Policy response header. (events, line 0)
```

Chrome 콘솔에는 같은 에러가 나타나지 않아, Safari에서 콘솔을 확인하기 전까지 발견하지 못했다.

## 원인 추적

운영 API에 같은 형식의 요청을 보내 응답 헤더를 확인했다. 형식이 틀린 본문(`{}`)을 보내 데이터를 저장하지 않고 400 응답만 받았다. `access-control-allow-origin`은 사이트 주소와 일치해 CORS는 통과하지만, `cross-origin-resource-policy`는 `same-origin`이다.

```console
$ curl -sD - -o /dev/null -X POST \
    -H 'Content-Type: text/plain' -H 'Origin: https://macfolio.hyeoniverse.com' \
    --data '{}' https://macfolio-api.hyeoniverse.com/analytics/events
HTTP/2 400
access-control-allow-origin: https://macfolio.hyeoniverse.com   ← CORS는 허용
access-control-allow-credentials: true
cross-origin-resource-policy: same-origin                       ← Safari가 응답을 취소한 지점
cross-origin-opener-policy: same-origin
x-ratelimit-remaining-events: 119
```

## 원인

### helmet 기본값의 CORP

API는 `apps/api/src/app.setup.ts`에서 helmet을 옵션 없이 등록한다.

```ts
app.use(helmet());
```

그래서 [`Cross-Origin-Resource-Policy: same-origin`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy)이 **모든 응답**에 붙는다. 사이트(`macfolio.hyeoniverse.com`)와 API(`macfolio-api.hyeoniverse.com`)는 [배경](#출처와-사이트)에서 확인했듯 같은 사이트이지만 다른 출처다. `same-origin`은 출처가 정확히 같아야 하므로, 사이트가 받는 API 응답은 이 조건을 만족하지 못한다.

### sendBeacon은 no-cors 요청이다

분석 이벤트는 `sendBeacon`으로 문자열 본문을 전송한다. 본문 형식이 `text/plain`이면 Beacon 스펙[^beacon]은 요청 모드를 `no-cors`로 정한다. CORS 사전 요청(preflight)을 피하려고 일부러 고른 형식이다([zod 스키마 하나로 분석 이벤트의 전송 형식과 서버 검증 통합하기](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206)). Fetch 스펙은 `no-cors` 요청의 ==응답에 CORP 검사를 적용한다==[^fetch]. 그래서 Safari는 응답 헤더의 `same-origin`과 요청한 문서의 출처를 비교해 응답을 취소했다.

![다른 출처의 응답이 도착하면 cors 모드는 CORS 검사를, no-cors 모드는 CORP 검사를 거친다. sendBeacon은 no-cors 경로를 따르고 CORP 검사에 실패하면 응답이 취소된다](./images/analytics-beacon-corp-modes.svg '요청 모드에 따라 브라우저가 검사하는 헤더가 다르다')

![전: Safari가 sendBeacon으로 API에 POST를 보내고, 204 응답의 CORP same-origin 때문에 응답을 취소한다. 후: 같은 요청에 CORP cross-origin이 붙어 응답을 받는다](./images/analytics-beacon-corp-flow.svg 'sendBeacon 응답과 CORP 전후 (도식)')

### CORS와 CORP는 별개의 검사

> [!IMPORTANT] CORS 통과와 CORP 검사는 무관하다
> 두 헤더 모두 다른 출처와의 관계를 정하지만 대상과 방향이 다르다. CORS가 통과했다고 CORP 검사를 건너뛰지 않는다.

| 항목       | CORS (`Access-Control-Allow-Origin`)        | CORP (`Cross-Origin-Resource-Policy`)        |
| ---------- | ------------------------------------------- | -------------------------------------------- |
| 의미       | 이 출처의 스크립트가 응답을 **읽어도** 된다 | 이 출처의 문서에 응답을 **전달해도** 된다    |
| 적용 대상  | `cors` 모드 요청 (`fetch`, XHR)             | `no-cors` 모드 요청 (`<img>`, `<script>` 등) |
| 값         | 허용할 출처 하나 또는 `*`                   | `same-origin`, `same-site`, `cross-origin`   |
| 이 API     | 허용 목록의 출처만 허용                     | helmet 기본값 `same-origin`                  |
| sendBeacon | `text/plain`이라 사전 요청 없음             | Safari가 이 검사로 응답 취소                 |

CORP는 다른 출처의 문서가 `<img>`·`<script>`로 응답 바이트를 프로세스 메모리에 불러오는 것을 막는 헤더이고, CORS처럼 스크립트의 읽기 권한을 다루지 않는다. 같은 응답에 두 헤더가 함께 붙어 있어도 브라우저는 요청 모드에 맞는 쪽 하나만 검사한다.

## 해결

### 이벤트 경로만 cross-origin

수정은 [#320](https://github.com/hyeoniverse/MacFolio/pull/320)이다. 전체 helmet 설정은 그대로 두고 `POST /analytics/events` 한 경로만 헤더를 덮어쓴다(`apps/api/src/analytics/analytics.controller.ts`). 업로드 파일(`files.controller.ts`)과 글 공유 이미지(`og.png`, `posts.controller.ts`)가 이미 같은 방식으로 `cross-origin`을 지정하고 있었다([Markdown 블로그에 글쓰기 붙이기](/memo/post-editor)). NestJS의 `@Header` 데코레이터는 해당 경로의 응답에만 헤더를 설정하고, 컨트롤러가 응답을 보내는 시점에 적용되므로 helmet이 먼저 붙인 값을 덮어쓴다.

```ts
@Post('events')
@RateLimit('events')
@HttpCode(204)
// Safari는 sendBeacon(no-cors) 응답에도 CORP를 따져서, helmet 기본값(same-origin)이면 다른 주소의 사이트가 보낸 것을 취소한다
@Header('Cross-Origin-Resource-Policy', 'cross-origin')
@ApiConsumes('text/plain', 'application/json')
```

경로별 CORP 값은 아래와 같다.

| 경로                      | 전             | 후                    |
| ------------------------- | -------------- | --------------------- |
| `POST /analytics/events`  | `same-origin`  | **`cross-origin`**    |
| `GET /files/*`            | `cross-origin` | `cross-origin` (유지) |
| `GET /posts/:slug/og.png` | `cross-origin` | `cross-origin` (유지) |
| 그 밖의 모든 경로         | `same-origin`  | `same-origin` (유지)  |

<details>
<summary>same-site 대신 cross-origin을 지정하는 이유</summary>

운영 사이트와 API는 같은 사이트(`hyeoniverse.com`)라 `same-site`로도 Safari의 검사를 통과한다. 그러나 PR 미리보기 주소(`*-macfolio.hyeoniverse.workers.dev`)는 등록 가능한 도메인이 달라 다른 사이트다([PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)). 미리보기에서도 분석 이벤트 전송이 같은 에러를 내지 않게 하려면 `cross-origin`이 필요하다. 파일·공유 이미지 응답과 같은 값이라 경로별 설정도 한 종류로 유지된다.

</details>

### cross-origin으로 열어도 노출되는 것이 없는 이유

- **CORP는 응답을 문서에 전달할지만 정한다.** 이 경로의 응답은 ==본문 없는 204==다. 다른 출처에 전달되어도 노출되는 데이터가 없다.
- **CORS 설정은 그대로다.** 허용 목록에 없는 출처의 스크립트는 여전히 응답을 읽지 못한다.
- **쿠키 규칙도 그대로다.** `credentials`는 허용 목록에 정확히 일치하는 출처에만 허용한다.
- **요청 제한(`@RateLimit('events')`, 1분에 120개)과 입력 검증도 그대로다.**

## 확인

API e2e 시험(`apps/api/test/analytics.e2e.test.ts`)에 이벤트 경로는 `cross-origin`이고 다른 경로(`/health`)는 helmet 기본값을 유지하는지 확인하는 항목을 추가했다.

```ts
it('다른 주소의 사이트가 보낸 sendBeacon을 Safari가 버리지 않게 CORP는 cross-origin. 다른 경로는 helmet 기본값', async () => {
	const response = await send(visit('v-corp0001')).expect(204);
	expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
	const health = await request(app.getHttpServer()).get('/health');
	expect(health.headers['cross-origin-resource-policy']).toBe('same-origin');
});
```

`@Header` 한 줄을 제거하고 실행하면 이 시험이 실패하는 것도 확인했다.

```text
AssertionError: expected 'same-origin' to be 'cross-origin'
Tests  1 failed | 10 passed (11)
```

배포 후 운영 API의 응답이다. 이벤트 경로는 `cross-origin`, `/health`는 `same-origin`이다(관련 헤더만 발췌).

```console
$ curl -sD - -o /dev/null -X POST -H 'Content-Type: text/plain' \
    -H 'Origin: https://macfolio.hyeoniverse.com' --data '{}' \
    https://macfolio-api.hyeoniverse.com/analytics/events
HTTP/2 400
access-control-allow-origin: https://macfolio.hyeoniverse.com
cross-origin-resource-policy: cross-origin

$ curl -sD - -o /dev/null -H 'Origin: https://macfolio.hyeoniverse.com' \
    https://macfolio-api.hyeoniverse.com/health
HTTP/2 200
access-control-allow-origin: https://macfolio.hyeoniverse.com
cross-origin-resource-policy: same-origin
```

## 재발 방지

> [!WARNING] helmet 기본값이 다른 no-cors 요청에도 적용된다
> 이후 API 응답을 `<img>`, `<audio>`, `sendBeacon` 같은 no-cors 경로로 받는 기능을 추가하면 같은 문제가 생긴다. 파일·공유 이미지·이벤트 세 경로처럼 해당 경로에만 `cross-origin`을 지정한다.

새 경로를 추가할 때 확인할 항목은 다음과 같다.

| 질문                                          | 예이면                                      |
| --------------------------------------------- | ------------------------------------------- |
| 사이트가 `fetch()`로 읽는 응답인가            | CORS 허용 목록만 확인한다 (CORP는 무관)     |
| `<img>`·`<audio>`·`<video>`의 `src`로 쓰는가  | 해당 경로에 `CORP: cross-origin`을 지정한다 |
| `sendBeacon`이나 `mode: 'no-cors'`로 보내는가 | 해당 경로에 `CORP: cross-origin`을 지정한다 |

## 남은 과제

- **그동안 Safari 방문이 집계에서 빠졌는지는 확인하지 못했다.** 콘솔의 'Cancelled load'는 응답을 취소했다는 뜻이다. 요청 본문이 서버에 도착해 저장된 뒤 응답만 버려졌는지, 전송 단계에서 취소되었는지는 이 에러로 구분할 수 없다. 배포 시각 전후의 Safari 방문 수 변화로 판단해야 한다.

## 관련 글

- [sendBeacon으로 5초마다 묶어 보내는 방문 이벤트](/memo/analytics-collect): 5초마다 sendBeacon으로 이벤트를 전송하는 코드
- [zod 스키마 하나로 분석 이벤트의 전송 형식과 서버 검증 통합하기](/memo/contracts-package#분석-이벤트의-전송수신조회-형식-206): text/plain 본문으로 CORS 사전 요청을 피하는 이유
- [macOS Safari와 iOS Safari의 렌더링 차이](/memo/safari-macos-ios-rendering): Safari에서만 생기는 차이를 정리한 글
- [PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only): 사이트와 미리보기 주소의 CORS·쿠키 규칙
- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers): 사이트 응답의 보안 헤더
- [Markdown 블로그에 글쓰기 붙이기](/memo/post-editor): 업로드 파일 응답에 CORP cross-origin을 지정한 글

[^beacon]: [Beacon 스펙](https://w3c.github.io/beacon/#sec-processing-model)의 처리 모델. 본문의 Content-Type이 CORS 안전 목록(`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`)에 있으면 요청 모드를 `no-cors`로, 아니면 `cors`로 정한다.

[^fetch]: [Fetch 스펙의 cross-origin resource policy check](https://fetch.spec.whatwg.org/#cross-origin-resource-policy-check). 요청 모드가 `no-cors`인 응답에 CORP 헤더를 적용해 차단 여부를 정한다.

<details>
<summary>참고 문헌</summary>

- [MDN: Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [MDN: Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN: Cross-Origin-Resource-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy)
- [MDN: Request.mode](https://developer.mozilla.org/en-US/docs/Web/API/Request/mode)
- [MDN: Navigator.sendBeacon()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon)
- [W3C: Beacon](https://w3c.github.io/beacon/)
- [WHATWG: Fetch Standard, cross-origin resource policy check](https://fetch.spec.whatwg.org/#cross-origin-resource-policy-check)
- [helmet 문서](https://helmetjs.github.io/)
- [NestJS: Controllers, Headers](https://docs.nestjs.com/controllers#headers)

</details>

<details>
<summary>사진 출처</summary>

- CORS 요청 구조 도식: MDN Web Docs, [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) ([원본 SVG](https://mdn.github.io/shared-assets/images/diagrams/http/cors/fetching-page-cors.svg)), CC BY-SA 2.5

</details>

#MacFolio #Safari #CORS #CORP #helmet #NestJS #트러블슈팅
