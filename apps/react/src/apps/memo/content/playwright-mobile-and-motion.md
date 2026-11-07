---
title: Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기
date: 2026-09-29
category: 개발 기록/MacFolio/테스트·보안·성능
series: E2E 시험
seriesOrder: 2
summary: 휴대폰 화면과 창 애니메이션을 추가하자 E2E 결과가 불안정해졌다. iPhone도 Chromium으로 에뮬레이션하는 프로젝트 3개, 664px 뷰포트, 기본 움직임 줄이기와 1ms 전환의 문제, 병렬 실행 시 로딩 지연을 정리했다.
---

좁은 화면에서 iOS 홈 화면을 표시하도록 만들면서, 같은 E2E를 휴대폰 화면에서도 실행하기로 했다. 같은 시기에 창이 열리고 닫히는 애니메이션도 추가했다. 두 변경이 겹치자 시험이 세 가지 원인으로 간헐적으로 실패했다. 이 글은 휴대폰 화면을 Playwright로 에뮬레이션한 방법과, 애니메이션이 있는 화면에서 시험 결과를 일정하게 만든 설정을 정리한다.

## 배경

### E2E와 Playwright

E2E(End-to-End) 시험은 실제 브라우저로 사이트를 열고 사용자처럼 클릭·입력한 뒤 화면 결과를 확인하는 시험이다. 함수 하나를 검사하는 단위 시험과 달리 빌드 결과, 라우팅, CSS, 애니메이션까지 함께 검증한다. MacFolio는 Microsoft의 [Playwright](https://playwright.dev)를 쓴다. Playwright는 Chromium·Firefox·WebKit 세 브라우저 엔진을 같은 API로 조작하고, 설정 파일의 **프로젝트(project)** 단위로 브라우저 종류와 화면 크기를 나눠 같은 시험을 여러 조건에서 실행한다.

E2E는 하루 전(9월 28일)에 처음 도입했다([PR #26](https://github.com/hyeoniverse/MacFolio/pull/26)). 그 시각에는 데스크톱 화면만 검사했다. 다음 날 휴대폰 셸(iOS 홈 화면)을 추가하고([PR #33](https://github.com/hyeoniverse/MacFolio/pull/33)), 창이 Dock에서 확대되며 열리는 애니메이션을 추가하자 세 가지 증상이 나타났다.

| 증상                                                  | 원인 (아래 절에서 각각 설명)                     |
| ----------------------------------------------------- | ------------------------------------------------ |
| 휴대폰 화면 아래쪽을 탭하는 시험이 빗나간다           | iPhone 13의 뷰포트는 844가 아니라 664            |
| 창 위치를 측정하는 시험이 간헐적으로 틀린 값을 읽는다 | 애니메이션 중간 값을 읽었다                      |
| 단독 실행은 통과하고 병렬 실행은 실패한다             | 서버 하나에 브라우저 요청이 몰려 로딩이 지연된다 |

### 기기 에뮬레이션

Playwright는 실제 휴대폰 없이 데스크톱 브라우저를 휴대폰처럼 동작시키는 기기 정보(device descriptor)를 제공한다. 기기 정보는 화면 크기와 브라우저 특성을 담은 객체이며, `devices['iPhone 13']`을 출력하면 다음 값이 나온다(Playwright 1.64 기준, user agent는 줄임).

```json
{
	"userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) …",
	"viewport": { "width": 390, "height": 664 },
	"screen": { "width": 390, "height": 844 },
	"deviceScaleFactor": 3,
	"isMobile": true,
	"hasTouch": true,
	"defaultBrowserType": "webkit"
}
```

| 값                   | 브라우저에 미치는 영향                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| `viewport`           | 페이지가 그려지는 영역의 CSS 픽셀 크기. `window.innerWidth`·`innerHeight`      |
| `screen`             | 기기 화면 전체 크기. `window.screen.width`·`height`                            |
| `deviceScaleFactor`  | CSS 픽셀 1개를 실제 화소 몇 개로 그리는지. 3이면 390px 폭을 1,170화소로 그린다 |
| `isMobile`           | `<meta name="viewport">`를 적용하고 휴대폰처럼 화면을 맞춘다                   |
| `hasTouch`           | 터치 이벤트를 지원하고 `(pointer: coarse)` 미디어 쿼리가 일치한다              |
| `defaultBrowserType` | 이 기기의 기본 엔진. iPhone은 Safari의 엔진인 WebKit                           |

## 휴대폰도 Chromium으로 에뮬레이션

CI에는 Chromium만 설치한다. iPhone은 기기 정보(뷰포트, user agent, 터치 지원)만 가져오고, `defaultBrowserType`의 WebKit 대신 `browserName: 'chromium'`으로 덮어써 Chromium에서 실행한다([Playwright 문서: Emulation](https://playwright.dev/docs/emulation)).

```ts
projects: [
	{ name: 'desktop-chromium', testIgnore: /mobile(-motion)?\.spec\.ts/ /* ... */ },
	{
		name: 'mobile-iphone',
		use: { ...devices['iPhone 13'], browserName: 'chromium' },
		testMatch: /mobile(-motion)?\.spec\.ts/,
	},
	{ name: 'mobile-android', use: { ...devices['Pixel 7'] }, testMatch: /mobile(-motion)?\.spec\.ts/ },
],
```

Safari 엔진(WebKit)을 사용하지 않으므로 ==WebKit에서만 발생하는 문제는 검출하지 못한다==. 예를 들어 Safari만 지원하지 않는 CSS 속성이나 WebKit의 스크롤 처리 차이는 이 설정에서 드러나지 않는다. 대신 터치, 화면 크기, 레이아웃은 검증할 수 있다.

| 방법                                   | 장점                                             | 단점                                                               |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| WebKit 프로젝트를 추가한다             | Safari 전용 문제를 검출한다                      | CI에 WebKit과 의존 라이브러리를 추가 설치해야 하고 시간이 늘어난다 |
| iPhone 기기 정보 + Chromium (선택)     | 설치 항목 변화 없음, 터치·크기·`isMobile`은 같다 | 엔진 차이는 검출하지 못한다                                        |
| 데스크톱 프로젝트에서 창 크기만 줄인다 | 프로젝트가 하나로 유지된다                       | `hasTouch`·`isMobile`이 없어 휴대폰 셸이 표시되지 않는다           |

![프로젝트 3개](./images/playwright-mobile-and-motion-projects.svg '빌드 결과 하나를 프로젝트 3개가 공유한다')

![iPhone 13과 Pixel 7 크기로 표시한 홈 화면](./images/mobile-devices.jpg '같은 E2E를 두 기기 크기로 실행한다. 둘 다 Chromium이다')

## iPhone 13의 높이는 844가 아니었다

화면 아래쪽을 탭하는 시험이 계속 빗나갔다. 원인은 기기 정보 값에 있었다.

```ts
devices['iPhone 13'].viewport; // { width: 390, height: 664 }
devices['iPhone 13'].screen; // { width: 390, height: 844 }
```

844는 화면 전체 높이이고, ==페이지가 실제로 사용하는 뷰포트는 주소창과 도구 막대를 제외한 664==다. 좌표를 844 기준으로 계산해 뷰포트 밖을 탭하고 있었다. 예를 들어 "화면 맨 아래에서 20px 위"를 `y = 844 - 20 = 824`로 계산하면, 페이지 영역(0~664)을 160px 벗어난 지점을 탭한다.

> [!TIP] 좌표의 기준
> 좌표는 상수로 고정하지 말고 `page.viewportSize()`에서 읽는다.

![iPhone 13의 화면 높이와 뷰포트 높이](./images/viewport-844-664.svg '844는 화면 전체, 페이지가 쓰는 뷰포트는 664')

## 기본값은 움직임 줄이기, 애니메이션은 별도 시험

### 움직임 줄이기

macOS·iOS·Windows·Android는 화면의 움직임을 줄이는 접근성 설정을 제공한다. 움직임에 어지러움을 느끼는 사용자를 위한 설정이다. 웹 페이지는 이 설정을 미디어 쿼리 `prefers-reduced-motion`[^reduced-motion]으로 확인하고, 값이 `reduce`이면 애니메이션을 생략한다. 다음은 그 형태의 예다.

```css
.window {
	animation: open 240ms ease-out;
}
@media (prefers-reduced-motion: reduce) {
	.window {
		animation: none; /* 설정을 켠 사용자에게는 창이 바로 나타난다 */
	}
}
```

### 시험의 기본값

창 위치를 측정하는 시험은 애니메이션 진행 중의 값을 읽으면 실패한다. 창이 Dock 아이콘 크기에서 원래 크기로 커지는 동안 `boundingBox()`를 호출하면, 그 시각의 중간 크기가 반환되기 때문이다. 그래서 시험 전체의 기본값을 움직임 줄이기로 지정했다. Playwright의 `reducedMotion` 옵션은 브라우저가 `prefers-reduced-motion`을 `reduce`로 보고하게 한다.

```ts
use: {
	// 위치·크기를 재는 테스트가 애니메이션 중간 값을 읽지 않도록
	reducedMotion: 'reduce',
},
```

애니메이션이 활성화된 동작은 `motion.spec.ts`에서만 검사한다. 이때도 고정 시간을 기다리지 않고, 요소의 실행 중인 애니메이션 수([`getAnimations()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations))가 0이 될 때까지 기다린다. `getAnimations()`는 CSS 애니메이션·CSS 전환·Web Animations API로 시작한 애니메이션을 모두 `Animation` 객체 배열로 반환한다.

```ts
test.use({ reducedMotion: 'no-preference' });

expect(await github.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
await expect.poll(() => github.evaluate((el) => el.getAnimations().length)).toBe(0);
```

첫 줄은 애니메이션이 실제로 시작되었는지, 둘째 줄은 끝났는지 확인한다. 고정 시간 대기와 비교하면 차이는 실행 환경의 속도가 달라질 때 드러난다.

![고정 시간 대기와 애니메이션 수 확인 비교](./images/playwright-mobile-and-motion-wait.svg '고정 시간 대기는 느린 러너에서 애니메이션 도중에 검사해 실패한다. 애니메이션 수가 0이 될 때까지 기다리면 실행 속도와 관계없이 끝난 뒤 검사한다')

## 1ms 전환으로 드래그 시험 실패

움직임 줄이기를 CSS로 처음 구현할 때는 널리 쓰이는 방법을 사용했다.

```css
* {
	transition-duration: 1ms !important;
}
```

그러자 창 드래그 시험이 실패했다. [`transition-property`](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-property)의 기본값이 `all`이므로, 원래 전환이 없던 요소에도 모든 속성에 1ms 전환이 적용되었다. 전환이 없던 요소는 `transition-duration`이 기본값 `0s`라서 전환이 일어나지 않았을 뿐, 대상 속성은 처음부터 `all`이었다. ==비활성화하려던 전환을 페이지 전체에 활성화한 결과==다. 드래그 시험은 창을 옮긴 직후 위치를 읽으므로, 위치 변경에 전환이 걸리면 읽는 시각에 따라 결과가 달라진다.

![transition-duration만 바꾼 규칙의 효과](./images/playwright-mobile-and-motion-transition-all.svg '기본값 transition-property: all과 결합해 모든 속성 변경이 1ms 전환이 되고, 드래그 시험이 전환 도중의 위치를 읽을 수 있다')

전환과 애니메이션을 완전히 제거하는 방식으로 변경했다.

| 규칙                                  | 전환이 없던 요소(`transition-property: all`, `duration: 0s`) | 창 드래그 시험 |
| ------------------------------------- | ------------------------------------------------------------ | -------------- |
| `transition-duration: 1ms !important` | 모든 속성에 1ms 전환이 생긴다                                | 실패           |
| `transition: none !important`         | 전환 없음                                                    | 통과           |

```css
@media (prefers-reduced-motion: reduce) {
	*,
	*::before,
	*::after {
		animation: none !important;
		transition: none !important;
	}
}
```

> [!NOTE] Web Animations API의 처리
> JS로 실행하는 애니메이션(Web Animations API)은 CSS로 비활성화할 수 없으므로, 각 코드에서 이 설정을 확인해 건너뛴다.

## 병렬 실행에서만 발생하는 실패

Playwright는 시험 파일을 여러 작업자(worker) 프로세스에 나눠 동시에 실행한다. 작업자마다 브라우저를 하나씩 띄우므로, 작업자가 4개면 브라우저 4개가 같은 시험 서버에 동시에 접속한다.

시험 90개를 프로젝트 3개에서 병렬로 실행하자, 단독 실행 시 통과하는 시험이 간헐적으로 실패했다. 로딩 화면이 10초 안에 사라지지 않았다. 서버 하나가 빌드 결과를 여러 브라우저에 동시에 제공하므로, ==요청이 몰리는 시각에 로딩이 지연되었다==.

로딩 대기 코드는 `enterDesktop()` 한 곳에 모여 있으므로, 그 제한 시간만 20초로 늘렸다. 시험마다 개별로 대기했다면 여러 파일을 수정해야 했을 것이다.

```ts
// e2e/fixtures.ts의 enterDesktop
await expect(loading).toBeHidden({ timeout: 20_000 });
```

## 확인

- 이 설정 위에서 시험이 계속 늘었다. 이 글을 수정한 시각 기준 `e2e/` 아래 spec 파일은 47개, `test(` 호출은 434곳이다. 휴대폰 프로젝트가 실행하는 `mobile.spec.ts`·`mobile-motion.spec.ts`는 시험 64개이고, iPhone·Android 두 프로젝트에서 각각 한 번씩 실행된다.
- 애니메이션이 활성화된 시험은 `mobile-motion.spec.ts`의 "모바일: 앱은 아이콘에서 커지고, 홈으로 가면 아이콘으로 줄어든 뒤 사라진다" 등이다. 고정 시간이 아니라 `getAnimations().length`가 0이 될 때까지 기다리므로, CI 러너가 느려도 결과가 바뀌지 않는다.
- 이후 CI는 E2E를 6개 샤드로 나눠 병렬 실행하도록 변경했다(`--shard=N/6`, [git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci)). 시험 수가 늘어 단일 실행으로는 시간이 오래 걸렸기 때문이다.

## 남은 과제와 정리

- WebKit 엔진 차이는 여전히 검출하지 못한다. 실제 iPhone Safari 전용 문제는 수동으로 확인한다.
- 기본값을 움직임 줄이기로 지정한 단점도 있다. 애니메이션 관련 버그는 이 설정에서 검출되지 않는다. [음악 앱 버그 세 가지 - 꺼진 앱, 쌓이는 표지, 끝없이 내려가는 시트](/memo/music-player-fixes)의 "끝없이 내려가는 시트"는 수정 전에도 시험이 통과했고, 그 시험에서 움직임 줄이기를 비활성화해야 검출되었다.
- `* { transition-duration: 1ms }`처럼 널리 쓰이는 움직임 줄이기 코드가 오히려 페이지 전체에 전환을 활성화할 수 있다. 값 하나만 바꾸는 규칙은 기본값이 `all`인 속성과 결합되면 의미가 바뀐다.
- 기기 정보의 `viewport`와 `screen`은 다른 값이다. 좌표는 상수로 고정하지 말고 `page.viewportSize()`에서 읽는다.
- 대기 코드를 함수 하나(`enterDesktop`)로 모아 두면, 환경이 바뀌었을 때 한 줄만 수정하면 된다.

## 직접 확인하기

프로젝트는 [apps/react/playwright.config.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/playwright.config.ts)에 3개(`desktop-chromium`, `mobile-iphone`, `mobile-android`)가 있다. 시험 서버는 `vite preview`이므로 먼저 빌드해야 한다.

```bash
cd apps/react
npx playwright install chromium          # 처음 한 번, 또는 Playwright를 올린 뒤
pnpm build
npx playwright test --project=mobile-iphone e2e/mobile.spec.ts
npx playwright test e2e/motion.spec.ts e2e/mobile-motion.spec.ts
npx playwright show-report               # 실패하면 스크린샷·trace를 본다
```

> [!WARNING] 브라우저 재설치 누락
> Playwright를 업데이트한 뒤 `npx playwright install`을 실행하지 않으면 `browserType.launch: Executable doesn't exist`로 모든 시험이 실패한다. 로컬에서 Finder 업로드 시험을 실행하다 이 오류로 두 시험이 실패한 적이 있다. 실패한 시험 하나를 상세히 확인할 때는 `npx playwright show-trace test-results/…/trace.zip`을 실행한다.

## 관련 글

- [git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci)
- [이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)
- [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)
- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)

<details>
<summary>참고 문헌</summary>

- Playwright, [Emulation](https://playwright.dev/docs/emulation)
- Playwright, [TestOptions: reducedMotion](https://playwright.dev/docs/api/class-testoptions#test-options-reduced-motion)
- Playwright, [Parallelism](https://playwright.dev/docs/test-parallel)
- Playwright, [Assertions: expect.poll](https://playwright.dev/docs/test-assertions#expectpoll)
- Playwright, [Trace viewer](https://playwright.dev/docs/trace-viewer)
- MDN, [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- MDN, [transition-property](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-property)
- MDN, [Element.getAnimations()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getAnimations)
- MDN, [Viewport concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSSOM_view/Viewport_concepts)

</details>

[^reduced-motion]: 사용자가 OS 설정에서 움직임 줄이기를 켰는지 알려 주는 미디어 쿼리. Playwright의 `reducedMotion` 옵션은 브라우저가 이 값을 `reduce`로 보고하게 한다. [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

#MacFolio #테스트 #Playwright #휴대폰
