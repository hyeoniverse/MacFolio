---
title: 화면과 서버가 같은 규칙을 쓰기 - 소스는 Vite가, 빌드 결과는 Node가
date: 2026-10-09
category: 백엔드
summary: 폴더는 3단까지, 이름은 30자까지, 제목은 100자까지 같은 규칙이 화면 코드와 서버 코드에 따로 적혀 있었다. 이것을 desktop-core 한 곳에 두고 둘이 함께 쓰게 했다. 화면(Vite)은 TypeScript 소스를 바로 읽고, 서버(Node)는 빌드한 JS를 읽게 package.json의 exports 조건으로 나눴다. 배포 이미지에서 서버가 이 규칙을 실제로 불러오는지도 확인했다.
---

desktop-core로 [창 관리](/memo/desktop-core-windows), [메모](/memo/desktop-core-memo), [음악](/memo/desktop-core-music)을 옮기고 나니 #16에 한 항목이 남았다. "백엔드와 함께 쓸 타입의 위치를 정한다."

## 두 번 적힌 규칙

메모 앱의 규칙 중 몇 가지는 화면과 서버가 둘 다 검사한다. 화면은 저장하기 전에 칸마다 알려 주려고, 서버는 화면을 거치지 않은 요청도 막으려고 검사한다. 문제는 그 규칙이 두 곳에 따로 적혀 있었다는 것이다.

| 규칙                            | 화면 (desktop-core)                          | 서버 (apps/api)                                 |
| ------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| 정리 내용의 모양                | `organize.ts`의 `Organization`               | `memo/organization.ts`의 `Organization`         |
| 폴더 이름 30자, 3단까지         | `FOLDER_NAME_MAX`, `MAX_FOLDER_DEPTH`        | 같은 이름의 상수                                |
| 글 길이                         | `{ title: 100, summary: 200, body: 50_000 }` | `{ title: { min: 1, max: 100 }, ... }`          |
| 있는 날짜인지 (2026-02-30 거절) | `postRules.ts`의 `isDate`                    | `posts/rules.ts`의 `isDate` (한 글자도 안 다름) |

주석에는 "서버와 같은 규칙"이라고 적혀 있었지만, 그걸 지키는 건 사람의 기억이었다. 폴더를 4단까지 늘리려면 두 파일을 같이 고쳐야 하고, 한쪽만 고치면 화면은 통과시키고 서버는 거절하는 상태가 된다.

## 한 곳에 두기

`packages/desktop-core/src/memo/rules.ts`를 만들고 이 규칙들을 옮겼다. 서버에만 있던 정리 내용 검사(`parseOrganization`, `folderPathError`)와 그 시험 7개도 여기로 왔다. 서버의 `memo/organization.ts`는 지웠고, 서버 코드는 이렇게 가져다 쓴다.

```ts
import { folderPathError, isCalendarDate, POST_LIMITS, POST_SLUG } from '@macfolio/desktop-core/memo';
```

글 길이는 모양이 달랐다. 서버는 `{ min, max }`, 화면은 최댓값만 썼다. 최솟값은 "비어 있지 않다"는 뜻의 1뿐이라 화면 쪽 모양으로 맞추고, 서버의 `length < min` 검사는 "비었는지"로 바꿨다.

## Vite는 소스를, Node는 JS를

여기서 진짜 문제가 나왔다. 지금까지 desktop-core는 빌드하지 않는 패키지였다. `package.json`의 입구가 TypeScript 파일을 바로 가리켰다.

```json
"exports": { ".": "./src/index.ts" }
```

React 앱은 Vite가 TypeScript를 그 자리에서 바꿔 주니 문제가 없었다. 서버는 다르다. `tsc`로 컴파일한 JS를 `node dist/main.js`로 실행한다. 배포 이미지 안에서는 desktop-core가 `node_modules` 아래에 복사되는데, Node는 `node_modules` 안의 `.ts` 파일을 실행하지 않는다.

그래서 desktop-core도 `dist`를 만들게 하고, 누가 읽느냐에 따라 입구를 나눴다.

```json
"./memo": {
	"source": "./src/memo/index.ts",
	"types": "./dist/memo/index.d.ts",
	"default": "./dist/memo/index.js"
}
```

`source`는 표준 조건이 아니라 이 저장소에서 정한 이름이다. React 앱만 이 조건을 켠다.

- `vite.config.ts`: `resolve.conditions: ['source', ...defaultClientConditions]` (Vitest용으로 `ssr.resolve.conditions`도)
- `tsconfig.json`: `"customConditions": ["source"]`

서버는 이 조건을 모르니 `types`와 `default`, 즉 빌드한 결과를 읽는다. React 쪽은 개발 서버를 띄울 때 core를 따로 빌드하지 않아도 되고, 고치면 바로 반영된다. `dist`를 지운 상태에서 React의 타입 검사·빌드·시험을 돌려 실제로 소스만 읽는 것도 확인했다.

## Node가 읽을 수 있는 JS

core를 빌드하려면 Node의 ESM 규칙을 지켜야 한다. Node는 `import './store'`를 `./store.js`로 찾아 주지 않는다. core의 `tsconfig`를 `module: NodeNext`로 바꾸면 확장자 없는 상대 경로는 타입 검사에서 오류가 된다. 스크립트로 import 문에 `.js`를 붙였는데, 시험 파일 안의 `import('./posts')` 타입 두 곳을 놓쳐서 이렇게 걸렸다.

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './posts.js'?
```

그 두 곳도 고쳐서 core 안의 상대 경로는 모두 `.js`로 끝난다. 소스 파일은 `.ts`인데 `.js`로 적는 게 처음엔 어색하지만, TypeScript와 Vite 모두 `./posts.js`를 `posts.ts`로 찾아 준다.

## 빌드 순서와 배포

서버가 core의 `dist`를 읽게 되면서, core가 먼저 빌드돼 있어야 하는 곳이 생겼다.

| 곳                 | 바꾼 것                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Turborepo          | `typecheck`와 `dev`가 의존 패키지의 `build`를 먼저 돌린다 (`^build`)          |
| API Dockerfile     | core의 `package.json`을 같이 복사해 설치하고, core를 빌드한 뒤 API를 빌드한다 |
| CI의 API 변경 감지 | `packages/desktop-core`가 바뀌어도 API 이미지를 새로 만든다                   |

마지막 줄은 놓치기 쉬웠다. CI는 서버에 떠 있는 버전과 비교해 `apps/api`가 바뀌었을 때만 API를 배포한다. 이제 폴더 규칙을 core에서 고치면 서버 동작도 바뀌는데, 감지 경로에 core가 없으면 화면만 새 규칙으로 배포되고 서버는 옛 규칙으로 남는다. 규칙을 한 곳에 모은 의미가 사라진다.

## 이미지에서 확인

로컬에서 API 이미지를 빌드하고, 그 안에서 서버 코드가 core를 불러오는지 돌려 봤다.

```
core ok { title: 100, summary: 200, body: 50000 } function
api rules {"errors":["날짜가 올바르지 않습니다.","폴더는 3단까지입니다: a/b/c/d"]}
app module ok [ 'AppModule' ]
```

서버의 글 검사가 core의 날짜·폴더 규칙으로 거절하고, 서버 전체 모듈도 불러와졌다. 시험은 core 127개, 화면 290개, 서버 128개(7개가 core로 옮겨 갔다), Playwright 352개가 통과했다.

#MacFolio #백엔드 #리팩터링 #배포
