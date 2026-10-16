// product 템플릿 — Apple 제품 페이지의 스크롤 이야기처럼: 화면 가득 번지는 첫 화면 아래의 큰 제목, 한 장면에 숫자 하나,
// 무대가 머문 채 서서히 바뀌는 기능 장면(움직임 줄이기면 위아래로 늘어놓는다), 옆으로 넘기는 화면 모음, 차례 막대가 붙는 두 칸 사양 장
import { expect, test } from '../fixtures';
import {
	expectEmptyRendered,
	expectLinks,
	expectOnlyFeatures,
	expectSampleRendered,
	expectTheme,
	openEmpty,
	openSample,
} from './landing';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';

test('product: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'product');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('product: 화면 모음은 둥근 단추로 앞뒤로 넘긴다', async ({ page }) => {
	const { article } = await openSample(page, 'product');
	const screens = article.getByRole('region', { name: '화면 모음', exact: true });
	await screens.scrollIntoViewIfNeeded();
	const prev = screens.getByRole('button', { name: '이전 화면' });
	const next = screens.getByRole('button', { name: '다음 화면' });
	await expect(prev).toBeDisabled();
	await next.click();
	await expect(prev).toBeEnabled();
});

test('product: 기능 장면은 스크롤하면 무대가 머문 채 바뀌고, 오른쪽 점으로 바로 고른다', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	const { article } = await openSample(page, 'product');
	const features = article.getByRole('region', { name: '주요 기능', exact: true });
	await features.scrollIntoViewIfNeeded();
	const dots = features.getByRole('navigation', { name: '기능 고르기' });
	await expect(dots.getByRole('button')).toHaveCount(GENERAL_SAMPLE.highlights.length);
	const third = GENERAL_SAMPLE.highlights[2];
	await dots.getByRole('button', { name: third.title }).click();
	await expect(dots.getByRole('button', { name: third.title })).toHaveAttribute('aria-current', 'step');
	await expect(features.locator('.pd-reel-layer[data-active]')).toContainText(third.title);
	await expect(features.locator('.pd-reel-layer[data-active]')).toHaveCount(1);
});

test('product: 사양 장의 차례 막대를 누르면 그 구역으로 내려간다', async ({ page }) => {
	const { article } = await openSample(page, 'product');
	const nav = article.getByRole('navigation', { name: '사양 차례' });
	await nav.scrollIntoViewIfNeeded();
	await expect(nav.getByRole('button')).toHaveCount(11);
	await nav.getByRole('button', { name: '출처' }).click();
	await expect(article.getByRole('region', { name: '출처', exact: true })).toBeInViewport();
	await expect(nav.getByRole('button', { name: '출처' })).toHaveAttribute('aria-current', 'location');
});

test('product: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'product');
	await expectEmptyRendered(article);
});

test('product: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'product');
});

test('product: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'product', { light: 'rgb(255, 255, 255)', dark: 'rgb(0, 0, 0)' });
});
