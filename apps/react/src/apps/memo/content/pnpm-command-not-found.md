---
title: 'zsh: command not found: pnpm — npm install로 대신하면 안 되는 이유'
date: 2026-10-20
category: 기술 노트/개발 환경
summary: pnpm workspace 저장소에서 pnpm이 없을 때 npm install로 대신하면 루트만 깔려 빌드가 의존성을 못 찾는다. pnpm이 Node에 없는 이유(Node 25부터 corepack도 빠졌다), pnpm을 받는 방법, 전역 버전과 저장소 버전이 다른 이유, npm이 남긴 파일을 치우는 순서를 정리했다.
---

pnpm을 쓰는 저장소를 받아 `pnpm install`이나 `pnpm dev`를 치면 이런 오류가 날 때가 있다.

```text
$ pnpm dev
zsh: command not found: pnpm
```

`node`와 `npm`은 되는데 `pnpm`만 없는 경우다. 이때 `npm install`로 대신하면 오류 없이 끝나는 것처럼 보이지만, 실제로는 일을 하나 더 만든다. 이 글은 왜 pnpm이 없는지, npm으로 대신하면 무엇이 잘못되는지, 어떻게 고치는지를 정리한다.

아래 출력은 앱 둘·패키지 둘로 된 pnpm workspace 예시 저장소에서 돌린 것이다.

```text
.
├── package.json          # 루트. devDependencies만 있다
├── pnpm-workspace.yaml   # apps/*, packages/*
├── pnpm-lock.yaml
├── apps/web
├── apps/api
├── packages/contracts    # zod를 쓴다
└── packages/core         # 다른 패키지가 workspace:*로 가져다 쓴다
```

## 왜 pnpm이 없나

```text
$ node -v
v26.12.0
$ which corepack
corepack not found
```

pnpm은 Node에 들어 있지 않다. Node와 함께 오는 패키지 관리자는 npm뿐이다. 그동안 pnpm을 따로 깔지 않아도 됐던 것은 **corepack** 덕분이다. Node에 함께 들어 있던 corepack이 `package.json`의 `packageManager`를 읽어 그 버전의 pnpm을 받아 준다. 많은 저장소의 설치 안내가 `corepack enable`로 시작하는 것도 그래서다.

```json
"packageManager": "pnpm@10.34.5"
```

그런데 corepack은 Node 25부터 Node에 들어 있지 않다. Homebrew의 `node`처럼 늘 최신 메이저를 따라가는 설치에서는 `corepack enable`부터 `command not found`가 난다. pnpm도 corepack도 없으니 `pnpm`이 없는 것이 맞다.

## `npm install`로 대신하면

pnpm workspace 저장소의 루트에서 `npm install`을 돌리면 오류 없이 끝난다.

