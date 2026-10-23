---
title: Mac에서 Homebrew와 npm 설치하기 — 설치 순서, 확인 명령, 자주 나는 문제
date: 2026-10-20
category: 기술 노트/개발 환경
summary: Apple Silicon Mac에 Homebrew와 Node·npm을 설치하는 순서를 명령 단위로 정리했다. 단계마다 확인 명령과 정상 출력, 특정 Node 버전(node@22)과 corepack 설정, 자주 나는 오류와 해결 방법을 적고, 파일 위치와 .npmrc 우선순위는 뒤에 따로 정리했다.
---

Apple Silicon Mac 기준이다. 아래 순서대로 실행하면 Homebrew, Node, npm 설치가 끝난다.

## 설치 순서

```bash
# 1. Homebrew 설치 (실행 전 수행할 작업을 출력하고 확인을 받는다)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. PATH 설정: 설치 마지막의 "Next steps"에 출력되는 명령과 같다
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv zsh)"

# 3. Node와 npm 설치 (npm은 Node에 포함되어 있다)
brew install node
```

2단계를 생략하면 새 터미널에서 `brew`를 찾지 못한다. Homebrew 공식 문서도 이 설정을 따르지 않으면 Homebrew가 동작하지 않는다고 명시한다.

### 단계별 확인

새 터미널 창을 열고 확인한다.

| 확인 명령                    | 정상 출력 (이 글 작성 시각 기준) | 다르게 나오면                                      |
| ---------------------------- | -------------------------------- | -------------------------------------------------- |
| `brew --version`             | `Homebrew 7.0.10`                | `command not found: brew` → 2단계 누락             |
| `brew config \| grep PREFIX` | `HOMEBREW_PREFIX: /opt/homebrew` | `/usr/local` → Intel(Rosetta)용으로 설치됨, 재설치 |
| `which node`                 | `/opt/homebrew/bin/node`         | 다른 경로 → 다른 방법으로 설치한 Node가 우선함     |
| `node -v`                    | `v26.12.0`                       | 아래 "특정 Node 버전" 참고                         |
| `npm -v`                     | `11.20.0`                        |                                                    |
| `npm config get prefix`      | `/opt/homebrew`                  | `/usr/local` → 공식 `.pkg`로 설치한 npm이 우선함   |

실행 환경은 macOS 27.0.1(arm64), Homebrew 7.0.10이다.

### 설치 요구 사항

