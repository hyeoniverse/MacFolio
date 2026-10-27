---
title: 배포 직후 메모가 안 열리던 까닭 - 옛 코드 파일과 OS 경고창
date: 2026-10-02
category: 개발 기록/MacFolio/배포·품질/배포·운영
summary: 배포 전에 열어 둔 탭에서 메모를 열면 "memo 앱에서 문제가 발생했습니다"가 표시되었다. 삭제된 옛 코드 파일을 요청하고 있었다. 다시 불러오기가 작동하지 않는 이유를 확인하고, 코드 로드 실패 오류를 구분해 새로고침을 안내하는 OS 경고창으로 바꿨다.
---

메모 앱을 열면 간헐적으로 "memo 앱에서 문제가 발생했습니다 [다시 열기]"가 표시되었다. [다시 열기]를 눌러도 같은 안내가 다시 나타났고, 페이지를 새로고침하면 정상적으로 열렸다. 항상 재현되지는 않아서 원인을 바로 특정하기 어려웠다. 하루에 여러 번 배포한 날 발생 빈도가 높았다는 점이 단서였다.

재현 절차는 다음과 같다.

1. 사이트를 열어 둔다(메모 앱은 열지 않는다).
2. 새 빌드를 배포한다.
3. 1의 탭에서 메모 앱을 처음 연다.

