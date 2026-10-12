// 랜딩 키트의 강조색: 프로젝트 아이콘에서 뽑은 색(dialogue/iconColors.ts의 dominantColors)을 --lk-accent·--lk-accent-2로
import { useEffect, useState } from 'react';
import type React from 'react';
import { dominantColors } from '@/apps/safari/project/dialogue/iconColors';

type Hsl = NonNullable<ReturnType<typeof dominantColors>>[number];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const hsl = (h: number, s: number, l: number) =>
	`hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(clamp(s, 0, 1) * 100)}% ${Math.round(clamp(l, 0, 1) * 100)}%)`;

/**
 * 뽑은 색 → 키트의 CSS 변수. 강조색은 흰 글자가 읽히는 밝기로(버튼·막대), 둘째 색은 빛 번짐에 쓰니 조금 밝게.
 * 색이 하나뿐이면 둘째 색은 색상환에서 40° 돌린 이웃 색 (그라데이션이 한 색으로 뭉개지지 않게)
 */
export function accentVars(colors: Hsl[]): Record<string, string> {
	const [main, other] = colors;
	const second = other ?? { ...main, h: main.h + 40 };
	return {
		'--lk-accent': hsl(main.h, clamp(main.s, 0.55, 0.85), clamp(main.l, 0.42, 0.52)),
		'--lk-accent-2': hsl(second.h, clamp(second.s, 0.55, 0.85), clamp(second.l, 0.5, 0.62)),
	};
}

/**
 * 프로젝트 아이콘에서 색을 뽑아 키트 변수로 (페이지 바탕이나 MockScreen에 style로 단다).
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
