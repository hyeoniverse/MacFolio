import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { desktopIconRects } from '@/desktop/icons/iconRects';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import { cssVars } from '@/shared/lib/cssVars';
import { prefersReducedMotion } from '@/shared/lib/media';
import { STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import {
	ALL_ALBUMS,
	newWidgetId,
	POSTS_MODE_LABEL,
	POSTS_MODES,
	SIZE_LABEL,
	WIDGET_INFO,
	type PlacedWidget,
	type PostsMode,
	type WidgetKind,
	type WidgetOptions,
	type WidgetSize,
	withOptions,
} from './catalog';
import { loadDesktopWidgets, shareOptions } from './sharedOptions';
import { cellToPoint, dropAt, firstFree, pixelSize, resize, visibleLayout, type Point, type Viewport } from './layout';
import Widget from './Widget';
import WidgetGallery from './WidgetGallery';
import { usePhotoSources } from './usePhotoSources';
import { useSiteAlbum } from './useSiteAlbum';
import { closeWidgetEditor, openWidgetEditor, useWidgetEditing } from './widgetEditor';
import './DesktopWidgets.css';

/** 이만큼 움직여야 끌기로 본다 (그보다 작으면 클릭) */
const DRAG_THRESHOLD = 4;

const viewportNow = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });

