import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

test.describe('메모 연재 상자', () => {
	test('연재 글은 제목 아래에 같은 연재의 목록과 이전 편·다음 편을 보인다', async ({ page }) => {
		await enterDesktop(page, '/memo/analytics-collect');
		const memo = appWindow(page, 'memo');
		const heading = memo.getByRole('article').getByRole('heading', { level: 1 });
		await expect(heading).toHaveText(/^트래픽 분석 2 - /);

		const series = memo.getByRole('navigation', { name: '연재: 트래픽 분석' });
		const toggle = series.getByRole('button', { name: /트래픽 분석/ });
		await expect(toggle).toContainText(/2\/\d+/);
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');

		// 목록은 번호 순, 지금 글은 aria-current
		const items = series.getByRole('listitem');
		expect(await items.count()).toBeGreaterThanOrEqual(3);
		await expect(items.nth(0)).toContainText('1');
		await expect(items.nth(1).getByRole('button')).toHaveAttribute('aria-current', 'page');

		// 다음 편, 목록의 다른 편, 이전 편
		await series.getByRole('button', { name: '다음 편' }).click();
		await expect(heading).toHaveText(/^트래픽 분석 3 - /);
		await expect(page).toHaveURL(/\/memo\/analytics-activity-monitor$/);
		await memo
			.getByRole('navigation', { name: '연재: 트래픽 분석' })
			.getByRole('listitem')
			.nth(0)
			.getByRole('button')
			.click();
		await expect(heading).toHaveText(/^트래픽 분석 1 - /);
		await expect(
			memo.getByRole('navigation', { name: '연재: 트래픽 분석' }).getByRole('button', { name: '이전 편' })
		).toHaveCount(0);

		// 접으면 목록이 사라진다
		await memo
			.getByRole('navigation', { name: '연재: 트래픽 분석' })
			.getByRole('button', { name: /트래픽 분석/ })
			.click();
		await expect(memo.getByRole('navigation', { name: '연재: 트래픽 분석' }).getByRole('listitem')).toHaveCount(0);
	});

	test('연재가 아닌 글에는 연재 상자가 없다', async ({ page }) => {
		await enterDesktop(page, '/memo/sproutfarm-icon');
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toBeVisible();
		await expect(memo.getByRole('navigation', { name: /^연재:/ })).toHaveCount(0);
	});

	test('관리자 편집 화면에도 제목 아래에 연재 상자가 있다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/analytics-collect');
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('textbox', { name: '제목' })).toHaveValue(/^트래픽 분석 2 - /);
		const series = memo.getByRole('navigation', { name: '연재: 트래픽 분석' });
		await expect(series.getByRole('button', { name: /트래픽 분석/ })).toContainText(/2\/\d+/);
		await series.getByRole('button', { name: '다음 편' }).click();
		await expect(memo.getByRole('textbox', { name: '제목' })).toHaveValue(/^트래픽 분석 3 - /);
	});
});
