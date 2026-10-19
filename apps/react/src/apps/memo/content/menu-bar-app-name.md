---
title: 메뉴 막대의 앱 이름이 맨 앞 창을 따른다
date: 2026-10-05
category: 개발기/MacFolio/프론트엔드
summary: 메뉴 막대의 'Finder'가 글자로 박혀 있던 것을 맨 앞 창의 앱 이름으로 바꿨다. 창 순서와 '지금 쓰는 앱'을 나눠 바탕화면을 누르면 Finder가 되게 하고, 메뉴 막대·Dock을 누를 때의 예외와 깜빡임도 고쳤다.
---

macOS 메뉴 막대에서 Apple 로고 오른쪽의 굵은 글자는 **지금 쓰고 있는 앱**의 이름이다. Safari를 보고 있으면 'Safari', 메모를 보고 있으면 '메모'. 창을 모두 닫으면 데스크톱을 맡은 Finder가 된다.

MacFolio에서는 이 자리에 `Finder`가 글자로 박혀 있었다. 어떤 창을 보든 늘 Finder였다.

## 배경

재현은 간단했다. 데스크톱에 들어가면 처음부터 Safari 창이 떠 있는데, 메뉴 막대는 'Finder'였다. Dock에서 메모를 열어도, 음악을 열어도 그대로였다. 메뉴 막대 오른쪽의 시계·음량은 실제로 동작하는데 왼쪽 앱 이름만 그림처럼 굳어 있으니, macOS를 흉내 낸 화면에서 가장 먼저 눈에 걸렸다. 그 뒤에 붙일 앱별 메뉴(File·Edit…)도 "지금 쓰는 앱"을 알아야 만들 수 있어서, 앱 이름을 먼저 고쳤다.

이 일은 PR 세 개로 나뉘었다.

