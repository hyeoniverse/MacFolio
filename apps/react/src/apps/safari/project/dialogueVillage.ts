// RPG 대화창(DialoguePage) 마을의 그림: 40×24 타일 지도(dialogueWorld.ts)를 640×384 판 하나에 칠하고, 그 위를 걷는 사람·몬스터·문 그림을 둔다.
// 땅은 16×16 타일(풀, 흙길, 돌바닥, 긴 풀, 물, 바위 벼랑)을 이웃에 맞춰 가장자리를 다듬어 깔고, 숲은 둥근 나무를 겹쳐 세운다.
// 자리마다 장소의 소품(집과 간판, 게시판, 이정표, 동굴, 오락기, 이젤, 우체통)을 그리고, 주제가 없는 자리는 빈집·꽃밭으로 남긴다.
// 장면(dialogueScenes.ts)과 같은 팔레트 글자·그리는 도구를 쓰고, 다크는 같은 그림을 밤 팔레트로 칠한다(창과 가로등만 켠다).
// 정해진 그림이라 같은 장소 묶음은 늘 같은 모습이고, 한 번 칠한 판은 기억해 둔다
import {
	checker,
	clump,
	COBBLE,
	flower,
	fountain,
	GRASS_TILES,
	house,
	ICON_REMAP,
	ITEM_COLORS,
	nightOf,
	NIGHT_LIGHTS,
	noise,
	OUTDOOR,
	PixelMap,
	questBoardRows,
	signpostRows,
	TALL_GRASS,
	TILE,
	tileAt,
	tree,
	tuft,
	WATER,
} from '@/apps/safari/project/dialogueScenes';
import { ICONS, type IconName } from '@/apps/safari/project/dialogueIcons';
import { monsterColors, outlined } from '@/apps/safari/project/dialogueStage';
import {
	FOUNTAIN,
	TERRAIN,
	WORLD_H,
	WORLD_PX_H,
	WORLD_PX_W,
	WORLD_W,
	type Facing,
	type PlaceKind,
	type Slot,
} from '@/apps/safari/project/dialogueWorld';

/** 마을의 낮 색: 바깥 장면의 공통 색에 지붕(빨강 X, 파랑 A, 초록 1–3, 보라 4–6), 물, 벼랑(H h I V), 동굴 속(K), 가게 물건 */
const VILLAGE_DAY: Record<string, string> = {
	...OUTDOOR,
	...ITEM_COLORS,
	X: '#f88070',
	x: '#e05448',
	y: '#a83438',
	A: '#78a8f0',
	a: '#5080d8',
	b: '#3458a8',
	'1': '#9ce07c',
	'2': '#5cb45c',
	'3': '#36844a',
	'4': '#c8a0f0',
	'5': '#9070d0',
	'6': '#5c48a0',
	U: '#d8f6ff',
	u: '#70c8f0',
	v: '#3c90d0',
	Y: '#fff0a0',
	S: '#f0e4cc',
	s: '#dcc8a4',
	r: '#bca482',
	R: '#8c7458',
	H: '#ecd8a8',
	h: '#c8a874',
	I: '#9c7c50',
	V: '#5c4428',
	K: '#1c1824',
	J: '#6cbc5c',
	j: '#4c9c4c',
	i: '#2e6e40',
	E: '#1e5034',
};

/** 밤에도 그대로 빛나는 글자: 별, 창 불빛, 가로등 */
const VILLAGE_GLOW = new Set(['Z', 'z', 'Y']);

/** 마을의 팔레트 (낮 또는 밤): 밤은 nightOf로 어둡히고, 창은 불을 켠다 */
export function villagePalette(night: boolean): Record<string, string> {
	if (!night) return VILLAGE_DAY;
	const out: Record<string, string> = {};
	for (const [key, color] of Object.entries(VILLAGE_DAY))
		out[key] = VILLAGE_GLOW.has(key) ? color : (NIGHT_LIGHTS[key] ?? nightOf(color));
	return out;
}

const ground = (x: number, y: number) => TERRAIN[y]?.[x] ?? 'T';
const isPath = (x: number, y: number) => ground(x, y) === ':';
const isWater = (x: number, y: number) => ground(x, y) === '~';
const isCliff = (x: number, y: number) => ground(x, y) === '^';

// ─── 땅 타일 ───

/** 흙길: 가운데는 고운 흙에 자갈, 풀과 닿는 쪽은 짙은 흙 줄과 들쭉날쭉한 풀 가장자리 */
function pathTile(map: PixelMap, tx: number, ty: number) {
	const ox = tx * TILE;
	const oy = ty * TILE;
	const open = (dx: number, dy: number) => isPath(tx + dx, ty + dy) || ground(tx + dx, ty + dy) === '#';
	for (let y = 0; y < TILE; y++) {
		for (let x = 0; x < TILE; x++) {
			const n = noise(ox + x, oy + y, 4);
			let key = n < 0.04 ? 'q' : n > 0.97 ? 'P' : 'p';
			// 풀 쪽 가장자리: 1–2칸 풀(해시로 들쭉날쭉), 그 안쪽 한 줄은 짙은 흙
			const edge = (d: number, side: boolean) => {
				if (side) return;
				const bite = 1 + (noise(ox + x + oy + y, d, 12) < 0.4 ? 1 : 0);
				if (d < bite) key = d === 0 || checker(x, y) ? 'g' : 'd';
				else if (d === bite) key = 'q';
			};
			edge(y, open(0, -1));
			edge(TILE - 1 - y, open(0, 1));
			edge(x, open(-1, 0));
			edge(TILE - 1 - x, open(1, 0));
			map.set(ox + x, oy + y, key);
		}
	}
}

