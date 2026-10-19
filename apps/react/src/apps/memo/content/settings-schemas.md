---
title: 손으로 쓴 입력 검사 세 개를 공유 스키마로 — 서버와 화면이 같은 규칙을 쓰게
date: 2026-10-16
category: 개발기/MacFolio/백엔드
summary: 사진 캡션·사람 확인 설정·GitHub 앱 저장소는 서버가 if 문으로 몸통을 검사했고, 화면은 같은 숫자(200자, 6개)와 정규식을 따로 적어 두었다. 세 규칙을 @macfolio/contracts의 zod 스키마로 옮겨 한 곳에서 쓰게 했다. 거절 문구는 그대로다.
---

API가 받는 몸통은 대부분 이미 `@macfolio/contracts`의 zod 스키마로 검사한다. 댓글·글·메시지·메일·배경화면이 그렇다. 남은 곳은 관리자 설정 화면이 보내는 세 몸통이었다.

## 남아 있던 세 곳

| 경로                   | 서버 검사                                 | 화면에 따로 적힌 값             |
| ---------------------- | ----------------------------------------- | ------------------------------- |
| `PUT /photos/captions` | `typeof` 검사와 정규식, 200자             | `CAPTION_MAX = 200`             |
| `PUT /security`        | 키를 돌며 `typeof field !== 'boolean'`    | `HUMAN_CHECKS` 목록             |
| `PUT /github/showcase` | 배열인지, 6개 이하인지, 이름 정규식, 중복 | `MAX_SHOWCASE = 6`, 같은 정규식 |

화면 쪽 주석에는 "서버와 같다"고 적혀 있었다. 같다는 것을 주석이 약속할 뿐이라, 한쪽만 바꾸면 화면은 받아 주고 서버는 거절하는 일이 생긴다.

실제로 저장소 이름 정규식은 두 벌이었다.

```ts
// apps/react/src/apps/github/githubApi.ts (#235 전)
/** 보일 저장소는 GitHub의 Pinned처럼 6개까지 (서버와 같다) */
export const MAX_SHOWCASE = 6;
/** "owner/이름" 모양인지 (서버와 같은 규칙) */
export const isFullName = (value: string) =>
	/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(value) && !/\/\.{1,2}$/.test(value);
```

사람 확인 설정의 서버 검사는 키를 하나씩 돌며 이유를 모았다.

```ts
// apps/api/src/security/rules.ts (#235 전)
if (typeof input !== 'object' || input === null || Array.isArray(input)) return { errors: ['설정을 보내 주세요.'] };
const errors: string[] = [];
const value: Partial<SecuritySettings> = {};
for (const [key, field] of Object.entries(input)) {
	if (!(HUMAN_CHECKS as readonly string[]).includes(key)) errors.push(`알 수 없는 설정입니다: ${key}`);
	else if (typeof field !== 'boolean') errors.push(`${key}는 켜기(true)나 끄기(false)여야 합니다.`);
	else value[key as HumanCheck] = field;
}
if (!errors.length && Object.keys(value).length === 0) errors.push('바꿀 설정이 없습니다.');
```

리팩터링 1단계에서는 요청·응답 도메인 여덟을 옮겼고, 관리자 설정과 데모 입력은 6단계(서버)로 남겨 두었다. 이 글은 그중 관리자 설정 셋이다.

## zod 스키마로 옮기기

zod는 값의 모양을 코드로 적어 두고, 그 모양에 맞는지 검사하는 라이브러리다. 검사에 통과하면 다듬은 값을, 아니면 이유 목록을 돌려준다. 스키마에서 TypeScript 타입도 뽑을 수 있어서 서버와 화면이 같은 타입을 쓴다.

```ts
export const ShowcaseInput = z.object({
	repos: z
		.array(z.custom<string>(isFullName, { error: (issue) => `저장소 이름이 올바르지 않습니다: ${issue.input}` }))
		.max(MAX_SHOWCASE, `저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`)
		.superRefine(/* 같은 저장소가 두 번 있으면 거절 */),
});
```

사람 확인 설정은 `strictObject`로 모르는 키를 거절한다. zod는 모르는 키를 `unrecognized_keys` 하나로 알려 주므로, 문구를 그 경우에 맞춰 만든다.

```ts
export const SecurityUpdate = z
	.strictObject(
		{ contact: toggle('contact'), comment: toggle('comment'), message: toggle('message') },
		{
			error: (issue) =>
				issue.code === 'unrecognized_keys' ? `알 수 없는 설정입니다: ${issue.keys.join(', ')}` : '설정을 보내 주세요.',
		}
	)
	.refine((value) => Object.values(value).some((field) => field !== undefined), {
		error: '바꿀 설정이 없습니다.',
		when: (payload) => payload.issues.length === 0,
	});
```

