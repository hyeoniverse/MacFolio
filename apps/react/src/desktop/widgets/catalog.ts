// 위젯의 종류와 크기 (macOS·iOS 위젯처럼). 데스크톱 바탕화면과 휴대폰 홈 화면이 같은 목록을 쓴다.
// React에 의존하지 않는다. 그리는 것은 Widget.tsx

/** 작게(정사각형) · 중간(가로로 두 칸) */
export type WidgetSize = 'small' | 'medium';

export const WIDGET_KINDS = ['weather', 'calendar', 'clock', 'music', 'posts', 'photos', 'github', 'profile'] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface WidgetInfo {
	/** 위젯 갤러리의 이름 */
	label: string;
	/** 위젯 갤러리의 한 줄 설명 */
	description: string;
	/** 고를 수 있는 크기 (처음 것이 기본) */
	sizes: readonly WidgetSize[];
}

export const WIDGET_INFO: Record<WidgetKind, WidgetInfo> = {
	weather: { label: '날씨', description: '날씨 앱의 첫 도시의 지금 날씨와 예보', sizes: ['small', 'medium'] },
	calendar: { label: '캘린더', description: '오늘 날짜와 이달의 달력', sizes: ['small', 'medium'] },
	clock: { label: '시계', description: '지금 시각 (서울)', sizes: ['small'] },
	music: { label: '음악', description: '지금 재생 중인 곡과 재생 버튼', sizes: ['medium', 'small'] },
	posts: { label: '최근 글', description: '메모 앱에 새로 올라온 글', sizes: ['medium', 'small'] },
	photos: { label: '사진', description: '사진 앱의 앨범(고른 것이나 모두)을 차례로', sizes: ['small', 'medium'] },
	github: { label: 'GitHub', description: '기여 그래프 (잔디)', sizes: ['medium', 'small'] },
	profile: { label: '소개', description: '이름과 하는 일', sizes: ['medium'] },
};

/** 바탕화면에 놓인 위젯 하나. col·row는 위젯 격자의 칸 (layout.ts) */
/** 위젯마다 고르는 값 (사진 위젯의 앨범: 사진 앱의 앨범 id. 없으면 모든 앨범) */
export interface WidgetOptions {
	album?: string;
}

export interface PlacedWidget extends WidgetOptions {
	id: string;
	kind: WidgetKind;
	size: WidgetSize;
	col: number;
	row: number;
}

/** 처음 바탕화면: 왼쪽 위에 날씨·캘린더·GitHub 잔디, 그 아래 음악, 최근 글 */
export const DEFAULT_DESKTOP_WIDGETS: PlacedWidget[] = [
	{ id: 'weather', kind: 'weather', size: 'small', col: 0, row: 0 },
	{ id: 'calendar', kind: 'calendar', size: 'small', col: 1, row: 0 },
	{ id: 'github', kind: 'github', size: 'medium', col: 2, row: 0 },
	{ id: 'music', kind: 'music', size: 'medium', col: 0, row: 1 },
	{ id: 'posts', kind: 'posts', size: 'medium', col: 0, row: 2 },
];

/** 휴대폰 홈 화면의 위젯 하나 (페이지 안의 순서대로 놓인다) */
export interface PageWidget extends WidgetOptions {
	id: string;
	kind: WidgetKind;
	size: WidgetSize;
}

/** 위젯을 두는 홈 화면 페이지 수 (앱은 이 페이지들의 위젯 아래와 그 뒤 페이지에 놓인다) */
export const MOBILE_WIDGET_PAGE_COUNT = 3;
/** 한 페이지에 둘 수 있는 위젯 줄 수 (작은 위젯 둘이 한 줄, 중간 위젯은 혼자 한 줄) */
export const MAX_WIDGET_ROWS = 3;

/** 휴대폰 홈 화면의 처음 위젯 (iOS처럼 페이지마다 위) */
export const DEFAULT_MOBILE_WIDGETS: PageWidget[][] = [
	[
		{ id: 'profile', kind: 'profile', size: 'medium' },
		{ id: 'github', kind: 'github', size: 'medium' },
	],
	[
		{ id: 'weather', kind: 'weather', size: 'small' },
		{ id: 'calendar', kind: 'calendar', size: 'small' },
		{ id: 'music', kind: 'music', size: 'medium' },
	],
	[
		{ id: 'posts', kind: 'posts', size: 'medium' },
		{ id: 'photos', kind: 'photos', size: 'small' },
		{ id: 'clock', kind: 'clock', size: 'small' },
	],
];

