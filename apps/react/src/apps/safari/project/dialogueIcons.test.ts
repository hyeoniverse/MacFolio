import { describe, expect, it } from 'vitest';
import {
	deployPixelIcon,
	faPixelIcon,
	GLYPHS,
	ICON_COLORS,
	ICONS,
	letterTile,
	outlineRgba,
	pixelate,
	quantize,
	slotTile,
	techPixelIcon,
	techTile,
	type IconName,
} from './dialogueIcons';

/** 줄 폭이 모두 같고 아는 색 글자만 쓰는지 */
const expectIcon = (rows: readonly string[], label: string) => {
	expect(rows, label).toHaveLength(12);
	for (const row of rows) expect(row, label).toHaveLength(12);
	for (const ch of new Set(rows.join(''))) if (ch !== '.') expect(ICON_COLORS[ch], `${label}: ${ch}`).toBeTruthy();
};

describe('픽셀 아이콘', () => {
	it('모든 아이콘은 12×12 칸, 팔레트에 있는 색만, 둘레 한 칸 안에 짙은 외곽선이 있다', () => {
		for (const [name, rows] of Object.entries(ICONS)) {
			expectIcon(rows, name);
			// 바깥 줄에는 외곽선(k)과 빈칸만
			const edge = rows[0] + rows[11] + rows.map((row) => row[0] + row[11]).join('');
			expect(edge, name).toMatch(/^[.k]+$/);
			expect(rows.join(''), name).toContain('k');
		}
	});

	it('필요한 아이콘이 다 있다 (RPG 물건, 기술 로고)', () => {
		const needed: IconName[] = [
			'sword',
			'shield',
			'magnifier',
			'bag',
			'cross',
			'heart',
			'star',
			'scroll',
			'book',
			'gear',
			'hammer',
			'bug',
			'people',
			'globe',
			'rocket',
			'server',
			'database',
			'cloud',
			'phone',
			'key',
			'chest',
			'coin',
			'flag',
			'map',
			'clock',
			'check',
			'react',
			'typescript',
			'javascript',
			'node',
			'python',
			'docker',
			'git',
			'github',
			'vercel',
			'firebase',
			'postgres',
			'figma',
			'vite',
		];
		for (const name of needed) expect(ICONS[name], name).toBeDefined();
	});

	it('3×5 픽셀 글자: 영어 대문자와 숫자 모두', () => {
		for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
			expect(GLYPHS[ch], ch).toHaveLength(5);
			for (const row of GLYPHS[ch]) expect(row, ch).toMatch(/^[.#]{3}$/);
		}
	});

	it('글자 칸: 영어·숫자 한두 글자는 색 칸에 흰 글자, 픽셀 글자에 없는 글자(한글)는 null', () => {
		const tile = letterTile('Z');
		expect(tile).not.toBeNull();
		if (tile) {
			expectIcon(tile, 'Z');
			expect(tile.join('')).toContain('w');
		}
		expect(letterTile('TS')).not.toBeNull();
		expect(letterTile('갈')).toBeNull();
		// 같은 이름은 같은 색
		expect(letterTile('A', 'Axios')).toEqual(letterTile('A', 'Axios'));
	});
});

describe('아이콘 고르기', () => {
	it('아는 기술은 버전·괄호를 떼고 픽셀 로고로', () => {
		expect(techPixelIcon('React')).toBe('react');
		expect(techPixelIcon('React 19')).toBe('react');
		expect(techPixelIcon('TypeScript')).toBe('typescript');
		expect(techPixelIcon('Node.js')).toBe('node');
		expect(techPixelIcon('Express')).toBe('node');
		expect(techPixelIcon('PostgreSQL')).toBe('postgres');
		expect(techPixelIcon('Docker')).toBe('docker');
		expect(techPixelIcon('Python (FastAPI)')).toBe('python');
		expect(techPixelIcon('GitHub Actions')).toBe('github');
		expect(techPixelIcon('Next.js')).toBe('nextjs');
		expect(techPixelIcon('Vite')).toBe('vite');
		expect(techPixelIcon('Unity 6')).toBe('unity');
		expect(techPixelIcon('Zustand')).toBeNull();
		expect(techPixelIcon('')).toBeNull();
	});

	it('모르는 기술은 첫 글자 칸, 한글로 시작하면 톱니', () => {
		expect(techTile('Zustand')).toEqual(letterTile('Z', 'Zustand'));
		expect(techTile('갈무리')).toEqual(ICONS.gear);
		expect(techTile('React')).toBe(ICONS.react);
	});

	it('Font Awesome 이름은 가장 가까운 픽셀 아이콘으로, 모르면 별', () => {
		expect(faPixelIcon('fa-magnifying-glass')).toBe('magnifier');
		expect(faPixelIcon('fa-hand-fist')).toBe('sword');
		expect(faPixelIcon('fa-bag-shopping')).toBe('bag');
		expect(faPixelIcon('fa-users')).toBe('people');
		expect(faPixelIcon('fa-database')).toBe('database');
		expect(faPixelIcon('fa-clock')).toBe('clock');
		expect(faPixelIcon('fa-calendar-day')).toBe('clock');
		expect(faPixelIcon('fa-lock')).toBe('lock');
		expect(faPixelIcon('fa-eye-slash')).toBe('eye');
		expect(faPixelIcon('fa-square-poll-vertical')).toBe('chart');
		expect(faPixelIcon('fa-react')).toBe('react');
		expect(faPixelIcon('fa-solid fa-rocket')).toBe('rocket');
		expect(faPixelIcon('fa-something-new')).toBe('star');
		expect(faPixelIcon(undefined)).toBe('star');
	});

	it('사양 칸: 값의 첫 기술이 아는 것이면 로고, 아니면 분류 이름으로, 그것도 아니면 상자', () => {
		expect(slotTile('화면', 'React 19, TypeScript, Vite')).toBe(ICONS.react);
		expect(slotTile('서버', 'Vercel 서버리스 함수, Redis')).toBe(ICONS.server);
		expect(slotTile('인증', '이메일 로그인')).toBe(ICONS.key);
		expect(slotTile('기타', '무엇')).toBe(ICONS.chest);
	});

	it('배포 결과물: 올린 곳·주소로 고르고, 모르면 지구본', () => {
		expect(deployPixelIcon('Vercel', 'https://a.vercel.app')).toBe('vercel');
		expect(deployPixelIcon('Notion', undefined)).toBe('book');
		expect(deployPixelIcon('Docker · 클라우드 서버', undefined)).toBe('docker');
		expect(deployPixelIcon(undefined, 'https://github.com/me/x')).toBe('github');
		expect(deployPixelIcon('어딘가', 'https://example.com')).toBe('globe');
	});
});

describe('사진·아이콘을 픽셀로', () => {
	/** size·block 칸 그림: (x, y) → RGBA */
	const image = (n: number, color: (x: number, y: number) => [number, number, number, number]) => {
		const data = new Uint8ClampedArray(n * n * 4);
		for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) data.set(color(x, y), (y * n + x) * 4);
		return data;
	};

	it('색 줄이기: 많아야 count개, 불투명한 칸의 색만', () => {
		const data = image(8, (x, y) => [x * 30, y * 30, 100, x < 2 ? 0 : 255]);
		const palette = quantize(data, 4);
		expect(palette.length).toBeLessThanOrEqual(4);
		expect(palette.length).toBeGreaterThan(1);
		for (const c of palette) for (const v of c) expect(v).toBeGreaterThanOrEqual(0);
		expect(
			quantize(
				image(2, () => [0, 0, 0, 0]),
				4
			)
		).toEqual([]);
	});

	it('pixelate: 칸마다 가장 많은 색 하나 (섞인 색을 만들지 않는다), 반 넘게 빈 칸은 투명', () => {
		// 4×4 칸 두 개 (왼쪽 빨강, 오른쪽은 반 넘게 투명)
		const data = new Uint8ClampedArray(8 * 4 * 4);
		for (let y = 0; y < 4; y++)
			for (let x = 0; x < 8; x++)
				data.set(x < 4 ? [250, 10, 10, 255] : [10, 10, 250, y < 1 ? 255 : 0], (y * 8 + x) * 4);
		const out = pixelate(data, 2, 4, 4);
		expect(out).toHaveLength(2 * 2 * 4);
		// 첫 줄 첫 칸은 빨강 그대로 (평균이 아니다)
		expect([...out.slice(0, 4)]).toEqual([250, 10, 10, 255]);
		// 첫 줄 둘째 칸은 4칸 중 3칸 넘게 비어 투명
		expect(out[7]).toBe(0);
	});

	it('외곽선: 투명한 둘레는 짙은 한 칸, 네모 아이콘은 가장자리를 외곽선으로 하고 귀퉁이를 비운다', () => {
		const dot = new Uint8ClampedArray(3 * 3 * 4);
		dot.set([255, 255, 255, 255], (1 * 3 + 1) * 4);
		const ring = outlineRgba(dot, 3);
		expect(ring[(0 * 3 + 1) * 4 + 3]).toBe(255);
		expect(ring[3]).toBe(0);
		const square = outlineRgba(new Uint8ClampedArray(new Array(3 * 3 * 4).fill(255)), 3);
		expect(square[3]).toBe(0);
		expect([...square.slice(4, 8)]).toEqual([0x1c, 0x1c, 0x28, 255]);
		expect([...square.slice(16, 20)]).toEqual([255, 255, 255, 255]);
	});
});
