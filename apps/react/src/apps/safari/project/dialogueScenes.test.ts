import { describe, expect, it } from 'vitest';
import { sheetSize, TILE } from '@/apps/safari/project/dialogueNinja';
import { composeScene, SCENE_KINDS } from './dialogueScenes';

describe('장면 (Ninja Adventure 타일)', () => {
	it('열 장면이 있고, 달밤만 늘 밤이다', () => {
		expect(SCENE_KINDS).toHaveLength(10);
		for (const kind of SCENE_KINDS) expect(composeScene(kind, 480, 214).alwaysNight).toBe(kind === 'night');
	});

	it('어떤 화면 크기(넓고 낮은 화면, 좁고 높은 화면)에서도 땅 타일이 화면을 빈칸 없이 덮는다', () => {
		for (const [w, h] of [
			[366, 214],
			[534, 247],
			[640, 205],
			[390, 321],
			[1000, 300],
		]) {
			for (const kind of SCENE_KINDS) {
				const art = composeScene(kind, w, h);
				const covered = new Set<string>();
				for (const d of art.draws)
					if (d.sw === TILE && d.sh === TILE && d.dx % TILE === 0 && d.dy % TILE === 0)
						covered.add(`${d.dx / TILE},${d.dy / TILE}`);
				for (let ty = 0; ty * TILE < h; ty++)
					for (let tx = 0; tx * TILE < w; tx++)
						expect(covered.has(`${tx},${ty}`), `${kind} ${w}×${h}: ${tx},${ty}`).toBe(true);
			}
		}
	});

	it('모든 조각은 제 그림 안에서 자른다', () => {
		for (const kind of SCENE_KINDS) {
			for (const d of composeScene(kind, 480, 214).draws) {
				if (d.fill) continue;
				const [w, h] = sheetSize(d.sheet);
				expect(d.sx + d.sw, kind).toBeLessThanOrEqual(w);
				expect(d.sy + d.sh, kind).toBeLessThanOrEqual(h);
			}
		}
	});

	it('소품은 양옆 끝을 기준으로 놓아 넓은 화면에서도 오른쪽 끝에 붙는다', () => {
		const right = (w: number) =>
			Math.max(
				...composeScene('meadow', w, 214)
					.draws.filter((d) => d.sw !== TILE)
					.map((d) => d.dx + d.sw)
			);
		expect(right(640)).toBeGreaterThan(600);
		expect(right(366)).toBeLessThan(400);
	});

	it('같은 장면·크기는 한 번만 짠다', () => {
		expect(composeScene('meadow', 480, 214)).toBe(composeScene('meadow', 480, 214));
		expect(composeScene('meadow', 480, 214)).not.toBe(composeScene('meadow', 482, 214));
	});
});
