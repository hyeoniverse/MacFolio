import { useCallback, useEffect, useState } from 'react';
import { toWeather, type Weather as WeatherData } from './forecast';
import { type Place } from './places';
import { fetchForecast, type TemperatureUnit } from './weatherApi';

/** 날씨를 다시 묻는 간격 (Open-Meteo는 15분마다 새 값을 낸다) */
const REFRESH_MS = 15 * 60_000;

export const keyOf = (place: Place) => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

/** 아직 없으면(undefined) 불러오는 중 */
export type Loaded = { status: 'error' } | { status: 'ready'; weather: WeatherData };

/** 장소마다 날씨를 묻고, 15분마다 다시 묻는다. 기온 단위를 바꾸면 새로 묻는다 */
export function useForecasts(places: Place[], unit: TemperatureUnit) {
	const [forecasts, setForecasts] = useState<Record<string, Loaded>>({});
	const [round, setRound] = useState(0);
	const reload = useCallback(() => setRound((value) => value + 1), []);

	useEffect(() => {
		const controller = new AbortController();
		for (const place of places) {
			const key = `${keyOf(place)}|${unit}`;
			fetchForecast(place.latitude, place.longitude, controller.signal, unit).then(
				(response) =>
					setForecasts((current) => ({ ...current, [key]: { status: 'ready', weather: toWeather(response) } })),
				() => {
					if (!controller.signal.aborted)
						setForecasts((current) =>
							current[key]?.status === 'ready' ? current : { ...current, [key]: { status: 'error' } }
						);
				}
			);
		}
		const timer = window.setInterval(reload, REFRESH_MS);
		return () => {
			controller.abort();
			window.clearInterval(timer);
		};
	}, [places, unit, round, reload]);

	return { forecastOf: (place: Place) => forecasts[`${keyOf(place)}|${unit}`], reload };
}
