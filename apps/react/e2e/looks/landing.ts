// 네 랜딩 템플릿(product·friendly·paper·bento) 시험이 함께 쓰는 것. 템플릿은 같은 내용(landingOf)을 그리므로
// 같은 예시(편집 화면의 '예시로 채우기'와 같은 것)로 모든 구역이 보이는지, 빈 프로젝트도 빈 구역 없이 그려지는지, 링크와 테마를 본다
import type { Locator, Page } from '@playwright/test';
import { appWindow, expect } from '../fixtures';
import { openLook, type LookOptions } from './open';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';
import { SECTION_LABELS, SECTION_ORDER } from '../../src/apps/safari/project/landing/content';

/** 코드의 프로젝트(QRU) 하나를 예시 내용으로 덮는다 (QRU 고유의 폴더·로고는 지운다). 앱과 데모 주소는 QRU 것 그대로 */
const sampleOverride = (look: string) => ({
	...structuredClone(GENERAL_SAMPLE),
	look,
	galleryFolder: null,
	logo: null,
});

/** 고를 수 있는 칸을 모두 비운 QRU (꼭 있어야 하는 칸은 빈 값) */
const emptyOverride = (look: string, extra: Record<string, unknown> = {}) => ({
	look,
	name: '빈 프로젝트',
	tagline: '',
	description: '',
	context: '',
	facts: [],
	highlights: [],
	build: [],
	contributions: [],
	specs: [],
	stack: [],
	language: '',
	image: '',
	role: null,
	period: null,
	usage: null,
	chapters: null,
	timeline: null,
	gallery: null,
	galleryFolder: null,
	credits: null,
	controls: null,
	structure: null,
	logo: null,
	icon: null,
	...extra,
});

export async function openSample(page: Page, look: string, options?: LookOptions) {
	const opened = await openLook(page, { id: 'qru', tab: /북클럽/, override: sampleOverride(look) }, options);
	const article = opened.panel.getByRole('article', { name: GENERAL_SAMPLE.name });
	await expect(article).toHaveAttribute('data-look', look);
	return { ...opened, article };
}

export async function openEmpty(page: Page, look: string, extra?: Record<string, unknown>) {
	const opened = await openLook(page, { id: 'qru', tab: /빈 프로젝트/, override: emptyOverride(look, extra) });
	const article = opened.panel.getByRole('article', { name: '빈 프로젝트' });
	await expect(article).toHaveAttribute('data-look', look);
	return { ...opened, article };
}

/** 이 구역 안에 이 글들이 모두 있다 (스크롤해 들어오게 한 뒤) */
export async function expectRegion(article: Locator, label: string, texts: string[]) {
	const region = article.getByRole('region', { name: label, exact: true });
	await region.scrollIntoViewIfNeeded();
	await expect(region).toBeVisible();
	for (const text of texts) await expect(region, `${label}: ${text}`).toContainText(text);
	return region;
}

/** 예시의 구역마다 보여야 하는 글 (구역 이름 → 글), 구역 차례대로 */
export function sampleRegionTexts(): [string, string[]][] {
	const sample = GENERAL_SAMPLE;
	return [
		['한눈에 보는 숫자', sample.facts.flatMap((fact) => [fact.value, fact.label])],
		['주요 기능', sample.highlights.flatMap((point) => [point.title, point.body])],
		['화면 모음', (sample.gallery ?? []).map((shot) => shot.caption)],
		['쓰는 법', (sample.usage ?? []).map((point) => point.title)],
		['만든 방식', sample.build.map((point) => point.title)],
		[
			'더 들려줄 이야기',
			(sample.chapters ?? []).flatMap((chapter) => [
				chapter.title,
				chapter.lead ?? '',
				...chapter.points.map((p) => p.title),
			]),
		],
		['조작법', (sample.controls ?? []).map((control) => control.label)],
		['진행 과정', (sample.timeline ?? []).map((entry) => entry.label)],
		['기술 사양', [...sample.specs.map((spec) => spec.value), ...sample.stack, 'progress/']],
		['맡은 일', sample.contributions],
		['출처', (sample.credits ?? []).map((credit) => credit.name)],
	];
}

