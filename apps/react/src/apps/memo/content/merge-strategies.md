---
title: GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge
date: 2026-10-12
category: 기술 노트/Git
summary: GitHub의 세 병합 방식이 main의 커밋 그래프·SHA·커미터·서명과 되돌리기·bisect·blame을 어떻게 바꾸는지 도식과 표로 정리하고, 고르는 질문 세 개, 팀 유형별 선택, 저장소 설정으로 한 방식에 고정하는 절차를 적었다.
---

GitHub PR 페이지의 Merge 버튼을 누르면 세 가지 방식 가운데 하나를 선택한다. Create a merge commit, Squash and merge, Rebase and merge. 셋 다 "브랜치의 변경을 main에 넣는다"는 결과는 같지만, main의 커밋 기록이 다르게 남는다. 어느 것이 맞는지는 저장소마다 다르다. 이 글에서는 무엇이 달라서 답이 갈리는지, 그리고 어떤 질문으로 고르면 되는지 정리한다.

<details id="terms">
<summary>먼저 알아 둘 용어</summary>

글에서 자주 나오는 Git 용어를 먼저 정리한다. 이미 아는 내용이면 건너뛰어도 된다.

| 용어                     | 뜻                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 커밋 SHA                 | 커밋마다 붙는 40자리 고유 번호(예: `91ad7da…`). 커밋의 내용·부모·작성자·시각으로 계산되므로, 내용이 같아도 다시 만든 커밋은 SHA가 달라진다. 보통 앞 7자리로 줄여 쓴다.                                                                    |
| 부모 커밋                | 어떤 커밋 바로 앞의 커밋. 일반 커밋은 부모가 하나다.                                                                                                                                                                                      |
| 머지 커밋                | 부모가 둘인 커밋. 두 갈래의 기록을 하나로 합친 지점을 표시한다. 첫째 부모는 병합을 받은 쪽(main), 둘째 부모는 들어온 쪽(브랜치)이다.                                                                                                      |
| diff                     | 두 시점 사이에 바뀐 줄의 목록. "무엇이 바뀌었나"만 담고, 커밋 기록은 담지 않는다.                                                                                                                                                         |
| 작성자·커미터            | 작성자(author)는 변경을 처음 만든 사람, 커미터(committer)는 그 변경을 지금 형태의 커밋으로 만든 사람이다. GitHub가 커밋을 다시 만들면 커미터와 커밋 시각이 바뀐다.                                                                        |
| GPG 서명                 | 커밋을 만든 사람이 본인임을 암호 키로 증명하는 서명. 서명은 특정 SHA에 걸리므로 커밋을 다시 만들면 사라진다. GitHub에서 "Verified" 표시로 보인다.                                                                                         |
| fast-forward, `--no-ff`  | main이 그사이 바뀌지 않았다면 Git은 머지 커밋 없이 main 포인터만 브랜치 끝으로 옮긴다. 이것이 fast-forward다. `git merge --no-ff`는 이 경우에도 머지 커밋을 꼭 만들라는 옵션이다.                                                         |
| `git log --first-parent` | 기록을 볼 때 머지 커밋의 첫째 부모만 따라가는 옵션. 브랜치 안의 커밋은 건너뛰고 main에 직접 쌓인 커밋(머지 커밋)만 보여 주므로, PR 하나가 한 줄로 보인다.                                                                                 |
| `git revert`             | 지정한 커밋의 변경을 반대로 적용하는 새 커밋을 만든다. 기록을 지우지 않고 되돌린다.                                                                                                                                                       |
| `git bisect`             | 문제가 생긴 커밋을 이진 탐색으로 찾는 명령. "여기선 정상, 여기선 고장"인 두 지점을 알려 주면 Git이 가운데 커밋을 하나씩 체크아웃하고, 정상인지 고장인지 답하면 탐색 범위를 반씩 줄인다. 커밋이 잘게 나뉘어 있을수록 찾은 결과가 정확하다. |

`--first-parent`의 효과는 출력을 비교하면 확인할 수 있다. 옵션 없는 `git log`는 PR 안의 커밋까지 모두 출력한다.

