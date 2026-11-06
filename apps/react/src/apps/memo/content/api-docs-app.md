---
title: Vite 두 번째 진입점과 iframe으로 Scalar API 문서 격리하기
date: 2026-10-05
category: 개발 기록/MacFolio/구조·상태 관리
summary: 서버 메뉴의 'API 문서 열기'가 사이트 안의 앱을 연다. 서버의 Swagger를 iframe에 표시하던 첫 방법을 폐기하고, 코드에서 생성한 openapi.json을 별도 페이지에서 Scalar로 렌더링한다. 스냅숏 시험, 방문 기록, overflow clip 수정까지 정리했다.
---

## 배경: API 문서와 OpenAPI

**API 문서**는 서버가 받는 요청의 주소, 메서드(GET·POST 등), 입력 형식, 응답 형식을 정리한 문서다. 프론트엔드 개발자나 외부 사용자는 이 문서를 확인하고 서버를 호출하는 코드를 작성한다.

이 문서를 사람이 손으로 쓰면 코드와 문서가 쉽게 어긋난다. 그래서 많은 서버 프레임워크는 **OpenAPI** 형식의 문서를 코드에서 자동으로 생성한다. OpenAPI는 HTTP API의 경로·매개변수·응답을 JSON이나 YAML로 기술하는 표준 명세다[^openapi]. 예를 들어 MacFolio API의 `/health` 경로는 `openapi.json`에 다음과 같이 기록된다(빈 필드는 생략).

```json
"/health": {
	"get": {
		"operationId": "HealthController_check",
		"responses": {
			"200": { "content": { "application/json": { "schema": { "$ref": "#/components/schemas/HealthResponse" } } } },
			"503": { "description": "DB에 연결할 수 없다" }
		},
		"tags": ["health"]
	}
}
```

이 JSON은 사람이 읽기 어려우므로, **Swagger UI**나 **Scalar** 같은 렌더러가 JSON을 읽어 목차·요청 예시·"요청 보내기" 버튼이 있는 화면으로 그린다. MacFolio API는 NestJS의 OpenAPI 모듈[^nest]로 이 문서를 생성하고, 서버의 `/docs` 경로에서 Swagger UI로 제공한다.

![서버의 Swagger UI](./images/api-docs-app-swagger.jpg '서버의 /docs. Swagger UI 기본 스타일로 태그(health, auth, memo …)별 경로 목록을 표시한다')

