import type { Page } from '@playwright/test';
import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import { FAKE_DOCUMENTS, fakeFiles } from './fakeFiles';

// 서버 목록의 id가 있어야 관리자가 옮기고 이름을 바꾼다
const DOCUMENTS = FAKE_DOCUMENTS.map((doc, i) => ({ ...doc, id: `doc${i}` }));

const bar = (page: Page) => page.getByRole('group', { name: '메뉴 막대' });
const desktop = (page: Page) => page.getByRole('listbox', { name: '바탕화면' });
const sidebar = (finder: ReturnType<typeof appWindow>) => finder.getByRole('navigation', { name: '즐겨찾기' });

async function openFinder(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'finder').click();
	const finder = appWindow(page, 'finder');
	await expect(finder).toBeVisible();
	return finder;
}

/** 메뉴 막대의 파일 메뉴 */
async function fileMenu(page: Page) {
	await bar(page).getByRole('button', { name: '파일', exact: true }).click();
	const menu = page.getByRole('menu', { name: '파일', exact: true });
	await expect(menu).toBeVisible();
	return menu;
}

test.describe('Finder 파일 시스템 (관리자)', () => {
	test('문서에 새 폴더를 만들고 이름을 바꾼 뒤 PDF를 끌어 넣는다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await fakeFiles(page, DOCUMENTS);
		const finder = await openFinder(page);
		const docs = finder.getByRole('listbox', { name: '문서' });

		// 파일 › 새 폴더: 이름 없는 폴더가 이름 편집 상태로 생긴다
		await (await fileMenu(page)).getByRole('menuitem', { name: /새 폴더/ }).click();
		const name = finder.getByRole('textbox', { name: '이름' });
		await expect(name).toHaveValue('이름 없는 폴더');
		await name.fill('발표 자료');
		await name.press('Enter');
		await expect(docs.getByRole('option', { name: '발표 자료' })).toBeVisible();
		await expect.poll(() => api.finderLayout.folders.map((folder) => folder.name)).toEqual(['발표 자료']);

		// 같은 이름은 경고창
		await docs.getByRole('option', { name: '이력서' }).click({ button: 'right' });
		await expect(page.getByRole('menuitem', { name: '이름 변경' })).toBeDisabled();
		await page.keyboard.press('Escape');
		await docs.getByRole('option', { name: '발표 자료' }).click();
		await finder.locator('.finder-content').press('Enter');
		await finder.getByRole('textbox', { name: '이름' }).fill('이력서');
		await finder.getByRole('textbox', { name: '이름' }).press('Enter');
		await expect(page.getByRole('alertdialog')).toContainText('이미 사용 중');
		await page.getByRole('alertdialog').getByRole('button', { name: '확인' }).click();

		// 이력서 폴더의 PDF를 끌어 발표 자료 폴더 위에 (사이드바 문서로 돌아가는 대신 경로 막대에 놓아도 된다)
		await docs.getByRole('option', { name: '이력서', exact: true }).dblclick();
		const resume = finder.getByRole('listbox', { name: '이력서' });
		const pdf = resume.getByRole('option', { name: '시험 이력서.pdf' });
		await pdf.dragTo(finder.getByRole('navigation', { name: '경로' }).getByRole('button', { name: '문서' }));
		await expect(pdf).toHaveCount(0);
		await expect.poll(() => api.finderLayout.files).toEqual({ 'file:resume/test.pdf': 'docs' });
		await sidebar(finder).getByRole('button', { name: '문서' }).click();
		await docs.getByRole('option', { name: '시험 이력서.pdf' }).dragTo(docs.getByRole('option', { name: '발표 자료' }));
		const folderId = api.finderLayout.folders[0].id;
		await expect.poll(() => api.finderLayout.files).toEqual({ 'file:resume/test.pdf': folderId });
		await docs.getByRole('option', { name: '발표 자료' }).dblclick();
		await expect(finder.getByRole('listbox', { name: '발표 자료' }).getByRole('option')).toHaveText([
			/시험 이력서.pdf/,
		]);
	});

	test('바탕화면에서 새 폴더를 만들고 Finder 폴더로 끌어 넣는다 (가상본은 화살표)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await fakeFiles(page, DOCUMENTS);
		await enterDesktop(page);
		await expect(desktop(page).locator('.finder-alias-badge')).toHaveCount(4);

		// 빈 곳 오른쪽 클릭 › 새 폴더
		const size = page.viewportSize()!;
		await page.mouse.click(size.width - 320, 480, { button: 'right' });
		await page.getByRole('menuitem', { name: '새 폴더' }).click();
		const name = desktop(page).getByRole('textbox', { name: '이름' });
		await expect(name).toHaveValue('이름 없는 폴더');
		await name.fill('작업');
		await name.press('Enter');
		const work = desktop(page).getByRole('option', { name: '작업', exact: true });
		await expect(work).toBeVisible();
		await expect.poll(() => api.finderLayout.folders).toMatchObject([{ name: '작업', parent: 'desktop' }]);

		// Finder의 데스크탑 위치에도 같은 폴더가 있다
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		await sidebar(finder).getByRole('button', { name: '데스크탑' }).click();
		await expect(finder.getByRole('listbox', { name: '데스크탑' }).getByRole('option', { name: '작업' })).toBeVisible();

		// 바탕화면의 작업 폴더를 Finder 사이드바의 문서 위로 끈다
		await sidebar(finder).getByRole('button', { name: '프로젝트' }).click();
		const box = (await work.boundingBox())!;
		const target = (await sidebar(finder).getByRole('button', { name: '문서' }).boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + 30);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 - 20, box.y + 40, { steps: 3 });
		await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
		await expect(sidebar(finder).getByRole('button', { name: '문서' })).toHaveClass(/drop-target/);
		await page.mouse.up();
		await expect.poll(() => api.finderLayout.folders).toMatchObject([{ name: '작업', parent: 'docs' }]);
		await expect(work).toHaveCount(0);
		await sidebar(finder).getByRole('button', { name: '문서' }).click();
		await expect(finder.getByRole('listbox', { name: '문서' }).getByRole('option', { name: '작업' })).toBeVisible();
	});

	test('블로그 폴더 이름을 Finder에서 바꾸면 메모도 그 이름을 쓴다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true, organization: { folders: ['읽을거리'] as never[] } });
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '블로그' }).click();
		const blog = finder.getByRole('listbox', { name: '블로그' });
		await blog.getByRole('option', { name: '읽을거리' }).click();
		await (await fileMenu(page)).getByRole('menuitem', { name: /이름 변경/ }).click();
		const name = finder.getByRole('textbox', { name: '이름' });
		await name.fill('모음');
		await name.press('Enter');
		await expect(blog.getByRole('option', { name: '모음' })).toBeVisible();
		await expect.poll(() => api.organization.folders).toEqual(['모음']);

		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await expect(
			memo.getByRole('navigation', { name: '카테고리' }).getByRole('button', { name: /^모음/ })
		).toBeVisible();
	});
});

