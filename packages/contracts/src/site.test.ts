import { describe, expect, it } from 'vitest';
import {
	parseProfile,
	parseResume,
	parseWidgetDefaults,
	readProfile,
	readResume,
	readWidgetDefaults,
	RESUME_LIMITS,
	SiteView,
} from './site.js';
import { parse } from './parse.js';

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
const clean = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Developer',
	school: '',
	location: 'Seoul',
	github: 'https://github.com/hyeoniverse',
	email: 'hyeoniverse.dev@gmail.com',
	skills: { frontend: ['React', 'TypeScript'], backend: ['Node.js'], interaction: [] },
	siteStack: ['Vite'],
};

describe('사이트 프로필', () => {
	it('앞뒤 공백·빈 항목·겹친 항목을 정리하고 모르는 필드는 버린다', () => {
		expect(parseProfile(valid)).toEqual({ value: clean });
	});

	it('이름·이메일·GitHub 주소는 꼭 있어야 하고 모양도 맞아야 한다 (이유는 칸 순서대로)', () => {
		expect(parseProfile({ name: ' ', email: 'not-mail', github: 'https://gitlab.com/me' })).toEqual({
			errors: [
				'이름을(를) 입력해 주세요.',
				'GitHub 주소는 https://github.com/아이디 모양이어야 합니다.',
				'이메일 주소가 올바르지 않습니다.',
			],
		});
		expect(parseProfile({ ...valid, name: '', email: 'nope' })).toEqual({
			errors: ['이름을(를) 입력해 주세요.', '이메일 주소가 올바르지 않습니다.'],
		});
	});

	it('길이·개수·줄바꿈·타입이 틀리면 거절한다', () => {
		const long = 'a'.repeat(81);
		expect(
			parseProfile({
				...valid,
				role: long,
				location: '서울\n종로',
				skills: { frontend: Array.from({ length: 21 }, (_, i) => `s${i}`), backend: 'Node', interaction: [1] },
			})
		).toEqual({
			errors: [
				'직무은(는) 80자까지입니다.',
				'위치에 쓸 수 없는 글자가 있습니다.',
				'프론트엔드 기술은(는) 20개까지입니다.',
				'백엔드 기술은(는) 목록이어야 합니다.',
				'인터랙션 기술의 항목은 글자여야 합니다.',
			],
		});
		expect(parseProfile({ ...valid, name: 3, skills: 'x' })).toEqual({
			errors: ['이름은(는) 글자여야 합니다.', '기술은 묶음(frontend·backend·interaction)이어야 합니다.'],
		});
		expect(parseProfile(null)).toEqual({ errors: ['프로필을 보내 주세요.'] });
		expect(parseProfile([])).toEqual({ errors: ['프로필을 보내 주세요.'] });
	});

	it('저장해 둔 값 읽기 (틀렸으면 null), 응답 모양', () => {
		expect(readProfile(valid)?.name).toBe('김정현');
		expect(readProfile({ name: '' })).toBeNull();
		expect(readProfile(null)).toBeNull();
		expect(parse(SiteView, { profile: null, projects: null, updatedAt: null })).toEqual({
			value: { profile: null, projects: null, updatedAt: null },
		});
		const projects = { items: [{ id: 'qru', hidden: true }] };
		expect(parse(SiteView, { profile: clean, projects, updatedAt: '2026-10-11T00:00:00.000Z' })).toEqual({
			value: { profile: clean, projects, updatedAt: '2026-10-11T00:00:00.000Z' },
		});
		expect(parse(SiteView, { profile: null, projects: { items: 'x' }, updatedAt: null })).toEqual({
			errors: ['items 목록을 보내 주세요.'],
		});
	});
});

