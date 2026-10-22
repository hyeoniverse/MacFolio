---
title: 같은 Safari, 다른 화면 - macOS와 iOS, 브라우저마다 다르게 그리는 곳
date: 2026-10-22
category: 개발기/MacFolio/프론트엔드
summary: 음악 위젯의 꼭짓점은 맥 Safari에서는 둥글고 아이폰 Safari에서만 각졌다. 같은 WebKit인데 왜 다를까. macOS와 iOS의 Safari가 다르게 그리는 곳, Chrome·Firefox·Safari의 차이, 그리고 이 사이트에서 실제로 손댄 곳을 모아 프론트엔드가 조심할 점으로 정리했다.
---

[아이폰에서만 각진 음악 위젯](/memo/music-widget-ios-corners)을 고치면서 이상한 점이 하나 남았다. 맥북의 Safari와 아이폰의 Safari는 같은 WebKit인데, 같은 CSS가 한쪽에서만 틀리게 그려졌다. "Safari에서 확인했다"는 말이 어느 Safari인지까지 말해 주지 않는다는 것을 그때 알았다. 이 글은 그 차이를 정리한 것이다.

## 브라우저 이름보다 엔진과 운영체제

![브라우저와 운영체제에 따른 엔진](./images/safari-macos-ios-rendering-engines.svg 'iOS에서는 Chrome·Firefox도 WebKit으로 그린다')

웹 페이지를 그리는 것은 브라우저의 엔진이다. Chrome은 Blink, Firefox는 Gecko, Safari는 WebKit이다. 그런데 iOS에서는 App Store 규칙 때문에 모든 브라우저가 WebKit을 써야 한다(EU에서는 iOS 17.4부터 다른 엔진을 허용했다). 그래서 아이폰의 Chrome으로 열어도 음악 위젯의 꼭짓점은 똑같이 각졌을 것이다. iOS 문제는 "Safari 문제"가 아니라 "iOS WebKit 문제"로 보는 편이 맞다.

엔진이 같아도 그림을 화면에 내는 길은 운영체제마다 다르다. 페이지는 여러 층(layer)으로 나뉘어 그려진 뒤 GPU에서 합쳐진다. 이 합성을 macOS와 iOS의 WebKit 모두 Core Animation에 맡기지만, 조건이 다르다.

| 차이        | macOS Safari                                             | iOS Safari                                                              |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| 기기        | 메모리·GPU가 넉넉하다                                    | 메모리가 빠듯해 층을 아껴 쓰고, 큰 층은 타일로 나눠 그린다              |
| 층 나누기   | 같은 CSS도 층으로 따로 빼지 않고 함께 그리는 경우가 많다 | `filter`, `transform`, 영상, 흐림 효과가 따로 된 층이 되기 쉽다         |
| 둥근 자르기 | 부모가 자르면 대개 자식까지 잘린다                       | 따로 된 자식 층에 둥근 자르기가 전해지지 않는 경우가 있다 (음악 위젯)   |
| 화면 크기   | 창 크기가 곧 화면                                        | 주소 막대가 접히고 펴지며 높이가 바뀐다. 노치·홈 표시줄이 화면을 가린다 |
| 입력        | 마우스와 키보드, `:hover`                                | 손가락. `:hover`가 누른 뒤에 남는다. 화면 키보드가 화면을 덮는다        |

음악 위젯은 셋째 줄에 걸렸다. 흐린 앨범 표지(`::before`, `filter: blur`)가 iOS에서만 따로 된 층이 되었고, 그 층이 위젯의 `overflow: hidden` + `border-radius`로 잘리지 않았다. 맥에서는 같은 CSS가 둥글게 잘렸다.

## 흉내로는 안 보이는 것

