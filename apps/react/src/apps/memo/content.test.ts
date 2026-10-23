import { type PostSlug, toPost, validateDraft } from '@macfolio/desktop-core/memo';
import { describe, expect, it } from 'vitest';

const files = import.meta.glob<string>('./content/*.md', { query: '?raw', import: 'default', eager: true });
const slugs = new Set(Object.keys(files).map((path) => path.replace(/^\.\/content\//, '').replace(/\.md$/, '')));

/** 코드 블록과 인라인 코드를 뺀 본문 줄 (코드 안의 예시는 링크가 아니다) */
function proseLines(source: string): string[] {
	let fence = false;
	return source.split('\n').flatMap((line) => {
		if (/^\s*(```|~~~)/.test(line)) {
			fence = !fence;
			return [];
		}
		return fence ? [] : [line.replace(/`[^`]*`/g, '')];
	});
}

// 편집 화면에는 요약 칸이 없어서, 저장소 글이 규칙을 어기면 고칠 길 없이 저장·게시가 막힌다
describe('저장소 글', () => {
	it.each(Object.entries(files))('%s는 글쓰기 규칙에 맞다', (path, source) => {
		const post = toPost(path as PostSlug, source);
		expect(post).not.toBeNull();
		const { title, date, category, summary, body } = post!;
		expect(validateDraft({ title, date, category, summary, body })).toEqual({});
	});

	it.each(Object.entries(files))('%s의 글 링크는 누를 수 있고 있는 글을 가리킨다', (_path, source) => {
		const lines = proseLines(source);
		// [글](/memo/주소)의 주소가 저장소 글에 있다 (서버 글은 저장소 글 링크로 쓰지 않는다)
		const targets = lines.flatMap((line) => [...line.matchAll(/\]\(\/memo\/([\w-]+)/g)].map((match) => match[1]));
		expect(targets.filter((slug) => !slugs.has(slug))).toEqual([]);
		// 링크 문법 없이 주소만 적으면 누를 수 없다
		const bare = lines.flatMap((line) => line.replace(/\]\([^)]*\)/g, '').match(/(?<![\w/.([])\/memo\/[\w-]+/g) ?? []);
		expect(bare).toEqual([]);
		// [^각주](…)는 각주가 아니라 '^각주'라는 링크가 된다. 괄호 설명은 각주 앞에 둔다
		expect(lines.flatMap((line) => line.match(/\[\^[^\]]+\]\(/g) ?? [])).toEqual([]);
	});
});
