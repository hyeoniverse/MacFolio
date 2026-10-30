import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import { fakeApi, FAKE_API } from './fakeApi';

// 1×1 PNG
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

test.describe('메모 첨부 파일을 사이트 안 앱으로 열기', () => {
	test('md·txt는 텍스트 편집기, html은 Safari 새 탭, 그림은 미리보기에서 연다', async ({ page }) => {
		const api = await fakeApi(page);
		const file = (id: string, name: string, type: string, data: Buffer | string) =>
			api.uploads.push({ id, name, type, image: type.startsWith('image/'), data: Buffer.from(data) });
		file('notes0000000001', 'notes.md', 'text/markdown', '# 회의 메모\n\n- 첫째 안건\n');
		file('logs00000000001', 'server.log.txt', 'text/plain', 'line 1\n    indented line 2\n');
		file(
			'page00000000001',
			'demo.html',
			'text/html',
			'<!doctype html><h1>데모 페이지</h1><script>parent.hacked = 1</script>'
		);
		file('image0000000001', 'diagram.png', 'image/png', PNG);
		const link = (id: string, name: string) => `[${name}](${FAKE_API}/files/${id} "첨부 파일 · 1 KB")`;
		const body = [
			`회의록 ${link('notes0000000001', 'notes.md')}`,
			`서버 기록 ${link('logs00000000001', 'server.log.txt')}`,
			`데모 ${link('page00000000001', 'demo.html')}`,
			`도식 ${link('image0000000001', 'diagram.png')}`,
		].join('\n\n');
		const content = { title: '첨부 파일', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'attachments', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/attachments');
		const memo = appWindow(page, 'memo');
		const article = memo.getByRole('article');
		// 연 앱 창이 메모 창을 덮으므로, 링크를 누르기 전에 Dock으로 메모 창을 맨 앞에
		const openLink = async (name: string) => {
			await dockItem(page, 'memo').click();
			await article.getByRole('link', { name }).click();
		};

		// Markdown → 텍스트 편집기에서 서식대로
		await openLink('notes.md');
		const textedit = appWindow(page, 'textedit');
		await expect(textedit.getByRole('heading', { name: '회의 메모' })).toBeVisible();
		await expect(textedit).toContainText('notes.md');

		// 글자 파일 → 텍스트 편집기에서 고정폭 그대로
		await openLink('server.log.txt');
		await expect(textedit.locator('pre')).toContainText('    indented line 2');
		await expect(textedit).toContainText('server.log.txt');

		// HTML → Safari의 새 탭. 스크립트는 막는다 (sandbox, 부모를 건드리지 못한다)
		await openLink('demo.html');
		const safari = appWindow(page, 'safari');
		await expect(safari.getByRole('tab', { name: 'demo.html' })).toHaveAttribute('aria-selected', 'true');
		const frame = safari.locator('iframe.safari-file-frame');
		await expect(frame).toHaveAttribute('sandbox', 'allow-popups');
		await expect(
			page.frameLocator('iframe.safari-file-frame').getByRole('heading', { name: '데모 페이지' })
		).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { hacked?: number }).hacked)).toBeUndefined();

		// 그림 → 미리보기
		await openLink('diagram.png');
		const preview = appWindow(page, 'preview');
		await expect(preview).toContainText('diagram.png');
	});

	test('사이트 안에 맞는 앱이 없는 파일(zip)은 지금처럼 링크로 새 탭에서 연다', async ({ page }) => {
		const api = await fakeApi(page);
		const body = `[archive.zip](${FAKE_API}/files/zip000000000001 "첨부 파일 · 1 KB")`;
		const content = { title: '압축 파일', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'zip', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/zip');
		const link = appWindow(page, 'memo').getByRole('article').getByRole('link', { name: 'archive.zip' });
		await expect(link).toHaveAttribute('target', '_blank');
	});

	test('편집 화면: 첨부 파일 링크에 마우스를 올리면 그 앱 이름의 열기 버튼이 보이고, 누르면 그 앱으로 연다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		api.uploads.push({
			id: 'notes0000000001',
			name: 'notes.md',
			type: 'text/markdown',
			image: false,
			data: Buffer.from('# 회의 메모\n'),
		});
		const body = `회의록 [notes.md](${FAKE_API}/files/notes0000000001 "첨부 파일 · 1 KB")`;
		const content = { title: '첨부 파일', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'attachments', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/attachments');
		const memo = appWindow(page, 'memo');
		await memo.locator('.ProseMirror').getByRole('link', { name: 'notes.md' }).hover();
		const open = memo.getByRole('button', { name: '텍스트 편집기에서 열기' });
		await open.click();
		await expect(appWindow(page, 'textedit').getByRole('heading', { name: '회의 메모' })).toBeVisible();

		// 배지 안의 내려받기 버튼 [📎 notes.md ⬇]은 올릴 때의 파일 이름으로 저장한다
		await dockItem(page, 'memo').click();
		const badge = memo.locator('.ProseMirror').getByRole('link', { name: 'notes.md' });
		const download = memo.locator('.ProseMirror').getByRole('button', { name: 'notes.md 내려받기' });
		const [badgeBox, buttonBox] = [(await badge.boundingBox())!, (await download.boundingBox())!];
		expect(buttonBox.x).toBeGreaterThan(badgeBox.x);
		expect(buttonBox.x + buttonBox.width).toBeLessThan(badgeBox.x + badgeBox.width);
		const downloading = page.waitForEvent('download');
		await download.click();
		expect((await downloading).suggestedFilename()).toBe('notes.md');
		// 내려받기는 글을 바꾸지 않는다
		await page.waitForTimeout(300);
		expect(api.postSaves).toBe(0);
	});

	test('읽기 화면: 첨부 파일 배지 안의 내려받기 버튼은 앱으로 열지 않고 파일 이름 그대로 저장한다', async ({
		page,
	}) => {
		const api = await fakeApi(page);
		api.uploads.push({
			id: 'notes0000000001',
			name: 'notes.md',
			type: 'text/markdown',
			image: false,
			data: Buffer.from('# 회의 메모\n'),
		});
		const body = [
			`회의록 [notes.md](${FAKE_API}/files/notes0000000001 "첨부 파일 · 1 KB")`,
			`압축 [archive.zip](${FAKE_API}/files/zip000000000001 "첨부 파일 · 1 KB")`,
		].join('\n\n');
		const content = { title: '첨부 파일', date: '2026-10-30', category: '기타', summary: '', body };
		api.posts.push({ slug: 'attachments', ...content, published: content, deleted: false });
		await enterDesktop(page, '/memo/attachments');
		const article = appWindow(page, 'memo').getByRole('article');
		// 앱으로 여는 파일과 맞는 앱이 없는 파일 모두 내려받기 버튼이 있다
		await expect(article.getByRole('button', { name: 'archive.zip 내려받기' })).toBeVisible();
		// 버튼은 배지 안(이름 오른쪽)에 있다
		const badgeBox = (await article.getByRole('link', { name: 'notes.md' }).boundingBox())!;
		const buttonBox = (await article.getByRole('button', { name: 'notes.md 내려받기' }).boundingBox())!;
		expect(buttonBox.x + buttonBox.width).toBeLessThan(badgeBox.x + badgeBox.width);
		expect(Math.abs(buttonBox.y + buttonBox.height / 2 - (badgeBox.y + badgeBox.height / 2))).toBeLessThan(2);
		const downloading = page.waitForEvent('download');
		await article.getByRole('button', { name: 'notes.md 내려받기' }).click();
		expect((await downloading).suggestedFilename()).toBe('notes.md');
		await expect(appWindow(page, 'textedit')).toHaveCount(0);
	});
});
