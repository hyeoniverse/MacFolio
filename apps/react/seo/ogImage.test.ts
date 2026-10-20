import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OG_HEIGHT, OG_WIDTH, ogImageName, ogImagePng } from './ogImage';

const post = { slug: 'hello', title: '첫 글 — 공유 카드', date: '2026-10-21', category: '개발기/MacFolio' };
const publicFile = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url));

describe('공유 카드 그림', () => {
	it('파일 이름은 글 주소와 내용의 해시: 제목이 바뀌면 이름도 바뀐다', () => {
		expect(ogImageName(post)).toMatch(/^og\/hello-[0-9a-f]{8}\.png$/);
		expect(ogImageName(post)).toBe(ogImageName({ ...post }));
		expect(ogImageName({ ...post, title: '고친 제목' })).not.toBe(ogImageName(post));
	});

	it('1200×630 PNG로 굽는다', { timeout: 30_000 }, async () => {
		const png = await ogImagePng(post, {
			site: '김정현의 Mac',
			icon: `data:image/png;base64,${publicFile('imgs/memo.png').toString('base64')}`,
			fonts: { regular: publicFile('fonts/AppleSDGothicNeoM.ttf'), bold: publicFile('fonts/AppleSDGothicNeoB.ttf') },
		});
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([OG_WIDTH, OG_HEIGHT]);
	});
});
