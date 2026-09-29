import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uploadAndInsert } from './attachments';
import { useEditorControls, type BlockStyle, type FormatAction, type TableOp, type TableState } from './editorControls';
import { canRunTableOp } from './tableRules';

/** 누를 때 편집기의 커서를 빼앗지 않는다 (서식을 커서 자리에 바로 적용하도록) */
const keepFocus = (event: React.MouseEvent | React.PointerEvent) => event.preventDefault();

/** 단추 아래에 여는 작은 창. 바깥을 누르거나 Esc를 누르면 닫힌다 */
function usePopover(fallback?: React.RefObject<HTMLElement | null>, keepOpenInside?: string) {
	const [open, setOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: 0, top: 0 });

	useLayoutEffect(() => {
		// 단추가 숨어 있으면(좁은 도구 막대) 대신 fallback 단추 아래에 연다
		const anchor = buttonRef.current?.offsetParent ? buttonRef.current : fallback?.current;
		if (!open || !anchor) return;
		const rect = anchor.getBoundingClientRect();
		const width = panelRef.current?.offsetWidth ?? 240;
		setPosition({
			left: Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8)),
			top: rect.bottom + 8,
		});
	}, [open, fallback]);

	useEffect(() => {
		if (!open) return;
		const close = (event: Event) => {
			const target = event.target as Element;
			const inside =
				panelRef.current?.contains(target) ||
				buttonRef.current?.contains(target) ||
				Boolean(keepOpenInside && target.closest?.(keepOpenInside));
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open, keepOpenInside]);

	return { open, setOpen, buttonRef, panelRef, position };
}

const STYLES: { block: BlockStyle; label: string }[] = [
	{ block: 'title', label: '제목' },
	{ block: 'heading', label: '머리말' },
	{ block: 'subheading', label: '부머리말' },
	{ block: 'body', label: '본문' },
	{ block: 'mono', label: '모노 스타일' },
];

/** 이미지로 고를 수 있는 형식 (API가 바로 보여 주는 형식과 같다) */
const IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** 이미지 넣기: 파일에서 고르거나(올린다) 주소로 넣는다. 설명은 화면 읽기 프로그램용 */
const ImageForm = ({
	onInsert,
	onFiles,
}: {
	onInsert: (src: string, alt: string) => void;
	onFiles: (files: File[], alt: string) => void;
}) => {
	const [src, setSrc] = useState('');
	const [alt, setAlt] = useState('');
	const fileInput = useRef<HTMLInputElement>(null);
	return (
		<form
			className="memo-format-image"
			onSubmit={(event) => {
				event.preventDefault();
				if (src.trim()) onInsert(src.trim(), alt.trim());
			}}
		>
			<button type="button" className="memo-format-pick" autoFocus onClick={() => fileInput.current?.click()}>
				<i className="fa-regular fa-folder-open" aria-hidden="true" /> 파일에서 고르기…
			</button>
			<input
				ref={fileInput}
				type="file"
				accept={IMAGE_TYPES}
				multiple
				hidden
				aria-label="이미지 파일"
				onChange={(e) => {
					const files = Array.from(e.target.files ?? []);
					if (files.length) onFiles(files, alt.trim());
				}}
			/>
			<span className="memo-format-or">또는 주소로</span>
			<input
				aria-label="이미지 주소"
				placeholder="https://… 이미지 주소"
				value={src}
				onChange={(e) => setSrc(e.target.value)}
			/>
			<input
				aria-label="이미지 설명"
				placeholder="설명 (비우면 파일 이름)"
				value={alt}
				onChange={(e) => setAlt(e.target.value)}
			/>
			<button type="submit" disabled={!src.trim()}>
				넣기
			</button>
		</form>
	);
};

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

