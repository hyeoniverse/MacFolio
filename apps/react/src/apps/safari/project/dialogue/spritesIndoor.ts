// dialogue 모양 배경 장면 가운데 실내 테마(카페·교실·연구실·게임장)의 픽셀 소품과 띠·타일. 모두 장식이다
import { fromRows, seeded, type Art, type Px } from './pixelArt';
import { BAND_W } from './sprites';

// ─── 카페 ───────────────────────────────────────────────────────────────

/** 카페 벽: 짙은 줄눈의 붉은 벽돌 (반복 배경) */
export const BRICK_TILE = fromRows(
	[
		'bbbbbbbmBBBBBBBm',
		'bbbbbbbmBBBBBBBm',
		'bbbbbbbmBBBBBBBm',
		'mmmmmmmmmmmmmmmm',
		'BBBmcccccccmbbbb',
		'BBBmcccccccmbbbb',
		'BBBmcccccccmbbbb',
		'mmmmmmmmmmmmmmmm',
	],
	{ b: '#9e5a46', B: '#a8644e', c: '#94523f', m: '#6e3a2c' }
);

/** 칠판 메뉴판: 나무 틀, 분필 제목과 메뉴 줄(이름 … 값), 컵 낙서 */
export const MENU_BOARD = (() => {
	const w = 40;
	const h = 30;
	const px: Px[] = [
		['#5a3820', 0, 0, w, h],
		['#7a4e2c', 1, 1, w - 2, h - 2],
		['#262b28', 3, 3, w - 6, h - 6],
		['#2e3430', 3, 3, w - 6, 1],
	];
	// 제목: 노란 분필 물결 글씨
	const rand = seeded(71);
	for (let x = 8; x < 31; x++) if (rand() < 0.8) px.push(['#f2c27a', x, 5 + (x % 3 === 0 ? 1 : 0), 1, 2]);
	px.push(['#f2c27a', 7, 8, 25, 1]);
	// 메뉴 줄: 이름(흰 분필) … 점선 … 값(분홍)
	for (let i = 0; i < 5; i++) {
		const y = 11 + i * 3;
		const name = 7 + Math.floor(rand() * 8);
		for (let x = 5; x < 5 + name; x++) if (rand() < 0.85) px.push(['#e8e4da', x, y, 1, 1 + (rand() < 0.3 ? 1 : 0)]);
		for (let x = 6 + name; x < 28; x += 2) px.push(['rgba(232,228,218,0.45)', x, y + 1, 1, 1]);
		px.push(['#f29aa0', 29, y, 4, 1], ['#f29aa0', 29, y + 1, 1, 1], ['#f29aa0', 32, y + 1, 1, 1]);
	}
	// 오른쪽 아래 김 나는 컵 낙서
	px.push(['#e8e4da', 30, 23, 1, 1], ['#e8e4da', 32, 22, 1, 1]);
	return { w, h, px } satisfies Art;
})();

export const CAFE_PENDANT = fromRows(
	[
		...Array.from({ length: 12 }, () => '......k......'),
		'.....kkk.....',
		'....kmmmk....',
		'...kmmmmmk...',
		'..kmmmmmmmk..',
		'.kmmmmmmmmmk.',
		'kkkkkkkkkkkkk',
		'....yYYYy....',
		'.....yyy.....',
	],
	{ k: '#1e1a18', m: '#2f6b5a', y: '#ffcf5c', Y: '#fff4c8' }
);