function useViewport(): Viewport {
	const [viewport, setViewport] = useState(viewportNow);
	useEffect(() => {
		const update = () => setViewport(viewportNow());
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return viewport;
}

/**
 * 바탕화면 위젯 (macOS Sonoma처럼). 왼쪽 위부터 칸에 맞춰 놓이고, 끌어 옮기면 빈 칸에 붙는다(자리는 브라우저에 저장).
 * 오른쪽 클릭 메뉴로 크기를 바꾸거나 지우고, '위젯 편집…'에서 갤러리를 열어 더한다.
 * 바탕화면 아이콘보다 위, 창·Dock·메뉴 막대보다 아래 층이다
 */
const DesktopWidgets: React.FC = () => {
	const { apps, openApp, bringAppToFront, minimizeApp, maximizeApp } = useAppState();
	const viewport = useViewport();
	const editing = useWidgetEditing();
	const [widgets, setWidgets] = useState<PlacedWidget[]>(loadDesktopWidgets);
	const [drag, setDrag] = useState<{ id: string; offset: Point } | null>(null);
	const [menu, setMenu] = useState<{ anchor: Point; id: string } | null>(null);
	const pending = useRef<{ id: string; start: Point; origin: Point; moved: boolean } | null>(null);
	const swallowClick = useRef(false);
	// 갤러리에서 고른 위젯이 미리보기 자리에서 바탕화면의 빈 칸으로 날아가는 중 (끝나면 놓는다)
	const [flight, setFlight] = useState<{ widget: PlacedWidget; from: Point } | null>(null);
	const layer = useRef<HTMLDivElement>(null);
	const flying = useRef<HTMLDivElement>(null);
	// 끄는 위젯이 갤러리 시트 자리로 내려가면 시트를 잠시 내린다 (끄기를 시작할 때 시트의 위 변을 재 둔다)
	const [sheetAway, setSheetAway] = useState(false);
	const sheetTop = useRef(Infinity);
	// 편집하는 동안 내려 둔 창 (편집이 끝나면 이것만 다시 띄운다)
	const hidden = useRef<AppName[]>([]);

	const photoSources = usePhotoSources();
	const save = (next: PlacedWidget[]) => {
		setWidgets(next);
		writeJson(STORAGE_KEYS.desktopWidgets, next);
	};
	// 바탕화면 아이콘(폴더 등) 자리: 위젯이 가리지 않게 피한다
	const { rects: iconRects } = useSyncExternalStore(desktopIconRects.subscribe, desktopIconRects.getState);
	const visible = visibleLayout(widgets, viewport, iconRects);
	const open = (app: AppName) => {
		openApp(app);
		bringAppToFront(app);
	};

	/** 빈 칸에 더한다. from(갤러리 미리보기의 자리)이 있으면 거기서 날아가 놓인다 (움직임 줄이기면 바로) */
	const add = (kind: WidgetKind, size: WidgetSize, from?: Point) => {
		if (flight) return;
		const cell = firstFree(size, visible, viewport, iconRects);
		if (!cell) return;
		const widget = { id: newWidgetId(kind, widgets), kind, size, ...cell };
		if (from && !prefersReducedMotion()) setFlight({ widget, from });
		else save([...widgets, widget]);
	};

	// 날기: 미리보기 자리에서 칸 자리까지 크기 그대로 부드럽게 옮긴다 (튀거나 눌리지 않는다).
	// 끝나면 저장해 진짜 위젯으로 바꾼다
	useLayoutEffect(() => {
		const element = flying.current;
		const container = layer.current?.getBoundingClientRect();
		if (!flight || !element || !container) return;
		const to = cellToPoint(flight.widget);
		const dx = container.left + to.x - flight.from.x;
		const dy = container.top + to.y - flight.from.y;
		const animation = element.animate(
			[{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }],
			{ duration: 480, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
		);
		let done = false;
		const land = () => {
			if (done) return;
			done = true;
			setWidgets((current) => {
				const next = [...current, flight.widget];
				writeJson(STORAGE_KEYS.desktopWidgets, next);
				return next;
			});
			setFlight(null);
		};
		animation.finished.then(land, land);
		return () => animation.cancel();
	}, [flight]);
	const remove = (id: string) => save(widgets.filter((widget) => widget.id !== id));
	/** 고른 값을 적는다. 휴대폰 홈 화면의 같은 위젯도 같이 바뀐다 (sharedOptions.ts) */
	const choose = (id: string, options: WidgetOptions) => {
		const kind = widgets.find((widget) => widget.id === id)?.kind;
		if (!kind) return;
		save(withOptions(widgets, id, kind, options));
		shareOptions('mobile', id, kind, options);
	};
	/** 사진 위젯의 앨범 ('모든 앨범'은 ALL_ALBUMS). 관리자가 고르면 사이트 기본값으로도 저장한다 (useSiteAlbum) */
	const siteAlbum = useSiteAlbum();
	const chooseAlbum = (id: string, album: string) => {
		choose(id, { album });
		siteAlbum.share(album);
	};
	/** 메모 위젯이 보일 글 */
	const choosePosts = (id: string, posts: PostsMode) => choose(id, { posts });
	const changeSize = (id: string, size: WidgetSize) =>
		save(visible.map((widget) => (widget.id === id ? resize(widget, size, visible, viewport, iconRects) : widget)));

	// 편집하는 동안은 열린 창을 모두 내려 바탕화면을 보이고, 끝나면 내렸던 창만 그 순서 그대로 다시 띄운다
	const appsNow = useRef(apps);
	useEffect(() => {
		appsNow.current = apps;
	}, [apps]);
	useEffect(() => {
		if (!editing) return;
		const open = (Object.keys(appsNow.current) as AppName[]).filter(
			(name) => appsNow.current[name].isRunning && !appsNow.current[name].isMinimized
		);
		hidden.current = open;
		open.forEach(minimizeApp);
		return () => {
			// 편집 중에 닫았거나 사용자가 직접 띄운 창은 그대로다 (다시 띄우기는 최소화를 풀 뿐이다)
			hidden.current.forEach(maximizeApp);
			hidden.current = [];
		};
	}, [editing, minimizeApp, maximizeApp]);

	// 편집 중에 Esc를 누르거나 갤러리·위젯 바깥(빈 바탕화면, Dock 등)을 누르면 끝낸다 (macOS처럼)
	useEffect(() => {
		if (!editing) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeWidgetEditor();
		};
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (
				target?.closest('.widget-gallery, .desktop-widget, .desktop-widget-flight, [role="menu"], [role="alertdialog"]')
			)
				return;
			closeWidgetEditor();
		};
		window.addEventListener('keydown', onKey);
		window.addEventListener('pointerdown', onPointerDown, true);
		return () => {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('pointerdown', onPointerDown, true);
		};
	}, [editing]);

	const onPointerDown = (event: React.PointerEvent, widget: PlacedWidget) => {
		if (event.button !== 0 || (event.target as Element).closest('button, a, [role="slider"], input')) return;
		pending.current = {
			id: widget.id,
			start: { x: event.clientX, y: event.clientY },
			origin: cellToPoint(widget),
			moved: false,
		};
		swallowClick.current = false;
	};
	const onPointerMove = (event: React.PointerEvent) => {
		const start = pending.current;
		if (!start) return;
		const dx = event.clientX - start.start.x;
		const dy = event.clientY - start.start.y;
		if (!start.moved) {
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			start.moved = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			sheetTop.current = document.querySelector('.widget-gallery')?.getBoundingClientRect().top ?? Infinity;
		}
		setDrag({ id: start.id, offset: { x: dx, y: dy } });
		const widget = visible.find((item) => item.id === start.id);
		if (widget) {
			const bottom = layer.current!.getBoundingClientRect().top + start.origin.y + dy + pixelSize(widget.size).height;
			setSheetAway(bottom > sheetTop.current);
		}
	};
	const onPointerUp = (event: React.PointerEvent) => {
		const start = pending.current;
		pending.current = null;
		if (!start?.moved) return;
		const widget = visible.find((item) => item.id === start.id);
		if (widget) {
			const point = {
				x: start.origin.x + event.clientX - start.start.x,
				y: start.origin.y + event.clientY - start.start.y,
			};
			const cell = dropAt(widget, point, visible, viewport, iconRects);
			save(visible.map((item) => (item.id === widget.id ? { ...item, ...cell } : item)));
		}
		setDrag(null);
		setSheetAway(false);
		// 끌기를 끝낸 위젯이 눌려 앱이 열리지 않게
		swallowClick.current = true;
	};

	const target = menu ? visible.find((widget) => widget.id === menu.id) : undefined;
	const menuItems: MenuItem[] = target
		? [
				...WIDGET_INFO[target.kind].sizes.map((size) => ({
					label: SIZE_LABEL[size],
					checked: target.size === size,
					onSelect: () => changeSize(target.id, size),
				})),
				...(target.kind === 'posts'
					? ([
							'separator',
							{ heading: '보일 글' },
							...POSTS_MODES.map((mode) => ({
								label: POSTS_MODE_LABEL[mode],
								checked: (target.posts ?? 'recent') === mode,
								onSelect: () => choosePosts(target.id, mode),
							})),
						] satisfies MenuItem[])
					: []),
				...(target.kind === 'photos'
					? ([
							'separator',
							{ heading: '앨범' },
							{
								label: '모든 앨범',
								checked: !photoSources.some((source) => source.id === siteAlbum.shown(target.album)),
								onSelect: () => chooseAlbum(target.id, ALL_ALBUMS),
							},
							...photoSources
								.filter((source) => source.group === 'album')
								.map((source) => ({
									label: source.name,
									checked: siteAlbum.shown(target.album) === source.id,
									onSelect: () => chooseAlbum(target.id, source.id),
								})),
							// Finder › 그림에 만든 폴더 (관리자가 올린 그림)
							...(photoSources.some((source) => source.group === 'folder')
								? (['separator', { heading: '그림 폴더' }] satisfies MenuItem[])
								: []),
							...photoSources
								.filter((source) => source.group === 'folder')
								.map((source) => ({
									label: source.name,
									checked: siteAlbum.shown(target.album) === source.id,
									onSelect: () => chooseAlbum(target.id, source.id),
								})),
						] satisfies MenuItem[])
					: []),
				'separator',
				{ label: '위젯 제거', destructive: true, onSelect: () => remove(target.id) },
				'separator',
				{ label: '위젯 편집…', onSelect: openWidgetEditor },
			]
		: [];

	return (
		<>
			<div ref={layer} className={`desktop-widgets${editing ? ' editing' : ''}`} aria-label="위젯">
				{visible.map((widget) => {
					const point = cellToPoint(widget);
					const offset = drag?.id === widget.id ? drag.offset : { x: 0, y: 0 };
					const { width, height } = pixelSize(widget.size);
					return (
						<div
							key={widget.id}
							className={`desktop-widget${drag?.id === widget.id ? ' dragging' : ''}`}
							style={{
								...cssVars({ x: `${point.x + offset.x}px`, y: `${point.y + offset.y}px` }),
								width,
								height,
							}}
							onPointerDown={(event) => onPointerDown(event, widget)}
							onPointerMove={onPointerMove}
							onPointerUp={onPointerUp}
							onPointerCancel={() => {
								pending.current = null;
								setDrag(null);
								setSheetAway(false);
							}}
							onClickCapture={(event) => {
								if (!swallowClick.current && !editing) return;
								swallowClick.current = false;
								// 편집 중에는 앱을 열지 않는다 (지우기 단추만 눌린다)
								if (!(event.target as Element).closest('.desktop-widget-remove')) {
									event.stopPropagation();
									event.preventDefault();
								}
							}}
							onContextMenu={(event) => {
								event.preventDefault();
								event.stopPropagation();
								setMenu({ anchor: { x: event.clientX, y: event.clientY }, id: widget.id });
							}}
						>
							<Widget kind={widget.kind} size={widget.size} options={widget} open={open} />
							{editing && (
								<button
									type="button"
									className="desktop-widget-remove"
									aria-label={`${WIDGET_INFO[widget.kind].label} 위젯 제거`}
									onClick={() => remove(widget.id)}
								>
									<i className="fa-solid fa-minus" aria-hidden="true"></i>
								</button>
							)}
						</div>
					);
				})}
			</div>
			{menu && target && (
				<Menu label="위젯 메뉴" anchor={menu.anchor} items={menuItems} onClose={() => setMenu(null)} />
			)}
			{editing && <WidgetGallery onAdd={add} away={sheetAway} />}
			{/* 날아가는 위젯: 갤러리 시트보다 위 층의 겉모습만 (누를 수 없고 화면 읽기에 보이지 않는다) */}
			{flight && (
				<div
					ref={flying}
					className="desktop-widget-flight"
					style={{ left: flight.from.x, top: flight.from.y, ...pixelSize(flight.widget.size) }}
					aria-hidden="true"
					inert
				>
					<Widget kind={flight.widget.kind} size={flight.widget.size} open={() => {}} />
				</div>
			)}
		</>
	);
};

export default DesktopWidgets;
