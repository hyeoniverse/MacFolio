---
title: CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기 (리팩터링 5단계)
date: 2026-10-18
category: 개발 기록/MacFolio/디자인 시스템
summary: 리팩터링 5단계 회고. CSS 값은 하나도 바꾸지 않고 z-index·모서리·글자 크기·간격·그림자·색에 이름을 붙였고, 4,600줄 Memo.css를 열다섯 파일로 분할했으며, 중복과 사용하지 않는 규칙을 삭제했다. 동일 여부는 자동 비교로 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 5단계는 CSS였다. 값은 하나도 바꾸지 않고 이름을 붙이고, 분할하고, 삭제했다.

## 배경

| 항목               | 계획 시각의 상태        |
| ------------------ | ----------------------- |
| CSS 전체           | 26,464줄                |
| 직접 작성한 hex 색 | 650곳                   |
| CSS 변수           | 309종                   |
| `border-radius`    | 6·8·10·14·999px 등 혼재 |
| `z-index` 값       | 23가지                  |
| `Memo.css`         | 4,166줄 한 파일         |

값이 흩어져 있으니 새 화면을 만들 때마다 같은 조사를 반복했다. 새 팝업의 `z-index`를 얼마로 지정해야 Dock 위에 표시되는지 알려면 `Dock.css`, `StatusBar.css`, `Menu.css`, `LoadingScreen.css`를 차례로 열어 숫자를 비교해야 했다. 모서리는 6px·8px·10px이 같은 용도로 혼용됐고, 다크 모드 색은 파일마다 별도로 정의되어 있었다. `Memo.css`는 휴대폰 화면 규칙과 데스크톱 규칙이 같은 파일의 수천 줄 사이에 섞여 있어, 편집기를 수정하는 PR마다 diff가 커졌다.

## 채택한 방법과 제외한 방법

| 방법                               | 장점                                 | 단점                                                                                  |
| ---------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Tailwind 같은 유틸리티 CSS로 전환  | 토큰이 클래스 이름이 되어 강제된다   | 26,000줄 넘는 CSS와 컴포넌트를 다시 작성해야 하고, 화면이 같다는 것을 증명하기 어렵다 |
| 가까운 값끼리 통합                 | 토큰 수가 줄어 체계가 단순해진다     | 1~2px씩 이동하는 화면이 생겨, 동작을 바꾸지 않는다는 이번 규칙에 어긋난다             |
| 값은 유지하고 이름만 붙이기 (채택) | 화면이 같으므로 자동 비교가 가능하다 | 비슷한 값이 각자 이름 없이 남는다                                                     |

1~6단계의 공통 규칙은 "동작을 바꾸지 않는다"였다. 값 통합은 화면을 보며 하나씩 결정해야 해서 이후 작업으로 미뤘다. 이번에는 이미 같은 값으로 반복된 것에만 이름을 붙였다.

## 변경 목록

