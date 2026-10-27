---
title: 모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출
date: 2026-10-11
category: 개발 기록/MacFolio/프론트엔드/디자인 시스템
summary: 가운데 뜨는 다이얼로그 5개가 오버레이·포커스·Esc·닫기 애니메이션을 각자 구현하고 있었다. 77줄짜리 Modal로 추출해 다섯 곳에는 콘텐츠만 남겼고, 덮는 범위는 scope로, 색·z-index는 CSS 변수로 지정한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 둘째 항목 "새로 뽑을 것"의 첫 컴포넌트다. [공통 UI 부품 목록 글](/memo/ui-inventory)에서 추출하기로 한 셋(`Modal`·`Sheet`·`SearchField`) 중 새로 작성할 코드가 가장 적은 `Modal`부터 진행했다.

## 다섯 다이얼로그가 같은 동작을 각자 구현

화면 가운데에 뜨는 모달 다이얼로그는 다섯 개였다. 앱 안 경고창(`AlertDialog`), 배경화면 이름 바꾸기, 도움말의 키보드 단축키, 로그인 후 결과, Dock의 Launchpad. 다섯 모두 다음 동작이 같다.

1. 반투명 오버레이를 깔고 그 위에 패널을 가운데 정렬한다
2. 패널에 `role="dialog"`(또는 `alertdialog`)·`aria-modal`·`aria-label`을 붙인다
3. 열릴 때 특정 요소(확인 버튼, 입력 칸)로 포커스를 옮긴다
4. Esc 키나 오버레이 클릭으로 닫는다
5. 닫힐 때 오버레이는 `fade-out`, 패널은 `pop-out` 애니메이션을 재생한 뒤 DOM에서 제거한다

이 동작이 다섯 파일에 각각 구현되어 있었다.

| 중복 코드                                                     | 곳  |
| ------------------------------------------------------------- | --- |
| `window.addEventListener('keydown', …)`로 Esc 처리            | 4   |
| `event.target === event.currentTarget`으로 오버레이 클릭 판별 | 4   |
| `useExitMotion('fade-out')` 호출                              | 5   |

구현마다 차이도 있었다.

| 다이얼로그  | 다른 점                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------- |
| Launchpad   | Esc를 처리하지 않고, 열린 시각에 포커스도 옮기지 않았다                                   |
| 로그인 결과 | Enter 키를 별도로 처리했다. 확인 버튼에 포커스가 있으므로 버튼의 기본 동작만으로 충분하다 |
| 이름 바꾸기 | Esc를 `form`의 `onKeyDown`에서만 수신해, 포커스가 폼 밖에 있으면 닫히지 않았다            |

같은 동작을 다섯 곳에 구현하면 수정도 다섯 곳에서 해야 하고, 하나를 빠뜨리면 위 표처럼 다이얼로그마다 동작이 달라진다. 방문자에게는 "어떤 창은 Esc로 닫히고 어떤 창은 닫히지 않는" 사이트가 된다.

![공통 동작은 Modal 컴포넌트에, 콘텐츠는 다이얼로그마다](./images/ui-modal-layers.svg '변경 전에는 다섯 다이얼로그가 공통 동작을 각자 구현했고, 변경 후에는 Modal이 공통 동작을 맡고 다이얼로그는 콘텐츠만 렌더링한다')

처음 PR 제목은 "가운데 뜨는 창 다섯의 겉을 shared/ui의 Modal 하나로"였다. "겉"이라는 말로는 무엇을 추출하는지 알 수 없어서, 오버레이·포커스·Esc·닫기 애니메이션처럼 정확한 용어로 PR과 이 글을 다시 작성했다.

## 검토한 방법

| 방법                                | 장점                                            | 단점                                                                  |
| ----------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| HTML `<dialog>`와 `showModal()`     | 포커스 가두기·Esc·최상위 층을 브라우저가 맡는다 | 최상위 층(top layer)에 올라가 앱 창 안만 덮는 `window` 범위가 안 된다 |
| 다이얼로그 라이브러리               | 포커스 가두기까지 제공한다                      | 다섯 곳을 위해 의존성을 추가하고, 기존 패널 스타일을 덮어써야 한다    |
| 각자 구현을 두고 빠진 동작만 채운다 | 변경 범위가 작다                                | 다음 다이얼로그에서 같은 차이가 또 생긴다                             |
| 공통 동작만 담은 `Modal`            | 77줄, 스타일은 호출하는 쪽에 그대로 유지        | 포커스 가두기(Tab 순환)는 아직 없다                                   |

