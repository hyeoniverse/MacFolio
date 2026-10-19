---
title: TypeScript 7로 올리기 — 컴파일러는 7, 린트는 6을 나란히
date: 2026-10-12
category: 개발기/MacFolio/인프라
summary: Dependabot의 TypeScript 7 PR이 린트에서 멈췄다. typescript 이름에는 TS 6 호환 패키지를, @typescript/native에는 TS 7을 npm 별칭으로 달아 tsc는 7로, typescript-eslint는 6 API로 돌게 했다. 타입 체크는 약 23초에서 5초로 줄었다.
---

Dependabot이 `typescript`를 `5.9.3`에서 `7.0.2`로 올리는 PR을 열었다. CI는 포맷 검사를 지나 린트 단계에서 멈췄다.

## 배경

이 저장소는 pnpm 워크스페이스로 네 패키지(React 앱, API, `contracts`, `desktop-core`)가 각자 `typescript`를 devDependency로 둔다. CI는 포맷 검사 → 린트 → 순환 의존 검사 → 타입 체크 → 단위 시험 → 빌드 → E2E 순서로 돈다. 의존성 PR은 Dependabot이 열고, 통과하면 합친다.

TypeScript는 이번에 5에서 6을 건너뛰고 7로 가는 PR이 왔다. 7은 메이저 버전일 뿐 아니라 컴파일러를 Go로 새로 쓴 버전이라, 그냥 숫자만 올려서는 끝나지 않을 것 같았다. 실제로 그랬다.

```text
Error: typescript-eslint does not support TS 7.0.
```

## 왜 린트가 멈췄나

TypeScript 7은 컴파일러를 Go로 새로 작성한 버전이다. 같은 코드를 훨씬 빨리 검사하지만, 5·6에 있던 JavaScript API(`import ts from 'typescript'`로 불러 쓰던 컴파일러 함수들)가 아직 없다. typescript-eslint는 타입 정보를 쓰는 규칙을 위해 이 API를 직접 부르므로, `typescript` 패키지가 7이 되면 시작조차 하지 못한다. typescript-eslint는 7.1 이후를 지원할 계획이다.

린트를 넘겨도 다음 단계인 타입 체크가 React 앱에서 실패했다. 7에서 `baseUrl` 옵션이 제거되었기 때문이다.

```text
tsconfig.json(18,3): error TS5102: Option 'baseUrl' has been removed.
```

## 고른 방법과 버린 방법

| 방법                         | 장점                                       | 단점                                                      |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| PR을 닫고 5.9에 머문다       | 바꿀 것이 없다                             | 7의 빠른 타입 체크를 못 쓴다. Dependabot이 계속 다시 연다 |
| 7로 올리고 린트를 잠시 끈다  | 패키지가 하나다                            | typescript-eslint 지원이 올 때까지 린트가 없다            |
| 별칭으로 6과 7을 나란히 둔다 | 린트 규칙은 그대로, 타입 체크와 빌드는 7로 | `package.json`마다 두 줄, 잠금 파일이 커진다              |

린트를 끄는 쪽은 버렸다. typescript-eslint는 타입 정보를 쓰는 규칙을 켜지 않아도 파서로 `typescript`를 불러온다. 그래서 규칙 몇 개만 끄는 길은 없고, 린트 전체를 꺼야 한다. 쓰지 않는 변수, React 훅 규칙, Fast Refresh 규칙을 몇 달 동안 잃느니 패키지 두 개를 두는 편이 싸다고 봤다.

## 6과 7을 나란히 설치

TypeScript 팀은 이런 도구를 위해 TS 6 API를 다시 내보내는 패키지 `@typescript/typescript6`을 냈다. 도구들은 `typescript`라는 이름으로 불러 쓰므로, npm 별칭으로 이름을 바꿔 단다.

```json
{
	"devDependencies": {
		"@typescript/native": "npm:typescript@~7.0.2",
		"typescript": "npm:@typescript/typescript6@^6.0.2"
	}
}
```

- `typescript`라는 이름에는 TS 6 호환 패키지가 들어간다. typescript-eslint처럼 `import 'typescript'`를 하는 도구는 6 API를 받는다.
- `@typescript/native`라는 이름에는 TS 7이 들어간다. 이 패키지가 `tsc` 실행 파일을 주므로, `pnpm typecheck`(`tsc`)와 API 빌드(`tsc -p tsconfig.build.json`)는 7로 돈다.
- TS 6 패키지의 실행 파일은 `tsc6`라는 이름이라 `tsc`와 겹치지 않는다.

