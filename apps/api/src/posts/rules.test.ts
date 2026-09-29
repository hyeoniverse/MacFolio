import { describe, expect, it } from 'vitest';
import { newSlug, parsePostInput, SLUG } from './rules.js';

const TODAY = '2026-09-29';

describe('parsePostInput', () => {
	it('다듬고, 날짜가 없으면 오늘', () => {
		expect(
			parsePostInput(
				{ title: ' 새 글 ', category: '개발기/MacFolio', summary: ' 요약 ', body: '# 본문\n\n', extra: 1 },
				TODAY
			)
		).toEqual({ value: { title: '새 글', date: TODAY, category: '개발기/MacFolio', summary: '요약', body: '# 본문' } });
	});

	it('이유를 모두 모은다', () => {
		expect(parsePostInput({ title: '', date: '2026-02-30', category: 'a/b/c/d', body: ' ' }, TODAY)).toEqual({
			errors: [
				'제목을 입력해주세요.',
				'날짜가 올바르지 않습니다.',
				'폴더는 3단까지입니다: a/b/c/d',
				'본문을 입력해주세요.',
			],
		});
		expect(parsePostInput({ title: 'a', body: 'b' }, TODAY)).toEqual({ errors: ['폴더를 골라주세요.'] });
		expect(
			'errors' in
				parsePostInput({ title: 'a'.repeat(101), category: '기타', body: 'b', summary: 'c'.repeat(201) }, TODAY)
		).toBe(true);
	});
});

describe('newSlug', () => {
	it('날짜로 시작하고 주소 규칙에 맞으며 매번 다르다', () => {
		const slug = newSlug(TODAY);
		expect(slug).toMatch(/^2026-09-29-[0-9a-f]{6}$/);
		expect(SLUG.test(slug)).toBe(true);
		expect(newSlug(TODAY)).not.toBe(slug);
	});
});
