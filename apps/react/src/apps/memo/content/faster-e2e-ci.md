---
title: 머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기
date: 2026-10-19
category: 개발기/MacFolio/인프라
summary: 화면 E2E를 3칸에서 6칸으로 나눠 PR 시험 시간을 반쯤으로 줄이고, PR에서 이미 통과한 코드와 트리가 같은 main 커밋은 e2e를 다시 돌리지 않고 바로 배포하게 했다. 시험을 빼거나 줄인 것은 없다.
---

PR을 머지하고 실제 사이트에 반영되기까지 15분쯤 걸렸다. PR은 [#266](https://github.com/hyeoniverse/MacFolio/pull/266)이다. 시간을 재 보니 CI의 준비(설치·빌드·브라우저)는 1분 남짓이고, 나머지 8~9분이 화면 E2E였다. 시험이 늘면서 3칸으로 나눈 것으로는 모자랐다. 게다가 main에 들어온 커밋은 PR에서 이미 통과한 시험을 처음부터 다시 돌린 뒤에야 배포했다.

## 배경: 이틀 전에 3칸으로 나눴다

이틀 전(10월 17일)까지 화면 E2E는 `check` 작업 안에서 한 번에 돌았다. 시험이 510개로 늘어 작업 한도 25분에 걸리기 시작해서, E2E를 `check`에서 떼어 세 칸으로 나눠 동시에 돌렸다. 그때부터 API 이미지와 사이트 배포는 `check`뿐 아니라 `e2e`도 통과해야 진행한다.

시험 한 벌은 같은 시나리오를 데스크톱(Chromium), iPhone, Android 세 기기 설정으로 돈다. 그래서 `test(` 하나가 실행 세 번이 되는 경우가 많고, 시험 수가 늘면 시간이 금방 는다. 지금 `e2e/` 폴더의 `test(`는 486개다.

## 고를 수 있던 방법

| 방법                                             | 좋은 점                             | 나쁜 점                                                     |
| ------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| main에서는 E2E를 건너뛴다                        | 가장 빠르다                         | 두 PR이 차례로 머지되면, 합친 결과는 아무도 시험하지 않는다 |
| 칸 수만 늘린다 (3 → 6)                           | 간단. PR·main 모두 빨라진다         | main에서 같은 시험을 다시 도는 것은 그대로                  |
| **칸 수를 늘리고, 같은 트리면 결과를 다시 쓴다** | 시험은 그대로, 같은 코드만 건너뛴다 | 통과 기록을 남기고 찾는 단계가 는다                         |

첫째는 빠르지만 위험하다. 셋째는 "같은 코드"를 git 트리로 확인할 수 있을 때만 건너뛰므로, 첫째의 위험이 없다.

## 6칸으로 나누기

Playwright의 `--shard`를 3에서 6으로 늘렸다. 칸마다 준비 1분이 붙어 CI 사용 시간은 조금 늘지만, 칸들이 동시에 돌기 때문에 기다리는 시간은 반쯤으로 준다. PR에서도 main에서도 똑같이 빨라진다.

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4, 5, 6]
# …
- run: pnpm --filter @macfolio/react test:e2e --shard=${{ matrix.shard }}/6
```

`fail-fast: false`는 한 칸이 실패해도 다른 칸을 멈추지 않게 한다. 한 번에 실패한 시험을 모두 봐야 고칠 때 왕복이 준다.

## 같은 코드면 다시 돌리지 않기

PR의 CI는 PR 브랜치를 그때의 main 위에 합친 코드(머지 미리보기)로 시험한다. PR 브랜치가 main 최신 위에 있었다면, 실제로 머지한 커밋은 그 코드와 파일이 하나도 다르지 않다. git으로 말하면 트리(`HEAD^{tree}`)가 같다.

그래서 e2e의 각 칸은 통과하면 `e2e-ok-<트리>-<칸>`이라는 작은 아티팩트를 남긴다. 내용은 중요하지 않아서 `.node-version` 파일 하나를 올리고, 7일 뒤 사라지게 했다. 아티팩트의 이름 자체가 "이 트리가 이 칸을 통과했다"는 기록이다.

```bash
tree=$(git rev-parse HEAD^{tree})
for shard in 1 2 3 4 5 6; do
  found=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=e2e-ok-$tree-$shard" --jq '[.artifacts[] | select(.expired | not)] | length')
  if [ "$found" -eq 0 ]; then echo "reuse=false" >> "$GITHUB_OUTPUT"; exit 0; fi
