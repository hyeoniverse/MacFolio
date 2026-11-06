---
title: 공유 코드 모듈·model 파일·index.ts 재내보내기로 큰 파일 분리하기
date: 2026-10-11
category: 개발 기록/MacFolio/구조·상태 관리
series: 모듈 구조
seriesOrder: 2
summary: 1,861줄 데모 파일, 600줄대 사이드바·사진 앱, 1,629줄 profile.ts를 분리했다. 둘 이상이 쓰는 코드만 공유 모듈로, 서로 쓰는 타입은 model 파일로 빼 순환을 막고, 폴더의 index.ts 재내보내기로 외부 import 27곳을 유지했다.
---

이 글은 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))에서 큰 파일을 분리한 작업 세 건의 기록이다. 2단계 "큰 파일 나누기"의 두 작업과, 1단계 세 번째 항목인 `shared/profile.ts` 분리를 함께 다룬다.

| 대상                                    | 전              | 후                            | 핵심 방법                         | PR                                                       |
| --------------------------------------- | --------------- | ----------------------------- | --------------------------------- | -------------------------------------------------------- |
| `CreativeDemos.tsx` (HYEONIVERSE 데모)  | 1,861줄 한 파일 | 15개 파일, 가장 큰 파일 401줄 | 둘 이상이 쓰는 코드만 공유 모듈로 | [#189](https://github.com/hyeoniverse/MacFolio/pull/189) |
| `FolderSidebar.tsx`, `PhotosMobile.tsx` | 697줄, 662줄    | 본체 345줄, 337줄             | 공유 타입을 model 파일로          | [#190](https://github.com/hyeoniverse/MacFolio/pull/190) |
| `shared/profile.ts`                     | 1,629줄 한 파일 | 12개 파일, 가장 큰 파일 668줄 | 폴더 + `index.ts` 재내보내기      | 커밋 `8c429bda8`                                         |

세 작업 모두 동작을 바꾸지 않는 코드 이동이다. ==목적은 줄 수 감소가 아니라 수정할 위치를 찾는 시간을 줄이는 것이다==. 실제로 세 작업 모두 전체 줄 수는 늘었다.

## 분리 단위 선택

2단계의 대상 기준은 하나였다. 한 파일이 여러 컴포넌트를 포함해, 한 부분을 수정하려 해도 수백 줄을 오가야 하는 파일이다. 세 작업에서 검토한 방법을 한 표로 모으면 다음과 같다.

| 방법                                                          | 장점                                | 단점                                                                           |
| ------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| 현재 파일을 유지하고 코드 접기·목차 주석·편집기 검색으로 관리 | 변경할 코드가 없다                  | 같은 파일에서 충돌이 나고 diff가 길다. 커밋 기록에 수정 대상이 드러나지 않는다 |
| 종류별 폴더 (`components/`, `hooks/`, `utils/`, 타입)         | 일반적인 구조, 파일 종류가 명확하다 | 한 화면·데모를 수정하려면 여러 폴더를 오가야 한다                              |
| 데모마다 폴더 (`voice/Voice.tsx`, `voice/…`)                  | 데모가 커져도 확장 여유가 있다      | 현재는 데모마다 파일이 한두 개라 폴더 구조가 과하다                            |
| 프로젝트를 JSON 데이터로 분리                                 | 코드가 아닌 데이터로 관리           | 타입 검사가 약해진다. 이미지 주소 헬퍼 같은 함수를 쓸 수 없다                  |
| 화면·데모·프로젝트 단위 파일, 공유 코드만 별도 (**채택**)     | 수정 위치 = 화면에 보이는 단위 하나 | 컴포넌트끼리 타입을 공유할 때 순환 의존이 생기기 쉽다. 파일 수가 늘어난다      |

세 작업 모두 마지막 방법을 채택했다. 데모 하나가 400줄을 넘으면 그 시각에 폴더로 전환한다. 공유 코드를 어디에 둘지는 대상마다 아래 세 가지 방식으로 정했다.

## 둘 이상이 쓰는 코드만 공유 모듈로: CreativeDemos

### 1,861줄 데모 파일

HYEONIVERSE 프로젝트 페이지에는 그 사이트의 관리자 기능을 재현하는 데모가 있다. 발표 갤러리, 음성 생성, 파형 편집, PDF·PPTX 변환, 번역, 요약, 커버, 테마 미리보기의 여덟 개다. 데모를 하나씩 추가하면서 모두 `CreativeDemos.tsx` 한 파일에 누적됐고 1,861줄이 됐다. 데모 하나를 수정하려면 다른 데모 코드 사이를 스크롤해야 했고, 어느 상수가 어느 데모에 속하는지 파일 안에서는 구분할 수 없었다. 2단계에서는 가장 큰 이 파일부터 분리했다.

### 데모별 파일과 공유 모듈

```
safari/project/creative/
├── Demo.tsx        종류 → 데모 (CreativeChapters가 쓴다)
├── Slides.tsx  Voice.tsx  Wave.tsx  Convert.tsx
├── Translate.tsx  Summary.tsx  Cover.tsx  Themes.tsx
├── demoEvent.ts    데모가 페이지(몽이)에 상태를 알리는 이벤트
├── useInView.ts    화면 안에 들어왔는지
├── slideDeck.ts    발표 장 목록 (Slides와 Convert가 함께 쓴다)
├── liveDemo.ts     실제 AI를 부르는 데모의 서버 호출과 남은 횟수
├── QuotaChip.tsx   남은 횟수 칩
└── color.ts        WCAG 대비, OKLab 명도 옮기기 (+ color.test.ts)
```

기준은 하나다.

> [!IMPORTANT] 공유 모듈 기준
> **한 데모만 사용하는 코드는 그 데모 파일 안에, 둘 이상이 사용하는 코드는 별도 모듈로.**

그래서 `FISH_SAMPLE`(파형 편집기가 재생하는 음성 파일)은 음성 데모 쪽에 정의되어 있었지만 파형 데모만 사용하므로 파형 데모로 이동했고, 발표 장 목록은 갤러리와 변환 데모가 함께 사용해서 `slideDeck.ts`로 분리했다. 기준을 하나로 정해 두어 상수마다 위치를 판단하는 작업이 줄었다.

![CreativeDemos.tsx 한 파일이 데모별 파일 여덟 개와 공유 모듈 여섯 개로 나뉜 모습](./images/split-creative-demos-tree.svg '한 데모만 쓰는 것은 그 안에, 둘 이상이 쓰는 것은 따로')

![나눈 직후 파일별 줄 수 막대](./images/split-creative-demos-lines.svg '1,861줄이 15개 파일로')

데모 파일 옆의 `CreativeCms.tsx`(970줄)에는 관리자·CMS 장의 도식 여덟 개(자동 저장, 글의 일생, 댓글, 메일함, 초대, 역할, 주방, 공급자)가 있었다. 서로 공유하는 코드가 없는 독립 컴포넌트라 `creative/cms/`에 하나씩 분리만 했다. 가장 큰 공급자 도식이 337줄, 나머지는 50~130줄이다.

### 분리 후 드러난 린트 규칙과 순수 함수

- **react-refresh 규칙**: ESLint의 [`react-refresh/only-export-components`](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)[^hmr] 규칙이 "컴포넌트와 훅을 한 파일에서 함께 export하지 말라"는 오류를 출력했다. 훅(`useLiveDemo`)과 칩 컴포넌트(`QuotaChip`)를 한 파일에 두었다가 두 파일로 분리했다. 한 파일에 모여 있을 때는 export 자체가 없어서 이 규칙이 적용되지 않았다. ==일부 린트 규칙은 파일 경계가 생긴 뒤에야 적용된다==.
- **순수 함수의 분리**: 색 계산(`contrast`, `readableAccent`, `textOnAccent`)은 DOM도 React도 필요 없지만 컴포넌트 파일 안에 있어서 시험 대상으로 인식되지 않았다. 별도 모듈로 분리한 직후 단위 시험 7개를 작성했다. 이전에는 테마 미리보기 화면에서 육안으로 확인하던 조건이 시험 코드로 남는다. 대비 기준은 [WCAG 2.1 대비(최소)](https://www.w3.org/TR/WCAG21/#contrast-minimum)의 4.5:1이고, 명도 조정은 [OKLab](https://bottosson.github.io/posts/oklab/) 색 공간에서 한다. 아래는 "연한 노랑을 흰 바탕 위에 올리면 어두워지되 여전히 노란 계열"을 확인하는 시험이다.

```ts
it('모자라면 바탕 반대쪽으로 명도를 옮겨 4.5를 넘기고, 색상은 비슷하게 둔다', () => {
	const fixed = readableAccent('#ffd27f', '#ffffff'); // 연한 노랑 위 흰 바탕
	expect(fixed).not.toBe('#ffd27f');
	expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
	// 어두워졌지만 여전히 노란 계열 (빨강 성분이 파랑보다 크다)
	const [r, , b] = [1, 3, 5].map((i) => parseInt(fixed.slice(i, i + 2), 16));
	expect(r).toBeGreaterThan(b);
});
```

이 모듈을 import하는 파일은 두 개뿐이었다. `CreativeChapters`는 `Demo`를, `CreativePage`는 `Themes`와 데모 이벤트를 import한다. 경로만 바꿨고 동작은 그대로다.

### 대소문자만 다른 파일 이름

처음에는 발표 장 목록을 `slides.ts`로 저장했다. 같은 폴더에 갤러리 데모 `Slides.tsx`가 있다.

| 환경              | 파일 시스템               | 결과                                                                                                                                |
| ----------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Linux (CI)        | 대소문자 구분             | 두 파일을 별개로 인식, 시험 모두 통과                                                                                               |
| macOS (개발 환경) | 대소문자 구분 안 함(기본) | `import { Slides } from './Slides'`가 `Slides.ts`를 먼저 찾다가 `slides.ts`를 선택. 그 파일에는 `Slides`가 없어 타입 검사·빌드 실패 |

목록 파일 이름을 `slideDeck.ts`로 바꿨다.

> [!WARNING] 대소문자만 다른 파일 이름
> CI가 Linux 하나뿐이면 이 문제는 검출되지 않으므로, 대소문자만 다른 이름은 같은 폴더에 두지 않는다. 이름을 바꿀 때는 macOS에서 한 파일로 인식되므로 `git mv Slides.tsx tmp && git mv tmp slides.ts`처럼 두 단계로 나눈다.

### CreativeDemos 분리 결과

- 데모 파일 분리는 20개 파일, 2,007줄 추가와 1,863줄 삭제였다. 늘어난 144줄은 대부분 분리한 파일마다 추가된 import와 시험 파일이다.
- 새 단위 시험은 `creative/color.test.ts` 7개다. 대비(WCAG) 2개, 가독성 있는 강조색 3개, 강조색 위 글자색 2개.
- 동작은 바꾸지 않았으므로 Safari 프로젝트 페이지 E2E(`e2e/safari.spec.ts`)는 수정 없이 통과했다.
- 대소문자 문제는 CI(Linux)에서는 검출되지 않았고, macOS에서 타입 검사를 실행할 때 발견됐다.

## 서로 쓰는 타입은 model 파일로: 폴더 사이드바와 사진 앱

### 대상 두 파일

두 번째 작업은 메모의 폴더 사이드바와 휴대폰 사진 앱이다. 두 파일 모두 600줄을 넘었다.

| 파일                | 줄 수 | 포함한 컴포넌트·훅                                             |
| ------------------- | ----- | -------------------------------------------------------------- |
| `FolderSidebar.tsx` | 697   | 사이드바 본체, 폴더 한 줄(200줄), 이름 입력, 끌어 놓기 훅      |
| `PhotosMobile.tsx`  | 662   | 본체, 크게 보기 화면(236줄, 파일의 약 3분의 1), 격자·선반·카드 |

### FolderSidebar와 FolderRow의 순환 의존

`FolderRow`(200줄)는 사이드바 props 타입을 `Omit<Props, …>`로 참조하고 있어서, 파일만 분리하면 `FolderRow`가 `FolderSidebar`를 import하고 `FolderSidebar`가 `FolderRow`를 렌더링하는 순환 의존이 생긴다. [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles)의 규칙대로, ==두 파일이 서로의 코드를 필요로 하면 둘 중 한쪽에 두지 않고 세 번째 파일로 분리한다==. 두 파일이 함께 사용하는 코드(`DragItem`, `FolderSidebarProps`, 깊이 상한 안내 문장)를 `folderSidebar.model.ts`로 분리했다.

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

### PhotosMobile 분리

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

### import를 계산하는 분리 스크립트

파일을 줄 범위로 분할하고, 분할한 파일마다 필요한 import를 계산하는 작은 스크립트를 사용했다.

1. 사람이 분할할 줄 범위를 지정한다.
2. 원본의 import 목록에서 각 파일이 실제로 사용하는 이름만 남긴다.
3. 다른 분할 파일에 정의된 이름을 사용하면, 정의한 쪽에 `export`를 붙이고 import를 추가한다.
4. `tsc`와 ESLint로 남은 오류를 검출한다.

수작업으로 하면 import를 누락하거나 사용하지 않는 import를 남기기 쉽다. 실제로 스크립트가 주석에 적힌 `ALL_CATEGORY`를 사용 중인 이름으로 오인해 불필요한 import가 하나 남았고, ESLint의 [`no-unused-vars`](https://eslint.org/docs/latest/rules/no-unused-vars)가 즉시 검출했다. 기계적인 작업은 스크립트가 처리하고, 사람은 분할 위치만 정한다.

### 사이드바·사진 앱 분리 결과

- 동작을 바꾸지 않는 코드 이동이라 새 시험을 작성하지 않고, 기존 시험이 그대로 통과하는지 확인했다. 메모 E2E(폴더 생성·이름 변경·끌어 옮기기·휴대폰 편집)와 휴대폰 사진 E2E(격자·크게 보기·검색)다.
- CI의 순환 의존 검사(`pnpm cycles`, [madge](https://github.com/pahen/madge))가 `apps/react/src`에 순환이 없다고 출력했다. model 파일이 없었다면 이 단계에서 실패했을 것이다.
- 변경은 11개 파일, 754줄 추가와 691줄 삭제다. 전체 줄 수가 63줄 늘어난 것은 분할한 파일마다 import와 export가 새로 생겼기 때문이다.

## import 경로를 유지하는 index.ts 재내보내기: shared/profile

### 1,629줄 단일 출처

1단계의 세 번째 항목으로, [8개 도메인의 응답 타입](/memo/contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207)을 contracts 패키지로 옮긴 다음([PR #208](https://github.com/hyeoniverse/MacFolio/pull/208))에 진행했다.

`apps/react/src/shared/profile.ts`는 사이트 소유자의 프로필과 프로젝트의 단일 출처(single source of truth)다. GitHub 앱의 스냅샷, 터미널의 `projects` 명령, Safari 탭, Finder의 프로젝트 폴더가 모두 이 파일을 읽는다. 단일 출처라는 설계는 유지할 가치가 있었다. 문제는 그 단일 출처가 파일 하나였다는 점이다.

| 내용                       | 줄    |
| -------------------------- | ----- |
| `PROFILE` (이름·직무·주소) | 9     |
| `SKILLS`·`SITE_STACK`      | 16    |
| 인터페이스 7개             | 172   |
| `PROJECTS` 7개             | 1,420 |

HYEONIVERSE 하나가 665줄이다. 프로젝트 페이지의 장(chapter), 갤러리, 크레딧, 타임라인이 모두 이 안에 있기 때문이다. SproutFarm의 조작법 한 줄을 수정하려면 1,629줄짜리 파일을 열고 1,421번째 줄로 이동해야 했다.

분리 전까지 `shared/profile.ts`를 수정한 커밋은 55개였다. 대부분 프로젝트 하나의 문구나 이미지를 수정한 것인데, 커밋 기록에는 모두 "profile.ts 변경"으로만 표시되었다. 어느 프로젝트를 수정했는지는 diff를 열어야 확인할 수 있었다. 종류별(타입·프로필·프로젝트 전체)로만 나누면 프로젝트 파일이 여전히 1,420줄이라, 프로젝트마다 파일 하나를 두는 방법을 선택했다.

![전: profile.ts 한 파일에 PROFILE·SKILLS·타입·PROJECTS 1,420줄. 후: profile/ 폴더에 profile.ts·skills.ts·types.ts와 projects/ 아래 프로젝트마다 한 파일, index.ts가 다시 내보낸다](./images/profile-split-tree.svg '프로젝트 하나를 수정하려면 그 프로젝트 파일 하나만 연다')

### 프로젝트마다 한 파일

```
shared/profile/
  index.ts          ← PROFILE, SKILLS, SITE_STACK, 타입, PROJECTS를 다시 내보낸다
  profile.ts        ← PROFILE
  skills.ts         ← SKILLS, SITE_STACK
  types.ts          ← Project, ProjectPoint, ProjectChapter, ThemeSwatch …
  projects/
    index.ts        ← PROJECTS = [HYEONIVERSE, MACFOLIO, …] (이 순서가 곧 화면의 순서)
    projectImage.ts ← 그림 주소 도우미
    hyeoniverse.ts  ← export const HYEONIVERSE: Project = { … }
    macfolio.ts, newpick.ts, qru.ts, whattodo.ts, sproutfarm.ts, devcourse.ts
```

내용은 한 글자도 변경하지 않았다. 스크립트로 `PROJECTS` 배열의 원소를 하나씩 추출해 들여쓰기 한 단계를 제거하고 `export const 이름: Project =`를 붙였을 뿐이다. ==내용을 수동으로 옮기지 않고 스크립트로 추출한 것이 무변경을 보장하는 방법==이었고, 리뷰 대상은 추출 경계와 `export` 줄뿐이었다. 순서는 `projects/index.ts`의 한 줄이 결정하므로, 프로젝트 추가·삭제는 "파일 하나를 만들고 그 줄에 추가"하는 작업이 되었다.

### 외부 import 27곳 유지

파일 `shared/profile.ts`를 삭제하고 폴더 `shared/profile/`에 `index.ts`를 배치하면, `'@/shared/profile'`은 모듈 해석 규칙[^resolution]에 따라 그 `index.ts`로 해석된다. 외부에서 가져오는 27곳(`import { PROJECTS, type Project } from '@/shared/profile'`)과 `vite.config.ts`는 수정하지 않았다. 이슈에 기록한 "외부 import 경로는 유지" 조건 그대로다. 되돌릴 때도 폴더를 삭제하고 한 파일로 합치면 된다.

### profile 분리 결과

검증 대상은 동작이 바뀌지 않았다는 사실 하나였다.

| 검사           | 확인 내용                                                                            |
| -------------- | ------------------------------------------------------------------------------------ |
| `tsc`, eslint  | 타입·린트 오류 없음                                                                  |
| Vitest 336개   | 단위 시험 통과                                                                       |
| `pnpm cycles`  | 순환 import 없음. 새 폴더 안은 `projects/index.ts` → 각 프로젝트 → `../types` 단방향 |
| Playwright E2E | `PROJECTS`를 읽는 터미널·GitHub·Safari 화면 통과                                     |

| 항목                  | 전          | 후                                   |
| --------------------- | ----------- | ------------------------------------ |
| `shared/profile` 파일 | 1 (1,629줄) | 12 (가장 큰 것 hyeoniverse.ts 668줄) |
| 외부 import 경로      | 27곳        | 27곳 그대로                          |
| 내용 변화             |             | 없음                                 |

Vitest 336개는 이 커밋 시각 기준 단위 시험 수다. 커밋 하나(`8c429bda8`)에서 파일 17개, 1,775줄을 추가하고 1,630줄을 삭제했다. 1단계의 남은 항목은 유니언·브랜드 타입 하나였다([PostSlug·FolderPath 브랜드 타입과 검사 지점으로 글 주소 문자열 구분하기](/memo/branded-ids)).

### profile 분리 이후 변화

![현재 파일별 줄 수](./images/profile-split-sizes.svg '가장 큰 파일은 여전히 hyeoniverse.ts다')

- `types.ts`는 174줄에서 14줄이 되었다. 프로젝트 타입과 검사 로직을 서버와 공유하려고 `packages/desktop-core/src/site`로 옮기고, 이 파일은 재내보내기만 한다. 경로가 하나로 모여 있었으므로 이 이동도 외부 import 수정 없이 진행했다.
- 이후 프로젝트는 시스템 설정에서 수정·저장할 수 있게 되었다([코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing)). 저장하면 `PROJECTS`를 다시 채워 Safari·Finder에 즉시 반영한다.
- `'@/shared/profile'`을 가져오는 파일은 현재 48개로 늘었다. 경로는 여전히 하나다.
- `hyeoniverse.ts`는 아직 668줄이다. 장(chapter) 단위 분리는 진행하지 않았다.

## 정리

| 상황                                         | 공유 코드의 위치                  |
| -------------------------------------------- | --------------------------------- |
| 한 단위만 사용하는 코드                      | 그 단위의 파일 안                 |
| 둘 이상의 형제 단위가 사용하는 코드          | 별도 공유 모듈 (`slideDeck.ts`)   |
| 부모와 자식 컴포넌트가 서로 필요로 하는 타입 | 세 번째 model 파일 (`*.model.ts`) |
| 외부에서 import하는 경로                     | 폴더의 `index.ts`가 재내보내기    |

- 큰 파일을 분리하면 그 안의 순수 함수가 드러난다. 색 계산은 처음부터 시험할 수 있는 코드였다.
- 폴더에 `index.ts`를 두어 원래 파일과 같은 import 경로를 유지하면, 외부 코드를 수정하지 않고 내부를 자유롭게 분리할 수 있다. 큰 파일을 분리할 때 가장 먼저 적용할 수 있는 방법이다.
- 코드 이동은 스크립트(import 계산, 원소 추출)로 처리하고, 결과는 `tsc`·ESLint·`pnpm cycles`가 검증한다.

## 같은 방식으로 분리하는 절차

큰 파일을 분리할 때는 동작이 같다는 것을 시험으로 확인하면서 한 단계씩 진행한다. 화면 코드는 먼저 상태 계산(`*.model.ts`)과 렌더링(컴포넌트)으로 분리하고, model은 React 없이 단위 시험한다.

```bash
pnpm typecheck && pnpm lint
pnpm test
cd apps/react && npx vitest run src/apps/safari src/apps/memo src/apps/photos
npx playwright test e2e/safari.spec.ts e2e/memo.spec.ts e2e/photos.spec.ts
cd ../.. && pnpm cycles      # madge로 model ↔ 컴포넌트 순환이 없는지
```

`pnpm cycles`는 루트 [package.json](https://github.com/hyeoniverse/MacFolio/blob/main/package.json)의 스크립트다([madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles) 참고).

참고 문서: [madge](https://github.com/pahen/madge), [git mv](https://git-scm.com/docs/git-mv), [eslint-plugin-react-refresh](https://github.com/ArnaudBarre/eslint-plugin-react-refresh), [React: 상태 로직을 리듀서로 옮기기](https://react.dev/learn/extracting-state-logic-into-a-reducer), [TypeScript 모듈 해석](https://www.typescriptlang.org/docs/handbook/modules/reference.html).

## 관련 글

- [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles): 순환 import를 끊는 규칙
- [순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-retrospective#2단계-폴더-구조와-의존)
- [parseProfile의 if문 검증을 zod 스키마로 옮기기](/memo/contracts-validation#사이트-프로필-배치-규칙에-맞춰-desktop-core에서-옮기기-207)
- [PROJECTS 데이터에서 생성하는 iframe 앱과 ProjectAppName 브랜드 타입](/memo/project-apps)
- [PROJECTS 단일 원본으로 GitHub 스냅샷과 프로젝트 목록 합치기](/memo/projects-one-list)
- [코드 기본값 위에 서버의 덮어쓸 값만 합치는 프로젝트 편집](/memo/site-projects-editing)

PR: [#189](https://github.com/hyeoniverse/MacFolio/pull/189), [#190](https://github.com/hyeoniverse/MacFolio/pull/190)

[^hmr]: Vite의 React Fast Refresh는 컴포넌트만 export하는 파일에서만 상태를 유지한 채 모듈을 교체한다. 컴포넌트가 아닌 값을 함께 export하면 파일 전체를 다시 불러온다. 이 규칙은 그런 파일을 검출한다.

[^resolution]: 디렉터리를 가리키는 import는 그 디렉터리의 `index.ts`(또는 `index.js`)로 해석된다. Vite와 TypeScript의 `bundler` 모듈 해석이 이 규칙을 따른다. [TypeScript 문서: Module resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#directory-modules-index-file-resolution)

#MacFolio #리팩터링 #React #TypeScript
