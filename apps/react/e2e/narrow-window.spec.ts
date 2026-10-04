import { test, expect, enterDesktop, openFromDock, appWindow } from './fixtures';

// 창을 좁히면 앱이 휴대폰 모양으로 바뀌는데, 데스크톱에는 왼쪽 위에 신호등 단추(닫기·최소화·확대)가 그대로 있다.
// 그 아래로 제목이나 단추가 들어가 가려지지 않는지 창 폭마다 확인한다.
const APPS = ['music', 'messages', 'mail', 'memo', 'settings', 'github', 'safari', 'terminal', 'sproutfarm'];
const WIDTHS = [700, 560, 460, 380, 320];

for (const app of APPS) {
	test(`좁은 창: ${app}의 제목·단추가 신호등 단추에 가려지지 않는다`, async ({ page }) => {
		await enterDesktop(page);
		await openFromDock(page, app);
		const win = appWindow(page, app);
		await expect(win).toBeVisible();
		for (const width of WIDTHS) {
			await win.evaluate((el, value) => {
				(el as HTMLElement).style.width = `${value}px`;
				(el as HTMLElement).style.height = '640px';
			}, width);
			// 컨테이너 쿼리가 다시 계산될 때까지 한 프레임 기다린다
			await page.evaluate(() => new Promise(requestAnimationFrame));
			const covered = await win.evaluate((frame) => {
				const lights = frame.querySelector('.traffic-lights')!.getBoundingClientRect();
				return [...frame.querySelectorAll<HTMLElement>('button, a, input, h1, h2, h3, [role="tab"]')]
					.filter((el) => !el.closest('.traffic-lights'))
					.filter((el) => {
						const box = el.getBoundingClientRect();
						const style = getComputedStyle(el);
						if (!box.width || !box.height || style.visibility === 'hidden' || style.opacity === '0') return false;
						return (
							box.right > lights.left && box.left < lights.right && box.bottom > lights.top && box.top < lights.bottom
						);
					})
					.map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 20));
			});
			expect(covered, `${width}px`).toEqual([]);
		}
	});
}
