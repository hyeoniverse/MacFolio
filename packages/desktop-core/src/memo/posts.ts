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
	/** 목록 맨 위에 고정 (머리말 pinned: true, 방문자가 바꿀 수 있다) */
	pinned?: boolean;
	/** 잠김 (관리자가 잠그면 고치거나 지울 수 없다, organize.ts의 locks) */
	locked?: boolean;
	/** 관리자에게만: 게시 상태 */
	status?: PostStatus;
	/** 관리자에게만: '최근 삭제된 항목'의 글이면 지운 때 (ISO) */
	deletedAt?: string;
}

/** 관리자가 보는 게시 상태 */
export interface PostStatus {
	/** 게시한 적 없는 글 (임시 저장만 있다) */
	draftOnly: boolean;
	/** 게시한 글에 게시하지 않은 편집이 있다 */
	changed: boolean;
	/** 게시했지만 날짜가 아직 안 됐다 (예약): 그 날짜 */
	scheduled: string | null;
}

export const ALL_CATEGORY = '모든 글';
/** '최근 삭제된 항목' (폴더 목록의 맨 아래). 폴더 이름과 겹치지 않게 경로에 쓸 수 없는 글자로 시작한다 */
export const RECENTLY_DELETED = '\u0000recently-deleted';
/** 지운 글을 최근 삭제된 항목에 두는 날 수 (서버의 RECENTLY_DELETED_DAYS와 같다) */
export const RECENTLY_DELETED_DAYS = 30;
/** 태그로 보기: 경로 자리에 둔다 (고른 태그는 tagFilter.ts). 폴더 이름과 겹치지 않게 경로에 쓸 수 없는 글자로 시작한다 */
export const TAG_VIEW = '\u0000tags';
/** 인기글 (조회수·댓글·좋아요로 고른 10개, popular.ts). 폴더 이름과 겹치지 않게 경로에 쓸 수 없는 글자로 시작한다 */
export const POPULAR_VIEW = '\u0000popular';

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
		// 제목 표시(# 뒤에 공백)만 걷는다. 줄 처음의 #태그는 남긴다
		.replace(/^#{1,6}(\s+|$)/gm, '')
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
		...(meta.pinned === 'true' && { pinned: true }),
	};
}

/** API의 글 (관리자가 쓰거나 고친 글, 또는 저장소 글을 지운 표시) */
export interface ServerPost {
	slug: string;
	title: string;
	date: string;
	category: string;
	summary: string;
	body: string;
	deleted: boolean;
}

/**
 * 저장소의 Markdown 글 위에 서버의 글을 겹친다.
 * 같은 주소면 서버 글이 대신하고(고정 여부는 저장소 글을 따른다), 지운 표시면 목록에서 뺀다. 서버에만 있는 글은 더한다.
 */
export function mergeServerPosts(posts: Post[], server: ServerPost[]): Post[] {
	const bySlug = new Map(posts.map((post) => [post.slug, post]));
	for (const item of server) {
		if (item.deleted) {
			bySlug.delete(item.slug);
			continue;
		}
		const original = bySlug.get(item.slug);
		bySlug.set(item.slug, {
			slug: item.slug,
			title: item.title,
			date: item.date,
			category: item.category,
			summary: item.summary || excerpt(item.body),
			body: item.body,
			...(original?.pinned && { pinned: true }),
		});
	}
	return sortPosts([...bySlug.values()]);
}

/** 글 내용 (게시한 내용, 임시 저장, 버전이 같은 모양) */
export interface PostContent {
	title: string;
	/** YYYY-MM-DD */
	date: string;
	category: string;
	summary: string;
	body: string;
}

/** API가 관리자에게 주는 글: 게시한 내용과 임시 저장을 따로 */
export interface AdminPost {
	slug: string;
	published: PostContent | null;
	publishedAt: string | null;
	draft: PostContent | null;
	draftUpdatedAt: string | null;
	deleted: boolean;
	/** 지운 때. 있으면 '최근 삭제된 항목'에 있다 (30일 동안 되살릴 수 있다) */
	deletedAt?: string | null;
	/** 남은 버전 수 */
	revisions: number;
}

const toListPost = (slug: string, content: PostContent, pinned: boolean | undefined, status: PostStatus): Post => ({
	slug,
	title: content.title,
	date: content.date,
	category: content.category,
	summary: content.summary || excerpt(content.body),
	body: content.body,
	...(pinned && { pinned: true }),
	status,
});

/**
 * 관리자가 보는 목록: 저장소 글 위에 서버 글을 겹치되, 임시 저장이 있으면 그 내용을 보여 준다 (고치던 그대로 이어 쓴다).
 * 게시 상태(임시 저장만 있음, 게시하지 않은 편집, 예약)를 함께 단다. today: 서울 기준 YYYY-MM-DD
 */
