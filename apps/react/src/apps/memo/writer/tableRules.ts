// 표 편집 규칙 (편집기 없이도 쓰는 부분. 도구 막대가 편집기 코드를 불러오지 않게 따로 둔다)
// Markdown 표는 머리글 한 행 + 본문 한 행 이상이어야 해서, 그보다 적어지는 삭제는 막는다.
import type { TableOp, TableState } from './editorControls';

/** 지우기가 표를 Markdown으로 쓸 수 없게 만들면 막는다 */
export function canRunTableOp(table: TableState, op: TableOp) {
	if (op === 'deleteRow') return !table.header && table.rows - table.selectedRows >= 1;
	if (op === 'deleteCol') return table.cols - table.selectedCols >= 1;
	// 머리글 위에는 줄을 넣지 않는다 (머리글은 늘 첫 줄)
	if (op === 'rowBefore') return !table.header;
	return true;
}