[`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)를 가장 먼저 검토했다. 하지만 앱 안 경고창은 macOS처럼 그 앱 창만 어둡게 덮어야 하고, 다른 창은 계속 사용할 수 있어야 한다. [`showModal()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal)은 다이얼로그를 화면 전체의 최상위 층[^1]에 올리고 나머지 문서를 모두 비활성(inert)으로 만들어서 이 동작과 맞지 않았다.

## Modal 컴포넌트의 책임

```tsx
<Modal
	label="키보드 단축키"
	scope="screen"
	onClose={onClose}
	initialFocus={closeButton}
	overlayClassName="keyboard-shortcuts-overlay"
	className="keyboard-shortcuts"
>
	…콘텐츠…
</Modal>
```

- **오버레이와 패널 렌더링**: 패널에 `role`(`dialog`, 응답이 필요한 다이얼로그는 `alertdialog`)·[`aria-modal="true"`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-modal)·`aria-label`을 붙인다
- **scope**: `window`는 오버레이가 `position: absolute`로 가장 가까운 positioned 조상(앱 창)[^2]을 덮고, `screen`은 `position: fixed`로 화면 전체를 덮으며 [`createPortal`](https://react.dev/reference/react-dom/createPortal)로 `document.body`에 렌더링한다. 경고창·이름 바꾸기는 `window`, 나머지 셋은 `screen`
- **닫기**: `window`의 `keydown`에서 Esc(포커스 위치와 무관), 오버레이 자체의 `pointerdown`(패널 내부 클릭은 제외)
- **포커스**: `initialFocus` ref가 가리키는 요소로, 없으면 `tabIndex={-1}`인 패널 자신으로. Launchpad도 이제 Esc로 닫힌다

닫기와 포커스 처리는 다음 몇 줄이 전부다(`apps/react/src/shared/ui/dialog/Modal.tsx`).

```tsx
useEffect(() => {
	(initialFocus?.current ?? box.current)?.focus();
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		onClose();
	};
	window.addEventListener('keydown', onKeyDown);
	return () => window.removeEventListener('keydown', onKeyDown);
}, [onClose]);

// 오버레이: 패널 안을 누른 것은 무시하고, 오버레이 자체를 누를 때만 닫는다
onPointerDown={(event) => {
	if (event.target === event.currentTarget) onClose();
}}
```

[`pointerdown`](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event)은 누르는 순간의 대상을 기준으로 한다. 그래서 패널 안에서 글자를 드래그해 선택하다 오버레이 위에서 버튼을 놓아도 창이 닫히지 않는다. `click`은 누른 곳과 놓은 곳의 공통 조상에서 발생하므로, `click`을 썼다면 이 경우를 별도로 필터링해야 한다.

`window` 범위가 필요해진 계기는 메모의 휴지통이다. 휴지통에 "즉시 삭제" 버튼을 추가하면서, 누르면 바로 삭제하지 않고 macOS 메모처럼 확인창을 표시하게 했다. 이 확인창은 화면 전체가 아니라 메모 앱 창의 가운데에 표시해야 했다. 다른 창은 계속 사용할 수 있어야 하기 때문이다. 현재 이 확인창은 `useTrash.tsx`가 `AlertDialog`로 표시하고, `AlertDialog`는 `scope="window"`인 `Modal`이다.

![macOS 메모의 영구 삭제 확인창](./images/ui-modal-macos-delete-confirm.jpg '참고한 macOS 메모 화면. "1개의 메모를 영구적으로 삭제하겠습니까?" 확인창이 메모 창 가운데에 뜬다')

![scope window는 앱 창만, screen은 화면 전체를 덮는 모습](./images/ui-modal-scope.svg 'scope가 정하는 덮개 범위')

- **종료 애니메이션**: 오버레이 `fade-out`, 패널 `pop-out`. `motion.css`에서 다섯 다이얼로그의 클래스를 나열하던 선택자가 `[data-exiting] .ui-modal` 하나로 바뀌었다

시각 스타일은 Modal이 정하지 않는다. 오버레이 색과 `z-index`는 호출하는 쪽 CSS가 `--ui-modal-dim`·`--ui-modal-z` [변수](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)로 지정한다.

| 다이얼로그                                                                                                                                                                                                                              | `--ui-modal-dim`                      | `--ui-modal-z` |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------- |
| 앱 안 경고창                                                                                                                                                                                                                            | `rgba(0,0,0,.12)`                     | 1000           |
| 단축키                                                                                                                                                                                                                                  | `--color-overlay`                     | 3000           |
| 로그인 결과                                                                                                                                                                                                                             | 오버레이 색과 `backdrop-filter: blur` | 20000          |
| 패널의 너비·모서리·여백은 기존 클래스(`.ui-alert`, `.keyboard-shortcuts`, `.launchpad-content`)가 그대로 담당한다. 따라서 다섯 CSS에서 제거한 것은 오버레이의 `position`·`inset`·`display`·`animation`과 패널의 `animation` 선언뿐이다. |

## 대상에서 제외한 것

**이 Mac에 관하여**는 가운데에 표시되지만 오버레이가 없고, 빈 영역을 드래그해 이동할 수 있으며, 뒤의 다른 창을 클릭할 수 있다. 모달이 아니라 일반 창이다. `role="dialog"`만 같아서 후보에 포함했다가 코드를 확인하고 제외했다. 포함하려면 "오버레이 없음"·"드래그 이동" 옵션이 필요해진다.

**이름 바꾸기의 form**: Modal의 패널은 `div`이므로 `form`이 그 안에 들어간다. 그러자 패널의 `display: grid; gap`이 `form` 하나에만 적용되어 입력 칸과 버튼 사이 간격이 사라졌다. `form`에 같은 grid를 지정해 해결했다. Modal에 `as="form"` prop을 두는 방법도 있지만 호출처가 하나라 추가하지 않았다.

## 확인

- 변경된 다섯 다이얼로그가 포함된 E2E(경고창·휴지통·배경화면·메뉴 막대·로그인·Launchpad·애니메이션)를 실행했다
- 동작이 바뀐 곳은 두 곳이다. 포커스가 다이얼로그 밖에 있어도 Esc로 닫히는 것(이름 바꾸기), Launchpad가 Esc로 닫히는 것. 둘 다 macOS 동작과 같아지는 방향이라 유지했다
- 변경은 16파일, 368줄 추가와 230줄 삭제였다. 새 `Modal.tsx`(77줄)·`Modal.css`(32줄)를 제외하면 다섯 다이얼로그의 코드는 모두 줄었다. 가장 많이 준 곳은 `KeyboardShortcuts.tsx`(90줄 변경)와 `Dock.tsx`의 Launchpad(62줄 변경)다.

## 남은 것·배운 것

- 포커스 가두기(Tab을 눌러도 패널 밖으로 나가지 않게)는 아직 없다. 다섯 곳 모두 원래 없던 기능이라 이번에 추가하지 않았다. WAI-ARIA 작성 지침의 [모달 다이얼로그 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)은 포커스 가두기를 요구하므로 남은 과제다.
- 위 `useEffect`는 `onClose`가 바뀔 때마다 다시 실행된다. 호출하는 쪽이 렌더링마다 새 함수를 넘기면 포커스를 다시 옮긴다. 다음에 만든 [`Sheet`](/memo/ui-sheet)는 이 문제를 겪고 최신 `onClose`를 ref에 보관하는 방식으로 해결했다. `Modal`도 같은 방식으로 수정할 후보다.
- 공통 부품으로 추출할 때는 "같은 것"보다 "다른 것"을 먼저 찾는다. 다섯 구현의 차이(Esc를 안 받는 곳, Enter를 따로 받는 곳)가 곧 버그 목록이었다.
- 스타일은 부품이 정하지 않고 CSS 변수로 노출했다. 그래서 다섯 다이얼로그의 화면은 바뀌지 않았다.

다음은 `Sheet`(휴대폰에서 화면 아래에서 올라오는 시트)다.

## 관련 글

- [공통 부품 목록을 먼저 작성하고, 후보 아홉 개를 다시 집계했다](/memo/ui-inventory): 추출할 부품을 결정한 목록
- [휴대폰 시트 3곳의 공통 동작을 Sheet 컴포넌트로 추출](/memo/ui-sheet): 다음 부품
- [남은 시트와 창을 찾아 보니 — Modal로 옮긴 것은 하나](/memo/sheet-modal-migrate): 앱마다 직접 만든 모달을 옮긴 일
- [z-index 숫자에 이름 붙이기 — 화면 전체의 겹침 순서를 한 표로](/memo/z-index-layers): `--ui-modal-z`를 이름으로 정리한 일
- PR: [#212](https://github.com/hyeoniverse/MacFolio/pull/212)

[^1]: 최상위 층(top layer)은 문서의 z-index와 무관하게 모든 요소 위에 그려지는 별도 층이다. [MDN: Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)

[^2]: `position`이 `static`이 아닌 요소. `absolute` 요소는 이 조상을 기준으로 배치된다. [MDN: position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)

#MacFolio #공통컴포넌트 #리팩터링
