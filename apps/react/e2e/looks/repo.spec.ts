// 저장소 모양(repo): GitHub 저장소 화면처럼 탭·파일 트리·커밋 그래프·터미널 서랍이 움직이는지
import { test, expect } from '../fixtures';
import { openLook } from './open';

test('repo: 파일 트리를 펼쳐 읽고, 커밋을 타입으로 거르고, 서랍 터미널에 명령을 친다', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'devcourse', tab: /DevCourse/ });

	// 저장소 트리가 있으니 Code 탭이 먼저 골라져 있다
	await expect(
		panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'Code' })
	).toHaveAttribute('aria-current', 'page');

	// 파일 트리: Week02 → 03 → Readme.md 를 누르면 오른�there 내용이 보인다
	const tree = panel.getByRole('tree');
	await tree.getByRole('button', { name: 'Week02', exact: true }).click();
	await tree.getByRole('button', { name: '03', exact: true }).click();
	await tree.locator('[data-path="Week02/03/Readme.md"]').click();
	const file = panel.getByRole('region', { name: '파일 내용' });
	await expect(file).toContainText('CSS의 이해');
	await expect(panel.getByRole('navigation', { name: '경로' })).toContainText('Readme.md');

	// Commits: practice 뱃지로 거르면 목록이 줄어든다
	await panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'Commits' }).click();
	const commits = panel.locator('.rp-commit');
	const all = await commits.count();
	expect(all).toBeGreaterThan(2);
	await panel.getByRole('button', { name: 'practice', exact: true }).click();
	await expect(commits).not.toHaveCount(all);
	expect(await commits.count()).toBeGreaterThan(0);
	await expect(commits.first().locator('.rp-badge')).toHaveText('practice');

	// Conventions 표
	await panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'Conventions' }).click();
	await expect(panel.getByRole('table')).toContainText('practice');

	// About: 맡은 일과 기술 사양
	await panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'About' }).click();
	await expect(panel.getByRole('region', { name: '맡은 일' })).toContainText('커밋 컨벤션 설계');
	await expect(panel.getByRole('region', { name: '기술 사양' })).toContainText('Express');

	// 터미널 서랍: 열고 whoami를 치면 서랍 안에 결과가 나온다
	await panel.getByRole('button', { name: '터미널' }).click();
	const drawer = panel.getByRole('region', { name: '터미널' });
	await expect(drawer).toBeVisible();
	await drawer.getByRole('textbox', { name: '명령 입력' }).fill('whoami');
	await drawer.getByRole('textbox', { name: '명령 입력' }).press('Enter');
	await expect(drawer.getByRole('region', { name: '맡은 일' })).toContainText('커밋 컨벤션 설계');
});

test('repo: 저장소 트리가 없는 프로젝트는 Code 탭 없이 README부터', async ({ page }) => {
	const { panel } = await openLook(page, { id: 'qru', tab: /QRU/, look: 'repo' });
	await expect(panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'Code' })).toHaveCount(
		0
	);
	await expect(
		panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'README' })
	).toHaveAttribute('aria-current', 'page');
	await expect(panel.getByRole('region', { name: '주요 기능' })).toContainText('명함 만들기');
	await panel.getByRole('navigation', { name: '저장소 탭' }).getByRole('button', { name: 'About' }).click();
	await expect(panel.getByRole('region', { name: '맡은 일' })).toBeVisible();
});
