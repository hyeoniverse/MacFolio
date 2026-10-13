// repo 템플릿의 터미널 서랍이 쓰는 셸: 명령 표와 실행 규칙 (React 없음). 화면은 Terminal.tsx가 그린다.
// 페이지 명령(소개·숫자·진행 과정…)은 랜딩 내용에 그 구역이 있을 때만 생기고,
// 저장소 명령(ls·cd·tree·cat)은 저장소 트리(DevCourse의 repo.json, 다른 프로젝트는 폴더 구조로 만든 트리)를 돌아본다
import type { Landing, LandingSectionKind } from '@/apps/safari/project/landing';
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

/** 지금 폴더를 프롬프트 모양으로 (~/저장소/폴더) */
export const promptPath = (repo: string, cwd: string[]) => ['~', repo, ...cwd].join('/');

/** 셸이 읽는 내용: 랜딩 내용과 커밋 규칙 */
export interface ShellData {
	landing: Landing;
	conventions: { type: string; description: string }[];
}

/** 페이지 내용을 보여 주는 명령의 종류 (화면이 이 이름으로 결과 모양을 고른다) */
export type PageView = 'about' | 'stat' | 'log' | 'features' | 'types' | 'build' | 'whoami' | 'stack';

/** 페이지 내용을 보여 주는 명령 */
export type PageCommand = { name: string; aliases: string[]; help: string; view: PageView };

const has = (data: ShellData, kind: LandingSectionKind) =>
	data.landing.sections.some((section) => section.kind === kind);

const ALL_PAGE_COMMANDS: (PageCommand & { has: (data: ShellData) => boolean })[] = [
	{ name: 'cat ABOUT.md', aliases: ['about'], help: '이 저장소를 소개합니다.', view: 'about', has: () => true },
	{ name: 'stat .', aliases: ['stat', 'info'], help: '기간과 숫자를 보여 줍니다.', view: 'stat', has: () => true },
	{
		name: 'git log',
		aliases: ['log', 'git log --oneline'],
		help: '진행 과정을 커밋으로 보여 줍니다.',
		view: 'log',
		has: (data) => has(data, 'timeline'),
	},
	{
		name: 'ls features',
		aliases: ['features'],
		help: '주요 기능을 보여 줍니다.',
		view: 'features',
		has: (data) => has(data, 'features'),
	},
	{
		name: 'git types',
		aliases: ['types', 'conventions'],
		help: '커밋 규칙을 보여 줍니다.',
		view: 'types',
		has: (data) => data.conventions.length > 0,
	},
	{
		name: 'cat BUILD.md',
		aliases: ['build'],
		help: '만든 방식을 보여 줍니다.',
		view: 'build',
		has: (data) => has(data, 'built'),
	},
	{ name: 'whoami', aliases: ['me'], help: '맡은 일을 보여 줍니다.', view: 'whoami', has: (data) => has(data, 'role') },
	{
		name: 'cat stack.json',
		aliases: ['stack'],
		help: '기술 사양을 보여 줍니다.',
		view: 'stack',
		has: (data) => has(data, 'tech'),
	},
];

/** 이 프로젝트에 내용이 있는 페이지 명령만 (help에 보이는 차례) */
export const pageCommands = (data: ShellData): PageCommand[] =>
	ALL_PAGE_COMMANDS.filter((command) => command.has(data)).map(({ has: _has, ...command }) => command);

/** 저장소를 돌아보는 명령과 그 밖의 명령 (help에 보이는 차례) */
export const SHELL_COMMANDS: { name: string; help: string }[] = [
	{ name: 'ls', help: '폴더 안을 봅니다.' },
	{ name: 'cd', help: '폴더로 들어갑니다. cd ..는 한 칸 위입니다.' },
	{ name: 'tree', help: '폴더 구조를 두 단계까지 봅니다.' },
	{ name: 'cat', help: '파일을 읽습니다.' },
	{ name: 'pwd', help: '지금 폴더를 봅니다.' },
	{ name: 'open', help: '저장소 링크를 봅니다.' },
	{ name: 'history', help: '친 명령을 다시 봅니다.' },
	{ name: 'clear', help: '화면을 지웁니다. Ctrl+L도 됩니다.' },
];

/** 맨 위 폴더에만 보이는, 페이지 내용을 담은 가짜 파일 → 그 파일을 읽는 명령 */
const PAGE_FILES: Record<string, PageView> = {
	'ABOUT.md': 'about',
	'BUILD.md': 'build',
	'stack.json': 'stack',
};

/** 맨 위에 보이는 가짜 파일 (그 페이지 명령이 있는 것만) */
const pageFiles = (data: ShellData) => {
	const views = new Set(pageCommands(data).map((command) => command.view));
	return Object.keys(PAGE_FILES).filter((file) => views.has(PAGE_FILES[file]));
};

