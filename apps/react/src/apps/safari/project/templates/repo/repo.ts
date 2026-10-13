// repo 템플릿의 순수한 조각: 저장소 주소에서 owner와 이름, clone 주소, 가짜 커밋 해시, 진행 과정을 커밋으로(타입 뱃지 포함),
// 폴더 구조 글을 저장소 트리로, 첫 화면 편집기에 쓰는 README 원문. 같은 내용이면 언제나 같은 결과가 나온다. 단위 시험은 repo.test.ts
import type { Landing } from '@/apps/safari/project/landing';
import type { RepoDir } from '@/apps/safari/project/terminalRepo';

/** git log 모양의 가짜 해시: 같은 글이면 늘 같은 일곱 자리 */
export function fakeHash(text: string): string {
	let hash = 2166136261;
	for (const char of text) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return hash.toString(16).padStart(8, '0').slice(0, 7);
}

/** GitHub 주소의 owner와 저장소 이름. GitHub 주소가 아니면 owner 없이 이름만 (주소의 마지막 조각, 없으면 프로젝트 이름) */
export function repoOf(href: string | undefined, name: string): { owner?: string; name: string } {
	const url = (href ?? '').replace(/\/+$/, '').replace(/\.git$/, '');
	const match = /github\.com\/([^/]+)\/([^/]+)$/.exec(url);
	if (match) return { owner: match[1], name: match[2] };
	const last = url.split('/').pop();
	return { name: last || name.trim().replace(/\s+/g, '-') };
}

/** clone 주소 (GitHub 주소면 .git을 붙인다) */
export const cloneUrl = (href: string) => {
	const url = href.replace(/\/+$/, '');
	return /github\.com\/[^/]+\/[^/]+$/.test(url) && !url.endsWith('.git') ? `${url}.git` : url;
};

/** GitHub가 언어마다 칠하는 점 색 (없는 언어는 강조색) */
export const LANGUAGE_COLORS: Record<string, string> = {
	JavaScript: '#f1e05a',
	TypeScript: '#3178c6',
	'C#': '#178600',
	'C++': '#f34b7d',
	C: '#555555',
	Python: '#3572a5',
	Java: '#b07219',
	Kotlin: '#a97bff',
	Swift: '#f05138',
	Dart: '#00b4ab',
	Go: '#00add8',
	Rust: '#dea584',
	HTML: '#e34c26',
	CSS: '#663399',
	SCSS: '#c6538c',
	Vue: '#41b883',
	Shell: '#89e051',
};

/** 파일 이름으로 아이콘 (폴더·글·그림·코드) */
export const fileIcon = (name: string, dir: boolean, open = false) => {
	if (dir) return open ? 'fa-regular fa-folder-open' : 'fa-solid fa-folder';
	if (/\.(md|txt)$/i.test(name)) return 'fa-regular fa-file-lines';
	if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) return 'fa-regular fa-file-image';
	if (/\.(js|ts|jsx|tsx|css|html|json|mjs|cjs|py|java|cs|sh|ya?ml)$/i.test(name)) return 'fa-regular fa-file-code';
	return 'fa-regular fa-file';
};

/** 커밋 타입의 색상(hue): 타입 이름으로 늘 같은 색 (규칙 표·커밋 목록·서랍이 같이 쓴다) */
export const typeStyle = (type: string) =>
	({ '--rp-hue': parseInt(fakeHash(type).slice(0, 3), 16) % 360 }) as Record<string, number>;

/* ─── 커밋 ─── */

/** 커밋 규칙이 없는 프로젝트가 쓰는 타입 (Conventional Commits) */
export const DEFAULT_TYPES = ['feat', 'fix', 'docs', 'design', 'refactor', 'chore'];

/** 진행 과정 한 줄에 어울리는 커밋 타입의 실마리 */
const TYPE_HINTS: [string, RegExp][] = [
	['project', /보드|스토어|쇼핑몰|프로젝트|출시|배포/],
	['example', /예제/],
	['design', /디자인|시안|화면 설계/],
	['docs', /정리|이해|환경|문서|라이선스|노트|회고|발표|정하기|인터뷰/],
	['practice', /기초|API|실습|데모|연습/],
	['test', /테스트|시험|시범/],
	['fix', /수정|고침|버그|반영/],
	['refactor', /리팩|정돈/],
	['feat', /기능|추가|구현|흐름|알림/],
];

/** 말에 실마리가 있으면 그 타입, 아니면 해시로 고른다 (주어진 타입 가운데에서만) */
export function commitType(label: string, types: string[]): string | undefined {
	if (types.length === 0) return undefined;
	const hint = TYPE_HINTS.find(([type, pattern]) => types.includes(type) && pattern.test(label));
	return hint ? hint[0] : types[parseInt(fakeHash(label).slice(0, 4), 16) % types.length];
}

export interface Commit {
	hash: string;
	date: string;
	message: string;
	type?: string;
}

