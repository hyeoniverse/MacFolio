---
title: GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge
date: 2026-10-12
category: 기술 노트/Git
summary: GitHub의 세 병합 방식이 main의 커밋 그래프·SHA·머지 커밋·되돌리기를 어떻게 바꾸는지 도식으로 정리하고, 고르는 질문 세 개를 MacFolio 저장소(커밋 1,192개, PR 머지 175개)에 대어 왜 Merge commit을 쓰는지 적었다.
---

GitHub PR 페이지의 Merge 버튼을 누르면 세 가지 방식 가운데 하나를 고르게 된다. Create a merge commit, Squash and merge, Rebase and merge. 셋 다 "브랜치의 변경을 main에 넣는다"는 결과는 같지만, main의 커밋 기록이 다르게 남는다. 어느 것이 맞는지는 저장소마다 다르다. 이 글에서는 무엇이 달라서 답이 갈리는지 정리하고, 마지막에 MacFolio 저장소가 왜 Create a merge commit을 쓰는지 실제 숫자로 적는다.

<details id="terms">
<summary>먼저 알아 둘 용어</summary>

글에서 자주 나오는 Git 용어를 먼저 정리한다. 이미 아는 내용이면 건너뛰어도 된다.

| 용어                     | 뜻                                                                                                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 커밋 SHA                 | 커밋마다 붙는 40자리 고유 번호(예: `91ad7da…`). 커밋의 내용·부모·작성자·시각으로 계산되므로, 내용이 같아도 다시 만든 커밋은 SHA가 달라진다. 보통 앞 7자리로 줄여 쓴다.                                                            |
| 부모 커밋                | 어떤 커밋 바로 앞의 커밋. 일반 커밋은 부모가 하나다.                                                                                                                                                                              |
| 머지 커밋                | 부모가 둘인 커밋. 두 갈래의 기록을 하나로 합친 지점을 표시한다. 첫째 부모는 병합을 받은 쪽(main), 둘째 부모는 들어온 쪽(브랜치)이다.                                                                                              |
| diff                     | 두 시점 사이에 바뀐 줄의 목록. "무엇이 바뀌었나"만 담고, 커밋 기록은 담지 않는다.                                                                                                                                                 |
| 작성자·커미터            | 작성자(author)는 변경을 처음 만든 사람, 커미터(committer)는 그 변경을 지금 형태의 커밋으로 만든 사람이다. GitHub가 커밋을 다시 만들면 커미터가 GitHub로 바뀐다.                                                                   |
| GPG 서명                 | 커밋을 만든 사람이 본인임을 암호 키로 증명하는 서명. 서명은 특정 SHA에 걸리므로 커밋을 다시 만들면 사라진다. GitHub에서 "Verified" 표시로 보인다.                                                                                 |
| fast-forward, `--no-ff`  | main이 그사이 바뀌지 않았다면 Git은 머지 커밋 없이 main 포인터만 브랜치 끝으로 옮긴다. 이것이 fast-forward다. `git merge --no-ff`는 이 경우에도 머지 커밋을 꼭 만들라는 옵션이다.                                                 |
| `git log --first-parent` | 기록을 볼 때 머지 커밋의 첫째 부모만 따라가는 옵션. 브랜치 안의 커밋은 건너뛰고 main에 직접 쌓인 커밋(머지 커밋)만 보여 주므로, PR 하나가 한 줄로 보인다.                                                                         |
| `git revert`             | 지정한 커밋의 변경을 반대로 적용하는 새 커밋을 만든다. 기록을 지우지 않고 되돌린다.                                                                                                                                               |
| `git bisect`             | 문제가 생긴 커밋을 이진 탐색으로 찾는 명령. "여기선 정상, 여기선 고장"인 두 지점을 알려 주면 Git이 가운데 커밋을 하나씩 꺼내 주고, 정상인지 고장인지 답하면 범위를 반씩 줄인다. 커밋이 잘게 나뉘어 있을수록 찾은 결과가 정확하다. |

`--first-parent`의 효과는 출력을 비교하면 바로 보인다. 그냥 `git log`는 PR 안의 커밋까지 모두 보여 준다.

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

