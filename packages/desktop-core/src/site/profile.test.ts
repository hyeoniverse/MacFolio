import { describe, expect, it } from 'vitest';
import { githubLogin, parseProfile, readProfile } from './profile.js';

const valid = {
	name: ' 김정현 ',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Developer',
	school: '',
	location: 'Seoul',
	github: 'https://github.com/hyeoniverse/',
	email: 'hyeoniverse.dev@gmail.com',
	skills: { frontend: ['React', ' React ', 'TypeScript', ''], backend: ['Node.js'], interaction: [] },
	siteStack: ['Vite'],
	extra: 'ignored',
};

describe('사이트 프로필', () => {
	it('앞뒤 공백·빈 항목·겹친 항목을 정리하고 모르는 필드는 버린다', () => {
		const parsed = parseProfile(valid);
		expect(parsed).toEqual({
			value: {
				name: '김정현',
				nameEn: 'Kim Jeong Hyeon',
				role: 'Frontend Developer',
				school: '',
				location: 'Seoul',
				github: 'https://github.com/hyeoniverse',
				email: 'hyeoniverse.dev@gmail.com',
				skills: { frontend: ['React', 'TypeScript'], backend: ['Node.js'], interaction: [] },
				siteStack: ['Vite'],
			},
		});
	});

	it('이름·이메일·GitHub 주소는 꼭 있어야 하고 모양도 맞아야 한다', () => {
		const parsed = parseProfile({ name: ' ', email: 'not-mail', github: 'https://gitlab.com/me' });
		expect(parsed).toEqual({
			errors: [
				'이름을(를) 입력해 주세요.',
				'GitHub 주소는 https://github.com/아이디 모양이어야 합니다.',
				'이메일 주소가 올바르지 않습니다.',
			],
		});
	});

	it('길이·개수·줄바꿈·타입이 틀리면 거절한다', () => {
		const long = 'a'.repeat(81);
		const parsed = parseProfile({
			...valid,
			role: long,
			location: '서울\n종로',
			skills: { frontend: Array.from({ length: 21 }, (_, i) => `s${i}`), backend: 'Node', interaction: [1] },
		});
		expect('errors' in parsed && parsed.errors).toEqual([
			'직무은(는) 80자까지입니다.',
			'위치에 쓸 수 없는 글자가 있습니다.',
			'프론트엔드 기술은(는) 20개까지입니다.',
			'백엔드 기술은(는) 목록이어야 합니다.',
			'인터랙션 기술의 항목은 글자여야 합니다.',
		]);
		expect(parseProfile(null)).toEqual({ errors: ['프로필을 보내 주세요.'] });
	});

	it('GitHub 아이디, 저장해 둔 값 읽기 (틀렸으면 null)', () => {
		expect(githubLogin({ github: 'https://github.com/hyeoniverse' })).toBe('hyeoniverse');
		expect(githubLogin({ github: 'nope' })).toBe('');
		expect(readProfile(valid)?.name).toBe('김정현');
		expect(readProfile({ name: '' })).toBeNull();
		expect(readProfile(null)).toBeNull();
	});
});
