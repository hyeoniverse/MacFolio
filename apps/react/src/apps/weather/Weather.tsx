import { useCallback, useMemo, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { openExternal } from '@/shared/analytics/analytics';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { loadPlaces, loadUnit, samePlace, savePlaces, saveUnit, type Place } from './places';
import { type TemperatureUnit } from './weatherApi';
import SearchField from '@/shared/ui/search-field/SearchField';
import IconButton from '@/shared/ui/button/IconButton';
import SidebarToggle from '@/shared/ui/button/SidebarToggle';
import Button from '@/shared/ui/button/Button';
import Sidebar from '@/shared/ui/sidebar/Sidebar';
import './Weather.css';
import { useCompact } from './useCompact';
import { keyOf, useForecasts } from './useForecasts';
import { usePlaceSearch } from './usePlaceSearch';
import PlaceCard from './components/PlaceCard';
import Detail from './components/Detail';

const openCredit = (event: React.MouseEvent) => {
	event.preventDefault();
	openExternal('https://open-meteo.com/');
};

/**
 * 날씨: macOS·iOS 날씨 앱처럼 장소 카드 목록과, 고른 곳의 하늘 색 배경·큰 기온·시간별·10일 일기예보·상세 칸.
 * 데이터는 Open-Meteo(키 없는 공개 API). 장소와 기온 단위는 이 브라우저에 남긴다 (places.ts).
 * 넓은 창은 왼쪽에 목록이 늘 있다. 좁은 창·휴대폰은 iOS처럼 날씨만 보이고, 아래 막대의 점으로 장소를 넘기고(옆으로 밀어도 된다)
 * 목록 버튼으로 '날씨' 목록(큰 제목, ••• 메뉴, 아래 검색)을 연다
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
	/** 넓은 창: 사이드바를 접었는지 (macOS의 사이드바 버튼) */
	const [sidebarHidden, setSidebarHidden] = useState(false);
	const moreButton = useRef<HTMLButtonElement>(null);
	const swipe = useRef<{ x: number; y: number } | null>(null);
	const { attach: attachShell, compact } = useCompact<HTMLDivElement>();
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
			{/* iOS 날씨처럼 홈으로 가는 버튼이 없다 (홈 바로 나간다) */}
			<MobileNavigation hideHome />
			<div
				ref={attachShell}
				className={`weather sky-${weather?.sky ?? 'cloudy'} ${weather?.day === false ? 'night' : 'day'}`}
				data-compact={compact || undefined}
			>
				{/*
				 * 넓은 창의 사이드바 버튼. 사이드바 밖에 따로 두어 창 위쪽 끌기 자리(신호등 줄) 위로 올린다:
				 * 사이드바째 올리면 사이드바가 신호등을 덮는다
				 */}
				{!compact && (
					<SidebarToggle
						className={`weather-sidebar-toggle ${sidebarHidden ? 'shown' : ''}`}
						open={!sidebarHidden}
						onToggle={() => setSidebarHidden((hidden) => !hidden)}
					/>
				)}
				<Sidebar
					variant="floating"
					className={`weather-sidebar ${listOpen ? 'open' : ''} ${editing ? 'editing' : ''} ${sidebarHidden ? 'hidden' : ''}`}
					aria-label="장소"
				>
					{/* 신호등 줄 (넓은 창은 그 오른쪽에 사이드바 버튼이 떠 있다) */}
					<div className="weather-lights-space" />
					<header className="weather-list-head">
						<h2>날씨</h2>
						<IconButton
							ref={moreButton}
							className="weather-more"
							label="더 보기"
							icon="fa-solid fa-ellipsis"
							aria-haspopup="menu"
							aria-expanded={menu !== null}
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								setMenu(menu ? null : { x: rect.right - 260, y: rect.bottom + 8 });
							}}
						/>
					</header>
					<SearchField
						className="weather-search"
						label="도시 검색"
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
				</Sidebar>

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
					<div className="weather-scroll">
						{weather ? (
							<Detail place={place} weather={weather} />
						) : (
							<p className="weather-status">
								{loaded?.status === 'error' ? (
									<>
										날씨를 불러오지 못했습니다.
										<Button onClick={reload}>다시 시도</Button>
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
					{/* 좁은 창·휴대폰의 아래 막대 (iOS 날씨): 가운데 장소 점, 오른쪽 목록 버튼 */}
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
