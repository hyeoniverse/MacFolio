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
		await expect(activity.getByRole('table', { name: '출처 / 매체 / 캠페인' })).toHaveCount(0);
		await expect(activity.getByText('UTM 링크 만들기')).toHaveCount(0);
		await expect(activity.getByRole('heading', { name: '관리자만 볼 수 있습니다' })).toBeVisible();
		// 방문자 화면 어디에도 utm 값이 없다
		await expect(activity).not.toContainText(/resume|recruit|kakao-2026|linkedin \/|footer/);

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

	test('관리자 (#211): 매체·조합 표, 조합을 누르면 일별 추이, term·content는 값이 있을 때만', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '유입 경로' }).click();

		const combos = activity.getByRole('table', { name: '출처 / 매체 / 캠페인' });
		await expect(combos.locator('tbody tr')).toHaveText([
			/^resume \/ recruit \/ kakao-202625/,
			/^resume \/ - \/ -15/,
			/^linkedin \/ social \/ -12/,
		]);
		await expect(activity.getByRole('table', { name: '매체 (utm_medium)' })).toContainText('recruit25');
		await expect(activity.getByText('이 기능을 배포한 날부터 셉니다').first()).toBeVisible();
		await expect(activity.getByRole('table', { name: '내용 (utm_content)' })).toContainText('footer3');
		await expect(activity.getByRole('table', { name: '검색어 (utm_term)' })).toHaveCount(0);

		await combos.getByRole('button', { name: 'resume / recruit / kakao-2026' }).click();
		await expect(combos.getByRole('button', { name: 'resume / recruit / kakao-2026' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const trend = activity.getByRole('region', { name: 'resume / recruit / kakao-2026 일별 방문' });
		await expect(
			trend.getByRole('img', { name: /^resume \/ recruit \/ kakao-2026 일별 방문: 2026-10-01 0회/ })
		).toBeVisible();
		expect(api.analyticsQueries.at(-1)).toContain(`utm=${encodeURIComponent('resume / recruit / kakao-2026')}`);
		// 다시 누르면 접힌다
		await combos.getByRole('button', { name: 'resume / recruit / kakao-2026' }).click();
		await expect(trend).toHaveCount(0);
	});

	test('관리자 (#211): UTM 링크 만들기로 만든 주소를 열면 그 조합이 표에 1 늘어난다', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '유입 경로' }).click();
		const combos = activity.getByRole('table', { name: '출처 / 매체 / 캠페인' });
		await expect(combos.locator('tbody tr', { hasText: 'linkedin / social / -' })).toContainText('12');

		await activity.getByText('UTM 링크 만들기').click();
		const builder = activity.locator('.utm-builder');
		const copy = activity.getByRole('button', { name: '복사', exact: true });
		await expect(copy).toBeDisabled();
		await builder.getByLabel('대상 주소').fill('/memo/cra-to-vite');
		await builder.getByLabel('출처 (utm_source)').fill('LinkedIn');
		await builder.getByLabel('매체 (utm_medium)').fill('Social');
		const output = activity.getByRole('status', { name: '완성된 주소' });
		await expect(output).toHaveText(/\/memo\/cra-to-vite\?utm_source=linkedin&utm_medium=social$/);
		await copy.click();
		await expect(activity.getByRole('button', { name: '복사함' })).toBeVisible();
		const link = await page.evaluate(() => navigator.clipboard.readText());
		expect(link).toBe(await output.textContent());

		// 방문자가 그 주소를 연다 (같은 가짜 서버로 보낸다)
		const visitor = await context.newPage();
		const other = await fakeApi(visitor);
		other.analytics = api.analytics;
		await visitor.addInitScript(() => {
			window.__MACFOLIO_ANALYTICS__ = true;
		});
		const url = new URL(link);
		await enterDesktop(visitor, `${url.pathname}${url.search}`);
		await expect.poll(() => new URL(visitor.url()).search).toBe('');
		await visitor.evaluate(() => {
			Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
			document.dispatchEvent(new Event('visibilitychange'));
		});
		await expect.poll(() => api.analytics.length).toBeGreaterThan(0);

		// 다시 물으면 그 조합이 1 늘었다
		await activity.getByLabel('기간').selectOption('30d');
		await expect(combos.locator('tbody tr', { hasText: 'linkedin / social / -' })).toContainText('13');
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

	test('서버 탭 (종량제): 이번 달 요금과 예산 한도, 키가 없으면 넣는 방법', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		const base = {
			mode: 'payg',
			shape: 'VM.Standard.E2.1.Micro',
			networkMbps: 50,
			latest: null,
			series: [],
			alert: { mailReady: true, lastSentAt: null },
		};
		api.resources = {
			...base,
			billing: {
				configured: true,
				error: null,
				data: {
					monthToDate: 0.85,
					currency: 'USD',
					updatedAt: new Date().toISOString(),
					budgets: [
						{ displayName: '월 1달러', amount: 1, actualSpend: 0.85, forecastedSpend: 0.95, resetPeriod: 'MONTHLY' },
					],
				},
			},
		};
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '서버' }).click();

		await expect(activity.getByRole('region', { name: '서버 상태' })).toContainText('종량제');
		await expect(activity.getByRole('region', { name: '서버 상태' })).toContainText(
			'예산의 80%·100%를 넘으면 보냅니다'
		);
		await expect(activity.getByRole('table', { name: '유휴 회수 기준' })).toHaveCount(0);
		const billing = activity.getByRole('region', { name: '요금' });
		await expect(billing).toContainText('이번 달 US$0.85');
		await expect(billing).toContainText('US$0.85 / US$1.00 (85%)');
		await expect(billing.getByRole('meter', { name: '월 1달러 예산 사용' })).toHaveAttribute('aria-valuenow', '85');

		api.resources = { ...base, billing: { configured: false, error: null, data: null } };
		await activity.getByRole('tab', { name: '개요' }).click();
		await activity.getByRole('tab', { name: '서버' }).click();
		await expect(activity.getByRole('region', { name: '요금' })).toContainText('OCI_TENANCY_OCID');
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
	test('관리자: 검색어 탭에서 Search Console의 검색어·페이지를 보고, 페이지를 골라 그 검색어만 보고, 지금 가져온다', async ({
		page,
	}) => {
		const api = await fakeApi(page, { signedIn: true });
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '검색어' }).click();

		await expect(activity.locator('.search-console-bar')).toContainText('10월 5일까지의 자료');
		// 검색어마다 클릭·노출을 더하고 순위는 노출로 가중한 평균 ((1.4×240 + 3.5×60) / 300 = 1.8). 노출 많은 순
		const queries = activity.getByRole('table', { name: '검색어', exact: true });
		await expect(queries.locator('tbody tr')).toHaveText([
			/^macfolio203001\.8$/,
			/^macos 포트폴리오 사이트61807\.2$/,
			/^cra vite 마이그레이션91505\.1$/,
			/^milkdown 편집기3448\.8$/,
		]);
		// 순위를 누르면 작은 것(위)부터
		await queries.getByRole('button', { name: '순위' }).click();
		await expect(queries.locator('tbody tr').first()).toContainText('macfolio');
		await expect(queries.locator('tbody tr').last()).toContainText('milkdown');

		// 블로그 글 페이지는 글 제목으로. 누르면 그 페이지의 검색어만
		const pages = activity.getByRole('table', { name: '페이지' });
		await expect(pages).toContainText('macfolio.hyeoniverse.com');
		await pages.getByRole('button', { name: '메모 › CRA에서 Vite로 옮기기' }).click();
		const filtered = activity.getByRole('table', { name: '검색어 · 메모 › CRA에서 Vite로 옮기기' });
		// 고른 정렬(순위)은 그대로
		await expect(filtered.locator('tbody tr')).toHaveText([/^macfolio2603\.5$/, /^cra vite 마이그레이션91505\.1$/]);

		// 검색엔진이 넘겨준 방문의 검색어
		await expect(activity.getByRole('table', { name: '검색엔진이 넘겨준 검색어' })).toContainText('김정현 포트폴리오2');

		await activity.getByRole('button', { name: '지금 가져오기' }).click();
		await expect.poll(() => api.searchSyncs).toBe(1);
		await expect(activity.locator('.search-console-bar')).toContainText('10월 8일 12:00에 가져옴');
	});

	test('검색어: 서버에 Search Console이 없으면 켜는 방법을 보인다', async ({ page }) => {
		const api = await fakeApi(page, { signedIn: true });
		api.searchKeywords = { ...api.searchKeywords, configured: false, rows: [], syncedAt: null, latestDay: null };
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '검색어' }).click();
		await expect(activity).toContainText('GSC_SITE_URL·GSC_CLIENT_EMAIL·GSC_PRIVATE_KEY');
		await expect(activity.getByRole('button', { name: '지금 가져오기' })).toHaveCount(0);
	});

	test('검색어 탭은 방문자에게 관리자만 볼 수 있다고 보이고, 검색어는 어디에도 없다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		await activity.getByRole('tab', { name: '검색어' }).click();
		await expect(
			activity.getByText('검색어는 누가 무엇을 찾다 들어왔는지 드러날 수 있어 관리자에게만 보입니다.')
		).toBeVisible();
		await activity.getByRole('tab', { name: '유입 경로' }).click();
		await expect(activity).not.toContainText(/김정현 포트폴리오|macos 포트폴리오/);
	});

	test('보기 탭은 ←·→ 키로 옮기며 고르고, Tab으로는 고른 탭에만 들어온다', async ({ page }) => {
		await fakeApi(page);
		await enterDesktop(page);
		await dockItem(page, 'launchpad').click();
		await page.locator('.launchpad-modal').getByRole('button', { name: 'activity', exact: true }).click();
		const activity = appWindow(page, 'activity');
		const tabs = activity.getByRole('tablist', { name: '보기' });
		const overview = tabs.getByRole('tab', { name: '개요' });
		await expect(overview).toHaveAttribute('tabindex', '0');
		await expect(tabs.getByRole('tab', { name: '유입 경로' })).toHaveAttribute('tabindex', '-1');

		await overview.focus();
		await page.keyboard.press('ArrowRight');
		await expect(tabs.getByRole('tab', { name: '유입 경로' })).toBeFocused();
		await expect(tabs.getByRole('tab', { name: '유입 경로' })).toHaveAttribute('aria-selected', 'true');
		await expect(activity.getByRole('table', { name: '묶어 보기' })).toBeVisible();

		// 처음에서 ←는 끝으로, End·Home은 끝·처음으로
		await page.keyboard.press('Home');
		await expect(overview).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowLeft');
		await expect(tabs.getByRole('tab', { name: '서버' })).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Home');
		await expect(overview).toBeFocused();
	});
});
