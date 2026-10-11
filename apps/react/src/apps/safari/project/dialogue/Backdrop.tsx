// dialogue 모양의 배경 장면: 테마마다 하늘(벽)·지평선 띠·바닥·가장자리 소품, 배경 그림의 픽셀화.
// 모두 장식(aria-hidden)이고 대화 상자·장면 액자·HUD 뒤에 깔린다
import React, { useEffect, useRef } from 'react';
import type { BackdropTheme } from '@macfolio/desktop-core/site';
import { artUrl, type Art } from './pixelArt';
import { Pixel } from './Pixel';
import * as S from './sprites';

/** 가장자리 소품 하나: 왼쪽이나 오른쪽에서 몇 %, 바닥에서 몇 px, 칸 크기 */
interface Prop {
	art?: Art;
	img?: string;
	scale: number;
	left?: string;
	right?: string;
	bottom?: number;
	/** 불빛 (소품 안에서의 자리 %, 지름 px) */
	glow?: { x: number; y: number; size: number };
	/** 뒤집어 놓기 */
	flip?: boolean;
	className?: string;
}

/** 하늘에 떠 있는 것 (구름·행성·해): .dl 전체에서의 자리 */
interface SkyItem {
	art: Art;
	scale: number;
	left?: string;
	right?: string;
	top: string;
	className?: string;
}

interface Scene {
	sky?: SkyItem[];
	/** 지평선을 따라 가로로 이어지는 그림 */
	band?: { art: Art; scale: number; wall?: boolean };
	props?: Prop[];
}

const sprout = (name: string) => `/imgs/projects/sproutfarm/sprites/${name}.png`;

const CLOUDS: SkyItem[] = [
	{ art: S.CLOUD, scale: 4, left: '7%', top: '10%', className: 'dl-drift' },
	{ art: S.CLOUD_SMALL, scale: 4, left: '30%', top: '20%', className: 'dl-drift slow' },
	{ art: S.CLOUD, scale: 5, right: '22%', top: '6%', className: 'dl-drift slow' },
	{ art: S.CLOUD_SMALL, scale: 4, right: '6%', top: '24%', className: 'dl-drift' },
];

const SCENES: Record<Exclude<BackdropTheme, 'auto'>, Scene> = {
	farm: {
		sky: CLOUDS,
		band: { art: S.HILLS, scale: 4 },
		props: [
			{ img: sprout('tree'), scale: 5, left: '1%' },
			{ img: sprout('bush'), scale: 4, left: '11%' },
			{ img: sprout('flower-pink'), scale: 3, left: '16%' },
			{ img: sprout('sunflower'), scale: 4, left: '19.5%' },
			{ img: sprout('flower-blue'), scale: 3, right: '21%' },
			{ img: sprout('bush'), scale: 4, right: '14%' },
			{ img: sprout('fruit-tree'), scale: 5, right: '1%' },
		],
	},
	town: {
		sky: [
			{ art: S.STREAK, scale: 5, left: '6%', top: '22%' },
			{ art: S.STREAK, scale: 4, left: '34%', top: '12%' },
			{ art: S.STREAK, scale: 5, right: '8%', top: '30%' },
		],
		band: { art: S.SKYLINE, scale: 4, wall: true },
		props: [
			{ art: S.LAMP, scale: 4, left: '3%', glow: { x: 50, y: 12, size: 112 } },
			{ art: S.BENCH, scale: 4, left: '7.5%' },
			{ art: S.TREE_POT, scale: 5, right: '10%' },
			{ art: S.POSTBOX, scale: 4, right: '7%' },
			{ art: S.LAMP, scale: 4, right: '2%', glow: { x: 50, y: 12, size: 112 } },
		],
	},
	office: {
		props: [
			{ art: S.DESK, scale: 4, left: '0.5%' },
			{ art: S.COOLER, scale: 4, right: '12%' },
			{ art: S.MONSTERA, scale: 5, right: '2%' },
		],
	},
	library: {
		sky: [
			{ art: S.PENDANT, scale: 4, left: '31%', top: '0', className: 'dl-pendant' },
			{ art: S.PENDANT, scale: 4, right: '31%', top: '0', className: 'dl-pendant' },
		],
		band: { art: S.SHELVES, scale: 4, wall: true },
		props: [
			{ art: S.LADDER, scale: 4, left: '9%' },
			{ art: S.BOOKS, scale: 4, left: '2%' },
			{ art: S.GLOBE, scale: 4, right: '12%' },
			{ art: S.FLOOR_LAMP, scale: 4, right: '3%', glow: { x: 50, y: 14, size: 190 } },
		],
	},
	space: {
		sky: [
			{ art: S.PLANET, scale: 4, right: '4%', top: '24%', className: 'dl-float' },
			{ art: S.MOON, scale: 4, left: '17%', top: '30%', className: 'dl-float slow' },
		],
		props: [
			{ art: S.DISH, scale: 5, left: '1.5%' },
			{ art: S.CRATE, scale: 4, left: '9%' },
			{ art: S.CRATE, scale: 3, left: '12.5%' },
			{ art: S.ROCKET, scale: 5, right: '3%', className: 'dl-rocket' },
		],
	},
	sea: {
		sky: [
			{ art: S.SUN, scale: 5, left: '21%', top: '24%' },
			...CLOUDS.slice(0, 3),
			{ art: S.GULL, scale: 3, left: '22%', top: '30%', className: 'dl-gull' },
			{ art: S.GULL, scale: 3, left: '25%', top: '26%', className: 'dl-gull slow' },
			{ art: S.GULL, scale: 3, right: '19%', top: '30%', className: 'dl-gull' },
		],
		props: [
			{ art: S.PALM, scale: 3, left: '1%' },
			{ art: S.CRAB, scale: 3, left: '12%', className: 'dl-crab' },
			{ art: S.UMBRELLA, scale: 4, right: '13%' },
			{ art: S.LIGHTHOUSE, scale: 3, right: '3%', glow: { x: 50, y: 10, size: 90 } },
		],
	},
};

