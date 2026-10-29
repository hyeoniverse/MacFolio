---
title: macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점
date: 2026-10-22
category: 기술 노트/프론트엔드
summary: macOS Safari에서 정상으로 보인 화면이 iOS Safari에서는 다르게 렌더링될 수 있다. 렌더링 엔진과 운영체제의 관계, macOS와 iOS WebKit의 합성 방식 차이, Chrome·Safari·Firefox의 차이, 기기 에뮬레이션 테스트가 놓치는 부분을 정리하고, 자주 생기는 문제를 도식과 코드로 비교했다.
---

macOS Safari에서 확인한 화면이 iOS Safari에서도 같게 보인다는 보장은 없다. 두 브라우저는 같은 WebKit 엔진을 쓰지만, 같은 CSS를 다르게 렌더링하는 경우가 있다. 반대로 iOS의 Chrome은 이름은 Chrome이어도 렌더링은 WebKit이 한다. 이 글에서는 브라우저와 운영체제에 따라 렌더링 결과가 달라지는 지점과 그 대응 방법을 정리한다. 실제로 겪은 사례는 [위젯 2 - iOS Safari의 filter 합성 레이어에서 빠지는 border-radius 클리핑과 clip-path](/memo/music-widget-ios-corners)에 따로 적었다.

<details id="terms">
<summary>먼저 알아 둘 용어</summary>

| 용어                            | 뜻                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 렌더링 엔진                     | HTML·CSS·JS를 해석해 화면을 렌더링하는 부분. Chrome은 Blink, Firefox는 Gecko, Safari는 WebKit을 쓴다                      |
| 합성 레이어 (compositing layer) | 브라우저가 페이지의 일부를 분리해 렌더링한 단위. `transform`, `filter`, 동영상처럼 GPU 처리가 필요한 요소가 주로 분리된다 |
| 합성 (compositing)              | 분리해 렌더링한 레이어를 GPU에서 한 화면으로 합치는 과정. macOS와 iOS는 Core Animation이 담당한다                         |
| 뷰포트                          | 페이지가 표시되는 영역. 모바일에서는 주소 표시줄과 화면 키보드에 따라 크기가 바뀐다                                       |
| 기기 에뮬레이션                 | 데스크톱 브라우저가 모바일의 화면 크기, 터치 입력, User-Agent를 모사하는 기능. 렌더링 엔진은 바뀌지 않는다                |

</details>

## 브라우저보다 렌더링 엔진과 운영체제를 봐야 한다

![브라우저와 운영체제별 렌더링 엔진](./images/safari-macos-ios-rendering-engines.svg 'iOS에서는 Chrome과 Firefox도 WebKit으로 렌더링한다')

App Store 심사 지침은 iOS·iPadOS에서 웹 페이지를 보여 주는 앱에 WebKit 사용을 요구한다. 따라서 iOS의 Chrome, Firefox, Edge는 모두 Safari와 같은 WebKit으로 렌더링한다. EU(iOS 17.4 이상)와 일본에서는 다른 엔진을 쓸 수 있는 권한이 생겼지만, 그 밖의 지역에서는 여전히 WebKit만 쓸 수 있다. iOS에서만 생기는 렌더링 문제는 Safari 하나의 문제가 아니라 iOS WebKit의 문제이고, iOS Chrome에서도 똑같이 재현된다.

반대로 같은 이름의 브라우저라도 운영체제가 다르면 엔진이 다를 수 있다. Windows와 Android의 Chrome은 Blink를 쓰지만, iOS의 Chrome은 WebKit을 쓴다.

## 같은 WebKit이라도 macOS와 iOS는 다르다

렌더링 엔진이 같아도 레이어를 합성하는 방식과 기기의 제약이 다르다.

