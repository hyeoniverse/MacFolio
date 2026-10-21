import { readFileSync } from 'node:fs';
import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator, Page } from '@playwright/test';
import { fakeFiles } from './fakeFiles';
import { fakeApi } from './fakeApi';

/** 문서 › 포트폴리오 (프로젝트 폴더가 여기에 있다) */
async function openPortfolio(finder: ReturnType<typeof appWindow>) {
	await finder.getByRole('navigation', { name: '즐겨찾기' }).getByRole('button', { name: '문서' }).click();
	await finder
		.getByRole('listbox', { name: '문서' })
		.getByRole('option', { name: '포트폴리오', exact: true })
		.dblclick();
	await expect(finder.getByRole('heading', { level: 1 })).toHaveText('포트폴리오');
}

async function openFinder(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'finder').click();
	const finder = appWindow(page, 'finder');
	await expect(finder).toBeVisible();
	return finder;
}

const sidebar = (finder: ReturnType<typeof appWindow>) => finder.getByRole('navigation', { name: '즐겨찾기' });

/** 가상본의 화살표가 그 항목의 아이콘 칸 안에 있는지 (열기 창: .preview-open-thumb) */
async function expectBadgeInside(option: Locator) {
	const thumb = (await option.locator('.preview-open-thumb').boundingBox())!;
	const badge = (await option.locator('.finder-alias-badge').boundingBox())!;
	expect(badge.x).toBeGreaterThanOrEqual(thumb.x);
	expect(badge.y).toBeGreaterThanOrEqual(thumb.y);
	expect(badge.x + badge.width).toBeLessThanOrEqual(thumb.x + thumb.width);
	expect(badge.y + badge.height).toBeLessThanOrEqual(thumb.y + thumb.height);
}

