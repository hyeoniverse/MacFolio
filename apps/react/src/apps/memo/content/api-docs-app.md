---
title: API 문서를 사이트 안의 앱으로
date: 2026-10-05
category: 개발기/MacFolio/프론트엔드
summary: 서버 메뉴의 'API 문서 열기'가 사이트 안의 앱을 연다. 서버의 Swagger를 iframe에 띄우던 첫 방법을 버리고, 코드에서 뽑은 openapi.json을 따로 된 페이지에서 Scalar로 그린다. 스냅숏 시험, 방문 기록, overflow clip 고침까지 적었다.
---

메뉴 막대의 서버 상태 메뉴에는 'API 문서 열기'가 있다. 처음에는 서버의 Swagger 화면(`/docs`)을 새 탭으로 열었는데, macOS처럼 꾸민 사이트에서 갑자기 다른 탭으로 넘어가는 게 어색했다. 그래서 API 문서도 **사이트 안의 앱**으로 열게 했다. 작업은 PR [#95](https://github.com/hyeoniverse/MacFolio/pull/95)에 들어 있고, 같은 날 방법을 한 번 갈아엎었다.

## 처음 방법: 서버의 /docs를 iframe으로

프로젝트 앱이 데모 사이트를 창 안에 띄우듯 `/docs`를 iframe에 넣으려 했다. 서버는 helmet이 붙이는 `X-Frame-Options: SAMEORIGIN`과 CSP `frame-ancestors 'self'`로 다른 주소의 iframe에 들어가는 것을 막는다. 그래서 `/docs` 아래에서만 이 둘을 풀고 사이트 주소를 허용했다.

동작은 했지만 걸리는 게 있었다.

- 서버가 꺼지면 문서도 빈 창이 된다. 서버 상태를 보여 주는 메뉴에서 여는 문서인데, 정작 서버가 아플 때는 볼 수 없다
- 서버의 보안 헤더에 예외를 하나 만들어야 한다
- 생김새가 Swagger 기본 모양이라 사이트와 어울리지 않는다

## 세 방법 비교

| 방법                                          | 서버가 꺼지면 | 서버 보안 헤더  | 사이트 주소·CSS           |
| --------------------------------------------- | ------------- | --------------- | ------------------------- |
| 서버의 `/docs`를 iframe으로 (처음)            | 빈 창         | 예외가 필요하다 | 영향 없음                 |
| openapi.json + Scalar 컴포넌트를 창 안에      | 보인다        | 그대로          | `#`과 `body` CSS가 섞인다 |
| openapi.json + 따로 된 페이지를 iframe (지금) | 보인다        | 그대로          | iframe 안에 갇힌다        |

## 지금 방법: openapi.json을 사이트에서 그린다

문서를 서버에서 받지 않고, **API 코드에서 뽑은 `openapi.json`을 사이트에 넣어 두고** 그리기로 했다.

1. API의 `createOpenApiDocument(app)`가 서버의 `/docs`와 같은 문서를 만든다
2. 단위 테스트 `openapi.test.ts`가 이 문서를 `apps/react/src/apps/apidocs/openapi.json`과 비교한다. Vitest의 `toMatchFileSnapshot`이라, 컨트롤러나 DTO를 바꾸고 파일을 다시 만들지 않으면 CI가 실패한다. 다시 만드는 명령은 `pnpm --filter @macfolio/api openapi`
3. 'API 문서' 앱이 이 파일을 Scalar로 그린다

![문서 구조](./images/api-docs-app-structure.svg 'API 코드 → 스냅숏 시험 → openapi.json → 따로 된 페이지 → iframe')

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

지금 이 파일은 3,014줄이고, 경로 61개에 메서드 85개가 들어 있다. 경로를 하나 더하는 PR은 이 파일의 바뀐 줄까지 함께 보여 주므로, 리뷰에서 "API 모양이 어떻게 바뀌었나"를 따로 찾지 않아도 된다.

문서를 만드는 데 DB는 필요 없다. `PrismaService`는 처음 쿼리할 때 연결하므로, 앱 모듈만 만들고 문서를 뽑은 뒤 닫는다. 그래서 DB 없이 도는 단위 테스트에 넣을 수 있었다.

서버의 보안 헤더 예외는 되돌렸다. 서버의 `/docs`는 그대로 두어 새 탭으로 여는 용도로 남는다.

### 직접 불러 보기

Scalar의 'Test Request'는 문서 안에서 서버로 요청을 보낸다. 이 사이트는 이미 CORS에 등록된 주소라 다른 앱과 같은 방식으로 서버를 부를 수 있다. 관리자 API는 세션 쿠키로 확인하므로 `customFetch`에서 `credentials: 'include'`를 붙였다. 요청이 Scalar의 프록시를 거치지 않고 서버로 바로 가게 프록시 주소는 두지 않았다. 사용 통계, AI 채팅, MCP, 외부 글꼴처럼 바깥으로 나가는 기능은 모두 껐다. 서버 주소(`VITE_API_URL`)가 없으면 요청 버튼만 숨기고 문서는 그대로 보여 준다.

## Scalar를 사이트에서 떼어 놓았다

처음에는 Scalar를 사이트 안의 컴포넌트로 그렸다. 화면에 띄우자마자 주소 막대가 `/#description/introduction`으로 바뀌었다. Scalar는 지금 보는 곳을 주소의 `#`에 적고, 목차를 누르면 `pushState`로 방문 기록을 쌓는다. 끄는 설정은 없었다.

이 사이트의 주소 막대는 **맨 앞 창만** 바꾼다. 여러 앱이 저마다 주소를 쓰면 서로 덮기 때문에 바꾸는 곳을 한 군데(`syncAddressBar`)로 모아 두었다. 또 Scalar의 CSS는 `body`에도 규칙을 걸고, 사이트 창의 `text-align: center`를 물려받아 글이 모두 가운데로 몰렸다.

그래서 Scalar를 **따로 된 페이지**(`api-docs.html`, Vite의 두 번째 시작점, `src/apps/apidocs/page/` 64줄)에 두고, 'API 문서' 앱은 그 페이지를 iframe으로 띄운다. 프로젝트 앱이 쓰던 iframe 틀(불러오는 중 화면, iframe을 누르면 창을 앞으로)을 `WebFrame`으로 꺼내 둘이 함께 쓴다.

- 주소의 `#`은 iframe 안의 주소만 바뀐다. 사이트 주소는 그대로다
- CSS는 그 페이지 안에만 걸린다. 무거운 Scalar(Vue 포함)도 창을 열 때만 받는다
- 같은 사이트 주소라서 문서 페이지가 사이트의 `<html data-theme>`을 지켜보고 다크 모드를 따라간다

iframe 안에서 쌓은 방문 기록은 사이트의 뒤로 가기에 섞인다. 이 사이트에서 뒤로 가기는 "사이트 밖으로"여야 해서, 문서 페이지 안에서만 `pushState`를 `replaceState`로 바꿨다.

```ts
// Scalar는 목차를 누를 때마다 pushState로 방문 기록을 쌓는다. iframe의 기록도 사이트의 뒤로 가기에 섞이므로,
history.pushState = history.replaceState.bind(history);
```

다크 모드는 문서 페이지가 부모 창의 `<html>`에 `MutationObserver`를 걸어 `data-theme`만 지켜본다. 같은 사이트 주소라 부모의 DOM을 읽을 수 있다. 문서 페이지를 따로 열면 부모가 없으니 브라우저 설정을 따른다. 화면 테스트는 목차를 눌러도 사이트 주소와 `history.length`가 그대로인지 확인한다.

![API 문서 앱](./images/api-docs-app-window.jpg '사이트 안의 창으로 연 API 문서. 목차를 눌러도 사이트 주소는 그대로다')

## 창 틀이 밀려 올라갔다

'Test Request'를 누르자 창의 제목 막대가 위로 잘렸다. 창 틀(`.container`)이 10px 스크롤되어 있었다. 창 틀은 `overflow: hidden`인데, hidden은 사용자가 스크롤할 수 없을 뿐 **코드나 브라우저는 스크롤할 수 있다**. iframe 안에서 포커스가 옮겨 가자 브라우저가 그 요소를 보이게 하려고 바깥의 창 틀까지 밀었다.

`overflow: clip`으로 바꿨다. clip은 스크롤 영역을 만들지 않아서 아무도 밀 수 없다. 모든 창이 같은 틀(`src/desktop/window/Window.css`)을 쓰므로 함께 고쳐졌다.

![hidden과 clip](./images/api-docs-app-overflow.svg 'hidden은 코드와 브라우저가 스크롤할 수 있다. clip은 스크롤 영역 자체가 없다')

## 누를 수 없는 줄이 파랗게 바뀌었다

서버 메뉴 맨 위의 'MacFolio API · 정상' 줄은 상태를 보여 주기만 한다. 그런데 공통 메뉴의 버튼 항목으로 만들어서, 마우스를 올리면 누를 수 있는 것처럼 파랗게 바뀌었다. 공통 메뉴에 **정보 줄**(`info`) 항목을 더했다. 아이콘 칸은 다른 항목과 맞춰 두되, 버튼이 아니라서 눌리지도, 강조되지도 않는다.

## Wi-Fi 아이콘

Wi-Fi 아이콘은 반원 세 개를 같은 굵기로 그린 모양이라 macOS 것과 달라 보였다. 아래의 꼭짓점은 채운 부채꼴로, 위의 두 줄은 끝이 둥근 호로 다시 그렸다. 막대 수(0~3)로 상태를 보여 주는 방식과 '연결할 수 없음'의 사선은 그대로다.

## 확인

- API 단위 시험 `apps/api/src/openapi.test.ts`: 코드와 `openapi.json`이 같은지. 컨트롤러를 고치고 파일을 다시 만들지 않으면 CI가 여기서 멈춘다.
- 화면 시험 `apps/react/e2e/server-status.spec.ts`: **'API 문서 열기'는 새 탭이 아니라 사이트 안의 'API 문서' 앱으로 열고, 거기서 서버를 직접 불러 볼 수 있다**. 목차를 눌러도 사이트 주소와 `history.length`가 그대로인지 본다. **서버 주소가 없어도 'API 문서' 앱은 문서를 보여 주고, 요청 버튼만 없다**.
- `e2e/menubar.spec.ts`의 **API 문서·프로젝트 앱(iframe 창): 새로 고침과 새 탭에서 열기**는 둘이 같은 `WebFrame`을 쓰는지 지킨다.

## 남은 것, 배운 것

- Scalar를 들이며 `pnpm-lock.yaml`이 1,272줄 늘었다. Vue까지 함께 온다. 창을 열 때만 받는 따로 된 페이지라 첫 화면 크기에는 들어가지 않지만, 의존성 감사 대상은 늘었다.
- `openapi.json`이 사이트에 들어 있으니, 서버를 배포하기 전에 머지한 문서는 아직 서버에 없는 경로를 보여 줄 수 있다. 자동 배포가 생긴 뒤로는 머지하면 곧 서버도 바뀌어서, 그 틈이 짧아졌다.
- 다른 사람의 컴포넌트를 내 페이지에 그대로 넣으면 그 컴포넌트가 전역(주소, 방문 기록, `body` CSS)을 건드린다. 끌 설정이 없으면 iframe으로 경계를 긋는 쪽이 가장 확실했다.
- `overflow: hidden`이 "스크롤 안 됨"이 아니라는 것을 이번에 알았다. 정말 밀리면 안 되는 틀에는 `clip`을 쓴다.

관련 글: [서버 상태를 Wi-Fi 아이콘으로](/memo/server-status-wifi), [iframe 샌드박스](/memo/iframe-sandbox), [프로젝트 앱](/memo/project-apps), [미리보기 주소의 CORS](/memo/preview-cors-read-only)

#MacFolio #데스크톱 #API문서
