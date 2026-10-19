---
title: 커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 저장소 기록 전체를 gitleaks로 훑으니 걸린 것은 Oracle 문서의 시험용 개인 키 4건뿐이었다. 기본 규칙이 놓치는 Resend·Groq 키와 DB 비밀번호 규칙을 더하고, PR·main·월요일마다 기록 전체를 다시 훑는 CI 작업을 만들었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "비밀 값 스캔(gitleaks 또는 GitHub secret scanning) 켜기".

## 왜 기록인가

`.env`는 `.gitignore`에 있고 키는 서버와 GitHub Secrets에만 있다. 그래도 걱정은 남는다. 시험 코드에 진짜 키를 잠깐 넣었다가 지우면, 파일에서는 사라져도 커밋 기록에는 남는다. 저장소가 공개이니 `git log -p`로 누구나 볼 수 있다. 그래서 "지금 파일에 비밀 값이 있는가"가 아니라 "기록 어딘가에 들어온 적이 있는가"를 봐야 한다.

## 고른 방법과 버린 방법

| 방법                                                         | 좋은 점                                         | 걸린 점                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------- |
| GitHub Secret Protection만 켜기                              | 설정 한 번, push 때 막는다                      | 알려진 서비스의 키만 본다. Resend·Groq 키와 DB 비밀번호는 보지 않는다     |
| `gitleaks-action` 쓰기                                       | 워크플로 몇 줄                                  | 조직 저장소는 라이선스 키가 필요하고, 받는 바이너리를 내가 고정할 수 없다 |
| pre-commit 훅으로 커밋 전에 막기                             | 커밋되기 전에 막는다                            | 내 컴퓨터에만 걸린다. 훅을 건너뛴 커밋, 웹에서 고친 커밋은 지나간다       |
| 바이너리를 고정해 CI에서 기록 전체 (고름) + GitHub 기능 함께 | 모든 커밋을 같은 규칙으로, 이 프로젝트 규칙까지 | CI가 15초쯤 늘고, 저장소 설정은 손으로 켠다                               |

pre-commit 훅은 두지 않았다. PR과 main에서 같은 검사가 돌고, 훅은 그 컴퓨터에서만 걸리기 때문이다.

## 용어

- **gitleaks**: 커밋 내용을 정규식 수백 개(GitHub 토큰 `ghp_…`, AWS 키 `AKIA…`, `-----BEGIN PRIVATE KEY-----`, `postgres://user:pass@` 등)로 훑는 도구. `gitleaks git`은 기록 전체, `gitleaks dir`은 지금 파일을 본다
- **GitHub secret scanning**: GitHub이 저장소에 올라온 커밋을 자기 규칙으로 훑고, 알려진 서비스의 키면 그 서비스에도 알려 폐기하게 하는 기능. **push protection**은 그런 키가 든 push를 아예 막는다. 공개 저장소는 무료
- **`--redact`**: 걸린 값을 로그에 그대로 찍지 않고 `REDACTED`로 바꾸는 옵션. CI 로그는 공개이니 스캐너가 비밀 값을 찍으면 그것이 또 유출이다

## 먼저 전체를 훑었다

| 걸린 것                                                            | 판단                                                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `oci.test.ts`, `resources.e2e.test.ts`의 RSA 개인 키 4건 (두 커밋) | Oracle 문서 "Request Signatures"에 실린 시험용 키. 비밀이 아니다 |

이 둘만 `.gitleaks.toml`에 예외로 적었다. 예외는 "이 규칙(`private-key`)을 이 두 파일에서만" 식으로 좁게 둔다. 파일 전체나 규칙 전체를 빼면 다음에 진짜가 들어와도 못 잡는다.

## 기본 규칙이 못 잡는 것

예외를 적은 뒤, 가짜 값을 넣은 파일로 설정을 시험했다. 무작위 GitHub 토큰(`ghp_…`)은 걸렸지만 **Resend 키(`re_…`), Groq 키(`gsk_…`), 비밀번호가 든 DB 주소는 걸리지 않았다.** 기본 규칙 수백 개는 유명한 서비스 위주라, 이 프로젝트가 실제로 쓰는 키 모양이 빠져 있었다. 세 규칙을 직접 더했다.

