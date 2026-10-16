// devtool 템플릿 — Vercel·Next.js 문서 사이트처럼: 고정된 위 막대(Docs·Showcase·GitHub, ⌘K 검색), 묶음별 문서 목차,
// 이동 경로와 빠른 시작(복사되는 git clone 명령), 알림 상자, 이전·다음 페이지, '이 페이지에서' 목차.
// 구역은 목차가 바꾸는 문서 페이지에 나뉘어 한 번에 한 페이지만 보이므로, 공통 시험(expectSampleRendered) 대신 목차를 차례로 열며 구역을 확인한다
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
	expectEmptyRendered,
	expectFeatureMedia,
	expectLinks,
	expectRegion,
	expectSampleHero,
	expectTheme,
	openEmpty,
	openSample,
	sampleRegionTexts,
} from './landing';
import { SECTION_LABELS, SECTION_ORDER } from '../../src/apps/safari/project/landing/content';

const sidebar = (article: Locator) => article.getByRole('navigation', { name: '문서 목차' });
const regionLabels = (article: Locator) =>
	article.getByRole('region').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));

/** 문서 목차에서 이 페이지를 연다 (좁은 창이면 ☰ 서랍을 먼저 연다) */
async function openDoc(article: Locator, label: string) {
	const menu = article.getByRole('button', { name: '문서 목차 열기' });
	if (await menu.isVisible()) await menu.click();
	await sidebar(article).getByRole('button', { name: label, exact: true }).click();
	// 좁은 창에서는 고르면 서랍이 닫혀 목차가 숨는다 (숨은 단추로 현재 위치를 본다)
	await expect(
		article.locator('#dv-sidebar').getByRole('button', { name: label, exact: true, includeHidden: true })
	).toHaveAttribute('aria-current', 'page');
}

/** 목차 묶음과 차례: 시작하기 · 기능 · 아키텍처 · 레퍼런스 · 프로젝트 */
const DOC_PAGES: [string, string[]][] = [
	['소개', ['한눈에 보는 숫자']],
	['쓰는 법', ['쓰는 법']],
	['주요 기능', ['주요 기능']],
	['화면 모음', ['화면 모음']],
	['단축키', ['조작법']],
	['구현 방법', ['구현 방법']],
	['트러블슈팅', ['트러블슈팅']],
	['개발 이야기', ['더 들려줄 이야기']],
	['기술 사양', ['기술 사양']],
	['출처', ['출처']],
	['팀', ['팀원']],
	['내 역할', ['내 역할']],
	['진행 과정', ['진행 과정']],
	['배포', ['배포 결과물']],
];

const fullScreen = (page: Page) =>
	page.locator('[data-app="safari"]').getByRole('button', { name: '전체 화면' }).click();

test('devtool: 문서 목차를 차례로 열면 예시의 모든 구역이 한 번씩 나오고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await expectSampleHero(article);
	const texts = new Map(sampleRegionTexts());
	const seen: string[] = [];
	for (const [label, regions] of DOC_PAGES) {
		await openDoc(article, label);
		await expect(article.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(article.getByRole('navigation', { name: '이동 경로' })).toContainText(label);
		// 한 번에 한 페이지만: 보이는 구역은 이 페이지의 것뿐이다
		expect(await regionLabels(article)).toEqual(regions);
		for (const region of regions) {
			const found = await expectRegion(article, region, texts.get(region) ?? []);
			if (region === '주요 기능') await expectFeatureMedia(found);
			seen.push(region);
		}
	}
	expect([...seen].sort()).toEqual(SECTION_ORDER.map((kind) => SECTION_LABELS[kind]).sort());

	// 설치·폴더 구조는 페이지 안의 제목으로 바로 간다
	await openDoc(article, '폴더 구조');
	await expect(article.getByRole('heading', { name: '폴더 구조', level: 3 })).toBeInViewport();
	await openDoc(article, '설치');
	await expect(article.getByRole('heading', { name: '빠른 시작' })).toBeInViewport();

	await expectLinks(page, article);
});

test('devtool: 이전·다음 페이지 링크와 이동 경로가 목차의 차례를 따른다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	const pager = article.getByRole('navigation', { name: '이전 페이지와 다음 페이지' });
	await expect(pager.getByRole('button')).toHaveCount(1);
	await pager.getByRole('button', { name: /다음\s*쓰는 법/ }).click();
	await expect(article.getByRole('heading', { name: '쓰는 법', level: 2 })).toBeFocused();
	await expect(article.getByRole('navigation', { name: '이동 경로' })).toHaveText(/Docs.*시작하기.*쓰는 법/);
	await pager.getByRole('button', { name: /이전\s*소개/ }).click();
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('같은 책을 읽는 사람들이 한자리에 모입니다.');
});

