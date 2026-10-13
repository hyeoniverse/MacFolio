// friendly 템플릿 — Stripe처럼: 비스듬한 옅은 띠와 단색 줄무늬 위의 창과 겹친 작은 카드, 강조선 달린 숫자, 아이콘 기능 격자, 선으로 이은 단계, 남색 띠, 비스듬한 남색 마무리 띠 (새 프로젝트의 기본 모양)
import { test, expect } from '../fixtures';
import { openLook } from './open';
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
