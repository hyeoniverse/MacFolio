---
title: 'zsh: command not found: pnpm — pnpm 설치 방법과 Node 25에서 corepack이 제외된 이유'
date: 2026-10-20
category: 기술 노트/개발 도구/패키지 관리
summary: Node 25부터 corepack이 Node에 포함되지 않아, corepack enable로 pnpm을 사용하던 저장소에서 pnpm을 찾지 못한다. pnpm 설치 명령과 확인 방법, 전역 pnpm과 저장소의 pnpm 버전이 다른 이유, npm install로 대신 설치했을 때 남는 파일의 정리 순서를 정리했다.
---

## pnpm이란

pnpm은 Node.js 패키지 관리자다. npm과 같은 `package.json`을 읽어 의존성을 설치하지만, 패키지 파일을 디스크의 저장소(content-addressable store) 한 곳에 보관하고 프로젝트에는 링크만 생성한다. 그래서 같은 패키지를 여러 프로젝트에서 사용해도 디스크를 한 번만 사용하고, 설치 속도가 빠르다. 여러 패키지를 한 저장소에서 관리하는 **workspace**(monorepo) 기능도 제공한다.

| 구분        | npm                                | pnpm                                  |
| ----------- | ---------------------------------- | ------------------------------------- |
| 설치 방식   | Node.js에 포함                     | 별도 설치 (아래 "설치 방법")          |
| 잠금 파일   | `package-lock.json`                | `pnpm-lock.yaml`                      |
| workspace   | `package.json`의 `workspaces`      | `pnpm-workspace.yaml`                 |
| 패키지 저장 | 프로젝트마다 `node_modules`에 복사 | 공용 저장소에 보관, 프로젝트에는 링크 |

## 설치 방법

`zsh: command not found: pnpm`이 발생하면 아래 명령으로 설치한다.

```bash
npm install -g pnpm
```

설치 후 확인한다.

```text
$ which pnpm
/opt/homebrew/bin/pnpm
$ pnpm -v
12.14.0
```

저장소 안에서는 `package.json`의 `packageManager`에 지정된 버전이 사용된다(아래 "전역 버전과 저장소 버전이 다른 이유").

```text
$ cd ~/projects/acme && pnpm -v
10.34.5
```

### 다른 설치 방법

