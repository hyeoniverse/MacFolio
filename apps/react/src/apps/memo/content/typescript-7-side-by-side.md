---
title: TypeScript 7로 올리기 — 컴파일러는 7, 린트는 6을 나란히
date: 2026-10-12
category: 개발기/MacFolio/인프라
summary: Dependabot의 TypeScript 7 PR이 린트 단계에서 실패했다. typescript 이름에는 TS 6 호환 패키지를, @typescript/native에는 TS 7을 npm 별칭으로 지정해 tsc는 7로, typescript-eslint는 6 API로 실행되게 했다. 타입 체크는 약 23초에서 5초로 줄었다.
---

Dependabot이 `typescript`를 `5.9.3`에서 `7.0.2`로 올리는 PR([#215](https://github.com/hyeoniverse/MacFolio/pull/215))을 열었다. CI는 포맷 검사를 통과한 뒤 린트 단계에서 실패했다.

## 배경

이 저장소는 pnpm 워크스페이스로, 네 패키지(React 앱, API, `contracts`, `desktop-core`)가 각각 `typescript`를 devDependency로 선언한다. CI는 포맷 검사 → 린트 → 순환 의존 검사 → 타입 체크 → 단위 시험 → 빌드 → E2E 순서로 실행된다. 의존성 PR은 Dependabot이 열고, CI를 통과하면 병합한다.

이번 PR은 5에서 6을 건너뛰고 7로 올리는 내용이었다. 7은 메이저 버전일 뿐 아니라 컴파일러를 Go로 새로 작성한 버전이라, 버전 번호만 올려서는 통과하지 않았다.

```text
Error: typescript-eslint does not support TS 7.0.
```

## 린트 실패 원인

TypeScript 7은 컴파일러를 Go로 새로 작성한 버전이다. 같은 코드를 훨씬 빠르게 검사하지만, 5·6에 있던 JavaScript API(`import ts from 'typescript'`로 호출하던 컴파일러 함수)가 아직 없다. typescript-eslint는 타입 정보를 사용하는 규칙을 위해 이 API를 직접 호출하므로, `typescript` 패키지가 7이 되면 실행 자체가 불가능하다. typescript-eslint는 7.1 이후를 지원할 계획이다.

| 단계      | 실패 원인                                                  |
| --------- | ---------------------------------------------------------- |
| 린트      | typescript-eslint가 TS 7의 JavaScript API를 사용할 수 없다 |
| 타입 체크 | React 앱 `tsconfig.json`의 `baseUrl` 옵션이 7에서 제거됨   |

린트 단계를 통과하더라도 다음 단계인 타입 체크가 React 앱에서 실패했다.

```text
tsconfig.json(18,3): error TS5102: Option 'baseUrl' has been removed.
```

## 검토한 방법

| 방법                                  | 장점                                     | 단점                                                             |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| PR을 닫고 5.9 유지                    | 변경할 것이 없다                         | 7의 빠른 타입 체크를 사용할 수 없다. Dependabot이 PR을 다시 연다 |
| 7로 올리고 린트를 일시 비활성화       | 패키지가 하나다                          | typescript-eslint가 7을 지원할 때까지 린트가 없다                |
| 별칭으로 6과 7을 함께 설치 (**채택**) | 린트 규칙은 그대로, 타입 체크와 빌드는 7 | `package.json`마다 두 줄, 잠금 파일이 커진다                     |

린트 비활성화는 채택하지 않았다. typescript-eslint는 타입 정보를 쓰는 규칙을 켜지 않아도 파서로 `typescript`를 불러온다. 그래서 일부 규칙만 끄는 방법은 없고 린트 전체를 꺼야 한다. 사용하지 않는 변수, React 훅 규칙, Fast Refresh 규칙 검사를 몇 달 동안 잃는 것보다 패키지 두 개를 관리하는 비용이 작다고 판단했다.

## 6과 7을 함께 설치

TypeScript 팀은 이런 도구를 위해 TS 6 API를 다시 제공하는 패키지 `@typescript/typescript6`을 배포했다. 도구들은 `typescript`라는 이름으로 import하므로, [npm 별칭](https://pnpm.io/aliases)[^alias]으로 설치 이름을 바꾼다.

```json
{
	"devDependencies": {
		"@typescript/native": "npm:typescript@~7.0.2",
		"typescript": "npm:@typescript/typescript6@^6.0.2"
	}
}
```

- `typescript`라는 이름에는 TS 6 호환 패키지가 들어간다. typescript-eslint처럼 `import 'typescript'`를 하는 도구는 6 API를 받는다.
- `@typescript/native`라는 이름에는 TS 7이 들어간다. 이 패키지가 `tsc` 실행 파일을 제공하므로, `pnpm typecheck`(`tsc`)와 API 빌드(`tsc -p tsconfig.build.json`)는 7로 실행된다.
- TS 6 패키지의 실행 파일 이름은 `tsc6`이라 `tsc`와 충돌하지 않는다.

React 앱, API, `contracts`, `desktop-core` 네 패키지에 같은 두 줄을 추가했다.

| 호출 방식                     | 설치 이름            | 실제 패키지                     | 사용하는 도구                        |
| ----------------------------- | -------------------- | ------------------------------- | ------------------------------------ |
| `import ts from 'typescript'` | `typescript`         | `@typescript/typescript6@6.0.x` | typescript-eslint                    |
| `tsc` 실행 파일               | `@typescript/native` | `typescript@7.0.x`              | `pnpm typecheck`, API 빌드           |
| `tsc6` 실행 파일              | `typescript`         | `@typescript/typescript6@6.0.x` | 버전 비교용 (일반 작업에서는 미사용) |

![typescript 이름에는 TS 6 호환 패키지, @typescript/native에는 TS 7을 달아 린트와 tsc가 각자 맞는 버전을 쓴다](./images/typescript-7-side-by-side-alias.svg 'npm 별칭으로 두 버전을 나란히')

## baseUrl 삭제

`baseUrl`은 `paths`의 기준 폴더를 지정하던 옵션이다. 7에서는 `paths`를 tsconfig 파일 위치 기준의 상대 경로로 작성한다([TSConfig `paths` 문서](https://www.typescriptlang.org/tsconfig/#paths)).

```diff
-		"baseUrl": ".",
 		"paths": {
-			"@/*": ["src/*"]
+			"@/*": ["./src/*"]
 		}
```

`@/` 별칭은 Vite 설정(`resolve.alias`)이 따로 처리하므로 빌드 결과는 바뀌지 않는다.

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

`npx` 시작 시간이 포함된 값이라 정밀한 벤치마크는 아니지만, 4~5배 차이는 명확하다. 자주 실행하는 `pnpm typecheck`의 대기 시간이 그만큼 줄었다.

## 남은 과제와 정리

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

참고 문서: [TypeScript 릴리스 노트](https://www.typescriptlang.org/docs/handbook/release-notes/overview.html), [typescript-eslint 지원 버전](https://typescript-eslint.io/users/dependency-versions/), [pnpm 별칭 설치](https://pnpm.io/aliases).

## 관련 글

- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies): 같은 날 의존성 PR을 병합한 방식
- [10월 12일 - 세고 나서 뽑은 Modal, TypeScript 7, 글이 만든 기능, 다시 그린 템플릿](/memo/day-1012): 그날의 작업 기록

PR: [#215](https://github.com/hyeoniverse/MacFolio/pull/215)

[^alias]: `"이름": "npm:실제패키지@버전"` 형식으로, 레지스트리의 다른 패키지를 지정한 이름으로 설치하는 기능. 같은 패키지의 두 버전을 서로 다른 이름으로 함께 설치할 수 있다.

#MacFolio #TypeScript #CI #의존성
