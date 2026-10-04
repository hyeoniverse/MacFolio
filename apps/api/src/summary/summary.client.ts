import { Injectable } from '@nestjs/common';
import { ProviderFailure, refuse } from '../common/demo.js';
import { readSummary, suggestedModel, summaryPrompt } from './rules.js';

/**
 * Gemini로 한국어·영어 요약을 함께 받는다. 테스트에서는 이 클래스를 가짜로 바꿔 바깥에 요청하지 않는다.
 * 주소와 요청 모양은 HYEONIVERSE(lib/api/aiSummaryProviders)와 같다
 */
@Injectable()
export class SummaryClient {
	/** 내려간 모델 대신 응답이 권한 모델 (한 번 알아내면 그다음부터 그것으로 묻는다) */
	private replacement: string | null = null;

	async gemini(key: string | undefined, model: string, text: string): Promise<{ ko: string; en: string }> {
		if (!key) throw new ProviderFailure('키가 없습니다');
		const asked = this.replacement ?? model;
		let response = await this.ask(key, asked, text);
		// 모델이 내려갔으면(404) 응답이 권하는 모델로 한 번만 다시 묻는다
		if (response.status === 404) {
			const next = suggestedModel(await response.text().catch(() => ''));
			if (next && next !== asked) {
				response = await this.ask(key, next, text);
				if (response.ok) this.replacement = next;
			}
		}
		if (!response.ok) throw refuse(response);
		const json = (await response.json().catch(() => null)) as {
			candidates?: { content?: { parts?: { text?: string }[] } }[];
		} | null;
		return readSummary(json?.candidates?.[0]?.content?.parts?.[0]?.text);
	}

	private ask(key: string, model: string, text: string) {
		return fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
				body: JSON.stringify({
					contents: [{ parts: [{ text: summaryPrompt(text) }] }],
					generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
				}),
				signal: AbortSignal.timeout(30_000),
			}
		);
	}
}
