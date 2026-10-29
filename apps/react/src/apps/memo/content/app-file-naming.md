---
title: 모듈 구조 4 - 폴더 대신 *Api.ts·model.ts·use*.ts 이름 규칙으로 파일 종류 구분하기
date: 2026-10-10
category: 개발 기록/MacFolio/설계
summary: 앱마다 components/·hooks/·api/ 폴더를 만드는 대신 파일 이름이 종류를 나타내게 했다. 서버 호출은 *Api.ts, 순수 계산은 model.ts, 훅은 use*.ts. 폴더 규칙을 채택하지 않은 이유, 규칙에 어긋난 파일 아홉 개를 맞춘 과정, 다음 단계에서 얻은 효과를 정리했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계의 마지막 항목 "앱 폴더 안의 구조를 맞추기"다([리팩터링 2단계 - 순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-step2-structure)). 앞 단계에서 `apps/`, `desktop/`, `shared/`의 경계를 정했으므로, 이번에는 앱 폴더 하나의 내부 구조를 정리했다.

작업은 PR [#191](https://github.com/hyeoniverse/MacFolio/pull/191)의 커밋 하나(`889aee932`)다. 33개 파일에서 236줄이 추가되고 175줄이 삭제되었다. 대부분은 파일 이름 변경과 그에 따른 `import` 경로 수정이다.

## 문제

`activity/data.ts`가 대표적인 예였다. 서버에 요청을 보내는 코드와, 기간·비교·표 이름을 계산하는 순수 함수가 190줄 파일 하나에 섞여 있었다. 그래서 순수 함수만 시험하려 해도 시험 파일이 서버 클라이언트까지 import했다. 다른 앱도 파일 이름만으로는 "이 파일이 서버를 호출하는가", "이 파일이 훅인가"를 알 수 없었다.

| 파일 이름                     | 실제 역할             | 이름으로 알 수 있는가 |
| ----------------------------- | --------------------- | --------------------- |
| `activity/data.ts`            | 서버 호출 + 순수 계산 | 아니다                |
| `photos/captions.ts`          | 서버 호출             | 아니다                |
| `github/githubActivity.ts`    | 서버 호출             | 아니다                |
| `memo/admin.ts`               | 훅                    | 아니다                |
| `memo/writer/popover.ts`      | 훅                    | 아니다                |
| `activity/serverResources.ts` | 훅                    | 아니다                |

## 폴더 규칙을 채택하지 않은 이유

처음 계획은 앱 16개 모두에 `components/`·`hooks/`·`api.ts`·`model.ts`를 두는 것이었다. 조사 결과 하위 폴더를 쓰는 앱은 memo·safari·mail·messages·apidocs 다섯뿐이었고, 나머지는 파일 1~22개가 하위 폴더 없이 한 폴더에 있었다.

이런 앱에 폴더를 만들면 두 가지 문제가 생긴다.

1. `passwords/components/Passwords.tsx`처럼 파일 하나만 담긴 폴더가 생긴다.
2. 함께 수정하는 `Weather.tsx`·`forecast.ts`·`weatherApi.ts`가 폴더 세 개로 흩어진다. 함께 바뀌는 파일은 가까이 있어야 하는데(응집도), 폴더 규칙은 그 반대로 작용한다.

실제로 혼란을 준 것은 폴더가 아니라 이름이었다. 서버를 호출하는 파일 이름이 `data.ts`·`captions.ts`·`githubActivity.ts`였고, 훅이 `admin.ts`·`popover.ts`·`serverResources.ts`에 들어 있었다. 그래서 규칙의 기준을 폴더가 아니라 이름으로 정했다.

![앱 폴더별 .ts·.tsx 파일 수 막대그래프. memo 77개, safari 101개를 빼면 대부분 1~22개다](./images/app-file-naming-counts.svg '대부분의 앱은 파일 열 개 안팎이라 폴더를 나눌 이유가 없다')

| 방법                                   | 장점                                 | 문제                                                       |
| -------------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| 모든 앱에 같은 폴더 (`components/` 등) | 어느 앱이든 구조가 같다              | 파일 하나짜리 폴더가 생긴다. 함께 수정하는 파일이 흩어진다 |
| 그대로 유지                            | 작업이 없다                          | 서버 호출과 순수 계산이 섞인 파일이 계속 늘어난다          |
| 이름으로 종류를 나타내기 (선택한 방법) | 파일 위치는 그대로이고 이름만 바뀐다 | 규칙을 사람이 지켜야 한다 (린트로 강제하지 않는다)         |

## 규칙

| 종류             | 이름                               |
| ---------------- | ---------------------------------- |
| 서버 호출        | `*Api.ts`                          |
| 타입과 순수 계산 | `model.ts` 또는 뜻이 드러나는 이름 |
| 훅               | `use*.ts`                          |
| 화면 조각        | `PascalCase.tsx`                   |
| 조각이 셋 이상   | `components/`                      |

> **한 파일에 서버 호출과 순수 계산을 섞지 않는다.**

이 규칙이 핵심이다. 둘이 섞이면 순수 계산에 시험을 붙이기 어렵고, 3단계에서 서버 호출을 공통 클라이언트로 옮길 때 파일을 다시 분리해야 한다.

## 수정한 파일

- `activity/data.ts` → `activityApi.ts`(응답 모양과 요청) + `model.ts`(기간·비교·표 이름)로 분리
- `memo/writer/attachments.ts` → 업로드 요청은 `attachmentsApi.ts`로 분리하고, 한도·제목·파일 이름 규칙은 그대로 유지
- 훅 네 개의 이름: `serverResources.ts` → `useServerResources.ts`, `visitTrend.ts` → `useVisitTrend.ts`, `admin.ts` → `useCanEditMemo.ts`, `popover.ts` → `usePopover.ts`
- 서버 호출 파일 두 개의 이름: `captions.ts` → `captionsApi.ts`, `githubActivity.ts` → `githubActivityApi.ts`
- 시험 파일은 대상 파일을 따라 이름을 바꿨다

<details>
<summary>git이 이름 변경으로 인식한 파일 (git show -M --stat 889aee932)</summary>

```text
apps/react/src/apps/activity/{data.ts => activityApi.ts}                             | 77 +---
apps/react/src/apps/activity/{data.test.ts => model.test.ts}                         |  2 +-
apps/react/src/apps/activity/{serverResources.test.ts => useServerResources.test.ts} |  4 ++--
apps/react/src/apps/activity/{serverResources.ts => useServerResources.ts}           |  2 +-
apps/react/src/apps/activity/{visitTrend.test.ts => useVisitTrend.test.ts}           |  4 ++--
apps/react/src/apps/activity/{visitTrend.ts => useVisitTrend.ts}                     |  5 +++--
apps/react/src/apps/github/{githubActivity.test.ts => githubActivityApi.test.ts}     |  2 +-
apps/react/src/apps/github/{githubActivity.ts => githubActivityApi.ts}               |  0
apps/react/src/apps/memo/{admin.ts => useCanEditMemo.ts}                             |  0
apps/react/src/apps/memo/writer/{popover.ts => usePopover.ts}                        |  0
apps/react/src/apps/photos/{captions.ts => captionsApi.ts}                           |  0
```

</details>

`data.ts`를 분리한 결과, 서버를 호출하는 파일에는 경로와 응답 모양만 남았다.

```ts
// activityApi.ts (이 작업 시점 코드에서 발췌): 응답 모양과 요청. 화면에 맞게 변환하는 순수 함수는 model.ts
export const fetchSummary = (from: string, to: string) => get<Summary>(`/analytics/summary?from=${from}&to=${to}`);
export const fetchLive = (minutes = 30) => get<LiveVisit[]>(`/analytics/live?minutes=${minutes}`);
```

`model.ts`에는 기간 계산, 이전 기간 비교, 체류 시간 표기, 표 이름 같은 순수 함수만 있다. 그래서 `model.test.ts`는 서버 클라이언트를 모의 객체로 바꿀 필요 없이 함수만 호출한다.

![activity/data.ts를 activityApi.ts와 model.ts로 분리하고, 훅 네 개와 서버 호출 파일 두 개의 이름을 바꾼 도식](./images/app-file-naming-renames.svg '섞인 파일 하나를 둘로 분리하고, 훅 넷과 서버 호출 둘의 이름을 규칙에 맞췄다')

동작은 바뀌지 않았다. `tsc`·ESLint·단위 시험 97개·E2E로 확인했다. 이름만 바꾼 파일은 git이 이름 변경(rename)[^rename]으로 인식해(`captions.ts => captionsApi.ts`처럼 변경 0줄) 리뷰에서 내용 변경과 섞이지 않았다.

## 예외 하나

응답을 보관하는 store와 그것을 읽는 한 줄짜리 훅([`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore))은 해당 `*Api.ts`에 함께 정의해도 된다고 규칙에 적었다. `githubApi.ts`의 `useGithub`이 그 예다. 훅을 별도 파일로 분리하면 store 하나를 두 파일이 나눠 갖게 되어 오히려 읽기 어렵다. 규칙의 목적은 읽기 쉬운 코드이고, 규칙을 지키려고 파일을 늘리는 것은 목적에 맞지 않는다.

규칙과 예외는 모두 `CONTRIBUTING.md`의 파일 이름 표에 적었다. 표에는 예시도 함께 넣었다(`postsApi.ts`, `activity/model.ts`, `weather/forecast.ts`).

## 다음 단계에서 얻은 효과

바로 다음 3단계에서 앱마다 흩어진 `fetch`를 `shared/api/client.ts`의 `api()` 하나로 모았다([공통 모듈 1 - 공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-api-client)). 이때 수정할 파일을 찾는 작업이 `*Api.ts` 검색으로 끝났다. 이후 응답 모양을 `packages/contracts`의 스키마로 옮길 때([contracts 패키지](/memo/contracts-comments))도 `*Api.ts`만 열면 됐다. 현재 `activityApi.ts`는 응답 타입을 `@macfolio/contracts`에서 가져와 다시 내보내기만 한다.

## 남은 것, 배운 것

- 규칙을 린트로 강제하지 않는다. `*Api.ts` 밖에서 `fetch`를 호출하면 오류를 내는 린트 규칙을 검토했지만, 외부 서비스(날씨, 효과음)와 `/health` 확인처럼 예외가 있어 문서로만 관리한다.
- memo(파일 77개)와 safari(101개)는 이미 하위 폴더로 나뉘어 있었다. 둘 다 "조각이 셋 이상이면 `components/`" 규칙에 맞아 수정하지 않았다.
- 구조를 맞출 때 "모든 앱을 같은 모양으로"보다 "함께 바뀌는 파일을 가까이"를 우선했다. 겉모양을 맞추는 규칙은 작은 앱에 빈 폴더를 만들고, 실제로 혼란을 주던 이름은 그대로 남긴다.

## 규칙 적용하기

규칙의 원문은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '프론트엔드 파일 이름' 절이다. 새 파일을 만들 때는 다음 표로 이름을 정한다.

| 파일에 들어갈 것 | 이름                           | 예                                       |
| ---------------- | ------------------------------ | ---------------------------------------- |
| 화면(컴포넌트)   | `PascalCase.tsx`               | `Weather.tsx`                            |
| 서버 호출        | `<무엇>Api.ts`                 | `postsApi.ts`                            |
| React 없는 계산  | `model.ts` (+ `model.test.ts`) | `activity/model.ts`                      |
| 훅               | `use<무엇>.ts`                 | `useServerResources.ts`, `usePopover.ts` |

규칙을 지키고 있는지는 파일 이름으로 검색해 확인한다.

```bash
cd apps/react/src/apps
ls -d */hooks */api 2>/dev/null                # 출력이 없어야 한다 (hooks/·api/ 폴더는 만들지 않는다)
ls -d */components                             # 화면 조각이 셋 이상인 앱만 (2026-10-23: mail·memo·messages·weather)
find . -name '*Api.ts' | head                  # 서버 호출 파일
pnpm cycles                                    # 이름을 바꾸면서 순환 import가 생기지 않았는지
```

파일을 옮길 때는 `git mv`를 사용해야 이력이 이어진다. 되돌릴 때도 `git mv`를 반대 방향으로 실행한다.

## 관련 글

- [리팩터링 2단계 - 순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-step2-structure)
- [리팩터링 3단계 - api() 요청 함수와 저장소·미디어 쿼리 공통 함수로 기반 코드 통합하기](/memo/refactor-step3-foundation)
- [공통 모듈 1 - 공통 API 클라이언트 api()·apiFetch()로 fetch 호출과 401 처리 통합하기](/memo/shared-api-client)
- [contracts 스키마 1 - zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [모듈 구조 1 - madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles)

[^rename]: git은 이름 변경을 별도로 기록하지 않고, 삭제된 파일과 추가된 파일의 내용이 50% 이상 같으면 이름 변경으로 표시한다. 내용을 거의 바꾸지 않아야 `git log --follow`로 이력이 이어진다. [git diff 문서의 `-M` 옵션](https://git-scm.com/docs/git-diff)

#MacFolio #리팩터링 #React
