---
title: 같은 Safari, 다른 화면 — macOS와 iOS, 브라우저마다 다르게 그리는 곳
date: 2026-10-22
category: 기술 노트/프론트엔드
summary: 맥의 Safari에서 맞게 보인 화면이 아이폰의 Safari에서는 틀리게 보일 수 있다. 엔진과 운영체제가 화면을 그리는 길을 정리하고, macOS·iOS Safari와 Chrome·Firefox가 다르게 그리는 곳, 흉내 내는 시험이 놓치는 것, 프론트엔드가 조심할 점을 공식 문서와 함께 적었다.
---

"Safari에서 확인했다"는 말은 어느 Safari인지까지 말해 주지 않는다. 맥의 Safari와 아이폰의 Safari는 같은 WebKit이지만, 같은 CSS를 다르게 그릴 때가 있다. 아이폰의 Chrome은 Chrome이지만 화면은 WebKit이 그린다. 이 글은 브라우저마다, 운영체제마다 화면이 갈리는 곳을 일반론으로 정리한다. 실제로 겪은 예는 [아이폰에서만 각진 음악 위젯](/memo/music-widget-ios-corners)에 따로 적었다.

<details id="terms">
<summary>먼저 알아 둘 용어</summary>

| 용어                  | 뜻                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| 엔진                  | HTML·CSS·JS를 읽어 화면을 그리는 부분. Chrome은 Blink, Firefox는 Gecko, Safari는 WebKit                 |
| 층 (layer)            | 브라우저가 페이지를 여러 장으로 나눠 그린 것. 움직이거나 효과가 걸린 부분은 따로 된 층이 된다           |
| 합성 (compositing)    | 나눠 그린 층을 GPU에서 한 화면으로 합치는 일. 운영체제의 그래픽 체계(macOS·iOS는 Core Animation)를 쓴다 |
| 뷰포트                | 페이지가 보이는 창. 휴대폰은 주소 막대·화면 키보드가 나오고 들어가며 크기가 바뀐다                      |
| 기기 흉내 (emulation) | 데스크톱 브라우저가 휴대폰의 화면 크기·터치·User-Agent를 흉내 내는 것. 엔진은 바뀌지 않는다             |

</details>

## 브라우저 이름보다 엔진과 운영체제

![브라우저와 운영체제에 따른 엔진](./images/safari-macos-ios-rendering-engines.svg 'iOS에서는 Chrome·Firefox도 WebKit으로 그린다')

iOS·iPadOS에서 웹을 보여 주는 앱은 WebKit을 써야 한다는 App Store 규칙이 있다. 그래서 아이폰의 Chrome·Firefox·Edge는 이름만 다를 뿐 화면은 Safari와 같은 엔진이 그린다. EU(iOS 17.4부터)와 일본에서는 다른 엔진을 쓸 수 있는 길이 열렸지만, 그 밖에서는 여전히 WebKit이다. 그러니 iOS에서만 나는 문제는 "Safari 문제"가 아니라 "iOS WebKit 문제"로 보는 편이 맞다. 아이폰의 Chrome에서도 똑같이 난다.

반대로 같은 이름의 브라우저도 운영체제가 다르면 다르다. Windows·Android의 Chrome은 Blink이고 iOS의 Chrome은 WebKit이다.

## 같은 WebKit, macOS와 iOS가 갈리는 곳

엔진이 같아도 그린 것을 화면에 내는 길과 기기의 조건이 다르다.

| 차이        | macOS Safari                                                       | iOS Safari                                                                                   |
| ----------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 기기        | 메모리·GPU가 넉넉하다                                              | 메모리가 빠듯해 층을 아껴 쓰고, 큰 층은 타일로 나눠 그린다                                   |
| 층 나누기   | 효과가 걸려도 함께 그리는 경우가 많다                              | `filter`, `backdrop-filter`, `transform`, 영상이 따로 된 층이 되기 쉽다                      |
| 둥근 자르기 | 부모의 `overflow: hidden` + `border-radius`가 대개 자식까지 자른다 | 따로 된 자식 층에 둥근 자르기가 전해지지 않아 네모로 남는 경우가 있다                        |
| 뷰포트      | 창 크기가 곧 뷰포트                                                | 주소 막대가 접히고 펴지며 높이가 바뀐다. 노치·둥근 모서리·홈 표시줄이 화면을 가린다          |
| 화면 키보드 | 없다                                                               | 키보드가 화면을 덮는다. 레이아웃 뷰포트는 그대로이고 보이는 부분(visual viewport)만 줄어든다 |
| 입력        | 마우스. `:hover`가 자연스럽다                                      | 손가락. 누른 뒤 `:hover`가 남는다. 16px보다 작은 입력 칸을 누르면 화면을 확대한다            |
| 소리·영상   | 사람이 누르기 전에는 소리를 내지 못한다                            | 같고, 영상은 `playsinline`이 없으면 전체 화면으로 재생한다                                   |

