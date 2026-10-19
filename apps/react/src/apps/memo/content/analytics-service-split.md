---
title: 트래픽 분석 서비스를 저장·집계·조회 셋으로 나누기
date: 2026-10-16
category: 개발기/MacFolio/백엔드
summary: 341줄짜리 AnalyticsService가 이벤트 저장, 지난 날 모으기·지우기, 요약·조회수 조회를 다 맡고 있었다. 상태를 기준으로 저장·집계·조회 세 서비스로 나누고, 경로·응답은 그대로 둔 채 e2e는 한 줄만 고쳐 통과시켰다.
---

트래픽 분석(#102)은 사이트가 보낸 이벤트를 받아 두었다가, 하루가 지나면 날짜별 통계로 모으고, '활동 상태 보기' 앱과 블로그 조회수에 숫자를 내준다([트래픽 분석 1](/memo/analytics-api)). 이 세 가지 일을 `AnalyticsService` 클래스 하나가 했다.

처음 만들 때는 한 파일이 편했다. 그런데 공개 요약, 글 조회수, 1분 캐시가 차례로 붙으면서 파일이 341줄이 됐다. 요약 하나를 고치려고 파일을 열어도 요청 제한과 타이머 코드를 지나가야 했다. 그 뒤로도 UTM 같은 표가 더 붙을 참이라([트래픽 분석 5](/memo/utm-analytics)), 기능을 더하기 전에 먼저 나눴다. 작업은 PR [#233](https://github.com/hyeoniverse/MacFolio/pull/233)의 커밋 하나다.

## 한 클래스가 하던 일

| 일   | 메서드                                      | 상태                           |
| ---- | ------------------------------------------- | ------------------------------ |
| 저장 | `record`                                    | IP마다 1분 묶음 수 (요청 제한) |
| 집계 | `maintain`, 한 시간마다 도는 타이머         | 마지막으로 모은 시각           |
| 조회 | `todayVisitors`, `summary`, `views`, `live` | 오늘 방문자 수, 1분 캐시       |

메서드마다 쓰는 상태가 다르다. 요청 제한 표는 `record`만 쓰고, 1분 캐시는 조회만 쓴다. 타이머는 모으기만 쓴다. 그런데 한 클래스 안에 있으니 `summary`를 고치려고 열면 요청 제한과 타이머 코드까지 같이 읽어야 했다. 어느 메서드가 어느 필드를 건드리는지 머릿속으로 따라가야 했다.

## 어떻게 나눌까

나누는 기준을 셋 놓고 봤다.

| 기준                                    | 결과                          | 문제                                                            |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| 그대로 두고 주석으로 구역만 나누기      | 바뀌는 것이 없다              | 상태가 여전히 한 클래스 필드라 섞인다                           |
| 순수 함수만 `rules.ts`로 더 빼기        | 서비스가 조금 짧아진다        | 이미 검사·해시·집계는 `rules.ts`에 있었다. 남은 것은 상태다     |
| 상태를 쓰는 곳끼리 서비스로 (고른 방법) | 서비스마다 자기 상태만 갖는다 | 서비스 사이의 의존을 정해야 한다                                |
| 경로마다 서비스 하나                    | 경로와 일이 1:1               | `summary`와 `views`가 같은 캐시·같은 모으기를 쓴다. 둘로 갈린다 |

남은 코드가 길었던 이유는 계산이 아니라 상태였다. 그래서 "어느 상태를 쓰는가"로 묶었다.

## 셋으로 나누기

NestJS에서 서비스(`@Injectable`)는 다른 서비스를 생성자로 받아 쓸 수 있다. 이 성질로 일을 나눴다.

![AnalyticsService를 셋으로](./images/analytics-service-split-classes.svg '컨트롤러는 저장과 조회를 부르고, 조회는 모으기를 집계에 맡긴다')

- **AnalyticsRecorder (저장, 68줄)**: 이벤트 묶음을 검사하고, IP마다 1분에 30번까지 받고, 로봇과 관리자를 빼고 저장한다.
- **AnalyticsRollup (집계, 80줄)**: 한 시간마다(그리고 요약을 열 때) 지난 날의 이벤트를 날짜별 통계로 모으고, 90일 지난 이벤트와 7일 지난 가린 IP를 지운다. 기간의 행을 돌려주는 `rowsBetween`도 여기 둔다. 지난 날은 모은 통계에서, 오늘은 이벤트에서 바로 읽는 규칙이 집계의 일이기 때문이다.
- **AnalyticsStats (조회, 203줄)**: 오늘 방문자·요약·조회수·최근 방문을 만든다. 누구나 부르는 값은 1분 동안 같은 값을 준다. 모으기가 필요하면 `AnalyticsRollup`에 맡긴다.

![서비스마다 가진 상태](./images/analytics-service-split-state.svg '요청 제한 표, 타이머와 마지막으로 모은 시각, 캐시가 각자의 서비스로 갔다')

`rowsBetween`을 어디에 둘지가 가장 오래 고민한 자리였다. 읽는 쪽은 조회지만, "어제까지는 `DailyStat`, 오늘은 이벤트에서 바로"라는 규칙은 모으기가 어디까지 끝났는지를 아는 쪽의 지식이다. 조회에 두면 집계 규칙이 두 곳에 갈린다. 그래서 집계에 두고 조회가 빌려 쓰게 했다.

```ts
@Injectable()
export class AnalyticsStats {
	private today?: { day: string; visitors: number; at: number };
	private readonly publicCache = new Map<string, { at: number; value: unknown }>();

	constructor(
		private readonly prisma: PrismaService,
		private readonly rollup: AnalyticsRollup
	) {}
}
```

의존은 한 방향(조회 → 집계)뿐이다. 저장과 집계는 서로 모른다. 저장은 DB에 이벤트를 넣기만 하고, 집계는 DB에서 이벤트를 꺼내기만 한다. 둘 사이는 표 하나로 이어진다.

## 바꾼 파일

| 파일                                                  | 바뀐 것                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| `analytics.service.ts` → `analytics-stats.service.ts` | 이름을 바꾸고 저장·집계 코드를 덜어 냄 (168줄 덜어 냄) |
| `analytics-recorder.service.ts`                       | 새 파일 68줄                                           |
| `analytics-rollup.service.ts`                         | 새 파일 80줄                                           |
| `analytics.controller.ts`                             | 서비스 하나 대신 둘을 받음                             |
| `analytics.module.ts`                                 | `providers`에 셋                                       |
| `test/analytics.e2e.test.ts`                          | 집계를 직접 부르던 한 줄                               |

컨트롤러는 받는 서비스만 바뀌었다.

```ts
// 전
constructor(private readonly analytics: AnalyticsService) {}
// 후
constructor(
	private readonly recorder: AnalyticsRecorder,
	private readonly stats: AnalyticsStats
) {}
```

`POST /analytics/events`는 `recorder.record`를, 나머지 네 경로는 `stats`를 부른다. 컨트롤러가 집계를 직접 부를 일은 없다.

![나누기 전과 후의 줄 수](./images/analytics-service-split-lines.svg '341줄 하나가 68·80·203줄 셋이 됐다')

## 바꾸지 않은 것

경로, 요청 제한, 응답 모양, 캐시 시간은 하나도 바꾸지 않았다. 그래서 API 시험(e2e) 124개는 시험 안에서 집계를 직접 부르던 한 줄만 고치고 그대로 통과했다.

```ts
await app.get(AnalyticsRollup).maintain(now); // 전: app.get(AnalyticsService)
```

개인정보 처리 안내(`docs/privacy.md`)의 "지난 날을 모으는 곳" 경로도 새 파일로 바꿨다. 이 문서는 코드 경로를 적어 두어서, 파일 이름이 바뀌면 같이 고쳐야 한다.

## 남은 것, 배운 것

- 나눈 지 이틀 뒤 UTM 조합 표를 더했다(커밋 `e62cb61bc`). 고친 곳은 `AnalyticsStats`와 `rules.ts`였고, 저장과 집계 서비스는 열지 않았다. 나눈 효과를 바로 봤다.
- `AnalyticsStats`는 지금 234줄로 다시 자라고 있다. 요약과 실시간이 다른 상태(캐시와 무관한 최근 방문)를 쓰니, 더 커지면 실시간을 따로 뺄 수 있다.
- 클래스를 나눌 때 "메서드가 무슨 일을 하나"보다 "어느 상태를 만지나"를 먼저 봤다. 같은 상태를 쓰는 메서드끼리 묶으면 나눈 뒤 서비스 사이에 오가는 값이 적다.
- 리팩터링 커밋에서 시험은 한 줄만 바뀌어야 한다. 경로와 응답을 그대로 둔 덕에 e2e가 안전망이 됐다.

관련 글: [트래픽 분석 1 - API](/memo/analytics-api), [트래픽 분석 4 - 공개](/memo/analytics-public), [백엔드 설계](/memo/backend-design), [리팩터링 6 - 서버](/memo/refactor-step6-server)

#MacFolio #NestJS #리팩터링 #트래픽분석
