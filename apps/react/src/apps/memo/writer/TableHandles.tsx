import { createPortal } from 'react-dom';
import { useEditorControls, type TableOp, type TableState } from './editorControls';
import { keepFocus, usePopover } from './popover';
import { canRunTableOp } from './tableRules';

/** 손잡이 메뉴는 표의 다른 칸을 눌러도 열어 둔다 (칸을 옮겨 가며 고칠 수 있게) */
const KEEP_OPEN = '.ProseMirror table';

/** 손잡이 막대의 두께와 표와의 틈 */
const BAR = 16;
const GAP = 3;

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
 * 표 손잡이 (macOS 메모처럼): 커서가 표 안에 있으면 지금 열 위에 막대, 지금 행 왼쪽에 손잡이가 생긴다.
 * 누르면 그 열·행 전체를 고르고(노란 테두리) 메뉴가 열린다. 고른 채로 Backspace를 누르면 칸을 비운다.
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
	const table = state.table;
	if (!table || !tableBox || !run) return null;

	const onRun = (op: TableOp, close: boolean) => {
		run({ type: 'tableOp', op });
		if (close) {
			setColOpen(false);
			setRowOpen(false);
		}
	};
	// 행·열 전체를 골랐으면 손잡이는 고른 범위에 맞춘다
	const span = table.selecting && tableBox.selection ? tableBox.selection : tableBox.cell;
	const colOn = table.selecting === 'col';
	const rowOn = table.selecting === 'row';

	return (
		<>
			{table.selecting && tableBox.selection && (
				<span
					className="memo-table-selection"
					aria-hidden="true"
					style={{
						left: tableBox.selection.left,
						top: tableBox.selection.top,
						width: tableBox.selection.width,
						height: tableBox.selection.height,
					}}
				/>
			)}
			<button
				ref={colButton}
				type="button"
				className={`memo-table-handle col ${colOn ? 'on' : ''}`}
				aria-label="이 열 편집"
				title="이 열 편집"
				aria-haspopup="menu"
				aria-expanded={colOpen}
				style={{
					left: colOn ? span.left : tableBox.cell.left,
					width: colOn ? span.width : tableBox.cell.width,
					// 고르면 막대가 고른 테두리 위에 붙는다
					top: tableBox.table.top - BAR - (colOn ? 0 : GAP),
					height: BAR,
				}}
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => {
					run({ type: 'tableOp', op: 'selectCol' });
					setRowOpen(false);
					setColOpen(true);
				}}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
				{colOn && <i className="fa-solid fa-chevron-down memo-table-handle-chevron" aria-hidden="true" />}
			</button>
			<button
				ref={rowButton}
				type="button"
				className={`memo-table-handle row ${rowOn ? 'on' : ''}`}
				aria-label="이 행 편집"
				title="이 행 편집"
				aria-haspopup="menu"
				aria-expanded={rowOpen}
				style={{
					left: tableBox.table.left - BAR - (rowOn ? 0 : GAP),
					width: BAR,
					top: rowOn ? span.top : tableBox.cell.top,
					height: rowOn ? span.height : tableBox.cell.height,
				}}
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => {
					run({ type: 'tableOp', op: 'selectRow' });
					setColOpen(false);
					setRowOpen(true);
				}}
			>
				<i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
			</button>
			{colOpen &&
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
