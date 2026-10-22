import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fetchSearchQueries, SearchConsoleError, serviceAccountAssertion } from './search-console.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const credentials = {
	siteUrl: 'sc-domain:example.com',
	clientEmail: 'search@project.iam.gserviceaccount.com',
	// 환경 변수처럼 줄바꿈을 \n 글자로 적은 한 줄
	privateKey: (privateKey.export({ type: 'pkcs8', format: 'pem' }) as string).replace(/\n/g, '\\n'),
};
const now = new Date('2026-10-22T03:00:00Z');

const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString());

describe('Search Console', () => {
	it('서비스 계정 JWT: 읽기 전용 범위로 1시간, 개인 키로 서명한다', () => {
		const [header, claims, signature] = serviceAccountAssertion(credentials, now).split('.');
		expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
		expect(decode(claims)).toEqual({
			iss: credentials.clientEmail,
			scope: 'https://www.googleapis.com/auth/webmasters.readonly',
			aud: 'https://oauth2.googleapis.com/token',
			iat: now.getTime() / 1000,
			exp: now.getTime() / 1000 + 3600,
		});
		const valid = createVerify('RSA-SHA256')
			.update(`${header}.${claims}`)
			.verify(publicKey, Buffer.from(signature, 'base64url'));
		expect(valid).toBe(true);
	});

	it('토큰을 받아 날짜·검색어·페이지별로 묻고, 25000줄이 차면 다음 쪽을 묻는다', async () => {
		const calls: { url: string; body: string; authorization?: string }[] = [];
		const full = Array.from({ length: 25_000 }, (_, index) => ({
			keys: ['2026-10-20', `검색어 ${index}`, 'https://example.com/'],
			clicks: 1,
			impressions: 3,
			position: 4.5,
		}));
		const fake = (async (url: string, init?: RequestInit) => {
			const headers = init?.headers as Record<string, string>;
			calls.push({ url, body: String(init?.body), authorization: headers.authorization });
			if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'token-1' });
			const { startRow } = JSON.parse(String(init?.body)) as { startRow: number };
			return Response.json({
				rows:
					startRow === 0
						? full
						: [
								{
									keys: ['2026-10-21', 'macfolio', 'https://example.com/memo/a'],
									clicks: 2,
									impressions: 9,
									position: 1.2,
								},
							],
			});
		}) as typeof fetch;

		const rows = await fetchSearchQueries(credentials, { from: '2026-10-14', to: '2026-10-21' }, now, fake);
		expect(rows).toHaveLength(25_001);
		expect(rows.at(-1)).toEqual({
			day: '2026-10-21',
			query: 'macfolio',
			page: 'https://example.com/memo/a',
			clicks: 2,
			impressions: 9,
			position: 1.2,
		});
		// 토큰 한 번, 검색어 두 쪽
		expect(calls).toHaveLength(3);
		expect(new URLSearchParams(calls[0].body).get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
		expect(calls[1].url).toBe(
			'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query'
		);
		expect(calls[1].authorization).toBe('Bearer token-1');
		expect(JSON.parse(calls[1].body)).toMatchObject({
			startDate: '2026-10-14',
			endDate: '2026-10-21',
			dimensions: ['date', 'query', 'page'],
			startRow: 0,
		});
		expect(JSON.parse(calls[2].body)).toMatchObject({ startRow: 25_000 });
	});

	it('Google이 거절하면 그 이유를 담아 알린다 (서비스 계정을 속성에 더하지 않았을 때 등)', async () => {
		const fake = (async (url: string) =>
			url.startsWith('https://oauth2.googleapis.com/token')
				? Response.json({ access_token: 'token-1' })
				: Response.json(
						{
							error: {
								status: 'PERMISSION_DENIED',
								message: "User does not have sufficient permission for site 'sc-domain:example.com'.",
							},
						},
						{ status: 403 }
					)) as typeof fetch;
		const failure = fetchSearchQueries(credentials, { from: '2026-10-14', to: '2026-10-21' }, now, fake);
		await expect(failure).rejects.toThrow(SearchConsoleError);
		await expect(failure).rejects.toThrow(/403.*PERMISSION_DENIED.*sufficient permission/);
	});

	it('토큰을 받지 못하면 (키가 틀렸을 때) 그 이유를 알린다', async () => {
		const fake = (async () =>
			Response.json(
				{ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' },
				{ status: 400 }
			)) as typeof fetch;
		await expect(fetchSearchQueries(credentials, { from: '2026-10-14', to: '2026-10-21' }, now, fake)).rejects.toThrow(
			'Google API가 거절했습니다 (400): invalid_grant Invalid JWT Signature.'
		);
	});
});
