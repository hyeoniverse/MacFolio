import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { FAKE_API, fakeApi } from './fakeApi';
import { DOCUMENT_EXTENSIONS } from '@macfolio/contracts';
import { tinyPdf } from './fakeFiles';

/** 문서 › 포트폴리오 (프로젝트 폴더가 여기에 있다) */
async function openPortfolio(finder: ReturnType<typeof appWindow>) {
	await finder.getByRole('navigation', { name: '즐겨찾기' }).getByRole('button', { name: '문서' }).click();
	await finder
		.getByRole('listbox', { name: '문서' })
		.getByRole('option', { name: '포트폴리오', exact: true })
		.dblclick();
	await expect(finder.getByRole('heading', { level: 1 })).toHaveText('포트폴리오');
}

const R2 = 'https://acc.r2.cloudflarestorage.com';

interface Doc {
	id: string;
	folder: string;
	name: string;
	key: string;
	kind: 'pdf' | 'image' | 'file';
	size: number;
	updated: string;
}

/** 서버의 /documents와 R2 서명 주소를 흉내 낸다. 받은 요청을 돌려준다 */
async function fakeDocuments(page: Page) {
	const docs: Doc[] = [];
	const puts: { url: string; size: number }[] = [];
	const cors = (origin: string) => ({
		'access-control-allow-origin': origin,
		'access-control-allow-credentials': 'true',
		'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT',
		'access-control-allow-headers': 'content-type',
	});
	await page.route(`${FAKE_API}/documents**`, async (route) => {
		const request = route.request();
		const origin = (await request.headerValue('origin')) ?? 'http://localhost:4173';
		const path = new URL(request.url()).pathname;
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(origin) });
		if (path === '/documents' && request.method() === 'GET')
			return route.fulfill({ headers: cors(origin), json: docs });
		if (path === '/documents/uploads') {
			const { folder, name } = request.postDataJSON();
			const prefix = folder.startsWith('project:')
				? `projects/${folder.slice(8)}`
				: folder === '이력서'
					? 'resume'
					: folder === '데스크탑'
						? 'desktop'
						: 'portfolio';
			// 같은 폴더에 두 번째로 올리면 다른 키 (첫 번째는 abcdefghijklmnop)
			const taken = docs.filter((doc) => doc.key.startsWith(`${prefix}/`)).length;
			const key = `${prefix}/${taken ? `abcdefghijklmn${String(taken).padStart(2, '0')}` : 'abcdefghijklmnop'}.${name.split('.').pop()}`;
			return route.fulfill({
				status: 201,
				headers: cors(origin),
				json: { key, url: `${R2}/macfolio-files/${key}?X-Amz-Signature=x`, expiresIn: 300 },
			});
		}
		if (path === '/documents' && request.method() === 'POST') {
			const body = request.postDataJSON();
			const doc: Doc = {
				id: `doc-${docs.length + 1}-000000000`,
				...body,
				kind: DOCUMENT_EXTENSIONS[body.name.split('.').pop().toLowerCase()],
				updated: '2026-10-18',
			};
			docs.push(doc);
			return route.fulfill({ status: 201, headers: cors(origin), json: doc });
		}
		const id = path.split('/').pop();
		if (request.method() === 'DELETE') {
			docs.splice(
				docs.findIndex((doc) => doc.id === id),
				1
			);
			return route.fulfill({ status: 204, headers: cors(origin) });
		}
		return route.fulfill({ status: 404, headers: cors(origin) });
	});
	await page.route(`${R2}/**`, async (route) => {
		const request = route.request();
		const origin = (await request.headerValue('origin')) ?? '*';
		const headers = {
			'access-control-allow-origin': origin,
			'access-control-allow-methods': 'PUT',
			'access-control-allow-headers': 'content-type',
		};
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		puts.push({ url: request.url(), size: request.postDataBuffer()?.length ?? 0 });
		return route.fulfill({ status: 200, headers });
	});
	await page.route('**/files/**', (route) => route.fulfill({ contentType: 'application/pdf', body: tinyPdf() }));
	return { docs, puts };
}

