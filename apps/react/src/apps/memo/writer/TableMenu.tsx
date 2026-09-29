import React from 'react';
import type { TableOp, TableState } from './editorControls';
import { canRunTableOp } from './tableRules';

const TABLE_ITEMS: { op: TableOp; label: string; icon: string }[][] = [
	[
		{ op: 'rowBefore', label: '위에 행 추가', icon: 'fa-solid fa-arrow-up' },
		{ op: 'rowAfter', label: '아래에 행 추가', icon: 'fa-solid fa-arrow-down' },
		{ op: 'colBefore', label: '왼쪽에 열 추가', icon: 'fa-solid fa-arrow-left' },
		{ op: 'colAfter', label: '오른쪽에 열 추가', icon: 'fa-solid fa-arrow-right' },
	],
	[
		{ op: 'deleteRow', label: '행 삭제', icon: 'fa-solid fa-minus' },
		{ op: 'deleteCol', label: '열 삭제', icon: 'fa-solid fa-minus' },
		{ op: 'deleteTable', label: '표 삭제', icon: 'fa-regular fa-trash-can' },
	],
];

const ROW_OPS: TableOp[] = ['rowBefore', 'rowAfter', 'deleteRow'];
const COL_OPS: TableOp[] = ['colBefore', 'colAfter', 'deleteCol'];

/**
 * 표 편집 메뉴: 행·열 추가와 삭제, 열 정렬, 표 삭제. 할 수 없는 삭제(머리글 행, 마지막 행·열)는 꺼 둔다.
 * scope: 도구 막대에서는 전부, 표 손잡이에서는 그 행(row)이나 열(col)에 대한 것만
 */
const TableMenu = ({
	table,
	scope = 'all',
	onRun,
}: {
	table: TableState;
	scope?: 'all' | 'row' | 'col';
	onRun: (op: TableOp, close: boolean) => void;
}) => (
	<div className="memo-table-menu">
		{scope !== 'row' && (
			<div className="memo-format-marks" role="group" aria-label="열 정렬">
				{(
					[
						['left', '왼쪽 정렬', 'fa-align-left'],
						['center', '가운데 정렬', 'fa-align-center'],
						['right', '오른쪽 정렬', 'fa-align-right'],
					] as const
				).map(([align, label, icon]) => (
					<button
						key={align}
						type="button"
						className={table.align === align ? 'on' : ''}
						aria-label={label}
						title={label}
						aria-pressed={table.align === align}
						onClick={() => onRun(align, false)}
					>
						<i className={`fa-solid ${icon}`} aria-hidden="true" />
					</button>
				))}
			</div>
		)}
		<ul className="memo-format-styles" role="menu" aria-label="표 편집">
			{TABLE_ITEMS.map((group) =>
				group.filter(({ op }) => scope === 'all' || (scope === 'row' ? ROW_OPS : COL_OPS).includes(op))
			)
				.filter((group) => group.length > 0)
				.map((group, index) => (
					<React.Fragment key={index}>
						{index > 0 && <li className="memo-format-separator" role="separator" />}
						{group.map(({ op, label, icon }) => (
							<li key={op} role="none">
								<button
									type="button"
									role="menuitem"
									className={op === 'deleteTable' ? 'danger' : ''}
									disabled={!canRunTableOp(table, op)}
									onClick={() => onRun(op, op === 'deleteTable')}
								>
									<i className={`memo-format-icon ${icon}`} aria-hidden="true" /> {label}
								</button>
							</li>
						))}
					</React.Fragment>
				))}
		</ul>
	</div>
);

export default TableMenu;
