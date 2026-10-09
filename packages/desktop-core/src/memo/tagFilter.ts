import { sameTag } from './tags.js';

/** 태그 하나의 고른 상태: 포함(이 태그가 있는 메모) 또는 제외(이 태그가 있는 메모는 뺀다) */
export type TagState = 'include' | 'exclude';
/** 포함한 태그가 여럿일 때: 모두 있어야 하는지(all), 하나라도 있으면 되는지(any) */
export type TagMatch = 'all' | 'any';

/** 사이드바 태그 묶음에서 고른 것. macOS 메모처럼 태그마다 누를 때마다 미선택 → 포함 → 제외 → 미선택 */
export interface TagSelection {
	/** '모든 태그': 태그가 하나라도 있는 메모 */
	all: boolean;
	tags: Record<string, TagState>;
	match: TagMatch;
}

export const EMPTY_TAG_SELECTION: TagSelection = { all: false, tags: {}, match: 'all' };

/** 미선택 → 포함 → 제외 → 미선택 */
export const nextTagState = (state: TagState | undefined): TagState | undefined =>
	state === undefined ? 'include' : state === 'include' ? 'exclude' : undefined;

/** 태그 하나를 눌렀을 때 ('모든 태그'는 풀린다) */
export function cycleTag(selection: TagSelection, name: string): TagSelection {
	const tags = { ...selection.tags };
	const next = nextTagState(tags[name]);
	if (next) tags[name] = next;
	else delete tags[name];
	return { ...selection, all: false, tags };
}

/** '모든 태그'를 눌렀을 때: 켜면 다른 태그는 풀리고, 다시 누르면 꺼진다 */
export const toggleAllTags = (selection: TagSelection): TagSelection =>
	selection.all ? { ...selection, all: false } : { ...selection, all: true, tags: {} };

/** 이 태그만 포함 (본문의 태그를 눌렀을 때) */
export const onlyTag = (selection: TagSelection, name: string): TagSelection => ({
	...selection,
	all: false,
	tags: { [name]: 'include' },
});

export const isTagSelectionActive = (selection: TagSelection) =>
	selection.all || Object.keys(selection.tags).length > 0;

const namesIn = (selection: TagSelection, state: TagState) =>
	Object.entries(selection.tags)
		.filter(([, value]) => value === state)
		.map(([name]) => name);

/** 메모의 태그가 고른 것과 맞는지 */
export function matchesTags(postTags: string[], selection: TagSelection): boolean {
	const has = (name: string) => postTags.some((tag) => sameTag(tag, name));
	if (selection.all) return postTags.length > 0;
	if (namesIn(selection, 'exclude').some(has)) return false;
	const included = namesIn(selection, 'include');
	if (included.length === 0) return true;
	return selection.match === 'all' ? included.every(has) : included.some(has);
}

/** 목록 위 제목: 모든 태그 / #이름 (하나만 포함) / N개의 태그 */
export function tagSelectionTitle(selection: TagSelection): string {
	if (selection.all) return '모든 태그';
	const names = Object.keys(selection.tags);
	if (names.length === 1 && selection.tags[names[0]] === 'include') return `#${names[0]}`;
	return `${names.length}개의 태그`;
}

/** 목록 위 안내 문구 (포함한 태그가 없으면 없다) */
export function tagSelectionNote(selection: TagSelection): string | null {
	if (selection.all) return '태그가 있는 모든 메모를 표시합니다.';
	const names = Object.keys(selection.tags);
	const included = namesIn(selection, 'include');
	if (included.length === 0) return null;
	if (names.length === 1) return `선택된 태그(#${included[0]})와 일치하는 메모를 표시합니다.`;
	return `${names.length}개의 선택된 태그와 ${selection.match === 'all' ? '모두' : '일부'} 일치하는 메모를 표시합니다.`;
}
