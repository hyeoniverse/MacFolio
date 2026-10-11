// dialogue 모양 배경 장면의 픽셀 소품과 띠(스카이라인·책장·언덕). 모두 장식이다
import { disc, fromRows, seeded, type Art, type Px } from './pixelArt';

// ─── 하늘 ───────────────────────────────────────────────────────────────

export const CLOUD = fromRows(
	[
		'.......wwww.........',
		'.....wwwwwwwww......',
		'..wwwwwwwwwwwwwww...',
		'.wwwwwwwwwwwwwwwwww.',
		'wwwwwwwwwwwwwwwwwwww',
		'.ssssssssssssssssss.',
	],
	{ w: '#ffffff', s: '#d8ecfa' }
);

export const CLOUD_SMALL = fromRows(['....wwww....', '..wwwwwwww..', 'wwwwwwwwwwww', '.ssssssssss.'], {
	w: '#ffffff',
	s: '#d8ecfa',
});

/** 노을 하늘의 길쭉한 구름 */
export const STREAK = fromRows(['......pppppppp..........', '..pppppppppppppppppp....', 'ssssssssssssssssssssssss'], {
	p: '#f7a98c',
	s: '#d9707a',
});

export const GULL = fromRows(['kk...kk', '.kk.kk.', '...k...'], { k: '#3d4a5c' });

/** 바다의 해 */
export const SUN = (() => {
	const r = 11;
	return {
		w: r * 2 + 1,
		h: r * 2 + 1,
		px: disc(r, r, r, (dx, dy) => (dx * dx + dy * dy > (r - 2) * (r - 2) ? '#ffd76a' : '#fff4c2')),
	} satisfies Art;
})();

/** 우주의 고리 행성: 띠 무늬, 오른쪽 아래 그늘, 뒤쪽 고리는 행성 뒤로 */
export const PLANET = (() => {
	const r = 20;
	const ringW = 34;
	const cx = ringW + 1;
	const cy = r + 4;
	const bands = ['#f2b880', '#e39a62', '#f6c995', '#d07b4c', '#eeae78', '#c96b42', '#f0bd88'];
	const ring = (front: boolean): Px[] => {
		const out: Px[] = [];
		for (let x = -ringW; x <= ringW; x++) {
			const t = x / ringW;
			const dy = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 7);
			const y = front ? dy : -dy;
			// 앞 고리는 행성 아래쪽 절반, 뒤 고리는 위쪽 절반
			if (front ? y < 0 : y > 0) continue;
			out.push([Math.abs(x) % 5 === 0 ? '#b99764' : '#ead7a8', cx + x, cy + y - 1, 1, 2]);
		}
		return out;
	};
	const body = disc(cx, cy, r, (dx, dy) => {
		const band = bands[Math.floor(((dy + r) / (2 * r + 1)) * bands.length)];
		// 오른쪽 아래가 그늘
		if (dx + dy * 0.6 > r * 0.55) return '#8e4a35';
		if (dx * dx + dy * dy < 30 && dx < 0 && dy < 0) return '#ffe2b8';
		return band;
	});
	return { w: cx * 2 + 1, h: cy * 2 + 2, px: [...ring(false), ...body, ...ring(true)] } satisfies Art;
})();

export const MOON = (() => {
	const r = 8;
	const craters = new Set(['-3,-2', '-2,-2', '2,1', '3,1', '2,2', '-1,4', '0,4', '4,-4']);
	return {
		w: r * 2 + 1,
		h: r * 2 + 1,
		px: disc(r, r, r, (dx, dy) => (craters.has(`${dx},${dy}`) ? '#9aa0b4' : dx + dy > r * 0.7 ? '#9399ad' : '#d6d9e4')),
	} satisfies Art;
})();

// ─── 띠: 지평선을 따라 화면 너비만큼 ────────────────────────────────────────

/** 띠의 너비(칸). 4px 칸이면 2400px — 아주 넓은 화면도 덮는다 */
export const BAND_W = 600;