/** 칩으로 보여 주는 첫걸음 (프로젝트에 없는 명령은 뺀다) */
export const suggested = (data: ShellData, withTree: boolean) => {
	const names = new Set(pageCommands(data).map((command) => command.name));
	const picks = ['help', 'stat .', 'ls features', 'git log', 'whoami', 'cat stack.json'].filter(
		(text) => text === 'help' || names.has(text)
	);
	return withTree ? [...picks.slice(0, 3), 'ls', 'tree', ...picks.slice(3)] : picks;
};

/** 대소문자와 빈칸 수를 가리지 않는다 */
export const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const findPage = (data: ShellData, input: string) => {
	const key = normalize(input);
	return pageCommands(data).find((command) =>
		[command.name, ...command.aliases].some((name) => normalize(name) === key)
	);
};

/** Tab이 채울 수 있는 명령 이름 (페이지 명령, help, 저장소 명령 차례) */
export const commandNames = (data: ShellData) => [
	...pageCommands(data).map((command) => command.name),
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
export function runSimple(data: ShellData, repo: string, text: string, cwd: string[], past: string[]): Output | null {
	const page = findPage(data, text);
	if (page) return { kind: 'page', command: page };
	const [name] = normalize(text).split(' ');
	if (name === 'help' || name === '?' || name === 'man') return { kind: 'help' };
	if (name === 'open') return { kind: 'links' };
	if (name === 'pwd') return { kind: 'text', text: promptPath(repo, cwd) };
	if (name === 'history') return { kind: 'history', past };
	if (name === 'date') return { kind: 'text', text: new Date().toLocaleString('ko-KR') };
	if (name === 'sudo') return { kind: 'error', text: '이 터미널에서는 sudo를 쓸 수 없습니다.' };
	return null;
}

/** 저장소를 돌아보는 명령의 결과와 옮겨 간 폴더 */
export function runRepo(
	data: ShellData,
	repo: RepoDir,
	text: string,
	cwd: string[]
): { output: Output; cwd: string[] } {
	const [name, ...rest] = text.trim().split(/\s+/);
	const arg = rest.join(' ');
	const command = name.toLowerCase();
	const where = arg ? resolve(repo, cwd, arg) : cwd;
	const missing = { kind: 'error', text: `${command}: ${arg}: 그런 파일이나 폴더가 없습니다.` } as const;
	const listOf = (path: string[]): Output => {
		const dir = nodeAt(repo, path);
		const items = isDir(dir) ? listDir(dir) : [];
		// 맨 위에는 페이지 내용을 담은 파일도 보인다
		const extra = path.length === 0 ? pageFiles(data).map((file) => ({ name: file, dir: false })) : [];
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
			if (!isDir(nodeAt(repo, next))) return { output: { kind: 'error', text: `cd: ${arg}: 폴더가 아닙니다.` }, cwd };
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
			if (!arg) return { output: { kind: 'error', text: `${command}: 읽을 파일 이름을 넣어 주세요.` }, cwd };
			if (!where) return { output: missing, cwd };
			const node = nodeAt(repo, where);
			if (isDir(node)) return { output: { kind: 'error', text: `${command}: ${arg}: 폴더입니다.` }, cwd };
			return { output: { kind: 'file', name: where[where.length - 1], text: node ?? null }, cwd };
		}
		default:
			return { output: { kind: 'error', text: `zsh: command not found: ${name}` }, cwd };
	}
}

/** Tab: 첫 낱말은 명령 이름, 그 뒤는 저장소 경로를 채운다 (채울 게 없으면 그대로) */
export function complete(data: ShellData, repo: RepoDir | null, cwd: string[], text: string): string {
	const space = text.indexOf(' ');
	if (space < 0) {
		const key = text.toLowerCase();
		return commandNames(data).find((name) => name.toLowerCase().startsWith(key)) ?? text;
	}
	if (!repo) return text;
	const command = text.slice(0, space + 1);
	return command + completePath(repo, cwd, text.slice(space + 1).trimStart());
}

/** 목록의 이름을 눌렀을 때 칠 명령: 맨 위의 가짜 파일은 그 페이지 명령, 폴더는 cd, 파일은 cat */
export function commandFor(data: ShellData, name: string, dir: boolean, path: string[], cwd: string[]): string {
	const view = path.length === 0 ? PAGE_FILES[name] : undefined;
	const page = view && pageCommands(data).find((command) => command.view === view);
	const relative = [...path.slice(cwd.length), name].join('/');
	return page ? page.name : dir ? `cd ${relative}` : `cat ${relative}`;
}