/** 진행 과정 → 커밋 목록 (오래된 것부터). 커밋 규칙이 있으면 그 타입, 없으면 기본 타입으로 뱃지를 단다 */
export function commitsOf(entries: { date: string; label: string }[], conventions: { type: string }[] = []): Commit[] {
	const types = conventions.length ? conventions.map((convention) => convention.type) : DEFAULT_TYPES;
	return entries.map((entry) => ({
		hash: fakeHash(entry.date + entry.label),
		date: entry.date,
		message: entry.label,
		type: commitType(entry.label, types),
	}));
}

/** 진행 과정의 걸음마다 붙이는 태그 이름: 오래된 것부터 v0.1.0, v0.2.0 … 마지막은 v1.0.0 */
export function tagsOf(count: number): string[] {
	return Array.from({ length: count }, (_, i) => (i === count - 1 ? 'v1.0.0' : `v0.${i + 1}.0`));
}

/* ─── 폴더 구조 ─── */

export interface TreeRow {
	depth: number;
	name: string;
	note?: string;
	folder: boolean;
}

/** 줄 앞의 트리 그림 글자 (├── │ └──)와 공백 */
const PREFIX = /^[\s│├└─|`+\\-]*/;

/** `tree` 명령 모양의 글 → 줄 목록. 앞의 그림 글자 너비(4칸에 한 단계)로 깊이를, 이름 뒤의 `#`·`//`로 설명을 나눈다 */
export function parseTree(text: string): TreeRow[] {
	const rows = text
		.split('\n')
		.map((line) => line.replace(/\s+$/, ''))
		.filter((line) => line.trim())
		.map((line) => {
			const prefix = PREFIX.exec(line)?.[0] ?? '';
			const rest = line.slice(prefix.length);
			const split = /\s+(#|\/\/)\s?(.*)$/.exec(rest);
			const name = (split ? rest.slice(0, split.index) : rest).trim();
			const note = split?.[2]?.trim();
			return { depth: Math.round(prefix.length / 4), name, ...(note ? { note } : {}), folder: name.endsWith('/') };
		});
	return rows.map((row, i) => (rows[i + 1] && rows[i + 1].depth > row.depth ? { ...row, folder: true } : row));
}

/** 저장소 트리와 이름마다의 설명 (경로 → 설명) */
export interface StructureRepo {
	dir: RepoDir;
	notes: Record<string, string>;
}

/**
 * 폴더 구조 글 → 저장소 트리. 폴더는 객체, 파일은 설명 글(없으면 빈 글). 맨 위가 폴더 하나뿐이면(저장소 자신) 벗겨 낸다.
 * `scripts/progress.py`처럼 경로가 붙은 이름은 폴더를 거쳐 넣는다
 */
export function structureRepo(text: string): StructureRepo {
	let rows = parseTree(text);
	const roots = rows.filter((row) => row.depth === 0);
	if (roots.length === 1 && roots[0].folder && rows[0] === roots[0] && rows.length > 1)
		rows = rows.slice(1).map((row) => ({ ...row, depth: Math.max(0, row.depth - 1) }));
	const dir: RepoDir = {};
	const notes: Record<string, string> = {};
	const stack: { depth: number; path: string[] }[] = [];
	for (const row of rows) {
		while (stack.length && stack[stack.length - 1].depth >= row.depth) stack.pop();
		const base = stack.length ? stack[stack.length - 1].path : [];
		const parts = row.name.replace(/\/+$/, '').split('/').filter(Boolean);
		if (!parts.length) continue;
		let at = dir;
		for (const part of base) at = at[part] as RepoDir;
		const path = [...base];
		parts.forEach((part, i) => {
			path.push(part);
			const last = i === parts.length - 1;
			if (!last || row.folder) {
				const next = at[part];
				if (typeof next !== 'object' || next === null) at[part] = {};
				at = at[part] as RepoDir;
			} else if (at[part] === undefined) at[part] = row.note ?? '';
		});
		if (row.note) notes[path.join('/')] = row.note;
		if (row.folder) stack.push({ depth: row.depth, path });
	}
	return { dir, notes };
}

/* ─── 첫 화면 편집기의 README 원문 ─── */

/** 편집기에 보이는 README.md 원문: 이름, 한 줄, 소개, 주요 기능 목록, 쓰는 법, clone 명령 */
export function readmeSource(landing: Landing, clone?: string): string[] {
	const { hero } = landing;
	const lines = [`# ${hero.name}`, ''];
	if (hero.headline !== hero.name) lines.push(`> ${hero.headline}`, '');
	if (hero.subhead) lines.push(hero.subhead, '');
	const features = landing.sections.find((section) => section.kind === 'features');
	if (features?.kind === 'features') {
		lines.push('## 주요 기능', '');
		for (const point of features.items.slice(0, 4)) lines.push(`- **${point.title}** — ${point.body}`);
		lines.push('');
	}
	const steps = landing.sections.find((section) => section.kind === 'steps');
	if (steps?.kind === 'steps') {
		lines.push('## 쓰는 법', '');
		steps.items.slice(0, 3).forEach((point, i) => lines.push(`${i + 1}. ${point.title}`));
		lines.push('');
	}
	if (clone) lines.push('## 시작하기', '', '```sh', `git clone ${clone}`, '```');
	while (lines[lines.length - 1] === '') lines.pop();
	return lines;
}
