---
title: 공통 부품 목록을 먼저 적고, 아홉 후보를 다시 쟀다
date: 2026-10-11
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 4단계의 첫 일은 코드를 바꾸지 않고 세는 것이었다. shared/ui 부품 15개의 props와 쓰는 곳, 새 부품 후보 9개, 직접 쓴 버튼 295곳을 세어 docs/ui.md에 적었고, 뽑을 것은 Sheet·Modal·SearchField 셋으로 줄였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 "공통 컴포넌트 설계"의 첫 항목, "지금 있는 것 정리: Button, IconButton, Menu, Popover, Dialog, Reorder의 props와 사용처 목록". [브랜드 타입](/memo/branded-ids)으로 1단계를 끝낸 다음이다.

## 왜 세는 일부터

4단계의 둘째 항목에는 새로 뽑을 부품 아홉 개가 적혀 있다. `Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`. 그런데 이 가운데 다섯은 열흘 전 [글자 버튼 글](/memo/shared-text-button)에서 "만들지 않는다"고 정한 것이다. 쓰는 곳이 하나뿐이거나(Switch), 감쌀 것이 없거나(EmptyState), 겉은 같아도 스크린 리더에게 뜻이 다르거나(SegmentedControl).

그 뒤로 Finder, 사진·음악 휴대폰 화면, 메일 휴대폰 시트가 생겼다. 수가 바뀌었으니 판단도 다시 해야 한다. 그래서 첫 항목은 코드를 바꾸지 않고, 지금 있는 것과 후보의 수를 적는 문서 하나다. `docs/ui.md`.

## 어떻게 셌나

도구는 `grep`이다. 부품마다 그 부품을 불러오는 줄이 있는 파일 수를 셌다.

```sh
grep -rln "from '@/shared/ui/menu/Menu'" --include=*.tsx apps/react/src | wc -l
```

후보는 조금 더 손이 갔다. 예를 들어 `Modal` 후보는 `role="dialog"`를 붙인 곳을 찾은 뒤, 그중 Esc를 직접 처리하는 파일(`'Escape'`)과 바깥 누르기를 직접 구분하는 파일(`event.target === event.currentTarget`)을 따로 셌다. 수만 보면 틀리기 쉬워서, 나온 파일은 모두 열어 정말 같은 일을 하는지 읽었다. "이 Mac에 관하여"가 `role="dialog"`인데도 모달이 아니라는 것은 이렇게 읽다가 알았다(/memo/ui-modal).

## 지금 있는 것

`shared/ui`에는 부품이 열다섯 있다. 버튼 셋(`Button`·`IconButton`·`SidebarToggle`), 메뉴와 떠 있는 창(`Menu`·`useDismiss`·`placement`·`shortcut`·`AlertDialog`), 움직임(`useExitMotion`·`useMoveDirection`), 끌어서 순서 바꾸기(`startPointerReorder`), 그리고 `ShareIcon`·`Turnstile`·`WebFrame`.

쓰는 곳을 세어 보니 가장 많이 쓰이는 것은 `Menu`(30파일)였고, `IconButton` 15, `useExitMotion` 15, `Button` 10, `AlertDialog` 10 순이다. props는 문서에 표로 적었다. 적으면서 하나 눈에 띈 것이 있다. 메뉴 막대의 소리 창과 메모의 날짜 고르기가 `placement`·`useDismiss`·`useExitMotionRef` 세 부품을 똑같이 조립하고 있었다. 메모의 `usePopover`가 바로 그 조립인데 `apps/memo/writer/`에 있어서 다른 앱이 모른다. 한 곳만 더 생기면 `shared/ui/popover/`로 올린다고 적어 두었다.

## 아홉 후보를 다시 재다

![후보 아홉의 수와 정한 것](./images/ui-inventory-candidates.svg '막대 길이는 따로 만든 곳의 수. 길다고 뽑는 것이 아니다')

