// 화면과 서버(apps/api)가 함께 쓰는 메모 규칙: 정리 내용의 모양과 검사, 폴더 경로, 글 길이와 날짜.
// 화면은 저장하기 전에 먼저 알려 주고, 서버는 화면을 거치지 않은 요청도 있으므로 저장하기 전에 다시 막는다.
// 서버는 빌드한 dist를 쓴다 (package.json의 exports)

export const FOLDER_NAME_MAX = 30;
/** 폴더는 3단까지 (예: 개발기/MacFolio/초안) */
export const MAX_FOLDER_DEPTH = 3;

declare const postSlugBrand: unique symbol;
declare const folderPathBrand: unique symbol;
/**
 * 글 주소 (POST_SLUG에 맞는 문자열). 파일 이름·서버·주소창에서 온 문자열은 postSlug()로 확인해야 이 타입이 된다.
 * 넓은 string과 섞이지 않게 표시만 붙인 문자열이다 (실행 시에는 그냥 문자열)
 */
export type PostSlug = string & { readonly [postSlugBrand]: true };
/** 폴더 경로 (folderPathError가 없는 문자열, 예: 개발기/MacFolio). folderPath()로 확인해야 이 타입이 된다 */
export type FolderPath = string & { readonly [folderPathBrand]: true };

export interface Organization {
	/** 만든 폴더의 전체 경로 (예: 읽을거리, 개발기/읽을거리) */
	folders: FolderPath[];
	/** 옮긴 글: slug → 폴더 경로 */
	posts: Record<PostSlug, FolderPath>;
	/** 옮긴 폴더 (순서대로 적용한다). 글의 원래 category 경로에 적용된다 */
	moves: { from: FolderPath; to: FolderPath }[];
	/** 고정을 바꾼 글: slug → 고정 여부 (머리말의 pinned보다 우선) */
	pins: Record<PostSlug, boolean>;
	/** 잠근 글: slug → true. 잠그면 고치거나 지울 수 없다 (실수로 바꾸지 않게) */
	locks: Record<PostSlug, boolean>;
	/** 폴더 순서: 폴더 경로를 보일 순서대로. 같은 층끼리 이 순서를 따르고, 없는 폴더는 뒤에 가나다순 */
	order: FolderPath[];
}

export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [], pins: {}, locks: {}, order: [] };

/** 글 길이 (글자 수) */
export const POST_LIMITS = { title: 100, summary: 200, body: 50_000 } as const;

/** 실제로 있는 날짜인지 (YYYY-MM-DD, 2026-02-30 같은 날짜는 거절) */
export function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** 한 번에 저장할 수 있는 항목 수 (이상한 요청으로 DB가 커지지 않게) */
export const ORGANIZATION_LIMITS = { folders: 200, posts: 500, moves: 200, pins: 500, locks: 500, order: 300 } as const;

/** 글 주소 (Markdown 파일 이름, 서버에서 만든 글의 날짜-무작위 문자) */
export const POST_SLUG = /^[\w-]{1,100}$/;

export const isPostSlug = (value: unknown): value is PostSlug => typeof value === 'string' && POST_SLUG.test(value);
/** 글 주소 모양이면 PostSlug, 아니면 null (바깥에서 온 문자열을 글 주소로 바꾸는 유일한 길) */
export const postSlug = (value: unknown): PostSlug | null => (isPostSlug(value) ? value : null);

/** 폴더 경로가 규칙에 맞는지. 맞지 않으면 이유 */
export function folderPathError(path: unknown): string | null {
	if (typeof path !== 'string') return '폴더 경로는 문자열이어야 합니다';
	const names = path.split('/');
	if (names.length > MAX_FOLDER_DEPTH) return `폴더는 ${MAX_FOLDER_DEPTH}단까지입니다: ${path}`;
	for (const name of names) {
		if (!name.trim() || name !== name.trim()) return `폴더 이름이 비었거나 앞뒤에 공백이 있습니다: ${path}`;
		if (name.length > FOLDER_NAME_MAX) return `폴더 이름은 ${FOLDER_NAME_MAX}자 이하입니다: ${path}`;
	}
	return null;
}

