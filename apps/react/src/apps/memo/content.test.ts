import { MOVED_POSTS, type PostSlug, toPost, validateDraft } from '@macfolio/desktop-core/memo';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { REMARK_PLUGINS } from './markdownPlugins';

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

const sourceOf = (slug: string) => files[`./content/${slug}.md`];

/** 글을 그린 HTML의 id (제목·각주·접기 블록. 짧은 이름으로도 찾으므로 `user-content-`를 뗀 이름도 넣는다) */
const idCache = new Map<string, Set<string>>();
function idsOf(slug: string): Set<string> {
	let ids = idCache.get(slug);
	if (!ids) {
		const html = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: REMARK_PLUGINS }, sourceOf(slug)));
		const raw = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
		ids = new Set([...raw, ...raw.map((id) => id.replace(/^user-content-/, ''))]);
		idCache.set(slug, ids);
	}
	return ids;
}

// 편집 화면에는 요약 칸이 없어서, 저장소 글이 규칙을 어기면 고칠 길 없이 저장·게시가 막힌다
describe('저장소 글', () => {
	it.each(Object.entries(files))('%s는 글쓰기 규칙에 맞다', (path, source) => {
		const post = toPost(path as PostSlug, source);
		expect(post).not.toBeNull();
		const { title, date, category, summary, body } = post!;
		// 임시 저장 글(published: false)은 본문이 비어 있어도 된다 (서버의 임시 저장처럼 게시할 때 검사한다)
		const errors = validateDraft({ title, date, category, summary, body });
		if (post!.repoDraft) delete errors.body;
		expect(errors).toEqual({});
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

	it.each(Object.entries(files))(
		'%s의 다른 글 링크(사이트 전체 주소·#절 포함)가 있는 글과 절을 가리킨다',
		(_path, source) => {
			const links = proseLines(source).flatMap((line) => [
				...line.matchAll(/\]\((?:https:\/\/macfolio\.hyeoniverse\.com)?\/memo\/([\w-]+)(?:#([^)\s]+))?[)\s]/g),
			]);
			const broken = links
				.filter(([, slug, hash]) => !slugs.has(slug) || (hash && !idsOf(slug).has(decodeURIComponent(hash))))
				.map(([link]) => link);
			expect(broken).toEqual([]);
		}
	);

	it.each(Object.entries(files))('%s의 글 안 링크(#주소)는 그 글의 제목·각주·접기 블록을 가리킨다', (path, source) => {
		const html = renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: REMARK_PLUGINS }, source));
		const ids = idsOf(path.replace(/^\.\/content\//, '').replace(/\.md$/, ''));
		const missing = [...html.matchAll(/href="#([^"]+)"/g)]
			.map((match) => decodeURIComponent(match[1]))
			.filter((id) => !ids.has(id));
		expect(missing).toEqual([]);
	});

	it('합친 글의 옛 주소는 저장소에 없고, 옮긴 곳은 있는 글과 절이다', () => {
		for (const [from, to] of Object.entries(MOVED_POSTS)) {
			const [slug, heading] = to.split('#');
			expect(slugs.has(from), from).toBe(false);
			expect(slugs.has(slug), to).toBe(true);
			if (heading) expect(idsOf(slug).has(heading), to).toBe(true);
		}
	});
});
