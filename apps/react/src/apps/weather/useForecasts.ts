import { useCallback, useRef, useState } from 'react';
import { usePolling } from '@/shared/hooks/usePolling';
import { toWeather, type Weather as WeatherData } from './forecast';
import { type Place } from './places';
import { fetchForecast, type TemperatureUnit } from './weatherApi';

/** 날씨를 다시 묻는 간격 (Open-Meteo는 15분마다 새 값을 낸다) */
const REFRESH_MS = 15 * 60_000;
/** 묻지 못했으면 이만큼은 같은 실패를 돌려준다 (여러 곳이 한꺼번에 다시 묻지 않게) */
const FAILURE_MS = 10_000;

export const keyOf = (place: Place) => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

/** 아직 없으면(undefined) 불러오는 중 */
export type Loaded = { status: 'error' } | { status: 'ready'; weather: WeatherData };

/**
 * 장소·단위마다 한 번만 묻는다: 날씨 앱과 위젯(바탕화면·홈 화면)이 같은 도시를 보면 같은 응답을 나눠 쓴다.
 * REFRESH_MS가 지나면 다음에 부를 때 다시 묻는다. force면(다시 시도) 남은 값이 있어도 새로 묻는다
 */
const cache = new Map<string, { at: number; ttl: number; value: Promise<WeatherData> }>();

function forecastFor(place: Place, unit: TemperatureUnit, force: boolean, now = Date.now()): Promise<WeatherData> {
	const key = `${keyOf(place)}|${unit}`;
	const hit = cache.get(key);
	if (!force && hit && now - hit.at < hit.ttl) return hit.value;
	const entry = {
		at: now,
		ttl: REFRESH_MS,
		value: fetchForecast(place.latitude, place.longitude, undefined, unit).then(toWeather),
	};
	entry.value.catch(() => {
		entry.ttl = FAILURE_MS;
	});
	cache.set(key, entry);
	return entry.value;
}

/** 시험에서 남은 값을 비운다 */
export const clearForecastCache = () => cache.clear();

/**
 * 장소마다 날씨를 묻고, active(창이나 위젯이 보인다)이고 탭이 보이는 동안 15분마다 다시 묻는다.
 * 숨었다 다시 보이면 15분이 지났을 때만 바로 묻는다. 장소·기온 단위가 바뀌면 새로 묻는다.
 * reload는 남은 값과 상관없이 다시 묻는다
 */
export function useForecasts(places: Place[], unit: TemperatureUnit, active = true) {
	const [forecasts, setForecasts] = useState<Record<string, Loaded>>({});
	/** 다음 조회가 남은 값을 무시하는지 (다시 시도) */
	const force = useRef(false);

	const { refresh } = usePolling(
		(isCurrent) => {
			const fresh = force.current;
			force.current = false;
			return Promise.allSettled(
				places.map((place) => {
					const key = `${keyOf(place)}|${unit}`;
					return forecastFor(place, unit, fresh).then(
						(weather) => {
							if (isCurrent()) setForecasts((current) => ({ ...current, [key]: { status: 'ready', weather } }));
						},
						(error: unknown) => {
							if (isCurrent())
								setForecasts((current) =>
									current[key]?.status === 'ready' ? current : { ...current, [key]: { status: 'error' } }
								);
							throw error;
						}
					);
				})
			).then((results) => {
				// 모두 실패했으면 간격을 늘린다
				if (results.length > 0 && results.every((result) => result.status === 'rejected')) throw new Error('weather');
			});
		},
		{ intervalMs: REFRESH_MS, active, resetKey: `${places.map(keyOf).join(';')}|${unit}` }
	);
	const reload = useCallback(() => {
		force.current = true;
		refresh();
	}, [refresh]);

	return { forecastOf: (place: Place) => forecasts[`${keyOf(place)}|${unit}`], reload };
}
