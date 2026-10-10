---
title: 커밋에 비밀 값이 섞이지 않았는지 기록 전체를 훑기
date: 2026-10-10
category: 인프라/배포·운영
summary: 저장소 791커밋을 gitleaks로 훑으니 걸린 것은 Oracle 문서의 시험용 개인 키 4건뿐이었다. 그 예외만 적어 두고, PR과 main마다 기록 전체를 다시 훑는 CI 작업을 더했다. 한 번 커밋했다 지운 값도 기록에 남으므로 "지금 파일"이 아니라 "기록"을 본다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 "비밀 값 스캔(gitleaks 또는 GitHub secret scanning) 켜기".

## 왜 기록인가

`.env`는 `.gitignore`에 있고 키는 서버와 GitHub Secrets에만 있다. 그래도 걱정은 남는다. 시험 코드에 진짜 키를 잠깐 넣었다가 지우면, 파일에서는 사라져도 커밋 기록에는 남는다. 저장소가 공개이니 `git log -p`로 누구나 볼 수 있다. 그래서 "지금 파일에 비밀 값이 있는가"가 아니라 "기록 어딘가에 들어온 적이 있는가"를 봐야 한다.

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

처음에는 반복 글자(`A1b2A1b2…`)로 시험해서 GitHub 토큰조차 걸리지 않았다. gitleaks는 정규식에 맞아도 **엔트로피**(글자가 얼마나 무작위인지)가 낮으면 넘긴다. `aaaa…` 같은 자리 표시를 비밀로 오인하지 않기 위해서다. 무작위 값으로 다시 시험해야 했다.

DB 주소 규칙은 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 가짜 비밀번호(`s3cret`)에 걸려서, 그 줄들만 예외로 뒀다. 예외를 비밀번호 부분이 아니라 **줄 전체**로 보게 해야 했다(`regexTarget = "line"`). 기본은 걸린 값 자체만 보기 때문에 `://macfolio:macfolio@`라는 조건이 `macfolio`에만 맞춰져 빠져나가지 못했다.

## CI 작업 `secrets`

PR과 main push마다, 그리고 월요일마다 돈다. 바이너리는 버전(8.30.1)과 SHA-256 체크섬을 적어 받는다. 액션(`gitleaks/gitleaks-action`)을 쓰지 않은 것은 조직 저장소는 라이선스가 필요하고, 받는 바이너리를 직접 고정하는 쪽이 지난 글([액션은 커밋으로 고정하고](/memo/pin-actions-dependabot))과 같은 기준이라서다. `fetch-depth: 0`으로 기록 전체를 받아 훑고, 걸리면 실패한다. 791커밋·392MB를 훑는 데 15초쯤 걸린다.

## 설정에서 켤 것

코드로 할 수 있는 것은 여기까지고, 둘은 저장소 설정이다.

1. Settings → Code security → **Secret scanning**과 **Push protection** 켜기
2. main의 Ruleset에 `secrets`를 필수 검사로 더하기 (CONTRIBUTING.md의 '저장소 설정')

#MacFolio #보안 #CI #gitleaks
