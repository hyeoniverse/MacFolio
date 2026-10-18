// Finder의 폴더 구조 (관리자만 바꾼다). 누구나 같은 구조를 본다: 관리자가 만든 폴더, 옮긴 파일, 바탕화면의 가상본.
// 파일(R2)은 그대로 두고 "보이는 자리"만 적는다: 문서 표(Document)의 폴더와 R2 키는 바꾸지 않는다.
// 블로그 글·블로그 폴더는 여기 없다: 메모의 정리 내용(/memo/organization)이 맡는다 (Finder에서 옮겨도 그쪽에 저장한다).
import { z } from 'zod';
import { requestBody } from './parse.js';

/** 관리자가 만든 폴더 id: folder:<무작위 소문자·숫자> */
export const FINDER_FOLDER_ID = /^folder:[a-z0-9]{4,24}$/;
/**
 * 관리자 폴더·파일을 둘 수 있는 기본 폴더: 데스크탑, 문서, 문서의 이력서·포트폴리오·자격증, 프로젝트마다의 폴더.
 * 프로젝트 맨 위(projects)·블로그·응용 프로그램·사진 폴더에는 둘 수 없다
 */
export const FINDER_BUILTIN_PARENT =
	/^(desktop|docs|docs:(이력서|포트폴리오|자격증)|projects\/[a-z0-9][a-z0-9-]{0,39})$/;
/** 옮긴 파일의 Finder id: file:<R2 키> (예: file:resume/abc.pdf) */
export const FINDER_FILE_ID = /^file:[A-Za-z0-9][\w./-]{0,199}$/;
/** 바탕화면 가상본으로 둘 수 있는 기본 폴더 (위치와 그 안의 기본 폴더) */
export const FINDER_ALIAS_TARGET =
	/^(docs|projects|blog|apps|docs:(이력서|포트폴리오|자격증)|projects\/[a-z0-9][a-z0-9-]{0,39})$/;
/** 처음 바탕화면에 있는 가상본: 이력서·포트폴리오·자격증·프로젝트 */
export const DEFAULT_DESKTOP_ALIASES = ['docs:이력서', 'docs:포트폴리오', 'docs:자격증', 'projects'] as const;

export const FINDER_FOLDER_NAME_MAX = 60;
export const FINDER_LIMITS = { folders: 200, files: 500, aliases: 20, depth: 8 } as const;

/** 폴더 이름 검사 (화면도 같은 문구로 알린다). 문제가 없으면 null */
export function finderNameError(name: string): string | null {
	const trimmed = name.trim();
	if (!trimmed) return '이름을 입력하세요.';
	if (trimmed.includes('/')) return "이름에 '/'는 쓸 수 없습니다.";
	if (trimmed.startsWith('.')) return "'.'으로 시작하는 이름은 쓸 수 없습니다.";
	if (Array.from(trimmed).length > FINDER_FOLDER_NAME_MAX) return `이름은 ${FINDER_FOLDER_NAME_MAX}자까지입니다.`;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(trimmed)) return '이름에 제어 문자는 쓸 수 없습니다.';
	return null;
}

const folder = z.object({
	id: z.string().regex(FINDER_FOLDER_ID, '폴더 id가 맞지 않습니다.'),
	name: z
		.string({ error: '폴더 이름이 필요합니다.' })
		.transform((value) => value.trim())
		.superRefine((value, ctx) => {
			const error = finderNameError(value);
			if (error) ctx.addIssue({ code: 'custom', message: error });
		}),
	parent: z.string({ error: '상위 폴더가 필요합니다.' }).max(80),
});

const layoutShape = {
	folders: z.array(folder).max(FINDER_LIMITS.folders, `폴더는 ${FINDER_LIMITS.folders}개까지입니다.`).default([]),
	/** 옮긴 파일: file:<R2 키> → 놓은 폴더 */
	files: z
		.record(z.string().regex(FINDER_FILE_ID, '파일 id가 맞지 않습니다.'), z.string().max(80))
		.refine((value) => Object.keys(value).length <= FINDER_LIMITS.files, `파일은 ${FINDER_LIMITS.files}개까지입니다.`)
		.default({}),
	/** 바탕화면의 가상본 (순서대로). null이면 처음 것 (DEFAULT_DESKTOP_ALIASES) */
	aliases: z
		.array(z.string().regex(FINDER_ALIAS_TARGET, '가상본으로 둘 수 없는 폴더입니다.'))
		.max(FINDER_LIMITS.aliases)
		.nullable()
		.default(null),
};

export interface FinderLayoutValue {
	folders: { id: string; name: string; parent: string }[];
	files: Record<string, string>;
	aliases: string[] | null;
}

/**
 * 구조 규칙: 폴더 id가 겹치지 않고, 상위 폴더가 있고(기본 폴더이거나 만든 폴더), 고리가 없고, 깊이가 넘치지 않고,
 * 같은 폴더 안의 만든 폴더끼리 이름이 겹치지 않는다(대소문자 무시). 문제마다 문구 하나
 */
export function finderLayoutErrors(layout: FinderLayoutValue): string[] {
	const errors: string[] = [];
	const byId = new Map<string, { id: string; name: string; parent: string }>();
	for (const item of layout.folders) {
		if (byId.has(item.id)) errors.push(`폴더 id가 겹칩니다: ${item.id}`);
		byId.set(item.id, item);
	}
	const parentOk = (parent: string) => FINDER_BUILTIN_PARENT.test(parent) || byId.has(parent);
	for (const item of layout.folders) {
		if (!parentOk(item.parent)) errors.push(`상위 폴더가 없습니다: ${item.name}`);
		// 위로 올라가며 자기를 다시 만나면 고리, 너무 깊으면 거절
		let depth = 0;
		for (let at = byId.get(item.parent); at; at = byId.get(at.parent)) {
			if (at.id === item.id) {
				errors.push(`폴더를 자기 안으로 옮길 수 없습니다: ${item.name}`);
				break;
			}
			if (++depth >= FINDER_LIMITS.depth) {
				errors.push(`폴더는 ${FINDER_LIMITS.depth}단까지입니다: ${item.name}`);
				break;
			}
		}
	}
	const seen = new Set<string>();
	for (const item of layout.folders) {
		const key = `${item.parent}\n${item.name.toLowerCase()}`;
		if (seen.has(key)) errors.push(`같은 이름의 폴더가 이미 있습니다: ${item.name}`);
		seen.add(key);
	}
	for (const [file, parent] of Object.entries(layout.files))
		if (!parentOk(parent)) errors.push(`파일을 둘 폴더가 없습니다: ${file.slice(5)}`);
	return [...new Set(errors)];
}

/** 저장 (PUT /finder/layout): 구조 전체 */
export const FinderLayout = requestBody(layoutShape).superRefine((value, ctx) => {
	for (const message of finderLayoutErrors(value)) ctx.addIssue({ code: 'custom', message });
});
export type FinderLayout = z.infer<typeof FinderLayout>;

export const EMPTY_FINDER_LAYOUT: FinderLayoutValue = { folders: [], files: {}, aliases: null };
