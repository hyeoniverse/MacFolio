---
title: GitHub 앱에 잔디와 활동 기록 더하기
date: 2026-10-03
category: 개발기/MacFolio/프론트엔드
summary: GitHub 앱에 기여 달력(잔디)과 최근 활동을 붙였다. 달력은 토큰 없이 읽으려고 github.com의 HTML 조각을 서버에서 읽고, 활동은 공개 이벤트를 다듬는다. 둘 다 서버 캐시 뒤에 두고 한쪽만 실패하면 그쪽만 이전 값을 쓴다.
---

GitHub 앱은 프로필, README, 고정 저장소까지만 보여 줬다. 실제 GitHub 프로필에서 가장 먼저 눈에 들어오는 초록색 달력과, 그 아래 "Contribution activity"가 없었다. 이번에 두 가지를 고정 저장소 아래에 붙였다([#89](https://github.com/hyeoniverse/MacFolio/pull/89)).

GitHub 앱은 [서버가 받은 프로필](/memo/github-live-profile)을 보여 준다. 브라우저가 GitHub API를 직접 부르지 않고 우리 API 서버가 받아서 들고 있다가 준다. 방문자가 많아져도 GitHub의 요청 한도(토큰 없이 시간당 60번)에 걸리지 않게 하려는 것이다. 이번 두 기능도 같은 길로 보냈다.

![GitHub 앱의 기여 달력과 활동 기록](./images/github-activity.jpg '고정 저장소 아래의 기여 달력과 달마다 묶은 활동 기록 (가짜 API 값)')

## 달력은 HTML에서 읽는다

기여 달력은 GraphQL API의 `contributionsCollection`으로 받을 수 있지만, GraphQL은 토큰 없이는 부를 수 없다. 서버는 토큰 없이도 돌아가게 만들어 두었고(있으면 요청 한도만 늘어난다), 그 원칙을 달력 하나 때문에 깨고 싶지 않았다.

대신 GitHub 프로필 화면이 달력을 그릴 때 받는 HTML 조각(`github.com/users/<계정>/contributions`)을 서버가 받아 읽는다. 날짜 칸은 이렇게 생겼다.

```html
<td data-date="2026-10-03" id="contribution-day-component-6-52" data-level="3" ...></td>
<tool-tip for="contribution-day-component-6-52">12 contributions on October 3rd.</tool-tip>
```

칸에서 날짜와 색 단계(0~4)를, 그 칸을 가리키는 `tool-tip`에서 기여 수를 읽는다. 읽는 코드는 Nest와 DB에 의존하지 않는 `apps/api/src/github/activity.ts`에 두어 시험하기 쉽게 했다.

```ts
for (const match of html.matchAll(/<td\b[^>]*\sdata-date="[^"]*"[^>]*>/g)) {
	const tag = match[0];
	const date = attribute(tag, 'data-date');
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
	const level = Math.min(4, Math.max(0, Number(attribute(tag, 'data-level') ?? 0) || 0));
	const id = attribute(tag, 'id');
	days.push({ date, level, count: (id && counts.get(id)) || 0 });
}
```

HTML을 정규식으로 읽는 것은 보통 피하는 일이다. 여기서는 읽을 것이 `td`와 `tool-tip` 두 태그의 속성 몇 개뿐이고, 서버에 HTML 파서를 더하는 것보다 가볍다고 봤다. 속성 순서에 기대지 않게 속성을 하나씩 찾고, 모양을 하나도 읽지 못하면 `null`을 돌려준다. GitHub가 화면을 바꾸면 달력이 사라질 뿐, 앱의 나머지는 그대로다.

화면에서는 날짜를 일요일부터 시작하는 주로 묶어 53열 × 7행 격자에 놓는다. 첫 주는 앞 칸을 비우고, 달 이름은 그 달의 1일이 든 주 위에 붙인다. 창이 좁으면 가로로 넘기는데, 처음에는 가장 최근 주가 보이게 끝으로 밀어 둔다.

달력을 받을 방법은 셋을 놓고 골랐다.

| 방법                              | 토큰   | 좋은 점                      | 걸리는 점                                           |
| --------------------------------- | ------ | ---------------------------- | --------------------------------------------------- |
| GraphQL `contributionsCollection` | 필요   | 공식 API, 모양이 안정적      | 토큰 없이 돌아가는 서버 원칙을 깬다                 |
| 남이 만든 잔디 이미지 서비스      | 불필요 | 할 일이 없다                 | 바깥 서비스에 기대고, 다크 모드·크기를 맞출 수 없다 |
| **프로필 화면의 HTML 조각**       | 불필요 | 실제 GitHub 화면과 같은 숫자 | GitHub가 화면을 바꾸면 읽지 못한다                  |

마지막 걸리는 점은 "읽지 못하면 `null`, 화면은 달력만 숨긴다"로 받아들였다.

## 활동은 공개 이벤트를 다듬는다

활동 기록은 REST API의 공개 이벤트(`/users/<계정>/events/public`)를 쓴다. 토큰이 없어도 되고, 최근 90일치를 준다. 이벤트는 종류가 많아서 화면에 보일 것만 골랐다.

| 이벤트                                           | 화면                                          |
| ------------------------------------------------ | --------------------------------------------- |
| PushEvent                                        | Pushed N commits to 저장소 (브랜치)           |
| PullRequestEvent                                 | Opened·Merged·Closed pull request 저장소#번호 |
| IssuesEvent                                      | Opened·Closed issue 저장소#번호               |
| CreateEvent                                      | Created repository·branch·tag                 |
| ReleaseEvent, WatchEvent, ForkEvent, PublicEvent | 릴리스, 별, 포크, 공개                        |

닫힌 PR 가운데 합친 것은 `merged`로 바꾸고, 링크는 `https://github.com/`으로 시작하는 주소만 쓴다. 같은 날 같은 브랜치에 여러 번 푸시한 것은 한 줄로 합쳐 커밋 수를 더한다. 그대로 두면 하루에 열 번 푸시한 날이 목록을 다 차지한다. 합치기는 화면 쪽 `githubActivityApi.ts`의 `mergePushes()`가 한다. 한쪽이라도 커밋 수를 모르면(GitHub가 알려 주지 않는 경우) 합친 커밋 수도 `null`로 둔다. 모르는 수를 0으로 더하면 틀린 숫자가 보이기 때문이다. 서버는 최근 것부터 30개(`MAX_ACTIVITY`)까지만 준다.

![달력과 활동이 화면까지 오는 길](./images/github-activity-flow.svg '서버가 두 출처를 따로 받아 다듬어 캐시에 두고, 화면은 주 묶음과 푸시 합치기만 한다')

## 캐시는 둘로

프로필과 같은 방식으로 서버가 받은 값을 들고 있다(토큰이 없으면 30분). 토큰이 있으면 10분이다. 이번에 이 방식을 `Cached` 클래스로 빼서 프로필과 활동이 함께 쓴다. 동시에 여럿이 물어도 GitHub에는 한 번만 묻고, 새로 받지 못하면 마지막 값을 준다.

달력과 활동은 출처가 달라서 따로 실패할 수 있다. 그래서 둘을 `Promise.allSettled`로 받고, 한쪽만 실패하면 그쪽은 이전 값을 쓴다.

```ts
const [html, events] = await Promise.allSettled([this.github.contributionsHtml(login), this.github.userEvents(login)]);
if (html.status === 'rejected' && events.status === 'rejected') throw html.reason;
const previous = this.activityCache.peek();
return {
	contributions:
		html.status === 'fulfilled'
			? html.value
				? parseContributions(html.value)
				: null
			: (previous?.contributions ?? null),
	events: events.status === 'fulfilled' ? toActivities(events.value) : (previous?.events ?? []),
	fetchedAt: new Date(now).toISOString(),
};
```

둘 다 실패해야 요청 전체가 실패한 것으로 보고 마지막 값을 준다. 화면도 같은 원칙이다. 활동을 받지 못하면 두 섹션만 숨기고, 프로필과 고정 저장소는 그대로 보인다.

| 달력 HTML | 이벤트 | 서버가 주는 값                                                  |
| --------- | ------ | --------------------------------------------------------------- |
| 받음      | 받음   | 둘 다 새 값                                                     |
| 실패      | 받음   | 달력은 이전 값, 활동은 새 값                                    |
| 받음      | 실패   | 달력은 새 값, 활동은 이전 값                                    |
| 실패      | 실패   | `Cached`가 마지막 값 (없으면 요청 실패 → 화면은 두 섹션을 숨김) |

또 하나, 활동을 받을 때 계정 이름이 필요하다. 프로필을 이미 받아 두었으면 그 값(`profileCache.peek()`)을 쓰고 GitHub에 계정을 다시 묻지 않는다. 요청 하나를 아낀다.

## 확인

- 서버 단위 시험 `apps/api/src/github/activity.test.ts` 10개. "날짜 칸의 단계와 설명의 기여 수를 읽고, 날짜 순서로 둔다", "속성 순서가 바뀌어도 읽고, 단계는 0~4로 자른다", "달력 모양이 없으면 null", "닫힌 PR 가운데 합친 것은 merged, 주소는 GitHub 주소만", "보여 주지 않는 종류, 비공개, 모양이 틀린 이벤트는 null" 등이다.
- `github.service.test.ts`에 "기여 달력만 받지 못하면 그 부분은 이전 값을, 둘 다 받지 못하면 마지막 값을 준다"와 "프로필을 이미 받았으면 계정을 다시 묻지 않고…"를 더했다.
- 화면 쪽 `githubActivityApi.test.ts`는 "일요일부터 시작하는 주로 묶고, 첫 주의 앞 칸은 비운다", "같은 날 같은 저장소·브랜치의 푸시는 하나로 합쳐 커밋 수를 더한다", "한쪽이라도 커밋 수를 모르면 합친 커밋 수도 모른다"를 본다.
- E2E `e2e/github.spec.ts`의 "Pinned 아래에 지난 1년의 기여 달력과 최근 활동을 달마다 보여 준다"와 "GitHub 활동을 받지 못하면 달력과 활동은 숨기고 나머지는 그대로". 가짜 API(`e2e/fakeApi.ts`)에 활동 응답을 더해 돌린다. 위 캡처도 이 가짜 값이다.
- 커밋은 18개 파일, 1,450줄 더하기, 60줄 지우기다.

## 남은 것·배운 것

- HTML을 읽는 방식은 언젠가 깨진다. 깨져도 조용히 숨기만 하니, 달력이 사라졌는지는 화면을 봐야 알 수 있다.
- 공개 이벤트는 90일치뿐이라, 오래 쉬면 활동 목록이 비고 달력만 남는다.
- 출처가 둘인 화면은 "둘 중 하나만 실패"를 따로 다뤄야 한다. `Promise.all`로 묶었으면 달력 하나 때문에 활동까지 사라졌을 것이다.

## 관련 글

- [GitHub 앱을 서버가 받은 프로필로](/memo/github-live-profile)
- [고정 저장소 카드 크기 맞추기](/memo/github-pinned-card-size)
- [백엔드 설계](/memo/backend-design)

#MacFolio #GitHub
