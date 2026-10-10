import { describe, expect, it } from 'vitest';
import {
	clockLabel,
	summaryOf,
	describeCode,
	hourLabel,
	iconOf,
	localClock,
	toWeather,
	uvLevel,
	windFrom,
	type ForecastResponse,
} from './forecast';

/** 서울, 2026-10-10 오전 7:45 (그곳 시각), 맑음 */
function response(): ForecastResponse {
	const hours = Array.from({ length: 48 }, (_, index) => {
		const day = index < 24 ? '10' : '11';
		return `2026-10-${day}T${String(index % 24).padStart(2, '0')}:00`;
	});
	const days = Array.from({ length: 10 }, (_, index) => `2026-10-${String(10 + index).padStart(2, '0')}`);
	return {
		utc_offset_seconds: 32400,
		timezone: 'Asia/Seoul',
		current: {
			time: '2026-10-10T07:45',
			temperature_2m: 13.8,
			relative_humidity_2m: 93,
			apparent_temperature: 14.3,
			is_day: 1,
			precipitation: 0,
			weather_code: 0,
			wind_speed_10m: 0.64,
			wind_direction_10m: 39,
		},
		hourly: {
			time: hours,
			temperature_2m: hours.map((_, index) => 10 + (index % 24) / 2),
			weather_code: hours.map((_, index) => (index === 15 ? 63 : 2)),
			precipitation_probability: hours.map((_, index) => (index === 15 ? 70 : 10)),
			is_day: hours.map((_, index) => (index % 24 >= 7 && index % 24 < 18 ? 1 : 0)),
		},
		daily: {
			time: days,
			weather_code: days.map((_, index) => (index === 2 ? 61 : 1)),
			temperature_2m_max: days.map((_, index) => 22 + index),
			temperature_2m_min: days.map((_, index) => 12 - (index % 3)),
			sunrise: days.map((day) => `${day}T06:35`),
			sunset: days.map((day) => `${day}T18:02`),
			uv_index_max: days.map(() => 5.3),
			precipitation_probability_max: days.map((_, index) => (index === 2 ? 63 : 5)),
		},
	};
}

describe('날씨 값 바꾸기', () => {
	it('WMO 코드 → 한국어·하늘 모양·아이콘 (낮과 밤)', () => {
		expect(describeCode(0)).toEqual({ label: '맑음', sky: 'clear' });
		expect(describeCode(95).label).toBe('뇌우');
		expect(describeCode(1234)).toEqual({ label: '알 수 없음', sky: 'cloudy' });
		expect(iconOf(0, true)).toBe('fa-sun');
		expect(iconOf(0, false)).toBe('fa-moon');
		expect(iconOf(2, false)).toBe('fa-cloud-moon');
		expect(iconOf(65, true)).toBe('fa-cloud-showers-heavy');
		expect(iconOf(73, true)).toBe('fa-snowflake');
	});

	it('시각과 바람', () => {
		expect(hourLabel('2026-10-10T00:00')).toBe('오전 12시');
		expect(hourLabel('2026-10-10T15:00')).toBe('오후 3시');
		expect(clockLabel('2026-10-10T18:02')).toBe('오후 6:02');
		expect(windFrom(0)).toBe('북풍');
		expect(windFrom(39)).toBe('북동풍');
		expect(windFrom(359)).toBe('북풍');
		expect(windFrom(-90)).toBe('서풍');
		expect(localClock(32400, Date.parse('2026-10-09T22:45:00Z'))).toBe('오전 7:45');
	});

	it('자외선 지수 단계', () => {
		expect([1, 4, 7, 9, 12].map(uvLevel)).toEqual(['낮음', '보통', '높음', '매우 높음', '위험']);
	});

	it('지금 날씨, 지금부터 24시간, 오늘부터 10일', () => {
		const weather = toWeather(response());
		expect(weather).toMatchObject({
			temp: 14,
			feelsLike: 14,
			label: '맑음',
			sky: 'clear',
			day: true,
			icon: 'fa-sun',
			high: 22,
			low: 12,
			humidity: 93,
			wind: 0.6,
			windFrom: '북동풍',
			uv: 5.3,
			sunrise: '오전 6:35',
			sunset: '오후 6:02',
			utcOffset: 32400,
		});
		// 07시 칸부터: 첫 칸은 '지금'이고 지금 기온·날씨
		expect(weather.hours).toHaveLength(24);
		expect(weather.hours[0]).toEqual({ label: '지금', temp: 14, icon: 'fa-sun', condition: '맑음', rain: null });
		expect(weather.hours[1].label).toBe('오전 8시');
		// 비 올 확률은 30% 이상일 때만
		expect(weather.hours[8]).toMatchObject({ label: '오후 3시', icon: 'fa-cloud-showers-heavy', rain: 70 });
		expect(weather.hours[17].icon).toBe('fa-cloud-moon');

		expect(weather.days).toHaveLength(10);
		expect(weather.days.map((day) => day.label).slice(0, 3)).toEqual(['오늘', '일', '월']);
		expect(weather.days[2]).toMatchObject({ icon: 'fa-cloud-showers-heavy', rain: 63 });
		expect(weather.range).toEqual({ min: 10, max: 31 });
	});

	it('시간별 위의 문장: 날씨가 처음 바뀌는 시각과 돌풍', () => {
		const hours = [
			{ label: '지금', condition: '흐림' },
			{ label: '오후 10시', condition: '흐림' },
			{ label: '오전 12시', condition: '구름 조금' },
		];
		expect(summaryOf(hours, 3.2)).toBe('오전 12시쯤 구름 조금 상태가 예상됩니다. 돌풍의 풍속은 최대 3m/s입니다.');
		expect(summaryOf(hours.slice(0, 2), null)).toBe('앞으로 2시간 동안 흐림 상태가 이어집니다.');
		expect(toWeather(response()).summary).toBe('오전 8시쯤 구름 조금 상태가 예상됩니다.');
	});
});
