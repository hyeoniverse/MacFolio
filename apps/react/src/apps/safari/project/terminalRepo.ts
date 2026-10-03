// DevCourse 터미널이 돌아보는 저장소: 폴더는 객체, 글 파일은 내용, 그림 같은 파일은 null.
// 저장소 파일은 scripts/devcourse-repo.mjs로 만들고, 처음 쓸 때 한 번만 불러온다.

export type RepoDir = { [name: string]: RepoNode };
export type RepoNode = RepoDir | string | null;

export const REPO_URL = '/imgs/projects/devcourse/repo.json';

let cache: Promise<RepoDir> | null = null;

/** 저장소를 한 번만 불러온다 (실패하면 다음에 다시 시도) */
export function loadRepo(fetcher: typeof fetch = fetch): Promise<RepoDir> {
	cache ??= fetcher(REPO_URL)
		.then((response) => {
			if (!response.ok) throw new Error(`저장소를 불러오지 못했습니다 (${response.status})`);
			return response.json() as Promise<RepoDir>;
		})
		.catch((error: unknown) => {
			cache = null;
			throw error;
		});
	return cache;
}

export const isDir = (node: RepoNode | undefined): node is RepoDir => typeof node === 'object' && node !== null;

/**
 * 지금 폴더(cwd)에서 경로를 따라간 절대 경로(이름 배열). 없는 곳이면 null.
 * `~`·`/`는 맨 위, `..`는 한 칸 위, 이름은 대소문자를 가리지 않고 찾는다
 */
export function resolve(repo: RepoDir, cwd: string[], target: string): string[] | null {
	const raw = target.trim();
	const parts = raw.replace(/\/+$/, '');
	let at = raw.startsWith('/') || raw.startsWith('~') ? [] : [...cwd];
	for (const part of parts.replace(/^[~/]+/, '').split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			at = at.slice(0, -1);
			continue;
		}
		const dir = nodeAt(repo, at);
		if (!isDir(dir)) return null;
		const name =
			dir[part] !== undefined ? part : Object.keys(dir).find((key) => key.toLowerCase() === part.toLowerCase());
		if (name === undefined) return null;
		at = [...at, name];
	}
	return at;
}

export function nodeAt(repo: RepoDir, path: string[]): RepoNode | undefined {
	let node: RepoNode | undefined = repo;
	for (const name of path) {
		if (!isDir(node)) return undefined;
		node = node[name];
	}
	return node;
}

/** 폴더 먼저, 그 안에서는 이름순 */
export function entries(dir: RepoDir): { name: string; dir: boolean }[] {
	return Object.keys(dir)
		.map((name) => ({ name, dir: isDir(dir[name]) }))
		.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
}

/** tree: 정해진 깊이까지 줄마다 가지 모양을 붙인다 */
export function treeLines(dir: RepoDir, depth: number, prefix = ''): string[] {
	const list = entries(dir);
	return list.flatMap((entry, i) => {
		const last = i === list.length - 1;
		const line = `${prefix}${last ? '└── ' : '├── '}${entry.name}${entry.dir ? '/' : ''}`;
		const child = dir[entry.name];
		if (!entry.dir || depth <= 1 || !isDir(child)) return [line];
		return [line, ...treeLines(child, depth - 1, `${prefix}${last ? '    ' : '│   '}`)];
	});
}

/** 경로의 마지막 조각을 Tab으로 채운다. 하나만 맞으면 그 이름(폴더면 /까지), 여럿이면 겹치는 앞부분 */
export function completePath(repo: RepoDir, cwd: string[], partial: string): string {
	const cut = partial.lastIndexOf('/');
	const head = cut >= 0 ? partial.slice(0, cut + 1) : '';
	const tail = partial.slice(cut + 1).toLowerCase();
	const base = head ? resolve(repo, cwd, head) : cwd;
	const dir = base && nodeAt(repo, base);
	if (!isDir(dir)) return partial;
	const matches = entries(dir).filter((entry) => entry.name.toLowerCase().startsWith(tail));
	if (matches.length === 0) return partial;
	if (matches.length === 1) return `${head}${matches[0].name}${matches[0].dir ? '/' : ''}`;
	let common = matches[0].name;
	for (const { name } of matches) {
		while (!name.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1);
	}
	return common.length > tail.length ? `${head}${common}` : partial;
}
