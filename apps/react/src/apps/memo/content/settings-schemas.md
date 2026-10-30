---
title: 관리자 설정과 AI 데모의 if 문 입력 검사 일곱 개를 contracts의 zod 스키마로 옮기기
date: 2026-10-16
category: 개발 기록/MacFolio/API·데이터
series: contracts 스키마
seriesOrder: 8
summary: 관리자 설정과 AI 데모의 요청 검사는 서버의 if 문과 화면의 상수가 따로 같은 상한을 정의했다. 일곱 규칙을 @macfolio/contracts의 zod 스키마로 옮겨 서버와 화면이 같은 값을 쓰게 하고, 거절 문구와 검사 순서는 그대로 유지했다.
---

API가 수신하는 요청 본문은 대부분 이미 `@macfolio/contracts`[^contracts]의 zod 스키마로 검사한다. 댓글·글·메시지·메일·배경화면이 그렇다. 리팩터링 계획([#150](https://github.com/hyeoniverse/MacFolio/issues/150)) 1단계에서 요청·응답 도메인 여덟 개를 옮겼고, 관리자 설정 화면이 보내는 요청 본문 세 종류와 방문자가 실제 AI 서비스를 호출하는 데모 네 개는 6단계(서버)의 작업으로 남겼다. 이 글은 관리자 설정 세 개를 옮긴 [#235](https://github.com/hyeoniverse/MacFolio/pull/235)와 데모 입력 네 개를 옮긴 [#236](https://github.com/hyeoniverse/MacFolio/pull/236)을 정리한다.

## 남아 있던 검사

### 관리자 설정 세 개

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

### AI 데모 네 개

Safari의 HYEONIVERSE 프로젝트 페이지에는 그 서비스의 기능을 직접 실행하는 데모가 있다. 네 데모 모두 이 사이트의 API 서버를 거쳐 외부 유료 서비스(DeepL·Google 등)를 호출한다.

| 데모 | 동작                                    | 상한  |
| ---- | --------------------------------------- | ----- |
| 커버 | 제목을 입력하면 AI가 표지 이미지를 생성 | 60자  |
| 번역 | 한국어↔영어 번역                        | 200자 |
| 요약 | 긴 글을 요약                            | 800자 |
| 음성 | 글을 음성으로 합성(TTS)                 | 80자  |

그래서 서버는 입력 글을 엄격하게 검사한다. 길이 상한은 곧 비용 상한이고, 주소·메일·욕설을 필터링하는 것은 데모가 본래 목적 외의 용도로 쓰이지 않게 하기 위해서다. 컨트롤러에는 `@RateLimit('demo')`로 요청 횟수 제한도 적용되어 있다. 화면은 같은 상한을 입력 칸에 적용해, 방문자가 요청을 보내기 전에 남은 글자 수를 확인할 수 있다.

| 경로              | 서버 검사                                      | 화면에 별도로 정의된 값              |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| `POST /cover`     | `demoText`로 제목 60자, 모르는 스타일은 기본값 | `MAX_COVER_CHARS = 60`, 스타일 이름  |
| `POST /translate` | 3칸까지, 칸마다 검사, 모두 합쳐 200자          | `MAX_TRANSLATE_CHARS = 200`, 공급자  |
| `POST /summary`   | 줄바꿈을 남기고 800자                          | `MAX_SUMMARY_CHARS = 800`, 공급자    |
| `POST /speech`    | `demoText`를 쓰지 않고 같은 검사를 한 번 더    | `MAX_SPEECH_CHARS = 80`, 공급자 목록 |

화면 코드의 주석에는 "서버도 같은 값으로 막는다"고 적혀 있었다. [배경화면의 40자](/memo/contracts-wallpapers), 관리자 설정과 같은 구조다. 음성 데모는 다른 세 데모와 같은 검사를 별도로 한 번 더 구현했고, 오류 클래스도 `SpeechInputError`로 분리되어 있었다.

## zod 스키마로 옮기기

[zod](https://zod.dev/basics)는 값의 형태를 코드로 정의하고, 입력이 그 형태에 맞는지 검사하는 라이브러리다. 검사를 통과하면 정규화한 값을, 실패하면 이유 목록을 반환한다. 스키마에서 TypeScript 타입도 추출할 수 있어서 서버와 화면이 같은 타입을 쓴다.

### GitHub 저장소 목록

저장소 이름 형식, 최대 6개, 중복 금지 세 규칙이 스키마 하나에 들어간다.

```ts
export const ShowcaseInput = z.object({
	repos: z
		.array(z.custom<string>(isFullName, { error: (issue) => `저장소 이름이 올바르지 않습니다: ${issue.input}` }))
		.max(MAX_SHOWCASE, `저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`)
		.superRefine(/* 같은 저장소가 두 번 있으면 거절 */),
});
```

### 사람 확인 설정: strictObject와 unrecognized_keys

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

### 길이는 코드 포인트 단위로: Array.from

캡션과 데모 입력의 길이는 `Array.from(text).length`(또는 `[...text].length`)로 측정한다. [`text.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length)는 UTF-16 코드 단위[^utf16]로 집계하므로 이모지 하나를 2로 계산한다. [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)과 스프레드 연산자는 문자열을 코드 포인트 단위로 나누므로 이모지 하나가 1이다. 캡션 표의 CHECK 제약 `char_length("caption") BETWEEN 1 AND 200`[^check]도 코드 포인트 단위이고, 화면에 표시하는 "60자"도 코드 포인트 기준이다. 옛 코드의 측정 방식을 그대로 옮겨 세 기준을 맞췄다.

| 입력              | `text.length` | `Array.from(text).length` | PostgreSQL `char_length` |
| ----------------- | ------------- | ------------------------- | ------------------------ |
| `사진`            | 2             | 2                         | 2                        |
| `🌊` (이모지 1개) | 2             | 1                         | 1                        |
| `가😀`            | 3             | 2                         | 2                        |

### 데모 입력 칸의 공용 규칙: demoText

네 데모가 공통으로 사용하는 규칙은 "입력 칸 하나"에 대한 검사다. 공백을 정리하고, 비어 있거나 상한을 넘거나 제어 문자·주소·욕설이 있으면 거절한다. 이 규칙을 zod 스키마를 생성하는 함수 `demoText`로 옮겼다.

```ts
export const SpeechInput = body({
	text: demoText({
		max: MAX_SPEECH_CHARS,
		empty: '읽을 글을 써 주세요.',
		refused: '이 글은 읽어 드릴 수 없습니다.',
		tooLong: `${MAX_SPEECH_CHARS}자까지만 읽습니다.`,
	}),
	lang,
	skip: skipOf(SPEECH_PROVIDERS),
});
```

<details>
<summary>전후 코드 비교: apps/api/src/common/demo.ts → packages/contracts/src/demos.ts</summary>

```ts
// 전: apps/api/src/common/demo.ts — 값 하나를 받아 검사하고, 틀리면 던진다
export function demoText(value: unknown, { max, empty, refused, lines = false }) {
	const raw = typeof value === 'string' ? value : '';
	const text = lines ? /* 줄바꿈은 남기고 빈 줄만 줄인다 */ : raw.replace(/\s+/g, ' ').trim();
	if (!text) throw new DemoInputError(empty);
	if ([...text].length > max) throw new DemoInputError(`${max}자까지만 받습니다.`);
	if (/[^\P{Cc}\n]/u.test(text)) throw new DemoInputError('읽을 수 없는 글자가 있습니다.');
	if (BLOCKED.some((pattern) => pattern.test(text))) throw new DemoInputError(refused);
	return text;
}

// 후: packages/contracts/src/demos.ts — 규칙을 받아 스키마를 만든다
export const demoText = ({ max, empty, refused, tooLong, lines = false }: DemoTextRules) =>
	z.unknown().optional().transform((value, ctx) => {
		const text = tidy(typeof value === 'string' ? value : '', lines);
		const reason = !text ? empty : [...text].length > max ? (tooLong ?? `${max}자까지만 받습니다.`) : /* … */ null;
		if (reason) { ctx.addIssue({ code: 'custom', message: reason }); return z.NEVER; }
		return text;
	});
```

</details>

번역은 칸 하나(`text`)와 여러 칸(`texts`)을 모두 받는다. `preprocess`에서 둘을 `texts` 배열로 합친 뒤 검사하고, 마지막 `transform`에서 도착 언어(`to`)를 출발 언어의 반대 언어로 채운다. 지원 언어가 두 개뿐이라 도착 언어는 요청에서 받지 않는다.

### 서버와 화면이 같은 것을 import

서버의 검사 함수는 이제 공유 함수 `parse(스키마, 입력)`(`packages/contracts/src/parse.ts`) 호출 한 줄이다. `parse`는 내부에서 `safeParse`를 실행하고, 서버와 화면이 이미 쓰던 `{ value } | { errors: string[] }` 형태로 바꿔 반환한다. 데모 경로는 `parseSpeechRequest(body)`가 `demoInput(parse(SpeechInput, body))`이고, `demoInput`은 첫 번째 거절 이유를 `DemoInputError`로 던진다.

| 파일                                                     | 옮긴 뒤 하는 일                                |
| -------------------------------------------------------- | ---------------------------------------------- |
| `apps/api/src/photos/rules.ts`                           | `parse(CaptionInput, body)`                    |
| `apps/api/src/security/rules.ts`                         | `parse(SecurityUpdate, input)`                 |
| `apps/api/src/github/showcase.ts`                        | `parse(ShowcaseInput, input)`                  |
| `apps/api/src/{cover,translate,summary,speech}/rules.ts` | `demoInput(parse(…Input, body))`               |
| `apps/react/src/apps/github/githubApi.ts`                | `MAX_SHOWCASE`, `isFullName` import            |
| `apps/react/src/apps/photos/albums.ts`                   | `CAPTION_MAX` import                           |
| `apps/react/src/shared/security/security.ts`             | `HUMAN_CHECKS` import                          |
| 데모 화면                                                | `MAX_*_CHARS` 네 개, 스타일·공급자 이름 import |

![contracts의 settings.ts 한 곳에 규칙을 두고 API와 관리자 설정 화면이 함께 import한다](./images/settings-schemas-shared.svg '규칙은 한 곳에서, 서버와 화면이 같은 값을 쓴다')

![데모 입력 스키마를 서버와 화면이 함께 쓰는 구조](./images/demo-input-schemas-shared.svg '규칙은 contracts 한 곳, 서버는 검사에, 화면은 상한과 이름에 쓴다')

## 거절 문구와 검사 순서 유지

검사 방법은 바꾸되 사용자에게 보이는 거절 문구와 첫 거절 이유는 바꾸지 않았다. 기존 단위 시험이 문구를 문자열 그대로 비교하므로, 시험을 실행하자 zod의 기본 동작과 옛 코드가 다른 경우 세 가지가 드러났다.

### 정의되지 않은 키만 보낸 사람 확인 설정: when

사람 확인 설정에 정의되지 않은 키만 보낸 경우다(예: `{ "likes": true }`).

| 구현                    | 반환하는 이유 목록                                      |
| ----------------------- | ------------------------------------------------------- |
| 옛 if 문                | `알 수 없는 설정입니다: likes`                          |
| zod (`when` 없음)       | `알 수 없는 설정입니다: likes`, `바꿀 설정이 없습니다.` |
| zod (`when` 추가, 채택) | `알 수 없는 설정입니다: likes`                          |

정의되지 않은 키를 제외하면 변경할 값이 없으므로 두 이유 모두 사실이다. 그러나 원인은 첫째 이유 하나이므로, 첫째만 표시하는 편이 사용자가 원인을 파악하기 쉽다. "바꿀 설정이 없습니다" 검사에 `when`(앞의 검사가 모두 통과했을 때만 실행)을 붙여 옛 코드의 `if (!errors.length && …)`와 같은 동작을 유지했다.

![입력 { likes: true }가 strictObject 검사에서 unrecognized_keys 오류를 내고, when 조건이 거짓이라 refine 검사를 건너뛰어 이유가 하나만 남는 흐름](./images/settings-schemas-when.svg 'when은 앞 단계에서 오류가 있으면 뒤 검사를 건너뛴다')

### 데모 입력: 빈 칸과 번역 칸 수

| 항목         | 기존 함수                                                  | zod 기본 동작                                             | 조치                                                                   |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| 칸이 없을 때 | 빈 글로 처리해 "번역할 글을 써 주세요." 반환               | `transform`이 붙은 칸이 본문에 없으면 영어 오류 문구 반환 | 칸을 `optional()`로 받고 `transform`에서 빈 글로 변환해 기존 문구 유지 |
| 번역 칸 수   | 칸 수(최대 3칸)를 먼저 검사하고, 초과하면 칸별 검사는 생략 | 배열의 칸별 검사와 개수 검사를 함께 수행                  | 개수를 먼저 검사한 뒤 `pipe`로 칸별 검사를 이어 붙임                   |

```ts
texts: z
	.array(z.unknown())
	.max(MAX_TRANSLATE_FIELDS, `${MAX_TRANSLATE_FIELDS}칸까지만 번역합니다.`)
	.pipe(z.array(translateText))
	.refine((texts) => [...texts.join('')].length <= MAX_TRANSLATE_CHARS, `모두 합쳐 ${MAX_TRANSLATE_CHARS}자까지만 번역합니다.`),
```

![번역 요청 본문: text/texts를 texts로 합치고, 칸 수 → 칸별 → 합친 길이 순서로 검사한다](./images/demo-input-schemas-translate.svg '앞 단계가 실패하면 뒤 단계는 검사하지 않는다. 기존 함수와 같은 첫 이유가 반환된다')

칸 하나의 검사 순서(빈 글 → 길이 → 제어 문자 → 차단 단어)도 기존 `demoText`와 같다.

### DemoInputError 하나로

음성 데모만 사용하던 `SpeechInputError`는 삭제하고, 네 데모 모두 `DemoInputError`를 던진다. 음성 데모의 별도 검사도 공용 `demoText`로 바뀌었다.

## 고른 방법과 버린 방법

| 방법                                          | 좋은 점                                             | 걸린 점                                                                                |
| --------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 주석을 유지하고 시험으로 일치 확인            | 코드를 옮기지 않는다                                | 서버와 화면 값이 같은지 확인하는 시험이 별도로 필요하고, 정규식은 비교하기 어렵다      |
| 서버가 상한을 API 응답으로 제공               | 한 곳에서 수정한다                                  | 화면이 값을 쓰기 전에 요청이 하나 추가되고, 정규식 같은 함수는 응답으로 전달할 수 없다 |
| 서버 함수는 유지하고 상한만 contracts로       | 변경 범위가 작다                                    | 정리·필터링 규칙은 여전히 서버에만 있어 화면이 같은 정리를 할 수 없다                  |
| NestJS DTO + class-validator                  | Nest의 관례                                         | 화면(React)에서 사용할 수 없다. 다른 도메인은 이미 zod로 옮겼다                        |
| **contracts에 zod 스키마와 상수 정의 (채택)** | 규칙·상한·문구·검사 함수가 한 곳. 1단계와 같은 방식 | 기존 함수의 검사 순서·문구를 zod로 동일하게 재현해야 한다(위 세 가지)                  |

## 확인과 결과

![서버 검사 파일 세 개의 줄 수 전후](./images/settings-schemas-lines.svg '규칙은 contracts로 옮기고 서버는 부르기만 한다')

| 항목           | #235 관리자 설정                                                                             | #236 AI 데모                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 규칙 위치      | `packages/contracts/src/settings.ts`(97줄)                                                   | `packages/contracts/src/demos.ts`(194줄)                                                        |
| 서버 규칙 파일 | 세 파일 합계 193줄 → 149줄                                                                   | 다섯 파일(`demo.ts`, `cover`·`speech`·`summary`·`translate`의 `rules.ts`) 39줄 추가, 153줄 삭제 |
| 화면 상수      | 캡션 길이 200, 저장소 수 6, 사람 확인 목록 `contact`·`comment`·`message`, 저장소 이름 정규식 | `MAX_*_CHARS` 상수 4개, 스타일·공급자 이름                                                      |
| 오류 클래스    | 변경 없음                                                                                    | `DemoInputError`, `SpeechInputError` → `DemoInputError`                                         |
| 통과한 시험    | API 단위 157·e2e 124, contracts 37(설정 스키마 시험 포함), 프론트 단위 494                   | API 단위 155·e2e 124, contracts 데모 스키마 5, 프론트 단위 496                                  |

데모 PR의 변경량은 파일 16개, +331/−198(글 제외)이다.

<details>
<summary>데모 입력에서 추가·수정한 시험</summary>

- `packages/contracts/src/demos.test.ts`에 시험 다섯 개를 작성했다. "공백을 줄이고, 여러 줄을 받는 칸은 줄바꿈을 남긴다", "비었거나 길거나, 제어 문자·주소·욕설은 받지 않는다", "몸통이 객체가 아니면 빈 글의 이유를 알린다", "모르는 스타일·언어·공급자는 기본값으로", "번역은 칸 수를 먼저 보고, 모두 합쳐 상한을 센다".
- 서버 `apps/api/src/common/demo.test.ts`에 있던 글 정리·필터링 시험 세 개는 계약 패키지로 옮기고, 그 자리에 "검사 결과에서 값을 꺼내고, 맞지 않으면 첫 이유를 DemoInputError로 던진다"를 새로 작성했다. `speech/rules.test.ts`는 `SpeechInputError` 대신 `DemoInputError`를 확인하도록 수정했다.

</details>

### 같은 방식으로 옮길 때

1. 현재 서버가 반환하는 오류 문구를 시험으로 먼저 고정한다. 화면은 이 문구를 그대로 표시하므로 문구가 바뀌면 사용자에게 보이는 안내가 달라진다.
2. zod 스키마를 만들고 서버의 if 문을 `parse(스키마, 입력)`로 교체한다.
3. 화면의 입력 검사와 상수도 같은 패키지에서 import하도록 교체한다.

상한을 바꾸려면 `packages/contracts/src/demos.ts`나 `settings.ts`의 상수 하나만 수정한다. 서버의 검사와 화면의 글자 수 표시가 함께 바뀐다.

```bash
pnpm --filter @macfolio/contracts test
pnpm --filter @macfolio/contracts build
pnpm test
pnpm --filter @macfolio/api test:e2e   # DATABASE_URL의 PostgreSQL이 있어야 한다
```

서버가 실제로 거절하는지는 상한을 넘는 글을 보내 확인한다. 응답은 400이고, 어느 칸이 어떤 이유로 거절됐는지가 본문에 포함된다. 정확한 경로와 요청 본문 형식은 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에 있다.

참고 문서: [Zod API](https://zod.dev/api), [Zod 오류 문구 지정](https://zod.dev/error-customization), [NestJS 파이프와 검증](https://docs.nestjs.com/pipes), [PostgreSQL CHECK 제약](https://www.postgresql.org/docs/current/ddl-constraints.html).

## 남은 과제

- 화면은 데모의 상한과 이름만 가져오고, 입력을 스키마로 사전 검사하지는 않는다. 방문자가 주소를 입력하면 서버 응답을 받은 뒤에야 거절 문구가 표시된다. 화면에서도 `parse(SpeechInput, …)`를 먼저 호출하면 불필요한 요청 하나를 줄일 수 있다.
- 차단 단어 목록(`BLOCKED`)이 화면 번들에도 포함된다. 현재는 정규식 네 개라 번들 크기에 영향이 거의 없지만, 목록이 길어지면 서버에만 보관하는 편이 낫다.

## 배운 것

- **주석의 "같다"는 보장이 아니다.** 같아야 하는 값은 한 곳에 정의하고 양쪽이 import해야 한다.
- **작업량은 규칙이 아니라 검사 순서에 있었다.** 사용자에게 표시되는 첫 거절 이유가 바뀌면 동작이 바뀐 것이다. 기존 단위 시험이 거절 문구를 문자열 그대로 비교하고 있어서, 정의되지 않은 키·빈 칸·번역 칸 수의 세 가지 차이를 시험이 먼저 검출했다.
- **zod의 `when`과 `pipe`.** `when`은 앞의 검사가 실패하면 뒤의 검사를 건너뛰고, `pipe`는 앞 스키마가 통과한 뒤에만 다음 스키마를 실행한다. 옛 if 문의 "앞에서 실패하면 멈춘다"는 동작을 이 두 가지로 옮겼다.

## 관련 글

- [책임별 서비스 분리와 공유 zod 스키마로 정리한 서버 코드](/memo/refactor-step6-server)
- [zod 스키마 패키지 @macfolio/contracts로 서버 검증과 화면 타입 공유하기](/memo/contracts-comments)
- [DB CHECK·서버·화면에 흩어진 이름 한도를 contracts 정리 함수로 통합하기](/memo/contracts-wallpapers)
- [ZodType<PostContent>로 기존 타입과 zod 스키마의 일치를 tsc로 검사하기](/memo/contracts-posts)
- [parseProfile의 if문 검증을 zod 스키마로 옮기기](/memo/contracts-site)
- [Turnstile 사람 확인을 requireHuman 하나로 묶고 설정 테이블로 켜고 끄기](/memo/privacy-security-settings)
- [@RateLimit 데코레이터와 ThrottlerGuard로 모든 쓰기 경로에 요청 제한 걸기](/memo/rate-limit-all-writes): 데모가 사용하는 유료 API의 호출 횟수를 제한하는 이유

PR: [#235](https://github.com/hyeoniverse/MacFolio/pull/235) · [#236](https://github.com/hyeoniverse/MacFolio/pull/236) · 리팩터링 계획: [#150](https://github.com/hyeoniverse/MacFolio/issues/150)

[^contracts]: 서버(`apps/api`)와 화면(`apps/react`)이 함께 쓰는 요청·응답 스키마 패키지. 서버는 스키마로 검사하고, 화면은 타입과 상수를 import한다.

[^utf16]: JavaScript 문자열은 내부적으로 UTF-16으로 저장한다. 한글 음절처럼 기본 다국어 평면(BMP)에 있는 문자는 코드 단위 1개, 이모지처럼 U+FFFF보다 큰 문자는 코드 단위 2개(서로게이트 쌍)로 표현되므로 `length`가 2가 된다. `Array.from`과 스프레드 연산자(`[...text]`)는 코드 포인트 단위로 문자열을 나눈다.

[^check]: 테이블에 저장하는 값이 조건을 만족하지 않으면 INSERT·UPDATE를 거절하는 데이터베이스 제약. 마이그레이션 `20261008090000_photo_captions`에 정의되어 있다.

#MacFolio #zod #NestJS #리팩터링