/** 표 편집 메뉴: 행·열 추가와 삭제, 열 정렬, 표 삭제. 할 수 없는 삭제(머리글 행, 마지막 행·열)는 꺼 둔다 */
const TableMenu = ({ table, onRun }: { table: TableState; onRun: (op: TableOp, close: boolean) => void }) => (
	<div className="memo-table-menu">
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
		<ul className="memo-format-styles" role="menu" aria-label="표 편집">
			{TABLE_ITEMS.map((group, index) => (
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

/**
 * 본문 서식 도구 (macOS 메모의 도구 막대처럼): 가가(서식 메뉴), 체크리스트, 표, 이미지, 파일 첨부.
 * 편집기가 열려 있을 때만 보인다. 좁은 도구 막대에서는 가가 메뉴 하나에 모두 모인다.
 */
const FormatTools = () => {
	const { state, run, uploading } = useEditorControls();
	const {
		open: formatOpen,
		setOpen: setFormatOpen,
		buttonRef: formatButton,
		panelRef: formatPanel,
		position: formatPosition,
	} = usePopover();
	const {
		open: imageOpen,
		setOpen: setImageOpen,
		buttonRef: imageButton,
		panelRef: imagePanel,
		position: imagePosition,
	} = usePopover(formatButton);
	const {
		open: tableOpen,
		setOpen: setTableOpen,
		buttonRef: tableButton,
		panelRef: tablePanel,
		position: tablePosition,
		// 표 편집 메뉴는 표의 다른 칸을 눌러도 열어 둔다 (칸을 옮겨 가며 행·열을 고칠 수 있게)
	} = usePopover(formatButton, '.ProseMirror table');
	const attachInput = useRef<HTMLInputElement>(null);
	if (!run) return null;

	const act = (action: FormatAction, close = false) => {
		run(action);
		if (close) setFormatOpen(false);
	};
	const quick = { onPointerDown: keepFocus, onMouseDown: keepFocus };
	const attach = () => attachInput.current?.click();
	// 표 안에서는 표 단추가 표 편집 메뉴를 연다
	const table = state.table;

	return (
		<>
			<button
				ref={formatButton}
				type="button"
				className={`memo-tool memo-format-button ${formatOpen ? 'on' : ''}`}
				aria-label="서식"
				title="서식"
				aria-haspopup="dialog"
				aria-expanded={formatOpen}
				{...quick}
				onClick={() => setFormatOpen((value) => !value)}
			>
				가가
			</button>
			<button
				type="button"
				className={`memo-tool memo-format-quick ${state.list === 'task' ? 'on' : ''}`}
				aria-label="체크리스트"
				title="체크리스트"
				aria-pressed={state.list === 'task'}
				{...quick}
				onClick={() => act({ type: 'list', list: 'task' })}
			>
				<i className="fa-solid fa-list-check" aria-hidden="true" />
			</button>
			<button
				ref={tableButton}
				type="button"
				className={`memo-tool memo-format-quick ${table ? 'on' : ''}`}
				aria-label={table ? '표 편집' : '표'}
				title={table ? '표 편집' : '표 넣기'}
				aria-haspopup={table ? 'dialog' : undefined}
				aria-expanded={table ? tableOpen : undefined}
				{...quick}
				onClick={() => (table ? setTableOpen((value) => !value) : act({ type: 'table' }))}
			>
				<i className="fa-solid fa-table" aria-hidden="true" />
			</button>
			<button
				ref={imageButton}
				type="button"
				className="memo-tool memo-format-quick"
				aria-label="이미지"
				title="이미지"
				aria-haspopup="dialog"
				aria-expanded={imageOpen}
				{...quick}
				onClick={() => setImageOpen((value) => !value)}
			>
				<i className="fa-regular fa-image" aria-hidden="true" />
			</button>
			<button
				type="button"
				className="memo-tool memo-format-quick"
				aria-label="파일 첨부"
				title="파일 첨부"
				{...quick}
				onClick={attach}
			>
				<i className="fa-solid fa-paperclip" aria-hidden="true" />
			</button>
			<input
				ref={attachInput}
				type="file"
				multiple
				hidden
				aria-label="첨부할 파일"
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = '';
					if (files.length) void uploadAndInsert(files);
				}}
			/>
			{uploading > 0 && (
				<span className="memo-format-uploading" role="status">
					올리는 중…
				</span>
			)}

			{formatOpen &&
				createPortal(
					<div
						ref={formatPanel}
						className="memo-format-panel"
						role="dialog"
						aria-label="서식"
						style={formatPosition}
						onMouseDown={keepFocus}
					>
						<div className="memo-format-marks" role="group" aria-label="글자 서식">
							{(
								[
									['strong', '굵게', 'B'],
									['emphasis', '기울임', 'I'],
									['strike', '취소선', 'S'],
									['code', '코드', '</>'],
								] as const
							).map(([mark, label, glyph]) => (
								<button
									key={mark}
									type="button"
									className={`mark-${mark} ${state.marks[mark] ? 'on' : ''}`}
									aria-label={label}
									title={label}
									aria-pressed={state.marks[mark]}
									onClick={() => act({ type: 'mark', mark })}
								>
									{glyph}
								</button>
							))}
						</div>
						<ul className="memo-format-styles" role="menu" aria-label="문단 모양">
							{STYLES.map(({ block, label }) => (
								<li key={block} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={state.block === block && !state.list && !state.quote}
										className={`style-${block}`}
										onClick={() => act({ type: 'block', block }, true)}
									>
										{label}
									</button>
								</li>
							))}
							<li className="memo-format-separator" role="separator" />
							{(
								[
									['bullet', '•', '구분점 목록'],
									['ordered', '1.', '번호 목록'],
									['task', '☐', '체크리스트'],
								] as const
							).map(([list, glyph, label]) => (
								<li key={list} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={state.list === list}
										onClick={() => act({ type: 'list', list }, true)}
									>
										<span aria-hidden="true">{glyph}</span> {label}
									</button>
								</li>
							))}
							<li className="memo-format-separator" role="separator" />
							<li role="none">
								<button
									type="button"
									role="menuitemradio"
									aria-checked={state.quote}
									onClick={() => act({ type: 'quote' }, true)}
								>
									<span className="memo-format-quote">블록 인용</span>
								</button>
							</li>
							<li role="none">
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										if (!table) return act({ type: 'table' }, true);
										setFormatOpen(false);
										setTableOpen(true);
									}}
								>
									{table ? '표 편집…' : '표 넣기'}
								</button>
							</li>
							<li role="none">
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setFormatOpen(false);
										setImageOpen(true);
									}}
								>
									이미지 넣기…
								</button>
							</li>
							<li role="none">
								<button
									type="button"
									role="menuitem"
									onClick={() => {
										setFormatOpen(false);
										attach();
									}}
								>
									파일 첨부…
								</button>
							</li>
						</ul>
					</div>,
					document.body
				)}
			{tableOpen &&
				table &&
				createPortal(
					<div
						ref={tablePanel}
						className="memo-format-panel"
						role="dialog"
						aria-label="표 편집"
						style={tablePosition}
						onMouseDown={keepFocus}
					>
						<TableMenu
							table={table}
							onRun={(op, close) => {
								run({ type: 'tableOp', op });
								if (close) setTableOpen(false);
							}}
						/>
					</div>,
					document.body
				)}
			{imageOpen &&
				createPortal(
					<div
						ref={imagePanel}
						className="memo-format-panel"
						role="dialog"
						aria-label="이미지 넣기"
						style={imagePosition}
					>
						<ImageForm
							onInsert={(src, alt) => {
								run({ type: 'image', src, alt });
								setImageOpen(false);
							}}
							onFiles={(files, alt) => {
								setImageOpen(false);
								void uploadAndInsert(files, { alt, asImage: true });
							}}
						/>
					</div>,
					document.body
				)}
		</>
	);
};

export default FormatTools;
