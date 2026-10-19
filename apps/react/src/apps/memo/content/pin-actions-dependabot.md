---
title: 액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게
date: 2026-10-10
category: 개발기/MacFolio/인프라
summary: 움직일 수 있는 태그(@v7) 대신 액션 9종을 커밋 SHA로 고정하고, 토큰 권한을 줄이고, 새 버전은 Dependabot이 PR로 가져오게 했다. 그 뒤 열흘 동안 Dependabot PR 10개를 병합했고, 규칙 검사의 예외 조건도 한 번 고쳤다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))에는 보안 항목이 둘 있었다. 하나는 "GitHub Actions를 태그 대신 커밋 SHA로 고정하고 `permissions`를 최소로", 다른 하나는 "Dependabot으로 업데이트 받기"다. 고정하면 올리는 일이 생기고, 올리는 일은 Dependabot이 하므로 둘을 같은 커밋(`24c1c47ce`)에서 했다.

## 태그는 움직인다

워크플로에 `uses: actions/checkout@v7`이라고 적으면 GitHub은 실행할 때마다 `v7` **태그**가 가리키는 커밋을 받아 돈다. 태그는 가지(branch)처럼 옮길 수 있다. 액션 저장소가 새 버전을 내면 `v7`을 그쪽으로 옮기고, 누군가 그 저장소의 쓰기 권한을 얻으면 아무 커밋으로나 옮길 수 있다. 2025년 3월 `tj-actions/changed-files`가 그렇게 바뀌어, 그 액션을 쓰는 수천 저장소의 CI가 비밀 값을 로그에 찍었다. 이 저장소의 CI에는 Cloudflare 토큰과 서버 배포 키가 있다.

![태그와 커밋 SHA로 액션을 적었을 때의 차이](./images/pin-actions-dependabot-sha.svg '태그는 옮길 수 있지만 커밋 해시는 늘 같은 코드를 가리킨다')

## 고를 수 있는 방법

| 방법                                      | 좋은 점                                                 | 문제                                               |
| ----------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| 태그 그대로 (`@v7`)                       | 새 버전을 저절로 받는다                                 | 태그를 옮기면 다른 코드가 돈다                     |
| SHA로 고정하고 손으로 올린다              | 안전하다                                                | 올리는 것을 잊는다. 9종을 매번 찾아봐야 한다       |
| SHA로 고정하고 Dependabot이 올린다 (고름) | 안전하고, 올리는 PR이 저절로 온다. CI를 지나야 병합된다 | PR이 주마다 온다. 브랜치 이름이 규칙과 맞지 않는다 |

Renovate처럼 더 세밀한 봇도 있지만, GitHub에 붙어 있고 설정 파일 하나로 끝나는 Dependabot으로 충분했다.

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
- **규칙 검사와의 충돌**: 이 저장소는 PR마다 브랜치 이름·제목·커밋이 `타입/설명`, `타입(범위): 설명` 모양인지 본다(`conventions` 워크플로). Dependabot의 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정해서 바꿀 수 없다. 제목과 커밋은 `commit-message.prefix`로 `chore(deps):`, `ci(deps):`를 붙여 규칙에 맞추고, 브랜치 이름만 `github.actor == 'dependabot[bot]'`일 때 건너뛰게 했다 (뒤에 PR 작성자로 바꿨다. 아래 "그 뒤 열흘" 참고)

![Dependabot PR이 규칙 검사를 지나는 길](./images/pin-actions-dependabot-flow.svg '제목과 커밋은 prefix로 규칙에 맞추고, 브랜치 이름만 PR 작성자로 예외를 둔다')

## 확인

워크플로 YAML 다섯 파일을 파서로 읽어 모양을 보고, SHA 9개가 각 태그의 커밋과 같은지 `ls-remote` 결과와 맞춰 봤다. 이 PR의 CI 자체가 고정한 액션으로 돈 첫 실행이다. Dependabot은 설정 파일이 main에 들어간 뒤 첫 월요일에 돌거나, 저장소의 Insights → Dependency graph → Dependabot에서 바로 돌려 볼 수 있다.

## 그 뒤 열흘

설정이 들어간 날(10월 10일) 바로 돌려 보니 PR이 한꺼번에 왔다. 이 글을 고치는 10월 19일까지 병합한 Dependabot PR은 10개다.

