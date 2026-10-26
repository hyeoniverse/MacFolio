import { test, expect } from './fixtures';
import { FONT_BUDGET, fontReport, fontsSettled, totalKB, trackFonts } from './fontBudget';

// 첫 화면 글꼴 예산 (fontBudget.ts): 휴대폰 홈 화면
test(`휴대폰 홈 화면이 받는 글꼴이 ${FONT_BUDGET.mobileKB}KB 이하다`, async ({ page }) => {
	const fonts = trackFonts(page);
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
	await fontsSettled(page);
	expect(totalKB(fonts), fontReport(fonts)).toBeLessThanOrEqual(FONT_BUDGET.mobileKB);
});
