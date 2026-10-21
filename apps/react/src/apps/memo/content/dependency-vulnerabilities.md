---
title: 하위 의존성 취약점 6건을 overrides로 고치기
date: 2026-10-09
category: 개발기/MacFolio/인프라
summary: pnpm audit --prod에서 운영 의존성 취약점 6건(high 3)이 나왔다. 모두 직접 설치하지 않은 하위 패키지였고, 위 패키지는 이미 최신이었다. pnpm overrides로 하위 패키지만 같은 메이저 안에서 올리고, CI에 high 이상을 막는 검사를 넣었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))을 세우며 `pnpm audit --prod`를 돌려 보니 취약점이 6건 나왔다.

## 배경: 왜 이제야 보였나

이 저장소는 pnpm 작업 공간(workspace)이다. `apps/api`(NestJS·Prisma), `apps/react`(Vite·React), `packages/*`가 한 잠금 파일(`pnpm-lock.yaml`)을 함께 쓴다. 그때까지는 의존성을 자동으로 살피는 장치가 없었다. 패키지는 기능을 붙일 때 필요한 것만 올렸고, 그 아래 수백 개 하위 패키지는 아무도 보지 않았다. 표를 만들어 보니 문제는 모두 하위 패키지에 있었고, 그 위 패키지들은 이미 최신 안정 버전이었다. 기다려서 해결될 일이 아니었다.

| 심각도   | 패키지                   | 들어온 경로                                | 고친 버전 |
| -------- | ------------------------ | ------------------------------------------ | --------- |
| high     | `deepmerge-ts`           | api › prisma › @prisma/config              | 8.0.0     |
| high     | `mysql2`                 | api › prisma                               | 3.22.0    |
| moderate | `mysql2`                 | api › prisma                               | 3.23.1    |
| high     | `source-map-js`          | react › milkdown › vue 컴파일러            | 1.2.2     |
| low      | `katex`                  | react › milkdown › 수식                    | 0.18.2    |
| low      | `@ai-sdk/provider-utils` | react › Scalar(API 문서 앱) › AI 채팅 위젯 | 4.0.33    |

여섯 개 모두 `package.json`에 직접 적은 패키지가 아니다. 위 패키지(prisma, milkdown, Scalar)는 이미 최신 안정 버전이라, 위 패키지를 올리는 방법으로는 고칠 수 없었다.

어떤 위험이었는지도 적어 둔다. `pnpm-workspace.yaml`의 주석에 남긴 내용이다.

| 패키지                   | 위험                                        | 이 사이트에서 닿는가               |
| ------------------------ | ------------------------------------------- | ---------------------------------- |
| `deepmerge-ts`           | 재귀 객체 병합 시 스택 소진                 | Prisma가 설정 파일을 읽을 때       |
| `mysql2`                 | 인증 플러그인 다운그레이드·압축 해제 무제한 | 아니다 (PostgreSQL만 쓴다)         |
| `source-map-js`          | 소스맵 해석 서비스 거부                     | 편집기(milkdown) 안의 Vue 컴파일러 |
| `katex`                  | 프로토타입 오염으로 trust 제한 우회         | 글의 수식                          |
| `@ai-sdk/provider-utils` | 자원 소비 제한 없음                         | API 문서 앱(Scalar)의 AI 채팅 위젯 |

![취약한 패키지가 들어온 경로와 overrides](./images/dependency-vulnerabilities-tree.svg '여섯 건 모두 직접 설치하지 않은 하위 패키지였다')

## 고를 수 있던 방법

| 방법                                          | 좋은 점                          | 나쁜 점                                                         |
| --------------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| 위 패키지가 고칠 때까지 기다린다              | 할 일이 없다                     | 위 패키지가 이미 최신이다. 언제 고칠지 모른다                   |
| 위 패키지를 다른 것으로 바꾼다                | 근본적                           | Prisma·milkdown·Scalar를 바꾸는 것은 이 일의 크기가 아니다      |
| `pnpm patch`로 위 패키지의 의존 버전을 고친다 | 위 패키지 단위로 정확하다        | 패치 파일을 관리해야 한다. 위 패키지 버전이 바뀌면 다시 만든다  |
| **`overrides`로 하위 패키지 버전을 정한다**   | 다섯 줄. 트리 어디서든 같은 버전 | 위 패키지가 기대하지 않은 버전이 들어갈 수 있다 → 시험으로 확인 |

