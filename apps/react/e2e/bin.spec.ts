import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

/** 휴지통: 버린 기능을 모아 두고, 관리자에게는 지운 메모를 보여 준다 */
test.describe('휴지통', () => {
	test('Dock의 휴지통을 누르면 버린 기능이 보이고, 고르면 무엇으로 왜 바꿨는지 나온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const list = bin.getByRole('listbox', { name: '지운 기능' });
		await expect(list.getByRole('option')).not.toHaveCount(0);
		// 방문자에게는 지운 메모가 없다
		await expect(bin.getByRole('button', { name: /지운 메모/ })).toHaveCount(0);

		await list.getByRole('option', { name: /Create React App/ }).click();
		const info = bin.getByRole('region', { name: 'Create React App 정보' });
		await expect(info).toContainText('Vite');
		await expect(info).toContainText('5.05초');

		// 키보드로 옮겨 고른다 (최근에 버린 것이 위라 CRA는 맨 아래)
		await list.focus();
		await page.keyboard.press('ArrowUp');
		await expect(list.getByRole('option', { name: /Create React App/ })).toHaveAttribute('aria-selected', 'false');
	});

	test('개발 일지 읽기를 누르면 메모 앱이 그 글을 연다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('option', { name: /Create React App/ }).click();
		await bin.getByRole('button', { name: '개발 일지 읽기' }).click();

		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' })).toHaveClass(/active/);
	});

	test('바꾸기 전 모습을 크게 보고, 지운 줄 수와 커밋을 보여 준다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('option', { name: /방명록이던 메모 앱/ }).click();
		const info = bin.getByRole('region', { name: '방명록이던 메모 앱 정보' });
		await expect(info).toContainText('−1,253줄');
		await expect(info.getByRole('link', { name: '844688c' })).toHaveAttribute(
			'href',
			'https://github.com/hyeoniverse/MacFolio/commit/844688c42f90264ce2d4fdee407028c7e4489970'
		);

		// 누르면 크게, Esc로 닫는다
		await info.getByRole('button', { name: '바꾸기 전 모습 크게 보기' }).click();
		const look = bin.getByRole('dialog', { name: '방명록이던 메모 앱 바꾸기 전 모습' });
		await expect(look.getByRole('img')).toBeVisible();
		expect(await look.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
		await page.keyboard.press('Escape');
		await expect(look).toHaveCount(0);

		// 목록에서 스페이스로도 연다 (Finder의 훑어보기)
		await bin.getByRole('listbox', { name: '지운 기능' }).focus();
		await page.keyboard.press('Space');
		await expect(look).toBeVisible();
	});

	test('관리자에게도 휴지통에는 지운 기능만 있다 (지운 메모는 메모 앱의 최근 삭제된 항목에)', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await expect(bin.getByRole('navigation', { name: '휴지통' }).getByRole('button')).toHaveText([/지운 기능/]);
	});

	test('휴대폰 홈 화면에는 휴지통이 없다', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await enterDesktop(page);
		await expect(page.locator('[data-launch="bin"]')).toHaveCount(0);
		await expect(page.locator('[data-launch="memo"]')).toHaveCount(1);
	});
});
