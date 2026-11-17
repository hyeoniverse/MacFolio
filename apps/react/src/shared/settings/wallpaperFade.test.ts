import { describe, expect, it } from 'vitest';
import { cssUrl } from '@/shared/settings/wallpaperFade';

describe('cssUrl', () => {
	it('CSS 배경 값에서 그림 주소만 꺼낸다', () => {
		expect(cssUrl("url('/imgs/wallpapers/sonoma.webp')")).toBe('/imgs/wallpapers/sonoma.webp');
		expect(cssUrl('url("https://api.example.com/files/abc")')).toBe('https://api.example.com/files/abc');
		expect(cssUrl('url(/a.webp)')).toBe('/a.webp');
	});

	it('그림이 없는 값은 null', () => {
		expect(cssUrl('')).toBeNull();
		expect(cssUrl('linear-gradient(red, blue)')).toBeNull();
	});
});
