// playful 템플릿 — Figma·Arc 출시 페이지처럼: 크림 바탕, 고정 팔레트의 색 카드, 둥근 숫자 배지, 기운 스티커, 굽이치는 단계, 산호색 마무리
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

test('playful: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'playful');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('playful: 큰 제목의 한 낱말에 물결을 긋고, 글은 그대로 읽힌다', async ({ page }) => {
	const { article } = await openSample(page, 'playful');
	const title = article.getByRole('heading', { level: 1 });
	await expect(title).toHaveText(GENERAL_SAMPLE.tagline);
	await expect(title.locator('.pf-mark svg')).toHaveCount(1);
});

test('playful: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'playful');
	await expectEmptyRendered(article);
});

test('playful: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'playful');
});

test('playful: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'playful', { light: 'rgb(255, 248, 238)', dark: 'rgb(23, 21, 26)' });
});
