---
title: API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기
date: 2026-10-02
category: 개발 기록/MacFolio/프론트엔드
series: GitHub 앱
seriesOrder: 1
summary: 코드에 직접 입력하던 GitHub 앱의 프로필·README·고정 저장소를, API 서버가 GitHub에서 조회해 30분(토큰이 있으면 10분) 캐시한 뒤 응답하게 했다. README는 sanitize 후 렌더링하고 배지는 Contact 버튼으로 바꾸며, 표시할 저장소는 시스템 설정에서 선택한다.
---

GitHub 앱의 프로필(팔로워·팔로잉·소개), 프로필 README, Pinned 저장소는 모두 코드에 직접 입력한 값이었다. 방문자마다 GitHub API를 호출하면 요청 한도를 넘을 수 있어서 고정값을 사용했다. 그래서 README를 수정하거나 팔로워가 늘어도 앱은 그대로였다. 고정 저장소의 별 수와 설명도 입력한 날짜의 값에 머물러 있었다. 포트폴리오에서 GitHub를 표시하는 목적이 "현재 진행 중인 작업"을 보여 주는 것인데, 그 화면이 가장 오래된 정보였다.

이번 작업([#79](https://github.com/hyeoniverse/MacFolio/pull/79))은 세 가지다. 서버가 GitHub에서 조회해 캐시하기, README를 실제 Markdown으로 렌더링하기, 표시할 저장소를 관리자가 선택하기.

![GitHub 앱 전후](./images/github-live-profile-app.jpg '위: 코드에 직접 입력한 화면 / 아래: 서버가 조회한 README를 렌더링한 화면')

## 조회 위치

| 방법                              | 장점                           | 단점                                                                     |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| 기존처럼 코드에 직접 입력         | 요청이 없다                    | 항상 오래된 값, 수정할 때마다 배포 필요                                  |
| 브라우저가 GitHub API를 직접 호출 | 서버 작업이 없다               | 방문자 IP마다 시간당 60회. 회사망처럼 IP를 공유하면 바로 한도에 도달한다 |
| 빌드 시각에 조회해 정적 파일로    | 요청이 없다                    | README를 수정해도 다시 배포하기 전까지 반영되지 않는다                   |
| **API 서버가 조회해 캐시**        | 요청 수가 방문자 수와 무관하다 | 서버가 중단되면 조회할 수 없다 → 스냅샷으로 대체                         |

API 서버는 이미 메모·댓글·메시지를 위해 실행 중이었으므로 마지막 방법을 선택했다.

## 서버 캐시

API 서버에 `/github/profile`을 추가했다. 관리자 계정의 프로필, 프로필 README, 선택한 저장소를 GitHub에서 조회해 한 번에 응답한다.

| 항목        | 동작                                                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 요청 한도   | 토큰 없이 GitHub API를 호출하면 서버 IP 하나당 시간당 60회다. 한 번 갱신에 계정·README·저장소 목록·목록에 없는 저장소 몇 개로 5~6회가 필요해서, 조회한 값을 30분 동안 캐시한다. `GITHUB_TOKEN`을 설정하면 시간당 5,000회라 10분마다 갱신한다 |
| 동시 요청   | 캐시가 만료된 시각에 여러 방문자가 동시에 열어도, 진행 중인 요청 하나의 결과를 함께 기다린다                                                                                                                                                 |
| GitHub 장애 | 갱신에 실패하면 마지막으로 조회한 값을 반환한다. API 서버에 연결할 수 없으면 앱은 코드에 포함된 스냅샷을 표시한다. 스냅샷을 먼저 렌더링하고 서버 응답이 오면 교체하므로 빈 화면이 없다                                                       |
| 계정 식별   | 관리자 로그인과 같은 `ADMIN_GITHUB_ID`(숫자 ID)로 계정을 찾는다. 계정 이름을 바꿔도 같은 계정으로 인식한다                                                                                                                                   |

서버 코드는 `apps/api/src/github/` 아래에 있다. GitHub API를 호출하는 `github-api.client.ts`, 캐시와 저장소 선택을 담당하는 `github.service.ts`, 저장소 이름 검사와 정렬을 담당하는 `showcase.ts`로 나눴다. 시험에서는 `github-api.fake.ts`가 GitHub 대신 응답한다.

## README를 실제 Markdown으로 렌더링

프로필 README에는 Markdown과 HTML(가운데 정렬 `div`, 표, `<picture>`)이 섞여 있다. [`react-markdown`](https://github.com/remarkjs/react-markdown)에 [`rehype-raw`](https://github.com/rehypejs/rehype-raw)로 HTML을 파싱하고, [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize)로 필터링한다. `rehype-sanitize`의 기본 스키마가 GitHub의 규칙이라 GitHub에서 표시되는 요소만 남고, 스크립트나 이벤트 속성은 렌더링하지 않는다.

그 뒤에 직접 작성한 rehype 플러그인이 다음 항목을 변환한다.

- **상대 주소**: `./profile/stats-light.svg`는 프로필 저장소의 파일 주소로 변환한다.
- **`<picture>`**: 브라우저는 [`prefers-color-scheme`](https://developer.mozilla.org/ko/docs/Web/CSS/@media/prefers-color-scheme)으로 OS 설정만 참조한다. 앱에는 별도의 화면 모드 설정이 있으므로, 그 값에 맞는 그림 하나로 교체한다.
- **[shields.io](https://shields.io/) 배지**: `img.shields.io/badge/Gmail-EA4335?logo=gmail` 주소에서 글자·색·로고를 추출해, 기존 앱의 Contact 버튼 형태로 바꾼다. 배지 그림보다 버튼이 앱의 다른 UI와 일관된다. shields.io는 글자 안의 `-`를 `--`로, 공백을 `_`로 표기하는 규칙이 있어서 그 규칙대로 원래 글자로 복원한다.

```ts
// 라벨-색 또는 라벨-메시지-색 (글자 안의 -는 --로 적는다)
const parts = url.pathname
	.slice('/badge/'.length)
	.replace(/\.(svg|png)$/, '')
	.split(/(?<!-)-(?!-)/);
const color = parts.at(-1)!;
if (!label || !/^[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) return null;
```

색을 추출하지 못하면 `null`을 반환하고 원래 배지 그림을 유지한다.

- **capsule-render 배너**: 주소의 `text`, `desc`, `color`로 CSS 배너를 생성한다. 외부 이미지 서비스가 느리거나 중단되어도 배너는 정상 표시된다.

GitHub에서 README를 수정하면, 서버가 캐시를 갱신하는 시각에 앱에도 반영된다.

![README 렌더링 순서](./images/github-live-profile-readme.svg '필터링(rehype-sanitize)이 먼저, 앱 형태로 변환하는 플러그인이 나중이다')

순서가 중요하다. `rehypePlugins`는 `rehypeRaw → rehypeSanitize → rehypeGithubReadme` 순서다. 필터링을 먼저 하면 README 내용과 관계없이 GitHub가 허용하는 요소만 남고, 그 뒤 플러그인은 앱이 정의한 버튼·배너만 생성한다. 순서를 반대로 하면 플러그인이 생성한 `style` 속성이 필터링 단계에서 삭제된다.

## 표시할 저장소 선택

![시스템 설정의 GitHub](./images/github-live-profile-settings.jpg '관리자로 로그인했을 때만 표시되는 항목')

GitHub의 Pinned는 GraphQL API로만 조회할 수 있고 토큰이 필요하다. 그래서 Pinned를 그대로 쓰지 않고, 시스템 설정에 관리자에게만 표시되는 **GitHub** 항목을 추가했다.

- 평소에는 선택한 목록만 표시하고, **편집**을 누르면 삭제·순서 변경·추가 컨트롤이 표시된다. 변경 사항은 **완료**를 누른 시각에 한 번에 저장하고, **취소**하면 버린다. 처음에는 변경할 때마다 즉시 저장했는데, 저장할 때마다 서버가 GitHub에서 새로 조회해서(요청 5~6회) 순서를 몇 번 바꾸면 시간당 60회 한도에 바로 도달했다. 실수로 삭제한 항목도 되돌릴 수 없었다.
- 본인의 공개 저장소와, 공개 멤버로 소속된 조직의 저장소를 목록으로 표시한다. ＋로 추가하고 −로 삭제한다.
- 순서는 줄 끝의 ≡ 손잡이를 끌어서 바꾼다. 메모의 폴더 편집과 같은 손잡이이고, 끄는 동안 잡은 줄이 떠오르고 지나간 줄이 자리를 비운다. 손잡이에 포커스가 있을 때 ↑·↓ 키로도 한 칸씩 이동한다. 끌기 코드는 메모와 공유하도록 `shared/ui/reorder`로 분리했다.
- 조직 소속을 비공개로 설정하면 그 조직의 저장소는 목록에 나오지 않는다. 이 경우 `owner/이름`을 직접 입력해 추가한다. 서버가 GitHub에 존재하는 공개 저장소인지 확인하고, GitHub에 등록된 대소문자로 저장한다.
- GitHub의 Pinned처럼 최대 6개까지 선택할 수 있다.
- 완료하면 서버가 캐시를 무효화하고 다음 요청에서 새로 조회한다. 조회에 실패하면 이전 값을 반환한다.

선택한 목록은 DB에 "owner/이름"만 저장한다. 설명·별·언어는 GitHub에서 조회하므로, 저장소 설명을 수정해도 별도 작업이 없다. 테이블은 한 행만 사용한다.

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

선택한 저장소가 나중에 삭제되거나 비공개로 바뀌면 GitHub에서 조회할 수 없으므로 표시 목록에서 제외된다. 조회 시각에 필터링하는 것이라 DB의 목록은 그대로다.

## 개발 과정에서 바뀐 것

10월 2일 저녁, [GitHub 계정 연동](/memo/admin-login-github-oauth)을 마친 뒤 GitHub 앱의 팔로워·팔로잉·README가 GitHub에서 조회한 값인지 직접 입력한 값인지부터 확인했다. 직접 입력한 값이었다. 그래서 조회하도록 바꾸고, 노출할 저장소를 설정에서 선택하게 했다. 연락처(Contact) 버튼은 기존 스타일을 유지했다.

- GitHub에 연결할 수 없어도 앱이 비지 않도록 코드의 스냅샷(`.ts`)으로 대체되는지 확인했다.
- 선택한 저장소의 순서는 메모의 손잡이 UI를 재사용해 끌어서 바꾸게 했다.
- 선택 화면이 항상 열려 있으면 실수로 변경되기 쉬워서, 별도의 편집 모드에서만 변경하게 했다.
- 첫 편집 화면은 정렬과 간격이 맞지 않아 한 번 더 수정했다.

## 확인

<details>
<summary>서버·화면 시험 이름</summary>

- 서버 단위 시험: `github.service.test.ts`의 "받은 값을 토큰이 없으면 30분 동안 들고 있고, 그 뒤에 새로 받는다", "동시에 여럿이 물어도 GitHub에는 한 번만 묻는다", "GitHub에 닿지 못하면 마지막으로 받은 값을 주고, 받은 값이 없으면 실패한다", "지워졌거나 비공개가 된 저장소는 빠진다". 저장소 이름 규칙은 `showcase.test.ts`가 검사한다.
- 서버 E2E `apps/api/test/github.e2e.test.ts` 7개: 누구나 프로필을 받고, 고르기는 관리자만, 잘못된 이름·없는 저장소·7개 이상은 저장하지 않고, GitHub에 닿지 못하고 받은 값도 없으면 502.
- 화면 단위 시험 `readme.test.ts`: "shields.io 배지에서 글자·색·로고를 읽는다", "배지가 아니거나 색을 모르면 null (그림 그대로)", "`<picture>`는 화면 모드에 맞는 그림 하나로", "capsule-render 배너는 CSS 배너로" 등.
- 화면 E2E `e2e/github.spec.ts`: "서버가 GitHub에서 받은 프로필·README·고른 저장소를 보여 준다", "화면 모드를 다크로 바꾸면 README의 어두운 그림을 쓴다", "서버에 닿지 않으면 넣어 둔 스냅샷을 보여 준다", "편집에서 더하고, ≡로 순서를 바꾸고, 빼면 완료할 때 한 번에 저장되어 GitHub 앱에 보인다", "6개를 고르면 더 더할 수 없다".

</details>

- PR 전체는 39개 파일, +3,186/−338이다. 직접 작성했던 기술 스택 그림(`public/imgs/github/skills.svg`)은 이 PR에서 삭제했다.

## 남은 것·배운 것

- GitHub의 Pinned와 자동으로 동기화되지 않는다. 토큰을 설정하면 GraphQL로 조회할 수 있지만, 토큰 없이 동작하는 원칙을 유지하기 위해 별도의 선택 화면을 만들었다. 두 목록이 다를 수 있다.
- README 안의 외부 그림(통계 카드 등)은 여전히 해당 서비스에 의존한다. 배너와 배지만 CSS로 바꿨다.
- 외부 서비스 데이터를 표시하는 화면은 "조회 실패 시 무엇을 표시할지"를 먼저 정해야 한다. 여기서는 마지막 값 → 스냅샷 순서로 대체한다.
- 이후 [기여 달력과 활동](/memo/github-activity)([#89](https://github.com/hyeoniverse/MacFolio/pull/89))을 추가했고, 카드 크기는 [고정 저장소 카드](/memo/github-pinned-card-size)([#81](https://github.com/hyeoniverse/MacFolio/pull/81))에서 맞췄다.

## 관련 글

- [토큰 없이 github.com HTML 조각을 서버에서 파싱하는 기여 달력](/memo/github-activity)
- [grid-auto-rows 1fr와 line-clamp, margin-top auto로 카드 높이 맞추기](/memo/github-pinned-card-size)
- [폴더 순서를 손잡이로 바꾸기 - 저장은 경로 목록 하나로](/memo/memo-folder-order): ≡ 손잡이 UI
- [GitHub OAuth와 토큰 해시만 저장하는 DB 세션으로 관리자 인증하기](/memo/admin-login-github-oauth): `ADMIN_GITHUB_ID`를 쓰는 관리자 인증

#MacFolio #GitHub #시스템설정