/** 카운터: 에스프레소 머신(크롬, 포타필터, 잔), 원두 그라인더, 유리 뚜껑 안 크루아상, 나무 앞판 */
export const COUNTER = (() => {
	const w = 48;
	const px: Px[] = [];
	// 에스프레소 머신
	px.push(['#f2ede4', 6, 0, 2, 2], ['#f2ede4', 10, 0, 2, 2], ['#f2ede4', 14, 0, 2, 2]);
	px.push(['#5a5f6a', 3, 2, 18, 1], ['#c9ced6', 3, 3, 18, 6], ['#eef1f5', 3, 3, 18, 1], ['#9aa1ad', 3, 8, 18, 1]);
	px.push(['#b8322c', 5, 4, 14, 2], ['#e0604a', 5, 4, 14, 1], ['#ffd75a', 17, 6, 1, 1], ['#5ef08a', 15, 6, 1, 1]);
	px.push(['#3a3f4a', 6, 9, 3, 1], ['#3a3f4a', 14, 9, 3, 1], ['#1e1a18', 8, 9, 4, 1], ['#1e1a18', 16, 9, 4, 1]);
	px.push(['#f2ede4', 7, 11, 3, 2], ['#f2ede4', 14, 11, 3, 2], ['#6b4329', 7, 11, 3, 1]);
	px.push(['#9aa1ad', 3, 9, 1, 4], ['#9aa1ad', 20, 9, 1, 4], ['#5a5f6a', 3, 13, 18, 1]);
	// 그라인더
	px.push(['#d8e4ea', 25, 1, 5, 1], ['#b8cdd8', 24, 2, 7, 4], ['#6b4329', 25, 3, 5, 3], ['#4a2c18', 26, 4, 1, 1]);
	px.push(['#2a2c36', 25, 6, 5, 6], ['#3e4250', 25, 6, 1, 6], ['#2a2c36', 24, 12, 7, 2]);
	// 유리 뚜껑 진열대와 크루아상
	px.push(['rgba(220,240,250,0.55)', 35, 6, 9, 6], ['#eef8fc', 38, 4, 3, 2], ['#ffffff', 36, 7, 1, 3]);
	px.push(['#e0a050', 37, 10, 5, 2], ['#c07a30', 38, 10, 1, 1], ['#c07a30', 40, 10, 1, 1], ['#d8d0c4', 34, 12, 11, 1]);
	// 상판과 앞판
	px.push(['#b07a52', 0, 14, w, 1], ['#8a5a3b', 0, 15, w, 2], ['#5e3a24', 0, 17, w, 1]);
	px.push(['#6b4328', 1, 18, w - 2, 12]);
	for (let x = 1; x < w - 2; x += 6) px.push(['#4e2f1a', x, 18, 1, 12], ['#7e5234', x + 1, 18, 1, 12]);
	px.push(['#3e2414', 1, 29, w - 2, 1]);
	return { w, h: 30, px } satisfies Art;
})();

/** 작은 원탁과 김 나는 머그 */
export const CAFE_TABLE = fromRows(
	[
		'.........wwwww..........',
		'.........wcccwww........',
		'.........wwwww.w........',
		'.........wwwwwww........',
		'.........Swwww..........',
		'..tttttttttttttttttttt..',
		'.TTTTTTTTTTTTTTTTTTTTTT.',
		'..kkkkkkkkkkkkkkkkkkkk..',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'..........kk............',
		'.......kkkkkkkk.........',
		'......kkkkkkkkkk........',
	],
	{ w: '#f6f1e6', S: '#cfc6b4', c: '#6b4329', t: '#b07a52', T: '#8a5a3b', k: '#2a2622' }
);

/** 머그에서 오르는 김 */
export const STEAM = fromRows(['.s...', 's..s.', '.s..s', '..s.s', '.s.s.', 's..s.', '.s...'], {
	s: 'rgba(255,255,255,0.7)',
});

/** 키 큰 떡갈잎 고무나무와 흰 화분 */
export const FIDDLE = fromRows(
	[
		'.......gg.........',
		'......gGGg........',
		'.....gGhGg..gg....',
		'.....gGGGg.gGGg...',
		'..gg..gGg.gGhGg...',
		'.gGGg..t..gGGGg...',
		'.gGhGg.t...gGg....',
		'.gGGGg.t..t.......',
		'..gGg..t.t...gg...',
		'....t..tt...gGGg..',
		'.....t.t...gGhGGg.',
		'......tt..t.gGGGg.',
		'..gg...t.t...ggg..',
		'.gGGg..tt.........',
		'gGhGGg.t..........',
		'gGGGGg.t...gg.....',
		'.gGGg.tt..gGGg....',
		'..g..t.t.gGhGg....',
		'......tt.tgGGg....',
		'.......tt..gg.....',
		'.......t..........',
		'.......t..........',
		'....wwwwwwwwww....',
		'....wWWWWWWWWw....',
		'.....wwwwwwwWw....',
		'.....wwwwwwwWw....',
		'.....wwwwwwwWw....',
		'......wwwwwwW.....',
	],
	{ g: '#2f6b3a', G: '#4c9a4f', h: '#7cc46a', t: '#5a4030', w: '#f2ede4', W: '#cfc6b4' }
);

