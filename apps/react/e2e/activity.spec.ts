import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import { fakeApi } from './fakeApi';

test.describe("'활동 상태 보기' 앱 (#102)", () => {
	test('방문자에게는 Launchpad에 없고, 열어도(터미널 open) 잠긴 화면만 보인다', async ({ page }) => {
		const api = await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		const launchpad = page.locator('.launchpad-modal');
		await expect(launchpad.getByRole('button', { name: 'apidocs', exact: true })).toBeVisible();
		await expect(launchpad.getByRole('button', { name: 'activity', exact: true })).toHaveCount(0);
		await launchpad.click({ position: { x: 5, y: 5 } });

		await dockItem(page, 'terminal').click();
		const input = appWindow(page, 'terminal').getByRole('textbox', { name: '명령어 입력' });
		await input.fill('open activity');
		await input.press('Enter');
		const activity = appWindow(page, 'activity');
		await expect(activity.getByRole('heading', { name: '관리자만 볼 수 있습니다' })).toBeVisible();
		await expect(activity.getByRole('tablist')).toHaveCount(0);
		expect(api.analyticsQueries).toEqual([]);
	});

	test('관리자: 개요(앞 기간 대비, 그래프, 많이 연 앱·들어온 곳) → 탭과 기간을 바꾸고 표를 정렬한다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');

		// 개요: 기본 기간 7일
		await expect(activity.getByRole('tab', { name: '개요' })).toHaveAttribute('aria-selected', 'true');
		const stats = activity.locator('.activity-stats');
		await expect(stats).toContainText('방문1,284▲ +12%');
		await expect(stats).toContainText('순방문자902▼ -5%');
		await expect(stats).toContainText('평균 머문 시간2분 41초');
		await expect(activity.getByRole('img', { name: /^일별 방문: 2026-10-01 150회/ })).toBeVisible();
		await expect(activity.getByRole('table', { name: '가장 많이 연 앱' }).locator('tbody tr').first()).toContainText(
			'메모900'
		);
		await expect(activity.getByRole('table', { name: '가장 많이 들어온 곳' })).toContainText('직접 들어옴');
		expect(api.analyticsQueries[0]).toMatch(/^\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/);

		// 기간을 바꾸면 다시 묻는다
		await activity.getByLabel('기간').selectOption('30d');
		await expect.poll(() => api.analyticsQueries.length).toBe(2);

		// 유입 경로: 묶어 보기(검색·소셜·직접·링크)와 캠페인
		await activity.getByRole('tab', { name: '유입 경로' }).click();
		const groups = activity.getByRole('table', { name: '묶어 보기' });
		await expect(groups.locator('tbody tr')).toHaveText([/^링크412/, /^직접301/, /^소셜188/, /^검색90/]);
		await expect(activity.getByRole('table', { name: '캠페인 (utm_campaign)' })).toContainText('kakao-2026');

		// 머리를 누르면 정렬: 이름순(한국어 순서라 한글이 먼저) → 다시 누르면 반대로
		const referrers = activity.getByRole('table', { name: '들어온 곳' });
		await referrers.getByRole('button', { name: '이름' }).click();
		await expect(referrers.locator('tbody tr td.name')).toHaveText([
			'직접 들어옴',
			'github.com',
			'www.google.com',
			'www.linkedin.com',
		]);
		await referrers.getByRole('button', { name: '이름' }).click();
		await expect(referrers.locator('tbody tr td.name').first()).toHaveText('www.linkedin.com');

		// 앱·글, 지역·기기
		await activity.getByRole('tab', { name: '앱·글' }).click();
		await expect(activity.getByRole('table', { name: '글·프로젝트' })).toContainText('메모 › cra-to-vite');
		await activity.getByRole('tab', { name: '지역·기기' }).click();
		await expect(activity.getByRole('table', { name: '나라' })).toContainText('대한민국 (KR)');
		await expect(activity.getByRole('table', { name: '기기' })).toContainText('모바일');
	});

	test('관리자: 실시간에서 방문을 누르면 흐름(들어옴 → 앱 열기 → 글 보기 → 링크)이 펼쳐진다', async ({ page }) => {
		await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '실시간' }).click();

		await expect(activity.getByRole('heading', { name: '최근 30분 · 1개 방문' })).toBeVisible();
		const visit = activity.getByRole('button', { name: /대한민국 \(KR\).*github\.com.*203\.0\.113\.x/ });
		await visit.click();
		await expect(visit).toHaveAttribute('aria-expanded', 'true');
		await expect(activity.getByRole('list', { name: '방문 흐름' }).getByRole('listitem')).toHaveText([
			/들어옴$/,
			/메모 열기$/,
			/메모 › cra-to-vite 보기$/,
			/github\.com\/hyeoniverse 누름$/,
		]);
	});
});
