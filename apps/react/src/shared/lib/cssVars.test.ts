import { describe, expect, it } from 'vitest';
import { cssVars } from './cssVars';

describe('cssVars', () => {
	it('이름 앞에 --를 붙이고, 값이 없는 것은 뺀다', () => {
		expect(cssVars({ d: 2, fill: '40%', none: undefined })).toEqual({ '--d': 2, '--fill': '40%' });
	});
});
