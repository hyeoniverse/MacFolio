import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeFiles } from './fakeFiles';
import { fakeApi } from './fakeApi';

/** Finder › 이력서에서 시험 PDF를 미리보기로 연다 */
async function openPdf(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'finder').click();
	const finder = appWindow(page, 'finder');
	await finder.getByRole('listbox', { name: '문서' }).getByRole('option', { name: '이력서', exact: true }).dblclick();
	await finder.getByRole('option', { name: '시험 이력서.pdf' }).dblclick();
	const preview = appWindow(page, 'preview');
	await expect(preview.getByText('1/3페이지')).toBeVisible();
	return preview;
}

test.describe('미리보기 슬라이드쇼', () => {
	test('⇧⌘F로 지금 쪽부터 한 쪽씩 보이고, Esc로 끝내면 끝낸 쪽을 보인다', async ({ page }) => {
		await fakeFiles(page);
		const preview = await openPdf(page);
		await preview.getByRole('document', { name: '시험 이력서.pdf' }).click();
		await page.keyboard.press('ControlOrMeta+Shift+KeyF');

		const show = page.getByRole('dialog', { name: '슬라이드쇼' });
		await expect(show).toBeVisible();
		await expect(show.getByRole('img', { name: '시험 이력서.pdf 1쪽' })).toBeVisible();
		await expect(show.getByText('1 / 3')).toBeAttached();
		await page.keyboard.press('ArrowRight');
		await expect(show.getByText('2 / 3')).toBeAttached();
		// 끝에서 더 넘기지 않고, Home·End로 처음·끝
		await page.keyboard.press('End');
		await expect(show.getByText('3 / 3')).toBeAttached();
		await page.keyboard.press('Space');
		await expect(show.getByText('3 / 3')).toBeAttached();
		await page.keyboard.press('Home');
		await expect(show.getByText('1 / 3')).toBeAttached();
		// 누르면 다음 쪽
		await show.locator('.slideshow-stage').click();
		await expect(show.getByText('2 / 3')).toBeAttached();

		await page.keyboard.press('Escape');
		await expect(show).toBeHidden();
		await expect(preview.getByText('2/3페이지')).toBeVisible();
	});

	test('보기 메뉴에서 시작하고, 조절 막대는 움직이면 보였다가 가만히 있으면 사라진다', async ({ page }) => {
		await fakeFiles(page);
		await openPdf(page);
		await page.getByRole('group', { name: '메뉴 막대' }).getByRole('button', { name: '보기', exact: true }).click();
		await page.getByRole('menuitem', { name: /슬라이드쇼/ }).click();

		const show = page.getByRole('dialog', { name: '슬라이드쇼' });
		const bar = show.getByRole('toolbar', { name: '슬라이드쇼 조절' });
		await expect(bar).toBeVisible();
		await bar.getByRole('button', { name: '다음 페이지' }).click();
		await expect(bar.getByText('2 / 3')).toBeVisible();
		await expect(show).toHaveClass(/idle/, { timeout: 5000 });
		await page.mouse.move(300, 300);
		await page.mouse.move(320, 310);
		await expect(show).not.toHaveClass(/idle/);
		await bar.getByRole('button', { name: '닫기' }).click();
		await expect(show).toBeHidden();
	});
});

test.describe('프로젝트 발표 자료', () => {
	test('발표 자료를 붙인 프로젝트는 Safari에 버튼이 있고, 누르면 미리보기에서 연다', async ({ page }) => {
		await fakeFiles(page);
		const api = await fakeApi(page);
		api.siteProjects = {
			items: [
				{ id: 'qru', override: { slides: 'resume/test.pdf' } },
				// 지운 파일: 버튼이 없다
				{ id: 'newpick', override: { slides: 'portfolio/gone.pdf' } },
			],
		};
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /NewPick/ }).click();
		await expect(
			safari
				.getByRole('tabpanel')
				.getByRole('link', { name: /GitHub에서 보기/ })
				.first()
		).toBeVisible();
		await expect(safari.getByRole('button', { name: /발표 자료 보기/ })).toHaveCount(0);

		await safari.getByRole('tab', { name: /QRU/i }).click();
		const button = safari
			.getByRole('tabpanel')
			.getByRole('button', { name: /발표 자료 보기/ })
			.first();
		await expect(button).toBeVisible();
		await button.click();
		const preview = appWindow(page, 'preview');
		await expect(preview.getByRole('heading', { level: 1 })).toHaveText('시험 이력서.pdf');
		await expect(preview.getByText('1/3페이지')).toBeVisible();
	});

	test('관리자: 시스템 설정의 프로젝트 편집에서 문서 PDF를 발표 자료로 고르면 저장된다', async ({ page }) => {
		await fakeFiles(page);
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '프로젝트', exact: true }).click();
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'MacFolio' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'MacFolio 편집' });
		const field = editor.getByRole('combobox', { name: '발표 자료' });
		// PDF만 고를 수 있다 (그림은 빠진다)
		await expect(field.getByRole('option')).toHaveText(['없음', '이력서 / 시험 이력서.pdf']);
		await field.selectOption({ label: '이력서 / 시험 이력서.pdf' });
		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		expect(api.siteProjects?.items.find((item) => item.id === 'macfolio')).toMatchObject({
			override: { slides: 'resume/test.pdf' },
		});
	});
});
