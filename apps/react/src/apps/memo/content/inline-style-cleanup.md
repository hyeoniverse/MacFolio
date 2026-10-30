---
title: 인라인 style을 CSS 클래스와 CSS 변수 전달 함수 cssVars()로 옮기기
date: 2026-10-08
category: 개발 기록/MacFolio/스타일·컴포넌트
series: CSS 정리
seriesOrder: 2
summary: 여러 컴포넌트에 분산된 인라인 스타일을 세 종류로 나눴다. 고정 값은 CSS로, 데이터마다 바뀌는 색·크기는 cssVars()로 CSS 변수만 전달하고, 계산된 좌표만 인라인에 남겼다. 전후 스크린샷 37장이 바이트 단위로 일치했고, 타입 단언 61곳이 0이 됐다.
---

리팩터링 이슈([#15](https://github.com/hyeoniverse/MacFolio/issues/15))의 마지막 항목은 인라인 스타일 정리였다([#138](https://github.com/hyeoniverse/MacFolio/pull/138)). `style={{ ... }}`가 컴포넌트마다 섞여 있어서, 어떤 스타일이 CSS에서 오고 어떤 스타일이 JSX에서 오는지 두 파일을 번갈아 확인해야 했다. 인라인 스타일은 `!important`가 없는 모든 CSS 규칙보다 우선하므로, CSS 파일만으로는 요소의 최종 스타일을 파악할 수 없다.

정리 전 `apps/react/src`의 `.tsx`에서 `style={`가 있는 줄은 114줄, `as React.CSSProperties`·`as string]` 같은 타입 단언은 61곳이었다.

## 인라인 스타일의 종류

하나씩 분류하자 세 종류였다.

| 종류               | 예                                                      | 정리 방법                   |
| ------------------ | ------------------------------------------------------- | --------------------------- |
| 고정 값            | 바탕화면 `width: 100%`, 창 제목 막대 `cursor: grab`     | CSS 파일로 이동             |
| 데이터마다 다른 값 | 언어 색 점, 아바타 크기, 단축어 타일 그라데이션 색      | CSS 변수만 전달, 규칙은 CSS |
| 매번 계산되는 좌표 | 메뉴·팝오버 위치, 진행 막대 너비, 창 위치·크기, z-index | 인라인 유지                 |

![인라인 스타일 세 종류와 이동 위치](./images/inline-style-cleanup-kinds.svg '값이 결정되는 시점에 따라 CSS 파일, CSS 변수, 인라인으로 나눴다')

세 번째는 인라인이 적합한 경우다. 마우스 위치에서 계산한 `left`/`top`을 CSS 규칙으로 옮길 방법은 없다.

분류 기준은 세 가지를 비교했다.

| 방법                                       | 장점                                                  | 단점                                                                |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| 인라인을 모두 CSS 변수로                   | 규칙이 하나                                           | 좌표처럼 매번 바뀌는 값까지 변수로 바꾸면 간접 단계만 하나 늘어난다 |
| CSS-in-JS 라이브러리(styled-components 등) | 값과 규칙이 한 파일에 있다                            | 기존 CSS 파일·`@layer` 구조를 전부 바꿔야 하고 번들 크기가 커진다   |
| **값이 결정되는 시점으로 분류**            | 고정 → CSS, 데이터 → 변수, 계산 → 인라인. 판단이 쉽다 | 변수 이름을 CSS와 JSX가 공유해야 한다                               |

## CSS 변수 전달 함수

두 번째 종류는 이미 CSS 변수를 쓰는 곳이 많았는데, 작성 형식이 제각각이었다.

```tsx
style={{ '--i': i, '--n': STEPS } as React.CSSProperties}
style={{ ['--color' as string]: color }}
```

React의 `CSSProperties` 타입에는 `--`로 시작하는 [사용자 지정 속성](https://developer.mozilla.org/ko/docs/Web/CSS/Using_CSS_custom_properties) 키가 없어서 매번 타입 단언이 필요했다. 이것을 작은 함수 하나로 통합했다.

```ts
export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
	const style: Record<string, string | number> = {};
	for (const [name, value] of Object.entries(vars)) if (value !== undefined) style[`--${name}`] = value;
	return style as CSSProperties;
}
```

`undefined` 값은 제외하므로, 색 표에 없는 언어면 CSS 쪽 `var(--color, 기본값)`의 기본값이 적용된다. 타입 단언은 이 함수 안 한 곳에만 남는다.

```tsx
<span className="gh-language-dot" style={cssVars({ color: LANGUAGE_COLORS[repo.language] })} />
```

```css
.gh-language-dot {
	background-color: var(--color, var(--gh-muted));
}
```

아바타도 같은 방식이다. 이전에는 크기를 받아 `width`, `height`, `fontSize`를 JSX에서 계산해 지정했는데, 이제 `--size`만 전달하고 글자 크기는 CSS에서 `calc(var(--size) * 0.46)`으로 계산한다. 이니셜이 두 글자일 때 글자 크기를 줄이는 규칙도 `data-letters="2"` 속성 선택자로 옮겼다.

Safari 프로젝트 페이지의 단계 애니메이션처럼 같은 패턴이 수십 번 반복되는 곳은 스크립트로 일괄 치환했다. 결과적으로 `as React.CSSProperties`와 `as string]`은 코드에서 모두 삭제됐다.

## 사용되지 않던 props

창(`Window`)과 휴대폰 앱 프레임(`MobileAppFrame`)에는 `appStyle`, `contentStyle`, `titleBarStyle` props가 있었는데, 전달하는 곳이 하나도 없었다. 처음에 앱별 스타일 변경을 위해 만들어 둔 확장 지점이었다. 삭제했다.

## 로딩 화면의 lint 경고

로딩 화면은 화면을 클릭한 뒤 안내 문구를 `visibility: hidden` 인라인 스타일로 숨겼는데, 클릭 여부를 렌더링 중에 `ref`에서 읽고 있어서 lint 경고 두 개가 계속 남아 있었다. [ref는 값이 바뀌어도 다시 렌더링을 일으키지 않으므로](https://react.dev/learn/referencing-values-with-refs), 다른 이유로 다시 렌더링되는 시각에야 문구가 사라지는 구조였다. `started` 상태를 추가하고 `.loading-text.started { visibility: hidden }`으로 바꾸자 경고가 6개에서 4개로 줄었다.

## 구현 정리

커밋 하나(`1ae29e1ac`)로 병합했다. 44개 파일, +267/−196이다. 작업 순서는 다음과 같다.

1. `shared/lib/cssVars.ts`를 작성했다.
2. 고정 값을 CSS로 옮겼다(바탕화면, 창 제목 막대 등).
3. 데이터 값을 `cssVars()`로 바꿨다(GitHub 언어 점, 아바타, 단축어 타일, Safari 단계 애니메이션).
4. 사용되지 않던 `appStyle`·`contentStyle`·`titleBarStyle` props를 삭제했다.
5. 로딩 화면의 `ref` 읽기를 상태로 바꿨다.

## 화면 동일성 확인

스타일 이동은 화면에 변화가 없어야 정상이다. 그래서 변경 전(main)과 변경 후를 같은 시각으로 고정한 브라우저에서 캡처해 파일을 바이트 단위로 비교했다.

- Safari 프로젝트 페이지 7개 × 스크롤 위치 4곳
- 데스크톱 바탕화면, 메일·메시지·GitHub·사진 창, 사진 확대
- 휴대폰 홈, 제어 센터, 단축어

37장 모두 일치했다. 남은 인라인 `style`은 105곳이고, 그중 68곳이 `cssVars()`, 나머지는 모두 계산된 좌표다. 바이트 비교는 픽셀 하나만 달라도 실패하므로, 일치한다는 것은 글자 안티에일리어싱까지 같다는 의미다. 시각을 고정하지 않으면 메뉴 막대 시계가 달라져 모든 데스크톱 화면이 불일치한다.

## 열하루 뒤 재집계

10월 19일에 같은 방법으로 집계하자 `style={`는 221줄, 타입 단언은 27곳, `cssVars()`는 70곳이었다.

![인라인 스타일과 타입 단언 수](./images/inline-style-cleanup-counts.svg '정리 직후 타입 단언은 0이었지만, 이후 새로 작성한 코드에서 27곳이 다시 생겼다')

증가한 116줄 중 92줄이 Safari 프로젝트 페이지(템플릿)다. 타입 단언은 QuickTime 재생 막대(`'--fill'`), 메모, PDF 미리보기, Safari 템플릿에서 다시 생겼다. 모두 `cssVars()`를 사용하지 않고 새로 작성한 코드다.

## 남은 것·배운 것

- 공통 함수를 만드는 것만으로는 새 코드에 적용되지 않는다. `as React.CSSProperties`를 lint 규칙([`no-restricted-syntax`](https://eslint.org/docs/latest/rules/no-restricted-syntax))으로 금지하면 `cssVars()` 사용을 강제할 수 있다. 다음 작업으로 남겼다.
- 인라인 스타일 증가 자체는 문제가 아니다. 템플릿마다 데이터에 따라 바뀌는 강조색이 많다. 문제는 고정 값이 다시 인라인으로 작성되는 경우인데, 이는 집계 수치만으로는 구분할 수 없어 파일을 직접 확인해야 한다.
- "화면 유지"를 바이트 비교로 확인하면 리팩터링 완료의 객관적 근거가 된다. 37장을 캡처하는 스크립트는 다음 정리 작업에도 재사용할 수 있다.

## 관련 글

- [Playwright와 E2E 가짜 API로 블로그 스크린샷 생성하기](/memo/screenshots-with-playwright)
- [직접 쓴 hex 색을 --color-* 디자인 토큰과 Apple 시스템 색 이름으로 바꾸기](/memo/color-tokens)
- [Apple HIG 글자 스타일 이름으로 font-size 디자인 토큰 만들기](/memo/font-size-tokens)
- [CSS 값에 토큰 이름을 붙이고 자동 비교로 동일성 검증하기](/memo/refactor-step5-styles)

#MacFolio #CSS #리팩터링
