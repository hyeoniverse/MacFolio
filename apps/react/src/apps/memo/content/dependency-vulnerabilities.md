---
title: 하위 의존성 취약점 6건을 overrides로 고치기
date: 2026-10-09
category: 개발 기록/MacFolio/보안
summary: pnpm audit --prod에서 운영 의존성 취약점 6건(high 3)이 검출되었다. 모두 직접 설치하지 않은 하위 패키지였고, 상위 패키지는 이미 최신이었다. pnpm overrides로 하위 패키지만 같은 메이저 안에서 올리고, CI에 high 이상을 차단하는 검사를 추가했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))을 세우며 `pnpm audit --prod`를 실행했고, 취약점 6건이 검출되었다. 이 글은 그 6건을 `overrides`로 수정하고 CI에 검사를 추가한 [#152](https://github.com/hyeoniverse/MacFolio/pull/152)의 기록이다.

## 배경: 그동안 검출되지 않은 이유

이 저장소는 pnpm 작업 공간(workspace)이다. `apps/api`(NestJS·Prisma), `apps/react`(Vite·React), `packages/*`가 잠금 파일 하나(`pnpm-lock.yaml`)를 공유한다. 이 시각까지는 의존성 취약점을 자동으로 검사하는 장치가 없었다. 기능을 추가할 때 필요한 패키지만 업데이트했고, 그 아래 수백 개 하위 패키지(전이 의존성[^transitive])는 점검 대상이 아니었다. 검출 결과를 표로 정리하자 문제는 모두 하위 패키지에 있었고, 상위 패키지는 이미 최신 안정 버전이었다. 상위 패키지의 업데이트를 기다리는 방법으로는 해결할 수 없었다.

| 심각도   | 패키지                   | 의존 경로                                  | 수정 버전 |
| -------- | ------------------------ | ------------------------------------------ | --------- |
| high     | `deepmerge-ts`           | api › prisma › @prisma/config              | 8.0.0     |
| high     | `mysql2`                 | api › prisma                               | 3.22.0    |
| moderate | `mysql2`                 | api › prisma                               | 3.23.1    |
| high     | `source-map-js`          | react › milkdown › vue 컴파일러            | 1.2.2     |
| low      | `katex`                  | react › milkdown › 수식                    | 0.18.2    |
| low      | `@ai-sdk/provider-utils` | react › Scalar(API 문서 앱) › AI 채팅 위젯 | 4.0.33    |

6건 모두 `package.json`에 직접 선언한 패키지가 아니다. 상위 패키지(prisma, milkdown, Scalar)가 이미 최신 안정 버전이라, 상위 패키지 업데이트로는 수정할 수 없었다.

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

## 검토한 방법

| 방법                                          | 장점                           | 단점                                                              |
| --------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| 상위 패키지의 수정을 기다린다                 | 작업이 없다                    | 상위 패키지가 이미 최신이다. 수정 시점을 알 수 없다               |
| 상위 패키지를 다른 패키지로 교체한다          | 원인 패키지를 제거한다         | Prisma·milkdown·Scalar 교체는 이 작업 범위를 크게 넘는다          |
| `pnpm patch`로 상위 패키지의 의존 버전을 수정 | 상위 패키지 단위로 정확하다    | 패치 파일을 관리해야 한다. 상위 버전이 바뀌면 다시 만든다         |
| **`overrides`로 하위 패키지 버전을 지정한다** | 다섯 줄. 트리 전체에 같은 버전 | 상위 패키지가 예상하지 않은 버전이 설치될 수 있다 → 시험으로 확인 |

마지막 방법을 선택했다. 이 방법의 위험은 상위 패키지가 새 하위 버전에서 오작동하는 것이고, 이는 타입 검사·시험·빌드로 확인할 수 있다.

## overrides로 하위 패키지만 업데이트

pnpm은 `pnpm-workspace.yaml`의 `overrides` 설정으로 의존성 트리의 위치와 관계없이 특정 패키지의 버전을 지정한다([pnpm 문서: overrides](https://pnpm.io/settings/dependency-resolution#overrides)).

```yaml
overrides:
  deepmerge-ts: '^8.0.0'
  mysql2: '^3.23.1'
  source-map-js: '^1.2.2'
  katex: '^0.18.2'
  '@ai-sdk/provider-utils': '^4.0.33'
```

처음에는 `>=1.2.2`처럼 하한만 지정했다. 그러자 `@ai-sdk/provider-utils`가 4.x에서 5.x로 올라갔다. 메이저 버전이 바뀌면 상위 패키지가 사용하는 API와 호환되지 않을 수 있다. 그래서 캐럿(`^`) 범위[^caret]로 수정 버전과 같은 메이저 안에서만 업데이트하게 했다. `deepmerge-ts`와 `katex`는 수정 버전 자체가 새 메이저라 그 메이저로 고정했다.

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

## CI에서 차단

이번에는 리팩터링 계획 중 수동 실행으로 발견했다. 이후에는 CI가 먼저 검출하도록, 의존성 설치 직후에 검사 단계를 추가했다.

```yaml
- name: 의존성 취약점 검사
  run: pnpm audit --prod --audit-level=high
```

`--prod`는 개발 의존성(테스트·빌드 도구)을 제외하고 실제로 배포되는 패키지만 검사한다. `--audit-level=high`이므로 low·moderate는 실패로 처리하지 않는다. 낮은 등급까지 차단하면 수정 수단이 없는 취약점 하나로 모든 PR이 실패할 수 있기 때문이다([pnpm 문서: pnpm audit](https://pnpm.io/cli/audit)).

![CI 순서: 설치 → 취약점 검사(high 이상이면 멈춤) → 정적 검사 → 시험·빌드 → API e2e](./images/dependency-vulnerabilities-ci.svg '설치 직후에 검사해 시험 실행 전에 중단한다')

설치 직후에 배치한 이유는 실패를 빨리 확인하기 위해서다. 시험과 빌드를 몇 분 실행한 뒤 취약점 검사로 실패하면 그 실행 시간이 낭비된다.

## 확인

이 글을 수정한 10월 19일에 같은 명령을 다시 실행했다.

```
$ pnpm audit --prod --audit-level=high
No known vulnerabilities found
```

등급 옵션 없이 `pnpm audit --prod`만 실행해도 결과가 같았다. 현재 low·moderate 취약점도 없다.

## 남은 과제와 정리

- `overrides`는 추가한 뒤 관리에서 누락되기 쉽다. 상위 패키지가 수정 버전을 의존하게 된 뒤에도 이 줄이 남아 있으면 이후의 업데이트를 제한할 수 있다. 그래서 줄마다 주석에 원인이 된 상위 패키지를 기록했다. 상위 패키지를 업데이트할 때 그 주석을 보고 삭제 여부를 판단한다.
- 다음 날 `.github/dependabot.yml`을 추가해 매주 월요일 의존성 업데이트 PR이 생성되게 했다([#169](https://github.com/hyeoniverse/MacFolio/pull/169)). CI 검사는 새로 추가되는 취약점을 차단하고, Dependabot은 기존 의존성의 업데이트를 담당한다.
- `--audit-level=high`는 high 미만을 통과시킨다. 그래서 주기적으로 `pnpm audit --prod`를 등급 옵션 없이 실행해 low 등급까지 확인한다.

하위 의존성 취약점은 상위 패키지의 몫으로 미루기 쉽다. 그러나 상위 패키지가 이미 최신이면 수정이 언제 반영될지 알 수 없다. 직접 수정할 수단(`overrides`)이 있으면 사용하고, 그 이유를 설정 옆 주석으로 남겨야 이후에 안전하게 삭제할 수 있다.

## 적용 방법

```bash
pnpm audit --prod                       # 운영 의존성 전체 (low까지)
pnpm audit --prod --audit-level=high    # CI와 같은 기준. 없으면 "No known vulnerabilities found"
pnpm why <패키지>                        # 어느 상위 패키지가 그 하위 패키지를 의존하는지
```

1. `pnpm why <패키지>`로 취약한 하위 패키지를 의존하는 상위 패키지를 확인한다
2. 상위 패키지가 이미 최신이면 `pnpm-workspace.yaml`의 `overrides`(작업 공간이 아니면 루트 `package.json`의 `pnpm.overrides`)에 수정 버전을 `^` 범위로 지정한다
3. 줄마다 추가한 이유와 삭제 조건을 주석으로 기록한다
4. `pnpm install` 후 `pnpm audit --prod`를 다시 실행해 검출 결과가 없는지 확인한다

되돌리려면 그 줄을 삭제하고 `pnpm install`을 실행한다. 명령 설명은 [pnpm 문서: pnpm audit](https://pnpm.io/cli/audit)과 [pnpm why](https://pnpm.io/cli/why), 자동 업데이트 PR은 [GitHub 문서: Dependabot](https://docs.github.com/en/code-security/dependabot)과 [.github/dependabot.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/dependabot.yml)에 있다.

## 이후: 다른 도구로 재검사

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

## 관련 글

- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot)
- [Semgrep과 SCA 도구로 MacFolio 점검하기 - 7건 중 실제 취약점 0](/memo/security-scan)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기](/memo/faster-e2e-ci)

[^transitive]: 직접 설치한 패키지가 다시 의존하는 패키지. `package.json`에는 없지만 잠금 파일과 `node_modules`에는 포함된다.

[^caret]: `^4.0.33`은 4.0.33 이상, 5.0.0 미만을 뜻한다. 유의적 버전(SemVer)에서 메이저 번호가 바뀌지 않는 범위다. [유의적 버전 명세](https://semver.org/lang/ko/)

#MacFolio #보안 #의존성 #pnpm #CI
