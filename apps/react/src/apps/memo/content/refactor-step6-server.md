---
title: 리팩터링 6단계 — 서버
date: 2026-10-18
category: 개발기/MacFolio/백엔드
summary: 리팩터링 6단계를 돌아본다. 341줄 AnalyticsService를 저장·집계·조회 셋으로 나누고, 관리자 설정 세 몸통과 데모 네 몸통의 손 검사를 1단계의 공유 스키마로 옮겼다. 경로·응답·거절 문구는 그대로 두고 API e2e 124개로 확인했다.
---

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150))의 6단계는 API 서버였다. 경로·응답·거절 문구는 그대로 두었다.

## 왜

서버는 NestJS 모듈마다 서비스 하나를 두는 모양으로 자랐다. 대부분은 그것으로 충분했지만 트래픽 분석은 달랐다. `AnalyticsService` 하나가 세 가지 일을 했고, 일마다 쓰는 상태가 달랐다.

| 일   | 메서드                                      | 그 일만 쓰는 상태              |
| ---- | ------------------------------------------- | ------------------------------ |
| 저장 | `record`                                    | IP마다 1분 묶음 수 (요청 제한) |
| 집계 | `maintain`, 한 시간마다 도는 타이머         | 마지막으로 모은 시각           |
| 조회 | `todayVisitors`, `summary`, `views`, `live` | 오늘 방문자 수, 1분 캐시       |

`summary`를 고치려고 파일을 열면 요청 제한 표와 타이머 코드까지 같이 읽어야 했다. 시험도 마찬가지였다. 집계만 시험하고 싶어도 요청 제한과 캐시가 붙은 클래스를 통째로 만들어야 했다.

입력 검사는 1단계에서 여덟 도메인을 contracts로 옮겼지만, 관리자 설정(사진 캡션, 사람 확인, GitHub 앱 저장소)과 AI 데모(커버, 번역, 요약, 음성)는 서버의 if문으로 남아 있었다. 화면은 같은 상한(200자, 6개, 80자)을 따로 적어 두었다. 음성 데모의 검사 함수는 이랬다.

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

번역·요약·커버도 "공백 정리 → 빈 글 → 긴 글 → 제어 문자 → 막는 말"을 각자 같은 순서로 적었다.

## 무엇을 바꿨나

| 항목                | PR   | 글                                                                          |
| ------------------- | ---- | --------------------------------------------------------------------------- |
| 분석 서비스 나누기  | #233 | [트래픽 분석 서비스를 저장·집계·조회 셋으로](/memo/analytics-service-split) |
| 관리자 설정 세 몸통 | #235 | [손으로 쓴 입력 검사 세 개를 공유 스키마로](/memo/settings-schemas)         |
| 데모 네 몸통        | #236 | [데모 입력 검사 네 개도 공유 스키마로](/memo/demo-input-schemas)            |

## 고른 방법과 버린 방법

| 방법                                     | 좋은 점                                         | 걸린 점                                                      |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| 집계를 별도 작업(cron 컨테이너, 큐)으로  | API 요청과 집계가 완전히 떨어진다               | 서버 한 대(RAM 1GB)에 컨테이너가 늘고, 배포·감시할 것이 는다 |
| 메서드를 파일로만 나누고 클래스는 하나로 | 고칠 것이 적다                                  | 상태를 함께 쓰는 구조는 그대로라 시험이 쉬워지지 않는다      |
| 일마다 서비스 하나, 생성자로 주입 (고름) | 상태가 일마다 갈린다. NestJS가 하던 방식 그대로 | 클래스가 셋이 되어 모듈의 `providers`가 늘어난다             |
| 검사: NestJS DTO + `class-validator`     | 컨트롤러에 데코레이터만 붙이면 된다             | 화면이 같은 규칙을 쓸 수 없다. 1단계에서 이미 버린 방법이다  |

집계는 서버 안의 `setInterval` 타이머로 둔다. 서버가 한 대라 따로 작업 도구를 두지 않는다는 원래 판단을 바꿀 까닭이 없었다.

## 구현

### 분석 서비스를 셋으로

`AnalyticsService` 하나가 이벤트 저장, 지난 날 모으기·오래된 값 지우기, 요약·조회수·최근 방문 조회를 모두 맡고 있었다. 저장(`AnalyticsRecorder`), 집계(`AnalyticsRollup`), 조회(`AnalyticsStats`)로 나누었다.

![AnalyticsService 341줄이 Recorder, Rollup, Stats로 나뉜 도식](./images/refactor-step6-server-split.svg '하는 일마다 한 클래스. 조회가 가장 크다')

세 서비스가 데이터를 주고받는 길은 이렇다.

![이벤트가 Recorder, Rollup, Stats를 거쳐 숫자가 되는 흐름](./images/refactor-step6-server-flow.svg '지난 날은 모은 통계에서, 오늘은 이벤트에서 읽는다')

집계는 모듈이 뜰 때 타이머를 걸고, 요약을 열 때도 밀렸으면 한 번 더 돈다.

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

