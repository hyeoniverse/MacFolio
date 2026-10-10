import { useCallback, useEffect, useMemo, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { openExternal } from '@/shared/analytics/analytics';
import { localClock, toWeather, uvLevel, type Weather as WeatherData } from './forecast';
import { loadPlaces, matchCities, mergePlaces, samePlace, savePlaces, toPlaces, type Place } from './places';
import { fetchForecast, searchPlaces } from './weatherApi';
import './Weather.css';

/** 날씨를 다시 묻는 간격 (Open-Meteo는 15분마다 새 값을 낸다) */
const REFRESH_MS = 15 * 60_000;

const keyOf = (place: Place) => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

/** 아직 없으면(undefined) 불러오는 중 */
type Loaded = { status: 'error' } | { status: 'ready'; weather: WeatherData };

/** 장소마다 날씨를 묻고, 15분마다 다시 묻는다 */
function useForecasts(places: Place[]) {
	const [forecasts, setForecasts] = useState<Record<string, Loaded>>({});
	const [round, setRound] = useState(0);
	const reload = useCallback(() => setRound((value) => value + 1), []);

	useEffect(() => {
		const controller = new AbortController();
		for (const place of places) {
			const key = keyOf(place);
			fetchForecast(place.latitude, place.longitude, controller.signal).then(
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
	}, [places, round, reload]);

	return { forecasts, reload };
}

/** 이름으로 장소 찾기: 내장 도시는 바로, Open-Meteo는 잠깐 멈춘 뒤 */
function usePlaceSearch(query: string) {
	const [found, setFound] = useState<{ query: string; places: Place[] }>({ query: '', places: [] });
	useEffect(() => {
		const q = query.trim();
		if (!q) return;
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			searchPlaces(q, controller.signal).then(
				(results) => setFound({ query: q, places: toPlaces(results) }),
				() => !controller.signal.aborted && setFound({ query: q, places: [] })
			);
		}, 300);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [query]);
	const q = query.trim();
	return q ? mergePlaces(matchCities(q), found.query === q ? found.places : []) : [];
}

/** 사이드바의 장소 카드: 그곳의 하늘 색, 이름, 지금 시각, 날씨, 기온, 최고·최저 */
const PlaceCard = ({
	place,
	loaded,
	active,
	onSelect,
	onRemove,
}: {
	place: Place;
	loaded: Loaded | undefined;
	active: boolean;
	onSelect: () => void;
	onRemove?: () => void;
}) => {
	const weather = loaded?.status === 'ready' ? loaded.weather : null;
	return (
		<li className={`weather-card sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'}`}>
			<button type="button" className={active ? 'active' : ''} aria-current={active || undefined} onClick={onSelect}>
				<span className="weather-card-top">
					<strong>{place.name}</strong>
					<span className="weather-card-temp">{weather ? `${weather.temp}°` : '—'}</span>
				</span>
				<span className="weather-card-time">{weather ? localClock(weather.utcOffset) : place.region}</span>
				<span className="weather-card-bottom">
					<span>{weather?.label ?? (loaded?.status === 'error' ? '불러오지 못함' : '불러오는 중')}</span>
					{weather && (
						<span>
							최고:{weather.high}° 최저:{weather.low}°
						</span>
					)}
				</span>
			</button>
			{onRemove && (
				<button type="button" className="weather-card-remove" aria-label={`${place.name} 삭제`} onClick={onRemove}>
					<i className="fa-solid fa-xmark" aria-hidden="true" />
				</button>
			)}
		</li>
	);
};

/** 상세 칸 하나: 작은 제목, 큰 값, 설명 */
const Tile = ({ icon, title, value, note }: { icon: string; title: string; value: string; note?: string }) => (
	<section className="weather-panel weather-tile" aria-label={title}>
		<h3>
			<i className={`fa-solid ${icon}`} aria-hidden="true" /> {title}
		</h3>
		<strong>{value}</strong>
		{note && <p>{note}</p>}
	</section>
);

/** 고른 장소의 날씨: 큰 기온, 시간별, 10일, 상세 칸 */
const Detail = ({ place, weather }: { place: Place; weather: WeatherData }) => {
	const span = Math.max(1, weather.range.max - weather.range.min);
	const position = (value: number) => `${((value - weather.range.min) / span) * 100}%`;
	return (
		<>
			<header className="weather-hero">
				<h1>{place.name}</h1>
				<p className="weather-hero-temp" aria-label={`현재 기온 ${weather.temp}도`}>
					{weather.temp}°
				</p>
				<p className="weather-hero-label">{weather.label}</p>
				<p className="weather-hero-range">
					최고:{weather.high}° 최저:{weather.low}°
				</p>
			</header>

			<section className="weather-panel weather-hours" aria-label="시간별 일기예보">
				<h3>
					<i className="fa-regular fa-clock" aria-hidden="true" /> 시간별 일기예보
				</h3>
				<ol>
					{weather.hours.map((hour, index) => (
						<li key={index}>
							<span className="weather-hour-label">{hour.label}</span>
							<i className={`fa-solid ${hour.icon}`} aria-hidden="true" />
							<span className="weather-rain">{hour.rain !== null ? `${hour.rain}%` : ''}</span>
							<strong>{hour.temp}°</strong>
						</li>
					))}
				</ol>
			</section>

			<section className="weather-panel weather-days" aria-label="10일간의 일기예보">
				<h3>
					<i className="fa-regular fa-calendar" aria-hidden="true" /> 10일간의 일기예보
				</h3>
				<ol>
					{weather.days.map((day, index) => (
						<li key={index}>
							<span className="weather-day-label">{day.label}</span>
							<span className="weather-day-icon">
								<i className={`fa-solid ${day.icon}`} aria-hidden="true" />
								{day.rain !== null && <span className="weather-rain">{day.rain}%</span>}
							</span>
							<span className="weather-day-min">{day.min}°</span>
							<span className="weather-day-bar" aria-hidden="true">
								<span style={{ left: position(day.min), right: `calc(100% - ${position(day.max)})` }} />
								{index === 0 && <i className="weather-day-now" style={{ left: position(weather.temp) }} />}
							</span>
							<span className="weather-day-max">{day.max}°</span>
						</li>
					))}
				</ol>
			</section>

			<div className="weather-tiles">
				<Tile
					icon="fa-temperature-half"
					title="체감 온도"
					value={`${weather.feelsLike}°`}
					note={
						weather.feelsLike < weather.temp
							? '바람 때문에 더 춥게 느껴집니다.'
							: weather.feelsLike > weather.temp
								? '습도 때문에 더 덥게 느껴집니다.'
								: '실제 기온과 비슷합니다.'
					}
				/>
				<Tile icon="fa-droplet" title="습도" value={`${weather.humidity}%`} />
				<Tile icon="fa-wind" title="바람" value={`${weather.wind}m/s`} note={weather.windFrom} />
				<Tile
					icon="fa-sun"
					title="자외선 지수"
					value={weather.uv !== null ? String(Math.round(weather.uv)) : '—'}
					note={weather.uv !== null ? uvLevel(weather.uv) : undefined}
				/>
				<Tile icon="fa-sun" title="일출" value={weather.sunrise} note={`일몰: ${weather.sunset}`} />
				<Tile icon="fa-cloud-rain" title="강수량" value={`${weather.precipitation}mm`} note="지난 1시간" />
			</div>
		</>
	);
};

/**
 * 날씨: macOS 날씨 앱처럼 왼쪽에 장소 카드, 오른쪽에 고른 곳의 하늘 색 배경과 큰 기온, 시간별·10일 일기예보, 상세 칸.
 * 데이터는 Open-Meteo(키 없는 공개 API). 장소는 찾아서 더하고, 목록은 이 브라우저에 남긴다 (places.ts).
 * 좁은 창(휴대폰)에서는 날씨만 보이고, 목록 단추로 장소 목록을 연다
 */
const Weather = () => {
	const [places, setPlaces] = useState<Place[]>(loadPlaces);
	const [selected, setSelected] = useState(0);
	const [query, setQuery] = useState('');
	const [listOpen, setListOpen] = useState(false);
	const { forecasts, reload } = useForecasts(places);
	const results = usePlaceSearch(query);

	const changePlaces = (next: Place[]) => {
		setPlaces(next);
		savePlaces(next);
	};
	const place = places[Math.min(selected, places.length - 1)];
	const loaded = forecasts[keyOf(place)];
	const weather = loaded?.status === 'ready' ? loaded.weather : null;

	const add = (found: Place) => {
		const existing = places.findIndex((other) => samePlace(other, found));
		if (existing >= 0) setSelected(existing);
		else {
			changePlaces([...places, found]);
			setSelected(places.length);
		}
		setQuery('');
		setListOpen(false);
	};
	const remove = (index: number) => {
		changePlaces(places.filter((_, other) => other !== index));
		setSelected((current) => (current > index ? current - 1 : Math.min(current, places.length - 2)));
	};

	useAppMenus(
		'weather',
		useMemo(
			() => [
				{
					title: '보기',
					items: [{ label: '새로 고침', icon: 'fa-solid fa-rotate-right', onSelect: reload }],
				},
			],
			[reload]
		)
	);

	return (
		<AppWindow title="날씨" appName="weather" chrome="unified">
			<div className={`weather sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'}`}>
				<nav className={`weather-sidebar ${listOpen ? 'open' : ''}`} aria-label="장소">
					<div className="weather-lights-space" />
					<label className="weather-search">
						<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
						<input
							type="search"
							placeholder="도시 검색"
							aria-label="도시 검색"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</label>
					{query.trim() ? (
						<ul className="weather-results" aria-label="검색 결과">
							{results.map((found) => (
								<li key={keyOf(found)}>
									<button type="button" onClick={() => add(found)}>
										<strong>{found.name}</strong>
										<span>{found.region}</span>
									</button>
								</li>
							))}
							{results.length === 0 && <li className="weather-empty">찾는 중…</li>}
						</ul>
					) : (
						<ul className="weather-cards">
							{places.map((entry, index) => (
								<PlaceCard
									key={keyOf(entry)}
									place={entry}
									loaded={forecasts[keyOf(entry)]}
									active={entry === place}
									onSelect={() => {
										setSelected(index);
										setListOpen(false);
									}}
									onRemove={places.length > 1 ? () => remove(index) : undefined}
								/>
							))}
						</ul>
					)}
				</nav>

				<main className="weather-main" aria-label={`${place.name} 날씨`}>
					<button
						type="button"
						className="weather-list-toggle"
						aria-label="장소 목록"
						aria-expanded={listOpen}
						onClick={() => setListOpen((open) => !open)}
					>
						<i className="fa-solid fa-list-ul" aria-hidden="true" />
					</button>
					<div className="weather-scroll">
						{weather ? (
							<Detail place={place} weather={weather} />
						) : (
							<p className="weather-status">
								{loaded?.status === 'error' ? (
									<>
										날씨를 불러오지 못했습니다.
										<button type="button" onClick={reload}>
											다시 시도
										</button>
									</>
								) : (
									'불러오는 중…'
								)}
							</p>
						)}
						<p className="weather-credit">
							날씨 데이터:{' '}
							<a
								href="https://open-meteo.com/"
								onClick={(event) => {
									event.preventDefault();
									openExternal('https://open-meteo.com/');
								}}
							>
								Open-Meteo.com
							</a>{' '}
							(CC BY 4.0)
						</p>
					</div>
				</main>
			</div>
		</AppWindow>
	);
};

export default Weather;
