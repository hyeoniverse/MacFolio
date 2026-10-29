---
title: 보안 점검 10 - gitleaks 사용자 규칙과 CI 작업으로 저장소 기록 전체의 비밀 값 검사하기
date: 2026-10-10
category: 개발 기록/MacFolio/품질
summary: 저장소 기록 전체를 gitleaks로 검사한 결과 검출된 항목은 Oracle 문서의 시험용 개인 키 4건뿐이었다. 기본 규칙이 검출하지 못하는 Resend·Groq 키와 DB 비밀번호 규칙을 추가하고, PR·main·매주 월요일마다 기록 전체를 다시 검사하는 CI 작업을 만들었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "비밀 값 스캔(gitleaks 또는 GitHub secret scanning) 켜기"를 처리한 기록이다([#170](https://github.com/hyeoniverse/MacFolio/pull/170)).

## 기록 전체를 검사하는 이유

`.env`는 `.gitignore`에 포함되어 있고 키는 서버와 GitHub Secrets에만 저장한다. 그래도 위험은 남는다. 시험 코드에 실제 키를 일시적으로 넣었다가 삭제하면, 현재 파일에서는 사라져도 커밋 기록에는 남는다. 공개 저장소이므로 `git log -p`로 누구나 조회할 수 있다. 따라서 현재 파일뿐 아니라 기록 전체에 비밀 값이 포함된 적이 있는지 검사해야 한다.

## 검토한 방법

| 방법                                                              | 장점                                               | 단점                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| GitHub Secret Protection만 활성화                                 | 설정 한 번, push 시각에 차단한다                   | 알려진 서비스의 키만 검사한다. Resend·Groq 키와 DB 비밀번호는 검사하지 않는다 |
| `gitleaks-action` 사용                                            | 워크플로 몇 줄                                     | 조직 저장소는 라이선스 키가 필요하고, 내려받는 바이너리를 직접 고정할 수 없다 |
| pre-commit 훅으로 커밋 전에 차단                                  | 커밋 이전에 차단한다                               | 설치한 컴퓨터에만 적용된다. 훅을 건너뛴 커밋, 웹에서 수정한 커밋은 통과한다   |
| 바이너리를 고정해 CI에서 기록 전체 검사 (선택) + GitHub 기능 병행 | 모든 커밋에 같은 규칙, 프로젝트 전용 규칙까지 적용 | CI가 약 15초 늘고, 저장소 설정은 수동으로 활성화한다                          |

pre-commit 훅은 도입하지 않았다. PR과 main에서 같은 검사가 실행되고, 훅은 설치한 컴퓨터에서만 동작하기 때문이다.

<details>
<summary>용어 정리</summary>

- **gitleaks**: 커밋 내용을 정규식 수백 개(GitHub 토큰 `ghp_…`, AWS 키 `AKIA…`, `-----BEGIN PRIVATE KEY-----`, `postgres://user:pass@` 등)로 검사하는 도구. `gitleaks git`은 기록 전체, `gitleaks dir`은 현재 파일을 검사한다
- **GitHub secret scanning**: GitHub이 저장소의 커밋을 자체 규칙으로 검사하고, 알려진 서비스의 키이면 해당 서비스에 통보해 폐기하게 하는 기능. **push protection**은 그런 키가 포함된 push 자체를 차단한다. 공개 저장소는 무료
- **`--redact`**: 검출한 값을 로그에 그대로 출력하지 않고 `REDACTED`로 치환하는 옵션. CI 로그는 공개이므로 스캐너가 비밀 값을 출력하면 그 자체가 다시 유출이다

</details>

## 최초 전체 검사

| 검출 항목                                                           | 판단                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `oci.test.ts`, `resources.e2e.test.ts`의 RSA 개인 키 4건 (커밋 2개) | Oracle 문서 "Request Signatures"에 공개된 시험용 키. 비밀이 아니다 |

이 두 파일만 `.gitleaks.toml`에 예외로 등록했다. 예외는 "이 규칙(`private-key`)을 이 두 파일에서만" 형태로 범위를 좁게 지정한다. 파일 전체나 규칙 전체를 제외하면 이후 실제 비밀 값이 들어와도 검출하지 못한다.

## 기본 규칙이 검출하지 못하는 값

예외를 등록한 뒤, 가짜 값을 넣은 파일로 설정을 시험했다. 무작위 GitHub 토큰(`ghp_…`)은 검출되었지만 **Resend 키(`re_…`), Groq 키(`gsk_…`), 비밀번호가 포함된 DB 주소는 검출되지 않았다.** 기본 규칙 수백 개는 널리 쓰이는 서비스 중심이라, 이 프로젝트가 실제로 사용하는 키 형식이 빠져 있었다. 규칙 3개를 직접 추가했다.

| 규칙                      | 형식                                          |
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

처음에는 반복 문자열(`A1b2A1b2…`)로 시험해 GitHub 토큰조차 검출되지 않았다. gitleaks는 정규식에 일치해도 **엔트로피**(문자열의 무작위성)[^entropy]가 낮으면 통과시킨다. `aaaa…` 같은 플레이스홀더를 비밀 값으로 오탐하지 않기 위해서다. 무작위 값으로 다시 시험해야 했다.

| 시험 값           | 서로 다른 문자 수 | 섀넌 엔트로피(문자당) | Resend 규칙 기준 3.0 |
| ----------------- | ----------------- | --------------------- | -------------------- |
| `A1b2` × 6 (24자) | 4                 | 2.0비트               | 미달 → 통과          |
| 무작위 24자       | (무작위)          | 약 4.6비트            | 초과 → 검출          |

비밀번호 규칙의 기준을 2.5로 낮게 지정한 것은 사람이 정한 비밀번호가 짧고 무작위성이 낮기 때문이다.

![gitleaks가 한 줄을 검출하기까지 거치는 세 단계](./images/secret-scanning-gates.svg '정규식, 엔트로피, 예외 목록을 모두 통과해야 검출된다')

DB 주소 규칙은 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 가짜 비밀번호(`s3cret`)를 검출해, 그 줄만 예외로 등록했다. 예외는 비밀번호 부분이 아니라 **줄 전체**를 대상으로 비교하게 해야 했다(`regexTarget = "line"`). 기본값은 검출된 값 자체만 비교하므로 `://macfolio:macfolio@` 조건이 `macfolio`에만 적용되어 예외가 동작하지 않았다.

## CI 작업 `secrets`

PR과 main push마다, 그리고 매주 월요일에 실행된다. 월요일에도 실행하는 이유는 gitleaks 규칙이 추가되면 기존 커밋에서 새로 검출되는 항목이 생길 수 있기 때문이다.

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

권한은 `contents: read`뿐이고, 같은 브랜치에서 새 실행이 시작되면 이전 실행을 취소한다. 바이너리는 버전(8.30.1)과 SHA-256 체크섬을 지정해 내려받는다. 액션(`gitleaks/gitleaks-action`)을 사용하지 않은 이유는 조직 저장소에 라이선스가 필요하고, 내려받는 바이너리를 직접 고정하는 방식이 이전 글([보안 점검 9 - GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/pin-actions-dependabot))과 같은 기준이기 때문이다. `fetch-depth: 0`으로 기록 전체를 내려받아 검사하고, 검출되면 실패한다. 커밋 791개·392MB 검사에 약 15초가 걸린다.

## 저장소 설정에서 활성화할 항목

코드로 처리할 수 있는 범위는 여기까지이고, 다음 두 항목은 저장소 설정이다.

1. Settings → Advanced Security(이전 이름 Code security)에서 **Secret Protection**(이전 이름 Secret scanning)과 그 아래 **Push protection**, 그리고 **Dependabot security updates** 활성화
2. main의 Ruleset에 `secrets`를 필수 검사로 추가

버튼 위치와 순서는 CONTRIBUTING.md의 '저장소 설정 › 비밀 값·의존성'에 기록했다. GitHub의 스캐너와 gitleaks는 검사 범위가 다르다. GitHub은 등록된 서비스의 키만, gitleaks는 `.gitleaks.toml`에 정의한 이 프로젝트의 키(Resend·Groq, DB 비밀번호)까지 검사한다. 그래서 둘 다 활성화한다.

![GitHub Secret Protection과 gitleaks가 보는 범위 비교](./images/secret-scanning-coverage.svg 'GitHub은 알려진 서비스의 키를 push 시각에, gitleaks는 이 프로젝트의 키 형식까지 기록 전체에서 검사한다')

## 확인

- 최초 검사: 검출 항목은 시험용 RSA 키 4건(커밋 2개)뿐. 예외 등록 후 0건.
- 규칙 시험: 무작위 `ghp_…`, `re_…`, `gsk_…`, 비밀번호가 포함된 DB 주소를 넣은 임시 파일에서 모두 검출되고, 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 `s3cret`은 검출되지 않는 것을 확인했다.
- CI: 커밋 791개·392MB를 약 15초에 검사한다. 이후 커밋이 늘어 현재 main 기록은 커밋 1,192개다.

## 검출 시 대응

기록에서 값을 삭제하는 것(`git filter-repo`)은 이미 공개된 뒤라 효과가 제한적이다. 대응 순서는 다음과 같다.

1. 해당 키를 서비스에서 먼저 폐기하고 새로 발급한다
2. 서버의 `~/deploy/api.env`나 GitHub Secrets의 값을 교체한다
3. 시험용 가짜 값이었다면 `.gitleaks.toml`에 규칙과 파일 범위를 좁혀 예외로 등록한다

## 저장소 설정 활성화 과정

코드 변경을 머지한 뒤 남은 두 항목(비밀 값 검사 활성화, `secrets`를 필수 검사로 지정)의 적용 여부를 다시 확인했고, 설정 방법을 문서와 PR에 기록했다. 설정 화면의 항목 이름은 문서에 기록한 이름과 달랐다. "Secret scanning"이 아니라 **Secret Protection**이었고, 이미 활성화되어 있었다. 문서에 기록한 Push protection의 "Block commits that contain supported secrets" 문구는 화면에서 찾지 못했다. 그래서 문서에 이전 이름과 현재 이름을 함께 기록했다.

## 적용 방법

```bash
# 내 컴퓨터에서 기록 전체를 훑기 (CI와 같은 명령)
gitleaks git --redact --verbose --exit-code 1 .
```

설정 순서는 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '저장소 설정 › 비밀 값·의존성', CI는 [.github/workflows/secrets.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/secrets.yml), 규칙은 [.gitleaks.toml](https://github.com/hyeoniverse/MacFolio/blob/main/.gitleaks.toml)에 있다. 검출되면 먼저 해당 키를 서비스에서 폐기하고 새로 발급한다. 기록에서 삭제하는 것만으로는 이미 복제된 저장소에 남는다.

참고 문서: [gitleaks](https://github.com/gitleaks/gitleaks), [GitHub Secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning), [Push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection).

## 남은 과제와 정리

- **기본 규칙은 널리 쓰이는 서비스 중심이다.** 이 프로젝트가 실제로 사용하는 키 형식은 직접 정의해야 했다. 새 서비스를 연동하면 규칙도 함께 추가한다.
- **시험 값도 무작위로 생성한다.** 반복 문자열로 시험하면 엔트로피가 낮아 "검출되지 않는다"는 잘못된 결론이 나온다.
- **예외 범위는 좁게 지정한다.** 규칙 하나, 파일 두 개처럼 좁게 지정해야 같은 파일에 실제 키가 들어와도 다른 규칙이 검출한다.

## 관련 글

- [보안 점검 9 - GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/pin-actions-dependabot)
- [보안 점검 12 - Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan)
- [리팩터링 7단계 - CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-step7-security)
- [보안 점검 8 - 모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking)
- [부트 볼륨을 임시 VM에 연결해 authorized_keys를 고치는 SSH 키 복구](/memo/oracle-ssh-key-recovery)

[^entropy]: 섀넌 엔트로피. 문자열에 나타나는 각 문자의 빈도로 계산하는 무작위성 지표로, 같은 문자가 반복될수록 낮아진다. gitleaks는 규칙의 `entropy` 값보다 낮은 일치 항목을 검출에서 제외한다. [gitleaks README](https://github.com/gitleaks/gitleaks#configuration)

#MacFolio #보안 #CI #gitleaks
