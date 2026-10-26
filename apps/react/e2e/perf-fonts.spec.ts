import { test, expect, enterDesktop } from './fixtures';
import { FONT_BUDGET, fontReport, fontsSettled, totalKB, trackFonts } from './fontBudget';

// 첫 화면 글꼴 예산 (fontBudget.ts). 글꼴은 화면에 그린 글자에 따라 받으므로 빌드 결과(dist)만 보아서는 알 수 없어, 실제 브라우저로 잰다
test.describe('성능 예산: 첫 화면 글꼴', () => {
	test(`데스크톱 첫 화면이 받는 글꼴이 ${FONT_BUDGET.desktopKB}KB 이하다 (명조 한글은 Safari를 볼 때까지 받지 않는다)`, async ({
		page,
	}) => {
		const fonts = trackFonts(page);
		await enterDesktop(page);
		await fontsSettled(page);
		expect(totalKB(fonts), fontReport(fonts)).toBeLessThanOrEqual(FONT_BUDGET.desktopKB);
		// Safari 창이 열려 있어도 한글 명조 조각은 받지 않는다 (라틴 조각 하나만)
		expect(
			fonts.filter(({ file }) => /noto-serif-kr-(?!latin)/.test(file)).map(({ file }) => file),
			fontReport(fonts)
		).toEqual([]);
	});

	test('Safari 창을 누르면 한글 명조를 받는다', async ({ page }) => {
		const fonts = trackFonts(page);
		await enterDesktop(page);
		await fontsSettled(page);
		await page.locator('[data-app="safari"] .safari-page').click({ position: { x: 40, y: 200 } });
		await expect.poll(() => fonts.some(({ file }) => /noto-serif-kr-(?!latin)/.test(file))).toBe(true);
	});
});
