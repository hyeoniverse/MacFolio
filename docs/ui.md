**한국어** | [English](en/ui.md)

# 공통 UI 부품 (`apps/react/src/shared/ui`)

여러 앱이 같은 모양·동작으로 사용하는 부품을 정리한 문서다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계의 첫 항목([#210](https://github.com/hyeoniverse/MacFolio/pull/210))으로, 현재 부품의 props와 사용처를 적고, 새로 추출할 후보를 현재 코드 기준으로 다시 집계했다. 수치는 2026-10-11 `main` 기준이다.

## 원칙

- **사용처가 셋 이상이고 모양과 동작이 같을 때** 추출한다. 한두 곳이거나 서로 다르면 그 차이를 처리하는 옵션이 생겨 부품의 분기가 오히려 늘어난다 ([글자 버튼 글](https://macfolio.hyeoniverse.com/memo/shared-text-button)의 '만들지 않은 것')
- **모양은 변수로, 의미는 role로.** 부품의 CSS는 `components` [캐스케이드 레이어](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)에 있어 레이어 밖의 앱 CSS가 항상 우선 적용된다. 색·모서리·여백은 앱이 `--ui-*` 변수로 정한다. 모양이 같아도 스크린 리더에 전달되는 의미가 다르면(눌린 버튼 둘 vs 탭 목록) 한 부품으로 합치지 않는다
- **body에 렌더링하는 창에는 앱 변수가 적용되지 않는다.** `Menu`·팝오버처럼 [`createPortal`](https://react.dev/reference/react-dom/createPortal)로 body에 렌더링하는 요소는 DOM 위치가 앱 루트 밖이라 앱의 재정의를 상속하지 않으므로, 바깥 요소에 `--ui-*`를 다시 정의한다
- 부품의 파일은 `shared/ui/<종류>/<이름>.tsx`와 같은 이름의 `.css`. 순수 계산(위치 계산, 단축키 글자)은 `.ts`로 분리하고 같은 폴더에 시험 파일을 둔다

![--ui-accent의 기본값은 :root의 3층 토큰, 메모 앱 루트가 노란 강조로 재정의하고, body에 렌더링한 Menu는 앱 루트 밖이라 기본값을 사용하는 구조](images/ui-variables.svg)

## 지금 있는 것

### 버튼

| 부품            | props                                                                                                                                                 | 쓰는 곳                                                                                                                                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`        | `tone`(`default`·`primary`·`danger`), `icon`(Font Awesome 클래스), `ref`, 그 밖의 `<button>` 속성. `type`은 기본 `button`                             | 21파일: 메일(쓰기·답장), 메모(댓글·본문·이미지 창·찾기·휴대폰 목록·버전 기록·글쓰기), 메시지(새 피드백 취소), 설정(정보·GitHub·프로젝트·개인정보·배경화면), 휴지통(서버 파일·브라우저 데이터), 날씨, 이 Mac에 관하여, 활동 상태 보기, 로그인·관리자 계정 |
| `IconButton`    | `label`(aria-label, title 기본값), `icon`, `on`(켜진 상태), `variant`(`tool` 네모 · `float` 떠 있는 동그라미 · `circle` 떠 있지 않은 동그라미), `ref` | 32파일: 메모 도구 막대·사이드바·휴대폰 막대·서식·찾기·댓글, 메일, 메시지, 음악, 사진, 날씨, Finder, Safari, 설정                                                                                                                                         |
| `SidebarToggle` | `open`, `onToggle`, `className`. `IconButton`에 사이드바 모양 SVG                                                                                     | 메모 도구 막대, 사진, 날씨                                                                                                                                                                                                                               |

변수 (`Button.css`·`IconButton.css`): `--ui-accent`, `--ui-on-accent`, `--ui-danger`, `--ui-button-bg`, `--ui-button-color`, `--ui-button-padding`, `--ui-button-radius`, `--ui-tool-color`, `--ui-tool-hover`, `--ui-tool-on-bg`, `--ui-tool-on-color`, `--ui-float-bg`, `--ui-float-color`, `--ui-float-shadow`. 기본값은 3층 토큰(`styles/tokens/components.css`, [#289](https://github.com/hyeoniverse/MacFolio/pull/289))에 있고, 앱은 자기 루트에서 같은 이름을 재정의한다. 재정의하는 곳은 메모(`memo/styles/theme.css`)와 메일(`Mail.css`) 등이고, 나머지 앱은 기본값(파란 강조)을 사용한다. 기본값을 변수에 담을 수 없는 `--ui-button-color`·`--ui-float-color`(inherit)와 휴대폰 창 안에서만 정해지는 `--ui-sheet-bg`, 부품 안의 겹침 `--ui-sheet-z`는 부품 CSS에 기본값을 정의한다.

### 메뉴와 떠 있는 창

| 부품                                                      | props / 서명                                                                                                                                                                                                                                                                                           | 쓰는 곳                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `Menu`                                                    | `label`, `anchor`(화면 좌표), `items: MenuItem[]`, `onClose`, `trigger`(다시 눌러 닫는 버튼), `autoFocus`, `className`, `onNavigate`(←·→), `appMenu`. body에 렌더링하고 화면을 넘으면 안쪽으로 당긴다. ↑·↓·Home·End·Esc                                                                                | 30파일: 메모(정렬·폴더·글 메뉴 등 15), 메뉴 막대(Apple·앱·배터리·서버 6), Finder·사진·음악·Safari·날씨·설정·메시지 휴대폰 ••• |
| `MenuItem`                                                | 항목 `{ label, icon, onSelect, disabled, hint, checked, destructive, shortcut }` · `{ heading }` · `{ note }` · `{ info, icon }` · `{ row: [...] }` · `'separator'`                                                                                                                                    | 위와 같음                                                                                                                     |
| `shortcut.ts`                                             | `Shortcut`, `formatShortcut`, `ariaShortcut`, `matchesShortcut`, `isMacPlatform`, `usableWhileTyping`, `isTypingTarget`                                                                                                                                                                                | 메뉴 막대, 단축키 창                                                                                                          |
| `useDismiss(open, onDismiss, inside, { keepOpenInside })` | 바깥 누르기·Esc로 닫기. `inside`에 여는 버튼을 넣으면 "닫혔다가 다시 열림"이 없다                                                                                                                                                                                                                      | 메모 날짜 고르기·`usePopover`(서식·표 손잡이), 메뉴 막대 소리                                                                 |
| `placement.ts`                                            | `placeAtPoint`, `placeBelow`, `placeRight`(화면 밖으로 안 나가게), `EDGE`                                                                                                                                                                                                                              | 위와 같음                                                                                                                     |
| `Modal`                                                   | `label`, `onClose`(Esc·오버레이 클릭), `role`(`dialog`·`alertdialog`), `scope`(`window`: 오버레이가 앱 창을 덮음 · `screen`: 화면 전체를 덮고 body에 portal), `initialFocus`, `overlayClassName`, `className`. 오버레이 색·z-index는 호출하는 쪽 CSS의 `--ui-modal-dim`·`--ui-modal-z`                 | 6곳: `AlertDialog`, 배경화면 이름 바꾸기, 키보드 단축키, 로그인 결과, Launchpad, 메모 이미지 크게 보기(`screen`)              |
| `Sheet`                                                   | `label`, `onClose`(Esc·오버레이 클릭), `variant`(`page`: 화면 높이에 가까운 시트와 손잡이 막대 · `card`: 아래에 떠 있는 카드 · `cover`: 오버레이 없이 화면 전체), `className`, `style`. 오버레이 색·z-index·시트 바탕은 호출하는 쪽 CSS의 `--ui-sheet-dim`·`--ui-sheet-z`·`--ui-sheet-bg`. 휴대폰 전용 | 3곳: 메일 쓰기·답장(`page`), 메일 동작(`card`), 음악 지금 재생 중(`cover`). 앱마다 따로 만든 휴대폰 시트는 더 없다            |
| `SearchField`                                             | `label`(`aria-label`, placeholder 기본값), `className`(감싸는 label), 나머지는 input에 그대로(`value`·`onChange`·`autoFocus`·조합 이벤트 등)                                                                                                                                                           | 5곳: Finder, Finder 휴대폰, 메시지, 날씨, 사진 휴대폰                                                                         |
| `AlertDialog`                                             | `title`, `message`, `confirmLabel`, `cancelLabel`(`null`이면 확인만), `onConfirm`, `onCancel`. 앱 창 가운데, Esc·바깥 누르기는 취소, Enter는 확인                                                                                                                                                      | 10파일: 메모 휴지통, 메시지(삭제·보내기 확인), 휴지통(서버 파일·브라우저 데이터), 설정(정보·GitHub·배경화면), 앱 오류 경계    |

`usePopover`(버튼 아래 작은 창: 위치 계산·닫기·퇴장 애니메이션)는 아직 `apps/memo/writer/`에 있다. 사용처가 메모의 서식 창·표 손잡이·이미지 창뿐이라 그 위치에 유지한다. 메뉴 막대의 소리 창(`VolumeMenu`)과 메모 날짜 고르기가 같은 세 부품(`placement`·`useDismiss`·`useExitMotionRef`)을 직접 조합하고 있어, 사용처가 한 곳 더 생기면 `shared/ui/popover/usePopover.ts`로 이동한다.

### 움직임

| 부품                                                 | 서명                                                                                                                                                                | 쓰는 곳                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `useExitMotion(motion)` / `useExitMotionRef(motion)` | 언마운트할 때 `ExitMotion`(`pop-out`·`fade-out`·`sink-out`·`slide-out-right`·`panel-out-right`·`panel-out-down`)을 재생하고 제거한다. 움직임 줄이기면 바로 제거한다 | 15파일: 메뉴·경고창·팝오버 안쪽, Dock, 사진 보기, 메일 쓰기, 로그인, 단축키 창 등 |
| `playExit(element, motion)`                          | 훅 밖에서 같은 일                                                                                                                                                   | `useExitMotion` 안                                                                |
| `useMoveDirection(index, count, reset)`              | 목록에서 앞·뒤 어느 쪽으로 옮겼는지 (화면 넘김 방향)                                                                                                                | Finder, 사진 보기                                                                 |

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

## 직접 쓴 `<button>` 265곳

`<button>`을 직접 쓰는 곳은 91파일 265곳이다.

| 시점                                                                                 | 파일 | 곳  |
| ------------------------------------------------------------------------------------ | ---- | --- |
| 처음 집계 ([#210](https://github.com/hyeoniverse/MacFolio/pull/210))                 | 89   | 295 |
| `IconButton`으로 옮기기 전 (Safari 프로젝트 페이지·앱 추가 후)                       | 99   | 340 |
| `IconButton` 45곳 이동 후 ([#245](https://github.com/hyeoniverse/MacFolio/pull/245)) | 95   | 295 |
| `Button` 30곳 이동 후 ([#246](https://github.com/hyeoniverse/MacFolio/pull/246))     | 91   | 265 |

집계 방법: `apps/react/src`의 `.tsx`에서 `<button`이 있는 줄을 집계한다(`*.test.tsx`와 공통 부품 `shared/ui`는 제외).

```bash
git grep -c '<button' -- 'apps/react/src/**/*.tsx' ':!*.test.tsx' ':!apps/react/src/shared/ui/**'
```

구분별로 나누면 다음과 같다.

| 구분                                                 | 곳  | 무엇                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safari 프로젝트 데모 페이지 (`apps/safari/project/`) | 91  | 다른 사이트(Creative·CMS 데모 등)의 모양을 재현하는 페이지라 `cd-primary`·`cd-ghost` 같은 자체 버튼 체계가 있다. MacFolio 공통 버튼으로 교체하지 않는다                                                                                                                                                                                                                                                              |
| `IconButton`으로 옮겼다 (이 표의 수에서 빠짐)        | 45  | 뒤로 가기 꺾쇠(메모 2·메일·음악·버전 기록), ••• 더 보기(Finder·사진 2·날씨·Safari 휴대폰), `variant="circle"` 15(메일 시트 취소·닫기·보내기 5, 사진 5, Safari 휴대폰 3, 메시지 보내기, 배경화면 지우기), 찾기 이전·다음, 음악 재생·이전·다음·셔플·반복·다음 재생(8), 사진 확대·축소 4·공유·정보, 댓글 삭제, 휴대폰 떠 있는 버튼 3(메일 새 메시지, 메시지 새 피드백·검색 닫기), 날씨 사이드바 여닫기(`SidebarToggle`) |
| `IconButton`으로 옮기지 않음                         | 2   | 메시지 삭제(`messages-bubble-action`, 초점을 받을 때만 보이는 숨은 버튼이라 도구 막대 모양을 모두 제거해야 한다), 사진 휴대폰 보기의 정보(같은 알약 안의 좋아요 버튼과 함께 배치한다)                                                                                                                                                                                                                                |
| `Button`으로 옮겼다 (이 표의 수에서 빠짐)            | 30  | 휴지통 비우기 2, 찾기 완료·모두·대치 3, 휴대폰 메모 완료·이동·삭제 3, 글쓰기 게시·버리기 2, 버전 되돌리기, 잠금 풀기, 이미지 창 다시 고르기·찾기·더 보기 3, 메시지 취소, 설정의 취소·완료·편집 9(정보·GitHub·프로젝트), 기본값으로 되돌리기(정보), 더 알아보기, 날씨 다시 시도, 이 Mac에 관하여 추가 정보, 분석 관리자 로그인                                                                                        |
| 그 앱 고유                                           | 172 | 목록 줄(메일·메시지·음악 곡·메모 글·날씨 장소), 탭·분할 버튼(메일 사서함, 사진 보기 방식, 분석), 카드·썸네일(사진·배경화면·Safari 탭), 폴더 줄·달력 칸·서식 글자 버튼, 홈 화면 앱 아이콘·제어 센터 타일, 메뉴 막대 제목·Apple 로고, 표 손잡이                                                                                                                                                                        |

옮길 수 있는 약 93곳은 4단계 마지막 항목("앱마다 따로 만든 버튼·시트·목록을 공통 컴포넌트로")에서 PR 둘로 옮겼다.

- **`IconButton` 45곳 ([#245](https://github.com/hyeoniverse/MacFolio/pull/245))**: 떠 있지 않은 동그란 버튼 15곳은 `IconButton`에 추가한 `variant="circle"`로 처리했다. `circle`은 모양(동그라미, 안쪽 여백 0)만 정하고 크기·바탕·색은 앱의 CSS가 정한다. 날씨의 사이드바 여닫기는 기존 `SidebarToggle`로 옮겼다(아이콘이 Font Awesome `table-columns`에서 메모·사진과 같은 사이드바 SVG로 바뀌었다)
- **`Button` 30곳 ([#246](https://github.com/hyeoniverse/MacFolio/pull/246))**: 처음 집계한 설정의 취소·완료·편집 7곳에 프로젝트 항목의 같은 버튼 3곳이 추가되었고, 옮기지 못한 버튼은 없다
- **모양 유지 방법**: 옮긴 버튼은 앱의 `className`을 그대로 두고, 공통 CSS가 추가하는 값 가운데 앱이 재정의하지 않던 것을 앱 쪽 규칙에 적어 원래 값으로 되돌렸다
  - `IconButton`: 최소 폭·높이, 안쪽 여백, 둥근 모서리, 색
  - `Button`: `inline-flex`·가운데 정렬·`gap`, 나타날 때의 `fade-in`, 둥근 모서리, 바탕, 글꼴, 비활성 상태의 흐림. 앱마다 명시도가 0인 규칙 하나(`:where(앱의 클래스):where(.ui-button)`)로 되돌렸다

<details>
<summary>모양이 같은지 확인한 방법</summary>

E2E를 실행하면서 옮긴 버튼마다 공통 클래스(`ui-icon-button`·`tool`·`circle`·`float`, `ui-button`)를 뗀 상태와 붙인 상태의 계산된 스타일(`getComputedStyle`)을 비교했다. `IconButton`은 크기·색·여백이 같았고, `Button`은 데스크톱과 휴대폰 두 Playwright 프로젝트에서 기본·마우스 올림·비활성 상태 모두 같았다. 방법은 [손으로 쓴 아이콘 버튼 45곳을 IconButton으로](https://macfolio.hyeoniverse.com/memo/icon-button-migrate) 글에 있다.

</details>

시트와 창도 같은 항목에서 다시 검색했다(`aria-modal`·`role="dialog"`·바깥 누르기·Esc 처리, [#247](https://github.com/hyeoniverse/MacFolio/pull/247)). 남은 것 가운데 `Modal`로 옮긴 것은 메모의 이미지 크게 보기 하나다(`scope="screen"`, 덮개 색·층은 `--ui-modal-dim`·`--ui-modal-z`).

- 덮개와 이미지의 계산된 스타일과 화면은 옮기기 전과 같았다
- 이미지를 눌러도 닫히고, 닫히면 초점을 연 버튼으로 되돌린다
- 닫힐 때 전체가 흐려지던 애니메이션이 `Modal`과 같이 덮개는 흐려지고 이미지는 작아지며 사라지는 애니메이션으로 바뀌었다

옮기지 않은 것과 이유는 다음과 같다.

- 설정 프로젝트의 그림 크게 보기(`projects-lightbox`): Esc를 자기 요소에서 처리해 전파를 막는다. `Modal`의 Esc는 `window`에서 처리하므로, 옮기면 Esc 한 번에 뒤의 프로젝트 시트까지 닫힌다. ←·→ 넘기기와 닫기 버튼도 상자 바깥에 있다
- 설정 프로젝트 시트(`projects-sheet`): 데스크톱 창 안에서 옆으로 열리는 시트이고 바탕을 `inert`로 막고 초점을 가둔다. 휴대폰 전용 `Sheet`와 뜻이 다르다
- 사진 크게 보기(`photos-viewer`·`photos-phone-viewer`): 덮개가 없는 전체 화면 보기이고 Esc·바깥 누르기로 닫지 않는다
- 메모 버전 기록·서식·표 패널, Safari 저장소 데모의 `rp-pop`: 팝오버다
- Safari Creative 데모의 그림 크게 보기: 브라우저의 `<dialog>`를 쓰는 데모 페이지다
- 메시지·휴지통에는 따로 만든 시트나 창이 남아 있지 않다 (메시지의 Esc 처리는 열린 창이 있으면 동작하지 않도록 건너뛰는 코드다)

## 새로 추출할 후보: 현재 집계

계획에 적은 아홉 후보의 사용처를 `main`에서 다시 집계했다.

| 후보                             | 현재 따로 만든 곳                                                                                                                                                      | 같은가                                                                                                          | 결정                                                                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Sheet` (아래에서 올라오는 시트) | 메일 휴대폰(동작 시트 `mail-phone-sheet`·쓰기 시트 `mail-compose.sheet`), 음악 휴대폰(지금 재생 중, `music-sheet-up`)                                                  | 올라오는 애니메이션·오버레이 클릭 닫기·`role="dialog"`가 같다. 콘텐츠와 높이는 다르다                           | **추출했다.** `shared/ui/sheet/Sheet`. 오버레이·올라오는 애니메이션·닫기·`role`을 맡고 콘텐츠는 children. 닫힐 때는 `Modal`과 같이 `useExitMotion`이 복사본에 내려가는 애니메이션(`sheet-out`)을 걸어, 메일의 닫기 타이머(240ms)와 `closing` 상태가 없어졌다 |
| `Modal` (가운데 뜨는 창)         | 단축키 창(`keyboard-shortcuts-overlay`), 이 Mac에 관하여, 로그인 결과(`login-flow-card`), Dock의 Launchpad(`launchpad-modal`)                                          | 바깥 누르기·Esc·`aria-modal`을 저마다 적는다 (Esc 직접 처리 8파일, 바깥 누르기 6파일)                           | **추출했다.** `shared/ui/dialog/Modal`. `AlertDialog`의 오버레이·포커스·닫기·종료 애니메이션을 분리해 만들고, 모달 다이얼로그 넷이 이 컴포넌트를 쓴다. '이 Mac에 관하여'는 오버레이가 없는 드래그 가능한 창이라 제외                                         |
| `Switch`                         | 설정 '클릭 소리', 사생활 보호 창(`role="switch"` 2곳). 그 밖의 `type="checkbox"` 4곳은 글자 옆 네모(체크박스)라 뜻이 다르다                                            | 둘 다 `<label className="settings-toggle">` 안의 같은 모양                                                      | 보류. 설정 앱 한 곳뿐이라 설정의 CSS로 충분하다                                                                                                                                                                                                              |
| `SearchField`                    | 메모(칩·조건 메뉴·넓어짐), Finder·Finder 휴대폰, 메시지, 날씨, 사진 휴대폰 (`type="search"` 6곳)                                                                       | 메모만 많이 다르다. 나머지 다섯은 돋보기·지우기·placeholder가 같은 칸 하나                                      | **추출했다.** `shared/ui/search-field/SearchField`. 돋보기와 `type="search"` 입력, `label`이 `aria-label`(placeholder를 주지 않으면 placeholder도). 모양은 쓰는 쪽 `className`. 메모의 것은 그대로 두고 이름만 `memo/components/MemoSearch`로                |
| `SegmentedControl`               | `role="tablist"` 5곳(메모 이미지 창, 분석, 메일 사서함, 사진 휴대폰, Safari 탭), `role="radiogroup"` 2곳(설정 화면 모드, 배경화면), `role="group"` 1곳(사진 보기 방식) | 모양은 비슷하지만 role이 셋(탭·라디오·눌린 버튼)이다                                                            | 보류. 글자 버튼 글의 판단 그대로. 뜻이 같은 것끼리 셋이 되면(라디오 2곳) 그때                                                                                                                                                                                |
| `EmptyState`                     | `*-empty` 10파일 29곳 (메모·메일·Finder·분석·메시지·날씨·휴지통·단축키)                                                                                                | 한 줄 글(`<p>`·`<li>`), 분석만 아이콘과 오류 색이 있다                                                          | 보류. 감쌀 것이 없다. 빈 줄의 색·여백만 토큰(5단계)으로 맞춘다                                                                                                                                                                                               |
| `ListRow`                        | 메모 글, 메일, 메시지 대화, 음악 곡, Finder 파일                                                                                                                       | 줄마다 내용과 배치가 다르다                                                                                     | 보류. 글자 버튼 글의 판단 그대로                                                                                                                                                                                                                             |
| `Toolbar`                        | `toolbar` 12파일                                                                                                                                                       | 높이·여백·버튼 사이 간격이 앱마다 다르고, 창 제목 막대와 합쳐진 곳(메모·Finder)과 따로인 곳(메일·메시지)이 있다 | 보류. 5단계(디자인 토큰)에서 높이·여백을 변수로 맞추고 나서 본다                                                                                                                                                                                             |
| `Sidebar`                        | `sidebar` 10파일                                                                                                                                                       | 내용(폴더 트리·사서함·대화 목록·곡 목록)이 다르고, 공통은 폭·바탕색·여닫기뿐                                    | 보류. 여닫기는 이미 `SidebarToggle`, 폭·색은 5단계 토큰으로                                                                                                                                                                                                  |

정리하면 둘째 항목에서 추출하는 것은 **`Sheet`([#220](https://github.com/hyeoniverse/MacFolio/pull/220)), `Modal`([#212](https://github.com/hyeoniverse/MacFolio/pull/212)), `SearchField`** 셋이다. 나머지 여섯은 현재 사용처 수로는 추출 효과가 없어 보류하고, 5단계 토큰 정리 뒤에 다시 집계한다.

## 데스크톱·휴대폰 짝

같은 부품이 두 모양을 가져야 하는 곳은 `variant`로 선택한다. 기본값은 데스크톱 모양이고, 휴대폰 화면에서 사용하는 쪽이 명시한다. `useIsMobile`로 자동 선택하지 않는 이유는, 같은 앱이라도 휴대폰 화면 안에서 데스크톱 모양을 쓰는 곳(메모 폴더 줄은 편집 중에만 iOS 모양)이 있기 때문이다.

| 부품         | variant                                                    | 쓰는 곳                                                                                                                                     |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `IconButton` | `tool`(기본)·`float`·`circle`                              | 원래 있던 것                                                                                                                                |
| `Menu`       | `mac`(기본)·`ios` (`ios`는 `Menu.css`의 `.touch`를 붙인다) | `ios`: 메모 휴대폰(목록·읽기 막대, 폴더 고르기, 폴더 줄 편집 중), Finder 휴대폰, 음악, 사진 휴대폰·크게 보기, Safari 휴대폰. 나머지는 `mac` |

`Menu`의 `className`은 위치 조정용으로 유지하고, 데스크톱·휴대폰 모양은 더 이상 `className="touch"`로 선택하지 않는다.

의도적으로 분리한 쌍:

- `Sheet`(휴대폰)와 `Modal`(데스크톱): 뜻은 둘 다 다이얼로그지만 올라오는 방향·덮개·높이·닫기 몸짓이 달라 `variant` 하나로 묶으면 분기만 늘어난다
- `SearchField`: 데스크톱과 휴대폰이 같은 모양이다. 앱마다 다른 크기는 쓰는 쪽 `className`이 맡는다
- `FinderMobile`·`PhotosMobile`·`SafariMobile`과 데스크톱 앱: 부품이 아니라 화면 전체가 다르다(탭 막대·내비게이션 막대). 안쪽 부품(`Menu`·`IconButton`)이 이미 `variant`를 쓴다
- `Button`·목록 줄: 휴대폰 전용 모양을 고르는 곳이 없다

## 시험과 접근성 이름

- 순수 계산(`placement.ts`, `shortcut.ts`, `direction.ts`)은 옆에 `*.test.ts`가 있다
- 부품의 접근성 이름·역할은 `shared/ui/a11y.test.ts`가 부품을 HTML로 렌더링해([`renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup)) 확인한다. 누르기·Esc·초점 이동 같은 동작은 브라우저 E2E(`apps/react/e2e/`)가 확인한다. `Menu`는 body에 렌더링하므로(portal) 이 시험에서 제외하고 E2E가 확인한다

이름 규칙 (부품이 붙이는 속성, 사용하는 쪽이 전달할 값):

| 부품            | 이름                                                                                                   | 쓰는 쪽이 줄 것                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `IconButton`    | `label` → `aria-label`·`title`                                                                         | 아이콘만 있으면 `label`이 꼭 있어야 한다 (타입이 막는다). 없으면 보이는 글자를 `children`으로 |
| `Button`        | 글자(`children`)                                                                                       | 글자. 앞 아이콘은 `aria-hidden`                                                               |
| `SidebarToggle` | 지금 할 일 ('사이드바 가리기'·'사이드바 보기') + `aria-expanded`                                       | 없음                                                                                          |
| `SearchField`   | `label` → `aria-label` (placeholder 기본값)                                                            | `label`                                                                                       |
| `DatePicker`    | '게시일 고르기' / '게시일 2026. 10. 17., 바꾸기' + `aria-haspopup="dialog"`                            | `label`                                                                                       |
| `Modal`         | `role="dialog"`(경고창은 `alertdialog`)·`aria-modal`·`aria-label`                                      | `label`                                                                                       |
| `AlertDialog`   | 제목이 이름                                                                                            | `title`                                                                                       |
| `Sheet`         | `role="dialog"`·`aria-label`, 덮개 없는 `cover`는 `aria-modal` 없음                                    | `label`                                                                                       |
| `Menu`          | `role="menu"`·`aria-label`, 항목은 `menuitem`(체크는 `menuitemcheckbox`), 단축키는 `aria-keyshortcuts` | `label`                                                                                       |

- 장식 아이콘(Font Awesome `<i>`, 인라인 SVG)은 `aria-hidden="true"`. 인라인 SVG는 `focusable="false"`도 지정한다
- 이름은 동작을 나타낸다 ('지우기', '사이드바 보기'). 상태는 이름에 넣지 않고 [`aria-pressed`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-pressed)·`aria-expanded`·`aria-checked`로 전달한다

## 관련 글

- [공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다](https://macfolio.hyeoniverse.com/memo/ui-inventory)
- [손으로 쓴 아이콘 버튼 45곳을 IconButton으로 — 모양은 그대로 두고](https://macfolio.hyeoniverse.com/memo/icon-button-migrate)
- [손으로 쓴 글자 버튼 30곳을 Button으로 — 모양은 그대로 두고](https://macfolio.hyeoniverse.com/memo/text-button-migrate)
- [모달 다이얼로그 5개의 공통 동작을 Modal 컴포넌트로 추출](https://macfolio.hyeoniverse.com/memo/ui-modal)
- [휴대폰 시트 3곳의 공통 동작을 Sheet 컴포넌트로 추출](https://macfolio.hyeoniverse.com/memo/ui-sheet)
- [남은 시트와 창을 찾아 보니 — Modal로 옮긴 것은 하나](https://macfolio.hyeoniverse.com/memo/sheet-modal-migrate)
- [데스크톱과 휴대폰의 메뉴 모양을 variant로 고르기](https://macfolio.hyeoniverse.com/memo/ui-variant-pairs)
- [공통 부품의 접근성 이름을 시험으로 — 아이콘만 있는 버튼은 이름 없이 만들 수 없게](https://macfolio.hyeoniverse.com/memo/ui-a11y-names)
- [메뉴 다섯 벌을 하나로 - useDismiss, placement, Menu](https://macfolio.hyeoniverse.com/memo/shared-menu)
