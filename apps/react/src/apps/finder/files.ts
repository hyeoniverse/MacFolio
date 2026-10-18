// Finder의 파일 트리. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 실제 파일이 있는 것은 아니고, 사이트에 있는 것들(저장소 문서, 프로젝트, 블로그 글, 앱)을 폴더와 파일처럼 묶어 보여 준다.
// 파일을 열면 그 종류에 맞는 곳으로 간다: 문서·PDF·그림은 Finder 안에서 보고, 프로젝트는 Safari, 글은 메모, 앱은 그 앱.
import type { AppName } from '@/apps/manifest';
import {
	DOCUMENT_FOLDERS,
	type DocumentEntry,
	type DocumentFolder,
	type DocumentFolderValue,
	projectFolderValue,
} from './documents';

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

/** 문서 파일 (PDF·그림). R2에 있고 미리보기 앱에서 연다 (documents.ts) */
export interface FileItem extends ItemBase {
	kind: 'pdf' | 'image';
	/** R2 키. 주소는 /files/<key> */
	key: string;
	size?: number;
	/** 서버 목록의 id (관리자가 이름을 바꾸거나 지울 때) */
	documentId?: string;
}

export type FinderItem = FolderItem | DocItem | PostItem | ProjectItem | AppItem | FileItem;

/** 목록 보기의 '종류' 칸 */
export const KIND_LABELS: Record<FinderItem['kind'], string> = {
	folder: '폴더',
	doc: 'Markdown 문서',
	post: '블로그 글',
	project: '프로젝트',
	app: '응용 프로그램',
	pdf: 'PDF 문서',
	image: '이미지',
};

export interface TreeInput {
	/** 저장소 문서 경로 (예: README.md, docs/deployment.md) */
	docs: string[];
	posts: { slug: string; title: string; date: string; category: string }[];
	/** 메모에서 만든 폴더 경로 (예: 개발기/읽을거리). 글이 없어도 블로그 아래에 폴더로 보인다 */
	blogFolders?: string[];
	projects: { id: string; name: string; icon?: string; period?: string }[];
	apps: { app: AppName; label: string; icon: string }[];
	/** 문서 파일 목록 (documents.ts). 없으면 폴더만 비어 있다 */
	files?: DocumentEntry[];
	/** 사진 앱의 앨범 (프로젝트마다). 프로젝트 폴더 안의 사진 폴더로, 그림은 미리보기에서 연다 */
	albums?: { id: string; name: string; photos: { src: string }[] }[];
}

/** 빈 문서 파일 폴더의 안내 */
const FOLDER_NOTES: Record<DocumentFolder, string> = {
	이력서: '공개용 이력서를 준비하고 있습니다.',
	포트폴리오: '포트폴리오 파일을 준비하고 있습니다.',
	자격증: '자격증 사본을 준비하고 있습니다.',
};

const byName = (a: FinderItem, b: FinderItem) =>
	a.kind === 'folder' && b.kind !== 'folder'
		? -1
		: a.kind !== 'folder' && b.kind === 'folder'
			? 1
			: a.name.localeCompare(b.name, 'ko');

/** 올린 문서 파일(R2) 하나를 Finder 항목으로 */
const fileItem = (file: DocumentEntry): FileItem => ({
	kind: file.kind,
	id: `file:${file.key}`,
	name: file.name,
	key: file.key,
	size: file.size,
	modified: file.updated,
	documentId: file.id,
});

/** 폴더의 수정일: 안에 든 가장 최근 항목 */
const latest = (items: FinderItem[]) =>
	items
		.map((item) => item.modified)
		.filter(Boolean)
		.sort()
		.at(-1);

/** 문서 폴더: 저장소 맨 위 문서와 docs/ 안의 문서, 그리고 이력서·포트폴리오·자격증 (R2의 파일. 프로젝트 폴더의 파일은 빼고) */
function docsFolder(paths: string[], files: DocumentEntry[]): FolderItem {
	const docs: FinderItem[] = paths.map((path) => ({
		kind: 'doc',
		id: `docs:${path}`,
		name: path.split('/').at(-1)!,
		path,
	}));
	const folders = DOCUMENT_FOLDERS.map((name): FolderItem => ({
		kind: 'folder',
		id: `docs:${name}`,
		name,
		children: files
			.filter((file) => file.folder === name)
			.map(fileItem)
			.sort(byName),
		emptyNote: FOLDER_NOTES[name],
	}));
	folders.forEach((folder) => {
		folder.modified = latest(folder.children);
	});
	return { kind: 'folder', id: 'docs', name: '문서', children: [...folders, ...docs].sort(byName) };
}

/** 그림 확장자 (영상·소리는 미리보기가 열지 않는다) */
const isImage = (src: string) => /\.(jpe?g|png|webp|gif|svg)$/i.test(src.split('?')[0]);

