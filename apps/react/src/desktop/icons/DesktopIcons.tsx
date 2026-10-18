import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FinderIcon from '@/apps/finder/FinderIcon';
import { find, type FinderItem, type FolderItem } from '@/apps/finder/files';
import { canMove, canRename, canTrash, uploadPlan } from '@/apps/finder/edit';
import { uploadInto } from '@/apps/finder/useDocumentDrop';
import InlineName from '@/apps/finder/InlineName';
import { FINDER_DRAG_TYPE, finderDrag, finderRenaming, stemLength, useFinderEdit } from '@/apps/finder/useFinderEdit';
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

/** 이만큼 움직여야 끌기로 본다 (그보다 작으면 클릭) */
const DRAG_THRESHOLD = 4;

/**
 * 아이콘 자리를 저장하는 열쇠. 가상본은 원래 폴더 id (예전에 저장한 이력서·포트폴리오·자격증 자리를 그대로 쓴다)
 */
const keyOf = (item: FinderItem) => (item.kind === 'folder' && item.aliasOf) || item.id;

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

	// 바탕화면은 Finder의 데스크탑 폴더와 같다: 기본 폴더의 가상본(이력서·포트폴리오·자격증)과 관리자가 만들거나 옮긴 것
	const desktop = find(locations, 'desktop') as FolderItem | null;
	const items = useMemo(() => desktop?.children ?? [], [desktop]);
	const ids = useMemo(() => items.map(keyOf), [items]);
	const byKey = (key: string) => items.find((item) => keyOf(item) === key) ?? null;
	const edit = useFinderEdit(locations);
	const renaming = useSyncExternalStore(finderRenaming.subscribe, () => finderRenaming.getState().id);
	/** 놓을 곳으로 강조한 아이콘 (자리 열쇠) */
	const [hover, setHover] = useState<string | null>(null);
	/** Finder 창 안에서 강조한 요소 (바탕화면 아이콘을 Finder 폴더로 끌 때) */
	const finderHover = useRef<Element | null>(null);

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
		// 폴더 (가상본은 원래 폴더). 다른 종류는 Finder에서 그 자리를 보여 준다
		requestFinderFolder(item.kind === 'folder' ? (item.aliasOf ?? item.id) : item.id);
		openApp('finder');
		bringAppToFront('finder');
	};
	const openSelected = () => items.filter((item) => selected.includes(keyOf(item))).forEach(open);

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
			if (edit.admin) highlight(dropTargetAt(point, current.id));
			return;
		}
		setBand({ start: current.start, end: point });
		const rect = rectFrom(current.start, point);
		const hit = ids.filter((id) => intersects(rect, hitRect(cellToPoint(cells[id], viewport))));
		setSelected([...new Set([...current.base, ...hit])]);
	};

	/** 끈 아이콘들 (자리 열쇠) */
	const movingKeys = (id: string) => (selected.includes(id) ? selected : [id]);

	/**
	 * 포인터 아래의 놓을 곳: 다른 바탕화면 폴더 아이콘, 또는 Finder 창의 폴더(아이콘·사이드바·경로 막대·열린 폴더).
	 * 옮길 수 있는 것(관리자, 만든 폴더·올린 파일)을 받을 수 있을 때만
	 */
	const dropTargetAt = (
		point: Point,
		id: string
	): { desktop: string } | { finder: Element; target: FinderItem } | null => {
		const moving = movingKeys(id);
		const movingItems = moving.map(byKey).filter((item): item is FinderItem => item !== null);
		if (!movingItems.every(canMove)) return null;
		const movingIds = movingItems.map((item) => item.id);
		for (const element of document.elementsFromPoint(point.x, point.y)) {
			const icon = element.closest('[data-desktop-icon]');
			if (icon && layer.current?.contains(icon)) {
				const key = icon.getAttribute('data-desktop-icon')!;
				if (moving.includes(key)) continue;
				const target = byKey(key);
				return target && edit.canDrop(movingIds, target) ? { desktop: key } : null;
			}
			if (element === layer.current || layer.current?.contains(element)) return null;
			const finder = element.closest('[data-folder-target]');
			if (finder) {
				const target = find(locations, finder.getAttribute('data-folder-target')!);
				return target && edit.canDrop(movingIds, target) ? { finder, target } : null;
			}
			// 창이 덮은 곳은 그 아래 바탕화면이 아니다
			if (element.closest('[data-app], [role="dialog"]')) return null;
		}
		return null;
	};
	const highlight = (target: ReturnType<typeof dropTargetAt>) => {
		setHover(target && 'desktop' in target ? target.desktop : null);
		const element = target && 'finder' in target ? target.finder : null;
		if (finderHover.current !== element) {
			finderHover.current?.classList.remove('drop-target');
			element?.classList.add('drop-target');
			finderHover.current = element;
		}
	};

	const onLayerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		const current = pending.current;
		pending.current = null;
		setBand(null);
		if (current?.kind !== 'icon') return;
		// 관리자: 폴더 아이콘이나 Finder 창의 폴더 위에 놓으면 그 폴더로 옮긴다 (자리를 바꾸지 않고)
		const target = current.moved && edit.admin ? dropTargetAt(pointOf(event), current.id) : null;
		highlight(null);
		if (target) {
			const into = 'desktop' in target ? byKey(target.desktop)! : target.target;
			const ids = movingKeys(current.id)
				.map(byKey)
				.filter((item): item is FinderItem => item !== null)
				.map((item) => item.id);
			edit.move(ids, into);
			setOffset(null);
			setSelected([]);
			return;
		}
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
		} else if (event.key === 'Enter' && selected.length === 1) {
			// macOS처럼 Enter는 이름 변경 (관리자, 바꿀 수 있는 항목)
			const item = byKey(selected[0]);
			if (edit.admin && item && canRename(item)) {
				event.preventDefault();
				finderRenaming.setState({ id: item.id });
			}
		} else if (command && event.key === 'Backspace') {
			event.preventDefault();
			edit.trash(
				selected.map(byKey).filter((item): item is FinderItem => item !== null),
				() => setSelected([])
			);
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

	const byName = [...items].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(keyOf);
	const menuTarget = menu?.target ? byKey(menu.target) : null;
	/** 새 폴더: 오른쪽 클릭한 자리에 놓고 바로 이름 편집 (관리자) */
	const newFolder = () => {
		const id = edit.newFolder(desktop);
		if (!id || !menu) return;
		save({
			...cells,
			...drop(cells, { [id]: { x: menu.anchor.x - CELL.width / 2, y: menu.anchor.y - 30 } }, viewport),
		});
		setSelected([id]);
	};
	const menuItems: MenuItem[] = menuTarget
		? [
				{ label: '열기', onSelect: openSelected },
				{ label: 'Finder에서 보기', onSelect: openSelected },
				'separator',
				{
					label: '이름 변경',
					disabled: !edit.admin || !canRename(menuTarget),
					onSelect: () => finderRenaming.setState({ id: menuTarget.id }),
				},
				{
					label: '휴지통으로 이동',
					disabled: !edit.admin || !canTrash(menuTarget),
					onSelect: () => edit.trash([menuTarget], () => setSelected([])),
				},
			]
		: [
				{ label: '새 폴더', onSelect: newFolder, disabled: !edit.admin || !desktop },
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
			onDragOver={(event) => {
				// 관리자: 컴퓨터의 파일을 바탕화면이나 폴더 아이콘 위에 놓으면 그 자리에 올린다
				if (edit.admin && event.dataTransfer.types.includes('Files')) {
					const key = (event.target as Element).closest('[data-desktop-icon]')?.getAttribute('data-desktop-icon');
					const ok = !!uploadPlan(locations, key ? byKey(key) : desktop);
					setHover(ok && key ? key : null);
					if (!ok) return;
					event.preventDefault();
					event.dataTransfer.dropEffect = 'copy';
					return;
				}
				if (!event.dataTransfer.types.includes(FINDER_DRAG_TYPE)) return;
				const key = (event.target as Element).closest('[data-desktop-icon]')?.getAttribute('data-desktop-icon');
				const target = key ? byKey(key) : desktop;
				const ok = edit.canDrop(finderDrag.getState().ids, target);
				setHover(ok && key ? key : null);
				if (!ok) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = 'move';
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null);
			}}
			onDrop={(event) => {
				setHover(null);
				if (edit.admin && event.dataTransfer.types.includes('Files')) {
					const key = (event.target as Element).closest('[data-desktop-icon]')?.getAttribute('data-desktop-icon');
					const plan = uploadPlan(locations, key ? byKey(key) : desktop);
					if (!plan) return;
					event.preventDefault();
					void uploadInto(locations, plan.target, [...event.dataTransfer.files]);
					return;
				}
				if (!event.dataTransfer.types.includes(FINDER_DRAG_TYPE)) return;
				const key = (event.target as Element).closest('[data-desktop-icon]')?.getAttribute('data-desktop-icon');
				const target = key ? byKey(key) : desktop;
				const ids = finderDrag.getState().ids;
				if (!target || !edit.canDrop(ids, target)) return;
				event.preventDefault();
				// 바탕화면 빈 곳에 놓으면 놓은 자리에 아이콘을 둔다
				if (edit.move(ids, target) && !key)
					save({
						...cells,
						...drop(
							cells,
							Object.fromEntries(ids.map((id) => [id, { x: event.clientX - CELL.width / 2, y: event.clientY - 30 }])),
							viewport
						),
					});
			}}
		>
			{items.map((item) => {
				const key = keyOf(item);
				const isSelected = selected.includes(key);
				const point = cellToPoint(cells[key], viewport);
				const dragging = offset && isSelected;
				return (
					<div
						key={key}
						role="option"
						aria-selected={isSelected}
						aria-label={item.name}
						tabIndex={0}
						data-desktop-icon={key}
						className={`desktop-icon${isSelected ? ' selected' : ''}${dragging ? ' dragging' : ''}${
							hover === key ? ' drop-target' : ''
						}`}
						style={{
							transform: `translate(${point.x + (dragging ? offset.x : 0)}px, ${point.y + (dragging ? offset.y : 0)}px)`,
						}}
						onDoubleClick={() => open(item)}
						onFocus={() => !isSelected && pending.current === null && setSelected([key])}
					>
						<span className="desktop-icon-image">
							<FinderIcon item={item} />
						</span>
						{renaming === item.id ? (
							<InlineName
								name={item.name}
								select={stemLength(item, item.name)}
								className="desktop-rename"
								onCommit={(name) => {
									void edit.rename(item, name);
									layer.current?.focus({ preventScroll: true });
								}}
								onCancel={() => {
									finderRenaming.setState({ id: null });
									layer.current?.focus({ preventScroll: true });
								}}
							/>
						) : (
							<span className="desktop-icon-label">{item.name}</span>
						)}
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
			{edit.dialog}
		</div>
	);
};

export default DesktopIcons;
