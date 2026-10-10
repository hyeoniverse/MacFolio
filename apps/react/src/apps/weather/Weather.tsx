import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { openExternal } from '@/shared/analytics/analytics';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { localClock, toWeather, uvLevel, type Weather as WeatherData } from './forecast';
import {
	loadPlaces,
	loadUnit,
	matchCities,
	mergePlaces,
	samePlace,
	savePlaces,
	saveUnit,
	toPlaces,
	type Place,
} from './places';
import { fetchForecast, searchPlaces, type TemperatureUnit } from './weatherApi';
import './Weather.css';

/** 날씨를 다시 묻는 간격 (Open-Meteo는 15분마다 새 값을 낸다) */
const REFRESH_MS = 15 * 60_000;
/** 카드를 왼쪽으로 밀면 드러나는 지우기 단추의 폭 */
const SWIPE_OPEN = 84;

const keyOf = (place: Place) => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;

/** 아직 없으면(undefined) 불러오는 중 */
type Loaded = { status: 'error' } | { status: 'ready'; weather: WeatherData };

const openCredit = (event: React.MouseEvent) => {
	event.preventDefault();
	openExternal('https://open-meteo.com/');
};

/** 장소마다 날씨를 묻고, 15분마다 다시 묻는다. 기온 단위를 바꾸면 새로 묻는다 */
function useForecasts(places: Place[], unit: TemperatureUnit) {
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
function usePlaceSearch(query: string, composing: boolean) {
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

/**
 * 장소 카드: 그곳의 하늘 색, 이름, 지금 시각·지역, 날씨, 기온, 최고·최저.
 * 넓은 창은 macOS처럼 오른쪽 클릭 메뉴의 '삭제'로, 좁은 창·휴대폰은 iOS처럼 왼쪽으로 밀거나(목록 편집이면 늘) 드러나는 빨간 휴지통으로 지운다
 */
const PlaceCard = ({
	place,
	loaded,
	active,
	editing,
	onSelect,
	onRemove,
	onMenu,
}: {
	place: Place;
	loaded: Loaded | undefined;
	active: boolean;
	editing: boolean;
	onSelect: () => void;
	onRemove?: () => void;
	/** 오른쪽 클릭 (넓은 창): 그 자리에 메뉴 */
	onMenu?: (at: { x: number; y: number }) => void;
}) => {
	const weather = loaded?.status === 'ready' ? loaded.weather : null;
	const [offset, setOffset] = useState(0);
	const drag = useRef<{ x: number; y: number; from: number; moved: boolean } | null>(null);
	/** 방금 밀었는지: 손을 뗄 때 따라오는 누름은 고르기·닫기가 아니다 */
	const dragged = useRef(false);
	const shown = onRemove && editing ? -SWIPE_OPEN : offset;

	return (
		<li
			className={`weather-card sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'} ${shown ? 'swiped' : ''}`}
		>
			{onRemove && (
				<button
					type="button"
					className="weather-card-trash"
					aria-label={`${place.name} 삭제`}
					tabIndex={shown ? 0 : -1}
					onClick={onRemove}
				>
					<i className="fa-solid fa-trash-can" aria-hidden="true" />
				</button>
			)}
			<button
				type="button"
				className={`weather-card-face ${active ? 'active' : ''}`}
				aria-current={active || undefined}
				style={shown ? { transform: `translateX(${shown}px)` } : undefined}
				onContextMenu={
					onMenu
						? (event) => {
								event.preventDefault();
								onMenu({ x: event.clientX, y: event.clientY });
							}
						: undefined
				}
				onPointerDown={(event) => {
					if (!onRemove || editing) return;
					drag.current = { x: event.clientX, y: event.clientY, from: offset, moved: false };
				}}
				onPointerMove={(event) => {
					const start = drag.current;
					if (!start) return;
					const dx = event.clientX - start.x;
					// 옆으로 미는 것만 (위아래 스크롤은 그대로)
					if (!start.moved && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - start.y))) return;
					if (!start.moved) {
						// 옆으로 밀기 시작하면 손가락을 이 카드가 붙잡는다 (손가락이 카드 밖으로 나가도 계속 민다)
						try {
							event.currentTarget.setPointerCapture(event.pointerId);
						} catch {
							// 이미 끝난 포인터면 그냥 둔다
						}
					}
					start.moved = true;
					setOffset(Math.min(0, Math.max(-SWIPE_OPEN - 24, start.from + dx)));
				}}
				onPointerUp={() => {
					const start = drag.current;
					drag.current = null;
					dragged.current = Boolean(start?.moved);
					if (start?.moved) setOffset((current) => (current < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
				}}
				onPointerCancel={() => {
					// iOS Safari는 손가락이 조금만 위아래로 흔들려도 스크롤로 보고 취소를 보낸다.
					// 그때도 닫지 않고, 민 만큼으로 열지 닫을지 정한다
					const start = drag.current;
					drag.current = null;
					dragged.current = Boolean(start?.moved);
					setOffset((current) => (current < -SWIPE_OPEN / 2 ? -SWIPE_OPEN : 0));
				}}
				onClick={(event) => {
					if (dragged.current) {
						dragged.current = false;
						return;
					}
					// 밀어 연 뒤의 누름은 고르기가 아니라 닫기
					if (offset !== 0) {
						event.preventDefault();
						setOffset(0);
						return;
					}
					onSelect();
				}}
			>
				<span className="weather-card-top">
					<strong>{place.name}</strong>
					<span className="weather-card-temp">{weather ? `${weather.temp}°` : '—'}</span>
				</span>
				<span className="weather-card-time">
					{weather ? `${localClock(weather.utcOffset)} • ${place.region}` : place.region}
				</span>
				<span className="weather-card-bottom">
					<span>{weather?.label ?? (loaded?.status === 'error' ? '불러오지 못함' : '불러오는 중')}</span>
					{weather && (
						<span>
							최고:{weather.high}° 최저:{weather.low}°
						</span>
					)}
				</span>
			</button>
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

/** 고른 장소의 날씨: 큰 기온, 시간별(위에 한두 문장), 10일, 상세 칸 */
const Detail = ({ place, weather }: { place: Place; weather: WeatherData }) => {
	const span = Math.max(1, weather.range.max - weather.range.min);
	const position = (value: number) => `${((value - weather.range.min) / span) * 100}%`;
	return (
		<>
			<header className="weather-hero">
				<p className="weather-hero-region">{place.region}</p>
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
				<p className="weather-summary">{weather.summary}</p>
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

			{/* 넓으면 두 단: 왼쪽 10일, 오른쪽 상세 칸 (macOS 날씨) */}
			<div className="weather-columns">
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
					<Tile
						icon="fa-wind"
						title="바람"
						value={`${weather.wind}m/s`}
						note={weather.gust !== null ? `${weather.windFrom} · 돌풍 최대 ${weather.gust}m/s` : weather.windFrom}
					/>
					<Tile
						icon="fa-sun"
						title="자외선 지수"
						value={weather.uv !== null ? String(Math.round(weather.uv)) : '—'}
						note={weather.uv !== null ? uvLevel(weather.uv) : undefined}
					/>
					<Tile icon="fa-sun" title="일출" value={weather.sunrise} note={`일몰: ${weather.sunset}`} />
					<Tile icon="fa-cloud-rain" title="강수량" value={`${weather.precipitation}mm`} note="지난 1시간" />
				</div>
			</div>
		</>
	);
};

/**
 * 날씨: macOS·iOS 날씨 앱처럼 장소 카드 목록과, 고른 곳의 하늘 색 배경·큰 기온·시간별·10일 일기예보·상세 칸.
 * 데이터는 Open-Meteo(키 없는 공개 API). 장소와 기온 단위는 이 브라우저에 남긴다 (places.ts).
 * 넓은 창은 왼쪽에 목록이 늘 있다. 좁은 창·휴대폰은 iOS처럼 날씨만 보이고, 아래 막대의 점으로 장소를 넘기고(옆으로 밀어도 된다)
 * 목록 단추로 '날씨' 목록(큰 제목, ••• 메뉴, 아래 검색)을 연다
 */
const Weather = () => {
	const [places, setPlaces] = useState<Place[]>(loadPlaces);
	const [unit, setUnitState] = useState<TemperatureUnit>(loadUnit);
	const [selected, setSelected] = useState(0);
	const [query, setQuery] = useState('');
	const [listOpen, setListOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	/** 카드의 오른쪽 클릭 메뉴 (넓은 창) */
	const [cardMenu, setCardMenu] = useState<{ at: number; x: number; y: number } | null>(null);
	/** 넓은 창: 사이드바를 접었는지 (macOS의 사이드바 단추) */
	const [sidebarHidden, setSidebarHidden] = useState(false);
	const moreButton = useRef<HTMLButtonElement>(null);
	const swipe = useRef<{ x: number; y: number } | null>(null);
	const { forecastOf, reload } = useForecasts(places, unit);
	/** 한글을 조합하는 중인지 (조합 중에는 Open-Meteo에 묻지 않는다) */
	const [composing, setComposing] = useState(false);
	const search = usePlaceSearch(query, composing);
	const results = search.places;

	const changePlaces = (next: Place[]) => {
		setPlaces(next);
		savePlaces(next);
	};
	const setUnit = useCallback((next: TemperatureUnit) => {
		setUnitState(next);
		saveUnit(next);
	}, []);
	const index = Math.min(selected, places.length - 1);
	const place = places[index];
	const loaded = forecastOf(place);
	const weather = loaded?.status === 'ready' ? loaded.weather : null;

	const choose = (next: number) => {
		setSelected(next);
		setListOpen(false);
		setEditing(false);
	};
	const add = (found: Place) => {
		const existing = places.findIndex((other) => samePlace(other, found));
		if (existing >= 0) choose(existing);
		else {
			changePlaces([...places, found]);
			choose(places.length);
		}
		setQuery('');
	};
	const remove = (at: number) => {
		const next = places.filter((_, other) => other !== at);
		changePlaces(next);
		if (next.length <= 1) setEditing(false);
		setSelected((current) => (current > at ? current - 1 : Math.min(current, next.length - 1)));
	};

	useAppMenus(
		'weather',
		useMemo(
			() => [
				{
					title: '보기',
					items: [
						{ label: '섭씨 (°C)', checked: unit === 'c', onSelect: () => setUnit('c') },
						{ label: '화씨 (°F)', checked: unit === 'f', onSelect: () => setUnit('f') },
						'separator' as const,
						{ label: '새로 고침', icon: 'fa-solid fa-rotate-right', onSelect: reload },
					],
				},
			],
			[reload, unit, setUnit]
		)
	);

	const menuItems: MenuItem[] = [
		{
			label: editing ? '편집 완료' : '목록 편집',
			icon: 'fa-solid fa-pen',
			disabled: places.length <= 1,
			onSelect: () => setEditing((value) => !value),
		},
		'separator',
		{ label: '°C 섭씨', checked: unit === 'c', onSelect: () => setUnit('c') },
		{ label: '°F 화씨', checked: unit === 'f', onSelect: () => setUnit('f') },
	];

	return (
		<AppWindow title="날씨" appName="weather" chrome="unified">
			{/* iOS 날씨처럼 홈으로 가는 단추가 없다 (홈 바로 나간다) */}
			<MobileNavigation hideHome />
			<div className={`weather sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'}`}>
				<nav
					className={`weather-sidebar ${listOpen ? 'open' : ''} ${editing ? 'editing' : ''} ${sidebarHidden ? 'hidden' : ''}`}
					aria-label="장소"
				>
					<div className="weather-lights-space">
						<button
							type="button"
							className="weather-sidebar-toggle"
							aria-label="사이드바 가리기"
							onClick={() => setSidebarHidden(true)}
						>
							<i className="fa-solid fa-table-columns" aria-hidden="true" />
						</button>
					</div>
					<header className="weather-list-head">
						<h2>날씨</h2>
						<button
							ref={moreButton}
							type="button"
							className="weather-more"
							aria-label="더 보기"
							aria-haspopup="menu"
							aria-expanded={menu !== null}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								setMenu(menu ? null : { x: rect.right - 260, y: rect.bottom + 8 });
							}}
						>
							<i className="fa-solid fa-ellipsis" aria-hidden="true" />
						</button>
					</header>
					<label className="weather-search">
						<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
						<input
							type="search"
							placeholder="도시 검색"
							aria-label="도시 검색"
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								// 조합이 끝났다는 신호(compositionend)를 보내지 않는 키보드도 있어서, 입력마다 다시 확인한다
								setComposing((event.nativeEvent as InputEvent).isComposing ?? false);
							}}
							onCompositionStart={() => setComposing(true)}
							onCompositionEnd={(event) => {
								setComposing(false);
								setQuery(event.currentTarget.value);
							}}
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
							{search.searching ? (
								<li className="weather-empty weather-searching" role="status">
									<i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />{' '}
									{results.length ? '더 찾는 중…' : '찾는 중…'}
								</li>
							) : (
								results.length === 0 && <li className="weather-empty">결과 없음</li>
							)}
						</ul>
					) : (
						<>
							<ul className="weather-cards">
								{places.map((entry, at) => (
									<PlaceCard
										key={keyOf(entry)}
										place={entry}
										loaded={forecastOf(entry)}
										active={at === index}
										editing={editing}
										onSelect={() => choose(at)}
										onRemove={places.length > 1 ? () => remove(at) : undefined}
										onMenu={places.length > 1 ? ({ x, y }) => setCardMenu({ at, x, y }) : undefined}
									/>
								))}
							</ul>
							<p className="weather-list-credit">
								<a href="https://open-meteo.com/" onClick={openCredit}>
									날씨 데이터
								</a>
								에 관하여 더 알아보기
							</p>
						</>
					)}
				</nav>

				<main
					className="weather-main"
					aria-label={`${place.name} 날씨`}
					onPointerDown={(event) => {
						// 좁은 창·휴대폰: 옆으로 밀어 앞뒤 장소로 (시간별 칸은 옆으로 스크롤하므로 빼고)
						swipe.current = (event.target as Element).closest('.weather-hours, button')
							? null
							: { x: event.clientX, y: event.clientY };
					}}
					onPointerUp={(event) => {
						const start = swipe.current;
						swipe.current = null;
						if (!start) return;
						const dx = event.clientX - start.x;
						if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(event.clientY - start.y) * 1.5) return;
						// 아래 막대(장소 점)가 보일 때만 (넓은 창에서는 끌어도 넘기지 않는다)
						const bar = event.currentTarget.querySelector('.weather-bottom-bar');
						if (!bar || getComputedStyle(bar).display === 'none') return;
						const next = index + (dx < 0 ? 1 : -1);
						if (next >= 0 && next < places.length) setSelected(next);
					}}
				>
					{sidebarHidden && (
						<button
							type="button"
							className="weather-sidebar-toggle shown"
							aria-label="사이드바 보기"
							onClick={() => setSidebarHidden(false)}
						>
							<i className="fa-solid fa-table-columns" aria-hidden="true" />
						</button>
					)}
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
							<a href="https://open-meteo.com/" onClick={openCredit}>
								Open-Meteo.com
							</a>{' '}
							(CC BY 4.0)
						</p>
					</div>
					{/* 좁은 창·휴대폰의 아래 막대 (iOS 날씨): 가운데 장소 점, 오른쪽 목록 단추 */}
					<div className="weather-bottom-bar">
						<span className="weather-bottom-spacer" />
						{/* 장소가 둘 이상일 때만 (하나면 넘길 곳이 없다) */}
						{places.length > 1 && (
							<div className="weather-pages" role="group" aria-label="장소 넘기기">
								{places.map((entry, at) => (
									<button
										key={keyOf(entry)}
										type="button"
										className={at === index ? 'active' : ''}
										aria-label={`${entry.name} 날씨 보기`}
										aria-current={at === index || undefined}
										onClick={() => setSelected(at)}
									/>
								))}
							</div>
						)}
						<button
							type="button"
							className="weather-list-toggle"
							aria-label="장소 목록"
							aria-expanded={listOpen}
							onClick={() => setListOpen((open) => !open)}
						>
							<i className="fa-solid fa-list-ul" aria-hidden="true" />
						</button>
					</div>
				</main>
			</div>
			{cardMenu && (
				<Menu
					label="장소 메뉴"
					className="weather-menu weather-menu-compact"
					anchor={cardMenu}
					items={[
						{
							label: '삭제',
							icon: 'fa-solid fa-trash-can',
							destructive: true,
							onSelect: () => remove(cardMenu.at),
						},
					]}
					onClose={() => setCardMenu(null)}
				/>
			)}
			{menu && (
				<Menu
					label="날씨 메뉴"
					className="weather-menu weather-menu-large"
					anchor={menu}
					items={menuItems}
					trigger={moreButton}
					onClose={() => setMenu(null)}
				/>
			)}
		</AppWindow>
	);
};

export default Weather;
