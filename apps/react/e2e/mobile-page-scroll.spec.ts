import { test, enterDesktop } from './fixtures';
import { expectPageNotScrollable } from './pageScroll';

test('휴대폰에서도 바탕화면 영역은 스크롤되지 않는다', async ({ page }) => {
	await enterDesktop(page);
	await expectPageNotScrollable(page);

	// 홈 화면을 위로 끌어 올려도 문서는 제자리다
	const { width, height } = page.viewportSize()!;
	await page.touchscreen.tap(width / 2, height / 2);
	await page.evaluate(() => window.scrollBy(0, 300));
	await expectPageNotScrollable(page);
});
