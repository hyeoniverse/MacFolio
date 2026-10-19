---
title: 데모 입력 검사 네 개도 공유 스키마로 — 화면과 서버가 같은 상한을 쓰게
date: 2026-10-16
category: 개발기/MacFolio/백엔드
summary: AI 커버·번역·요약·음성 데모는 서버가 받을 글을 함수로 검사했고, 화면은 같은 상한(60·200·800·80자)을 따로 적어 두었다. 네 규칙을 contracts의 zod 스키마로 옮겨 서버와 화면이 같은 값을 쓰게 했다. 거절 문구와 검사 순서는 그대로 지켰다.
---

[관리자 설정의 세 몸통](/memo/settings-schemas)을 공유 스키마로 옮긴 다음 차례는, 방문자가 실제 AI 서비스를 불러 보는 데모 네 개다. PR은 [#236](https://github.com/hyeoniverse/MacFolio/pull/236)이다.

## 배경: 방문자가 부르는 유료 API

Safari의 HYEONIVERSE 프로젝트 페이지에는 그 서비스의 기능을 직접 눌러 보는 데모가 있다. 제목을 넣으면 AI가 표지 그림을 그리고(커버), 한국어·영어를 오가며 번역하고(번역), 긴 글을 줄이고(요약), 글을 소리로 읽어 준다(음성). 모두 이 사이트의 API 서버를 거쳐 바깥의 유료 서비스(DeepL·Google 등)를 부른다.

그래서 서버가 받을 글을 엄격하게 본다. 길이 상한은 비용 상한이고, 주소·메일·욕설을 거르는 것은 데모가 엉뚱한 용도로 쓰이지 않게 하려는 것이다. 컨트롤러에는 `@RateLimit('demo')`로 횟수 제한도 걸려 있다. 화면은 같은 상한을 입력 칸에 걸어 두어, 방문자가 서버까지 가기 전에 몇 자 남았는지 본다.

## 남아 있던 네 곳

| 경로              | 서버 검사                                      | 화면에 따로 적힌 값                  |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| `POST /cover`     | `demoText`로 제목 60자, 모르는 스타일은 기본값 | `MAX_COVER_CHARS = 60`, 스타일 이름  |
| `POST /translate` | 3칸까지, 칸마다 검사, 모두 합쳐 200자          | `MAX_TRANSLATE_CHARS = 200`, 공급자  |
| `POST /summary`   | 줄바꿈을 남기고 800자                          | `MAX_SUMMARY_CHARS = 800`, 공급자    |
| `POST /speech`    | `demoText`를 쓰지 않고 같은 검사를 한 번 더    | `MAX_SPEECH_CHARS = 80`, 공급자 목록 |

화면 주석에는 "서버도 같은 값으로 막는다"고 적혀 있었다. [배경화면의 40자](/memo/contracts-wallpapers)와 같은 모양이다. 주석이 약속할 뿐 아무것도 지키지 않는다. 음성 데모는 다른 셋과 같은 검사를 따로 한 번 더 적었고, 오류 클래스도 `SpeechInputError`로 따로 있었다.

## 고른 방법

| 방법                                         | 좋은 점                                       | 나쁜 점                                                            |
| -------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| 서버 함수는 두고 상한만 contracts로          | 바꿀 곳이 적다                                | 규칙(정리·거르기)은 여전히 서버만 안다. 화면이 같은 정리를 못 한다 |
| NestJS DTO + class-validator                 | Nest의 관례                                   | 화면(React)이 쓸 수 없다. 다른 도메인은 이미 zod로 갔다            |
| **contracts에 zod 스키마 (`demoText` 공장)** | 규칙·상한·문구가 한 곳. 다른 도메인과 같은 길 | 옛 함수의 순서·문구를 zod로 똑같이 내야 한다(아래 두 가지)         |

셋째를 골랐다. 이미 여덟 도메인이 같은 길을 갔고, 공용 도우미 `parse`도 있었다.

## 글 한 칸을 스키마로

네 데모가 함께 쓰는 규칙은 "글 한 칸"이다. 공백을 정리하고, 비었거나 길거나 제어 문자·주소·욕설이 있으면 거절한다. 이것을 zod 스키마를 만드는 함수 `demoText`로 옮겼다.

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

옛 서버 함수와 견주면 이렇다.

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

검사 순서(빈 글 → 길이 → 제어 문자 → 막은 말)가 그대로다. 길이를 `[...text].length`로 세는 것도 그대로다. 문자열 `length`는 UTF-16 단위라 이모지 하나를 2자로 센다. 화면에서 "60자"라고 보여 주는 것과 서버가 세는 것이 같으려면 코드 포인트로 세야 한다.

서버의 검사 함수는 한 줄이 되었다. `parseSpeechRequest(body)`는 `demoInput(parse(SpeechInput, body))`이고, `demoInput`은 첫 이유를 `DemoInputError`로 던진다. 음성만 쓰던 `SpeechInputError`는 없앴다.

![데모 입력 스키마를 서버와 화면이 함께 쓰는 구조](./images/demo-input-schemas-shared.svg '규칙은 contracts 한 곳, 서버는 검사에, 화면은 상한과 이름에 쓴다')

## 옮기며 맞춘 두 가지

- **칸이 없을 때**: zod는 `transform`이 붙은 칸이 몸통에 없으면 "값이 없다"는 영어 문구를 낸다. 옛 코드는 칸이 없으면 빈 글로 보고 "번역할 글을 써 주세요."를 알렸다. 칸을 `optional()`로 받은 뒤 `transform`에서 빈 글로 바꿔 옛 문구를 지켰다.
- **번역 칸 수**: 옛 코드는 칸 수(3칸)를 먼저 보고, 넘으면 칸마다 검사하지 않았다. zod 배열은 칸 검사와 개수 검사를 함께 하므로, 개수를 먼저 본 뒤 `pipe`로 칸마다 검사하게 나눴다.

```ts
texts: z
	.array(z.unknown())
	.max(MAX_TRANSLATE_FIELDS, `${MAX_TRANSLATE_FIELDS}칸까지만 번역합니다.`)
	.pipe(z.array(translateText))
	.refine((texts) => [...texts.join('')].length <= MAX_TRANSLATE_CHARS, `모두 합쳐 ${MAX_TRANSLATE_CHARS}자까지만 번역합니다.`),
```

![번역 몸통: text/texts를 texts로 모으고, 칸 수 → 칸마다 → 합친 길이 순서로 본다](./images/demo-input-schemas-translate.svg '앞 단계가 실패하면 뒤 단계는 보지 않는다. 옛 함수와 같은 첫 이유가 나온다')

번역은 칸 하나(`text`)와 여러 칸(`texts`)을 다 받는다. `preprocess`에서 둘을 `texts` 배열로 모은 뒤 검사하고, 마지막 `transform`에서 도착 언어(`to`)를 출발 언어의 반대쪽으로 채운다. 두 언어뿐이라 도착 언어를 따로 받지 않는다.

## 확인

- 계약 패키지 `packages/contracts/src/demos.test.ts`에 다섯 시험을 썼다. "공백을 줄이고, 여러 줄을 받는 칸은 줄바꿈을 남긴다", "비었거나 길거나, 제어 문자·주소·욕설은 받지 않는다", "몸통이 객체가 아니면 빈 글의 이유를 알린다", "모르는 스타일·언어·공급자는 기본값으로", "번역은 칸 수를 먼저 보고, 모두 합쳐 상한을 센다".
- 서버 `apps/api/src/common/demo.test.ts`에 있던 글 정리·거르기 시험 셋은 계약 패키지로 옮기고, 그 자리에 "검사 결과에서 값을 꺼내고, 맞지 않으면 첫 이유를 DemoInputError로 던진다"를 새로 썼다. `speech/rules.test.ts`는 `SpeechInputError` 대신 `DemoInputError`를 보게 고쳤다.
- 커밋은 파일 16개, +382/−198이다. 글을 빼면 +331/−198이고, 그중 새 `demos.ts`가 194줄이다. 서버 규칙 파일 다섯 개(`demo.ts`, `cover`·`speech`·`summary`·`translate`의 `rules.ts`)는 합쳐 39줄을 더하고 153줄을 뺐다.

## 결과

- 받을 글의 규칙이 `packages/contracts/src/demos.ts` 한 곳에 있다. 서버의 `demoText`·`pickProviders`와 음성 데모의 따로 쓴 검사가 사라졌다.
- 화면의 데모 네 개는 상한 네 개, 커버 스타일 이름, 공급자 이름을 같은 패키지에서 불러온다.
- API 시험 단위 155개·e2e 124개, 계약 패키지의 새 데모 스키마 시험 5개, 화면 단위 시험 496개가 통과한다.

## 남은 것과 배운 것

- 화면은 상한과 이름만 가져다 쓰고, 입력을 스키마로 미리 검사하지는 않는다. 방문자가 주소를 넣으면 서버에 다녀와서야 거절 문구를 본다. 화면도 `parse(SpeechInput, …)`를 먼저 부르면 요청 하나를 아낄 수 있다.
- 막는 말 목록(`BLOCKED`)이 화면 번들에도 들어간다. 지금은 정규식 네 개라 상관없지만, 목록이 길어지면 서버에만 두는 편이 낫다.

배운 것: zod로 옮길 때 가장 손이 많이 간 것은 규칙이 아니라 "옛 함수가 무엇을 먼저 보는가"였다. 사용자에게 보이는 첫 이유가 바뀌면 동작이 바뀐 것이다. 기존 시험이 문구까지 적어 두어서 그 차이를 바로 잡았다.

## 따라 해 보기

상한을 바꾸고 싶으면 `packages/contracts/src/demos.ts`의 숫자 하나만 고친다. 서버의 검사와 화면의 글자 수 표시가 같이 바뀐다.

```bash
pnpm --filter @macfolio/contracts test          # demos.test.ts
pnpm --filter @macfolio/contracts build
pnpm --filter @macfolio/api test -- src/common/demo.test.ts
pnpm typecheck
```

서버가 실제로 막는지는 상한을 넘는 글을 보내 본다. 400과 함께 어느 칸이 왜 틀렸는지가 온다. 정확한 경로와 몸통은 [Swagger](https://macfolio-api.hyeoniverse.com/docs)에 있다. 데모가 쓰는 유료 API를 왜 이렇게 아끼는지는 [요청 제한](/memo/rate-limit-all-writes)에 적었다.

관련 글: [관리자 설정 스키마](/memo/settings-schemas), [글 도메인 옮기기](/memo/contracts-posts), [사이트 프로필로 1단계 마무리](/memo/contracts-site).

#MacFolio #zod #NestJS #리팩터링
