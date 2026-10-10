// 날씨 앱의 장소: 저장한 목록(이 브라우저), 찾기(먼저 내장 도시, 그다음 Open-Meteo 지오코딩)

export interface Place {
	/** 목록에 보일 이름 */
	name: string;
	/** 이름 아래 작은 글씨 (예: '대한민국', '일본 도쿄 도') */
	region: string;
	latitude: number;
	longitude: number;
}

/**
 * 한국어 이름으로 찾기 쉬운 도시. Open-Meteo 지오코딩은 한국어 이름을 잘 찾지 못해서('서울'은 결과가 없고,
 * '부산'은 같은 이름의 마을이 먼저 나온다) 자주 찾을 도시는 여기 둔다. aliases: 영어 이름으로도 찾는다
 */
export const CITIES: (Place & { aliases: string[] })[] = [
	{ name: '서울', region: '대한민국', latitude: 37.5665, longitude: 126.978, aliases: ['seoul'] },
	{ name: '부산', region: '대한민국', latitude: 35.1796, longitude: 129.0756, aliases: ['busan', 'pusan'] },
	{ name: '인천', region: '대한민국', latitude: 37.4563, longitude: 126.7052, aliases: ['incheon'] },
	{ name: '대구', region: '대한민국', latitude: 35.8714, longitude: 128.6014, aliases: ['daegu'] },
	{ name: '대전', region: '대한민국', latitude: 36.3504, longitude: 127.3845, aliases: ['daejeon'] },
	{ name: '광주', region: '대한민국', latitude: 35.1595, longitude: 126.8526, aliases: ['gwangju'] },
	{ name: '울산', region: '대한민국', latitude: 35.5384, longitude: 129.3114, aliases: ['ulsan'] },
	{ name: '세종', region: '대한민국', latitude: 36.48, longitude: 127.289, aliases: ['sejong'] },
	{ name: '수원', region: '대한민국', latitude: 37.2636, longitude: 127.0286, aliases: ['suwon'] },
	{ name: '춘천', region: '대한민국', latitude: 37.8813, longitude: 127.7298, aliases: ['chuncheon'] },
	{ name: '강릉', region: '대한민국', latitude: 37.7519, longitude: 128.8761, aliases: ['gangneung'] },
	{ name: '청주', region: '대한민국', latitude: 36.6424, longitude: 127.489, aliases: ['cheongju'] },
	{ name: '전주', region: '대한민국', latitude: 35.8242, longitude: 127.148, aliases: ['jeonju'] },
	{ name: '포항', region: '대한민국', latitude: 36.019, longitude: 129.3435, aliases: ['pohang'] },
	{ name: '창원', region: '대한민국', latitude: 35.2279, longitude: 128.6811, aliases: ['changwon'] },
	{ name: '여수', region: '대한민국', latitude: 34.7604, longitude: 127.6622, aliases: ['yeosu'] },
	{ name: '제주', region: '대한민국', latitude: 33.4996, longitude: 126.5312, aliases: ['jeju'] },
	{ name: '도쿄', region: '일본', latitude: 35.6762, longitude: 139.6503, aliases: ['tokyo'] },
	{ name: '오사카', region: '일본', latitude: 34.6937, longitude: 135.5023, aliases: ['osaka'] },
	{ name: '후쿠오카', region: '일본', latitude: 33.5904, longitude: 130.4017, aliases: ['fukuoka'] },
	{ name: '삿포로', region: '일본', latitude: 43.0618, longitude: 141.3545, aliases: ['sapporo'] },
	{ name: '타이베이', region: '대만', latitude: 25.033, longitude: 121.5654, aliases: ['taipei'] },
	{ name: '홍콩', region: '중국', latitude: 22.3193, longitude: 114.1694, aliases: ['hong kong'] },
	{ name: '베이징', region: '중국', latitude: 39.9042, longitude: 116.4074, aliases: ['beijing'] },
	{ name: '상하이', region: '중국', latitude: 31.2304, longitude: 121.4737, aliases: ['shanghai'] },
	{ name: '싱가포르', region: '싱가포르', latitude: 1.3521, longitude: 103.8198, aliases: ['singapore'] },
	{ name: '방콕', region: '태국', latitude: 13.7563, longitude: 100.5018, aliases: ['bangkok'] },
	{ name: '다낭', region: '베트남', latitude: 16.0544, longitude: 108.2022, aliases: ['da nang', 'danang'] },
	{ name: '시드니', region: '오스트레일리아', latitude: -33.8688, longitude: 151.2093, aliases: ['sydney'] },
	{ name: '런던', region: '영국', latitude: 51.5072, longitude: -0.1276, aliases: ['london'] },
	{ name: '파리', region: '프랑스', latitude: 48.8566, longitude: 2.3522, aliases: ['paris'] },
	{ name: '베를린', region: '독일', latitude: 52.52, longitude: 13.405, aliases: ['berlin'] },
	{ name: '뉴욕', region: '미국', latitude: 40.7128, longitude: -74.006, aliases: ['new york'] },
	{ name: '로스앤젤레스', region: '미국', latitude: 34.0522, longitude: -118.2437, aliases: ['los angeles', 'la'] },
	{ name: '샌프란시스코', region: '미국', latitude: 37.7749, longitude: -122.4194, aliases: ['san francisco'] },
	{ name: '쿠퍼티노', region: '미국', latitude: 37.323, longitude: -122.0322, aliases: ['cupertino'] },
	{ name: '시애틀', region: '미국', latitude: 47.6062, longitude: -122.3321, aliases: ['seattle'] },
	{ name: '밴쿠버', region: '캐나다', latitude: 49.2827, longitude: -123.1207, aliases: ['vancouver'] },
	{ name: '토론토', region: '캐나다', latitude: 43.6532, longitude: -79.3832, aliases: ['toronto'] },
];

export const DEFAULT_PLACES: Place[] = [CITIES[0]].map(({ aliases: _aliases, ...place }) => place);

/** 두 장소가 같은 곳인지 (약 1km 안) */
export const samePlace = (a: Place, b: Place) =>
	Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;

/** 내장 도시 중 이름(한국어·영어)에 찾는 말이 들어 있는 것 */
export function matchCities(query: string): Place[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return CITIES.filter((city) => city.name.includes(q) || city.aliases.some((alias) => alias.includes(q))).map(
		({ aliases: _aliases, ...place }) => place
	);
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

/** 찾기 결과: 내장 도시 먼저, 같은 곳은 한 번만, 8개까지 */
export function mergePlaces(cities: Place[], found: Place[], limit = 8): Place[] {
	const merged: Place[] = [];
	for (const place of [...cities, ...found]) if (!merged.some((other) => samePlace(other, place))) merged.push(place);
	return merged.slice(0, limit);
}

const STORAGE_KEY = 'macfolio:weather:places';

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
