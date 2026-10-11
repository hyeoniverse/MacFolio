// dialogue 모양 배경 장면 가운데 바깥 테마(숲·설산·사막·밤 옥상)의 픽셀 소품과 띠. 모두 장식이다
import { columns, disc, fromRows, seeded, type Art, type Px } from './pixelArt';
import { BAND_W } from './sprites';

// ─── 침엽수: 층층이 넓어지는 삼각 (숲 띠·숲 소품·눈 덮인 전나무가 함께 쓴다) ───

interface ConiferColors {
	body: string;
	/** 왼쪽(빛 받는 쪽) 가장자리 */
	light?: string;
	/** 오른쪽 그늘 */
	shade?: string;
	/** 층마다 위에 쌓인 눈 */
	snow?: string;
	snowShade?: string;
	trunk?: string;
}

/** 가운데 cx, 바닥 bottom에 높이 height의 침엽수를 px에 그린다. 층(tier)마다 좁게 시작해 넓어진다 */
function conifer(px: Px[], cx: number, bottom: number, height: number, c: ConiferColors) {
	const trunkH = c.trunk ? Math.max(2, Math.round(height * 0.12)) : 0;
	const crown = height - trunkH;
	const tierH = Math.max(3, Math.round(crown / 5));
	const top = bottom - height;
	for (let y = 0; y < crown; y++) {
		const inner = y % tierH;
		const half = Math.round(y * 0.26 + inner * 0.6);
		const left = cx - half;
		const width = half * 2 + 1;
		const row = top + y;
		px.push([c.body, left, row, width, 1]);
		if (c.shade && half > 1) {
			const from = cx + Math.ceil(half * 0.3);
			px.push([c.shade, from, row, cx + half - from + 1, 1]);
		}
		if (c.light && half > 0) px.push([c.light, left, row, Math.min(2, half), 1]);
		// 층의 맨 윗줄(과 그 아래 왼쪽 절반)에 눈
		if (c.snow && (inner === 0 || (inner === 1 && y > 1))) {
			const snowW = inner === 0 ? width : half + 1;
			px.push([c.snow, left, row, snowW, 1]);
			if (c.snowShade && inner === 0 && half > 1) px.push([c.snowShade, cx + 1, row, half, 1]);
		}
	}
	if (c.trunk) px.push([c.trunk, cx - 1, top + crown, 3, trunkH]);
}

const coniferArt = (height: number, c: ConiferColors): Art => {
	const px: Px[] = [];
	// 가장 넓은 반폭: 마지막 층의 끝줄
	const crown = height - (c.trunk ? Math.max(2, Math.round(height * 0.12)) : 0);
	const tierH = Math.max(3, Math.round(crown / 5));
	let maxHalf = 0;
	for (let y = 0; y < crown; y++) maxHalf = Math.max(maxHalf, Math.round(y * 0.26 + (y % tierH) * 0.6));
	conifer(px, maxHalf, height, height, c);
	return { w: maxHalf * 2 + 1, h: height, px };
};

// ─── 숲 ────────────────────────────────────────────────────────────────

/** 숲: 세 겹의 침엽수 실루엣 (먼 것은 푸르고 옅게, 가까운 것은 짙게), 겹 사이에 옅은 안개 */
export const PINES = (() => {
	const h = 78;
	const px: Px[] = [];
	const layers = [
		{ seed: 31, min: 44, max: 74, step: [6, 11], body: '#7ea69c', light: '#94b9ad', mist: 'rgba(214,236,214,0.22)' },
		{ seed: 37, min: 32, max: 54, step: [8, 15], body: '#41725d', light: '#558a70', mist: 'rgba(200,226,200,0.12)' },
		{ seed: 43, min: 20, max: 36, step: [10, 19], body: '#1d4334', light: '#2b5a45' },
	];
	for (const layer of layers) {
		const rand = seeded(layer.seed);
		const [lo, hi] = layer.step;
		for (let x = Math.floor(rand() * lo); x < BAND_W + 12; x += lo + Math.floor(rand() * (hi - lo))) {
			conifer(px, x, h, layer.min + Math.floor(rand() * (layer.max - layer.min)), {
				body: layer.body,
				light: layer.light,
			});
		}
		px.push([layer.body, 0, h - 3, BAND_W, 3]);
		if (layer.mist) px.push([layer.mist, 0, h - 26, BAND_W, 26], [layer.mist, 0, h - 12, BAND_W, 12]);
	}
	return { w: BAND_W, h, px } satisfies Art;
})();

