---
title: 뉴스 요약을 OpenAI에서 Claude로
date: 2026-10-25
category: 개발기/NewPick/백엔드
summary: 뉴픽의 AI 호출 네 곳(요약, 제목, HTML 변환, 카테고리 분류)을 OpenAI에서 Claude로 바꾸며 한 경로로 모았다. 거절과 잘림을 오류로 바꿔 잘린 요약이 저장되지 않게 하고, 카테고리 분류는 JSON 스키마로 DB의 이름만 돌아오게 했다. 공개 API가 원본 응답을 그대로 내려주던 것도 정리했다.
---

뉴픽의 뉴스레터는 크롤링한 기사 묶음을 AI가 요약해 만든다. v1은 OpenAI의 `gpt-4o-mini`를 썼고, 이번에 Claude로 바꿨다(PR #30). 단순히 SDK만 바꾸지 않고, 네 군데 흩어져 있던 호출을 한 경로로 모으면서 v1에서 처리하지 않던 실패 경우를 함께 다뤘다.

## 바꾸기 전 구조

| 서비스                  | 하는 일                        | 문제                                                       |
| ----------------------- | ------------------------------ | ---------------------------------------------------------- |
| `BasicSummarizeService` | 기사 묶음 → 한국어 요약        | 응답 객체를 그대로 돌려줘, 호출하는 쪽이 `choices[0]`을 앎 |
| `CreateTitleService`    | 요약 → 제목                    | 따옴표나 "제목:"이 붙어 와도 그대로 저장                   |
| `HTMLFormatterService`  | 요약 → 메일·상세 페이지용 HTML | 코드 블록(` ```html `)으로 감싸 오면 그대로 저장           |
| `FindCategoryService`   | 크롤링 기사 → 카테고리 이름    | DB에 없는 이름이 오면 `categoryId`가 비어 저장             |

네 서비스가 각자 `openai.chat.completions.create`를 불렀고, 응답이 잘렸는지(`finish_reason`)는 아무도 확인하지 않았다. 요약이 중간에 끊겨도 뉴스레터로 저장되어 구독자에게 발송될 수 있었다.

## 한 경로로

![AI 호출 경로](./images/newpick-claude-api-flow.svg '네 서비스가 ClaudeService.generate 하나를 거친다')

모든 호출은 `ClaudeService.generate`를 거친다. 시스템 프롬프트와 입력, 생각의 깊이(effort), 필요하면 JSON 스키마를 받아 텍스트와 사용 토큰을 돌려준다.

```ts
const response = await this.client.beta.messages.create({
	model: CLAUDE_MODEL,
	max_tokens: maxTokens,
	// 안전 분류기가 요청을 거절하면 서버가 권장 모델로 다시 실행합니다.
	betas: ['server-side-fallback-2026-07-01'],
	fallbacks: 'default',
	output_config: {
		effort,
		...(schema && { format: { type: 'json_schema', schema } }),
	},
	system,
	messages: [{ role: 'user', content: prompt }],
});

if (response.stop_reason === 'refusal') throw new Error(`요청이 거절되었습니다 (...)`);
// 잘린 요약이 뉴스레터로 저장되지 않도록 실패로 처리합니다.
if (response.stop_reason === 'max_tokens') throw new Error(`응답이 max_tokens(${maxTokens})에서 잘렸습니다`);
```

| 결정                                               | 이유                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 모델 `claude-opus-5-5`, `CLAUDE_MODEL`로 변경 가능 | 품질 우선으로 시작하고, 비용을 보고 Haiku 등으로 내릴 수 있게                                   |
| effort: 요약 `medium`, 나머지 `low`                | 요약은 뉴스레터 본문이라 품질이 중요하고, 제목·HTML·분류는 단순한 작업                          |
| `fallbacks: 'default'`                             | 뉴스 기사에는 사건·사고가 많다. 안전 분류기가 거절하면 서버가 권장 모델로 같은 요청을 다시 실행 |
| 거절·잘림은 오류                                   | 스케줄러는 카테고리별로 실패를 격리하므로, 한 카테고리가 실패해도 나머지는 발송된다             |
| `temperature` 제거                                 | 현재 API에서는 보내면 400                                                                       |

## 카테고리 분류: 답을 DB의 이름으로 제한

크롤링한 기사 중 카테고리가 없는 것은 AI가 분류한다. v1은 "카테고리 이름만 답하라"고 프롬프트로 부탁했고, 돌아온 문자열을 DB 목록에서 찾았다. 답이 "IT/과학"이나 "IT."처럼 조금만 달라도 찾지 못해 `categoryId`가 비게 되는 구조였다.

이번에는 응답 형식을 JSON 스키마로 지정하고, 값을 DB의 카테고리 이름 중 하나로 제한했다.

```ts
schema: {
  type: 'object',
  properties: { category: { type: 'string', enum: names } },
  required: ['category'],
  additionalProperties: false,
},
```

`names`는 요청할 때마다 DB에서 읽은 목록이다. 카테고리를 추가해도 코드는 바뀌지 않는다.

## 공개 API가 원본 응답을 내려주던 것

홈의 무료 체험 API는 로그인 없이 호출된다. 응답에 `openaiResponse` 필드로 OpenAI의 원본 응답 객체(요청 id, 사용 토큰, 모델 정보 등)를 그대로 담고 있었다. 웹은 이 필드를 쓰지 않았다. 전환하면서 응답에서 뺐다.

## 시험

로컬에 API 키가 없어, 실제 HTTP 대신 SDK에 가짜 `fetch`를 넣어 요청과 응답 처리를 시험했다.

| 시험                      | 확인하는 것                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 정상 응답                 | 텍스트 앞뒤 공백 제거, 토큰 = 입력 + 출력, 요청 본문의 모델·`fallbacks`·beta 헤더·effort, `temperature` 없음 |
| `schema` 전달             | `output_config.format`이 `json_schema`                                                                       |
| `stop_reason: refusal`    | 오류 (카테고리 포함)                                                                                         |
| `stop_reason: max_tokens` | 오류                                                                                                         |

api 테스트는 35개가 됐다. 키 없이 docker로 띄워 의존성 주입과 서버 시작도 확인했다.

## 남은 것·배운 것

- **실제 호출은 아직 확인하지 못했다.** 키를 넣고 무료 체험 요약 한 번과 크롤링 카테고리 분류 한 번을 돌려 봐야 한다. 가짜 응답 시험은 "내가 이해한 API 형태대로 보낸다"까지만 보장한다.
- 비용은 커졌다. Opus는 `gpt-4o-mini`보다 훨씬 비싸고, 카테고리 분류는 크롤링한 기사마다 호출된다. 분류처럼 단순한 작업만 작은 모델로 보내는 방법도 있지만, 먼저 실제 사용량을 보고 정한다.
- 호출을 한 경로로 모으니, 실패 처리(거절, 잘림)를 한 번만 쓰면 네 곳에 모두 적용됐다. v1에서 잘림을 아무도 확인하지 않았던 것도 처리 위치가 네 곳으로 흩어져 있었기 때문이라고 생각한다.
