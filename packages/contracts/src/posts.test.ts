import { describe, expect, it } from 'vitest';
import { parse } from './parse.js';
import { AdminPost, postInput, Revision, ServerPost } from './posts.js';

const TODAY = '2026-09-29';

describe('postInput', () => {
	it('다듬고, 날짜가 없으면 오늘, 모르는 필드는 버린다', () => {
		expect(
			parse(postInput(TODAY), {
				title: ' 새 글 ',
				category: '개발기/MacFolio',
				summary: ' 요약 ',
				body: '# 본문\n\n',
				extra: 1,
			})
		).toEqual({ value: { title: '새 글', date: TODAY, category: '개발기/MacFolio', summary: '요약', body: '# 본문' } });
	});

	it('이유를 칸 순서대로 모두 모은다', () => {
		expect(parse(postInput(TODAY), { title: '', date: '2026-02-30', category: 'a/b/c/d', body: ' ' })).toEqual({
			errors: [
				'제목을 입력해주세요.',
				'날짜가 올바르지 않습니다.',
				'폴더는 3단까지입니다: a/b/c/d',
				'본문을 입력해주세요.',
			],
		});
		expect(parse(postInput(TODAY), { title: 'a', body: 'b' })).toEqual({ errors: ['폴더를 골라주세요.'] });
		expect(parse(postInput(TODAY), null)).toEqual({
			errors: ['제목을 입력해주세요.', '폴더를 골라주세요.', '본문을 입력해주세요.'],
		});
	});

	it('길이를 넘으면 이유', () => {
		const result = parse(postInput(TODAY), {
			title: 'a'.repeat(101),
			category: '기타',
			body: 'b',
			summary: 'c'.repeat(201),
		});
		expect(result).toEqual({
			errors: ['제목은 100자까지 입력할 수 있습니다.', '요약은 200자까지 입력할 수 있습니다.'],
		});
	});

	it('문자열이 아닌 칸은 빈 칸으로 본다 (숫자 날짜 → 오늘)', () => {
		expect(parse(postInput(TODAY), { title: 'a', date: 20260929, category: '기타', body: 'b' })).toEqual({
			value: { title: 'a', date: TODAY, category: '기타', summary: '', body: 'b' },
		});
	});
});

describe('응답 스키마', () => {
	it('관리자 글·공개 글·버전 모양을 받아들인다', () => {
		const content = { title: 't', date: TODAY, category: '기타', summary: '', body: 'b' };
		expect(
			parse(AdminPost, {
				slug: 'x',
				published: content,
				publishedAt: '2026-09-29T00:00:00.000Z',
				draft: null,
				draftUpdatedAt: null,
				deleted: false,
				deletedAt: null,
				revisions: 1,
			})
		).toMatchObject({ value: { slug: 'x', published: content, draft: null } });
		expect(parse(ServerPost, { slug: 'x', ...content, deleted: false })).toMatchObject({ value: { slug: 'x' } });
		expect(
			parse(Revision, {
				id: 1,
				createdAt: '2026-09-29T00:00:00.000Z',
				createdBy: 'me',
				...content,
			})
		).toMatchObject({ value: { id: 1, body: 'b' } });
	});
});
