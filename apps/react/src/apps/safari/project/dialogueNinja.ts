// RPG 대화창(DialoguePage)의 그림 목록: Ninja Adventure Asset Pack(Pixel-boy·AAA, CC0 — public/imgs/rpg/ninja/LICENSE.txt)에서
// 가져온 타일 묶음·사람·몬스터 그림의 주소와, 그 안에서 쓰는 조각(16칸 격자의 자리)을 적는다. 그림은 그대로 두고 조각을 잘라 쓴다.
// 땅(흙길, 물, 돌바닥)은 이웃에 맞춰 모서리 조각을 고르는 47칸 자동 타일(같은 배치를 묶음마다 쓴다)로 깐다.
// 여기에는 계산만 있고(시험할 수 있게), 캔버스에 칠하는 일은 paintDraws가 한다

/** 그림이 있는 곳 (public 아래) */
export const NINJA_BASE = '/imgs/rpg/ninja';

/** 타일 한 칸 (게임 칸) */
export const TILE = 16;

/** 쓰는 그림 파일들 (NINJA_BASE 아래) */
export const SHEETS = {
	floor: 'tiles/floor.png',
	nature: 'tiles/nature.png',
	house: 'tiles/house.png',
	water: 'tiles/water.png',
	element: 'tiles/element.png',
	detail: 'tiles/floor-detail.png',
	ifloor: 'tiles/interior-floor.png',
	wall: 'tiles/wall.png',
	relief: 'tiles/relief.png',
	chest: 'items/chest.png',
	shadow: 'items/shadow.png',
	alert: 'ui/alert.png',
} as const;

/** 사람 그림 (16×16 칸이 4열 × 7줄: 열은 아래·위·왼쪽·오른쪽, 첫 네 줄은 걸음) */
export const CHARACTERS = [
	'boy',
	'oldman',
	'villager',
	'villager2',
	'villager3',
	'villager4',
	'woman',
	'princess',
	'samurai',
	'noble',
	'monk',
	'hunter',
] as const;
export type CharacterName = (typeof CHARACTERS)[number];

/** 몬스터 그림 (16×16 칸이 4열 × 4줄: 열은 방향, 줄은 움직임) */
export const MONSTERS = ['spider', 'larva', 'slime', 'mushroom', 'skull', 'eye'] as const;
export type MonsterName = (typeof MONSTERS)[number];

export type SheetKey = keyof typeof SHEETS | `char:${CharacterName}` | `monster:${MonsterName}`;

/** 그림 파일의 주소 */
export function sheetUrl(key: SheetKey): string {
	if (key.startsWith('char:')) return `${NINJA_BASE}/chars/${key.slice(5)}.png`;
	if (key.startsWith('monster:')) return `${NINJA_BASE}/monsters/${key.slice(8)}.png`;
	return `${NINJA_BASE}/${SHEETS[key as keyof typeof SHEETS]}`;
}

/** 그림 파일의 크기 (px): 배경 그림을 키울 때 쓴다 (시험이 실제 파일과 맞춰 본다) */
const SHEET_SIZES: Record<keyof typeof SHEETS, readonly [number, number]> = {
	floor: [352, 417],
	nature: [384, 336],
	house: [528, 368],
	water: [448, 272],
	element: [256, 240],
	detail: [256, 80],
	ifloor: [352, 272],
	wall: [160, 176],
	relief: [320, 192],
	chest: [32, 14],
	shadow: [12, 7],
	alert: [14, 13],
};
export function sheetSize(key: SheetKey): readonly [number, number] {
	if (key.startsWith('char:')) return [64, 112];
	if (key.startsWith('monster:')) return [64, 64];
	return SHEET_SIZES[key as keyof typeof SHEETS];
}

/** 모든 그림 파일의 주소 (미리 받기, 시험) */
export const ALL_SHEETS: readonly SheetKey[] = [
	...(Object.keys(SHEETS) as (keyof typeof SHEETS)[]),
	...CHARACTERS.map((name) => `char:${name}` as const),
	...MONSTERS.map((name) => `monster:${name}` as const),
];