맥에서 확인했다고 아이폰에서 맞다고 볼 수 없는 것은 주로 앞의 세 줄, 그리는 방식에서 온다. 뒤의 네 줄은 휴대폰이라는 기기에서 오므로 Android에서도 비슷하게 겪는다.

## 엔진마다 다른 곳

엔진이 다르면 지원하는 기능, 기본값, 개인정보 보호 정책이 다르다.

| 주제                                 | Chrome (Blink)                               | Safari (WebKit)                                               | Firefox (Gecko)                  |
| ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------- | -------------------------------- |
| 흐린 유리 `backdrop-filter`          | 접두어 없이                                  | 오랫동안 `-webkit-` 접두어가 필요했다                         | 접두어 없이                      |
| 효과와 둥근 자르기                   | 대개 잘 잘린다                               | iOS에서 따로 된 층이 빠져나갈 수 있다                         | 대개 잘 잘린다                   |
| 스크롤바                             | 운영체제를 따른다. Windows는 자리를 차지한다 | macOS는 기본이 겹쳐 뜨는 스크롤바                             | 운영체제를 따른다                |
| 글자 다듬기 `-webkit-font-smoothing` | macOS에서만 듣는다                           | macOS에서만 듣는다                                            | 비슷한 `-moz-osx-font-smoothing` |
| 영상 자동 재생                       | 소리 없는 영상은 된다                        | 소리 없으면 되고, iPhone은 `playsinline`이 있어야 화면 안에서 | 소리 없는 영상은 된다            |
| 개인정보 보호                        | 셋 중 가장 덜 막는다                         | ITP: 다른 사이트의 쿠키·저장소를 강하게 막는다                | 쿠키를 사이트마다 나눠 담는다    |

