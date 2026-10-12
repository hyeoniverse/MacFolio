import { test, expect, enterDesktop, dockItem, appWindow, openFromDock } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';
// 서버와 화면이 함께 쓰는 검사 (빌드 없이 소스를 바로)
import { parseProjects } from '../../../packages/desktop-core/src/site/projects';

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

	test('관리자: 폼으로 고치고, 순서를 바꾸고, 숨기고, 저장하면 Safari에 바로, 새로고침 뒤 모든 화면에 적용된다', async ({
		page,
	}) => {
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
		await editor.getByRole('tab', { name: 'JSON' }).click();
		const json = editor.getByRole('textbox', { name: '프로젝트 JSON' });
		const text = await json.inputValue();
		await json.fill(text.replace('"포트폴리오를, 데스크톱으로."', '"JSON으로 고친 제목"'));
		await editor.getByRole('tab', { name: '소개' }).click();
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

		// Safari에는 새로고침 없이 바로: 맥폴리오가 맨 앞, 숨긴 DevCourse는 탭에서 빠진다
		const live = appWindow(page, 'safari');
		await dockItem(page, 'safari').click();
		await expect(live.getByRole('tab').first()).toContainText('맥폴리오');
		await expect(live.getByRole('tab', { name: /DevCourse/ })).toHaveCount(0);
		// 사진 앨범이 바뀌었으니(DevCourse를 숨김) 새로고침을 권한다. 새로고침해도 그대로
		await settings.getByRole('button', { name: '지금 새로고침' }).click();
		await expect(appWindow(page, 'safari').getByRole('tab').first()).toContainText('맥폴리오');
		await expect(appWindow(page, 'safari').getByRole('tab', { name: /DevCourse/ })).toHaveCount(0);
	});

	test('관리자: 새 프로젝트를 앱으로 더하고, 화면 모음에 그림을 넣고, 기본값으로 되돌린다', async ({ page }) => {
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
		// 꼭 적어야 하는 칸에는 '필수' 표시. 대표 화면은 그림 탭에서 비워 둔다 (화면 더 보기의 첫 그림을 쓴다)
		const fieldName = (name: string) =>
			editor.locator('.projects-field-label').filter({ hasText: new RegExp(`^${name}`) });
		await expect(fieldName('저장소')).toHaveText('저장소필수');
		await expect(fieldName('이름')).toHaveText('이름필수');
		// 미리 보기가 함께 보인다 (고치는 대로 바뀐다)
		await expect(
			editor.getByRole('complementary', { name: '미리 보기' }).locator('.sp[data-look="showcase"]')
		).toBeVisible();
		await expect(editor.getByRole('complementary', { name: '미리 보기' }).locator('.sc-hero h1')).toHaveText(
			'사이드 앱'
		);
		// 기간: 사이트 달력(메모 글 날짜와 같은 것)에서 시작일을 고르고, 끝 대신 '진행 중'
		await editor.getByRole('button', { name: '시작일 고르기' }).click();
		const calendar = page.getByRole('dialog', { name: '날짜 고르기' });
		await calendar.getByRole('button', { name: /월, 월 고르기$/ }).click();
		await calendar.getByRole('button', { name: /년, 연도 고르기$/ }).click();
		await calendar.getByRole('button', { name: '2025년' }).click();
		await calendar.getByRole('button', { name: '2025년 1월' }).click();
		await calendar.getByRole('gridcell', { name: '2025년 1월 2일' }).click();
		await expect(editor.getByRole('button', { name: /^시작일 2025\. 1\. 2\./ })).toBeVisible();
		await editor.getByRole('checkbox', { name: '진행 중' }).check();
		// 언어: 후보 목록에서 (다른 값도 쓸 수 있다)
		await editor.getByRole('combobox', { name: '주 언어' }).fill('TypeScript');
		// 기술: 쉼표를 치면 칩이 되고, 몇 글자 치면 후보가 걸러진다 (고르면 칩)
		const stack = editor.getByRole('combobox', { name: '기술' });
		await stack.pressSequentially('React, Vi');
		await expect(editor.getByRole('list', { name: '고른 기술' })).toHaveText(['React']);
		await page.getByRole('listbox', { name: '기술 후보' }).getByRole('option', { name: 'Vite', exact: true }).click();
		await expect(editor.getByRole('list', { name: '고른 기술' }).getByRole('listitem')).toHaveText(['React', 'Vite']);
		// 코드의 목록에 없는 라이브러리는 npm 레지스트리에서 찾아 뒤에 붙인다 (출처 표시)
		await page.route('https://registry.npmjs.org/**', (route) =>
			route.fulfill({ json: { objects: [{ package: { name: 'react' } }, { package: { name: 'tiny-qr-kit' } }] } })
		);
		await stack.pressSequentially('tiny');
		const npmOption = page.getByRole('listbox', { name: '기술 후보' }).getByRole('option', { name: /tiny-qr-kit/ });
		await expect(npmOption).toHaveAttribute('data-source', 'npm');
		await npmOption.click();
		await expect(editor.getByRole('list', { name: '고른 기술' }).getByRole('listitem')).toHaveText([
			'React',
			'Vite',
			'tiny-qr-kit',
		]);
		// 새 프로젝트의 기본 모양은 어디에나 맞는 '기본 (카드)'
		await expect(
			editor.getByRole('radiogroup', { name: '페이지 모양' }).getByRole('radio', { checked: true })
		).toHaveAccessibleName('기본');
		// 그림 탭: 프로젝트 아이콘은 사이트 안 그림에서 고른다. 글자 로고 칸은 없다 (필요하면 JSON의 logo)
		await editor.getByRole('tab', { name: '그림' }).click();
		await editor.getByRole('combobox', { name: '프로젝트 아이콘 고르기' }).selectOption('/imgs/projects/qru/icon.png');
		await expect(editor.getByLabel(/글자 로고/)).toHaveCount(0);
		// 대표 화면은 비워 둔다 (화면 더 보기의 첫 그림을 쓴다)
		await expect(editor.getByRole('textbox', { name: '대표 화면 주소' })).toHaveValue('');
		// 화면 더 보기는 폴더가 아니라 그림마다 고르거나 올린다 (폴더는 저장소에 넣고 배포한 그림만 되어 JSON에서만)
		await expect(editor.getByRole('combobox', { name: '폴더' })).toHaveCount(0);
		const gallery = editor.locator('.projects-editor-form').getByRole('region', { name: '화면 더 보기' });
		// ＋로 줄을 더하면 그 줄의 설명 칸에 초점. 고를 수 있는 그림은 /imgs/projects 아래뿐 (배경화면 등은 없다)
		await gallery.getByRole('button', { name: '더하기' }).click();
		await expect(editor.getByRole('textbox', { name: '화면 더 보기 1 설명' })).toBeFocused();
		const pictureValues = await editor
			.getByRole('combobox', { name: '화면 더 보기 1 그림 고르기' })
			.locator('option')
			.evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
		expect(pictureValues.length).toBeGreaterThan(0);
		expect(pictureValues.every((value) => value.startsWith('/imgs/projects/'))).toBe(true);
		const shots = ['/imgs/projects/qru/screens/card.jpg', '/imgs/projects/qru/screens/create-modal.jpg'];
		await editor.getByRole('combobox', { name: '화면 더 보기 1 그림 고르기' }).selectOption(shots[0]);
		await editor.getByRole('textbox', { name: '화면 더 보기 1 설명' }).fill('카드 화면');
		// 둘째 장은 설명을 비워 둔다 (저장할 때 파일 이름에서 짓는다)
		await gallery.getByRole('button', { name: '더하기' }).click();
		await editor.getByRole('combobox', { name: '화면 더 보기 2 그림 고르기' }).selectOption(shots[1]);
		await expect(gallery.getByRole('row').locator('img')).toHaveCount(2);
		await expect(editor.getByRole('textbox', { name: '화면 더 보기 2 주소' })).toHaveValue(shots[1]);
		// 줄의 그림을 누르면 화면 모음을 차례로 크게 본다
		await gallery.getByRole('button', { name: '화면 더 보기 2 그림 크게 보기' }).click();
		const lightbox = page.getByRole('dialog', { name: '그림 크게 보기' });
		await expect(lightbox).toContainText('2 / 2');
		await page.keyboard.press('Escape');
		await expect(lightbox).toHaveCount(0);
		// 미리 보기: 첫 그림이 대표 화면이 되어 맨 위에 뜬다
		const preview = editor.getByRole('complementary', { name: '미리 보기' });
		await expect(preview.locator('.sc-hero-shot').first()).toHaveAttribute('src', shots[0]);
		await expect(preview.getByRole('region', { name: '화면 모음' }).locator('img').first()).toHaveAttribute(
			'src',
			shots[0]
		);
		// 내용 탭: 주요 기능 하나. ＋는 빈 항목을 더하고 그 항목의 시트를 열어 첫 칸에 초점을 둔다 (미리 보기의 벤토에 바로 보인다)
		await editor.getByRole('tab', { name: '내용' }).click();
		await editor.getByRole('region', { name: '주요 기능' }).getByRole('button', { name: '더하기' }).click();
		const sheet = settings.getByRole('dialog', { name: '주요 기능 1' });
		await expect(sheet.getByRole('textbox', { name: '주요 기능 1 제목' })).toBeFocused();
		await page.keyboard.type('한 화면');
		await sheet.getByRole('textbox', { name: '주요 기능 1 설명' }).fill('할 일과 메모를 나란히 둔다.');
		await sheet.getByRole('button', { name: '완료' }).click();
		await expect(sheet).toHaveCount(0);
		await expect(
			editor.getByRole('region', { name: '주요 기능' }).getByRole('button', { name: '주요 기능 1 편집' })
		).toBeFocused();
		await expect(preview.getByRole('region', { name: '주요 기능' })).toContainText('한 화면');
		await editor.getByRole('tab', { name: '앱' }).click();
		await editor.getByRole('switch', { name: /이 사이트 안에서 창으로 열기/ }).check();
		await expect(editor.getByRole('textbox', { name: '앱 이름' })).toHaveValue('사이드 앱');
		await editor.getByRole('switch', { name: /Dock에 고정/ }).uncheck();
		// 앱 아이콘은 올린다 (올린 그림의 주소는 API의 /files/…)
		await editor.getByLabel('앱 아이콘 올리기').setInputFiles({
			name: 'app-icon.png',
			mimeType: 'image/png',
			buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		});
		await expect(editor.getByRole('textbox', { name: '앱 아이콘 주소' })).toHaveValue(/^http:\/\/api\.test\/files\//);
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
				stack: ['React', 'Vite', 'tiny-qr-kit'],
				language: 'TypeScript',
				period: '2025.01.02 – 진행 중',
				icon: '/imgs/projects/qru/icon.png',
				highlights: [{ title: '한 화면', body: '할 일과 메모를 나란히 둔다.' }],
				gallery: [
					{ src: shots[0], caption: '카드 화면' },
					{ src: shots[1], caption: 'create modal' },
				],
				app: { label: '사이드 앱', inDock: false, icon: expect.stringMatching(/^http:\/\/api\.test\/files\//) },
			},
		});

		// 새로고침하면 Launchpad에 앱이 생기고(Dock에 고정하지 않음), 열면 데모를 띄운다
		// 새로고침 (로딩 화면을 지나 바탕화면까지)
		await enterDesktop(page);
		await expect(dockItem(page, 'side-app')).toHaveCount(0);
		await openFromDock(page, 'side-app');
		await expect(page.frameLocator('iframe[title="사이드 앱"]').getByRole('heading')).toHaveText('새 앱 첫 화면');
		// Safari의 새 프로젝트 페이지에 넣은 그림이 화면 모음으로 보인다
		await dockItem(page, 'safari').click();
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /사이드 앱/ }).click();
		// 기본 모양(showcase) 페이지: 로고가 없으니 맨 위에 고른 아이콘과 이름, 대표 화면을 비웠으니 화면 더 보기의 첫 그림이 대표 화면
		const panel = safari.getByRole('tabpanel');
		await expect(panel.locator('.sp[data-look="showcase"]')).toBeVisible();
		await expect(panel.locator('.sc-hero .sc-logo')).toHaveCount(0);
		await expect(panel.locator('.sc-hero .sc-tile')).toHaveAttribute('src', '/imgs/projects/qru/icon.png');
		// 대표 화면을 비워 두었으니 화면 더 보기의 첫 그림이 맨 위의 떠 있는 화면이 된다
		await expect(panel.locator('.sc-hero-shot').first()).toHaveAttribute('src', shots[0]);
		await expect(panel.getByRole('region', { name: '화면 모음' }).locator('img')).toHaveCount(2);
		await expect(panel.getByRole('region', { name: '화면 모음' }).locator('img').first()).toHaveAttribute(
			'src',
			shots[0]
		);
		await expect(panel.locator('.sc-hero').getByRole('list', { name: '기술' }).getByRole('listitem')).toHaveText([
			// 주 언어가 기술 칩 맨 앞에 함께 나온다
			'TypeScript',
			'React',
			'Vite',
			'tiny-qr-kit',
		]);
		await expect(panel.getByRole('region', { name: '주요 기능' })).toContainText('한 화면');
		// 탭의 작은 아이콘은 고른 프로젝트 아이콘
		await expect(safari.getByRole('tab', { name: /사이드 앱/ }).locator('img')).toHaveAttribute(
			'src',
			'/imgs/projects/qru/icon.png'
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

	test('관리자: 새 프로젝트를 고른 페이지 모양의 예시로 채우고, 고쳐 쓰고, 저장한다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		await settings.getByRole('textbox', { name: '새 프로젝트 id' }).fill('pixel-farm');
		await settings.getByRole('button', { name: '더하기' }).click();
		const editor = settings.getByRole('form', { name: '새 프로젝트 편집' });
		await editor.getByRole('textbox', { name: '저장소' }).fill('https://github.com/hyeoniverse/pixel-farm');
		await editor.getByRole('radiogroup', { name: '페이지 모양' }).getByRole('radio', { name: 'RPG 대화창' }).click();

		// 이름을 이미 적었으면 예시로 바꿀지 한 번 묻는다
		await editor.getByRole('textbox', { name: '이름', exact: true }).fill('내 농장');
		await editor.getByRole('button', { name: '예시로 채우기' }).click();
		const confirm = page.getByRole('alertdialog', { name: '예시로 채울까요?' });
		await expect(confirm).toContainText('입력한 내용을 예시로 바꿉니다.');
		await confirm.getByRole('button', { name: '채우기' }).click();

		// RPG 대화창의 예시: 이름·큰 제목·기간이 채워지고, 저장소와 모양은 그대로
		await expect(editor.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('픽셀팜 – 농장 경영 게임');
		await expect(editor.getByRole('textbox', { name: '큰 제목' })).toHaveValue(
			'어서 와요! 오늘도 밭에 물 주러 왔나요?'
		);
		await expect(editor.getByRole('button', { name: /^시작일 2025\. 6\. 2\./ })).toBeVisible();
		await expect(editor.getByRole('textbox', { name: '저장소' })).toHaveValue(
			'https://github.com/hyeoniverse/pixel-farm'
		);
		await expect(editor.getByRole('radio', { name: 'RPG 대화창' })).toHaveAttribute('aria-checked', 'true');
		// 미리 보기의 대화창에 예시의 인사(큰 제목)가 보이고, 배경은 예시의 농장
		const preview = editor.getByRole('complementary', { name: '미리 보기' });
		await expect(preview.getByRole('dialog', { name: '대화' })).toContainText('오늘도 밭에 물 주러 왔나요?');
		await expect(preview.locator('.dl')).toHaveAttribute('data-theme', 'farm');

		// 내용 탭: 주요 기능·장·조작법이 예시로 채워져 있다. 줄을 눌러 시트를 열고 고쳐 쓴다
		await editor.getByRole('tab', { name: '내용' }).click();
		const form = editor.locator('.projects-editor-form');
		const highlights = form.getByRole('region', { name: '주요 기능', exact: true });
		await expect(highlights.getByRole('listitem')).toHaveCount(4);
		await highlights.getByRole('button', { name: '주요 기능 1 편집' }).click();
		const sheet = settings.getByRole('dialog', { name: '주요 기능 1' });
		await expect(sheet.getByRole('textbox', { name: '주요 기능 1 제목' })).toHaveValue('심고, 물 주고, 거두기');
		await expect(sheet.getByRole('textbox', { name: '주요 기능 1 자세히' })).not.toHaveValue('');
		await sheet.getByRole('textbox', { name: '주요 기능 1 제목' }).fill('씨앗부터 수확까지');
		await sheet.getByRole('button', { name: '완료' }).click();
		await expect(highlights.getByRole('listitem').first()).toContainText('씨앗부터 수확까지');
		await expect(form.getByRole('region', { name: '장', exact: true }).getByRole('listitem')).toHaveCount(2);
		// 조작법은 그 모양(RPG 대화창)에서만 쓰는 칸이라 소개 탭의 페이지 모양 아래에 있다
		await expect(editor.getByRole('textbox', { name: '조작법 1 키' })).toHaveCount(0);
		await editor.getByRole('tab', { name: '소개' }).click();
		await expect(editor.getByRole('textbox', { name: '조작법 1 키' })).toHaveValue('↑, ↓, ←, →');

		await editor.getByRole('button', { name: '완료' }).click();
		await expect(editor).toBeHidden();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();

		// 저장한 덮어쓰기는 서버와 같은 규칙을 그대로 통과한다
		const saved = api.siteProjects?.items.find((item) => item.id === 'pixel-farm');
		expect(saved?.override).toMatchObject({
			name: '픽셀팜 – 농장 경영 게임',
			look: 'dialogue',
			url: 'https://github.com/hyeoniverse/pixel-farm',
			backdrop: { theme: 'farm' },
			highlights: expect.arrayContaining([expect.objectContaining({ title: '씨앗부터 수확까지' })]),
		});
		const parsed = parseProjects({ items: [saved] });
		expect('errors' in parsed ? parsed.errors : []).toEqual([]);
		expect('value' in parsed && parsed.value.items[0].override).toEqual(saved?.override);
	});

	test('관리자: 내용 탭의 목록은 ＋로 더하고, 손잡이를 끌거나 ⌥↑로 옮기고, 표는 −로, 항목은 시트의 항목 삭제로 빼고, 그림을 크게 본다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'QRU' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'QRU 큐알유 편집' });
		await editor.getByRole('tab', { name: '내용' }).click();
		// 미리 보기에도 같은 이름의 영역이 있어 폼 쪽만 본다
		const form = editor.locator('.projects-editor-form');

		// 두 칸 표 (기술 사양): ＋는 끝에 빈 줄을 더하고 첫 칸에 초점을 둔다
		const specs = form.getByRole('region', { name: '기술 사양' });
		const specRows = specs.getByRole('row');
		const count = await specRows.count();
		await specs.getByRole('button', { name: '더하기' }).click();
		await expect(specRows).toHaveCount(count + 1);
		await expect(editor.getByRole('textbox', { name: `기술 사양 ${count + 1} 분류` })).toBeFocused();
		await page.keyboard.type('시험');
		await editor.getByRole('textbox', { name: `기술 사양 ${count + 1} 기술` }).fill('Playwright');
		// 줄에 초점을 두고 ⌥↑: 한 칸 위로 (고른 줄도 따라간다)
		await specRows.nth(count).focus();
		await page.keyboard.press('Alt+ArrowUp');
		await expect(editor.getByRole('textbox', { name: `기술 사양 ${count} 분류` })).toHaveValue('시험');
		await expect(specRows.nth(count - 1)).toHaveAttribute('aria-selected', 'true');
		// −: 고른 줄을 뺀다
		await specs.getByRole('button', { name: '빼기' }).click();
		await expect(specRows).toHaveCount(count);
		await expect(editor.getByRole('textbox', { name: `기술 사양 ${count} 분류` })).not.toHaveValue('시험');

		// 주요 기능: 줄 전체가 단추다. 줄을 한 번 누르면 그 항목의 시트가 열린다 (ⓘ 단추는 없다)
		const highlights = form.getByRole('region', { name: '주요 기능' });
		const rows = highlights.getByRole('listitem');
		const total = await rows.count();
		const first = await editor.locator('.projects-point strong').first().textContent();
		await expect(highlights.locator('.projects-info-button')).toHaveCount(0);
		await rows.nth(1).click();
		const sheet = settings.getByRole('dialog', { name: '주요 기능 2' });
		const second = await sheet.getByRole('textbox', { name: '주요 기능 2 제목' }).inputValue();
		expect(second).not.toBe('');
		// 그림을 누르면 크게 보고, Esc로 그림만 닫는다 (시트는 그대로)
		await sheet.getByRole('button', { name: '주요 기능 2 그림 크게 보기' }).click();
		const lightbox = page.getByRole('dialog', { name: '그림 크게 보기' });
		await expect(lightbox.locator('img')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(lightbox).toHaveCount(0);
		await expect(sheet).toBeVisible();
		await sheet.getByRole('button', { name: '완료' }).click();
		await expect(sheet).toHaveCount(0);
		await expect(highlights.getByRole('button', { name: '주요 기능 2 편집' })).toBeFocused();
		// 첫 줄의 ≡ 손잡이를 끌어 둘째 줄 아래로 놓으면 순서가 바뀐다 (시트는 열리지 않는다)
		await rows.nth(0).scrollIntoViewIfNeeded();
		const handle = await highlights.getByRole('button', { name: '주요 기능 1 순서 바꾸기' }).boundingBox();
		const to = await rows.nth(1).boundingBox();
		await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
		await page.mouse.down();
		await page.mouse.move(handle!.x + handle!.width / 2, to!.y + to!.height * 0.9, { steps: 8 });
		await page.mouse.up();
		await expect(settings.locator('.projects-sheet')).toHaveCount(0);
		await expect(rows.nth(0).locator('.projects-point strong')).toHaveText(second);
		await expect(rows.nth(1).locator('.projects-point strong')).toHaveText(first!);
		// 손잡이에 초점을 두고 ⌥↓·↑: 한 칸씩 옮기고, 초점은 옮긴 줄의 손잡이를 따라간다
		await highlights.getByRole('button', { name: '주요 기능 1 순서 바꾸기' }).focus();
		await page.keyboard.press('Alt+ArrowDown');
		await expect(rows.nth(1).locator('.projects-point strong')).toHaveText(second);
		await expect(highlights.getByRole('button', { name: '주요 기능 2 순서 바꾸기' })).toBeFocused();
		await page.keyboard.press('ArrowUp');
		await expect(rows.nth(0).locator('.projects-point strong')).toHaveText(second);
		await expect(highlights.getByRole('button', { name: '주요 기능 1 순서 바꾸기' })).toBeFocused();
		// 줄 단추에서 ⌥↑도 순서를 바꾼다 (초점은 옮긴 줄을 따라간다)
		await highlights.getByRole('button', { name: '주요 기능 2 편집' }).focus();
		await page.keyboard.press('Alt+ArrowUp');
		await expect(rows.nth(0).locator('.projects-point strong')).toHaveText(first!);
		await expect(highlights.getByRole('button', { name: '주요 기능 1 편집' })).toBeFocused();
		await page.keyboard.press('Alt+ArrowDown');
		await expect(rows.nth(0).locator('.projects-point strong')).toHaveText(second);
		// 목록 아래에는 ＋만 있다 (−는 칸을 바로 고치는 표에만). 마지막 항목은 시트의 항목 삭제로 지우고, 초점은 앞 줄로
		await expect(highlights.getByRole('button', { name: '빼기' })).toHaveCount(0);
		await highlights.getByRole('button', { name: `주요 기능 ${total} 편집` }).click();
		const last = settings.getByRole('dialog', { name: `주요 기능 ${total}` });
		await last.getByRole('button', { name: '항목 삭제' }).click();
		await expect(last).toHaveCount(0);
		await expect(rows).toHaveCount(total - 1);
		await expect(highlights.getByRole('button', { name: `주요 기능 ${total - 1} 편집` })).toBeFocused();
		// 비어 있던 쓰는 법: ＋로 더한 항목을 바로 지우면 목록이 비고, 초점은 ＋로
		const usage = form.getByRole('region', { name: '쓰는 법' });
		await usage.getByRole('button', { name: '더하기' }).click();
		await settings.getByRole('dialog', { name: '쓰는 법 1' }).getByRole('button', { name: '항목 삭제' }).click();
		await expect(usage.getByRole('listitem')).toHaveCount(0);
		await expect(usage.getByRole('button', { name: '더하기' })).toBeFocused();

		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		const saved = api.siteProjects?.items.find((item) => item.id === 'qru')?.override as {
			highlights?: { title: string }[];
			usage?: unknown[];
		};
		expect(saved.highlights?.slice(0, 2).map((point) => point.title)).toEqual([second, first]);
		expect(saved.highlights).toHaveLength(total - 1);
		expect(saved.usage).toBeUndefined();
	});

	test('관리자: 목록의 항목은 시트에서 고친다. Esc로 닫으면 그 줄로 돌아가고, 장 안 항목은 같은 시트의 다음 페이지로 연다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'QRU' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'QRU 큐알유 편집' });
		await editor.getByRole('tab', { name: '내용' }).click();
		const form = editor.locator('.projects-editor-form');

		// 줄을 눌러 연 시트: 제목은 항목 이름, 첫 칸에 초점
		const highlights = form.getByRole('region', { name: '주요 기능' });
		await highlights.getByRole('button', { name: '주요 기능 2 편집' }).click();
		const sheet = settings.getByRole('dialog', { name: '주요 기능 2' });
		await expect(sheet).toHaveAttribute('aria-modal', 'true');
		await expect(sheet.getByRole('heading', { name: '주요 기능 2' })).toBeVisible();
		const title = sheet.getByRole('textbox', { name: '주요 기능 2 제목' });
		await expect(title).toBeFocused();
		// 초점은 시트 안을 돈다: 처음에서 ⇧Tab이면 끝의 완료로, 거기서 Tab이면 다시 처음으로
		await page.keyboard.press('Shift+Tab');
		await expect(sheet.getByRole('button', { name: '완료' })).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(title).toBeFocused();
		// Esc로 닫으면 연 줄에 초점이 돌아오고, 그 줄에서 Enter로 다시 연다 (Space도 같다)
		await page.keyboard.press('Escape');
		await expect(sheet).toHaveCount(0);
		const secondRow = highlights.getByRole('button', { name: '주요 기능 2 편집' });
		await expect(secondRow).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(title).toBeFocused();
		await page.keyboard.press('Escape');
		await expect(secondRow).toBeFocused();
		await page.keyboard.press('Space');
		await expect(title).toBeFocused();
		// 아래 막대는 왼쪽에 항목 삭제, 오른쪽에 완료
		const remove = await sheet.getByRole('button', { name: '항목 삭제' }).boundingBox();
		const done = await sheet.getByRole('button', { name: '완료' }).boundingBox();
		expect(remove!.x).toBeLessThan(done!.x);
		await page.keyboard.press('Escape');
		await expect(sheet).toHaveCount(0);

		// 장의 시트 안에서 장 안 항목을 열면 시트를 겹치지 않고 같은 시트에 다음 페이지를 민다 (왼쪽 위에 뒤로 단추)
		const chapters = form.getByRole('region', { name: '장', exact: true });
		await chapters.getByRole('button', { name: '장 1 편집' }).click();
		const chapterSheet = settings.getByRole('dialog', { name: '장 1' });
		const points = chapterSheet.getByRole('group', { name: '장 1 항목' });
		await points.getByRole('button', { name: '장 1 항목 2 편집' }).click();
		await expect(settings.locator('.projects-sheet')).toHaveCount(1);
		await expect(chapterSheet.getByRole('heading', { name: '장 1 항목 2' })).toBeVisible();
		await expect(chapterSheet.getByRole('textbox', { name: '장 1 제목' })).toBeHidden();
		const pointTitle = chapterSheet.getByRole('textbox', { name: '장 1 항목 2 제목' });
		await expect(pointTitle).toHaveValue('복합 색인 0개');
		await expect(pointTitle).toBeFocused();
		await pointTitle.fill('색인 없이 찾기');
		// 뒤로: 장의 페이지로 돌아오고, 연 줄에 초점과 고친 제목
		await chapterSheet.getByRole('button', { name: '뒤로 (장 1)' }).click();
		await expect(chapterSheet.getByRole('heading', { name: '장 1 항목 2' })).toHaveCount(0);
		await expect(chapterSheet.getByRole('textbox', { name: '장 1 제목' })).toBeVisible();
		await expect(points.getByRole('button', { name: '장 1 항목 2 편집' })).toBeFocused();
		await expect(points.getByRole('listitem').nth(1)).toContainText('색인 없이 찾기');
		// 밀린 페이지의 항목 삭제는 그 페이지의 항목(장 안 항목)만 지우고 장의 페이지로 돌아온다
		const pointCount = await points.getByRole('listitem').count();
		await points.getByRole('button', { name: '더하기' }).click();
		await expect(chapterSheet.getByRole('heading', { name: `장 1 항목 ${pointCount + 1}` })).toBeVisible();
		await chapterSheet.getByRole('button', { name: '항목 삭제' }).click();
		await expect(chapterSheet).toBeVisible();
		await expect(chapterSheet.getByRole('textbox', { name: '장 1 제목' })).toBeVisible();
		await expect(points.getByRole('listitem')).toHaveCount(pointCount);
		await expect(points.getByRole('button', { name: `장 1 항목 ${pointCount} 편집` })).toBeFocused();
		await chapterSheet.getByRole('button', { name: '완료' }).click();
		await expect(chapterSheet).toHaveCount(0);

		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		const saved = api.siteProjects?.items.find((item) => item.id === 'qru')?.override as {
			chapters: { points: { title: string }[] }[];
		};
		expect(saved.chapters[0].points[1].title).toBe('색인 없이 찾기');
	});

	test('관리자: RPG 대화창의 배경 테마와 배경 그림을 고르면 미리 보기의 장면이 바뀐다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'QRU' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'QRU 큐알유 편집' });
		// 대화창 배경은 그 모양에서만 쓰는 칸이라, 다른 모양에서는 보이지 않는다
		await expect(editor.getByRole('combobox', { name: '배경 테마' })).toHaveCount(0);
		// 페이지 모양은 그림 카드에서 고른다 (라디오). 고르면 그 아래에 그 모양의 칸이 나온다
		await editor.getByRole('radio', { name: 'RPG 대화창' }).click();
		await expect(editor.getByRole('radio', { name: 'RPG 대화창' })).toHaveAttribute('aria-checked', 'true');
		const scene = editor.getByRole('complementary', { name: '미리 보기' }).locator('.dl');
		// 코드의 기본값: QRU는 사무실
		await expect(scene).toHaveAttribute('data-theme', 'office');

		const theme = editor.getByRole('combobox', { name: '배경 테마' });
		await expect(theme).toHaveValue('office');
		await theme.selectOption('sea');
		await expect(scene).toHaveAttribute('data-theme', 'sea');
		// 테마를 고르고 배경 그림이 없으면 픽셀 그림을 깔지 않는다
		await expect(scene.locator('.dl-pixel canvas')).toHaveCount(0);

		// 배경 그림을 고르면 픽셀로 바꿔 하늘 자리에 깐다
		await editor.getByRole('combobox', { name: '배경 그림 고르기' }).selectOption('/imgs/projects/qru/screenshot.jpg');
		await expect(scene.locator('.dl-pixel canvas')).toHaveCount(1);
		await expect(scene).toHaveAttribute('data-pixel', '');
		await expect(editor.getByRole('textbox', { name: '배경 그림 주소' })).toHaveValue(
			'/imgs/projects/qru/screenshot.jpg'
		);

		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		expect(api.siteProjects?.items.find((item) => item.id === 'qru')?.override).toMatchObject({
			look: 'dialogue',
			backdrop: { theme: 'sea', image: '/imgs/projects/qru/screenshot.jpg' },
		});
	});

	test('관리자: 페이지 모양만 바꾸면 새로고침 없이 열려 있는 Safari 탭이 바로 바뀐다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'safari').click();
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /QRU/ }).click();
		const article = safari.getByRole('tabpanel').getByRole('article', { name: 'QRU 큐알유' });
		await expect(article).toHaveAttribute('data-look', 'minimal');

		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'QRU' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'QRU 큐알유 편집' });
		await editor
			.getByRole('radiogroup', { name: '페이지 모양' })
			.getByRole('radio', { name: /RPG 대화창/ })
			.click();
		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		const saved = settings.getByRole('status').filter({ hasText: '저장했습니다' });
		await expect(saved).toContainText('모든 화면에 바로 적용했습니다.');
		await expect(settings.getByRole('button', { name: '지금 새로고침' })).toHaveCount(0);
		await expect(article).toHaveAttribute('data-look', 'dialogue');
	});

	test('관리자: 이미 있는 주요 기능에 그림을 넣으면 다크 그림·갈래 도식 대신 그 그림이 Safari 페이지에 보인다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'HYEONIVERSE' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'HYEONIVERSE 편집' });
		await editor.getByRole('tab', { name: '내용' }).click();
		const rows = editor
			.locator('.projects-editor-form')
			.getByRole('region', { name: '주요 기능' })
			.getByRole('listitem');
		// 1: 라이트·다크 짝 그림이 있던 항목, 2: 그림 없이 갈래 도식만 있던 항목
		const picks = ['/imgs/projects/qru/screens/card.jpg', '/imgs/projects/qru/screens/create-modal.jpg'];
		for (const [i, src] of picks.entries()) {
			await rows
				.nth(i)
				.getByRole('button', { name: `주요 기능 ${i + 1} 편집` })
				.click();
			const sheet = settings.getByRole('dialog', { name: `주요 기능 ${i + 1}` });
			await sheet.getByRole('combobox', { name: `주요 기능 ${i + 1} 그림 고르기` }).selectOption(src);
			await sheet.getByRole('button', { name: '완료' }).click();
			await expect(rows.nth(i).locator('img')).toHaveAttribute('src', src);
		}
		// 4: 영상이 있는 항목은 영상이 먼저 보인다고 알려 준다
		await rows.nth(3).getByRole('button', { name: '주요 기능 4 편집' }).click();
		const videoSheet = settings.getByRole('dialog', { name: '주요 기능 4' });
		await expect(videoSheet).toContainText('영상이 있으면 그림 대신 영상이 보입니다.');
		await videoSheet.getByRole('button', { name: '완료' }).click();
		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		const saved = api.siteProjects?.items.find((item) => item.id === 'hyeoniverse')?.override as {
			highlights: { image?: string; imageDark?: string }[];
		};
		expect(saved.highlights.slice(0, 2).map((point) => point.image)).toEqual(picks);
		expect(saved.highlights[0].imageDark).toBeUndefined();

		await dockItem(page, 'safari').click();
		const safari = appWindow(page, 'safari');
		await safari.getByRole('tab', { name: /HYEONIVERSE/ }).click();
		const features = safari.getByRole('region', { name: '주요 기능' });
		for (const src of picks) await expect(features.locator(`img[src="${src}"]`)).toHaveCount(1);
	});

	test('직접 짠 페이지(칸반·터미널)도 주요 기능의 그림을 보여 준다', async ({ page }) => {
		const image = '/imgs/projects/qru/screens/card.jpg';
		const api = await fakeApi(page);
		api.siteProjects = {
			items: ['whattodo', 'devcourse'].map((id) => ({
				id,
				override: { highlights: [{ title: '그림 있는 기능', body: '그림을 함께 보여 줍니다.', image }] },
			})),
		};
		await enterDesktop(page);
		await dockItem(page, 'safari').click();
		const safari = appWindow(page, 'safari');
		const shot = safari.getByRole('tabpanel').locator(`img[src="${image}"]`);
		await safari.getByRole('tab', { name: /WTD/ }).click();
		await expect(shot.first()).toBeAttached();
		// 터미널은 projects 명령을 친 결과에 보인다
		await safari.getByRole('tab', { name: /DevCourse/ }).click();
		await safari.getByRole('tabpanel').getByRole('button', { name: 'projects', exact: true }).first().click();
		await expect(shot.first()).toBeVisible();
	});

	test('관리자: 그림 탭에서 대표 화면을 바꿔 저장하면 그 그림이 대표 화면으로 저장된다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openProjectsPane(page);
		await settings.getByRole('button', { name: '편집', exact: true }).click();
		const list = settings.getByRole('list', { name: '프로젝트' });
		await list.getByRole('listitem').filter({ hasText: 'QRU' }).getByRole('button', { name: '편집' }).click();
		const editor = settings.getByRole('form', { name: 'QRU 큐알유 편집' });
		await editor.getByRole('tab', { name: '그림' }).click();
		const address = editor.getByRole('textbox', { name: '대표 화면 주소' });
		await expect(address).not.toHaveValue('');
		const next = '/imgs/projects/qru/screens/create-modal.jpg';
		await editor.getByRole('combobox', { name: '대표 화면 고르기' }).selectOption(next);
		await expect(address).toHaveValue(next);
		await editor.getByRole('button', { name: '완료' }).click();
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(settings.getByRole('status').filter({ hasText: '저장했습니다' })).toBeVisible();
		const saved = api.siteProjects?.items.find((item) => item.id === 'qru')?.override as { image?: string };
		expect(saved.image).toBe(next);
	});
});