/** 그림 한 조각: 파일과 그 안의 사각형 (px) */
export interface Sprite {
	sheet: SheetKey;
	x: number;
	y: number;
	w: number;
	h: number;
}

const sp = (sheet: SheetKey, x: number, y: number, w: number, h: number): Sprite => ({ sheet, x, y, w, h });
/** 16칸 격자의 (col, row)에서 cols×rows칸 */
const cell = (sheet: SheetKey, col: number, row: number, cols = 1, rows = 1): Sprite =>
	sp(sheet, col * TILE, row * TILE, cols * TILE, rows * TILE);

/** 칠할 것 하나: 조각을 (dx, dy)에. 정렬(y)은 발이 닿는 줄 */
export interface Draw {
	sheet: SheetKey;
	sx: number;
	sy: number;
	sw: number;
	sh: number;
	dx: number;
	dy: number;
	/** 그림 대신 이 색으로 (sw×sh) 칠한다 (동굴 속 같은 어둠) */
	fill?: string;
}

export const drawOf = (sprite: Sprite, dx: number, dy: number): Draw => ({
	sheet: sprite.sheet,
	sx: sprite.x,
	sy: sprite.y,
	sw: sprite.w,
	sh: sprite.h,
	dx: Math.round(dx),
	dy: Math.round(dy),
});

/** 조각을 바닥 (cx, by)에 세운다: 가운데 아래가 그 점 */
export const standAt = (sprite: Sprite, cx: number, by: number): Draw =>
	drawOf(sprite, cx - Math.floor(sprite.w / 2), by - sprite.h);

// ─── 조각 목록 ───

/** 바닥: 풀(무늬 없는 것과 풀 포기 있는 것), 흙 */
export const GROUND = {
	grass: [cell('floor', 0, 12), cell('floor', 2, 11), cell('floor', 3, 11), cell('floor', 1, 12), cell('floor', 3, 12)],
	dirt: [cell('floor', 1, 8), cell('floor', 0, 11), cell('floor', 1, 11)],
	/** 긴 풀숲 (밟고 지나간다) */
	tallGrass: cell('nature', 7, 11),
	/** 안쪽 바닥: 옅은 벽돌(상점), 붉은 벽돌(여관), 무늬 타일(오락실) */
	brick: cell('ifloor', 1, 1),
	brickWarm: cell('ifloor', 1, 7),
	tiles: cell('ifloor', 16, 1),
} as const;

/** 나무와 수풀 (나무는 32×32, 아래 가운데가 줄기) */
export const NATURE = {
	trees: [cell('nature', 0, 0, 2, 2), cell('nature', 16, 0, 2, 2), cell('nature', 18, 0, 2, 2)],
	pine: cell('nature', 2, 0, 2, 2),
	blossom: cell('nature', 14, 0, 2, 2),
	bushes: [cell('nature', 0, 10), cell('nature', 1, 10), cell('nature', 6, 10), cell('nature', 10, 10)],
	flowers: [cell('nature', 0, 11), cell('nature', 1, 11), cell('nature', 3, 11), cell('nature', 6, 11)],
	tufts: [cell('detail', 0, 2), cell('detail', 1, 2), cell('detail', 3, 2), cell('detail', 5, 2)],
	stump: cell('nature', 4, 8),
	rockSmall: [sp('nature', 272, 208, 16, 16), sp('nature', 288, 208, 16, 16), sp('nature', 304, 208, 16, 16)],
	boulder: sp('nature', 240, 160, 32, 40),
	boulderBig: sp('nature', 272, 160, 64, 48),
	boulderTall: sp('nature', 336, 160, 32, 48),
	grayBoulder: sp('nature', 240, 224, 32, 40),
	grayBig: sp('nature', 272, 224, 64, 48),
	grayTall: sp('nature', 336, 224, 32, 48),
} as const;