| PR                                                       | 한 일                                           |
| -------------------------------------------------------- | ----------------------------------------------- |
| [#97](https://github.com/hyeoniverse/MacFolio/pull/97)   | 앱 이름이 맨 앞 창을 따르고, 창이 없으면 Finder |
| [#101](https://github.com/hyeoniverse/MacFolio/pull/101) | 창 밖(바탕화면)을 누르면 Finder                 |
| [#110](https://github.com/hyeoniverse/MacFolio/pull/110) | 메뉴 막대와 거기서 연 메뉴는 눌러도 앱이 그대로 |

## 맨 앞 창은 이미 알고 있었다

주소 막대가 맨 앞 창의 항목(메모의 글, Safari의 프로젝트)을 따르게 할 때, 맨 앞 창을 고르는 일을 이미 했다. 실행 중이고 최소화하지 않은 창 가운데 zIndex가 가장 큰 앱이다.

```ts
export function foregroundApp<Name extends string>(apps: Record<Name, RunningApp>): Name | null {
	let top: Name | null = null;
	for (const name of Object.keys(apps) as Name[]) {
		const app = apps[name];
		if (!app.isRunning || app.isMinimized) continue;
		if (top === null || app.zIndex > apps[top].zIndex) top = name;
	}
	return top;
}
```

찾아보니 같은 일을 하는 코드가 두 벌이었다. 창 순서를 다루는 순수 함수 모음(`appStack.ts`)에 `foregroundApp`이 있었는데, 앱 상태(`AppStateContext`)는 주소 막대를 맞출 때 같은 반복문을 따로 돌고 있었다. 앱 상태도 `foregroundApp`을 쓰게 하고, 메뉴 막대도 같은 함수를 쓴다. 이 정리로 `AppStateContext.tsx`는 14줄 가운데 11줄이 빠졌다. 이 함수는 지금 `packages/desktop-core/src/window/stack.ts`로 옮겨 React 밖에서도 쓴다.

```tsx
const { apps } = useAppState();
const activeApp = APP_MANIFEST[foregroundApp(apps) ?? 'finder'].label;
```

이름은 Dock·Launchpad와 같은 앱 정보(`manifest.ts`)의 이름을 쓴다. 그래서 macOS 한국어판처럼 '메모', '음악', '시스템 설정'으로 보인다.

![사진 창과 메일 창을 앞에 두었을 때의 메뉴 막대](./images/menu-bar-app-name-strip.jpg '맨 앞 창에 따라 앱 이름과 메뉴가 바뀐다')

## 화면 테스트

- 처음에는 Safari 창이 떠 있어서 'Safari'
- Dock에서 메모를 열면 '메모', 다시 Safari를 누르면 'Safari'
- Safari를 최소화하면 그 뒤의 '메모', 메모까지 닫으면 'Finder'

## 창 밖을 누르면 Finder

macOS에서 바탕화면을 누르면 창은 그대로 둔 채 Finder가 앞으로 온다. 메뉴 막대 이름도 Finder가 된다. 처음 만든 것은 "맨 앞 창"만 봐서, 바탕화면을 눌러도 이름이 그대로였다.

![activeApp을 정하는 규칙](./images/menu-bar-app-name-active.svg '창 밖을 눌렀으면 Finder, 아니면 맨 앞 창의 앱')

**창 순서와 "지금 쓰는 앱"을 나눴다.** 창 순서(zIndex)는 그대로 두고, 앱 상태에 "창 밖을 눌렀는지"를 하나 더 둔다. 지금 쓰는 앱은 창 밖을 눌렀으면 없음(Finder), 아니면 맨 앞 창의 앱이다. 창을 누르거나 Dock에서 앱을 열면 다시 그 앱이 된다.

```ts
const [desktopFocused, setDesktopFocused] = useState(false);
const focusDesktop = useCallback(() => setDesktopFocused(true), []);
const activeApp = desktopFocused ? null : foregroundApp(apps);
```

창 순서를 건드리지 않은 것은 바탕화면을 눌러도 창들은 그대로 겹쳐 있어야 해서다. 맨 앞 창을 뒤로 보내면 창 겹침 순서가 바뀐다.

어디를 눌렀는지 가리는 방법은 몇 가지가 있었다.

| 방법                                                           | 문제                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 바탕화면 요소에만 `onPointerDown`을 단다                       | 메뉴 막대·Dock은 따로 처리해야 하고, 바탕화면 아이콘처럼 그 위에 놓인 것을 누르면 이벤트가 오지 않는다 |
| `document`에 듣는 함수를 달고 누른 곳이 창 안인지 DOM으로 본다 | 창이 띄운 메뉴는 `body`에 그려져(포털) DOM으로는 창 밖이다                                             |
| 화면 전체를 덮는 판의 캡처 핸들러 + 창의 캡처 핸들러 (고름)    | 판이 레이아웃을 덮어야 한다                                                                            |

어디를 눌렀는지는 이벤트 순서로 가린다.

```tsx
// 화면 전체를 덮는 바탕화면 판: 먼저(캡처) 바탕화면을 앞으로
<div className="desktop-surface" onPointerDownCapture={focusDesktop}>
	<StatusBar />
	<OpenedApps /> {/* 창마다 onPointerDownCapture={() => bringAppToFront(appName)} */}
	<Dock />
</div>
```

![바탕화면 판과 창의 캡처 핸들러 순서](./images/menu-bar-app-name-capture.svg '판이 먼저 Finder로 바꾸고, 창 안이면 창이 다시 자기 앱으로 바꾼다')

캡처 단계는 바깥에서 안쪽으로 내려간다. 어디를 누르든 바탕화면 판이 먼저 "바탕화면"으로 바꾸고, 누른 곳이 창 안이면 바로 이어서 창이 "내 앱"으로 바꾼다. 메뉴 막대·Dock·바탕화면에는 창이 없으니 바탕화면으로 남는다.

걱정한 것은 창이 띄우는 메뉴였다. 메모의 '정렬과 그룹화' 메뉴는 창 밖(`document.body`)에 그려진다(포털). DOM으로 보면 창 밖을 누른 것이다. 그런데 React 이벤트는 DOM이 아니라 **React 트리**를 따라 전해진다. 포털 안의 메뉴는 React 트리에서 여전히 그 창 안에 있어서, 창의 캡처 핸들러가 불리고 메모로 남는다. 화면 테스트로 이것까지 확인했다.

처음에는 이 판을 `display: contents`로 두었다. 레이아웃에 끼어들지 않게 하려던 것인데, 그러면 판에 크기가 없어서 바탕화면을 누른 이벤트가 판이 아니라 그 바깥 상자에 닿았다. 판이 화면을 꽉 채우게 바꿨다.

Dock에서 앱을 누를 때 늘 그 앱을 앞으로 가져오던 것도 고쳤다. '공유'처럼 창이 없는 항목까지 앞으로 가져오는 바람에, 공유를 누르면 이름이 Finder가 아니라 뒤에 있던 창의 앱으로 돌아가게 되어 있었다. 이제 창을 여는 앱만 앞으로 가져온다.

화면 테스트에 더한 것:

- 바탕화면 빈 곳을 누르면 Finder, Safari 창을 누르면 Safari, 메뉴 막대의 File을 누르면 Finder, Dock에서 Safari를 누르면 Safari
- 메모 창의 '정렬과 그룹화' 메뉴에서 항목을 골라도 메모

### Dock을 누르는 동안의 깜빡임

며칠 뒤 Dock에서 메모를 누를 때 메뉴 막대 이름이 'Safari → Finder → 메모'로 한 번 깜빡이는 것을 봤다. 누르는 순간(pointerdown) 바탕화면 판이 Finder로 바꾸고, 클릭이 끝나야(click) 메모가 열렸기 때문이다. 판이 건너뛰는 곳에 `.dock`과 `.launchpad-content`를 더해, Dock을 누르는 동안은 이름이 그대로이고 클릭이 끝나면 그 앱으로 바뀌게 했다(`c1c53cbfb`). 시험은 앱 이름 요소에 `MutationObserver`를 달아 지나간 글자를 모두 적고, 그 안에 'Finder'가 없는지 본다.

같은 무렵, 앱 이름이 Finder로 바뀔 때만 글자가 1.5px 위로 올라가는 것도 고쳤다. 항목이 없는 Finder 메뉴만 `<span>`으로, 나머지는 `<button>`으로 그려서 요소가 바뀔 때마다 수직 정렬이 달랐다. 늘 같은 버튼을 같은 `key`(`'app-menu'`)로 두고 글자만 바꾸게 했다. 자세한 이야기는 [메뉴 막대의 메뉴](/memo/menubar-menus)에 적었다.

### 메뉴 막대는 빼기로

처음에는 메뉴 막대도 "창 밖"으로 쳐서, 시계나 Apple 메뉴를 눌러도 Finder가 되게 했다. 써 보니 어색했다. 메뉴 막대는 지금 쓰는 앱 위에 늘 떠 있는 막대라, 음량을 바꾸거나 Apple 메뉴를 열었다고 앱이 바뀌면 안 된다. macOS도 그렇다.

메뉴 막대와 거기서 연 메뉴·창(Apple 메뉴, 서버 상태, 음량)은 눌러도 지금 앱이 그대로다. 메뉴는 `body`에 그려지므로 바탕화면 판은 누른 곳이 메뉴 막대 안이거나 메뉴(`.ui-menu`)·음량 창이면 건너뛴다. 창이 띄운 메뉴는 이어서 창이 자기 앱을 앞으로 하니 그대로 맞다. 이제 Finder가 되는 것은 바탕화면 빈 곳을 누를 때뿐이다. Dock(Launchpad 포함)은 앞에서 적었듯이 누르는 동안 이름을 그대로 두고, 창이 없는 '공유' 같은 항목을 누르면 그대로 남는다.

## 확인

- `e2e/desktop.spec.ts`의 "메뉴 막대의 앱 이름은 맨 앞 창의 앱이고, 보이는 창이 없으면 Finder"와 "메뉴 막대 글자는 보통 굵기이고, 맨 앞 앱 이름만 굵다".
- `e2e/menubar.spec.ts`의 "바탕화면을 눌러 Finder가 되면 창 항목이 없는 Finder의 메뉴 (Finder는 종료할 수 없다)", "Dock에서 앱을 누르는 동안 앱 이름은 그대로이고, 클릭이 끝나면 그 앱으로 (Finder로 깜빡이지 않는다)", "앱 이름이 Finder로 바뀌어도 같은 자리, 같은 높이 (움찔거리지 않는다)".
- 바뀐 코드 양은 작다. #97은 3개 파일 33줄 더하기·13줄 빼기, #101의 기능 커밋은 5개 파일 67줄 더하기·10줄 빼기였다.

## 남은 것·배운 것

- 그 옆의 File·Edit·View·Go·Window·Help는 이 글을 쓸 때 이름만 있었다. 앱 안에 있는 동작을 바깥의 메뉴 막대가 부를 길부터 만들어야 해서 계획을 이슈(#96)로 적었고, 다음 날 [메뉴 막대의 메뉴](/memo/menubar-menus)에서 앱마다 메뉴와 단축키를 붙였다.
- "맨 앞 창"과 "지금 쓰는 앱"은 비슷해 보여도 다른 상태였다. 하나로 두려다 보면 바탕화면을 눌렀을 때 창 순서를 망가뜨리게 된다. 상태를 나누고 `activeApp`을 계산 값으로 두니 코드가 가장 짧았다.
- React 이벤트가 DOM이 아니라 React 트리를 따라 전해진다는 점은 포털 메뉴를 다룰 때 도움이 되었다. 반대로 포털로 그린 전역 메뉴(Apple 메뉴, 음량)는 React 트리에서도 창 밖이라 클래스 이름으로 따로 건너뛰어야 했다.

## 관련 글

- [메뉴 막대의 메뉴](/memo/menubar-menus)
- [시간이 바뀔 때 움찔하던 메뉴 막대](/memo/menubar-clock-width)
- [앱이 많아지자 Dock이 Launchpad와 겹쳤다](/memo/dock-layout)

#MacFolio #데스크톱 #메뉴막대
