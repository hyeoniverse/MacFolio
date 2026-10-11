// 터미널 페이지의 셸: 명령 표와 실행 규칙 (React 없음). 화면은 TerminalPage.tsx가 그린다.
// 페이지 명령(소개·숫자·진행 과정…)은 프로젝트에 그 내용이 있을 때만 생기고,
// 저장소 명령(ls·cd·tree·cat)은 terminalRepo.ts의 트리를 돌아본다. 트리가 없는 프로젝트는 맨 위의 가짜 파일만 보인다
import type { Project } from '@/shared/profile';
import {
	completePath,
	entries as listDir,
	isDir,
	nodeAt,
	resolve,
	treeLines,
	type RepoDir,
} from '@/apps/safari/project/terminalRepo';

/** 프롬프트의 사용자 이름 */
export const USER = 'user@hyeoniverse';

/** 저장소 이름 (프롬프트의 맨 위 폴더): GitHub 주소의 마지막 조각, 없으면 프로젝트 이름 */
export const repoName = (project: Project) =>
	project.url.replace(/\/+$/, '').split('/').pop() || project.name.replace(/\s+/g, '-');

/** 지금 폴더를 프롬프트 모양으로 (~/저장소/폴더) */
export const promptPath = (repo: string, cwd: string[]) => ['~', repo, ...cwd].join('/');

/** 저장소 트리(repo.json)가 있는 프로젝트. 다른 프로젝트는 빈 트리로 돈다 */
export const hasRepoTree = (project: Project) => project.id === 'devcourse';

/** 페이지 내용을 보여 주는 명령의 종류 (화면이 이 이름으로 결과 모양을 고른다) */
export type PageView = 'about' | 'stat' | 'log' | 'projects' | 'types' | 'build' | 'whoami' | 'stack';

/** 페이지 내용을 보여 주는 명령: 결과 구역의 이름(보조 기술·시험이 찾는 이름)과 함께 */
export type PageCommand = { name: string; aliases: string[]; help: string; label: string; view: PageView };

const ALL_PAGE_COMMANDS: (PageCommand & { has: (project: Project) => boolean })[] = [
	{ name: 'cat ABOUT.md', aliases: ['about'], help: '이 저장소 소개', label: '소개', view: 'about', has: () => true },
	{
		name: 'stat .',
		aliases: ['stat', 'info'],
		help: '기간과 숫자',
		label: '한눈에 보기',
		view: 'stat',
		has: () => true,
	},
	{
		name: 'git log --by-week',
		aliases: ['git log', 'log', 'weeks'],
		help: '주차별 기록',
		label: '진행 과정',
		view: 'log',
		has: (project) => Boolean(project.timeline?.length),
	},
	{
		name: 'projects',
		aliases: ['ls projects --long'],
		help: '직접 만든 실습 프로젝트',
		label: '주요 기능',
		view: 'projects',
		has: (project) => project.highlights.length > 0,
	},
	{
		name: 'git types',
		aliases: ['types', 'conventions'],
		help: '커밋 타입 컨벤션',
		label: '커밋 컨벤션',
		view: 'types',
		has: (project) => Boolean(project.conventions?.length),
	},
	{
		name: 'cat BUILD.md',
		aliases: ['build'],
		help: '만든 방식',
		label: '만든 방식',
		view: 'build',
		has: (project) => project.build.length > 0,
	},
	{
		name: 'whoami',
		aliases: ['me'],
		help: '맡은 일',
		label: '맡은 일',
		view: 'whoami',
		has: (project) => project.contributions.length > 0 || Boolean(project.role),
	},
	{
		name: 'cat stack.json',
		aliases: ['stack'],
		help: '기술 사양',
		label: '기술 사양',
		view: 'stack',
		has: (project) => project.specs.length > 0 || project.stack.length > 0,
	},
];

/** 이 프로젝트에 내용이 있는 페이지 명령만 (help에 보이는 순서) */
export const pageCommands = (project: Project): PageCommand[] =>
	ALL_PAGE_COMMANDS.filter((command) => command.has(project)).map(({ has: _has, ...command }) => command);

/** 저장소를 돌아보는 명령과 그 밖의 명령 (help에 보이는 순서) */
export const SHELL_COMMANDS: { name: string; help: string }[] = [
	{ name: 'ls', help: '폴더 안 보기 (ls Week02)' },
	{ name: 'cd', help: '폴더로 들어가기 (cd Week02/03, cd ..)' },
	{ name: 'tree', help: '폴더 구조를 두 단계까지' },
	{ name: 'cat', help: '파일 읽기 (cat Readme.md)' },
	{ name: 'pwd', help: '지금 폴더' },
	{ name: 'open', help: '저장소 링크' },
	{ name: 'history', help: '친 명령 목록' },
	{ name: 'clear', help: '화면 지우기 (Ctrl+L)' },
];

/** 맨 위 폴더에만 보이는, 페이지 내용을 담은 가짜 파일 → 그 파일을 읽는 명령 */
export const PAGE_FILES: Record<string, string> = {
	'ABOUT.md': 'cat ABOUT.md',
	'BUILD.md': 'cat BUILD.md',
	'stack.json': 'cat stack.json',
};

/** 칩으로 보여 주는 첫걸음 (프로젝트에 없는 명령은 뺀다) */
export const suggested = (project: Project, withRepo: boolean) => {
	const names = new Set(pageCommands(project).map((command) => command.name));
	const picks = ['help', 'stat .', 'projects', 'whoami', 'cat stack.json'].filter(
		(text) => text === 'help' || names.has(text)
	);
	return withRepo ? [...picks.slice(0, 3), 'ls', 'cd Week02', 'cat Readme.md', ...picks.slice(3)] : [...picks, 'ls'];
};