| 규칙                      | 모양                                          |
| ------------------------- | --------------------------------------------- |
| `macfolio-resend-api-key` | `re_` + 영숫자 20자 이상                      |
| `macfolio-groq-api-key`   | `gsk_` + 영숫자 20자 이상                     |
| `macfolio-url-password`   | `scheme://user:password@host`의 password 부분 |

```toml
# .gitleaks.toml
[[rules]]
id = "macfolio-resend-api-key"
description = "Resend API 키 (re_…)"
regex = '''\bre_[A-Za-z0-9]{20,}\b'''
entropy = 3.0

[[rules]]
id = "macfolio-url-password"
regex = '''\b[a-z][a-z0-9+.-]*://[^\s:/@"']+:([^\s@/"']{6,})@'''
secretGroup = 1
entropy = 2.5
```

처음에는 반복 글자(`A1b2A1b2…`)로 시험해서 GitHub 토큰조차 걸리지 않았다. gitleaks는 정규식에 맞아도 **엔트로피**(글자가 얼마나 무작위인지)가 낮으면 넘긴다. `aaaa…` 같은 자리 표시를 비밀로 오인하지 않기 위해서다. 무작위 값으로 다시 시험해야 했다.

직접 계산해 보면 차이가 분명하다. `A1b2`를 여섯 번 되풀이한 24글자는 글자가 넷뿐이라 섀넌 엔트로피가 2.0비트다. Resend 규칙의 기준 3.0에 못 미친다. 무작위로 고른 24글자는 4.6비트쯤 나온다. 비밀번호 규칙의 기준을 2.5로 낮게 둔 것은 사람이 정한 비밀번호가 짧고 덜 무작위이기 때문이다.

![gitleaks가 한 줄을 걸기까지 거치는 세 관문](./images/secret-scanning-gates.svg '정규식, 엔트로피, 예외 목록을 모두 지나야 걸린다')

DB 주소 규칙은 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 가짜 비밀번호(`s3cret`)에 걸려서, 그 줄들만 예외로 뒀다. 예외를 비밀번호 부분이 아니라 **줄 전체**로 보게 해야 했다(`regexTarget = "line"`). 기본은 걸린 값 자체만 보기 때문에 `://macfolio:macfolio@`라는 조건이 `macfolio`에만 맞춰져 빠져나가지 못했다.

## CI 작업 `secrets`

PR과 main push마다, 그리고 월요일마다 돈다. 월요일에도 도는 것은 gitleaks 규칙이 늘면 예전 커밋에서 새로 걸리는 것이 있을 수 있어서다.

```yaml
# .github/workflows/secrets.yml
- name: gitleaks 받기 (버전과 체크섬 고정)
  env:
    VERSION: 8.30.1
    SHA256: 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
  run: |
    curl -fsSL -o gitleaks.tgz "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz"
    echo "${SHA256}  gitleaks.tgz" | sha256sum -c -
    tar xzf gitleaks.tgz gitleaks

- name: 기록 전체 훑기
  run: ./gitleaks git --redact --verbose --exit-code 1 .
```

권한은 `contents: read`뿐이고, 같은 브랜치에서 새 실행이 오면 이전 실행을 취소한다. 바이너리는 버전(8.30.1)과 SHA-256 체크섬을 적어 받는다. 액션(`gitleaks/gitleaks-action`)을 쓰지 않은 것은 조직 저장소는 라이선스가 필요하고, 받는 바이너리를 직접 고정하는 쪽이 지난 글([액션은 커밋으로 고정하고](/memo/pin-actions-dependabot))과 같은 기준이라서다. `fetch-depth: 0`으로 기록 전체를 받아 훑고, 걸리면 실패한다. 791커밋·392MB를 훑는 데 15초쯤 걸린다.

## 설정에서 켤 것

코드로 할 수 있는 것은 여기까지고, 둘은 저장소 설정이다.

1. Settings → Advanced Security(예전 이름 Code security)에서 **Secret Protection**(예전 이름 Secret scanning)과 그 아래 **Push protection**, 그리고 **Dependabot security updates** 켜기
2. main의 Ruleset에 `secrets`를 필수 검사로 더하기

