---
title: Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기
date: 2026-10-01
category: 개발 기록/MacFolio/테스트·보안·성능
series: E2E 시험
seriesOrder: 3
summary: README와 블로그 글에 넣을 스크린샷을 수동 캡처 대신 Playwright로 생성했다. E2E의 가짜 API로 화면 상태를 구성하고, 잘린 메뉴·깨진 아바타·화면 밖 표시·지연 로딩 문제를 하나씩 해결했다. 검토한 방법과 캡처한 7장의 크기를 정리한다.
---

README를 새로 작성하고 기존 블로그 글에도 화면 캡처를 추가하기로 했다. 필요한 화면은 다음 세 가지였다.

- 관리자로 로그인한 계정 화면
- 예약한 글, 수정 중인 글, 한 번도 게시하지 않은 글이 목록에 함께 표시된 화면
- 표 핸들로 열을 선택하고 메뉴를 연 화면

수동으로 캡처하려면 실제 서버에 로그인해 가짜 글을 만들고, 메뉴를 연 상태에서 캡처해야 한다. 작업 후에는 가짜 글을 삭제해야 하고, 화면이 바뀌면 같은 과정을 처음부터 반복해야 한다. 그래서 ==스크린샷도 시험처럼 코드로 생성했다==.

## Playwright와 E2E 시험

