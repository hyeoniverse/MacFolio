---
title: 커밋 규칙을 문서 대신 CI로 지키기
date: 2026-10-01
category: 인프라/빌드·테스트
summary: 브랜치·커밋·PR 규칙을 새로 만들지 않고 지금까지 써 온 모양에서 뽑아냈다. 그리고 PR마다 CI가 확인하게 했다. PR 제목을 스크립트에 그대로 넣으면 생기는 문제와, 검사 스크립트를 로컬에서 시험한 방법.
---

작업 규칙을 적어 두자고 마음먹고 보니 문서만으로는 부족했다. 규칙을 적어 두어도 급할 때는 안 지킨다. 저장소의 옛 커밋에는 `Chore: npm install`, `STYLE: strong h2`, `REFACTOR`처럼 제각각인 메시지가 섞여 있다. 그래서 규칙은 문서(`CONTRIBUTING.md`)로 남기고, **지켰는지는 CI가 본다.**

## 규칙은 기록에서 뽑았다

새 규칙을 만들면 지금까지의 기록과 어긋난다. 먼저 `main`의 커밋 앞머리를 세어 봤다.

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

최근 커밋은 이미 `타입(범위): 한국어 설명` 모양이었고, 브랜치도 `feat/post-comments`, `fix/mobile-swipe`처럼 `타입/설명`이었다. 이걸 그대로 규칙으로 적었다. 타입은 실제로 쓰던 9개(`feat` `fix` `docs` `refactor` `test` `style` `perf` `chore` `ci`)만 둔다.

## 검사는 정규식 두 줄

```bash
types='feat|fix|docs|refactor|test|style|perf|chore|ci'
message="^($types)(\([a-z0-9-]+\))?!?: .+"
branch="^($types)/[a-z0-9][a-z0-9-]*$"
```

PR이 열리거나 제목이 바뀌거나 새 커밋이 올라오면(`opened`, `edited`, `synchronize`), 브랜치 이름·PR 제목·PR에 들어간 커밋 메시지를 모두 본다. 틀린 게 있으면 전부 모아 한 번에 알린다. 하나 고치고 다시 돌렸더니 다음 것이 걸리는 일이 없게 하려는 것이다.

```text
::error::커밋 메시지가 규칙과 다릅니다: e1b0561 'Chore: npm install' (예: fix(api): …)
```

## PR 제목을 스크립트에 그대로 넣으면

처음에는 이렇게 쓰려고 했다.

```yaml
run: |
  if [[ ! "${{ github.event.pull_request.title }}" =~ $message ]]; then
```

`${{ }}`는 스크립트가 실행되기 **전에** 글자 그대로 바뀌어 들어간다. PR 제목은 누구나 정할 수 있는 값이다. 제목에 `"; curl …; echo "` 같은 걸 넣으면 그게 셸 명령으로 실행된다. GitHub Actions에서 흔한 스크립트 주입이다.

그래서 제목과 브랜치 이름은 **환경 변수로 넘기고**, 스크립트에서는 `"$TITLE"`로 읽는다. 환경 변수는 값일 뿐이라 셸이 명령으로 해석하지 않는다.

```yaml
env:
  BRANCH: ${{ github.head_ref }}
  TITLE: ${{ github.event.pull_request.title }}
run: |
  if [[ ! "$TITLE" =~ $message ]]; then
```

## merge 커밋과 전체 기록

- PR의 커밋만 보려면 `git log base..head`가 필요한데, `actions/checkout`은 기본으로 마지막 커밋 하나만 받는다. `fetch-depth: 0`으로 기록을 다 받는다
- 브랜치에 `main`을 합치면 `Merge remote-tracking branch 'origin/main' …` 커밋이 생긴다. 규칙이 강요할 수 없는 메시지라 `--no-merges`로 뺀다

## 스크립트를 로컬에서 시험하기

YAML 안의 셸 스크립트는 올려 보기 전에는 맞는지 알기 어렵다. 워크플로 파일에서 `run:` 부분만 꺼내 로컬에서 환경 변수를 바꿔 가며 돌렸다.

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

맞는 경우와 틀린 경우를 모두 돌려 보고 올렸고, 첫 실행부터 통과했다.

## 템플릿도 기록에서

이슈 템플릿도 지금 이슈들의 모양(목적 · 작업 체크리스트 · 완료 기준 · 선행)을 그대로 옮겼다. PR 템플릿은 무엇을·왜 / 관련 이슈 / 확인한 것 세 칸이다. "확인한 것"에는 format·lint·test와 함께 **테스트·블로그 글·문서를 같이 고쳤는지**를 넣었다. 기능을 만들면 막혔던 곳을 그때 글로 남기는 것도 규칙으로 둔 것이다.

## 머지 버튼까지 막기

검사만으로는 반쪽이었다. CI가 빨갛게 떠도 GitHub는 결과를 보여 줄 뿐, **Merge 버튼은 그대로 눌린다.** 급할 때 "나중에 고치지" 하고 누르면 규칙은 다시 문서로 돌아간다.

그래서 저장소 설정의 **Rulesets**로 `main`에 규칙을 걸었다.

1. Settings → Rules → Rulesets → New branch ruleset
2. Enforcement status: **Active**, 대상: **Include default branch** (`main`)
3. **Require status checks to pass**에 `check`와 `conventions`를 넣는다

이제 두 검사가 모두 초록이어야 머지할 수 있다. 검사가 도는 중이거나 실패하면 Merge 버튼이 막히고 "Required statuses must pass before merging"이 뜬다.

- 예전의 브랜치 보호 규칙(Branch protection rules) 대신 Rulesets를 썼다. 규칙을 켜고 끄기(Active/Disabled)가 쉽고, 여러 브랜치에 같은 규칙을 이름 붙여 걸 수 있다
- **Require a pull request before merging**에 승인 수는 걸지 않았다. 혼자 하는 저장소에서는 내 PR을 내가 승인할 수 없어서, 걸면 아무것도 머지하지 못한다
- 검사 이름은 워크플로 파일의 **job 이름**(`check`, `conventions`)이다. job 이름을 바꾸면 규칙의 검사 이름도 같이 바꿔야 한다. 안 그러면 이미 사라진 검사를 영영 기다린다

#MacFolio #CI #깃
