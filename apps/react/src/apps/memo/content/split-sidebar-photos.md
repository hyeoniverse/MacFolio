---
title: 폴더 사이드바와 휴대폰 사진 앱을 조각으로
date: 2026-10-10
category: 인프라/배포·운영
summary: 메모의 폴더 사이드바(697줄)와 휴대폰 사진 앱(662줄)을 나눴다. 사이드바는 폴더 한 줄·이름 입력·끌어 놓기 훅·공통 타입으로, 사진 앱은 격자·크게 보기·상태 타입으로. 두 파일이 같이 쓰는 타입은 둘 중 하나가 아니라 셋째 파일에 두는 규칙을 그대로 따랐다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 두 번째. [데모 파일](/memo/split-creative-demos)에 이어 메모의 폴더 사이드바와 휴대폰 사진 앱.

## 폴더 사이드바

`FolderSidebar.tsx` 697줄 안에 폴더 한 줄(`FolderRow`, 200줄), 이름 입력, 끌어 놓기 훅, 그리고 사이드바 본체가 있었다. `FolderRow`는 사이드바 props 타입을 `Omit<Props, …>`로 빌려 쓰고 있어서, 그냥 파일을 나누면 `FolderRow`가 `FolderSidebar`를 import하고 `FolderSidebar`가 `FolderRow`를 그리는 순환이 된다. [지난 글](/memo/break-import-cycles)의 규칙대로 둘이 함께 쓰는 것(`DragItem`, `FolderSidebarProps`, 깊이 상한 안내 문장)을 `folderSidebar.model.ts`에 두었다.

```
memo/components/
├── FolderSidebar.tsx        본체 (339줄)
├── FolderRow.tsx            폴더 한 줄, ••• 메뉴, ≡ 손잡이
├── FolderNameInput.tsx      폴더 아이콘, 이름 입력
├── useDropTarget.ts         끌어 놓기 대상 (맨 위·휴지통·폴더 줄)
└── folderSidebar.model.ts   DragItem, FolderSidebarProps
```

`DragItem`을 밖에서 쓰는 곳(`useNoteDrag.ts`)은 경로만 바꿨다.

## 휴대폰 사진 앱

`PhotosMobile.tsx` 662줄에는 크게 보기 화면(`PhoneViewer`, 236줄)과 격자·선반·카드, 본체가 있었다. 크게 보기는 본체와 상태를 주고받지만 안쪽은 독립이라 `PhoneViewer.tsx`로, 격자·선반·카드는 `PhotoGrid.tsx`로, 셋이 함께 쓰는 타입과 목록 계산(`VIDEOS`, `keyOf`, `searchPhotos`)은 `photosMobile.model.ts`로.

## 나누는 도구

파일을 줄 범위로 자르고, 조각마다 필요한 import를 계산하는 작은 스크립트를 썼다. 원본의 import 목록에서 그 조각이 실제로 쓰는 이름만 남기고, 다른 조각의 정의를 쓰면 그쪽에 `export`를 붙이고 가져온다. 사람이 하면 import를 빠뜨리거나 남기기 쉬운데, 이렇게 하면 `tsc`와 ESLint가 남은 것을 잡아 준다. 실제로 주석에 적힌 `ALL_CATEGORY`를 쓰는 것으로 오인해 import가 하나 남았고, ESLint의 `no-unused-vars`가 바로 알려 줬다.

#MacFolio #리팩터링 #React
