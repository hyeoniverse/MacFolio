import React, { useEffect, useMemo, useRef, useState } from 'react';
import FinderIcon from '@/apps/finder/FinderIcon';
import type { FinderItem } from '@/apps/finder/files';
import { requestFinderFolder } from '@/apps/finder/openDoc';
import { useLocations } from '@/apps/finder/useLocations';
import { openInPreview } from '@/apps/preview/previewStore';
import { requestedSection } from '@/apps/settings/settingsRequest';
import { useAppState } from '@/desktop/useAppState';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import {
	arrange,
	CELL,
	cellToPoint,
	cleanUp,
	clickSelect,
	drop,
	intersects,
	parseSaved,
	rectFrom,
	type Cell,
	type Point,
	type Viewport,
} from './layout';
import './DesktopIcons.css';

/** 바탕화면에 두는 폴더: Finder 문서의 이력서·포트폴리오·자격증, 그리고 사진 */
const DESKTOP_IDS = ['docs:이력서', 'docs:포트폴리오', 'docs:자격증', 'pictures'];

/** 이만큼 움직여야 끌기로 본다 (그보다 작으면 클릭) */
const DRAG_THRESHOLD = 4;

function findItem(items: FinderItem[], id: string): FinderItem | null {
	for (const item of items) {
		if (item.id === id) return item;
		if (item.kind === 'folder') {
			const found = findItem(item.children, id);
			if (found) return found;
		}
	}
	return null;
}

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

/** 아이콘에서 실제로 보이는 부분 (끈 사각형과 겹치는지 볼 때): 칸 가운데 그림과 이름 */
const hitRect = ({ x, y }: Point) => ({
	left: x + 14,
	top: y + 2,
	right: x + CELL.width - 14,
	bottom: y + CELL.height - 8,
});

type Pending =
	| { kind: 'icon'; id: string; start: Point; moved: boolean; plain: boolean }
	| { kind: 'band'; start: Point; base: string[] };

/**
 * macOS 바탕화면의 폴더 아이콘 (데스크톱 화면만). 오른쪽 위부터 한 열씩 놓이고,
 * 눌러 고르기(⌘·⇧로 여럿), 빈 곳을 끌어 사각형으로 고르기, 끌어 옮기기(칸에 맞춤, 자리는 브라우저에 저장),
 * 두 번 누르기·⌘O·⌘↓로 열기, 오른쪽 클릭 메뉴(정리하기, 배경화면 변경…)가 된다.
 * 창·Dock·메뉴 막대보다 아래 층이라 창이 덮으면 가려진다
 */
