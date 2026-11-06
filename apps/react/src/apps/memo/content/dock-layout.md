---
title: 절대 위치 대신 내용 폭 한 줄 flex로 겹치지 않는 Dock 배치
date: 2026-10-05
category: 개발 기록/MacFolio/화면·스타일
summary: Dock의 Launchpad·휴지통은 절대 위치로 고정되어 있었고 앱 칸 수는 근사식으로 계산했다. 실행 중인 앱 아이콘이 끝에 추가되면 Launchpad 아래로 겹쳤다. Dock을 내용 폭만큼 넓어지는 한 줄 flex로 바꾸고, 칸 수는 CSS와 같은 치수로 계산하는 함수 하나로 통합했다.
---

'API 문서' 앱을 추가하고 실행하자, Dock 끝에 표시된 아이콘이 Launchpad 아이콘 아래로 반쯤 겹쳐 있었다. 원인은 Dock의 일부 칸을 절대 위치로 고정한 CSS와, 실제 치수와 다른 근사식으로 계산한 칸 수였다. 수정은 API 문서 앱 PR([#95](https://github.com/hyeoniverse/MacFolio/pull/95))에 포함했다.

## 배경: Dock과 두 가지 배치 방식

**Dock**은 macOS 화면 아래쪽에 앱 아이콘을 한 줄로 나열하는 막대다. 왼쪽부터 고정한 앱과 실행 중인 앱이 오고, 오른쪽 끝에는 구분선 뒤에 내려받기 폴더와 휴지통이 온다. 아이콘이 늘어나면 막대가 좌우로 넓어지고, 항상 화면 가운데에 놓인다.

![macOS Sonoma의 Dock](./images/dock-layout-macos-dock.jpg '앱 아이콘 뒤에 구분선, 내려받기 폴더, 휴지통이 같은 줄에 있다. 막대 폭은 아이콘 수만큼이다')

MacFolio의 데스크톱 Dock은 이 모양을 재현한다. 앱 아이콘 뒤에 Launchpad(설치한 앱 전체를 격자로 보여 주는 화면을 여는 버튼), 구분선, 휴지통이 온다. 화면이 좁아 모든 앱이 들어가지 않으면 남는 앱은 Launchpad로 옮긴다.

CSS에서 이런 줄을 만드는 방법은 크게 두 가지다.

| 방식                                                                                                                         | 동작                                                                                                         | 항목 수가 바뀌면                                     |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| [절대 위치](https://developer.mozilla.org/en-US/docs/Web/CSS/position) (`position: absolute; right: 10rem`)                  | 요소를 문서 흐름에서 빼고, 기준 상자의 가장자리에서 지정한 거리에 놓는다. 다른 요소의 크기를 고려하지 않는다 | 앞 요소가 길어져도 위치가 그대로라 서로 겹칠 수 있다 |
| [flex](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox) (`display: flex`) | 자식 요소를 한 축(여기서는 가로)을 따라 순서대로 나열한다. 각 요소는 앞 요소가 끝난 위치에서 시작한다        | 앞 요소가 길어지면 뒤 요소가 그만큼 밀린다           |

예를 들어 폭 600px 막대의 왼쪽부터 34px 아이콘을 나열하고, 폭 40px Launchpad를 `right: 160px`에 고정하면 Launchpad는 400~440px 구간을 차지한다. 아이콘 11개(374px)까지는 겹치지 않지만 12개(408px)부터 Launchpad와 겹친다. flex 줄이면 Launchpad는 마지막 아이콘이 끝나는 위치에서 시작하므로 아이콘 수와 관계없이 겹치지 않는다.

## 재현 방법

Dock에 자리가 부족해 Launchpad로 옮겨진 앱(당시는 API 문서)을 Launchpad에서 실행한다. macOS처럼 실행 중인 앱은 Dock 끝에 아이콘이 하나 추가되는데, 그 아이콘의 칸이 칸 수 계산에 포함되지 않았다.

## 겹친 원인

수정 전 Dock의 구조는 다음과 같았다.

- 폭은 화면의 85%로 고정한 막대
- 앱 아이콘은 왼쪽부터 순서대로 배치
- Launchpad는 `position: absolute; right: 10rem`, 휴지통은 `right: 0`으로 오른쪽에 고정
- 표시할 앱 개수는 `(화면 폭 - 300) / 100`으로 근사 계산

```ts
// 전: Dock.tsx
// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다 (아이콘 하나당 100px, 양옆 여백 300px)
const maxItems = Math.floor((width - 300) / 100);
```

이 근사식은 실제 아이콘 크기(64px)·간격(16px)과 관계가 없다. ==아이콘 한 칸은 실제로 80px인데 100px로 계산==했으므로, 넓은 화면일수록 빈 공간이 많이 남았다. 1440px 화면이면 근사식은 11칸을 허용하지만 실제로는 15칸이 들어간다.

여기에 실행 중인 앱의 칸이 더해진다. Dock에 고정하지 않은 앱이나 칸이 부족해 Launchpad로 옮겨진 앱을 실행하면 Dock 끝에 아이콘이 하나 추가된다. 이 칸은 계산에 포함되지 않아서, 앱 줄이 길어지면 절대 위치의 Launchpad 아래로 겹쳤다.

숫자만 조정할 수도 있었지만, 앱이 늘어날 때마다 같은 문제가 반복된다. 구조상 겹칠 수 없는 방식으로 바꿨다.

| 방법                                              | 장점                               | 단점                                                                       |
| ------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| 근사식 숫자만 수정 (`- 400`, 실행 중 앱 1칸 추가) | 한 줄 수정                         | Launchpad가 여전히 절대 위치. 다른 조건에서 다시 겹친다                    |
| 넘치면 Dock 안에서 가로 스크롤                    | 모든 앱이 Dock에 남는다            | macOS Dock에는 없는 동작. Launchpad·휴지통이 밀려 화면 밖으로 나갈 수 있다 |
| **한 줄 flex + 실제 치수로 칸 수 계산**           | 구조상 겹칠 수 없다. CSS와 같은 값 | 칸 수 계산 함수와 CSS 변수를 함께 관리해야 한다                            |

## 내용 폭만큼 넓어지는 한 줄

macOS Dock처럼 **내용 폭만큼 넓어지고 가운데 정렬되는 한 줄**로 바꿨다. 앱 → Launchpad → 구분선 → 휴지통이 모두 같은 flex 줄에 있다. ==절대 위치가 없으므로 앞의 칸이 늘어나면 뒤의 칸은 뒤로 밀릴 뿐 겹치지 않는다.==

![Dock 구조 전후](./images/dock-layout-before-after.svg '전: 절대 위치의 Launchpad 아래로 실행 중인 앱이 겹침 / 후: 한 줄의 flex')

남은 문제는 Dock이 화면 폭을 넘지 않게 하는 것이다. 들어가는 칸 수는 `dockLayout.ts` 한 곳에서 계산한다. 치수는 아이콘 64px(폭 768px 이하 화면은 56px), 간격 16px, Dock 안쪽 여백 16px, 화면 끝과의 여백 16px, 구분선 2px이다.

```ts
export const DOCK_GAP = 16;
export const dockIconSize = (viewportWidth: number) => (viewportWidth <= 768 ? 56 : 64);

export function dockAppCapacity(viewportWidth: number): number {
	const slot = dockIconSize(viewportWidth) + DOCK_GAP;
	const inner = viewportWidth - 2 * DOCK_MARGIN - 2 * DOCK_PADDING;
	return Math.max(0, Math.floor((inner - DOCK_DIVIDER) / slot) - SYSTEM_ITEMS);
}
```

900px 화면을 예로 들면 계산은 네 단계다.

![900px 화면에서 Dock 앱 칸 수 계산](./images/dock-layout-capacity-calc.svg '한 칸 80px, 안쪽 폭 836px, 들어가는 칸 10개에서 Launchpad·휴지통 2칸을 빼면 앱 칸은 8개')

```math
\left\lfloor \frac{836 - 2}{80} \right\rfloor - 2 = 10 - 2 = 8
```

같은 값을 Dock에 CSS 변수(`--dock-icon`, `--dock-gap`, `--dock-padding`, `--dock-divider`)로 전달해, CSS도 이 값으로 렌더링한다. ==계산에 쓰는 크기와 렌더링 크기가 서로 달라질 수 없다.==

## 실행 중인 앱도 칸을 차지한다

어떤 앱을 Dock에 표시하고 어떤 앱을 Launchpad로 옮길지도 같은 파일의 순수 함수(입력이 같으면 항상 같은 결과를 반환하고 화면이나 저장소를 바꾸지 않는 함수)가 정한다. 고정 앱과 실행 중인 앱을 합친 수가 칸 수 이하가 될 때까지, 고정 앱을 뒤에서부터 Launchpad로 옮긴다.

```ts
const runningOf = (shown: number) => [...dockApps.slice(shown), ...launchpadApps].filter(isRunning);
let shown = Math.min(dockApps.length, capacity);
while (shown > 0 && shown + runningOf(shown).length > capacity) shown -= 1;
```

900px 화면에서는 앱 칸이 8개다. Launchpad에서 터미널을 실행하면 다음 순서로 결정된다.

| 단계                | 고정 앱(표시) | 실행 중인 앱 | 합계 | 칸 수 이하인가 |
| ------------------- | ------------- | ------------ | ---- | -------------- |
| 터미널 실행 전      | 8             | 0            | 8    | 예             |
| 터미널 실행 직후    | 8             | 1 (터미널)   | 9    | 아니요         |
| 마지막 고정 앱 이동 | 7             | 1 (터미널)   | 8    | 예             |

마지막 고정 앱인 메일이 Launchpad로 옮겨지고, 터미널이 그 자리에 표시된다. 칸 수는 8개로 유지된다.

![화면 폭에 따른 Dock](./images/dock-layout-widths.jpg '1440px와 900px의 Dock. 좁은 화면에서는 들어가는 칸 수만큼만 Dock에 표시한다')

단위 시험은 여러 화면 폭에서 "앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어가고, 한 칸을 더 넣으면 넘친다"를 확인한다. E2E 시험은 Dock의 칸이 화면 안에 있고 서로 겹치지 않는지를 Launchpad에서 앱을 실행한 뒤에도 다시 확인한다.

## 넓은 화면에서는 고정 앱이 모두 들어간다

수정 전에는 1600px 화면에서도 근사식 때문에 앱 13개만 Dock에 있고 나머지는 Launchpad에 있었다. 실제 치수로 계산하면 고정한 앱 16개가 모두 들어간다. Dock은 앱 수만큼만 넓어지므로 빈 공간도 남지 않는다.

![화면 폭마다 Dock에 들어가는 앱 칸 수: 어림셈과 실제 치수](./images/dock-layout-capacity.svg '근사식은 모든 폭에서 칸 수를 적게 계산했다. 화면이 넓을수록 차이가 크다')

| 화면 폭 | 근사식 `(w − 300) / 100` | 실제 치수 `dockAppCapacity` |
| ------- | ------------------------ | --------------------------- |
| 768px   | 4                        | 7 (아이콘 56px)             |
| 900px   | 6                        | 8                           |
| 1280px  | 9                        | 13                          |
| 1440px  | 11                       | 15                          |
| 1600px  | 13                       | 17                          |
| 1920px  | 16                       | 21                          |

근사식이 칸 수를 적게 계산했기 때문에 대부분의 화면에서는 겹치지 않았다. ==실행 중인 앱 아이콘이 하나 추가되는 경우에만 그 여유 공간을 넘었다.==

## API 문서 아이콘

같은 PR에서 'API 문서' 앱 아이콘도 수정했다. 처음 아이콘은 어두운 남색 배경에 흰 `{ }`와 청록 'API' 글자였는데, Dock에서 다른 아이콘보다 명도가 낮아 눈에 띄었다. 엔드포인트 목록을 그린 문서 모양도 시안으로 만들었지만, 'API' 글자가 있어야 앱의 용도를 바로 알 수 있었다. 처음 형태(`{ API }`)는 유지하고 색만 밝게 바꿨다. 밝은 배경에 옅은 파랑 중괄호, 'API' 글자는 더 크고 진한 파랑이다. 암호·메모처럼 흰 배경인 아이콘과 나란히 배치해도 명도가 비슷하다.

## 확인

<details>
<summary>단위 시험 7개의 이름</summary>

`apps/react/src/desktop/dock/dockLayout.test.ts`: "앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어간다", "아주 좁으면 앱 칸은 0", "자리가 넉넉하면 고정 앱은 모두 Dock에, 고정하지 않은 앱은 Launchpad에", "자리가 모자라면 뒤쪽 고정 앱부터 Launchpad로", "실행 중인 앱이 자리를 차지하면 고정 앱을 하나 더 보낸다 (Launchpad 칸과 겹치지 않는다)", "넘친 고정 앱이 실행 중이면 고정 앱 뒤에 나타난다", "실행 중인 앱이 칸보다 많아도 칸 수를 넘지 않는다".

</details>

- E2E `desktop.spec.ts`는 Dock 칸의 [`boundingBox()`](https://playwright.dev/docs/api/class-locator#locator-bounding-box)(화면에 그려진 요소의 x·y 좌표와 폭·높이)를 읽어 화면 안에 있고 서로 겹치지 않는지 확인한다. Launchpad에서 앱을 실행한 뒤에도 같은 검사를 한다.
- 커밋은 파일 6개, +233/−102다. `Dock.css`에서 절대 위치와 고정 폭을 제거하면서 64줄이 바뀌었다.

## 남은 것과 배운 것

- Dock 아이콘을 끌어 순서를 바꾸는 기능은 아직 없다. 고정 앱 순서는 코드의 목록 순서다.
- 휴대폰 화면의 Dock(아래 네 칸)은 별도 컴포넌트로 렌더링한다. 이 계산은 데스크톱 Dock에만 적용된다.

> [!IMPORTANT] 배운 것
> 절대 위치는 작성 시각의 항목 개수에서만 올바르다. 항목 개수가 바뀌는 줄에서는 겹침을 레이아웃 구조(flex)로 막아야 한다. 칸 수를 계산하는 코드와 렌더링하는 CSS가 같은 숫자를 쓰게 하면(CSS 변수로 전달), 한쪽만 수정해 값이 어긋나는 문제가 생기지 않는다.

## 관련 글

- [Vite 두 번째 진입점과 iframe으로 Scalar API 문서 격리하기](/memo/api-docs-app): 이 수정이 함께 들어간 PR의 본 작업
- [칸 단위 좌표와 포인터 캡처로 구현한 바탕화면 아이콘 선택과 끌기](/memo/desktop-icons): 같은 칸 계산 방식을 쓴 바탕화면 아이콘

<details>
<summary>참고 문헌</summary>

- MDN, [position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- MDN, [Basic concepts of flexbox](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- MDN, [Using CSS custom properties (variables)](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- Playwright, [Locator.boundingBox()](https://playwright.dev/docs/api/class-locator#locator-bounding-box)

</details>

<details>
<summary>사진 출처</summary>

- macOS Sonoma의 Dock: Apple Newsroom, [macOS Sonoma brings new capabilities for elevating productivity and creativity](https://www.apple.com/newsroom/2023/06/macos-sonoma-brings-new-capabilities-for-elevating-productivity-and-creativity/) (2023년 6월)의 위젯 사진에서 Dock 부분을 잘라 사용, 출처 표기

</details>

#MacFolio #데스크톱 #Dock
