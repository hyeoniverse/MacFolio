// RPG 대화창(DialoguePage) 뒤의 픽셀 장면: 게임 화면 전체(창 크기에 따라 폭·높이가 달라진다)를 16×16 타일과 손으로 놓은 소품으로 칠한다.
// 장면은 480×272 판을 기준으로 짰고, 다른 크기에서는 늘려 맞춘다: 하늘·땅·바닥 타일 같은 띠는 폭과 높이를 따라 이어 칠하고,
// 소품은 기준 판의 왼쪽·가운데·오른쪽 중 가까운 쪽에 붙여(map.L·C·R) 넓은 화면과 좁은 화면 모두에서 짜임새가 맞다.
// 하늘이 있는 바깥 장면은 화면이 높으면 지평선을 조금 내리고 위쪽 하늘을 이어 칠한다(shift).
// 칸마다 색 대신 팔레트 글자(한 글자)를 두고, 장면마다 낮 팔레트와 밤 팔레트(같은 그림의 색 바꿈)로 칠한다.
// 규칙: 빛은 왼쪽 위에서 (밝은 면은 왼쪽 위, 그늘은 오른쪽 아래), 외곽선은 채운 색보다 짙게, 흐림 없이 한 칸 단위,
// 섞이는 곳은 점 무늬(디더)로. 모두 정해진 그림이라(난수 없이 칸 좌표의 해시) 같은 장면·크기는 늘 같은 모습이고, 한 번 칠한 장면은 기억해 둔다
import type { SceneKind } from '@/apps/safari/project/dialogueStage';
import { GLYPHS, ICONS, type IconName } from '@/apps/safari/project/dialogueIcons';

/** 기준 판의 크기: 소품 자리는 이 판에서 정하고, 다른 크기에서는 왼쪽·가운데·오른쪽에 붙여 옮긴다 */
export const SCENE_W = 480;
export const SCENE_H = 272;
export const TILE = 16;

/** 칸 그림 (글자 하나가 한 칸, '.'은 빈칸) */
type Rows = readonly string[];

/**
 * 팔레트 글자로 칠하는 판 (w×h). 소품 자리는 480×272 기준 판의 좌표로 적고 L·C·R로 옮긴다:
 * L은 왼쪽에 붙인 그대로, C는 가운데를 맞추고, R은 오른쪽 끝을 맞춘다.
 * shift만큼 그림 전체를 아래로 내린다 (칠하는 y는 그대로 두고 판에 놓을 때 더한다). 그래서 기준 판의 위쪽(top)은 0보다 위, 아래쪽(bottom)은 h − shift
 */
export class PixelMap {
	readonly px: string[];
	readonly w: number;
	readonly h: number;
	readonly shift: number;
	constructor(w: number, h: number, fill = '.', shift = 0) {
		this.w = w;
		this.h = h;
		this.shift = shift;
		this.px = new Array<string>(w * h).fill(fill);
	}
	/** 그림 좌표로 본 판의 위 끝과 아래 끝 */
	get top(): number {
		return -this.shift;
	}
	get bottom(): number {
		return this.h - this.shift;
	}
	/** 판을 덮는 타일 수 (가로, 세로) */
	get tw(): number {
		return Math.ceil(this.w / TILE);
	}
	get th(): number {
		return Math.ceil(this.bottom / TILE);
	}
	L(x: number): number {
		return x;
	}
	C(x: number): number {
		return x + Math.round((this.w - SCENE_W) / 2);
	}
	R(x: number): number {
		return x + this.w - SCENE_W;
	}
	get(x: number, y: number): string {
		const py = y + this.shift;
		return x < 0 || py < 0 || x >= this.w || py >= this.h ? '.' : this.px[py * this.w + x];
	}
	set(x: number, y: number, key: string) {
		const py = y + this.shift;
		if (key === '.' || x < 0 || py < 0 || x >= this.w || py >= this.h) return;
		this.px[py * this.w + x] = key;
	}
	rect(x: number, y: number, w: number, h: number, key: string) {
		for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, key);
	}
	/** 칸 그림을 (x, y)에 찍는다. flip이면 좌우를 뒤집고, remap으로 글자를 바꿔 찍는다 */
	stamp(rows: Rows, x: number, y: number, flip = false, remap?: Record<string, string>) {
		rows.forEach((row, j) => {
			const cells = [...row];
			cells.forEach((cell, i) => {
				const key = remap?.[cell] ?? cell;
				this.set(flip ? x + cells.length - 1 - i : x + i, y + j, key);
			});
		});
	}
}

/** 칸 좌표의 해시 (0 이상 1 미만): 정해진 흩뿌림에 쓴다 */
export function noise(x: number, y: number, seed = 0): number {
	let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** 4×4 바이어 점 무늬의 문턱 (0 이상 1 미만) */
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;
export const checker = (x: number, y: number) => (x + y) % 2 === 0;

/** 부드러운 해시 (cell칸 격자의 해시를 이어 붙인다): 풀밭의 짙은 얼룩 같은 큰 무늬에 */
function smoothNoise(x: number, y: number, cell: number, seed: number): number {
	const gx = Math.floor(x / cell);
	const gy = Math.floor(y / cell);
	const fx = x / cell - gx;
	const fy = y / cell - gy;
	const ease = (t: number) => t * t * (3 - 2 * t);
	const a = noise(gx, gy, seed);
	const b = noise(gx + 1, gy, seed);
	const c = noise(gx, gy + 1, seed);
	const d = noise(gx + 1, gy + 1, seed);
	const top = a + (b - a) * ease(fx);
	const bottom = c + (d - c) * ease(fx);
	return top + (bottom - top) * ease(fy);
}

// ─── 그리는 도구 ───

/** 하늘: 위에서부터 띠(글자, 끝 y). 띠 사이 세 줄은 점 무늬로 섞는다 */
function sky(map: PixelMap, bands: [string, number][], from = map.top) {
	let top = from;
	bands.forEach(([key, end], b) => {
		const next = bands[b + 1]?.[0];
		for (let y = top; y < end; y++) {
			const left = end - y;
			const t = next && left <= 3 ? (4 - left) / 4 : 0;
			for (let x = 0; x < map.w; x++) map.set(x, y, t > 0 && bayer(x, y) < t ? next : key);
		}
		top = end;
	});
}

/** 부드러운 언덕 높이: 코사인 몇 개를 더한다 (주기는 칸 단위) */
const wave =
	(base: number, parts: [amp: number, period: number, phase: number][]) =>
	(x: number): number =>
		Math.round(
			base - parts.reduce((sum, [amp, period, phase]) => sum + amp * Math.cos(((x + phase) / period) * Math.PI * 2), 0)
		);

/**
 * 언덕: x마다 꼭대기(top(x))부터 bottom까지 칠한다. 꼭대기 한 칸은 외곽선(outline), 그 아래 두 칸은 밝은 면(rim),
 * 오른쪽으로 내려가는 비탈(빛 반대쪽)은 꼭대기 근처를 그늘(shade)로 점 무늬 섞기
 */
function hills(
	map: PixelMap,
	top: (x: number) => number,
	bottom: number,
	keys: { fill: string; rim?: string; shade?: string; outline?: string }
) {
	for (let x = 0; x < map.w; x++) {
		const t = top(x);
		const slope = top(x + 4) - t;
		for (let y = Math.max(map.top, t); y < bottom; y++) {
			const depth = y - t;
			let key = keys.fill;
			if (keys.outline && depth === 0) key = keys.outline;
			else if (keys.shade && slope > 0 && depth < 2 + slope * 2)
				key = depth < 1 + slope || checker(x, y) ? keys.shade : keys.fill;
			else if (keys.rim && slope <= 0 && depth <= (keys.outline ? 2 : 1)) key = keys.rim;
			else if (keys.rim && slope <= 0 && depth === (keys.outline ? 3 : 2) && checker(x, y)) key = keys.rim;
			map.set(x, y, key);
		}
	}
}

/** 둥근 덩어리(나무 수관, 덤불, 바위, 구름)의 색 글자 */
export interface ClumpKeys {
	hi: string;
	base: string;
	shade: string;
	/** 앞 덩어리 아래·오른쪽에 지는 그늘 줄 */
	line?: string;
	/** 바깥 외곽선 */
	outline?: string;
}

/**
 * 원 여러 개를 겹친 덩어리: 뒤에서 앞 차례로 겹치고, 원마다 왼쪽 위는 밝게 오른쪽 아래는 그늘(사이는 점 무늬).
 * 앞 원의 아래·오른쪽에 닿은 뒤 원의 칸은 그늘 줄, 덩어리 둘레는 외곽선. floor가 있으면 그 아래는 자른다 (구름의 납작한 밑)
 */
export function clump(map: PixelMap, circles: [cx: number, cy: number, r: number][], keys: ClumpKeys, floor?: number) {
	const xs = circles.map(([cx, , r]) => [cx - r - 2, cx + r + 2]);
	const ys = circles.map(([, cy, r]) => [cy - r - 2, cy + r + 2]);
	const x0 = Math.floor(Math.min(...xs.map((v) => v[0])));
	const x1 = Math.ceil(Math.max(...xs.map((v) => v[1])));
	const y0 = Math.floor(Math.min(...ys.map((v) => v[0])));
	const y1 = Math.ceil(Math.max(...ys.map((v) => v[1])));
	const w = x1 - x0 + 1;
	const h = y1 - y0 + 1;
	const owner = new Int16Array(w * h).fill(-1);
	const ownerAt = (x: number, y: number) => (x < x0 || y < y0 || x > x1 || y > y1 ? -1 : owner[(y - y0) * w + x - x0]);
	circles.forEach(([cx, cy, r], i) => {
		for (let y = y0; y <= y1; y++) {
			if (floor !== undefined && y > floor) continue;
			for (let x = x0; x <= x1; x++) {
				if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) owner[(y - y0) * w + x - x0] = i;
			}
		}
	});
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const i = ownerAt(x, y);
			if (i < 0) {
				if (
					keys.outline &&
					(ownerAt(x - 1, y) >= 0 || ownerAt(x + 1, y) >= 0 || ownerAt(x, y - 1) >= 0 || ownerAt(x, y + 1) >= 0)
				)
					map.set(x, y, keys.outline);
				continue;
			}
			const [cx, cy, r] = circles[i];
			const lx = x + 0.5 - cx;
			const ly = y + 0.5 - cy;
			// 빛 쪽(왼쪽 위)으로 비낀 원 둘: 작은 원 안은 밝게, 큰 원 밖은 그늘, 그늘 경계 한 줄은 점 무늬
			const lit = Math.sqrt((lx + 0.22 * r) ** 2 + (ly + 0.28 * r) ** 2) - 0.92 * r;
			const hi =
				Math.sqrt((lx + 0.34 * r) ** 2 + (ly + 0.42 * r) ** 2) < 0.46 * r + noise(x >> 1, y >> 1, i) * 2.2 - 0.8;
			let key = keys.base;
			if (hi) key = noise(x, y, i + 3) < 0.07 ? keys.base : keys.hi;
			else if (lit > 0.6) key = keys.shade;
			else if (lit > -0.6) key = checker(x, y) ? keys.shade : keys.base;
			else if (noise(x, y, i + 9) < 0.05) key = keys.shade;
			if (keys.line && (ownerAt(x, y - 1) > i || ownerAt(x - 1, y) > i)) key = keys.line;
			map.set(x, y, key);
		}
	}
}

