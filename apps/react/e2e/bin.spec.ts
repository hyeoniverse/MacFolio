import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

/** 휴지통: 버린 기능을 모아 두고, 관리자에게는 지운 메모를 보여 준다 */
test.describe('휴지통', () => {
	test('Dock의 휴지통을 누르면 버린 기능이 보이고, 고르면 무엇으로 왜 바꿨는지 나온다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const list = bin.getByRole('listbox', { name: '지운 기능' });
		await expect(list.getByRole('option')).not.toHaveCount(0);
		// 방문자에게는 지운 메모가 없다
		await expect(bin.getByRole('button', { name: /지운 메모/ })).toHaveCount(0);

		await list.getByRole('option', { name: /Create React App/ }).click();
		const info = bin.getByRole('region', { name: 'Create React App 정보' });
		await expect(info).toContainText('Vite');
		await expect(info).toContainText('5.05초');

		// 키보드로 옮겨 고른다 (최근에 버린 것이 위라 CRA는 맨 아래)
		await list.focus();
		await page.keyboard.press('ArrowUp');
		await expect(list.getByRole('option', { name: /Create React App/ })).toHaveAttribute('aria-selected', 'false');
	});

	test('개발 일지 읽기를 누르면 메모 앱이 그 글을 연다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('option', { name: /Create React App/ }).click();
		await bin.getByRole('button', { name: '개발 일지 읽기' }).click();

		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' })).toHaveClass(/active/);
	});

	test('바꾸기 전 모습을 크게 보고, 지운 줄 수와 커밋을 보여 준다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('option', { name: /방명록이던 메모 앱/ }).click();
		const info = bin.getByRole('region', { name: '방명록이던 메모 앱 정보' });
		await expect(info).toContainText('−1,253줄');
		await expect(info.getByRole('link', { name: '844688c' })).toHaveAttribute(
			'href',
			'https://github.com/hyeoniverse/MacFolio/commit/844688c42f90264ce2d4fdee407028c7e4489970'
		);

		// 누르면 크게, Esc로 닫는다
		await info.getByRole('button', { name: '바꾸기 전 모습 크게 보기' }).click();
		const look = bin.getByRole('dialog', { name: '방명록이던 메모 앱 바꾸기 전 모습' });
		await expect(look.getByRole('img')).toBeVisible();
		expect(await look.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
		await page.keyboard.press('Escape');
		await expect(look).toHaveCount(0);

		// 목록에서 스페이스로도 연다 (Finder의 훑어보기)
		await bin.getByRole('listbox', { name: '지운 기능' }).focus();
		await page.keyboard.press('Space');
		await expect(look).toBeVisible();
	});

	test('방문자에게는 서버 파일이 없다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await expect(bin.getByRole('navigation', { name: '휴지통' }).getByRole('button')).toHaveText([/지운 기능/]);
	});

	test('관리자는 서버 파일에서 쓰는 곳이 없는 파일을 지운다 (글·배경화면이 쓰는 파일은 지울 수 없다)', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		const upload = (id: string, name: string) =>
			api.uploads.push({ id, name, type: 'image/png', image: true, data: png, createdAt: '2026-10-01T00:00:00.000Z' });
		upload('usedinpost000001', '글 그림.png');
		upload('wallpaper0000001', '배경.png');
		upload('oldversion000001', '예전 그림.png');
		upload('nobodyuses000001', '안 쓰는 그림.png');
		api.posts.push({
			slug: 'server-post',
			title: '서버 글',
			date: '2026-10-01',
			category: '기타',
			summary: '',
			body: '![그림](https://api.example.com/files/usedinpost000001)',
			deleted: false,
			revisions: [
				{
					id: 1,
					createdAt: '2026-10-01T00:00:00Z',
					createdBy: 'hyeoniverse',
					title: '서버 글',
					date: '2026-10-01',
					category: '기타',
					summary: '',
					body: '/files/oldversion000001',
				},
			],
		});
		api.wallpapers.push({
			id: 'w1',
			name: '바다',
			image: '/files/wallpaper0000001',
			thumbnail: '/files/wallpaper0000001',
		});

		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('button', { name: /서버 파일/ }).click();
		const list = bin.getByRole('list', { name: '서버 파일' });
		const row = (name: string) => list.getByRole('listitem').filter({ hasText: name });
		await expect(row('글 그림.png')).toContainText('글 1개: server-post');
		await expect(row('배경.png')).toContainText('배경화면');
		await expect(row('예전 그림.png')).toContainText('예전 버전에서만: server-post');
		await expect(row('안 쓰는 그림.png')).toContainText('쓰는 곳 없음');
		// 쓰는 파일에는 지우기 단추가 없다
		await expect(row('글 그림.png').getByRole('button', { name: '지우기' })).toHaveCount(0);
		await expect(row('배경.png').getByRole('button', { name: '지우기' })).toHaveCount(0);

		// 하나 지우기 (묻는다)
		await row('안 쓰는 그림.png').getByRole('button', { name: '지우기' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '지우기' }).click();
		await expect(row('안 쓰는 그림.png')).toHaveCount(0);

		// 쓰지 않는 파일 모두 지우기: 예전 버전에서만 쓰던 파일
		await bin.getByRole('button', { name: '쓰지 않는 파일 지우기' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '지우기' }).click();
		await expect(list.getByRole('listitem')).toHaveCount(2);
		expect(api.uploads.map((item) => item.id).sort()).toEqual(['usedinpost000001', 'wallpaper0000001']);
		await expect(bin.getByRole('button', { name: '쓰지 않는 파일 지우기' })).toHaveCount(0);
	});

	test('머리줄(제목·항목 수)을 두 번 누르면 창이 커지고, 끌면 창이 옮겨진다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const title = (await bin.locator('.bin-count').boundingBox())!;
		const before = (await bin.boundingBox())!;
		await page.mouse.dblclick(title.x + title.width / 2, title.y + title.height / 2);
		await expect.poll(async () => (await bin.boundingBox())!.width).toBeGreaterThan(before.width);

		// 커진 창에서 머리줄은 다른 자리에 있다
		const grown = (await bin.locator('.bin-count').boundingBox())!;
		await page.mouse.dblclick(grown.x + grown.width / 2, grown.y + grown.height / 2);
		await expect.poll(async () => (await bin.boundingBox())!.width).toBe(before.width);
		const start = (await bin.boundingBox())!;
		const header = (await bin.locator('.bin-count').boundingBox())!;
		await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
		await page.mouse.down();
		await page.mouse.move(header.x + header.width / 2 + 60, header.y + header.height / 2 + 40, { steps: 5 });
		await page.mouse.up();
		await expect.poll(async () => (await bin.boundingBox())!.x).toBeGreaterThan(start.x + 30);
	});

	test('휴대폰 홈 화면에는 휴지통이 없다', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await enterDesktop(page);
		await expect(page.locator('[data-launch="bin"]')).toHaveCount(0);
		await expect(page.locator('[data-launch="memo"]')).toHaveCount(1);
	});
});
