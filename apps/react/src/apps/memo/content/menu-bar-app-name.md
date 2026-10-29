---
title: 창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기
date: 2026-10-05
category: 개발 기록/MacFolio/프론트엔드
series: 메뉴 막대
seriesOrder: 3
summary: 메뉴 막대에 고정 문자열로 있던 'Finder'를 맨 앞 창의 앱 이름으로 바꿨다. 창 순서와 '활성 앱'을 분리해 바탕화면을 누르면 Finder가 되게 하고, 메뉴 막대·Dock을 누를 때의 예외와 깜빡임도 수정했다.
---

macOS 메뉴 막대에서 Apple 로고 오른쪽의 굵은 글자는 **현재 활성 앱**의 이름이다. Safari를 사용 중이면 'Safari', 메모를 사용 중이면 '메모'다. 창을 모두 닫으면 데스크톱을 담당하는 Finder가 된다.

MacFolio에서는 이 위치에 `Finder`가 고정 문자열로 들어 있었다. 어떤 창을 사용하든 항상 Finder였다.

## 배경

재현 방법은 다음과 같다. 데스크톱에 접속하면 처음부터 Safari 창이 열려 있는데, 메뉴 막대는 'Finder'였다. Dock에서 메모나 음악을 열어도 바뀌지 않았다. 메뉴 막대 오른쪽의 시계·음량은 실제로 동작하는데 왼쪽 앱 이름만 고정되어 있어, macOS를 재현한 화면에서 가장 먼저 드러나는 차이였다. 이후 추가할 앱별 메뉴(File·Edit…)도 "활성 앱"을 알아야 구현할 수 있어서, 앱 이름을 먼저 수정했다.

이 작업은 PR 세 개로 나뉘었다.

