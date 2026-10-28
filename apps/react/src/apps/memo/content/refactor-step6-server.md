---
title: 리팩터링 6단계 - 책임별 서비스 분리와 공유 zod 스키마로 정리한 서버 코드
date: 2026-10-18
category: 개발 기록/MacFolio/백엔드
summary: 리팩터링 6단계를 정리한다. 341줄 AnalyticsService를 저장·집계·조회 세 서비스로 분리하고, 관리자 설정 세 요청 본문과 데모 네 요청 본문의 수작업 검사를 1단계의 공유 스키마로 옮겼다. 경로·응답·거절 문구는 유지하고 API e2e 124개로 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 6단계 대상은 API 서버였다. 외부에서 관찰되는 경로·응답·거절 문구는 바꾸지 않았다.

## 배경

서버는 NestJS 모듈[^module]마다 서비스 하나를 배치하는 구조로 확장됐다. 대부분의 모듈은 이 구조로 충분했지만 트래픽 분석은 예외였다. `AnalyticsService` 하나가 세 가지 역할을 맡았고, 역할마다 사용하는 상태가 달랐다.

| 역할 | 메서드                                      | 그 역할만 사용하는 상태           |
| ---- | ------------------------------------------- | --------------------------------- |
| 저장 | `record`                                    | IP별 1분 단위 요청 수 (요청 제한) |
| 집계 | `maintain`, 한 시간마다 실행되는 타이머     | 마지막 집계 시각                  |
| 조회 | `todayVisitors`, `summary`, `views`, `live` | 오늘 방문자 수, 1분 캐시          |

`summary`를 수정하려고 파일을 열면 요청 제한 맵과 타이머 코드까지 함께 읽어야 했다. 시험도 같았다. 집계만 시험하려 해도 요청 제한과 캐시가 포함된 클래스 전체를 생성해야 했다.

입력 검사는 1단계([리팩터링 1단계 - zod 스키마와 브랜드 타입으로 화면과 서버의 타입 통합하기](/memo/refactor-step1-types))에서 여덟 도메인을 `packages/contracts`[^contracts]로 옮겼지만, 관리자 설정(사진 캡션, 사람 확인, GitHub 앱 저장소)과 AI 데모(커버, 번역, 요약, 음성)는 서버의 if문으로 남아 있었다. 화면 코드에는 같은 상한(200자, 6개, 80자)이 별도 상수로 중복돼 있었다. 음성 데모의 검사 함수는 다음과 같았다.

```ts
// apps/api/src/speech/rules.ts (#236 전)
export const MAX_SPEECH_CHARS = 80;
export function parseSpeechRequest(body: unknown): SpeechRequest {
	const input = (body ?? {}) as Record<string, unknown>;
	const text = typeof input.text === 'string' ? input.text.replace(/\s+/g, ' ').trim() : '';
	if (!text) throw new SpeechInputError('읽을 글을 써 주세요.');
	if ([...text].length > MAX_SPEECH_CHARS) throw new SpeechInputError(`${MAX_SPEECH_CHARS}자까지만 읽습니다.`);
	if (/\p{Cc}/u.test(text)) throw new SpeechInputError('읽을 수 없는 글자가 있습니다.');
	if (BLOCKED.some((pattern) => pattern.test(text))) throw new SpeechInputError('이 글은 읽어 드릴 수 없습니다.');
	// lang, skip …
}
```

번역·요약·커버 데모도 "공백 정리 → 빈 글 → 긴 글 → 제어 문자 → 차단 단어" 검사를 같은 순서로 각자 구현했다.

## 변경 내용