[Playwright](https://playwright.dev/)는 Microsoft가 만든 브라우저 자동화 라이브러리다. 코드로 Chromium·Firefox·WebKit을 실행하고, 주소 이동, 클릭, 입력, 화면 캡처를 사람 대신 수행한다. 아래 코드는 사이트를 열고 버튼을 누른 뒤 화면을 PNG 파일로 저장한다.

```ts
const page = await browser.newPage();
await page.goto('http://localhost:4173/');
await page.getByRole('button', { name: 'memo' }).click();
await page.screenshot({ path: 'memo.png' });
```

E2E(End-to-End) 시험은 이런 자동화로 사용자가 실제로 하는 동작을 처음부터 끝까지 재현하고, 화면이 기대대로 바뀌는지 검증하는 시험이다. MacFolio의 E2E는 "관리자로 로그인 → 글 작성 → 게시 → 목록에 표시되는지 확인" 같은 흐름을 Playwright로 실행한다. 화면을 구성하는 코드는 스크린샷과 시험이 같고, 마지막 줄이 `expect(...)`(검증)인지 `page.screenshot(...)`(캡처)인지만 다르다.

## 검토한 방법

| 방법                                       | 장점                                          | 단점                                                                                       |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 실제 사이트에서 수동 캡처                  | 준비 작업이 없다                              | 서버에 가짜 글을 생성·삭제해야 한다. 화면이 바뀔 때마다 반복. 메뉴를 연 상태 캡처가 어렵다 |
| 로컬 서버와 시드 DB를 실행해 캡처          | 실제 API를 거친다                             | 화면마다 DB를 채워야 하고, 예약 글처럼 시각에 의존하는 화면은 시계를 조정해야 한다         |
| E2E의 가짜 API로 화면을 구성해 캡처 (채택) | 기존 헬퍼를 재사용한다. 명령 한 번으로 재생성 | 가짜 API가 구현하지 않은 경로는 캡처할 수 없다                                             |

E2E는 이미 관리자 로그인, 글쓰기, 게시, 예약을 서버 없이 실행하고 있었다. 화면 구성 코드는 대부분 있었고, 마지막 줄만 검증 대신 캡처로 바꾸면 되었다.

## E2E의 가짜 API 재사용

### page.route로 요청 가로채기

[`page.route`](https://playwright.dev/docs/api/class-page#page-route)는 페이지가 보내는 요청 중 주소 패턴에 맞는 것을 네트워크로 보내기 전에 가로채는 함수다. 처리기 안에서 `route.fulfill()`을 호출하면 서버를 거치지 않고 시험 코드가 정한 응답이 페이지에 전달된다. 예를 들어 다음 코드가 있으면, 페이지의 `fetch('http://api.test/auth/me')`는 서버 없이 `{ "login": "hyeoniverse" }`를 받는다.

```ts
await page.route('http://api.test/auth/me', (route) => route.fulfill({ status: 200, json: { login: 'hyeoniverse' } }));
```

![페이지의 요청 세 개가 page.route 처리기를 거쳐, API 주소와 GitHub 아바타는 시험 코드가 응답하고 나머지 파일은 실제 서버로 가는 흐름](./images/screenshots-with-playwright-route.svg '패턴에 맞는 요청만 가로채므로, 앱의 빌드 파일은 실제 서버에서 받고 API 응답만 시험 코드가 만든다')

### fakeApi.ts

E2E에는 이 방식으로 만든 가짜 API(`apps/react/e2e/fakeApi.ts`)가 있다. 가짜 API 주소 `http://api.test/**`로 가는 요청을 모두 가로채, 로그인, 글쓰기, 게시, 예약, 댓글을 서버 없이 재현한다. 로그인 상태는 쿠키 대신 시험 코드 안의 `state` 변수에 저장한다. 처리기가 페이지가 아니라 시험 프로세스에 있으므로, 페이지를 새로고침해도 상태가 유지된다.

```ts
// apps/react/e2e/fakeApi.ts
export async function fakeApi(
	page: Page,
	{ admin = true, signedIn = false, organization }: { admin?: boolean; signedIn?: boolean; organization?: … } = {}
): Promise<FakeApiState> {
	const state: FakeApiState = { signedIn, organization: { folders: [], posts: {}, moves: [], pins: {}, ...organization }, … };
	// page.route로 /auth/me, /posts, /memo/organization … 을 가로채 state를 읽고 쓴다
}
```

예를 들어 게시 버튼을 누르면 페이지는 `POST http://api.test/posts/<slug>/publish`를 보내고, 처리기는 `state`의 글을 게시 상태로 바꾼 뒤 응답한다. 이후의 목록 요청도 같은 `state`에서 응답을 만들므로, 화면에는 서버가 있을 때와 같은 게시 상태가 표시된다.

### 스크린샷용 시험 파일

스크린샷용 시험 파일을 하나 만들어, 시험과 같은 방식으로 화면을 구성한 뒤 검증 대신 캡처했다.

```ts
test.use({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });

test('임시 저장·게시 상태', async ({ page }) => {
	await fakeApi(page, { signedIn: true }); // 관리자로 들어온다
	const memo = await openMemo(page);
	// 게시한 글을 고치고, 새 메모를 쓰고, 다음 달로 예약한다
	// …
	await shot(page, memo, 'drafts-status.jpg');
});
```

설정 세 가지의 의미는 다음과 같다.

| 설정                             | 의미                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `viewport: { width: 1600, … }`   | 브라우저 창의 CSS 픽셀 크기                                                       |
| `deviceScaleFactor: 2`           | CSS 픽셀 1개를 화면 픽셀 2×2개로 그린다. 레티나 디스플레이와 같은 해상도          |
| `reducedMotion: 'no-preference'` | E2E는 애니메이션을 끈 상태(`'reduce'`)로 실행하지만, 캡처는 실제 화면과 같게 켠다 |

이 파일은 저장소에 커밋하지 않았다. CI에서 실행할 필요가 없고, 생성한 이미지만 커밋한다.

![캡처 한 장을 생성하는 순서](./images/screenshots-with-playwright-flow.svg '가짜 API, 데스크톱 진입, 화면 구성, 창 크기 조정, 영역 캡처')

![가짜 API로 만든 게시 상태](./images/drafts-status.jpg '예약한 글(예정), 게시하지 않은 편집(점), 새 메모(임시 저장). 서버 없이 구성한 화면이다')

### deviceScaleFactor

웹 페이지의 크기는 CSS 픽셀로 정한다. 레티나 디스플레이는 CSS 픽셀 1개를 실제 화면 픽셀 2×2개로 그리고, 브라우저는 이 비율을 [`window.devicePixelRatio`](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)로 알려 준다. Playwright의 `deviceScaleFactor`는 이 비율을 지정한다. 같은 250×84 CSS 픽셀 영역을 캡처하면 `deviceScaleFactor: 1`은 250×84 픽셀, `2`는 500×168 픽셀 이미지가 된다.

![같은 글 제목 영역을 deviceScaleFactor 1과 2로 캡처해 같은 크기로 나란히 놓은 비교. 1은 글자 가장자리가 흐리고 2는 선명하다](./images/screenshots-with-playwright-dpr.jpg '1로 캡처한 이미지는 레티나 화면에서 2배로 늘어나 글자가 흐려진다')

블로그 글은 레티나 화면에서도 읽히므로, 1로 캡처한 이미지는 브라우저가 2배로 늘려 표시해 글자 가장자리가 흐려진다.

## 문제와 해결

### Dock 아이콘 탐색 실패

처음에는 Dock에서 `'메모'`라는 이름의 버튼을 찾았는데 30초 시간 초과로 실패했다.

Playwright의 `getByRole('button', { name })`은 화면에 보이는 글자가 아니라 **접근성 이름**으로 요소를 찾는다. 접근성 이름은 스크린 리더가 사용자에게 읽어 주는 이름으로, `aria-label` 속성이 있으면 그 값이 우선한다([MDN: Accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name)). Dock 버튼은 아이콘 아래에 "메모"를 표시하지만 접근성 이름은 앱 id(`memo`, `settings`)였다. 시험 헬퍼(`dockItem(page, 'memo')`)는 이미 id로 탐색하고 있었는데, 스크린샷 코드를 새로 작성하면서 ==화면 문자열로 탐색한 것이 원인==이었다.

### 계정 화면의 아바타 이미지 오류

로그인한 계정 화면을 캡처하자 아바타 위치에 깨진 이미지 아이콘이 표시되었다. 아바타는 `https://github.com/<계정>.png`에서 내려받는데, 캡처 환경에서는 외부 요청이 차단되어 있었다. 가짜 API와 같은 방식으로 이 주소도 가로채, 미리 내려받은 프로필 이미지를 응답하게 했다.

```ts
await page.route('https://github.com/*.png*', (route) =>
	route.fulfill({ path: 'avatar.png', contentType: 'image/png' })
);
```

`route.fulfill({ path })`는 로컬 파일의 내용을 응답 몸통으로 사용한다.

### 창 밖으로 잘린 메뉴

표 핸들을 클릭해 메뉴를 연 화면을 캡처하자 메뉴 오른쪽이 잘려 있었다. 메모 창의 기본 크기(900×600)에서는 열 메뉴가 창 오른쪽 경계를 넘는다. 실제 사용 시에는 창을 키우면 되지만, ==캡처에서는 잘린 메뉴가 버그로 보인다==.

캡처 전에 창 크기를 키우고, 창 전체 대신 **필요한 영역만** 캡처했다. `locator.screenshot()`은 요소 하나의 영역만 잘라 저장한다.

```ts
await memo.evaluate((el) => {
	el.style.width = '1400px';
	el.style.height = '820px';
});
// 창 전체 대신 본문 쪽만, 아래 빈 곳은 잘라서
await shot(page, memo.locator('.memo-reader'), 'notes-table-handles.jpg', 300);
```

반대로 **확장되는 검색 칸**은 창이 좁아야 동작을 보여 줄 수 있다. 넓은 창에서는 도구 모음이 접히지 않는다. 그 캡처만 기본 크기로 생성했다.

![표 핸들](./images/notes-table-handles.jpg '창을 넓혀 메뉴 전체가 표를 가리지 않는 위치에 표시되게 캡처했다')

### 목록 밖으로 밀려난 상태 표시

게시 상태 캡처에는 "예약", 점, "임시 저장" 표시가 한 화면에 모두 보여야 한다. 처음에는 오래된 글(9월 28일)을 수정했는데, 그 글을 선택하는 시각에 목록이 그 글까지 스크롤되어 새 메모의 표시가 화면 밖으로 밀려났다. **목록 맨 위의 오늘 글을 수정하도록** 순서를 바꾸고, 캡처 직전에 목록을 맨 위로 스크롤했다.

### 이미지 로드 확인과 지연 로딩

캡처한 이미지를 글에 추가하고, 빌드한 사이트에서 그 글을 열어 모든 `<img>`의 [`naturalWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)를 읽었다. `naturalWidth`는 이미지 파일의 실제 가로 픽셀 수이고, 파일을 받지 못했거나 아직 받지 않았으면 0이다. 첫 이미지만 값이 있고 나머지는 0이었다.

오류가 아니라 **지연 로딩**이었다. `<img loading="lazy">`는 브라우저에게 "이 이미지는 화면에 가까워질 때 내려받아도 된다"고 알리는 속성이다([MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)). 글이 길면 첫 화면에 보이지 않는 이미지까지 미리 받을 필요가 없어 첫 로딩이 빨라진다. 대신 ==화면 밖 이미지는 스크롤로 뷰포트에 가까워져야 요청된다==.

![loading=lazy 이미지는 뷰포트 안의 첫 이미지만 naturalWidth가 0보다 크고, 아래 이미지는 0이며, 이미지마다 scrollIntoViewIfNeeded로 화면에 가져오면 모두 0보다 커지는 비교](./images/screenshots-with-playwright-lazy.svg '0은 깨진 이미지가 아니라 아직 요청하지 않은 상태라서, 판정 전에 화면에 가져와야 한다')

이미지마다 `scrollIntoViewIfNeeded()`로 화면에 가져온 뒤 다시 읽자 모두 실제 폭이 반환되었다. 같은 확인을 Playwright 코드로 쓰면 다음과 같다.

```ts
for (const img of await page.locator('.memo-markdown img').all()) {
	await img.scrollIntoViewIfNeeded();
	await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
}
```

### 브라우저 버전 불일치

캡처 환경에 설치된 Chromium이 Playwright가 요구하는 버전보다 오래되었다. Playwright는 버전마다 함께 시험한 브라우저 빌드를 지정하고, 기본적으로 `playwright install`로 그 빌드를 내려받아 사용한다. 내려받는 대신 설정 파일을 한 단계 덮어써 기존 브라우저를 사용하게 했다.

```ts
import base from './playwright.config';
export default {
	...base,
	use: { ...base.use, launchOptions: { ...base.use?.launchOptions, executablePath: '/opt/pw-browsers/chromium' } },
};
```

> [!TIP] 덮어쓴 설정 파일만 삭제하면 원래대로 돌아간다
> 기존 `playwright.config.ts`는 그대로 두고 실행 파일 경로만 변경하므로, 캡처 후 덮어쓴 파일만 삭제하면 된다.

## 캡처 결과와 크기

9월 30일에 기존 글 4편에 추가한 캡처 7장을 한 번에 커밋했다.

![캡처 7장의 크기](./images/screenshots-with-playwright-sizes.svg '목록 전체를 캡처한 이미지가 크고, 메뉴 영역만 캡처한 이미지는 작다')

`deviceScaleFactor: 2`이므로 픽셀 수는 CSS 크기의 2배다.

| 파일                      | 캡처 영역    | 이미지 크기 (픽셀) |
| ------------------------- | ------------ | -----------------: |
| `drafts-status.jpg`       | 메모 창 전체 |        2800 × 1640 |
| `notes-table-handles.jpg` | 본문 영역만  |         1836 × 600 |

==가장 큰 파일이 236KB==라 글 한 편에 여러 장을 넣어도 전송량 부담이 작다.

README의 데스크톱 화면, 로그인 전후 계정 화면, Swagger, 그리고 기존 글 4편에 넣은 표 핸들·찾기 막대·확장되는 검색 칸·Safari 탭·게시 상태·폴더 메뉴·가가 메뉴까지 모두 같은 방법으로 캡처했다. 이 방식의 장점은 세 가지다.

- **재생성이 쉽다.** 화면이 바뀌면 명령 한 번으로 다시 캡처한다.
- **실제 데이터가 노출되지 않는다.** 가짜 서버의 글과 댓글만 표시된다.
- **화면 구성 코드가 사용 흐름과 같다.** 캡처 한 장을 위해 작성한 순서(글 수정 → 새 메모 → 예약)가 관리자의 실제 사용 순서와 같아, 구성 중에 어색한 동작이 보이면 그 부분이 개선 대상이다.

## 적용 방법

스크린샷도 E2E와 같은 가짜 API([apps/react/e2e/fakeApi.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/e2e/fakeApi.ts))를 사용하므로 서버 없이 캡처된다. 기본 흐름은 다음과 같다.

```bash
cd apps/react
pnpm build
npx vite preview --port 4380 &           # 빌드 결과를 띄운다
node shot.mjs                            # 아래처럼 쓴 스크립트
```

```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:4380/');
await page.mouse.click(720, 450); // 로딩 화면을 한 번 눌러야 데스크톱이 나온다 (e2e/fixtures.ts의 enterDesktop)
await page.screenshot({ path: 'shot.png' });
await browser.close();
```

> [!TIP] 휴대폰 화면과 글 이미지 규격
> 휴대폰 화면은 `viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true`로 연다. 글에 넣을 때는 JPEG 품질 80, 가로 1200px 이하로 축소한다(블로그 규칙은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '블로그 글 › 이미지').

## 남은 과제

- **캡처 스크립트는 저장소 밖에 있다.** CI에서 제외하려고 커밋하지 않았으므로, 같은 화면을 다시 캡처하려면 그 코드를 다시 작성해야 한다. 캡처 대상이 늘면 `e2e` 옆에 캡처 전용 폴더를 두고 CI에서만 제외하는 편이 낫다.
- **해상도는 이후 다시 높였다.** 이후 휴대폰 앱과 방문자 이름 글의 캡처는 낮은 해상도로 생성되어 글자가 흐렸다. [#71](https://github.com/hyeoniverse/MacFolio/pull/71)에서 같은 방법으로 다시 캡처해, 예를 들어 `mobile-apps-music.jpg`는 45KB에서 148KB가 되었다. 처음부터 `deviceScaleFactor: 2`를 기본값으로 지정하는 편이 낫다.
- **화면 문자열로 탐색하지 않는다.** Dock 버튼처럼 표시 문자열과 접근성 이름이 다른 요소가 있다. 시험 헬퍼의 탐색 방법을 그대로 사용하는 편이 빠르다.
- **육안 대신 값으로 확인한다.** 이미지 로드 여부는 `naturalWidth` 값으로 확인했고, 지연 로딩도 그 방법으로 발견했다.

## 관련 글

- [리팩터링 전 E2E 시험 10개로 찾은 hook 순서·클로저·ICU 버그](/memo/bugs-found-by-tests)
- [9월 30일 - 편집기 개선, API 서버 배포, 커밋 규칙 검사](/memo/day-0930)
- [게시본과 임시본을 한 행에 담고 CHECK 제약으로 지키는 Post 테이블](/memo/drafts-and-versions)
- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)

<details>
<summary>참고 문헌</summary>

- [Playwright: Screenshots](https://playwright.dev/docs/screenshots)
- [Playwright: Network, Modify responses](https://playwright.dev/docs/network#modify-responses)
- [Playwright: page.route](https://playwright.dev/docs/api/class-page#page-route)
- [Playwright: Emulation (viewport, deviceScaleFactor)](https://playwright.dev/docs/emulation)
- [Playwright: Locators, getByRole](https://playwright.dev/docs/locators#locate-by-role)
- [MDN: Window.devicePixelRatio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
- [MDN: Accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name)
- [MDN: Lazy loading](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Lazy_loading)
- [MDN: HTMLImageElement.naturalWidth](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)

</details>

#MacFolio #Playwright #스크린샷
