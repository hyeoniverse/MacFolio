---
title: 정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기
date: 2026-10-01
category: 개발 기록/MacFolio/품질
summary: 브랜치·커밋·PR 규칙을 기존 커밋 기록에서 추출하고, PR마다 CI가 검사하고 Rulesets로 머지를 차단하게 했다. PR 제목을 통한 스크립트 주입을 피한 방법, 로컬 시험, 그 뒤 커밋 733개가 모두 규칙을 지킨 결과까지 적었다.
---

작업 규칙을 문서로 정리하려고 보니, 문서만으로는 규칙이 지켜지지 않는다는 근거가 저장소에 이미 있었다. 옛 커밋에는 `Chore: npm install`, `STYLE: strong h2`, `REFACTOR`처럼 형식이 제각각인 메시지가 섞여 있다. 그래서 규칙은 문서(`CONTRIBUTING.md`)로 남기고, **준수 여부는 CI가 검사한다.** 규칙, 템플릿, 검사 워크플로(`.github/workflows/conventions.yml`, 지금 64줄)는 PR [#48](https://github.com/hyeoniverse/MacFolio/pull/48)에 함께 들어갔다.

| 방법                                                                   | 장점                          | 단점                                                                       |
| ---------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| 문서만                                                                 | 추가 설정이 없다              | 강제하지 못한다. 옛 커밋이 그 근거다                                       |
| [commitlint](https://commitlint.js.org/) + husky (로컬 커밋 훅[^hook]) | 커밋하는 시점에 차단한다      | 훅을 설치한 환경에서만 실행된다. GitHub 웹에서 만든 커밋은 검사하지 않는다 |
| PR에서 CI가 검사 + 머지 차단 (고른 방법)                               | 어디서 만든 커밋이든 검사한다 | 커밋한 뒤에야 알 수 있다. 수정하려면 커밋 기록을 다시 써야 한다            |

![검사 흐름](./images/commit-conventions-ci-flow.svg 'conventions가 브랜치 이름·PR 제목·커밋을 검사하고, Ruleset이 check와 함께 머지를 차단한다')

## 규칙은 커밋 기록에서 추출했다

새 규칙을 만들면 기존 기록과 어긋난다. 먼저 `main`의 커밋 메시지 접두어별 개수를 집계했다.

```bash
git log --no-merges --format='%s' | sed -E 's/^([a-z]+)(\([^)]*\))?:.*/\1\2/' | sort | uniq -c | sort -rn
```

```text
57 feat
26 fix
10 docs
 9 chore
 8 style
 7 refactor
 7 CHORE: npm install   ← 예전 형식
 5 test
 2 feat(api)
```

최근 커밋은 이미 `타입(범위): 한국어 설명` 형식이었고, 브랜치도 `feat/post-comments`, `fix/mobile-swipe`처럼 `타입/설명`이었다. 이 형식을 그대로 규칙으로 적었다. 타입은 실제로 쓰던 9개(`feat` `fix` `docs` `refactor` `test` `style` `perf` `chore` `ci`)로 제한한다. 형식은 [Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/)와 같다.

## 검사는 정규식 두 줄

```bash
types='feat|fix|docs|refactor|test|style|perf|chore|ci'
message="^($types)(\([a-z0-9-]+\))?!?: .+"
branch="^($types)/[a-z0-9][a-z0-9-]*$"
```

PR이 열리거나 제목이 바뀌거나 새 커밋이 푸시되면(`opened`, `edited`, `synchronize` 이벤트), 브랜치 이름·PR 제목·PR에 포함된 커밋 메시지를 모두 검사한다. 위반 항목은 첫 번째에서 멈추지 않고 전부 수집해 한 번에 출력한다. 하나를 수정하고 다시 실행했을 때 다음 위반이 새로 드러나는 반복을 막기 위해서다.

```text
::error::커밋 메시지가 규칙과 다릅니다: e1b0561 'Chore: npm install' (예: fix(api): …)
```

## PR 제목을 스크립트에 그대로 넣으면

처음에는 이렇게 작성하려고 했다.

```yaml
run: |
  if [[ ! "${{ github.event.pull_request.title }}" =~ $message ]]; then
```

`${{ }}` 표현식은 셸이 실행되기 **전에** 문자열 그대로 치환된다. PR 제목은 PR을 여는 사람이 임의로 정하는 값이다. 제목에 `"; curl …; echo "`를 넣으면 치환 결과가 따옴표를 닫고 새 명령을 시작하는 스크립트가 되어 셸 명령으로 실행된다. GitHub 문서가 경고하는 [스크립트 주입](https://docs.github.com/en/actions/concepts/security/script-injections)이다.

그래서 제목과 브랜치 이름은 **환경 변수로 전달하고**, 스크립트에서는 `"$TITLE"`로 읽는다. 환경 변수의 값은 셸이 파싱한 뒤에 확장되므로 명령으로 해석되지 않는다.

![스크립트 주입과 env 전달 비교](./images/commit-conventions-ci-injection.svg '왼쪽: 표현식이 스크립트 본문에 치환되어 제목이 명령이 된다. 오른쪽: 제목은 환경 변수의 값으로만 전달된다')

```yaml
env:
  BRANCH: ${{ github.head_ref }}
  TITLE: ${{ github.event.pull_request.title }}
run: |
  if [[ ! "$TITLE" =~ $message ]]; then
```

## 머지 커밋과 전체 기록

- PR의 커밋만 조회하려면 `git log base..head`가 필요한데, [`actions/checkout`](https://github.com/actions/checkout)은 기본값으로 마지막 커밋 하나만 내려받는다. `fetch-depth: 0`으로 전체 기록을 내려받는다
- 브랜치에 `main`을 병합하면 `Merge remote-tracking branch 'origin/main' …` 커밋이 생긴다. Git이 자동으로 만드는 메시지라 규칙을 적용할 수 없으므로 [`--no-merges`](https://git-scm.com/docs/git-log#Documentation/git-log.txt---no-merges)로 제외한다

## 스크립트를 로컬에서 시험하기

YAML 안의 셸 스크립트는 푸시해서 실행하기 전에는 검증하기 어렵다. 워크플로 파일에서 `run:` 부분만 추출해 로컬에서 환경 변수를 바꿔 가며 실행했다.

<details><summary>로컬 시험 명령과 출력</summary>

```bash
python3 -c "import yaml; d = yaml.safe_load(open('.github/workflows/conventions.yml')); \
  print(d['jobs']['conventions']['steps'][1]['run'])" > conv.sh

BRANCH=docs/blog-images TITLE='docs: 블로그 글에 스크린샷' BASE_SHA=… HEAD_SHA=… bash conv.sh
# 브랜치, PR 제목, 커밋 메시지 모두 규칙에 맞습니다.

BRANCH=my-branch TITLE='Update stuff' BASE_SHA=<첫 커밋> HEAD_SHA=… bash conv.sh
# ::error::브랜치 이름이 규칙과 다릅니다: 'my-branch'
# ::error::PR 제목이 규칙과 다릅니다: 'Update stuff'
# ::error::커밋 메시지가 규칙과 다릅니다: 1ec7977 'Chore: Update .gitgnore' …
```

</details>

규칙에 맞는 경우와 어긋나는 경우를 모두 로컬에서 실행한 뒤 푸시했고, Actions의 첫 실행부터 통과했다.

## 템플릿도 기록에서

이슈 템플릿도 기존 이슈의 구성(목적 · 작업 체크리스트 · 완료 기준 · 선행 작업)을 그대로 옮겼다. PR 템플릿은 무엇을·왜 / 관련 이슈 / 확인한 것 세 절로 구성했다. "확인한 것"에는 format·lint·test와 함께 **테스트·블로그 글·문서를 함께 수정했는지**를 체크 항목으로 넣었다. 기능을 만들며 막힌 부분을 같은 PR에서 글로 남기는 것도 규칙에 포함한 것이다.

## 머지 버튼까지 차단하기

검사만으로는 강제되지 않는다. CI가 실패해도 GitHub는 결과를 표시할 뿐, **Merge 버튼은 그대로 활성화되어 있다.** 실패한 채로 머지하면 규칙은 다시 문서에만 남는다.

그래서 저장소 설정의 **[Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)**로 `main`에 규칙을 적용했다.

1. Settings → Rules → Rulesets → New branch ruleset
2. Enforcement status: **Active**, 대상: **Include default branch** (`main`)
3. **Require status checks to pass**에 `check`와 `conventions`를 넣는다

이제 두 검사가 모두 성공해야 머지할 수 있다. 검사가 실행 중이거나 실패하면 Merge 버튼이 비활성화되고 "Required statuses must pass before merging"이 표시된다.

- 기존 브랜치 보호 규칙(Branch protection rules) 대신 Rulesets를 썼다. 규칙을 Active/Disabled로 전환하기 쉽고, 이름을 붙인 규칙 하나를 여러 브랜치에 적용할 수 있다
- **Require a pull request before merging**에 승인 수 조건은 넣지 않았다. 혼자 관리하는 저장소에서는 작성자가 자기 PR을 승인할 수 없어서, 조건을 넣으면 어떤 PR도 머지할 수 없다
- 검사 이름은 워크플로 파일의 **job 이름**(`check`, `conventions`)이다. job 이름을 바꾸면 Ruleset의 검사 이름도 함께 바꿔야 한다. 그렇지 않으면 더 이상 실행되지 않는 검사를 계속 기다리며 머지가 막힌다

## 그 뒤 3주

규칙을 도입한 9월 30일까지 `main`에는 머지 커밋을 제외하고 205개 커밋이 있었다. 10월 1일부터 10월 19일까지 733개가 추가됐고, 그중 규칙에 맞지 않는 메시지는 0개다.

![커밋 접두어](./images/commit-conventions-ci-types.svg '옛 형식 49개는 모두 규칙 도입 전의 커밋이다')

접두어별로 보면 `docs`가 181개로 세 번째다. PR 템플릿의 "블로그 글·문서를 함께 수정했는가" 항목이 실제 글 작성으로 이어졌다.

## 남은 것, 배운 것

- 커밋 메시지의 설명이 한국어인지는 검사하지 않는다. 정규식은 `타입(범위): ` 뒤에 문자가 있는지만 확인한다.
- 범위(scope)는 제한하지 않는다. 그래서 `react`처럼 넓은 범위와 `memo`·`finder`처럼 좁은 범위가 섞여 있다.
- 새 규칙을 만드는 것보다 기존 관행을 규칙으로 적는 쪽이 지키기 쉬웠다. 처음 실행한 시각에 최근 커밋이 이미 모두 통과했으므로 작업 방식을 바꿀 필요가 없었다.
- `${{ }}`를 `run:` 안에 그대로 쓰지 않는 규칙은 이 워크플로에만 해당하지 않는다. 이후에 만든 워크플로도 외부 입력 값은 모두 `env:`로 전달한다.

## 따라 하기

이 작업은 9월 30일, 저장소에 브랜치·이슈·커밋 규칙이 문서로 하나도 없다는 것을 확인하고 시작했다([#48](https://github.com/hyeoniverse/MacFolio/pull/48)). 규칙 원문은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md), 검사는 [.github/workflows/conventions.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/conventions.yml)다.

브랜치와 커밋은 다음 형식으로 만든다.

```bash
git switch -c fix/mail-phone-spacing            # <타입>/<영문 소문자-이름>
git commit -m "fix(mail): 휴대폰에서 오류 문구가 목록에 붙지 않게"   # <타입>(범위): 설명
```

타입은 `feat|fix|docs|refactor|test|style|perf|chore|ci` 중 하나다. PR을 열면 `conventions` job이 브랜치 이름·PR 제목·PR의 모든 커밋을 검사하고, 하나라도 어긋나면 실패한다. 같은 PR에 새 커밋을 푸시하면 이전 검사는 취소되고 새 검사만 실행된다. Actions 로그의 "Canceling since a higher priority waiting request for conventions-80 exists"는 이 취소 기록이다.

규칙에 어긋난 커밋 메시지를 수정하는 방법:

```bash
git commit --amend -m "fix(mail): …"        # 마지막 커밋 메시지
git push --force-with-lease
```

마지막 커밋이 아닌 커밋의 메시지는 `git rebase -i`로 수정한다. 머지 버튼 차단은 저장소 설정의 Ruleset이 담당한다(CONTRIBUTING의 '저장소 설정', [GitHub Rulesets 문서](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)).

## 관련 글

- [GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/pin-actions-dependabot)
- [GitHub 병합 방식 세 가지 — Create a merge commit, Squash and merge, Rebase and merge](/memo/merge-strategies)
- [main 커밋 기록 집계로 Merge commit 병합 전략 정하기](/memo/macfolio-merge-strategy): 브랜치 커밋이 main에 그대로 남아 커밋마다 메시지를 검사하는 이유
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [gitleaks 사용자 규칙과 CI 작업으로 저장소 기록 전체의 비밀 값 검사하기](/memo/secret-scanning)

[^hook]: Git 훅은 커밋·푸시 같은 동작 전후에 실행되는 스크립트다. `.git/hooks`는 저장소와 함께 복제되지 않으므로, husky 같은 도구로 각 개발 환경에 설치해야 한다. [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)

#MacFolio #CI #깃
