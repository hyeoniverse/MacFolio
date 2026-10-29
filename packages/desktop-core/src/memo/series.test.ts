import { describe, expect, it } from 'vitest';
import type { Post, PostSlug } from './posts.js';
import { parseSeriesTitle, seriesOf } from './series.js';

const post = (slug: string, title: string, date = '2026-10-01'): Post =>
	({ slug: slug as PostSlug, title, date, category: '개발 기록', body: '' }) as Post;

describe('parseSeriesTitle', () => {
	it('"이름 번호 - 제목"에서 이름·번호·나머지를 읽는다', () => {
		expect(parseSeriesTitle('트래픽 분석 3 - SVG 그래프')).toEqual({
			name: '트래픽 분석',
			order: 3,
			label: '3',
			rest: 'SVG 그래프',
		});
	});

	it('"N단계" 표기도 읽는다', () => {
		expect(parseSeriesTitle('리팩터링 2단계 - 모듈 구조')).toMatchObject({
			name: '리팩터링',
			order: 2,
			label: '2단계',
		});
	});

	it('형식이 아니면 null (날짜로 시작하는 회고 제목 포함)', () => {
		expect(parseSeriesTitle('callback ref로 ResizeObserver 다시 연결하기')).toBeNull();
		expect(parseSeriesTitle('10월 4일 - 프로젝트 페이지만 하루 종일')).toBeNull();
		expect(parseSeriesTitle('2024년 10월 13일 - 창을 맨 앞으로')).toBeNull();
	});
});

describe('seriesOf', () => {
	const posts = [
		post('c', '트래픽 분석 3 - 셋째', '2026-10-03'),
		post('a', '트래픽 분석 1 - 첫째', '2026-10-01'),
		post('x', '단독 글'),
		post('b', '트래픽 분석 2 - 둘째', '2026-10-02'),
		post('p', '성능 최적화 1 - 다른 연재'),
		post('q', '성능 최적화 2 - 다른 연재'),
	];

	it('같은 이름의 글을 번호 순으로 모으고 지금 글의 위치를 준다', () => {
		const series = seriesOf(posts, posts[3]);
		expect(series?.name).toBe('트래픽 분석');
		expect(series?.posts.map((item) => item.slug)).toEqual(['a', 'b', 'c']);
		expect(series?.index).toBe(1);
	});

	it('연재가 아닌 글은 null', () => {
		expect(seriesOf(posts, posts[2])).toBeNull();
	});

	it('같은 이름의 글이 한 편뿐이면 연재로 보지 않는다', () => {
		const alone = post('z', 'TypeScript 7 - 단독');
		expect(seriesOf([...posts, alone], alone)).toBeNull();
	});
});
