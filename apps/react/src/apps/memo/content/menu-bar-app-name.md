---
title: 창 순서와 분리한 활성 앱 상태로 메뉴 막대 앱 이름 맞추기
date: 2026-10-05
category: 개발 기록/MacFolio/구조·상태 관리
series: 메뉴 막대
seriesOrder: 3
summary: 메뉴 막대에 고정 문자열로 있던 'Finder'를 맨 앞 창의 앱 이름으로 바꿨다. 창 순서와 '활성 앱'을 분리해 바탕화면을 누르면 Finder가 되게 하고, 메뉴 막대·Dock을 누를 때의 예외와 깜빡임도 수정했다.
---

## 배경: macOS 메뉴 막대의 앱 이름

macOS 화면 맨 위의 가로 막대를 [메뉴 막대](https://support.apple.com/guide/mac-help/the-menu-bar-mchlp1446/mac)라 한다. 왼쪽 끝 Apple 로고 오른쪽의 굵은 글자는 **현재 활성 앱**의 이름이다. 활성 앱은 키보드 입력과 메뉴 명령을 받는 앱이다. Safari를 사용 중이면 'Safari', 메모를 사용 중이면 '메모'가 표시되고, 그 오른쪽의 File·Edit 같은 메뉴도 그 앱의 메뉴로 바뀐다. 창을 모두 닫거나 바탕화면을 누르면 바탕화면과 파일 관리를 담당하는 Finder가 활성 앱이 된다.

MacFolio에서는 이 위치에 `Finder`가 고정 문자열로 들어 있었다. 어떤 창을 사용하든 항상 Finder였다.

데스크톱에 접속하면 처음부터 Safari 창이 열려 있는데, 메뉴 막대는 'Finder'였다. Dock에서 메모나 음악을 열어도 바뀌지 않았다. 메뉴 막대 오른쪽의 시계·음량은 실제로 동작하는데 왼쪽 앱 이름만 고정되어 있어, macOS를 재현한 화면에서 가장 먼저 눈에 띄는 차이였다. 이후 추가할 앱별 메뉴(File·Edit…)도 "활성 앱"을 알아야 구현할 수 있어서, 앱 이름을 먼저 수정했다.

이 작업은 PR 세 개로 나뉘었다.

| PR                                                       | 변경 내용                                       |
| -------------------------------------------------------- | ----------------------------------------------- |
| [#97](https://github.com/hyeoniverse/MacFolio/pull/97)   | 앱 이름이 맨 앞 창을 따르고, 창이 없으면 Finder |
| [#101](https://github.com/hyeoniverse/MacFolio/pull/101) | 창 밖(바탕화면)을 누르면 Finder                 |
| [#110](https://github.com/hyeoniverse/MacFolio/pull/110) | 메뉴 막대와 거기서 연 메뉴는 눌러도 앱 유지     |

## 맨 앞 창을 계산하는 함수

창이 겹쳐 있을 때 어느 창이 위에 그려지는지는 CSS의 `z-index` 값으로 정한다. 값이 클수록 앞에 그려진다. MacFolio의 창 상태는 앱마다 실행 여부(`isRunning`), 최소화 여부(`isMinimized`), 쌓임 순서(`zIndex`)를 보관한다.

주소 막대가 맨 앞 창의 항목(메모의 글, Safari의 프로젝트)을 표시하도록 구현할 때, 맨 앞 창을 계산하는 함수를 이미 만들었다. 실행 중이고 최소화하지 않은 창 가운데 `zIndex`가 가장 큰 앱이다.

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

예를 들어 창 상태가 다음과 같으면 결과는 `'memo'`다. Safari는 `zIndex`가 가장 크지만 최소화되어 있어 후보에서 빠진다.

| 앱     | `isRunning` | `isMinimized` | `zIndex` | 후보 여부         |
| ------ | ----------- | ------------- | -------- | ----------------- |
| Safari | true        | **true**      | 3        | 제외 (최소화)     |
| 메모   | true        | false         | 2        | **맨 앞**         |
| 음악   | true        | false         | 1        | 후보              |
| 사진   | false       | false         | 0        | 제외 (실행 안 함) |

확인해 보니 같은 계산을 하는 코드가 두 곳에 있었다. 창 순서를 다루는 순수 함수 모음(`appStack.ts`)에 `foregroundApp`이 있었는데, 앱 상태(`AppStateContext`)는 주소 막대를 갱신할 때 같은 반복문을 별도로 실행하고 있었다. 앱 상태도 `foregroundApp`을 호출하게 하고, 메뉴 막대도 같은 함수를 사용한다. 이 정리로 `AppStateContext.tsx`에서 14줄 중 11줄을 삭제했다. 이 함수는 현재 `packages/desktop-core/src/window/stack.ts`로 옮겨 React 밖에서도 사용한다.

```tsx
const { apps } = useAppState();
const activeApp = APP_MANIFEST[foregroundApp(apps) ?? 'finder'].label;
```

이름은 Dock·Launchpad와 같은 앱 정보(`manifest.ts`)의 `label`을 사용한다. 그래서 macOS 한국어판처럼 '메모', '음악', '시스템 설정'으로 표시된다. 맨 앞 창이 없으면(`null`) `'finder'`의 label인 'Finder'가 된다.

![사진 창과 메일 창을 앞에 두었을 때의 메뉴 막대](./images/menu-bar-app-name-strip.jpg '맨 앞 창에 따라 앱 이름과 메뉴가 바뀐다')

| 동작                       | 메뉴 막대의 앱 이름 |
| -------------------------- | ------------------- |
| 첫 접속 (Safari 창이 열림) | Safari              |
| Dock에서 메모 열기         | 메모                |
| Dock에서 Safari 누르기     | Safari              |
| Safari 최소화              | 메모 (그 뒤의 창)   |
| 메모까지 닫기              | Finder              |

## 창 밖을 누르면 Finder

macOS에서 바탕화면을 누르면 창 배치는 유지한 채 Finder가 활성화된다. 메뉴 막대 이름도 Finder가 된다. 첫 구현은 "맨 앞 창"만 기준으로 해서, 바탕화면을 눌러도 이름이 바뀌지 않았다.

### 창 순서와 활성 앱을 분리

![activeApp을 정하는 규칙](./images/menu-bar-app-name-active.svg '창 밖을 눌렀으면 Finder, 아니면 맨 앞 창의 앱')

창 순서(`zIndex`)는 유지하고, 앱 상태에 "창 밖을 눌렀는지" 값(`desktopFocused`)을 추가했다. 활성 앱은 창 밖을 눌렀으면 없음(Finder), 아니면 맨 앞 창의 앱이다. 창을 누르거나 Dock에서 앱을 열면 다시 그 앱이 활성화된다.

```ts
const [desktopFocused, setDesktopFocused] = useState(false);
const focusDesktop = useCallback(() => setDesktopFocused(true), []);
const activeApp = desktopFocused ? null : foregroundApp(apps);
```

창 순서를 변경하지 않은 이유는 바탕화면을 눌러도 창의 겹침 순서가 유지되어야 하기 때문이다. 맨 앞 창을 뒤로 보내 Finder를 만드는 방식으로 구현하면, 바탕화면을 한 번 누른 뒤 창의 겹침 순서가 바뀐다. `activeApp`은 저장하지 않고 두 상태에서 매번 계산하는 **파생 값**이다.

### 누른 위치를 판별하는 방법

누른 위치를 판별하는 방법은 세 가지를 비교했다.

| 방법                                                                | 문제                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 바탕화면 요소에만 `onPointerDown`을 등록                            | 메뉴 막대·Dock은 별도로 처리해야 하고, 바탕화면 아이콘처럼 그 위에 배치된 요소를 누르면 이벤트가 전달되지 않는다 |
| `document`에 리스너를 등록하고 누른 위치가 창 안인지 DOM으로 판별   | 창이 연 메뉴는 `body`에 렌더링되어(포털) DOM 기준으로는 창 밖이다                                                |
| **화면 전체를 덮는 레이어의 캡처 핸들러 + 창의 캡처 핸들러 (선택)** | 레이어가 레이아웃 전체를 감싸야 한다                                                                             |

선택한 방법은 이벤트가 전파되는 순서를 이용한다. 브라우저에서 요소를 누르면 `pointerdown` 이벤트[^capture]는 한 요소에서만 발생하지 않고, 문서 맨 위부터 누른 요소까지 내려갔다가(캡처 단계) 다시 올라온다(버블링 단계).

![DOM 이벤트의 세 단계 전파](./images/menu-bar-app-name-w3c-eventflow.svg 'W3C UI Events 명세 초안(2016)의 그림. 표의 셀(td)을 누르면 이벤트가 Window에서 td까지 내려가는 캡처 단계(빨간색), td에서의 대상 단계(파란색), 다시 Window까지 올라가는 버블링 단계(초록색)를 차례로 거친다')

캡처 단계에서는 바깥 요소의 핸들러가 안쪽 요소의 핸들러보다 먼저 실행된다. 이 순서를 이용해 바깥의 바탕화면 레이어와 안쪽의 창에 각각 캡처 핸들러를 등록했다.

```tsx
// 화면 전체를 덮는 바탕화면 레이어: 먼저(캡처) 바탕화면을 앞으로
<div className="desktop-surface" onPointerDownCapture={focusDesktop}>
	<StatusBar />
	<OpenedApps /> {/* 창마다 onPointerDownCapture={() => bringAppToFront(appName)} */}
	<Dock />
</div>
```

![바탕화면 레이어와 창의 캡처 핸들러 순서](./images/menu-bar-app-name-capture.svg '레이어가 먼저 Finder로 바꾸고, 창 안이면 창이 다시 자기 앱으로 바꾼다')

어디를 누르든 바탕화면 레이어가 먼저 "바탕화면"으로 설정한다. 누른 위치가 창 안이면 이어서 창의 핸들러가 "자기 앱"으로 다시 설정한다. 바탕화면 빈 곳을 누르면 창 핸들러가 실행되지 않으므로 바탕화면 상태가 유지된다.

### 창이 연 메뉴: React 포털

우려한 부분은 창이 여는 메뉴였다. **포털(portal)**은 컴포넌트의 일부를 부모 DOM 요소 밖, 예를 들어 `document.body` 바로 아래에 렌더링하는 React 기능([`createPortal`](https://react.dev/reference/react-dom/createPortal))이다. 메뉴나 대화상자가 창의 `overflow: hidden`에 잘리지 않도록 할 때 쓴다. 메모의 '정렬과 그룹화' 메뉴도 포털로 `body`에 렌더링된다. 그래서 DOM 기준으로 판별하면 이 메뉴는 창 밖에 있다.

그런데 ==React 이벤트는 DOM이 아니라 React 트리를 따라 전파된다==. React 문서는 포털 안에서 발생한 이벤트가 DOM 위치와 관계없이 React 트리의 조상으로 전파된다고 명시한다.

![DOM 트리와 React 트리에서 포털 메뉴의 위치](./images/menu-bar-app-name-portal.svg 'DOM 트리에서 메뉴(.ui-menu)는 body의 자식이라 창 밖이다. React 트리에서는 메모 창의 자손이므로, 메뉴를 누르면 바탕화면 레이어와 메모 창의 캡처 핸들러가 차례로 실행되어 메모가 활성 앱으로 유지된다')

포털 안의 메뉴는 React 트리에서 여전히 그 창의 하위에 있으므로, 창의 캡처 핸들러가 호출되어 메모가 활성 상태로 유지된다. 화면 시험으로 이 동작까지 확인했다.

> [!WARNING] display: contents와 이벤트 대상
> 처음에는 이 레이어에 `display: contents`를 지정했다. `display: contents`는 요소 자신의 상자(box)를 만들지 않고 자식 요소만 부모의 레이아웃에 참여시키는 값으로, 레이아웃에 영향을 주지 않게 하려는 의도였다. 그러면 레이어에 상자가 생성되지 않아, 바탕화면 빈 곳을 누른 이벤트의 대상이 레이어가 아니라 그 바깥 상자가 됐다. 레이어 바깥에서 시작한 이벤트는 레이어의 캡처 핸들러를 거치지 않는다. 레이어가 화면 전체를 채우도록 변경했다.

### 창이 없는 Dock 항목

Dock에서 앱을 누를 때 항상 그 앱을 앞으로 가져오던 동작도 수정했다. '공유'처럼 창이 없는 항목까지 앞으로 가져와서, 공유를 누르면 이름이 Finder가 아니라 뒤에 있던 창의 앱으로 바뀌었다. 이제 창을 여는 앱만 앞으로 가져온다.

화면 시험에 추가한 항목:

- 바탕화면 빈 곳을 누르면 Finder, Safari 창을 누르면 Safari, 메뉴 막대의 File을 누르면 Finder, Dock에서 Safari를 누르면 Safari
- 메모 창의 '정렬과 그룹화' 메뉴에서 항목을 선택해도 메모 유지

### Dock을 누르는 동안의 깜빡임

며칠 뒤 Dock에서 메모를 누를 때 메뉴 막대 이름이 'Safari → Finder → 메모'로 한 번 깜빡이는 현상을 발견했다. 마우스 버튼을 누르는 순간(`pointerdown`)에 바탕화면 레이어가 Finder로 바꾸고, 버튼을 떼어 클릭이 완료되는 순간(`click`)에 메모가 열렸기 때문이다. 두 이벤트 사이에는 사용자가 버튼을 누르고 있는 시간만큼 간격이 있어 Finder가 화면에 표시됐다.

![Dock을 누르는 동안의 앱 이름 변화](./images/menu-bar-app-name-flicker.svg '고치기 전에는 pointerdown에서 Finder로 바뀌었다가 click에서 메모가 된다. 고친 뒤에는 Dock을 누르는 동안 Safari가 유지되고 click에서 메모로 바뀐다')

레이어의 제외 대상에 `.dock`과 `.launchpad-content`를 추가해, Dock을 누르는 동안은 이름이 유지되고 클릭이 끝나면 그 앱으로 바뀌게 했다(`c1c53cbfb`). 시험은 앱 이름 요소에 [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)를 등록해 거쳐 간 문자열을 모두 기록하고, 그 안에 'Finder'가 없는지 확인한다. `MutationObserver`는 DOM 요소의 내용이나 속성이 바뀔 때마다 콜백을 호출하는 브라우저 API로, 사람 눈에 한 프레임만 보이는 변화도 기록할 수 있다.

같은 시기에, 앱 이름이 Finder로 바뀔 때만 글자가 1.5px 위로 이동하는 문제도 수정했다. 항목이 없는 Finder 메뉴만 `<span>`으로, 나머지는 `<button>`으로 렌더링해서 요소가 바뀔 때마다 수직 정렬이 달랐다. 항상 같은 `<button>`을 같은 `key`(`'app-menu'`)로 렌더링하고 텍스트만 바꾸게 했다. 자세한 내용은 [메뉴 막대의 메뉴](/memo/menubar-menus)에 정리했다.

### 메뉴 막대는 제외

처음에는 메뉴 막대도 "창 밖"으로 처리해서, 시계나 Apple 메뉴를 눌러도 Finder가 활성화됐다. 이 동작은 macOS와 달랐다. ==메뉴 막대는 활성 앱과 함께 항상 표시되는 막대==라, 음량을 바꾸거나 Apple 메뉴를 열었다고 활성 앱이 바뀌면 안 된다. macOS도 바뀌지 않는다.

메뉴 막대와 거기서 연 메뉴·창(Apple 메뉴, 서버 상태, 음량)은 눌러도 활성 앱이 유지된다. 이 메뉴들도 `body`에 렌더링되므로, 바탕화면 레이어는 누른 위치가 메뉴 막대 안이거나 메뉴(`.ui-menu`)·음량 창이면 처리를 건너뛴다. 창이 연 메뉴는 이어서 창 핸들러가 자기 앱을 활성화하므로 결과가 같다.

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
- 변경 규모는 작다. [#97](https://github.com/hyeoniverse/MacFolio/pull/97)은 3개 파일 33줄 추가·13줄 삭제, [#101](https://github.com/hyeoniverse/MacFolio/pull/101)의 기능 커밋은 5개 파일 67줄 추가·10줄 삭제였다.

</details>

## 남은 과제와 설계 판단

| 항목               | 내용                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 앱별 메뉴          | 앱 이름 옆의 File·Edit·View·Go·Window·Help는 이 작업 시각에는 이름만 있었다. 앱 내부의 동작을 외부의 메뉴 막대가 호출하는 경로부터 만들어야 해서 계획을 이슈 [#96](https://github.com/hyeoniverse/MacFolio/issues/96)으로 작성했고, 다음 날 [메뉴 막대의 메뉴](/memo/menubar-menus)에서 앱마다 메뉴와 단축키를 추가했다 |
| 상태 분리          | "맨 앞 창"과 "활성 앱"은 비슷해 보여도 다른 상태였다. 하나의 상태로 처리하면 바탕화면을 눌렀을 때 창 순서를 바꿔야 한다. 상태를 분리하고 `activeApp`을 파생 값으로 계산하니 코드가 가장 짧았다                                                                                                                          |
| 포털과 이벤트 전파 | React 이벤트가 React 트리를 따라 전파된다는 점은 창이 연 포털 메뉴를 처리할 때 유리했다. 반대로 메뉴 막대가 연 전역 메뉴(Apple 메뉴, 음량)는 React 트리에서도 창 밖이라 클래스 이름으로 별도 제외해야 했다                                                                                                              |

## 관련 글

- [메뉴 막대의 메뉴](/memo/menubar-menus)
- [tabular-nums와 그리드 셀 겹치기로 가변 폭 텍스트의 칸 너비 고정하기](/memo/menubar-clock-width)
- [절대 위치 대신 내용 폭 한 줄 flex로 겹치지 않는 Dock 배치](/memo/dock-layout)
- [캡처 단계 이벤트와 pointer capture로 맞춘 화면과 입력 처리 영역](/memo/window-menubar-input-fixes): Dock을 누르는 동안의 깜빡임을 포함한 포인터 입력 결함

[^capture]: DOM 이벤트는 캡처 단계(문서 루트 → 대상), 대상 단계, 버블링 단계(대상 → 문서 루트) 순서로 전파된다. React의 `onPointerDownCapture`처럼 `Capture`로 끝나는 속성은 캡처 단계의 핸들러다. [MDN: addEventListener의 capture 옵션](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#capture)

<details>
<summary>참고 문헌</summary>

- Apple, [What’s in the menu bar on Mac?](https://support.apple.com/guide/mac-help/the-menu-bar-mchlp1446/mac)
- W3C, [UI Events (Working Draft, 2016-08-04): 3.1 Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow)
- MDN, [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)
- React, [createPortal](https://react.dev/reference/react-dom/createPortal)
- MDN, [display](https://developer.mozilla.org/en-US/docs/Web/CSS/display)
- MDN, [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)

</details>

<details>
<summary>사진 출처</summary>

- DOM 이벤트 전파 그림: W3C, [UI Events Working Draft 2016-08-04, 3.1 Event dispatch and DOM event flow](https://www.w3.org/TR/2016/WD-uievents-20160804/#event-flow), 원본 [eventflow.svg](https://github.com/w3c/uievents/blob/main/images/eventflow.svg), W3C Software and Document License, 출처 표기 (흰 바탕만 추가)

</details>

#MacFolio #데스크톱 #메뉴막대
