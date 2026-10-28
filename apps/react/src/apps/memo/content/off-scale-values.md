---
title: Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기
date: 2026-10-21
category: 개발 기록/MacFolio/디자인 시스템
summary: 간격 578곳·모서리 107곳·글자 48곳을 가까운 토큰으로 옮기고, z-index를 전역 층 토큰과 창 안의 -1~10으로, 색을 직접 쓴 그라데이션을 토큰으로 정리했다. Stylelint는 '이름 있는 값만 차단'에서 '토큰 단계 범위 안의 숫자는 모두 차단'으로 넓혀 위반 0곳에서 시작했다.
---

[리팩터링 5단계 - CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기](/memo/refactor-step5-styles)에서는 값을 바꾸지 않고 이름만 붙였다. 그 결과 토큰과 값이 같은 숫자는 이름으로 바뀌었지만, 토큰 사이에 있는 숫자(5px·7px·18px 글자 등)는 그대로 남았다. 이후 [#280](https://github.com/hyeoniverse/MacFolio/pull/280)에서 Stylelint 규칙을 추가했는데, 이 규칙은 **토큰과 값이 같은 숫자만** 차단했다. 새 CSS에 `padding: 5px 7px`을 작성해도 `pnpm lint`가 통과했다.

이 글은 그 뒤의 작업이다. 남은 숫자를 가까운 토큰으로 옮기고([#296](https://github.com/hyeoniverse/MacFolio/pull/296)), 공통 부품의 기본값을 토큰 파일로 모으고([#289](https://github.com/hyeoniverse/MacFolio/pull/289)), 규칙을 "토큰 단계 범위 안의 숫자는 모두 차단"으로 넓혔다.

## 문제

토큰을 원시·의미·컴포넌트 세 층으로 나눈 [#286](https://github.com/hyeoniverse/MacFolio/pull/286) 이후 앱 CSS를 다시 집계했다.

| 종류              | 남은 숫자                                                 |
| ----------------- | --------------------------------------------------------- |
| 간격              | 708곳 (단계 안의 숫자 포함)                               |
| 모서리            | 128곳                                                     |
| 글자              | 98곳                                                      |
| z-index           | 부품 안의 큰 숫자 5곳 (`100000`·`100`·`40`·`20`)          |
| 그라데이션        | 색을 직접 작성한 `linear-gradient` 16곳                   |
| 부품 CSS의 기본값 | `var(--ui-accent, var(--color-control-accent))` 형태 15개 |

숫자가 남은 원인은 #280 규칙의 정규식에 있었다.

```js
// #280: 토큰과 같은 값, 그리고 값이 하나뿐인 선언만 차단
const px = (values) => new RegExp(`^(${values.join('|')})px$`);
'border-radius': [px([4, 6, 8, 10, 14, 22, 999])],
```

`^…px$`는 선언 전체가 숫자 하나인 경우만 일치한다. 다음 세 가지는 모두 통과했다.

- 토큰 사이의 값: `border-radius: 7px`, `font-size: 18px`
- 단축 속성: `padding: 5px 8px` (값이 둘이라 `^…$`에 일치하지 않는다)
- 토큰과 같은 값이 섞인 단축 속성: `margin: 0 4px`

## 간격·모서리·글자를 가까운 토큰으로

값을 바꾸는 작업이므로 규칙을 먼저 정했다. 4px 격자의 가장 가까운 단계로 옮기고, 거리가 같으면 작은 쪽을 선택했다.

| 종류   | 변환                                                                 | 허용 범위로 유지                           |
| ------ | -------------------------------------------------------------------- | ------------------------------------------ |
| 간격   | 3→2, 5→4, 7→6, 9→8, 11→10, 13→12, 22→20                              | 1·1.5px(선 맞춤), 26px 이상(레이아웃 치수) |
| 모서리 | 3→4, 5→4, 7→6, 9→8, 16→14, 20→18, 24·25·26→22, 980px→`--radius-full` | 1~2px(미세한 둥글기), 27px 이상            |
| 글자   | 24·26·30→28, 32→34, 19·21→20, 12.5→13, 11.5→12                       | 6~10px(배지), 36px 이상(장식 숫자)         |

글자는 기존 여덟 단계(11~22px)로는 24px 이상의 제목을 받을 곳이 없었다. 그래서 Apple HIG[^hig]의 글자 스타일에서 두 단계를 더 가져왔다.

```css
/* styles/tokens/primitives.css */
--text-title2: 22px;
--text-title1: 28px; /* 추가 */
--text-large-title: 34px; /* 추가 */
```

변환은 단계 밖 숫자와 함께, 단계 안에 있으면서 숫자로 작성된 값(단축 속성 안의 `4px` 등)도 함께 처리했다. 합계는 간격 578곳, 모서리 107곳, 글자 48곳이다.

```diff
-	padding: 5px 8px;
+	padding: var(--space-4) var(--space-8);
-	margin: 0 2px 3px 6px;
+	margin: 0 var(--space-2) var(--space-2) var(--space-6);
-	border-radius: 7px;
+	border-radius: var(--radius-6);
-	font-size: 34px;
+	font-size: var(--text-large-title);
```

대부분 1~2px 이동이라 화면 차이는 작다. 아래는 PR에서 같은 화면을 전후로 촬영한 캡처다. 휴대폰 화면 5장은 차이가 없었다.

![시스템 설정 계정 화면 전후](./images/off-scale-values-settings.jpg '시스템 설정 › 계정. 왼쪽 전, 오른쪽 후. 정보 표의 행 높이가 약간 줄었고 나머지는 같다')

![메모 앱 전후](./images/off-scale-values-memo.jpg '메모. 왼쪽 전, 오른쪽 후. 사이드바 태그 칩의 간격이 단계 값으로 맞춰져 태그 줄 위치가 약간 이동했다')

![날씨 앱 전후](./images/off-scale-values-weather.jpg '날씨. 왼쪽 전, 오른쪽 후. 이동 폭이 1~2px이라 나란히 놓아도 구분하기 어렵다. 기온 막대 그라데이션은 앱 토큰으로 옮겼고 색은 같다')

## z-index: 전역 층과 창 안의 0~10

z-index는 두 종류로 나눴다.

- **전역 층**: 메뉴·Dock·로그인처럼 화면 전체에서 비교하는 값. `--z-*` 토큰([흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers))만 사용한다.
- **창 안의 겹침**: 앱 창마다 z-index가 지정되어 있어 창이 이미 쌓임 맥락[^stacking]을 만든다. 그 안의 값은 다른 창이나 Dock과 비교되지 않으므로 -1~10이면 충분하다.

이 기준에서 벗어난 값은 다섯 곳이었다.

| 위치                      | 전              | 후                    | 이유                                                       |
| ------------------------- | --------------- | --------------------- | ---------------------------------------------------------- |
| 슬라이드쇼·그림 크게 보기 | `100000`        | `var(--z-fullscreen)` | 새 전역 층 12000. 메뉴(10000) 위, 앱 오류 화면(15000) 아래 |
| 설정 › 프로젝트 시트      | `40`            | `10`                  | 같은 창 안의 다른 겹침이 2까지라 순서 유지                 |
| 음량 메뉴                 | `10`·`20`·`100` | `1`·`2`·`3`           | 바깥 상자가 이미 쌓임 맥락이라 상대 순서만 유지하면 된다   |

창마다 쌓임 맥락이 이미 있으므로 `isolation: isolate`는 추가하지 않았다.

## 그라데이션

색을 직접 작성한 그라데이션 16곳은 용도에 따라 세 곳으로 옮겼다.

| 종류                     | 옮긴 곳                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 두 곳 이상에서 같은 모양 | 의미 토큰 `--gradient-avatar-placeholder`(사진 없는 아바타 2곳), `--gradient-graphite`(흑연색 아이콘 2곳)   |
| 시스템 색으로 대체 가능  | 사진 위 어두운 막 → `--color-scrim-*`, QuickTime 진행 막대 → `--color-white`·`--color-on-media-fill-strong` |
| 앱 고유의 그림           | 앱 루트의 앱 토큰 `--settings-icon-*`, `--weather-temperature-gradient`, `--mail-avatar-gradient` 등        |

```diff
 /* apps/weather/Weather.css */
+	--weather-temperature-gradient: linear-gradient(90deg, #5ac8fa, #a5de37, #ffcc00, #ff9500); /* 기온 막대: 차가움 → 더움 */
 …
-	background: linear-gradient(90deg, #5ac8fa, #a5de37, #ffcc00, #ff9500);
+	background: var(--weather-temperature-gradient);
```

앱 토큰은 hex를 그대로 포함한다. 아래 규칙은 `background`·`background-image` 속성의 값만 검사하므로, 사용자 정의 속성(`--weather-*`)에 작성한 색은 차단하지 않는다. 앱 고유의 색은 앱 루트 한 곳에 이름과 함께 모이고, 실제 사용처는 `var()`만 남는다.

## 부품 CSS의 기본값 15개를 components.css로

공통 부품(`shared/ui`)은 앱이 덮어쓸 수 있는 `--ui-*` 변수를 제공한다. 메모 앱의 노란 단추는 `[data-app='memo']`에서 `--ui-accent`를 바꿔 만든다. 그런데 기본값은 각 부품 CSS의 `var()` 두 번째 인자(대체값)에 흩어져 있었다.

```css
/* shared/ui/button/Button.css (전) */
padding: var(--ui-button-padding, 5px 14px);
border-radius: var(--ui-button-radius, 8px);
background-color: var(--ui-accent, var(--color-control-accent));
```

부품의 기본 색을 확인하려면 부품 파일을 하나씩 열어야 했고, `--ui-*` 이름은 세 층 토큰 체계 밖에 있었다. #289에서 기본값 15개를 `styles/tokens/components.css`(3층)로 옮기고, 부품 CSS에는 `var(--ui-x)`만 남겼다.

```css
/* styles/tokens/components.css */
/* Button */
--ui-accent: var(--color-control-accent);
--ui-on-accent: var(--color-alternate-selected-control-text);
--ui-danger: var(--color-system-red);
--ui-button-bg: var(--color-unemphasized-selected-content-background);
--ui-button-padding: 5px 14px;
--ui-button-radius: var(--radius-8); /* 전: 8px */
/* IconButton */
--ui-float-bg: transparent; /* 전: 기본값 없음 = 투명 */
--ui-float-shadow: none;
/* Modal·Sheet: 덮개 */
--ui-modal-z: var(--z-dialog);
--ui-modal-dim: var(--color-overlay);
--ui-sheet-dim: var(--color-scrim);
```

| 부품        | 옮긴 기본값                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Button      | `--ui-accent`·`--ui-on-accent`·`--ui-danger`·`--ui-button-bg`·`--ui-button-padding`·`--ui-button-radius`       |
| IconButton  | `--ui-tool-color`·`--ui-tool-hover`·`--ui-tool-on-bg`·`--ui-tool-on-color`·`--ui-float-bg`·`--ui-float-shadow` |
| Modal·Sheet | `--ui-modal-z`·`--ui-modal-dim`·`--ui-sheet-dim`                                                               |
| Switch      | `--ui-switch-off`·`--ui-switch-focus`                                                                          |

부품 CSS에 대체값으로 남긴 변수도 있다. `:root`로 옮기면 의미가 바뀌는 값이다.

- `--ui-button-color: inherit`, `--ui-float-color: inherit`: 사용자 정의 속성에 `inherit`을 지정하면 "부모 요소의 같은 변수를 상속"하는 뜻이 되어, "부모의 `color`를 상속"과 다르다.
- `--ui-sheet-bg: var(--phone-card-bg)`: `--phone-card-bg`는 휴대폰 창 안에서만 정의된다. `:root`에서 계산하면 그 시각에 값이 없어 빈 값이 된다.
- `--ui-sheet-z`(10·20): 부품 안의 덮개와 시트 순서이므로 창 안의 0~10 기준을 따른다.

라이트·다크 앱 7개와 휴대폰 3개 화면을 전후로 픽셀 비교해 차이가 없음을 확인했다. 메시지 앱은 매번 무작위로 생성되는 익명 이름 영역만 달랐다.

## 규칙 확대: 이름 있는 값만 → 단계 범위 안 전부

정리를 마친 뒤 `apps/react/stylelint.config.mjs`의 규칙을 넓혔다. 핵심은 정규식 두 가지 변경이다.

- **범위로 지정**: 토큰과 같은 값의 목록 대신 `pxIn(2, 25)`처럼 단계 범위 전체를 차단한다.
- **위치 무관**: `^…$` 고정을 제거해 단축 속성 안의 값도 검사한다. 앞뒤 경계(`(?<![\w.-])`, `\b`)는 `0.5px`나 `--space-12` 같은 이름의 일부와 일치하지 않게 한다.

![#296 전후로 Stylelint가 차단하는 px 값의 범위를 간격·모서리·글자별로 비교한 그림](./images/off-scale-values-rule.svg '전에는 토큰과 같은 값의 점만, 후에는 단계 범위 전체가 오류다. 초록 구간(선 맞춤용 1~2px, 레이아웃 치수 등)만 숫자로 허용한다')

```js
// apps/react/stylelint.config.mjs (#296)
const pxIn = (min, max) => new RegExp(`(?<![\\w.-])(${range(min, max).join('|')})(\\.\\d+)?px\\b`);

'declaration-property-value-allowed-list': [
	// z-index: 전역 층은 --z-*, 부품 안의 겹침은 -1~10만
	{ 'z-index': [/^var\(--(z|ui)-/, /^(-1|[0-9]|10)$/] },
	…
],
'declaration-property-value-disallowed-list': [
	{
		'font-size': [pxIn(11, 35)],
		'border-radius': [pxIn(3, 26), /(?<![\w.-])(980|999)px\b/],
		'/^(gap|row-gap|column-gap|padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/': [pxIn(2, 25)],
		'/^background(-image)?$/': [/gradient\([^;]*(#[0-9a-f]{3,8}\b|rgba?\()/i],
		…
	},
	…
],
```

z-index만 허용 목록(`declaration-property-value-allowed-list`)[^allowed]을 사용한다. 차단할 숫자는 11 이상 무한대지만, 허용할 값은 `var(--z-*)`·`var(--ui-*)`와 -1~10뿐이라 허용 목록이 더 짧다.

| 속성       | 차단                    | 허용                                 |
| ---------- | ----------------------- | ------------------------------------ |
| 간격       | 2~25px                  | 0·1·1.5px, 26px 이상, 음수, em·rem·% |
| 모서리     | 3~26px, 980·999px       | 1~2px, 27px 이상, 50%                |
| 글자       | 11~35px                 | 6~10px, 36px 이상, em·rem            |
| z-index    | 토큰이 아닌 11 이상     | `var(--z-*)`·`var(--ui-*)`, -1~10    |
| background | 색을 직접 쓴 그라데이션 | 토큰·앱 토큰을 사용한 그라데이션     |

같은 위반 사례를 넣은 CSS 파일로 실행한 출력이다. `gap: 30px`은 레이아웃 치수 범위라 통과한다.

```text
src/zz-lint-sample.css
  2:11  ✖  padding: 5px 1px — 토큰 단계 안의 값입니다. 가까운 토큰(--space-*·--radius-*·--text-*, 흰·검정은 --color-white·--color-black)을 쓰거나, 꼭 필요하면 그 줄에 stylelint-disable-next-line과 이유를 다세요     declaration-property-value-disallowed-list
  3:11  ✖  z-index: 50 — 화면 전체의 층은 --z-* 토큰을, 부품 안의 겹침은 -1~10을 쓰세요                                                                                                                                declaration-property-value-allowed-list
  4:13  ✖  font-size: 18px — 토큰 단계 안의 값입니다. …                                                                      declaration-property-value-disallowed-list
  5:17  ✖  border-radius: 12px — 토큰 단계 안의 값입니다. …                                                                  declaration-property-value-disallowed-list

✖ 4 problems (4 errors, 0 warnings)
```

#280 규칙이었다면 네 줄 모두 통과한다. `5px 1px`은 단축 속성, `18px`·`12px`은 토큰과 같은 값이 아니고, z-index `50`은 차단 목록의 전역 층 숫자가 아니기 때문이다.

오류 메시지에는 바로 적용할 토큰 이름과 예외 처리 방법(`stylelint-disable-next-line … -- 이유`)을 포함했다. 같은 기준을 `CONTRIBUTING.md`의 스타일 규칙에도 기록했다.

## 확인

- 규칙을 넓힌 시각에 앱 CSS의 위반은 0곳이었다. `stylelint-disable` 주석도 0개다. 이 상태에서 시작했으므로 이후의 위반은 모두 새로 작성한 CSS에서 발생한다.
- prettier·eslint·stylelint·tsc 통과, 단위 테스트 778개 통과.
- E2E: 미리보기 슬라이드쇼·설정·프로젝트 앱·서버 상태 41개 통과. z-index를 바꾼 화면이 포함된 시험이다.
- #296은 파일 74개(CSS 62개)에서 615줄 추가, 566줄 삭제.

## 남은 것

- **정의되지 않은 토큰은 검출하지 못한다.** 규칙을 넓힌 같은 날, 새로 만든 둘러보기 카드에 `--radius-16`·`--text-caption1`처럼 존재하지 않는 토큰을 사용해 모서리가 0으로 표시됐다. `var()`에 정의되지 않은 이름을 넣으면 오류 없이 무시되기 때문이다. 이 규칙은 숫자만 검사하므로 이름의 존재 여부를 확인하는 규칙이 별도로 필요하다.
- **색은 범위로 차단할 수 없다.** 간격·글자는 숫자 축이 하나라 범위가 성립하지만, 색은 그렇지 않다. 색은 테마와 무관한 이름 있는 색(`#fff`·`#ff3b30` 등)을 단일 값으로 쓴 선언만 차단하는 #288의 방식을 유지했다.
- 프로젝트 소개 페이지(`apps/safari/project/**`)는 브랜드 디자인을 그대로 따르므로 검사 대상에서 제외했다.

## 관련 글

- [리팩터링 5단계 - CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기](/memo/refactor-step5-styles): 값은 바꾸지 않고 이름만 붙인 단계. 이 글은 그 뒤의 값 정리와 강제
- [흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers): 전역 층 `--z-*`의 시작
- [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/shadow-space-tokens): 18px·28px처럼 이름을 붙이지 않고 남긴 간격 값
- [Apple HIG 글자 스타일 이름으로 font-size 디자인 토큰 만들기](/memo/font-size-tokens): 이번에 `title1`·`large-title`을 추가한 글자 단계
- [자주 쓰는 border-radius 여섯 값을 --radius-* 디자인 토큰으로 바꾸기](/memo/radius-tokens)
- [10월 20일 - 디자인 토큰 세 층, 큰 파일 분리, 실제 OS 구조의 Finder, SSH 접속 복구](/memo/day-1020): #286·#289가 병합된 날의 회고
- [10월 21일 - Markdown 이력서, 텍스트 편집기, 위젯, 첫 방문자를 위한 둘러보기](/memo/day-1021): #296이 병합된 날의 회고

[^hig]: Apple Human Interface Guidelines의 [Typography](https://developer.apple.com/design/human-interface-guidelines/typography). iOS 기본 크기 기준으로 Title 1이 28pt, Large Title이 34pt이며, 기존 여덟 단계도 같은 iOS 크기를 사용한다.

[^stacking]: [쌓임 맥락(stacking context)](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context). 이 안의 자식 z-index는 맥락 안에서만 비교된다. z-index가 지정된 `position: absolute`·`fixed` 요소 등이 새로 만든다.

[^allowed]: Stylelint 규칙 [`declaration-property-value-allowed-list`](https://stylelint.io/user-guide/rules/declaration-property-value-allowed-list/)는 지정한 속성에 목록의 값만 허용한다. 반대인 [`declaration-property-value-disallowed-list`](https://stylelint.io/user-guide/rules/declaration-property-value-disallowed-list/)는 목록의 값을 차단한다.

#MacFolio #CSS #디자인토큰 #Stylelint
