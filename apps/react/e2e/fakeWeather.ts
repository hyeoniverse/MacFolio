// 날씨 앱의 바깥 데이터(Open-Meteo)를 가짜로 (weather.spec.ts, mobile.spec.ts)
import type { Page } from '@playwright/test';

/** Open-Meteo 일기예보 응답 (그곳 시각 오전 7:45, 맑음). latitude로 기온을 조금씩 다르게 */
function forecast(latitude: number) {
	const base = Math.round(latitude / 2);
	const hours = Array.from(
		{ length: 48 },
		(_, index) => `2026-10-${index < 24 ? '10' : '11'}T${String(index % 24).padStart(2, '0')}:00`
	);
	const days = Array.from({ length: 10 }, (_, index) => `2026-10-${String(10 + index).padStart(2, '0')}`);
	return {
		utc_offset_seconds: 32400,
		timezone: 'Asia/Seoul',
		current: {
			time: '2026-10-10T07:45',
			temperature_2m: base,
			relative_humidity_2m: 61,
			apparent_temperature: base - 2,
			is_day: 1,
			precipitation: 0.4,
			weather_code: 0,
			wind_speed_10m: 3.2,
			wind_direction_10m: 90,
		},
		hourly: {
			time: hours,
			temperature_2m: hours.map((_, index) => base + (index % 24) / 4),
			weather_code: hours.map((_, index) => (index === 15 ? 63 : 2)),
			precipitation_probability: hours.map((_, index) => (index === 15 ? 70 : 0)),
			is_day: hours.map((_, index) => (index % 24 >= 7 && index % 24 < 18 ? 1 : 0)),
		},
		daily: {
			time: days,
			weather_code: days.map((_, index) => (index === 2 ? 61 : 1)),
			temperature_2m_max: days.map((_, index) => base + 6 + index),
			temperature_2m_min: days.map(() => base - 3),
			sunrise: days.map((day) => `${day}T06:35`),
			sunset: days.map((day) => `${day}T18:02`),
			uv_index_max: days.map(() => 5.3),
			precipitation_probability_max: days.map((_, index) => (index === 2 ? 63 : 5)),
		},
	};
}

/** Open-Meteo를 가짜로: 일기예보와 장소 찾기. failForecast면 일기예보는 500 */
export async function fakeWeather(page: Page, { failForecast = false } = {}) {
	const asked = { forecast: [] as string[], search: [] as string[] };
	await page.route('https://api.open-meteo.com/v1/forecast?**', (route) => {
		const url = new URL(route.request().url());
		asked.forecast.push(url.searchParams.get('latitude')!);
		if (failForecast) return route.fulfill({ status: 500, body: 'error' });
		return route.fulfill({ json: forecast(Number(url.searchParams.get('latitude'))) });
	});
	await page.route('https://geocoding-api.open-meteo.com/v1/search?**', (route) => {
		const name = new URL(route.request().url()).searchParams.get('name')!;
		asked.search.push(name);
		const results =
			name.toLowerCase() === 'reykjavik'
				? [
						{
							name: 'Reykjavík',
							latitude: 64.1355,
							longitude: -21.8954,
							country: '아이슬란드',
							admin1: '수도권',
							feature_code: 'PPLC',
							population: 118918,
						},
						{
							name: 'Reykjavik',
							latitude: 50.36,
							longitude: -96.7,
							country: '캐나다',
							admin1: '매니토바주',
							feature_code: 'PPL',
						},
					]
				: [];
		return route.fulfill({ json: results.length ? { results } : {} });
	});
	return asked;
}
