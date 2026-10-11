---
title: 공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다
date: 2026-10-11
category: 개발기/MacFolio/프론트엔드
summary: 4단계(공통 컴포넌트)의 첫 항목은 코드를 바꾸는 일이 아니라 세는 일이었다. shared/ui에 있는 열다섯 부품의 props와 쓰는 곳을 docs/ui.md에 적고, 계획에 적어 둔 새 부품 후보 아홉을 지금 코드의 수로 다시 쟀다. 뽑을 것은 Sheet·Modal·SearchField 셋, 나머지 여섯은 수가 많아도 모양이나 뜻이 달라 보류했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 "공통 컴포넌트 설계"의 첫 항목, "지금 있는 것 정리: Button, IconButton, Menu, Popover, Dialog, Reorder의 props와 사용처 목록". [브랜드 타입](/memo/branded-ids)으로 1단계를 끝낸 다음이다.

## 왜 세는 일부터

4단계의 둘째 항목에는 새로 뽑을 부품 아홉 개가 적혀 있다. `Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`. 그런데 이 가운데 다섯은 열흘 전 [글자 단추 글](/memo/shared-text-button)에서 "만들지 않는다"고 정한 것이다. 쓰는 곳이 하나뿐이거나(Switch), 감쌀 것이 없거나(EmptyState), 겉은 같아도 스크린 리더에게 뜻이 다르거나(SegmentedControl).

그 뒤로 Finder, 사진·음악 휴대폰 화면, 메일 휴대폰 시트가 생겼다. 수가 바뀌었으니 판단도 다시 해야 한다. 그래서 첫 항목은 코드를 바꾸지 않고, 지금 있는 것과 후보의 수를 적는 문서 하나다. `docs/ui.md`.

## 지금 있는 것

`shared/ui`에는 부품이 열다섯 있다. 단추 셋(`Button`·`IconButton`·`SidebarToggle`), 메뉴와 떠 있는 창(`Menu`·`useDismiss`·`placement`·`shortcut`·`AlertDialog`), 움직임(`useExitMotion`·`useMoveDirection`), 끌어서 순서 바꾸기(`startPointerReorder`), 그리고 `ShareIcon`·`Turnstile`·`WebFrame`.

쓰는 곳을 세어 보니 가장 많이 쓰이는 것은 `Menu`(30파일)였고, `IconButton` 15, `useExitMotion` 15, `Button` 10, `AlertDialog` 10 순이다. props는 문서에 표로 적었다. 적으면서 하나 눈에 띈 것이 있다. 메뉴 막대의 소리 창과 메모의 날짜 고르기가 `placement`·`useDismiss`·`useExitMotionRef` 세 부품을 똑같이 조립하고 있었다. 메모의 `usePopover`가 바로 그 조립인데 `apps/memo/writer/`에 있어서 다른 앱이 모른다. 한 곳만 더 생기면 `shared/ui/popover/`로 올린다고 적어 두었다.

## 아홉 후보를 다시 재다

![후보 아홉의 수와 정한 것](./images/ui-inventory-candidates.svg '막대 길이는 따로 만든 곳의 수. 길다고 뽑는 것이 아니다')

| 후보               | 따로 만든 곳                                       | 정한 것 |
| ------------------ | -------------------------------------------------- | ------- |
| `Sheet`            | 메일 휴대폰 둘, 음악 휴대폰 하나                   | 뽑는다  |
| `Modal`            | 단축키 창, 이 Mac에 관하여, 로그인 결과, Launchpad | 뽑는다  |
| `SearchField`      | Finder 둘, 메시지, 날씨, 사진 휴대폰 (메모는 따로) | 뽑는다  |
| `Switch`           | 설정 둘                                            | 보류    |
| `SegmentedControl` | 탭 5, 라디오 2, 눌린 단추 1                        | 보류    |
| `EmptyState`       | 10파일                                             | 보류    |
| `ListRow`          | 메모·메일·메시지·음악·Finder                       | 보류    |
| `Toolbar`          | 12파일                                             | 보류    |
| `Sidebar`          | 10파일                                             | 보류    |

막대가 가장 긴 `Toolbar`·`Sidebar`·`EmptyState`가 보류이고, 짧은 `Sheet`가 뽑는 쪽이다. 수가 아니라 **같은가**로 정했기 때문이다.

`Sheet`는 세 곳이 "아래에서 올라오는 레이어, 바깥을 누르면 내려가며 닫힘, `role="dialog"`"를 저마다 적고 있다. 안에 들어가는 것은 다르지만 겉은 같다. 겉만 받고 안은 `children`으로 두면 된다. `Modal`도 같다. 가운데 뜨는 창 넷이 Esc와 바깥 누르기를 따로 적는다 (Esc를 직접 처리하는 파일이 8개, 바깥 누르기가 6개). 이미 있는 `AlertDialog`의 겉이 그 일을 하고 있으니, 그것을 `Modal`로 떼고 `AlertDialog`가 `Modal`을 쓰게 하면 된다.

`SearchField`는 지난번에 "메모와 메시지가 다르다"고 보류했던 것이다. 지금은 `type="search"`가 여섯 곳이고, 메모를 뺀 다섯은 돋보기·placeholder·aria-label이 있는 칸 하나로 같다. 메모만 칩과 조건 메뉴가 있어 다르다. 다섯을 합치고 메모는 그대로 두기로 했다.

반대로 `Toolbar`는 12파일이나 되지만 높이와 여백이 앱마다 다르고, 창 제목 막대와 합쳐진 앱(메모·Finder)과 따로인 앱(메일·메시지)이 있다. 지금 합치면 그 차이를 다 받는 옵션이 생긴다. 5단계에서 높이·여백을 토큰으로 맞춘 다음에 다시 재는 것이 맞다. `Sidebar`와 `EmptyState`도 같은 이유다.

## 둘째 항목은

뽑을 것이 `Sheet`·`Modal`·`SearchField` 셋으로 줄었다. 다음 PR은 `Modal`부터다. `AlertDialog`에서 겉을 떼는 일이라 새 코드가 가장 적고, 창 넷이 바로 옮겨 간다.

#MacFolio #공통컴포넌트 #리팩터링
