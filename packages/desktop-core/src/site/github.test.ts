import { describe, expect, it } from 'vitest';
import { githubRepoOf } from './github.js';

describe('githubRepoOf', () => {
	it('GitHub 저장소 주소에서 owner와 이름을 읽는다 (.git, 끝의 /, 뒤의 경로는 떼어 낸다)', () => {
		expect(githubRepoOf('https://github.com/hyeoniverse/QRU')).toEqual({ owner: 'hyeoniverse', name: 'QRU' });
		expect(githubRepoOf('https://github.com/hyeoniverse/QRU.git')).toEqual({ owner: 'hyeoniverse', name: 'QRU' });
		expect(githubRepoOf('https://www.github.com/a-b/c.d_e/')).toEqual({ owner: 'a-b', name: 'c.d_e' });
		expect(githubRepoOf('https://github.com/a/b/tree/main/src')).toEqual({ owner: 'a', name: 'b' });
	});

	it('GitHub 저장소가 아니면 null', () => {
		for (const url of [
			undefined,
			'',
			'저장소',
			'http://github.com/a/b',
			'https://gitlab.com/a/b',
			'https://github.com/hyeoniverse',
			'https://github.com/-bad/b',
			'https://github.com/a/..',
			'https://github.com.evil.test/a/b',
		])
			expect(githubRepoOf(url), String(url)).toBeNull();
	});
});
