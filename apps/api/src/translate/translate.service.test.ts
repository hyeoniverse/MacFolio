import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ProviderFailure } from '../common/demo.js';
import type { TranslateClient } from './translate.client.js';
import type { TranslateProvider } from './rules.js';
import { TranslateService } from './translate.service.js';

/** 공급자마다 성공(true)할지 실패할지 정한 가짜. 부른 차례와 받은 언어를 남긴다 */
const fakeClient = (ok: Partial<Record<TranslateProvider, boolean>>) => {
	const called: string[] = [];
	const client = {
		translate: async (provider: TranslateProvider, _keys: unknown, texts: string[], from: string, to: string) => {
			called.push(`${provider}:${from}>${to}`);
			if (!ok[provider]) throw new ProviderFailure('사용 한도에 닿았습니다');
			return texts.map((text) => `${provider}(${text})`);
		},
	} as unknown as TranslateClient;
	return { client, called };
};

const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', TRANSLATE_PER_IP_PER_DAY: '2' });

describe('번역', () => {
	it('DeepL이 실패하면 Google로, 막아 둔 공급자는 건너뛰고 차례를 알려 준다', async () => {
		const { client, called } = fakeClient({ google: true });
		const result = await new TranslateService(config, client).translate({ texts: ['부제', '설명'] }, '1.1.1.1');
		expect(called).toEqual(['deepl:ko>en', 'google:ko>en']);
		expect(result).toEqual({
			provider: 'google',
			attempts: [
				{ provider: 'deepl', state: 'fail', reason: '사용 한도에 닿았습니다' },
				{ provider: 'google', state: 'ok' },
			],
			texts: ['google(부제)', 'google(설명)'],
			remaining: 1,
		});

		const skipped = await new TranslateService(config, fakeClient({ deepl: true, google: true }).client).translate(
			{ text: 'Hi', from: 'en', skip: ['deepl'] },
			'1.1.1.1'
		);
		expect(skipped.provider).toBe('google');
		expect(skipped.attempts.map((attempt) => attempt.state)).toEqual(['skip', 'ok']);
	});

	it('IP마다 하루 상한이 있고(429), 모두 실패하면 502에 이유를 담고 횟수를 돌려준다', async () => {
		const service = new TranslateService(config, fakeClient({ deepl: true }).client);
		expect(service.status('2.2.2.2')).toEqual({ remaining: 2, perIp: 2, total: 50 });
		await service.translate({ text: '하나' }, '2.2.2.2');
		await service.translate({ text: '둘' }, '2.2.2.2');
		await expect(service.translate({ text: '셋' }, '2.2.2.2')).rejects.toMatchObject({ status: 429 });

		const failing = new TranslateService(config, fakeClient({}).client);
		const error = await failing.translate({ text: '하나' }, '3.3.3.3').catch((e: unknown) => e);
		expect(error).toMatchObject({ status: 502 });
		expect((error as { message: string }).message).toContain('DeepL: 사용 한도에 닿았습니다 · Google');
		expect(failing.status('3.3.3.3').remaining).toBe(2);
	});

	it('잘못된 글은 400이고 횟수를 쓰지 않는다', async () => {
		const service = new TranslateService(config, fakeClient({ deepl: true }).client);
		await expect(service.translate({ text: '' }, '4.4.4.4')).rejects.toBeInstanceOf(BadRequestException);
		expect(service.status('4.4.4.4').remaining).toBe(2);
	});
});
