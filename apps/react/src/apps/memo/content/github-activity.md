---
title: 토큰 없이 github.com HTML 조각을 서버에서 파싱하는 기여 달력
date: 2026-10-03
category: 개발 기록/MacFolio/프론트엔드
series: GitHub 앱
seriesOrder: 3
summary: GitHub 앱에 기여 달력(잔디)과 최근 활동을 추가했다. 달력은 토큰 없이 조회하기 위해 github.com의 HTML 조각을 서버에서 파싱하고, 활동은 공개 이벤트를 화면용 형식으로 변환한다. 둘 다 서버 캐시를 거치고, 한쪽만 실패하면 그쪽만 이전 값을 쓴다.
---

GitHub 앱은 프로필, README, 고정 저장소까지만 표시했다. 실제 GitHub 프로필의 주요 요소인 초록색 기여 달력과, 그 아래 "Contribution activity"가 없었다. 이번에 두 섹션을 고정 저장소 아래에 추가했다([#89](https://github.com/hyeoniverse/MacFolio/pull/89)).

GitHub 앱은 [서버가 조회한 프로필](/memo/github-live-profile)을 표시한다. 브라우저가 GitHub API를 직접 호출하지 않고, API 서버가 조회해 캐시한 값을 응답한다. 방문자가 늘어도 GitHub의 [요청 한도](https://docs.github.com/ko/rest/using-the-rest-api/rate-limits-for-the-rest-api)(토큰 없이 시간당 60회)를 넘지 않기 위해서다. 이번 두 기능도 같은 경로를 쓴다.

![GitHub 앱의 기여 달력과 활동 기록](./images/github-activity.jpg '고정 저장소 아래의 기여 달력과 달마다 묶은 활동 기록 (가짜 API 값)')

10월 3일 오후, 고정 저장소를 6개로 줄이면서 GitHub 앱 아래에 기여 기록(contribution)과 활동 기록(history)도 표시하기로 했다. 실제 GitHub 프로필과 나란히 비교하면, 고정 저장소만 있는 화면은 프로필 구성의 절반만 재현한 상태였다.

## 달력은 HTML에서 파싱

기여 달력은 [GraphQL API](https://docs.github.com/ko/graphql)의 `contributionsCollection`으로 조회할 수 있지만, GraphQL API는 토큰 없이 호출할 수 없다. 서버는 토큰 없이도 동작하도록 설계했고(토큰이 있으면 요청 한도만 늘어난다), 달력 하나 때문에 이 원칙을 바꾸지 않기로 했다.

대신 GitHub 프로필 화면이 달력을 렌더링할 때 내려받는 HTML 조각(`github.com/users/<계정>/contributions`)을 서버가 내려받아 파싱한다. 날짜 칸의 HTML은 다음과 같다.

```html
<td data-date="2026-10-03" id="contribution-day-component-6-52" data-level="3" ...></td>
<tool-tip for="contribution-day-component-6-52">12 contributions on October 3rd.</tool-tip>
```

칸에서 날짜와 색 단계(0~4)를, 그 칸을 가리키는 `tool-tip`에서 기여 수를 읽는다. 파싱 코드는 Nest와 DB에 의존하지 않는 `apps/api/src/github/activity.ts`에 두어 단위 시험을 쉽게 했다.

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

HTML을 정규식으로 파싱하는 것은 일반적으로 피하는 방식이다. 여기서는 읽을 값이 `td`와 `tool-tip` 두 태그의 속성 몇 개뿐이라, 서버에 HTML 파서 의존성을 추가하는 것보다 가볍다고 판단했다. 속성 순서에 의존하지 않도록 속성을 하나씩 검색하고, 예상 형식을 하나도 찾지 못하면 `null`을 반환한다. GitHub가 화면 구조를 바꾸면 달력만 사라지고, 앱의 나머지는 그대로 동작한다.

화면에서는 날짜를 일요일부터 시작하는 주 단위로 묶어 53열 × 7행 격자에 배치한다. 첫 주는 앞 칸을 비우고, 달 이름은 그 달의 1일이 포함된 주 위에 표시한다. 창이 좁으면 가로 스크롤하는데, 초기 스크롤 위치는 가장 최근 주가 보이는 오른쪽 끝이다.

달력 조회 방법은 세 가지를 비교했다.

| 방법                              | 토큰   | 장점                         | 단점                                                  |
| --------------------------------- | ------ | ---------------------------- | ----------------------------------------------------- |
| GraphQL `contributionsCollection` | 필요   | 공식 API, 응답 형식이 안정적 | 토큰 없이 동작하는 서버 원칙에 어긋난다               |
| 외부 잔디 이미지 서비스           | 불필요 | 구현할 것이 없다             | 외부 서비스에 의존하고, 다크 모드·크기를 맞출 수 없다 |
| **프로필 화면의 HTML 조각**       | 불필요 | 실제 GitHub 화면과 같은 수치 | GitHub가 화면 구조를 바꾸면 파싱할 수 없다            |

마지막 단점은 "파싱 실패 시 `null`, 화면은 달력만 숨긴다"로 대응했다.

## 활동은 공개 이벤트를 변환

활동 기록은 REST API의 [공개 이벤트](https://docs.github.com/ko/rest/activity/events)(`/users/<계정>/events/public`)를 쓴다. 토큰 없이 호출할 수 있고, 최근 90일치를 반환한다. 이벤트 종류가 많아서 화면에 표시할 종류만 선택했다.

| 이벤트                                           | 화면                                          |
| ------------------------------------------------ | --------------------------------------------- |
| PushEvent                                        | Pushed N commits to 저장소 (브랜치)           |
| PullRequestEvent                                 | Opened·Merged·Closed pull request 저장소#번호 |
| IssuesEvent                                      | Opened·Closed issue 저장소#번호               |
| CreateEvent                                      | Created repository·branch·tag                 |
| ReleaseEvent, WatchEvent, ForkEvent, PublicEvent | 릴리스, 별, 포크, 공개                        |

닫힌 PR 중 병합된 것은 `merged`로 바꾸고, 링크는 `https://github.com/`으로 시작하는 주소만 허용한다. 같은 날 같은 브랜치에 여러 번 푸시한 기록은 한 줄로 합쳐 커밋 수를 더한다. 합치지 않으면 하루에 열 번 푸시한 날이 목록 전체를 차지한다. 합치기는 화면 쪽 `githubActivityApi.ts`의 `mergePushes()`가 처리한다. 하나라도 커밋 수가 없으면(GitHub가 제공하지 않는 경우) 합친 커밋 수도 `null`로 설정한다. 알 수 없는 값을 0으로 더하면 잘못된 숫자가 표시되기 때문이다. 서버는 최근 것부터 30개(`MAX_ACTIVITY`)까지만 반환한다.

![달력과 활동 데이터가 화면까지 전달되는 경로](./images/github-activity-flow.svg '서버가 두 출처를 각각 조회·변환해 캐시하고, 화면은 주 단위 묶기와 푸시 합치기만 한다')

## 캐시 분리

프로필과 같은 방식으로 서버가 조회한 값을 캐시한다(토큰이 없으면 30분, 있으면 10분). 이번에 이 로직을 `Cached` 클래스로 분리해 프로필과 활동이 함께 쓴다. 동시에 여러 요청이 와도 GitHub에는 한 번만 요청하고, 갱신에 실패하면 마지막 값을 반환한다.

달력과 활동은 출처가 달라서 각각 실패할 수 있다. 그래서 둘을 [`Promise.allSettled`](https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)로 조회하고, 한쪽만 실패하면 그쪽은 이전 값을 쓴다.

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

둘 다 실패한 경우에만 요청 전체를 실패로 처리하고 마지막 값을 반환한다. 화면도 같은 원칙이다. 활동 조회에 실패하면 두 섹션만 숨기고, 프로필과 고정 저장소는 그대로 표시한다.

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

- HTML 파싱 방식은 GitHub의 화면 변경에 취약하다. 파싱에 실패해도 오류 없이 달력만 숨기므로, 달력이 사라졌는지는 화면을 확인해야 알 수 있다.
- 공개 이벤트는 90일치뿐이라, 90일 넘게 활동이 없으면 활동 목록이 비고 달력만 남는다.
- 출처가 둘인 화면은 "둘 중 하나만 실패"하는 경우를 별도로 처리해야 한다. `Promise.all`로 묶었다면 달력 하나의 실패로 활동까지 표시되지 않았을 것이다.

## 관련 글

- [API 서버에서 GitHub API 응답을 캐시해 프로필을 실시간 조회하기](/memo/github-live-profile): 서버 캐시 구조
- [grid-auto-rows 1fr와 line-clamp, margin-top auto로 카드 높이 맞추기](/memo/github-pinned-card-size): 같은 앱의 카드 크기 수정
- [요청 계층과 위험별 설계 결정으로 정리한 MacFolio 백엔드 구성도](/memo/backend-design)
- [180px 칸 격자 좌표로 바탕화면 위젯 배치하기](/memo/desktop-widgets): 이 기여 달력을 쓰는 GitHub 위젯

#MacFolio #GitHub
