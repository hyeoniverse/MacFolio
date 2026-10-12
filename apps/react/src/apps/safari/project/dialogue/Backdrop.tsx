// dialogue 모양의 배경 장면: 테마마다 하늘(벽)·지평선 띠·바닥·가장자리 소품, 배경 그림의 픽셀화.
// 모두 장식(aria-hidden)이고 대화 상자·장면 액자·HUD 뒤에 깔린다
import React, { useEffect, useRef } from 'react';
import type { BackdropTheme } from '@macfolio/desktop-core/site';
import { artUrl, quantize, type Art } from './pixelArt';
import { Pixel } from './Pixel';
import * as S from './sprites';
import * as I from './spritesIndoor';
import * as O from './spritesOutdoor';
import './Backdrop.css';

/** 가장자리 소품 하나: 왼쪽이나 오른쪽에서 몇 %, 바닥에서 몇 px, 칸 크기 */
interface Prop {
	art?: Art;
	img?: string;
	scale: number;
	left?: string;
	right?: string;
	bottom?: number;
	/** 불빛 (소품 안에서의 자리 %, 지름 px, 빛깔) */
	glow?: { x: number; y: number; size: number; tone?: 'warm' | 'cyan' | 'red' | 'pink' };
	/** 벽에 걸린 것: 배경 그림을 깔면(벽이 그림으로 바뀌면) 접는다 */
	wall?: boolean;
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
	/** 별 하늘 (반짝임 층 포함) */
	stars?: boolean;
	/** 지평선을 따라 가로로 이어지는 그림 */
	band?: { art: Art; scale: number; wall?: boolean };
	/** 지평선에 붙는 CSS 띠 (난간·벽 판넬·바다·아지랑이): .dl-props 안의 빈 div, 모양은 CSS */
	strips?: string[];
	/** 소품 위를 덮는 CSS 층 (햇살·눈): 대화 상자·액자·HUD 아래 */
	overlay?: string;
	props?: Prop[];
	/** 바닥 무늬 타일 */
	tile?: { art: Art; scale: number };
	/** 장면이 쓰는 CSS 변수 (반복 무늬 주소) */
	vars?: Record<string, string>;
}

const CABINET_PINK = I.arcadeCabinet('#c0408a', '#8a2a66', '#ffd84a');
const CABINET_BLUE = I.arcadeCabinet('#3a5ad0', '#26388a', '#7ad0ff');

const sprout = (name: string) => `/imgs/projects/sproutfarm/sprites/${name}.png`;

const CLOUDS: SkyItem[] = [
	{ art: S.CLOUD, scale: 4, left: '7%', top: '10%', className: 'dl-drift' },
	{ art: S.CLOUD_SMALL, scale: 4, left: '30%', top: '20%', className: 'dl-drift slow' },
	{ art: S.CLOUD, scale: 5, right: '22%', top: '6%', className: 'dl-drift slow' },
	{ art: S.CLOUD_SMALL, scale: 4, right: '6%', top: '24%', className: 'dl-drift' },
];