이 사이트의 화면 시험은 Playwright로 데스크톱, iPhone, Android 세 가지 화면을 돈다. 그런데 CI에는 Chromium만 깔려 있어서, "iPhone"도 사실은 Chromium이 iPhone 13의 화면 크기와 터치를 흉내 내는 것이다. 엔진도, GPU 합성도 iPhone의 것이 아니다. 로컬에 깔린 Playwright WebKit으로 돌려 봐도 음악 위젯은 고치기 전부터 둥글었다. 헤드리스 WebKit은 macOS 위에서 돌고, iPhone처럼 그리지 않는다.

| 확인하는 곳                                  | 엔진           | 잡아내는 것                | 못 잡는 것                         |
| -------------------------------------------- | -------------- | -------------------------- | ---------------------------------- |
| Chrome 개발자 도구의 기기 모드               | Blink          | 화면 폭, 터치, 미디어 쿼리 | WebKit만의 차이 전부               |
| Playwright `devices['iPhone 13']` (Chromium) | Blink          | 레이아웃, 터치 흐름, 회귀  | 위와 같다                          |
| Playwright WebKit                            | WebKit (macOS) | WebKit의 CSS·JS 지원 차이  | iOS의 합성, 화면 키보드, 주소 막대 |
| Xcode의 iOS 시뮬레이터                       | WebKit (iOS)   | 대부분의 iOS Safari 동작   | 실제 GPU·메모리에서만 나는 것 일부 |
| 실제 아이폰                                  | WebKit (iOS)   | 전부                       | —                                  |

흉내는 레이아웃이 깨졌는지를 빠르게 잡는다. 그리는 방식의 차이는 실제 기기나 적어도 그 운영체제의 시뮬레이터에서만 보인다. 흐림, 유리, 영상처럼 GPU가 그리는 효과를 쓴 곳은 실제 아이폰에서 한 번은 본다.

## 브라우저마다 다르게 그리는 곳

엔진이 다르면 지원하는 기능과 기본값이 다르다. 이 사이트를 만들며 실제로 부딪힌 것 위주로 적는다.

| 주제                                 | Chrome (Blink)                                | Safari (WebKit)                                      | Firefox (Gecko)                  |
| ------------------------------------ | --------------------------------------------- | ---------------------------------------------------- | -------------------------------- |
| 흐린 유리 `backdrop-filter`          | 접두어 없이                                   | 오랫동안 `-webkit-` 접두어가 필요했다                | 접두어 없이                      |
| 흐림·둥근 자르기 (합성 층)           | 대개 잘 잘린다                                | iOS에서 자식 층이 빠져나갈 수 있다                   | 대개 잘 잘린다                   |
| 스크롤바                             | 운영체제를 따른다 (Windows는 자리를 차지한다) | macOS는 기본이 겹쳐 뜨는 스크롤바                    | 운영체제를 따른다                |
| 폰트 다듬기 `-webkit-font-smoothing` | macOS에서만 듣는다                            | macOS에서만 듣는다                                   | 비슷한 `-moz-osx-font-smoothing` |
| 소리·영상 자동 재생                  | 소리 없는 영상은 된다                         | 소리 없고 `playsinline`이어야 화면 안에서 재생 (iOS) | 소리 없는 영상은 된다            |
| 개인정보 보호                        | 셋 중 가장 덜 막는다                          | ITP: 다른 사이트의 쿠키·저장소를 강하게 막는다       | 쿠키를 사이트마다 나눠 담는다    |