/** 주요 기능 구역이 항목의 그림과 화면 여러 장도 그린다 */
export async function expectFeatureMedia(features: Locator) {
	for (const point of GENERAL_SAMPLE.highlights)
		for (const src of [point.image, ...(point.shots ?? []).map((shot) => shot.src)].filter(Boolean))
			await expect(features.locator(`img[src="${src}"]`).first()).toBeAttached();
}

/** 첫 화면: 한 줄이 큰 제목, 소개 글, 대표 그림 */
export async function expectSampleHero(article: Locator) {
	const sample = GENERAL_SAMPLE;
	await expect(article.getByRole('heading', { level: 1 })).toHaveText(sample.tagline);
	await expect(article).toContainText(sample.description);
	await expect(article.locator(`img[src="${sample.image}"]`).first()).toBeAttached();
}

/** 예시의 모든 구역과 칸이 페이지에 있다 */
export async function expectSampleRendered(article: Locator) {
	await expectSampleHero(article);

	// 구역은 정해진 차례대로, 빠짐없이
	const labels = await article
		.getByRole('region')
		.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));
	expect(labels).toEqual(SECTION_ORDER.map((kind) => SECTION_LABELS[kind]));

	for (const [label, texts] of sampleRegionTexts()) {
		const region = await expectRegion(article, label, texts);
		if (label === '주요 기능') await expectFeatureMedia(region);
	}
}

/** 링크: 첫 화면과 마무리에 같은 묶음. GitHub·데모는 새 탭, 여기서 열기는 이 사이트의 앱 창 */
export async function expectLinks(page: Page, article: Locator) {
	const github = article.getByRole('link', { name: 'GitHub에서 보기' });
	await expect(github).toHaveCount(2);
	await expect(github.first()).toHaveAttribute('href', 'https://github.com/hyeoniverse/QRU');
	await expect(github.first()).toHaveAttribute('target', '_blank');
	await expect(article.getByRole('link', { name: '새 탭에서 열기' }).first()).toHaveAttribute(
		'href',
		'https://qryou-app.web.app'
	);
	await page.route('https://qryou-app.web.app/**', (route) =>
		route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>데모 첫 화면</h1>' })
	);
	await article.getByRole('button', { name: '여기서 열기' }).first().click();
	await expect(appWindow(page, 'qru')).toBeVisible();
}

/** 빈 프로젝트: 첫 화면(이름이 큰 제목)과 마무리만, 구역은 하나도 없다 */
export async function expectEmptyRendered(article: Locator) {
	await expect(article.getByRole('heading', { level: 1 })).toHaveText('빈 프로젝트');
	await expect(article.getByRole('region')).toHaveCount(0);
	await expect(article.getByRole('link', { name: 'GitHub에서 보기' }).first()).toBeVisible();
	await expect(article.locator('img')).toHaveCount(0);
}

/** 주요 기능 하나만 있는 프로젝트: 그 구역 하나만 생기고, 그림이 없는 항목은 아이콘으로 그린다 */
export async function expectOnlyFeatures(page: Page, look: string) {
	const { article } = await openEmpty(page, look, {
		highlights: [{ title: '한 화면', body: '할 일과 메모를 나란히 둡니다.', icon: 'fa-bolt' }],
	});
	await expect(article.getByRole('region')).toHaveCount(1);
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features).toContainText('한 화면');
	await expect(features).toContainText('할 일과 메모를 나란히 둡니다.');
	await expect(features.locator('.fa-bolt').first()).toBeVisible();
}

/** 사이트 테마를 따른다: 기기가 다크면 다크 바탕 (처음 방문은 기기의 화면 모드를 따른다) */
export async function expectTheme(page: Page, look: string, colors: { light: string; dark: string }) {
	const background = (article: Locator) =>
		article.locator('.tpl, .dl').evaluate((node) => getComputedStyle(node).backgroundColor);
	const light = await openSample(page, look);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await background(light.article)).toBe(colors.light);
	await page.emulateMedia({ colorScheme: 'dark' });
	const dark = await openSample(page, look);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await background(dark.article)).toBe(colors.dark);
}
