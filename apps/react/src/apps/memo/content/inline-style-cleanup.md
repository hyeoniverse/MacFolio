---
title: style={{...}} 정리 - 고정 값은 CSS로, 바뀌는 값은 CSS 변수로
date: 2026-10-08
category: 개발기/MacFolio/프론트엔드
summary: 흩어진 인라인 스타일을 셋으로 나눴다. 늘 같은 값은 CSS로, 데이터마다 바뀌는 색·크기는 cssVars()로 CSS 변수만 넘기고, 계산된 좌표만 인라인에 남겼다. 전후 화면 37장이 바이트까지 같았고, 타입 단언 61곳이 0이 됐다.
---

리팩터링 이슈(#15)의 마지막 항목은 인라인 스타일 정리였다. `style={{ ... }}`가 컴포넌트마다 섞여 있어서, 어떤 모양이 CSS에서 오고 어떤 모양이 JSX에서 오는지 파일 두 개를 오가며 찾아야 했다. 인라인 스타일은 어떤 CSS 규칙보다 우선하니, CSS 파일만 보고는 그 요소의 모양을 다 알 수 없다.

정리 전 `apps/react/src`의 `.tsx`에서 `style={`가 있는 줄은 114줄, `as React.CSSProperties`·`as string]` 같은 타입 단언은 61곳이었다.

## 무엇이 인라인에 있었나

하나씩 보니 세 종류였다.

| 종류               | 예                                                      | 정리 방법                    |
| ------------------ | ------------------------------------------------------- | ---------------------------- |
| 늘 같은 값         | 바탕화면 `width: 100%`, 창 제목 막대 `cursor: grab`     | CSS 파일로 옮긴다            |
| 데이터마다 다른 값 | 언어 색 점, 아바타 크기, 단축어 타일 그라데이션 색      | CSS 변수만 넘기고 규칙은 CSS |
| 매번 계산되는 좌표 | 메뉴·팝오버 위치, 진행 막대 너비, 창 위치·크기, z-index | 인라인에 그대로 둔다         |

![인라인 스타일 세 갈래와 옮긴 곳](./images/inline-style-cleanup-kinds.svg '값이 언제 정해지는지에 따라 CSS 파일, CSS 변수, 인라인으로 나눴다')

세 번째는 인라인이 맞는 자리다. 마우스 위치에서 계산한 `left`/`top`을 CSS 규칙으로 옮길 방법은 없다.

나누는 기준을 몇 가지 놓고 견줬다.

| 방법                                       | 좋은 점                                               | 걸리는 점                                                      |
| ------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------- |
| 인라인을 모두 CSS 변수로                   | 규칙이 하나                                           | 좌표처럼 매번 바뀌는 값까지 변수로 돌리면 한 번 더 감쌀 뿐이다 |
| CSS-in-JS 라이브러리(styled-components 등) | 값과 규칙이 한 파일에                                 | 지금의 CSS 파일·`@layer` 구조를 다 바꿔야 하고 번들이 커진다   |
| **값이 정해지는 때로 나눈다**              | 고정 → CSS, 데이터 → 변수, 계산 → 인라인. 판단이 쉽다 | 변수 이름을 CSS와 JSX가 함께 알아야 한다                       |

## CSS 변수를 넘기는 도우미

두 번째 종류는 이미 CSS 변수를 쓰는 곳이 많았는데, 쓰는 모양이 제각각이었다.

```tsx
style={{ '--i': i, '--n': STEPS } as React.CSSProperties}
style={{ ['--color' as string]: color }}
```

React의 `CSSProperties` 타입에는 `--`로 시작하는 키가 없어서 매번 타입 단언이 붙었다. 이것을 작은 함수 하나로 모았다.

```ts
export function cssVars(vars: Record<string, string | number | undefined>): CSSProperties {
	const style: Record<string, string | number> = {};
	for (const [name, value] of Object.entries(vars)) if (value !== undefined) style[`--${name}`] = value;
	return style as CSSProperties;
}
```

`undefined`인 값은 빼므로, 색 표에 없는 언어면 CSS 쪽 `var(--color, 기본값)`의 기본값이 쓰인다. 단언은 이 함수 안 한 곳에만 남는다.

```tsx
<span className="gh-language-dot" style={cssVars({ color: LANGUAGE_COLORS[repo.language] })} />
```

```css
.gh-language-dot {
	background-color: var(--color, var(--gh-muted));
}
```

아바타도 같은 방식이다. 전에는 크기를 받아 `width`, `height`, `fontSize`를 JSX에서 곱해 넣었는데, 이제 `--size`만 넘기고 글자 크기는 CSS에서 `calc(var(--size) * 0.46)`으로 정한다. 이니셜이 두 글자일 때 글자를 줄이는 것도 `data-letters="2"` 선택자로 옮겼다.

Safari 프로젝트 페이지의 단계 애니메이션처럼 같은 모양이 수십 번 나오는 곳은 스크립트로 바꿨다. 결과적으로 `as React.CSSProperties`와 `as string]`은 코드에서 모두 사라졌다.

## 쓰이지 않던 props

창(`Window`)과 휴대폰 앱 틀(`MobileAppFrame`)에는 `appStyle`, `contentStyle`, `titleBarStyle` props가 있었는데, 넘기는 곳이 하나도 없었다. 처음에 앱마다 모양을 바꾸려고 열어 둔 구멍이었다. 지웠다.

## 로딩 화면의 lint 경고

로딩 화면은 화면을 누른 뒤 안내 문구를 `visibility: hidden` 인라인 스타일로 감췄는데, 누를지 말지를 렌더링 중에 `ref`에서 읽고 있어서 lint 경고 두 개가 늘 남아 있었다. ref는 바뀌어도 다시 그리지 않으니 우연히 다른 이유로 다시 그려질 때에야 문구가 사라지는 구조였다. `started` 상태 하나를 두고 `.loading-text.started { visibility: hidden }`으로 바꾸니 경고가 6개에서 4개로 줄었다.

## 구현 정리

커밋 하나(`1ae29e1ac`)로 main에 넣었다. 44개 파일, 267줄 더하기, 196줄 지우기다. 바꾼 순서는 이렇다.

1. `shared/lib/cssVars.ts`를 만들었다.
2. 고정 값을 CSS로 옮겼다(바탕화면, 창 제목 막대 등).
3. 데이터 값을 `cssVars()`로 바꿨다(GitHub 언어 점, 아바타, 단축어 타일, Safari 단계 애니메이션).
4. 쓰이지 않던 `appStyle`·`contentStyle`·`titleBarStyle` props를 지웠다.
5. 로딩 화면의 `ref` 읽기를 상태로 바꿨다.

## 화면이 그대로인지

스타일을 옮기는 일은 눈으로 보면 달라진 게 없어야 정상이다. 그래서 바꾸기 전(main)과 후를 같은 시각으로 고정한 브라우저에서 찍어 파일을 바이트 단위로 비교했다.

- Safari 프로젝트 페이지 7개 × 스크롤 위치 4곳
- 데스크톱 바탕화면, 메일·메시지·GitHub·사진 창, 사진 확대
- 휴대폰 홈, 제어 센터, 단축어

37장 모두 같았다. 남은 인라인 `style`은 105곳이고, 그중 68곳이 `cssVars()`, 나머지는 모두 계산된 좌표다. 바이트 비교는 픽셀 하나만 달라도 실패하니, 같다는 것은 글자 안티에일리어싱까지 같다는 뜻이다. 시각을 고정하지 않으면 메뉴 막대 시계가 달라져 모든 데스크톱 화면이 달라진다.

## 열하루 뒤 다시 세어 보니

10월 19일에 같은 방법으로 세면 `style={`는 221줄, 타입 단언은 27곳이다. `cssVars()`는 70곳이다.

![인라인 스타일과 타입 단언 수](./images/inline-style-cleanup-counts.svg '정리 직후 타입 단언은 0이었지만, 그 뒤 새로 쓴 코드에서 27곳이 다시 생겼다')

늘어난 116줄 중 92줄이 Safari 프로젝트 페이지(템플릿)다. 타입 단언은 QuickTime 재생 막대(`'--fill'`), 메모, PDF 미리보기, Safari 템플릿에서 다시 생겼다. 모두 `cssVars()`를 거치지 않고 새로 쓴 코드다.

## 남은 것·배운 것

- 도우미를 만들어 두기만 해서는 새 코드가 따라오지 않는다. `as React.CSSProperties`를 lint 규칙(`no-restricted-syntax`)으로 막으면 `cssVars()`로 오게 할 수 있다. 다음 할 일로 남겼다.
- 인라인 스타일이 늘어난 것 자체는 나쁘지 않다. 템플릿마다 데이터에 따라 바뀌는 강조색이 많다. 문제는 고정 값이 다시 인라인으로 들어오는 경우인데, 그것은 숫자만으로는 가릴 수 없어 파일을 열어 봐야 한다.
- "화면은 그대로"를 바이트 비교로 확인하면, 리팩터링을 끝냈다고 말할 근거가 생긴다. 37장을 찍는 스크립트는 한 번 짜면 다음 정리에도 쓸 수 있다.

## 관련 글

- [Playwright로 블로그 스크린샷 찍기](/memo/screenshots-with-playwright)
- [색 288곳을 --color-* 토큰으로](/memo/color-tokens)
- [글자 크기에 이름 붙이기](/memo/font-size-tokens)
- [리팩터링 5단계: 스타일](/memo/refactor-step5-styles)

#MacFolio #CSS #리팩터링
