---
title: 1,629줄 한 파일을 폴더로 — 프로젝트마다 한 파일, 경로는 그대로
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 프로필·기술·타입·프로젝트 7개가 담긴 1,629줄짜리 shared/profile.ts를 profile/ 폴더로 분리하고 프로젝트마다 파일 하나를 배치했다. index.ts가 재내보내기(re-export)하므로 외부 27곳의 import는 그대로였고, 내용은 한 글자도 변경하지 않았다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 세 번째 항목이다. [8개 도메인의 응답 타입](/memo/contracts-site)을 contracts 패키지로 옮긴 다음에 진행했다([PR #208](https://github.com/hyeoniverse/MacFolio/pull/208)).

## 한 파일에 있던 내용

`apps/react/src/shared/profile.ts`는 사이트 소유자의 프로필과 프로젝트의 단일 출처(single source of truth)다. GitHub 앱의 스냅샷, 터미널의 `projects` 명령, Safari 탭, Finder의 프로젝트 폴더가 모두 이 파일을 읽는다. 단일 출처라는 설계는 유지할 가치가 있었다. 문제는 그 단일 출처가 파일 하나였다는 점이다.

| 내용                       | 줄    |
| -------------------------- | ----- |
| `PROFILE` (이름·직무·주소) | 9     |
| `SKILLS`·`SITE_STACK`      | 16    |
| 인터페이스 7개             | 172   |
| `PROJECTS` 7개             | 1,420 |

HYEONIVERSE 하나가 665줄이다. 프로젝트 페이지의 장(chapter), 갤러리, 크레딧, 타임라인이 모두 이 안에 있기 때문이다. SproutFarm의 조작법 한 줄을 수정하려면 1,629줄짜리 파일을 열고 1,421번째 줄로 이동해야 했다.

분리 전까지 `shared/profile.ts`를 수정한 커밋은 55개였다. 대부분 프로젝트 하나의 문구나 이미지를 수정한 것인데, 커밋 기록에는 모두 "profile.ts 변경"으로만 표시되었다. 어느 프로젝트를 수정했는지는 diff를 열어야 확인할 수 있었다.

## 분리 방법 검토

| 방법                                                | 장점                                            | 단점                                                          |
| --------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| 그대로 두고 편집기의 접기·검색 기능으로 관리한다    | 작업이 없다                                     | 커밋 기록과 리뷰에서 수정한 프로젝트가 드러나지 않는다        |
| 종류별로 나눈다 (타입·프로필·프로젝트 전체 한 파일) | 파일 4개                                        | 프로젝트 파일이 여전히 1,420줄이다                            |
| 프로젝트마다 한 파일 + 재내보내기 `index.ts` (선택) | 프로젝트 하나 = 파일 하나. 외부 import는 그대로 | 파일이 12개로 늘어난다. 순서를 정하는 위치가 별도로 필요하다  |
| 프로젝트를 JSON 데이터로 분리한다                   | 코드가 아닌 데이터로 관리                       | 타입 검사가 약해진다. 이미지 주소 헬퍼 같은 함수를 쓸 수 없다 |

![전: profile.ts 한 파일에 PROFILE·SKILLS·타입·PROJECTS 1,420줄. 후: profile/ 폴더에 profile.ts·skills.ts·types.ts와 projects/ 아래 프로젝트마다 한 파일, index.ts가 다시 내보낸다](./images/profile-split-tree.svg '프로젝트 하나를 수정하려면 그 프로젝트 파일 하나만 연다')

## 분리 결과

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

내용은 한 글자도 변경하지 않았다. 스크립트로 `PROJECTS` 배열의 원소를 하나씩 추출해 들여쓰기 한 단계를 제거하고 `export const 이름: Project =`를 붙였을 뿐이다. 순서는 `projects/index.ts`의 한 줄이 결정하므로, 프로젝트 추가·삭제는 "파일 하나를 만들고 그 줄에 추가"하는 작업이 되었다.

## import 경로 유지

파일 `shared/profile.ts`를 삭제하고 폴더 `shared/profile/`에 `index.ts`를 배치하면, `'@/shared/profile'`은 모듈 해석 규칙[^resolution]에 따라 그 `index.ts`로 해석된다. 외부에서 가져오는 27곳(`import { PROJECTS, type Project } from '@/shared/profile'`)과 `vite.config.ts`는 수정하지 않았다. 이슈에 기록한 "외부 import 경로는 유지" 조건 그대로다.

## 확인

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

Vitest 336개는 이 커밋 시각 기준 단위 시험 수다. 커밋 하나(`8c429bda8`)에서 파일 17개, 1,775줄을 추가하고 1,630줄을 삭제했다.

1단계의 남은 항목은 유니언·브랜드 타입 하나였다([문자열은 문을 지나야 글 주소가 된다 — PostSlug·FolderPath 브랜드 타입](/memo/branded-ids)).

## 이후 변화

![현재 파일별 줄 수](./images/profile-split-sizes.svg '가장 큰 파일은 여전히 hyeoniverse.ts다')

- `types.ts`는 174줄에서 14줄이 되었다. 프로젝트 타입과 검사 로직을 서버와 공유하려고 `packages/desktop-core/src/site`로 옮기고, 이 파일은 재내보내기만 한다. 경로가 하나로 모여 있었으므로 이 이동도 외부 import 수정 없이 진행했다.
- 이후 프로젝트는 시스템 설정에서 수정·저장할 수 있게 되었다([코드를 고치지 않고 프로젝트와 앱 관리하기](/memo/site-projects-editing)). 저장하면 `PROJECTS`를 다시 채워 Safari·Finder에 즉시 반영한다.
- `'@/shared/profile'`을 가져오는 파일은 현재 48개로 늘었다. 경로는 여전히 하나다.

## 남은 과제와 정리

- `hyeoniverse.ts`는 아직 668줄이다. 장(chapter) 단위 분리는 진행하지 않았다.
- 폴더에 `index.ts`를 두어 원래 파일과 같은 import 경로를 유지하면, 외부 코드를 수정하지 않고 내부를 자유롭게 분리할 수 있다. 큰 파일을 분리할 때 가장 먼저 적용할 수 있는 방법이다.
- 내용을 수동으로 옮기지 않고 스크립트로 추출한 것이 무변경을 보장하는 방법이었다. 리뷰 대상은 추출 경계와 `export` 줄뿐이었다.

## 같은 방식으로 분리할 때

내용을 변경하지 않고 파일만 분리하는 작업이므로, 변경 전과 같은지를 확인하는 명령 4개로 검증한다.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm cycles        # madge로 순환 import가 없는지
```

`pnpm cycles`는 루트 [package.json](https://github.com/hyeoniverse/MacFolio/blob/main/package.json)의 스크립트다([서로 import하는 파일 둘을 풀고, 다시 생기면 CI가 막게](/memo/break-import-cycles) 참고). 기존 파일 위치에 `index.ts`를 두고 재내보내기만 했으므로 외부 import는 수정할 필요가 없다. 되돌릴 때도 폴더를 삭제하고 한 파일로 합치면 된다.

참고 문서: [madge](https://github.com/pahen/madge), [TypeScript 모듈 해석](https://www.typescriptlang.org/docs/handbook/modules/reference.html).

## 관련 글

- [이미 한 곳이었다, 자리만 옮겼다 — 사이트 프로필로 1단계 마무리](/memo/contracts-site)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [프로젝트 목록은 한 곳에 - MacFolio와 HYEONIVERSE를 프로젝트로 더하며](/memo/projects-one-list)
- [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos)
- [코드를 고치지 않고 프로젝트와 앱 관리하기](/memo/site-projects-editing)

#MacFolio #리팩터링 #TypeScript

[^resolution]: 디렉터리를 가리키는 import는 그 디렉터리의 `index.ts`(또는 `index.js`)로 해석된다. Vite와 TypeScript의 `bundler` 모듈 해석이 이 규칙을 따른다. [TypeScript 문서: Module resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#directory-modules-index-file-resolution)
