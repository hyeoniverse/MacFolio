**한국어** | [English](#english)

# 보안 정책

## 지원 범위

| 대상                                                                                                          | 지원          |
| ------------------------------------------------------------------------------------------------------------- | ------------- |
| 배포 중인 사이트 [macfolio.hyeoniverse.com](https://macfolio.hyeoniverse.com)과 API (main 브랜치의 최신 커밋) | 지원          |
| main의 이전 커밋, 다른 브랜치, 저장소를 복제해 따로 배포한 사이트                                             | 지원하지 않음 |

main에 머지된 커밋은 CI를 거쳐 바로 배포된다([배포 문서](docs/deployment.md)). 수정은 main에만 반영하고 이전 버전에는 별도 패치를 만들지 않는다.

## 취약점 제보

**공개 이슈·토론·PR에 취약점 내용을 올리지 않는다.** 수정 전에 공개되면 배포 중인 사이트가 그대로 노출된다.

저장소의 **Security** 탭 › **Report a vulnerability**에서 비공개로 제보한다([GitHub Docs: 비공개 취약점 제보](https://docs.github.com/ko/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). 제보에는 다음을 적는다.

- 영향받는 주소·API 경로·파일
- 재현 순서 (요청 예시, 필요한 권한 상태)
- 예상되는 영향 (읽을 수 있는 데이터, 실행할 수 있는 동작)

개인이 운영하는 프로젝트라 처리 시각을 보장하지 않는다. 목표는 다음과 같다.

| 단계                    | 목표                                                  |
| ----------------------- | ----------------------------------------------------- |
| 접수 확인               | 7일 이내                                              |
| 재현·판정 결과 회신     | 14일 이내                                             |
| 수정 배포 (확인된 경우) | 심각도에 따라 가능한 한 빨리, 배포 뒤 제보자에게 알림 |

수정이 배포된 뒤 GitHub Security Advisory로 공개하고, 원하면 제보자를 기록한다.

## 범위 밖

- 대량 요청으로 서비스를 멈추는 시험(DoS·부하 시험). 무료 등급 서버(Oracle Cloud Always Free)라 다른 방문자에게 영향이 간다
- 소셜 엔지니어링, 피싱, 물리적 접근
- 제3자 서비스 자체의 취약점: Cloudflare(Workers·Tunnel·Turnstile·R2), GitHub OAuth, Oracle Cloud, Google Search Console, Open-Meteo 등. 해당 서비스에 직접 제보한다
- 실제 영향이 없는 보고: 보안 헤더 하나의 누락만 지적하는 보고, 로그인 없이 볼 수 있도록 공개한 정보

## 보안 설계 요약

| 항목             | 구현                                                                                                                                                                                                                                  | 코드·문서                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 관리자 인증      | GitHub OAuth, 단일 관리자. 관리자 경로마다 `AdminGuard`가 세션 쿠키를 DB와 대조                                                                                                                                                       | `apps/api/src/auth/admin.guard.ts`                                                                      |
| 세션 토큰        | 원문은 httpOnly 쿠키에만 두고 DB에는 SHA-256 해시만 보관                                                                                                                                                                              | `apps/api/src/auth/session.ts`                                                                          |
| 방문자·IP        | 방문자 토큰과 IP는 비밀 키를 쓴 HMAC-SHA256으로만 보관                                                                                                                                                                                | `apps/api/src/visitors/visitor.ts`, `apps/api/src/analytics/rules.ts`, [개인정보 문서](docs/privacy.md) |
| 쓰기 요청 제한   | 쓰기 경로마다 `@RateLimit`, 댓글·메시지·메일은 Cloudflare Turnstile로 사람 확인                                                                                                                                                       | `apps/api/src/common/rate-limit.ts`, `apps/api/src/common/turnstile.ts`                                 |
| 입력 검증        | zod 스키마와 전역 `ValidationPipe`(정의하지 않은 필드 거부)                                                                                                                                                                           | `packages/contracts`, `apps/api/src/app.setup.ts`                                                       |
| 사이트 응답 헤더 | Cloudflare Worker가 CSP 등 보안 헤더를 붙인다. CSP 출처 목록은 빌드 설정에서 생성                                                                                                                                                     | `apps/react/worker/securityHeaders.ts`                                                                  |
| 글 렌더링        | 위험한 링크(`javascript:` 등)와 스크립트가 되는 HTML을 차단하고 E2E로 고정                                                                                                                                                            | `apps/react/e2e/markdown-safety.spec.ts`                                                                |
| 의존성 취약점    | CI의 `pnpm audit --prod --audit-level=high`가 high 이상이면 머지를 막고, 하위 의존성은 `overrides`로 수정판 적용 ([#371](https://github.com/hyeoniverse/MacFolio/pull/371), [#374](https://github.com/hyeoniverse/MacFolio/pull/374)) | `.github/workflows/ci.yml`, `pnpm-workspace.yaml`                                                       |
| 비밀 값 유출     | PR, main push, 매주 정기 실행에서 gitleaks로 커밋 내용을 검사                                                                                                                                                                         | `.github/workflows/secrets.yml`, `.gitleaks.toml`                                                       |
| 정적 분석        | Semgrep·pnpm audit 점검 결과와 항목별 판정                                                                                                                                                                                            | [보안 점검 문서](docs/security-scan.md)                                                                 |

---

## English

**Supported:** the deployed site [macfolio.hyeoniverse.com](https://macfolio.hyeoniverse.com) and its API at the latest commit on `main`. Older commits, other branches and self-hosted copies are not supported.

**Reporting:** do not open public issues, discussions or pull requests for vulnerabilities. Use **Security › Report a vulnerability** in this repository ([GitHub Docs](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)). Include the affected URL, API path or file, steps to reproduce and the expected impact.

**Response targets:** this is a personal project, so timelines are targets, not guarantees: acknowledgement within 7 days, a triage result within 14 days, and a fix deployed as soon as practical for confirmed issues. A GitHub Security Advisory is published after the fix.

**Out of scope:** denial-of-service or load testing (the server runs on a free tier and other visitors would be affected), social engineering, phishing, physical access, vulnerabilities in third-party services (Cloudflare, GitHub OAuth, Oracle Cloud, Google Search Console, Open-Meteo), and reports without a demonstrable impact.

The security design summary above lists where each control is implemented.
