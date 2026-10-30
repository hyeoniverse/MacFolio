---
title: shared/ui 사용처 집계로 추출할 공통 컴포넌트 후보 줄이기
date: 2026-10-11
category: 개발 기록/MacFolio/스타일·컴포넌트
series: 공통 UI 컴포넌트
seriesOrder: 4
summary: 리팩터링 4단계의 첫 작업은 코드를 바꾸지 않고 집계하는 일이었다. shared/ui 부품 15개의 props와 사용처, 새 부품 후보 9개, 직접 작성한 버튼 295곳을 집계해 docs/ui.md에 기록했고, 추출할 부품은 Sheet·Modal·SearchField 세 개로 줄였다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 4단계 "공통 컴포넌트 설계"의 첫 항목은 "지금 있는 것 정리: Button, IconButton, Menu, Popover, Dialog, Reorder의 props와 사용처 목록"이다. [브랜드 타입](/memo/branded-ids)으로 1단계를 끝낸 다음에 시작했다. 결과물은 코드가 아니라 문서 하나, [`docs/ui.md`](https://github.com/hyeoniverse/MacFolio/blob/main/docs/ui.md)다.

## 집계부터 한 이유

4단계의 둘째 항목에는 새로 추출할 부품 아홉 개가 적혀 있다. `Sheet`, `Modal`, `ListRow`, `SegmentedControl`, `SearchField`, `Switch`, `EmptyState`, `Toolbar`, `Sidebar`. 그런데 이 가운데 다섯 개는 열흘 전 [글자 버튼 글](/memo/shared-text-button)에서 "만들지 않는다"고 결정한 것이다. 결정 근거는 셋이었다.

- 사용처가 한 곳뿐이다 (`Switch`)
- 감쌀 공통 마크업이 없다 (`EmptyState`)
- 겉모양은 같아도 스크린 리더에 전달되는 역할(role)이 다르다 (`SegmentedControl`: 탭 목록과 라디오 그룹)

그 뒤로 Finder, 사진·음악 휴대폰 화면, 메일 휴대폰 시트가 추가됐다. 사용처 수가 바뀌었으니 결정도 다시 검토해야 한다. 그래서 첫 항목은 코드를 바꾸지 않고, 현재 부품과 후보의 사용처 수를 기록하는 문서로 정했다.

## 집계 방법

도구는 `grep`이다. 부품마다 그 부품을 import하는 줄이 있는 파일 수를 집계했다[^1].

```sh
grep -rln "from '@/shared/ui/menu/Menu'" --include=*.tsx apps/react/src | wc -l
```

후보는 단계가 하나 더 필요했다. 예를 들어 `Modal` 후보는 `role="dialog"`를 붙인 파일을 찾은 뒤, 그중 Esc를 직접 처리하는 파일(`'Escape'`)과 바깥 클릭을 직접 판별하는 파일(`event.target === event.currentTarget`)을 따로 집계했다. 숫자만으로는 오판하기 쉬워서, 검색된 파일은 모두 열어 실제로 같은 동작을 하는지 확인했다. "이 Mac에 관하여" 창이 `role="dialog"`인데도 모달이 아니라는 사실은 이 확인 과정에서 발견했다([Modal 추출 글](/memo/ui-modal)).

## 현재 부품 15개

`shared/ui`에는 부품이 열다섯 개 있다.

| 분류               | 부품                                                         |
| ------------------ | ------------------------------------------------------------ |
| 버튼               | `Button`, `IconButton`, `SidebarToggle`                      |
| 메뉴와 떠 있는 창  | `Menu`, `useDismiss`, `placement`, `shortcut`, `AlertDialog` |
| 애니메이션         | `useExitMotion`, `useMoveDirection`                          |
| 드래그로 순서 변경 | `startPointerReorder`                                        |
| 그 밖              | `ShareIcon`, `Turnstile`, `WebFrame`                         |

사용처가 가장 많은 부품은 `Menu`(30파일)였고, 그다음은 `IconButton` 15, `useExitMotion` 15, `Button` 10, `AlertDialog` 10 순이다. props는 문서에 표로 기록했다.

기록하면서 중복 하나를 발견했다. 메뉴 막대의 소리 창과 메모의 날짜 선택기가 `placement`(위치 계산)·`useDismiss`(바깥 클릭·Esc로 닫기)·`useExitMotionRef`(닫힘 애니메이션) 세 부품을 똑같이 조립하고 있었다. 메모의 `usePopover`가 바로 이 조립인데, `apps/memo/writer/`에 있어서 다른 앱은 가져다 쓸 수 없다. 사용처가 한 곳 더 생기면 `shared/ui/popover/`로 옮긴다는 조건을 문서에 기록했다.

## 후보 아홉 개 재검토

![후보 아홉 개의 사용처 수와 결정](./images/ui-inventory-candidates.svg '막대 길이는 따로 구현한 곳의 수. 길다고 추출하지는 않는다')

| 후보               | 따로 구현한 곳                                     | 결정 |
| ------------------ | -------------------------------------------------- | ---- |
| `Sheet`            | 메일 휴대폰 2, 음악 휴대폰 1                       | 추출 |
| `Modal`            | 단축키 창, 이 Mac에 관하여, 로그인 결과, Launchpad | 추출 |
| `SearchField`      | Finder 2, 메시지, 날씨, 사진 휴대폰 (메모는 별도)  | 추출 |
| `Switch`           | 설정 2                                             | 보류 |
| `SegmentedControl` | 탭 5, 라디오 2, 눌림 상태 버튼 1                   | 보류 |
| `EmptyState`       | 10파일                                             | 보류 |
| `ListRow`          | 메모·메일·메시지·음악·Finder                       | 보류 |
| `Toolbar`          | 12파일                                             | 보류 |
| `Sidebar`          | 10파일                                             | 보류 |

막대가 가장 긴 `Toolbar`·`Sidebar`·`EmptyState`는 보류이고, 막대가 짧은 `Sheet`는 추출 대상이다. 사용처 수가 아니라 **구현이 같은가**를 기준으로 결정했기 때문이다.

![사용처가 둘 이상인지, 겉모양과 동작이 같은지, 역할이 같은지를 차례로 판단한 순서](./images/ui-inventory-decide.svg '후보를 결정한 순서')

- **`Sheet`**: 세 곳이 "아래에서 올라오는 레이어, 바깥을 누르면 내려가며 닫힘, `role="dialog"`"를 각자 구현하고 있다. 안쪽 내용은 다르지만 겉은 같다. 겉만 부품으로 만들고 안쪽은 `children`으로 받으면 된다.
- **`Modal`**: 화면 가운데 뜨는 창 네 개가 Esc와 바깥 클릭을 각자 처리한다(Esc를 직접 처리하는 파일 8개, 바깥 클릭을 판별하는 파일 6개). 기존 `AlertDialog`의 바깥 틀이 이미 그 일을 하므로, 이 틀을 `Modal`로 분리하고 `AlertDialog`가 `Modal`을 사용하게 하면 된다.
- **`SearchField`**: 지난번에는 "메모와 메시지가 다르다"는 이유로 보류했다. 현재 `<input type="search">`[^2]가 여섯 곳이고, 메모를 제외한 다섯 곳은 돋보기 아이콘·placeholder·`aria-label`이 있는 입력 칸 하나로 구조가 같다. 메모만 검색 조건 칩과 조건 메뉴가 있어 다르다. 다섯 곳을 합치고 메모는 그대로 두기로 했다.

반대로 `Toolbar`는 12파일이지만 높이와 여백이 앱마다 다르고, 창 제목 막대와 합쳐진 앱(메모·Finder)과 분리된 앱(메일·메시지)이 섞여 있다. 지금 합치면 그 차이를 모두 받아 주는 옵션이 늘어난다. 5단계에서 높이·여백을 디자인 토큰으로 통일한 뒤 다시 집계하기로 했다. `Sidebar`와 `EmptyState`도 같은 이유로 보류했다.

## 직접 작성한 버튼 295곳 집계

`Button`·`IconButton`이 있는데도 `<button>`을 직접 작성한 곳이 89파일 295곳 남아 있었다. 3·4단계에서 옮긴 것은 당시 발견한 아이콘 버튼 4종·글자 버튼 6종이었고, 앱마다 흩어진 개별 버튼은 손대지 않았기 때문이다. 295곳을 하나씩 분류했다.

| 분류                                                                             | 곳     |
| -------------------------------------------------------------------------------- | ------ |
| Safari 프로젝트 데모 페이지 (다른 사이트의 디자인을 재현한 화면이라 그대로 유지) | 67     |
| `IconButton`으로 전환 가능 (뒤로 가기, •••, 원형 버튼, 음악 재생 버튼 등)        | 약 60  |
| `Button`으로 전환 가능 (완료·취소·비우기·되돌리기 등)                            | 약 33  |
| 앱 고유 (목록 행, 탭, 카드, 썸네일, 타일, 달력 칸)                               | 약 135 |

전환 가능한 93곳은 4단계 마지막 항목에서 PR 두 개로 옮기기로 했다. 집계 중에 추가로 두 가지를 발견했다.

- 날씨 앱의 사이드바 여닫기 버튼 두 개가 기존 `SidebarToggle`을 사용하지 않고 있었다.
- 떠 있지 않은 원형 버튼(메일 시트의 취소·보내기, 사진, Safari 휴대폰)이 12곳인데, `IconButton`의 `float`(그림자가 있는 떠 있는 원형)와 비슷하지만 그림자가 없다. `variant="circle"`을 하나 추가하면 12곳을 한 번에 전환할 수 있다.

<details>
<summary>버튼 집계 명령</summary>

`apps/react/src`의 `.tsx`에서 `<button`이 있는 줄을 집계한다. 시험 파일(`*.test.tsx`)과 공통 부품 디렉터리(`shared/ui`)는 제외한다. `docs/ui.md`에 같은 명령을 기록했다.

```sh
git grep -c '<button' -- 'apps/react/src/**/*.tsx' ':!*.test.tsx' ':!apps/react/src/shared/ui/**'
```

</details>

## 다음 단계

추출 대상이 `Sheet`·`Modal`·`SearchField` 세 개로 줄었다. 다음 PR은 `Modal`부터다. `AlertDialog`에서 바깥 틀을 분리하는 작업이라 새로 작성할 코드가 가장 적고, 창 네 개를 바로 전환할 수 있다.

이 PR([#210](https://github.com/hyeoniverse/MacFolio/pull/210))은 코드를 한 줄도 바꾸지 않았다. 변경 내역은 다음과 같다(5파일, 207줄 추가).

| 파일                                 | 추가 줄 수 |
| ------------------------------------ | ---------- |
| `docs/ui.md`                         | 99         |
| `ui-inventory.md` (이 글)            | 63         |
| `images/ui-inventory-candidates.svg` | 43         |
| `README.md`, `CONTRIBUTING.md`       | 각 1       |

## 이후 진행 결과

목록을 작성한 뒤 일주일 동안 4단계를 마무리했다. 이 문서에서 결정한 내용이 그대로 PR이 됐다.

| 문서에서 결정한 것                        | 결과                                                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Modal`을 먼저 추출한다                   | 가운데 창 다섯 개를 전환했다. 이 Mac에 관하여는 모달이 아니라서 제외했고, 경고창·이름 바꾸기가 추가됐다 ([#212](https://github.com/hyeoniverse/MacFolio/pull/212), [글](/memo/ui-modal)) |
| `Sheet`를 추출한다                        | 메일 2곳, 음악 1곳을 전환했다 ([#220](https://github.com/hyeoniverse/MacFolio/pull/220), [글](/memo/ui-sheet))                                                                           |
| `SearchField`를 추출하고 메모는 유지한다  | 추출했다 ([#223](https://github.com/hyeoniverse/MacFolio/pull/223)). 현재 앱 쪽 7파일이 사용한다                                                                                         |
| `usePopover`는 한 곳 더 생기면 옮긴다     | 현재 `shared/ui/popover/`에 `placement`·`useDismiss`가 있다                                                                                                                              |
| `IconButton`·`Button`으로 93곳을 전환한다 | 아이콘 버튼([#245](https://github.com/hyeoniverse/MacFolio/pull/245))과 글자 버튼([#246](https://github.com/hyeoniverse/MacFolio/pull/246))을 PR 두 개로 전환했다                        |
| `variant="circle"`을 추가한다             | #245에서 추가했다                                                                                                                                                                        |

이 글을 쓰면서 다시 집계한 결과, `IconButton`을 사용하는 파일은 15개에서 34개로, `Button`은 10개에서 25개로 늘었다. 직접 작성한 `<button>`을 처음과 같은 방법으로 집계하면 현재 95파일 289곳이고, 그중 95곳이 Safari 프로젝트 데모 페이지다(그사이 데모 페이지가 늘었다). 데모 페이지를 제외하면 228곳에서 194곳으로 줄었다. 남은 곳은 대부분 표에서 "앱 고유"로 분류한 목록 행·탭·카드이고, 그사이 새로 추가된 화면의 버튼도 포함돼 있다.

## 다시 집계한 계기

10월 11일 새벽에 올린 이 문서의 첫 판에는 두 가지 지적이 있었다.

1. "보류. 수가 많아도 모양·뜻이 다르다"로 기록한 후보는 모양을 통일하면 되는 것 아닌가.
2. 버튼이 공통 컴포넌트의 기본인데 왜 후보에 없는가.

두 번째 지적에 따라 버튼을 직접 집계했고, 그 결과가 위의 "직접 작성한 버튼 295곳 집계" 절이다. 집계 결과를 PR 본문에도 기록했다.

## 배운 것

- 리팩터링 계획의 후보 목록은 계획을 작성한 날의 코드 기준이다. 실행 직전에 다시 집계하면 결정이 바뀐다. 이번에는 열흘 사이에 화면이 네 개 늘었다.
- 사용처가 많다고 추출할 이유가 되지는 않는다. 겉모양과 역할이 다르면 공통 부품은 옵션 덩어리가 된다. `Toolbar` 12파일보다 `Sheet` 3곳이 먼저였다.
- 집계 결과를 문서로 남기면 이후 PR의 근거가 한곳에 모인다. 이후 PR마다 `docs/ui.md`의 해당 표를 함께 수정했다.

## 관련 글

- [PostSlug·FolderPath 브랜드 타입과 검사 지점으로 글 주소 문자열 구분하기](/memo/branded-ids): 1단계를 끝낸 글
- [계산된 스타일과 스크린샷 비교로 검증한 공통 Button 추출](/memo/shared-text-button): 열흘 전 "만들지 않는다"고 결정한 글
- [계산된 스타일 비교로 검증한 공통 버튼 컴포넌트 교체](/memo/refactor-step4-components): 4단계 정리
- [오버레이·포커스·Esc 처리를 공통 Modal 컴포넌트로 추출하기](/memo/ui-modal)
- [오버레이·닫기·role을 공통 Sheet 컴포넌트로 추출하고 모양은 variant로 나누기](/memo/ui-sheet)
- PR: [#210](https://github.com/hyeoniverse/MacFolio/pull/210)

[^1]: `grep -l`은 일치하는 줄 대신 일치하는 파일 이름만 출력한다. `wc -l`로 그 줄 수를 집계하면 파일 수가 된다.

[^2]: 검색어 입력에 쓰는 input 종류. [MDN: `<input type="search">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/search)

#MacFolio #공통컴포넌트 #리팩터링