/** 농장: 겹친 초록 언덕 두 줄 */
export const HILLS = (() => {
	const h = 34;
	const px: Px[] = [];
	const ridge = (height: (x: number) => number, fill: string, top: string) => {
		let start = 0;
		let last = height(0);
		for (let x = 1; x <= BAND_W; x++) {
			const now = x < BAND_W ? height(x) : -1;
			if (now !== last) {
				px.push([top, start, h - last, x - start, 1], [fill, start, h - last + 1, x - start, last - 1]);
				start = x;
				last = now;
			}
		}
	};
	const step = (v: number) => Math.round(v / 2) * 2;
	ridge((x) => step(24 + 6 * Math.sin(x / 31) + 4 * Math.sin(x / 13 + 1)), '#a6d98c', '#bfe6a6');
	ridge((x) => step(12 + 5 * Math.sin(x / 19 + 2) + 3 * Math.sin(x / 7)), '#74c25a', '#8fd472');
	// 앞 언덕의 덤불 점
	const rand = seeded(7);
	for (let x = 4; x < BAND_W; x += 9 + Math.floor(rand() * 14))
		px.push(['#5aa646', x, h - 4 - Math.floor(rand() * 4), 3, 2]);
	return { w: BAND_W, h, px } satisfies Art;
})();

/** 도시: 노을 해와 먼 건물, 창마다 불이 켜진 가까운 건물 */
export const SKYLINE = (() => {
	const h = 84;
	const rand = seeded(11);
	const px: Px[] = [];
	// 해: 지평선에 반쯤 걸친 줄무늬 해 (아래로 갈수록 줄이 굵다)
	px.push(
		...disc(452, h - 12, 24, (dx, dy) => {
			if (dy > 2 && (dy + 24) % 5 < 1 + Math.floor(dy / 7)) return null;
			return dy < -12 ? '#ffe9a3' : dy < 2 ? '#ffc66e' : '#ff9a5c';
		})
	);
	let x = -4;
	while (x < BAND_W) {
		const w = 8 + Math.floor(rand() * 14);
		const bh = 30 + Math.floor(rand() * 42);
		px.push(['#5b3470', x, h - bh, w, bh]);
		if (rand() < 0.25) px.push(['#5b3470', x + Math.floor(w / 2), h - bh - 6, 1, 6]);
		x += w + (rand() < 0.3 ? 2 : 0);
	}
	x = -2;
	while (x < BAND_W) {
		const w = 10 + Math.floor(rand() * 14);
		const bh = 14 + Math.floor(rand() * 32);
		const top = h - bh;
		px.push(['#2a1c3b', x, top, w, bh]);
		// 지붕: 계단 꼴이나 물탱크
		const roof = rand();
		if (roof < 0.3) px.push(['#2a1c3b', x + 2, top - 3, w - 4, 3]);
		else if (roof < 0.45) px.push(['#2a1c3b', x + w - 6, top - 5, 4, 5], ['#2a1c3b', x + w - 7, top - 1, 6, 1]);
		// 창: 2칸 간격, 몇 개만 불이 켜져 있다
		for (let wy = top + 3; wy < h - 3; wy += 4)
			for (let wx = x + 2; wx < x + w - 2; wx += 3) {
				const lit = rand();
				if (lit < 0.3) px.push([lit < 0.04 ? '#9fd8ff' : lit < 0.09 ? '#ff9f68' : '#ffd77a', wx, wy, 1, 2]);
				else if (lit < 0.45) px.push(['#3d2b52', wx, wy, 1, 2]);
			}
		x += w + (rand() < 0.4 ? 1 : 0);
	}
	return { w: BAND_W, h, px } satisfies Art;
})();

