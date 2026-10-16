// RPG 대화창(DialoguePage) 마을의 그림: 40×24 타일 지도(dialogueWorld.ts)를 Ninja Adventure 타일(dialogueNinja.ts)로 짠 칠할 것 목록.
// 땅은 풀 위에 흙길·돌바닥·물을 이웃에 맞춘 자동 타일로 깔고, 그 위의 것(숲의 나무, 덤불, 울타리, 바위 언덕, 집, 소품)은
// 발이 닿는 줄 차례로 세워 아래의 것이 위의 것을 덮는다. 자리마다 장소의 소품(집, 게시판, 이정표, 동굴, 상자...)을 두고,
// 주제가 없는 자리는 빈집·꽃밭으로 남긴다. 사람·몬스터는 DialogueTown이 그림 칸 하나씩(움직이는 칸 그림)으로 그 위에 세운다.
// 밤은 같은 그림에 남색을 곱하고 창과 문의 불빛만 밝힌다(nightOver). 같은 장소 묶음은 늘 같은 목록이고, 한 번 짠 것은 기억해 둔다
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
import { FOUNTAIN, TERRAIN, WORLD_H, WORLD_W, type PlaceKind, type Slot } from '@/apps/safari/project/dialogueWorld';

const ground = (x: number, y: number) => TERRAIN[y]?.[x] ?? 'T';

/**
 * 지도 둘레의 숲 여백(게임 칸): 지도 밖도 이만큼 숲을 칠해 둔다. 카메라가 위·아래 띠만큼 지도 끝을 넘거나 화면이 지도보다
 * 넓어도 빈 바탕 대신 숲이 보인다. 칠할 것의 자리는 지도 기준이라 여백 쪽은 음수이고, 캔버스는 여백만큼 밀어 칠한다
 */
export const VILLAGE_MARGIN = 3 * TILE;
const M_TILES = VILLAGE_MARGIN / TILE;

/**
 * 마을 그림: 칠할 것(땅 → 세운 것 차례), 사람보다 위에 칠할 것(나무 한 그루의 윗가지: 그 뒤 칸을 걸으면 가지 아래로 지나간다),
 * 밤에 켜는 불빛
 */
export interface VillageArt {
	draws: Draw[];
	overhead: Draw[];
	lights: Light[];
}

/** 세운 것 하나: 발이 닿는 줄(by)로 줄 세운다 */
interface Standing {
	by: number;
	draws: Draw[];
	overhead?: Draw[];
}

/** 칠할 것을 화면의 y줄에서 위·아래 둘로 자른다 */
function cut(draw: Draw, y: number): [Draw, Draw] {
	const top = Math.max(0, Math.min(draw.sh, y - draw.dy));
	return [
		{ ...draw, sh: top },
		{ ...draw, sy: draw.sy + top, dy: draw.dy + top, sh: draw.sh - top },
	];
}

// ─── 땅 ───

/** 풀 한 칸: 대개 무늬 없는 풀, 가끔 풀 포기 */
function grassTile(x: number, y: number): Sprite {
	const n = noise(x, y, 2);
	return n < 0.72 ? GROUND.grass[0] : GROUND.grass[1 + Math.floor(((n - 0.72) / 0.28) * 4)];
}

function groundDraws(): Draw[] {
	const out: Draw[] = [];
	for (let ty = -M_TILES; ty < WORLD_H + M_TILES; ty++) {
		for (let tx = -M_TILES; tx < WORLD_W + M_TILES; tx++) {
			const kind = ground(tx, ty);
			const at = (sprite: Sprite) => out.push(drawOf(sprite, tx * TILE, ty * TILE));
			switch (kind) {
				case ':':
					at(autotile(AUTOTILES.dirt, (dx, dy) => ':#p'.includes(ground(tx + dx, ty + dy))));
					break;
				case '#':
				case 'p':
					at(autotile(AUTOTILES.cobble, (dx, dy) => '#p'.includes(ground(tx + dx, ty + dy))));
					break;
				case '~':
					at(autotile(AUTOTILES.water, (dx, dy) => ground(tx + dx, ty + dy) === '~'));
					break;
				default:
					at(grassTile(tx, ty));
			}
		}
	}
	return [...out, ...tallGrass()];
}

