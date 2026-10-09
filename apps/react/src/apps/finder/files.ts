// Finder의 파일 트리. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 실제 파일이 있는 것은 아니고, 사이트에 있는 것들(저장소 문서, 프로젝트, 블로그 글, 앱)을 폴더와 파일처럼 묶어 보여 준다.
// 파일을 열면 그 종류에 맞는 곳으로 간다: 문서는 Finder 안에서 읽고, 프로젝트는 Safari, 글은 메모, 앱은 그 앱.
import type { AppName } from '@/apps/manifest';

interface ItemBase {
	/** 트리 안에서 하나뿐인 경로 (예: blog/프론트엔드/기능, docs/deployment.md) */
	id: string;
	/** 보이는 이름 */
	name: string;
	/** 수정일 (YYYY-MM-DD). 모르면 없다 */
	modified?: string;
}

export interface FolderItem extends ItemBase {
	kind: 'folder';
	children: FinderItem[];
	/** 비어 있을 때 보여 줄 안내 */
	emptyNote?: string;
}

/** 저장소의 Markdown 문서. Finder 안에서 읽는다 */
export interface DocItem extends ItemBase {
	kind: 'doc';
	/** 저장소 안 경로 (예: docs/deployment.md) */
	path: string;
}

/** 블로그 글. 메모 앱에서 연다 */
export interface PostItem extends ItemBase {
	kind: 'post';
	slug: string;
}

/** 프로젝트. Safari의 그 프로젝트 탭을 연다 */
export interface ProjectItem extends ItemBase {
	kind: 'project';
	projectId: string;
	icon?: string;
	/** 진행 기간 (보기용) */
	period?: string;
}

/** 앱. 그 앱을 연다 */
export interface AppItem extends ItemBase {
	kind: 'app';
	app: AppName;
	icon: string;
}

export type FinderItem = FolderItem | DocItem | PostItem | ProjectItem | AppItem;

/** 목록 보기의 '종류' 칸 */
export const KIND_LABELS: Record<FinderItem['kind'], string> = {
	folder: '폴더',
	doc: 'Markdown 문서',
	post: '블로그 글',
	project: '프로젝트',
	app: '응용 프로그램',
};

export interface TreeInput {
	/** 저장소 문서 경로 (예: README.md, docs/deployment.md) */
	docs: string[];
	posts: { slug: string; title: string; date: string; category: string }[];
	projects: { id: string; name: string; icon?: string; period?: string }[];
	apps: { app: AppName; label: string; icon: string }[];
}

const byName = (a: FinderItem, b: FinderItem) =>
	a.kind === 'folder' && b.kind !== 'folder'
		? -1
		: a.kind !== 'folder' && b.kind === 'folder'
			? 1
			: a.name.localeCompare(b.name, 'ko');

/** 문서 폴더: 저장소 맨 위 문서와 docs/ 안의 문서, 그리고 이력서 자리 */
function docsFolder(paths: string[]): FolderItem {
	const docs: FinderItem[] = paths.map((path) => ({
		kind: 'doc',
		id: `docs:${path}`,
		name: path.split('/').at(-1)!,
		path,
	}));
	const resume: FolderItem = {
		kind: 'folder',
		id: 'docs:이력서',
		name: '이력서',
		children: [],
		emptyNote: '공개용 이력서를 준비하고 있습니다.',
	};
	return { kind: 'folder', id: 'docs', name: '문서', children: [resume, ...docs].sort(byName) };
}

/** 블로그 폴더: 글의 카테고리(프론트엔드/기능)를 폴더로. 같은 폴더 안은 최신 글이 위로 */
function blogFolder(posts: TreeInput['posts']): FolderItem {
	const root: FolderItem = { kind: 'folder', id: 'blog', name: '블로그', children: [] };
	const folderAt = (path: string[]): FolderItem => {
		let current = root;
		path.forEach((name, depth) => {
			const id = `blog/${path.slice(0, depth + 1).join('/')}`;
			let next = current.children.find((child): child is FolderItem => child.kind === 'folder' && child.id === id);
			if (!next) {
				next = { kind: 'folder', id, name, children: [] };
				current.children.push(next);
			}
			current = next;
		});
		return current;
	};
	[...posts]
		.sort((a, b) => b.date.localeCompare(a.date))
		.forEach((post) => {
			const folder = folderAt(post.category.split('/').filter(Boolean));
			folder.children.push({
				kind: 'post',
				id: `post:${post.slug}`,
				name: post.title,
				slug: post.slug,
				modified: post.date,
			});
		});
	// 폴더는 위에(이름순), 글은 날짜순 그대로. 폴더의 수정일은 안에 든 가장 최근 글
	const tidy = (folder: FolderItem): string | undefined => {
		const folders = folder.children.filter((child): child is FolderItem => child.kind === 'folder');
		folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
		folder.children = [...folders, ...folder.children.filter((child) => child.kind !== 'folder')];
		const dates = [...folders.map(tidy), ...folder.children.map((child) => child.modified)].filter(Boolean) as string[];
		folder.modified = dates.sort().at(-1);
		return folder.modified;
	};
	tidy(root);
	return root;
}

