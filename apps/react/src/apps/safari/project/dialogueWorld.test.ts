import { describe, expect, it } from 'vitest';
import {
	cameraOf,
	ENDING_TOPIC,
	entryOf,
	facingPlace,
	facingTo,
	findPath,
	FOUNTAIN,
	layoutWorld,
	pathToPlace,
	placeAt,
	SLOTS,
	standTiles,
	START,
	TERRAIN,
	tileOfPoint,
	TITLE_VIEW,
	walkable,
	WORLD_H,
	WORLD_PX_H,
	WORLD_PX_W,
	WORLD_W,
	type Tile,
} from '@/apps/safari/project/dialogueWorld';

const ALL = [
	'highlights',
	'build',
	'troubleshooting',
	'usage',
	'facts',
	'controls',
	'timeline',
	'specs',
	'team',
	'contributions',
	'deployments',
	'credits',
	'more',
	'gallery',
	'links',
];

describe('마을 지도', () => {
	it('땅은 40×24칸이고 가장자리는 숲(막힘), 입구 길만 아래로 열린다', () => {
		expect(TERRAIN).toHaveLength(WORLD_H);
		for (const row of TERRAIN) expect(row).toHaveLength(WORLD_W);
		expect(TERRAIN[0]).toBe('T'.repeat(WORLD_W));
		for (const row of TERRAIN) {
			expect(row[0]).toBe('T');
			expect(row[WORLD_W - 1]).toBe('T');
		}
		expect(TERRAIN[WORLD_H - 1].replace(/T/g, '')).toBe('::');
		expect(WORLD_PX_W).toBe(640);
		expect(WORLD_PX_H).toBe(384);
	});

	it('자리는 지도 안에 있고 서로 겹치지 않으며, 막힌 땅(숲·물·벼랑)이나 분수 위에 놓이지 않는다 (동굴 입구와 북쪽 문은 일부러 벼랑·숲 속)', () => {
		const taken = new Map<string, string>();
		for (const slot of SLOTS) {
			for (let y = slot.y; y < slot.y + slot.h; y++) {
				for (let x = slot.x; x < slot.x + slot.w; x++) {
					expect(x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H).toBe(true);
					const key = `${x},${y}`;
					expect(taken.get(key), `${slot.key}와 ${taken.get(key)}가 ${key}에서 겹친다`).toBeUndefined();
					taken.set(key, slot.key);
					const inFountain =
						x >= FOUNTAIN.x && x < FOUNTAIN.x + FOUNTAIN.w && y >= FOUNTAIN.y && y < FOUNTAIN.y + FOUNTAIN.h;
					expect(inFountain).toBe(false);
					if (slot.kind !== 'cave' && slot.kind !== 'gate') expect('T~^').not.toContain(TERRAIN[y][x]);
				}
			}
		}
	});

	it('주제가 다 있으면 자리마다 장소가 되고, 팀원 자리는 팀원 수만큼만 (이름을 붙인다)', () => {
		const layout = layoutWorld(ALL, ['가람', '나래']);
		const members = layout.places.filter((p) => p.kind === 'member');
		expect(members.map((m) => m.label)).toEqual(['가람', '나래']);
		expect(layout.places.find((p) => p.topic === 'highlights')?.kind).toBe('board');
		expect(layout.places.find((p) => p.topic === 'troubleshooting')?.kind).toBe('monster');
		expect(layout.places.find((p) => p.topic === 'specs')?.kind).toBe('shop');
		expect(layout.places.find((p) => p.topic === ENDING_TOPIC)?.kind).toBe('gate');
		// 모든 주제가 장소 하나 이상을 얻는다
		for (const topic of ALL) {
			if (topic === 'team') continue;
			expect(layout.places.some((p) => p.topic === topic)).toBe(true);
		}
		// 팀원 넷째 자리부터는 꾸밈 (빈 자리)
		expect(layout.decor.filter((d) => d.kind === 'member')).toHaveLength(4);
	});

	it('없는 주제의 자리는 꾸밈으로 남는다: 집은 빈집(막힘), 꽃밭과 빈 자리는 지나간다. 북쪽 문은 늘 있다', () => {
		const layout = layoutWorld(['highlights', 'links']);
		expect(layout.places.map((p) => p.topic).sort()).toEqual([ENDING_TOPIC, 'highlights', 'links'].sort());
		const shop = SLOTS.find((s) => s.key === 'shop')!;
		expect(walkable(layout, shop.x + 1, shop.y + 1)).toBe(false);
		expect(placeAt(layout, shop.x + 1, shop.y + 1)).toBeUndefined();
		const arcade = SLOTS.find((s) => s.key === 'arcade')!;
		expect(arcade.fallback).toBe('flowers');
		expect(walkable(layout, arcade.x, arcade.y)).toBe(true);
		const monster = SLOTS.find((s) => s.key === 'monster')!;
		expect(walkable(layout, monster.x, monster.y)).toBe(true);
	});

	it('충돌: 숲·물·벼랑·분수·집·장소는 막히고, 길·풀·긴 풀·광장은 걷는다. 지도 밖은 막힌다', () => {
		const layout = layoutWorld(ALL, ['가람']);
		expect(walkable(layout, START.x, START.y)).toBe(true);
		expect(walkable(layout, 0, 5)).toBe(false);
		expect(walkable(layout, 25, 18)).toBe(false); // 연못
		expect(walkable(layout, 33, 16)).toBe(false); // 벼랑
		expect(walkable(layout, FOUNTAIN.x, FOUNTAIN.y)).toBe(false);
		expect(walkable(layout, 12, 5)).toBe(false); // 여관 벽
		expect(walkable(layout, 5, 17)).toBe(true); // 긴 풀
		expect(walkable(layout, 16, 10)).toBe(true); // 광장
		expect(walkable(layout, -1, 5)).toBe(false);
		expect(walkable(layout, 5, WORLD_H)).toBe(false);
	});

	it('보는 쪽 바로 앞 칸의 장소를 찾고, 이웃 칸을 보는 방향을 안다', () => {
		const layout = layoutWorld(ALL, []);
		// 게시판(21–22, 18) 아래에서 위를 보면 게시판
		expect(facingPlace(layout, 21, 19, 'up')?.topic).toBe('highlights');
		expect(facingPlace(layout, 22, 19, 'up')?.topic).toBe('highlights');
		expect(facingPlace(layout, 21, 19, 'down')).toBeUndefined();
		// 여관(10–14, 3–6)은 문(12, 6) 앞에서만 살펴본다: 옆벽이나 문 옆 벽을 보면 아무것도 없다
		expect(facingPlace(layout, 12, 7, 'up')?.topic).toBe('contributions');
		expect(facingPlace(layout, 11, 7, 'up')).toBeUndefined();
		expect(facingPlace(layout, 15, 5, 'left')).toBeUndefined();
		expect(placeAt(layout, 11, 4)?.topic).toBe('contributions');
		// 북쪽 문은 가운데 두 칸
		expect(facingPlace(layout, 19, 3, 'up')?.topic).toBe(ENDING_TOPIC);
		expect(facingPlace(layout, 20, 3, 'up')?.topic).toBe(ENDING_TOPIC);
		expect(facingTo({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe('right');
		expect(facingTo({ x: 3, y: 3 }, { x: 3, y: 2 })).toBe('up');
		expect(facingTo({ x: 3, y: 3 }, { x: 5, y: 3 })).toBeUndefined();
	});
});

describe('길 찾기 (너비 우선 탐색)', () => {
	const layout = layoutWorld(ALL, ['가람', '나래', '다솜']);
	const isWalk = (path: Tile[], from: Tile) =>
		path.every((tile, i) => {
			const prev = i === 0 ? from : path[i - 1];
			return walkable(layout, tile.x, tile.y) && Math.abs(tile.x - prev.x) + Math.abs(tile.y - prev.y) === 1;
		});

	it('가장 짧은 길을 한 칸씩 이어 걷고(출발 칸은 빼고 도착 칸은 넣는다), 막힌 칸(조작 안내판)은 비켜 간다', () => {
		const from = { x: START.x, y: START.y };
		const path = findPath(layout, from, [{ x: 15, y: 21 }]);
		expect(path).not.toBeNull();
		// 맨해튼 거리 4에 안내판(16, 21)을 비키는 두 걸음
		expect(path).toHaveLength(6);
		expect(path?.at(-1)).toEqual({ x: 15, y: 21 });
		expect(path).not.toContainEqual({ x: 16, y: 21 });
		expect(isWalk(path ?? [], from)).toBe(true);
	});

	it('막힌 것을 돌아간다: 입구에서 여관 문 앞까지 (분수와 게시판을 피해)', () => {
		const from = { x: START.x, y: START.y };
		const path = findPath(layout, from, [{ x: 12, y: 7 }]);
		expect(path).not.toBeNull();
		expect(path?.at(-1)).toEqual({ x: 12, y: 7 });
		expect(isWalk(path ?? [], from)).toBe(true);
		// 맨해튼 거리(7 + 14)보다 짧을 수 없다
		expect(path?.length).toBeGreaterThanOrEqual(21);
	});

	it('이미 도착했으면 빈 길, 막힌 칸이나 닿을 수 없는 곳은 null', () => {
		expect(findPath(layout, { x: 19, y: 21 }, [{ x: 19, y: 21 }])).toEqual([]);
		expect(findPath(layout, { x: 19, y: 21 }, [{ x: 0, y: 0 }])).toBeNull();
		expect(findPath(layout, { x: 19, y: 21 }, [{ x: 25, y: 18 }])).toBeNull();
	});

	it('장소까지: 가장 가까운 옆 칸으로 가서 장소를 본다', () => {
		const board = layout.places.find((p) => p.topic === 'highlights')!;
		const route = pathToPlace(layout, { x: START.x, y: START.y }, board);
		expect(route).not.toBeNull();
		const end = route!.path.at(-1)!;
		expect(facingPlace(layout, end.x, end.y, route!.facing)?.topic).toBe('highlights');
		// 입구(19, 21)에서 게시판 옆 칸(20, 18)까지 네 걸음
		expect(route!.path).toHaveLength(4);
		const stands = standTiles(layout, board);
		expect(stands.every((t) => walkable(layout, t.x, t.y))).toBe(true);
		expect(stands).toContainEqual({ x: 21, y: 19 });
	});

	it('집을 누르면 옆벽이 아니라 문 앞까지 걸어가 문을 본다', () => {
		const shop = layout.places.find((p) => p.key === 'shop')!;
		const route = pathToPlace(layout, { x: 9, y: 5 }, shop);
		expect(route?.path.at(-1)).toEqual({ x: 5, y: 7 });
		expect(route?.facing).toBe('up');
		expect(entryOf(shop)).toEqual({ x: 5, y: 6, w: 1, h: 1 });
	});

	it('이미 장소 옆에 있으면 걷지 않고 그쪽을 본다', () => {
		const board = layout.places.find((p) => p.topic === 'highlights')!;
		const route = pathToPlace(layout, { x: 21, y: 19 }, board);
		expect(route).toEqual({ path: [], facing: 'up' });
	});

	it('팀원마다 갈 수 있는 옆 칸이 있다 (모든 장소에 닿는다)', () => {
		for (const place of layout.places) {
			if (place.kind === 'gate') continue;
			expect(pathToPlace(layout, { x: START.x, y: START.y }, place), place.key).not.toBeNull();
		}
		// 북쪽 문도 길 끝에서 닿는다
		const gate = layout.places.find((p) => p.kind === 'gate')!;
		expect(pathToPlace(layout, { x: START.x, y: START.y }, gate)?.facing).toBe('up');
	});
});

describe('카메라', () => {
	it('주인공을 가운데에 두되 지도 끝에서 멈추고, 늘 정수다', () => {
		expect(cameraOf(0, 0, 360, 208)).toEqual({ x: 0, y: 0 });
		expect(cameraOf(WORLD_PX_W, WORLD_PX_H, 360, 208)).toEqual({ x: WORLD_PX_W - 360, y: WORLD_PX_H - 208 });
		const mid = cameraOf(20 * 16, 12 * 16, 361, 209);
		expect(Number.isInteger(mid.x) && Number.isInteger(mid.y)).toBe(true);
		expect(mid.x).toBe(Math.round(20 * 16 + 8 - 361 / 2));
	});

	it('화면이 지도보다 크면 지도를 가운데에 둔다 (음수)', () => {
		expect(cameraOf(100, 100, 700, 400)).toEqual({ x: -30, y: -8 });
	});

	it('누른 점은 카메라만큼 옮겨 칸으로 바꾼다', () => {
		expect(tileOfPoint(5, 5, { x: 160, y: 32 })).toEqual({ x: 10, y: 2 });
		expect(tileOfPoint(15.9, 31.9, { x: 0, y: 0 })).toEqual({ x: 0, y: 1 });
		expect(TITLE_VIEW.x).toBeGreaterThan(0);
	});
});
