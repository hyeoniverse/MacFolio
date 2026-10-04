import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ProviderFailure } from '../common/demo.js';
import type { SummaryClient } from './summary.client.js';
import { SummaryService } from './summary.service.js';

/** 성공하면 받은 글로 요약을 만들고, 아니면 키가 없다고 실패하는 가짜 */
const fakeClient = (ok: boolean) => {
	const called: { model: string; text: string }[] = [];
	const client = {
		gemini: async (_key: string | undefined, model: string, text: string) => {
			called.push({ model, text });
			if (!ok) throw new ProviderFailure('키가 없습니다');
			return { ko: `요약: ${text}`, en: `Summary: ${text}` };
		},
	} as unknown as SummaryClient;
	return { client, called };
};

const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', SUMMARY_TOTAL_PER_DAY: '1' });

describe('AI 요약', () => {
	it('Gemini가 두 언어 요약을 만들고, 사이트 전체 상한을 넘으면 429', async () => {
		const { client, called } = fakeClient(true);
		const service = new SummaryService(config, client);
		expect(await service.summarize({ text: '글' }, '1.1.1.1')).toEqual({
			provider: 'gemini',
			ko: '요약: 글',
			en: 'Summary: 글',
			remaining: 0,
		});
		expect(called).toEqual([{ model: 'gemini-2.0-flash', text: '글' }]);
		await expect(service.summarize({ text: '글' }, '2.2.2.2')).rejects.toMatchObject({ status: 429 });
	});

	it('만들지 못하면 502에 이유를 담고 횟수를 돌려준다. 잘못된 글은 400', async () => {
		const service = new SummaryService(config, fakeClient(false).client);
		await expect(service.summarize({ text: '글' }, '3.3.3.3')).rejects.toMatchObject({
			status: 502,
			message: '요약을 만들지 못했습니다 (Gemini: 키가 없습니다).',
		});
		expect(service.status('3.3.3.3').remaining).toBe(1);
		await expect(service.summarize({ text: '  ' }, '3.3.3.3')).rejects.toBeInstanceOf(BadRequestException);
	});
});
