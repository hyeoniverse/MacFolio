import { describe, expect, it } from 'vitest';
import { layoutWorld, SLOTS, WORLD_PX_H, WORLD_PX_W } from '@/apps/safari/project/dialogueWorld';
import {
	composeVillage,
	gateDoorRows,
	markPoint,
	MINI_MONSTER,
	PERSON_H,
	PERSON_W,
	personRows,
	villagePalette,
	villageRgba,
} from '@/apps/safari/project/dialogueVillage';

const activeOf = (topics: string[], members: string[] = []) =>
	new Set(layoutWorld(topics, members).places.map((p) => p.key));

describe('마을 그림', () => {
	it('마을 판은 640×384를 빈칸 없이 칠하고, 모든 글자는 낮·밤 팔레트에 있다', () => {
		const active = activeOf(['highlights', 'specs', 'team', 'deployments', 'links'], ['가람']);
		const map = composeVillage(SLOTS, active);
		expect(map.w).toBe(WORLD_PX_W);
		expect(map.h).toBe(WORLD_PX_H);
		const used = new Set(map.px);
		for (const night of [false, true]) {
			const palette = villagePalette(night);
			for (const key of used) expect(palette[key], `${key} (${night ? '밤' : '낮'})`).toMatch(/^#[0-9a-f]{6}$/);
		}
		const rgba = villageRgba(SLOTS, active, true);
		expect(rgba.length).toBe(WORLD_PX_W * WORLD_PX_H * 4);
		for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) throw new Error(`빈칸 ${(i - 3) / 4}`);
	});

	it('같은 장소 묶음은 같은 판을 다시 쓰고, 장소가 바뀌면 다른 판을 칠한다', () => {
		const a = activeOf(['highlights']);
		expect(composeVillage(SLOTS, a)).toBe(composeVillage(SLOTS, new Set(a)));
		expect(composeVillage(SLOTS, activeOf(['specs']))).not.toBe(composeVillage(SLOTS, a));
	});

	it('밤에는 창과 가로등이 켜진다 (밤 색이 낮보다 어둡지만 불빛은 그대로)', () => {
		const day = villagePalette(false);
		const night = villagePalette(true);
		expect(night.g).not.toBe(day.g);
		expect(night.Y).toBe(day.Y);
		expect(night.L).not.toBe(day.L);
	});

	it('사람 그림은 방향·걸음마다 같은 크기(외곽선 포함 14×18)이고, 왼쪽은 오른쪽을 뒤집은 것', () => {
		for (const head of ['cap', 'hair'] as const) {
			for (const facing of ['up', 'down', 'left', 'right'] as const) {
				for (const frame of ['stand', 'a', 'b'] as const) {
					const rows = personRows(head, facing, frame);
					expect(rows).toHaveLength(PERSON_H);
					for (const row of rows) expect(row).toHaveLength(PERSON_W);
				}
			}
			const right = personRows(head, 'right');
			const left = personRows(head, 'left');
			expect(left).toEqual(right.map((row) => [...row].reverse().join('')));
		}
		// 걷는 프레임은 서 있을 때와 다르다 (다리가 엇갈린다)
		expect(personRows('cap', 'down', 'a')).not.toEqual(personRows('cap', 'down', 'stand'));
		expect(personRows('cap', 'down', 'a')).not.toEqual(personRows('cap', 'down', 'b'));
	});

	it('몬스터·문짝 그림의 줄 길이가 고르다', () => {
		for (const row of MINI_MONSTER) expect(row).toHaveLength(MINI_MONSTER[0].length);
		for (const open of [false, true]) {
			const rows = gateDoorRows(open);
			expect(rows).toHaveLength(26);
			for (const row of rows) expect(row).toHaveLength(32);
		}
	});

	it('장소 표는 지도 안, 소품 위에 뜬다', () => {
		for (const slot of SLOTS) {
			const point = markPoint(slot);
			expect(point.x).toBeGreaterThan(0);
			expect(point.x).toBeLessThan(WORLD_PX_W);
			expect(point.y).toBeGreaterThanOrEqual(12);
			expect(point.y).toBeLessThan((slot.y + slot.h) * 16);
		}
	});
});