| 후보               | 따로 만든 곳                                       | 정한 것 |
| ------------------ | -------------------------------------------------- | ------- |
| `Sheet`            | 메일 휴대폰 둘, 음악 휴대폰 하나                   | 뽑는다  |
| `Modal`            | 단축키 창, 이 Mac에 관하여, 로그인 결과, Launchpad | 뽑는다  |
| `SearchField`      | Finder 둘, 메시지, 날씨, 사진 휴대폰 (메모는 따로) | 뽑는다  |
| `Switch`           | 설정 둘                                            | 보류    |
| `SegmentedControl` | 탭 5, 라디오 2, 눌린 버튼 1                        | 보류    |
| `EmptyState`       | 10파일                                             | 보류    |
| `ListRow`          | 메모·메일·메시지·음악·Finder                       | 보류    |
| `Toolbar`          | 12파일                                             | 보류    |
| `Sidebar`          | 10파일                                             | 보류    |

막대가 가장 긴 `Toolbar`·`Sidebar`·`EmptyState`가 보류이고, 짧은 `Sheet`가 뽑는 쪽이다. 수가 아니라 **같은가**로 정했기 때문이다.

![따로 만든 곳이 둘 이상인지, 겉과 동작이 같은지, 뜻이 같은지를 차례로 물어 정한 순서](./images/ui-inventory-decide.svg '후보를 정한 순서')

`Sheet`는 세 곳이 "아래에서 올라오는 레이어, 바깥을 누르면 내려가며 닫힘, `role="dialog"`"를 저마다 적고 있다. 안에 들어가는 것은 다르지만 겉은 같다. 겉만 받고 안은 `children`으로 두면 된다. `Modal`도 같다. 가운데 뜨는 창 넷이 Esc와 바깥 누르기를 따로 적는다 (Esc를 직접 처리하는 파일이 8개, 바깥 누르기가 6개). 이미 있는 `AlertDialog`의 겉이 그 일을 하고 있으니, 그것을 `Modal`로 떼고 `AlertDialog`가 `Modal`을 쓰게 하면 된다.

`SearchField`는 지난번에 "메모와 메시지가 다르다"고 보류했던 것이다. 지금은 `type="search"`가 여섯 곳이고, 메모를 뺀 다섯은 돋보기·placeholder·aria-label이 있는 칸 하나로 같다. 메모만 칩과 조건 메뉴가 있어 다르다. 다섯을 합치고 메모는 그대로 두기로 했다.

반대로 `Toolbar`는 12파일이나 되지만 높이와 여백이 앱마다 다르고, 창 제목 막대와 합쳐진 앱(메모·Finder)과 따로인 앱(메일·메시지)이 있다. 지금 합치면 그 차이를 다 받는 옵션이 생긴다. 5단계에서 높이·여백을 토큰으로 맞춘 다음에 다시 재는 것이 맞다. `Sidebar`와 `EmptyState`도 같은 이유다.

## 버튼 295곳도 셌다

`Button`·`IconButton`이 있는데도 `<button>`을 직접 쓰는 곳이 89파일 295곳 남아 있다. 지난 3·4단계에서 옮긴 것은 그때 눈에 띈 아이콘 버튼 4벌·글자 버튼 6벌이었고, 앱마다 흩어진 낱개 버튼은 손대지 않았기 때문이다. 이것도 하나씩 나눴다.

| 구분                                                                           | 곳     |
| ------------------------------------------------------------------------------ | ------ |
| Safari 프로젝트 데모 페이지 (다른 사이트 모양을 흉내 낸다, 그대로 둔다)        | 67     |
| `IconButton`으로 옮길 수 있음 (뒤로 가기, •••, 동그란 버튼, 음악 재생 버튼 등) | 약 60  |
| `Button`으로 옮길 수 있음 (완료·취소·비우기·되돌리기 등)                       | 약 33  |
| 그 앱 고유 (목록 줄, 탭, 카드, 썸네일, 타일, 달력 칸)                          | 약 135 |

