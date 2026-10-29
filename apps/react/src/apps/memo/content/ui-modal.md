---
title: 공통 UI 컴포넌트 5 - 모달 다이얼로그의 공통 동작을 Modal 컴포넌트로 추출하고 교체 대상 다시 조사하기
date: 2026-10-11
category: 개발 기록/MacFolio/디자인 시스템
summary: 다이얼로그 5개가 오버레이·포커스·Esc·닫기 애니메이션을 각자 구현하고 있었다. 77줄 Modal로 추출하고 덮는 범위는 scope, 색·z-index는 CSS 변수로 지정한다. 일주일 뒤 남은 시트·모달을 다시 조사해 메모 이미지 크게 보기 하나만 옮기고, Esc 처리나 구조가 다른 나머지는 유지했다.
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

| 다이얼로그   | `--ui-modal-dim`                      | `--ui-modal-z` |
| ------------ | ------------------------------------- | -------------- |
| 앱 안 경고창 | `rgba(0,0,0,.12)`                     | 1000           |
| 단축키       | `--color-overlay`                     | 3000           |
| 로그인 결과  | 오버레이 색과 `backdrop-filter: blur` | 20000          |

패널의 너비·모서리·여백은 기존 클래스(`.ui-alert`, `.keyboard-shortcuts`, `.launchpad-content`)가 그대로 담당한다. 따라서 다섯 CSS에서 제거한 것은 오버레이의 `position`·`inset`·`display`·`animation`과 패널의 `animation` 선언뿐이다.

## 대상에서 제외한 것

**이 Mac에 관하여**는 가운데에 표시되지만 오버레이가 없고, 빈 영역을 드래그해 이동할 수 있으며, 뒤의 다른 창을 클릭할 수 있다. 모달이 아니라 일반 창이다. `role="dialog"`만 같아서 후보에 포함했다가 코드를 확인하고 제외했다. 포함하려면 "오버레이 없음"·"드래그 이동" 옵션이 필요해진다.

**이름 바꾸기의 form**: Modal의 패널은 `div`이므로 `form`이 그 안에 들어간다. 그러자 패널의 `display: grid; gap`이 `form` 하나에만 적용되어 입력 칸과 버튼 사이 간격이 사라졌다. `form`에 같은 grid를 지정해 해결했다. Modal에 `as="form"` prop을 두는 방법도 있지만 호출처가 하나라 추가하지 않았다.

## 추가 교체: 메모 이미지 크게 보기

