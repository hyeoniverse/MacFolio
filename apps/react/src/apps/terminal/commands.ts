// 터미널 명령어. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 명령은 출력할 줄(lines)과 화면에서 실행할 효과(effects)를 돌려준다.
import { PROFILE, PROJECTS, SITE_STACK, SKILLS } from '@/shared/profile';
import type { AppName } from '@/apps/manifest';

/**
 * 출력 한 줄. 화면은 종류마다 다르게 그린다.
 * - pair: 이름 · 값 두 칸 (연속된 pair는 한 격자로 정렬되어 한글이 섞여도 줄이 맞는다)
 * - item: 번호 목록 (긴 설명은 번호 뒤에 맞춰 줄바꿈)
 */
export type Line =
	| { kind: 'text'; text: string }
	| { kind: 'heading'; text: string }
	| { kind: 'muted'; text: string }
	| { kind: 'error'; text: string }
	| { kind: 'link'; label: string; href: string }
	| { kind: 'pair'; key: string; value: string; href?: string }
	| { kind: 'item'; marker: string; title: string; detail?: string; tag?: string };

export type Effect =
	{ type: 'clear' } | { type: 'open-app'; app: AppName } | { type: 'open-url'; url: string } | { type: 'close' };

/** 화면에 그릴 묶음. 연속된 pair·item 줄은 한 묶음이 되어 한 격자(목록)로 그려진다. */
export type Block =
	| { type: 'pairs'; lines: Extract<Line, { kind: 'pair' }>[] }
	| { type: 'items'; lines: Extract<Line, { kind: 'item' }>[] }
	| { type: 'line'; line: Line };

/** 연속된 pair·item 줄을 묶는다. 터미널(격자)과 모바일 단축어(목록)가 함께 쓴다 */
export function toBlocks(lines: Line[]): Block[] {
	const blocks: Block[] = [];
	for (const line of lines) {
		const last = blocks.at(-1);
		if (line.kind === 'pair') {
			if (last?.type === 'pairs') last.lines.push(line);
			else blocks.push({ type: 'pairs', lines: [line] });
		} else if (line.kind === 'item') {
			if (last?.type === 'items') last.lines.push(line);
			else blocks.push({ type: 'items', lines: [line] });
		} else blocks.push({ type: 'line', line });
	}
	return blocks;
}

export interface CommandContext {
	/** 이전에 입력한 명령 (오래된 것부터) */
	history: string[];
	now: Date;
	/** open 명령으로 열 수 있는 앱 */
	apps: { name: AppName; label: string }[];
}

export interface CommandResult {
	lines: Line[];
	effects: Effect[];
}

interface Command {
	description: string;
	usage?: string;
	run: (args: string[], context: CommandContext) => CommandResult;
}

const text = (value: string): Line => ({ kind: 'text', text: value });
const heading = (value: string): Line => ({ kind: 'heading', text: value });
const muted = (value: string): Line => ({ kind: 'muted', text: value });
const error = (value: string): Line => ({ kind: 'error', text: value });
const pair = (key: string, value: string, href?: string): Line => ({ kind: 'pair', key, value, href });
const output = (lines: Line[], effects: Effect[] = []): CommandResult => ({ lines, effects });

const findApp = (query: string, context: CommandContext) => {
	const q = query.toLowerCase();
	return context.apps.find((app) => app.name === q || app.label.toLowerCase() === q);
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const two = (n: number) => String(n).padStart(2, '0');

export function formatDate(date: Date): string {
	return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]}) ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

