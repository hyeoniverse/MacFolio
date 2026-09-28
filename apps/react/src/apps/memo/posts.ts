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

/** 폴더 트리의 한 폴더. category의 '/'로 하위 폴더를 만든다 (예: 개발기/MacFolio) */
export interface FolderNode {
	name: string;
	/** 전체 경로 (예: 개발기/MacFolio) */
	path: string;
	/** 하위 폴더의 글까지 센 수 */
	count: number;
	children: FolderNode[];
}

/** 글이 그 폴더(또는 하위 폴더)에 있는지 */
export function inFolder(post: Post, path: string): boolean {
	return path === ALL_CATEGORY || post.category === path || post.category.startsWith(`${path}/`);
}

/** 글의 category로 폴더 트리를 만든다. 같은 층은 가나다순 */
export function buildFolderTree(posts: Post[]): FolderNode[] {
	const root: FolderNode[] = [];
	for (const post of posts) {
		const parts = post.category
			.split('/')
			.map((part) => part.trim())
			.filter(Boolean);
		let level = root;
		parts.forEach((name, index) => {
			const path = parts.slice(0, index + 1).join('/');
			let node = level.find((n) => n.name === name);
			if (!node) {
				node = { name, path, count: 0, children: [] };
				level.push(node);
			}
			node.count += 1;
			level = node.children;
		});
	}
	const sort = (nodes: FolderNode[]): FolderNode[] =>
		nodes.sort((a, b) => a.name.localeCompare(b.name)).map((node) => ({ ...node, children: sort(node.children) }));
	return sort(root);
}

/** 경로의 마지막 이름 (예: 개발기/MacFolio → MacFolio) */
export const folderName = (path: string) => path.split('/').at(-1) ?? path;

/** 본문의 첫 이미지 주소 (갤러리 미리보기용). 없으면 null */
export function firstImage(body: string): string | null {
	return /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(body)?.[1] ?? null;
}

/** 폴더(하위 폴더 포함)와 검색어로 거른다. 검색은 제목·본문에서 대소문자 구분 없이 */
export function filterPosts(posts: Post[], category: string, query: string): Post[] {
	const q = query.trim().toLowerCase();
	return posts.filter(
		(post) =>
			inFolder(post, category) && (!q || post.title.toLowerCase().includes(q) || post.body.toLowerCase().includes(q))
	);
}

/** "2026. 9. 28." */
export function formatPostDate(date: string): string {
	const [year, month, day] = date.split('-').map(Number);
	return `${year}. ${month}. ${day}.`;
}

/**
 * 본문 이미지 주소를 실제 주소로 바꾼다.
 * - `./images/a.png`, `images/a.png`처럼 글 파일 기준 상대 경로 → 빌드된 파일 주소 (없으면 null)
 * - `/imgs/a.png`(public 폴더), `https://...`, `data:` → 그대로
 * @param images content 폴더 기준 경로(`images/a.png`) → 빌드된 주소
 */
export function resolveImageSrc(src: string | undefined, images: Record<string, string>): string | null {
	if (!src) return null;
	if (/^(https?:|data:|\/)/.test(src)) return src;
	const normalized = src.replace(/^\.\//, '');
	return images[normalized] ?? null;
}