| 항목                | PR                                                       | 글                                                                                                          |
| ------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 분석 서비스 분리    | [#233](https://github.com/hyeoniverse/MacFolio/pull/233) | [상태 기준으로 AnalyticsService를 저장·집계·조회 서비스로 나누기](/memo/analytics-service-split)            |
| 관리자 설정 세 본문 | [#235](https://github.com/hyeoniverse/MacFolio/pull/235) | [서버 if 문 검사와 화면 상한을 zod 스키마 하나로 합치기](/memo/settings-schemas)                            |
| 데모 네 본문        | [#236](https://github.com/hyeoniverse/MacFolio/pull/236) | [관리자 설정과 AI 데모의 if 문 입력 검사 일곱 개를 contracts의 zod 스키마로 옮기기](/memo/settings-schemas) |

## 검토한 방법

| 방법                                     | 장점                                              | 단점                                                                     |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| 집계를 별도 작업(cron 컨테이너, 큐)으로  | API 요청과 집계가 완전히 분리된다                 | 서버 한 대(RAM 1GB)에 컨테이너가 추가되고, 배포·모니터링 대상이 늘어난다 |
| 메서드를 파일로만 나누고 클래스는 하나로 | 변경량이 적다                                     | 상태를 공유하는 구조가 남아 시험이 쉬워지지 않는다                       |
| 역할마다 서비스 하나, 생성자 주입 (선택) | 상태가 역할별로 분리된다. NestJS 기본 방식 그대로 | 클래스가 셋이 되어 모듈의 `providers`가 늘어난다                         |
| 검사: NestJS DTO + `class-validator`     | 컨트롤러에 데코레이터만 추가하면 된다             | 화면이 같은 규칙을 재사용할 수 없다. 1단계에서 제외한 방법이다           |

집계는 서버 프로세스 안의 `setInterval` 타이머로 유지한다. 서버가 한 대이므로 별도 작업 스케줄러를 운영하지 않는다는 기존 판단을 바꿀 이유가 없었다.

## 구현

### 분석 서비스를 세 클래스로 분리

`AnalyticsService` 하나가 이벤트 저장, 지난 날짜 집계·오래된 데이터 삭제, 요약·조회수·최근 방문 조회를 모두 담당했다. 이를 저장(`AnalyticsRecorder`), 집계(`AnalyticsRollup`), 조회(`AnalyticsStats`)로 분리했다.

![AnalyticsService 341줄이 Recorder, Rollup, Stats로 나뉜 도식](./images/refactor-step6-server-split.svg '역할마다 클래스 하나. 조회 클래스가 가장 크다')

세 서비스 사이의 데이터 흐름은 다음과 같다.

![이벤트가 Recorder, Rollup, Stats를 거쳐 숫자가 되는 흐름](./images/refactor-step6-server-flow.svg '지난 날짜는 집계 테이블에서, 오늘은 이벤트 테이블에서 조회한다')

집계는 모듈 초기화 시점에 타이머를 등록하고, 요약을 조회하는 시각에 집계가 밀려 있으면 한 번 더 실행한다.

```ts
// apps/api/src/analytics/analytics-rollup.service.ts
onModuleInit() {
	// 한 시간마다 지난 날을 모으고 오래된 것을 지운다 (서버 한 대라 따로 작업 도구를 두지 않는다)
	this.timer = setInterval(() => void this.maintain().catch(() => undefined), HOUR);
	this.timer.unref();
}

/** 지난 날 모으기를 5분에 한 번만 (날이 바뀌었으면 바로). 요약·조회수를 열 때 부른다 */
async maintainIfStale(now: Date) {
	const sameDay = kstDay(new Date(this.maintainedAt)) === kstDay(now);
	if (!sameDay || now.getTime() - this.maintainedAt > MAINTAIN_GAP_MS) await this.maintain(now);
}
```

기간 내 행을 반환하는 `rowsBetween`은 조회가 아니라 집계 클래스에 배치했다. "지난 날짜는 집계 테이블에서, 오늘은 이벤트 테이블에서 조회한다"는 규칙은 집계 실행 시점을 아는 클래스의 책임이기 때문이다. 이 PR에서는 `analytics.service.ts`를 `analytics-stats.service.ts`로 이동하고(git이 파일 이름 변경으로 인식한다), 저장과 집계만 새 파일로 분리했다.

### 검사를 공유 스키마로 이동

검사는 1단계에서 정한 방식(zod[^zod] 스키마를 contracts에 정의하고 서버는 `parse()`로 검사)을 따랐다. 사진 캡션·사람 확인·GitHub 앱 저장소는 `packages/contracts/src/settings.ts`로, AI 커버·번역·요약·음성 데모는 `packages/contracts/src/demos.ts`로 옮겼다. 데모의 "텍스트 필드 하나" 규칙은 `demoText` 함수 하나로 정의했다.

```ts
// packages/contracts/src/demos.ts
/** 몸통의 글 한 칸: 공백을 정리하고, 빈 글·긴 글·제어 문자·막는 말을 거절한다 */
export const demoText = ({ max, empty, refused, tooLong, lines = false }: DemoTextRules) =>
	z
		.unknown()
		.optional()
		.transform((value, ctx) => {
			/* 다섯 데모가 하던 순서 그대로 */
		});
```

데모마다 상한과 문구만 인자로 전달한다. 음성 데모의 서버 검사는 한 줄로 줄었다.

```ts
// apps/api/src/speech/rules.ts (#236 뒤)
export const parseSpeechRequest = (body: unknown): SpeechRequest => demoInput(parse(SpeechInput, body));
```

`demoInput()`(`common/demo.ts`)은 `parse()`가 거절 이유를 반환하면 첫 번째 이유로 `DemoInputError`를 던지고, 서비스가 이를 400(`BadRequestException`)으로 변환한다. 음성 데모에만 있던 `SpeechInputError`는 네 데모가 공유하는 이 오류 하나로 통합됐다. 화면의 데모(`creative/Voice.tsx` 등)는 `MAX_SPEECH_CHARS`와 공급자 목록 `SPEECH_PROVIDERS`를 같은 패키지에서 가져온다.

## 전후

|                              | 전                      | 후                                      |
| ---------------------------- | ----------------------- | --------------------------------------- |
| `AnalyticsService`           | 341줄                   | Recorder 68줄, Rollup 80줄, Stats 203줄 |
| 설정 상한(200자, 6개)·정규식 | 서버 if문과 화면에 중복 | contracts 한 곳                         |
| 데모 상한(60·200·800·80자)   | 서버 함수와 화면에 중복 | contracts 한 곳                         |
| API e2e                      | —                       | 124개 통과                              |

음성 데모의 중복 검사와 `SpeechInputError`는 스키마로 이동하면서 삭제됐다. 거절 문구와 400 응답은 유지된다.

## 확인

- API e2e 124개: 분석 PR([#233](https://github.com/hyeoniverse/MacFolio/pull/233))은 시험에서 집계를 직접 호출하던 한 줄(`AnalyticsService` → `AnalyticsRollup`)만 수정하고 통과했다.
- 설정 PR([#235](https://github.com/hyeoniverse/MacFolio/pull/235)): API 단위 157개, contracts 37개(설정 스키마 시험 포함). 문구가 달라질 뻔한 한 곳(알 수 없는 키만 보냈을 때 "바꿀 설정이 없습니다."가 추가되던 동작)은 zod의 `when` 옵션으로 기존 동작을 유지했다.
- 데모 PR([#236](https://github.com/hyeoniverse/MacFolio/pull/236)): `packages/contracts/src/demos.test.ts`에 시험 5개(공백 정리, 빈 글·긴 글·제어 문자·주소·욕설 거절, 객체가 아닌 본문, 알 수 없는 값은 기본값, 번역의 필드 수와 합산 상한)를 추가했다. 음성의 기존 단위 시험 `speech/rules.test.ts`는 기대 오류 클래스만 `SpeechInputError`에서 `DemoInputError`로 바꿨고, 문구("80자")는 변경 없이 통과했다.
- 개인정보 처리 안내(`docs/privacy.md`)에 적힌 집계 코드 경로도 새 파일로 수정했다.

## 직접 확인하는 방법

서버 리팩터링은 외부에서 관찰되는 응답이 바뀌지 않아야 한다. 다음 세 명령으로 확인한다.

```bash
pnpm --filter @macfolio/api typecheck
pnpm --filter @macfolio/api test
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

분리한 서비스는 [apps/api/src/analytics/analytics-stats.service.ts](https://github.com/hyeoniverse/MacFolio/blob/main/apps/api/src/analytics/analytics-stats.service.ts)와 같은 폴더에 있다. 데모 공용 규칙은 [packages/contracts/src/demos.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/contracts/src/demos.ts)에 있고 화면과 서버가 공유한다. 서버 구조 전체는 [docs/backend-design.md](https://github.com/hyeoniverse/MacFolio/blob/main/docs/backend-design.md).

참고 문서: [NestJS 모듈](https://docs.nestjs.com/modules), [NestJS 프로바이더](https://docs.nestjs.com/providers), [NestJS 생명주기 이벤트](https://docs.nestjs.com/fundamentals/lifecycle-events), [zod](https://zod.dev/).

## 남은 과제와 정리

- 조회 서비스는 이후 기능이 추가되어 2026-10-23 기준 246줄이다. 다시 분리한다면 요약과 실시간 조회를 먼저 나눈다.
- 데모의 일일 상한(`DailyQuota`)은 서버만 사용하는 값이라 contracts로 옮기지 않았다. 기준은 1단계와 같은 "화면도 이 값을 알아야 하는가"다.
- 분리 경계는 상태가 나뉘는 위치로 정했다. 메서드 수나 줄 수가 아니라, 어떤 필드를 어느 메서드가 사용하는지를 기준으로 나눴다.

이전 단계: [5단계 — 스타일](/memo/refactor-step5-styles) · 다음 단계: [7단계 — 보안](/memo/refactor-step7-security)

## 관련 글

- [상태 기준으로 AnalyticsService를 저장·집계·조회 서비스로 나누기](/memo/analytics-service-split)
- [서버 if 문 검사와 화면 상한을 zod 스키마 하나로 합치기](/memo/settings-schemas)
- [리팩터링 1단계 - zod 스키마와 브랜드 타입으로 화면과 서버의 타입 통합하기](/memo/refactor-step1-types)

[^module]: NestJS에서 컨트롤러와 서비스(프로바이더)를 묶는 단위. `@Module()`의 `providers`에 등록한 클래스는 생성자 주입으로 서로를 받는다.

[^contracts]: API 요청·응답 형태를 zod 스키마로 정의한 패키지. 서버는 스키마로 검사하고, 화면은 같은 이름의 타입만 가져온다.

[^zod]: TypeScript용 스키마 검증 라이브러리. 스키마 하나에서 런타임 검사와 정적 타입을 함께 얻는다.

#MacFolio #리팩터링 #NestJS #zod
