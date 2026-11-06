---
title: 토큰 없이 github.com HTML 조각을 서버에서 파싱하는 기여 달력
date: 2026-10-03
category: 개발 기록/MacFolio/서버·API
series: GitHub 앱
seriesOrder: 3
summary: GitHub 앱에 기여 달력(잔디)과 최근 활동을 추가했다. 달력은 토큰 없이 조회하기 위해 github.com의 HTML 조각을 서버에서 파싱하고, 활동은 공개 이벤트를 화면용 형식으로 변환한다. 둘 다 서버 캐시를 거치고, 한쪽만 실패하면 그쪽만 이전 값을 쓴다.
---

## 기여 달력과 활동 기록

GitHub 프로필 화면에는 저장소 목록 아래에 초록색 칸이 격자로 늘어선 **기여 달력**(contribution graph)이 있다. 한국 개발자 사이에서는 잔디밭처럼 보인다고 해서 "잔디"라고 부른다. 칸 하나가 하루이고, 세로 7칸이 일요일부터 토요일까지의 한 주, 가로 약 53열이 지난 1년이다. 그날 커밋·이슈·풀 리퀘스트(PR) 같은 기여가 많을수록 칸의 초록색이 진해진다.

![GitHub 프로필의 기여 달력. 1년 동안의 날짜가 주 단위 열로 배치되고, 기여가 많은 날일수록 칸이 진한 초록색이다](./images/github-activity-github-graph.png 'GitHub 문서의 기여 달력 예시. 위쪽에 달 이름, 왼쪽에 요일, 오른쪽 아래에 색 단계(Less → More) 범례가 있다')

달력 아래에는 "Contribution activity"라는 활동 기록이 있다. "저장소 A에 커밋 3개를 푸시함", "PR #12를 병합함"처럼 최근에 한 일을 달마다 묶어 한 줄씩 나열한다. 달력이 "얼마나 꾸준히 했는가"를 보여 준다면, 활동 기록은 "구체적으로 무엇을 했는가"를 보여 준다.

