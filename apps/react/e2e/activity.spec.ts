import { test, expect, enterDesktop, appWindow, dockItem } from './fixtures';
import { fakeApi } from './fakeApi';

test.describe("'활동 상태 보기' 앱 (#102)", () => {
	test('방문자도 Launchpad에서 열어 공개 숫자를 본다. 들어온 곳의 주소·캠페인과 실시간은 관리자만', async ({
		page,
	}) => {
		const api = await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');

		await expect(activity.locator('.activity-stats')).toContainText('방문1,284▲ +12%');
		await expect(activity.getByRole('table', { name: '가장 많이 연 앱' })).toContainText('메모900');
		// 들어온 곳은 주소 대신 묶음으로
		await expect(activity.getByRole('table', { name: '가장 많이 들어온 곳' })).toHaveCount(0);
		await expect(activity.getByRole('table', { name: '들어온 곳' })).toContainText('링크412');

		await activity.getByRole('tab', { name: '유입 경로' }).click();
		await expect(activity.getByRole('table', { name: '묶어 보기' }).locator('tbody tr')).toHaveText([
			/^링크412/,
			/^직접301/,
			/^소셜188/,
			/^검색90/,
		]);
		await expect(activity.getByRole('table', { name: '들어온 곳' })).toHaveCount(0);
		await expect(activity.getByRole('table', { name: '캠페인 (utm_campaign)' })).toHaveCount(0);
		await expect(activity.getByRole('heading', { name: '관리자만 볼 수 있습니다' })).toBeVisible();

		await activity.getByRole('tab', { name: '실시간' }).click();
		await expect(activity.getByRole('heading', { name: '관리자만 볼 수 있습니다' })).toBeVisible();
		await expect(activity.getByRole('button', { name: '관리자 로그인…' })).toBeVisible();
		expect(api.analyticsQueries.some((query) => query.includes('minutes'))).toBe(false);
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

		// 기간을 바꾸면 다시 묻는다 (메뉴 막대의 배터리도 최근 7일을 물으므로 늘어난 수로 센다)
		const asked = api.analyticsQueries.length;
		await activity.getByLabel('기간').selectOption('30d');
		await expect.poll(() => api.analyticsQueries.length).toBe(asked + 1);

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
		// 블로그 글은 제목으로: 전체 기간 조회수와 이 기간의 보기
		await expect(activity.getByRole('table', { name: '블로그 글 조회수 (전체 기간)' }).locator('tbody tr')).toHaveText([
			/^CRA에서 Vite로 옮기기42/,
			/^Markdown 블로그에 글쓰기 붙이기7/,
		]);
		await expect(activity.getByRole('table', { name: '글·프로젝트 (이 기간)' })).toContainText(
			'메모 › CRA에서 Vite로 옮기기'
		);
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

	test('블로그 글 머리에 조회수 (전체 기간). 서버가 없으면 감춘다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(memo.locator('.memo-reader-date')).toContainText('조회 42');
		await memo.locator('.memo-item', { hasText: 'Markdown 블로그에 글쓰기 붙이기' }).click();
		await expect(memo.locator('.memo-reader-date')).toContainText('조회 7');
	});

	test('서버가 없으면 블로그 글에 조회수가 없다', async ({ page }) => {
		await enterDesktop(page, '/memo/cra-to-vite');
		const memo = appWindow(page, 'memo');
		await expect(memo.getByRole('article').getByRole('heading', { level: 1 })).toHaveText('CRA에서 Vite로 옮기기');
		await expect(memo.locator('.memo-reader-date')).not.toContainText('조회');
	});

	test('서버 탭: 방문자에게는 잠겨 있고, 관리자에게는 사용률과 유휴 회수 위험이 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const now = Date.now();
		api.resources = {
			mode: 'free',
			shape: 'VM.Standard.E2.1.Micro',
			networkMbps: 50,
			latest: { at: new Date(now).toISOString(), cpu: 3.2, memory: 41, network: 0.3 },
			series: Array.from({ length: 48 }, (_, index) => ({
				at: new Date(now - (48 - index) * 3_600_000).toISOString(),
				cpu: 3,
				memory: 40,
				network: 0.25,
			})),
			risk: {
				level: 'danger',
				days: 2,
				conditions: [
					{ metric: 'cpu', measure: '95퍼센타일', value: 4.1, threshold: 20, below: true },
					{ metric: 'network', measure: '평균', value: 0.5, threshold: 20, below: true },
				],
			},
			alert: { mailReady: true, lastSentAt: null },
		};
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '서버' }).click();

		const summary = activity.getByRole('region', { name: '서버 상태' });
		await expect(summary).toContainText('Always Free');
		await expect(summary).toContainText('회수 위험');
		await expect(summary).toContainText('2일치로 미리 본 값');
		await expect(summary).toContainText('위험해지면 보냅니다');
		await expect(activity.getByRole('table', { name: '유휴 회수 기준' }).locator('tbody tr')).toHaveText([
			/CPU \(95퍼센타일\)4\.1%20% 미만걸림/,
			/네트워크 \(평균\)0\.5%20% 미만걸림/,
		]);
		await expect(activity.getByRole('img', { name: 'CPU 최근 7일' })).toBeVisible();
		// 기간 고르기는 서버 탭에 없다
		await expect(activity.getByRole('combobox')).toHaveCount(0);

		// 서버에서 꺼 두면 켜는 방법을 알려 준다
		api.resources = { mode: 'off' };
		// 탭을 다시 열면 다시 묻는다
		await activity.getByRole('tab', { name: '개요' }).click();
		await activity.getByRole('tab', { name: '서버' }).click();
		await expect(activity.getByRole('heading', { name: '서버 자원 감시가 꺼져 있습니다' })).toBeVisible();
	});

	test('서버 탭은 관리자만', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '서버' }).click();
		await expect(activity.getByText('서버 자원 사용률과 Oracle 유휴 회수 위험은 관리자에게만 보입니다.')).toBeVisible();
	});
});
