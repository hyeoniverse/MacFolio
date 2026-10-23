---
title: 화면과 서버가 같은 규칙을 쓰기 - 소스는 Vite가, 빌드 결과는 Node가
date: 2026-10-09
category: 개발기/MacFolio/백엔드
summary: 폴더 3단·이름 30자·제목 100자 같은 규칙이 화면 코드와 서버 코드에 각각 정의되어 있었다. desktop-core 한 곳으로 옮겨 둘이 함께 사용하게 했다. 화면(Vite)은 TypeScript 소스를, 서버(Node)는 빌드한 JS를 읽도록 package.json exports 조건으로 분리했다.
---

desktop-core[^desktop-core]로 [창 관리](/memo/desktop-core-windows), [메모](/memo/desktop-core-memo), [음악](/memo/desktop-core-music)을 옮긴 뒤 [이슈 #16](https://github.com/hyeoniverse/MacFolio/issues/16)에 항목 하나가 남았다. "백엔드와 함께 쓸 타입의 위치를 정한다."

## 두 곳에 정의된 규칙

메모 앱의 규칙 중 일부는 화면과 서버가 모두 검사한다. 화면은 저장 전에 칸별 오류를 표시하기 위해, 서버는 화면을 거치지 않은 요청도 거절하기 위해 검사한다. 문제는 그 규칙이 두 곳에 각각 정의되어 있었다는 점이다.

| 규칙                            | 화면 (desktop-core)                          | 서버 (apps/api)                                  |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| 정리 내용의 타입                | `organize.ts`의 `Organization`               | `memo/organization.ts`의 `Organization`          |
| 폴더 이름 30자, 3단까지         | `FOLDER_NAME_MAX`, `MAX_FOLDER_DEPTH`        | 같은 이름의 상수                                 |
| 글 길이                         | `{ title: 100, summary: 200, body: 50_000 }` | `{ title: { min: 1, max: 100 }, ... }`           |
| 실제 날짜인지 (2026-02-30 거절) | `postRules.ts`의 `isDate`                    | `posts/rules.ts`의 `isDate` (코드가 완전히 동일) |

주석에는 "서버와 같은 규칙"이라고 적혀 있었지만, 두 값이 같은지 검사하는 코드나 시험은 없었다. 폴더를 4단까지 허용하려면 두 파일을 함께 수정해야 하고, 한쪽만 수정하면 화면은 통과시키고 서버는 거절하는 상태가 된다.

## 공유 방법 비교

| 방법                                               | 장점                                   | 단점                                                                             |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| 두 곳에 유지하고 시험으로 값이 같은지 검사         | 패키지 구조를 바꾸지 않는다            | 비교 시험이 화면·서버 두 앱을 모두 import해야 한다. 결국 한쪽이 다른 쪽을 import |
| 서버를 `tsx`처럼 TS를 직접 실행하는 도구로 실행    | core를 빌드하지 않아도 된다            | 운영 서버(메모리 1GB)에서 시작할 때마다 변환한다. 배포 이미지가 커진다           |
| 서버를 번들러로 번들링해 core를 포함               | 서버 이미지에 core가 별도로 없다       | NestJS·Prisma 번들링 설정이 복잡하다. 데코레이터 메타데이터가 유실될 수 있다     |
| **core가 `dist`를 빌드하고 exports 조건으로 분리** | 화면은 소스, 서버는 JS. 표준 Node 방식 | 빌드 순서(core 먼저)를 여러 설정에 명시해야 한다                                 |

네 번째 방법을 선택했다. 화면 개발 환경(소스 수정이 즉시 반영되는 HMR)은 유지하고, 서버만 빌드 결과를 읽게 하는 방법이다.

## 규칙을 한 파일로

`packages/desktop-core/src/memo/rules.ts`를 만들고 위 규칙을 옮겼다. 서버에만 있던 정리 내용 검사(`parseOrganization`, `folderPathError`)와 그 시험 7개도 이 파일로 옮겼다. 서버의 `memo/organization.ts`는 삭제했고, 서버 코드는 다음처럼 import한다.

```ts
import { folderPathError, isCalendarDate, POST_LIMITS, POST_SLUG } from '@macfolio/desktop-core/memo';
```

글 길이는 두 쪽의 자료 구조가 달랐다. 서버는 `{ min, max }`, 화면은 최댓값만 사용했다. 최솟값은 "비어 있지 않다"는 의미의 1뿐이므로 화면 쪽 구조(`{ title: 100, summary: 200, body: 50_000 }`)로 통일하고, 서버의 `length < min` 검사는 빈 값 검사로 바꿨다.

## Vite는 소스를, Node는 JS를

이 단계에서 핵심 문제가 드러났다. 기존 desktop-core는 빌드 단계가 없는 패키지였다. `package.json`의 진입점이 TypeScript 파일을 직접 가리켰다.

```json
"exports": { ".": "./src/index.ts" }
```

React 앱은 Vite가 TypeScript를 요청 시점에 변환하므로 문제가 없었다. 서버는 `tsc`로 컴파일한 JS를 `node dist/main.js`로 실행한다. 배포 이미지 안에서 desktop-core는 `node_modules` 아래에 복사되는데, Node는 `node_modules` 안의 `.ts` 파일을 실행하지 않는다.

그래서 desktop-core도 `dist`를 빌드하게 하고, 읽는 쪽에 따라 진입점을 분리했다([Node.js 조건부 exports](https://nodejs.org/api/packages.html#conditional-exports)).

```json
"./memo": {
	"source": "./src/memo/index.ts",
	"types": "./dist/memo/index.d.ts",
	"default": "./dist/memo/index.js"
}
```

`source`는 표준 조건이 아니라 이 저장소에서 정한 이름이다. React 앱만 이 조건을 활성화한다.

| 설정 파일        | 설정                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts` | [`resolve.conditions`](https://vite.dev/config/shared-options.html#resolve-conditions): `['source', ...defaultClientConditions]` (Vitest용으로 `ssr.resolve.conditions`도) |
| `tsconfig.json`  | [`"customConditions": ["source"]`](https://www.typescriptlang.org/tsconfig/#customConditions)                                                                              |

서버는 이 조건을 사용하지 않으므로 `types`와 `default`, 즉 빌드 결과를 읽는다. React 쪽은 개발 서버를 실행할 때 core를 별도로 빌드하지 않아도 되고, 소스 수정이 즉시 반영된다. `dist`를 삭제한 상태에서 React의 타입 검사·빌드·시험을 실행해, 실제로 소스만 읽는다는 것도 확인했다.

![exports 조건으로 나눈 입구](./images/desktop-core-shared-rules-exports.svg 'source 조건을 켠 React 앱은 소스를, 서버는 dist를 읽는다')

## Node가 읽을 수 있는 JS

core를 빌드하려면 Node의 ESM 규칙을 따라야 한다. Node는 `import './store'`를 `./store.js`로 자동 해석하지 않는다([Node.js ESM: 필수 파일 확장자](https://nodejs.org/api/esm.html#mandatory-file-extensions)). core의 `tsconfig`를 `module: NodeNext`로 바꾸면 확장자 없는 상대 경로가 타입 검사 오류가 된다. 스크립트로 import 문에 `.js`를 일괄 추가했는데, 시험 파일 안의 `import('./posts')` 타입 표현식 두 곳이 누락되어 다음 오류가 발생했다.

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './posts.js'?
```

두 곳도 수정해 core 안의 상대 경로는 모두 `.js`로 끝난다. 소스 파일은 `.ts`인데 import 경로는 `.js`로 적는 방식이지만, TypeScript와 Vite 모두 `./posts.js`를 `posts.ts`로 해석한다.

| import 문             | `moduleResolution: bundler` (이전) | `NodeNext` (이후)       |
| --------------------- | ---------------------------------- | ----------------------- |
| `import './posts'`    | 허용                               | TS2835 오류             |
| `import './posts.js'` | 허용                               | 허용, `posts.ts`로 해석 |

## 빌드 순서와 배포

서버가 core의 `dist`를 읽게 되면서, core가 먼저 빌드되어 있어야 하는 지점이 세 곳 생겼다.

| 위치               | 변경 내용                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Turborepo          | `typecheck`와 `dev`가 의존 패키지의 `build`를 먼저 실행한다 ([`^build`](https://turborepo.com/docs/reference/configuration)) |
| API Dockerfile     | core의 `package.json`을 함께 복사해 설치하고, core를 빌드한 뒤 API를 빌드한다                                                |
| CI의 API 변경 감지 | `packages/desktop-core`가 바뀌어도 API 이미지를 새로 빌드한다                                                                |

마지막 행은 누락하기 쉬운 항목이다. CI는 서버에서 실행 중인 버전과 비교해 `apps/api`가 바뀌었을 때만 API를 배포한다. 이제 폴더 규칙을 core에서 수정하면 서버 동작도 바뀌는데, 감지 경로에 core가 없으면 화면만 새 규칙으로 배포되고 서버는 이전 규칙으로 남는다. 규칙을 한 곳에 모은 의미가 사라진다.

## 이미지에서 확인

로컬에서 API 이미지를 빌드하고, 컨테이너 안에서 서버 코드가 core를 import하는지 실행해 확인했다.

```
core ok { title: 100, summary: 200, body: 50000 } function
api rules {"errors":["날짜가 올바르지 않습니다.","폴더는 3단까지입니다: a/b/c/d"]}
app module ok [ 'AppModule' ]
```

서버의 글 검사가 core의 날짜·폴더 규칙으로 거절하고, 서버 전체 모듈(`AppModule`)도 정상적으로 로드됐다. 시험은 core 127개, 화면 290개, 서버 128개(7개는 core로 이동), Playwright 352개가 통과했다.

![core를 먼저 빌드하고, 서버는 dist를, 화면은 src를 읽는 순서](./images/desktop-core-shared-rules-build-order.svg 'Turborepo의 ^build가 core를 먼저 만든다. CI는 core가 바뀌어도 API 이미지를 새로 만든다')

커밋 변경량은 파일 41개, +251/−144다. 변경 파일 대부분은 core 안의 상대 경로 import에 `.js`를 추가한 것이다.

## 남은 과제와 배운 점

- 이후 [API 요청·응답 형식을 zod 스키마로 모은 contracts 패키지](/memo/contracts-posts)가 추가됐다. contracts도 같은 `source`/`dist` 조건을 사용한다. 이 글에서 정한 방식이 두 번째 공유 패키지의 기본 구조가 됐다.
- `source`는 이 저장소에서 정의한 조건 이름이다. 새 도구(예: 다른 시험 도구)를 추가하면 그 도구에도 조건을 설정해야 한다. 설정하지 않으면 그 도구는 `dist`를 읽고, `dist`가 최신이 아니면 이전 규칙으로 실행된다.
- 화면 쪽은 `dist`가 없어도 동작하는 것을 확인했지만, 서버 쪽은 `dist`가 갱신되지 않으면 오류 없이 이전 규칙을 사용한다. Turborepo의 `^build`가 이를 방지한다.

배운 점: "규칙을 한 곳에"는 코드 이동으로 끝나지 않는다. 그 파일이 바뀌었을 때 사용하는 모든 패키지가 다시 빌드·배포되는지까지 확인해야 한다. CI의 변경 감지 경로 한 줄을 누락했다면, 규칙은 한 곳에 있지만 서버와 화면이 서로 다른 버전을 사용하는 상태가 됐을 것이다.

## 따라 해 보기

규칙을 바꿀 때는 `packages/desktop-core/src/memo/rules.ts` 한 곳을 수정한다. 서버는 빌드된 JS를 읽으므로 빌드까지 실행해야 서버에 반영된다.

```bash
pnpm --filter @macfolio/desktop-core test
pnpm --filter @macfolio/desktop-core build    # 서버(Node)가 읽는 dist
pnpm typecheck
pnpm --filter @macfolio/api test:e2e test/posts.e2e.test.ts   # DB가 필요하다 (db:up)
```

화면(Vite)은 소스를 직접 읽으므로 빌드 없이도 반영된다. 서버만 이전 규칙으로 남는 상황을 막기 위해 API 이미지 빌드에서도 패키지를 먼저 빌드한다([apps/api/Dockerfile](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/Dockerfile)). 워크스페이스 구성은 [pnpm workspace 문서](https://pnpm.io/workspaces)를 참고했다.

## 관련 글

- [창 관리를 React 밖으로 - desktop-core 패키지의 첫 단계](/memo/desktop-core-windows)
- [메모 로직을 desktop-core로 - localStorage는 어디에 둘까](/memo/desktop-core-memo)
- [음악 플레이어를 둘로 나누기 - 무엇을 틀지와 어떻게 틀지](/memo/desktop-core-music)
- [타입은 desktop-core에, 스키마는 contracts에 — 글 도메인 옮기기](/memo/contracts-posts)
- [MacFolio 백엔드 한 장으로 보기 - 구성도와 설계 결정](/memo/backend-design)

[^desktop-core]: `packages/desktop-core`는 React·Vue 같은 UI 프레임워크에 의존하지 않는 로직(상태 저장소, 창 관리, 메모 규칙, 음악 재생 목록)을 모은 워크스페이스 패키지다. ESLint 규칙으로 React와 `@/*` import를 금지한다.

#MacFolio #백엔드 #리팩터링 #배포
