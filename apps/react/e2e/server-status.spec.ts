import { test, expect, enterDesktop } from './fixtures';
import { fakeApi } from './fakeApi';

test.describe('메뉴 막대의 서버 상태 (Wi-Fi 자리)', () => {
	test('서버가 정상이면 막대가 차고, 누르면 상태·응답 시간·주소가 보인다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		const button = page.getByRole('button', { name: /^서버 상태: 정상, 응답 \d+ms$/ });
		await expect(button).toBeVisible();
		await expect(button.locator('svg')).not.toHaveAttribute('data-bars', '0');

		await button.click();
		const menu = page.getByRole('menu', { name: '서버 상태' });
		await expect(menu).toContainText('MacFolio API · 정상');
		await expect(menu).toContainText(/응답 \d+ms · (방금|\d+초 전) 확인/);
		await expect(menu).toContainText('api.test');
		await expect(menu.getByRole('menuitem', { name: 'API 문서 열기' })).toBeVisible();
	});

	test('DB가 안 되거나 서버가 꺼지면 바로 알 수 있다', async ({ page }) => {
		const api = await fakeApi(page);
		await enterDesktop(page);
		await expect(page.getByRole('button', { name: /^서버 상태: 정상/ })).toBeVisible();

		api.health = 'database';
		await page.getByRole('button', { name: /^서버 상태/ }).click();
		await page.getByRole('menu', { name: '서버 상태' }).getByRole('menuitem', { name: '지금 확인' }).click();
		const database = page.getByRole('button', { name: /^서버 상태: DB 연결 안 됨/ });
		await expect(database).toBeVisible();
		await expect(database.locator('svg')).toHaveAttribute('data-bars', '1');

		api.health = 'down';
		await database.click();
		const offline = page.getByRole('button', { name: '서버 상태: 서버에 연결할 수 없음' });
		await expect(offline).toBeVisible();
		await expect(offline.locator('svg')).toHaveAttribute('data-bars', '0');
		await expect(offline.locator('.slash')).toHaveCount(1);

		// 서버가 돌아오고 탭을 다시 보면 확인한다
		api.health = 'ok';
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await expect(page.getByRole('button', { name: /^서버 상태: 정상/ })).toBeVisible();
	});

	test('서버 주소가 없으면 막대가 비고, 연결된 서버가 없다고 알린다', async ({ page }) => {
		await enterDesktop(page);
		const button = page.getByRole('button', { name: '서버 상태: 연결된 서버 없음' });
		await expect(button.locator('svg')).toHaveAttribute('data-bars', '0');
		await button.click();
		await expect(page.getByRole('menu', { name: '서버 상태' })).toContainText('연결된 서버가 없습니다');
	});

	test('메뉴는 화면 오른쪽 끝에서도 잘리지 않는다 (열고 나서 내용이 길어져도)', async ({ page }) => {
		const api = await fakeApi(page);
		await enterDesktop(page);
		await expect(page.getByRole('button', { name: /^서버 상태: 정상/ })).toBeVisible();
		// 연 순간 다시 확인해서 '정상' → '서버에 연결할 수 없음'으로 길어진다
		api.health = 'down';
		await page.getByRole('button', { name: /^서버 상태/ }).click();
		const menu = page.getByRole('menu', { name: '서버 상태' });
		await expect(menu).toContainText('서버에 연결할 수 없음');
		const viewport = page.viewportSize()!;
		await expect
			.poll(async () => {
				const box = (await menu.boundingBox())!;
				return box.x + box.width <= viewport.width - 8 && box.x >= 8;
			})
			.toBe(true);
		// 글자가 메뉴 안에서 잘리지 않는다
		expect(
			await menu.evaluate((el) =>
				[...el.querySelectorAll('*')].every((child) => child.scrollWidth <= child.clientWidth + 1)
			)
		).toBe(true);
	});
});
