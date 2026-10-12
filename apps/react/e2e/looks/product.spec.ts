// product 템플릿 — Apple 제품 페이지처럼: 흰·검정 바탕, 큰 문장, 큰 화면, 큰 숫자
import { test } from '../fixtures';
import {
	expectEmptyRendered,
	expectLinks,
	expectOnlyFeatures,
	expectSampleRendered,
	expectTheme,
	openEmpty,
	openSample,
} from './landing';

test('product: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'product');
	await expectSampleRendered(article);
	await expectLinks(page, article);
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
