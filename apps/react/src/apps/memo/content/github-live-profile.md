---
title: GitHub 앱을 진짜 GitHub로 - 프로필·README·고른 저장소
date: 2026-10-02
category: 개발기/MacFolio/프론트엔드
summary: 손으로 옮겨 적던 GitHub 앱의 프로필·README·고정 저장소를, API 서버가 GitHub에서 받아 30분(토큰이 있으면 10분) 들고 있다가 주게 했다. README는 걸러서 그리고 배지는 Contact 버튼으로, 보일 저장소는 시스템 설정에서 고른다.
---

GitHub 앱의 프로필(팔로워·팔로잉·소개), 프로필 README, Pinned 저장소는 모두 코드에 적어 둔 값이었다. 방문자마다 GitHub API를 부르면 요청 제한에 걸릴까 봐 고정해 둔 것이다. 그래서 README를 고치거나 팔로워가 늘어도 앱은 그대로였다. 고정 저장소의 별 수와 설명도 옮겨 적은 날에 멈춰 있었다. 포트폴리오에서 GitHub를 보여 주는 이유가 "지금 무엇을 하는지"인데, 그 화면이 가장 오래된 정보였다.

이번 일([#79](https://github.com/hyeoniverse/MacFolio/pull/79))은 세 가지다. 서버가 GitHub에서 받아 들고 있기, README를 실제 Markdown으로 그리기, 보일 저장소를 관리자가 고르기.

![GitHub 앱 전후](./images/github-live-profile-app.jpg '위: 손으로 옮겨 적은 화면 / 아래: 서버가 받은 README를 그린 화면')

## 어디서 받을까

| 방법                                | 좋은 점                        | 걸리는 점                                                        |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| 지금처럼 코드에 적어 둔다           | 요청이 없다                    | 늘 옛날 값, 고칠 때마다 배포                                     |
| 브라우저가 GitHub API를 직접 부른다 | 서버 일이 없다                 | 방문자 IP마다 시간당 60번, 회사망처럼 IP를 나눠 쓰면 금방 막힌다 |
| 빌드할 때 받아 정적 파일로          | 요청이 없다                    | README를 고쳐도 다시 배포하기 전까지 그대로                      |
| **API 서버가 받아 들고 있다**       | 요청 수가 방문자 수와 상관없다 | 서버가 멈추면 받을 수 없다 → 스냅샷으로 받친다                   |

API 서버는 이미 메모·댓글·메시지를 위해 돌고 있었으니 마지막을 골랐다.

## 서버가 받아 들고 있다

API 서버에 `/github/profile`을 더했다. 관리자 계정의 프로필, 프로필 README, 고른 저장소를 GitHub에서 받아 한 번에 내준다.

- **요청 제한**: 토큰 없이 GitHub API를 부르면 서버 IP 하나로 시간당 60번까지다. 한 번 새로 받는 데 계정·README·내 저장소 목록·목록에 없는 저장소 몇 개로 대여섯 번이 들어서, 받은 값을 30분 동안 들고 있는다. `GITHUB_TOKEN`을 넣으면 시간당 5,000번이라 10분마다 받는다.
- **동시에 여럿이 물어도 한 번만**: 들고 있는 값이 오래되었을 때 방문자 여럿이 같이 열어도, 진행 중인 요청 하나를 함께 기다린다.
- **GitHub가 멈추면**: 새로 받지 못하면 마지막으로 받은 값을 그대로 준다. 서버에 아예 닿지 않으면 앱은 코드에 넣어 둔 스냅샷을 보여 준다. 스냅샷을 먼저 그리고 서버 값이 오면 바꾸므로 빈 화면이 보이지 않는다.
- **계정은 숫자 ID로**: 관리자 로그인과 같은 `ADMIN_GITHUB_ID`로 계정을 찾는다. 계정 이름을 바꿔도 같은 사람이다.

서버 코드는 `apps/api/src/github/` 아래에 있다. GitHub를 부르는 `github-api.client.ts`, 들고 있기와 고르기를 맡는 `github.service.ts`, 저장소 이름 검사와 정렬을 맡는 `showcase.ts`로 나눴다. 시험에서는 `github-api.fake.ts`가 GitHub 대신 답한다.

## README는 진짜 Markdown으로

프로필 README에는 Markdown과 HTML(가운데 정렬 `div`, 표, `<picture>`)이 섞여 있다. `react-markdown`에 `rehype-raw`로 HTML을 살리고, `rehype-sanitize`로 거른다. `rehype-sanitize`의 기본 규칙이 GitHub의 규칙이라 GitHub에서 보이는 것만 보이고 스크립트나 이벤트 속성은 그리지 않는다.

그 뒤에 직접 만든 rehype 플러그인이 몇 가지를 바꾼다.

- **상대 주소**: `./profile/stats-light.svg`는 프로필 저장소의 파일로 풀어 준다.
- **`<picture>`**: 브라우저는 `prefers-color-scheme`으로 OS 설정만 본다. 앱에는 따로 화면 모드 설정이 있으므로, 그 값에 맞는 그림 하나로 바꾼다.
- **shields.io 배지**: `img.shields.io/badge/Gmail-EA4335?logo=gmail` 주소에서 글자·색·로고를 읽어, 원래 앱에 있던 Contact 버튼 모양으로 바꾼다. 배지 그림보다 버튼이 더 앱에 어울린다. shields.io는 글자 안의 `-`를 `--`로, 공백을 `_`로 적는 규칙이 있어서 그 규칙대로 되돌린다.

```ts
// 라벨-색 또는 라벨-메시지-색 (글자 안의 -는 --로 적는다)
const parts = url.pathname
	.slice('/badge/'.length)
	.replace(/\.(svg|png)$/, '')
	.split(/(?<!-)-(?!-)/);
const color = parts.at(-1)!;
if (!label || !/^[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return null;
```

색을 읽지 못하면 `null`을 돌려주고 원래 배지 그림을 그대로 둔다.

- **capsule-render 배너**: 주소의 `text`, `desc`, `color`로 CSS 배너를 만든다. 바깥 이미지 서비스가 느리거나 멈춰도 배너는 깨지지 않는다.

README를 GitHub에서 고치면, 서버가 다시 받는 대로 앱에도 보인다.

![README 그리기 순서](./images/github-live-profile-readme.svg '거르는 것(rehype-sanitize)이 먼저, 앱 모양으로 바꾸는 플러그인이 나중이다')

순서가 중요하다. `rehypePlugins`는 `rehypeRaw → rehypeSanitize → rehypeGithubReadme` 순서다. 거르기를 먼저 하면 README에 무엇이 들어 있든 GitHub가 허락하는 것만 남고, 그 뒤 플러그인은 앱이 정한 버튼·배너만 만든다. 반대로 하면 플러그인이 만든 `style` 속성이 거르기에서 지워진다.

## 보일 저장소 고르기

![시스템 설정의 GitHub](./images/github-live-profile-settings.jpg '관리자로 로그인했을 때만 보이는 항목')

GitHub의 Pinned는 GraphQL API로만 읽을 수 있고 토큰이 필요하다. 그래서 Pinned를 따라가지 않고, 시스템 설정에 관리자만 보이는 **GitHub** 항목을 두었다.

- 평소에는 고른 목록만 보이고, **편집**을 누르면 빼기·순서·더하기가 나타난다. 바꾼 것은 **완료**를 누를 때 한 번에 저장하고, **취소**하면 버린다. 처음에는 바꿀 때마다 바로 저장했는데, 저장할 때마다 서버가 GitHub에서 새로 받아서(요청 5~6번) 순서를 몇 번 고치면 시간당 60번 한도를 금방 썼다. 실수로 뺀 것도 되돌릴 수 없었다.
- 내 공개 저장소와, 공개로 속한 조직의 저장소를 목록으로 보여 준다. ＋를 누르면 더하고, −로 뺀다.
- 순서는 줄 끝의 ≡ 손잡이를 끌어서 바꾼다. 메모의 폴더 편집과 같은 손잡이이고, 끄는 동안 잡은 줄이 떠오르고 지나간 줄이 비켜 준다. 손잡이에서 ↑·↓ 키로도 한 칸씩 옮긴다. 끄는 코드는 메모와 함께 쓰도록 `shared/ui/reorder`로 옮겼다.
- 조직 소속을 비공개로 해 두면 그 조직의 저장소는 목록에 나오지 않는다. 그럴 때는 `owner/이름`으로 적어서 더한다. 서버가 GitHub에 있는 공개 저장소인지 확인하고, GitHub에 적힌 대소문자로 저장한다.
- GitHub의 Pinned처럼 6개까지 고를 수 있다.
- 완료하면 서버가 들고 있던 값을 버리고 다음 요청에서 새로 받는다. 새로 받지 못하면 이전 값을 준다.

고른 목록은 DB에 "owner/이름"만 저장한다. 설명·별·언어는 GitHub에서 받으므로, 저장소 설명을 고쳐도 따로 손댈 것이 없다. 표는 한 행만 쓴다.

```sql
-- GitHub 앱의 Pinned에 보일 저장소 (시스템 설정 → GitHub). 한 행만 쓴다
CREATE TABLE "GithubShowcase" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "repos" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    CONSTRAINT "GithubShowcase_pkey" PRIMARY KEY ("id")
);
```

고른 저장소가 나중에 지워지거나 비공개가 되면 GitHub에서 받지 못하니 목록에서 빠진다. 받을 때 거르는 것이라 DB의 목록은 그대로다.

## 만들며 바뀐 것

10월 2일 저녁, GitHub 계정 연동이 끝나자 GitHub 앱의 팔로워·팔로잉·README가 GitHub에서 받은 값인지 손으로 적은 값인지부터 확인했다. 손으로 적은 값이었다. 그래서 받아 오게 바꾸고, 노출할 저장소를 설정에서 고르게 했다. 연락처(contact) 버튼은 기존 스타일이 더 나아서 그대로 두었다.

- GitHub에 닿지 못해도 앱이 비지 않게 코드의 스냅샷(`.ts`)으로 돌아가는지 확인했다.
- 고른 저장소의 순서는 메모의 손잡이 모양을 빌려 끌어서 바꾸게 했다.
- 고르는 화면이 늘 열려 있으면 실수로 바뀌기 쉬워서, 따로 편집 모드에서만 바꾸게 했다.
- 첫 편집 화면은 모양이 어색해서 한 번 더 다듬었다.

## 확인

- 서버 단위 시험: `github.service.test.ts`의 "받은 값을 토큰이 없으면 30분 동안 들고 있고, 그 뒤에 새로 받는다", "동시에 여럿이 물어도 GitHub에는 한 번만 묻는다", "GitHub에 닿지 못하면 마지막으로 받은 값을 주고, 받은 값이 없으면 실패한다", "지워졌거나 비공개가 된 저장소는 빠진다". 저장소 이름 규칙은 `showcase.test.ts`가 본다.
- 서버 E2E `apps/api/test/github.e2e.test.ts` 7개: 누구나 프로필을 받고, 고르기는 관리자만, 잘못된 이름·없는 저장소·7개 이상은 저장하지 않고, GitHub에 닿지 못하고 받은 값도 없으면 502.
- 화면 단위 시험 `readme.test.ts`: "shields.io 배지에서 글자·색·로고를 읽는다", "배지가 아니거나 색을 모르면 null (그림 그대로)", "`<picture>`는 화면 모드에 맞는 그림 하나로", "capsule-render 배너는 CSS 배너로" 등.
- 화면 E2E `e2e/github.spec.ts`: "서버가 GitHub에서 받은 프로필·README·고른 저장소를 보여 준다", "화면 모드를 다크로 바꾸면 README의 어두운 그림을 쓴다", "서버에 닿지 않으면 넣어 둔 스냅샷을 보여 준다", "편집에서 더하고, ≡로 순서를 바꾸고, 빼면 완료할 때 한 번에 저장되어 GitHub 앱에 보인다", "6개를 고르면 더 더할 수 없다".
- PR 전체로 39개 파일, 3,186줄 더하기, 338줄 지우기다. 손으로 그려 두었던 기술 스택 그림(`public/imgs/github/skills.svg`)은 이 PR에서 지웠다.

## 남은 것·배운 것

- GitHub의 Pinned를 그대로 따르지 못한다. 토큰을 넣으면 GraphQL로 읽을 수 있지만, 토큰 없이 돌아가는 원칙을 지키려고 고르기 화면을 따로 두었다. 두 곳의 목록이 다를 수 있다.
- README 안의 바깥 그림(통계 카드 등)은 여전히 그 서비스에 기댄다. 배너와 배지만 CSS로 바꿨다.
- 바깥 서비스에서 받는 화면은 "받지 못할 때 무엇을 보일까"를 먼저 정해야 한다. 여기서는 마지막 값 → 스냅샷 순서로 물러난다.
- 이 위에 [기여 달력과 활동](/memo/github-activity)을 붙였고, 카드 크기는 [고정 저장소 카드](/memo/github-pinned-card-size)에서 맞췄다.

## 관련 글

- [GitHub 앱에 잔디와 활동 기록 더하기](/memo/github-activity)
- [고정 저장소 카드 크기를 같게](/memo/github-pinned-card-size)
- [메모 폴더 순서를 ≡ 손잡이로](/memo/memo-folder-order)
- [관리자 로그인 (GitHub OAuth)](/memo/admin-login-github-oauth)

#MacFolio #GitHub #시스템설정
