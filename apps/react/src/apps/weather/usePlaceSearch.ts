import { useEffect, useState } from 'react';
import { matchCities, mergePlaces, toPlaces, type Place } from './places';
import { searchPlaces } from './weatherApi';

/** Open-Meteo에 물은 찾기 결과 (같은 말은 다시 묻지 않는다). 창을 닫았다 열어도 페이지가 그대로면 남는다 */
const searchCache = new Map<string, Place[]>();
/** 글자를 치다 멈추면 묻는다 */
const SEARCH_DELAY_MS = 250;
/** Open-Meteo 지오코딩은 한 번에 1~10초가 걸린다. 이보다 길면 그만 묻는다 (내장 도시는 그대로 보인다) */
const SEARCH_TIMEOUT_MS = 8000;

/**
 * 이름으로 장소 찾기. 내장 도시(cities.ts, 211곳)는 글자를 칠 때마다 바로 보이고,
 * Open-Meteo는 두 글자 이상을 치다 멈추면(한글은 조합이 끝난 뒤) 묻고, 오는 대로 아래에 붙인다.
 * 기다리는 동안에는 searching이 true (목록 아래에 '더 찾는 중')
 */
export function usePlaceSearch(query: string, composing: boolean) {
	const [answered, setAnswered] = useState<{ key: string; failed: boolean } | null>(null);
	const q = query.trim();
	const key = q.toLowerCase();
	const cached = searchCache.get(key);
	const failed = answered?.key === key && answered.failed;
	const remote = q.length >= 2 && !composing && !cached && !failed;

	useEffect(() => {
		if (!remote) return;
		const controller = new AbortController();
		let timedOut = false;
		const timer = window.setTimeout(() => {
			const timeout = window.setTimeout(() => {
				timedOut = true;
				controller.abort();
			}, SEARCH_TIMEOUT_MS);
			searchPlaces(q, controller.signal)
				.then(
					(results) => {
						searchCache.set(key, toPlaces(results));
						setAnswered({ key, failed: false });
					},
					() => {
						// 다른 말을 치느라 그만둔 것은 실패가 아니다
						if (!controller.signal.aborted || timedOut) setAnswered({ key, failed: true });
					}
				)
				.finally(() => window.clearTimeout(timeout));
		}, SEARCH_DELAY_MS);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [remote, q, key]);

	return {
		places: q ? mergePlaces(matchCities(q), cached ?? []) : [],
		searching: remote,
	};
}