이 글은 10월 12일 아침 "Rebase and merge와 Create a merge commit은 무엇이 다른가"를 직접 찾아보다가 쓰게 됐다. 처음 초안은 MacFolio 저장소를 기준으로 썼는데, 다른 저장소에서도 읽을 수 있게 일반론으로 고치고 폴더도 새로 만들었다. first-parent, bisect처럼 낯선 용어는 부연 설명을 각주로 달고, 글 앞의 "먼저 알아 둘 용어"는 토글로 접었다. 이 저장소에서도 PR #183이 "This branch cannot be rebased due to conflicts"로 막힌 적이 있어, Rebase 방식의 충돌 이야기는 실제로 겪은 일이다.

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
| 커미터(committer)  | 브랜치 커밋은 원래대로 | GitHub            | GitHub                        |
| GPG 서명           | 유지                   | 사라짐            | 사라짐                        |

### Create a merge commit

브랜치 커밋을 손대지 않고, main에 부모가 둘인 머지 커밋을 하나 더한다. `git merge --no-ff`와 같다.[^no-ff] A·B·C의 SHA가 그대로라 PR에서 본 커밋이 main에도 똑같이 있고, `git log --first-parent main`[^first-parent]으로 보면 머지 커밋만 줄지어 PR 단위로 읽힌다. 대신 `git log`를 그냥 보면 두 갈래가 섞여 길어진다.

### Squash and merge

A·B·C의 diff[^diff]를 합쳐 커밋 S 하나를 만들어 main 끝에 붙인다. 커밋 메시지는 PR 제목과 본문(또는 커밋 메시지들을 이어 붙인 것)에서 만든다. "wip", "fix typo" 같은 중간 커밋이 main에 남지 않아 기록이 깨끗하다. 반대로 PR 안에서 단계마다 뜻이 있던 커밋(예: "컴포넌트 추가" → "호출처 교체" → "CSS 정리")도 하나로 뭉개진다. 브랜치를 지우면 A·B·C는 어디에도 없다.

### Rebase and merge

A·B·C를 M2 뒤에 하나씩 다시 적용해 A'·B'·C'를 만든다. 커밋 단위는 남고 기록은 직선이지만, 다시 만든 커밋이라 SHA가 모두 바뀐다. 커밋을 만든 주체가 GitHub로 바뀌므로 커미터가 GitHub가 되고, 원래 SHA에 걸려 있던 GPG 서명은 사라진다.[^gpg] 브랜치 안에 머지 커밋(main을 합친 것)이 있으면 그 머지 커밋은 풀려서 사라지고, 충돌을 해결했던 내용이 다른 커밋에 섞여 들어간다. `git rebase`를 손으로 한 것과 달리 충돌이 나면 GitHub에서 병합할 수 없고 브랜치에서 먼저 풀어야 한다.

## 어느 것을 쓸지 정하는 질문 세 개

![어느 방식을 쓸지 정하는 질문 세 개](./images/merge-strategies-decision.svg '커밋 단위의 가치, SHA 참조, 브랜치 안의 머지 커밋 순으로 묻는다')

1. **PR 안의 커밋 하나하나가 main 기록에 남을 가치가 있는가.** 없으면 Squash. 리뷰 중에 "리뷰 반영", "lint" 같은 커밋이 쌓이는 팀이라면 Squash가 main을 읽기 쉽게 한다. 이 경우 PR 제목이 곧 커밋 제목이므로 제목을 잘 적어야 한다.
2. **커밋 SHA를 바깥에서 가리키는가.** 배포 태그, 스크린샷·파일 주소(`raw.githubusercontent.com/<owner>/<repo>/<sha>/…`), 글이나 PR 본문의 커밋 링크, GPG 서명이 있으면 SHA가 바뀌는 순간 깨진다. 그러면 Create a merge commit이다.
3. **브랜치 안에 머지 커밋이 있는가.** 충돌을 `git merge main`으로 풀었다면 있다. Rebase는 그 머지 커밋을 풀어 헤치므로 Create a merge commit이 맞다. 셋 다 아니면 Rebase가 직선 기록과 커밋 단위를 둘 다 준다.

