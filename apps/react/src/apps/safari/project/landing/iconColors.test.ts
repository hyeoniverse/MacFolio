import { describe, expect, it } from 'vitest';
import { dominantColors } from './iconColors';

/** 색 [r, g, b]를 n칸씩 이어 붙인 RGBA 픽셀 */
const pixels = (...runs: [number[], number][]) =>
	runs.flatMap(([rgb, n]) => Array.from({ length: n }, () => [...rgb, 255]).flat());

describe('dominantColors', () => {
	it('채도 있는 색을 우선하고, 흰색·검은색·회색은 뺀다', () => {
		const colors = dominantColors(
			pixels([[255, 255, 255], 400], [[10, 10, 10], 200], [[128, 128, 128], 200], [[40, 160, 150], 60])
		);
		expect(colors).toHaveLength(1);
		expect(colors?.[0].h).toBeGreaterThan(170);
		expect(colors?.[0].h).toBeLessThan(180);
	});

	it('두 번째 색은 첫 색과 색상이 떨어진 것', () => {
		const colors = dominantColors(pixels([[220, 40, 120], 100], [[230, 50, 110], 40], [[60, 90, 220], 40]));
		expect(colors).toHaveLength(2);
		expect(colors?.[1].h).toBeGreaterThan(200);
	});

	it('흑백 그림이면 null (지금 색 그대로)', () => {
		expect(dominantColors(pixels([[255, 255, 255], 10], [[0, 0, 0], 10]))).toBeNull();
	});
});
