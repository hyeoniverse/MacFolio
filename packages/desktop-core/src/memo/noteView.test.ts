import { describe, expect, it } from 'vitest';
import { DEFAULT_ARRANGEMENT } from './arrange.js';
import { filterFor, folderPaths, listPosts, postsInView, selectPost } from './noteView.js';
import { ALL_CATEGORY, POPULAR_VIEW, TAG_VIEW, type FolderNode, type Post } from './posts.js';
import { EMPTY_TAG_SELECTION } from './tagFilter.js';
import { type PostSlug, type FolderPath } from './rules.js';

const post = (slug: string, date: string, extra: Partial<Post> = {}): Post => ({
	slug: slug as PostSlug,
	title: slug,
	date,
	category: '개발기',
	summary: '',
	body: '',
	...extra,
});

const a = post('a', '2026-10-01', { body: '#리액트' });
const b = post('b', '2026-10-03', { category: '일기' });
const c = post('c', '2026-10-02', { pinned: true });

describe('folderPaths', () => {
	it('하위 폴더까지 모든 경로', () => {
		const tree: FolderNode[] = [
			{
				name: '개발기',
				path: '개발기' as FolderPath,
				count: 0,
				children: [{ name: 'A', path: '개발기/A' as FolderPath, count: 0, children: [] }],
			},
			{ name: '일기', path: '일기' as FolderPath, count: 0, children: [] },
		];
		expect(folderPaths(tree)).toEqual(['개발기', '개발기/A', '일기']);
	});
});

describe('postsInView', () => {
	it('폴더면 그 폴더의 글, 태그 보기면 고른 태그에 맞는 글', () => {
		expect(postsInView([a, b, c], '일기', EMPTY_TAG_SELECTION)).toEqual([b]);
		const selection = { ...EMPTY_TAG_SELECTION, tags: { 리액트: 'include' as const } };
		expect(postsInView([a, b, c], TAG_VIEW, selection)).toEqual([a]);
	});
});

describe('listPosts / filterFor', () => {
	const base = { trash: [], inTrash: false, query: '', filter: null, editing: false, arrangement: DEFAULT_ARRANGEMENT };

	it('보기 설정대로 정렬한다 (기본: 최신 글이 위)', () => {
		expect(listPosts({ ...base, inView: [a, b, c] }).map((p) => p.slug)).toEqual(['b', 'c', 'a']);
	});

	it('최근 삭제된 항목은 지운 글에서 검색어로만 거른다', () => {
		expect(listPosts({ ...base, inView: [a], trash: [b, c], inTrash: true, query: 'c' })).toEqual([c]);
	});

	it('임시 저장·예약 조건은 관리자에게만', () => {
		expect(filterFor('draft', false)).toBeNull();
		expect(filterFor('draft', true)).toBe('draft');
		expect(filterFor('pinned', false)).toBe('pinned');
	});
});

describe('selectPost', () => {
	it('고른 글이 목록에 있으면 그 글, 없으면 고정된 글 먼저', () => {
		expect(selectPost([a, b, c], 'a').selected).toBe(a);
		expect(selectPost([a, b, c], 'gone').selected).toBe(c);
		expect(selectPost([a, b], null).selected).toBe(a);
		expect(selectPost([], 'a').selected).toBeNull();
	});
});

it('ALL_CATEGORY는 모든 폴더의 글', () => {
	expect(postsInView([a, b], ALL_CATEGORY, EMPTY_TAG_SELECTION)).toHaveLength(2);
});

describe('인기글 보기', () => {
	const posts = [post('a', '2026-10-01', { pinned: true }), post('b', '2026-10-01'), post('c', '2026-10-01')];
	const stats = { a: { views: 1 }, b: { views: 9 }, c: { likes: 1 } };

	it('반응 순서로, 정렬·고정과 상관없이 순위 그대로', () => {
		const inView = postsInView(posts, POPULAR_VIEW, EMPTY_TAG_SELECTION, stats);
		expect(inView.map((entry) => entry.slug)).toEqual(['b', 'c', 'a']);
		const visible = listPosts({
			inView,
			trash: [],
			inTrash: false,
			query: '',
			filter: null,
			editing: false,
			arrangement: DEFAULT_ARRANGEMENT,
			ranked: true,
		});
		expect(visible.map((entry) => entry.slug)).toEqual(['b', 'c', 'a']);
		const { pinned, others } = selectPost(visible, null, true);
		expect(pinned).toEqual([]);
		expect(others.map((entry) => entry.slug)).toEqual(['b', 'c', 'a']);
	});

	it('검색어로 거르면 순위는 그대로', () => {
		const inView = postsInView(posts, POPULAR_VIEW, EMPTY_TAG_SELECTION, stats);
		const visible = listPosts({
			inView,
			trash: [],
			inTrash: false,
			query: 'a',
			filter: null,
			editing: false,
			arrangement: DEFAULT_ARRANGEMENT,
			ranked: true,
		});
		expect(visible.map((entry) => entry.slug)).toEqual(['a']);
	});
});