같은 엔진 안에서도 버전마다 지원이 다르다. 새 기능을 쓸 때는 [caniuse.com](https://caniuse.com)에서 Safari와 Safari on iOS 줄을 따로 본다. 두 줄의 버전이 다를 때가 있다.

## 흉내 내는 시험이 놓치는 것

| 확인하는 곳                           | 엔진                  | 잡아내는 것                | 못 잡는 것                         |
| ------------------------------------- | --------------------- | -------------------------- | ---------------------------------- |
| Chrome 개발자 도구의 기기 모드        | Blink                 | 화면 폭, 터치, 미디어 쿼리 | WebKit만의 차이 전부               |
| Playwright의 기기 흉내를 Chromium으로 | Blink                 | 레이아웃, 터치 흐름, 회귀  | 위와 같다                          |
| Playwright WebKit                     | WebKit (데스크톱에서) | WebKit의 CSS·JS 지원 차이  | iOS의 합성, 화면 키보드, 주소 막대 |
| Xcode의 iOS 시뮬레이터                | WebKit (iOS)          | 대부분의 iOS Safari 동작   | 실제 GPU·메모리에서만 나는 것 일부 |
| 실제 아이폰                           | WebKit (iOS)          | 전부                       | —                                  |

기기 흉내는 화면 크기와 터치를 바꿀 뿐 엔진을 바꾸지 않는다. CI에서 "iPhone" 이름으로 돈 시험이 Chromium이었다면, 그 시험은 WebKit에 대해 아무것도 말해 주지 않는다. 흉내는 레이아웃이 깨졌는지를 빠르게 잡는 데 쓰고, 그리는 방식은 시뮬레이터나 실제 기기에서 본다.

## 자주 부딪히는 곳과 다루는 법

**효과가 걸린 자식과 둥근 모서리.** iOS에서 `filter`·`backdrop-filter`·`transform`·영상이 `overflow: hidden` + `border-radius` 안에 있으면 꼭짓점이 각질 수 있다. 자르는 쪽에 `clip-path`를 한 번 더 준다. 그림을 다 그린 뒤 그 모양으로 자르므로 따로 된 층도 함께 잘린다.

```css
.card {
	overflow: hidden;
	border-radius: 20px;
	clip-path: inset(0 round 20px);
}
```

**높이 100%.** `vh`는 주소 막대가 접힌 큰 뷰포트를 기준으로 해서, 주소 막대가 펴져 있으면 아래가 가려진다. 늘 보이는 높이가 필요하면 `dvh`(지금 높이) 또는 `svh`(가장 작은 높이)를 쓴다.

```css
.screen {
	height: 100vh; /* dvh를 모르는 브라우저 */
	height: 100dvh;
}
```

**노치와 홈 표시줄.** 화면 가장자리까지 그리려면 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`로 화면을 다 쓰고, 가려지는 자리는 `env(safe-area-inset-*)`로 비운다.

```css
.bottom-bar {
	padding-bottom: calc(12px + env(safe-area-inset-bottom));
}
```

**입력 칸 확대.** iOS Safari는 글자가 16px보다 작은 입력 칸을 누르면 화면을 확대한다. 확대를 막으려고 `maximum-scale=1`로 사용자 확대까지 막기보다, 입력 칸의 글자를 16px 이상으로 둔다.

**`:hover`.** 손가락으로 누르면 `:hover`가 남아 버튼이 계속 강조된다. 강조는 마우스처럼 올릴 수 있는 입력에서만 준다.

```css
@media (hover: hover) {
	.button:hover {
		background: var(--hover);
	}
}
```

**소리와 영상.** 소리는 사람이 누른 뒤에 낸다. 배경 영상은 소리를 끄고 화면 안에서 재생하게 한다. React의 `muted` 속성은 HTML 속성으로 쓰이지 않을 때가 있어, 자동 재생이 막히면 요소에 직접 켠다.

```html
<video src="loop.mp4" autoplay muted loop playsinline></video>
```

**화면 키보드.** iOS는 키보드가 나와도 레이아웃 뷰포트를 줄이지 않는다. 입력 칸 위에 붙는 막대는 `window.visualViewport`의 크기와 `resize` 이벤트로 자리를 잡는다.

**개인정보 보호.** 다른 사이트에 두는 쿠키·저장소는 Safari에서 먼저 막힌다. 페이지를 떠날 때 보내는 요청(`navigator.sendBeacon`)처럼 다른 주소로 가는 요청은 응답 머리글(CORS, CORP)까지 Safari에서 따로 확인한다.

## 정리: 조심할 점

1. **"Safari에서 됐다"를 나눠 말한다.** macOS Safari, iOS Safari, iPad의 Safari(데스크톱 사이트로 열린다)는 다르다. iOS의 Chrome도 WebKit이다
2. **흉내와 진짜를 나눈다.** 기기 모드와 Playwright의 기기 흉내는 레이아웃 회귀에, 효과(흐림·유리·영상·애니메이션)는 시뮬레이터나 실제 기기에
3. **효과가 걸린 곳은 자르기를 의심한다.** `filter`, `backdrop-filter`, `transform`, `will-change`, 영상이 둥근 모서리 안에 있으면 iOS에서 꼭짓점을 본다
4. **화면 높이는 늘 변한다고 본다.** `dvh`·`svh`, `env(safe-area-inset-*)`, `visualViewport`
5. **입력은 터치를 먼저 생각한다.** 16px 미만 입력 칸, `:hover`에만 기대는 동작, 너무 작은 누를 자리를 피한다
6. **자동으로 일어나는 일은 막힌다고 본다.** 소리, 전체 화면, 클립보드, 알림은 사람이 누른 뒤에
7. **새 기능은 지원 표를 두 줄 본다.** Safari와 Safari on iOS를 따로 보고, 없으면 `@supports`로 나눠 예전 모양을 남긴다
8. **개인정보 보호를 기능 차이로 본다.** 쿠키·저장소·다른 주소로 가는 요청은 Safari에서 따로 확인한다

## 참고 문서

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) 2.5.6 (Apple)
  - "웹을 보여 주는 앱은 알맞은 WebKit 프레임워크와 WebKit JavaScript를 써야 한다." 다른 브라우저 엔진을 쓰는 권한은 EU와 일본에서 신청할 수 있다.
- [Using alternative browser engines in the European Union](https://developer.apple.com/support/alternative-browser-engines/) (Apple)
  - 다른 엔진을 쓰는 기능은 "iOS 17.4 또는 iPadOS 18 이상 기기의 EU 사용자에게" 열려 있다.
- [length: 뷰포트 단위](https://developer.mozilla.org/en-US/docs/Web/CSS/length) (MDN)
  - `vh`는 "큰 뷰포트 크기를 기준으로 한 `lvh`와 같다." 큰 뷰포트는 브라우저 화면 요소가 접혔을 때를 채우므로 "펴지면 내용이 가려질 수 있다." `dv*`는 화면 요소가 나오고 들어가는 것과 상관없이 "뷰포트에 딱 맞게" 크기가 정해진다.
- [env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env) (MDN)
  - `safe-area-inset-*`는 직사각형이 아닌 화면 모양에 "잘리지 않고 내용을 둘 수 있는" 거리이고, 원래 iOS 브라우저가 노치와 둥근 모서리에 가리지 않게 하려고 내놓은 값이다.
- [New video policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) (WebKit)
  - 소리 트랙이 없거나 `muted`인 영상은 사람이 누르지 않아도 자동 재생할 수 있고, 사람이 누르지 않았는데 소리를 켜면 "재생이 멈춘다." iPhone에서 `playsinline`이 없는 영상은 전체 화면으로 재생한다.
- [hover](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover) (MDN)
  - `hover: none`은 주된 입력이 올릴 수 없거나 쉽게 올릴 수 없는 경우다. "많은 휴대 기기는 사용자가 불편하게 길게 누르면 올리기를 흉내 낸다."

## 관련 글

- [아이폰에서만 각진 음악 위젯 - 흐린 배경이 둥근 자르기를 빠져나갈 때](/memo/music-widget-ios-corners)

#프론트엔드 #CSS #Safari #iOS #크로스브라우징
