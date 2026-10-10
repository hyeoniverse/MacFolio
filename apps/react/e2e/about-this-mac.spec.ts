import { test, expect, enterDesktop, appWindow } from './fixtures';

test.describe('이 Mac에 관하여', () => {
	test('Apple 메뉴 맨 위에서 열면 만든 사람의 프로필이 보이고, 닫기·Esc로 닫는다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		const menu = page.getByRole('menu', { name: 'Apple 메뉴', exact: true });
		await expect(menu.getByRole('menuitem').first()).toHaveText('이 Mac에 관하여');
		await menu.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();

		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		await expect(about.getByRole('heading', { name: '김정현' })).toBeVisible();
		await expect(about).toContainText('Kim Jeong Hyeon');
		const specs = about.locator('.about-mac-specs > div');
		await expect(specs).toHaveText([
			'직무Frontend Focused Fullstack Developer',
			'학교서울여자대학교',
			'위치Seoul, South Korea',
			'이메일hyeoniverse.dev@gmail.com (메일 앱에서 쓰기)',
			'GitHubhyeoniverse (새 탭)',
			'주요 기술React · Next.js · TypeScript',
		]);
		// 이메일도 누를 수 있는 링크로 보인다: GitHub과 같은 파란 글자와 ↗
		const email = about.getByRole('link', { name: 'hyeoniverse.dev@gmail.com (메일 앱에서 쓰기)' });
		await expect(email.locator('.fa-arrow-up-right-from-square')).toBeVisible();
		const role = about.locator('.about-mac-specs dd').first();
		expect(await email.evaluate((el) => getComputedStyle(el).color)).not.toBe(
			await role.evaluate((el) => getComputedStyle(el).color)
		);
		await expect(email).toHaveAttribute('href', 'mailto:hyeoniverse.dev@gmail.com');
		// 메뉴는 닫히고, 닫기 단추에 초점
		await expect(menu).toBeHidden();
		await expect(about.getByRole('button', { name: '닫기' })).toBeFocused();
		// GitHub은 바깥 링크: ↗ 표시와 함께 새 탭으로 연다
		const github = about.getByRole('link', { name: 'hyeoniverse (새 탭)' });
		await expect(github).toHaveAttribute('href', 'https://github.com/hyeoniverse');
		await expect(github).toHaveAttribute('target', '_blank');
		await expect(github.locator('.fa-arrow-up-right-from-square')).toBeVisible();
		await page.route('https://github.com/hyeoniverse', (route) => route.fulfill({ status: 200, body: 'GitHub' }));
		const popup = page.waitForEvent('popup');
		await github.click();
		expect((await popup).url()).toBe('https://github.com/hyeoniverse');
		await page.bringToFront();

		await page.keyboard.press('Escape');
		await expect(about).toBeHidden();

		// 다시 열어 닫기 단추로
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await menu.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		await about.getByRole('button', { name: '닫기' }).click();
		await expect(about).toBeHidden();
	});

	test('빈 곳을 잡아 옮기고, 추가 정보…는 macOS처럼 시스템 설정의 정보를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		const before = (await about.boundingBox())!;
		const subtitle = (await about.locator('.about-mac-subtitle').boundingBox())!;
		await page.mouse.move(subtitle.x + 5, subtitle.y + 5);
		await page.mouse.down();
		await page.mouse.move(subtitle.x + 85, subtitle.y + 45, { steps: 5 });
		await page.mouse.up();
		const after = (await about.boundingBox())!;
		expect(Math.round(after.x - before.x)).toBe(80);
		expect(Math.round(after.y - before.y)).toBe(40);

		await about.getByRole('button', { name: '추가 정보…' }).click();
		await expect(about).toBeHidden();
		const settings = appWindow(page, 'settings');
		await expect(settings.getByRole('button', { name: '정보' })).toHaveAttribute('aria-current', 'page');
		// 작은 창보다 자세히: 기술 전부와 이 사이트를 만든 기술
		await expect(settings.getByRole('region', { name: '프로필' })).toContainText('이름김정현 (Kim Jeong Hyeon)');
		await expect(settings.getByRole('region', { name: '기술' })).toContainText('백엔드Node.js · Express');
		await expect(settings.getByRole('region', { name: '이 사이트 (MacFolio)' })).toContainText(
			'저장소github.com/hyeoniverse/MacFolio'
		);

		// 시스템 설정이 이미 열려 있어도 다시 누르면 정보로 간다
		await settings.getByRole('button', { name: '계정' }).click();
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		await about.getByRole('button', { name: '추가 정보…' }).click();
		await expect(settings.getByRole('button', { name: '정보' })).toHaveAttribute('aria-current', 'page');
	});

	test('저작권 줄 위의 개인정보 처리 방침(macOS의 규제 인증서 자리)은 Finder에서 문서를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		await about.getByRole('button', { name: '개인정보 처리 방침' }).click();
		await expect(about).toBeHidden();
		const finder = appWindow(page, 'finder');
		await expect(finder.getByRole('article', { name: 'privacy.md' }).getByRole('heading', { level: 1 })).toHaveText(
			'개인정보: 무엇을 모으고 얼마나 두나'
		);
	});

	test('이메일을 누르면 기기의 메일 앱이 아니라 이 사이트의 메일 앱에서 새로운 메시지를 연다', async ({ page }) => {
		await enterDesktop(page);
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		const about = page.getByRole('dialog', { name: '이 Mac에 관하여' });
		await about.getByRole('link', { name: 'hyeoniverse.dev@gmail.com' }).click();
		await expect(about).toBeHidden();
		const mail = appWindow(page, 'mail');
		const compose = mail.getByRole('form', { name: '새로운 메시지' });
		await expect(compose).toBeVisible();
		await expect(compose).toContainText('받는 사람:김정현 <hyeoniverse.dev@gmail.com>');

		// 메일 앱이 이미 열려 있어도 (목록으로 돌아간 뒤) 시스템 설정의 정보에서 다시 연다
		await compose.getByRole('button', { name: '취소' }).click();
		await expect(compose).toBeHidden();
		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
		await about.getByRole('button', { name: '추가 정보…' }).click();
		await appWindow(page, 'settings').getByRole('link', { name: 'hyeoniverse.dev@gmail.com' }).click();
		await expect(compose).toBeVisible();
	});
});
