import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEditorControls, type BlockStyle, type FormatAction } from './editorControls';

/** 누를 때 편집기의 커서를 빼앗지 않는다 (서식을 커서 자리에 바로 적용하도록) */
const keepFocus = (event: React.MouseEvent | React.PointerEvent) => event.preventDefault();

/** 단추 아래에 여는 작은 창. 바깥을 누르거나 Esc를 누르면 닫힌다 */
function usePopover(fallback?: React.RefObject<HTMLElement | null>) {
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
			const inside =
				panelRef.current?.contains(event.target as Node) || buttonRef.current?.contains(event.target as Node);
			if (event instanceof KeyboardEvent ? event.key === 'Escape' : !inside) setOpen(false);
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [open]);

	return { open, setOpen, buttonRef, panelRef, position };
}

const STYLES: { block: BlockStyle; label: string }[] = [
	{ block: 'title', label: '제목' },
	{ block: 'heading', label: '머리말' },
	{ block: 'subheading', label: '부머리말' },
	{ block: 'body', label: '본문' },
	{ block: 'mono', label: '모노 스타일' },
];

/** 이미지 넣기: 주소와 설명 (올리기는 아직 없어서 주소로 넣는다) */
const ImageForm = ({ onInsert }: { onInsert: (src: string, alt: string) => void }) => {
	const [src, setSrc] = useState('');
	const [alt, setAlt] = useState('');
	return (
		<form
			className="memo-format-image"
			onSubmit={(event) => {
				event.preventDefault();
				if (src.trim()) onInsert(src.trim(), alt.trim());
			}}
		>
			<input
				aria-label="이미지 주소"
				placeholder="https://… 이미지 주소"
				value={src}
				autoFocus
				onChange={(e) => setSrc(e.target.value)}
			/>
			<input
				aria-label="이미지 설명"
				placeholder="설명 (화면 읽기 프로그램용)"
				value={alt}
				onChange={(e) => setAlt(e.target.value)}
			/>
			<button type="submit" disabled={!src.trim()}>
				넣기
			</button>
		</form>
	);
};

/**
 * 본문 서식 도구 (macOS 메모의 도구 막대처럼): 가가(서식 메뉴), 체크리스트, 표, 이미지.
 * 편집기가 열려 있을 때만 보인다. 좁은 도구 막대에서는 가가 메뉴 하나에 모두 모인다.
 */
const FormatTools = () => {
	const { state, run } = useEditorControls();
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
	if (!run) return null;

	const act = (action: FormatAction, close = false) => {
		run(action);
		if (close) setFormatOpen(false);
	};
	const tool = (label: string, icon: string, action: FormatAction, pressed: boolean, className = '') => (
		<button
			type="button"
			className={`memo-tool memo-format-quick ${pressed ? 'on' : ''} ${className}`}
			aria-label={label}
			title={label}
			aria-pressed={pressed}
			onPointerDown={keepFocus}
			onMouseDown={keepFocus}
			onClick={() => act(action)}
		>
			<i className={icon} aria-hidden="true" />
		</button>
	);

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
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => setFormatOpen((value) => !value)}
			>
				가가
			</button>
			{tool('체크리스트', 'fa-solid fa-list-check', { type: 'list', list: 'task' }, state.list === 'task')}
			{tool('표', 'fa-solid fa-table', { type: 'table' }, false)}
			<button
				ref={imageButton}
				type="button"
				className="memo-tool memo-format-quick"
				aria-label="이미지"
				title="이미지"
				aria-haspopup="dialog"
				aria-expanded={imageOpen}
				onPointerDown={keepFocus}
				onMouseDown={keepFocus}
				onClick={() => setImageOpen((value) => !value)}
			>
				<i className="fa-regular fa-image" aria-hidden="true" />
			</button>

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
								<button type="button" role="menuitem" onClick={() => act({ type: 'table' }, true)}>
									표 넣기
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
						</ul>
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
						/>
					</div>,
					document.body
				)}
		</>
	);
};

export default FormatTools;