export const PINE_NEAR = coniferArt(30, {
	body: '#1f5a3a',
	light: '#6ab06a',
	shade: '#0f2e1f',
	trunk: '#5a3a22',
});

export const PINE_SMALL = coniferArt(22, {
	body: '#24663f',
	light: '#72b870',
	shade: '#123824',
	trunk: '#5a3a22',
});

export const LOG = fromRows(
	[
		'.......mmM..........mmm...',
		'..oooo.mMmbbbbbbbbbbMmmb..',
		'.oRRRRobbbbBbbbbbbbbbbbbbk',
		'oRrrrrRobbbbbbbBbbbbbbbbbk',
		'oRrRRrRobbBbbbbbbbbbbBbbbk',
		'oRrRRrRobbbbbbbbBbbbbbbbbk',
		'oRrrrrRobbbbBbbbbbbbbbbbbk',
		'.oRRRRokkkkkkkkkkkkkkkkkk.',
		'..oooo....................',
	],
	{ o: '#5a3820', R: '#c48a52', r: '#e2b47c', b: '#7a4e2c', B: '#5e3a20', k: '#3e2414', m: '#5f8f44', M: '#86bf5c' }
);

export const MUSHROOMS = fromRows(
	[
		'...rrrrr.........',
		'..rRRwRRr........',
		'.rRwRRRRwr.......',
		'.rRRRRwRRr..rrr..',
		'rrrrrrrrrrrrRwRr.',
		'....sSs...rrrrrr.',
		'....sSs.....sS...',
		'....sSs.....sS...',
		'..g.sSs.g..gsSg..',
		'.gggsSsgggggsSgg.',
	],
	{ r: '#9e2a26', R: '#dc4a3c', w: '#fff1dc', s: '#f2e6cc', S: '#cdbd9c', g: '#5f8f44' }
);

export const STUMP = fromRows(
	[
		'...mmmm.......',
		'.oRRRRRRRRo...',
		'oRrrrrrrrrRo..',
		'oRrRRRRRRrRo..',
		'oRrrrrrrrrRo..',
		'.oRRRRRRRRoM..',
		'.bbBbbbbBbbmM.',
		'.bbBbbbbBbbbm.',
		'.bBbbbBbbbBbb.',
		'bbBbbbBbbbBbbb',
		'gbBgbbBbbgBbbg',
	],
	{ o: '#5a3820', R: '#c48a52', r: '#e2b47c', b: '#7a4e2c', B: '#5e3a20', m: '#5f8f44', M: '#86bf5c', g: '#4a7a36' }
);

export const FERN = fromRows(
	[
		'......g.......g...',
		'..g...gG....gGg...',
		'..gG..gGg..gGg..g.',
		'...gG.gGg.gGg..gG.',
		'g...gGgGgGgG..gG..',
		'gG...gGGGGG..gG...',
		'.gGg..gGGGg.gGg...',
		'..gGGggGGGgGGg....',
		'....gGGGGGGGg.....',
	],
	{ g: '#2f6b3a', G: '#5aa646' }
);

/** 반딧불: 노란 점과 옅은 빛 */
export const FIREFLY = fromRows(['.a.', 'aya', '.a.'], { a: 'rgba(214,255,120,0.55)', y: '#fbff9e' });

