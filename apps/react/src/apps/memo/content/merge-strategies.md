---
title: GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge
date: 2026-10-12
category: 기술 노트/Git
summary: PR의 Merge 단추에는 세 가지 방식이 있다. 같은 PR을 각 방식으로 병합하면 main의 커밋 그래프가 어떻게 달라지는지, 커밋 SHA·머지 커밋·기록의 직선성이 어떻게 바뀌는지 도식으로 정리했다. 선택 기준은 질문 세 개로 요약된다. 커밋 단위가 남을 가치가 있는가, 커밋 SHA를 바깥에서 가리키는가, 브랜치 안에 머지 커밋이 있는가. 팀의 작업 방식에 따라 보통 어느 쪽으로 가는지, 되돌릴 때는 무엇이 달라지는지도 함께 적었다.
---

GitHub PR 페이지의 Merge 단추를 누르면 세 가지 방식 가운데 하나를 고르게 된다. Create a merge commit, Squash and merge, Rebase and merge. 셋 다 "브랜치의 변경을 main에 넣는다"는 결과는 같지만, main의 커밋 기록이 다르게 남는다. 어느 것을 골라야 하는지 물으면 "팀마다 다르다"는 답이 돌아오는데, 무엇이 달라서 다른 답이 나오는지 정리한다.

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

브랜치 커밋을 손대지 않고, main에 부모가 둘인 머지 커밋을 하나 더한다. `git merge --no-ff`와 같다. A·B·C의 SHA가 그대로라 PR에서 본 커밋이 main에도 똑같이 있고, `git log --first-parent main`으로 보면 머지 커밋만 줄지어 PR 단위로 읽힌다. 대신 `git log`를 그냥 보면 두 갈래가 섞여 길어진다.

### Squash and merge

A·B·C의 diff를 합쳐 커밋 S 하나를 만들어 main 끝에 붙인다. 커밋 메시지는 PR 제목과 본문(또는 커밋 메시지들을 이어 붙인 것)에서 만든다. "wip", "fix typo" 같은 중간 커밋이 main에 남지 않아 기록이 깨끗하다. 반대로 PR 안에서 단계마다 뜻이 있던 커밋(예: "컴포넌트 추가" → "호출처 교체" → "CSS 정리")도 하나로 뭉개진다. 브랜치를 지우면 A·B·C는 어디에도 없다.

### Rebase and merge

A·B·C를 M2 뒤에 하나씩 다시 적용해 A'·B'·C'를 만든다. 커밋 단위는 남고 기록은 직선이지만, 다시 만든 커밋이라 SHA가 모두 바뀐다. GitHub가 커미터가 되고 서명은 사라진다. 브랜치 안에 머지 커밋(main을 합친 것)이 있으면 그 머지 커밋은 풀려서 사라지고, 충돌을 해결했던 내용이 다른 커밋에 섞여 들어간다. `git rebase`를 손으로 한 것과 달리 충돌이 나면 GitHub에서 병합할 수 없고 브랜치에서 먼저 풀어야 한다.

## 어느 것을 쓸지 정하는 질문 세 개

![어느 방식을 쓸지 정하는 질문 세 개](./images/merge-strategies-decision.svg '커밋 단위의 가치, SHA 참조, 브랜치 안의 머지 커밋 순으로 묻는다')

1. **PR 안의 커밋 하나하나가 main 기록에 남을 가치가 있는가.** 없으면 Squash. 리뷰 중에 "리뷰 반영", "lint" 같은 커밋이 쌓이는 팀이라면 Squash가 main을 읽기 쉽게 한다. 이 경우 PR 제목이 곧 커밋 제목이므로 제목을 잘 적어야 한다.
2. **커밋 SHA를 바깥에서 가리키는가.** 배포 태그, 스크린샷·파일 주소(`raw.githubusercontent.com/<owner>/<repo>/<sha>/…`), 글이나 PR 본문의 커밋 링크, GPG 서명이 있으면 SHA가 바뀌는 순간 깨진다. 그러면 Create a merge commit이다.
3. **브랜치 안에 머지 커밋이 있는가.** 충돌을 `git merge main`으로 풀었다면 있다. Rebase는 그 머지 커밋을 풀어 헤치므로 Create a merge commit이 맞다. 셋 다 아니면 Rebase가 직선 기록과 커밋 단위를 둘 다 준다.

