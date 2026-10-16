// paper 템플릿 — Notion 워크스페이스 페이지처럼: 고정된 사이드바의 페이지 트리, 이동 경로 막대, 표지와 속성 표,
// 접힌 토글, 보기를 바꾸는 데이터베이스(표·보드·갤러리). 좁은 창에서는 사이드바가 ☰ 단추 뒤로 접힌다
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
	expectEmptyRendered,
	expectLinks,
	expectOnlyFeatures,
	expectSampleRendered,
	expectTheme,
	openEmpty,
	openSample,
} from './landing';

const sidebar = (article: Locator) => article.getByRole('navigation', { name: '페이지 목록' });

/** 사이드바가 ☰ 뒤로 접혀 있으면 열고 돌려준다 */
async function openSidebar(article: Locator) {
	const menu = article.getByRole('button', { name: '사이드바 열기' });
	if (await menu.isVisible()) await menu.click();
	await expect(sidebar(article)).toBeVisible();
	return sidebar(article);
}

const fullScreen = (page: Page) =>
	page.locator('[data-app="safari"]').getByRole('button', { name: '전체 화면' }).click();

test('paper: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('paper: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'paper');
	await expectEmptyRendered(article);
	// 하위 페이지가 없는 트리: 개요 한 줄뿐이다
	const nav = await openSidebar(article);
	await expect(nav.locator('.pp-tree').getByRole('button')).toHaveText(['개요']);
});

test('paper: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'paper');
});

test('paper: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'paper', { light: 'rgb(255, 254, 252)', dark: 'rgb(25, 25, 25)' });
});

test('paper: 자세히는 토글을 펼쳐 읽는다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	const features = article.getByRole('region', { name: '주요 기능' });
	const toggle = features.locator('details').first();
	await toggle.scrollIntoViewIfNeeded();
	await expect(toggle).not.toHaveAttribute('open', '');
	await toggle.getByText('자세히 보기').click();
	await expect(toggle).toHaveAttribute('open', '');
	await expect(toggle).toContainText('공공 도서 데이터');
});

test('paper: 사이드바의 하위 페이지를 누르면 그 구역으로 내려가 접힌 토글을 펼친다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	await fullScreen(page);
	// 넓은 창에서는 사이드바가 늘 보이고 ☰ 단추는 없다
	await expect(article.getByRole('button', { name: '사이드바 열기' })).toBeHidden();
	const nav = sidebar(article);
	await expect(nav).toBeVisible();

	const troubles = article.getByRole('region', { name: '트러블슈팅' });
	const toggles = troubles.locator('details.pp-tgl');
	await expect(toggles).toHaveCount(3);
	for (const toggle of await toggles.all()) await expect(toggle).not.toHaveAttribute('open', '');

	await nav.getByRole('button', { name: '트러블슈팅 기록' }).click();
	for (const toggle of await toggles.all()) await expect(toggle).toHaveAttribute('open', '');
	await expect(troubles.getByRole('heading', { level: 2 })).toBeInViewport();
	await expect(troubles.getByRole('heading', { level: 2 })).toBeFocused();
	await expect(nav.getByRole('button', { name: '트러블슈팅 기록' })).toHaveAttribute('aria-current', 'location');
	await expect(article.locator('.pp-crumbs')).toContainText('트러블슈팅 기록');

	// 모두 접기 단추가 토글을 함께 접는다
	await troubles.getByRole('button', { name: '모두 접기' }).click();
	for (const toggle of await toggles.all()) await expect(toggle).not.toHaveAttribute('open', '');
	await expect(troubles.getByRole('button', { name: '모두 펼치기' })).toBeVisible();

	// 개요는 맨 위로 돌아간다
	await nav.getByRole('button', { name: '개요' }).click();
	await expect(article.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('paper: 팀원과 배포 데이터베이스는 표·보드·갤러리 보기를 바꾼다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	const team = article.getByRole('region', { name: '팀원' });
	await team.scrollIntoViewIfNeeded();
	const views = team.getByRole('group', { name: '팀 보기' });
	await expect(views.getByRole('button')).toHaveText(['표', '보드', '갤러리']);
	await expect(views.getByRole('button', { name: '표' })).toHaveAttribute('aria-pressed', 'true');
	await expect(team.getByRole('table')).toContainText('이서윤');

	await views.getByRole('button', { name: '보드' }).click();
	await expect(views.getByRole('button', { name: '보드' })).toHaveAttribute('aria-pressed', 'true');
	await expect(team.getByRole('table')).toHaveCount(0);
	// 역할의 첫 낱말로 묶은 열: 프론트엔드에 두 사람
	const frontend = team.locator('.pp-board-col').filter({ hasText: '프론트엔드' }).first();
	await expect(frontend.locator('.pp-board-card')).toHaveCount(2);

	await views.getByRole('button', { name: '갤러리' }).click();
	await expect(team.locator('.pp-db-card')).toHaveCount(4);

	const deploys = article.getByRole('region', { name: '배포 결과물' });
	const deployViews = deploys.getByRole('group', { name: '배포 보기' });
	await deployViews.getByRole('button', { name: '갤러리' }).click();
	await expect(deploys.locator('.pp-db-card')).toHaveCount(3);
	await expect(deploys.locator('.pp-db-card img').first()).toBeAttached();
	await deployViews.getByRole('button', { name: '보드' }).click();
	await expect(deploys.locator('.pp-board-col')).toHaveCount(3);
});

test('paper: 좁은 창에서는 사이드바가 ☰ 단추 뒤로 접히고, Esc로 닫는다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	const menu = article.getByRole('button', { name: '사이드바 열기' });
	await expect(menu).toBeVisible();
	await expect(sidebar(article)).toBeHidden();
	await menu.click();
	await expect(menu).toHaveAttribute('aria-expanded', 'true');
	await expect(sidebar(article)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sidebar(article)).toBeHidden();
	await expect(menu).toBeFocused();

	// 하위 페이지를 고르면 서랍이 닫히고 그 구역으로 내려간다
	await menu.click();
	await sidebar(article).getByRole('button', { name: '팀', exact: true }).click();
	await expect(sidebar(article)).toBeHidden();
	await expect(article.getByRole('region', { name: '팀원' }).getByRole('heading', { level: 2 })).toBeInViewport();
});
