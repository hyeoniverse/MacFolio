// 휴대폰 상태 표시줄 뒤의 색 (Safari처럼 페이지 머리 막대와 이어 보이게).
// 웹 페이지를 띄우는 앱이 자기 머리 막대 색을 남기면, 상태 표시줄이 맨 앞 앱의 색을 보고 글자를 밝게·어둡게 고른다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@/shared/lib/createStore';

const barColors = createStore<Record<string, string>>({});

/** 앱의 머리 막대 색을 남긴다 (null이면 지운다) */
export function setBarColor(app: string, color: string | null) {
	barColors.setState((current) => {
		if ((current[app] ?? null) === color) return current;
		const next = { ...current };
		if (color) next[app] = color;
		else delete next[app];
		return next;
	});
}

export function useBarColor(app: string | null): string | null {
	return useSyncExternalStore(barColors.subscribe, () => (app ? (barColors.getState()[app] ?? null) : null));
}

/** #rgb·#rrggbb·rgb()·rgba() 색을 [r, g, b]로. 읽을 수 없으면 null */
export function parseColor(color: string): [number, number, number] | null {
	const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit) : hex[1].match(/../g)!;
		return digits.map((pair) => parseInt(pair, 16)) as [number, number, number];
	}
	const rgb = color.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?\s*\)$/i);
	if (!rgb || (rgb[4] !== undefined && Number(rgb[4]) === 0)) return null;
	return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

/** 어두운 색인지 (그 위의 글자는 흰색). 상대 휘도(WCAG)가 0.4보다 낮으면 어둡다 */
export function isDarkColor(color: string): boolean {
	const rgb = parseColor(color);
	if (!rgb) return false;
	const [r, g, b] = rgb.map((value) => {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
}
