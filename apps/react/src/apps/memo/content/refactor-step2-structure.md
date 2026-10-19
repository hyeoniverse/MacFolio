---
title: 리팩터링 2단계 — 폴더 구조와 의존
date: 2026-10-18
category: 개발기/MacFolio/프론트엔드
summary: 리팩터링 2단계를 돌아본다. 순환 의존 둘을 셋째 파일로 풀고 madge로 CI가 막게 했고, 1,861줄 데모 파일 등 큰 파일 넷을 조각으로 나눴고, 앱 안 파일은 폴더 대신 이름 규칙으로 맞췄다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 2단계는 파일이 어디에 있고 무엇을 import하는지를 정리하는 일이었다.

## 왜

- `Mail.tsx`와 `MailMobile.tsx`가 서로를 import했다.
- 큰 파일이 여럿이었다: `CreativeDemos.tsx` 1,861줄, `CreativeCms.tsx` 970줄, `Memo.tsx` 830줄, `FolderSidebar.tsx` 675줄, `PhotosMobile.tsx` 662줄.
- 앱 폴더마다 파일을 두는 방식이 달랐다. 서버를 부르는 파일이 `githubActivity.ts`, `captions.ts`, `attachments.ts`처럼 이름만으로는 화면 조각인지 서버 호출인지 알 수 없었다.

순환 의존은 당장 깨지는 것은 없었다. 하지만 모듈을 읽는 순서에 따라 한쪽 값이 `undefined`로 읽힐 수 있고, 지연 로딩(`lazy`)으로 나눠 둔 덩어리가 서로를 끌어와 첫 화면 번들이 커질 수 있다. 실제로 `registry.ts`의 주석에는 "Finder가 이 목록을 다시 읽으므로 지연 로딩이어야 한다"는 조건이 적혀 있었다. 순환을 지키려고 다른 곳에 규칙을 거는 모양이었다.

큰 파일은 고칠 때마다 PR의 diff가 커졌다. 1,861줄 `CreativeDemos.tsx` 하나에 데모 열 가지가 들어 있어서, 음성 데모 하나를 고쳐도 리뷰할 때 같은 파일의 다른 데모 코드를 함께 넘겨 봐야 했다.

## 고른 방법과 버린 방법

| 문제           | 버린 방법                                                 | 고른 방법                                                      |
| -------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| 순환 의존      | 한쪽 import를 동적 `import()`로 바꿔 순환을 숨기기        | 공통 부분을 셋째 파일로 꺼내 한 방향으로                       |
| 다시 생기는 것 | ESLint `import/no-cycle` 규칙                             | madge를 `pnpm cycles`로 두고 CI의 `check`에 넣기               |
| 파일 놓을 곳   | 앱마다 `api/`·`hooks/`·`components/` 폴더를 일괄로 만들기 | 이름 규칙(`*Api.ts`, `model.ts`, `use*.ts`) + 셋 이상이면 폴더 |

동적 `import()`는 madge에도 순환으로 잡히지 않게 할 수 있지만, 순환 자체는 그대로 남는다. ESLint의 `import/no-cycle`은 파일마다 그래프를 다시 그려 느리고, 이 저장소의 린트 설정에 플러그인을 하나 더 들여야 했다. madge는 한 번 실행으로 네 패키지를 모두 본다.

폴더를 일괄로 만들면 파일이 하나뿐인 폴더가 잔뜩 생긴다. 앱 대부분은 파일이 열 개 안쪽이라, 이름만 맞춰도 같은 종류끼리 정렬되어 보인다.

10월 10일 저녁, 2단계를 시작하며 순서부터 다시 따졌다. 계획에는 1단계(타입과 데이터 구조)가 먼저였지만, 타입을 옮기려면 그 타입이 들어갈 폴더 구조가 먼저 있어야 했다. 그래서 2 → 3 → 1 순서로 가기로 했다. 폴더를 나누는 방법은 두 안이 있었는데, 규모나 복잡도가 아니라 코드 품질만 놓고 실무에서 맞는 쪽(위 표의 고른 방법)을 골랐다. 작업 중에 "순환 의존"이 무엇인지도 정리했다. A가 B를 import하고 B가 다시 A를 import하는 것으로, 위의 `Mail.tsx`와 `MailMobile.tsx`가 그 예다.

## 무엇을 바꿨나

