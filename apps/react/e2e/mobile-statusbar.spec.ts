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
 * 상태 표시줄과 겹치는 버튼·링크·입력 칸을 찾는다. 스크롤을 모두 맨 위로 올리고,
 * 겹친 곳의 가운데에서 상태 표시줄을 뺀 가장 위의 요소가 그 안에 있는 것만 (다른 것에 덮인 것은 뺀다)
 */
const underStatusBar = (page: Page) =>
	page.evaluate(() => {
		for (const el of document.querySelectorAll<HTMLElement>('*')) if (el.scrollTop > 0) el.scrollTop = 0;
		const statusBar = document.querySelector('.mobile-statusbar')!;
		const bar = statusBar.getBoundingClientRect();
		const found: { name: string; x: number; y: number }[] = [];
		const selector = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"]';
		for (const el of document.querySelectorAll<HTMLElement>(`[data-app] :is(${selector})`)) {
			const rect = el.getBoundingClientRect();
			if (!rect.width || !rect.height || rect.top >= bar.bottom || rect.bottom <= 0) continue;
			const style = getComputedStyle(el);
			if (style.visibility === 'hidden' || style.opacity === '0' || el.matches(':disabled')) continue;
			const x = rect.left + rect.width / 2;
			const y = (Math.max(rect.top, 0) + Math.min(rect.bottom, bar.bottom)) / 2;
			const below = document.elementsFromPoint(x, y).find((hit) => !statusBar.contains(hit));
			if (!below || !el.contains(below)) continue;
			found.push({ name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40), x, y });
		}
		return found;
	});

/**
 * 상태 표시줄 밑의 버튼마다 그 자리를 탭해, 상태 표시줄이 아니라 그 버튼이 눌리는지 본다.
 * 눌린 것은 window의 capture 단계에서 기록하고 멈춰 화면이 바뀌지 않게 한다. 눌리지 않은 버튼의 이름을 돌려준다
 */
async function unreachableUnderStatusBar(page: Page) {
	const targets = await underStatusBar(page);
	await page.evaluate(() => {
		const hits: string[] = [];
		const record = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (target.closest('.mobile-statusbar')) return;
			hits.push((target.getAttribute('aria-label') || target.textContent || target.tagName).trim().slice(0, 40));
			event.stopImmediatePropagation();
			event.preventDefault();
		};
		window.addEventListener('click', record, true);
		Object.assign(window, { __hits: hits, __stopRecording: () => window.removeEventListener('click', record, true) });
	});
	const missed: string[] = [];
	for (const target of targets) {
		const before = await page.evaluate(() => (window as unknown as { __hits: string[] }).__hits.length);
		await page.touchscreen.tap(target.x, target.y);
		const hits = await page.evaluate(() => (window as unknown as { __hits: string[] }).__hits);
		if (hits.length === before || hits.at(-1) !== target.name) missed.push(target.name);
	}
	await page.evaluate(() => (window as unknown as { __stopRecording: () => void }).__stopRecording());
	return { count: targets.length, missed };
}

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
	test(`상태 표시줄: ${label}의 첫 화면을 맨 위까지 올렸을 때 상태 표시줄 밑의 버튼도 눌린다`, async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await openFromHome(page, label);
		await page.waitForTimeout(800);
		expect((await unreachableUnderStatusBar(page)).missed).toEqual([]);
	});
}

test('상태 표시줄: 사진 첫 줄은 상태 표시줄 밑을 눌러도 열리고, 밑이 빈 곳이면 제어 센터가 열린다', async ({
	page,
}) => {
	await fakeApi(page);
	await openFromHome(page, '사진');
	await page.waitForTimeout(800);
	const targets = await underStatusBar(page);
	// 사진은 상태 표시줄 뒤까지 깔린다 (첫 줄 위쪽이 상태 표시줄 밑에 있다)
	expect(targets.length).toBeGreaterThan(0);
	await page.touchscreen.tap(targets[0].x, targets[0].y);
	await expect(page.getByRole('dialog', { name: /^사진 1\// })).toBeVisible();
	await expect(page.getByRole('dialog', { name: '제어 센터' })).toBeHidden();

	await openFromHome(page, '메모');
	await page.getByRole('button', { name: '제어 센터 열기' }).tap();
	await expect(page.getByRole('dialog', { name: '제어 센터' })).toBeVisible();
});

test('팁 (휴대폰): 위쪽 막대 대신 떠 있는 뒤로 가기로 앞 화면에 돌아간다', async ({ page }) => {
	await fakeApi(page);
	await openFromHome(page, '팁');
	const tips = appWindow(page, 'tips');
	await expect(tips.locator('.tips-bar')).toHaveCount(0);
	await tips.getByRole('list', { name: '사용 설명서' }).getByRole('button').first().tap();
	await expect(tips.locator('.tips-home')).toHaveCount(0);
	expect((await unreachableUnderStatusBar(page)).missed).toEqual([]);
	await page.locator('.mobile-navbar').getByRole('button', { name: '팁' }).tap();
	await expect(tips.locator('.tips-home')).toBeVisible();
	// 첫 화면에서는 홈 화면으로 가는 버튼
	await expect(page.locator('.mobile-navbar').getByRole('button', { name: '홈' })).toBeVisible();
});
