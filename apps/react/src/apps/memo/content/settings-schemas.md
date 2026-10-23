---
title: 손으로 쓴 입력 검사 세 개를 공유 스키마로 — 서버와 화면이 같은 규칙을 쓰게
date: 2026-10-16
category: 개발기/MacFolio/백엔드
summary: 사진 캡션·사람 확인 설정·GitHub 앱 저장소는 서버가 if 문으로 요청 본문을 검사했고, 화면은 같은 상한(200자, 6개)과 정규식을 별도로 정의했다. 세 규칙을 @macfolio/contracts의 zod 스키마로 옮겨 한 곳에서 정의했다. 거절 문구는 그대로다.
---

API가 수신하는 요청 본문은 대부분 이미 `@macfolio/contracts`[^contracts]의 zod 스키마로 검사한다. 댓글·글·메시지·메일·배경화면이 그렇다. 남은 곳은 관리자 설정 화면이 보내는 요청 본문 세 종류였다. 이 글은 이 세 검사를 공유 스키마로 옮긴 [#235](https://github.com/hyeoniverse/MacFolio/pull/235)를 정리한다.

## 남아 있던 세 곳

| 경로                   | 서버 검사                                  | 화면에 따로 적힌 값             |
| ---------------------- | ------------------------------------------ | ------------------------------- |
| `PUT /photos/captions` | `typeof` 검사와 정규식, 200자              | `CAPTION_MAX = 200`             |
| `PUT /security`        | 키를 순회하며 `typeof field !== 'boolean'` | `HUMAN_CHECKS` 목록             |
| `PUT /github/showcase` | 배열인지, 6개 이하인지, 이름 정규식, 중복  | `MAX_SHOWCASE = 6`, 같은 정규식 |

화면 쪽 주석에는 "서버와 같다"고 적혀 있었다. 두 값이 같다는 근거는 주석뿐이라, 한쪽만 수정하면 화면은 통과시키고 서버는 거절하는 불일치가 생긴다. 예를 들어 서버 상한만 6개에서 8개로 올리면, 화면은 7번째 저장소를 선택하지 못하게 막는다.

실제로 저장소 이름 정규식은 서버와 화면에 각각 하나씩, 두 벌이 있었다.

```ts
// apps/react/src/apps/github/githubApi.ts (#235 전)
/** 보일 저장소는 GitHub의 Pinned처럼 6개까지 (서버와 같다) */
export const MAX_SHOWCASE = 6;
/** "owner/이름" 모양인지 (서버와 같은 규칙) */
export const isFullName = (value: string) =>
	/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(value) && !/\/\.{1,2}$/.test(value);
```

<details>
<summary>사람 확인 설정의 옛 서버 검사 (키를 하나씩 순회하며 거절 이유를 수집)</summary>

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

</details>

리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계에서는 요청·응답 도메인 여덟 개를 옮겼고, 관리자 설정과 데모 입력은 6단계(서버)의 작업으로 남겼다. 이 글은 그중 관리자 설정 세 종류를 다룬다. 데모 입력 네 개는 [별도 글](/memo/demo-input-schemas)에서 다룬다.

## zod 스키마로 옮기기

[zod](https://zod.dev/basics)는 값의 형태를 코드로 정의하고, 입력이 그 형태에 맞는지 검사하는 라이브러리다. 검사를 통과하면 정규화한 값을, 실패하면 이유 목록을 반환한다. 스키마에서 TypeScript 타입도 추출할 수 있어서 서버와 화면이 같은 타입을 쓴다.

가장 규칙이 많은 GitHub 저장소 목록은 다음과 같이 옮겼다. 저장소 이름 형식, 최대 6개, 중복 금지 세 규칙이 스키마 하나에 들어간다.

```ts
export const ShowcaseInput = z.object({
	repos: z
		.array(z.custom<string>(isFullName, { error: (issue) => `저장소 이름이 올바르지 않습니다: ${issue.input}` }))
		.max(MAX_SHOWCASE, `저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`)
		.superRefine(/* 같은 저장소가 두 번 있으면 거절 */),
});
```

사람 확인 설정은 [`strictObject`](https://zod.dev/api#objects)로 정의되지 않은 키를 거절한다. zod는 정의되지 않은 키를 `unrecognized_keys` 오류 하나로 보고하므로, 그 오류 코드에 맞춰 문구를 만든다([오류 문구 지정](https://zod.dev/error-customization)).

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

캡션 길이는 `Array.from(caption).length`로 측정한다. [`caption.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length)는 UTF-16 코드 단위[^utf16]로 집계하므로 이모지 하나를 2로 계산한다. [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)은 문자열을 코드 포인트 단위로 나누므로 이모지 하나가 1이다. DB의 CHECK 제약 `char_length("caption") BETWEEN 1 AND 200`[^check]도 코드 포인트 단위라서, 옛 코드의 측정 방식을 그대로 옮겨 두 기준을 맞췄다.

| 입력              | `caption.length` | `Array.from(caption).length` | PostgreSQL `char_length` |
| ----------------- | ---------------- | ---------------------------- | ------------------------ |
| `사진`            | 2                | 2                            | 2                        |
| `🌊` (이모지 1개) | 2                | 1                            | 1                        |

서버의 검사 함수는 이제 공유 함수 `parse(스키마, 입력)` 호출 한 줄이다. 예를 들어 `parseShowcase(input)`는 `parse(ShowcaseInput, input)`을 호출해 결과를 반환한다. `parse`는 내부에서 `safeParse`를 실행하고, 서버와 화면이 이미 쓰던 `{ value } | { errors: string[] }` 형태로 바꿔 반환한다. 화면은 `MAX_SHOWCASE`와 `isFullName`을 같은 패키지에서 import한다.

| 파일                                         | 옮긴 뒤 하는 일                     |
| -------------------------------------------- | ----------------------------------- |
| `apps/api/src/photos/rules.ts`               | `parse(CaptionInput, body)`         |
| `apps/api/src/security/rules.ts`             | `parse(SecurityUpdate, input)`      |
| `apps/api/src/github/showcase.ts`            | `parse(ShowcaseInput, input)`       |
| `apps/react/src/apps/github/githubApi.ts`    | `MAX_SHOWCASE`, `isFullName` import |
| `apps/react/src/apps/photos/albums.ts`       | `CAPTION_MAX` import                |
| `apps/react/src/shared/security/security.ts` | `HUMAN_CHECKS` import               |

![contracts의 settings.ts 한 곳에 규칙을 두고 API와 관리자 설정 화면이 함께 import한다](./images/settings-schemas-shared.svg '규칙은 한 곳에서, 서버와 화면이 같은 값을 쓴다')

## 문구를 그대로 두기

검사 방법은 바꾸되 사용자에게 보이는 거절 문구는 바꾸지 않았다. 기존 단위 시험이 문구를 문자열 그대로 비교하기 때문이다. 시험을 실행하자 한 경우에서 차이가 드러났다. 사람 확인 설정에 정의되지 않은 키만 보낸 경우다(예: `{ "likes": true }`).

| 구현                    | 반환하는 이유 목록                                      |
| ----------------------- | ------------------------------------------------------- |
| 옛 if 문                | `알 수 없는 설정입니다: likes`                          |
| zod (`when` 없음)       | `알 수 없는 설정입니다: likes`, `바꿀 설정이 없습니다.` |
| zod (`when` 추가, 채택) | `알 수 없는 설정입니다: likes`                          |

정의되지 않은 키를 제외하면 변경할 값이 없으므로 두 이유 모두 사실이다. 그러나 원인은 첫째 이유 하나이므로, 첫째만 표시하는 편이 사용자가 원인을 파악하기 쉽다. "바꿀 설정이 없습니다" 검사에 `when`(앞의 검사가 모두 통과했을 때만 실행)을 붙여 옛 동작을 유지했다.

![입력 { likes: true }가 strictObject 검사에서 unrecognized_keys 오류를 내고, when 조건이 거짓이라 refine 검사를 건너뛰어 이유가 하나만 남는 흐름](./images/settings-schemas-when.svg 'when은 앞 단계에서 오류가 있으면 뒤 검사를 건너뛴다')

## 고른 방법과 버린 방법

| 방법                                    | 좋은 점                          | 걸린 점                                                                                |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| 주석을 유지하고 시험으로 일치 확인      | 코드를 옮기지 않는다             | 서버와 화면 값이 같은지 확인하는 시험이 별도로 필요하고, 정규식은 비교하기 어렵다      |
| 서버가 상한을 API 응답으로 제공         | 한 곳에서 수정한다               | 화면이 값을 쓰기 전에 요청이 하나 추가되고, 정규식 같은 함수는 응답으로 전달할 수 없다 |
| 공유 패키지에 스키마와 상수 정의 (채택) | 상수와 검사 함수를 모두 공유한다 | 1단계와 같은 방식이라 새로 도입하는 구조가 없다                                        |

## 결과

![서버 검사 파일 세 개의 줄 수 전후](./images/settings-schemas-lines.svg '규칙은 contracts로 옮기고 서버는 부르기만 한다')

- 서버의 수동 검사 세 개를 삭제했고, 규칙은 `packages/contracts/src/settings.ts`(97줄) 한 곳에 있다. 서버 쪽 세 파일은 합계 193줄에서 149줄로 줄었다.
- 화면에서 "서버와 같다"는 주석으로만 맞추던 값 세 개(캡션 길이 200, 저장소 수 6, 사람 확인 목록 `contact`·`comment`·`message`)와 저장소 이름 정규식을 같은 패키지에서 import한다.
- API 단위 시험 157개·e2e 124개, contracts 시험 37개(새로 추가한 설정 스키마 시험 포함), 프론트 단위 시험 494개가 통과했다.

## 같은 방식으로 옮길 때

스키마는 [packages/contracts/src/settings.ts](https://github.com/hyeoniverse/MacFolio/blob/main/packages/contracts/src/settings.ts)에 정의하고 서버와 화면이 같은 것을 import한다. 옮길 때 순서는 이렇다.

1. 현재 서버가 반환하는 오류 문구를 시험으로 먼저 고정한다. 화면은 이 문구를 그대로 표시하므로 문구가 바뀌면 사용자에게 보이는 안내가 달라진다.
2. zod 스키마를 만들고 서버의 if 문을 `parse(스키마, 입력)`(내부에서 `safeParse` 실행)로 교체한다.
3. 화면의 입력 검사와 상수도 같은 패키지에서 import하도록 교체한다.

```bash
pnpm test
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

참고 문서: [Zod API](https://zod.dev/api), [Zod 오류 문구 지정](https://zod.dev/error-customization), [NestJS 파이프와 검증](https://docs.nestjs.com/pipes), [PostgreSQL CHECK 제약](https://www.postgresql.org/docs/current/ddl-constraints.html).

## 배운 것

- **주석의 "같다"는 보장이 아니다.** 같아야 하는 값은 한 곳에 정의하고 양쪽이 import해야 한다.
- **문구 시험이 이전 작업을 검증했다.** 기존 단위 시험이 거절 문구를 문자열 그대로 비교하고 있어서, 검사 구현을 바꾼 뒤에도 사용자에게 보이는 문구가 같다는 것을 확인할 수 있었다. 달라진 한 경우(정의되지 않은 키)도 시험이 먼저 검출했다.
- **zod의 `when`.** 앞의 검사가 실패하면 뒤의 검사를 건너뛰는 옵션이다. 옛 코드의 `if (!errors.length && …)`와 같은 동작을 그대로 옮길 수 있었다.

## 관련 글

- [리팩터링 6단계 — 서버](/memo/refactor-step6-server)
- [데모 입력 검사 네 개도 공유 스키마로 — 화면과 서버가 같은 상한을 쓰게](/memo/demo-input-schemas)
- [응답 타입을 두 번 적지 않기 — @macfolio/contracts와 zod](/memo/contracts-comments)
- [시스템 설정에서 사람 확인을 켜고 끄기](/memo/privacy-security-settings)

PR: [#235](https://github.com/hyeoniverse/MacFolio/pull/235) · 리팩터링 계획: [#150](https://github.com/hyeoniverse/MacFolio/issues/150)

[^contracts]: 서버(`apps/api`)와 화면(`apps/react`)이 함께 쓰는 요청·응답 스키마 패키지. 서버는 스키마로 검사하고, 화면은 타입과 상수를 import한다.

[^utf16]: JavaScript 문자열은 내부적으로 UTF-16으로 저장한다. U+FFFF보다 큰 문자(대부분의 이모지)는 코드 단위 두 개(서로게이트 쌍)로 표현되므로 `length`가 2가 된다.

[^check]: 테이블에 저장하는 값이 조건을 만족하지 않으면 INSERT·UPDATE를 거절하는 데이터베이스 제약. 마이그레이션 `20261008090000_photo_captions`에 정의되어 있다.

#MacFolio #zod #NestJS #리팩터링