/** 반딧불: 숲 띠 앞, 땅 위 여기저기에서 천천히 깜빡인다 */
const FIREFLIES: Prop[] = (
	[
		['5%', 96, ''],
		['12%', 140, 'b'],
		['18.5%', 64, 'c'],
		['24%', 120, 'b'],
		['27%', 40, ''],
	] as const
).flatMap(([x, bottom, delay], i) => [
	{ art: O.FIREFLY, scale: 4, left: x, bottom, className: `dl-firefly ${delay}` },
	{ art: O.FIREFLY, scale: 4, right: x, bottom: bottom + (i % 2 ? -20 : 24), className: `dl-firefly ${delay || 'c'}` },
]);

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
		tile: { art: S.TILES.town, scale: 3 },
		props: [
			{ art: S.LAMP, scale: 4, left: '3%', glow: { x: 50, y: 16, size: 112 } },
			{ art: S.BENCH, scale: 4, left: '7.5%' },
			{ art: S.TREE_POT, scale: 5, right: '10%' },
			{ art: S.POSTBOX, scale: 4, right: '7%' },
			{ art: S.LAMP, scale: 4, right: '2%', glow: { x: 50, y: 16, size: 112 } },
		],
	},
	office: {
		strips: ['dl-wainscot'],
		tile: { art: S.TILES.office, scale: 3 },
		props: [
			{ art: S.WINDOW, scale: 4, left: '1.5%', bottom: 112, wall: true },
			{ art: S.WINDOW, scale: 4, right: '1.5%', bottom: 112, wall: true },
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
		tile: { art: S.TILES.library, scale: 4 },
		props: [
			{ art: S.LADDER, scale: 4, left: '9%' },
			{ art: S.BOOKS, scale: 4, left: '2%' },
			{ art: S.GLOBE, scale: 4, right: '12%' },
			{ art: S.FLOOR_LAMP, scale: 4, right: '3%', glow: { x: 50, y: 18, size: 190 } },
		],
	},
	space: {
		stars: true,
		sky: [
			{ art: S.PLANET, scale: 4, right: '4%', top: '24%', className: 'dl-float' },
			{ art: S.MOON, scale: 4, left: '17%', top: '30%', className: 'dl-float slow' },
		],
		strips: ['dl-rail'],
		tile: { art: S.TILES.space, scale: 4 },
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
		strips: ['dl-sea'],
		tile: { art: S.TILES.sea, scale: 3 },
		vars: { '--dl-wave': artUrl(S.WAVE, 3), '--dl-foam': artUrl(S.FOAM, 3) },
		props: [
			{ art: S.PALM, scale: 3, left: '1%' },
			{ art: S.CRAB, scale: 3, left: '12%', className: 'dl-crab' },
			{ art: S.UMBRELLA, scale: 4, right: '13%' },
			{ art: S.LIGHTHOUSE, scale: 3, right: '3%', glow: { x: 50, y: 18, size: 90 } },
		],
	},
	forest: {
		band: { art: O.PINES, scale: 4 },
		overlay: 'dl-rays',
		tile: { art: O.FOREST_TILE, scale: 4 },
		props: [
			{ art: O.PINE_NEAR, scale: 4, left: '0.5%' },
			{ art: O.LOG, scale: 4, left: '7%' },
			{ art: O.MUSHROOMS, scale: 3, left: '15%' },
			{ art: O.FERN, scale: 4, right: '15%' },
			{ art: O.STUMP, scale: 4, right: '8.5%' },
			{ art: O.PINE_SMALL, scale: 4, right: '4.5%' },
			{ art: O.PINE_NEAR, scale: 4, right: '0.5%' },
			...FIREFLIES,
		],
	},
	snow: {
		band: { art: O.PEAKS, scale: 4 },
		overlay: 'dl-snow',
		tile: { art: O.SNOW_TILE, scale: 3 },
		vars: {
			'--dl-flakes': [artUrl(O.flakeTile(5, 48, 14, 0), 3), artUrl(O.flakeTile(13, 64, 22, 0), 2)].join(', '),
			'--dl-flakes-big': artUrl(O.flakeTile(29, 50, 3, 5), 4),
		},
		props: [
			{ art: O.SMOKE, scale: 3, left: 'calc(1% + 84px)', bottom: 116, className: 'dl-smoke' },
			{ art: O.SMOKE, scale: 3, left: 'calc(1% + 84px)', bottom: 116, className: 'dl-smoke late' },
			{ art: O.CABIN, scale: 4, left: '1%' },
			{ art: O.FIR_SNOW_SMALL, scale: 4, left: '11%' },
			{ art: O.SNOWMAN, scale: 4, right: '12%' },
			{ art: O.FIR_SNOW_SMALL, scale: 4, right: '6.5%' },
			{ art: O.FIR_SNOW, scale: 4, right: '1%' },
		],
	},
	cafe: {
		sky: [
			{ art: I.CAFE_PENDANT, scale: 4, left: '27%', top: '0' },
			{ art: I.CAFE_PENDANT, scale: 4, right: '27%', top: '0' },
		],
		strips: ['dl-wainscot'],
		tile: { art: I.TERRACOTTA_TILE, scale: 3 },
		vars: { '--dl-wall': artUrl(I.BRICK_TILE, 4) },
		props: [
			{ art: I.MENU_BOARD, scale: 3, right: '13%', bottom: 76, wall: true },
			{ art: I.COUNTER, scale: 4, left: '0.5%' },
			{ art: I.STEAM, scale: 3, right: 'calc(7% + 36px)', bottom: 72, className: 'dl-steam' },
			{ art: I.CAFE_TABLE, scale: 4, right: '7%' },
			{ art: I.FIDDLE, scale: 4, right: '0.5%' },
		],
	},
	classroom: {
		strips: ['dl-wainscot'],
		tile: { art: I.OAK_TILE, scale: 3 },
		props: [
			{ art: I.CHALKBOARD, scale: 3, left: '1.5%', bottom: 46, wall: true },
			{ art: I.CLASS_WINDOW, scale: 3, right: '2%', bottom: 50, wall: true },
			{ art: I.TIMETABLE, scale: 3, right: '10.5%', bottom: 58, wall: true },
			{ art: I.SCHOOL_DESK, scale: 4, left: '1%' },
			{ art: I.SCHOOL_DESK, scale: 4, left: '10%' },
			{ art: I.CABINET, scale: 4, right: '17%' },
			{ art: S.GLOBE, scale: 4, right: 'calc(17% + 8px)', bottom: 48 },
			{ art: I.SPIDER_PLANT, scale: 4, right: '4%' },
		],
	},
	lab: {
		strips: ['dl-wainscot'],
		tile: { art: I.LAB_TILE, scale: 3 },
		props: [
			{ art: I.LAB_SHELF, scale: 3, left: '17%', bottom: 64, wall: true },
			{ art: I.LAB_BENCH, scale: 4, left: '0.5%' },
			{ art: I.BUBBLES, scale: 3, left: 'calc(0.5% + 58px)', bottom: 112, className: 'dl-bubble' },
			{ art: I.EXTINGUISHER, scale: 4, right: '16%' },
			{ art: I.LAB_DESK, scale: 4, right: '1%' },
			{
				art: I.GRAPH_MONITOR,
				scale: 4,
				right: 'calc(1% + 48px)',
				bottom: 40,
				glow: { x: 50, y: 40, size: 100, tone: 'cyan' },
			},
			{ art: I.MICROSCOPE, scale: 4, right: 'calc(1% + 6px)', bottom: 40 },
		],
	},
	arcade: {
		band: { art: I.CABINET_ROW, scale: 4, wall: true },
		tile: { art: I.CHECK_TILE, scale: 4 },
		props: [
			{ art: I.NEON_GAME, scale: 4, left: '22%', bottom: 100, wall: true, className: 'dl-neon pink' },
			{ art: I.NEON_STAR, scale: 4, right: '23%', bottom: 112, wall: true, className: 'dl-neon cyan' },
			{ art: CABINET_PINK, scale: 4, left: '1%', glow: { x: 45, y: 33, size: 120, tone: 'cyan' } },
			{ art: CABINET_BLUE, scale: 4, left: '7.5%', glow: { x: 45, y: 33, size: 120, tone: 'pink' } },
			{ art: I.STOOL, scale: 4, left: '14%' },
			{ art: I.STOOL, scale: 4, right: '15%' },
			{ art: I.CLAW, scale: 4, right: '1.5%', glow: { x: 50, y: 30, size: 150, tone: 'pink' } },
		],
	},
	rooftop: {
		stars: true,
		sky: [{ art: O.CRESCENT, scale: 4, right: '25%', top: '6%', className: 'dl-float slow' }],
		band: { art: O.NIGHT_CITY, scale: 4, wall: true },
		strips: ['dl-railing'],
		tile: { art: O.CONCRETE_TILE, scale: 3 },
		props: [
			{ art: O.WATER_TANK, scale: 4, left: '1%' },
			{ art: O.STRING_LIGHTS, scale: 3, left: 'calc(1% + 92px)', className: 'dl-bulbs' },
			{ art: O.VENT, scale: 4, right: '15%' },
			{ art: O.AC_UNIT, scale: 4, right: '7.5%' },
			{ art: O.ANTENNA, scale: 4, right: '2%', glow: { x: 50, y: 3, size: 48, tone: 'red' }, className: 'dl-beacon' },
		],
	},
	desert: {
		sky: [
			{ art: S.STREAK, scale: 4, left: '8%', top: '20%', className: 'dl-drift slow' },
			{ art: S.STREAK, scale: 5, right: '9%', top: '14%', className: 'dl-drift' },
		],
		band: { art: O.DUNES, scale: 4 },
		strips: ['dl-haze'],
		tile: { art: O.SAND_TILE, scale: 3 },
		props: [
			{ art: O.SAGUARO, scale: 4, left: '2%' },
			{ art: O.SKULL, scale: 3, left: '9%' },
			{ art: O.BARREL_CACTUS, scale: 4, left: '14%' },
			{ art: O.TUMBLEWEED, scale: 3, right: '20%', className: 'dl-tumble' },
			{ art: O.ROCKS, scale: 4, right: '10%' },
			{ art: O.SAGUARO, scale: 3, right: '2.5%' },
		],
	},
};