/** 숲 바닥: 흙길에 이끼 덩이와 자갈 */
export const FOREST_TILE = (() => {
	const size = 40;
	const rand = seeded(47);
	const px: Px[] = [['#6b4a2f', 0, 0, size, size]];
	for (let i = 0; i < 30; i++) px.push(['#5a3d26', Math.floor(rand() * size), Math.floor(rand() * size), 2, 1]);
	for (let i = 0; i < 5; i++) px.push(['#9a8a74', Math.floor(rand() * size), Math.floor(rand() * size), 1, 1]);
	// 이끼 덩이: 크기가 제각각인 둥근 얼룩
	for (let i = 0; i < 5; i++) {
		const x = Math.floor(rand() * (size - 6));
		const y = Math.floor(rand() * (size - 4));
		const w = 3 + Math.floor(rand() * 4);
		px.push(['#4f7a3a', x + 1, y, w - 1, 1], ['#4f7a3a', x, y + 1, w + 1, 1], ['#5f8f44', x + 1, y + 1, w - 2, 1]);
		px.push(['#4f7a3a', x + 1, y + 2, w - 1, 1]);
	}
	return { w: size, h: size, px } satisfies Art;
})();

// ─── 설산 ───────────────────────────────────────────────────────────────

/**
 * 봉우리 줄 하나: 꼭대기마다 양쪽으로 비탈이 내려간다. 왼쪽 비탈은 빛, 오른쪽은 그늘.
 * snowLine(꼭대기에서 몇 할)까지 눈, 그 아래는 바위
 */
function range(
	px: Px[],
	h: number,
	o: { seed: number; count: number; min: number; max: number; slope: [number, number]; snowLine: number },
	c: { snow: string; snowShade: string; rock: string; rockShade: string }
) {
	const rand = seeded(o.seed);
	const peaks = Array.from({ length: o.count }, (_, i) => ({
		x: (i + 0.1 + rand() * 0.8) * (BAND_W / o.count),
		h: o.min + rand() * (o.max - o.min),
		s: o.slope[0] + rand() * (o.slope[1] - o.slope[0]),
	}));
	const paint = columns(px);
	for (let x = 0; x < BAND_W; x++) {
		let top = 0;
		let peak = peaks[0];
		for (const p of peaks) {
			const t = p.h - Math.abs(x - p.x) * p.s;
			if (t > top) {
				top = t;
				peak = p;
			}
		}
		if (top < 1) continue;
		const ridgeY = h - Math.round(top);
		const lit = x < peak.x;
		// 눈 경계: 꼭대기에서 snowLine만큼 내려온 곳, 들쭉날쭉
		const jag = Math.round(Math.sin(x * 0.9) * 1.5 + Math.sin(x * 0.31) * 2);
		const snowY = Math.min(h, Math.max(ridgeY, Math.round(h - peak.h + peak.h * o.snowLine) + jag));
		paint(lit ? c.snow : c.snowShade, x, ridgeY, snowY - ridgeY);
		paint(lit ? c.rock : c.rockShade, x, snowY, h - snowY);
	}
}

/** 설산: 먼 바위 봉우리(눈 모자), 가까운 눈 언덕, 언덕 기슭의 작은 전나무 */
export const PEAKS = (() => {
	const h = 96;
	const px: Px[] = [];
	range(
		px,
		h,
		{ seed: 51, count: 9, min: 54, max: 92, slope: [0.85, 1.3], snowLine: 0.4 },
		{ snow: '#eef3fa', snowShade: '#b7c6de', rock: '#8291b2', rockShade: '#66749a' }
	);
	px.push(['rgba(230,238,250,0.25)', 0, h - 30, BAND_W, 30]);
	range(
		px,
		h,
		{ seed: 57, count: 15, min: 18, max: 38, slope: [0.45, 0.8], snowLine: 1 },
		{ snow: '#f8fbfe', snowShade: '#cfdcec', rock: '#f8fbfe', rockShade: '#cfdcec' }
	);
	const rand = seeded(59);
	for (let x = 2; x < BAND_W; x += 3 + Math.floor(rand() * (rand() < 0.3 ? 22 : 6)))
		conifer(px, x, h, 7 + Math.floor(rand() * 8), { body: '#3d5f6e', light: '#4f7383', snow: '#e8f0f8' });
	return { w: BAND_W, h, px } satisfies Art;
})();

