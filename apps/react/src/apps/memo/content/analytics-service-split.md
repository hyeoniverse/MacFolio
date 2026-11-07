---
title: 상태 기준으로 AnalyticsService를 저장·집계·조회 서비스로 나누기
date: 2026-10-16
category: 개발 기록/MacFolio/서버·API
series: 트래픽 분석
seriesOrder: 4
summary: 341줄짜리 AnalyticsService가 이벤트 저장, 지난 날짜 집계·삭제, 요약·조회수 조회를 모두 담당했다. 상태를 기준으로 저장·집계·조회 세 서비스로 나누고, 경로·응답은 그대로 둔 채 e2e는 한 줄만 수정해 통과시켰다.
---

트래픽 분석(이슈 [#102](https://github.com/hyeoniverse/MacFolio/issues/102))은 세 가지 일을 한다. 사이트가 전송한 이벤트를 저장하고, 하루가 지나면 날짜별 통계로 집계하고, '활동 상태 보기' 앱과 블로그 조회수에 지표를 응답한다([쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API](/memo/analytics-api)). 이 세 가지를 `AnalyticsService` 클래스 하나가 담당했다.

처음 구현할 당시에는 한 파일이 편했다. 그런데 공개 요약, 글 조회수, 1분 캐시가 차례로 추가되면서 파일이 341줄이 됐다. 요약 계산 하나를 수정하려고 파일을 열어도 요청 제한과 타이머 코드를 함께 읽어야 했다. 이후 UTM 같은 표도 추가할 예정이었으므로([출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics)), 기능을 추가하기 전에 먼저 나눴다. 작업은 [#233](https://github.com/hyeoniverse/MacFolio/pull/233)의 커밋 하나(`8a35ac38b`)다.

## 배경: NestJS 서비스와 리팩터링

### 서비스와 의존성 주입

NestJS는 서버 코드를 **컨트롤러**와 **프로바이더**로 나눈다. 컨트롤러는 HTTP 경로(`GET /analytics/summary` 등)를 받아 요청 값을 꺼내고, 실제 계산과 DB 조회는 프로바이더에 맡긴다. 프로바이더 중 업무 로직을 담는 클래스를 흔히 서비스라고 부르고, `@Injectable()` 데코레이터를 붙인다.

서비스는 다른 서비스를 직접 `new`로 만들지 않고 **생성자 매개변수**로 받는다. 이를 의존성 주입(DI, Dependency Injection)이라고 한다. NestJS의 인젝터가 앱을 시작할 때 생성자의 매개변수 타입을 읽고, 필요한 인스턴스를 먼저 만들어 넘긴다. 예를 들어 `constructor(private readonly prisma: PrismaService)`라고 쓰면 인젝터가 앱 전체에서 하나뿐인 `PrismaService` 인스턴스를 넣어 준다.

![NestJS 문서의 프로바이더 의존 그래프. Value, Component, Factory가 Component에 주입되고, 그 Component들이 Controller에 주입된다](./images/analytics-service-split-nest-providers.png '프로바이더끼리 주입받고, 컨트롤러는 그 결과를 주입받는다. NestJS 공식 문서, Providers')

이 구조 덕분에 클래스를 나누는 비용이 작다. 서비스를 셋으로 나눠도 각 클래스가 생성자에 필요한 것만 적으면 인젝터가 연결한다.

### 리팩터링의 조건

리팩터링(refactoring)은 **외부에서 관찰되는 동작을 바꾸지 않고** 코드의 내부 구조만 바꾸는 작업이다. 이 작업에서 "외부"는 HTTP 경로, 요청 제한 횟수, 응답 JSON 형식, 캐시 시간이다. 이 값이 하나라도 바뀌면 리팩터링이 아니라 기능 변경이 되고, 기존 시험이 실패해야 한다. 그래서 이번 작업의 확인 기준은 "API e2e 시험을 거의 수정하지 않고 통과하는가"로 정했다.

## 한 클래스가 하던 일

| 역할 | 메서드                                      | 사용하는 상태                           |
| ---- | ------------------------------------------- | --------------------------------------- |
| 저장 | `record`                                    | IP마다 1분간 수신한 묶음 수 (요청 제한) |
| 집계 | `maintain`, 한 시간마다 실행되는 타이머     | 마지막 집계 시각                        |
| 조회 | `todayVisitors`, `summary`, `views`, `live` | 오늘 방문자 수, 1분 캐시                |

여기서 **상태**는 요청이 끝나도 서버 메모리에 남아 다음 요청에 영향을 주는 클래스 필드를 말한다. 예를 들어 `batches` 필드에는 `{ '203.0.113.7': { windowStart, count: 12 } }` 같은 값이 쌓이고, 같은 IP의 13번째 묶음이 1분 안에 들어오면 이 값을 보고 판단한다.

메서드마다 사용하는 상태가 다르다. 요청 제한 표는 `record`만, 1분 캐시는 조회만, 타이머는 집계만 사용한다. 그런데 모두 한 클래스의 필드라서 `summary`를 수정하려고 열면 요청 제한과 타이머 코드까지 읽어야 했고, 어느 메서드가 어느 필드를 변경하는지 코드를 따라가며 확인해야 했다. 나누기 직전 코드에서 메서드와 필드의 사용 관계를 표로 그리면 다음과 같다.

![나누기 전 AnalyticsService의 메서드별 필드 사용 표. record는 batches, maintain은 timer와 maintainedAt, 조회 메서드는 today와 publicCache를 쓰고, summary와 views만 maintainedAt을 간접적으로 사용한다](./images/analytics-service-split-cohesion.svg '같은 필드를 쓰는 메서드끼리 세 묶음으로 갈린다. 묶음을 건너는 사용은 조회에서 집계로 가는 빈 원 두 개뿐이다')

표의 점이 세 덩어리로 모인다. 한 모듈 안의 요소가 서로 관련된 정도를 **응집도**(cohesion)라고 하는데, 이 표는 한 클래스 안에 응집도가 높은 묶음 세 개가 섞여 있다는 뜻이다.

## 어떻게 나눌까

나누는 기준을 네 가지 비교했다.

| 기준                                             | 결과                          | 문제                                                             |
| ------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------- |
| 그대로 두고 주석으로 구역만 나누기               | 바뀌는 것이 없다              | 상태가 여전히 한 클래스의 필드라 섞인다                          |
| 순수 함수만 `rules.ts`로 더 분리                 | 서비스가 조금 짧아진다        | 검사·해시·집계 함수는 이미 `rules.ts`에 있었다. 남은 것은 상태다 |
| 같은 상태를 쓰는 메서드끼리 서비스로 (고른 방법) | 서비스마다 자기 상태만 갖는다 | 서비스 사이의 의존 방향을 정해야 한다                            |
| 경로마다 서비스 하나                             | 경로와 역할이 1:1             | `summary`와 `views`가 같은 캐시·같은 집계를 쓰는데 둘로 나뉜다   |

==남은 코드가 길었던 원인은 계산이 아니라 상태==였다. 그래서 "어느 상태를 사용하는가"를 기준으로 묶었다. 위 표의 세 덩어리가 그대로 세 서비스가 된다.

## 셋으로 나누기

![AnalyticsService를 셋으로](./images/analytics-service-split-classes.svg '컨트롤러는 저장과 조회를 호출하고, 조회는 집계를 AnalyticsRollup에 위임한다')

| 서비스                     | 줄 (분리 직후) | 역할                                                                                                                                                                          |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AnalyticsRecorder` (저장) | 68             | 이벤트 묶음을 검사하고, IP마다 1분에 30회까지 수신하고, 로봇과 관리자를 제외하고 저장한다                                                                                     |
| `AnalyticsRollup` (집계)   | 80             | 한 시간마다(그리고 요약을 열 때) 지난 날짜의 이벤트를 날짜별 통계로 집계하고, 90일 지난 이벤트와 7일 지난 마스킹 IP를 삭제한다. 기간의 행을 반환하는 `rowsBetween`도 담당한다 |
| `AnalyticsStats` (조회)    | 203            | 오늘 방문자·요약·조회수·최근 방문을 계산한다. 누구나 호출하는 값은 1분간 같은 값을 응답한다. 집계가 필요하면 `AnalyticsRollup`에 위임한다                                     |

![서비스마다 가진 상태](./images/analytics-service-split-state.svg '요청 제한 표, 타이머와 마지막 집계 시각, 캐시가 각자의 서비스로 이동했다')

`rowsBetween`의 위치를 가장 오래 고민했다. 호출하는 쪽은 조회지만, "어제까지는 `DailyStat`, 오늘은 이벤트에서 바로"라는 규칙은 집계가 어디까지 끝났는지를 아는 쪽의 지식이다. 예를 들어 10월 10일부터 16일까지의 요약을 요청하면, 10일~15일은 집계가 끝난 `DailyStat` 행을 읽고 16일(오늘)은 `AnalyticsEvent`를 바로 집계해야 한다. ==조회 서비스에 두면 이 경계 규칙이 두 곳으로 나뉜다==. 그래서 집계 서비스에 두고 조회 서비스가 호출하게 했다.

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

==의존은 한 방향(조회 → 집계)뿐이다==. 저장과 집계는 서로를 참조하지 않는다. 저장은 DB에 이벤트를 넣기만 하고, 집계는 DB에서 이벤트를 읽기만 한다. 둘 사이는 `AnalyticsEvent` 테이블 하나로 연결된다.

모듈에는 세 서비스를 `providers`로 등록하기만 하면 된다. 인젝터는 생성자를 읽어 아래 순서로 인스턴스를 만든다. `AnalyticsStats`가 `AnalyticsRollup`을 요구하므로 Rollup이 먼저 만들어지고, 컨트롤러는 마지막에 Recorder와 Stats를 받는다.

![NestJS 인젝터가 PrismaService를 먼저 만들고 Recorder, Rollup, Stats, Controller 순서로 주입하는 그림](./images/analytics-service-split-injector.svg '번호는 의존 순서다. Rollup은 Stats만 주입받고 컨트롤러에는 들어가지 않는다')

## 바꾼 파일

| 파일                                                  | 변경 내용                                        |
| ----------------------------------------------------- | ------------------------------------------------ |
| `analytics.service.ts` → `analytics-stats.service.ts` | 이름을 바꾸고 저장·집계 코드를 분리 (168줄 감소) |
| `analytics-recorder.service.ts`                       | 새 파일 68줄                                     |
| `analytics-rollup.service.ts`                         | 새 파일 80줄                                     |
| `analytics.controller.ts`                             | 서비스 하나 대신 둘을 주입받음                   |
| `analytics.module.ts`                                 | `providers`에 세 서비스 등록                     |
| `test/analytics.e2e.test.ts`                          | 집계를 직접 호출하던 한 줄                       |

컨트롤러는 주입받는 서비스만 바뀌었다.

```ts
// 전
constructor(private readonly analytics: AnalyticsService) {}
// 후
constructor(
	private readonly recorder: AnalyticsRecorder,
	private readonly stats: AnalyticsStats
) {}
```

`POST /analytics/events`는 `recorder.record`를, 나머지 네 경로는 `stats`를 호출한다. 컨트롤러가 집계를 직접 호출하는 경우는 없다.

| 경로                     | 호출                  |
| ------------------------ | --------------------- |
| `POST /analytics/events` | `recorder.record`     |
| `GET /analytics/today`   | `stats.todayVisitors` |
| `GET /analytics/summary` | `stats.summary`       |
| `GET /analytics/views`   | `stats.views`         |
| `GET /analytics/live`    | `stats.live`          |

![나누기 전과 후의 줄 수](./images/analytics-service-split-lines.svg '341줄 하나가 68·80·203줄 셋이 됐다')

세 파일의 합은 351줄로 10줄 늘었다. 클래스 선언, import, 생성자가 파일마다 반복되기 때문이다. 대신 요약 계산을 수정할 때 읽어야 하는 파일은 203줄 하나가 됐다.

## 바꾸지 않은 것

경로, 요청 제한, 응답 형식, 캐시 시간은 하나도 바꾸지 않았다. 그래서 당시 API e2e 시험 124개는 시험 안에서 집계를 직접 호출하던 한 줄만 수정하고 그대로 통과했다. e2e 시험은 실제 PostgreSQL에 HTTP 요청을 보내고 응답을 비교하므로, 클래스 이름이 바뀌어도 HTTP 경계의 동작이 같으면 통과한다.

```ts
await app.get(AnalyticsRollup).maintain(now); // 전: app.get(AnalyticsService)
```

> [!WARNING] 코드 경로를 기재한 문서
> 개인정보 처리 안내(`docs/privacy.md`)의 "지난 날을 모으는 곳" 경로도 새 파일로 수정했다. 이 문서는 코드 경로를 기재하고 있어서, 파일 이름이 바뀌면 함께 수정해야 한다.

## 남은 것, 배운 것

- 분리 이틀 뒤 UTM 조합 표를 추가했다(커밋 `e62cb61bc`). 수정한 파일은 `AnalyticsStats`와 `rules.ts`였고, 저장과 집계 서비스는 변경하지 않았다. 분리 효과가 바로 확인됐다.
- `AnalyticsStats`는 2026-10-23 기준 246줄로 다시 늘어나고 있다. 요약과 실시간이 다른 상태(캐시와 무관한 최근 방문)를 사용하므로, 더 커지면 실시간을 별도 서비스로 분리할 수 있다.
- 클래스를 나눌 때 "메서드가 무슨 일을 하나"보다 "어느 상태를 변경하나"를 먼저 확인했다. 같은 상태를 쓰는 메서드끼리 묶으면 분리 후 서비스 사이에 전달되는 값이 적다.
- 리팩터링 커밋에서 시험 변경은 최소여야 한다. 경로와 응답을 그대로 둔 덕에 e2e가 회귀 검출 장치 역할을 했다.

## 따라 해 보기

분리 전후가 같은 동작을 하는지는 HTTP 경계의 시험으로 확인한다. 서비스 이름이 바뀌어도 경로와 응답은 그대로이므로 시험을 수정하지 않고 통과해야 한다.

```bash
cp apps/api/.env.example apps/api/.env       # 처음 한 번
pnpm --filter @macfolio/api db:up            # 로컬 PostgreSQL (Docker)
pnpm --filter @macfolio/api test:e2e test/analytics.e2e.test.ts
```

순환 의존이 생기지 않았는지도 함께 확인한다. 저장·집계·조회가 서로를 순환 참조하지 않게 나눴으므로 결과는 0건이어야 한다.

```bash
pnpm cycles     # madge, 서버·화면·패키지 모두
```

NestJS에서 서비스 여러 개를 한 모듈의 `providers`로 등록하는 방법은 [NestJS 모듈 문서](https://docs.nestjs.com/modules)에 있다. 현재 서버 구조는 [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md)에 있다.

## 관련 글

- [쿠키 없는 하루 해시 순방문자 집계와 세션별로 응답 범위를 나누는 분석 API](/memo/analytics-api)
- [같은 경로에서 세션에 따라 응답 범위를 나누는 분석 요약 API](/memo/analytics-api#요약을-방문자에게-공개한다-세션에-따라-응답-범위를-나눈다)
- [출처·매체·캠페인 조합 키로 집계하는 UTM 분석](/memo/utm-analytics)
- [백엔드 설계](/memo/backend-design)
- [리팩터링 6 - 서버](/memo/refactor-retrospective#6단계-서버)

<details>
<summary>참고 문헌</summary>

- NestJS, [Providers](https://docs.nestjs.com/providers)
- NestJS, [Modules](https://docs.nestjs.com/modules)
- NestJS, [Custom providers: DI fundamentals](https://docs.nestjs.com/fundamentals/custom-providers)
- Martin Fowler, [Refactoring](https://refactoring.com/)
- Wikipedia, [Cohesion (computer science)](<https://en.wikipedia.org/wiki/Cohesion_(computer_science)>)

</details>

<details>
<summary>사진 출처</summary>

- 프로바이더 의존 그래프: NestJS 공식 문서, [Providers](https://docs.nestjs.com/providers) ([원본 그림](https://docs.nestjs.com/assets/Components_1.png)), [MIT 라이선스](https://github.com/nestjs/docs.nestjs.com/blob/master/LICENSE)

</details>

#MacFolio #NestJS #리팩터링 #트래픽분석