const DesktopIcons: React.FC = () => {
	const { openApp, bringAppToFront } = useAppState();
	const locations = useLocations();
	const viewport = useViewport();
	const layer = useRef<HTMLDivElement>(null);

	const items = useMemo(
		() => DESKTOP_IDS.map((id) => findItem(locations, id)).filter((item): item is FinderItem => item !== null),
		[locations]
	);
	const ids = useMemo(() => items.map((item) => item.id), [items]);

	const [saved, setSaved] = useState<Record<string, Cell>>(() => parseSaved(readJson(STORAGE_KEYS.desktopIcons)));
	const cells = useMemo(() => arrange(ids, saved, viewport), [ids, saved, viewport]);
	const save = (next: Record<string, Cell>) => {
		setSaved(next);
		writeJson(STORAGE_KEYS.desktopIcons, next);
	};

	const [selected, setSelected] = useState<string[]>([]);
	const [offset, setOffset] = useState<Point | null>(null);
	const [band, setBand] = useState<{ start: Point; end: Point } | null>(null);
	const [menu, setMenu] = useState<{ anchor: Point; target: string | null } | null>(null);
	const pending = useRef<Pending | null>(null);

	const open = (item: FinderItem) => {
		if (item.kind === 'pdf' || item.kind === 'image') {
			openApp('preview');
			bringAppToFront('preview');
			openInPreview({ key: item.key, name: item.name, kind: item.kind, size: item.size });
			return;
		}
		// 폴더 (나중에 다른 종류가 바탕화면에 와도 Finder에서 그 자리를 보여 준다)
		requestFinderFolder(item.id);
		openApp('finder');
		bringAppToFront('finder');
	};
	const openSelected = () => items.filter((item) => selected.includes(item.id)).forEach(open);

	const pointOf = (event: React.PointerEvent | React.MouseEvent): Point => ({ x: event.clientX, y: event.clientY });

	// 메뉴는 body에 그려지지만(포털) React 이벤트는 이 층까지 올라온다. 층 안에서 일어난 것만 받는다
	const inLayer = (event: React.SyntheticEvent) => event.currentTarget.contains(event.target as Node);

	const onLayerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0 || !inLayer(event)) return;
		const target = (event.target as Element).closest('[data-desktop-icon]');
		const start = pointOf(event);
		layer.current?.focus({ preventScroll: true });
		if (target) {
			const id = target.getAttribute('data-desktop-icon')!;
			const toggle = event.metaKey || event.ctrlKey;
			const extend = event.shiftKey;
			setSelected((current) => clickSelect(current, id, { toggle, extend }));
			pending.current = { kind: 'icon', id, start, moved: false, plain: !toggle && !extend };
		} else {
			// 빈 곳: ⌘·⇧를 누르고 끌면 지금 선택에 더한다
			const base = event.metaKey || event.shiftKey ? selected : [];
			setSelected(base);
			pending.current = { kind: 'band', start, base };
			// 화면 끝까지 끌어도 이어지게 붙잡는다. 아이콘은 끌기 시작할 때 붙잡는다 (두 번 누르기가 아이콘에 닿게)
			event.currentTarget.setPointerCapture?.(event.pointerId);
		}
	};

	const onLayerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const current = pending.current;
		if (!current) return;
		const point = pointOf(event);
		const delta = { x: point.x - current.start.x, y: point.y - current.start.y };
		if (current.kind === 'icon') {
			if (!current.moved && Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) return;
			if (!current.moved) event.currentTarget.setPointerCapture?.(event.pointerId);
			current.moved = true;
			setOffset(delta);
			return;
		}
		setBand({ start: current.start, end: point });
		const rect = rectFrom(current.start, point);
		const hit = ids.filter((id) => intersects(rect, hitRect(cellToPoint(cells[id], viewport))));
		setSelected([...new Set([...current.base, ...hit])]);
	};

	const onLayerPointerUp = () => {
		const current = pending.current;
		pending.current = null;
		setBand(null);
		if (current?.kind !== 'icon') return;
		if (!current.moved) {
			// 여럿을 고른 채 하나를 그냥 눌렀다 떼면 그것만 남는다 (끌지 않았을 때)
			if (current.plain) setSelected([current.id]);
			return;
		}
		if (offset) {
			const moving = selected.includes(current.id) ? selected : [current.id];
			const moved = Object.fromEntries(
				moving.map((id) => {
					const point = cellToPoint(cells[id], viewport);
					return [id, { x: point.x + offset.x, y: point.y + offset.y }];
				})
			);
			save(drop(cells, moved, viewport));
		}
		setOffset(null);
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (!inLayer(event)) return;
		const command = event.metaKey || event.ctrlKey;
		if (command && event.code === 'KeyA') {
			event.preventDefault();
			setSelected(ids);
		} else if (event.key === 'Escape') {
			setSelected([]);
		} else if (command && (event.code === 'KeyO' || event.key === 'ArrowDown')) {
			event.preventDefault();
			openSelected();
		}
	};

	const onContextMenu = (event: React.MouseEvent) => {
		if (!inLayer(event)) return;
		event.preventDefault();
		const target = (event.target as Element).closest('[data-desktop-icon]')?.getAttribute('data-desktop-icon') ?? null;
		// 고르지 않은 아이콘에서 열면 그것만 고른다 (macOS와 같다)
		if (target && !selected.includes(target)) setSelected([target]);
		if (!target) setSelected([]);
		setMenu({ anchor: pointOf(event), target });
	};

	const byName = [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((item) => item.id);
	const menuItems: MenuItem[] = menu?.target
		? [
				{ label: '열기', onSelect: openSelected },
				{ label: 'Finder에서 보기', onSelect: openSelected },
			]
		: [
				{ label: '새 폴더', onSelect: () => undefined, disabled: true },
				'separator',
				{ label: '정리하기', onSelect: () => save(cleanUp(ids, viewport)) },
				{ label: '이름순으로 정리', onSelect: () => save(cleanUp(byName, viewport)) },
				'separator',
				{
					label: '배경화면 변경…',
					onSelect: () => {
						requestedSection.setState({ section: 'wallpaper' });
						openApp('settings');
						bringAppToFront('settings');
					},
				},
			];

	const bandRect = band && rectFrom(band.start, band.end);

	return (
		<div
			ref={layer}
			className="desktop-icons"
			role="listbox"
			aria-label="바탕화면"
			aria-multiselectable="true"
			tabIndex={-1}
			onPointerDown={onLayerPointerDown}
			onPointerMove={onLayerPointerMove}
			onPointerUp={onLayerPointerUp}
			onPointerCancel={onLayerPointerUp}
			onKeyDown={onKeyDown}
			onContextMenu={onContextMenu}
		>
			{items.map((item) => {
				const isSelected = selected.includes(item.id);
				const point = cellToPoint(cells[item.id], viewport);
				const dragging = offset && isSelected;
				return (
					<div
						key={item.id}
						role="option"
						aria-selected={isSelected}
						aria-label={item.name}
						tabIndex={0}
						data-desktop-icon={item.id}
						className={`desktop-icon${isSelected ? ' selected' : ''}${dragging ? ' dragging' : ''}`}
						style={{
							transform: `translate(${point.x + (dragging ? offset.x : 0)}px, ${point.y + (dragging ? offset.y : 0)}px)`,
						}}
						onDoubleClick={() => open(item)}
						onFocus={() => !isSelected && pending.current === null && setSelected([item.id])}
					>
						<span className="desktop-icon-image">
							<FinderIcon item={item} />
						</span>
						<span className="desktop-icon-label">{item.name}</span>
					</div>
				);
			})}
			{bandRect && (
				<div
					className="desktop-band"
					aria-hidden="true"
					style={{
						left: bandRect.left,
						top: bandRect.top,
						width: bandRect.right - bandRect.left,
						height: bandRect.bottom - bandRect.top,
					}}
				/>
			)}
			{menu && (
				<Menu
					label={menu.target ? '아이콘 메뉴' : '바탕화면 메뉴'}
					anchor={menu.anchor}
					items={menuItems}
					onClose={() => setMenu(null)}
				/>
			)}
		</div>
	);
};

export default DesktopIcons;
