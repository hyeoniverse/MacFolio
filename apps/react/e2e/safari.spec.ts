import { test, expect, enterDesktop, appWindow } from './fixtures';
import { FAKE_API, fakeApi } from './fakeApi';

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
		for (const name of ['주요 기능', '만든 방식', '맡은 일', '기술 사양']) {
			await expect(panel.getByRole('region', { name })).toBeVisible();
		}
		// 다음 단계(앞으로 할 일)는 어느 페이지에도 두지 않는다
		await expect(panel.getByRole('region', { name: '다음 단계' })).toHaveCount(0);
		// 데이터 장에는 데이터베이스 구조가 문서마다 필드와 함께 그려진다
		const schema = panel.getByRole('group', { name: '데이터베이스 구조' });
		await expect(schema.getByRole('list', { name: 'serials/{번호} 필드' })).toContainText('cardId');
		await expect(schema).toContainText('소유자만');
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
		// 번역 데모는 API를 거쳐 실제로 번역한다. 바깥 서비스를 부르지 않게 가짜 번역을 돌려준다
		await fakeApi(page);
		const translated: unknown[] = [];
		await page.route(`${FAKE_API}/translate`, (route) => {
			const request = route.request();
			const headers = {
				'Access-Control-Allow-Origin': 'http://localhost:4173',
				'Access-Control-Allow-Headers': 'Content-Type',
			};
			if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			if (request.method() === 'GET') return route.fulfill({ headers, json: { remaining: 3, perIp: 3, total: 50 } });
			translated.push(request.postDataJSON());
			return route.fulfill({
				headers,
				json: {
					provider: 'google',
					attempts: [
						{ provider: 'deepl', state: 'fail', reason: '사용 한도에 닿았습니다' },
						{ provider: 'google', state: 'ok' },
					],
					texts: [
						'A portfolio site designed, built and operated solo',
						'A personal portfolio that gathers projects and writing in one place.',
						'I built the site visitors see together with the admin CMS that runs it.',
					],
					remaining: 2,
				},
			});
		});
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
			.getByRole('navigation', { name: '차례', exact: true })
			.getByRole('button', { name: /기술 사양/ })
			.click();
		await expect(panel.getByRole('region', { name: '기술 사양' })).toBeInViewport();
		await expect(
			panel.getByRole('navigation', { name: '차례', exact: true }).getByRole('button', { name: /기술 사양/ })
		).toHaveAttribute('aria-current', 'step');
		// 테마: 프리셋을 고르면 미리보기 이름이 바뀌고, 다크로 바꿀 수 있다
		const themes = panel.getByRole('region', { name: '테마' });
		await themes.getByRole('button', { name: 'Forest' }).click();
		await expect(themes.locator('.cd-themes-name')).toHaveText('Forest');
		await themes.getByRole('button', { name: /다크/ }).click();
		await expect(themes.getByRole('img', { name: 'Forest 테마 다크 미리보기' })).toBeVisible();
		// 발표 갤러리: 소리를 낼지 먼저 묻고, 고르면 물음이 사라진다
		const slides = panel.locator('.cd-slides');
		await slides.getByRole('button', { name: '음성 없이 보기' }).click();
		await expect(slides.locator('.cd-ask')).toHaveCount(0);
		await slides.getByRole('button', { name: '2장으로' }).click();
		await expect(slides.locator('.cd-slides-source')).toContainText('Fish TTS 음성 파일 · 발표 2쪽');
		// 번역: 한국어 칸을 고치고 EN으로 바꾸면, 세 칸을 서버로 보내 비어 있던 영어 칸을 채운다. 대신 번역한 공급자와 남은 횟수
		const translate = panel.locator('.cd-translate');
		await translate.getByRole('textbox', { name: '부제 (한국어)' }).fill('혼자 설계하고 운영하는 포트폴리오 사이트');
		await translate.getByRole('button', { name: 'EN' }).click();
		await expect(translate).toContainText('A portfolio site designed');
		await expect(translate.getByRole('status')).toContainText(
			'DeepL 실패(사용 한도에 닿았습니다) → Google로 번역했습니다'
		);
		await expect(translate).toContainText('오늘 2번 남음');
		expect(translated).toEqual([
			{
				texts: [
					'혼자 설계하고 운영하는 포트폴리오 사이트',
					expect.stringContaining('개인 포트폴리오'),
					expect.stringContaining('관리자 CMS'),
				],
				from: 'ko',
				to: 'en',
			},
		]);
		// 파형: 나누면 클립이 둘이 되고, 되돌리면 하나로 돌아온다
		const wave = panel.getByLabel('녹음 파형 편집기', { exact: true });
		await wave.locator('.cd-wave-track').click({ position: { x: 120, y: 40 } });
		await wave.getByRole('button', { name: '나누기' }).click();
		await expect(wave.locator('.cd-clip')).toHaveCount(2);
		await wave.getByRole('button', { name: '되돌리기' }).click();
		await expect(wave.locator('.cd-clip')).toHaveCount(1);

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

test('신문(NewPick): 주요 기능은 머리 사진 기사, 사진 기사, 단신으로 짠 지면이고 사진에는 실제 화면 설명이 붙는다', async ({
	page,
}) => {
	await enterDesktop(page);
	const safari = appWindow(page, 'safari');
	const panel = safari.getByRole('tabpanel');
	const articles = panel.getByRole('region', { name: '주요 기능' });
	// 펼치는 단추 없이 처음부터 다 보인다
	await expect(articles.getByRole('button')).toHaveCount(0);
	const lead = articles.locator('.np-story-lead');
	await expect(lead.getByRole('heading', { name: 'AI 뉴스 요약' })).toBeVisible();
	await expect(lead.getByRole('img', { name: 'AI 뉴스 요약 화면' })).toBeVisible();
	await expect(lead).toContainText('▲ 실제 서비스 화면');
	await expect(articles.locator('.np-stories article')).toHaveCount(3);
	await expect(articles.getByRole('complementary', { name: '단신' })).toContainText('가입 전에 체험');
});
