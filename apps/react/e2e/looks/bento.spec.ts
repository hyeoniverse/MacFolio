// bento 템플릿 — 한 화면 대시보드: 크기가 다른 타일을 빈칸 없이 짠 보드 하나. 타일마다 구역이고, 담지 못한 내용은 '더 보기'의 자세히 보기 창(모달)에
import { test, expect } from '../fixtures';
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

test('bento: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'bento');
	// 자세히 보기 창의 내용도 닫혀 있는 동안 구역 안에 있다
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('bento: 기능 줄을 누르면 그 기능의 자세히 보기 창이 열리고, 앞뒤로 넘기고 Esc로 닫는다', async ({ page }) => {
	const { article } = await openSample(page, 'bento');
	const features = article.getByRole('region', { name: '주요 기능' });
	const [first, second] = GENERAL_SAMPLE.highlights;
	await features.getByRole('button', { name: first.title }).click();
	const sheet = page.getByRole('dialog', { name: first.title });
	await expect(sheet).toBeVisible();
	await expect(sheet).toContainText(first.detail!);
	await expect(sheet.locator(`img[src="${first.image}"]`)).toBeVisible();
	await sheet.getByRole('button', { name: '다음' }).click();
	await expect(page.getByRole('dialog', { name: second.title })).toContainText(second.detail!);
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('bento: 문제 해결 타일은 사례를 넘기고, 더 보기는 모든 사례를 연다', async ({ page }) => {
	const { article } = await openSample(page, 'bento');
	const troubles = article.getByRole('region', { name: '트러블슈팅' });
	const [first, second] = GENERAL_SAMPLE.troubleshooting!;
	await expect(troubles.getByRole('heading', { name: first.title })).toBeVisible();
	await troubles.getByRole('button', { name: '02' }).click();
	await expect(troubles.getByRole('heading', { name: second.title })).toBeVisible();
	await expect(troubles.getByRole('heading', { name: first.title })).toBeHidden();
	await troubles.getByRole('button', { name: '문제 해결 더 보기' }).click();
	const sheet = page.getByRole('dialog', { name: '모든 사례' });
	await expect(sheet).toContainText(first.result!);
	await sheet.getByRole('button', { name: '닫기' }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('bento: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'bento');
	await expectEmptyRendered(article);
});

test('bento: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'bento');
});

test('bento: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'bento', { light: 'rgb(250, 250, 250)', dark: 'rgb(9, 9, 11)' });
});
