import { describe, expect, it } from 'vitest';
import { accentVars } from './accent';

describe('accentVars', () => {
	it('강조색은 주된 색 하나를 채도를 낮춰, 흰 글자가 읽히는 밝기로', () => {
		const vars = accentVars([
			{ h: 210, s: 0.9, l: 0.8 },
			{ h: 280, s: 0.3, l: 0.3 },
		]);
		expect(vars['--lk-accent']).toBe('hsl(210 62% 50%)');
	});

	it('둘째 색은 다른 색상이 아니라 같은 색상의 옅은 값', () => {
		expect(accentVars([{ h: 340, s: 0.7, l: 0.5 }])['--lk-accent-2']).toBe('hsl(340 47% 62%)');
		expect(
			accentVars([
				{ h: 210, s: 0.5, l: 0.45 },
				{ h: 30, s: 0.9, l: 0.5 },
			])['--lk-accent-2']
		).toBe('hsl(210 38% 62%)');
	});
});
