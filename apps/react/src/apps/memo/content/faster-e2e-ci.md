---
title: 머지하고 배포까지 15분에서 5분으로: e2e 6칸과 같은 코드 다시 돌리지 않기
date: 2026-10-19
category: 개발기/MacFolio/인프라
summary: 화면 E2E를 3칸에서 6칸으로 나눠 PR 시험 시간을 반쯤으로 줄이고, PR에서 이미 통과한 코드와 트리가 같은 main 커밋은 e2e를 다시 돌리지 않고 바로 배포하게 했다.
---

PR을 머지하고 실제 사이트에 반영되기까지 15분쯤 걸렸다. 시간을 재 보니 CI의 준비(설치·빌드·브라우저)는 1분 남짓이고, 나머지 8~9분이 화면 E2E였다. 시험이 늘면서 3칸으로 나눈 것으로는 모자랐다. 게다가 main에 들어온 커밋은 PR에서 이미 통과한 시험을 처음부터 다시 돌린 뒤에야 배포했다.

## 6칸으로 나누기

Playwright의 `--shard`를 3에서 6으로 늘렸다. 칸마다 준비 1분이 붙어 CI 사용 시간은 조금 늘지만, 칸들이 동시에 돌기 때문에 기다리는 시간은 반쯤으로 준다. PR에서도 main에서도 똑같이 빨라진다.

## 같은 코드면 다시 돌리지 않기

PR의 CI는 PR 브랜치를 그때의 main 위에 합친 코드(머지 미리보기)로 시험한다. PR 브랜치가 main 최신 위에 있었다면, 실제로 머지한 커밋은 그 코드와 파일이 하나도 다르지 않다. git으로 말하면 트리(`HEAD^{tree}`)가 같다.

그래서 e2e의 각 칸은 통과하면 `e2e-ok-<트리>-<칸>`이라는 작은 아티팩트를 남긴다. main에 push가 오면 먼저 `e2e-reuse` 작업이 지금 커밋의 트리로 이 아티팩트 6개를 찾는다.

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

#MacFolio #CI #GitHubActions #Playwright #E2E #배포