export const TERRACOTTA_TILE = fromRows(
	[
		'gggggggggggggggggggggggg',
		'gtttttttttttgTTTTTTTTTTT',
		'gtltttttttttgTTTTTTTTTTT',
		'gtttttttttttgTTTTTTlTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gtttttttdtttgTTTTTTTTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gtttttttttttgTTTdTTTTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gtttttttttttgTTTTTTTTTTT',
		'gggggggggggggggggggggggg',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgtttltttttdt',
		'gTTTTTlTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTdTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
		'gTTTTTTTTTTTgttttttttttt',
	],
	{ g: '#7a3e2a', t: '#b8654a', T: '#ad5d42', l: '#c87656', d: '#9e5238' }
);

// ─── 교실 ───────────────────────────────────────────────────────────────

/** 초록 칠판: 나무 틀, 지운 자국, 분필 글씨 줄·삼각형 그림, 받침대의 분필과 지우개 */
export const CHALKBOARD = (() => {
	const w = 66;
	const h = 28;
	const px: Px[] = [
		['#7a4a26', 0, 0, w, h - 3],
		['#2f5c45', 2, 2, w - 4, h - 7],
		// 지운 자국
		['#3a6b52', 8, 4, 14, 3],
		['#36664e', 40, 12, 12, 4],
	];
	const rand = seeded(83);
	const chalk = (x0: number, y: number, len: number) => {
		for (let x = x0; x < x0 + len; x++) {
			if (rand() < 0.18) continue;
			px.push(['#e6efe8', x, y - (rand() < 0.3 ? 1 : 0), 1, rand() < 0.5 ? 2 : 1]);
		}
	};
	chalk(5, 6, 20);
	chalk(5, 10, 14);
	chalk(22, 10, 9);
	chalk(5, 14, 24);
	chalk(5, 18, 11);
	// 삼각형과 화살표
	for (let i = 0; i < 9; i++) px.push(['#f6e7a0', 40 + i, 15 - i, 1, 1], ['#f6e7a0', 48 + i, 7 + i, 1, 1]);
	px.push(['#f6e7a0', 40, 16, 17, 1], ['#f2a0b0', 58, 6, 4, 1], ['#f2a0b0', 61, 5, 1, 3]);
	// 받침대: 분필 세 개와 지우개
	px.push(['#8a5a36', 1, h - 3, w - 2, 2], ['#5e3a1e', 1, h - 1, w - 2, 1]);
	px.push(['#ffffff', 10, h - 4, 3, 1], ['#ffe08a', 15, h - 4, 3, 1], ['#ffb0c0', 20, h - 4, 2, 1]);
	px.push(['#3a3a48', 46, h - 5, 7, 2], ['#c9b48a', 46, h - 4, 7, 1]);
	return { w, h, px } satisfies Art;
})();

/** 시간표 게시판: 코르크, 칸 나눈 시간표 종이와 압정 */
export const TIMETABLE = (() => {
	const w = 26;
	const h = 22;
	const px: Px[] = [
		['#7a4a26', 0, 0, w, h],
		['#c49a62', 1, 1, w - 2, h - 2],
		['#f6f1e4', 3, 3, 20, 16],
		['#6b8fb8', 3, 3, 20, 2],
	];
	const colors = ['#f6c9a0', '#bfe0b0', '#b8d4f0', '#f0c0d8', '#f2e2a0', '#d0c8f0'];
	const rand = seeded(89);
	for (let r = 0; r < 4; r++)
		for (let c = 0; c < 5; c++) px.push([colors[Math.floor(rand() * colors.length)], 4 + c * 4, 6 + r * 3, 3, 2]);
	px.push(['#d23a35', 12, 2, 2, 2], ['#3f7fb0', 5, 16, 1, 1]);
	// 옆에 붙인 쪽지
	px.push(['#fff2a0', 19, 14, 6, 6], ['#e0c860', 19, 19, 6, 1], ['#a89040', 20, 16, 4, 1]);
	return { w, h, px } satisfies Art;
})();

