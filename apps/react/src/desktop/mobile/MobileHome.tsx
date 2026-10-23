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
import {
	dragOffset,
	iconRowsBelow,
	pageAfterSwipe,
	pageApps,
	rowsThatFit,
	widgetRowHeight,
} from '@/desktop/mobile/homePages';
import { useWidgetReorder } from '@/desktop/mobile/useWidgetReorder';
import { normalizeOrder } from '@/desktop/mobile/widgetOrder';

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
/** 위젯 칸 안에서 누르기만 하는 편집 단추 (끌기를 시작하지 않는다) */
const WIDGET_EDIT_BUTTONS = '.mobile-widget-remove, .mobile-widget-option, .mobile-widget-move';

/**
 * 좁은 화면에서 데스크톱(StatusBar·Dock) 대신 보여주는 iOS 홈 화면.
 * 앱을 누르면 화면을 가득 채워 열리고(AppWindow 모바일 모드), 홈 인디케이터로 돌아온다.
 * 앱이 한 화면에 다 들어가지 않으면 스크롤하지 않고 페이지를 더 만든다 (옆으로 넘기고, 아래 점이 지금 페이지)
 * 넘기기는 브라우저 스크롤에 맡기지 않고 직접 한다: 손가락·마우스·펜 모두 Pointer Events로 끌면 페이지가 따라오고,
 * 놓을 때 끈 거리와 빠르기로 넘길지 정한다(pageAfterSwipe). 트랙패드로 옆으로 밀어도 넘어간다.
 * 앞 페이지들의 위에는 위젯이 있다. 길게 누르면 편집: 위젯마다 지우기(−), 왼쪽 위 +로 위젯 갤러리, 완료나 빈 곳을 누르면 끝.
 * 편집 중에는 위젯을 끌어 순서를 바꾼다(useWidgetReorder). 편집 전이라도 위젯을 길게 눌러 편집이 되면 손을 떼지 않고 바로 끈다
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
		state: 'undecided' | 'drag' | 'widget' | 'other';
		/** 누른 위젯 (위젯 칸 위에서 눌렀으면) */
		widget?: string;
		/** 움직이면 위젯을 끈다: 편집 중에 눌렀거나, 길게 눌러 편집이 되었다 */
		liftsWidget: boolean;
	} | null>(null);
	const swallowClick = useRef(false);
	const wheel = useRef({ sum: 0, restUntil: 0 });
	// 위젯 한 줄의 높이 (재기 전에는 null: 위젯은 정사각형)
	const [widgetRow, setWidgetRow] = useState<number | null>(null);

	/** 저장한다. 페이지마다 보이는 순서로 늘어놓는다 (작은 위젯은 앞의 빈 칸을 채운다: widgetOrder.ts) */
	const save = (next: PageWidget[][]) => {
		const ordered = next.map(normalizeOrder);
		setWidgets(ordered);
		writeJson(STORAGE_KEYS.mobileWidgets, ordered);
	};
	// 위젯은 위젯 페이지(앞 MOBILE_WIDGET_PAGE_COUNT쪽)에만 있어 page가 페이지 수를 넘는 일은 끄는 동안 없다
	const reorder = useWidgetReorder({ widgets, page, setPage, save, pagesRef, editing });
	// 끄는 동안은 놓을 순서로 그린다
	const shownWidgets = reorder.shown;

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
			// 위젯 줄 높이: 화면 크기로만 정한다 (위젯을 옮기거나 더해도 크기가 바뀌지 않게. homePages.ts)
			const area = pagesEl.querySelector<HTMLElement>('.mobile-widgets');
			if (area?.clientWidth) {
				const square = (area.clientWidth - WIDGET_GAP) / 2;
				const row = widgetRowHeight(height, square, rowHeight, {
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
			// 위젯이 페이지를 다 차지하면 그 페이지의 앱 칸은 0 (아이콘이 잘리지 않게 다음 페이지로)
			const leading = widgetHeights.map((used) => iconRowsBelow(height - used, rowHeight, ROW_GAP) * columns);
			const rest = rowsThatFit(height, rowHeight, ROW_GAP) * columns;
			setSlots((current) =>
				current.rest === rest && current.leading.join() === leading.join() ? current : { leading, rest }
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(pagesEl);
		for (const element of pagesEl.querySelectorAll('.mobile-widgets')) observer.observe(element);
		// 아이콘 높이(줄 높이 계산의 기준)가 바뀌어도 다시 잰다
		const icon = pagesEl.querySelector('.mobile-app');
		if (icon) observer.observe(icon);
		return () => observer.disconnect();
	}, [shownWidgets]);

	const pages = pageApps(GRID_APPS, slots.leading, slots.rest);
	// 화면이 커져 페이지가 줄면 마지막 페이지에 선다
	const current = Math.min(page, pages.length - 1);

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
	// 위젯을 끄는 손가락은 브라우저가 세로 스크롤(touch-action: pan-y)로 가져가지 않게 막는다.
	// 편집 중에는 위젯 칸이 touch-action: none이지만, 길게 눌러 편집이 된 손가락은 누른 시각의 값을 따른다
	useEffect(() => {
		const element = pagesRef.current;
		if (!element) return;
		const block = (event: TouchEvent) => {
			const start = gesture.current;
			if (start?.widget && start.liftsWidget && start.state !== 'other' && event.cancelable) event.preventDefault();
		};
		element.addEventListener('touchmove', block, { passive: false });
		return () => element.removeEventListener('touchmove', block);
	}, []);

	const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		// 음악 위젯의 재생 위치 막대처럼 스스로 끄는 것은 그대로 둔다
		const target = event.target as Element;
		if (event.button !== 0 || target.closest('[role="slider"], input')) return;
		// 위젯 칸 위에서 눌렀는지 (편집 단추·앨범 단추는 누르기만 한다)
		const slot = target.closest<HTMLElement>('.mobile-widget-slot');
		const widget = slot && !target.closest(WIDGET_EDIT_BUTTONS) ? slot.dataset.widgetId : undefined;
		gesture.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			time: event.timeStamp,
			state: 'undecided',
			widget,
			liftsWidget: editing && widget !== undefined,
		};
		swallowClick.current = false;
		// 길게 누르면(움직이지 않고) 위젯 편집. 이어지는 클릭은 앱을 열지 않는다.
		// 위젯을 눌렀으면 손을 떼지 않고 움직여 바로 끌 수 있다 (iOS와 같다)
		cancelLongPress();
		if (!editing)
			longPress.current = window.setTimeout(() => {
				const start = gesture.current;
				if (start?.state !== 'undecided') return;
				if (start.widget) start.liftsWidget = true;
				else start.state = 'other';
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
			if (start.widget && start.liftsWidget) {
				// 위젯 끌기: 어느 방향이든 위젯이 손가락을 따라온다 (페이지 넘기기·제어 센터 쓸기 대신)
				start.state = reorder.start(start.widget, { x: start.x, y: start.y }) ? 'widget' : 'other';
				if (start.state === 'other') return;
				event.currentTarget.setPointerCapture(event.pointerId);
				swallowClick.current = true;
			} else {
				// 세로로 움직였으면 제어 센터 쓸기에 넘긴다
				start.state = Math.abs(dx) > Math.abs(dy) ? 'drag' : 'other';
				if (start.state === 'other') return;
				event.currentTarget.setPointerCapture(event.pointerId);
			}
		}
		if (start.state === 'widget') {
			reorder.move({ x: event.clientX, y: event.clientY });
			return;
		}
		setDrag(dragOffset(current, pages.length, dx));
	};
	const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		cancelLongPress();
		const start = gesture.current;
		gesture.current = null;
		if (start?.id === event.pointerId && start.state === 'widget') {
			reorder.end();
			swallowClick.current = true;
			return;
		}
		if (!start || start.id !== event.pointerId || start.state !== 'drag') return;
		const dx = event.clientX - start.x;
		setPage(pageAfterSwipe(current, pages.length, dx, event.currentTarget.clientWidth, event.timeStamp - start.time));
		setDrag(null);
		// 끌기를 시작한 아이콘이 눌리지 않게
		swallowClick.current = true;
	};
	const onPointerCancel = () => {
		cancelLongPress();
		if (gesture.current?.state === 'widget') reorder.cancel();
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
					// 편집 중에는 위젯의 빈 곳을 눌러도 앱을 열지 않는다. 위젯이 앱에 남기는 요청(사진 위젯의 사진, 메모 위젯의 글)도
					// 남기지 않아, 나중에 그 앱을 열 때 엉뚱한 항목이 열리지 않는다 (위젯 안의 단추는 그대로 눌린다)
					const target = event.target as Element;
					const editingTap =
						editing && target.closest('.widget') && !target.closest('button, a, [role="slider"], input');
					if (!swallowClick.current && !editingTap) return;
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
									{(shownWidgets[index] ?? []).map((widget) => {
										const { id, kind, size } = widget;
										return (
											<div
												key={id}
												ref={reorder.slotRef(id)}
												className={`mobile-widget-slot${reorder.draggingId === id ? ' lifted' : ''}`}
												data-size={size}
												data-widget-id={id}
												// 편집 중 위젯을 세로로 끌어도 제어 센터가 열리지 않게 (useVerticalSwipe)
												data-swipe-ignore={editing || undefined}
											>
												<Widget kind={kind} size={size} options={widget} open={open} />
												{editing && (
													// 키보드로 옮기기: 초점을 두고 화살표 키 (← ↑ 앞으로, → ↓ 뒤로). 초점이 있을 때만 보인다
													<button
														type="button"
														className="mobile-widget-move"
														aria-label={`${WIDGET_INFO[kind].label} 위젯 옮기기`}
														aria-describedby="mobile-widget-move-hint"
														aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
														onKeyDown={(event) => {
															const step =
																event.key === 'ArrowLeft' || event.key === 'ArrowUp'
																	? -1
																	: event.key === 'ArrowRight' || event.key === 'ArrowDown'
																		? 1
																		: 0;
															if (!step) return;
															event.preventDefault();
															reorder.moveWithKey(id, step);
														}}
													/>
												)}
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

			{editing && (
				<p id="mobile-widget-move-hint" className="visually-hidden">
					화살표 키로 위젯의 순서를 바꿉니다
				</p>
			)}
			<p className="visually-hidden" aria-live="polite">
				{reorder.announcement}
			</p>

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
