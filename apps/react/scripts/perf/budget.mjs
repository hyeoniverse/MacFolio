// 첫 번들 성능 예산: 빌드 결과(dist)에서 첫 방문에 내려받는 스크립트·CSS의 압축 크기를 측정하고 상한과 비교한다. CI의 check 작업이 빌드 뒤에 실행한다.
// 사용: node scripts/perf/budget.mjs [dist 경로]   (상한을 넘으면 종료 코드 1)
// 측정 대상:
// - boot: 앱 본체 번들(assets/boot-*.js). 앱 코드를 정적 import로 boot에 붙이면 커진다 (4차의 명언 위젯 +19KB)
// - 첫 방문 번들: index.html이 처음부터 요청하는 파일(<script type="module" src>, modulepreload, preload, stylesheet)의 합계
// 압축은 측정 서버(serve.mjs)와 같은 brotli 9단계다. 운영(Cloudflare)은 압축 수준이 낮아 10~15% 크다 (docs/performance.md)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

/**
 * 상한 (KB = 1,024바이트, Lighthouse·docs/performance.md와 같은 단위, brotli 9단계).
 * 2026년 10월 23일 값(boot 49.4KB, 첫 방문 번들 251.6KB)에 boot는 약 10%(+5.6KB), 합계는 약 5%(+13.4KB)를 더했다.
 * 4차의 명언 위젯(+19KB)처럼 번들 하나가 boot에 붙으면 둘 다 실패한다. 근거와 넘었을 때의 대응은 docs/performance.md의 '성능 예산'
 */
export const BUDGET = {
	bootKB: 55,
	initialKB: 265,
};

/** 상위 몇 개 파일을 실패 메시지에 보여 주는지 */
const TOP = 8;

/** index.html이 처음부터 요청하는 같은 출처 파일 경로 (/assets/…). 순서대로, 중복 없이 */
export function initialFiles(html) {
	const files = new Set();
	for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
		const attr = (name) => tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`))?.[1];
		const isModuleScript = tag.startsWith('<script') && attr('type') === 'module';
		const rel = attr('rel');
		const isPreload = tag.startsWith('<link') && ['modulepreload', 'preload', 'stylesheet'].includes(rel ?? '');
		const url = isModuleScript ? attr('src') : isPreload ? attr('href') : undefined;
		// 글꼴·이미지 preload는 없다. 있으면 함께 집계한다. 다른 출처(CDN)는 빌드 결과가 아니다
		if (url?.startsWith('/') && !url.startsWith('//')) files.add(url.slice(1));
	}
	return [...files];
}

/** brotli 9단계로 압축한 크기 (바이트) */
export const brotliSize = (buffer) =>
	brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } }).length;

/** dist를 측정한다. readFile은 시험에서 교체한다 */
export function measure(dist, readFile = (path) => readFileSync(path)) {
	const html = readFile(join(dist, 'index.html')).toString('utf8');
	const files = initialFiles(html).map((file) => ({ file, bytes: brotliSize(readFile(join(dist, file))) }));
	const boot = files.find(({ file }) => /^assets\/boot-[^/]+\.js$/.test(file));
	if (!boot)
		throw new Error(
			'index.html에서 boot 번들(assets/boot-*.js)을 찾지 못했습니다. vite.config.ts의 bootPreloadPlugin을 확인하세요.'
		);
	return { boot, files, total: files.reduce((sum, { bytes }) => sum + bytes, 0) };
}

const KB = 1024;
const kb = (bytes) => `${(bytes / KB).toFixed(1)}KB`;

/** 상한과 비교한다. 넘은 항목마다 한국어 메시지 하나 (넘지 않았으면 빈 배열) */
export function check(result, budget = BUDGET) {
	const errors = [];
	const bootLimit = budget.bootKB * KB;
	if (result.boot.bytes > bootLimit)
		errors.push(
			`boot 번들(${result.boot.file})이 ${kb(result.boot.bytes)}로, 상한 ${kb(bootLimit)}보다 ${kb(result.boot.bytes - bootLimit)} 큽니다.`
		);
	const initialLimit = budget.initialKB * KB;
	if (result.total > initialLimit) {
		const top = [...result.files].sort((a, b) => b.bytes - a.bytes).slice(0, TOP);
		errors.push(
			[
				`첫 방문 번들(index.html이 처음부터 요청하는 ${result.files.length}개)이 ${kb(result.total)}로, 상한 ${kb(initialLimit)}보다 ${kb(result.total - initialLimit)} 큽니다.`,
				`크기 상위 ${top.length}개:`,
				...top.map(({ file, bytes }) => `  ${kb(bytes).padStart(8)}  ${file}`),
			].join('\n')
		);
	}
	return errors;
}

/** 측정 결과 요약 (통과해도 CI 로그에 남긴다) */
export function report(result, budget = BUDGET) {
	return [
		`boot 번들: ${kb(result.boot.bytes)} / 상한 ${budget.bootKB}KB (${result.boot.file})`,
		`첫 방문 번들: ${kb(result.total)} / 상한 ${budget.initialKB}KB (${result.files.length}개)`,
	].join('\n');
}

// 명령으로 실행했을 때만 (시험에서 import하면 실행하지 않는다)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const dist = resolve(process.argv[2] ?? 'dist');
	const budget = {
		bootKB: Number(process.env.BUDGET_BOOT_KB ?? BUDGET.bootKB),
		initialKB: Number(process.env.BUDGET_INITIAL_KB ?? BUDGET.initialKB),
	};
	const result = measure(dist);
	console.log(report(result, budget));
	const errors = check(result, budget);
	if (errors.length > 0) {
		console.error(`\n성능 예산을 넘었습니다. 대응 방법은 docs/performance.md의 '성능 예산'을 참고하세요.\n`);
		for (const error of errors) {
			console.error(`${error}\n`);
			// GitHub Actions의 실패 요약(annotation)에도 남긴다. 줄바꿈은 %0A로
			if (process.env.GITHUB_ACTIONS) console.log(`::error title=성능 예산::${error.replaceAll('\n', '%0A')}`);
		}
		process.exit(1);
	}
}
