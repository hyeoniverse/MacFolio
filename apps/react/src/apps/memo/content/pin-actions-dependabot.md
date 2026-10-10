---
title: 액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게
date: 2026-10-10
category: 인프라/배포·운영
summary: 워크플로의 `actions/checkout@v7` 같은 태그는 언제든 다른 코드를 가리킬 수 있다. 액션 9개를 커밋 SHA로 고정하고, 워크플로 둘의 토큰 권한을 줄이고, 새 버전과 취약점 수정은 Dependabot이 PR로 가져오게 했다. Dependabot 브랜치 이름은 규칙 검사에서 예외로 둔다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 보안 항목 둘, "GitHub Actions를 태그 대신 커밋 SHA로 고정, `permissions` 최소화"와 "Dependabot으로 업데이트 받기". 고정하면 올리는 일이 생기고, 올리는 일은 Dependabot이 하므로 둘을 같이 했다.

## 태그는 움직인다

워크플로에 `uses: actions/checkout@v7`이라고 적으면 GitHub은 실행할 때마다 `v7` **태그**가 가리키는 커밋을 받아 돈다. 태그는 가지(branch)처럼 옮길 수 있다. 액션 저장소가 새 버전을 내면 `v7`을 그쪽으로 옮기고, 누군가 그 저장소의 쓰기 권한을 얻으면 아무 커밋으로나 옮길 수 있다. 2025년 3월 `tj-actions/changed-files`가 그렇게 바뀌어, 그 액션을 쓰는 수천 저장소의 CI가 비밀 값을 로그에 찍었다. 이 저장소의 CI에는 Cloudflare 토큰과 서버 배포 키가 있다.

## 용어

- **커밋 SHA 고정**: `uses: actions/checkout@3d3c42e5…`처럼 40자리 커밋 해시로 적는 것. 해시는 내용에서 나오므로 같은 해시는 늘 같은 코드다. 뒤에 `# v7.0.1`을 주석으로 적어 사람이 읽게 한다
- **`permissions`**: 워크플로가 받는 `GITHUB_TOKEN`의 권한. 적지 않으면 저장소 설정의 기본값(쓰기일 수 있다)을 받는다. `contents: read`면 코드를 읽기만, `{}`면 아무것도 못 한다
- **Dependabot**: GitHub이 운영하는 봇. 설정 파일(`.github/dependabot.yml`)대로 의존성의 새 버전을 찾아 PR을 연다. 취약점이 알려진 패키지는 일정과 상관없이 바로 PR을 연다(저장소 설정의 "Dependabot security updates")
- **그룹**: Dependabot PR을 묶는 설정. 안 묶으면 패키지마다 PR이 하나씩 와서 월요일마다 열 개가 쌓인다

## 한 것

| 어디                     | 전                   | 후                                               |
| ------------------------ | -------------------- | ------------------------------------------------ |
| `ci.yml` 액션 17곳       | `@v7`, `@v6`, `@v3`… | 커밋 SHA + `# v7.0.1` 주석 (9종)                 |
| `conventions.yml`        | `permissions` 없음   | `contents: read`                                 |
| `uptime.yml`             | `permissions` 없음   | `{}` (curl만 하므로 토큰이 필요 없다)            |
| `.github/dependabot.yml` | 없음                 | npm·github-actions·docker, 월요일 아침, 그룹으로 |

`ci.yml`과 `deploy-api.yml`은 이미 맨 위에 `contents: read`를 두고 이미지 올리기(`packages: write`)·PR 댓글(`pull-requests: write`)만 작업마다 더하고 있었다.

SHA는 `git ls-remote --tags`로 태그가 가리키는 커밋을 읽어 적었다. `pnpm/action-setup@v6`는 `v6`가 v6.0.10을 가리키고 v6.1.0이 따로 있어서, 동작이 바뀌지 않게 v6.0.10으로 적고 올리는 것은 Dependabot에 맡겼다.

## Dependabot 설정에서 생각한 것

- **npm은 작은 업데이트를 한 PR로**: minor·patch는 `minor-and-patch` 그룹 하나. major는 패키지마다 따로 온다. NestJS·Prisma·React의 major는 마이그레이션 문서를 읽어야 해서 아예 빼 두고 손으로 올린다
- **액션은 전부 한 PR로**: 액션 9종이 한 번에 바뀌어도 CI가 통과하면 된다
- **Docker 바탕 이미지**: `node:22-alpine`의 patch는 받고, Node 큰 버전은 `.node-version`과 함께 손으로
- **규칙 검사와의 충돌**: 이 저장소는 PR마다 브랜치 이름·제목·커밋이 `타입/설명`, `타입(범위): 설명` 모양인지 본다(`conventions` 워크플로). Dependabot의 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정해서 바꿀 수 없다. 제목과 커밋은 `commit-message.prefix`로 `chore(deps):`, `ci(deps):`를 붙여 규칙에 맞추고, 브랜치 이름만 `github.actor == 'dependabot[bot]'`일 때 건너뛰게 했다

## 확인

워크플로 YAML 다섯 파일을 파서로 읽어 모양을 보고, SHA 9개가 각 태그의 커밋과 같은지 `ls-remote` 결과와 맞춰 봤다. 이 PR의 CI 자체가 고정한 액션으로 돈 첫 실행이다. Dependabot은 설정 파일이 main에 들어간 뒤 첫 월요일에 돌거나, 저장소의 Insights → Dependency graph → Dependabot에서 바로 돌려 볼 수 있다.

#MacFolio #보안 #CI #GitHubActions #Dependabot
