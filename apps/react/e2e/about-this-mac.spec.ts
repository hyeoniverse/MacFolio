import { test, expect, enterDesktop, appWindow } from './fixtures';

test.describe('이 Mac에 관하여', () => {
	test('Apple 메뉴 맨 위에서 열면 만든 사람의 프로필이 보이고, 닫기·Esc로 닫는다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		const menu = page.getByRole('menu', { name: 'Apple 메뉴', exact: true });
		await expect(menu.getByRole('menuitem').first()).toHaveText('이 Mac에 관하여');
		await menu.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();

		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		await expect(about.getByRole('heading', { name: '김정현' })).toBeVisible();
		await expect(about).toContainText('Kim Jeong Hyeon');
		const specs = about.locator('.about-mac-specs > div');
		await expect(specs).toHaveText([
			'직무Frontend Focused Fullstack Developer',
			'학교서울여자대학교',
			'위치Seoul, South Korea',
			'이메일hyeoniverse.dev@gmail.com',
			'GitHubhyeoniverse',
			'주요 기술React · Next.js · TypeScript',
		]);
		await expect(about.getByRole('link', { name: 'hyeoniverse.dev@gmail.com' })).toHaveAttribute(
			'href',
			'mailto:hyeoniverse.dev@gmail.com'
		);
		// 메뉴는 닫히고, 닫기 단추에 초점
		await expect(menu).toBeHidden();
		await expect(about.getByRole('button', { name: '닫기' })).toBeFocused();

		await page.keyboard.press('Escape');
		await expect(about).toBeHidden();

		// 다시 열어 닫기 단추로
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await menu.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		await about.getByRole('button', { name: '닫기' }).click();
		await expect(about).toBeHidden();
	});

	test('빈 곳을 잡아 옮기고, 추가 정보…는 Safari를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		const before = (await about.boundingBox())!;
		const subtitle = (await about.locator('.about-mac-subtitle').boundingBox())!;
		await page.mouse.move(subtitle.x + 5, subtitle.y + 5);
		await page.mouse.down();
		await page.mouse.move(subtitle.x + 85, subtitle.y + 45, { steps: 5 });
		await page.mouse.up();
		const after = (await about.boundingBox())!;
		expect(Math.round(after.x - before.x)).toBe(80);
		expect(Math.round(after.y - before.y)).toBe(40);

		await about.getByRole('button', { name: '추가 정보…' }).click();
		await expect(about).toBeHidden();
		await expect(appWindow(page, 'safari')).toBeVisible();
	});
});
