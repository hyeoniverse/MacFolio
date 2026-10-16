// friendly 템플릿 — Stripe 제품 소개처럼: 맨 위에 붙는 막대, 넓은 단색 띠 위의 첫 화면과 큰 창, 기능 탐색기(목록과 바뀌는 창),
// 가로 단계, 남색 띠의 구현 카드, 펼치는 사례, 로고 벽, 고객 사례 같은 역할, 가로 로드맵, 연동 카드, 남색 마무리 띠 (새 프로젝트의 기본 모양)
import { test, expect } from '../fixtures';
import { openLook } from './open';
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

test('friendly: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'friendly');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('friendly: 기능 탐색기에서 기능을 고르면 펼쳐지고 오른쪽 창이 그 기능의 화면으로 바뀐다', async ({ page }) => {
	const { article } = await openSample(page, 'friendly');
	const features = article.getByRole('region', { name: '주요 기능' });
	await features.scrollIntoViewIfNeeded();
	const [, second] = GENERAL_SAMPLE.highlights;
	const pick = features.getByRole('button', { name: second.title });
	await pick.click();
	await expect(pick).toHaveAttribute('aria-expanded', 'true');
	await expect(features.getByText(second.detail!)).toBeVisible();
	// 창에는 고른 기능의 화면이 보이고, 앞의 기능 화면은 숨는다
	await expect(features.locator('.fr-ex-view[data-active] img').first()).toHaveAttribute('src', second.shots![0].src);
	await expect(features.locator('.fr-ex-view[data-active]')).toHaveCount(1);
	// 직접 고른 뒤에는 저절로 넘어가지 않는다
	await page.waitForTimeout(1000);
	await expect(pick).toHaveAttribute('aria-expanded', 'true');
});

test('friendly: 위 막대는 스크롤해도 붙어 있고, 차례 단추가 그 구역으로 데려간다', async ({ page }) => {
	const { article } = await openSample(page, 'friendly');
	// 차례 단추는 넓은 창에서만 보인다 (좁은 기본 창에서는 접힌다): Safari를 전체 화면으로
	await page.locator('[data-app="safari"]').getByRole('button', { name: '전체 화면' }).click();
	const nav = article.getByRole('navigation', { name: '페이지 차례' });
	await nav.getByRole('button', { name: '기술' }).click();
	const tech = article.getByRole('region', { name: '기술 사양' });
	await expect(tech).toBeInViewport();
	await expect(nav).toBeInViewport();
	await expect(nav).toHaveAttribute('data-stuck', '');
});

test('friendly: 트러블슈팅 사례는 펼치고 접을 수 있다', async ({ page }) => {
	const { article } = await openSample(page, 'friendly');
	const troubles = article.getByRole('region', { name: '트러블슈팅' });
	await troubles.scrollIntoViewIfNeeded();
	const [first, second] = GENERAL_SAMPLE.troubleshooting!;
	await expect(troubles.getByText(first.problem)).toBeVisible();
	await expect(troubles.getByText(second.problem)).toBeHidden();
	await troubles.getByText(second.title).click();
	await expect(troubles.getByText(second.problem)).toBeVisible();
});

test('friendly: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'friendly');
	await expectEmptyRendered(article);
});

test('friendly: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'friendly');
});

test('friendly: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'friendly', { light: 'rgb(255, 255, 255)', dark: 'rgb(12, 13, 16)' });
});

test('friendly: 예전 기본 모양(showcase)으로 저장해 둔 프로젝트는 이 모양으로 그린다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'showcase' });
	await expect(panel.getByRole('article', { name: 'QRU 큐알유' })).toHaveAttribute('data-look', 'friendly');
});