/** 눈 결정 타일 (반복 배경): 1칸 눈과 가끔 2칸 눈 */
export function flakeTile(seed: number, size: number, small: number, big: number): Art {
	const rand = seeded(seed);
	const px: Px[] = [];
	for (let i = 0; i < small; i++)
		px.push([
			rand() < 0.6 ? '#ffffff' : 'rgba(255,255,255,0.7)',
			Math.floor(rand() * size),
			Math.floor(rand() * size),
			1,
			1,
		]);
	for (let i = 0; i < big; i++)
		px.push(['#ffffff', Math.floor(rand() * (size - 1)), Math.floor(rand() * (size - 1)), 2, 2]);
	return { w: size, h: size, px };
}

export const FIR_SNOW = coniferArt(30, {
	body: '#2b5648',
	light: '#3e735e',
	shade: '#1c3d33',
	snow: '#f5f9fd',
	snowShade: '#c6d4e6',
	trunk: '#5a3a22',
});

export const FIR_SNOW_SMALL = coniferArt(20, {
	body: '#2b5648',
	light: '#3e735e',
	shade: '#1c3d33',
	snow: '#f5f9fd',
	snowShade: '#c6d4e6',
	trunk: '#5a3a22',
});

/** 통나무집: 눈 덮인 지붕, 굴뚝, 불 켜진 창, 문 */
export const CABIN = (() => {
	const w = 32;
	const h = 28;
	const px: Px[] = [];
	// 굴뚝 (지붕 뒤)
	px.push(['#6e3e30', 22, 2, 4, 9], ['#8e5444', 22, 2, 1, 9], ['#4e2a20', 22, 5, 4, 1], ['#f4f8fc', 21, 1, 6, 2]);
	// 지붕: 꼭대기(16)에서 처마까지, 눈이 두껍게 (왼쪽 빛, 오른쪽 그늘), 처마 끝 나무
	for (let y = 3; y < 14; y++) {
		const half = Math.round((y - 3) * 1.45) + 1;
		px.push(['#f6f9fd', 16 - half, y, half, 1], ['#cad7e8', 16, y, half + 1, 1]);
	}
	px.push(['#5a3020', 1, 14, 30, 2], ['#7a4630', 1, 14, 30, 1]);
	// 고드름처럼 처마에 맺힌 눈
	for (const x of [3, 8, 13, 20, 26]) px.push(['#eef4fb', x, 16, 1, 1]);
	// 통나무 벽: 두 칸마다 색, 모서리는 둥근 통나무 끝
	for (let y = 16; y < 28; y += 2) {
		px.push(['#8e5c36', 4, y, 24, 1], ['#6e4428', 4, y + 1, 24, 1]);
		px.push(['#c08a56', 3, y, 2, 2], ['#c08a56', 27, y, 2, 2], ['#7a4a2a', 4, y, 1, 2], ['#7a4a2a', 27, y, 1, 2]);
	}
	// 창: 따뜻한 불빛, 가운데 창살
	px.push(['#3e2414', 7, 18, 8, 6], ['#ffcf5c', 8, 19, 6, 4], ['#fff2c0', 8, 19, 3, 2], ['#3e2414', 10, 19, 1, 4]);
	px.push(['#3e2414', 8, 21, 6, 1], ['#f4f8fc', 6, 24, 10, 1]);
	// 문
	px.push(['#3e2414', 18, 19, 7, 9], ['#7a4a2c', 19, 20, 5, 8], ['#5e3820', 21, 20, 1, 8], ['#e8c26a', 23, 24, 1, 1]);
	// 바닥 눈 더미
	px.push(['#f6f9fd', 0, 26, 5, 2], ['#f6f9fd', 26, 26, 6, 2], ['#cad7e8', 29, 27, 3, 1]);
	return { w, h, px } satisfies Art;
})();

/** 굴뚝 연기 한 덩이 (위로 오르며 옅어진다) */
export const SMOKE = fromRows(['..ss..', '.sSSs.', 'sSSSSs', '.sSSs.', '..ss..'], {
	s: 'rgba(225,230,240,0.55)',
	S: 'rgba(245,247,250,0.85)',
});

