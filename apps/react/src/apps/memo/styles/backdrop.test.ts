import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MEMO = resolve(__dirname, '..');
const cssFiles = (readdirSync(MEMO, { recursive: true }) as string[])
	.filter((name) => name.endsWith('.css'))
	.map((name) => join(MEMO, name));

/*
 * 메모 창 안에는 흐림(backdrop-filter)을 쓰지 않는다. 본문이 스크롤될 때마다 흐림 판 뒤가 바뀌어
 * Chrome(macOS)이 한 프레임씩 창과 Dock을 통째로 빼고 그려 화면이 깜빡였다.
 * 글자 크기 알약, 코드·사진 위 버튼, 좁은 화면의 목차 버튼이 그랬고, 흐림을 끄자 깜빡임이 사라졌다
 */
describe('메모 창의 흐림 효과', () => {
	it('메모 CSS에 backdrop-filter가 없다 (스크롤할 때 창이 깜빡인다)', () => {
		const found = cssFiles.flatMap((file) =>
			readFileSync(file, 'utf8')
				.split('\n')
				.map((line, index) => ({ line: line.trim(), index }))
				.filter(({ line }) => /^(-webkit-)?backdrop-filter\s*:/.test(line))
				.map(({ line, index }) => `${relative(MEMO, file)}:${index + 1}: ${line}`)
		);
		expect(found).toEqual([]);
	});
});
