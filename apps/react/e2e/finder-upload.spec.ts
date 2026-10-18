import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { FAKE_API, fakeApi } from './fakeApi';
import { tinyPdf } from './fakeFiles';

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
			const key = `${folder === '이력서' ? 'resume' : 'portfolio'}/abcdefghijklmnop.${name.split('.').pop()}`;
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

		// 고르고 ⌘⌫(휴지통으로 이동) → 확인하면 목록에서 빠진다
		page.once('dialog', (dialog) => dialog.accept());
		await finder.getByRole('option', { name: '새 이력서.pdf' }).click();
		await finder.locator('.finder-content').press('ControlOrMeta+Backspace');
		await expect(finder.getByRole('option', { name: '새 이력서.pdf' })).toHaveCount(0);
		expect(docs).toHaveLength(0);
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
});