/** 집과 큰 소품 (아래 가운데가 문) */
export const BUILDINGS = {
	thatch: sp('house', 0, 0, 64, 48),
	beige: sp('house', 64, 0, 64, 48),
	orange: sp('house', 128, 0, 64, 48),
	redRoof: sp('house', 192, 0, 64, 48),
	noodle: sp('house', 256, 0, 48, 48),
	market: sp('house', 304, 0, 64, 48),
	stone: sp('house', 368, 0, 48, 48),
	wood: sp('house', 416, 0, 48, 48),
	torii: sp('house', 7, 82, 34, 29),
	arch: sp('house', 464, 322, 48, 42),
} as const;

/** 작은 소품 */
export const PROPS = {
	sign: cell('element', 0, 2),
	signpost: cell('element', 3, 2),
	mailbox: cell('element', 6, 3, 1, 2),
	well: sp('element', 112, 21, 16, 27),
	statue: sp('house', 48, 242, 32, 30),
	frogStatue: sp('house', 48, 277, 32, 26),
	barrel: cell('house', 16, 15),
	crateFruit: cell('house', 19, 14),
	picture: cell('house', 20, 18),
	notice: cell('house', 21, 18),
	pot: cell('element', 2, 9),
	plant: cell('element', 0, 7, 1, 2),
	stall: sp('house', 256, 256, 96, 32),
	fenceH: cell('house', 12, 7),
	fencePost: cell('house', 14, 6),
	bookshelf: cell('element', 3, 7, 2, 2),
	shelf: cell('element', 8, 7, 2, 2),
	drawer: cell('element', 1, 8),
	table: cell('element', 3, 9),
	banner: [cell('house', 23, 20, 1, 2), cell('house', 24, 20, 1, 2), cell('house', 26, 20, 1, 2)],
	board: cell('element', 11, 2, 3, 2),
	bench: cell('element', 11, 1, 3, 1),
} as const;

/** 상자 (16×14 두 칸: 닫힘, 열림), 그림자, '!' 말풍선 */
export const ITEMS = {
	chestClosed: sp('chest', 0, 0, 16, 14),
	chestOpen: sp('chest', 16, 0, 16, 14),
	shadow: sp('shadow', 0, 0, 12, 7),
	alert: sp('alert', 0, 0, 14, 13),
} as const;

/** 사람·몬스터 그림의 방향 열 */
export const FACING_COLUMN = { down: 0, up: 1, left: 2, right: 3 } as const;

/** 사람 한 칸: 방향과 걸음(0–3) */
export const characterFrame = (name: CharacterName, facing: keyof typeof FACING_COLUMN, step = 0): Sprite =>
	cell(`char:${name}`, FACING_COLUMN[facing], step % 4);

/** 몬스터 한 칸: 방향과 움직임(0–3) */
export const monsterFrame = (name: MonsterName, step = 0, facing: keyof typeof FACING_COLUMN = 'down'): Sprite =>
	cell(`monster:${name}`, FACING_COLUMN[facing], step % 4);

/** 이름마다 늘 같은 사람 (주인공은 빼고) */
const PEOPLE: readonly CharacterName[] = [
	'villager',
	'woman',
	'villager2',
	'princess',
	'villager3',
	'samurai',
	'noble',
	'hunter',
];
export function characterOf(name: string): CharacterName {
	// FNV-1a: 한 글자만 달라도 고루 흩어진다
	let h = 2166136261;
	for (const ch of name.trim() || '?') h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 16777619);
	h ^= h >>> 15;
	return PEOPLE[(h >>> 0) % PEOPLE.length];
}

/** 차례(index)의 버그 몬스터 */
export const monsterOf = (index: number): MonsterName =>
	MONSTERS[((index % MONSTERS.length) + MONSTERS.length) % MONSTERS.length];

// ─── 자동 타일 ───

/**
 * 47칸 자동 타일의 배치: 묶음 왼쪽 위에서 (열, 줄)의 조각이 어떤 이웃 모양인지 (9글자: 왼쪽 위, 위, 오른쪽 위, 왼쪽, 가운데,
 * 오른쪽, 왼쪽 아래, 아래, 오른쪽 아래가 같은 땅이면 1). 흙길 묶음(floor.png의 0, 7)에서 읽은 것이고, 물·돌바닥 묶음도 같은 배치다
 */
