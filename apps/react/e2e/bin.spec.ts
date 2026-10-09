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

	test('관리자는 지운 메모를 되돌려 놓거나 영구히 지운다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const removed = (slug: string) => ({
			slug,
			title: '',
			date: '',
			category: '',
			summary: '',
			body: '',
			deleted: true,
			deletedAt: new Date().toISOString(),
			published: null,
			draft: null,
		});
		api.posts.push(removed('cra-to-vite'), removed('bugs-found-by-tests'));
		await enterDesktop(page);
		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');

		await bin.getByRole('button', { name: /지운 메모/ }).click();
		const memos = bin.getByRole('list', { name: '지운 메모' });
		await expect(memos.getByRole('listitem')).toHaveCount(2);
		await expect(memos).toContainText('30일 남음');

		// 되돌려 놓기
		await memos
			.getByRole('listitem')
			.filter({ hasText: 'CRA에서 Vite로' })
			.getByRole('button', { name: '되돌려 놓기' })
			.click();
		await expect(memos.getByRole('listitem')).toHaveCount(1);
		// 서버에 내용이 없던 저장소 글이라 지운 표시가 사라진다 (파일이 다시 보인다)
		expect(api.posts.find((post) => post.slug === 'cra-to-vite')).toBeUndefined();

		// 즉시 삭제는 묻는다
		await memos.getByRole('button', { name: '즉시 삭제' }).click();
		await bin.getByRole('alertdialog').getByRole('button', { name: '삭제' }).click();
		await expect(bin.getByText('지운 메모가 없습니다.')).toBeVisible();
		expect(api.posts.find((post) => post.slug === 'bugs-found-by-tests')).toMatchObject({ deletedAt: null });
	});

	test('휴지통에서 되살리면 열려 있는 메모 앱의 최근 삭제된 항목도 바뀐다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.posts.push({
			slug: 'cra-to-vite',
			title: '',
			date: '',
			category: '',
			summary: '',
			body: '',
			deleted: true,
			deletedAt: new Date().toISOString(),
			published: null,
			draft: null,
		});
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		const trash = memo.getByRole('navigation', { name: '카테고리' }).getByRole('button', { name: /^최근 삭제된 항목/ });
		await expect(trash).toContainText('1');

		await dockItem(page, 'bin').click();
		const bin = appWindow(page, 'bin');
		await bin.getByRole('button', { name: /지운 메모/ }).click();
		await bin.getByRole('button', { name: '되돌려 놓기' }).click();
		await expect(bin.getByText('지운 메모가 없습니다.')).toBeVisible();
		await expect(trash).toHaveCount(0);
		await expect(memo.locator('.memo-item', { hasText: 'CRA에서 Vite로' })).toHaveCount(1);
	});

	test('휴대폰 홈 화면에는 휴지통이 없다', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await enterDesktop(page);
		await expect(page.locator('[data-launch="bin"]')).toHaveCount(0);
		await expect(page.locator('[data-launch="memo"]')).toHaveCount(1);
	});
});
