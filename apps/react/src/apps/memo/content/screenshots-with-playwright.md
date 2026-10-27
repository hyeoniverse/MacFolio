---
title: 블로그 스크린샷을 테스트 코드로 찍기
date: 2026-10-01
category: 개발 기록/MacFolio/배포·품질/테스트·CI
summary: README와 블로그 글에 넣을 스크린샷을 수동 캡처 대신 Playwright로 생성했다. E2E의 가짜 API로 화면 상태를 구성하고, 잘린 메뉴·깨진 아바타·화면 밖 표시·지연 로딩 문제를 하나씩 해결했다. 검토한 방법과 캡처한 7장의 크기를 정리한다.
---

README를 새로 작성하고 기존 블로그 글에도 이미지를 추가하기로 했다. 필요한 화면은 다음과 같았다.

- 관리자로 로그인한 계정 화면
- 예약한 글, 수정 중인 글, 한 번도 게시하지 않은 글이 목록에 함께 표시된 화면
- 표 핸들로 열을 선택하고 메뉴를 연 상태

수동으로 캡처하려면 실제 서버에 로그인해 가짜 글을 만들고, 메뉴를 연 상태에서 캡처해야 한다. 작업 후에는 가짜 글을 삭제해야 하고, 화면이 바뀌면 처음부터 반복해야 한다. 그래서 **스크린샷도 시험처럼 코드로 생성하기로 했다.**

## 검토한 방법

| 방법                                       | 장점                                          | 단점                                                                                       |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 실제 사이트에서 수동 캡처                  | 준비 작업이 없다                              | 서버에 가짜 글을 생성·삭제해야 한다. 화면이 바뀔 때마다 반복. 메뉴를 연 상태 캡처가 어렵다 |
| 로컬 서버와 시드 DB를 실행해 캡처          | 실제 API를 거친다                             | 화면마다 DB를 채워야 하고, 예약 글처럼 시각에 의존하는 화면은 시계를 조정해야 한다         |
| E2E의 가짜 API로 화면을 구성해 캡처 (선택) | 기존 헬퍼를 재사용한다. 명령 한 번으로 재생성 | 가짜 API가 구현하지 않은 경로는 캡처할 수 없다                                             |

E2E는 이미 관리자 로그인, 글쓰기, 게시, 예약을 서버 없이 실행하고 있었다. 화면 구성 코드는 대부분 있었고, 마지막 줄만 검증 대신 캡처로 바꾸면 되었다.

## E2E의 가짜 API 재사용

