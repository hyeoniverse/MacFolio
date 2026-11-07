---
title: git 트리 비교로 PR에서 통과한 main 커밋의 E2E 재실행 생략하기
date: 2026-10-19
category: 개발 기록/MacFolio/테스트·보안·성능
series: E2E 시험
seriesOrder: 5
summary: 화면 E2E를 3개에서 6개 샤드로 나눠 PR 시험 시간을 약 절반으로 줄이고, PR에서 이미 통과한 코드와 트리가 같은 main 커밋은 e2e를 다시 실행하지 않고 바로 배포하게 했다. 제외하거나 줄인 시험은 없다.
---

**E2E(End-to-End) 시험**은 실제 브라우저를 띄워 사용자처럼 화면을 클릭하고 결과를 확인하는 시험이다. MacFolio는 [Playwright](https://playwright.dev/)로 "Dock에서 메모 앱을 열고 글을 클릭하면 본문이 표시된다" 같은 시나리오를 실행한다. 함수 하나를 호출하는 단위 시험과 달리 빌드한 사이트 전체를 띄우므로 실행 시간이 길고, 시험 수가 늘어날수록 CI 대기 시간에서 차지하는 비중이 커진다.

10월 19일 새벽, 파일 업로드 기능을 머지한 뒤 배포 환경에서 확인하려 했지만 사이트가 갱신되지 않았다. Actions를 확인하자 배포 작업이 E2E 완료를 기다리고 있었다. PR 머지부터 실제 사이트 반영까지 약 15분이 걸렸다. 시간을 측정하자 CI의 준비 단계(설치·빌드·브라우저 설치)는 1분 남짓이고, ==나머지 8~9분이 화면 E2E==였다. 원인은 두 가지였다.

1. 시험 수가 늘어 3개 샤드로는 부족했다.
2. main에 머지된 커밋은 PR에서 이미 통과한 시험을 처음부터 다시 실행한 뒤에 배포되었다.

두 문제를 [#266](https://github.com/hyeoniverse/MacFolio/pull/266)에서 수정했다.

<details>
<summary>용어 정리</summary>

- **작업(job)**: GitHub Actions 워크플로를 구성하는 실행 단위. 작업마다 새 가상 머신에서 실행되므로, 작업을 나누면 병렬로 실행할 수 있다. `needs:`로 "이 작업은 저 작업이 끝난 뒤 실행"이라는 순서를 지정한다.
- **matrix**: 작업 하나를 변수 값마다 복제해 실행하는 설정. `shard: [1, 2, 3]`이면 같은 작업이 `shard=1`, `2`, `3`으로 세 번 동시에 실행된다.
- **샤드(shard)**<details>

<summary>참고 문헌</summary>

- Playwright 문서, [Sharding](https://playwright.dev/docs/test-sharding), [Projects](https://playwright.dev/docs/test-projects)
- GitHub Docs, [Workflow syntax: jobs.<job_id>.strategy.fail-fast](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategyfail-fast), [jobs.<job_id>.needs](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds)
- GitHub Docs, [Events that trigger workflows: pull_request](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request) (`GITHUB_SHA`가 머지 미리보기 커밋, `GITHUB_REF`가 `refs/pull/<번호>/merge`)
- GitHub Docs, [Storing and sharing data from a workflow](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-what-your-workflow-does/storing-and-sharing-data-from-a-workflow) (아티팩트와 보관 기간)
- GitHub REST API, [List artifacts for a repository](https://docs.github.com/en/rest/actions/artifacts#list-artifacts-for-a-repository)
- Pro Git, [Git의 내부: Git 개체](https://git-scm.com/book/ko/v2/Git%EC%9D%98-%EB%82%B4%EB%B6%80-Git-%EA%B0%9C%EC%B2%B4), [Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)

</details>

<details>
<summary>사진 출처</summary>

- 커밋 객체와 트리, 블롭의 관계: Scott Chacon·Ben Straub, Pro Git 2판, [3.1 Git Branching - Branches in a Nutshell](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell) (원본 [commit-and-tree.png](https://git-scm.com/book/en/v2/images/commit-and-tree.png)), CC BY-NC-SA 3.0

</details>

[^shard]: 전체 시험을 나눈 묶음 하나. Playwright의 `--shard=2/6`은 "시험을 6묶음으로 나눈 것 중 두 번째만 실행"이라는 뜻이다.

- **Playwright project**: 같은 시험을 다른 브라우저·기기 설정으로 실행하는 단위. MacFolio는 데스크톱 Chromium, iPhone, Android 세 project를 사용한다.
- **아티팩트(artifact)**: 워크플로 실행이 끝난 뒤에도 보관되는 파일. 시험 보고서나 빌드 결과를 업로드해 두고, 다른 실행이나 API에서 이름으로 조회할 수 있다. 보관 기간(`retention-days`)이 지나면 만료된다.

</details>

## 배경: 이틀 전에 3개 샤드로 분할

10월 17일까지 화면 E2E는 `check` 작업 안에서 한 번에 실행되었다. 시험이 510개로 늘어 작업 제한 시간 25분에 도달하기 시작해, E2E를 `check`에서 분리하고 3개 샤드로 나눠 병렬 실행했다([#187](https://github.com/hyeoniverse/MacFolio/pull/187)에 포함된 커밋 `54ba1961`). 그 시각부터 API 이미지와 사이트 배포는 `check`와 `e2e`를 모두 통과해야 진행된다.

같은 시나리오를 데스크톱(Chromium), iPhone, Android 세 가지 기기 설정(Playwright project)으로 실행한다. 그래서 `test(` 하나가 실행 3회가 되는 경우가 많고, 시험 수가 늘면 실행 시간이 빠르게 증가한다. 예를 들어 "메모 글을 연다" 시험 하나를 추가하면 CI에서는 데스크톱·iPhone·Android에서 한 번씩, 모두 세 번 실행된다(`mobile*.spec.ts`처럼 휴대폰 전용 파일은 휴대폰 project에서만 실행된다). 현재 `e2e/` 폴더의 `test(` 호출은 486개다.

## 검토한 방법

| 방법                                             | 장점                                 | 단점                                                |
| ------------------------------------------------ | ------------------------------------ | --------------------------------------------------- |
| main에서는 E2E를 건너뛴다                        | 가장 빠르다                          | 두 PR이 연달아 머지되면 합친 결과는 시험되지 않는다 |
| 샤드 수만 늘린다 (3 → 6)                         | 단순하다. PR·main 모두 빨라진다      | main에서 같은 시험을 다시 실행하는 문제는 남는다    |
| **샤드를 늘리고, 같은 트리면 결과를 재사용한다** | 시험은 유지하고 같은 코드만 건너뛴다 | 통과 기록을 저장·조회하는 단계가 추가된다           |

첫 번째 방법은 빠르지만 시험되지 않은 코드가 배포될 수 있다. ==세 번째 방법은 "같은 코드"임을 git 트리로 확인할 수 있을 때만 건너뛰므로== 그 위험이 없다.

## 6개 샤드로 분할

Playwright의 `--shard`를 3에서 6으로 늘렸다([Playwright 문서: Sharding](https://playwright.dev/docs/test-sharding)). 샤드 하나는 독립된 가상 머신에서 실행되므로, 샤드마다 의존성 설치·빌드·브라우저 설치를 각자 수행한다. 이 준비 단계 1분은 샤드 수와 상관없이 고정이고, 시험 실행 부분만 샤드 수에 반비례해 줄어든다.

![샤드 수에 따른 대기 시간](./images/faster-e2e-ci-shards.svg '시험 부분은 샤드를 두 배로 늘리면 약 절반이 되고, 준비 1분은 샤드마다 그대로 붙는다')

그래서 CI 사용 시간 총합(샤드별 실행 시간의 합)은 준비 단계 1분 × 늘어난 샤드 3개만큼 늘지만, 개발자가 기다리는 시간은 가장 늦게 끝나는 샤드가 결정하므로 약 절반으로 줄어든다. PR과 main 모두 같은 효과가 있다.

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4, 5, 6]
# …
- run: pnpm --filter @macfolio/react test:e2e --shard=${{ matrix.shard }}/6
```

`fail-fast: false`는 한 샤드가 실패해도 다른 샤드를 중단하지 않게 한다([GitHub 문서: fail-fast](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategyfail-fast)). 실패한 시험 전체를 한 번에 확인해야 수정·재실행 횟수가 줄어든다.

## 같은 코드면 재실행하지 않기

### git이 커밋과 파일을 저장하는 방식

git은 저장소의 내용을 객체로 저장하고, 객체마다 내용에서 계산한 SHA-1 해시를 이름으로 붙인다. 파일 내용은 블롭(blob), 디렉터리 구조는 트리(tree)[^tree], 변경 이력 한 단계는 커밋(commit) 객체다. 커밋 객체는 트리 하나를 가리키고, 여기에 부모 커밋·작성자·커미터·시각·메시지를 덧붙인다.

![커밋 객체와 트리, 블롭의 관계](./images/faster-e2e-ci-commit-and-tree.png '커밋 98ca9는 트리 92ec2를 가리키고, 트리는 파일 세 개의 블롭을 가리킨다. Pro Git')

해시는 내용에서 계산되므로 두 가지 성질이 생긴다.

- 파일 내용과 디렉터리 구조가 같으면 트리 해시는 언제 만들어도 같다.
- 트리가 같아도 부모나 시각이 다르면 커밋 해시는 달라진다.

`git rev-parse HEAD^{tree}`는 현재 커밋이 가리키는 트리의 해시를 출력한다.

### 머지 미리보기 커밋과 실제 머지 커밋

PR에서 실행하는 CI는 PR 브랜치 자체가 아니라 PR 브랜치를 그 시각의 main에 병합한 코드를 시험한다. GitHub가 PR마다 `refs/pull/<번호>/merge`라는 참조로 이 **머지 미리보기 커밋**을 만들어 두고, `pull_request` 이벤트에서는 `actions/checkout`이 이 커밋을 내려받는다. PR 브랜치가 최신 main 기준이었다면, 나중에 Merge 버튼으로 만든 실제 머지 커밋은 미리보기 커밋과 파일 내용이 완전히 같다. 커밋 해시는 다르지만 트리 해시는 같다.

![머지 미리보기 커밋과 실제 머지 커밋의 해시 비교](./images/faster-e2e-ci-merge-ref.svg '① 미리보기와 ② 실제 머지는 트리가 같아 통과 기록을 재사용한다. 그 사이 main이 바뀌면 ③처럼 트리가 달라져 다시 시험한다')

그래서 e2e의 각 샤드는 통과하면 `e2e-ok-<트리>-<샤드>`라는 아티팩트를 업로드한다. 내용은 사용하지 않으므로 `.node-version` 파일 하나를 업로드하고, 보관 기간을 7일로 지정했다. 아티팩트 이름 자체가 "이 트리가 이 샤드를 통과했다"는 기록이다.

```bash
tree=$(git rev-parse HEAD^{tree})
for shard in 1 2 3 4 5 6; do
  found=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=e2e-ok-$tree-$shard" --jq '[.artifacts[] | select(.expired | not)] | length')
  if [ "$found" -eq 0 ]; then echo "reuse=false" >> "$GITHUB_OUTPUT"; exit 0; fi
done
echo "reuse=true" >> "$GITHUB_OUTPUT"
```

`gh api`는 GitHub REST API를 호출하는 CLI 명령이고, `actions/artifacts?name=…`은 이 저장소에서 이름이 일치하는 아티팩트 목록을 반환한다. `--jq` 식은 그중 만료되지 않은(`expired`가 `false`) 항목 수를 집계한다. 예를 들어 현재 트리가 `a1b2…`이면 `e2e-ok-a1b2…-1`부터 `e2e-ok-a1b2…-6`까지 여섯 이름을 차례로 조회하고, 하나라도 0개면 그 자리에서 `reuse=false`를 출력하고 끝낸다. `$GITHUB_OUTPUT`은 단계의 출력값을 기록하는 파일로, 여기에 쓴 `reuse` 값을 다른 작업이 `needs.e2e-reuse.outputs.reuse`로 읽는다.

커밋 해시가 아니라 트리 해시를 사용하는 이유는 다음과 같다.

| 값        | 머지 미리보기 커밋  | 실제 머지 커밋      | 같은가                      |
| --------- | ------------------- | ------------------- | --------------------------- |
| 커밋 해시 | 부모·작성 시각 포함 | 부모·작성 시각 포함 | 다르다 (부모와 시각이 다름) |
| 트리 해시 | 파일 내용만 반영    | 파일 내용만 반영    | 파일이 같으면 같다          |

==코드가 같은지 판단하는 값으로는 트리 해시가 적합하다.==

### main에서 통과 기록 조회

main에 push가 발생하면 먼저 `e2e-reuse` 작업이 현재 커밋의 트리 해시로 아티팩트 6개를 조회한다.

- 6개가 모두 있으면 같은 코드가 이미 모든 샤드를 통과한 것이므로 e2e를 건너뛰고 API 이미지 빌드와 사이트 배포로 진행한다.
- 하나라도 없으면(그 사이 다른 PR이 먼저 머지되어 코드가 달라졌거나, PR 없이 main에 직접 push한 경우) 기존처럼 e2e 전체를 실행한다.

![e2e 결과를 트리로 다시 쓰는 흐름](./images/faster-e2e-ci-flow.svg 'PR에서 샤드마다 남긴 통과 기록을 main의 같은 트리로 찾으면 e2e를 건너뛴다')

배포 작업은 기존에 `e2e`가 성공해야 실행되었다. 이제는 "e2e가 성공했거나, 같은 트리의 통과 기록으로 e2e를 건너뛴 경우"에 실행된다. e2e가 건너뛰어졌다는 사실만으로는 배포하지 않도록, 조건을 `e2e-reuse`의 출력값에 연결했다.

```yaml
api-image:
  needs: [check, e2e-reuse, e2e, api-changes]
  if: >-
    !cancelled() && needs.api-changes.outputs.api == 'true' && needs.check.result == 'success' &&
    (needs.e2e.result == 'success' || needs.e2e-reuse.outputs.reuse == 'true')
```

> [!WARNING] 건너뛴 작업에 연결된 후속 작업
> `e2e`가 `e2e-reuse` 결과로 건너뛰어지면, 이를 `needs`로 지정한 후속 작업도 기본 동작으로 건너뛰어진다([GitHub 문서: jobs.<job_id>.needs](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds)). 그래서 `!cancelled()`로 조건을 항상 평가하게 하고, 실제 실행 여부는 위 조건식이 결정한다.

| 상황                                      | `e2e-reuse` 출력 | `e2e`         | `api-image`·`deploy` |
| ----------------------------------------- | ---------------- | ------------- | -------------------- |
| PR                                        | 실행 안 함       | 6개 샤드 실행 | 실행 안 함           |
| main, PR과 트리가 같고 통과 기록 6개 있음 | `reuse=true`     | 건너뜀        | 실행                 |
| main, 통과 기록이 하나라도 없음           | `reuse=false`    | 6개 샤드 실행 | `e2e` 성공 시 실행   |

`api-image`는 위 조건과 함께 API 코드가 바뀐 경우(`api-changes`)에만 실행된다.

> [!IMPORTANT] 시험 범위는 그대로
> 제외하거나 줄인 시험은 없다. 같은 코드를 두 번 시험하지 않을 뿐이다.

![머지 뒤 배포까지: 전에는 e2e를 다시 돌린 뒤 배포, 지금은 같은 트리면 바로 배포](./images/faster-e2e-ci-timeline.svg 'main에 같은 트리가 들어오면 e2e 단계가 통과 기록 조회로 대체된다')

## 확인

- 커밋은 파일 2개, +81/−7줄이다. 워크플로 변경은 `ci.yml` 하나(61줄)다.
- 조건은 두 경로로 나뉜다. 트리가 같은 통과 기록 6개가 있으면 `reuse=true`로 e2e를 건너뛰고 배포로 진행한다. 하나라도 없으면 `reuse=false`로 6개 샤드를 모두 실행한다. PR에서는 `e2e-reuse` 자체가 실행되지 않고(`if: push && main`), `e2e`는 `!cancelled()`로 항상 실행된다.
- 가장 중요한 검증 항목은 "e2e가 건너뛰어졌다"는 사실만으로 배포가 진행되지 않는지였다. 그래서 배포 조건에 `needs.e2e-reuse.outputs.reuse == 'true'`를 명시했다.

## 남은 과제와 정리

- 통과 기록의 보관 기간은 7일이다. PR을 7일 넘게 머지하지 않으면 머지 시각에 e2e가 다시 실행된다. 시험을 더 실행하는 방향의 오차이므로 그대로 유지한다.
- 샤드마다 준비 단계(설치·빌드·브라우저 설치) 1분이 고정으로 추가된다. 샤드를 더 늘리면 시험 시간 단축보다 준비 시간 증가가 커지는 지점이 있다. 현재는 6개로 유지한다.

CI를 빠르게 하는 가장 쉬운 방법은 시험을 제외하는 것이지만, 그러면 CI가 검증하던 범위가 줄어든다. 같은 작업의 중복 실행을 없애는 방향으로 접근해 시험을 제외하지 않고 시간을 줄였다. 코드가 같은지 판단할 때는 커밋 해시가 아니라 트리 해시를 비교한다.

## 직접 확인하기

샤드 분할은 Playwright의 `--shard` 옵션이다. 로컬에서 CI의 샤드 하나와 같은 범위를 실행할 수 있다.

```bash
cd apps/react
npx playwright test --shard=1/6     # 6개 샤드 중 첫 번째
npx playwright test --list | tail -1  # 전체 시험 수
```

main에서 재실행하지 않는 조건은 "PR에서 통과한 커밋과 트리가 같은가"다. 비교하는 값은 다음 명령으로 확인한다.

```bash
git rev-parse HEAD^{tree}     # PR 브랜치와 머지된 main 커밋에서 같으면 다시 돌리지 않는다
```

확인: main에 머지한 뒤 Actions 실행 그래프에서 `e2e-reuse`가 통과하고 `e2e` 샤드 6개가 건너뛰어진 상태로 `deploy`가 실행되면 재사용이 동작했다는 뜻이다. 되돌리는 방법: `ci.yml`에서 `e2e-reuse`를 `deploy`의 `needs`와 조건에서 제거하면 기존처럼 항상 실행된다. 워크플로는 [.github/workflows/ci.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/ci.yml)에 있다.

## 관련 글

- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [Playwright 모바일 에뮬레이션과 움직임 줄이기 기본값으로 E2E 안정시키기](/memo/playwright-mobile-and-motion)
- [이미지 로드 전 좌표와 누락된 dragover로 흔들린 끌기 E2E](/memo/flaky-drag-e2e)
- [command= 제한 SSH 키와 GHCR 이미지로 하는 API 자동 배포와 롤백](/memo/api-auto-deploy)

[^shard]: 전체 시험을 여러 묶음으로 나눠 서로 다른 머신에서 동시에 실행하는 방식. 각 묶음을 샤드라고 한다. GitHub Actions에서는 matrix 작업 하나가 샤드 하나를 실행한다.

[^tree]: git이 디렉터리 구조와 파일 내용을 저장하는 객체. 커밋 객체는 트리 하나와 부모 커밋, 작성자, 시각을 담으므로 파일이 같아도 커밋 해시는 달라질 수 있다. [Pro Git: Git Objects](https://git-scm.com/book/ko/v2/Git%EC%9D%98-%EB%82%B4%EB%B6%80-Git-%EA%B0%9C%EC%B2%B4)

#MacFolio #CI #GitHubActions #Playwright #E2E #배포
