import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

async function openFinder(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'finder').click();
	const finder = appWindow(page, 'finder');
	await expect(finder).toBeVisible();
	return finder;
}

const sidebar = (finder: ReturnType<typeof appWindow>) => finder.getByRole('navigation', { name: '즐겨찾기' });

test.describe('Finder', () => {
	test('문서 폴더에서 시작하고, 저장소 문서를 Finder 안에서 읽는다', async ({ page }) => {
		const finder = await openFinder(page);
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
		const files = finder.getByRole('listbox', { name: '문서' });
		await expect(files.getByRole('option', { name: 'README.md' })).toBeVisible();
		await expect(files.getByRole('option', { name: 'backend-design.md' })).toBeVisible();
		await expect(finder.locator('.finder-count')).toHaveText(/항목 \d+개/);

		// 한 번 누르면 고르고, 두 번 누르면 연다
		const readme = files.getByRole('option', { name: 'README.md' });
		await readme.click();
		await expect(readme).toHaveAttribute('aria-selected', 'true');
		await readme.dblclick();
		const doc = finder.getByRole('article', { name: 'README.md' });
		await expect(doc.getByRole('heading', { level: 1 })).toContainText('MacFolio');
		await expect(finder.getByRole('heading', { level: 1, name: 'README.md' })).toBeVisible();

		// 목록은 본문 안으로 들여 쓰고, 하위 목록은 한 단계 더 들여 쓴다
		const box = async (selector: string) => (await doc.locator(selector).first().boundingBox())!;
		const [body, list, nested] = [await box('p'), await box('ul > li'), await box('ul ul > li')];
		expect(list.x).toBeGreaterThan(body.x);
		expect(nested.x).toBeGreaterThan(list.x);

		// 다른 문서 링크는 Finder에서 열고, 뒤로 가면 돌아온다
		await doc.getByRole('link', { name: 'docs/backend-design.md' }).first().click();
		const design = finder.getByRole('article', { name: 'docs/backend-design.md' });
		await expect(design.getByRole('heading', { level: 1 })).toHaveText('백엔드 설계');
		// Mermaid 코드 블록은 그림으로
		await expect(design.locator('.finder-doc-mermaid svg').first()).toBeVisible({ timeout: 15_000 });
		await finder.getByRole('button', { name: '뒤로' }).click();
		await expect(finder.getByRole('article', { name: 'README.md' })).toBeVisible();
		await finder.getByRole('button', { name: '뒤로' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
		await finder.getByRole('button', { name: '앞으로' }).click();
		await expect(finder.getByRole('article', { name: 'README.md' })).toBeVisible();
	});

	test('빈 이력서 폴더에는 안내가 보인다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('option', { name: '이력서' }).dblclick();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('이력서');
		await expect(finder.getByText('공개용 이력서를 준비하고 있습니다.')).toBeVisible();
		await expect(finder.locator('.finder-count')).toHaveText('비어 있음');
		// 경로 막대로 위 폴더에
		await finder.getByRole('navigation', { name: '경로' }).getByRole('button', { name: '문서' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
	});

	test('목록 보기, 키보드로 고르고 열기', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '블로그' }).click();
		await finder.getByRole('button', { name: '목록으로 보기' }).click();
		await expect(finder.locator('.finder-list-head')).toContainText('수정일');
		const list = finder.getByRole('listbox', { name: '블로그' });
		await expect(list.getByRole('option', { name: /개발기/ })).toContainText('폴더');

		// ↓로 고르고 Enter로 들어간다, ⌘↑로 위 폴더로
		await finder.locator('.finder-content').focus();
		await page.keyboard.press('ArrowDown');
		await expect(list.getByRole('option', { name: /개발기/ })).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Enter');
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('개발기');
		await page.keyboard.press('Meta+ArrowUp');
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('블로그');
	});

	test('글을 열면 메모가 그 글을, 프로젝트를 열면 Safari가 그 탭을 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('searchbox', { name: '이름으로 찾기' }).fill('CRA에서 Vite로');
		await finder.getByRole('option', { name: 'CRA에서 Vite로 옮기기' }).dblclick();
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();

		await dockItem(page, 'finder').click();
		await sidebar(finder).getByRole('button', { name: '프로젝트' }).click();
		await finder.getByRole('option', { name: /QRU/ }).dblclick();
		const safari = appWindow(page, 'safari');
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveAttribute('aria-selected', 'true');

		// 닫아 둔 탭도 다시 연다
		await safari.getByRole('tab', { name: /QRU/ }).hover();
		await safari.getByRole('button', { name: /QRU.* 탭 닫기/ }).click();
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveCount(0);
		await dockItem(page, 'finder').click();
		await finder.getByRole('option', { name: /QRU/ }).dblclick();
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveAttribute('aria-selected', 'true');
	});

	test('응용 프로그램에서 앱을 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '응용 프로그램' }).click();
		await finder.getByRole('option', { name: '터미널' }).dblclick();
		await expect(appWindow(page, 'terminal')).toBeVisible();
	});

	test('찾는 이름이 없으면 알린다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('searchbox', { name: '이름으로 찾기' }).fill('없는이름zzz');
		await expect(finder.getByText('찾는 이름이 없습니다.')).toBeVisible();
	});
});
