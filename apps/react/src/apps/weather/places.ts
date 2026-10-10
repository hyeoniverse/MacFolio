// 날씨 앱의 장소: 저장한 목록(이 브라우저), 찾기(먼저 내장 도시, 그다음 Open-Meteo 지오코딩)
import { CITY_ROWS } from './cities';

export interface Place {
	/** 목록에 보일 이름 */
	name: string;
	/** 이름 아래 작은 글씨 (예: '대한민국', '일본 도쿄 도') */
	region: string;
	latitude: number;
	longitude: number;
}

/** 내장 도시 (cities.ts): 한국어 이름과 영어 별칭으로 바로 찾는다 */
export const CITIES: (Place & { aliases: string[] })[] = CITY_ROWS.map(
	([name, region, latitude, longitude, aliases]) => ({
		name,
		region,
		latitude,
		longitude,
		aliases: aliases.split(' '),
	})
);

export const DEFAULT_PLACES: Place[] = [CITIES[0]].map(({ aliases: _aliases, ...place }) => place);

/**
 * 두 장소가 같은 곳인지 (약 500m 안). 1km로 두었더니 서울(시청)과 종로구(구청)가 같은 곳이 되어 종로구가 찾기에서 빠졌다
 */
export const samePlace = (a: Place, b: Place) =>
	Math.abs(a.latitude - b.latitude) < 0.005 && Math.abs(a.longitude - b.longitude) < 0.005;

/**
 * 내장 도시 중 이름(한국어·영어)이나 지역에 찾는 말이 들어 있는 것.
 * 이름이 찾는 말로 시작하는 곳을 먼저, 그다음 이름에 들어 있는 곳, 마지막으로 지역 이름에 들어 있는 곳 (같으면 목록 순서)
 */
export function matchCities(query: string): Place[] {
	const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
	if (!q) return [];
	const rank = (city: (typeof CITIES)[number]) => {
		const names = [city.name.toLowerCase(), ...city.aliases];
		if (names.some((name) => name.startsWith(q))) return 0;
		if (names.some((name) => name.includes(q))) return 1;
		if (city.region.includes(q)) return 2;
		return null;
	};
	return CITIES.map((city, order) => ({ city, order, rank: rank(city) }))
		.filter((entry) => entry.rank !== null)
		.sort((a, b) => a.rank! - b.rank! || a.order - b.order)
		.map(({ city: { aliases: _aliases, ...place } }) => place);
}

/** Open-Meteo 지오코딩 결과 (쓰는 값만) */
export interface GeocodingResult {
	name: string;
	latitude: number;
	longitude: number;
	country?: string;
	admin1?: string;
	feature_code?: string;
	population?: number;
}

/** 수도·행정 중심지를 먼저, 그다음 인구가 많은 곳 */
const FEATURE_RANK: Record<string, number> = { PPLC: 0, PPLA: 1, PPLA2: 2, PPLA3: 3, PPL: 4 };

/** 지오코딩 결과 → 장소. 큰 도시가 먼저 오게 다시 줄 세운다 */
export function toPlaces(results: GeocodingResult[]): Place[] {
	return [...results]
		.sort(
			(a, b) =>
				(FEATURE_RANK[a.feature_code ?? ''] ?? 9) - (FEATURE_RANK[b.feature_code ?? ''] ?? 9) ||
				(b.population ?? 0) - (a.population ?? 0)
		)
		.map((result) => ({
			name: result.name,
			region: [result.country, result.admin1 && result.admin1 !== result.name ? result.admin1 : null]
				.filter(Boolean)
				.join(' '),
			latitude: result.latitude,
			longitude: result.longitude,
		}));
}

/** 찾기 결과: 내장 도시 먼저, 같은 곳은 한 번만, 12개까지 */
export function mergePlaces(cities: Place[], found: Place[], limit = 12): Place[] {
	const merged: Place[] = [];
	for (const place of [...cities, ...found]) if (!merged.some((other) => samePlace(other, place))) merged.push(place);
	return merged.slice(0, limit);
}

const STORAGE_KEY = 'macfolio:weather:places';
const UNIT_KEY = 'macfolio:weather:unit';

/** 고른 기온 단위 (이 브라우저). 없으면 섭씨 */
export function loadUnit(): 'c' | 'f' {
	try {
		return localStorage.getItem(UNIT_KEY) === 'f' ? 'f' : 'c';
	} catch {
		return 'c';
	}
}

export function saveUnit(unit: 'c' | 'f') {
	try {
		localStorage.setItem(UNIT_KEY, unit);
	} catch {
		// 저장하지 못해도 이번에는 그대로 쓴다
	}
}

/** 저장한 장소 (이 브라우저). 읽지 못하면 기본(서울) */
export function loadPlaces(): Place[] {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Place[] | null;
		return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_PLACES;
	} catch {
		return DEFAULT_PLACES;
	}
}

export function savePlaces(places: Place[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
	} catch {
		// 저장하지 못해도(사생활 보호 창 등) 이번에는 그대로 쓴다
	}
}