마지막을 골랐다. 위험은 "위 패키지가 그 버전에서 깨지는 것"인데, 이것은 타입 검사·시험·빌드로 확인할 수 있다.

## overrides로 하위 패키지만 올리기

pnpm은 `pnpm-workspace.yaml`의 `overrides`로 의존성 트리 어디에 있든 특정 패키지의 버전을 정할 수 있다.

```yaml
overrides:
  deepmerge-ts: '^8.0.0'
  mysql2: '^3.23.1'
  source-map-js: '^1.2.2'
  katex: '^0.18.2'
  '@ai-sdk/provider-utils': '^4.0.33'
```

처음에는 `>=1.2.2`처럼 하한만 적었다. 그랬더니 `@ai-sdk/provider-utils`가 4.x에서 5.x로 올라갔다. 메이저 버전이 바뀌면 위 패키지가 기대하는 API와 달라질 수 있다. 그래서 `^`로 고친 버전과 같은 메이저 안에서만 올리게 했다. `deepmerge-ts`와 `katex`는 고친 버전 자체가 새 메이저라 그 메이저로 고정했다.

올린 뒤 확인한 것:

- `prisma generate`가 그대로 된다 (`deepmerge-ts`는 Prisma 설정 파일을 읽을 때 쓴다)
- 타입 검사, 린트, 단위 시험, 빌드가 모두 통과한다
- 메뉴 막대·데스크톱·서버 상태 E2E 43개가 통과한다 (API 문서 앱을 여는 시험이 여기에 있다)
- `mysql2`는 Prisma가 MySQL을 지원하려고 같이 설치하는 것이고, 이 프로젝트는 PostgreSQL이라 실제로 불리지 않는다

각 항목 옆에 왜 넣었는지를 주석으로 남겼다. 위 패키지가 고친 버전을 받으면 그 줄을 지운다.

잠금 파일에서 실제로 풀린 버전은 이렇게 바뀌었다. 커밋 전체는 파일 4개, +134/−62이고 대부분이 잠금 파일이다.

| 패키지                   | 전              | 후 (커밋 직후 기준 범위) | 지금 잠금 파일 |
| ------------------------ | --------------- | ------------------------ | -------------- |
| `deepmerge-ts`           | 7.1.5           | `^8.0.0`                 | 8.0.2          |
| `mysql2`                 | 3.15.3          | `^3.23.1`                | 3.24.6         |
| `source-map-js`          | 1.2.1           | `^1.2.2`                 | 1.2.2          |
| `katex`                  | 0.16.47, 0.18.9 | `^0.18.2`                | 0.18.10        |
| `@ai-sdk/provider-utils` | 4.0.5           | `^4.0.33`                | 4.0.60         |

`katex`는 전에는 두 버전(0.16.47과 0.18.9)이 함께 깔려 있었다. `overrides`가 하나로 모아서 설치되는 사본도 하나 줄었다.

## CI에서 막기

이번에는 계획을 세우다 우연히 발견했다. 다음에는 CI가 먼저 알려 주도록, 의존성을 설치한 직후에 검사를 넣었다.

```yaml
- name: 의존성 취약점 검사
  run: pnpm audit --prod --audit-level=high
```

`--prod`는 개발 도구(테스트, 빌드 도구)를 빼고 실제로 배포되는 패키지만 본다. `--audit-level=high`라 low·moderate는 실패로 치지 않는다. 낮은 것까지 막으면 고칠 수 없는 취약점 때문에 모든 PR이 멈출 수 있어서다.

![CI 순서: 설치 → 취약점 검사(high 이상이면 멈춤) → 정적 검사 → 시험·빌드 → API e2e](./images/dependency-vulnerabilities-ci.svg '설치 바로 뒤에 검사해서, 시험을 돌리기 전에 멈춘다')

