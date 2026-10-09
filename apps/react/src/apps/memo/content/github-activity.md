---
title: GitHub 앱에 잔디와 활동 기록 더하기
date: 2026-10-03
category: 프론트엔드/기능
summary: GitHub 앱의 고정 저장소 아래에 지난 1년의 기여 달력(잔디)과 최근 공개 활동을 붙였다. 달력은 API로 토큰 없이 읽을 길이 없어 github.com의 HTML 조각을 서버에서 읽고, 활동은 공개 이벤트 API를 다듬어 쓴다. 둘 다 서버 캐시 뒤에 두고, 한쪽만 실패하면 그쪽만 이전 값을 쓴다.
---

GitHub 앱은 프로필, README, 고정 저장소까지만 보여 줬다. 실제 GitHub 프로필에서 가장 먼저 눈에 들어오는 초록색 달력과, 그 아래 "Contribution activity"가 없었다. 이번에 두 가지를 고정 저장소 아래에 붙였다.

![GitHub 앱의 기여 달력과 활동 기록](./images/github-activity.jpg '고정 저장소 아래의 기여 달력과 달마다 묶은 활동 기록 (가짜 API 값)')

## 달력은 HTML에서 읽는다

기여 달력은 GraphQL API의 `contributionsCollection`으로 받을 수 있지만, GraphQL은 토큰 없이는 부를 수 없다. 서버는 토큰 없이도 돌아가게 만들어 두었고(있으면 요청 한도만 늘어난다), 그 원칙을 달력 하나 때문에 깨고 싶지 않았다.

대신 GitHub 프로필 화면이 달력을 그릴 때 받는 HTML 조각(`github.com/users/<계정>/contributions`)을 서버가 받아 읽는다. 날짜 칸은 이렇게 생겼다.

```html
<td data-date="2026-10-03" id="contribution-day-component-6-52" data-level="3" ...></td>
<tool-tip for="contribution-day-component-6-52">12 contributions on October 3rd.</tool-tip>
```

칸에서 날짜와 색 단계(0~4)를, 그 칸을 가리키는 `tool-tip`에서 기여 수를 읽는다. 속성 순서에 기대지 않게 속성을 하나씩 찾고, 모양을 하나도 읽지 못하면 `null`을 돌려준다. GitHub가 화면을 바꾸면 달력이 사라질 뿐, 앱의 나머지는 그대로다.

화면에서는 날짜를 일요일부터 시작하는 주로 묶어 53열 × 7행 격자에 놓는다. 첫 주는 앞 칸을 비우고, 달 이름은 그 달의 1일이 든 주 위에 붙인다. 창이 좁으면 가로로 넘기는데, 처음에는 가장 최근 주가 보이게 끝으로 밀어 둔다.

## 활동은 공개 이벤트를 다듬는다

활동 기록은 REST API의 공개 이벤트(`/users/<계정>/events/public`)를 쓴다. 토큰이 없어도 되고, 최근 90일치를 준다. 이벤트는 종류가 많아서 화면에 보일 것만 골랐다.

| 이벤트                                           | 화면                                          |
| ------------------------------------------------ | --------------------------------------------- |
| PushEvent                                        | Pushed N commits to 저장소 (브랜치)           |
| PullRequestEvent                                 | Opened·Merged·Closed pull request 저장소#번호 |
| IssuesEvent                                      | Opened·Closed issue 저장소#번호               |
| CreateEvent                                      | Created repository·branch·tag                 |
| ReleaseEvent, WatchEvent, ForkEvent, PublicEvent | 릴리스, 별, 포크, 공개                        |

닫힌 PR 가운데 합친 것은 `merged`로 바꾸고, 링크는 `https://github.com/`으로 시작하는 주소만 쓴다. 같은 날 같은 브랜치에 여러 번 푸시한 것은 한 줄로 합쳐 커밋 수를 더한다. 그대로 두면 하루에 열 번 푸시한 날이 목록을 다 차지한다.

## 캐시는 둘로

프로필과 같은 방식으로 서버가 받은 값을 들고 있다(토큰이 없으면 30분). 이번에 이 방식을 `Cached` 클래스로 빼서 프로필과 활동이 함께 쓴다. 동시에 여럿이 물어도 GitHub에는 한 번만 묻고, 새로 받지 못하면 마지막 값을 준다.

달력과 활동은 출처가 달라서 따로 실패할 수 있다. 그래서 둘을 `Promise.allSettled`로 받고, 한쪽만 실패하면 그쪽은 이전 값을 쓴다. 둘 다 실패해야 요청 전체가 실패한 것으로 보고 마지막 값을 준다. 화면도 같은 원칙이다. 활동을 받지 못하면 두 섹션만 숨기고, 프로필과 고정 저장소는 그대로 보인다.

#MacFolio #GitHub