/** 교실 창: 초록 틀, 하늘과 바깥 나무 */
export const CLASS_WINDOW = (() => {
	const w = 30;
	const h = 26;
	const px: Px[] = [['#e9e4d2', 0, 0, w, h]];
	for (const gx of [2, 16]) {
		const sky = ['#8fcdee', '#a4d8f2', '#bce3f6', '#d0ecf8'];
		sky.forEach((fill, i) => px.push([fill, gx, 2 + i * 5, 12, 5]));
		px.push(['#ffffff', gx + 2, 4, 5, 1], ['#ffffff', gx + 1, 5, 7, 1]);
	}
	// 바깥 나무 꼭대기
	px.push(['#6fb84a', 3, 15, 9, 7], ['#8fd06a', 4, 15, 4, 2], ['#4f9a3a', 16, 17, 12, 5], ['#6fb84a', 18, 16, 6, 2]);
	px.push(['#3f7a5a', 0, 0, w, 2], ['#3f7a5a', 0, 0, 2, h], ['#3f7a5a', w - 2, 0, 2, h], ['#3f7a5a', 14, 0, 2, h]);
	px.push(['#3f7a5a', 0, 12, w, 1], ['#e9e4d2', -1, h - 2, w + 2, 2], ['#b8b09a', -1, h - 1, w + 2, 1]);
	return { w, h, px: px.map(([f, x, y, pw, ph]) => [f, x + 1, y, pw, ph] as Px) } satisfies Art;
})();

/** 학생 책상과 의자 (옆에서 본 모습): 의자 등받이·자리, 책상 위 펼친 공책 */
export const SCHOOL_DESK = fromRows(
	[
		'.ggggg................',
		'.gGGGg................',
		'.gGGGg.....wwwwwww....',
		'.ggggg....wWWwWWWw....',
		'..m.......tttttttttttt',
		'..m.......TTTTTTTTTTTT',
		'..m.......kkkkkkkkkkkk',
		'..m........m........m.',
		'.ggggggg...m........m.',
		'.GGGGGGG...m........m.',
		'..m...m....m........m.',
		'..m...m....m........m.',
		'..m...m....m........m.',
		'..m...m....m........m.',
		'..m...m....m........m.',
		'.mm..mm...mm.......mm.',
	],
	{ g: '#2f7a5a', G: '#46a07a', m: '#5a6a7a', w: '#f6f1e4', W: '#9ab0d0', t: '#d8aa6a', T: '#b07a42', k: '#7a4e2c' }
);

/** 낮은 수납장 (지구본을 올린다) */
export const CABINET = fromRows(
	[
		'tttttttttttttttttt',
		'TTTTTTTTTTTTTTTTTT',
		'.wwwwwwwwkwwwwwwww',
		'.wwwwwwwwkwwwwwwww',
		'.wwwwwhwwkwwhwwwww',
		'.wwwwwwwwkwwwwwwww',
		'.wwwwwwwwkwwwwwwww',
		'.kkkkkkkkkkkkkkkkk',
		'.wwwwwwwwkwwwwwwww',
		'.wwwwwhwwkwwhwwwww',
		'.wwwwwwwwkwwwwwwww',
		'.kkkkkkkkkkkkkkkkk',
	],
	{ t: '#d8aa6a', T: '#b07a42', w: '#c9a070', k: '#8a5a36', h: '#f2d08a' }
);

export const SPIDER_PLANT = fromRows(
	[
		'.g.......g....',
		'..g..g..g...g.',
		'g..g.gGg...gG.',
		'.gG.gGGg.gGg..',
		'..gGgGGGgGg...',
		'...gGGGGGg....',
		'....pppppp....',
		'....pPPPPp....',
		'.....pPPp.....',
		'.....pppp.....',
	],
	{ g: '#4c9a4f', G: '#8fd06a', p: '#3f6fb0', P: '#5a8ad0' }
);

export const OAK_TILE = fromRows(
	[
		'oooooooooooooooooooooooooooooook',
		'ooooOoooooooooooooooooooooOooook',
		'oooooooooooooooolooooooooooooook',
		'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
		'ooooooooooooookooooooooooooooooo',
		'oooooooooOooookoooooooooooooOooo',
		'olooooooooooookooooooooooooooooo',
		'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
	],
	{ o: '#c8955a', O: '#b8854c', l: '#d8a86c', k: '#9a6a38' }
);

// ─── 연구실 ──────────────────────────────────────────────────────────────

