import { describe, expect, it } from 'vitest';
import {
	ARCADE_CARPET,
	CASTLE,
	CAVE_FLOOR,
	COBBLE,
	composeScene,
	COTTAGE,
	GRASS_TILES,
	nightOf,
	noise,
	PLANKS,
	PROP_COLORS,
	questBoardRows,
	SCENE_H,
	SCENE_KINDS,
	SCENE_W,
	scenePalette,
	sceneRgba,
	sceneShift,
	signpostRows,
	TALL_GRASS,
	TILE,
	WALL_PLANKS,
	WATER,
} from './dialogueScenes';

const HEX = /^#[0-9a-f]{6}$/i;

describe('타일', () => {
	it('16×16 타일은 모두 16줄 16칸', () => {
		for (const [name, tile] of Object.entries({
			GRASS_0: GRASS_TILES[0],
			GRASS_1: GRASS_TILES[1],
			GRASS_2: GRASS_TILES[2],
			TALL_GRASS,
			COBBLE,
			PLANKS,
			WALL_PLANKS,
			WATER,
			CAVE_FLOOR,
			ARCADE_CARPET,
		})) {
			expect(tile, name).toHaveLength(TILE);
			for (const row of tile) expect(row, name).toHaveLength(TILE);
			expect(tile.join(''), name).not.toContain('.');
		}
	});

	it('기준 판은 30×17 타일 크기 (480×272)', () => {
		expect(SCENE_W).toBe(30 * TILE);
		expect(SCENE_H).toBe(17 * TILE);
	});

	it('소품 자리는 왼쪽·가운데·오른쪽에 붙여 옮기고, 높은 화면의 바깥 장면은 지평선을 내린다', () => {
		const wide = composeScene('meadow', false, 640, 214);
		expect([wide.L(26), wide.C(240), wide.R(456)]).toEqual([26, 320, 616]);
		const narrow = composeScene('meadow', false, 366, 214);
		expect([narrow.L(26), narrow.C(240), narrow.R(456)]).toEqual([26, 183, 342]);
		expect(sceneShift('meadow', 214)).toBe(0);
		expect(sceneShift('meadow', 300)).toBe(42);
		expect(sceneShift('meadow', 400)).toBe(64);
		// 안쪽 장면(상점 등)은 내리지 않고 바닥을 늘린다
		expect(sceneShift('shop', 300)).toBe(0);
	});

	it('소품(표지판, 게시판, 집, 성)은 줄 폭이 같고 소품 팔레트의 색만', () => {
		for (const [name, rows] of Object.entries({
			signpost: signpostRows(40, 30, 10),
			board: questBoardRows(52, 44),
			CASTLE,
			COTTAGE,
		})) {
			const width = rows[0].length;
			for (const row of rows) expect(row, name).toHaveLength(width);
			for (const ch of new Set(rows.join(''))) if (ch !== '.') expect(PROP_COLORS[ch], `${name}: ${ch}`).toBeTruthy();
		}
		expect(signpostRows(40, 30, 10)).toHaveLength(40);
		expect(questBoardRows(52, 44)).toHaveLength(44);
	});

	it('해시는 0 이상 1 미만이고 같은 칸은 늘 같다', () => {
		for (let i = 0; i < 200; i++) {
			const n = noise(i, i * 7, 3);
			expect(n).toBeGreaterThanOrEqual(0);
			expect(n).toBeLessThan(1);
		}
		expect(noise(5, 9, 2)).toBe(noise(5, 9, 2));
	});
});

describe('장면', () => {
	it('열 장면 모두: 낮·밤 팔레트가 그림의 모든 글자를 칠하고, 화면을 빈칸 없이 채운다', () => {
		expect(SCENE_KINDS).toHaveLength(10);
		for (const kind of SCENE_KINDS) {
			for (const night of [false, true]) {
				const map = composeScene(kind, night);
				expect(map.w).toBe(SCENE_W);
				expect(map.h).toBe(SCENE_H);
				const palette = scenePalette(kind, night);
				for (const key of new Set(map.px)) {
					expect(key, `${kind} ${night ? '밤' : '낮'}: 빈칸`).not.toBe('.');
					expect(palette[key], `${kind} ${night ? '밤' : '낮'}: ${key}`).toMatch(HEX);
				}
				// 한 장면은 팔레트 몇 가지 색으로 (지나치게 많지 않게)
				expect(new Set(map.px.map((k) => palette[k])).size, kind).toBeLessThanOrEqual(48);
			}
		}
	});

	it('어떤 화면 크기(넓고 낮은 화면, 좁고 높은 화면)에서도 장면은 화면을 빈칸 없이 채운다', () => {
		for (const [w, h] of [
			[366, 214],
			[534, 247],
			[640, 205],
			[390, 321],
			[1000, 300],
		]) {
			for (const kind of SCENE_KINDS) {
				for (const night of [false, true]) {
					const rgba = sceneRgba(kind, night, w, h);
					expect(rgba, `${kind} ${w}×${h}`).toHaveLength(w * h * 4);
					let holes = 0;
					for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) holes++;
					expect(holes, `${kind} ${night ? '밤' : '낮'} ${w}×${h}`).toBe(0);
				}
			}
		}
	});

	it('같은 장면은 한 번만 칠하고(같은 판), RGBA는 480×272×4로 모두 불투명', () => {
		expect(composeScene('meadow', false)).toBe(composeScene('meadow', false));
		const rgba = sceneRgba('field', true);
		expect(rgba).toHaveLength(SCENE_W * SCENE_H * 4);
		for (let i = 3; i < rgba.length; i += 4 * 97) expect(rgba[i]).toBe(255);
	});

	it('밤은 같은 그림의 색 바꿈: 칠한 자리는 낮과 같고(별 같은 밤의 것만 더한다) 색은 더 어둡다', () => {
		const day = composeScene('shop', false);
		const night = composeScene('shop', true);
		let same = 0;
		day.px.forEach((k, i) => {
			if (k === night.px[i]) same++;
		});
		expect(same / day.px.length).toBeGreaterThan(0.98);
		const luma = (hex: string) =>
			0.3 * parseInt(hex.slice(1, 3), 16) + 0.59 * parseInt(hex.slice(3, 5), 16) + 0.11 * parseInt(hex.slice(5, 7), 16);
		expect(luma(nightOf('#8cd468'))).toBeLessThan(luma('#8cd468'));
		expect(luma(nightOf('#f8ecd4', true))).toBeLessThan(luma('#f8ecd4'));
		expect(nightOf('#ffffff')).toMatch(HEX);
	});
});
