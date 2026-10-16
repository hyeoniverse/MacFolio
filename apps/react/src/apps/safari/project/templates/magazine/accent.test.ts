import type React from 'react';
import { describe, expect, it } from 'vitest';
import { hueOf, magazineAccent } from './accent';

const vars = (hue: number) =>
	({
		'--lk-accent': `hsl(${hue} 80% 40%)`,
		'--lk-accent-2': `hsl(${hue} 68% 66%)`,
		'--lk-dark-accent': `hsl(${hue} 80% 64%)`,
	}) as React.CSSProperties;

describe('magazineAccent', () => {
	it('읽은 색상 각도를 돌려준다', () => {
		expect(hueOf('hsl(212 80% 44%)')).toBe(212);
		expect(hueOf(undefined)).toBeNull();
		expect(hueOf('#b23a2b')).toBeNull();
	});

	it('빨강·파랑·초록처럼 맑은 색은 아이콘 색을 그대로 쓴다', () => {
		for (const hue of [0, 210, 280, 140]) expect(magazineAccent(vars(hue))).toEqual(vars(hue));
	});

	it('노랑에서 연두까지는 탁해지므로 템플릿 기본값(깊은 빨강)으로 돌린다', () => {
		for (const hue of [40, 50, 75, 95]) expect(magazineAccent(vars(hue))).toEqual({});
	});

	it('아이콘 색을 못 읽었으면 빈 묶음 그대로다', () => {
		expect(magazineAccent({})).toEqual({});
	});
});