/** 벽 선반: 약병(갈색), 색 시약병, 작은 화분, 상자 */
export const LAB_SHELF = (() => {
	const w = 42;
	const px: Px[] = [];
	const board = (y: number) => px.push(['#c9d0d6', 0, y, w, 2], ['#9aa3ab', 0, y + 2, w, 1]);
	// 윗칸
	px.push(['#7a4a26', 2, 2, 3, 6], ['#5a3418', 2, 1, 3, 1], ['#f6f1e4', 2, 4, 3, 2]);
	px.push(['#7a4a26', 6, 3, 3, 5], ['#5a3418', 6, 2, 3, 1], ['#f6f1e4', 6, 5, 3, 1]);
	px.push(['rgba(220,240,250,0.7)', 11, 2, 4, 6], ['#5ec08a', 11, 5, 4, 3], ['#2a2f36', 11, 1, 4, 1]);
	px.push(['rgba(220,240,250,0.7)', 16, 4, 3, 4], ['#c05ad0', 16, 6, 3, 2]);
	px.push(['#e8eef2', 22, 3, 8, 5], ['#3f7fb0', 22, 3, 8, 1], ['#9aa3ab', 24, 5, 4, 1]);
	px.push(['#4c9a4f', 33, 1, 2, 3], ['#7cc46a', 35, 2, 2, 2], ['#2f6b3a', 34, 0, 1, 3], ['#c9673e', 32, 4, 6, 4]);
	board(8);
	// 아랫칸
	px.push(['#f2ede4', 2, 13, 10, 5], ['#d8d0c4', 2, 13, 10, 1], ['#d23a35', 4, 15, 6, 1]);
	px.push(['rgba(220,240,250,0.7)', 14, 12, 5, 6], ['#4fb0e6', 14, 14, 5, 4], ['#2a2f36', 15, 11, 3, 1]);
	px.push(['#7a4a26', 21, 13, 3, 5], ['#5a3418', 21, 12, 3, 1], ['#7a4a26', 25, 14, 3, 4], ['#5a3418', 25, 13, 3, 1]);
	px.push(['#3a4252', 30, 14, 9, 4], ['#ffd75a', 31, 15, 2, 1], ['#5ef08a', 34, 15, 1, 1]);
	board(18);
	// 받침
	px.push(['#9aa3ab', 3, 21, 2, 2], ['#9aa3ab', w - 5, 21, 2, 2]);
	return { w, h: 23, px } satisfies Art;
})();

/** 실험대: 검은 상판, 흰 수납장, 위에 비커·삼각 플라스크·둥근 플라스크(받침과 불꽃)·시험관 꽂이 */
export const LAB_BENCH = (() => {
	const w = 50;
	const px: Px[] = [];
	const glass = 'rgba(220,240,250,0.65)';
	const rim = '#eef8fc';
	// 비커 (파란 액체)
	px.push(
		[glass, 3, 4, 7, 8],
		['#4fb0e6', 3, 7, 7, 5],
		['#8fd4f6', 3, 7, 7, 1],
		[rim, 2, 4, 9, 1],
		['#ffffff', 4, 5, 1, 6]
	);
	// 삼각 플라스크 (초록 액체): 좁은 목 아래로 넓어진다
	px.push([glass, 15, 0, 3, 5], [rim, 14, 0, 5, 1]);
	for (let y = 5; y < 12; y++) {
		const half = 1 + Math.floor((y - 5) * 0.8);
		px.push([y >= 7 ? '#5ec08a' : glass, 16 - half, y, half * 2 + 1, 1]);
	}
	px.push(['#9af0c0', 14, 7, 5, 1]);
	// 둥근 플라스크 (보라 액체) + 받침 + 불꽃
	px.push([glass, 26, 0, 3, 4], [rim, 25, 0, 5, 1]);
	px.push(
		[glass, 24, 4, 7, 1],
		[glass, 23, 5, 9, 4],
		['#c05ad0', 23, 6, 9, 3],
		['#e08af0', 23, 6, 9, 1],
		[glass, 24, 9, 7, 1]
	);
	px.push(['#5a5f6a', 22, 10, 11, 1], ['#5a5f6a', 23, 11, 1, 2], ['#5a5f6a', 31, 11, 1, 2]);
	px.push(['#4fb0e6', 27, 11, 1, 1], ['#ffb04a', 26, 12, 3, 1]);
	// 시험관 꽂이
	px.push(['#d8aa6a', 36, 6, 12, 2], ['#b07a42', 36, 11, 12, 1], ['#b07a42', 36, 8, 1, 4], ['#b07a42', 47, 8, 1, 4]);
	['#d23a35', '#ffd75a', '#5ec08a', '#4fb0e6', '#c05ad0'].forEach((fill, i) => {
		px.push([glass, 38 + i * 2, 2, 1, 9], [fill, 38 + i * 2, 6 + (i % 2), 1, 5 - (i % 2)]);
	});
	// 상판과 수납장
	px.push(['#3a414c', 0, 12, w, 1], ['#22272e', 0, 13, w, 2]);
	px.push(['#eef1f4', 1, 15, w - 2, 13], ['#c9d0d6', 1, 15, w - 2, 1]);
	for (const x of [1, 17, 33]) px.push(['#b4bcc4', x + 15, 15, 1, 13], ['#7f8890', x + 6, 18, 4, 1]);
	px.push(['#b4bcc4', 1, 22, w - 2, 1], ['#7f8890', 7, 25, 4, 1], ['#7f8890', 23, 25, 4, 1], ['#7f8890', 39, 25, 4, 1]);
	px.push(['#5f6a74', 1, 28, w - 2, 1]);
	return { w, h: 29, px } satisfies Art;
})();

