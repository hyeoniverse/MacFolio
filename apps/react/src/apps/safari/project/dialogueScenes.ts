// RPG 대화창(DialoguePage)의 장면: 화면(게임 칸 w×h) 가득 Ninja Adventure 타일(dialogueNinja.ts)로 짠 위에서 본 배경.
// 주제마다 하나(마을 밖 풀밭, 전투 들판, 마을 광장, 상점 안, 여관 안, 월드 맵, 동굴, 오락실, 달밤, 해 질 녘)이고, 가운데(무대의 그림과
// 그림판 자리)는 비워 두고 위쪽 띠와 양옆에만 나무·집·가구를 세운다. 화면 크기는 창마다 달라 땅 타일을 화면 끝까지 깔고,
// 소품은 왼쪽·오른쪽 끝을 기준으로 놓는다. 밤(다크)은 같은 그림에 밤 색을 곱하고 창·등불만 밝힌다(nightOver).
// 칠하는 일은 DialoguePixels의 SceneBackdrop이 한다. 여기는 계산만 (같은 장면·크기는 한 번만 짠다)
import {
	AUTOTILES,
	autotile,
	BUILDINGS,
	drawOf,
	GROUND,
	ITEMS,
	NATURE,
	noise,
	pick,
	PROPS,
	standAt,
	TILE,
	type Draw,
	type Light,
	type Sprite,
} from '@/apps/safari/project/dialogueNinja';
import type { SceneKind } from '@/apps/safari/project/dialogueStage';

export { TILE };

/** 장면 그림: 칠할 것, 밤의 불빛, 낮에도 밤 색을 곱하는지(달밤), 낮에 곱하는 색(동굴의 어둠) */
export interface SceneArt {
	draws: Draw[];
	lights: Light[];
	alwaysNight: boolean;
	/** 낮에 그림 위에 곱하는 색 (없으면 그대로) */
	tint?: string;
}

export const SCENE_KINDS: readonly SceneKind[] = [
	'sunset',
	'meadow',
	'field',
	'plaza',
	'shop',
	'menu',
	'map',
	'cave',
	'arcade',
	'night',
];

/** 땅을 화면 끝까지 깐다: tileFn(tx, ty)가 칸의 조각 */
function floor(w: number, h: number, tileFn: (tx: number, ty: number) => Sprite | Sprite[]): Draw[] {
	const out: Draw[] = [];
	for (let ty = 0; ty * TILE < h; ty++)
		for (let tx = 0; tx * TILE < w; tx++) {
			const got = tileFn(tx, ty);
			for (const sprite of Array.isArray(got) ? got : [got]) out.push(drawOf(sprite, tx * TILE, ty * TILE));
		}
	return out;
}

const grass = (tx: number, ty: number): Sprite => {
	const n = noise(tx, ty, 2);
	return n < 0.75 ? GROUND.grass[0] : GROUND.grass[1 + Math.floor(((n - 0.75) / 0.25) * 4)];
};

/** 세운 것들을 발 줄 차례로 */
const byFoot = (items: { by: number; draw: Draw }[]) => items.sort((a, b) => a.by - b.by).map((i) => i.draw);

/** 위쪽 숲 띠: 나무 두 줄을 화면 폭만큼 (위 가장자리 너머까지) */
function treeBand(w: number, seed: number, rows = 2): { by: number; draw: Draw }[] {
	const out: { by: number; draw: Draw }[] = [];
	for (let row = 0; row < rows; row++) {
		const by = 14 + row * 14;
		for (let x = -12 + (row % 2) * 13; x < w + 16; x += 26) {
			const sprite = noise(x, row, seed) < 0.15 ? NATURE.pine : pick(NATURE.trees, x, row, seed + 1);
			out.push({ by, draw: standAt(sprite, x + Math.round((noise(x, row, seed + 2) - 0.5) * 6), by) });
		}
	}
	return out;
}

/** 풀밭의 꽃과 풀 포기 (가운데는 드물게) */
function sprinkle(w: number, h: number, seed: number, top: number): Draw[] {
	const out: Draw[] = [];
	for (let ty = Math.ceil(top / TILE); ty * TILE < h; ty++)
		for (let tx = 0; tx * TILE < w; tx++) {
			const n = noise(tx, ty, seed);
			const edge = Math.min(tx * TILE, w - tx * TILE) < 72;
			if (n < (edge ? 0.12 : 0.04)) out.push(drawOf(pick(NATURE.flowers, tx, ty, seed + 1), tx * TILE, ty * TILE));
			else if (n < (edge ? 0.24 : 0.1)) out.push(drawOf(pick(NATURE.tufts, tx, ty, seed + 2), tx * TILE, ty * TILE));
		}
	return out;
}

/** 양옆 가장자리에 세우는 것: 왼쪽은 x, 오른쪽은 w − x (by는 발 줄) */
const sides = (w: number, list: [Sprite, number, number][]) =>
	list.flatMap(([sprite, x, by]) => [
		{ by, draw: standAt(sprite, x, by) },
		{ by, draw: standAt(sprite, w - x, by) },
	]);

