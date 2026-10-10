import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

const HONG = {
	name: '홍길동',
	nameEn: 'Hong Gil Dong',
	role: 'Backend Developer',
	school: '한국대학교',
	location: 'Busan, South Korea',
	github: 'https://github.com/gildong',
	email: 'gildong@example.com',
	skills: { frontend: ['Vue'], backend: ['Go', 'PostgreSQL'], interaction: [] },
	siteStack: ['React 19'],
};

async function openAboutPane(page: Page) {
	await dockItem(page, 'settings').click();
	const settings = appWindow(page, 'settings');
	await settings.getByRole('button', { name: '정보', exact: true }).click();
	return settings;
}

async function openAboutThisMac(page: Page) {
	await page.getByRole('button', { name: 'Apple 메뉴', exact: true }).click();
	await page.getByRole('menuitem', { name: '이 Mac에 관하여' }).click();
	return page.getByRole('dialog', { name: '이 Mac에 관하여' });
}

test.describe('사이트 주인의 프로필', () => {
	test('서버에 저장한 프로필이 있으면 방문자에게 그 프로필이 보이고, 편집 단추는 없다', async ({ page }) => {
		const api = await fakeApi(page);
		api.siteProfile = HONG;
		await enterDesktop(page);

		const about = await openAboutThisMac(page);
		await expect(about.getByRole('heading', { name: '홍길동' })).toBeVisible();
		await expect(about.locator('.about-mac-specs > div')).toHaveText([
			'직무Backend Developer',
			'학교한국대학교',
			'위치Busan, South Korea',
			'이메일gildong@example.com (메일 앱에서 쓰기)',
			'GitHubgildong (새 탭)',
			'주요 기술Vue',
		]);
		await expect(about).toContainText('© 2026 Hong Gil Dong.');
		await about.getByRole('button', { name: '닫기' }).click();

		const settings = await openAboutPane(page);
		await expect(settings.getByRole('region', { name: '프로필' })).toContainText('이름홍길동 (Hong Gil Dong)');
		// 비운 묶음(인터랙션)은 줄째 빠진다
		await expect(settings.getByRole('region', { name: '기술' }).locator('dl > div')).toHaveText([
			'프론트엔드Vue',
			'백엔드Go · PostgreSQL',
		]);
		await expect(settings.getByRole('button', { name: '편집' })).toHaveCount(0);

		// 메일의 환영 메일과 메시지의 고정 안내도 그 이름으로
		await dockItem(page, 'mail').click();
		const mail = appWindow(page, 'mail');
		await expect(mail.getByRole('region', { name: '받은 편지함' })).toContainText('홍길동');
		await expect(mail.getByRole('button', { name: 'gildong@example.com (눌러서 이메일 주소 복사)' })).toBeVisible();
		await dockItem(page, 'messages').click();
		await expect(appWindow(page, 'messages')).toContainText('안녕하세요, 홍길동입니다 👋');
	});

	test('관리자는 시스템 설정 › 정보에서 고치고, 규칙에 어긋나면 이유를 모두 보고, 기본값으로 되돌린다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		const settings = await openAboutPane(page);
		await settings.getByRole('button', { name: '편집' }).click();
		const form = settings.getByRole('form', { name: '프로필 편집' });
		await expect(form.getByRole('textbox', { name: '이름', exact: true })).toHaveValue('김정현');
		await expect(form.getByRole('textbox', { name: '프론트엔드' })).toHaveValue(
			'React, Next.js, TypeScript, JavaScript, TailwindCSS, Zustand'
		);
		// 기술 칸은 쉼표로 나눠 쓴다는 안내를 칸 아래에 따로 둔다 (제목에 붙이지 않는다)
		await expect(form.getByRole('region', { name: '기술', exact: true })).toBeVisible();
		await expect(form.getByRole('textbox', { name: '프론트엔드' })).toHaveAccessibleDescription(
			'쉼표(,)로 나눠 씁니다. 예: React, TypeScript, Vite'
		);
		// 저장한 값이 없으면 되돌릴 것도 없다
		await expect(form.getByRole('button', { name: '기본값으로 되돌리기' })).toHaveCount(0);

		// 이름을 비우고 이메일을 틀리면, 서버에 보내지 않고 이유를 모두 보여 준다
		await form.getByRole('textbox', { name: '이름', exact: true }).fill('');
		await form.getByRole('textbox', { name: '이메일' }).fill('gildong');
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(form.getByRole('alert')).toHaveText(
			['이름을(를) 입력해 주세요.', '이메일 주소가 올바르지 않습니다.'].join('')
		);
		expect(api.siteProfile).toBeNull();

		await form.getByRole('textbox', { name: '이름', exact: true }).fill('홍길동');
		await form.getByRole('textbox', { name: '영문 이름' }).fill('Hong Gil Dong');
		await form.getByRole('textbox', { name: '이메일' }).fill('gildong@example.com');
		await form.getByRole('textbox', { name: 'GitHub 주소' }).fill('https://github.com/gildong/');
		await form.getByRole('textbox', { name: '프론트엔드' }).fill(' Vue ,  , Svelte, Vue');
		await settings.getByRole('button', { name: '완료' }).click();
		await expect(form).toBeHidden();
		await expect(page.getByRole('status').filter({ hasText: '프로필을 저장했습니다' })).toBeVisible();
		// 다듬어서(공백·빈 항목·겹친 항목, 끝의 /) 저장한다
		expect(api.siteProfile).toMatchObject({
			name: '홍길동',
			email: 'gildong@example.com',
			github: 'https://github.com/gildong',
			skills: { frontend: ['Vue', 'Svelte'] },
		});
		await expect(settings.getByRole('region', { name: '프로필' })).toContainText('이름홍길동 (Hong Gil Dong)');
		await expect(settings.getByRole('region', { name: '기술' })).toContainText('프론트엔드Vue · Svelte');

		// 새로고침하지 않아도 다른 곳이 바로 바뀐다
		const about = await openAboutThisMac(page);
		await expect(about.getByRole('heading', { name: '홍길동' })).toBeVisible();
		await expect(about.getByRole('link', { name: 'gildong (새 탭)' })).toHaveAttribute(
			'href',
			'https://github.com/gildong'
		);
		await about.getByRole('button', { name: '닫기' }).click();

		// 기본값으로 되돌리기: 한 번 더 묻고, 코드의 프로필로
		await settings.getByRole('button', { name: '편집' }).click();
		await form.getByRole('button', { name: '기본값으로 되돌리기' }).click();
		const dialog = page.getByRole('alertdialog', { name: '기본 프로필로 되돌릴까요?' });
		await dialog.getByRole('button', { name: '되돌리기' }).click();
		await expect(form).toBeHidden();
		expect(api.siteProfile).toBeNull();
		await expect(settings.getByRole('region', { name: '프로필' })).toContainText('이름김정현 (Kim Jeong Hyeon)');
	});
});