/** 대소문자와 빈칸 수를 가리지 않는다 */
export const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const findPage = (project: Project, input: string) => {
	const key = normalize(input);
	return pageCommands(project).find((command) =>
		[command.name, ...command.aliases].some((name) => normalize(name) === key)
	);
};

/** Tab이 채울 수 있는 명령 이름 (페이지 명령, help, 저장소 명령 순) */
export const commandNames = (project: Project) => [
	...pageCommands(project).map((command) => command.name),
	'help',
	...SHELL_COMMANDS.map((command) => command.name),
];

export const isClear = (text: string) => ['clear', 'cls'].includes(normalize(text));

/** 명령 하나의 결과 */
export type Output =
	| { kind: 'page'; command: PageCommand }
	| { kind: 'help' }
	| { kind: 'list'; path: string[]; items: { name: string; dir: boolean }[] }
	| { kind: 'tree'; lines: string[] }
	| { kind: 'file'; name: string; text: string | null }
	| { kind: 'text'; text: string }
	| { kind: 'error'; text: string }
	| { kind: 'links' }
	| { kind: 'history'; past: string[] };

/** 저장소가 필요 없는 명령의 결과 (아니면 null) */
export function runSimple(project: Project, text: string, cwd: string[], past: string[]): Output | null {
	const page = findPage(project, text);
	if (page) return { kind: 'page', command: page };
	const [name] = normalize(text).split(' ');
	if (name === 'help' || name === '?' || name === 'man') return { kind: 'help' };
	if (name === 'open') return { kind: 'links' };
	if (name === 'pwd') return { kind: 'text', text: promptPath(repoName(project), cwd) };
	if (name === 'history') return { kind: 'history', past };
	if (name === 'date') return { kind: 'text', text: new Date().toLocaleString('ko-KR') };
	if (name === 'sudo') return { kind: 'error', text: '이 터미널에서는 sudo를 쓸 수 없습니다' };
	return null;
}

/** 저장소를 돌아보는 명령의 결과와 옮겨 간 폴더 */
export function runRepo(repo: RepoDir, text: string, cwd: string[]): { output: Output; cwd: string[] } {
	const [name, ...rest] = text.trim().split(/\s+/);
	const arg = rest.join(' ');
	const command = name.toLowerCase();
	const where = arg ? resolve(repo, cwd, arg) : cwd;
	const missing = { kind: 'error', text: `${command}: ${arg}: 그런 파일이나 폴더가 없습니다` } as const;
	const listOf = (path: string[]): Output => {
		const dir = nodeAt(repo, path);
		const items = isDir(dir) ? listDir(dir) : [];
		// 맨 위에는 페이지 내용을 담은 파일도 보인다
		const extra = path.length === 0 ? Object.keys(PAGE_FILES).map((file) => ({ name: file, dir: false })) : [];
		return { kind: 'list', path, items: [...items, ...extra] };
	};
	switch (command) {
		case 'ls': {
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (!isDir(node)) return { output: { kind: 'text', text: where[where.length - 1] }, cwd };
			return { output: listOf(where), cwd };
		}
		case 'cd': {
			const next = arg ? where : [];
			if (!next) return { output: missing, cwd };
			if (!isDir(nodeAt(repo, next))) return { output: { kind: 'error', text: `cd: ${arg}: 폴더가 아닙니다` }, cwd };
			// 들어간 폴더의 내용을 바로 보여 준다 (cd 하고 ls 한 것처럼)
			return { output: listOf(next), cwd: next };
		}
		case 'tree': {
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (!isDir(node)) return { output: missing, cwd };
			return { output: { kind: 'tree', lines: ['.', ...treeLines(node, 2)] }, cwd };
		}
		case 'cat':
		case 'head':
		case 'less': {
			if (!arg) return { output: { kind: 'error', text: `${command}: 읽을 파일 이름을 넣어 주세요` }, cwd };
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (isDir(node)) return { output: { kind: 'error', text: `${command}: ${arg}: 폴더입니다` }, cwd };
			return { output: { kind: 'file', name: where[where.length - 1], text: node ?? null }, cwd };
		}
		default:
			return { output: { kind: 'error', text: `zsh: command not found: ${name}` }, cwd };
	}
}

/** Tab: 첫 낱말은 명령 이름, 그 뒤는 저장소 경로를 채운다 (채울 게 없으면 그대로) */
export function complete(project: Project, repo: RepoDir | null, cwd: string[], text: string): string {
	const space = text.indexOf(' ');
	if (space < 0) {
		const key = text.toLowerCase();
		return commandNames(project).find((name) => name.toLowerCase().startsWith(key)) ?? text;
	}
	if (!repo) return text;
	const command = text.slice(0, space + 1);
	return command + completePath(repo, cwd, text.slice(space + 1).trimStart());
}

/** 목록의 이름을 눌렀을 때 칠 명령: 맨 위의 가짜 파일은 그 페이지 명령, 폴더는 cd, 파일은 cat */
export function commandFor(name: string, dir: boolean, path: string[], cwd: string[]): string {
	const page = path.length === 0 ? PAGE_FILES[name] : undefined;
	const relative = [...path.slice(cwd.length), name].join('/');
	return page ?? (dir ? `cd ${relative}` : `cat ${relative}`);
}

/** git log 모양의 가짜 해시: 같은 글이면 늘 같은 일곱 자리 */
export function fakeHash(text: string): string {
	let hash = 2166136261;
	for (const char of text) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash.toString(16).padStart(8, '0').slice(0, 7);
}
