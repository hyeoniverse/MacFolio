// 이력서 Markdown 한 장을 읽어 PDF·터미널이 그릴 모양으로 바꾼다. React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 이력서의 원본은 이 Markdown 하나다 (관리자가 Finder에서 고치고 서버에 저장한다). 쓰는 규칙:
//
//   # 이름
//   **직함**
//   > 한 줄 소개
//   연락처 · 연락처 · …                         (첫 ## 앞의 나머지 줄)
//
//   ## 절 제목
//   - **제목** — 설명 `기술` `기술`              제목·설명 목록 (끝의 `코드`는 기술 칩)
//   - **제목** | 날짜 — 설명                      날짜가 있으면 오른쪽에 날짜를 둔 줄
//   ### [프로젝트](#project/id) | 기간 | 구분      ###이 있는 절은 프로젝트: 설명 한 줄, `기술` 줄, - 성과 목록
//
// 첫 절이 날짜 없는 목록이면 강점 카드로 그린다.

/** Finder 안의 이력서 문서 경로 (저장소 문서와 겹치지 않는 이름) */
export const RESUME_DOC = 'resume.md';

/** 프로젝트 링크의 앞부분. 누르면 Safari의 그 프로젝트를 연다 (DocView) */
export const PROJECT_LINK = '#project/';

/** 링크가 가리키는 프로젝트 id. 프로젝트 링크가 아니면 null */
export const projectLinkId = (href: string): string | null =>
	href.startsWith(PROJECT_LINK) ? decodeURIComponent(href.slice(PROJECT_LINK.length)) || null : null;

export interface ResumeEntry {
	title: string;
	/** 프로젝트 링크의 id (제목이 [이름](#project/id)이면) */
	projectId?: string;
	/** '| 날짜'로 적은 값 */
	period?: string;
	detail?: string;
	/** 끝에 `코드`로 적은 기술 */
	tools: string[];
}

export interface ResumeProject {
	name: string;
	projectId?: string;
	/** ### 머리 줄의 | 뒤 값들 (보통 기간, 구분) */
	meta: string[];
	description: string;
	/** 설명 안의 https 주소 (PDF에서 링크로) */
	url?: string;
	stack: string[];
	bullets: { title: string; detail: string }[];
}

export type ResumeSection =
	| { kind: 'cards' | 'list' | 'rows'; title: string; entries: ResumeEntry[] }
	| { kind: 'projects'; title: string; projects: ResumeProject[] }
	| { kind: 'text'; title: string; lines: string[] };

export interface Resume {
	name: string;
	role: string;
	motto: string;
	contact: string[];
	sections: ResumeSection[];
}

const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;
const TOOLS = /((?:\s*`[^`]+`)+)\s*$/;

/** [이름](#project/id) → 이름과 id. 다른 Markdown 강조는 벗긴다 */
function label(raw: string): { text: string; projectId?: string } {
	const value = raw.trim().replace(/^\*\*(.+)\*\*$/, '$1');
	const link = LINK.exec(value);
	if (!link) return { text: plain(value) };
	return { text: plain(link[1]), projectId: projectLinkId(link[2]) ?? undefined };
}

/** 굵게·기울임·링크 표시를 벗긴 글자 */
const plain = (value: string) =>
	value
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/(^|\s)_([^_]+)_(?=\s|$)/g, '$1$2')
		.trim();

/** 줄 끝의 `기술` `기술`을 떼어 낸다 */
function splitTools(value: string): { rest: string; tools: string[] } {
	const match = TOOLS.exec(value);
	if (!match) return { rest: value.trim(), tools: [] };
	return {
		rest: value.slice(0, match.index).trim(),
		tools: [...match[1].matchAll(/`([^`]+)`/g)].map((tool) => tool[1].trim()),
	};
}