/** 도서관: 벽 너비만큼 이어진 책장 세 칸 (책등 색 띠) */
export const SHELVES = (() => {
	const rowH = 20;
	const rows = 3;
	const h = 5 + rows * rowH + 2;
	const rand = seeded(23);
	const spines = [
		'#8c2f39',
		'#b5523b',
		'#2f5d62',
		'#3b6e8f',
		'#c9a227',
		'#6b8f4e',
		'#5b4a8a',
		'#d8c3a5',
		'#7a3b2e',
		'#2e4057',
		'#a86b3c',
	];
	const px: Px[] = [
		['#2b170b', 0, 0, BAND_W, h],
		// 위 장식 띠
		['#6e4424', 0, 0, BAND_W, 3],
		['#93603a', 0, 0, BAND_W, 1],
		['#4a2b15', 0, 3, BAND_W, 2],
	];
	for (let r = 0; r < rows; r++) {
		const floor = 5 + (r + 1) * rowH;
		// 칸 나누기 기둥
		for (let x = 0; x < BAND_W; x += 50) px.push(['#5a361c', x, floor - rowH, 2, rowH]);
		let x = 3;
		while (x < BAND_W - 4) {
			if (x % 50 >= 48) {
				x = Math.ceil(x / 50) * 50 + 3;
				continue;
			}
			const pick = rand();
			if (pick < 0.06) {
				x += 2 + Math.floor(rand() * 3);
				continue;
			}
			if (pick < 0.12) {
				// 눕혀 쌓은 책
				const w = 7 + Math.floor(rand() * 3);
				if ((x % 50) + w >= 48) {
					x += 1;
					continue;
				}
				for (let i = 0; i < 3; i++) {
					const color = spines[Math.floor(rand() * spines.length)];
					px.push(
						[color, x + (i % 2), floor - 2 - i * 2, w - 1, 2],
						['#f0e2c4', x + w - 1 + (i % 2) - 1, floor - 2 - i * 2, 1, 2]
					);
				}
				x += w + 1;
				continue;
			}
			const w = 2 + Math.floor(rand() * 3);
			const bh = rowH - 3 - Math.floor(rand() * 7);
			const color = spines[Math.floor(rand() * spines.length)];
			px.push([color, x, floor - bh, w, bh]);
			// 책등의 금박 띠
			if (rand() < 0.55) px.push(['#e8c26a', x, floor - bh + 2, w, 1]);
			if (rand() < 0.35) px.push(['rgba(0,0,0,0.28)', x, floor - 4, w, 1]);
			// 오른쪽 그늘
			px.push(['rgba(0,0,0,0.22)', x + w - 1, floor - bh, 1, bh]);
			x += w;
		}
		// 선반 판
		px.push(['#7a4b28', 0, floor, BAND_W, 2], ['#9a6436', 0, floor, BAND_W, 1]);
	}
	px.push(['#4a2b15', 0, h - 2, BAND_W, 2]);
	return { w: BAND_W, h, px } satisfies Art;
})();

// ─── 소품: 화면 가장자리에 선다 ────────────────────────────────────────────

export const LAMP = fromRows(
	[
		'.....k.....',
		'....kkk....',
		'..kkkkkkk..',
		'.kkmmmmmkk.',
		'.kyYYYYYyk.',
		'.kyYYYYYyk.',
		'.kyyYYYyyk.',
		'..kkkkkkk..',
		'....kmk....',
		'....kmk....',
		'...kkkkk...',
		...Array.from({ length: 24 }, () => '....kmk....'),
		'...kkmkk...',
		'..kkkkkkk..',
		'..kkkkkkk..',
	],
	{ k: '#2a1f33', m: '#4d3f5c', y: '#ffcf5c', Y: '#fff2c0' }
);

export const BENCH = fromRows(
	[
		'kkkkkkkkkkkkkkkkkkkkkk',
		'kwwwwwwwwwwwwwwwwwwwwk',
		'kWWWWWWWWWWWWWWWWWWWWk',
		'.k..................k.',
		'kkkkkkkkkkkkkkkkkkkkkk',
		'kwwwwwwwwwwwwwwwwwwwwk',
		'kWWWWWWWWWWWWWWWWWWWWk',
		'.kk................kk.',
		'.kk................kk.',
		'.kk................kk.',
	],
	{ k: '#2a1f33', w: '#b8693a', W: '#8a4a28' }
);

export const POSTBOX = fromRows(
	[
		'..rrrrrr..',
		'.rRRRRRRr.',
		'rRRhRRRRRr',
		'rRkkkkkkRr',
		'rRRRRRRRRr',
		'rRRhRRRRRr',
		'rRRRRRRRRr',
		'rRRRRwwRRr',
		'rRRRRRRRRr',
		'rrrrrrrrrr',
		'.kk....kk.',
		'.kk....kk.',
	],
	{ r: '#8e1f24', R: '#d23a35', h: '#f06a5a', k: '#2a1f33', w: '#ffe9c4' }
);

