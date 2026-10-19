---
title: 1,629줄 한 파일을 폴더로 — 프로젝트마다 한 파일, 경로는 그대로
date: 2026-10-11
category: 개발기/MacFolio/인프라
summary: 프로필·기술·타입·프로젝트 일곱 개가 든 1,629줄짜리 shared/profile.ts를 profile/ 폴더로 나누고 프로젝트마다 한 파일을 뒀다. index.ts가 다시 내보내므로 바깥 27곳의 import는 그대로였고, 내용은 한 글자도 바꾸지 않았다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계의 셋째 항목이다. [여덟 도메인의 응답 타입](/memo/contracts-site)을 contracts로 옮긴 다음에 했다([PR #208](https://github.com/hyeoniverse/MacFolio/pull/208)).

## 무엇이 한 파일에 있었나

`apps/react/src/shared/profile.ts`는 사이트 주인의 프로필과 프로젝트의 "단일 출처"다. GitHub 앱의 스냅샷, 터미널의 `projects` 명령, Safari 탭, Finder의 프로젝트 폴더가 모두 여기를 읽는다. 단일 출처라는 생각은 맞았다. 문제는 그 단일 출처가 한 파일이었다는 것이다.

| 내용                       | 줄    |
| -------------------------- | ----- |
| `PROFILE` (이름·직무·주소) | 9     |
| `SKILLS`·`SITE_STACK`      | 16    |
| 인터페이스 일곱 개         | 172   |
| `PROJECTS` 일곱 개         | 1,420 |

HYEONIVERSE 하나가 665줄이다. 프로젝트 페이지의 장(chapter), 갤러리, 크레딧, 타임라인이 다 여기 들어 있어서다. SproutFarm의 조작법 한 줄을 고치려면 1,629줄짜리 파일을 열고 1,421번째 줄로 가야 했다.

나누기 전까지 `shared/profile.ts`를 고친 커밋은 55개였다. 대부분 프로젝트 하나의 문구나 그림을 고친 것인데, 커밋 기록에서는 모두 "profile.ts가 바뀌었다"로만 보였다. 어느 프로젝트를 고쳤는지는 diff를 열어야 알았다.

## 어떻게 나눌까

| 방법                                                   | 좋은 점                                         | 문제                                                          |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------- |
| 그대로 두고 편집기의 접기·찾기로 버틴다                | 할 일이 없다                                    | 커밋 기록과 리뷰에서 어느 프로젝트인지 보이지 않는다          |
| 종류별로 나눈다 (타입·프로필·프로젝트 전체 한 파일)    | 파일이 넷                                       | 프로젝트 파일이 여전히 1,420줄이다                            |
| 프로젝트마다 한 파일 + 다시 내보내는 `index.ts` (고름) | 프로젝트 하나 = 파일 하나. 바깥 import는 그대로 | 파일이 12개로 는다. 순서를 정할 곳이 따로 필요하다            |
| 프로젝트를 JSON 데이터로 뺀다                          | 코드가 아닌 데이터                              | 타입 검사가 약해진다. 그림 주소 도우미 같은 함수를 쓸 수 없다 |

![전: profile.ts 한 파일에 PROFILE·SKILLS·타입·PROJECTS 1,420줄. 후: profile/ 폴더에 profile.ts·skills.ts·types.ts와 projects/ 아래 프로젝트마다 한 파일, index.ts가 다시 내보낸다](./images/profile-split-tree.svg '프로젝트 하나 고치려면 그 프로젝트 파일 하나만 연다')

## 어떻게 나눴나

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

내용은 한 글자도 안 바꿨다. 스크립트로 `PROJECTS` 배열의 원소를 하나씩 잘라 들여쓰기 한 단을 빼고 `export const 이름: Project =`를 붙였을 뿐이다. 순서를 정하는 곳은 `projects/index.ts` 한 줄이라, 프로젝트를 더하거나 빼는 일은 "파일 하나 만들고 그 줄에 넣기"가 됐다.

## 경로는 그대로

파일 `shared/profile.ts`를 지우고 폴더 `shared/profile/`에 `index.ts`를 두면 `'@/shared/profile'`은 그 `index.ts`로 간다. 바깥에서 가져오는 27곳(`import { PROJECTS, type Project } from '@/shared/profile'`)과 `vite.config.ts`는 하나도 안 고쳤다. 이슈에 "바깥 import 경로는 유지"라고 적어 둔 그대로다.

## 확인

바꾼 게 없음을 확인하는 일이 전부였다. `tsc`, eslint, Vitest 336개, `pnpm cycles`(새 폴더 안에서 `projects/index.ts` → 각 프로젝트 → `../types`로 한 방향), 그리고 PROJECTS를 읽는 터미널·GitHub·Safari의 Playwright E2E.

| 항목                  | 전          | 후                                   |
| --------------------- | ----------- | ------------------------------------ |
| `shared/profile` 파일 | 1 (1,629줄) | 12 (가장 큰 것 hyeoniverse.ts 668줄) |
| 바깥 import 경로      | 27곳        | 27곳 그대로                          |
| 내용 변화             |             | 없음                                 |

Vitest 336개는 이 커밋 시점의 단위 시험 수다. 커밋 하나(`8c429bda8`)에서 17개 파일, 1,775줄을 더하고 1,630줄을 지웠다.

남은 1단계는 유니언·브랜드 타입 하나였다.

## 그 뒤

![지금 파일별 줄 수](./images/profile-split-sizes.svg '가장 큰 파일은 여전히 hyeoniverse.ts다')

- `types.ts`는 174줄에서 14줄이 되었다. 프로젝트 모양과 검사를 서버와 함께 쓰려고 `packages/desktop-core/src/site`로 옮기고, 여기서는 다시 내보내기만 한다. 경로를 하나로 모아 둔 덕분에 이것도 바깥 import를 고치지 않고 옮겼다.
- 프로젝트는 뒤에 시스템 설정에서 고쳐 저장할 수 있게 되었다([코드를 고치지 않고 프로젝트와 앱 관리하기](/memo/site-projects-editing)). 저장하면 `PROJECTS`를 다시 채워 Safari·Finder에 바로 적용한다.
- `'@/shared/profile'`을 가져오는 파일은 지금 48개로 늘었다. 그래도 경로는 하나다.

## 남은 것·배운 것

- `hyeoniverse.ts`는 아직 668줄이다. 장(chapter)마다 나누는 일은 하지 않았다.
- 폴더에 `index.ts`를 두어 원래 파일 이름과 같은 경로를 만들면, 바깥을 건드리지 않고 안쪽을 마음대로 나눌 수 있다. 큰 파일을 나눌 때 가장 먼저 쓸 수 있는 수다.
- 내용을 손으로 옮기지 않고 스크립트로 자른 것이 "한 글자도 안 바꿨다"를 보장하는 방법이었다. 리뷰할 것은 잘린 경계와 `export` 줄뿐이었다.

## 관련 글

- [이미 한 곳이었다, 자리만 옮겼다 — 사이트 프로필로 1단계 마무리](/memo/contracts-site)
- [프로젝트를 앱으로 - 배포한 사이트를 창 안에 띄우기](/memo/project-apps)
- [프로젝트 목록은 한 곳에](/memo/projects-one-list)

#MacFolio #리팩터링 #TypeScript
