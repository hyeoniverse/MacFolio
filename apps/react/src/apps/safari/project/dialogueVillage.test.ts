import { describe, expect, it } from 'vitest';
import { sheetSize, TILE, type Draw } from '@/apps/safari/project/dialogueNinja';
import { layoutWorld, SLOTS, WORLD_H, WORLD_PX_H, WORLD_PX_W, WORLD_W } from '@/apps/safari/project/dialogueWorld';
import { composeVillage, markPoint, VILLAGE_MARGIN } from '@/apps/safari/project/dialogueVillage';

const activeOf = (topics: string[], members: string[] = []) =>
	new Set(layoutWorld(topics, members).places.map((p) => p.key));

/** 그림 조각이 제 그림 안에서 잘렸는지 */
const inSheet = (d: Draw) => {
	if (d.fill) return true;
	const [w, h] = sheetSize(d.sheet);
	return d.sx >= 0 && d.sy >= 0 && d.sx + d.sw <= w && d.sy + d.sh <= h && d.sw > 0 && d.sh > 0;
};

describe('마을 그림 (Ninja Adventure 타일)', () => {
	const active = activeOf(['highlights', 'specs', 'team', 'deployments', 'links', 'facts', 'gallery'], ['가람']);
	const art = composeVillage(SLOTS, active, false);

	it('땅은 40×24칸과 둘레 숲 여백을 빈칸 없이 16×16 타일로 덮는다', () => {
		const covered = new Set<string>();
		for (const d of art.draws)
			if (d.sw === TILE && d.sh === TILE && d.dx % TILE === 0 && d.dy % TILE === 0)
				covered.add(`${d.dx / TILE},${d.dy / TILE}`);
		const m = VILLAGE_MARGIN / TILE;
		for (let y = -m; y < WORLD_H + m; y++)
			for (let x = -m; x < WORLD_W + m; x++) expect(covered.has(`${x},${y}`), `${x},${y}`).toBe(true);
	});

	it('모든 조각은 제 그림 안에서 자르고, 지도 둘레 숲 여백 밖으로 나가지 않는다', () => {
		for (const d of [...art.draws, ...art.overhead]) {
			expect(inSheet(d), JSON.stringify(d)).toBe(true);
			expect(d.dx).toBeGreaterThan(-VILLAGE_MARGIN - TILE * 2);
			expect(d.dx).toBeLessThan(WORLD_PX_W + VILLAGE_MARGIN);
			expect(d.dy).toBeGreaterThan(-VILLAGE_MARGIN - TILE * 2);
			expect(d.dy).toBeLessThan(WORLD_PX_H + VILLAGE_MARGIN);
		}
	});

	it('장소가 된 자리에는 소품이 서고 집에는 불빛이 켜진다. 나무 한 그루의 윗가지는 사람 위 판에', () => {
		const slot = SLOTS.find((s) => s.key === 'board')!;
		const near = art.draws.filter(
			(d) =>
				d.dx >= slot.x * TILE - 16 &&
				d.dx < (slot.x + slot.w) * TILE + 16 &&
				d.dy + d.sh >= slot.y * TILE &&
				d.dy + d.sh <= (slot.y + 1) * TILE + 2 &&
				d.sw !== TILE
		);
		expect(near.length).toBeGreaterThan(0);
		// 상점은 장소, 나머지 집 셋은 빈집이지만 밤 불빛은 장소인 집과 돌부처의 구슬에만
		expect(art.lights.length).toBe(2);
		expect(art.overhead.length).toBeGreaterThan(3);
	});

	it('같은 묶음은 같은 그림을 다시 쓰고, 장소나 문이 바뀌면 다른 그림을 짠다', () => {
		expect(composeVillage(SLOTS, new Set(active), false)).toBe(art);
		expect(composeVillage(SLOTS, active, true)).not.toBe(art);
		expect(composeVillage(SLOTS, activeOf(['highlights']), false)).not.toBe(art);
		// 닫힌 문은 울타리 두 칸으로 막고, 열리면 그것이 없다
		const gate = SLOTS.find((s) => s.key === 'gate')!;
		const fences = (draws: readonly Draw[]) =>
			draws.filter((d) => d.dy < (gate.y + gate.h) * TILE && d.dy >= gate.y * TILE && d.sw === TILE && d.sh === TILE)
				.length;
		expect(fences(art.draws)).toBeGreaterThan(fences(composeVillage(SLOTS, active, true).draws));
	});

	it('장소 표는 지도 안, 소품 위에 뜬다', () => {
		for (const slot of SLOTS) {
			const point = markPoint(slot);
			expect(point.x).toBeGreaterThan(0);
			expect(point.x).toBeLessThan(WORLD_PX_W);
			expect(point.y).toBeGreaterThanOrEqual(14);
			expect(point.y).toBeLessThan((slot.y + slot.h) * TILE);
		}
	});
});