팀 단위로 보면 보통 이렇게 나뉜다. 오픈소스나 큰 모노레포는 Squash(기여자의 커밋 습관을 통제할 수 없고, 되돌리기가 커밋 하나로 끝난다). 커밋을 정성껏 쪼개는 팀은 Rebase(직선 기록, `git bisect`에 유리). 배포·태그·문서가 SHA에 묶여 있거나 PR 경계를 기록에 남기고 싶은 곳은 Merge commit.

## 되돌릴 때 달라지는 것

병합 뒤 문제가 생겨 PR 하나를 통째로 되돌리는 경우를 보자.

- **Squash**: 커밋 S 하나가 곧 PR이므로 `git revert S`로 끝난다. 가장 단순하다.
- **Rebase**: A'·B'·C' 세 개를 범위로 되돌린다. `git revert C'~3..C'`처럼 적어야 하고, 사이에 다른 PR의 커밋이 끼어 있으면 범위를 잘라 적어야 한다.
- **Merge commit**: `git revert -m 1 M3`처럼 어느 부모를 기준으로 할지(`-m 1`은 main 쪽) 지정해야 한다. 한 번 되돌린 머지 커밋을 다시 넣으려면 revert의 revert가 필요하다는 점도 알아 두어야 한다.

`git bisect`로 문제 커밋을 찾을 때는 반대로 커밋이 잘게 남은 쪽이 유리하다. Rebase가 가장 좋고, Merge commit은 `--first-parent`를 붙이면 PR 단위로 좁힌 뒤 안으로 들어갈 수 있다. Squash는 PR 단위까지만 좁혀진다.

## 팀 유형별로 보면

![팀의 작업 방식에 따라 보통 고르는 병합 방식](./images/merge-strategies-teams.svg '오픈소스·모노레포는 Squash, 커밋을 쪼개는 팀은 Rebase, SHA·PR 경계에 의존하는 곳은 Merge commit')

- **오픈소스, 큰 모노레포 → Squash.** 기여자의 커밋 습관을 통제할 수 없고, 리뷰 반영 커밋이 많이 쌓인다. PR 하나가 커밋 하나가 되어 되돌리기도 단순하다. 대신 PR 제목과 본문이 곧 커밋 메시지이므로 제목 규칙을 엄격히 둔다.
- **커밋을 정성껏 쪼개는 팀 → Rebase.** 커밋마다 빌드가 되고 뜻이 있는 팀이라면 직선 기록과 커밋 단위를 둘 다 얻는다. 브랜치에서 `git merge main`을 쓰지 않고 `git rebase main`으로 따라가는 규칙이 같이 필요하다.
- **배포·태그·문서가 SHA에 묶여 있거나 PR 경계를 기록에 남기고 싶은 곳 → Merge commit.** 배포 이미지 태그를 머지 커밋 SHA로 만들거나, PR 본문과 문서에서 커밋 링크를 쓰거나, 서명된 커밋을 유지해야 하면 SHA가 바뀌지 않는 방식이어야 한다. 충돌을 `git merge main`으로 푸는 팀도 여기에 든다.

어느 쪽이든 한 저장소 안에서는 한 가지로 통일하는 편이 좋다. 섞어 쓰면 기록 모양이 PR마다 달라져 `--first-parent`도 `bisect`도 제대로 쓰기 어렵다.

## 저장소 설정으로 고정하기

GitHub 저장소 설정(Settings → General → Pull Requests)에서 세 방식을 각각 켜고 끌 수 있다. 기본값은 셋 다 켜진 상태라 Merge 단추에서 매번 고르게 되는데, 정한 방식 하나만 남기고 나머지를 끄면 실수로 다른 방식을 고를 일이 없다. 같은 화면의 "Automatically delete head branches"를 켜면 병합 뒤 브랜치 삭제도 자동이 된다. 둘 다 코드가 아니라 저장소 설정이므로 CONTRIBUTING 같은 문서에 적어 두어야 새로 온 사람이 알 수 있다.

#Git #GitHub
