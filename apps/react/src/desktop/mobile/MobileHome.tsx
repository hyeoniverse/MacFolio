import { useLayoutEffect, useRef, useState } from 'react';
import '@/desktop/mobile/MobileHome.css';
import { APP_MANIFEST, APP_NAMES, type AppName } from '@/apps/manifest';
import { WINDOW_APPS } from '@/apps/registry';
import MusicWidget from '@/desktop/mobile/MusicWidget';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import { openSwitcher } from '@/desktop/mobile/switcherStore';
import { env } from '@/shared/config/env';
import { PROFILE } from '@/shared/profile';
import { dragOffset, pageAfterSwipe, pageApps, rowsThatFit } from '@/desktop/mobile/homePages';

/** 홈 화면 아래 Dock에 둘 앱 */
const MOBILE_DOCK: AppName[] = ['safari', 'messages', 'mail', 'music'];

// 창이 있거나 동작(링크·공유)이 있는 앱만 보여준다. 아직 화면이 없는 앱은 눌러도 아무 일이 없기 때문이다.
const launchable = (name: AppName) =>
	WINDOW_APPS.some((app) => app.name === name) || APP_MANIFEST[name].action !== undefined;

const GRID_APPS = APP_NAMES.filter((name) => launchable(name) && !MOBILE_DOCK.includes(name));

const AppIcon = ({ name, showLabel, onLaunch }: { name: AppName; showLabel: boolean; onLaunch: () => void }) => {
	const { squareIcon, mobile } = APP_MANIFEST[name];
	const { label, icon } = mobile ?? APP_MANIFEST[name];
	return (
		<button type="button" className="mobile-app" aria-label={label} data-launch={name} onClick={onLaunch}>
			<img src={`${env.imageUrl}/${icon}`} alt="" className={squareIcon ? 'square' : undefined} draggable={false} />
			{showLabel && <span>{label}</span>}
		</button>
	);
};

/** 아이콘 줄 사이 (CSS의 row-gap과 같다) */
const ROW_GAP = 22;
/** 첫 페이지에서 위젯과 아이콘 사이 (CSS의 margin-top과 같다) */
const GRID_TOP = 24;
/** 이만큼 움직이기 전에는 옆으로 끄는지 아직 모른다 (누르기·세로 쓸기와 구분) */
const DECIDE_PX = 8;
/** 트랙패드로 옆으로 이만큼 밀면 한 페이지 넘긴다 */
const WHEEL_PAGE_PX = 50;
/** 트랙패드 한 번 밀기로 여러 페이지가 넘어가지 않게 잠깐 쉰다 */
const WHEEL_REST_MS = 450;

/**
 * 좁은 화면에서 데스크톱(StatusBar·Dock) 대신 보여주는 iOS 홈 화면.
 * 앱을 누르면 화면을 가득 채워 열리고(AppWindow 모바일 모드), 홈 인디케이터로 돌아온다.
 * 앱이 한 화면에 다 들어가지 않으면 스크롤하지 않고 페이지를 더 만든다 (옆으로 넘기고, 아래 점이 지금 페이지)
 * 넘기기는 브라우저 스크롤에 맡기지 않고 직접 한다: 손가락·마우스·펜 모두 Pointer Events로 끌면 페이지가 따라오고,
 * 놓을 때 끈 거리와 빠르기로 넘길지 정한다(pageAfterSwipe). 트랙패드로 옆으로 밀어도 넘어간다
 */
