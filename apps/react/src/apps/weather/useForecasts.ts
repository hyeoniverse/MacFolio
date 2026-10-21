import { useCallback, useEffect, useState } from 'react';
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

/** 장소마다 날씨를 묻고, 15분마다 다시 묻는다. 기온 단위를 바꾸면 새로 묻는다. reload는 남은 값과 상관없이 다시 묻는다 */
export function useForecasts(places: Place[], unit: TemperatureUnit) {
	const [forecasts, setForecasts] = useState<Record<string, Loaded>>({});
	const [round, setRound] = useState({ n: 0, force: false });
	const reload = useCallback(() => setRound((value) => ({ n: value.n + 1, force: true })), []);

	useEffect(() => {
		let active = true;
		for (const place of places) {
			const key = `${keyOf(place)}|${unit}`;
			forecastFor(place, unit, round.force).then(
				(weather) => {
					if (active) setForecasts((current) => ({ ...current, [key]: { status: 'ready', weather } }));
				},
				() => {
					if (active)
						setForecasts((current) =>
							current[key]?.status === 'ready' ? current : { ...current, [key]: { status: 'error' } }
						);
				}
			);
		}
		const timer = window.setInterval(() => setRound((value) => ({ n: value.n + 1, force: false })), REFRESH_MS);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, [places, unit, round]);

	return { forecastOf: (place: Place) => forecasts[`${keyOf(place)}|${unit}`], reload };
}