옮길 수 있는 93곳은 4단계 마지막 항목에서 PR 둘로 옮긴다. 세다가 둘을 더 찾았다. 날씨의 사이드바 여닫기 버튼 둘은 이미 있는 `SidebarToggle`을 안 쓰고 있었고, 떠 있지 않은 동그란 버튼(메일 시트 취소·보내기, 사진, Safari 휴대폰)이 12곳인데 `IconButton`의 `float`와 비슷하면서 떠 있지는 않다. `variant="circle"`을 하나 더 두면 12곳이 한 번에 옮겨 간다.

## 둘째 항목은

뽑을 것이 `Sheet`·`Modal`·`SearchField` 셋으로 줄었다. 다음 PR은 `Modal`부터다. `AlertDialog`에서 겉을 떼는 일이라 새 코드가 가장 적고, 창 넷이 바로 옮겨 간다.

이 PR은 코드를 한 줄도 바꾸지 않았다. 바뀐 것은 `docs/ui.md`(99줄 추가)와 이 글, 도식뿐이다(5파일, 207줄 추가).

## 그 뒤에 어떻게 됐나

목록을 적은 뒤 일주일 동안 4단계를 끝냈다. 이 문서에서 정한 것이 그대로 PR이 됐다.

| 문서에서 정한 것                        | 결과                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Modal`을 먼저 뽑는다                   | 가운데 창 다섯을 옮겼다. 이 Mac에 관하여는 모달이 아니라 빠졌고, 경고창·이름 바꾸기가 들어갔다 (/memo/ui-modal) |
| `Sheet`를 뽑는다                        | 메일 둘, 음악 하나를 옮겼다 (/memo/ui-sheet)                                                                    |
| `SearchField`, 메모는 그대로            | 뽑았다. 지금 앱 쪽에서 7파일이 쓴다                                                                             |
| `usePopover`는 한 곳 더 생기면 올린다   | 지금 `shared/ui/popover/`에 `placement`·`useDismiss`가 있다                                                     |
| `IconButton`·`Button`으로 93곳을 옮긴다 | 아이콘 버튼과 글자 버튼을 두 PR로 옮겼다 (/memo/icon-button-migrate, /memo/text-button-migrate)                 |
| `variant="circle"`을 더한다             | 더했다                                                                                                          |

이 글을 쓰며 다시 세어 보니 `IconButton`을 쓰는 파일은 15개에서 34개로, `Button`은 10개에서 25개로 늘었다. 직접 쓴 `<button>`을 처음과 같은 방법(`.tsx`에서 `<button`이 있는 줄, 시험 파일과 `shared/ui` 제외)으로 세면 지금 95파일 289곳이고, 그중 95곳이 Safari 프로젝트 데모 페이지다(그사이 데모 페이지가 늘었다). 데모를 빼면 228곳에서 194곳으로 줄었다. 남은 곳은 대부분 표에서 "그 앱 고유"로 나눈 목록 줄·탭·카드이고, 그사이 새로 생긴 화면의 버튼도 섞여 있다.

## 배운 것

- 리팩터링 계획의 후보 목록은 그 계획을 적은 날의 코드 기준이다. 실행하기 직전에 다시 세면 판단이 바뀐다. 이번에는 열흘 사이에 화면이 넷 늘었다.
- 수가 많다고 뽑을 일은 아니다. 겉과 뜻이 다르면 공통 부품은 옵션 덩어리가 된다. `Toolbar` 12파일보다 `Sheet` 3곳이 먼저였다.
- 세는 일 자체를 문서로 남기면 다음 PR들의 근거가 한곳에 모인다. 이후 PR마다 `docs/ui.md`의 해당 표를 함께 고쳤다.

## 관련 글

- 1단계를 끝낸 브랜드 타입: /memo/branded-ids
- 열흘 전 "만들지 않는다"고 정한 글: /memo/shared-text-button
- 리팩터링 4단계 정리: /memo/refactor-step4-components
- PR: https://github.com/hyeoniverse/MacFolio/pull/210

#MacFolio #공통컴포넌트 #리팩터링