MacFolio의 GitHub 앱은 프로필, README, 고정 저장소까지만 표시했다. 실제 GitHub 프로필과 나란히 비교하면 프로필 구성의 절반만 재현한 상태였다. 10월 3일 오후, 고정 저장소를 6개로 줄이면서 두 섹션을 고정 저장소 아래에 추가했다([#89](https://github.com/hyeoniverse/MacFolio/pull/89)).

![GitHub 앱의 기여 달력과 활동 기록](./images/github-activity.jpg '고정 저장소 아래의 기여 달력과 달마다 묶은 활동 기록 (가짜 API 값)')

GitHub 앱은 [서버가 조회한 프로필](/memo/github-live-profile)을 표시한다. 브라우저가 GitHub API를 직접 호출하지 않고, API 서버가 조회해 캐시한 값을 응답한다. GitHub API는 토큰 없이 호출하면 IP 주소 하나당 시간당 60회까지만 응답하는 요청 한도(rate limit)가 있다[^rate-limit]. 방문자가 늘어도 이 한도를 넘지 않기 위해 서버가 대신 조회한다. 이번 두 기능도 같은 경로를 쓴다.

## 달력은 HTML에서 파싱

### GraphQL API를 쓰지 않은 이유

GitHub는 두 종류의 API를 제공한다. REST API는 `/users/<계정>`처럼 주소마다 정해진 형식의 JSON을 반환하고, [GraphQL API](https://docs.github.com/ko/graphql)는 요청 본문에 필요한 필드를 직접 적어 한 번에 조회한다. 기여 달력은 GraphQL의 `contributionsCollection` 필드로 조회할 수 있지만, ==GraphQL API는 토큰 없이 호출할 수 없다==. 서버는 토큰 없이도 동작하도록 설계했고(토큰이 있으면 요청 한도만 시간당 5,000회로 늘어난다), 달력 하나 때문에 이 원칙을 바꾸지 않기로 했다.

달력 조회 방법은 세 가지를 비교했다.

| 방법                              | 토큰   | 장점                         | 단점                                                  |
| --------------------------------- | ------ | ---------------------------- | ----------------------------------------------------- |
| GraphQL `contributionsCollection` | 필요   | 공식 API, 응답 형식이 안정적 | 토큰 없이 동작하는 서버 원칙에 어긋난다               |
| 외부 잔디 이미지 서비스           | 불필요 | 구현할 것이 없다             | 외부 서비스에 의존하고, 다크 모드·크기를 맞출 수 없다 |
| **프로필 화면의 HTML 조각**       | 불필요 | 실제 GitHub 화면과 같은 수치 | GitHub가 화면 구조를 바꾸면 파싱할 수 없다            |

### HTML 조각의 구조

GitHub 프로필 화면은 달력 부분을 별도 주소(`github.com/users/<계정>/contributions`)에서 HTML 조각으로 받아 끼워 넣는다. 이 주소는 로그인 없이도 응답하므로, 서버가 같은 주소를 요청해 받은 HTML을 파싱한다. 날짜 칸 하나의 HTML은 다음과 같다.

```html
<td data-date="2026-10-03" id="contribution-day-component-6-52" data-level="3" ...></td>
<tool-tip for="contribution-day-component-6-52">12 contributions on October 3rd.</tool-tip>
```

`<td>`의 `data-date`가 날짜, `data-level`이 색 단계(0~4)다. 기여 수는 `<td>`에 없고, 마우스를 올리면 표시되는 말풍선 `<tool-tip>`의 글자에 있다. `tool-tip`의 `for` 속성 값이 `<td>`의 `id`와 같으므로, 먼저 모든 `tool-tip`에서 "id → 기여 수" 표를 만들고 `<td>`를 읽을 때 그 표에서 기여 수를 찾는다. 위 예는 `{ date: '2026-10-03', level: 3, count: 12 }`가 된다.

파싱 코드는 Nest와 DB에 의존하지 않는 `apps/api/src/github/activity.ts`에 두어 단위 시험을 쉽게 했다.

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

HTML을 정규식으로 파싱하는 것은 일반적으로 피하는 방식이다. HTML은 따옴표 생략, 주석, 중첩 같은 경우가 많아 정규식 하나로 모든 문서를 정확히 읽을 수 없기 때문이다. 여기서는 읽을 값이 `td`와 `tool-tip` 두 태그의 속성 몇 개뿐이라, 서버에 HTML 파서 의존성을 추가하는 것보다 가볍다고 판단했다. 대신 다음 세 가지로 형식 변화에 대비했다.

- 속성 순서에 의존하지 않도록 태그 문자열에서 속성을 하나씩 검색한다. `data-level`이 `data-date`보다 앞에 있어도 읽는다.
- `data-level`은 0~4 범위로 자른다. `7`이 오면 `4`, 숫자가 아니면 `0`이다.
- 예상 형식을 하나도 찾지 못하면 `null`을 반환한다.

==GitHub가 화면 구조를 바꾸면 달력만 사라지고, 앱의 나머지는 그대로 동작한다==.

### 격자 배치

서버는 날짜 순서대로 나열한 목록만 반환한다. 이 목록을 격자에 배치하는 일은 화면 쪽 `toWeeks()`가 담당한다. 날짜를 일요일부터 시작하는 주 단위로 7개씩 묶어 한 열로 만들고, 53열 × 7행 격자에 배치한다. 목록의 첫 날이 일요일이 아닐 수 있으므로, 첫 주는 그 날의 요일 수만큼 앞 칸을 `null`로 채운다.

![2025-10-01(수요일)부터 시작하는 날짜 목록을 주 단위 열로 배치한 예. 첫 열의 일·월·화는 null이고, Nov 라벨은 11월 1일이 든 다섯째 열 위에 있다](./images/github-activity-weeks.svg '서버가 HTML의 td와 tool-tip에서 만든 값이 격자의 한 칸이 된다')

예를 들어 첫 날이 2025-10-01(수요일)이면 `getUTCDay()`가 `3`을 반환하므로 첫 열은 `[null, null, null, 10/1, 10/2, 10/3, 10/4]`가 된다. 달 이름은 그 달의 1일이 포함된 주 위에 표시한다. 11월 1일은 다섯째 열의 토요일 칸에 있으므로 "Nov"는 다섯째 열 위에 표시된다. 창이 좁으면 가로 스크롤하는데, 초기 스크롤 위치는 가장 최근 주가 보이는 오른쪽 끝이다.

## 활동은 공개 이벤트를 변환

활동 기록은 REST API의 [공개 이벤트](https://docs.github.com/ko/rest/activity/events)(`/users/<계정>/events/public`)를 쓴다. 이벤트는 GitHub에서 일어난 행동 하나를 기록한 JSON 객체로, `type`(종류), `repo`(저장소), `payload`(종류별 세부 내용), `created_at`(시각)을 포함한다. 토큰 없이 호출할 수 있고, GitHub 문서 기준 최근 30일 안의 이벤트를 최대 300개까지 반환한다. 서버는 그중 첫 페이지 100개만 요청한다.

이벤트 종류가 많아서 화면에 표시할 종류만 선택했다.

| 이벤트                                           | 화면                                          |
| ------------------------------------------------ | --------------------------------------------- |
| PushEvent                                        | Pushed N commits to 저장소 (브랜치)           |
| PullRequestEvent                                 | Opened·Merged·Closed pull request 저장소#번호 |
| IssuesEvent                                      | Opened·Closed issue 저장소#번호               |
| CreateEvent                                      | Created repository·branch·tag                 |
| ReleaseEvent, WatchEvent, ForkEvent, PublicEvent | 릴리스, 별, 포크, 공개                        |

변환 규칙은 다음과 같다.

- GitHub 이벤트에는 "병합됨"이라는 별도 동작이 없고, PR이 닫힐 때 `closed`와 함께 병합 여부가 따로 온다. 닫힌 PR 중 병합된 것은 `merged`로 바꾼다.
- 링크는 `https://github.com/`으로 시작하는 주소만 허용한다. 화면이 이 값을 링크로 렌더링하므로, 다른 주소가 들어오면 그 항목을 버린다.
- 표에 없는 종류, 비공개 저장소, 형식이 틀린 이벤트는 `null`로 변환해 제외한다.
- 서버는 최근 것부터 30개(`MAX_ACTIVITY`)까지만 반환한다.

같은 날 같은 브랜치에 여러 번 푸시한 기록은 한 줄로 합쳐 커밋 수를 더한다. 합치지 않으면 하루에 열 번 푸시한 날이 목록 전체를 차지한다. 합치기는 화면 쪽 `githubActivityApi.ts`의 `mergePushes()`가 처리한다.

| 입력 (같은 날, 같은 저장소·브랜치) | 커밋 수          | 합친 결과             |
| ---------------------------------- | ---------------- | --------------------- |
| 푸시 3번                           | 2, 1, 4          | 한 줄, 커밋 7개       |
| 푸시 3번                           | 2, 알 수 없음, 4 | 한 줄, 커밋 수 `null` |

두 번째 행처럼 하나라도 커밋 수가 없으면(GitHub가 제공하지 않는 경우) 합친 커밋 수도 `null`로 설정한다. ==알 수 없는 값을 0으로 더하면 잘못된 숫자가 표시되기 때문이다==. `2 + 0 + 4 = 6`으로 표시하면 실제보다 적은 숫자를 사실처럼 보여 주게 된다.

![달력과 활동 데이터가 화면까지 전달되는 경로](./images/github-activity-flow.svg '서버가 두 출처를 각각 조회·변환해 캐시하고, 화면은 주 단위 묶기와 푸시 합치기만 한다')

## 캐시 분리

프로필과 같은 방식으로 서버가 조회한 값을 캐시한다(토큰이 없으면 30분, 있으면 10분). 이번에 이 로직을 `Cached` 클래스로 분리해 프로필과 활동이 함께 쓴다. 동시에 여러 요청이 와도 GitHub에는 한 번만 요청하고, 갱신에 실패하면 마지막 값을 반환한다.

달력과 활동은 출처가 달라서 각각 실패할 수 있다. 달력은 github.com의 웹 페이지이고, 활동은 api.github.com의 REST API다. 둘을 함께 기다리는 방법은 두 가지다. [`Promise.all`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)은 하나라도 실패하면 즉시 전체를 실패로 처리하고, [`Promise.allSettled`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)는 모두 끝날 때까지 기다린 뒤 각각의 성공·실패 결과를 배열로 반환한다.

![달력 요청만 실패했을 때 Promise.all은 활동까지 버리고, Promise.allSettled는 활동 새 값을 쓰고 달력만 이전 값으로 대체한다](./images/github-activity-allsettled.svg '같은 두 요청이라도 기다리는 함수에 따라 결과가 달라진다')

그래서 둘을 `Promise.allSettled`로 조회하고, 한쪽만 실패하면 그쪽은 이전 값을 쓴다.

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

==둘 다 실패한 경우에만 요청 전체를 실패로 처리==하고 마지막 값을 반환한다. 화면도 같은 원칙이다. 활동 조회에 실패하면 두 섹션만 숨기고, 프로필과 고정 저장소는 그대로 표시한다.

| 달력 HTML | 이벤트 | 서버 응답                                                       |
| --------- | ------ | --------------------------------------------------------------- |
| 성공      | 성공   | 둘 다 새 값                                                     |
| 실패      | 성공   | 달력은 이전 값, 활동은 새 값                                    |
| 성공      | 실패   | 달력은 새 값, 활동은 이전 값                                    |
| 실패      | 실패   | `Cached`가 마지막 값 (없으면 요청 실패 → 화면은 두 섹션을 숨김) |

활동 조회에는 계정 이름이 필요하다. 프로필이 이미 캐시되어 있으면 그 값(`profileCache.peek()`)을 쓰고 GitHub에 계정을 다시 조회하지 않는다. 요청이 하나 줄어든다.

## 확인

<details>
<summary>단위 시험과 E2E 시험 이름</summary>

- 서버 단위 시험 `apps/api/src/github/activity.test.ts` 10개. "날짜 칸의 단계와 설명의 기여 수를 읽고, 날짜 순서로 둔다", "속성 순서가 바뀌어도 읽고, 단계는 0~4로 자른다", "달력 모양이 없으면 null", "닫힌 PR 가운데 합친 것은 merged, 주소는 GitHub 주소만", "보여 주지 않는 종류, 비공개, 모양이 틀린 이벤트는 null" 등이다.
- `github.service.test.ts`에 "기여 달력만 받지 못하면 그 부분은 이전 값을, 둘 다 받지 못하면 마지막 값을 준다"와 "프로필을 이미 받았으면 계정을 다시 묻지 않고…"를 추가했다.
- 화면 쪽 `githubActivityApi.test.ts`는 "일요일부터 시작하는 주로 묶고, 첫 주의 앞 칸은 비운다", "같은 날 같은 저장소·브랜치의 푸시는 하나로 합쳐 커밋 수를 더한다", "한쪽이라도 커밋 수를 모르면 합친 커밋 수도 모른다"를 확인한다.
- E2E `e2e/github.spec.ts`의 "Pinned 아래에 지난 1년의 기여 달력과 최근 활동을 달마다 보여 준다"와 "GitHub 활동을 받지 못하면 달력과 활동은 숨기고 나머지는 그대로". 가짜 API(`e2e/fakeApi.ts`)에 활동 응답을 추가해 실행한다. 위 캡처도 이 가짜 값이다.

</details>

- 커밋은 18개 파일, +1,450/−60이다.

## 남은 것·배운 것

> [!WARNING] 화면 변경에 취약한 파싱
> HTML 파싱 방식은 GitHub의 화면 변경에 취약하다. 파싱에 실패해도 오류 없이 달력만 숨기므로, 달력이 사라졌는지는 화면을 확인해야 알 수 있다.

- 공개 이벤트는 최근 30일치뿐이라, 30일 넘게 활동이 없으면 활동 목록이 비고 달력만 남는다.
- 출처가 둘인 화면은 "둘 중 하나만 실패"하는 경우를 별도로 처리해야 한다. `Promise.all`로 묶었다면 달력 하나의 실패로 활동까지 표시되지 않았을 것이다.

## 관련 글

- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile): 서버 캐시 구조
- [grid-auto-rows 1fr와 line-clamp, margin-top auto로 카드 높이 맞추기](/memo/github-pinned-card-size): 같은 앱의 카드 크기 수정
- [요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도](/memo/backend-design)
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 이 기여 달력을 쓰는 GitHub 위젯

<details>
<summary>참고 문헌</summary>

- GitHub Docs, [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile)
- GitHub Docs, [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- GitHub Docs, [REST API endpoints for events](https://docs.github.com/en/rest/activity/events)
- GitHub Changelog, [Upcoming changes to data retention for Events API, Atom feed, /timeline and /dashboard-feed features](https://github.blog/changelog/2024-11-08-upcoming-changes-to-data-retention-for-events-api-atom-feed-timeline-and-dashboard-feed-features/)
- GitHub Docs, [About the GraphQL API](https://docs.github.com/en/graphql/overview/about-the-graphql-api)
- MDN, [Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
- MDN, [Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)

</details>

<details>
<summary>사진 출처</summary>

- GitHub 기여 달력 예시: GitHub Docs, [Contributions on your profile](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile), CC BY 4.0

</details>

[^rate-limit]: GitHub 문서에 따르면 인증하지 않은 REST API 요청은 IP 주소마다 시간당 60회, 개인 접근 토큰으로 인증한 요청은 시간당 5,000회까지 허용된다. 한도를 넘으면 `403` 또는 `429`로 응답하고, 응답 헤더 `x-ratelimit-remaining`이 `0`이 된다.

#MacFolio #GitHub