export const SNOWMAN = fromRows(
	[
		'.......kkk.......',
		'......kkkkk......',
		'......kRRRk......',
		'....kkkkkkkkk....',
		'.....wwwwwwS.....',
		'....wwkwwwkwS....',
		'....wwwwwooooo...',
		'....wwwwwwwwS....',
		'.....wwwwwwS.....',
		'....rrrrrrrrr....',
		't...wwrrwwwwS...t',
		'.t.wwwrrwwwwwS.t.',
		'..twwwwwkwwwwwt..',
		'..wwwwwwwwwwwwSS.',
		'..wwwwwwkwwwwwSS.',
		'..wwwwwwwwwwwwSS.',
		'...wwwwwwwwwwSS..',
		'....wwwwwwwwSS...',
		'.sssssssssssssss.',
	],
	{ k: '#2a2a33', R: '#c0392b', w: '#ffffff', S: '#c6d4e6', o: '#f08a24', r: '#d6453a', t: '#6b4428', s: '#d6e2f0' }
);

export const SNOW_TILE = fromRows(
	[
		'ssssssssssssssss',
		'sssssssssswsssss',
		'ssdsssssssssssss',
		'sssssssssssssdss',
		'sssssswsssssssss',
		'ssssssssssssssss',
		'sdssssssssswssss',
		'ssssssssssssssss',
		'sssssssdssssssss',
		'swssssssssssssss',
		'ssssssssssssdsss',
		'ssssssssssssssss',
		'sssdssssswssssss',
		'ssssssssssssssss',
		'ssssssssssssssws',
		'sssssssdssssssss',
	],
	{ s: '#eef3f9', d: '#d8e3f0', w: '#ffffff' }
);

// ─── 사막 ───────────────────────────────────────────────────────────────

/** 사막: 지평선에 걸린 큰 해, 먼 탁자 바위(메사), 겹친 모래 언덕(바람 반대쪽은 그늘, 능선은 밝게) */
export const DUNES = (() => {
	const h = 70;
	const px: Px[] = [];
	px.push(
		...disc(404, h - 30, 24, (dx, dy) => {
			if (dy > 6 && (dy + 24) % 4 === 0) return null;
			return dx * dx + dy * dy > 20 * 20 ? '#ffb04a' : dy < -10 ? '#fff0b0' : '#ffd877';
		})
	);
	// 메사: 평평한 꼭대기, 계단 비탈
	for (const [mx, mw, mh] of [
		[40, 34, 26],
		[214, 22, 34],
		[262, 40, 20],
		[420, 28, 30],
		[540, 46, 22],
	]) {
		for (let y = 0; y < mh; y++) {
			const grow = Math.floor(y / 2);
			px.push(['#9a4a5c', mx - grow, h - mh + y, mw + grow * 2, 1]);
			px.push([
				'#7a3a4e',
				mx + mw + grow - Math.max(2, Math.floor(grow / 2)),
				h - mh + y,
				Math.max(2, Math.floor(grow / 2)),
				1,
			]);
		}
		px.push(['#b85a68', mx, h - mh, mw, 1]);
	}
	const dune = (height: (x: number) => number, lit: string, shade: string, crest: string) => {
		const paint = columns(px);
		for (let x = 0; x < BAND_W; x++) {
			const now = height(x);
			const next = height(x + 1);
			const top = h - now;
			const descending = next < now;
			paint(crest, x, top, 1);
			paint(descending ? shade : lit, x, top + 1, now - 1);
		}
	};
	const step = (v: number) => Math.max(2, Math.round(v));
	dune((x) => step(30 + 7 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1)), '#dc8d52', '#b9663e', '#eba264');
	dune((x) => step(19 + 6 * Math.sin(x / 17 + 2) + 3 * Math.sin(x / 7)), '#ebaa62', '#c98048', '#f6c27c');
	dune((x) => step(9 + 4 * Math.sin(x / 13 + 4) + 2 * Math.sin(x / 5)), '#f5c37c', '#dc9e5c', '#ffe0a8');
	return { w: BAND_W, h, px } satisfies Art;
})();

