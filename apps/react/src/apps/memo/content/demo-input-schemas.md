---
title: 데모 입력 검사 네 개도 공유 스키마로 — 화면과 서버가 같은 상한을 쓰게
date: 2026-10-16
category: 개발 기록/MacFolio/백엔드/API
summary: AI 커버·번역·요약·음성 데모는 서버가 입력 글을 함수로 검사했고, 화면은 같은 상한(60·200·800·80자)을 별도 상수로 정의했다. 네 규칙을 contracts의 zod 스키마로 옮겨 서버와 화면이 같은 값을 사용하게 했다. 거절 문구와 검사 순서는 그대로 유지했다.
---

[관리자 설정의 요청 본문 세 개](/memo/settings-schemas)를 공유 스키마로 옮긴 뒤, 다음 대상은 방문자가 실제 AI 서비스를 호출하는 데모 네 개다. PR은 [#236](https://github.com/hyeoniverse/MacFolio/pull/236)이다.

## 배경: 방문자가 호출하는 유료 API

Safari의 HYEONIVERSE 프로젝트 페이지에는 그 서비스의 기능을 직접 실행하는 데모가 있다.

| 데모 | 동작                                    | 상한  |
| ---- | --------------------------------------- | ----- |
| 커버 | 제목을 입력하면 AI가 표지 이미지를 생성 | 60자  |
| 번역 | 한국어↔영어 번역                        | 200자 |
| 요약 | 긴 글을 요약                            | 800자 |
| 음성 | 글을 음성으로 합성(TTS)                 | 80자  |

네 데모 모두 이 사이트의 API 서버를 거쳐 외부 유료 서비스(DeepL·Google 등)를 호출한다.

그래서 서버는 입력 글을 엄격하게 검사한다. 길이 상한은 곧 비용 상한이고, 주소·메일·욕설을 필터링하는 것은 데모가 본래 목적 외의 용도로 쓰이지 않게 하기 위해서다. 컨트롤러에는 `@RateLimit('demo')`로 요청 횟수 제한도 적용되어 있다. 화면은 같은 상한을 입력 칸에 적용해, 방문자가 요청을 보내기 전에 남은 글자 수를 확인할 수 있다.

## 규칙이 두 곳에 정의되어 있던 네 경로

| 경로              | 서버 검사                                      | 화면에 별도로 정의된 값              |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| `POST /cover`     | `demoText`로 제목 60자, 모르는 스타일은 기본값 | `MAX_COVER_CHARS = 60`, 스타일 이름  |
| `POST /translate` | 3칸까지, 칸마다 검사, 모두 합쳐 200자          | `MAX_TRANSLATE_CHARS = 200`, 공급자  |
| `POST /summary`   | 줄바꿈을 남기고 800자                          | `MAX_SUMMARY_CHARS = 800`, 공급자    |
| `POST /speech`    | `demoText`를 쓰지 않고 같은 검사를 한 번 더    | `MAX_SPEECH_CHARS = 80`, 공급자 목록 |

화면 코드의 주석에는 "서버도 같은 값으로 막는다"고 적혀 있었다. [배경화면의 40자](/memo/contracts-wallpapers)와 같은 구조다. 두 값이 같다는 것은 주석으로만 기록되어 있고, 한쪽 값을 바꿔도 이를 검출하는 코드나 시험은 없었다. 음성 데모는 다른 세 데모와 같은 검사를 별도로 한 번 더 구현했고, 오류 클래스도 `SpeechInputError`로 분리되어 있었다.

## 선택한 방법

| 방법                                                | 장점                                            | 단점                                                                    |
| --------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| 서버 함수는 유지하고 상한만 contracts로             | 변경 범위가 작다                                | 규칙(정리·필터링)은 여전히 서버에만 있다. 화면이 같은 정리를 할 수 없다 |
| NestJS DTO + class-validator                        | Nest의 관례                                     | 화면(React)에서 사용할 수 없다. 다른 도메인은 이미 zod로 옮겼다         |
| **contracts에 zod 스키마 (`demoText` 팩토리 함수)** | 규칙·상한·문구가 한 곳. 다른 도메인과 같은 방식 | 기존 함수의 검사 순서·문구를 zod로 동일하게 재현해야 한다(아래 두 가지) |

세 번째 방법을 선택했다. 이미 여덟 개 도메인이 같은 방식으로 옮겨졌고, 공용 함수 `parse`(`packages/contracts/src/parse.ts`)도 있었다.

## 입력 칸 하나를 스키마로

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

기존 서버 함수와 비교하면 다음과 같다.

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

검사 순서(빈 글 → 길이 → 제어 문자 → 차단 단어)는 기존과 같다. 길이를 `[...text].length`로 측정하는 방식도 유지했다. 문자열의 [`length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/length)는 UTF-16 코드 단위[^utf16] 수라서 이모지 하나를 2자로 집계한다. 화면에 표시하는 "60자"와 서버가 측정하는 길이가 일치하려면 코드 포인트 단위로 측정해야 한다.

| 입력     | `text.length` | `[...text].length` |
| -------- | ------------- | ------------------ |
| `가나다` | 3             | 3                  |
| `😀`     | 2             | 1                  |
| `가😀`   | 3             | 2                  |

서버의 검사 함수는 한 줄로 줄었다. `parseSpeechRequest(body)`는 `demoInput(parse(SpeechInput, body))`이고, `demoInput`은 첫 번째 거절 이유를 `DemoInputError`로 던진다. 음성 데모만 사용하던 `SpeechInputError`는 삭제했다.

![데모 입력 스키마를 서버와 화면이 함께 쓰는 구조](./images/demo-input-schemas-shared.svg '규칙은 contracts 한 곳, 서버는 검사에, 화면은 상한과 이름에 쓴다')

## 옮기면서 동작을 맞춘 두 가지

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

번역은 칸 하나(`text`)와 여러 칸(`texts`)을 모두 받는다. `preprocess`에서 둘을 `texts` 배열로 합친 뒤 검사하고, 마지막 `transform`에서 도착 언어(`to`)를 출발 언어의 반대 언어로 채운다. 지원 언어가 두 개뿐이라 도착 언어는 요청에서 받지 않는다.

## 확인

<details>
<summary>추가·수정한 시험 목록</summary>

- 계약 패키지 `packages/contracts/src/demos.test.ts`에 시험 다섯 개를 작성했다. "공백을 줄이고, 여러 줄을 받는 칸은 줄바꿈을 남긴다", "비었거나 길거나, 제어 문자·주소·욕설은 받지 않는다", "몸통이 객체가 아니면 빈 글의 이유를 알린다", "모르는 스타일·언어·공급자는 기본값으로", "번역은 칸 수를 먼저 보고, 모두 합쳐 상한을 센다".
- 서버 `apps/api/src/common/demo.test.ts`에 있던 글 정리·필터링 시험 세 개는 계약 패키지로 옮기고, 그 자리에 "검사 결과에서 값을 꺼내고, 맞지 않으면 첫 이유를 DemoInputError로 던진다"를 새로 작성했다. `speech/rules.test.ts`는 `SpeechInputError` 대신 `DemoInputError`를 확인하도록 수정했다.

</details>

- 커밋 변경량은 파일 16개, +382/−198이다. 글을 제외하면 +331/−198이고, 그중 새 파일 `demos.ts`가 194줄이다. 서버 규칙 파일 다섯 개(`demo.ts`, `cover`·`speech`·`summary`·`translate`의 `rules.ts`)는 합계 39줄 추가, 153줄 삭제다.

## 결과

| 항목             | 전                                                         | 후                                      |
| ---------------- | ---------------------------------------------------------- | --------------------------------------- |
| 입력 규칙 위치   | 서버 `demoText`·`pickProviders` + 음성 데모의 별도 검사    | `packages/contracts/src/demos.ts` 한 곳 |
| 화면의 상한·이름 | `MAX_*_CHARS` 상수 4개, 스타일·공급자 이름을 화면에서 정의 | 같은 패키지에서 import                  |
| 오류 클래스      | `DemoInputError`, `SpeechInputError`                       | `DemoInputError` 하나                   |

API 단위 시험 155개·e2e 124개, 계약 패키지의 새 데모 스키마 시험 5개, 화면 단위 시험 496개가 통과했다.

## 남은 과제와 배운 점

- 화면은 상한과 이름만 가져오고, 입력을 스키마로 사전 검사하지는 않는다. 방문자가 주소를 입력하면 서버 응답을 받은 뒤에야 거절 문구가 표시된다. 화면에서도 `parse(SpeechInput, …)`를 먼저 호출하면 불필요한 요청 하나를 줄일 수 있다.
- 차단 단어 목록(`BLOCKED`)이 화면 번들에도 포함된다. 현재는 정규식 네 개라 번들 크기에 영향이 거의 없지만, 목록이 길어지면 서버에만 보관하는 편이 낫다.

배운 점: zod로 옮길 때 작업량이 가장 많았던 부분은 규칙 자체가 아니라 "기존 함수가 어떤 조건을 먼저 검사하는가"였다. 사용자에게 표시되는 첫 거절 이유가 바뀌면 동작이 바뀐 것이다. 기존 시험이 오류 문구까지 비교하고 있어서 그 차이를 바로 검출했다.

## 따라 해 보기

상한을 바꾸려면 `packages/contracts/src/demos.ts`의 상수 하나만 수정한다. 서버의 검사와 화면의 글자 수 표시가 함께 바뀐다.

```bash
pnpm --filter @macfolio/contracts test          # demos.test.ts
pnpm --filter @macfolio/contracts build
pnpm --filter @macfolio/api test -- src/common/demo.test.ts
pnpm typecheck
```

서버가 실제로 거절하는지는 상한을 넘는 글을 보내 확인한다. 응답은 400이고, 어느 칸이 어떤 이유로 거절됐는지가 본문에 포함된다. 정확한 경로와 요청 본문 형식은 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에 있다. 데모가 사용하는 유료 API의 호출 횟수를 제한하는 이유는 [요청 제한](/memo/rate-limit-all-writes)에 정리했다. zod의 `transform`·`pipe`·`preprocess`는 [zod 공식 문서](https://zod.dev/)에 설명되어 있다.

## 관련 글

- [손으로 쓴 입력 검사 세 개를 공유 스키마로 — 서버와 화면이 같은 규칙을 쓰게](/memo/settings-schemas)
- [숫자 40이 세 곳에 — 배경화면 도메인 옮기기](/memo/contracts-wallpapers)
- [타입은 desktop-core에, 스키마는 contracts에 — 글 도메인 옮기기](/memo/contracts-posts)
- [이미 한 곳이었다, 자리만 옮겼다 — 사이트 프로필로 1단계 마무리](/memo/contracts-site)
- [쓰기 경로 33개에 같은 방식으로 요청 제한 걸기](/memo/rate-limit-all-writes)

[^utf16]: JavaScript 문자열은 UTF-16으로 저장된다. 한글 음절처럼 기본 다국어 평면(BMP)에 있는 문자는 코드 단위 1개, 이모지처럼 BMP 밖의 문자는 코드 단위 2개(서로게이트 쌍)를 차지한다. 스프레드 연산자(`[...text]`)는 코드 포인트 단위로 문자열을 나눈다.

#MacFolio #zod #NestJS #리팩터링
