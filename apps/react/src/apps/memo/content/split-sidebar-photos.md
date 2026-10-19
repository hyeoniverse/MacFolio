---
title: 폴더 사이드바와 휴대폰 사진 앱을 조각으로
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 메모의 폴더 사이드바(697줄)와 휴대폰 사진 앱(662줄)을 각각 345줄·337줄 본체와 조각으로 나눴다. 둘이 함께 쓰는 타입은 셋째 model 파일에 두어 순환 import를 피했고, 조각마다 import는 스크립트로 계산했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 두 번째. [데모 파일](/memo/split-creative-demos)에 이어 메모의 폴더 사이드바와 휴대폰 사진 앱.

## 왜 이 두 파일인가

2단계의 기준은 단순했다. 한 파일이 여러 컴포넌트를 품고 있어, 한 부분을 고치려 해도 수백 줄을 위아래로 오가야 하는 파일이다. 이 둘은 600줄을 넘었다. 폴더 사이드바는 본체 말고도 폴더 한 줄(200줄), 이름 입력, 끌어 놓기 훅을 품고 있었고, 휴대폰 사진 앱은 크게 보기 화면(236줄)이 파일의 3분의 1을 차지했다.

나누는 기준도 정했다.

| 방법                                                        | 장점                       | 단점                                         |
| ----------------------------------------------------------- | -------------------------- | -------------------------------------------- |
| 그대로 두고 접기·목차 주석으로 버틴다                       | 바꿀 것이 없다             | 고칠 때마다 같은 파일이 충돌하고 diff가 길다 |
| 기능(훅·스타일·타입)별로 나눈다                             | 파일 종류가 분명하다       | 한 화면을 고치려면 여러 폴더를 오간다        |
| 화면 조각(컴포넌트)별로 나누고, 함께 쓰는 것만 model 파일로 | 고칠 곳 = 보이는 조각 하나 | 조각끼리 타입을 나눌 때 순환이 생기기 쉽다   |

세 번째를 골랐다. 순환은 아래처럼 model 파일 하나로 막는다.

## 폴더 사이드바

`FolderSidebar.tsx` 697줄 안에 폴더 한 줄(`FolderRow`, 200줄), 이름 입력, 끌어 놓기 훅, 그리고 사이드바 본체가 있었다. `FolderRow`는 사이드바 props 타입을 `Omit<Props, …>`로 빌려 쓰고 있어서, 그냥 파일을 나누면 `FolderRow`가 `FolderSidebar`를 import하고 `FolderSidebar`가 `FolderRow`를 그리는 순환이 된다. [지난 글](/memo/break-import-cycles)의 규칙대로 둘이 함께 쓰는 것(`DragItem`, `FolderSidebarProps`, 깊이 상한 안내 문장)을 `folderSidebar.model.ts`에 두었다.

```
memo/components/
├── FolderSidebar.tsx        본체 (345줄)
├── FolderRow.tsx            폴더 한 줄, ••• 메뉴, ≡ 손잡이
├── FolderNameInput.tsx      폴더 아이콘, 이름 입력
├── useDropTarget.ts         끌어 놓기 대상 (맨 위·휴지통·폴더 줄)
└── folderSidebar.model.ts   DragItem, FolderSidebarProps
```

`DragItem`을 밖에서 쓰는 곳(`useNoteDrag.ts`)은 경로만 바꿨다.

model 파일의 첫 줄에는 이 파일이 왜 있는지를 적었다. 나중에 누군가 "타입 하나 때문에 파일이 따로 있네" 하고 다시 합치지 않게 하려는 것이다.

```ts
// 폴더 사이드바(FolderSidebar)와 폴더 줄(FolderRow)이 함께 쓰는 타입. 둘이 서로 import하지 않게 여기에 둔다
export type DragItem = { type: 'post' | 'folder' | 'deleted'; id: string };

export interface FolderSidebarProps {
	canEdit: boolean;
	// ...
}
```

![그냥 나누면 FolderSidebar와 FolderRow가 서로 import하고, 타입을 model 파일로 빼면 순환이 없다](./images/split-sidebar-photos-cycle.svg '함께 쓰는 타입을 셋째 파일에 두어 순환을 피했다')

## 휴대폰 사진 앱

`PhotosMobile.tsx` 662줄에는 크게 보기 화면(`PhoneViewer`, 236줄)과 격자·선반·카드, 본체가 있었다. 크게 보기는 본체와 상태를 주고받지만 안쪽은 독립이라 `PhoneViewer.tsx`로, 격자·선반·카드는 `PhotoGrid.tsx`로, 셋이 함께 쓰는 타입과 목록 계산(`VIDEOS`, `keyOf`, `searchPhotos`)은 `photosMobile.model.ts`로.

```
photos/
├── PhotosMobile.tsx         본체: 탭·검색·상태 (337줄)
├── PhoneViewer.tsx          크게 보기 (249줄)
├── PhotoGrid.tsx            격자·선반·카드 (62줄)
└── photosMobile.model.ts    VIDEOS, keyOf, searchPhotos (24줄)
```

![두 파일의 나누기 전후 줄 수 막대](./images/split-sidebar-photos-lines.svg '가장 큰 파일이 절반으로')

## 나누는 도구

파일을 줄 범위로 자르고, 조각마다 필요한 import를 계산하는 작은 스크립트를 썼다. 원본의 import 목록에서 그 조각이 실제로 쓰는 이름만 남기고, 다른 조각의 정의를 쓰면 그쪽에 `export`를 붙이고 가져온다. 사람이 하면 import를 빠뜨리거나 남기기 쉬운데, 이렇게 하면 `tsc`와 ESLint가 남은 것을 잡아 준다. 실제로 주석에 적힌 `ALL_CATEGORY`를 쓰는 것으로 오인해 import가 하나 남았고, ESLint의 `no-unused-vars`가 바로 알려 줬다.

## 확인

- 동작을 바꾸지 않는 이동이라, 따로 새 시험을 쓰지 않고 기존 시험이 그대로 통과하는지를 봤다. 메모 E2E(폴더 만들기·이름 바꾸기·끌어 옮기기·휴대폰 편집)와 휴대폰 사진 E2E(격자·크게 보기·검색)가 그것이다.
- CI의 순환 의존 검사(`pnpm cycles`, madge)가 `apps/react/src`에서 순환이 없다고 답했다. model 파일을 두지 않았다면 여기서 걸렸을 것이다.
- 변경은 11파일, 754줄 추가와 691줄 삭제다. 합이 63줄 늘어난 것은 조각마다 import와 export가 새로 생겼기 때문이다.

## 남은 것·배운 것

- 줄 수를 줄이는 것이 목적은 아니다. 합은 오히려 늘었다. 목적은 "고칠 곳을 찾는 시간"을 줄이는 것이다.
- 두 파일이 서로 필요한 것이 생기면 둘 중 하나에 두지 말고 셋째 파일로 뺀다. 이 규칙은 지난 글(/memo/break-import-cycles)에서 정한 것이다.
- 기계적인 일(import 계산)은 스크립트에 맡기고, 사람은 "어디서 자를지"만 정한다. 스크립트가 틀린 곳은 `tsc`와 ESLint가 잡아 준다.

## 관련 글

- 2단계 첫 번째, 데모 파일 나누기: /memo/split-creative-demos
- 순환 import를 끊는 규칙: /memo/break-import-cycles
- 리팩터링 2단계 정리: /memo/refactor-step2-structure
- PR: https://github.com/hyeoniverse/MacFolio/pull/190

#MacFolio #리팩터링 #React