done
echo "reuse=true" >> "$GITHUB_OUTPUT"
```

커밋 해시가 아니라 트리 해시를 쓰는 이유가 있다. PR의 머지 미리보기 커밋과 실제 머지 커밋은 부모와 시각이 달라 해시가 다르다. 하지만 담긴 파일이 같으면 트리 해시는 같다. "같은 코드인가"를 묻는 데는 트리가 맞는 값이다. main에 push가 오면 먼저 `e2e-reuse` 작업이 지금 커밋의 트리로 이 아티팩트 6개를 찾는다.

- 6개가 다 있으면 같은 코드가 이미 모든 칸을 통과한 것이라 e2e를 건너뛰고 바로 API 이미지와 사이트 배포로 간다.
- 하나라도 없으면(그사이 다른 PR이 먼저 머지되어 코드가 달라졌거나, PR 없이 main에 바로 push했다) 지금처럼 e2e를 다 돌린다.

![e2e 결과를 트리로 다시 쓰는 흐름](./images/faster-e2e-ci-flow.svg 'PR에서 칸마다 남긴 통과 기록을 main의 같은 트리가 찾으면 e2e를 건너뛴다')

배포 작업은 원래 `e2e`가 성공해야 돌았다. 이제는 "e2e가 성공했거나, 건너뛴 이유가 같은 트리의 통과 기록"일 때 돈다. e2e가 건너뛰어진 것만으로는 배포하지 않게, 조건을 `e2e-reuse`의 결과에 묶었다.

```yaml
api-image:
  needs: [check, e2e-reuse, e2e, api-changes]
  if: >-
    !cancelled() && needs.api-changes.outputs.api == 'true' && needs.check.result == 'success' &&
    (needs.e2e.result == 'success' || needs.e2e-reuse.outputs.reuse == 'true')
```

`e2e`가 `e2e-reuse`에 걸려 건너뛰어지면 그 뒤 작업도 기본으로는 건너뛰어진다. 그래서 `!cancelled()`로 늘 평가하게 하고, 실제로 돌지는 위 조건이 정한다.

시험을 빼거나 줄인 것은 없다. 같은 코드를 두 번 시험하지 않을 뿐이다.

![머지 뒤 배포까지: 전에는 e2e를 다시 돌린 뒤 배포, 지금은 같은 트리면 바로 배포](./images/faster-e2e-ci-timeline.svg 'main에 같은 트리가 들어오면 e2e 자리가 통과 기록 찾기로 바뀐다')

## 확인

- 커밋은 파일 2개, +81/−7이다. 바뀐 것은 `ci.yml` 하나(61줄)다.
- 조건은 두 경로로 나뉜다. 트리가 같은 통과 기록 6개가 있으면 `reuse=true`로 e2e를 건너뛰고 배포로 간다. 하나라도 없으면 `reuse=false`로 지금처럼 6칸을 모두 돈다. PR에서는 `e2e-reuse` 자체가 건너뛰어지고(`if: push && main`), `e2e`는 `!cancelled()`로 늘 돈다.
- 배포가 "e2e가 건너뛰어졌다"는 것만으로 진행되지 않는지가 가장 중요했다. 그래서 배포 조건에 `needs.e2e-reuse.outputs.reuse == 'true'`를 직접 적었다.

## 남은 것과 배운 것

- 통과 기록은 7일 동안만 남는다. PR을 열어 두고 일주일 넘게 머지하지 않으면, 머지할 때 다시 돈다. 안전한 쪽으로 틀리는 것이라 그대로 둔다.
- 칸마다 준비(설치·빌드·브라우저) 1분이 그대로 붙는다. 칸을 더 늘리면 기다리는 시간보다 준비 시간이 더 커지는 지점이 온다. 지금은 6칸에서 멈췄다.

배운 것: CI를 빠르게 하는 가장 쉬운 방법은 시험을 빼는 것이지만, 그러면 CI가 지켜 주던 것이 사라진다. "같은 것을 두 번 하지 않는다"는 쪽으로 찾으니 빼는 것 없이 빨라졌다. 그리고 "같은 코드"를 따질 때는 커밋이 아니라 트리를 봐야 한다.

관련 글: [프론트엔드 배포를 GitHub Actions로](/memo/deploy-github-actions), [Playwright로 휴대폰과 움직임 시험하기](/memo/playwright-mobile-and-motion).

#MacFolio #CI #GitHubActions #Playwright #E2E #배포
