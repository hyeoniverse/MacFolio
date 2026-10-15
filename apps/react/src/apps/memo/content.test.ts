import { type PostSlug, toPost, validateDraft } from '@macfolio/desktop-core/memo';
import { describe, expect, it } from 'vitest';

const files = import.meta.glob<string>('./content/*.md', { query: '?raw', import: 'default', eager: true });

// 편집 화면에는 요약 칸이 없어서, 저장소 글이 규칙을 어기면 고칠 길 없이 저장·게시가 막힌다
describe('저장소 글', () => {
	it.each(Object.entries(files))('%s는 글쓰기 규칙에 맞다', (path, source) => {
		const post = toPost(path as PostSlug, source);
		expect(post).not.toBeNull();
		const { title, date, category, summary, body } = post!;
		expect(validateDraft({ title, date, category, summary, body })).toEqual({});
	});
});
