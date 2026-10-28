---
title: import를 계산하는 분리 스크립트로 폴더 사이드바와 휴대폰 사진 앱 나누기
date: 2026-10-10
category: 개발 기록/MacFolio/설계
summary: 메모의 폴더 사이드바(697줄)와 휴대폰 사진 앱(662줄)을 각각 345줄·337줄 본체와 하위 컴포넌트로 분리했다. 두 파일이 함께 사용하는 타입은 별도 model 파일에 두어 순환 import를 방지했고, 파일마다 필요한 import는 스크립트로 계산했다.
---

이 글은 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "큰 파일 나누기"의 두 번째 작업 기록이다. [데모 파일](/memo/split-creative-demos)에 이어 메모의 폴더 사이드바와 휴대폰 사진 앱을 분리했다.

## 대상 파일 선정 기준

2단계의 기준은 하나였다. 한 파일이 여러 컴포넌트를 포함해, 한 부분을 수정하려 해도 수백 줄을 오가야 하는 파일이다. 두 파일 모두 600줄을 넘었다.

| 파일                | 줄 수 | 포함한 컴포넌트·훅                                             |
| ------------------- | ----- | -------------------------------------------------------------- |
| `FolderSidebar.tsx` | 697   | 사이드바 본체, 폴더 한 줄(200줄), 이름 입력, 끌어 놓기 훅      |
| `PhotosMobile.tsx`  | 662   | 본체, 크게 보기 화면(236줄, 파일의 약 3분의 1), 격자·선반·카드 |

분리 방법은 다음 세 가지를 비교했다.

| 방법                                                            | 장점                                    | 단점                                                  |
| --------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| 현재 파일을 유지하고 코드 접기·목차 주석으로 관리               | 변경할 코드가 없다                      | 수정할 때마다 같은 파일에서 충돌이 나고 diff가 길다   |
| 기능(훅·스타일·타입)별로 분리                                   | 파일 종류가 명확하다                    | 한 화면을 수정하려면 여러 폴더를 오가야 한다          |
| 화면 단위(컴포넌트)로 분리, 공유 코드만 model 파일로 (**채택**) | 수정 위치 = 화면에 보이는 컴포넌트 하나 | 컴포넌트끼리 타입을 공유할 때 순환 의존이 생기기 쉽다 |

세 번째 방법을 채택했다. 순환 의존은 아래처럼 model 파일 하나로 방지한다.

## 폴더 사이드바

`FolderSidebar.tsx` 697줄 안에 폴더 한 줄(`FolderRow`, 200줄), 이름 입력, 끌어 놓기 훅, 사이드바 본체가 있었다. `FolderRow`는 사이드바 props 타입을 `Omit<Props, …>`로 참조하고 있어서, 파일만 분리하면 `FolderRow`가 `FolderSidebar`를 import하고 `FolderSidebar`가 `FolderRow`를 렌더링하는 순환 의존이 생긴다. [madge로 찾은 순환 import를 셋째 파일과 manifest로 끊고 pnpm cycles로 CI에서 막기](/memo/break-import-cycles)의 규칙대로 두 파일이 함께 사용하는 코드(`DragItem`, `FolderSidebarProps`, 깊이 상한 안내 문장)를 `folderSidebar.model.ts`로 분리했다.

```
memo/components/
├── FolderSidebar.tsx        본체 (345줄)
├── FolderRow.tsx            폴더 한 줄, ••• 메뉴, ≡ 손잡이
├── FolderNameInput.tsx      폴더 아이콘, 이름 입력
├── useDropTarget.ts         끌어 놓기 대상 (맨 위·휴지통·폴더 줄)
└── folderSidebar.model.ts   DragItem, FolderSidebarProps
```

`DragItem`을 외부에서 사용하는 파일(`useNoteDrag.ts`)은 import 경로만 바꿨다.

model 파일의 첫 줄에는 파일의 존재 이유를 기록했다. 이후 "타입 몇 개 때문에 별도 파일이 있다"고 판단해 다시 합치는 일을 방지하기 위해서다.

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

`PhotosMobile.tsx` 662줄에는 크게 보기 화면(`PhoneViewer`, 236줄)과 격자·선반·카드, 본체가 있었다.

- 크게 보기는 본체와 상태를 주고받지만 내부 로직은 독립적이라 `PhoneViewer.tsx`로 분리했다.
- 격자·선반·카드는 `PhotoGrid.tsx`로 분리했다.
- 세 파일이 함께 사용하는 타입과 목록 계산(`VIDEOS`, `keyOf`, `searchPhotos`)은 `photosMobile.model.ts`로 분리했다.

