import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeApi } from './fakeApi';

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

	test('사이트 주인의 주소를 누르면 이메일 주소를 복사한다 (새로운 메시지의 받는 사람, 환영 메일의 보낸 사람)', async ({
		page,
		context,
	}) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const mail = await openMail(page);
		const clipboard = () => page.evaluate(() => navigator.clipboard.readText());

		// 환영 메일의 보낸 사람 주소
		const article = mail.getByRole('article', { name: '방문해 주셔서 감사합니다!' });
		const sender = article.getByRole('button', { name: 'hyeoniverse.dev@gmail.com (눌러서 이메일 주소 복사)' });
		await sender.click();
		await expect(sender.getByRole('status')).toHaveText('복사했어요');
		expect(await clipboard()).toBe('hyeoniverse.dev@gmail.com');
		// 잠깐 뒤 말풍선은 사라진다
		await expect(sender.getByRole('status')).toHaveCount(0);

		// 새로운 메시지의 받는 사람: 이름 없이 주소만 복사한다
		await page.evaluate(() => navigator.clipboard.writeText(''));
		await mail.getByRole('button', { name: '새로운 메시지' }).click();
		const recipient = mail.getByRole('button', {
			name: '김정현 <hyeoniverse.dev@gmail.com> (눌러서 이메일 주소 복사)',
		});
		await recipient.click();
		await expect(recipient.getByRole('status')).toHaveText('복사했어요');
		expect(await clipboard()).toBe('hyeoniverse.dev@gmail.com');
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

	test.describe('서버가 보낸다 (#25)', () => {
		const write = async (page: Page) => {
			const mail = appWindow(page, 'mail');
			await mail.getByRole('button', { name: '새로운 메시지' }).click();
			await mail.getByLabel('이름').fill('민수');
			await mail.getByLabel('회신 주소').fill('minsu@example.com');
			await mail.getByLabel('제목').fill('포트폴리오 잘 봤습니다');
			await mail.getByLabel('내용').fill('안녕하세요!');
			return mail;
		};

		test('서버가 보낼 수 있으면 메일 앱을 열지 않고 서버가 보낸다', async ({ page }) => {
			const api = await fakeApi(page);
			await openMail(page);
			const mail = await write(page);
			await mail.getByRole('button', { name: /보내기/ }).click();

			await expect(mail.getByRole('region', { name: '보내기 결과' })).toContainText('메일을 보냈어요');
			expect(api.contact.sent).toEqual([
				{ name: '민수', email: 'minsu@example.com', subject: '포트폴리오 잘 봤습니다', body: '안녕하세요!' },
			]);
			expect(await opened(page)).toEqual([]);
		});

		test('사람 확인(Turnstile)을 켰으면 확인이 끝난 뒤 토큰과 함께 보낸다', async ({ page }) => {
			const api = await fakeApi(page);
			api.contact.turnstileSiteKey = '1x00000000000000000000AA';
			// 바깥 스크립트 대신: 그리자마자 확인이 끝났다고 알리는 Turnstile
			await page.route('https://challenges.cloudflare.com/turnstile/**', (route) =>
				route.fulfill({
					contentType: 'text/javascript',
					body: `window.turnstile = { render(el, o) { el.textContent = '사람 확인 완료'; setTimeout(() => o.callback('test-token'), 50); return 'w1'; }, remove() {} };`,
				})
			);
			await openMail(page);
			const mail = await write(page);
			await expect(mail.getByText('사람 확인 완료')).toBeVisible();
			await mail.getByRole('button', { name: /보내기/ }).click();

			await expect(mail.getByRole('region', { name: '보내기 결과' })).toContainText('메일을 보냈어요');
			expect(api.contact.sent[0]).toMatchObject({ subject: '포트폴리오 잘 봤습니다', turnstileToken: 'test-token' });
		});

		test('서버에 메일 설정이 없으면(503) 메일 앱으로 넘긴다', async ({ page }) => {
			const api = await fakeApi(page);
			api.contact.enabled = false;
			await openMail(page);
			const mail = await write(page);
			await mail.getByRole('button', { name: /보내기/ }).click();

			await expect(mail.getByRole('region', { name: '보내기 결과' })).toContainText('메일 앱에서 보내기를 눌러 주세요');
			expect((await opened(page))[0]).toMatch(/^mailto:hyeoniverse\.dev@gmail\.com\?/);
		});

		test('서버가 거절하면 이유를 보여 주고 쓰던 글은 그대로', async ({ page }) => {
			const api = await fakeApi(page);
			api.contact.reject = { status: 429, message: '오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.' };
			await openMail(page);
			const mail = await write(page);
			await mail.getByRole('button', { name: /보내기/ }).click();

			await expect(mail.getByRole('alert')).toHaveText('오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.');
			await expect(mail.getByLabel('내용')).toHaveValue('안녕하세요!');
			expect(api.contact.sent).toEqual([]);
		});
	});

	test.describe('보낸 편지함과 관리자 받은 편지함', () => {
		test('보낸 메일은 이 브라우저의 보낸 편지함에 들어간다 (처음에는 비어 있다)', async ({ page }) => {
			await fakeApi(page);
			const mail = await openMail(page);
			await mail.getByRole('button', { name: '보낸 편지함' }).click();
			await expect(mail.getByText('보낸 메일이 없습니다. 이 브라우저에서 보낸 메일만 보입니다.')).toBeVisible();

			await mail.getByRole('button', { name: '새로운 메시지' }).click();
			await mail.getByLabel('이름').fill('민수');
			await mail.getByLabel('회신 주소').fill('minsu@example.com');
			await mail.getByLabel('제목').fill('포트폴리오 잘 봤습니다');
			await mail.getByLabel('내용').fill('안녕하세요!');
			await mail.getByRole('button', { name: /보내기/ }).click();
			await mail.getByRole('region', { name: '보내기 결과' }).getByRole('button', { name: '확인' }).click();

			const list = mail.getByRole('region', { name: '보낸 편지함' });
			await expect(list.locator('.mail-item')).toHaveCount(1);
			await list.locator('.mail-item', { hasText: '포트폴리오 잘 봤습니다' }).click();
			const article = mail.getByRole('article', { name: '포트폴리오 잘 봤습니다' });
			await expect(article).toContainText('받는 사람: 김정현 <hyeoniverse.dev@gmail.com>');
			// 방문자는 답장을 쓸 수 없다
			await expect(article.getByRole('form', { name: '답장 쓰기' })).toHaveCount(0);
		});

		test('주인이 답장하면 보낸 편지함의 그 메일 아래에 보인다', async ({ page }) => {
			const api = await fakeApi(page);
			api.contact.mine = [
				{
					id: 'mail-1',
					name: '민수',
					email: 'minsu@example.com',
					subject: '채용 제안드립니다',
					body: '이야기 나눠 보고 싶습니다.',
					createdAt: '2026-10-07T03:00:00.000Z',
					replies: [{ id: 'r1', body: '연락 주셔서 감사합니다!', createdAt: '2026-10-07T05:00:00.000Z' }],
				},
			];
			const mail = await openMail(page);
			await mail.getByRole('button', { name: '보낸 편지함' }).click();
			await expect(mail.locator('.mail-item')).toContainText('답장 1');
			await mail.locator('.mail-item', { hasText: '채용 제안드립니다' }).click();
			const thread = mail.getByRole('list', { name: '답장' });
			await expect(thread).toContainText('김정현');
			await expect(thread).toContainText('연락 주셔서 감사합니다!');
		});

		test('관리자: 받은 편지함에 받은 모든 메일, 앱에서 답장하면 그 메일 아래에 붙는다', async ({ page }) => {
			const api = await fakeApi(page, { signedIn: true });
			const mail = await openMail(page);
			const inbox = mail.getByRole('region', { name: '받은 편지함' });
			await expect(inbox.locator('.mail-item')).toHaveCount(2);
			// 아직 답장하지 않은 메일 수
			await expect(mail.getByRole('button', { name: /받은 편지함/ }).locator('.mail-badge')).toHaveText('1');

			await inbox.locator('.mail-item', { hasText: '채용 제안드립니다' }).click();
			const article = mail.getByRole('article', { name: '채용 제안드립니다' });
			const reply = article.getByRole('form', { name: '답장 쓰기' });
			await expect(reply).toContainText('받는 사람: 민수 <minsu@example.com>');
			await reply.getByLabel('답장 내용').fill('연락 주셔서 감사합니다! 이번 주에 통화 가능할까요?');
			await reply.getByRole('button', { name: /답장 보내기/ }).click();

			await expect(article.getByRole('list', { name: '답장' })).toContainText('이번 주에 통화 가능할까요?');
			expect(api.contact.replies).toEqual([
				{ id: 'mail-a', body: '연락 주셔서 감사합니다! 이번 주에 통화 가능할까요?' },
			]);
			await expect(mail.getByRole('button', { name: /받은 편지함/ }).locator('.mail-badge')).toHaveCount(0);
		});
	});
});