설치 바로 뒤에 둔 것은 실패를 빨리 알기 위해서다. 시험과 빌드를 몇 분 돌린 뒤에 취약점으로 실패하면 그 시간이 아깝다.

## 확인

이 글을 다듬는 날(10월 19일) 같은 명령을 다시 돌렸다.

```
$ pnpm audit --prod --audit-level=high
No known vulnerabilities found
```

수준을 빼고 `pnpm audit --prod`만 돌려도 같은 결과였다. low·moderate도 지금은 없다.

## 남은 것과 배운 것

- `overrides`는 잊히기 쉽다. 위 패키지가 고친 버전을 받아도 이 줄이 남아 있으면 앞으로 더 새 버전을 막을 수 있다. 그래서 줄마다 주석에 "어느 위 패키지 때문인지"를 적었다. 위 패키지를 올릴 때 그 주석을 보고 지울 수 있는지 판단한다.
- 다음 날 `.github/dependabot.yml`을 더해 매주 월요일 의존성 업데이트 PR이 오게 했다. CI 검사는 "새로 들어오는 것"을 막고, Dependabot은 "있는 것을 올리는" 쪽을 맡는다.
- `--audit-level=high`는 high 미만을 그냥 지나간다. 가끔은 `pnpm audit --prod`를 수준 없이 돌려 low까지 훑어본다.

배운 것: 하위 의존성 취약점은 "위 패키지가 고칠 일"로 미루기 쉽다. 하지만 위 패키지가 이미 최신이면 아무도 고치지 않는다. 직접 고칠 수단(`overrides`)이 있다면 쓰고, 그 결정의 이유를 코드 옆에 남겨야 나중에 되돌릴 수 있다.

## 따라 하기

```bash
pnpm audit --prod                       # 운영 의존성 전체 (low까지)
pnpm audit --prod --audit-level=high    # CI와 같은 기준. 없으면 "No known vulnerabilities found"
pnpm why <패키지>                        # 누가 그 하위 패키지를 끌어오는지
```

위 패키지가 이미 최신인데 하위 패키지가 취약하면 루트 `package.json`의 `pnpm.overrides`에 고친 버전을 적고 `pnpm install`한 뒤 다시 `pnpm audit`을 돌린다. 줄마다 왜 넣었는지와 언제 지울지를 주석으로 남긴다. 되돌리는 법은 그 줄을 지우고 `pnpm install`이다. 명령 설명은 [pnpm audit](https://pnpm.io/cli/audit), 자동 업데이트 PR은 [Dependabot 문서](https://docs.github.com/en/code-security/dependabot)와 [.github/dependabot.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/dependabot.yml)에 있다.

## 그 뒤: 다른 도구로 한 번 더

10월 18일 보안 점검을 하면서 같은 일을 다른 도구로도 돌렸다([docs/security-scan.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/security-scan.md)). OWASP Dependency-Check는 첫 실행에서 NVD 데이터를 받다가 `Invalid API Key`로 멈췄다. 13.0.0부터 NVD API 키 없이는 데이터를 받지 않는다. 키를 받으려 [NVD 신청 양식](https://nvd.nist.gov/developers/request-an-api-key)을 채워 보냈지만 메일이 오지 않았고, 찾아본 방법 몇 가지를 더 해 봐도 마찬가지였다. 그래서 키 없이 잠금 파일의 정확한 버전으로 OSV 데이터베이스와 맞추는 osv-scanner로 대신하고, 그 이유를 문서에 남긴 뒤 그 항목을 닫았다. osv-scanner는 `pnpm audit`과 같은 결과를 냈다.

```bash
osv-scanner scan source --lockfile pnpm-lock.yaml
```

관련 글: [GitHub Actions로 배포하기](/memo/deploy-github-actions), [E2E와 CI를 빠르게](/memo/faster-e2e-ci).

#MacFolio #보안 #의존성 #pnpm #CI