/** 바닥 무늬와 물결·별 타일 (CSS 배경 주소) */
const TILE_URL: Partial<Record<BackdropTheme, string>> = {
	town: artUrl(S.TILES.town, 3),
	office: artUrl(S.TILES.office, 3),
	library: artUrl(S.TILES.library, 4),
	space: artUrl(S.TILES.space, 4),
	sea: artUrl(S.TILES.sea, 3),
};
const SEA_VARS = { '--dl-wave': artUrl(S.WAVE, 3), '--dl-foam': artUrl(S.FOAM, 3) } as React.CSSProperties;
const STARS = [artUrl(S.starTile(3, 90, 26, 1), 2), artUrl(S.starTile(9, 70, 12, 2), 3)].join(', ');
const TWINKLE = artUrl(S.starTile(17, 80, 0, 3), 3);

/** 그림을 장면 크기에 맞춰 아주 작게 그린 뒤(칸 하나 = 12px) 픽셀 그대로 키워 보인다. 못 불러오면 onFail */
const PIXEL_CELL = 12;

const PixelImage: React.FC<{ src: string; onState: (state: 'ok' | 'fail') => void }> = ({ src, onState }) => {
	const ref = useRef<HTMLCanvasElement>(null);
	const report = useRef(onState);
	useEffect(() => {
		report.current = onState;
	});
	useEffect(() => {
		const canvas = ref.current;
		const box = canvas?.parentElement;
		if (!canvas || !box) return;
		let alive = true;
		const img = new Image();
		img.decoding = 'async';
		const draw = () => {
			if (!img.naturalWidth) return;
			const cols = Math.max(16, Math.round((box.clientWidth || 960) / PIXEL_CELL));
			const rows = Math.max(10, Math.round((box.clientHeight || 600) / PIXEL_CELL));
			if (canvas.width !== cols) canvas.width = cols;
			if (canvas.height !== rows) canvas.height = rows;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = 'high';
			// 덮기(cover): 가운데를 맞추되 위쪽(화면 캡처의 머리)을 조금 더 남긴다
			const scale = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
			const w = img.naturalWidth * scale;
			const h = img.naturalHeight * scale;
			ctx.clearRect(0, 0, cols, rows);
			ctx.drawImage(img, (cols - w) / 2, (rows - h) / 3, w, h);
			// 색 수를 줄여 픽셀 그림답게. 다른 출처 그림이면 읽기가 막혀 그대로 둔다
			try {
				const data = ctx.getImageData(0, 0, cols, rows);
				const d = data.data;
				for (let i = 0; i < d.length; i += 4) {
					d[i] = Math.round(d[i] / 36) * 36;
					d[i + 1] = Math.round(d[i + 1] / 36) * 36;
					d[i + 2] = Math.round(d[i + 2] / 36) * 36;
				}
				ctx.putImageData(data, 0, 0);
			} catch {
				// 다른 출처: 그리기만 한다
			}
		};
		img.onload = () => {
			if (!alive) return;
			draw();
			report.current('ok');
		};
		img.onerror = () => alive && report.current('fail');
		img.src = src;
		let frame = 0;
		const observer =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(() => {
						cancelAnimationFrame(frame);
						frame = requestAnimationFrame(draw);
					});
		observer?.observe(box);
		return () => {
			alive = false;
			cancelAnimationFrame(frame);
			observer?.disconnect();
			img.onload = null;
			img.onerror = null;
		};
	}, [src]);
	return <canvas ref={ref} className="dl-pixel-canvas" />;
};

