import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { FAKE_DOCUMENTS, fakeFiles } from './fakeFiles';
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
	test('프로젝트 폴더에 PDF가 있으면 Safari에 버튼이 있고, 이름순 첫 PDF를 미리보기에서 연다', async ({ page }) => {
		await fakeFiles(page, [
			...FAKE_DOCUMENTS,
			// 이름순으로 뒤라 열리지 않는다
			{ folder: 'project:macfolio', name: 'Z 부록.pdf', key: 'projects/macfolio/extra.pdf', kind: 'pdf' },
			// 그림만 있는 프로젝트 폴더: 버튼이 없다
			{ folder: 'project:qru', name: '구조도.png', key: 'projects/qru/a.png', kind: 'image' },
		]);
		await fakeApi(page);
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /QRU/i }).click();
		await expect(
			safari
				.getByRole('tabpanel')
				.getByRole('link', { name: /GitHub에서 보기/ })
				.first()
		).toBeVisible();
		await expect(safari.getByRole('button', { name: /발표 자료 보기/ })).toHaveCount(0);

		await safari.getByRole('tab', { name: /MacFolio/ }).click();
		const button = safari
			.getByRole('tabpanel')
			.getByRole('button', { name: /발표 자료 보기/ })
			.first();
		await expect(button).toBeVisible();
		await button.click();
		const preview = appWindow(page, 'preview');
		await expect(preview.getByRole('heading', { level: 1 })).toHaveText('MacFolio 발표.pdf');
		await expect(preview.getByText('1/3페이지')).toBeVisible();
	});

	test('프로젝트 폴더에 PDF가 없으면 버튼이 없다', async ({ page }) => {
		await fakeFiles(
			page,
			FAKE_DOCUMENTS.filter((entry) => !entry.folder.startsWith('project:'))
		);
		await fakeApi(page);
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /MacFolio/ }).click();
		await expect(
			safari
				.getByRole('tabpanel')
				.getByRole('link', { name: /GitHub에서 보기/ })
				.first()
		).toBeVisible();
		await expect(safari.getByRole('button', { name: /발표 자료 보기/ })).toHaveCount(0);
	});
});
