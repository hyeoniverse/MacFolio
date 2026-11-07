---
title: placement·useDismiss·Menu 세 모듈로 중복된 메뉴 구현 합치기
date: 2026-10-01
category: 개발 기록/MacFolio/화면·스타일
series: 공통 UI 컴포넌트
seriesOrder: 1
summary: 컨텍스트 메뉴, Apple 메뉴, 서식 창, 달력 등 다섯 곳이 "바깥 클릭 시 닫기"와 "화면 안 위치 보정"을 각각 구현하고 있었다. placement·useDismiss·Menu 세 모듈로 분리해 전환하고, 스크린샷 40장 비교로 바뀐 메뉴 네 개를 확인했다.
---

## 배경: 떠 있는 요소의 공통 동작

웹 화면에서 메뉴, 팝오버, 날짜 선택 달력처럼 다른 내용 위에 잠시 겹쳐 표시되는 요소를 **플로팅 요소**(floating element)라고 한다. 우클릭하면 나타나는 컨텍스트 메뉴, 버튼을 누르면 그 아래에 열리는 드롭다운이 대표적인 예다. 플로팅 요소는 겉모양이 달라도 거의 같은 동작 두 가지를 반드시 구현해야 한다.

1. **위치 보정**: 화면 오른쪽 끝에서 우클릭하면 메뉴가 화면 밖으로 잘린다. 열기 전에 메뉴 크기를 확인하고, 넘치면 화면 안쪽으로 옮겨야 한다.
2. **닫기**: 메뉴 바깥을 누르거나 Esc 키를 누르면 닫혀야 한다. 바깥 클릭을 판별하려면 문서 전체에 이벤트 리스너를 등록하고, 누른 대상이 메뉴 안쪽인지 확인한다.

