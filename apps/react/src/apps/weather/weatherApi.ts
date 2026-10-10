// 날씨 데이터: Open-Meteo (키 없이 쓰는 공개 API, CC BY 4.0). 사이트의 CSP connect-src에 두 주소를 열어 두었다 (worker/securityHeaders.ts)
import type { ForecastResponse } from './forecast';
import type { GeocodingResult } from './places';

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const CURRENT = [
	'temperature_2m',
	'relative_humidity_2m',
	'apparent_temperature',
	'is_day',
	'precipitation',
	'weather_code',
	'wind_speed_10m',
	'wind_direction_10m',
];
const HOURLY = ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'];
const DAILY = [
	'weather_code',
	'temperature_2m_max',
	'temperature_2m_min',
	'sunrise',
	'sunset',
	'uv_index_max',
	'precipitation_probability_max',
	'wind_gusts_10m_max',
];

/** 기온 단위: 섭씨(c), 화씨(f) */
export type TemperatureUnit = 'c' | 'f';

/** 그곳의 지금 날씨, 시간별(이틀), 일별(10일). 시각은 그곳의 시간대로 온다 (timezone=auto). 기온은 unit으로 */
export async function fetchForecast(
	latitude: number,
	longitude: number,
	signal?: AbortSignal,
	unit: TemperatureUnit = 'c'
) {
	const params = new URLSearchParams({
		latitude: String(latitude),
		longitude: String(longitude),
		current: CURRENT.join(','),
		hourly: HOURLY.join(','),
		daily: DAILY.join(','),
		timezone: 'auto',
		forecast_days: '10',
		wind_speed_unit: 'ms',
		...(unit === 'f' ? { temperature_unit: 'fahrenheit' } : {}),
	});
	const response = await fetch(`${FORECAST_URL}?${params}`, { signal });
	if (!response.ok) throw new Error(`forecast ${response.status}`);
	return (await response.json()) as ForecastResponse;
}

/** 이름으로 장소 찾기. 없으면 빈 목록 */
export async function searchPlaces(name: string, signal?: AbortSignal): Promise<GeocodingResult[]> {
	const params = new URLSearchParams({ name, count: '10', language: 'ko', format: 'json' });
	const response = await fetch(`${GEOCODING_URL}?${params}`, { signal });
	if (!response.ok) throw new Error(`geocoding ${response.status}`);
	const body = (await response.json()) as { results?: GeocodingResult[] };
	return body.results ?? [];
}
