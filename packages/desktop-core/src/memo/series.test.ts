import { describe, expect, it } from 'vitest';
import type { Post } from './posts.js';
import type { PostSlug } from './rules.js';
import { seriesGroups, seriesNames, seriesOf, seriesPositions } from './series.js';

const post = (
	slug: string,
	title: string,
	date = '2026-10-01',
	series?: string,
	createdAt?: string,
	seriesOrder?: number
): Post =>
	({
		slug: slug as PostSlug,
		title,
		date,
		category: '개발 기록',
		summary: '',
		body: '',
		...(series !== undefined && { series }),
		...(createdAt && { createdAt }),
		...(seriesOrder && { seriesOrder }),
	}) as Post;

describe('seriesOf', () => {
	const posts = [
		post('c', '셋째', '2026-10-03', '트래픽 분석'),
		post('a', '첫째', '2026-10-01', '트래픽 분석'),
		post('x', '단독 글'),
		post('b', '둘째', '2026-10-02', ' 트래픽 분석 '),
		post('p', '하나', '2026-10-01', '성능 최적화'),
		post('q', '둘', '2026-10-02', '성능 최적화'),
	];

	it('series 칸이 같은 글을 날짜 순으로 모으고 지금 글의 위치를 준다 (이름의 앞뒤 공백은 무시)', () => {
		const series = seriesOf(posts, posts[3]);
		expect(series?.name).toBe('트래픽 분석');
		expect(series?.posts.map((item) => item.slug)).toEqual(['a', 'b', 'c']);
		expect(series?.index).toBe(1);
	});

	it('연재가 아닌 글은 null', () => {
		expect(seriesOf(posts, posts[2])).toBeNull();
	});

	it('같은 이름의 글이 한 편뿐이면 연재로 보지 않는다', () => {
		const alone = post('z', '단독', '2026-10-01', 'TypeScript');
		expect(seriesOf([...posts, alone], alone)).toBeNull();
	});

	it('같은 날이면 먼저 올린 글이 앞, 올린 시각도 같으면 제목 순', () => {
		const sameDay = [
			post('late', '나중', '2026-10-05', '묶음', '2026-10-05T09:00:00Z'),
			post('early', '먼저', '2026-10-05', '묶음', '2026-10-05T01:00:00Z'),
			post('unknown', '가', '2026-10-05', '묶음'),
			post('old', '하', '2026-10-04', '묶음'),
		];
		expect(seriesOf(sameDay, sameDay[0])?.posts.map((item) => item.slug)).toEqual(['old', 'early', 'late', 'unknown']);
	});
});

describe('순서 번호 (seriesOrder)', () => {
	const posts = [
		post('new', '날짜만 최근', '2026-10-09', '묶음'),
		post('three', '셋', '2026-10-01', '묶음', undefined, 3),
		post('one', '하나', '2026-10-05', '묶음', undefined, 1),
		post('old', '날짜만 오래', '2026-09-01', '묶음'),
	];

	it('번호 순으로 두고, 번호 없는 글은 그 뒤에 날짜 순. 화면 번호는 위치라 건너뛴 번호도 1, 2, …', () => {
		expect(seriesOf(posts, posts[0])?.posts.map((item) => item.slug)).toEqual(['one', 'three', 'old', 'new']);
		expect(seriesPositions(posts).get('three' as PostSlug)).toEqual({ name: '묶음', number: 2 });
	});
});

describe('seriesGroups · seriesPositions · seriesNames', () => {
	const posts = [
		post('b', '둘째', '2026-10-02', '트래픽 분석'),
		post('a', '첫째', '2026-10-01', '트래픽 분석'),
		post('s', '한 편', '2026-10-01', '가계부'),
		post('x', '단독 글'),
		post('e', '빈 이름', '2026-10-01', '  '),
	];

	it('두 편 이상인 연재만 묶는다', () => {
		expect([...seriesGroups(posts).keys()]).toEqual(['트래픽 분석']);
	});

	it('글마다 연재 이름과 1부터의 번호', () => {
		const positions = seriesPositions(posts);
		expect(positions.get('a' as PostSlug)).toEqual({ name: '트래픽 분석', number: 1 });
		expect(positions.get('b' as PostSlug)).toEqual({ name: '트래픽 분석', number: 2 });
		expect(positions.has('s' as PostSlug)).toBe(false);
	});

	it('편집 화면의 이름 목록은 한 편뿐인 연재도 넣고 가나다 순, 빈 이름은 뺀다', () => {
		expect(seriesNames(posts)).toEqual(['가계부', '트래픽 분석']);
	});
});
