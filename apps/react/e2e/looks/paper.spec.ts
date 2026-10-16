// paper 템플릿 — Notion 문서처럼: 따뜻한 흰 바탕, 속성 표, 토글, 알림 상자
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

test('paper: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'paper');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('paper: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'paper');
	await expectEmptyRendered(article);
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
