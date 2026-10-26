// 메모 앱이 이 브라우저에 남기는 것: 보기 설정, 최근 검색어(본문 찾기·목록 검색). 값 검사는 desktop-core가 하고 여기서는 읽고 쓰기만 한다
import { addRecentFind, parseArrangement, parseRecentFinds, type Arrangement } from '@macfolio/desktop-core/memo';
import { readJson, readString, removeKey, STORAGE_KEYS, writeJson, writeString } from '@/shared/lib/storage';

/** 저장된 보기 설정. 없거나 잘못되었으면 기본값 */
export const loadArrangement = (): Arrangement => parseArrangement(readJson(STORAGE_KEYS.memoArrangement));
export const saveArrangement = (arrangement: Arrangement) => writeJson(STORAGE_KEYS.memoArrangement, arrangement);

export const loadRecentFinds = (): string[] => parseRecentFinds(readJson(STORAGE_KEYS.memoRecentFinds));
export const saveRecentFinds = (list: string[]) => writeJson(STORAGE_KEYS.memoRecentFinds, list);

/** 최근 검색어에 더하고 저장한다 */
export function rememberFind(recent: string[], query: string): string[] {
	const next = addRecentFind(recent, query);
	if (next !== recent) saveRecentFinds(next);
	return next;
}

export const loadRecentSearches = (): string[] => parseRecentFinds(readJson(STORAGE_KEYS.memoRecentSearches));
export const saveRecentSearches = (list: string[]) => writeJson(STORAGE_KEYS.memoRecentSearches, list);

/** 목록 검색 칸의 최근 검색어에 더하고 저장한다 (본문 찾기와 같은 규칙: 같은 말은 맨 앞으로, 다섯 개까지) */
export function rememberSearch(query: string): string[] {
	const recent = loadRecentSearches();
	const next = addRecentFind(recent, query);
	if (next !== recent) saveRecentSearches(next);
	return next;
}

/** 너비를 조절하는 칸: 사이드바(폴더·태그), 목록(글 목록) */
export type ResizablePane = 'sidebar' | 'list';

/** 칸마다 너비(px)의 범위와 기본값 (기본값은 styles/theme.css의 13rem·17rem), 저장 키 */
export const PANE_WIDTHS: Record<ResizablePane, { min: number; max: number; initial: number; key: string }> = {
	sidebar: { min: 180, max: 360, initial: 208, key: STORAGE_KEYS.memoSidebarWidth },
	list: { min: 220, max: 440, initial: 272, key: STORAGE_KEYS.memoListWidth },
};

export const clampPaneWidth = (pane: ResizablePane, width: number) =>
	Math.round(Math.min(PANE_WIDTHS[pane].max, Math.max(PANE_WIDTHS[pane].min, width)));

/** 저장된 너비. 없거나 숫자가 아니면 기본값, 범위 밖이면 범위 안으로 */
export function loadPaneWidth(pane: ResizablePane): number {
	const value = Number(readString(PANE_WIDTHS[pane].key));
	return Number.isFinite(value) && value > 0 ? clampPaneWidth(pane, value) : PANE_WIDTHS[pane].initial;
}

/** 기본값이면 지운다 (휴지통의 '내 브라우저 데이터'에 쓸데없이 남지 않게) */
export function savePaneWidth(pane: ResizablePane, width: number) {
	if (width === PANE_WIDTHS[pane].initial) removeKey(PANE_WIDTHS[pane].key);
	else writeString(PANE_WIDTHS[pane].key, String(width));
}

/** 읽기 화면 글자 크기 단계 (배율). 글 자체는 그대로 두고 보는 사람 화면에서만 키우거나 줄인다 */
export const TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5] as const;

/** 저장된 글자 크기 단계. 없거나 목록에 없는 값이면 기본(1) */
export function loadTextScale(): number {
	const value = Number(readString(STORAGE_KEYS.memoTextScale));
	return (TEXT_SCALES as readonly number[]).includes(value) ? value : 1;
}

/** 기본값이면 지운다 */
export function saveTextScale(scale: number) {
	if (scale === 1) removeKey(STORAGE_KEYS.memoTextScale);
	else writeString(STORAGE_KEYS.memoTextScale, String(scale));
}

/** 한 단계 키우거나(+1) 줄인 배율. 끝이면 그대로 */
export function stepTextScale(scale: number, step: 1 | -1): number {
	const index = (TEXT_SCALES as readonly number[]).indexOf(scale);
	return TEXT_SCALES[Math.min(TEXT_SCALES.length - 1, Math.max(0, (index < 0 ? 1 : index) + step))];
}
