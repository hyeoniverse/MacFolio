---
title: 리팩터링 2단계 - 순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조
date: 2026-10-18
category: 개발 기록/MacFolio/설계
summary: 리팩터링 2단계 회고. 순환 의존 두 개를 세 번째 파일로 분리하고 madge로 CI에서 차단하게 했으며, 1,861줄 데모 파일 등 큰 파일 네 개를 분할하고, 앱 안 파일은 폴더 대신 이름 규칙으로 정리했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 2단계는 파일의 위치와 import 관계를 정리하는 작업이었다.

## 배경

- `Mail.tsx`와 `MailMobile.tsx`가 서로를 import했다.
- 큰 파일이 여러 개였다: `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄, `Memo.tsx` 830줄, `FolderSidebar.tsx` 675줄, `PhotosMobile.tsx` 662줄.
- 앱 폴더마다 파일 배치 방식이 달랐다. 서버를 호출하는 파일이 `githubActivity.ts`, `captions.ts`, `attachments.ts`처럼 이름만으로는 화면 컴포넌트인지 서버 호출인지 구분할 수 없었다.

순환 의존[^cycle]은 당장 오류를 내지는 않았다. 하지만 모듈 평가 순서에 따라 한쪽 값이 `undefined`로 읽힐 수 있고, 지연 로딩([`lazy`](https://react.dev/reference/react/lazy))으로 분리한 청크가 서로를 끌어와 첫 화면 번들이 커질 수 있다. 실제로 `registry.ts`의 주석에는 "Finder가 이 목록을 다시 읽으므로 지연 로딩이어야 한다"는 조건이 적혀 있었다. 순환을 유지하기 위해 다른 곳에 제약을 거는 구조였다.

큰 파일은 수정할 때마다 PR의 diff가 커졌다. 1,861줄 `CreativeDemos.tsx` 하나에 데모 열 가지가 들어 있어서, 음성 데모 하나를 수정해도 리뷰할 때 같은 파일의 다른 데모 코드를 함께 확인해야 했다.

## 채택한 방법과 제외한 방법

| 문제      | 제외한 방법                                           | 채택한 방법                                                                        |
| --------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 순환 의존 | 한쪽 import를 동적 `import()`로 바꿔 순환을 숨기기    | 공통 부분을 세 번째 파일로 분리해 단방향으로                                       |
| 재발 방지 | ESLint `import/no-cycle` 규칙                         | [madge](https://github.com/pahen/madge)를 `pnpm cycles`로 두고 CI의 `check`에 추가 |
| 파일 배치 | 앱마다 `api/`·`hooks/`·`components/` 폴더를 일괄 생성 | 이름 규칙(`*Api.ts`, `model.ts`, `use*.ts`) + 세 개 이상이면 폴더                  |

동적 `import()`를 쓰면 madge에서도 순환으로 검출되지 않게 할 수 있지만, 순환 자체는 그대로 남는다. ESLint의 `import/no-cycle`은 파일마다 의존 그래프를 다시 계산해 느리고, 이 저장소의 린트 설정에 플러그인을 하나 더 추가해야 했다. madge는 한 번 실행으로 네 패키지를 모두 검사한다.

폴더를 일괄 생성하면 파일이 하나뿐인 폴더가 다수 생긴다. 앱 대부분은 파일이 열 개 이하라, 이름만 맞춰도 같은 종류끼리 정렬되어 표시된다.

10월 10일 저녁, 2단계를 시작하며 순서부터 다시 검토했다. 계획에는 1단계(타입과 데이터 구조)가 먼저였지만, 타입을 옮기려면 그 타입이 들어갈 폴더 구조가 먼저 있어야 했다. 그래서 2 → 3 → 1 순서로 진행하기로 했다. 폴더 분리 방법은 두 안이 있었는데, 규모나 복잡도가 아니라 코드 품질만 기준으로 실무에 맞는 쪽(위 표의 채택한 방법)을 선택했다.

## 변경 목록

| 항목                                   | PR                                                       | 글                                                                                                     |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 순환 의존 분리와 `pnpm cycles`         | [#188](https://github.com/hyeoniverse/MacFolio/pull/188) | [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles)                   |
| `CreativeDemos.tsx` 분할               | [#189](https://github.com/hyeoniverse/MacFolio/pull/189) | [둘 이상이 쓰는 코드만 공유 모듈로 추출해 큰 데모 파일 분리하기](/memo/split-creative-demos)           |
| `FolderSidebar.tsx`·`PhotosMobile.tsx` | [#190](https://github.com/hyeoniverse/MacFolio/pull/190) | [import를 계산하는 분리 스크립트와 model 파일로 순환 없이 컴포넌트 나누기](/memo/split-sidebar-photos) |
| 앱 안의 파일 이름 규칙                 | [#191](https://github.com/hyeoniverse/MacFolio/pull/191) | [폴더 대신 _Api.ts·model.ts·use_.ts 파일 이름으로 앱 안의 파일 종류 구분하기](/memo/app-file-naming)   |
| `CreativeCms.tsx` 분할                 | [#193](https://github.com/hyeoniverse/MacFolio/pull/193) | (데모 글의 끝에서 함께 다룸)                                                                           |

## 구현

### 순환 두 개를 세 번째 파일로

순환은 두 개였다. 메일은 데스크톱 `Mail.tsx`가 휴대폰 화면 `MailMobile.tsx`를 렌더링하고, `MailMobile.tsx`는 `Mail.tsx`에 있던 메일 한 통의 타입(`ListMail`)과 편지함 이름을 import했다. 둘이 공유하는 정의만 `mail/model.ts`로 옮겼다.

```ts
// apps/react/src/apps/mail/model.ts
// 둘이 서로를 import하면 순환이 되므로 공통은 여기에만 둔다 (madge가 CI에서 막는다)
export type Mailbox = 'inbox' | 'sent';
export const MAILBOX_LABEL: Record<Mailbox, string> = { inbox: '받은 편지함', sent: '보낸 편지함' };
export interface ListMail {
	id: string;
	fromName: string; /* … */
}
```

registry↔Finder 순환은 Finder가 "창으로 열리는 앱 목록"을 얻으려고 `registry.ts`를 import하고, `registry.ts`는 Finder 컴포넌트를 참조해서 생겼다. 이름 목록은 React에 의존하지 않는 `manifest.ts`가 이미 모두 갖고 있으므로, 거기에 `WINDOW_APP_NAMES`를 정의하고 Finder는 그것을 읽게 했다. 이때 `registry.ts`가 목록에는 있지만 컴포넌트가 없는 앱을 오류 없이 제외하던 동작을 즉시 오류를 던지도록 바꿨다.

```ts
// apps/react/src/apps/registry.ts (#188)
-export const WINDOW_APPS = APP_NAMES.flatMap((name) => {
+export const WINDOW_APPS = WINDOW_APP_NAMES.map((name) => {
 	const Component = APP_COMPONENTS[name];
-	return Component ? [{ name, Component }] : [];
+	if (!Component) throw new Error(`창으로 여는 앱인데 컴포넌트가 없다: ${name} (apps/registry.ts)`);
+	return { name, Component };
 });
```

이전에는 앱을 추가하고 컴포넌트 연결을 누락하면 Dock에 아이콘만 있고 창이 열리지 않는 상태로 배포될 수 있었다.

재발을 막기 위해 루트 `package.json`에 `cycles` 스크립트를 추가했다. 처음에는 react·api·desktop-core 세 패키지를 검사했고, 1단계에서 생긴 contracts까지 현재는 네 패키지를 검사한다.

```json
"cycles": "madge --circular --extensions ts,tsx --ts-config apps/react/tsconfig.json apps/react/src && madge --circular … apps/api/src && … packages/desktop-core/src && … packages/contracts/src"
```

### 큰 파일 분할

분할 기준은 "한 파일에 화면 하나"였다. 데모 파일은 데모마다, CMS 도식은 도식마다 한 파일로 분리했고, 여러 파일이 공유하는 코드(색 계산 `color.ts`, 뷰포트 진입 여부를 감지하는 `useInView.ts`, 데모 프레임 `Demo.tsx`)는 별도 파일로 두었다. 사이드바와 휴대폰 사진 앱은 행 단위 컴포넌트(`FolderRow.tsx`, `PhotoGrid.tsx`)와 크게 보기(`PhoneViewer.tsx`), 순수 계산(`folderSidebar.model.ts`, `photosMobile.model.ts`)으로 나눴다.

![나누기 전 파일과 나눈 뒤 가장 큰 조각의 줄 수](./images/refactor-step2-structure-sizes.svg '가장 큰 조각도 400줄 안쪽이 됐다')

이동 후 diff를 [`git diff -M`](https://git-scm.com/docs/git-diff)(이름 변경 감지)으로 확인하면 대부분 "이동"으로 검출되도록, 함수 본문은 수정하지 않고 위치만 옮겼다. 데모의 색 계산처럼 순수 함수가 분리된 곳에만 단위 시험을 추가했다. 색 계산은 컴포넌트 파일 안에 있어 시험이 없었는데, `creative/color.test.ts`에 7개가 생겼다.

### 이름 규칙

#191에서 규칙과 어긋난 파일 아홉 개의 이름을 바꿨다. 일부는 다음과 같다.

| 전                           | 후                                | 이유                    |
| ---------------------------- | --------------------------------- | ----------------------- |
| `github/githubActivity.ts`   | `github/githubActivityApi.ts`     | 서버를 호출한다         |
| `photos/captions.ts`         | `photos/captionsApi.ts`           | 서버를 호출한다         |
| `memo/admin.ts`              | `memo/useCanEditMemo.ts`          | 훅이다                  |
| `memo/writer/popover.ts`     | `memo/writer/usePopover.ts`       | 훅이다                  |
| `memo/writer/attachments.ts` | 서버 호출만 `attachmentsApi.ts`로 | 계산과 서버 호출이 섞임 |

`githubActivity.ts`는 대소문자만 다른 `GithubActivity.tsx`와 macOS의 대소문자 비구분 파일 시스템에서 충돌한 적이 있는 파일이다([/health 응답 시간과 DB 상태를 막대 수로 환산하는 서버 상태 표시](/memo/server-status-wifi) 끝 부분). 이름 규칙을 정한 뒤로는 이런 이름 쌍이 생길 가능성이 줄었다.

![두 순환 의존을 셋째 파일로 푼 모양과 파일 이름 규칙 네 가지](./images/refactor-step2-structure-cycles.svg '서로 import하던 짝은 공통 부분을 셋째 파일로 꺼내 한 방향으로 만들었다')

| 파일 종류      | 이름 규칙        |
| -------------- | ---------------- |
| 서버 호출      | `*Api.ts`        |
| 순수 계산·타입 | `model.ts`       |
| 훅             | `use*.ts`        |
| 화면 컴포넌트  | `PascalCase.tsx` |

같은 종류가 세 개 이상이면 `components/`처럼 폴더로 묶는다.

## 전후

|                         | 전      | 후                                 |
| ----------------------- | ------- | ---------------------------------- |
| 순환 의존               | 2개     | 0개, CI가 차단                     |
| `CreativeDemos.tsx`     | 1,861줄 | `creative/`에 데모마다 한 파일     |
| `CreativeCms.tsx`       | 970줄   | `creative/cms/`에 도식마다 한 파일 |
| 이름 규칙에 어긋난 파일 | 9개     | 0개                                |

## 확인

- `pnpm cycles`가 네 패키지 모두 순환 0개로 종료된다. CI 워크플로(`ci.yml`)에 이 단계를 추가해, 순환이 생기면 PR이 실패한다.
- 분할 PR(#189·#190·#193)은 E2E 파일을 하나도 수정하지 않았다. 화면 동작이 같으므로 기존 E2E가 그대로 통과해야 했다.
- 줄 수는 병합 커밋에서 `wc -l`로 측정했다. 데모 PR(#189)은 1,861줄을 삭제하고 새 파일 16개에 2,007줄을 추가했다. 증가한 줄은 파일마다 추가된 import와 머리 주석이다.

## 의도적으로 남긴 것

`Memo.tsx`(830줄)는 이미 `useMemoLibrary`·`useNoteView`·`useNoteDrag`·`useTrash` 같은 훅으로 분리되어 있어서 수정하지 않았다. 대신 4,166줄이던 `Memo.css`는 5단계에서 분할했다.

이후에도 파일은 커졌다. 이 글을 쓴 시각에 `Memo.tsx`는 917줄이었고, 프로젝트 관리 화면 `settings/ProjectsPane.tsx`는 3,307줄로 가장 컸다. 2단계 이후에 생긴 파일이므로 같은 기준을 적용했다. [#281](https://github.com/hyeoniverse/MacFolio/pull/281)에서 `ProjectsPane`을 `settings/projects/` 폴더의 파일 열한 개로 분할해, 현재 `ProjectsPane.tsx`는 281줄이다.

## 배운 것

- **순환은 공통 부분을 분리하면 해소된다.** 두 경우 모두 서로에게 필요한 것은 작은 타입과 이름 목록뿐이었다. 이를 세 번째 파일로 분리하니 단방향이 됐다.
- **오류 없이 넘어가던 지점을 오류로 바꿨다.** `flatMap`으로 제외되던 앱을 `throw`로 바꾼 것은 순환 분리의 부수 효과였지만, 앱을 추가할 때마다 누락을 검출한다.
- **줄 수는 다시 측정한다.** 계획 시점의 숫자(675줄)와 PR 직전(697줄)이 달랐다. 숫자는 PR을 올릴 시각에 다시 측정했다.

이전 단계: [1단계 — 타입과 데이터 구조](/memo/refactor-step1-types) · 다음 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation)

## 관련 글

- [madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기](/memo/break-import-cycles)
- [둘 이상이 쓰는 코드만 공유 모듈로 추출해 큰 데모 파일 분리하기](/memo/split-creative-demos)
- [import를 계산하는 분리 스크립트와 model 파일로 순환 없이 컴포넌트 나누기](/memo/split-sidebar-photos)
- [폴더 대신 _Api.ts·model.ts·use_.ts 파일 이름으로 앱 안의 파일 종류 구분하기](/memo/app-file-naming)
- [리팩터링 계획을 마치며 — 일곱 단계 전후](/memo/refactor-retrospective)

[^cycle]: 순환 의존(circular dependency)은 A가 B를 import하고 B가 다시 A를 import하는 구조다. 위의 `Mail.tsx`와 `MailMobile.tsx`가 그 예다.

#MacFolio #리팩터링 #의존성 #React
