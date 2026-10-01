import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';

// 애니메이션을 켠 채로, 애니메이션이 끝난 뒤 창이 제대로 닫히고 최소화되는지 확인한다
test.use({ reducedMotion: 'no-preference' });

test.describe('애니메이션', () => {
	test('창은 열릴 때 애니메이션이 돌고, 닫기·최소화는 애니메이션이 끝난 뒤 처리된다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github).toBeVisible();
		expect(await github.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
		await expect.poll(() => github.evaluate((el) => el.getAnimations().length)).toBe(0);

		await github.getByRole('button', { name: '최소화' }).click();
		// 애니메이션 중에는 아직 남아 있다
		await expect(github).toHaveClass(/closing/);
		await expect(github).toBeHidden();

		await dockItem(page, 'github').click();
		await expect(github).toBeVisible();
		await github.getByRole('button', { name: '닫기', exact: true }).click();
		await expect(github).toBeHidden();
	});

	test('전체 화면 전환은 크기가 부드럽게 바뀐다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect.poll(() => github.evaluate((el) => el.getAnimations().length)).toBe(0);

		await github.getByRole('button', { name: '전체 화면' }).click();
		await expect(github).toHaveClass(/frame-animating/);
		await expect(github).not.toHaveClass(/frame-animating/);
		const viewport = page.viewportSize()!;
		expect((await github.boundingBox())!.width).toBeCloseTo(viewport.width, 0);
	});
});
