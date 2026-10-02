import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import type { GithubClient, GithubUser } from './github.client.js';
import { hashToken } from './session.js';

interface Row {
	tokenHash: string;
	githubId: number;
	githubLogin: string;
	createdAt?: Date;
	expiresAt: Date;
}

/** 세션 테이블 흉내 */
function fakePrisma(rows: Row[]) {
	return {
		adminSession: {
			create: async ({ data }: { data: Row }) => rows.push(data),
			findUnique: async ({ where }: { where: { tokenHash: string } }) =>
				rows.find((row) => row.tokenHash === where.tokenHash) ?? null,
			deleteMany: async ({ where }: { where: { tokenHash?: string; expiresAt?: { lte: Date } } }) => {
				const keep = rows.filter((row) =>
					where.tokenHash ? row.tokenHash !== where.tokenHash : row.expiresAt > where.expiresAt!.lte
				);
				rows.splice(0, rows.length, ...keep);
			},
		},
	} as unknown as PrismaService;
}

const fakeGithub = (user: GithubUser | null) =>
	({
		exchangeCode: async ({ code }: { code: string }) => (code === 'good' ? 'access-token' : null),
		getUser: async () => user,
	}) as unknown as GithubClient;

const ADMIN_ID = 68999618;
const config = loadConfig({
	DATABASE_URL: 'postgresql://x',
	GITHUB_CLIENT_ID: 'id',
	GITHUB_CLIENT_SECRET: 'secret',
});
const now = new Date('2026-09-29T00:00:00Z');

describe('AuthService', () => {
	let rows: Row[];
	beforeEach(() => {
		rows = [];
	});

	it('관리자 계정이면 세션을 만들고, DB에는 토큰이 아니라 해시만 둔다', async () => {
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: ADMIN_ID, login: 'Hyeoniverse', avatarUrl: '' }),
			config
		);
		const session = await auth.signIn('good', now);

		expect(session?.login).toBe('Hyeoniverse');
		expect(rows).toHaveLength(1);
		expect(rows[0].tokenHash).toBe(hashToken(session!.token));
		expect(rows[0].githubId).toBe(ADMIN_ID);
		expect(JSON.stringify(rows)).not.toContain(session!.token);
		expect(rows[0].expiresAt.getTime() - now.getTime()).toBe(12 * 60 * 60 * 1000);
	});

	it('관리자가 아닌 계정은 세션을 만들지 않는다', async () => {
		const auth = new AuthService(fakePrisma(rows), fakeGithub({ id: 1, login: 'someone', avatarUrl: '' }), config);
		await expect(auth.signIn('good', now)).resolves.toBeNull();
		expect(rows).toHaveLength(0);
	});

	it('이름이 hyeoniverse여도 ID가 다르면 관리자가 아니다 (이름을 바꾼 뒤 옛 이름을 가져간 계정)', async () => {
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: 999, login: 'hyeoniverse', avatarUrl: '' }),
			config
		);
		await expect(auth.signIn('good', now)).resolves.toBeNull();
		expect(rows).toHaveLength(0);
	});

	it('관리자가 이름을 바꿔도 ID가 같으면 로그인된다', async () => {
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: ADMIN_ID, login: 'new-name', avatarUrl: '' }),
			config
		);
		await expect(auth.signIn('good', now)).resolves.toMatchObject({ login: 'new-name' });
	});

	it('GitHub 로그인이 실패하면 401', async () => {
		const auth = new AuthService(fakePrisma(rows), fakeGithub(null), config);
		await expect(auth.signIn('bad', now)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it('세션 토큰으로 관리자와 로그인한 때·끝나는 때를 찾고, 만료되거나 로그아웃하면 못 찾는다', async () => {
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: ADMIN_ID, login: 'hyeoniverse', avatarUrl: '' }),
			config
		);
		const { token } = (await auth.signIn('good', now))!;

		await expect(auth.findAdmin(token, now)).resolves.toEqual({
			login: 'hyeoniverse',
			signedInAt: now,
			expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
		});
		await expect(auth.findAdmin('guess', now)).resolves.toBeNull();
		await expect(auth.findAdmin(undefined, now)).resolves.toBeNull();
		await expect(auth.findAdmin(token, new Date(now.getTime() + 13 * 60 * 60 * 1000))).resolves.toBeNull();

		await auth.signOut(token);
		await expect(auth.findAdmin(token, now)).resolves.toBeNull();
	});

	it('새로 로그인할 때 만료된 세션을 치운다', async () => {
		rows.push({
			tokenHash: 'old',
			githubId: ADMIN_ID,
			githubLogin: 'hyeoniverse',
			expiresAt: new Date('2026-09-01T00:00:00Z'),
		});
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: ADMIN_ID, login: 'hyeoniverse', avatarUrl: '' }),
			config
		);
		await auth.signIn('good', now);
		expect(rows.map((row) => row.tokenHash)).not.toContain('old');
	});

	it('관리자 ID를 바꾸면 이전 관리자의 세션은 통하지 않는다', async () => {
		const auth = new AuthService(
			fakePrisma(rows),
			fakeGithub({ id: ADMIN_ID, login: 'hyeoniverse', avatarUrl: '' }),
			config
		);
		const { token } = (await auth.signIn('good', now))!;
		const changed = loadConfig({ DATABASE_URL: 'postgresql://x', ADMIN_GITHUB_ID: '12345' });
		const after = new AuthService(fakePrisma(rows), fakeGithub(null), changed);
		await expect(after.findAdmin(token, now)).resolves.toBeNull();
	});

	it('GitHub 로그인 주소: 콜백, state, 가입 막기', () => {
		const auth = new AuthService(fakePrisma(rows), fakeGithub(null), config);
		const url = new URL(auth.authorizeUrl('xyz'));
		expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
		expect(url.searchParams.get('client_id')).toBe('id');
		expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4000/auth/github/callback');
		expect(url.searchParams.get('state')).toBe('xyz');
		expect(url.searchParams.get('allow_signup')).toBe('false');
		expect(url.searchParams.get('scope')).toBeNull();
	});
});
