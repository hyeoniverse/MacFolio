import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ProviderFailure } from '../common/demo.js';
import type { SummaryClient } from './summary.client.js';
import { SummaryService } from './summary.service.js';

/** 공급자마다 성공하거나(true) 키가 없다고 실패하는(false) 가짜. 누구에게 무엇을 물었는지 남긴다 */
const fakeClient = (works: { groq: boolean; gemini: boolean }) => {
	const called: { provider: string; model: string; text: string }[] = [];
	const answer = (provider: 'groq' | 'gemini') => async (_key: string | undefined, model: string, text: string) => {
		called.push({ provider, model, text });
		if (!works[provider]) throw new ProviderFailure('키가 없습니다');
		return { ko: `요약: ${text}`, en: `Summary: ${text}` };
	};
	const client = { groq: answer('groq'), gemini: answer('gemini') } as unknown as SummaryClient;
	return { client, called };
};

const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', SUMMARY_TOTAL_PER_DAY: '2' });

describe('AI 요약', () => {
	it('Groq가 기본: 두 언어 요약을 만들고, Gemini는 묻지 않는다', async () => {
		const { client, called } = fakeClient({ groq: true, gemini: true });
		const service = new SummaryService(config, client);
		expect(await service.summarize({ text: '글' }, '1.1.1.1')).toEqual({
			provider: 'groq',
			ko: '요약: 글',
			en: 'Summary: 글',
			// IP마다 3번, 사이트 전체 2번 가운데 적은 쪽
			remaining: 1,
		});
		expect(called).toEqual([{ provider: 'groq', model: 'openai/gpt-oss-120b', text: '글' }]);
	});

	it('Groq가 실패하면 Gemini로 넘어간다. 사이트 전체 상한을 넘으면 429', async () => {
		const { client, called } = fakeClient({ groq: false, gemini: true });
		const service = new SummaryService(config, client);
		expect(await service.summarize({ text: '글' }, '1.1.1.1')).toMatchObject({ provider: 'gemini' });
		expect(called.map((call) => call.provider)).toEqual(['groq', 'gemini']);
		expect(called[1].model).toBe('gemini-flash-latest');
		await service.summarize({ text: '글' }, '2.2.2.2');
		await expect(service.summarize({ text: '글' }, '3.3.3.3')).rejects.toMatchObject({ status: 429 });
	});

	it('모두 만들지 못하면 502에 공급자마다의 이유를 담고 횟수를 돌려준다. 잘못된 글은 400', async () => {
		const service = new SummaryService(config, fakeClient({ groq: false, gemini: false }).client);
		await expect(service.summarize({ text: '글' }, '4.4.4.4')).rejects.toMatchObject({
			status: 502,
			message: '요약을 만들지 못했습니다 (Groq: 키가 없습니다 · Gemini: 키가 없습니다).',
		});
		expect(service.status('4.4.4.4').remaining).toBe(2);
		await expect(service.summarize({ text: '  ' }, '4.4.4.4')).rejects.toBeInstanceOf(BadRequestException);
	});

	it('GROQ_MODEL로 모델을 바꾼다', async () => {
		const { client, called } = fakeClient({ groq: true, gemini: true });
		const custom = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', GROQ_MODEL: 'openai/gpt-oss-20b' });
		await new SummaryService(custom, client).summarize({ text: '글' }, '5.5.5.5');
		expect(called[0]).toMatchObject({ provider: 'groq', model: 'openai/gpt-oss-20b' });
	});
});