팀 단위로 보면 보통 이렇게 나뉜다. 오픈소스나 큰 모노레포[^monorepo]는 Squash(기여자의 커밋 습관을 통제할 수 없고, 되돌리기가 커밋 하나로 끝난다). 커밋을 정성껏 쪼개는 팀은 Rebase(직선 기록이라 `git bisect`로 문제 커밋을 찾기 쉽다). 배포·태그·문서가 SHA에 묶여 있거나 PR 경계를 기록에 남기고 싶은 곳은 Merge commit.

## 되돌릴 때 달라지는 것

병합 뒤 문제가 생겨 PR 하나를 통째로 되돌리는 경우를 보자.

`git revert`는 지정한 커밋의 변경을 반대로 적용하는 새 커밋을 만들어 되돌린다.

- **Squash**: 커밋 S 하나가 곧 PR이므로 `git revert S`로 끝난다. 가장 단순하다.
- **Rebase**: A'·B'·C' 세 개를 범위로 되돌린다. `git revert C'~3..C'`[^range]처럼 적어야 하고, 사이에 다른 PR의 커밋이 끼어 있으면 범위를 잘라 적어야 한다.
- **Merge commit**: `git revert -m 1 M3`처럼 어느 부모를 기준으로 할지 지정해야 한다. 머지 커밋은 부모가 둘이라 "어느 쪽에 비해 바뀐 것을 되돌릴지"가 정해지지 않기 때문이다. `-m 1`은 첫째 부모(main 쪽)를 기준으로 삼아, 브랜치가 가져온 변경 전체를 되돌린다는 뜻이다. 주의할 점이 하나 있다. 되돌린 뒤 같은 브랜치를 고쳐 다시 병합하면, Git은 브랜치의 예전 커밋들이 이미 병합되었다고 보고 그 변경을 다시 넣지 않는다. 이때는 앞서 만든 revert 커밋을 한 번 더 revert해야 한다.[^revert-revert]

`git bisect`[^bisect]로 찾을 때는 반대로 커밋이 잘게 남은 쪽이 유리하다. 찾아낸 커밋이 작을수록 원인이 되는 줄도 금방 보인다. Rebase가 가장 좋고, Merge commit은 `git bisect start --first-parent`로 먼저 어느 PR인지 찾고, 그 PR 안의 커밋으로 다시 좁힐 수 있다. Squash는 PR 하나가 커밋 하나라서 "이 PR이 원인"까지만 알 수 있고, PR이 크면 그 안에서는 직접 찾아야 한다.

## 팀 유형별로 보면

![팀의 작업 방식에 따라 보통 고르는 병합 방식](./images/merge-strategies-teams.svg '오픈소스·모노레포는 Squash, 커밋을 쪼개는 팀은 Rebase, SHA·PR 경계에 의존하는 곳은 Merge commit')

- **오픈소스, 큰 모노레포 → Squash.** 기여자의 커밋 습관을 통제할 수 없고, 리뷰 반영 커밋이 많이 쌓인다. PR 하나가 커밋 하나가 되어 되돌리기도 단순하다. 대신 PR 제목과 본문이 곧 커밋 메시지이므로 제목 규칙을 엄격히 둔다.
- **커밋을 정성껏 쪼개는 팀 → Rebase.** 커밋마다 빌드가 되고 뜻이 있는 팀이라면 직선 기록과 커밋 단위를 둘 다 얻는다. 브랜치에서 `git merge main`을 쓰지 않고 `git rebase main`으로 따라가는 규칙이 같이 필요하다.
- **배포·태그·문서가 SHA에 묶여 있거나 PR 경계를 기록에 남기고 싶은 곳 → Merge commit.** 배포 이미지 태그를 머지 커밋 SHA로 만들거나, PR 본문과 문서에서 커밋 링크를 쓰거나, 서명된 커밋을 유지해야 하면 SHA가 바뀌지 않는 방식이어야 한다. 충돌을 `git merge main`으로 푸는 팀도 여기에 든다.

