import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorControls, type TableOp, type TableState } from './editorControls';
import { keepFocus, usePopover } from './popover';
import { canRunTableOp } from './tableRules';

/** 손잡이 메뉴는 표의 다른 칸을 눌러도 열어 둔다 (칸을 옮겨 가며 고칠 수 있게) */
const KEEP_OPEN = '.ProseMirror table';

/** 손잡이 크기 (늘 같은 크기의 둥근 알약) 와 표와의 틈 */
const LONG = 26;
const SHORT = 12;
const GAP = 4;
/** 행·열을 고르면 펼쳐지는 막대의 두께 */
const BAR = 16;
/** 이만큼 움직여야 끌기로 본다 (그보다 적으면 누르기) */
const DRAG_START = 4;

interface Drag {
	kind: 'row' | 'col';
	from: number;
	to: number;
	/** 누른 자리 */
	startX: number;
	startY: number;
	/** 끄는 만큼 고른 테두리를 따라 움직인다 */
	offset: number;
	/** 놓을 자리 표시 선 (편집기 기준) */
	line: number | null;
	/** 누르기가 아니라 끌기가 되었는지 */
	moved: boolean;
}

/** 표의 행·열 경계 (편집기 기준): 각 칸의 시작과 끝 */
function spans(handle: HTMLElement, kind: 'row' | 'col') {
	const root = handle.parentElement!;
	const table = root.querySelector<HTMLTableElement>('.ProseMirror table.memo-table-active');
	if (!table) return [];
	const origin = root.getBoundingClientRect();
	const cells = kind === 'col' ? [...table.rows[0].cells] : [...table.rows];
	return cells.map((cell) => {
		const rect = cell.getBoundingClientRect();
		return kind === 'col'
			? { start: rect.left - origin.left, end: rect.right - origin.left }
			: { start: rect.top - origin.top, end: rect.bottom - origin.top };
	});
}

/** 손잡이 메뉴 (macOS 메모의 표 메뉴): 앞·뒤에 추가, 고른 행·열 삭제 */
const HandleMenu = ({
	table,
	kind,
	onRun,
}: {
	table: TableState;
	kind: 'row' | 'col';
	onRun: (op: TableOp, close: boolean) => void;
}) => {
	const items: { op: TableOp; label: string }[] =
		kind === 'col'
			? [
					{ op: 'colBefore', label: '앞에 열 추가' },
					{ op: 'colAfter', label: '뒤에 열 추가' },
				]
			: [
					{ op: 'rowBefore', label: '위에 행 추가' },
					{ op: 'rowAfter', label: '아래에 행 추가' },
				];
	const remove: TableOp = kind === 'col' ? 'deleteCol' : 'deleteRow';
	const count = kind === 'col' ? table.selectedCols : table.selectedRows;
	return (
		<ul className="memo-format-styles memo-handle-menu" role="menu" aria-label={kind === 'col' ? '열 편집' : '행 편집'}>
			{items.map(({ op, label }) => (
				<li key={op} role="none">
					<button type="button" role="menuitem" disabled={!canRunTableOp(table, op)} onClick={() => onRun(op, false)}>
						{label}
					</button>
				</li>
			))}
			<li className="memo-format-separator" role="separator" />
			<li role="none">
				<button
					type="button"
					role="menuitem"
					disabled={!canRunTableOp(table, remove)}
					onClick={() => onRun(remove, true)}
				>
					{count}개의 {kind === 'col' ? '열' : '행'} 삭제
				</button>
			</li>
		</ul>
	);
};

/**
 * 표 손잡이 (macOS 메모처럼): 커서가 표 안에 있으면 지금 열 위와 지금 행 왼쪽에 작은 둥근 손잡이가 생긴다.
 * 누르면 그 열·행 전체를 고르고(노란 테두리) 메뉴가 열린다. 고른 채로 Backspace를 누르면 칸을 비운다.
 * 행·열 전체를 고른 뒤 손잡이를 끌면 그 행·열을 옮긴다 (첫 행으로 옮기면 그 행이 머리글이 된다).
 * 칸을 마우스로 끌어 고르면 손잡이를 숨기고 고른 칸만 보여 준다.
 */
