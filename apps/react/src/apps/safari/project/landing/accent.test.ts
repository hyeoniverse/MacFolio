import { describe, expect, it } from 'vitest';
import { accentVars } from './accent';

describe('accentVars', () => {
	it('강조색은 흰 글자가 읽히는 밝기로, 둘째 색은 조금 밝게', () => {
		const vars = accentVars([
			{ h: 210, s: 0.9, l: 0.8 },
			{ h: 280, s: 0.3, l: 0.3 },
		]);
		expect(vars['--lk-accent']).toBe('hsl(210 85% 52%)');
		expect(vars['--lk-accent-2']).toBe('hsl(280 55% 50%)');
	});

	it('색이 하나뿐이면 둘째 색은 색상환에서 40° 돌린 이웃 색', () => {
		const vars = accentVars([{ h: 340, s: 0.7, l: 0.5 }]);
		expect(vars['--lk-accent']).toBe('hsl(340 70% 50%)');
		expect(vars['--lk-accent-2']).toBe('hsl(20 70% 50%)');
	});
});
