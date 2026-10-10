// 날씨 앱의 값 바꾸기: Open-Meteo 응답 → 화면에 그릴 모양. React와 상관없는 순수 함수만 둔다 (forecast.test.ts)

/** 하늘 모양: 배경 색과 아이콘을 고른다 */
export type Sky = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

interface CodeInfo {
	label: string;
	sky: Sky;
}

/** WMO 날씨 코드 (Open-Meteo의 weather_code) → 한국어와 하늘 모양 */
const CODES: Record<number, CodeInfo> = {
	0: { label: '맑음', sky: 'clear' },
	1: { label: '대체로 맑음', sky: 'clear' },
	2: { label: '구름 조금', sky: 'partly' },
	3: { label: '흐림', sky: 'cloudy' },
	45: { label: '안개', sky: 'fog' },
	48: { label: '안개', sky: 'fog' },
	51: { label: '약한 이슬비', sky: 'drizzle' },
	53: { label: '이슬비', sky: 'drizzle' },
	55: { label: '강한 이슬비', sky: 'drizzle' },
	56: { label: '어는 이슬비', sky: 'drizzle' },
	57: { label: '어는 이슬비', sky: 'drizzle' },
	61: { label: '약한 비', sky: 'rain' },
	63: { label: '비', sky: 'rain' },
	65: { label: '강한 비', sky: 'rain' },
	66: { label: '어는 비', sky: 'rain' },
	67: { label: '어는 비', sky: 'rain' },
	71: { label: '약한 눈', sky: 'snow' },
	73: { label: '눈', sky: 'snow' },
	75: { label: '강한 눈', sky: 'snow' },
	77: { label: '싸락눈', sky: 'snow' },
	80: { label: '약한 소나기', sky: 'rain' },
	81: { label: '소나기', sky: 'rain' },
	82: { label: '강한 소나기', sky: 'rain' },
	85: { label: '소낙눈', sky: 'snow' },
	86: { label: '강한 소낙눈', sky: 'snow' },
	95: { label: '뇌우', sky: 'storm' },
	96: { label: '우박을 동반한 뇌우', sky: 'storm' },
	99: { label: '우박을 동반한 뇌우', sky: 'storm' },
};

export const describeCode = (code: number): CodeInfo => CODES[code] ?? { label: '알 수 없음', sky: 'cloudy' };

/** 하늘 모양과 낮·밤 → Font Awesome 아이콘 (fa-solid와 함께 쓴다) */
export function iconOf(code: number, day: boolean): string {
	switch (describeCode(code).sky) {
		case 'clear':
			return day ? 'fa-sun' : 'fa-moon';
		case 'partly':
			return day ? 'fa-cloud-sun' : 'fa-cloud-moon';
		case 'cloudy':
			return 'fa-cloud';
		case 'fog':
			return 'fa-smog';
		case 'drizzle':
			return day ? 'fa-cloud-sun-rain' : 'fa-cloud-moon-rain';
		case 'rain':
			return 'fa-cloud-showers-heavy';
		case 'snow':
			return 'fa-snowflake';
		case 'storm':
			return 'fa-cloud-bolt';
	}
}

/** Open-Meteo forecast 응답 (쓰는 값만) */
export interface ForecastResponse {
	utc_offset_seconds: number;
	timezone: string;
	current: {
		time: string;
		temperature_2m: number;
		relative_humidity_2m: number;
		apparent_temperature: number;
		is_day: number;
		precipitation: number;
		weather_code: number;
		wind_speed_10m: number;
		wind_direction_10m: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		weather_code: number[];
		precipitation_probability: (number | null)[];
		is_day: number[];
	};
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		sunrise: string[];
		sunset: string[];
		uv_index_max: (number | null)[];
		precipitation_probability_max: (number | null)[];
		/** 돌풍 (m/s). 예전 응답·가짜에는 없을 수 있다 */
		wind_gusts_10m_max?: (number | null)[];
	};
}

export interface Hour {
	/** '지금', '오후 3시' */
	label: string;
	temp: number;
	icon: string;
	/** 그 시각의 날씨 ('맑음', '비' …) */
	condition: string;
	/** 비 올 확률 (30% 이상일 때만, 아니면 null) */
	rain: number | null;
}

export interface Day {
	/** '오늘', '토', '일' … */
	label: string;
	icon: string;
	min: number;
	max: number;
	rain: number | null;
}