/** 연잎: 둥근 잎에 갈라진 틈, 밝은 윗면 */
const LILY = ['..jjjj..', '.jJJJjj.', 'jJJJ.jjj', 'jJJj..jj', '.jjjjjj.', '..jjjj..'];

/** 물: 물결 타일, 둑과 닿는 쪽은 짙은 둑 줄과 그늘진 물, 그 안쪽에 흰 물거품 점. 몇 칸에는 연잎이 뜬다 */
function waterTile(map: PixelMap, tx: number, ty: number) {
	tileAt(map, WATER, tx, ty);
	const ox = tx * TILE;
	const oy = ty * TILE;
	if (noise(tx, ty, 61) < 0.3)
		map.stamp(LILY, ox + 3 + Math.floor(noise(tx, ty, 62) * 5), oy + 4 + Math.floor(noise(tx, ty, 63) * 5));
	const shore = (dx: number, dy: number) => !isWater(tx + dx, ty + dy);
	for (let y = 0; y < TILE; y++) {
		for (let x = 0; x < TILE; x++) {
			let key: string | undefined;
			if (shore(0, -1) && y < 3) key = y === 0 ? 'e' : y === 1 ? 'v' : checker(x, y) ? 'v' : undefined;
			if (shore(0, 1) && y > TILE - 3) key = y === TILE - 1 ? 'e' : 'U';
			if (shore(-1, 0) && x < 2) key = x === 0 ? 'e' : 'v';
			if (shore(1, 0) && x > TILE - 3) key = x === TILE - 1 ? 'e' : 'v';
			if (key) map.set(ox + x, oy + y, key);
		}
	}
}

/**
 * 바위 벼랑: 모난 돌 조각(10칸 격자에 해시로 흩뿌린 씨앗의 보로노이)을 쌓은 벽. 조각마다 왼쪽 위는 밝고 오른쪽 아래는 그늘,
 * 조각 사이는 짙은 금. 위에는 들쭉날쭉한 풀 턱이 덮고, 아래로 갈수록 그늘지며, 바깥 테두리는 짙은 선. 아래 풀밭에 그림자를 드리운다
 */
function cliffTile(map: PixelMap, tx: number, ty: number) {
	const ox = tx * TILE;
	const oy = ty * TILE;
	const top = !isCliff(tx, ty - 1);
	const bottom = !isCliff(tx, ty + 1);
	const left = !isCliff(tx - 1, ty);
	const right = !isCliff(tx + 1, ty);
	const cell = 10;
	const seedOf = (gx: number, gy: number): [number, number] => [
		gx * cell + (gy % 2 ? cell / 2 : 0) + (noise(gx, gy, 51) - 0.5) * cell * 0.7,
		gy * 8 + (noise(gx, gy, 52) - 0.5) * 4,
	];
	for (let y = 0; y < TILE; y++) {
		for (let x = 0; x < TILE; x++) {
			const gx = ox + x;
			const gy = oy + y;
			let d1 = Infinity;
			let d2 = Infinity;
			let best: [number, number] = [0, 0];
			const ry = Math.round(gy / 8);
			for (let j = ry - 1; j <= ry + 1; j++) {
				const rx = Math.round((gx - (j % 2 ? cell / 2 : 0)) / cell);
				for (let i = rx - 1; i <= rx + 1; i++) {
					const seed = seedOf(i, j);
					const d = Math.hypot(gx + 0.5 - seed[0], (gy + 0.5 - seed[1]) * 1.3);
					if (d < d1) {
						d2 = d1;
						d1 = d;
						best = seed;
					} else if (d < d2) d2 = d;
				}
			}
			let key: string;
			if (d2 - d1 < 1.4) key = 'V';
			else {
				const light = -(gx + 0.5 - best[0] + (gy + 0.5 - best[1])) / cell;
				key = light > 0.3 ? 'H' : light < -0.25 ? 'I' : 'h';
				if (d2 - d1 < 2.6 && light < 0) key = 'I';
			}
			// 위 풀 턱: 3–6칸, 아래 끝은 해시로 들쭉날쭉, 그 밑 한 줄은 짙은 그늘
			if (top) {
				const lip = 3 + Math.floor(noise(Math.floor(gx / 3), ty, 53) * 4);
				if (y < lip) key = y === 0 ? 'e' : y === lip - 1 && checker(gx, gy) ? 'd' : 'g';
				else if (y === lip) key = 'V';
				else if (y === lip + 1 && key !== 'V') key = 'I';
			}
			// 아래쪽은 그늘 (점 무늬로 섞는다)
			if (bottom && y > 9 && key !== 'V' && (y > 12 || checker(gx, gy))) key = key === 'H' ? 'h' : 'I';
			if ((left && x === 0) || (right && x === TILE - 1) || (bottom && y === TILE - 1)) key = 'V';
			map.set(gx, gy, key);
		}
	}
	// 벼랑 아래 풀밭에 지는 그늘 두 줄
	if (bottom) {
		for (let x = 0; x < TILE; x++) {
			map.set(ox + x, oy + TILE, 'e');
			if (checker(ox + x, oy + TILE + 1)) map.set(ox + x, oy + TILE + 1, 'e');
		}
	}
}