/** 위젯들이 차지하는 줄 수 (격자는 빈자리를 앞에서부터 채운다: 작은 위젯은 둘씩 한 줄) */
export function widgetRows(widgets: readonly { size: WidgetSize }[]): number {
	const small = widgets.filter((widget) => widget.size === 'small').length;
	return widgets.length - small + Math.ceil(small / 2);
}

/** 이 페이지에 더 놓을 수 있는지 */
export const fitsOnPage = (widgets: readonly { size: WidgetSize }[], size: WidgetSize) =>
	widgetRows([...widgets, { size }]) <= MAX_WIDGET_ROWS;

/** 더할 페이지: 지금 페이지에 자리가 있으면 거기, 없으면 자리가 있는 첫 페이지. 어디에도 없으면 -1 */
export function pageToAdd(
	pages: readonly (readonly { size: WidgetSize }[])[],
	current: number,
	size: WidgetSize
): number {
	if (pages[current] && fitsOnPage(pages[current], size)) return current;
	return pages.findIndex((page) => fitsOnPage(page, size));
}

/** 저장한 고른 값 (앨범 id는 글자만 받는다: 없어진 앨범이면 위젯이 모든 앨범을 보인다) */
const optionsOf = (album: unknown): WidgetOptions =>
	typeof album === 'string' && album.length <= 100 ? { album } : {};

const isKind = (value: unknown): value is WidgetKind =>
	typeof value === 'string' && (WIDGET_KINDS as readonly string[]).includes(value);

/** 저장해 둔 값에서 맞는 위젯만 꺼낸다. 모양이 틀렸으면 null (처음 모양을 쓴다) */
export function parseWidgets(raw: unknown): PlacedWidget[] | null {
	if (!Array.isArray(raw)) return null;
	const widgets: PlacedWidget[] = [];
	const ids = new Set<string>();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, kind, size, col, row, album } = item as Record<string, unknown>;
		if (typeof id !== 'string' || ids.has(id) || !isKind(kind)) continue;
		if (!(WIDGET_INFO[kind].sizes as readonly unknown[]).includes(size)) continue;
		if (!Number.isInteger(col) || !Number.isInteger(row) || (col as number) < 0 || (row as number) < 0) continue;
		ids.add(id);
		widgets.push({ id, kind, size: size as WidgetSize, col: col as number, row: row as number, ...optionsOf(album) });
	}
	return widgets;
}

/**
 * 저장해 둔 휴대폰 위젯에서 맞는 것만 꺼낸다. 페이지는 MOBILE_WIDGET_PAGE_COUNT개로 맞추고, 줄이 넘치는 위젯은 뺀다.
 * 모양이 틀렸으면 null (처음 모양을 쓴다)
 */
export function parseMobileWidgets(raw: unknown): PageWidget[][] | null {
	if (!Array.isArray(raw)) return null;
	const ids = new Set<string>();
	const pages = Array.from({ length: MOBILE_WIDGET_PAGE_COUNT }, (_, index) => {
		const page: PageWidget[] = [];
		const items: unknown = raw[index];
		if (!Array.isArray(items)) return page;
		for (const item of items) {
			if (typeof item !== 'object' || item === null) continue;
			const { id, kind, size, album } = item as Record<string, unknown>;
			if (typeof id !== 'string' || ids.has(id) || !isKind(kind)) continue;
			if (!(WIDGET_INFO[kind].sizes as readonly unknown[]).includes(size)) continue;
			if (!fitsOnPage(page, size as WidgetSize)) continue;
			ids.add(id);
			page.push({ id, kind, size: size as WidgetSize, ...optionsOf(album) });
		}
		return page;
	});
	return pages;
}

/** 새 위젯의 id: 종류 이름에 겹치지 않는 번호 */
export function newWidgetId(kind: WidgetKind, taken: readonly { id: string }[]): string {
	const ids = new Set(taken.map((widget) => widget.id));
	if (!ids.has(kind)) return kind;
	let n = 2;
	while (ids.has(`${kind}-${n}`)) n++;
	return `${kind}-${n}`;
}