export const TREE_POT = fromRows(
	[
		'.....gggg.....',
		'...gGGGGGGg...',
		'..gGGhGGGGGg..',
		'.gGGGGGGhGGGg.',
		'gGhGGGGGGGGGGg',
		'gGGGGGGhGGGGGg',
		'.gGGGGGGGGGgg.',
		'..ggGGGGGGgg..',
		'....ggttgg....',
		'......tt......',
		'......tt......',
		'..pppppppppp..',
		'..pPPPPPPPPp..',
		'...pPPPPPPp...',
		'...pppppppp...',
	],
	{ g: '#2f6b3a', G: '#4c9a4f', h: '#7cc46a', t: '#5a3a22', p: '#6b5a50', P: '#8f7c70' }
);

/** 사무실 창: 블라인드를 반쯤 내린 큰 창과 바깥 하늘·먼 건물 */
export const WINDOW = (() => {
	const w = 44;
	const px: Px[] = [['#f4f1ea', 0, 0, w, 46]];
	const glass: Px[] = [];
	const skyRows = ['#8fcdee', '#9dd4f0', '#acdaf2', '#bce1f4', '#cbe8f6', '#d8eef8'];
	for (const [gx, gy, gw, gh] of [
		[2, 2, 19, 44],
		[23, 2, 19, 44],
	]) {
		skyRows.forEach((fill, i) => {
			const rowH = Math.ceil(gh / skyRows.length);
			glass.push([fill, gx, gy + i * rowH, gw, Math.min(rowH, gh - i * rowH)]);
		});
		// 먼 건물
		const rand = seeded(gx + 3);
		for (let x = gx; x < gx + gw;) {
			const bw = 3 + Math.floor(rand() * 4);
			const bh = 6 + Math.floor(rand() * 12);
			glass.push(['#a7bfd2', x, gy + gh - bh, Math.min(bw, gx + gw - x), bh]);
			x += bw;
		}
		// 블라인드: 위쪽 40%에 가로 살
		for (let y = gy; y < gy + 18; y += 2) glass.push(['#efe8da', gx, y, gw, 1], ['#cdc4b2', gx, y + 1, gw, 1]);
		glass.push(['#b8ad98', gx, gy + 18, gw, 1]);
	}
	px.push(...glass);
	// 블라인드 줄
	px.push(['#8d8270', 12, 20, 1, 8], ['#8d8270', 33, 20, 1, 5]);
	// 창틀 그림자와 창턱
	px.push(
		['#d9d3c6', 0, 0, w, 1],
		['#c9c2b3', 21, 2, 2, 44],
		['#e6e1d6', -2, 46, w + 4, 3],
		['#9aa8b0', -2, 49, w + 4, 1]
	);
	return { w: w + 4, h: 50, px: px.map(([f, x, y, pw, ph]) => [f, x + 2, y, pw, ph] as Px) } satisfies Art;
})();

/** 사무실 책상 모서리: 코드가 떠 있는 모니터, 머그잔, 작은 화분 */
export const DESK = (() => {
	const px: Px[] = [];
	// 모니터
	px.push(['#23262e', 3, 0, 26, 16], ['#1b2b44', 4, 1, 24, 13]);
	const rand = seeded(5);
	for (let y = 3; y < 13; y += 2) {
		const indent = Math.floor(rand() * 3) * 2;
		const len = 5 + Math.floor(rand() * 12);
		px.push([
			rand() < 0.4 ? '#f6c177' : rand() < 0.5 ? '#9ccfd8' : '#c4a7e7',
			6 + indent,
			y,
			Math.min(len, 20 - indent),
			1,
		]);
	}
	px.push(['#3a3f4a', 14, 16, 4, 3], ['#3a3f4a', 10, 18, 12, 1]);
	// 머그잔
	px.push(
		['#f2ede4', 33, 14, 4, 5],
		['#c9c2b6', 36, 14, 1, 5],
		['#f2ede4', 37, 15, 2, 1],
		['#f2ede4', 38, 15, 1, 3],
		['#6b4329', 33, 14, 4, 1]
	);
	// 작은 화분
	px.push(['#4c9a4f', 41, 12, 2, 3], ['#2f6b3a', 43, 11, 2, 4], ['#7cc46a', 40, 14, 2, 1], ['#c9673e', 40, 16, 6, 3]);
	// 책상 상판과 다리, 서랍
	px.push(['#8a5a3b', 0, 19, 48, 2], ['#a87452', 0, 19, 48, 1], ['#6b4329', 0, 21, 48, 1]);
	px.push(
		['#5c3a24', 2, 22, 3, 14],
		['#7a4e32', 32, 22, 14, 14],
		['#5c3a24', 32, 28, 14, 1],
		['#d9b26a', 37, 25, 4, 1],
		['#d9b26a', 37, 31, 4, 1]
	);
	return { w: 48, h: 36, px } satisfies Art;
})();

