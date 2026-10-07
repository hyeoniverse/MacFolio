import { test, expect, appWindow, storeMessagesOnServer } from './fixtures';
import { fakeApi } from './fakeApi';
import type { Page } from '@playwright/test';

/** 로딩 화면을 탭해 넘기고 홈 화면에 들어간다. */
async function enterHome(page: Page, path = '/') {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

/** 홈 화면의 앱 아이콘. 다른 페이지에 있으면 점을 눌러 그 페이지로 넘긴다 (보이는 페이지의 앱만 누를 수 있다) */
async function homeApp(page: Page, label: string) {
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	const count = await pages.count();
	for (let index = 0; index < count; index++) {
		if ((await pages.nth(index).locator(`.mobile-app[aria-label="${label}"]`).count()) === 0) continue;
		if (count > 1) await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		break;
	}
	return home.getByRole('button', { name: label, exact: true });
}

/** 마우스로 세로로 쓴다 */
async function swipe(page: Page, x: number, fromY: number, toY: number) {
	await page.mouse.move(x, fromY);
	await page.mouse.down();
	await page.mouse.move(x, toY, { steps: 8 });
	await page.mouse.up();
}

/** 손가락으로 세로로 쓴다 (Chromium DevTools 프로토콜로 실제 터치 이벤트를 보낸다) */
async function fingerSwipe(page: Page, x: number, fromY: number, toY: number) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: fromY }] });
	for (let i = 1; i <= 8; i++) {
		const y = fromY + ((toY - fromY) * i) / 8;
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
	}
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