/** 플라스크에서 오르는 거품 */
export const BUBBLES = fromRows(['.b..', '....', 'b..b', '.b..', '..b.', 'b...'], { b: 'rgba(180,255,210,0.85)' });

/** 흰 작업대 (모니터와 현미경을 올린다) */
export const LAB_DESK = fromRows(
	[
		'tttttttttttttttttttttttttttttt',
		'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
		'.m..........................m.',
		'.m..........................m.',
		'.m..........................m.',
		'.mmmmmmmmmmmmmmmmmmmmmmmmmmmm.',
		'.m..........................m.',
		'.m..........................m.',
		'.m..........................m.',
		'mm..........................mm',
	],
	{ t: '#f2f4f6', T: '#b4bcc4', m: '#7f8890' }
);

/** 그래프 모니터: 격자 위에 초록·노랑 선 */
export const GRAPH_MONITOR = (() => {
	const w = 22;
	const px: Px[] = [
		['#2a2f36', 0, 0, w, 14],
		['#0f1e28', 1, 1, w - 2, 12],
	];
	for (let x = 4; x < w - 1; x += 4) px.push(['#1d3442', x, 1, 1, 12]);
	for (let y = 4; y < 13; y += 3) px.push(['#1d3442', 1, y, w - 2, 1]);
	const green = [10, 9, 9, 7, 8, 6, 5, 6, 4, 3, 4, 3, 2, 3, 2, 2, 3, 2, 2, 2];
	green.forEach((y, i) => px.push(['#5ef0a0', 1 + i, y, 1, 1]));
	const gold = [6, 6, 7, 8, 7, 8, 9, 8, 9, 10, 9, 10, 10, 11, 10, 11, 11, 10, 11, 11];
	gold.forEach((y, i) => i % 2 === 0 && px.push(['#f0c05e', 1 + i, y, 1, 1]));
	px.push(['#3a414c', 9, 14, 4, 3], ['#3a414c', 6, 17, 10, 1]);
	return { w, h: 18, px } satisfies Art;
})();

export const MICROSCOPE = fromRows(
	[
		'...kk.....',
		'...kWk....',
		'....kWk...',
		'....kWWk..',
		'.....kWWk.',
		'....kkkkkk',
		'....kWWWk.',
		'...kmmkWk.',
		'..mmmm.kk.',
		'.kkkkkkkk.',
		'.......kk.',
		'.......kk.',
		'..kkkkkkkk',
		'.kWWWWWWWk',
	],
	{ k: '#2a2f36', W: '#eef1f4', m: '#5a6a7a' }
);

export const EXTINGUISHER = fromRows(
	['.kk..', 'kkkk.', '.rr.k', 'rRrr.k', 'rRrr.k', 'rRrr..', 'rwwr..', 'rwwr..', 'rRrr..', 'rRrr..', 'rRrr..', '.rr...'],
	{ k: '#2a2f36', r: '#a8322c', R: '#e0604a', w: '#f2ede4' }
);