/** 둥근 나무: 줄기와 원 덩어리 수관, 발밑 그림자. (x, y)는 줄기 밑 가운데, size는 수관 반지름 */
export function tree(
	map: PixelMap,
	x: number,
	y: number,
	size: number,
	keys: ClumpKeys & { trunk?: boolean },
	shadow?: string
) {
	if (shadow) {
		for (let j = -2; j <= 1; j++) {
			const half = Math.round(size * 0.9 * Math.sqrt(1 - (j / 2.5) ** 2));
			for (let i = -half; i <= half; i++) map.set(x + i + 1, y + j, shadow);
		}
	}
	const trunkH = Math.round(size * 0.9);
	map.rect(x - 3, y - trunkH, 6, trunkH, 'n');
	map.rect(x - 3, y - trunkH, 1, trunkH, 'N');
	map.rect(x + 2, y - trunkH, 1, trunkH, 'N');
	map.rect(x - 2, y - trunkH, 1, trunkH, 'o');
	map.rect(x - 4, y - 1, 1, 1, 'N');
	map.rect(x + 3, y - 1, 1, 1, 'N');
	map.rect(x - 3, y - 1, 6, 1, 'N');
	const cy = y - trunkH - size * 0.7;
	const s = size;
	clump(
		map,
		[
			[x - s * 0.55, cy + s * 0.15, s * 0.62],
			[x + s * 0.55, cy + s * 0.2, s * 0.6],
			[x, cy - s * 0.35, s * 0.68],
			[x - s * 0.15, cy + s * 0.35, s * 0.6],
		],
		keys
	);
}

/** 뾰족한 침엽수 (빛 쪽 반은 밝게). (x, y)는 밑 가운데 */
export function pine(
	map: PixelMap,
	x: number,
	y: number,
	height: number,
	keys: { hi: string; base: string; shade: string; outline: string }
) {
	map.rect(x - 1, y - 3, 3, 3, 'N');
	const tiers = 3;
	const tierH = Math.round((height - 3) / tiers);
	for (let t = 0; t < tiers; t++) {
		const top = y - 3 - height + 3 + t * tierH * 0.8;
		const bottom = top + tierH + 4;
		for (let j = Math.round(top); j <= bottom; j++) {
			const half = Math.round(((j - top) / (bottom - top)) * (4 + t * 2.2));
			for (let i = -half; i <= half; i++) {
				const edge = i === -half || i === half || j === bottom;
				const key = edge
					? keys.outline
					: i < 0
						? i > -half + 1 || j - top < 2
							? keys.hi
							: keys.base
						: i < half - 1
							? keys.base
							: keys.shade;
				map.set(x + i, j, key);
			}
		}
	}
}

/** 구름: 납작한 밑의 덩어리, 아래 두 줄은 그늘 */
function cloud(map: PixelMap, x: number, y: number, w: number, keys: { hi: string; shade: string; outline?: string }) {
	const r = w / 6;
	clump(
		map,
		[
			[x + r * 1.2, y + r * 0.4, r * 1.1],
			[x + r * 2.8, y - r * 0.3, r * 1.5],
			[x + r * 4.5, y + r * 0.2, r * 1.2],
			[x + r * 3.4, y + r * 0.6, r * 1.0],
		],
		{ hi: keys.hi, base: keys.hi, shade: keys.shade, outline: keys.outline },
		Math.round(y + r * 1.2)
	);
}

/** 작은 꽃 (꽃잎 글자, 가운데 글자). 바람에 흔들리지 않는 정해진 모양 */
const FLOWER: Rows = ['.a.', 'aba', '.a.', '.d.'];
export function flower(map: PixelMap, x: number, y: number, petal: string, center: string, stem = 'd') {
	map.stamp(FLOWER, x, y, false, { a: petal, b: center, d: stem });
}

/** 풀 한 포기: 밝은 끝 둘과 그늘 둘 */
export function tuft(map: PixelMap, x: number, y: number, hi: string, shade: string) {
	map.set(x, y, hi);
	map.set(x + 2, y, hi);
	map.set(x + 1, y + 1, shade);
	map.set(x + 3, y + 1, shade);
}

// ─── 16×16 타일 ───

/** 타일을 판에 찍는다 */
export function tileAt(map: PixelMap, tile: Rows, tx: number, ty: number) {
	map.stamp(tile, tx * TILE, ty * TILE);
}

/** 칸 그림 만들기 도우미: (x, y) → 글자 */
const makeTile = (cell: (x: number, y: number) => string, w = TILE, h = TILE): string[] =>
	Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => cell(x, y)).join(''));

/** 풀밭 타일 세 가지: 바탕에 풀 포기(밝은 끝, 그늘) 몇 개 */
export const GRASS_TILES: readonly Rows[] = [
	[
		'gggggggggggggggg',
		'gggggggggggggggg',
		'ggGgGggggggggggg',
		'gggdgdgggggggggg',
		'gggggggggggggggg',
		'gggggggggggGgGgg',
		'ggggggggggggdgdg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggGgGgggggggggg',
		'ggggdgdggggggggg',
		'gggggggggggggggg',
		'ggggggggggGgGggg',
		'gggggggggggdgdgg',
		'gggggggggggggggg',
	],
	[
		'gggggggggggggggg',
		'ggggggggggGgGggg',
		'gggggggggggdgdgg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gGgGgggggggggggg',
		'ggdgdggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggGgGgggg',
		'ggggggggggdgdggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggGgGgggggggggg',
		'ggggdgdggggggggg',
		'gggggggggggggggg',
	],
	[
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggGgGgggggggg',
		'ggggggdgdggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggGgGgg',
		'ggggggggggggdgdg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
		'gggggggggggggggg',
	],
];

/** 포켓몬의 긴 풀 타일: 엇갈린 두 줄의 뾰족한 잎(왼쪽 밝고 오른쪽 그늘), 잎 둘레는 짙은 선, 틈은 그늘 */
export const TALL_GRASS: Rows = (() => {
	const grid = Array.from({ length: TILE }, () => new Array<string>(TILE).fill('.'));
	const blade = (bx: number, top: number, height: number) => {
		for (let j = 0; j < height; j++) {
			const half = Math.min(3, Math.floor((j + 1) / 2));
			for (let i = -half; i <= half; i++) {
				const x = (bx + i + TILE) % TILE;
				const y = top + j;
				if (y < 0 || y >= TILE) continue;
				grid[y][x] = i < -1 || (i === -1 && j < 6) ? 'G' : i <= 0 ? (j < 2 ? 'G' : 'g') : i === 1 && j < 5 ? 'g' : 'd';
			}
		}
	};
	for (const bx of [4, 12]) blade(bx, 0, 9);
	for (const bx of [0, 8]) blade(bx, 7, 9);
	return grid.map((row, y) =>
		row
			.map((cell, x) => {
				if (cell !== '.') return cell;
				const near = [
					[x - 1, y],
					[x + 1, y],
					[x, y - 1],
					[x, y + 1],
				].some(([nx, ny]) => grid[ny]?.[(nx + TILE) % TILE] && grid[ny][(nx + TILE) % TILE] !== '.');
				return near ? 'e' : 'd';
			})
			.join('')
	);
})();

/** 돌바닥 타일: 엇갈린 돌 세 줄, 돌마다 왼쪽 위 밝고 오른쪽 아래 그늘, 사이는 줄눈 */
export const COBBLE: Rows = (() => {
	const rows = [
		{ y: 0, h: 5, xs: [0, 8] },
		{ y: 5, h: 5, xs: [4, 12] },
		{ y: 10, h: 6, xs: [2, 10] },
	];
	return makeTile((x, y) => {
		const row = rows.find((r) => y >= r.y && y < r.y + r.h) ?? rows[0];
		const ly = y - row.y;
		const starts = row.xs;
		const start = [...starts].reverse().find((s) => (x - s + 16) % 16 < 8) ?? starts[0];
		const lx = (x - start + 16) % 16;
		const lw = 8;
		if (ly === row.h - 1 || lx === lw - 1) return 'R';
		if ((lx === 0 || lx === lw - 2) && (ly === 0 || ly === row.h - 2)) return 'r';
		if (ly === 0 || lx === 0) return 'S';
		if (ly === row.h - 2 || lx === lw - 2) return 'r';
		return noise(x, y, 7) < 0.05 ? 'r' : 's';
	});
})();

/** 나무 바닥 타일: 가로 판자 네 줄, 판자 이음매는 줄마다 엇갈린다 */
export const PLANKS: Rows = makeTile((x, y) => {
	const ly = y % 4;
	const row = Math.floor(y / 4);
	const seam = [3, 11, 7, 15][row];
	if (ly === 3) return 'N';
	if (x === seam) return 'n';
	if (ly === 0) return 'O';
	return noise(x, row, 3) < 0.18 && ly === 1 ? 'n' : 'o';
});

/** 세로 판자 벽 타일 (여관·상점) */
export const WALL_PLANKS: Rows = makeTile((x, y) => {
	const lx = x % 8;
	if (lx === 7) return 'N';
	if (lx === 0) return 'O';
	const knot = noise(Math.floor(x / 8), 1, 11);
	if (lx === 3 && y === Math.floor(knot * 12) + 2) return 'n';
	return y === 15 && lx === 6 ? 'n' : 'o';
});

/** 물 타일: 바탕에 밝은 물결 줄 */
export const WATER: Rows = makeTile((x, y) => {
	const wave = (x + (y >> 2) * 5) % 16;
	if (y % 8 === 2 && wave >= 2 && wave < 6) return 'U';
	if (y % 8 === 3 && wave >= 5 && wave < 7) return 'v';
	if (y % 8 === 6 && (x + 9) % 16 < 3) return 'U';
	return 'u';
});

/** 동굴 바닥 타일: 바탕 돌에 작은 자갈(밝은 위, 그늘 아래)과 가는 금 */
export const CAVE_FLOOR: Rows = [
	'ssssssssssssssss',
	'ssssssssssssssss',
	'sssSSsssssssssss',
	'sssSrrssssssssss',
	'ssssrsssssssrsss',
	'sssssssssssrssss',
	'ssssssssssrsssss',
	'ssssssssssssssss',
	'ssssssssssssssss',
	'sSsssssssssssSss',
	'srrssssssssssrss',
	'ssssssssSSssssss',
	'ssssssssSrrsssss',
	'sssssssssrssssss',
	'ssssrsssssssssss',
	'ssssssssssssssss',
];

/** 오락실 바닥 카펫 타일: 짙은 바탕에 색 조각 (네온 분홍, 하늘, 노랑) */
export const ARCADE_CARPET: Rows = [
	'zzzzzzzzzzzzzzzz',
	'zzKzzzzzzzzzzzzz',
	'zKqKzzzzzzzzzzzz',
	'zzKzzzzzzzzzzzzz',
	'zzzzzzzzzzzzzzzz',
	'zzzzzzzzzzzVzzzz',
	'zzzzzzzzzzVqVzzz',
	'zzzzzzzzzzzVzzzz',
	'zzzzzzzzzzzzzzzz',
	'zzzzzzzzzzzzzzzz',
	'zzzzzYzzzzzzzzzz',
	'zzzzYqYzzzzzzzzz',
	'zzzzzYzzzzzzzzzz',
	'zzzzzzzzzzzzzzzz',
	'zzzzzzzzzzzzzzzz',
	'zzzzzzzzzzzzzzzz',
];

// ─── 손으로 놓는 소품 ───

