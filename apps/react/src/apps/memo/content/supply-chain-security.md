---
title: pnpm overrides·Actions 커밋 SHA 고정·gitleaks로 의존성과 CI 공급망 보안 강화하기
date: 2026-10-10
category: 개발 기록/MacFolio/테스트·보안·성능
series: 보안 점검
seriesOrder: 1
summary: 하위 의존성 취약점 6건을 pnpm overrides로 수정하고 pnpm audit를 CI에 추가했다. 액션 9종을 커밋 SHA로 고정해 Dependabot이 업데이트하게 했고, gitleaks 사용자 규칙과 CI 작업으로 저장소 기록 전체의 비밀 값을 검사한다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 세 가지를 처리한 기록이다. 세 항목은 모두 소프트웨어 공급망[^supply-chain]의 위험을 다룬다. 내가 작성하지 않은 코드(하위 패키지, 외부 액션)와 저장소에 실수로 들어간 값(비밀 키)이 대상이다.

| 항목                                                         | 위험                                                | 대응                                          | PR                                                       |
| ------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| [하위 의존성 취약점](#하위-의존성-취약점과-pnpm-overrides)   | 직접 설치하지 않은 패키지의 취약점                  | `pnpm overrides`, CI의 `pnpm audit`           | [#152](https://github.com/hyeoniverse/MacFolio/pull/152) |
| [액션 버전 고정](#github-actions-커밋-sha-고정과-dependabot) | 태그가 다른 커밋으로 옮겨져 CI에서 임의 코드가 실행 | 커밋 SHA 고정, `permissions` 축소, Dependabot | [#169](https://github.com/hyeoniverse/MacFolio/pull/169) |
| [비밀 값 검사](#gitleaks로-저장소-기록-전체의-비밀-값-검사)  | 커밋 기록에 남은 키가 공개 저장소에서 노출          | gitleaks 사용자 규칙, CI 작업 `secrets`       | [#170](https://github.com/hyeoniverse/MacFolio/pull/170) |

## 하위 의존성 취약점과 pnpm overrides

리팩터링 계획을 세우며 `pnpm audit --prod`를 실행했고, 취약점 6건이 검출되었다.

### 그동안 검출되지 않은 이유

이 저장소는 pnpm 작업 공간(workspace)이다. `apps/api`(NestJS·Prisma), `apps/react`(Vite·React), `packages/*`가 잠금 파일 하나(`pnpm-lock.yaml`)를 공유한다. 이 시각까지는 의존성 취약점을 자동으로 검사하는 장치가 없었다. 기능을 추가할 때 필요한 패키지만 업데이트했고, 그 아래 수백 개 하위 패키지(전이 의존성[^transitive])는 점검 대상이 아니었다.

| 심각도   | 패키지                   | 의존 경로                                  | 수정 버전 |
| -------- | ------------------------ | ------------------------------------------ | --------- |
| high     | `deepmerge-ts`           | api › prisma › @prisma/config              | 8.0.0     |
| high     | `mysql2`                 | api › prisma                               | 3.22.0    |
| moderate | `mysql2`                 | api › prisma                               | 3.23.1    |
| high     | `source-map-js`          | react › milkdown › vue 컴파일러            | 1.2.2     |
| low      | `katex`                  | react › milkdown › 수식                    | 0.18.2    |
| low      | `@ai-sdk/provider-utils` | react › Scalar(API 문서 앱) › AI 채팅 위젯 | 4.0.33    |

6건 모두 `package.json`에 직접 선언한 패키지가 아니다. 상위 패키지(prisma, milkdown, Scalar)가 이미 최신 안정 버전이라, 상위 패키지의 업데이트를 기다리는 방법으로는 수정할 수 없었다.

각 취약점의 내용과 이 사이트에서의 영향 범위는 다음과 같다. `pnpm-workspace.yaml`의 주석에 기록한 내용이다.

<details>
<summary>취약점별 위험과 영향 범위</summary>

| 패키지                   | 위험                                        | 이 사이트에서 실행되는 위치        |
| ------------------------ | ------------------------------------------- | ---------------------------------- |
| `deepmerge-ts`           | 재귀 객체 병합 시 스택 소진                 | Prisma가 설정 파일을 읽을 때       |
| `mysql2`                 | 인증 플러그인 다운그레이드·압축 해제 무제한 | 아니다 (PostgreSQL만 쓴다)         |
| `source-map-js`          | 소스맵 해석 서비스 거부                     | 편집기(milkdown) 안의 Vue 컴파일러 |
| `katex`                  | 프로토타입 오염으로 trust 제한 우회         | 글의 수식                          |
| `@ai-sdk/provider-utils` | 자원 소비 제한 없음                         | API 문서 앱(Scalar)의 AI 채팅 위젯 |

</details>

![취약한 패키지가 들어온 경로와 overrides](./images/dependency-vulnerabilities-tree.svg '여섯 건 모두 직접 설치하지 않은 하위 패키지였다')

### 하위 패키지 수정 방법 비교

| 방법                                          | 장점                           | 단점                                                              |
| --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| 상위 패키지의 수정을 기다린다                 | 작업이 없다                    | 상위 패키지가 이미 최신이다. 수정 시점을 알 수 없다               |
| 상위 패키지를 다른 패키지로 교체한다          | 원인 패키지를 제거한다         | Prisma·milkdown·Scalar 교체는 이 작업 범위를 크게 넘는다          |
| `pnpm patch`로 상위 패키지의 의존 버전을 수정 | 상위 패키지 단위로 정확하다    | 패치 파일을 관리해야 한다. 상위 버전이 바뀌면 다시 만든다         |
| **`overrides`로 하위 패키지 버전을 지정한다** | 다섯 줄. 트리 전체에 같은 버전 | 상위 패키지가 예상하지 않은 버전이 설치될 수 있다 → 시험으로 확인 |

마지막 방법을 선택했다. 이 방법의 위험은 상위 패키지가 새 하위 버전에서 오작동하는 것이고, 이는 타입 검사·시험·빌드로 확인할 수 있다.

### overrides로 하위 패키지만 업데이트

pnpm은 `pnpm-workspace.yaml`의 `overrides` 설정으로 의존성 트리의 위치와 관계없이 특정 패키지의 버전을 지정한다([pnpm 문서: overrides](https://pnpm.io/settings/dependency-resolution#overrides)).

```yaml
overrides:
  deepmerge-ts: '^8.0.0'
  mysql2: '^3.23.1'
  source-map-js: '^1.2.2'
  katex: '^0.18.2'
  '@ai-sdk/provider-utils': '^4.0.33'
```

> [!WARNING] 하한만 지정한 overrides
> 처음에는 `>=1.2.2`처럼 하한만 지정했다. 그러자 `@ai-sdk/provider-utils`가 4.x에서 5.x로 올라갔다. 메이저 버전이 바뀌면 상위 패키지가 사용하는 API와 호환되지 않을 수 있다. 그래서 캐럿(`^`) 범위[^caret]로 수정 버전과 같은 메이저 안에서만 업데이트하게 했다. `deepmerge-ts`와 `katex`는 수정 버전 자체가 새 메이저라 그 메이저로 고정했다.

| 범위 표기  | `@ai-sdk/provider-utils`에 허용되는 버전 | 결과                         |
| ---------- | ---------------------------------------- | ---------------------------- |
| `>=4.0.33` | 4.0.33 이상 전부 (5.x 포함)              | 5.x가 설치되어 메이저가 바뀜 |
| `^4.0.33`  | 4.0.33 이상 5.0.0 미만                   | 4.x 안에서만 업데이트        |

업데이트 후 확인한 항목:

- `prisma generate`가 성공한다 (`deepmerge-ts`는 Prisma가 설정 파일을 읽을 때 사용한다)
- 타입 검사, 린트, 단위 시험, 빌드가 모두 통과한다
- 메뉴 막대·데스크톱·서버 상태 E2E 43개가 통과한다 (API 문서 앱을 여는 시험이 여기에 포함된다)
- `mysql2`는 Prisma가 MySQL 지원용으로 함께 설치하는 패키지이고, 이 프로젝트는 PostgreSQL만 사용하므로 실행되지 않는다

각 항목 옆에 추가한 이유를 주석으로 기록했다. 상위 패키지가 수정 버전을 의존하게 되면 그 줄을 삭제한다.

잠금 파일에서 실제로 결정된 버전은 다음과 같이 바뀌었다. 커밋 전체는 파일 4개, +134/−62줄이고 대부분이 잠금 파일 변경이다.

| 패키지                   | 변경 전         | 변경 후 (지정 범위) | 현재 잠금 파일 |
| ------------------------ | --------------- | ------------------- | -------------- |
| `deepmerge-ts`           | 7.1.5           | `^8.0.0`            | 8.0.2          |
| `mysql2`                 | 3.15.3          | `^3.23.1`           | 3.24.6         |
| `source-map-js`          | 1.2.1           | `^1.2.2`            | 1.2.2          |
| `katex`                  | 0.16.47, 0.18.9 | `^0.18.2`           | 0.18.10        |
| `@ai-sdk/provider-utils` | 4.0.5           | `^4.0.33`           | 4.0.60         |

`katex`는 변경 전에 두 버전(0.16.47과 0.18.9)이 함께 설치되어 있었다. `overrides`가 버전을 하나로 통일해 설치되는 사본도 하나 줄었다.

### CI의 pnpm audit 단계

이번에는 리팩터링 계획 중 수동 실행으로 발견했다. 이후에는 CI가 먼저 검출하도록, 의존성 설치 직후에 검사 단계를 추가했다.

```yaml
- name: 의존성 취약점 검사
  run: pnpm audit --prod --audit-level=high
```

`--prod`는 개발 의존성(테스트·빌드 도구)을 제외하고 실제로 배포되는 패키지만 검사한다. `--audit-level=high`이므로 low·moderate는 실패로 처리하지 않는다. 낮은 등급까지 차단하면 수정 수단이 없는 취약점 하나로 모든 PR이 실패할 수 있기 때문이다([pnpm 문서: pnpm audit](https://pnpm.io/cli/audit)).

![CI 순서: 설치 → 취약점 검사(high 이상이면 멈춤) → 정적 검사 → 시험·빌드 → API e2e](./images/dependency-vulnerabilities-ci.svg '설치 직후에 검사해 시험 실행 전에 중단한다')

설치 직후에 배치한 이유는 실패를 빨리 확인하기 위해서다. 시험과 빌드를 몇 분 실행한 뒤 취약점 검사로 실패하면 그 실행 시간이 낭비된다.

10월 19일에 같은 명령을 다시 실행했다.

```
$ pnpm audit --prod --audit-level=high
No known vulnerabilities found
```

등급 옵션 없이 `pnpm audit --prod`만 실행해도 결과가 같았다. 현재 low·moderate 취약점도 없다.

### osv-scanner로 재검사

10월 18일 보안 점검([#252](https://github.com/hyeoniverse/MacFolio/pull/252), [docs/security-scan.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/security-scan.md))에서 같은 검사를 다른 도구로도 실행했다.

| 도구                                                 | 결과                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| OWASP Dependency-Check                               | 첫 실행에서 NVD 데이터를 내려받다가 `Invalid API Key`로 중단. 13.0.0부터 NVD API 키가 필수다                 |
| NVD API 키 신청                                      | [NVD 신청 양식](https://nvd.nist.gov/developers/request-an-api-key)을 제출했으나 발급 메일을 수신하지 못했다 |
| [osv-scanner](https://google.github.io/osv-scanner/) | 키 없이 잠금 파일의 정확한 버전을 [OSV 데이터베이스](https://osv.dev/)와 대조. `pnpm audit`과 같은 결과      |

Dependency-Check는 osv-scanner로 대체하고, 그 이유를 문서에 기록한 뒤 해당 항목을 종료했다.

```bash
osv-scanner scan source --lockfile pnpm-lock.yaml
```

### 의존성 취약점 수정 절차

```bash
pnpm audit --prod                       # 운영 의존성 전체 (low까지)
pnpm audit --prod --audit-level=high    # CI와 같은 기준. 없으면 "No known vulnerabilities found"
pnpm why <패키지>                        # 어느 상위 패키지가 그 하위 패키지를 의존하는지
```

1. `pnpm why <패키지>`로 취약한 하위 패키지를 의존하는 상위 패키지를 확인한다
2. 상위 패키지가 이미 최신이면 `pnpm-workspace.yaml`의 `overrides`(작업 공간이 아니면 루트 `package.json`의 `pnpm.overrides`)에 수정 버전을 `^` 범위로 지정한다
3. 줄마다 추가한 이유와 삭제 조건을 주석으로 기록한다
4. `pnpm install` 후 `pnpm audit --prod`를 다시 실행해 검출 결과가 없는지 확인한다

되돌리려면 그 줄을 삭제하고 `pnpm install`을 실행한다. 명령 설명은 [pnpm 문서: pnpm audit](https://pnpm.io/cli/audit)과 [pnpm why](https://pnpm.io/cli/why)에 있다.

## GitHub Actions 커밋 SHA 고정과 Dependabot

계획의 두 번째 항목은 "GitHub Actions를 태그 대신 커밋 SHA로 고정하고 `permissions`를 최소로", 세 번째는 "Dependabot으로 업데이트 수신"이다. 버전을 고정하면 업데이트 작업이 생기고, 그 작업을 Dependabot이 담당하므로 두 항목을 같은 커밋(`24c1c47ce`, [#169](https://github.com/hyeoniverse/MacFolio/pull/169))에서 처리했다. 이 설정은 앞 절의 `overrides`와도 역할을 나눈다. CI의 `pnpm audit`는 새로 추가되는 취약점을 차단하고, Dependabot은 기존 의존성의 업데이트를 담당한다.

### 태그는 다른 커밋으로 옮길 수 있다

워크플로에 `uses: actions/checkout@v7`이라고 적으면 GitHub은 실행할 때마다 `v7` **태그**가 가리키는 커밋을 내려받아 실행한다. ==태그는 브랜치처럼 다른 커밋으로 옮길 수 있다.== 액션 저장소가 새 버전을 배포하면 `v7`을 새 커밋으로 옮기고, 그 저장소의 쓰기 권한을 탈취한 사람도 임의의 커밋으로 옮길 수 있다. 2025년 3월 `tj-actions/changed-files`의 태그가 악성 커밋으로 변경되어, 그 액션을 사용하는 수천 개 저장소의 CI가 비밀 값을 로그에 출력했다([CVE-2025-30066](https://github.com/advisories/GHSA-mrrh-fwg8-r2c3)). 이 저장소의 CI에는 Cloudflare 토큰과 서버 배포 키가 있다.

![태그와 커밋 SHA로 액션을 적었을 때의 차이](./images/pin-actions-dependabot-sha.svg '태그는 옮길 수 있지만 커밋 해시는 항상 같은 코드를 가리킨다')

### 액션 버전 지정 방법 비교

| 방법                                        | 장점                                                               | 단점                                                 |
| ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| 태그 유지 (`@v7`)                           | 새 버전이 자동으로 적용된다                                        | 태그를 옮기면 다른 코드가 실행된다                   |
| SHA로 고정하고 수동으로 업데이트            | 실행 코드가 고정된다                                               | 업데이트가 누락되기 쉽다. 9종을 매번 조회해야 한다   |
| SHA로 고정하고 Dependabot이 업데이트 (선택) | 실행 코드가 고정되고, 업데이트 PR이 자동 생성된다. CI 통과 후 병합 | 매주 PR이 생성된다. 브랜치 이름이 규칙과 맞지 않는다 |

Renovate처럼 설정 항목이 더 많은 봇도 있지만, GitHub에 내장되어 설정 파일 하나로 동작하는 Dependabot으로 충분했다.

<details>
<summary>용어 정리: SHA 고정, permissions, Dependabot</summary>

- **커밋 SHA 고정**: `uses: actions/checkout@3d3c42e5…`처럼 40자리 커밋 해시로 지정하는 방식. 해시는 내용에서 계산되므로 같은 해시는 항상 같은 코드다. 뒤에 `# v7.0.1`을 주석으로 붙여 버전을 표시한다
- **`permissions`**: 워크플로에 발급되는 `GITHUB_TOKEN`의 권한([GitHub 문서: Controlling permissions for GITHUB_TOKEN](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token)). 지정하지 않으면 저장소 설정의 기본값(쓰기 권한일 수 있다)이 적용된다. `contents: read`이면 코드 읽기만, `{}`이면 권한이 없다
- **Dependabot**: GitHub이 운영하는 봇. 설정 파일(`.github/dependabot.yml`)에 따라 의존성의 새 버전을 조회해 PR을 생성한다. 취약점이 알려진 패키지는 일정과 관계없이 즉시 PR을 생성한다(저장소 설정의 "Dependabot security updates")
- **그룹**: Dependabot PR을 묶는 설정. 묶지 않으면 패키지마다 PR이 하나씩 생성되어 매주 월요일 10개 이상이 쌓인다

</details>

### 워크플로 변경 내용

| 파일                     | 변경 전              | 변경 후                                          |
| ------------------------ | -------------------- | ------------------------------------------------ |
| `ci.yml` 액션 17곳       | `@v7`, `@v6`, `@v3`… | 커밋 SHA + `# v7.0.1` 주석 (9종)                 |
| `conventions.yml`        | `permissions` 없음   | `contents: read`                                 |
| `uptime.yml`             | `permissions` 없음   | `{}` (curl만 하므로 토큰이 필요 없다)            |
| `.github/dependabot.yml` | 없음                 | npm·github-actions·docker, 월요일 아침, 그룹으로 |

`ci.yml`과 `deploy-api.yml`은 이미 상단에 `contents: read`를 지정하고, 이미지 업로드(`packages: write`)·PR 댓글(`pull-requests: write`) 권한만 작업 단위로 추가하고 있었다.

SHA는 `git ls-remote --tags`로 태그가 가리키는 커밋을 조회해 기록했다. `pnpm/action-setup@v6`는 `v6` 태그가 v6.0.10을 가리키고 v6.1.0이 별도로 있었으므로, 동작이 바뀌지 않게 v6.0.10으로 고정하고 업데이트는 Dependabot에 맡겼다.

### Dependabot 설정 기준

- **npm minor·patch는 PR 하나로**: minor·patch는 `minor-and-patch` 그룹 하나로 묶는다. major는 패키지마다 별도 PR이 생성된다. NestJS·Prisma·React의 major는 마이그레이션 문서 검토가 필요하므로 대상에서 제외하고 수동으로 업데이트한다
- **액션은 모두 PR 하나로**: 액션 9종이 동시에 바뀌어도 CI 통과로 검증한다
- **Docker 베이스 이미지**: `node:22-alpine`의 patch는 자동으로 받고, Node major 버전은 `.node-version`과 함께 수동으로 업데이트한다
- **규칙 검사와의 충돌**: 이 저장소는 PR마다 브랜치 이름·제목·커밋이 `타입/설명`, `타입(범위): 설명` 형식인지 검사한다(`conventions` 워크플로). Dependabot의 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정하므로 변경할 수 없다. 제목과 커밋은 `commit-message.prefix`로 `chore(deps):`, `ci(deps):`를 붙여 규칙에 맞추고, 브랜치 이름 검사만 `github.actor == 'dependabot[bot]'`일 때 건너뛰게 했다 (이후 PR 작성자 기준으로 변경. [Dependabot PR 운영 결과](#dependabot-pr-운영-결과) 참고)

![Dependabot PR이 규칙 검사를 통과하는 경로](./images/pin-actions-dependabot-flow.svg '제목과 커밋은 prefix로 규칙에 맞추고, 브랜치 이름만 PR 작성자 기준으로 예외를 둔다')

워크플로 YAML 파일 5개를 파서로 읽어 구조를 검사하고, SHA 9개가 각 태그의 커밋과 같은지 `ls-remote` 결과와 대조했다. 이 PR의 CI가 고정한 액션으로 실행된 첫 실행이다. Dependabot은 설정 파일이 main에 병합된 뒤 첫 월요일에 실행되며, 저장소의 Insights → Dependency graph → Dependabot에서 즉시 실행할 수도 있다.

### Dependabot PR 운영 결과

설정을 병합한 10월 10일에 즉시 실행하자 PR이 한꺼번에 생성되었다. 10월 19일까지 병합한 Dependabot PR은 10개다.

| 날짜  | PR                                                                                                                                                                                                                                                                                               | 내용                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 10-10 | [#171](https://github.com/hyeoniverse/MacFolio/pull/171)                                                                                                                                                                                                                                         | `ci(deps)`: 액션 4종 (pnpm/action-setup v6.0.10 → v6.1.0, docker 액션 셋 v3·v6 → v4·v7) |
| 10-10 | [#172](https://github.com/hyeoniverse/MacFolio/pull/172), [#173](https://github.com/hyeoniverse/MacFolio/pull/173), [#174](https://github.com/hyeoniverse/MacFolio/pull/174), [#175](https://github.com/hyeoniverse/MacFolio/pull/175), [#176](https://github.com/hyeoniverse/MacFolio/pull/176) | npm minor·patch 묶음(17개), `@types/node`, mermaid, lucide-react, vite                  |
| 10-12 | [#214](https://github.com/hyeoniverse/MacFolio/pull/214), [#216](https://github.com/hyeoniverse/MacFolio/pull/216), [#217](https://github.com/hyeoniverse/MacFolio/pull/217)                                                                                                                     | npm 묶음(4개), vitest 4 → 5, Font Awesome 6 → 7                                         |
| 10-12 | [#215](https://github.com/hyeoniverse/MacFolio/pull/215)                                                                                                                                                                                                                                         | TypeScript 5.9 → 7.0. 그대로는 빌드되지 않아 수동 수정 커밋을 추가했다                  |
| 10-19 | [#265](https://github.com/hyeoniverse/MacFolio/pull/265)                                                                                                                                                                                                                                         | npm minor·patch 묶음 24개                                                               |

#171은 SHA를 새 버전의 SHA로 바꾸고 주석의 버전도 함께 수정했다. 액션 4종이 PR 하나로 묶여 CI가 한 번에 검증했다. 현재 워크플로의 `uses:` 27줄(같은 저장소의 워크플로를 호출하는 한 줄 제외)은 모두 커밋 SHA와 버전 주석으로 기록되어 있다.

> [!WARNING] `actor`는 마지막으로 push한 사용자
> 첫날 PR을 처리하며 규칙 검사의 예외 조건도 수정했다. 처음에는 `github.actor == 'dependabot[bot]'`으로 지정했는데, `actor`는 이 실행을 발생시킨 사용자, 즉 마지막으로 push한 사용자다. Dependabot PR에 사람이 수정 커밋을 push하면 예외가 해제되어 브랜치 이름 검사가 실패한다. PR 작성자(`github.event.pull_request.user.login`) 기준으로 수정했다([PR #178](https://github.com/hyeoniverse/MacFolio/pull/178), `1be4522fb`). 이틀 뒤 TypeScript 7 PR(#215)은 그대로는 빌드되지 않아 수동 수정 커밋(`603e47c41`)을 push해야 했는데, 이 수정 덕분에 규칙 검사를 통과했다.

| 조건                                           | Dependabot만 push한 PR | 사람이 수정 커밋을 push한 PR |
| ---------------------------------------------- | ---------------------- | ---------------------------- |
| `github.actor == 'dependabot[bot]'`            | 예외 적용              | 예외 해제 → 브랜치 검사 실패 |
| `pull_request.user.login == 'dependabot[bot]'` | 예외 적용              | 예외 적용                    |

Dependabot PR에도 CI 전체가 실행된다. 화면이 바뀌지 않는 PR에 미리보기를 배포하면 CI 시간과 PR 댓글만 늘어나므로, Dependabot PR에서는 미리보기 배포를 건너뛰게 했다(`c8b5c0f8d`).

### 액션 고정 절차

액션 하나를 커밋으로 고정하는 순서다. 태그가 가리키는 커밋을 조회해 `uses:`에 지정하고, 태그 이름은 주석으로 남긴다.

```bash
git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'
# 'refs/tags/v7.0.1^{}' 줄이 있으면 그 줄의 SHA가 커밋이다 (없으면 'refs/tags/v7.0.1' 줄)
```

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

그다음 [.github/dependabot.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/dependabot.yml)에 `github-actions` 생태계를 추가하면 Dependabot이 새 버전의 SHA와 주석을 함께 수정하는 PR을 생성한다. 저장소의 Insights → Dependency graph → Dependabot에서 마지막 확인 시각을 조회하거나, `grep -rn "uses:" .github/workflows | grep -v "@[0-9a-f]\{40\}"`의 출력이 없는지로 확인한다. 되돌리려면 `uses:`를 태그로 바꾸면 되지만 권장하지 않는다.

참고 문서: [GitHub Actions 보안 강화(SHA 고정)](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [dependabot.yml 옵션](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference), [GitHub 문서: Dependabot](https://docs.github.com/en/code-security/dependabot).

## gitleaks로 저장소 기록 전체의 비밀 값 검사

세 번째 항목은 "비밀 값 스캔(gitleaks 또는 GitHub secret scanning) 켜기"다([#170](https://github.com/hyeoniverse/MacFolio/pull/170)).

### 기록 전체를 검사하는 이유

`.env`는 `.gitignore`에 포함되어 있고 키는 서버와 GitHub Secrets에만 저장한다. 그래도 위험은 남는다. 시험 코드에 실제 키를 일시적으로 넣었다가 삭제하면, ==현재 파일에서는 사라져도 커밋 기록에는 남는다.== 공개 저장소이므로 `git log -p`로 누구나 조회할 수 있다. 따라서 현재 파일뿐 아니라 기록 전체에 비밀 값이 포함된 적이 있는지 검사해야 한다.

### 비밀 값 검사 방법 비교

| 방법                                                              | 장점                                               | 단점                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| GitHub Secret Protection만 활성화                                 | 설정 한 번, push 시각에 차단한다                   | 알려진 서비스의 키만 검사한다. Resend·Groq 키와 DB 비밀번호는 검사하지 않는다 |
| `gitleaks-action` 사용                                            | 워크플로 몇 줄                                     | 조직 저장소는 라이선스 키가 필요하고, 내려받는 바이너리를 직접 고정할 수 없다 |
| pre-commit 훅으로 커밋 전에 차단                                  | 커밋 이전에 차단한다                               | 설치한 컴퓨터에만 적용된다. 훅을 건너뛴 커밋, 웹에서 수정한 커밋은 통과한다   |
| 바이너리를 고정해 CI에서 기록 전체 검사 (선택) + GitHub 기능 병행 | 모든 커밋에 같은 규칙, 프로젝트 전용 규칙까지 적용 | CI가 약 15초 늘고, 저장소 설정은 수동으로 활성화한다                          |

pre-commit 훅은 도입하지 않았다. PR과 main에서 같은 검사가 실행되고, 훅은 설치한 컴퓨터에서만 동작하기 때문이다.

<details>
<summary>용어 정리: gitleaks, secret scanning, --redact</summary>

- **gitleaks**: 커밋 내용을 정규식 수백 개(GitHub 토큰 `ghp_…`, AWS 키 `AKIA…`, `-----BEGIN PRIVATE KEY-----`, `postgres://user:pass@` 등)로 검사하는 도구. `gitleaks git`은 기록 전체, `gitleaks dir`은 현재 파일을 검사한다
- **GitHub secret scanning**: GitHub이 저장소의 커밋을 자체 규칙으로 검사하고, 알려진 서비스의 키이면 해당 서비스에 통보해 폐기하게 하는 기능. **push protection**은 그런 키가 포함된 push 자체를 차단한다. 공개 저장소는 무료
- **`--redact`**: 검출한 값을 로그에 그대로 출력하지 않고 `REDACTED`로 치환하는 옵션. CI 로그는 공개이므로 스캐너가 비밀 값을 출력하면 그 자체가 다시 유출이다

</details>

### 최초 전체 검사

| 검출 항목                                                           | 판단                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `oci.test.ts`, `resources.e2e.test.ts`의 RSA 개인 키 4건 (커밋 2개) | Oracle 문서 "Request Signatures"에 공개된 시험용 키. 비밀이 아니다 |

이 두 파일만 `.gitleaks.toml`에 예외로 등록했다. 예외는 "이 규칙(`private-key`)을 이 두 파일에서만" 형태로 범위를 좁게 지정한다. ==파일 전체나 규칙 전체를 제외하면 이후 실제 비밀 값이 들어와도 검출하지 못한다.==

### 기본 규칙이 검출하지 못하는 값

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

> [!WARNING] 반복 문자열로 만든 시험 값
> 처음에는 반복 문자열(`A1b2A1b2…`)로 시험해 GitHub 토큰조차 검출되지 않았다. gitleaks는 정규식에 일치해도 **엔트로피**(문자열의 무작위성)[^entropy]가 낮으면 통과시킨다. `aaaa…` 같은 플레이스홀더를 비밀 값으로 오탐하지 않기 위해서다. 무작위 값으로 다시 시험해야 했다.

| 시험 값           | 서로 다른 문자 수 | 섀넌 엔트로피(문자당) | Resend 규칙 기준 3.0 |
| ----------------- | ----------------- | --------------------- | -------------------- |
| `A1b2` × 6 (24자) | 4                 | 2.0비트               | 미달 → 통과          |
| 무작위 24자       | (무작위)          | 약 4.6비트            | 초과 → 검출          |

비밀번호 규칙의 기준을 2.5로 낮게 지정한 것은 사람이 정한 비밀번호가 짧고 무작위성이 낮기 때문이다.

![gitleaks가 한 줄을 검출하기까지 거치는 세 단계](./images/secret-scanning-gates.svg '정규식, 엔트로피, 예외 목록을 모두 통과해야 검출된다')

DB 주소 규칙은 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 가짜 비밀번호(`s3cret`)를 검출해, 그 줄만 예외로 등록했다. 예외는 비밀번호 부분이 아니라 **줄 전체**를 대상으로 비교하게 해야 했다(`regexTarget = "line"`). 기본값은 검출된 값 자체만 비교하므로 `://macfolio:macfolio@` 조건이 `macfolio`에만 적용되어 예외가 동작하지 않았다.

### CI 작업 secrets

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

권한은 `contents: read`뿐이고, 같은 브랜치에서 새 실행이 시작되면 이전 실행을 취소한다. 바이너리는 버전(8.30.1)과 SHA-256 체크섬을 지정해 내려받는다. 액션(`gitleaks/gitleaks-action`)을 사용하지 않은 이유는 조직 저장소에 라이선스가 필요하고, 내려받는 바이너리를 직접 고정하는 방식이 [앞 절의 커밋 SHA 고정](#github-actions-커밋-sha-고정과-dependabot)과 같은 기준이기 때문이다. `fetch-depth: 0`으로 기록 전체를 내려받아 검사하고, 검출되면 실패한다. 커밋 791개·392MB 검사에 약 15초가 걸린다.

### 저장소 설정에서 활성화할 항목

코드로 처리할 수 있는 범위는 여기까지이고, 다음 두 항목은 저장소 설정이다.

1. Settings → Advanced Security(이전 이름 Code security)에서 **Secret Protection**(이전 이름 Secret scanning)과 그 아래 **Push protection**, 그리고 **Dependabot security updates** 활성화
2. main의 Ruleset에 `secrets`를 필수 검사로 추가

버튼 위치와 순서는 CONTRIBUTING.md의 '저장소 설정 › 비밀 값·의존성'에 기록했다. GitHub의 스캐너와 gitleaks는 검사 범위가 다르다. GitHub은 등록된 서비스의 키만, gitleaks는 `.gitleaks.toml`에 정의한 이 프로젝트의 키(Resend·Groq, DB 비밀번호)까지 검사한다. 그래서 둘 다 활성화한다.

![GitHub Secret Protection과 gitleaks가 보는 범위 비교](./images/secret-scanning-coverage.svg 'GitHub은 알려진 서비스의 키를 push 시각에, gitleaks는 이 프로젝트의 키 형식까지 기록 전체에서 검사한다')

코드 변경을 머지한 뒤 두 항목의 적용 여부를 다시 확인했다. 설정 화면의 항목 이름은 "Secret scanning"이 아니라 **Secret Protection**이었고, 이미 활성화되어 있었다. Push protection의 "Block commits that contain supported secrets" 문구는 화면에서 찾지 못했다. 그래서 문서에 이전 이름과 현재 이름을 함께 기록했다.

### 비밀 값 검사 결과

- 최초 검사: 검출 항목은 시험용 RSA 키 4건(커밋 2개)뿐. 예외 등록 후 0건.
- 규칙 시험: 무작위 `ghp_…`, `re_…`, `gsk_…`, 비밀번호가 포함된 DB 주소를 넣은 임시 파일에서 모두 검출되고, 로컬 기본값(`macfolio:macfolio`)과 시험 파일의 `s3cret`은 검출되지 않는 것을 확인했다.
- CI: 커밋 791개·392MB를 약 15초에 검사한다. 이후 커밋이 늘어 현재 main 기록은 커밋 1,192개다.

### 검출 시 대응

> [!CAUTION] 기록 삭제보다 키 폐기가 먼저
> 기록에서 값을 삭제하는 것(`git filter-repo`)은 이미 공개된 뒤라 효과가 제한적이다. 이미 복제된 저장소에는 값이 남는다. 대응 순서는 다음과 같다.
>
> 1. 해당 키를 서비스에서 먼저 폐기하고 새로 발급한다
> 2. 서버의 `~/deploy/api.env`나 GitHub Secrets의 값을 교체한다
> 3. 시험용 가짜 값이었다면 `.gitleaks.toml`에 규칙과 파일 범위를 좁혀 예외로 등록한다

```bash
# 내 컴퓨터에서 기록 전체를 훑기 (CI와 같은 명령)
gitleaks git --redact --verbose --exit-code 1 .
```

설정 순서는 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md)의 '저장소 설정 › 비밀 값·의존성', CI는 [.github/workflows/secrets.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/secrets.yml), 규칙은 [.gitleaks.toml](https://github.com/hyeoniverse/MacFolio/blob/main/.gitleaks.toml)에 있다.

참고 문서: [gitleaks](https://github.com/gitleaks/gitleaks), [GitHub Secret scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning), [Push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection).

## 남은 과제와 정리

| 영역       | 남은 과제·판단 기준                                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| overrides  | 추가한 뒤 관리에서 누락되기 쉽다. 상위 패키지가 수정 버전을 의존하게 된 뒤에도 남아 있으면 이후 업데이트를 제한한다. 줄마다 주석에 원인 상위 패키지를 기록했고, 상위 패키지 업데이트 시각에 삭제 여부를 판단한다 |
| pnpm audit | `--audit-level=high`는 high 미만을 통과시킨다. 주기적으로 등급 옵션 없이 `pnpm audit --prod`를 실행해 low 등급까지 확인한다                                                                                      |
| Dependabot | npm major 중 NestJS·Prisma·React는 의도적으로 제외했다. Dependabot이 알리지 않으므로 별도로 확인해야 한다                                                                                                        |
| SHA 고정   | 그 액션이 내부에서 호출하는 다른 액션이나 내려받는 도구까지 고정하지는 않는다. 고정은 첫 단계일 뿐이다                                                                                                           |
| 봇 예외    | `actor`는 "이 실행을 발생시킨 사용자"이지 "PR을 생성한 사용자"가 아니다. 봇 예외는 PR 수명 동안 변하지 않는 값을 기준으로 삼는다                                                                                 |
| gitleaks   | 기본 규칙은 널리 쓰이는 서비스 중심이다. 새 서비스를 연동하면 규칙도 함께 추가한다. 시험 값은 무작위로 생성하고, 예외 범위는 규칙 하나·파일 두 개처럼 좁게 지정한다                                              |

하위 의존성 취약점은 상위 패키지의 몫으로 미루기 쉽다. 그러나 상위 패키지가 이미 최신이면 수정이 언제 반영될지 알 수 없다. 직접 수정할 수단(`overrides`)이 있으면 사용하고, 그 이유를 설정 옆 주석으로 남겨야 이후에 안전하게 삭제할 수 있다. 반복 문자열로 시험한 gitleaks 규칙이 엔트로피 때문에 "검출되지 않는다"는 잘못된 결론을 낸 것처럼, ==보안 설정은 실제와 같은 조건의 값으로 시험해야 동작을 확인할 수 있다.==

## 관련 글

- [Semgrep·pnpm audit·osv-scanner로 코드와 의존성 취약점 점검하기](/memo/security-scan): 10월 18일 보안 점검에서 코드와 의존성을 다른 도구로 다시 검사한 기록
- [CSP·iframe sandbox·@RateLimit·Dependabot으로 보안 설정 통일하기](/memo/refactor-retrospective#7단계-보안): 리팩터링 7단계의 보안 설정
- [정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기](/memo/commit-conventions-ci): Dependabot PR이 통과해야 하는 규칙 검사
- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies): 병합 방식 비교
- [npm 별칭으로 TypeScript 7 tsc와 TypeScript 6 typescript-eslint 함께 쓰기](/memo/typescript-7-side-by-side): TypeScript 7 Dependabot PR(#215)의 수동 수정
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions): 같은 CI의 배포 단계
- [git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기](/memo/faster-e2e-ci): CI 실행 시간 단축
- [모든 로그가 거치는 ConsoleLogger에서 비밀 값 마스킹하기](/memo/error-log-masking): 런타임 로그의 비밀 값 처리
- [부트 볼륨을 임시 VM에 연결해 authorized_keys를 고치는 SSH 키 복구](/memo/oracle-ssh-key-recovery): 서버 접속 키 복구

[^supply-chain]: 소프트웨어 공급망. 배포되는 코드에 포함되거나 빌드·배포 과정에서 실행되는 외부 구성 요소(패키지, CI 액션, 빌드 도구)와 그 전달 경로 전체를 뜻한다.

[^transitive]: 직접 설치한 패키지가 다시 의존하는 패키지. `package.json`에는 없지만 잠금 파일과 `node_modules`에는 포함된다.

[^caret]: `^4.0.33`은 4.0.33 이상, 5.0.0 미만을 뜻한다. 유의적 버전(SemVer)에서 메이저 번호가 바뀌지 않는 범위다. [유의적 버전 명세](https://semver.org/lang/ko/)

[^entropy]: 섀넌 엔트로피. 문자열에 나타나는 각 문자의 빈도로 계산하는 무작위성 지표로, 같은 문자가 반복될수록 낮아진다. gitleaks는 규칙의 `entropy` 값보다 낮은 일치 항목을 검출에서 제외한다. [gitleaks README](https://github.com/gitleaks/gitleaks#configuration)

#MacFolio #보안 #의존성 #pnpm #CI #GitHubActions #Dependabot #gitleaks
