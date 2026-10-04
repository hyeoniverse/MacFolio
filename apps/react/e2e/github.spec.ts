import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const pinnedNames = (page: Page) =>
	appWindow(page, 'github').getByRole('region', { name: 'Pinned' }).locator('.gh-repo-name').allInnerTexts();

async function openGithubSettings(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: 'GitHub', exact: true }).click();
	return settings;
}

test.describe('GitHub 앱', () => {
	test('서버가 GitHub에서 받은 프로필·README·고른 저장소를 보여 준다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		const profile = github.getByRole('complementary', { name: '프로필' });
		await expect(profile).toContainText('서버에서 받은 소개');
		await expect(profile).toContainText('42 followers');
		await expect(profile).toContainText('8 following');
		await expect(github.getByRole('link', { name: /Repositories/ })).toContainText('30');

		// README: 실제 내용을 그린다. 배너는 CSS 배너, 배지는 Contact 단추, 상대 주소는 프로필 저장소로
		const readme = github.getByRole('article', { name: 'README' });
		await expect(readme.getByRole('img', { name: 'Test Banner' })).toHaveClass('gh-banner');
		await expect(readme.getByRole('heading', { name: '소개' })).toBeVisible();
		await expect(readme.getByRole('listitem')).toHaveCount(2);
		const mail = readme.getByRole('link', { name: 'Mail' });
		await expect(mail).toHaveClass('gh-contact-button');
		await expect(mail).toHaveAttribute('href', 'mailto:someone@example.com');
		await expect(mail).toHaveCSS('background-color', 'rgb(10, 132, 255)');
		await expect(readme.getByRole('link', { name: 'Site' })).toHaveAttribute('target', '_blank');
		await expect(readme.getByRole('img', { name: 'Test Card' })).toHaveAttribute(
			'src',
			'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/HEAD/profile/card-light.svg'
		);

		// 고른 순서대로 Pinned. 다른 계정의 저장소는 owner/를 붙인다
		expect(await pinnedNames(page)).toEqual(['alpha', 'test-org/gamma']);
	});

	test('화면 모드를 다크로 바꾸면 README의 어두운 그림을 쓴다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await settings.getByRole('button', { name: '화면 모드' }).click();
		await settings.getByRole('radio', { name: '다크' }).click();
		await dockItem(page, 'github').click();
		await expect(
			appWindow(page, 'github').getByRole('article', { name: 'README' }).getByRole('img', { name: 'Test Card' })
		).toHaveAttribute('src', /card-dark\.svg$/);
	});

	test('서버에 닿지 않으면 넣어 둔 스냅샷을 보여 준다', async ({ page }) => {
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		const readme = github.getByRole('article', { name: 'README' });
		await expect(readme.locator('.gh-banner')).toBeVisible();
		await expect(readme.locator('.gh-contact-button')).toHaveCount(3);
		// 고정 저장소는 Safari와 같은 프로젝트 목록(중요도 순)의 앞 6개 (GitHub처럼 6개까지)
		await expect(github.getByRole('region', { name: 'Pinned' }).locator('.gh-repo-name')).toHaveText([
			'web-portfolio-hyeoniverse',
			'MacFolio',
			'Devcourse-NewPick/front',
			'QRU',
			'Devcourse-WhatToDo/todo-front',
			'SproutFarm',
		]);
	});

	test('고정 저장소 카드는 설명 길이와 상관없이 크기가 같고, 언어 줄은 카드 아래에 붙는다', async ({ page }) => {
		// 스냅샷: 한 줄, 두 줄이 넘는 설명이 섞여 있다
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const cards = appWindow(page, 'github').getByRole('region', { name: 'Pinned' }).locator('.gh-repo');
		await expect(cards).toHaveCount(6);
		const boxes = await cards.evaluateAll((elements) =>
			elements.map((element) => {
				const card = element.getBoundingClientRect();
				const meta = element.querySelector('.gh-repo-meta')!.getBoundingClientRect();
				return { height: Math.round(card.height), metaGap: Math.round(card.bottom - meta.bottom) };
			})
		);
		expect(new Set(boxes.map((box) => box.height)).size).toBe(1);
		expect(new Set(boxes.map((box) => box.metaGap)).size).toBe(1);
	});

	test('Pinned 아래에 지난 1년의 기여 달력과 최근 활동을 달마다 보여 준다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');

		const graph = github.getByRole('region', { name: 'Contributions' });
		await expect(graph.getByRole('heading')).toHaveText('1,234 contributions in the last year');
		// 53주 × 7일 = 371칸 (범례 5칸은 따로)
		await expect(graph.locator('.gh-graph .gh-day')).toHaveCount(371);
		await expect(graph.locator('.gh-day[data-date="2026-10-03"]')).toHaveAttribute(
			'title',
			/contributions? on October 3$/
		);
		// 첫 주는 일요일부터, 가장 최근 주가 오른쪽 끝
		const box = (date: string) => graph.locator(`.gh-day[data-date="${date}"]`).boundingBox();
		const [sunday, saturday, last] = await Promise.all([box('2025-09-28'), box('2025-10-04'), box('2026-10-03')]);
		expect(sunday!.x).toBe(saturday!.x);
		expect(saturday!.y).toBeGreaterThan(sunday!.y);
		expect(last!.x).toBeGreaterThan(saturday!.x);
		// 달 이름: 첫 주(9월 28일~10월 4일)에 10월 1일이 있어 Oct부터, 9월은 다음 해 9월에만
		await expect(graph.locator('.gh-graph-month:not([hidden])').first()).toHaveText('Oct');
		// 위의 Pinned보다 아래
		const pinned = await github.getByRole('region', { name: 'Pinned' }).boundingBox();
		expect((await graph.boundingBox())!.y).toBeGreaterThan(pinned!.y);

		const history = github.getByRole('region', { name: 'Contribution activity' });
		await expect(history.getByRole('heading', { level: 3 })).toHaveText(['October 2026', 'September 2026']);
		const items = history.locator('li');
		// 같은 날 같은 브랜치의 푸시 두 번은 한 줄로 (커밋 3 + 2)
		await expect(items).toHaveCount(3);
		await expect(items.nth(0)).toContainText('Pushed 5 commits to hyeoniverse/alpha');
		await expect(items.nth(1)).toContainText('Merged pull request hyeoniverse/alpha#7');
		await expect(items.nth(1)).toContainText('기능 더하기');
		await expect(items.nth(1).getByRole('link', { name: 'hyeoniverse/alpha#7' })).toHaveAttribute(
			'href',
			'https://github.com/hyeoniverse/alpha/pull/7'
		);
		await expect(items.nth(2)).toContainText('Created repository hyeoniverse/beta');
	});

	test('GitHub 활동을 받지 못하면 달력과 활동은 숨기고 나머지는 그대로', async ({ page }) => {
		const api = await fakeApi(page);
		api.github.activity = null;
		await enterDesktop(page);
		await dockItem(page, 'github').click();
		const github = appWindow(page, 'github');
		await expect(github.getByRole('complementary', { name: '프로필' })).toContainText('서버에서 받은 소개');
		await expect(github.getByRole('region', { name: 'Contributions' })).toHaveCount(0);
		await expect(github.getByRole('region', { name: 'Contribution activity' })).toHaveCount(0);
	});

	test('방문자의 시스템 설정에는 GitHub 항목이 없다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'settings').click();
		const settings = appWindow(page, 'settings');
		await expect(settings.getByRole('button', { name: '사운드' })).toBeVisible();
		await expect(settings.getByRole('button', { name: 'GitHub', exact: true })).toHaveCount(0);
	});
});