/** 집: 기와 지붕(가로 줄), 벽, 창 둘, 문. (x, y)는 지붕 왼쪽 위, w는 벽 너비 */
export function house(
	map: PixelMap,
	x: number,
	y: number,
	w: number,
	roofH: number,
	wallH: number,
	roof: 'X' | 'A' | readonly [string, string, string]
) {
	const [hi, base, dark] = roof === 'X' ? ['X', 'x', 'y'] : roof === 'A' ? ['A', 'a', 'b'] : roof;
	const over = 4;
	// 지붕: 아래로 갈수록 넓어지는 판, 기와 줄은 4칸마다
	for (let j = 0; j < roofH; j++) {
		const inset = Math.max(0, Math.round((roofH - 1 - j) * 0.6)) - 2;
		const left = x - over + Math.max(0, inset);
		const right = x + w + over - 1 - Math.max(0, inset);
		for (let i = left; i <= right; i++) {
			let key = base;
			if (j === 0 || i === left || i === right || j === roofH - 1) key = 'k';
			else if (j % 4 === 0) key = dark;
			else if (j % 4 === 1 && i < left + (right - left) * 0.5) key = hi;
			else if (i >= right - 2) key = dark;
			else if (i <= left + 1) key = hi;
			if (key === base && j % 4 === 3 && (i + j) % 6 === 0) key = dark;
			map.set(i, y + j, key);
		}
	}
	// 벽
	const top = y + roofH;
	for (let j = 0; j < wallH; j++) {
		for (let i = 0; i < w; i++) {
			let key = 'T';
			if (i === 0 || i === w - 1 || j === wallH - 1) key = 'k';
			else if (j === 0) key = 't';
			else if (i >= w - 3) key = 't';
			map.set(x + i, top + j, key);
		}
	}
	// 창 (유리 L, 틀 l, 빛 W)
	const windowAt = (wx: number) => {
		map.rect(wx, top + 4, 10, 9, 'k');
		map.rect(wx + 1, top + 5, 8, 7, 'L');
		map.rect(wx + 1, top + 8, 8, 1, 'l');
		map.rect(wx + 4, top + 5, 1, 7, 'l');
		map.set(wx + 2, top + 6, 'W');
		map.rect(wx, top + 13, 10, 1, 't');
	};
	windowAt(x + 6);
	if (w > 50) windowAt(x + w - 16);
	// 문
	const door = x + Math.round(w / 2) - 6;
	map.rect(door, top + wallH - 17, 12, 16, 'k');
	map.rect(door + 1, top + wallH - 16, 10, 15, 'n');
	map.rect(door + 1, top + wallH - 16, 2, 15, 'o');
	map.rect(door + 8, top + wallH - 9, 1, 2, 'F');
	map.rect(door - 1, top + wallH - 1, 14, 1, 'R');
}

/** 분수: 둥근 돌 수반(위 테두리 밝은 돌, 안은 물, 앞면은 돌 벽), 가운데 기둥과 솟는 물줄기. (x, y)는 수반 왼쪽 위, w는 너비 */
export function fountain(map: PixelMap, x: number, y: number, w: number) {
	const rx = w / 2;
	const ry = Math.round(w / 6);
	const cx = x + rx;
	const cy = y + ry;
	const wall = 9;
	const inEllipse = (px: number, py: number, ex: number, ey: number) =>
		((px + 0.5 - cx) / ex) ** 2 + ((py + 0.5 - cy) / ey) ** 2 <= 1;
	// 앞면 돌 벽 (타원 아래 반을 wall만큼 내린다)
	for (let px = Math.floor(x); px < x + w; px++) {
		for (let py = cy; py < cy + ry + wall + 1; py++) {
			const top = inEllipse(px, py - wall, rx, ry);
			const above = inEllipse(px, py - wall - 1, rx, ry);
			if (!top && !inEllipse(px, py, rx, ry)) continue;
			if (py < cy) continue;
			const bottom = top && !inEllipse(px, py - wall + 1, rx, ry);
			let key = (py - cy) % 5 === 4 ? 'r' : (px + Math.floor((py - cy) / 5) * 5) % 10 === 0 ? 'r' : 's';
			if (px > cx + rx * 0.6) key = 'r';
			if (bottom || !above) key = key === 's' ? 's' : key;
			map.set(px, py, key);
		}
	}
	// 위 테두리와 물
	for (let py = y - 1; py <= cy + ry + 1; py++) {
		for (let px = Math.floor(x) - 1; px <= x + w; px++) {
			if (!inEllipse(px, py, rx, ry)) continue;
			const water = inEllipse(px, py, rx - 4, ry - 2);
			let key = 'S';
			if (water) key = (px * 3 + py * 7) % 13 === 0 ? 'U' : py < cy - 1 ? 'v' : 'u';
			else if (py > cy) key = 's';
			map.set(px, py, key);
		}
	}
	// 둘레 외곽선
	for (let py = y - 2; py <= cy + ry + wall + 2; py++) {
		for (let px = Math.floor(x) - 2; px <= x + w + 1; px++) {
			if (map.get(px, py) === 'k') continue;
			const inside = (qx: number, qy: number) =>
				inEllipse(qx, qy, rx, ry) ||
				(qy >= cy && inEllipse(qx, qy - wall, rx, ry)) ||
				(qy >= cy && qy - cy <= wall && Math.abs(qx + 0.5 - cx) <= rx);
			if (inside(px, py)) continue;
			if (inside(px - 1, py) || inside(px + 1, py) || inside(px, py - 1) || inside(px, py + 1)) map.set(px, py, 'k');
		}
	}
	// 기둥과 물줄기
	map.rect(cx - 4, cy - 16, 8, 16, 'k');
	map.rect(cx - 3, cy - 15, 6, 15, 's');
	map.rect(cx - 3, cy - 15, 2, 15, 'S');
	map.rect(cx + 2, cy - 15, 1, 15, 'r');
	map.rect(cx - 7, cy - 19, 14, 4, 'k');
	map.rect(cx - 6, cy - 18, 12, 2, 'S');
	const spray: [number, number][] = [
		[0, -28],
		[-1, -27],
		[1, -27],
		[0, -26],
		[-1, -25],
		[1, -25],
		[0, -24],
		[0, -23],
		[-3, -25],
		[3, -25],
		[-5, -24],
		[5, -24],
		[-7, -22],
		[7, -22],
		[-8, -20],
		[8, -20],
		[-9, -17],
		[9, -17],
		[-10, -14],
		[10, -14],
		[-10, -11],
		[10, -11],
		[-11, -8],
		[11, -8],
	];
	spray.forEach(([dx, dy]) => map.set(cx + dx, cy + dy, dy < -24 ? 'W' : 'U'));
	map.rect(cx - 1, cy - 23, 2, 4, 'U');
}

/** 울타리 한 줄: 16칸마다 기둥, 가로대 둘 */
export function fence(map: PixelMap, x: number, y: number, w: number) {
	for (const ry of [y + 3, y + 8]) {
		map.rect(x, ry - 1, w, 4, 'N');
		map.rect(x, ry, w, 2, 'o');
		map.rect(x, ry, w, 1, 'O');
	}
	for (let px = x; px <= x + w - 6; px += 16) {
		map.rect(px, y - 2, 6, 16, 'N');
		map.rect(px + 1, y - 1, 4, 14, 'o');
		map.rect(px + 1, y - 1, 1, 14, 'O');
		map.rect(px + 4, y - 1, 1, 14, 'n');
		map.set(px, y - 2, '.');
		map.set(px + 5, y - 2, '.');
	}
}

/** 바위: 둥근 덩어리 (돌 글자) */
export function rock(map: PixelMap, x: number, y: number, r: number) {
	clump(
		map,
		[
			[x, y, r],
			[x + r * 0.8, y + r * 0.3, r * 0.75],
		],
		{ hi: 'S', base: 's', shade: 'r', line: 'r', outline: 'R' }
	);
}

/**
 * 바위 벽: 엇갈린 격자에 흩뿌린 씨앗으로 나눈 모난 돌 조각(보로노이). 조각 사이는 짙은 금, 조각마다 씨앗보다 왼쪽 위는 밝고
 * 오른쪽 아래는 그늘. 위로 갈수록(dimTo보다 위) 한 단 어둡게
 */
function rockWall(map: PixelMap, top: number, bottom: number, cell: number, seed: number, dimTo: number) {
	const rowH = Math.round(cell * 0.7);
	const seeds = new Map<number, [number, number]>();
	const seedAt = (gx: number, gy: number): [number, number] => {
		const id = (gx + 64) * 256 + gy + 64;
		let found = seeds.get(id);
		if (!found) {
			found = [
				gx * cell + (gy % 2 ? cell / 2 : 0) + (noise(gx, gy, seed) - 0.5) * cell * 0.7,
				top + gy * rowH + (noise(gx, gy, seed + 1) - 0.5) * rowH * 0.6,
			];
			seeds.set(id, found);
		}
		return found;
	};
	for (let y = top; y < bottom; y++) {
		const gy = Math.round((y - top) / rowH);
		for (let x = 0; x < map.w; x++) {
			let d1 = Infinity;
			let d2 = Infinity;
			let best: [number, number] = [0, 0];
			for (let j = gy - 1; j <= gy + 1; j++) {
				const gx = Math.round((x - (j % 2 ? cell / 2 : 0)) / cell);
				for (let i = gx - 1; i <= gx + 1; i++) {
					const sd = seedAt(i, j);
					const d = Math.hypot(x + 0.5 - sd[0], (y + 0.5 - sd[1]) * 1.25);
					if (d < d1) {
						d2 = d1;
						d1 = d;
						best = sd;
					} else if (d < d2) d2 = d;
				}
			}
			const dim = best[1] < dimTo;
			let key: string;
			if (d2 - d1 < 1.6) key = 'R';
			else if (d2 - d1 < 3 && (x + y) % 2 === 0) key = 'r';
			else {
				const s = -(x + 0.5 - best[0] + (y + 0.5 - best[1])) / cell;
				if (s > 0.28) key = dim ? 's' : 'S';
				else if (s < -0.3) key = 'r';
				else key = dim ? (checker(x, y) ? 's' : 'r') : 's';
				if (noise(x, y, seed + 5) < 0.03) key = 'r';
			}
			map.set(x, y, key);
		}
	}
}

/** 수정 하나: 위가 뾰족한 육각 기둥, 왼쪽 면 밝고 오른쪽 면 짙다. (x, y)는 밑 가운데 */
function crystal(map: PixelMap, x: number, y: number, h: number, w: number, tilt = 0) {
	const half = Math.floor(w / 2);
	for (let j = 0; j < h; j++) {
		const tip = Math.min(1, j / (half + 1));
		const width = Math.max(1, Math.round(half * tip));
		const shift = Math.round((tilt * (h - j)) / h);
		for (let i = -width; i <= width; i++) {
			const edge = i === -width || i === width || j === h - 1 || j === 0;
			const key = edge ? 'D' : i < 0 ? 'C' : i === 0 ? 'c' : 'c';
			map.set(x + i + shift, y - h + j, key);
		}
		if (j > 2 && j < h - 2) map.set(x - Math.max(0, width - 1) + shift, y - h + j, j % 5 === 0 ? 'W' : 'C');
	}
}

/** 벽 횃불: 나무 손잡이와 불꽃 (Y 밝은 불, E 주황) */
export const TORCH: Rows = [
	'...Y...',
	'..YY...',
	'..YEY..',
	'.YEEY..',
	'.YEEEY.',
	'.EEEEE.',
	'..EEE..',
	'.NNNNN.',
	'.NonnN.',
	'..NnN..',
	'..NnN..',
	'..NnN..',
	'..NnN..',
	'...N...',
];