test('devtool: ⌘K 검색 팔레트에서 키보드로 제목을 골라 그 페이지로 간다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await article.getByRole('button', { name: /문서 검색/ }).click();
	const dialog = article.getByRole('dialog', { name: '문서 검색' });
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.keyboard.press('ControlOrMeta+k');
	await expect(dialog).toBeVisible();
	const input = dialog.getByRole('combobox', { name: '문서 검색어' });
	await expect(input).toBeFocused();
	await input.fill('일정');
	const options = dialog.getByRole('option');
	await expect(options.first()).toHaveAttribute('aria-selected', 'true');
	await expect(options).toContainText(['함께 정하는 일정', '일정 투표 집계']);
	await page.keyboard.press('ArrowDown');
	await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('Enter');
	await expect(dialog).toBeHidden();
	await expect(article.getByRole('heading', { name: '일정 투표 집계', level: 3 })).toBeInViewport();
	await expect(article.getByRole('navigation', { name: '이동 경로' })).toContainText('구현 방법');

	await page.keyboard.press('ControlOrMeta+k');
	await dialog.getByRole('combobox').fill('없는 검색어');
	await expect(dialog.getByRole('status')).toHaveText('찾는 문서가 없습니다.');
});

test('devtool: 넓은 창에서는 목차와 이 페이지에서 목차가 늘 보이고, 읽는 위치를 따라간다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await fullScreen(page);
	await expect(article.getByRole('button', { name: '문서 목차 열기' })).toBeHidden();
	await expect(sidebar(article)).toBeVisible();
	await sidebar(article).getByRole('button', { name: '주요 기능' }).click();
	const toc = article.getByRole('complementary', { name: '이 페이지에서' });
	await expect(toc.getByRole('link')).toHaveText([
		'책으로 모임 찾기',
		'읽은 만큼 열리는 토론',
		'함께 정하는 일정',
		'밑줄 모음',
		'모임 기록',
	]);
	await toc.getByRole('link', { name: '모임 기록' }).click();
	await expect(article.getByRole('heading', { name: '모임 기록', level: 3 })).toBeInViewport();
	await expect(toc.getByRole('link', { name: '모임 기록' })).toHaveAttribute('aria-current', 'location');
	// 위 막대의 Showcase는 화면 모음을 연다
	await article.getByRole('navigation', { name: '사이트' }).getByRole('button', { name: 'Showcase' }).click();
	await expect(sidebar(article).getByRole('button', { name: '화면 모음' })).toHaveAttribute('aria-current', 'page');
	await expect(article.getByRole('region', { name: '화면 모음' })).toBeVisible();
});

test('devtool: git clone 명령을 복사하면 알림 줄에 알린다', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	const { article } = await openSample(page, 'devtool');
	await expect(article.locator('.dv-command-text')).toHaveText('git clone https://github.com/hyeoniverse/QRU.git');
	await article.getByRole('button', { name: '명령 복사' }).click();
	await expect(article.getByRole('status').first()).toHaveText('복사했습니다.');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		'git clone https://github.com/hyeoniverse/QRU.git'
	);
});

test('devtool: 진행 과정은 날짜로 짠 기여 그래프와 함께, 구현 방법은 커밋 해시와 함께 그린다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await openDoc(article, '진행 과정');
	const timeline = article.getByRole('region', { name: '진행 과정' });
	await expect(timeline.locator('.dv-graph-cells [data-milestone]')).toHaveCount(7);
	await openDoc(article, '구현 방법');
	const built = article.getByRole('region', { name: '구현 방법' });
	await expect(built.locator('.dv-hash').first()).toHaveText(/^[0-9a-f]{7}$/);
});

test('devtool: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'devtool');
	await expectEmptyRendered(article);
	// 목차는 소개와 설치뿐이고, 이전·다음 링크는 없다
	await article.getByRole('button', { name: '문서 목차 열기' }).click();
	await expect(sidebar(article).getByRole('button')).toHaveText(['소개', '설치']);
	await expect(article.getByRole('navigation', { name: '이전 페이지와 다음 페이지' })).toHaveCount(0);
});

test('devtool: 주요 기능만 있으면 그 페이지에 그 구역 하나만 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'devtool', {
		highlights: [{ title: '한 화면', body: '할 일과 메모를 나란히 둡니다.', icon: 'fa-bolt' }],
	});
	await expect(article.getByRole('region')).toHaveCount(0);
	await openDoc(article, '주요 기능');
	await expect(article.getByRole('region')).toHaveCount(1);
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features).toContainText('한 화면');
	await expect(features).toContainText('할 일과 메모를 나란히 둡니다.');
	await expect(features.locator('.fa-bolt').first()).toBeVisible();
});

test('devtool: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'devtool', { light: 'rgb(255, 255, 255)', dark: 'rgb(10, 10, 10)' });
});
