// dialogue 모양: 프로젝트 아이콘에서 주요 색을 뽑아 강조색·하늘·바닥 톤의 CSS 변수로
import { useEffect, useState } from 'react';
import type React from 'react';

interface Hsl {
	h: number;
	s: number;
	l: number;
}

function toHsl(r: number, g: number, b: number): Hsl {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return { h: h * 60, s, l };
}

/**
 * 그림의 픽셀에서 주요 색 두 가지 (채도 있는 색 우선, 너무 어둡거나 흰 것은 뺀다). 색이 없으면(흑백 아이콘) null.
 * 색상환을 15° 칸으로 나눠 채도만큼 무게를 더하고, 두 번째 색은 첫 색과 40° 넘게 떨어진 칸에서
 */
export function dominantColors(data: ArrayLike<number>): Hsl[] | null {
	const bins = Array.from({ length: 24 }, () => ({ weight: 0, h: 0, s: 0, l: 0, n: 0 }));
	for (let i = 0; i < data.length; i += 4) {
		if (data[i + 3] < 160) continue;
		const c = toHsl(data[i], data[i + 1], data[i + 2]);
		if (c.l < 0.16 || c.l > 0.9 || c.s < 0.22) continue;
		const bin = bins[Math.floor(c.h / 15) % 24];
		const weight = c.s * (1 - Math.abs(c.l - 0.5));
		bin.weight += weight;
		bin.h += c.h;
		bin.s += c.s;
		bin.l += c.l;
		bin.n += 1;
	}
	const ranked = bins
		.map((bin, i) => ({ ...bin, i }))
		.filter((bin) => bin.n > 0)
		.sort((a, b) => b.weight - a.weight);
	if (ranked.length === 0) return null;
	const avg = (bin: (typeof ranked)[number]): Hsl => ({ h: bin.h / bin.n, s: bin.s / bin.n, l: bin.l / bin.n });
	const first = avg(ranked[0]);
	const second = ranked.find((bin) => {
		const dh = Math.abs(bin.h / bin.n - first.h);
		return Math.min(dh, 360 - dh) >= 40 && bin.weight >= ranked[0].weight * 0.15;
	});
	return second ? [first, avg(second)] : [first];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hsl = (h: number, s: number, l: number) =>
	`hsl(${Math.round(h)} ${Math.round(clamp(s, 0, 1) * 100)}% ${Math.round(clamp(l, 0, 1) * 100)}%)`;

/** 뽑은 색 → CSS 변수: 강조색(이름판·커서·진행 막대)은 크림색 글자가 읽히게 어둡게, 하늘·바닥은 옅게 */
export function paletteVars(colors: Hsl[]): Record<string, string> {
	const [main, other = main] = colors;
	return {
		'--dl-accent': hsl(main.h, clamp(main.s, 0.45, 0.72), 0.4),
		'--dl-tint': hsl(main.h, clamp(main.s, 0.5, 0.8), 0.6),
		'--dl-sky-1': hsl(other.h, 0.62, 0.7),
		'--dl-sky-2': hsl(other.h, 0.5, 0.86),
		'--dl-floor': hsl(main.h, 0.35, 0.6),
	};
}

/** 프로젝트 아이콘에서 색을 뽑아 CSS 변수로. 못 읽으면(다른 출처·불러오기 실패·흑백) 빈 묶음 — 지금 색 그대로 */
export function useIconColors(icon: string | undefined): React.CSSProperties {
	const [found, setFound] = useState<{ icon: string; vars: Record<string, string> } | null>(null);
	useEffect(() => {
		if (!icon) return;
		let alive = true;
		const img = new Image();
		// 다른 출처면 CORS로 받아 본다 (허락하지 않으면 못 불러오고 지금 색 그대로)
		try {
			if (new URL(icon, window.location.href).origin !== window.location.origin) img.crossOrigin = 'anonymous';
		} catch {
			return;
		}
		img.onload = () => {
			if (!alive) return;
			try {
				const size = 32;
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) return;
				ctx.drawImage(img, 0, 0, size, size);
				const colors = dominantColors(ctx.getImageData(0, 0, size, size).data);
				if (colors) setFound({ icon, vars: paletteVars(colors) });
			} catch {
				// 읽기가 막힌 그림: 지금 색 그대로
			}
		};
		img.src = icon;
		return () => {
			alive = false;
			img.onload = null;
		};
	}, [icon]);
	return found && found.icon === icon ? (found.vars as React.CSSProperties) : {};
}
