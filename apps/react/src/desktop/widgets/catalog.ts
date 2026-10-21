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
	photos: { label: '사진', description: '사진 앱의 프로젝트 화면을 차례로', sizes: ['small', 'medium'] },
	github: { label: 'GitHub', description: '최근 기여 그래프', sizes: ['medium'] },
	profile: { label: '소개', description: '이름과 하는 일', sizes: ['medium'] },
};

/** 바탕화면에 놓인 위젯 하나. col·row는 위젯 격자의 칸 (layout.ts) */
export interface PlacedWidget {
	id: string;
	kind: WidgetKind;
	size: WidgetSize;
	col: number;
	row: number;
}

/** 처음 바탕화면: 왼쪽 위에 날씨·캘린더, 그 아래 음악, 최근 글 */
export const DEFAULT_DESKTOP_WIDGETS: PlacedWidget[] = [
	{ id: 'weather', kind: 'weather', size: 'small', col: 0, row: 0 },
	{ id: 'calendar', kind: 'calendar', size: 'small', col: 1, row: 0 },
	{ id: 'music', kind: 'music', size: 'medium', col: 0, row: 1 },
	{ id: 'posts', kind: 'posts', size: 'medium', col: 0, row: 2 },
];

/** 휴대폰 홈 화면의 위젯 (iOS처럼 페이지마다 위). 작은 위젯 둘이 한 줄, 중간 위젯은 한 줄을 다 쓴다 */
export const MOBILE_WIDGET_PAGES: { kind: WidgetKind; size: WidgetSize }[][] = [
	[
		{ kind: 'profile', size: 'medium' },
		{ kind: 'music', size: 'medium' },
	],
	[
		{ kind: 'weather', size: 'small' },
		{ kind: 'calendar', size: 'small' },
		{ kind: 'posts', size: 'medium' },
	],
	[
		{ kind: 'github', size: 'medium' },
		{ kind: 'photos', size: 'small' },
		{ kind: 'clock', size: 'small' },
	],
];

const isKind = (value: unknown): value is WidgetKind =>
	typeof value === 'string' && (WIDGET_KINDS as readonly string[]).includes(value);

/** 저장해 둔 값에서 맞는 위젯만 꺼낸다. 모양이 틀렸으면 null (처음 모양을 쓴다) */
export function parseWidgets(raw: unknown): PlacedWidget[] | null {
	if (!Array.isArray(raw)) return null;
	const widgets: PlacedWidget[] = [];
	const ids = new Set<string>();
	for (const item of raw) {
		if (typeof item !== 'object' || item === null) continue;
		const { id, kind, size, col, row } = item as Record<string, unknown>;
		if (typeof id !== 'string' || ids.has(id) || !isKind(kind)) continue;
		if (!(WIDGET_INFO[kind].sizes as readonly unknown[]).includes(size)) continue;
		if (!Number.isInteger(col) || !Number.isInteger(row) || (col as number) < 0 || (row as number) < 0) continue;
		ids.add(id);
		widgets.push({ id, kind, size: size as WidgetSize, col: col as number, row: row as number });
	}
	return widgets;
}

/** 새 위젯의 id: 종류 이름에 겹치지 않는 번호 */
export function newWidgetId(kind: WidgetKind, taken: readonly { id: string }[]): string {
	const ids = new Set(taken.map((widget) => widget.id));
	if (!ids.has(kind)) return kind;
	let n = 2;
	while (ids.has(`${kind}-${n}`)) n++;
	return `${kind}-${n}`;
}
