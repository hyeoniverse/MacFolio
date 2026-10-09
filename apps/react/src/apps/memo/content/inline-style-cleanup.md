---
title: style={{...}} 정리 - 고정 값은 CSS로, 바뀌는 값은 CSS 변수로
date: 2026-10-08
category: 프론트엔드/구조·리팩터링
summary: 컴포넌트 곳곳에 흩어져 있던 인라인 스타일을 세 가지로 나눠 정리했다. 늘 같은 값은 CSS 파일로 옮기고, 데이터에 따라 바뀌는 색·크기는 cssVars() 도우미로 CSS 변수만 넘기고, 메뉴 위치처럼 계산된 좌표만 인라인에 남겼다. 바꾸기 전후 화면 37장을 찍어 픽셀이 하나도 다르지 않은지 확인했다.
---

리팩터링 이슈(#15)의 마지막 항목은 인라인 스타일 정리였다. `style={{ ... }}`가 컴포넌트마다 섞여 있어서, 어떤 모양이 CSS에서 오고 어떤 모양이 JSX에서 오는지 파일 두 개를 오가며 찾아야 했다.

## 무엇이 인라인에 있었나

하나씩 보니 세 종류였다.

| 종류               | 예                                                      | 정리 방법                    |
| ------------------ | ------------------------------------------------------- | ---------------------------- |
| 늘 같은 값         | 바탕화면 `width: 100%`, 창 제목 막대 `cursor: grab`     | CSS 파일로 옮긴다            |
| 데이터마다 다른 값 | 언어 색 점, 아바타 크기, 단축어 타일 그라데이션 색      | CSS 변수만 넘기고 규칙은 CSS |
| 매번 계산되는 좌표 | 메뉴·팝오버 위치, 진행 막대 너비, 창 위치·크기, z-index | 인라인에 그대로 둔다         |

세 번째는 인라인이 맞는 자리다. 마우스 위치에서 계산한 `left`/`top`을 CSS 규칙으로 옮길 방법은 없다.

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

## 화면이 그대로인지

스타일을 옮기는 일은 눈으로 보면 달라진 게 없어야 정상이다. 그래서 바꾸기 전(main)과 후를 같은 시각으로 고정한 브라우저에서 찍어 파일을 바이트 단위로 비교했다.

- Safari 프로젝트 페이지 7개 × 스크롤 위치 4곳
- 데스크톱 바탕화면, 메일·메시지·GitHub·사진 창, 사진 확대
- 휴대폰 홈, 제어 센터, 단축어

37장 모두 같았다. 남은 인라인 `style`은 105곳이고, 그중 CSS 변수가 아닌 것은 모두 계산된 좌표다.

#MacFolio #CSS #리팩터링
