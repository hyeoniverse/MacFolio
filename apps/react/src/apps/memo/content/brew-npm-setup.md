---
title: Mac에서 Homebrew와 npm 설정하기 — PATH, keg-only, .npmrc
date: 2026-10-20
category: 기술 노트/개발 환경
summary: Apple Silicon Mac에서 Homebrew가 파일을 어디에 두고 PATH를 어떻게 잡는지, brew로 깐 Node·npm의 전역 설치 위치와 .npmrc 우선순위를 실제 출력으로 정리했다. brew의 node가 늘 최신 메이저라 프로젝트가 정한 Node 버전·corepack과 어긋날 때 어떻게 하는지도 적었다.
---

새 Mac에서 개발을 시작하면 Homebrew를 깔고, `brew install node`로 Node와 npm을 받는 것이 보통의 첫 순서다. 명령 두 줄이면 끝나지만, 그 뒤에 "왜 이 버전이 잡히지?", "`npm install -g`는 어디에 깔리지?", "이 설정은 어느 파일에서 왔지?"를 물으면 바로 답하기 어렵다. 이 글은 실제 출력으로 그 답을 정리한다.

이 글의 출력은 모두 아래 환경에서 나왔다.

```text
$ sw_vers -productVersion; uname -m
27.0.1
arm64
$ brew --version
Homebrew 7.0.10
$ node -v; npm -v
v26.12.0
11.20.0
```

<details id="terms">
<summary>먼저 알아 둘 용어</summary>

| 용어           | 뜻                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| formula, cask  | Homebrew가 까는 것의 두 종류. formula는 명령줄 도구(`node`, `git`), cask는 `.app`으로 된 Mac 앱(`visual-studio-code`)이다     |
| 접두사(prefix) | Homebrew가 모든 파일을 두는 맨 위 폴더. Apple Silicon은 `/opt/homebrew`, Intel Mac은 `/usr/local`                             |
| Cellar         | `<접두사>/Cellar/<이름>/<버전>/`. 실제 파일이 버전마다 따로 놓이는 곳                                                         |
| link           | Cellar의 파일을 `<접두사>/bin` 등에 심볼릭 링크로 거는 것. 링크가 걸린 버전이 PATH에서 보인다                                 |
| keg-only       | 일부러 link하지 않은 formula. `node@22`처럼 다른 버전과 이름이 겹치는 것이 그렇다                                             |
| `.npmrc`       | npm 설정 파일. `키=값`을 한 줄에 하나씩 적는다. 프로젝트 폴더, 홈 폴더, 전역 위치에 각각 둘 수 있다                           |
| corepack       | `package.json`의 `packageManager`에 적힌 pnpm·yarn 버전을 받아 주는 도구. Node 24까지는 함께 들어 있었지만 Node 25부터 빠졌다 |

</details>

![Homebrew 접두사 안의 Node 파일 위치와 npm 설정 우선순위](./images/brew-npm-setup-layout.svg '왼쪽: 실제 파일(Cellar)과 링크(bin), 링크되지 않는 keg-only. 오른쪽: npm이 설정 값을 고르는 순서')

## Homebrew: PATH 잡기

공식 설치 스크립트가 끝나면 "Next steps"로 `~/.zprofile`에 한 줄을 더하라고 안내한다.

