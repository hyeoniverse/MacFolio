// RPG 대화창(DialoguePage)의 픽셀 그림 부품: 칸 그림(SVG 사각형), 픽셀 아이콘, 무대 뒤 타일 장면(캔버스), 사진·아이콘을 픽셀로 줄인 그림.
// 모두 게임 화면의 칸 단위로 그리고 화면 전체가 정수 배로 커지므로 가장자리가 흐려지지 않는다. 꾸밈이라 읽기 프로그램에는 숨긴다
import React, { useEffect, useRef, useState } from 'react';
import { pixelRuns } from '@/apps/safari/project/dialogueStage';
import { ICON_COLORS, ICONS, pixelate, type IconName } from '@/apps/safari/project/dialogueIcons';
import { sceneRgba, sceneView, SCENE_H, SCENE_W, VIEW_H, VIEW_W } from '@/apps/safari/project/dialogueScenes';
import type { SceneKind } from '@/apps/safari/project/dialogueStage';

/** 칸 그림: 한 칸을 scale 칸(게임 화면의 px)으로 키운 사각형들. 가장자리를 흐리지 않는다 */
export const Pixels: React.FC<{
	rows: readonly string[];
	className: string;
	scale: number;
	colors?: Record<string, string>;
	style?: React.CSSProperties;
}> = ({ rows, className, scale, colors, style }) => {
	const w = rows[0]?.length ?? 16;
	const h = rows.length;
	return (
		<svg
			className={className}
			width={w * scale}
			height={h * scale}
			viewBox={`0 0 ${w} ${h}`}
			shapeRendering="crispEdges"
			aria-hidden="true"
			focusable="false"
			style={style}
		>
			{pixelRuns(rows, colors).map((run) => (
				<rect key={`${run.x}-${run.y}`} x={run.x} y={run.y} width={run.w} height={1} style={{ fill: run.color }} />
			))}
		</svg>
	);
};

/** 픽셀 아이콘 하나 (12×12 칸을 scale배) */
export const PixelIcon: React.FC<{ name?: IconName; rows?: readonly string[]; scale?: number; className?: string }> = ({
	name,
	rows,
	scale = 1,
	className = 'dl-icon',
}) => <Pixels rows={rows ?? ICONS[name ?? 'star']} colors={ICON_COLORS} scale={scale} className={className} />;

/** 무대 뒤 장면: 낮·밤 두 장을 칠해 두고 CSS가 테마에 맞는 한 장만 보인다 (장면이 바뀔 때만 다시 칠한다) */
const SceneCanvas: React.FC<{ scene: SceneKind; night: boolean }> = ({ scene, night }) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const ctx = ref.current?.getContext('2d');
		if (!ctx || typeof ImageData === 'undefined') return;
		// 480×272 장면에서 게임 화면만큼(360×208)을 잘라 올린다
		const view = sceneView(scene);
		ctx.putImageData(new ImageData(new Uint8ClampedArray(sceneRgba(scene, night)), SCENE_W, SCENE_H), -view.x, -view.y);
	}, [scene, night]);
	return (
		<canvas
			ref={ref}
			className="dl-backdrop"
			data-night={night || undefined}
			width={VIEW_W}
			height={VIEW_H}
			aria-hidden="true"
		/>
	);
};

export const SceneBackdrop: React.FC<{ scene: SceneKind }> = ({ scene }) => (
	<>
		<SceneCanvas scene={scene} night={false} />
		<SceneCanvas scene={scene} night />
	</>
);

const pixelCache = new Map<string, Promise<string | null>>();

/**
 * 그림 한 장을 size×size 픽셀 아이콘으로: 4배 크기로 줄여 그리고(cover면 꽉 채워 자르고, 아니면 다 보이게),
 * 색을 colors개로 줄인 뒤 4×4칸마다 가장 많은 색 하나를 고른다. 다른 곳의 그림이라 읽을 수 없으면 null (원래 그림을 쓴다)
 */
function pixelImage(src: string, size: number, cover: boolean, colors = 16): Promise<string | null> {
	const key = `${src}|${size}|${cover ? 'c' : 'f'}|${colors}`;
	const cached = pixelCache.get(key);
	if (cached) return cached;
	const job = new Promise<string | null>((resolve) => {
		if (typeof document === 'undefined') return resolve(null);
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';
		img.onerror = () => resolve(null);
		img.onload = () => {
			try {
				const block = 4;
				const n = size * block;
				const canvas = document.createElement('canvas');
				canvas.width = n;
				canvas.height = n;
				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				const w = img.naturalWidth || n;
				const h = img.naturalHeight || n;
				if (!ctx) return resolve(null);
				const scale = cover ? Math.max(n / w, n / h) : Math.min(n / w, n / h);
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(img, (n - w * scale) / 2, (n - h * scale) / 2, w * scale, h * scale);
				// 아이콘(cover가 아닌 것)은 투명한 둘레에 외곽선을 두른다
				const out = pixelate(ctx.getImageData(0, 0, n, n).data, size, block, colors, !cover);
				const small = document.createElement('canvas');
				small.width = size;
				small.height = size;
				const sctx = small.getContext('2d');
				if (!sctx) return resolve(null);
				sctx.putImageData(new ImageData(out, size, size), 0, 0);
				resolve(small.toDataURL('image/png'));
			} catch {
				resolve(null);
			}
		};
		img.src = src;
	});
	pixelCache.set(key, job);
	return job;
}

/** 픽셀로 줄인 그림의 주소. 만드는 동안은 undefined, 못 만들면 null */
function usePixelImage(src: string | undefined, size: number, cover: boolean): string | null | undefined {
	const [result, setResult] = useState<{ src?: string; url: string | null | undefined }>({ url: undefined });
	useEffect(() => {
		if (!src) return;
		let alive = true;
		void pixelImage(src, size, cover).then((url) => {
			if (alive) setResult({ src, url });
		});
		return () => {
			alive = false;
		};
	}, [src, size, cover]);
	if (!src) return null;
	return result.src === src ? result.url : undefined;
}

/**
 * 픽셀로 줄인 그림: size칸 그림을 scale배로 (image-rendering: pixelated). 만드는 동안은 같은 자리를 비워 두고,
 * 못 만들면 원래 그림을 같은 크기로 쓴다
 */
export const PixelImage: React.FC<{ src: string; size: number; scale: number; cover?: boolean; className: string }> = ({
	src,
	size,
	scale,
	cover = false,
	className,
}) => {
	const url = usePixelImage(src, size, cover);
	const px = size * scale;
	if (url === undefined) return <span className={className} style={{ width: px, height: px }} aria-hidden="true" />;
	return (
		<img
			className={className}
			src={url ?? src}
			alt=""
			width={px}
			height={px}
			data-pixel={url ? '' : undefined}
			style={{ width: px, height: px, objectFit: cover ? 'cover' : 'contain' }}
		/>
	);
};