```text
$ git log --oneline main
a1b2c3d Merge pull request #12
9f8e7d6 CSS 정리
8e7d6c5 호출처 교체
7d6c5b4 컴포넌트 추가
4d5e6f7 Merge pull request #11
...
```

`--first-parent`를 붙이면 머지 커밋만 남아 PR 하나가 한 줄이 된다.

```text
$ git log --oneline --first-parent main
a1b2c3d Merge pull request #12
4d5e6f7 Merge pull request #11
1a2b3c4 첫 커밋
```

</details>

## 같은 PR, 세 가지 기록

커밋 A·B·C가 든 feature 브랜치를 main(M1·M2)에 병합한다고 하자.

![같은 PR을 세 방식으로 병합했을 때 main의 기록](./images/merge-strategies-graphs.svg '위부터 병합 전, Create a merge commit, Squash and merge, Rebase and merge')

|                    | Create a merge commit  | Squash and merge  | Rebase and merge              |
| ------------------ | ---------------------- | ----------------- | ----------------------------- |
| main에 생기는 커밋 | A·B·C + 머지 커밋 M3   | 새 커밋 S 하나    | A'·B'·C' (A·B·C의 복제)       |
| 브랜치 커밋 SHA    | 유지                   | main에 없음       | 바뀜                          |
| 머지 커밋          | 있음 (부모 둘: M2, C)  | 없음              | 없음                          |
| 기록 모양          | 갈라졌다 합쳐짐        | 직선              | 직선                          |
| PR 경계            | 머지 커밋이 표시       | 커밋 하나가 곧 PR | 기록에 없음 (PR 페이지에서만) |
| 커미터(committer)  | 브랜치 커밋은 원래대로 | GitHub            | 병합 버튼을 누른 사용자       |
| GPG 서명           | 유지                   | GitHub 서명으로   | 없음 (서명되지 않음)          |

### Create a merge commit

브랜치 커밋을 손대지 않고, main에 부모가 둘인 머지 커밋을 하나 더한다. `git merge --no-ff`와 같다.[^no-ff] A·B·C의 SHA가 그대로라 PR에서 조회한 커밋이 main에도 같은 SHA로 존재하고, `git log --first-parent main`[^first-parent]으로 보면 머지 커밋만 줄지어 PR 단위로 읽힌다. 대신 옵션 없이 `git log`로 조회하면 두 갈래의 커밋이 시각 순으로 섞여 출력이 길어진다.

### Squash and merge

A·B·C의 diff[^diff]를 합쳐 커밋 S 하나를 만들어 main 끝에 붙인다. 커밋 메시지는 PR 제목과 본문(또는 커밋 메시지들을 이어 붙인 것)에서 만든다. "wip", "fix typo" 같은 중간 커밋이 main에 남지 않아, main에는 PR 하나당 커밋 하나만 쌓인다. 반대로 PR 안에서 단계마다 의미가 있던 커밋(예: "컴포넌트 추가" → "호출처 교체" → "CSS 정리")도 하나로 합쳐진다. 브랜치를 삭제하면 A·B·C는 main 기록에서 조회할 수 없고, PR 페이지의 Commits 탭에만 남는다.

### Rebase and merge

A·B·C를 M2 뒤에 하나씩 다시 적용해 A'·B'·C'를 만든다. 커밋 단위는 남고 기록은 직선이지만, 다시 만든 커밋이라 SHA가 모두 바뀐다. 커미터는 병합 버튼을 누른 사용자, 커밋 시각은 병합 시각으로 바뀌고, 원래 SHA에 걸려 있던 GPG 서명은 사라진다.[^gpg] 브랜치 안에 머지 커밋(main을 합친 것)이 있으면 그 머지 커밋은 기록에서 제거되고, 충돌을 해결했던 내용이 앞뒤의 다른 커밋에 섞여 들어간다. 로컬에서 `git rebase`를 실행할 때와 달리 충돌이 발생하면 GitHub에서는 병합할 수 없고, 브랜치에서 먼저 충돌을 해결해야 한다.

## 어느 것을 쓸지 정하는 질문 세 개

![어느 방식을 쓸지 정하는 질문 세 개](./images/merge-strategies-decision.svg '커밋 단위의 가치, SHA 참조, 브랜치 안의 머지 커밋 순으로 묻는다')

