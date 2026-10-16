import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	ALL_SHEETS,
	AUTOTILE_KEYS,
	AUTOTILES,
	autotile,
	BUILDINGS,
	CHARACTERS,
	characterFrame,
	characterOf,
	GROUND,
	ITEMS,
	MONSTERS,
	monsterOf,
	NATURE,
	NINJA_BASE,
	noise,
	PROPS,
	sheetSize,
	sheetUrl,
	TILE,
	type Sprite,
} from '@/apps/safari/project/dialogueNinja';

/** public 폴더 (이 파일에서 apps/react/public) */
const PUBLIC = fileURLToPath(new URL('../../../../public', import.meta.url));

/** PNG 머리(IHDR)의 폭과 높이 */
function pngSize(path: string): [number, number] {
	const head = readFileSync(path).subarray(0, 24);
	expect(head.subarray(1, 4).toString('latin1')).toBe('PNG');
	return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

/** 이름 붙은 조각을 모두 모은다 */
function namedSprites(): [string, Sprite][] {
	const out: [string, Sprite][] = [];
	const walk = (value: unknown, name: string) => {
		if (!value || typeof value !== 'object') return;
		if ('sheet' in value && 'w' in value) {
			out.push([name, value as Sprite]);
			return;
		}
		for (const [key, inner] of Object.entries(value)) walk(inner, `${name}.${key}`);
	};
	walk({ GROUND, NATURE, BUILDINGS, PROPS, ITEMS }, 'sprites');
	return out;
}

describe('그림 목록 (Ninja Adventure, CC0)', () => {
	it('목록의 그림 파일은 모두 public에 있고, 적어 둔 크기가 실제 PNG와 같다', () => {
		expect(ALL_SHEETS.length).toBeGreaterThan(20);
		for (const key of ALL_SHEETS) {
			const path = `${PUBLIC}${sheetUrl(key)}`;
			expect(existsSync(path), path).toBe(true);
			expect(pngSize(path), key).toEqual([...sheetSize(key)]);
		}
	});

	it('그림 폴더에 CC0 사용 허락과 출처가 있다', () => {
		const license = readFileSync(`${PUBLIC}${NINJA_BASE}/LICENSE.txt`, 'utf8');
		expect(license).toContain('CC0 1.0 Universal');
		expect(license).toContain('https://pixel-boy.itch.io/ninja-adventure-asset-pack');
	});

	it('이름 붙은 조각은 모두 제 그림 안에 있다', () => {
		const sprites = namedSprites();
		expect(sprites.length).toBeGreaterThan(40);
		for (const [name, sprite] of sprites) {
			const [w, h] = sheetSize(sprite.sheet);
			expect(sprite.x >= 0 && sprite.y >= 0 && sprite.w > 0 && sprite.h > 0, name).toBe(true);
			expect(sprite.x + sprite.w, name).toBeLessThanOrEqual(w);
			expect(sprite.y + sprite.h, name).toBeLessThanOrEqual(h);
		}
	});

	it('사람·몬스터 그림은 방향 열과 걸음 줄의 16×16 칸이고, 이름마다 늘 같은 사람', () => {
		expect(characterFrame('boy', 'down', 0)).toMatchObject({ x: 0, y: 0, w: TILE, h: TILE });
		expect(characterFrame('boy', 'right', 3)).toMatchObject({ x: 3 * TILE, y: 3 * TILE });
		expect(characterFrame('boy', 'up', 5).y).toBe(TILE);
		expect(characterOf('김하늘')).toBe(characterOf('김하늘'));
		expect(CHARACTERS).toContain(characterOf('아무개'));
		expect(new Set(['가람', '나래', '다솜', '라온', '마루', '바다'].map(characterOf)).size).toBeGreaterThan(2);
		expect(monsterOf(0)).toBe(MONSTERS[0]);
		expect(monsterOf(MONSTERS.length + 1)).toBe(MONSTERS[1]);
		expect(monsterOf(-1)).toBe(MONSTERS[MONSTERS.length - 1]);
	});
});

describe('자동 타일', () => {
	const at = (sprite: Sprite) => [sprite.x / TILE - AUTOTILES.dirt.col, sprite.y / TILE - AUTOTILES.dirt.row];

	it('47가지 이웃 모양을 모두 안다', () => {
		expect(AUTOTILE_KEYS).toBe(47);
	});

	it('사방이 같은 땅이면 가운데, 혼자면 외딴 조각, 가로·세로 줄은 끝 조각', () => {
		expect(at(autotile(AUTOTILES.dirt, () => true))).toEqual([1, 1]);
		expect(at(autotile(AUTOTILES.dirt, () => false))).toEqual([3, 3]);
		// 오른쪽만 이어진 가로 줄의 왼쪽 끝
		expect(at(autotile(AUTOTILES.dirt, (dx, dy) => dx === 1 && dy === 0))).toEqual([0, 3]);
		// 아래만 이어진 세로 줄의 위 끝
		expect(at(autotile(AUTOTILES.dirt, (dx, dy) => dx === 0 && dy === 1))).toEqual([3, 0]);
		// 왼쪽 위 모서리 (오른쪽·아래·오른쪽 아래가 같은 땅)
		expect(at(autotile(AUTOTILES.dirt, (dx, dy) => dx >= 0 && dy >= 0 && dx + dy > 0))).toEqual([0, 0]);
	});

	it('여덟 이웃의 어떤 모양이든 묶음 안의 조각 하나를 고른다', () => {
		for (let mask = 0; mask < 256; mask++) {
			const dirs = [
				[0, -1],
				[1, 0],
				[0, 1],
				[-1, 0],
				[1, -1],
				[1, 1],
				[-1, 1],
				[-1, -1],
			];
			const sprite = autotile(AUTOTILES.water, (dx, dy) =>
				dirs.some(([x, y], i) => x === dx && y === dy && (mask >> i) & 1)
			);
			const [w, h] = sheetSize(sprite.sheet);
			expect(sprite.x + TILE).toBeLessThanOrEqual(w);
			expect(sprite.y + TILE).toBeLessThanOrEqual(h);
		}
	});

	it('해시는 0 이상 1 미만이고 같은 칸은 늘 같다', () => {
		for (let i = 0; i < 200; i++) {
			const n = noise(i, i * 7, 3);
			expect(n).toBeGreaterThanOrEqual(0);
			expect(n).toBeLessThan(1);
		}
		expect(noise(5, 9, 2)).toBe(noise(5, 9, 2));
	});
});
