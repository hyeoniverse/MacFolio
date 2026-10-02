import { describe, expect, it, vi } from 'vitest';
import { EMPTY_ORGANIZATION } from './organize';
import { fetchOrganization, saveOrganization } from './organizationApi';

const ORGANIZATION = {
	folders: ['읽을거리'],
	posts: { a: '읽을거리' },
	moves: [],
	pins: { a: true },
	locks: {},
	order: [],
};
const respond = (status: number, body?: unknown) =>
	vi.fn(
		async () => new Response(body === undefined ? null : JSON.stringify(body), { status })
	) as unknown as typeof fetch;

describe('fetchOrganization', () => {
	it('API가 없으면 요청하지 않고 빈 정리 내용', async () => {
		const fetchImpl = respond(200, ORGANIZATION);
		await expect(fetchOrganization('', fetchImpl)).resolves.toEqual(EMPTY_ORGANIZATION);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('정리 내용을 읽는다', async () => {
		await expect(fetchOrganization('http://api', respond(200, { ...ORGANIZATION, updatedAt: null }))).resolves.toEqual(
			ORGANIZATION
		);
	});

	it('서버 오류나 연결 실패면 빈 정리 내용', async () => {
		await expect(fetchOrganization('http://api', respond(500))).resolves.toEqual(EMPTY_ORGANIZATION);
		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		await expect(fetchOrganization('http://api', down)).resolves.toEqual(EMPTY_ORGANIZATION);
	});
});

describe('saveOrganization', () => {
	it('쿠키와 함께 PUT, 성공 여부를 돌려준다', async () => {
		const fetchImpl = respond(200, ORGANIZATION);
		await expect(saveOrganization('http://api', ORGANIZATION, fetchImpl)).resolves.toBe(true);
		expect(fetchImpl).toHaveBeenCalledWith('http://api/memo/organization', {
			method: 'PUT',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(ORGANIZATION),
		});
		await expect(saveOrganization('http://api', ORGANIZATION, respond(401))).resolves.toBe(false);
	});
});