test.describe('시스템 설정 → GitHub (관리자)', () => {
	test('편집에서 더하고, ≡로 순서를 바꾸고, 빼면 완료할 때 한 번에 저장되어 GitHub 앱에 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openGithubSettings(page);
		const chosen = settings.getByRole('region', { name: '보일 저장소' });
		await expect(chosen).toContainText('2/6');
		await expect(chosen.getByRole('listitem')).toHaveCount(2);
		// 평소에는 고른 목록만: 빼기·손잡이·더하기는 편집을 눌러야 나온다
		await expect(chosen.getByRole('button', { name: 'hyeoniverse/alpha 빼기' })).toHaveCount(0);
		await expect(settings.getByLabel('저장소 이름 (owner/이름)')).toHaveCount(0);
		await chosen.getByRole('button', { name: '편집' }).click();

		// 내 계정 저장소 목록에서 더한다 (고른 저장소는 체크 표시)
		const mine = settings.getByRole('region', { name: 'hyeoniverse의 저장소' });
		await expect(mine.getByRole('img', { name: 'hyeoniverse/alpha 고름' })).toBeVisible();
		await mine.getByRole('button', { name: 'hyeoniverse/beta 더하기' }).click();
		await expect(chosen).toContainText('3/6');

		// ≡ 손잡이를 끌어서 순서 바꾸기 (메모 폴더 편집과 같다): beta를 맨 위로
		const handle = chosen.getByRole('button', { name: '순서 바꾸기 (hyeoniverse/beta)' });
		const from = (await handle.boundingBox())!;
		const to = (await chosen.getByRole('button', { name: '순서 바꾸기 (hyeoniverse/alpha)' }).boundingBox())!;
		await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
		await page.mouse.down();
		await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 8 });
		await page.mouse.up();
		await expect(chosen.getByRole('listitem').first().locator('strong')).toHaveText('beta');

		// 키보드: 손잡이에서 ↓로 한 칸 내린다
		await chosen.getByRole('button', { name: '순서 바꾸기 (hyeoniverse/beta)' }).press('ArrowDown');
		await expect(chosen.getByRole('listitem').nth(1).locator('strong')).toHaveText('beta');

		// 빼기. 하나만 남으면 손잡이는 꺼진다
		await chosen.getByRole('button', { name: 'hyeoniverse/alpha 빼기' }).click();
		await chosen.getByRole('button', { name: 'test-org/gamma 빼기' }).click();
		await expect(chosen.getByRole('button', { name: '순서 바꾸기 (hyeoniverse/beta)' })).toBeDisabled();

		// 목록에 없는 다른 계정의 저장소는 이름으로 (GitHub에 적힌 대소문자로)
		await settings.getByLabel('저장소 이름 (owner/이름)').fill('someone/delta');
		await settings.getByRole('button', { name: '더하기', exact: true }).click();
		await expect(chosen.getByLabel('someone/Delta', { exact: true })).toBeVisible();

		// 여기까지는 저장하지 않았다. 완료를 누르면 한 번에 저장한다
		expect(api.github.saves).toBe(0);
		await chosen.getByRole('button', { name: '완료' }).click();
		await expect.poll(() => api.github.showcase).toEqual(['hyeoniverse/beta', 'someone/Delta']);
		expect(api.github.saves).toBe(1);
		await expect(chosen.getByRole('button', { name: '편집' })).toBeVisible();
		await expect(chosen.getByRole('button', { name: 'hyeoniverse/beta 빼기' })).toHaveCount(0);

		await dockItem(page, 'github').click();
		await expect.poll(() => pinnedNames(page)).toEqual(['beta', 'someone/Delta']);
	});

	test('편집을 취소하면 바꾼 것을 버리고, 바꾼 것 없이 완료하면 저장하지 않는다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openGithubSettings(page);
		const chosen = settings.getByRole('region', { name: '보일 저장소' });

		await chosen.getByRole('button', { name: '편집' }).click();
		await chosen.getByRole('button', { name: 'hyeoniverse/alpha 빼기' }).click();
		await expect(chosen).toContainText('1/6');
		await chosen.getByRole('button', { name: '취소' }).click();
		await expect(chosen).toContainText('2/6');
		await expect(chosen.getByRole('listitem')).toHaveCount(2);

		await chosen.getByRole('button', { name: '편집' }).click();
		await chosen.getByRole('button', { name: '완료' }).click();
		await expect(chosen.getByRole('button', { name: '편집' })).toBeVisible();
		expect(api.github.saves).toBe(0);
		expect(api.github.showcase).toEqual(['hyeoniverse/alpha', 'test-org/gamma']);
	});

	test('잘못된 이름이나 없는 저장소는 알리고 더하지 않는다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openGithubSettings(page);
		const chosen = settings.getByRole('region', { name: '보일 저장소' });
		await chosen.getByRole('button', { name: '편집' }).click();
		const input = settings.getByLabel('저장소 이름 (owner/이름)');
		const alert = settings.getByRole('alertdialog', { name: '저장소를 바꾸지 못했습니다' });

		await input.fill('no-slash');
		await settings.getByRole('button', { name: '더하기', exact: true }).click();
		await expect(alert).toContainText('owner/이름으로 적어 주세요');
		await alert.getByRole('button', { name: '확인' }).click();

		await input.fill('someone/nothing');
		await settings.getByRole('button', { name: '더하기', exact: true }).click();
		await expect(alert).toContainText('공개 저장소를 찾을 수 없습니다');
		await alert.getByRole('button', { name: '확인' }).click();
		await expect(chosen).toContainText('2/6');
		expect(api.github.saves).toBe(0);
	});

	test('6개를 고르면 더 더할 수 없다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.github.repos.push(
			...['one', 'two', 'three', 'four'].map((name) => ({
				fullName: `hyeoniverse/${name}`,
				owner: 'hyeoniverse',
				name,
				description: null,
				url: `https://github.com/hyeoniverse/${name}`,
				homepage: null,
				language: null,
				stars: 0,
				forks: 0,
				fork: false,
				listed: true,
			}))
		);
		api.github.showcase = [
			'hyeoniverse/alpha',
			'test-org/gamma',
			'hyeoniverse/one',
			'hyeoniverse/two',
			'hyeoniverse/three',
			'hyeoniverse/four',
		];
		await enterDesktop(page);
		const settings = await openGithubSettings(page);
		const chosen = settings.getByRole('region', { name: '보일 저장소' });
		await expect(chosen).toContainText('6/6');
		await chosen.getByRole('button', { name: '편집' }).click();
		await expect(settings.getByRole('button', { name: 'hyeoniverse/beta 더하기' })).toBeDisabled();
		await expect(settings.getByLabel('저장소 이름 (owner/이름)')).toBeDisabled();
	});

	test('로그아웃하면 GitHub 항목이 사라지고 계정으로 돌아간다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openGithubSettings(page);
		await expect(settings.getByRole('region', { name: '보일 저장소' })).toBeVisible();

		await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
		await page.getByRole('menuitem', { name: '로그아웃' }).click();
		await expect(settings.getByRole('button', { name: 'GitHub', exact: true })).toHaveCount(0);
		await expect(settings.getByRole('region', { name: '관리자 계정' })).toContainText('로그인하지 않음');
	});
});