export interface Weather {
	temp: number;
	feelsLike: number;
	label: string;
	sky: Sky;
	day: boolean;
	icon: string;
	high: number;
	low: number;
	humidity: number;
	/** m/s */
	wind: number;
	/** '북동풍' */
	windFrom: string;
	precipitation: number;
	uv: number | null;
	sunrise: string;
	sunset: string;
	hours: Hour[];
	days: Day[];
	/** 10일 동안 가장 낮은·높은 기온 (10일 일기예보의 막대 눈금) */
	range: { min: number; max: number };
	/** 그곳의 지금 시각과 UTC의 차 (초) */
	utcOffset: number;
	/** 오늘 돌풍의 최대 풍속 (m/s, 모르면 null) */
	gust: number | null;
	/** 시간별 일기예보 위의 한두 문장 (iOS 날씨처럼) */
	summary: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DIRECTIONS = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

/** 바람이 불어오는 쪽 (0° = 북) */
export const windFrom = (degrees: number) => `${DIRECTIONS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]}풍`;

/** '2026-10-10T15:00' → '오후 3시' (그곳의 시각 그대로) */
export function hourLabel(local: string): string {
	const hour = Number(local.slice(11, 13));
	const period = hour < 12 ? '오전' : '오후';
	return `${period} ${hour % 12 || 12}시`;
}

/** '2026-10-10T06:35' → '오전 6:35' */
export function clockLabel(local: string): string {
	const hour = Number(local.slice(11, 13));
	return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${local.slice(14, 16)}`;
}

/** 'YYYY-MM-DD'의 요일 (그 날짜 그대로, 시간대와 상관없이) */
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

const rainOf = (chance: number | null | undefined) => (chance != null && chance >= 30 ? chance : null);

/** 응답을 화면 모양으로. 시간별은 지금 시각부터 24시간, 일별은 오늘부터 10일 */
export function toWeather(response: ForecastResponse): Weather {
	const { current, hourly, daily } = response;
	const day = current.is_day === 1;
	// 지금이 들어 있는 시간 칸부터 (current.time은 15분 단위라 시간을 내려 맞춘다)
	const nowHour = `${current.time.slice(0, 13)}:00`;
	const start = Math.max(0, hourly.time.indexOf(nowHour));
	const hours = hourly.time.slice(start, start + 24).map((time, offset) => {
		const index = start + offset;
		const code = offset === 0 ? current.weather_code : hourly.weather_code[index];
		return {
			label: offset === 0 ? '지금' : hourLabel(time),
			temp: Math.round(offset === 0 ? current.temperature_2m : hourly.temperature_2m[index]),
			icon: iconOf(code, offset === 0 ? current.is_day === 1 : hourly.is_day[index] === 1),
			condition: describeCode(code).label,
			rain: rainOf(hourly.precipitation_probability[index]),
		};
	});
	const days = daily.time.slice(0, 10).map((date, index) => ({
		label: index === 0 ? '오늘' : weekday(date),
		icon: iconOf(daily.weather_code[index], true),
		min: Math.round(daily.temperature_2m_min[index]),
		max: Math.round(daily.temperature_2m_max[index]),
		rain: rainOf(daily.precipitation_probability_max[index]),
	}));
	const { label, sky } = describeCode(current.weather_code);
	const gust = daily.wind_gusts_10m_max?.[0] ?? null;
	return {
		temp: Math.round(current.temperature_2m),
		feelsLike: Math.round(current.apparent_temperature),
		label,
		sky,
		day,
		icon: iconOf(current.weather_code, day),
		high: days[0]?.max ?? Math.round(current.temperature_2m),
		low: days[0]?.min ?? Math.round(current.temperature_2m),
		humidity: Math.round(current.relative_humidity_2m),
		wind: Math.round(current.wind_speed_10m * 10) / 10,
		windFrom: windFrom(current.wind_direction_10m),
		precipitation: current.precipitation,
		uv: daily.uv_index_max[0] ?? null,
		sunrise: clockLabel(daily.sunrise[0] ?? ''),
		sunset: clockLabel(daily.sunset[0] ?? ''),
		hours,
		days,
		range: {
			min: Math.min(...days.map((entry) => entry.min)),
			max: Math.max(...days.map((entry) => entry.max)),
		},
		utcOffset: response.utc_offset_seconds,
		gust: gust === null ? null : Math.round(gust),
		summary: summaryOf(hours, gust),
	};
}

/**
 * 시간별 일기예보 위의 문장 (iOS 날씨처럼): 날씨가 처음 바뀌는 시각, 오늘 돌풍의 최대 풍속.
 * 예: '오후 3시쯤 비 상태가 예상됩니다. 돌풍의 풍속은 최대 8m/s입니다.'
 */
export function summaryOf(hours: Pick<Hour, 'label' | 'condition'>[], gust: number | null): string {
	const now = hours[0];
	const change = hours.slice(1).find((hour) => hour.condition !== now?.condition);
	const first = !now
		? ''
		: change
			? `${change.label}쯤 ${change.condition} 상태가 예상됩니다.`
			: `앞으로 ${hours.length}시간 동안 ${now.condition} 상태가 이어집니다.`;
	const wind = gust === null ? '' : ` 돌풍의 풍속은 최대 ${Math.round(gust)}m/s입니다.`;
	return (first + wind).trim();
}

/** 자외선 지수 단계 (기상청 기준) */
export function uvLevel(uv: number): string {
	if (uv < 3) return '낮음';
	if (uv < 6) return '보통';
	if (uv < 8) return '높음';
	if (uv < 11) return '매우 높음';
	return '위험';
}

/** 그곳의 지금 시각 '오후 3:07' (utcOffset: 초) */
export function localClock(utcOffset: number, now = Date.now()): string {
	const local = new Date(now + utcOffset * 1000).toISOString();
	return clockLabel(local);
}