export const SAGUARO = fromRows(
	[
		'........gg........',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'..gg...gGhg.......',
		'.gGhg..gGhg.......',
		'.gGhg..gGhg...gg..',
		'.gGhg..gGhg..gGhg.',
		'.gGhg..gGhg..gGhg.',
		'.gGhg..gGhg..gGhg.',
		'.gGhgg.gGhg..gGhg.',
		'..gGhgggGhg..gGhg.',
		'...gGGGGGhg.ggGhg.',
		'....ggggGhgggGGg..',
		'.......gGhGGGGg...',
		'.......gGhggggg...',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'.......gGhg.......',
		'......sgGhgs......',
		'....ssssssssss....',
	],
	{ g: '#2f5a2a', G: '#5a9a44', h: '#86c45e', s: 'rgba(120,60,30,0.35)' }
);

export const BARREL_CACTUS = fromRows(
	['...pPp...', '..gpPpg..', '.gGhGhGg.', 'gGhGhGhGg', 'gGhGhGhGg', 'gGhGhGhGg', '.gGhGhGg.', '..ggggg..'],
	{ p: '#e0508a', P: '#ff8ab8', g: '#2f5a2a', G: '#5a9a44', h: '#86c45e' }
);

export const SKULL = fromRows(
	[
		'hh..............hh',
		'.hh............hh.',
		'..hhh........hhh..',
		'....hwwwwwwwwh....',
		'....wwwwwwwwwwS...',
		'....wkkwwwwkkwS...',
		'....wkkwwwwkkwS...',
		'.....wwwwwwwwS....',
		'......wwwwwwS.....',
		'......wkwwkwS.....',
		'.......wwwwS......',
	],
	{ h: '#e8dcc0', w: '#f8f1e2', S: '#cbbd9e', k: '#4a3226' }
);

export const ROCKS = fromRows(
	[
		'.....rrrr...........',
		'...rRRRRrr..........',
		'..rRRRrrrrd.........',
		'.rRRrrrrrrdd...rrr..',
		'.rRrrrrrrddd..rRRrd.',
		'rRrrrrrrrddd.rRrrrdd',
		'rrrrrrrrdddd.rrrrddd',
		'.dddddddddd...dddddd',
	],
	{ r: '#b0704c', R: '#d09068', d: '#7d4a34' }
);

export const TUMBLEWEED = fromRows(
	['...bbb.b..', '.b.b..bb..', 'b..bbb..b.', '.bb.b.bb.b', 'b..b.b...b', '.b.bb..bb.', '..b..bb.b.', '...bb.b...'],
	{ b: '#9a6a3a' }
);

export const SAND_TILE = fromRows(
	[
		'ssssssssssssssssssssssss',
		'ssssssssssssssssssssssss',
		'sssrrrsssssssssssssslsss',
		'rrrsssrrrsssssssssssssss',
		'sssssssssrrsssssssssssss',
		'sssslsssssssssssssssssss',
		'ssssssssssssssrrrsssssss',
		'sssssssssssrrrsssrrrssss',
		'sssssssssssssssssssssrrs',
		'sssssssssssssssssssssssl',
		'ssssssssssssssssssssssss',
		'sssssslsssssssssssssssss',
	],
	{ s: '#e8b46e', r: '#d49a56', l: '#f6cf8e' }
);

// ─── 밤 옥상 ──────────────────────────────────────────────────────────────

export const CRESCENT = (() => {
	const r = 10;
	return {
		w: r * 2 + 1,
		h: r * 2 + 1,
		px: disc(r, r, r, (dx, dy) => {
			const cut = (dx - 5) * (dx - 5) + (dy + 3) * (dy + 3) < 9 * 9;
			if (cut) return null;
			return dx + dy < -6 ? '#fffbe2' : '#ffe9a0';
		}),
	} satisfies Art;
})();