/** 파일을 끌어다 target에 놓는다 */
async function dropFile(page: Page, selector: string, name: string, bytes: number[]) {
	const transfer = await page.evaluateHandle(
		({ name, bytes }) => {
			const data = new DataTransfer();
			data.items.add(new File([new Uint8Array(bytes)], name, { type: 'application/pdf' }));
			return data;
		},
		{ name, bytes }
	);
	await page.dispatchEvent(selector, 'dragenter', { dataTransfer: transfer });
	await page.dispatchEvent(selector, 'dragover', { dataTransfer: transfer });
	await page.dispatchEvent(selector, 'drop', { dataTransfer: transfer });
}

async function openResumeFolder(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'finder').click();
	const finder = appWindow(page, 'finder');
	await finder.getByRole('listbox', { name: '문서' }).getByRole('option', { name: '이력서', exact: true }).dblclick();
	await expect(finder.getByRole('heading', { level: 1 })).toHaveText('이력서');
	return finder;
}

test.describe('Finder 문서 올리기 (관리자)', () => {
	test('관리자는 파일을 끌어다 놓아 R2에 올리고, 목록에 생기며, 지울 수 있다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		const { docs, puts } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);

		const pdf = [...tinyPdf()];
		await dropFile(page, '[data-app="finder"] .finder-content', '새 이력서.pdf', pdf);
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toBeVisible();
		expect(puts).toHaveLength(1);
		expect(puts[0].url).toContain('/macfolio-files/resume/abcdefghijklmnop.pdf');
		expect(puts[0].size).toBe(pdf.length);
		expect(docs[0]).toMatchObject({ folder: '이력서', name: '새 이력서.pdf', size: pdf.length });

		// 받지 않는 종류는 올리지 않고 알린다
		await dropFile(page, '[data-app="finder"] .finder-content', '설치.exe', [1, 2, 3]);
		await expect(page.getByText('올릴 수 없는 파일 종류입니다')).toBeVisible();
		expect(puts).toHaveLength(1);

		// 문서·영상 같은 다른 파일도 올라가고, 열면 받는다 (회색 확장자 딱지)
		await dropFile(page, '[data-app="finder"] .finder-content', '경력기술서.docx', [1, 2, 3]);
		const docx = finder.getByRole('option', { name: '경력기술서.docx' });
		await expect(docx).toBeVisible();
		expect(docs[1]).toMatchObject({ kind: 'file', name: '경력기술서.docx' });
		await expect(docx.locator('text')).toHaveText('DOCX');
		const download = page.waitForEvent('download');
		await docx.dblclick();
		expect((await download).url()).toContain('download=1');
		await docx.click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		await expect(docx).toHaveCount(0);

		// 고르고 ⌘⌫(휴지통으로 이동): macOS처럼 묻지 않고 휴지통에 들어간다 (서버에서는 아직 지우지 않는다)
		await finder.getByRole('option', { name: '새 이력서.pdf' }).click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toHaveCount(0);
		expect(docs).toHaveLength(2);

		// Dock의 휴지통 › 버린 항목: 되돌려 놓기는 원래 폴더로
		await expect(dockItem(page, 'bin').locator('img')).toHaveAttribute('src', /\/bin\.webp$/);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const trashed = bin.getByRole('listbox', { name: '휴지통 항목' });
		await expect(trashed.getByRole('option')).toHaveText([/경력기술서.docx/, /새 이력서.pdf/]);
		await dockItem(page, 'bin').click();
		await trashed.getByRole('option', { name: '새 이력서.pdf' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '되돌려 놓기' }).click();
		await expect(trashed.getByRole('option')).toHaveText([/경력기술서.docx/]);
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toBeVisible();

		// Finder에서 Dock의 휴지통으로 끌어 놓아도 휴지통으로 (macOS처럼). 휴지통 창은 닫아 Finder를 가리지 않게
		await bin.getByRole('button', { name: '닫기' }).click();
		await finder.getByRole('option', { name: '새 이력서.pdf' }).dragTo(page.locator('[data-dock-trash]'));
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toHaveCount(0);
		await dockItem(page, 'bin').click();
		await expect(trashed.getByRole('option')).toHaveText([/경력기술서.docx/, /새 이력서.pdf/]);
		await trashed.getByRole('option', { name: '새 이력서.pdf' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '되돌려 놓기' }).click();
		await expect(trashed.getByRole('option')).toHaveText([/경력기술서.docx/]);

		// 비우기: 묻고 영구 삭제 (서버에서도)
		await bin.getByRole('button', { name: '비우기' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '지우기' }).click();
		await expect(bin.getByText('휴지통이 비어 있습니다.')).toBeVisible();
		await expect.poll(() => docs.map((doc) => doc.name)).toEqual(['새 이력서.pdf']);
	});

	test('만든 폴더나 바탕화면에 놓아도 올라가고 놓은 자리에 보인다 (진짜 폴더처럼)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const { docs } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);

		// 이력서 안에 새 폴더를 만들고 그 아이콘 위에 놓는다 → 이력서에 올리고 그 폴더에 둔다
		// 맨 앞 칸에는 데이터로 만든 이력서가 있어 그 옆 빈 곳을 누른다
		await finder.locator('.finder-content').click({ button: 'right', position: { x: 300, y: 200 } });
		await page.getByRole('menuitem', { name: '새 폴더' }).click();
		await finder.getByRole('textbox', { name: '이름' }).press('Enter');
		await expect.poll(() => api.finderLayout.folders.length).toBe(1);
		const folderId = api.finderLayout.folders[0].id;
		await dropFile(page, `[data-app="finder"] [data-folder-target="${folderId}"]`, '사본.pdf', [...tinyPdf()]);
		await expect.poll(() => docs.length).toBe(1);
		expect(docs[0]).toMatchObject({ folder: '이력서', name: '사본.pdf' });
		await expect.poll(() => api.finderLayout.files).toEqual({ [`file:${docs[0].key}`]: folderId });
		await expect(finder.getByRole('option', { name: '사본.pdf' })).toHaveCount(0);
		await finder.getByRole('option', { name: '이름 없는 폴더' }).dblclick();
		await expect(finder.getByRole('option', { name: '사본.pdf' })).toBeVisible();

		// 바탕화면 빈 곳에 놓으면 바탕화면에 보인다
		await dropFile(page, '.desktop-icons', '바탕.pdf', [...tinyPdf()]);
		await expect.poll(() => docs.length).toBe(2);
		// 바탕화면에 놓으면 데스크탑 폴더(desktop/)에 올라가고 자리를 따로 적지 않는다
		expect(docs[1]).toMatchObject({ folder: '데스크탑', key: 'desktop/abcdefghijklmnop.pdf' });
		expect(api.finderLayout.files[`file:${docs[1].key}`]).toBeUndefined();
		await expect(
			page.getByRole('listbox', { name: '바탕화면' }).getByRole('option', { name: '바탕.pdf' })
		).toBeVisible();

		// 바탕화면의 파일 아이콘 위에 놓아도 바탕화면으로 (브라우저가 파일을 열지 않는다)
		await dropFile(page, `[data-desktop-icon="file:${docs[1].key}"]`, '하나 더.pdf', [...tinyPdf()]);
		await expect.poll(() => docs.length).toBe(3);
		expect(docs[2]).toMatchObject({ folder: '데스크탑' });
		// 가상본(자격증) 위에 놓으면 원래 폴더로
		await dropFile(page, '[data-desktop-icon="docs:자격증"]', '자격.pdf', [...tinyPdf()]);
		await expect.poll(() => docs.length).toBe(4);
		expect(docs[3]).toMatchObject({ folder: '자격증', name: '자격.pdf' });

		// 바탕화면에서 휴지통으로: 묻지 않고 바로 휴지통에 (바탕화면에서 사라진다)
		// 바탕화면 아이콘을 Dock의 휴지통으로 끌어 놓는다
		const desk = page.getByRole('listbox', { name: '바탕화면' });
		const icon = (await desk.getByRole('option', { name: '바탕.pdf' }).boundingBox())!;
		const bin = (await page.locator('[data-dock-trash]').boundingBox())!;
		await page.mouse.move(icon.x + icon.width / 2, icon.y + 20);
		await page.mouse.down();
		await page.mouse.move(icon.x - 40, icon.y + 60, { steps: 4 });
		await page.mouse.move(bin.x + bin.width / 2, bin.y + bin.height / 2, { steps: 12 });
		await page.mouse.up();
		await expect(desk.getByRole('option', { name: '바탕.pdf' })).toHaveCount(0);
		await expect.poll(() => api.finderLayout.trash?.[`file:${docs[1].key}`]).toBe('desktop');

		// 바탕화면에서 띄운 경고창(같은 이름)은 창이 아니라 화면 한가운데, 모든 창 위 (body에 그린다)
		const size = page.viewportSize()!;
		await page.mouse.click(size.width - 400, size.height - 260, { button: 'right' });
		await page.getByRole('menuitem', { name: '새 폴더' }).click();
		await page.getByRole('textbox', { name: '이름' }).fill('이력서');
		await page.getByRole('textbox', { name: '이름' }).press('Enter');
		const alert = page.getByRole('alertdialog');
		await expect(alert).toBeVisible();
		expect(await alert.evaluate((box) => box.closest('.ui-modal-overlay')?.parentElement === document.body)).toBe(true);
		expect(
			Number(await alert.evaluate((box) => getComputedStyle(box.closest('.ui-modal-overlay')!).zIndex))
		).toBeGreaterThan(1001);
		await alert.getByRole('button', { name: '확인' }).click();
	});

	test('사이드바에 이력서·포트폴리오·자격증이 있고, 그 위에 놓아도 올라간다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		const { docs } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);
		const sidebar = finder.getByRole('navigation', { name: '즐겨찾기' });
		await expect(sidebar.getByRole('button')).toHaveText([
			'데스크탑',
			'문서',
			'이력서',
			'포트폴리오',
			'자격증',
			'블로그',
			'응용 프로그램',
			// 위치 칸: 홈과 디스크 (macOS처럼 즐겨찾기는 이 트리 안 폴더로 가는 바로가기)
			'hyeoniverse',
			'Macintosh HD',
		]);
		await expect(sidebar.getByRole('button', { name: '이력서' })).toHaveAttribute('aria-current', 'page');
		await dropFile(page, '[data-app="finder"] .finder-sidebar [data-folder-target="docs:자격증"]', '자격.pdf', [
			...tinyPdf(),
		]);
		await expect.poll(() => docs.length).toBe(1);
		expect(docs[0]).toMatchObject({ folder: '자격증', name: '자격.pdf' });
		await sidebar.getByRole('button', { name: '자격증' }).click();
		await expect(finder.getByRole('heading', { level: 1 })).toHaveText('자격증');
		await expect(finder.getByRole('option', { name: '자격.pdf' })).toBeVisible();
	});

	test('QuickTime Player를 파일 없이 열면 열기 창이 뜨고, 동영상·소리가 아닌 파일은 고를 수 없다', async ({ page }) => {
		await fakeApi(page);
		await fakeDocuments(page);
		await openResumeFolder(page);
		await dropFile(page, '[data-app="finder"] .finder-content', '이력서.pdf', [...tinyPdf()]);
		await dropFile(page, '[data-app="finder"] .finder-content', '소개 영상.mp4', [1, 2, 3]);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'quicktime', exact: true }).click();

		const player = appWindow(page, 'quicktime');
		const panel = player.getByRole('dialog', { name: '열기' });
		await expect(panel.getByRole('button', { name: 'QuickTime Player' })).toHaveAttribute('aria-current', 'true');
		await panel.getByRole('button', { name: '문서' }).click();
		await panel.getByRole('option', { name: '이력서', exact: true }).dblclick();
		await expect(panel.getByRole('option', { name: '이력서.pdf', exact: true })).toHaveAttribute(
			'aria-disabled',
			'true'
		);
		const clip = panel.getByRole('option', { name: '소개 영상.mp4' });
		await expect(clip).not.toHaveAttribute('aria-disabled', 'true');
		await clip.click();
		if (process.env.SHOT) await player.screenshot({ path: process.env.SHOT });
		await panel.getByRole('button', { name: '열기' }).click();
		await expect(player.locator('video')).toHaveAttribute('aria-label', '소개 영상.mp4');
	});

	test('방문자가 놓은 파일은 서버에 올리지 않고 내 화면에만 보인다 (새로고침하면 사라진다)', async ({ page }) => {
		const api = await fakeApi(page);
		const { puts, docs } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);
		await dropFile(page, '[data-app="finder"] .finder-content', '새 이력서.pdf', [...tinyPdf()]);
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toBeVisible();
		await expect(page.getByText('내 화면에만 추가됨')).toBeVisible();
		// 미리보기로 열린다 (blob 주소)
		await finder.getByRole('option', { name: '새 이력서.pdf' }).dblclick();
		await expect(appWindow(page, 'preview')).toBeVisible();

		// 동영상은 첫 장면 아이콘으로 보이고, 열면 QuickTime Player가 재생한다
		await dockItem(page, 'finder').click();
		await dropFile(page, '[data-app="finder"] .finder-content', '데모.mp4', [1, 2, 3]);
		const clip = finder.getByRole('option', { name: '데모.mp4' });
		await expect(clip.locator('.finder-video-thumb video')).toHaveAttribute('src', /^blob:.*#t=0\.5$/);
		await clip.dblclick();
		const player = appWindow(page, 'quicktime');
		await expect(player).toBeVisible();
		await expect(player.locator('video')).toHaveAttribute('src', /^blob:/);
		await expect(player.locator('video')).toHaveAttribute('aria-label', '데모.mp4');

		// 동영상도 오른쪽 클릭 › 데스크탑 사진 설정으로 움직이는 바탕화면이 된다
		await dockItem(page, 'finder').click();
		await clip.click({ button: 'right' });
		await page.getByRole('menuitem', { name: '데스크탑 사진 설정' }).click();
		// (시험은 움직임 줄이기라 동영상은 그리지 않는다: 설정에 들어갔는지 본다)
		await expect
			.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('macfolio:settings') ?? '{}').wallpaperVideo))
			.toMatch(/^blob:/);

		// 바탕화면에 놓아도 그 자리에
		await dropFile(page, '.desktop-icons', '사진.gif', [1, 2, 3]);
		await expect(
			page.getByRole('listbox', { name: '바탕화면' }).getByRole('option', { name: '사진.gif' })
		).toBeVisible();

		// 그림은 오른쪽 클릭 › 데스크탑 사진 설정으로 바로 바탕화면에
		await page
			.getByRole('listbox', { name: '바탕화면' })
			.getByRole('option', { name: '사진.gif' })
			.click({ button: 'right' });
		await page.getByRole('menuitem', { name: '데스크탑 사진 설정' }).click();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--wallpaper')))
			.toContain('blob:');

		expect(puts).toHaveLength(0);
		expect(docs).toHaveLength(0);
		expect(api.finderLayout.files).toEqual({});
		await page.reload();
		await enterDesktop(page);
		await expect(page.getByRole('listbox', { name: '바탕화면' }).getByRole('option', { name: '사진.gif' })).toHaveCount(
			0
		);
	});

	test('프로젝트 폴더 아이콘 위나 그 안에 놓으면 project:<id> 폴더로 올라가고, 이름 바꾸기·지우기도 된다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		const { docs, puts } = await fakeDocuments(page);
		await enterDesktop(page);
		await dockItem(page, 'finder').click();
		const finder = appWindow(page, 'finder');
		await openPortfolio(finder);

		// 포트폴리오 안의 MacFolio 프로젝트 폴더 아이콘 위에 놓는다
		const pdf = [...tinyPdf()];
		await dropFile(page, '[data-app="finder"] [data-folder-target="projects/macfolio"]', '발표.pdf', pdf);
		await expect.poll(() => puts.length).toBe(1);
		expect(puts[0].url).toContain('/macfolio-files/projects/macfolio/abcdefghijklmnop.pdf');
		expect(docs[0]).toMatchObject({ folder: 'project:macfolio', name: '발표.pdf', size: pdf.length });

		await finder
			.getByRole('listbox', { name: '포트폴리오' })
			.getByRole('option', { name: 'MacFolio', exact: true })
			.dblclick();
		const folder = finder.getByRole('listbox', { name: 'MacFolio' });
		await expect(folder.getByRole('option', { name: '발표.pdf' })).toBeVisible();

		// 폴더 안에 놓아도 같은 폴더로
		await dropFile(page, '[data-app="finder"] .finder-content', '구조도.pdf', pdf);
		await expect(folder.getByRole('option', { name: '구조도.pdf' })).toBeVisible();
		expect(docs[1]).toMatchObject({ folder: 'project:macfolio', key: 'projects/macfolio/abcdefghijklmn01.pdf' });

		// 관리자 메뉴: 고르고 ⌘⌫로 지운다
		await folder.getByRole('option', { name: '구조도.pdf' }).click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		await expect(folder.getByRole('option', { name: '구조도.pdf' })).toHaveCount(0);
		// 휴지통에서 즉시 삭제하면 서버에서도 지워진다
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('option', { name: '구조도.pdf' }).click({ button: 'right' });
		await page.getByRole('menuitem', { name: '즉시 삭제…' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '지우기' }).click();
		await expect.poll(() => docs.map((doc) => doc.name)).toEqual(['발표.pdf']);
	});
});
