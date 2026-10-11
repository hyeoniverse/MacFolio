---
title: 모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출
date: 2026-10-11
category: 개발기/MacFolio/프론트엔드
summary: 경고창, 배경화면 이름 바꾸기, 키보드 단축키, 로그인 결과, Launchpad가 오버레이·role·포커스 이동·Esc·오버레이 클릭 닫기·종료 애니메이션을 각자 구현하고 있었다. 이 공통 동작을 shared/ui의 Modal 컴포넌트로 추출하고, 다섯 다이얼로그는 콘텐츠와 패널 스타일만 가진다. 오버레이 범위(앱 창/화면 전체)는 scope prop으로, 오버레이 색과 z-index는 CSS 변수로 호출하는 쪽이 정한다. '이 Mac에 관하여'는 오버레이가 없는 드래그 가능한 창이라 대상에서 제외했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 둘째 항목 "새로 뽑을 것"의 첫 컴포넌트. [공통 UI 부품 목록 글](/memo/ui-inventory)에서 추출하기로 한 셋(`Modal`·`Sheet`·`SearchField`) 중 새로 작성할 코드가 가장 적은 `Modal`부터 진행했다.

## 다섯 다이얼로그가 같은 동작을 각자 구현

화면 가운데에 뜨는 모달 다이얼로그는 다섯 개였다. 앱 안 경고창(`AlertDialog`), 배경화면 이름 바꾸기, 도움말의 키보드 단축키, 로그인 후 결과, Dock의 Launchpad. 다섯 모두 다음 동작이 같다.

1. 반투명 오버레이를 깔고 그 위에 패널을 가운데 정렬한다
2. 패널에 `role="dialog"`(또는 `alertdialog`)·`aria-modal`·`aria-label`을 붙인다
3. 열릴 때 특정 요소(확인 단추, 입력 칸)로 포커스를 옮긴다
4. Esc 키나 오버레이 클릭으로 닫는다
5. 닫힐 때 오버레이는 `fade-out`, 패널은 `pop-out` 애니메이션을 재생한 뒤 DOM에서 제거한다

이 동작이 다섯 파일에 각각 구현되어 있었다. `window.addEventListener('keydown', …)`로 Esc를 처리하는 코드 4곳, `event.target === event.currentTarget`으로 오버레이 클릭을 구분하는 코드 4곳, `useExitMotion('fade-out')` 호출 5곳. 구현마다 차이도 있었다. Launchpad는 Esc를 처리하지 않고 포커스도 옮기지 않았다. 로그인 결과는 Enter 키를 따로 처리했는데, 확인 단추에 포커스가 있으므로 Enter는 단추의 기본 동작으로 충분하다. 이름 바꾸기는 Esc를 `form`의 `onKeyDown`에서만 받아, 포커스가 폼 밖에 있으면 닫히지 않았다.

![공통 동작은 Modal 컴포넌트에, 콘텐츠는 다이얼로그마다](./images/ui-modal-layers.svg '변경 전에는 다섯 다이얼로그가 공통 동작을 각자 구현했고, 변경 후에는 Modal이 공통 동작을 맡고 다이얼로그는 콘텐츠만 렌더링한다')

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

- **오버레이와 패널 렌더링**: 패널에 `role`(`dialog`, 응답이 필요한 다이얼로그는 `alertdialog`)·`aria-modal="true"`·`aria-label`을 붙인다
- **scope**: `window`는 오버레이가 `position: absolute`로 가장 가까운 positioned 조상(앱 창)을 덮고, `screen`은 `position: fixed`로 화면 전체를 덮으며 `createPortal`로 `document.body`에 렌더링한다. 경고창·이름 바꾸기는 `window`, 나머지 셋은 `screen`
- **닫기**: `window`의 `keydown`에서 Esc(포커스 위치와 무관), 오버레이 자체의 `pointerdown`(패널 내부 클릭은 제외)
- **포커스**: `initialFocus` ref가 가리키는 요소로, 없으면 `tabIndex={-1}`인 패널 자신으로. Launchpad도 이제 Esc로 닫힌다
- **종료 애니메이션**: 오버레이 `fade-out`, 패널 `pop-out`. `motion.css`에서 다섯 다이얼로그의 클래스를 나열하던 선택자가 `[data-exiting] .ui-modal` 하나로 바뀌었다

시각 스타일은 Modal이 정하지 않는다. 오버레이 색과 `z-index`는 호출하는 쪽 CSS가 `--ui-modal-dim`·`--ui-modal-z` 변수로 지정한다(앱 안 경고창은 `rgba(0,0,0,.12)`·1000, 단축키는 `--color-overlay`·3000, 로그인 결과는 `backdrop-filter: blur`까지·20000). 패널의 너비·모서리·여백은 기존 클래스(`.ui-alert`, `.keyboard-shortcuts`, `.launchpad-content`)가 그대로 담당한다. 따라서 다섯 CSS에서 제거한 것은 오버레이의 `position`·`inset`·`display`·`animation`과 패널의 `animation` 선언뿐이다.

## 대상에서 제외한 것

**이 Mac에 관하여**는 가운데에 뜨지만 오버레이가 없고, 빈 영역을 드래그해 이동할 수 있으며, 뒤의 다른 창을 클릭할 수 있다. 모달이 아니라 일반 창이다. `role="dialog"`만 같아서 후보에 넣었다가 코드를 확인하고 제외했다. 포함하려면 "오버레이 없음"·"드래그 이동" 옵션이 필요해진다.

**이름 바꾸기의 form**: Modal의 패널은 `div`이므로 `form`이 그 안에 들어간다. 그러자 패널의 `display: grid; gap`이 `form` 하나에만 적용되어 입력 칸과 단추 사이 간격이 사라졌다. `form`에 같은 grid를 지정해 해결했다. Modal에 `as="form"` prop을 두는 방법도 있지만 호출처가 하나라 추가하지 않았다.

## 검증

- 변경된 다섯 다이얼로그가 포함된 E2E(경고창·휴지통·배경화면·메뉴 막대·로그인·Launchpad·애니메이션)를 실행했다
- 동작이 바뀐 곳은 둘이다. 포커스가 다이얼로그 밖에 있어도 Esc로 닫히는 것(이름 바꾸기), Launchpad가 Esc로 닫히는 것. 둘 다 macOS 동작과 같아지는 방향이라 유지했다

다음은 `Sheet`(휴대폰에서 화면 아래에서 올라오는 시트)다.

#MacFolio #공통컴포넌트 #리팩터링