1. **PR 안의 커밋 하나하나가 main 기록에 남을 가치가 있는가.** 없으면 Squash. 리뷰 중에 "리뷰 반영", "lint" 같은 커밋이 쌓이는 팀이라면 Squash가 main을 읽기 쉽게 한다. 이 경우 PR 제목이 곧 커밋 제목이므로 제목을 잘 적어야 한다.
2. **커밋 SHA를 바깥에서 가리키는가.** 배포 태그, 스크린샷·파일 주소(`raw.githubusercontent.com/<owner>/<repo>/<sha>/…`), 글이나 PR 본문의 커밋 링크, GPG 서명이 있으면 SHA가 바뀌는 순간 깨진다. 그러면 Create a merge commit이다.
3. **브랜치 안에 머지 커밋이 있는가.** 충돌을 `git merge main`으로 해결했다면 있다. Rebase는 그 머지 커밋을 제거하고 커밋을 일렬로 다시 적용하므로 Create a merge commit이 맞다. 셋 다 아니면 Rebase가 직선 기록과 커밋 단위를 둘 다 준다.

팀 유형별 선택은 아래 '팀 유형별로 보면' 절에 정리했다.

## 되돌릴 때 달라지는 것

병합 뒤 문제가 생겨 PR 하나를 통째로 되돌리는 경우를 비교한다. [`git revert`](https://git-scm.com/docs/git-revert)는 지정한 커밋의 변경을 반대로 적용하는 새 커밋을 만들어 되돌린다. 기록은 삭제하지 않는다.

![세 방식에서 PR 하나를 되돌리는 명령과 생기는 revert 커밋](./images/merge-strategies-revert.svg 'Squash는 커밋 하나, Rebase는 범위, Merge commit은 부모를 지정한다. 아래는 되돌린 브랜치를 다시 병합하는 순서')

- **Squash**: 커밋 S 하나가 곧 PR이므로 `git revert S`로 끝난다. 가장 단순하다.
- **Rebase**: A'·B'·C' 세 개를 범위로 되돌린다. `git revert C'~3..C'`[^range]처럼 적어야 하고, 사이에 다른 PR의 커밋이 끼어 있으면 범위를 잘라 적어야 한다.
- **Merge commit**: `git revert -m 1 M3`처럼 어느 부모를 기준으로 할지 지정해야 한다. 머지 커밋은 부모가 둘이라 "어느 쪽에 비해 바뀐 것을 되돌릴지"가 정해지지 않기 때문이다. `-m 1`은 첫째 부모(main 쪽)를 기준으로 삼아, 브랜치가 가져온 변경 전체를 되돌린다는 뜻이다. 주의할 점이 하나 있다. 되돌린 뒤 같은 브랜치를 고쳐 다시 병합하면, Git은 브랜치의 예전 커밋들이 이미 병합되었다고 보고 그 변경을 다시 넣지 않는다. 이때는 다시 병합하기 전에 앞서 만든 revert 커밋을 한 번 더 revert해야 한다.[^revert-revert]

`git bisect`[^bisect]로 찾을 때는 반대로 커밋이 잘게 남은 쪽이 유리하다. 찾아낸 커밋의 diff가 작을수록 원인이 되는 줄을 찾는 범위도 좁다. Rebase가 가장 좋고, Merge commit은 `git bisect start --first-parent`로 먼저 어느 PR인지 찾고, 그 PR 안의 커밋으로 다시 좁힐 수 있다. Squash는 PR 하나가 커밋 하나라서 "이 PR이 원인"까지만 좁혀지고, PR의 diff가 크면 그 안에서는 직접 찾아야 한다.

## 줄 단위 이력과 PR 찾기

[`git blame`](https://git-scm.com/docs/git-blame)은 파일의 각 줄을 마지막으로 바꾼 커밋을 출력한다. 같은 줄이라도 병합 방식에 따라 blame이 가리키는 커밋과, 그 커밋에서 PR 번호까지 가는 경로가 다르다.

|                              | Create a merge commit                  | Squash and merge               | Rebase and merge                           |
| ---------------------------- | -------------------------------------- | ------------------------------ | ------------------------------------------ |
| blame이 가리키는 커밋        | 원래 커밋 A·B·C 중 하나                | S (PR 전체)                    | A'·B'·C' 중 하나                           |
| 커밋 메시지                  | 브랜치에서 적은 그대로                 | PR 제목 + ` (#N)`              | 브랜치에서 적은 그대로                     |
| 커밋 → PR 번호               | 그 커밋을 포함한 첫 머지 커밋의 메시지 | 메시지 끝의 `(#N)`             | 메시지에 없음. GitHub 커밋 페이지에서 확인 |
| PR 페이지의 SHA와 main의 SHA | 같다                                   | 다르다 (PR 커밋은 main에 없음) | 다르다                                     |

Merge commit 방식에서 커밋 하나가 어느 PR로 들어왔는지는 그 커밋을 포함한 첫 머지 커밋으로 조회한다.

```bash
# 커밋 A를 main에 넣은 머지 커밋: A에서 main까지 이어지는 머지 커밋 중 가장 오래된 것
git log --merges --ancestry-path --oneline A..main | tail -1
# a1b2c3d Merge pull request #12 from owner/feature
```

Squash는 메시지만 조회하면 PR 번호가 나오고, 반대로 PR 안에서 어느 단계에 그 줄이 바뀌었는지는 main 기록으로 알 수 없다. Rebase는 커밋 단위가 남지만 메시지에 PR 번호가 없고 SHA도 PR 페이지와 달라, 커밋에서 PR로 가려면 GitHub 커밋 페이지의 PR 링크를 조회해야 한다.

## 팀 유형별로 보면

![팀의 작업 방식에 따라 보통 고르는 병합 방식](./images/merge-strategies-teams.svg '오픈소스·모노레포는 Squash, 커밋을 쪼개는 팀은 Rebase, SHA·PR 경계에 의존하는 곳은 Merge commit')

- **오픈소스, 큰 모노레포[^monorepo] → Squash.** 기여자의 커밋 습관을 통제할 수 없고, 리뷰 반영 커밋이 많이 쌓인다. PR 하나가 커밋 하나가 되어 되돌리기도 단순하다. 대신 PR 제목과 본문이 곧 커밋 메시지이므로 제목 규칙을 엄격히 둔다.
- **커밋을 정성껏 쪼개는 팀 → Rebase.** 커밋마다 빌드가 되고 뜻이 있는 팀이라면 직선 기록과 커밋 단위를 둘 다 얻는다. 브랜치에서 `git merge main`을 쓰지 않고 `git rebase main`으로 따라가는 규칙이 같이 필요하다.
- **배포·태그·문서가 SHA에 묶여 있거나 PR 경계를 기록에 남기고 싶은 곳 → Merge commit.** 배포 이미지 태그를 머지 커밋 SHA로 만들거나, PR 본문과 문서에서 커밋 링크를 쓰거나, 서명된 커밋을 유지해야 하면 SHA가 바뀌지 않는 방식이어야 한다. 충돌을 `git merge main`으로 푸는 팀도 여기에 든다.

어느 쪽이든 한 저장소 안에서는 한 가지로 통일하는 편이 좋다. 섞어 쓰면 기록 모양이 PR마다 달라진다. 머지 커밋이 있는 PR과 없는 PR이 섞이면 `--first-parent`로 조회해도 PR 단위로 나뉘지 않고(Rebase로 들어온 PR은 커밋이 여러 줄로 출력된다), `bisect`로 찾은 결과도 PR에 따라 PR 전체이거나 커밋 하나가 되어 해석이 번거롭다.

## 저장소 설정으로 고정하기

GitHub 저장소 설정(Settings → General → Pull Requests)에서 세 방식을 각각 켜고 끌 수 있다. 기본값은 셋 다 켜진 상태라 Merge 버튼에서 매번 고르게 되는데, 정한 방식 하나만 남기고 나머지를 끄면 Merge 버튼에 그 방식만 표시된다. 같은 화면의 "Automatically delete head branches"를 켜면 병합 직후 브랜치가 자동으로 삭제된다. 두 값 모두 코드가 아니라 저장소 설정이므로, CONTRIBUTING 같은 문서에 기록해야 새로 참여한 사람이 확인할 수 있다.

따라 하는 순서는 이렇다(저장소 관리자 권한 필요).

1. 저장소 Settings → General → Pull Requests로 이동한다.
2. 사용할 방식 하나만 체크하고 나머지 둘은 체크를 해제한다.
3. "Automatically delete head branches"를 켠다.
4. 확인: 아무 PR을 열면 Merge 버튼 옆 ▾에 고른 방식 하나만 보인다. 되돌리려면 같은 칸을 다시 체크한다.

같은 설정을 [GitHub CLI](https://cli.github.com/manual/gh_repo_edit)로 변경하고 조회할 수도 있다. 아래는 Create a merge commit 하나만 남기는 예다.

```bash
gh repo edit owner/repo --enable-merge-commit --enable-squash-merge=false --enable-rebase-merge=false --delete-branch-on-merge
gh api repos/owner/repo --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge}'
# {"allow_merge_commit":true,"allow_rebase_merge":false,"allow_squash_merge":false,"delete_branch_on_merge":true}
```

<details>
<summary>머지 커밋·Squash 커밋의 기본 메시지 설정</summary>

같은 화면에서 방식마다 기본 커밋 메시지도 정한다. Merge 버튼을 누른 시각에 이 값으로 메시지 칸이 채워지고, 병합하는 사람이 고칠 수 있다. 괄호 안은 [REST API](https://docs.github.com/en/rest/repos/repos#update-a-repository)의 필드 값이다.

| 방식                  | 설정 항목                                        | 제목                                                             | 본문                                 |
| --------------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------ |
| Create a merge commit | Default message (기본값)                         | `Merge pull request #N from owner/branch` (`MERGE_MESSAGE`)      | PR 제목 (`PR_TITLE`)                 |
|                       | Default to pull request title                    | PR 제목 (`PR_TITLE`)                                             | 없음 (`BLANK`)                       |
|                       | Default to pull request title and description    | PR 제목 (`PR_TITLE`)                                             | PR 본문 (`PR_BODY`)                  |
| Squash and merge      | Default message (기본값)                         | 커밋이 하나면 그 메시지, 여럿이면 PR 제목 (`COMMIT_OR_PR_TITLE`) | 커밋 메시지 목록 (`COMMIT_MESSAGES`) |
|                       | Default to pull request title                    | PR 제목 (`PR_TITLE`)                                             | 없음 (`BLANK`)                       |
|                       | Default to pull request title and commit details | PR 제목 (`PR_TITLE`)                                             | 커밋 메시지 목록 (`COMMIT_MESSAGES`) |
|                       | Default to pull request title and description    | PR 제목 (`PR_TITLE`)                                             | PR 본문 (`PR_BODY`)                  |

Squash를 쓰는 저장소는 PR 제목이 곧 main의 커밋 제목이 되므로 "Default to pull request title"을 고르는 경우가 많다. Rebase and merge는 브랜치 커밋의 메시지를 그대로 쓰므로 이 설정이 없다.

</details>

브랜치 규칙으로 방식을 제한할 수도 있다. Ruleset이나 브랜치 보호 규칙에서 **Require linear history**를 켜면 그 브랜치에는 머지 커밋이 들어갈 수 없어, Merge 버튼에서 Create a merge commit을 고를 수 없다. Squash나 Rebase 하나로 정한 저장소라면 이 규칙이 실수로 생기는 머지 커밋까지 막는다.

공식 문서: [About merge methods on GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github), [Configuring commit merging](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-merging-for-pull-requests), [Managing the automatic deletion of branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches), [Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## 정리

- 세 방식은 "변경을 main에 넣는다"는 결과는 같고, main에 남는 기록이 다르다. Merge commit은 커밋과 SHA를 그대로 두고 PR 경계를 머지 커밋으로 남긴다. Squash는 PR 하나를 커밋 하나로 합친다. Rebase는 커밋 단위를 남기되 SHA를 새로 만든다
- 고를 때는 세 가지를 묻는다. 커밋 단위가 남을 가치가 있는가, SHA를 바깥(배포 태그, 문서 속 커밋 링크, 서명)에서 가리키는가, 브랜치 안에 머지 커밋이 있는가
- "기록을 어떻게 읽을 것인가"보다 "무엇이 SHA를 가리키는가"로 답이 정해지는 경우가 많다. 바깥에서 SHA를 참조하는 곳(배포 태그, 문서 속 링크, 서명)의 목록부터 정리하면 빨리 정해진다
- Merge commit 방식에서는 브랜치의 커밋이 그대로 main에 남으므로, Squash 방식보다 커밋 하나하나의 메시지 규칙이 더 중요하다
- 한 저장소 안에서는 한 가지로 통일하고, 저장소 설정에서 나머지 방식을 꺼 두어 실수로 다른 방식을 고르지 않게 한다

## 관련 글

- [main 기록 1,940커밋 집계로 정한 MacFolio의 Merge commit 전략](/memo/macfolio-merge-strategy): 이 글의 기준을 한 저장소의 main 기록에 적용한 사례

## 참고 문서

- Git: [git-merge](https://git-scm.com/docs/git-merge), [git-rebase](https://git-scm.com/docs/git-rebase), [git-revert](https://git-scm.com/docs/git-revert), [git-bisect](https://git-scm.com/docs/git-bisect), [git-log](https://git-scm.com/docs/git-log), [git-blame](https://git-scm.com/docs/git-blame), [Pro Git: Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
- GitHub: [About merge methods on GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github), [Merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request), [Reverting a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/reverting-a-pull-request), [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

[^no-ff]: main이 브랜치를 만든 뒤로 바뀌지 않았다면 Git은 머지 커밋 없이 main 포인터만 브랜치 끝으로 옮긴다(fast-forward). `--no-ff`는 이때도 머지 커밋을 꼭 만들라는 옵션이다. GitHub의 Create a merge commit은 늘 이렇게 동작한다.

[^first-parent]: 머지 커밋은 부모가 둘인데, 첫째 부모가 병합을 받은 쪽(main)이다. `--first-parent`는 기록을 거슬러 올라갈 때 첫째 부모만 따라가므로 브랜치 안의 커밋은 건너뛰고 main에 직접 쌓인 머지 커밋만 보인다. 출력 예시는 글 앞쪽의 [먼저 알아 둘 용어](#terms)에 있다.

[^diff]: 두 시점 사이에 바뀐 줄의 목록. "무엇이 바뀌었나"만 담고 누가 어떤 순서로 바꿨는지는 담지 않는다. 그래서 diff를 합쳐 만든 커밋 S에는 A·B·C의 메시지와 순서가 남지 않는다.

[^gpg]: 서명은 특정 SHA에 대한 것이라, 내용이 같아도 SHA가 다른 새 커밋에는 옮겨지지 않는다. Squash and merge와 머지 커밋은 GitHub가 자기 키로 서명해 "Verified"가 표시되지만, 서명한 주체는 원래 작성자가 아니라 GitHub다. Rebase and merge로 다시 만든 커밋에는 GitHub도 서명하지 않으므로, 서명을 필수로 요구하는 브랜치(Require signed commits)에서는 Rebase and merge를 사용할 수 없다.

[^range]: `C'~3`은 "C'에서 세 커밋 앞"이라는 뜻이고, `X..Y`는 "X 다음부터 Y까지"다. 즉 A'·B'·C' 세 커밋을 가리킨다.

[^revert-revert]: revert는 변경을 지울 뿐 "브랜치 커밋이 병합되었다"는 기록은 지우지 않는다. 그래서 Git은 다시 병합할 때 예전 커밋들을 이미 들어간 것으로 보고 새로 수정한 커밋만 넣는다. revert를 revert하면 예전 변경이 돌아온 뒤 새 커밋이 그 위에 얹힌다.

[^bisect]: 정상인 커밋과 고장 난 커밋을 하나씩 알려 주면 Git이 그 사이의 가운데 커밋을 체크아웃한다. 정상인지 고장인지 답할 때마다 범위가 반으로 줄어, 커밋 1,000개 사이에서도 열 번(2¹⁰ = 1,024) 정도 답하면 원인 커밋 하나로 좁혀진다.

[^monorepo]: 여러 프로젝트(앱, 라이브러리, 서버 등)를 저장소 하나에 모아 관리하는 방식. 기여자와 PR 수가 많아 커밋 습관을 맞추기 어렵다.

#Git #GitHub
