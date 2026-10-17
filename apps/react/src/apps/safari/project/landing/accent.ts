// 랜딩 키트의 강조색: 프로젝트 아이콘에서 뽑은 주된 색(iconColors.ts의 dominantColors) 하나를 아이콘 색 그대로의 채도로 --lk-accent·--lk-accent-2·--lk-dark-accent로
import { useEffect, useState } from 'react';
import type React from 'react';
import { dominantColors } from '@/apps/safari/project/landing/iconColors';

type Hsl = NonNullable<ReturnType<typeof dominantColors>>[number];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hsl = (h: number, s: number, l: number) =>
	`hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(clamp(s, 0, 1) * 100)}% ${Math.round(clamp(l, 0, 1) * 100)}%)`;

/** hsl(0~1) → 흰색과의 명암비 (WCAG 상대 휘도) */
function contrastWithWhite(h: number, s: number, l: number): number {
	const a = s * Math.min(l, 1 - l);
	const channel = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const lum = 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4);
	return 1.05 / (lum + 0.05);
}

/**
 * 뽑은 색 → 키트의 CSS 변수. 강조색은 한 가지: 아이콘의 주된 색을 채도 그대로(회색빛이 돌지 않게, 너무 흐린 색만 조금 올린다),
 * 흰 글자가 읽히는 밝기로(버튼·링크). 둘째 색은 다른 색이 아니라 같은 색상의 한 단계 옅은 값 (그래프의 둘째 점·옅은 칠).
 * --lk-dark-accent는 어두운 바탕에서 쓰는 같은 색의 밝은 값. 무지개가 되지 않게 둘째로 뽑힌 색은 쓰지 않는다
 */
export function accentVars(colors: Hsl[]): Record<string, string> {
	const [main] = colors;
	const s = clamp(main.s, 0.55, 0.9);
	// 노랑·연두처럼 밝게 보이는 색상은 흰 글자가 읽히도록(명암비 3 이상) 조금씩 어둡게
	let l = clamp(main.l, 0.42, 0.52);
	while (l > 0.3 && contrastWithWhite(main.h, s, l) < 3) l -= 0.01;
	return {
		'--lk-accent': hsl(main.h, s, l),
		'--lk-accent-2': hsl(main.h, s * 0.85, 0.66),
		'--lk-dark-accent': hsl(main.h, s, clamp(main.l, 0.6, 0.68)),
	};
}

/**
 * 프로젝트 아이콘에서 색을 뽑아 키트 변수로 (템플릿 바탕에 style로 단다).
 * 못 읽으면(아이콘 없음·다른 출처·흑백) 빈 묶음: 바깥에서 정한 --lk-accent를 그대로 쓴다
 */
export function useLandingAccent(icon: string | undefined): React.CSSProperties {
	const [found, setFound] = useState<{ icon: string; vars: Record<string, string> } | null>(null);
	useEffect(() => {
		if (!icon || typeof Image === 'undefined') return;
		let alive = true;
		const img = new Image();
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
				if (colors) setFound({ icon, vars: accentVars(colors) });
			} catch {
				// 읽기가 막힌 그림: 바깥 색 그대로
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