/** 밤 도시: 먼 건물(흐린 창), 가운데 송신탑, 불빛 가득한 가까운 건물과 지붕의 빨간 항공등 */
export const NIGHT_CITY = (() => {
	const h = 60;
	const rand = seeded(61);
	const px: Px[] = [];
	let x = -4;
	while (x < BAND_W) {
		const w = 8 + Math.floor(rand() * 12);
		const bh = 22 + Math.floor(rand() * 26);
		px.push(['#1c2654', x, h - bh, w, bh]);
		for (let wy = h - bh + 3; wy < h - 2; wy += 3)
			for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rand() < 0.16) px.push(['#46558f', wx, wy, 1, 1]);
		x += w + (rand() < 0.3 ? 2 : 0);
	}
	// 송신탑: 바늘, 전망대, 기둥
	const tx = 228;
	px.push(
		['#121a3c', tx, 2, 1, 12],
		['#ff4a4a', tx, 0, 1, 2],
		['#121a3c', tx - 2, 14, 5, 2],
		['#121a3c', tx - 5, 16, 11, 6],
		['#ffd77a', tx - 4, 18, 9, 1],
		['#9fd8ff', tx - 4, 20, 9, 1],
		['#121a3c', tx - 1, 22, 3, h - 22],
		['#121a3c', tx - 3, h - 10, 7, 10]
	);
	x = -2;
	while (x < BAND_W) {
		const w = 10 + Math.floor(rand() * 13);
		const bh = 10 + Math.floor(rand() * 24);
		const top = h - bh;
		px.push(['#0d1330', x, top, w, bh]);
		// 지붕: 안테나와 항공등, 또는 계단 꼴
		if (rand() < 0.3) {
			px.push(['#0d1330', x + Math.floor(w / 2), top - 7, 1, 7], ['#ff5a5a', x + Math.floor(w / 2), top - 8, 1, 1]);
		} else {
			const stepped = rand() < 0.3;
			if (stepped) px.push(['#0d1330', x + 2, top - 3, w - 4, 3]);
		}
		for (let wy = top + 3; wy < h - 3; wy += 4)
			for (let wx = x + 2; wx < x + w - 2; wx += 3) {
				const lit = rand();
				if (lit < 0.42) px.push([lit < 0.05 ? '#9fd8ff' : lit < 0.12 ? '#fff1c4' : '#ffd77a', wx, wy, 1, 2]);
				else if (lit < 0.55) px.push(['#1d2650', wx, wy, 1, 2]);
			}
		x += w + (rand() < 0.4 ? 1 : 0);
	}
	return { w: BAND_W, h, px } satisfies Art;
})();

/** 물탱크: 원뿔 지붕, 띠를 두른 통, X자로 엮은 다리 */
export const WATER_TANK = (() => {
	const px: Px[] = [];
	px.push(['#5a3a2a', 10, 0, 2, 1], ['#6e4a36', 7, 1, 8, 1], ['#6e4a36', 4, 2, 14, 1], ['#4e3224', 2, 3, 18, 1]);
	px.push(['#8a6a52', 3, 4, 16, 13], ['#a4826a', 3, 4, 3, 13], ['#6e5240', 15, 4, 4, 13]);
	for (const y of [6, 10, 14]) px.push(['#3a3a44', 3, y, 16, 1]);
	px.push(['#2e2e38', 2, 17, 18, 2]);
	// 다리
	for (const lx of [3, 10, 17]) px.push(['#3a3d4a', lx, 19, 2, 11]);
	for (let i = 0; i < 7; i++) px.push(['#4e5262', 5 + i, 20 + i, 1, 1], ['#4e5262', 11 - i + 5, 20 + i, 1, 1]);
	px.push(['#4e5262', 3, 24, 16, 1]);
	return { w: 22, h: 30, px } satisfies Art;
})();

/** 지붕 환풍기 (돌아가는 터빈 머리) */
export const VENT = fromRows(
	[
		'...kkkk...',
		'..kmMmMk..',
		'.kMmMmMmk.',
		'.kmMmMmMk.',
		'.kMmMmMmk.',
		'..kkkkkk..',
		'...kmmk...',
		'...kmmk...',
		'...kmmk...',
		'..kkkkkk..',
		'.kmmmmmmk.',
		'kkkkkkkkkk',
	],
	{ k: '#2e313c', m: '#8a909e', M: '#b9bfcb' }
);

