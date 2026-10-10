// 테마 미리보기가 쓰는 색 계산: WCAG 대비, OKLab으로 명도만 옮기기. React 없이 순수 함수만 둔다 (color.test.ts)
import type { ThemeSwatch } from '@/shared/profile';

/** "#rrggbb" → 0~1 sRGB */
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hexOf = (rgb: number[]) =>
	`#${rgb
		.map((c) =>
			Math.round(Math.min(1, Math.max(0, c)) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('')}`;

/** 상대 휘도 (WCAG) */
const luminance = (hex: string) => {
	const [r, g, b] = rgbOf(hex).map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** 두 색의 대비 (1~21) */
export const contrast = (a: string, b: string) => {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
};
export const grade = (ratio: number) => (ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? '큰 글자 AA' : '부족');
/** 글자 최소 대비 (WCAG AA 본문) */
const MIN_TEXT_CONTRAST = 4.5;

/** sRGB ↔ OKLab (명도만 옮기고 색상·채도는 두려고) */
const toOklab = (hex: string) => {
	const [r, g, b] = rgbOf(hex).map(toLinear);
	const [l, m, s] = [
		0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
		0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
		0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
	].map(Math.cbrt);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
};
/** OKLab → sRGB (0~1, 색역 밖이면 0~1을 벗어난다) */
const fromOklab = ([L, a, b]: number[]) => {
	const [l, m, s] = [
		L + 0.3963377774 * a + 0.2158037573 * b,
		L - 0.1055613458 * a - 0.0638541728 * b,
		L - 0.0894841775 * a - 1.291485548 * b,
	].map((v) => v ** 3);
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map(fromLinear);
};
const inGamut = (rgb: number[]) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

/** 강조 글자: 바탕 위 대비가 모자라면 그 사이트처럼 OKLCH 명도만 바탕 반대쪽으로 옮긴다 (색역 밖이면 채도를 줄여 안으로) */
export const readableAccent = (accent: string, bg: string) => {
	if (contrast(accent, bg) >= MIN_TEXT_CONTRAST) return accent;
	const [L, a, b] = toOklab(accent);
	const step = contrast(bg, '#000000') < contrast(bg, '#ffffff') ? 0.01 : -0.01;
	for (let l = L + step; l > 0 && l < 1; l += step) {
		let k = 1;
		while (k > 0 && !inGamut(fromOklab([l, a * k, b * k]))) k -= 0.02;
		const hex = hexOf(fromOklab([l, a * Math.max(0, k), b * Math.max(0, k)]));
		if (contrast(hex, bg) >= MIN_TEXT_CONTRAST) return hex;
	}
	return step > 0 ? '#ffffff' : '#000000';
};

/** 강조색 면 위 글자: 그 모드의 바탕 → 글자 → 반대 모드의 바탕·글자 순으로 대비 4.5가 되는 첫 색 */
export const textOnAccent = (theme: ThemeSwatch, mode: 'light' | 'dark') => {
	const own = mode === 'light' ? [theme.lightBg, theme.lightText] : [theme.darkBg, theme.darkText];
	const other = mode === 'light' ? [theme.darkBg, theme.darkText] : [theme.lightBg, theme.lightText];
	const found = [...own, ...other].find((color) => contrast(color, theme.accent) >= MIN_TEXT_CONTRAST);
	return found ?? (contrast('#ffffff', theme.accent) >= contrast('#000000', theme.accent) ? '#ffffff' : '#000000');
};