버튼 위치와 순서는 CONTRIBUTING.md의 '저장소 설정 › 비밀 값·의존성'에 적어 두었다. GitHub의 스캐너와 gitleaks는 보는 범위가 다르다. GitHub은 자기가 아는 서비스의 키만, gitleaks는 `.gitleaks.toml`에 적은 이 프로젝트의 키(Resend·Groq, DB 비밀번호)까지 본다. 그래서 둘 다 켠다.

![GitHub Secret Protection과 gitleaks가 보는 범위 비교](./images/secret-scanning-coverage.svg 'GitHub은 알려진 서비스의 키를 push 때, gitleaks는 이 프로젝트의 키 모양까지 기록 전체에서')

## 확인

- 처음 훑기: 걸린 것은 시험용 RSA 키 4건(두 커밋)뿐. 예외를 적은 뒤 0건.
- 규칙 시험: 무작위 `ghp_…`, `re_…`, `gsk_…`, 비밀번호가 든 DB 주소를 넣은 임시 파일로 모두 걸리는 것, 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 `s3cret`은 걸리지 않는 것을 확인했다.
- CI: 791커밋·392MB를 15초쯤에 훑는다. 그 뒤 커밋이 늘어 지금 main 기록은 1,192커밋이다.

## 걸리면 어떻게 하나

기록에서 값을 지우는 것(`git filter-repo`)은 이미 공개된 뒤라 의미가 적다. 순서는 이렇다.

1. 그 키를 서비스에서 먼저 폐기하고 새로 만든다
2. 서버의 `~/deploy/api.env`나 GitHub Secrets의 값을 바꾼다
3. 시험용 가짜 값이었다면 `.gitleaks.toml`에 규칙과 파일을 좁혀 예외로 적는다

## 저장소 설정을 실제로 켠 과정

코드 쪽을 머지한 뒤 남은 두 가지(비밀 값 검사 켜기, `secrets`를 필수 검사로)를 했는지 다시 확인했고, 하는 방법을 문서와 PR에 남기게 했다. 설정 화면에 들어가 보니 안내와 이름이 달랐다. "Secret scanning"이 아니라 **Secret Protection**이라는 이름이었고, 이미 켜져 있었다. 안내에 있던 Push protection의 "Block commits that contain supported secrets" 문구는 화면에서 찾지 못했다. 그래서 문서에 예전 이름과 지금 이름을 함께 적었다.

## 따라 하는 방법

```bash
# 내 컴퓨터에서 기록 전체를 훑기 (CI와 같은 명령)
gitleaks git --redact --verbose --exit-code 1 .
```

설정 순서는 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '저장소 설정 › 비밀 값·의존성', CI는 [.github/workflows/secrets.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/secrets.yml), 규칙은 [.gitleaks.toml](https://github.com/hyeoniverse/MacFolio/blob/main/.gitleaks.toml). 걸리면 먼저 그 키를 서비스에서 폐기하고 새로 만든다. 기록에서 지우는 것만으로는 이미 복제된 저장소에 남는다.

참고 문서: [gitleaks](https://github.com/gitleaks/gitleaks), [GitHub Secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning), [Push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection).

## 남은 것과 배운 것

- **기본 규칙은 유명한 서비스 위주다.** 이 프로젝트가 실제로 쓰는 키 모양은 직접 적어야 했다. 새 서비스를 붙이면 규칙도 함께 더한다.
- **시험 값도 무작위로.** 반복 글자로 시험하면 엔트로피 때문에 "안 걸린다"는 잘못된 결론이 나온다.
- **예외는 좁게.** 규칙 하나, 파일 둘처럼 좁게 두어야 같은 파일에 진짜 키가 들어와도 다른 규칙이 잡는다.

관련 글: [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot) · [Semgrep과 SCA 도구로 MacFolio 점검하기](/memo/security-scan) · [리팩터링 7단계 — 보안](/memo/refactor-step7-security). PR: [#170](https://github.com/hyeoniverse/MacFolio/pull/170).

#MacFolio #보안 #CI #gitleaks