/** 땅 한 칸 */
function groundTile(map: PixelMap, tx: number, ty: number) {
	const kind = ground(tx, ty);
	if (kind === ':') pathTile(map, tx, ty);
	else if (kind === '#') tileAt(map, COBBLE, tx, ty);
	else if (kind === '~') waterTile(map, tx, ty);
	else if (kind === '^') cliffTile(map, tx, ty);
	else {
		tileAt(map, GRASS_TILES[Math.floor(noise(tx, ty, 2) * 3)], tx, ty);
		if (kind === ',') tileAt(map, TALL_GRASS, tx, ty);
		else if (kind === 'T') map.rect(tx * TILE, ty * TILE, TILE, TILE, 'i');
	}
}

/** 광장 가장자리: 돌바닥과 풀이 닿는 곳에 짙은 돌 테두리 한 줄 */
function plazaEdge(map: PixelMap) {
	for (let ty = 0; ty < WORLD_H; ty++) {
		for (let tx = 0; tx < WORLD_W; tx++) {
			if (ground(tx, ty) !== '#') continue;
			const ox = tx * TILE;
			const oy = ty * TILE;
			const grass = (dx: number, dy: number) => {
				const g = ground(tx + dx, ty + dy);
				return g !== '#' && g !== ':';
			};
			if (grass(0, -1)) map.rect(ox, oy, TILE, 1, 'R');
			if (grass(0, 1)) map.rect(ox, oy + TILE - 1, TILE, 1, 'R');
			if (grass(-1, 0)) map.rect(ox, oy, 1, TILE, 'R');
			if (grass(1, 0)) map.rect(ox + TILE - 1, oy, 1, TILE, 'R');
		}
	}
}

// ─── 소품 ───

/** 칸 그림을 타일 (tx, ty)의 바닥 가운데에 세운다 (그림이 타일보다 높으면 위 칸으로 솟는다) */
function standOn(map: PixelMap, rows: readonly string[], tx: number, ty: number, w = 1, dy = 0) {
	const width = rows[0]?.length ?? 0;
	map.stamp(rows, tx * TILE + Math.floor((w * TILE - width) / 2), ty * TILE + TILE - rows.length + dy);
}

/** 발밑 그림자: 타원 점 무늬 */
function shadowAt(map: PixelMap, cx: number, by: number, rx: number) {
	for (let y = -1; y <= 1; y++)
		for (let x = -rx; x <= rx; x++) {
			if ((x / rx) ** 2 + y * y * 0.5 > 1) continue;
			if (checker(cx + x, by + y) || Math.abs(x) < rx - 1) map.set(cx + x, by + y, 'e');
		}
}

/** 아이콘(12×12)을 나무 간판(14×14)에 담아 찍는다 */
function iconSign(map: PixelMap, x: number, y: number, icon: IconName) {
	map.rect(x, y, 14, 14, 'N');
	map.rect(x + 1, y + 1, 12, 12, 'O');
	map.stamp(ICONS[icon], x + 1, y + 1, false, ICON_REMAP);
}

/** 집 자리(5×4칸)의 지붕 색과 간판 */
const HOUSES: Partial<Record<Slot['kind'], { roof: 'X' | 'A' | readonly [string, string, string]; icon?: IconName }>> =
	{
		shop: { roof: 'X', icon: 'bag' },
		inn: { roof: 'A', icon: 'heart' },
		library: { roof: ['1', '2', '3'], icon: 'book' },
		smithy: { roof: ['4', '5', '6'], icon: 'hammer' },
	};

