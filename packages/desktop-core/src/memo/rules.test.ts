import { describe, expect, it } from 'vitest';
import { EMPTY_ORGANIZATION, folderPathError, parseOrganization } from './rules.js';

describe('folderPathError', () => {
	it('3단까지, 이름은 1~30자, 앞뒤 공백 없이', () => {
		expect(folderPathError('개발기/MacFolio/초안')).toBeNull();
		expect(folderPathError('a/b/c/d')).toMatch(/3단/);
		expect(folderPathError('개발기//초안')).toMatch(/비었/);
		expect(folderPathError(' 개발기')).toMatch(/공백/);
		expect(folderPathError('가'.repeat(31))).toMatch(/30자/);
		expect(folderPathError(3)).toMatch(/문자열/);
	});
});

describe('parseOrganization', () => {
	const valid = {
		folders: ['읽을거리', '개발기/보관'],
		posts: { 'cra-to-vite': '읽을거리' },
		moves: [{ from: '개발기/MacFolio', to: '읽을거리/MacFolio', extra: 1 }],
		pins: { 'read-only-memo': true },
		unknown: 'x',
	};

	it('규칙에 맞으면 정리 내용으로 (모르는 필드는 버린다)', () => {
		expect(parseOrganization(valid)).toEqual({
			value: {
				folders: ['읽을거리', '개발기/보관'],
				posts: { 'cra-to-vite': '읽을거리' },
				moves: [{ from: '개발기/MacFolio', to: '읽을거리/MacFolio' }],
				pins: { 'read-only-memo': true },
				locks: {},
				order: [],
			},
		});
		expect(parseOrganization(EMPTY_ORGANIZATION)).toEqual({ value: EMPTY_ORGANIZATION });
	});

	it('규칙을 어기면 이유를 모두 모은다', () => {
		const result = parseOrganization({
			folders: ['a/b/c/d', 'a/b/c/d'],
			posts: { '../etc': '읽을거리' },
			moves: [{ from: 'x' }],
			pins: { 'cra-to-vite': 'yes' },
		});
		expect('errors' in result && result.errors).toEqual([
			'폴더는 3단까지입니다: a/b/c/d',
			'폴더는 3단까지입니다: a/b/c/d',
			'같은 폴더가 두 번 있습니다',
			'글 주소가 올바르지 않습니다: ../etc',
			'폴더 경로는 문자열이어야 합니다',
			'고정 여부는 true/false여야 합니다: cra-to-vite',
		]);
	});

	it('잠금: 없으면 빈 값, 있으면 slug → true/false', () => {
		const { locks: _, ...old } = EMPTY_ORGANIZATION;
		expect(parseOrganization(old)).toEqual({ value: EMPTY_ORGANIZATION });
		expect(parseOrganization({ ...EMPTY_ORGANIZATION, locks: { 'cra-to-vite': true } })).toEqual({
			value: { ...EMPTY_ORGANIZATION, locks: { 'cra-to-vite': true } },
		});
		expect(parseOrganization({ ...EMPTY_ORGANIZATION, locks: { 'cra-to-vite': 1 } })).toEqual({
			errors: ['잠금 여부는 true/false여야 합니다: cra-to-vite'],
		});
	});

	it('폴더 순서: 없으면 빈 값, 있으면 폴더 경로 배열 (겹치거나 규칙에 어긋나면 거절)', () => {
		const { order: _, ...old } = EMPTY_ORGANIZATION;
		expect(parseOrganization(old)).toEqual({ value: EMPTY_ORGANIZATION });
		expect(parseOrganization({ ...EMPTY_ORGANIZATION, order: ['회고', '개발기/MacFolio'] })).toEqual({
			value: { ...EMPTY_ORGANIZATION, order: ['회고', '개발기/MacFolio'] },
		});
		expect(parseOrganization({ ...EMPTY_ORGANIZATION, order: ['회고', '회고', 'a/b/c/d'] })).toEqual({
			errors: ['폴더는 3단까지입니다: a/b/c/d', '폴더 순서에 같은 폴더가 두 번 있습니다'],
		});
	});

	it('모양이 다르면 거절', () => {
		expect(parseOrganization(null)).toEqual({ errors: ['정리 내용은 객체여야 합니다'] });
		expect('errors' in parseOrganization({ folders: 'x', posts: [], moves: {}, pins: 1 })).toBe(true);
	});

	it('항목 수를 넘으면 거절', () => {
		const folders = Array.from({ length: 201 }, (_, i) => `폴더${i}`);
		const result = parseOrganization({ ...EMPTY_ORGANIZATION, folders });
		expect('errors' in result && result.errors).toContain('폴더는 200개까지입니다');
	});
});
