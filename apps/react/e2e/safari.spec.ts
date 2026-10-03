import { test, expect, enterDesktop, appWindow } from './fixtures';

test.describe('Safari', () => {
	test('프로젝트마다 탭이 있고, 탭을 고르면 그 프로젝트 소개와 주소가 바뀐다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();

		const tabs = safari.getByRole('tab');
		await expect(tabs).toHaveCount(6);
		await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
		const panel = safari.getByRole('tabpanel');
		await expect(panel.getByRole('article', { name: 'NewPick 뉴픽' })).toBeVisible();
		// 팀 프로젝트는 진행 과정과 맡은 일을 보여준다
		await expect(panel.getByRole('region', { name: '진행 과정' })).toBeVisible();

		await safari.getByRole('tab', { name: /QRU/ }).click();
		const qru = panel.getByRole('article', { name: 'QRU 큐알유' });
		await expect(qru).toBeVisible();
		await expect(qru.getByRole('heading', { level: 1 })).toHaveText('QR 한 장에 담은 나.');
		for (const name of ['주요 기능', '만든 방식', '맡은 일', '다음 단계', '기술 사양']) {
			await expect(panel.getByRole('region', { name })).toBeVisible();
		}
		// 주소창은 데모 주소를 보여주고, 누르면 새 탭에서 연다
		const address = safari.locator('.safari-address');
		await expect(address).toHaveText('qryou-app.web.app');
		await expect(address).toHaveAttribute('target', '_blank');
		await expect(panel.getByRole('link', { name: 'GitHub에서 보기' }).first()).toHaveAttribute(
			'href',
			'https://github.com/hyeoniverse/QRU'
		);

		// 이전·다음 탭
		await safari.getByRole('button', { name: '다음 탭' }).click();
		await expect(panel.getByRole('article', { name: 'SproutFarm 새싹 농장' })).toBeVisible();
		await safari.getByRole('button', { name: '이전 탭' }).click();
		await expect(panel.getByRole('article', { name: 'QRU 큐알유' })).toBeVisible();
	});

	test('이 사이트(MacFolio)도 프로젝트 탭으로 있다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /MacFolio/ }).click();
		const macfolio = safari.getByRole('tabpanel').getByRole('article', { name: 'MacFolio' });
		await expect(macfolio.getByRole('heading', { level: 1 })).toHaveText('포트폴리오를, 데스크톱으로.');
		await expect(macfolio.getByRole('region', { name: '기술 사양' })).toContainText('NestJS');
		await expect(safari.locator('.safari-address')).toHaveText('macfolio.hyeoniverse.com');
	});

	test('데모가 없는 프로젝트는 주소창에 저장소 주소를 보여준다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /DevCourse/ }).click();
		await expect(safari.locator('.safari-address')).toHaveText('github.com/hyeoniverse/DevCourse-FullStack');
		await expect(safari.getByRole('link', { name: '데모 보기' })).toHaveCount(0);
		await expect(safari.getByRole('button', { name: '다음 탭' })).toBeDisabled();
	});

	test('탭을 닫고, 새 탭의 즐겨찾기에서 다시 연다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const tabs = safari.getByRole('tab');

		// 고른 탭을 닫으면 오른쪽 탭으로 넘어간다
		await safari.getByRole('tab', { name: /NewPick/ }).hover();
		await safari.getByRole('button', { name: 'NewPick 뉴픽 탭 닫기' }).click();
		await expect(tabs).toHaveCount(5);
		await expect(safari.getByRole('tab', { name: /WTD/ })).toHaveAttribute('aria-selected', 'true');

		// 새 탭은 시작 페이지. 즐겨찾기에서 고르면 그 탭이 프로젝트로 바뀐다
		await safari.getByRole('button', { name: '새 탭' }).click();
		await expect(safari.getByRole('tab', { name: '시작 페이지' })).toHaveAttribute('aria-selected', 'true');
		const start = safari.getByRole('region', { name: '시작 페이지' });
		await start.getByRole('button', { name: /NewPick/ }).click();
		await expect(tabs).toHaveCount(6);
		await expect(safari.getByRole('tab', { name: /NewPick/ })).toHaveAttribute('aria-selected', 'true');
		await expect(safari.getByRole('tab', { name: '시작 페이지' })).toHaveCount(0);
	});

	test('좁은 창에서도 주소창이 그대로 있고, 탭 막대는 그 아래에 같은 모양으로 있다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const tabBar = safari.getByRole('tablist', { name: '프로젝트 탭' });
		const wideRadius = await tabBar.evaluate((el) => getComputedStyle(el).borderRadius);
		await safari.evaluate((element) => (element.style.width = '560px'));

		const address = safari.locator('.safari-address');
		await expect(address).toBeVisible();
		await expect(safari.getByRole('button', { name: '이전 탭' })).toBeVisible();
		// 탭 막대는 주소창 아래, 넓을 때와 같은 둥근 막대
		expect((await tabBar.boundingBox())!.y).toBeGreaterThan((await address.boundingBox())!.y);
		expect(await tabBar.evaluate((el) => getComputedStyle(el).borderRadius)).toBe(wideRadius);

		await safari.getByRole('tab', { name: /QRU/ }).click();
		await expect(safari.getByRole('tab', { name: /QRU/ })).toHaveAttribute('aria-selected', 'true');
	});

	test('닫기 단추: 좁은 창에서도 지금 탭과 올린 탭에 보이고, 제목과 겹치지 않는다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.evaluate((element) => (element.style.width = '560px'));
		const close = safari.getByRole('button', { name: 'NewPick 뉴픽 탭 닫기' });
		await expect(close).toBeVisible();
		const title = safari.getByRole('tab', { name: /NewPick/ }).locator('span');
		const closeBox = (await close.boundingBox())!;
		const titleBox = (await title.boundingBox())!;
		expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(titleBox.x);
		// 다른 탭은 올렸을 때만
		const other = safari.getByRole('button', { name: /QRU .*탭 닫기/ });
		await expect(other).not.toBeVisible();
		await safari.getByRole('tab', { name: /QRU/ }).hover();
		await expect(other).toBeVisible();
	});

	test('탭 폭: 지금 탭은 넉넉해 제목이 다 보이고, 다른 탭은 짧게 줄어든다. 탭을 바꾸면 폭이 옮겨 간다', async ({
		page,
	}) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.evaluate((element) => (element.style.width = '560px'));
		const width = (name: RegExp) =>
			safari.getByRole('tab', { name }).evaluate((el) => el.parentElement!.getBoundingClientRect().width);
		const fullyShown = (name: RegExp) =>
			safari
				.getByRole('tab', { name })
				.locator('span')
				.evaluate((el) => el.scrollWidth <= el.clientWidth);

		await expect.poll(() => width(/NewPick/)).toBeGreaterThan(2 * (await width(/QRU/)));
		expect(await fullyShown(/NewPick/)).toBe(true);

		await safari.getByRole('tab', { name: /QRU/ }).click();
		await expect.poll(() => width(/QRU/)).toBeGreaterThan(2 * (await width(/NewPick/)));
		expect(await fullyShown(/QRU/)).toBe(true);
		// 탭 막대는 넘치지 않는다 (가로로 밀지 않아도 모든 탭이 보인다)
		expect(await safari.locator('.safari-tabs').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	});
});
