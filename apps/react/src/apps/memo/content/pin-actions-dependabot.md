---
title: GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기
date: 2026-10-10
category: 개발 기록/MacFolio/품질
series: 보안 점검
seriesOrder: 9
summary: 다른 커밋으로 옮길 수 있는 태그(@v7) 대신 액션 9종을 커밋 SHA로 고정하고, 토큰 권한을 축소하고, 새 버전은 Dependabot이 PR로 제안하게 했다. 이후 열흘 동안 Dependabot PR 10개를 병합했고, 규칙 검사의 예외 조건도 한 번 수정했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))에는 보안 항목이 두 가지 있었다. 하나는 "GitHub Actions를 태그 대신 커밋 SHA로 고정하고 `permissions`를 최소로", 다른 하나는 "Dependabot으로 업데이트 수신"이다. 버전을 고정하면 업데이트 작업이 생기고, 그 작업을 Dependabot이 담당하므로 두 항목을 같은 커밋(`24c1c47ce`, [#169](https://github.com/hyeoniverse/MacFolio/pull/169))에서 처리했다.

## 태그는 다른 커밋으로 옮길 수 있다

워크플로에 `uses: actions/checkout@v7`이라고 적으면 GitHub은 실행할 때마다 `v7` **태그**가 가리키는 커밋을 내려받아 실행한다. 태그는 브랜치처럼 다른 커밋으로 옮길 수 있다. 액션 저장소가 새 버전을 배포하면 `v7`을 새 커밋으로 옮기고, 그 저장소의 쓰기 권한을 탈취한 사람도 임의의 커밋으로 옮길 수 있다. 2025년 3월 `tj-actions/changed-files`의 태그가 악성 커밋으로 변경되어, 그 액션을 사용하는 수천 개 저장소의 CI가 비밀 값을 로그에 출력했다([CVE-2025-30066](https://github.com/advisories/GHSA-mrrh-fwg8-r2c3)). 이 저장소의 CI에는 Cloudflare 토큰과 서버 배포 키가 있다.

![태그와 커밋 SHA로 액션을 적었을 때의 차이](./images/pin-actions-dependabot-sha.svg '태그는 옮길 수 있지만 커밋 해시는 항상 같은 코드를 가리킨다')

## 검토한 방법

| 방법                                        | 장점                                                               | 단점                                                 |
| ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| 태그 유지 (`@v7`)                           | 새 버전이 자동으로 적용된다                                        | 태그를 옮기면 다른 코드가 실행된다                   |
| SHA로 고정하고 수동으로 업데이트            | 실행 코드가 고정된다                                               | 업데이트가 누락되기 쉽다. 9종을 매번 조회해야 한다   |
| SHA로 고정하고 Dependabot이 업데이트 (선택) | 실행 코드가 고정되고, 업데이트 PR이 자동 생성된다. CI 통과 후 병합 | 매주 PR이 생성된다. 브랜치 이름이 규칙과 맞지 않는다 |

Renovate처럼 설정 항목이 더 많은 봇도 있지만, GitHub에 내장되어 설정 파일 하나로 동작하는 Dependabot으로 충분했다.

<details>
<summary>용어 정리</summary>

- **커밋 SHA 고정**: `uses: actions/checkout@3d3c42e5…`처럼 40자리 커밋 해시로 지정하는 방식. 해시는 내용에서 계산되므로 같은 해시는 항상 같은 코드다. 뒤에 `# v7.0.1`을 주석으로 붙여 버전을 표시한다
- **`permissions`**: 워크플로에 발급되는 `GITHUB_TOKEN`의 권한([GitHub 문서: Controlling permissions for GITHUB_TOKEN](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token)). 지정하지 않으면 저장소 설정의 기본값(쓰기 권한일 수 있다)이 적용된다. `contents: read`이면 코드 읽기만, `{}`이면 권한이 없다
- **Dependabot**: GitHub이 운영하는 봇. 설정 파일(`.github/dependabot.yml`)에 따라 의존성의 새 버전을 조회해 PR을 생성한다. 취약점이 알려진 패키지는 일정과 관계없이 즉시 PR을 생성한다(저장소 설정의 "Dependabot security updates")
- **그룹**: Dependabot PR을 묶는 설정. 묶지 않으면 패키지마다 PR이 하나씩 생성되어 매주 월요일 10개 이상이 쌓인다

</details>

## 변경 내용

| 파일                     | 변경 전              | 변경 후                                          |
| ------------------------ | -------------------- | ------------------------------------------------ |
| `ci.yml` 액션 17곳       | `@v7`, `@v6`, `@v3`… | 커밋 SHA + `# v7.0.1` 주석 (9종)                 |
| `conventions.yml`        | `permissions` 없음   | `contents: read`                                 |
| `uptime.yml`             | `permissions` 없음   | `{}` (curl만 하므로 토큰이 필요 없다)            |
| `.github/dependabot.yml` | 없음                 | npm·github-actions·docker, 월요일 아침, 그룹으로 |

`ci.yml`과 `deploy-api.yml`은 이미 상단에 `contents: read`를 지정하고, 이미지 업로드(`packages: write`)·PR 댓글(`pull-requests: write`) 권한만 작업 단위로 추가하고 있었다.

SHA는 `git ls-remote --tags`로 태그가 가리키는 커밋을 조회해 기록했다. `pnpm/action-setup@v6`는 `v6` 태그가 v6.0.10을 가리키고 v6.1.0이 별도로 있었으므로, 동작이 바뀌지 않게 v6.0.10으로 고정하고 업데이트는 Dependabot에 맡겼다.

## Dependabot 설정 기준

- **npm minor·patch는 PR 하나로**: minor·patch는 `minor-and-patch` 그룹 하나로 묶는다. major는 패키지마다 별도 PR이 생성된다. NestJS·Prisma·React의 major는 마이그레이션 문서 검토가 필요하므로 대상에서 제외하고 수동으로 업데이트한다
- **액션은 모두 PR 하나로**: 액션 9종이 동시에 바뀌어도 CI 통과로 검증한다
- **Docker 베이스 이미지**: `node:22-alpine`의 patch는 자동으로 받고, Node major 버전은 `.node-version`과 함께 수동으로 업데이트한다
- **규칙 검사와의 충돌**: 이 저장소는 PR마다 브랜치 이름·제목·커밋이 `타입/설명`, `타입(범위): 설명` 형식인지 검사한다(`conventions` 워크플로). Dependabot의 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정하므로 변경할 수 없다. 제목과 커밋은 `commit-message.prefix`로 `chore(deps):`, `ci(deps):`를 붙여 규칙에 맞추고, 브랜치 이름 검사만 `github.actor == 'dependabot[bot]'`일 때 건너뛰게 했다 (이후 PR 작성자 기준으로 변경. 아래 "이후 열흘" 참고)

![Dependabot PR이 규칙 검사를 통과하는 경로](./images/pin-actions-dependabot-flow.svg '제목과 커밋은 prefix로 규칙에 맞추고, 브랜치 이름만 PR 작성자 기준으로 예외를 둔다')

## 확인

워크플로 YAML 파일 5개를 파서로 읽어 구조를 검사하고, SHA 9개가 각 태그의 커밋과 같은지 `ls-remote` 결과와 대조했다. 이 PR의 CI가 고정한 액션으로 실행된 첫 실행이다. Dependabot은 설정 파일이 main에 병합된 뒤 첫 월요일에 실행되며, 저장소의 Insights → Dependency graph → Dependabot에서 즉시 실행할 수도 있다.

## 이후 열흘

설정을 병합한 10월 10일에 즉시 실행하자 PR이 한꺼번에 생성되었다. 10월 19일까지 병합한 Dependabot PR은 10개다.

| 날짜  | PR                                                                                                                                                                                                                                                                                               | 내용                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 10-10 | [#171](https://github.com/hyeoniverse/MacFolio/pull/171)                                                                                                                                                                                                                                         | `ci(deps)`: 액션 4종 (pnpm/action-setup v6.0.10 → v6.1.0, docker 액션 셋 v3·v6 → v4·v7) |
| 10-10 | [#172](https://github.com/hyeoniverse/MacFolio/pull/172), [#173](https://github.com/hyeoniverse/MacFolio/pull/173), [#174](https://github.com/hyeoniverse/MacFolio/pull/174), [#175](https://github.com/hyeoniverse/MacFolio/pull/175), [#176](https://github.com/hyeoniverse/MacFolio/pull/176) | npm minor·patch 묶음(17개), `@types/node`, mermaid, lucide-react, vite                  |
| 10-12 | [#214](https://github.com/hyeoniverse/MacFolio/pull/214), [#216](https://github.com/hyeoniverse/MacFolio/pull/216), [#217](https://github.com/hyeoniverse/MacFolio/pull/217)                                                                                                                     | npm 묶음(4개), vitest 4 → 5, Font Awesome 6 → 7                                         |
| 10-12 | [#215](https://github.com/hyeoniverse/MacFolio/pull/215)                                                                                                                                                                                                                                         | TypeScript 5.9 → 7.0. 그대로는 빌드되지 않아 수동 수정 커밋을 추가했다                  |
| 10-19 | [#265](https://github.com/hyeoniverse/MacFolio/pull/265)                                                                                                                                                                                                                                         | npm minor·patch 묶음 24개                                                               |

#171은 SHA를 새 버전의 SHA로 바꾸고 주석의 버전도 함께 수정했다. 액션 4종이 PR 하나로 묶여 CI가 한 번에 검증했다. 현재 워크플로의 `uses:` 27줄(같은 저장소의 워크플로를 호출하는 한 줄 제외)은 모두 커밋 SHA와 버전 주석으로 기록되어 있다.

첫날 PR을 처리하며 규칙 검사의 예외 조건도 수정했다. 처음에는 `github.actor == 'dependabot[bot]'`으로 지정했는데, `actor`는 이 실행을 발생시킨 사용자, 즉 마지막으로 push한 사용자다. Dependabot PR에 사람이 수정 커밋을 push하면 예외가 해제되어 브랜치 이름 검사가 실패한다. PR 작성자(`github.event.pull_request.user.login`) 기준으로 수정했다([PR #178](https://github.com/hyeoniverse/MacFolio/pull/178), `1be4522fb`). 이틀 뒤 TypeScript 7 PR(#215)은 그대로는 빌드되지 않아 수동 수정 커밋(`603e47c41`)을 push해야 했는데, 이 수정 덕분에 규칙 검사를 통과했다.

| 조건                                           | Dependabot만 push한 PR | 사람이 수정 커밋을 push한 PR |
| ---------------------------------------------- | ---------------------- | ---------------------------- |
| `github.actor == 'dependabot[bot]'`            | 예외 적용              | 예외 해제 → 브랜치 검사 실패 |
| `pull_request.user.login == 'dependabot[bot]'` | 예외 적용              | 예외 적용                    |

## 남은 과제와 정리

- npm major 중 NestJS·Prisma·React는 의도적으로 제외했다. 이 패키지들은 Dependabot이 알리지 않으므로 별도로 확인해야 한다.
- 액션 SHA 고정은 그 액션이 내부에서 호출하는 다른 액션이나 내려받는 도구까지 고정하지는 않는다. 고정은 첫 단계일 뿐이다.
- GitHub Actions의 `actor`는 "이 실행을 발생시킨 사용자"이지 "PR을 생성한 사용자"가 아니다. 봇 예외를 둘 때는 PR 수명 동안 변하지 않는 값을 기준으로 삼아야 한다.
- Dependabot PR에도 CI 전체가 실행된다. 화면이 바뀌지 않는 PR에 미리보기를 배포하면 CI 시간과 PR 댓글만 늘어나므로, Dependabot PR에서는 미리보기 배포를 건너뛰게 했다(`c8b5c0f8d`).

## 적용 방법

액션 하나를 커밋으로 고정하는 순서다. 태그가 가리키는 커밋을 조회해 `uses:`에 지정하고, 태그 이름은 주석으로 남긴다.

```bash
git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'
# 'refs/tags/v7.0.1^{}' 줄이 있으면 그 줄의 SHA가 커밋이다 (없으면 'refs/tags/v7.0.1' 줄)
```

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

그다음 [.github/dependabot.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/dependabot.yml)에 `github-actions` 생태계를 추가하면 Dependabot이 새 버전의 SHA와 주석을 함께 수정하는 PR을 생성한다. 저장소의 Insights → Dependency graph → Dependabot에서 마지막 확인 시각을 조회하거나, `grep -rn "uses:" .github/workflows | grep -v "@[0-9a-f]\{40\}"`의 출력이 없는지로 확인한다. 되돌리려면 `uses:`를 태그로 바꾸면 되지만 권장하지 않는다.

참고 문서: [GitHub Actions 보안 강화(SHA 고정)](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [dependabot.yml 옵션](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference).

## 관련 글

- [정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기](/memo/commit-conventions-ci)
- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies)
- [pnpm overrides로 하위 의존성 취약점 고치고 pnpm audit로 CI에서 막기](/memo/dependency-vulnerabilities)
- [npm 별칭으로 TypeScript 7 tsc와 TypeScript 6 typescript-eslint 함께 쓰기](/memo/typescript-7-side-by-side)
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)

#MacFolio #보안 #CI #GitHubActions #Dependabot
