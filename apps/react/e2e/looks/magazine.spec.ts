// magazine 템플릿 — 책상 위의 인쇄 잡지 한 권: 표지(제호와 호수 줄, 표지 문구), 차례 펼침면(편집자의 글과 숫자 곁상자),
// 구역마다의 펼침면(쪽 번호, 기능의 글 쪽과 그림 쪽, 화보, 문답, 큰 인용구, 기고자 쪽, 연대기), 뒤표지의 링크
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

test('magazine: 표지는 이름을 제호로, 기간을 호수 줄로 쓰고 구역에서 뽑은 표지 문구를 단다', async ({ page }) => {
	const { article } = await openSample(page, 'magazine');
	const cover = article.locator('.mg-cover');
	await expect(cover.locator('.mg-mast')).toHaveText('북클럽');
	await expect(cover.locator('.mg-issue')).toContainText('Vol. 1 · 2025.03 – 06');
	await expect(cover.locator('.mg-coverlines li')).toHaveCount(4);
	await expect(cover.locator('.mg-coverlines')).toContainText(GENERAL_SAMPLE.highlights[0].title);
});

test('magazine: 차례에서 고른 구역으로 넘어가고, 숫자는 편집자의 글 곁상자에 놓인다', async ({ page }) => {
	const { article } = await openSample(page, 'magazine');
	const contents = article.getByRole('navigation', { name: '차례' });
	await expect(contents.getByRole('button')).toHaveCount(14);
	await expect(article.locator('.mg-letter').getByRole('region', { name: '한눈에 보는 숫자' })).toBeAttached();
	await contents.getByRole('button', { name: /트러블슈팅/ }).click();
	const trouble = article.getByRole('region', { name: '트러블슈팅' });
	await expect(trouble).toBeFocused();
	await expect(trouble).toBeInViewport();
	// 문답: 문제마다 묻고 답한다
	await expect(trouble.getByText('문제는 무엇이었나요?')).toHaveCount(GENERAL_SAMPLE.troubleshooting!.length);
});

test('magazine: 그림이 없는 기능 꼭지는 리드 문장을 인용구로 세우고, 사진에는 설명이 붙는다', async ({ page }) => {
	const { article } = await openSample(page, 'magazine');
	const features = article.getByRole('region', { name: '주요 기능' });
	await features.scrollIntoViewIfNeeded();
	// 예시의 셋째 기능(함께 정하는 일정)은 그림이 없다
	const plain = GENERAL_SAMPLE.highlights[2];
	await expect(features.locator('blockquote', { hasText: plain.body })).toBeVisible();
	// 첫 기능의 그림은 설명과 함께 놓인다
	await expect(features.locator('figure figcaption').first()).toContainText(GENERAL_SAMPLE.highlights[0].title);
	// 펼침면마다 아래에 쪽 번호가 있다
	await expect(features.locator('.mg-folios').first()).toContainText('4');
});

test('magazine: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 표지와 뒤표지를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'magazine');
	await expectEmptyRendered(article);
	await expect(article.getByRole('navigation', { name: '차례' })).toHaveCount(0);
});

test('magazine: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'magazine');
});

test('magazine: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'magazine', { light: 'rgb(232, 227, 216)', dark: 'rgb(14, 13, 12)' });
});