```text
$ npm install
added 176 packages, and audited 177 packages in 3s

46 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

하지만 무엇이 깔렸는지 보면 하위 프로젝트에는 아무것도 없다.

```text
$ ls -d apps/web/node_modules
ls: apps/web/node_modules: No such file or directory
$ git status --short
?? package-lock.json
```

![같은 저장소에서 npm install과 pnpm install이 까는 범위](./images/pnpm-command-not-found-install.svg '왼쪽: npm은 루트 package.json만 본다. 오른쪽: pnpm은 pnpm-workspace.yaml의 프로젝트를 모두 깐다')

pnpm workspace에서 어떤 폴더가 패키지인지는 `pnpm-workspace.yaml`에 적는다. npm은 이 파일을 읽지 않고, 루트 `package.json`에도 npm이 읽는 `workspaces` 필드가 없다. 그래서 npm은 루트 `package.json`의 devDependencies와 그 의존성만 깔고, pnpm이 읽지 않는 `package-lock.json`을 하나 새로 만든다.

이 상태로 빌드하면 하위 패키지에서 멈춘다.

```text
$ npm run build
...
@acme/contracts:build: src/settings.ts(3,19): error TS2307: Cannot find module 'zod' or its corresponding type declarations.
@acme/contracts:build: src/site.ts(9,8): error TS2307: Cannot find module '@acme/core' or its corresponding type declarations.
...
```

`packages/contracts`에는 `node_modules`가 없으니 `zod`가 없다. `@acme/core`도 못 찾는데, 이것은 npm 레지스트리에서 받는 패키지가 아니라 같은 저장소의 패키지다. `package.json`에 `"@acme/core": "workspace:*"`로 적혀 있고, pnpm이 설치할 때 이 폴더를 링크로 이어 준다. npm으로는 이 연결이 생기지 않는다.

**pnpm 저장소에서 `npm install`은 대신이 되지 않는다.** pnpm부터 받아야 한다.

## pnpm 받기

방법은 셋 있다.

| 방법                                          | 비고                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------ |
| `npm install -g pnpm`                         | 가장 간단하다. Homebrew로 깐 npm이면 `/opt/homebrew/bin/pnpm`이 생긴다   |
| `npm install -g corepack` → `corepack enable` | Node 24 이하에서 쓰던 흐름 그대로. corepack을 npm 패키지로 받는다        |
| Node 24 이하로 내리기                         | 저장소가 `.node-version` 등으로 버전을 정해 두었다면 그 버전을 쓰는 방법 |

`npm install -g pnpm`으로 받으면 이렇게 된다.

```text
$ npm install -g pnpm
$ npm ls -g --depth=0
/opt/homebrew/lib
├── npm@11.20.0
└── pnpm@12.14.0
$ ls -l /opt/homebrew/bin/pnpm
lrwxr-xr-x  … /opt/homebrew/bin/pnpm -> ../lib/node_modules/pnpm/pnpm
```

Homebrew로 깐 npm은 전역 패키지를 `/opt/homebrew`에 깔기 때문에 `sudo`가 필요 없고, `/opt/homebrew/bin`이 이미 PATH에 있어서 따로 PATH를 고칠 일도 없다. ([Mac에서 Homebrew와 npm 설정하기](/memo/brew-npm-setup) 참고)

### 깐 것은 12인데, 저장소에서는 10

전역으로 깐 pnpm은 12.14.0이다. 그런데 저장소 안에서 버전을 물으면 다른 답이 나온다.

```text
$ cd ~ && pnpm -v
12.14.0
$ cd ~/projects/acme && pnpm -v
10.34.5
```

pnpm은 실행될 때 `package.json`의 `packageManager`를 보고, 적힌 버전과 자기 버전이 다르면 그 버전을 받아 대신 돌린다. corepack이 하던 일을 pnpm이 스스로 하는 셈이다. 그래서 전역에 어떤 pnpm을 깔았든, 저장소 안에서는 저장소가 정한 버전으로 돈다. `pnpm install`의 마지막 줄에서도 확인된다.

```text
Done in 14.9s using pnpm v10.34.5
```

## npm이 남긴 것 치우기

npm이 만든 `node_modules`와 `package-lock.json`이 남아 있어도 `pnpm install`은 돈다. pnpm은 npm의 `node_modules`를 자기 방식으로 다시 깔고, 이번에는 모든 프로젝트를 깐다.

```text
$ pnpm install
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Packages: +1144
...
$ ls -d apps/web/node_modules packages/contracts/node_modules/zod
apps/web/node_modules
packages/contracts/node_modules/zod
```

`Lockfile is up to date`는 커밋된 `pnpm-lock.yaml`을 그대로 썼다는 뜻이다. 다만 `package-lock.json`은 그대로 남는다.

```text
$ git status --short
?? package-lock.json
```

`pnpm install`은 이 파일을 지우지 않는다. 두면 누군가 실수로 커밋하거나, 다음에 `npm install`을 쳤을 때 다시 쓰인다. 지운다. `node_modules`도 함께 지우고 다시 까는 편이 깔끔하다.

```bash
rm -rf package-lock.json node_modules
pnpm install
```

## 정리

- `zsh: command not found: pnpm`: pnpm은 Node에 들어 있지 않다. Node 24까지는 함께 오던 corepack이 받아 줬지만, Node 25부터 corepack도 빠졌다
- pnpm workspace 저장소에서 `npm install`은 루트만 깔고, `pnpm-workspace.yaml`과 `workspace:*`를 모른다. 빌드가 `Cannot find module`로 멈추고 `package-lock.json`만 남는다
- `npm install -g pnpm`으로 받으면 된다. 전역 버전과 상관없이 저장소 안에서는 `packageManager`에 적힌 버전으로 돈다
- npm이 남긴 `package-lock.json`과 `node_modules`를 지우고 `pnpm install`을 다시 돌린다