| 항목                                   | PR   | 글                                                                                 |
| -------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| 순환 의존 풀기와 `pnpm cycles`         | #188 | [서로 import하는 파일 둘을 풀고, 다시 생기면 CI가 막게](/memo/break-import-cycles) |
| `CreativeDemos.tsx` 나누기             | #189 | [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos)           |
| `FolderSidebar.tsx`·`PhotosMobile.tsx` | #190 | [폴더 사이드바와 휴대폰 사진 앱을 조각으로](/memo/split-sidebar-photos)            |
| 앱 안의 파일 이름 규칙                 | #191 | [폴더 대신 이름으로](/memo/app-file-naming)                                        |
| `CreativeCms.tsx` 나누기               | #193 | (데모 글의 끝에서 함께 다룸)                                                       |

## 구현

### 순환 둘을 셋째 파일로

순환은 둘이었다. 메일은 데스크톱 `Mail.tsx`가 휴대폰 화면 `MailMobile.tsx`를 그리고, `MailMobile.tsx`는 `Mail.tsx`에 있던 메일 한 통의 타입(`ListMail`)과 편지함 이름을 가져다 썼다. 둘이 같이 쓰는 것만 `mail/model.ts`로 옮겼다.

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

registry↔Finder는 Finder가 "창으로 열리는 앱 목록"을 얻으려고 `registry.ts`를 읽고, `registry.ts`는 Finder 컴포넌트를 들고 있어서 생겼다. 이름 목록은 React를 모르는 `manifest.ts`가 이미 다 갖고 있으므로, 거기에 `WINDOW_APP_NAMES`를 두고 Finder는 그것을 읽게 했다. 이때 `registry.ts`가 목록에 있는데 컴포넌트가 없는 앱을 조용히 빼던 것을 바로 오류로 바꿨다.

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

전에는 앱을 더하고 컴포넌트 연결을 잊으면 Dock에 아이콘만 있고 창이 열리지 않는 채로 지나갈 수 있었다.

다시 생기지 않게 루트 `package.json`에 `cycles` 스크립트를 두었다. 처음에는 react·api·desktop-core 셋을 봤고, 1단계에서 생긴 contracts까지 지금은 넷을 본다.

```json
"cycles": "madge --circular --extensions ts,tsx --ts-config apps/react/tsconfig.json apps/react/src && madge --circular … apps/api/src && … packages/desktop-core/src && … packages/contracts/src"
```

### 큰 파일을 조각으로

나누는 기준은 "한 파일에 화면 하나"였다. 데모 파일은 데모마다, CMS 도식은 도식마다 한 파일로 뺐고, 여럿이 같이 쓰는 것(색 계산 `color.ts`, 화면에 들어왔는지 보는 `useInView.ts`, 데모 틀 `Demo.tsx`)은 따로 두었다. 사이드바와 휴대폰 사진 앱은 줄 단위 부품(`FolderRow.tsx`, `PhotoGrid.tsx`)과 큰 보기(`PhoneViewer.tsx`), 순수 계산(`folderSidebar.model.ts`, `photosMobile.model.ts`)으로 나눴다.

![나누기 전 파일과 나눈 뒤 가장 큰 조각의 줄 수](./images/refactor-step2-structure-sizes.svg '가장 큰 조각도 400줄 안쪽이 됐다')

옮긴 뒤 diff를 `git diff -M`으로 보면 대부분 "옮김"으로 잡히도록, 함수 본문은 고치지 않고 위치만 옮겼다. 데모의 색 계산처럼 순수 함수가 드러난 곳에만 단위 시험을 더했다. 색 계산은 컴포넌트 파일 안에 있어 시험이 없었는데, `creative/color.test.ts`에 7개가 생겼다.

### 이름 규칙

#191에서 이름이 규칙과 어긋난 파일 아홉 개를 맞췄다. 몇 개만 보면 이렇다.

| 전                           | 후                                | 까닭                    |
| ---------------------------- | --------------------------------- | ----------------------- |
| `github/githubActivity.ts`   | `github/githubActivityApi.ts`     | 서버를 부른다           |
| `photos/captions.ts`         | `photos/captionsApi.ts`           | 서버를 부른다           |
| `memo/admin.ts`              | `memo/useCanEditMemo.ts`          | 훅이다                  |
| `memo/writer/popover.ts`     | `memo/writer/usePopover.ts`       | 훅이다                  |
| `memo/writer/attachments.ts` | 서버 호출만 `attachmentsApi.ts`로 | 계산과 서버 호출이 섞임 |