[Homebrew 설치 문서](https://docs.brew.sh/Installation) 기준이다.

- Apple Silicon CPU (64비트 Intel은 지원 등급이 가장 낮은 Tier 3)
- macOS 15 Sequoia 이상 (11~14는 공식 지원 대상이 아니지만 동작할 수 있다)
- `bash` (macOS 기본 포함)
- Xcode Command Line Tools: formula를 **소스에서 빌드하는 경우에만** 필요하다. 미리 빌드된 bottle과 cask는 개발 도구 없이 설치된다

터미널을 사용하지 않으려면 Homebrew GitHub 릴리스의 `.pkg` 설치 파일을 사용할 수 있다 (Apple Silicon만 지원).

## 특정 Node 버전이 필요한 경우

`brew install node`는 항상 최신 메이저 버전(현재 26)을 설치하고, `brew upgrade` 시 메이저 버전도 함께 올라간다. 프로젝트가 `.node-version`이나 `engines`로 22를 요구한다면 메이저 버전별 formula를 설치한다.

```bash
brew install node@22
# ~/.zprofile의 brew shellenv 줄 아래에 추가
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zprofile
```

```text
$ node -v
v22.23.3
```

- `node@22`는 keg-only다. 설치해도 `/opt/homebrew/bin`에 링크되지 않으므로 PATH에 직접 추가해야 한다
- PATH 줄은 반드시 `brew shellenv` **아래에** 둔다. 위에 두면 shellenv가 `/opt/homebrew/bin`을 다시 맨 앞에 추가해 26이 우선한다
- `opt/node@22` 경로는 버전 번호가 없는 링크라 `brew upgrade` 뒤에도 유효하다

프로젝트마다 Node 버전이 다르면 버전 관리자(fnm, mise 등)를 `brew`로 설치하고 `.node-version`을 읽게 하는 방식이 관리하기 쉽다. npm 문서도 전역 설치 권한 문제를 피하는 가장 좋은 방법으로 Node 버전 관리자를 권장한다.

## corepack (pnpm·yarn)

Node 25부터 corepack이 Node에 포함되지 않는다. brew의 `node`(26)에서는 별도로 설치한다.

```bash
npm install -g corepack
corepack enable
```

```text
$ corepack --version
0.36.0
```

`corepack enable` 뒤에는 `package.json`의 `packageManager`(예: `"pnpm@10.34.5"`)에 지정된 버전의 pnpm을 사용한다. Node 22를 PATH에 추가했다면 corepack이 포함되어 있으므로 `corepack enable`만 실행한다. corepack 없이 `npm install`로 대신했을 때 발생하는 문제는 [zsh: command not found: pnpm](/memo/pnpm-command-not-found)에 정리했다.

## 자주 나는 문제

| 증상                                  | 원인                                                            | 해결                                                                                   |
| ------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `zsh: command not found: brew`        | `brew shellenv` 줄이 셸 설정 파일에 없음                        | 설치 순서 2단계 실행. VS Code 터미널처럼 로그인 셸이 아닌 곳이면 `~/.zshrc`에도 추가   |
| `HOMEBREW_PREFIX`가 `/usr/local`      | Rosetta 터미널에서 Intel용 Homebrew를 설치                      | Rosetta를 끈 터미널에서 재설치                                                         |
| `npm install -g`에서 `EACCES`         | prefix가 `/usr/local`인 npm(공식 `.pkg`)을 사용 중              | `sudo`를 붙이지 않는다. `which npm`으로 경로 확인 후 brew의 npm이 우선하도록 PATH 수정 |
| `node -v`가 프로젝트 요구 버전과 다름 | brew의 `node`는 항상 최신 메이저                                | `node@22` + PATH, 또는 버전 관리자                                                     |
| `node@22`를 설치했는데 `node -v`가 26 | keg-only라 링크되지 않음, 또는 PATH 줄이 shellenv보다 위에 있음 | PATH 줄을 shellenv 아래로 이동                                                         |
| `corepack: command not found`         | Node 25 이상에는 corepack이 없음                                | `npm install -g corepack`                                                              |

`sudo npm install -g`는 root 소유 파일을 만들어 이후 설치에서 권한 오류를 일으킨다. brew로 설치한 npm은 전역 설치 경로가 사용자 계정 소유인 `/opt/homebrew`이므로 `sudo`가 필요 없다.

## 설치 상태 점검 명령

| 명령               | 용도                                                              |
| ------------------ | ----------------------------------------------------------------- |
| `brew leaves`      | 직접 설치한 formula 목록 (의존성 제외). `brew list`는 의존성 포함 |
| `brew info node`   | 설치된 버전, 링크 여부(`[Linked]`)                                |
| `brew doctor`      | 설정 문제 진단                                                    |
| `brew bundle dump` | 설치 목록을 `Brewfile`로 저장. 새 Mac에서 `brew bundle`로 복원    |
| `npm config ls -l` | npm 설정값과 설정 파일 위치                                       |

---

여기부터는 설치 결과가 어디에 저장되고 어떤 규칙으로 적용되는지 정리한다.

![Homebrew 접두사 안의 Node 파일 위치와 npm 설정 우선순위](./images/brew-npm-setup-layout.svg '왼쪽: 실제 파일(Cellar)과 링크(bin), 링크되지 않는 keg-only. 오른쪽: npm이 설정 값을 고르는 순서')

## 파일 위치

| 경로                                   | 내용                                                           |
| -------------------------------------- | -------------------------------------------------------------- |
| `/opt/homebrew`                        | Homebrew 접두사(prefix). Intel Mac은 `/usr/local`              |
| `/opt/homebrew/Cellar/node/26.12.0/`   | 실제 파일. 버전마다 별도 폴더                                  |
| `/opt/homebrew/bin/node`, `npm`, `npx` | Cellar를 가리키는 심볼릭 링크. 링크된 버전이 PATH에서 사용된다 |
| `/opt/homebrew/opt/node@22/`           | keg-only formula. `bin/`에 링크되지 않는다                     |
| `/opt/homebrew/lib/node_modules/`      | `npm install -g` 설치 경로                                     |
| `/opt/homebrew/etc/npmrc`              | npm 전역 설정 파일                                             |

```text
$ ls -l /opt/homebrew/bin/npm
lrwxr-xr-x  1 …  admin  30 Oct 20 12:33 /opt/homebrew/bin/npm -> ../Cellar/node/26.12.0/bin/npm
```

## `brew shellenv`가 하는 일

`brew shellenv`는 환경 변수를 설정하는 셸 명령을 출력하고, `eval`이 그 출력을 실행한다. 빈 환경에서 실행하면 출력 내용을 확인할 수 있다.

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

- `PATH`: `/opt/homebrew/bin`을 **맨 앞에** 추가한다. macOS 기본 `/usr/bin`의 같은 이름 도구보다 brew로 설치한 도구가 우선한다
- `fpath`: zsh 자동 완성 파일 경로
- PATH가 이미 `/opt/homebrew/bin:/opt/homebrew/sbin`으로 시작하면 아무것도 출력하지 않는다. `.zprofile`과 `.zshrc`에 모두 추가해도 PATH가 중복되지 않는다

```text
$ env -i HOME=$HOME PATH=/usr/bin:/bin /opt/homebrew/bin/brew shellenv zsh | wc -l
       8
$ env -i HOME=$HOME PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/bin:/bin /opt/homebrew/bin/brew shellenv zsh | wc -l
       0
```

`.zprofile`은 로그인 셸에서만 읽는다. macOS 터미널 앱은 창마다 로그인 셸을 실행하므로 `.zprofile`로 충분하고, 로그인 셸이 아닌 터미널에서 `brew`를 찾지 못하면 `.zshrc`에 추가한다.

## npm 설정 우선순위

npm 설정은 여러 위치에서 읽고, 위쪽이 아래쪽을 덮어쓴다.

1. 명령줄 옵션 (`--save-exact`)
2. 환경 변수 (`npm_config_save_exact=true`)
3. 프로젝트 폴더의 `.npmrc`
4. 사용자 설정 `~/.npmrc` (userconfig)
5. 전역 설정 `/opt/homebrew/etc/npmrc` (globalconfig)
6. npm 내장 `npmrc`

`~/.npmrc`가 없어도 prefix가 `/opt/homebrew`인 이유는 6번, Homebrew가 npm 내장 설정에 기록한 값이기 때문이다.

```text
$ npm config list
; "builtin" config from /opt/homebrew/lib/node_modules/npm/npmrc

prefix = "/opt/homebrew"
```

`npm config set`은 기본으로 `~/.npmrc`에 기록한다. `npm config ls`는 덮어쓰인 값을 주석으로 표시하므로 값의 출처를 확인할 수 있다.

```text
$ npm config ls --userconfig ../npmrc
; "user" config from ../npmrc

init-license = "MIT"
; save-exact = true ; overridden by project
; save-prefix = "" ; overridden by project
```

자주 사용하는 설정은 다음과 같다.

| 키              | 기능                                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| `save-exact`    | `npm install x`가 `^1.2.3` 대신 `1.2.3`을 기록한다. `save-prefix`도 빈 값이 된다 |
| `init-license`  | `npm init`이 생성하는 `package.json`의 license 기본값                            |
| `fund`, `audit` | 설치 후 후원 안내, 취약점 검사 표시 여부 (기본 `true`)                           |
| `registry`      | 패키지 레지스트리 주소. 사내 레지스트리를 사용할 때 변경                         |

인증 토큰(`//registry.npmjs.org/:_authToken=…`)은 사용자 설정(`~/.npmrc`)에만 저장하고, 버전 관리에 포함되는 프로젝트 `.npmrc`에는 저장하지 않는다.

## 관련 글

- [Mac에서 pip 설치하기](/memo/mac-pip-setup)
- [zsh: command not found: pnpm](/memo/pnpm-command-not-found)

## 참고한 공식 문서

- [brew.sh](https://brew.sh/), [Installation](https://docs.brew.sh/Installation) (Homebrew): 설치 명령, macOS 요구 사항, 기본 접두사(`/opt/homebrew`), 설치 후 셸 설정을 따르지 않으면 Homebrew가 동작하지 않는다는 안내
- [FAQ](https://docs.brew.sh/FAQ) (Homebrew): keg-only의 의미(Cellar에만 설치되고 접두사에 링크되지 않음), `sudo`를 사용하지 않는 이유
- [npmrc](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc), [config](https://docs.npmjs.com/cli/v11/using-npm/config) (npm): 설정 파일 네 종류와 우선순위, `save-exact`·`save-prefix`, 인증 토큰은 레지스트리별로 지정
- [Resolving EACCES permissions errors](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) (npm): 전역 설치 권한 오류는 Node 버전 관리자로 해결하는 것을 권장
- [Corepack](https://nodejs.org/docs/latest-v24.x/api/corepack.html) (Node.js v24 문서): Node.js v25부터 corepack을 함께 배포하지 않으며, npm 패키지 `corepack`으로 대체할 수 있다
