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
 * 상태 표시줄과 겹쳐 보이는 앱의 요소. 앱 화면은 상태 표시줄 아래에서 시작하므로 없어야 한다.
 * 스크롤되는 칸을 모두 맨 위로 올린 때와 중간까지 내린 때를 함께 본다 (내용이 상태 표시줄 밑으로 지나가지 않는지).
 * 앱 화면 밖으로 잘려 안 보이는 것은 세지 않는다
 */
const overlappingStatusBar = (page: Page) =>
	page.evaluate(async () => {
		const bar = document.querySelector('.mobile-statusbar')!.getBoundingClientRect();
		const frame = document.querySelector<HTMLElement>('.container.mobile[data-app]')!;
		const scrollers = [...frame.querySelectorAll<HTMLElement>('*')].filter(
			(el) => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
		);
		const found = new Set<string>();
		for (const ratio of [0, 0.5]) {
			for (const el of scrollers) el.scrollTop = (el.scrollHeight - el.clientHeight) * ratio;
			await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			for (const el of frame.querySelectorAll<HTMLElement>('.content *')) {
				const rect = el.getBoundingClientRect();
				if (!rect.width || !rect.height || rect.top >= bar.bottom) continue;
				// 잘려서 보이지 않는 부분은 빼고 본다: 보이는 위쪽 끝을 elementFromPoint로 확인
				const x = Math.min(Math.max(rect.left + rect.width / 2, 1), innerWidth - 1);
				const y = Math.max(rect.top, 0) + 1;
				if (y >= bar.bottom) continue;
				const hit = document.elementsFromPoint(x, y).find((other) => !other.closest('.mobile-statusbar'));
				if (hit && el.contains(hit) && frame.contains(hit))
					found.add(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
			}
		}
		return [...found];
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
	test(`상태 표시줄: ${label}의 화면은 상태 표시줄 아래에서 시작하고, 스크롤해도 그 밑으로 지나가지 않는다`, async ({
		page,
	}) => {
		await fakeApi(page, { signedIn: true });
		await openFromHome(page, label);
		await page.waitForTimeout(800);
		const bar = await page.locator('.mobile-statusbar').boundingBox();
		const content = await page.locator('.container.mobile[data-app] > .content').boundingBox();
		expect(content!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 0.5);
		expect(await overlappingStatusBar(page)).toEqual([]);
	});
}

test('상태 표시줄: 사진만 보기에서는 상태 표시줄이 숨고 사진이 화면 맨 위부터 쓴다', async ({ page }) => {
	await fakeApi(page);
	await openFromHome(page, '사진');
	// 영상이 아닌 사진을 연다 (영상 위의 탭은 재생에 쓴다). 보관함은 맨 아래(최근)부터 보인다
	await page.locator('.photos-thumb:not(:has(video))').last().tap();
	const viewer = page.getByRole('dialog', { name: /^사진 \d+\// });
	await expect(viewer).toBeVisible();
	// 사진을 누르면 화면만 보기
	await viewer.locator('.photos-phone-stage').tap();
	await expect(page.locator('.mobile-statusbar')).toHaveClass(/hidden/);
	await expect
		.poll(async () => (await page.locator('.container.mobile[data-app="photos"] > .content').boundingBox())!.y)
		.toBe(0);
});

test('팁 (휴대폰): 위쪽 막대 대신 떠 있는 뒤로 가기로 앞 화면에 돌아간다', async ({ page }) => {
	await fakeApi(page);
	await openFromHome(page, '팁');
	const tips = appWindow(page, 'tips');
	await expect(tips.locator('.tips-bar')).toHaveCount(0);
	await tips.getByRole('list', { name: '사용 설명서' }).getByRole('button').first().tap();
	await expect(tips.locator('.tips-home')).toHaveCount(0);
	expect(await overlappingStatusBar(page)).toEqual([]);
	await page.locator('.mobile-navbar').getByRole('button', { name: '팁' }).tap();
	await expect(tips.locator('.tips-home')).toBeVisible();
	// 첫 화면에서는 홈 화면으로 가는 버튼
	await expect(page.locator('.mobile-navbar').getByRole('button', { name: '홈' })).toBeVisible();
});
