---
title: 데모 입력 검사 네 개도 공유 스키마로 — 화면과 서버가 같은 상한을 쓰게
date: 2026-10-16
category: 개발기/MacFolio/백엔드
summary: AI 커버·번역·요약·음성 데모는 서버가 받을 글을 함수로 검사했고, 화면은 같은 상한(60·200·800·80자)을 따로 적어 두었다. 네 규칙을 @macfolio/contracts의 zod 스키마로 옮겨 서버와 화면이 같은 값을 쓰게 했다. 거절 문구는 그대로다.
---

관리자 설정의 세 몸통을 공유 스키마로 옮긴 다음 차례는, 방문자가 실제 AI 서비스를 불러 보는 데모 네 개다.

## 남아 있던 네 곳

| 경로              | 서버 검사                                      | 화면에 따로 적힌 값                  |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| `POST /cover`     | `demoText`로 제목 60자, 모르는 스타일은 기본값 | `MAX_COVER_CHARS = 60`, 스타일 이름  |
| `POST /translate` | 3칸까지, 칸마다 검사, 모두 합쳐 200자          | `MAX_TRANSLATE_CHARS = 200`, 공급자  |
| `POST /summary`   | 줄바꿈을 남기고 800자                          | `MAX_SUMMARY_CHARS = 800`, 공급자    |
| `POST /speech`    | `demoText`를 쓰지 않고 같은 검사를 한 번 더    | `MAX_SPEECH_CHARS = 80`, 공급자 목록 |

화면 주석에는 "서버도 같은 값으로 막는다"고 적혀 있었다. 음성 데모는 다른 셋과 같은 검사를 따로 한 번 더 적었고, 오류 클래스도 `SpeechInputError`로 따로 있었다.

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

서버의 검사 함수는 한 줄이 되었다. `parseSpeechRequest(body)`는 `demoInput(parse(SpeechInput, body))`이고, `demoInput`은 첫 이유를 `DemoInputError`로 던진다. 음성만 쓰던 `SpeechInputError`는 없앴다.

![데모 입력 스키마를 서버와 화면이 함께 쓰는 구조](./images/demo-input-schemas-shared.svg '규칙은 contracts 한 곳, 서버는 검사에, 화면은 상한과 이름에 쓴다')

## 옮기며 맞춘 두 가지

- **칸이 없을 때**: zod는 `transform`이 붙은 칸이 몸통에 없으면 "값이 없다"는 영어 문구를 낸다. 옛 코드는 칸이 없으면 빈 글로 보고 "번역할 글을 써 주세요."를 알렸다. 칸을 `optional()`로 받은 뒤 `transform`에서 빈 글로 바꿔 옛 문구를 지켰다.
- **번역 칸 수**: 옛 코드는 칸 수(3칸)를 먼저 보고, 넘으면 칸마다 검사하지 않았다. zod 배열은 칸 검사와 개수 검사를 함께 하므로, 개수를 먼저 본 뒤 `pipe`로 칸마다 검사하게 나눴다.

## 결과

- 받을 글의 규칙이 `packages/contracts/src/demos.ts` 한 곳에 있다. 서버의 `demoText`·`pickProviders`와 음성 데모의 따로 쓴 검사가 사라졌다.
- 화면의 데모 네 개는 상한 네 개, 커버 스타일 이름, 공급자 이름을 같은 패키지에서 불러온다.
- API 시험 단위 155개·e2e 124개, 계약 패키지의 새 데모 스키마 시험 5개, 화면 단위 시험 496개가 통과한다.

#MacFolio #zod #NestJS #리팩터링
