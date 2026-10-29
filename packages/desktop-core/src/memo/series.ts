import type { Post } from './posts.js';

/**
 * 연재 글: 제목이 "시리즈 이름 번호 - 제목" 형식이다 (예: "트래픽 분석 3 - …", "리팩터링 2단계 - …").
 * 머리말을 따로 두지 않고 제목에서 읽으므로, 편집기로 쓴 서버 글도 제목만 맞추면 연재에 들어간다
 */
const SERIES_TITLE = /^(.+?) (\d+)(단계)? - (.+)$/;

export interface SeriesTitle {
	/** 시리즈 이름 (예: 트래픽 분석) */
	name: string;
	/** 순서 번호 */
	order: number;
	/** 번호 표기 (예: 3, 2단계) */
	label: string;
	/** 연재 표기 뒤의 제목 */
	rest: string;
}

/** 제목에서 연재 이름과 번호를 읽는다. 형식이 아니면 null */
export function parseSeriesTitle(title: string): SeriesTitle | null {
	const match = SERIES_TITLE.exec(title.trim());
	if (!match) return null;
	return { name: match[1], order: Number(match[2]), label: match[2] + (match[3] ?? ''), rest: match[4] };
}

export interface Series {
	name: string;
	/** 연재 글 (번호 순) */
	posts: Post[];
	/** 지금 글의 위치 (0부터) */
	index: number;
}

/**
 * 이 글이 속한 연재. 같은 이름의 글이 두 편 이상일 때만 연재로 본다
 * (제목에 우연히 "이름 숫자 - "가 들어간 단독 글을 연재로 보이지 않게).
 * 번호가 같으면 날짜, 그다음 제목 순서
 */
export function seriesOf(posts: Post[], post: Post): Series | null {
	const own = parseSeriesTitle(post.title);
	if (!own) return null;
	const members = posts
		.map((item) => ({ item, series: parseSeriesTitle(item.title) }))
		.filter(({ series }) => series?.name === own.name)
		.sort(
			(a, b) =>
				a.series!.order - b.series!.order ||
				a.item.date.localeCompare(b.item.date) ||
				a.item.title.localeCompare(b.item.title)
		)
		.map(({ item }) => item);
	if (members.length < 2) return null;
	const index = members.findIndex((item) => item.slug === post.slug);
	if (index === -1) return null;
	return { name: own.name, posts: members, index };
}
