// keynote 템플릿 — Apple 키노트 무대와 Linear 출시 페이지처럼: 검은 무대 위의 장면들, 아주 큰 두 줄 제목, 틀 안으로 떠오르는 화면,
// 기능 하나가 한 장면(큰 01), 세어 올라가는 숫자 한 줄, 슬라이드 차례의 쓰는 법, 어두운 사양표, 마지막 타이틀 카드.
// 무대라는 콘셉트라서 사이트 테마와 상관없이 언제나 검은 바탕이다: 라이트·다크 모두 같은 바탕색을 확인한다
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

test('keynote: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('keynote: 화면 모음은 아래 목록에서 고른 장을 무대에 크게 띄운다', async ({ page }) => {
	const { article } = await openSample(page, 'keynote');
	const screens = article.getByRole('region', { name: '화면 모음', exact: true });
	await screens.scrollIntoViewIfNeeded();
	const [first, second] = GENERAL_SAMPLE.gallery ?? [];
	const stage = screens.locator('figure').first();
	await expect(stage.locator(`img[src="${first.src}"]`)).toBeVisible();
	const pick = screens.getByRole('button', { name: second.caption });
	await expect(pick).toHaveAttribute('aria-pressed', 'false');
	await pick.click();
	await expect(pick).toHaveAttribute('aria-pressed', 'true');
	await expect(stage.locator(`img[src="${second.src}"]`)).toBeVisible();
	await expect(stage).toContainText(second.caption);
});

test('keynote: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'keynote');
	await expectEmptyRendered(article);
});

test('keynote: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'keynote');
});

test('keynote: 테마와 상관없이 검은 무대 위에 그린다', async ({ page }) => {
	await expectTheme(page, 'keynote', { light: 'rgb(0, 0, 0)', dark: 'rgb(0, 0, 0)' });
});