```
photos/
├── PhotosMobile.tsx         본체: 탭·검색·상태 (337줄)
├── PhoneViewer.tsx          크게 보기 (249줄)
├── PhotoGrid.tsx            격자·선반·카드 (62줄)
└── photosMobile.model.ts    VIDEOS, keyOf, searchPhotos (24줄)
```

![두 파일의 나누기 전후 줄 수 막대](./images/split-sidebar-photos-lines.svg '가장 큰 파일이 절반으로')

## 분리 스크립트

파일을 줄 범위로 분할하고, 분할한 파일마다 필요한 import를 계산하는 작은 스크립트를 사용했다.

1. 사람이 분할할 줄 범위를 지정한다.
2. 원본의 import 목록에서 각 파일이 실제로 사용하는 이름만 남긴다.
3. 다른 분할 파일에 정의된 이름을 사용하면, 정의한 쪽에 `export`를 붙이고 import를 추가한다.
4. `tsc`와 ESLint로 남은 오류를 검출한다.

수작업으로 하면 import를 누락하거나 사용하지 않는 import를 남기기 쉽다. 실제로 스크립트가 주석에 적힌 `ALL_CATEGORY`를 사용 중인 이름으로 오인해 불필요한 import가 하나 남았고, ESLint의 [`no-unused-vars`](https://eslint.org/docs/latest/rules/no-unused-vars)가 즉시 검출했다.

## 확인

- 동작을 바꾸지 않는 코드 이동이라 새 시험을 작성하지 않고, 기존 시험이 그대로 통과하는지 확인했다. 메모 E2E(폴더 생성·이름 변경·끌어 옮기기·휴대폰 편집)와 휴대폰 사진 E2E(격자·크게 보기·검색)다.
- CI의 순환 의존 검사(`pnpm cycles`, [madge](https://github.com/pahen/madge))가 `apps/react/src`에 순환이 없다고 출력했다. model 파일이 없었다면 이 단계에서 실패했을 것이다.
- 변경은 11개 파일, 754줄 추가와 691줄 삭제다. 전체 줄 수가 63줄 늘어난 것은 분할한 파일마다 import와 export가 새로 생겼기 때문이다.

## 정리

- 목적은 줄 수 감소가 아니다. 전체 줄 수는 오히려 늘었다. 목적은 수정할 위치를 찾는 시간을 줄이는 것이다.
- 두 파일이 서로의 코드를 필요로 하면, 둘 중 한쪽에 두지 않고 세 번째 파일로 분리한다. 이 규칙은 [madge로 찾은 순환 import를 셋째 파일과 manifest로 끊고 pnpm cycles로 CI에서 막기](/memo/break-import-cycles)에서 정했다.
- 기계적인 작업(import 계산)은 스크립트가 처리하고, 사람은 분할 위치만 정한다. 스크립트의 오류는 `tsc`와 ESLint가 검출한다.

## 같은 방식으로 분리하는 절차

화면 코드는 먼저 상태 계산(`*.model.ts`)과 렌더링(컴포넌트)으로 분리하고, model은 React 없이 단위 시험한다. 확인 순서는 다음과 같다.

```bash
pnpm typecheck && pnpm lint
cd apps/react && npx vitest run src/apps/memo src/apps/photos
npx playwright test e2e/memo.spec.ts e2e/photos.spec.ts
cd ../.. && pnpm cycles      # model ↔ 컴포넌트 순환이 없는지
```

참고 문서: [madge](https://github.com/pahen/madge), [React: 상태 로직을 리듀서로 옮기기](https://react.dev/learn/extracting-state-logic-into-a-reducer).

## 관련 글

- [데모별 모듈과 공유 모듈로 1,861줄 HYEONIVERSE 데모 파일 분리하기](/memo/split-creative-demos): 2단계 첫 번째 작업
- [madge로 찾은 순환 import를 셋째 파일과 manifest로 끊고 pnpm cycles로 CI에서 막기](/memo/break-import-cycles): 순환 import를 끊는 규칙
- [madge 순환 의존 검사와 큰 파일 분할, 파일 이름 규칙 (리팩터링 2단계)](/memo/refactor-step2-structure)

PR: [#190](https://github.com/hyeoniverse/MacFolio/pull/190)

#MacFolio #리팩터링 #React
