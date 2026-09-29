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
 * 행·열 전체를 고른 뒤 손잡이를 끌면 그 행·열을 옮긴다 (머리글 행은 옮기지 않는다).
 */
const TableHandles = () => {
	const { state, tableBox, run } = useEditorControls();
	const {
		open: colOpen,
		setOpen: setColOpen,
		buttonRef: colButton,
		panelRef: colPanel,
		position: colPosition,
	} = usePopover(undefined, KEEP_OPEN, 'right');
	const {
		open: rowOpen,
		setOpen: setRowOpen,
		buttonRef: rowButton,
		panelRef: rowPanel,
		position: rowPosition,
	} = usePopover(undefined, KEEP_OPEN, 'right');
	const [drag, setDrag] = useState<Drag | null>(null);
	/** 방금 끌었으면 이어지는 click은 메뉴를 열지 않는다 */
	const dragged = useRef(false);
	const table = state.table;
	if (!table || !tableBox || !run) return null;

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
		// 끌기는 그 행·열 전체를 골랐을 때만 (머리글 행은 옮기지 않는다)
		if (table.selecting !== kind || (kind === 'row' && table.row === 0)) return;
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
		if (drag.kind === 'row') to = Math.max(1, to);
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
			{table.selecting && selection && (
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
			<button
				ref={colButton}
				type="button"
				className={`memo-table-handle col ${colOn ? 'on' : ''} ${drag?.kind === 'col' && drag.moved ? 'dragging' : ''}`}
				aria-label="이 열 편집"
				title={colOn ? '끌어서 열 옮기기, 눌러서 메뉴' : '이 열 편집'}
				aria-haspopup="menu"
				aria-expanded={colOpen}
				style={{
					left: span.left + span.width / 2 - LONG / 2,
					top: tableBox.table.top - SHORT - GAP,
					width: LONG,
					height: SHORT,
					transform: drag?.kind === 'col' ? `translateX(${drag.offset}px)` : undefined,
				}}
				onPointerDown={startDrag('col')}
				onPointerMove={moveDrag}
				onPointerUp={endDrag}
				onPointerCancel={() => setDrag(null)}
				onMouseDown={keepFocus}
				onClick={open('col')}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
			</button>
			<button
				ref={rowButton}
				type="button"
				className={`memo-table-handle row ${rowOn ? 'on' : ''} ${drag?.kind === 'row' && drag.moved ? 'dragging' : ''}`}
				aria-label="이 행 편집"
				title={rowOn && table.row > 0 ? '끌어서 행 옮기기, 눌러서 메뉴' : '이 행 편집'}
				aria-haspopup="menu"
				aria-expanded={rowOpen}
				style={{
					left: tableBox.table.left - SHORT - GAP,
					top: span.top + span.height / 2 - LONG / 2,
					width: SHORT,
					height: LONG,
					transform: drag?.kind === 'row' ? `translateY(${drag.offset}px)` : undefined,
				}}
				onPointerDown={startDrag('row')}
				onPointerMove={moveDrag}
				onPointerUp={endDrag}
				onPointerCancel={() => setDrag(null)}
				onMouseDown={keepFocus}
				onClick={open('row')}
			>
				<i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
			</button>
			{colOpen &&
				!drag &&
				createPortal(
					<div
						ref={colPanel}
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
						ref={rowPanel}
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
	);
};

export default TableHandles;
