import { test, expect, enterDesktop, appWindow } from './fixtures';

test.describe('Safari', () => {
	test('프로젝트마다 탭이 있고, 탭을 고르면 그 프로젝트 소개와 주소가 바뀐다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await expect(safari).toBeVisible();

		const tabs = safari.getByRole('tab');
		await expect(tabs).toHaveCount(7);
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

	test('이 사이트(MacFolio)도 프로젝트 탭으로 있고, 데모 단추 없이 저장소 주소를 보여준다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /MacFolio/ }).click();
		const macfolio = safari.getByRole('tabpanel').getByRole('article', { name: 'MacFolio' });
		await expect(macfolio.getByRole('heading', { level: 1 })).toHaveText('포트폴리오를, 데스크톱으로.');
		await expect(macfolio.getByRole('region', { name: '기술 사양' })).toContainText('NestJS');
		await expect(safari.locator('.safari-address')).toHaveText('github.com/hyeoniverse/MacFolio');
		await expect(macfolio.getByRole('link', { name: '데모 보기' })).toHaveCount(0);

		// 같은 앱을 데스크톱과 휴대폰에서 나란히: 앱을 고르면 두 화면이 함께 바뀐다
		// 화면 크기 시뮬레이터: 시험은 움직임 줄이기라 화면에 고정되지 않고, 단계를 눌러 고른다
		const devices = macfolio.getByRole('region', { name: '어디서 열어도' });
		await expect(devices.getByRole('img', { name: '모니터에서 연 메모' })).toBeVisible();
		await devices.getByRole('button', { name: /메시지/ }).click();
		await expect(devices.getByRole('button', { name: /메시지/ })).toHaveAttribute('aria-pressed', 'true');
		await expect(devices.getByRole('img', { name: '모니터에서 연 메시지' })).toBeVisible();
		await devices.getByRole('button', { name: /휴대폰/ }).click();
		await expect(devices.getByRole('button', { name: /휴대폰/ })).toHaveAttribute('aria-current', 'step');
		await expect(devices.getByRole('img', { name: '휴대폰에서 연 메시지' })).toBeVisible();
		await expect(devices.getByRole('img', { name: '모니터에서 연 메시지' })).toHaveCount(0);
		await expect(devices).toContainText('767px 이하에서는 iOS 홈 화면');

		// 만든 방식에는 요청이 지나는 길을 그린 그림이 있다
		await expect(
			macfolio.getByRole('region', { name: '만든 방식' }).getByRole('img', { name: /Cloudflare Tunnel/ })
		).toBeVisible();
	});

	test('포트폴리오(HYEONIVERSE) 탭은 데모 주소를 보여준다', async ({ page }) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /HYEONIVERSE/ }).click();
		const portfolio = safari.getByRole('tabpanel').getByRole('article', { name: 'HYEONIVERSE' });
		await expect(portfolio.getByRole('heading', { level: 1 })).toHaveText('작업물과 글을, 움직이는 화면으로.');
		await expect(safari.locator('.safari-address')).toHaveText('www.hyeoniverse.com');
		await expect(portfolio.getByRole('link', { name: '데모 보기' }).first()).toHaveAttribute(
			'href',
			'https://www.hyeoniverse.com'
		);
	});

	test('프로젝트마다 페이지 짜임이 다르다: 신문 1면, 칸반 보드, 명함, 게임 화면, 차례와 장, 터미널', async ({
		page,
	}) => {
		await enterDesktop(page);
		const safari = appWindow(page, 'safari');
		const panel = safari.getByRole('tabpanel');
		const open = (name: RegExp) => safari.getByRole('tab', { name }).click();

		// 신문: 머리기사 옆 단에 숫자와 진행 과정
		await expect(panel.getByRole('region', { name: '머리기사' })).toBeVisible();
		const lead = await panel.getByRole('region', { name: '머리기사' }).boundingBox();
		const side = await panel.getByRole('region', { name: '진행 과정' }).boundingBox();
		expect(side!.x).toBeGreaterThan(lead!.x + lead!.width / 2);

		// 칸반: 기능·만든 방식·맡은 일이 한 줄에 나란한 세 열
		await open(/WTD/);
		const columns = await Promise.all(
			['주요 기능', '만든 방식', '맡은 일'].map((name) => panel.getByRole('region', { name }).boundingBox())
		);
		expect(new Set(columns.map((box) => Math.round(box!.y))).size).toBe(1);
		await expect(panel.getByRole('region', { name: '주요 기능' })).toContainText('할 일');

		// 명함: 순서와 묻고 답하기는 스크롤해서 칸의 머리가 화면 60% 선을 지나면 위 칸부터 차례로 펼쳐지고, 다시 올리면 접힌다. 누르면 그 칸만 접힌다
		await open(/QRU/);
		const answers = panel.getByRole('region', { name: '만든 방식' }).getByRole('button');
		const steps = panel.getByRole('region', { name: '주요 기능' }).locator('li');
		await expect(answers.first()).toHaveAttribute('aria-expanded', 'false');
		await expect(steps.last()).toHaveAttribute('data-open', 'false');
		await steps.last().scrollIntoViewIfNeeded();
		await expect(steps.first()).toHaveAttribute('data-open', 'true');
		await expect(steps.last()).toHaveAttribute('data-open', 'true');
		await answers.last().scrollIntoViewIfNeeded();
		await expect(answers.first()).toHaveAttribute('aria-expanded', 'true');
		await expect(answers.last()).toHaveAttribute('aria-expanded', 'true');
		await answers.last().click();
		await expect(answers.last()).toHaveAttribute('aria-expanded', 'false');
		await panel.evaluate((el) => (el.scrollTop = 0));
		await expect(answers.first()).toHaveAttribute('aria-expanded', 'false');
		await expect(steps.first()).toHaveAttribute('data-open', 'false');

		// 게임: PRESS START를 누르면 HUD와 퀘스트로 내려간다. 조작법과 크레딧
		await open(/SproutFarm/);
		await expect(panel.getByRole('region', { name: '주요 기능' })).not.toBeInViewport();
		await panel.getByRole('button', { name: /시작/ }).click();
		await expect(panel.getByRole('region', { name: '한눈에 보기' })).toBeInViewport();
		await expect(panel.getByRole('region', { name: '조작법' })).toContainText('Shift');
		await expect(panel.getByRole('region', { name: '맡은 일' })).toContainText('CREDITS');
		// 크레딧에 에셋 출처와 링크
		await expect(
			panel.getByRole('region', { name: '맡은 일' }).getByRole('link', { name: 'Sprout Lands Asset Pack' })
		).toHaveAttribute('href', 'https://cupnooble.itch.io/sprout-lands-asset-pack');
		// 인벤토리: 칸을 누르면 그 아이템(기술 사양) 설명이 보인다
		const inventory = panel.getByRole('region', { name: '기술 사양' });
		await inventory.getByRole('button', { name: '배포' }).click();
		await expect(inventory.getByRole('button', { name: '배포' })).toHaveAttribute('aria-pressed', 'true');
		await expect(inventory.locator('.gm-item')).toContainText('Vercel');

		// 포트폴리오: 차례를 누르면 그 장으로 간다
		await open(/HYEONIVERSE/);
		await panel
			.getByRole('navigation', { name: '차례' })
			.getByRole('button', { name: /기술 사양/ })
			.click();
		await expect(panel.getByRole('region', { name: '기술 사양' })).toBeInViewport();
		await expect(
			panel.getByRole('navigation', { name: '차례' }).getByRole('button', { name: /기술 사양/ })
		).toHaveAttribute('aria-current', 'step');

		// 터미널: 처음에는 소개와 help만 있고, 내용은 명령을 쳐야 나온다. 저장소도 ls·cd·cat으로 돌아본다
		await open(/DevCourse/);
		const shell = panel.getByRole('region', { name: '직접 쳐 보기' });
		const prompt = shell.getByRole('textbox', { name: '명령 입력' });
		await expect(panel.getByRole('region', { name: '기술 사양' })).toHaveCount(0);
		await expect(shell.locator('.tm-entry')).toHaveCount(1);
		await expect(shell.locator('.tm-entry')).toContainText('cat stack.json');
		await prompt.fill('cat stack.json');
		await prompt.press('Enter');
		await expect(panel.getByRole('region', { name: '기술 사양' })).toContainText('Express');
		await prompt.fill('git types');
		await prompt.press('Enter');
		await expect(panel.getByRole('region', { name: '커밋 컨벤션' })).toContainText('practice');
		// Tab으로 채우기
		await prompt.fill('who');
		await prompt.press('Tab');
		await expect(prompt).toHaveValue('whoami');
		await prompt.press('Enter');
		await expect(panel.getByRole('region', { name: '맡은 일' })).toContainText('커밋 컨벤션 설계');
		// 저장소: 폴더로 들어가 그날 노트를 읽는다 (프롬프트에 지금 폴더)
		await prompt.fill('cd Week02/03');
		await prompt.press('Enter');
		await expect(shell.locator('.tm-entry').last()).toContainText('Readme.md');
		await expect(shell.locator('form .tm-path')).toHaveText('~/DevCourse-FullStack/Week02/03');
		await prompt.fill('cat Re');
		await prompt.press('Tab');
		await expect(prompt).toHaveValue('cat Readme.md');
		await prompt.press('Enter');
		await expect(shell.locator('.tm-entry').last()).toContainText('CSS의 이해');
		// 목록의 이름을 누르면 그 명령이 쳐진다
		await prompt.fill('cd ..');
		await prompt.press('Enter');
		await shell.locator('.tm-entry').last().getByRole('button', { name: '01/' }).click();
		await expect(shell.locator('form .tm-path')).toHaveText('~/DevCourse-FullStack/Week02/01');
		// 없는 명령, 이전 명령, clear
		await prompt.fill('nope');
		await prompt.press('Enter');
		await expect(shell).toContainText('command not found: nope');
		await prompt.press('ArrowUp');
		await expect(prompt).toHaveValue('nope');
		await prompt.fill('clear');
		await prompt.press('Enter');
		await expect(shell.locator('.tm-entry')).toHaveCount(0);
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
		await expect(tabs).toHaveCount(6);
		await expect(safari.getByRole('tab', { name: /WTD/ })).toHaveAttribute('aria-selected', 'true');

		// 새 탭은 시작 페이지. 즐겨찾기에서 고르면 그 탭이 프로젝트로 바뀐다
		await safari.getByRole('button', { name: '새 탭' }).click();
		await expect(safari.getByRole('tab', { name: '시작 페이지' })).toHaveAttribute('aria-selected', 'true');
		const start = safari.getByRole('region', { name: '시작 페이지' });
		await start.getByRole('button', { name: /NewPick/ }).click();
		await expect(tabs).toHaveCount(7);
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

test('게임 페이지: 스크롤하면 주인공이 개발 일지의 길을 따라 내려간다', async ({ page }) => {
	await enterDesktop(page);
	const safari = appWindow(page, 'safari');
	await safari.getByRole('tab', { name: /SproutFarm/ }).click();
	const map = safari.getByRole('tabpanel').getByRole('region', { name: '만든 방식' });
	const hero = map.locator('.gm-hero');
	const heroY = async () => (await hero.boundingBox())!.y - (await map.boundingBox())!.y;
	const scrollTo = (fraction: number) =>
		map.evaluate((el, f) => {
			const scroller = el.closest('.safari-page')!;
			const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
			scroller.scrollTop = top + el.scrollHeight * f - scroller.clientHeight / 2;
		}, fraction);
	await scrollTo(0.2);
	await expect.poll(heroY).toBeGreaterThan(0);
	const before = await heroY();
	await scrollTo(0.7);
	await expect.poll(heroY).toBeGreaterThan(before + 200);
});

test('칸반(WTD): 카드를 다음 열로 옮기면 열의 카드 수가 바뀌고, 처음대로 되돌린다', async ({ page }) => {
	await enterDesktop(page);
	const safari = appWindow(page, 'safari');
	await safari.getByRole('tab', { name: /WTD/ }).click();
	const panel = safari.getByRole('tabpanel');
	const todo = panel.getByRole('region', { name: '주요 기능' });
	const doing = panel.getByRole('region', { name: '만든 방식' });
	const count = (column: typeof todo) => column.locator('.kb-count').textContent();
	const before = { todo: Number(await count(todo)), doing: Number(await count(doing)) };

	const card = todo.locator('.kb-card').first();
	const title = (await card.locator('h3').textContent())!;
	await card.hover();
	await card.getByRole('button', { name: `${title}: 진행 중(으)로 옮기기` }).click();
	await expect(doing.locator('.kb-card h3', { hasText: title })).toBeVisible();
	await expect(todo.locator('.kb-count')).toHaveText(String(before.todo - 1));
	await expect(doing.locator('.kb-count')).toHaveText(String(before.doing + 1));

	await panel.getByRole('button', { name: '처음대로' }).click();
	await expect(todo.locator('.kb-card h3', { hasText: title })).toBeVisible();
	await expect(panel.getByRole('button', { name: '처음대로' })).toHaveCount(0);
});

test('신문(NewPick): 기사 꼭지를 펼치면 그 줄 아래에 자세한 설명과 실제 화면이 나오고, 다른 꼭지를 펼치면 바뀐다', async ({
	page,
}) => {
	await enterDesktop(page);
	const safari = appWindow(page, 'safari');
	const panel = safari.getByRole('tabpanel');
	const articles = panel.getByRole('region', { name: '주요 기능' });
	const more = articles.getByRole('button', { name: '기사 펼쳐 읽기' });
	await more.first().click();
	const detail = articles.locator('#np-article-detail');
	await expect(detail).toContainText('자세히 · AI 뉴스 요약');
	await expect(detail.getByRole('img', { name: 'AI 뉴스 요약 화면' })).toBeVisible();
	// 첫 줄의 세 꼭지 다음, 둘째 줄 꼭지 앞에 놓인다
	const top = async (locator: typeof detail) => (await locator.boundingBox())!.y;
	expect(await top(detail)).toBeGreaterThan(await top(articles.getByRole('heading', { name: '매일 아침 메일로' })));
	expect(await top(detail)).toBeLessThan(await top(articles.getByRole('heading', { name: '나에게 맞춘 추천' })));
	// 펼친 꼭지의 단추는 "접기"가 되므로, 남은 첫 "기사 펼쳐 읽기"가 둘째 꼭지다
	await articles.getByRole('button', { name: '기사 펼쳐 읽기' }).first().click();
	await expect(detail).toContainText('자세히 · 카테고리별 뉴스');
	await articles.getByRole('button', { name: '접기' }).click();
	await expect(detail).toHaveCount(0);
});
