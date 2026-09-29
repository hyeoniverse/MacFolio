import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
	const DATABASE_URL = 'postgresql://u:p@localhost:5432/db';

	it('기본값: 포트 4000, 로컬 프론트엔드만 허용, 관리자는 hyeoniverse', () => {
		expect(loadConfig({ DATABASE_URL })).toEqual({
			port: 4000,
			databaseUrl: DATABASE_URL,
			corsOrigins: ['http://localhost:5173'],
			frontendUrl: 'http://localhost:5173',
			apiUrl: 'http://localhost:4000',
			auth: {
				githubClientId: undefined,
				githubClientSecret: undefined,
				adminGithubLogin: 'hyeoniverse',
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
		const config = loadConfig({ DATABASE_URL, NODE_ENV: 'production', API_URL: 'https://api.example.com/' });
		expect(config.auth.secureCookies).toBe(true);
		expect(config.apiUrl).toBe('https://api.example.com');
	});

	it('DATABASE_URL이 없거나 포트가 잘못되면 시작하지 않는다', () => {
		expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
		expect(() => loadConfig({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
	});
});
