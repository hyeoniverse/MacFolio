import { describe, expect, it } from 'vitest';
import { MOVED_POSTS, movedPost, movedPostPath } from './movedPosts.js';
import { isPostSlug } from './rules.js';

describe('옮긴 글', () => {
	it('표의 옛 주소와 지금 주소는 글 주소 규칙에 맞고, 옮긴 곳이 다시 옮겨지지 않는다', () => {
		for (const [from, to] of Object.entries(MOVED_POSTS)) {
			const [slug] = to.split('#');
			expect(isPostSlug(from), from).toBe(true);
			expect(isPostSlug(slug), to).toBe(true);
			expect(slug, from).not.toBe(from);
			// A → B → C처럼 이어지면 한 번에 C로 적는다 (301을 두 번 거치지 않게)
			expect(Object.hasOwn(MOVED_POSTS, slug), to).toBe(false);
		}
	});

	it('옮기지 않은 글과 표에 없는 이름은 null이다', () => {
		expect(movedPost('no-such-moved-post')).toBeNull();
		expect(movedPost('constructor')).toBeNull();
		expect(movedPost('__proto__')).toBeNull();
		expect(movedPostPath('/memo/no-such-moved-post')).toBeNull();
		expect(movedPostPath('/safari/x')).toBeNull();
		expect(movedPostPath('/memo/a/b')).toBeNull();
	});

	it('옮긴 글은 지금 주소와 절 id를 준다', () => {
		const [from, to] = Object.entries(MOVED_POSTS).find(([, value]) => value.includes('#')) ?? [];
		if (!from || !to) return;
		const [slug, heading] = to.split('#');
		expect(movedPost(from)).toEqual({ slug, heading });
		expect(movedPostPath(`/memo/${from}`)).toBe(`/memo/${slug}#${heading}`);
		expect(movedPostPath(`/memo/${from}/`)).toBe(`/memo/${slug}#${heading}`);
	});
});
