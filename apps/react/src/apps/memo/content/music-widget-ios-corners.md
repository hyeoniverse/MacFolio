---
title: iOS Safari의 filter 합성 레이어에서 빠지는 border-radius 클리핑과 clip-path
date: 2026-10-22
category: 개발 기록/MacFolio/화면·스타일
series: 위젯
seriesOrder: 2
summary: 홈 화면의 음악 위젯만 iOS Safari에서 모서리가 각지게 그려졌다. 배경 블러에 쓴 filter가 별도 합성 레이어를 만들면서 부모의 border-radius 클리핑이 적용되지 않은 것이 원인이었다. clip-path로 같은 모양을 한 번 더 잘라 해결했다.
---

휴대폰 홈 화면의 위젯은 모두 모서리가 둥글다. 그런데 실제 아이폰의 Safari에서 열어 보니 음악 위젯만 네 모서리가 각지게 렌더링됐다. 맥북 Safari의 반응형 디자인 모드로 같은 화면 크기를 표시하면 정상이었고, 다른 위젯은 아이폰에서도 둥글게 렌더링됐다. 수정 커밋(`4074204a7`)은 [#330](https://github.com/hyeoniverse/MacFolio/pull/330)에 포함되어 병합됐다.

| 환경                            | 음악 위젯 모서리 |
| ------------------------------- | ---------------- |
| 실제 아이폰 Safari              | 각짐             |
| macOS Safari 반응형 디자인 모드 | 둥긂             |
| Playwright WebKit (헤드리스)    | 둥긂             |
| 다른 위젯 (모든 환경)           | 둥긂             |

![세 조건에서 렌더링한 음악 위젯](./images/music-widget-ios-corners-compare.svg '기대한 모양과 clip-path 추가 후는 네 모서리가 둥글고, 수정 전 아이폰 Safari에서는 블러 배경이 사각형으로 남아 모서리가 각지다')

## 배경

### 둥근 모서리와 클리핑

[`border-radius`](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius)는 요소의 모서리를 둥글게 그리는 속성이다. 이것만으로는 요소 자신의 바탕과 테두리만 둥글어지고, 안쪽 자식이 모서리 밖으로 나가면 그대로 보인다. 자식까지 둥근 모양 안으로 잘라 내려면 [`overflow: hidden`](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)을 함께 지정한다. 이처럼 정해진 모양 바깥을 그리지 않는 처리를 클리핑(clipping)이라고 한다.

| 지정한 속성                             | 요소 바탕 | 모서리 밖으로 나간 자식 |
| --------------------------------------- | --------- | ----------------------- |
| `border-radius: 22px`                   | 둥긂      | 보인다                  |
| `border-radius: 22px; overflow: hidden` | 둥긂      | 둥근 모양으로 잘린다    |

### 합성 레이어

브라우저는 페이지를 그릴 때 일부 요소를 별도의 비트맵(합성 레이어)에 먼저 그리고, 마지막에 GPU에서 레이어들을 겹쳐 최종 화면을 만든다. 이 마지막 단계를 합성(compositing)이라고 한다. 애니메이션하는 요소나 `filter`처럼 그리는 비용이 큰 효과가 있는 요소가 별도 레이어가 되는 대표적인 경우다. 레이어를 나누면 그 요소가 바뀔 때 해당 레이어만 다시 그리면 된다. 어떤 요소를 레이어로 나눌지는 브라우저 엔진이 기기 조건을 보고 결정하며, CSS 명세가 정하지 않는다.

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

[`filter: blur()`](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)를 적용하면 이미지 가장자리까지 흐려져 반투명해진다. 이 부분이 보이지 않도록 의사 요소 `::before`를 사방으로 30px씩 크게 배치하고, 위젯의 `overflow: hidden`과 `border-radius`로 바깥을 클리핑한다. ![블러 배경을 위젯보다 크게 배치하는 이유](./images/music-widget-ios-corners-inset.svg '같은 크기로 배치하면 블러로 투명해진 가장자리가 위젯 안쪽에 비치고, 사방으로 30px 키우면 흐려진 가장자리가 위젯 바깥으로 나가 잘린다')

`blur(28px)`는 각 픽셀을 주변 픽셀과 섞으므로, 이미지 가장자리 픽셀은 바깥의 투명한 영역과 섞여 반투명해진다. 의사 요소를 위젯과 같은 크기로 두면 위젯 안쪽 테두리를 따라 밝은 띠가 생긴다. 30px 키우면 그 띠가 위젯 바깥에 놓이고, 위젯의 클리핑이 그 부분을 잘라 낸다. ==이 설계는 클리핑이 반드시 적용된다는 전제==에 의존한다.

다른 위젯에는 블러를 적용한 자식 요소가 없다. 날씨 위젯의 배경은 그라데이션이고, 사진 위젯은 이미지를 블러 없이 그대로 사용한다.

## 원인: 별도 합성 레이어와 클리핑

브라우저는 `filter`가 적용된 요소를 별도의 합성 레이어(compositing layer)로 분리해 렌더링한 뒤, GPU에서 다른 레이어와 합성한다. 블러 연산을 GPU에서 처리하기 위해서다. 둥근 모서리 클리핑은 부모인 `.music-widget`에 지정되어 있는데, ==이 클리핑이 별도 레이어로 분리된 자식에 전달되지 않으면 자식은 사각형 경계로만 클리핑된다==. 그 결과 블러 배경이 둥근 모서리 바깥까지 렌더링되어 모서리가 각져 보인다. 이 증상은 WebKit, 그중에서도 iOS에서 오래전부터 보고된 문제다.

![음악 위젯의 레이어 구조](./images/music-widget-ios-corners-layers.svg '블러 배경 레이어가 둥근 모서리 클리핑을 벗어나 사각형으로 남는다')

macOS Safari도 같은 WebKit 엔진을 사용하지만 결과가 달랐다. 어떤 요소를 별도 레이어로 분리하고 클리핑을 어떻게 적용할지는 기기의 GPU와 메모리 조건에 따라 달라지기 때문이다. E2E 시험에 사용하는 Playwright의 WebKit(헤드리스)에서도 수정 전과 후 모두 모서리가 둥글게 렌더링됐다.

## 해결 방법 비교

| 방법                                                        | 장점                                          | 단점                                                                        |
| ----------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| **`clip-path: inset(0 round …)`로 한 번 더 클리핑 (채택)**  | 선언 한 줄이고, 클리핑 모양이 코드에 드러난다 | 반지름 값(`--radius-window`)을 `border-radius`와 맞춰 둬야 한다             |
| `-webkit-mask-image: -webkit-radial-gradient(white, black)` | 오래 사용된 우회 방법이다                     | 코드만으로는 동작 원리를 알기 어렵다. 벤더 접두사가 붙은 비표준 문법이다    |
| `transform: translateZ(0)` 등으로 부모도 레이어로 분리      | 선언이 짧다                                   | 기기마다 결과가 달라 신뢰하기 어렵다. 레이어가 늘어 메모리를 더 사용한다    |
| CSS 블러 대신 미리 블러 처리한 이미지 사용                  | 클리핑 문제가 생기지 않는다                   | 곡마다 블러 이미지를 별도 생성해야 한다. 관리자가 직접 업로드하는 곡도 있다 |

[`clip-path`](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)는 요소와 자식을 모두 렌더링한 결과를 지정한 모양으로 클리핑한다. `inset(0 round 22px)`는 "요소 상자에서 사방으로 0만큼 안쪽, 모서리 반경 22px인 사각형"이라는 뜻으로, `border-radius: 22px`와 같은 모양을 만든다. 예를 들어 `inset(10px round 8px)`이면 사방에서 10px씩 안쪽으로 들어간 반경 8px 사각형만 보인다. ==자식이 별도 레이어로 분리되어 있어도 함께 클리핑된다==. 반경도 `border-radius`와 같은 변수를 사용하므로 모양이 정확히 일치한다.

```css
.music-widget {
	/* … */
	isolation: isolate;
	/* iPhone Safari는 흐리게 한 배경(::before, filter)을 따로 그려서 overflow·border-radius로 자르지 못한다 (꼭짓점이 각져 보인다).
	   clip-path로 같은 둥근 모양을 한 번 더 자른다 */
	clip-path: inset(0 round var(--radius-window));
}
```

> [!NOTE] clip-path와 그림자
> `clip-path`는 요소 바깥으로 렌더링되는 `box-shadow`도 클리핑한다. 음악 위젯의 그림자는 바깥 요소인 `.widget`에 지정되어 있고, `clip-path`는 안쪽 요소인 `.music-widget`에 지정했으므로 그림자는 영향을 받지 않는다.

## 확인 결과

Playwright의 Chromium과 WebKit(아이폰 화면 크기)에서 수정 후에도 모서리와 그림자가 이전과 같게 렌더링되는 것을 확인했다. 휴대폰 E2E 시험 69개도 모두 통과한다.

> [!WARNING] 에뮬레이션으로 재현되지 않는 합성
> 모바일 E2E 시험은 화면 크기와 터치 입력을 에뮬레이션할 뿐, 기기의 GPU가 레이어를 합성하는 방식까지 재현하지는 않는다. 블러나 `backdrop-filter`처럼 GPU 합성에 의존하는 효과를 사용한 화면은 실제 기기에서 별도로 확인해야 한다.

## 관련 글

- [macOS Safari와 iOS Safari의 렌더링 차이 — 브라우저별로 주의할 점](/memo/safari-macos-ios-rendering)
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets)
- [셸 공통 CSS 사용자 정의 속성으로 휴대폰 앱의 바탕·카드 색 통일하기](/memo/mobile-apps-ios-style)
- [isRunning 정의와 React key·ref 함수 동일성이 일으킨 음악 앱 버그](/memo/music-player-fixes)
- [배경 이미지 픽셀 샘플링과 대비 계산으로 상태 표시줄 글자색 정하기](/memo/mobile-bars-contrast)

<details>
<summary>참고 문헌</summary>

- [MDN: border-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius)
- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [MDN: filter](https://developer.mozilla.org/en-US/docs/Web/CSS/filter)
- [MDN: clip-path](https://developer.mozilla.org/en-US/docs/Web/CSS/clip-path)
- [MDN: basic-shape inset()](https://developer.mozilla.org/en-US/docs/Web/CSS/basic-shape/inset)
- [MDN: isolation](https://developer.mozilla.org/en-US/docs/Web/CSS/isolation)
- [web.dev: Stick to compositor-only properties and manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)

</details>

#MacFolio #TIL #프론트엔드 #CSS #Safari #iOS
