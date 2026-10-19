---
title: 화면과 서버가 같은 규칙을 쓰기 - 소스는 Vite가, 빌드 결과는 Node가
date: 2026-10-09
category: 개발기/MacFolio/백엔드
summary: 폴더 3단·이름 30자·제목 100자 같은 규칙이 화면 코드와 서버 코드에 따로 적혀 있었다. desktop-core 한 곳에 두고 둘이 함께 쓰게 했다. 화면(Vite)은 TypeScript 소스를, 서버(Node)는 빌드한 JS를 읽게 package.json exports 조건으로 나눴다.
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

## 어떻게 함께 쓸까

| 방법                                               | 좋은 점                                | 나쁜 점                                                                           |
| -------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| 지금처럼 두 곳에 적고 시험으로 같은지 본다         | 패키지 구조를 안 바꾼다                | 같은지 보는 시험이 화면·서버 두 앱을 다 불러야 한다. 결국 한쪽이 다른 쪽을 import |
| 서버를 `tsx`처럼 TS를 바로 돌리는 도구로 실행      | core를 빌드하지 않아도 된다            | 운영 서버(1GB)에서 시작할 때마다 변환한다. 배포 이미지가 커진다                   |
| 서버를 번들러로 묶어 core를 안에 넣는다            | 서버 이미지에 core가 따로 없다         | NestJS·Prisma를 묶는 설정이 까다롭다. 데코레이터 메타데이터 문제                  |
| **core가 `dist`를 만들고 exports 조건으로 나눈다** | 화면은 소스, 서버는 JS. 표준 Node 방식 | 빌드 순서(core 먼저)를 여러 곳에 적어야 한다                                      |

넷째를 골랐다. 화면 쪽 개발 경험(고치면 바로 반영)은 그대로 두고, 서버만 빌드 결과를 읽게 하는 방법이다.

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

![exports 조건으로 나눈 입구](./images/desktop-core-shared-rules-exports.svg 'source 조건을 켠 React 앱은 소스를, 서버는 dist를 읽는다')

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

![core를 먼저 빌드하고, 서버는 dist를, 화면은 src를 읽는 순서](./images/desktop-core-shared-rules-build-order.svg 'Turborepo의 ^build가 core를 먼저 만든다. CI는 core가 바뀌어도 API 이미지를 새로 만든다')

커밋은 파일 41개, +251/−144다. 바뀐 파일 대부분은 core 안의 상대 경로 import에 `.js`를 붙인 것이다.

## 남은 것과 배운 것

- 이 뒤에 [API 요청·응답 모양을 zod 스키마로 모은 contracts 패키지](/memo/contracts-posts)가 생겼다. contracts도 같은 `source`/`dist` 조건을 쓴다. 이 글에서 정한 방법이 두 번째 공유 패키지의 틀이 됐다.
- `source`는 이 저장소에서 만든 조건 이름이다. 새 도구(예: 다른 시험 도구)를 붙이면 그 도구에도 조건을 알려 줘야 한다. 알려 주지 않으면 그 도구는 `dist`를 읽고, `dist`가 오래됐으면 옛 규칙으로 돈다.
- 화면 쪽은 `dist`가 없어도 된다는 것을 확인했지만, 서버 쪽은 `dist`가 오래된 채로 남으면 조용히 옛 규칙을 쓴다. Turborepo의 `^build`가 이것을 막는다.

배운 것: "규칙을 한 곳에"는 코드를 옮기는 것으로 끝나지 않는다. 그 한 곳이 바뀌었을 때 쓰는 모든 쪽이 다시 빌드되고 배포되는지까지 확인해야 한다. CI의 변경 감지 경로 한 줄을 빼먹었다면, 규칙은 한 곳에 있는데 서버와 화면이 다른 버전을 쓰는 상태가 됐을 것이다.

## 따라 해 보기

규칙을 바꿀 때는 `packages/desktop-core/src/memo/rules.ts` 한 곳을 고친다. 서버는 빌드된 JS를 읽으므로 빌드까지 해야 서버 쪽에 반영된다.

```bash
pnpm --filter @macfolio/desktop-core test
pnpm --filter @macfolio/desktop-core build    # 서버(Node)가 읽는 dist
pnpm typecheck
pnpm --filter @macfolio/api test:e2e test/posts.e2e.test.ts   # DB가 필요하다 (db:up)
```

화면(Vite)은 소스를 바로 읽어서 빌드 없이도 바뀐다. 그래서 서버만 옛 규칙으로 남는 일을 막으려고 API 이미지 빌드에서도 패키지를 먼저 빌드한다([apps/api/Dockerfile](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/Dockerfile)). 워크스페이스 구성은 [pnpm workspace 문서](https://pnpm.io/workspaces)를 봤다.

관련 글: [창 관리를 React 밖으로](/memo/desktop-core-windows), [메모 로직을 desktop-core로](/memo/desktop-core-memo), [타입은 desktop-core에, 스키마는 contracts에](/memo/contracts-posts).

#MacFolio #백엔드 #리팩터링 #배포