test.describe('Finder 파일 시스템 (방문자)', () => {
	test('같은 구조를 보지만 새 폴더·이름 변경·옮기기는 할 수 없다', async ({ page }) => {
		const api = await fakeApi(page);
		api.finderLayout = {
			folders: [{ id: 'folder:shared1', name: '공유 폴더', parent: 'docs' }],
			files: { 'file:resume/test.pdf': 'folder:shared1' },
			aliases: null,
		};
		await fakeFiles(page, DOCUMENTS);
		const finder = await openFinder(page);
		const docs = finder.getByRole('listbox', { name: '문서' });
		await expect(docs.getByRole('option', { name: '공유 폴더' })).toBeVisible();

		const menu = await fileMenu(page);
		await expect(menu.getByRole('menuitem', { name: /새 폴더/ })).toBeDisabled();
		await page.keyboard.press('Escape');

		await docs.getByRole('option', { name: '공유 폴더' }).click({ button: 'right' });
		await expect(page.getByRole('menuitem', { name: '이름 변경' })).toBeDisabled();
		await expect(page.getByRole('menuitem', { name: '휴지통으로 이동' })).toBeDisabled();
		await page.keyboard.press('Escape');

		// Enter는 이름 편집이 아니라 연다
		await docs.getByRole('option', { name: '공유 폴더' }).click();
		await finder.locator('.finder-content').press('Enter');
		const shared = finder.getByRole('listbox', { name: '공유 폴더' });
		await expect(shared.getByRole('option', { name: '시험 이력서.pdf' })).toBeVisible();
		await expect(shared.getByRole('option', { name: '시험 이력서.pdf' })).toHaveAttribute('draggable', 'false');

		// 끌어도 아무 일이 없다
		await shared
			.getByRole('option', { name: '시험 이력서.pdf' })
			.dragTo(finder.getByRole('navigation', { name: '경로' }).getByRole('button', { name: '문서' }));
		await expect(shared.getByRole('option', { name: '시험 이력서.pdf' })).toBeVisible();
		expect(api.layoutSaves).toBe(0);

		// 바탕화면 오른쪽 클릭 메뉴의 새 폴더도 흐리다
		const size = page.viewportSize()!;
		await page.mouse.click(size.width - 320, 480, { button: 'right' });
		await expect(page.getByRole('menuitem', { name: '새 폴더' })).toBeDisabled();
	});
});