| 방법                                          | 특징                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm install -g pnpm`                         | 가장 단순하다. Homebrew로 설치한 npm이면 `/opt/homebrew/bin/pnpm`이 생성된다      |
| `npm install -g corepack` → `corepack enable` | Node 24 이하와 같은 방식. corepack을 npm 패키지로 설치한다                        |
| `npx get-pnpm`                                | pnpm 공식 설치 문서의 npm 기반 방법. 설치 프로그램 실행에 Node.js 22.13 이상 필요 |
| Node 24 이하 사용                             | 저장소가 `.node-version` 등으로 Node 버전을 지정한 경우 그 버전을 사용한다        |

Homebrew로 설치한 npm은 전역 패키지를 사용자 계정 소유의 `/opt/homebrew`에 설치하므로 `sudo`가 필요 없고, `/opt/homebrew/bin`이 이미 PATH에 있어 추가 설정도 필요 없다([Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup) 참고).

```text
$ npm ls -g --depth=0
/opt/homebrew/lib
├── npm@11.20.0
└── pnpm@12.14.0
$ ls -l /opt/homebrew/bin/pnpm
lrwxr-xr-x  … /opt/homebrew/bin/pnpm -> ../lib/node_modules/pnpm/pnpm
```

## 원인: Node 25부터 corepack이 제외됨

```text
$ node -v
v26.12.0
$ which corepack
corepack not found
```

Node.js에 포함된 패키지 관리자는 npm뿐이고, pnpm은 포함되지 않는다. 그동안 pnpm을 별도로 설치하지 않아도 사용할 수 있었던 것은 Node.js에 포함된 **corepack** 때문이다. corepack은 `package.json`의 `packageManager` 필드를 읽어 지정된 버전의 pnpm을 내려받아 실행한다. 많은 저장소의 설치 안내가 `corepack enable`로 시작하는 이유다.

```json
"packageManager": "pnpm@10.34.5"
```

Node.js 25부터 corepack이 Node.js와 함께 배포되지 않는다. Homebrew의 `node`처럼 항상 최신 메이저 버전으로 업데이트되는 설치에서는 `corepack enable` 자체가 `command not found`로 실패한다. pnpm과 corepack이 모두 없으므로 `pnpm` 명령을 찾지 못한다.

| Node.js 버전 | corepack | `corepack enable`   | 해결                                                 |
| ------------ | -------- | ------------------- | ---------------------------------------------------- |
| 24 이하      | 포함     | 동작                | -                                                    |
| 25 이상      | 미포함   | `command not found` | `npm install -g pnpm` 또는 `npm install -g corepack` |

## 전역 버전과 저장소 버전이 다른 이유

전역으로 설치한 pnpm은 12.14.0인데, 저장소 안에서는 10.34.5가 출력된다.

```text
$ cd ~ && pnpm -v
12.14.0
$ cd ~/projects/acme && pnpm -v
10.34.5
```

pnpm은 실행 시 `package.json`의 `packageManager`를 확인하고, 지정된 버전과 자신의 버전이 다르면 지정된 버전을 내려받아 대신 실행한다. corepack이 수행하던 기능을 pnpm이 직접 수행하는 방식이다. 따라서 전역에 설치한 버전과 관계없이 저장소 안에서는 저장소가 지정한 버전이 사용된다.

| pnpm 버전 | 설정                           | 기본값     |
| --------- | ------------------------------ | ---------- |
| 10        | `managePackageManagerVersions` | `true`     |
| 11 이상   | `pmOnFail`                     | `download` |

`pnpm install`의 마지막 줄에서 실제로 사용된 버전을 확인할 수 있다.

```text
Done in 14.9s using pnpm v10.34.5
```

## `npm install`로 대신 설치한 경우

pnpm을 찾지 못해 저장소 루트에서 `npm install`을 실행하면 오류 없이 완료된다. 아래 출력은 앱 2개·패키지 2개로 구성된 pnpm workspace 예시 저장소의 결과다.

```text
.
├── package.json          # 루트. devDependencies만 있다
├── pnpm-workspace.yaml   # apps/*, packages/*
├── pnpm-lock.yaml
├── apps/web
├── apps/api
├── packages/contracts    # zod를 사용한다
└── packages/core         # 다른 패키지가 workspace:*로 참조한다
```

```text
$ npm install
added 176 packages, and audited 177 packages in 3s
found 0 vulnerabilities
$ ls -d apps/web/node_modules
ls: apps/web/node_modules: No such file or directory
$ git status --short
?? package-lock.json
```

하위 프로젝트에는 패키지가 설치되지 않았다.

![같은 저장소에서 npm install과 pnpm install의 설치 범위](./images/pnpm-command-not-found-install.svg '왼쪽: npm은 루트 package.json만 처리한다. 오른쪽: pnpm은 pnpm-workspace.yaml에 지정된 프로젝트를 모두 설치한다')

pnpm workspace는 패키지 폴더 목록을 `pnpm-workspace.yaml`에 지정한다. npm은 이 파일을 읽지 않고, 루트 `package.json`에도 npm이 읽는 `workspaces` 필드가 없다. 그래서 npm은 루트 `package.json`의 devDependencies만 설치하고, pnpm이 사용하지 않는 `package-lock.json`을 새로 생성한다.

이 상태에서 빌드하면 하위 패키지에서 실패한다.

```text
$ npm run build
@acme/contracts:build: src/settings.ts(3,19): error TS2307: Cannot find module 'zod' or its corresponding type declarations.
@acme/contracts:build: src/site.ts(9,8): error TS2307: Cannot find module '@acme/core' or its corresponding type declarations.
```

| 오류                              | 원인                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Cannot find module 'zod'`        | `packages/contracts`에 `node_modules`가 없다                                                                                      |
| `Cannot find module '@acme/core'` | `"@acme/core": "workspace:*"`는 같은 저장소의 패키지를 가리킨다. pnpm은 설치 시 이 폴더를 링크로 연결하지만 npm은 연결하지 않는다 |