export const MONSTERA = fromRows(
	[
		'.......gg.........',
		'.....gGGGg...gg...',
		'....gGGgGGg.gGGg..',
		'...gGGg.gGg.gGGGg.',
		'..gGg...gG.gGGgGGg',
		'.gGg.gg.gGgGGg.gg.',
		'.gg.gGGg.gGGg.....',
		'...gGGGGggGg..gg..',
		'..gGg.gGGgg..gGGg.',
		'..gg...gGg..gGgGGg',
		'.......gg.gGGg..gg',
		'..gg...g..gGg.....',
		'.gGGg..g.gGg......',
		'gGgGGg.g.gg.......',
		'gg..gGgg.g........',
		'.....ggg.g........',
		'.......g.g........',
		'.......ggg........',
		'....pppppppppp....',
		'....pPPPPPPPPp....',
		'.....pPPPPPPp.....',
		'.....pPPPPPPp.....',
		'......pPPPPp......',
		'......pppppp......',
	],
	{ g: '#2f6b3a', G: '#56a85a', p: '#a8502e', P: '#c9673e' }
);

export const COOLER = fromRows(
	[
		'...bbbbbb...',
		'..bBBBBBBb..',
		'..bBBcBBBb..',
		'..bBBBBBBb..',
		'..bBBBBBBb..',
		'...bbbbbb...',
		'..kkkkkkkk..',
		'..kwwwwwwk..',
		'..kwrwwbwk..',
		'..kwwwwwwk..',
		'..kwWWWWwk..',
		'..kwwwwwwk..',
		'..kwwwwwwk..',
		'..kwwwwwwk..',
		'..kwwwwwwk..',
		'..kkkkkkkk..',
	],
	{ b: '#4f8fc0', B: '#8cc7ec', c: '#d8f0ff', k: '#5a6270', w: '#eef0f2', W: '#c8ccd2', r: '#d0473d' }
);

export const GLOBE = fromRows(
	[
		'.....kkkk.....',
		'...kbbgbbbk...',
		'..kbggbbbbbk..',
		'.mkbbgggbbbk..',
		'.mkbbbbggbbbk.',
		'.mkbbbbbbgbbk.',
		'.mkbbbbbbbbk..',
		'..mkbbbbbggk..',
		'...mkbbbbbk...',
		'....mmkkkk....',
		'......mm......',
		'.....mmmm.....',
		'......kk......',
		'......kk......',
		'....kkkkkk....',
		'...kkkkkkkk...',
	],
	{ k: '#2a1a0e', b: '#3f7fb0', g: '#7ab05e', m: '#c9a14a' }
);

export const BOOKS = fromRows(
	[
		'..rrrrrrrrrrrw.',
		'..RRRRRRRRRRRw.',
		'.bbbbbbbbbbbbw.',
		'.BBBBBBBBBBBBw.',
		'...gggggggggggw',
		'...GGGGGGGGGGGw',
		'..yyyyyyyyyyw..',
		'..YYYYYYYYYYw..',
		'.pppppppppppppw',
		'.PPPPPPPPPPPPPw',
	],
	{
		r: '#c0503e',
		R: '#8c2f39',
		b: '#4f7fa8',
		B: '#2e4057',
		g: '#7ea35e',
		G: '#4f6e3a',
		y: '#e2b84a',
		Y: '#a8822a',
		p: '#8a6fb0',
		P: '#5b4a8a',
		w: '#f0e2c4',
	}
);

