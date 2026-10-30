---
title: 선택자 명시도 경쟁을 CSS @layer reset으로 끝내고 앱 기본값의 우선순위 낮추기
date: 2026-10-01
category: 개발 기록/MacFolio/스타일·컴포넌트
series: CSS 정리
seriesOrder: 1
summary: 게시 버튼 글자가 흐린 원인은 앱 루트의 .memo button { color: inherit }(0,1,1)이 버튼 클래스(0,1,0)를 이긴 데 있었다. 같은 구조로 !important가 72개 쌓여 있었다. 앱 기본값 규칙을 @layer reset으로 옮기고 화면 58장을 픽셀 단위로 비교했다.
---

메모 편집기를 다듬는 PR([#55](https://github.com/hyeoniverse/MacFolio/pull/55))에서 게시 버튼 하나의 글자색을 고쳤고, 그 원인인 앱 루트의 기본값 규칙은 공통 컴포넌트 작업([#57](https://github.com/hyeoniverse/MacFolio/pull/57))의 첫 커밋에서 CSS 층으로 옮겼다. 두 작업은 같은 날(10월 1일) 진행했다. 이 글은 증상에서 원인, 임시 수정, 근본 수정까지를 순서대로 정리한 것이다.

## 증상: 게시 버튼 글자가 흐림

메모 편집기 오른쪽 위의 **게시** 버튼은 수정한 내용이 있으면 노란 바탕으로 활성화된다. 그런데 활성화된 버튼의 글자가 흐려서 잘 읽히지 않았다.

![수정 전 게시 버튼](./images/memo-publish-before.jpg '노란 바탕 위 글자가 회색이라 흐리다')

CSS에는 진한 갈색을 지정해 두었다.

```css
.memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

바탕은 노란색으로 표시되는데 글자색만 지정한 값과 달랐다.

## 원인 찾기: 일치하는 규칙 나열

브라우저에서 버튼의 계산된 값([`getComputedStyle`](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle))을 조회하니 글자색이 `rgb(107, 114, 128)`이었다. 메모 앱의 보조 글자색(`--memo-muted`)이다. 이 버튼에 일치하는 규칙 중 `color`를 지정하는 규칙을 [`document.styleSheets`](https://developer.mozilla.org/en-US/docs/Web/API/Document/styleSheets)에서 모두 추출했다.

```ts
const rules = [];
for (const sheet of document.styleSheets)
	for (const rule of sheet.cssRules)
		if (rule.selectorText && rule.style.color && button.matches(rule.selectorText))
			rules.push(`${rule.selectorText} → ${rule.style.color}`);
```

```text
.memo button → inherit
.memo-writer-publish → rgb(43, 33, 0)
```

개발자 도구의 Computed 탭이 보여 주는 정보를 코드로 추출한 것이다. 원인은 메모 앱 CSS 맨 위의 다음 규칙이었다.

```css
.memo button {
	font: inherit;
	color: inherit;
	cursor: pointer;
}
```

버튼이 브라우저 기본 글꼴(Arial 등) 대신 앱의 글꼴·글자색을 상속하게 하는 규칙이다. 문제는 **명시도**(specificity)[^specificity]였다.

| 선택자                 | 클래스 | 태그 | 명시도        |
| ---------------------- | ------ | ---- | ------------- |
| `.memo button`         | 1      | 1    | **(0, 1, 1)** |
| `.memo-writer-publish` | 1      | 0    | **(0, 1, 0)** |

클래스 수가 같으면 태그가 하나 더 있는 `.memo button`이 우선한다. 파일 안의 선언 순서는 명시도가 같을 때만 비교한다. 그래서 갈색 대신 `inherit`이 적용되어 부모의 보조 글자색을 상속했다.

![두 규칙의 명시도](./images/memo-button-specificity.svg '클래스 수가 같으면 태그 수로 우선순위가 정해진다')

`font: inherit`도 같은 방식으로 덮어쓰고 있었다. `font`는 **`font-size`·`font-weight`까지 함께 지정하는** [단축 속성](https://developer.mozilla.org/en-US/docs/Web/CSS/Shorthand_properties)이다. 게시 버튼에는 `font-size: 11px; font-weight: 600`을 지정했지만, 계산된 값은 부모를 상속한 `12px`, `400`이었다.

## 당장의 수정과 한계

| 방법                                 | 장점                      | 단점                                                        |
| ------------------------------------ | ------------------------- | ----------------------------------------------------------- |
| `.memo button`의 명시도를 낮춘다     | 근본 원인을 해결한다      | 그동안 덮여 있던 버튼 글꼴 선언이 한꺼번에 적용된다         |
| 게시 버튼에 `!important`             | 선언 하나만 추가하면 된다 | 이후 이 버튼 색을 바꾸는 규칙에도 `!important`가 필요해진다 |
| **게시 버튼 규칙의 명시도를 높인다** | 이 버튼만 바뀐다          | 버튼마다 부모 클래스를 붙이는 작업이 필요하다               |

첫 번째 방법은 다른 버튼에서도 클래스에 지정한 글꼴이 덮여 있을 수 있어, 적용하면 앱 전체의 버튼 모양이 바뀐다. 편집기 PR의 수정 대상은 게시 버튼 하나라서 세 번째 방법을 적용했다.

```css
/* 글자색은 .memo button(color: inherit)보다 앞서도록 .memo-writer-actions를 붙인다 */
.memo-writer-actions .memo-writer-publish {
	background-color: #edbb4d;
	color: #2b2100;
}
```

명시도가 (0, 2, 0)이 되어 `.memo button`보다 우선한다. 같은 줄의 "변경 사항 버리기" 버튼 규칙도 구조가 같아서 함께 높였다.

![수정 후 게시 버튼](./images/memo-publish-after.jpg '노란 바탕 위에 진한 갈색 글자')

이 방법은 버튼 하나를 고칠 뿐이다. 같은 기본값 규칙이 메일(`.mail button`), 메시지, 음악, 터미널 단축어에도 있고, Safari에는 링크용(`.safari a`)이 있다. 그동안 버튼마다 지정한 색과 글꼴이 무시되는 곳은 `!important`로 덮어쓰거나 선택자를 길게 작성해 명시도를 맞춰 왔다. 앱 전체를 집계하니 `!important`가 72개였다.

| 앱   | 메모 | 메시지 | 음악 | GitHub | 메일 | 터미널 | Safari |
| ---- | ---- | ------ | ---- | ------ | ---- | ------ | ------ |
| 개수 | 27   | 13     | 11   | 7      | 6    | 4      | 4      |

대부분이 버튼·링크의 색과 글꼴이었다. 원인은 기본값 규칙 여섯 개이고, 이 규칙의 우선순위를 낮추지 않으면 `!important`는 계속 늘어난다.

## 명시도 대신 층

CSS 층([`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer))을 사용하면 규칙 간 비교 순서가 바뀐다. 브라우저는 **층을 먼저 비교하고**, 같은 층일 때만 명시도를 비교한다. 층 밖에 있는 일반 규칙은 어느 층의 규칙보다도 우선한다.

