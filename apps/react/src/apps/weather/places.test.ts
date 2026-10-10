import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLACES, loadPlaces, matchCities, mergePlaces, samePlace, savePlaces, toPlaces } from './places';

describe('날씨 앱의 장소', () => {
	// 시험은 브라우저가 아니라서 localStorage를 흉내 낸다
	beforeEach(() => {
		const items = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => items.set(key, value),
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('내장 도시를 한국어·영어 이름으로 찾는다 (서울의 구까지)', () => {
		expect(matchCities('BUSAN').map((place) => place.name)).toEqual(['부산']);
		expect(matchCities('노원').map((place) => [place.name, place.region])).toEqual([['노원구', '서울특별시']]);
		expect(matchCities('nowon').map((place) => place.name)).toEqual(['노원구']);
		expect(matchCities('  ')).toEqual([]);
	});

	it('이름이 찾는 말로 시작하는 곳 먼저, 그다음 이름에 들어 있는 곳, 마지막으로 지역 이름', () => {
		const san = matchCities('san').map((place) => place.name);
		expect(san.slice(0, 2)).toEqual(['샌프란시스코', '샌디에이고']);
		expect(san).toContain('부산');
		// '서울'은 서울 다음에 서울특별시의 구 25개
		const seoul = matchCities('서울');
		expect(seoul[0].name).toBe('서울');
		// 서울(시청)과 가까운 종로구(구청)도 다른 곳으로 남는다
		expect(
			mergePlaces(seoul, [])
				.map((place) => place.name)
				.slice(0, 2)
		).toEqual(['서울', '종로구']);
		expect(seoul).toHaveLength(26);
		expect(seoul.slice(1).every((place) => place.region === '서울특별시')).toBe(true);
	});

	it('지오코딩 결과는 수도·행정 중심지·큰 도시 먼저, 지역 이름을 붙인다', () => {
		const places = toPlaces([
			{ name: 'Tokyo', latitude: -6, longitude: 145, country: '파푸아뉴기니', admin1: '중앙주', feature_code: 'PPL' },
			{
				name: '도쿄',
				latitude: 35.68,
				longitude: 139.69,
				country: '일본',
				admin1: '도쿄 도',
				feature_code: 'PPLC',
				population: 9733276,
			},
			{
				name: '부산광역시',
				latitude: 35.1,
				longitude: 129.04,
				country: '대한민국',
				admin1: '부산광역시',
				feature_code: 'PPLA',
				population: 3285147,
			},
		]);
		expect(places.map((place) => [place.name, place.region])).toEqual([
			['도쿄', '일본 도쿄 도'],
			['부산광역시', '대한민국'],
			['Tokyo', '파푸아뉴기니 중앙주'],
		]);
	});

	it('찾기 결과는 내장 도시 먼저, 같은 곳은 한 번만', () => {
		const seoul = matchCities('서울').slice(0, 1);
		const found = [
			{ name: 'Seoul', region: '대한민국', latitude: 37.566, longitude: 126.9784 },
			{ name: 'Suwon', region: '대한민국', latitude: 37.29, longitude: 127.01 },
		];
		expect(mergePlaces(seoul, found).map((place) => place.name)).toEqual(['서울', 'Suwon']);
		expect(samePlace(found[0], seoul[0])).toBe(true);
	});

	it('저장한 장소는 이 브라우저에, 없거나 깨졌으면 서울', () => {
		expect(loadPlaces()).toEqual(DEFAULT_PLACES);
		const tokyo = matchCities('도쿄');
		savePlaces([...DEFAULT_PLACES, ...tokyo]);
		expect(loadPlaces().map((place) => place.name)).toEqual(['서울', '도쿄']);
		localStorage.setItem('macfolio:weather:places', '{broken');
		expect(loadPlaces()).toEqual(DEFAULT_PLACES);
	});
});