test.describe('모바일', () => {
	test('데스크톱 대신 iOS 홈 화면이 보이고, 처음에는 열린 앱이 없다', async ({ page }) => {
		await enterHome(page);

		await expect(page.locator('.mobile-home')).toBeVisible();
		await expect(page.locator('.macos-statusbar')).toHaveCount(0);
		await expect(page.locator('.dock')).toHaveCount(0);
		await expect(page.locator('.container')).toHaveCount(0);
		await expect(page.locator('.music-player')).toHaveCount(0);

		await expect(page.getByRole('navigation', { name: 'Dock' }).getByRole('button')).toHaveCount(4);
		// 화면이 없는 앱(사진, 휴지통)은 홈 화면에 두지 않는다
		await expect(await homeApp(page, '휴지통')).toHaveCount(0);
		// Finder는 iOS처럼 '파일'로 보인다
		await expect(await homeApp(page, 'Finder')).toHaveCount(0);
		await expect(await homeApp(page, '파일')).toBeVisible();
		// 새싹 농장은 모바일 모드가 있어 휴대폰에서도 연다
		await expect(await homeApp(page, '새싹 농장')).toBeVisible();
		// 터미널은 모바일에서 '단축어'로 보인다
		await expect(await homeApp(page, '터미널')).toHaveCount(0);
		await expect(await homeApp(page, '단축어')).toBeVisible();
	});

	test('글 주소로 들어오면 홈 화면 대신 메모 앱이 그 글의 본문으로 열린다', async ({ page }) => {
		await enterHome(page, '/memo/cra-to-vite');
		const memo = page.locator('[data-app="memo"]');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText('CRA에서 Vite로 옮기기');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toBeInViewport();
		// 휴대폰에서도 공유 단추가 있다 (공유 시트를 연다)
		await expect(memo.getByRole('button', { name: '링크 공유' }).first()).toBeVisible();
	});

	test('새싹 농장은 휴대폰에서도 화면을 가득 채워 게임을 띄운다', async ({ page }) => {
		await page.route('https://sprout-farm-beta.vercel.app/**', (route) =>
			route.fulfill({ contentType: 'text/html', body: '<button>START</button>' })
		);
		await enterHome(page);
		await (await homeApp(page, '새싹 농장')).tap();
		const game = appWindow(page, 'sproutfarm');
		await expect(game).toBeVisible();
		await expect(
			page.frameLocator('iframe[title="SproutFarm 새싹 농장"]').getByRole('button', { name: 'START' })
		).toBeVisible();
	});

	test('앱은 화면을 가득 채워 열리고, 홈 인디케이터로 돌아온다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, 'Safari')).tap();

		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();
		const { width, height } = page.viewportSize()!;
		// 여는 애니메이션이 끝나면 화면과 같은 크기가 된다
		await expect.poll(() => safari.boundingBox()).toEqual({ x: 0, y: 0, width, height });
		// 신호등 버튼과 크기 조절 핸들이 없다
		await expect(safari.locator('.traffic-lights')).toHaveCount(0);
		await expect(safari.locator('.resize-handle')).toHaveCount(0);

		await safari.getByRole('button', { name: '홈 화면으로' }).tap();
		await expect(safari).toBeHidden();

		// 제목 막대의 홈 버튼으로도 돌아온다
		await (await homeApp(page, '시스템 설정')).tap();
		const settings = appWindow(page, 'settings');
		await expect(settings).toBeVisible();
		await settings.getByRole('button', { name: '홈', exact: true }).tap();
		await expect(settings).toBeHidden();
	});

	test('메시지 서버에 닿지 못하면 메시지를 열지 않고, 확인하면 홈 화면으로 돌아온다', async ({ page }) => {
		await storeMessagesOnServer(page);
		await enterHome(page);
		await (await homeApp(page, '메시지')).tap();
		const alert = appWindow(page, 'messages').getByRole('alertdialog', { name: '메시지를 열 수 없습니다' });
		await expect(alert).toBeVisible();

		await alert.getByRole('button', { name: '확인' }).tap();
		await expect(appWindow(page, 'messages')).toBeHidden();
		await expect(page.locator('.mobile-home')).toBeVisible();
	});

	test('관리자는 더한 배경화면을 길게 눌러 메뉴를 열고, 휴대폰에서는 ×가 늘 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.wallpapers.push({
			id: 'wallpaper0000001',
			name: '새벽',
			image: '/files/a',
			thumbnail: '/files/b',
		});
		await enterHome(page);
		await (await homeApp(page, '시스템 설정')).tap();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '배경화면' }).tap();
		// 휴대폰에는 iOS 배경화면만, 더한 배경화면도 함께 (모두 보기 없이 격자)
		await expect(settings.getByRole('radiogroup', { name: 'macOS 배경화면' })).toHaveCount(0);
		await expect(settings.getByRole('radiogroup', { name: 'iOS 배경화면' }).getByRole('radio')).toHaveCount(6);
		await expect(settings.getByRole('radiogroup', { name: '추가한 배경화면' }).getByRole('radio')).toHaveCount(1);
		await expect(settings.getByRole('button', { name: /모두 보기/ })).toHaveCount(0);
		await expect(settings.getByRole('button', { name: '새벽 배경화면 삭제' })).toBeVisible();
		await expect(settings.getByRole('button', { name: '새벽 배경화면 삭제' })).toHaveCSS('opacity', '1');

		const tile = settings.getByRole('radio', { name: '새벽' });
		await tile.scrollIntoViewIfNeeded();
		const box = (await tile.boundingBox())!;
		await tile.dispatchEvent('pointerdown', {
			pointerType: 'touch',
			clientX: box.x + box.width / 2,
			clientY: box.y + box.height / 2,
		});
		await expect(page.getByRole('menu', { name: '배경화면 메뉴' })).toBeVisible();
		await tile.dispatchEvent('pointerup', { pointerType: 'touch' });
		// 메뉴를 연 손가락을 뗀 것은 고르기가 아니다
		await tile.dispatchEvent('click');
		await expect(tile).not.toBeChecked();
	});

	test('가로로 넘치는 화면이 없다', async ({ page }) => {
		await enterHome(page);
		for (const label of ['Safari', 'GitHub', '메모', '메일', '메시지', '시스템 설정', '단축어', '음악']) {
			await (await homeApp(page, label)).tap();
			const content = page.locator('.container.mobile .content');
			await expect(content).toBeVisible();
			const overflow = await content.evaluate((el) => el.scrollWidth - el.clientWidth);
			expect(overflow, `${label}이(가) 가로로 넘친다`).toBeLessThanOrEqual(1);
			await page.locator('.container.mobile .home-indicator').tap();
		}
	});

	test('메모는 목록 → 본문 → 목록 → 폴더 순서로 한 화면씩 넘어간다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');

		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
		await expect(memo.getByRole('article')).toBeHidden();

		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).tap();
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeHidden();

		// 뒤로 가기는 제목 막대에 하나만: 본문 → 목록 → 폴더 → 홈
		const back = memo.locator('.mobile-navbar-home');
		await expect(memo.locator('.memo-back:visible')).toHaveCount(0);
		await expect(back).toHaveText('모든 글');
		await back.tap();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
		await expect(back).toHaveText('폴더');
		await back.tap();
		await expect(memo.getByRole('navigation', { name: '카테고리' })).toBeVisible();
		await expect(back).toHaveText('홈');

		await memo.getByRole('button', { name: /^개발기/ }).tap();
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
	});

	test('상태 표시줄은 앱 위에 투명하게 겹친다: 앱은 화면 맨 위부터 그리고, 첫 줄과 떠 있는 단추는 그 아래에서', async ({
		page,
	}) => {
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		const statusBar = page.locator('.mobile-statusbar');
		const bar = (await statusBar.boundingBox())!;
		expect(await statusBar.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
		// 앱 내용은 상태 표시줄 밑(화면 맨 위)부터
		expect((await memo.locator('.content').boundingBox())!.y).toBe(0);
		// 뒤로 가기, 오른쪽 위 단추, 큰 제목은 상태 표시줄 아래
		for (const element of [
			memo.locator('.mobile-navbar-home'),
			memo.locator('.memo-phone-list-top'),
			memo.getByRole('heading', { name: '모든 글' }),
		])
			expect((await element.boundingBox())!.y).toBeGreaterThanOrEqual(bar.y + bar.height);
	});

	test('웹 페이지 앱: 페이지는 상태 표시줄 아래에서, 상태 표시줄 뒤는 사이트 머리 막대 색으로 이어진다 (어두우면 흰 글자)', async ({
		page,
	}) => {
		await enterHome(page);
		const statusBar = page.locator('.mobile-statusbar');
		const look = () =>
			statusBar.evaluate((el) => {
				const style = getComputedStyle(el);
				return { color: style.color, background: style.backgroundColor, blur: style.backdropFilter };
			});

		// WTD: 파란 머리 막대 (profile.ts의 barColor)
		await (await homeApp(page, 'WTD')).tap();
		const webFrame = page.locator('.container.mobile .web-frame');
		const frame = webFrame.locator('iframe');
		await expect(frame).toBeVisible();
		const bar = (await statusBar.boundingBox())!;
		expect((await frame.boundingBox())!.y).toBe(bar.y + bar.height);
		expect(await webFrame.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(59, 130, 246)');
		expect(await look()).toMatchObject({ color: 'rgb(255, 255, 255)', background: 'rgba(0, 0, 0, 0)' });
		// 페이지를 가리는 홈 단추는 없다 (홈 바가 홈으로 간다)
		await expect(page.locator('.container.mobile .mobile-navbar-home')).toHaveCount(0);

		// 다른 앱에서는 투명한 바탕에 아주 약한 흐림, 앱 글자색
		await page.locator('.container.mobile .home-indicator').tap();
		await (await homeApp(page, '메모')).tap();
		await expect(appWindow(page, 'memo')).toBeVisible();
		const memo = await look();
		expect(memo).toMatchObject({ background: 'rgba(0, 0, 0, 0)', blur: 'blur(2px)' });
		expect(memo.color).not.toBe('rgb(255, 255, 255)');
	});

	test('Safari는 iOS Safari처럼: 페이지가 화면을 다 쓰고, 아래 막대(뒤로·주소·•••)로 다룬다. 주소를 밀면 옆 탭', async ({
		page,
	}) => {
		await enterHome(page);
		await (await homeApp(page, 'Safari')).tap();
		const safari = appWindow(page, 'safari');
		const pageBox = (await safari.locator('.safari-page').boundingBox())!;
		const { height } = page.viewportSize()!;
		// 위 도구 막대·탭 막대 없이 페이지가 화면 맨 위부터 끝까지, 상태 표시줄은 그 위에서 약하게 흐린다
		expect(pageBox.y).toBe(0);
		expect(pageBox.height).toBe(height);
		await expect(safari.locator('.safari-toolbar, .safari-tabs')).toHaveCount(0);
		expect(await page.locator('.mobile-statusbar').evaluate((el) => getComputedStyle(el).backdropFilter)).toContain(
			'blur'
		);

		// 아래 막대: 뒤로 가기, 주소 알약, ••• 가 한 줄
		const back = (await safari.locator('.mobile-navbar-home').boundingBox())!;
		const pill = (await safari.locator('.safari-phone-pill').boundingBox())!;
		const more = (await safari.getByRole('button', { name: 'Safari 동작' }).boundingBox())!;
		expect(back.y).toBe(pill.y);
		expect(more.y).toBe(pill.y);
		expect(back.x + back.width).toBeLessThan(pill.x);
		const address = safari.locator('.safari-phone-address');
		await expect(address).toHaveText('www.hyeoniverse.com');

		// 주소 알약을 왼쪽으로 밀면 다음 탭 (주소 링크는 열리지 않는다)
		await page.mouse.move(pill.x + pill.width - 20, pill.y + 22);
		await page.mouse.down();
		await page.mouse.move(pill.x + 20, pill.y + 22, { steps: 6 });
		await page.mouse.up();
		await expect(address).toHaveText('github.com/hyeoniverse/MacFolio');
		await expect(page.context().pages()).toHaveLength(1);

		// ••• > 새로운 탭: 시작 페이지
		await safari.getByRole('button', { name: 'Safari 동작' }).tap();
		await page.getByRole('menuitem', { name: '새로운 탭' }).tap();
		await expect(safari.getByRole('region', { name: '시작 페이지' })).toBeVisible();
		await expect(address).toHaveText('검색 또는 웹 사이트 이름 입력');
	});

	test('Safari 탭 모음: 탭마다 미리보기 카드, ×로 닫고, 카드를 누르면 그 탭으로 돌아온다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, 'Safari')).tap();
		const safari = appWindow(page, 'safari');
		await safari.getByRole('button', { name: /탭 모두 보기/ }).tap();
		const cards = safari.getByRole('list', { name: '열린 탭' }).getByRole('listitem');
		const count = await cards.count();
		expect(count).toBeGreaterThan(2);
		await expect(safari.locator('.safari-phone-count')).toHaveText(`${count}개의 탭`);
		// 미리보기는 실제 페이지를 줄인 것이고 눌리지 않는다
		await expect(cards.first().locator('.safari-phone-thumb-page > article.sp')).toHaveCount(1);
		expect(
			await cards
				.first()
				.locator('.safari-phone-thumb-page')
				.evaluate((el) => (el as HTMLElement).inert)
		).toBe(true);

		await safari.getByRole('button', { name: /^QRU.* 탭 닫기$/ }).tap();
		await expect(cards).toHaveCount(count - 1);
		await expect(safari.locator('.safari-phone-count')).toHaveText(`${count - 1}개의 탭`);

		await safari.getByRole('button', { name: /NewPick.* 탭 보기/ }).tap();
		await expect(safari.getByRole('list', { name: '열린 탭' })).toBeHidden();
		await expect(safari.locator('.safari-phone-address')).toContainText('newpick');

		// 뒤로 가기(완료)로도 닫힌다
		await safari.getByRole('button', { name: /탭 모두 보기/ }).tap();
		await safari.locator('.mobile-navbar-home').tap();
		await expect(safari.getByRole('list', { name: '열린 탭' })).toBeHidden();
	});

	test('파일은 iOS 파일 앱처럼: 최근 항목·둘러보기 탭, 폴더는 한 화면씩, ••• 로 목록 보기', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '파일')).tap();
		const files = appWindow(page, 'finder');
		const tabs = files.getByRole('navigation', { name: '파일 탭' });

		// 최근 항목: 뒤로 가기(홈)와 같은 줄의 큰 제목, 날짜가 있는 글이 최신 순 격자
		const heading = files.getByRole('heading', { name: '최근 항목' });
		await expect(heading).toBeVisible();
		await expect(tabs.getByRole('button', { name: '최근 항목' })).toHaveAttribute('aria-current', 'true');
		const back = files.locator('.mobile-navbar-home');
		await expect(back).toHaveText('홈');
		const backBox = (await back.boundingBox())!;
		const headingBox = (await heading.boundingBox())!;
		expect(headingBox.y + headingBox.height / 2).toBeCloseTo(backBox.y + backBox.height / 2, 0);
		// 제목 글자는 뒤로 가기 오른쪽에서 시작한다
		const textLeft = await heading.evaluate((el) => {
			const range = document.createRange();
			range.selectNodeContents(el);
			return range.getBoundingClientRect().left;
		});
		expect(textLeft).toBeGreaterThan(backBox.x + backBox.width);
		const recents = files.getByRole('list', { name: '최근 항목' });
		const dates = await recents.locator('.files-phone-summary').allTextContents();
		expect(dates.length).toBeGreaterThan(3);
		const asKey = (date: string) =>
			date
				.split('.')
				.map((part) => part.trim().padStart(2, '0'))
				.join('');
		expect(dates.map(asKey)).toEqual([...dates.map(asKey)].sort().reverse());

		// 둘러보기 > 문서: 가운데 작은 제목, 뒤로 가기는 '둘러보기'
		await tabs.getByRole('button', { name: '둘러보기' }).tap();
		await expect(files.getByRole('heading', { name: '둘러보기' })).toBeVisible();
		await files.locator('.files-phone-places').getByRole('button', { name: '문서' }).tap();
		await expect(files.locator('.files-phone-bar-title')).toHaveText('문서');
		await expect(files.locator('.mobile-navbar-home')).toHaveText('둘러보기');

		// ••• > 목록
		await files.getByRole('button', { name: '보기 옵션' }).tap();
		await page.getByRole('menuitemcheckbox', { name: '목록' }).tap();
		await expect(files.locator('.files-phone-items.list')).toBeVisible();

		// 문서를 열면 앱 안에서 읽고, 뒤로 가기로 폴더에 돌아온다
		await files.getByRole('button', { name: /README\.md/ }).tap();
		await expect(files.locator('.files-phone-bar-title')).toHaveText('README.md');
		await expect(files.locator('.mobile-navbar-home')).toHaveText('문서');
		await files.locator('.mobile-navbar-home').tap();
		await files.locator('.mobile-navbar-home').tap();
		await expect(files.getByRole('heading', { name: '둘러보기' })).toBeVisible();

		// 검색은 위치 전체에서
		await files.getByRole('searchbox', { name: '검색' }).fill('deploy');
		await expect(files.getByRole('button', { name: /deployment\.md/ })).toBeVisible();
	});

	test('설정의 계정은 다른 설정 화면처럼 폭을 꽉 채운 카드다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '시스템 설정')).tap();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '계정' }).tap();
		const account = settings.getByRole('region', { name: '관리자 계정' });
		const width = (await account.boundingBox())!.width;
		for (const part of ['.admin-account-head', '.admin-account-details', '.admin-account-actions .ui-button']) {
			const box = (await account.locator(part).first().boundingBox())!;
			expect(box.width, part).toBeCloseTo(width, 0);
		}
		const cardColor = await account
			.locator('.admin-account-details')
			.evaluate((el) => getComputedStyle(el).backgroundColor);
		expect(await account.locator('.admin-account-head').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
			cardColor
		);
		expect(cardColor).not.toBe('rgba(0, 0, 0, 0)');
	});

	test('Esc는 떠 있는 뒤로 가기와 같다: 한 화면씩 뒤로, 첫 화면에서는 홈. 입력 칸과 제어 센터의 Esc는 그것만 닫는다', async ({
		page,
	}) => {
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).tap();
		await expect(memo.getByRole('article', { name: 'CRA에서 Vite로 옮기기' })).toBeVisible();

		// 본문 → 목록 (한 번에 한 화면만)
		await page.keyboard.press('Escape');
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();
		await expect(memo.locator('.mobile-navbar-home')).toHaveText('폴더');

		// 검색 칸 안의 Esc는 쓰기를 위한 것: 목록에 그대로 있다
		const search = memo.getByRole('searchbox').first();
		await search.focus();
		await page.keyboard.press('Escape');
		await page.waitForTimeout(100);
		await expect(memo.getByRole('region', { name: '글 목록' })).toBeVisible();

		// 목록 → 폴더 → 홈
		await search.blur();
		await page.keyboard.press('Escape');
		await expect(memo.getByRole('navigation', { name: '카테고리' })).toBeVisible();

		// 제어 센터가 열려 있으면 Esc는 제어 센터만 닫는다
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		await page.getByRole('button', { name: '제어 센터 열기' }).click();
		await expect(controlCenter).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(controlCenter).toBeHidden();
		await expect(memo.getByRole('navigation', { name: '카테고리' })).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.locator('.container.mobile')).toBeHidden();
		await expect(page.locator('.mobile-home')).toBeVisible();
	});

	test('관리자 본문은 iOS 메모처럼 떠 있는 단추를 쓰고, 목록 위에서 새 메모·폴더 화면에서 새로운 폴더를 만든다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');

		// 본문: 제목 막대 대신 왼쪽 위 동그란 뒤로 가기, 오른쪽 위 공유·••• 알약, 아래 서식 알약과 새 메모
		await memo.locator('.memo-item', { hasText: 'CRA에서 Vite로 옮기기' }).tap();
		await expect(memo.locator('.mobile-navbar .mobile-navbar-home')).toBeVisible();
		const top = memo.locator('.memo-phone-top');
		await expect(top.getByRole('button', { name: '링크 공유' })).toBeVisible();
		const bottom = memo.locator('.memo-phone-bottom');
		// 서식 단추는 편집기를 불러온 뒤에 생긴다
		await expect(bottom.getByRole('button', { name: '서식' })).toBeVisible();
		await expect(bottom.getByRole('button', { name: '체크리스트' })).toBeVisible();
		await expect(bottom.getByRole('button', { name: '새 메모' })).toBeVisible();

		// ••• 메뉴: 맨 위에 고정·잠그기, 그 아래 찾기·삭제
		await top.getByRole('button', { name: '메모 동작' }).tap();
		const menu = page.getByRole('menu', { name: '메모 동작' });
		await expect(menu.getByRole('menuitem')).toHaveText(['메모 고정', '잠그기', '메모에서 찾기', '삭제']);
		await menu.getByRole('menuitem', { name: '메모에서 찾기' }).tap();
		await expect(memo.getByRole('search', { name: '메모에서 찾기' })).toBeVisible();

		// 목록 위 검색 칸 옆의 새 메모 → 빈 편집기
		await memo.locator('.mobile-navbar-home').tap();
		await memo.getByRole('region', { name: '글 목록' }).getByRole('button', { name: '새 메모' }).tap();
		await expect(memo.getByRole('textbox', { name: '제목' })).toBeVisible();

		// 폴더 화면의 새로운 폴더
		await memo.locator('.mobile-navbar-home').tap();
		await memo.locator('.mobile-navbar-home').tap();
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.getByRole('button', { name: '새로운 폴더' }).tap();
		await expect(folders.getByRole('textbox', { name: '새로운 폴더 이름' })).toBeVisible();
	});

	test('목록·폴더 화면은 iOS 메모처럼 큰 제목과 카드 묶음, 떠 있는 단추, 아래 검색 알약을 쓴다', async ({ page }) => {
		await fakeApi(page, { signedIn: false });
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		const list = memo.getByRole('region', { name: '글 목록' });

		// 목록: 제목 막대 대신 떠 있는 뒤로 가기, 큰 제목과 메모 수, 아래에 검색 알약
		await expect(memo.locator('.mobile-navbar .mobile-navbar-home')).toBeVisible();
		await expect(list.getByRole('heading', { name: '모든 글' })).toBeVisible();
		await expect(list.locator('.memo-phone-title p')).toHaveText(/\d+개의 메모/);
		const search = list.getByRole('searchbox', { name: '글 검색' });
		const searchBox = await search.boundingBox();
		const listBox = await list.boundingBox();
		expect(searchBox!.y + searchBox!.height).toBeGreaterThan(listBox!.y + listBox!.height - 80);

		// 폴더: 큰 제목, '블로그' 묶음을 접고 펼친다
		await memo.locator('.mobile-navbar-home').tap();
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await expect(folders.locator('.memo-phone-title')).toHaveText('폴더');
		const allPosts = folders.getByRole('button', { name: /^모든 글/ });
		await expect(allPosts).toBeVisible();
		await folders.getByRole('button', { name: '블로그 접기' }).tap();
		await expect(allPosts).toBeHidden();
		await folders.getByRole('button', { name: '블로그 펼치기' }).tap();
		await expect(allPosts).toBeVisible();

		// 방문자에게는 편집이 없다
		await expect(folders.getByRole('button', { name: '폴더 편집' })).toHaveCount(0);

		// 폴더 화면 아래의 검색 알약: 모든 글로 가서 검색 칸에 커서
		await memo.locator('.memo-folders-bottom').getByRole('button', { name: '검색' }).tap();
		await expect(search).toBeFocused();
		await expect(list.getByRole('heading', { name: '모든 글' })).toBeVisible();
	});

	test('관리자는 목록 •••에서 갤러리·메모 선택·첨부 파일을, 폴더 화면의 편집에서 폴더 메뉴를 쓴다', async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		const list = memo.getByRole('region', { name: '글 목록' });
		await expect(list.locator('.memo-item').first()).toBeVisible();

		// ••• 메뉴: 갤러리로 보기 ↔ 목록으로 보기
		await list.getByRole('button', { name: '목록 동작' }).tap();
		const listMenu = page.getByRole('menu', { name: '목록 동작' });
		await expect(listMenu.getByRole('menuitem')).toHaveText(['갤러리로 보기', '메모 선택', '첨부 파일 보기']);
		await listMenu.getByRole('menuitem', { name: '갤러리로 보기' }).tap();
		await expect(list.locator('.memo-card').first()).toBeVisible();
		await list.getByRole('button', { name: '목록 동작' }).tap();
		await page.getByRole('menuitem', { name: '목록으로 보기' }).tap();
		await expect(list.locator('.memo-item').first()).toBeVisible();

		// 메모 선택: 누르면 고르고, 완료로 끝낸다 (고르는 동안은 본문으로 넘어가지 않는다)
		await list.getByRole('button', { name: '목록 동작' }).tap();
		await page.getByRole('menuitem', { name: '메모 선택' }).tap();
		const first = list.locator('.memo-item').first();
		await first.tap();
		await expect(first).toHaveAttribute('aria-pressed', 'true');
		await expect(list.getByRole('status').filter({ hasText: '1개 선택됨' })).toBeVisible();
		await expect(list.getByRole('button', { name: '이동' })).toBeEnabled();
		await list.getByRole('button', { name: '완료' }).tap();
		await expect(first).not.toHaveAttribute('aria-pressed');

		// 첨부 파일 보기: 검색 칸에 '첨부 파일' 조건이 붙는다
		await list.getByRole('button', { name: '목록 동작' }).tap();
		await page.getByRole('menuitem', { name: '첨부 파일 보기' }).tap();
		await expect(list.locator('.memo-list-bottom .memo-search-chip')).toContainText('첨부 파일');

		// 폴더 화면의 편집: 폴더마다 ••• (폴더 추가·이 폴더 이동·이름 변경·삭제), ✓로 끝낸다
		await memo.locator('.mobile-navbar-home').tap();
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		await folders.getByRole('button', { name: '폴더 편집' }).tap();
		await expect(folders.getByRole('button', { name: /^모든 글/ })).toBeDisabled();
		await folders.getByRole('button', { name: '폴더 동작 (MacFolio)' }).tap();
		const folderMenu = page.getByRole('menu', { name: 'MacFolio 폴더 메뉴' });
		await expect(folderMenu.getByRole('menuitem')).toHaveText(['폴더 추가', '이 폴더 이동', '이름 변경', '삭제']);
		await folderMenu.getByRole('menuitem', { name: '이 폴더 이동' }).tap();
		await expect(page.getByRole('menu', { name: 'MacFolio 폴더를 옮길 곳' })).toBeVisible();
		await page.keyboard.press('Escape');
		await folders.getByRole('button', { name: '편집 완료' }).tap();
		await expect(folders.getByRole('button', { name: /^모든 글/ })).toBeEnabled();
	});

	test('목록형 앱은 메모처럼 떠 있는 뒤로 가기와 큰 제목을 쓴다', async ({ page }) => {
		await enterHome(page);
		for (const [label, appName, title] of [
			['메일', 'mail', '받은 편지함'],
			['메시지', 'messages', '메시지'],
			['음악', 'music', '보관함'],
			['시스템 설정', 'settings', '설정'],
			['암호', 'passwords', '암호'],
			['단축어', 'terminal', '단축어'],
		] as const) {
			await (await homeApp(page, label)).tap();
			const app = appWindow(page, appName);
			const back = app.locator('.mobile-navbar .mobile-navbar-home');
			const heading = app.getByRole('heading', { name: title, exact: true });
			await expect(back).toBeVisible();
			await expect(heading).toBeVisible();
			// 큰 제목은 뒤로 가기와 같은 줄, 그 오른쪽
			const [backBox, titleBox] = [await back.boundingBox(), await heading.boundingBox()];
			const middle = (box: typeof backBox) => box!.y + box!.height / 2;
			expect(Math.abs(middle(titleBox) - middle(backBox))).toBeLessThan(4);
			const textLeft = await heading.evaluate((element) => {
				const range = document.createRange();
				range.selectNodeContents(element);
				return range.getBoundingClientRect().left;
			});
			expect(textLeft).toBeGreaterThan(backBox!.x + backBox!.width);
			await app.getByRole('button', { name: '홈 화면으로' }).tap();
			await expect(app).toBeHidden();
		}
	});

	test('시스템 설정: 항목 목록에서 누르면 그 화면으로, 떠 있는 뒤로 가기로 목록에 돌아온다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '시스템 설정')).tap();
		const settings = appWindow(page, 'settings');
		// 줄 끝의 ›는 카드 오른쪽 안쪽 여백(16px)에 붙는다
		const row = settings.getByRole('button', { name: '화면 모드' });
		const rowBox = (await row.boundingBox())!;
		const chevronBox = (await row.locator('.settings-nav-chevron').boundingBox())!;
		expect(rowBox.x + rowBox.width - (chevronBox.x + chevronBox.width)).toBeCloseTo(16, 0);
		await settings.getByRole('button', { name: '화면 모드' }).tap();
		await expect(settings.getByRole('radiogroup', { name: '화면 모드' })).toBeVisible();
		await expect(settings.getByRole('navigation', { name: '설정 항목' })).toBeHidden();
		await settings.locator('.mobile-navbar-home').tap();
		await expect(settings.getByRole('navigation', { name: '설정 항목' })).toBeVisible();
	});

	test('폴더 편집의 ≡ 손잡이로 같은 층 폴더 순서를 바꾸고, 정리 내용에 저장한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true, organization: { folders: ['디자인', '읽을거리'] } });
		await enterHome(page);
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		await memo.locator('.mobile-navbar-home').tap();
		const folders = memo.getByRole('navigation', { name: '카테고리' });
		const topNames = () =>
			folders.locator('.memo-folder-scroll > ul > li[data-folder-path] > .memo-folder-row .memo-folder-name');
		await expect(topNames()).toHaveText(['개발기', '디자인', '읽을거리']);

		await folders.getByRole('button', { name: '폴더 편집' }).tap();
		// 끌기: '읽을거리'를 맨 위로
		const handle = folders.getByRole('button', { name: '순서 바꾸기 (읽을거리)' });
		const target = folders.getByRole('button', { name: '순서 바꾸기 (개발기)' });
		const from = (await handle.boundingBox())!;
		const to = (await target.boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 8 });
		await page.mouse.up();
		await expect(topNames()).toHaveText(['읽을거리', '개발기', '디자인']);
		await expect.poll(() => api.organization.order).toEqual(['읽을거리', '개발기', '디자인']);

		// 키보드: ↓로 한 칸 내린다
		await folders.getByRole('button', { name: '순서 바꾸기 (읽을거리)' }).press('ArrowDown');
		await expect(topNames()).toHaveText(['개발기', '읽을거리', '디자인']);
	});

	test('메일은 목록과 읽기·쓰기를 한 화면씩 보여준다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '메일')).tap();
		const mail = appWindow(page, 'mail');
		const list = mail.getByRole('region', { name: '받은 편지함' });

		await expect(list).toBeVisible();
		await mail.getByRole('button', { name: '새로운 메시지' }).tap();
		await expect(list).toBeHidden();
		await expect(mail.getByRole('textbox', { name: '제목' })).toBeVisible();

		await mail.getByRole('button', { name: '받은 편지함' }).tap();
		await expect(list).toBeVisible();
	});

	test('음악: 보관함 → 플레이리스트 → 곡을 누르면 재생되고, 미니 플레이어로 지금 재생 중을 연다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '음악')).tap();
		const music = appWindow(page, 'music');
		await expect(music.getByRole('heading', { name: '보관함' })).toBeVisible();

		await music.getByRole('button', { name: '플레이리스트', exact: true }).tap();
		await expect(music.getByRole('heading', { name: '플레이리스트' })).toBeVisible();
		await music.getByRole('button', { name: /잔잔한 피아노/ }).tap();
		await expect(music.getByRole('heading', { name: '잔잔한 피아노' })).toBeVisible();
		await expect(music.locator('.mobile-navbar-home')).toHaveText('플레이리스트');

		await music.locator('.music-track', { hasText: 'River Flows in You' }).tap();
		await expect(music.locator('.music-track[aria-current]')).toContainText('River Flows in You');
		await expect(music.getByRole('contentinfo', { name: '재생 막대' })).toContainText('River Flows in You');

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		const sheet = music.getByRole('dialog', { name: '지금 재생 중' });
		await expect(sheet).toBeVisible();
		await expect(sheet.getByRole('slider', { name: '재생 위치' })).toBeVisible();
		await expect(sheet.getByRole('region', { name: '다음 재생' })).toBeVisible();

		// 닫기는 시트 위에 떠 있는 뒤로 가기 하나
		await music.locator('.mobile-navbar-home').tap();
		await expect(sheet).toBeHidden();

		// 플레이리스트로 돌아오고, 보관함 맨 위에는 지금 재생 중인 목록의 표지
		await music.locator('.mobile-navbar-home').tap();
		await expect(music.getByRole('heading', { name: '플레이리스트' })).toBeVisible();
		await music.locator('.mobile-navbar-home').tap();
		await expect(music.locator('.music-featured')).toHaveText('잔잔한 피아노');
	});

	test('음악: 플레이리스트는 격자·목록과 제목순으로 보고, 앨범·아티스트는 곡을 묶어 보여 준다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '음악')).tap();
		const music = appWindow(page, 'music');
		const names = music.locator('.music-collection strong');

		await music.getByRole('button', { name: '플레이리스트', exact: true }).tap();
		await expect(names).toHaveText(['지브리', '잔잔한 피아노', '애니메이션 OST']);
		await music.getByRole('button', { name: '정렬' }).tap();
		await page.getByRole('menuitemcheckbox', { name: '제목' }).tap();
		await expect(names).toHaveText(['애니메이션 OST', '잔잔한 피아노', '지브리']);
		await music.getByRole('button', { name: '정렬' }).tap();
		await page.getByRole('menuitemcheckbox', { name: '격자' }).tap();
		await expect(music.locator('.music-collections.grid .music-collection')).toHaveCount(3);

		await music.locator('.mobile-navbar-home').tap();
		await music.getByRole('button', { name: '앨범', exact: true }).tap();
		await music.getByRole('button', { name: /^Spirited Away/ }).tap();
		await expect(music.getByRole('heading', { name: 'Spirited Away' })).toBeVisible();
		await expect(music.locator('.music-track')).toHaveCount(2);
		await expect(music.locator('.mobile-navbar-home')).toHaveText('앨범');

		await music.locator('.mobile-navbar-home').tap();
		await music.locator('.mobile-navbar-home').tap();
		await music.getByRole('button', { name: '아티스트', exact: true }).tap();
		await music.getByRole('button', { name: /^Yiruma/ }).tap();
		await expect(music.locator('.music-track')).toHaveText([/Kiss the Rain/, /River Flows in You/]);
	});

	test('홈 화면의 음악 위젯: 빈 곳을 누르면 음악 앱이 열리고, 재생 위치 막대는 앱을 열지 않는다', async ({ page }) => {
		await enterHome(page);
		const widget = page.locator('.mobile-home').getByRole('region', { name: '음악' });
		await expect(widget).toBeVisible();
		await expect(widget.getByRole('button', { name: '재생' })).toBeVisible();

		await widget.getByRole('slider', { name: '재생 위치' }).tap();
		await expect(appWindow(page, 'music')).toBeHidden();

		await widget.locator('.music-widget-title').tap();
		await expect(appWindow(page, 'music')).toBeVisible();
	});

	test('상태 표시줄에 시간이 보이고, 앱 위에서도 남아 있다', async ({ page }) => {
		await enterHome(page);
		const statusBar = page.getByRole('button', { name: '제어 센터 열기' });
		await expect(statusBar.locator('time')).toHaveText(/^\d{1,2}:\d{2}$/);

		await (await homeApp(page, '시스템 설정')).tap();
		await expect(appWindow(page, 'settings')).toBeVisible();
		await expect(statusBar).toBeVisible();
		// 상태 표시줄은 앱 위에 겹치고, 뒤로 가기는 그 아래에 떠 있다
		const barBox = (await statusBar.boundingBox())!;
		const navBox = (await appWindow(page, 'settings').locator('.mobile-navbar-home').boundingBox())!;
		expect(navBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
	});

	test('상태 표시줄을 누르면 제어 센터가 열리고, 빈 곳을 누르면 닫힌다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		await expect(controlCenter).toBeVisible();

		const { height } = page.viewportSize()!;
		await page.touchscreen.tap(20, height - 20);
		await expect(controlCenter).toBeHidden();
	});

	test('상태 표시줄을 끌어내리면 제어 센터가 열린다', async ({ page }) => {
		await enterHome(page);
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });

		// 조금만 끌면 열리지 않는다
		await page.mouse.move(200, 20);
		await page.mouse.down();
		await page.mouse.move(200, 40, { steps: 3 });
		await page.mouse.up();
		await expect(controlCenter).toBeHidden();

		await page.mouse.move(200, 20);
		await page.mouse.down();
		await page.mouse.move(200, 250, { steps: 6 });
		await page.mouse.up();
		await expect(controlCenter).toBeVisible();
	});

	test('화면 어디서든 아래로 쓸면 제어 센터가 열리고, 타일 위에서 위로 쓸어도 닫힌다', async ({ page }) => {
		await enterHome(page);
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		const { height } = page.viewportSize()!;

		// 홈 화면 가운데(앱 아이콘 위)에서 아래로
		await swipe(page, 200, height / 2, height / 2 + 250);
		await expect(controlCenter).toBeVisible();

		// 연락하기 타일 위에서 위로 쓸면 닫히고, 타일은 눌리지 않는다
		const tile = (await controlCenter.getByRole('button', { name: /연락하기/ }).boundingBox())!;
		await swipe(page, tile.x + tile.width / 2, tile.y + tile.height / 2, tile.y - 200);
		await expect(controlCenter).toBeHidden();
		await expect(appWindow(page, 'mail')).toBeHidden();
	});

	test('앱 안에서도 아래로 쓸면 열리고, 내용을 내려 둔 곳에서는 스크롤이 먼저다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, 'Safari')).tap();
		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		const { height } = page.viewportSize()!;

		// 페이지 맨 위: 아래로 쓸면 제어 센터
		await swipe(page, 200, height / 2, height / 2 + 250);
		await expect(controlCenter).toBeVisible();
		await swipe(page, 200, height - 150, 150);
		await expect(controlCenter).toBeHidden();

		// 내용을 내려 둔 상태: 아래로 쓸어도 제어 센터가 열리지 않는다 (위로 스크롤할 차례)
		await safari.locator('.safari-page').evaluate((element) => (element.scrollTop = 600));
		await swipe(page, 200, height / 2, height / 2 + 250);
		await expect(controlCenter).toBeHidden();
	});

	test('음량 막대를 위로 끌면 음량만 바뀌고 제어 센터는 닫히지 않는다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		const slider = controlCenter.getByRole('slider', { name: '음량' });
		const box = (await slider.boundingBox())!;

		await swipe(page, box.x + box.width / 2, box.y + box.height - 5, box.y + 5);
		await expect(controlCenter).toBeVisible();
		await expect(slider).toHaveAttribute('aria-valuenow', /^(9\d|100)$/);
	});

	test('손가락으로 쓸어도 열고 닫힌다 (터치 이벤트)', async ({ page }) => {
		await enterHome(page);
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		const { height } = page.viewportSize()!;

		await fingerSwipe(page, 200, height / 2, height / 2 + 250);
		await expect(controlCenter).toBeVisible();
		await fingerSwipe(page, 200, height - 150, 150);
		await expect(controlCenter).toBeHidden();
	});

	test('제어 센터의 관리자 단추와 홈 화면의 암호 앱에서 관리자 계정을 본다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });
		// 관리자 서버가 없으면 암호 앱을 연다 (로그인 단추는 꺼져 있다)
		await controlCenter.getByRole('button', { name: '관리자 로그인' }).tap();
		const passwords = appWindow(page, 'passwords');
		await expect(passwords).toBeVisible();
		const account = passwords.getByRole('region', { name: '관리자 계정' });
		await expect(account).toContainText('관리자 서버가 아직 연결되지 않았습니다');
		await expect(account.getByRole('button', { name: /GitHub로 로그인/ })).toBeDisabled();

		await passwords.getByRole('button', { name: '홈 화면으로' }).tap();
		await expect(passwords).toBeHidden();
		await expect(await homeApp(page, '암호')).toBeVisible();
	});

	test('제어 센터에서 다크 모드를 바꾸고 앱을 연다', async ({ page }) => {
		await enterHome(page);
		await page.getByRole('button', { name: '제어 센터 열기' }).tap();
		const controlCenter = page.getByRole('dialog', { name: '제어 센터' });

		const darkMode = controlCenter.getByRole('button', { name: '다크 모드' });
		const before = await page.evaluate(() => document.documentElement.dataset.theme);
		await darkMode.tap();
		await expect
			.poll(() => page.evaluate(() => document.documentElement.dataset.theme))
			.toBe(before === 'dark' ? 'light' : 'dark');

		await controlCenter.getByRole('button', { name: /연락하기/ }).tap();
		await expect(controlCenter).toBeHidden();
		await expect(appWindow(page, 'mail')).toBeVisible();
	});

	test('단축어는 터미널 명령을 눌러서 실행한다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '단축어')).tap();
		const shortcuts = appWindow(page, 'terminal');
		await expect(shortcuts.getByRole('heading', { name: '단축어' })).toBeVisible();
		// 명령어 입력 칸은 없다
		await expect(shortcuts.getByRole('textbox')).toHaveCount(0);

		// 프로젝트 → 프로젝트 자세히 → 뒤로
		await shortcuts.getByRole('button', { name: /프로젝트/ }).tap();
		const list = shortcuts.getByRole('region', { name: '프로젝트' });
		await expect(list.getByText('$ projects')).toBeVisible();
		const first = list.locator('.shortcut-item').first();
		const name = (await first.locator('strong').textContent())!;
		await first.tap();
		await expect(shortcuts.getByRole('region', { name })).toContainText('저장소');
		await shortcuts.getByRole('button', { name: '프로젝트' }).tap();
		await shortcuts.getByRole('button', { name: '단축어' }).tap();

		// 연락처의 "메시지 열기"는 메시지 앱을 연다
		await shortcuts.getByRole('button', { name: /연락처/ }).tap();
		await shortcuts.getByRole('button', { name: '메시지 열기' }).tap();
		await expect(appWindow(page, 'messages')).toBeVisible();
	});

	test('앱 전환기: 길게 쓸어 올리면 실행 중인 앱이 카드로 보이고, 골라서 돌아가거나 밀어 올려 닫는다', async ({
		page,
	}) => {
		await enterHome(page);
		await (await homeApp(page, 'Safari')).tap();
		await appWindow(page, 'safari').getByRole('button', { name: '홈 화면으로' }).tap();
		await (await homeApp(page, '메모')).tap();
		const memo = appWindow(page, 'memo');
		await expect(memo).toBeVisible();

		/** 요소를 잡고 위로 끈다 */
		const swipeUp = async (target: ReturnType<Page['locator']>, distance: number) => {
			const box = (await target.boundingBox())!;
			const x = box.x + box.width / 2;
			const y = box.y + box.height / 2;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x, y - distance, { steps: 8 });
			await page.mouse.up();
		};

		// 짧게 쓸어 올리면 홈, 길게 쓸어 올리면 전환기
		await swipeUp(memo.locator('.home-indicator'), 220);
		const switcher = page.getByRole('dialog', { name: '앱 전환기' });
		await expect(switcher).toBeVisible();
		const cards = page.locator('.mobile-app-frame.in-switcher');
		await expect(cards).toHaveCount(2);
		// 가장 최근에 쓴 앱이 첫 카드 (가운데)
		const firstCard = await cards.evaluateAll((elements) =>
			elements
				.find((el) => (el as HTMLElement).style.getPropertyValue('--card-index') === '0')
				?.getAttribute('aria-label')
		);
		expect(firstCard).toBe('메모 열기');

		// 카드를 누르면 그 앱으로
		await page.getByRole('button', { name: 'Safari 열기' }).tap();
		await expect(switcher).toBeHidden();
		await expect(appWindow(page, 'safari')).toBeVisible();

		// 카드를 위로 밀면 앱이 닫힌다
		await swipeUp(appWindow(page, 'safari').locator('.home-indicator'), 220);
		await expect(cards).toHaveCount(2);
		// 가운데 카드(방금 쓴 Safari)를 밀어 올린다
		await swipeUp(page.getByRole('button', { name: 'Safari 열기' }), 200);
		await expect(cards).toHaveCount(1);
		await expect(cards).toHaveAttribute('aria-label', '메모 열기');

		// 빈 곳을 누르면 홈으로
		const { width, height } = page.viewportSize()!;
		await page.mouse.click(width / 2, height - 10);
		await expect(switcher).toBeHidden();
		await expect(page.locator('.container.mobile')).toHaveCount(0);
	});

	test('홈 화면에서도 아래에서 길게 쓸어 올리면 앱 전환기가 열린다', async ({ page }) => {
		await enterHome(page);
		const gesture = page.locator('.mobile-home .home-gesture');
		const box = (await gesture.boundingBox())!;
		await page.mouse.move(box.x + box.width / 2, box.y + 5);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2, box.y - 220, { steps: 8 });
		await page.mouse.up();
		const switcher = page.getByRole('dialog', { name: '앱 전환기' });
		await expect(switcher).toContainText('실행 중인 앱이 없습니다');
	});

	test('앱 전환기에서 음악을 밀어 올려 끄면 재생도 멈춘다', async ({ page }) => {
		await enterHome(page);
		await (await homeApp(page, '음악')).tap();
		const music = appWindow(page, 'music');
		await music.getByRole('button', { name: '플레이리스트', exact: true }).tap();
		await music.getByRole('button', { name: /지브리/ }).tap();
		await music.locator('.music-track').first().tap();
		const widgetPlay = () =>
			page
				.locator('.mobile-home')
				.getByRole('region', { name: '음악' })
				.locator('.music-widget-controls button')
				.nth(1);
		await expect(widgetPlay()).toHaveAttribute('aria-label', '일시 정지');

		const indicator = (await music.locator('.home-indicator').boundingBox())!;
		const swipe = async (x: number, y: number, distance: number) => {
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x, y - distance, { steps: 8 });
			await page.mouse.up();
		};
		await swipe(indicator.x + indicator.width / 2, indicator.y + 5, 220);
		const card = page.getByRole('button', { name: '음악 열기' });
		const box = (await card.boundingBox())!;
		await swipe(box.x + box.width / 2, box.y + box.height / 2, 200);

		await expect(page.locator('.mobile-app-frame.in-switcher')).toHaveCount(0);
		await expect(widgetPlay()).toHaveAttribute('aria-label', '재생');
	});
});