export const LAB_TILE = fromRows(
	[
		'gggggggggggggggg',
		'gttttttttttttttt',
		'gtttttlttttttttt',
		'gttttttttttttttt',
		'gttttttttttdtttt',
		'gttttttttttttttt',
		'gtdttttttttttttt',
		'gttttttttttttttt',
		'gggggggggggggggg',
		'gTTTTTTTTTTTTTTT',
		'gTTTTTTTTTTTlTTT',
		'gTTTTTTTTTTTTTTT',
		'gTTTdTTTTTTTTTTT',
		'gTTTTTTTTTTTTTTT',
		'gTTTTTTTTTTTTTdT',
		'gTTTTTTTTTTTTTTT',
	],
	{ g: '#848c94', t: '#a9b0b7', T: '#9fa7ae', l: '#bcc2c8', d: '#939ba3' }
);

// ─── 게임장 ──────────────────────────────────────────────────────────────

/** 네온 간판 GAME: 분홍 관 (빛 번짐은 CSS) */
export const NEON_GAME = fromRows(
	[
		'.pppp..ppp..p...p.pppp',
		'p.....p...p.pp.pp.p...',
		'p.....p...p.p.p.p.p...',
		'p.ppp.ppppp.p...p.ppp.',
		'p...p.p...p.p...p.p...',
		'p...p.p...p.p...p.p...',
		'.ppp..p...p.p...p.pppp',
	],
	{ p: '#ffb8f0' }
);

/** 네온 별: 하늘색 */
export const NEON_STAR = fromRows(
	['....c....', '....c....', '...c.c...', 'cccc.cccc', '.c.....c.', '..c...c..', '.c..c..c.', '.c.c.c.c.', 'cc.....cc'],
	{ c: '#b8faff' }
);

/** 뒤쪽 벽을 따라 늘어선 오락기 실루엣: 위 간판 띠와 화면 빛 */
export const CABINET_ROW = (() => {
	const h = 40;
	const rand = seeded(97);
	const screens = ['#3fd0ff', '#ff5fa8', '#7dff7a', '#ffd84a', '#b07aff'];
	const px: Px[] = [];
	let x = 0;
	while (x < BAND_W) {
		const w = 13 + Math.floor(rand() * 4);
		const top = 4 + Math.floor(rand() * 5);
		const screen = screens[Math.floor(rand() * screens.length)];
		px.push(['#24183f', x, top, w, h - top], ['#2e2050', x, top, 1, h - top]);
		px.push([screen, x + 2, top + 1, w - 4, 2], ['rgba(255,255,255,0.35)', x + 2, top + 1, w - 4, 1]);
		px.push(['#0b0818', x + 2, top + 5, w - 4, 9], [screen, x + 3, top + 6, w - 6, 7]);
		px.push(['rgba(10,8,24,0.45)', x + 3, top + 8, w - 6, 1], ['rgba(10,8,24,0.45)', x + 3, top + 11, w - 6, 1]);
		px.push(
			['#3a2c60', x + 1, top + 16, w - 2, 3],
			['#ff5a5a', x + 4, top + 16, 1, 1],
			['#ffd84a', x + w - 5, top + 17, 1, 1]
		);
		x += w + 2;
	}
	return { w: BAND_W, h, px } satisfies Art;
})();

/** 오락기 한 대: 불 켜진 간판, 우주 침략자 화면, 조이스틱과 버튼, 동전 넣는 곳 */
export function arcadeCabinet(body: string, dark: string, marquee: string): Art {
	const w = 18;
	const h = 30;
	const px: Px[] = [
		['#120c22', 0, 0, w, h],
		[body, 1, 0, w - 2, h],
		[dark, w - 4, 0, 3, h],
		[marquee, 2, 1, w - 6, 3],
		['rgba(255,255,255,0.45)', 2, 1, w - 6, 1],
		['#120c22', 2, 5, w - 5, 10],
		['#0a1630', 3, 6, w - 7, 8],
	];
	// 화면: 침략자 하나와 점수, 아래 우주선
	px.push(
		['#7dff7a', 6, 7, 1, 1],
		['#7dff7a', 9, 7, 1, 1],
		['#7dff7a', 5, 8, 6, 2],
		['#0a1630', 6, 8, 1, 1],
		['#0a1630', 9, 8, 1, 1],
		['#7dff7a', 5, 10, 1, 1],
		['#7dff7a', 10, 10, 1, 1],
		['#ffd84a', 4, 6, 3, 1],
		['#3fd0ff', 7, 12, 3, 1],
		['#3fd0ff', 8, 11, 1, 1]
	);
	// 조작판: 기울어진 판, 조이스틱(빨간 공), 버튼 셋
	px.push(['#2a2a3a', 1, 15, w - 2, 1], ['#3e3e52', 1, 16, w - 2, 3], ['#2a2a3a', 1, 19, w - 2, 1]);
	px.push(
		['#d23a35', 4, 14, 2, 2],
		['#1e1e28', 4, 16, 1, 1],
		['#ffd84a', 9, 17, 1, 1],
		['#3fd0ff', 11, 17, 1, 1],
		['#ff5fa8', 13, 17, 1, 1]
	);
	// 동전 투입구
	px.push(
		['#1e1e28', 6, 22, 5, 5],
		['#ff7a3a', 7, 23, 1, 2],
		['#ff7a3a', 9, 23, 1, 2],
		['#120c22', 1, h - 1, w - 2, 1]
	);
	return { w, h, px };
}

