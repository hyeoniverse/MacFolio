---
title: 하위 의존성 취약점 6건을 overrides로 고치기
date: 2026-10-09
category: 인프라/배포·운영
summary: pnpm audit --prod에서 운영 의존성 취약점 6건(high 3)이 나왔다. 모두 직접 설치한 패키지가 아니라 그 아래의 패키지였다. 위 패키지가 아직 고친 버전을 받지 않아서 pnpm overrides로 하위 패키지만 올리고, CI에 취약점 검사를 넣었다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))을 세우며 `pnpm audit --prod`를 돌려 보니 취약점이 6건 나왔다.

| 심각도   | 패키지                   | 들어온 경로                                | 고친 버전 |
| -------- | ------------------------ | ------------------------------------------ | --------- |
| high     | `deepmerge-ts`           | api › prisma › @prisma/config              | 8.0.0     |
| high     | `mysql2`                 | api › prisma                               | 3.22.0    |
| moderate | `mysql2`                 | api › prisma                               | 3.23.1    |
| high     | `source-map-js`          | react › milkdown › vue 컴파일러            | 1.2.2     |
| low      | `katex`                  | react › milkdown › 수식                    | 0.18.2    |
| low      | `@ai-sdk/provider-utils` | react › Scalar(API 문서 앱) › AI 채팅 위젯 | 4.0.33    |

여섯 개 모두 `package.json`에 직접 적은 패키지가 아니다. 위 패키지(prisma, milkdown, Scalar)는 이미 최신 안정 버전이라, 위 패키지를 올리는 방법으로는 고칠 수 없었다.

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

## CI에서 막기

이번에는 계획을 세우다 우연히 발견했다. 다음에는 CI가 먼저 알려 주도록, 의존성을 설치한 직후에 검사를 넣었다.

```yaml
- name: 의존성 취약점 검사
  run: pnpm audit --prod --audit-level=high
```

`--prod`는 개발 도구(테스트, 빌드 도구)를 빼고 실제로 배포되는 패키지만 본다. `--audit-level=high`라 low·moderate는 실패로 치지 않는다. 낮은 것까지 막으면 고칠 수 없는 취약점 때문에 모든 PR이 멈출 수 있어서다.

#MacFolio #보안 #의존성 #pnpm #CI