const TableHandles = () => {
	const { state, tableBox, run } = useEditorControls();
	/** 손잡이가 알약 → 막대로 펼쳐지는 애니메이션이 끝나면 메뉴 자리를 다시 잰다 (메뉴가 손잡이를 가리지 않게) */
	const [settled, setSettled] = useState(0);
	const {
		open: colOpen,
		setOpen: setColOpen,
		buttonRef: colButton,
		panel: colPanelExit,
		position: colPosition,
	} = usePopover(undefined, KEEP_OPEN, 'right', settled);
	const {
		open: rowOpen,
		setOpen: setRowOpen,
		buttonRef: rowButton,
		panel: rowPanelExit,
		position: rowPosition,
	} = usePopover(undefined, KEEP_OPEN, 'right', settled);
	const [drag, setDrag] = useState<Drag | null>(null);
	/** 방금 끌었으면 이어지는 click은 메뉴를 열지 않는다 */
	const dragged = useRef(false);
	/** 꼭짓점을 끄는 중이면 고정된 맞은편 칸 [행, 열] */
	const resizing = useRef<[number, number] | null>(null);
	const table = state.table;
	if (!table || !tableBox || !run) return null;
	// 칸을 끌어 골랐으면 고른 범위의 테두리와 꼭짓점만 (행·열 손잡이는 손잡이로 고를 때만)
	const handles = !table.dragged;

	const onRun = (op: TableOp, close: boolean) => {
		run({ type: 'tableOp', op });
		if (close) {
			setColOpen(false);
			setRowOpen(false);
		}
	};
	const span = table.selecting && tableBox.selection ? tableBox.selection : tableBox.cell;
	const colOn = table.selecting === 'col';
	const rowOn = table.selecting === 'row';

	const startDrag = (kind: 'row' | 'col') => (event: React.PointerEvent<HTMLButtonElement>) => {
		keepFocus(event);
		// 끌기는 그 행·열 전체를 골랐을 때만 (첫 행으로 옮기면 그 행이 머리글이 된다)
		if (table.selecting !== kind) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const from = kind === 'col' ? table.col : table.row;
		dragged.current = false;
		setDrag({
			kind,
			from,
			to: from,
			startX: event.clientX,
			startY: event.clientY,
			offset: 0,
			line: null,
			moved: false,
		});
	};

	const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		if (!drag) return;
		const delta = drag.kind === 'col' ? event.clientX - drag.startX : event.clientY - drag.startY;
		if (!dragged.current && Math.abs(delta) < DRAG_START) return;
		dragged.current = true;
		const edges = spans(event.currentTarget, drag.kind);
		if (!edges.length) return;
		const origin = event.currentTarget.parentElement!.getBoundingClientRect();
		const pointer = drag.kind === 'col' ? event.clientX - origin.left : event.clientY - origin.top;
		// 끄는 자리가 어느 칸의 가운데를 넘었는지로 놓을 자리를 정한다
		let to = edges.findIndex((edge) => pointer < (edge.start + edge.end) / 2);
		if (to === -1) to = edges.length - 1;
		else if (to > drag.from) to -= 1;
		const line = to === drag.from ? null : to < drag.from ? edges[to].start : edges[to].end;
		setDrag({ ...drag, to, offset: delta, line, moved: true });
	};

	const endDrag = () => {
		if (drag && dragged.current && drag.to !== drag.from)
			run({ type: 'tableMove', kind: drag.kind, from: drag.from, to: drag.to });
		setDrag(null);
	};

	const open = (kind: 'row' | 'col') => () => {
		if (dragged.current) {
			dragged.current = false;
			return;
		}
		run({ type: 'tableOp', op: kind === 'col' ? 'selectCol' : 'selectRow' });
		setColOpen(kind === 'col');
		setRowOpen(kind === 'row');
	};

	const selection = tableBox.selection;
	return (
		<>
			{selection && (
				<span
					className={`memo-table-selection ${drag?.moved ? 'dragging' : ''}`}
					aria-hidden="true"
					style={{
						left: selection.left,
						top: selection.top,
						width: selection.width,
						height: selection.height,
						transform: drag
							? drag.kind === 'col'
								? `translateX(${drag.offset}px)`
								: `translateY(${drag.offset}px)`
							: undefined,
					}}
				/>
			)}
			{/* 고른 범위의 대각선 꼭짓점: 끌면 맞은편 꼭짓점을 기준으로 범위를 늘리고 줄인다 */}
			{selection &&
				!drag &&
				(['start', 'end'] as const).map((corner) => (
					<span
						key={corner}
						role="button"
						tabIndex={-1}
						aria-label={corner === 'start' ? '고른 범위 왼쪽 위 끌기' : '고른 범위 오른쪽 아래 끌기'}
						className={`memo-table-corner ${corner}`}
						style={{
							left: corner === 'start' ? selection.left : selection.left + selection.width,
							top: corner === 'start' ? selection.top : selection.top + selection.height,
						}}
						onPointerDown={(event) => {
							keepFocus(event);
							event.currentTarget.setPointerCapture(event.pointerId);
							const last: [number, number] = [table.row + table.selectedRows - 1, table.col + table.selectedCols - 1];
							resizing.current = corner === 'start' ? last : [table.row, table.col];
						}}
						onPointerMove={(event) => {
							const anchor = resizing.current;
							if (!anchor) return;
							const cell = document
								.elementsFromPoint(event.clientX, event.clientY)
								.find((el) => el.matches('.ProseMirror table.memo-table-active :is(td, th)')) as
								HTMLTableCellElement | undefined;
							if (!cell) return;
							const row = (cell.parentElement as HTMLTableRowElement).rowIndex;
							// 꼭짓점으로 범위를 바꿔도 처음 고른 방법은 그대로 (끌어 골랐으면 손잡이를 띄우지 않는다)
							run({ type: 'tableSelect', anchor, head: [row, cell.cellIndex], byHandle: handles });
						}}
						onPointerUp={() => {
							resizing.current = null;
						}}
						onMouseDown={keepFocus}
					/>
				))}
			{drag?.line != null && (
				<span
					className={`memo-table-drop ${drag.kind}`}
					aria-hidden="true"
					style={
						drag.kind === 'col'
							? { left: drag.line, top: tableBox.table.top, height: tableBox.table.height }
							: { top: drag.line, left: tableBox.table.left, width: tableBox.table.width }
					}
				/>
			)}
			{handles && (
				<>
					<button
						ref={colButton}
						type="button"
						className={`memo-table-handle col ${colOn ? 'on' : ''} ${drag?.kind === 'col' && drag.moved ? 'dragging' : ''}`}
						aria-label="이 열 편집"
						title={colOn ? '끌어서 열 옮기기, 눌러서 메뉴' : '이 열 편집'}
						aria-haspopup="menu"
						aria-expanded={colOpen}
						// 평소에는 작은 알약, 열을 고르면 열 폭만큼 펼쳐진 막대(⌄)가 고른 테두리 위에 붙는다
						style={{
							left: colOn ? span.left : span.left + span.width / 2 - LONG / 2,
							top: colOn ? tableBox.table.top - BAR : tableBox.table.top - SHORT - GAP,
							width: colOn ? span.width : LONG,
							height: colOn ? BAR : SHORT,
							transform: drag?.kind === 'col' ? `translateX(${drag.offset}px)` : undefined,
						}}
						onPointerDown={startDrag('col')}
						onPointerMove={moveDrag}
						onPointerUp={endDrag}
						onPointerCancel={() => setDrag(null)}
						onTransitionEnd={(event) => event.propertyName === 'width' && setSettled((n) => n + 1)}
						onMouseDown={keepFocus}
						onClick={open('col')}
					>
						<i className="fa-solid fa-ellipsis" aria-hidden="true" />
						<i className="fa-solid fa-chevron-down memo-table-handle-chevron" aria-hidden="true" />
					</button>
					<button
						ref={rowButton}
						type="button"
						className={`memo-table-handle row ${rowOn ? 'on' : ''} ${drag?.kind === 'row' && drag.moved ? 'dragging' : ''}`}
						aria-label="이 행 편집"
						title={rowOn ? '끌어서 행 옮기기, 눌러서 메뉴' : '이 행 편집'}
						aria-haspopup="menu"
						aria-expanded={rowOpen}
						style={{
							left: rowOn ? tableBox.table.left - BAR : tableBox.table.left - SHORT - GAP,
							top: rowOn ? span.top : span.top + span.height / 2 - LONG / 2,
							width: rowOn ? BAR : SHORT,
							height: rowOn ? span.height : LONG,
							transform: drag?.kind === 'row' ? `translateY(${drag.offset}px)` : undefined,
						}}
						onPointerDown={startDrag('row')}
						onPointerMove={moveDrag}
						onPointerUp={endDrag}
						onPointerCancel={() => setDrag(null)}
						onTransitionEnd={(event) => event.propertyName === 'height' && setSettled((n) => n + 1)}
						onMouseDown={keepFocus}
						onClick={open('row')}
					>
						<i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
						<i className="fa-solid fa-chevron-right memo-table-handle-chevron" aria-hidden="true" />
					</button>
					{colOpen &&
						!drag &&
						createPortal(
							<div
								ref={colPanelExit}
								className="memo-format-panel memo-handle-panel"
								role="dialog"
								aria-label="열 편집"
								style={colPosition}
								onMouseDown={keepFocus}
							>
								<HandleMenu table={table} kind="col" onRun={onRun} />
							</div>,
							document.body
						)}
					{rowOpen &&
						!drag &&
						createPortal(
							<div
								ref={rowPanelExit}
								className="memo-format-panel memo-handle-panel"
								role="dialog"
								aria-label="행 편집"
								style={rowPosition}
								onMouseDown={keepFocus}
							>
								<HandleMenu table={table} kind="row" onRun={onRun} />
							</div>,
							document.body
						)}
				</>
			)}
		</>
	);
};

export default TableHandles;