/** 사이드바에 보일 위치들 (Finder의 즐겨찾기) */
export function buildLocations({ docs, posts, projects, apps }: TreeInput): FolderItem[] {
	return [
		docsFolder(docs),
		{
			kind: 'folder',
			id: 'projects',
			name: '프로젝트',
			children: projects.map((project) => ({
				kind: 'project',
				id: `project:${project.id}`,
				name: project.name,
				projectId: project.id,
				icon: project.icon,
				period: project.period,
			})),
		},
		blogFolder(posts),
		{
			kind: 'folder',
			id: 'apps',
			name: '응용 프로그램',
			children: apps
				.map((app): FinderItem => ({
					kind: 'app',
					id: `app:${app.app}`,
					name: app.label,
					app: app.app,
					icon: app.icon,
				}))
				.sort(byName),
		},
	];
}

/** id로 항목을 찾는다 */
export function find(roots: FinderItem[], id: string): FinderItem | null {
	for (const item of roots) {
		if (item.id === id) return item;
		if (item.kind === 'folder') {
			const found = find(item.children, id);
			if (found) return found;
		}
	}
	return null;
}

/** 위치에서 그 항목까지 거쳐 가는 폴더들 (경로 막대용). 없으면 빈 배열 */
export function pathTo(roots: FinderItem[], id: string): FinderItem[] {
	for (const item of roots) {
		if (item.id === id) return [item];
		if (item.kind === 'folder') {
			const rest = pathTo(item.children, id);
			if (rest.length) return [item, ...rest];
		}
	}
	return [];
}

/** 이름으로 찾기: 위치 전체에서 이름에 검색어가 들어간 파일과 폴더 (대소문자 무시) */
export function search(roots: FinderItem[], query: string): FinderItem[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const found: FinderItem[] = [];
	const walk = (items: FinderItem[]) =>
		items.forEach((item) => {
			if (item.name.toLowerCase().includes(needle)) found.push(item);
			if (item.kind === 'folder') walk(item.children);
		});
	walk(roots);
	return found;
}

/** 폴더 안 항목 개수 안내 (예: '항목 3개') */
export const countLabel = (count: number) => (count === 0 ? '비어 있음' : `항목 ${count}개`);

/** 최근 항목 (휴대폰 파일 앱): 날짜가 있는 파일을 최신 순으로. 폴더와 앱은 빼고, limit개까지 */
export function recentItems(roots: FinderItem[], limit = 30): FinderItem[] {
	const found: FinderItem[] = [];
	const walk = (items: FinderItem[]) =>
		items.forEach((item) => {
			if (item.kind === 'folder') walk(item.children);
			else if (item.kind !== 'app' && item.modified) found.push(item);
		});
	walk(roots);
	return found.sort((a, b) => b.modified!.localeCompare(a.modified!)).slice(0, limit);
}

export type SortKey = 'name' | 'kind' | 'date';

const KIND_ORDER: FinderItem['kind'][] = ['folder', 'doc', 'post', 'project', 'app'];

/** 정렬 (휴대폰 파일 앱의 ••• 메뉴): 이름순, 종류(폴더 먼저)마다 이름순, 날짜는 최신이 위로(날짜 없는 것은 아래에 이름순) */
export function sortItems(items: FinderItem[], key: SortKey): FinderItem[] {
	const byItemName = (a: FinderItem, b: FinderItem) => a.name.localeCompare(b.name, 'ko');
	const compare: Record<SortKey, (a: FinderItem, b: FinderItem) => number> = {
		name: byItemName,
		kind: (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || byItemName(a, b),
		date: (a, b) =>
			a.modified && b.modified
				? b.modified.localeCompare(a.modified)
				: a.modified
					? -1
					: b.modified
						? 1
						: byItemName(a, b),
	};
	return [...items].sort(compare[key]);
}
