---
title: TypeScript 7로 올리기 — 컴파일러는 7, 린트는 6을 나란히
date: 2026-10-12
category: 개발기/MacFolio/인프라
summary: Dependabot이 TypeScript를 5.9에서 7.0으로 올리는 PR을 열었지만 CI의 린트 단계에서 바로 멈췄다. TypeScript 7은 Go로 새로 작성한 컴파일러라 JavaScript API가 없고, typescript-eslint는 그 API에 기대기 때문이다. 공식 안내대로 typescript 이름에는 TS 6 호환 패키지를, @typescript/native 이름에는 TS 7을 설치해 tsc는 7로, typescript-eslint는 6 API로 돌게 했다. 7에서 사라진 baseUrl 옵션도 tsconfig에서 지웠다.
---

Dependabot이 `typescript`를 `5.9.3`에서 `7.0.2`로 올리는 PR을 열었다. CI는 포맷 검사를 지나 린트 단계에서 멈췄다.

```text
Error: typescript-eslint does not support TS 7.0.
```

## 왜 린트가 멈췄나

TypeScript 7은 컴파일러를 Go로 새로 작성한 버전이다. 같은 코드를 훨씬 빨리 검사하지만, 5·6에 있던 JavaScript API(`import ts from 'typescript'`로 불러 쓰던 컴파일러 함수들)가 아직 없다. typescript-eslint는 타입 정보를 쓰는 규칙을 위해 이 API를 직접 부르므로, `typescript` 패키지가 7이 되면 시작조차 하지 못한다. typescript-eslint는 7.1 이후를 지원할 계획이다.

린트를 넘겨도 다음 단계인 타입 체크가 React 앱에서 실패했다. 7에서 `baseUrl` 옵션이 제거되었기 때문이다.

```text
tsconfig.json(18,3): error TS5102: Option 'baseUrl' has been removed.
```

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

## 확인

- 포맷 검사, 린트(typescript-eslint는 6 API로), 순환 의존 검사 통과
- 타입 체크 여섯 작업이 TS 7(`tsc` 7.0.2)로 통과
- 단위 테스트 682개(React 339, API 157, desktop-core 153, contracts 33), 빌드 통과

typescript-eslint가 7을 지원하면 `typescript` 별칭을 지우고 7 하나로 합친다.

#MacFolio #TypeScript #CI #의존성
