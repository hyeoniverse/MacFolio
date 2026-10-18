import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { FAKE_API, fakeApi } from './fakeApi';
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
	kind: 'pdf' | 'image';
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
					: 'portfolio';
			const key = `${prefix}/abcdefghijklmnop.${name.split('.').pop()}`;
			return route.fulfill({
				status: 201,
				headers: cors(origin),
				json: { key, url: `${R2}/macfolio-files/${key}?X-Amz-Signature=x`, expiresIn: 300 },
			});
		}
		if (path === '/documents' && request.method() === 'POST') {
			const body = request.postDataJSON();
			const doc: Doc = { id: `doc-${docs.length + 1}-000000000`, ...body, kind: 'pdf', updated: '2026-10-18' };
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
		await expect(finder.getByText('파일을 여기에 끌어다 놓으면 올라갑니다')).toBeVisible();

		const pdf = [...tinyPdf()];
		await dropFile(page, '[data-app="finder"] .finder-content', '새 이력서.pdf', pdf);
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toBeVisible();
		expect(puts).toHaveLength(1);
		expect(puts[0].url).toContain('/macfolio-files/resume/abcdefghijklmnop.pdf');
		expect(puts[0].size).toBe(pdf.length);
		expect(docs[0]).toMatchObject({ folder: '이력서', name: '새 이력서.pdf', size: pdf.length });

		// 받지 않는 종류는 올리지 않고 알린다
		await dropFile(page, '[data-app="finder"] .finder-content', '메모.txt', [1, 2, 3]);
		await expect(page.getByText('PDF, PNG, JPG, WebP 파일만 올릴 수 있습니다.')).toBeVisible();
		expect(puts).toHaveLength(1);

		// 고르고 ⌘⌫(휴지통으로 이동) → 경고창에서 확인하면 목록에서 빠진다
		await finder.getByRole('option', { name: '새 이력서.pdf' }).click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		// macOS 경고창: 저장소에서도 지워진다고 알리고 확인을 받는다
		await page.getByRole('alertdialog').getByRole('button', { name: '휴지통으로 이동' }).click();
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toHaveCount(0);
		expect(docs).toHaveLength(0);
	});

	test('만든 폴더나 바탕화면에 놓아도 올라가고 놓은 자리에 보인다 (진짜 폴더처럼)', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const { docs } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);

		// 이력서 안에 새 폴더를 만들고 그 아이콘 위에 놓는다 → 이력서에 올리고 그 폴더에 둔다
		await finder.locator('.finder-content').click({ button: 'right', position: { x: 20, y: 20 } });
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
		await expect.poll(() => api.finderLayout.files[`file:${docs[1].key}`]).toBe('desktop');
		await expect(
			page.getByRole('listbox', { name: '바탕화면' }).getByRole('option', { name: '바탕.pdf' })
		).toBeVisible();
	});

	test('방문자는 끌어다 놓아도 올라가지 않는다', async ({ page }) => {
		await fakeApi(page);
		const { puts } = await fakeDocuments(page);
		const finder = await openResumeFolder(page);
		await expect(finder.getByText('공개용 이력서를 준비하고 있습니다.')).toBeVisible();
		await dropFile(page, '[data-app="finder"] .finder-content', '새 이력서.pdf', [...tinyPdf()]);
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toHaveCount(0);
		expect(puts).toHaveLength(0);
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
		expect(docs[1]).toMatchObject({ folder: 'project:macfolio', key: 'projects/macfolio/abcdefghijklmnop.pdf' });

		// 관리자 메뉴: 고르고 ⌘⌫로 지운다
		await folder.getByRole('option', { name: '구조도.pdf' }).click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		// macOS 경고창: 저장소에서도 지워진다고 알리고 확인을 받는다
		await page.getByRole('alertdialog').getByRole('button', { name: '휴지통으로 이동' }).click();
		await expect(folder.getByRole('option', { name: '구조도.pdf' })).toHaveCount(0);
		expect(docs.map((doc) => doc.name)).toEqual(['발표.pdf']);
	});
});