어느 쪽이든 한 저장소 안에서는 한 가지로 통일하는 편이 좋다. 섞어 쓰면 기록 모양이 PR마다 달라진다. 머지 커밋이 있는 PR과 없는 PR이 섞이면 `--first-parent`로 봐도 PR 단위로 깔끔하게 나뉘지 않고, `bisect`로 찾은 결과도 어떤 때는 PR 전체, 어떤 때는 커밋 하나가 되어 해석이 번거롭다.

## 저장소 설정으로 고정하기

GitHub 저장소 설정(Settings → General → Pull Requests)에서 세 방식을 각각 켜고 끌 수 있다. 기본값은 셋 다 켜진 상태라 Merge 버튼에서 매번 고르게 되는데, 정한 방식 하나만 남기고 나머지를 끄면 실수로 다른 방식을 고를 일이 없다. 같은 화면의 "Automatically delete head branches"를 켜면 병합 뒤 브랜치 삭제도 자동이 된다. 둘 다 코드가 아니라 저장소 설정이므로 CONTRIBUTING 같은 문서에 적어 두어야 새로 온 사람이 알 수 있다.

따라 하는 순서는 이렇다(저장소 관리자 권한 필요).

1. 저장소 Settings → General → Pull Requests로 간다.
2. 쓸 방식 하나만 체크해 두고 나머지 둘은 끈다.
3. "Automatically delete head branches"를 켠다.
4. 확인: 아무 PR을 열면 Merge 버튼 옆 ▾에 고른 방식 하나만 보인다. 되돌리려면 같은 칸을 다시 체크한다.

공식 문서: [About merge methods on GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github), [Managing the automatic deletion of branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-the-automatic-deletion-of-branches).

## MacFolio 저장소에서는

이 저장소는 PR을 모두 Create a merge commit으로 병합했다. Squash로 병합하면 main에 `제목 (#N)` 꼴의 커밋이 남는데, main 쪽 기록에서 그런 커밋은 0개다. 앞의 세 질문에 대어 보면 이유가 숫자로 보인다. 아래는 이 글을 고치는 시점의 `git log`로 센 값이다.

| 센 것                                             | 개수  | 명령                                           |
| ------------------------------------------------- | ----- | ---------------------------------------------- |
| 전체 커밋                                         | 1,192 | `git log --oneline \| wc -l`                   |
| 머지 커밋                                         | 227   | `git log --merges --oneline`                   |
| └ PR을 병합한 머지 커밋 ("Merge pull request #N") | 175   | `--grep='^Merge pull request'`                 |
| └ 브랜치 안에서 main을 합친 머지 커밋             | 34    | `--grep="Merge remote-tracking\|Merge branch"` |
| main 쪽 기록만 (`--first-parent`)                 | 406   | `git log --first-parent --oneline`             |
| └ 그중 PR 없이 main에 바로 올린 커밋              | 233   | `--first-parent --no-merges`                   |

1. **커밋 단위가 남을 가치가 있는가.** PR 하나에 보통 기능 커밋과 문서 커밋이 따로 있다. 예를 들어 [메뉴 막대의 앱 이름](/memo/menu-bar-app-name)을 만든 PR #101은 기능 커밋(`22c65ac97`)과 블로그 글 커밋(`8d795a4be`)이 나뉘어 있다. 이 블로그 글들은 그런 커밋을 짧은 SHA로 직접 가리킨다. Squash로 합치면 이 구분이 사라진다.
2. **SHA를 바깥에서 가리키는가.** 가리킨다. API 서버 이미지 태그는 main 커밋의 SHA로 만든다(`.github/workflows/ci.yml`의 `tag=sha-${GITHUB_SHA::7}`). 서버의 `/health`도 이 값을 돌려주고, CI는 그 커밋과 지금 커밋을 `git diff`로 비교해 API를 다시 배포할지 정한다. 되돌릴 때도 예전 태그(`sha-1a2b3c4`)를 넣는다. 커밋을 다시 만드는 Rebase에서는 PR에서 본 SHA와 main의 SHA가 달라진다.
3. **브랜치 안에 머지 커밋이 있는가.** 34개가 있다. PR이 길어지는 동안 `git merge origin/main`으로 충돌을 풀었기 때문이다. Rebase and merge는 이 머지 커밋을 풀어 헤친다.

