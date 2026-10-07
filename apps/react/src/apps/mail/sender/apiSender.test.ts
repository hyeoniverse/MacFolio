import { describe, expect, it, vi } from 'vitest';
import { createApiSender, fetchContactStatus } from './apiSender';
import type { MailSender } from './types';

const input = { name: '민수', email: 'minsu@example.com', subject: '문의', body: '안녕하세요' };
const fallback: MailSender = { send: vi.fn(async () => ({ status: 'handed-off' as const })) };
const reply = (status: number, body: unknown = {}) =>
	vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

describe('서버로 보내기', () => {
	it('서버가 보내면 sent, 토큰을 함께 보낸다', async () => {
		const fetchImpl = reply(200, { status: 'sent' });
		const result = await createApiSender('https://api.example', fallback, fetchImpl).send(input, {
			turnstileToken: 't',
		});
		expect(result).toEqual({ status: 'sent' });
		const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(url).toBe('https://api.example/contact');
		expect(JSON.parse(init.body)).toEqual({ ...input, turnstileToken: 't' });
	});

	it('서버에 메일 설정이 없으면(503) 메일 앱으로 넘긴다', async () => {
		const result = await createApiSender('https://api.example', fallback, reply(503)).send(input);
		expect(result).toEqual({ status: 'handed-off' });
		expect(fallback.send).toHaveBeenCalledWith(input, undefined);
	});

	it('거절하면 서버가 준 이유를, 닿지 않으면 연결 실패를 알린다', async () => {
		expect(
			await createApiSender('https://api.example', fallback, reply(400, { message: ['이름을 입력해주세요.'] })).send(
				input
			)
		).toEqual({
			status: 'failed',
			message: '이름을 입력해주세요.',
		});
		const offline = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		expect((await createApiSender('https://api.example', fallback, offline).send(input)).status).toBe('failed');
	});

	it('설정을 묻지 못하면 꺼진 것으로 본다', async () => {
		expect(
			await fetchContactStatus('https://api.example', reply(200, { enabled: true, turnstileSiteKey: 'k' }))
		).toEqual({
			enabled: true,
			turnstileSiteKey: 'k',
		});
		expect(await fetchContactStatus('https://api.example', reply(500))).toEqual({
			enabled: false,
			turnstileSiteKey: null,
		});
	});
});
