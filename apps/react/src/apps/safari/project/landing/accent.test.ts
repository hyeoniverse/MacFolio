import { describe, expect, it } from 'vitest';
import { accentVars } from './accent';

describe('accentVars', () => {
	it('강조색은 주된 색 하나를 아이콘의 채도 그대로, 흰 글자가 읽히는 밝기로', () => {
		const vars = accentVars([
			{ h: 210, s: 0.9, l: 0.8 },
			{ h: 280, s: 0.3, l: 0.3 },
		]);
		expect(vars['--lk-accent']).toBe('hsl(210 90% 52%)');
		expect(accentVars([{ h: 340, s: 0.7, l: 0.5 }])['--lk-accent']).toBe('hsl(340 70% 50%)');
	});

	it('흐린 아이콘 색은 회색빛이 돌지 않게 채도를 조금 올린다', () => {
		expect(accentVars([{ h: 220, s: 0.3, l: 0.45 }])['--lk-accent']).toBe('hsl(220 55% 45%)');
	});

	it('노랑처럼 밝게 보이는 색상은 흰 글자가 읽히도록 더 어둡게', () => {
		const accent = accentVars([{ h: 50, s: 0.9, l: 0.5 }])['--lk-accent'];
		expect(accent.startsWith('hsl(50 90% ')).toBe(true);
		expect(Number(accent.match(/(\d+)%\)$/)?.[1])).toBeLessThan(40);
	});

	it('둘째 색은 다른 색상이 아니라 같은 색상의 옅은 값', () => {
		expect(accentVars([{ h: 340, s: 0.7, l: 0.5 }])['--lk-accent-2']).toBe('hsl(340 60% 66%)');
		expect(
			accentVars([
				{ h: 210, s: 0.6, l: 0.45 },
				{ h: 30, s: 0.9, l: 0.5 },
			])['--lk-accent-2']
		).toBe('hsl(210 51% 66%)');
	});

	it('어두운 바탕에서는 같은 색의 밝은 값', () => {
		expect(accentVars([{ h: 210, s: 0.9, l: 0.45 }])['--lk-dark-accent']).toBe('hsl(210 90% 60%)');
	});
});
