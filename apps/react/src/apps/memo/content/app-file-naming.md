---
title: 폴더 대신 이름으로 — 앱 안의 파일 규칙
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 앱마다 components/·hooks/·api/를 파는 대신 파일 이름이 종류를 말하게 했다. 서버 호출은 *Api.ts, 순수 계산은 model.ts, 훅은 use*.ts. 폴더 규칙을 버린 이유, 어긋난 파일 아홉 개를 맞춘 과정, 다음 단계에서 얻은 것을 적었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계의 마지막 "앱 폴더 안의 구조를 맞추기"다([리팩터링 2 - 구조](/memo/refactor-step2-structure)). 앞 단계에서 `apps/`, `desktop/`, `shared/`의 경계를 정했으니, 이번에는 앱 폴더 하나 안을 봤다. 작업은 PR [#191](https://github.com/hyeoniverse/MacFolio/pull/191)의 커밋 하나다. 33개 파일에서 236줄을 더하고 175줄을 지웠다. 대부분은 이름 바꾸기와 그에 따른 `import` 고침이다.

## 무엇이 불편했나

`activity/data.ts`가 대표적이었다. 서버에 요청을 보내는 코드와 기간·비교·표 이름을 계산하는 순수 함수가 190줄 한 파일에 섞여 있었다. 순수 함수만 시험하려 해도 시험 파일이 서버 클라이언트까지 가져왔다. 다른 앱도 파일 이름만 보고는 "이 파일이 서버를 부르는가", "이 파일이 훅인가"를 알 수 없었다.

## 폴더를 파지 않기로 한 이유

처음 계획은 앱 16개 모두에 `components/`·`hooks/`·`api.ts`·`model.ts`를 두는 것이었다. 조사해 보니 폴더를 쓰는 앱은 넷(memo·mail·messages·safari)뿐이고, 나머지는 파일이 2~13개로 평평했다. 거기에 폴더를 파면 `passwords/components/Passwords.tsx`처럼 파일 하나짜리 상자가 생기고, 늘 같이 고치는 `Weather.tsx`·`forecast.ts`·`weatherApi.ts`가 폴더 셋으로 흩어진다. 같이 바뀌는 것은 가까이 두어야 하는데 그 반대다.

실제로 헷갈리던 것은 폴더가 아니라 이름이었다. 서버를 부르는 파일이 `data.ts`·`captions.ts`·`githubActivity.ts`였고, 훅이 `admin.ts`·`popover.ts`·`serverResources.ts`에 들어 있었다. 그래서 규칙을 "폴더"가 아니라 "이름"으로 정했다.

![앱마다 파일 수](./images/app-file-naming-counts.svg '대부분의 앱은 파일 열 개 안팎이라 폴더를 나눌 이유가 없다')

| 방법                                   | 좋은 점                              | 문제                                                     |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| 모든 앱에 같은 폴더 (`components/` 등) | 어느 앱이든 모양이 같다              | 파일 하나짜리 폴더가 생긴다. 같이 고치는 파일이 흩어진다 |
| 그대로 두기                            | 할 일이 없다                         | 서버 호출과 순수 계산이 섞인 파일이 계속 는다            |
| 이름으로 종류를 말하기 (고른 방법)     | 파일이 그 자리에 있고, 이름만 바뀐다 | 규칙을 사람이 지켜야 한다 (린트로 강제하지 않는다)       |

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

`data.ts`를 가른 결과는 이렇다. 서버를 부르는 쪽은 경로와 응답 모양만 남았다.

```ts
// activityApi.ts (지금 모양에서 줄임): 응답 모양과 요청. 화면에 맞게 바꾸는 순수 함수는 model.ts
export const fetchSummary = (from: string, to: string) => get<Summary>(`/analytics/summary?from=${from}&to=${to}`);
export const fetchLive = (minutes = 30) => get<LiveVisit[]>(`/analytics/live?minutes=${minutes}`);
```

`model.ts`에는 기간, 앞 기간 비교, 머문 시간 표기, 표의 이름 같은 순수 함수만 있다. 그래서 `model.test.ts`는 서버 클라이언트를 가짜로 바꿀 필요 없이 함수만 부른다.

![이름 바꾸기](./images/app-file-naming-renames.svg '섞인 파일 하나를 둘로 가르고, 훅 넷과 서버 호출 둘의 이름을 규칙에 맞췄다')

동작은 바뀌지 않았다. `tsc`·ESLint·단위 시험 97개·E2E로 확인했다. 이름만 바꾼 파일은 git이 이름 바꾸기로 알아봐서(`captions.ts => captionsApi.ts`처럼 0줄 바뀜) 리뷰에서 내용 차이와 섞이지 않았다.

## 한 가지 예외

값을 받아 두는 store와 그것을 읽는 한 줄짜리 훅(`useSyncExternalStore`)은 그 `*Api.ts`에 둬도 된다고 적었다. `githubApi.ts`의 `useGithub`이 그렇다. 훅을 따로 파일로 빼면 store를 두 파일이 나눠 갖게 되어 오히려 읽기 어렵다. 규칙은 읽기 쉬우라고 있는 것이지, 규칙을 위해 파일을 늘리라고 있는 것이 아니다.

규칙과 예외는 모두 `CONTRIBUTING.md`의 파일 이름 표에 적었다. 표에는 예도 함께 두었다(`postsApi.ts`, `activity/model.ts`, `weather/forecast.ts`).

## 다음 단계에서 얻은 것

바로 다음 3단계에서 앱마다 흩어진 `fetch`를 `shared/api/client.ts`의 `api()` 하나로 모았다([공용 API 클라이언트](/memo/shared-api-client)). 이때 고칠 파일을 찾는 일이 `*Api.ts`를 찾는 것으로 끝났다. 그 뒤 응답 모양을 `packages/contracts`의 스키마로 옮길 때도 `*Api.ts`만 열면 됐다. 지금 `activityApi.ts`는 응답 타입을 `@macfolio/contracts`에서 가져와 다시 내보내기만 한다.

## 남은 것, 배운 것

- 규칙을 린트로 강제하지 않는다. `fetch`를 `*Api.ts` 밖에서 부르면 막는 규칙을 생각했지만, 바깥 서비스(날씨, 효과음)와 `/health` 확인처럼 예외가 있어서 문서로만 두었다.
- memo(77개)와 safari(101개)는 이미 폴더로 나뉘어 있다. 이 둘은 "조각이 셋 이상이면 `components/`"에 맞아서 손대지 않았다.
- 구조를 맞출 때 "모두 같은 모양"보다 "같이 바뀌는 것을 가까이"가 먼저였다. 겉모양을 맞추는 규칙은 작은 앱에 빈 상자를 만들고, 실제로 헷갈리던 곳(이름)은 그대로 둔다.

## 규칙 적용하기

규칙의 원문은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '프론트엔드 파일 이름'이다. 새 파일을 만들 때는 이렇게 고른다.

| 파일에 들어갈 것 | 이름                           | 예                  |
| ---------------- | ------------------------------ | ------------------- |
| 화면(컴포넌트)   | `PascalCase.tsx`               | `Weather.tsx`       |
| 서버 호출        | `<무엇>Api.ts`                 | `postsApi.ts`       |
| React 없는 계산  | `model.ts` (+ `model.test.ts`) | `activity/model.ts` |
| 훅               | `use<무엇>.ts`                 |                     |

지키고 있는지는 이름으로 찾아 보면 된다.

```bash
cd apps/react/src/apps
ls */components */hooks */api 2>/dev/null     # 아무것도 안 나와야 한다
find . -name '*Api.ts' | head                  # 서버 호출 파일
pnpm cycles                                    # 이름을 바꾸다 순환이 생기지 않았는지
```

옮길 때는 `git mv`로 옮겨야 기록이 이어진다. 되돌리기도 같은 `git mv`를 거꾸로 하면 된다.

관련 글: [리팩터링 2 - 구조](/memo/refactor-step2-structure), [리팩터링 3 - 기반](/memo/refactor-step3-foundation), [공용 API 클라이언트](/memo/shared-api-client), [import 순환 끊기](/memo/break-import-cycles)

#MacFolio #리팩터링 #React
