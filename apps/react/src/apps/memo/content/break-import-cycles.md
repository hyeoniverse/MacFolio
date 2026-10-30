---
title: madge로 찾은 순환 import를 셋째 파일로 끊고 CI에서 막기
date: 2026-10-10
category: 개발 기록/MacFolio/구조·상태 관리
series: 모듈 구조
seriesOrder: 1
summary: madge로 측정하니 순환 의존이 둘 있었다. 메일의 두 화면이 서로를, 앱 목록(registry)과 Finder가 서로를 import했다. 공통 타입은 셋째 파일로, 앱 이름 목록은 manifest로 옮겨 끊고, pnpm cycles를 CI에 넣었다. 도구 비교와 현재 검사 파일 수를 더했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 2단계 "폴더 구조와 의존"의 첫 PR [#188](https://github.com/hyeoniverse/MacFolio/pull/188)이다. 순환 의존을 끊고, CI에서 막는다. 변경은 11개 파일, +772줄이고 그중 689줄은 madge를 추가하며 바뀐 `pnpm-lock.yaml`이다. 코드 변경은 80줄 정도다.

<details>
<summary>용어 정리</summary>

- **순환 의존(circular dependency)**: A가 B를 import하고 B가 A를 import하는 구조. 둘이 서로를 필요로 해서 어느 파일을 먼저 평가해야 하는지가 정해지지 않는다.
- **madge**: import 그래프를 만들어 순환을 찾는 도구([저장소](https://github.com/pahen/madge)). `--circular` 옵션을 주면 순환이 있을 때 종료 코드 1로 끝나므로 CI 검사로 사용할 수 있다.
- **lazy 로딩**: [`React.lazy`](https://react.dev/reference/react/lazy)로 컴포넌트 코드를 처음 표시하는 시각에 내려받는 방식. 번들러는 해당 모듈을 별도 청크로 분리한다.

</details>

## 순환 의존이 문제가 되는 이유

[ES 모듈](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)은 import한 파일을 먼저 평가하고, 파일 안의 코드는 위에서 아래로 실행한다. a.ts를 평가하다가 b.ts로 들어갔는데 b.ts가 a.ts의 값을 쓰면, 그 값은 아직 초기화되지 않은 상태다(`const`면 `ReferenceError`, 번들 결과에 따라 `undefined`). 타입만 가져오면 컴파일 시 import가 제거되어 문제가 없지만, 상수나 함수를 가져오면 import 순서만 바꿔도 실행이 실패하는 코드가 된다.

![순환 의존이 undefined를 만드는 순서](./images/break-import-cycles-init-order.svg 'a.ts를 평가하다 b.ts로 들어갔는데, b.ts가 아직 초기화되지 않은 a.ts의 값을 쓴다')

실행에 문제가 없더라도 두 가지 단점이 남는다.

| 단점           | 내용                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 계층이 사라짐  | 파일 구조는 "이 파일이 저 파일 위에 있다"는 의존 방향을 나타내야 한다. 서로 의존하면 둘 중 하나만 분리해 시험하거나 옮길 수 없다   |
| 청크 분리 방해 | Finder처럼 lazy로 불러오는 파일이 자기를 불러온 파일(registry)을 다시 import하면, 번들러가 두 모듈을 독립된 청크로 분리하기 어렵다 |

## 검사 도구 비교

| 도구                                                                                                           | 장점                                 | 단점                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| ESLint [`import/no-cycle`](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md) | 편집기에서 바로 표시된다             | 파일마다 그래프를 다시 탐색해 린트 실행 시간이 크게 늘어난다         |
| TypeScript 컴파일러                                                                                            | 추가 의존성이 없다                   | 순환을 오류로 취급하지 않는다                                        |
| **madge `--circular` (선택)**                                                                                  | 한 번에 전체 그래프, 순환이면 종료 1 | 의존성이 하나 늘고, 경로 별칭(`@/`)은 `--ts-config`로 알려 줘야 한다 |

순환 검사는 저장소 전체를 한 번 훑으면 충분한 검사라서, 린트와 별도로 한 번 실행하는 도구를 선택했다.

## 측정 결과: 순환 두 개

```text
1) apps/registry.ts > apps/finder/Finder.tsx
2) apps/mail/Mail.tsx > apps/mail/components/MailMobile.tsx
```

API는 Prisma가 생성한 코드(`generated/`)끼리만 순환이 있어서 그 폴더를 검사에서 제외하면 0개였고, `desktop-core`도 0개였다.

## 메일: 공통 타입을 셋째 파일로

`Mail.tsx`(데스크톱 화면)가 휴대폰 화면 `MailMobile.tsx`를 렌더링하고, `MailMobile.tsx`는 `Mail.tsx`에서 `ListMail`·`Mailbox` 타입을 import했다. 타입 import라 실행에는 영향이 없었지만 그래프상으로는 순환이다. 같은 이름표 상수(`MAILBOX_LABEL`)도 두 파일에 중복 정의되어 있었다.

두 화면이 함께 쓰는 `Mailbox`, `ListMail`, `MAILBOX_LABEL`을 `mail/model.ts`로 옮기고 양쪽이 이 파일을 import하게 했다.

> 규칙: 두 화면이 같은 타입을 쓰면 둘 중 하나가 아니라 셋째 파일(`model.ts`)에 정의한다.

![메일 앱의 순환 의존: 전과 후](./images/break-import-cycles-mail.svg '전에는 두 파일이 서로를, 후에는 둘 다 model.ts를 import한다')

## Finder: 앱 이름 목록을 manifest로

`registry.ts`는 앱 이름 → 컴포넌트 대응표이고, Finder를 `lazy()`로 불러온다. 그런데 Finder는 "창으로 열리는 앱 목록"을 표시하려고 `registry.ts`의 `WINDOW_APPS`를 다시 import했다. lazy 로딩이라 실행에는 문제가 없었지만, Finder에 필요한 값은 컴포넌트가 아니라 **앱 이름**뿐이다.

![registry와 Finder의 순환: 전과 후](./images/break-import-cycles-registry.svg 'Finder가 registry의 컴포넌트 표를 import하던 구조를, manifest의 이름 목록을 import하는 구조로')

앱 이름은 React에 의존하지 않는 `manifest.ts`가 이미 모두 보관하고 있다.

```ts
// manifest.ts
export const WINDOW_APP_NAMES = APP_NAMES.filter((name) => APP_MANIFEST[name].action === undefined);

// registry.ts
export const WINDOW_APPS = WINDOW_APP_NAMES.map((name) => {
	const Component = APP_COMPONENTS[name];
	if (!Component) throw new Error(`창으로 여는 앱인데 컴포넌트가 없다: ${name} (apps/registry.ts)`);
	return { name, Component };
});
```

`manifest.ts`에 `WINDOW_APP_NAMES`(`action`이 없는 앱, 즉 창으로 열리는 앱)를 정의하고 Finder는 이 목록을 import한다. `registry.ts`도 같은 목록에서 컴포넌트를 찾되, 처리 방식을 바꿨다.

| 상황                                   | 전 (`flatMap`)                                                      | 후 (`map` + `throw`)                             |
| -------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| manifest에 앱을 추가하고 컴포넌트 누락 | 목록에서 제외됨. Dock에 아이콘만 있고 창이 열리지 않은 채 배포 가능 | 모듈 평가 시각에 오류. 첫 화면에서 바로 드러난다 |

## CI 연결

루트 `package.json`에 `pnpm cycles` 스크립트를 추가하고([CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)에도 규칙을 적었다), CI의 `check` 작업에서 린트 다음 단계로 실행한다. 순환이 하나라도 생기면 PR 검사가 실패한다.

```yaml
# .github/workflows/ci.yml
- name: 린트
  run: pnpm lint

- name: 순환 의존 (madge)
  run: pnpm cycles
```

처음에는 `apps/react`, `apps/api`(`generated/` 제외), `packages/desktop-core` 세 묶음을 검사했다. 이후 `packages/contracts`([zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments))가 생기며 넷째 묶음이 되었고, 공유 카드 패키지 `packages/og-card`([#306](https://github.com/hyeoniverse/MacFolio/pull/306))가 다섯째 묶음이 되었다.

![pnpm cycles가 검사하는 파일 수](./images/break-import-cycles-files.svg '2026-10-23 기준 다섯 묶음에서 862개 파일을 검사한다')

2026-10-23에 로컬에서 실행한 결과는 react 624개 파일 1.7초, api 163개 0.5초, desktop-core 46개, contracts 27개, og-card 2개는 각각 0.3초 이하다. 다섯 묶음 모두 `No circular dependency found!`를 출력한다.

<details>
<summary>pnpm cycles 스크립트 전체</summary>

```json
"cycles": "madge --circular --extensions ts,tsx --ts-config apps/react/tsconfig.json apps/react/src && madge --circular --extensions ts --ts-config apps/api/tsconfig.json --exclude 'generated/' apps/api/src && madge --circular --extensions ts --ts-config packages/desktop-core/tsconfig.json packages/desktop-core/src && madge --circular --extensions ts --ts-config packages/contracts/tsconfig.json packages/contracts/src && madge --circular --extensions ts --ts-config packages/og-card/tsconfig.json packages/og-card/src"
```

`--ts-config`는 `@/` 같은 경로 별칭을 실제 파일 경로로 변환하는 데 필요하다. 생략하면 별칭 import를 따라가지 못해 그래프에서 빠진다.

</details>

## 남은 것, 배운 것

- madge는 `import type`도 그래프에 포함한다. 메일의 순환은 실행에 영향이 없는 타입 import였다. 실행 순서 문제만 막으려면 타입 import를 제외할 수도 있지만, 계층을 지키려는 목적에는 타입까지 검사하는 편이 맞아 그대로 두었다.
- 순환을 끊는 방법은 두 가지로 정리된다. 둘이 함께 쓰는 것을 셋째 파일로 옮기거나(메일), 실제로 필요한 값이 더 작은 단위인지 확인해 그 값만 import한다(Finder는 컴포넌트가 아니라 이름만 필요했다).
- 순환을 끊으면서 `flatMap`으로 조용히 제외되던 처리를 `throw`로 바꿨다. 앱을 추가하고 컴포넌트 연결을 빠뜨리면 이제 첫 화면에서 바로 오류가 난다.

## 따라 해 보기

```bash
pnpm cycles
# ✔ No circular dependency found!  (묶음마다 한 번, 다섯 번)
```

순환이 있으면 madge가 `a.ts > b.ts`처럼 고리를 출력한다. 이 글의 두 풀이 중 맞는 것을 고른다.

1. 두 파일이 같은 타입을 나눠 쓰느라 서로를 import한다 → 그 타입을 셋째 파일(`model.ts`)로 옮긴다
2. 목록이 화면 컴포넌트를 import하고 화면이 다시 목록을 import한다 → 이름 같은 데이터만 별도 파일(`manifest.ts`)에 두고 화면은 그 파일만 import한다

CI의 `check` 작업에도 같은 명령이 있어서([.github/workflows/ci.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/ci.yml)), 순환을 새로 만든 PR은 병합되지 않는다.

## 관련 글

- [순환 의존 차단과 큰 파일 분할로 정리한 모듈 구조](/memo/refactor-step2-structure)
- [폴더 대신 _Api.ts·model.ts·use_.ts 파일 이름으로 앱 안의 파일 종류 구분하기](/memo/app-file-naming)
- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [Resend API와 Turnstile로 서버에서 메일 발송하고 스팸 차단하기](/memo/contact-mail)
- [openRequest store로 Finder에서 고른 항목을 다른 앱에서 열기](/memo/finder-app)

#MacFolio #리팩터링 #madge #순환의존
