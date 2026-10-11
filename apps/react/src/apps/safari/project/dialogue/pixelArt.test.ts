import { describe, expect, it } from 'vitest';
import { quantize } from './pixelArt';

describe('quantize', () => {
	it('색을 k가지 이하로 줄이고, 이미 적은 색은 그대로 둔다', () => {
		const data: number[] = [];
		for (let i = 0; i < 400; i++) data.push((i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255);
		quantize(data, 8);
		const colors = new Set<string>();
		for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
		expect(colors.size).toBeLessThanOrEqual(8);
		expect(data[3]).toBe(255);

		const flat = [10, 20, 30, 255, 10, 20, 30, 255, 200, 100, 50, 255];
		quantize(flat, 4);
		expect(flat).toEqual([10, 20, 30, 255, 10, 20, 30, 255, 200, 100, 50, 255]);
	});
});
