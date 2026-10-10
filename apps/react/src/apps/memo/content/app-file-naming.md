---
title: 폴더 대신 이름으로 — 앱 안의 파일 규칙
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 앱마다 components/·hooks/·api/를 파는 대신, 파일 이름이 종류를 말하게 했다. 서버 호출은 *Api.ts, 순수 계산은 model.ts, 훅은 use*.ts. 폴더는 묶을 것이 생겼을 때만. 어긋난 파일 아홉 개의 이름을 맞추고 섞여 있던 둘을 갈랐다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계의 마지막 "앱 폴더 안의 구조를 맞추기".

## 폴더를 파지 않기로 한 이유

처음 계획은 앱 16개 모두에 `components/`·`hooks/`·`api.ts`·`model.ts`를 두는 것이었다. 조사해 보니 폴더를 쓰는 앱은 넷(memo·mail·messages·safari)뿐이고, 나머지는 파일이 2~13개로 평평했다. 거기에 폴더를 파면 `passwords/components/Passwords.tsx`처럼 파일 하나짜리 상자가 생기고, 늘 같이 고치는 `Weather.tsx`·`forecast.ts`·`weatherApi.ts`가 폴더 셋으로 흩어진다. 같이 바뀌는 것은 가까이 두어야 하는데 그 반대다.

실제로 헷갈리던 것은 폴더가 아니라 이름이었다. 서버를 부르는 파일이 `data.ts`·`captions.ts`·`githubActivity.ts`였고, 훅이 `admin.ts`·`popover.ts`·`serverResources.ts`에 들어 있었다. 그래서 규칙을 "폴더"가 아니라 "이름"으로 정했다.

## 규칙

| 종류             | 이름                               |
| ---------------- | ---------------------------------- |
| 서버 호출        | `*Api.ts`                          |
| 타입과 순수 계산 | `model.ts` 또는 뜻이 드러나는 이름 |
| 훅               | `use*.ts`                          |
| 화면 조각        | `PascalCase.tsx`                   |
| 조각이 셋 이상   | `components/`                      |

핵심은 한 줄이다. **한 파일에 서버 호출과 순수 계산을 섞지 않는다.** 섞이면 순수 계산에 시험을 붙이기 어렵고, 3단계에서 서버 호출을 공통 클라이언트로 옮길 때 파일을 다시 갈라야 한다.

## 고친 것

- `activity/data.ts` → `activityApi.ts`(응답 모양과 요청) + `model.ts`(기간·비교·표 이름). 190줄짜리 한 파일에 둘이 섞여 있었다
- `memo/writer/attachments.ts` → 올리는 것은 `attachmentsApi.ts`, 한도·제목·파일 이름 규칙은 그대로
- 훅 넷의 이름: `serverResources.ts` → `useServerResources.ts`, `visitTrend.ts` → `useVisitTrend.ts`, `admin.ts` → `useCanEditMemo.ts`, `popover.ts` → `usePopover.ts`
- 서버 호출 둘의 이름: `captions.ts` → `captionsApi.ts`, `githubActivity.ts` → `githubActivityApi.ts`
- 시험 파일은 대상을 따라 이름을 바꿨다

동작은 바뀌지 않았다. `tsc`·ESLint·단위 시험 97개·E2E로 확인했다.

## 한 가지 예외

값을 받아 두는 store와 그것을 읽는 한 줄짜리 훅(`useSyncExternalStore`)은 그 `*Api.ts`에 둬도 된다고 적었다. `githubApi.ts`의 `useGithub`이 그렇다. 훅을 따로 파일로 빼면 store를 두 파일이 나눠 갖게 되어 오히려 읽기 어렵다. 규칙은 읽기 쉬우라고 있는 것이지, 규칙을 위해 파일을 늘리라고 있는 것이 아니다.

#MacFolio #리팩터링 #React