/** 달: 둥근 몸(M)에 짙은 무늬(m) */
function moon(map: PixelMap, cx: number, cy: number, r: number) {
	for (let y = -r; y <= r; y++) {
		for (let x = -r; x <= r; x++) {
			const d = (x + 0.5) ** 2 + (y + 0.5) ** 2;
			if (d > r * r) continue;
			const crater =
				(x + 4) ** 2 + (y + 2) ** 2 < 9 || (x - 3) ** 2 + (y - 4) ** 2 < 5 || (x - 4) ** 2 + (y + 5) ** 2 < 3;
			map.set(cx + x, cy + y, crater ? 'm' : 'M');
		}
	}
}

/** 별 흩뿌리기: 하늘(top–bottom) 칸 중 해시가 맞는 곳. 몇은 십자 모양으로 반짝인다 */
function stars(map: PixelMap, top: number, bottom: number, density: number, seed: number) {
	for (let y = top; y < bottom; y++) {
		for (let x = 0; x < map.w; x++) {
			const n = noise(x, y, seed);
			if (n > density) continue;
			if (n < density * 0.12 && x > 2 && x < map.w - 3) {
				map.set(x - 1, y, 'z');
				map.set(x + 1, y, 'z');
				map.set(x, y - 1, 'z');
				map.set(x, y + 1, 'z');
			}
			map.set(x, y, 'Z');
		}
	}
}

/** 선반: 나무 판 세 단에 아이템(픽셀 아이콘)을 올린다. (x, y)는 왼쪽 위 */
function shelf(map: PixelMap, x: number, y: number, w: number, items: IconName[][]) {
	const h = 16 * items.length + 6;
	map.rect(x, y, w, h, 'N');
	map.rect(x + 2, y + 2, w - 4, h - 4, 'n');
	items.forEach((row, r) => {
		const by = y + 2 + (r + 1) * 16;
		map.rect(x + 2, by - 1, w - 4, 3, 'o');
		map.rect(x + 2, by - 1, w - 4, 1, 'O');
		map.rect(x + 2, by + 2, w - 4, 1, 'N');
		row.forEach((name, i) => {
			const icon = ICONS[name];
			map.stamp(icon, x + 4 + i * 13, by - 13, false, ICON_REMAP);
		});
	});
}

/** 아이콘 색 글자 → 장면 팔레트의 아이템 색 글자 (상점 선반의 물건) */
export const ICON_REMAP: Record<string, string> = {
	k: '0',
	w: '%',
	l: '&',
	g: '(',
	d: ')',
	r: '[',
	R: ']',
	o: '{',
	y: '}',
	Y: '<',
	G: '>',
	D: '?',
	b: '!',
	B: '"',
	c: '#',
	p: '$',
	P: "'",
	n: '*',
	N: '+',
	s: ',',
	m: '-',
};

/** 아이템 색 글자의 색 (상점 선반) */
export const ITEM_COLORS: Record<string, string> = {
	'0': '#1c1c28',
	'%': '#ffffff',
	'&': '#c8d0dc',
	'(': '#8890a0',
	')': '#4c5468',
	'[': '#e83c3c',
	']': '#a02434',
	'{': '#f08c34',
	'}': '#f8d040',
	'<': '#c88c1c',
	'>': '#58c858',
	'?': '#2c8040',
	'!': '#4c8cf0',
	'"': '#2c54b0',
	'#': '#70dcf8',
	$: '#a070e8',
	"'": '#6440b0',
	'*': '#c07840',
	'+': '#7c4424',
	',': '#f8c8a8',
	'-': '#f070b0',
};

/** 오락실 기계: 위 간판(네온), 화면(빛), 조작판(조이스틱·단추), 몸통. (x, y)는 왼쪽 위 */
function cabinet(map: PixelMap, x: number, y: number, body: 'A' | 'X', glow: 'K' | 'V') {
	const w = 36;
	const [hi, base, dark] = body === 'A' ? ['A', 'a', 'b'] : ['X', 'x', 'y'];
	// 몸통
	map.rect(x, y, w, 92, 'k');
	map.rect(x + 1, y + 1, w - 2, 90, base);
	map.rect(x + 1, y + 1, 2, 90, hi);
	map.rect(x + w - 4, y + 1, 3, 90, dark);
	// 간판
	map.rect(x + 3, y + 3, w - 6, 10, 'k');
	map.rect(x + 4, y + 4, w - 8, 8, glow);
	for (let i = 0; i < w - 12; i += 4) map.rect(x + 6 + i, y + 7, 2, 2, 'W');
	// 화면 (짙은 바탕에 빛 줄과 작은 그림)
	map.rect(x + 4, y + 18, w - 8, 26, 'k');
	map.rect(x + 5, y + 19, w - 10, 24, 'I');
	for (let j = 0; j < 24; j += 3) map.rect(x + 5, y + 19 + j, w - 10, 1, 'J');
	map.stamp(['.W.W.', 'WWWWW', 'W.W.W', '.W.W.'], x + 12, y + 26, false);
	map.rect(x + 9, y + 37, 3, 2, glow);
	map.rect(x + 20, y + 33, 3, 2, 'Y');
	// 조작판
	map.rect(x + 2, y + 48, w - 4, 8, dark);
	map.rect(x + 2, y + 48, w - 4, 1, hi);
	map.rect(x + 8, y + 44, 2, 6, 'k');
	map.rect(x + 7, y + 42, 4, 3, 'f');
	map.set(x + 7, y + 42, 'W');
	map.rect(x + 18, y + 50, 3, 2, 'Y');
	map.rect(x + 24, y + 50, 3, 2, 'f');
	// 아래 문과 동전 구멍
	map.rect(x + 12, y + 66, 12, 14, dark);
	map.rect(x + 16, y + 70, 4, 2, 'Y');
}

// ─── 장면 ───

/** 장면 하나: 낮 팔레트와 밤에 따로 바꿀 색, 칠하는 함수 (night면 별·불 켠 창 같은 밤의 것을 더 칠한다) */
interface SceneDef {
	day: Record<string, string>;
	/** 밤에 따로 정한 색 (나머지는 낮 색을 nightOf로 어둡게) */
	night?: Record<string, string>;
	/** 밤에도 낮 색 그대로 두는 글자 (불빛, 별, 달) */
	glow?: string;
	/** 안쪽 장면(상점, 여관): 밤에는 푸른 달빛 대신 등잔불처럼 따뜻하게 어둡힌다 */
	warm?: boolean;
	paint: (map: PixelMap, night: boolean) => void;
	/** 밤에 따로 칠하는 것(별, 켠 등)이 있는지. 없으면 낮에 칠한 판을 밤 팔레트로만 바꿔 쓴다 */
	nightDetails?: boolean;
}

/** 바깥 장면의 공통 색 (낮) */
export const OUTDOOR: Record<string, string> = {
	W: '#ffffff',
	w: '#d4ecf8',
	G: '#b0ec80',
	g: '#8cd468',
	d: '#68b450',
	e: '#40843c',
	J: '#80c868',
	j: '#62ac54',
	i: '#4a9048',
	P: '#f4dca8',
	p: '#e4c48c',
	q: '#c49c64',
	Q: '#94703c',
	O: '#dca464',
	o: '#b47c44',
	n: '#8a582c',
	N: '#5a3418',
	S: '#ecece4',
	s: '#cacac0',
	r: '#a2a29a',
	R: '#6e6e6c',
	f: '#f05858',
	F: '#f8d840',
	k: '#2c3434',
	Z: '#fff8d0',
	z: '#a0a8e0',
	M: '#fff4c0',
	m: '#e8d890',
	L: '#a8dcf8',
	l: '#e8f4fc',
	T: '#f4ecd8',
	t: '#d4c8a8',
};

/** 낮 색을 밤 색으로: 조금 잿빛으로 바꾸고 어둡게, 푸른 기를 더한다 */
export function nightOf(hex: string, warm = false): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const l = 0.3 * r + 0.59 * g + 0.11 * b;
	const mix = (c: number) => c * 0.72 + l * 0.28;
	const to = (v: number) =>
		Math.max(0, Math.min(255, Math.round(v)))
			.toString(16)
			.padStart(2, '0');
	if (warm) return `#${to(mix(r) * 0.5 + 18)}${to(mix(g) * 0.4 + 12)}${to(mix(b) * 0.42 + 30)}`;
	return `#${to(mix(r) * 0.36 + 10)}${to(mix(g) * 0.42 + 14)}${to(mix(b) * 0.6 + 44)}`;
}

/** 밤 구름: 하늘보다 조금 밝은 남색 (빛나지 않게) */
const NIGHT_CLOUDS: Record<string, string> = { W: '#3c4680', w: '#2e366a' };

/** 밤에 켜지는 것: 별, 창 불빛 */
export const NIGHT_LIGHTS: Record<string, string> = {
	Z: '#fff8d0',
	z: '#8890d8',
	M: '#fff4c0',
	m: '#e0d090',
	L: '#f8d870',
	l: '#c89848',
};

/** 언덕 너머 나무 줄 (작은 둥근 나무를 겹쳐 세운다, 차분한 색) */
function treeLine(map: PixelMap, base: number, height: number, seed: number, keys: ClumpKeys) {
	for (let x = -10; x < map.w + 20; x += 13) {
		const n = noise(x, 0, seed);
		const r = height * (0.55 + n * 0.35);
		clump(
			map,
			[
				[x, base - r * 0.6, r],
				[x + r * 0.7, base - r * 0.2, r * 0.8],
			],
			keys
		);
	}
	map.rect(0, base, map.w, map.h - base, keys.base);
}

/** 풀밭 타일을 (줄 from부터) 깔고 풀 포기 무늬 세 가지를 해시로 섞는다 */
function grassField(map: PixelMap, fromRow: number) {
	for (let ty = fromRow; ty < map.th; ty++) {
		for (let tx = 0; tx < map.tw; tx++) tileAt(map, GRASS_TILES[Math.floor(noise(tx, ty, 2) * 3)], tx, ty);
	}
}

/** 흙길: 위·아래 가장자리가 물결치는 가로 띠. 가장자리는 짙은 흙과 풀 그늘, 속에는 자갈 */
function pathBand(map: PixelMap, top: (x: number) => number, bottom: (x: number) => number) {
	for (let x = 0; x < map.w; x++) {
		const t = top(x);
		const b = bottom(x);
		map.set(x, t - 1, 'd');
		for (let y = t; y <= b; y++) {
			let key = 'p';
			if (y === t) key = 'q';
			else if (y === t + 1) key = 'P';
			else if (y === b) key = 'q';
			else if (noise(x, y, 4) < 0.04) key = 'q';
			else if (noise(x, y, 9) < 0.03) key = 'P';
			map.set(x, y, key);
		}
		map.set(x, b + 1, 'e');
	}
}

