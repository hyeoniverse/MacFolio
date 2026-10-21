import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadOgAssets, OG_HEIGHT, OG_WIDTH, ogImagePng } from './index.js';

const post = { title: '첫 글 — 공유 카드', date: '2026-10-21', category: '개발기/MacFolio' };
const publicDir = fileURLToPath(new URL('../../../apps/react/public', import.meta.url));

describe('공유 카드 그림', () => {
	it('사이트의 public 폴더에서 글꼴과 아이콘을 읽는다', async () => {
		const assets = await loadOgAssets(publicDir);
		expect(assets.fonts.bold.length).toBeGreaterThan(1_000_000);
		expect(assets.icon.startsWith('data:image/png;base64,')).toBe(true);
	});

	it('1200×630 PNG로 굽는다', { timeout: 30_000 }, async () => {
		const png = await ogImagePng(post, { site: '김정현의 Mac', ...(await loadOgAssets(publicDir)) });
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([OG_WIDTH, OG_HEIGHT]);
	});
});
