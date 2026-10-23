// 위젯의 종류와 크기 (macOS·iOS 위젯처럼). 데스크톱 바탕화면과 휴대폰 홈 화면이 같은 목록을 쓴다.
// React에 의존하지 않는다. 그리는 것은 Widget.tsx

/** 작게(정사각형) · 중간(가로로 두 칸) */
export type WidgetSize = 'small' | 'medium';

export const WIDGET_KINDS = [
	'weather',
	'calendar',
	'clock',
	'music',
	'posts',
	'photos',
	'github',
	'profile',
	'quote',
] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

export interface WidgetInfo {
	/** 위젯 갤러리의 이름 */
	label: string;
	/** 위젯 갤러리의 한 줄 설명 */
	description: string;
	/** 고를 수 있는 크기 (처음 것이 기본) */
	sizes: readonly WidgetSize[];
}

/** 크기 이름 (메뉴·갤러리) */
export const SIZE_LABEL: Record<WidgetSize, string> = { small: '작게', medium: '중간' };

export const WIDGET_INFO: Record<WidgetKind, WidgetInfo> = {
	weather: { label: '날씨', description: '날씨 앱의 첫 도시의 지금 날씨와 예보', sizes: ['small', 'medium'] },
	calendar: { label: '캘린더', description: '오늘 날짜와 이달의 달력', sizes: ['small', 'medium'] },
	clock: { label: '시계', description: '지금 시각 (서울)', sizes: ['small'] },
	music: { label: '음악', description: '지금 재생 중인 곡과 재생 버튼', sizes: ['medium', 'small'] },
	posts: { label: '메모', description: '메모 앱의 최근 글·인기글·랜덤 글', sizes: ['medium', 'small'] },
	photos: {
		label: '사진',
		description: '사진 앱의 앨범(고른 것이나 모두)을 차례로, 영상은 소리 없이 재생',
		sizes: ['small', 'medium'],
	},
	github: { label: 'GitHub', description: '기여 그래프 (잔디)', sizes: ['medium', 'small'] },
	profile: { label: '소개', description: '이름과 하는 일', sizes: ['medium'] },
	quote: {
		label: '명언',
		description: '개발·디자인에 관한 짧은 말. 날마다 바뀌고, 누르면 다른 말',
		sizes: ['medium', 'small'],
	},
};

/** 바탕화면에 놓인 위젯 하나. col·row는 위젯 격자의 칸 (layout.ts) */
/** 메모 위젯이 보일 글: 최근 글, 인기글(메모 앱의 인기글 순위), 랜덤 */
export const POSTS_MODES = ['recent', 'popular', 'random'] as const;
export type PostsMode = (typeof POSTS_MODES)[number];
export const POSTS_MODE_LABEL: Record<PostsMode, string> = { recent: '최근 글', popular: '인기글', random: '랜덤' };

/**
 * 위젯마다 고르는 값.
 * - album: 사진 위젯의 앨범(사진 앱의 앨범 id 또는 그림 폴더). 없으면 모든 앨범
 * - posts: 메모 위젯이 보일 글. 없으면 최근 글
 */
