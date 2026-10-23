import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import '@/desktop/mobile/MobileHome.css';
import { APP_MANIFEST, APP_NAMES, type AppName } from '@/apps/manifest';
import { WINDOW_APPS } from '@/apps/registry';
import HomeIndicator from '@/desktop/mobile/HomeIndicator';
import WallpaperVideo from '@/desktop/WallpaperVideo';
import { openSwitcher } from '@/desktop/mobile/switcherStore';
import { appIconUrl } from '@/shared/config/appIcon';
import {
	MOBILE_WIDGET_PAGE_COUNT,
	newWidgetId,
	pageToAdd,
	widgetRows,
	WIDGET_INFO,
	type PageWidget,
	type PostsMode,
	type WidgetKind,
	type WidgetOptions,
	type WidgetSize,
	withOptions,
} from '@/desktop/widgets/catalog';
import { loadMobileWidgets, shareOptions } from '@/desktop/widgets/sharedOptions';
import Widget from '@/desktop/widgets/Widget';
import { closeWidgetEditor, openWidgetEditor, useWidgetEditing } from '@/desktop/widgets/widgetEditor';
import WidgetSheet, { AlbumSheet, PostsModeSheet } from '@/desktop/mobile/WidgetSheet';
import { cssVars } from '@/shared/lib/cssVars';
import { STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import { dragOffset, pageAfterSwipe, pageApps, rowsThatFit, widgetRowHeight } from '@/desktop/mobile/homePages';

/** 홈 화면 아래 Dock에 둘 앱 */
const MOBILE_DOCK: AppName[] = ['safari', 'messages', 'mail', 'music'];

// 창이 있거나 동작(링크·공유)이 있는 앱만 보여준다. 아직 화면이 없는 앱은 눌러도 아무 일이 없기 때문이다.
const launchable = (name: AppName) =>
	!APP_MANIFEST[name].desktopOnly &&
	(WINDOW_APPS.some((app) => app.name === name) || APP_MANIFEST[name].action !== undefined);

const GRID_APPS = APP_NAMES.filter((name) => launchable(name) && !MOBILE_DOCK.includes(name));

const AppIcon = ({ name, showLabel, onLaunch }: { name: AppName; showLabel: boolean; onLaunch: () => void }) => {
	const { squareIcon, mobile } = APP_MANIFEST[name];
	const { label, icon } = mobile ?? APP_MANIFEST[name];
	return (
		<button type="button" className="mobile-app" aria-label={label} data-launch={name} onClick={onLaunch}>
			<img src={appIconUrl(icon)} alt="" className={squareIcon ? 'square' : undefined} draggable={false} />
			{showLabel && <span>{label}</span>}
		</button>
	);
};

/** 아이콘 줄 사이 (CSS의 row-gap과 같다) */
const ROW_GAP = 22;
/** 위젯 사이 (CSS의 .mobile-widgets gap과 같다) */
const WIDGET_GAP = 16;
/** 위젯과 아이콘 사이 (CSS의 margin-top과 같다) */
const GRID_TOP = 24;
/** 이만큼 움직이기 전에는 옆으로 끄는지 아직 모른다 (누르기·세로 쓸기와 구분) */
const DECIDE_PX = 8;
/** 트랙패드로 옆으로 이만큼 밀면 한 페이지 넘긴다 */
const WHEEL_PAGE_PX = 50;
/** 트랙패드 한 번 밀기로 여러 페이지가 넘어가지 않게 잠깐 쉰다 */
const WHEEL_REST_MS = 450;
/** 이만큼 누르고 있으면 위젯 편집 (iOS의 길게 누르기) */
const LONG_PRESS_MS = 550;

/**
 * 좁은 화면에서 데스크톱(StatusBar·Dock) 대신 보여주는 iOS 홈 화면.
 * 앱을 누르면 화면을 가득 채워 열리고(AppWindow 모바일 모드), 홈 인디케이터로 돌아온다.
 * 앱이 한 화면에 다 들어가지 않으면 스크롤하지 않고 페이지를 더 만든다 (옆으로 넘기고, 아래 점이 지금 페이지)
 * 넘기기는 브라우저 스크롤에 맡기지 않고 직접 한다: 손가락·마우스·펜 모두 Pointer Events로 끌면 페이지가 따라오고,
 * 놓을 때 끈 거리와 빠르기로 넘길지 정한다(pageAfterSwipe). 트랙패드로 옆으로 밀어도 넘어간다.
 * 앞 페이지들의 위에는 위젯이 있다. 길게 누르면 편집: 위젯마다 지우기(−), 왼쪽 위 +로 위젯 갤러리, 완료나 빈 곳을 누르면 끝
 */
const MobileHome = ({ launch }: { launch: (app: AppName) => void }) => {
	const pagesRef = useRef<HTMLDivElement>(null);
	const editing = useWidgetEditing();
	const [widgets, setWidgets] = useState<PageWidget[][]>(loadMobileWidgets);
	const [gallery, setGallery] = useState(false);
	// 앨범을 고르는 사진 위젯 (id)
	const [albumFor, setAlbumFor] = useState<string | null>(null);
	// 보일 글을 고르는 메모 위젯 (id)
	const [postsFor, setPostsFor] = useState<string | null>(null);
	const longPress = useRef<number | undefined>(undefined);
	// 칸 수: 위젯이 있는 페이지마다(위젯 아래)와 나머지 페이지. 화면 크기가 바뀌면 다시 잰다
	const [slots, setSlots] = useState({
		leading: Array.from({ length: MOBILE_WIDGET_PAGE_COUNT }, () => GRID_APPS.length),
		rest: GRID_APPS.length,
	});
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
	// 위젯 한 줄의 높이 (재기 전에는 null: 위젯은 정사각형)
	const [widgetRow, setWidgetRow] = useState<number | null>(null);

	useLayoutEffect(() => {
		const pagesEl = pagesRef.current;
		if (!pagesEl) return;
		const measure = () => {
			const grid = pagesEl.querySelector<HTMLElement>('.mobile-grid');
			const icon = pagesEl.querySelector<HTMLElement>('.mobile-app');
			if (!grid || !icon) return;
			const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
			const rowHeight = icon.offsetHeight;
			// 위쪽 안쪽 여백은 떨리는 위젯이 잘리지 않게 둔 자리라 내용 높이에서 뺀다 (MobileHome.css)
			const height = pagesEl.clientHeight - parseFloat(getComputedStyle(pagesEl).paddingTop);
			// 위젯 줄 높이: 위젯 아래에 아이콘 두 줄은 늘 들어가게 (작은 화면에서 위젯이 앱을 밀어내 잘리지 않게)
			const area = pagesEl.querySelector<HTMLElement>('.mobile-widgets');
			if (area?.clientWidth) {
				const square = (area.clientWidth - WIDGET_GAP) / 2;
				const row = widgetRowHeight(height, widgets.map(widgetRows), square, rowHeight, {
					widget: WIDGET_GAP,
					top: GRID_TOP,
					icon: ROW_GAP,
				});
				setWidgetRow((current) => (current === row ? current : row));
			}
			// 위젯 묶음의 높이 (가로로 눕혀 위젯을 숨기면 0)
			const widgetHeights = [...pagesEl.querySelectorAll<HTMLElement>('.mobile-widgets')].map((element) =>
				element.offsetHeight ? element.offsetHeight + GRID_TOP : 0
			);
			const leading = widgetHeights.map((used) => rowsThatFit(height - used, rowHeight, ROW_GAP) * columns);
			const rest = rowsThatFit(height, rowHeight, ROW_GAP) * columns;
			setSlots((current) =>
				current.rest === rest && current.leading.join() === leading.join() ? current : { leading, rest }
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(pagesEl);
		for (const element of pagesEl.querySelectorAll('.mobile-widgets')) observer.observe(element);
		return () => observer.disconnect();
	}, [widgets]);

	const pages = pageApps(GRID_APPS, slots.leading, slots.rest);
	// 화면이 커져 페이지가 줄면 마지막 페이지에 선다
	const current = Math.min(page, pages.length - 1);

	const save = (next: PageWidget[][]) => {
		setWidgets(next);
		writeJson(STORAGE_KEYS.mobileWidgets, next);
	};
	const removeWidget = (id: string) => save(widgets.map((list) => list.filter((widget) => widget.id !== id)));
	/** 고른 값을 적는다. 바탕화면의 같은 위젯도 같이 바뀐다 (sharedOptions.ts) */
	const choose = (id: string, options: WidgetOptions) => {
		const kind = widgets.flat().find((widget) => widget.id === id)?.kind;
		if (!kind) return;
		save(widgets.map((list) => withOptions(list, id, kind, options)));
		shareOptions('desktop', id, kind, options);
	};
	const chooseAlbum = (id: string, album: string | undefined) => {
		choose(id, { album });
		setAlbumFor(null);
	};
	const choosePosts = (id: string, posts: PostsMode) => {
		choose(id, { posts });
		setPostsFor(null);
	};
	/** 지금 페이지(자리가 없으면 자리가 있는 첫 페이지) 끝에 더하고 그 페이지로 간다 */
	const addWidget = (kind: WidgetKind, size: WidgetSize) => {
		const target = pageToAdd(widgets, current, size);
		if (target < 0) return;
		const id = newWidgetId(kind, widgets.flat());
		save(widgets.map((list, index) => (index === target ? [...list, { id, kind, size }] : list)));
		setPage(target);
		setGallery(false);
	};
	const stopEditing = () => {
		setGallery(false);
		setAlbumFor(null);
		setPostsFor(null);
		closeWidgetEditor();
	};
	// 편집 중에는 앱과 위젯을 열지 않는다
	const open = (app: AppName) => {
		if (!editing) launch(app);
	};
	const cancelLongPress = () => window.clearTimeout(longPress.current);
	useEffect(() => cancelLongPress, []);

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
		// 길게 누르면(움직이지 않고) 위젯 편집. 이어지는 클릭은 앱을 열지 않는다
		cancelLongPress();
		if (!editing)
			longPress.current = window.setTimeout(() => {
				if (gesture.current?.state !== 'undecided') return;
				gesture.current.state = 'other';
				swallowClick.current = true;
				openWidgetEditor();
			}, LONG_PRESS_MS);
	};
	const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const start = gesture.current;
		if (!start || start.id !== event.pointerId || start.state === 'other') return;
		const dx = event.clientX - start.x;
		const dy = event.clientY - start.y;
		if (start.state === 'undecided') {
			if (Math.hypot(dx, dy) < DECIDE_PX) return;
			cancelLongPress();
			// 세로로 움직였으면 제어 센터 쓸기에 넘긴다
			start.state = Math.abs(dx) > Math.abs(dy) ? 'drag' : 'other';
			if (start.state === 'other') return;
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		setDrag(dragOffset(current, pages.length, dx));
	};
	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		cancelLongPress();
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
		cancelLongPress();
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
		<div className={`mobile-home${editing ? ' editing' : ''}`}>
			<WallpaperVideo kind="ios" />

			<div
				ref={pagesRef}
				className="mobile-pages"
				style={widgetRow ? cssVars({ 'widget-row': `${widgetRow}px` }) : undefined}
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
				onClick={(event) => {
					// 편집 중에 위젯·앱이 아닌 빈 곳을 누르면 끝낸다 (iOS와 같다)
					if (editing && !(event.target as Element).closest('.widget, .mobile-app, button')) stopEditing();
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
							{index < MOBILE_WIDGET_PAGE_COUNT && (
								<div className="mobile-widgets">
									{(widgets[index] ?? []).map((widget) => {
										const { id, kind, size } = widget;
										return (
											<div key={id} className="mobile-widget-slot" data-size={size}>
												<Widget kind={kind} size={size} options={widget} open={open} />
												{editing && kind === 'photos' && (
													<button
														type="button"
														className="mobile-widget-option"
														aria-label="사진 위젯의 앨범 고르기"
														onClick={() => setAlbumFor(id)}
													>
														앨범
													</button>
												)}
												{editing && kind === 'posts' && (
													<button
														type="button"
														className="mobile-widget-option"
														aria-label="메모 위젯에 보일 글 고르기"
														onClick={() => setPostsFor(id)}
													>
														글
													</button>
												)}
												{editing && (
													<button
														type="button"
														className="mobile-widget-remove"
														aria-label={`${WIDGET_INFO[kind].label} 위젯 제거`}
														onClick={() => removeWidget(id)}
													>
														<i className="fa-solid fa-minus" aria-hidden="true"></i>
													</button>
												)}
											</div>
										);
									})}
								</div>
							)}
							<nav className="mobile-grid" aria-label={index === 0 ? '앱' : `앱 ${index + 1}쪽`}>
								{apps.map((name) => (
									<AppIcon key={name} name={name} showLabel onLaunch={() => open(name)} />
								))}
							</nav>
						</section>
					))}
				</div>
			</div>

			{/* 페이지 점. 편집 중에는 양옆에 위젯 더하기(+)와 완료 (상태 표시줄 자리는 제어 센터가 쓴다) */}
			<div className="mobile-page-row">
				{editing && (
					<button type="button" className="mobile-edit-add" aria-label="위젯 더하기" onClick={() => setGallery(true)}>
						<i className="fa-solid fa-plus" aria-hidden="true"></i>
					</button>
				)}
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
				{editing && (
					<button type="button" className="mobile-edit-done" onClick={stopEditing}>
						완료
					</button>
				)}
			</div>

			<HomeIndicator className="home-gesture" fallbackTone="light" onSwitcher={openSwitcher} />

			<nav className="mobile-dock" aria-label="Dock">
				{MOBILE_DOCK.map((name) => (
					<AppIcon key={name} name={name} showLabel={false} onLaunch={() => open(name)} />
				))}
			</nav>

			{gallery && <WidgetSheet pages={widgets} current={current} onAdd={addWidget} onClose={() => setGallery(false)} />}
			{albumFor && (
				<AlbumSheet
					album={widgets.flat().find((widget) => widget.id === albumFor)?.album}
					onChoose={(album) => chooseAlbum(albumFor, album)}
					onClose={() => setAlbumFor(null)}
				/>
			)}
			{postsFor && (
				<PostsModeSheet
					mode={widgets.flat().find((widget) => widget.id === postsFor)?.posts}
					onChoose={(posts) => choosePosts(postsFor, posts)}
					onClose={() => setPostsFor(null)}
				/>
			)}
		</div>
	);
};

export default MobileHome;
