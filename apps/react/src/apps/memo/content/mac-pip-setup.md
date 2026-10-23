---
title: Mac에서 pip 설치하기 — Homebrew Python, venv, pipx, externally-managed-environment
date: 2026-10-23
category: 기술 노트/개발 환경
summary: Apple Silicon Mac에서 Homebrew로 Python과 pip를 설치하고 확인하는 순서를 정리했다. pip3 install이 externally-managed-environment 오류로 실패하는 이유(PEP 668)와 venv·pipx로 해결하는 방법, 시스템 python3(Xcode CLT)와의 차이, 자주 나는 오류를 함께 적었다.
---

Apple Silicon Mac 기준이다. Homebrew가 설치되어 있어야 한다([Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup)의 설치 순서 1~2단계).

## 설치 순서

```bash
# 1. Python 설치 (pip가 포함되어 있다)
brew install python

# 2. 확인
python3 --version
python3 -m pip --version
```

```text
$ python3 --version
Python 3.15.0
$ python3 -m pip --version
pip 26.2.2 from /opt/homebrew/lib/python3.15/site-packages/pip (python 3.15)
```

pip 출력의 경로가 `/opt/homebrew/...`이면 Homebrew Python의 pip다. 이후 패키지 설치는 아래 둘 중 하나로 한다.

```bash
# 프로젝트에서 사용하는 라이브러리: 가상 환경(venv)
python3 -m venv .venv
source .venv/bin/activate
pip install requests

# 명령줄 도구(black, httpie 등): pipx
brew install pipx
pipx ensurepath
pipx install black
```

Homebrew Python에서는 `pip3 install requests`를 그대로 실행하면 아래 오류가 발생한다. 정상 동작이며, 위의 두 방법이 해결 방법이다.

![Mac의 python3 두 종류와 패키지 설치 위치](./images/mac-pip-setup-pythons.svg '시스템 python3(CLT)는 개발용으로 사용하지 않고, Homebrew python3에는 직접 설치하지 않는다. 라이브러리는 venv, 명령줄 도구는 pipx에 설치한다')

## externally-managed-environment 오류

```text
$ pip3 install requests
error: externally-managed-environment

× This environment is externally managed
╰─> To install Python packages system-wide, try brew install
    xyz, where xyz is the package you are trying to
    install.

    If you wish to install a Python library that isn't in Homebrew,
    use a virtual environment:

    python3 -m venv path/to/venv
    source path/to/venv/bin/activate
    python3 -m pip install xyz

    If you wish to install a Python application that isn't in Homebrew,
    it may be easiest to use 'pipx install xyz', which will manage a
    virtual environment for you. You can install pipx with

    brew install pipx
    ...
    Read more about this behavior here: <https://peps.python.org/pep-0668/>
```

### 원인: PEP 668

