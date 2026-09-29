import { createPortal } from 'react-dom';
import { useEditorControls, type TableOp } from './editorControls';
import { keepFocus, usePopover } from './popover';
import TableMenu from './TableMenu';

/** 손잡이 메뉴는 표의 다른 칸을 눌러도 열어 둔다 (칸을 옮겨 가며 고칠 수 있게) */
const KEEP_OPEN = '.ProseMirror table';

/**
 * 표 손잡이 (macOS 메모처럼): 커서가 표 안에 있으면 지금 열 위와 지금 행 왼쪽에 작은 손잡이가 생긴다.
 * 누르면 그 열·행에 대한 메뉴(추가, 삭제, 정렬)가 열린다. 도구 막대의 표 편집 메뉴와 같은 명령을 쓴다.
 */
const TableHandles = () => {
	const { state, tableBox, run } = useEditorControls();
	const {
		open: colOpen,
		setOpen: setColOpen,
		buttonRef: colButton,
		panelRef: colPanel,
		position: colPosition,
	} = usePopover(undefined, KEEP_OPEN);
	const {
		open: rowOpen,
		setOpen: setRowOpen,
		buttonRef: rowButton,
		panelRef: rowPanel,
		position: rowPosition,
	} = usePopover(undefined, KEEP_OPEN);
	const table = state.table;
	if (!table || !tableBox || !run) return null;

	const onRun = (op: TableOp, close: boolean) => {
		run({ type: 'tableOp', op });
		if (close) {
			setColOpen(false);
			setRowOpen(false);
		}
	};
	const { cell } = tableBox;

	return (
		<>
			<button
				ref={colButton}
				type="button"
				className={`memo-table-handle col ${colOpen ? 'on' : ''}`}
				aria-label="이 열 편집"
				title="이 열 편집"
				aria-haspopup="dialog"
				aria-expanded={colOpen}
				style={{ left: cell.left + cell.width / 2, top: tableBox.table.top }}
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => {
					setRowOpen(false);
					setColOpen((value) => !value);
				}}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
			</button>
			<button
				ref={rowButton}
				type="button"
				className={`memo-table-handle row ${rowOpen ? 'on' : ''}`}
				aria-label="이 행 편집"
				title="이 행 편집"
				aria-haspopup="dialog"
				aria-expanded={rowOpen}
				style={{ left: tableBox.table.left, top: cell.top + cell.height / 2 }}
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => {
					setColOpen(false);
					setRowOpen((value) => !value);
				}}
			>
				<i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
			</button>
			{colOpen &&
				createPortal(
					<div
						ref={colPanel}
						className="memo-format-panel"
						role="dialog"
						aria-label="열 편집"
						style={colPosition}
						onMouseDown={keepFocus}
					>
						<TableMenu table={table} scope="col" onRun={onRun} />
					</div>,
					document.body
				)}
			{rowOpen &&
				createPortal(
					<div
						ref={rowPanel}
						className="memo-format-panel"
						role="dialog"
						aria-label="행 편집"
						style={rowPosition}
						onMouseDown={keepFocus}
					>
						<TableMenu table={table} scope="row" onRun={onRun} />
					</div>,
					document.body
				)}
		</>
	);
};

export default TableHandles;