/** - **제목** | 날짜 — 설명 `기술` (제목만, 설명만인 줄도 받는다) */
function entry(line: string): ResumeEntry {
	const { rest, tools } = splitTools(line);
	const bold = /^\*\*(.+?)\*\*(.*)$/.exec(rest);
	const head = bold ? bold[1] : '';
	let tail = bold ? bold[2] : rest;
	let period: string | undefined;
	const periodMatch = /^\s*\|\s*([^—]+?)\s*(?:—\s*(.*))?$/.exec(tail);
	if (bold && periodMatch) {
		period = periodMatch[1].trim();
		tail = periodMatch[2] ?? '';
	} else tail = tail.replace(/^\s*—\s*/, '');
	const name = head ? label(head) : { text: plain(tail) };
	return {
		title: name.text,
		...(name.projectId ? { projectId: name.projectId } : {}),
		...(period ? { period } : {}),
		...(head && tail.trim() ? { detail: plain(tail) } : {}),
		tools,
	};
}

/** ### 머리 줄 아래의 줄들 → 프로젝트 */
function project(head: string, body: string[]): ResumeProject {
	const [first, ...meta] = head.split('|').map((part) => part.trim());
	const name = label(first);
	const result: ResumeProject = {
		name: name.text,
		...(name.projectId ? { projectId: name.projectId } : {}),
		meta: meta.filter(Boolean),
		description: '',
		stack: [],
		bullets: [],
	};
	const description: string[] = [];
	for (const line of body) {
		if (line.startsWith('- ')) {
			const item = entry(line.slice(2));
			result.bullets.push({ title: item.title, detail: item.detail ?? '' });
		} else if (/^(`[^`]+`\s*)+$/.test(line)) result.stack.push(...splitTools(line).tools);
		else description.push(line);
	}
	const text = description.join(' ');
	const url = /https:\/\/\S+/.exec(text)?.[0];
	result.description = plain(url ? text.replace(url, '') : text);
	if (url) result.url = url;
	return result;
}

/** 이력서 Markdown → 그릴 모양. 규칙에 맞지 않는 줄도 버리지 않고 글 절(text)로 남긴다 */
export function parseResume(markdown: string): Resume {
	const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
	const resume: Resume = { name: '', role: '', motto: '', contact: [], sections: [] };
	let index = 0;

	// 머리: 첫 ## 앞
	for (; index < lines.length && !lines[index].startsWith('## '); index++) {
		const line = lines[index].trim();
		if (!line) continue;
		if (line.startsWith('# ')) resume.name = plain(line.slice(2));
		else if (/^\*\*.+\*\*$/.test(line) && !resume.role) resume.role = plain(line);
		else if (line.startsWith('>')) resume.motto = plain(line.replace(/^>\s*/, ''));
		else
			resume.contact.push(
				...line
					.split(/\s+·\s+/)
					.map(plain)
					.filter(Boolean)
			);
	}

	// 절: ## 마다
	while (index < lines.length) {
		const title = plain(lines[index].slice(3));
		const body: string[] = [];
		for (index++; index < lines.length && !lines[index].startsWith('## '); index++) {
			const line = lines[index].trim();
			if (line) body.push(line);
		}
		if (body.some((line) => line.startsWith('### '))) {
			const projects: ResumeProject[] = [];
			let head: string | null = null;
			let block: string[] = [];
			for (const line of body) {
				if (line.startsWith('### ')) {
					if (head !== null) projects.push(project(head, block));
					head = line.slice(4);
					block = [];
				} else if (head !== null) block.push(line);
			}
			if (head !== null) projects.push(project(head, block));
			resume.sections.push({ kind: 'projects', title, projects });
		} else if (body.length && body.every((line) => line.startsWith('- '))) {
			const entries = body.map((line) => entry(line.slice(2)));
			const kind = entries.some((item) => item.period) ? 'rows' : resume.sections.length === 0 ? 'cards' : 'list';
			resume.sections.push({ kind, title, entries });
		} else resume.sections.push({ kind: 'text', title, lines: body.map(plain) });
	}
	return resume;
}
