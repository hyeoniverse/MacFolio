import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { CAPTION_MAX, CaptionInput, MAX_SHOWCASE, SecurityUpdate, ShowcaseInput } from './settings.js';

describe('사진 캡션', () => {
	it('캡션을 다듬고, 비면 null', () => {
		expect(parse(CaptionInput, { src: '/a.jpg', caption: ' 첫 화면\n' })).toEqual({
			value: { src: '/a.jpg', caption: '첫 화면' },
		});
		expect(parse(CaptionInput, { src: '/a.jpg', caption: '  ' })).toEqual({ value: { src: '/a.jpg', caption: null } });
	});

	it('주소·길이·몸통이 틀리면 이유를 알린다', () => {
		expect(parse(CaptionInput, { src: '//evil.com/a.jpg', caption: '' })).toEqual({
			errors: ['사진 주소가 잘못되었습니다.'],
		});
		expect(parse(CaptionInput, { src: '/a.jpg', caption: '가'.repeat(CAPTION_MAX + 1) })).toEqual({
			errors: [`캡션은 ${CAPTION_MAX}자까지 쓸 수 있습니다.`],
		});
		expect(parse(CaptionInput, null)).toEqual({ errors: ['본문이 비었습니다.'] });
	});
});

describe('사람 확인 설정', () => {
	it('켜고 끌 곳만 받는다', () => {
		expect(parse(SecurityUpdate, { comment: true })).toEqual({ value: { comment: true } });
		expect(parse(SecurityUpdate, { likes: true })).toEqual({ errors: ['알 수 없는 설정입니다: likes'] });
		expect(parse(SecurityUpdate, {})).toEqual({ errors: ['바꿀 설정이 없습니다.'] });
		expect(parse(SecurityUpdate, [])).toEqual({ errors: ['설정을 보내 주세요.'] });
	});
});

describe('GitHub 앱 저장소', () => {
	it('owner/이름 목록을 6개까지, 같은 저장소는 한 번', () => {
		expect(parse(ShowcaseInput, { repos: ['a/one'] })).toEqual({ value: { repos: ['a/one'] } });
		expect(parse(ShowcaseInput, { repos: ['nope'] })).toEqual({ errors: ['저장소 이름이 올바르지 않습니다: nope'] });
		expect(parse(ShowcaseInput, { repos: ['a/Repo', 'A/repo'] })).toEqual({
			errors: ['같은 저장소가 두 번 있습니다: A/repo'],
		});
		const many = Array.from({ length: MAX_SHOWCASE + 1 }, (_, index) => `a/r${index}`);
		expect(parse(ShowcaseInput, { repos: many })).toEqual({
			errors: [`저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`],
		});
		expect(parse(ShowcaseInput, {})).toEqual({ errors: ['repos는 "owner/이름" 목록이어야 합니다.'] });
	});
});
