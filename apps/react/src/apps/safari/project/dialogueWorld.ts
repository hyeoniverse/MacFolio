// RPG 대화창(DialoguePage)의 마을: 주제마다 장소 하나(게시판, 상점, 버그 몬스터, 팀원...)를 둔 40×24 타일 지도와 그 위를 걷는 계산.
// 지도는 땅 글자(TERRAIN)와 정해진 자리(SLOTS)로 짠다. 자리는 주제마다 하나씩 정해져 있고, 그 주제가 데이터에 없으면
// 자리는 대신 꾸밈(장소가 아닌 빈집, 꽃밭, 그냥 풀밭)으로 남아 지도의 짜임새가 늘 같다. 여기에는 그림이 없다
// (그림은 dialogueVillage.ts). 칸 하나는 16×16 게임 칸이다
import { TILE } from '@/apps/safari/project/dialogueScenes';

export const WORLD_W = 40;
export const WORLD_H = 24;
export const WORLD_PX_W = WORLD_W * TILE;
export const WORLD_PX_H = WORLD_H * TILE;

/**
 * 땅 (한 글자가 한 칸): T 숲(막힘), b 덤불(막힘), . 풀, : 흙길, # 돌바닥(광장), , 긴 풀, ~ 물(막힘), ^ 바위 벼랑(막힘).
 * 아래 가운데가 마을 입구, 위 가운데가 북쪽 문, 가운데가 분수 광장이다
 */
export const TERRAIN: readonly string[] = [
	'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
	'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
	'TTT..............T.::.T..............TTT',
	'TT.................::.................TT',
	'TT.................::.................TT',
	'TT.................::.................TT',
	'TT.......b......b..::..b.......b......TT',
	'TT...:......:......::......:......:...TT',
	'TT...:......:......::......:......:...TT',
	'TT...:..T...:.############.:...T..:...TT',
	'TTb..:......:.############.:......:..bTT',
	'TT...:......:.############.:......:...TT',
	'TT.:::::::::::############:::::::::::.TT',
	'TT.:::::::::::############:::::::::::.TT',
	'TT............############............TT',
	'TT.T..........############.....^^^^^^^TT',
	'TT.,,,,,,,,,b......::..........^^^^^^^TT',
	'TT.,,,,,,,,,.......::...~~~~~b.^^^^^^^TT',
	'TT.,,,,,,,,,.......::...~~~~~b.^^^^^^^TT',
	'TT.,,,,,,,,,.......::...~~~~~.........TT',
	'TT...........T.....::...~~~~~..T......TT',
	'TT.................::..b..............TT',
	'TTTTTTTTTTTTTTTTTTT::TTTTTTTTTTTTTTTTTTT',
	'TTTTTTTTTTTTTTTTTTT::TTTTTTTTTTTTTTTTTTT',
];

/** 막는 땅 */
const SOLID_GROUND = new Set(['T', 'b', '~', '^']);