export const FLOOR_LAMP = fromRows(
	[
		'....ssssss....',
		'...sSSSSSSs...',
		'..sSSSSSSSSs..',
		'.sSSSSSSSSSSs.',
		'ssssssssssssss',
		'....yyyyyy....',
		'......kk......',
		...Array.from({ length: 30 }, () => '......kk......'),
		'.....kkkk.....',
		'...kkkkkkkk...',
	],
	{ s: '#b4702f', S: '#e9b65a', y: '#fff0b0', k: '#3a2414' }
);

export const PENDANT = fromRows(
	[
		...Array.from({ length: 10 }, () => '.....k.....'),
		'....kkk....',
		'...sssss...',
		'..sSSSSSs..',
		'.sSSSSSSSs.',
		'sssssssssss',
		'...yyyyy...',
	],
	{ k: '#2a1a0e', s: '#7a4a1e', S: '#b8742e', y: '#fff0b0' }
);

/** 책장에 기댄 사다리 */
export const LADDER = (() => {
	const h = 62;
	const px: Px[] = [];
	for (let y = 0; y < h; y++) {
		const x = Math.floor(y / 9);
		px.push(['#7a4a26', x, y, 2, 1], ['#7a4a26', x + 11, y, 2, 1]);
		if (y % 7 === 4) px.push(['#a0663a', x + 2, y, 9, 1], ['#5a3418', x + 2, y + 1, 9, 1]);
	}
	return { w: 20, h, px } satisfies Art;
})();

export const DISH = fromRows(
	[
		'...........k......',
		'..........k.......',
		'.ddd.....k........',
		'.dDDdd..k.........',
		'..dDDDddd.........',
		'...dDDDDDdd.......',
		'....ddDDDDDd......',
		'......ddDDDd......',
		'........ddd.......',
		'........kk........',
		'........kk........',
		'.......kkkk.......',
		'......kmmmmk......',
		'.....kmmmmmmk.....',
		'....kkkkkkkkkk....',
	],
	{ d: '#9aa6ba', D: '#d4dbe6', k: '#3a4252', m: '#5d6b80' }
);

export const ROCKET = fromRows(
	[
		'......rr......',
		'.....rRRr.....',
		'.....rRRr.....',
		'....wwWWww....',
		'....wwWWww....',
		'...wwwWWwww...',
		'...wwbbbbww...',
		'...wbBccBbw...',
		'...wbBBcBbw...',
		'...wwbbbbww...',
		'...wwwWWwww...',
		'...wwwWWwww...',
		'...wwwWWwww...',
		'...wwwWWwww...',
		'...rrwWWwrr...',
		'..rRrwWWwrRr..',
		'.rRRrwWWwrRRr.',
		'rRRRrrrrrrRRRr',
		'rRr..kkkk..rRr',
		'.....kyyk.....',
		'......yy......',
		'..mmmmmmmmmm..',
		'.mMMMMMMMMMMm.',
		'.mmmmmmmmmmmm.',
	],
	{
		w: '#e9edf3',
		W: '#c3cad6',
		r: '#a8322c',
		R: '#e0604a',
		b: '#3a4a6a',
		B: '#6fb6e8',
		c: '#d4f0ff',
		k: '#4a4f5c',
		y: '#ffcf4a',
		m: '#3a4252',
		M: '#6d7a90',
	}
);

export const CRATE = fromRows(
	[
		'kkkkkkkkkkkk',
		'kmmmmmmmmmmk',
		'kmyykmmkyymk',
		'kmmmmmmmmmmk',
		'kmMMMMMMMMmk',
		'kmMMMMMMMMmk',
		'kmmmmmmmmmmk',
		'kmyykmmkyymk',
		'kmmmmmmmmmmk',
		'kkkkkkkkkkkk',
	],
	{ k: '#262c3a', m: '#5d6b80', M: '#4a5568', y: '#f2c230' }
);

