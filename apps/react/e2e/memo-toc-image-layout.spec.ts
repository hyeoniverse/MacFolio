import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Locator } from '@playwright/test';
import { fakeApi } from './fakeApi';
import { LAYOUT_POST_TITLE, layoutPost } from './memoLayoutPost';

const box = async (locator: Locator) => (await locator.boundingBox())!;

test.describe('메모 목차', () => {
	test('제목 아래 목차에 ## · ### 제목이 나오고, 누르면 그 제목으로 가며 지금 읽는 절을 표시한다', async ({ page }) => {
		await fakeApi(page, { signedIn: false });
		await enterDesktop(page, '/memo/merge-strategies');
		const memo = appWindow(page, 'memo');
		const toc = memo.getByRole('navigation', { name: '목차' });
		await expect(toc.getByRole('button', { name: '목차', exact: true })).toHaveAttribute('aria-expanded', 'true');
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const headings = await body.locator(':scope > h2, :scope > h3').allTextContents();
		await expect(toc.locator('li button')).toHaveText(headings.map((text) => text.trim()));
		// 접기 블록 안의 제목은 목차에 넣지 않는다 (펼치지 않으면 갈 수 없다)
		expect(headings.length).toBeGreaterThanOrEqual(3);

		const target = headings[3].trim();
		await toc.getByRole('button', { name: target, exact: true }).click();
		const heading = body.locator(':scope > :is(h2, h3)', { hasText: target }).first();
		await expect(heading).toBeInViewport();
		await expect(heading).toBeFocused();
		await expect(page).toHaveURL(/\/memo\/merge-strategies$/);

		// 목차가 화면 위로 지나가면 떠 있는 버튼으로 연다. 지금 읽는 절에 체크
		const float = memo.getByRole('button', { name: '목차 보기' });
		await expect(float).toBeVisible();
		await float.click();
		const menu = page.getByRole('menu', { name: '목차' });
		await expect(menu.getByRole('menuitemcheckbox', { checked: true })).toHaveText(target);
		await page.keyboard.press('Escape');
		await expect(menu).toBeHidden();
		// 제목 아래 목차에서도 같은 절
		await expect(toc.locator('li button[aria-current="location"]')).toHaveText(target);
	});

	test('제목이 셋 미만인 글에는 목차가 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: false });
		const content = {
			title: '짧은 글',
			date: '2026-10-27',
			category: '개발기/MacFolio',
			summary: '',
			body: '## 하나\n\n글.\n\n## 둘\n\n글.',
		};
		api.posts = [{ slug: 'short-post', ...content, deleted: false, published: content }];
		await enterDesktop(page, '/memo/short-post');
		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.memo-reader-body h1')).toHaveText('짧은 글');
		await expect(memo.getByRole('navigation', { name: '목차' })).toHaveCount(0);
	});
});

test.describe('메모 이미지 배치', () => {
	test('주소 끝의 #left·#right는 정렬, #float-left·#float-right는 본문 40% 폭으로 띄우고 문단이 옆으로 흐른다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: false });
		api.posts = [layoutPost()];
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: LAYOUT_POST_TITLE }).click();
		const body = memo.locator('.memo-reader-body .memo-markdown');
		const area = await box(body);
		const figure = (alt: string) => body.locator('.memo-figure', { has: page.getByRole('img', { name: alt }) });

		await expect(figure('왼쪽 그림')).toHaveAttribute('data-layout', 'left');
		// 정렬은 본문보다 좁은 그림에서 보인다
		expect((await box(figure('왼쪽 그림').locator('img'))).width).toBeLessThan(area.width - 40);
		expect(Math.abs((await box(figure('왼쪽 그림').locator('img'))).x - area.x)).toBeLessThan(2);
		const right = await box(figure('오른쪽 그림').locator('img'));
		expect(Math.abs(right.x + right.width - (area.x + area.width))).toBeLessThan(2);

		for (const [alt, side] of [
			['왼쪽에 띄운 그림', 'left'],
			['오른쪽에 띄운 그림', 'right'],
		] as const) {
			const floated = figure(alt);
			expect(await floated.evaluate((el) => getComputedStyle(el).float)).toBe(side);
			const rect = await box(floated);
			expect(Math.abs(rect.width - area.width * 0.4)).toBeLessThan(2);
			// 다음 문단의 첫 줄은 이미지 옆에서 시작한다
			const next = floated.locator('xpath=ancestor::p/following-sibling::p[1]');
			const line = await next.evaluate((p) => {
				const range = document.createRange();
				range.selectNodeContents(p);
				const first = range.getClientRects()[0];
				return { left: first.left, right: first.right };
			});
			if (side === 'left') expect(line.left).toBeGreaterThan(rect.x + rect.width);
			else expect(line.right).toBeLessThan(rect.x);
		}
		// 캡션은 띄운 이미지 아래
		await expect(figure('왼쪽에 띄운 그림').locator('.memo-caption')).toHaveText('왼쪽에 띄운 캡션');
		// 다음 제목은 띄운 이미지 아래에서 시작한다
		const floatedLeft = await box(figure('왼쪽에 띄운 그림'));
		const nextHeading = await box(body.getByRole('heading', { name: '오른쪽에 띄우기' }));
		expect(nextHeading.y).toBeGreaterThanOrEqual(floatedLeft.y + floatedLeft.height);
	});

	test('편집기: 이미지를 고르고 배치 버튼을 누르면 같은 배치로 보이고, 저장한 Markdown 주소 끝에 표기가 남는다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		api.posts = [layoutPost()];
		await enterDesktop(page);
		await dockItem(page, 'memo').click();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: LAYOUT_POST_TITLE }).click();
		const editor = memo.locator('.ProseMirror');
		await expect(editor).toBeVisible();
		const figure = editor.locator('.memo-figure', { has: page.getByRole('img', { name: '왼쪽 그림' }) });
		await expect(figure).toHaveAttribute('data-layout', 'left');
		await figure.locator('img').click();
		const bar = figure.getByRole('group', { name: '이미지 배치' });
		await expect(bar.getByRole('button', { name: '왼쪽 정렬' })).toHaveAttribute('aria-pressed', 'true');
		await bar.getByRole('button', { name: '오른쪽에 띄우고 글 감싸기' }).click();
		await expect(figure).toHaveAttribute('data-layout', 'float-right');
		expect(await figure.evaluate((el) => getComputedStyle(el).float)).toBe('right');
		await expect
			.poll(() => api.posts[0]?.body)
			.toContain('![왼쪽 그림](/imgs/projects/sproutfarm/scene.png#float-right)');
		// 가운데로 되돌리면 표기를 지운다
		await bar.getByRole('button', { name: '가운데 정렬' }).click();
		await expect(figure).not.toHaveAttribute('data-layout', /.+/);
		await expect.poll(() => api.posts[0]?.body).toContain('![왼쪽 그림](/imgs/projects/sproutfarm/scene.png)\n');
	});
});