세 질문 모두 Create a merge commit 쪽을 가리킨다. 기록이 두 갈래로 섞여 길어지는 단점은 `git log --first-parent`로 거의 지워진다. 1,192줄이 406줄로 줄고, PR마다 "Merge pull request #N" 한 줄로 읽힌다.

## 남은 것·배운 것

- 저장소 설정에서 Squash와 Rebase를 끄지 않았다. 지금까지는 혼자 Merge 버튼을 눌러서 문제가 없었지만, 실수를 막으려면 끄는 편이 낫다.
- 커밋 메시지는 [커밋 규칙을 문서 대신 CI로 지키기](/memo/commit-conventions-ci)에서 정한 형식(`feat(react): …`)을 브랜치 커밋마다 지킨다. Merge commit 방식에서는 브랜치 커밋이 그대로 main에 남기 때문에, Squash 방식보다 개별 커밋 메시지가 더 중요하다.
- 병합 방식은 "기록을 어떻게 읽을 것인가"보다 "무엇이 SHA를 가리키는가"로 정해지는 경우가 많았다. 배포 태그와 글 속 커밋 링크처럼 바깥에서 SHA를 쓰는 곳을 먼저 세어 보면 답이 빨리 나온다.

## 관련 글

- [커밋 규칙을 문서 대신 CI로 지키기](/memo/commit-conventions-ci)
- [프론트엔드 배포를 GitHub Actions로 - 시험을 통과한 커밋만](/memo/deploy-github-actions)
- [액션은 커밋으로 고정하고, 올리는 일은 Dependabot에게](/memo/pin-actions-dependabot)

[^no-ff]: main이 브랜치를 만든 뒤로 바뀌지 않았다면 Git은 머지 커밋 없이 main 포인터만 브랜치 끝으로 옮긴다(fast-forward). `--no-ff`는 이때도 머지 커밋을 꼭 만들라는 옵션이다. GitHub의 Create a merge commit은 늘 이렇게 동작한다.

[^first-parent]: 머지 커밋은 부모가 둘인데, 첫째 부모가 병합을 받은 쪽(main)이다. `--first-parent`는 기록을 거슬러 올라갈 때 첫째 부모만 따라가므로 브랜치 안의 커밋은 건너뛰고 main에 직접 쌓인 머지 커밋만 보인다. 출력 예시는 글 앞쪽의 [먼저 알아 둘 용어](#terms)에 있다.

[^diff]: 두 시점 사이에 바뀐 줄의 목록. "무엇이 바뀌었나"만 담고 누가 어떤 순서로 바꿨는지는 담지 않는다. 그래서 diff를 합쳐 만든 커밋 S에는 A·B·C의 메시지와 순서가 남지 않는다.

[^gpg]: 서명은 특정 SHA에 대한 것이라, 내용이 같아도 SHA가 다른 새 커밋에는 옮겨지지 않는다. GitHub는 자기 키로 새 커밋에 서명하므로 "Verified" 표시는 남지만, 서명한 사람이 원래 작성자가 아니라 GitHub가 된다.

[^monorepo]: 여러 프로젝트(앱, 라이브러리, 서버 등)를 저장소 하나에 모아 관리하는 방식. 기여자와 PR 수가 많아 커밋 습관을 맞추기 어렵다.

[^range]: `C'~3`은 "C'에서 세 커밋 앞"이라는 뜻이고, `X..Y`는 "X 다음부터 Y까지"다. 즉 A'·B'·C' 세 커밋을 가리킨다.

[^bisect]: 정상인 커밋과 고장 난 커밋을 하나씩 알려 주면 Git이 그 사이의 가운데 커밋을 꺼내 준다. 정상인지 고장인지 답할 때마다 범위가 반으로 줄어, 커밋 1,000개 사이에서도 열 번 정도면 원인 커밋 하나에 닿는다.

[^revert-revert]: revert는 변경을 지울 뿐 "브랜치 커밋이 병합되었다"는 기록은 지우지 않는다. 그래서 Git은 다시 병합할 때 예전 커밋들을 이미 들어간 것으로 보고 새로 고친 커밋만 넣는다. revert를 revert하면 예전 변경이 돌아온 뒤 새 커밋이 그 위에 얹힌다.

#Git #GitHub
