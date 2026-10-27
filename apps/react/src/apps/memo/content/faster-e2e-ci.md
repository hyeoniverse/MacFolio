---
title: 머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기
date: 2026-10-19
category: 개발 기록/MacFolio/품질
summary: 화면 E2E를 3개에서 6개 샤드로 나눠 PR 시험 시간을 약 절반으로 줄이고, PR에서 이미 통과한 코드와 트리가 같은 main 커밋은 e2e를 다시 실행하지 않고 바로 배포하게 했다. 제외하거나 줄인 시험은 없다.
---

10월 19일 새벽, 파일 업로드 기능을 머지한 뒤 배포 환경에서 확인하려 했지만 사이트가 갱신되지 않았다. Actions를 확인하자 배포 작업이 E2E 완료를 기다리고 있었다. PR 머지부터 실제 사이트 반영까지 약 15분이 걸렸다. 시간을 측정하자 CI의 준비 단계(설치·빌드·브라우저 설치)는 1분 남짓이고, 나머지 8~9분이 화면 E2E였다. 시험 수가 늘어 3개 샤드로는 부족했다. 또한 main에 머지된 커밋은 PR에서 이미 통과한 시험을 처음부터 다시 실행한 뒤에 배포되었다. 이 글은 두 문제를 수정한 [#266](https://github.com/hyeoniverse/MacFolio/pull/266)의 기록이다.

## 배경: 이틀 전에 3개 샤드로 분할

10월 17일까지 화면 E2E는 `check` 작업 안에서 한 번에 실행되었다. 시험이 510개로 늘어 작업 제한 시간 25분에 도달하기 시작해, E2E를 `check`에서 분리하고 3개 샤드[^shard]로 나눠 병렬 실행했다([#187](https://github.com/hyeoniverse/MacFolio/pull/187)에 포함된 커밋 `54ba1961`). 그 시각부터 API 이미지와 사이트 배포는 `check`와 `e2e`를 모두 통과해야 진행된다.

같은 시나리오를 데스크톱(Chromium), iPhone, Android 세 가지 기기 설정(Playwright project)으로 실행한다. 그래서 `test(` 하나가 실행 3회가 되는 경우가 많고, 시험 수가 늘면 실행 시간이 빠르게 증가한다. 현재 `e2e/` 폴더의 `test(` 호출은 486개다.

## 검토한 방법

| 방법                                             | 장점                                 | 단점                                                |
| ------------------------------------------------ | ------------------------------------ | --------------------------------------------------- |
| main에서는 E2E를 건너뛴다                        | 가장 빠르다                          | 두 PR이 연달아 머지되면 합친 결과는 시험되지 않는다 |
| 샤드 수만 늘린다 (3 → 6)                         | 단순하다. PR·main 모두 빨라진다      | main에서 같은 시험을 다시 실행하는 문제는 남는다    |
| **샤드를 늘리고, 같은 트리면 결과를 재사용한다** | 시험은 유지하고 같은 코드만 건너뛴다 | 통과 기록을 저장·조회하는 단계가 추가된다           |

첫 번째 방법은 빠르지만 시험되지 않은 코드가 배포될 수 있다. 세 번째 방법은 "같은 코드"임을 git 트리로 확인할 수 있을 때만 건너뛰므로 그 위험이 없다.

## 6개 샤드로 분할

Playwright의 `--shard`를 3에서 6으로 늘렸다([Playwright 문서: Sharding](https://playwright.dev/docs/test-sharding)). 샤드마다 준비 단계 1분이 추가되어 CI 총 사용 시간은 약간 늘지만, 샤드가 병렬로 실행되므로 대기 시간은 약 절반으로 줄어든다. PR과 main 모두 같은 효과가 있다.

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

PR의 CI는 PR 브랜치를 그 시각의 main에 병합한 코드(머지 미리보기 커밋, `refs/pull/<번호>/merge`)로 시험한다. PR 브랜치가 최신 main 기준이었다면, 실제로 머지한 커밋은 그 코드와 파일 내용이 완전히 같다. git 용어로는 트리 객체(`HEAD^{tree}`)[^tree]가 같다.

그래서 e2e의 각 샤드는 통과하면 `e2e-ok-<트리>-<샤드>`라는 아티팩트를 업로드한다. 내용은 사용하지 않으므로 `.node-version` 파일 하나를 업로드하고, 보관 기간을 7일로 지정했다. 아티팩트 이름 자체가 "이 트리가 이 샤드를 통과했다"는 기록이다.

```bash
tree=$(git rev-parse HEAD^{tree})
for shard in 1 2 3 4 5 6; do
  found=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=e2e-ok-$tree-$shard" --jq '[.artifacts[] | select(.expired | not)] | length')
  if [ "$found" -eq 0 ]; then echo "reuse=false" >> "$GITHUB_OUTPUT"; exit 0; fi
done
echo "reuse=true" >> "$GITHUB_OUTPUT"
```

커밋 해시가 아니라 트리 해시를 사용하는 이유는 다음과 같다.

| 값        | 머지 미리보기 커밋  | 실제 머지 커밋      | 같은가                      |
| --------- | ------------------- | ------------------- | --------------------------- |
| 커밋 해시 | 부모·작성 시각 포함 | 부모·작성 시각 포함 | 다르다 (부모와 시각이 다름) |
| 트리 해시 | 파일 내용만 반영    | 파일 내용만 반영    | 파일이 같으면 같다          |

코드가 같은지 판단하는 값으로는 트리 해시가 적합하다. main에 push가 발생하면 먼저 `e2e-reuse` 작업이 현재 커밋의 트리 해시로 아티팩트 6개를 조회한다.

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

`e2e`가 `e2e-reuse` 결과로 건너뛰어지면, 이를 `needs`로 지정한 후속 작업도 기본 동작으로 건너뛰어진다([GitHub 문서: jobs.<job_id>.needs](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds)). 그래서 `!cancelled()`로 조건을 항상 평가하게 하고, 실제 실행 여부는 위 조건식이 결정한다.

| 상황                                      | `e2e-reuse` 출력 | `e2e`         | `api-image`·`deploy` |
| ----------------------------------------- | ---------------- | ------------- | -------------------- |
| PR                                        | 실행 안 함       | 6개 샤드 실행 | 실행 안 함           |
| main, PR과 트리가 같고 통과 기록 6개 있음 | `reuse=true`     | 건너뜀        | 실행                 |
| main, 통과 기록이 하나라도 없음           | `reuse=false`    | 6개 샤드 실행 | `e2e` 성공 시 실행   |

`api-image`는 위 조건과 함께 API 코드가 바뀐 경우(`api-changes`)에만 실행된다.

제외하거나 줄인 시험은 없다. 같은 코드를 두 번 시험하지 않을 뿐이다.

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

확인: main에 머지한 뒤 Actions 실행 그래프에서 `e2e-reuse`가 통과하고 `e2e` 샤드 6개가 건너뛰어진 상태로 `deploy`가 실행되면 재사용이 동작한 것이다. 되돌리는 방법: `ci.yml`에서 `e2e-reuse`를 `deploy`의 `needs`와 조건에서 제거하면 기존처럼 항상 실행된다. 워크플로는 [.github/workflows/ci.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/ci.yml)에 있다.

## 관련 글

- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [Playwright로 모바일과 애니메이션까지 테스트하기](/memo/playwright-mobile-and-motion)
- [글 한 편 추가했더니 E2E가 깨졌다 - 이미지 끌기 테스트가 흔들린 이유](/memo/flaky-drag-e2e)
- [API 자동 배포 - 이미지는 Actions에서, 서버는 바꿔 끼우기만](/memo/api-auto-deploy)

[^shard]: 전체 시험을 여러 묶음으로 나눠 서로 다른 머신에서 동시에 실행하는 방식. 각 묶음을 샤드라고 한다. GitHub Actions에서는 matrix 작업 하나가 샤드 하나를 실행한다.

[^tree]: git이 디렉터리 구조와 파일 내용을 저장하는 객체. 커밋 객체는 트리 하나와 부모 커밋, 작성자, 시각을 담으므로 파일이 같아도 커밋 해시는 달라질 수 있다. [Pro Git: Git Objects](https://git-scm.com/book/ko/v2/Git%EC%9D%98-%EB%82%B4%EB%B6%80-Git-%EA%B0%9C%EC%B2%B4)

#MacFolio #CI #GitHubActions #Playwright #E2E #배포