export function mergeAdminPosts(posts: Post[], server: AdminPost[], today: string): Post[] {
	const bySlug = new Map(posts.map((post) => [post.slug, post]));
	const original = new Map(bySlug);
	for (const item of server) {
		if (item.deleted) {
			bySlug.delete(item.slug);
			continue;
		}
		const content = item.draft ?? item.published;
		if (!content) continue;
		const fromRepo = original.get(item.slug);
		bySlug.set(
			item.slug,
			toListPost(item.slug, content, fromRepo?.pinned, {
				draftOnly: !item.published && !fromRepo,
				changed: item.draft !== null && (item.published !== null || fromRepo !== undefined),
				scheduled: item.published && item.published.date > today ? item.published.date : null,
			})
		);
	}
	return sortPosts([...bySlug.values()]);
}

/**
 * '최근 삭제된 항목'의 글: 서버에 지운 때가 있고 아직 RECENTLY_DELETED_DAYS일이 안 된 글. 최근에 지운 글이 위로.
 * 내용은 임시 저장 → 게시한 내용 → 저장소 글 순으로 (지우기 전 관리자가 보던 그대로)
 */
export function recentlyDeletedPosts(repo: Post[], server: AdminPost[], now: Date): Post[] {
	const repoBySlug = new Map(repo.map((post) => [post.slug, post]));
	const limit = RECENTLY_DELETED_DAYS * 24 * 60 * 60 * 1000;
	return server
		.filter((item) => item.deleted && item.deletedAt && now.getTime() - Date.parse(item.deletedAt) < limit)
		.flatMap((item) => {
			const content = item.draft ?? item.published;
			const base = content ? toListPost(item.slug, content, false, NO_STATUS) : repoBySlug.get(item.slug);
			return base ? [{ ...base, pinned: false, status: undefined, deletedAt: item.deletedAt! }] : [];
		})
		.sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!));
}

/** 영구히 지울 때까지 남은 날 (지운 날은 30일 남음, 하루 지날 때마다 하나씩 준다. 마지막 날은 1) */
export function daysUntilPurge(deletedAt: string, now: Date): number {
	// 창을 연 뒤에 지운 글은 now보다 뒤에 지웠으므로 0일로 본다
	const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(deletedAt)) / (24 * 60 * 60 * 1000)));
	return Math.max(1, RECENTLY_DELETED_DAYS - elapsed);
}

const NO_STATUS: PostStatus = { draftOnly: false, changed: false, scheduled: null };

