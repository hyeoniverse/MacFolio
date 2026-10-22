// 성능 측정: Lighthouse(첫 로딩)와 Playwright(들어간 뒤 받는 양·걸린 시간·메모리)를 같은 조건으로 여러 번 재 가운데값을 낸다.
// 사용: node scripts/perf/serve.mjs dist 4810 & node scripts/perf/measure.mjs http://localhost:4810 결과.json [횟수]
// THROTTLING=devtools를 붙이면 Lighthouse가 브라우저를 실제로 느리게 해서 잰다 (기본은 빠르게 받은 기록으로 느린 망을 계산하는 simulate)
// Lighthouse는 pnpm dlx lighthouse@12.8.2로 돌린다 (의존성에 넣지 않는다). 크롬은 Playwright가 받은 것을 쓴다
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, devices } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:4810';
const out = process.argv[3] ?? 'perf.json';
const runs = Number(process.argv[4] ?? 3);
const throttling = process.env.THROTTLING === 'devtools' ? ['--throttling-method=devtools'] : [];
const chrome = chromium.executablePath();
const median = (values) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
};

/** Lighthouse 한 번: 점수와 주요 수치 */
function lighthouse(form) {
	const dir = mkdtempSync(join(tmpdir(), 'lh-'));
	const file = join(dir, 'report.json');
	execFileSync(
		'pnpm',
		[
			'dlx',
			'lighthouse@12.8.2',
			`${base}/`,
			'--quiet',
			'--chrome-flags=--headless=new',
			'--only-categories=performance',
			...throttling,
			'--output=json',
			`--output-path=${file}`,
			...(form === 'desktop' ? ['--preset=desktop'] : []),
		],
		{ env: { ...process.env, CHROME_PATH: chrome }, stdio: 'ignore' }
	);
	const report = JSON.parse(readFileSync(file, 'utf8'));
	const audit = (id) => report.audits[id].numericValue;
	const requests = report.audits['network-requests'].details.items;
	const byType = (type) => requests.filter((r) => r.resourceType === type).reduce((sum, r) => sum + r.transferSize, 0);
	return {
		score: Math.round(report.categories.performance.score * 100),
		fcp: audit('first-contentful-paint'),
		lcp: audit('largest-contentful-paint'),
		tbt: audit('total-blocking-time'),
		cls: audit('cumulative-layout-shift'),
		si: audit('speed-index'),
		bytes: audit('total-byte-weight'),
		requests: requests.length,
		script: byType('Script'),
		font: byType('Font'),
		image: byType('Image'),
		media: byType('Media'),
	};
}

/**
 * 들어가기: 로딩 화면이 뜨는 데 걸린 시간, 눌러 들어가 바탕화면(휴대폰은 홈 화면)이 뜨는 데 걸린 시간,
 * 들어간 뒤 3초까지 받은 양(종류별), JS 힙. 스로틀 없이 (Lighthouse가 느린 망·CPU를 맡는다)
 */
async function enter(form) {
	const browser = await chromium.launch();
	const context = await browser.newContext(
		form === 'mobile' ? { ...devices['iPhone 13'], browserName: undefined } : { viewport: { width: 1440, height: 900 } }
	);
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send('Network.enable');
	await cdp.send('Performance.enable');
	const sizes = new Map();
	const types = new Map();
	cdp.on('Network.responseReceived', (e) => types.set(e.requestId, e.type));
	cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
	const total = () => {
		const sum = { all: 0, Script: 0, Font: 0, Image: 0, Media: 0, requests: sizes.size };
		for (const [id, size] of sizes) {
			sum.all += size;
			const type = types.get(id);
			if (type in sum) sum[type] += size;
		}
		return sum;
	};

	const start = Date.now();
	await page.goto(`${base}/`);
	const loading = page.locator('.loading-container');
	await loading.waitFor({ state: 'visible' });
	const loadingShown = Date.now() - start;
	await page.waitForLoadState('networkidle');
	const beforeEnter = total();

	const tapped = Date.now();
	await (form === 'mobile' ? loading.tap() : loading.click());
	await page.locator(form === 'mobile' ? '.mobile-home' : '.dock').waitFor({ state: 'visible' });
	const entered = Date.now() - tapped;
	await page.waitForTimeout(3000);
	const afterEnter = total();
	const { metrics } = await cdp.send('Performance.getMetrics');
	const heap = metrics.find((m) => m.name === 'JSHeapUsedSize').value;
	await browser.close();
	return { loadingShown, entered, beforeEnter, afterEnter, heap };
}

const result = { base, runs, date: new Date().toISOString() };
for (const form of ['mobile', 'desktop']) {
	const lh = Array.from({ length: runs }, () => lighthouse(form));
	const en = [];
	for (let i = 0; i < runs; i++) en.push(await enter(form));
	const pick = (list, key) => median(list.map((item) => key(item)));
	result[form] = {
		lighthouse: Object.fromEntries(Object.keys(lh[0]).map((key) => [key, pick(lh, (r) => r[key])])),
		enter: {
			loadingShown: pick(en, (r) => r.loadingShown),
			entered: pick(en, (r) => r.entered),
			beforeEnter: Object.fromEntries(
				Object.keys(en[0].beforeEnter).map((k) => [k, pick(en, (r) => r.beforeEnter[k])])
			),
			afterEnter: Object.fromEntries(Object.keys(en[0].afterEnter).map((k) => [k, pick(en, (r) => r.afterEnter[k])])),
			heap: pick(en, (r) => r.heap),
		},
		raw: { lighthouse: lh, enter: en },
	};
	console.log(form, JSON.stringify(result[form].lighthouse), JSON.stringify(result[form].enter));
}
writeFileSync(out, JSON.stringify(result, null, '\t'));