/**
 * 긴 풀숲 (',' 칸): 풀 위에 긴 풀 포기를 칸마다 하나, 네 칸이 다 풀숲인 곳은 그 가운데에 반 칸 밀어 하나 더 세운다.
 * 포기마다 생김새가 달라 가장자리가 들쭉날쭉하고, 안쪽은 빽빽하다. 아래 줄의 포기가 위 줄을 덮게 줄 차례로 칠한다
 */
function tallGrass(): Draw[] {
	const out: Draw[] = [];
	const base: Draw[] = [];
	const tall = (x: number, y: number) => ground(x, y) === ',';
	for (let ty = 0; ty < WORLD_H; ty++) {
		for (let tx = 0; tx < WORLD_W; tx++) {
			if (!tall(tx, ty)) continue;
			// 안쪽 칸은 바닥을 짙은 풀로 (가장자리는 포기 사이로 옅은 풀이 비쳐 풀숲이 풀밭에 스며든다)
			if (tall(tx - 1, ty) && tall(tx + 1, ty) && tall(tx, ty - 1) && tall(tx, ty + 1))
				base.push(drawOf(GROUND.darkGrass, tx * TILE, ty * TILE));
			out.push(drawOf(pick(GROUND.tallGrass, tx, ty, 61), tx * TILE, ty * TILE));
			if (tall(tx + 1, ty) && tall(tx, ty + 1) && tall(tx + 1, ty + 1))
				out.push(drawOf(pick(GROUND.tallGrass, tx, ty, 62), tx * TILE + 8, ty * TILE + 8));
		}
	}
	return [...base, ...out.sort((a, b) => a.dy - b.dy)];
}

/** 풀밭의 꽃과 풀 포기 (길·자리 둘레는 피한다) */
function sprinkle(taken: ReadonlySet<number>): Draw[] {
	const out: Draw[] = [];
	for (let ty = 2; ty < WORLD_H - 2; ty++) {
		for (let tx = 2; tx < WORLD_W - 2; tx++) {
			if (ground(tx, ty) !== '.' || taken.has(ty * WORLD_W + tx)) continue;
			const n = noise(tx, ty, 41);
			if (n < 0.07) out.push(drawOf(pick(NATURE.flowers, tx, ty, 42), tx * TILE, ty * TILE));
			else if (n < 0.16) out.push(drawOf(pick(NATURE.tufts, tx, ty, 43), tx * TILE, ty * TILE));
		}
	}
	return out;
}

// ─── 세운 것 ───

/**
 * 숲: 'T' 칸마다 나무 한 그루 (32×32). 풀밭에 닿은 가장자리 나무는 풀밭 쪽으로 넘치지 않게 숲 안쪽으로 반 칸 민다
 */
function forest(): Standing[] {
	const out: Standing[] = [];
	const open = (x: number, y: number) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H && ground(x, y) !== 'T';
	for (let ty = -M_TILES; ty < WORLD_H + M_TILES; ty++) {
		for (let tx = -M_TILES; tx < WORLD_W + M_TILES; tx++) {
			if (ground(tx, ty) !== 'T') continue;
			// 안쪽 숲은 한 칸 걸러 (빽빽하되 같은 무늬가 겹겹이 쌓이지 않게)
			const edge = open(tx - 1, ty) || open(tx + 1, ty) || open(tx, ty - 1) || open(tx, ty + 1);
			if (!edge && (tx + ty) % 2 === 1) continue;
			let cx = tx * TILE + 8;
			if (open(tx + 1, ty) && !open(tx - 1, ty)) cx -= 8;
			else if (open(tx - 1, ty) && !open(tx + 1, ty)) cx += 8;
			// 아래가 풀밭이면 줄기가 칸 바닥에, 위가 풀밭이면 나무 꼭대기가 칸 위에 (그 아래 숲 칸으로 내려간다)
			const by = open(tx, ty - 1) && !open(tx, ty + 1) ? ty * TILE + 32 : ty * TILE + TILE + 2;
			const n = noise(tx, ty, 19);
			const sprite = n < 0.12 ? NATURE.pine : NATURE.trees[Math.floor(noise(tx, ty, 20) * NATURE.trees.length)];
			out.push({ by, draws: [standAt(sprite, cx + Math.round((noise(tx, ty, 21) - 0.5) * 4), by)] });
		}
	}
	return out;
}

