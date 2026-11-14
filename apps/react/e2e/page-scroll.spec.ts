import { test, enterDesktop, desktopPoint } from './fixtures';
import { expectPageNotScrollable } from './pageScroll';

test.describe('바탕화면 영역은 스크롤되지 않는다', () => {
	for (const [name, viewport] of [
		['데스크톱', { width: 1920, height: 1080 }],
		['노트북', { width: 1366, height: 768 }],
		['태블릿', { width: 820, height: 1180 }],
	] as const) {
		test(name, async ({ page }) => {
			await page.setViewportSize(viewport);
			await enterDesktop(page);
			await expectPageNotScrollable(page);

			// 바탕에서 휠·트랙패드로 굴려도 문서가 움직이지 않는다
			const point = await desktopPoint(page);
			await page.mouse.move(point.x, point.y);
			await page.mouse.wheel(300, 1200);
			await expectPageNotScrollable(page);
		});
	}
});
