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

Dependabot이 여는 의존성 PR은 예외다. 브랜치 이름(`dependabot/npm_and_yarn/…`)은 GitHub이 정하므로 `conventions`가 보지 않고, 제목과 커밋은 `.github/dependabot.yml`에서 `chore(deps): …`, `ci(deps): …`로 맞춰 둔다.

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

- 기능을 바꾸면 **테스트와 블로그 글도 같은 PR에** 넣는다. 막혔던 곳은 그때 적지 않으면 잊는다 ([블로그 글](#블로그-글))
- 커밋하기 전에 `pnpm format:check`, `pnpm lint`, `pnpm cycles`(파일끼리 서로 import하는 순환이 없는지), `pnpm test`를 돌린다. 두 화면이 같은 타입을 쓰면 둘 중 하나가 아니라 `model.ts` 같은 셋째 파일에 둔다
- API의 컨트롤러나 DTO를 바꾸면 `pnpm --filter @macfolio/api openapi`로 `apps/react/src/apps/apidocs/openapi.json`을 다시 만들어 함께 커밋한다. 사이트의 'API 문서' 앱이 이 파일을 그린다. 빠뜨리면 `pnpm test`(`apps/api/src/openapi.test.ts`)가 실패한다

### 마이그레이션

API는 main에 머지되면 자동으로 배포되고, 새 버전이 건강하지 않으면 **이미지만** 이전 버전으로 되돌린다 (#100). 마이그레이션(DB 구조 변경)은 되돌리지 않는다. 그래서 마이그레이션은 **이전 버전의 코드도 그대로 돌 수 있게** 만든다.

- 열·표 추가: 새 열은 비워 둘 수 있게(nullable)나 기본값을 두고 더한다. 옛 코드는 모르는 열을 무시한다
- 이름 바꾸기·지우기: 한 번에 하지 않고 나눈다. ① 새 열을 더하고 코드가 둘 다 쓰게 → ② 다음 배포에서 옛 열을 지운다
- 정말 DB까지 되돌려야 하면 배포 직전 백업(`~/backups`, `ops/deploy.sh`가 남긴다)을 `ops/restore.sh`로

## 프론트엔드 파일 이름

`apps/react/src/apps/<앱>/`은 기능(앱)마다 한 폴더다. 그 안의 파일은 이름이 종류를 말한다. 폴더는 묶을 것이 생겼을 때만 만든다.

| 종류                              | 이름                                | 예                                                |
| --------------------------------- | ----------------------------------- | ------------------------------------------------- |
| 서버 호출 (`fetch`)               | `*Api.ts` (하나뿐이면 `<앱>Api.ts`) | `postsApi.ts`, `captionsApi.ts`, `activityApi.ts` |
| 타입과 순수 계산 (React·DOM 없음) | `model.ts`, 또는 뜻이 드러나는 이름 | `activity/model.ts`, `weather/forecast.ts`        |
| 훅                                | `use*.ts`                           | `useServerResources.ts`, `usePopover.ts`          |
| 화면 조각                         | `PascalCase.tsx`                    | `FolderRow.tsx`                                   |
| 화면 조각이 셋 이상 모이면        | `components/`                       | `memo/components/`, `mail/components/`            |
| 스타일                            | 컴포넌트와 같은 이름의 `.css`       | `Memo.css`, `PhotosMobile.css`                    |
| 두 화면이 함께 쓰는 타입          | `model.ts` 또는 `<무엇>.model.ts`   | `mail/model.ts`, `folderSidebar.model.ts`         |

- 대소문자: 폴더는 소문자(두 낱말이면 `status-bar`처럼 kebab-case), 컴포넌트 파일은 `PascalCase.tsx`, 그 밖의 `.ts`·훅·메뉴 정의는 `camelCase`, CSS는 짝이 되는 컴포넌트와 같은 이름
- 한 파일에 서버 호출과 순수 계산을 섞지 않는다. 섞이면 순수 계산에 시험을 붙이기 어렵고, 서버 호출을 공통 클라이언트로 옮길 때 파일을 다시 가른다
- 서버 호출은 `shared/api/client.ts`의 `api()`(JSON, 실패하면 `ApiError`)나 `apiFetch()`(상태 코드로 분기할 때)를 거친다. 주소·쿠키·JSON 머리말·시간 제한·실패 문구는 거기서 정하므로 `*Api.ts`에는 경로와 응답 모양만 적는다. `fetch`를 직접 부르는 곳은 바깥 서비스(날씨, 효과음)와 `/health` 확인뿐
- API 요청·응답의 모양은 `packages/contracts`(`@macfolio/contracts`)의 zod 스키마에 둔다. 서버는 `parse(CommentInput, body)`로 검사하고(실패 문구도 스키마에 한국어로 적는다), `*Api.ts`는 `import type { Comment } from '@macfolio/contracts'`로 타입만 가져와 응답 모양을 손으로 다시 적지 않는다. 스키마와 타입은 같은 이름이다
- 브라우저에 남기는 값(`localStorage`·`sessionStorage`)은 `shared/lib/storage.ts`의 `readJson`/`writeJson`/`readString`/`writeString`을 거치고, 키는 `STORAGE_KEYS`에 둔다. 사생활 보호 창에서 저장소가 던지는 것은 거기서 삼키므로 부르는 쪽에 try/catch를 쓰지 않는다. 새 키는 `bin/siteStorage.ts`의 `BROWSER_DATA`에도 더한다 (시험이 잡는다)
- 값을 받아 두는 store와 그것을 읽는 한 줄짜리 훅(`useSyncExternalStore`)은 그 `*Api.ts`에 둬도 된다 (`githubApi.ts`의 `useGithub`)
- 시험은 대상 파일 옆에 같은 이름으로 (`forecast.ts` ↔ `forecast.test.ts`)
- 앱이 커져 파일이 열 개를 넘으면 그때 `components/`·`writer/`처럼 묶는다. 작은 앱에 미리 폴더를 파지 않는다

## 블로그 글

사이트의 메모 앱이 블로그다. 글은 `apps/react/src/apps/memo/content/*.md`, 이미지는 `content/images/`에 둔다.

### 언제 쓰나

누가 시키지 않아도, 작업하다 글감이 생기면 그 작업의 PR에 글을 함께 넣는다.

- 기능을 만들었다: 어떻게 구현했는지, 왜 그렇게 했는지
- 문제를 만났다: 증상 → 원인을 찾은 과정 → 고친 방법 (트러블슈팅)
- 테스트·CI·배포·도구에서 막힌 것, 처음 알게 된 동작
- 이미 머지된 PR에 덧붙일 것이 생기면 새 PR로 올린다

### 어떻게 쓰나

- **기술 글**은 구현과 트러블슈팅을 쓴다. 한 일을 늘어놓는 일지가 되지 않게 한다
- 하루나 한 주를 돌아보는 글은 `개발기/MacFolio/회고` 폴더에 쓴다
- 로그, 코드, 숫자는 실제로 돌려 본 것만 쓴다
- 머리말(frontmatter)에 `title`, `date`(YYYY-MM-DD), `category`(폴더, 최대 3단계), `summary`를 쓴다

```markdown
---
title: 글 한 편 추가했더니 E2E가 깨졌다
date: 2026-10-01
category: 개발기/MacFolio
summary: 목록과 검색에 보이는 한두 문장 요약
---
```

### 이미지

글마다 가능하면 여러 종류의 이미지를 넣는다.

- **화면 캡처**: Playwright로 찍는다. E2E의 가짜 API(`e2e/fakeApi.ts`)로 관리자 화면이나 원하는 장면을 서버 없이 만들고, `deviceScaleFactor: 2`로 선명하게 찍는다. 찍는 코드는 저장소에 넣지 않고 이미지만 커밋한다
- **고치기 전·후**: 버그를 고쳤으면 고치기 전 빌드와 고친 뒤 빌드에서 같은 자리를 찍어 나란히 둔다
- **그림(SVG)**: 흐름, 규칙, 구조, 이벤트 순서처럼 캡처로 안 보이는 것은 SVG로 그린다. 기존 그림처럼 `viewBox="0 0 640 …"`, 흰 바탕, 같은 글꼴과 색을 쓴다
- 캡처는 JPG, 그림은 SVG로 둔다. 파일 이름은 글 이름으로 시작한다 (`cjk-emphasis-before.jpg`)
- 이미지 설명(제목)에 무엇을 봐야 하는지 한 줄 쓴다: `![대체 글자](./images/a.jpg '여기서 볼 것')`
- 올리기 전에 빌드한 사이트에서 글을 열어 모든 이미지가 뜨는지 확인한다

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

- CI(`check`, `conventions`, `secrets`)가 통과해야 머지한다. `main`의 Ruleset이 세 검사를 필수로 걸어 두어, 통과하기 전에는 Merge 버튼이 막힌다. `secrets`는 gitleaks로 API 키·토큰·개인 키 모양의 글자가 커밋에 들어왔는지 기록 전체를 본다 (예외는 `.gitleaks.toml`)
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
5. **Require status checks to pass**를 켜고 **Add checks**에서 `check`, `conventions`, `secrets`를 더한다
6. **Create**

- 검사 이름은 워크플로의 job 이름이다 (`.github/workflows/ci.yml`의 `check`, `conventions.yml`의 `conventions`, `secrets.yml`의 `secrets`). job 이름을 바꾸면 여기 검사 이름도 바꾼다. 안 바꾸면 사라진 검사를 기다리느라 아무 PR도 머지되지 않는다
- 검사는 PR에서 한 번 돌아야 목록에 나타난다. 목록에 없으면 아무 PR이나 열어 CI를 돌린 뒤 다시 찾는다
- **Require a pull request before merging**에 승인 수(required approvals)는 걸지 않는다. 혼자 하는 저장소에서는 내 PR을 내가 승인할 수 없어 머지가 막힌다
- 같은 Ruleset에서 **Block force pushes**를 켜 두면 `main`의 기록을 덮어쓰는 push도 막는다

### 비밀 값·의존성 (Code security)

1. 저장소 → **Settings** → **Advanced Security** (예전 이름 **Code security and analysis**)
2. **Dependabot** 묶음에서 **Dependabot alerts**와 **Dependabot security updates**를 **Enable**. 알려진 취약점이 있는 의존성이 생기면 알림이 오고, 고친 버전으로 올리는 PR이 저절로 열린다 (주간 버전 올리기는 `.github/dependabot.yml`이 따로 한다)
3. **Secret Protection**(예전 이름 Secret scanning) 묶음에서 **Secret Protection**을 **Enable**, 그 아래 **Push protection**("Block commits that contain supported secrets")도 **Enable**. 알려진 서비스의 키 모양(GitHub 토큰, AWS 키 등)이 커밋에 들어오면 GitHub이 알려 주고, push protection은 그런 커밋의 push 자체를 막는다. 공개 저장소는 무료이고 둘 다 기본으로 켜져 있는 경우가 많다: 단추가 **Disable**로 보이면 이미 켜진 것이니 그대로 둔다
4. 이미 만든 `main` Ruleset(위)을 열어 **Require status checks to pass**의 **Add checks**에서 `secrets`를 더하고 **Save changes**. `secrets`는 `.github/workflows/secrets.yml`(gitleaks)로, PR 한 번은 돌아야 목록에 나타난다

GitHub secret scanning은 GitHub이 아는 서비스의 키만 보고, gitleaks(`secrets` 작업)는 `.gitleaks.toml`의 규칙(이 프로젝트의 Resend·Groq 키, DB 주소의 비밀번호 등)까지 본다. 둘 다 켠다.

### 머지한 브랜치 지우기

Settings → General → Pull Requests의 **Automatically delete head branches**를 켜면 머지한 브랜치가 저절로 지워진다.