/** 나무 한 그루, 덤불, 울타리 */
function scattered(): Standing[] {
	const out: Standing[] = [];
	for (let ty = 0; ty < WORLD_H; ty++) {
		for (let tx = 0; tx < WORLD_W; tx++) {
			const kind = ground(tx, ty);
			const cx = tx * TILE + 8;
			const by = ty * TILE + TILE;
			if (kind === 't') {
				const sprite = noise(tx, ty, 7) < 0.3 ? NATURE.blossom : pick(NATURE.trees, tx, ty, 8);
				const [crown, trunk] = cut(standAt(sprite, cx, by + 2), by - TILE);
				out.push({ by, draws: [standAt(ITEMS.shadow, cx, by + 1), trunk], overhead: [crown] });
			} else if (kind === 'b')
				out.push({ by, draws: [standAt(ITEMS.shadow, cx, by), standAt(pick(NATURE.bushes, tx, ty, 9), cx, by)] });
			else if (kind === 'F') out.push({ by, draws: [drawOf(PROPS.fenceH, tx * TILE, ty * TILE)] });
			else if (kind === 'p') out.push({ by, draws: [standAt(PROPS.plant, cx, by)] });
		}
	}
	return out;
}

/** 바위 언덕 ('^' 칸 묶음, 동쪽): 큰 회색 바위를 겹쳐 쌓는다 (동굴 입구는 장소가 그 앞에 세운다) */
function rockHill(): Standing[] {
	let x0 = Infinity;
	let y0 = Infinity;
	let x1 = -Infinity;
	let y1 = -Infinity;
	TERRAIN.forEach((row, y) => {
		for (let x = 0; x < WORLD_W; x++) {
			if (row[x] !== '^') continue;
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
		}
	});
	if (x1 < x0) return [];
	const left = x0 * TILE;
	const right = (x1 + 1) * TILE;
	const top = y0 * TILE;
	const bottom = (y1 + 1) * TILE;
	const out: Standing[] = [];
	const put = (sprite: Sprite, cx: number, by: number) => out.push({ by, draws: [standAt(sprite, cx, by)] });
	// 뒷줄 (위), 가운데 줄, 앞줄 (아래 가장자리)
	put(NATURE.grayBig, left + 30, top + 48);
	put(NATURE.grayBig, right - 30, top + 48);
	put(NATURE.grayBoulder, (left + right) / 2, top + 42);
	put(NATURE.grayTall, left + 14, bottom - 4);
	put(NATURE.grayTall, right - 14, bottom - 4);
	put(NATURE.grayBig, left + 44, bottom - 14);
	put(NATURE.grayBig, right - 44, bottom - 14);
	return out;
}

/** 광장 가운데 (연못 자리 2×2): 구슬을 든 돌부처 상. 밤에는 구슬이 빛난다 */
function statue(lights: Light[]): Standing {
	const cx = (FOUNTAIN.x + FOUNTAIN.w / 2) * TILE;
	const by = (FOUNTAIN.y + FOUNTAIN.h) * TILE - 2;
	lights.push({ x: cx, y: by - 14, r: 18 });
	return { by, draws: [standAt(PROPS.statue, cx, by)] };
}

/** 집 자리의 생김새: 그림과 문 양옆 소품 */
const HOUSES: Partial<Record<PlaceKind, { sprite: Sprite; side?: readonly [Sprite, Sprite] }>> = {
	shop: { sprite: BUILDINGS.market },
	inn: { sprite: BUILDINGS.noodle, side: [PROPS.barrel, PROPS.crateFruit] },
	library: { sprite: BUILDINGS.wood, side: [PROPS.plant, PROPS.pot] },
	smithy: { sprite: BUILDINGS.stone, side: [PROPS.barrel, NATURE.rockSmall[0]] },
};

