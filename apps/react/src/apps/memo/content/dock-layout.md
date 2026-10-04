---
title: 앱이 많아지자 Dock이 Launchpad와 겹쳤다
date: 2026-10-05
category: 개발기/MacFolio
summary: Dock의 Launchpad·휴지통이 절대 위치로 박혀 있고, 앱 칸 수는 어림셈이었다. 실행 중인 앱이 끝에 붙으면 Launchpad 아래로 파고들었다. Dock을 내용만큼 넓어지는 한 줄로 바꾸고, 칸 수를 CSS와 같은 치수로 세는 함수 하나로 모았다.
---

'API 문서' 앱을 더하고 열어 보니, Dock 끝에 나타난 아이콘이 Launchpad 아이콘 밑으로 반쯤 들어가 있었다.

## 왜 겹쳤나

Dock은 이렇게 생겨 있었다.

- 폭은 화면의 85%로 정해 둔 막대
- 앱 아이콘은 왼쪽부터 차례로
- Launchpad는 `position: absolute; right: 10rem`, 휴지통은 `right: 0`으로 오른쪽에 박아 둠
- 앱을 몇 개 둘지는 `(화면 폭 - 300) / 100`으로 어림

이 어림셈은 실제 아이콘 크기(64px)·간격(16px)과 상관이 없다. 그리고 Dock에 고정하지 않은 앱이나 넘쳐서 Launchpad로 간 앱이 실행되면, macOS처럼 Dock 끝에 아이콘이 하나 더 붙는다. 이 칸은 셈에 들어가지 않아서, 앱 줄이 길어지면 절대 위치에 있는 Launchpad 밑으로 그대로 파고들었다.

숫자를 고쳐서 맞출 수도 있었지만, 앞으로 앱이 늘 때마다 같은 일이 생긴다. 겹칠 수 없는 구조로 바꿨다.

## 한 줄로, 내용만큼

macOS Dock처럼 **한 줄로 내용만큼 넓어지고 가운데 놓이게** 했다. 앱 → Launchpad → 구분선 → 휴지통이 모두 같은 flex 줄에 있다. 절대 위치가 없으니 앞의 칸이 늘어나면 뒤의 칸은 밀려날 뿐 겹치지 않는다.

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

단위 테스트는 여러 화면 폭에서 "앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어가고, 한 칸 더 넣으면 넘친다"를 확인한다. 화면 테스트는 Dock의 칸들이 화면 안에 있고 서로 겹치지 않는지를, Launchpad에서 앱을 연 뒤에도 다시 확인한다.

## 넓은 화면에서는 다 들어간다

전에는 1600px 화면에서도 어림셈 때문에 앱 13개만 Dock에 있고 나머지는 Launchpad에 있었다. 실제 치수로 세니 고정한 앱 16개가 모두 들어간다. Dock은 앱 수만큼만 넓어지니 빈 막대가 남지도 않는다.

## API 문서 아이콘

김에 'API 문서' 앱 아이콘도 다시 그렸다. 처음에는 어두운 바탕에 `{ }`와 'API' 글자를 넣었다. 다음에는 파란 바탕에 흰 문서를 두고 엔드포인트 목록을 그렸는데, 글자가 없으니 무슨 앱인지 덜 드러나고 Dock에서 혼자 무거워 보였다. 지금은 밝은 바탕에 파란 'API' 글자를 두고, 그 아래에 엔드포인트 목록 세 줄(메서드 색 알약 + 경로 줄)을 가볍게 그렸다. 암호·메모처럼 흰 바탕인 아이콘들과 나란히 둬도 어울린다.
