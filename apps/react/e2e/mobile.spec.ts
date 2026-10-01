import { test, expect, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

/** 로딩 화면을 탭해 넘기고 홈 화면에 들어간다. */
async function enterHome(page: Page, path = '/') {
	await page.goto(path);
	const loading = page.locator('.loading-container');
	await expect(loading).toContainText('탭하여');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
}

const homeApp = (page: Page, label: string) =>
	page.locator('.mobile-home').getByRole('button', { name: label, exact: true });

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
		// 화면이 없는 앱(Finder, 사진, 휴지통)은 홈 화면에 두지 않는다
		await expect(homeApp(page, 'Finder')).toHaveCount(0);
		await expect(homeApp(page, '휴지통')).toHaveCount(0);
		// 새싹 농장은 모바일 모드가 있어 휴대폰에서도 연다
		await expect(homeApp(page, '새싹 농장')).toBeVisible();
		// 터미널은 모바일에서 '단축어'로 보인다
		await expect(homeApp(page, '터미널')).toHaveCount(0);
		await expect(homeApp(page, '단축어')).toBeVisible();
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
		await homeApp(page, '새싹 농장').tap();
		const game = appWindow(page, 'sproutfarm');
		await expect(game).toBeVisible();
		await expect(
			page.frameLocator('iframe[title="SproutFarm 새싹 농장"]').getByRole('button', { name: 'START' })
		).toBeVisible();
	});

	test('앱은 화면을 가득 채워 열리고, 홈 인디케이터로 돌아온다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, 'Safari').tap();

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
		await homeApp(page, '시스템 설정').tap();
		const settings = appWindow(page, 'settings');
		await expect(settings).toBeVisible();
		await settings.getByRole('button', { name: '홈', exact: true }).tap();
		await expect(settings).toBeHidden();
	});

	test('가로로 넘치는 화면이 없다', async ({ page }) => {
		await enterHome(page);
		for (const label of ['Safari', 'GitHub', '메모', '메일', '메시지', '시스템 설정', '단축어', '음악']) {
			await homeApp(page, label).tap();
			const content = page.locator('.container.mobile .content');
			await expect(content).toBeVisible();
			const overflow = await content.evaluate((el) => el.scrollWidth - el.clientWidth);
			expect(overflow, `${label}이(가) 가로로 넘친다`).toBeLessThanOrEqual(1);
			await page.locator('.container.mobile .home-indicator').tap();
		}
	});

	test('메모는 목록 → 본문 → 목록 → 폴더 순서로 한 화면씩 넘어간다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '메모').tap();
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

	test('메일은 목록과 읽기·쓰기를 한 화면씩 보여준다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '메일').tap();
		const mail = appWindow(page, 'mail');
		const list = mail.getByRole('region', { name: '받은 편지함' });

		await expect(list).toBeVisible();
		await mail.getByRole('button', { name: '새로운 메시지' }).tap();
		await expect(list).toBeHidden();
		await expect(mail.getByRole('textbox', { name: '제목' })).toBeVisible();

		await mail.getByRole('button', { name: '받은 편지함' }).tap();
		await expect(list).toBeVisible();
	});

	test('음악: 보관함 → 재생 목록 → 곡을 누르면 재생되고, 미니 플레이어로 지금 재생 중을 연다', async ({ page }) => {
		await enterHome(page);
		await homeApp(page, '음악').tap();
		const music = appWindow(page, 'music');
		await expect(music.getByRole('heading', { name: '보관함' })).toBeVisible();

		await music.getByRole('button', { name: /잔잔한 피아노/ }).tap();
		await expect(music.getByRole('heading', { name: '잔잔한 피아노' })).toBeVisible();
		await expect(music.locator('.mobile-navbar-home')).toHaveText('보관함');

		await music.locator('.music-track', { hasText: 'River Flows in You' }).tap();
		await expect(music.locator('.music-track[aria-current]')).toContainText('River Flows in You');
		await expect(music.getByRole('contentinfo', { name: '재생 막대' })).toContainText('River Flows in You');

		await music.getByRole('button', { name: '지금 재생 중 열기' }).tap();
		const sheet = music.getByRole('dialog', { name: '지금 재생 중' });
		await expect(sheet).toBeVisible();
		await expect(sheet.getByRole('slider', { name: '재생 위치' })).toBeVisible();
		await expect(sheet.getByRole('region', { name: '다음 재생' })).toBeVisible();

		// 닫기는 제목 막대의 버튼 하나
		await music.locator('.mobile-navbar-home').tap();
		await expect(sheet).toBeHidden();
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

		await homeApp(page, 'Safari').tap();
		await expect(appWindow(page, 'safari')).toBeVisible();
		await expect(statusBar).toBeVisible();
		// 앱 내용은 상태 표시줄 아래에서 시작한다
		const barBox = (await statusBar.boundingBox())!;
		const navBox = (await appWindow(page, 'safari').locator('.mobile-navbar').boundingBox())!;
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
		await homeApp(page, 'Safari').tap();
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
		await expect(homeApp(page, '암호')).toBeVisible();
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
		await homeApp(page, '단축어').tap();
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
		await homeApp(page, 'Safari').tap();
		await appWindow(page, 'safari').getByRole('button', { name: '홈 화면으로' }).tap();
		await homeApp(page, '메모').tap();
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
		await homeApp(page, '음악').tap();
		const music = appWindow(page, 'music');
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
