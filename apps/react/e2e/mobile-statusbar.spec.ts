import { test, expect, appWindow } from './fixtures';
import { fakeApi } from './fakeApi';
import type { Page } from '@playwright/test';

/** 로딩 화면을 탭해 넘기고 홈 화면의 앱을 연다 (다른 페이지에 있으면 그 페이지로 넘긴다) */
async function openFromHome(page: Page, label: string) {
	await page.goto('/');
	const loading = page.locator('.loading-container');
	await loading.tap();
	await expect(loading).toBeHidden({ timeout: 20_000 });
	const home = page.locator('.mobile-home');
	const pages = home.locator('.mobile-page');
	const count = await pages.count();
	for (let index = 0; index < count; index++) {
		if ((await pages.nth(index).locator(`.mobile-app[aria-label="${label}"]`).count()) === 0) continue;
		if (count > 1) await home.getByRole('tab', { name: `${index + 1}쪽` }).click();
		break;
	}
	await home.getByRole('button', { name: label, exact: true }).tap();
}

/**
 * 상태 표시줄(누르면 제어 센터)에 가려 누를 수 없는 것: 스크롤을 모두 맨 위로 올린 뒤,
 * 상태 표시줄과 겹치는 버튼·링크·입력 칸마다 겹친 곳의 가운데를 눌렀을 때 상태 표시줄이 받는지 본다
 */
const coveredByStatusBar = (page: Page) =>
	page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>('*')) if (el.scrollTop > 0) el.scrollTop = 0;
		const bar = document.querySelector('.mobile-statusbar')!.getBoundingClientRect();
		const covered: string[] = [];
		const selector = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"]';
		for (const el of document.querySelectorAll<HTMLElement>(`[data-app] :is(${selector})`)) {
			const rect = el.getBoundingClientRect();
			if (!rect.width || !rect.height || rect.top >= bar.bottom || rect.bottom <= 0) continue;
			const style = getComputedStyle(el);
			if (style.visibility === 'hidden' || style.opacity === '0') continue;
			const y = (Math.max(rect.top, 0) + Math.min(rect.bottom, bar.bottom)) / 2;
			if (document.elementFromPoint(rect.left + rect.width / 2, y)?.closest('.mobile-statusbar'))
				covered.push((el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
		}
		return covered;
	});

// 홈 화면의 앱 (프로젝트 소개와 Safari는 바깥 페이지를 품어 뺀다)
const APPS = [
	'파일',
	'사진',
	'메모',
	'GitHub',
	'단축어',
	'시스템 설정',
	'암호',
	'API 문서',
	'활동 상태 보기',
	'날씨',
	'팁',
	'메시지',
	'메일',
	'음악',
];

for (const label of APPS) {
	test(`상태 표시줄: ${label}의 첫 화면은 맨 위까지 올려도 상태 표시줄 밑에 누를 것이 없다`, async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await openFromHome(page, label);
		await page.waitForTimeout(800);
		expect(await coveredByStatusBar(page)).toEqual([]);
	});
}

test('팁 (휴대폰): 위쪽 막대 대신 떠 있는 뒤로 가기로 앞 화면에 돌아간다', async ({ page }) => {
	await fakeApi(page);
	await openFromHome(page, '팁');
	const tips = appWindow(page, 'tips');
	await expect(tips.locator('.tips-bar')).toHaveCount(0);
	await tips.getByRole('list', { name: '사용 설명서' }).getByRole('button').first().tap();
	await expect(tips.locator('.tips-home')).toHaveCount(0);
	expect(await coveredByStatusBar(page)).toEqual([]);
	await page.locator('.mobile-navbar').getByRole('button', { name: '팁' }).tap();
	await expect(tips.locator('.tips-home')).toBeVisible();
	// 첫 화면에서는 홈 화면으로 가는 버튼
	await expect(page.locator('.mobile-navbar').getByRole('button', { name: '홈' })).toBeVisible();
});
