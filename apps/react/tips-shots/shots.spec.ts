// 팁 앱 '사용 설명서'의 글 형식 절에 곁들일 실제 화면 (public/imgs/tips/<앱>-<번호>.jpg).
// 창을 화면에 꽉 채운 뒤 창만 잘라 찍는다. 번호는 apps/tips/manuals.ts의 ARTICLES 순서와 같다
import type { Locator, Page } from '@playwright/test';
import { test, expect, enterDesktop, openFromDock, appWindow } from '../e2e/fixtures';
import { fakeApi } from '../e2e/fakeApi';

const OUT = 'public/imgs/tips';

async function shot(page: Page, target: Locator, name: string) {
	await page.waitForTimeout(400);
	await target.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 80, animations: 'disabled' });
}

async function open(page: Page, app: string, { fill = true } = {}) {
	await enterDesktop(page);
	if (!(await appWindow(page, app).count())) await openFromDock(page, app);
	const win = appWindow(page, app);
	await expect(win).toBeVisible();
	if (!fill) return win;
	// 제목 줄을 두 번 누른 것처럼: 화면에 꽉 채운다 (Safari처럼 제목 줄이 가려진 창도)
	await win
		.locator('.macos-titlebar')
		.evaluate((bar) => bar.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
	await page.waitForTimeout(800);
	return win;
}

test('메모', async ({ page }) => {
	await fakeApi(page);
	const win = await open(page, 'memo');
	await shot(page, win, 'memo-1');
	await win.getByRole('button', { name: '갤러리로 보기' }).click();
	await win.getByRole('searchbox', { name: '글 검색' }).fill('Finder');
	await shot(page, win, 'memo-2');
	await win.getByRole('button', { name: '목록으로 보기' }).click();
	await win.getByRole('searchbox', { name: '글 검색' }).fill('');
	await page.keyboard.press('Escape');
	await page.keyboard.press('ControlOrMeta+f');
	await win
		.getByRole('searchbox', { name: '찾기' })
		.or(win.getByRole('textbox', { name: '찾기' }))
		.fill('Finder');
	await shot(page, win, 'memo-3');
	await page.keyboard.press('Escape');
	await win
		.locator('.memo-scroll, .memo-note-scroll, .memo-detail')
		.last()
		.evaluate((el) => el.scrollTo(0, el.scrollHeight));
	await shot(page, win, 'memo-4');
});

test('Finder', async ({ page }) => {
	const win = await open(page, 'finder');
	await win.getByRole('navigation', { name: '즐겨찾기' }).getByRole('button', { name: '데스크탑' }).click();
	await shot(page, win, 'finder-1');
	await win.getByRole('navigation', { name: '즐겨찾기' }).getByRole('button', { name: '문서' }).click();
	await shot(page, win, 'finder-2');
	await win.getByRole('listbox', { name: '문서' }).getByRole('option', { name: '이력서', exact: true }).dblclick();
	await shot(page, win, 'finder-3');
});

test('Safari', async ({ page }) => {
	const win = await open(page, 'safari');
	await shot(page, win, 'safari-1');
	await win.getByRole('tablist', { name: '프로젝트 탭' }).getByRole('tab').nth(1).click();
	await shot(page, win, 'safari-2');
	await win.locator('[role="tabpanel"]').evaluate((el) => {
		const scroller = [el, ...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 200) as
			HTMLElement | undefined;
		scroller?.scrollTo(0, scroller.scrollHeight * 0.45);
	});
	await shot(page, win, 'safari-3');
});

test('터미널', async ({ page }) => {
	const win = await open(page, 'terminal', { fill: false });
	const input = win.getByRole('textbox', { name: '명령어 입력' });
	await input.fill('help');
	await input.press('Enter');
	await shot(page, win, 'terminal-1');
	await input.fill('clear');
	await input.press('Enter');
	await input.fill('whoami');
	await input.press('Enter');
	await shot(page, win, 'terminal-2');
	await input.fill('clear');
	await input.press('Enter');
	for (const command of ['date', 'skills', 'history']) {
		await input.fill(command);
		await input.press('Enter');
	}
	await input.fill('pro');
	await shot(page, win, 'terminal-3');
});

test('메시지', async ({ page }) => {
	const win = await open(page, 'messages');
	await shot(page, win, 'messages-1');
	await win.getByRole('button', { name: '새 피드백' }).first().click();
	const box = win.getByRole('textbox', { name: '메시지' });
	await box.fill('사이트가 진짜 Mac 같아요! 터미널에서 resume 쳐 보고 놀랐어요 😆');
	await box.press('Enter');
	await shot(page, win, 'messages-2');
});

test('메일', async ({ page }) => {
	await fakeApi(page);
	const win = await open(page, 'mail');
	await win.getByRole('button', { name: '새로운 메시지' }).first().click();
	await win.getByLabel('이름').fill('김방문');
	await win.getByLabel('회신 주소').fill('visitor@example.com');
	await win.getByLabel('제목').fill('포트폴리오 잘 봤습니다');
	await win
		.getByRole('textbox')
		.last()
		.fill('안녕하세요! MacFolio를 재미있게 둘러봤어요. 프론트엔드 포지션으로 이야기 나눠 보고 싶습니다.');
	await shot(page, win, 'mail-1');
	await win.getByRole('button', { name: '보내기' }).click();
	await win.getByText('보낸 편지함').first().click();
	await shot(page, win, 'mail-2');
});

test('시스템 설정', async ({ page }) => {
	const win = await open(page, 'settings');
	for (const [label, name] of [
		['화면 모드', 'settings-1'],
		['개인정보 보호 및 보안', 'settings-2'],
		['정보', 'settings-3'],
	]) {
		await win.getByRole('button', { name: label, exact: true }).first().click();
		await shot(page, win, name);
	}
});
