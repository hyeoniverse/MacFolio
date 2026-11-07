---
title: npm 별칭으로 TypeScript 7 tsc와 TypeScript 6 typescript-eslint 함께 쓰기
date: 2026-10-12
category: 개발 기록/MacFolio/테스트·보안·성능
summary: Dependabot의 TypeScript 7 PR이 린트 단계에서 실패했다. typescript 이름에는 TS 6 호환 패키지를, @typescript/native에는 TS 7을 npm 별칭으로 지정해 tsc는 7로, typescript-eslint는 6 API로 실행되게 했다. 타입 체크는 약 23초에서 5초로 줄었다.
---

Dependabot이 `typescript`를 `5.9.3`에서 `7.0.2`로 올리는 PR([#215](https://github.com/hyeoniverse/MacFolio/pull/215))을 열었고, CI는 포맷 검사를 통과한 뒤 린트 단계에서 실패했다. 원인은 TypeScript 7이 컴파일러를 Go로 새로 작성하면서 린트 도구가 사용하던 JavaScript API를 아직 제공하지 않는다는 점이었다. `typescript`라는 패키지 이름에는 TS 6 호환 패키지를, 별도 이름에는 TS 7을 설치해 두 버전을 함께 사용하는 방식으로 해결했고, React 앱의 타입 체크 시간은 약 23초에서 5초로 줄었다.

## 배경

### TypeScript와 tsc

TypeScript는 JavaScript에 타입 표기를 더한 언어다. 브라우저와 Node.js는 TypeScript를 직접 실행하지 못하므로, 컴파일러 `tsc`가 두 가지 일을 한다.

1. **타입 체크**: 코드 전체를 읽어 타입이 맞지 않는 곳을 오류로 보고한다. 예를 들어 `const n: number = 'abc'`는 `Type 'string' is not assignable to type 'number'` 오류가 된다.
2. **변환(emit)**: 타입 표기를 제거한 JavaScript 파일을 출력한다.

이 저장소의 React 앱은 변환을 Vite가 맡고, `tsc`는 `--noEmit`으로 타입 체크만 한다(`pnpm typecheck`). API 서버는 `tsc -p tsconfig.build.json`으로 타입 체크와 변환을 함께 실행한다.

### 이 저장소의 구성과 CI

이 저장소는 pnpm 워크스페이스[^workspace]로, 네 패키지(React 앱, API, `contracts`, `desktop-core`)가 각각 `typescript`를 devDependency로 선언한다. CI는 다음 순서로 실행되고, 앞 단계가 실패하면 뒤 단계는 실행하지 않는다.

```text
포맷 검사 → 린트 → 순환 의존 검사 → 타입 체크 → 단위 시험 → 빌드 → E2E
```

의존성 업데이트 PR은 GitHub의 봇인 Dependabot이 연다. Dependabot은 설정 파일(`.github/dependabot.yml`)에 따라 각 패키지의 새 버전을 조회하고, `package.json`과 잠금 파일을 수정한 PR을 생성한다. CI를 통과하면 병합한다.

### TypeScript 7: Go로 작성한 컴파일러

TypeScript 5·6의 컴파일러는 TypeScript로 작성되어 JavaScript로 실행된다. TypeScript 7은 같은 컴파일러를 Go로 옮긴 버전이다. Go 프로그램은 기계어로 컴파일되어 실행되고, 여러 CPU 코어에서 파일을 병렬로 검사할 수 있다. TypeScript 팀은 7.0이 6.0보다 ==많은 프로젝트에서 약 10배 빠르다==고 발표했다.

![VS Code, Sentry, Bluesky, Playwright, tldraw 코드베이스에서 TypeScript 6과 7의 컴파일 시간을 비교한 막대그래프. VS Code는 125.7초에서 10.6초로 11.9배 빨라졌다](./images/typescript-7-side-by-side-speedup.png 'TypeScript 팀이 TypeScript 7.0 발표에 실은 컴파일 시간 비교. 주황이 TS 6, 파랑이 TS 7이고 오른쪽 숫자가 속도 배율이다')

이번 PR은 5에서 6을 건너뛰고 7로 올리는 내용이었다. 메이저 버전이 바뀌었을 뿐 아니라 컴파일러 구현 자체가 바뀌었으므로, 버전 번호만 수정해서는 CI를 통과하지 않았다.

## 린트 실패 원인

### 린트 도구가 컴파일러를 호출하는 방식

**린트**(lint)는 코드를 실행하지 않고 읽어서 실수나 규칙 위반을 찾는 검사다. 이 저장소는 ESLint를 사용하고, TypeScript 문법을 읽기 위해 typescript-eslint 플러그인을 함께 쓴다. typescript-eslint는 TypeScript 코드를 직접 해석하지 않고 `typescript` 패키지를 import해 그 안의 컴파일러 함수를 호출한다. 이 함수 묶음을 컴파일러의 **JavaScript API**라고 부른다.

- **파서**: 소스 파일을 구문 트리(코드를 문법 단위로 나눈 트리 구조)로 바꿀 때 TypeScript의 파서를 호출한다.
- **타입 정보 규칙**: 예를 들어 typescript-eslint의 `no-floating-promises` 규칙은 "이 함수 호출이 Promise를 반환하는데 `await`하지 않았다"를 판정해야 하므로, `ts.createProgram`으로 프로젝트 전체를 읽고 타입 검사기(`getTypeChecker`)에 반환 타입을 질의한다.

![ESLint가 typescript-eslint를 거쳐 typescript 패키지의 JavaScript API를 호출하는 경로와, TS 7에서는 그 API가 없어 린트가 중단되는 모습](./images/typescript-7-side-by-side-lint-api.svg 'typescript-eslint는 typescript 패키지의 JavaScript API를 호출한다. 7.0에는 이 API가 없다')

TypeScript 7.0은 이 JavaScript API를 아직 제공하지 않는다. TypeScript 팀은 새 API를 7.1에서 제공할 예정이라고 밝혔다. 그래서 `typescript` 패키지가 7이 되면 typescript-eslint는 ==실행 자체가 불가능==하고, 시작 단계에서 다음 오류를 출력한다. typescript-eslint 문서가 명시한 지원 범위도 `>=4.8.4 <6.1.0`이다.

```text
Error: typescript-eslint does not support TS 7.0.
```

### 다음 단계의 실패: baseUrl 제거

린트를 통과하더라도 다음 단계인 타입 체크가 React 앱에서 실패했다. TypeScript 7은 오래된 설정 옵션 몇 가지를 제거했고, 그중 하나가 `baseUrl`이다.

```text
tsconfig.json(18,3): error TS5102: Option 'baseUrl' has been removed.
```

| 단계      | 실패 원인                                                  |
| --------- | ---------------------------------------------------------- |
| 린트      | typescript-eslint가 TS 7의 JavaScript API를 사용할 수 없다 |
| 타입 체크 | React 앱 `tsconfig.json`의 `baseUrl` 옵션이 7에서 제거됨   |

## 검토한 방법

| 방법                                  | 장점                                     | 단점                                                             |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| PR을 닫고 5.9 유지                    | 변경할 것이 없다                         | 7의 빠른 타입 체크를 사용할 수 없다. Dependabot이 PR을 다시 연다 |
| 7로 올리고 린트를 일시 비활성화       | 패키지가 하나다                          | typescript-eslint가 7을 지원할 때까지 린트가 없다                |
| 별칭으로 6과 7을 함께 설치 (**채택**) | 린트 규칙은 그대로, 타입 체크와 빌드는 7 | `package.json`마다 두 줄, 잠금 파일이 커진다                     |

린트 비활성화는 채택하지 않았다. typescript-eslint는 타입 정보를 쓰는 규칙을 켜지 않아도 파서로 `typescript`를 불러온다. 그래서 ==일부 규칙만 끄는 방법은 없고 린트 전체를 꺼야 한다.== 사용하지 않는 변수, React 훅 규칙, Fast Refresh 규칙 검사를 몇 달 동안 잃는 것보다 패키지 두 개를 관리하는 비용이 작다고 판단했다.

## 6과 7을 함께 설치

### npm 별칭

보통 `package.json`의 `"typescript": "^5.9.3"`은 레지스트리의 `typescript` 패키지를 `node_modules/typescript` 폴더에 설치한다. 버전 자리에 `npm:실제패키지@버전`을 적으면 [npm 별칭](https://pnpm.io/aliases)[^alias]이 되어, **설치 폴더 이름**과 **실제로 받는 패키지**를 다르게 지정할 수 있다.

```json
{
	"devDependencies": {
		"@typescript/native": "npm:typescript@~7.0.2",
		"typescript": "npm:@typescript/typescript6@^6.0.2"
	}
}
```

TypeScript 팀은 이런 전환을 위해 TS 6 API를 다시 내보내는 호환 패키지 `@typescript/typescript6`을 배포했다. 이 패키지의 실행 파일 이름은 `tsc6`이라 TS 7의 `tsc`와 충돌하지 않는다. TypeScript 7.0 발표 글도 같은 두 줄 구성을 안내한다. 위 설정으로 설치하면 `node_modules`는 다음과 같다.

```text
node_modules/
├─ typescript/              ← 실제 내용: @typescript/typescript6 6.0.x (TS 6 API, 실행 파일 tsc6)
└─ @typescript/native/      ← 실제 내용: typescript 7.0.x (실행 파일 tsc)
```

- typescript-eslint처럼 `import ts from 'typescript'`를 하는 도구는 `node_modules/typescript`를 읽으므로 6 API를 받는다.
- `pnpm typecheck`(`tsc`)와 API 빌드(`tsc -p tsconfig.build.json`)는 `@typescript/native`가 제공하는 `tsc` 실행 파일, 즉 7로 실행된다.

React 앱, API, `contracts`, `desktop-core` 네 패키지에 같은 두 줄을 추가했다.

| 호출 방식                     | 설치 이름            | 실제 패키지                     | 사용하는 도구                        |
| ----------------------------- | -------------------- | ------------------------------- | ------------------------------------ |
| `import ts from 'typescript'` | `typescript`         | `@typescript/typescript6@6.0.x` | typescript-eslint                    |
| `tsc` 실행 파일               | `@typescript/native` | `typescript@7.0.x`              | `pnpm typecheck`, API 빌드           |
| `tsc6` 실행 파일              | `typescript`         | `@typescript/typescript6@6.0.x` | 버전 비교용 (일반 작업에서는 미사용) |

![typescript 이름에는 TS 6 호환 패키지, @typescript/native에는 TS 7을 달아 린트와 tsc가 각자 맞는 버전을 쓴다](./images/typescript-7-side-by-side-alias.svg 'npm 별칭으로 두 버전을 나란히')

## baseUrl 삭제

`paths`는 import 경로의 별칭을 정의하는 옵션이다. 이 저장소의 React 앱은 `@/`를 `src/`의 별칭으로 쓴다. 예를 들어 `src/apps/memo/writer/` 안의 파일에서도 `'../../../shared/ui/button/Button'` 대신 `'@/shared/ui/button/Button'`이라고 적는다. `baseUrl`은 `paths`에 적은 상대 경로의 기준 폴더를 지정하던 옵션이고, 7에서는 `paths`를 tsconfig 파일 위치 기준의 상대 경로로 작성한다([TSConfig `paths` 문서](https://www.typescriptlang.org/tsconfig/#paths)).

```diff
-		"baseUrl": ".",
 		"paths": {
-			"@/*": ["src/*"]
+			"@/*": ["./src/*"]
 		}
```

![import '@/apps/memo/Memo'가 baseUrl을 쓰던 설정과 ./src/* 설정에서 모두 apps/react/src/apps/memo/Memo.tsx로 해석되는 모습](./images/typescript-7-side-by-side-paths.svg 'baseUrl이 "."이었으므로 ./src/*로 바꿔도 해석 결과는 같다')

`baseUrl`이 tsconfig 파일이 있는 폴더(`.`)였으므로, 경로 앞에 `./`를 붙이면 해석 결과가 같다.

> [!NOTE]
> `@/` 별칭은 Vite 설정(`resolve.alias`)이 따로 처리하므로 빌드 결과는 바뀌지 않는다. tsconfig의 `paths`는 타입 체크와 편집기의 경로 해석에만 쓰인다.

## 구현 순서

1. Dependabot 브랜치에 main을 병합해 최신 상태로 맞췄다.
2. 네 패키지의 `package.json`에서 `typescript` 한 줄을 위의 두 줄로 바꿨다.
3. React 앱 `tsconfig.json`에서 `baseUrl`을 삭제하고 `paths`를 `./src/*`로 수정했다.
4. `pnpm install`로 잠금 파일을 다시 생성했다. `pnpm-lock.yaml`이 648줄 바뀌었는데, 대부분 typescript-eslint 패키지들이 의존하는 `typescript`가 `@typescript/typescript6@6.0.2`로 바뀌면서 항목 이름이 다시 기록된 것이다.

변경된 파일은 이 글을 제외하면 여섯 개다(`package.json` 네 개, `tsconfig.json`, 잠금 파일).

## 확인

- 포맷 검사, 린트(typescript-eslint는 6 API 사용), 순환 의존 검사 통과
- 타입 체크 여섯 작업이 TS 7(`tsc` 7.0.2)로 통과
- 단위 시험 682개(React 339, API 157, desktop-core 153, contracts 33), 빌드 통과
- 설치된 두 실행 파일의 버전: `tsc -v`는 `Version 7.0.2`, `tsc6 -v`는 `Version 6.0.3`

속도 차이도 측정했다. 두 실행 파일이 함께 설치되어 있으므로 같은 `apps/react/tsconfig.json`을 `--noEmit`으로 두 번씩 실행했다.

| 실행 파일      | 1회    | 2회    |
| -------------- | ------ | ------ |
| `tsc` (7.0.2)  | 5.2초  | 4.2초  |
| `tsc6` (6.0.3) | 23.1초 | 22.7초 |

![TS 7 tsc는 4~5초, TS 6 tsc6은 약 23초 걸린 막대 그림](./images/typescript-7-side-by-side-time.svg 'React 앱 타입 체크 시간')

`npx` 시작 시간이 포함된 값이라 정밀한 벤치마크는 아니지만, ==4~5배 차이는 명확하다.== 공식 발표의 약 10배보다 배율이 작은 것은 이 프로젝트가 작아서 프로세스 시작처럼 크기와 무관한 시간이 차지하는 비율이 크기 때문으로 추정한다. 자주 실행하는 `pnpm typecheck`의 대기 시간이 그만큼 줄었다.

## 남은 과제

- typescript-eslint가 7을 지원하면 `typescript` 별칭을 삭제하고 7 하나로 통합한다. 그 시각에는 네 `package.json`에서 한 줄씩 삭제하면 된다.
- 6과 7이 같은 코드를 다르게 판정할 가능성이 있다. 위에서 두 실행 파일을 실행했을 때는 둘 다 오류 없이 끝났다.
- 메이저 버전 PR이 실패하면 "올릴지 말지"만 판단하지 않는다. 도구마다 필요한 버전이 다르면 두 버전을 함께 설치하는 방법이 있는지 먼저 확인한다. npm 별칭(`npm:패키지@버전`)이 이 경우에 적합하다.

## 적용 방법

[apps/react/package.json](https://github.com/hyeoniverse/MacFolio/blob/main/apps/react/package.json)처럼 두 버전을 별칭으로 함께 설치한다. 컴파일러는 7, typescript-eslint가 읽는 `typescript`는 6이다.

```json
"@typescript/native": "npm:typescript@~7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

```bash
pnpm install
pnpm typecheck      # TS 7
pnpm lint           # typescript-eslint는 TS 6을 읽는다
```

typescript-eslint가 7을 지원하면 `typescript` 별칭을 7로 바꾸고 `@typescript/native`를 삭제한다. 되돌릴 때도 이 두 줄만 수정하면 된다.

## 관련 글

- [main 커밋 기록 집계로 Merge commit 병합 전략 정하기](/memo/macfolio-merge-strategy): 같은 날 의존성 PR을 병합한 방식과, 브랜치에 main을 합친 머지 커밋을 유지하는 이유
- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies): 세 방식의 차이와 고르는 기준
- [10월 12일 - 사용처를 집계한 뒤 추출한 Modal, TypeScript 7, 메모 각주와 접기 블록, 템플릿 재작업](/memo/day-1012): 그날의 작업 기록
- [pnpm overrides·Actions 커밋 SHA 고정·gitleaks로 의존성과 CI 공급망 보안 강화하기](/memo/supply-chain-security): 이 PR을 연 Dependabot 설정

PR: [#215](https://github.com/hyeoniverse/MacFolio/pull/215)

<details>
<summary>참고 문헌</summary>

- TypeScript 블로그, [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (Running Side-by-Side with TypeScript 6.0, 제거된 옵션 목록)
- TypeScript 블로그, [A 10x Faster TypeScript](https://devblogs.microsoft.com/typescript/typescript-native-port/)
- TypeScript 문서, [TSConfig Reference: paths](https://www.typescriptlang.org/tsconfig/#paths)
- TypeScript 문서, [Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html)
- typescript-eslint 문서, [Dependency Versions](https://typescript-eslint.io/users/dependency-versions/)
- typescript-eslint 문서, [Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting/)
- typescript-eslint 문서, [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/)
- pnpm 문서, [Aliases](https://pnpm.io/aliases)
- pnpm 문서, [Workspace](https://pnpm.io/workspaces)
- GitHub 문서, [About Dependabot version updates](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/about-dependabot-version-updates)

</details>

<details>
<summary>사진 출처</summary>

- TypeScript 6과 7의 컴파일 시간 비교: Daniel Rosenwasser / Microsoft TypeScript 블로그, [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), 2026년 7월, 출처 표기

</details>

[^workspace]: 저장소 하나에 여러 패키지를 두고 잠금 파일 하나(`pnpm-lock.yaml`)로 의존성을 함께 설치하는 구성. 패키지끼리는 `workspace:` 프로토콜로 서로를 의존한다.

[^alias]: `"이름": "npm:실제패키지@버전"` 형식으로, 레지스트리의 다른 패키지를 지정한 이름으로 설치하는 기능. 같은 패키지의 두 버전을 서로 다른 이름으로 함께 설치할 수 있다.

#MacFolio #TypeScript #CI #의존성
