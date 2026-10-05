---
title: 메뉴 막대의 앱 이름이 맨 앞 창을 따른다
date: 2026-10-05
category: 개발기/MacFolio
summary: 메뉴 막대 맨 앞의 'Finder'는 글자로 박혀 있었다. 맨 앞 창의 앱 이름을 보여 주고, 보이는 창이 없으면 Finder로 돌아가게 했다. 맨 앞 창을 고르는 코드가 두 벌이던 것도 하나로 모았다.
---

macOS 메뉴 막대에서 Apple 로고 오른쪽의 굵은 글자는 **지금 쓰고 있는 앱**의 이름이다. Safari를 보고 있으면 'Safari', 메모를 보고 있으면 '메모'. 창을 모두 닫으면 데스크톱을 맡은 Finder가 된다.

MacFolio에서는 이 자리에 `Finder`가 글자로 박혀 있었다. 어떤 창을 보든 늘 Finder였다.

## 맨 앞 창은 이미 알고 있었다

주소 막대가 맨 앞 창의 항목(메모의 글, Safari의 프로젝트)을 따르게 할 때, 맨 앞 창을 고르는 일을 이미 했다. 실행 중이고 최소화하지 않은 창 가운데 zIndex가 가장 큰 앱이다.

찾아보니 같은 일을 하는 코드가 두 벌이었다. 창 순서를 다루는 순수 함수 모음(`appStack.ts`)에 `foregroundApp`이 있었는데, 앱 상태(`AppStateContext`)는 주소 막대를 맞출 때 같은 반복문을 따로 돌고 있었다. 앱 상태도 `foregroundApp`을 쓰게 하고, 메뉴 막대도 같은 함수를 쓴다.

```tsx
const { apps } = useAppState();
const activeApp = APP_MANIFEST[foregroundApp(apps) ?? 'finder'].label;
```

이름은 Dock·Launchpad와 같은 앱 정보(`manifest.ts`)의 이름을 쓴다. 그래서 macOS 한국어판처럼 '메모', '음악', '시스템 설정'으로 보인다.

## 화면 테스트

- 처음에는 Safari 창이 떠 있어서 'Safari'
- Dock에서 메모를 열면 '메모', 다시 Safari를 누르면 'Safari'
- Safari를 최소화하면 그 뒤의 '메모', 메모까지 닫으면 'Finder'

다음은 그 옆의 File·Edit·View·Go·Window·Help다. 지금은 이름만 있고 눌러도 아무 일이 없다. 맨 앞 앱에 따라 메뉴가 바뀌고 실제로 동작하게 하려면 앱 안에 있는 동작을 바깥의 메뉴 막대가 부를 길부터 만들어야 해서, 계획을 이슈(#96)로 따로 적었다.
