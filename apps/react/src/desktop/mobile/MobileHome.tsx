import { useLayoutEffect, useRef, useState } from 'react';
import '@/desktop/mobile/MobileHome.css';
import { APP_MANIFEST, APP_NAMES, type AppName } from '@/apps/manifest';
import { WINDOW_APPS } from '@/apps/registry';
import MusicWidget from '@/desktop/mobile/MusicWidget';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import { openSwitcher } from '@/desktop/mobile/switcherStore';
import { env } from '@/shared/config/env';
import { PROFILE } from '@/shared/profile';
import { pageApps, rowsThatFit } from '@/desktop/mobile/homePages';

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

/**
 * 좁은 화면에서 데스크톱(StatusBar·Dock) 대신 보여주는 iOS 홈 화면.
 * 앱을 누르면 화면을 가득 채워 열리고(AppWindow 모바일 모드), 홈 인디케이터로 돌아온다.
 * 앱이 한 화면에 다 들어가지 않으면 스크롤하지 않고 페이지를 더 만든다 (옆으로 넘기고, 아래 점이 지금 페이지)
 */
const MobileHome = ({ launch }: { launch: (app: AppName) => void }) => {
	const pagesRef = useRef<HTMLDivElement>(null);
	const widgetsRef = useRef<HTMLDivElement>(null);
	// 칸 수: 첫 페이지(위젯 아래)와 나머지 페이지. 화면 크기가 바뀌면 다시 잰다
	const [slots, setSlots] = useState({ first: GRID_APPS.length, rest: GRID_APPS.length });
	const [page, setPage] = useState(0);

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
	const goTo = (index: number) => {
		const pagesEl = pagesRef.current;
		pagesEl?.scrollTo({ left: index * pagesEl.clientWidth, behavior: 'smooth' });
	};

	return (
		<div className="mobile-home">
			<div
				ref={pagesRef}
				className="mobile-pages"
				onScroll={(event) => {
					const { scrollLeft, clientWidth } = event.currentTarget;
					setPage(Math.round(scrollLeft / Math.max(1, clientWidth)));
				}}
			>
				{pages.map((apps, index) => (
					<section key={index} className="mobile-page" aria-label={`홈 화면 ${index + 1}쪽`}>
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

			{pages.length > 1 && (
				<div className="mobile-page-dots" role="tablist" aria-label="홈 화면 페이지">
					{pages.map((_, index) => (
						<button
							key={index}
							type="button"
							role="tab"
							aria-selected={page === index}
							aria-label={`${index + 1}쪽`}
							onClick={() => goTo(index)}
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