describe('ResumeInput', () => {
	it('이력서 Markdown 한 장: 줄바꿈을 \\n으로 맞추고 앞뒤를 다듬는다', () => {
		expect(parseResume({ markdown: '\r\n# 김정현\r\n\r\n## 강점\r\n- 끝까지 운영\t!\n' })).toEqual({
			value: { markdown: '# 김정현\n\n## 강점\n- 끝까지 운영\t!' },
		});
	});

	it('비었거나, 너무 길거나, 제어 문자가 있으면 이유를 돌려준다', () => {
		expect(parseResume({ markdown: '  \n ' })).toEqual({ errors: ['이력서 내용을 입력해 주세요.'] });
		expect(parseResume({ markdown: 'a'.repeat(RESUME_LIMITS.markdown + 1) })).toEqual({
			errors: ['이력서는 20,000자까지입니다.'],
		});
		expect(parseResume({ markdown: '# 이름\u0007' })).toEqual({ errors: ['이력서에 쓸 수 없는 글자가 있습니다.'] });
		expect(parseResume({ markdown: 3 })).toEqual({ errors: ['이력서는 글자여야 합니다.'] });
		expect(parseResume(null)).toEqual({ errors: ['이력서를 보내 주세요.'] });
	});

	it('저장해 둔 값 읽기 (틀렸으면 null), 응답에 실린다 (예전 응답에는 없어도 된다)', () => {
		expect(readResume({ markdown: '# 이름' })).toEqual({ markdown: '# 이름' });
		expect(readResume({ markdown: '' })).toBeNull();
		expect(readResume(null)).toBeNull();
		expect(parse(SiteView, { profile: null, projects: null, resume: { markdown: '# 이름' }, updatedAt: null })).toEqual(
			{
				value: { profile: null, projects: null, resume: { markdown: '# 이름' }, updatedAt: null },
			}
		);
		expect(parse(SiteView, { profile: null, projects: null, updatedAt: null })).toEqual({
			value: { profile: null, projects: null, updatedAt: null },
		});
	});
});

describe('WidgetDefaultsInput', () => {
	it('사진 위젯의 앨범: 다듬고, 비었거나 null이면 기본값 없음(null)', () => {
		expect(parseWidgetDefaults({ photoAlbum: ' folder:widget01 ' })).toEqual({
			value: { photoAlbum: 'folder:widget01' },
		});
		expect(parseWidgetDefaults({ photoAlbum: '' })).toEqual({ value: { photoAlbum: null } });
		expect(parseWidgetDefaults({ photoAlbum: null })).toEqual({ value: { photoAlbum: null } });
		expect(parseWidgetDefaults({})).toEqual({ value: { photoAlbum: null } });
	});

	it('너무 길거나, 글자가 아니거나, 제어 문자가 있으면 이유를 돌려준다', () => {
		expect(parseWidgetDefaults({ photoAlbum: 'a'.repeat(101) })).toEqual({
			errors: ['사진 위젯의 앨범은 100자까지입니다.'],
		});
		expect(parseWidgetDefaults({ photoAlbum: 3 })).toEqual({ errors: ['사진 위젯의 앨범은 글자여야 합니다.'] });
		expect(parseWidgetDefaults({ photoAlbum: 'a\u0007' })).toEqual({
			errors: ['사진 위젯의 앨범에 쓸 수 없는 글자가 있습니다.'],
		});
		expect(parseWidgetDefaults(null)).toEqual({ errors: ['위젯 기본값을 보내 주세요.'] });
	});

	it('저장해 둔 값 읽기 (틀렸으면 null), 응답에 실린다 (예전 응답에는 없어도 된다)', () => {
		expect(readWidgetDefaults({ photoAlbum: 'qru' })).toEqual({ photoAlbum: 'qru' });
		expect(readWidgetDefaults({ photoAlbum: 3 })).toBeNull();
		expect(readWidgetDefaults(null)).toBeNull();
		expect(parse(SiteView, { profile: null, projects: null, widgets: { photoAlbum: 'qru' }, updatedAt: null })).toEqual(
			{
				value: { profile: null, projects: null, widgets: { photoAlbum: 'qru' }, updatedAt: null },
			}
		);
	});
});
