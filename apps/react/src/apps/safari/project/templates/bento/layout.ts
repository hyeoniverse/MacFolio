// bento 보드 짜기: 12칸 격자에 크기가 다른 타일을 차례대로 놓되, 어느 줄도 비는 칸 없이 꽉 차게 너비를 고른다.
// 줄 나누기는 동적 계획법으로: 줄마다 타일이 바라는 너비와 실제 너비의 차이의 제곱(넓히는 몫을 고르게 나누고, 좁아지는 쪽은 여섯 배 무겁게)와 홀로 남는 타일의 벌점을 더해
// 가장 작은 나누기를 고른다. 화면 폭(넓음·중간·좁음)마다 따로 짜서 CSS 변수(--lg·--md·--sm)로 넘긴다. 시험은 layout.test.ts
import type React from 'react';

export const COLUMNS = 12;

/** 타일 크기: 넷이 한 줄인 작은 타일(small), 숫자 하나(stat), 셋이 한 줄인 타일(item), 둘이 한 줄인 넓은 타일(wide), 한 줄 전체(full) */
export type TileSize = 'small' | 'stat' | 'item' | 'wide' | 'full';

export type Breakpoint = 'lg' | 'md' | 'sm';

/** 폭마다 크기별로 바라는 너비 */
const BASE: Record<Breakpoint, Record<TileSize, number>> = {
	lg: { small: 3, stat: 3, item: 4, wide: 6, full: 12 },
	md: { small: 6, stat: 4, item: 6, wide: 12, full: 12 },
	sm: { small: 12, stat: 6, item: 12, wide: 12, full: 12 },
};

/** 폭마다 쓸 수 있는 너비 (보기 좋은 비율만: 4분의 1, 3분의 1, 절반, 3분의 2, 4분의 3, 전체) */
const ALLOWED: Record<Breakpoint, number[]> = {
	lg: [3, 4, 6, 8, 9, 12],
	md: [4, 6, 8, 12],
	sm: [6, 12],
};

/** 홀로 한 줄을 차지하는 작은 타일의 벌점 (넷이면 셋 하나 대신 둘 둘로) */
const LONE = 8;
/** 숫자 타일과 다른 타일이 한 줄에 섞이는 벌점 (숫자 줄은 키가 낮아 큰 타일 옆에서 텅 빈다) */
const MIX = 100;
const MAX_PER_ROW = 4;

/** 이 너비 묶음으로 cols를 꽉 채우는 모든 방법 (k개, 차례 있음) */
function compositions(allowed: number[], k: number, cols: number): number[][] {
	if (k === 0) return cols === 0 ? [[]] : [];
	const out: number[][] = [];
	for (const span of allowed) {
		if (span > cols) continue;
		for (const rest of compositions(allowed, k - 1, cols - span)) out.push([span, ...rest]);
	}
	return out;
}

const minOf = (base: number, allowed: number[]) =>
	base >= COLUMNS ? COLUMNS : Math.max(allowed[0], Math.ceil(base / 2));

/** 한 줄의 가장 좋은 너비와 그 비용 (채울 수 없으면 Infinity) */
function bestRow(bases: number[], allowed: number[], groups: string[]): { spans: number[]; cost: number } {
	let best = { spans: [] as number[], cost: Infinity, weight: 0 };
	for (const spans of compositions(allowed, bases.length, COLUMNS)) {
		let cost = 0;
		for (let i = 0; i < spans.length; i++) {
			if (spans[i] < minOf(bases[i], allowed)) {
				cost = Infinity;
				break;
			}
			const diff = spans[i] - bases[i];
			cost += diff < 0 ? diff * diff * 6 : diff * diff;
		}
		if (bases.length === 1 && bases[0] < COLUMNS) cost += LONE;
		if (new Set(groups).size > 1) cost += MIX;
		// 비용이 같으면 크게 바라는 타일이 더 넓은 쪽 (그림 타일 8칸 + 아이콘 타일 4칸)
		const weight = spans.reduce((sum, span, i) => sum + span * bases[i], 0);
		if (cost < best.cost || (cost === best.cost && weight > best.weight)) best = { spans, cost, weight };
	}
	return best;
}

/** 바라는 너비 차례 → 줄마다 꽉 차는 실제 너비 (같은 차례). 타일은 줄을 건너뛰지 않는다 */
export function packSpans(bases: number[], allowed: number[] = ALLOWED.lg, groups: string[] = []): number[] {
	const n = bases.length;
	const cost = new Array<number>(n + 1).fill(Infinity);
	const from = new Array<number>(n + 1).fill(0);
	const rows: number[][] = new Array(n + 1);
	cost[0] = 0;
	for (let end = 1; end <= n; end++)
		for (let start = Math.max(0, end - MAX_PER_ROW); start < end; start++) {
			if (cost[start] === Infinity) continue;
			const row = bestRow(bases.slice(start, end), allowed, groups.slice(start, end));
			const total = cost[start] + row.cost;
			if (total < cost[end]) {
				cost[end] = total;
				from[end] = start;
				rows[end] = row.spans;
			}
		}
	const spans: number[] = [];
	for (let end = n; end > 0; end = from[end]) spans.unshift(...rows[end]);
	return spans;
}

