// keynote 템플릿 — 진짜 발표 슬라이드: 세로 스크롤 없이 16:9 무대에 한 장씩, ←·→·Space·무대 누르기로 넘기고, 얇은 진행 줄과 "3 / 18" 차례,
// 슬라이드 목록(G), 발표자 노트(N), 트러블슈팅의 문제 → 원인 → 해결 → 결과 빌드. 지금 장의 구역만 페이지에 있으므로(계약의 '열면 보이는' 변형)
// 공통 도우미 expectSampleRendered 대신 끝까지 넘기며 구역이 차례대로 하나씩 나오고 내용이 모두 보이는지 본다.
// 무대라는 콘셉트라서 사이트 테마와 상관없이 언제나 검은 바탕이다: 라이트·다크 모두 같은 바탕색을 확인한다
import type { Locator } from '@playwright/test';
import { appWindow, expect, test } from '../fixtures';
import {
	expectEmptyRendered,
	expectSampleHero,
	expectTheme,
	openEmpty,
	openSample,
	sampleRegionTexts,
} from './landing';
import { GENERAL_SAMPLE } from '../../src/apps/settings/lookSamples';

const nextButton = (article: Locator) => article.getByRole('button', { name: '다음 슬라이드' });

/** 끝까지 넘기며 장마다의 구역 이름과 글, 그림 주소를 모은다 */
async function walk(article: Locator) {
	const seen: { label: string | null; text: string; images: string[] }[] = [];
	for (let guard = 0; guard < 80; guard++) {
		const region = article.getByRole('region');
		const count = await region.count();
		expect(count, '한 번에 구역 하나').toBeLessThanOrEqual(1);
		if (count === 1)
			seen.push({
				label: await region.getAttribute('aria-label'),
				text: (await region.textContent()) ?? '',
				images: await region.locator('img').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') ?? '')),
			});
		const next = nextButton(article);
		if (await next.isDisabled()) return seen;
		await next.click();
	}
	throw new Error('마지막 장에 닿지 못했습니다.');
}

test('keynote: 표지에서 끝까지 넘기면 예시의 모든 구역이 차례대로 하나씩 나온다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	await expectSampleHero(article);
	await expect(article.locator('.kn-counter')).toContainText('1 /');
	await expect(article.getByRole('region')).toHaveCount(0);

	const seen = await walk(article);
	const order = seen.map((entry) => entry.label).filter((label, i, all) => label !== all[i - 1]);
	expect(order).toEqual(sampleRegionTexts().map(([label]) => label));
	for (const [label, texts] of sampleRegionTexts()) {
		const all = seen
			.filter((entry) => entry.label === label)
			.map((entry) => entry.text)
			.join('\n');
		for (const text of texts) expect(all, `${label}: ${text}`).toContain(text);
	}
	// 기능의 그림과 화면 여러 장
	const featureImages = seen.filter((entry) => entry.label === '주요 기능').flatMap((entry) => entry.images);
	for (const point of GENERAL_SAMPLE.highlights)
		for (const src of [point.image, ...(point.shots ?? []).map((shot) => shot.src)].filter(Boolean))
			expect(featureImages).toContain(src);
	// 마지막 장: 마무리와 링크
	await expect(article.getByRole('heading', { level: 1 })).toHaveText(GENERAL_SAMPLE.tagline);
	await expect(article.getByText('감사합니다.')).toBeVisible();
});

test('keynote: 표지와 마지막 장에 링크 묶음이 있고, 여기서 열기는 이 사이트의 앱 창을 연다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	const github = article.getByRole('link', { name: 'GitHub에서 보기' });
	await expect(github).toHaveCount(1);
	await expect(github).toHaveAttribute('href', 'https://github.com/hyeoniverse/QRU');
	await expect(github).toHaveAttribute('target', '_blank');
	await expect(article.locator('[data-primary]')).toHaveAttribute('data-link', 'app');
	await expect(article.getByRole('link', { name: '새 탭에서 열기' })).toHaveAttribute(
		'href',
		'https://qryou-app.web.app'
	);

	await nextButton(article).click();
	await page.keyboard.press('End');
	await expect(article.getByText('감사합니다.')).toBeVisible();
	await expect(article.getByRole('link', { name: 'GitHub에서 보기' })).toHaveCount(1);
	await article.getByRole('button', { name: '여기서 열기' }).click();
	await expect(appWindow(page, 'qru')).toBeVisible();
});