캡션은 글자 수를 `Array.from(caption).length`로 센다. `caption.length`는 UTF-16 단위라 이모지 하나를 2로 센다. DB의 CHECK 제약과 같은 기준을 지키려고 옛 코드의 세는 방법을 그대로 옮겼다.

서버의 검사 함수는 이제 한 줄이다. `parseShowcase(input)`는 `parse(ShowcaseInput, input)`을 불러 결과만 돌려준다. 화면은 `MAX_SHOWCASE`와 `isFullName`을 같은 패키지에서 불러온다.

![contracts의 settings.ts 한 곳에 규칙을 두고 API와 관리자 설정 화면이 함께 불러 쓴다](./images/settings-schemas-shared.svg '규칙은 한 곳에서, 서버와 화면이 같은 값을 쓴다')

## 문구를 그대로 두기

검사 방법은 바꾸되 사용자에게 보이는 거절 문구는 바꾸지 않았다. 기존 단위 시험이 문구를 그대로 비교하기 때문이다. 한 곳에서 차이가 났다.

- **사람 확인 설정에 모르는 키만 보냈을 때**: 옛 코드는 "알 수 없는 설정입니다: likes" 하나를 알렸다. zod로 옮기자 "바꿀 설정이 없습니다."가 함께 나왔다. 모르는 키를 빼고 나면 바꿀 것이 없으니 둘 다 맞는 말이지만, 첫 이유만 보여 주는 편이 덜 헷갈린다. "바꿀 설정이 없습니다" 검사에 `when`(앞의 검사가 모두 통과했을 때만 실행)을 붙여 옛 동작을 지켰다.

## 고른 방법과 버린 방법

| 방법                                    | 좋은 점                     | 걸린 점                                                                     |
| --------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| 주석 약속을 그대로 두고 시험으로 맞추기 | 코드를 옮기지 않는다        | 서버와 화면 값이 같은지 보는 시험이 따로 필요하고, 정규식은 비교하기 어렵다 |
| 서버가 상한을 API로 내려 주기           | 한 곳에서 바꾼다            | 화면이 쓰기 전에 요청이 하나 늘고, 정규식 같은 함수는 내려 줄 수 없다       |
| 공유 패키지에 스키마와 상수 (고름)      | 값과 함수를 둘 다 같이 쓴다 | 1단계와 같은 방식이라 걸리는 것이 없다                                      |

## 결과

![서버 검사 파일 세 개의 줄 수 전후](./images/settings-schemas-lines.svg '규칙은 contracts로 옮기고 서버는 부르기만 한다')

- 서버의 손으로 쓴 검사 세 개가 사라지고, 규칙은 `packages/contracts/src/settings.ts` 한 곳에 있다.
- 화면에서 "서버와 같다"고 주석으로 약속하던 값 셋(캡션 길이, 저장소 수, 사람 확인 목록)과 저장소 이름 정규식을 같은 패키지에서 불러온다.
- API 시험 단위 157개·e2e 124개, 계약 패키지 시험 37개(새로 더한 설정 스키마 시험 포함)가 통과한다.

## 같은 방식으로 옮길 때

스키마는 [packages/contracts/src/settings.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/contracts/src/settings.ts)에 두고 서버와 화면이 같은 것을 import한다. 옮길 때 순서는 이렇다.

1. 지금 서버가 내는 오류 문구를 시험으로 먼저 고정한다(문구가 바뀌면 화면이 깨진다)
2. zod 스키마를 만들고 서버의 if 문을 `safeParse`로 바꾼다
3. 화면의 입력 검사도 같은 스키마로 바꾼다

```bash
pnpm test
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

참고 문서: [Zod](https://zod.dev/), [NestJS 파이프와 검증](https://docs.nestjs.com/pipes).

## 배운 것

- **주석의 "같다"는 약속이 아니다.** 같아야 하는 값은 한 곳에 두고 양쪽이 불러야 한다.
- **문구 시험이 이동을 지켰다.** 기존 단위 시험이 거절 문구를 그대로 비교하고 있어서, 검사 방법을 바꾸고도 사용자에게 보이는 것은 같다는 것을 확인할 수 있었다. 달라진 한 곳(모르는 키)도 시험이 먼저 알려 줬다.
- **zod의 `when`.** 앞의 검사가 실패했을 때 뒤의 검사를 건너뛰는 방법이다. 옛 코드의 `if (!errors.length && …)`를 그대로 옮길 수 있었다.

관련 글: [리팩터링 6단계 — 서버](/memo/refactor-step6-server) · [데모 입력 검사 네 개도 공유 스키마로](/memo/demo-input-schemas) · [응답 타입을 두 번 적지 않기](/memo/contracts-comments) · [시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings). PR: [#235](https://github.com/hyeoniverse/MacFolio/pull/235).

#MacFolio #zod #NestJS #리팩터링
