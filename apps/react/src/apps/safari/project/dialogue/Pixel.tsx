// 픽셀 그림 한 장을 SVG로 (pixelArt.ts의 그림)
import React from 'react';
import type { Art } from './pixelArt';

/** 그림을 칸 크기(scale px)대로 그린 SVG. 장식이라 읽기 프로그램에는 숨긴다 */
export const Pixel: React.FC<{
	art: Art;
	scale: number;
	className?: string;
	style?: React.CSSProperties;
}> = ({ art, scale, className, style }) => (
	<svg
		className={className}
		style={style}
		viewBox={`0 0 ${art.w} ${art.h}`}
		width={art.w * scale}
		height={art.h * scale}
		shapeRendering="crispEdges"
		aria-hidden="true"
		focusable="false"
	>
		{art.px.map(([fill, x, y, w, h], i) => (
			<rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
		))}
	</svg>
);
