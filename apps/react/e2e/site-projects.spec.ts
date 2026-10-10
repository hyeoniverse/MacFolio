import { test, expect, enterDesktop, dockItem, appWindow, openFromDock } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

/** 데모 사이트 대신 가짜 페이지 (CSP가 이미 허용하는 데모 출처를 쓴다: vite preview의 CSP는 코드의 데모 주소로 만든다) */
async function fakeDemo(page: Page, origin: string, text: string) {
	await page.route(`${origin}/**`, (route) =>
		route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<h1>${text}</h1>` })
	);
}

async function openProjectsPane(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '프로젝트', exact: true }).click();
	return settings;
}

test.describe('프로젝트 관리', () => {
	test('서버에 저장한 순서·숨김·고친 내용·새 프로젝트 앱이 Safari와 Dock에 그대로 보인다', async ({ page }) => {
		await fakeDemo(page, 'https://qryou-app.web.app', '내 데모 첫 화면');
		const api = await fakeApi(page);
		api.siteProjects = {
			items: [
				{ id: 'devcourse', override: { name: '데브코스 정리' } },
				{ id: 'newpick', hidden: true },
				{
					id: 'my-demo',
					override: {
						name: '내 데모',
						tagline: '새로 더한 프로젝트',
						description: '코드를 고치지 않고 더했다',
						context: '개인 프로젝트',
						url: 'https://github.com/hyeoniverse/my-demo',
						image: '/imgs/projects/qru/screenshot.jpg',
						demo: 'https://qryou-app.web.app/my-demo',
						app: { label: '내 데모', icon: 'projects/qru/app-icon.png' },
					},
				},
			],
		};
		await enterDesktop(page);

		const safari = appWindow(page, 'safari');
		const tabs = safari.getByRole('tab');
		// 서버 순서가 먼저, 숨긴 NewPick은 빠지고, 서버 목록에 없는 코드의 프로젝트는 그 뒤에
		await expect(tabs).toHaveCount(7);
		await expect(tabs.nth(0)).toContainText('데브코스 정리');
		await expect(tabs.nth(1)).toContainText('내 데모');
		await expect(safari.getByRole('tab', { name: /NewPick/ })).toHaveCount(0);
		await tabs.nth(1).click();
		await expect(safari.getByRole('tabpanel').getByRole('article', { name: '내 데모' })).toBeVisible();

		// 숨긴 프로젝트의 앱은 Dock에 없고, 새 프로젝트의 앱은 있다. 열면 데모를 창 안에 띄운다
		await expect(dockItem(page, 'newpick')).toHaveCount(0);
		await openFromDock(page, 'my-demo');
		const app = appWindow(page, 'my-demo');
		await expect(app.locator('iframe[title="내 데모"]')).toHaveAttribute('src', 'https://qryou-app.web.app/my-demo');
		await expect(page.frameLocator('iframe[title="내 데모"]').getByRole('heading')).toHaveText('내 데모 첫 화면');

		// 방문자에게는 관리 화면이 없다
		await dockItem(page, 'settings').click();
		await expect(appWindow(page, 'settings').getByRole('button', { name: '프로젝트', exact: true })).toHaveCount(0);
	});

	test('관리자: 폼으로 고치고, 순서를 바꾸고, 숨기고, 저장하면 새로고침 뒤 모든 화면에 적용된다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		const list = settings.getByRole('list', { name: '프로젝트' });
		await expect(list.getByRole('listitem')).toHaveCount(7);
		// GitHub 항목처럼: 편집을 누르기 전에는 줄마다 단추가 없다
		await expect(list.getByRole('button')).toHaveCount(0);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		await expect(settings.getByRole('button', { name: '완료' })).toBeVisible();

		// MacFolio: 폼에서 이름을 바꾸고, 데모에 http 주소를 넣으면 거절된다
		await list.getByRole('listitem').filter({ hasText: 'MacFolio' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'MacFolio 편집' });
		await editor.getByRole('textbox', { name: '이름', exact: true }).fill('맥폴리오');
		await editor.getByRole('textbox', { name: '데모' }).fill('http://insecure.example');
		await editor.getByRole('button', { name: '완료' }).click();
		await expect(editor.getByRole('alert')).toHaveText('프로젝트 macfolio.demo: https:// 주소여야 합니다.');
		await editor.getByRole('textbox', { name: '데모' }).fill('');

		// 고급 JSON: 폼에 없는 필드도 고친다. 기본으로 돌아가면 JSON에서 고친 값이 폼에 보인다
		await editor.getByRole('tab', { name: '고급 (JSON)' }).click();
		const json = editor.getByRole('textbox', { name: '프로젝트 JSON' });
		const text = await json.inputValue();
		await json.fill(text.replace('"포트폴리오를, 데스크톱으로."', '"JSON으로 고친 제목"'));
		await editor.getByRole('tab', { name: '기본' }).click();
		await expect(editor.getByRole('textbox', { name: '큰 제목' })).toHaveValue('JSON으로 고친 제목');
		await editor.getByRole('button', { name: '완료' }).click();
		await expect(editor).toBeHidden();

		// 순서: 맥폴리오를 맨 위로. DevCourse는 숨긴다
		const macfolio = list.getByRole('listitem').filter({ hasText: '맥폴리오' });
		await expect(macfolio).toContainText('macfolio · 고침');
		// ≡ 손잡이에서 ↑ 키로 한 칸 위로 (끌어도 된다)
		await macfolio.getByRole('button', { name: '순서 바꾸기 (맥폴리오)' }).press('ArrowUp');
		await list.getByRole('button', { name: 'DevCourse FullStack 숨기기' }).click();
		await expect(list.getByRole('listitem').first()).toContainText('맥폴리오');
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		// 코드의 기본값과 다른 것만 저장한다
		expect(api.siteProjects?.items[0]).toEqual({
			id: 'macfolio',
			override: { name: '맥폴리오', tagline: 'JSON으로 고친 제목' },
		});
		expect(api.siteProjects?.items).toContainEqual({ id: 'devcourse', hidden: true });

		await settings.getByRole('button', { name: '지금 새로고침' }).click();
		await expect(appWindow(page, 'safari').getByRole('tab').first()).toContainText('맥폴리오');
		await expect(appWindow(page, 'safari').getByRole('tab', { name: /DevCourse/ })).toHaveCount(0);
	});

	test('관리자: 새 프로젝트를 앱으로 더하고, 기본값으로 되돌린다', async ({ page }) => {
		await fakeDemo(page, 'https://what-to-do-chi.vercel.app', '새 앱 첫 화면');
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		// GitHub 항목의 owner/이름으로 더하기처럼, 맨 아래 칸에 id를 적어 더한다
		await settings.getByRole('textbox', { name: '새 프로젝트 id' }).fill('side-app');
		await settings.getByRole('button', { name: '더하기' }).click();
		const editor = settings.getByRole('form', { name: '새 프로젝트 편집' });
		await editor.getByRole('textbox', { name: 'id' }).fill('side-app');
		await editor.getByRole('textbox', { name: '이름', exact: true }).fill('사이드 앱');
		await editor.getByRole('textbox', { name: '저장소' }).fill('https://github.com/hyeoniverse/side-app');
		await editor.getByRole('textbox', { name: '데모' }).fill('https://what-to-do-chi.vercel.app/side');
		// 꼭 적어야 하는 칸에는 '필수' 표시. 화면 캡처는 비워도 된다 (화면 모음의 첫 그림을 쓴다)
		const fieldName = (name: string) =>
			editor.locator('.projects-field-label').filter({ hasText: new RegExp(`^${name}`) });
		await expect(fieldName('저장소')).toHaveText('저장소필수');
		await expect(fieldName('이름')).toHaveText('이름필수');
		await expect(fieldName('화면 캡처')).toHaveText('화면 캡처');
		// 기간: 달력에서 시작일을 고르고, 끝 대신 '진행 중'
		await editor.getByLabel('시작일').fill('2025-01-02');
		await editor.getByRole('checkbox', { name: '진행 중' }).check();
		// 언어: 후보 목록에서 (다른 값도 쓸 수 있다)
		await editor.getByRole('combobox', { name: '주 언어' }).fill('TypeScript');
		// 기술: 쉼표를 치면 칩이 되고, 몇 글자 치면 후보가 걸러진다 (고르면 칩)
		const stack = editor.getByRole('combobox', { name: '기술' });
		await stack.pressSequentially('React, Vi');
		await expect(editor.getByRole('list', { name: '고른 기술' })).toHaveText(['React']);
		await editor.getByRole('listbox', { name: '기술 후보' }).getByRole('option', { name: 'Vite', exact: true }).click();
		await expect(editor.getByRole('list', { name: '고른 기술' }).getByRole('listitem')).toHaveText(['React', 'Vite']);
		// 화면 모음은 폴더 하나로: 그 폴더의 그림을 모두 쓴다 (고르면 미리 보기)
		await editor.getByRole('combobox', { name: '폴더' }).selectOption('/imgs/projects/qru/screens');
		await expect(editor.getByRole('list', { name: '화면 모음 미리 보기' }).locator('img').first()).toBeVisible();
		await editor.getByRole('switch', { name: /이 사이트 안에서 창으로 열기/ }).check();
		await expect(editor.getByRole('textbox', { name: '앱 이름' })).toHaveValue('사이드 앱');
		await editor.getByRole('switch', { name: /Dock에 고정/ }).uncheck();
		await editor.getByRole('button', { name: '완료' }).click();

		const list = settings.getByRole('list', { name: '프로젝트' });
		await expect(list.getByRole('listitem').filter({ hasText: 'side-app' })).toContainText(
			'side-app · 앱 · 새 프로젝트'
		);
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		expect(api.siteProjects?.items.at(-1)).toMatchObject({
			id: 'side-app',
			override: {
				name: '사이드 앱',
				stack: ['React', 'Vite'],
				language: 'TypeScript',
				period: '2025.01.02 – 진행 중',
				galleryFolder: '/imgs/projects/qru/screens',
				app: { label: '사이드 앱', inDock: false },
			},
		});

		// 새로고침하면 Launchpad에 앱이 생기고(Dock에 고정하지 않음), 열면 데모를 띄운다
		// 새로고침 (로딩 화면을 지나 바탕화면까지)
		await enterDesktop(page);
		await expect(dockItem(page, 'side-app')).toHaveCount(0);
		await openFromDock(page, 'side-app');
		await expect(page.frameLocator('iframe[title="사이드 앱"]').getByRole('heading')).toHaveText('새 앱 첫 화면');
		// Safari의 새 프로젝트 페이지에 그 폴더의 그림이 화면 모음으로 보인다
		await dockItem(page, 'safari').click();
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /사이드 앱/ }).click();
		const shots = safari.getByRole('tabpanel').locator('.qc-gallery img');
		await expect(shots.first()).toHaveAttribute('src', /^\/imgs\/projects\/qru\/screens\//);
		// 화면 캡처를 비웠으니 화면 모음의 첫 그림이 대표 화면이 된다
		await expect(safari.getByRole('tabpanel').locator('.qc-shot img')).toHaveAttribute(
			'src',
			/^\/imgs\/projects\/qru\/screens\//
		);

		// 기본값으로 되돌리기: 한 번 더 묻고 서버의 내용을 지운다
		const again = await openProjectsPane(page);
		await again.getByRole('button', { name: '편집', exact: true }).click();
		await again.getByRole('button', { name: '기본값으로 되돌리기' }).click();
		await page
			.getByRole('alertdialog', { name: '프로젝트를 기본값으로 되돌릴까요?' })
			.getByRole('button', { name: '되돌리기' })
			.click();
		await expect(again.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		expect(api.siteProjects).toBeNull();
		await expect(again.getByRole('list', { name: '프로젝트' }).getByRole('listitem')).toHaveCount(7);
	});
});