test('keynote: 키와 무대 누르기로 넘기고, 진행 줄과 차례가 따라간다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	const counter = article.locator('.kn-counter');
	const total = (await counter.textContent())?.split('/')[1].trim();
	await nextButton(article).click();
	await expect(counter).toHaveText(`슬라이드 2 / ${total}`);
	await page.keyboard.press('ArrowRight');
	await expect(counter).toHaveText(`슬라이드 3 / ${total}`);
	await page.keyboard.press('ArrowLeft');
	await expect(counter).toHaveText(`슬라이드 2 / ${total}`);
	await article.locator('.kn-stage').click({ position: { x: 20, y: 20 } });
	await expect(counter).toHaveText(`슬라이드 3 / ${total}`);
	await page.keyboard.press('Home');
	await expect(counter).toHaveText(`슬라이드 1 / ${total}`);
	await expect(article.getByRole('button', { name: '이전 슬라이드' })).toBeDisabled();
});

test('keynote: 트러블슈팅은 문제부터 결과까지 한 단계씩 쌓는다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	await page.keyboard.press('g');
	const sorter = article.getByRole('dialog', { name: '슬라이드 목록' });
	const [first] = GENERAL_SAMPLE.troubleshooting ?? [];
	// 바로 앞 장(구현 방법)에서 넘어오면 첫 단계만 보인다
	await sorter.getByRole('button', { name: '구현 방법' }).click();
	await page.keyboard.press('ArrowRight');
	const region = article.getByRole('region', { name: '트러블슈팅' });
	await expect(region).toBeAttached();
	const steps = region.locator('.kn-builds > li');
	await expect(steps).toHaveCount(4);
	await expect(region.locator('.kn-builds > li[data-built]')).toHaveCount(1);
	await page.keyboard.press('ArrowRight');
	await expect(region.locator('.kn-builds > li[data-built]')).toHaveCount(2);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(region.locator('.kn-builds > li[data-built]')).toHaveCount(4);
	await expect(region).toContainText(first.result ?? '');
});

test('keynote: 슬라이드 목록(G)에서 장을 고르고, 발표자 노트(N)는 긴 설명을 보인다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	await article.getByRole('button', { name: '슬라이드 목록' }).click();
	const sorter = article.getByRole('dialog', { name: '슬라이드 목록' });
	await expect(sorter.getByRole('button')).toHaveCount(
		Number((await article.locator('.kn-counter').textContent())?.split('/')[1])
	);
	const [feature] = GENERAL_SAMPLE.highlights;
	await sorter.getByRole('button', { name: feature.title }).click();
	await expect(sorter).toHaveCount(0);
	const region = article.getByRole('region', { name: '주요 기능' });
	await expect(region.getByRole('heading', { name: feature.title })).toBeVisible();
	await expect(region.getByText(feature.detail ?? '')).toBeHidden();
	await page.keyboard.press('n');
	await expect(region.getByText(feature.detail ?? '')).toBeVisible();
	await expect(article.getByRole('button', { name: '발표자 노트' })).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('g');
	await expect(article.getByRole('dialog', { name: '슬라이드 목록' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(article.getByRole('dialog', { name: '슬라이드 목록' })).toHaveCount(0);
});

test('keynote: 고를 수 있는 칸이 모두 빈 프로젝트는 표지와 마지막 장 두 장이다', async ({ page }) => {
	const { article } = await openEmpty(page, 'keynote');
	await expectEmptyRendered(article);
	await expect(article.locator('.kn-counter')).toHaveText('슬라이드 1 / 2');
	await nextButton(article).click();
	await expect(article.getByRole('region')).toHaveCount(0);
	await expect(article.getByRole('link', { name: 'GitHub에서 보기' })).toBeVisible();
});

test('keynote: 주요 기능만 있으면 그 구역의 장 하나만 있다', async ({ page }) => {
	const { article } = await openEmpty(page, 'keynote', {
		highlights: [{ title: '한 화면', body: '할 일과 메모를 나란히 둡니다.', icon: 'fa-bolt' }],
	});
	await expect(article.locator('.kn-counter')).toHaveText('슬라이드 1 / 3');
	await nextButton(article).click();
	await expect(article.getByRole('region')).toHaveCount(1);
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features).toContainText('한 화면');
	await expect(features).toContainText('할 일과 메모를 나란히 둡니다.');
	await expect(features.locator('.fa-bolt').first()).toBeVisible();
});

test('keynote: 테마와 상관없이 검은 무대 위에 그린다', async ({ page }) => {
	await expectTheme(page, 'keynote', { light: 'rgb(0, 0, 0)', dark: 'rgb(0, 0, 0)' });
});
