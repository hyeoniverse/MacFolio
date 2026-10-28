---
title: iOS Safari의 filter 합성 레이어에서 빠지는 border-radius 클리핑과 clip-path
date: 2026-10-22
category: 개발 기록/MacFolio/프론트엔드
summary: 홈 화면의 음악 위젯만 iOS Safari에서 모서리가 각지게 그려졌다. 배경 블러에 쓴 filter가 별도 합성 레이어를 만들면서 부모의 border-radius 클리핑이 적용되지 않은 것이 원인이었다. clip-path로 같은 모양을 한 번 더 잘라 해결했다.
---

휴대폰 홈 화면의 위젯은 모두 모서리가 둥글다. 그런데 실제 아이폰의 Safari에서 열어 보니 음악 위젯만 네 모서리가 각지게 렌더링됐다. 맥북 Safari의 반응형 디자인 모드로 같은 화면 크기를 표시하면 정상이었고, 다른 위젯은 아이폰에서도 둥글게 렌더링됐다. 수정 커밋(`4074204a7`)은 [#330](https://github.com/hyeoniverse/MacFolio/pull/330)에 포함되어 병합됐다.

| 환경                            | 음악 위젯 모서리 |
| ------------------------------- | ---------------- |
| 실제 아이폰 Safari              | 각짐             |
| macOS Safari 반응형 디자인 모드 | 둥긂             |
| Playwright WebKit (헤드리스)    | 둥긂             |
| 다른 위젯 (모든 환경)           | 둥긂             |

## 음악 위젯의 구조

음악 위젯은 앨범 커버를 블러 처리해 배경으로 사용한다. iOS의 '지금 재생 중' 화면처럼 곡마다 배경색이 달라지게 하기 위해서다. 스타일은 다음과 같다(`apps/react/src/desktop/mobile/MobileShell.css`).

```css
.music-widget {
	position: relative;
	overflow: hidden;
	border-radius: var(--radius-window);
	isolation: isolate;
}

/* 앨범 커버를 블러 처리한 배경 */
.music-widget::before {
	position: absolute;
	inset: -30px;
	z-index: -1;
	background: var(--artwork) center / cover;
	filter: blur(28px) brightness(0.55) saturate(1.3);
	content: '';
}
```

[`filter: blur()`](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)를 적용하면 이미지 가장자리까지 흐려져 반투명해진다. 이 부분이 보이지 않도록 의사 요소 `::before`를 사방으로 30px씩 크게 배치하고, 위젯의 `overflow: hidden`과 `border-radius`로 바깥을 클리핑한다. 다른 위젯에는 블러를 적용한 자식 요소가 없다. 날씨 위젯의 배경은 그라데이션이고, 사진 위젯은 이미지를 블러 없이 그대로 사용한다.

## 원인: 별도 합성 레이어와 클리핑

브라우저는 `filter`가 적용된 요소를 별도의 합성 레이어(compositing layer)로 분리해 렌더링한 뒤, GPU에서 다른 레이어와 합성한다. 블러 연산을 GPU에서 처리하기 위해서다. 둥근 모서리 클리핑은 부모인 `.music-widget`에 지정되어 있는데, 이 클리핑이 별도 레이어로 분리된 자식에 전달되지 않으면 자식은 사각형 경계로만 클리핑된다. 그 결과 블러 배경이 둥근 모서리 바깥까지 렌더링되어 모서리가 각져 보인다. 이 증상은 WebKit, 그중에서도 iOS에서 오래전부터 보고된 문제다.

![음악 위젯의 레이어 구조](./images/music-widget-ios-corners-layers.svg '블러 배경 레이어가 둥근 모서리 클리핑을 벗어나 사각형으로 남는다')

macOS Safari도 같은 WebKit 엔진을 사용하지만 결과가 달랐다. 어떤 요소를 별도 레이어로 분리하고 클리핑을 어떻게 적용할지는 기기의 GPU와 메모리 조건에 따라 달라지기 때문이다. E2E 시험에 사용하는 Playwright의 WebKit(헤드리스)에서도 수정 전과 후 모두 모서리가 둥글게 렌더링됐다.

## 해결 방법 비교

| 방법                                                        | 장점                                          | 단점                                                                        |
| ----------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| **`clip-path: inset(0 round …)`로 한 번 더 클리핑 (채택)**  | 선언 한 줄이고, 클리핑 모양이 코드에 드러난다 | 반지름 값(`--radius-window`)을 `border-radius`와 맞춰 둬야 한다             |
| `-webkit-mask-image: -webkit-radial-gradient(white, black)` | 오래 사용된 우회 방법이다                     | 코드만으로는 동작 원리를 알기 어렵다. 벤더 접두사가 붙은 비표준 문법이다    |
| `transform: translateZ(0)` 등으로 부모도 레이어로 분리      | 선언이 짧다                                   | 기기마다 결과가 달라 신뢰하기 어렵다. 레이어가 늘어 메모리를 더 사용한다    |
| CSS 블러 대신 미리 블러 처리한 이미지 사용                  | 클리핑 문제가 생기지 않는다                   | 곡마다 블러 이미지를 별도 생성해야 한다. 관리자가 직접 업로드하는 곡도 있다 |

[`clip-path`](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)는 요소와 자식을 모두 렌더링한 결과를 지정한 모양으로 클리핑한다. 자식이 별도 레이어로 분리되어 있어도 함께 클리핑된다. 반경도 `border-radius`와 같은 변수를 사용하므로 모양이 정확히 일치한다.

```css
.music-widget {
	/* … */
	isolation: isolate;
	/* iPhone Safari는 흐리게 한 배경(::before, filter)을 따로 그려서 overflow·border-radius로 자르지 못한다 (꼭짓점이 각져 보인다).
	   clip-path로 같은 둥근 모양을 한 번 더 자른다 */
	clip-path: inset(0 round var(--radius-window));
}
```

`clip-path`는 요소 바깥으로 렌더링되는 `box-shadow`도 클리핑한다. 음악 위젯의 그림자는 바깥 요소인 `.widget`에 지정되어 있고, `clip-path`는 안쪽 요소인 `.music-widget`에 지정했으므로 그림자는 영향을 받지 않는다.

## 확인 결과

Playwright의 Chromium과 WebKit(아이폰 화면 크기)에서 수정 후에도 모서리와 그림자가 이전과 같게 렌더링되는 것을 확인했다. 휴대폰 E2E 시험 69개도 모두 통과한다.

모바일 E2E 시험은 화면 크기와 터치 입력을 에뮬레이션할 뿐, 기기의 GPU가 레이어를 합성하는 방식까지 재현하지는 않는다. 블러나 `backdrop-filter`처럼 GPU 합성에 의존하는 효과를 사용한 화면은 실제 기기에서 별도로 확인해야 한다.

## 관련 글

- [macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점](/memo/safari-macos-ios-rendering)
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets)
- [셸 공통 CSS 사용자 정의 속성으로 휴대폰 앱의 바탕·카드 색 통일하기](/memo/mobile-apps-ios-style)
- [isRunning 정의와 React key·ref 함수 동일성이 일으킨 음악 앱 버그](/memo/music-player-fixes)
- [배경 이미지 픽셀 샘플링과 대비 계산으로 상태 표시줄 글자색 정하기](/memo/mobile-bars-contrast)

#MacFolio #TIL #프론트엔드 #CSS #Safari #iOS