[PEP 668](https://peps.python.org/pep-0668/)은 운영체제나 패키지 관리자가 관리하는 Python 환경에 pip가 직접 설치하지 못하게 하는 규칙이다. 표준 라이브러리 폴더에 `EXTERNALLY-MANAGED` 파일이 있으면 pip는 설치를 거부한다. Homebrew Python에는 이 파일이 포함되어 있다.

```text
$ ls "$(python3 -c 'import sysconfig; print(sysconfig.get_path("stdlib"))')/EXTERNALLY-MANAGED"
/opt/homebrew/opt/python@3.15/Frameworks/Python.framework/Versions/3.15/lib/python3.15/EXTERNALLY-MANAGED
```

이 규칙이 필요한 이유는 Homebrew의 다른 formula가 같은 Python을 사용하기 때문이다. pip로 설치한 패키지가 brew가 설치한 패키지를 덮어쓰거나 버전을 바꾸면 그 formula가 동작하지 않을 수 있다. 또한 `brew upgrade`로 Python 마이너 버전이 올라가면(3.15 → 3.16) site-packages 경로가 바뀌어 pip로 설치한 패키지가 모두 사라진다.

### 해결 방법 비교

| 방법                                   | 용도                        | 권장 여부 | 비고                                                                                 |
| -------------------------------------- | --------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `python3 -m venv .venv`                | 프로젝트 라이브러리         | 권장      | 프로젝트마다 독립된 환경. `.venv`는 버전 관리에서 제외하고 `requirements.txt`로 기록 |
| `pipx install <도구>`                  | 명령줄 도구                 | 권장      | 도구마다 venv를 만들고 실행 파일만 PATH(`~/.local/bin`)에 연결                       |
| `brew install <이름>`                  | Homebrew에 있는 도구        | 권장      | `brew install black`처럼 formula가 있으면 brew로 관리                                |
| `pip3 install --user`                  | 사용자 site-packages        | 비권장    | Homebrew Python에서는 `--user`만으로 오류가 해제되지 않는다                          |
| `pip3 install --break-system-packages` | Homebrew Python에 직접 설치 | 비권장    | 오류를 무시한다. brew 패키지와 충돌, 업그레이드 시 패키지 유실                       |
| `sudo pip3 install`                    | -                           | 사용 금지 | root 소유 파일이 생겨 이후 brew·pip 작업에서 권한 오류                               |

오류 메시지도 `--break-system-packages`를 사용한다면 `--user`를 함께 지정하라고 안내한다. 그래도 Python 업그레이드 시 패키지가 유실되는 문제는 남는다.

### venv 사용 방법

```bash
python3 -m venv .venv          # 생성
source .venv/bin/activate      # 활성화 (프롬프트 앞에 (.venv) 표시)
pip install -r requirements.txt
pip freeze > requirements.txt  # 설치 목록 기록
deactivate                     # 비활성화
```

활성화한 venv 안에서는 `python`, `pip`(버전 번호 없는 이름)가 venv의 실행 파일을 가리키고 오류 없이 설치된다.

```text
$ source .venv/bin/activate
$ which python pip
/path/to/project/.venv/bin/python
/path/to/project/.venv/bin/pip
$ pip install --dry-run requests
...
Would install certifi-2026.10.19 charset-normalizer-3.5.2 idna-3.20 requests-2.34.2 urllib3-2.8.0
```

## 시스템 python3와 Homebrew python3

Mac에는 `python3`가 두 개 있을 수 있다.

```text
$ which -a python3
/opt/homebrew/bin/python3
/usr/bin/python3
$ /usr/bin/python3 --version
Python 3.9.6
$ /usr/bin/python3 -m pip --version
pip 21.2.4 from /Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/lib/python3.9/site-packages/pip (python 3.9)
```

| 구분          | `/usr/bin/python3`        | `/opt/homebrew/bin/python3`           |
| ------------- | ------------------------- | ------------------------------------- |
| 제공          | Xcode Command Line Tools  | Homebrew (`brew install python`)      |
| 버전          | 3.9.6 (고정)              | 3.15.0 (`brew upgrade`로 갱신)        |
| pip           | 21.2.4                    | 26.2.2                                |
| PATH 우선순위 | 낮음                      | 높음 (`brew shellenv`가 맨 앞에 추가) |
| 용도          | macOS·개발 도구 내부 사용 | 개발용                                |

CLT가 설치되어 있지 않은 상태에서 `/usr/bin/python3`를 실행하면 Command Line Tools 설치 창이 열린다. `which python3`가 `/usr/bin/python3`를 가리킨다면 Homebrew의 PATH 설정(`brew shellenv`)이 적용되지 않은 상태다.

## `python`, `pip` 명령이 없는 경우

Homebrew Python은 `python3`, `pip3`만 `/opt/homebrew/bin`에 연결한다. 버전 번호 없는 `python`, `pip`는 기본으로 PATH에 없다.

```text
$ which python pip
python not found
pip not found
$ ls /opt/homebrew/opt/python@3.15/libexec/bin
idle  pip  pydoc  python  python-config
```

`brew info python`의 안내대로 버전 번호 없는 링크는 `libexec/bin`에 있다. 다음 중 하나를 선택한다.

- `python3`, `pip3`(또는 `python3 -m pip`)를 사용한다. 가장 간단하다
- venv를 활성화하면 `python`, `pip`가 사용 가능해진다
- 항상 필요하면 `~/.zprofile`의 `brew shellenv` 줄 아래에 `export PATH="/opt/homebrew/opt/python@3/libexec/bin:$PATH"`를 추가한다

`pip3` 대신 `python3 -m pip`를 권장하는 이유는 실행하는 Python과 pip가 항상 일치하기 때문이다. `pip3`는 PATH에서 먼저 발견된 것이 실행되므로 `python3`와 다른 Python의 pip일 수 있다.

## 자주 나는 문제

| 증상                                    | 원인                                        | 해결                                                                 |
| --------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------- |
| `error: externally-managed-environment` | Homebrew Python에 직접 설치 (PEP 668)       | venv 또는 pipx                                                       |
| `zsh: command not found: python`, `pip` | Homebrew는 `python3`, `pip3`만 PATH에 연결  | `python3 -m pip` 사용, venv 활성화, 또는 `libexec/bin`을 PATH에 추가 |
| `python3 --version`이 3.9.6             | `/usr/bin/python3`(CLT)가 사용됨            | `brew shellenv` 설정 확인 (`which -a python3`)                       |
| 설치한 패키지를 `import`하지 못함       | 설치한 pip와 실행한 Python이 다름           | `python3 -m pip`로 설치, venv 활성화 여부 확인                       |
| pipx로 설치한 명령을 찾지 못함          | `~/.local/bin`이 PATH에 없음                | `pipx ensurepath` 실행 후 새 터미널                                  |
| `brew upgrade` 후 venv가 동작하지 않음  | venv가 참조하던 Python 마이너 버전이 삭제됨 | `.venv` 삭제 후 재생성, `pip install -r requirements.txt`            |

## 관련 글

- [Mac에서 Homebrew와 npm 설치하기](/memo/brew-npm-setup)

## 참고한 공식 문서

- [Homebrew and Python](https://docs.brew.sh/Homebrew-and-Python) (Homebrew): `python3`, `pip3`로 설치되며 버전 번호 없는 링크는 `libexec/bin`에 있다. PEP 668에 따라 `pip install`이 제한되며 venv, pipx 사용을 안내한다
- [PEP 668 – Marking Python base environments as "externally managed"](https://peps.python.org/pep-0668/) (Python): `EXTERNALLY-MANAGED` 파일, 패키지 관리자와 pip의 충돌을 막는 목적, `--break-system-packages`
- [venv — Creation of virtual environments](https://docs.python.org/3/library/venv.html) (Python): 가상 환경 생성과 활성화
- [Installing stand alone command line tools](https://packaging.python.org/en/latest/guides/installing-stand-alone-command-line-tools/) (Python Packaging User Guide): pipx로 명령줄 도구를 격리된 환경에 설치
