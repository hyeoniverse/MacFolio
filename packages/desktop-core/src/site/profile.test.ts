import { describe, expect, it } from 'vitest';
import { githubLogin } from './profile.js';

describe('사이트 프로필', () => {
	it('GitHub 아이디는 프로필 주소에서 (주소가 틀리면 빈 문자열)', () => {
		expect(githubLogin({ github: 'https://github.com/hyeoniverse' })).toBe('hyeoniverse');
		expect(githubLogin({ github: 'https://github.com/hyeoniverse/' })).toBe('hyeoniverse');
		expect(githubLogin({ github: 'nope' })).toBe('');
	});
});
