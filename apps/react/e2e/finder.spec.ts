import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeFiles } from './fakeFiles';

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

		// ↓로 고르고 Enter로 들어간다, ⌘↑로 위 폴더로 (블로그 글은 모두 개발기 › MacFolio 아래에 있다)
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
		// 프로젝트마다 폴더: 들어가면 프로젝트가 맨 위에
		await finder.getByRole('listbox', { name: '프로젝트' }).getByRole('option', { name: /QRU/ }).dblclick();
		await finder.getByRole('listbox', { name: /QRU/ }).getByRole('option').first().dblclick();
		const safari = appWindow(page, 'safari');
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveAttribute('aria-selected', 'true');

		// 닫아 둔 탭도 다시 연다
		await safari.getByRole('tab', { name: /QRU/ }).hover();
		await safari.getByRole('button', { name: /QRU.* 탭 닫기/ }).click();
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveCount(0);
		await dockItem(page, 'finder').click();
		await finder.getByRole('listbox', { name: /QRU/ }).getByRole('option').first().dblclick();
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveAttribute('aria-selected', 'true');
	});

	test('응용 프로그램에서 앱을 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '응용 프로그램' }).click();
		await finder.getByRole('option', { name: '터미널' }).dblclick();
		await expect(appWindow(page, 'terminal')).toBeVisible();
	});

	test('사진: 프로젝트 › MacFolio › 사진 폴더에 사진 앱의 그림이 있고, 미리보기에서 연다', async ({ page }) => {
		const finder = await openFinder(page);
		// 사진은 따로 된 위치가 없다 (프로젝트 폴더 안에만)
		await expect(sidebar(finder).getByRole('button', { name: '사진' })).toHaveCount(0);
		await sidebar(finder).getByRole('button', { name: '프로젝트' }).click();
		await finder
			.getByRole('listbox', { name: '프로젝트' })
			.getByRole('option', { name: 'MacFolio', exact: true })
			.dblclick();
		await finder
			.getByRole('listbox', { name: 'MacFolio' })
			.getByRole('option', { name: '사진', exact: true })
			.dblclick();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('사진');
		const photo = finder.getByRole('listbox', { name: '사진' }).getByRole('option').first();
		const name = (await photo.textContent())!.trim();
		await photo.dblclick();
		const preview = appWindow(page, 'preview');
		await expect(preview.getByRole('heading', { level: 1 })).toHaveText(name);
		await expect(preview.locator('.preview-image img')).toHaveAttribute('src', /^\/imgs\/projects\/macfolio\//);
	});

	test('찾는 이름이 없으면 알린다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('searchbox', { name: '이름으로 찾기' }).fill('없는이름zzz');
		await expect(finder.getByText('찾는 이름이 없습니다.')).toBeVisible();
	});

	test('도구 막대의 제목 자리를 두 번 누르면 창이 커진다 (버튼·찾기 칸만 끌기 영역 위에 있다)', async ({ page }) => {
		const finder = await openFinder(page);
		const title = (await finder.locator('.finder-title').boundingBox())!;
		const before = (await finder.boundingBox())!;
		await page.mouse.dblclick(title.x + 10, title.y + title.height / 2);
		await expect.poll(async () => (await finder.boundingBox())!.width).toBeGreaterThan(before.width);
		// 버튼은 그대로 눌린다
		await finder.getByRole('button', { name: '목록으로 보기' }).click();
		await expect(finder.locator('.finder-list-head')).toBeVisible();
	});

	test.describe('문서 파일 (R2)', () => {
		test('빈 이력서·포트폴리오·자격증 폴더는 폴더마다 안내를 보인다', async ({ page }) => {
			await fakeFiles(page, []);
			const finder = await openFinder(page);
			const docs = finder.getByRole('listbox', { name: '문서' });
			for (const [name, note] of [
				['이력서', '공개용 이력서를 준비하고 있습니다.'],
				['포트폴리오', '포트폴리오 파일을 준비하고 있습니다.'],
				['자격증', '자격증 사본을 준비하고 있습니다.'],
			]) {
				await docs.getByRole('option', { name, exact: true }).dblclick();
				await expect(finder.getByRole('heading', { level: 1 })).toHaveText(name);
				await expect(finder.getByText(note)).toBeVisible();
				await finder.getByRole('button', { name: '뒤로' }).click();
			}
		});

		test('PDF는 미리보기 앱이 직접 그린다: 쪽 그림 사이드바, 쪽 넘기기, 찾기, 다운로드', async ({ page }) => {
			const requests = await fakeFiles(page);
			const finder = await openFinder(page);
			await finder
				.getByRole('listbox', { name: '문서' })
				.getByRole('option', { name: '이력서', exact: true })
				.dblclick();
			await finder.getByRole('option', { name: '시험 이력서.pdf' }).dblclick();

			const preview = appWindow(page, 'preview');
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('시험 이력서.pdf');
			await expect.poll(() => requests).toContain('/files/resume/test.pdf');
			// 브라우저 PDF 보기(iframe)가 아니라 쪽마다 캔버스와 글자 층
			await expect(preview.locator('iframe')).toHaveCount(0);
			const doc = preview.getByRole('document', { name: '시험 이력서.pdf' });
			await expect(doc.getByRole('group', { name: /쪽$/ })).toHaveCount(3);
			await expect(doc.getByRole('group', { name: '1쪽' }).locator('.textLayer')).toContainText('MacFolio test PDF');
			await expect(preview.getByText('1/3페이지')).toBeVisible();
			// 공유 메뉴: 다운로드(?download=1)·새 탭
			await preview.getByRole('button', { name: '공유' }).click();
			const download = page.waitForEvent('download');
			await page.getByRole('menu', { name: '공유' }).getByRole('menuitem', { name: '다운로드' }).click();
			expect((await download).url()).toMatch(/\/files\/resume\/test\.pdf\?download=1$/);
			// 정보: 종류와 쪽 수
			await preview.getByRole('button', { name: '정보' }).click();
			await expect(page.getByRole('menu', { name: '정보' })).toContainText('PDF 문서 · 3페이지');
			await page.keyboard.press('Escape');

			// 쪽이 여럿이라 사이드바가 열려 있고, 쪽 그림을 누르면 그 쪽으로
			const sidebar = preview.getByRole('navigation', { name: '사이드바' });
			await expect(sidebar.getByRole('button', { name: /^\d쪽$/ })).toHaveCount(3);
			await sidebar.getByRole('button', { name: '3쪽' }).click();
			await expect(preview.getByText('3/3페이지')).toBeVisible();
			await expect(sidebar.getByRole('button', { name: '3쪽' })).toHaveAttribute('aria-current', 'page');
			// ←로 앞 쪽
			await doc.focus();
			await page.keyboard.press('ArrowLeft');
			await expect(preview.getByText('2/3페이지')).toBeVisible();

			// 찾기: 쪽마다 'Page'가 하나, Enter로 다음 결과
			const search = preview.getByRole('searchbox', { name: '찾기' });
			await search.fill('page');
			await expect(preview.getByText('1/3', { exact: true })).toBeVisible();
			await expect(doc.locator('mark.preview-hit.current')).toHaveText('Page');
			await search.press('Enter');
			await expect(preview.getByText('2/3', { exact: true })).toBeVisible();
			await search.fill('없는 말');
			await expect(preview.getByText('없음')).toBeVisible();

			// 배율: 맞춤 → 축소 단계
			const before = (await doc.getByRole('group', { name: '1쪽' }).boundingBox())!.width;
			await preview.getByRole('button', { name: '축소' }).click();
			await expect
				.poll(async () => (await doc.getByRole('group', { name: '1쪽' }).boundingBox())!.width)
				.toBeLessThan(before);

			// 사이드바 가리기
			await preview.getByRole('button', { name: '사이드바 가리기' }).click();
			await expect(sidebar).toHaveCount(0);

			// 빨간 버튼으로 닫고 다시 열면 이전 파일이 아니라 열기 창 (macOS 미리보기처럼)
			await preview.locator('.traffic-lights').getByRole('button', { name: '닫기' }).click();
			await expect(preview).toBeHidden();
			await dockItem(page, 'launchpad').click();
			await page.locator('.launchpad-modal').getByRole('button', { name: 'preview', exact: true }).click();
			await expect(preview.getByRole('dialog', { name: '열기' })).toBeVisible();
		});

		test('그림도 미리보기 앱에서 열리고, 파일을 더 열면 사이드바에 파일마다 묶인다', async ({ page }) => {
			await fakeFiles(page);
			const finder = await openFinder(page);
			const docs = finder.getByRole('listbox', { name: '문서' });
			await docs.getByRole('option', { name: '포트폴리오' }).dblclick();
			await finder.getByRole('option', { name: '시험 그림.png' }).dblclick();

			const preview = appWindow(page, 'preview');
			const view = preview.getByRole('region', { name: '시험 그림.png' });
			const image = view.getByRole('img', { name: '시험 그림.png' });
			await expect(image).toHaveAttribute('src', '/files/portfolio/test.png');
			await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(160);
			await expect(appWindow(page, 'photos')).toHaveCount(0);
			// 한 장이라 사이드바는 처음에 닫혀 있다
			await expect(preview.getByRole('navigation', { name: '사이드바' })).toHaveCount(0);

			// 맞춤은 키우지 않는다(160px), 확대하면 125%
			await expect.poll(async () => Math.round((await image.boundingBox())!.width)).toBe(160);
			await preview.getByRole('button', { name: '확대' }).click();
			await expect.poll(async () => Math.round((await image.boundingBox())!.width)).toBe(200);
			// 왼쪽으로 회전하면 가로세로가 바뀐다 (125%: 125×200)
			await preview.getByRole('button', { name: '왼쪽으로 회전' }).click();
			await expect.poll(async () => Math.round((await image.boundingBox())!.width)).toBe(125);

			// PDF를 더 열면 사이드바에 파일 둘, 그림을 고르면 배율이 남아 있고, 닫으면 빠진다
			await dockItem(page, 'finder').click();
			await finder.getByRole('button', { name: '뒤로' }).click();
			await docs.getByRole('option', { name: '이력서', exact: true }).dblclick();
			await finder.getByRole('option', { name: '시험 이력서.pdf' }).dblclick();
			const sidebar = preview.getByRole('navigation', { name: '사이드바' });
			await expect(sidebar.getByRole('region')).toHaveCount(2);
			await expect(sidebar.getByRole('button', { name: '시험 이력서.pdf 2쪽' })).toBeVisible();
			await sidebar.getByRole('button', { name: '시험 그림.png', exact: true }).click();
			// 그림으로 돌아오면 배율이 남아 있다 (정보에서 확인)
			await preview.getByRole('button', { name: '정보' }).click();
			await expect(page.getByRole('menu', { name: '정보' })).toContainText('배율: 125%');
			await page.keyboard.press('Escape');
			await sidebar.getByRole('button', { name: '시험 그림.png 닫기' }).click();
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('시험 이력서.pdf');
		});

		test('파일 없이 미리보기를 열면 열기 창: 미리보기 폴더·최근 항목·폴더, 두 번 누르거나 열기로 연다', async ({
			page,
		}) => {
			await fakeFiles(page);
			await enterDesktop(page);
			await dockItem(page, 'launchpad').click();
			await page.locator('.launchpad-modal').getByRole('button', { name: 'preview', exact: true }).click();
			const preview = appWindow(page, 'preview');
			const panel = preview.getByRole('dialog', { name: '열기' });
			await expect(panel).toBeVisible();
			// 처음에는 macOS처럼 iCloud의 미리보기 폴더: 모든 문서를 이름 순으로
			await expect(panel.getByText('미리보기 — iCloud')).toBeVisible();
			await expect(panel.getByRole('listbox', { name: '미리보기' }).getByRole('option')).toHaveText([
				'시험 그림.png',
				'시험 이력서.pdf',
				'MacFolio 발표.pdf',
			]);
			// 최근 항목: 고친 날이 늦은 순
			await panel.getByRole('button', { name: '최근 항목' }).click();
			const files = panel.getByRole('listbox', { name: '최근 항목' }).getByRole('option');
			await expect(files).toHaveText(['시험 이력서.pdf', '시험 그림.png', 'MacFolio 발표.pdf']);
			// Finder와 같은 트리: 즐겨찾기의 문서 → 폴더를 두 번 눌러 들어가고, 빈 폴더는 안내, 뒤로·앞으로
			await panel.getByRole('button', { name: '문서', exact: true }).click();
			const docs = panel.getByRole('listbox', { name: '문서' });
			await expect(docs.getByRole('option', { name: 'README.md' })).toHaveAttribute('aria-disabled', 'true');
			await docs.getByRole('option', { name: '자격증', exact: true }).dblclick();
			await expect(panel).toContainText('자격증 사본을 준비하고 있습니다.');
			await expect(panel.getByText('미리보기 — 자격증')).toBeVisible();
			await panel.getByRole('button', { name: '뒤로' }).click();
			await expect(panel.getByRole('listbox', { name: '문서' })).toBeVisible();
			await panel
				.getByRole('listbox', { name: '문서' })
				.getByRole('option', { name: '포트폴리오', exact: true })
				.dblclick();
			const image = panel.getByRole('option', { name: '시험 그림.png' });
			await expect(panel.getByRole('button', { name: '열기' })).toBeDisabled();
			await image.click();
			await expect(image).toHaveAttribute('aria-selected', 'true');
			await panel.getByRole('button', { name: '열기' }).click();
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('시험 그림.png');
			await expect(panel).toHaveCount(0);
		});

		test('열기 창에서도 프로젝트 폴더를 둘러본다: 프로젝트는 열 수 없고, 올린 PDF는 연다', async ({ page }) => {
			await fakeFiles(page);
			await enterDesktop(page);
			await dockItem(page, 'launchpad').click();
			await page.locator('.launchpad-modal').getByRole('button', { name: 'preview', exact: true }).click();
			const preview = appWindow(page, 'preview');
			const panel = preview.getByRole('dialog', { name: '열기' });
			await panel.getByRole('button', { name: '프로젝트', exact: true }).click();
			await panel
				.getByRole('listbox', { name: '프로젝트' })
				.getByRole('option', { name: 'MacFolio', exact: true })
				.dblclick();
			const folder = panel.getByRole('listbox', { name: 'MacFolio' });
			await expect(folder.getByRole('option')).toHaveText(['MacFolio', '사진', /MacFolio 발표\.pdf$/]);
			await expect(folder.getByRole('option').first()).toHaveAttribute('aria-disabled', 'true');
			await folder.getByRole('option', { name: 'MacFolio 발표.pdf' }).dblclick();
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('MacFolio 발표.pdf');
		});
	});

	test.describe('프로젝트 폴더', () => {
		test('프로젝트마다 폴더: 프로젝트, 사진, 올린 파일. PDF는 미리보기에서 연다', async ({ page }) => {
			const requests = await fakeFiles(page);
			const finder = await openFinder(page);
			await sidebar(finder).getByRole('button', { name: '프로젝트' }).click();
			await finder
				.getByRole('listbox', { name: '프로젝트' })
				.getByRole('option', { name: 'MacFolio', exact: true })
				.dblclick();
			await expect(finder.getByRole('heading', { level: 1 })).toHaveText('MacFolio');
			const folder = finder.getByRole('listbox', { name: 'MacFolio' });
			await expect(folder.getByRole('option')).toHaveText(['MacFolio', '사진', /MacFolio 발표\.pdf$/]);
			await expect(folder.getByRole('option').first()).toHaveClass(/\bproject\b/);

			await folder.getByRole('option', { name: 'MacFolio 발표.pdf' }).dblclick();
			const preview = appWindow(page, 'preview');
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('MacFolio 발표.pdf');
			await expect.poll(() => requests).toContain('/files/projects/macfolio/slides.pdf');
		});
	});
});
