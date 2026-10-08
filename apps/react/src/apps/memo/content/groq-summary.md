---
title: AI 요약 데모의 기본 공급자를 Groq로
date: 2026-10-05
category: 개발기/MacFolio/프로젝트·GitHub
summary: Safari의 HYEONIVERSE 페이지에 있는 AI 요약 데모는 Gemini 하나로만 요약했다. Groq를 기본 공급자로 앞에 두고, 실패하면 Gemini로 넘어가게 했다. 번역 데모와 같은 "차례대로 시도" 구조를 그대로 썼다.
---

Safari의 HYEONIVERSE 페이지에는 글을 붙여 넣고 '발행'을 누르면 한국어·영어 요약을 실제로 만들어 주는 데모가 있다. 지금까지는 MacFolio API가 Gemini 하나로만 요약했다. Gemini 키가 없거나 한도에 닿으면 데모가 그대로 멈췄다.

이번에 **Groq를 기본 공급자**로 앞에 두고, 실패하면 Gemini로 넘어가게 했다.

## 차례대로 시도하는 구조는 이미 있었다

번역 데모는 처음부터 DeepL → Google 차례로 시도했다. 공급자 하나를 부르는 함수를 받아, 실패하면 다음으로 넘어가며 시도 기록을 남기는 `tryInOrder`가 공통 모듈에 있다. 요약은 공급자가 하나라 `['gemini']`로만 불렀는데, 여기에 하나를 더하기만 하면 됐다.

```ts
export const SUMMARY_PROVIDERS = ['groq', 'gemini'] as const;

await tryInOrder(SUMMARY_PROVIDERS, [], (name) =>
	name === 'groq'
		? this.client.groq(groqApiKey, groqModel, request.text)
		: this.client.gemini(geminiApiKey, geminiModel, request.text)
);
```

둘 다 실패하면 오류 메시지에 공급자마다의 이유가 함께 실린다: `요약을 만들지 못했습니다 (Groq: 키가 없습니다 · Gemini: 키가 없습니다).` 쓴 횟수는 돌려준다.

## Groq 부르기

Groq는 OpenAI와 같은 모양의 Chat Completions API를 준다. 프롬프트와 받은 답을 읽는 함수(`summaryPrompt`, `readSummary`)는 Gemini와 그대로 같이 쓰고, 요청 모양만 다르다.

```ts
fetch('https://api.groq.com/openai/v1/chat/completions', {
	method: 'POST',
	headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
	body: JSON.stringify({
		model, // 기본 openai/gpt-oss-120b
		messages: [{ role: 'user', content: summaryPrompt(text) }],
		temperature: 0.2,
		response_format: { type: 'json_object' }, // {"ko","en"}만 받는다
	}),
});
```

기본 모델은 Groq의 운영(production) 모델인 `openai/gpt-oss-120b`로 두었다. Groq는 모델을 자주 내리기 때문에 `GROQ_MODEL`로 바꿀 수 있게 했다. 모델이 내려가 Groq가 실패해도 Gemini가 대신 만들어서 데모는 멈추지 않는다. 요약이 계속 Gemini로만 만들어지면 Groq 모델이 내려갔는지 보면 된다.

## 화면

데모 아래의 안내가 "Gemini로 만든 요약입니다"로 고정되어 있었다. 서버가 응답에 실어 주는 `provider`를 보고 실제로 만든 공급자 이름을 보여 주게 바꿨다.

## 시험

- 단위 테스트: Groq가 되면 Gemini는 묻지 않는다 / Groq가 실패하면 Gemini로 넘어간다 / 둘 다 실패하면 502에 두 이유, 쓴 횟수는 돌려준다 / `GROQ_MODEL`로 모델을 바꾼다
- 화면 테스트: 가짜 서버가 `provider: 'groq'`로 답하면 "Groq로 만든 요약입니다"가 보인다
- 키 없이 Groq 주소를 불러 `401 invalid_api_key`가 오는 것으로 주소가 맞는지 확인했다. 실제 키로 만든 요약은 서버에 키를 넣은 뒤 확인한다

#MacFolio #AI #HYEONIVERSE
