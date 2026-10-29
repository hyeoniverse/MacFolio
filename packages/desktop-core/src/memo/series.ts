import { compareCreated, type Post } from './posts.js';
import type { PostSlug } from './rules.js';

/**
 * 연재 글: 글의 series 칸(연재 이름)이 같은 글. 저장소 글은 머리말 `series: 트래픽 분석`, 서버 글은 DB의 series 열.
 * 순서는 글의 seriesOrder(머리말 `seriesOrder: 3`)를 따르고, 적지 않은 글은 그 뒤에 날짜 순으로 둔다.
 * 화면의 번호는 이 순서의 위치(1부터)라 순서 번호가 건너뛰어도 1, 2, 3…으로 보인다
 */
export interface Series {
	name: string;
	/** 연재 글 (연재 순서대로) */
	posts: Post[];
	/** 지금 글의 위치 (0부터) */
	index: number;
}

/** 순서 번호가 없는 글은 번호 있는 글 뒤로 */
const orderKey = (post: Post) => post.seriesOrder ?? Number.POSITIVE_INFINITY;

/**
 * 연재 안의 순서: 순서 번호, 그다음(번호가 같거나 둘 다 없으면) 날짜,
 * 같은 날이면 먼저 올린 글(목록의 sortPosts와 같은 기준을 거꾸로), 그다음 제목
 */
const compareInSeries = (a: Post, b: Post) =>
	(orderKey(a) === orderKey(b) ? 0 : orderKey(a) < orderKey(b) ? -1 : 1) ||
	a.date.localeCompare(b.date) ||
	compareCreated(a, b) ||
	a.title.localeCompare(b.title);

/** 글의 연재 이름 (앞뒤 공백을 걷는다). 없으면 null */
const seriesName = (post: Post) => post.series?.trim() || null;

/**
 * 연재 이름 → 연재 글 (연재 순서대로). 같은 이름의 글이 두 편 이상일 때만 연재로 본다
 * (아직 한 편만 쓴 연재에 '1/1' 상자를 보이지 않게)
 */
export function seriesGroups(posts: Post[]): Map<string, Post[]> {
	const groups = new Map<string, Post[]>();
	for (const post of posts) {
		const name = seriesName(post);
		if (!name) continue;
		const members = groups.get(name);
		if (members) members.push(post);
		else groups.set(name, [post]);
	}
	for (const [name, members] of groups) {
		if (members.length < 2) groups.delete(name);
		else members.sort(compareInSeries);
	}
	return groups;
}

/** 이 글이 속한 연재. 연재가 아니면 null */
export function seriesOf(posts: Post[], post: Post): Series | null {
	const name = seriesName(post);
	if (!name) return null;
	const members = seriesGroups(posts).get(name);
	const index = members?.findIndex((item) => item.slug === post.slug) ?? -1;
	return members && index !== -1 ? { name, posts: members, index } : null;
}

/** 글 주소 → 연재 이름과 번호(1부터). 목록 항목의 '연재 · 이름 N' 표시용 */
export function seriesPositions(posts: Post[]): Map<PostSlug, { name: string; number: number }> {
	const positions = new Map<PostSlug, { name: string; number: number }>();
	for (const [name, members] of seriesGroups(posts))
		members.forEach((post, index) => positions.set(post.slug, { name, number: index + 1 }));
	return positions;
}

/** 편집 화면의 연재 고르기 목록: 글에 쓰인 연재 이름 (한 편뿐인 연재도 넣는다), 가나다 순 */
export function seriesNames(posts: Post[]): string[] {
	const names = new Set(posts.map(seriesName).filter((name): name is string => name !== null));
	return [...names].sort((a, b) => a.localeCompare(b, 'ko'));
}
