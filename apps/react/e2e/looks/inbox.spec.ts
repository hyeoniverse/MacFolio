import { test, expect } from '../fixtures';
import type { Locator } from '@playwright/test';
import { openLook } from './open';

// 메일함 모양: 메일함(사이드바) → 메일 목록 → 본문. 메일 수 규칙은 InboxPage.tsx의 buildMail과 같다:
// 받은 편지함 = 소개 1 + 주요 기능 + 만든 방식 + 장(chapters)마다 글 묶음 수 + 쓰는 법 + 진행 과정 + 화면 모음 1 + 기술 사양 1 + 맡은 일 1 (없는 것은 0)

/** 사이드바 메일함 단추의 안 읽음 뱃지가 그 수인지 */
const expectBadge = (nav: Locator, name: string | RegExp, count: number) =>
	expect(nav.getByRole('button', { name }).locator('.ib-badge')).toHaveText(String(count));

test('inbox: 받은 편지함은 모든 메일, 메일함을 고르면 그 메일만, 열면 읽음 처리로 뱃지가 줄고, 검색이 목록을 거른다', async ({
	page,
}) => {
	const { panel } = await openLook(page, { id: 'newpick', tab: /NewPick/, look: 'inbox' });
	const nav = panel.getByRole('navigation', { name: '메일함' });
	const list = panel.getByRole('region', { name: '메일 목록' });
	const read = panel.getByRole('region', { name: '본문' });

	// 처음에는 첫 메일(소개)이 열려 있다: 제목이 tagline, 숫자와 링크가 본문에
	await expect(read.getByRole('heading', { level: 1 })).toHaveText('아침 뉴스, 요약해서 한 통에.');
	await expect(read.getByRole('link', { name: /GitHub/ })).toBeVisible();

	// 받은 편지함의 메일 수 = 다른 메일함(소개·주요 기능·만든 방식·장·진행 과정·기술 사양·맡은 일)의 합
	const boxes = nav.getByRole('button');
	const total = await boxes.count();
	expect(total).toBeGreaterThan(3);
	// 넓은 창에서는 목록과 본문이 나란히 보인다
	await expect(list.locator('.ib-mail').first()).toBeVisible();
	const all = await list.locator('.ib-mail').count();
	let sum = 0;
	for (let i = 1; i < total; i++) {
		await boxes.nth(i).click();
		await expect(boxes.nth(i)).toHaveAttribute('aria-pressed', 'true');
		sum += await list.locator('.ib-mail').count();
	}
	expect(all).toBe(sum);
	// 소개는 읽은 채 시작하므로 받은 편지함 뱃지는 전체 - 1
	await expectBadge(nav, '받은 편지함', all - 1);

	// 주요 기능 메일함: 목록은 highlights(NewPick은 6개)만, 뱃지도 그 수
	await nav.getByRole('button', { name: /주요 기능/ }).click();
	await expect(list.getByRole('heading', { level: 2 })).toHaveText('주요 기능');
	await expect(list.locator('.ib-mail')).toHaveCount(6);
	await expectBadge(nav, /주요 기능/, 6);
	await expect(list.locator('.ib-mail').first()).toContainText('AI 뉴스 요약');

	// 두 번째 메일을 열면 본문 제목이 그 메일이고, 안 읽음이 하나 줄어든다
	const second = list.locator('.ib-mail').nth(1);
	const subject = await second.locator('strong').textContent();
	await second.click();
	await expect(read.getByRole('heading', { level: 1 })).toHaveText(subject!);
	await expect(second).toHaveAttribute('aria-current', 'true');
	await expect(second).not.toHaveAttribute('data-unread', '');
	await expectBadge(nav, /주요 기능/, 5);
	await expectBadge(nav, '받은 편지함', all - 2);

	// ↓ 키로 다음 메일로 (세 번째가 열리고 읽음)
	await page.keyboard.press('ArrowDown');
	await expect(list.locator('.ib-mail').nth(2)).toHaveAttribute('aria-current', 'true');
	await expectBadge(nav, /주요 기능/, 4);

	// 검색: 제목·본문 글자로 거른다
	await nav.getByRole('button', { name: '받은 편지함' }).click();
	await panel.getByRole('searchbox', { name: '메일 검색' }).fill('OpenAI');
	const filtered = await list.locator('.ib-mail').count();
	expect(filtered).toBeGreaterThan(0);
	expect(filtered).toBeLessThan(all);
	await panel.getByRole('searchbox', { name: '메일 검색' }).fill('이런메일은없다');
	await expect(list.locator('.ib-mail')).toHaveCount(0);
	await expect(list.getByText('찾는 메일이 없습니다')).toBeVisible();

	// 구독 단추는 데모로
	await expect(panel.getByRole('link', { name: /구독하기/ })).toHaveAttribute('href', /newpick/);
});

test('inbox: 다른 프로젝트(WTD, 쓰는 법 있음)도 같은 규칙으로 깨지지 않는다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'whattodo', tab: /WTD/, look: 'inbox' });
	const nav = panel.getByRole('navigation', { name: '메일함' });
	const list = panel.getByRole('region', { name: '메일 목록' });
	const read = panel.getByRole('region', { name: '본문' });

	await expect(read.getByRole('heading', { level: 1 })).toHaveText('할 일은 끌어서. 루틴은 알아서.');
	await nav.getByRole('button', { name: /쓰는 법/ }).click();
	await expect(list.locator('.ib-mail')).toHaveCount(2);
	await list.locator('.ib-mail').first().click();
	await expect(read.getByRole('heading', { level: 1 })).toHaveText('가입 없이');
	// 진행 과정 메일함: 보낸 이가 날짜, 날짜순
	await nav.getByRole('button', { name: /진행 과정/ }).click();
	await expect(list.locator('.ib-mail').first().locator('.ib-from')).toHaveText('10.05');
	await expect(list.locator('.ib-mail').last().locator('.ib-from')).toHaveText('10.19');
});
