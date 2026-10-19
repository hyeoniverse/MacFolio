---
title: 배포 직후 메모가 안 열리던 까닭 - 옛 코드 파일과 OS 경고창
date: 2026-10-02
category: 개발기/MacFolio/인프라
summary: 배포 뒤 열어 둔 탭에서 메모를 열면 "memo 앱에서 문제가 발생했습니다"가 떴다. 사라진 옛 코드 파일을 찾고 있었다. 다시 불러오기가 왜 안 되는지 확인하고, 코드를 못 불러온 에러를 알아봐 새로고침을 권하는 OS 경고창으로 바꿨다.
---

메모 앱을 열 때 가끔 "memo 앱에서 문제가 발생했습니다 [다시 열기]"가 떴다. 다시 열기를 눌러도 같은 안내가 다시 나오고, 페이지를 새로고침하면 멀쩡히 열렸다. 늘 나는 것이 아니라 "가끔"이라 처음에는 원인을 짐작하기 어려웠다. 하루에 여러 번 배포한 날에 유독 자주 보였다는 것이 실마리였다.

재현은 이렇게 했다. 사이트를 열어 두고(메모는 열지 않고) 새 빌드를 배포한 뒤, 그 탭에서 메모를 처음 연다. 고친 것은 PR [#72](https://github.com/hyeoniverse/MacFolio/pull/72)의 커밋 하나다(8개 파일, 161줄 더하고 30줄 지움).

## 옛 코드 파일

메모는 Markdown 렌더러가 무거워서 처음 열 때 코드를 불러온다(`React.lazy`). 빌드하면 이 코드는 `Memo-DJMDZtL5.js`처럼 내용에 따라 이름이 붙은 파일이 되고, 다시 배포하면 이름이 바뀌고 옛 파일은 사라진다.

배포 전에 열어 둔 페이지는 옛 이름을 기억하고 있다. 그 페이지에서 메모를 처음 열면 사라진 파일을 찾다가 실패하고, 앱 에러 안내(AppErrorBoundary)가 이것을 받아 "문제가 발생했습니다"를 보여 줬다. 자주 배포한 날일수록 자주 보인 까닭이다.

![배포 직후의 시간선](./images/app-error-alert-timeline.svg '탭은 옛 이름을 찾고, 다시 불러오기 두 가지는 모두 막혔다')

## 다시 불러오면 되지 않을까

처음에는 실패하면 잠시 뒤 한 번 더 불러오려고 했다. E2E 시험에서 첫 요청만 막아 보니, 두 번째 `import()`는 요청을 보내지도 않고 바로 실패했다. Chrome은 실패한 모듈 주소를 기억해 둔다. 주소 뒤에 `?retry=`를 붙여 새로 받는 방법도 해 봤지만, 빌드된 메모 파일은 컴포넌트를 `default`가 아닌 줄인 이름(`M`)으로 내보내서 그 이름을 알 길이 없었다.

어차피 배포 직후라면 옛 파일은 서버에 없다. 다시 불러와도 못 받는다. 새로고침이 맞는 처리라서, 다시 불러오기는 빼고 새로고침을 권하기로 했다.

## 코드를 못 불러온 에러 알아보기

브라우저마다 문구가 다르다.

```ts
export const isChunkLoadError = (error: unknown) =>
	error instanceof Error &&
	/dynamically imported module|importing a module script failed|unable to preload css/i.test(error.message);
```

Chrome은 'Failed to fetch dynamically imported module', Safari는 'Importing a module script failed', Firefox는 'error loading dynamically imported module'이다. 마지막은 Vite가 CSS를 미리 못 받았을 때 내는 문구다.

에러 종류(`TypeError`)로는 가를 수 없었다. 앱 안에서 난 평범한 `TypeError`도 같은 종류다. 문구로 가르는 것은 브라우저가 문구를 바꾸면 깨질 수 있지만, 놓쳐도 "문제가 발생했습니다"로 떨어질 뿐이라 해가 작다. `src/shared/lib/chunkLoadError.test.ts`의 두 시험(**브라우저마다 다른 코드 불러오기 실패 문구를 알아본다**, **다른 에러는 아니다**)이 세 문구와 평범한 에러를 나눠 본다.

## OS 경고창으로

안내 모양도 바꿨다. 예전 안내는 화면 가운데의 흰 상자에 앱 이름을 코드 이름 그대로(memo) 쓰고 버튼 하나만 있었다. 이제 메모를 지울 때 쓰는 공통 경고창(AlertDialog)을 화면 전체 위에 띄운다.

![데스크톱 전후](./images/app-error-alert-desktop.jpg '전: memo 앱에서 문제가 발생했습니다 [다시 열기] / 후: 굵은 제목, 설명, [닫기]와 [새로고침] 또는 [다시 열기]')

- **코드를 못 불러왔을 때**: "새 버전이 있습니다 / 메모 앱을 열려면 페이지를 새로고침해 주세요." [닫기] [새로고침]
- **앱 화면에서 에러가 났을 때**: "메모 앱에서 문제가 발생했습니다 / 문제가 계속되면 페이지를 새로고침해 주세요." [닫기] [다시 열기]

앱 이름은 Dock에 보이는 이름(메모)이고, 휴대폰에서는 휴대폰 이름(터미널 대신 단축어)이다. [닫기]는 앱을 완전히 꺼서, 다음에 열면 처음부터 다시 그린다. 경고창은 앱이 화면에 있을 때만 뜬다. 에러가 난 앱을 최소화하거나 닫으면 같이 숨는다.

![휴대폰 전후](./images/app-error-alert-mobile.jpg '휴대폰에서도 같은 경고창. 전에는 좁은 상자에 글이 두 줄로 꺾였다')

갈림은 `AppErrorBoundary.tsx`의 한곳에서 정한다.

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

[다시 열기]는 에러 상태를 비워 앱을 다시 그린다. 앱 화면의 일시적인 에러라면 이것으로 풀린다. 코드를 못 불러온 경우에는 다시 그려도 같은 파일을 찾으니 [새로고침]만 의미가 있다.

경고창은 앱 창이 아니라 화면 전체를 덮는다. 에러가 난 앱은 창을 그리지 못해서 안에 띄울 곳이 없다. 알림(10000)보다 위, 로그인 화면(20000)보다 아래인 15000에 둔다.

## 시험

`e2e/app-error.spec.ts`의 두 시험이 배포 직후를 흉내 낸다. 메모 코드 파일 요청을 막고(`page.route`) 메모를 연다.

- **새로고침을 권하고, 닫으면 사라진다**: "새 버전이 있습니다"가 뜨고 [새로고침]에 초점이 있는지, [닫기]로 사라지는지.
- **새로고침하면 새 코드로 연다**: 막은 것을 풀고 [새로고침]을 누르면 페이지를 처음부터 다시 불러오는지(로딩 화면이 뜨는지).

앞에서 적은 "두 번째 `import()`는 요청도 보내지 않는다"도 같은 `page.route`로 첫 요청만 막아 보며 알았다.

## 남은 것, 배운 것

- 사흘 뒤 이 경고창이 뜨는 길을 하나 더 찾았다. 사이트가 사라진 코드 파일 자리에 `index.html`을 200으로 주고 있었고, 그 응답에 1년짜리 캐시 헤더까지 붙었다([없는 코드 파일에 index.html을 주던 문제](/memo/asset-404)). 경고창은 "어쨌든 깨지지는 않게" 하는 마지막 그물이고, 근본은 서버가 404를 주는 것이었다.
- 옛 빌드 파일을 몇 번의 배포 동안 남겨 두면 경고창조차 필요 없다. 정적 자산을 통째로 바꾸는 지금 배포 방식에서는 따로 보관할 곳이 필요해서 아직 하지 않았다.
- 지연 로딩(`React.lazy`)을 쓰면 "나중에 받을 파일이 없어질 수 있다"는 실패가 함께 온다. 첫 화면을 가볍게 하려고 나눈 코드는, 나눈 만큼 배포와의 경합도 생긴다.

## 직접 재현하기

배포 직후의 상황은 로컬에서 쉽게 만든다. 메모 코드 파일 요청을 막고 메모를 열면 된다.

```bash
cd apps/react
npx playwright test e2e/app-error.spec.ts --project=desktop-chromium
```

손으로 보려면 개발자 도구 → Network → 요청을 오른쪽 클릭 → **Block request URL**로 `Memo-*.js`를 막고 메모를 연다. "새 버전이 있습니다"와 [새로고침]이 뜨면 된다. 막은 것을 풀고 [새로고침]을 누르면 열린다.

문구로 가르는 함수의 시험은 `npx vitest run src/shared/lib/chunkLoadError.test.ts`다. 지연 로딩과 Vite가 내는 미리 불러오기 에러는 [Vite 문서의 Load Error Handling](https://vite.dev/guide/build#load-error-handling)에 설명이 있다.

관련 글: [없는 코드 파일에 index.html을 주던 문제](/memo/asset-404), [공용 경고창](/memo/ui-modal), [CRA에서 Vite로](/memo/cra-to-vite), [z-index 층](/memo/z-index-layers)

#MacFolio #배포 #트러블슈팅
