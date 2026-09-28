// 블로그 글 규칙. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 글은 Markdown 파일이고, 맨 위 머리말(---로 감싼 key: value)에 제목·날짜·카테고리를 적는다.

export interface Post {
	/** 파일 이름에서 온 주소용 이름 (예: cra-to-vite) */
	slug: string;
	title: string;
	/** YYYY-MM-DD */
	date: string;
	category: string;
	/** 목록 미리보기. 없으면 본문 앞부분을 쓴다 */
	summary: string;
	/** Markdown 본문 (머리말 제외) */
	body: string;
}

export const ALL_CATEGORY = '모든 글';

/**
 * 머리말을 읽는다. 지원하는 형식은 한 줄짜리 `key: value`뿐이다.
 * 머리말이 없으면 meta는 비어 있고 본문 전체를 돌려준다.
 */
export function parseFrontmatter(source: string): { meta: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
	if (!match) return { meta: {}, body: source };
	const meta: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const pair = /^([\w-]+)\s*:\s*(.*)$/.exec(line.trim());
		if (pair) meta[pair[1]] = pair[2].replace(/^(['"])(.*)\1$/, '$2');
	}
	return { meta, body: source.slice(match[0].length) };
}

/** Markdown 문법을 걷어 낸 본문 앞부분 (미리보기용) */
export function excerpt(body: string, length = 80): string {
	const text = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^#+\s*/gm, '')
		.replace(/[*_`>|-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

/** 파일 하나를 글로 바꾼다. 제목이나 날짜가 없으면 잘못된 글로 보고 null */
export function toPost(slug: string, source: string): Post | null {
	const { meta, body } = parseFrontmatter(source);
	if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date ?? '')) return null;
	return {
		slug,
		title: meta.title,
		date: meta.date,
		category: meta.category || '기타',
		summary: meta.summary || excerpt(body),
		body: body.trim(),
	};
}

/** 최신 글이 위로. 같은 날이면 제목 순 */
export function sortPosts(posts: Post[]): Post[] {
	return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/** 카테고리 목록: '모든 글'이 맨 앞, 나머지는 가나다순, 글 수 포함 */
export function listCategories(posts: Post[]): { name: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const post of posts) counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
	return [
		{ name: ALL_CATEGORY, count: posts.length },
		...[...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count })),
	];
}

/** 카테고리와 검색어로 거른다. 검색은 제목·본문에서 대소문자 구분 없이 */
export function filterPosts(posts: Post[], category: string, query: string): Post[] {
	const q = query.trim().toLowerCase();
	return posts.filter(
		(post) =>
			(category === ALL_CATEGORY || post.category === category) &&
			(!q || post.title.toLowerCase().includes(q) || post.body.toLowerCase().includes(q))
	);
}

/** "2026. 9. 28." */
export function formatPostDate(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return `${year}. ${month}. ${day}.`;
}
