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
	test('목차 블록에서 제목을 탭하면 그 제목으로 가고, 위 왼쪽 뒤로 버튼 옆에 목차 버튼이 떠서 모든 제목을 펼친다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page, '/memo/merge-strategies');
		const nav = page.getByRole('navigation', { name: '목차 막대' });
		const toc = page.getByRole('navigation', { name: '목차', exact: true });
		// 목차 블록: 접힌 채 시작하고, 줄은 손가락으로 누르기 쉽게 44px 이상
		const toggle = toc.getByRole('button', { name: '목차', exact: true });
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		// 맨 위에서는 막대가 감춰져 있다. 떠 있는 목차 버튼은 없다
		await expect(nav).toBeHidden();
		await expect(page.getByRole('button', { name: '목차 보기' })).toHaveCount(0);

		// 블록을 펼쳐 셋째 제목을 탭한다
		await toggle.tap();
		const item = toc.locator('.memo-toc-list button').nth(2);
		expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
		const name = (await item.textContent())!.trim();
		await item.tap();
		const heading = page.locator('.memo-reader-body .memo-markdown').getByRole('heading', { name }).first();
		await expect(heading).toBeInViewport();
		await expect(nav).toHaveAttribute('data-stuck', 'true');
		// 휴대폰에서는 한 줄 막대 대신 떠 있는 목차 버튼 하나: 이전·현재·다음은 감추고, 버튼은 위 왼쪽 뒤로 버튼 바로 오른쪽에 같은 높이로 놓인다
		const tocButton = nav.getByRole('button', { name: '모든 제목 보기', exact: true });
		await expect(tocButton).toBeVisible();
		await expect(nav.locator('.memo-toc-bar-current')).toBeHidden();
		await expect(nav.locator('.memo-toc-bar-step')).toHaveCount(2);
		for (const step of await nav.locator('.memo-toc-bar-step').all()) await expect(step).toBeHidden();
		const back = (await page.locator('.mobile-navbar-home').boundingBox())!;
		const button = (await tocButton.boundingBox())!;
		expect(button.width).toBeGreaterThanOrEqual(44);
		expect(button.height).toBeGreaterThanOrEqual(44);
		expect(Math.abs(button.y - back.y)).toBeLessThanOrEqual(1);
		expect(button.x).toBeGreaterThan(back.x + back.width);
		expect(button.x - (back.x + back.width)).toBeLessThanOrEqual(12);
		// 본문을 넘겨도 버튼은 제자리에 있다
		const scroller = page.locator('.memo-reader .memo-scroll');
		await scroller.evaluate((el) => el.scrollBy(0, 600));
		await expect.poll(async () => Math.round((await tocButton.boundingBox())!.y)).toBe(Math.round(button.y));
		// 제목은 위쪽 버튼 줄 아래에 보인다
		await heading.evaluate((el) => el.scrollIntoView({ block: 'start' }));
		expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(back.y + back.height - 1);

		// 버튼을 누르면 지금 읽는 제목을 표시한 목록이 펼쳐지고, 고르면 그 제목으로 가서 닫힌다
		await tocButton.tap();
		const list = nav.locator('.memo-toc-bar-list');
		await expect(list.locator('[aria-current="location"]')).toHaveText(name);
		const last = list.locator('button').last();
		const lastName = (await last.textContent())!.trim();
		await last.tap();
		await expect(list).toHaveCount(0);
		await expect(
			page.locator('.memo-reader-body .memo-markdown').getByRole('heading', { name: lastName }).last()
		).toBeInViewport();
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
