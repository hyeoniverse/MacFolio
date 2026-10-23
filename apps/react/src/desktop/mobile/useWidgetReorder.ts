// 휴대폰 홈 화면 편집 중에 위젯을 끌어 순서를 바꾼다 (iOS 홈 화면처럼).
// - 끄는 위젯은 손가락을 따라오고(translate), 놓을 순서(orderForDrop)가 바뀌면 다른 위젯이 새 자리로 미끄러져 비켜 준다(FLIP)
// - 화면 왼쪽·오른쪽 가장자리에 잠시 머물면 옆 페이지로 넘어가 그 페이지에 놓는다 (위젯을 둘 수 있는 페이지, 줄이 남을 때만)
// - 놓으면 그 순서를 저장한다. 키보드로는 moveWithKey로 한 칸씩 옮긴다
// 포인터 이벤트는 MobileHome이 받아(페이지 넘기기·길게 누르기와 한 곳에서 가른다) start·move·end·cancel로 넘긴다
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MOBILE_WIDGET_PAGE_COUNT, WIDGET_INFO, type PageWidget } from '@/desktop/widgets/catalog';
import { prefersReducedMotion } from '@/shared/lib/media';
import {
	canMoveTo,
	moveByKey,
	normalizeOrder,
	orderForDrop,
	placeOnPage,
	positionOf,
	type CellPoint,
} from '@/desktop/mobile/widgetOrder';

/** 화면 가장자리에서 이만큼 안쪽까지 끌면 옆 페이지로 넘길 준비를 한다 */
export const EDGE_PX = 28;
/** 가장자리에 이만큼 머물면 옆 페이지로 넘긴다 (지나가기만 한 것과 구분) */
export const EDGE_HOLD_MS = 600;
/** 비켜 주는 위젯과, 놓은 위젯이 칸에 붙는 시간 */
const SLIDE_MS = 240;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface Point {
	x: number;
	y: number;
}

interface Drag {
	widget: PageWidget;
	/** 누른 곳이 위젯의 왼쪽 위에서 떨어진 거리 */
	grab: Point;
	pointer: Point;
	edge: { side: -1 | 0 | 1; timer?: number };
	frame?: number;
}

interface Options {
	widgets: PageWidget[][];
	/** 지금 페이지 */
	page: number;
	setPage: (page: number) => void;
	save: (pages: PageWidget[][]) => void;
	/** 페이지들을 담은 요소 (가장자리 판단) */
	pagesRef: React.RefObject<HTMLDivElement | null>;
	editing: boolean;
}

/** 칸 묶음(.mobile-widgets) 안에서의 자리. 떨림(transform)·끌기(translate)와 상관없는 레이아웃 자리다 */
function layoutPoint(element: HTMLElement): Point | null {
	const container = element.offsetParent;
	if (!(container instanceof HTMLElement)) return null;
	const rect = container.getBoundingClientRect();
	return { x: rect.left + element.offsetLeft, y: rect.top + element.offsetTop };
}

/** 칸 묶음 안의 점을 칸 단위로 (작은 위젯 한 칸의 가운데가 0.5) */
function toCells(container: HTMLElement, rowHeight: number, x: number, y: number): CellPoint {
	const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
	const column = (container.clientWidth - gap) / 2;
	return { x: (x + gap / 2) / (column + gap), y: (y + gap / 2) / (rowHeight + gap) };
}

/**
 * 끄는 위젯을 손가락 아래에 두는 프레임 함수. 페이지가 넘어가는 동안(트랙이 움직이는 동안)에도 맞도록
 * 매 프레임 레이아웃 자리를 다시 잰다. 끌기가 끝나면(drag.current가 null) 멈춘다
 */
function followPointer(drag: { current: Drag | null }, slots: Map<string, HTMLElement>) {
	const tick = () => {
		const current = drag.current;
		if (!current) return;
		const element = slots.get(current.widget.id);
		const base = element && layoutPoint(element);
		if (element && base) {
			const x = current.pointer.x - current.grab.x - base.x;
			const y = current.pointer.y - current.grab.y - base.y;
			element.style.translate = `${x}px ${y}px`;
		}
		current.frame = requestAnimationFrame(tick);
	};
	return tick;
}

