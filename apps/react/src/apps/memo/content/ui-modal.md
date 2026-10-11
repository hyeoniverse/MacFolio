---
title: 가운데 뜨는 창 다섯의 겉을 Modal 하나로
date: 2026-10-11
category: 개발기/MacFolio/프론트엔드
summary: 경고창, 배경화면 이름 바꾸기, 키보드 단축키, 로그인 결과, Launchpad가 저마다 덮개·Esc·바깥 누르기·초점·사라지는 움직임을 적고 있었다. 그 겉을 shared/ui의 Modal로 떼고 다섯 창이 안만 그리게 했다. 앱 창을 덮을지 화면을 덮을지는 scope로, 어둡기와 층은 CSS 변수로 쓰는 쪽이 정한다. '이 Mac에 관하여'는 덮개 없는 끌 수 있는 창이라 두었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 둘째 항목 "새로 뽑을 것"의 첫 부품. [부품 목록을 적은 글](/memo/ui-inventory)에서 뽑기로 한 셋(`Modal`·`Sheet`·`SearchField`) 가운데 새 코드가 가장 적은 `Modal`부터다.

## 다섯 창이 같은 일을 다섯 번

가운데 뜨는 창은 다섯 있었다. 앱 안 경고창(`AlertDialog`), 배경화면 이름 바꾸기, 도움말의 키보드 단축키, 로그인하고 돌아왔을 때의 결과, Dock의 Launchpad. 겉은 모두 같다. 덮개가 깔리고, 상자가 가운데에 튀어나오고, Esc나 덮개를 누르면 닫히고, 열릴 때 단추 하나에 초점이 가고, 닫힐 때 덮개는 흐려지고 상자는 작아지며 사라진다.

그런데 이 겉을 다섯 파일이 저마다 적고 있었다. `window.addEventListener('keydown', …)`로 Esc를 받는 코드가 넷, `event.target === event.currentTarget`으로 바깥을 가리는 코드가 넷, `useExitMotion('fade-out')`이 다섯. 조금씩 다르기도 했다. Launchpad는 Esc로 안 닫혔고 초점도 안 갔다. 로그인 결과는 Enter를 따로 받았는데, 확인 단추에 초점이 있으니 Enter는 단추가 알아서 받는다. 이름 바꾸기는 Esc를 창 안(form의 keydown)에서만 받아, 초점이 밖에 있으면 안 닫혔다.

![겉은 Modal 하나, 안은 창마다](./images/ui-modal-layers.svg '전에는 다섯 창이 겉을 저마다 적었고, 후에는 Modal이 겉을 맡고 창은 안만 그린다')

## Modal이 맡는 것

```tsx
<Modal
	label="키보드 단축키"
	scope="screen"
	onClose={onClose}
	initialFocus={closeButton}
	overlayClassName="keyboard-shortcuts-overlay"
	className="keyboard-shortcuts"
>
	…안…
</Modal>
```

- **덮개와 상자**: `role`(`dialog`, 답을 받아야 하는 창은 `alertdialog`)·`aria-modal`·`aria-label`을 상자에 붙인다
- **scope**: `window`는 덮개가 가장 가까운 위치 기준(앱 창)을 덮고, `screen`은 화면 전체를 덮고 `body`에 그린다(portal). 경고창·이름 바꾸기는 `window`, 나머지 셋은 `screen`
- **닫기**: Esc(창 밖에 초점이 있어도)와 덮개 누르기. 상자 안을 누른 것은 닫지 않는다
- **초점**: `initialFocus`에 준 요소(확인 단추, 입력 칸)로, 없으면 상자 자신으로. Launchpad도 이제 Esc로 닫힌다
- **사라지는 움직임**: 덮개는 `fade-out`, 상자는 `pop-out`. `motion.css`의 `[data-exiting] .ui-modal` 하나가 다섯 창의 이름 목록을 대신한다

모양은 Modal이 정하지 않는다. 어둡기와 층은 쓰는 쪽 CSS가 `--ui-modal-dim`·`--ui-modal-z`로 적고(앱 안 경고창은 살짝 어둡게 `rgba(0,0,0,.12)`·1000, 단축키는 `--color-overlay`·3000, 로그인은 흐림까지·20000), 상자의 너비·모서리·여백은 전처럼 각자의 클래스(`.ui-alert`, `.keyboard-shortcuts`, `.launchpad-content`)가 맡는다. 그래서 다섯 CSS에서 지운 것은 덮개의 `position`·`inset`·`display`·`animation`과 상자의 `animation`뿐이고, 나머지는 그대로다.

## 두지 않은 것

**이 Mac에 관하여**는 가운데 뜨지만 덮개가 없고, 빈 곳을 잡아 옮길 수 있고, 다른 창을 누를 수 있다. 창이지 모달이 아니다. `role="dialog"`만 같아 후보에 넣었다가 코드를 보고 뺐다. 억지로 넣으면 "덮개 없음"·"옮기기" 옵션이 생긴다.

**이름 바꾸기의 form**: 상자는 `div`라 `form`이 그 안에 들어간다. 그러자 상자의 `display: grid; gap`이 form 하나에만 걸려 칸 사이가 붙었다. form에 같은 grid를 주어 맞췄다. Modal에 `as="form"`을 두는 것도 생각했지만, 쓰는 곳이 하나라 두지 않았다.

## 확인

- 바뀐 다섯 창이 나오는 E2E(경고창·휴지통·배경화면·메뉴 막대·로그인·Launchpad·움직임)를 돌렸다
- Esc가 이제 창 밖에 초점이 있어도 닫는 것, Launchpad가 Esc로 닫히는 것은 동작이 조금 바뀐 쪽이다. 둘 다 macOS와 같아지는 방향이라 그대로 두었다

다음은 `Sheet`(휴대폰 아래에서 올라오는 시트)다.

#MacFolio #공통컴포넌트 #리팩터링