일주일 뒤(10월 18일) 리팩터링 계획 4단계의 마지막 항목 "앱마다 따로 만든 버튼·시트·목록을 공통 컴포넌트로 바꾸기"를 진행하면서([#247](https://github.com/hyeoniverse/MacFolio/pull/247)), 앱마다 남은 시트와 모달을 다시 조사했다. `apps/react/src/apps`에서 `aria-modal`, `role="dialog"`, 바깥 클릭 시 닫히는 오버레이, `key === 'Escape'` 처리를 검색했다. 메일의 시트와 음악의 지금 재생 중 화면은 이미 `Sheet`를, 단축키 창·로그인 결과·Launchpad는 이미 `Modal`을 사용한다. 그 밖에 검색된 것은 다음과 같다.

| 위치                             | 특징                                       | 결정           |
| -------------------------------- | ------------------------------------------ | -------------- |
| 메모 이미지 크게 보기            | 화면 전체 오버레이, Esc·바깥 클릭으로 닫힘 | `Modal`로 교체 |
| 설정 프로젝트 그림 크게 보기     | 오버레이, ←·→ 이동, Esc 전파 차단          | 유지           |
| 설정 프로젝트 시트               | 데스크톱 창 안의 시트, 배경 `inert`        | 유지           |
| 사진 크게 보기 (데스크톱·휴대폰) | 오버레이 없는 전체 화면 보기               | 유지           |
| 메모 버전 기록·서식·표 패널      | 팝오버                                     | 대상 아님      |
| Safari 데모 페이지의 창          | 다른 사이트를 재현하는 데모                | 대상 아님      |

계획 작성 시각에는 메일·메시지·음악·설정·휴지통이 각자 시트와 모달을 구현했다고 기록했다. 그 가운데 메일과 음악, 설정의 창들은 `Sheet`·`Modal`을 추출하면서 이미 교체했고, 메시지와 휴지통에는 별도 구현이 남아 있지 않았다. 교체 대상은 하나였다.

메모 본문 이미지를 클릭하면 화면 전체에 어두운 오버레이를 표시하고 가운데에 이미지를 크게 표시한다. 오버레이가 `role="dialog"`였고, 포털·Esc 처리·닫힐 때의 페이드아웃을 직접 구현했다. `Modal`의 `scope="screen"`과 동작이 같다.

![교체 후 메모의 이미지 크게 보기](./images/sheet-modal-migrate-lightbox.jpg 'Modal scope="screen"으로 연 이미지 크게 보기. 화면 전체를 rgba(0, 0, 0, 0.75) 오버레이가 덮고 가운데에 이미지를 표시한다')

```tsx
// 전 (apps/react/src/apps/memo/components/MarkdownImage.tsx)
return createPortal(
	<div
		ref={lightbox}
		className="memo-lightbox"
		role="dialog"
		aria-modal="true"
		aria-label={alt || '이미지'}
		onClick={onClose}
	>
		<img src={src} alt={alt} />
	</div>,
	document.body
);

// 후
return (
	<Modal
		label={alt || '이미지'}
		onClose={onClose}
		scope="screen"
		overlayClassName="memo-lightbox"
		className="memo-lightbox-box"
	>
		<img src={src} alt={alt} onClick={onClose} />
	</Modal>
);
```

교체하면서 맞춘 것은 세 가지다.

| 항목                 | 기존 동작                                      | 교체 후 처리                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 오버레이 색과 레이어 | 앱 CSS에 직접 지정                             | `--ui-modal-dim`을 `rgba(0, 0, 0, 0.75)`로, `--ui-modal-z`를 메뉴와 같은 레이어로 지정. 안쪽 여백과 `zoom-out` 커서는 오버레이에 유지                                                                            |
| 이미지 클릭 시 닫힘  | 오버레이 전체가 클릭을 받아 이미지 클릭도 닫힘 | `Modal`은 오버레이만 클릭을 받으므로, 상자는 오버레이 안쪽을 채우되 [`pointer-events: none`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events)으로 두고 이미지에서 닫기 호출 |
| 포커스               | 포커스를 옮기지 않아 연 버튼에 유지            | `Modal`이 열리는 시각에 상자로 포커스를 옮기므로, 닫히면 연 버튼으로 복원                                                                                                                                        |

![전에는 덮개 하나가 모든 누름을 받았고, 후에는 덮개가 바깥 누름을, 이미지가 자기 누름을 받는다](./images/sheet-modal-migrate-hit.svg '옮기기 전과 뒤에 누름을 받는 곳')

포커스 복원은 effect 하나로 처리했다. 열리는 시각의 포커스 요소(연 버튼)를 저장해 두었다가 cleanup에서 복원한다.

```ts
useEffect(() => {
	const opener = document.activeElement as HTMLElement | null;
	return () => opener?.focus({ preventScroll: true });
}, []);
```

달라진 것은 닫힘 애니메이션 하나다. 전체가 함께 페이드아웃되던 것이, 다른 모달과 같이 오버레이는 `fade-out`, 이미지는 `pop-out`으로 사라진다. 이로써 `Modal`을 사용하는 다이얼로그는 여섯 개가 됐다(경고창, 이름 변경, 단축키, 로그인 결과, Launchpad, 메모 이미지 크게 보기).

## 교체하지 않은 시트·모달과 이유

설정 프로젝트의 그림 크게 보기는 외형만 보면 같다. 그러나 Esc를 자기 요소에서 받아 [이벤트 전파](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Events)를 차단한다. 뒤에 프로젝트 시트가 열려 있고, 그 시트도 Esc로 닫히기 때문이다. `Modal`의 Esc는 `window`에서 받으므로 교체하면 Esc 한 번에 둘이 함께 닫힌다. ←·→ 버튼과 닫기 버튼도 그림 상자 바깥에 있어 DOM 구조를 바꿔야 한다.

![그림 보기가 Esc를 자기 요소에서 받을 때와 Modal처럼 window에서 받을 때의 차이](./images/sheet-modal-migrate-escape.svg 'Esc를 어디서 받느냐가 갈랐다')

설정의 프로젝트 시트는 데스크톱 창 안에서 열리는 시트다. 배경을 [`inert`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)로 비활성화하고 포커스를 시트 안에 가둔다. 휴대폰 전용인 `Sheet`와 의미가 다르다. 사진의 크게 보기는 오버레이가 없는 전체 화면이고 Esc나 바깥 클릭으로 닫지 않는다. 대화상자라기보다 화면 전환이다.

세 곳을 통합하는 방법도 검토했다.

| 방법                                          | 결과                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `Modal`에 `escapeScope="self"` 같은 옵션 추가 | 한 곳을 위한 옵션이 공통 컴포넌트에 생긴다                                   |
| 설정 그림 보기의 구조를 바꿔 맞추기           | 상자 밖의 ←·→·닫기 버튼 배치를 다시 구현해야 하고, 화면이 바뀐다             |
| 유지하고 이유를 `docs/ui.md`에 기록 (채택)    | 공통 컴포넌트는 단순하게 유지되고, 다음 작업자가 같은 검토를 반복하지 않는다 |

원칙은 "화면은 유지하고, 의미가 같은 것만 교체한다"였다.

## 확인

- 변경된 다섯 다이얼로그가 포함된 E2E(경고창·휴지통·배경화면·메뉴 막대·로그인·Launchpad·애니메이션)를 실행했다
- 동작이 바뀐 곳은 두 곳이다. 포커스가 다이얼로그 밖에 있어도 Esc로 닫히는 것(이름 바꾸기), Launchpad가 Esc로 닫히는 것. 둘 다 macOS 동작과 같아지는 방향이라 유지했다
- 다섯 다이얼로그의 변경은 16파일, 368줄 추가와 230줄 삭제였다. 새 `Modal.tsx`(77줄)·`Modal.css`(32줄)를 제외하면 다섯 다이얼로그의 코드는 모두 줄었다. 가장 많이 준 곳은 `KeyboardShortcuts.tsx`(90줄 변경)와 `Dock.tsx`의 Launchpad(62줄 변경)다
- 메모 이미지 크게 보기는 E2E에서 연 상태의 오버레이와 이미지의 계산된 스타일(위치, 레이어, 여백, 배경색, 커서, 크기, 둥근 모서리, 그림자)을 교체 전후에 기록해 비교했다. 값은 모두 같았고, 스크린샷도 픽셀 단위로 같았다. 접근 가능한 이름(이미지 설명)과 `aria-modal`도 같다. 코드 변경은 `MarkdownImage.tsx`(42줄)와 `markdown.css`(21줄)다

## 남은 것·배운 것

- 포커스 가두기(Tab을 눌러도 패널 밖으로 나가지 않게)는 아직 없다. 다섯 곳 모두 원래 없던 기능이라 이번에 추가하지 않았다. WAI-ARIA 작성 지침의 [모달 다이얼로그 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)은 포커스 가두기를 요구하므로 남은 과제다.
- 위 `useEffect`는 `onClose`가 바뀔 때마다 다시 실행된다. 호출하는 쪽이 렌더링마다 새 함수를 넘기면 포커스를 다시 옮긴다. 다음에 만든 [`Sheet`](/memo/ui-sheet)는 이 문제를 겪고 최신 `onClose`를 ref에 보관하는 방식으로 해결했다. `Modal`도 같은 방식으로 수정할 후보다.
- 공통 부품으로 추출할 때는 "같은 것"보다 "다른 것"을 먼저 찾는다. 다섯 구현의 차이(Esc를 안 받는 곳, Enter를 따로 받는 곳)가 곧 버그 목록이었다.
- 외형이 같아도 키 처리(Esc를 어디서 받는가)가 다르면 같은 컴포넌트가 아니다. 공통 컴포넌트로 교체할지 결정할 때는 키보드 동작부터 확인한다.
- 스타일은 부품이 정하지 않고 CSS 변수로 노출했다. 그래서 다섯 다이얼로그와 이미지 크게 보기의 화면은 바뀌지 않았다.
- 계획 문서의 교체 대상 목록은 실행 직전에 다시 집계한다. "앱마다 따로 만든 시트·창"의 대부분은 이미 앞선 PR에서 교체되어 있었다.

## 관련 글

- [공통 UI 컴포넌트 4 - shared/ui 사용처 집계로 추출할 공통 컴포넌트 후보 줄이기](/memo/ui-inventory): 추출할 부품을 결정한 목록
- [공통 UI 컴포넌트 6 - 오버레이·닫기·role을 공통 Sheet 컴포넌트로 추출하고 모양은 variant로 나누기](/memo/ui-sheet): 다음 부품
- [eslint-disable 주석이 가린 useEffect의 onClose 의존성](/memo/modal-focus-eslint-disable): 남은 과제에 적은 `onClose` 의존 문제를 effect 분리로 수정한 일
- [디자인 토큰 1 - 흩어진 z-index 숫자를 theme.css의 --z-* CSS 변수로 모으기](/memo/z-index-layers): `--ui-modal-z`를 이름으로 정리한 일
- [리팩터링 4단계 - 계산된 스타일 비교로 검증한 공통 버튼 컴포넌트 교체](/memo/refactor-step4-components): 이미지 크게 보기 교체가 속한 단계
- PR: [#212](https://github.com/hyeoniverse/MacFolio/pull/212), [#247](https://github.com/hyeoniverse/MacFolio/pull/247)

[^1]: 최상위 층(top layer)은 문서의 z-index와 무관하게 모든 요소 위에 그려지는 별도 층이다. [MDN: Top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer)

[^2]: `position`이 `static`이 아닌 요소. `absolute` 요소는 이 조상을 기준으로 배치된다. [MDN: position](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)

#MacFolio #React #CSS #공통컴포넌트 #리팩터링
