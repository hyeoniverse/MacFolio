---
title: Playwright로 모바일과 애니메이션까지 테스트하기
date: 2026-09-29
category: 개발기/MacFolio/인프라
summary: 휴대폰 화면과 창 애니메이션을 넣자 E2E가 흔들렸다. iPhone도 Chromium으로 흉내 내는 프로젝트 셋, 664px 뷰포트, 기본 움직임 줄이기와 1ms 전환의 함정, 병렬 실행의 로딩 지연을 정리했다.
---

좁은 화면에서 iOS 홈 화면이 보이게 만들면서, 같은 E2E를 휴대폰에서도 돌리기로 했다. 그리고 창이 열리고 닫히는 애니메이션을 넣었다. 두 가지가 겹치자 테스트가 여러 방향으로 흔들렸다.

## 배경

E2E는 하루 전(9월 28일)에 처음 붙였다([PR #26](https://github.com/hyeoniverse/MacFolio/pull/26)). 그때는 데스크톱 화면만 봤다. 다음 날 휴대폰 셸(iOS 홈 화면)을 붙이고([PR #33](https://github.com/hyeoniverse/MacFolio/pull/33)), 창이 Dock에서 커지며 열리는 애니메이션을 넣자 증상이 셋 나왔다.

| 증상                                             | 원인 (아래에서 하나씩)                  |
| ------------------------------------------------ | --------------------------------------- |
| 휴대폰 화면 아래쪽을 누르는 시험이 빗나간다      | iPhone 13의 뷰포트는 844가 아니라 664   |
| 창 위치를 재는 시험이 가끔 틀린 값을 읽는다      | 애니메이션 중간 값을 읽었다             |
| 혼자 돌리면 통과하는 시험이 같이 돌리면 실패한다 | 서버 하나에 브라우저가 몰려 로딩이 늦다 |

## 휴대폰도 Chromium으로

CI에는 Chromium만 설치한다. iPhone은 기기 정보만 빌려 Chromium으로 흉내 낸다.

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

Safari 엔진을 쓰는 것은 아니라서 WebKit에서만 나는 문제는 잡지 못한다. 대신 터치, 화면 크기, 레이아웃은 확인할 수 있다.

| 방법                                   | 좋은 점                                    | 문제                                                           |
| -------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| WebKit 프로젝트를 더한다               | Safari에서만 나는 문제를 잡는다            | CI에 WebKit과 의존 라이브러리를 더 깔아야 하고 시간이 늘어난다 |
| iPhone 기기 정보 + Chromium (고름)     | 설치는 그대로, 터치·크기·`isMobile`은 같다 | 엔진 차이는 못 잡는다                                          |
| 데스크톱 프로젝트에서 창 크기만 줄인다 | 프로젝트가 하나로 끝난다                   | `hasTouch`·`isMobile`이 없어 휴대폰 셸로 들어가지 않는다       |

![프로젝트 셋](./images/playwright-mobile-and-motion-projects.svg '빌드 결과 하나를 프로젝트 셋이 함께 쓴다')

![iPhone 13과 Pixel 7 크기로 띄운 홈 화면](./images/mobile-devices.jpg '같은 E2E를 두 기기 크기로 돌린다. 둘 다 Chromium이다')

## iPhone 13의 높이는 844가 아니었다

화면 아래쪽을 누르는 테스트가 계속 빗나갔다. 원인은 기기 정보에 있었다.

```ts
devices['iPhone 13'].viewport; // { width: 390, height: 664 }
devices['iPhone 13'].screen; // { width: 390, height: 844 }
```

844는 화면 전체 높이이고, 페이지가 실제로 쓰는 뷰포트는 주소창과 도구 막대를 뺀 664다. 좌표를 844 기준으로 계산하니 뷰포트 밖을 누르고 있었다. 좌표는 숫자를 외워 두지 말고 `page.viewportSize()`에서 읽는다.

![iPhone 13의 화면 높이와 뷰포트 높이](./images/viewport-844-664.svg '844는 화면 전체, 페이지가 쓰는 뷰포트는 664')

## 기본은 움직임 줄이기, 애니메이션은 따로

창 위치를 재는 테스트는 애니메이션 한가운데의 값을 읽으면 틀린다. 그래서 테스트 전체의 기본값을 움직임 줄이기로 두었다.

```ts
use: {
	// 위치·크기를 재는 테스트가 애니메이션 중간 값을 읽지 않도록
	reducedMotion: 'reduce',
},
```

애니메이션이 켜졌을 때의 동작은 `motion.spec.ts`에서만 확인한다. 이때도 시간을 기다리지 않고, 애니메이션이 끝났는지를 기다린다.

```ts
test.use({ reducedMotion: 'no-preference' });

expect(await github.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
await expect.poll(() => github.evaluate((el) => el.getAnimations().length)).toBe(0);
```

## 1ms 전환이 드래그를 망가뜨렸다

움직임 줄이기를 CSS로 처음 구현할 때는 흔히 보이는 방법을 썼다.

```css
* {
	transition-duration: 1ms !important;
}
```

그러자 창 끌기 테스트가 깨졌다. `transition-property`의 기본값이 `all`이라, 원래 전환이 없던 요소까지 모든 속성에 1ms 전환이 생겼다. 끄려던 전환을 오히려 온 페이지에 켠 셈이다. 전환과 애니메이션을 아예 없애는 쪽으로 바꿨다.

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

JS로 돌리는 애니메이션(Web Animations API)은 CSS가 막지 못하므로, 각자 이 설정을 확인해 건너뛴다.

## 병렬 실행에서만 나는 실패

테스트 90개를 프로젝트 세 개에서 병렬로 돌리자, 혼자 돌리면 통과하는 테스트가 가끔 실패했다. 로딩 화면이 10초 안에 사라지지 않은 것이다. 빌드 결과를 서버 하나가 여러 브라우저에 동시에 내주다 보니, 한꺼번에 몰릴 때 로딩이 늦어졌다.

로딩을 기다리는 곳은 `enterDesktop()` 한 곳으로 모아 두었으므로, 거기 제한만 20초로 늘렸다. 테스트마다 따로 기다렸다면 여러 파일을 고쳐야 했을 것이다.

```ts
// e2e/fixtures.ts의 enterDesktop
await expect(loading).toBeHidden({ timeout: 20_000 });
```

## 확인

- 이 설정으로 시험이 계속 늘었다. 이 글을 고치는 지금 `e2e/` 아래 spec 파일은 47개, `test(`를 부르는 곳은 434곳이다. 휴대폰 프로젝트가 도는 `mobile.spec.ts`·`mobile-motion.spec.ts`는 64개 시험이고, iPhone·Android 두 프로젝트에서 한 번씩 돈다.
- 움직임이 켜진 시험은 `mobile-motion.spec.ts`의 "모바일: 앱은 아이콘에서 커지고, 홈으로 가면 아이콘으로 줄어든 뒤 사라진다" 같은 것들이다. 시간을 기다리지 않고 `getAnimations().length`가 0이 될 때까지 기다리므로, CI 기계가 느려도 흔들리지 않는다.
- CI는 뒤에 E2E를 6칸으로 나눠 돌리게 바꿨다(`--shard=N/6`). 시험이 늘어 한 칸으로는 오래 걸렸기 때문이다.

## 남은 것·배운 것

- WebKit 엔진 차이는 여전히 잡지 못한다. 실제 iPhone Safari에서만 나는 문제는 손으로 확인한다.
- 기본값을 움직임 줄이기로 둔 대가도 있었다. 애니메이션에 걸린 버그는 이 설정 아래에서 숨는다. [음악 앱 버그 세 가지](/memo/music-player-fixes)의 "끝없이 내려가는 시트"는 고치기 전에도 시험이 통과했고, 그 시험만 움직임 줄이기를 꺼야 잡혔다.
- `* { transition-duration: 1ms }`처럼 흔히 쓰는 움직임 줄이기 코드가 오히려 전환을 온 페이지에 켤 수 있다. 값만 바꾸는 규칙은 기본값이 `all`인 속성과 만나면 뜻이 바뀐다.
- 기기 정보의 `viewport`와 `screen`은 다르다. 좌표는 숫자를 외우지 말고 `page.viewportSize()`에서 읽는다.
- 기다리는 곳을 한 함수(`enterDesktop`)로 모아 두면, 환경이 바뀌었을 때 한 줄만 고치면 된다.

## 관련 글

- [머지하고 배포까지 15분에서 5분으로](/memo/faster-e2e-ci)
- [글 한 편 추가했더니 E2E가 깨졌다](/memo/flaky-drag-e2e)
- [휴대폰 앱들을 메모처럼](/memo/mobile-apps-ios-style)

#MacFolio #테스트 #Playwright #휴대폰