| 항목                   | PR                                                       | 글                                                                                                          |
| ---------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `z-index` 레이어       | [#231](https://github.com/hyeoniverse/MacFolio/pull/231) | [z-index 숫자를 theme.css의 CSS 변수로 모아 겹침 순서를 한 표로](/memo/z-index-layers)                      |
| 모서리                 | [#232](https://github.com/hyeoniverse/MacFolio/pull/232) | [border-radius 239곳을 --radius-xs~full 여섯 디자인 토큰으로 바꾸기](/memo/radius-tokens)                   |
| 글자 크기              | [#234](https://github.com/hyeoniverse/MacFolio/pull/234) | [Apple HIG 글자 스타일 이름으로 font-size 645곳을 여덟 디자인 토큰으로 바꾸기](/memo/font-size-tokens)      |
| `Memo.css` 분할        | [#238](https://github.com/hyeoniverse/MacFolio/pull/238) | [@import 순서를 유지한 Memo.css 분할과 빌드 CSS md5 비교 검증](/memo/memo-css-split)                        |
| Safari 페이지 CSS 중복 | [#241](https://github.com/hyeoniverse/MacFolio/pull/241) | [getComputedStyle 비교로 동일성을 확인하며 두 CSS 파일의 중복 규칙 103개 지우기](/memo/creative-css-dedupe) |
| 사용하지 않는 선택자   | [#242](https://github.com/hyeoniverse/MacFolio/pull/242) | [2,761개 중 정말 안 쓰는 것은 9개](/memo/unused-css-selectors)                                              |
| 그림자와 간격          | [#248](https://github.com/hyeoniverse/MacFolio/pull/248) | [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/shadow-space-tokens)                 |
| 색                     | [#249](https://github.com/hyeoniverse/MacFolio/pull/249) | [반복된 hex 288곳을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/color-tokens)            |

## 구현

5단계 시점의 토큰은 모두 `src/styles/theme.css`의 `:root`에 정의했다. 레이어는 숫자 대신 의미로 읽힌다.

```css
/* apps/react/src/styles/theme.css */
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 14px;
--radius-full: 999px; /* 알약 */

--z-dock: 1000;
--z-menubar: 1001;
--z-alert: 2500; /* 화면 한가운데 경고창: 창·Dock·메뉴 막대 위 */
--z-menu: 10000; /* 펼친 메뉴·팝오버·라이트박스: 어떤 창보다 위 */
--z-login: 20000; /* 로그인: 가장 위 */
```

글자 크기는 Apple의 텍스트 스타일 이름(`caption2`~`title2`)을 따라 여덟 개를 정의했다. 간격은 반대로 `--space-8`처럼 px 값을 이름에 넣었다. 간격은 2px 단위로 열 단계가 촘촘해서 `sm`·`md` 같은 크기 이름으로는 구분이 부족했다.

교체 기준은 "문자열까지 같은 값만"이었다. 간격은 선언의 값이 모두 열 단계 값일 때만 교체했고, `0`이나 `auto`가 섞인 단축 속성 표기는 유지했다. 메모의 버전 목록 버튼을 예로 들면 다음과 같다.

```css
/* apps/react/src/apps/memo/styles/note.css */
.memo-format-panel .memo-revision-list button {
	gap: 1px; /* 열 값에 없어 그대로 */
	padding: var(--space-6) var(--space-10); /* 6px 10px */
	border-radius: var(--radius-md); /* 8px */
}
```

`Memo.css`는 도구 막대·사이드바·목록·본문·편집기·휴대폰 화면 같은 구역 경계에서 잘라 `memo/styles/` 열다섯 파일로 분할하고, 원래 파일에는 순서대로 import하는 목록만 남겼다. 규칙 순서가 바뀌면 명시도가 같은 규칙끼리 우선순위가 바뀌므로, 분할만 하고 순서는 변경하지 않았다.

### 동일성 검증

모든 PR의 확인 방법은 변경 전후의 동일성 비교였다.

| 작업            | 비교 대상                                                     |
| --------------- | ------------------------------------------------------------- |
| 토큰 이름 부여  | 요소마다 계산된 스타일 (값을 유지했으므로 차이 0이어야 함)    |
| `Memo.css` 분할 | 빌드한 CSS의 바이트 (md5)                                     |
| 중복 제거       | 요소마다 계산된 스타일, 라이트·다크 × 데스크톱·휴대폰 네 조합 |

![이름 붙이기, 파일 나누기, 중복 지우기를 확인한 세 방법](./images/refactor-step5-styles-checks.svg '세 방법 모두 다르면 실패하는 기계 비교다')

사용하지 않는 선택자(#242)는 다른 방법으로 찾았다.

1. CSS의 클래스 이름 2,761개 중 코드 어디에도 문자열이 없는 150개를 추출했다.
2. `이름-${…}`처럼 코드가 조합하는 이름과 라이브러리(highlight.js, ProseMirror)가 붙이는 이름을 제외해 9개를 남겼다.
3. 9개는 하나씩 코드를 읽어 확인한 뒤 규칙 24개를 삭제했다.

## 전후

|                       | 전                       | 후                                                     |
| --------------------- | ------------------------ | ------------------------------------------------------ |
| `z-index`             | 13개 파일에 숫자         | 20곳이 `--z-*` 15개                                    |
| 모서리                | 576곳, 마흔 가지 넘는 값 | 239곳이 `--radius-xs`~`--radius-full`                  |
| 글자 크기             | 958곳                    | 645곳이 `--text-caption2`~`--text-title2` 여덟 이름    |
| 간격·그림자           | 직접 작성한 값           | 간격 1,543곳이 `--space-*`, 그림자 19곳이 `--shadow-*` |
| 앱 CSS의 hex 색       | 513곳                    | 288곳을 `--color-*`로, 225곳 유지                      |
| `Memo.css`            | 4,600줄 한 파일          | `memo/styles/` 열다섯 파일                             |
| `HyeoniversePage.css` | 1,444줄                  | 735줄                                                  |
| 사용하지 않는 클래스  | 9개                      | 0개 (규칙 24개와 이미지 한 장 삭제)                    |

![모서리, 글자 크기, hex 색이 토큰 이름으로 바뀐 비율 막대 그래프](./images/refactor-step5-styles-coverage.svg '값은 그대로 두고 이름만 바꿨다. 남은 곳은 일부러 다른 값이다')

## 의도적으로 남긴 것

- 프로젝트 소개 페이지의 브랜드 색은 의도적으로 별도 사용하는 값이라 토큰으로 묶지 않았다. `rgb()`·`rgba()` 425곳도 범위에서 제외했다.
- 같은 의미의 `z-index` 값을 통합하면 렌더링 순서가 바뀔 수 있어 보류했다.
- 메모의 `late.css`는 위치를 옮기면 적용 순서가 바뀌어 유지했다.
- 사용하지 않는 선택자 검출에는 [Stylelint](https://stylelint.io/)를 쓰지 않았다. CSS만 읽으므로 클래스가 코드에서 사용되는지 알 수 없기 때문이다.

## 확인과 남은 것

- 토큰 PR마다 계산된 스타일 비교에서 차이 0, `Memo.css` 분할은 빌드한 CSS의 md5가 같았다.
- 이 글을 쓴 시각에 CSS에서 `var(--space-`는 1,908곳, `var(--color-`는 863곳, `var(--text-`는 646곳, `var(--radius-`는 246곳 사용됐다. 5단계 이후에 생긴 화면도 토큰을 사용하고 있다는 의미다.
- 이 글을 쓴 시각에는 토큰을 쓰지 않은 새 값을 차단하는 장치가 없었다.

## 이후 변경

| 병합일    | PR                                                       | 변경                                                                                                                                                                          |
| --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10월 20일 | [#280](https://github.com/hyeoniverse/MacFolio/pull/280) | Stylelint 규칙 추가. 이름이 있는 `font-size`·`border-radius`·`z-index`·간격 값을 숫자로 작성하면 `pnpm lint`가 실패한다. 이름이 없는 값만 허용하므로 예외 목록이 필요 없다    |
| 10월 20일 | [#286](https://github.com/hyeoniverse/MacFolio/pull/286) | 토큰을 원시(`primitives.css`)·의미(`semantic.css`)·컴포넌트(`components.css`) 세 층으로 분리. 위 코드의 `--radius-md` 같은 크기 이름은 `--radius-8` 같은 값 이름으로 바뀌었다 |
| 10월 20일 | [#294](https://github.com/hyeoniverse/MacFolio/pull/294) | `Settings.css` 분할과 그림자 토큰 묶기 반영                                                                                                                                   |

## 배운 것

- **이름 부여와 값 수정을 분리한다.** 이름만 붙이면 자동 비교로 증명할 수 있고, 값 수정은 그 뒤에 화면을 보며 진행한다.
- **순서가 곧 규칙이다.** CSS는 명시도가 같으면 나중에 선언된 규칙이 적용된다([캐스케이드](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)). 파일을 분할할 때도, 중복을 삭제할 때도 순서 유지가 가장 중요한 조건이었다.

이전 단계: [4단계 — 공통 컴포넌트 설계](/memo/refactor-step4-components) · 다음 단계: [6단계 — 서버](/memo/refactor-step6-server)

## 관련 글

- [z-index 숫자를 theme.css의 CSS 변수로 모아 겹침 순서를 한 표로](/memo/z-index-layers)
- [border-radius 239곳을 --radius-xs~full 여섯 디자인 토큰으로 바꾸기](/memo/radius-tokens)
- [Apple HIG 글자 스타일 이름으로 font-size 645곳을 여덟 디자인 토큰으로 바꾸기](/memo/font-size-tokens)
- [그림자와 간격 값을 집계해 CSS 변수 디자인 토큰으로 이름 붙이기](/memo/shadow-space-tokens)
- [반복된 hex 288곳을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/color-tokens)
- [4,600줄 Memo.css를 열다섯 파일로 — 차례를 지켜 나누고 결과가 같은지 확인하기](/memo/memo-css-split)
- [getComputedStyle 비교로 동일성을 확인하며 두 CSS 파일의 중복 규칙 103개 지우기](/memo/creative-css-dedupe)
- [2,761개 중 정말 안 쓰는 것은 9개](/memo/unused-css-selectors)
- [Stylelint declaration-property-value-allowed-list로 디자인 토큰 강제하기](/memo/off-scale-values): 이 단계 뒤에 남은 숫자를 토큰으로 옮기고 규칙으로 강제한 작업

#MacFolio #리팩터링 #CSS #디자인토큰
