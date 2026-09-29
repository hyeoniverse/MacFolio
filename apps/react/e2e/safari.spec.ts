import { test, expect, enterDesktop, appWindow } from './fixtures';

test.describe('Safari', () => {
	test('프로젝트마다 탭이 있고, 탭을 고르면 그 프로젝트 소개와 주소가 바뀐다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();

		const tabs = safari.getByRole('tab');
		await expect(tabs).toHaveCount(5);
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		const panel = safari.getByRole('tabpanel');
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('NewPick 뉴픽');

		await safari.getByRole('tab', { name: /QRU/ }).click();
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('QRU 큐알유');
		await expect(panel.getByRole('region', { name: '주요 기능' })).toBeVisible();
		// 주소창은 데모 주소를 보여주고, 누르면 새 탭에서 연다
		const address = safari.locator('.safari-address');
		await expect(address).toHaveText('qryou-app.web.app');
		await expect(address).toHaveAttribute('target', '_blank');
		await expect(panel.getByRole('link', { name: 'GitHub 저장소' })).toHaveAttribute(
			'href',
			'https://github.com/hyeoniverse/QRU'
		);

		// 이전·다음 탭
		await safari.getByRole('button', { name: '다음 탭' }).click();
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('SproutFarm 새싹 농장');
		await safari.getByRole('button', { name: '이전 탭' }).click();
		await expect(panel.getByRole('heading', { level: 1 })).toHaveText('QRU 큐알유');
	});

	test('데모가 없는 프로젝트는 주소창에 저장소 주소를 보여준다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /DevCourse/ }).click();
		await expect(safari.locator('.safari-address')).toHaveText('github.com/hyeoniverse/DevCourse-FullStack');
		await expect(safari.getByRole('link', { name: '데모 열기' })).toHaveCount(0);
		await expect(safari.getByRole('button', { name: '다음 탭' })).toBeDisabled();
	});
});