E2E에는 이미 [`page.route`](https://playwright.dev/docs/api/class-page#page-route)로 만든 가짜 API(`apps/react/e2e/fakeApi.ts`)가 있다. 로그인, 글쓰기, 게시, 예약, 댓글을 서버 없이 재현한다. 쿠키 대신 시험 내부 변수로 로그인 상태를 저장하므로, 새로고침해도 상태가 유지된다.

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

- `deviceScaleFactor: 2`로 레티나 디스플레이 해상도(2배 픽셀)로 캡처한다
- E2E는 애니메이션을 비활성화한 상태(`reducedMotion: 'reduce'`)로 실행하지만, 캡처는 실제 화면과 같아야 하므로 활성화한다
- 이 파일은 저장소에 커밋하지 않았다. CI에서 실행할 필요가 없고, 생성한 이미지만 커밋한다

![캡처 한 장을 생성하는 순서](./images/screenshots-with-playwright-flow.svg '가짜 API, 데스크톱 진입, 화면 구성, 창 크기 조정, 영역 캡처')

![가짜 API로 만든 게시 상태](./images/drafts-status.jpg '예약한 글(예정), 게시하지 않은 편집(점), 새 메모(임시 저장). 서버 없이 구성한 화면이다')

## 문제와 해결

### Dock 아이콘 탐색 실패

처음에는 Dock에서 `'메모'`라는 이름의 버튼을 찾았는데 30초 시간 초과로 실패했다. 화면에는 "메모"로 표시되지만, Dock 버튼의 접근성 이름은 앱 id(`memo`, `settings`)였다. 시험 헬퍼(`dockItem(page, 'memo')`)는 이미 id로 탐색하고 있었는데, 스크린샷 코드를 새로 작성하면서 화면 문자열로 탐색한 것이 원인이었다.

### 계정 화면의 아바타 이미지 오류

로그인한 계정 화면을 캡처하자 아바타 위치에 깨진 이미지 아이콘이 표시되었다. 아바타는 `https://github.com/<계정>.png`에서 내려받는데, 캡처 환경에서는 외부 요청이 차단되어 있었다. 가짜 API와 같은 방식으로 이 주소도 가로채, 미리 내려받은 프로필 이미지를 응답하게 했다.

```ts
await page.route('https://github.com/*.png*', (route) =>
	route.fulfill({ path: 'avatar.png', contentType: 'image/png' })
);
```

### 창 밖으로 잘린 메뉴

표 핸들을 클릭해 메뉴를 연 화면을 캡처하자 메뉴 오른쪽이 잘려 있었다. 메모 창의 기본 크기(900×600)에서는 열 메뉴가 창 오른쪽 경계를 넘는다. 실제 사용 시에는 창을 키우면 되지만, 캡처에서는 잘린 메뉴가 버그로 보인다.

캡처 전에 창 크기를 키우고, 창 전체 대신 **필요한 영역만** 캡처했다.

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

### 표시해야 할 상태 표시가 목록 밖에 위치

게시 상태 캡처에는 "예약", 점, "임시 저장" 표시가 한 화면에 모두 보여야 한다. 처음에는 오래된 글(9월 28일)을 수정했는데, 그 글을 선택하는 시각에 목록이 그 글까지 스크롤되어 새 메모의 표시가 화면 밖으로 밀려났다. **목록 맨 위의 오늘 글을 수정하도록** 순서를 바꾸고, 캡처 직전에 목록을 맨 위로 스크롤했다.

### 이미지 로드 확인

캡처한 이미지를 글에 추가하고, 빌드한 사이트에서 그 글을 열어 모든 `<img>`의 [`naturalWidth`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/naturalWidth)를 읽었다. 첫 이미지만 값이 있고 나머지는 0이었다. 오류가 아니라 **지연 로딩**(`loading="lazy"`)이었다. 화면 밖 이미지는 스크롤로 뷰포트에 가까워져야 로드된다. 이미지마다 `scrollIntoViewIfNeeded()`로 로드한 뒤 다시 읽자 모두 실제 크기가 반환되었다.

### 브라우저 버전 불일치

캡처 환경에 설치된 Chromium이 Playwright가 요구하는 버전보다 오래되었다. `playwright install`로 내려받는 대신, 설정 파일을 한 단계 덮어써 기존 브라우저를 사용하게 했다.

```ts
import base from './playwright.config';
export default {
	...base,
	use: { ...base.use, launchOptions: { ...base.use?.launchOptions, executablePath: '/opt/pw-browsers/chromium' } },
};
```

기존 설정은 그대로 두고 경로만 변경하므로, 캡처 후 이 파일만 삭제하면 된다.

## 캡처 결과와 크기

9월 30일에 기존 글 4편에 추가한 캡처 7장을 한 번에 커밋했다.

![캡처 7장의 크기](./images/screenshots-with-playwright-sizes.svg '목록 전체를 캡처한 이미지가 크고, 메뉴 영역만 캡처한 이미지는 작다')

`deviceScaleFactor: 2`이므로 픽셀 수가 2배다. 게시 상태 캡처(`drafts-status.jpg`)는 2800×1640, 표 핸들은 본문 영역만 캡처해 1836×600이다. 가장 큰 파일이 236KB라 글 한 편에 여러 장을 넣어도 전송량 부담이 작다.

README의 데스크톱 화면, 로그인 전후 계정 화면, Swagger, 그리고 기존 글 4편에 넣은 표 핸들·찾기 막대·확장되는 검색 칸·Safari 탭·게시 상태·폴더 메뉴·가가 메뉴까지 모두 같은 방법으로 캡처했다.

이 방식의 장점은 세 가지다.

- **재생성이 쉽다.** 화면이 바뀌면 명령 한 번으로 다시 캡처한다
- **실제 데이터가 노출되지 않는다.** 가짜 서버의 글과 댓글만 표시된다
- **화면 구성 코드가 곧 사용 흐름이다.** 캡처 한 장을 위해 작성한 순서(글 수정 → 새 메모 → 예약)가 관리자의 실제 사용 순서와 같아, 구성 중에 어색한 동작이 보이면 그 부분이 개선 대상이다

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

휴대폰 화면은 `viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true`로 연다. 글에 넣을 때는 JPEG 품질 80, 가로 1200px 이하로 축소한다(블로그 규칙은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '블로그 글 › 이미지').

참고 문서: [Playwright 스크린샷](https://playwright.dev/docs/screenshots), [page.route로 응답 바꾸기](https://playwright.dev/docs/network#modify-responses).

## 남은 과제와 정리

- **캡처 스크립트는 저장소 밖에 있다.** CI에서 제외하려고 커밋하지 않았으므로, 같은 화면을 다시 캡처하려면 그 코드를 다시 작성해야 한다. 캡처 대상이 늘면 `e2e` 옆에 캡처 전용 폴더를 두고 CI에서만 제외하는 편이 낫다.
- **해상도는 이후 다시 높였다.** 이후 휴대폰 앱과 방문자 이름 글의 캡처는 낮은 해상도로 생성되어 글자가 흐렸다. [#71](https://github.com/hyeoniverse/MacFolio/pull/71)에서 같은 방법으로 다시 캡처해, 예를 들어 `mobile-apps-music.jpg`는 45KB에서 148KB가 되었다. 처음부터 `deviceScaleFactor: 2`를 기본값으로 지정하는 것이 낫다.
- **화면 문자열로 탐색하지 않는다.** Dock 버튼처럼 표시 문자열과 접근성 이름이 다른 요소가 있다. 시험 헬퍼의 탐색 방법을 그대로 사용하는 것이 빠르다.
- **육안 대신 값으로 확인한다.** 이미지 로드 여부는 `naturalWidth` 값으로 확인했고, 지연 로딩도 그 방법으로 발견했다.

## 관련 글

- [테스트를 붙이자 보인 버그들](/memo/bugs-found-by-tests)
- [9월 30일 - 편집기를 다듬고, 서버를 띄우고, 문서를 다시 쓰다](/memo/day-0930)
- [바로 고치는 블로그에 임시 저장과 버전 기록 붙이기](/memo/drafts-and-versions)
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)
- [글 한 편 추가했더니 E2E가 깨졌다 - 이미지 끌기 테스트가 흔들린 이유](/memo/flaky-drag-e2e)

#MacFolio #Playwright #스크린샷
