import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
	const DATABASE_URL = 'postgresql://u:p@localhost:5432/db';

	it('기본값: 포트 4000, 로컬 프론트엔드만 허용, 관리자는 hyeoniverse(ID), 프록시는 믿지 않음', () => {
		expect(loadConfig({ DATABASE_URL })).toEqual({
			port: 4000,
			databaseUrl: DATABASE_URL,
			corsOrigins: ['http://localhost:5173'],
			frontendUrl: 'http://localhost:5173',
			apiUrl: 'http://localhost:4000',
			trustProxy: 0,
			commentRateLimit: 5,
			ipHashSecret: 'macfolio-dev-ip-hash-secret',
			// 사진 찾기 키가 없으면 그 서비스만 꺼진다
			stockPhotos: { unsplashAccessKey: undefined, pexelsApiKey: undefined },
			// 음성 만들기: 키가 없으면 Edge만, 하루 IP마다 3번·전체 50번
			speech: { fishAudioApiKey: undefined, googleTtsApiKey: undefined, perIpPerDay: 3, totalPerDay: 50 },
			auth: {
				githubClientId: undefined,
				githubClientSecret: undefined,
				adminGithubId: 68999618,
				loginRateLimit: 10,
				secureCookies: false,
			},
		});
	});

	it('허용 주소는 쉼표로 여러 개, 돌아갈 주소는 첫 번째', () => {
		const config = loadConfig({ DATABASE_URL, CORS_ORIGINS: 'https://a.com, https://b.com,' });
		expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
		expect(config.frontendUrl).toBe('https://a.com');
	});

	it('배포에서는 쿠키를 https로만', () => {
		const config = loadConfig({
			DATABASE_URL,
			NODE_ENV: 'production',
			API_URL: 'https://api.example.com/',
			IP_HASH_SECRET: 'x',
		});
		expect(config.auth.secureCookies).toBe(true);
		expect(config.apiUrl).toBe('https://api.example.com');
	});

	it('배포에서는 IP 해시 키가 꼭 있어야 한다', () => {
		expect(() => loadConfig({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(/IP_HASH_SECRET/);
		expect(loadConfig({ DATABASE_URL, NODE_ENV: 'production', IP_HASH_SECRET: 's3cret' }).ipHashSecret).toBe('s3cret');
	});

	it('관리자 ID는 숫자여야 한다', () => {
		expect(loadConfig({ DATABASE_URL, ADMIN_GITHUB_ID: '42' }).auth.adminGithubId).toBe(42);
		expect(() => loadConfig({ DATABASE_URL, ADMIN_GITHUB_ID: 'hyeoniverse' })).toThrow(/ADMIN_GITHUB_ID/);
	});

	it('DATABASE_URL이 없거나 포트가 잘못되면 시작하지 않는다', () => {
		expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
		expect(() => loadConfig({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
	});
});