| 항목                   | macOS Safari                                                           | iOS Safari                                                                                    |
| ---------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 하드웨어               | 메모리와 GPU 자원에 여유가 있다                                        | 메모리가 제한적이어서 레이어를 적게 만들고, 큰 레이어는 타일 단위로 나눠 렌더링한다           |
| 레이어 분리            | 효과가 걸린 요소도 부모와 같은 레이어에서 렌더링하는 경우가 많다       | `filter`, `backdrop-filter`, `transform`, 동영상이 별도 레이어로 분리되기 쉽다                |
| `border-radius` 클리핑 | 부모의 `overflow: hidden` + `border-radius`가 대체로 자식까지 적용된다 | 별도 레이어로 분리된 자식에는 둥근 클리핑이 적용되지 않아 사각형으로 남는 경우가 있다         |
| 뷰포트 높이            | 창 크기가 그대로 뷰포트가 된다                                         | 주소 표시줄이 접히고 펼쳐지면서 높이가 바뀐다. 카메라 영역과 홈 표시줄이 화면 일부를 가린다   |
| 화면 키보드            | 없다                                                                   | 키보드가 화면을 덮는다. 레이아웃 뷰포트는 그대로이고, 보이는 영역(visual viewport)만 줄어든다 |
| 입력                   | 마우스. `:hover`가 의도대로 동작한다                                   | 터치. 탭한 뒤에도 `:hover` 상태가 남는다. 16px 미만 입력 칸에 포커스가 가면 화면이 확대된다   |
| 미디어 재생            | 사용자 동작 없이는 소리를 재생할 수 없다                               | 같은 제한에 더해, `playsinline`이 없는 동영상은 전체 화면으로 재생된다                        |

앞의 세 항목(하드웨어, 레이어 분리, `border-radius` 클리핑)은 레이어 합성 방식에서 생기는 차이라서 macOS에서 확인한 결과를 iOS에 그대로 적용할 수 없다. 나머지 네 항목(뷰포트 높이, 화면 키보드, 입력, 미디어 재생)은 모바일 기기의 특성이므로 Android 브라우저에서도 비슷한 문제가 생긴다.

## 렌더링 엔진별 차이

엔진이 다르면 지원하는 CSS 기능, 기본 스타일, 개인정보 보호 정책이 다르다.

| 항목                           | Chrome (Blink)                                                            | Safari (WebKit)                                                                      | Firefox (Gecko)                       |
| ------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| `backdrop-filter`              | 벤더 접두사 없이 지원                                                     | 오랫동안 `-webkit-` 접두사가 필요했다                                                | 벤더 접두사 없이 지원                 |
| 효과가 걸린 자식의 둥근 클리핑 | 대체로 정상                                                               | iOS에서 별도 레이어가 클리핑을 벗어날 수 있다                                        | 대체로 정상                           |
| 스크롤바                       | 운영체제 설정을 따른다. Windows에서는 스크롤바가 레이아웃 너비를 차지한다 | macOS는 기본값이 오버레이 스크롤바다                                                 | 운영체제 설정을 따른다                |
| `-webkit-font-smoothing`       | macOS에서만 적용                                                          | macOS에서만 적용                                                                     | 대신 `-moz-osx-font-smoothing`을 쓴다 |
| 동영상 자동 재생               | 음소거한 동영상은 자동 재생된다                                           | 음소거하면 자동 재생된다. iPhone에서는 `playsinline`이 있어야 페이지 안에서 재생된다 | 음소거한 동영상은 자동 재생된다       |
| 개인정보 보호                  | 세 브라우저 중 제한이 가장 적다                                           | ITP[^itp]가 서드 파티 쿠키와 저장소를 강하게 제한한다                                | 쿠키를 사이트별로 분리해 저장한다     |