test.describe('휴대폰 홈 화면 페이지', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test('앱이 다 들어가지 않으면 스크롤하지 않고 다음 페이지로, 점으로 넘긴다', async ({ page }) => {
		await enterHome(page);
		const pages = page.locator('.mobile-page');
		expect(await pages.count()).toBeGreaterThan(1);
		// 격자는 스크롤하지 않는다: 놓인 아이콘이 모두 그 페이지 안에 보인다
		const first = page.getByRole('navigation', { name: '앱', exact: true });
		expect(await first.evaluate((grid) => grid.scrollHeight <= grid.clientHeight)).toBe(true);

		const dots = page.getByRole('tablist', { name: '홈 화면 페이지' });
		await expect(dots.getByRole('tab', { name: '1쪽' })).toHaveAttribute('aria-selected', 'true');
		await dots.getByRole('tab', { name: '2쪽' }).click();
		await expect(dots.getByRole('tab', { name: '2쪽' })).toHaveAttribute('aria-selected', 'true');

		// 2쪽의 앱도 연다
		const second = page.getByRole('navigation', { name: '앱 2쪽' });
		await second.locator('.mobile-app').first().click();
		await expect(page.locator('.container.mobile')).toBeVisible();
	});

	test('손가락으로 옆으로 쓸면 페이지가 넘어가고, 조금 끌다 놓으면 제자리, 아이콘에서 시작한 쓸기는 앱을 열지 않는다', async ({
		page,
	}) => {
		await enterHome(page);
		const cdp = await page.context().newCDPSession(page);
		// 손가락 하나로 (x0 → x1) 가로로 쓴다. 한 걸음씩 움직여 실제 손가락처럼
		const swipe = async (x0: number, x1: number, y: number, steps = 8) => {
			const point = (x: number) => [{ x, y }];
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x0) });
			for (let step = 1; step <= steps; step++)
				await cdp.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: point(x0 + ((x1 - x0) * step) / steps),
				});
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		};
		const dots = page.getByRole('tablist', { name: '홈 화면 페이지' });
		// 그 페이지가 화면 왼쪽 끝에 멈췄고, 점도 그 페이지다 (넘어가는 중간이 아니라 멈춘 뒤를 본다)
		const selected = async (name: string) => {
			const index = Number.parseInt(name, 10) - 1;
			await expect
				.poll(async () => Math.round((await page.locator('.mobile-page').nth(index).boundingBox())!.x))
				.toBe(0);
			await page.waitForTimeout(500);
			expect(Math.round((await page.locator('.mobile-page').nth(index).boundingBox())!.x)).toBe(0);
			await expect(dots.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
		};
		const icon = (await page
			.getByRole('navigation', { name: '앱', exact: true })
			.locator('.mobile-app')
			.first()
			.boundingBox())!;
		const y = icon.y + icon.height / 2;

		// 첫 아이콘 위에서 왼쪽으로 쓸면 2쪽. 앱은 열리지 않는다
		await swipe(300, 60, y);
		await selected('2쪽');
		await expect(page.locator('.container.mobile')).toHaveCount(0);
		await expect(page.getByRole('navigation', { name: '앱 2쪽' }).locator('.mobile-app').first()).toBeInViewport();

		// 오른쪽으로 쓸면 1쪽
		await swipe(60, 300, y);
		await selected('1쪽');

		// 조금만 천천히 끌다 놓으면 제자리
		await swipe(220, 190, y, 20);
		await selected('1쪽');

		// 마우스로 끌어도 넘어간다
		await page.mouse.move(300, y);
		await page.mouse.down();
		await page.mouse.move(60, y, { steps: 8 });
		await page.mouse.up();
		await selected('2쪽');
	});
});