export interface WidgetOptions {
	album?: string;
	posts?: PostsMode;
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

/** 휴대폰 홈 화면의 처음 위젯 (iOS처럼 페이지마다 위). 첫 화면에서 바로 재생할 수 있게 음악 위젯을 1쪽에 둔다 */
export const DEFAULT_MOBILE_WIDGETS: PageWidget[][] = [
	[
		{ id: 'profile', kind: 'profile', size: 'medium' },
		{ id: 'music', kind: 'music', size: 'medium' },
	],
	[
		{ id: 'weather', kind: 'weather', size: 'small' },
		{ id: 'calendar', kind: 'calendar', size: 'small' },
		{ id: 'github', kind: 'github', size: 'medium' },
	],
	[
		{ id: 'posts', kind: 'posts', size: 'medium' },
		{ id: 'photos', kind: 'photos', size: 'small' },
		{ id: 'clock', kind: 'clock', size: 'small' },
	],
];

/**
 * 예전 처음 위젯 (id·종류·크기 순서). 방문자가 위젯을 옮기거나 빼거나 더하지 않았어도, 사진 위젯의 앨범처럼
 * 고른 값을 바꾸면 처음 구성이 통째로 저장된다. 저장된 구성이 이 중 하나와 같으면 방문자가 고른 구성이 아니므로
 * 지금 처음 위젯으로 바꾼다 (upgradeMobileDefault)
 */
const PREVIOUS_MOBILE_DEFAULTS: readonly (readonly string[])[] = [
	// GitHub 잔디를 1쪽에 둔 구성 (92e281ccc ~ 음악 위젯을 1쪽으로 옮기기 전)
	[
		'profile:profile:medium github:github:medium',
		'weather:weather:small calendar:calendar:small music:music:medium',
		'posts:posts:medium photos:photos:small clock:clock:small',
	],
	// 처음 휴대폰 위젯 편집을 만든 구성 (f11e3058d)
	[
		'profile:profile:medium music:music:medium',
		'weather:weather:small calendar:calendar:small posts:posts:medium',
		'github:github:medium photos:photos:small clock:clock:small',
	],
];

const signatureOf = (pages: readonly (readonly PageWidget[])[]) =>
	pages.map((page) => page.map(({ id, kind, size }) => `${id}:${kind}:${size}`).join(' '));

/** 저장된 구성이 예전 처음 위젯 그대로면 지금 처음 위젯으로 바꾼다. 고른 값(앨범·글 보기)은 같은 id의 위젯에 옮긴다 */
export function upgradeMobileDefault(pages: PageWidget[][]): PageWidget[][] {
	const signature = signatureOf(pages).join('|');
	if (!PREVIOUS_MOBILE_DEFAULTS.some((previous) => previous.join('|') === signature)) return pages;
	const saved = pages.flat();
	return DEFAULT_MOBILE_WIDGETS.map((page) =>
		page.map((widget) => {
			const { album, posts } = saved.find((item) => item.id === widget.id) ?? {};
			return { ...widget, ...optionsOf(album, posts) };
		})
	);
}

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

/** 저장한 고른 값 (앨범 id는 글자만 받는다: 없어진 앨범이면 위젯이 모든 앨범을 보인다. 모르는 글 보기는 버린다) */
const optionsOf = (album: unknown, posts: unknown): WidgetOptions => ({
	...(typeof album === 'string' && album.length <= 100 && { album }),
	...((POSTS_MODES as readonly unknown[]).includes(posts) && { posts: posts as PostsMode }),
});

const isKind = (value: unknown): value is WidgetKind =>
	typeof value === 'string' && (WIDGET_KINDS as readonly string[]).includes(value);

/** 저장해 둔 값에서 맞는 위젯만 꺼낸다. 모양이 틀렸으면 null (처음 모양을 쓴다) */
export function parseWidgets(raw: unknown): PlacedWidget[] | null {
	if (!Array.isArray(raw)) return null;
	const widgets: PlacedWidget[] = [];
	const ids = new Set<string>();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, kind, size, col, row, album, posts } = item as Record<string, unknown>;
		if (typeof id !== 'string' || ids.has(id) || !isKind(kind)) continue;
		if (!(WIDGET_INFO[kind].sizes as readonly unknown[]).includes(size)) continue;
		if (!Number.isInteger(col) || !Number.isInteger(row) || (col as number) < 0 || (row as number) < 0) continue;
		ids.add(id);
		widgets.push({
			id,
			kind,
			size: size as WidgetSize,
			col: col as number,
			row: row as number,
			...optionsOf(album, posts),
		});
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
			const { id, kind, size, album, posts } = item as Record<string, unknown>;
			if (typeof id !== 'string' || ids.has(id) || !isKind(kind)) continue;
			if (!(WIDGET_INFO[kind].sizes as readonly unknown[]).includes(size)) continue;
			if (!fitsOnPage(page, size as WidgetSize)) continue;
			ids.add(id);
			page.push({ id, kind, size: size as WidgetSize, ...optionsOf(album, posts) });
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

type WithOptions = { id: string; kind: WidgetKind } & WidgetOptions;

/** 고른 값이 같은지 (없음과 undefined는 같다) */
const sameOptions = (a: WidgetOptions, b: WidgetOptions) => a.album === b.album && a.posts === b.posts;

/**
 * 같은 위젯(같은 id·종류)에 고른 값을 적는다. 바탕화면과 휴대폰 홈 화면은 위젯 자리를 따로 저장하지만
 * 고른 값(사진 위젯의 앨범, 메모 위젯의 글 보기)은 함께 쓴다: 한쪽에서 고르면 다른 쪽의 같은 위젯도 바뀐다.
 * 바뀐 것이 없으면 같은 배열을 돌려준다
 */
export function withOptions<T extends WithOptions>(
	widgets: T[],
	id: string,
	kind: WidgetKind,
	options: WidgetOptions
): T[] {
	let changed = false;
	const next = widgets.map((widget) => {
		if (widget.id !== id || widget.kind !== kind) return widget;
		const merged = { ...widget, ...options };
		if (sameOptions(widget, merged)) return widget;
		changed = true;
		return merged;
	});
	return changed ? next : widgets;
}

/**
 * 고른 값이 없는 위젯은 다른 화면의 같은 위젯(같은 id·종류)이 고른 값을 쓴다.
 * 함께 쓰기 전에 한쪽에서만 골라 둔 것도 다른 쪽에 보이게 한다
 */
export function fillOptions<T extends WithOptions>(widgets: T[], others: readonly WithOptions[]): T[] {
	return widgets.map((widget) => {
		const other = others.find((item) => item.id === widget.id && item.kind === widget.kind);
		if (!other) return widget;
		return {
			...widget,
			...(widget.album === undefined && other.album !== undefined && { album: other.album }),
			...(widget.posts === undefined && other.posts !== undefined && { posts: other.posts }),
		};
	});
}