const place = (item: { left?: string; right?: string }) => (item.left ? { left: item.left } : { right: item.right });

/**
 * 배경: 하늘(또는 벽)과 하늘의 것들, 바닥, 지평선 띠와 가장자리 소품.
 * pixelSrc가 있으면 그 그림을 픽셀로 바꿔 하늘 자리에 깐다 (테마의 바닥·소품은 그 위에, 벽 띠는 접는다)
 */
export const Backdrop: React.FC<{
	theme: BackdropTheme;
	pixelSrc?: string;
	onPixel: (src: string, state: 'ok' | 'fail') => void;
}> = ({ theme, pixelSrc, onPixel }) => {
	const scene = theme === 'auto' ? { sky: CLOUDS } : SCENES[theme];
	return (
		<>
			<div className="dl-sky" aria-hidden="true">
				{theme === 'space' && !pixelSrc && (
					<>
						<div className="dl-stars" style={{ backgroundImage: STARS }} />
						<div className="dl-stars dl-twinkle" style={{ backgroundImage: TWINKLE }} />
					</>
				)}
				{!pixelSrc &&
					scene.sky?.map((item, i) => (
						<Pixel
							key={i}
							art={item.art}
							scale={item.scale}
							className={`dl-sky-item ${item.className ?? ''}`}
							style={{ ...place(item), top: item.top }}
						/>
					))}
				{pixelSrc && (
					<div className="dl-pixel">
						<PixelImage key={pixelSrc} src={pixelSrc} onState={(state) => onPixel(pixelSrc, state)} />
					</div>
				)}
			</div>
			<div
				className="dl-ground"
				aria-hidden="true"
				style={{
					...(TILE_URL[theme] ? { ['--dl-tile' as string]: TILE_URL[theme] } : {}),
					...(theme === 'sea' ? SEA_VARS : {}),
				}}
			/>
			<div className="dl-props" aria-hidden="true">
				{scene.band && !(pixelSrc && scene.band.wall) && (
					<Pixel art={scene.band.art} scale={scene.band.scale} className="dl-band" />
				)}
				{theme === 'office' && !pixelSrc && (
					<>
						<Pixel art={S.WINDOW} scale={4} className="dl-window" style={{ left: '1.5%' }} />
						<Pixel art={S.WINDOW} scale={4} className="dl-window" style={{ right: '1.5%' }} />
					</>
				)}
				{theme === 'sea' && (
					<div className="dl-sea" style={SEA_VARS}>
						<i />
						<i />
						<i />
					</div>
				)}
				{theme === 'space' && <div className="dl-rail" />}
				{theme === 'office' && <div className="dl-wainscot" />}
				{scene.props?.map((prop, i) => (
					<span
						key={i}
						className={`dl-prop ${prop.className ?? ''}`}
						style={{ ...place(prop), bottom: prop.bottom ?? 0 }}
						data-flip={prop.flip || undefined}
					>
						{prop.glow && (
							<i
								className="dl-glow"
								style={{
									left: `${prop.glow.x}%`,
									top: `${prop.glow.y}%`,
									width: prop.glow.size,
									height: prop.glow.size,
								}}
							/>
						)}
						{prop.art ? (
							<Pixel art={prop.art} scale={prop.scale} />
						) : (
							<img src={prop.img} alt="" style={{ ['--dl-scale' as string]: prop.scale }} />
						)}
					</span>
				))}
			</div>
		</>
	);
};