기간의 행을 돌려주는 `rowsBetween`은 조회가 아니라 집계 쪽에 두었다. "지난 날은 모은 통계에서, 오늘은 이벤트에서 바로 읽는다"는 규칙은 집계가 언제 도는지를 아는 쪽의 일이기 때문이다. 이 PR에서는 `analytics.service.ts`를 `analytics-stats.service.ts`로 옮기고(git이 이름 바꾸기로 잡는다), 저장과 집계만 새 파일로 꺼냈다.

### 검사를 공유 스키마로

검사는 1단계에서 정한 방식을 따랐다. 사진 캡션·사람 확인·GitHub 앱 저장소는 `packages/contracts/src/settings.ts`로, AI 커버·번역·요약·음성 데모는 `packages/contracts/src/demos.ts`로 옮겼다. 데모의 "글 한 칸" 규칙은 `demoText` 하나다.

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

데모마다 상한과 문구만 넘긴다. 음성 데모의 서버 검사는 이제 한 줄이다.

```ts
// apps/api/src/speech/rules.ts (#236 뒤)
export const parseSpeechRequest = (body: unknown): SpeechRequest => demoInput(parse(SpeechInput, body));
```

`demoInput()`(`common/demo.ts`)은 `parse()`가 이유를 돌려주면 첫 이유로 `DemoInputError`를 던지고, 서비스가 그것을 400(`BadRequestException`)으로 바꾼다. 음성 데모만 갖고 있던 `SpeechInputError`는 네 데모가 함께 쓰는 이 오류 하나로 합쳐졌다. 화면의 데모(`creative/Voice.tsx` 등)는 `MAX_SPEECH_CHARS`와 공급자 목록 `SPEECH_PROVIDERS`를 같은 패키지에서 불러온다.

## 전후

|                              | 전                      | 후                                      |
| ---------------------------- | ----------------------- | --------------------------------------- |
| `AnalyticsService`           | 341줄                   | Recorder 68줄, Rollup 80줄, Stats 203줄 |
| 설정 상한(200자, 6개)·정규식 | 서버 if문과 화면에 따로 | contracts 한 곳                         |
| 데모 상한(60·200·800·80자)   | 서버 함수와 화면에 따로 | contracts 한 곳                         |
| API e2e                      | —                       | 124개 통과                              |

음성 데모의 중복 검사와 `SpeechInputError`는 스키마로 옮기며 없어졌다. 거절 문구와 400 응답은 그대로다.

## 확인

- API e2e 124개: 분석 PR(#233)은 시험 안에서 집계를 직접 부르던 한 줄(`AnalyticsService` → `AnalyticsRollup`)만 고치고 그대로 통과했다.
- 설정 PR(#235): API 단위 157개, contracts 37개(설정 스키마 시험 포함). 문구가 하나 달라진 곳(모르는 키만 보냈을 때 "바꿀 설정이 없습니다."가 덧붙던 것)은 `when`으로 옛 동작을 지켰다.
- 데모 PR(#236): `packages/contracts/src/demos.test.ts`에 시험 5개(공백 정리, 빈 글·긴 글·제어 문자·주소·욕설 거절, 객체가 아닌 몸통, 모르는 값은 기본값, 번역의 칸 수와 합친 상한)를 더했다. 음성의 기존 단위 시험 `speech/rules.test.ts`는 기대하는 오류 클래스만 `SpeechInputError`에서 `DemoInputError`로 바꿨고, 문구("80자")는 그대로 통과했다.
- 개인정보 처리 안내(`docs/privacy.md`)의 "지난 날을 모으는 곳" 경로도 새 파일로 바꿨다.

## 남은 것과 배운 것

- 조회 서비스는 그 뒤 기능이 붙어 지금 234줄이다. 다음에 나눌 곳이 생기면 요약과 실시간을 가르는 것이 먼저다.
- 데모의 하루 상한(`DailyQuota`)은 서버만 아는 값이라 contracts로 옮기지 않았다. 1단계와 같은 기준, "화면도 알아야 하는가"다.
- 상태가 갈리는 곳이 나누는 경계다. 메서드 수나 줄 수보다, 어떤 필드를 누가 쓰는지를 보고 나눴다.

관련 글: [트래픽 분석 서비스를 저장·집계·조회 셋으로](/memo/analytics-service-split) · [손으로 쓴 입력 검사 세 개를 공유 스키마로](/memo/settings-schemas) · [데모 입력 검사 네 개도 공유 스키마로](/memo/demo-input-schemas). PR: [#233](https://github.com/hyeoniverse/MacFolio/pull/233), [#235](https://github.com/hyeoniverse/MacFolio/pull/235), [#236](https://github.com/hyeoniverse/MacFolio/pull/236).

이전 단계: [5단계 — 스타일](/memo/refactor-step5-styles) · 다음 단계: [7단계 — 보안](/memo/refactor-step7-security)

#MacFolio #리팩터링 #NestJS #zod