메뉴 막대의 서버 상태 메뉴에는 'API 문서 열기' 항목이 있다. 처음에는 이 `/docs`를 새 탭으로 열었다. 그런데 macOS 화면을 재현한 사이트에서 이 항목만 다른 탭으로 전환되는 동작이 일관되지 않았다. 그래서 API 문서도 **사이트 안의 앱**으로 열게 했다. 작업은 PR [#95](https://github.com/hyeoniverse/MacFolio/pull/95)에 포함되어 있고, 같은 날 구현 방식을 한 번 전면 변경했다.

## 첫 방법: 서버의 /docs를 iframe으로

**iframe**은 한 웹 페이지 안에 다른 웹 페이지를 통째로 삽입하는 HTML 요소다. 프로젝트 앱이 데모 사이트를 창 안에 표시하는 방식이 iframe이므로, `/docs`도 같은 방식으로 넣으려 했다.

문제는 서버의 보안 헤더였다. 서버는 [helmet](https://helmetjs.github.io/) 미들웨어로 보안 관련 응답 헤더를 일괄 추가하는데, 그중 두 개가 iframe 삽입을 제한한다.

| 헤더                                              | 의미                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `X-Frame-Options: SAMEORIGIN`                     | 이 문서를 삽입하는 모든 상위 프레임이 문서와 같은 출처일 때만 삽입을 허용한다[^xfo]      |
| `Content-Security-Policy: frame-ancestors 'self'` | 같은 제한을 CSP(콘텐츠 보안 정책)로 표현한 지시어. 허용할 출처를 목록으로 지정할 수 있다 |

**출처**(origin)는 주소의 프로토콜·호스트·포트 세 가지 조합이다. 사이트(`macfolio.hyeoniverse.com`)와 API 서버(`macfolio-api.hyeoniverse.com`)는 호스트가 달라 서로 다른 출처다. 따라서 사이트가 `/docs`를 iframe에 넣으면 브라우저가 표시를 차단한다.

![iframe 삽입 판단](./images/api-docs-app-frame-headers.svg '브라우저는 iframe 응답의 두 헤더와 바깥 페이지의 출처를 비교한다. 첫 방법은 /docs에서만 예외를 두었다')

그래서 `/docs` 경로에서만 두 헤더를 완화하고 사이트 주소를 허용했다. 동작은 했지만 문제가 세 가지 있었다.

- 서버가 중지되면 문서도 빈 창이 된다. 서버 상태 메뉴에서 여는 문서인데, 서버에 장애가 있는 시각에는 문서를 확인할 수 없다.
- 서버의 보안 헤더에 예외를 하나 추가해야 한다.
- Swagger 기본 스타일이라 사이트 디자인과 일치하지 않는다(위 캡처).

## 세 방법 비교

| 방법                                            | 서버 중지 시 | 서버 보안 헤더 | 사이트 주소·CSS                  |
| ----------------------------------------------- | ------------ | -------------- | -------------------------------- |
| 서버의 `/docs`를 iframe으로 (첫 방법)           | 빈 창        | 예외 필요      | 영향 없음                        |
| openapi.json + Scalar 컴포넌트를 창 안에 렌더링 | 문서 표시    | 변경 없음      | `#`과 `body` CSS가 사이트에 영향 |
| openapi.json + 별도 페이지를 iframe (**현재**)  | 문서 표시    | 변경 없음      | iframe 안으로 격리               |

## 현재 방법: openapi.json을 사이트에서 렌더링

문서를 서버에서 불러오지 않고, **API 코드에서 생성한 [`openapi.json`](https://swagger.io/specification/)을 사이트 빌드에 포함해** 렌더링하기로 했다. 서버가 꺼져 있어도 문서는 사이트 파일 안에 있으므로 항상 표시된다.

1. API의 `createOpenApiDocument(app)`가 서버의 `/docs`와 같은 문서를 생성한다.
2. 단위 시험 `openapi.test.ts`가 이 문서를 `apps/react/src/apps/apidocs/openapi.json`과 비교한다. Vitest의 [`toMatchFileSnapshot`](https://vitest.dev/guide/snapshot.html)을 사용하므로, ==컨트롤러나 DTO를 수정하고 파일을 다시 생성하지 않으면 CI가 실패한다==. 재생성 명령은 `pnpm --filter @macfolio/api openapi`다.
3. 'API 문서' 앱이 이 파일을 [Scalar](https://github.com/scalar/scalar)로 렌더링한다.

![문서 구조](./images/api-docs-app-structure.svg 'API 코드 → 스냅숏 시험 → openapi.json → 별도 페이지 → iframe')

**스냅숏 시험**은 어떤 값의 현재 결과를 파일로 저장해 두고, 이후 실행 결과가 저장된 파일과 같은지 비교하는 시험이다. 다르면 시험이 실패하고, 의도한 변경이면 파일을 갱신한다.

```ts
it('사이트의 API 문서 앱이 쓰는 openapi.json이 코드와 같다', async () => {
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
	const app = moduleRef.createNestApplication();
	const document = createOpenApiDocument(app);
	await app.close();
	expect(document.paths).toHaveProperty('/health');
	await expect(`${JSON.stringify(document, null, '\t')}\n`).toMatchFileSnapshot(
		'../../react/src/apps/apidocs/openapi.json'
	);
});
```

예를 들어 댓글 API에 새 경로를 추가하고 `openapi.json`을 재생성하지 않으면, 코드에서 생성한 문서에는 새 경로가 있고 파일에는 없으므로 이 시험이 실패한다. 현재 이 파일은 3,389줄이고, 경로 69개와 메서드 95개를 포함한다. 경로를 하나 추가하는 PR은 이 파일의 변경된 줄까지 함께 보여 주므로, 리뷰에서 API 형태의 변경 내용을 별도로 찾을 필요가 없다.

> [!NOTE]
> 문서 생성에는 DB가 필요 없다. `PrismaService`는 첫 쿼리 시각에 연결하므로, 앱 모듈만 생성하고 문서를 추출한 뒤 종료한다. 그래서 DB 없이 실행되는 단위 시험에 포함할 수 있었다.

서버 보안 헤더의 예외는 되돌렸다. 서버의 `/docs`는 새 탭으로 여는 용도로 유지한다.

### 문서에서 직접 요청 보내기

Scalar의 'Test Request'는 문서 화면에서 서버로 실제 요청을 보내고 응답을 표시하는 기능이다. 브라우저에서 다른 출처의 서버를 호출하려면 서버가 CORS 응답 헤더로 그 출처를 허용해야 한다. 이 사이트는 이미 서버의 CORS 허용 목록에 등록된 주소라 다른 앱과 같은 방식으로 서버를 호출할 수 있다.

| 설정                               | 값·이유                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `customFetch`                      | `credentials: 'include'`. 관리자 API는 세션 쿠키로 인증하기 때문이다   |
| 프록시 주소                        | 지정하지 않음. 요청이 Scalar 프록시를 거치지 않고 서버로 직접 전송된다 |
| 사용 통계, AI 채팅, MCP, 외부 글꼴 | 모두 비활성화. 외부로 요청을 보내는 기능이다                           |
| `VITE_API_URL`이 없을 때           | 요청 버튼만 숨기고 문서는 그대로 표시                                  |

## Scalar를 사이트에서 격리

처음에는 Scalar를 사이트 안의 React 컴포넌트로 렌더링했다. 화면에 표시하자마자 주소 막대가 `/#description/introduction`으로 바뀌었다. Scalar는 현재 읽고 있는 위치를 주소의 `#` 뒷부분(해시)에 기록하고, 목차를 누르면 History API의 `pushState`로 방문 기록을 추가한다. ==이 동작을 끄는 설정은 없었다==.

이 사이트의 주소 막대는 **맨 앞 창만** 갱신한다. 여러 앱이 각자 주소를 쓰면 서로 덮어쓰기 때문에, 갱신 위치를 한 곳(`syncAddressBar`)으로 통합해 두었다([History API로 SPA 창 상태를 /memo·/safari 주소와 연결하기](/memo/app-links)). Scalar가 주소를 직접 바꾸면 이 규칙이 깨진다.

CSS도 충돌했다. Scalar의 스타일시트는 `body`에도 규칙을 적용해 사이트 전체에 영향을 주었고, 반대로 Scalar 화면은 사이트 창의 `text-align: center`를 상속받아 모든 글이 가운데 정렬됐다.

그래서 Scalar를 **별도 페이지**(`api-docs.html`, Vite의 두 번째 진입점[^mpa], `src/apps/apidocs/page/` 64줄)에 두고, 'API 문서' 앱은 그 페이지를 iframe으로 표시한다. 같은 사이트의 파일이므로 iframe 삽입을 막는 헤더 문제도 없다. 프로젝트 앱이 사용하던 iframe 틀(로딩 화면, iframe을 클릭하면 창을 앞으로 가져오기)을 `WebFrame` 컴포넌트로 추출해 두 앱이 공유한다.

| 문제            | 격리 후                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| 주소의 `#` 변경 | iframe 내부 주소만 바뀌고 사이트 주소는 그대로다                                            |
| `body` CSS 충돌 | CSS가 그 페이지 안에만 적용된다. 용량이 큰 Scalar(Vue 포함)도 창을 여는 시각에만 내려받는다 |
| 다크 모드       | 같은 출처라서 문서 페이지가 사이트의 `<html data-theme>`을 감시해 다크 모드를 따른다        |

### iframe의 방문 기록

iframe으로 격리해도 방문 기록은 분리되지 않는다. 브라우저 탭의 방문 기록은 탭 하나에 목록 하나이고, iframe 안에서 `pushState`로 추가한 항목도 같은 목록에 쌓인다. 뒤로 가기 버튼은 이 목록을 마지막 항목부터 되돌린다.

![iframe과 방문 기록](./images/api-docs-app-history.svg '왼쪽: 목차를 누를 때마다 탭의 방문 기록이 늘어난다. 오른쪽: pushState를 replaceState로 바꾸면 늘어나지 않는다')

이 사이트에서 뒤로 가기는 "사이트 밖으로 이동"이어야 한다. 그래서 문서 페이지 안에서만 `pushState`를 `replaceState`로 대체했다. [`replaceState`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)는 새 항목을 추가하지 않고 현재 항목의 주소만 바꾼다.

```ts
// Scalar는 목차를 누를 때마다 pushState로 방문 기록을 쌓는다. iframe의 기록도 사이트의 뒤로 가기에 섞이므로,
history.pushState = history.replaceState.bind(history);
```

다크 모드는 문서 페이지가 부모 창의 `<html>`에 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)를 등록해 `data-theme` 속성만 감시한다. `MutationObserver`는 DOM의 속성·자식 변경을 감지해 콜백을 호출하는 브라우저 API다. 같은 출처라 부모 창의 DOM에 접근할 수 있다. 문서 페이지를 단독으로 열면 부모 창이 없으므로 브라우저의 다크 모드 설정을 따른다. 화면 시험은 목차를 눌러도 사이트 주소와 `history.length`가 그대로인지 확인한다.

![API 문서 앱](./images/api-docs-app-window.jpg '사이트 안의 창으로 연 API 문서. 목차를 눌러도 사이트 주소는 그대로다')

## 창 틀이 위로 스크롤된 문제

'Test Request'를 누르자 창의 제목 막대가 위로 잘려 보였다. 창 틀(`.container`)이 10px 스크롤되어 있었다. 창 틀은 `overflow: hidden`이다. MDN에 따르면 hidden 요소는 내용이 넘치면 스크롤바 없는 **스크롤 컨테이너**가 되고, ==hidden은 사용자의 스크롤만 막을 뿐== `scrollTop` 변경, `scrollTo()`, 숨은 요소로 초점 이동 같은 방법으로는 여전히 스크롤된다[^overflow]. iframe 안에서 초점이 이동하자 브라우저가 그 요소를 화면에 표시하려고 바깥의 창 틀까지 스크롤했다.

`overflow: clip`으로 변경했다. clip은 스크롤 컨테이너를 생성하지 않아, 프로그램으로도 스크롤되지 않는다. 모든 창이 같은 틀(`src/desktop/window/Window.css`)을 사용하므로 모든 창에 함께 적용됐다.

| 값       | 스크롤 컨테이너 | 마우스 휠 스크롤 | `scrollTo()`·초점 이동에 의한 스크롤 |
| -------- | --------------- | ---------------- | ------------------------------------ |
| `hidden` | 넘치면 생성     | 불가             | 가능                                 |
| `clip`   | 생성하지 않음   | 불가             | 불가                                 |

![hidden과 clip](./images/api-docs-app-overflow.svg 'hidden은 코드와 브라우저가 스크롤할 수 있다. clip은 스크롤 영역 자체가 없다')

## 클릭할 수 없는 줄이 강조 표시되던 문제

서버 메뉴 맨 위의 'MacFolio API · 정상' 줄은 상태 표시 전용이다. 그런데 공통 메뉴의 버튼 항목으로 구현되어, 마우스를 올리면 클릭할 수 있는 항목처럼 파란색 강조가 표시됐다. 공통 메뉴에 **정보 줄**(`info`) 항목 유형을 추가했다. 아이콘 영역은 다른 항목과 정렬하되, 버튼이 아니므로 클릭되지도 강조되지도 않는다.

## Wi-Fi 아이콘

Wi-Fi 아이콘은 같은 두께의 반원 세 개로 렌더링되어 macOS 아이콘과 형태가 달랐다. 아래쪽 꼭짓점은 채워진 부채꼴로, 위쪽 두 줄은 끝이 둥근 호로 다시 그렸다. 막대 수(0~3)로 상태를 표시하는 방식과 '연결할 수 없음'의 사선은 그대로 유지했다([/health 응답 시간을 막대 수로 환산하고 no-cors 요청으로 CORS 차단을 구분하는 서버 상태 표시](/memo/server-status-wifi)).

## 확인

| 시험                                   | 확인 내용                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/openapi.test.ts` (단위)  | 코드와 `openapi.json`이 같은지. 컨트롤러를 수정하고 파일을 다시 생성하지 않으면 CI가 이 단계에서 실패한다                                                                                                                                         |
| `apps/react/e2e/server-status.spec.ts` | **'API 문서 열기'는 새 탭이 아니라 사이트 안의 'API 문서' 앱으로 열고, 거기서 서버를 직접 불러 볼 수 있다**: 목차를 눌러도 사이트 주소와 `history.length`가 그대로인지. **서버 주소가 없어도 'API 문서' 앱은 문서를 보여 주고, 요청 버튼만 없다** |
| `apps/react/e2e/menubar.spec.ts`       | **API 문서·프로젝트 앱(iframe 창): 새로 고침과 새 탭에서 열기**: 두 앱이 같은 `WebFrame`을 사용하는지                                                                                                                                             |

## 남은 과제와 정리

- Scalar 도입으로 `pnpm-lock.yaml`이 1,272줄 늘었다. Vue도 함께 설치된다. 창을 여는 시각에만 내려받는 별도 페이지라 첫 화면 번들 크기에는 포함되지 않지만, 의존성 감사 대상은 늘었다.
- `openapi.json`이 사이트에 포함되므로, 서버 배포 전에 병합한 문서는 아직 서버에 없는 경로를 표시할 수 있다. 자동 배포 도입 후에는 병합 직후 서버도 갱신되어 이 시간차가 짧아졌다.
- 외부 컴포넌트를 페이지에 직접 삽입하면 그 컴포넌트가 전역 상태(주소, 방문 기록, `body` CSS)를 변경한다. 해당 동작을 끄는 설정이 없으면 ==iframe으로 경계를 나누는 방법==이 가장 확실했다.
- `overflow: hidden`은 "스크롤 불가"가 아니다. 스크롤되면 안 되는 틀에는 `clip`을 사용한다.

## 관련 글

- [/health 응답 시간을 막대 수로 환산하고 no-cors 요청으로 CORS 차단을 구분하는 서버 상태 표시](/memo/server-status-wifi)
- [iframe sandbox에서 allow-top-navigation을 빼 최상위 창 이동 막기](/memo/iframe-sandbox)
- [PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps)
- [PR 미리보기 origin에는 credentials 없는 CORS로 읽기만 허용하기](/memo/preview-cors-read-only)
- [CSP 출처 목록을 코드에서 생성하고 같은 CSP로 E2E 실행하기](/memo/security-headers)

[^openapi]: OpenAPI Specification은 HTTP API를 프로그래밍 언어와 무관하게 기술하는 표준 인터페이스 명세다. [OpenAPI Specification](https://swagger.io/specification/)

[^nest]: NestJS는 컨트롤러와 DTO의 데코레이터를 읽어 OpenAPI 문서를 생성하는 `@nestjs/swagger` 모듈을 제공한다. [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)

[^xfo]: `SAMEORIGIN`은 모든 상위 프레임이 문서와 같은 출처일 때만 삽입을 허용한다. 더 세밀한 제어는 CSP의 `frame-ancestors` 지시어를 사용한다. [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)

[^mpa]: Vite는 `build.rollupOptions.input`에 HTML 파일을 여러 개 지정해 페이지마다 별도 번들을 생성할 수 있다([Vite 멀티 페이지 앱](https://vite.dev/guide/build.html#multi-page-app)).

[^overflow]: `hidden`은 내용이 넘치면 스크롤바 없는 스크롤 컨테이너가 되어 `scrollTop`·`scrollTo()`·초점 이동으로 스크롤될 수 있다. `clip`은 스크롤 컨테이너가 아니며 프로그램에 의한 스크롤도 지원하지 않는다. [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)

<details>
<summary>참고 문헌</summary>

- [OpenAPI Specification](https://swagger.io/specification/)
- [NestJS: OpenAPI introduction](https://docs.nestjs.com/openapi/introduction)
- [helmet](https://helmetjs.github.io/)
- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options)
- [MDN: CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- [MDN: Origin](https://developer.mozilla.org/en-US/docs/Glossary/Origin)
- [MDN: History.replaceState()](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
- [MDN: MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [Vitest: Snapshot](https://vitest.dev/guide/snapshot.html)
- [Vite: Multi-Page App](https://vite.dev/guide/build.html#multi-page-app)
- [Scalar](https://github.com/scalar/scalar)

</details>

#MacFolio #데스크톱 #API문서
