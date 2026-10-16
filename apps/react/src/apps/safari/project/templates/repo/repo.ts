// repo 템플릿의 순수한 조각: 저장소 주소에서 owner와 이름, clone 주소, 가짜 커밋 해시, 진행 과정을 커밋으로(타입 뱃지 포함),
// 폴더 구조 글을 저장소 트리로, 구역을 나눠 담는 문서(README.md와 docs/*.md)와 그 마크다운 원문.
// 같은 내용이면 언제나 같은 결과가 나온다. 단위 시험은 repo.test.ts
import type { Landing, LandingSection, LandingSectionKind } from '@/apps/safari/project/landing';
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

/** GitHub가 언어마다 칠하는 점 색 (github-linguist의 색. 없는 언어는 languageColor가 이름으로 회색 계열을 고른다) */
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
	'Objective-C': '#438eff',
	Dart: '#00b4ab',
	Go: '#00add8',
	Rust: '#dea584',
	Ruby: '#701516',
	PHP: '#4f5d95',
	HTML: '#e34c26',
	CSS: '#663399',
	SCSS: '#c6538c',
	Sass: '#a53b70',
	Less: '#1d365d',
	Vue: '#41b883',
	Svelte: '#ff3e00',
	Astro: '#ff5a03',
	MDX: '#fcb32c',
	Shell: '#89e051',
	PowerShell: '#012456',
	Dockerfile: '#384d54',
	Makefile: '#427819',
	Prisma: '#0c344b',
	Lua: '#000080',
	'Jupyter Notebook': '#da5b0b',
	Solidity: '#aa6746',
	GLSL: '#5686a5',
	EJS: '#a91e50',
	Handlebars: '#f7931e',
	Pug: '#a86454',
};

/**
 * 언어의 점·막대 색. 표에 없는 언어는 이름으로 늘 같은 회색 계열(채도가 낮은 색)을 고르고,
 * GitHub가 작은 언어를 묶은 Other는 테마를 따르는 옅은 회색
 */
export function languageColor(name: string): string {
	if (name === 'Other') return 'var(--rp-lang-other)';
	const known = LANGUAGE_COLORS[name];
	if (known) return known;
	const hue = parseInt(fakeHash(name).slice(0, 4), 16) % 360;
	return `hsl(${hue} 12% 52%)`;
}

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

/* ─── 문서: 구역을 README.md와 docs/*.md로 나눈다 ─── */

/** 구역 종류마다의 문서 파일 이름과 아이콘 (숫자는 README 첫머리에 남는다) */
const DOC_FILES: Record<Exclude<LandingSectionKind, 'stats'>, { file: string; icon: string }> = {
	features: { file: 'FEATURES.md', icon: 'fa-solid fa-wand-magic-sparkles' },
	screens: { file: 'SCREENSHOTS.md', icon: 'fa-regular fa-images' },
	steps: { file: 'USAGE.md', icon: 'fa-solid fa-list-ol' },
	built: { file: 'ARCHITECTURE.md', icon: 'fa-solid fa-sitemap' },
	troubleshooting: { file: 'TROUBLESHOOTING.md', icon: 'fa-solid fa-bug' },
	stories: { file: 'STORIES.md', icon: 'fa-regular fa-comments' },
	controls: { file: 'CONTROLS.md', icon: 'fa-regular fa-keyboard' },
	timeline: { file: 'CHANGELOG.md', icon: 'fa-solid fa-tag' },
	tech: { file: 'TECH.md', icon: 'fa-solid fa-microchip' },
	team: { file: 'TEAM.md', icon: 'fa-solid fa-users' },
	role: { file: 'CONTRIBUTING.md', icon: 'fa-solid fa-user-check' },
	deployments: { file: 'DEPLOYMENT.md', icon: 'fa-solid fa-rocket' },
	credits: { file: 'CREDITS.md', icon: 'fa-solid fa-scale-balanced' },
};

/** README 박스의 문서 하나: 저장소 안의 경로, 탭 이름, 담는 구역 */
export interface RepoDoc {
	/** 'readme' 또는 구역 종류 */
	id: 'readme' | LandingSectionKind;
	/** 저장소 안의 경로 (['README.md'] 또는 ['docs', 'FEATURES.md']) */
	path: string[];
	/** 탭에 보이는 이름 (README 또는 구역 이름) */
	label: string;
	icon: string;
	/** 이 문서가 그리는 구역 (README는 숫자만) */
	sections: LandingSection[];
}

export const docPath = (doc: RepoDoc) => doc.path.join('/');

/** 구역 차례대로: README(큰 제목·소개·대표 화면·숫자·목차)는 언제나 먼저, 그 뒤로 내용이 있는 구역마다 docs/의 문서 하나 */
export function docsOf(landing: Landing): RepoDoc[] {
	const stats = landing.sections.filter((section) => section.kind === 'stats');
	const rest = landing.sections.filter((section) => section.kind !== 'stats');
	return [
		{ id: 'readme', path: ['README.md'], label: 'README', icon: 'fa-solid fa-book-open', sections: stats },
		...rest.map((section) => {
			const { file, icon } = DOC_FILES[section.kind as keyof typeof DOC_FILES];
			return { id: section.kind, path: ['docs', file], label: section.label, icon, sections: [section] };
		}),
	];
}

