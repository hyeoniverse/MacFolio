import { describe, expect, it } from 'vitest';
import { partialFigure, splitFigure } from './count';

describe('splitFigure', () => {
	it('앞말·숫자·뒷말로 나눈다', () => {
		expect(splitFigure('1,800명')).toEqual({ before: '', number: '1,800', after: '명' });
		expect(splitFigure('92%')).toEqual({ before: '', number: '92', after: '%' });
		expect(splitFigure('v2.5')).toEqual({ before: 'v', number: '2.5', after: '' });
	});

	it('숫자가 없거나 여럿이면 null', () => {
		expect(splitFigure('많음')).toBeNull();
		expect(splitFigure('3곳 중 2곳')).toBeNull();
	});
});

describe('partialFigure', () => {
	it('쉼표와 소수 자리를 원래 모양대로 둔다', () => {
		expect(partialFigure('1,800', 0)).toBe('0');
		expect(partialFigure('1,800', 0.5)).toBe('900');
		expect(partialFigure('12,000', 1)).toBe('12,000');
		expect(partialFigure('2.5', 0.5)).toBe('1.3');
		expect(partialFigure('92', 1)).toBe('92');
	});
});
