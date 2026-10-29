---
title: main 커밋 기록 집계로 Merge commit 병합 전략 정하기
date: 2026-10-12
category: 개발 기록/MacFolio/품질
summary: MacFolio는 PR을 Create a merge commit으로 병합한다. main 기록 1,940커밋을 집계해 선택 기준 세 가지에 적용하고, Rebase and merge가 섞인 PR 53개의 기록, CONTRIBUTING·conventions 검사·Ruleset으로 적용한 내용과 아직 켜지 않은 저장소 설정을 정리했다.
---

MacFolio 저장소는 PR을 main에 **Create a merge commit**으로 병합한다. CONTRIBUTING의 '머지' 절에 규칙으로 적혀 있고, 2026-10-27 기준 main의 PR 머지 커밋은 297개다. 세 방식의 차이와 고르는 기준은 [GitHub 병합 방식 세 가지](/memo/merge-strategies)에 정리했다. 이 글은 그 기준을 이 저장소의 main 기록에 적용한 결과다.

집계 기준 시각은 2026-10-27, main 끝 커밋은 `5415d51a7`(Merge pull request [#399](https://github.com/hyeoniverse/MacFolio/pull/399))다.

## main 기록 집계

| 집계 항목                                                                                                                                       | 값    | 명령                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| 전체 커밋                                                                                                                                       | 1,940 | `git rev-list --count main`                                   |
| 머지 커밋                                                                                                                                       | 406   | `git rev-list --count --merges main`                          |
| main 쪽 기록 (`--first-parent`)                                                                                                                 | 528   | `git rev-list --count --first-parent main`                    |
| └ PR 머지 커밋 (`Merge pull request #N`)                                                                                                        | 297   | `git rev-list --count --first-parent --merges main`           |
| └ 머지 커밋이 아닌 커밋                                                                                                                         | 231   | `git rev-list --count --first-parent --no-merges main`        |
| 　└ 2024-08-27~2024-12-22 main에 바로 올린 커밋                                                                                                 | 80    | 위 명령에 날짜 조건                                           |
| 　└ [#113](https://github.com/hyeoniverse/MacFolio/pull/113)~[#182](https://github.com/hyeoniverse/MacFolio/pull/182)를 Rebase and merge로 병합 | 151   | 아래 '방식이 섞인 PR 53개' 절                                 |
| 브랜치 안의 머지 커밋                                                                                                                           | 109   | 전체 머지 커밋 406 − first-parent 머지 커밋 297               |
| └ main을 브랜치에 합친 커밋                                                                                                                     | 65    | 메시지 `Merge remote-tracking branch 'origin/main'` 등        |
| Squash 흔적 (`제목 (#N)` 꼴 커밋)                                                                                                               | 0     | `git log --first-parent --no-merges --format=%s \| grep '(#'` |

GitHub에서 base가 main인 병합 PR은 350개다. 297개는 머지 커밋으로, 53개는 Rebase and merge로 들어갔다. Squash and merge로 병합한 PR은 없다.

## 선택 기준 세 가지에 적용

![MacFolio에서 머지 커밋과 브랜치 커밋 SHA에 의존하는 것](./images/macfolio-merge-strategy-anchors.svg '왼쪽 둘은 머지 커밋이 PR 경계를 표시해야, 오른쪽 둘은 브랜치 커밋 SHA가 유지되어야 성립한다')

### 1. 커밋 단위가 남을 가치가 있는가

PR 하나에 기능 커밋과 문서 커밋이 나뉘어 있다. 예를 들어 [#212](https://github.com/hyeoniverse/MacFolio/pull/212)(Modal 컴포넌트 추출)는 커밋 4개로 구성되고, main에 그대로 남아 있다.

```text
$ git log --oneline c069c201d^1..c069c201d^2
0378d6f05 docs(memo): Modal 글 요약에서 '이동'을 빼 휴대폰 메모 E2E의 이동 단추 검색과 겹치지 않게
160590753 docs(ui): Modal 도식의 글자가 상자를 넘지 않게
55589195c docs(ui): Modal 글·문서·도식의 표현을 기술 용어(오버레이·포커스·종료 애니메이션)로
5039684a0 refactor(ui): 가운데 뜨는 창 다섯의 겉(덮개·초점·Esc·바깥 누르기·사라짐)을 shared/ui의 Modal 하나로
```

Squash로 병합했다면 main에는 `refactor(ui): …(#212)` 커밋 하나만 남고, 코드 변경(`5039684a0`)과 문서 수정 3건의 구분이 사라진다. 블로그 글도 이런 커밋을 SHA로 직접 적는다. 글 본문에 백틱으로 적힌 7~10자리 16진수 89개 중 82개가 main의 커밋으로 조회된다(나머지 7개는 `10485760` 같은 숫자나 `dead000` 같은 예시 값).

### 2. 커밋 SHA를 바깥에서 가리키는가

API 배포가 main 커밋 SHA를 기준으로 동작한다. `.github/workflows/ci.yml`의 `api-changes` job이 이미지 태그를 만들고, 서버에서 실행 중인 버전과 비교해 다시 배포할지 정한다.

```bash
echo "tag=sha-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
# 서버의 /health version (sha-커밋 7자리)
deployed=$(curl -fsS --max-time 10 "$VITE_API_URL/health" | jq -r '.version // empty' || true)
commit=${deployed#sha-}
# 실행 중인 커밋과 이번 커밋 사이에 API 쪽 파일이 바뀌었는지
git diff --quiet "$commit" "$GITHUB_SHA" -- apps/api packages/desktop-core packages/contracts …
```

main push에서 `GITHUB_SHA`는 main 끝 커밋이고, Merge commit 방식에서는 그 커밋이 항상 `Merge pull request #N`이다. `5415d51a7`에서 API 이미지를 만들면 태그는 `sha-5415d51`이고, 이 태그는 PR [#399](https://github.com/hyeoniverse/MacFolio/pull/399) 하나에 대응한다. 되돌릴 때는 `deploy-api.yml`을 수동 실행하며 예전 태그(`sha-1a2b3c4` 꼴)를 입력하는데, 태그 → 머지 커밋 → PR 번호가 1:1로 이어져 어느 PR 시점으로 돌아가는지 바로 확인된다.

### 3. 브랜치 안에 머지 커밋이 있는가

있다. 브랜치 작업 중 main을 합친 머지 커밋이 65개다(`Merge remote-tracking branch 'origin/main'` 53개, `Merge branch 'main'` 9개, `chore: main 반영` 3개). Rebase and merge는 이 머지 커밋을 제거하고 커밋을 일렬로 다시 적용하므로, 충돌을 해결한 내용이 앞뒤 커밋에 섞인다.

세 질문 모두 Create a merge commit을 가리킨다. 단점인 긴 `git log`는 `--first-parent`로 1,940줄이 528줄로 줄고, PR마다 한 줄씩 출력된다.

```text
$ git log --oneline --first-parent -3 main
5415d51a7 Merge pull request #399 from hyeoniverse/feat/project-app-toolbar
6ab6fc124 Merge pull request #398 from hyeoniverse/feat/memo-categories-4-levels
0a8b78b31 Merge pull request #397 from hyeoniverse/fix/newpick-links
```

## 방식이 섞인 PR 53개

[#113](https://github.com/hyeoniverse/MacFolio/pull/113)~[#182](https://github.com/hyeoniverse/MacFolio/pull/182) 사이에 main으로 병합된 PR 64개 가운데 53개는 Rebase and merge로 들어갔다. 병합 시각은 2026-10-07 00:45 ~ 10-11 00:44(한국 시각)이고, 나머지 11개(Dependabot PR [#171](https://github.com/hyeoniverse/MacFolio/pull/171)~[#176](https://github.com/hyeoniverse/MacFolio/pull/176) 6개와 [#162](https://github.com/hyeoniverse/MacFolio/pull/162)·[#163](https://github.com/hyeoniverse/MacFolio/pull/163)·[#168](https://github.com/hyeoniverse/MacFolio/pull/168)·[#170](https://github.com/hyeoniverse/MacFolio/pull/170)·[#178](https://github.com/hyeoniverse/MacFolio/pull/178) 5개)는 같은 기간에 머지 커밋으로 병합되었다.

[#182](https://github.com/hyeoniverse/MacFolio/pull/182)가 그 예다.

| 항목                    | PR 페이지              | main                              |
| ----------------------- | ---------------------- | --------------------------------- |
| 커밋                    | 3개                    | 3개, 직선으로 이어짐              |
| 첫 커밋 SHA             | `24c4c4676`            | `7db1f994a`                       |
| 첫 커밋의 커미터 시각   | 2026-10-10 23:45 (KST) | 2026-10-11 00:44 (KST, 병합 시각) |
| GitHub의 병합 커밋 부모 | -                      | 1개 (머지 커밋 아님)              |
| 서명                    | 없음                   | 없음                              |

![#113~#182 중 main에 병합된 PR 64개의 first-parent 기록](./images/macfolio-merge-strategy-mixed.svg '실제로는 162줄, 모두 Merge commit이었다면 PR 하나가 한 줄씩 64줄')

이 구간은 `--first-parent`로 조회해도 PR 단위로 나뉘지 않는다. [#112](https://github.com/hyeoniverse/MacFolio/pull/112)와 [#183](https://github.com/hyeoniverse/MacFolio/pull/183)의 머지 커밋 사이 first-parent 기록은 162줄(머지 커밋 11 + 브랜치 커밋 151)이고, 모두 머지 커밋이었다면 64줄이다. `git log --first-parent --merges`로 PR 목록을 조회하면 이 53개는 출력되지 않는다.

저장소 설정에서 세 방식이 모두 켜져 있어, Merge 버튼에서 고르는 방식이 PR마다 달라질 수 있었다. 문서 규칙은 이 선택을 막지 못한다(아래 '아직 적용하지 않은 것').

## 적용한 것

| 위치                                  | 내용                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `CONTRIBUTING.md` '머지' 절           | "Merge commit으로 머지한다. 브랜치의 커밋이 그대로 main에 남는다"                                                      |
| `.github/workflows/conventions.yml`   | PR의 모든 커밋 메시지를 `<타입>(<범위>): <설명>` 형식으로 검사. 브랜치 커밋이 main에 그대로 남으므로 커밋마다 검사한다 |
| 같은 워크플로의 `git log --no-merges` | Git이 만드는 `Merge remote-tracking branch …` 메시지는 검사에서 제외                                                   |
| `main` Ruleset                        | `check`, `conventions`, `secrets` 세 검사를 필수로 지정. 통과하기 전에는 Merge 버튼이 비활성화                         |
| 머지 커밋 메시지 설정                 | 제목 `Merge pull request #N from …`(`MERGE_MESSAGE`), 본문 PR 제목(`PR_TITLE`). GitHub 기본값 그대로                   |

Squash 방식이라면 PR 제목만 검사하면 되지만, Merge commit 방식에서는 브랜치의 커밋 하나하나가 main 기록이 된다. 커밋 메시지 규칙과 검사는 [정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기](/memo/commit-conventions-ci)에 정리했다.

머지 커밋 본문에는 PR 제목이 들어가므로, `--first-parent`로 조회할 때 PR 번호와 제목이 함께 출력된다.

```text
$ git log -1 --format=%B 5415d51a7
Merge pull request #399 from hyeoniverse/feat/project-app-toolbar

feat(project): 브라우저형 프로젝트 앱에 뒤로·앞으로·새로 고침과 주소창 도구 막대를 둔다
```

## 아직 적용하지 않은 것

2026-10-27에 저장소 설정을 API로 조회한 값이다.

```bash
gh api repos/hyeoniverse/MacFolio --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge}'
# {"allow_merge_commit":true,"allow_rebase_merge":true,"allow_squash_merge":true,"delete_branch_on_merge":false}
```

| 설정                               | 현재 | 규칙과의 차이                                                                          |
| ---------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| Allow squash merging               | 켜짐 | 문서 규칙은 Merge commit 하나. 끄지 않으면 Merge 버튼에서 선택할 수 있다               |
| Allow rebase merging               | 켜짐 | 같음. PR 53개가 실제로 이 방식으로 병합되었다                                          |
| Automatically delete head branches | 꺼짐 | CONTRIBUTING '저장소 설정'은 켜라고 적고 있다. 지금은 PR 페이지의 Delete branch로 삭제 |

세 값을 규칙에 맞추는 명령은 다음과 같다(저장소 관리자 권한 필요).

```bash
gh repo edit hyeoniverse/MacFolio --enable-squash-merge=false --enable-rebase-merge=false --delete-branch-on-merge
```

## 정리

- MacFolio는 Create a merge commit으로 병합한다. 커밋 단위([#212](https://github.com/hyeoniverse/MacFolio/pull/212)의 커밋 4개), SHA 참조(API 이미지 태그 `sha-<7자리>`, 글 속 커밋 SHA 82개), 브랜치 안 머지 커밋(65개) 세 가지가 모두 이 방식을 가리킨다
- `git log --first-parent`로 1,940커밋이 528줄로 줄고, PR 하나가 한 줄로 출력된다
- 문서 규칙만으로는 방식이 고정되지 않았다. 세 방식이 모두 켜진 동안 PR 53개가 Rebase and merge로 들어가, 그 구간의 first-parent 기록은 64줄이 아니라 162줄이다
- 남은 작업은 저장소 설정에서 Squash·Rebase를 끄고 브랜치 자동 삭제를 켜는 것이다

## 관련 글

- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies): 세 방식의 차이와 고르는 기준 (일반론)
- [정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기](/memo/commit-conventions-ci): 브랜치 커밋마다 메시지 형식을 검사하는 conventions 워크플로와 Ruleset
- [배포 자동화 1 - Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions): main push에서 실행되는 배포 흐름
- [보안 점검 9 - GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/pin-actions-dependabot): 머지 커밋으로 병합되는 Dependabot PR
- [메모 편집기 5 - Milkdown 편집기에 <details> 토글 목록과 GFM 각주 노드 추가하기](/memo/memo-editor-toggle-footnote): 병합 방식 글의 용어 토글과 각주를 메모 편집기에서 지원한 과정
- 병합 방식 글을 처음 작성한 날의 기록: [10월 12일 - 세고 나서 뽑은 Modal, TypeScript 7, 글이 만든 기능, 다시 그린 템플릿](/memo/day-1012), PR [#218](https://github.com/hyeoniverse/MacFolio/pull/218)

#MacFolio #Git #GitHub
