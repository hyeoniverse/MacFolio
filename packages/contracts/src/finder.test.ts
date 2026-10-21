import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { EMPTY_FINDER_LAYOUT, FinderLayout, finderNameError } from './finder.js';

const folder = (id: string, name: string, parent: string) => ({ id: `folder:${id}`, name, parent });

describe('Finder 구조 규칙', () => {
	it('빈 몸통은 빈 구조', () => {
		expect(parse(FinderLayout, {})).toEqual({ value: EMPTY_FINDER_LAYOUT });
	});

	it('기본 폴더(그림 포함)와 만든 폴더 아래에 폴더·파일을 둔다', () => {
		const input = {
			folders: [
				folder('aaaa', ' 발표 ', 'docs'),
				folder('bbbb', '초안', 'folder:aaaa'),
				folder('cccc', '작업', 'desktop'),
				folder('dddd', '스크린샷', 'pictures'),
			],
			files: { 'file:resume/abc.pdf': 'folder:bbbb', 'file:projects/macfolio/x.png': 'projects/macfolio' },
			aliases: ['docs:이력서', 'projects'],
		};
		const parsed = parse(FinderLayout, input);
		expect('value' in parsed && parsed.value.folders[0].name).toBe('발표');
	});

	it('없는 상위 폴더, 블로그·응용 프로그램·음악, 고리, 겹친 이름은 거절', () => {
		const bad = (value: object) => 'errors' in parse(FinderLayout, value);
		expect(bad({ folders: [folder('aaaa', '가', 'folder:zzzz')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'blog')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'apps')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'music')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'pictures/macfolio')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'projects')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'folder:bbbb'), folder('bbbb', '나', 'folder:aaaa')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', 'A', 'docs'), folder('bbbb', 'a', 'docs')] })).toBe(true);
		expect(bad({ folders: [folder('aaaa', '가', 'docs'), folder('aaaa', '나', 'docs')] })).toBe(true);
		expect(bad({ files: { 'file:a.pdf': 'blog' } })).toBe(true);
		expect(bad({ files: { 'post:hello': 'docs' } })).toBe(true);
		expect(bad({ aliases: ['folder:aaaa'] })).toBe(true);
		expect(bad({ folders: [{ id: 'x', name: '가', parent: 'docs' }] })).toBe(true);
	});

	it('휴지통 안은 이름이 겹쳐도 된다', () => {
		const parsed = parse(FinderLayout, {
			folders: [folder('aaaa', '작업', 'trash'), folder('bbbb', '작업', 'trash'), folder('cccc', '작업', 'desktop')],
		});
		expect('value' in parsed).toBe(true);
	});

	it('이름: 비었거나 / 가 있거나 너무 길면 안 된다', () => {
		expect(finderNameError('  ')).not.toBeNull();
		expect(finderNameError('a/b')).not.toBeNull();
		expect(finderNameError('가'.repeat(61))).not.toBeNull();
		expect(finderNameError('이름 없는 폴더 2')).toBeNull();
	});
});