export const PALM = (() => {
	const leaves = fromRows(
		[
			'..........gg....gg..........',
			'.......ggGGGgg.gGGGgg.......',
			'....ggGGGggggGggggGGGgg.....',
			'..gGGgg....gGGGGg....ggGGg..',
			'.gGg.....gGGgccgGGg.....gGg.',
			'gg......gGg..cc..gGg......gg',
			'g......gg....cc....gg......g',
			'......g......tT......g......',
		],
		{ g: '#2a7a3a', G: '#4fb34a', c: '#6b4a24' }
	);
	const px = [...leaves.px];
	for (let y = 7; y < 31; y++) {
		const x = 13 + Math.floor(((y - 7) * (y - 7)) / 140);
		px.push([y % 3 === 0 ? '#6b4220' : '#8b5a2b', x, y, 1, 1], [y % 3 === 0 ? '#7d4f26' : '#a8743c', x + 1, y, 1, 1]);
	}
	return { w: 28, h: 31, px } satisfies Art;
})();

/** 바위 위 등대: 빨강·흰 줄무늬, 위에 불빛 */
export const LIGHTHOUSE = (() => {
	const w = 22;
	const cx = 11;
	const px: Px[] = [];
	// 지붕과 불빛 방
	px.push(
		['#7a1f1c', cx - 1, 0, 2, 1],
		['#b8322c', cx - 2, 1, 4, 1],
		['#b8322c', cx - 3, 2, 6, 1],
		['#7a1f1c', cx - 4, 3, 8, 1]
	);
	px.push(['#2a2a33', cx - 3, 4, 6, 5], ['#ffe27a', cx - 2, 5, 4, 3], ['#fff6cf', cx - 1, 5, 2, 3]);
	px.push(
		['#2a2a33', cx - 5, 9, 10, 1],
		['#2a2a33', cx - 5, 10, 1, 1],
		['#2a2a33', cx - 3, 10, 1, 1],
		['#2a2a33', cx + 2, 10, 1, 1],
		['#2a2a33', cx + 4, 10, 1, 1],
		['#2a2a33', cx - 5, 11, 10, 1]
	);
	// 몸통: 아래로 갈수록 넓다, 오른쪽 그늘
	for (let y = 12; y < 52; y++) {
		const half = 3 + Math.floor((y - 12) / 9);
		const red = Math.floor((y - 12) / 6) % 2 === 1;
		const [lit, shade] = red ? ['#d23a35', '#9e2a26'] : ['#f6f1e6', '#cfc6b4'];
		px.push(
			['#2a2a33', cx - half - 1, y, 1, 1],
			[lit, cx - half, y, half * 2 - 2, 1],
			[shade, cx + half - 2, y, 2, 1],
			['#2a2a33', cx + half, y, 1, 1]
		);
	}
	px.push(['#3a3a48', cx - 1, 22, 2, 3], ['#3a3a48', cx - 1, 34, 2, 3], ['#4a2a1c', cx - 1, 47, 3, 5]);
	// 바위
	px.push(['#6e6a72', 1, 52, 20, 2], ['#8d8992', 3, 51, 8, 1], ['#55515a', 0, 54, 22, 3], ['#8d8992', 4, 54, 5, 1]);
	return { w, h: 57, px } satisfies Art;
})();

export const CRAB = fromRows(
	[
		'.r.r......r.r.',
		'.rrr......rrr.',
		'..r..k..k..r..',
		'..rrrrrrrrrr..',
		'.rRRRRRRRRRRr.',
		'rrRRRRRRRRRRrr',
		'.r.r.r..r.r.r.',
	],
	{ r: '#b8322c', R: '#e0604a', k: '#2a1f1f' }
);

export const UMBRELLA = fromRows(
	[
		'.......rwrw.......',
		'....rrwwrrwwrr....',
		'..rrrwwwrrrwwwrr..',
		'.rrrrwwwrrrwwwrrr.',
		'rrrrwwwwrrrwwwwrrr',
		'........kk........',
		'........kk........',
		'........kk........',
		'........kk........',
		'........kk........',
		'........kk........',
		'........kk........',
		'........kk........',
	],
	{ r: '#e0604a', w: '#fff4dc', k: '#6b4a2a' }
);

// ─── 반복 무늬 타일: 바닥·별·물결 ─────────────────────────────────────────