/** 바깥 장면 (풀밭, 해 질 녘, 달밤): 숲 띠, 가로지르는 흙길, 양옆 덤불·나무·표지판 */
function outdoor(w: number, h: number, seed: number): { draws: Draw[]; lights: Light[] } {
	const roadTop = Math.max(5, Math.floor((h * 0.62) / TILE));
	const road = (ty: number) => ty === roadTop || ty === roadTop + 1;
	const ground = floor(w, h, (tx, ty) =>
		road(ty) ? autotile(AUTOTILES.dirt, (_dx, dy) => road(ty + dy)) : grass(tx, ty)
	);
	const items = [
		...treeBand(w, seed),
		...sides(w, [
			[NATURE.trees[1], 26, 92],
			[NATURE.bushes[1], 52, 104],
			[NATURE.bushes[0], 14, 128],
			[NATURE.trees[2], 18, roadTop * TILE - 4],
			[PROPS.sign, 66, roadTop * TILE - 2],
			[NATURE.blossom, 30, (roadTop + 3) * TILE + 12],
			[NATURE.bushes[3], 60, (roadTop + 3) * TILE + 6],
		]),
	];
	return {
		draws: [...ground, ...sprinkle(w, h, seed + 5, 40).filter((d) => !road(d.dy / TILE)), ...byFoot(items)],
		lights: [
			{ x: 66, y: roadTop * TILE - 10, r: 18 },
			{ x: w - 66, y: roadTop * TILE - 10, r: 18 },
		],
	};
}

/** 전투 들판: 가운데 흙 마당(몬스터가 서는 곳), 양옆은 긴 풀숲 */
function field(w: number, h: number): { draws: Draw[]; lights: Light[] } {
	const cols = Math.ceil(w / TILE);
	const rows = Math.ceil(h / TILE);
	const mid = Math.floor(cols / 2);
	const yard = (tx: number, ty: number) =>
		ty >= Math.floor(rows * 0.35) && ty <= Math.floor(rows * 0.35) + 4 && Math.abs(tx - mid + 0.5) <= 5.5;
	const tall = (tx: number, ty: number) => ty >= 3 && (tx < 3 || tx >= cols - 3);
	const ground = floor(w, h, (tx, ty) => {
		if (yard(tx, ty)) return autotile(AUTOTILES.dirt, (dx, dy) => yard(tx + dx, ty + dy));
		if (tall(tx, ty)) return [grass(tx, ty), GROUND.tallGrass];
		return grass(tx, ty);
	});
	const items = [
		...treeBand(w, 31),
		...sides(w, [
			[NATURE.rockSmall[0], 64, 110],
			[NATURE.bushes[2], 70, 150],
			[NATURE.stump, 62, 72],
		]),
	];
	return { draws: [...ground, ...sprinkle(w, h, 33, 48), ...byFoot(items)], lights: [] };
}

/** 마을 광장: 돌바닥, 위쪽에 집 한 줄, 양옆에 통·상자·화분 */
function plaza(w: number, h: number): { draws: Draw[]; lights: Light[] } {
	const ground = floor(w, h, (tx, ty) =>
		ty < 3 ? grass(tx, ty) : autotile(AUTOTILES.cobble, (_dx, dy) => ty + dy >= 3)
	);
	const houses = [BUILDINGS.thatch, BUILDINGS.noodle, BUILDINGS.redRoof, BUILDINGS.wood, BUILDINGS.market];
	const items: { by: number; draw: Draw }[] = [];
	const lights: Light[] = [];
	const gap = 76;
	const count = Math.ceil(w / gap) + 1;
	const x0 = (w - (count - 1) * gap) / 2;
	for (let i = 0; i < count; i++) {
		const sprite = houses[i % houses.length];
		const cx = Math.round(x0 + i * gap);
		items.push({ by: 50, draw: standAt(sprite, cx, 50) });
		lights.push({ x: cx, y: 40, r: 20 });
	}
	items.push(
		...sides(w, [
			[PROPS.barrel, 22, 92],
			[PROPS.crateFruit, 40, 94],
			[PROPS.pot, 18, 140],
			[PROPS.plant, 30, 176],
		])
	);
	return { draws: [...ground, ...byFoot(items)], lights };
}

/** 안쪽 장면 (상점, 여관, 오락실): 바닥 타일, 위쪽 벽, 벽에 붙인 가구, 양옆 가구 */
function indoor(
	w: number,
	h: number,
	floorTile: Sprite,
	along: readonly Sprite[],
	edge: [Sprite, number, number][]
): { draws: Draw[]; lights: Light[] } {
	// 바닥 위 맨 윗줄에 벽 (한 칸 두께), 벽에 붙여 가구
	const ground = floor(w, h, (_tx, ty) => (ty === 0 ? [floorTile, WALL] : floorTile));
	const items: { by: number; draw: Draw }[] = [];
	const lights: Light[] = [];
	const foot = TILE + 30;
	let x = 6;
	let i = 0;
	while (x < w - 6) {
		const sprite = along[i % along.length];
		items.push({ by: foot, draw: drawOf(sprite, x, foot - sprite.h) });
		if (i % 2 === 0) lights.push({ x: x + sprite.w / 2, y: foot - 12, r: 18 });
		x += sprite.w + 10;
		i++;
	}
	items.push(...sides(w, edge));
	return { draws: [...ground, ...byFoot(items)], lights };
}