export const isFolderPath = (value: unknown): value is FolderPath => folderPathError(value) === null;
/** 폴더 경로 규칙에 맞으면 FolderPath, 아니면 null */
export const folderPath = (value: unknown): FolderPath | null => (isFolderPath(value) ? value : null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 요청 본문을 검사해 정리 내용으로 바꾼다. 문제가 있으면 모든 이유를 모아 돌려준다.
 * 모르는 필드는 버린다. locks·order는 나중에 생겨서, 없으면 빈 값으로 본다.
 */
export function parseOrganization(input: unknown): { value: Organization } | { errors: string[] } {
	const errors: string[] = [];
	if (!isRecord(input)) return { errors: ['정리 내용은 객체여야 합니다'] };
	const { folders, posts, moves, pins, locks = {}, order = [] } = input;

	if (!Array.isArray(folders)) errors.push('folders는 배열이어야 합니다');
	else {
		if (folders.length > ORGANIZATION_LIMITS.folders) errors.push(`폴더는 ${ORGANIZATION_LIMITS.folders}개까지입니다`);
		folders.forEach((folder) => {
			const error = folderPathError(folder);
			if (error) errors.push(error);
		});
		if (new Set(folders).size !== folders.length) errors.push('같은 폴더가 두 번 있습니다');
	}

	if (!isRecord(posts)) errors.push('posts는 객체여야 합니다');
	else {
		const entries = Object.entries(posts);
		if (entries.length > ORGANIZATION_LIMITS.posts) errors.push(`옮긴 글은 ${ORGANIZATION_LIMITS.posts}개까지입니다`);
		for (const [slug, path] of entries) {
			if (!POST_SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			const error = folderPathError(path);
			if (error) errors.push(error);
		}
	}

	if (!Array.isArray(moves)) errors.push('moves는 배열이어야 합니다');
	else {
		if (moves.length > ORGANIZATION_LIMITS.moves) errors.push(`옮긴 폴더는 ${ORGANIZATION_LIMITS.moves}개까지입니다`);
		for (const move of moves) {
			if (!isRecord(move)) {
				errors.push('moves의 항목은 { from, to }여야 합니다');
				continue;
			}
			const error = folderPathError(move.from) ?? folderPathError(move.to);
			if (error) errors.push(error);
		}
	}

	if (!isRecord(pins)) errors.push('pins는 객체여야 합니다');
	else {
		const entries = Object.entries(pins);
		if (entries.length > ORGANIZATION_LIMITS.pins) errors.push(`고정은 ${ORGANIZATION_LIMITS.pins}개까지입니다`);
		for (const [slug, pinned] of entries) {
			if (!POST_SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			if (typeof pinned !== 'boolean') errors.push(`고정 여부는 true/false여야 합니다: ${slug}`);
		}
	}

	if (!isRecord(locks)) errors.push('locks는 객체여야 합니다');
	else {
		const entries = Object.entries(locks);
		if (entries.length > ORGANIZATION_LIMITS.locks) errors.push(`잠금은 ${ORGANIZATION_LIMITS.locks}개까지입니다`);
		for (const [slug, locked] of entries) {
			if (!POST_SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			if (typeof locked !== 'boolean') errors.push(`잠금 여부는 true/false여야 합니다: ${slug}`);
		}
	}

	if (!Array.isArray(order)) errors.push('order는 배열이어야 합니다');
	else {
		if (order.length > ORGANIZATION_LIMITS.order) errors.push(`폴더 순서는 ${ORGANIZATION_LIMITS.order}개까지입니다`);
		order.forEach((path) => {
			const error = folderPathError(path);
			if (error) errors.push(error);
		});
		if (new Set(order).size !== order.length) errors.push('폴더 순서에 같은 폴더가 두 번 있습니다');
	}

	if (errors.length > 0) return { errors };
	return {
		value: {
			folders: folders as FolderPath[],
			posts: posts as Record<PostSlug, FolderPath>,
			moves: (moves as { from: FolderPath; to: FolderPath }[]).map(({ from, to }) => ({ from, to })),
			pins: pins as Record<PostSlug, boolean>,
			locks: locks as Record<PostSlug, boolean>,
			order: order as FolderPath[],
		},
	};
}
