---
title: 삭제된 옛 코드 파일을 요청하는 React.lazy 로드 실패 구분하기
date: 2026-10-02
category: 개발 기록/MacFolio/배포·운영
summary: 배포 전에 열어 둔 탭에서 메모를 열면 "memo 앱에서 문제가 발생했습니다"가 표시되었다. 삭제된 옛 코드 파일을 요청하고 있었다. 다시 불러오기가 작동하지 않는 이유를 확인하고, 코드 로드 실패 오류를 구분해 새로고침을 안내하는 OS 경고창으로 바꿨다.
---

| 증상                                                            | 원인                                                         | 해결                                                  | 영향 범위                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------- |
| 메모를 열면 "문제가 발생했습니다", [다시 열기]도 같은 안내 반복 | 배포 전에 열어 둔 탭이 배포로 삭제된 옛 코드 파일을 요청한다 | 코드 로드 실패를 메시지로 구분해 새로고침 경고창 표시 | 배포 전에 열어 둔 탭에서 메모를 처음 여는 경우 |

## 배경

웹 페이지의 자바스크립트는 처음 접속하는 시각에 한꺼번에 내려받을 수도 있고, 필요해진 시각에 나눠 내려받을 수도 있다. 뒤의 방식을 코드 분할(code splitting)이라고 하고, React에서는 [`React.lazy`](https://react.dev/reference/react/lazy)로 컴포넌트 하나를 별도 파일로 분리한다. 이 사이트의 메모 앱은 Markdown 렌더러와 편집기 때문에 코드가 커서, 첫 화면에는 포함하지 않고 메모를 처음 여는 시각에 내려받는다.

```tsx
// src/apps/registry.ts. 메모를 처음 열기 전에는 이 파일을 요청하지 않는다
const Memo = lazy(() => import('@/apps/memo/Memo'));
```

빌드하면 분리된 코드는 `Memo-DJMDZtL5.js`처럼 내용 해시가 붙은 파일이 된다. 해시는 파일 내용으로 계산한 짧은 문자열이라, 메모 코드가 한 글자라도 바뀌면 이름도 바뀐다. 이 이름은 첫 화면 코드(`main-….js`) 안에 문자열로 기록된다. ==페이지를 연 시각의 첫 화면 코드는, 그 시각 빌드의 메모 파일 이름만 알고 있다.== 배포로 그 이름의 파일이 서버에서 삭제되면, 열려 있던 페이지는 메모 코드를 내려받을 수 없다.

## 증상

메모 앱을 열면 간헐적으로 "memo 앱에서 문제가 발생했습니다 [다시 열기]"가 표시되었다. [다시 열기]를 눌러도 같은 안내가 다시 나타났고, 페이지를 새로고침하면 정상적으로 열렸다. 항상 재현되지는 않아서 원인을 바로 특정하기 어려웠다.

재현 절차는 다음과 같다.

1. 사이트를 연 상태로 유지한다(메모 앱은 열지 않는다).
2. 새 빌드를 배포한다.
3. 1의 탭에서 메모 앱을 처음 연다.

## 원인 추적

하루에 여러 번 배포한 날 발생 빈도가 높았다는 점이 단서였다. 배포 횟수와 발생 빈도가 함께 증가한다면, 오류는 "배포 전에 연 페이지"와 "배포 뒤의 서버" 사이의 차이에서 생긴다. 그래서 위 재현 절차를 그대로 실행하고 개발자 도구의 Network 패널에서 메모 코드 파일 요청을 확인했다. 요청한 파일 이름은 배포 전 빌드의 이름이었고, 서버에는 그 파일이 없었다.

## 원인

배포하면 메모 코드 파일 이름이 바뀌고 옛 파일은 삭제된다. ==배포 전에 열어 둔 페이지는 옛 파일 이름을 보관==하고 있으므로, 그 페이지에서 메모를 처음 열면 삭제된 파일을 요청하다 실패한다. `React.lazy`는 이 실패를 렌더링 오류로 바꿔 전달하고, 앱 오류 경계(`AppErrorBoundary`)[^boundary]가 받아 "문제가 발생했습니다"를 표시했다. 배포가 잦은 날 발생 빈도가 높았던 이유다.

![열린 탭은 옛 빌드의 Memo-DJMDZtL5.js 이름을 보관하고, 배포 후 서버에는 새 해시 파일만 있어 import()가 실패하며, 새로고침해야 새 이름을 받는 구조](./images/app-error-alert-hash-names.svg '열린 탭이 아는 이름과 서버에 있는 파일. 새로고침해야 새 이름을 받는다')

시간 순서로 보면 다음과 같다.

![배포 직후의 시간선](./images/app-error-alert-timeline.svg '탭은 옛 이름을 찾고, 다시 불러오기 두 가지는 모두 막혔다')

## 해결

수정은 PR [#72](https://github.com/hyeoniverse/MacFolio/pull/72)의 커밋 하나다(8개 파일, +161/−30).

### 다시 불러오기가 작동하지 않는 이유

처음에는 실패하면 잠시 뒤 한 번 더 불러오는 방식을 시도했다. 결과는 두 방법 모두 실패였다.

| 시도                                    | 결과                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 같은 주소로 `import()` 재실행           | E2E 시험에서 첫 요청만 차단하자, 두 번째 `import()`는 네트워크 요청 없이 바로 실패했다. Chrome은 실패한 모듈 주소의 결과를 기억한다 |
| 주소에 `?retry=<시각>`을 붙여 새로 요청 | 빌드된 메모 파일은 컴포넌트를 `default`가 아닌 축약 이름(`M`)으로 내보내서, 불러온 모듈에서 컴포넌트를 찾을 수 없었다               |

첫 번째 결과는 모듈 시스템의 규칙과 관련 있다. 브라우저는 모듈을 주소 단위로 한 번만 가져오고 결과를 모듈 맵에 기록한다[^module-map]. 같은 주소의 `import()`를 다시 실행하면 기록된 실패 결과가 그대로 반환된다. 두 번째 방식은 주소를 바꿔 이 기록을 피했지만, 빌드 도구가 파일 사이의 연결에 쓰는 축약 내보내기 이름까지 맞춰야 해서 채택하지 않았다.

> [!IMPORTANT] 다시 불러오기 대신 새로고침
> 배포 직후라면 옛 파일은 서버에 없으므로 다시 불러와도 내려받을 수 없다. 새로고침으로 새 `index.html`과 새 파일 이름을 받는 것이 올바른 처리라서, 다시 불러오기는 제거하고 새로고침을 안내하기로 했다.

### 코드 로드 실패 오류 구분하기

새로고침을 안내하려면 "코드 파일을 받지 못한 오류"와 "앱 코드가 렌더링 중 던진 오류"를 구분해야 한다. 두 오류는 모두 `TypeError`라서 종류로는 구분할 수 없고, 메시지는 브라우저마다 다르다.

```ts
// src/shared/lib/chunkLoadError.ts
export const isChunkLoadError = (error: unknown) =>
	error instanceof Error &&
	/dynamically imported module|importing a module script failed|unable to preload css/i.test(error.message);
```

| 브라우저·도구 | 오류 메시지                                       |
| ------------- | ------------------------------------------------- |
| Chrome        | `Failed to fetch dynamically imported module`     |
| Safari        | `Importing a module script failed`                |
| Firefox       | `error loading dynamically imported module`       |
| Vite          | `Unable to preload CSS` (CSS 사전 로드 실패 시각) |

예를 들어 메모 화면이 `undefined`의 속성을 읽다 던진 `TypeError: Cannot read properties of undefined`는 위 정규식에 걸리지 않아 일반 오류로 분류된다. 메시지로 구분하는 방식은 브라우저가 문구를 바꾸면 놓칠 수 있지만, ==놓쳐도 일반 오류 안내("문제가 발생했습니다")가 표시될 뿐이라 영향이 작다.==

### OS 경고창으로 변경

안내 화면도 바꿨다. 예전 안내는 화면 가운데의 흰 상자에 앱 이름을 내부 이름 그대로(memo) 표시하고 버튼은 하나였다. 이제 메모 삭제 확인에 쓰는 공통 경고창(`AlertDialog`)을 화면 전체 위에 표시한다.

![데스크톱 전후](./images/app-error-alert-desktop.jpg '전: memo 앱에서 문제가 발생했습니다 [다시 열기] / 후: 굵은 제목, 설명, [닫기]와 [새로고침] 또는 [다시 열기]')

| 경우                   | 제목                            | 설명                                         | 버튼               |
| ---------------------- | ------------------------------- | -------------------------------------------- | ------------------ |
| 코드 로드 실패         | 새 버전이 있습니다              | 메모 앱을 열려면 페이지를 새로고침해 주세요. | [닫기] [새로고침]  |
| 앱 화면 렌더링 중 오류 | 메모 앱에서 문제가 발생했습니다 | 문제가 계속되면 페이지를 새로고침해 주세요.  | [닫기] [다시 열기] |

앱 이름은 Dock에 표시되는 이름(메모)이고, 휴대폰에서는 휴대폰용 이름(터미널 대신 단축어)이다. [닫기]는 앱을 완전히 종료해서, 다음에 열면 처음부터 다시 렌더링한다. 경고창은 해당 앱이 화면에 있는 동안만 표시되고, 오류가 난 앱을 최소화하거나 닫으면 함께 숨는다.

![휴대폰 전후](./images/app-error-alert-mobile.jpg '휴대폰에서도 같은 경고창. 전에는 좁은 상자에 글이 두 줄로 꺾였다')

분기는 `src/desktop/window/AppErrorBoundary.tsx` 한 곳에서 정한다.

```tsx
const chunk = isChunkLoadError(error);
<AlertDialog
	title={chunk ? '새 버전이 있습니다' : `${label} 앱에서 문제가 발생했습니다`}
	cancelLabel="닫기"
	confirmLabel={chunk ? '새로고침' : '다시 열기'}
	onCancel={() => quitApp(appName)}
	onConfirm={chunk ? () => window.location.reload() : onRetry}
/>;
```

![React.lazy의 import() 실패가 AppErrorBoundary로 전달되고, isChunkLoadError 결과에 따라 새로고침 경고창 또는 다시 열기 경고창으로 갈리는 흐름](./images/app-error-alert-boundary.svg '오류가 경고창이 되기까지. 버튼의 동작은 오류 종류에 따라 다르다')

[다시 열기]는 오류 상태를 초기화해 앱을 다시 렌더링한다. 앱 화면의 일시적인 오류는 이것으로 해결된다. 코드 로드 실패는 다시 렌더링해도 같은 파일을 요청하므로 [새로고침]만 효과가 있다.

경고창은 앱 창 안이 아니라 화면 전체를 덮는다. 오류가 난 앱은 창 내용을 렌더링하지 못해서 그 안에 표시할 수 없기 때문이다. 쌓임 순서는 `--z-app-error: 15000`으로, 펼친 메뉴(`--z-menu`, 10000)와 전체 화면 보기(`--z-fullscreen`, 12000)보다 위, 로그인 화면(`--z-login`, 20000)보다 아래다. 이 값들은 [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231)에서 정리한 표에 있다.

![z-index 층: 앱 창 위에 펼친 메뉴 10000, 전체 화면 보기 12000, 앱 오류 경고창 15000, 로그인 화면 20000](./images/app-error-alert-zindex.svg '경고창이 놓이는 층. 값이 큰 요소가 위에 그려진다')

## 확인

`e2e/app-error.spec.ts`의 두 시험이 배포 직후 상황을 재현한다. Playwright의 [`page.route`](https://playwright.dev/docs/network)로 메모 코드 파일 요청을 차단한 뒤 메모를 연다. `page.route`는 브라우저의 네트워크 요청을 가로채 차단하거나 다른 응답으로 바꾸는 기능이라, 서버에서 파일을 실제로 삭제하지 않고도 "파일이 없는 상태"를 만들 수 있다.

- **새로고침을 권하고, 닫으면 사라진다**: "새 버전이 있습니다"가 표시되고 [새로고침]에 초점이 있는지, [닫기]로 경고창이 사라지는지 확인한다.
- **새로고침하면 새 코드로 연다**: 차단을 해제하고 [새로고침]을 누르면 페이지를 처음부터 다시 불러오는지(로딩 화면이 표시되는지) 확인한다.

앞에서 적은 "두 번째 `import()`는 요청도 보내지 않는다"는 사실도 같은 `page.route`로 첫 요청만 차단해 확인했다.

`src/shared/lib/chunkLoadError.test.ts`의 두 시험(**브라우저마다 다른 코드 불러오기 실패 문구를 알아본다**, **다른 에러는 아니다**)이 세 메시지와 일반 오류를 구분하는지 확인한다.

### 직접 재현하기

배포 직후 상황은 로컬에서 메모 코드 파일 요청을 차단하는 방식으로 재현한다.

```bash
cd apps/react
npx playwright test e2e/app-error.spec.ts --project=desktop-chromium
```

브라우저에서 직접 확인하려면 다음 순서를 따른다([Chrome DevTools Network 패널](https://developer.chrome.com/docs/devtools/network/reference/)).

1. 개발자 도구 → Network 패널을 연다.
2. `Memo-*.js` 요청을 오른쪽 클릭 → **Block request URL**로 차단한다.
3. 메모를 연다. "새 버전이 있습니다"와 [새로고침]이 표시되면 재현된 것이다.
4. 차단을 해제하고 [새로고침]을 누르면 메모가 열린다.

메시지 구분 함수의 시험은 `npx vitest run src/shared/lib/chunkLoadError.test.ts`로 실행한다. 지연 로딩과 Vite의 사전 로드 오류는 [Vite 문서의 Load Error Handling](https://vite.dev/guide/build#load-error-handling)에 설명되어 있다.

## 재발 방지

- `e2e/app-error.spec.ts`가 코드 파일 차단 상황에서 새로고침 경고창이 표시되는지 매 CI에서 확인한다.
- `chunkLoadError.test.ts`가 세 브라우저의 메시지와 일반 오류의 구분을 고정한다. 브라우저 문구가 바뀌면 이 표와 정규식을 함께 수정한다.

> [!NOTE] 같은 증상의 서버 쪽 원인
> 사흘 뒤 이 경고창이 표시되는 경로를 하나 더 찾았다. 사이트가 삭제된 코드 파일 자리에 `index.html`을 200으로 응답했고, 그 응답에 1년 캐시 헤더까지 붙어 있었다([not_found_handling 뒤 Worker 함수로 SPA 주소와 없는 자산의 404 나누기](/memo/asset-404)). 경고창은 앱이 멈추지 않게 하는 마지막 처리이고, 근본 해결은 서버가 404를 응답하는 것이었다.

남은 사항은 두 가지다.

- 옛 빌드 파일을 몇 번의 배포 동안 보관하면 경고창 자체가 필요 없다. 정적 자산을 통째로 교체하는 현재 배포 방식에서는 별도 보관소가 필요해서 아직 적용하지 않았다.
- 지연 로딩(`React.lazy`)을 쓰면 "나중에 내려받을 파일이 삭제될 수 있다"는 실패 경로가 함께 생긴다. 첫 화면을 가볍게 하려고 분리한 코드가 많을수록, 배포 시각과 겹쳐 실패할 수 있는 요청도 많아진다.

## 관련 글

- [not_found_handling 뒤 Worker 함수로 SPA 주소와 없는 자산의 404 나누기](/memo/asset-404): 같은 증상의 서버 쪽 원인
- [오버레이·포커스·Esc 처리를 공통 Modal 컴포넌트로 추출하기](/memo/ui-modal): 경고창이 쓰는 공통 컴포넌트
- [CRA에서 Vite로 옮기기](/memo/cra-to-vite)
- [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/design-tokens#z-index-층-흩어진-숫자를---z--변수로-모으기-231)

[^boundary]: React의 [오류 경계(error boundary)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)는 자식 컴포넌트가 렌더링 중 던진 오류를 받아 대체 화면을 표시하는 컴포넌트다. `React.lazy`가 코드를 내려받지 못한 경우도 렌더링 오류로 전달된다. 이 사이트는 앱마다 경계를 하나씩 배치해, 한 앱의 오류가 바탕화면 전체를 멈추지 않게 한다.

[^module-map]: HTML 표준은 문서마다 모듈 맵(module map)을 두고, 주소별로 가져온 모듈 스크립트(또는 실패 결과)를 기록한다. 같은 주소를 다시 가져오면 네트워크 요청 없이 기록된 값을 사용한다.

<details>
<summary>참고 문헌</summary>

- React, [lazy](https://react.dev/reference/react/lazy)
- React, [Catching rendering errors with an error boundary](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- WHATWG, [HTML Standard: module map](https://html.spec.whatwg.org/multipage/webappapis.html#module-map)
- MDN, [import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- Vite, [Building for Production: Load Error Handling](https://vite.dev/guide/build#load-error-handling)
- Playwright, [Network](https://playwright.dev/docs/network)

</details>

#MacFolio #배포 #트러블슈팅
