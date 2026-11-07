---
title: 정규식 검사 워크플로와 Rulesets로 커밋·PR 규칙을 CI에서 강제하기
date: 2026-10-01
category: 개발 기록/MacFolio/테스트·보안·성능
summary: 브랜치·커밋·PR 규칙을 기존 커밋 기록에서 추출하고, PR마다 CI가 검사하고 Rulesets로 머지를 차단하게 했다. PR 제목을 통한 스크립트 주입을 피한 방법, 로컬 시험, 그 뒤 커밋 733개가 모두 규칙을 지킨 결과까지 적었다.
---

Git 저장소의 커밋 메시지는 변경 이력을 검색하는 기본 단위다. `git log --oneline`은 커밋마다 메시지 첫 줄(제목)을 한 줄씩 출력하므로, 제목이 일정한 형식을 따르면 `git log --oneline | grep '^[0-9a-f]* fix'`처럼 버그 수정만 골라 보거나 접두어별로 집계할 수 있다. 브랜치 이름도 같다. `fix/mail-phone-spacing`처럼 종류와 내용을 담으면 브랜치 목록만으로 작업 내용을 확인할 수 있다.

이런 형식 규칙은 보통 `CONTRIBUTING.md` 같은 문서에 적는다. 문제는 문서가 규칙을 강제하지 못한다는 점이다. MacFolio 저장소에도 그 근거가 남아 있다. 옛 커밋에는 `Chore: npm install`, `STYLE: strong h2`, `REFACTOR`처럼 대소문자와 구성이 제각각인 메시지가 섞여 있다. 그래서 규칙은 문서(`CONTRIBUTING.md`)로 남기고, ==준수 여부는 CI가 검사하게 했다==. 규칙, 템플릿, 검사 워크플로(`.github/workflows/conventions.yml`, 지금 64줄)는 PR [#48](https://github.com/hyeoniverse/MacFolio/pull/48)에 함께 들어갔다.

<details>
<summary>용어 정리</summary>

- **CI(Continuous Integration)**: 코드가 저장소에 올라올 때마다 빌드·시험·검사를 자동으로 실행하는 방식. MacFolio는 GitHub Actions를 사용한다.
- **GitHub Actions 워크플로**: `.github/workflows/*.yml` 파일에 "어떤 이벤트가 발생하면 어떤 명령을 실행할지"를 적은 설정. 워크플로는 하나 이상의 작업(job)으로 구성되고, 작업은 단계(step)의 목록이다.
- **상태 검사(status check)**: 커밋에 붙는 성공·실패 표시. Actions 작업의 결과가 PR 화면과 커밋 목록에 ✓·✕로 표시된다.
- **Conventional Commits**: 커밋 제목을 `<타입>(<범위>): <설명>` 형식으로 쓰자는 공개 명세([conventionalcommits.org](https://www.conventionalcommits.org/ko/v1.0.0/)). `feat`는 기능 추가, `fix`는 버그 수정이다.
- **Rulesets**: GitHub 저장소 설정에서 브랜치에 규칙(필수 상태 검사, 강제 푸시 금지 등)을 거는 기능.

</details>

## 규칙을 강제하는 세 가지 방법

형식 규칙을 지키게 하는 방법은 검사 시점에 따라 나뉜다.

| 방법                                                                   | 장점                          | 단점                                                                       |
| ---------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| 문서만                                                                 | 추가 설정이 없다              | 강제하지 못한다. 옛 커밋이 그 근거다                                       |
| [commitlint](https://commitlint.js.org/) + husky (로컬 커밋 훅[^hook]) | 커밋하는 시점에 차단한다      | 훅을 설치한 환경에서만 실행된다. GitHub 웹에서 만든 커밋은 검사하지 않는다 |
| PR에서 CI가 검사 + 머지 차단 (고른 방법)                               | 어디서 만든 커밋이든 검사한다 | 커밋한 뒤에야 알 수 있다. 수정하려면 커밋 기록을 다시 써야 한다            |

로컬 커밋 훅은 개발자의 PC에서 `git commit`을 실행하는 순간 메시지를 검사한다. 위반을 가장 빨리 알려 주지만, 훅 파일은 `.git/hooks` 디렉터리에 설치되고 이 디렉터리는 저장소를 복제해도 따라오지 않는다. 훅을 설치하지 않은 PC나 GitHub 웹 편집기에서 만든 커밋은 검사 없이 들어온다.

![커밋 훅과 PR CI 검사의 범위 비교](./images/commit-conventions-ci-hook-vs-ci.svg '커밋 훅은 훅을 설치한 PC의 커밋만 검사한다. PR의 conventions 작업은 어디서 만든 커밋이든 push된 커밋을 모두 검사한다')

PR 단계의 CI 검사는 커밋이 GitHub에 올라온 뒤에 실행되므로, 커밋을 만든 위치와 상관없이 같은 규칙을 적용한다. 대신 위반을 발견한 시각에는 이미 커밋이 만들어져 있어 메시지를 고치려면 커밋 기록을 다시 써야 한다(아래 '따라 하기'). 혼자 관리하는 저장소에서는 누락이 없는 쪽이 더 중요하다고 판단해 CI 검사를 골랐다.

![검사 흐름](./images/commit-conventions-ci-flow.svg 'conventions가 브랜치 이름·PR 제목·커밋을 검사하고, Ruleset이 check와 함께 머지를 차단한다')

## 규칙은 커밋 기록에서 추출했다

새 규칙을 만들면 기존 기록과 어긋난다. 먼저 `main`의 커밋 메시지 접두어별 개수를 집계했다. 아래 명령은 머지 커밋을 제외한 커밋 제목에서 `타입(범위):` 부분만 남기고(`sed`), 같은 값끼리 묶어 개수를 출력한다(`sort | uniq -c`).

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

최근 커밋은 이미 `타입(범위): 한국어 설명` 형식이었고, 브랜치도 `feat/post-comments`, `fix/mobile-swipe`처럼 `타입/설명`이었다. 이 형식을 그대로 규칙으로 적었다. 타입은 실제로 쓰던 9개로 제한한다. 타입별 용도와 실제 커밋 예는 다음과 같다.

| 타입       | 용도                             | 실제 커밋 예                                    |
| ---------- | -------------------------------- | ----------------------------------------------- |
| `feat`     | 기능 추가, 화면 변경             | `feat(memo): 본문의 #태그`                      |
| `fix`      | 버그 수정                        | `fix(messages): 대화 머리 블러를 2px로 정한다`  |
| `docs`     | 문서·블로그 글                   | `docs(pr): 콜아웃·수식 캡처`                    |
| `refactor` | 동작을 바꾸지 않는 구조 변경     | `refactor(memo): Memo.css를 구역마다 한 파일로` |
| `test`     | 시험만 추가·수정                 | `test(memo): 읽기 글자 크기 조절 e2e`           |
| `style`    | 코드 서식(들여쓰기, 따옴표)      | `style: prettier`                               |
| `perf`     | 성능 개선                        | `perf(react): 본문 글꼴을 woff2 두 조각으로`    |
| `chore`    | 의존성·설정 등 그 밖의 유지 관리 | `chore(deps): bump vite from 6.2.1 to 8.3.3`    |
| `ci`       | CI 워크플로 변경                 | `ci(deps): bump docker/login-action`            |

형식은 [Conventional Commits](https://www.conventionalcommits.org/ko/v1.0.0/)와 같다. 이 명세는 타입 뒤 괄호 안에 범위(scope)를 쓸 수 있게 하고, 콜론 앞의 `!`로 호환성을 깨는 변경을 표시한다.

## 검사는 정규식 두 줄

```bash
types='feat|fix|docs|refactor|test|style|perf|chore|ci'
message="^($types)(\([a-z0-9-]+\))?!?: .+"
branch="^($types)/[a-z0-9][a-z0-9-]*$"
```

`message`는 커밋 제목과 PR 제목을, `branch`는 브랜치 이름을 검사한다. 각 부분이 어떤 문자열에 대응하는지는 아래 그림과 같다.

![커밋 메시지와 브랜치 이름의 구성 요소](./images/commit-conventions-ci-anatomy.svg '타입은 9개 중 하나, 범위는 선택, 콜론 뒤에 공백과 설명이 와야 한다. 브랜치는 타입/영문 소문자 이름이다')

입력값별 결과는 다음과 같다.

| 입력                                  | 검사 대상 | 결과 | 이유                            |
| ------------------------------------- | --------- | ---- | ------------------------------- |
| `fix(mail): 휴대폰에서 오류 문구가 …` | 커밋 제목 | 통과 | 타입·범위·콜론·설명이 모두 있다 |
| `feat!: 저장 형식 변경` (가상의 예)   | 커밋 제목 | 통과 | 범위 없이 `!`만 쓴 경우도 허용  |
| `Chore: npm install`                  | 커밋 제목 | 실패 | 타입이 대문자로 시작한다        |
| `fix: `                               | 커밋 제목 | 실패 | 콜론 뒤에 설명이 없다(`.+`)     |
| `feat(Memo): …`                       | 커밋 제목 | 실패 | 범위에 대문자를 쓸 수 없다      |
| `fix/mail-phone-spacing`              | 브랜치    | 통과 |                                 |
| `my-branch`                           | 브랜치    | 실패 | `타입/` 접두어가 없다           |
| `feat/Post_Comments`                  | 브랜치    | 실패 | 대문자와 밑줄은 허용하지 않는다 |

워크플로는 PR에서 `opened`(열림), `edited`(제목·본문 수정), `reopened`(다시 열림), `synchronize`(새 커밋 push) 이벤트가 발생할 때마다 실행되고, 브랜치 이름·PR 제목·PR에 포함된 커밋 메시지를 모두 검사한다. 위반 항목은 첫 번째에서 멈추지 않고 전부 수집해 한 번에 출력한다. 하나를 수정하고 다시 실행했을 때 다음 위반이 새로 드러나는 반복을 막기 위해서다.

```text
::error::커밋 메시지가 규칙과 다릅니다: e1b0561 'Chore: npm install' (예: fix(api): …)
```

`::error::`로 시작하는 줄은 GitHub Actions의 워크플로 명령[^workflow-cmd]이다. 로그에 빨간 오류로 표시되고, PR 화면의 검사 요약에도 같은 문구가 나타난다.

Dependabot이 여는 PR은 예외가 하나 있다. 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정하므로, PR 작성자가 `dependabot[bot]`이면 브랜치 이름 검사만 건너뛴다(10월 10일 추가). 제목과 커밋 메시지는 `.github/dependabot.yml`의 `commit-message.prefix`를 `chore(deps)`·`ci(deps)`로 지정해 규칙에 맞춘다.

## PR 제목을 스크립트에 그대로 넣으면

GitHub Actions 워크플로에서는 `${{ github.event.pull_request.title }}` 같은 표현식으로 이벤트 정보를 읽는다. 처음에는 PR 제목을 이렇게 검사하려고 했다.

```yaml
run: |
  if [[ ! "${{ github.event.pull_request.title }}" =~ $message ]]; then
```

> [!CAUTION] 스크립트 주입
> `${{ }}` 표현식은 셸이 실행되기 **전에** 문자열 그대로 치환된다. PR 제목은 PR을 여는 사람이 임의로 정하는 값이다. 제목에 `"; curl …; echo "`를 넣으면 치환 결과가 따옴표를 닫고 새 명령을 시작하는 스크립트가 되어 셸 명령으로 실행된다. GitHub 문서가 경고하는 [스크립트 주입](https://docs.github.com/en/actions/concepts/security/script-injections)이다.

예를 들어 PR 제목이 `x" ]]; echo 주입됨; [[ "`이면, Actions가 셸에 넘기는 스크립트는 다음과 같다.

```bash
if [[ ! "x" ]]; echo 주입됨; [[ "" =~ $message ]]; then
```

제목에 들어 있던 `"`와 `]]`가 원래 조건문을 닫고, `echo 주입됨`이 독립된 명령으로 실행된다. `echo` 자리에 저장소 토큰을 외부로 전송하는 명령을 넣을 수도 있다.

그래서 제목과 브랜치 이름은 **환경 변수로 전달하고**, 스크립트에서는 `"$TITLE"`로 읽는다. ==환경 변수의 값은 셸이 명령을 해석한 뒤에 확장되므로 명령으로 해석되지 않는다==. 같은 제목이 들어와도 `$TITLE`은 `x" ]]; echo 주입됨; [[ "`라는 문자열 하나로 정규식과 비교될 뿐이다.

![스크립트 주입과 env 전달 비교](./images/commit-conventions-ci-injection.svg '왼쪽: 표현식이 스크립트 본문에 치환되어 제목이 명령이 된다. 오른쪽: 제목은 환경 변수의 값으로만 전달된다')

```yaml
env:
  BRANCH: ${{ github.head_ref }}
  TITLE: ${{ github.event.pull_request.title }}
run: |
  if [[ ! "$TITLE" =~ $message ]]; then
```

## 머지 커밋과 전체 기록

PR에 포함된 커밋만 조회하려면 `git log BASE_SHA..HEAD_SHA` 범위를 사용한다. 두 점(`..`) 범위는 "HEAD_SHA에서 닿고 BASE_SHA에서는 닿지 않는 커밋"을 뜻한다. main에서 갈라진 브랜치에 커밋 A, B를 올렸다면 `main..브랜치`는 A와 B만 출력한다. 여기에는 두 가지 처리가 필요했다.

- [`actions/checkout`](https://github.com/actions/checkout)은 기본값(`fetch-depth: 1`)으로 마지막 커밋 하나만 내려받는다. 이 상태에서는 BASE_SHA가 로컬에 없어 범위를 계산할 수 없으므로, `fetch-depth: 0`으로 전체 기록을 내려받는다.
- 브랜치에 `main`을 병합하면 `Merge remote-tracking branch 'origin/main' …` 커밋이 생긴다. Git이 자동으로 만드는 메시지라 규칙을 적용할 수 없으므로 [`--no-merges`](https://git-scm.com/docs/git-log#Documentation/git-log.txt---no-merges)로 제외한다.

## 스크립트를 로컬에서 시험하기

YAML 안의 셸 스크립트는 push해서 실행하기 전에는 검증하기 어렵다. 워크플로 파일에서 `run:` 부분만 추출해 로컬에서 환경 변수를 바꿔 가며 실행했다.

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

두 번째 실행은 BASE_SHA를 저장소의 첫 커밋으로 지정해, 옛 형식 커밋이 모두 범위에 들어오게 했다. 규칙에 맞는 경우와 어긋나는 경우를 모두 로컬에서 실행한 뒤 push했고, Actions의 첫 실행부터 통과했다.

## 템플릿도 기록에서

이슈 템플릿도 기존 이슈의 구성(목적 · 작업 체크리스트 · 완료 기준 · 선행 작업)을 그대로 옮겼다. PR 템플릿은 무엇을·왜 / 관련 이슈 / 확인한 것 세 절로 구성했다. "확인한 것"에는 format·lint·test와 함께 **테스트·블로그 글·문서를 함께 수정했는지**를 체크 항목으로 넣었다. 기능을 만들며 막힌 부분을 같은 PR에서 글로 남기는 것도 규칙에 포함했다.

## 머지 버튼까지 차단하기

검사만으로는 강제되지 않는다. CI가 실패해도 GitHub는 결과를 표시할 뿐, **Merge 버튼은 그대로 활성화되어 있다.** ==실패한 채로 머지하면 규칙은 다시 문서에만 남는다==.

![커밋 목록의 상태 검사 표시](./images/commit-conventions-ci-commit-statuses.png '커밋마다 검사 결과가 ✓(성공)·✕(실패)로 붙는다. 표시만 할 뿐 머지를 막지는 않는다. GitHub Docs')

상태 검사는 커밋 단위로 붙는다. 위 그림처럼 PR의 커밋 목록에서 각 커밋 오른쪽에 ✓·✕가 표시되고, PR 화면 아래쪽 머지 영역에도 검사별 결과가 나열된다. 이 표시를 머지 조건으로 바꾸는 설정이 "필수 상태 검사(required status checks)"다.

![저장소 설정의 Rules → Rulesets 메뉴](./images/commit-conventions-ci-rulesets-menu.png#float-right '저장소 Settings 왼쪽 메뉴의 Code and automation → Rules → Rulesets. GitHub Docs')

저장소 설정의 **[Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)**로 `main`에 규칙을 적용했다. Ruleset은 "어느 브랜치에(대상), 어떤 규칙을(규칙 목록), 켤지 끌지(Enforcement status)"를 하나의 이름 아래 묶은 설정이다.

1. Settings → Rules → Rulesets → New branch ruleset
2. Enforcement status: **Active**, 대상: **Include default branch** (`main`)
3. **Require status checks to pass**에 `check`와 `conventions`를 넣는다

이제 두 검사가 모두 성공해야 머지할 수 있다. 검사가 실행 중이거나 실패하면 Merge 버튼이 비활성화되고 "Required statuses must pass before merging"이 표시된다.

- 기존 브랜치 보호 규칙(Branch protection rules) 대신 Rulesets를 썼다. 규칙을 Active/Disabled로 전환하기 쉽고, 이름을 붙인 규칙 하나를 여러 브랜치에 적용할 수 있다.
- **Require a pull request before merging**에 승인 수 조건은 넣지 않았다. 혼자 관리하는 저장소에서는 작성자가 자기 PR을 승인할 수 없어서, 조건을 넣으면 어떤 PR도 머지할 수 없다.
- 검사 이름은 워크플로 파일의 **job 이름**(`check`, `conventions`)이다. job 이름을 바꾸면 Ruleset의 검사 이름도 함께 바꿔야 한다. 그렇지 않으면 더 이상 실행되지 않는 검사를 계속 기다리며 머지가 막힌다.

## 그 뒤 3주

규칙을 도입한 9월 30일까지 `main`에는 머지 커밋을 제외하고 205개 커밋이 있었다. 10월 1일부터 10월 19일까지 733개가 추가됐고, 그중 규칙에 맞지 않는 메시지는 0개다.

![커밋 접두어](./images/commit-conventions-ci-types.svg '옛 형식 49개는 모두 규칙 도입 전의 커밋이다')

접두어별로 보면 `docs`가 181개로 세 번째다. PR 템플릿의 "블로그 글·문서를 함께 수정했는가" 항목이 실제 글 작성으로 이어졌다.

## 남은 과제와 정리

- 커밋 메시지의 설명이 한국어인지는 검사하지 않는다. 정규식은 `타입(범위): ` 뒤에 문자가 있는지만 확인한다.
- 범위(scope)는 제한하지 않는다. 그래서 `react`처럼 넓은 범위와 `memo`·`finder`처럼 좁은 범위가 섞여 있다.
- ==새 규칙을 만드는 것보다 기존 관행을 규칙으로 적는 쪽이 지키기 쉬웠다==. 처음 실행한 시각에 최근 커밋이 이미 모두 통과했으므로 작업 방식을 바꿀 필요가 없었다.
- `${{ }}`를 `run:` 안에 그대로 쓰지 않는 규칙은 이 워크플로에만 해당하지 않는다. 이후에 만든 워크플로도 외부 입력 값은 모두 `env:`로 전달한다.

## 따라 하기

규칙 원문은 [CONTRIBUTING.md](https://github.com/hyeoniverse/MacFolio/blob/main/CONTRIBUTING.md), 검사는 [.github/workflows/conventions.yml](https://github.com/hyeoniverse/MacFolio/blob/main/.github/workflows/conventions.yml)다. 브랜치와 커밋은 다음 형식으로 만든다.

```bash
git switch -c fix/mail-phone-spacing            # <타입>/<영문 소문자-이름>
git commit -m "fix(mail): 휴대폰에서 오류 문구가 목록에 붙지 않게"   # <타입>(범위): 설명
```

타입은 `feat|fix|docs|refactor|test|style|perf|chore|ci` 중 하나다. PR을 열면 `conventions` job이 브랜치 이름·PR 제목·PR의 모든 커밋을 검사하고, 하나라도 어긋나면 실패한다. 같은 PR에 새 커밋을 push하면 이전 검사는 취소되고 새 검사만 실행된다. 워크플로의 `concurrency` 설정(`group: conventions-<PR 번호>`, `cancel-in-progress: true`)이 같은 PR의 이전 실행을 취소하기 때문이다. Actions 로그의 "Canceling since a higher priority waiting request for conventions-80 exists"는 이 취소 기록이다.

규칙에 어긋난 커밋 메시지를 수정하는 방법:

```bash
git commit --amend -m "fix(mail): …"        # 마지막 커밋 메시지
git push --force-with-lease
```

`--amend`는 마지막 커밋을 새 메시지로 다시 만들기 때문에 커밋 해시가 바뀐다. 원격 브랜치와 기록이 달라지므로 강제 push가 필요하고, `--force-with-lease`는 그 사이 원격에 다른 사람이 올린 커밋이 있으면 push를 거부해 덮어쓰기를 막는다. 마지막 커밋이 아닌 커밋의 메시지는 `git rebase -i`로 수정한다. 머지 버튼 차단은 저장소 설정의 Ruleset이 담당한다(CONTRIBUTING의 '저장소 설정', [GitHub Rulesets 문서](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)).

## 관련 글

- [GitHub Actions를 커밋 SHA로 고정하고 Dependabot으로 업데이트 받기](/memo/supply-chain-security#github-actions-커밋-sha-고정과-dependabot)
- [GitHub 병합 방식 세 가지(Create a merge commit, Squash and merge, Rebase and merge)](/memo/merge-strategies)
- [main 커밋 기록 집계로 Merge commit 병합 전략 정하기](/memo/macfolio-merge-strategy): 브랜치 커밋이 main에 그대로 남아 커밋마다 메시지를 검사하는 이유
- [Workers Builds 대신 GitHub Actions와 wrangler로 시험을 통과한 커밋만 배포하기](/memo/deploy-github-actions)
- [gitleaks 사용자 규칙과 CI 작업으로 저장소 기록 전체의 비밀 값 검사하기](/memo/supply-chain-security#gitleaks로-저장소-기록-전체의-비밀-값-검사)

<details>
<summary>참고 문헌</summary>

- Conventional Commits, [Conventional Commits 1.0.0 (한국어)](https://www.conventionalcommits.org/ko/v1.0.0/)
- GitHub Docs, [Script injections](https://docs.github.com/en/actions/concepts/security/script-injections)
- GitHub Docs, [Events that trigger workflows: pull_request](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)
- GitHub Docs, [Workflow commands for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)
- GitHub Docs, [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets), [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- GitHub Docs, [About status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
- actions/checkout, [README: fetch-depth](https://github.com/actions/checkout)
- Pro Git, [Customizing Git - Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)
- Git 문서, [git-log: --no-merges](https://git-scm.com/docs/git-log#Documentation/git-log.txt---no-merges), [gitrevisions: 두 점 범위](https://git-scm.com/docs/gitrevisions#_dotted_range_notations)

</details>

<details>
<summary>사진 출처</summary>

- 커밋 목록의 상태 검사 표시: GitHub Docs, [About status checks](https://docs.github.com/en/pull-requests/reference/status-checks) (원본 [commit-list-statuses.png](https://github.com/github/docs/blob/main/assets/images/help/pull_requests/commit-list-statuses.png)), CC BY 4.0
- Rulesets 메뉴: GitHub Docs, [Creating rulesets for a repository](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository) (원본 [rulesets-settings.png](https://github.com/github/docs/blob/main/assets/images/help/repository/rulesets-settings.png)), CC BY 4.0

</details>

[^hook]: Git 훅은 커밋·push 같은 동작 전후에 실행되는 스크립트다. `.git/hooks`는 저장소와 함께 복제되지 않으므로, husky 같은 도구로 각 개발 환경에 설치해야 한다. [Git Hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks)

[^workflow-cmd]: 작업이 표준 출력에 `::명령::내용` 형식의 줄을 쓰면 Actions 실행기가 이를 명령으로 해석한다. `::error::`는 오류 주석을, `::warning::`은 경고 주석을 만든다. [Workflow commands for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)

#MacFolio #CI #깃
