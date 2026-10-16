// bento 격자 짜기: 12칸 격자에 크기가 다른 타일을 차례대로 놓되, 어느 줄도 비는 칸 없이 꽉 차게 너비를 고른다.
// 줄 나누기는 동적 계획법으로: 줄마다 타일이 바라는 너비와 실제 너비의 차이의 제곱(넓히는 몫을 고르게 나누고, 좁아지는 쪽은 여섯 배 무겁게)와 홀로 남는 타일의 벌점을 더해
// 가장 작은 나누기를 고른다. 화면 폭(넓음·중간·좁음)마다 따로 짜서 CSS 변수(--lg·--md·--sm)로 넘긴다. 시험은 layout.test.ts
import type React from 'react';

export const COLUMNS = 12;

/** 타일 크기: 숫자 하나(stat), 아이콘 항목(item), 그림이나 목록이 있는 넓은 타일(wide), 한 줄 전체(full) */
export type TileSize = 'stat' | 'item' | 'wide' | 'full';

export type Breakpoint = 'lg' | 'md' | 'sm';

/** 폭마다 크기별로 바라는 너비 */
const BASE: Record<Breakpoint, Record<TileSize, number>> = {
	lg: { stat: 3, item: 4, wide: 6, full: 12 },
	md: { stat: 4, item: 6, wide: 12, full: 12 },
	sm: { stat: 6, item: 12, wide: 12, full: 12 },
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

/** 놓인 타일 하나: 폭마다의 너비, 넓은 폭에서 차지하는 줄 수, 놓이는 차례 */
export interface Placement {
	id: string;
	lg: number;
	md: number;
	sm: number;
	/** 넓은 폭에서의 줄 수 (머리 타일만 2) */
	rows: number;
	order: number;
}

/**
 * 첫 격자(bento) 짜기. lead가 있으면 넓은 폭에서 머리 타일(8칸, 두 줄)의 오른쪽에 그다음 두 타일을 위아래로 쌓는다.
 * 나머지는 packSpans로 줄마다 꽉 채운다. 중간·좁은 폭에서는 머리 타일이 한 줄 전체다
 */
export function composeBento(tiles: TileSpec[], { lead = false } = {}): Placement[] {
	if (tiles.length === 0) return [];
	const placed: Placement[] = [];
	let rest = tiles;
	const lgPrefix: { id: string; lg: number; rows: number }[] = [];
	if (lead) {
		const [head, ...others] = tiles;
		const side = others.slice(0, 2).filter((tile) => tile.size !== 'full');
		const sideCount = side.length === 2 ? 2 : side.length === 1 && others[0].size !== 'full' ? 1 : 0;
		if (sideCount === 2) {
			lgPrefix.push({ id: head.id, lg: 8, rows: 2 }, ...side.map((t) => ({ id: t.id, lg: 4, rows: 1 })));
		} else if (sideCount === 1) {
			lgPrefix.push({ id: head.id, lg: 8, rows: 1 }, { id: others[0].id, lg: 4, rows: 1 });
		} else {
			lgPrefix.push({ id: head.id, lg: 12, rows: 1 });
		}
		rest = tiles.slice(lgPrefix.length);
	}
	// 중간·좁은 폭: 머리 타일은 전체, 나머지는 그대로 줄 채우기
	const narrowSizes = tiles.map((tile, i) => (lead && i === 0 ? 'full' : tile.size));
	const md = packSpans(
		narrowSizes.map((size) => BASE.md[size]),
		ALLOWED.md,
		narrowSizes.map(groupOf)
	);
	const sm = packSpans(
		narrowSizes.map((size) => BASE.sm[size]),
		ALLOWED.sm,
		narrowSizes.map(groupOf)
	);
	const lgRest = packSpans(
		rest.map((tile) => BASE.lg[tile.size]),
		ALLOWED.lg,
		rest.map((tile) => groupOf(tile.size))
	);
	const lg = [...lgPrefix.map((p) => p.lg), ...lgRest];
	const rows = [...lgPrefix.map((p) => p.rows), ...rest.map(() => 1)];
	tiles.forEach((tile, i) =>
		placed.push({ id: tile.id, lg: lg[i], md: md[i], sm: sm[i], rows: rows[i], order: i + 1 })
	);
	return placed;
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
export const placementStyle = (p: Pick<Placement, 'lg' | 'md' | 'sm' | 'rows' | 'order'>) =>
	({ '--lg': p.lg, '--md': p.md, '--sm': p.sm, '--rows': p.rows, '--order': p.order }) as React.CSSProperties;

/** 첫 격자에 들어가는 것: 주요 기능, 숫자, 화면 모음, 기술(쓴 기술), 맡은 일. 나머지 구역은 그 아래 따로 놓인다 */
export interface BentoInput {
	features: { media: unknown[] }[];
	facts: number;
	screens: boolean;
	stack: number;
	role: { contributions: number } | null;
}

/**
 * 첫 격자의 타일 차례와 자리. 머리 타일이 있으면: 머리 기능 → 그 옆에 쌓을 그림 없는 기능 둘(모자라면 숫자) → 숫자 줄 →
 * 나머지 기능 → 쓴 기술 → 맡은 일 → 화면 모음. 없으면 기능 → 숫자 → 쓴 기술 → 맡은 일 → 화면 모음
 */
export function bentoOf({ features, facts, screens, stack, role }: BentoInput): {
	lead: boolean;
	placements: Map<string, Placement>;
} {
	const featureTiles: TileSpec[] = features.map((feature, i) => ({
		id: `feature-${i}`,
		size: feature.media.length ? 'wide' : 'item',
	}));
	const statTiles: TileSpec[] = Array.from({ length: facts }, (_, i) => ({ id: `stat-${i}`, size: 'stat' }));
	const tail: TileSpec[] = [];
	if (stack) tail.push({ id: 'tech', size: stack > 4 ? 'wide' : 'item' });
	if (role) tail.push({ id: 'role', size: role.contributions > 2 ? 'wide' : 'item' });
	if (screens) tail.push({ id: 'screens', size: 'full' });

	// 머리 타일: 첫 기능에 그림이 있거나, 옆에 쌓을 작은 타일(그림 없는 기능, 숫자)이 둘 이상일 때
	const [head, ...others] = featureTiles;
	const small = others.filter((tile) => tile.size === 'item');
	const side = [...small, ...statTiles].slice(0, 2);
	const lead = Boolean(head) && (head.size === 'wide' || side.length >= 2);
	const tiles = lead
		? [
				head,
				...side,
				...statTiles.filter((tile) => !side.includes(tile)),
				...others.filter((tile) => !side.includes(tile)),
				...tail,
			]
		: [...featureTiles, ...statTiles, ...tail];
	return { lead, placements: new Map(composeBento(tiles, { lead }).map((p) => [p.id, p])) };
}