export function useWidgetReorder({ widgets, page, setPage, save, pagesRef, editing }: Options) {
	// 끄는 동안 보이는 순서 (끌지 않으면 null: 저장한 순서를 그린다)
	const [preview, setPreview] = useState<PageWidget[][] | null>(null);
	const [draggingId, setDraggingId] = useState<string | null>(null);
	// 화면 읽기 프로그램에 알리는 말 (키보드로 옮겼을 때)
	const [announcement, setAnnouncement] = useState('');
	const slots = useRef(new Map<string, HTMLDivElement>());
	const drag = useRef<Drag | null>(null);
	const latest = useRef({ preview, widgets, page });
	useLayoutEffect(() => {
		latest.current = { preview, widgets, page };
	});
	// 비켜 주는 애니메이션의 시작점: 지난번 그린 자리 (칸 묶음 요소와 그 안의 자리)
	const lastLayout = useRef(new Map<string, { container: Element | null; x: number; y: number }>());
	// 키보드로 옮긴 뒤 초점을 되돌릴 위젯 (다른 페이지로 가면 요소가 새로 생긴다)
	const refocus = useRef<string | null>(null);

	const shown = preview ?? widgets;

	/** 위젯 칸 요소를 기억한다 (다른 페이지로 옮기면 요소가 새로 생긴다) */
	const slotRef = (id: string) => (element: HTMLDivElement | null) => {
		if (!element) return;
		slots.current.set(id, element);
		return () => {
			if (slots.current.get(id) === element) slots.current.delete(id);
		};
	};

	const clearEdge = (current: Drag) => {
		window.clearTimeout(current.edge.timer);
		current.edge = { side: 0 };
	};

	/** 옆 페이지로 넘긴다: 그 페이지에 자리가 있으면 위젯을 그 페이지 끝에 두고 넘어간다. 계속 머물면 또 넘긴다 */
	const turnPage = (side: -1 | 1) => {
		const current = drag.current;
		if (!current) return;
		const { preview: pages, page: now } = latest.current;
		const target = now + side;
		if (!pages || target >= MOBILE_WIDGET_PAGE_COUNT || !canMoveTo(pages, target, current.widget)) {
			clearEdge(current);
			return;
		}
		const order = normalizeOrder([
			...pages[target].filter((widget) => widget.id !== current.widget.id),
			current.widget,
		]);
		setPreview(placeOnPage(pages, current.widget.id, target, order));
		setPage(target);
		current.edge.timer = window.setTimeout(() => turnPage(side), EDGE_HOLD_MS);
	};

	/** 끌기를 시작한다. 그 위젯이 화면에 없으면 false */
	const start = (id: string, pointer: Point): boolean => {
		const element = slots.current.get(id);
		const widget = widgets.flat().find((item) => item.id === id);
		const base = element && layoutPoint(element);
		if (!element || !widget || !base) return false;
		drag.current = {
			widget,
			grab: { x: pointer.x - base.x, y: pointer.y - base.y },
			pointer,
			edge: { side: 0 },
		};
		setPreview(widgets);
		setDraggingId(id);
		drag.current.frame = requestAnimationFrame(followPointer(drag, slots.current));
		return true;
	};

	const move = (pointer: Point) => {
		const current = drag.current;
		const pages = latest.current.preview;
		if (!current || !pages) return;
		current.pointer = pointer;
		const element = slots.current.get(current.widget.id);
		const container = element?.offsetParent;
		const at = pages.findIndex((list) => list.some((widget) => widget.id === current.widget.id));
		if (element && container instanceof HTMLElement && at >= 0) {
			const rect = container.getBoundingClientRect();
			const center = toCells(
				container,
				element.offsetHeight,
				pointer.x - current.grab.x + element.offsetWidth / 2 - rect.left,
				pointer.y - current.grab.y + element.offsetHeight / 2 - rect.top
			);
			const order = orderForDrop(pages[at], current.widget, center);
			if (order.some((widget, index) => widget.id !== pages[at][index]?.id))
				setPreview(placeOnPage(pages, current.widget.id, at, order));
		}
		// 가장자리에 머무는지
		const bounds = pagesRef.current?.getBoundingClientRect();
		const side = !bounds ? 0 : pointer.x < bounds.left + EDGE_PX ? -1 : pointer.x > bounds.right - EDGE_PX ? 1 : 0;
		if (side === current.edge.side) return;
		clearEdge(current);
		current.edge.side = side;
		if (side !== 0) current.edge.timer = window.setTimeout(() => turnPage(side), EDGE_HOLD_MS);
	};

	/** 끄기를 끝낸다. 위젯을 칸에 붙이고 (commit이면) 그 순서를 저장한다 */
	const finish = (commit: boolean) => {
		const current = drag.current;
		if (!current) return;
		drag.current = null;
		clearEdge(current);
		if (current.frame !== undefined) cancelAnimationFrame(current.frame);
		const element = slots.current.get(current.widget.id);
		const pages = latest.current.preview;
		if (element) {
			const from = element.style.translate;
			element.style.translate = '';
			if (commit && from && !prefersReducedMotion())
				element.animate([{ translate: from }, { translate: '0px 0px' }], { duration: SLIDE_MS, easing: EASE });
		}
		setPreview(null);
		setDraggingId(null);
		if (!commit || !pages) {
			// 다른 페이지로 넘어갔다가 취소하면 위젯이 있던 페이지로 돌아간다
			const home = widgets.findIndex((list) => list.some((widget) => widget.id === current.widget.id));
			if (home >= 0) setPage(home);
			return;
		}
		const changed = pages.some(
			(list, index) => list.map((widget) => widget.id).join() !== widgets[index]?.map((widget) => widget.id).join()
		);
		if (changed) save(pages);
	};

	/** 키보드로 한 칸 옮긴다 (← ↑ 앞으로, → ↓ 뒤로) */
	const moveWithKey = (id: string, step: -1 | 1) => {
		const label = WIDGET_INFO[widgets.flat().find((widget) => widget.id === id)?.kind ?? 'clock'].label;
		const result = moveByKey(widgets, id, step);
		if (!result) {
			setAnnouncement(`${label} 위젯을 더 ${step < 0 ? '앞으로' : '뒤로'} 옮길 수 없습니다`);
			return;
		}
		save(result.pages);
		setPage(result.page);
		refocus.current = id;
		const position = positionOf(result.pages, id);
		if (position) setAnnouncement(`${label} 위젯을 ${position.page}쪽 ${position.index}번째로 옮겼습니다`);
	};

	// 비켜 주기 (FLIP): 순서가 바뀌어 자리가 달라진 위젯을 지난 자리에서 새 자리로 미끄러뜨린다.
	// 떨림 애니메이션은 transform을 쓰므로 translate 속성으로 움직여 서로 덮어쓰지 않는다
	useLayoutEffect(() => {
		const next = new Map<string, { container: Element | null; x: number; y: number }>();
		const animate = editing && !prefersReducedMotion();
		for (const [id, element] of slots.current) {
			if (!element.isConnected) continue;
			const now = { container: element.offsetParent, x: element.offsetLeft, y: element.offsetTop };
			next.set(id, now);
			const before = lastLayout.current.get(id);
			if (!animate || !before || id === drag.current?.widget.id || before.container !== now.container) continue;
			const dx = before.x - now.x;
			const dy = before.y - now.y;
			if (dx || dy)
				element.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
					duration: SLIDE_MS,
					easing: EASE,
				});
		}
		lastLayout.current = next;
		if (refocus.current) {
			const button = slots.current.get(refocus.current)?.querySelector<HTMLElement>('.mobile-widget-move');
			if (button && document.activeElement !== button) button.focus();
			refocus.current = null;
		}
	});

	// 편집이 끝나거나 화면이 사라지면 끌기를 그만둔다
	const finishRef = useRef(finish);
	useLayoutEffect(() => {
		finishRef.current = finish;
	});
	useEffect(() => {
		if (!editing) finishRef.current(false);
	}, [editing]);
	useEffect(() => () => finishRef.current(false), []);

	return {
		shown,
		draggingId,
		announcement,
		slotRef,
		start,
		move,
		end: () => finish(true),
		cancel: () => finish(false),
		moveWithKey,
	};
}
