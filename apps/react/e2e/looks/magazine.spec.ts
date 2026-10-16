// magazine 템플릿 — 잡지의 사례 연구 기사처럼: 표지처럼 왼쪽에 세운 큰 이름과 겹줄, 판 위의 큰 사진, 두 단 기능 기사와 걸친 인용구, 연표와 미주
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

test('magazine: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'magazine');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('magazine: 두 단 기사 사이에 그림 없는 꼭지의 리드 문장을 인용구로 걸치고, 사진에는 설명이 붙는다', async ({
	page,
}) => {
	const { article } = await openSample(page, 'magazine');
	const features = article.getByRole('region', { name: '주요 기능' });
	await features.scrollIntoViewIfNeeded();
	// 예시의 셋째 기능(함께 정하는 일정)은 그림이 없다
	const plain = GENERAL_SAMPLE.highlights[2];
	await expect(features.locator('.mg-pullquote blockquote', { hasText: plain.body })).toBeVisible();
	await expect(features.locator('.mg-cols')).toHaveCount(2);
	// 첫 기능의 그림은 설명과 함께 놓인다
	await expect(features.locator('figure figcaption').first()).toContainText(GENERAL_SAMPLE.highlights[0].title);
});

test('magazine: 첫 화면은 프로젝트 이름을 제호처럼 크게 세우고, 제목은 그 아래의 h1이다', async ({ page }) => {
	const { article } = await openSample(page, 'magazine');
	await expect(article.locator('.mg-title')).toHaveText(GENERAL_SAMPLE.name);
	await expect(article.locator('.mg-hero h1')).toHaveText(GENERAL_SAMPLE.tagline);
	await expect(article.locator('.mg-byline')).toContainText(GENERAL_SAMPLE.period ?? '');
});

test('magazine: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'magazine');
	await expectEmptyRendered(article);
});

test('magazine: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'magazine');
});

test('magazine: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'magazine', { light: 'rgb(250, 248, 243)', dark: 'rgb(20, 19, 17)' });
});
