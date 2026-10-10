import { describe, expect, it, vi } from 'vitest';
import { deleteServerFile, formatSize, usageOf, type ServerFile } from './filesApi';

const file = (usedBy: Partial<ServerFile['usedBy']> = {}): ServerFile => ({
	id: 'AAAAAAAAAAAAAAAA',
	name: 'a.png',
	type: 'image/png',
	size: 10,
	image: true,
	path: '/files/AAAAAAAAAAAAAAAA',
	createdAt: '2026-10-09T00:00:00Z',
	createdBy: 'hyeoniverse',
	usedBy: { posts: [], revisions: [], wallpaper: false, ...usedBy },
});

describe('usageOf', () => {
	it('아무도 안 쓰거나 예전 버전에서만 쓰면 지울 수 있다', () => {
		expect(usageOf(file(), [])).toEqual({ removable: true, label: '쓰는 곳 없음' });
		expect(usageOf(file({ revisions: ['a'] }), [])).toEqual({ removable: true, label: '예전 버전에서만: a' });
	});

	it('지금 글이나 배경화면이 쓰면 지울 수 없다', () => {
		expect(usageOf(file({ posts: ['a', 'b'] }), []).removable).toBe(false);
		expect(usageOf(file({ wallpaper: true }), [])).toEqual({ removable: false, label: '배경화면' });
	});

	it('서버가 모르는 저장소 글이 가리켜도 쓰는 파일로 본다', () => {
		const repo = [{ slug: 'cra-to-vite', body: '![그림](https://api.x/files/AAAAAAAAAAAAAAAA)' }];
		expect(usageOf(file({ revisions: ['a'] }), repo)).toEqual({ removable: false, label: '글 1개: cra-to-vite' });
	});
});

describe('formatSize', () => {
	it('알맞은 단위로', () => {
		expect(formatSize(512)).toBe('512 B');
		expect(formatSize(1536)).toBe('1.5 KB');
		expect(formatSize(20 * 1024 * 1024)).toBe('20 MB');
	});
});

describe('deleteServerFile', () => {
	it('쓰는 파일이라 거절하면 서버가 말한 이유를 돌려준다', async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ message: '배경화면에서 쓰는 파일입니다.' }), { status: 409 }));
		expect(await deleteServerFile('https://api.x', 'id', fetchImpl)).toEqual({
			ok: false,
			reason: '배경화면에서 쓰는 파일입니다.',
		});
		expect(fetchImpl).toHaveBeenCalledWith(
			'https://api.x/files/id',
			expect.objectContaining({ method: 'DELETE', credentials: 'include' })
		);
	});
});
