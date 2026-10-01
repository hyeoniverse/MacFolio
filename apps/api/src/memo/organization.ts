// 메모 정리 내용의 규칙. 화면(apps/react/src/apps/memo/organize.ts)과 같은 규칙을 서버에서도 검사한다.
// 화면에서 막아도 요청은 직접 보낼 수 있으므로, 저장하기 전에 여기서 한 번 더 막는다.

export interface Organization {
	/** 만든 폴더의 전체 경로 (예: 개발기/읽을거리) */
	folders: string[];
	/** 옮긴 글: slug → 폴더 경로 */
	posts: Record<string, string>;
	/** 옮긴 폴더 (순서대로 적용) */
	moves: { from: string; to: string }[];
	/** 고정을 바꾼 글: slug → 고정 여부 */
	pins: Record<string, boolean>;
	/** 잠근 글: slug → true (잠그면 고치거나 지울 수 없다) */
	locks: Record<string, boolean>;
}

export const EMPTY_ORGANIZATION: Organization = { folders: [], posts: {}, moves: [], pins: {}, locks: {} };

export const FOLDER_NAME_MAX = 30;
/** 폴더는 3단까지 */
export const MAX_FOLDER_DEPTH = 3;
/** 한 번에 저장할 수 있는 항목 수 (이상한 요청으로 DB가 커지지 않게) */
export const LIMITS = { folders: 200, posts: 500, moves: 200, pins: 500, locks: 500 } as const;

const SLUG = /^[\w-]{1,100}$/;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 요청 본문을 검사해 정리 내용으로 바꾼다. 문제가 있으면 모든 이유를 모아 돌려준다.
 * 모르는 필드는 버린다. locks는 나중에 생겨서, 없으면 빈 값으로 본다.
 */
export function parseOrganization(input: unknown): { value: Organization } | { errors: string[] } {
	const errors: string[] = [];
	if (!isRecord(input)) return { errors: ['정리 내용은 객체여야 합니다'] };
	const { folders, posts, moves, pins, locks = {} } = input;

	if (!Array.isArray(folders)) errors.push('folders는 배열이어야 합니다');
	else {
		if (folders.length > LIMITS.folders) errors.push(`폴더는 ${LIMITS.folders}개까지입니다`);
		folders.forEach((folder) => {
			const error = folderPathError(folder);
			if (error) errors.push(error);
		});
		if (new Set(folders).size !== folders.length) errors.push('같은 폴더가 두 번 있습니다');
	}

	if (!isRecord(posts)) errors.push('posts는 객체여야 합니다');
	else {
		const entries = Object.entries(posts);
		if (entries.length > LIMITS.posts) errors.push(`옮긴 글은 ${LIMITS.posts}개까지입니다`);
		for (const [slug, path] of entries) {
			if (!SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			const error = folderPathError(path);
			if (error) errors.push(error);
		}
	}

	if (!Array.isArray(moves)) errors.push('moves는 배열이어야 합니다');
	else {
		if (moves.length > LIMITS.moves) errors.push(`옮긴 폴더는 ${LIMITS.moves}개까지입니다`);
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
		if (entries.length > LIMITS.pins) errors.push(`고정은 ${LIMITS.pins}개까지입니다`);
		for (const [slug, pinned] of entries) {
			if (!SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			if (typeof pinned !== 'boolean') errors.push(`고정 여부는 true/false여야 합니다: ${slug}`);
		}
	}

	if (!isRecord(locks)) errors.push('locks는 객체여야 합니다');
	else {
		const entries = Object.entries(locks);
		if (entries.length > LIMITS.locks) errors.push(`잠금은 ${LIMITS.locks}개까지입니다`);
		for (const [slug, locked] of entries) {
			if (!SLUG.test(slug)) errors.push(`글 주소가 올바르지 않습니다: ${slug}`);
			if (typeof locked !== 'boolean') errors.push(`잠금 여부는 true/false여야 합니다: ${slug}`);
		}
	}

	if (errors.length > 0) return { errors };
	return {
		value: {
			folders: folders as string[],
			posts: posts as Record<string, string>,
			moves: (moves as { from: string; to: string }[]).map(({ from, to }) => ({ from, to })),
			pins: pins as Record<string, boolean>,
			locks: locks as Record<string, boolean>,
		},
	};
}
