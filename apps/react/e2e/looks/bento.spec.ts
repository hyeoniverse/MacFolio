// bento 템플릿 — Framer·Raycast 템플릿처럼: 소개·대표 화면·숫자 타일로 바로 시작하는 첫 격자, 크기가 다른 타일, 1px 선, 고정폭 이름표
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

test('bento: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'bento');
	await expectSampleRendered(article);
	await expectLinks(page, article);
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
