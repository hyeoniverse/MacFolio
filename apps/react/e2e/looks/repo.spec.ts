// repo 템플릿 — GitHub 저장소 화면처럼: 탭(Code·Commits·Conventions), 파일 트리, README 상자의 문서 탭(README.md와 docs/*.md에
// 구역을 하나씩), 커밋 그래프와 타입 거르기, 터미널 서랍.
// 구역이 문서마다 나뉘어 한 번에 한 문서만 보이므로, 공통 시험(expectSampleRendered) 대신 문서 탭을 차례로 열며 구역을 확인한다
import type { Locator } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
	expectEmptyRendered,
	expectFeatureMedia,
	expectLinks,
	expectRegion,
	expectSampleHero,
	expectTheme,
	openEmpty,
	openSample,
	sampleRegionTexts,
} from './landing';
import { openLook } from './open';
import { SECTION_LABELS, SECTION_ORDER } from '../../src/apps/safari/project/landing/content';

const tabs = (scope: Locator) => scope.getByRole('navigation', { name: '저장소 탭' });
const docTabs = (scope: Locator) => scope.getByRole('navigation', { name: '문서' });
const regionLabels = (scope: Locator) =>
	scope.getByRole('region').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label')));

test('repo: 문서 탭을 차례로 열면 예시의 모든 구역이 정해진 차례대로 나오고, 링크가 열린다', async ({ page }) => {
	const { article } = await openSample(page, 'repo');
	await expectSampleHero(article);
	const texts = new Map(sampleRegionTexts());

	// README가 처음 열린 문서이고, 문서 탭은 README와 구역마다 하나
	const buttons = docTabs(article).getByRole('button');
	await expect(buttons).toHaveCount(SECTION_ORDER.length);
	await expect(buttons.first()).toHaveText('README');
	await expect(buttons.first()).toHaveAttribute('aria-current', 'page');
	await expect(article.getByRole('tab')).toHaveCount(0);

	const seen: (string | null)[] = [];
	for (let i = 0; i < SECTION_ORDER.length; i += 1) {
		await buttons.nth(i).click();
		await expect(buttons.nth(i)).toHaveAttribute('aria-current', 'page');
		await expect(docTabs(article).locator('[aria-current]')).toHaveCount(1);
		// 페이지의 h1은 어느 문서에서나 하나다 (README가 아니면 숨긴 제목)
		await expect(article.getByRole('heading', { level: 1 })).toHaveCount(1);
		// 한 번에 한 문서만: 보이는 구역은 이 문서의 것뿐이다
		const labels = await regionLabels(article);
		expect(labels).toHaveLength(1);
		const [label] = labels;
		const region = await expectRegion(article, label ?? '', texts.get(label ?? '') ?? []);
		if (label === '주요 기능') await expectFeatureMedia(region);
		seen.push(label);
	}
	expect(seen).toEqual(SECTION_ORDER.map((kind) => SECTION_LABELS[kind]));

	// 경로 줄은 열린 문서의 blob 주소를 보여 준다
	await expect(article.locator('.rp-doc-blob')).toHaveText('blob/main/docs/CREDITS.md');

	// README의 목차에서 다른 문서로 간다
	await buttons.first().click();
	await article
		.locator('.rp-toc')
		.getByRole('button', { name: /기술 사양/ })
		.click();
	await expect(docTabs(article).getByRole('button', { name: '기술 사양' })).toHaveAttribute('aria-current', 'page');
	await expect(article.getByRole('region', { name: '기술 사양' })).toContainText('progress/');

	await expectLinks(page, article);
});

test('repo: 파일 트리의 docs/ 문서를 누르면 README 상자가 그 문서를 열고, 터미널도 docs/를 본다', async ({ page }) => {
	const { article } = await openSample(page, 'repo');
	// 첫 화면 없이 저장소 화면으로 열리고, 가지 줄의 Code 단추가 clone 주소 창을 연다
	await expect(article.locator('.rp-branch-row')).toContainText('7 Tags');
	await article.locator('.rp-branch-row').getByRole('button', { name: 'Code' }).click();
	await expect(
		article.getByRole('dialog', { name: '저장소 가져오기' }).getByRole('textbox', { name: 'clone 주소' })
	).toHaveValue('https://github.com/hyeoniverse/QRU.git');
	await page.keyboard.press('Escape');

	const tree = article.getByRole('tree', { name: '파일' });
	await tree.getByRole('button', { name: /^docs/ }).click();
	await tree.locator('[data-path="docs/USAGE.md"]').click();
	await expect(docTabs(article).getByRole('button', { name: '쓰는 법' })).toHaveAttribute('aria-current', 'page');
	const usage = article.getByRole('region', { name: '쓰는 법' });
	await expect(usage).toBeInViewport();
	await expect(article.locator('.rp-doc-blob')).toHaveText('blob/main/docs/USAGE.md');
	await expect(tree.locator('[data-path="docs/USAGE.md"]')).toHaveClass(/selected/);

	// README.md 줄은 README로 돌아간다
	await article.locator('.rp-readme-row').click();
	await expect(docTabs(article).getByRole('button', { name: 'README' })).toHaveAttribute('aria-current', 'page');

	// 터미널: ls docs와 cat
	await article.getByRole('button', { name: '터미널' }).click();
	const drawer = article.getByRole('complementary', { name: '터미널' });
	const input = drawer.getByRole('textbox', { name: '명령 입력' });
	await input.fill('ls docs');
	await input.press('Enter');
	await expect(drawer.getByRole('button', { name: /USAGE\.md/ })).toBeVisible();
	await expect(drawer.getByRole('button', { name: /CHANGELOG\.md/ })).toBeVisible();
	await input.fill('cat docs/USAGE.md');
	await input.press('Enter');
	await expect(drawer.locator('.rp-t-pre').last()).toContainText('## 쓰는 법');
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

test('repo: 고를 수 있는 칸이 모두 빈 프로젝트도 빈 구역 없이 README의 큰 제목과 마무리를 그린다', async ({ page }) => {
	const { article } = await openEmpty(page, 'repo');
	await expectEmptyRendered(article);
	// 커밋이 없으면 Commits 탭도 없고, 문서는 큰 제목(h1)을 담은 README 하나뿐이다
	await expect(tabs(article).getByRole('button')).toHaveCount(1);
	await expect(docTabs(article).getByRole('button')).toHaveText(['README']);
});

test('repo: 주요 기능만 있으면 README와 FEATURES.md 두 문서이고, 구역은 FEATURES.md의 하나뿐이다', async ({ page }) => {
	const { article } = await openEmpty(page, 'repo', {
		highlights: [{ title: '한 화면', body: '할 일과 메모를 나란히 둡니다.', icon: 'fa-bolt' }],
	});
	const buttons = docTabs(article).getByRole('button');
	await expect(buttons).toHaveText(['README', '주요 기능']);
	// README에는 구역이 없고 목차만 있다
	await expect(article.getByRole('region')).toHaveCount(0);
	await expect(article.locator('.rp-toc')).toContainText('docs/FEATURES.md');
	await buttons.nth(1).click();
	await expect(article.getByRole('region')).toHaveCount(1);
	const features = article.getByRole('region', { name: '주요 기능' });
	await expect(features).toContainText('한 화면');
	await expect(features).toContainText('할 일과 메모를 나란히 둡니다.');
	await expect(features.locator('.fa-bolt').first()).toBeVisible();
});

test('repo: 사이트 테마를 따른다', async ({ page }) => {
	await expectTheme(page, 'repo', { light: 'rgb(255, 255, 255)', dark: 'rgb(13, 17, 23)' });
});
