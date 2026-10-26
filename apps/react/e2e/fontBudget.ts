import type { Page } from '@playwright/test';

/**
 * 첫 화면 글꼴 예산 (KB = 1,024바이트, 응답 본문 크기 합. woff2는 이미 압축되어 전송 크기와 거의 같다).
 * 첫 방문 번들 예산(scripts/perf/budget.mjs)은 index.html이 처음부터 요청하는 스크립트·CSS만 집계해, 화면을 그리며 받는 글꼴은 세지 않는다.
 * 2026-10-26 측정값(데스크톱 첫 화면 568KB, 휴대폰 홈 382KB)에 약 30KB를 더했다: 작은 조각 하나는 들어가고,
 * 명조 한글(약 440KB)이나 Pretendard ksx(약 250KB)가 첫 화면에 다시 들어오면 실패한다. 근거는 docs/performance.md의 '성능 예산'
 */
export const FONT_BUDGET = { desktopKB: 600, mobileKB: 410 };

const FONT_FILE = /\.(woff2?|ttf|otf)$/;

/** 페이지가 받은 글꼴 파일 (응답이 끝난 것). 부르는 시각부터 기록한다 */
export function trackFonts(page: Page) {
	const fonts: { file: string; bytes: number }[] = [];
	page.on('requestfinished', async (request) => {
		const path = new URL(request.url()).pathname;
		if (!FONT_FILE.test(path)) return;
		const { responseBodySize } = await request.sizes();
		fonts.push({ file: path.split('/').pop() ?? path, bytes: responseBodySize });
	});
	return fonts;
}

/** 글꼴을 다 받을 때까지 (document.fonts.ready 뒤 네트워크가 잠잠해질 때까지) */
export async function fontsSettled(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => document.fonts.ready);
}

/** 실패 메시지: 합계와 파일별 크기 */
export const fontReport = (fonts: { file: string; bytes: number }[]) =>
	[
		`글꼴 ${fonts.length}개, ${(fonts.reduce((sum, { bytes }) => sum + bytes, 0) / 1024).toFixed(1)}KB`,
		...[...fonts]
			.sort((a, b) => b.bytes - a.bytes)
			.map(({ file, bytes }) => `  ${(bytes / 1024).toFixed(1)}KB  ${file}`),
	].join('\n');

export const totalKB = (fonts: { bytes: number }[]) => fonts.reduce((sum, { bytes }) => sum + bytes, 0) / 1024;
