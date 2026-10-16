// devtool 템플릿 — Vercel·GitHub 개발자 제품 페이지처럼: 1px 선의 틀, 첫 화면의 넓은 터미널(복사되는 git clone 명령), 경로 모양의 구역 머리, 편집기 창, 커밋 목록, 기여 그래프와 git log
import { expect, test } from '../fixtures';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';
import {
	expectEmptyRendered,
	expectLinks,
	expectOnlyFeatures,
	expectSampleRendered,
	expectTheme,
	openEmpty,
	openSample,
} from './landing';

test('devtool: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await expectSampleRendered(article);
	await expectLinks(page, article);
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

test('devtool: 첫 화면은 터미널 창을 두고, 대표 화면은 주요 기능 구역의 편집기 창으로 옮긴다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	await expect(article.locator('.dv-hero .dv-hero-term .dv-command-text')).toBeVisible();
	await expect(article.locator(`.dv-hero img[src="${GENERAL_SAMPLE.image}"]`)).toHaveCount(0);
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features.locator(`.dv-editor img[src="${GENERAL_SAMPLE.image}"]`).first()).toBeAttached();
	await expect(features.locator('.dv-route')).toHaveText('/features');
});

test('devtool: 기술 사양은 쓴 기술과 환경을 package.json 하나에 담는다', async ({ page }) => {
	const { article } = await openSample(page, 'devtool');
	const tech = article.getByRole('region', { name: '기술 사양' });
	await tech.scrollIntoViewIfNeeded();
	const json = tech.locator('.dv-panel-json');
	await expect(json).toContainText('"dependencies"');
	await expect(json).toContainText('"environment"');
	for (const spec of GENERAL_SAMPLE.specs) await expect(json).toContainText(spec.value);
});

test('devtool: 진행 과정은 기여 그래프와 최근 것이 위인 git log로, 구현 방법은 커밋 해시와 함께 그린다', async ({
	page,
}) => {
	const { article } = await openSample(page, 'devtool');
	const timeline = article.getByRole('region', { name: '진행 과정' });
	await timeline.scrollIntoViewIfNeeded();
	await expect(timeline.locator('.dv-graph-cells [data-milestone]')).toHaveCount(7);
	await expect(timeline.locator('.dv-log .dv-hash')).toHaveCount(GENERAL_SAMPLE.timeline?.length ?? 0);
	await expect(timeline.locator('.dv-log li').first()).toContainText(GENERAL_SAMPLE.timeline?.at(-1)?.label ?? '');
	const built = article.getByRole('region', { name: '구현 방법' });
	await expect(built.locator('.dv-hash').first()).toHaveText(/^[0-9a-f]{7}$/);
});

test('devtool: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'devtool');
	await expectEmptyRendered(article);
});

test('devtool: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'devtool');
});

test('devtool: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'devtool', { light: 'rgb(255, 255, 255)', dark: 'rgb(10, 10, 10)' });
});
