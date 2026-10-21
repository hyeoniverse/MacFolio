// Finder의 파일 트리. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 실제 파일이 있는 것은 아니고, 사이트에 있는 것들(저장소 문서, 프로젝트, 블로그 글, 앱)을 폴더와 파일처럼 묶어 보여 준다.
// 파일을 열면 그 종류에 맞는 곳으로 간다: 문서·PDF·그림은 Finder 안에서 보고, 프로젝트는 Safari, 글은 메모, 앱은 그 앱.
import type { AppName } from '@/apps/manifest';
import { DEFAULT_DESKTOP_ALIASES, FINDER_BUILTIN_PARENT, type FinderLayoutValue } from '@macfolio/contracts';
import {
	DESKTOP_DOCUMENT_FOLDER,
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

/**
 * 바탕화면의 가상본(alias). 폴더가 아니라 원래 폴더(target)를 가리키는 따로 된 종류다:
 * 안에 든 것(children)이 없으므로, 폴더처럼 다루려면 원래 폴더를 찾아야 한다 (edit.ts의 resolveAlias).
 * 폴더의 한 변형으로 두었더니 빈 폴더로 열리는 곳이 생겨서 나눴다
 */
export interface AliasItem extends ItemBase {
	kind: 'alias';
	/** 원래 폴더의 id (예: docs:포트폴리오) */
	target: string;
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

/** 음악 앱의 곡. 홈 › 음악 › 아티스트 › 앨범 안에 있고, 열면 음악 앱이 그 앨범을 재생 목록 삼아 이 곡부터 재생한다 */
export interface TrackItem extends ItemBase {
	kind: 'track';
	trackId: string;
	/** 음악 앱의 앨범 재생 목록 id (예: album:Spirited Away) */
	playlistId: string;
	/** 앨범 그림 (아이콘) */
	artwork: string;
}

/** 앱. 그 앱을 연다 */
export interface AppItem extends ItemBase {
	kind: 'app';
	app: AppName;
	icon: string;
}

/** 문서 파일. R2에 있다 (documents.ts). PDF·그림은 미리보기 앱에서 열고, 그 밖의 파일(file)은 받아서 연다 */
export interface FileItem extends ItemBase {
	kind: 'pdf' | 'image' | 'file';
	/** R2 키. 주소는 /files/<key> */
	key: string;
	size?: number;
	/** 서버 목록의 id (관리자가 이름을 바꾸거나 지울 때) */
	documentId?: string;
	/** 올린 폴더 (기본 자리, 예: docs:이력서, projects/macfolio). 관리자가 옮겨도 R2 키와 이 값은 그대로다 */
	home?: string;
}

export type FinderItem = FolderItem | AliasItem | DocItem | PostItem | ProjectItem | AppItem | FileItem | TrackItem;

/** 목록 보기의 '종류' 칸 */
export const KIND_LABELS: Record<FinderItem['kind'], string> = {
	folder: '폴더',
	alias: '가상본',
	doc: 'Markdown 문서',
	post: '블로그 글',
	project: '프로젝트',
	app: '응용 프로그램',
	pdf: 'PDF 문서',
	image: '이미지',
	file: '파일',
	track: 'MP3 오디오',
};

/** 동영상·소리 파일이면 그 종류 (QuickTime Player가 연다). 이름의 확장자로 본다 */
export function mediaKind(name: string): 'video' | 'audio' | null {
	const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
	if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
	if (['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(ext)) return 'audio';
	return null;
}

/** 올린 파일(PDF·그림·그 밖의 파일)인지 */
export const isFileItem = (item: FinderItem): item is FileItem =>
	item.kind === 'pdf' || item.kind === 'image' || item.kind === 'file';

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
	/** 사진 앱의 앨범 (프로젝트마다). 홈 › 그림 안에 앨범마다 폴더로, 그림은 미리보기에서 연다 */
	albums?: { id: string; name: string; photos: { src: string }[] }[];
	/** 음악 앱의 곡. 홈 › 음악 › 아티스트 › 앨범 안에 */
	tracks?: { id: string; title: string; artist: string; album: string; artwork: string; playlistId: string }[];
	/** 관리자가 정한 폴더 구조 (만든 폴더, 옮긴 파일, 바탕화면의 가상본). 없으면 기본 구조 */
	layout?: FinderLayoutValue;
	/** 데이터로 만드는 이력서: 국문·영문 Markdown 문서와 그 PDF. 문서 › 이력서 안에 올린 파일과 함께 둔다.
	 *  이름에는 확장자를 쓰지 않는다 (문서는 경로의 확장자, PDF는 .pdf를 withExtension이 붙인다) */
	resume?: (DocItem | FileItem)[];
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
const fileItem = (file: DocumentEntry): FileItem => {
	const project = /^project:(.+)$/.exec(file.folder);
	return {
		kind: file.kind,
		id: `file:${file.key}`,
		name: file.name,
		key: file.key,
		size: file.size,
		modified: file.updated,
		documentId: file.id,
		home: project
			? `projects/${project[1]}`
			: file.folder === DESKTOP_DOCUMENT_FOLDER
				? 'desktop'
				: `docs:${file.folder}`,
	};
};

/** 폴더의 수정일: 안에 든 가장 최근 항목 */
const latest = (items: FinderItem[]) =>
	items
		.map((item) => item.modified)
		.filter(Boolean)
		.sort()
		.at(-1);

/**
 * 문서 폴더: 저장소 맨 위 문서와 docs/ 안의 문서, 그리고 이력서·포트폴리오·자격증 (R2의 파일. 프로젝트 폴더의 파일은 빼고).
 * 프로젝트 폴더들은 포트폴리오 안에 (폴더가 위에 이름순, 그다음 파일)
 */
/** 파일 이름 끝의 확장자 (점 포함). 없으면 '' */
const extensionOf = (name: string) => /\.[^./]+$/.exec(name)?.[0] ?? '';

/**
 * 이름에 확장자를 붙인다 (Finder는 파일 이름에 확장자를 보인다). 문서는 경로의 확장자(.md), PDF는 .pdf.
 * 이미 붙어 있으면 그대로 둔다
 */
export function withExtension<T extends DocItem | FileItem>(item: T): T {
	const extension = item.kind === 'doc' ? extensionOf(item.path) : item.kind === 'pdf' ? '.pdf' : '';
	return !extension || item.name.endsWith(extension) ? item : { ...item, name: `${item.name}${extension}` };
}

function docsFolder(
	paths: string[],
	files: DocumentEntry[],
	projects: FolderItem[] = [],
	resume?: TreeInput['resume']
): FolderItem {
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
		children: [
			...(name === '포트폴리오' ? projects : []),
			...(name === '이력서' && resume ? resume.map(withExtension) : []),
			...files.filter((file) => file.folder === name).map(fileItem),
		].sort(byName),
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

/** 앨범의 그림들 (영상은 빼고). 키는 사이트 주소 그대로 (documents.ts의 fileUrl). 그림은 홈 › 그림의 앨범 폴더에만 있다 */
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
 * 프로젝트 폴더: 프로젝트마다 폴더 하나 (실제 OS처럼), 문서 › 포트폴리오 안에 놓인다. id(projects/<id>)와 폴더 값(project:<id>)은 그대로.
 * 안에는 관리자가 올린 파일(R2, 폴더 값 project:<id>)을 이름순으로. 사진은 홈 › 그림에, 실행하는 앱은 응용 프로그램에만 있다
 */
function projectFolders(projects: TreeInput['projects'], files: DocumentEntry[]): FolderItem[] {
	return projects.map((project): FolderItem => {
		const uploads = files
			.filter((file) => file.folder === projectFolderValue(project.id))
			.map(fileItem)
			.sort(byName);
		return {
			kind: 'folder',
			id: `projects/${project.id}`,
			name: project.name,
			children: uploads,
			modified: latest(uploads),
		};
	});
}

/**
 * 그림 폴더: 사진 앱의 앨범마다 폴더 하나 (다른 폴더처럼 이름순). 사진의 원래 자리다
 * (예전에는 프로젝트 폴더 안의 사진 폴더에 두어 같은 사진이 두 곳에 있었다)
 */
function picturesFolder(albums: Album[]): FolderItem {
	return {
		kind: 'folder',
		id: 'pictures',
		name: '그림',
		children: albums
			.map((album): FolderItem => ({
				kind: 'folder',
				id: `pictures/${album.id}`,
				name: album.name,
				children: albumPhotos(album),
			}))
			.filter((folder) => folder.children.length > 0)
			.sort(byName),
		emptyNote: '그림이 없습니다.',
	};
}

/** 음악 폴더: macOS의 음악 폴더처럼 아티스트 › 앨범 › 곡. 곡 이름은 '제목.mp3' */
function musicFolder(tracks: NonNullable<TreeInput['tracks']>): FolderItem {
	const root: FolderItem = { kind: 'folder', id: 'music', name: '음악', children: [], emptyNote: '음악이 없습니다.' };
	const child = (parent: FolderItem, id: string, name: string): FolderItem => {
		let found = parent.children.find((item): item is FolderItem => item.kind === 'folder' && item.id === id);
		if (!found) {
			found = { kind: 'folder', id, name, children: [] };
			parent.children.push(found);
		}
		return found;
	};
	for (const track of tracks) {
		const artist = child(root, `music/${track.artist}`, track.artist);
		const album = child(artist, `music/${track.artist}/${track.album}`, track.album);
		album.children.push({
			kind: 'track',
			id: `track:${track.id}`,
			name: `${track.title}.mp3`,
			trackId: track.id,
			playlistId: track.playlistId,
			artwork: track.artwork,
		});
	}
	// 아티스트·앨범은 이름순, 앨범 안의 곡은 보관함 순서 그대로
	root.children.sort(byName);
	root.children.forEach((artist) => artist.kind === 'folder' && artist.children.sort(byName));
	return root;
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

/** Finder 트리의 맨 위 (휴지통은 빼고). 휴지통까지 필요하면 buildTree */
export const buildLocations = (input: TreeInput): FolderItem[] => buildTree(input).roots;

/** 홈 폴더 이름 (macOS의 사용자 폴더, /Users/<이름>) */
export const HOME_NAME = 'hyeoniverse';

/**
 * 사이드바의 즐겨찾기 (macOS처럼 트리 안 폴더로 가는 바로가기). 이 순서로 보인다.
 * 폴더 자체는 디스크 › 사용자 › 홈 아래에 있다
 */
export const FAVORITE_IDS = ['desktop', 'docs', 'blog', 'apps'] as const;
/** 사이드바의 위치 칸: 홈과 디스크 */
export const PLACE_IDS = ['home', 'mac'] as const;

/** ids의 폴더들 (트리에 없는 것은 건너뛴다) */
export const foldersOf = (roots: FinderItem[], ids: readonly string[]): FolderItem[] =>
	ids.map((id) => find(roots, id)).filter((item): item is FolderItem => item?.kind === 'folder');

/** 경로에서 가장 안쪽에 있는 사이드바 항목 (사이드바에서 칠할 곳). 없으면 null */
export const sidebarIdOf = (roots: FinderItem[], id: string, sidebar: readonly string[]): string | null =>
	[...pathTo(roots, id)].reverse().find((step) => sidebar.includes(step.id))?.id ?? null;

/** 홈의 macOS 기본 폴더 가운데 이 사이트에 담을 것이 없는 것 (비어 있을 때의 안내와 함께). 그림·음악은 사진·음악 앱의 것을 담는다 */
const EMPTY_HOME_FOLDERS: { id: string; name: string; emptyNote: string }[] = [
	{ id: 'public', name: '공용', emptyNote: '공유한 파일이 없습니다.' },
	{ id: 'downloads', name: '다운로드', emptyNote: '다운로드한 파일이 없습니다.' },
	{ id: 'movies', name: '동영상', emptyNote: '동영상이 없습니다.' },
];

/** 휴지통 폴더 id (Finder 구조에서 휴지통으로 보낸 만든 폴더·파일의 상위) */
export const TRASH_ID = 'trash';

/**
 * Finder의 파일 트리. macOS처럼 디스크 하나가 맨 위에 있다:
 * Macintosh HD › 응용 프로그램, Macintosh HD › 사용자 › 홈(hyeoniverse) › 데스크탑·문서·블로그와 macOS 기본 폴더.
 * 폴더 id(desktop, docs, docs:이력서 …)는 서버에 저장한 구조가 쓰는 값이라 그대로 두고, 그 위에 디스크·사용자·홈을 얹었다
 */
export function buildTree({
	docs,
	posts,
	blogFolders = [],
	projects,
	apps,
	files = [],
	albums = [],
	tracks = [],
	layout,
	resume,
}: TreeInput): { roots: FolderItem[]; trash: FolderItem } {
	const trash: FolderItem = {
		kind: 'folder',
		id: TRASH_ID,
		name: '휴지통',
		children: [],
		emptyNote: '휴지통이 비어 있습니다.',
	};
	const homeFolders: FolderItem[] = [
		{
			kind: 'folder',
			id: 'desktop',
			name: '데스크탑',
			// 바탕화면에 바로 놓아 올린 파일 (폴더 값 데스크탑, 키 desktop/…)
			children: files.filter((file) => file.folder === DESKTOP_DOCUMENT_FOLDER).map(fileItem),
			emptyNote: '바탕화면이 비어 있습니다.',
		},
		docsFolder(docs, files, projectFolders(projects, files), resume),
		blogFolder(posts, blogFolders),
		picturesFolder(albums),
		musicFolder(tracks),
		...EMPTY_HOME_FOLDERS.map((folder): FolderItem => ({ kind: 'folder', ...folder, children: [] })),
	];
	const applications: FolderItem = {
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
	};
	const home: FolderItem = { kind: 'folder', id: 'home', name: HOME_NAME, children: homeFolders.sort(byName) };
	const users: FolderItem = { kind: 'folder', id: 'users', name: '사용자', children: [home] };
	const roots: FolderItem[] = [
		{ kind: 'folder', id: 'mac', name: 'Macintosh HD', children: [applications, users].sort(byName) },
	];
	// 휴지통도 구조를 겹칠 때는 위치처럼 다룬다 (휴지통으로 보낸 폴더·파일이 그 안에 들어간다). 사이드바에는 보이지 않는다
	applyLayout([...roots, trash], layout);
	return { roots, trash };
}

/**
 * 관리자가 정한 구조를 기본 트리에 겹친다 (roots를 고친다).
 * 1) 바탕화면에 가상본, 2) 만든 폴더를 상위 폴더 아래에 (상위가 없거나 고리면 건너뛴다), 3) 옮긴 파일을 그 폴더로 (없는 파일·폴더는 건너뛴다).
 * 서버가 규칙을 이미 확인하지만, 프로젝트를 지우는 등으로 상위 폴더가 사라질 수 있어 여기서도 조용히 넘긴다
 */
function applyLayout(roots: FolderItem[], layout: FinderLayoutValue | undefined) {
	const folders = new Map<string, FolderItem>();
	const parents = new Map<string, FolderItem>();
	const index = (folder: FolderItem) => {
		folders.set(folder.id, folder);
		for (const child of folder.children) {
			parents.set(child.id, folder);
			if (child.kind === 'folder') index(child);
		}
	};
	roots.forEach(index);
	const desktop = folders.get('desktop')!;
	const touched = new Set<FolderItem>([desktop]);

	for (const target of layout?.aliases ?? DEFAULT_DESKTOP_ALIASES) {
		const real = folders.get(target);
		if (real && !desktop.children.some((child) => child.id === `alias:${target}`))
			desktop.children.push({ kind: 'alias', id: `alias:${target}`, name: real.name, target });
	}

	// 만든 폴더: 기본 자리(데스크탑·문서·문서 폴더·프로젝트 폴더)까지 고리 없이 올라갈 수 있는 것만
	const made = new Map((layout?.folders ?? []).map((folder) => [folder.id, folder]));
	const reachesRoot = (id: string) => {
		const seen = new Set<string>();
		for (let at = made.get(id); at; at = made.get(at.parent)) {
			if (seen.has(at.id)) return false;
			seen.add(at.id);
			if (!made.has(at.parent)) return FINDER_BUILTIN_PARENT.test(at.parent) && folders.has(at.parent);
		}
		return false;
	};
	const created = [...made.values()]
		.filter((folder) => reachesRoot(folder.id))
		.map((folder): [FolderItem, string] => [
			{ kind: 'folder', id: folder.id, name: folder.name, children: [] },
			folder.parent,
		]);
	for (const [folder] of created) folders.set(folder.id, folder);
	for (const [folder, parent] of created) {
		const into = folders.get(parent)!;
		into.children.push(folder);
		parents.set(folder.id, into);
		touched.add(into);
	}

	// 옮긴 파일: 지금 있는 자리에서 빼서 그 폴더로
	for (const [id, parent] of Object.entries(layout?.files ?? {})) {
		const from = parents.get(id);
		const into = folders.get(parent);
		const item = from?.children.find((child) => child.id === id);
		if (!from || !into || !item || from === into) continue;
		from.children = from.children.filter((child) => child !== item);
		into.children.push(item);
		parents.set(id, into);
		touched.add(from);
		touched.add(into);
	}

	// 바뀐 폴더를 다시 정렬하고, 만든 폴더부터 수정일(안에 든 가장 최근 항목)을 다시 잰다
	// 바탕화면은 가상본을 정한 순서대로 먼저 (아이콘이 그 순서로 오른쪽 위부터 놓인다)
	const aliasFirst = (a: FinderItem, b: FinderItem) =>
		Number(b.kind === 'alias') - Number(a.kind === 'alias') || (a.kind === 'alias' ? 0 : byName(a, b));
	for (const folder of touched) folder.children.sort(folder === desktop ? aliasFirst : byName);
	const refresh = (folder: FolderItem): string | undefined => {
		// 블로그 폴더의 수정일은 blogFolder가 글 날짜로 정한다
		folder.children.forEach((child) => child.kind === 'folder' && child.id !== 'blog' && refresh(child));
		if (folder.id.startsWith('folder:') || touched.has(folder)) folder.modified = latest(folder.children);
		return folder.modified;
	};
	roots.forEach(refresh);
}

/**
 * 관리자가 파일을 놓아 올릴 수 있는 폴더면 그 API 폴더 값: 문서 › 이력서 → 이력서, 프로젝트 › <프로젝트> → project:<id>.
 * 다른 폴더(사진 등)와 폴더가 아닌 항목은 null
 */
export function uploadFolderOf(item: FinderItem | null | undefined): DocumentFolderValue | null {
	if (!item || item.kind !== 'folder') return null;
	if (item.id === 'desktop') return DESKTOP_DOCUMENT_FOLDER;
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
			// 바탕화면의 가상본은 원래 폴더와 겹치므로 뺀다
			if (item.kind === 'alias') return;
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

const KIND_ORDER: FinderItem['kind'][] = ['folder', 'alias', 'doc', 'pdf', 'image', 'track', 'post', 'project', 'app'];

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
		// 올린 문서 파일(R2, id가 file:)만: 프로젝트의 사진 폴더 그림과 데이터로 만드는 이력서 PDF는 iCloud의 미리보기 폴더에 들어 있지 않다
		children: files(foldersOf(locations, ['desktop', 'docs']))
			.filter((item) => item.id.startsWith('file:') && !item.key.startsWith('resume-pdf:'))
			.sort((a, b) => a.name.localeCompare(b.name, 'ko')),
		emptyNote: '파일이 없습니다.',
	};
}