또 플로팅 요소는 대개 `document.body` 바로 아래에 렌더링한다. 앱 창 안에 두면 창의 `overflow: hidden`에 잘리거나 다른 창 아래에 가려지기 때문이다. React에서는 [포털](https://react.dev/reference/react-dom/createPortal)(`createPortal`)로 컴포넌트를 부모 DOM 밖에 렌더링한다.

MacFolio에서 공통 컴포넌트로 전환하는 두 번째 단계([#58](https://github.com/hyeoniverse/MacFolio/pull/58))에서 앱을 조사하니, 이 플로팅 요소(메뉴, 팝오버)를 다섯 곳에서 각각 구현하고 있었다.

| 위치                      | 렌더링 위치 | 위치 보정                      | 닫기                             |
| ------------------------- | ----------- | ------------------------------ | -------------------------------- |
| 메모 우클릭·정렬·••• 메뉴 | body        | 화면 안으로 (가로·세로)        | document의 pointerdown·keydown   |
| 메모 서식 창·표 핸들      | body        | 아래 가운데·오른쪽, 가로만     | 같은 코드 복사                   |
| 날짜 선택기 달력          | body        | 아래 왼쪽, 오른쪽 끝만         | 같은 코드 복사                   |
| Apple 메뉴                | body        | 로고 아래, 보정 없음           | 같은 코드 복사                   |
| 메시지 컨텍스트 메뉴      | **창 안**   | 대화 영역 기준 좌표, 보정 없음 | **window**의 pointerdown·keydown |

"바깥을 클릭하거나 Esc를 누르면 닫는다"는 ==15줄 내외의 코드가 네 번 거의 그대로 복사==되어 있었다. 메시지만 리스너를 `window`에 등록했다. 위치 보정은 다섯 곳이 모두 조금씩 달랐고, Apple 메뉴와 메시지 메뉴는 화면 밖으로 넘쳐도 보정하지 않았다.

## 채택한 방법과 제외한 방법

| 방법                                                             | 장점                                                       | 단점                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| 위치 계산 라이브러리([Floating UI](https://floating-ui.com/) 등) | 뒤집기·화살표·스크롤 추적까지 제공한다                     | 현재 필요한 기능은 "화면 밖으로 넘치면 안쪽으로 보정" 하나다  |
| 메뉴 컴포넌트 라이브러리([Radix](https://www.radix-ui.com/) 등)  | 접근성·키보드 탐색이 이미 구현되어 있다                    | macOS 스타일을 다시 입혀야 하고, 서식 창·달력은 메뉴가 아니다 |
| 위치·닫기·메뉴 모양을 세 모듈로 직접 구현 (채택)                 | 메뉴가 아닌 팝오버(서식 창·달력)도 앞의 두 모듈을 사용한다 | 키보드 탐색 같은 기능을 직접 구현해야 한다                    |

다섯 곳 가운데 두 곳(서식 창, 달력)은 메뉴가 아니라 팝오버다. 메뉴는 "항목 목록에서 하나를 골라 실행"하는 요소이고, 팝오버는 버튼 옆에 열리는 작은 패널로 안에 무엇이든 들어간다. 서식 창에는 글꼴 버튼과 색 선택이, 달력에는 날짜 칸이 들어 있다. 이 둘도 위치 보정과 닫기는 똑같이 필요하다. 메뉴 라이브러리 하나로는 이 둘을 처리하지 못하므로, 기능을 세 모듈로 분리해 필요한 것만 사용하게 했다.

## 세 모듈로 분리

![메뉴·팝오버 다섯 벌이 쓰는 공통 부품](./images/shared-menu-structure.svg '자리 잡기와 닫기는 메뉴가 아닌 작은 창도 쓴다. 메뉴 모양은 Menu 하나로')

### placement.ts: 위치 계산

순수 함수 세 개다. 순수 함수는 같은 입력에 항상 같은 값을 반환하고 바깥 상태(DOM, 전역 변수)를 읽거나 바꾸지 않는 함수다. 팝오버 크기와 기준 위치를 받아 `left`·`top`을 반환한다. DOM에 접근하지 않으므로 단위 시험으로 모든 경계 조건을 검사할 수 있다.

```ts
placeAtPoint(point, size); // 우클릭한 위치에 왼쪽 위를 맞춘다. 넘치면 안으로
placeBelow(rect, size, { align, gap }); // 버튼 아래 (왼쪽 맞춤 또는 가운데)
placeRight(rect, size); // 버튼 오른쪽 (표 핸들 메뉴)
```

계산의 핵심은 `clamp(값, 최솟값, 최댓값)`이다. 값이 범위를 벗어나면 가까운 끝값으로 바꾼다. 최솟값은 화면 가장자리 여백 `EDGE`(8px)이고, 최댓값은 `화면 폭 − 메뉴 폭 − EDGE`다. `placeBelow`는 가로 보정에 더해, 아래에 자리가 없고 위에 자리가 있으면 버튼 위로 연다.

![1440×900 화면 오른쪽 아래에서 우클릭한 메뉴가 (1212, 712)로 옮겨지는 계산과, 휴대폰 아래 버튼의 메뉴가 위로 열리는 계산](./images/shared-menu-clamp.svg '① 우클릭 위치 (1350, 820)은 220×180 메뉴가 넘치는 자리라 (1212, 712)로 당겨진다. ② 아래로 열면 1018까지 내려가 화면(844)을 넘으므로 버튼 위 574에 연다')

### useDismiss: 닫기

바깥을 클릭하거나 Esc를 누르면 닫는다. "안쪽"으로 취급할 요소들을 인수로 받는다.

```ts
useDismiss(open, () => setOpen(false), [panelRef, buttonRef], { keepOpenInside: '.ProseMirror table' });
```

위 예에서 `panelRef`(서식 창 자체)와 `buttonRef`(서식 창을 여는 버튼)를 누르면 닫히지 않고, 그 밖을 누르면 닫힌다. `keepOpenInside`는 CSS 선택자로 추가 예외를 지정한다. 표 핸들 메뉴는 표 안을 누를 때 닫히지 않아야 해서 `.ProseMirror table`을 넘긴다.

마우스 버튼 한 번을 누르고 떼면 브라우저는 `pointerdown` → `pointerup` → `click` 순서로 이벤트를 발생시킨다. `useDismiss`는 누르는 순간인 [`pointerdown`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event)에서 바깥 클릭을 판별하고, 여는 버튼은 보통 `click`에서 열림 상태를 바꾼다. 이 시각 차이 때문에 여는 버튼을 어느 쪽으로 취급할지가 중요하다.

> [!WARNING] 여는 버튼을 안쪽 목록에서 빠뜨린 경우
> 여는 버튼을 안쪽 목록에 포함하는 것이 중요하다. 포함하지 않으면 열린 메뉴의 버튼을 다시 클릭했을 때 다음 순서로 처리된다.
>
> 1. `pointerdown`이 "바깥 클릭"으로 판단해 메뉴를 닫는다
> 2. 이어지는 `click`이 열림 상태를 반전해 다시 연다
>
> 결과적으로 닫히지 않는 메뉴가 된다.

![여는 버튼이 바깥일 때와 안쪽일 때 다시 누르기의 차이](./images/shared-menu-reopen.svg 'pointerdown과 click의 순서')

기존 코드는 여는 버튼마다 `onPointerDown`에서 [`stopPropagation`](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)을 각각 호출해 이를 막고 있었다. `stopPropagation`은 이벤트가 부모 요소로 전파되는 것을 중단하는 메서드로, `document`에 등록한 바깥 클릭 리스너까지 이벤트가 도달하지 않게 한다. 버튼마다 이 호출을 빠뜨리지 않아야 하는 방식이다. 공통 메뉴는 여는 버튼을 `trigger`로 받아 안쪽으로 취급한다. Apple 메뉴부터 이 방식으로 바꿨다.

리스너는 열릴 때 한 번만 등록한다. 전달받는 `onDismiss`와 `inside` 배열은 렌더링마다 새로 생성된다. React의 `useEffect`는 의존성 배열의 값이 이전 렌더링과 다르면(`Object.is` 비교) effect를 정리하고 다시 실행한다. 새로 생성된 함수는 내용이 같아도 이전 함수와 다른 객체이므로, 이를 의존성에 넣으면 ==렌더링마다 리스너를 해제하고 다시 등록==한다. 그래서 최신 값만 [ref](https://react.dev/reference/react/useRef)에 저장하고 리스너 안에서 읽는다.

```ts
// apps/react/src/shared/ui/popover/useDismiss.ts
const latest = useRef({ onDismiss, inside, keepOpenInside });
useEffect(() => {
	latest.current = { onDismiss, inside, keepOpenInside }; // 매 렌더링 후 최신 값으로 갱신
});

useEffect(() => {
	if (!open) return;
	// … pointerdown·keydown 리스너는 latest.current를 읽는다
}, [open]); // 열림 상태가 바뀔 때만 등록·해제
```

![의존성에 함수를 넣으면 렌더링마다 리스너를 다시 등록하고, ref에 저장하면 한 번만 등록하는 비교](./images/shared-menu-listener.svg '메뉴가 열린 동안 렌더링이 네 번 일어나면, 함수를 의존성에 넣은 쪽은 등록·해제를 네 번 반복하고 ref 방식은 한 번만 등록한다')

### Menu: macOS 메뉴

항목 종류는 네 가지다.

```ts
type MenuItem =
	| { label; icon?; onSelect; disabled?; hint?; checked?; destructive? } // 실행 항목
	| { heading: string } // 그룹 제목 (정렬 기준, 순서)
	| { note: string } // 안내 한 줄 ("○○(으)로 로그인됨")
	| 'separator';
```

예를 들어 현재 메모의 정렬 메뉴(`sortMenuItems.ts`)는 `{ heading: '정렬 기준' }` 아래에 '날짜'·'제목' 항목, `'separator'`, `{ heading: '순서' }` 아래에 순서 항목 두 개, 다시 `'separator'`와 '날짜별로 그룹화' 항목으로 구성된다. 선택된 항목에는 `checked: true`가, 날짜로 정렬하지 않을 때의 그룹화 항목에는 `disabled`와 `hint`가 지정된다. 아이콘이나 체크 표시가 하나라도 있으면 모든 항목에 아이콘 영역을 확보해 텍스트 정렬을 맞춘다.

새로 ↑·↓·Home·End로 항목 간 포커스를 이동할 수 있게 했다([WAI-ARIA 메뉴 버튼 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) 참고). WAI-ARIA 작성 지침(APG)은 W3C가 메뉴·다이얼로그 같은 위젯마다 키보드 동작과 역할을 정리한 문서이고, 메뉴에서는 화살표 키로 항목 사이를 이동하도록 안내한다. 기존 다섯 곳 어디에도 없던 기능이다.

## 전환 중 발생한 문제

### 메시지 메뉴를 창 밖으로 이동

메시지의 컨텍스트 메뉴만 창 안에 `position: absolute`로 렌더링되어 있었다. 대화 영역 기준 좌표를 쓰고 위치 보정도 없어서, 창의 오른쪽·아래 끝에서 우클릭하면 메뉴가 대화 영역 밖으로 넘칠 수 있었다. 공통 메뉴는 body에 렌더링하고 뷰포트(브라우저 창에서 페이지가 보이는 영역) 좌표를 사용하므로 그 계산을 삭제했다.

```ts
// 전: 대화 영역 기준
const box = event.currentTarget.closest('.messages-chat').getBoundingClientRect();
setMenu({ x: event.clientX - box.left, y: event.clientY - box.top });
// 후: 뷰포트 좌표 그대로
setMenu({ x: event.clientX, y: event.clientY });
```

`event.clientX`는 뷰포트 왼쪽 위를 원점으로 한 마우스 좌표다. 이전 코드는 여기서 대화 영역의 위치(`box.left`)를 빼서 대화 영역 기준 좌표로 바꿨다. 메뉴가 body로 이동하면서 이 변환이 필요 없어졌다.

E2E도 수정했다. 메시지와 팝업 시험이 메뉴를 메시지 창 안에서 찾고 있어서, 처음 실행했을 때 두 개가 실패했다. 페이지 전체에서 찾도록 바꿨다.

### 첫 항목 자동 포커스 여부

메시지 메뉴는 열자마자 첫 항목에 포커스를 주었다. 키보드로 바로 선택할 수 있는 장점이 있다. 하지만 메모의 메뉴들은 그렇지 않았다. 공통 메뉴가 이를 기본 동작으로 하면, 메모 메뉴를 열 때마다 포커스가 이동하고, 메뉴를 닫은 뒤에는 포커스가 원래 위치(검색 칸 등)로 돌아오지 않는다. 예를 들어 메모 검색 칸에 글자를 입력하다 정렬 메뉴를 열고 닫으면, 다시 검색 칸을 클릭해야 입력을 이어 갈 수 있다.

이번 단계에서는 ==모양과 동작을 바꾸지 않고 코드만 통합==하기로 했다. 그래서 `autoFocus`는 기본값을 끄고, 원래 그렇게 동작하던 메시지 메뉴에서만 켰다. ↑·↓ 이동은 메뉴 안에 포커스가 있을 때만 동작하므로 모든 메뉴에서 활성화했다.

### 전후 스크린샷 비교

1단계에서 만든 스크린샷 40장 비교를 다시 실행했다. 같은 장면을 전과 후에 캡처하고, 두 이미지에서 색이 다른 픽셀의 비율을 계산하는 방식이다. 바뀐 것은 메뉴 네 개뿐이었다.

- **Apple 메뉴 (0.4%)**: 모서리 10px → 12px, 항목 여백이 메모 메뉴와 같아졌다. 같은 macOS 메뉴인데 두 가지 모양이던 것이 하나로 통일됐다

![Apple 메뉴](./images/shared-menu-apple.jpg '전: 혼자 다른 모서리와 여백. 후: 메모의 메뉴와 같은 모양')

- **메모 정렬·•••·폴더 선택 메뉴 (0.2~0.4%)**: 행 간격이 1~2px 좁아졌다
  - 원인을 조사하니 기존 메모 메뉴의 항목(`<button>`)이 메뉴의 글꼴을 상속하지 않고 있었다
  - 메뉴는 body에 렌더링되므로 앱의 `.memo button { font: inherit }`이 적용되지 않는다. 항목 규칙에도 `font-size`만 있고 `font-family`가 없었다
  - 브라우저는 `<button>`에 부모 글꼴 대신 자체 기본 글꼴을 지정하므로, 브라우저 기본 버튼 글꼴로 렌더링되어 행 높이가 약간 달랐다
  - 공통 메뉴는 항목이 `font: inherit`로 메뉴의 글꼴을 상속한다

![메모 정렬 메뉴](./images/shared-menu-sort.jpg '전: 브라우저 기본 버튼 글꼴. 후: 메뉴의 글꼴 (줄 간격이 조금 좁아졌다)')

메모 컨텍스트 메뉴처럼 그룹 제목이 없는 메뉴는 0%였다. 서식 창, 달력, 표 핸들 메뉴도 0%였다. 팝오버 내용은 그대로 두고 닫기와 위치 계산만 바꿨기 때문이다.

## 확인과 숫자

- `apps/react/src/shared/ui/popover/placement.test.ts`의 시험 네 개: "한 점에 맞추고, 넘치면 화면 안쪽으로 당긴다", "기준 아래: 왼쪽 맞춤과 가운데 맞춤, 가로로만 당긴다", "기준 아래: 아래로 넘치고 위에 자리가 있으면 기준 위에 둔다", "기준 오른쪽: 위를 맞추고, 오른쪽으로 넘치면 안쪽으로". 위치 계산이 순수 함수라 브라우저 없이 모든 경계 조건을 검사한다.
- 스크린샷 40장 비교에서 바뀐 것은 위의 메뉴 네 개뿐이었다.
- PR 전체로는 31개 파일, 568줄 추가와 446줄 삭제였다.

## 남은 것

- 메모 메뉴는 호버 색이 파란색(전역 강조색)이다. 메모 앱의 노란색이 아니다. 메뉴는 body에 렌더링되므로 앱 창에 정의한 색 변수(`--memo-*`)가 적용되지 않는다. 앱마다 메뉴 색을 다르게 하려면 메뉴 렌더링 위치에도 그 앱의 색 변수를 지정해야 한다. 글을 쓴 시각에는 버튼을 공통 컴포넌트로 전환하는 다음 단계에서 결정하기로 했다
- 서식 창의 서식 버튼, 달력의 날짜 셀은 그대로다. 다음 단계에서 버튼을 정리할 때 함께 전환한다

## 이후 변경과 배운 것

- `Menu`는 이 사이트에서 가장 많이 사용되는 공통 컴포넌트가 됐다. 이 글을 쓴 시각에 28개 파일이 사용했다. 휴대폰에서 iOS처럼 크게 표시되는 모양은 이후 `variant="ios"`로 선택하게 했다([variant prop과 별도 컴포넌트 중 macOS·iOS 모양 분기 방식 고르기](/memo/ui-variant-pairs)).
- 메뉴의 호버 색은 현재도 전역 강조색(`--color-accent`)이다. macOS도 앱과 관계없이 시스템 강조색으로 메뉴를 표시하므로 유지했다.
- 같은 코드가 네 번 복사되면 다섯 번째는 조금씩 달라진다. 이번에는 메시지만 `window`에 리스너를 등록했고, 위치 보정은 다섯 곳이 모두 달랐다.
- `pointerdown`과 `click`은 다른 시각에 발생한다. 둘을 함께 쓰는 "바깥 클릭 시 닫기"는 여는 버튼을 안쪽과 바깥 중 어디로 취급할지 먼저 결정해야 한다.
- 렌더링마다 새로 생성되는 함수·배열을 리스너 effect의 의존성에 넣지 않는다. 최신 값은 ref에 저장하고 리스너는 한 번만 등록한다. 이 방식은 이후 `Sheet`에서도 그대로 사용했다([오버레이·닫기·role을 공통 Sheet 컴포넌트로 추출하고 모양은 variant로 나누기](/memo/ui-sheet)).

## 관련 글

- [CSS @layer로 명시도와 무관하게 앱 기본값의 우선순위 낮추기](/memo/css-layer-reset)
- [계산된 스타일 비교로 !important를 일괄 삭제하고 IconButton·Button 공통 버튼 추출하기](/memo/shared-button)
- [앱이 등록한 메뉴를 공통 메뉴와 병합하는 메뉴 막대 구조](/memo/menubar-menus)
- [variant prop과 별도 컴포넌트 중 macOS·iOS 모양 분기 방식 고르기](/memo/ui-variant-pairs)

<details>
<summary>참고 문헌</summary>

- [React: createPortal](https://react.dev/reference/react-dom/createPortal)
- [React: useEffect](https://react.dev/reference/react/useEffect)
- [React: useRef](https://react.dev/reference/react/useRef)
- [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
- [MDN: Event.stopPropagation()](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopPropagation)
- [MDN: MouseEvent.clientX](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/clientX)
- [W3C WAI-ARIA APG: Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
- [Floating UI](https://floating-ui.com/)

</details>

#MacFolio #공통컴포넌트
