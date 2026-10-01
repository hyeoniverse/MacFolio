# 작업 규칙

브랜치, 커밋, 이슈, PR을 이렇게 쓴다. 지금까지 써 온 방식을 정리한 것이고, PR을 열면 CI(`conventions` 워크플로)가 브랜치 이름, PR 제목, 커밋 메시지를 확인한다.

## 흐름

```
이슈 → 브랜치 → 커밋 → PR → CI 통과 → 머지 → 브랜치 삭제
```

1. 할 일을 이슈로 적는다 (작은 수정은 이슈 없이 바로 PR로 해도 된다)
2. `main`에서 브랜치를 딴다
3. 커밋은 작게, 한 커밋에 한 가지 일만
4. PR을 열고 CI가 통과하면 머지한다
5. 머지한 브랜치는 지운다

`main`에는 직접 push하지 않는다. main에 머지하면 프론트엔드가 Cloudflare Workers로 자동 배포된다.

## 브랜치

```
<타입>/<짧은-설명>
```

- 타입은 [커밋 타입](#타입)과 같다: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `style`
- 설명은 영어 소문자와 숫자, `-`로 쓴다. 무엇을 하는 브랜치인지 알 수 있게

| 좋은 예               | 나쁜 예            | 이유                      |
| --------------------- | ------------------ | ------------------------- |
| `feat/post-comments`  | `feature/comments` | 타입은 커밋 타입과 같게   |
| `fix/mobile-swipe`    | `fix/bug`          | 무엇을 고치는지 안 보인다 |
| `docs/deployment`     | `docs/Deployment`  | 소문자로                  |
| `feat/memo-admin-api` | `my-branch`        | 타입이 없다               |

## 커밋

```
<타입>(<범위>): <설명>

<본문 (선택)>
```

- **설명은 한국어로, 무엇이 바뀌었는지** 쓴다. 끝에 마침표를 찍지 않는다
- 한 줄로 부족하면 한 줄 비우고 본문에 이유나 자세한 내용을 쓴다
- 범위는 선택이다. 한쪽 패키지만 바꿨을 때 `api`, `react`처럼 붙인다

```
feat: 이미지 내려받기 단추, 편집기에서 캡션을 눌러 고치기
fix(api): 예약한 글이 날짜 전에 목록에 보이던 문제
docs: 배포 문서와 README 새로 쓰기
test: 글 순서에 기대지 않게 E2E 고침
```

### 타입

| 타입       | 쓰는 때                                   |
| ---------- | ----------------------------------------- |
| `feat`     | 새 기능                                   |
| `fix`      | 버그 수정                                 |
| `docs`     | 문서, 블로그 글, README                   |
| `refactor` | 동작은 그대로 두고 코드 구조만 바꿀 때    |
| `test`     | 테스트만 추가하거나 고칠 때               |
| `style`    | 포맷, 세미콜론 등 동작과 무관한 코드 모양 |
| `perf`     | 성능 개선                                 |
| `chore`    | 의존성, 설정, 빌드 등 그 밖의 잡일        |
| `ci`       | GitHub Actions 등 CI 설정                 |

화면의 CSS를 고친 것은 `style`이 아니라 `feat`이나 `fix`다. `style`은 코드 포맷만 바꿀 때 쓴다.

### 함께 커밋할 것

- 기능을 바꾸면 **테스트와 블로그 글도 같은 PR에** 넣는다. 막혔던 곳은 그때 적지 않으면 잊는다
- 커밋하기 전에 `pnpm format:check`, `pnpm lint`, `pnpm test`를 돌린다

## 이슈

```
[영역] 요약
```

- 영역: 로드맵 단계(`[Phase 7]`), 앱 이름(`[GitHub 앱]`, `[Memo]`), `[Infra]`, `[Roadmap]`
- 템플릿: **기능·작업**, **버그** 중에서 고른다 (`.github/ISSUE_TEMPLATE/`)
- 라벨: `enhancement`(기능·작업), `bug`(버그), `documentation`(문서)
- 다른 이슈에 먼저 끝나야 하는 일이 있으면 본문 끝에 `선행: #9`처럼 적는다
- 큰 이슈는 체크리스트로 쪼개고, 끝난 항목은 체크한다. 계획과 다르게 한 것은 본문에 고쳐 적는다

## PR

### 제목

커밋 메시지와 같은 형식이다. 커밋이 하나면 그 커밋 메시지를 그대로 쓴다.

```
<타입>(<범위>): <설명>
```

### 본문

템플릿(`.github/pull_request_template.md`)을 채운다.

- **무엇을, 왜**: 바뀐 것과 이유. 화면이 바뀌었으면 스크린샷
- **관련 이슈**: `Closes #10`(머지하면 이슈를 닫는다) 또는 `Refs #10`(닫지 않고 걸기만)
- **확인한 것**: 돌려 본 명령과 직접 눌러 본 것

### 머지

- CI(`check`, `conventions`)가 통과해야 머지한다. `main`의 Ruleset이 두 검사를 필수로 걸어 두어, 통과하기 전에는 Merge 버튼이 막힌다
- **Merge commit**으로 머지한다. 브랜치의 커밋이 그대로 main에 남는다
- 머지한 브랜치는 지운다 (PR 페이지의 Delete branch)
- 아직 손볼 게 남았으면 draft로 열어 두고, 다 되면 Ready for review로 바꾼다

## 저장소 설정

저장소를 새로 만들거나 옮겼을 때 GitHub 설정에서 한 번 해 둔다.

### `main` 보호 (Ruleset)

CI가 실패해도 Merge 버튼이 눌리지 않게, `main`에 필수 검사를 건다.

1. 저장소 → **Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**
2. **Ruleset name**: `main 보호` 처럼 알아볼 이름
3. **Enforcement status**: **Active**
4. **Target branches** → **Add target** → **Include default branch**
5. **Require status checks to pass**를 켜고 **Add checks**에서 `check`와 `conventions`를 더한다
6. **Create**

- 검사 이름은 워크플로의 job 이름이다 (`.github/workflows/ci.yml`의 `check`, `conventions.yml`의 `conventions`). job 이름을 바꾸면 여기 검사 이름도 바꾼다. 안 바꾸면 사라진 검사를 기다리느라 아무 PR도 머지되지 않는다
- 검사는 PR에서 한 번 돌아야 목록에 나타난다. 목록에 없으면 아무 PR이나 열어 CI를 돌린 뒤 다시 찾는다
- **Require a pull request before merging**에 승인 수(required approvals)는 걸지 않는다. 혼자 하는 저장소에서는 내 PR을 내가 승인할 수 없어 머지가 막힌다
- 같은 Ruleset에서 **Block force pushes**를 켜 두면 `main`의 기록을 덮어쓰는 push도 막는다

### 머지한 브랜치 지우기

Settings → General → Pull Requests의 **Automatically delete head branches**를 켜면 머지한 브랜치가 저절로 지워진다.
