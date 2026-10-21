import React, { useEffect, useRef, useState } from 'react';
import type { AppName } from '@/apps/manifest';
import { useAppState } from '@/desktop/useAppState';
import { cssVars } from '@/shared/lib/cssVars';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import Button from '@/shared/ui/button/Button';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import {
	DEFAULT_DESKTOP_WIDGETS,
	newWidgetId,
	parseWidgets,
	WIDGET_INFO,
	WIDGET_KINDS,
	type PlacedWidget,
	type WidgetKind,
	type WidgetSize,
} from './catalog';
import { cellToPoint, dropAt, firstFree, pixelSize, resize, visibleLayout, type Point, type Viewport } from './layout';
import Widget from './Widget';
import { usePhotoSources } from './usePhotoSources';
import { closeWidgetEditor, openWidgetEditor, useWidgetEditing } from './widgetEditor';
import './DesktopWidgets.css';

/** 이만큼 움직여야 끌기로 본다 (그보다 작으면 클릭) */
const DRAG_THRESHOLD = 4;

const SIZE_LABEL: Record<WidgetSize, string> = { small: '작게', medium: '중간' };

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

const loadWidgets = () => parseWidgets(readJson(STORAGE_KEYS.desktopWidgets)) ?? DEFAULT_DESKTOP_WIDGETS;

/**
 * 바탕화면 위젯 (macOS Sonoma처럼). 왼쪽 위부터 칸에 맞춰 놓이고, 끌어 옮기면 빈 칸에 붙는다(자리는 브라우저에 저장).
 * 오른쪽 클릭 메뉴로 크기를 바꾸거나 지우고, '위젯 편집…'에서 갤러리를 열어 더한다.
 * 바탕화면 아이콘보다 위, 창·Dock·메뉴 막대보다 아래 층이다
 */
const DesktopWidgets: React.FC = () => {
	const { openApp, bringAppToFront } = useAppState();
	const viewport = useViewport();
	const editing = useWidgetEditing();
	const [widgets, setWidgets] = useState<PlacedWidget[]>(loadWidgets);
	const [drag, setDrag] = useState<{ id: string; offset: Point } | null>(null);
	const [menu, setMenu] = useState<{ anchor: Point; id: string } | null>(null);
	const pending = useRef<{ id: string; start: Point; origin: Point; moved: boolean } | null>(null);
	const swallowClick = useRef(false);

	const photoSources = usePhotoSources();
	const save = (next: PlacedWidget[]) => {
		setWidgets(next);
		writeJson(STORAGE_KEYS.desktopWidgets, next);
	};
	const visible = visibleLayout(widgets, viewport);
	const open = (app: AppName) => {
		openApp(app);
		bringAppToFront(app);
	};

	const add = (kind: WidgetKind, size: WidgetSize) => {
		const cell = firstFree(size, visible, viewport);
		if (!cell) return;
		save([...widgets, { id: newWidgetId(kind, widgets), kind, size, ...cell }]);
	};
	const remove = (id: string) => save(widgets.filter((widget) => widget.id !== id));
	/** 사진 위젯의 앨범 (undefined면 모든 앨범) */
	const chooseAlbum = (id: string, album: string | undefined) =>
		save(widgets.map((widget) => (widget.id === id ? { ...widget, album } : widget)));
	const changeSize = (id: string, size: WidgetSize) =>
		save(visible.map((widget) => (widget.id === id ? resize(widget, size, visible, viewport) : widget)));

	// 편집 중에 Esc를 누르면 끝낸다
	useEffect(() => {
		if (!editing) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closeWidgetEditor();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
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
		}
		setDrag({ id: start.id, offset: { x: dx, y: dy } });
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
			const cell = dropAt(widget, point, visible, viewport);
			save(visible.map((item) => (item.id === widget.id ? { ...item, ...cell } : item)));
		}
		setDrag(null);
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
				...(target.kind === 'photos'
					? ([
							'separator',
							{ heading: '앨범' },
							{
								label: '모든 앨범',
								checked: !photoSources.some((source) => source.id === target.album),
								onSelect: () => chooseAlbum(target.id, undefined),
							},
							...photoSources
								.filter((source) => source.group === 'album')
								.map((source) => ({
									label: source.name,
									checked: target.album === source.id,
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
									checked: target.album === source.id,
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
			<div className={`desktop-widgets${editing ? ' editing' : ''}`} aria-label="위젯">
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
			{editing && <WidgetGallery onAdd={add} />}
		</>
	);
};

/** 위젯 갤러리 (macOS의 '위젯 편집…'): 화면 아래에 종류와 크기마다 미리보기를 늘어놓고, 누르면 빈 칸에 더한다 */
const WidgetGallery = ({ onAdd }: { onAdd: (kind: WidgetKind, size: WidgetSize) => void }) => (
	<div className="widget-gallery" role="dialog" aria-label="위젯 갤러리">
		<div className="widget-gallery-header">
			<h2>위젯</h2>
			<p>누르면 바탕화면의 빈 칸에 놓입니다. 놓은 위젯은 끌어서 옮기고, 오른쪽 클릭으로 크기를 바꿉니다.</p>
			<Button tone="primary" onClick={closeWidgetEditor}>
				완료
			</Button>
		</div>
		<ul className="widget-gallery-list">
			{WIDGET_KINDS.flatMap((kind) =>
				WIDGET_INFO[kind].sizes.map((size) => (
					<li key={`${kind}-${size}`}>
						<button
							type="button"
							className="widget-gallery-item"
							aria-label={`${WIDGET_INFO[kind].label} 위젯 (${SIZE_LABEL[size]}) 더하기`}
							onClick={() => onAdd(kind, size)}
						>
							<span className="widget-gallery-preview" style={pixelSize(size)} inert>
								<Widget kind={kind} size={size} open={() => {}} />
							</span>
							<strong>{WIDGET_INFO[kind].label}</strong>
							<span>{WIDGET_INFO[kind].description}</span>
						</button>
					</li>
				))
			)}
		</ul>
	</div>
);

export default DesktopWidgets;