`githubActivity.ts`는 대소문자만 다른 `GithubActivity.tsx`와 맥에서 부딪힌 적이 있는 파일이다([메뉴 막대의 Wi-Fi 자리에 서버 상태 띄우기](/memo/server-status-wifi) 끝 부분). 이름 규칙을 정하자 그런 짝이 생길 일이 줄었다.

![두 순환 의존을 셋째 파일로 푼 모양과 파일 이름 규칙 네 가지](./images/refactor-step2-structure-cycles.svg '서로 import하던 짝은 공통 부분을 셋째 파일로 꺼내 한 방향으로 만들었다')

파일 규칙은 폴더 대신 이름으로 정했다. 서버 호출은 `*Api.ts`, 순수 계산은 `model.ts`, 훅은 `use*.ts`, 화면 조각은 `PascalCase.tsx`이고, 셋 이상이면 `components/`로 묶는다. 어긋난 파일 아홉 개의 이름을 맞췄다.

## 전후

|                         | 전      | 후                                 |
| ----------------------- | ------- | ---------------------------------- |
| 순환 의존               | 2개     | 0개, CI가 막음                     |
| `CreativeDemos.tsx`     | 1,861줄 | `creative/`에 데모마다 한 파일     |
| `CreativeCms.tsx`       | 970줄   | `creative/cms/`에 도식마다 한 파일 |
| 이름 규칙에 어긋난 파일 | 9개     | 0개                                |

## 확인

- `pnpm cycles`가 네 패키지 모두 순환 0개로 끝난다. CI 워크플로(`ci.yml`)에 이 단계를 넣어, 순환이 생기면 PR이 실패한다.
- 나누기 PR(#189·#190·#193)은 E2E 파일을 하나도 고치지 않았다. 화면 동작이 그대로라 기존 E2E가 그대로 통과해야 했다.
- 줄 수는 머지 커밋에서 `wc -l`로 쟀다. 데모 PR(#189)은 1,861줄을 지우고 새 파일 16개에 2,007줄을 더했다. 늘어난 줄은 파일마다 붙은 import와 머리 주석이다.

## 일부러 남긴 것

`Memo.tsx`(830줄)는 이미 `useMemoLibrary`·`useNoteView`·`useNoteDrag`·`useTrash` 같은 훅으로 나뉘어 있어서 손대지 않았다. 대신 4,166줄이던 `Memo.css`는 5단계에서 나눴다.

그 뒤로도 파일은 자란다. 지금 `Memo.tsx`는 917줄이고, 프로젝트 관리 화면 `settings/ProjectsPane.tsx`는 3,307줄로 가장 크다. 2단계 이후에 생긴 파일이라 같은 기준으로 다시 나눌 차례다.

## 배운 것

- **순환은 공통 부분을 꺼내면 풀린다.** 두 경우 모두 "서로가 필요한 것"은 작은 타입과 이름 목록뿐이었다. 둘을 셋째 파일로 꺼내니 한 방향이 됐다.
- **조용히 넘어가던 곳을 오류로 바꿨다.** `flatMap`으로 빠지던 앱을 `throw`로 바꾼 것은 순환 풀기의 덤이었지만, 앱을 더할 때마다 쓸모가 있다.
- **줄 수는 다시 잰다.** 계획을 세울 때의 숫자(675줄)와 PR 직전(697줄)이 달랐다. 숫자는 PR을 낼 때 다시 쟀다.

관련 글: [서로 import하는 파일 둘을 풀고, 다시 생기면 CI가 막게](/memo/break-import-cycles) · [1,861줄짜리 데모 파일을 데모마다 한 파일로](/memo/split-creative-demos) · [폴더 대신 이름으로](/memo/app-file-naming). PR: [#188](https://github.com/hyeoniverse/MacFolio/pull/188), [#189](https://github.com/hyeoniverse/MacFolio/pull/189), [#191](https://github.com/hyeoniverse/MacFolio/pull/191).

이전 단계: [1단계 — 타입과 데이터 구조](/memo/refactor-step1-types) · 다음 단계: [3단계 — 공통 기반 코드](/memo/refactor-step3-foundation)

#MacFolio #리팩터링 #의존성 #React