```bash
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

`brew shellenv`는 PATH를 직접 바꾸지 않고, 바꾸는 셸 명령을 출력한다. 그것을 `eval`이 실행한다. 빈 환경에서 돌리면 무엇을 내보내는지 보인다.

```text
$ env -i HOME=$HOME /bin/zsh -fc '/opt/homebrew/bin/brew shellenv zsh'
export HOMEBREW_PREFIX="/opt/homebrew";
export HOMEBREW_CELLAR="/opt/homebrew/Cellar";
export HOMEBREW_REPOSITORY="/opt/homebrew";
fpath[1,0]="/opt/homebrew/share/zsh/site-functions";
export FPATH;
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin${PATH+:$PATH}";
[ -z "${MANPATH-}" ] || { export MANPATH="${MANPATH%"${MANPATH##*[!:]}"}"; export MANPATH=":${MANPATH#"${MANPATH%%[!:]*}"}"; };
export INFOPATH="/opt/homebrew/share/info:${INFOPATH:-}";
```

핵심은 `PATH` 줄이다. `/opt/homebrew/bin`을 **맨 앞에** 두므로, macOS에 원래 있는 `/usr/bin`의 같은 이름 도구보다 brew로 깐 것이 먼저 잡힌다. `fpath`는 zsh 자동 완성 파일 위치라, 이 줄이 있어야 `brew ins<Tab>`이 채워진다.

이미 설정된 셸에서 `brew shellenv`를 그냥 돌리면 아무것도 나오지 않는다. 고장이 아니다. PATH를 바꿔 가며 출력 줄 수를 세어 보면 규칙이 보인다.

```text
$ env -i HOME=$HOME PATH=/usr/bin:/bin /opt/homebrew/bin/brew shellenv zsh | wc -l
       8
$ env -i HOME=$HOME PATH=/usr/bin:/bin:/opt/homebrew/bin:/opt/homebrew/sbin /opt/homebrew/bin/brew shellenv zsh | wc -l
       8
$ env -i HOME=$HOME PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin /opt/homebrew/bin/brew shellenv zsh | wc -l
       0
```

PATH가 이미 `/opt/homebrew/bin:/opt/homebrew/sbin`으로 **시작하면** 할 일이 없다고 보고 빈 출력을 낸다. 그래서 `.zprofile`과 `.zshrc` 양쪽에 같은 줄이 들어가도 PATH가 두 번 쌓이지 않는다. 반대로 brew 경로가 PATH 뒤쪽에만 있으면 다시 맨 앞으로 끌어온다.

`.zprofile`에 두는 이유는 로그인 셸에서 한 번만 읽히기 때문이다. macOS의 터미널 앱은 새 창마다 로그인 셸을 띄우므로 이것으로 충분하다. VS Code의 통합 터미널처럼 로그인 셸이 아닌 곳에서 brew가 안 잡히면 그때 `.zshrc`로 옮긴다.

설정이 맞는지는 `brew config`로 본다.

```text
$ brew config
HOMEBREW_VERSION: 7.0.10
...
HOMEBREW_PREFIX: /opt/homebrew
...
Git: 2.54.0 => /Library/Developer/CommandLineTools/usr/bin/git
Curl: 8.7.1 => /usr/bin/curl
macOS: 27.0.1-arm64
CLT: 27.0.0.0.1788430756
Rosetta 2: false
```

`HOMEBREW_PREFIX`가 `/opt/homebrew`면 Apple Silicon용 Homebrew다. `/usr/local`이 나오면 Intel용(Rosetta)을 깐 것이니 다시 까는 편이 낫다. `CLT`는 Xcode Command Line Tools로, brew가 소스를 빌드할 때 쓴다.

### 실제로 무엇을 깔았는지

`brew list`는 의존성까지 모두 보여 줘서, `node` 하나만 깔아도 25개가 나온다. 직접 깐 것만 보려면 `brew leaves`를 쓴다.

```text
$ brew list --formula -1 | wc -l
      25
$ brew leaves
node
```

새 Mac으로 옮길 때는 `brew bundle dump`로 이 목록을 `Brewfile`에 적어 두고, 새 Mac에서 `brew bundle`로 한 번에 깔 수 있다.

## brew로 깐 Node와 npm

`brew install node`는 Node와 npm을 함께 깐다. 파일은 Cellar에 버전별로 놓이고, `bin/`에는 링크만 걸린다.

```text
$ ls -l /opt/homebrew/bin/npm
lrwxr-xr-x  1 …  admin  30 Oct 20 12:33 /opt/homebrew/bin/npm -> ../Cellar/node/26.12.0/bin/npm
$ brew info node
==> node: stable 26.12.0 (bottled), HEAD
...
Aliases: node.js, node@26, nodejs, npm
==> Installed Versions
node 26.12.0 (2,077 files, 75.3MB) [Linked]
```

`[Linked]`가 지금 PATH에서 보이는 버전이라는 표시다. `node`라는 이름은 늘 **가장 새 버전**을 가리킨다. `brew upgrade`를 하면 Node의 메이저 버전도 함께 올라간다.

### 전역 설치(`npm install -g`)는 어디로

npm은 전역 패키지를 `<prefix>/lib/node_modules`에 깐다. brew로 깐 npm은 prefix가 `/opt/homebrew`다.

```text
$ npm config get prefix
/opt/homebrew
$ ls /opt/homebrew/lib/node_modules
npm
```

`/opt/homebrew`는 내 계정이 쓸 수 있는 폴더라, `sudo npm install -g`가 필요 없다. 공식 설치 파일(.pkg)로 깐 Node는 prefix가 `/usr/local`이라 권한 오류가 나서 `sudo`를 붙이곤 했는데, brew로 깔면 그 문제가 없다. **`sudo`를 붙이지 않는다.** 붙이면 root 소유 파일이 생겨 다음 설치부터 권한 오류가 난다.

## npm 설정: `.npmrc`와 우선순위

npm 설정은 여러 곳에서 오고, 위쪽이 아래쪽을 덮는다.

1. 명령줄 옵션 (`--save-exact`)
2. 환경 변수 (`npm_config_save_exact=true`)
3. 프로젝트 폴더의 `.npmrc`
4. 사용자 설정 `~/.npmrc` (userconfig)
5. 전역 설정 `/opt/homebrew/etc/npmrc` (globalconfig)
6. npm에 내장된 `npmrc`

파일 위치는 `npm config ls -l`로 본다.

```text
$ npm config ls -l | grep -E '^(userconfig|globalconfig|prefix|cache|registry) '
cache = "~/.npm"
globalconfig = "/opt/homebrew/etc/npmrc"
registry = "https://registry.npmjs.org/"
userconfig = "~/.npmrc"
prefix = "/opt/homebrew"
```

`~/.npmrc`가 없어도 `prefix = /opt/homebrew`가 잡혀 있다. 6번, brew가 넣어 둔 npm 내장 설정에서 온 값이다.

```text
$ npm config list
; "builtin" config from /opt/homebrew/lib/node_modules/npm/npmrc

prefix = "/opt/homebrew"
```

### 설정 바꾸기

`npm config set`은 기본으로 `~/.npmrc`에 쓴다. `--userconfig`로 다른 파일을 지정하면 홈 폴더를 건드리지 않고 시험할 수 있다.

```text
$ npm config set init-license MIT --userconfig ./npmrc
$ npm config set save-exact true --userconfig ./npmrc
$ cat ./npmrc
init-license=MIT
save-exact=true
```

자주 쓰는 값은 이 정도다.

| 키              | 하는 일                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `save-exact`    | `npm install x`가 `^1.2.3` 대신 `1.2.3`을 적는다. 버전이 저절로 올라가지 않는다 |
| `init-license`  | `npm init`이 만드는 `package.json`의 license 기본값                             |
| `fund`, `audit` | 설치 뒤 후원 안내, 취약점 검사를 보일지 (기본 `true`)                           |
| `registry`      | 패키지를 받을 주소. 사내 저장소를 쓸 때 바꾼다                                  |

토큰(`//registry.npmjs.org/:_authToken=…`)도 `.npmrc`에 들어간다. 사용자 설정(`~/.npmrc`)에만 두고, 저장소에 커밋하는 프로젝트 `.npmrc`에는 넣지 않는다.

### 우선순위 확인하기

사용자 설정에 `save-exact=true`, 프로젝트 `.npmrc`에 `save-exact=false`를 두고 값을 물으면 이렇다.

```text
$ npm config get save-exact --userconfig ../npmrc
false
$ npm_config_save_exact=true npm config get save-exact --userconfig ../npmrc
true
$ npm config get save-exact --userconfig ../npmrc --save-exact=true
true
```

프로젝트(3번)가 사용자 설정(4번)을 이기고, 환경 변수(2번)와 명령줄(1번)은 프로젝트를 이긴다. `npm config ls`는 진 값도 주석으로 남겨 두어서, 어디서 덮였는지 바로 보인다.

```text
$ npm config ls --userconfig ../npmrc
; "user" config from ../npmrc

init-license = "MIT"
; save-exact = true ; overridden by project
; save-prefix = "" ; overridden by project
...
```

`save-exact=true`를 쓰면 npm이 `save-prefix`(버전 앞에 붙일 `^`)도 빈 값으로 함께 정한다는 것도 이 출력에서 보인다.

## brew의 node와 프로젝트의 Node 버전

프로젝트가 `.node-version`이나 `engines`로 Node 버전을 정해 두었고(예: 22), 설치 안내가 `corepack enable`로 pnpm을 받으라고 한다고 하자. `brew install node`로 받은 것은 최신 메이저(지금 26)이고, corepack이 없다.

```text
$ cat .node-version
22
$ node -v
v26.12.0
$ which corepack
corepack not found
$ ls /opt/homebrew/lib/node_modules
npm
```

Node 25부터 corepack이 Node에 들어 있지 않다. brew의 `node`는 늘 가장 새 버전을 따라가므로, "brew install node → corepack enable"이라는 예전 순서가 그대로는 안 된다.

### Node 22를 쓰려면: `node@22` (keg-only)

brew는 메이저 버전별 formula를 따로 둔다.

```text
$ brew search '/^node@/'
node@18
node@20
node@22
node@24
node@26
$ brew info node@22
==> node@22: stable 22.23.3 (bottled) [keg-only]
...
==> Caveats
node@22 is keg-only, which means it was not symlinked into /opt/homebrew,
because this is an alternate version of another formula.
```

keg-only라서 `brew install node@22`를 해도 `node` 명령은 여전히 26을 가리킨다. 22를 쓰려면 `node@22`의 bin을 PATH 앞에 직접 더한다. 경로는 버전 번호가 없는 `opt/` 링크를 쓰면 `brew upgrade` 뒤에도 바뀌지 않는다.

```bash
# ~/.zprofile, brew shellenv 줄 아래에
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

shellenv보다 **아래에** 둬야 한다. 위에 두면 shellenv가 `/opt/homebrew/bin`을 다시 맨 앞에 끼워 넣어 26이 먼저 잡힌다.

프로젝트마다 Node 버전이 다르면, brew로 버전을 바꾸기보다 버전 관리자(fnm, mise 등)를 brew로 깔고 `.node-version`을 읽게 하는 편이 낫다. 폴더에 들어갈 때 버전이 저절로 바뀐다.

### corepack 따로 받기

Node 25 이상에서는 corepack을 npm 패키지로 받는다. 임시 prefix에 깔아 보면 무엇이 생기는지 보인다.

```text
$ npm install -g corepack --prefix ./global

added 1 package in 450ms
$ ls ./global/bin
corepack
pnpm
pnpx
yarn
yarnpkg
$ ./global/bin/corepack --version
0.36.0
```

`--prefix` 없이 `npm install -g corepack`을 하면 brew의 prefix(`/opt/homebrew`)에 깔리고, `/opt/homebrew/bin/corepack`이 생겨 바로 PATH에서 보인다. 그다음 `corepack enable`을 하면 `package.json`의 `packageManager`(예: `"pnpm@10.34.5"`)대로 pnpm을 받는다. 다만 프로젝트의 CI가 정해진 Node 버전(예: 22)으로 돈다면, 로컬에서도 같은 버전을 쓰는 편이 결과가 같다. pnpm이 없을 때 `npm install`로 버티면 생기는 일은 [zsh: command not found: pnpm](/memo/pnpm-command-not-found)에 따로 적었다.

## 정리

- Homebrew는 `/opt/homebrew`에 모두 두고, `.zprofile`의 `brew shellenv` 한 줄이 PATH 맨 앞에 `bin`·`sbin`을 넣는다. 이미 맨 앞에 있으면 아무것도 출력하지 않는다
- 깐 것 목록은 `brew leaves`, 상태 점검은 `brew config`와 `brew doctor`
- brew의 `node`는 늘 최신 메이저다. 특정 버전은 `node@22` 같은 keg-only formula를 PATH에 직접 더하거나, 버전 관리자를 쓴다
- brew로 깐 npm은 전역 패키지를 `/opt/homebrew/lib/node_modules`에 깔므로 `sudo`가 필요 없다
- npm 설정은 명령줄 > 환경 변수 > 프로젝트 `.npmrc` > `~/.npmrc` > 전역 > 내장 순으로 이기고, `npm config ls`가 덮인 값을 주석으로 보여 준다
- Node 25부터 corepack이 빠졌다. `npm install -g corepack`으로 따로 받는다
