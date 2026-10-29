import { test, expect, enterDesktop, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

// 저장소 글의 머리말 `series: 트래픽 분석`과 `seriesOrder`로 묶은 연재: analytics-api(1), analytics-collect(2), analytics-activity-monitor(3), …
const SERIES = '트래픽 분석';

test.describe('메모 연재', () => {
	test('연재 글은 제목 위에 연재 표시, 제목 아래에 같은 연재의 목록과 이전 편·다음 편을 보인다', async ({ page }) => {
		await enterDesktop(page, '/memo/analytics-collect');
		const memo = appWindow(page, 'memo');
		const article = memo.getByRole('article');
		const heading = article.getByRole('heading', { level: 1 });
		await expect(heading).toHaveText('sendBeacon으로 5초마다 묶어 보내는 방문 이벤트');
		await expect(article.locator('.memo-series-kicker')).toHaveText(`${SERIES} 2`);

		const series = memo.getByRole('navigation', { name: `연재: ${SERIES}` });
		const head = series.locator('.memo-series-head');
		await expect(head).toContainText(SERIES);
		await expect(head).toContainText(/2 \/ \d+/);

		// 목록은 연재 순서대로, 번호는 연재 안의 위치(1부터), 제목은 그대로. 지금 글은 aria-current.
		// 길면 앞의 5편만 보이고 그 아래 '⋯ N편 더보기'. 누르면 나머지가 아래로 펼쳐지고, 같은 자리의 '접기'로 되돌린다
		const total = Number((await head.textContent())?.match(/\/ (\d+)/)?.[1]);
		const items = series.getByRole('listitem');
		const more = series.getByRole('button', { name: /편 더보기$/ });
		await expect(items).toHaveCount(5);
		await expect(items.nth(0)).toHaveText(/^1\s*쿠키 없이/);
		await expect(items.nth(1).getByRole('button')).toHaveAttribute('aria-current', 'page');
		await expect(items.nth(4)).toHaveText(/^5\D/);
		await expect(more).toHaveText(`${total - 5}편 더보기`);
		await more.click();
		await expect(items).toHaveCount(total);
		await expect(more).toHaveCount(0);
		const fold = series.getByRole('button', { name: '접기' });
		await expect(fold).toHaveAttribute('aria-expanded', 'true');
		await expect(items.nth(total - 1)).toHaveText(new RegExp(`^${total}\\D`));
		await fold.click();
		await expect(items).toHaveCount(5);
		await more.click();
		await expect(items).toHaveCount(total);

		// 다음 편, 목록의 첫 편, 이전 편이 없는 첫 편
		await series.getByRole('button', { name: '다음 편' }).click();
		await expect(page).toHaveURL(/\/memo\/analytics-activity-monitor$/);
		await expect(article.locator('.memo-series-kicker')).toHaveText(`${SERIES} 3`);
		const box = memo.getByRole('navigation', { name: `연재: ${SERIES}` });
		await box.getByRole('listitem').first().getByRole('button').click();
		await expect(page).toHaveURL(/\/memo\/analytics-api$/);
		await expect(article.locator('.memo-series-kicker')).toHaveText(`${SERIES} 1`);
		await expect(box.getByRole('button', { name: /^이전 편/ })).toHaveCount(0);
	});

	test('글 목록 항목의 제목 앞에 연재 이름과 번호를 붙인다', async ({ page }) => {
		await enterDesktop(page, '/memo/analytics-collect');
		const memo = appWindow(page, 'memo');
		const item = memo.locator('.memo-item', { hasText: 'sendBeacon으로 5초마다' });
		await expect(item.locator('.memo-item-series')).toHaveText(`${SERIES} 2`);
	});

	test('연재가 아닌 글에는 머리말과 연재 상자가 없다', async ({ page }) => {
		await enterDesktop(page, '/memo/sproutfarm-icon');
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toBeVisible();
		await expect(memo.getByRole('navigation', { name: /^연재:/ })).toHaveCount(0);
		await expect(memo.locator('.memo-series-kicker')).toHaveCount(0);
	});

	test('관리자 편집 화면: 연재 상자를 보이고, 연재와 순서를 골라 임시 저장한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page, '/memo/analytics-collect');
		const memo = appWindow(page, 'memo');
		const title = memo.getByRole('textbox', { name: '제목' });
		await expect(title).toHaveValue('sendBeacon으로 5초마다 묶어 보내는 방문 이벤트');
		const box = memo.getByRole('navigation', { name: `연재: ${SERIES}` });
		await expect(box.locator('.memo-series-head')).toContainText(/2 \/ \d+/);
		await expect(memo.getByRole('spinbutton', { name: '연재 순서' })).toHaveValue('2');

		// 새 연재로 옮기고 순서를 적는다: 한 편뿐인 연재라 상자는 없다
		await memo.getByRole('button', { name: `연재 ${SERIES}, 바꾸기` }).click();
		await page.getByRole('menuitem', { name: '새 연재…' }).click();
		const name = memo.getByRole('textbox', { name: '새 연재 이름' });
		await name.fill('수집 실험');
		await name.press('Enter');
		await expect(memo.getByRole('button', { name: '연재 수집 실험, 바꾸기' })).toBeVisible();
		await memo.getByRole('spinbutton', { name: '연재 순서' }).fill('5');
		await expect(memo.getByRole('status').filter({ hasText: '임시 저장됨' })).toBeVisible();
		await expect
			.poll(() => api.posts.find((post) => post.slug === 'analytics-collect')?.draft)
			.toMatchObject({
				series: '수집 실험',
				seriesOrder: 5,
			});
		await expect(box).toHaveCount(0);

		// 기존 연재 목록에서 다시 고르면 상자가 돌아온다 (순서 칸은 그대로)
		await memo.getByRole('button', { name: '연재 수집 실험, 바꾸기' }).click();
		await page.getByRole('menuitemcheckbox', { name: SERIES }).click();
		await expect(box).toBeVisible();

		// 연재 없음: 순서 칸이 사라지고 저장한 글에서도 연재와 순서가 빠진다
		await memo.getByRole('button', { name: `연재 ${SERIES}, 바꾸기` }).click();
		await page.getByRole('menuitemcheckbox', { name: '연재 없음' }).click();
		await expect(memo.getByRole('spinbutton', { name: '연재 순서' })).toHaveCount(0);
		await expect(box).toHaveCount(0);
		await expect
			.poll(() => {
				const draft = api.posts.find((post) => post.slug === 'analytics-collect')?.draft;
				return draft && { series: draft.series, seriesOrder: draft.seriesOrder };
			})
			.toEqual({ series: undefined, seriesOrder: undefined });
	});
});