export type Facing = 'up' | 'down' | 'left' | 'right';
export const STEPS: Record<Facing, readonly [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/** 장소의 생김새 (dialogueVillage.ts가 그린다) */
export type PlaceKind =
	| 'gate'
	| 'board'
	| 'shop'
	| 'inn'
	| 'library'
	| 'smithy'
	| 'monster'
	| 'member'
	| 'tutor'
	| 'sign'
	| 'signpost'
	| 'cave'
	| 'chest'
	| 'arcade'
	| 'easel'
	| 'bard'
	| 'mailbox';

/** 자리의 주제가 없을 때 남기는 꾸밈: 빈집(막힘), 꽃밭(지나감), 아무것도 없음 */
export type Fallback = 'house' | 'flowers' | 'none';

/** 지도의 정해진 자리 하나 */
export interface Slot {
	/** 자리 이름 (장소 표시·시험에 쓴다) */
	key: string;
	/** 이 자리에 올 주제 id. 북쪽 문은 ENDING_TOPIC */
	topic: string;
	kind: PlaceKind;
	/** 앞에 섰을 때 알리는 이름 */
	name: string;
	/** 차지하는 칸 (모두 막힌다) */
	x: number;
	y: number;
	w: number;
	h: number;
	/** 팀원 자리: 몇 번째 팀원인지 */
	member?: number;
	fallback: Fallback;
}

/** 북쪽 문이 여는 엔딩 (메뉴의 주제가 아니다) */
export const ENDING_TOPIC = '@ending';

/** 팀원이 설 수 있는 자리 수 (더 많은 팀원은 '함께한 사람' 주제에서 읽는다) */
export const MEMBER_SLOTS = 6;

/**
 * 정해진 자리들. 집 넷은 북쪽 줄, 광장에는 오락기·이젤·음유시인·팀원, 입구 가까이에 퀘스트 게시판·안내인·조작 안내판·우체통,
 * 서쪽 긴 풀숲에 버그 몬스터, 서쪽 길 끝에 이정표, 동쪽 벼랑에 동굴(보물 상자)
 */
export const SLOTS: readonly Slot[] = [
	{ key: 'gate', topic: ENDING_TOPIC, kind: 'gate', name: '북쪽 문', x: 18, y: 1, w: 4, h: 2, fallback: 'none' },
	{ key: 'shop', topic: 'specs', kind: 'shop', name: '상점', x: 3, y: 3, w: 5, h: 4, fallback: 'house' },
	{ key: 'inn', topic: 'contributions', kind: 'inn', name: '여관', x: 10, y: 3, w: 5, h: 4, fallback: 'house' },
	{ key: 'library', topic: 'more', kind: 'library', name: '도서관', x: 25, y: 3, w: 5, h: 4, fallback: 'house' },
	{ key: 'smithy', topic: 'build', kind: 'smithy', name: '대장간', x: 32, y: 3, w: 5, h: 4, fallback: 'house' },
	{
		key: 'board',
		topic: 'highlights',
		kind: 'board',
		name: '퀘스트 게시판',
		x: 21,
		y: 18,
		w: 2,
		h: 1,
		fallback: 'flowers',
	},
	{ key: 'tutor', topic: 'usage', kind: 'tutor', name: '안내인', x: 17, y: 18, w: 1, h: 1, fallback: 'none' },
	{ key: 'sign', topic: 'controls', kind: 'sign', name: '조작 안내판', x: 16, y: 21, w: 1, h: 1, fallback: 'flowers' },
	{ key: 'mailbox', topic: 'links', kind: 'mailbox', name: '우체통', x: 22, y: 20, w: 1, h: 1, fallback: 'none' },
	{
		key: 'monster',
		topic: 'troubleshooting',
		kind: 'monster',
		name: '버그 몬스터',
		x: 7,
		y: 17,
		w: 1,
		h: 1,
		fallback: 'none',
	},
	{
		key: 'signpost',
		topic: 'timeline',
		kind: 'signpost',
		name: '이정표',
		x: 9,
		y: 11,
		w: 1,
		h: 1,
		fallback: 'flowers',
	},
	{ key: 'cave', topic: 'deployments', kind: 'cave', name: '동굴', x: 34, y: 18, w: 1, h: 1, fallback: 'none' },
	{ key: 'chest', topic: 'deployments', kind: 'chest', name: '보물 상자', x: 36, y: 19, w: 1, h: 1, fallback: 'none' },
	{ key: 'arcade', topic: 'facts', kind: 'arcade', name: '오락기', x: 24, y: 9, w: 1, h: 1, fallback: 'flowers' },
	{ key: 'easel', topic: 'gallery', kind: 'easel', name: '그림 이젤', x: 15, y: 9, w: 1, h: 1, fallback: 'flowers' },
	{ key: 'bard', topic: 'credits', kind: 'bard', name: '음유시인', x: 15, y: 15, w: 1, h: 1, fallback: 'none' },
	...[
		// 광장을 가로지르는 길(가로 12–13줄, 세로 19–20칸)은 비워 둔다
		[17, 10],
		[22, 10],
		[16, 14],
		[23, 14],
		[18, 15],
		[21, 15],
	].map(([x, y], member): Slot => ({
		key: `member-${member}`,
		topic: 'team',
		kind: 'member',
		name: '팀원',
		x,
		y,
		w: 1,
		h: 1,
		member,
		fallback: 'none',
	})),
];

/** 분수 (광장 가운데 2×2, 막힘) */
export const FOUNTAIN = { x: 19, y: 11, w: 2, h: 2 } as const;

/** 타이틀 화면에서 카메라가 보는 곳: 분수 광장 가운데 (게임 칸) */
export const TITLE_VIEW = { x: 20 * TILE, y: 12 * TILE } as const;

/** 처음 서는 자리: 입구 길 위, 위를 본다 */
export const START = { x: 19, y: 21, facing: 'up' as Facing };

/** 지도 위의 장소 하나 (데이터에 있는 주제의 자리) */
export interface Place extends Slot {
	/** 팀원 자리면 그 사람 이름 */
	label: string;
}

/** 걷기 계산에 쓰는 지도: 막힌 칸, 칸마다 장소(없으면 -1), 장소 목록, 꾸밈으로 남은 자리 */
export interface WorldLayout {
	places: Place[];
	/** 주제가 없어 꾸밈으로 남은 자리 (그림만 그린다) */
	decor: Slot[];
	blocked: Uint8Array;
	placeIndex: Int16Array;
}

const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
const at = (x: number, y: number) => y * WORLD_W + x;

/**
 * 주제 목록으로 마을을 짠다: 자리마다 그 주제가 있으면 장소, 없으면 꾸밈. 팀원 자리는 팀원 수만큼만 장소(이름을 붙인다).
 * 북쪽 문은 늘 있다. 막힌 칸은 숲·물·벼랑, 분수, 장소와 빈집(꽃밭과 빈 자리는 지나간다)
 */
export function layoutWorld(topics: readonly string[], members: readonly string[] = []): WorldLayout {
	const have = new Set(topics);
	const places: Place[] = [];
	const decor: Slot[] = [];
	for (const slot of SLOTS) {
		const present =
			slot.topic === ENDING_TOPIC ||
			(have.has(slot.topic) && (slot.member === undefined || slot.member < members.length));
		if (present) places.push({ ...slot, label: slot.member !== undefined ? members[slot.member] : slot.name });
		else decor.push(slot);
	}
	const blocked = new Uint8Array(WORLD_W * WORLD_H);
	const placeIndex = new Int16Array(WORLD_W * WORLD_H).fill(-1);
	TERRAIN.forEach((row, y) => {
		for (let x = 0; x < WORLD_W; x++) if (SOLID_GROUND.has(row[x] ?? 'T')) blocked[at(x, y)] = 1;
	});
	const fill = (slot: { x: number; y: number; w: number; h: number }, index = -1) => {
		for (let y = slot.y; y < slot.y + slot.h; y++) {
			for (let x = slot.x; x < slot.x + slot.w; x++) {
				if (!inside(x, y)) continue;
				blocked[at(x, y)] = 1;
				if (index >= 0) placeIndex[at(x, y)] = index;
			}
		}
	};
	fill(FOUNTAIN);
	places.forEach((place, i) => fill(place, i));
	for (const slot of decor) if (slot.fallback === 'house') fill(slot);
	return { places, decor, blocked, placeIndex };
}

/** 걸을 수 있는 칸인지 (지도 밖은 막힘) */
export const walkable = (layout: WorldLayout, x: number, y: number) => inside(x, y) && !layout.blocked[at(x, y)];

/** 그 칸의 장소 */
export function placeAt(layout: WorldLayout, x: number, y: number): Place | undefined {
	if (!inside(x, y)) return undefined;
	const index = layout.placeIndex[at(x, y)];
	return index >= 0 ? layout.places[index] : undefined;
}

/** 서 있는 칸에서 보는 쪽 바로 앞 칸의 장소 */
export function facingPlace(layout: WorldLayout, x: number, y: number, facing: Facing): Place | undefined {
	const [dx, dy] = STEPS[facing];
	const place = placeAt(layout, x + dx, y + dy);
	return place && inRect(entryOf(place), x + dx, y + dy) ? place : undefined;
}

/** 직사각형 칸 묶음 */
interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** 집 모양 장소 (집 전체가 막히고 문으로만 들어간다) */
const HOUSE_KINDS = new Set<PlaceKind>(['shop', 'inn', 'library', 'smithy']);

/**
 * 살펴볼 수 있는 칸: 집은 아래 가운데 문 한 칸, 북쪽 문은 아래 가운데 문짝 두 칸, 그 밖은 자리 전체.
 * 집 옆벽을 보고 Z를 눌러도 아무 일이 없고, 집을 누르면 문 앞까지 걸어간다
 */
export function entryOf(slot: Slot): Rect {
	if (HOUSE_KINDS.has(slot.kind)) return { x: slot.x + Math.floor(slot.w / 2), y: slot.y + slot.h - 1, w: 1, h: 1 };
	if (slot.kind === 'gate') return { x: slot.x + 1, y: slot.y + slot.h - 1, w: slot.w - 2, h: 1 };
	return slot;
}

/** 한 칸 옆 칸을 보는 방향 (이웃이 아니면 undefined) */
export function facingTo(from: { x: number; y: number }, to: { x: number; y: number }): Facing | undefined {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (Math.abs(dx) + Math.abs(dy) !== 1) return undefined;
	if (dx === 1) return 'right';
	if (dx === -1) return 'left';
	return dy === 1 ? 'down' : 'up';
}

export interface Tile {
	x: number;
	y: number;
}

/**
 * 너비 우선 탐색으로 가장 짧은 길: from에서 goal(여럿 중 가장 가까운 것)까지 밟는 칸들 (from은 빼고 도착 칸은 넣는다).
 * from이 이미 goal이면 빈 길, 갈 수 없으면 null. 이웃은 위·아래·왼쪽·오른쪽 차례로 본다(같은 길이면 늘 같은 길)
 */
export function findPath(layout: WorldLayout, from: Tile, goals: readonly Tile[]): Tile[] | null {
	const wanted = new Set(goals.filter((g) => walkable(layout, g.x, g.y)).map((g) => at(g.x, g.y)));
	if (wanted.size === 0) return null;
	const start = at(from.x, from.y);
	if (wanted.has(start)) return [];
	const prev = new Int32Array(WORLD_W * WORLD_H).fill(-1);
	prev[start] = start;
	const queue = [start];
	const order: Facing[] = ['up', 'down', 'left', 'right'];
	for (let head = 0; head < queue.length; head++) {
		const cur = queue[head];
		const cx = cur % WORLD_W;
		const cy = Math.floor(cur / WORLD_W);
		for (const dir of order) {
			const [dx, dy] = STEPS[dir];
			const nx = cx + dx;
			const ny = cy + dy;
			if (!walkable(layout, nx, ny)) continue;
			const next = at(nx, ny);
			if (prev[next] >= 0) continue;
			prev[next] = cur;
			if (wanted.has(next)) {
				const path: Tile[] = [];
				for (let k = next; k !== start; k = prev[k]) path.push({ x: k % WORLD_W, y: Math.floor(k / WORLD_W) });
				return path.reverse();
			}
			queue.push(next);
		}
	}
	return null;
}

/** 장소의 살펴볼 수 있는 칸(entryOf) 바로 옆(위·아래·왼쪽·오른쪽)의 걸을 수 있는 칸들 */
export function standTiles(layout: WorldLayout, slot: Slot): Tile[] {
	const place = entryOf(slot);
	const tiles: Tile[] = [];
	for (let y = place.y; y < place.y + place.h; y++) {
		for (let x = place.x; x < place.x + place.w; x++) {
			for (const [dx, dy] of Object.values(STEPS)) {
				const nx = x + dx;
				const ny = y + dy;
				const inPlace = nx >= place.x && nx < place.x + place.w && ny >= place.y && ny < place.y + place.h;
				if (!inPlace && walkable(layout, nx, ny) && !tiles.some((t) => t.x === nx && t.y === ny))
					tiles.push({ x: nx, y: ny });
			}
		}
	}
	return tiles;
}

/** 장소까지 가는 길과 도착해서 볼 방향 (가장 가까운 옆 칸으로). 갈 수 없으면 null */
export function pathToPlace(layout: WorldLayout, from: Tile, place: Slot): { path: Tile[]; facing: Facing } | null {
	const path = findPath(layout, from, standTiles(layout, place));
	if (!path) return null;
	const end = path.at(-1) ?? from;
	const entry = entryOf(place);
	for (const [facing, [dx, dy]] of Object.entries(STEPS) as [Facing, readonly [number, number]][])
		if (inRect(entry, end.x + dx, end.y + dy)) return { path, facing };
	return null;
}

/**
 * 카메라: 주인공(px, py는 칸 그림의 왼쪽 위, 게임 칸)을 화면 가운데에 두되 지도 밖은 보이지 않게 끝에서 멈춘다.
 * 화면이 지도보다 크면 지도를 가운데에 둔다(음수). 늘 정수
 */
export function cameraOf(px: number, py: number, viewW: number, viewH: number): { x: number; y: number } {
	const axis = (p: number, view: number, size: number) =>
		view >= size
			? Math.floor((size - view) / 2)
			: Math.max(0, Math.min(size - view, Math.round(p + TILE / 2 - view / 2)));
	return { x: axis(px, viewW, WORLD_PX_W), y: axis(py, viewH, WORLD_PX_H) };
}

/** 화면의 점(게임 칸)과 카메라로 지도의 칸 */
export const tileOfPoint = (gx: number, gy: number, camera: { x: number; y: number }): Tile => ({
	x: Math.floor((gx + camera.x) / TILE),
	y: Math.floor((gy + camera.y) / TILE),
});