같은 엔진이라도 버전마다 지원 범위가 다르다. 새 CSS 기능을 쓰기 전에는 [caniuse.com](https://caniuse.com)에서 Safari와 Safari on iOS 항목을 따로 확인한다. 두 항목의 지원 버전이 다른 경우가 있다.

## 기기 에뮬레이션 테스트가 놓치는 부분

| 테스트 환경                           | 렌더링 엔진       | 확인할 수 있는 것                 | 확인할 수 없는 것                                 |
| ------------------------------------- | ----------------- | --------------------------------- | ------------------------------------------------- |
| Chrome 개발자 도구의 기기 모드        | Blink             | 화면 너비, 터치 입력, 미디어 쿼리 | WebKit에서만 생기는 차이 전부                     |
| Playwright 기기 에뮬레이션 (Chromium) | Blink             | 레이아웃, 터치 흐름, 회귀         | 위와 같다                                         |
| Playwright WebKit                     | WebKit (데스크톱) | WebKit의 CSS·JS 지원 범위         | iOS의 레이어 합성, 화면 키보드, 주소 표시줄       |
| Xcode iOS 시뮬레이터                  | WebKit (iOS)      | iOS Safari 동작 대부분            | 실기기의 GPU와 메모리 조건에서만 생기는 일부 문제 |
| 실제 iPhone                           | WebKit (iOS)      | 전부                              | —                                                 |

[기기 에뮬레이션](https://playwright.dev/docs/emulation)은 화면 크기와 입력 방식만 바꾸고 렌더링 엔진은 바꾸지 않는다. MacFolio의 `apps/react/playwright.config.ts`도 CI에 Chromium만 설치하므로 `mobile-iphone` 프로젝트를 `devices['iPhone 13']` + `browserName: 'chromium'`으로 실행한다. 이 프로젝트가 통과했다는 결과는 화면 크기·터치 흐름에 대한 확인이고, WebKit 렌더링에 대해서는 아무것도 보장하지 않는다. 에뮬레이션은 레이아웃 회귀를 빠르게 검출하는 용도로 쓰고, 렌더링 결과는 iOS 시뮬레이터나 실기기에서 확인해야 한다.

```ts
// apps/react/playwright.config.ts
{
	name: 'mobile-iphone',
	use: { ...devices['iPhone 13'], browserName: 'chromium' },
	testMatch: /\/mobile(-[a-z-]+)?\.spec\.ts$/,
},
```

## 자주 생기는 문제와 대응 방법

아래 그림은 각 문제의 증상과 수정 결과를 비교한 도식이다. 실제 기기의 스크린샷이 아니다.

### 효과가 걸린 자식 요소와 둥근 모서리

iOS에서 `filter`, `backdrop-filter`, `transform`이 걸린 자식이나 동영상이 `overflow: hidden` + `border-radius` 안에 있으면 모서리가 각지게 렌더링될 수 있다. 자식이 별도 레이어로 분리되면서 부모의 둥근 클리핑이 적용되지 않기 때문이다.

![둥근 클리핑을 벗어난 블러 레이어](./images/music-widget-ios-corners-layers.svg '블러 처리한 자식 레이어가 사각형으로 남는다 (왼쪽), clip-path를 더하면 둥글게 잘린다 (오른쪽)')

부모에 [`clip-path`](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)를 함께 지정한다. `clip-path`는 자식까지 모두 렌더링한 결과를 지정한 모양으로 클리핑하기 때문에, 별도 레이어로 분리된 자식도 함께 잘린다. MacFolio는 휴대폰 홈 화면의 음악 위젯(`apps/react/src/desktop/mobile/MobileShell.css`)에 `clip-path: inset(0 round var(--radius-window))`를 지정했다.

```css
.card {
	overflow: hidden;
	border-radius: 20px;
	clip-path: inset(0 round 20px);
}
```

### `100vh`로 지정한 화면 높이

`vh`는 주소 표시줄이 접혔을 때의 높이(large viewport)를 기준으로 계산된다. 주소 표시줄이 펼쳐져 있으면 `100vh`인 요소의 아래쪽이 표시줄에 가려진다.

![100vh와 100dvh 비교](./images/safari-macos-ios-rendering-vh.svg '100vh인 화면은 아래쪽 버튼이 주소 표시줄에 가려지고, 100dvh는 표시줄 위까지만 차지한다')

주소 표시줄 상태와 관계없이 보이는 높이가 필요하면 `dvh`(현재 높이)나 `svh`(주소 표시줄이 펼쳐졌을 때의 높이)를 쓴다. `dvh`를 지원하지 않는 브라우저를 위해 `vh`를 먼저 선언한다. 지원하지 않는 브라우저는 두 번째 선언을 무시하고 `100vh`를 사용한다.

```css
.screen {
	height: 100vh;
	height: 100dvh;
}
```

### 카메라 영역과 홈 표시줄

`viewport-fit=cover`로 화면 가장자리까지 그리면, 여백을 주지 않은 요소가 카메라 영역과 홈 표시줄에 가려진다.

![safe-area 여백 비교](./images/safari-macos-ios-rendering-safe-area.svg '여백이 없으면 상단 메뉴와 하단 탭 막대가 가려지고, safe-area 여백을 주면 보인다')

가려지는 영역의 크기는 `env(safe-area-inset-*)`로 얻는다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

```css
.tab-bar {
	padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
```

### 16px 미만 입력 칸의 자동 확대

iOS Safari는 글자 크기가 16px 미만인 입력 칸에 포커스가 가면 페이지를 확대한다. 입력을 마쳐도 원래 배율로 자동으로 돌아오지 않는다.

![입력 칸 글자 크기에 따른 확대](./images/safari-macos-ios-rendering-input-zoom.svg '14px 입력 칸은 포커스 시 화면이 확대되고, 16px은 배율이 유지된다')

입력 칸의 글자 크기를 16px 이상으로 지정한다. `maximum-scale=1`로 확대를 막는 방법도 있지만, 사용자가 직접 확대하는 기능까지 막혀 접근성이 떨어진다.

```css
input,
textarea,
select {
	font-size: 16px;
}
```

### 탭한 뒤에도 남는 `:hover`

모바일 브라우저는 탭을 hover로도 처리해서, 다른 곳을 탭할 때까지 `:hover` 스타일이 유지된다.

![:hover 처리 비교](./images/safari-macos-ios-rendering-hover.svg ':hover만 쓰면 탭한 항목이 계속 강조되고, hover 미디어 쿼리 안에 두면 터치 기기에서는 적용되지 않는다')

hover 효과는 마우스처럼 hover가 가능한 입력 장치에서만 적용되도록 미디어 쿼리 안에 둔다.

```css
@media (hover: hover) {
	.item:hover {
		background: var(--hover-background);
	}
}
```

### 화면 키보드에 가려지는 고정 요소

iOS에서는 화면 키보드가 올라와도 레이아웃 뷰포트가 줄어들지 않는다. `position: fixed; bottom: 0`으로 고정한 입력 막대는 키보드 뒤에 가려진다.

![화면 키보드와 고정 요소](./images/safari-macos-ios-rendering-keyboard.svg '하단에 고정한 입력 막대는 키보드에 가려지고, visualViewport 높이로 위치를 계산하면 키보드 위에 보인다')

키보드를 제외한 실제 표시 영역은 [`window.visualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)로 얻는다. `resize` 이벤트에서 키보드 높이를 계산해 요소의 위치를 옮긴다.

```js
const viewport = window.visualViewport;
viewport.addEventListener('resize', () => {
	const keyboard = window.innerHeight - viewport.height - viewport.offsetTop;
	inputBar.style.bottom = `${Math.max(0, keyboard)}px`;
});
```

MacFolio는 같은 계산을 `apps/react/src/shared/hooks/useKeyboardInset.ts`에 두고, 120px보다 작은 변화는 키보드가 아니라 주소 표시줄이 접히고 펼쳐진 것으로 판단해 제외한다. 메모 편집기의 서식 막대가 이 값을 사용한다([휴대폰 키보드 위에 서식 막대 띄우기](/memo/memo-keyboard-toolbar)).

### 동영상 재생과 `playsinline`

iPhone Safari는 `playsinline` 속성이 없는 `<video>`를 재생하면 전체 화면 플레이어로 전환한다. 자동 재생은 소리가 없거나 음소거된 동영상에만 허용된다.

![playsinline 유무 비교](./images/safari-macos-ios-rendering-video.svg 'playsinline이 없으면 전체 화면 플레이어로 열리고, 있으면 페이지 안에서 재생된다')

```html
<video src="loop.mp4" autoplay muted loop playsinline></video>
```

React의 `muted` prop은 HTML 속성으로 반영되지 않는 경우가 있어서 자동 재생이 차단될 수 있다. 이때는 ref로 요소의 `muted` 속성을 직접 설정한다. MacFolio의 배경화면 동영상(`apps/react/src/desktop/WallpaperVideo.tsx`)도 `element.muted = true`를 직접 지정한다([배경화면 3 - video 요소와 canvas로 만든 포스터로 동영상 배경화면 적용하기](/memo/video-wallpaper)).

### 서드 파티 쿠키와 교차 출처 요청

Safari의 ITP는 서드 파티 쿠키와 저장소를 다른 브라우저보다 먼저 차단한다. `navigator.sendBeacon`처럼 다른 출처로 보내는 요청은 Safari에서 응답 헤더(CORS, Cross-Origin-Resource-Policy)까지 따로 확인한다.

## 정리

1. **"Safari에서 확인했다"는 말에 플랫폼을 붙인다.** macOS Safari, iOS Safari, iPadOS Safari(기본으로 데스크톱 사이트를 요청한다)는 결과가 다르다. iOS Chrome도 WebKit이다
2. **에뮬레이션과 실기기의 용도를 나눈다.** 기기 모드와 Playwright 에뮬레이션은 레이아웃 회귀 확인에, 블러·`backdrop-filter`·동영상·애니메이션은 시뮬레이터나 실기기 확인에 쓴다
3. **GPU 효과가 걸린 요소는 클리핑을 확인한다.** `filter`, `backdrop-filter`, `transform`, `will-change`, 동영상이 둥근 모서리 안에 있으면 iOS에서 모서리를 확인한다
4. **뷰포트 높이가 바뀐다는 전제로 레이아웃을 설계한다.** `dvh`·`svh`, `env(safe-area-inset-*)`, `visualViewport`를 쓴다
5. **터치 입력을 기준으로 설계한다.** 16px 미만 입력 칸, `:hover`에만 의존하는 동작, 44px보다 작은 터치 영역을 피한다
6. **사용자 동작이 필요한 기능을 구분한다.** 소리 재생, 전체 화면, 클립보드, 알림은 사용자 동작 이후에 실행한다
7. **새 CSS 기능은 Safari와 Safari on iOS의 지원 범위를 따로 확인한다.** 지원하지 않는 환경은 `@supports`로 분기해 기존 스타일을 유지한다
8. **개인정보 보호 정책도 브라우저 차이로 다룬다.** 쿠키, 저장소, 교차 출처 요청을 다루는 코드는 Safari에서 따로 테스트한다

## 참고 문서

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 2.5.6 (Apple)
  - "웹을 탐색하는 앱은 적절한 WebKit 프레임워크와 WebKit JavaScript를 사용해야 한다." 다른 브라우저 엔진을 쓰기 위한 권한은 EU와 일본에서 신청할 수 있다.
- [Using alternative browser engines in the European Union](https://developer.apple.com/support/alternative-browser-engines/) (Apple)
  - 다른 브라우저 엔진은 "iOS 17.4 또는 iPadOS 18 이상을 실행하는 기기의 EU 사용자"에게 제공된다.
- [length: 뷰포트 단위](https://developer.mozilla.org/en-US/docs/Web/CSS/length) (MDN)
  - `vh`는 "large viewport 크기를 기준으로 하는 `lvh`와 같다." large viewport는 브라우저 UI가 접혔을 때를 기준으로 하므로, UI가 펼쳐지면 "콘텐츠가 가려질 수 있다." `dv*` 단위는 브라우저 UI의 표시 여부와 관계없이 콘텐츠가 "뷰포트에 정확히 맞도록" 크기가 정해진다.
- [env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env) (MDN)
  - `safe-area-inset-*`는 사각형이 아닌 화면 모양 때문에 "잘리지 않고 콘텐츠를 배치할 수 있는" 영역까지의 거리이며, 원래 iOS 브라우저가 노치와 둥근 모서리에 콘텐츠가 가리지 않도록 제공한 값이다.
- [New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) (WebKit)
  - 오디오 트랙이 없거나 `muted`인 동영상은 사용자 동작 없이 자동 재생할 수 있고, 사용자 동작 없이 음소거를 해제하면 "재생이 일시 정지된다." iPhone에서 `playsinline`이 없는 동영상은 전체 화면으로 재생된다.
- [Tracking Prevention in WebKit](https://webkit.org/tracking-prevention/) (WebKit)
  - ITP가 서드 파티 쿠키와 웹사이트 데이터를 제한하는 규칙을 정리한 문서다.
- [Emulation](https://playwright.dev/docs/emulation) (Playwright)
  - 기기 설정은 뷰포트, User-Agent, 터치 지원 등을 지정한다. 기기 설정의 기본 브라우저와 다른 엔진으로 실행하려면 `browserName`을 지정한다.
- [hover](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover) (MDN)
  - `hover: none`은 주 입력 장치가 hover를 할 수 없거나 쉽게 할 수 없는 경우다. "많은 모바일 기기는 사용자가 길게 탭하면 hover를 흉내 낸다."

## 관련 글

- [위젯 2 - iOS Safari의 filter 합성 레이어에서 빠지는 border-radius 클리핑과 clip-path](/memo/music-widget-ios-corners)
- [휴대폰 키보드 위에 서식 막대 띄우기 — visualViewport로 키보드 높이 재기](/memo/memo-keyboard-toolbar)
- [배경화면 3 - video 요소와 canvas로 만든 포스터로 동영상 배경화면 적용하기](/memo/video-wallpaper)
- [E2E 시험 2 - Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)

[^itp]: Intelligent Tracking Prevention. 사이트를 넘나드는 추적을 막기 위해 서드 파티 쿠키 차단, 스크립트로 저장한 데이터의 보관 기간 제한 등을 적용하는 Safari의 기능이다.

#TIL #프론트엔드 #CSS #Safari #iOS #크로스브라우징
