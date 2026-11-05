import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { layoutPost } from './memoLayoutPost';

async function enterHome(page: Page, path: string) {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

test.describe('휴대폰 메모: 목차와 이미지 배치', () => {
	test('목차 막대는 한 줄이고, 항목을 탭하면 그 제목으로 간다. 넘기면 위쪽 알약 바로 아래에 붙어 가리지 않고, 지금 읽는 절을 따라간다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page, '/memo/merge-strategies');
		const nav = page.getByRole('navigation', { name: '목차' });
		const items = nav.locator('.memo-toc-bar-list button');
		await expect(items.first()).toBeVisible();
		const tops = await items.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
		expect(new Set(tops).size).toBe(1);
		// 손가락으로 누르기 쉽게 항목은 높이 44px 이상이다
		for (const item of await items.all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		await expect(nav).not.toHaveAttribute('data-stuck', /.*/);
		// 떠 있는 목차 버튼은 없다
		await expect(page.getByRole('button', { name: '목차 보기' })).toHaveCount(0);

		const item = items.nth(2);
		const name = (await item.textContent())!.trim();
		await item.tap();
		const heading = page.locator('.memo-reader-body .memo-markdown').getByRole('heading', { name }).first();
		await expect(heading).toBeInViewport();
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		await expect(nav.locator('[aria-current="location"]')).toHaveText(name);
		// 붙은 막대는 위쪽 알약(공유·•••) 아래에 있어 가리지 않는다
		const pill = (await page.locator('.memo-phone-top').boundingBox())!;
		const bar = (await nav.boundingBox())!;
		expect(bar.y).toBeGreaterThanOrEqual(pill.y + pill.height);
		// 붙은 자리는 스크롤 칸이 본문을 그리기 시작하는 곳(위 여백 아래)이다
		const scroller = page.locator('.memo-reader .memo-scroll');
		const contentTop = await scroller.evaluate(
			(el) => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingTop)
		);
		expect(Math.abs(bar.y - contentTop)).toBeLessThanOrEqual(1);
		// 알약 뒤로 본문 글자가 비치지 않게 막대 위쪽을 바탕색으로 덮는다
		expect(await nav.evaluate((el) => getComputedStyle(el, '::before').content)).not.toBe('none');
		// 제목은 막대 아래에 보인다
		expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);

		// 더 넘기면 지금 읽는 절이 바뀐다
		await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
		await expect(nav.locator('[aria-current="location"]')).not.toHaveText(name);
		// 막대 바탕이 화면 폭을 넘쳐 가로 스크롤을 만들지 않는다
		expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	});

	test('띄운 이미지는 휴대폰에서 띄우지 않고 본문 폭으로 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [layoutPost()];
		await enterHome(page, '/memo/layout-test');
		const body = page.locator('.memo-reader-body .memo-markdown');
		const figure = body.locator('.memo-figure[data-layout="float-left"]');
		await expect(figure).toBeVisible();
		expect(await figure.evaluate((el) => getComputedStyle(el).float)).toBe('none');
		const [area, rect] = await Promise.all([body.boundingBox(), figure.boundingBox()]);
		expect(Math.abs(rect!.width - area!.width)).toBeLessThan(2);
	});
});