| PR                                                       | 변경 내용                                       |
| -------------------------------------------------------- | ----------------------------------------------- |
| [#97](https://github.com/hyeoniverse/MacFolio/pull/97)   | 앱 이름이 맨 앞 창을 따르고, 창이 없으면 Finder |
| [#101](https://github.com/hyeoniverse/MacFolio/pull/101) | 창 밖(바탕화면)을 누르면 Finder                 |
| [#110](https://github.com/hyeoniverse/MacFolio/pull/110) | 메뉴 막대와 거기서 연 메뉴는 눌러도 앱 유지     |

## 맨 앞 창 계산은 이미 있었다

주소 막대가 맨 앞 창의 항목(메모의 글, Safari의 프로젝트)을 표시하도록 구현할 때, 맨 앞 창을 계산하는 함수를 이미 만들었다. 실행 중이고 최소화하지 않은 창 가운데 zIndex가 가장 큰 앱이다.

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

확인해 보니 같은 계산을 하는 코드가 두 곳에 있었다. 창 순서를 다루는 순수 함수 모음(`appStack.ts`)에 `foregroundApp`이 있었는데, 앱 상태(`AppStateContext`)는 주소 막대를 갱신할 때 같은 반복문을 별도로 실행하고 있었다. 앱 상태도 `foregroundApp`을 호출하게 하고, 메뉴 막대도 같은 함수를 사용한다. 이 정리로 `AppStateContext.tsx`에서 14줄 중 11줄을 삭제했다. 이 함수는 현재 `packages/desktop-core/src/window/stack.ts`로 옮겨 React 밖에서도 사용한다.

```tsx
const { apps } = useAppState();
const activeApp = APP_MANIFEST[foregroundApp(apps) ?? 'finder'].label;
```

이름은 Dock·Launchpad와 같은 앱 정보(`manifest.ts`)의 `label`을 사용한다. 그래서 macOS 한국어판처럼 '메모', '음악', '시스템 설정'으로 표시된다.

![사진 창과 메일 창을 앞에 두었을 때의 메뉴 막대](./images/menu-bar-app-name-strip.jpg '맨 앞 창에 따라 앱 이름과 메뉴가 바뀐다')

## 화면 시험

| 동작                       | 메뉴 막대의 앱 이름 |
| -------------------------- | ------------------- |
| 첫 접속 (Safari 창이 열림) | Safari              |
| Dock에서 메모 열기         | 메모                |
| Dock에서 Safari 누르기     | Safari              |
| Safari 최소화              | 메모 (그 뒤의 창)   |
| 메모까지 닫기              | Finder              |

## 창 밖을 누르면 Finder

macOS에서 바탕화면을 누르면 창 배치는 유지한 채 Finder가 활성화된다. 메뉴 막대 이름도 Finder가 된다. 첫 구현은 "맨 앞 창"만 기준으로 해서, 바탕화면을 눌러도 이름이 바뀌지 않았다.

![activeApp을 정하는 규칙](./images/menu-bar-app-name-active.svg '창 밖을 눌렀으면 Finder, 아니면 맨 앞 창의 앱')

**창 순서와 "활성 앱"을 분리했다.** 창 순서(zIndex)는 유지하고, 앱 상태에 "창 밖을 눌렀는지" 값을 추가한다. 활성 앱은 창 밖을 눌렀으면 없음(Finder), 아니면 맨 앞 창의 앱이다. 창을 누르거나 Dock에서 앱을 열면 다시 그 앱이 활성화된다.

```ts
const [desktopFocused, setDesktopFocused] = useState(false);
const focusDesktop = useCallback(() => setDesktopFocused(true), []);
const activeApp = desktopFocused ? null : foregroundApp(apps);
```

창 순서를 변경하지 않은 이유는 바탕화면을 눌러도 창의 겹침 순서가 유지되어야 하기 때문이다. 맨 앞 창을 뒤로 보내는 방식으로 구현하면 겹침 순서가 바뀐다.

누른 위치를 판별하는 방법은 세 가지를 비교했다.

| 방법                                                                | 문제                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 바탕화면 요소에만 `onPointerDown`을 등록                            | 메뉴 막대·Dock은 별도로 처리해야 하고, 바탕화면 아이콘처럼 그 위에 배치된 요소를 누르면 이벤트가 전달되지 않는다 |
| `document`에 리스너를 등록하고 누른 위치가 창 안인지 DOM으로 판별   | 창이 연 메뉴는 `body`에 렌더링되어(포털) DOM 기준으로는 창 밖이다                                                |
| **화면 전체를 덮는 레이어의 캡처 핸들러 + 창의 캡처 핸들러 (선택)** | 레이어가 레이아웃 전체를 감싸야 한다                                                                             |

누른 위치는 이벤트 처리 순서로 판별한다.

```tsx
// 화면 전체를 덮는 바탕화면 판: 먼저(캡처) 바탕화면을 앞으로
<div className="desktop-surface" onPointerDownCapture={focusDesktop}>
	<StatusBar />
	<OpenedApps /> {/* 창마다 onPointerDownCapture={() => bringAppToFront(appName)} */}
	<Dock />
</div>
```

![바탕화면 레이어와 창의 캡처 핸들러 순서](./images/menu-bar-app-name-capture.svg '레이어가 먼저 Finder로 바꾸고, 창 안이면 창이 다시 자기 앱으로 바꾼다')

이벤트의 캡처 단계[^capture]는 바깥 요소에서 안쪽 요소로 전파된다. 어디를 누르든 바탕화면 레이어가 먼저 "바탕화면"으로 설정하고, 누른 위치가 창 안이면 이어서 창의 핸들러가 "자기 앱"으로 다시 설정한다. 메뉴 막대·Dock·바탕화면에는 창 핸들러가 없으므로 바탕화면 상태가 유지된다.

우려한 부분은 창이 여는 메뉴였다. 메모의 '정렬과 그룹화' 메뉴는 창 밖(`document.body`)에 렌더링된다([포털](https://react.dev/reference/react-dom/createPortal)). DOM 기준으로는 창 밖을 누른 것이다. 그런데 React 이벤트는 DOM이 아니라 **React 트리**를 따라 전파된다. 포털 안의 메뉴는 React 트리에서 여전히 그 창의 하위에 있으므로, 창의 캡처 핸들러가 호출되어 메모가 활성 상태로 유지된다. 화면 시험으로 이 동작까지 확인했다.

처음에는 이 레이어에 `display: contents`를 지정했다. 레이아웃에 영향을 주지 않게 하려는 의도였지만, 그러면 레이어에 상자가 생성되지 않아 바탕화면을 누른 이벤트의 대상이 레이어가 아니라 그 바깥 상자가 됐다. 레이어가 화면 전체를 채우도록 변경했다.

Dock에서 앱을 누를 때 항상 그 앱을 앞으로 가져오던 동작도 수정했다. '공유'처럼 창이 없는 항목까지 앞으로 가져와서, 공유를 누르면 이름이 Finder가 아니라 뒤에 있던 창의 앱으로 바뀌었다. 이제 창을 여는 앱만 앞으로 가져온다.

화면 시험에 추가한 항목:

- 바탕화면 빈 곳을 누르면 Finder, Safari 창을 누르면 Safari, 메뉴 막대의 File을 누르면 Finder, Dock에서 Safari를 누르면 Safari
- 메모 창의 '정렬과 그룹화' 메뉴에서 항목을 선택해도 메모 유지

### Dock을 누르는 동안의 깜빡임

며칠 뒤 Dock에서 메모를 누를 때 메뉴 막대 이름이 'Safari → Finder → 메모'로 한 번 깜빡이는 현상을 발견했다. 누르는 시점(`pointerdown`)에 바탕화면 레이어가 Finder로 바꾸고, 클릭이 끝나야(`click`) 메모가 열렸기 때문이다. 레이어의 제외 대상에 `.dock`과 `.launchpad-content`를 추가해, Dock을 누르는 동안은 이름이 유지되고 클릭이 끝나면 그 앱으로 바뀌게 했다(`c1c53cbfb`). 시험은 앱 이름 요소에 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)를 등록해 거쳐 간 문자열을 모두 기록하고, 그 안에 'Finder'가 없는지 확인한다.

같은 시기에, 앱 이름이 Finder로 바뀔 때만 글자가 1.5px 위로 이동하는 문제도 수정했다. 항목이 없는 Finder 메뉴만 `<span>`으로, 나머지는 `<button>`으로 렌더링해서 요소가 바뀔 때마다 수직 정렬이 달랐다. 항상 같은 `<button>`을 같은 `key`(`'app-menu'`)로 렌더링하고 텍스트만 바꾸게 했다. 자세한 내용은 [메뉴 막대의 메뉴](/memo/menubar-menus)에 정리했다.

### 메뉴 막대는 제외

처음에는 메뉴 막대도 "창 밖"으로 처리해서, 시계나 Apple 메뉴를 눌러도 Finder가 활성화됐다. 이 동작은 macOS와 달랐다. 메뉴 막대는 활성 앱과 함께 항상 표시되는 막대라, 음량을 바꾸거나 Apple 메뉴를 열었다고 활성 앱이 바뀌면 안 된다. macOS도 바뀌지 않는다.

메뉴 막대와 거기서 연 메뉴·창(Apple 메뉴, 서버 상태, 음량)은 눌러도 활성 앱이 유지된다. 메뉴는 `body`에 렌더링되므로, 바탕화면 레이어는 누른 위치가 메뉴 막대 안이거나 메뉴(`.ui-menu`)·음량 창이면 처리를 건너뛴다. 창이 연 메뉴는 이어서 창 핸들러가 자기 앱을 활성화하므로 결과가 같다.

| 누른 위치                        | 활성 앱             |
| -------------------------------- | ------------------- |
| 바탕화면 빈 곳                   | Finder              |
| 창 (창이 연 포털 메뉴 포함)      | 그 창의 앱          |
| 메뉴 막대, Apple 메뉴, 음량 창   | 유지                |
| Dock·Launchpad (누르는 동안)     | 유지, 클릭 후 연 앱 |
| Dock의 '공유'처럼 창이 없는 항목 | 유지                |

## 확인

- `e2e/desktop.spec.ts`의 "메뉴 막대의 앱 이름은 맨 앞 창의 앱이고, 보이는 창이 없으면 Finder"와 "메뉴 막대 글자는 보통 굵기이고, 맨 앞 앱 이름만 굵다".

<details>
<summary>나머지 시험 이름과 변경 규모</summary>

- `e2e/menubar.spec.ts`의 "바탕화면을 눌러 Finder가 되면 창 항목이 없는 Finder의 메뉴 (Finder는 종료할 수 없다)", "Dock에서 앱을 누르는 동안 앱 이름은 그대로이고, 클릭이 끝나면 그 앱으로 (Finder로 깜빡이지 않는다)", "앱 이름이 Finder로 바뀌어도 같은 자리, 같은 높이 (움찔거리지 않는다)".
- 변경 규모는 작다. #97은 3개 파일 33줄 추가·13줄 삭제, #101의 기능 커밋은 5개 파일 67줄 추가·10줄 삭제였다.

</details>

## 남은 것·정리

- 그 옆의 File·Edit·View·Go·Window·Help는 이 글을 쓴 시각에는 이름만 있었다. 앱 내부의 동작을 외부의 메뉴 막대가 호출하는 경로부터 만들어야 해서 계획을 이슈 [#96](https://github.com/hyeoniverse/MacFolio/issues/96)으로 작성했고, 다음 날 [메뉴 막대의 메뉴](/memo/menubar-menus)에서 앱마다 메뉴와 단축키를 추가했다.
- "맨 앞 창"과 "활성 앱"은 비슷해 보여도 다른 상태였다. 하나의 상태로 처리하면 바탕화면을 눌렀을 때 창 순서를 바꿔야 한다. 상태를 분리하고 `activeApp`을 파생 값으로 계산하니 코드가 가장 짧았다.
- React 이벤트가 DOM이 아니라 React 트리를 따라 전파된다는 점은 포털 메뉴를 처리할 때 유리했다. 반대로 포털로 렌더링한 전역 메뉴(Apple 메뉴, 음량)는 React 트리에서도 창 밖이라 클래스 이름으로 별도 제외해야 했다.

## 관련 글

- [메뉴 막대의 메뉴](/memo/menubar-menus)
- [tabular-nums와 그리드 셀 겹치기로 가변 폭 텍스트의 칸 너비 고정하기](/memo/menubar-clock-width)
- [절대 위치 대신 내용 폭 한 줄 flex로 겹치지 않는 Dock 배치](/memo/dock-layout)
- [캡처 단계 이벤트와 pointer capture로 맞춘 화면과 입력 처리 영역](/memo/window-menubar-input-fixes): Dock을 누르는 동안의 깜빡임을 포함한 포인터 입력 결함

[^capture]: DOM 이벤트는 캡처 단계(문서 루트 → 대상), 대상 단계, 버블링 단계(대상 → 문서 루트) 순서로 전파된다. React의 `onPointerDownCapture`처럼 `Capture`로 끝나는 속성은 캡처 단계의 핸들러다. [MDN: addEventListener의 capture 옵션](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#capture)

#MacFolio #데스크톱 #메뉴막대