/** 별 하늘 타일: 점 별 여럿과 십자 별 몇 개 */
export function starTile(seed: number, size: number, dots: number, crosses: number): Art {
	const rand = seeded(seed);
	const colors = ['#ffffff', '#cfe0ff', '#ffe9b8', 'rgba(255,255,255,0.55)', 'rgba(200,215,255,0.45)'];
	const px: Px[] = [];
	for (let i = 0; i < dots; i++)
		px.push([colors[Math.floor(rand() * colors.length)], Math.floor(rand() * size), Math.floor(rand() * size), 1, 1]);
	for (let i = 0; i < crosses; i++) {
		const x = 1 + Math.floor(rand() * (size - 2));
		const y = 1 + Math.floor(rand() * (size - 2));
		px.push(
			['rgba(255,255,255,0.6)', x, y - 1, 1, 3],
			['rgba(255,255,255,0.6)', x - 1, y, 3, 1],
			['#ffffff', x, y, 1, 1]
		);
	}
	return { w: size, h: size, px };
}

export const TILES = {
	town: fromRows(
		[
			'kkkkkkkkkkkkkkkk',
			'khhhhhhhkhhhhhhh',
			'khppppppkhqqqqqq',
			'khppppppkhqqqqqq',
			'khppppppkhqqqqqq',
			'khppppppkhqqqqqq',
			'khppppppkhqqqqqq',
			'khppppppkhqqqqqq',
			'kkkkkkkkkkkkkkkk',
			'khhhhhhhkhhhhhhh',
			'khqqqqqqkhpppppp',
			'khqqqqqqkhpppppp',
			'khqqqqqqkhpppppp',
			'khqqqqqqkhpppppp',
			'khqqqqqqkhpppppp',
			'khqqqqqqkhpppppp',
		],
		{ k: '#867869', h: '#c9bcad', p: '#b0a292', q: '#a69787' }
	),
	office: fromRows(['cccccccc', 'cdcccccc', 'cccccdcc', 'cccccccc', 'ccclcccc', 'cccccccc', 'cdcccccl', 'cccccccc'], {
		c: '#56697d',
		d: '#4a5c6f',
		l: '#647a90',
	}),
	library: fromRows(
		[
			'kkkkkkkkkkkkkkkkkkkkkkkk',
			'hhhhhhhhhhhhhhkhhhhhhhhh',
			'wwwwggwwwwwwwwkwwwwwwwww',
			'wwwwwwwwwwwgggkwwwwwwwww',
			'kkkkkkkkkkkkkkkkkkkkkkkk',
			'hhhhhkhhhhhhhhhhhhhhhhhh',
			'wwwwwkwwwwwwwwwwwggwwwww',
			'wwwwwkwwwgggwwwwwwwwwwww',
		],
		{ k: '#4e2f19', h: '#a06a40', w: '#8a5631', g: '#7a4a2a' }
	),
	space: fromRows(
		[
			'hhhhhhhhhhhhhhhk',
			'hmmmmmmmmmmmmmmk',
			'hmrmmmmmmmmmmrmk',
			'hmmmmmmmmmmmmmmk',
			'hmmmmmmmmmmmmmmk',
			'hmrmmmmmmmmmmrmk',
			'hmmmmmmmmmmmmmmk',
			'kkkkkkkkkkkkkkkk',
		],
		{ h: '#56627a', m: '#3e4759', r: '#7a879e', k: '#232a38' }
	),
	sea: fromRows(
		[
			'ssssssssssssssss',
			'ssdsssssssslssss',
			'ssssssssssssssss',
			'sssssslsssssssss',
			'ssssssssssssssds',
			'sdssssssssssssss',
			'ssssssssdsssssss',
			'sssslsssssssssss',
		],
		{ s: '#ecd39b', d: '#d6b97e', l: '#f8e8c2' }
	),
} satisfies Record<string, Art>;

/** 바다 물결 한 줄 */
export const WAVE = fromRows(
	['..........wwww..................', '......wwww....wwww..............', 'wwwwww............wwww..........'],
	{ w: 'rgba(255,255,255,0.6)' }
);

/** 모래에 닿는 거품 */
export const FOAM = fromRows(['..ww......ww....', 'wwwwww..wwwwww..', 'ffffffffffffffff'], {
	w: '#ffffff',
	f: '#d5f0f6',
});