const LAYOUT: readonly string[] = [
	'000001011 000111111 000100110 000010010 000011010 000111110 000111011 000110010 000111010 110111011',
	'011011011 111111111 110110110 010010010 011011010 111111110 111111011 110110010 111111010 011111110',
	'011001000 111111000 110100000 010010000 010011011 110111111 011111111 010110110 010111111 010111011 010111110',
	'000011000 000111000 000110000 000010000 010011000 110111000 011111000 010110000 010111000 011111010 110111010',
	'- - - - 010011010 110111110 011111011 010110010 010111010',
];

/** 이웃 모양의 열쇠: 위·오른쪽·아래·왼쪽, 그리고 두 변이 다 같은 땅일 때만 그 사이 모서리 */
function keyOf(n: boolean, e: boolean, s: boolean, w: boolean, ne: boolean, se: boolean, sw: boolean, nw: boolean) {
	return [n, e, s, w, n && e && ne, s && e && se, s && w && sw, n && w && nw].map((b) => (b ? '1' : '0')).join('');
}

/** 열쇠 → 묶음 안 자리 */
const AUTOTILE = (() => {
	const map = new Map<string, readonly [number, number]>();
	LAYOUT.forEach((line, row) =>
		line.split(' ').forEach((sig, col) => {
			if (sig.length !== 9) return;
			const b = [...sig].map((c) => c === '1');
			const key = keyOf(b[1], b[5], b[7], b[3], b[2], b[8], b[6], b[0]);
			if (!map.has(key)) map.set(key, [col, row]);
		})
	);
	return map;
})();

/** 자동 타일 묶음: 그림과 왼쪽 위 칸 */
export interface AutotileSet {
	sheet: SheetKey;
	col: number;
	row: number;
}
export const AUTOTILES = {
	/** 풀밭 위 흙길 */
	dirt: { sheet: 'floor', col: 0, row: 7 },
	/** 풀밭 위 물 (둑과 물거품) */
	water: { sheet: 'water', col: 0, row: 6 },
	/** 테두리 있는 돌바닥 */
	cobble: { sheet: 'ifloor', col: 0, row: 12 },
	/** 짙은 흙 (동굴) */
	darkDirt: { sheet: 'floor', col: 11, row: 14 },
	/** 모래 */
	sand: { sheet: 'floor', col: 0, row: 0 },
} as const satisfies Record<string, AutotileSet>;

/** 자동 타일이 아는 이웃 모양의 수 (47) */
export const AUTOTILE_KEYS = AUTOTILE.size;

/**
 * 한 칸의 조각: same(dx, dy)는 이웃 칸이 같은 땅인지. 모르는 모양(있을 수 없지만)은 가장 가까운 모양으로
 */
export function autotile(set: AutotileSet, same: (dx: number, dy: number) => boolean): Sprite {
	const key = keyOf(
		same(0, -1),
		same(1, 0),
		same(0, 1),
		same(-1, 0),
		same(1, -1),
		same(1, 1),
		same(-1, 1),
		same(-1, -1)
	);
	let at = AUTOTILE.get(key);
	if (!at) {
		let best = Infinity;
		for (const [k, v] of AUTOTILE) {
			let d = 0;
			for (let i = 0; i < 8; i++) if (k[i] !== key[i]) d += i < 4 ? 4 : 1;
			if (d < best) {
				best = d;
				at = v;
			}
		}
	}
	const [col, row] = at ?? [1, 1];
	return cell(set.sheet, set.col + col, set.row + row);
}