/** 집 한 채: 자리 5×4칸을 꽉 채우고(지붕은 위 칸으로 조금 솟는다), 문 오른쪽 위에 간판. 빈집은 간판 없이 */
function building(map: PixelMap, slot: Slot, active: boolean) {
	const x = slot.x * TILE + 6;
	const w = slot.w * TILE - 12;
	const roofH = 32;
	const wallH = 36;
	const y = slot.y * TILE + slot.h * TILE - roofH - wallH;
	const look = HOUSES[slot.kind] ?? { roof: 'X' as const };
	// 대장간은 굴뚝 (지붕보다 먼저, 지붕 뒤로 솟는다)
	if (slot.kind === 'smithy') {
		const cx = x + Math.round(w * 0.62);
		map.rect(cx, y - 8, 10, 18, 'V');
		map.rect(cx + 1, y - 7, 8, 17, 'r');
		map.rect(cx + 1, y - 7, 2, 17, 's');
		map.rect(cx, y - 9, 10, 2, 'R');
	}
	house(map, x, y, w, roofH, wallH, active ? look.roof : slot.x < 20 ? 'X' : 'A');
	// 창 아래 꽃 상자
	for (const wx of w > 50 ? [x + 6, x + w - 16] : [x + 6]) {
		const by = y + roofH + 14;
		map.rect(wx - 1, by, 12, 3, 'N');
		map.rect(wx, by + 1, 10, 1, 'o');
		for (let i = 0; i < 10; i += 2) map.set(wx + i, by - 1, i % 4 === 0 ? 'f' : 'F');
		for (let i = 1; i < 10; i += 2) map.set(wx + i, by - 1, 'd');
	}
	if (active && look.icon) iconSign(map, x + Math.round(w / 2) + 9, y + roofH + 3, look.icon);
	// 문 앞 디딤돌
	const door = x + Math.round(w / 2) - 6;
	map.rect(door + 1, y + roofH + wallH, 10, 2, 'r');
	map.rect(door + 1, y + roofH + wallH, 10, 1, 's');
	// 대장간: 문 옆 모루
	if (slot.kind === 'smithy' && active) {
		const ax = x - 4;
		const ay = y + roofH + wallH - 4;
		map.rect(ax, ay - 6, 12, 3, 'V');
		map.rect(ax + 1, ay - 6, 10, 1, 'S');
		map.rect(ax + 3, ay - 3, 6, 4, 'V');
		map.rect(ax + 1, ay + 1, 10, 2, 'V');
	}
}

/** 우체통: 빨간 통에 투입구, 나무 기둥 */
const MAILBOX = [
	'.kkkkkkkk.',
	'kxXXXXXXxk',
	'kXXXXXXXyk',
	'kXkkkkkXyk',
	'kXXXXXXXyk',
	'kXXXXXXXyk',
	'kxyyyyyyyk',
	'.kkkkkkkk.',
	'...NonN...',
	'...NonN...',
	'...NonN...',
	'...NonN...',
	'..NNNNNN..',
];

/** 오락기: 보라 몸통, 빛나는 화면, 조이스틱과 단추 */
const ARCADE = [
	'.kkkkkkkkkkkk.',
	'k444444444445k',
	'k4ffYfYfYfY65k',
	'k444444444445k',
	'k4kkkkkkkkk65k',
	'k4kIJIIIJIk65k',
	'k4kIIWIWIIk65k',
	'k4kIJWWWJIk65k',
	'k4kIIIIIIIk65k',
	'k4kkkkkkkkk65k',
	'k44444444445k.',
	'kk66666666666k',
	'k5kf5Y5f5Y56k.',
	'k5k5555555566k',
	'k555555555566k',
	'k55FF5555556k.',
	'k555555555566k',
	'k555555555566k',
	'kkkkkkkkkkkkkk',
];

/** 이젤: 나무 다리 셋, 캔버스에 해와 언덕 */
const EASEL = [
	'......NN......',
	'.NNNNNNNNNNNN.',
	'.NWWWWWWWWWWN.',
	'.NWLLLLLLFFWN.',
	'.NWLLLLLLFFWN.',
	'.NWLLLLLLLLWN.',
	'.NWLLGGLLLLWN.',
	'.NWGGGGGGLLWN.',
	'.NWggGGGGGGWN.',
	'.NWggggggggWN.',
	'.NNNNNNNNNNNN.',
	'..No..NN..oN..',
	'..No..No..oN..',
	'.No...No...oN.',
	'.No...No...oN.',
	'No....No....oN',
];

/** 보물 상자 (14×12): 나무 몸통, 금 테, 자물쇠 */
const CHEST = [
	'.kkkkkkkkkkkk.',
	'kOOOOOOOOOOOok',
	'kOooooooooooonk',
	'kFFFFFFFFFFFFk',
	'knnnnnFFnnnnnk',
	'kkkkkkFkkkkkkk',
	'kOooooFFooooonk',
	'kOoooooooooonk',
	'kFooooooooooFk',
	'kFnnnnnnnnnnFk',
	'.kkkkkkkkkkkk.',
].map((row) => row.slice(0, 14));

/** 동굴 입구: 벼랑에 난 둥근 굴, 안은 어둡고 둘레는 짙은 돌 */
function caveMouth(map: PixelMap, tx: number, ty: number) {
	const cx = tx * TILE + 8;
	const by = ty * TILE + TILE;
	for (let y = 0; y < 22; y++) {
		for (let x = -11; x <= 11; x++) {
			const d = (x / 10.5) ** 2 + ((y - 22) / 21) ** 2;
			if (d > 1.12 || y > 21) continue;
			const key = d > 0.92 ? 'V' : d > 0.8 ? 'I' : y > 17 ? 'k' : 'K';
			map.set(cx + x, by - 22 + y, key);
		}
	}
	// 입구 앞 자갈
	for (const [x, y] of [
		[-9, 1],
		[8, 2],
		[-4, 3],
	])
		map.rect(cx + x, by + y, 2, 1, 'r');
}

