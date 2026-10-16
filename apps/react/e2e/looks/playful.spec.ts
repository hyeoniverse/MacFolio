// playful 템플릿 — 스크랩북 게시판: 포스터와 폴라로이드·붙임쪽지의 첫 화면, 이름표 붙은 자리마다 우표·붙임쪽지·폴라로이드·뒤집는 색인 카드·
// 사진 부스 띠·점선 길·입장권·영수증, 마무리 엽서
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

test('playful: 트러블슈팅 카드는 뒤집으면 해결이 보이고 초점이 뒷면 단추로 간다', async ({ page }) => {
	const { article } = await openSample(page, 'playful');
	const trouble = article.getByRole('region', { name: '트러블슈팅' });
	await trouble.scrollIntoViewIfNeeded();
	const card = trouble.locator('.pf-flip').first();
	const item = GENERAL_SAMPLE.troubleshooting![0];
	await expect(card.locator('.pf-front')).toContainText(item.problem);
	await expect(card.locator('.pf-back')).toContainText(item.solution);
	await expect(card.locator('.pf-back')).toHaveAttribute('inert', '');
	await card.getByRole('button', { name: '뒤집어서 해결 보기' }).click();
	await expect(card).toHaveAttribute('data-flipped', '');
	await expect(card.locator('.pf-front')).toHaveAttribute('inert', '');
	await expect(card.locator('.pf-back .pf-flip-button')).toBeFocused();
	// 움직임 줄이기에서는 돌지 않고 바로 바뀐다
	expect(await card.locator('.pf-flip-inner').evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
	await page.keyboard.press('Enter');
	await expect(card).not.toHaveAttribute('data-flipped', '');
	await expect(card.locator('.pf-front .pf-flip-button')).toBeFocused();
});

test('playful: 배포 결과물은 실제 주소로 가는 입장권이다', async ({ page }) => {
	const { article } = await openSample(page, 'playful');
	const deployments = article.getByRole('region', { name: '배포 결과물' });
	await deployments.scrollIntoViewIfNeeded();
	const first = GENERAL_SAMPLE.deployments![0];
	await expect(deployments.locator('.pf-ticket')).toHaveCount(GENERAL_SAMPLE.deployments!.length);
	await expect(deployments.getByRole('link', { name: first.label })).toHaveAttribute('href', first.url!);
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