/** 벽: 벽 묶음의 위 가장자리 (한 칸 두께, 아래로 그늘 줄) */
const WALL: Sprite = { sheet: 'wall', x: 48, y: 0, w: TILE, h: TILE };

/** 월드 맵: 풀밭을 가로지르는 강, 듬성듬성 나무와 먼 집 */
function worldMap(w: number, h: number): { draws: Draw[]; lights: Light[] } {
	const rows = Math.ceil(h / TILE);
	const river = (tx: number, ty: number) => {
		const centre = rows - 3 + Math.round(Math.sin(tx / 3) * 0.8);
		return ty >= centre && ty <= centre + 1;
	};
	const ground = floor(w, h, (tx, ty) =>
		river(tx, ty) ? autotile(AUTOTILES.water, (dx, dy) => river(tx + dx, ty + dy)) : grass(tx, ty)
	);
	const items = [
		...treeBand(w, 51, 1),
		...sides(w, [
			[BUILDINGS.beige, 40, 76],
			[NATURE.trees[0], 92, 70],
			[NATURE.pine, 18, 120],
			[NATURE.bushes[1], 70, 130],
		]),
	];
	return {
		draws: [...ground, ...sprinkle(w, h, 53, 40).filter((d) => !river(d.dx / TILE, d.dy / TILE)), ...byFoot(items)],
		lights: [
			{ x: 40, y: 64, r: 18 },
			{ x: w - 40, y: 64, r: 18 },
		],
	};
}

/** 동굴: 짙은 흙바닥, 위쪽 바위 벽, 양옆 바위 */
function cave(w: number, h: number): { draws: Draw[]; lights: Light[] } {
	const ground = floor(w, h, () => autotile(AUTOTILES.darkDirt, () => true));
	const items: { by: number; draw: Draw }[] = [];
	for (let x = -10; x < w + 40; x += 56) {
		items.push({ by: 40, draw: standAt(noise(x, 1, 61) < 0.5 ? NATURE.grayBig : NATURE.grayTall, x, 40) });
		items.push({ by: 24, draw: standAt(NATURE.grayBig, x + 28, 24) });
	}
	items.push(
		...sides(w, [
			[NATURE.grayTall, 16, 120],
			[NATURE.grayBoulder, 46, 160],
			[NATURE.rockSmall[1], 60, 96],
			[ITEMS.chestOpen, 72, 130],
		])
	);
	return { draws: [...ground, ...byFoot(items)], lights: [] };
}

const cache = new Map<string, SceneArt>();
const CACHE_LIMIT = 24;

/** 장면 하나를 짠다 (w×h 게임 칸, 땅이 빈칸 없이 화면을 덮는다) */
export function composeScene(kind: SceneKind, w: number, h: number): SceneArt {
	const key = `${kind}|${w}x${h}`;
	const cached = cache.get(key);
	if (cached) return cached;
	let made: { draws: Draw[]; lights: Light[] };
	switch (kind) {
		case 'field':
			made = field(w, h);
			break;
		case 'plaza':
			made = plaza(w, h);
			break;
		case 'shop':
			made = indoor(
				w,
				h,
				GROUND.brick,
				[PROPS.shelf, PROPS.bookshelf, PROPS.stall],
				[
					[PROPS.barrel, 20, 100],
					[PROPS.crateFruit, 42, 104],
					[PROPS.pot, 20, 150],
				]
			);
			break;
		case 'menu':
			made = indoor(
				w,
				h,
				GROUND.brickWarm,
				[PROPS.bookshelf, PROPS.drawer, PROPS.plant, PROPS.shelf],
				[
					[PROPS.table, 30, 110],
					[PROPS.plant, 16, 150],
				]
			);
			break;
		case 'arcade':
			made = indoor(
				w,
				h,
				GROUND.tiles,
				[...PROPS.banner, PROPS.crateFruit],
				[
					[PROPS.barrel, 20, 104],
					[PROPS.pot, 40, 150],
				]
			);
			break;
		case 'map':
			made = worldMap(w, h);
			break;
		case 'cave':
			made = cave(w, h);
			break;
		case 'night':
			made = outdoor(w, h, 71);
			break;
		case 'sunset':
			made = outdoor(w, h, 81);
			break;
		default:
			made = outdoor(w, h, 11);
	}
	const art: SceneArt = {
		...made,
		alwaysNight: kind === 'night',
		tint: kind === 'cave' ? '#a8a0c8' : undefined,
	};
	cache.set(key, art);
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	return art;
}