type Album = NonNullable<TreeInput['albums']>[number];

/** 앨범의 그림들 (영상은 빼고). 키는 사이트 주소 그대로 (documents.ts의 fileUrl). 그림은 프로젝트 폴더의 사진 폴더에만 있다 */
const albumPhotos = (album: Album): FileItem[] =>
	album.photos
		.filter((photo) => isImage(photo.src))
		.map((photo) => ({
			kind: 'image',
			id: `photo:${photo.src}`,
			name: photo.src.split('?')[0].split('/').pop() ?? photo.src,
			key: photo.src,
		}));

/**
 * 프로젝트 폴더: 프로젝트마다 폴더 하나 (실제 OS처럼). 안에는 사진 폴더(그 프로젝트 앨범의 그림),
 * 그다음 관리자가 올린 파일(R2, 폴더 값 project:<id>)을 이름순으로. 실행하는 앱은 폴더에 두지 않는다
 * (실제 Mac처럼 응용 프로그램에만 있다)
 */
function projectsFolder(projects: TreeInput['projects'], files: DocumentEntry[], albums: Album[]): FolderItem {
	return {
		kind: 'folder',
		id: 'projects',
		name: '프로젝트',
		children: projects.map((project): FolderItem => {
			const album = albums.find((item) => item.id === project.id);
			const photos = album ? albumPhotos(album) : [];
			const uploads = files
				.filter((file) => file.folder === projectFolderValue(project.id))
				.map(fileItem)
				.sort(byName);
			const children: FinderItem[] = [
				...(photos.length > 0
					? [{ kind: 'folder' as const, id: `projects/${project.id}/photos`, name: '사진', children: photos }]
					: []),
				...uploads,
			];
			return { kind: 'folder', id: `projects/${project.id}`, name: project.name, children, modified: latest(uploads) };
		}),
	};
}

/** 블로그 폴더: 글의 카테고리(프론트엔드/기능)를 폴더로. 같은 폴더 안은 최신 글이 위로 */
function blogFolder(posts: TreeInput['posts'], folders: string[] = []): FolderItem {
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
	// 빈 폴더도 보이게 만든 폴더부터 (글이 있는 폴더는 아래에서 다시 찾는다)
	for (const path of folders) folderAt(path.split('/').filter(Boolean));
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
export function buildLocations({
	docs,
	posts,
	blogFolders = [],
	projects,
	apps,
	files = [],
	albums = [],
}: TreeInput): FolderItem[] {
	return [
		docsFolder(docs, files),
		projectsFolder(projects, files, albums),
		blogFolder(posts, blogFolders),
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

/**
 * 관리자가 파일을 놓아 올릴 수 있는 폴더면 그 API 폴더 값: 문서 › 이력서 → 이력서, 프로젝트 › <프로젝트> → project:<id>.
 * 다른 폴더(사진 등)와 폴더가 아닌 항목은 null
 */
export function uploadFolderOf(item: FinderItem | null | undefined): DocumentFolderValue | null {
	if (!item || item.kind !== 'folder') return null;
	if (item.id === `docs:${item.name}` && (DOCUMENT_FOLDERS as readonly string[]).includes(item.name))
		return item.name as DocumentFolder;
	const project = /^projects\/([^/]+)$/.exec(item.id);
	return project ? projectFolderValue(project[1]) : null;
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

const KIND_ORDER: FinderItem['kind'][] = ['folder', 'doc', 'pdf', 'image', 'post', 'project', 'app'];

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

/**
 * iCloud의 미리보기 폴더: 올린 문서 파일(R2) 전부, 곧 문서 아래와 프로젝트 폴더의 PDF·그림을 이름 순으로 (macOS 미리보기의 열기 창이 처음 여는 곳).
 * 데스크톱 미리보기의 열기 창과 휴대폰 파일 앱의 둘러보기가 같이 쓴다. 파일 id는 원래 자리와 같다
 */
export function previewFolder(locations: FinderItem[]): FolderItem {
	const files = (items: FinderItem[]): FileItem[] =>
		items.flatMap((item) =>
			item.kind === 'folder' ? files(item.children) : item.kind === 'pdf' || item.kind === 'image' ? [item] : []
		);
	return {
		kind: 'folder',
		id: 'preview',
		name: '미리보기',
		// 올린 문서 파일(R2, id가 file:)만: 프로젝트의 사진 폴더 그림은 iCloud의 미리보기 폴더에 들어 있지 않다
		children: files(locations.filter((place) => place.id === 'docs' || place.id === 'projects'))
			.filter((item) => item.id.startsWith('file:'))
			.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
		emptyNote: '파일이 없습니다.',
	};
}
