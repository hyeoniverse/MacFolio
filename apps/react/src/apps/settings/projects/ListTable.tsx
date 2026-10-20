import { useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { reorderKeyDelta, startPointerReorder } from '@/shared/ui/reorder/pointerReorder';
import { move as moveItem } from '@/apps/settings/showcase';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import { ItemSheet, SheetPage } from './sheet';
import { SheetPageContext } from './sheetContext';

/** 줄 끝의 갈매기 (macOS 설정의 chevron.right): 누르면 다음 화면(시트)이 열린다는 표시 */
export const RowChevron = () => (
	<svg className="projects-nav-chevron" viewBox="0 0 8 14" aria-hidden="true">
		<path d="M1.5 1.5 6.5 7l-5 5.5" />
	</svg>
);

/**
 * 목록 편집 (macOS의 표): 둥근 상자 안의 줄 목록과 아래 ＋ 막대.
 * detail이 있으면 macOS 시스템 설정의 이동 목록처럼 줄 전체가 버튼이다: 누르거나 Enter·Space로 그 항목의 칸을 시트로 연다
 * (＋로 더한 항목도 바로 연다). 순서는 왼쪽 ≡ 손잡이를 끌거나 ↑·↓(⌥↑·⌥↓) 키로 바꾸고, 항목은 시트 아래의 항목 삭제로 지운다.
 * 시트 안의 목록이면 시트를 겹치지 않고 같은 시트 안에 다음 페이지로 민다.
 * detail이 없으면 줄의 칸을 바로 고치는 표다: 줄을 눌러 고르고, 끌거나 ⌥↑·⌥↓로 순서를 바꾸고, −나 Delete로 고른 줄을 뺀다
 */
export function ListTable<T>({
	label,
	title = label,
	nested = false,
	hint,
	items,
	onChange,
	blank,
	columns,
	cells,
	detail,
}: {
	/** 목록의 접근성 이름. 항목 칸의 이름 앞부분('주요 기능 1 제목')과 시트 제목('주요 기능 1')에도 쓴다 */
	label: string;
	/** 목록 위에 보이는 제목 (없으면 label) */
	title?: string;
	/** 다른 항목의 칸 안에 든 목록: 영역(region)이 아니라 묶음(group)으로 둔다 (바깥 목록의 영역 이름과 겹치지 않게) */
	nested?: boolean;
	hint?: string;
	items: T[];
	onChange: (items: T[]) => void;
	/** ＋로 더하는 빈 항목 */
	blank: () => T;
	/** 줄 위의 열 이름 (칸을 바로 고치는 표) */
	columns?: string[];
	/** 줄의 칸들 */
	cells: (item: T, index: number, update: (next: T) => void) => ReactNode[];
	/** 항목의 칸 (시트에 그린다) */
	detail?: (item: T, index: number, update: (next: T) => void) => ReactNode;
}) {
	const [picked, setPicked] = useState<number | null>(null);
	const selected = picked !== null && picked < items.length ? picked : null;
	const [opened, setOpened] = useState<number | null>(null);
	const open = detail && opened !== null && opened < items.length ? opened : null;
	/** 이 목록이 시트 안에 있으면 그 페이지 (항목을 다음 페이지로 민다) */
	const frame = useContext(SheetPageContext);
	const rowId = useId();
	const listRef = useRef<HTMLOListElement>(null);
	const addRef = useRef<HTMLButtonElement>(null);
	/** 그린 뒤 초점을 줄 곳: 줄(이동 목록이면 줄 버튼), 줄의 ≡ 손잡이, (새로 더한 줄이면) 줄의 첫 입력 칸, 또는 ＋ 버튼 */
	const pendingFocus = useRef<{ index: number; target: 'row' | 'handle' | 'input' } | 'add' | null>(null);
	useLayoutEffect(() => {
		const pending = pendingFocus.current;
		if (!pending) return;
		pendingFocus.current = null;
		if (pending === 'add') return addRef.current?.focus();
		const row = listRef.current?.children[pending.index] as HTMLElement | undefined;
		if (pending.target === 'input') row?.querySelector<HTMLElement>('input:not([type="file"])')?.focus();
		else if (pending.target === 'handle') row?.querySelector<HTMLElement>('.projects-row-handle')?.focus();
		else (detail ? row?.querySelector<HTMLElement>('.projects-nav-row') : row)?.focus();
	});
	const update = (index: number) => (next: T) => onChange(items.map((item, i) => (i === index ? next : item)));
	const select = (index: number, focus = true) => {
		setPicked(index);
		if (focus) pendingFocus.current = { index, target: 'row' };
	};
	/** 시트(또는 밀린 페이지)를 닫고 그 줄로 초점을 돌려준다 */
	const closeItem = () => {
		if (open !== null) pendingFocus.current = { index: open, target: 'row' };
		setOpened(null);
	};
	const add = () => {
		onChange([...items, blank()]);
		setPicked(items.length);
		if (detail) setOpened(items.length);
		else pendingFocus.current = { index: items.length, target: 'input' };
	};
	const remove = (index: number) => {
		onChange(items.filter((_, i) => i !== index));
		const next = Math.min(index, items.length - 2);
		setPicked(next >= 0 ? next : null);
		if (next >= 0) pendingFocus.current = { index: next, target: 'row' };
	};
	/** 시트의 항목 삭제: 열린 항목을 지우고 시트를 닫는다. 초점은 다음 줄(마지막이었으면 앞 줄, 남은 줄이 없으면 ＋)로 */
	const removeOpen = () => {
		if (open === null) return;
		remove(open);
		if (items.length < 2) pendingFocus.current = 'add';
		setOpened(null);
	};
	const move = (index: number, delta: number, target: 'row' | 'handle' = 'row') => {
		const to = index + delta;
		if (to < 0 || to >= items.length) return;
		onChange(moveItem(items, index, delta));
		setPicked(to);
		pendingFocus.current = { index: to, target };
	};
	const sheetTitle = open !== null ? `${label} ${open + 1}` : '';
	const sheetContent = open !== null && detail ? <div key={open}>{detail(items[open], open, update(open))}</div> : null;
	const addButton = (
		<button ref={addRef} type="button" aria-label="더하기" title="항목 더하기" onClick={add}>
			<svg viewBox="0 0 10 10" aria-hidden="true">
				<path d="M5 1v8M1 5h8" />
			</svg>
		</button>
	);
	return (
		<section
			className={`projects-group${nested ? ' nested' : ''}`}
			role={nested ? 'group' : undefined}
			aria-label={label}
		>
			<h3 className="projects-group-title">
				{title}
				<span className="projects-group-count">{items.length}</span>
			</h3>
			<div className="projects-box projects-table">
				{columns && items.length > 0 && (
					<div className="projects-table-head" aria-hidden="true">
						{columns.map((column) => (
							<span key={column}>{column}</span>
						))}
					</div>
				)}
				{items.length === 0 ? (
					<EmptyState className="projects-table-empty">항목이 없습니다. ＋를 눌러 더합니다.</EmptyState>
				) : detail ? (
					// 이동 목록 (macOS 설정의 › 줄): 왼쪽 ≡ 손잡이, 가운데 줄 버튼(제목·설명·그림·›)
					<ol className="projects-table-rows nav" aria-label={label} ref={listRef}>
						{items.map((item, index) => {
							const name = `${label} ${index + 1}`;
							return (
								<li key={index} className="projects-table-row nav">
									{/* ≡ 손잡이 (프로젝트 목록의 ≡ 손잡이와 같다): 끌거나 ↑·↓ 키로 순서를 바꾼다 */}
									<button
										type="button"
										className="projects-row-handle"
										aria-label={`${name} 순서 바꾸기`}
										title="끌거나 ↑·↓ 키로 순서를 바꿉니다."
										disabled={items.length < 2}
										onPointerDown={(event) => {
											if (event.button !== 0) return;
											startPointerReorder(event, (from, to) => move(from, to - from, 'handle'));
										}}
										onKeyDown={(event) => {
											const delta = reorderKeyDelta(event.key);
											if (!delta) return;
											event.preventDefault();
											move(index, delta, 'handle');
										}}
									>
										<i className="fa-solid fa-bars" aria-hidden="true" />
									</button>
									<button
										type="button"
										className="projects-nav-row"
										aria-label={`${name} 편집`}
										aria-describedby={`${rowId}-${index}`}
										onClick={() => setOpened(index)}
										onKeyDown={(event) => {
											if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
											event.preventDefault();
											const delta = event.key === 'ArrowUp' ? -1 : 1;
											// ⌥↑·⌥↓는 순서를 바꾸고, ↑·↓는 이웃한 줄로 초점을 옮긴다
											if (event.altKey) move(index, delta);
											else if (index + delta >= 0 && index + delta < items.length)
												pendingFocus.current = { index: index + delta, target: 'row' };
										}}
									>
										<span id={`${rowId}-${index}`} className="projects-nav-cells">
											{cells(item, index, update(index))}
										</span>
										<RowChevron />
									</button>
								</li>
							);
						})}
					</ol>
				) : (
					<ol
						className={`projects-table-rows ${columns ? 'columns' : ''}`}
						role="grid"
						aria-label={label}
						ref={listRef}
					>
						{items.map((item, index) => (
							<li
								key={index}
								role="row"
								aria-selected={index === selected}
								aria-rowindex={index + 1}
								tabIndex={index === (selected ?? 0) ? 0 : -1}
								className="projects-table-row"
								onFocus={(event) => {
									if (event.target !== event.currentTarget) setPicked(index);
								}}
								onPointerDown={(event) => {
									if (event.button !== 0) return;
									if ((event.target as HTMLElement).closest('input, textarea, select, button, label')) return;
									setPicked(index);
									event.currentTarget.focus();
									if (items.length < 2) return;
									// 줄을 끌어서 순서 바꾸기 (프로젝트 목록의 ≡ 손잡이와 같은 동작)
									startPointerReorder(event, (from, to) => {
										onChange(moveItem(items, from, to - from));
										select(to);
									});
								}}
								onKeyDown={(event) => {
									if (event.target !== event.currentTarget) return;
									if (event.altKey) {
										const delta = reorderKeyDelta(event.key);
										if (!delta) return;
										event.preventDefault();
										move(index, delta);
									} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
										event.preventDefault();
										select(Math.min(items.length - 1, Math.max(0, index + (event.key === 'ArrowUp' ? -1 : 1))));
									} else if (event.key === 'Delete' || event.key === 'Backspace') {
										event.preventDefault();
										remove(index);
									}
								}}
							>
								{cells(item, index, update(index)).map((cell, column) => (
									<div key={column} role="gridcell" className="projects-table-cell">
										{cell}
									</div>
								))}
							</li>
						))}
					</ol>
				)}
				<div className="projects-table-bar">
					<span className="projects-segmented">
						{addButton}
						{!detail && (
							<button
								type="button"
								aria-label="빼기"
								title="고른 항목 빼기"
								disabled={selected === null}
								onClick={() => selected !== null && remove(selected)}
							>
								<svg viewBox="0 0 10 10" aria-hidden="true">
									<path d="M1 5h8" />
								</svg>
							</button>
						)}
					</span>
					{hint && <span className="projects-table-note">{hint}</span>}
				</div>
			</div>
			{sheetContent &&
				(frame ? (
					frame.slot &&
					createPortal(
						<SheetPage title={sheetTitle} back={{ label: frame.title, onBack: closeItem }} onDelete={removeOpen}>
							{sheetContent}
						</SheetPage>,
						frame.slot
					)
				) : (
					<ItemSheet title={sheetTitle} onClose={closeItem} onDelete={removeOpen}>
						{sheetContent}
					</ItemSheet>
				))}
		</section>
	);
}
