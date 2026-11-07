---
title: Pointer Events와 FLIP으로 2열 격자 위젯 순서 바꾸기
date: 2026-10-23
category: 개발 기록/MacFolio/인터랙션·브라우저 API
series: 위젯
seriesOrder: 4
summary: 휴대폰 홈 화면 편집 모드에서 위젯을 끌어 순서를 바꾸도록 구현했다. 2열 격자의 배치 규칙을 순수 함수로 정리하고, 끄는 위젯은 translate로, 비켜 주는 위젯은 FLIP으로 움직였다. 처음 구성에서 음악 위젯과 GitHub 잔디의 자리도 맞바꿨다.
---

휴대폰 홈 화면의 위젯 편집 모드(길게 누르기)는 위젯 삭제(−)와 추가(+)만 지원했다. 순서를 바꾸려면 위젯을 삭제하고 원하는 페이지에서 다시 추가해야 했고, 같은 페이지 안의 순서는 추가한 순서로 고정됐다. iOS 홈 화면처럼 위젯을 끌어 순서를 바꾸도록 구현했다([#365](https://github.com/hyeoniverse/MacFolio/pull/365)). 처음 구성도 바꿨다. 음악 위젯을 1쪽, GitHub 잔디를 2쪽에 배치해 첫 화면에서 바로 재생할 수 있다.

![처음 구성 변경 전후](./images/mobile-widget-reorder-default.jpg '왼쪽 둘은 변경 전 1쪽(소개·GitHub 잔디)과 2쪽(날씨·캘린더·음악), 오른쪽 둘은 변경 후 1쪽(소개·음악)과 2쪽(날씨·캘린더·GitHub 잔디). iPhone 13 크기, 잔디는 E2E의 가짜 API 자료')

![편집 모드에서 위젯 끌기](./images/mobile-widget-reorder-drag.jpg '왼쪽부터 변경 전 편집 모드(삭제·추가만 가능), 음악 위젯을 소개 위젯 위로 끄는 중(소개 위젯이 아래로 이동), 놓은 뒤, 2쪽에서 날씨 위젯을 캘린더 자리로 끄는 중')

## 배경

### 홈 화면 위젯

![iOS 14 홈 화면. 시계·카메라 같은 앱 아이콘 사이에 활동, 사진, 음악 위젯이 아이콘 네 개 크기의 정사각형으로 놓여 있다](./images/mobile-widget-reorder-apple-ios14-widgets.jpg#float-right 'iOS 14 홈 화면(Apple Newsroom). 위젯은 앱 아이콘과 같은 격자에 놓이고, 크기는 아이콘 칸 수로 정해진다')

위젯(widget)은 앱을 열지 않고 홈 화면에서 날씨, 일정, 재생 중인 곡 같은 정보를 바로 보여 주는 작은 카드다. iOS는 2020년 iOS 14부터 홈 화면에 위젯을 놓을 수 있게 했다. 위젯은 앱 아이콘과 같은 격자에 맞춰 놓이고, 크기는 작게(아이콘 2×2칸), 중간(4×2칸), 크게(4×4칸) 같은 정해진 단위로만 고른다.

iOS에서 홈 화면을 길게 누르면 아이콘과 위젯이 흔들리는 편집 모드가 켜진다. 이 상태에서 위젯을 끌면 손가락 아래의 위젯이 따라오고, 주변 위젯과 아이콘이 빈자리를 채우도록 비켜 준다. MacFolio의 휴대폰 화면은 이 동작을 옮긴다. 이 사이트의 위젯 영역은 2열 격자이고, 작은 위젯은 한 칸, 중간 위젯은 한 줄(두 칸)을 차지한다. 한 페이지에는 위젯을 세 줄까지 놓는다.

### Pointer Events

[Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)는 마우스, 손가락 터치, 펜 입력을 하나의 이벤트 모델로 다루는 웹 표준이다. 예전에는 마우스는 `mousedown`·`mousemove`, 터치는 `touchstart`·`touchmove`처럼 입력 장치마다 처리기를 따로 등록해야 했다. Pointer Events를 쓰면 입력 장치와 관계없이 다음 네 이벤트로 끌기를 구현한다.

| 이벤트          | 발생 시각                                                     | 예                                       |
| --------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `pointerdown`   | 손가락이 화면에 닿거나 마우스 버튼을 누른 시각                | 음악 위젯 위에 손가락을 댄다             |
| `pointermove`   | 누른 채 움직일 때마다                                         | 손가락을 아래로 30px 옮긴다              |
| `pointerup`     | 손가락을 떼거나 버튼을 놓은 시각                              | 소개 위젯 자리에서 손가락을 뗀다         |
| `pointercancel` | 브라우저가 입력을 가져가 페이지가 더 이상 받지 못하게 된 시각 | 브라우저가 세로 이동을 스크롤로 처리한다 |

### CSS 격자의 자동 배치

[CSS Grid](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout)는 요소를 행과 열로 나눈 칸에 배치하는 레이아웃 방식이다. 요소마다 몇 번째 칸에 놓을지 지정하지 않으면 브라우저가 문서(DOM) 순서대로 빈 칸을 찾아 배치하는데, 이 규칙을 자동 배치(auto-placement)라고 한다. 이 사이트의 위젯 저장 형식은 페이지마다 위젯 배열이고 좌표는 없으므로, 배열의 순서와 자동 배치 규칙만으로 화면의 자리가 정해진다.

### FLIP

레이아웃이 바뀌어 요소의 자리가 달라지면 브라우저는 새 자리에 바로 그린다. `left`·`top`이나 격자 칸 번호의 변화는 CSS 전환(transition)으로 부드럽게 이어지지 않는다. [FLIP](https://aerotwist.com/blog/flip-your-animations/)은 Paul Lewis가 정리한 기법으로, 레이아웃은 한 번에 바꾸고 화면에서만 움직임을 보여 준다. 이름은 네 단계의 머리글자다.

1. **First**: 바뀌기 전 위치를 기록한다.
2. **Last**: 레이아웃을 바꾼 뒤 새 위치를 측정한다.
3. **Invert**: 두 위치의 차이만큼 `transform`이나 `translate`로 요소를 옛 자리에 되돌려 그린다.
4. **Play**: 그 차이를 0까지 줄이는 애니메이션을 재생한다.

![FLIP 네 단계. 소개 위젯이 한 줄(133px) 아래로 바뀔 때 Invert 단계에서 translate 0 −133px로 옛 자리에 그리고, Play 단계에서 0.24초 동안 0으로 줄인다](./images/mobile-widget-reorder-flip.svg '비켜 주는 위젯의 FLIP. 레이아웃은 한 번에 바뀌고, 화면에서는 옛 자리에서 새 자리로 미끄러져 내려온다')

## 동작

| 조작                                   | 결과                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| 편집 중 위젯을 누르고 움직이기         | 위젯이 1.06배로 커지며 포인터를 따라오고, 놓을 순서가 바뀌면 다른 위젯이 새 자리로 이동 |
| 편집 전 위젯을 0.55초 누른 뒤 움직이기 | 편집 모드가 켜지고, 손을 떼지 않은 채 바로 끌기 시작 (iOS와 같다)                       |
| 놓기                                   | 위젯이 칸에 붙고 순서를 `macfolio:mobile:widgets`에 저장                                |
| 화면 왼쪽·오른쪽 끝에 0.6초 머물기     | 옆 페이지로 넘어가 그 페이지 끝에 배치. 자리가 없는 페이지는 건너뛰지 않고 멈춘다       |
| 편집 중 위젯 밖에서 옆으로 쓸기        | 기존처럼 페이지 넘기기                                                                  |
| 키보드: '위젯 옮기기' 버튼에 초점      | ← ↑는 앞으로, → ↓는 뒤로 한 칸. 페이지 끝이면 옆 페이지로. 결과를 `aria-live`로 안내    |

키보드 이동의 안내는 [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live) 영역으로 전달한다. 화면 읽기 프로그램은 이 영역의 글자가 바뀔 때마다 읽어 주므로, 음악 위젯을 한 칸 옮기면 "음악 위젯을 1쪽 2번째로 옮겼습니다"처럼 결과를 소리로 알 수 있다.

시스템의 움직임 줄이기([`prefers-reduced-motion`](https://developer.mozilla.org/ko/docs/Web/CSS/@media/prefers-reduced-motion))가 켜져 있으면 흔들림, 확대, 비켜 주는 애니메이션을 모두 생략한다. 이 설정은 iOS의 '손쉬운 사용 › 동작 › 동작 줄이기'나 macOS의 '손쉬운 사용 › 디스플레이 › 동작 줄이기'를 켜면 웹 페이지에도 전달된다. 끄는 위젯은 그대로 포인터를 따라온다.

## 2열 격자의 배치 규칙

끌기를 구현하기 전에 확인해 보니 ==순서와 화면의 자리가 항상 일치하지는 않았다==. CSS 격자의 기본 자동 배치(`grid-auto-flow: row`)는 배치 위치(커서)를 앞으로만 옮기고, 지나간 빈 칸으로 돌아가지 않는다. 그래서 `[작게, 중간, 작게]`는 첫 줄 오른쪽 칸을 비운 채 세 줄을 차지한다. 반면 페이지에 위젯을 더 놓을 수 있는지 계산하는 `widgetRows`는 "작은 위젯 둘이 한 줄"로 계산해 두 줄로 판단했다. 위젯 추가 순서에 따라 화면과 계산이 어긋날 수 있었다.

![sparse와 dense 배치](./images/mobile-widget-reorder-grid.svg '같은 순서를 sparse와 dense로 배치한 결과. dense는 뒤의 작은 위젯이 앞의 빈 칸을 채운다')

[`grid-auto-flow: row dense`](https://developer.mozilla.org/ko/docs/Web/CSS/grid-auto-flow)로 바꾸면 브라우저는 요소마다 격자의 처음부터 다시 빈 칸을 찾는다. 위 예에서 마지막 작은 위젯 C가 첫 줄 빈 칸에 들어가 두 줄이 되고, `widgetRows`와 일치한다.

> [!WARNING] dense 배치와 DOM 순서
> dense 배치에서는 DOM 순서와 화면 순서가 달라진다. 위 예의 DOM 순서는 A, B, C이지만 화면에서는 A, C, B 순서로 보인다. 화면 읽기 프로그램과 Tab 키 초점은 DOM 순서를 따르므로, 저장할 때마다 순서를 화면 순서로 정규화한다(`normalizeOrder`). 정규화한 순서 `[A, C, B]`는 sparse와 dense 어느 쪽으로 배치해도 같은 자리에 놓인다.

배치 규칙은 React와 DOM에 의존하지 않는 순수 함수로 분리했다(`desktop/mobile/widgetOrder.ts`). 순수 함수는 같은 입력에 항상 같은 결과를 돌려주고 화면을 건드리지 않으므로, 브라우저 없이 단위 시험으로 확인할 수 있다.

| 함수             | 역할                                                                     | 예                                               |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------ |
| `packWidgets`    | 순서대로 위 줄부터 빈 칸을 찾는다. dense 배치와 같은 결과                | `[작게, 중간, 작게]` → 칸 (0,0), (1,0), (0,1)    |
| `normalizeOrder` | 배치 결과를 위 줄, 왼쪽 칸 순으로 정렬                                   | `[A 작게, B 중간, C 작게]` → `[A, C, B]`         |
| `orderForDrop`   | 끄는 위젯을 놓을 순서 계산                                               | 아래 "놓을 자리 계산" 참고                       |
| `moveByKey`      | 키보드로 한 칸 이동. 화면의 자리가 실제로 바뀌는 가장 가까운 순서를 선택 | 화면이 그대로인 순서는 건너뛰고 다음 후보로 간다 |
| `canMoveTo`      | 다른 페이지에 세 줄 제한 안에서 놓을 수 있는지                           | 이미 세 줄인 페이지에 중간 위젯 → `false`        |

`packWidgets` 예의 칸은 (줄, 열) 순서다. 중간 위젯은 빈 줄에만 들어가므로 둘째 줄 (1, 0)부터 두 칸을 쓰고, 마지막 작은 위젯은 첫 줄의 빈 칸 (0, 1)을 채운다.

## 놓을 자리 계산

`orderForDrop`은 끄는 위젯을 나머지 위젯 사이의 모든 위치(0번째부터 n번째)에 넣어 본다. 후보마다 배치를 계산하고, 그 배치에서 끄는 위젯의 가운데가 실제로 끌고 있는 위젯의 가운데와 가장 가까운 순서를 선택한다. 좌표는 픽셀이 아니라 칸 단위(작은 위젯 한 칸이 1)로 변환해 화면 크기와 무관하게 계산한다. 예를 들어 iPhone 13과 Pixel 7은 위젯 크기가 다르지만, 두 기기 모두 첫 줄 오른쪽 칸의 가운데는 (1.5, 0.5)다.

이 방식에서는 ==격자 규칙이 자동으로 지켜진다==. `[작게 A, 작게 B, 중간 C]`에서 A를 중간 위젯 아래로 끌어도, A를 C 뒤에 넣은 후보 `[B, C, A]`는 dense 배치로 첫 줄 빈 칸에 다시 올라가 `[B, A, C]`와 같은 자리가 된다. 작은 위젯이 혼자 아래 줄로 내려가 위에 빈 칸을 남기는 순서는 후보에 존재하지 않는다.

두 후보의 거리가 비슷한 경계에서는 포인터가 1px만 움직여도 순서가 오가며 다른 위젯이 흔들린다. 지금 순서보다 0.15칸(`HYSTERESIS`) 이상 가까운 후보가 있을 때만 순서를 바꾸는 히스테리시스(hysteresis)를 적용했다. 히스테리시스는 상태를 바꾸는 기준값을 방향에 따라 다르게 두어, 기준값 근처에서 상태가 계속 뒤바뀌지 않게 하는 방법이다.

![A를 오른쪽으로 끌 때 A의 가운데 x가 1.075를 넘으면 후보 2로 바뀌고, 왼쪽으로 돌아올 때는 0.925보다 작아져야 후보 1로 돌아온다](./images/mobile-widget-reorder-hysteresis.svg '두 후보의 가운데 사이(0.5와 1.5)의 중간인 1.0을 기준으로 앞뒤 0.075칸씩 여유를 둔다')

위 그림의 기준값은 다음 식에서 나온다. 지금 순서가 후보 1일 때 후보 2로 바뀌려면 후보 2까지의 거리가 후보 1까지의 거리보다 0.15 이상 작아야 한다.

```math
|1.5 - x| < |x - 0.5| - 0.15 \;\Rightarrow\; 1.5 - x < x - 0.65 \;\Rightarrow\; x > 1.075
```

반대로 후보 2에서 후보 1로 돌아오는 기준은 같은 계산으로 `x < 0.925{:math}`다. 그래서 A의 가운데가 0.925와 1.075 사이에 있는 동안에는 손가락이 조금 떨려도 B가 움직이지 않는다.

## 포인터 이벤트와 다른 제스처

홈 화면은 이미 Pointer Events로 페이지 넘기기와 길게 누르기를 처리한다(`MobileHome`의 `.mobile-pages`). 위젯 끌기도 같은 핸들러에서 제스처를 판정한다.

![pointerdown 뒤 편집 중이면 바로, 편집 전이면 0.55초 뒤 끌 수 있는 상태가 되고, 8px 이상 움직이면 위젯 끌기, 페이지 넘기기, 제어 센터 가운데 하나로 판정한다](./images/mobile-widget-reorder-gesture.svg '한 번의 손가락 입력이 세 제스처 가운데 하나로 정해지는 순서')

1. `pointerdown`: 위젯 칸 위인지 기록한다. 편집 중이면 바로 끌 수 있는 상태가 된다.
2. 길게 누르기 타이머(0.55초)가 끝나면 편집 모드를 켜고, 누른 곳이 위젯이면 끌 수 있는 상태로 바꾼다.
3. `pointermove`에서 8px 이상 움직이면 판정한다. 끌 수 있는 위젯이면 방향과 관계없이 위젯 끌기, 아니면 기존처럼 가로는 페이지 넘기기, 세로는 제어 센터에 넘긴다. 위젯 끌기로 판정하면 [`setPointerCapture`](https://developer.mozilla.org/ko/docs/Web/API/Element/setPointerCapture)로 이후 이벤트를 받는다.
4. `pointerup`이면 저장하고, `pointercancel`이면 원래 순서로 되돌린다.

`setPointerCapture`는 포인터 이벤트의 대상을 특정 요소로 고정하는 메서드다. 호출하지 않으면 손가락이 위젯 영역 밖(예: 화면 가장자리의 상태 표시줄 위)으로 나간 순간부터 `pointermove`가 다른 요소로 전달된다. 고정하면 손가락이 어디에 있든 같은 요소가 `pointerup`까지 받는다.

8px 기준은 손가락의 미세한 떨림을 끌기로 오인하지 않기 위한 값이다. 손가락으로 누르기만 해도 접촉 위치는 몇 픽셀씩 흔들리므로, 1px만 움직여도 끌기로 판정하면 위젯을 누르는 동작과 구분할 수 없다.

손가락 입력에서는 세 가지 충돌을 처리했다.

| 충돌                | 원인                                                                                                                                                                                                | 처리                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 브라우저 스크롤     | `.mobile-pages`는 세로 쓸기를 브라우저에 넘기려고 [`touch-action: pan-y`](https://developer.mozilla.org/ko/docs/Web/CSS/touch-action)다. 브라우저가 세로 이동을 가져가면 `pointercancel`이 발생한다 | 편집 중의 위젯 칸은 `touch-action: none`. `touch-action`은 손가락을 댄 시각의 값이 적용되므로, 길게 눌러 편집이 켜진 손가락은 `touchmove`를 `passive: false`로 등록해 `preventDefault()` |
| 제어 센터           | 화면 어디서든 세로로 쓸면 제어 센터가 열린다(`useVerticalSwipe`). 시작 시각에 `[data-swipe-ignore]` 안이면 무시하는데, 길게 눌러 편집이 켜진 손가락은 시작 시각에 이 속성이 없었다                  | 쓸기로 판정하는 시각에 대상을 한 번 더 확인                                                                                                                                              |
| 위젯 안의 조작 요소 | 음악 위젯의 재생 위치 막대는 스스로 끄는 요소라 홈 화면 제스처에서 제외되어 있다                                                                                                                    | 편집 중에는 막대에 `pointer-events: none`을 적용해 그 자리를 눌러도 위젯을 끌 수 있게 했다. 재생 버튼 같은 버튼은 움직이지 않고 누르면 그대로 동작한다                                   |

`touch-action`은 터치 입력 가운데 어떤 동작을 브라우저가 직접 처리할지 지정하는 CSS 속성이다. `pan-y`는 "세로 이동은 브라우저가 스크롤로 처리한다", `none`은 "브라우저는 아무것도 처리하지 않고 모두 페이지 코드에 넘긴다"는 뜻이다. `passive: false`는 처리기가 `preventDefault()`로 브라우저의 기본 동작(스크롤)을 막을 수 있다고 브라우저에 알리는 옵션이다. 브라우저는 스크롤 성능을 위해 터치 처리기를 기본적으로 `passive`로 취급하므로, 막으려면 이 옵션을 명시해야 한다.

## 끄는 위젯과 비켜 주는 위젯

편집 중의 위젯은 `transform: rotate()` 키프레임으로 흔들린다. 같은 `transform`에 이동을 인라인으로 지정하면 CSS 애니메이션이 덮어쓴다[^cascade]. 예를 들어 `style="transform: translate(0, 40px)"`을 넣어도 흔들림 애니메이션이 매 프레임 `transform: rotate(-0.8deg)` 같은 값으로 덮어써 위젯이 제자리에서 흔들리기만 한다. 그래서 이동은 개별 변형 속성인 [`translate`](https://developer.mozilla.org/ko/docs/Web/CSS/translate)와 [`scale`](https://developer.mozilla.org/ko/docs/Web/CSS/scale)로 처리했다. 두 속성은 `transform`과 따로 합성되므로 ==흔들림과 충돌하지 않는다==.

| 위젯           | 처리                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 끄는 위젯      | 흔들림을 멈추고 `scale: 1.06`과 그림자를 적용한다. 매 프레임(`requestAnimationFrame`) 위젯의 레이아웃 위치(`offsetLeft`·`offsetTop`, 변형의 영향을 받지 않는다)를 다시 측정하고, 포인터와의 차이를 `translate`로 지정한다       |
| 비켜 주는 위젯 | FLIP. 렌더링 후(`useLayoutEffect`) 위젯마다 지난 위치와 새 위치의 차이를 계산하고, [Web Animations API](https://developer.mozilla.org/ko/docs/Web/API/Web_Animations_API)로 `translate`를 차이만큼에서 0까지 0.24초 동안 줄인다 |
| 놓을 때        | 인라인 `translate`를 지우고, 직전 값에서 0까지 같은 애니메이션을 재생해 칸에 붙는다                                                                                                                                             |

끄는 위젯이 매 프레임 레이아웃 위치를 다시 측정하는 이유는 순서가 바뀌면 그 위젯의 칸도 바뀌기 때문이다. 예를 들어 음악 위젯을 소개 위젯 위로 끌어 순서가 바뀌면 음악 위젯의 레이아웃 자리가 한 줄 위로 올라간다. 측정값을 갱신하지 않으면 `translate`가 옛 칸 기준이라 위젯이 손가락에서 한 줄만큼 떨어진다. 옆 페이지로 넘어가 페이지 트랙이 움직이는 중에도 같은 계산으로 위젯이 포인터 아래에 남는다.

`useLayoutEffect`는 React가 DOM을 바꾼 직후, 브라우저가 화면에 그리기 전에 실행되는 훅이다. 이 시점에 새 위치를 측정하고 애니메이션을 시작하므로, 위젯이 새 자리에 한 프레임 나타났다가 옛 자리로 튀는 깜박임이 생기지 않는다.

## 다른 페이지로 옮기면 위젯이 작아지던 문제

위젯을 옆 페이지로 옮겨 그 페이지가 세 줄이 되면 모든 페이지의 위젯이 작아졌다. 페이지를 넘길 때마다 크기가 바뀌는 것처럼 보였다.

![위젯 크기 변경 전후](./images/mobile-widget-reorder-size.jpg 'iPhone 13 크기. 2쪽이 세 줄(날씨·캘린더, GitHub 잔디, 음악)인 구성. 수정 전에는 위젯 줄 높이가 117px에서 112px로 줄고 2쪽 아이콘 줄이 잘렸다. 수정 후에는 117px 그대로이고 2쪽에 들어가지 않는 앱은 다음 페이지로 간다')

원인은 위젯 줄 높이 계산(`homePages.ts`의 `widgetRowHeight`)이다. 위젯 아래에 아이콘 두 줄이 들어가도록 줄 높이를 줄이는데, ==기준이 "위젯 줄 수가 가장 많은 페이지"였다==. 2쪽이 세 줄이 되면 1·3쪽까지 세 줄 기준으로 줄었다. 끌기 이전에도 갤러리에서 위젯을 추가해 세 줄을 만들면 같은 현상이 있었고, 끌기로 페이지를 옮길 수 있게 되면서 쉽게 재현됐다.

| 상황 (Playwright 측정)       | iPhone 13 줄 높이   | Pixel 7 줄 높이     | 아이콘 |
| ---------------------------- | ------------------- | ------------------- | ------ |
| 처음 구성 (모든 페이지 2줄)  | 117px               | 161.5px             | 60px   |
| 수정 전: 2쪽을 3줄로 만든 뒤 | 112px (모든 페이지) | 131px (모든 페이지) | 60px   |
| 수정 후: 2쪽을 3줄로 만든 뒤 | 117px               | 161.5px             | 60px   |

iOS처럼 위젯 크기를 위젯 구성과 무관하게 화면 크기로만 정하도록 바꿨다. 정사각형을 기본으로, 다음 두 조건 가운데 작은 값으로 줄인다.

1. 위젯 두 줄 아래에 아이콘 두 줄이 들어간다.
2. 위젯 세 줄이 한 페이지에 들어간다.

세 줄인 페이지는 위젯 아래 남는 높이만큼만 아이콘을 두고, 한 줄도 들어가지 않으면 그 페이지에는 앱을 두지 않는다(`iconRowsBelow`, `pageApps`의 0칸 허용). 이전에는 최소 한 줄을 강제해 아이콘 이름이 잘렸다. 앱 아이콘은 원래 60px 고정이라 측정값은 변하지 않았다.

## 데스크톱 위젯과 코드를 공유하지 않은 이유

바탕화면 위젯도 끌어 옮길 수 있다([180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets)). 하지만 두 화면은 배치 모델이 다르다.

| 항목                | 바탕화면 (`desktop/widgets/layout.ts`)     | 휴대폰 (`desktop/mobile/widgetOrder.ts`) |
| ------------------- | ------------------------------------------ | ---------------------------------------- |
| 저장                | 위젯마다 칸 좌표 `col`·`row`               | 페이지마다 순서 배열                     |
| 빈 칸               | 허용 (아무 칸에나 배치)                    | 허용하지 않음 (앞에서부터 채운다)        |
| 다른 위젯 위에 놓기 | 원래 자리로 복귀 (macOS처럼 밀어내지 않음) | 다른 위젯이 비켜 준다 (iOS)              |

macOS와 iOS의 동작 차이를 그대로 따랐기 때문에 자리 계산 함수는 따로 두었다. 예를 들어 바탕화면에서 날씨 위젯을 캘린더 위젯 위에 놓으면 날씨 위젯이 원래 칸으로 돌아가지만, 휴대폰에서 같은 조작을 하면 캘린더 위젯이 옆 칸으로 비켜 준다. 움직임 줄이기 판단(`prefersReducedMotion`), 위젯 카탈로그와 줄 수 계산(`widgetRows`·`fitsOnPage`)은 같이 쓴다.

## 처음 구성 변경과 저장된 구성

처음 구성은 `DEFAULT_MOBILE_WIDGETS`이고, 방문자의 구성은 브라우저의 `localStorage`에 저장한다. 그런데 위젯을 옮기거나 빼지 않은 방문자도 구성이 저장되어 있을 수 있다. 사진 위젯의 앨범이나 메모 위젯의 글 보기를 바꾸면 처음 구성 전체가 저장되기 때문이다. 이 방문자에게는 처음 구성을 바꿔도 반영되지 않는다.

<details>
<summary>저장된 구성 처리 방식</summary>

| 저장된 구성                                                    | 처리                                                 | 이유                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| 없음                                                           | 새 처음 구성                                         | 방문자가 아무것도 바꾸지 않았다                       |
| 예전 처음 구성 두 가지 중 하나와 id·종류·크기·순서가 모두 같음 | 새 처음 구성. 앨범·글 보기는 같은 id의 위젯에 옮긴다 | 방문자가 고른 배치가 아니라 고른 값 저장의 부산물이다 |
| 그 밖 (빼거나 더하거나 크기를 바꿈)                            | 그대로 사용                                          | 방문자가 직접 바꾼 구성이다                           |

비교 대상은 이전 처음 구성(`92e281ccc`)과 편집 기능을 처음 만든 시각의 구성(`f11e3058d`) 두 가지다. 저장 형식은 바꾸지 않았으므로, 배포를 되돌려도 이전 코드가 같은 값을 그대로 읽는다. 방문자가 끌기로 예전 처음 구성과 정확히 같은 배치를 직접 만들면 다음 방문에 새 처음 구성으로 바뀐다. 위젯 8개의 순서가 모두 일치해야 하므로 이 경우는 무시했다.

</details>

## 시험

- **단위 시험:** `widgetOrder.test.ts`에서 dense 배치, `widgetRows`와의 일치, 정규화, 놓을 순서와 히스테리시스, 다른 페이지 이동 가능 여부, 키보드 이동을 확인한다. `catalog.test.ts`에서 처음 구성과 예전 구성 변환을 확인한다.
- **E2E:** `mobile-iphone`·`mobile-android` 프로젝트에서 마우스로 끌어 순서 변경과 새로고침 후 유지, Chrome DevTools Protocol의 터치 이벤트로 길게 누른 뒤 바로 아래로 끌기(제어 센터가 열리지 않는지 포함), 편집 중 페이지 넘기기, 가장자리에서 옆 페이지로 이동, 키보드 이동을 확인한다. 기존 삭제·추가 시험은 새 처음 구성에 맞게 고쳤다.

Playwright의 마우스 입력은 `pointerType`이 `mouse`라 `touch-action`이나 `touchmove`의 영향을 받지 않는다. 손가락에서만 생기는 `pointercancel`과 제어 센터 충돌은 Chrome DevTools Protocol의 `Input.dispatchTouchEvent`로 실제 터치 이벤트를 보내 재현했다.

## 관련 글

- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 위젯 종류, 데스크톱 칸 격자, 휴대폰 편집 모드
- [칸 단위 좌표와 포인터 캡처로 구현한 바탕화면 아이콘 선택과 끌기](/memo/desktop-icons): 데스크톱에서 칸에 맞춰 끄는 방식
- [ref 정리 함수에서 제거 직전 DOM을 복제해 만드는 퇴장 애니메이션](/memo/global-motion): 이 사이트의 애니메이션과 움직임 줄이기 처리

[^cascade]: CSS 캐스케이드에서 애니메이션 값은 일반 선언(인라인 스타일 포함)보다 우선한다. [MDN의 캐스케이드 설명](https://developer.mozilla.org/ko/docs/Web/CSS/Cascade) 참고.

<details>
<summary>참고 문헌</summary>

- MDN, [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- MDN, [Element.setPointerCapture()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- MDN, [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action)
- MDN, [EventTarget.addEventListener(): passive](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive)
- MDN, [CSS grid layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout), [grid-auto-flow](https://developer.mozilla.org/en-US/docs/Web/CSS/grid-auto-flow)
- MDN, [translate](https://developer.mozilla.org/en-US/docs/Web/CSS/translate), [scale](https://developer.mozilla.org/en-US/docs/Web/CSS/scale)
- MDN, [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- MDN, [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- MDN, [aria-live](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live)
- React, [useLayoutEffect](https://react.dev/reference/react/useLayoutEffect)
- Paul Lewis, [FLIP Your Animations](https://aerotwist.com/blog/flip-your-animations/)
- Apple, [Human Interface Guidelines: Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets)

</details>

<details>
<summary>사진 출처</summary>

- iOS 14 홈 화면과 위젯: Apple Newsroom, [Apple reimagines the iPhone experience with iOS 14](https://www.apple.com/newsroom/2020/06/apple-reimagines-the-iphone-experience-with-ios-14/) (2020-06-22), 원본 [Apple_ios14-widgets-redesigned_06222020_inline.jpg](https://www.apple.com/newsroom/images/product/os/ios/standard/Apple_ios14-widgets-redesigned_06222020_inline.jpg.large.jpg), 출처 표기

</details>

#MacFolio #위젯 #React #PointerEvents #애니메이션
