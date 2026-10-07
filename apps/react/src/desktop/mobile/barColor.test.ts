import { describe, expect, it } from 'vitest';
import { isDarkColor, parseColor } from './barColor';

describe('parseColor', () => {
	it('#rgb, #rrggbb, rgb(), rgba()', () => {
		expect(parseColor('#fff')).toEqual([255, 255, 255]);
		expect(parseColor('#3b82f6')).toEqual([59, 130, 246]);
		expect(parseColor('rgb(35, 31, 32)')).toEqual([35, 31, 32]);
		expect(parseColor('rgba(248, 246, 240, 1)')).toEqual([248, 246, 240]);
	});

	it('투명하거나 읽을 수 없는 색은 null', () => {
		expect(parseColor('rgba(0, 0, 0, 0)')).toBeNull();
		expect(parseColor('transparent')).toBeNull();
	});
});

describe('isDarkColor', () => {
	it('어두운 막대(파랑, 검정) 위에는 흰 글자', () => {
		expect(isDarkColor('#3b82f6')).toBe(true);
		expect(isDarkColor('#231f20')).toBe(true);
	});

	it('밝은 막대(흰색, 미색, 옅은 청록) 위에는 검은 글자', () => {
		expect(isDarkColor('#ffffff')).toBe(false);
		expect(isDarkColor('#f8f6f0')).toBe(false);
		expect(isDarkColor('#b8efed')).toBe(false);
	});
});
