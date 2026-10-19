---
title: 앱이 많아지자 Dock이 Launchpad와 겹쳤다
date: 2026-10-05
category: 개발기/MacFolio/프론트엔드
summary: Dock의 Launchpad·휴지통이 절대 위치로 박혀 있고 앱 칸 수는 어림셈이었다. 실행 중인 앱이 끝에 붙으면 Launchpad 아래로 파고들었다. Dock을 내용만큼 넓어지는 한 줄로 바꾸고, 칸 수를 CSS와 같은 치수로 세는 함수 하나로 모았다.
---

'API 문서' 앱을 더하고 열어 보니, Dock 끝에 나타난 아이콘이 Launchpad 아이콘 밑으로 반쯤 들어가 있었다. 이 고침은 API 문서 앱 PR([#95](https://github.com/hyeoniverse/MacFolio/pull/95))에 함께 들어갔다.

재현은 간단했다. Dock에 자리가 모자라 Launchpad로 간 앱(이때는 API 문서)을 Launchpad에서 열면 된다. macOS처럼 실행 중인 앱은 Dock 끝에 아이콘이 붙는데, 그 아이콘이 들어갈 자리가 셈에 없었다.

## 왜 겹쳤나

Dock은 이렇게 생겨 있었다.

- 폭은 화면의 85%로 정해 둔 막대
- 앱 아이콘은 왼쪽부터 차례로
- Launchpad는 `position: absolute; right: 10rem`, 휴지통은 `right: 0`으로 오른쪽에 박아 둠
- 앱을 몇 개 둘지는 `(화면 폭 - 300) / 100`으로 어림

```ts
// 전: Dock.tsx
// Dock에 다 들어가지 않는 앱은 Launchpad로 보낸다 (아이콘 하나당 100px, 양옆 여백 300px)
const maxItems = Math.floor((width - 300) / 100);
```

이 어림셈은 실제 아이콘 크기(64px)·간격(16px)과 상관이 없다. 아이콘 한 칸은 실제로 80px인데 100px로 셌으니, 넓은 화면일수록 자리를 많이 남겼다. 그리고 Dock에 고정하지 않은 앱이나 넘쳐서 Launchpad로 간 앱이 실행되면, macOS처럼 Dock 끝에 아이콘이 하나 더 붙는다. 이 칸은 셈에 들어가지 않아서, 앱 줄이 길어지면 절대 위치에 있는 Launchpad 밑으로 그대로 파고들었다.

숫자를 고쳐서 맞출 수도 있었지만, 앞으로 앱이 늘 때마다 같은 일이 생긴다. 겹칠 수 없는 구조로 바꿨다.

| 방법                                              | 좋은 점                            | 나쁜 점                                                           |
| ------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| 어림셈 숫자만 고친다 (`- 400`, 실행 중 앱 1칸 더) | 한 줄                              | Launchpad가 여전히 절대 위치. 다음 경우에 또 겹친다               |
| 넘치면 Dock 안에서 가로 스크롤                    | 앱을 잃지 않는다                   | macOS Dock에는 없는 동작. Launchpad·휴지통이 밀려 안 보일 수 있다 |
| **한 줄 flex + 실제 치수로 칸 세기**              | 구조상 겹칠 수 없다. CSS와 같은 값 | 칸 수를 세는 함수와 CSS 변수를 함께 관리한다                      |

## 한 줄로, 내용만큼

macOS Dock처럼 **한 줄로 내용만큼 넓어지고 가운데 놓이게** 했다. 앱 → Launchpad → 구분선 → 휴지통이 모두 같은 flex 줄에 있다. 절대 위치가 없으니 앞의 칸이 늘어나면 뒤의 칸은 밀려날 뿐 겹치지 않는다.

![Dock 구조 전후](./images/dock-layout-before-after.svg '전: 절대 위치의 Launchpad 밑으로 실행 중인 앱이 파고듦 / 후: 한 줄의 flex')

남은 문제는 화면 폭을 넘지 않게 하는 것이다. 몇 칸이 들어가는지는 `dockLayout.ts` 한 곳에서 센다.

```ts
export const DOCK_GAP = 16;
export const dockIconSize = (viewportWidth: number) => (viewportWidth <= 768 ? 56 : 64);

export function dockAppCapacity(viewportWidth: number): number {
	const slot = dockIconSize(viewportWidth) + DOCK_GAP;
	const inner = viewportWidth - 2 * DOCK_MARGIN - 2 * DOCK_PADDING;
	return Math.max(0, Math.floor((inner - DOCK_DIVIDER) / slot) - SYSTEM_ITEMS);
}
```

같은 값을 Dock에 CSS 변수(`--dock-icon`, `--dock-gap` 등)로 넘겨, CSS도 이 값으로 그린다. 세는 크기와 그리는 크기가 따로 놀 수 없다.

## 실행 중인 앱도 칸을 차지한다

어떤 앱을 Dock에 두고 어떤 앱을 Launchpad로 보낼지도 같은 파일의 순수 함수가 정한다. 고정 앱과 실행 중인 앱을 합친 수가 칸 수를 넘지 않을 때까지, 고정 앱을 뒤에서부터 Launchpad로 보낸다.

```ts
const runningOf = (shown: number) => [...dockApps.slice(shown), ...launchpadApps].filter(isRunning);
let shown = Math.min(dockApps.length, capacity);
while (shown > 0 && shown + runningOf(shown).length > capacity) shown -= 1;
```

900px 화면에서는 앱 8칸이 있다. Launchpad에서 터미널을 열면 터미널이 Dock 끝에 나타나고, 그 칸만큼 메일이 Launchpad로 간다. 칸 수는 8 그대로다.

![화면 폭에 따른 Dock](./images/dock-layout-widths.jpg '1440px와 900px의 Dock. 좁은 화면에서는 들어가는 칸만큼만 Dock에 둔다')

단위 테스트는 여러 화면 폭에서 "앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어가고, 한 칸 더 넣으면 넘친다"를 확인한다. 화면 테스트는 Dock의 칸들이 화면 안에 있고 서로 겹치지 않는지를, Launchpad에서 앱을 연 뒤에도 다시 확인한다.

## 넓은 화면에서는 다 들어간다

전에는 1600px 화면에서도 어림셈 때문에 앱 13개만 Dock에 있고 나머지는 Launchpad에 있었다. 실제 치수로 세니 고정한 앱 16개가 모두 들어간다. Dock은 앱 수만큼만 넓어지니 빈 막대가 남지도 않는다.

![화면 폭마다 Dock에 들어가는 앱 칸 수: 어림셈과 실제 치수](./images/dock-layout-capacity.svg '어림셈은 모든 폭에서 칸을 적게 셌다. 넓을수록 차이가 크다')

| 화면 폭 | 어림셈 `(w − 300) / 100` | 실제 치수 `dockAppCapacity` |
| ------- | ------------------------ | --------------------------- |
| 768px   | 4                        | 7 (아이콘 56px)             |
| 900px   | 6                        | 8                           |
| 1280px  | 9                        | 13                          |
| 1440px  | 11                       | 15                          |
| 1600px  | 13                       | 17                          |
| 1920px  | 16                       | 21                          |

어림셈이 칸을 적게 센 덕에 대부분의 화면에서는 겹치지 않았던 것이다. 실행 중인 앱이 하나 더 붙는 경우만 그 여유를 넘었다.

## API 문서 아이콘

이 김에 'API 문서' 앱 아이콘도 손봤다. 처음 아이콘은 어두운 남색 바탕에 흰 `{ }`와 청록 'API' 글자였는데, Dock에서 혼자 무거워 보였다. 엔드포인트 목록을 그린 문서 모양도 그려 봤지만 'API' 글자가 있어야 무슨 앱인지 바로 보였다. 결국 처음 모양(`{ API }`)을 그대로 두고 색만 가볍게 했다. 밝은 바탕에 옅은 파랑 중괄호, 'API' 글자는 더 크게 진한 파랑으로. 암호·메모처럼 흰 바탕인 아이콘들과 나란히 둬도 어울린다.

## 확인

- 단위 시험 `apps/react/src/desktop/dock/dockLayout.test.ts` 7개. "앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어간다", "아주 좁으면 앱 칸은 0", "자리가 넉넉하면 고정 앱은 모두 Dock에, 고정하지 않은 앱은 Launchpad에", "자리가 모자라면 뒤쪽 고정 앱부터 Launchpad로", "실행 중인 앱이 자리를 차지하면 고정 앱을 하나 더 보낸다 (Launchpad 칸과 겹치지 않는다)", "넘친 고정 앱이 실행 중이면 고정 앱 뒤에 나타난다", "실행 중인 앱이 칸보다 많아도 칸 수를 넘지 않는다".
- E2E `desktop.spec.ts`는 Dock 칸들의 상자를 읽어 화면 안에 있고 서로 겹치지 않는지 본다. Launchpad에서 앱을 연 뒤에도 같은 검사를 한다.
- 커밋은 파일 6개, +233/−102다. `Dock.css`에서 절대 위치와 고정 폭을 걷어 내며 64줄이 바뀌었다.

## 남은 것과 배운 것

- Dock 아이콘을 끌어 순서를 바꾸는 것은 아직 없다. 고정 앱 순서는 코드의 목록 순서다.
- 휴대폰 화면의 Dock(아래 네 칸)은 따로 그린다. 이 계산은 데스크톱 Dock만 쓴다.

배운 것: 절대 위치는 "지금 이 개수"에서만 맞는다. 개수가 바뀌는 줄에서는 겹침을 구조로 막아야 한다. 그리고 칸 수를 세는 코드와 그리는 CSS가 같은 숫자를 쓰게 하면(CSS 변수로 넘기기), 한쪽만 고쳐 어긋나는 일이 사라진다.

관련 글: [바탕화면 아이콘](/memo/desktop-icons), [API 문서 앱](/memo/api-docs-app).

#MacFolio #데스크톱 #Dock
