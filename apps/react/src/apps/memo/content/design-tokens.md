---
title: z-index·모서리 반경·글자 크기·그림자·간격·색 값을 CSS 변수 디자인 토큰으로 바꾸기
date: 2026-10-18
category: 개발 기록/MacFolio/화면·스타일
series: 디자인 토큰
seriesOrder: 1
summary: z-index·border-radius·font-size·간격·그림자·색을 숫자와 hex로 적은 2,754곳을 theme.css의 --z-*·--radius-*·--text-*·--space-*·--shadow-*·--color-* 토큰으로 바꿨다. 값은 그대로 두고 diff 집계와 계산된 스타일 비교로 화면 변화가 없음을 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 5단계(스타일)에서 "반복되는 숫자를 theme.css의 이름으로" 작업을 토큰 종류마다 PR 하나씩 진행했다. z-index([#231](https://github.com/hyeoniverse/MacFolio/pull/231)), 모서리 반경([#232](https://github.com/hyeoniverse/MacFolio/pull/232)), 글자 크기([#234](https://github.com/hyeoniverse/MacFolio/pull/234)), 그림자와 간격([#248](https://github.com/hyeoniverse/MacFolio/pull/248)), 색([#249](https://github.com/hyeoniverse/MacFolio/pull/249)) 순서다.

## 배경: 디자인 토큰과 CSS 변수

디자인 토큰[^token]은 색·간격·글자 크기처럼 디자인에서 반복되는 값에 용도를 나타내는 이름을 붙여 한 곳에서 관리하는 방식이다. 이 사이트에서는 `styles/theme.css`의 [CSS 사용자 지정 속성](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)[^custom]으로 정의한다.

예를 들어 버튼 모서리 반경 8px이 CSS 파일 마흔두 곳에 숫자로 적혀 있으면, 반경을 7px로 바꾸려면 마흔두 곳을 모두 찾아 고쳐야 한다. 그중 어느 8px이 "버튼"이고 어느 8px이 우연히 같은 값인지도 숫자만으로는 알 수 없다. 이름을 붙이면 정의는 한 곳, 사용처는 이름 참조가 된다.

```css
/* 정의: theme.css */
:root {
	--radius-md: 8px;
}

/* 사용: 앱 CSS */
.memo-search {
	border-radius: var(--radius-md); /* 전: border-radius: 8px; */
}
```

브라우저는 화면을 그리기 전에 `var(--radius-md)`를 `8px`로 바꿔 계산한다. 그래서 개발자 도구나 [`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)로 읽는 계산된 값은 교체 전과 똑같이 `8px`이다. 이 성질 때문에 교체 전후의 계산된 값을 비교해 화면이 바뀌지 않았음을 확인할 수 있다.

![토큰 정의, var() 참조, 계산된 값의 관계](./images/design-tokens-var-flow.svg '정의는 theme.css 한 곳, 사용처는 var() 참조, 계산된 값은 숫자. 다크 모드는 변수 값만 바꾼다')

## 토큰 체계

| 종류        | 변수 접두사  | 값 수                                            | 기준                                                                          |
| ----------- | ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| z-index 층  | `--z-*`      | 15                                               | 화면 전체에서 겹치는 값만 (앱 내부의 1~10 제외). 낮은 층부터 순서대로         |
| 모서리 반경 | `--radius-*` | 6                                                | 자주 쓰는 단일 값 (원 `50%` 제외)                                             |
| 글자 크기   | `--text-*`   | 8                                                | 자주 쓰는 값에 Apple HIG 글자 스타일 이름                                     |
| 간격        | `--space-*`  | 10                                               | 2~24px의 열 값. 선언의 값이 모두 열 값인 경우만 교체                          |
| 그림자      | `--shadow-*` | 5                                                | 세 곳 이상 반복된 값                                                          |
| 색          | `--color-*`  | 테마 무관 11, 라이트·다크 쌍 (코드 강조 색 포함) | 교체 후 계산된 색이 같은 경우만. 쌍은 라이트·다크 선언이 모두 일치하는 경우만 |

| 토큰        | PR                                                       | 교체한 곳 | 변경 파일·줄                                 |
| ----------- | -------------------------------------------------------- | --------- | -------------------------------------------- |
| z-index     | [#231](https://github.com/hyeoniverse/MacFolio/pull/231) | 20        | CSS 14개                                     |
| 모서리 반경 | [#232](https://github.com/hyeoniverse/MacFolio/pull/232) | 239       | 36개 파일, +302/−239                         |
| 글자 크기   | [#234](https://github.com/hyeoniverse/MacFolio/pull/234) | 645       | 47개 파일, +712/−645                         |
| 간격·그림자 | [#248](https://github.com/hyeoniverse/MacFolio/pull/248) | 1,543·19  | 70개 파일, +1,656/−1,576                     |
| 색          | [#249](https://github.com/hyeoniverse/MacFolio/pull/249) | 288       | 49개 파일, +427/−286 (`theme.css` 51줄 추가) |

## 값은 그대로, 이름만 붙인다

다섯 PR 모두 같은 규칙을 따랐다.

> [!IMPORTANT] 다섯 PR의 공통 규칙
> **값을 바꾸지 않고 같은 값만 이름으로 교체한다.** 이름 붙이기와 값 변경(예: z-index를 100 간격으로 다시 매기기, 간격을 4px 격자로 맞추기)을 한 PR에 섞으면 렌더링 결과가 같은지 diff로 확인할 수 없다.

| 방법                                                | 장점                                                                     | 단점                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 숫자를 그대로 두고 주석만 추가                      | 변경량이 거의 없다                                                       | 값을 바꿔도 주석은 갱신되지 않고, 전체 목록은 한 곳에서 보이지 않는다   |
| 값을 하나로 통합 (버튼은 모두 8px, 간격은 4px 격자) | 체계가 단순해진다                                                        | 수백 곳이 1~2px씩 이동한다. 앱마다 맞춘 모양이 깨진다                   |
| TypeScript 상수로 모아 인라인 스타일                | 타입 검사로 오타를 검출한다                                              | 대부분의 값은 CSS 파일에 있다. 스타일을 TS로 옮겨야 한다                |
| Sass 변수나 Tailwind 설정                           | 빌드 시각에 값이 치환된다                                                | 이 저장소는 Sass도 Tailwind도 쓰지 않는다                               |
| **CSS 변수로 이름만 붙이고 같은 값만 교체 (채택)**  | 화면이 그대로다. 개발자 도구에서 값이 보인다. 자동 비교로 검증할 수 있다 | 변수 이름 오타는 CSS가 오류 없이 무시한다. 숫자를 쓰는 것을 막지 못한다 |

검증은 두 가지 방법을 썼다.

1. **diff 집계.** 삭제한 줄 수가 교체한 위치 수와 같은지, 숫자로 쓴 곳이 줄어든 만큼 `var(--…)`가 늘었는지 확인한다.
2. **계산된 스타일 비교.** 교체 전후의 빌드를 각각 실행해 데스크톱과 iPhone 크기, 라이트와 다크 모드에서 모든 요소의 [계산된 스타일](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)을 비교한다. `var()`는 계산된 값에서 원래 숫자로 치환되므로 값이 같으면 차이가 0이다.

## z-index 층: 흩어진 숫자를 `--z-*` 변수로 모으기 (#231)

새 팝업을 추가할 때마다 Dock 위에 표시하려면 z-index를 얼마로 지정해야 하는지 확인해야 했다. 그러려면 `Dock.css`, `StatusBar.css`, `Menu.css`, `LoadingScreen.css`를 차례로 열어 숫자를 비교해야 했다.

MacFolio의 데스크톱 화면은 겹치는 계층이 많다. 바탕화면 위에 창이 있고, 그 위에 Dock과 메뉴 막대가, 다시 그 위에 펼친 메뉴, 알림, 로딩 화면, 로그인 화면이 놓인다. 휴대폰 화면에는 상태 막대, 제어 센터, 앱 전환기, 알림이 별도로 있다. 이 계층의 값은 각 컴포넌트의 CSS 파일에서 서로 다른 시각에 정해졌다.

[`z-index`](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)는 요소가 겹치면 어느 요소를 위에 렌더링할지 정하는 CSS 속성이다. 값이 클수록 위에 렌더링한다. 다만 비교는 같은 [쌓임 맥락(stacking context)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)[^stacking] 안에서만 일어난다. 같은 부모 안의 작은 겹침(목록 위 버튼 등)은 1~10이면 충분하지만, Dock·메뉴 막대·펼친 메뉴처럼 화면 전체에서 서로 겹치는 요소는 서로의 값을 알아야 순서를 정할 수 있다. 예를 들어 `z-index: 1`인 상자 A 안에 `z-index: 9999`인 메뉴가 있고, 그 옆에 `z-index: 2`인 상자 B가 있으면 메뉴는 B 아래에 그려진다. A가 쌓임 맥락을 만들어 메뉴의 9999는 A 안에서만 비교되고, 바깥에서는 A 전체가 1로 B와 비교되기 때문이다.

![쌓임 맥락 안의 z-index는 바깥 요소와 비교되지 않는다](./images/design-tokens-stacking-context.svg '메뉴의 9999는 A 안에서만 의미가 있다. 바깥에서는 A(1)와 B(2)가 비교된다')

쌓임 맥락 때문에 z-index가 무시된 사례는 [position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context)에 정리했다.

### 흩어져 있던 숫자

CSS 전체에서 `z-index:`를 검색하고 앱 내부의 작은 값(1~10)을 제외하니, 화면 전체에서 겹치는 값은 13개 파일에 20곳이었다.

| 값                        | 사용처                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| 1000                      | Dock, 경고창(Modal) 기본값                                                |
| 1001                      | 메뉴 막대                                                                 |
| 1400 · 2000 · 2100 · 2200 | 휴대폰 앱 전환기 · 제어 센터 · 상태 막대 · 알림                           |
| 1500                      | 이 Mac에 관하여                                                           |
| 2000 · 3000               | Launchpad · 키보드 단축키 안내                                            |
| 9000 · 9999               | 알림 · 로딩 화면                                                          |
| 10000                     | 펼친 메뉴, 소리 조절, 메모의 서식 판·달력·라이트박스·끌어 놓기 표시 (6곳) |
| 15000 · 20000             | 앱 오류 화면 · 로그인                                                     |

이 표에서 확인한 문제는 세 가지다.

1. **의도가 숫자에 드러나지 않는다.** 메뉴 막대가 1001인 이유는 "Dock(1000)보다 위"라는 뜻이지만, 숫자만으로는 그 의도를 알 수 없다.
2. **같은 숫자가 여러 곳에 중복된다.** 10000은 여섯 곳에 같은 숫자로 적혀 있어서, 하나만 바꾸면 메뉴 사이의 순서가 어긋난다.
3. **같은 값이 다른 의미로 쓰인다.** 2000은 데스크톱 Launchpad이기도 하고 휴대폰 제어 센터이기도 하다. 둘은 한 화면에 함께 나오지 않아 충돌은 없지만, 숫자만 보면 관계가 있는 것처럼 읽힌다.

![1000부터 20000까지 화면 전체 층을 위가 앞이 되게 쌓은 사다리](./images/z-index-layers-ladder.svg '화면 전체에서 겹치는 계층과 값')

### 낮은 층부터 정의한 --z-* 변수

`styles/theme.css`의 `:root`에 `--z-*` 변수 15개로 모았다. 낮은 계층부터 높은 계층 순서로 정의해서, 파일을 위에서 아래로 읽는 순서가 곧 겹침 순서다.

```css
:root {
	--z-dialog: 1000; /* 앱 창 안의 경고창 기본값 (Modal) */
	--z-dock: 1000;
	--z-menubar: 1001;
	/* ... */
	--z-loading: 9999;
	--z-menu: 10000; /* 펼친 메뉴·팝오버·라이트박스: 어떤 창보다 위 */
	--z-app-error: 15000; /* 앱 오류 화면 */
	--z-login: 20000; /* 로그인: 가장 위 */
}
```

사용처는 숫자를 변수 이름으로 바꿨다. 앱 오류 화면(`desktop/window/Window.css`)은 `z-index: 15000;`이 `z-index: var(--z-app-error);`로 바뀌었다.

공통 경고창(`Modal`)은 사용하는 컴포넌트가 `--ui-modal-z`로 계층을 지정한다. Launchpad·키보드 단축키 안내·로그인에서 이 값을 숫자로 지정하던 코드도 `--ui-modal-z: var(--z-launchpad)`처럼 이름으로 바꿨다. `Modal.css`의 기본값도 `var(--ui-modal-z, 1000)`에서 `var(--ui-modal-z, var(--z-dialog))`로 바꿨다.

![쓰는 쪽이 --ui-modal-z를 주면 그 값을, 없으면 --z-dialog를 쓰는 흐름](./images/z-index-layers-modal-chain.svg 'Modal이 계층을 정하는 순서')

<details>
<summary>변경한 CSS 파일 14개</summary>

`theme.css`, `Dock.css`, `StatusBar.css`, `Menu.css`, `LoadingScreen.css`, `Notifications.css`, `MobileShell.css`, `AboutThisMac.css`, `KeyboardShortcuts.css`, `VolumeMenu.css`, `Window.css`, `LoginFlow.css`, `Modal.css`, `Memo.css`

</details>

값은 하나도 바꾸지 않았으므로, 변수 값과 원래 숫자가 같은지 diff에서 한 줄씩 대조했다. 변경 후 CSS에서 `var(--z-`를 사용하는 곳은 22곳이다. 숫자로 남은 `z-index`는 129곳이며, 모두 의도적으로 남긴 값이다.

- **창 순서**: 창 관리 store가 1, 2, 3…으로 할당하는 값이라 CSS 변수로 옮길 대상이 아니다.
- **앱 내부의 작은 값(1~10)**: 같은 부모 안의 겹침이라 다른 화면 요소와 비교하지 않는다.
- **소리 조절 막대(100)**: 소리 조절 상자 안에서만 사용하는 값이다.

### 이후 추가된 층

이름을 붙인 뒤에는 새 계층을 추가하려면 변수 목록 한 곳만 확인하면 된다. 바탕화면 아이콘을 드래그하는 동안 창과 Dock 위로 표시하는 `--z-drag: 2400`(`cf274032f`)과, 바탕화면에서 표시한 경고창을 모든 창 위에 배치하는 `--z-alert: 2500`(`273500977`)이 추가되었다. 둘 다 목록에서 앞뒤 값을 확인하고 그 사이에 추가했고, 다른 CSS 파일은 확인할 필요가 없었다. 그 시각 기준 계층 이름은 17개였다.

이후 디자인 토큰을 원시·의미·컴포넌트 세 층으로 나누면서([#286](https://github.com/hyeoniverse/MacFolio/pull/286)) `--z-*` 변수는 `styles/tokens/semantic.css`로 옮겨졌다. 현재는 위젯 갤러리(`--z-widget-gallery: 1450`), 둘러보기(`--z-tour: 9500`), 전체 화면 보기(`--z-fullscreen: 12000`) 등을 포함해 21개다. 둘러보기 오버레이는 [box-shadow 스포트라이트와 pointer-events로 클릭을 통과시키는 온보딩 오버레이](/memo/first-visit-tour)에서 `--z-tour`를 사용한다.

> [!TIP] 새 팝업의 계층
> 새 팝업을 만들려면 변수 목록에서 앞뒤 계층을 정하고, 그 사이에 변수 하나를 추가한다.

## 모서리 반경: `--radius-*` 여섯 값 (#232)

새 카드나 버튼을 만들 때마다 "다른 카드는 몇 px였지?"를 기존 CSS에서 검색해야 했다. 계기는 10월 12일이었다. 메모 편집기에 추가한 접기 토글의 모서리가 다른 요소와 같은 둥글기인지 확인하려 했는데, 비교할 기준 값이 없었다.

[`border-radius`](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius)는 상자 모서리의 곡률 반경을 지정하는 CSS 속성이다. 값이 클수록 더 둥글다. 높이의 절반보다 큰 값을 지정하면 양 끝이 반원인 알약 모양이 되고, `50%`를 지정하면 정사각형이 원이 된다.

`src` 아래 CSS에서 `border-radius`는 576곳이었고, 값은 마흔 가지가 넘었다.

| 값                         | 사용 수      | 용도                     |
| -------------------------- | ------------ | ------------------------ |
| 50%                        | 84           | 원 (아바타, 동그란 버튼) |
| 999px                      | 73           | 알약 (검색 칸, 배지)     |
| 6px                        | 46           | 작은 버튼, 입력 칸       |
| 8px                        | 42           | 버튼, 메뉴               |
| 14px                       | 34           | 카드                     |
| 10px                       | 29           | 목록 상자                |
| 4px                        | 15           | 작은 표시, 코드 조각     |
| 12 · 22 · 18 · 20 · 16px … | 각 20곳 아래 | 앱마다 다른 모양         |

원(50%)을 제외한 위의 여섯 값만으로 ==239곳, 전체의 40%가 넘는다==.

![border-radius 값별 사용 횟수 막대 그래프](./images/radius-tokens-counts.svg '색칠한 여섯 값에 이름을 붙였다. 원은 이미 뜻이 분명해 그대로 두었다')

```css
:root {
	--radius-xs: 4px;
	--radius-sm: 6px;
	--radius-md: 8px;
	--radius-lg: 10px;
	--radius-xl: 14px;
	--radius-full: 999px; /* 알약 */
}
```

![여섯 이름이 가리키는 둥글기](./images/radius-tokens-shapes.svg '같은 상자에 4·6·8·10·14·999px를 적용한 모양과 이름, 주요 용도')

34개 CSS 파일에서 `border-radius: 8px;`처럼 이 값 하나만 지정된 239곳을 `border-radius: var(--radius-md);`로 교체했다. 커밋(`ef26f3e67`)은 36개 파일에서 302줄을 추가하고 239줄을 삭제했다. 삭제한 줄 수가 교체한 위치 수와 같다. 교체한 날 다시 집계하면 `border-radius: 6px;`·`8px;`·`999px;`처럼 이름이 있는 값을 숫자로 작성한 줄은 0곳이었다.

```css
/* 전 */
.memo-search {
	border-radius: 999px;
}
/* 후 */
.memo-search {
	border-radius: var(--radius-full);
}
```

| 교체하지 않은 값                                    | 유지한 이유                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 원(`50%`)                                           | 크기와 관계없이 원을 뜻하므로 값 자체가 의미를 드러낸다                                                                  |
| 모서리마다 다른 값 (`14px 14px 0 0` 같은 하단 시트) | 단일 값이 아니다                                                                                                         |
| 나머지 값 (12·22·18px 등)                           | 앱마다 iOS·macOS 모양에 맞춰 고른 값이 많다. 가까운 이름으로 통합하면 모양이 바뀌므로 디자인을 맞출 시각에 개별 결정한다 |

이제 새 카드는 `var(--radius-xl)`, 새 알약은 `var(--radius-full)`로 작성하면 다른 요소와 같은 둥글기가 된다.

## 글자 크기: Apple HIG 스타일 이름의 `--text-*` (#234)

숫자만으로는 12px와 13px 중 어느 것이 "날짜 크기"인지 알 수 없다. 이름이 있어야 "날짜는 caption"이라는 규칙을 정하고 적용할 수 있다. 같은 용도에 다른 숫자가 섞여 있어도, 숫자만으로는 실수인지 의도인지 구분할 수 없다.

`apps/react/src` 아래 CSS에서 `font-size`는 958곳이었다.

| 값   | 사용 수 |
| ---- | ------- |
| 12px | 156     |
| 13px | 130     |
| 15px | 99      |
| 11px | 88      |
| 14px | 85      |
| 17px | 60      |
| 16px | 57      |
| 20px | 39      |
| 18px | 32      |
| 22px | 15      |

위 열 개 값이 761곳으로 전체의 약 80%다. 나머지는 em·rem, 10px 이하나 26px 이상의 큰 제목, 소수점 값 등이다. MacFolio는 macOS와 iOS 화면을 재현하는 사이트라, 이 값들은 대부분 Apple이 정의한 글자 크기에서 왔다.

### 이름 체계 선택

| 후보                      | 예                              | 장점                                            | 단점                                                    |
| ------------------------- | ------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| 숫자 그대로               | `--text-13`                     | 치환이 쉽다                                     | 숫자를 변수명으로 옮겼을 뿐, 용도를 나타내지 않는다     |
| 크기 단계                 | `--text-xs`·`sm`·`md`·`lg`      | Tailwind 등에서 익숙하다                        | 여덟 단계면 `xs`·`2xs`처럼 이름이 부자연스러워진다      |
| **Apple HIG 글자 스타일** | `--text-footnote`·`--text-body` | 재현 대상과 이름이 같고, 용도가 이름에 드러난다 | iOS 기준이라 macOS 화면에서는 이름과 용도가 일부 다르다 |

HIG(Human Interface Guidelines)는 Apple의 앱 UI 설계 지침이다. [Typography 항목](https://developer.apple.com/design/human-interface-guidelines/typography)에 글자 용도별 이름과 크기가 정의되어 있다. iOS 기준으로 본문(Body)은 17pt, 보조 문구(Footnote)는 13pt, 가장 작은 설명(Caption 2)은 11pt다. 화면 재현 중에 HIG를 참고하면서, 문서의 이름이 CSS에도 그대로 있으면 두 곳을 대조하기 쉽다.

| 이름              | 크기 | 용도                                 |
| ----------------- | ---- | ------------------------------------ |
| `--text-caption2` | 11px | 가장 작은 설명, 배지                 |
| `--text-caption`  | 12px | 날짜, 작은 설명                      |
| `--text-footnote` | 13px | 보조 문구 (macOS 앱에서는 본문 크기) |
| `--text-subhead`  | 15px | 휴대폰 목록의 둘째 줄                |
| `--text-callout`  | 16px | 강조한 설명                          |
| `--text-body`     | 17px | 휴대폰 본문                          |
| `--text-title3`   | 20px | 작은 제목                            |
| `--text-title2`   | 22px | 중간 제목                            |

macOS 앱의 본문은 13px이라 데스크톱 창 안에서는 `--text-footnote`가 실질적인 본문 크기다. 이름과 용도가 다른 부분이지만, 휴대폰 화면과 같은 이름 체계를 쓰는 쪽을 선택했다. 다크 모드에서 글자 크기는 바뀌지 않으므로 색 이름과 달리 다크 모드용 값은 없다.

![여덟 글자 크기 이름과 실제 크기](./images/font-size-tokens-scale.svg '이름별 실제 크기와, 변경 전 그 값의 사용 수')

### 단일 값 선언만 교체

`font-size: 13px;`처럼 값 하나만 있는 선언만 바꿨다. `font: 600 13px/1.2 …` 같은 [단축 속성](https://developer.mozilla.org/ko/docs/Web/CSS/Shorthand_properties), `calc()` 안의 값, `clamp()`는 변경하지 않았다. 단축 속성 안의 값은 다른 값과 함께 있어서, 변수로 바꾸면 한 줄이 오히려 읽기 어려워진다.

```css
/* Memo.css */
-	font-size: 13px;
+	font-size: var(--text-footnote);

-	font-size: 12px;
+	font-size: var(--text-caption);
```

45개 CSS 파일에서 645곳을 바꿨고, 커밋은 47개 파일, +712/−645다. 추가한 줄 중 13줄은 `theme.css`, 54줄은 글의 초판이다.

작업 중에 `--text-caption2`(11px)를 `--text-caption`(12px)으로 통합하는 방안도 검토했다. 통합하면 이름은 하나 줄지만 11px로 렌더링하던 배지·작은 설명 88곳이 1px씩 커져 화면이 바뀐다. 이번 작업은 값을 유지하고 이름만 붙이는 것이 목표라 둘을 유지했다.

| 이름을 붙이지 않은 값 | 이유                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14px(85곳)·18px(32곳) | HIG에 대응하는 이름이 없다. 대부분 데스크톱 앱에서 임의로 정한 크기라, 가까운 이름으로 통합할지는 화면을 확인하며 하나씩 정한다. 일괄로 13이나 15로 바꾸면 화면이 1px씩 달라진다 |
| em·rem                | 부모 글자 크기에 비례한다는 의미라 고정 이름으로 바꾸면 안 된다                                                                                                                  |
| 10px 이하·26px 이상   | 사용 수가 적고 앱마다 용도가 달라 그대로 두었다                                                                                                                                  |

- 변경 전후 커밋에서 `font-size`가 숫자인 곳(여덟 값)은 645 → 0, `var(--text-*)`는 0 → 645로 정확히 일치했다. `git grep -hE 'font-size:\s*(11|12|13|15|16|17|20|22)px'`로 집계했다.
- 변수 이름에 오타가 있으면(`--text-captoin` 등) [`var()`](https://developer.mozilla.org/ko/docs/Web/CSS/var)는 유효하지 않은 값이 되어 상속받은 크기가 적용된다. 화면에서는 1~2px 차이라 육안으로 찾기 어렵다. 그래서 `var(--text-`로 시작하는 값을 모두 추출해 이름별로 집계했고, 여덟 이름 외에는 기존의 `--text-scale` 하나뿐이었다.
- PR의 CI(타입 검사·단위 시험·E2E)가 모두 통과했다.

이름이 생기자 "이 날짜 글자는 왜 12px인가"라는 질문에 "caption이기 때문"이라고 답할 수 있게 되었다. ==숫자를 이름으로 바꾸는 일은 디자인 기준을 코드에 기록하는 일이다.==

## 그림자와 간격: `--shadow-*`·`--space-*` (#248)

간격은 CSS에서 가장 많이 작성하는 값이다. 숫자로만 작성되어 있으면 인접 화면이 어떤 간격을 썼는지 파일을 열어야 알 수 있다. 그림자는 반대 문제였다. 같은 요소(휴대폰 화면의 플로팅 버튼)의 그림자를 여섯 곳이 같은 값으로 각각 정의하고 있었다. 하나를 수정하면 나머지 다섯 곳과 어긋난다.

| 방법                                        | 장점                                | 단점                                                             |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| 4px 격자로 맞추고 6·10·14px을 가까운 값으로 | 간격 체계가 단순해진다              | 수백 곳이 1~2px씩 이동한다. "화면 유지" 규칙에 어긋난다          |
| `--space-sm`·`--space-md` 같은 의미 이름    | 값을 바꿔도 이름이 유효하다         | 열 단계를 구분할 이름이 부족하고, 이름만으로는 크기를 알 수 없다 |
| 자주 쓰는 열 값에 px 숫자 이름 (채택)       | 값이 같으므로 자동 비교로 확인 가능 | 이름이 값을 나타내므로, 값을 바꾸려면 이름도 바꿔야 한다         |

### 그림자 다섯 값

`src` 아래 CSS에서 [`box-shadow`](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)는 305곳이었다. 대부분은 이미 앱별로 정의한 변수(`--phone-float-shadow`, `--qc-shadow` 등)를 사용하거나, 테두리 대신 쓰는 `0 0 0 1px` 한 줄이거나, 한두 곳에만 나오는 값이었다. 같은 값이 세 곳 이상 반복된 것은 다섯 가지뿐이다.

| 이름             | 값                                                        | 사용 수 | 용도                             |
| ---------------- | --------------------------------------------------------- | ------- | -------------------------------- |
| `--shadow-float` | `0 0 0 0.5px rgba(0,0,0,.06), 0 4px 14px rgba(0,0,0,.12)` | 6       | 휴대폰 화면의 플로팅 버튼        |
| `--shadow-menu`  | `0 0 0 0.5px rgba(0,0,0,.15), 0 10px 30px rgba(0,0,0,.2)` | 3       | 메뉴, 날짜 선택기, 설정의 팝오버 |
| `--shadow-md`    | `0 6px 18px rgba(0,0,0,.18)`                              | 3       | 작은 카드                        |
| `--shadow-lg`    | `0 8px 30px rgba(0,0,0,.18)`                              | 3       | 휴대폰 홈 위젯, 날씨 카드        |
| `--shadow-xl`    | `0 18px 40px rgba(0,0,0,.12)`                             | 4       | Safari 프로젝트 소개의 큰 카드   |

![그림자 다섯 이름](./images/shadow-space-tokens-shadows.svg '같은 카드에 다섯 그림자를 걸어 본 모양')

이 값들은 라이트와 다크에서 같은 값을 사용하므로 테마별 값을 따로 정의하지 않았다. 창과 팝오버처럼 테마마다 값이 다른 그림자는 이미 `--shadow-window`·`--shadow-popover`가 담당하고 있다.

### 간격 열 값

`padding`·`margin`·`gap`은 모두 3,657곳이었다. 값 하나만 지정된 선언에서 자주 나온 값은 다음과 같다.

| 값   | 사용 수 |
| ---- | ------- |
| 8px  | 252     |
| 6px  | 181     |
| 10px | 176     |
| 12px | 129     |
| 4px  | 125     |
| 16px | 104     |
| 14px | 101     |
| 2px  | 82      |
| 20px | 76      |
| 24px | 68      |
| 18px | 63      |

==24px까지는 2px 단위로 촘촘하게 사용하고==, 그 위로는 빈도가 낮아진다. 그래서 2·4·6·8·10·12·14·16·20·24px 열 값을 선택하고, 이름에 px 값을 그대로 넣었다(`--space-8`은 8px).

```css
/* apps/react/src/styles/theme.css */
--space-2: 2px;
--space-4: 4px;
--space-6: 6px;
--space-8: 8px;
--space-10: 10px;
--space-12: 12px;
--space-14: 14px;
--space-16: 16px;
--space-20: 20px;
--space-24: 24px;

--shadow-float: 0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 4px 14px rgba(0, 0, 0, 0.12); /* 휴대폰 떠 있는 버튼 */
--shadow-menu: 0 0 0 0.5px rgba(0, 0, 0, 0.15), 0 10px 30px rgba(0, 0, 0, 0.2); /* 메뉴·날짜 고르기 */
```

교체 기준은 하나다. **선언의 값이 모두 이 열 값인 경우만** 교체했다.

| 선언                | 교체 여부 | 이유                     |
| ------------------- | --------- | ------------------------ |
| `gap: 8px`          | 교체      | 열 값                    |
| `padding: 6px 10px` | 교체      | 모두 열 값               |
| `padding: 0 12px`   | 유지      | 0이 섞임                 |
| `margin: auto 8px`  | 유지      | `auto`가 섞임            |
| 음수·`calc()` 포함  | 유지      | 열 값이 아닌 요소가 섞임 |

이 기준으로 1,543곳을 교체했다.

| 이름         | 값   | 교체한 값의 수 |
| ------------ | ---- | -------------- |
| `--space-2`  | 2px  | 113            |
| `--space-4`  | 4px  | 201            |
| `--space-6`  | 6px  | 235            |
| `--space-8`  | 8px  | 321            |
| `--space-10` | 10px | 254            |
| `--space-12` | 12px | 214            |
| `--space-14` | 14px | 165            |
| `--space-16` | 16px | 163            |
| `--space-20` | 20px | 103            |
| `--space-24` | 24px | 88             |

![--space-2부터 --space-24까지 바꾼 곳의 수 막대. 8px이 321곳으로 가장 많다](./images/shadow-space-tokens-counts.svg '이름으로 바꾼 간격 값의 수')

메모의 버전 목록 버튼에서 `6px 10px`은 이름으로 바뀌고, 열 값에 없는 `gap: 1px`은 그대로 남았다.

```css
/* apps/react/src/apps/memo/styles/note.css */
.memo-format-panel .memo-revision-list button {
	gap: 1px;
	padding: var(--space-6) var(--space-10);
	border-radius: var(--radius-md);
}
```

이름을 붙이지 않은 값은 세 종류다.

- **18px(63곳)·28px(47곳)과 그 밖의 값**: 열 값 사이에 있거나 앱 하나에 집중된 값이다. 가까운 이름으로 통합하면 화면이 1~2px 이동하므로, 화면을 보며 하나씩 결정한다.
- **0이 섞인 단축 속성 표기**: `padding: 0 12px`의 0은 이름을 붙일 값이 아니고, 12px만 교체하면 한 줄에 숫자와 이름이 섞여 가독성이 떨어진다.
- **한두 곳에만 나오는 그림자, 앱 변수로 정의한 그림자**: 이름을 붙여도 재사용할 곳이 없다.

PR 하나에서 70개 파일, 1,656줄을 추가하고 1,576줄을 삭제했다. 이 정도 변경량은 육안으로 확인할 수 없어서, 데스크톱·iPhone, 라이트·다크 조합으로 여러 앱 화면의 모든 요소의 계산된 스타일을 비교했다. 차이는 0이었다.

이후 다시 집계하자 CSS에서 `--space-*`는 1,908곳에 사용됐다. 교체한 1,543곳보다 365곳 많다. 이후에 만든 화면도 숫자 대신 이름을 쓰고 있다는 의미다. 가장 많이 사용되는 것은 여전히 `--space-8`(333곳)이었다. 그림자 다섯 값은 19곳에서 21곳으로 늘었다.

## 색: `--color-*` 토큰과 Apple 시스템 색 이름 (#249)

같은 `#1d1d1f`가 메일, 메시지, 음악, Safari, 알림 CSS에 각각 작성되어 있었다. 다크 모드의 글자색을 조정하려면 파일 다섯 개를 찾아 수정해야 했고, 하나라도 누락하면 그 앱만 색이 달라진다. 색 이름이 없어서 "이 회색이 저 회색과 같은 용도인가"도 값을 비교해야 판단할 수 있었다.

### hex 집계

`src` 아래 CSS에서 주석을 제외하고 hex 색(`#rgb`, `#rrggbb`, `#rrggbbaa`)을 집계하면 1,171곳이었다.

| 위치                                     | 개수 |
| ---------------------------------------- | ---- |
| `styles/theme.css` (이미 변수의 값)      | 32   |
| Safari 프로젝트 소개 페이지 (`project/`) | 626  |
| 그 밖의 앱·데스크톱·공통 UI              | 513  |

![hex 수](./images/color-tokens-counts.svg '전체 1,171곳에서 대상 513곳, 그중 288곳을 바꿨다')

프로젝트 소개 페이지는 프로젝트마다 고유한 브랜드 색을 의도적으로 사용한다. 공통 이름으로 묶으면 각 페이지 색의 출처가 불명확해지므로 범위에서 제외했다. 나머지 513곳이 대상이다. `rgb()`·`rgba()`는 425곳인데, 대부분 그림자와 반투명 배경이라 범위에서 제외했다.

다크 모드는 `<html data-theme="dark">`로 활성화하고, CSS에서는 `:root[data-theme='dark'] …` 선택자로 값을 재정의한다. 그래서 hex 값마다 "라이트 선언에서 사용하는지, 다크 선택자 안에서 사용하는지"로 구분해 집계했다.

| 방법                                                         | 장점                                         | 단점                                                     |
| ------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------- |
| 값마다 이름 (`--hex-1d1d1f`)                                 | 기계적으로 치환할 수 있다                    | 이름이 용도를 나타내지 않는다. 다크 쌍을 표현하지 못한다 |
| 디자인 시스템처럼 용도 이름을 새로 정의하고 화면을 그에 맞춤 | 결과 구조가 가장 단순하다                    | 실제 색이 바뀐다. 앱마다 화면을 다시 검토해야 한다       |
| 계산된 색이 같은 경우만 용도 이름으로 (**채택**)             | 화면 변화가 없고, 자동 비교로 검증할 수 있다 | 쌍이 일치하지 않는 값은 남는다 (225곳)                   |

### 테마 무관 값과 라이트·다크 쌍의 치환 기준

치환 후에도 계산된 색이 같아야 한다. 이 조건 때문에 토큰을 두 종류로 나눴다.

1. **테마와 무관한 값.** 라이트와 다크에서 동일하게 사용하는 색이다. 토큰도 값 하나만 가지므로, 어느 위치에서 치환해도 결과가 같다.
2. **라이트·다크 쌍.** 앱마다 `[data-app='mail'] { --mail-text: #1d1d1f }`와 `:root[data-theme='dark'] [data-app='mail'] { --mail-text: #f5f5f7 }`처럼 같은 쌍을 각각 작성하던 값이다. 이런 토큰은 다크에서 값이 바뀌므로, **같은 선택자의 라이트 선언과 다크 선언이 정확히 그 쌍과 일치하는 경우만** 두 위치를 함께 치환했다. 라이트 값만 같고 다크 값이 다르면 치환하지 않는다.

기존 변수도 같은 기준으로 사용했다. `--color-text-secondary`는 라이트 `#6e6e73`, 다크 `#98989d`인데, 메일과 Safari의 보조 글자색이 정확히 이 쌍이라 이 변수를 참조하게 했다. 반면 터미널의 보조 글자색은 다크 값이 `#9a9aa0`이라 그대로 두었다.

![짝 판정](./images/color-tokens-pair-rule.svg '두 선언이 이름의 짝과 같은 경우만 바꾼다')

메일 앱의 변경 예시다. 앱 변수(`--mail-text`)는 유지하고, 그 값만 전역 토큰을 참조한다. 그래서 앱 CSS의 나머지 부분은 수정할 필요가 없었다.

```css
[data-app='mail'] {
	--mail-text: var(--color-label); /* 전: #1d1d1f */
	--mail-accent: var(--color-blue); /* 전: #0a84ff */
}
:root[data-theme='dark'] [data-app='mail'] {
	--mail-text: var(--color-label); /* 전: #f5f5f7 */
	--mail-separator: #3a3a3c; /* 짝이 맞는 이름이 없어 그대로 */
}
```

다크 선언 쪽의 `var(--color-label)`은 생략해도 같은 값이 된다. 그래도 줄을 삭제하지 않고 값만 치환했다. 변경 범위를 "hex를 토큰으로 치환"에 한정해야 전후 비교가 단순해지기 때문이다.

### 테마와 무관한 색

| 토큰                      | 값        | 치환 수 |
| ------------------------- | --------- | ------- |
| `--color-white`           | `#ffffff` | 95      |
| `--color-notes-yellow`    | `#edbb4d` | 32      |
| `--color-blue`            | `#0a84ff` | 13      |
| `--color-red`             | `#ff3b30` | 12      |
| `--color-danger`          | `#e5484d` | 11      |
| `--color-on-notes-yellow` | `#2b2100` | 8       |
| `--color-black`           | `#000000` | 7       |
| `--color-gray`            | `#8e8e93` | 7       |
| `--color-green`           | `#34c759` | 5       |
| `--color-gray-6`          | `#f2f2f7` | 4       |
| `--color-orange`          | `#ff9f0a` | 3       |

토큰 이름은 [Apple 시스템 색](https://developer.apple.com/design/human-interface-guidelines/color)(systemBlue, systemGray6 등)을 따랐다. `--color-blue`는 iOS 다크 모드의 systemBlue 값인데, 휴대폰 화면이 라이트 모드에서도 이 값을 사용하고 있어서 값을 그대로 옮겼다. `--color-danger`는 Menu·Button·휴대폰 셸이 `var(--color-danger, #e5484d)`처럼 먼저 참조하던 이름이다. 정의가 없어 항상 대체값으로 처리되던 것을 이번에 정의했다. 메모 앱의 노란색은 날짜 선택기도 함께 사용해서 앱 변수가 아니라 전역 토큰으로 정의했다.

### 라이트·다크 쌍 토큰

| 토큰                           | 라이트           | 다크               | 치환 수 |
| ------------------------------ | ---------------- | ------------------ | ------- |
| `--color-label`                | `#1d1d1f`        | `#f5f5f7`          | 14      |
| `--color-code-number`          | `#0550ae`        | `#79c0ff`          | 12      |
| `--color-content-bg`           | `#ffffff`        | `#1c1c1e`          | 8       |
| `--color-card-bg`              | `#ffffff`        | `#2c2c2e`          | 7       |
| `--color-panel-bg`             | `#f6f6f6`        | `#2a2a2c`          | 4       |
| `--color-error`                | `#d70015`        | `#ff6961`          | 4       |
| `--color-link`                 | `#0071e3`        | `#2997ff`          | 4       |
| `--color-selected-content-bg`  | `#0063e1`        | `#0a84ff`          | 4       |
| `--color-code-keyword` 외 여섯 | GitHub 밝은 테마 | GitHub 어두운 테마 | 각 4    |

코드 강조 색은 메모와 Finder 미리보기가 같은 GitHub 팔레트를 각각 작성하고 있었다. 터미널의 경로·링크 색도 같은 숫자 색이다. 기존 변수로 치환한 곳은 10곳이다. 메모와 음악의 창 배경(`--color-window-bg`) 4곳, 메일과 Safari의 보조 글자색(`--color-text-secondary`) 4곳, 음악의 사이드바(`--color-sidebar-bg`) 2곳이다.

모두 288곳을 치환했다. ==대상 513곳의 56%==다.

### 토큰으로 치환하지 않은 hex 225곳

| 분류                               | 개수 | 이유                                                                                                                         |
| ---------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| 한 앱만 사용하는 변수 값           | 103  | 설정의 프로젝트 편집기, 날씨, 메시지 말풍선처럼 그 앱에만 있는 색이다. 이미 앱 변수로 이름이 있다                            |
| 반복되지만 쌍이 일치하지 않는 값   | 39   | `#3a3a3c`, `#6e6e73`처럼 여러 번 나오지만 다크 값이 위치마다 다르거나 다크 선택자에만 있다. 토큰으로 묶으면 한쪽 색이 바뀐다 |
| 한 곳에만 나오는 값                | 36   |                                                                                                                              |
| GitHub 앱의 팔레트                 | 26   | GitHub 화면을 재현하는 색이라 GitHub 값 그대로 유지한다                                                                      |
| Safari 프레임과 프로젝트 소개 공통 | 19   | apple.com 소개 페이지의 색이다                                                                                               |
| SVG data URL 안의 색               | 2    | `url()` 안에서는 `var()`를 사용할 수 없다                                                                                    |

TS·TSX 안의 hex 403곳도 그대로 두었다. 프로젝트 소개 데이터의 브랜드 색, 설정의 색 선택 목록, 시험 코드, 캔버스 렌더링 값이라 CSS 토큰으로 치환할 대상이 아니다.

### 계산된 스타일 41만여 개 비교

변경 전후의 빌드를 각각 실행해, 데스크톱과 iPhone 크기, 라이트와 다크 모드에서 Dock 앱, Launchpad 앱, 메모 글, Safari 프로젝트 페이지, 휴대폰 홈 화면의 앱까지 화면 116개를 열었다. 모든 요소와 의사 요소에서 색 관련 계산된 스타일 41만여 개를 비교했다. 시계 글자 폭, 재생 막대, 배경 밝기에 따라 바뀌는 상태 막대와 홈 인디케이터처럼 같은 빌드를 두 번 실행해도 달라지는 값을 제외하면 차이는 없었다.

| 비교 축   | 조합                                                               |
| --------- | ------------------------------------------------------------------ |
| 뷰포트    | 데스크톱, iPhone                                                   |
| 테마      | 라이트, 다크                                                       |
| 화면      | Dock 앱, Launchpad 앱, 메모 글, Safari 프로젝트, 휴대폰 홈 (116개) |
| 비교 대상 | 모든 요소·의사 요소의 색 관련 계산된 스타일 41만여 개              |
| 결과      | 실행마다 달라지는 값을 제외하면 차이 0                             |

## 사흘 뒤 재집계: 이름만으로는 재유입을 막지 못한다

10월 19일에 같은 방법으로 다시 집계하자, 이름이 있는 값을 숫자로 작성한 줄이 다시 생겨 있었다.

| 토큰        | 교체한 날                               | 10월 19일                                 |
| ----------- | --------------------------------------- | ----------------------------------------- |
| 모서리 반경 | `border-radius` 576줄, 이름 239, 숫자 0 | `border-radius` 921줄, 이름 246, 숫자 115 |
| 글자 크기   | 이름 645, 여덟 값의 숫자 0              | 이름 646, 여덟 값의 숫자 375              |

`border-radius` 줄이 사흘 만에 345줄 늘었는데, 이름을 쓴 줄은 7줄만 늘었다. 숫자로 다시 생긴 115줄은 대부분 그 사이 크게 늘어난 Safari 프로젝트 페이지 템플릿(`apps/safari`)에 있다. 글자 크기의 숫자 375곳 중 253곳은 Safari 프로젝트 템플릿 다섯 개(`repo`·`devtool`·`friendly`·`keynote`·`paper`)와 `Settings.css`다. 이 CSS는 #234와 같은 시기에 다른 브랜치에서 작성되어, #234가 병합된 뒤에 합쳐졌다.

![이름 쓰는 곳과 다시 생긴 숫자](./images/radius-tokens-after.svg '이름은 그대로 쓰이지만, 뒤에 더한 코드는 숫자로 적었다')

![숫자와 이름의 사용 수](./images/font-size-tokens-counts.svg '#234 직후에는 숫자가 0이었지만, 다른 브랜치의 CSS가 병합되며 375곳이 다시 유입됐다')

==이름을 정의하는 것만으로는 새로 작성하는 코드에 적용되지 않는다==는 것이 수치로 확인됐다. 이후 [#280](https://github.com/hyeoniverse/MacFolio/pull/280)(10월 20일 병합)에서 [Stylelint](https://stylelint.io/) 규칙을 추가했다. `border-radius`에 4·6·8·10·14·999px를, `gap`·`padding`·`margin`에 2~24px 열 값을 단일 값으로 작성하면 `pnpm lint`가 실패한다. 이미 다시 들어와 있던 값은 같은 값의 이름으로 교체했다. "이름이 있는 값만 차단"하는 방식이라 예외 목록이 필요 없었다. 이 규칙을 토큰 단계 범위 안의 모든 숫자로 넓힌 과정은 [Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기](/memo/off-scale-values)에 정리했다.

## 이후 토큰 구조 변경

| 병합일    | PR                                                       | 변경                                                                                                                                                                                              |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10월 20일 | [#286](https://github.com/hyeoniverse/MacFolio/pull/286) | 토큰을 원시·의미·컴포넌트 세 층으로 분리. 모서리 반경의 크기 이름은 값 이름으로 바뀌고, 쓰임새 이름(`--radius-panel` 18px, `--radius-window` 22px)은 의미 층으로 이동. `--z-*`는 `semantic.css`로 |
| 10월 20일 | [#294](https://github.com/hyeoniverse/MacFolio/pull/294) | 그림자를 높이 단계(`--shadow-1`~`--shadow-7`, `styles/tokens/primitives.css`)와 용도 이름(`raised`·`float`·`card`·`menu`·`modal`, `semantic.css`)으로 재구성                                      |

<details>
<summary>이 글의 이름과 현재 이름</summary>

| 이 글의 이름     | 현재 이름                                     |
| ---------------- | --------------------------------------------- |
| `--radius-xs`    | `--radius-4` (`styles/tokens/primitives.css`) |
| `--radius-sm`    | `--radius-6`                                  |
| `--radius-md`    | `--radius-8`                                  |
| `--radius-lg`    | `--radius-10`                                 |
| `--radius-xl`    | `--radius-14`                                 |
| `--radius-full`  | `--radius-full`                               |
| `--shadow-float` | `--shadow-float` → 원시 토큰 `--shadow-2`     |
| `--shadow-md`    | `--shadow-card` → `--shadow-3`                |
| `--shadow-lg`    | 원시 토큰 `--shadow-4`                        |
| `--shadow-xl`    | 원시 토큰 `--shadow-5`                        |
| `--shadow-menu`  | `--shadow-menu` → `--shadow-6`                |

</details>

## 남은 과제와 정리

- **토큰 사이의 값은 화면을 보며 결정한다.** 글자 14px·18px, 간격 18px·28px, 모서리 12·22·18px은 가까운 이름으로 통합하면 화면이 1~2px 이동한다. 간격 18px·28px만 해도 값 하나만 지정된 선언 기준으로 110곳이다. 값 수정 작업이므로 이름 부여와 분리한다.
- **쌍이 일치하지 않는 색 39곳**(`#3a3a3c` 등)은 의도한 차이인지 수작업 중 생긴 차이인지 화면을 하나씩 검토해야 판단할 수 있다. "화면 변화 없음"이 조건이라 보류했다.
- **`rgb()`·`rgba()` 425곳**은 변경하지 않았다. 대부분 그림자와 반투명 배경이다.

정리하면 다음과 같다.

1. 숫자만 있는 설정값은 그 값을 정한 이유가 기록되지 않는다. 변수 이름과 한 줄 주석으로 이유를 기록한다.
2. 화면을 바꾸지 않는 리팩터링은 "같은 값만 교체한다"는 규칙 하나로 리뷰가 단순해진다. 삭제한 줄 수와 교체한 위치 수가 같은지 확인하고, 수백 곳 이상이면 계산된 스타일 비교로 검증한다. 비교로 검증할 수 없는 변경(실제 색 수정)은 같은 커밋에 포함하지 않는다.
3. 세 곳 이상 반복된 값에만 이름을 붙인다. 그림자는 305곳 중 다섯 값 19곳만 이름이 됐다. 한두 곳에만 쓰는 값에 이름을 붙이면 이름 목록만 길어진다.
4. 이름에 값을 넣는 것도 방법이다. `--space-8`은 8px이라는 것이 이름에 드러난다. 체계를 바꾸는 시각에는 이름도 바꿔야 하지만, 그전까지는 값을 기억할 필요가 없다.
5. 이름 사용을 유지하려면 자동 검사가 필요하다. 사흘 만에 숫자 490곳이 다시 유입되었다.

## 관련 글

- [CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기](/memo/refactor-retrospective#5단계-스타일): 스타일 리팩터링 전체
- [Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기](/memo/off-scale-values): 토큰 사이의 숫자를 옮기고, 창 안의 z-index를 -1~10으로 제한한 규칙
- [position sticky가 만든 쌓임 맥락에 갇힌 z-index](/memo/sticky-stacking-context): sticky가 쌓임 맥락을 만들어 도구 막대 버튼이 가려진 일
- [useIsMobile과 ResizeObserver로 정하는 data-compact 레이아웃 기준](/memo/weather-layout-fixes): 날씨 앱에서 backdrop-filter가 같은 문제를 만든 일
- [box-shadow 스포트라이트와 pointer-events로 클릭을 통과시키는 온보딩 오버레이](/memo/first-visit-tour): `--z-tour`를 사용하는 둘러보기

<details>
<summary>참고 문헌</summary>

- MDN, [Using CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- MDN, [var()](https://developer.mozilla.org/en-US/docs/Web/CSS/var)
- MDN, [z-index](https://developer.mozilla.org/en-US/docs/Web/CSS/z-index)
- MDN, [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context)
- MDN, [border-radius](https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius), [box-shadow](https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow)
- MDN, [Window: getComputedStyle()](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)
- Apple, Human Interface Guidelines: [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Color](https://developer.apple.com/design/human-interface-guidelines/color)
- W3C Design Tokens Community Group, [Design Tokens Format Module](https://www.designtokens.org/tr/drafts/format/)
- Stylelint, [declaration-property-value-allowed-list](https://stylelint.io/user-guide/rules/declaration-property-value-allowed-list/)

</details>

[^token]: 이 사이트에서는 `styles/theme.css`(이후 `styles/tokens/`)의 CSS 사용자 정의 속성(`--color-*` 등)으로 정의한다.

[^custom]: CSS 사용자 지정 속성(CSS 변수)은 `--`로 시작하는 이름에 값을 저장하고 `var(--이름)`으로 참조하는 기능이다. 빌드 도구 없이 브라우저가 실행 시점에 값을 계산한다.

[^stacking]: 자식 요소의 z-index를 그 안에서만 비교하는 독립된 겹침 단위. `position: fixed`·`sticky`, z-index가 지정된 `position: relative`·`absolute`, `opacity` 1 미만, `transform`, `filter`, `backdrop-filter` 등이 새로 만든다.

#MacFolio #CSS #리팩터링 #다크모드