React 앱, API, `contracts`, `desktop-core` 네 패키지에 같은 두 줄을 넣었다.

![typescript 이름에는 TS 6 호환 패키지, @typescript/native에는 TS 7을 달아 린트와 tsc가 각자 맞는 버전을 쓴다](./images/typescript-7-side-by-side-alias.svg 'npm 별칭으로 두 버전을 나란히')

## baseUrl 지우기

`baseUrl`은 `paths`의 기준 폴더를 정하던 옵션이다. 7에서는 `paths`를 tsconfig 파일 위치 기준의 상대 경로로 적는다.

```diff
-		"baseUrl": ".",
 		"paths": {
-			"@/*": ["src/*"]
+			"@/*": ["./src/*"]
 		}
```

`@/` 별칭은 Vite 설정(`resolve.alias`)이 따로 처리하므로 빌드 결과는 바뀌지 않는다.

## 구현 순서

1. Dependabot 브랜치에 main을 합쳐 최신으로 맞췄다.
2. 네 패키지의 `package.json`에서 `typescript` 한 줄을 위의 두 줄로 바꿨다.
3. React 앱 `tsconfig.json`에서 `baseUrl`을 지우고 `paths`를 `./src/*`로 고쳤다.
4. `pnpm install`로 잠금 파일을 다시 만들었다. `pnpm-lock.yaml`이 648줄 바뀌었는데, 대부분 typescript-eslint 패키지들이 기대는 `typescript`가 `@typescript/typescript6@6.0.2`로 바뀌면서 항목 이름이 다시 적힌 것이다.

바뀐 파일은 이 글을 빼면 여섯 개다(`package.json` 네 개, `tsconfig.json`, 잠금 파일).

## 확인

- 포맷 검사, 린트(typescript-eslint는 6 API로), 순환 의존 검사 통과
- 타입 체크 여섯 작업이 TS 7(`tsc` 7.0.2)로 통과
- 단위 테스트 682개(React 339, API 157, desktop-core 153, contracts 33), 빌드 통과
- 설치된 두 실행 파일의 버전: `tsc -v`는 `Version 7.0.2`, `tsc6 -v`는 `Version 6.0.3`

얼마나 빨라졌는지도 쟀다. 두 실행 파일이 함께 설치되어 있으니 같은 `apps/react/tsconfig.json`을 `--noEmit`으로 두 번씩 돌렸다.

| 실행 파일      | 1회    | 2회    |
| -------------- | ------ | ------ |
| `tsc` (7.0.2)  | 5.2초  | 4.2초  |
| `tsc6` (6.0.3) | 23.1초 | 22.7초 |

![TS 7 tsc는 4~5초, TS 6 tsc6은 약 23초 걸린 막대 그림](./images/typescript-7-side-by-side-time.svg 'React 앱 타입 체크 시간')

`npx` 시작 시간이 들어간 값이라 정밀한 벤치마크는 아니지만, 4~5배 차이는 분명하다. 자주 돌리는 `pnpm typecheck`가 그만큼 가벼워졌다.

## 남은 것·배운 것

- typescript-eslint가 7을 지원하면 `typescript` 별칭을 지우고 7 하나로 합친다. 그때는 네 `package.json`에서 한 줄씩 지우면 된다.
- 6과 7이 같은 코드를 다르게 판단할 수 있다는 점은 기억해 둔다. 위에서 두 실행 파일을 돌렸을 때는 둘 다 오류 없이 끝났다.
- 메이저 버전 PR이 실패하면 "올릴까 말까"만 고르지 않는다. 도구마다 필요한 버전이 다르면 나란히 두는 길이 있는지 먼저 본다. npm 별칭(`npm:패키지@버전`)은 그럴 때 쓰기 좋다.

## 관련 글

- 같은 날 의존성 PR을 합친 방식: /memo/merge-strategies
- 그날의 작업 기록: /memo/day-1012
- PR: https://github.com/hyeoniverse/MacFolio/pull/215

#MacFolio #TypeScript #CI #의존성
