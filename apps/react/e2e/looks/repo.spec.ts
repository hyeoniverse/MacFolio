// repo 템플릿 — GitHub 저장소 화면처럼: 탭(Code·Commits·Conventions), 파일 트리, README에 모든 구역, 커밋 그래프와 타입 거르기, 터미널 서랍
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
import { openLook } from './open';

const tabs = (scope: import('@playwright/test').Locator) => scope.getByRole('navigation', { name: '저장소 탭' });

test('repo: 예시의 모든 구역과 칸을 차례대로 그리고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'repo');
	await expectSampleRendered(article);
	await expectLinks(page, article);
});

test('repo: 폴더 구조로 만든 파일 트리를 펼치고, 커밋을 타입으로 거르고, 서랍 터미널에 명령을 친다', async ({
	page,
}) => {
	const { article } = await openSample(page, 'repo');

	// Safari 창의 탭과 섞이지 않게 저장소 탭은 단추(aria-current)다
	await expect(tabs(article).getByRole('button', { name: 'Code' })).toHaveAttribute('aria-current', 'page');
	await expect(article.getByRole('tab')).toHaveCount(0);

	// 파일 트리: server를 펼치면 routes와 progress가 나온다
	const tree = article.getByRole('tree', { name: '파일' });
	await expect(tree.locator('[data-path="server/progress"]')).toHaveCount(0);
	await tree.getByRole('button', { name: /^server/ }).click();
	await expect(tree.locator('[data-path="server/progress"]')).toContainText('진도별 글 가리기');

	// Commits: 진행 과정 일곱 걸음이 커밋이 되고, 타입으로 거르면 줄어든다
	await tabs(article)
		.getByRole('button', { name: /Commits/ })
		.click();
	const commits = article.locator('.rp-commit');
	await expect(commits).toHaveCount(7);
	await expect(article.getByRole('region')).toHaveCount(0);
	const filters = article.getByRole('group', { name: '커밋 타입으로 거르기' });
	await filters.getByRole('button', { name: 'feat', exact: true }).click();
	const shown = await commits.count();
	expect(shown).toBeGreaterThan(0);
	expect(shown).toBeLessThan(7);
	await expect(commits.first().locator('.rp-badge')).toHaveText('feat');

	// 터미널 서랍: 열고 whoami를 치면 서랍 안에 맡은 일이 나온다. ls와 cd는 폴더 구조를 돌아본다
	await article.getByRole('button', { name: '터미널' }).click();
	const drawer = article.getByRole('complementary', { name: '터미널' });
	await expect(drawer).toBeVisible();
	const input = drawer.getByRole('textbox', { name: '명령 입력' });
	await input.fill('whoami');
	await input.press('Enter');
	await expect(drawer).toContainText('진도별로 글을 가리는 토론 화면과 서버 응답 설계');
	await input.fill('cd server');
	await input.press('Enter');
	await expect(drawer.getByRole('button', { name: /progress/ })).toBeVisible();
	await input.press('Escape');
	await expect(drawer).toBeHidden();
});

test('repo: 저장소 트리가 있는 DevCourse는 파일을 골라 내용을 읽고, 커밋 규칙 탭이 생긴다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'devcourse', tab: /DevCourse/, look: 'repo' });

	// 파일 트리: Week02 → 03 → Readme.md 를 누르면 오른쪽에 내용이 보인다
	const tree = panel.getByRole('tree', { name: '파일' });
	await tree.getByRole('button', { name: 'Week02', exact: true }).click();
	await tree.getByRole('button', { name: '03', exact: true }).click();
	await tree.locator('[data-path="Week02/03/Readme.md"]').click();
	await expect(panel.getByRole('figure', { name: '파일 내용' })).toContainText('CSS의 이해');
	await expect(panel.getByRole('navigation', { name: '경로' })).toContainText('Readme.md');

	// Commits: 커밋 규칙의 practice 타입으로 거르면 목록이 줄어든다
	await tabs(panel)
		.getByRole('button', { name: /Commits/ })
		.click();
	const commits = panel.locator('.rp-commit');
	const all = await commits.count();
	expect(all).toBeGreaterThan(2);
	await panel.getByRole('button', { name: 'practice', exact: true }).click();
	await expect(commits).not.toHaveCount(all);
	await expect(commits.first().locator('.rp-badge')).toHaveText('practice');

	// Conventions 표
	await tabs(panel)
		.getByRole('button', { name: /Conventions/ })
		.click();
	await expect(panel.getByRole('table')).toContainText('practice');

	// 서랍의 셸은 실제 저장소를 돌아본다
	await panel.getByRole('button', { name: '터미널' }).click();
	const input = panel.getByRole('textbox', { name: '명령 입력' });
	await input.fill('cat Week02/03/Readme.md');
	await input.press('Enter');
	await expect(panel.getByRole('complementary', { name: '터미널' })).toContainText('CSS의 이해');
});

test('repo: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 첫 화면과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'repo');
	await expectEmptyRendered(article);
	// 커밋이 없으면 Commits 탭도 없다
	await expect(tabs(article).getByRole('button')).toHaveCount(1);
});

test('repo: 주요 기능만 있으면 그 구역 하나만 그린다', async ({ page }) => {
	await expectOnlyFeatures(page, 'repo');
});

test('repo: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'repo', { light: 'rgb(255, 255, 255)', dark: 'rgb(13, 17, 23)' });
});