/** 인형뽑기: 불빛 머리, 유리 상자 안 집게와 인형, 상품 꺼내는 곳 */
export const CLAW = (() => {
	const w = 22;
	const h = 30;
	const px: Px[] = [
		['#120c22', 0, 0, w, h],
		['#ff6ab0', 1, 0, w - 2, 4],
		['#ffd84a', 3, 1, 1, 1],
		['#ffd84a', 7, 1, 1, 1],
		['#ffd84a', 11, 1, 1, 1],
		['#ffd84a', 15, 1, 1, 1],
		['#ffd84a', 19, 1, 1, 1],
		['#c0408a', 1, 3, w - 2, 1],
		// 유리 상자
		['#1c2a4a', 1, 4, w - 2, 14],
		['rgba(255,255,255,0.18)', 3, 5, 1, 12],
		['rgba(255,255,255,0.12)', 5, 5, 1, 6],
		// 집게: 레일, 줄, 집게발
		['#9aa1ad', 1, 4, w - 2, 1],
		['#c9ced6', 12, 5, 1, 4],
		['#c9ced6', 10, 9, 5, 1],
		['#c9ced6', 10, 10, 1, 2],
		['#c9ced6', 14, 10, 1, 2],
	];
	// 인형: 동글동글한 머리 셋과 눈
	for (const [x, fill, ear] of [
		[3, '#ffd84a', '#e0a020'],
		[8, '#7ad0ff', '#4a9ad0'],
		[14, '#ff9ac0', '#d0608a'],
	] as const) {
		px.push(
			[ear, x, 13, 1, 1],
			[ear, x + 3, 13, 1, 1],
			[fill, x, 14, 4, 4],
			['#2a1f33', x + 1, 15, 1, 1],
			['#2a1f33', x + 2, 15, 1, 1]
		);
	}
	px.push(['#a8e86a', 11, 16, 3, 2]);
	// 아래 몸통: 조작 선반, 조이스틱, 상품 문
	px.push(['#ff6ab0', 1, 18, w - 2, 12], ['#c0408a', w - 4, 18, 3, 12], ['#e0e4ec', 1, 18, w - 2, 1]);
	px.push(['#2a2a3a', 3, 20, 7, 2], ['#d23a35', 5, 19, 2, 1], ['#3fd0ff', 8, 20, 1, 1]);
	px.push(['#120c22', 12, 21, 6, 6], ['#2e2050', 13, 22, 4, 4], ['#ffd84a', 3, 24, 5, 3], ['#120c22', 4, 25, 3, 1]);
	return { w, h, px } satisfies Art;
})();

export const STOOL = fromRows(
	[
		'.rrrrrrrr.',
		'rRRRRRRRRr',
		'.kkkkkkkk.',
		'....kk....',
		'....kk....',
		'....kk....',
		'....kk....',
		'...kkkk...',
		'..kkkkkk..',
	],
	{ r: '#b8322c', R: '#e0604a', k: '#3a3d4a' }
);

/** 게임장 바닥: 짙은 보라·남색 체크 */
export const CHECK_TILE = fromRows(
	[
		'aaaaaaaabbbbbbbb',
		'aAaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'aaaaaaaabbbbbbbb',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaAaaaaaa',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaaaaaaaa',
		'bbbbbbbbaaaaaaaa',
	],
	{ a: '#261b48', A: '#3a2c66', b: '#17102e' }
);
