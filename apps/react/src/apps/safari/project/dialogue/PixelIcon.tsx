// dialogue 모양의 화자 얼굴: 프로젝트 아이콘을 16×16 칸으로 줄여 흐림 없이 키운다 (고전 RPG의 초상처럼)
import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/shared/profile';
import { Favicon } from '@/apps/safari/project/parts';

/** 한 변의 칸 수. CSS에서 정수 배(3·4배)로 키운다 */
export const ICON_CELLS = 16;

/**
 * 아이콘을 ICON_CELLS 칸 canvas에 그린다. 반쯤 비치는 칸은 비우거나 채워 가장자리를 또렷하게 한다.
 * 아이콘이 없거나 못 불러오면 보통 아이콘(Favicon)을 그대로 쓴다
 */
export const PixelIcon: React.FC<{ project: Project; className: string }> = ({ project, className }) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const icon = project.icon;
	const [failed, setFailed] = useState<string | null>(null);
	useEffect(() => {
		const canvas = ref.current;
		if (!icon || !canvas) return;
		let alive = true;
		const img = new Image();
		try {
			if (new URL(icon, window.location.href).origin !== window.location.origin) img.crossOrigin = 'anonymous';
		} catch {
			// 주소를 못 읽으면 그대로 불러 본다 (못 불러오면 onerror)
		}
		img.onload = () => {
			if (!alive) return;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) return;
			ctx.clearRect(0, 0, ICON_CELLS, ICON_CELLS);
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			ctx.drawImage(img, 0, 0, ICON_CELLS, ICON_CELLS);
			try {
				const data = ctx.getImageData(0, 0, ICON_CELLS, ICON_CELLS);
				for (let i = 3; i < data.data.length; i += 4) data.data[i] = data.data[i] < 110 ? 0 : 255;
				ctx.putImageData(data, 0, 0);
			} catch {
				// 다른 출처라 읽기가 막힌 그림: 줄여 그리기만 한다
			}
		};
		img.onerror = () => alive && setFailed(icon);
		img.src = icon;
		return () => {
			alive = false;
			img.onload = null;
			img.onerror = null;
		};
	}, [icon]);
	if (!icon || failed === icon) return <Favicon project={project} className={className} />;
	return <canvas ref={ref} className={className} width={ICON_CELLS} height={ICON_CELLS} />;
};