### 정리 순서

pnpm을 설치한 뒤 npm이 생성한 파일을 삭제하고 다시 설치한다.

```bash
rm -rf package-lock.json node_modules
pnpm install
```

`pnpm install`은 npm이 생성한 `node_modules`가 남아 있어도 동작하지만, `package-lock.json`은 삭제하지 않는다. 남겨 두면 실수로 커밋되거나, 이후 `npm install` 실행 시 다시 갱신된다.

```text
$ pnpm install
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +1144
$ ls -d apps/web/node_modules packages/contracts/node_modules/zod
apps/web/node_modules
packages/contracts/node_modules/zod
```

`Lockfile is up to date`는 커밋된 `pnpm-lock.yaml`을 그대로 사용했다는 뜻이다.

## 요약

- pnpm은 Node.js에 포함되지 않는다. Node 24까지는 Node.js에 포함된 corepack이 pnpm을 내려받았지만, Node 25부터 corepack이 제외되었다
- `npm install -g pnpm`으로 설치한다. 저장소 안에서는 전역 버전과 관계없이 `packageManager`에 지정된 버전이 사용된다
- pnpm workspace 저장소에서 `npm install`은 루트만 설치하고 `pnpm-workspace.yaml`과 `workspace:*`를 처리하지 않는다. 빌드가 `Cannot find module`로 실패하고 `package-lock.json`만 남는다
- npm이 생성한 `package-lock.json`과 `node_modules`를 삭제하고 `pnpm install`을 다시 실행한다

## 관련 글

- [Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup)
- [Mac에서 pip 설치하기](/memo/mac-pip-setup)

## 참고한 공식 문서

영어 문서는 이 글과 관련된 부분만 번역했다.

- [Corepack](https://nodejs.org/docs/latest-v24.x/api/corepack.html) (Node.js v24 문서)
  - "Corepack은 Node.js v25부터 함께 배포되지 않는다. Node.js에 포함된 `corepack`을 사용하고 있다면 사용자 영역에서 제공하는 corepack 모듈로 대체할 수 있다."
- [Workspace](https://pnpm.io/workspaces) (pnpm)
  - "워크스페이스는 루트에 `pnpm-workspace.yaml` 파일이 있어야 한다."
  - "pnpm은 `workspace:` 프로토콜을 지원한다. 이 프로토콜을 사용하면 pnpm은 로컬 워크스페이스 패키지 외의 패키지로 해석하지 않는다."
- [Workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces) (npm)
  - "워크스페이스는 보통 package.json의 `workspaces` 속성으로 정의한다." npm은 `pnpm-workspace.yaml`을 읽지 않으므로, 이 필드가 없는 저장소에서는 루트 패키지만 설치한다.
- [Settings: managePackageManagerVersions](https://pnpm.io/10.x/settings) (pnpm 10)
  - "활성화되어 있으면 pnpm은 `package.json`의 `packageManager` 필드에 지정된 pnpm 버전을 자동으로 내려받아 실행한다. Corepack이 사용하는 것과 같은 필드다." 기본값 `true`.
- [v11.0.0 릴리스 노트](https://github.com/pnpm/pnpm/releases/tag/v11.0.0) (pnpm)
  - `managePackageManagerVersions`·`packageManagerStrict`·`packageManagerStrictVersion` 설정을 제거하고 `pmOnFail`로 통합했다. `managePackageManagerVersions: true`는 `pmOnFail: download`(기본값)에 해당한다.
- [Installation](https://pnpm.io/installation) (pnpm)
  - npm 기반 설치 방법은 `npx get-pnpm`이다. "이 설치 프로그램을 실행하려면 Node.js 22.13 이상이 필요하지만, 설치한 뒤 pnpm을 사용하는 데는 필요 없다."