/** 구역 하나를 마크다운 원문으로 (터미널의 cat이 읽는 글) */
function sectionText(section: LandingSection): string[] {
	const lines = [`## ${section.label}`, ''];
	const points = (items: { title: string; body: string }[], numbered = false) =>
		items.map((point, i) => `${numbered ? `${i + 1}.` : '-'} **${point.title}** — ${point.body}`);
	switch (section.kind) {
		case 'stats':
			lines.push(...section.facts.map((fact) => `- **${fact.label}**: ${fact.value}`));
			break;
		case 'features':
		case 'built':
			lines.push(...points(section.items));
			break;
		case 'steps':
			lines.push(...points(section.items, true));
			break;
		case 'screens':
			lines.push(...section.shots.map((shot) => `- ${shot.caption}`));
			break;
		case 'stories':
			for (const story of section.stories) {
				lines.push(`### ${story.title}`, '');
				if (story.lead) lines.push(`> ${story.lead}`, '');
				lines.push(...story.facts.map((fact) => `- **${fact.label}**: ${fact.value}`));
				lines.push(...points(story.points), '');
			}
			break;
		case 'controls':
			lines.push(...section.controls.map((control) => `- \`${control.keys.join(' + ')}\` ${control.label}`));
			break;
		case 'timeline': {
			const tags = tagsOf(section.entries.length);
			lines.push(...section.entries.map((entry, i) => `- **${tags[i]}** (${entry.date}) ${entry.label}`).reverse());
			break;
		}
		case 'tech':
			if (section.stack.length) lines.push(`Built with ${section.stack.join(', ')}`, '');
			lines.push(...section.specs.map((spec) => `- **${spec.label}**: ${spec.value}`));
			if (section.structure) lines.push('', '```', section.structure.replace(/\s+$/, ''), '```');
			break;
		case 'role':
			if (section.role) lines.push(`- **역할**: ${section.role}`);
			if (section.context) lines.push(`- **프로젝트**: ${section.context}`);
			if (section.period) lines.push(`- **기간**: ${section.period}`);
			if (section.role || section.context || section.period) lines.push('');
			lines.push(...section.contributions.map((item) => `- [x] ${item}`));
			break;
		case 'troubleshooting':
			section.items.forEach((item, i) => {
				if (i > 0) lines.push('');
				lines.push(`### ${item.title}`, '');
				lines.push(`- **문제**: ${item.problem}`);
				if (item.cause) lines.push(`- **원인**: ${item.cause}`);
				lines.push(`- **해결**: ${item.solution}`);
				if (item.result) lines.push(`- **결과**: ${item.result}`);
			});
			break;
		case 'team':
			lines.push('| 이름 | 역할 |', '| --- | --- |');
			lines.push(
				...section.members.map(
					(member) =>
						`| ${member.url ? `[${member.name}](${member.url})` : member.name}${member.me ? ' (나)' : ''} | ${member.role} |`
				)
			);
			break;
		case 'deployments':
			lines.push(
				...section.items.map((item) => {
					const name = item.url ? `[${item.label}](${item.url})` : item.label;
					const extra = [item.platform, item.note].filter(Boolean).join(' — ');
					return `- ${name}${extra ? `: ${extra}` : ''}`;
				})
			);
			break;
		case 'credits':
			lines.push(
				...section.credits.map((credit) => `- ${credit.role}: ${credit.name}${credit.by ? ` (${credit.by})` : ''}`)
			);
			break;
	}
	while (lines[lines.length - 1] === '') lines.pop();
	return lines;
}

/** 문서의 마크다운 원문: README는 이름·한 줄·소개·숫자·목차, 다른 문서는 그 구역 */
export function docText(landing: Landing, doc: RepoDoc, docs: RepoDoc[] = docsOf(landing)): string {
	if (doc.id !== 'readme') return sectionText(doc.sections[0]).join('\n') + '\n';
	const { hero } = landing;
	const lines = [`# ${hero.name}`, ''];
	if (hero.headline !== hero.name) lines.push(`> ${hero.headline}`, '');
	if (hero.subhead) lines.push(hero.subhead, '');
	for (const section of doc.sections) lines.push(...sectionText(section), '');
	const others = docs.filter((other) => other.id !== 'readme');
	if (others.length) lines.push('## 목차', '', ...others.map((other) => `- [${other.label}](${docPath(other)})`));
	while (lines[lines.length - 1] === '') lines.pop();
	return lines.join('\n') + '\n';
}

/** 저장소 트리에 더할 문서 파일: README.md와 docs/ 폴더 (원문은 docText) */
export function docsTree(landing: Landing, docs: RepoDoc[] = docsOf(landing)): RepoDir {
	const tree: RepoDir = {};
	const folder: RepoDir = {};
	for (const doc of docs) {
		const text = docText(landing, doc, docs);
		if (doc.path.length === 1) tree[doc.path[0]] = text;
		else folder[doc.path[1]] = text;
	}
	if (Object.keys(folder).length) tree.docs = folder;
	return tree;
}

/** 저장소 트리에 문서 파일을 더한다: 같은 이름의 폴더는 합치고, 같은 이름의 파일은 문서가 이긴다 */
export function mergeTree(dir: RepoDir, extra: RepoDir): RepoDir {
	const out: RepoDir = { ...dir };
	for (const [name, node] of Object.entries(extra)) {
		const current = out[name];
		const both = typeof current === 'object' && current !== null && typeof node === 'object' && node !== null;
		out[name] = both ? { ...current, ...node } : node;
	}
	return out;
}