const groupOf = (size: TileSize) => (size === 'stat' ? 'stat' : 'tile');

/** 크기 차례 → 폭마다의 너비 */
export function packSizes(sizes: TileSize[]): Record<Breakpoint, number[]> {
	const at = (bp: Breakpoint) =>
		packSpans(
			sizes.map((size) => BASE[bp][size]),
			ALLOWED[bp],
			sizes.map(groupOf)
		);
	return { lg: at('lg'), md: at('md'), sm: at('sm') };
}

export interface TileSpec {
	id: string;
	size: TileSize;
}

/** 놓인 타일 하나: 폭마다의 너비, 넓은 폭에서 차지하는 줄 수 */
export interface Placement {
	id: string;
	lg: number;
	md: number;
	sm: number;
	/** 넓은 폭에서의 줄 수 (머리 타일만 2) */
	rows: number;
}

/**
 * 타일 차례 → 자리. side가 1이나 2면 넓은 폭에서 첫 타일(머리)을 8칸에 두고 그다음 side개를 오른쪽 4칸에 위아래로 쌓는다
 * (둘이면 머리는 두 줄 높이). 나머지는 packSpans로 줄마다 꽉 채운다. 중간·좁은 폭에서 머리 타일은 한 줄 전체다
 */
export function composeBoard(tiles: TileSpec[], side: 0 | 1 | 2 = 0): Placement[] {
	if (tiles.length === 0) return [];
	const lead = side > 0 && tiles.length > side;
	const prefix = lead ? [8, ...Array.from({ length: side }, () => 4)] : [];
	const rest = tiles.slice(prefix.length);
	const lgRest = packSpans(
		rest.map((tile) => BASE.lg[tile.size]),
		ALLOWED.lg,
		rest.map((tile) => groupOf(tile.size))
	);
	const narrow = tiles.map((tile, i) => (lead && i === 0 ? 'full' : tile.size));
	const at = (bp: 'md' | 'sm') =>
		packSpans(
			narrow.map((size) => BASE[bp][size]),
			ALLOWED[bp],
			narrow.map(groupOf)
		);
	const md = at('md');
	const sm = at('sm');
	const lg = [...prefix, ...lgRest];
	return tiles.map((tile, i) => ({
		id: tile.id,
		lg: lg[i],
		md: md[i],
		sm: sm[i],
		rows: lead && i === 0 && side === 2 ? 2 : 1,
	}));
}

/** 머리 타일 옆에 쌓을 수 있는 타일: 대표 화면과 숫자 (키가 낮아도 꽉 차 보이는 것) */
const SIDE_IDS = new Set(['shot', 'stats']);

/** 구역마다의 타일 크기 (넓은 폭): 내용이 많은 구역은 넓게, 짧은 목록은 넷이 한 줄 */
export const SECTION_SIZES: Record<string, TileSize> = {
	stats: 'item',
	features: 'wide',
	screens: 'wide',
	steps: 'item',
	built: 'item',
	troubleshooting: 'item',
	stories: 'small',
	controls: 'small',
	tech: 'small',
	team: 'small',
	role: 'small',
	timeline: 'small',
	deployments: 'small',
	credits: 'small',
};

/**
 * 보드 전체: 머리(hero) → 대표 화면(shot) → 구역들(차례 그대로) → 마무리(closing, 한 줄 전체).
 * 머리 바로 뒤에 대표 화면이나 숫자가 있으면 그것들을 머리 오른쪽에 쌓는다
 */
export function boardOf({ shot, sections }: { shot: boolean; sections: string[] }): Map<string, Placement> {
	const tiles: TileSpec[] = [
		{ id: 'hero', size: 'full' },
		...(shot ? [{ id: 'shot', size: 'item' as TileSize }] : []),
		...sections.map((id) => ({ id, size: SECTION_SIZES[id] ?? 'item' })),
		{ id: 'closing', size: 'full' },
	];
	let side = 0;
	while (side < 2 && SIDE_IDS.has(tiles[side + 1]?.id)) side++;
	return new Map(composeBoard(tiles, side as 0 | 1 | 2).map((p) => [p.id, p]));
}

/** 줄마다 합이 12인지 (시험과 개발 중 확인용): 너비 차례 → 줄 묶음 */
export function rowsOf(spans: number[]): number[][] {
	const rows: number[][] = [];
	let row: number[] = [];
	let sum = 0;
	for (const span of spans) {
		row.push(span);
		sum += span;
		if (sum >= COLUMNS) {
			rows.push(row);
			row = [];
			sum = 0;
		}
	}
	if (row.length) rows.push(row);
	return rows;
}

/** 타일 하나에 다는 CSS 변수 */
export const placementStyle = (p: Pick<Placement, 'lg' | 'md' | 'sm' | 'rows'>) =>
	({ '--lg': p.lg, '--md': p.md, '--sm': p.sm, '--rows': p.rows }) as React.CSSProperties;