/** 빈집 (주제가 없는 집 자리) */
const EMPTY_HOUSES = [BUILDINGS.beige, BUILDINGS.orange] as const;

/** 집 한 채: 자리(5×3칸) 가운데 아래에 문이 오게 세우고, 좁은 집은 양옆에 소품. 불빛은 문 */
function building(slot: Slot, active: boolean, lights: Light[]): Standing {
	const look = active ? HOUSES[slot.kind] : undefined;
	const sprite = look?.sprite ?? EMPTY_HOUSES[slot.x < WORLD_W / 2 ? 0 : 1];
	const cx = (slot.x + slot.w / 2) * TILE;
	const by = (slot.y + slot.h) * TILE;
	const draws = [standAt(sprite, cx, by)];
	if (look?.side && sprite.w < slot.w * TILE) {
		const margin = (slot.w * TILE - sprite.w) / 2;
		draws.push(standAt(look.side[0], cx - sprite.w / 2 - margin / 2, by));
		draws.push(standAt(look.side[1], cx + sprite.w / 2 + margin / 2, by));
	}
	if (active) lights.push({ x: cx, y: by - 12, r: 26 });
	return { by, draws };
}

/** 북쪽 문: 붉은 도리이와 양옆 깃발, 닫혀 있으면 문 아래를 울타리로 막는다 */
function gate(slot: Slot, open: boolean, lights: Light[]): Standing[] {
	const cx = (slot.x + slot.w / 2) * TILE;
	const by = (slot.y + slot.h) * TILE;
	// 도리이 양옆(자리의 바깥 두 칸)에 깃발
	const out: Standing[] = [
		{ by: by - 1, draws: [standAt(BUILDINGS.torii, cx, by)] },
		{ by: by - 2, draws: [standAt(PROPS.banner[0], cx - 24, by), standAt(PROPS.banner[0], cx + 24, by)] },
	];
	if (!open) {
		out.push({
			by: by - 2,
			draws: [drawOf(PROPS.fenceH, cx - TILE, by - TILE - 2), drawOf(PROPS.fenceH, cx, by - TILE - 2)],
		});
	} else lights.push({ x: cx, y: by - 14, r: 22 });
	return out;
}

/** 동굴 입구: 바위 언덕 앞의 돌 아치, 그 안은 어둡다 */
function cave(slot: Slot): Standing {
	const cx = slot.x * TILE + 8;
	const by = (slot.y + 1) * TILE;
	const dark = '#16131f';
	return {
		by,
		draws: [
			{ ...drawOf(BUILDINGS.arch, 0, 0), fill: dark, dx: cx - 11, dy: by - 30, sw: 22, sh: 30 },
			{ ...drawOf(BUILDINGS.arch, 0, 0), fill: dark, dx: cx - 8, dy: by - 33, sw: 16, sh: 3 },
			standAt(BUILDINGS.arch, cx, by),
		],
	};
}

/** 꽃밭 (빈 자리를 채운다) */
function flowerBed(slot: Slot): Draw[] {
	const out: Draw[] = [];
	for (let i = 0; i < slot.w * 2; i++) {
		const x = slot.x * TILE + Math.floor(noise(slot.x * 7 + i, slot.y, 6) * (slot.w * TILE - 8)) - 4;
		const y = slot.y * TILE - 4 + Math.floor(noise(i, slot.x, 5) * 8);
		out.push(drawOf(pick(NATURE.flowers, slot.x + i, slot.y, 44), x, y));
	}
	return out;
}