/** 실외기 */
export const AC_UNIT = fromRows(
	[
		'kkkkkkkkkkkkkkkk',
		'kwwwwwwwwwwwwwWk',
		'kwwwkkkkkkwwwwWk',
		'kwwkgGgGgGkwwwWk',
		'kwkgGkkkkGgkwwWk',
		'kwkGgkkkkgGkwlWk',
		'kwkgGkkkkGgkwwWk',
		'kwwkGgGgGgkwwwWk',
		'kwwwkkkkkkwwwwWk',
		'kwwwwwwwwwwwwwWk',
		'kkkkkkkkkkkkkkkk',
		'.kk..........kk.',
	],
	{ k: '#3a3d4a', w: '#c9ccd4', W: '#9a9ea8', g: '#6a6f7c', G: '#8a909e', l: '#5ef08a' }
);

/** 안테나 탑: 격자 기둥과 가로대, 꼭대기 빨간 등 */
export const ANTENNA = (() => {
	const h = 30;
	const px: Px[] = [['#ff4a4a', 5, 0, 2, 2]];
	for (let y = 2; y < h - 2; y++) {
		const half = 1 + Math.floor((y - 2) / 7);
		px.push(['#4e5262', 6 - half, y, 1, 1], ['#4e5262', 5 + half, y, 1, 1]);
		if (y % 4 === 0) px.push(['#6a6f7c', 6 - half, y, half * 2, 1]);
	}
	// 가로 안테나 살
	px.push(['#6a6f7c', 1, 6, 10, 1], ['#6a6f7c', 2, 10, 8, 1]);
	px.push(['#3a3d4a', 1, h - 2, 10, 2]);
	return { w: 12, h, px } satisfies Art;
})();

/** 줄 전구: 양 끝 기둥 사이에 처진 전선과 색 전구 */
export const STRING_LIGHTS = (() => {
	const w = 64;
	const h = 26;
	const px: Px[] = [
		['#4e5262', 0, 0, 2, h],
		['#4e5262', w - 2, 0, 2, h],
		['#3a3d4a', 0, h - 1, 3, 1],
		['#3a3d4a', w - 3, h - 1, 3, 1],
	];
	const bulbs = ['#ffd75a', '#ff8a5a', '#ff7ac0', '#7ae0ff', '#a0ff8a'];
	for (let x = 2; x < w - 2; x++) {
		const t = (x - 1) / (w - 3);
		const y = 1 + Math.round(10 * 4 * t * (1 - t));
		px.push(['#6a6e7e', x, y, 1, 1]);
		if (x % 6 === 4) {
			const color = bulbs[Math.floor(x / 6) % bulbs.length];
			px.push(
				['#6a6e7e', x, y + 1, 1, 1],
				[color, x - 1, y + 2, 3, 2],
				[color, x, y + 4, 1, 1],
				['#ffffff', x, y + 2, 1, 1]
			);
		}
	}
	return { w, h, px } satisfies Art;
})();

/** 옥상 바닥: 줄눈을 엇갈려 놓은 콘크리트 판 */
export const CONCRETE_TILE = (() => {
	const w = 32;
	const h = 20;
	const rand = seeded(67);
	const px: Px[] = [['#74767e', 0, 0, w, h]];
	for (let i = 0; i < 26; i++)
		px.push([rand() < 0.6 ? '#686a72' : '#83858d', Math.floor(rand() * w), Math.floor(rand() * h), 1, 1]);
	px.push(['#55575f', 0, 0, w, 1], ['#55575f', 0, 10, w, 1], ['#55575f', 0, 1, 1, 9], ['#55575f', 16, 11, 1, 9]);
	px.push(['#82848c', 1, 1, 15, 1], ['#82848c', 17, 11, 15, 1], ['#82848c', 0, 11, 15, 1]);
	return { w, h, px } satisfies Art;
})();