수정은 PR [#72](https://github.com/hyeoniverse/MacFolio/pull/72)의 커밋 하나다(8개 파일, +161/−30).

## 원인: 삭제된 옛 코드 파일

메모 앱은 Markdown 렌더러 때문에 코드가 커서 처음 여는 시각에 코드를 내려받는다([`React.lazy`](https://react.dev/reference/react/lazy)). 빌드하면 이 코드는 `Memo-DJMDZtL5.js`처럼 내용 해시가 붙은 파일이 되고, 다시 배포하면 이름이 바뀌고 옛 파일은 삭제된다.

배포 전에 열어 둔 페이지는 옛 파일 이름을 보관하고 있다. 그 페이지에서 메모를 처음 열면 삭제된 파일을 요청하다 실패하고, 앱 오류 경계(`AppErrorBoundary`)[^boundary]가 이 오류를 받아 "문제가 발생했습니다"를 표시했다. 배포가 잦은 날 발생 빈도가 높았던 이유다.

![배포 직후의 시간선](./images/app-error-alert-timeline.svg '탭은 옛 이름을 찾고, 다시 불러오기 두 가지는 모두 막혔다')

## 다시 불러오기가 작동하지 않는 이유

처음에는 실패하면 잠시 뒤 한 번 더 불러오는 방식을 시도했다. 결과는 두 방법 모두 실패였다.

| 시도                                    | 결과                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 같은 주소로 `import()` 재실행           | E2E 시험에서 첫 요청만 차단하자, 두 번째 `import()`는 네트워크 요청 없이 바로 실패했다. Chrome은 실패한 모듈 주소의 결과를 기억한다 |
| 주소에 `?retry=<시각>`을 붙여 새로 요청 | 빌드된 메모 파일은 컴포넌트를 `default`가 아닌 축약 이름(`M`)으로 내보내서, 불러온 모듈에서 컴포넌트를 찾을 수 없었다               |

배포 직후라면 옛 파일은 서버에 없으므로 다시 불러와도 내려받을 수 없다. 새로고침으로 새 `index.html`과 새 파일 이름을 받는 것이 올바른 처리라서, 다시 불러오기는 제거하고 새로고침을 안내하기로 했다.

## 코드 로드 실패 오류 구분하기

브라우저마다 오류 메시지가 다르다.

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

오류 종류(`TypeError`)로는 구분할 수 없었다. 앱 안에서 발생한 일반 `TypeError`도 같은 종류다. 메시지로 구분하는 방식은 브라우저가 문구를 바꾸면 놓칠 수 있지만, 놓쳐도 일반 오류 안내("문제가 발생했습니다")가 표시될 뿐이라 영향이 작다. `src/shared/lib/chunkLoadError.test.ts`의 두 시험(**브라우저마다 다른 코드 불러오기 실패 문구를 알아본다**, **다른 에러는 아니다**)이 세 메시지와 일반 오류를 구분하는지 확인한다.

## OS 경고창으로 변경

안내 화면도 바꿨다. 예전 안내는 화면 가운데의 흰 상자에 앱 이름을 내부 이름 그대로(memo) 표시하고 버튼은 하나였다. 이제 메모를 삭제할 때 쓰는 공통 경고창(`AlertDialog`)을 화면 전체 위에 표시한다.

![데스크톱 전후](./images/app-error-alert-desktop.jpg '전: memo 앱에서 문제가 발생했습니다 [다시 열기] / 후: 굵은 제목, 설명, [닫기]와 [새로고침] 또는 [다시 열기]')

| 경우                   | 제목                            | 설명                                         | 버튼               |
| ---------------------- | ------------------------------- | -------------------------------------------- | ------------------ |
| 코드 로드 실패         | 새 버전이 있습니다              | 메모 앱을 열려면 페이지를 새로고침해 주세요. | [닫기] [새로고침]  |
| 앱 화면 렌더링 중 오류 | 메모 앱에서 문제가 발생했습니다 | 문제가 계속되면 페이지를 새로고침해 주세요.  | [닫기] [다시 열기] |

앱 이름은 Dock에 표시되는 이름(메모)이고, 휴대폰에서는 휴대폰용 이름(터미널 대신 단축어)이다. [닫기]는 앱을 완전히 종료해서, 다음에 열면 처음부터 다시 렌더링한다. 경고창은 해당 앱이 화면에 있을 때만 표시되고, 오류가 난 앱을 최소화하거나 닫으면 함께 숨는다.

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

[다시 열기]는 오류 상태를 초기화해 앱을 다시 렌더링한다. 앱 화면의 일시적인 오류는 이것으로 해결된다. 코드 로드 실패는 다시 렌더링해도 같은 파일을 요청하므로 [새로고침]만 효과가 있다.

경고창은 앱 창 안이 아니라 화면 전체를 덮는다. 오류가 난 앱은 창 내용을 렌더링하지 못해서 그 안에 표시할 수 없기 때문이다. 쌓임 순서는 `--z-app-error: 15000`으로, 펼친 메뉴(`--z-menu`, 10000)와 전체 화면 보기(`--z-fullscreen`, 12000)보다 위, 로그인 화면(`--z-login`, 20000)보다 아래다. 이 값들은 [z-index 숫자에 이름 붙이기](/memo/z-index-layers)에서 정리한 표에 있다.

## 시험

`e2e/app-error.spec.ts`의 두 시험이 배포 직후 상황을 재현한다. Playwright의 [`page.route`](https://playwright.dev/docs/network)로 메모 코드 파일 요청을 차단한 뒤 메모를 연다.

- **새로고침을 권하고, 닫으면 사라진다**: "새 버전이 있습니다"가 표시되고 [새로고침]에 초점이 있는지, [닫기]로 경고창이 사라지는지 확인한다.
- **새로고침하면 새 코드로 연다**: 차단을 해제하고 [새로고침]을 누르면 페이지를 처음부터 다시 불러오는지(로딩 화면이 표시되는지) 확인한다.

앞에서 적은 "두 번째 `import()`는 요청도 보내지 않는다"는 사실도 같은 `page.route`로 첫 요청만 차단해 확인했다.

## 남은 것, 배운 것

- 사흘 뒤 이 경고창이 표시되는 경로를 하나 더 찾았다. 사이트가 삭제된 코드 파일 자리에 `index.html`을 200으로 응답했고, 그 응답에 1년 캐시 헤더까지 붙어 있었다([없는 코드 파일에 index.html을 주던 문제](/memo/asset-404)). 경고창은 앱이 멈추지 않게 하는 마지막 처리이고, 근본 해결은 서버가 404를 응답하는 것이었다.
- 옛 빌드 파일을 몇 번의 배포 동안 보관하면 경고창 자체가 필요 없다. 정적 자산을 통째로 교체하는 현재 배포 방식에서는 별도 보관소가 필요해서 아직 적용하지 않았다.
- 지연 로딩(`React.lazy`)을 쓰면 "나중에 내려받을 파일이 삭제될 수 있다"는 실패 경로가 함께 생긴다. 첫 화면을 가볍게 하려고 분리한 코드만큼 배포 시각과의 경합도 생긴다.

## 직접 재현하기

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

## 관련 글

- [없는 코드 파일에 index.html을 주던 문제](/memo/asset-404): 같은 증상의 서버 쪽 원인
- [모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출](/memo/ui-modal): 경고창이 쓰는 공통 컴포넌트
- [CRA에서 Vite로 옮기기](/memo/cra-to-vite)
- [z-index 숫자에 이름 붙이기 — 화면 전체의 겹침 순서를 한 표로](/memo/z-index-layers)

[^boundary]: React의 [오류 경계(error boundary)](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)는 자식 컴포넌트가 렌더링 중 던진 오류를 받아 대체 화면을 표시하는 컴포넌트다. `React.lazy`가 코드를 내려받지 못한 경우도 렌더링 오류로 전달된다.

#MacFolio #배포 #트러블슈팅