/** 자리 하나의 소품 (사람·몬스터는 DialogueTown이 세운다) */
function placeProp(slot: Slot, lights: Light[], gateOpen: boolean): Standing[] {
	const cx = slot.x * TILE + (slot.w * TILE) / 2;
	const by = (slot.y + slot.h) * TILE;
	const one = (...draws: Draw[]): Standing[] => [{ by, draws }];
	switch (slot.kind) {
		case 'gate':
			return gate(slot, gateOpen, lights);
		case 'board':
			// 게시판: 나무 틀에 종이 두 장
			return one(
				standAt(ITEMS.shadow, cx, by),
				standAt(PROPS.board, cx, by),
				drawOf(PROPS.notice, cx - 17, by - 27),
				drawOf(PROPS.picture, cx + 1, by - 27)
			);
		case 'signpost':
			return one(standAt(PROPS.signpost, cx, by));
		case 'sign':
			return one(standAt(PROPS.sign, cx, by));
		case 'mailbox':
			return one(standAt(PROPS.mailbox, cx, by));
		case 'cave':
			return [cave(slot)];
		case 'chest':
			return one(standAt(ITEMS.shadow, cx, by - 1), standAt(ITEMS.chestClosed, cx, by - 2));
		case 'arcade':
			return one(standAt(PROPS.notice, cx, by), standAt(PROPS.table, cx, by + 2));
		case 'easel':
			return one(standAt(PROPS.picture, cx, by));
		default:
			return [];
	}
}

const cache = new Map<string, VillageArt>();
const CACHE_LIMIT = 6;

/**
 * 마을 그림을 짠다: 땅 → 꽃 → (숲, 나무, 덤불, 울타리, 바위, 집, 소품을 발 줄 차례로).
 * active는 장소가 된 자리의 key들, gateOpen은 북쪽 문이 열렸는지 (같은 묶음이면 같은 목록을 다시 쓴다)
 */
export function composeVillage(slots: readonly Slot[], active: ReadonlySet<string>, gateOpen = false): VillageArt {
	const key = `${gateOpen ? 'o' : 'c'}|${slots.map((s) => `${s.key}${active.has(s.key) ? '+' : '-'}`).join(',')}`;
	const cached = cache.get(key);
	if (cached) return cached;
	const lights: Light[] = [];
	const taken = new Set<number>();
	for (const slot of slots)
		for (let y = slot.y - 1; y <= slot.y + slot.h; y++)
			for (let x = slot.x - 1; x <= slot.x + slot.w; x++) taken.add(y * WORLD_W + x);
	const standing: Standing[] = [...forest(), ...scattered(), ...rockHill(), statue(lights)];
	const beds: Draw[] = [];
	for (const slot of slots) {
		const on = active.has(slot.key);
		if (slot.kind in HOUSES) standing.push(building(slot, on, lights));
		else if (on) standing.push(...placeProp(slot, lights, gateOpen));
		else if (slot.fallback === 'flowers') beds.push(...flowerBed(slot));
	}
	standing.sort((a, b) => a.by - b.by);
	const art: VillageArt = {
		draws: [...groundDraws(), ...sprinkle(taken), ...beds, ...standing.flatMap((s) => s.draws)],
		overhead: standing.flatMap((s) => s.overhead ?? []).filter((d) => d.sh > 0),
		lights,
	};
	cache.set(key, art);
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	return art;
}

/** 장소마다 바닥에서 소품 꼭대기까지의 높이 (게임 칸): 표('!'·✓)를 그 위에 띄운다 */
const PROP_TOPS: Partial<Record<PlaceKind, number>> = {
	shop: 48,
	inn: 48,
	library: 48,
	smithy: 48,
	gate: 30,
	board: 32,
	member: 17,
	tutor: 17,
	bard: 17,
	monster: 15,
	signpost: 16,
	sign: 14,
	cave: 42,
	chest: 14,
	arcade: 18,
	easel: 15,
	mailbox: 32,
};

/** 장소 표를 띄울 자리: 소품 꼭대기 바로 위 가운데 (표의 아래 끝, 게임 칸) */
export function markPoint(slot: Slot): { x: number; y: number } {
	const base = (slot.y + slot.h) * TILE;
	return { x: slot.x * TILE + (slot.w * TILE) / 2, y: Math.max(14, base - (PROP_TOPS[slot.kind] ?? 18) - 1) };
}