const MobileHome = ({ launch }: { launch: (app: AppName) => void }) => {
	const pagesRef = useRef<HTMLDivElement>(null);
	const widgetsRef = useRef<HTMLDivElement>(null);
	// 칸 수: 첫 페이지(위젯 아래)와 나머지 페이지. 화면 크기가 바뀌면 다시 잰다
	const [slots, setSlots] = useState({ first: GRID_APPS.length, rest: GRID_APPS.length });
	const [page, setPage] = useState(0);
	// 끄는 중인 거리 (끌지 않으면 null)
	const [drag, setDrag] = useState<number | null>(null);
	const gesture = useRef<{
		id: number;
		x: number;
		y: number;
		time: number;
		state: 'undecided' | 'drag' | 'other';
	} | null>(null);
	const swallowClick = useRef(false);
	const wheel = useRef({ sum: 0, restUntil: 0 });

	useLayoutEffect(() => {
		const pagesEl = pagesRef.current;
		if (!pagesEl) return;
		const measure = () => {
			const grid = pagesEl.querySelector<HTMLElement>('.mobile-grid');
			const icon = pagesEl.querySelector<HTMLElement>('.mobile-app');
			if (!grid || !icon) return;
			const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
			const rowHeight = icon.offsetHeight;
			const widgets = widgetsRef.current?.offsetHeight ?? 0;
			const height = pagesEl.clientHeight;
			const first = rowsThatFit(height - widgets - GRID_TOP, rowHeight, ROW_GAP) * columns;
			const rest = rowsThatFit(height, rowHeight, ROW_GAP) * columns;
			setSlots((current) => (current.first === first && current.rest === rest ? current : { first, rest }));
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(pagesEl);
		if (widgetsRef.current) observer.observe(widgetsRef.current);
		return () => observer.disconnect();
	}, []);

	const pages = pageApps(GRID_APPS, slots.first, slots.rest);
	// 화면이 커져 페이지가 줄면 마지막 페이지에 선다
	const current = Math.min(page, pages.length - 1);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		// 음악 위젯의 재생 위치 막대처럼 스스로 끄는 것은 그대로 둔다
		if (event.button !== 0 || (event.target as Element).closest('[role="slider"], input')) return;
		gesture.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			time: event.timeStamp,
			state: 'undecided',
		};
		swallowClick.current = false;
	};
	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const start = gesture.current;
		if (!start || start.id !== event.pointerId || start.state === 'other') return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (start.state === 'undecided') {
			if (Math.hypot(dx, dy) < DECIDE_PX) return;
			// 세로로 움직였으면 제어 센터 쓸기에 넘긴다
			start.state = Math.abs(dx) > Math.abs(dy) ? 'drag' : 'other';
			if (start.state === 'other') return;
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		setDrag(dragOffset(current, pages.length, dx));
	};
	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		const start = gesture.current;
		gesture.current = null;
		if (!start || start.id !== event.pointerId || start.state !== 'drag') return;
		const dx = event.clientX - start.x;
		setPage(pageAfterSwipe(current, pages.length, dx, event.currentTarget.clientWidth, event.timeStamp - start.time));
		setDrag(null);
		// 끌기를 시작한 아이콘이 눌리지 않게
		swallowClick.current = true;
	};
	const onPointerCancel = () => {
		gesture.current = null;
		setDrag(null);
	};
	const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
		const state = wheel.current;
		if (event.timeStamp < state.restUntil) return;
		state.sum += event.deltaX;
		if (Math.abs(state.sum) < WHEEL_PAGE_PX) return;
		setPage(Math.min(pages.length - 1, Math.max(0, current + (state.sum > 0 ? 1 : -1))));
		state.sum = 0;
		state.restUntil = event.timeStamp + WHEEL_REST_MS;
	};

	return (
		<div className="mobile-home">
			<div
				ref={pagesRef}
				className="mobile-pages"
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerCancel}
				onWheel={onWheel}
				onClickCapture={(event) => {
					if (!swallowClick.current) return;
					swallowClick.current = false;
					event.stopPropagation();
					event.preventDefault();
				}}
			>
				<div
					className={`mobile-pages-track ${drag !== null ? 'dragging' : ''}`}
					style={{ transform: `translateX(calc(${-current * 100}% + ${drag ?? 0}px))` }}
				>
					{pages.map((apps, index) => (
						<section
							key={index}
							className="mobile-page"
							aria-label={`홈 화면 ${index + 1}쪽`}
							aria-hidden={index !== current || undefined}
							inert={index !== current || undefined}
						>
							{index === 0 && (
								<div ref={widgetsRef} className="mobile-widgets">
									<section className="mobile-widget" aria-label="소개">
										<p className="mobile-widget-eyebrow">Portfolio</p>
										<h1>{PROFILE.name}</h1>
										<p>{PROFILE.role}</p>
										<p className="mobile-widget-meta">
											<i className="fa-solid fa-location-dot" aria-hidden="true"></i> {PROFILE.location}
										</p>
									</section>

									<MusicWidget className="mobile-music-widget" onOpen={() => launch('music')} />
								</div>
							)}
							<nav className="mobile-grid" aria-label={index === 0 ? '앱' : `앱 ${index + 1}쪽`}>
								{apps.map((name) => (
									<AppIcon key={name} name={name} showLabel onLaunch={() => launch(name)} />
								))}
							</nav>
						</section>
					))}
				</div>
			</div>

			{pages.length > 1 && (
				<div className="mobile-page-dots" role="tablist" aria-label="홈 화면 페이지">
					{pages.map((_, index) => (
						<button
							key={index}
							type="button"
							role="tab"
							aria-selected={current === index}
							aria-label={`${index + 1}쪽`}
							onClick={() => setPage(index)}
						/>
					))}
				</div>
			)}

			<HomeIndicator className="home-gesture" onSwitcher={openSwitcher} />

			<nav className="mobile-dock" aria-label="Dock">
				{MOBILE_DOCK.map((name) => (
					<AppIcon key={name} name={name} showLabel={false} onLaunch={() => launch(name)} />
				))}
			</nav>
		</div>
	);
};

export default MobileHome;