| 날짜  | PR                                                       | 내용                                                                                    |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 10-10 | [#171](https://github.com/hyeoniverse/MacFolio/pull/171) | `ci(deps)`: 액션 4종 (pnpm/action-setup v6.0.10 → v6.1.0, docker 액션 셋 v3·v6 → v4·v7) |
| 10-10 | #172, #173, #174, #175, #176                             | npm minor·patch 묶음, `@types/node`, mermaid, lucide-react, vite                        |
| 10-12 | #214, #216, #217                                         | npm 묶음, vitest 4 → 5, Font Awesome 6 → 7                                              |
| 10-12 | [#215](https://github.com/hyeoniverse/MacFolio/pull/215) | TypeScript 5.9 → 7.0. 그대로는 안 돌아서 손으로 고친 커밋을 더했다                      |
| 10-19 | [#265](https://github.com/hyeoniverse/MacFolio/pull/265) | npm minor·patch 묶음 24개                                                               |

#171은 SHA를 새 버전의 SHA로 바꾸고 주석의 버전도 함께 고쳤다. 액션 4종이 한 PR로 와서 CI가 한 번에 확인했다. 지금 워크플로의 `uses:` 27줄(같은 저장소의 워크플로를 부르는 한 줄 빼고)은 모두 커밋 SHA와 버전 주석으로 적혀 있다.

첫날 PR들을 받아 보며 규칙 검사의 예외 조건도 고쳤다. 처음에는 `github.actor == 'dependabot[bot]'`으로 적었는데, `actor`는 이 실행을 일으킨 사람, 곧 마지막으로 푸시한 사람이다. Dependabot PR에 사람이 고친 커밋을 올리면 예외가 풀려 브랜치 이름 검사에서 실패하게 된다. PR 작성자(`github.event.pull_request.user.login`)로 보게 고쳤다([PR #178](https://github.com/hyeoniverse/MacFolio/pull/178), `1be4522fb`). 이틀 뒤 TypeScript 7 PR(#215)은 그대로는 돌지 않아 손으로 고친 커밋(`603e47c41`)을 올려야 했는데, 이 예외 덕분에 규칙 검사를 그대로 지났다.

## 남은 것·배운 것

- npm major 가운데 NestJS·Prisma·React는 일부러 막아 두었다. 이것들은 Dependabot이 알려 주지 않으므로 따로 챙겨야 한다.
- 액션 SHA 고정은 액션이 안에서 부르는 다른 액션이나 내려받는 도구까지 고정하지는 않는다. 고정은 첫 단계일 뿐이다.
- GitHub Actions의 `actor`는 "이 실행을 일으킨 사람"이지 "PR을 연 사람"이 아니다. 봇 예외를 둘 때는 무엇이 바뀌지 않는 값인지 따져야 한다.
- Dependabot PR에도 CI 전체가 돈다. 화면이 바뀌지 않는 PR에 미리보기를 올리는 것은 CI 시간과 PR 댓글만 늘려서, PR 미리보기 배포는 Dependabot PR에서 건너뛰게 했다(`c8b5c0f8d`).

## 따라 하는 방법

액션 하나를 커밋으로 고정하는 순서다. 태그가 가리키는 커밋을 읽어 `uses:`에 넣고, 사람이 읽을 태그는 주석으로 남긴다.

```bash
git ls-remote https://github.com/actions/checkout 'refs/tags/v7.0.1*'
# 'refs/tags/v7.0.1^{}' 줄이 있으면 그 줄의 SHA가 커밋이다 (없으면 'refs/tags/v7.0.1' 줄)
```

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

그다음 [.github/dependabot.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/dependabot.yml)에 `github-actions` 생태계를 두면 Dependabot이 새 버전의 SHA와 주석을 함께 올리는 PR을 연다. 확인은 저장소의 Insights → Dependency graph → Dependabot에서 마지막 확인 시각을 보거나, `grep -rn "uses:" .github/workflows | grep -v "@[0-9a-f]\{40\}"`가 아무것도 내지 않는 것으로 한다. 되돌리려면 `uses:`를 태그로 바꾸면 되지만 권하지 않는다.

참고 문서: [GitHub Actions 보안 강화(SHA 고정)](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions), [dependabot.yml 옵션](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference).

## 관련 글

- [커밋 규칙을 문서 대신 CI로 지키기](/memo/commit-conventions-ci)
- [GitHub 병합 방식 세 가지](/memo/merge-strategies)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)

#MacFolio #보안 #CI #GitHubActions #Dependabot