![층 밖의 규칙이 층 안의 규칙을 이긴다](./images/css-layer-cascade.svg '기본값만 reset 층에 넣으면 점수가 높아도 진다')

기본값 규칙 여섯 개를 `reset` 층으로 옮겼다.

```css
/* styles/layers.css: 다른 CSS보다 먼저 불러와 층 순서를 정한다 */
@layer reset;

/* apps/memo/Memo.css */
@layer reset {
	.memo button {
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
}
```

검토한 방법은 세 가지였다.

| 방법                                                                                                 | 장점                                        | 단점                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| 버튼마다 `!important`를 계속 추가                                                                    | 기존 방식 그대로                            | 72개가 계속 늘어난다. 상태(hover·active)마다 다시 명시도를 맞춰야 한다      |
| [`:where(.memo) button`](https://developer.mozilla.org/en-US/docs/Web/CSS/:where)으로 명시도를 0으로 | 층 없이 해결된다. 브라우저 지원 범위가 넓다 | "기본값"이라는 의도가 코드에 드러나지 않는다. 층을 추가할 때 활용할 수 없다 |
| `@layer reset` (**채택**)                                                                            | 의도가 이름으로 드러난다. 층 추가가 쉽다    | 층 순서를 정의하는 파일을 가장 먼저 로드해야 한다                           |

`:where(.memo) button`으로 명시도를 0으로 낮춰도 같은 결과가 나온다. 하지만 층은 "이 규칙은 기본값"이라는 의도가 이름(`reset`)으로 드러난다. 또 다음 단계에서 공통 컴포넌트 층을 추가할 때도 한 줄(`@layer reset, components;`)로 순서를 정의할 수 있어서 층을 채택했다.

변경한 파일은 여섯 개다. `Memo.css`(`.memo button`), `Mail.css`, `Messages.css`, `Music.css`, `Shortcuts.css`(`.shortcuts button`), `Safari.css`(`.safari a`). 층 순서를 정의하는 `styles/layers.css`는 `main.tsx`가 다른 CSS보다 먼저 import하도록 첫 줄에 추가했다.

```ts
// main.tsx (이 커밋 시각)
import './styles/layers.css';
import './styles/theme.css';
import './styles/motion.css';
import './index.css';
```

이 "가장 먼저"가 빌드 결과에서는 보장되지 않는다는 사실은 11일 뒤에 발견했다([CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기](/memo/css-layer-order-fix)).

이제 게시 버튼 규칙은 `.memo-writer-publish` 하나만으로도 `reset` 층의 `.memo button`보다 우선한다. 앞에서 추가한 `.memo-writer-actions .memo-writer-publish`는 명시도가 높아도 부작용이 없어 주석과 함께 남겨 두었다.

![캐스케이드 레이어 순서](./images/memo-button-specificity-layers.svg '레이어 순서가 명시도보다 먼저 비교되므로, 버튼 클래스 하나로도 reset보다 우선한다')

## 변경 범위를 사전에 알 수 없다

이 변경은 코드 몇 줄이지만, 영향은 앱 전체에 분산되어 있다. 지금까지 기본값에 덮여 있던 값이 **한꺼번에 적용되기** 때문이다. 어디서 어떤 값이 적용될지는 CSS만 읽어서는 파악하기 어렵다.

그래서 화면을 캡처해 비교했다. E2E의 가짜 API로 장면 20개를 구성하고, 라이트·다크 모드로 각각 캡처했다(40장).

- 데스크톱, Apple 메뉴, 음량 조절, 음악, 메시지, 메일, 터미널, 설정, GitHub, Safari
- 메모: 읽기, 우클릭 메뉴, 정렬 메뉴, ••• 메뉴, 갤러리
- 메모 편집기: 서식 메뉴, 날짜 고르기, 폴더 고르기, 표 손잡이 메뉴

휴대폰(iPhone 크기)에서도 홈 화면, 단축어, 메모, 메일, 메시지, 음악, 설정, Safari, 제어 센터를 같은 방법으로 캡처했다(18장).

두 폴더의 같은 장면을 Chromium의 canvas로 읽어, RGB 차이의 합이 30을 넘는 픽셀을 빨간색으로 칠하고 그 비율을 집계했다.

```ts
for (let i = 0; i < a.length; i += 4) {
	const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
	if (d > 30) diff++; // 그리고 그 픽셀을 빨갛게
}
```

먼저 **코드를 변경하지 않고** 두 번 캡처해 비교했다. 거의 모든 장면에서 0.03% 차이가 나왔다. 원인은 메뉴 막대의 시계였다. 캡처할 때마다 분이 바뀌거나 1초 단위로 다시 렌더링된다. Playwright의 [`page.clock.setFixedTime()`](https://playwright.dev/docs/clock)으로 시각을 고정하자 차이가 0.001%만 남았다. 이 기준선 이후의 차이는 모두 실제 변경으로 판단할 수 있다.

![같은 장면을 전후로 찍고, 시각을 고정하고, 픽셀 차이를 세는 순서](./images/css-layer-reset-compare-steps.svg '먼저 같은 코드로 두 번 찍어 잡음을 없앤 뒤 전후를 비교했다')

## 변경된 화면은 네 곳

변경 후 58장을 다시 캡처했다. 데스크톱의 메일·메시지·음악·터미널·Safari·설정과 휴대폰의 홈·단축어·메모·메일·메시지·설정·Safari·제어 센터는 **0%**였다. 변경된 곳은 네 곳이다. 세 곳은 CSS에 지정해 둔 값이 이제야 적용된 것이고, 한 곳(음량 조절)은 함께 삭제한 미사용 CSS 때문이다.

| 화면                  | 픽셀 차이 | 원인                                                 |
| --------------------- | --------- | ---------------------------------------------------- |
| 메모 편집기           | 1~1.7%    | 게시 버튼의 `font-size: 11px; font-weight: 600` 적용 |
| 폴더 펼치기 화살표    | 0.006%    | 화살표의 `font-size: 8px` 적용                       |
| 휴대폰 음악 재생 목록 | 0.7%      | 목록 글자의 `17px` 적용                              |
| 음량 조절             | 93%       | 상태 막대 CSS에 남아 있던 이전 음량 창 규칙 삭제     |

**메모 편집기 (1~1.7%)**: 화면 대부분이 빨간색으로 표시됐지만 실제 변경은 하나였다. 게시 버튼에 지정해 둔 `font-size: 11px; font-weight: 600`이 적용되어 버튼 높이가 조금 줄었고, 그 아래 날짜·제목·본문이 2px 위로 이동했다.

![차이 그림](./images/css-layer-diff.jpg '빨간 픽셀이 다른 곳. 게시 버튼이 줄어 그 아래가 통째로 2px 올라왔다')

![게시 버튼](./images/css-layer-publish.jpg '전: 부모 글꼴을 따른 12px. 후: 적어 둔 대로 11px, 굵게')

**폴더 펼치기 화살표 (0.006%)**: `font-size: 8px`로 지정한 화살표가 부모 글꼴 크기로 렌더링되고 있었다. 크기가 줄어 macOS 사이드바 화살표에 더 가까워졌다.

![폴더 화살표](./images/css-layer-disclosure.jpg '전: 부모 글꼴 크기. 후: 적어 둔 8px')

**휴대폰 음악의 재생 목록 (0.7%)**: 휴대폰에서는 iOS 음악 앱처럼 목록 글자를 `17px`로 키우는 규칙이 있었다. 이 규칙도 `.music button`의 `font: inherit`에 덮여 데스크톱 크기 그대로였다.

![휴대폰 음악 재생 목록](./images/css-layer-music.jpg '전: 부모 글꼴 크기. 후: 적어 둔 17px (iOS 음악 앱의 목록 크기)')

**음량 조절 (93%)**: 이 변경은 층이 아니라 함께 삭제한 **미사용 CSS** 때문이다. 상태 막대의 CSS에 이전 음량 창의 규칙이 남아 있었고, 실제 음량 창의 CSS보다 늦게 로드되어 그 값을 덮어쓰고 있었다.

- 화면 전체를 어둡게 덮는 배경
- 세로로 회전한 슬라이더의 폭을 `9rem`에서 `100%`(2rem)로 줄이는 규칙

이 두 규칙 때문에 음량 창을 열면 화면이 어두워지고 슬라이더의 조작 영역도 좁았다. 남은 규칙을 삭제하자 원래 의도대로 화면을 덮지 않는 작은 조절기가 됐다.

![음량 조절](./images/css-layer-volume.jpg '전: 화면 전체가 어두워진다. 후: 조절기만 뜬다')

## 함께 정리한 항목

- 정의되지 않은 `--duration-normal`을 사용하던 곳(표 선택 테두리 애니메이션 다섯 줄)을 기존 토큰 `--duration`으로 바꿨다.
- 두 파일(알림, 휴대폰 화면)에 중복 정의된 `.visually-hidden`을 전역 CSS 하나로 통합했다.
- 사용처가 없는 규칙을 삭제했다: 상태 막대의 `.close-button`·`.volume-modal`, 터미널 단축어의 `.shortcut-back`.

커밋은 파일 8개, +61/−43줄이다. CSS 여섯 파일에서 기본값 규칙을 `@layer reset { … }`으로 감싼 것이 대부분이고, `layers.css`(10줄)와 `main.tsx`(1줄)가 추가됐다.

| 장면 묶음              | 장 수 | 변경된 장면                                                      |
| ---------------------- | ----- | ---------------------------------------------------------------- |
| 데스크톱 (라이트·다크) | 40    | 메모 편집기 1~1.7%, 폴더 화살표 0.006%, 음량 조절 93%. 나머지 0% |
| 휴대폰 (라이트·다크)   | 18    | 음악 재생 목록 0.7%. 나머지 0%                                   |

## !important는 이 커밋에서 유지

이제 `!important` 대부분은 불필요하다. 하지만 한꺼번에 삭제하지 않았다. `!important`는 기본값뿐 아니라 **같은 버튼의 다른 상태**(hover, active) 규칙과도 우선순위를 다투고 있을 수 있다. 하나씩 삭제하면서 해당 버튼의 모든 상태를 확인해야 한다.

다음 단계에서 공통 컴포넌트(`IconButton`, `Button`, `Menu`)를 구현하고 버튼을 이전한다. 그 과정에서 버튼 CSS를 새로 작성하며 `!important`를 제거한다. 전후 비교도 같은 방법으로 진행한다.

## 이후 !important 감소 추이

이 글을 보완하면서 저장소의 CSS에서 `!important`가 포함된 줄을 다시 집계했다(`git grep -c`). 글 작성 시각에 집계한 72개는 앱 CSS만 대상이었고, 전역 CSS까지 줄 단위로 집계하면 74줄이다.

![!important가 든 줄: 이 커밋 전 74, 공통 IconButton PR 뒤 4, 지금 23](./images/css-layer-reset-important-count.svg '줄 단위로 센 !important. 지금 남은 것은 대부분 Safari 프로젝트 페이지와 움직임 줄이기 규칙')

다음 PR([#60](https://github.com/hyeoniverse/MacFolio/pull/60), [계산된 스타일 비교로 화면 변화 없이 아이콘 버튼을 IconButton으로 옮기기](/memo/icon-button-migrate))에서 4줄까지 줄었다. 현재는 23줄이다.

| 위치                     | 줄 수 | 용도                                                      |
| ------------------------ | ----- | --------------------------------------------------------- |
| `layers.css`             | 2     | 주석                                                      |
| `motion.css`             | 5     | 움직임 줄이기 설정에서 애니메이션 비활성화                |
| Safari 프로젝트 페이지들 | 16    | 이후 추가된 페이지 안에서 컴포넌트 스타일을 덮어쓰는 용도 |

프로젝트 페이지 쪽은 앱 기본값과의 우선순위 문제가 아니라 페이지 안에서 컴포넌트 스타일을 덮어쓰는 용도라, 별도로 검토한다.

## 정리

- "지정한 값이 적용되지 않는다"는 대개 다른 규칙이 우선한다는 뜻이다. 계산된 값을 조회하고 그 요소에 일치하는 규칙을 모두 추출하면 적용된 규칙이 바로 드러난다.
- `font`·`background`·`border` 같은 단축 속성은 지정하지 않은 하위 속성까지 초기화한다. 앱 루트의 기본값에 단축 속성을 쓰면 영향 범위가 넓다.
- `!important`가 많다는 것은 증상이지 원인이 아니다. 72개를 하나씩 삭제하기 전에 필요했던 이유를 추적하니 원인은 기본값 규칙 여섯 개였다.
- 영향이 앱 전체에 분산되는 CSS 변경은 화면 캡처 비교가 가장 빠른 검증 방법이다. 다만 비교 전에 같은 코드로 두 번 캡처해 노이즈(시계)를 먼저 제거해야, 남은 차이를 모두 실제 변경으로 해석할 수 있다.
- 기본값에 덮여 있던 값이 적용되는 것은 "결함"이 아니라 "원래 의도가 이제야 반영된 것"일 수 있다. 변경된 네 곳 중 세 곳이 그랬다.

## 관련 글

- [계산된 스타일 비교로 차이를 찾으며 !important 일괄 삭제하기](/memo/shared-button)
- [계산된 스타일 비교와 명시도 0인 :where() 규칙으로 버튼 75곳을 IconButton·Button으로 옮기기](/memo/icon-button-migrate)
- [CSS 파일 로드 순서와 무관하게 @layer 순서를 index.html에서 먼저 선언하기](/memo/css-layer-order-fix)
- [@import 순서를 유지한 CSS 파일 분할과 빌드 결과 md5 비교 검증](/memo/memo-css-split)

[^specificity]: 같은 요소에 여러 규칙이 일치할 때 어느 규칙을 적용할지 정하는 점수. (ID 수, 클래스·속성·의사 클래스 수, 태그·의사 요소 수) 세 자리를 앞자리부터 비교한다. 자세한 계산 방법은 [MDN의 Specificity 문서](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity)에 있다.

#MacFolio #메모앱 #CSS #공통컴포넌트 #트러블슈팅
