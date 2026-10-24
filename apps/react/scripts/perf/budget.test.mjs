import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUDGET, brotliSize, check, initialFiles, measure, report } from './budget.mjs';

const HTML = `<!doctype html><html><head>
<script src="/theme-boot.js"></script>
<script type="module" crossorigin src="/assets/main-a.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-b.js">
<link rel="modulepreload" crossorigin href="/assets/boot-c.js">
<link rel="modulepreload" crossorigin href="/assets/main-a.js">
<link rel="preload" as="style" crossorigin href="/assets/boot-d.css">
<link rel="stylesheet" href="https://fonts.example.com/x.css">
<link rel="icon" href="/favicon.ico">
<link rel="manifest" href="/manifest.json">
</head><body></body></html>`;

/** 파일 크기를 정해 둔 가짜 dist (압축되지 않는 무작위 내용) */
function fakeDist(sizes) {
	const files = { 'dist/index.html': Buffer.from(HTML) };
	for (const [file, size] of Object.entries(sizes)) files[`dist/${file}`] = randomBytes(size);
	return (path) => {
		if (!(path in files)) throw new Error(`없는 파일: ${path}`);
		return files[path];
	};
}

describe('initialFiles', () => {
	it('index.html이 처음부터 요청하는 같은 출처 스크립트·CSS만 중복 없이 고른다 (일반 스크립트·아이콘·다른 출처는 제외)', () => {
		expect(initialFiles(HTML)).toEqual([
			'assets/main-a.js',
			'assets/vendor-b.js',
			'assets/boot-c.js',
			'assets/boot-d.css',
		]);
	});
});

describe('measure', () => {
	it('파일마다 brotli 크기를 측정하고 boot 번들과 합계를 낸다', () => {
		const result = measure(
			'dist',
			fakeDist({
				'assets/main-a.js': 1000,
				'assets/vendor-b.js': 3000,
				'assets/boot-c.js': 2000,
				'assets/boot-d.css': 500,
			})
		);
		expect(result.files.map(({ file }) => file)).toEqual(initialFiles(HTML));
		expect(result.boot.file).toBe('assets/boot-c.js');
		expect(result.boot.bytes).toBeGreaterThan(2000);
		expect(result.total).toBe(result.files.reduce((sum, { bytes }) => sum + bytes, 0));
	});

	it('boot 번들이 없으면 이유를 알린다', () => {
		const read = () => Buffer.from('<script type="module" src="/assets/main-a.js"></script>');
		expect(() => measure('dist', read)).toThrow('boot 번들');
	});
});

describe('check', () => {
	const KB = 1024;
	const result = (bootKB, others) => {
		const boot = { file: 'assets/boot-c.js', bytes: bootKB * KB };
		const files = [boot, ...others.map((kb, i) => ({ file: `assets/chunk-${i}.js`, bytes: kb * KB }))];
		return { boot, files, total: files.reduce((sum, { bytes }) => sum + bytes, 0) };
	};

	it('상한 안이면 실패가 없다', () => {
		expect(check(result(49, [150, 50]), BUDGET)).toEqual([]);
	});

	it('boot 번들이 상한을 넘으면 얼마나 넘었는지 알린다', () => {
		expect(check(result(60, [10]), { bootKB: 55, initialKB: 265 })).toEqual([
			'boot 번들(assets/boot-c.js)이 60.0KB로, 상한 55.0KB보다 5.0KB 큽니다.',
		]);
	});

	it('첫 방문 번들 합계가 상한을 넘으면 큰 파일 순으로 상위 기여를 보여 준다', () => {
		const [error] = check(result(40, [100, 5, 200]), { bootKB: 55, initialKB: 265 });
		const lines = error.split('\n');
		expect(lines[0]).toBe(
			'첫 방문 번들(index.html이 처음부터 요청하는 4개)이 345.0KB로, 상한 265.0KB보다 80.0KB 큽니다.'
		);
		expect(lines.slice(2).map((line) => line.trim())).toEqual([
			'200.0KB  assets/chunk-2.js',
			'100.0KB  assets/chunk-0.js',
			'40.0KB  assets/boot-c.js',
			'5.0KB  assets/chunk-1.js',
		]);
	});

	it('4차의 회귀(명언 365개가 boot에 포함, +19KB)는 두 상한 모두에 걸린다', () => {
		expect(check(result(49.4 + 19, [251.6 - 49.4]), BUDGET)).toHaveLength(2);
	});
});

describe('report', () => {
	it('통과해도 측정값과 상한을 남긴다', () => {
		const boot = { file: 'assets/boot-c.js', bytes: 49.4 * 1024 };
		expect(report({ boot, files: [boot], total: boot.bytes })).toBe(
			`boot 번들: 49.4KB / 상한 ${BUDGET.bootKB}KB (assets/boot-c.js)\n첫 방문 번들: 49.4KB / 상한 ${BUDGET.initialKB}KB (1개)`
		);
	});
});

it('brotliSize는 압축한 크기다', () => {
	expect(brotliSize(Buffer.from('a'.repeat(10_000)))).toBeLessThan(100);
});
