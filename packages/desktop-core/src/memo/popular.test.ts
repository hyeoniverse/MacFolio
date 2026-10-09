import { describe, expect, it } from 'vitest';
import type { Post } from './posts.js';
import { popularityScore, popularPosts, statsOf } from './popular.js';

const post = (slug: string, date = '2026-10-01') =>
	({ slug, title: slug, date, category: '기타', summary: '', body: '' }) as Post;

describe('인기글', () => {
	it('점수: 조회 1, 좋아요 3, 댓글 5', () => {
		expect(popularityScore({ views: 10, likes: 2, comments: 1 })).toBe(21);
		expect(statsOf({ a: { views: 3 } }, 'a')).toEqual({ views: 3, comments: 0, likes: 0 });
		expect(statsOf({}, 'b')).toEqual({ views: 0, comments: 0, likes: 0 });
	});

	it('점수 순서로, 반응이 없는 글은 빼고', () => {
		const posts = [post('a'), post('b'), post('c'), post('quiet')];
		const stats = { a: { views: 10 }, b: { views: 2, comments: 2 }, c: { likes: 5 } };
		// a 10, b 12, c 15
		expect(popularPosts(posts, stats).map((entry) => entry.slug)).toEqual(['c', 'b', 'a']);
	});

	it('점수가 같으면 좋아요 → 댓글 → 조회 → 최근 글', () => {
		const posts = [post('views'), post('comment'), post('like'), post('old', '2026-01-01'), post('new', '2026-09-01')];
		const stats = {
			views: { views: 15 },
			comment: { comments: 3 },
			like: { likes: 5 },
			old: { views: 1 },
			new: { views: 1 },
		};
		expect(popularPosts(posts, stats).map((entry) => entry.slug)).toEqual(['like', 'comment', 'views', 'new', 'old']);
	});

	it('위에서 10개까지', () => {
		const posts = Array.from({ length: 15 }, (_, index) => post(`p${index}`));
		const stats = Object.fromEntries(posts.map((entry, index) => [entry.slug, { views: index + 1 }]));
		const top = popularPosts(posts, stats);
		expect(top).toHaveLength(10);
		expect(top[0].slug).toBe('p14');
		expect(popularPosts(posts, stats, 3).map((entry) => entry.slug)).toEqual(['p14', 'p13', 'p12']);
	});
});