/** 북쪽 문의 돌기둥 둘과 위 아치 (문짝은 열림에 따라 사람 판에 그린다) */
function gateFrame(map: PixelMap, slot: Slot) {
	const x0 = slot.x * TILE;
	const x1 = (slot.x + slot.w) * TILE;
	const y0 = slot.y * TILE - 10;
	const y1 = (slot.y + slot.h) * TILE;
	const pillar = (px: number) => {
		map.rect(px, y0, 14, y1 - y0, 'V');
		map.rect(px + 1, y0 + 1, 12, y1 - y0 - 2, 's');
		map.rect(px + 1, y0 + 1, 3, y1 - y0 - 2, 'S');
		map.rect(px + 10, y0 + 1, 3, y1 - y0 - 2, 'r');
		for (let y = y0 + 8; y < y1; y += 8) map.rect(px + 1, y, 12, 1, 'r');
		map.rect(px - 2, y0 - 4, 18, 5, 'V');
		map.rect(px - 1, y0 - 3, 16, 3, 'S');
	};
	// 아치: 두 기둥 사이 가로 돌
	map.rect(x0 + 6, y0 - 2, x1 - x0 - 12, 8, 'V');
	map.rect(x0 + 7, y0 - 1, x1 - x0 - 14, 6, 's');
	map.rect(x0 + 7, y0 - 1, x1 - x0 - 14, 2, 'S');
	pillar(x0 + 2);
	pillar(x1 - 16);
	// 문 너머 길
	map.rect(x0 + 16, y1 - 4, x1 - x0 - 32, 4, 'q');
}

/** 꽃밭 (빈 자리를 채운다): 해시로 고른 꽃 몇 송이와 풀 포기 */
function flowerBed(map: PixelMap, slot: Slot) {
	const colors = ['f', 'F', 'W', '-'];
	for (let i = 0; i < slot.w * 3; i++) {
		const n = noise(slot.x * 7 + i, slot.y, 5);
		const x = slot.x * TILE + 1 + Math.floor(noise(i, slot.x, 6) * (slot.w * TILE - 4));
		const y = slot.y * TILE + 2 + Math.floor(n * 9);
		flower(map, x, y, colors[Math.floor(n * colors.length)], 'F', 'e');
	}
	tuft(map, slot.x * TILE + 4, slot.y * TILE + 13, 'G', 'd');
}

/** 이정표: 나무 판과 기둥, 판에 지도 아이콘 */
function signpost(map: PixelMap, tx: number, ty: number) {
	const rows = signpostRows(16, 12, 8);
	standOn(map, rows, tx, ty);
	map.stamp(ICONS.map, tx * TILE + 2, ty * TILE + TILE - rows.length + 0, false, ICON_REMAP);
}

/** 조작 안내판: 판에 열쇠 아이콘 */
function keySign(map: PixelMap, tx: number, ty: number) {
	const rows = signpostRows(16, 12, 8);
	standOn(map, rows, tx, ty);
	map.stamp(ICONS.key, tx * TILE + 2, ty * TILE + TILE - rows.length, false, ICON_REMAP);
}

/** 가로등: 짙은 기둥에 등 (밤에는 켠다) */
function lamp(map: PixelMap, x: number, by: number) {
	map.rect(x, by - 22, 3, 22, 'k');
	map.rect(x + 1, by - 22, 1, 21, 'R');
	map.rect(x - 3, by - 29, 9, 8, 'k');
	map.rect(x - 2, by - 28, 7, 6, 'Y');
	map.rect(x - 2, by - 28, 7, 1, 'W');
	map.rect(x - 2, by - 1, 7, 2, 'k');
}

/** 나무 울타리 한 칸짜리 기둥과 가로대 (x는 왼쪽, by는 바닥) */
function fenceRun(map: PixelMap, x: number, by: number, w: number) {
	map.rect(x, by - 9, w, 3, 'N');
	map.rect(x, by - 8, w, 1, 'O');
	map.rect(x, by - 5, w, 3, 'N');
	map.rect(x, by - 4, w, 1, 'o');
	for (let px = x; px < x + w - 2; px += 8) {
		map.rect(px, by - 12, 4, 12, 'N');
		map.rect(px + 1, by - 11, 2, 10, 'o');
		map.rect(px + 1, by - 11, 1, 10, 'O');
	}
}

/**
 * 숲: 'T' 칸마다 둥근 나무 하나 (위 줄부터, 아래 나무가 위 나무를 덮는다). 해시로 조금씩 비키고 색을 두 가지로.
 * border면 가장자리 숲(소품보다 먼저), 아니면 마을 안에 홀로 선 나무(소품 다음)
 */
