# 공통 UI 부품 (`apps/react/src/shared/ui`)

앱 여럿이 같은 모양·동작으로 쓰는 부품이 여기 있다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계의 첫 항목으로, 지금 있는 것의 props와 쓰는 곳을 적고, 새로 뽑을 후보를 지금 코드의 수로 다시 쟀다. 수는 2026-10-11 `main` 기준이다.

## 원칙

- **쓰는 곳이 셋 이상이고 모양과 동작이 같을 때** 뽑는다. 한두 곳이거나 서로 다르면 그 차이를 받는 옵션이 생겨 오히려 무거워진다 ([글자 단추 글](https://macfolio.hyeoniverse.com/memo/shared-text-button)의 '만들지 않은 것')
- **모양은 변수로, 뜻은 role로.** 부품의 CSS는 `components` 층에 있어 앱의 CSS가 늘 이긴다. 색·모서리·여백은 앱이 `--ui-*` 변수로 정한다. 겉모양이 같아도 스크린 리더에게 뜻이 다르면(눌린 단추 둘 vs 탭 목록) 한 부품으로 합치지 않는다
- **body에 그리는 창에는 앱 변수가 닿지 않는다.** `Menu`·팝오버처럼 `createPortal`로 body에 그리는 것은 바깥 요소에 `--ui-*`를 다시 정한다
- 부품의 파일은 `shared/ui/<종류>/<이름>.tsx`와 같은 이름의 `.css`. 순수 계산(자리 잡기, 단축키 글자)은 `.ts`로 두고 시험을 옆에 붙인다

## 지금 있는 것

### 단추

| 부품            | props                                                                                                                     | 쓰는 곳                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Button`        | `tone`(`default`·`primary`·`danger`), `icon`(Font Awesome 클래스), `ref`, 그 밖의 `<button>` 속성. `type`은 기본 `button` | 10파일: 메일(쓰기·답장), 메모(댓글·본문·이미지 창), 설정(GitHub·배경화면), 휴지통(서버 파일), 로그인·관리자 계정 |
| `IconButton`    | `label`(aria-label, title 기본값), `icon`, `on`(켜진 상태), `variant`(`tool` 네모 · `float` 떠 있는 동그라미), `ref`      | 15파일: 메모 도구 막대·사이드바·휴대폰 막대·서식, 메일, 메시지, Finder, Safari, 설정                             |
| `SidebarToggle` | `open`, `onToggle`, `className`. `IconButton`에 사이드바 모양 SVG                                                         | 메모 도구 막대, 사진                                                                                             |

변수 (`Button.css`·`IconButton.css`): `--ui-accent`, `--ui-on-accent`, `--ui-danger`, `--ui-button-bg`, `--ui-button-color`, `--ui-button-padding`, `--ui-button-radius`, `--ui-tool-color`, `--ui-tool-hover`, `--ui-tool-on-bg`, `--ui-tool-on-color`, `--ui-float-bg`, `--ui-float-color`, `--ui-float-shadow`. 앱 루트에서 정하는 곳은 메모(`Memo.css`)와 메일(`Mail.css`)이고, 나머지 앱은 기본값(파란 강조)을 쓴다.

### 메뉴와 떠 있는 창

| 부품                                                      | props / 서명                                                                                                                                                                                                 | 쓰는 곳                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `Menu`                                                    | `label`, `anchor`(화면 좌표), `items: MenuItem[]`, `onClose`, `trigger`(다시 눌러 닫는 단추), `autoFocus`, `className`, `onNavigate`(←·→), `appMenu`. body에 그리고 넘치면 안쪽으로 당긴다. ↑·↓·Home·End·Esc | 30파일: 메모(정렬·폴더·글 메뉴 등 15), 메뉴 막대(Apple·앱·배터리·서버 6), Finder·사진·음악·Safari·날씨·설정·메시지 휴대폰 ••• |
| `MenuItem`                                                | 항목 `{ label, icon, onSelect, disabled, hint, checked, destructive, shortcut }` · `{ heading }` · `{ note }` · `{ info, icon }` · `{ row: [...] }` · `'separator'`                                          | 위와 같음                                                                                                                     |
| `shortcut.ts`                                             | `Shortcut`, `formatShortcut`, `ariaShortcut`, `matchesShortcut`, `isMacPlatform`, `usableWhileTyping`, `isTypingTarget`                                                                                      | 메뉴 막대, 단축키 창                                                                                                          |
| `useDismiss(open, onDismiss, inside, { keepOpenInside })` | 바깥 누르기·Esc로 닫기. `inside`에 여는 단추를 넣으면 "닫혔다가 다시 열림"이 없다                                                                                                                            | 메모 날짜 고르기·`usePopover`(서식·표 손잡이), 메뉴 막대 소리                                                                 |
| `placement.ts`                                            | `placeAtPoint`, `placeBelow`, `placeRight`(화면 밖으로 안 나가게), `EDGE`                                                                                                                                    | 위와 같음                                                                                                                     |
| `AlertDialog`                                             | `title`, `message`, `confirmLabel`, `cancelLabel`(`null`이면 확인만), `onConfirm`, `onCancel`. 앱 창 가운데, Esc·바깥 누르기는 취소, Enter는 확인                                                            | 10파일: 메모 휴지통, 메시지(삭제·보내기 확인), 휴지통(서버 파일·브라우저 데이터), 설정(정보·GitHub·배경화면), 앱 오류 경계    |

`usePopover`(단추 아래 작은 창: 자리·닫기·나가는 움직임)는 아직 `apps/memo/writer/`에 있다. 쓰는 곳이 메모의 서식 창·표 손잡이·이미지 창뿐이라 거기 둔다. 메뉴 막대의 소리 창(`VolumeMenu`)과 메모 날짜 고르기가 같은 세 부품(`placement`·`useDismiss`·`useExitMotionRef`)을 직접 조립하고 있어, 한 곳 더 생기면 `shared/ui/popover/usePopover.ts`로 올린다.

### 움직임

| 부품                                                 | 서명                                                                                                                                                            | 쓰는 곳                                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `useExitMotion(motion)` / `useExitMotionRef(motion)` | 언마운트할 때 `ExitMotion`(`pop-out`·`fade-out`·`sink-out`·`slide-out-right`·`panel-out-right`·`panel-out-down`)을 재생하고 지운다. 움직임 줄이기면 바로 지운다 | 15파일: 메뉴·경고창·팝오버 안쪽, Dock, 사진 보기, 메일 쓰기, 로그인, 단축키 창 등 |
| `playExit(element, motion)`                          | 훅 밖에서 같은 일                                                                                                                                               | `useExitMotion` 안                                                                |
| `useMoveDirection(index, count, reset)`              | 목록에서 앞·뒤 어느 쪽으로 옮겼는지 (화면 넘김 방향)                                                                                                            | Finder, 사진 보기                                                                 |

### 끌어서 순서 바꾸기

| 부품                                         | 서명                                                                                                              | 쓰는 곳                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `startPointerReorder(event, onDrop, isItem)` | ≡ 손잡이의 pointerdown에서. 잡은 `li`가 손가락을 따라오고 지나간 줄이 비켜 준다. 놓으면 `onDrop(from, to, items)` | 메모 폴더(사이드바·줄), 설정 GitHub 저장소 순서 |
| `reorderKeyDelta(key)`                       | ↑·↓ → -1·1                                                                                                        | 위와 같음                                       |

### 그 밖

| 부품        | 무엇                                                                           | 쓰는 곳                      |
| ----------- | ------------------------------------------------------------------------------ | ---------------------------- |
| `ShareIcon` | iOS 공유 모양 SVG (Font Awesome에 없다)                                        | 메모(글 메뉴·휴대폰), Safari |
| `Turnstile` | Cloudflare Turnstile 위젯. 토큰을 돌려준다                                     | 메일 쓰기, 댓글, 메시지      |
| `WebFrame`  | 바깥 사이트 iframe(`sandbox`·`allow` 목록, 막대 색 메시지 `BAR_COLOR_MESSAGE`) | 프로젝트 앱, API 문서        |

## 새로 뽑을 후보: 지금 수

계획에 적은 아홉 후보를 `main`에서 다시 쟀다. `<button>`을 직접 쓰는 곳은 89파일 295곳이고, 그 가운데 `Button`·`IconButton`을 쓰는 파일은 각각 10·15개다. 직접 쓰는 단추는 대부분 그 앱에만 있는 모양(음악의 재생 단추, 날씨의 도시 줄, Safari 프로젝트 페이지의 데모 단추)이라 수만으로 옮길 대상이 되지는 않는다.

| 후보                             | 지금 따로 만든 곳                                                                                                                                                      | 같은가                                                                                                          | 정한 것                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sheet` (아래에서 올라오는 시트) | 메일 휴대폰(동작 시트 `mail-phone-sheet`·쓰기 시트 `mail-compose.sheet`), 음악 휴대폰(지금 재생 중, `music-sheet-up`)                                                  | 올라오는 움직임·바깥 누르면 닫기·`role="dialog"`가 같다. 안의 내용과 높이는 다르다                              | **뽑는다.** 세 곳이 겉(레이어·올라오고 내려가는 움직임·닫기·role)을 저마다 적고 있다. 겉만 받고 안은 children. 4단계 둘째 항목에서 가장 먼저      |
| `Modal` (가운데 뜨는 창)         | 단축키 창(`keyboard-shortcuts-overlay`), 이 Mac에 관하여, 로그인 결과(`login-flow-card`), Dock의 Launchpad(`launchpad-modal`)                                          | 바깥 누르기·Esc·`aria-modal`을 저마다 적는다 (Esc 직접 처리 8파일, 바깥 누르기 6파일)                           | **뽑는다.** `AlertDialog`의 겉(overlay·fade-out·Esc·바깥 누르기·초점)을 `Modal`로 떼고 `AlertDialog`가 그것을 쓴다. 가운데 뜨는 창 넷이 `Modal`로 |
| `Switch`                         | 설정 '클릭 소리', 사생활 보호 창(`role="switch"` 2곳). 그 밖의 `type="checkbox"` 4곳은 글자 옆 네모(체크박스)라 뜻이 다르다                                            | 둘 다 `<label className="settings-toggle">` 안의 같은 모양                                                      | 보류. 설정 앱 한 곳뿐이라 설정의 CSS로 충분하다                                                                                                   |
| `SearchField`                    | 메모(칩·조건 메뉴·넓어짐), Finder·Finder 휴대폰, 메시지, 날씨, 사진 휴대폰 (`type="search"` 6곳)                                                                       | 메모만 많이 다르다. 나머지 다섯은 돋보기·지우기·placeholder가 같은 칸 하나                                      | **뽑는다.** 메모를 뺀 다섯 곳의 칸을 `SearchField`로. 메모의 것은 그대로 (이름이 같아 `memo/components/SearchField`를 `MemoSearch`로 바꾼다)      |
| `SegmentedControl`               | `role="tablist"` 5곳(메모 이미지 창, 분석, 메일 사서함, 사진 휴대폰, Safari 탭), `role="radiogroup"` 2곳(설정 화면 모드, 배경화면), `role="group"` 1곳(사진 보기 방식) | 겉은 비슷하지만 뜻이 셋(탭·라디오·눌린 단추)이다                                                                | 보류. 글자 단추 글의 판단 그대로. 뜻이 같은 것끼리 셋이 되면(라디오 2곳) 그때                                                                     |
| `EmptyState`                     | `*-empty` 10파일 29곳 (메모·메일·Finder·분석·메시지·날씨·휴지통·단축키)                                                                                                | 한 줄 글(`<p>`·`<li>`), 분석만 아이콘과 오류 색이 있다                                                          | 보류. 감쌀 것이 없다. 빈 줄의 색·여백만 토큰(5단계)으로 맞춘다                                                                                    |
| `ListRow`                        | 메모 글, 메일, 메시지 대화, 음악 곡, Finder 파일                                                                                                                       | 줄마다 내용과 배치가 다르다                                                                                     | 보류. 글자 단추 글의 판단 그대로                                                                                                                  |
| `Toolbar`                        | `toolbar` 12파일                                                                                                                                                       | 높이·여백·단추 사이 간격이 앱마다 다르고, 창 제목 막대와 합쳐진 곳(메모·Finder)과 따로인 곳(메일·메시지)이 있다 | 보류. 5단계(디자인 토큰)에서 높이·여백을 변수로 맞추고 나서 본다                                                                                  |
| `Sidebar`                        | `sidebar` 10파일                                                                                                                                                       | 내용(폴더 트리·사서함·대화 목록·곡 목록)이 다르고, 공통은 폭·바탕색·여닫기뿐                                    | 보류. 여닫기는 이미 `SidebarToggle`, 폭·색은 5단계 토큰으로                                                                                       |

정리하면 둘째 항목에서 뽑는 것은 **`Sheet`, `Modal`, `SearchField`** 셋이다. 나머지 여섯은 지금 수로는 이득이 없어 보류하고, 5단계 토큰 정리 뒤에 다시 잰다.

## 데스크톱·휴대폰 짝

같은 부품이 두 모양을 가져야 하는 곳은 `variant`로 고른다. 지금은 `IconButton`의 `tool`·`float`와 `Menu`의 `className`(휴대폰에서 iOS처럼 크게)이 그 예다. 새로 뽑는 `Sheet`는 휴대폰 전용(데스크톱은 `Modal`), `SearchField`는 둘이 같은 모양이라 `variant`가 없다.

## 시험과 접근성 이름

- 순수 계산(`placement.ts`, `shortcut.ts`, `direction.ts`)은 옆에 `*.test.ts`가 있다. 컴포넌트는 브라우저 E2E(`apps/react/e2e/`)가 메뉴·경고창·단추를 누르는 것으로 확인한다
- 아이콘만 있는 단추는 반드시 `label`(→ `aria-label`). 글자가 있는 단추는 글자가 이름이다. 창은 `role="dialog"`·`aria-modal`·`aria-label`을 부품이 붙이고, 쓰는 쪽은 `label`만 준다
- 메뉴 항목의 단축키는 `aria-keyshortcuts`(`ariaShortcut`)로 읽힌다
