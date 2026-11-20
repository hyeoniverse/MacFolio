import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const cssFiles = (readdirSync(SRC, { recursive: true }) as string[])
	.filter((name) => name.endsWith('.css'))
	.map((name) => join(SRC, name));
const motion = readFileSync(join(__dirname, 'motion.css'), 'utf8');

/** motion.css에서 from만 있는(끝 상태가 원래 모양인) 나타나기 키프레임 이름 */
const entranceKeyframes = [...motion.matchAll(/@keyframes ([\w-]+)\s*\{\s*from\s*\{[^{}]*\}\s*\}/g)].map(
	([, name]) => name
);

describe('나타나기 애니메이션', () => {
	it('motion.css에서 from만 있는 키프레임을 찾는다', () => {
		expect(entranceKeyframes).toEqual(expect.arrayContaining(['fade-in', 'rise-in', 'grow-x']));
	});

	it('끝난 뒤 상태를 붙잡지 않는다 (both·forwards면 큰 판이 GPU 층으로 남아 스크롤할 때 깜빡인다)', () => {
		const held = cssFiles.flatMap((file) =>
			[...readFileSync(file, 'utf8').matchAll(/animation:\s*([\w-]+)\s[^;]*\b(both|forwards)\b/g)]
				.filter(([, name]) => entranceKeyframes.includes(name))
				.map(([rule]) => `${relative(SRC, file)}: ${rule}`)
		);
		expect(held).toEqual([]);
	});
});
