import { BadRequestException, HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { ProviderFailure, type SpeechClient } from './speech.client.js';
import type { SpeechProvider } from './rules.js';
import { SpeechService } from './speech.service.js';

/** 공급자마다 성공(true)할지 실패할지 정한 가짜. 부른 차례를 남긴다 */
const fakeClient = (ok: Partial<Record<SpeechProvider, boolean>>) => {
	const called: SpeechProvider[] = [];
	const client = {
		synthesize: async (provider: SpeechProvider) => {
			called.push(provider);
			if (!ok[provider]) throw new ProviderFailure('키가 없습니다');
			return Buffer.from(`mp3-${provider}`);
		},
	} as unknown as SpeechClient;
	return { client, called };
};

const config = loadConfig({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', SPEECH_PER_IP_PER_DAY: '2' });

describe('음성 만들기', () => {
	it('Fish가 실패하면 Google로, 막아 둔 공급자는 건너뛰고 차례를 그대로 알려 준다', async () => {
		const { client, called } = fakeClient({ google: true });
		const result = await new SpeechService(config, client).synthesize({ text: '안녕하세요' }, '1.1.1.1');
		expect(called).toEqual(['fish', 'google']);
		expect(result.provider).toBe('google');
		expect(Buffer.from(result.audio, 'base64').toString()).toBe('mp3-google');
		expect(result.attempts).toEqual([
			{ provider: 'fish', state: 'fail', reason: '키가 없습니다' },
			{ provider: 'google', state: 'ok' },
		]);

		const skipped = await new SpeechService(config, fakeClient({ fish: true, edge: true }).client).synthesize(
			{ text: 'hi', lang: 'en', skip: ['fish', 'google'] },
			'1.1.1.1'
		);
		expect(skipped.provider).toBe('edge');
		expect(skipped.attempts.map((attempt) => attempt.state)).toEqual(['skip', 'skip', 'ok']);
	});

	it('IP마다 하루 상한이 있고, 모두 실패한 요청은 횟수를 돌려준다', async () => {
		const service = new SpeechService(config, fakeClient({ edge: true }).client);
		expect(service.status('2.2.2.2')).toEqual({ remaining: 2, perIp: 2, total: 50 });
		expect((await service.synthesize({ text: '하나' }, '2.2.2.2')).remaining).toBe(1);
		await service.synthesize({ text: '둘' }, '2.2.2.2');
		await expect(service.synthesize({ text: '셋' }, '2.2.2.2')).rejects.toBeInstanceOf(HttpException);
		expect(service.status('3.3.3.3').remaining).toBe(2);

		const failing = new SpeechService(config, fakeClient({}).client);
		await expect(failing.synthesize({ text: '하나' }, '4.4.4.4')).rejects.toMatchObject({ status: 502 });
		expect(failing.status('4.4.4.4').remaining).toBe(2);
	});

	it('잘못된 글은 400', async () => {
		const service = new SpeechService(config, fakeClient({ edge: true }).client);
		await expect(service.synthesize({ text: '' }, '5.5.5.5')).rejects.toBeInstanceOf(BadRequestException);
		expect(service.status('5.5.5.5').remaining).toBe(2);
	});
});