const SCENES: Record<SceneKind, SceneDef> = {
	// 타이틀: 해 질 녘. 보랏빛 위 하늘에서 노란 지평선, 반쯤 진 해, 먼 보라 언덕, 가까운 초록 언덕, 가운데로 이어지는 흙길
	sunset: {
		day: {
			...OUTDOOR,
			'1': '#7058b0',
			'2': '#b064a8',
			'3': '#ec7c90',
			'4': '#ffa080',
			'5': '#ffc884',
			'6': '#ffe4a0',
			W: '#ffd8c8',
			w: '#f0a0a0',
			M: '#fff0b0',
			m: '#ffd070',
			H: '#a0609c',
			h: '#8a5090',
			I: '#c07090',
			J: '#a8c868',
			j: '#88b058',
			i: '#6c9448',
			G: '#b8d870',
			g: '#98c460',
			d: '#78a650',
			e: '#4c7440',
			L: '#ffe090',
		},
		night: {
			...NIGHT_CLOUDS,
			W: '#8a6c9c',
			w: '#6a5488',
			H: '#3a2c66',
			h: '#30265a',
			I: '#463474',
			'1': '#141640',
			'2': '#1e1e54',
			'3': '#2c2462',
			'4': '#43306e',
			'5': '#5c3a74',
			'6': '#7a4878',
			M: '#f8e8b0',
			m: '#d8c088',
		},
		glow: 'ZzLl',
		nightDetails: true,
		paint(map, night) {
			sky(map, [
				['1', 22],
				['2', 42],
				['3', 60],
				['4', 76],
				['5', 90],
				['6', 130],
			]);
			if (night) stars(map, map.top + 4, 70, 0.006, 31);
			// 해 (밤에는 달): 가로 틈이 난 고전 해
			const sx = map.C(352);
			const sy = 96;
			const sr = 26;
			for (let y = -sr; y <= 0; y++) {
				for (let x = -sr; x <= sr; x++) {
					if ((x + 0.5) ** 2 + (y + 0.5) ** 2 > sr * sr) continue;
					const gap = !night && y > -12 && (y + 12) % 5 === 4;
					if (gap) continue;
					map.set(sx + x, sy + y, (x + 0.5) ** 2 + (y + 0.5) ** 2 > (sr - 3) ** 2 ? 'm' : 'M');
				}
			}
			// 길쭉한 노을 구름
			for (const [cx, cy, w] of [
				[map.L(30), 30, 80],
				[map.C(180), 18, 60],
				[map.C(250), 50, 90],
				[map.R(400), 34, 70],
			]) {
				for (let j = 0; j < 4; j++) {
					const inset = j === 0 ? 6 : j === 3 ? 4 : 0;
					map.rect(cx + inset + (j === 3 ? 10 : 0), cy + j, w - inset * 2 - (j === 3 ? 10 : 0), 1, j < 2 ? 'W' : 'w');
				}
			}
			// 먼 보라 언덕
			hills(
				map,
				wave(98, [
					[7, 160, 10],
					[4, 70, 30],
				]),
				130,
				{ fill: 'H', rim: 'I', shade: 'h' }
			);
			// 가까운 언덕 둘 (외곽선)
			hills(
				map,
				wave(116, [
					[10, 240, 60],
					[3, 90, 0],
				]),
				map.bottom,
				{ fill: 'j', rim: 'J', shade: 'i', outline: 'e' }
			);
			// 언덕 위 작은 나무
			for (const [x, h] of [
				[map.L(44), 22],
				[map.L(60), 16],
				[map.R(420), 24],
				[map.R(440), 18],
			])
				pine(
					map,
					x,
					wave(116, [
						[10, 240, 60],
						[3, 90, 0],
					])(x) + 4,
					h,
					{ hi: 'J', base: 'j', shade: 'i', outline: 'e' }
				);
			// 앞 풀밭
			hills(
				map,
				wave(140, [
					[6, 300, 200],
					[2, 60, 0],
				]),
				map.bottom,
				{ fill: 'g', rim: 'G', shade: 'd', outline: 'e' }
			);
			// 가운데로 이어지는 흙길 (멀수록 좁다)
			for (let y = 112; y < map.bottom; y++) {
				const t = (y - 112) / 60;
				const half = Math.round(4 + t * 30);
				const cx = map.C(240) + Math.round(Math.sin(t * 2.4) * 10 * t);
				for (let x = cx - half; x <= cx + half; x++) {
					const edge = x === cx - half || x === cx + half;
					map.set(x, y, edge ? 'q' : noise(x, y, 6) < 0.05 ? 'q' : x < cx - half + 3 ? 'P' : 'p');
				}
			}
			// 길가의 꽃과 풀
			for (const [x, y, c] of [
				[map.C(150), 150, 'f'],
				[map.C(176), 160, 'F'],
				[map.C(300), 152, 'f'],
				[map.C(326), 162, 'W'],
				[map.L(110), 158, 'W'],
				[map.R(370), 156, 'F'],
			] as [number, number, string][])
				flower(map, x, y, c, 'F');
			for (const [x, y] of [
				[map.L(80), 150],
				[map.C(130), 168],
				[map.C(350), 168],
				[map.R(400), 150],
				[map.C(210), 170],
			])
				tuft(map, x, y, 'G', 'd');
		},
	},

	// 퀘스트·스킬·튜토리얼: 풀밭. 맑은 하늘과 구름, 먼 언덕과 나무 줄, 풀밭 타일, 흙길, 양옆에 큰 나무, 울타리, 꽃
	meadow: {
		day: {
			...OUTDOOR,
			'1': '#78c4f4',
			'2': '#94d4f8',
			'3': '#b4e2fa',
			'4': '#d2eefa',
			H: '#a8d4d0',
			h: '#94c4c4',
			I: '#bce0d8',
		},
		night: {
			'1': '#101438',
			'2': '#161c48',
			'3': '#1e2654',
			'4': '#28305e',
			...NIGHT_CLOUDS,
			H: '#24305c',
			h: '#1e2850',
			I: '#2c3a68',
		},
		glow: 'Zz',
		nightDetails: true,
		paint(map, night) {
			sky(map, [
				['1', 30],
				['2', 54],
				['3', 72],
				['4', 92],
			]);
			if (night) stars(map, map.top + 4, 66, 0.006, 11);
			cloud(map, map.L(60), 22, 54, { hi: 'W', shade: 'w' });
			cloud(map, map.C(250), 12, 40, { hi: 'W', shade: 'w' });
			cloud(map, map.R(360), 40, 60, { hi: 'W', shade: 'w' });
			hills(
				map,
				wave(78, [
					[6, 180, 40],
					[3, 70, 0],
				]),
				110,
				{ fill: 'H', shade: 'h' }
			);
			treeLine(map, 98, 10, 3, { hi: 'J', base: 'j', shade: 'i', line: 'i' });
			grassField(map, 6);
			map.rect(0, 96, map.w, 2, 'd');
			pathBand(
				map,
				wave(132, [
					[3, 140, 0],
					[1, 40, 7],
				]),
				wave(146, [
					[3, 150, 30],
					[1, 46, 0],
				])
			);
			// 양옆의 큰 나무와 덤불
			tree(map, map.L(26), 122, 26, { hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' }, 'd');
			tree(map, map.R(456), 124, 28, { hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' }, 'd');
			clump(
				map,
				[
					[map.L(86), 116, 8],
					[map.L(96), 114, 9],
					[map.L(104), 118, 7],
				],
				{ hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' }
			);
			fence(map, map.R(362), 104, 66);
			// 꽃밭
			for (const [x, y, c] of [
				[map.L(70), 160, 'f'],
				[map.L(84), 156, 'F'],
				[map.L(98), 162, 'W'],
				[map.R(380), 158, 'f'],
				[map.R(396), 162, 'F'],
				[map.C(150), 112, 'W'],
				[map.C(330), 114, 'f'],
				[map.R(420), 150, 'W'],
				[map.L(44), 150, 'F'],
			] as [number, number, string][])
				flower(map, x, y, c, c === 'F' ? 'f' : 'F');
			rock(map, map.L(140), 158, 5);
			rock(map, map.C(340), 104, 4);
		},
	},

	// 전투: 포켓몬 전투 들판. 밝은 하늘, 뒤쪽 숲(차분한 색), 풀밭, 아래 긴 풀 줄
	field: {
		day: {
			...OUTDOOR,
			'1': '#88d0f8',
			'2': '#a8dcf8',
			'3': '#c8eafa',
			J: '#78b868',
			j: '#5e9e58',
			i: '#4a8650',
			I: '#3c7044',
			G: '#bcf090',
			g: '#9cdc78',
			d: '#78c060',
			e: '#4c9048',
		},
		night: { '1': '#101438', '2': '#18204c', '3': '#22305c', ...NIGHT_CLOUDS },
		glow: 'Zz',
		nightDetails: true,
		paint(map, night) {
			sky(map, [
				['1', 26],
				['2', 46],
				['3', 70],
			]);
			if (night) stars(map, map.top + 4, 44, 0.007, 17);
			cloud(map, map.L(30), 18, 46, { hi: 'W', shade: 'w' });
			cloud(map, map.C(190), 28, 36, { hi: 'W', shade: 'w' });
			cloud(map, map.R(400), 12, 40, { hi: 'W', shade: 'w' });
			// 뒤쪽 숲: 큰 덩어리 두 줄 (뒷줄은 더 짙다)
			for (let x = -16; x < map.w + 24; x += 22) {
				const n = noise(x, 1, 21);
				clump(map, [[x, 62 - n * 10, 16 + n * 6]], { hi: 'j', base: 'i', shade: 'I', line: 'I', outline: 'I' });
			}
			for (let x = -6; x < map.w + 24; x += 26) {
				const n = noise(x, 2, 23);
				clump(
					map,
					[
						[x, 78 - n * 8, 15 + n * 5],
						[x + 10, 84, 12],
					],
					{ hi: 'J', base: 'j', shade: 'i', line: 'i', outline: 'I' }
				);
			}
			map.rect(0, 88, map.w, 8, 'j');
			for (let x = 0; x < map.w; x++) if (checker(x, 88)) map.set(x, 88, 'i');
			grassField(map, 6);
			map.rect(0, 96, map.w, 1, 'd');
			for (let x = 0; x < map.w; x++) if (checker(x, 97)) map.set(x, 97, 'd');
			// 아래의 긴 풀 (두 줄)
			for (let tx = 0; tx < map.tw; tx++) {
				tileAt(map, TALL_GRASS, tx, 9);
				tileAt(map, TALL_GRASS, tx, 10);
				tileAt(map, TALL_GRASS, tx, 11);
			}
			for (let x = 0; x < map.w; x++) map.set(x, 143, 'e');
			for (const [x, y] of [
				[map.L(60), 110],
				[map.L(130), 124],
				[map.C(220), 104],
				[map.C(300), 130],
				[map.R(400), 112],
				[map.R(440), 128],
			])
				tuft(map, x, y, 'G', 'd');
		},
	},

	// 파티: 마을 광장. 뒤에 지붕이 빨갛고 파란 집들, 왼쪽 앞에 분수, 돌바닥 타일, 가로등
	plaza: {
		day: {
			...OUTDOOR,
			'1': '#88ccf8',
			'2': '#a8dcf8',
			Y: '#fff0a0',
			X: '#f88070',
			x: '#e05448',
			y: '#a83438',
			A: '#78a8f0',
			a: '#5080d8',
			b: '#3458a8',
			U: '#c8f0ff',
			u: '#68c0f0',
			v: '#3888c8',
			S: '#f0e4cc',
			s: '#dcc8a4',
			r: '#bca482',
			R: '#8c7458',
		},
		night: { '1': '#101438', '2': '#18204c' },
		glow: 'ZzY',
		nightDetails: true,
		paint(map, night) {
			sky(map, [
				['1', 20],
				['2', 64],
			]);
			if (night) stars(map, map.top + 3, 30, 0.008, 41);
			// 뒤쪽 산울타리
			treeLine(map, 60, 9, 8, { hi: 'J', base: 'j', shade: 'i', line: 'i' });
			// 돌바닥
			for (let ty = 4; ty < map.th; ty++) {
				for (let tx = 0; tx < map.tw; tx++) tileAt(map, COBBLE, tx, ty);
			}
			// 집들 (뒤)
			house(map, map.L(10), 22, 76, 26, 46, 'X');
			house(map, map.L(118), 30, 56, 22, 42, 'A');
			house(map, map.R(306), 30, 56, 22, 42, 'X');
			house(map, map.R(394), 22, 76, 26, 46, 'A');
			// 가운데 뒤: 큰 나무
			tree(map, map.C(240), 92, 24, { hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' });
			// 분수 (왼쪽 앞)
			fountain(map, map.L(16), 112, 72);
			// 가로등 (오른쪽)
			for (const lx of [map.C(200), map.R(440)]) {
				map.rect(lx, 70, 4, 34, 'k');
				map.rect(lx + 1, 70, 2, 34, 'R');
				map.rect(lx - 3, 62, 10, 9, 'k');
				map.rect(lx - 2, 63, 8, 7, night ? 'Y' : 'L');
				map.rect(lx - 2, 103, 8, 2, 'k');
			}
			// 화단
			for (const [x, y, c] of [
				[map.L(100), 108, 'f'],
				[map.L(108), 112, 'F'],
				[map.R(370), 108, 'f'],
				[map.R(380), 112, 'W'],
			] as [number, number, string][])
				flower(map, x, y, c, 'F', 'e');
		},
	},

	// 장비: 상점 안. 위는 회벽, 아래는 판자 벽, 양옆에 물건 선반, 앞에 나무 계산대, 나무 바닥
	shop: {
		day: {
			...OUTDOOR,
			...ITEM_COLORS,
			T: '#f8ecd4',
			t: '#e8d4b0',
			O: '#e0a868',
			o: '#c08048',
			n: '#92582c',
			N: '#5c3418',
			L: '#b8e4f8',
			l: '#ffffff',
		},
		night: { L: '#283070', l: '#3a4488' },
		warm: true,
		glow: '0%&()[]{}<>?!"#$\'*+,-',
		nightDetails: true,
		paint(map, night) {
			const c = map.C(0);
			const r = map.R(0);
			// 회벽 (가로 줄무늬 점 무늬)
			map.rect(0, 0, map.w, 60, 'T');
			for (let y = 0; y < 60; y += 6) for (let x = 0; x < map.w; x++) if ((x + y) % 4 === 0) map.set(x, y, 't');
			// 들보
			map.rect(0, 0, map.w, 6, 'n');
			map.rect(0, 5, map.w, 1, 'N');
			map.rect(0, 1, map.w, 1, 'o');
			// 판자 벽
			for (let ty = 0; ty < 4; ty++)
				for (let tx = 0; tx < map.tw; tx++) map.stamp(WALL_PLANKS, tx * TILE, 60 + ty * TILE);
			map.rect(0, 58, map.w, 4, 'N');
			map.rect(0, 59, map.w, 1, 'O');
			// 창 (가운데 위)
			map.rect(c + 212, 12, 56, 36, 'N');
			map.rect(c + 214, 14, 52, 32, 'L');
			map.rect(c + 239, 14, 2, 32, 'N');
			map.rect(c + 214, 29, 52, 2, 'N');
			if (!night)
				for (let i = 0; i < 10; i++) {
					map.set(c + 220 + i, 26 - i, 'l');
					map.set(c + 246 + i, 26 - i, 'l');
				}
			map.rect(c + 208, 46, 64, 4, 'o');
			map.rect(c + 208, 46, 64, 1, 'O');
			// 선반 둘
			shelf(map, 8, 10, 60, [
				['potion', 'potion', 'bolt', 'potion'],
				['book', 'scroll', 'book', 'map'],
				['coin', 'bag', 'key', 'coin'],
				['potion', 'heart', 'star', 'heart'],
			]);
			shelf(map, r + 412, 10, 60, [
				['sword', 'hammer', 'sword', 'sword'],
				['shield', 'chest', 'shield', 'shield'],
				['gear', 'clock', 'lock', 'gear'],
				['bag', 'flag', 'chest', 'bag'],
			]);
			// 나무 바닥
			for (let ty = 7; ty < map.th; ty++) for (let tx = 0; tx < map.tw; tx++) tileAt(map, PLANKS, tx, ty);
			map.rect(0, 112, map.w, 1, 'N');
			// 계산대 (앞, 낮게)
			map.rect(c + 120, 116, 240, 40, 'N');
			map.rect(c + 121, 117, 238, 6, 'O');
			map.rect(c + 121, 123, 238, 32, 'o');
			for (let x = c + 136; x < c + 360; x += 28) map.rect(x, 126, 1, 28, 'n');
			map.rect(c + 121, 123, 238, 1, 'N');
			// 계산대 위의 돈주머니와 종
			map.stamp(ICONS.coin, c + 130, 104, false, ICON_REMAP);
			map.stamp(ICONS.bag, c + 340, 104, false, ICON_REMAP);
		},
	},

	// 상태·조작법: 여관 방. 판자 벽, 커튼 달린 창, 액자, 침대, 촛불 탁자, 깔개, 나무 바닥
	menu: {
		day: {
			...OUTDOOR,
			O: '#e8b47c',
			o: '#c88c58',
			n: '#9c6438',
			N: '#603818',
			A: '#f0a0b8',
			a: '#d87094',
			b: '#a84c70',
			L: '#a8dcf8',
			l: '#ffffff',
			X: '#80c0f0',
			x: '#5898d8',
			y: '#3c6cb0',
			Y: '#fff0a0',
			E: '#f8a030',
		},
		night: { L: '#202a68', l: '#3a4890' },
		warm: true,
		glow: 'YEZz',
		nightDetails: true,
		paint(map, night) {
			const c = map.C(0);
			const r = map.R(0);
			for (let ty = 0; ty < 7; ty++) for (let tx = 0; tx < map.tw; tx++) tileAt(map, WALL_PLANKS, tx, ty);
			map.rect(0, 0, map.w, 5, 'N');
			map.rect(0, 1, map.w, 2, 'n');
			// 창과 커튼 (왼쪽)
			map.rect(36, 18, 60, 46, 'N');
			map.rect(38, 20, 56, 42, 'L');
			if (night) {
				for (const [sx, sy] of [
					[46, 28],
					[70, 24],
					[84, 40],
					[56, 46],
				])
					map.set(sx, sy, 'Z');
				moon(map, 78, 32, 6);
			} else {
				for (let i = 0; i < 14; i++) map.set(44 + i, 52 - i, 'l');
				cloud(map, 50, 34, 30, { hi: 'W', shade: 'w' });
			}
			map.rect(65, 20, 2, 42, 'N');
			map.rect(38, 40, 56, 2, 'N');
			for (const cx of [30, 88]) {
				map.rect(cx, 14, 14, 54, 'b');
				map.rect(cx + 1, 15, 12, 52, 'a');
				for (let j = 15; j < 67; j++) map.set(cx + 1 + ((j >> 2) % 3), j, 'A');
				map.rect(cx + 10, 15, 3, 52, 'b');
			}
			map.rect(26, 12, 80, 3, 'N');
			// 액자 (오른쪽 위)
			map.rect(r + 380, 22, 44, 32, 'N');
			map.rect(r + 382, 24, 40, 28, 'O');
			map.rect(r + 385, 27, 34, 22, 'L');
			for (let x = r + 385; x < r + 419; x++) {
				const t = 40 + Math.round(4 * Math.cos((x - r - 385) / 8));
				for (let y = t; y < 49; y++) map.set(x, y, y === t ? 'G' : 'g');
			}
			// 바닥
			for (let ty = 7; ty < map.th; ty++) for (let tx = 0; tx < map.tw; tx++) tileAt(map, PLANKS, tx, ty);
			map.rect(0, 110, map.w, 2, 'N');
			// 깔개 (가운데)
			for (let j = 0; j < 40; j++) {
				for (let i = 0; i < 200; i++) {
					const edge = i < 3 || i > 196 || j < 3 || j > 36;
					const stripe = (i + j) % 12 < 2;
					map.set(c + 140 + i, 124 + j, edge ? 'y' : stripe ? 'X' : 'x');
				}
			}
			// 침대 (오른쪽)
			map.rect(r + 402, 70, 72, 76, 'N');
			map.rect(r + 404, 72, 68, 10, 'o');
			map.rect(r + 404, 72, 68, 2, 'O');
			map.rect(r + 406, 84, 64, 60, 'W');
			map.rect(r + 412, 88, 26, 14, 'W');
			map.rect(r + 412, 101, 26, 2, 'w');
			map.rect(r + 406, 104, 64, 40, 'a');
			map.rect(r + 406, 104, 64, 3, 'A');
			for (let j = 108; j < 144; j += 6) map.rect(r + 406, j, 64, 1, 'b');
			map.rect(r + 466, 104, 4, 40, 'b');
			// 탁자와 촛불 (왼쪽 아래)
			map.rect(30, 100, 56, 6, 'N');
			map.rect(31, 101, 54, 3, 'O');
			map.rect(36, 106, 4, 34, 'N');
			map.rect(76, 106, 4, 34, 'N');
			map.rect(54, 88, 6, 12, 'W');
			map.rect(54, 88, 1, 12, 'w');
			map.stamp(['.Y.', 'YEY', 'YEY', '.E.'], 55, 83, false);
		},
	},

	// 월드 맵: 위에서 내려다본 지도. 풀밭 무늬, 왼쪽 위 바다와 모래 기슭, 오른쪽 위 눈 덮인 산, 숲 덩어리
	map: {
		day: {
			...OUTDOOR,
			G: '#a8e478',
			g: '#88d060',
			d: '#6cb44c',
			e: '#3c7c38',
			U: '#c8f0ff',
			u: '#58b0f0',
			v: '#3a88d0',
			S: '#ffffff',
			s: '#c4c0cc',
			r: '#988ca8',
			R: '#5c5070',
			X: '#f88070',
			x: '#d04c48',
		},
		glow: 'Zz',
		paint(map) {
			grassField(map, 0);
			// 바다 (왼쪽 위): 기슭은 모래 두 칸과 흰 물거품
			const shore = (y: number) => Math.round(150 - y * 1.4 + 8 * Math.sin(y / 9));
			for (let y = 0; y < 90; y++) {
				const edge = shore(y);
				for (let x = 0; x < edge + 6; x++) {
					let key = WATER[y % 16][x % 16];
					if (x >= edge + 3) key = 'P';
					else if (x >= edge + 1) key = 'p';
					else if (x === edge) key = 'U';
					if (x === edge + 5) key = 'q';
					map.set(x, y, key);
				}
			}
			// 짙은 풀 얼룩 (경계는 점 무늬)
			for (let y = 0; y < map.bottom; y++) {
				for (let x = 0; x < map.w; x++) {
					if (map.get(x, y) !== 'g') continue;
					const n = smoothNoise(x, y, 40, 61);
					if (n > 0.66 || (n > 0.62 && checker(x, y))) map.set(x, y, 'd');
				}
			}
			// 산맥 (오른쪽 위): 뒤에서 앞으로 겹친다. 왼쪽 면 밝고 오른쪽 면 짙게, 꼭대기 눈, 짙은 외곽선
			const mountain = (mx: number, my: number, h: number) => {
				const snow = Math.round(h * 0.32);
				for (let j = 0; j < h; j++) {
					const half = Math.round(j * 0.95);
					for (let i = -half; i <= half; i++) {
						const edge = i === -half || i === half || j === h - 1;
						let key = i < 0 ? 's' : 'r';
						if (j < snow + ((i * 7) % 3)) key = i <= 0 ? 'S' : 'W';
						else if (i < 0 && i > -half + 2 && (j + i) % 5 === 0) key = 'r';
						if (i === 0 && j >= snow) key = 'R';
						map.set(mx + i, my + j, edge ? 'R' : key);
					}
				}
			};
			for (const [mx, my, h] of [
				[map.R(392), -4, 34],
				[map.R(440), -8, 40],
				[map.R(478), 0, 30],
				[map.R(356), 10, 26],
				[map.R(414), 14, 30],
				[map.R(460), 18, 28],
				[map.R(330), 26, 20],
			])
				mountain(mx, my, h);
			// 언덕 둔덕 (산 아래)
			for (const [hx, hy] of [
				[map.R(350), 50],
				[map.R(380), 52],
				[map.R(440), 52],
				[map.R(470), 50],
			])
				clump(map, [[hx, hy, 8]], { hi: 'G', base: 'g', shade: 'd', outline: 'e' }, hy + 4);
			// 숲: 작은 둥근 나무를 뒤 줄부터 겹쳐 심는다
			const smallTree = (x: number, y: number) => {
				map.rect(x - 1, y + 3, 2, 3, 'n');
				clump(map, [[x, y, 5]], { hi: 'G', base: 'd', shade: 'e', outline: 'k' });
			};
			const forest = (fx: number, fy: number, cols: number, rows: number) => {
				for (let r = 0; r < rows; r++)
					for (let c = 0; c < cols - (r % 2); c++) smallTree(fx + c * 9 + (r % 2) * 5, fy + r * 6);
			};
			forest(map.C(170), 8, 5, 3);
			forest(map.C(250), 96, 6, 4);
			forest(10, 112, 4, 4);
			forest(map.R(410), 104, 6, 5);
			forest(96, 58, 2, 2);
			// 꽃밭 (빨강·노랑 점)
			for (const [fx, fy] of [
				[map.C(200), 70],
				[map.C(330), 76],
				[120, 128],
				[map.R(380), 140],
			]) {
				for (let i = 0; i < 9; i++) {
					const px = fx + Math.floor(noise(i, fx, 3) * 22);
					const py = fy + Math.floor(noise(i, fy, 4) * 12);
					map.set(px, py, i % 2 ? 'f' : 'F');
					map.set(px, py + 1, 'e');
				}
			}
			// 작은 마을 (지붕 집 둘)
			for (const [vx, vy] of [
				[150, 120],
				[166, 126],
			]) {
				map.rect(vx, vy, 12, 10, 'k');
				map.rect(vx + 1, vy + 4, 10, 5, 'T');
				map.rect(vx + 8, vy + 4, 3, 5, 't');
				map.rect(vx + 1, vy + 1, 10, 3, 'x');
				map.rect(vx + 1, vy + 1, 10, 1, 'X');
				map.rect(vx + 5, vy + 6, 2, 3, 'n');
			}
		},
	},

	// 보물: 동굴. 울퉁불퉁한 바위 벽, 벽의 수정 무리, 횃불 둘, 돌바닥
	cave: {
		day: {
			...OUTDOOR,
			'1': '#6c6088',
			S: '#c4bcd8',
			s: '#9c90b8',
			r: '#786c98',
			R: '#4c4468',
			C: '#c8fcff',
			c: '#68dcf0',
			D: '#2c88b0',
			Y: '#fff4a0',
			E: '#f89830',
		},
		night: { '1': '#141230' },
		glow: 'CcDYEW',
		paint(map) {
			map.rect(0, 0, map.w, map.bottom, '1');
			// 바위 벽: 모난 돌 조각 (위는 한 단 어둡게)
			rockWall(map, 0, 112, 30, 51, 34);
			// 위의 고드름 돌
			for (let x = 8; x < map.w; x += 37) {
				const h = 8 + Math.floor(noise(x, 9, 3) * 10);
				for (let j = 0; j < h; j++) {
					const half = Math.round((1 - j / h) * 4);
					for (let i = -half; i <= half; i++) map.set(x + i, j, i === -half || i === half ? 'R' : i < 0 ? 's' : 'r');
				}
			}
			// 바닥
			for (let ty = 7; ty < map.th; ty++) for (let tx = 0; tx < map.tw; tx++) tileAt(map, CAVE_FLOOR, tx, ty);
			for (let x = 0; x < map.w; x++) {
				const t = 108 + Math.round(2 * Math.sin(x / 13));
				map.set(x, t, 'R');
				map.set(x, t + 1, 'r');
				for (let y = 100; y < t; y++) if (map.get(x, y) === '1') map.set(x, y, 'r');
			}
			// 수정 무리
			for (const [x, y, s] of [
				[40, 112, 1],
				[map.R(440), 114, 1.2],
				[120, 96, 0.7],
				[map.R(372), 98, 0.8],
				[map.R(460), 64, 0.6],
				[18, 70, 0.6],
			]) {
				crystal(map, x, y, Math.round(28 * s), Math.round(10 * s), -2);
				crystal(map, x + Math.round(9 * s), y + 2, Math.round(18 * s), Math.round(8 * s), 3);
				crystal(map, x - Math.round(8 * s), y + 3, Math.round(14 * s), Math.round(6 * s), -4);
			}
			// 횃불 (빛 무리는 점 무늬)
			for (const tx of [map.C(150), map.C(324)]) {
				for (let j = -20; j <= 20; j++)
					for (let i = -20; i <= 20; i++) {
						const d = i * i + j * j;
						if (d < 400 && d > 40 && bayer(tx + i, 34 + j) < 0.45 * (1 - d / 400) && map.get(tx + i, 34 + j) !== 'R')
							map.set(tx + i, 34 + j, 'S');
					}
				TORCH.forEach((row, j) =>
					[...row].forEach((cell, i) => {
						if (cell !== '.') map.rect(tx - 7 + i * 2, 26 + j * 2, 2, 2, cell);
					})
				);
			}
			// 자갈
			for (const [x, y] of [
				[90, 150],
				[map.C(200), 160],
				[map.C(300), 146],
				[map.R(400), 158],
			])
				rock(map, x, y, 4);
		},
	},

	// 기록: 오락실. 짙은 보라 벽에 네온 줄, 양옆에 오락 기계 넷, 색 조각 카펫
	arcade: {
		day: {
			...OUTDOOR,
			'1': '#5c3c9c',
			'2': '#4a2e84',
			K: '#ff70c8',
			V: '#70f0ff',
			Y: '#fff070',
			A: '#a080f0',
			a: '#7c5cd8',
			b: '#5638a8',
			X: '#f07888',
			x: '#d05068',
			y: '#983848',
			I: '#202050',
			J: '#283068',
			z: '#382468',
			q: '#24164a',
			W: '#ffffff',
			f: '#ff5050',
		},
		night: { '1': '#2a1850', '2': '#221444', z: '#1e1240', q: '#140c2c', I: '#101030', J: '#181c48' },
		glow: 'KVYIJWf',
		paint(map) {
			map.rect(0, 0, map.w, 108, '1');
			// 벽 아래 짙은 띠와 네온 줄 두 개
			map.rect(0, 70, map.w, 38, '2');
			map.rect(0, 16, map.w, 2, 'K');
			map.rect(0, 22, map.w, 1, 'V');
			for (let x = 0; x < map.w; x++) if (checker(x, 18)) map.set(x, 18, 'K');
			// 벽 판자 줄 (차분하게)
			for (let x = 20; x < map.w; x += 40) map.rect(x, 24, 1, 46, '2');
			// 네온 간판: 3×5 픽셀 글자를 두 배로, 분홍 글자에 하늘색 테두리
			const word = 'ARCADE';
			const left = Math.round(map.w / 2 - (word.length * 8 - 2));
			map.rect(left - 6, 28, word.length * 16 + 8, 18, 'k');
			map.rect(left - 5, 29, word.length * 16 + 6, 16, 'J');
			[...word].forEach((ch, i) =>
				GLYPHS[ch].forEach((line, gy) =>
					[...line].forEach((cell, gx) => {
						if (cell === '#') map.rect(left + i * 16 + gx * 4, 32 + gy * 2, 4, 2, i % 2 ? 'V' : 'K');
					})
				)
			);
			// 포스터 (액자 안에 작은 그림)
			const poster = (px: number, py: number, art: Rows, bg: string) => {
				map.rect(px, py, 22, 28, 'k');
				map.rect(px + 1, py + 1, 20, 26, bg);
				map.stamp(art, px + 4, py + 6, false);
			};
			poster(map.C(110), 52, ['.KKKK.', 'KWKKWK', 'KKKKKK', 'KKKKKK', 'K.KK.K', '......', 'YYYYYY'], 'I');
			poster(map.C(150), 58, ['..YY..', '.YYYY.', 'YYYYYY', '.YYYY.', '..YY..', '......', 'VVVVVV'], 'b');
			poster(map.C(312), 54, ['.f..f.', 'ffffff', 'ffffff', '.ffff.', '..ff..', '......', 'KKKKKK'], 'I');
			poster(map.C(350), 60, ['V....V', '.V..V.', '..VV..', '..VV..', '.V..V.', '......', 'YYYYYY'], 'b');
			// 카펫
			for (let ty = 7; ty < map.th; ty++) for (let tx = 0; tx < map.tw; tx++) tileAt(map, ARCADE_CARPET, tx, ty);
			map.rect(0, 108, map.w, 2, 'k');
			map.rect(0, 110, map.w, 2, 'b');
			// 오락 기계 (양옆에 둘씩)
			cabinet(map, 8, 26, 'A', 'K');
			cabinet(map, 52, 30, 'X', 'V');
			cabinet(map, map.R(392), 30, 'X', 'K');
			cabinet(map, map.R(436), 26, 'A', 'V');
		},
	},

	// 크레딧·엔딩: 밤하늘. 별, 큰 달, 짙은 언덕 겹, 먼 집의 불 켠 창, 반딧불
	night: {
		day: {
			...OUTDOOR,
			'1': '#141a48',
			'2': '#1c2458',
			'3': '#263068',
			'4': '#323c78',
			H: '#2a3264',
			h: '#232a58',
			I: '#384480',
			J: '#30486c',
			j: '#263c5e',
			i: '#1e3050',
			G: '#3a5a78',
			g: '#2c4a68',
			d: '#223c58',
			e: '#162638',
			T: '#4a5480',
			t: '#3a4470',
			L: '#f8d870',
			l: '#c89848',
			x: '#583860',
			X: '#6c4878',
			y: '#402848',
			k: '#0c1024',
			N: '#141828',
			n: '#202838',
			o: '#2c3448',
			F: '#f8e070',
		},
		night: {},
		glow: 'ZzMmLlHhIJjiGgdeTtxXykNnoF1234',
		paint(map) {
			sky(map, [
				['1', 30],
				['2', 60],
				['3', 84],
				['4', 160],
			]);
			stars(map, map.top + 2, 90, 0.008, 5);
			moon(map, map.R(396), 34, 16);
			hills(
				map,
				wave(96, [
					[8, 200, 30],
					[4, 80, 0],
				]),
				130,
				{ fill: 'H', rim: 'I', shade: 'h' }
			);
			// 먼 언덕 위 작은 집 (불 켠 창)
			map.rect(96, 82, 22, 12, 'T');
			map.rect(116, 82, 2, 12, 't');
			for (let j = 0; j < 8; j++) map.rect(94 + j, 81 - j, 26 - j * 2, 1, j === 0 ? 'y' : 'x');
			map.rect(100, 85, 4, 4, 'L');
			map.rect(109, 85, 4, 4, 'L');
			hills(
				map,
				wave(118, [
					[10, 260, 120],
					[3, 70, 0],
				]),
				map.bottom,
				{ fill: 'j', rim: 'J', shade: 'i', outline: 'e' }
			);
			for (const [x, h] of [
				[30, 26],
				[50, 18],
				[map.R(430), 22],
				[map.R(452), 30],
			])
				pine(
					map,
					x,
					wave(118, [
						[10, 260, 120],
						[3, 70, 0],
					])(x) + 4,
					h,
					{ hi: 'J', base: 'j', shade: 'i', outline: 'e' }
				);
			hills(
				map,
				wave(146, [
					[5, 300, 0],
					[2, 50, 10],
				]),
				map.bottom,
				{ fill: 'g', rim: 'G', shade: 'd', outline: 'e' }
			);
			// 반딧불
			for (const [x, y] of [
				[map.C(150), 128],
				[map.C(180), 140],
				[map.C(310), 132],
				[map.C(350), 150],
				[90, 150],
				[map.R(400), 126],
			]) {
				map.set(x, y, 'F');
				map.set(x + 1, y, 'F');
				map.set(x, y + 1, 'F');
				map.set(x + 1, y + 1, 'F');
			}
		},
	},
};

/** 장면의 팔레트 (낮 또는 밤): 밤은 정한 색, 빛나는 글자는 낮 색 그대로, 나머지는 nightOf */
export function scenePalette(kind: SceneKind, night: boolean): Record<string, string> {
	const def = SCENES[kind];
	if (!night) return def.day;
	const glow = new Set([...(def.glow ?? '')]);
	const out: Record<string, string> = {};
	for (const [key, color] of Object.entries(def.day)) out[key] = glow.has(key) ? color : nightOf(color, def.warm);
	for (const [key, color] of Object.entries(NIGHT_LIGHTS)) if (key in out && !glow.has(key)) out[key] = color;
	return { ...out, ...def.night };
}

/** 하늘이 있는 바깥 장면: 화면이 높으면 지평선을 내리고 위쪽 하늘을 이어 칠한다 */
const SKY_SCENES = new Set<SceneKind>(['sunset', 'meadow', 'field', 'plaza', 'night']);

/** 기준 높이보다 높은 화면에서 그림을 내리는 칸 수: 늘어난 높이의 반 (많아야 64칸) */
export const sceneShift = (kind: SceneKind, h: number) =>
	SKY_SCENES.has(kind) ? Math.max(0, Math.min(64, Math.round((h - 216) / 2))) : 0;

/** 기억해 두는 판과 그림의 수 (창 크기를 바꾸면 크기마다 새로 칠한다) */
const CACHE_LIMIT = 24;
function remember<T>(cache: Map<string, T>, key: string, value: T): T {
	cache.set(key, value);
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	return value;
}

const maps = new Map<string, PixelMap>();

/** 장면을 w×h 판에 칠한다 (장면·낮밤·크기마다 한 번만 칠한다) */
export function composeScene(kind: SceneKind, night: boolean, w = SCENE_W, h = SCENE_H): PixelMap {
	const lit = night && Boolean(SCENES[kind].nightDetails);
	const key = `${kind}:${lit ? 'n' : 'd'}:${w}x${h}`;
	const cached = maps.get(key);
	if (cached) return cached;
	const map = new PixelMap(w, h, '.', sceneShift(kind, h));
	SCENES[kind].paint(map, lit);
	return remember(maps, key, map);
}

const images = new Map<string, Uint8ClampedArray>();

/** 장면의 RGBA (w×h, 캔버스에 그대로 올린다). 빈칸은 투명 */
export function sceneRgba(kind: SceneKind, night: boolean, w = SCENE_W, h = SCENE_H): Uint8ClampedArray {
	const key = `${kind}:${night ? 'n' : 'd'}:${w}x${h}`;
	const cached = images.get(key);
	if (cached) return cached;
	const map = composeScene(kind, night, w, h);
	const palette = scenePalette(kind, night);
	const rgb: Record<string, [number, number, number]> = {};
	for (const [k, hex] of Object.entries(palette))
		rgb[k] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
	const data = new Uint8ClampedArray(map.w * map.h * 4);
	map.px.forEach((k, i) => {
		const c = rgb[k];
		if (!c) return;
		data[i * 4] = c[0];
		data[i * 4 + 1] = c[1];
		data[i * 4 + 2] = c[2];
		data[i * 4 + 3] = 255;
	});
	return remember(images, key, data);
}

export const SCENE_KINDS = Object.keys(SCENES) as SceneKind[];

// ─── 그림판(DialoguePanels)의 나무 소품: 타이틀 표지판, 퀘스트 게시판, 지도의 집과 성 ───

/** 소품 색: 나무(N 외곽선, n 그늘, o 바탕, O 빛), 종이(W, w), 핀(f), 풀(G, g), 돌(S, s, r, R), 지붕(X, x) */
export const PROP_COLORS: Record<string, string> = {
	N: '#5a3418',
	n: '#8a582c',
	o: '#b47c44',
	O: '#dca464',
	W: '#fffaf0',
	w: '#e4d8bc',
	f: '#e04848',
	G: '#8cd468',
	g: '#5ea848',
	S: '#f0f0ec',
	s: '#c4c4c8',
	r: '#8c8c98',
	R: '#4c4c5c',
	X: '#f87060',
	x: '#c83c3c',
	L: '#f8d870',
	k: '#2c3434',
};

/** 나무 판: 가로 판자 줄(판자마다 위는 밝고 아래 이음매는 짙게), 오른쪽 두 칸 그늘, 둥근 모서리, 못 */
function boardRows(w: number, h: number, plank: number): string[][] {
	return Array.from({ length: h }, (_, y) =>
		Array.from({ length: w }, (_, x) => {
			const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
			if (corner) return '.';
			if (x === 0 || x === w - 1 || y === 0 || y === h - 1) return 'N';
			const ly = (y - 1) % plank;
			if (ly === plank - 1) return 'n';
			if (ly === 0) return 'O';
			if (x >= w - 3) return 'n';
			if (x === 1) return 'O';
			if ((x === 3 || x === w - 4) && ly === Math.floor(plank / 2)) return 'k';
			return 'o';
		})
	);
}

/** 타이틀 표지판: w×h 나무 판, 아래 가운데 기둥과 발밑 풀 */
export function signpostRows(w: number, h: number, post: number): string[] {
	const grid = boardRows(w, h, 9);
	const cx = Math.floor(w / 2);
	for (let j = 0; j < post; j++) {
		const row = new Array<string>(w).fill('.');
		for (let i = cx - 3; i <= cx + 2; i++)
			row[i] = i === cx - 3 || i === cx + 2 ? 'N' : i === cx + 1 ? 'n' : i === cx - 2 ? 'O' : 'o';
		if (j === post - 1) {
			for (let i = cx - 7; i <= cx + 6; i++) row[i] = i === cx - 7 || i === cx + 6 ? '.' : 'g';
			row[cx - 6] = 'G';
			row[cx + 4] = 'G';
		} else if (j === post - 2) {
			row[cx - 5] = 'G';
			row[cx + 4] = 'G';
			row[cx - 6] = 'g';
			row[cx + 5] = 'g';
		}
		grid.push(row);
	}
	return grid.map((row) => row.join(''));
}

/** 퀘스트 게시판: 지붕 판, 짙은 판 바탕, 양옆 기둥, 가운데 큰 종이(아이콘 자리)와 작은 종이 둘 */
export function questBoardRows(w: number, h: number): string[] {
	const grid = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
	const set = (x: number, y: number, k: string) => {
		if (x >= 0 && y >= 0 && x < w && y < h) grid[y][x] = k;
	};
	const legs = h - 8;
	// 기둥
	for (const lx of [3, w - 7]) {
		for (let y = 4; y < h; y++)
			for (let i = 0; i < 4; i++) set(lx + i, y, i === 0 || i === 3 ? 'N' : i === 1 ? 'O' : 'n');
	}
	// 판
	for (let y = 5; y < legs; y++) {
		for (let x = 1; x < w - 1; x++) {
			const edge = x === 1 || x === w - 2 || y === 5 || y === legs - 1;
			set(x, y, edge ? 'N' : x === 2 || y === 6 ? 'n' : (y - 6) % 6 === 5 ? 'N' : 'n');
		}
	}
	for (let y = 7; y < legs - 1; y++)
		for (let x = 3; x < w - 3; x++)
			if ((y - 6) % 6 !== 5)
				set(x, y, (x + Math.floor((y - 6) / 6) * 7) % 13 === 0 ? 'n' : (y - 6) % 6 === 0 ? 'O' : 'o');
	// 지붕
	for (let x = 0; x < w; x++) {
		set(x, 0, x === 0 || x === w - 1 ? '.' : 'N');
		set(x, 1, x === 0 || x === w - 1 ? 'N' : 'O');
		set(x, 2, x === 0 || x === w - 1 ? 'N' : 'o');
		set(x, 3, x === 0 || x === w - 1 ? 'N' : 'n');
		set(x, 4, 'N');
	}
	// 종이: 가운데 큰 것 (오른쪽·아래 그늘, 위 핀)
	const paper = (px: number, py: number, pw: number, ph: number, lines: boolean) => {
		for (let y = 0; y < ph; y++)
			for (let x = 0; x < pw; x++)
				set(
					px + x,
					py + y,
					x === pw - 1 || y === ph - 1 ? 'w' : lines && y % 3 === 2 && x > 1 && x < pw - 2 ? 'w' : 'W'
				);
		set(px + Math.floor(pw / 2), py, 'f');
	};
	const big = 16;
	paper(Math.floor((w - big - 2) / 2), 8, big + 2, big + 2, false);
	paper(5, 10, 8, 10, true);
	paper(w - 13, 12, 8, 9, true);
	return grid.map((row) => row.join(''));
}

/** 지도의 성 (GOAL): 탑 둘과 가운데 성벽, 톱니 지붕, 빨간 깃발, 문 */
export const CASTLE: Rows = [
	'..f..............f..',
	'..ff.............ff.',
	'..R..............R..',
	'.RRRR..........RRRR.',
	'.RSRR.R.R.R.R..RSRR.',
	'.RSsR.RRRRRRR..RSsR.',
	'.RSsRRRSSSSsRRRRSsR.',
	'.RSsRRSsssssrRRRSsR.',
	'.RSsRSsLsssLsrRRSsR.',
	'.RSsRSsssssssrRRSsR.',
	'.RSsRSssRRRssrRRSsR.',
	'.RSsRSsRkkkRsrRRSsR.',
	'.RSsRSsRkkkRsrRRSsR.',
	'.RRRRRRRRRRRRRRRRRR.',
];

/** 지도의 작은 집 (START): 빨간 지붕, 흰 벽, 문 */
export const COTTAGE: Rows = [
	'.....RR.....',
	'....RxxR....',
	'...RXxxxR...',
	'..RXxxxxxR..',
	'.RXxxxxxxxR.',
	'RRRRRRRRRRRR',
	'.RSSSSSSssR.',
	'.RSLLSSnnsR.',
	'.RSLLSSnnsR.',
	'.RSSSSSnnsR.',
	'.RRRRRRRRRR.',
];