const STARS = [artUrl(S.starTile(3, 90, 26, 1), 2), artUrl(S.starTile(9, 70, 12, 2), 3)].join(', ');
const TWINKLE = artUrl(S.starTile(17, 80, 0, 3), 3);

/** 그림을 장면 크기에 맞춰 아주 작게 그린 뒤(칸 하나 = 8px) 픽셀 그대로 키워 보인다. 못 불러오면 onFail */
const PIXEL_CELL = 8;

/** 픽셀로 바꾼 그림의 색 수 (팔레트 크기) */
const PALETTE_SIZE = 20;

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
			// 색 수를 몇 가지 팔레트로 줄여 픽셀 그림답게. 다른 출처 그림이면 읽기가 막혀 그대로 둔다
			try {
				const data = ctx.getImageData(0, 0, cols, rows);
				quantize(data.data, PALETTE_SIZE);
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

/** 테마마다 한 번만 만든다: 바닥 타일 주소와 장면 CSS 변수 */
const VARS = Object.fromEntries(
	Object.entries(SCENES).map(([theme, scene]) => [
		theme,
		{ ...(scene.tile ? { '--dl-tile': artUrl(scene.tile.art, scene.tile.scale) } : {}), ...scene.vars },
	])
) as Record<string, React.CSSProperties>;

/**
 * 배경: 하늘(또는 벽)과 하늘의 것들, 바닥, 지평선 띠와 가장자리 소품.
 * pixelSrc가 있으면 그 그림을 픽셀로 바꿔 하늘 자리에 깐다 (테마의 바닥·소품은 그 위에, 벽 띠·벽 소품은 접는다).
 * auto면 바닥도 없이 그림이 화면 전체를 덮는다 (아래로 갈수록 어둡게 바래 대화 상자 글이 읽힌다)
 */
export const Backdrop: React.FC<{
	theme: BackdropTheme;
	pixelSrc?: string;
	onPixel: (src: string, state: 'ok' | 'fail') => void;
}> = ({ theme, pixelSrc, onPixel }) => {
	const scene: Scene = theme === 'auto' ? { sky: CLOUDS } : SCENES[theme];
	const vars = VARS[theme];
	const fullPixel = theme === 'auto' && !!pixelSrc;
	return (
		<>
			<div className="dl-sky" aria-hidden="true" style={vars}>
				{scene.stars && !pixelSrc && (
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
					<div className="dl-pixel" data-full={fullPixel || undefined}>
						<PixelImage key={pixelSrc} src={pixelSrc} onState={(state) => onPixel(pixelSrc, state)} />
					</div>
				)}
			</div>
			{!fullPixel && <div className="dl-ground" aria-hidden="true" style={vars} />}
			<div className="dl-props" aria-hidden="true" style={vars}>
				{scene.band && !(pixelSrc && scene.band.wall) && (
					<Pixel art={scene.band.art} scale={scene.band.scale} className="dl-band" />
				)}
				{scene.strips?.map((strip) => (
					<div key={strip} className={strip}>
						{strip === 'dl-sea' && (
							<>
								<i />
								<i />
								<i />
							</>
						)}
					</div>
				))}
				{scene.props?.map((prop, i) =>
					prop.wall && pixelSrc ? null : (
						<span
							key={i}
							className={`dl-prop ${prop.className ?? ''}`}
							style={{ ...place(prop), bottom: prop.bottom ?? 0 }}
						>
							{prop.glow && (
								<i
									className="dl-glow"
									data-tone={prop.glow.tone}
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
					)
				)}
			</div>
			{scene.overlay && <div className={`dl-overlay ${scene.overlay}`} aria-hidden="true" style={vars} />}
		</>
	);
};
