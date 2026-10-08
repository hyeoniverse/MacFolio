import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { uploadAndInsert } from './attachments';
import ImagePanel from './ImagePanel';
import { useEditorControls, type BlockStyle, type FormatAction } from './editorControls';
import { keepFocus, usePopover } from './popover';
import TableMenu from './TableMenu';
import IconButton from '@/shared/ui/button/IconButton';

const STYLES: { block: BlockStyle; label: string }[] = [
	{ block: 'title', label: '제목' },
	{ block: 'heading', label: '머리말' },
	{ block: 'subheading', label: '부머리말' },
	{ block: 'body', label: '본문' },
	{ block: 'mono', label: '모노 스타일' },
];

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
		panel: formatPanelExit,
		position: formatPosition,
	} = usePopover();
	const {
		open: imageOpen,
		setOpen: setImageOpen,
		buttonRef: imageButton,
		panel: imagePanelExit,
		position: imagePosition,
	} = usePopover(formatButton);
	const {
		open: tableOpen,
		setOpen: setTableOpen,
		buttonRef: tableButton,
		panel: tablePanelExit,
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
			<IconButton
				ref={formatButton}
				className="memo-format-button"
				on={formatOpen}
				label="서식"
				aria-haspopup="dialog"
				aria-expanded={formatOpen}
				{...quick}
				onClick={() => setFormatOpen((value) => !value)}
			>
				가가
			</IconButton>
			<IconButton
				className="memo-format-quick"
				on={state.list === 'task'}
				label="체크리스트"
				aria-pressed={state.list === 'task'}
				{...quick}
				onClick={() => act({ type: 'list', list: 'task' })}
				icon="fa-solid fa-list-check"
			/>
			<IconButton
				ref={tableButton}
				className="memo-format-quick"
				on={table !== null}
				label={table ? '표 편집' : '표'}
				title={table ? '표 편집' : '표 넣기'}
				aria-haspopup={table ? 'dialog' : undefined}
				aria-expanded={table ? tableOpen : undefined}
				{...quick}
				onClick={() => (table ? setTableOpen((value) => !value) : act({ type: 'table' }))}
				icon="fa-solid fa-table"
			/>
			<IconButton
				ref={imageButton}
				className="memo-format-quick"
				on={state.image !== null}
				label={state.image ? '이미지 편집' : '이미지'}
				title={state.image ? '고른 이미지의 설명·캡션 고치기' : '이미지 넣기'}
				aria-haspopup="dialog"
				aria-expanded={imageOpen}
				{...quick}
				onClick={() => setImageOpen((value) => !value)}
				icon="fa-regular fa-image"
			/>
			<IconButton
				className="memo-format-quick"
				label="파일 첨부"
				{...quick}
				onClick={attach}
				icon="fa-solid fa-paperclip"
			/>
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
						ref={formatPanelExit}
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
									{state.image ? '이미지 편집…' : '이미지 넣기…'}
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
						ref={tablePanelExit}
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
						ref={imagePanelExit}
						className="memo-format-panel memo-format-panel-wide"
						role="dialog"
						aria-label={state.image ? '이미지 편집' : '이미지 넣기'}
						style={imagePosition}
					>
						<ImagePanel
							key={state.image ? `edit-${state.image.src}` : 'insert'}
							editing={state.image}
							run={run}
							onDone={() => setImageOpen(false)}
						/>
					</div>,
					document.body
				)}
		</>
	);
};

export default FormatTools;