test.describe('Finder', () => {
	test('문서 폴더에서 시작하고, 저장소 문서는 텍스트 편집기에서 읽는다', async ({ page }) => {
		const finder = await openFinder(page);
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
		const files = finder.getByRole('listbox', { name: '문서' });
		await expect(files.getByRole('option', { name: 'README.md' })).toBeVisible();
		await expect(files.getByRole('option', { name: 'backend-design.md' })).toBeVisible();
		await expect(finder.locator('.finder-count')).toHaveText(/항목 \d+개/);

		// 한 번 누르면 고르고, 두 번 누르면 텍스트 편집기가 연다
		const readme = files.getByRole('option', { name: 'README.md' });
		await readme.click();
		await expect(readme).toHaveAttribute('aria-selected', 'true');
		await readme.dblclick();
		const editor = appWindow(page, 'textedit');
		const doc = editor.getByRole('article', { name: 'README.md' });
		await expect(doc.getByRole('heading', { level: 1 })).toContainText('MacFolio');
		// macOS처럼 제목 막대에 문서 이름, 저장소 문서는 잠긴 문서
		await expect(editor.locator('.textedit-title')).toHaveText('README.md — 잠김');

		// 목록은 본문 안으로 들여 쓰고, 하위 목록은 한 단계 더 들여 쓴다
		const box = async (selector: string) => (await doc.locator(selector).first().boundingBox())!;
		const [body, list, nested] = [await box('p'), await box('ul > li'), await box('ul ul > li')];
		expect(list.x).toBeGreaterThan(body.x);
		expect(nested.x).toBeGreaterThan(list.x);

		// 다른 문서 링크는 같은 창에서 열고, 뒤로·앞으로 오간다
		const link = doc.getByRole('link', { name: 'docs/backend-design.md' }).first();
		// 창이 열리며 움직이는 동안 누르지 않게, 링크를 화면에 둔 뒤 누른다
		await link.scrollIntoViewIfNeeded();
		await link.click();
		const design = editor.getByRole('article', { name: 'docs/backend-design.md' });
		await expect(design.getByRole('heading', { level: 1 })).toHaveText('백엔드 설계');
		// Mermaid 코드 블록은 그림으로
		await expect(design.locator('.finder-doc-mermaid svg').first()).toBeVisible({ timeout: 15_000 });
		// 뒤로·앞으로는 보기 메뉴 (macOS 텍스트 편집기에는 도구 막대가 없다)
		const view = async (label: string) => {
			await page.getByRole('group', { name: '메뉴 막대' }).getByRole('button', { name: '보기' }).click();
			await page.getByRole('menuitem', { name: label }).click();
		};
		await view('뒤로');
		await expect(editor.getByRole('article', { name: 'README.md' })).toBeVisible();
		await view('앞으로');
		await expect(design).toBeVisible();
		// Finder는 문서 폴더에 그대로 있다
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('문서');
	});

	test('문서 없이 텍스트 편집기를 열면 열기 창이 뜨고, Markdown 문서만 연다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'textedit', exact: true }).click();
		// 처음 보이는 곳은 이 앱이 여는 파일 전부 (Markdown 문서)
		const editor = appWindow(page, 'textedit');
		await editor.getByRole('option', { name: 'README.md' }).dblclick();
		await expect(editor.getByRole('article', { name: 'README.md' })).toBeVisible();
	});

	/** 문서 › 이력서 폴더의 이력서를 텍스트 편집기로 연다 */
	async function openResume(page: Page) {
		const finder = await openFinder(page);
		await finder.getByRole('option', { name: '이력서', exact: true }).dblclick();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('이력서');
		await finder.getByRole('option', { name: '김정현_이력서.md' }).dblclick();
		const editor = appWindow(page, 'textedit');
		await expect(editor.locator('.textedit-title')).toHaveText(/^김정현_이력서\.md/);
		return editor;
	}

	test('이력서 폴더의 Markdown 이력서는 텍스트 편집기에서 열고, PDF로 내려받고, 프로젝트는 Safari에서 연다', async ({
		page,
	}) => {
		const editor = await openResume(page);
		const resume = editor.getByRole('article', { name: 'resume.md' });
		await expect(resume.getByRole('heading', { level: 1 })).toHaveText('김정현');
		await expect(resume.getByRole('heading', { name: /^MacFolio \| 2024\.10/ })).toBeVisible();
		// PDF 다운로드: 누르는 순간의 데이터로 브라우저에서 PDF를 만들어 바로 내려받는다
		const download = page.waitForEvent('download');
		await editor.getByRole('button', { name: 'PDF 다운로드' }).click();
		const file = await download;
		expect(file.suggestedFilename()).toBe('김정현_이력서.pdf');
		const bytes = readFileSync(await file.path());
		expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
		await expect(editor.getByRole('button', { name: 'PDF 다운로드' })).toBeEnabled();
		await resume.getByRole('link', { name: 'MacFolio', exact: true }).click();
		await expect(appWindow(page, 'safari')).toBeVisible();
	});

	test('관리자는 메모처럼 열자마자 서식대로 이력서를 고치고, 서식 막대·불러오기·실행 취소를 쓰고 저장한다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const editor = await openResume(page);
		// 원문 기호 없이 읽기 화면과 같은 모양으로 고친다
		const paper = editor.locator('.ProseMirror');
		await expect(paper.getByRole('heading', { level: 1 })).toHaveText('김정현');
		await expect(paper).not.toContainText('## ');
		// 저장은 바뀐 게 있을 때만
		await expect(editor.getByRole('button', { name: '저장' })).toBeDisabled();

		// 한 줄 소개를 고친다
		const motto = paper.locator('blockquote p');
		await motto.click({ clickCount: 3 });
		await page.keyboard.type('화면에서 서버까지, 끝까지 책임지는 개발자');
		// 서식 막대로 굵게 했다가 실행 취소로 되돌린다
		await motto.click({ clickCount: 3 });
		await editor.getByRole('button', { name: '굵게' }).click();
		await expect(motto.locator('strong')).toHaveCount(1);
		await page.keyboard.press('ControlOrMeta+z');
		await expect(motto.locator('strong')).toHaveCount(0);

		// 프로젝트 하나를 불러온다 (이력서에 없던 WTD는 프로젝트 절 끝에 들어간다)
		await editor.getByRole('button', { name: '불러오기' }).click();
		await page.getByRole('menu', { name: '불러오기' }).getByRole('menuitem', { name: 'WTD (What To Do)' }).click();
		await expect(paper.getByRole('heading', { name: /^WTD \(What To Do\) \|/ })).toBeVisible();
		await editor.getByRole('button', { name: '저장' }).click();
		await expect(editor.getByRole('button', { name: '저장' })).toBeDisabled();

		// 서버에는 이력서 규칙 그대로의 Markdown 한 장이 간다
		expect(api.siteResume?.markdown).toContain('> 화면에서 서버까지, 끝까지 책임지는 개발자');
		expect(api.siteResume?.markdown).toContain('### [WTD (What To Do)](#project/whattodo)');
		expect(api.siteResume?.markdown).toContain('hyeoniverse.dev@gmail.com · github.com/hyeoniverse');

		// 보기 › Markdown 원문 보기로 원문도 고칠 수 있다
		await page.getByRole('group', { name: '메뉴 막대' }).getByRole('button', { name: '보기' }).click();
		await page.getByRole('menuitem', { name: 'Markdown 원문 보기' }).click();
		await expect(editor.getByRole('textbox', { name: '이력서 Markdown' })).toHaveValue(/^# 김정현\n/);

		// 터미널 resume도 같은 글을 그린다
		await dockItem(page, 'terminal').click();
		const input = appWindow(page, 'terminal').getByRole('textbox', { name: '명령어 입력' });
		await input.fill('resume');
		await input.press('Enter');
		await expect(appWindow(page, 'terminal').getByRole('log', { name: '터미널 출력' })).toContainText(
			'끝까지 책임지는 개발자'
		);
	});

	test('영문 이력서도 이력서 폴더에 있고, PDF는 미리보기가 지금 글로 만들어 바로 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('option', { name: '이력서', exact: true }).dblclick();
		await expect(finder.getByRole('option')).toHaveText([
			/김정현_이력서\.md/,
			/김정현_이력서\.pdf/,
			/Resume_Jeonghyeon_Kim\.md/,
			/Resume_Jeonghyeon_Kim\.pdf/,
		]);
		await finder.getByRole('option', { name: 'Resume_Jeonghyeon_Kim.md' }).dblclick();
		const editor = appWindow(page, 'textedit');
		await expect(editor.getByRole('article', { name: 'resume.en.md' }).getByRole('heading', { level: 1 })).toHaveText(
			'Jeonghyeon Kim'
		);
		await dockItem(page, 'finder').click();
		await finder.getByRole('option', { name: '김정현_이력서.pdf' }).dblclick();
		const preview = appWindow(page, 'preview');
		await expect(
			preview
				.getByRole('document', { name: '김정현_이력서.pdf' })
				.getByRole('group', { name: '1쪽' })
				.locator('.textLayer')
		).toContainText('김정현', { timeout: 30_000 });
	});

	test('방문자는 이력서를 읽기만 한다 (서식 막대는 꺼져 있다)', async ({ page }) => {
		const editor = await openResume(page);
		await expect(editor.getByRole('button', { name: 'PDF 다운로드' })).toBeVisible();
		await expect(editor.getByRole('textbox', { name: '이력서 Markdown' })).toHaveCount(0);
		await expect(editor.getByRole('button', { name: '굵게' })).toBeDisabled();
	});

	test('블로그: 메모에서 만든 빈 폴더도 보인다', async ({ page }) => {
		await fakeApi(page, { organization: { folders: ['읽을거리'] as never[] } });
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '블로그' }).click();
		const blog = finder.getByRole('listbox', { name: '블로그' });
		await blog.getByRole('option', { name: /읽을거리/ }).dblclick();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('읽을거리');
		await expect(finder.locator('.finder-count')).toHaveText('비어 있음');
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

	test('글을 열면 메모가 그 글을 연다, 프로젝트 폴더에는 실행하는 앱이 없다', async ({ page }) => {
		const finder = await openFinder(page);
		await finder.getByRole('searchbox', { name: '이름으로 찾기' }).fill('CRA에서 Vite로');
		await finder.getByRole('option', { name: 'CRA에서 Vite로 옮기기' }).dblclick();
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();

		await dockItem(page, 'finder').click();
		await openPortfolio(finder);
		// 프로젝트마다 폴더: 안에는 사진과 올린 파일만 (실행하는 앱은 응용 프로그램에만)
		await finder.getByRole('listbox', { name: '포트폴리오' }).getByRole('option', { name: /QRU/ }).dblclick();
		await expect(
			finder.getByRole('listbox', { name: /QRU/ }).getByRole('option', { name: 'QRU', exact: true })
		).toHaveCount(0);
		await expect(finder.locator('.finder-icon.project')).toHaveCount(0);
	});

	test('응용 프로그램에서 앱을 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: '응용 프로그램' }).click();
		await finder.getByRole('option', { name: '터미널' }).dblclick();
		await expect(appWindow(page, 'terminal')).toBeVisible();
	});

	test('사진: 홈 › 그림 › MacFolio 앨범 폴더에 사진 앱의 그림이 있고, 미리보기에서 연다', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: 'hyeoniverse', exact: true }).click();
		await finder
			.getByRole('listbox', { name: 'hyeoniverse' })
			.getByRole('option', { name: '그림', exact: true })
			.dblclick();
		await finder
			.getByRole('listbox', { name: '그림' })
			.getByRole('option', { name: 'MacFolio', exact: true })
			.dblclick();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('MacFolio');
		const photo = finder.getByRole('listbox', { name: 'MacFolio' }).getByRole('option').first();
		const name = (await photo.textContent())!.trim();
		await photo.dblclick();
		const preview = appWindow(page, 'preview');
		await expect(preview.getByRole('heading', { level: 1 })).toHaveText(name);
		await expect(preview.locator('.preview-image img')).toHaveAttribute('src', /^\/imgs\/projects\/macfolio\//);
	});

	test('음악: 홈 › 음악 › 아티스트 › 앨범의 곡을 열면 음악 앱이 그 곡을 재생한다', async ({ page }) => {
		const finder = await openFinder(page);
		await sidebar(finder).getByRole('button', { name: 'hyeoniverse', exact: true }).click();
		await finder
			.getByRole('listbox', { name: 'hyeoniverse' })
			.getByRole('option', { name: '음악', exact: true })
			.dblclick();
		await finder.getByRole('listbox', { name: '음악' }).getByRole('option', { name: 'Yiruma', exact: true }).dblclick();
		await finder
			.getByRole('listbox', { name: 'Yiruma' })
			.getByRole('option', { name: 'Yiruma', exact: true })
			.dblclick();
		await expect(finder.getByRole('navigation', { name: '경로' })).toHaveText(/음악.*Yiruma.*Yiruma/);
		await finder
			.getByRole('listbox', { name: 'Yiruma' })
			.getByRole('option', { name: 'River Flows in You.mp3', exact: true })
			.dblclick();
		await expect(appWindow(page, 'music').getByRole('contentinfo', { name: '재생 막대' })).toContainText(
			'River Flows in You'
		);
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
		test('빈 자격증 폴더는 안내를 보이고, 포트폴리오에는 프로젝트 폴더가 있다', async ({ page }) => {
			await fakeFiles(page, []);
			const finder = await openFinder(page);
			const docs = finder.getByRole('listbox', { name: '문서' });
			// 이력서 폴더는 데이터로 만든 이력서가 있어 비어 있지 않다
			for (const [name, note] of [['자격증', '자격증 사본을 준비하고 있습니다.']]) {
				await docs.getByRole('option', { name, exact: true }).dblclick();
				await expect(finder.getByRole('heading', { level: 1 })).toHaveText(name);
				await expect(finder.getByText(note)).toBeVisible();
				await finder.getByRole('button', { name: '뒤로' }).click();
			}
			// 포트폴리오는 파일이 없어도 프로젝트 폴더가 있어 비어 있지 않다
			await docs.getByRole('option', { name: '포트폴리오', exact: true }).dblclick();
			await expect(
				finder.getByRole('listbox', { name: '포트폴리오' }).getByRole('option', { name: 'MacFolio', exact: true })
			).toBeVisible();
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
			// 프로젝트 폴더는 문서 › 포트폴리오 안
			await panel.getByRole('button', { name: '문서', exact: true }).click();
			await panel
				.getByRole('listbox', { name: '문서' })
				.getByRole('option', { name: '포트폴리오', exact: true })
				.dblclick();
			await panel
				.getByRole('listbox', { name: '포트폴리오' })
				.getByRole('option', { name: 'MacFolio', exact: true })
				.dblclick();
			const folder = panel.getByRole('listbox', { name: 'MacFolio' });
			await expect(folder.getByRole('option')).toHaveText([/MacFolio 발표\.pdf$/]);
			await folder.getByRole('option', { name: 'MacFolio 발표.pdf' }).dblclick();
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('MacFolio 발표.pdf');
		});

		test('홈과 디스크: 사이드바의 위치에서 홈의 기본 폴더와 디스크의 응용 프로그램으로 간다', async ({ page }) => {
			const finder = await openFinder(page);
			const side = sidebar(finder);
			await side.getByRole('button', { name: 'hyeoniverse', exact: true }).click();
			const home = finder.getByRole('listbox', { name: 'hyeoniverse' });
			await expect(home.getByRole('option')).toHaveText([
				'공용',
				'그림',
				'다운로드',
				'데스크탑',
				'동영상',
				'문서',
				'블로그',
				'음악',
			]);
			await expect(side.getByRole('button', { name: 'hyeoniverse', exact: true })).toHaveAttribute(
				'aria-current',
				'page'
			);
			// 홈의 문서로 들어가면 사이드바는 문서를 칠하고, 경로 막대는 디스크부터 이어진다
			await home.getByRole('option', { name: '문서', exact: true }).dblclick();
			await expect(side.getByRole('button', { name: '문서', exact: true })).toHaveAttribute('aria-current', 'page');
			await expect(finder.getByRole('navigation', { name: '경로' })).toHaveText(
				/Macintosh HD.*사용자.*hyeoniverse.*문서/
			);
			// 빈 기본 폴더는 안내를 띄운다
			await finder.getByRole('navigation', { name: '경로' }).getByRole('button', { name: 'hyeoniverse' }).click();
			await home.getByRole('option', { name: '다운로드', exact: true }).dblclick();
			await expect(finder.getByText('다운로드한 파일이 없습니다.')).toBeVisible();
			await side.getByRole('button', { name: 'Macintosh HD', exact: true }).click();
			await expect(finder.getByRole('listbox', { name: 'Macintosh HD' }).getByRole('option')).toHaveText([
				'사용자',
				'응용 프로그램',
			]);
		});

		test('QuickTime Player의 열기 창에서도 데스크탑 가상본의 화살표는 아이콘 칸 안에', async ({ page }) => {
			await enterDesktop(page);
			await dockItem(page, 'launchpad').click();
			await page.locator('.launchpad-modal').getByRole('button', { name: 'quicktime', exact: true }).click();
			const panel = appWindow(page, 'quicktime').getByRole('dialog', { name: '열기' });
			await panel.getByRole('button', { name: '데스크탑', exact: true }).click();
			for (const name of ['이력서', '포트폴리오', '자격증'])
				await expectBadgeInside(
					panel.getByRole('listbox', { name: '데스크탑' }).getByRole('option', { name, exact: true })
				);
		});

		test('열기 창에서 데스크탑의 포트폴리오(가상본)를 열면 문서 › 포트폴리오가 열린다', async ({ page }) => {
			await fakeFiles(page);
			await enterDesktop(page);
			await dockItem(page, 'launchpad').click();
			await page.locator('.launchpad-modal').getByRole('button', { name: 'preview', exact: true }).click();
			const panel = appWindow(page, 'preview').getByRole('dialog', { name: '열기' });
			await panel.getByRole('button', { name: '데스크탑', exact: true }).click();
			const alias = panel
				.getByRole('listbox', { name: '데스크탑' })
				.getByRole('option', { name: '포트폴리오', exact: true });
			// 가상본 화살표는 그 아이콘 칸 안에 (Finder를 열지 않아 Finder.css가 없어도)
			await expectBadgeInside(alias);
			await alias.dblclick();
			await expect(
				panel.getByRole('listbox', { name: '포트폴리오' }).getByRole('option', { name: 'MacFolio', exact: true })
			).toBeVisible();
		});
	});

	test.describe('프로젝트 폴더', () => {
		test('프로젝트마다 폴더: 사진, 올린 파일. PDF는 미리보기에서 연다', async ({ page }) => {
			const requests = await fakeFiles(page);
			const finder = await openFinder(page);
			await openPortfolio(finder);
			await finder
				.getByRole('listbox', { name: '포트폴리오' })
				.getByRole('option', { name: 'MacFolio', exact: true })
				.dblclick();
			await expect(finder.getByRole('heading', { level: 1 })).toHaveText('MacFolio');
			const folder = finder.getByRole('listbox', { name: 'MacFolio' });
			await expect(folder.getByRole('option')).toHaveText([/MacFolio 발표\.pdf$/]);

			await folder.getByRole('option', { name: 'MacFolio 발표.pdf' }).dblclick();
			const preview = appWindow(page, 'preview');
			await expect(preview.getByRole('heading', { level: 1 })).toHaveText('MacFolio 발표.pdf');
			await expect.poll(() => requests).toContain('/files/projects/macfolio/slides.pdf');
		});
	});
});
