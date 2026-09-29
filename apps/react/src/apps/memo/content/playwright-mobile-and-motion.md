---
title: Playwright로 모바일과 애니메이션까지 테스트하기
date: 2026-09-29
category: 개발기/MacFolio
summary: 휴대폰 화면을 붙이고 애니메이션을 넣자 E2E가 흔들렸다. 뷰포트 높이, 움직임 줄이기, 병렬 실행에서 배운 것.
---

좁은 화면에서 iOS 홈 화면이 보이게 만들면서, 같은 E2E를 휴대폰에서도 돌리기로 했다. 그리고 창이 열리고 닫히는 애니메이션을 넣었다. 두 가지가 겹치자 테스트가 여러 방향으로 흔들렸다.

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

## iPhone 13의 높이는 844가 아니었다

화면 아래쪽을 누르는 테스트가 계속 빗나갔다. 원인은 기기 정보에 있었다.

```ts
devices['iPhone 13'].viewport; // { width: 390, height: 664 }
devices['iPhone 13'].screen; // { width: 390, height: 844 }
```

844는 화면 전체 높이이고, 페이지가 실제로 쓰는 뷰포트는 주소창과 도구 막대를 뺀 664다. 좌표를 844 기준으로 계산하니 뷰포트 밖을 누르고 있었다. 좌표는 숫자를 외워 두지 말고 `page.viewportSize()`에서 읽는다.

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
