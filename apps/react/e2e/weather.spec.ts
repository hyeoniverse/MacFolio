import { test, expect, enterDesktop, dockItem, appWindow } from './fixtures';
import type { Page } from '@playwright/test';
import { fakeWeather } from './fakeWeather';

async function openWeather(page: Page) {
	await enterDesktop(page);
	await dockItem(page, 'launchpad').click();
	await page.locator('.launchpad-modal').getByRole('button', { name: 'weather', exact: true }).click();
	return appWindow(page, 'weather');
}

test.describe('날씨', () => {
	test('처음에는 서울: 지금 기온·날씨, 최고·최저, 시간별 24칸, 10일, 상세 칸, 데이터 출처', async ({ page }) => {
		const asked = await fakeWeather(page);
		const weather = await openWeather(page);
		const main = weather.getByRole('main', { name: '서울 날씨' });
		await expect(main.getByRole('heading', { level: 1 })).toHaveText('서울');
		// 위도 37.5665 → 19°
		await expect(main.getByLabel('현재 기온 19도')).toHaveText('19°');
		await expect(main).toContainText('맑음');
		await expect(main).toContainText('최고:25° 최저:16°');

		const hours = main.getByRole('region', { name: '시간별 일기예보' }).locator('li');
		await expect(hours).toHaveCount(24);
		await expect(hours.first()).toContainText('지금');
		// 오후 3시: 비 70%
		await expect(hours.nth(8)).toContainText('오후 3시');
		await expect(hours.nth(8)).toContainText('70%');

		const days = main.getByRole('region', { name: '10일간의 일기예보' }).locator('li');
		await expect(days).toHaveCount(10);
		await expect(days.first()).toContainText('오늘');
		await expect(days.nth(2)).toContainText('63%');

		await expect(main.getByRole('region', { name: '체감 온도' })).toContainText('17°');
		await expect(main.getByRole('region', { name: '습도' })).toContainText('61%');
		await expect(main.getByRole('region', { name: '바람' })).toContainText('3.2m/s');
		await expect(main.getByRole('region', { name: '바람' })).toContainText('동풍');
		await expect(main.getByRole('region', { name: '자외선 지수' })).toContainText('보통');
		await expect(main.getByRole('region', { name: '일출' })).toContainText('오전 6:35');
		await expect(main.getByRole('link', { name: 'Open-Meteo.com' })).toBeVisible();

		// 사이드바의 카드
		const card = weather.getByRole('navigation', { name: '장소' }).locator('.weather-card button').first();
		await expect(card).toHaveAttribute('aria-current', 'true');
		await expect(card).toContainText('19°');
		expect(asked.forecast).toEqual(['37.5665']);
	});

	test('한국어 이름은 내장 도시에서 바로 찾고, 더한 장소는 이 브라우저에 남는다', async ({ page }) => {
		await fakeWeather(page);
		const weather = await openWeather(page);
		const sidebar = weather.getByRole('navigation', { name: '장소' });
		await sidebar.getByRole('searchbox', { name: '도시 검색' }).fill('도쿄');
		await sidebar.getByRole('list', { name: '검색 결과' }).getByRole('button', { name: /도쿄/ }).click();

		await expect(weather.getByRole('main', { name: '도쿄 날씨' })).toBeVisible();
		const cards = sidebar.locator('.weather-card');
		await expect(cards).toHaveCount(2);
		// 카드의 첫 단추가 고르기, 둘째(올리면 보이는 ×)가 지우기
		await expect(cards.nth(1).locator('button').first()).toHaveAttribute('aria-current', 'true');

		// 다시 열어도 남아 있다
		await page.reload();
		const again = await openWeather(page);
		await expect(again.getByRole('navigation', { name: '장소' }).locator('.weather-card')).toHaveCount(2);
	});

	test('영어 이름은 Open-Meteo로 찾고, 수도·큰 도시가 먼저 온다. 같은 곳은 한 번만 더한다', async ({ page }) => {
		const asked = await fakeWeather(page);
		const weather = await openWeather(page);
		const sidebar = weather.getByRole('navigation', { name: '장소' });
		const search = sidebar.getByRole('searchbox', { name: '도시 검색' });
		await search.fill('Reykjavik');
		const results = sidebar.getByRole('list', { name: '검색 결과' }).getByRole('button');
		await expect(results).toHaveCount(2);
		await expect(results.first()).toContainText('Reykjavík');
		await expect(results.first()).toContainText('아이슬란드 수도권');
		expect(asked.search).toContain('Reykjavik');

		// 이미 있는 서울을 다시 고르면 더하지 않고 그 카드로 간다
		await search.fill('seoul');
		await sidebar.getByRole('list', { name: '검색 결과' }).getByRole('button', { name: /서울/ }).click();
		await expect(sidebar.locator('.weather-card')).toHaveCount(1);
	});

	test('장소를 지우면 목록에서 빠지고, 마지막 하나는 지울 수 없다', async ({ page }) => {
		await fakeWeather(page);
		const weather = await openWeather(page);
		const sidebar = weather.getByRole('navigation', { name: '장소' });
		await expect(sidebar.getByRole('button', { name: '서울 삭제' })).toHaveCount(0);
		await sidebar.getByRole('searchbox', { name: '도시 검색' }).fill('부산');
		await sidebar.getByRole('list', { name: '검색 결과' }).getByRole('button', { name: /부산/ }).click();
		await expect(sidebar.locator('.weather-card')).toHaveCount(2);

		await sidebar.locator('.weather-card').nth(1).hover();
		await sidebar.getByRole('button', { name: '부산 삭제' }).click();
		await expect(sidebar.locator('.weather-card')).toHaveCount(1);
		await expect(weather.getByRole('main', { name: '서울 날씨' })).toBeVisible();
	});

	test('날씨를 불러오지 못하면 알리고 다시 시도할 수 있다', async ({ page }) => {
		const asked = await fakeWeather(page, { failForecast: true });
		const weather = await openWeather(page);
		const main = weather.getByRole('main', { name: '서울 날씨' });
		await expect(main).toContainText('날씨를 불러오지 못했습니다.');
		await main.getByRole('button', { name: '다시 시도' }).click();
		await expect.poll(() => asked.forecast.length).toBe(2);
	});
});