/** 최신 글이 위로. 같은 날이면 제목 순 */
export function sortPosts(posts: Post[]): Post[] {
	return [...posts].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

/**
 * 날짜 순으로 바로 옆의 글: 이전 글은 더 오래된 글, 다음 글은 더 최근 글 (블로그의 흔한 관례).
 * 같은 날이면 목록과 같은 순서(제목 순)를 따른다. 목록을 어떻게 정렬해 보고 있든 날짜로 잇는다.
 */
export function adjacentPosts(posts: Post[], slug: string): { older: Post | null; newer: Post | null } {
	const ordered = sortPosts(posts);
	const index = ordered.findIndex((post) => post.slug === slug);
	if (index === -1) return { older: null, newer: null };
	return { older: ordered[index + 1] ?? null, newer: ordered[index - 1] ?? null };
}

/** 폴더 트리의 한 폴더. category의 '/'로 하위 폴더를 만든다 (예: 개발기/MacFolio) */
export interface FolderNode {
	name: string;
	/** 전체 경로 (예: 개발기/MacFolio) */
	path: string;
	/** 하위 폴더의 글까지 센 수 */
	count: number;
	children: FolderNode[];
	/** 방문자가 만든 폴더 (이 브라우저에만 있다) */
	custom?: boolean;
}

/** 글이 그 폴더(또는 하위 폴더)에 있는지 */
export function inFolder(post: Post, path: string): boolean {
	return path === ALL_CATEGORY || post.category === path || post.category.startsWith(`${path}/`);
}

/**
 * 글의 category와 방문자가 만든 폴더(글 0개)로 폴더 트리를 만든다.
 * 같은 층은 order(관리자가 정한 순서)를 따르고, 거기 없는 폴더는 그 뒤에 가나다순. 방문자가 만든 폴더는 custom으로 표시한다.
 */
export function buildFolderTree(posts: Post[], customFolders: string[] = [], order: string[] = []): FolderNode[] {
	const root: FolderNode[] = [];
	const add = (category: string, counted: boolean) => {
		const parts = category
			.split('/')
			.map((part) => part.trim())
			.filter(Boolean);
		let level = root;
		parts.forEach((name, index) => {
			const path = parts.slice(0, index + 1).join('/');
			let node = level.find((n) => n.name === name);
			if (!node) {
				node = { name, path, count: 0, children: [], ...(customFolders.includes(path) && { custom: true }) };
				level.push(node);
			}
			if (counted) node.count += 1;
			level = node.children;
		});
	};
	posts.forEach((post) => add(post.category, true));
	customFolders.forEach((path) => add(path, false));
	const rank = (path: string) => {
		const index = order.indexOf(path);
		return index === -1 ? Infinity : index;
	};
	const sort = (nodes: FolderNode[]): FolderNode[] =>
		nodes
			.sort((a, b) => rank(a.path) - rank(b.path) || a.name.localeCompare(b.name))
			.map((node) => ({ ...node, children: sort(node.children) }));
	return sort(root);
}

/** 폴더 경로를 "개발기 › MacFolio"처럼 */
export const folderLabelOf = (path: string) => path.split('/').join(' › ');

/** 경로의 마지막 이름 (예: 개발기/MacFolio → MacFolio) */
export const folderName = (path: string) =>
	path === RECENTLY_DELETED
		? '최근 삭제된 항목'
		: path === TAG_VIEW
			? '태그'
			: path === POPULAR_VIEW
				? '인기글'
				: (path.split('/').at(-1) ?? path);

/** 본문의 첫 이미지 주소 (갤러리 미리보기용). 없으면 null */
export function firstImage(body: string): string | null {
	return /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(body)?.[1] ?? null;
}

/** 폴더(하위 폴더 포함)와 검색어로 거른다. 검색은 제목·본문에서 대소문자 구분 없이 */
/** 검색 조건 (macOS 메모의 검색 칸 메뉴: 체크리스트가 있는 메모 등) */
export type PostFilter = 'pinned' | 'checklist' | 'table' | 'image' | 'code' | 'attachment' | 'draft' | 'scheduled';

export const POST_FILTERS: {
	id: PostFilter;
	/** 메뉴의 이름 */
	label: string;
	/** 검색 칸에 붙는 짧은 이름 */
	chip: string;
	icon: string;
	/** 관리자에게만 (게시 상태) */
	adminOnly?: boolean;
	test: (post: Post) => boolean;
}[] = [
	{
		id: 'pinned',
		label: '고정된 메모',
		chip: '고정',
		icon: 'fa-solid fa-thumbtack',
		test: (post) => Boolean(post.pinned),
	},
	{
		id: 'checklist',
		label: '체크리스트가 있는 메모',
		chip: '체크리스트',
		icon: 'fa-solid fa-list-check',
		test: (post) => /^\s*[-*+] \[[ xX]\]/m.test(post.body),
	},
	{
		id: 'table',
		label: '표가 있는 메모',
		chip: '표',
		icon: 'fa-solid fa-table',
		test: (post) => /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/m.test(post.body),
	},
	{
		id: 'image',
		label: '이미지가 있는 메모',
		chip: '이미지',
		icon: 'fa-regular fa-image',
		test: (post) => /!\[[^\]]*\]\(/.test(post.body),
	},
	{
		id: 'code',
		label: '코드가 있는 메모',
		chip: '코드',
		icon: 'fa-solid fa-code',
		test: (post) => /^\s*```/m.test(post.body),
	},
	{
		id: 'attachment',
		label: '첨부 파일이 있는 메모',
		chip: '첨부 파일',
		icon: 'fa-solid fa-paperclip',
		test: (post) => /\]\([^)\s]+ "첨부 파일/.test(post.body),
	},
	{
		id: 'draft',
		label: '게시하지 않은 메모',
		chip: '게시 안 함',
		icon: 'fa-regular fa-pen-to-square',
		adminOnly: true,
		test: (post) => Boolean(post.status?.draftOnly || post.status?.changed),
	},
	{
		id: 'scheduled',
		label: '예약된 메모',
		chip: '예약',
		icon: 'fa-regular fa-clock',
		adminOnly: true,
		test: (post) => Boolean(post.status?.scheduled),
	},
];

export function filterPosts(posts: Post[], category: string, query: string, filter: PostFilter | null = null): Post[] {
	const q = query.trim().toLowerCase();
	const condition = POST_FILTERS.find((item) => item.id === filter);
	return posts.filter(
		(post) =>
			inFolder(post, category) &&
			(!condition || condition.test(post)) &&
			(!q || post.title.toLowerCase().includes(q) || post.body.toLowerCase().includes(q))
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
