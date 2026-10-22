import { describe, expect, it } from 'vitest';
import {
	handAngles,
	mergeRecentPosts,
	monthGrid,
	popularOf,
	randomOf,
	seededRandom,
	seoulDate,
	shortDate,
	streakOf,
} from './model';

describe('위젯 값', () => {
	it('서울 기준 날짜와 시각 (UTC 자정 넘어도 서울 날짜)', () => {
		expect(seoulDate(new Date('2026-10-21T15:30:05Z'))).toEqual({
			year: 2026,
			month: 10,
			day: 22,
			weekday: 4,
			hour: 0,
			minute: 30,
			second: 5,
		});
	});

	it('달력: 일요일부터 7칸씩, 이달 밖은 빈 칸', () => {
		const october = monthGrid(2026, 10);
		expect(october[0]).toEqual([null, null, null, null, 1, 2, 3]);
		expect(october.at(-1)).toEqual([25, 26, 27, 28, 29, 30, 31]);
		expect(monthGrid(2026, 2)).toHaveLength(4);
		expect(monthGrid(2026, 8)).toHaveLength(6);
	});

	it('시계 바늘 각도', () => {
		expect(handAngles({ hour: 15, minute: 30, second: 0 })).toEqual({ hour: 105, minute: 180, second: 0 });
		expect(handAngles({ hour: 0, minute: 0, second: 45 })).toEqual({ hour: 0, minute: 4.5, second: 270 });
	});

	it('글 날짜를 짧게', () => {
		const today = { year: 2026, month: 10, day: 21 };
		expect(shortDate('2026-10-21', today)).toBe('오늘');
		expect(shortDate('2026-10-20', today)).toBe('어제');
		expect(shortDate('2026-10-03', today)).toBe('10월 3일');
		expect(shortDate('2025-12-31', today)).toBe('2025. 12. 31.');
	});

	it('최근 글: 서버 글이 같은 주소를 대신하고, 지운 글은 가리고, 새 글은 날짜 순으로 들어간다', () => {
		const post = (slug: string, date: string, title = slug) => ({ slug, title, date, category: '개발기' });
		const repo = [post('c', '2026-10-20'), post('b', '2026-10-19'), post('a', '2026-10-18')];
		const merged = mergeRecentPosts(
			repo,
			[
				{ ...post('new', '2026-10-21'), deleted: false },
				{ ...post('b', '2026-10-19', '고친 제목'), deleted: false },
				{ ...post('c', '', ''), deleted: true },
			],
			3
		);
		expect(merged.map((item) => item.slug)).toEqual(['new', 'b', 'a']);
		expect(merged[1].title).toBe('고친 제목');
		expect(mergeRecentPosts(repo, [], 2).map((item) => item.slug)).toEqual(['c', 'b']);
	});

	it('연속 기여 일수: 최근 날부터, 오늘이 아직 0이면 어제부터 센다', () => {
		const days = (...counts: number[]) => counts.map((count) => ({ count }));
		expect(streakOf(days(1, 0, 2, 3, 1))).toBe(3);
		expect(streakOf(days(1, 2, 3, 0))).toBe(3);
		expect(streakOf(days(1, 0, 0))).toBe(0);
		expect(streakOf([])).toBe(0);
	});

	it('메모 위젯의 인기글: 메모 앱과 같은 점수(조회 1, 좋아요 3, 댓글 5)로, 반응 없는 글은 빼고', () => {
		const posts = ['a', 'b', 'c', 'd'].map((slug, i) => ({
			slug,
			title: slug,
			date: `2026-10-0${i + 1}`,
			category: '',
		}));
		const stats = { a: { views: 10 }, b: { likes: 2, comments: 1 }, c: { views: 3 } };
		// a 10점, b 3×2+5×1=11점, c 3점, d 0점
		expect(popularOf(posts, stats, 3).map((post) => post.slug)).toEqual(['b', 'a', 'c']);
		expect(popularOf(posts, {}, 3)).toEqual([]);
	});

	it('메모 위젯의 랜덤: 겹치지 않게 고르고, 같은 seed면 같은 글', () => {
		const posts = Array.from({ length: 10 }, (_, i) => ({
			slug: `p${i}`,
			title: '',
			date: '2026-10-01',
			category: '',
		}));
		const first = randomOf(posts, 3, seededRandom(0.42)).map((post) => post.slug);
		expect(new Set(first).size).toBe(3);
		expect(randomOf(posts, 3, seededRandom(0.42)).map((post) => post.slug)).toEqual(first);
		expect(randomOf(posts.slice(0, 2), 3, seededRandom(0.1))).toHaveLength(2);
	});
});