function forest(map: PixelMap, border: boolean) {
	const keysA = { hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' };
	const keysB = { hi: 'J', base: 'j', shade: 'i', line: 'i', outline: 'E' };
	for (let ty = 0; ty < WORLD_H; ty++) {
		for (let tx = 0; tx < WORLD_W; tx++) {
			if (ground(tx, ty) === 'b' && !border) {
				// 덤불: 낮고 둥근 덩어리 둘과 발밑 그림자
				const cx = tx * TILE + 8;
				const by = ty * TILE + 13;
				for (let i = -7; i <= 7; i++) map.set(cx + i, by + 1, checker(cx + i, by + 1) ? 'e' : 'd');
				clump(
					map,
					[
						[cx - 3, by - 5, 5.5],
						[cx + 3, by - 4, 5],
						[cx, by - 8, 5],
					],
					{ hi: 'G', base: 'g', shade: 'd', line: 'd', outline: 'e' }
				);
				continue;
			}
			if (ground(tx, ty) !== 'T') continue;
			const edge = tx < 2 || ty < 2 || tx >= WORLD_W - 2 || ty >= WORLD_H - 2 || ground(tx, ty - 1) === 'T';
			if (edge !== border) continue;
			const n = noise(tx, ty, 19);
			const jitter = Math.round((noise(tx, ty, 20) - 0.5) * 4);
			tree(map, tx * TILE + 8 + jitter, ty * TILE + 15, 9 + Math.round(n * 2), n < 0.55 ? keysA : keysB, 'E');
		}
	}
}

/** 바닥의 꾸밈: 풀밭에 해시로 흩뿌린 꽃과 풀 포기 (길·광장·소품 자리는 피한다) */
function sprinkle(map: PixelMap, taken: ReadonlySet<number>) {
	for (let ty = 2; ty < WORLD_H - 2; ty++) {
		for (let tx = 2; tx < WORLD_W - 2; tx++) {
			if (ground(tx, ty) !== '.' || taken.has(ty * WORLD_W + tx)) continue;
			const n = noise(tx, ty, 41);
			const x = tx * TILE + 3 + Math.floor(noise(tx, ty, 42) * 9);
			const y = ty * TILE + 3 + Math.floor(noise(tx, ty, 43) * 8);
			if (n < 0.08) flower(map, x, y, n < 0.04 ? 'f' : 'W', 'F', 'e');
			else if (n < 0.2) tuft(map, x, y + 4, 'G', 'd');
		}
	}
}

// ─── 마을 판 ───

const maps = new Map<string, PixelMap>();
const images = new Map<string, Uint8ClampedArray>();
const CACHE_LIMIT = 6;
function remember<T>(cache: Map<string, T>, key: string, value: T): T {
	cache.set(key, value);
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
	return value;
}

/**
 * 마을 판(640×384)을 칠한다: 땅 → 광장 테두리·분수 → 집과 소품(장소이면 그 생김새, 아니면 꾸밈) → 꽃 → 숲.
 * active는 장소가 된 자리의 key들 (같은 묶음이면 같은 판을 다시 쓴다)
 */
export function composeVillage(slots: readonly Slot[], active: ReadonlySet<string>): PixelMap {
	const key = slots.map((s) => `${s.key}${active.has(s.key) ? '+' : '-'}`).join(',');
	const cached = maps.get(key);
	if (cached) return cached;
	const map = new PixelMap(WORLD_PX_W, WORLD_PX_H, 'g');
	for (let ty = 0; ty < WORLD_H; ty++) for (let tx = 0; tx < WORLD_W; tx++) groundTile(map, tx, ty);
	plazaEdge(map);
	fountain(map, FOUNTAIN.x * TILE + 1, FOUNTAIN.y * TILE + 4, FOUNTAIN.w * TILE - 2);
	// 소품 자리는 흩뿌린 꽃을 피한다
	const taken = new Set<number>();
	for (const slot of slots)
		for (let y = slot.y - 1; y <= slot.y + slot.h; y++)
			for (let x = slot.x - 1; x <= slot.x + slot.w; x++) taken.add(y * WORLD_W + x);
	sprinkle(map, taken);
	// 광장 네 귀퉁이의 가로등, 집 앞 울타리
	for (const [x, y] of [
		[14, 9],
		[25, 9],
		[14, 15],
		[25, 15],
	])
		lamp(map, x * TILE + 7, y * TILE + 4);
	forest(map, true);
	fenceRun(map, 2 * TILE + 2, 8 * TILE + 14, 2 * TILE + 8);
	fenceRun(map, 36 * TILE - 2, 8 * TILE + 14, 2 * TILE);
	for (const slot of slots) {
		const on = active.has(slot.key);
		const isHouse = slot.kind in HOUSES;
		if (isHouse) {
			building(map, slot, on);
			continue;
		}
		if (!on) {
			if (slot.fallback === 'flowers') flowerBed(map, slot);
			continue;
		}
		switch (slot.kind) {
			case 'gate':
				gateFrame(map, slot);
				break;
			case 'board':
				shadowAt(map, slot.x * TILE + slot.w * 8, slot.y * TILE + 15, 14);
				standOn(map, questBoardRows(30, 26), slot.x, slot.y, slot.w);
				break;
			case 'signpost':
				signpost(map, slot.x, slot.y);
				break;
			case 'sign':
				keySign(map, slot.x, slot.y);
				break;
			case 'mailbox':
				shadowAt(map, slot.x * TILE + 8, slot.y * TILE + 15, 5);
				standOn(map, MAILBOX, slot.x, slot.y);
				break;
			case 'cave':
				caveMouth(map, slot.x, slot.y);
				break;
			case 'chest':
				shadowAt(map, slot.x * TILE + 8, slot.y * TILE + 14, 7);
				standOn(map, CHEST, slot.x, slot.y, 1, -2);
				break;
			case 'arcade':
				shadowAt(map, slot.x * TILE + 8, slot.y * TILE + 15, 7);
				standOn(map, ARCADE, slot.x, slot.y);
				break;
			case 'easel':
				standOn(map, EASEL, slot.x, slot.y);
				break;
			default:
				// 사람·몬스터는 사람 판(actors)에 그린다
				break;
		}
	}
	forest(map, false);
	return remember(maps, key, map);
}

/** 마을 판의 RGBA (캔버스에 그대로 올린다) */
export function villageRgba(slots: readonly Slot[], active: ReadonlySet<string>, night: boolean): Uint8ClampedArray {
	const map = composeVillage(slots, active);
	const key = `${night ? 'n' : 'd'}|${slots.map((s) => `${s.key}${active.has(s.key) ? '+' : '-'}`).join(',')}`;
	const cached = images.get(key);
	if (cached) return cached;
	const rgb: Record<string, [number, number, number]> = {};
	for (const [k, hex] of Object.entries(villagePalette(night)))
		rgb[k] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
	const data = new Uint8ClampedArray(map.w * map.h * 4);
	map.px.forEach((k, i) => {
		const c = rgb[k] ?? rgb.g;
		data[i * 4] = c[0];
		data[i * 4 + 1] = c[1];
		data[i * 4 + 2] = c[2];
		data[i * 4 + 3] = 255;
	});
	return remember(images, key, data);
}

/** 장소마다 바닥에서 소품 꼭대기까지의 높이 (게임 칸): 표('!'·✓)를 그 위에 띄운다 */
const PROP_TOPS: Partial<Record<PlaceKind, number>> = {
	shop: 70,
	inn: 70,
	library: 70,
	smithy: 70,
	gate: 44,
	board: 28,
	member: 21,
	tutor: 21,
	bard: 21,
	monster: 15,
	signpost: 21,
	sign: 21,
	cave: 24,
	chest: 14,
	arcade: 21,
	easel: 18,
	mailbox: 15,
};

/** 장소 표를 띄울 자리: 소품 꼭대기 바로 위 가운데 (표의 아래 끝, 게임 칸) */
export function markPoint(slot: Slot): { x: number; y: number } {
	const base = (slot.y + slot.h) * TILE;
	return { x: slot.x * TILE + (slot.w * TILE) / 2, y: Math.max(12, base - (PROP_TOPS[slot.kind] ?? 20) - 2) };
}

// ─── 걷는 사람과 몬스터 (사람 판에 그린다) ───

/** 사람 그림의 색 글자: C 모자, c 모자 챙, H 머리, S 피부, E 눈, T 윗옷, W 빛, P 바지, F 신발 */
const BODY_FRONT = ['..TTTTTTTT..', '.STTTWTTTTS.', '.STTTTTTTTS.', '.STTTTTTTTS.', '..PPPPPPPP..'];
const BODY_SIDE = ['...TTTTTT...', '...TTTTTT...', '...TTSSTT...', '...TTTTTT...', '...PPPPPP...'];
/** 다리: 서기, 왼발, 오른발 (앞·뒤), 옆은 모으기와 벌리기 */
const LEGS_FRONT = {
	stand: ['..PPP..PPP..', '..FFF..FFF..'],
	a: ['..PPP..PPP..', '..FFF..FFF..'].map((row, i) => (i === 1 ? '..FFF..PPP..' : row)),
	b: ['..PPP..PPP..', '..PPP..FFF..'],
};
const LEGS_SIDE = {
	stand: ['....PPPP....', '....FFFF....'],
	a: ['...PP..PP...', '..FF....FF..'],
	b: ['....PPPP....', '...FFFFFF...'],
};

/** 머리 (모자 쓴 주인공, 머리카락인 사람) × 방향 */
const HEAD = {
	cap: {
		down: [
			'...CCCCCC...',
			'..CCWCCCCC..',
			'.CCCCCCCCCC.',
			'.cccccccccc.',
			'.HSSSSSSSSH.',
			'.HSESSSSESH.',
			'.HSESSSSESH.',
			'..SSSSSSSS..',
			'....SSSS....',
		],
		up: [
			'...CCCCCC...',
			'..CCCCCCCC..',
			'.CCCCCCCCCC.',
			'.CCCCCCCCCC.',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'..HHHHHHHH..',
			'....SSSS....',
		],
		right: [
			'...CCCCCC...',
			'..CCWCCCCC..',
			'..CCCCCCCCcc',
			'..CCCCCCCC..',
			'..HHHSSSSS..',
			'..HHSSSSES..',
			'..HHSSSSES..',
			'...HSSSSSS..',
			'.....SSS....',
		],
	},
	hair: {
		down: [
			'...HHHHHH...',
			'..HHHHHHHH..',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'.HSHHHHHHSH.',
			'.HSESSSSESH.',
			'.HSESSSSESH.',
			'..SSSSSSSS..',
			'....SSSS....',
		],
		up: [
			'...HHHHHH...',
			'..HHHHHHHH..',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'.HHHHHHHHHH.',
			'..HHHHHHHH..',
			'....SSSS....',
		],
		right: [
			'...HHHHHH...',
			'..HHHHHHHH..',
			'..HHHHHHHHH.',
			'..HHHHHHHHH.',
			'..HHHSSSSS..',
			'..HHSSSSES..',
			'..HHSSSSES..',
			'...HSSSSSS..',
			'.....SSS....',
		],
	},
};

export type WalkFrame = 'stand' | 'a' | 'b';

const flipRows = (rows: readonly string[]) => rows.map((row) => [...row].reverse().join(''));

/**
 * 사람 그림 한 장 (외곽선을 둘러 14×18): 머리(모자 또는 머리카락) + 몸 + 다리. 왼쪽은 오른쪽을 뒤집는다.
 * 걷는 동안 a·b 프레임은 다리를 엇갈리고 몸을 한 칸 올린다(위아래로 통통)
 */
export function personRows(head: 'cap' | 'hair', facing: Facing, frame: WalkFrame = 'stand'): string[] {
	const side = facing === 'left' || facing === 'right';
	const dir = side ? 'right' : facing;
	const legs = side ? LEGS_SIDE[frame] : LEGS_FRONT[frame];
	const body = side ? BODY_SIDE : facing === 'up' ? BODY_FRONT.map((r) => r.replace('W', 'T')) : BODY_FRONT;
	let rows = [...HEAD[head][dir], ...body, ...legs];
	// 걷는 프레임은 한 칸 위로 (발밑 한 줄 비움)
	if (frame !== 'stand') rows = [...rows.slice(1), '............'];
	const drawn = outlined(rows, 'k');
	return facing === 'left' ? flipRows(drawn) : drawn;
}

/** 사람 그림의 높이·너비 (외곽선 포함) */
export const PERSON_W = 14;
export const PERSON_H = 18;

/** 주인공의 색: 빨간 모자, 갈색 머리, 파란 윗옷 */
export const HERO_COLORS: Record<string, string> = {
	C: '#e84848',
	c: '#a82c3c',
	W: '#ffffff',
	H: '#6a4026',
	S: '#f8d0a8',
	E: '#202028',
	T: '#3c7ce8',
	P: '#2c3c6c',
	F: '#e8e8f0',
	k: '#202028',
};

/** 안내인(쓰는 법): 흰 머리, 초록 옷 / 음유시인(크레딧): 보라 모자, 노란 옷 */
export const TUTOR_COLORS: Record<string, string> = {
	H: '#f0f0f0',
	S: '#f0c8a0',
	E: '#202028',
	T: '#4ca860',
	W: '#9ce0a8',
	P: '#7a5232',
	F: '#5a4a48',
	k: '#202028',
};
export const BARD_COLORS: Record<string, string> = {
	C: '#9070d0',
	c: '#5c48a0',
	W: '#ffffff',
	H: '#e8c35a',
	S: '#f6d1b0',
	E: '#202028',
	T: '#f0a030',
	P: '#7a5232',
	F: '#5a4a48',
	k: '#202028',
};

/** 버그 몬스터 (16×13, 외곽선 포함): 더듬이 둘, 큰 눈, 무늬 */
export const MINI_MONSTER = outlined(
	[
		'...W......W...',
		'....W....W....',
		'....WWWWWW....',
		'..WWWWWWWWWW..',
		'.WWKKWWWWKKWW.',
		'.WWKRWWWWKRWW.',
		'WWWWWWWWWWWWWW',
		'WGWWWKKKKWWWGW',
		'WGGWWWWWWWWGGW',
		'.WWWWWWWWWWWW.',
		'..WW..WW..WW..',
	],
	'X'
);
export const miniMonsterColors = () => ({ ...monsterColors(0), X: '#202028' });

/** 북쪽 문짝 (32×26): 닫힘은 나무 두 짝에 쇠띠, 열림은 빛이 새는 길 */
export function gateDoorRows(open: boolean): string[] {
	const w = 32;
	const h = 26;
	return Array.from({ length: h }, (_, y) =>
		Array.from({ length: w }, (_, x) => {
			if (open) {
				if (y < 2) return 'k';
				const glow = Math.abs(x - 15.5) < 6 - y * 0.1;
				return glow ? (y > 20 ? 'q' : 'Y') : x < 3 || x > 28 ? 'N' : y > 20 ? 'q' : 'L';
			}
			if (x === 0 || x === w - 1 || y === 0) return 'k';
			if (x === 15 || x === 16) return 'k';
			if (y === 6 || y === 18) return 'R';
			if ((x === 6 || x === 25) && y === 12) return 'F';
			return x % 5 === 0 ? 'n' : x < 15 ? (x % 5 === 1 ? 'O' : 'o') : x % 5 === 1 ? 'O' : 'o';
		}).join('')
	);
}

/** 문짝의 색 */
export const GATE_COLORS: Record<string, string> = {
	k: '#2c2430',
	N: '#5a3418',
	n: '#8a582c',
	o: '#b47c44',
	O: '#dca464',
	R: '#6e6e6c',
	F: '#f8d840',
	Y: '#fff4c0',
	L: '#ffe090',
	q: '#e4c48c',
};
