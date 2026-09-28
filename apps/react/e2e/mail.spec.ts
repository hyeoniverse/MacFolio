import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';

/** 실제 메일 앱이 열리지 않도록 window.open을 가로채 연 주소만 기록한다 */
async function openMail(page: Page) {
	await page.addInitScript(() => {
		(window as unknown as { __opened: string[] }).__opened = [];
		window.open = (url?: string | URL) => {
			(window as unknown as { __opened: string[] }).__opened.push(String(url));
			return null;
		};
	});
	await enterDesktop(page);
	await dockItem(page, 'mail').click();
	return appWindow(page, 'mail');
}

const opened = (page: Page) => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

test.describe('메일', () => {
	test('받은 편지함에 환영 메일이 있고, 열면 본문이 보인다', async ({ page }) => {
		const mail = await openMail(page);
		await expect(mail.getByRole('region', { name: '받은 편지함' })).toContainText('방문해 주셔서 감사합니다!');
		await expect(mail.getByRole('article', { name: '방문해 주셔서 감사합니다!' })).toContainText('편하게 연락 주세요');
	});

	test('필수 입력이 비었거나 이메일 형식이 틀리면 보내지 않는다', async ({ page }) => {
		const mail = await openMail(page);
		await mail.getByRole('button', { name: '새로운 메시지' }).click();
		await mail.getByLabel('이름').fill('민수');
		await mail.getByLabel('회신 주소').fill('minsu@');
		await mail.getByRole('button', { name: /보내기/ }).click();

		await expect(mail.getByText('이메일 형식을 확인해주세요.')).toBeVisible();
		await expect(mail.getByText('제목을 입력해주세요.')).toBeVisible();
		await expect(mail.getByText('내용을 입력해주세요.')).toBeVisible();
		expect(await opened(page)).toEqual([]);

		// 고치면 해당 필드의 오류가 사라진다
		await mail.getByLabel('회신 주소').fill('minsu@example.com');
		await expect(mail.getByText('이메일 형식을 확인해주세요.')).toBeHidden();
	});

	test('보내면 작성한 내용이 채워진 메일 앱을 열고, 안내와 주소 복사를 보여준다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const mail = await openMail(page);
		await mail.getByRole('button', { name: '새로운 메시지' }).click();
		await mail.getByLabel('이름').fill('민수');
		await mail.getByLabel('회신 주소').fill('minsu@example.com');
		await mail.getByLabel('제목').fill('채용 문의 & 협업');
		await mail.getByLabel('내용').fill('안녕하세요!\n연락드립니다.');
		await mail.getByRole('button', { name: /보내기/ }).click();

		const [url] = await opened(page);
		expect(url).toMatch(/^mailto:hyeoniverse\.dev@gmail\.com\?/);
		const params = new URLSearchParams(url.split('?')[1]);
		expect(params.get('subject')).toBe('채용 문의 & 협업');
		expect(params.get('body')).toContain('보낸 사람: 민수 <minsu@example.com>');

		const result = mail.getByRole('region', { name: '보내기 결과' });
		await expect(result).toContainText('메일 앱에서 보내기를 눌러 주세요');
		await result.getByRole('button', { name: /복사/ }).click();
		await expect(result.getByRole('button', { name: '복사했어요' })).toBeVisible();
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('hyeoniverse.dev@gmail.com');

		await result.getByRole('button', { name: '확인' }).click();
		await expect(mail.getByRole('article', { name: '방문해 주셔서 감사합니다!' })).toBeVisible();
	});

	test('쓰기는 취소 버튼이나 Esc로 그만둔다', async ({ page }) => {
		const mail = await openMail(page);
		await mail.getByRole('button', { name: '새로운 메시지' }).click();
		await mail.getByRole('button', { name: '취소' }).click();
		await expect(mail.getByRole('form', { name: '새로운 메시지' })).toBeHidden();

		await mail.getByRole('button', { name: /에게 답장/ }).click();
		await expect(mail.getByRole('form', { name: '새로운 메시지' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(mail.getByRole('form', { name: '새로운 메시지' })).toBeHidden();
	});
});