/** 해시 (0 이상 1 미만): 같은 칸은 늘 같다 */
export function noise(x: number, y: number, seed = 0): number {
	let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

/** 목록에서 해시로 하나 */
export const pick = <T>(list: readonly T[], x: number, y: number, seed = 0): T =>
	list[Math.floor(noise(x, y, seed) * list.length)];

// ─── 칠하기 (브라우저) ───

const images = new Map<SheetKey, Promise<HTMLImageElement | null>>();

/** 그림 파일 하나를 받는다 (한 번만) */
export function loadSheet(key: SheetKey): Promise<HTMLImageElement | null> {
	let job = images.get(key);
	if (!job) {
		job = new Promise((resolve) => {
			if (typeof Image === 'undefined') return resolve(null);
			const img = new Image();
			img.decoding = 'async';
			img.onload = () => resolve(img);
			img.onerror = () => resolve(null);
			img.src = sheetUrl(key);
		});
		images.set(key, job);
	}
	return job;
}

/** 칠할 것들이 쓰는 그림을 모두 받는다 */
export async function loadSheets(keys: Iterable<SheetKey>): Promise<Map<SheetKey, HTMLImageElement>> {
	const unique = [...new Set(keys)];
	const loaded = await Promise.all(unique.map(loadSheet));
	const out = new Map<SheetKey, HTMLImageElement>();
	unique.forEach((key, i) => {
		const img = loaded[i];
		if (img) out.set(key, img);
	});
	return out;
}

/** 칠할 것들을 차례대로 캔버스에 (부드럽게 하지 않는다) */
export function paintDraws(
	ctx: CanvasRenderingContext2D,
	draws: readonly Draw[],
	sheets: ReadonlyMap<SheetKey, HTMLImageElement>
) {
	ctx.imageSmoothingEnabled = false;
	for (const d of draws) {
		if (d.fill) {
			ctx.fillStyle = d.fill;
			ctx.fillRect(d.dx, d.dy, d.sw, d.sh);
			continue;
		}
		const img = sheets.get(d.sheet);
		if (img) ctx.drawImage(img, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.sw, d.sh);
	}
}

/** 밤에 켜는 불빛 하나: 가운데 (x, y)와 반지름 */
export interface Light {
	x: number;
	y: number;
	r: number;
}

/** 밤의 색: 낮 그림에 이 색을 곱한다 (사람 그림은 같은 값의 SVG 색 행렬로) */
export const NIGHT_RGB = [88, 98, 158] as const;

/** 칠한 판에 밤 색을 곱한다 (투명한 칸은 그대로) */
export function nightTint(ctx: CanvasRenderingContext2D, w: number, h: number) {
	const image = ctx.getImageData(0, 0, w, h);
	const px = image.data;
	const [r, g, b] = NIGHT_RGB;
	for (let i = 0; i < px.length; i += 4) {
		px[i] = (px[i] * r) / 255;
		px[i + 1] = (px[i + 1] * g) / 255;
		px[i + 2] = (px[i + 2] * b) / 255;
	}
	ctx.putImageData(image, 0, 0);
}

/**
 * 밤: 칠한 판에 밤 색을 곱해 어둡히고, 불빛 자리(문, 돌부처의 구슬)는 계단진 동그라미로 밝힌다(픽셀 격자 그대로).
 * 낮 그림을 그대로 쓰므로 밤만의 그림이 따로 없다
 */
export function nightOver(ctx: CanvasRenderingContext2D, w: number, h: number, lights: readonly Light[]) {
	nightTint(ctx, w, h);
	ctx.save();
	ctx.globalCompositeOperation = 'screen';
	for (const light of lights) {
		for (const [scale, alpha] of [
			[1, 0.1],
			[0.7, 0.14],
			[0.4, 0.22],
		] as const) {
			const r = Math.round(light.r * scale);
			ctx.fillStyle = `rgb(255 196 110 / ${alpha})`;
			// 계단진 동그라미: 두 줄마다 폭을 정수로
			for (let dy = -r; dy < r; dy += 2) {
				const half = Math.round(Math.sqrt(Math.max(0, r * r - (dy + 1) * (dy + 1))));
				ctx.fillRect(light.x - half, light.y + dy, half * 2, 2);
			}
		}
	}
	ctx.restore();
}
