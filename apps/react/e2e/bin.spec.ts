import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';

/** 휴지통: 버린 기능을 모아 두고, 관리자에게는 지운 메모를 보여 준다 */
test.describe('휴지통', () => {
	test('내 브라우저 데이터: 이 사이트가 남긴 것을 보여 주고, 비우면 처음 설정으로 돌아간다', async ({ page }) => {
		// 다크 모드를 고르고 메모 검색어를 남긴 브라우저
		await page.addInitScript(() => {
			if (sessionStorage.getItem('seeded')) return;
			sessionStorage.setItem('seeded', '1');
			localStorage.setItem('macfolio:settings', JSON.stringify({ theme: 'dark' }));
			localStorage.setItem('macfolio:memo:recent-finds', JSON.stringify(['vite', 'css']));
		});
		await enterDesktop(page);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const list = bin.getByRole('list', { name: '내 브라우저 데이터' });
		// 항목 이름이 정확히 같은 줄 (설명에도 '설정' 같은 말이 나온다)
		const row = (name: string) =>
			list.getByRole('listitem').filter({ has: page.locator('.bin-data-name', { hasText: new RegExp(`^${name}$`) }) });
		await expect(row('메모 최근 검색어')).toContainText('검색어 2개');
		await expect(row('방문자 이름 쿠키')).toContainText('macfolio_visitor');

		// 설정을 비우면 바로 처음 설정(시스템을 따름)으로
		await row('설정').getByRole('button', { name: '비우기' }).click();
		await expect(row('설정')).toHaveCount(0);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		expect(await page.evaluate(() => localStorage.getItem('macfolio:settings'))).toBeNull();

		// 휴지통 비우기는 묻고 모두 지운다 (쿠키 안내는 남는다)
		await bin.getByRole('button', { name: '휴지통 비우기' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '휴지통 비우기' }).click();
		await expect(bin.getByText('이 사이트가 이 브라우저에 남긴 것이 없습니다')).toBeVisible();
		expect(await page.evaluate(() => localStorage.getItem('macfolio:memo:recent-finds'))).toBeNull();
		await expect(row('방문자 이름 쿠키')).toBeVisible();
	});

	test('개인정보 문서를 누르면 Finder가 그 문서를 연다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		await appWindow(page, 'bin').getByRole('button', { name: '개인정보 문서' }).click();
		const finder = appWindow(page, 'finder');
		await expect(finder.getByRole('heading', { level: 1, name: 'privacy.md' })).toBeVisible();
	});

	test('방문자에게는 서버 파일이 없다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await expect(bin.getByRole('navigation', { name: '휴지통' }).getByRole('button')).toHaveText([
			/내 브라우저 데이터/,
		]);
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
		await expect(bin.getByText(/저장소 글\(Markdown\)의 이미지는 사이트와 함께 배포되어/)).toBeVisible();
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

	test('서버 파일이 없으면 무엇이 여기 보이는지 알려 준다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('button', { name: /서버 파일/ }).click();
		await expect(bin.getByText('서버에 올린 파일이 없습니다.')).toBeVisible();
		await expect(bin.getByText(/메모 편집기로 올린 이미지·첨부 파일과 시스템 설정에서 올린 배경화면/)).toBeVisible();
	});

	test('머리줄(제목)을 두 번 누르면 창이 커지고, 끌면 창이 옮겨진다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		const title = (await bin.locator('.bin-title').boundingBox())!;
		const before = (await bin.boundingBox())!;
		await page.mouse.dblclick(title.x + title.width / 2, title.y + title.height / 2);
		await expect.poll(async () => (await bin.boundingBox())!.width).toBeGreaterThan(before.width);

		// 커진 창에서 머리줄은 다른 자리에 있다
		const grown = (await bin.locator('.bin-title').boundingBox())!;
		await page.mouse.dblclick(grown.x + grown.width / 2, grown.y + grown.height / 2);
		await expect.poll(async () => (await bin.boundingBox())!.width).toBe(before.width);
		const start = (await bin.boundingBox())!;
		const header = (await bin.locator('.bin-title').boundingBox())!;
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