export const COMMANDS: Record<string, Command> = {
	help: {
		description: '사용할 수 있는 명령어',
		run: () =>
			output([
				heading('사용할 수 있는 명령어'),
				...Object.entries(COMMANDS)
					.filter(([name]) => !HIDDEN.has(name))
					.map(([name, command]) => pair(command.usage ?? name, command.description)),
				muted('Tab으로 자동 완성, ↑↓로 이전 명령을 불러올 수 있어요.'),
			]),
	},
	whoami: {
		description: '저를 소개합니다',
		run: () =>
			output([
				heading(`${PROFILE.name} (${PROFILE.nameEn})`),
				pair('역할', PROFILE.role),
				pair('학교', PROFILE.school),
				pair('지역', PROFILE.location),
			]),
	},
	neofetch: {
		description: '이 사이트의 정보',
		run: () =>
			output([
				heading('guest@macfolio'),
				pair('OS', 'MacFolio (웹)'),
				pair('Shell', 'zsh (흉내)'),
				pair('Owner', `${PROFILE.name} · ${PROFILE.role}`),
				pair('Stack', SITE_STACK.join(', ')),
			]),
	},
	skills: {
		description: '다룰 수 있는 기술',
		run: () =>
			output([
				pair('프론트엔드', SKILLS.frontend.join(', ')),
				pair('백엔드', SKILLS.backend.join(', ')),
				pair('인터랙션', SKILLS.interaction.join(', ')),
				pair('이 사이트', SITE_STACK.join(', ')),
			]),
	},
	projects: {
		description: '프로젝트 목록',
		run: () =>
			output([
				...PROJECTS.map((project, index): Line => ({
					kind: 'item',
					marker: `${index + 1}.`,
					title: project.name,
					detail: project.description,
					tag: project.language,
				})),
				muted('자세히 보려면: project <번호>'),
			]),
	},
	project: {
		description: '프로젝트 자세히 보기',
		usage: 'project <번호>',
		run: ([arg]) => {
			const project = PROJECTS[Number(arg) - 1];
			if (!project) return output([error(`project: 1부터 ${PROJECTS.length} 사이의 번호를 입력하세요.`)]);
			return output([
				heading(project.name),
				pair('소개', project.description),
				pair('구분', project.context),
				...(project.role ? [pair('역할', project.role)] : []),
				pair('기술', project.stack.join(', ')),
				...(project.demo ? [pair('데모', project.demo, project.demo)] : []),
				pair('저장소', project.url, project.url),
			]);
		},
	},
	contact: {
		description: '연락하는 방법',
		run: () =>
			output([
				pair('GitHub', PROFILE.github, PROFILE.github),
				pair('이메일', PROFILE.email, `mailto:${PROFILE.email}`),
				pair('감상·피드백', 'open messages'),
				pair('메일 앱', 'open mail'),
			]),
	},
	open: {
		description: '앱 열기',
		usage: 'open <앱>',
		run: ([arg], context) => {
			if (!arg) return output([error('open: 열 앱을 입력하세요. 예: open memo')]);
			const app = findApp(arg, context);
			if (!app) {
				return output([
					error(`open: ${arg}: 앱을 찾을 수 없습니다.`),
					muted(`열 수 있는 앱: ${context.apps.map((a) => a.name).join(', ')}`),
				]);
			}
			return output([muted(`${app.label}을(를) 엽니다.`)], [{ type: 'open-app', app: app.name }]);
		},
	},
	history: {
		description: '입력한 명령 기록',
		run: (_, { history }) =>
			output(history.map((entry, index): Line => ({ kind: 'item', marker: `${index + 1}`, title: entry }))),
	},
	date: {
		description: '현재 시각',
		run: (_, { now }) => output([text(formatDate(now))]),
	},
	echo: {
		description: '입력한 글자를 그대로 출력',
		usage: 'echo <글자>',
		run: (args) => output([text(args.join(' '))]),
	},
	clear: {
		description: '화면 지우기',
		run: () => output([], [{ type: 'clear' }]),
	},
	exit: {
		description: '터미널 닫기',
		run: () => output([], [{ type: 'close' }]),
	},
	sudo: {
		description: '관리자 권한으로 실행',
		run: () => output([error('guest은(는) sudoers 파일에 없습니다. 이 일은 보고될 것입니다.')]),
	},
};

/** help에 보이지 않는 명령 */
const HIDDEN = new Set(['sudo']);

/** 입력을 명령 이름과 인자로 나눈다 (공백 기준) */
export function parse(input: string): { name: string; args: string[] } {
	const [name = '', ...args] = input.trim().split(/\s+/).filter(Boolean);
	return { name, args };
}

/** 명령 한 줄을 실행한다. 없는 명령이면 zsh처럼 알려준다. */
export function runCommand(input: string, context: CommandContext): CommandResult {
	const { name, args } = parse(input);
	if (!name) return output([]);
	const command = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : undefined;
	if (!command) {
		return output([
			error(`zsh: command not found: ${name}`),
			muted('help를 입력해 사용할 수 있는 명령어를 확인하세요.'),
		]);
	}
	return command.run(args, context);
}

/**
 * Tab 자동 완성. 후보가 하나면 완성한 값을, 여럿이면 공통 앞부분까지 채우고 후보 목록을 돌려준다.
 * 첫 단어는 명령어, open 뒤는 앱 이름, project 뒤는 번호를 완성한다.
 */
export function complete(input: string, context: CommandContext): { value: string; candidates: string[] } {
	const endsWithSpace = /\s$/.test(input);
	const words = input.trimStart().split(/\s+/);
	const current = endsWithSpace ? '' : (words.at(-1) ?? '');
	const position = endsWithSpace ? words.filter(Boolean).length : words.length - 1;
	const head = words[0];

	let pool: string[] = [];
	if (position === 0) pool = Object.keys(COMMANDS).filter((name) => !HIDDEN.has(name));
	else if (position === 1 && head === 'open') pool = context.apps.map((app) => app.name);
	else if (position === 1 && head === 'project') pool = PROJECTS.map((_, index) => String(index + 1));

	const candidates = pool.filter((option) => option.startsWith(current));
	if (candidates.length === 0) return { value: input, candidates: [] };

	const prefix = input.slice(0, input.length - current.length);
	if (candidates.length === 1) return { value: `${prefix}${candidates[0]} `, candidates: [] };

	// 후보들의 공통 앞부분까지 채운다
	let common = candidates[0];
	for (const option of candidates) while (!option.startsWith(common)) common = common.slice(0, -1);
	return { value: `${prefix}${common}`, candidates };
}