같은 엔진 안에서도 버전마다 지원이 다르다. 새 기능을 쓸 때는 [caniuse.com](https://caniuse.com)에서 Safari와 iOS Safari 줄을 따로 본다. 두 줄이 다른 경우가 있다.

## 이 사이트에서 손댄 곳

돌아보니 이미 브라우저 차이 때문에 넣은 코드가 여럿 있었다.

- **입력 칸 글자 16px:** iOS Safari는 16px보다 작은 입력 칸을 누르면 화면을 확대한다. 메시지 입력 칸과 설정의 입력 칸은 16px로 둔다 (`Messages.css`, `Settings.css`)
- **`100dvh`와 safe-area:** iOS의 `100vh`는 주소 막대를 접은 높이라 화면 아래가 잘린다. 휴대폰 홈 화면과 창은 `100dvh`를 쓰고, 노치와 홈 표시줄 자리는 `env(safe-area-inset-*)`로 비운다 (`MobileHome.css`, `Window.css`)
- **누른 뒤에 소리:** 브라우저는 사람이 누르기 전에는 소리를 내지 못하게 한다. 첫 화면의 맥 시동음은 로딩 화면을 누른 뒤에 재생한다 (`LoadingScreen.tsx`)
- **동영상 배경화면:** 자동 재생은 소리 없는 영상만 된다. React의 `muted`는 HTML 속성으로 쓰이지 않아서 요소에 직접 켜고, iOS가 전체 화면으로 띄우지 않게 `playsInline`을 준다 (`WallpaperVideo.tsx`)
- **`:hover`는 마우스에서만:** 손가락으로 누르면 `:hover`가 남아 버튼이 계속 강조된다. 강조가 필요한 곳은 `@media (hover: hover)` 안에 둔다 (`Settings.css`)
- **`-webkit-backdrop-filter`:** 위젯의 유리는 접두어와 함께 쓴다 (`Widgets.css`)
- **sendBeacon과 CORP:** 방문 기록은 페이지를 닫을 때도 보내려고 `navigator.sendBeacon`을 쓴다. Safari는 이 요청의 응답에도 `Cross-Origin-Resource-Policy`를 따져서, 다른 주소의 사이트가 보낸 것을 취소했다. 받는 경로만 `cross-origin`으로 연다 (`analytics.controller.ts`)
- **흐린 배경과 둥근 모서리:** 음악 위젯은 `clip-path: inset(0 round …)`로 한 번 더 자른다 (`MobileShell.css`)

## 프론트엔드가 조심할 점

1. **"Safari에서 됐다"를 나눠 말한다.** macOS Safari, iOS Safari, iPad의 Safari(데스크톱 모드로 열린다)는 다르다. iOS의 Chrome도 WebKit이다
2. **흉내와 진짜를 나눈다.** 기기 모드와 Playwright의 기기 흉내는 레이아웃 회귀를 잡는 데 쓰고, 효과(흐림·유리·영상·애니메이션)는 실제 기기나 시뮬레이터에서 확인한다
3. **GPU가 그리는 효과는 자르기를 의심한다.** `filter`, `backdrop-filter`, `transform`, `will-change`, 영상이 `overflow: hidden` + `border-radius` 안에 있으면 iOS에서 꼭짓점을 본다. 필요하면 `clip-path`로 다시 자른다
4. **화면 높이는 늘 변한다고 본다.** `vh` 대신 `dvh`·`svh`, 노치는 `env(safe-area-inset-*)`, 화면 키보드는 `visualViewport`로 다룬다
5. **입력은 터치를 먼저 생각한다.** 16px 미만 입력 칸, `:hover`에만 기대는 동작, 너무 작은 누를 자리(44px 미만)를 피한다
6. **자동으로 일어나는 일은 막힌다고 본다.** 소리, 전체 화면, 클립보드, 알림은 사람이 누른 뒤에 한다
7. **새 기능은 지원 표를 두 줄 본다.** Safari와 iOS Safari를 따로 보고, 없으면 `@supports`로 나눠 예전 모양을 남긴다
8. **개인정보 보호 기능을 기능 차이로 본다.** 쿠키·저장소·요청 머리글을 다루는 코드는 Safari에서 따로 확인한다

## 관련 글

- [아이폰에서만 각진 음악 위젯 - 흐린 배경이 둥근 자르기를 빠져나갈 때](/memo/music-widget-ios-corners)
- [휴대폰 앱들을 메모처럼 - 함께 쓰는 바탕과 카드, iOS 음악](/memo/mobile-apps-ios-style)
- [트래픽 분석 2 - 사이트에서 모아 보내기](/memo/analytics-collect)

#MacFolio #프론트엔드 #CSS #Safari #iOS #크로스브라우징
